import React, { createContext, useState, useEffect, useContext } from 'react';
import { useUpload } from './UploadContext';
import PageDragOverlay from '../components/FileUpload/PageDragOverlay';
import { useTheme } from '@mui/material';

interface DragDropContextType {
  isPageDragging: boolean;
}

const DragDropContext = createContext<DragDropContextType>({
  isPageDragging: false,
});

export const useDragDrop = () => useContext(DragDropContext);

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPageDragging, setIsPageDragging] = useState(false);
  const [pageDragCounter, setPageDragCounter] = useState(0);
  const { openUploadDialog } = useUpload();
  const theme = useTheme();
  
  // Global drag and drop handling
  useEffect(() => {
    const handlePageDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setPageDragCounter(prev => prev + 1);
      if (pageDragCounter === 0) {
        setIsPageDragging(true);
      }
    };

    const handlePageDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setPageDragCounter(prev => prev - 1);
      if (pageDragCounter <= 1) {
        setIsPageDragging(false);
      }
    };

    const handlePageDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handlePageDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsPageDragging(false);
      setPageDragCounter(0);
      
      // Open upload dialog with dropped files
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        openUploadDialog(Array.from(e.dataTransfer.files));
      }
    };

    document.addEventListener('dragenter', handlePageDragEnter);
    document.addEventListener('dragleave', handlePageDragLeave);
    document.addEventListener('dragover', handlePageDragOver);
    document.addEventListener('drop', handlePageDrop);

    return () => {
      document.removeEventListener('dragenter', handlePageDragEnter);
      document.removeEventListener('dragleave', handlePageDragLeave);
      document.removeEventListener('dragover', handlePageDragOver);
      document.removeEventListener('drop', handlePageDrop);
    };
  }, [pageDragCounter, openUploadDialog]);

  return (
    <DragDropContext.Provider value={{ isPageDragging }}>
      {children}
      <PageDragOverlay 
        isPageDragging={isPageDragging} 
        isDarkMode={theme.palette.mode === 'dark'} 
      />
    </DragDropContext.Provider>
  );
};