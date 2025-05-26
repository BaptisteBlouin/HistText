import React, { useState } from 'react';
import {
  ButtonGroup,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Box
} from '@mui/material';
import { Code } from '@mui/icons-material';
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
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalTitle, setCodeModalTitle] = useState('');
  const [codeModalContent, setCodeModalContent] = useState('');

  const openCodeModal = (title: string, code: string) => {
    setCodeModalTitle(title);
    setCodeModalContent(code);
    setCodeModalOpen(true);
  };

  const handleCreateCurl = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const curlCommand = generateCurlCommand(
        formData, dateRange, selectedAlias, solrDatabaseId!, 
        getNER, downloadOnly, statsLevel, accessToken
      );
      openCodeModal('cURL Command', curlCommand);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleBuildPython = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const pythonScript = generatePythonScript(
        formData, dateRange, selectedAlias, solrDatabaseId!, 
        getNER, downloadOnly, statsLevel, accessToken
      );
      openCodeModal('Python Script', pythonScript);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleBuildR = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const rScript = generateRScript(
        formData, dateRange, selectedAlias, solrDatabaseId!, 
        getNER, downloadOnly, statsLevel, accessToken
      );
      openCodeModal('R Script', rScript);
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <>
      <ButtonGroup variant="outlined">
        <Button onClick={handleCreateCurl} startIcon={<Code />}>
          cURL
        </Button>
        <Button onClick={handleBuildPython} startIcon={<Code />}>
          Python
        </Button>
        <Button onClick={handleBuildR} startIcon={<Code />}>
          R
        </Button>
      </ButtonGroup>

      <Dialog open={codeModalOpen} onClose={() => setCodeModalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Code />
          {codeModalTitle}
        </DialogTitle>
        <DialogContent dividers>
          <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
            <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.875rem', overflow: 'auto' }}>
              <code>{codeModalContent}</code>
            </pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigator.clipboard.writeText(codeModalContent)}>
            Copy to Clipboard
          </Button>
          <Button onClick={() => setCodeModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default React.memo(CodeGeneration);