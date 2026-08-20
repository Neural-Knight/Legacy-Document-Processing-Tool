-- Phase 4: index vector_entries by document_id. RAG retrieval and idempotent
-- re-indexing both filter/delete by document_id; the base schema only had
-- ix_vector_entries_id (the PK). This speeds those up.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_vector_entries_document_id ON vector_entries(document_id);

COMMIT;
