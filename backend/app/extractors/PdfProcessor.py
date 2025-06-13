import sys
import os
import fitz  # PyMuPDF
import datetime
import re
import time
from pdf2image import convert_from_path
import concurrent.futures
from functools import partial
import multiprocessing
import logging
from typing import List, Dict, Tuple, Optional
from PIL import Image
import queue
import threading
from dotenv import load_dotenv
from google import genai
import pathlib

class ApiKeyManager:
    """Manages API keys and client rotation in a thread-safe manner with rate limiting"""
    
    def __init__(self, api_keys):
        self.api_keys = api_keys
        self.active_keys_lock = threading.Lock()
        self.idle_keys_queue = queue.Queue()
        
        # Rate limiting - track last request time for each key
        self.last_request_time = {}
        self.request_interval = 0.2  # Minimum time between requests for the same key
        
        # Initialize clients for all keys
        self.clients = {}
        for key in api_keys:
            self.clients[key] = genai.Client(api_key=key)
            self.last_request_time[key] = 0  # Initialize last request time
            
        # Split keys into active and idle based on half of total keys
        active_count = max(1, len(api_keys))
        self.active_keys = {api_keys[i]: None for i in range(active_count)}  # Key -> thread_id mapping
        
        # Put remaining keys in the idle queue
        for i in range(active_count, len(api_keys)):
            self.idle_keys_queue.put(api_keys[i])
    
    def get_client(self, thread_id):
        """Get an available API client for the thread"""
        with self.active_keys_lock:
            # Check if this thread already has a key assigned
            for key, assigned_thread in self.active_keys.items():
                if assigned_thread == thread_id:
                    return self.clients[key], key
            
            # Find an unassigned key
            for key, assigned_thread in self.active_keys.items():
                if assigned_thread is None:
                    self.active_keys[key] = thread_id
                    return self.clients[key], key
            
            # If no available keys in active set, wait for one from the idle queue
            logger = logging.getLogger("PDFProcessor")
            logger.info(f"Thread {thread_id} waiting for an available API key")
            
        # Get key from idle queue (outside the lock to prevent deadlock)
        idle_key = self.idle_keys_queue.get()
        
        # Acquire lock again to update active keys
        with self.active_keys_lock:
            # Find a key to replace in active keys
            for active_key in self.active_keys:
                if self.active_keys[active_key] is None:
                    self.active_keys[active_key] = thread_id
                    self.active_keys[active_key] = idle_key
                    self.idle_keys_queue.put(active_key)
                    return self.clients[idle_key], idle_key
            
            # If no free slot (shouldn't happen), create a new slot
            self.active_keys[idle_key] = thread_id
            return self.clients[idle_key], idle_key
    
    def release_client(self, key, thread_id):
        """Mark a client as not being used by the thread"""
        with self.active_keys_lock:
            if key in self.active_keys and self.active_keys[key] == thread_id:
                self.active_keys[key] = None
                logger = logging.getLogger("PDFProcessor")
                logger.info(f"Thread {thread_id} released API key")
    
    def rotate_key(self, exhausted_key, thread_id):
        """Move exhausted key to idle queue and get a new key"""
        with self.active_keys_lock:
            if exhausted_key in self.active_keys:
                del self.active_keys[exhausted_key]
                
                # Get new key from idle queue
                try:
                    new_key = self.idle_keys_queue.get_nowait()
                    self.active_keys[new_key] = thread_id
                    
                    # Put exhausted key at the end of idle queue
                    self.idle_keys_queue.put(exhausted_key)
                    
                    # Reset the request time for the new key to ensure proper spacing
                    # Add a small offset to current time to ensure we don't immediately hit it
                    elapsed = time.time() - self.last_request_time.get(new_key, 0)
                    logger = logging.getLogger("PDFProcessor")
                    if elapsed < self.request_interval:
                        # If this key was recently used, we'll need to wait before using it
                        logger.info(f"Thread {thread_id} - New key was used recently ({elapsed:.2f}s ago)")
                    
                    logger.info(f"Thread {thread_id} rotated exhausted key with a new one")
                    return self.clients[new_key], new_key
                except queue.Empty:
                    # If no keys available, put the exhausted key back and let it cool down
                    self.active_keys[exhausted_key] = None
                    logger = logging.getLogger("PDFProcessor")
                    logger.warning(f"No idle keys available, keeping exhausted key {exhausted_key}")
                    # Reset last request time to force a delay before reusing
                    self.last_request_time[exhausted_key] = time.time() - (self.request_interval / 2)
                    return self.clients[exhausted_key], exhausted_key
        
        # Should not reach here
        return self.clients[exhausted_key], exhausted_key

class PDFProcessor:
    """
    A comprehensive PDF processor that:
    1. Extracts and saves pages as images with proper rotation
    2. Extracts text using multiple fallback methods
    3. Extracts embedded images from the PDF
    4. Extracts tables from pages using Gemini API and converts to markdown
    """
    
    def __init__(self, pdf_path: str, output_folder: str = None, language: str = "eng"):
        """
        Initialize the PDF processor.
        
        Args:
            pdf_path (str): Path to the PDF file
            output_folder (str): Folder to save outputs (if None, creates one based on PDF name)
            language (str): Language code for OCR (default: "eng")
        """
        self.pdf_path = pdf_path
        self.file_id = os.path.basename(pdf_path).replace(' ', '_').replace('.pdf', '')
        
        # Set up output folder
        if output_folder is None:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            self.output_folder = f"{self.file_id}"
        else:
            self.output_folder = output_folder
            
        # Create the folder if it doesn't exist
        if not os.path.exists(self.output_folder):
            os.makedirs(self.output_folder)
            
        # Set up logger
        self.logger = logging.getLogger("PDFProcessor")
        # Remove all existing handlers to prevent duplicates
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)
        # Add a new handler
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
        
        self.language = language
        
        # Load Gemini API keys
        load_dotenv()
        self.api_keys = os.getenv("GEMINI_KEYS", "").split(" ")
        if not self.api_keys or self.api_keys == [""]:
            self.logger.warning("No GEMINI_KEYS found in environment variables. Table extraction will be disabled.")
            self.table_extraction_enabled = False
        else:
            self.table_extraction_enabled = True
    
    def process_pdf(self, num_workers: int = 4) -> List[Dict]:
        """
        Process a PDF file to:
        1. Extract pages as images with proper rotation
        2. Extract text content using multiple fallback methods
        3. Extract embedded images
        4. Extract tables using Gemini API
        
        Args:
            num_workers (int): Number of worker threads to use
            
        Returns:
            List[Dict]: Data for each page including text and image paths
        """
        # Start timing
        start_time = time.time()
        
        # Check if the PDF file exists
        if not os.path.exists(self.pdf_path):
            self.logger.error(f"Error: The file {self.pdf_path} does not exist.")
            return []
        
        # Create image folder for page renders
        page_images_folder = os.path.join(self.output_folder, "page_images")
        os.makedirs(page_images_folder, exist_ok=True)
        
        # Open the PDF file to get total pages
        doc = fitz.open(self.pdf_path)
        num_pages = len(doc)
        doc.close()  # Close it immediately, we don't need it in the main process
        
        # Set number of workers to CPU count (8 cores for MacBook Air M2)
        cpu_count = 8
        self.logger.info(f"PDF has {num_pages} pages. Processing using {cpu_count} workers")
        
        # Divide pages among workers
        page_nums = list(range(num_pages))
        batch_size = max(1, len(page_nums) // cpu_count)
        page_batches = [page_nums[i:i + batch_size] for i in range(0, len(page_nums), batch_size)]
        
        # Process batches in parallel
        all_results = []
        
        # For macOS, use ThreadPoolExecutor instead of ProcessPoolExecutor for better compatibility
        with concurrent.futures.ThreadPoolExecutor(max_workers=cpu_count) as executor:
            # Submit jobs with page batches
            futures = {
                executor.submit(self._process_page_batch, batch, page_images_folder): batch 
                for batch in page_batches
            }
            
            for future in concurrent.futures.as_completed(futures):
                try:
                    batch_results = future.result()
                    all_results.extend(batch_results)
                except Exception as e:
                    batch = futures[future]
                    self.logger.error(f"Error processing batch {batch}: {str(e)}")
        
        # Sort results by page number for readability
        all_results.sort(key=lambda x: x["page"])
        
        # Process tables from page images if enabled
        if self.table_extraction_enabled:
            self.logger.info("Starting table extraction from page images...")
            tables_folder = os.path.join(self.output_folder, "tables")
            os.makedirs(tables_folder, exist_ok=True)
            
            # Extract tables from page images with number of workers equal to API key count
            self._extract_tables_from_images(page_images_folder, tables_folder, len(self.api_keys))
        
        # Calculate and display statistics
        total_pages = len(all_results)
        total_rotated = sum(1 for page in all_results if page.get("rotation", 0) != 0)
        total_images = sum(len(page.get("embedded_images", [])) for page in all_results)
        
        # Calculate and display the total processing time
        end_time = time.time()
        total_time = end_time - start_time
        
        self.logger.info(f"\nCompleted processing. Outputs saved in folder: {self.output_folder}")
        self.logger.info(f"Total processing time: {total_time:.2f} seconds")
        self.logger.info(f"Average time per page: {total_time/total_pages:.2f} seconds")
        self.logger.info(f"Total pages processed: {total_pages}")
        self.logger.info(f"Total pages rotated: {total_rotated}")
        self.logger.info(f"Total embedded images extracted: {total_images}")
        
        return all_results
    
    def _process_page_batch(self, page_nums: List[int], page_images_folder: str) -> List[Dict]:
        """
        Process a batch of pages from the PDF file.
        
        Args:
            page_nums (List[int]): List of page numbers to process
            page_images_folder (str): Folder to save the page images
        
        Returns:
            List[Dict]: Page data including text content and image paths
        """
        results = []
        
        # Open the PDF once for this batch
        doc = fitz.open(self.pdf_path)
        
        # Create embedded images folder
        embedded_images_folder = os.path.join(self.output_folder, "embedded_images")
        os.makedirs(embedded_images_folder, exist_ok=True)
        
        for page_num in page_nums:
            start_time = time.time()
            self.logger.info(f"Processing page {page_num + 1}")
            
            # Get the specific page
            page = doc[page_num]
            
            # STEP 1: Detect page orientation
            rotation_needed = self._detect_orientation(page)
            
            # STEP 2: Extract text with fallback methods
            page_text, extraction_method = self._extract_text(page)
            
            # STEP 3: Extract embedded images from the page
            embedded_images = self._extract_embedded_images(doc, page, page_num, embedded_images_folder)
            
            # STEP 4: Render the page as an image
            page_image_path = self._render_page_image(
                pdf_path=self.pdf_path,
                page_num=page_num,
                rotation=rotation_needed,
                output_folder=page_images_folder
            )
            
            # STEP 5: Create page data with all extracted information
            page_data = {
                "page": page_num + 1,
                "page_content": page_text,
                "extraction_method": extraction_method,
                "rotation": rotation_needed,
                "processing_time": time.time() - start_time,
                "page_image_path": page_image_path,
                "image_content": embedded_images
            }
            
            results.append(page_data)
            
            # Log completion of this page
            self.logger.info(
                f"Completed page {page_num + 1}: "
                f"Extracted {len(page_text.split())} words using {extraction_method}, "
                f"rotation={rotation_needed}°, "
                f"image_content={len(embedded_images)}"
            )
        
        # Close the document after processing all pages in the batch
        doc.close()
        
        return results

    def _extract_tables_from_images(self, images_folder: str, tables_folder: str, num_workers: int = 4):
        """
        Extract tables from page images using Gemini API.
        
        Args:
            images_folder (str): Folder containing the page images
            tables_folder (str): Folder to save the extracted tables
            num_workers (int): Number of worker threads to use
        """
        self.logger.info(f"Extracting tables from images in {images_folder}")
        
        # Start timing for table extraction
        table_extraction_start_time = time.time()
        
        # Create API key manager
        key_manager = ApiKeyManager(self.api_keys)
        
        # Find all image files
        image_files = []
        for entry in os.listdir(images_folder):
            file_path = os.path.join(images_folder, entry)
            if os.path.isfile(file_path) and any(file_path.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png']):
                image_files.append((entry, file_path, 1))  # (filename, path, attempts)
        
        if not image_files:
            self.logger.warning(f"No image files found in {images_folder}")
            return
        
        self.logger.info(f"Found {len(image_files)} image files to process for tables")
        
        # Create work and results queues
        work_queue = queue.Queue()
        results_queue = queue.Queue()
        
        # Add all files to work queue
        for file_data in image_files:
            work_queue.put(file_data)
        
        # Define worker function
        def worker_thread():
            thread_id = threading.get_ident()
            self.logger.info(f"Table extraction thread {thread_id} starting")
            
            while True:
                try:
                    # Try to get a file from the work queue with a timeout
                    file_data = work_queue.get(timeout=1)
                    
                    # Process the file
                    result = self._process_image_for_tables(file_data, key_manager, tables_folder, work_queue)
                    results_queue.put(result)
                    
                    # Mark task as done
                    work_queue.task_done()
                    
                except queue.Empty:
                    # Check if any items are still in the queue
                    if work_queue.empty():
                        self.logger.info(f"Thread {thread_id} exiting - no more files")
                        break
        
        # Start worker threads
        threads = []
        for i in range(min(num_workers, len(image_files))):
            thread = threading.Thread(
                target=worker_thread,
                name=f"TableWorker-{i+1}"
            )
            thread.daemon = True
            thread.start()
            threads.append(thread)
            # Stagger thread starts to avoid initial burst of API calls
            if i < num_workers - 1:
                time.sleep(0.2)
        
        # Wait for all work to be done
        work_queue.join()
        
        # Signal threads to exit
        for thread in threads:
            thread.join(timeout=1)
        
        # Collect results
        results = []
        while not results_queue.empty():
            results.append(results_queue.get())
        
        # Log summary
        successful_files = [r for r in results if r[2]]
        failed_files = [r for r in results if not r[2]]
        
        # Calculate and display the table extraction time
        table_extraction_end_time = time.time()
        table_extraction_time = table_extraction_end_time - table_extraction_start_time
        
        self.logger.info(f"Table extraction complete:")
        self.logger.info(f"Successfully processed: {len(successful_files)} files")
        self.logger.info(f"Failed: {len(failed_files)} files")
        self.logger.info(f"Table extraction time: {table_extraction_time:.2f} seconds")
    
    def _process_image_for_tables(self, file_data, key_manager, tables_folder, work_queue):
        """
        Process a single image to extract tables using Gemini API.
        
        Args:
            file_data: Tuple of (filename, file_path, attempts)
            key_manager: API key manager
            tables_folder: Folder to save the extracted tables
            work_queue: Work queue for retrying failed files
            
        Returns:
            Tuple: (filename, processing_time, success_flag, error_info)
        """
        filen, file_path, attempts = file_data
        thread_id = threading.get_ident()
        file_start_time = time.time()
        
        self.logger.info(f"Thread {thread_id} processing {filen} for tables (attempt #{attempts})")
        
        try:
            image = Image.open(file_path)
        except Exception as e:
            self.logger.error(f"Failed to open image {filen}: {e}")
            return filen, 0, False, None
        
        # For same key retries
        same_key_retries = 0
        max_same_key_retries = 3
        
        # Get initial client and key
        client, current_key = key_manager.get_client(thread_id)
        
        try:
            self.logger.info(f"Thread {thread_id} using key {current_key[:8]}... (attempt {attempts})")
            
            # Apply rate limiting - wait if needed
            current_time = time.time()
            elapsed_time = current_time - key_manager.last_request_time.get(current_key, 0)
            if elapsed_time < key_manager.request_interval:
                sleep_time = key_manager.request_interval - elapsed_time
                self.logger.info(f"Thread {thread_id} waiting {sleep_time:.2f}s for rate limit")
                time.sleep(sleep_time)
            
            # Make API call with timeout
            response, completed = self._make_table_extraction_api_call(
                client, image, current_key, thread_id, key_manager
            )
            
            # If timeout occurred, add back to work queue and exit
            if not completed:
                # Increment attempts and put back in queue if under max attempts
                attempts += 1
                if attempts <= 10:  # Max 10 attempts per file
                    self.logger.warning(f"Thread {thread_id} - Adding {filen} back to work queue due to timeout (attempt {attempts})")
                    work_queue.put((filen, file_path, attempts))
                else:
                    self.logger.error(f"Thread {thread_id} - {filen} failed after maximum retries (10)")
                
                # Release the API key and return
                key_manager.release_client(current_key, thread_id)
                return filen, time.time() - file_start_time, False, "timeout"
            
            # Check if response or response.text is None
            if response is None or response.text is None:
                self.logger.warning(f"Thread {thread_id} received None response for {filen}")
                
                # Increment attempts and put back in queue if under max attempts
                attempts += 1
                if attempts <= 10:  # Max 10 attempts per file
                    self.logger.warning(f"Thread {thread_id} - Adding {filen} back to work queue due to None response (attempt {attempts})")
                    work_queue.put((filen, file_path, attempts))
                else:
                    self.logger.error(f"Thread {thread_id} - {filen} failed after maximum retries (10)")
                
                # Release the API key and return
                key_manager.release_client(current_key, thread_id)
                return filen, time.time() - file_start_time, False, "empty_response"
            
            markdown_output = response.text.replace("```markdown","").replace("```","")
            
            
            # Process the result
            if "NO TABLES FOUND" in markdown_output:
                self.logger.info(f"Thread {thread_id} - Image {filen} doesn't contain tables")
            else:
                self.logger.info(f"Thread {thread_id} - Table extracted successfully from {filen}")
                
                # Extract page number from filename (assumed format: page_001.png, page_002.png, etc.)
                page_number = None
                if filen.startswith("page_"):
                    try:
                        # Remove 'page_' prefix and file extension, then convert to int
                        page_str = filen.replace("page_", "").split(".")[0]
                        page_number = int(page_str)
                    except (ValueError, IndexError):
                        # If parsing fails, use the original filename
                        page_number = None
                
                # Create the markdown filename in p{page_number}.md format
                if page_number is not None:
                    markdown_filename = f"p{page_number}.md"
                else:
                    # Fallback to using the original filename if page number extraction fails
                    markdown_filename = f"{filen}.md"
                
                output_path = os.path.join(tables_folder, markdown_filename)
                with open(output_path, "w", encoding="utf-8") as file:
                    file.write(markdown_output)
            
            file_duration = time.time() - file_start_time
            
            # Release the API key back to the pool
            key_manager.release_client(current_key, thread_id)
            
            return filen, file_duration, True, None
            
        except Exception as e:
            error_message = str(e)
            
            # Increment attempts
            attempts += 1
            
            if "Resource has been exhausted" in error_message or "quota" in error_message.lower():
                self.logger.warning(f"Thread {thread_id} - API key {current_key[:8]} exhausted. Rotating key.")
                # Get a new key from the manager
                key_manager.rotate_key(current_key, thread_id)
            else:
                # For other errors, log the error
                self.logger.error(f"Thread {thread_id} - Error processing {filen}: {e}")
            
            # Put back in queue if under max attempts
            if attempts <= 10:  # Max 10 attempts per file
                self.logger.warning(f"Thread {thread_id} - Adding {filen} back to work queue due to error (attempt {attempts})")
                work_queue.put((filen, file_path, attempts))
            else:
                self.logger.error(f"Thread {thread_id} - {filen} failed after maximum retries (10)")
            
            # Release the API key back to the pool
            key_manager.release_client(current_key, thread_id)
            
            return filen, time.time() - file_start_time, False, "error"
    
    def _make_table_extraction_api_call(self, client, image, current_key, thread_id, key_manager):
        """
        Make API call to Gemini to extract tables with a timeout of 50 seconds.
        
        Args:
            client: Gemini API client
            image: PIL image
            current_key: Current API key
            thread_id: Thread ID
            key_manager: API key manager
            
        Returns:
            Tuple: (response, completed_flag)
        """
        start_time = time.time()
        
        # Update last request time
        key_manager.last_request_time[current_key] = start_time
        
        try:
            # Using a separate thread to handle timeout
            response_queue = queue.Queue()
            
            def api_call():
                try:
                    response = client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=[image, "This image probably contains a table.\n If it has one or more tables, start the response with \"## table_name\", where table_name is a descriptive title of the table in sql-compatible format within 50 characters.\nAfter that write this data's sql-style table in markdown. (Column headers in only small letters and underscores, no spaces)\nIntelligently decide the table name and column headers before writing to ensure all information is present. If you find any data inside the table not following the layout, you may intelligently make new column(s) as required, just make sure all information in the table is incorporated well in your response. Sometimes there are multiple rows of headers with merged cells, ensure that you understand the context, separate those columns and write meaningful column headers. If you think that the table(s) is/are too large to extract directly, you can begin your response with a short \"## Analysis\" section at the beginning with your analysis of the data and the columns you plan to make.\nIf there are multiple tables in the image, write them separately in thae same format.\nIf there are no tables in the image, just write \"NO TABLES FOUND\"\nYou don't have to add any extra spaces or dashes for formatting (use as less characters as possible), and use just |---| for row following header row.\nSpecial Instruction: If you find a heading (bold or just one line starkly different from the table), then that indicates the start of a new table with headers same as the previous table, so if you get such a scenario, write a new table, with that heading as part of the new table name.\n"])
                    response_queue.put(("success", response))
                except Exception as e:
                    response_queue.put(("error", e))
            
            # Start API call in a separate thread
            api_thread = threading.Thread(target=api_call)
            api_thread.daemon = True
            api_thread.start()
            
            # Wait for response with timeout of 50 seconds
            try:
                status, result = response_queue.get(timeout=50)
                if status == "success":
                    elapsed = time.time() - start_time
                    self.logger.info(f"Thread {thread_id} - API call completed in {elapsed:.2f} seconds")
                    return result, True
                else:
                    # An error occurred
                    raise result
            except queue.Empty:
                # Timeout occurred
                elapsed = time.time() - start_time
                self.logger.warning(f"Thread {thread_id} - API call timed out after {elapsed:.2f} seconds")
                return None, False
            
        except Exception as e:
            self.logger.error(f"Thread {thread_id} - API call error: {e}")
            return None, False
    
    def _detect_orientation(self, page) -> int:
        """
        Detect text orientation on the page to determine if rotation is needed.
        
        Args:
            page: PyMuPDF page object
            
        Returns:
            int: Rotation angle needed (0, 90, 180, or 270)
        """
        rotation_needed = 0
        blocks = page.get_text("dict").get("blocks", [])
        
        if blocks:
            # Function to get direction from a line
            def get_direction(line):
                if "dir" in line and isinstance(line["dir"], (list, tuple)) and len(line["dir"]) >= 2:
                    x, y = line["dir"][0], line["dir"][1]
                    if abs(x) > abs(y):  # Horizontal-dominant orientation
                        if x < 0:  # Right-to-left
                            return 180
                        else:
                            return 0
                    else:  # Vertical-dominant orientation
                        if y > 0:  # Bottom-to-top
                            return 90
                        elif y < 0:  # Top-to-bottom but vertical
                            return 270
                return 0  # Default: no rotation
            
            # Get the first text piece's direction
            first_dir = None
            if len(blocks) > 0 and blocks[len(blocks)//2].get("lines") and blocks[len(blocks)//2]["lines"]:
                first_dir = get_direction(blocks[len(blocks)//2]["lines"][0])
            
            # Get the last text piece's direction
            mid_dir = None
            if len(blocks) > 0:
                mid_block = blocks[len(blocks)//2+1]
                if mid_block.get("lines") and mid_block["lines"]:
                    mid_dir = get_direction(mid_block["lines"][-1])
            
            # Only rotate if the directions are different
            if first_dir is not None and mid_dir is not None and first_dir == mid_dir:
                # Use the first direction as the rotation needed
                rotation_needed = first_dir
        
        return rotation_needed
    
    def _extract_text(self, page) -> Tuple[str, str]:
        """
        Extract text from a page using multiple fallback methods.
        
        Args:
            page: PyMuPDF page object
            
        Returns:
            Tuple[str, str]: (extracted text, method used)
        """
        # Try different extraction modes in sequence
        extraction_modes = ["text", "blocks", "words", "html"]
        
        for mode in extraction_modes:
            page_text = page.get_text(mode)
            
            # Process the text based on the mode
            if mode == "blocks" and isinstance(page_text, list):
                # Blocks mode returns a list of tuples, concatenate them
                blocks_text_content = ""
                for block in page_text:
                    if isinstance(block, tuple) and len(block) >= 4:
                        blocks_text_content += str(block[4]) + "\n"
                    elif isinstance(block, str):
                        blocks_text_content += block + "\n"
                page_text = blocks_text_content
                
            elif mode == "words" and isinstance(page_text, list):
                # Words mode returns a list of tuples, concatenate them
                words_text_content = ""
                for word in page_text:
                    if isinstance(word, tuple) and len(word) >= 4:
                        words_text_content += str(word[4]) + " "
                    elif isinstance(word, str):
                        words_text_content += word + " "
                page_text = words_text_content
                
            elif mode == "html" and isinstance(page_text, str):
                # Extract text from HTML
                try:
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(page_text, 'html.parser')
                    page_text = soup.get_text()
                except ImportError:
                    self.logger.warning("BeautifulSoup not installed, using HTML text as-is")
            
            # If we have meaningful text content, return it
            if page_text and page_text.strip():
                return page_text.strip(), mode
        
        # If all extraction modes fail, try OCR as a last resort
        self.logger.info("All text extraction modes failed. Trying OCR fallback.")
        try:
            import pytesseract
            
            # Render page as image
            pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Extract text with OCR
            ocr_text = pytesseract.image_to_string(img, lang=self.language)
            if ocr_text.strip():
                return ocr_text.strip(), "ocr"
        except ImportError:
            self.logger.warning("OCR fallback failed: pytesseract not installed")
        
        # If everything fails, return empty string
        return "", "none"
    
    def _extract_embedded_images(self, doc, page, page_num: int, images_folder: str) -> List[Dict]:
        """
        Extract embedded images from a page.
        
        Args:
            doc: PyMuPDF document object
            page: PyMuPDF page object
            page_num: Page number (0-based)
            images_folder: Folder to save the images
            
        Returns:
            List[Dict]: Information about extracted images
        """
        page_images = []
        image_list = page.get_images(full=True)

        for img_index, img in enumerate(image_list):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                # Create the image file name
                image_filename = f"page{page_num+1}image{img_index}.{image_ext}"
                image_path = os.path.join(images_folder, image_filename)

                # Save the image to disk
                with open(image_path, "wb") as img_file:
                    img_file.write(image_bytes)

                # Store the relative path
                rel_path = os.path.join(f"{self.file_id}_images", image_filename)

                page_images.append({
                    "index": img_index,
                    "extension": image_ext,
                    "mime_type": f"image/{image_ext}",
                    "path": rel_path,
                    "url": f"/api/extracted-image/{self.file_id}/{self.file_id}_images/{image_filename}"
                })
                
            except Exception as e:
                self.logger.error(f"Error extracting image {img_index} from page {page_num+1}: {e}")

        return page_images
    
    def _render_page_image(self, pdf_path: str, page_num: int, rotation: int, output_folder: str) -> str:
        """
        Render a PDF page as image and save it to disk.
        
        Args:
            pdf_path: Path to the PDF file
            page_num: Page number (0-based)
            rotation: Rotation angle to apply
            output_folder: Folder to save the image
            
        Returns:
            str: Path to the saved image
        """
        # Use pdf2image to extract the image of this specific page
        dpi = 150  # Higher DPI for better quality
        images = convert_from_path(
            pdf_path, 
            dpi=dpi, 
            first_page=page_num+1, 
            last_page=page_num+1
        )
        
        image_path = ""
        if images:
            img = images[0]
            
            # Apply rotation if needed
            if rotation != 0:
                img = img.rotate(rotation, expand=True)
            
            # Save the image
            image_filename = f"page_{page_num + 1:03d}.png"
            image_path = os.path.join(output_folder, image_filename)
            img.save(image_path)
            
            # Return relative path for consistency
            image_path = os.path.join("page_images", image_filename)
        
        return image_path


def main():
    """
    Main function to process command line arguments.
    """
    if len(sys.argv) < 2:
        print("Usage: python script.py <pdf_file_path> [num_workers]")
        return
    
    pdf_path = sys.argv[1]
    
    # Get number of workers from command line or use default (4)
    num_workers = 4
    if len(sys.argv) > 2:
        try:
            num_workers = int(sys.argv[2])
        except ValueError:
            print(f"Invalid number of workers: {sys.argv[2]}. Using default: 4")
    
    # Initialize the PDF processor
    processor = PDFProcessor(pdf_path)
    
    # Process the PDF
    results = processor.process_pdf(num_workers)
    
    # Output a summary
    print(f"\nProcessed {len(results)} pages:")
    for page_data in results:
        word_count = len(page_data["page_content"].split())
        image_count = len(page_data["image_content"])
        print(f"Page {page_data['page']}: {word_count} words, {image_count} images, "
              f"using {page_data['extraction_method']} extraction")


if __name__ == "__main__":
    # Set the multiprocessing start method to 'spawn' for better macOS compatibility
    if sys.platform == 'darwin':  # Check if running on macOS
        multiprocessing.set_start_method('spawn', force=True)
    else:
        multiprocessing.freeze_support()  # For Windows compatibility
    
    main()