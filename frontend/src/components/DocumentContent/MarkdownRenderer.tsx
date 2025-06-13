import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  markdown: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderContent = async () => {
      try {
        if (!containerRef.current) return;

        // Render markdown to HTML
        const htmlOutput = await marked.parse(markdown);
        containerRef.current.innerHTML = htmlOutput;

        // Process LaTeX expressions
        const textNodes = getTextNodes(containerRef.current);
        
        textNodes.forEach(node => {
          const text = node.nodeValue || '';
          if (text.includes('$')) {
            const parts = text.split(/(\$[^\$]+\$)/g);
            if (parts.length > 1) {
              const fragment = document.createDocumentFragment();
              
              parts.forEach(part => {
                if (part.startsWith('$') && part.endsWith('$')) {
                  const mathSpan = document.createElement('span');
                  const formula = part.slice(1, -1);
                  katex.render(formula, mathSpan, { throwOnError: false });
                  fragment.appendChild(mathSpan);
                } else {
                  fragment.appendChild(document.createTextNode(part));
                }
              });
              
              node.parentNode?.replaceChild(fragment, node);
            }
          }
        });
      } catch (err) {
        console.error('Error rendering content:', err);
        setError('Error rendering markdown content');
      }
    };

    renderContent();
  }, [markdown]);

  // Helper function to get all text nodes
  const getTextNodes = (node: Node): Node[] => {
    let textNodes: Node[] = [];
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push(node);
    } else {
      const children = node.childNodes;
      for (let i = 0; i < children.length; i++) {
        textNodes = textNodes.concat(getTextNodes(children[i]));
      }
    }
    return textNodes;
  };

  return (
    <Box sx={{ width: '100%', minHeight: '500px', position: 'relative' }}>
      {loading && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}
      <Box 
        ref={containerRef}
        sx={{
          '& table': {
            borderCollapse: 'collapse',
            width: '100%',
            margin: '20px 0',
          },
          '& table, & table th, & table td': {
            border: '1px solid #dddddd',
          },
          '& table th, & table td': {
            padding: '8px',
            textAlign: 'left',
          },
          '& table th': {
            backgroundColor: '#f2f2f2',
            color: 'black'
          },
        }}
      />
    </Box>
  );
};

export default MarkdownRenderer; 