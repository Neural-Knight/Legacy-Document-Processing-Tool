import os
import fitz  # PyMuPDF
import pdfplumber
import pandas as pd
import subprocess
from PIL import Image
from io import BytesIO
import json
import pypdfium2 as pdfium
from pytesseract import image_to_string
import logging
from typing import List, Dict, Union, Any, Optional, Tuple
import tempfile
import re
import numpy as np
import cv2
import pytesseract
from datetime import datetime
import base64
import uuid
import shutil  # Import shutil for directory removal
import argparse  # Import argparse for command-line arguments
import sys  # Import sys for command-line arguments
import time
from app.utils.id_utils import generate_document_id
# Handle imports differently when run as a script vs as a module
if __name__ == "__main__":
    # When run as a script, add the parent directory to sys.path
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
    from .PdfProcessor import PDFProcessor
    from app.services.md2sql import process_markdown_directory
else:
    # When imported as a module
    from .PdfProcessor import PDFProcessor
    # Append the parent directory to sys.path to handle imports
    parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from app.services.md2sql import process_markdown_directory

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if hasattr(fitz, "Rect") and isinstance(obj, fitz.Rect):
            return list(obj)  # Convert Rect to list [x0, y0, x1, y1]
        if isinstance(obj, pd.DataFrame):
            return obj.to_dict('records')
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if hasattr(obj, 'isoformat'):  # datetime objects
            return obj.isoformat()
        # Handle other non-serializable types
        return super().default(obj)


class PdfContentExtractor:
    """
    A unified class for parsing and extracting content from PDF documents.
    Handles both machine-readable and scanned PDFs with appropriate techniques.
    """
    def __init__(self, pdf_path: str, output_folder: str = "extracted_content",
                 text_threshold: int = 50, language: str = "eng+asm+ben+equ+guj+hin+kan+mal+mar+ori+nep+san+pan+tam+tel+urd", ocr_method: str = "ocrmypdf"):
        """
        Initialize PdfContentExtractor with a PDF file path and extraction parameters.
        
        Parameters:
            pdf_path (str): Path to the PDF file
            output_folder (str): Folder to store extracted content
            text_threshold (int): Minimum characters to consider a page machine-readable
            language (str): OCR language code(s) for scanned documents
        """
        self.pdf_path = pdf_path
        self.base_output_folder = output_folder
        
        # Create the base output folder if it doesn't exist
        os.makedirs(self.base_output_folder, exist_ok=True)
        
        # Generate timestamp in base36
        timestamp_base36 = generate_document_id()

        # Extract the filename without extension
        pdf_name = os.path.splitext(os.path.basename(self.pdf_path))[0]
        
        # If the pdf_name already has a timestamp prefix (from upload handling), use it as is
        if "_" in pdf_name:
            parts = pdf_name.split("_", 1)
            # Check if the first part looks like a timestamp (alphanumeric, typically 5-7 chars)
            if len(parts[0]) >= 5 and len(parts[0]) <= 7 and parts[0].isalnum():
                # Already has a timestamp, use as is
                self.output_folder = os.path.join(self.base_output_folder, pdf_name)
                self.timestamp_base36 = parts[0]  # Use existing timestamp
            else:
                # Has underscore but not a timestamp format, add our timestamp
                self.output_folder = os.path.join(self.base_output_folder, f"{timestamp_base36}_{pdf_name}")
                self.timestamp_base36 = timestamp_base36
        else:
            # No timestamp, add one
            self.output_folder = os.path.join(self.base_output_folder, f"{timestamp_base36}_{pdf_name}")
            self.timestamp_base36 = timestamp_base36
        
        # Ensure the output directory exists
        os.makedirs(self.output_folder, exist_ok=True)
        
        self.text_threshold = text_threshold
        self.language = language
        self.ocr_method = ocr_method
        self.logger = logging.getLogger(__name__)
        
        # Extract the file_id from the output_folder path
        self.file_id = os.path.basename(self.output_folder)
        
        self.logger.info(f"Extraction output folder: {self.output_folder}")

        # Initialize extraction results
        self.doc_type=None
        self.extraction_results={}
        self.scanned_pages = []

        # Detect document type upon initialization
        self.doc_type = self._detect_pdf_type()
        self.logger.info(f"Document type detected: {self.doc_type}")
        
    def base36_encode(self, number):
        chars = "0123456789abcdefghijklmnopqrstuvwxyz"
        result = ""
        while number:
            number, i = divmod(number, 36)
            result = chars[i] + result
        return result or "0"

    

    def _detect_pdf_type(self) -> str:
        try:
            doc = fitz.open(self.pdf_path)
            num_pages = doc.page_count
            if num_pages == 0:
                return "Empty PDF"
            
            self.scanned_pages = []
            all_scanned=True
            all_readable=True
            for page_number in range(num_pages):
                page = doc[page_number]
                text = page.get_text("text").strip()

                # If any page has less than threshold text, consider it scanned
                if len(text) < self.text_threshold:
                    self.scanned_pages.append(page_number + 1)
                    all_readable=False
                else:
                    all_scanned=False
    
            doc.close()
            if all_scanned:
                return "scanned"
            elif all_readable:
                return "machine-readable"
            else:
                return "mixed"

        except Exception as e:
            self.logger.error(f"Error in PDF type detection: {e}")
            return f"Error processing PDF: {e}"

    def extract_all(self) -> Dict[str, Any]:
        if self.doc_type=="machine-readable":
            return self.extract_from_machine_readable()
        elif self.doc_type=="scanned":
            return self.extract_from_scanned(method=self.ocr_method)
        elif self.doc_type=="mixed":
            # Handle mixed document - process each page appropriately
            self.logger.info(f"Processing mixed document with scanned pages: {self.scanned_pages}")
            results=self.extract_from_machine_readable()

            # Create image output directory based on PDF name for scanned pages
            pdf_name = os.path.splitext(os.path.basename(self.pdf_path))[0]
            image_folder = os.path.join(self.output_folder, f"scanned_images")
            os.makedirs(image_folder, exist_ok=True)

            # Process scanned pages separately using pytesseract
            if hasattr(self, 'scanned_pages') and self.scanned_pages:
                # scanned_results = {}
                for page in self.scanned_pages:
                    try:
                        # Convert specific page to image
                        pdf_file=pdfium.PdfDocument(self.pdf_path)
                        renderer=pdf_file.render(
                            pdfium.PdfBitmap.to_pil,
                            page_indices=[page-1],  # Convert to 0-based index
                            scale=300/72,
                        )
                        image = next(renderer)
                        image_byte_array = BytesIO()
                        image.save(image_byte_array, format='jpeg', optimize=True)
                        image_byte_array = image_byte_array.getvalue()
                
                        # Use pytesseract to extract text
                        ocr_text = image_to_string(image, lang=self.language)

                        # Save the image to disk
                        image_filename = f"page{page}image0.jpeg"
                        image_path = os.path.join(image_folder, image_filename)
                        image.save(image_path, format='JPEG')


                        # Store the relative path
                        rel_path = os.path.join(f"{pdf_name}_images", image_filename)

                        # Find the corresponding page entry in text_and_images
                        page_found=False

                        # Update the corresponding page entry in text_and_images
                        for idx, page_data in enumerate(results["text_and_images"]):
                            if page_data.get("page")==page:
                                page_found=True
                                # Replace the empty or minimal text with OCR text
                                results["text_and_images"][idx]["page_content"]=ocr_text

                                # Add the page image path if not already present
                                if "image_content" not in results["text_and_images"][idx]:
                                    results["text_and_images"][idx]["image_content"] = []
                                    
                                results["text_and_images"][idx]["image_content"].append({
                                    "index": 0,
                                    "extension": "jpeg",
                                    "mime_type": "image/jpeg",
                                    "path": rel_path,
                                    "url": f"/api/extracted-image/{self.file_id}/{pdf_name}_images/{image_filename}"
                                })
                                    
                                # Add OCR metadata
                                results["text_and_images"][idx]["extraction_method"]="pytesseract_ocr"
                                break
                        
                        if not page_found:
                            results.setdefault("text_and_images", []).append({
                                "page": page,
                                "page_content": ocr_text,
                                "image_content": [{
                                    "index": 0,
                                    "extension": "jpeg",
                                    "mime_type": "image/jpeg",
                                    "path": rel_path,
                                    "url": f"/api/extracted-image/{self.file_id}/{pdf_name}_images/{image_filename}"
                                }],
                                "extraction_method": "pytesseract_ocr"
                            })
                        self.logger.info(f"Updated page {page} content with OCR text")
        
                    except Exception as e:
                        self.logger.error(f"Error processing scanned page {page}: {e}")

            return results
        else:
            self.logger.error(f"Cannot extract content: {self.doc_type}")
            return {"error": self.doc_type}
    
    def extract_from_machine_readable(self) -> Dict[str, Any]:
        self.logger.info("Extracting content from machine-readable PDF")
        results = {}

        # Use PDFProcessor to extract text and images
        results["text_and_images"] = self._extract_text_images()
        
        # Extract tables
        results["tables"] = self._extract_tables()
        # Extract metadata
        results["metadata"] = self._extract_metadata()
        # Extract hyperlinks
        results["hyperlinks"] = self._extract_hyperlinks()
        # Extract bookmarks
        results["bookmarks"] = self._extract_bookmarks()
        # Extract annotations
        results["annotations"] = self._extract_annotations()
        # Extract layout information
        results["layout"] = self._extract_layout_info()

        self.extraction_results = results
        return results
    
    def extract_from_scanned(self, method: str = "ocrmypdf") -> Dict[str, Any]:
        self.logger.info(f"Extracting content from scanned PDF using {method}")
        results = {}
        
        if method == "ocrmypdf":
            # Create OCRed version of the PDF - normalize file name
            pdf_name = os.path.splitext(os.path.basename(self.pdf_path))[0]
            ocr_output_path = os.path.join(
                self.output_folder,
                f"{pdf_name}_OCRed.pdf"
            )
            self._run_ocrmypdf(ocr_output_path)

            # Create temporary parser for the OCRed PDF
            ocr_parser = PdfContentExtractor(ocr_output_path, self.output_folder)

            # Extract content from the OCRed PDF as if it were machine-readable
            results = ocr_parser.extract_from_machine_readable()
            results["ocr_method"] = "ocrmypdf"
            results["ocr_output_path"] = ocr_output_path

        elif method == "pytesseract":
            try:
                # Create image output directory based on PDF name - normalize properly
                pdf_name = os.path.splitext(os.path.basename(self.pdf_path))[0]
                image_folder = os.path.join(self.output_folder, f"{pdf_name}_OCRed_images")
                os.makedirs(image_folder, exist_ok=True)

                # Convert PDF to images
                images_list = self._convert_pdf_to_images()

                # Extract text from images using pytesseract
                text_and_images = []

                for page_dict in images_list:
                    page_num = list(page_dict.keys())[0]
                    image_bytes = page_dict[page_num]

                    # Process image for text
                    image = Image.open(BytesIO(image_bytes))
                    raw_text = str(image_to_string(image, lang=self.language))

                    # Save image to disk
                    image_filename = f"page{page_num}image0.jpeg"
                    image_path = os.path.join(image_folder, image_filename)
                
                    with open(image_path, "wb") as img_file:
                        img_file.write(image_bytes)

                    # Store the relative path and URL
                    rel_path = os.path.join(f"{pdf_name}_OCRed_images", image_filename)

                    page_data = {
                        "page": page_num,
                        "page_content": raw_text,
                        "image_content": [{
                            "index": 0,
                            "extension": "jpeg",
                            "mime_type": "image/jpeg",
                            "path": rel_path,
                            "url": f"/api/extracted-image/{self.file_id}/{pdf_name}_OCRed_images/{image_filename}"
                        }],
                        "extraction_method": "pytesseract_ocr"
                    }
                    text_and_images.append(page_data)

                results["text_and_images"] = text_and_images
                results["ocr_method"] = "pytesseract"

            except ImportError:
                self.logger.error("pytesseract not installed. Install with: pip install pytesseract")
                results["error"] = "pytesseract not installed"
        
        else:
            self.logger.error(f"Unknown OCR method: {method}")
            results["error"] = f"Unknown OCR method: {method}"
        
        self.extraction_results = results
        return results
    
    def _extract_text_images(self, extraction_mode: str = "text") -> List[Dict]:
        """
        Use PDFProcessor to extract text and images from PDF pages.
        
        Args:
            extraction_mode (str): Ignored, as we use PDFProcessor
            
        Returns:
            List[Dict]: Data for each page including text and image paths
        """
        self.logger.info("Using PDFProcessor to extract text and images")
        
        # Create a PDFProcessor instance with the output folder in extracted_content/{pdf_name}
        processor = PDFProcessor(pdf_path=self.pdf_path, output_folder=self.output_folder)
        
        # Process the PDF using PDFProcessor
        all_results = processor.process_pdf()
        
        # Convert the PDFProcessor results to match our expected structure
        extracted_data = []
        
        for page_data in all_results:
            # Create a new data structure to match our expected format
            extracted_page = {
                "page": page_data["page"],
                "page_content": page_data["page_content"],
                "extraction_method": page_data["extraction_method"],
                "image_content": page_data.get("image_content", [])
            }
            
            # Update the URL paths to use the file_id
            for img in extracted_page["image_content"]:
                if "url" in img:
                    # Update the URL to use our file_id
                    path_parts = img["url"].split("/")
                    if len(path_parts) >= 4:
                        img["url"] = f"/api/extracted-image/{self.file_id}/{path_parts[-2]}/{path_parts[-1]}"
            
            extracted_data.append(extracted_page)
        
        return extracted_data
    
    def _extract_tables(self) -> List[Dict]:
        all_tables = []

        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for i, page in enumerate(pdf.pages, start=1):
                    tables = page.extract_tables()

                    if tables:
                        self.logger.info(f"Page {i} has {len(tables)} table(s).")

                        for table_idx, table in enumerate(tables):
                            # Create a DataFrame using the first row as header if available
                            if table and len(table) > 0:
                                headers = table[0]
                                if len(table) > 1:
                                    data = table[1:]
                                    df = pd.DataFrame(data, columns=headers)

                                    # Convert DataFrame to dict for JSON serialization
                                    table_dict = {
                                        "page": i,
                                        "table_index": table_idx,
                                        "headers": headers,
                                        "data": df.to_dict(orient="records")
                                    }
                                    all_tables.append(table_dict)

                                    # Note: CSV file saving has been removed
                                    # Store table data directly in the table_dict
                                    self.logger.info(f"Extracted table from page {i}, table index {table_idx}")
                    else:
                        self.logger.info(f"Page {i} has no tables.")

        except Exception as e:
            self.logger.error(f"Error extracting tables: {e}")

        return all_tables

    def _extract_hyperlinks(self) -> List[Dict]:
        doc = fitz.open(self.pdf_path)
        hyperlinks = []

        for page_num in range(doc.page_count):
            page = doc[page_num]

            for link in page.get_links():
                if 'uri' in link:
                    hyperlinks.append({
                        'page': page_num + 1,
                        'uri': link['uri'],
                        'bbox': link.get('from')  # The rectangle area where the link is located
                    })

        doc.close()
        self.logger.info(f"Extracted {len(hyperlinks)} hyperlinks")
        return hyperlinks
        
    def _extract_metadata(self) -> Dict:
        doc = fitz.open(self.pdf_path)
        metadata = doc.metadata
        doc.close()
        self.logger.info(f"Extracted metadata: {len(metadata)} fields")
        return metadata
    
    def _extract_bookmarks(self) -> Dict:
        doc = fitz.open(self.pdf_path)
        toc = doc.get_toc()
        doc.close()

        # Convert TOC to more readable format
        bookmarks = []
        for item in toc:
            level, title, page = item
            bookmarks.append({
                "level": level,
                "title": title,
                "page": page
            })
        self.logger.info(f"Extracted {len(bookmarks)} bookmarks")
        return bookmarks
    
    def _extract_annotations(self) -> List[Dict]:
        doc = fitz.open(self.pdf_path)
        annotations = []

        for page_num in range(doc.page_count):
            page = doc[page_num]
            # Use page.annots() to get an iterator of annotations
            annots = page.annots()

            if annots:
                for annot in annots:
                    annotations.append({
                        "page": page_num + 1,
                        "type": annot.type[1],  # Get annotation type name
                        "rect": list(annot.rect),  # Bounding box
                        "info": annot.info
                    })
        doc.close()
        self.logger.info(f"Extracted {len(annotations)} annotations")
        return annotations
    
    def _extract_layout_info(self) -> List[Dict]:
        doc = fitz.open(self.pdf_path)
        layout_info = []

        for page_num in range(doc.page_count):
            page = doc[page_num]
            layout = page.get_text("dict")

            page_layout = {
                "page": page_num + 1,
                "width": layout["width"],
                "height": layout["height"],
                "blocks": []
            }
            for block_idx, block in enumerate(layout.get("blocks", [])):
                block_type = block.get("type")
                bbox = block.get("bbox")

                block_info = {
                    "index": block_idx,
                    "type": "text" if block_type == 0 else "image" if block_type == 1 else "other",
                    "bbox": bbox
                }
                # For text blocks, extract text content
                if block_type == 0:
                    block_info["text"] = []

                    for line in block.get("lines", []):
                        line_text = ""
                        for span in line.get("spans", []):
                            line_text += span.get("text", "")

                        if line_text:
                            block_info["text"].append(line_text)

                page_layout["blocks"].append(block_info)

            layout_info.append(page_layout)

        doc.close()
        self.logger.info(f"Extracted layout info for {len(layout_info)} pages")
        return layout_info

    def _convert_pdf_to_images(self, scale: float = 300/72) -> List[Dict]:
        self.logger.info(f"Converting PDF to images with scale factor {scale}")
        try:
            pdf_file = pdfium.PdfDocument(self.pdf_path)
            page_indices = [i for i in range(len(pdf_file))]

            renderer = pdf_file.render(
                pdfium.PdfBitmap.to_pil,
                page_indices=page_indices,
                scale=scale,
            )
            list_final_images = []

            for i, image in zip(page_indices, renderer):
                image_byte_array = BytesIO()
                image.save(image_byte_array, format='jpeg', optimize=True)
                image_byte_array = image_byte_array.getvalue()
                list_final_images.append({i+1: image_byte_array})  # Use 1-based page numbering
            self.logger.info(f"Converted {len(list_final_images)} pages to images")
            return list_final_images
        
        except Exception as e:
            self.logger.error(f"Error converting PDF to images: {e}")
            return []

    def _run_ocrmypdf(self, output_pdf: str) -> bool:
        self.logger.info(f"Running OCRmyPDF on {self.pdf_path}")
        
        # Build the OCRmyPDF command
        command = [
            'ocrmypdf',
            '--language', self.language,
            '--deskew',  # Optional: deskew pages for better OCR accuracy
            '--skip-text',  # Optional: skip OCR if text layer already exists
            self.pdf_path,
            output_pdf
        ]

        # Run the command
        try:
            subprocess.run(command, check=True)
            self.logger.info(f"Searchable PDF saved as: {output_pdf}")
            return True
        except subprocess.CalledProcessError as e:
            self.logger.error(f"Error during OCR processing: {e}")
            return False
    
    def save_extraction_results(self, format: str = "json", load_tables_to_db: bool = True, document_id: int = None) -> str:
        if not self.extraction_results:
            self.logger.warning("No extraction results available. Running extract_all() automatically.")
            self.extract_all()
            # Check again in case extraction still failed
            if not self.extraction_results:
                self.logger.warning("Extraction failed or produced no results.")
                return {}
        
        # Get structured content
        structured_content = self.get_structured_content()
        
        # Save as extraction.json in the output_folder
        output_file = os.path.join(
            self.output_folder,
            f"extraction.{format}"
        )
        db_file = os.path.join(
            self.output_folder,
            f"CreateDB.sql"
        )
        table_folder = os.path.join(
            self.output_folder,
            "tables"
        )
        
        # Ensure the tables directory exists
        os.makedirs(table_folder, exist_ok=True)
        
        # Add the timestamp as a prefix for table names
        timestamp = f"{self.timestamp_base36}_"
        
        # Save content to the chosen format
        if format == 'json':
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(structured_content, f, cls=CustomJSONEncoder, indent=2)
            
            # Make sure all tables are saved as markdown files
            self._ensure_tables_are_saved(structured_content, table_folder)
                
            # Generate SQL from markdown tables
            process_markdown_directory(table_folder, db_file, timestamp)
            
            # Always load tables into PostgreSQL database if document_id is provided
            if document_id:
                self.logger.info(f"Loading tables into database for document ID: {document_id}")
                self._direct_execute_sql_file(db_file, document_id)
            else:
                self.logger.warning("No document_id provided. Tables will NOT be saved to the database.")

        elif format == 'txt':
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(str(structured_content))
            
            # Make sure all tables are saved as markdown files
            self._ensure_tables_are_saved(structured_content, table_folder)
                
            # Generate SQL from markdown tables
            process_markdown_directory(table_folder, db_file, timestamp)
            
            # Always load tables into PostgreSQL database if document_id is provided
            if document_id:
                self.logger.info(f"Loading tables into database for document ID: {document_id}")
                self._direct_execute_sql_file(db_file, document_id)
            else:
                self.logger.warning("No document_id provided. Tables will NOT be saved to the database.")
        
        else:
            self.logger.error(f"Unsupported output format: {format}")
            return ""
        
        self.logger.info(f"Saved extraction results to {output_file}")
        
        # Delete the page_images folder if it exists
        page_images_folder = os.path.join(self.output_folder, "page_images")
        if os.path.exists(page_images_folder) and os.path.isdir(page_images_folder):
            try:
                shutil.rmtree(page_images_folder)
                self.logger.info(f"Deleted page_images folder: {page_images_folder}")
            except Exception as e:
                self.logger.error(f"Error deleting page_images folder: {e}")
        
        return output_file
        
    def _ensure_tables_are_saved(self, structured_content, table_folder):
        """
        Ensure all tables in the extracted content are saved as markdown files.
        
        Args:
            structured_content (dict): The structured content with tables
            table_folder (str): Path to the tables folder
        """
        try:
            # Ensure the table folder exists
            os.makedirs(table_folder, exist_ok=True)
            
            # Check if there are any tables in the pages
            tables_saved = False
            
            for page in structured_content.get("pages", []):
                page_number = page.get("page_number")
                tables = page.get("tables", [])
                
                if not tables:
                    continue
                    
                # Create markdown file for this page if it has tables
                md_file_path = os.path.join(table_folder, f"p{page_number}.md")
                
                with open(md_file_path, 'w', encoding='utf-8') as f:
                    for table_idx, table in enumerate(tables):
                        # Extract headers and data
                        headers = table.get("headers", [])
                        data = table.get("data", [])
                        
                        if not headers or not data:
                            continue
                            
                        # Clean up headers (remove None values and empty strings)
                        clean_headers = [h if h is not None else "" for h in headers]
                        
                        # Generate a table name from the first header or a default name
                        table_name = "table" if not clean_headers or not clean_headers[0] else clean_headers[0]
                        table_name = re.sub(r'[^a-zA-Z0-9_]', '_', table_name.lower())
                        table_name = re.sub(r'_+', '_', table_name)
                        table_name = table_name.strip('_')
                        
                        # Write markdown header for this table
                        f.write(f"## {table_name}\n")
                        
                        # Write markdown table headers
                        f.write("| " + " | ".join(clean_headers) + " |\n")
                        
                        # Write separator row
                        f.write("|" + "|".join(["---"] * len(clean_headers)) + "|\n")
                        
                        # Write data rows
                        for row in data:
                            # Ensure row has the same number of columns as headers
                            while len(row) < len(clean_headers):
                                row.append("")
                            
                            # Convert None values to empty strings
                            clean_row = [str(cell) if cell is not None else "" for cell in row]
                            
                            # Write the row
                            f.write("| " + " | ".join(clean_row) + " |\n")
                        
                        # Add a newline between tables
                        if table_idx < len(tables) - 1:
                            f.write("\n")
                            
                        tables_saved = True
                
                self.logger.info(f"Saved {len(tables)} tables from page {page_number} to {md_file_path}")
            
            if not tables_saved:
                self.logger.warning("No tables found in the document to save as markdown")
                
        except Exception as e:
            self.logger.error(f"Error saving tables as markdown: {e}")
            # Continue despite errors to allow the rest of the process to complete

    def get_structured_content(self) -> Dict:
        if not self.extraction_results:
            self.logger.warning("No extraction results available. Running extract_all() automatically.")
            self.extract_all()
            # Check again in case extraction still failed
            if not self.extraction_results:
                self.logger.warning("Extraction failed or produced no results.")
                return {}
        
        structured_content = {
            "document_type": self.doc_type,
            "title": self.extraction_results.get("metadata", {}).get("title", "Untitled"),
            "author": self.extraction_results.get("metadata", {}).get("author", "Unknown"),
            "pages": []
        }
        
        # Initialize top-level images array
        all_images = []
        
        # Extract page content and images by page
        if "text_and_images" in self.extraction_results:
            # First initialize all pages to ensure correct ordering
            max_page=0
            for page_data in self.extraction_results["text_and_images"]:
                page_num = page_data.get("page")
                if page_num is not None:
                    max_page=max(max_page, page_num)
                
            # Initialize all pages first
            for i in range(max_page):
                structured_content["pages"].append({
                    "page_number":i+1,
                    "page_content":"",
                    "image_content":[],
                    "isScanned": (i+1) in self.scanned_pages
                })
                
            # Now fill in the content
            for page_data in self.extraction_results["text_and_images"]:
                page_num=page_data.get("page")
                if page_num is None:
                    continue

                page_idx = int(page_num) - 1
                    
                # Get the content using the updated key "page_content"
                content = page_data.get("page_content", "")
                structured_content["pages"][page_idx]["page_content"] = content
                    
                # Add image content if available
                if "image_content" in page_data and page_data["image_content"]:
                    structured_content["pages"][page_idx]["image_content"] = page_data["image_content"]
                    
                    # Also collect images for the top-level images array
                    for img in page_data["image_content"]:
                        # Copy the image data and add page information
                        image_data = img.copy()
                        image_data["page"] = page_num
                        all_images.append(image_data)

                # Add extraction method if available, which can help identify OCR vs regular text extraction
                if "extraction_method" in page_data:
                    extraction_method = page_data.get("extraction_method")
                    structured_content["pages"][page_idx]["extraction_method"] = extraction_method
                    # If extraction method contains 'ocr', ensure isScanned is set to True
                    if extraction_method and "ocr" in extraction_method.lower():
                        structured_content["pages"][page_idx]["isScanned"] = True

        elif "page_content" in self.extraction_results:
            # Handle the pytesseract output format (legacy/alternative format)
            page_nums=[int(k) for k in self.extraction_results["page_content"].keys()]
            max_page=max(page_nums) if page_nums else 0

            # Initialize all pages
            for i in range(max_page):
                structured_content["pages"].append({
                    "page_number":i+1,
                    "page_content":"",
                    "image_content":[],
                    "isScanned": page_num in self.scanned_pages
                })

            # Fill in content
            for page_num_str, content in self.extraction_results["page_content"].items():
                page_num = int(page_num_str) if isinstance(page_num_str, str) else page_num_str
                page_idx = page_num - 1

                structured_content["pages"][page_idx]["page_content"] = content

                # Add image file paths
                if "image_content" in self.extraction_results and str(page_num) in self.extraction_results["image_content"]:
                    image_data = {
                        "index":0,
                        "extension":"jpeg",
                        "mime_type":"image/jpeg",
                        "path":self.extraction_results["image_content"][str(page_num)]
                    }
                    structured_content["pages"][page_idx]["image_content"].append(image_data)
                    
                    # Also add to top-level images
                    image_data_copy = image_data.copy()
                    image_data_copy["page"] = page_num
                    all_images.append(image_data_copy)

        # Add table information
        if "tables" in self.extraction_results:
            for table_info in self.extraction_results["tables"]:
                page_num = table_info.get("page")
                page_idx = page_num - 1

                if "tables" not in structured_content["pages"][page_idx]:
                    structured_content["pages"][page_idx]["tables"] = []
                
                table_data = {
                    "headers": table_info.get("headers", []),
                    "data": table_info.get("data", [])
                }
                structured_content["pages"][page_idx]["tables"].append(table_data)
        
        # Add hyperlinks
        if "hyperlinks" in self.extraction_results:
            hyperlinks_by_page = {}
            for link in self.extraction_results["hyperlinks"]:
                page_num = link.get("page")
                if page_num not in hyperlinks_by_page:
                    hyperlinks_by_page[page_num] = []

                hyperlinks_by_page[page_num].append({
                    "uri": link.get("uri"),
                    "bbox": link.get("bbox")
                })

            for page_num, links in hyperlinks_by_page.items():
                page_idx = page_num - 1
                if page_idx < len(structured_content["pages"]):
                    structured_content["pages"][page_idx]["hyperlinks"] = links

        if "layout" in self.extraction_results:
            layout_by_page={}
            for layout in self.extraction_results["layout"]:
                page_num=layout.get("page")
                if page_num not in layout_by_page:
                    layout_by_page[page_num]=[]

                layout_by_page[page_num].append({
                    "width": layout.get("width"),
                    "height": layout.get("height"),
                    "blocks": layout.get("blocks")
                })

            for page_num, layouts in layout_by_page.items():
                page_idx = page_num - 1
                if page_idx < len(structured_content["pages"]):
                    structured_content["pages"][page_idx]["layout"] = layouts

        # Add bookmarks
        if "bookmarks" in self.extraction_results:
            structured_content["bookmarks"] = self.extraction_results["bookmarks"]
            
        # Final validation - ensure all pages have isScanned field
        for page in structured_content["pages"]:
            if "isScanned" not in page:
                page["isScanned"] = page["page_number"] in self.scanned_pages
        
        # Add the collected images to the top-level structure
        if all_images:
            structured_content["images"] = all_images
                
        return structured_content

    def extract_text(self) -> Dict[str, Any]:
        logging.info(f"Extracting only text from PDF: {self.pdf_path}")
        
        # Initialize extraction data structure
        extraction_data = {
            "text": [],
            "images": [],
            "hyperlinks": [],
            "bookmarks": {},
            "annotations": [],
            "layout": [],
            "metadata": self._extract_metadata(),
        }
        
        # Detect the PDF type if not already done
        if not hasattr(self, 'pdf_type') or not self.pdf_type:
            self.pdf_type = self._detect_pdf_type()
        
        # Extract text based on PDF type
        if self.pdf_type == "machine_readable":
            # For machine-readable PDFs, extract text directly
            text_extraction = self._extract_text_images(extraction_mode="text")
            extraction_data["text"] = text_extraction
        else:
            # For scanned PDFs, use OCR to extract text
            self._run_ocrmypdf(os.path.join(self.output_folder, "ocr_output.pdf"))
            text_extraction = self._extract_text_images(extraction_mode="text")
            extraction_data["text"] = text_extraction
        
        # Extract other elements except tables
        extraction_data["hyperlinks"] = self._extract_hyperlinks()
        extraction_data["bookmarks"] = self._extract_bookmarks()
        extraction_data["annotations"] = self._extract_annotations()
        extraction_data["layout"] = self._extract_layout_info()
        
        # Store extraction data
        self.extraction_data = extraction_data
        
        return extraction_data

    def extract_images(self) -> List[Dict]:
        self.logger.info(f"Extracting images from PDF: {self.pdf_path}")
        
        # Use the existing method to extract images
        extracted_data = self._extract_text_images(extraction_mode="text")
        
        # Store the images in the extraction_data if it exists
        if hasattr(self, 'extraction_data'):
            # Extract just the image content from each page
            all_images = []
            for page_data in extracted_data:
                if "image_content" in page_data and page_data["image_content"]:
                    all_images.extend([{**img, "page": page_data["page"]} for img in page_data["image_content"]])
            
            self.extraction_data["images"] = all_images
        
        # Return just the images for direct use
        all_images = []
        for page_data in extracted_data:
            if "image_content" in page_data and page_data["image_content"]:
                all_images.extend([{**img, "page": page_data["page"]} for img in page_data["image_content"]])
        
        return all_images

    def extract_metadata(self) -> Dict:
        self.logger.info(f"Extracting metadata from PDF: {self.pdf_path}")
        
        # Extract metadata using the existing method
        metadata = self._extract_metadata()
        
        # Store the metadata in the extraction_data if it exists
        if hasattr(self, 'extraction_data'):
            self.extraction_data["metadata"] = metadata
        
        return metadata

    def get_extraction_data(self) -> Dict[str, Any]:
        # Return extraction_data if available, otherwise return an empty structure
        if hasattr(self, 'extraction_data'):
            return self.extraction_data
        else:
            return {
                "text": [],
                "tables": [],
                "images": [],
                "hyperlinks": [],
                "bookmarks": {},
                "annotations": [],
                "layout": [],
                "metadata": {}
            }

    def _direct_execute_sql_file(self, sql_file_path, document_id=None):
        """
        Directly execute SQL statements from a file in the PostgreSQL database.
        
        Args:
            sql_file_path (str): Path to the SQL file to execute
            document_id (int, optional): Document ID to associate with created tables
        """
        try:
            import psycopg2
            import os
            from dotenv import load_dotenv
            import re
            
            # Load environment variables
            load_dotenv()
            
            # Read SQL file
            with open(sql_file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()
            
            if not sql_content.strip() or sql_content.strip() == "-- SQL generated from markdown files":
                self.logger.warning(f"No SQL statements found in {sql_file_path}")
                return
            
            # Get database connection parameters from environment
            db_host = os.getenv("DB_HOST", "localhost")
            db_port = os.getenv("DB_PORT", "5432")
            db_name = os.getenv("DB_NAME", "documentManager")
            db_user = os.getenv("DB_USER", "postgres")
            db_pass = os.getenv("DB_PASS", "")
            
            # Connect to PostgreSQL
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                dbname=db_name,
                user=db_user,
                password=db_pass
            )
            
            # Create a cursor with autocommit mode
            conn.autocommit = True
            cursor = conn.cursor()
            
            # Execute the entire SQL file directly
            self.logger.info(f"Executing SQL file: {sql_file_path}")
            cursor.execute(sql_content)
            self.logger.info(f"Successfully executed SQL file")
            
            # If document_id is provided, create tables_metadata table if it doesn't exist
            if document_id:
                try:
                    # Check if tables_metadata table exists
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = 'tables_metadata'
                        );
                    """)
                    table_exists = cursor.fetchone()[0]
                    
                    # Create tables_metadata table if it doesn't exist
                    if not table_exists:
                        self.logger.info("Creating tables_metadata table")
                        cursor.execute("""
                            CREATE TABLE tables_metadata (
                                id SERIAL PRIMARY KEY,
                                table_id VARCHAR(255) UNIQUE,
                                table_name VARCHAR(255),
                                document_id INTEGER,
                                page_number INTEGER,
                                extraction_date TIMESTAMP,
                                status VARCHAR(50)
                            );
                        """)
                    
                    # Get list of all tables that match our timestamp prefix
                    timestamp_prefix = self.timestamp_base36 + "_"
                    cursor.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name LIKE %s;
                    """, (timestamp_prefix + '%',))
                    
                    tables_created = [row[0] for row in cursor.fetchall()]
                    self.logger.info(f"Found {len(tables_created)} tables with prefix {timestamp_prefix}")
                    
                    # Add entries to tables_metadata
                    for table_name in tables_created:
                        try:
                            # Extract page number from table name if present (typically p1_, p2_, etc.)
                            page_match = re.search(r'p(\d+)_', table_name)
                            page_number = int(page_match.group(1)) if page_match else None
                            
                            # Check if entry already exists
                            cursor.execute("""
                                SELECT 1 FROM tables_metadata WHERE table_id = %s
                            """, (table_name,))
                            
                            exists = cursor.fetchone() is not None
                            
                            if exists:
                                # Update existing entry
                                cursor.execute("""
                                    UPDATE tables_metadata 
                                    SET document_id = %s, page_number = %s, extraction_date = NOW(), status = 'active'
                                    WHERE table_id = %s
                                """, (str(document_id), page_number, table_name))
                            else:
                                # Insert new entry
                                cursor.execute("""
                                    INSERT INTO tables_metadata 
                                    (table_id, table_name, document_id, page_number, extraction_date, status)
                                    VALUES (%s, %s, %s, %s, NOW(), 'active')
                                """, (table_name, table_name, str(document_id), page_number))
                            
                            self.logger.info(f"Added metadata for table: {table_name}")
                        except Exception as e:
                            self.logger.error(f"Error adding table metadata for {table_name}: {e}")
                
                except Exception as e:
                    self.logger.error(f"Error handling tables_metadata: {e}")
            
            # Close the connection
            cursor.close()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Error executing SQL file: {e}")
            raise

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Extract content from PDF files')
    parser.add_argument('pdf_path', help='Path to the PDF file to process')
    parser.add_argument('--output', '-o', default="extracted_content", 
                      help='Output folder for extracted content (default: extracted_content)')
    parser.add_argument('--language', '-l', default="eng+asm+ben+equ+guj+hin+kan+mal+mar+ori+nep+san+pan+tam+tel+urd", 
                      help='OCR language for scanned documents (default: eng+asm+ben+equ+guj+hin+kan+mal+mar+ori+nep+san+pan+tam+tel+urd)')
    parser.add_argument('--format', '-f', default="json", choices=["json", "txt"],
                      help='Output format (default: json)')
    parser.add_argument('--ocr-method', default="ocrmypdf", choices=["ocrmypdf", "pytesseract"],
                      help='OCR method for scanned documents (default: ocrmypdf)')
    
    # Parse arguments
    args = parser.parse_args()
    
    # Check if the PDF file exists
    if not os.path.exists(args.pdf_path):
        print(f"Error: PDF file '{args.pdf_path}' not found", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Start timing the processing
        start_time = time.time()
        
        # Create the extractor
        extractor = PdfContentExtractor(
            pdf_path=args.pdf_path,
            output_folder=args.output,
            language=args.language,
            ocr_method=args.ocr_method
        )
        
        # Extract all content
        print(f"Processing PDF: {args.pdf_path}")
        print(f"Document type detected: {extractor.doc_type}")
        
        # Extract all content
        results = extractor.extract_all()
        
        # Save the results
        output_file = extractor.save_extraction_results(format=args.format)
        
        # Calculate and display the processing time
        end_time = time.time()
        processing_time = end_time - start_time
        
        print(f"Content extracted successfully!")
        print(f"Results saved to: {output_file}")
        print(f"\n{'='*50}")
        print(f"TOTAL PROCESSING TIME: {processing_time:.2f} seconds")
        print(f"{'='*50}")
        
    except Exception as e:
        print(f"Error processing PDF: {e}", file=sys.stderr)
        sys.exit(1)
