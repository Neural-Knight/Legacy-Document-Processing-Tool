import React from 'react';
import { Typography, Link, Box, useTheme} from '@mui/material';

interface MarkdownPreviewProps {
  content: string;
}

// A simple component to render markdown-like text
// In a real application, you would use a markdown library like 'react-markdown'
const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const theme = useTheme();
  
  // This is a simplified version - for a real app use a proper markdown parser
  const formattedContent = content
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return (
    <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
  );
};

export default MarkdownPreview;