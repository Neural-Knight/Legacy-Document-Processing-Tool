import { Document } from '../services/documentService'

export type ViewMode = 'grid' | 'list';
export type SortBy = 'date' | 'name' | 'size';
export type SortDirection = 'asc' | 'desc';
export type FilterProcessed = 'all' | 'processed' | 'processing';

export interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  documentId: string;
}

export interface DocumentOperationsProps {
  onDownload: (doc: Document) => void;
  onDelete: (docId: string) => void;
  onView: (docId: string) => void;
  onDetails: (doc: Document) => void;
  onToggleFavorite: (docId: string) => void;
}