import React from 'react';
import { Box, Typography, Paper, alpha, useTheme } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { motion } from 'framer-motion';
import { FileListProps } from '../../../types/fileUploadtypes';
import FileItem from './FileItem';

/**
 * Component that displays the list of files to upload
 */
const FileList: React.FC<FileListProps> = ({
  files,
  fileStatuses,
  handleRemoveFile,
  handlePreviewFile,
  isDarkMode
}) => {
  const theme = useTheme();

  // Don't render if there are no files
  if (files.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Paper
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          backgroundColor: theme.palette.background.paper,
          boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.07)}`,
          overflow: 'hidden'
        }}
        elevation={1}
      >
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 2, 
            display: 'flex', 
            alignItems: 'center',
            color: theme.palette.primary.main,
            fontWeight: 'bold'
          }}
        >
          <AttachFileIcon sx={{ mr: 1 }} />
          Selected Documents
        </Typography>
        
        <Box 
          sx={{
            maxHeight: 320,
            overflowY: 'auto',
            width: '100%',
            pr: 1
          }}
        >
          {files.map((file, index) => {
            const status = fileStatuses.find(s => s.fileIndex === index);
            
            return (
              <FileItem 
                key={`${file.name}-${index}`}
                file={file}
                index={index}
                status={status}
                onRemove={handleRemoveFile}
                onPreview={handlePreviewFile}
                isDarkMode={isDarkMode}
              />
            );
          })}
        </Box>
      </Paper>
    </motion.div>
  );
};

export default FileList;