import { ReactNode } from 'react';

/**
 * Interface to track individual file upload status
 */
export interface FileUploadStatus {
  fileIndex: number;
  uploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  cancelled: boolean;
}

/**
 * Common props shared across multiple components
 */
export interface CommonProps {
  children?: ReactNode;
  isDarkMode: boolean;
}

/**
 * Props for the DragDropArea component
 */
export interface DragDropAreaProps extends CommonProps {
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileSelect: () => void;
  files: File[];
  uploading: boolean;
  dropAreaRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Props for the FileItem component
 */
export interface FileItemProps {
  file: File;
  index: number;
  status: FileUploadStatus | undefined;
  onRemove: (index: number) => Promise<void>;
  onPreview: (file: File) => void;
  isDarkMode: boolean;
}

/**
 * Props for the FileList component
 */
export interface FileListProps {
  files: File[];
  fileStatuses: FileUploadStatus[];
  handleRemoveFile: (index: number) => Promise<void>;
  handlePreviewFile: (file: File) => void;
  isDarkMode: boolean;
}

/**
 * Props for the FilePreview component
 */
export interface FilePreviewProps {
  previewOpen: boolean;
  previewUrl: string | null;
  handleClosePreview: () => void;
}

/**
 * Props for the PageDragOverlay component
 */
export interface PageDragOverlayProps {
  isPageDragging: boolean;
  isDarkMode: boolean;
}

/**
 * Props for the UploadProgress component
 */
export interface UploadProgressProps {
  uploading: boolean;
  progress: number;
  fileStatuses: FileUploadStatus[];
  files: File[];
  isDarkMode: boolean;
}

/**
 * Props for the UploadActions component
 */
export interface UploadActionsProps {
  files: File[];
  uploading: boolean;
  fileStatuses: FileUploadStatus[];
  handleUpload: () => void;
  handleCancel: () => void;
  isDarkMode: boolean;
}