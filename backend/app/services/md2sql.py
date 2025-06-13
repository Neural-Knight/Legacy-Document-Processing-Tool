import re
import sys
import os
import psycopg2
import logging
from dotenv import load_dotenv

# Set up logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def markdown_to_sql(markdown_text=None, table_name_prefix="", markdown_file_path=None):
    """
    Convert markdown text with multiple tables to SQL statements.
    
    Args:
        markdown_text (str, optional): Markdown text containing one or more tables
        table_name_prefix (str): Prefix for all table names
        markdown_file_path (str, optional): Path to a markdown file to read content from
    
    Returns:
        str: SQL statements to create and populate tables
    """
    # If markdown_file_path is provided, read the markdown content from the file
    if markdown_file_path:
        try:
            with open(markdown_file_path, 'r', encoding='utf-8') as file:
                markdown_text = file.read()
        except Exception as e:
            raise ValueError(f"Error reading markdown file: {e}")
    
    # Ensure we have markdown text to process
    if not markdown_text:
        raise ValueError("Either markdown_text or markdown_file_path must be provided")
    
    # Split the markdown into sections based on ## headers
    sections = re.split(r'(?=^## )', markdown_text, flags=re.MULTILINE)
    
    # If no sections start with ##, treat the whole thing as one section
    if len(sections) == 1 and not sections[0].strip().startswith('##'):
        sections = [f"## unnamed_table\n{sections[0]}"]
    
    all_sql_statements = []
    table_counter = 0
    
    for section in sections:
        section = section.strip()
        if not section or '|' not in section:  # Skip sections without tables
            continue
        
        table_counter += 1
        
        # Extract table description from header
        header_match = re.match(r'^## (?:Table Name: )?(.*?)(?:\n|$)', section)
        if header_match:
            table_description = header_match.group(1).strip()
            # Clean table description for SQL naming
            table_description = re.sub(r'[^a-zA-Z0-9_]', '_', table_description).lower()
            # Remove consecutive underscores
            table_description = re.sub(r'_+', '_', table_description)
            # Remove leading/trailing underscores
            table_description = table_description.strip('_')
        else:
            table_description = f"table_{table_counter}"
        
        # Create table name with prefix, counter, and description
        full_table_name = f"{table_name_prefix}_{table_counter}_{table_description}"
        # Ensure table name is not longer than 63 characters (PostgreSQL limit)
        full_table_name = full_table_name[:63]
        
        # Extract lines for this table
        section_lines = section.split('\n')
        
        # Find the header row (first row with | characters after the ## line)
        header_row = next((i for i, line in enumerate(section_lines) if '|' in line), None)
        if header_row is None:
            continue
        
        # Extract headers
        headers = [h.strip() for h in section_lines[header_row].split('|')[1:-1]]
        
        # Remove HTML tags from headers
        headers = [re.sub(r'<.*?>', '', h) for h in headers]
        
        # Skip separator line
        data_rows = []
        for i in range(header_row + 2, len(section_lines)):
            line = section_lines[i].strip()
            if line and '|' in line and not line.startswith('*'):
                # Extract and clean cells
                cells = [cell.strip() for cell in line.split('|')[1:-1]]
                
                # Remove bold formatting
                cells = [re.sub(r'\*\*(.*?)\*\*', r'\1', cell) for cell in cells]
                
                data_rows.append(cells)
        
        # Check if first column has all unique values
        need_unique_id = False
        if data_rows:
            first_col_values = [row[0] for row in data_rows if row]
            if len(first_col_values) != len(set(first_col_values)):
                need_unique_id = True
        
        # Create SQL column definitions
        column_definitions = []
        
        # Add unique_id column if needed
        if need_unique_id:
            column_definitions.append("unique_id INTEGER PRIMARY KEY")
        
        for i, header in enumerate(headers):
            # Check if the column appears to be numeric
            is_numeric = all(
                (re.match(r'^-?\d+(\.\d+)?$', row[i]) or row[i].strip() == '')
                for row in data_rows if i < len(row) and row[i].strip()
            )
            
            # Fix column names: replace hyphens with underscores and remove parentheses
            column_name = header.replace('-', '_').replace(' ', '_').lower()
            column_name = re.sub(r'[^a-zA-Z0-9_]', '_', column_name)
            # Remove consecutive underscores
            column_name = re.sub(r'_+', '_', column_name)
            # Remove leading/trailing underscores
            column_name = column_name.strip('_')
            
            # Handle empty column names
            if not column_name:
                column_name = f"column_{i}"
            
            # Ensure column name is not longer than 59 characters
            column_name = column_name[:59]
            
            if is_numeric:
                column_definitions.append(f"{column_name} NUMERIC")
            else:
                column_definitions.append(f"{column_name} TEXT")
        
        # Create SQL table creation statement
        create_table = f"CREATE TABLE {full_table_name} (\n    " + ",\n    ".join(column_definitions) + "\n);"
        
        # Create SQL insert statements
        insert_statements = []
        for idx, row in enumerate(data_rows):
            # Ensure all rows have the same number of columns
            while len(row) < len(headers):
                row.append('')
            
            # Format values for SQL
            values = []
            
            # Add unique_id if needed
            if need_unique_id:
                values.append(str(idx + 1))
            
            for i, cell in enumerate(row):
                if i < len(headers):
                    if not cell.strip():
                        values.append("NULL")
                    elif re.match(r'^-?\d+(\.\d+)?$', cell):
                        values.append(cell)
                    else:
                        # Fix the f-string backslash issue
                        escaped_cell = cell.replace("'", "''")
                        values.append(f"'{escaped_cell}'")
            
            insert_stmt = f"INSERT INTO {full_table_name} VALUES ({', '.join(values)});"
            insert_statements.append(insert_stmt)
        
        # Combine SQL statements for this table
        table_sql = create_table + "\n\n" + "\n".join(insert_statements) + ";"
        all_sql_statements.append(table_sql)
    
    # Return all SQL statements combined
    return "\n\n".join(all_sql_statements)

def execute_sql_file(sql_file_path, document_id=None):
    """
    Execute SQL statements from a file directly in the PostgreSQL database.
    
    Args:
        sql_file_path (str): Path to the SQL file to execute
        document_id (int, optional): Document ID to associate with created tables
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Read SQL file
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Check if there's any SQL content to execute
        if not sql_content.strip() or sql_content.strip() == "-- SQL generated from markdown files":
            logger.warning(f"No SQL statements found in {sql_file_path}")
            return True
        
        # Get database connection parameters from environment
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_name = os.getenv("DB_NAME", "legacy_data")
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
        
        # Create a cursor with autocommit mode (each statement executes immediately)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Split SQL content into individual statements
        # (split on semicolons but ignore those inside quotes)
        statements = []
        current_statement = ""
        in_quote = False
        for char in sql_content:
            if char == "'" and not in_quote:
                in_quote = True
                current_statement += char
            elif char == "'" and in_quote:
                in_quote = False
                current_statement += char
            elif char == ";" and not in_quote:
                current_statement = current_statement.strip()
                if current_statement:
                    statements.append(current_statement + ";")
                current_statement = ""
            else:
                current_statement += char
        
        # Add the last statement if it exists
        if current_statement.strip():
            statements.append(current_statement.strip() + ";")
        
        # Execute each statement
        tables_created = []
        errors = []
        
        # First, identify all tables to be created
        create_statements = []
        insert_statements = []
        
        for stmt in statements:
            if not stmt.strip() or stmt.strip().startswith('--'):
                continue
                
            # Separate CREATE and INSERT statements
            if 'CREATE TABLE' in stmt.upper():
                create_statements.append(stmt)
                # Extract table name
                match = re.search(r'CREATE TABLE\s+([^\s(]+)', stmt, re.IGNORECASE)
                if match:
                    table_name = match.group(1)
                    tables_created.append(table_name)
            else:
                insert_statements.append(stmt)
        
        # First execute all CREATE TABLE statements
        for stmt in create_statements:
            try:
                cursor.execute(stmt)
                logger.info(f"Executed CREATE TABLE statement successfully")
            except Exception as e:
                error_msg = f"Error executing CREATE TABLE statement: {e}"
                logger.error(error_msg)
                logger.error(f"Statement: {stmt}")
                errors.append(error_msg)
        
        # Then execute all INSERT statements
        for stmt in insert_statements:
            try:
                cursor.execute(stmt)
            except Exception as e:
                error_msg = f"Error executing INSERT statement: {e}"
                logger.error(error_msg)
                logger.error(f"Statement: {stmt}")
                errors.append(error_msg)
        
        # If document_id is provided, add entries to tables_metadata
        if document_id and tables_created:
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
                    
                    logger.info(f"Added metadata for table: {table_name}")
                except Exception as e:
                    error_msg = f"Error adding table metadata for {table_name}: {e}"
                    logger.error(error_msg)
                    errors.append(error_msg)
        
        # Close the connection
        cursor.close()
        conn.close()
        
        # Log success or errors
        if tables_created:
            logger.info(f"Successfully created {len(tables_created)} tables from {sql_file_path}")
            for table in tables_created:
                logger.info(f"Created table: {table}")
        else:
            logger.warning(f"No tables were created from {sql_file_path}")
        
        if errors:
            logger.warning(f"Completed with {len(errors)} errors")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Error executing SQL file: {e}")
        return False

def process_markdown_directory(directory_path, output_file="CreateDB.sql", table_name_prefix=""):
    """
    Process all markdown files in a directory and create a consolidated SQL file.
    
    Args:
        directory_path (str): Path to the directory containing markdown files
        output_file (str): Name of the output SQL file (default: CreateDB.sql)
        table_name_prefix (str): Prefix to use for table names
    
    Returns:
        int: Number of markdown files processed
    """
    # Make sure the directory exists
    if not os.path.exists(directory_path) or not os.path.isdir(directory_path):
        raise ValueError(f"Directory not found: {directory_path}")
    
    # Get all markdown files in the directory
    markdown_files = [f for f in os.listdir(directory_path) if f.lower().endswith('.md')]
    
    if not markdown_files:
        print(f"No markdown files found in {directory_path}")
        return 0
    
    # Clear the output file if it exists
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- SQL generated from markdown files\n\n")
    
    # Process each markdown file
    file_count = 0
    for md_file in markdown_files:
        # Get the full path to the markdown file
        md_file_path = os.path.join(directory_path, md_file)
        # Get the file name without extension to use as table prefix
        file_name_without_ext = os.path.splitext(md_file)[0]
        prefix=table_name_prefix+file_name_without_ext
        
        try:
            # Generate SQL statements from the markdown file
            sql_statements = markdown_to_sql(
                markdown_file_path=md_file_path, 
                table_name_prefix=prefix
            )
            
            # Append SQL statements to the output file
            with open(output_file, 'a', encoding='utf-8') as f:
                f.write(f"-- SQL for {md_file}\n\n")
                f.write(sql_statements)
                f.write("\n\n")
            
            file_count += 1
            print(f"Processed {md_file}")
        except Exception as e:
            print(f"Error processing {md_file}: {e}", file=sys.stderr)
    
    print(f"\nProcessed {file_count} markdown files. SQL saved to {output_file}")
    return file_count

if __name__ == "__main__":
    # Check command line arguments
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Process single file: python md2sql.py <markdown_file_path> [table_name_prefix]")
        print("  Process directory:   python md2sql.py --dir <directory_path> [output_file]")
        sys.exit(1)
    
    # Check if processing a directory
    if sys.argv[1] == "--dir":
        if len(sys.argv) < 3:
            print("Missing directory path")
            print("Usage: python md2sql.py --dir <directory_path> [output_file]")
            sys.exit(1)
        
        directory_path = sys.argv[2]
        output_file = "CreateDB.sql"
        if len(sys.argv) >= 4:
            output_file = sys.argv[3]
        
        try:
            process_markdown_directory(directory_path, output_file)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
    
    else:
        # Process single file (existing functionality)
        markdown_file_path = sys.argv[1]
        
        # Extract the file name without extension to use as default prefix
        file_name = os.path.basename(markdown_file_path)
        file_name_without_ext = os.path.splitext(file_name)[0]
        
        # Get optional table name prefix from command line arguments
        # If not provided, use the file name without extension
        table_name_prefix = file_name_without_ext
        if len(sys.argv) >= 3:
            table_name_prefix = sys.argv[2]
        
        try:
            # Generate SQL statements from the markdown file
            sql_statements = markdown_to_sql(markdown_file_path=markdown_file_path, table_name_prefix=table_name_prefix)
            
            # Print the SQL statements
            print(sql_statements)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)