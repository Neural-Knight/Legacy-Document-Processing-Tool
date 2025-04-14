import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  useTheme, 
  alpha,
  Paper,
  Stack
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import BarChartIcon from '@mui/icons-material/BarChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import StorageIcon from '@mui/icons-material/Storage';

const HomePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDarkMode = theme.palette.mode === 'dark';
  const features = [
    {
      title: 'My Documents',
      description: 'Browse and manage your uploaded documents. Access your original documents for reference and further analysis.',
      icon: <PictureAsPdfIcon fontSize="large" />,
      color: theme.palette.info.main,
      path: '/documents',
      delay: 0.2
    },
    {
      title: 'Visualizations',
      description: "Create interactive visualizations from extracted document data.\
Transform information into insightful charts and graphs.",
      icon: <BarChartIcon fontSize="large" />,
      color: theme.palette.secondary.main,
      path: '/visualizations',
      delay: 0.3
    },
    {
      title: 'Query Tool',
      description: 'Ask questions about your documents using natural language.\
Extract meaningful insights and get accurate answers with ease.',
      icon: <StorageIcon fontSize="large" />,
      color: theme.palette.success.main,
      path: '/query-agent',
      delay: 0.4
    },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Paper 
          elevation={0}
          sx={{ 
            p: 5, 
            mb: 5, 
            borderRadius: '16px',
            background: isDarkMode? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.4)} 0%, ${alpha(theme.palette.secondary.dark, 0.2)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            position: 'relative',
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.03), 0 2px 8px ${alpha(theme.palette.primary.main, 0.08)}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `radial-gradient(circle at 20% 30%, ${alpha(theme.palette.primary.light, 0.15)} 0%, rgba(255,255,255,0) 60%)`,
            }
          }}
        >
          <Typography variant="h3" component="h1" gutterBottom sx={{ 
            fontWeight: 700,
            background: isDarkMode?'linear-gradient(90deg, #fff 0%, #e0e0e0 100%)':theme.palette.primary.main ,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 10px rgba(0,0,0,0.05)',
          }}>
            Legacy Document Manager
          </Typography>
          <Typography variant="h6" sx={{ 
            maxWidth: '800px', 
            mb: 4,
            color: theme.palette.text.secondary
          }}>
            Unlock insights from your documents with AI. Transform unstructured information into actionable knowledge.
          </Typography>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Button 
              variant="contained" 
              size="large" 
              onClick={() => navigate('/upload')}
              sx={{ 
                px: 4,  
                py: 1.5, 
                borderRadius: 2,
                boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
                background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.dark, 0.8)})`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.6)}`,
                }
              }}
            >
              Get Started
            </Button>
          </motion.div>
        </Paper>
      </motion.div>

      <Typography 
        variant="h4" 
        component="h2"
        sx={{ 
          mb: 4, 
          textAlign: 'center',
          fontWeight: 600,
          background: `linear-gradient(45deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.7)})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Explore Features
      </Typography>

      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        spacing={3} 
        sx={{ 
          width: '100%',
          overflowX: { xs: 'visible', sm: 'auto' },
          pb: 2
        }}
      >
        {features.map((feature, index) => (
          <Box
            key={feature.title}
            sx={{ 
              flexGrow: 1,
              flexBasis: { xs: '100%', sm: '33.33%' }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: feature.delay }}
              style={{ 
                height: '100%', 
                display: 'flex'
              }}
            >
              <Card sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: `0 12px 20px ${alpha(feature.color, 0.2)}`
                },
              }}>
                <CardContent sx={{ flexGrow: 1, p: 4 }}>
                  <Box sx={{ 
                    mb: 2, 
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '10px',
                    backgroundColor: alpha(feature.color, 0.12),
                    color: feature.color,
                    border: `1px solid ${alpha(feature.color, 0.15)}`,
                    boxShadow: `0 2px 8px ${alpha(feature.color, 0.08)}`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      backgroundColor: alpha(feature.color, 0.16),
                      boxShadow: `0 3px 10px ${alpha(feature.color, 0.12)}`,
                      transform: 'scale(1.05)',
                    }
                  }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" paragraph>
                    {feature.description}
                  </Typography>
                  <Button 
                    variant="contained"
                    onClick={() => navigate(feature.path)}
                    sx={{ 
                      mt: 'auto',
                      backgroundColor: feature.color,
                      boxShadow: `0 3px 8px ${alpha(feature.color, 0.25)}`,
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'light' 
                          ? alpha(feature.color, 0.9) 
                          : alpha(feature.color, 0.8),
                        transform: 'translateY(-2px)',
                        boxShadow: `0 5px 12px ${alpha(feature.color, 0.3)}`
                      },
                      transition: 'all 0.3s ease',
                    }}
                  >
                    Go to {feature.title}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default HomePage;