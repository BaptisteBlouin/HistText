import React, { useState } from 'react';
import {
  ButtonGroup,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Box,
  IconButton,
  Tooltip,
  Chip,
  Typography,
  useTheme,
  alpha,
  Fade,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Code, 
  ContentCopy, 
  Download, 
  Close,
  CheckCircle,
  Terminal,
  Language
} from '@mui/icons-material';
import { generateCurlCommand, generatePythonScript, generateRScript } from '../utils/codeGenerator';

interface CodeGenerationProps {
  formData: any;
  dateRange: any;
  selectedAlias: string;
  solrDatabaseId: number | null;
  getNER: boolean;
  downloadOnly: boolean;
  statsLevel: string;
  accessToken: string;
}

interface CodeExample {
  id: string;
  name: string;
  icon: React.ReactNode;
  language: string;
  generator: () => string;
  color: string;
}

const CodeGeneration: React.FC<CodeGenerationProps> = ({
  formData,
  dateRange,
  selectedAlias,
  solrDatabaseId,
  getNER,
  downloadOnly,
  statsLevel,
  accessToken
}) => {
  const theme = useTheme();
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const codeExamples: CodeExample[] = [
    {
      id: 'curl',
      name: 'cURL',
      icon: <Terminal />,
      language: 'bash',
      color: '#4CAF50',
      generator: () => generateCurlCommand(
        formData, dateRange, selectedAlias, solrDatabaseId!, 
        getNER, downloadOnly, statsLevel, accessToken
      )
    },
    {
      id: 'python',
      name: 'Python',
      icon: <Language />,
      language: 'python',
      color: '#3776ab',
      generator: () => generatePythonScript(
        formData, dateRange, selectedAlias, solrDatabaseId!, 
        getNER, downloadOnly, statsLevel, accessToken
      )
    },
    {
      id: 'r',
      name: 'R',
      icon: <Code />,
      language: 'r',
      color: '#276DC3',
      generator: () => generateRScript(
        formData, dateRange, selectedAlias, solrDatabaseId!, 
        getNER, downloadOnly, statsLevel, accessToken
      )
    }
  ];

  const handleOpenModal = () => {
    setCodeModalOpen(true);
    setSelectedTab(0);
    setCopiedStates({});
  };

  const handleCopyCode = async (codeId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedStates(prev => ({ ...prev, [codeId]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [codeId]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDownloadCode = (code: string, filename: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const generateCode = (example: CodeExample) => {
    try {
      return example.generator();
    } catch (error: any) {
      return `# Error generating ${example.name} code: ${error.message}`;
    }
  };

  const getFileExtension = (language: string) => {
    const extensions = { bash: 'sh', python: 'py', r: 'R' };
    return extensions[language] || 'txt';
  };

  return (
    <>
      <ButtonGroup variant="outlined" size="small">
        {codeExamples.map((example) => (
          <Button 
            key={example.id}
            onClick={handleOpenModal} 
            startIcon={example.icon}
            sx={{ 
              color: example.color,
              borderColor: alpha(example.color, 0.3),
              '&:hover': {
                borderColor: example.color,
                backgroundColor: alpha(example.color, 0.1)
              }
            }}
          >
            {example.name}
          </Button>
        ))}
      </ButtonGroup>

      <Dialog 
        open={codeModalOpen} 
        onClose={() => setCodeModalOpen(false)} 
        fullWidth 
        maxWidth="lg"
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          pb: 1,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Code color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              API Code Examples
            </Typography>
            <Chip 
              label={`${codeExamples.length} languages`} 
              size="small" 
              variant="outlined"
              color="primary"
            />
          </Box>
          <IconButton onClick={() => setCodeModalOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={selectedTab} 
              onChange={(_, newValue) => setSelectedTab(newValue)}
              variant="fullWidth"
            >
              {codeExamples.map((example, index) => (
                <Tab
                  key={example.id}
                  icon={example.icon}
                  label={example.name}
                  iconPosition="start"
                  sx={{
                    color: example.color,
                    '&.Mui-selected': {
                      color: example.color,
                      fontWeight: 600
                    }
                  }}
                />
              ))}
            </Tabs>
          </Box>

          {codeExamples.map((example, index) => (
            <Box key={example.id} hidden={selectedTab !== index}>
              {selectedTab === index && (
                <Fade in={true} timeout={300}>
                  <Box>
                    {/* Header with actions */}
                    <Box sx={{ 
                      p: 2, 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      backgroundColor: alpha(example.color, 0.05),
                      borderBottom: `1px solid ${alpha(example.color, 0.1)}`
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {example.icon}
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: example.color }}>
                          {example.name} Implementation
                        </Typography>
                        <Chip 
                          label={example.language} 
                          size="small" 
                          sx={{ 
                            backgroundColor: alpha(example.color, 0.1),
                            color: example.color,
                            fontWeight: 600
                          }}
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title={copiedStates[example.id] ? 'Copied!' : 'Copy to clipboard'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyCode(example.id, generateCode(example))}
                            sx={{ 
                              color: copiedStates[example.id] ? 'success.main' : example.color,
                              '&:hover': { backgroundColor: alpha(example.color, 0.1) }
                            }}
                          >
                            {copiedStates[example.id] ? <CheckCircle /> : <ContentCopy />}
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Download file">
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadCode(
                              generateCode(example),
                              `api_example.${getFileExtension(example.language)}`
                            )}
                            sx={{ 
                              color: example.color,
                              '&:hover': { backgroundColor: alpha(example.color, 0.1) }
                            }}
                          >
                            <Download />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Code display */}
                    <Paper 
                      sx={{ 
                        m: 2,
                        borderRadius: 2,
                        border: `1px solid ${alpha(example.color, 0.2)}`,
                        overflow: 'hidden'
                      }}
                    >
                      <Box sx={{ 
                        p: 0,
                        backgroundColor: '#1e1e1e',
                        color: '#d4d4d4',
                        fontFamily: '"Fira Code", "Monaco", "Menlo", "Consolas", monospace',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        overflow: 'auto',
                        maxHeight: '60vh'
                      }}>
                        <Box sx={{ p: 2 }}>
                          <pre style={{ 
                            margin: 0, 
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            <code>{generateCode(example)}</code>
                          </pre>
                        </Box>
                      </Box>
                    </Paper>

                    {/* Usage instructions */}
                    <Box sx={{ p: 2, backgroundColor: alpha(example.color, 0.02) }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Usage Instructions:</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {example.id === 'curl' && 'Run this command in your terminal to make the API request directly.'}
                        {example.id === 'python' && 'Save as a .py file and run with Python. Requires requests and pandas libraries.'}
                        {example.id === 'r' && 'Save as a .R file and run with R. Requires httr and jsonlite packages.'}
                      </Typography>
                    </Box>
                  </Box>
                </Fade>
              )}
            </Box>
          ))}
        </DialogContent>

        <DialogActions sx={{ 
          p: 2, 
          borderTop: `1px solid ${theme.palette.divider}`,
          justifyContent: 'space-between'
        }}>
          <Typography variant="caption" color="text.secondary">
            Select a tab above to view different implementation examples
          </Typography>
          <Button onClick={() => setCodeModalOpen(false)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default React.memo(CodeGeneration);