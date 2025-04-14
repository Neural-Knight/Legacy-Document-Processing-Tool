import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Box, useTheme } from '@mui/material';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';

interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const theme = useTheme();

  const sanitizedContent = DOMPurify.sanitize(content);
  const isDarkMode = theme.palette.mode === 'dark';
  return (
    <Box sx={{ 
      '& a': { color: theme.palette.primary.main },
      '& code': { 
        backgroundColor: theme.palette.grey[100],
        padding: '2px 4px',
        borderRadius: '4px'
      },
      // Add table styling
      '& table': {
        borderCollapse: 'collapse',
        width: '100%',
        marginBottom: '1rem'
      },
      '& th, & td': {
        border: `1px solid ${theme.palette.divider}`,
        padding: '8px',
        textAlign: 'left'
      },
      '& th': {
        backgroundColor: isDarkMode?theme.palette.grey[700]:theme.palette.grey[200],
        fontWeight: 'bold'
      },
      // Add header styling
      '& h2': {
        borderBottom: `1px solid ${theme.palette.divider}`,
        paddingBottom: '0.3em',
        marginTop: '24px',
        marginBottom: '16px'
      }
    }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({node, ...props}) => <h2 style={{color: theme.palette.text.primary}} {...props} />,
          a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </Box>
  );
};

export default MarkdownPreview;