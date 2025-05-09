import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

interface UploadContextType {
  uploadDialogOpen: boolean;
  openUploadDialog: (files?: File[]) => void;
  closeUploadDialog: () => void;
  isUploading: boolean;
  uploadProgress: number;
  recentlyUploadedDocuments: string[];
  setRecentlyUploadedDocuments: (ids: string[]) => void;
  initialFiles: File[];
}

const UploadContext = createContext<UploadContextType>({
  uploadDialogOpen: false,
  openUploadDialog: () => {},
  closeUploadDialog: () => {},
  isUploading: false,
  uploadProgress: 0,
  recentlyUploadedDocuments: [],
  setRecentlyUploadedDocuments: () => {},
  initialFiles: [],
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recentlyUploadedDocuments, setRecentlyUploadedDocuments] = useState<string[]>([]);

  const openUploadDialog = useCallback((files: File[] = []) => {
    setInitialFiles(files);
    setUploadDialogOpen(true);
  }, []);

  const closeUploadDialog = useCallback(() => {
    setUploadDialogOpen(false);
    setInitialFiles([]);
  }, []);

  // Clear recently uploaded documents after 5 minutes
  useEffect(() => {
    if (recentlyUploadedDocuments.length > 0) {
      const timer = setTimeout(() => {
        setRecentlyUploadedDocuments([]);
      }, 5 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [recentlyUploadedDocuments]);

  // Update the onUploadComplete handler
  const onUploadComplete = useCallback((documentIds: string[]) => {
    // Set the recently uploaded document IDs
    setRecentlyUploadedDocuments(documentIds);
    
    // Clear the list after a delay so it can be used again
    setTimeout(() => {
      setRecentlyUploadedDocuments([]);
    }, 3000); // Clear after 3 seconds
    
    // Close dialog if needed
    if (uploadDialogOpen) {
      setUploadDialogOpen(false);
    }
  }, [uploadDialogOpen]);

  const value = {
    uploadDialogOpen,
    openUploadDialog,
    closeUploadDialog,
    isUploading,
    uploadProgress,
    recentlyUploadedDocuments,
    setRecentlyUploadedDocuments,
    initialFiles,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};