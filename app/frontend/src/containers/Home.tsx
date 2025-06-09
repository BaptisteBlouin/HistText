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
import config from "../../config.json";

export const Home = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const contactAddress = config.CONTACT_ADDRESS || "feedback@histtext.com";

  const homeMessage =
    config.HOME_MESSAGE ||
    "The application is currently in beta version. Don't hesitate to send us your feedback.";

  const iframeUrl =
    config.HOME_URL || "https://www.enpchina.eu/2024/09/03/poc/";

  const displayLogo = config.USE_HOME_LOGO !== false;

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

            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => navigate("/histtext")}
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
            </Button>
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
                }}
              >
                <iframe
                  src={iframeUrl}
                  width="100%"
                  height="100%"
                  title="HistText Information"
                  style={{
                    border: "none",
                    display: "block",
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
};
