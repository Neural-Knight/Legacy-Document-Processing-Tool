-- tables_metadata: bookkeeping for tables extracted from documents by the
-- md2sql step. Created here via migration rather than at runtime.
--
-- Note: the dynamic per-table extraction tables ({timestamp}_p{N}_...) are
-- still created at runtime by the worker's md2sql step — those are data tables
-- whose names aren't known ahead of time and are intentionally not migrated.

BEGIN;

CREATE TABLE tables_metadata (
    id              SERIAL PRIMARY KEY,
    table_id        VARCHAR(255) UNIQUE,
    table_name      VARCHAR(255),
    document_id     INTEGER,
    page_number     INTEGER,
    extraction_date TIMESTAMP,
    status          VARCHAR(50)
);

CREATE INDEX idx_tables_metadata_document_id ON tables_metadata(document_id);

COMMIT;
