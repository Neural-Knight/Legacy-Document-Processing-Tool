import React, { useEffect, useRef, useState } from 'react';
import { 
  Box, 
  Button, 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  useTheme,
  alpha,
  Divider,
  useMediaQuery,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
// Icons
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import InsightsIcon from '@mui/icons-material/Insights';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import FacebookIcon from '@mui/icons-material/Facebook';
import GitHubIcon from '@mui/icons-material/GitHub';

// Custom animation hook
const useMousePosition = () => {
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
  
  React.useEffect(() => {
    const updateMousePosition = (ev: MouseEvent) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    
    window.addEventListener('mousemove', updateMousePosition);
    
    return () => {
      window.removeEventListener('mousemove', updateMousePosition);
    };
  }, []);
  
  return mousePosition;
};

// Elegant Image Showcase Component
const ElegantImageShowcase = ({ theme }: { theme: import('@mui/material/styles').Theme }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Application screenshots data
  const images = [
    {
      src: "images/homepage.png",
      alt: "Dashboard View",
      caption: "Dashboard",
      color: theme.palette.primary.main
    },
    {
      src: "images/uploadpage.png",
      alt: "Document Uploads",
      caption: "Upload",
      color: theme.palette.secondary.main
    },
    {
      src: "images/managementpage.png",
      alt: "Document Management Interface",
      caption: "Smart Management",
      color: theme.palette.info.main
    },
    {
      src: "images/chatbotpage.png",
      alt: "AI Assistant",
      caption: "AI Assistant",
      color: theme.palette.success.main
    }
  ];

  // Start automatic rotation
  useEffect(() => {
    const startAutoRotation = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      intervalRef.current = setInterval(() => {
        if (!isPaused && !isTransitioning) {
          setIsTransitioning(true);
          setActiveIndex(prev => (prev + 1) % images.length);
          // Reset transitioning state after animation completes
          setTimeout(() => setIsTransitioning(false), 600);
        }
      }, 2500);
    };
    
    startAutoRotation();
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, isTransitioning, images.length]);

  // Manual navigation
  const goToSlide = (index: number): void => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setActiveIndex(index);
    setTimeout(() => setIsTransitioning(false), 100);
  };

  // Mouse hover handlers
  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '500px',
      position: 'relative',
      animation: 'fadeInRight 1s ease-out',
      '@keyframes fadeInRight': {
        '0%': { opacity: 0, transform: 'translateX(20px)' },
        '100%': { opacity: 1, transform: 'translateX(0)' }
      },
    }}>
      {/* Main showcase container */}
        {/* Images carousel */}
        <Box 
          sx={{ 
            position: 'relative',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {images.map((image, index) => {
            // Calculate position based on active index
            const isActive = index === activeIndex;
            const isPrev = index === (activeIndex - 1 + images.length) % images.length;
            const isNext = index === (activeIndex + 1) % images.length;
            
            let display = 'none';
            let transform = 'scale(0.8) translateY(50px)';
            let opacity = 0;
            let zIndex = 0;
            
            if (isActive) {
              display = 'block';
              transform = 'scale(1) translateY(0)';
              opacity = 1;
              zIndex = 30;
            } else if (isPrev) {
              display = 'block';
              transform = 'scale(0.85) translate(-40%, 20px) rotate(-5deg)';
              opacity = 0.7;
              zIndex = 20;
            } else if (isNext) {
              display = 'block';
              transform = 'scale(0.85) translate(40%, 20px) rotate(5deg)';
              opacity = 0.7;
              zIndex = 20;
            } else {
              // Show two more images in background for more immersive effect
              const isPrevPrev = index === (activeIndex - 2 + images.length) % images.length;
              const isNextNext = index === (activeIndex + 2) % images.length;
              
              if (isPrevPrev) {
                display = 'block';
                transform = 'scale(0.7) translate(-70%, 40px) rotate(-10deg)';
                opacity = 0.4;
                zIndex = 10;
              } else if (isNextNext) {
                display = 'block';
                transform = 'scale(0.7) translate(70%, 40px) rotate(10deg)';
                opacity = 0.4;
                zIndex = 10;
              }
            }
            
            return (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  width: '80%',
                  maxWidth: '600px',
                  transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
                  transform,
                  opacity,
                  zIndex,
                  display,
                  cursor: isActive ? 'default' : 'pointer',
                  pointerEvents: isTransitioning ? 'none' : 'auto'
                }}
                onClick={() => !isActive && goToSlide(index)}
              >
                {/* Image with shadow */}
                <Box sx={{ 
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '12px',
                  boxShadow: theme.palette.mode === 'light'
                    ? '0 20px 40px rgba(0, 0, 0, 0.15)'
                    : '0 20px 40px rgba(0, 0, 0, 0.3)',
                }}>
                  <Box
                    component="img"
                    src={image.src}
                    alt={image.alt}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      objectFit: 'cover',
                      border: isActive ? `2px solid ${image.color}` : 'none',
                      transition: 'transform 0.4s ease-out',
                      transform: isActive && !isPaused ? 'scale(1)' : isActive ? 'scale(1.03)' : 'scale(1)'
                    }}
                  />
                  
                  {/* Gradient overlay */}
                  <Box 
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0.25,
                      background: `linear-gradient(to bottom, transparent 85%, ${image.color})`
                    }}
                  />
                </Box>
                
                {/* Caption */}
                <Typography
                  sx={{
                  textAlign: 'center',
                  mt: 2,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: image.color,
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 0.4s ease-out'
                  }}
                >
                  {image.caption}
                </Typography>
              </Box>
            );
          })}
        </Box>
        
        {/* Navigation dots */}
        <Box sx={{ 
          position: 'absolute',
          bottom: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 1.5
        }}>
          {images.map((_, index) => (
            <Box
              key={index}
              onClick={() => goToSlide(index)}
              sx={{
                width: index === activeIndex ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: index === activeIndex 
                  ? images[index].color 
                  : alpha(theme.palette.common.black, 0.2),
                boxShadow: index === activeIndex 
                  ? `0 0 8px ${images[index].color}` 
                  : 'none',
                transition: 'all 0.3s',
                cursor: 'pointer'
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </Box>
      
      {/* Visual embellishments - elegant geometric accents */}
      <Box 
        sx={{ 
          position: 'absolute',
          top: '12%',
          right: '12%',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          opacity: 0.1,
          background: `linear-gradient(to right, ${theme.palette.primary.light}, ${theme.palette.secondary.light})`
        }}
      />
      <Box 
        sx={{ 
          position: 'absolute',
          bottom: '20%',
          left: '10%',
          width: '96px',
          height: '96px',
          borderRadius: '50%',
          opacity: 0.1,
          background: `linear-gradient(to right, ${theme.palette.secondary.light}, ${theme.palette.error.light})`
        }}
      />
      <Box 
        sx={{ 
          position: 'absolute',
          top: '75%',
          right: '25%',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          opacity: 0.1,
          background: `linear-gradient(to right, ${theme.palette.success.light}, ${theme.palette.info.light})`
        }}
      />
    </Box>
  );
};

const LandingPage: React.FC = () => {
  const theme = useTheme();
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('md'));
  const mousePosition = useMousePosition();
  const heroRef = useRef<HTMLDivElement>(null);
  
  // Calculate parallax effect based on mouse position
  const getParallaxTransform = (depth: number) => {
    if (!isLargeScreen) return {};
    const movementX = (mousePosition.x - window.innerWidth / 2) / depth;
    const movementY = (mousePosition.y - window.innerHeight / 2) / depth;
    
    return {
      transform: `translate(${movementX}px, ${movementY}px)`
    };
  };

  // Features data with enhanced descriptions while keeping original titles
  const features = [
    {
      icon: <CloudUploadIcon fontSize="large" color="primary" />,
      title: 'Effortless Uploads',
      description: 'Seamlessly integrate any document format with our advanced processing pipeline that automatically organizes and indexes your content.'
    },
    {
      icon: <SearchIcon fontSize="large" color="primary" />,
      title: 'Smart Search',
      description: 'Discover information instantly with our advanced semantic search technology that understands context and intent beyond simple keywords.'
    },
    {
      icon: <InsightsIcon fontSize="large" color="primary" />,
      title: 'Visual Insights',
      description: 'Experience your data like never before with immersive visualizations that reveal hidden patterns and connections in real-time.'
    },
    {
      icon: <SmartToyIcon fontSize="large" color="primary" />,
      title: 'AI-Powered Analysis',
      description: 'Engage with our advanced artificial intelligence that can process, analyze, and generate insights from your documents with human-like understanding.'
    },
    {
      icon: <SecurityIcon fontSize="large" color="primary" />,
      title: 'Enterprise Security',
      description: 'Rest easy knowing your data is protected by cutting-edge encryption algorithms designed to meet the highest security standards.'
    },
    {
      icon: <SpeedIcon fontSize="large" color="primary" />,
      title: 'Lightning Fast',
      description: 'Experience unprecedented performance with our optimized processing architecture that scales automatically to handle any workload.'
    }
  ];

  return (
    <Box sx={{ 
      overflow: 'hidden',
      backgroundColor: theme.palette.mode === 'light' 
        ? alpha(theme.palette.background.default, 0.8)
        : alpha(theme.palette.background.default, 0.9),
    }}>
      {/* Hero Section */}
      <Box
        ref={heroRef}
        sx={{
          position: 'relative',
          height: '90vh',
          display: 'flex',
          alignItems: 'center',
          background: theme.palette.mode === 'light'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.08)} 0%, ${alpha(theme.palette.secondary.light, 0.12)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.15)} 0%, ${alpha(theme.palette.secondary.dark, 0.25)} 100%)`,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 50%)`,
            zIndex: 0,
            transition: 'all 0.3s ease-out',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            right: '-50%',
            width: '120%',
            height: '120%',
            background: theme.palette.mode === 'light'
              ? `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)`
              : `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 70%)`,
            zIndex: 0
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 6, alignItems: 'center' }}>
            <Box 
              sx={{ 
                flex: 1, 
                p: { xs: 2, md: 1 },
                textAlign: { xs: 'center', md: 'left' },
                animation: 'fadeInUp 0.8s ease-out',
                '@keyframes fadeInUp': {
                  '0%': { opacity: 0, transform: 'translateY(20px)' },
                  '100%': { opacity: 1, transform: 'translateY(0)' }
                },
                pr:2
              }}
            >
              <Typography 
                variant="h2" 
                component="h1" 
                sx={{ 
                  fontWeight: 800,
                  mb: 2,
                  background: theme.palette.mode === 'dark' 
                    ? 'linear-gradient(90deg, #1ddef0 0%, #7be854 50%, #c555e9 100%)'
                    : 'linear-gradient(90deg, #00695c 0%, #4dabf5 50%, #9c27b0 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'gradient 8s linear infinite',
                  '@keyframes gradient': {
                    '0%': { backgroundPosition: '0% center' },
                    '100%': { backgroundPosition: '200% center' }
                  },
                  textShadow: theme.palette.mode === 'dark' 
                    ? '0 0 25px rgba(29, 222, 240, 0.3)' 
                    : '0 0 20px rgba(0, 105, 92, 0.15)',
                  letterSpacing: '0.5px',
                }}
              >
                Legacy Document Manager
              </Typography>
              <Typography 
                variant="h5" 
                color="textSecondary" 
                sx={{ 
                  mb: 4,
                  maxWidth: '600px',
                  lineHeight: 1.6,
                  fontWeight: 400,
                  opacity: 0.95,
                  marginX: { xs: 'auto', md: 0 },
                }}
              >
                Harness the power of artificial intelligence to transform how you manage, analyze, and derive insights from your documents in the digital era.
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 3, 
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                justifyContent: { xs: 'center', md: 'flex-start' }
              }}>
                <Button
                  component={RouterLink}
                  to="/signup"
                  variant="contained"
                  size="large"
                  sx={{ 
                    py: 1.8, 
                    px: 4,
                    fontSize: '1rem',
                    fontWeight: 600,
                    minWidth: 180,
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.secondary.main, 0.9)} 100%)`,
                    boxShadow: `0 10px 20px -10px ${alpha(theme.palette.primary.main, 0.5)}`,
                    transition: 'all 0.3s ease-in-out',
                    textTransform: 'none',
                    letterSpacing: '0.5px',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: `0 14px 28px -10px ${alpha(theme.palette.primary.main, 0.6)}`,
                      background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${alpha(theme.palette.secondary.dark, 0.9)} 100%)`,
                    }
                  }}
                >
                  Get Started
                </Button>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="large"
                  sx={{ 
                    py: 1.8, 
                    px: 4,
                    fontSize: '1rem',
                    fontWeight: 600,
                    minWidth: 160,
                    borderRadius: '10px',
                    borderWidth: '2px',
                    borderColor: alpha(theme.palette.primary.main, 0.5),
                    color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main,
                    backdropFilter: 'blur(8px)',
                    background: alpha(theme.palette.background.paper, 0.1),
                    transition: 'all 0.3s ease-in-out',
                    textTransform: 'none',
                    letterSpacing: '0.5px',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      borderColor: theme.palette.primary.main,
                      background: alpha(theme.palette.background.paper, 0.15),
                    }
                  }}
                >
                  Sign In
                </Button>
              </Box>
              
              {/* Floating badges */}
              <Box sx={{ 
                mt: 6, 
                display: 'flex', 
                gap: 2, 
                flexWrap: 'wrap',
                justifyContent: { xs: 'center', md: 'flex-start' }
              }}>
                {['AI-Powered', 'Real-time', 'Secure'].map((badge, index) => (
                  <Box key={badge} sx={{ 
                    py: 0.5, 
                    px: 2, 
                    borderRadius: '50px',
                    background: alpha(theme.palette.background.paper, 0.1),
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    animation: `fadeIn 0.5s ${0.3 + index * 0.2}s forwards`,
                    opacity: 0,
                    '@keyframes fadeIn': {
                      '0%': { opacity: 0, transform: 'translateY(10px)' },
                      '100%': { opacity: 1, transform: 'translateY(0)' }
                    }
                  }}>
                    <Box sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      bgcolor: theme.palette.primary.main,
                      boxShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.7)}`
                    }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>
                      {badge}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            
            {/* Interactive Interface Display - REPLACED WITH NEW ELEGANT SHOWCASE */}
            <Box 
              sx={{ 
                flex: 1, 
                display: { xs: 'none', md: 'block' },
                pl: 5,
              }}
            >
              <ElegantImageShowcase theme={theme} />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <Box sx={{ 
          textAlign: 'center', 
          mb: 10,
          animation: 'fadeInUp 0.8s ease-out',
          '@keyframes fadeInUp': {
            '0%': { opacity: 0, transform: 'translateY(20px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' }
          },
        }}>
          <Typography 
            variant="h3" 
            component="h2" 
            sx={{ 
              fontWeight: 700,
              mb: 2,
              position: 'relative',
              display: 'inline-block',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '60px',
                height: '3px',
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                borderRadius: '3px',
              }
            }}
          >
            Powerful Features
          </Typography>
          <Typography 
            variant="h6" 
            color="textSecondary" 
            sx={{ 
              maxWidth: '700px',
              mx: 'auto',
              mb: 2,
              fontWeight: 400,
            }}
          >
            Experience the next generation of document intelligence with breakthrough capabilities powered by artificial intelligence.
          </Typography>
        </Box>

        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            md: 'repeat(3, 1fr)' 
          },
          gap: 4
        }}>
          {features.map((feature, index) => (
            <Card 
              key={index}
              elevation={0}
              sx={{ 
                height: '100%',
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
                background: theme.palette.mode === 'light'
                  ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.5)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                transition: 'transform 0.4s, box-shadow 0.4s',
                animation: `fadeIn 0.5s ${0.2 + index * 0.1}s both`,
                '@keyframes fadeIn': {
                  '0%': { opacity: 0, transform: 'translateY(20px)' },
                  '100%': { opacity: 1, transform: 'translateY(0)' }
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.7)}, ${alpha(theme.palette.secondary.main, 0.7)})`,
                  opacity: 0,
                  transition: 'opacity 0.3s',
                },
                '&:hover': {
                  transform: 'translateY(-10px)',
                  boxShadow: `0 20px 40px -15px ${alpha(theme.palette.common.black, theme.palette.mode === 'light' ? 0.1 : 0.3)}`,
                  '&::before': {
                    opacity: 1,
                  }
                }
              }}
            >
              <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box 
                  sx={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 3,
                    '& > *': {
                      fontSize: '3.5rem',
                      filter: theme.palette.mode === 'dark' 
                        ? 'drop-shadow(0 0 8px rgba(29, 222, 240, 0.5))' 
                        : 'drop-shadow(0 0 6px rgba(0, 105, 92, 0.25))',
                      transition: 'transform 0.3s ease-in-out',
                    },
                    '&:hover > *': {
                      transform: 'scale(1.1) rotate(5deg)',
                    }
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography 
                  variant="h5" 
                  component="h3" 
                  gutterBottom
                  align="center"
                  sx={{ 
                    fontWeight: 600,
                    position: 'relative',
                    display: 'inline-block',
                    alignSelf: 'center',
                    mb: 2,
                  }}
                >
                  {feature.title}
                </Typography>
                <Typography 
                  variant="body1" 
                  color="textSecondary" 
                  align="center"
                  sx={{ 
                    flexGrow: 1,
                    lineHeight: 1.7,
                  }}
                >
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          py: 10,
          background: theme.palette.mode === 'light'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.15)} 0%, ${alpha(theme.palette.secondary.light, 0.15)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.2)} 0%, ${alpha(theme.palette.secondary.dark, 0.2)} 100%)`,
          borderRadius: { md: '80px 80px 0 0' },
          overflow: 'hidden',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: '18px',
            opacity: 0.5,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '300px',
            height: '300px',
            backgroundImage: theme.palette.mode === 'light'
              ? `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 70%)`
              : `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.2)} 0%, transparent 70%)`,
            borderRadius: '50%',
            zIndex: 0,
            opacity: 0.6
          }
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ 
            textAlign: 'center',
            animation: 'fadeInUp 0.8s ease-out',
            '@keyframes fadeInUp': {
              '0%': { opacity: 0, transform: 'translateY(20px)' },
              '100%': { opacity: 1, transform: 'translateY(0)' }
            },
          }}>
            <Typography 
              variant="h3" 
              component="h2" 
              sx={{ 
                fontWeight: 700,
                mb: 3,
                background: theme.palette.mode === 'dark' 
                  ? 'linear-gradient(90deg, #1ddef0 30%, #7be854 90%)'
                  : 'linear-gradient(90deg, #00695c 30%, #4dabf5 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: theme.palette.mode === 'dark' 
                  ? '0 0 25px rgba(29, 222, 240, 0.15)' 
                  : '0 0 20px rgba(0, 105, 92, 0.1)',
              }}
            >
              Ready to get started?
            </Typography>
            <Typography 
              variant="h6" 
              component="p" 
              color="textSecondary" 
              sx={{ 
                maxWidth: '700px',
                mx: 'auto',
                mb: 5,
                lineHeight: 1.6,
                fontWeight: 400,
              }}
            >
              Join thousands of businesses and individuals who are transforming the way they work with documents.
            </Typography>
            <Button
              component={RouterLink}
              to="/signup"
              variant="contained"
              size="large"
              startIcon={<SmartToyIcon />}
              sx={{ 
                py: 2, 
                px: 6,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: '50px',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.secondary.main, 0.9)} 100%)`,
                boxShadow: `0 10px 20px -8px ${alpha(theme.palette.primary.main, 0.5)}`,
                transition: 'all 0.3s ease-in-out',
                textTransform: 'none',
                letterSpacing: '0.5px',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: `0 20px 30px -12px ${alpha(theme.palette.primary.main, 0.6)}`,
                }
              }}
            >
              Create Free Account
            </Button>
            

          </Box>
        </Container>
      </Box>

      {/* Enhanced Footer */}
      <Box sx={{ 
        pt: 6,
        pb: 4, 
        mt: 4,
        bgcolor: theme.palette.mode === 'light' 
          ? alpha(theme.palette.background.paper, 0.9) 
          : alpha(theme.palette.background.default, 0.7),
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}>
        <Container maxWidth="lg">
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            mb: 4
          }}>
            {/* Company Info */}
            <Box sx={{ mb: { xs: 4, md: 0 }, maxWidth: { md: '300px' } }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 700, 
                mb: 2,
                background: theme.palette.mode === 'dark' 
                  ? 'linear-gradient(90deg, #1ddef0 30%, #7be854 90%)'
                  : 'linear-gradient(90deg, #00695c 30%, #4dabf5 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Legacy Document Manager
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Transform how you manage, analyze, and extract insights from your documents with our powerful platform.
              </Typography>
              
              {/* Social Links */}
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                {[
                  { icon: <TwitterIcon />, label: 'Twitter', link: 'https://twitter.com' },
                  { icon: <LinkedInIcon />, label: 'LinkedIn', link: 'https://linkedin.com' },
                  { icon: <FacebookIcon />, label: 'Facebook', link: 'https://facebook.com' },
                  { icon: <GitHubIcon />, label: 'GitHub', link: 'https://github.com' }
                ].map((social, i) => (
                  <Box 
                    key={i}
                    component="a"
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    sx={{ 
                      width: '36px', 
                      height: '36px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      borderRadius: '8px',
                      background: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: alpha(theme.palette.primary.main, 0.2),
                        transform: 'translateY(-3px)'
                      }
                    }}
                  >
                    {social.icon}
                  </Box>
                ))}
              </Box>
            </Box>
            
            {/* Quick Links */}
            <Box sx={{ display: 'flex', gap: { xs: 4, md: 8 } }}>
              {[
                {
                  title: 'Product',
                  links: ['Features', 'Pricing', 'Enterprise', 'Security']
                },
                {
                  title: 'Resources',
                  links: ['Documentation', 'Guides', 'API Reference', 'Blog']
                },
                {
                  title: 'Company',
                  links: ['About', 'Careers', 'Contact', 'Legal']
                }
              ].map((group, i) => (
                <Box key={i}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    {group.title}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {group.links.map((link, j) => (
                      <Typography 
                        key={j} 
                        variant="body2" 
                        sx={{ 
                          color: theme.palette.text.secondary,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            color: theme.palette.primary.main,
                            transform: 'translateX(3px)'
                          }
                        }}
                      >
                        {link}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
          
          <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.1), mb: 3 }} />
          
          {/* Copyright and Legal */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 }
          }}>
            <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
              © {new Date().getFullYear()} Legacy Document Manager. All rights reserved.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 3 }}>
              {['Privacy Policy', 'Terms of Service', 'Cookies'].map((item, i) => (
                <Typography 
                  key={i} 
                  variant="body2" 
                  sx={{ 
                    color: theme.palette.text.secondary,
                    cursor: 'pointer',
                    '&:hover': { color: theme.palette.primary.main }
                  }}
                >
                  {item}
                </Typography>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;