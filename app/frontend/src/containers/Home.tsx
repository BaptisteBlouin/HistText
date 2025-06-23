import React, { useState } from "react";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  Paper,
  Chip,
  useTheme,
  useMediaQuery,
  Fade,
} from "@mui/material";
import { LoadingButton } from "../components/ui";
import {
  Description,
  Analytics,
  Cloud,
  Security,
  Speed,
  Language,
  ArrowForward,
  Email,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import enp from "../images/logo.png";
import { useConfig } from "../contexts/ConfigurationContext";

export const Home = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const config = useConfig();
  
  const contactAddress = config.CONTACT_ADDRESS || "feedback@histtext.com";
  const homeMessage = config.HOME_MESSAGE || "The application is currently in beta version. Don't hesitate to send us your feedback.";
  const iframeUrl = config.HOME_URL || "https://www.enpchina.eu/2024/09/03/poc/";
  const displayLogo = config.USE_HOME_LOGO !== false;

  // Function to detect if URL is YouTube and convert it to embed format
  const processYouTubeUrl = (url: string) => {
    // Check if it's already an embed URL
    if (url.includes('youtube.com/embed/') || url.includes('youtu.be/embed/')) {
      // If it's a videoseries (playlist), add index=1 to start from first video if not already specified
      if (url.includes('videoseries') && !url.includes('index=')) {
        const separator = url.includes('?') ? '&' : '?';
        return { isYouTube: true, embedUrl: `${url}${separator}index=1` };
      }
      return { isYouTube: true, embedUrl: url };
    }
    
    // Regular expressions for different YouTube URL formats
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const playlistRegex = /[?&]list=([a-zA-Z0-9_-]+)/;
    const timestampRegex = /[?&]t=([0-9]+)/;
    const startRegex = /[?&]start=([0-9]+)/;
    
    const videoMatch = url.match(youtubeRegex);
    const playlistMatch = url.match(playlistRegex);
    const timestampMatch = url.match(timestampRegex);
    const startMatch = url.match(startRegex);
    
    // Handle regular video URLs with optional playlist
    if (videoMatch) {
      const videoId = videoMatch[1];
      let embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const params = [];
      
      // If there's a playlist, add it to the embed URL
      if (playlistMatch) {
        const playlistId = playlistMatch[1];
        params.push(`list=${playlistId}`);
      }
      
      // Handle timestamp parameters (t= or start=)
      if (startMatch) {
        params.push(`start=${startMatch[1]}`);
      } else if (timestampMatch) {
        params.push(`start=${timestampMatch[1]}`);
      }
      
      // Add parameters to URL
      if (params.length > 0) {
        embedUrl += `?${params.join('&')}`;
      }
      
      return { isYouTube: true, embedUrl };
    }
    
    // Handle playlist-only URLs (like /playlist?list=... or watch?list=... without v=)
    if (playlistMatch && url.includes('youtube.com')) {
      const playlistId = playlistMatch[1];
      let embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
      
      // Always start from the first video for playlist-only URLs
      embedUrl += '&index=1';
      
      return { isYouTube: true, embedUrl };
    }
    
    // Handle YouTube channel URLs (convert to channel page - not embeddable)
    const channelRegex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/|c\/|user\/|@)([a-zA-Z0-9_-]+)/;
    const channelMatch = url.match(channelRegex);
    
    if (channelMatch) {
      // YouTube channels can't be embedded, return original URL as non-YouTube
      return { isYouTube: false, embedUrl: url };
    }
    
    // If no YouTube patterns match, treat as regular URL
    return { isYouTube: false, embedUrl: url };
  };

  const { isYouTube, embedUrl } = processYouTubeUrl(iframeUrl);

  const features = [
    {
      icon: <Description />,
      title: "Text Analysis",
      description: "Advanced document search and text processing capabilities",
    },
    {
      icon: <Analytics />,
      title: "Statistics",
      description:
        "Comprehensive statistical analysis of your document collections",
    },
    {
      icon: <Cloud />,
      title: "Word Clouds",
      description: "Visual representation of term frequencies and patterns",
    },
    {
      icon: <Security />,
      title: "Secure",
      description: "Enterprise-grade security with role-based access control",
    },
    {
      icon: <Speed />,
      title: "High Performance",
      description: "Optimized for large-scale document processing",
    },
    {
      icon: <Language />,
      title: "Multilingual",
      description: "Support for multiple languages and NLP models",
    },
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Fade in={true} timeout={1000}>
          <Box sx={{ textAlign: "center", mb: 6 }}>
            {displayLogo && (
              <Box sx={{ mb: 4 }}>
                <img
                  src={enp}
                  alt="HistText Logo"
                  style={{
                    height: isMobile ? "80px" : "120px",
                    filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))",
                  }}
                />
              </Box>
            )}

            <Typography
              variant={isMobile ? "h3" : "h2"}
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 2,
              }}
            >
              Welcome to HistText
            </Typography>

            <Typography
              variant="h5"
              color="text.secondary"
              sx={{
                mb: 4,
                maxWidth: "600px",
                mx: "auto",
                lineHeight: 1.6,
              }}
            >
              A platform for document discovery and advanced text analysis,
              designed for students, researchers, and professionals
            </Typography>

            <Box sx={{ mb: 4 }}>
              <Chip
                label="Beta Version"
                color="primary"
                variant="outlined"
                sx={{ mr: 1 }}
              />
              <Chip label="Free Access" color="success" variant="outlined" />
            </Box>

            <Paper
              sx={{
                p: 3,
                mb: 4,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  lineHeight: 1.8,
                  color: "text.primary",
                }}
                dangerouslySetInnerHTML={{
                  __html: homeMessage.replace(/\n/g, "<br>"),
                }}
              />
            </Paper>

            <LoadingButton
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              loading={isNavigating}
              onClick={() => {
                setIsNavigating(true);
                setTimeout(() => navigate("/histtext"), 100);
              }}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: "1.1rem",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 25px rgba(102, 126, 234, 0.3)",
                },
                transition: "all 0.3s ease",
              }}
            >
              Get Started
            </LoadingButton>
            <Button
              variant="outlined"
              startIcon={<Email />}
              href={`mailto:${contactAddress}?subject=HistText Feedback&body=Hi, I'd like to share feedback about HistText:%0D%0A%0D%0A`}
              sx={{ ml: 2 }}
            >
              Send Feedback
            </Button>
          </Box>
        </Fade>

        <Fade in={true} timeout={1500}>
          <Box sx={{ mb: 6 }}>
            <Typography
              variant="h4"
              component="h2"
              align="center"
              gutterBottom
              sx={{ fontWeight: 600, mb: 4 }}
            >
              Powerful Features
            </Typography>

            <Grid container spacing={3}>
              {features.map((feature, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card
                    sx={{
                      height: "100%",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: "center" }}>
                      <Box
                        sx={{
                          display: "inline-flex",
                          p: 2,
                          borderRadius: "50%",
                          bgcolor: "primary.light",
                          color: "primary.main",
                          mb: 2,
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Typography
                        variant="h6"
                        component="h3"
                        gutterBottom
                        sx={{ fontWeight: 600 }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Fade>

        <Fade in={true} timeout={2000}>
          <Card sx={{ overflow: "hidden" }}>
            <CardContent sx={{ p: 0 }}>
              <Typography
                variant="h5"
                component="h2"
                align="center"
                sx={{
                  py: 3,
                  fontWeight: 600,
                  bgcolor: "background.paper",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                Learn More
              </Typography>
              <Box
                sx={{
                  position: "relative",
                  height: isMobile ? "400px" : "600px",
                  overflow: "hidden",
                  // For YouTube videos, use responsive aspect ratio
                  ...(isYouTube && {
                    height: "auto",
                    paddingBottom: "56.25%", // 16:9 aspect ratio
                  }),
                }}
              >
                <iframe
                  src={embedUrl}
                  width="100%"
                  height={isYouTube ? "100%" : "100%"}
                  title={isYouTube ? "YouTube video player" : "HistText Information"}
                  style={{
                    border: "none",
                    display: "block",
                    ...(isYouTube && {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                    }),
                  }}
                  // YouTube-specific attributes
                  {...(isYouTube && {
                    frameBorder: "0",
                    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
                    referrerPolicy: "strict-origin-when-cross-origin",
                    allowFullScreen: true,
                  })}
                />
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
};