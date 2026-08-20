-- name: UpsertTableMetadata :exec
-- Records (or refreshes) one dynamic extraction table's metadata. table_id is
-- the unique full table name produced by md2sql.
INSERT INTO tables_metadata (table_id, table_name, document_id, page_number, extraction_date, status)
VALUES ($1, $2, $3, $4, now(), $5)
ON CONFLICT (table_id) DO UPDATE
SET table_name      = EXCLUDED.table_name,
    document_id     = EXCLUDED.document_id,
    page_number     = EXCLUDED.page_number,
    extraction_date = now(),
    status          = EXCLUDED.status;

-- name: ListTableMetadataByDocument :many
SELECT id, table_id, table_name, document_id, page_number, extraction_date, status
FROM tables_metadata
WHERE document_id = $1
ORDER BY page_number;
