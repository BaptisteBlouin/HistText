import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Grid,
  Stack,
  Fade,
  Chip,
  LinearProgress,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import {
  ContentCopy,
  Download,
  Help,
  Settings,
  PlayArrow,
  GetApp,
  Code,
  Memory,
  Translate,
} from "@mui/icons-material";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

interface SolrDatabase {
  id: number;
  name: string;
}

const ARG_DESCRIPTIONS: Record<string, string> = {
  "solr-host": "Solr host (default: localhost)",
  "solr-port": "Solr port (default: 8983)",
  "cache-dir": "Root directory where JSONL will be cached",
  "tokenize-solr": "Command to tokenize text from a Solr collection",
  collection: "Solr collection name",
  "model-name": "Model name for tokenization (default: cwseg)",
  "model-type": "Type of tokenizer model (default: chinese_segmenter)",
  "text-field": "Solr field containing plain text",
  "filter-query": "Additional Solr fq to restrict documents",
  "batch-size": "Number of Solr docs per batch",
  nbatches: "Limit number of batches (None = all)",
  upload: "Command to upload processed files to Solr",
  schema: "Schema file to use for upload",
};

/**
 * Returns an Axios instance with Authorization set from current auth context.
 */
const useAuthAxios = () => {
  const { accessToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers = new AxiosHeaders({
          ...config.headers,
          Authorization: `Bearer ${accessToken}`,
        });
      }
      return config;
    }, Promise.reject);
    return instance;
  }, [accessToken]);
};

/**
 * UI for generating Solr text tokenization and upload commands.
 * Allows admins to select a Solr database, collection, and text field,
 * then generates shell commands for tokenization and uploading.
 */
const TokenizeSolr: React.FC = () => {
  const authAxios = useAuthAxios();

  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedSolrDb, setSelectedSolrDb] = useState<SolrDatabase | null>(
    null,
  );
  const [collectionName, setCollectionName] = useState("");

  const [solrHost, setSolrHost] = useState("localhost");
  const [solrPort, setSolrPort] = useState<number | "">(8983);
  const [cacheDir, setCacheDir] = useState("");

  const [modelName, setModelName] = useState("cwseg");
  const [modelType, setModelType] = useState("chinese_segmenter");
  const [textField, setTextField] = useState("");
  const [availableFields, setAvailableFields] = useState<string[]>([]);


  const [tokenizeCommand, setTokenizeCommand] = useState("");
  const [uploadCommand, setUploadCommand] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authAxios
      .get("/api/solr_databases")
      .then(({ data }) => setSolrDatabases(data))
      .catch(() => setSolrDatabases([]));
  }, [authAxios]);

  useEffect(() => {
    if (!selectedSolrDb) {
      setAliases([]);
      setCollectionName("");
      setAvailableFields([]);
      return;
    }
    authAxios
      .get<string[]>(`/api/solr/aliases?solr_database_id=${selectedSolrDb.id}`)
      .then(({ data }) => setAliases(Array.isArray(data) ? data : []))
      .catch(() => setAliases([]));
    setCollectionName("");
    setAvailableFields([]);
  }, [selectedSolrDb, authAxios]);

  useEffect(() => {
    if (!selectedSolrDb || !collectionName) {
      setAvailableFields([]);
      return;
    }

    setLoading(true);
    authAxios
      .get(
        `/api/solr/collection_metadata?collection=${encodeURIComponent(collectionName)}&solr_database_id=${selectedSolrDb.id}`,
      )
      .then(({ data }) => {
        if (data && Array.isArray(data)) {
          const fieldNames = data.map((field: any) => field.name);
          setAvailableFields(fieldNames);

          if (!textField) {
            const textFieldCandidates = fieldNames.filter(
              (field) =>
                field.includes("text") ||
                field.includes("content") ||
                field.includes("body") ||
                field.includes("description"),
            );

            if (textFieldCandidates.length > 0) {
              setTextField(textFieldCandidates[0]);
            }
          }
        }
      })
      .catch((error) => {
        console.error("Failed to fetch collection metadata:", error);
        setAvailableFields([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSolrDb, collectionName, authAxios, textField]);

  /**
   * Checks that all required form fields are present.
   */
  const isFormValid = useMemo(() => {
    return (
      !!collectionName &&
      !!textField &&
      !!cacheDir &&
      !!solrHost &&
      solrPort !== ""
    );
  }, [collectionName, textField, cacheDir, solrHost, solrPort]);

  /**
   * Generates tokenization and upload commands from the form fields.
   */
  const handleGenerate = () => {
    const tokenizeCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} --cache-dir "${cacheDir}" tokenize-solr "${collectionName}" --model-name "${modelName}" --model-type "${modelType}" --text-field "${textField}"`;

    setTokenizeCommand(tokenizeCmd);

    const uploadCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} upload ${collectionName}-tok "${cacheDir}/${modelName}/${collectionName}/${textField}/"*.jsonl --schema "${cacheDir}/${collectionName}.yaml"`;

    setUploadCommand(uploadCmd);
  };

  return (
    <Fade in={true} timeout={600}>
      <Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Translate color="primary" />
              Text Tokenization
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Generate commands to tokenize texts in a Solr collection using
              Chinese segmenter
            </Typography>
          </Box>
          <Tooltip title="Show CLI Help">
            <IconButton onClick={() => setHelpOpen(true)} color="primary">
              <Help />
            </IconButton>
          </Tooltip>
        </Box>

        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Settings />
              Configuration
            </Typography>
            {loading && <LinearProgress sx={{ mb: 2 }} />}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!selectedSolrDb}>
                  <InputLabel>Solr Database</InputLabel>
                  <Select
                    value={selectedSolrDb?.id ?? ""}
                    label="Solr Database"
                    onChange={(e) =>
                      setSelectedSolrDb(
                        solrDatabases.find(
                          (db) => db.id === Number(e.target.value),
                        ) || null,
                      )
                    }
                  >
                    {solrDatabases.map((db) => (
                      <MenuItem key={db.id} value={db.id}>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Memory fontSize="small" />
                          {db.name}
                          <Chip
                            label={`ID: ${db.id}`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={aliases}
                  value={collectionName}
                  inputValue={collectionName}
                  onInputChange={(_, v) => setCollectionName(v)}
                  onChange={(_, v) => setCollectionName(v || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Collection Name"
                      required
                      error={!collectionName}
                      helperText={!collectionName && "Required"}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="Solr Host"
                  value={solrHost}
                  onChange={(e) => setSolrHost(e.target.value)}
                  fullWidth
                  required
                  error={!solrHost}
                  helperText={!solrHost && "Required"}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="Solr Port"
                  type="number"
                  value={solrPort}
                  onChange={(e) =>
                    setSolrPort(e.target.value === "" ? "" : +e.target.value)
                  }
                  fullWidth
                  required
                  error={solrPort === ""}
                  helperText={solrPort === "" && "Required"}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Cache Output Directory"
                  value={cacheDir}
                  onChange={(e) => setCacheDir(e.target.value)}
                  fullWidth
                  required
                  error={!cacheDir}
                  helperText={!cacheDir && "Required"}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="Model Name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  fullWidth
                  required
                  disabled
                  helperText="Default: cwseg (only implementation available)"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="Model Type"
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  fullWidth
                  required
                  disabled
                  helperText="Default: chinese_segmenter (only implementation available)"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Text Field</InputLabel>
                  <Select
                    value={textField || ""}
                    onChange={(e) => setTextField(e.target.value)}
                    label="Text Field"
                    disabled={availableFields.length === 0}
                    required
                    error={!textField}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {availableFields.map((field) => (
                      <MenuItem key={field} value={field}>
                        {field}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={!isFormValid}
                  startIcon={<PlayArrow />}
                  fullWidth
                  size="large"
                  sx={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                    },
                  }}
                >
                  Generate Tokenization Commands
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Dialog
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Help />
            tokenize-solr — Command‐Line Arguments
          </DialogTitle>
          <DialogContent dividers>
            <List dense>
              {Object.entries(ARG_DESCRIPTIONS).map(([arg, desc]) => (
                <ListItem key={arg} alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Chip
                        label={arg}
                        variant="outlined"
                        size="small"
                        sx={{ fontFamily: "monospace" }}
                      />
                    }
                    secondary={desc}
                  />
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHelpOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {tokenizeCommand && (
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 3,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <Code />
                    Tokenize Command
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Copy Tokenize Command">
                      <IconButton
                        onClick={() =>
                          navigator.clipboard.writeText(tokenizeCommand)
                        }
                      >
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Save to File">
                      <IconButton
                        onClick={() => {
                          const blob = new Blob([tokenizeCommand], {
                            type: "text/plain",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `tokenize_command_${collectionName}.sh`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                <Paper
                  sx={{
                    p: 2,
                    bgcolor: "grey.50",
                    border: "1px solid",
                    borderColor: "grey.200",
                  }}
                >
                  <TextField
                    multiline
                    fullWidth
                    minRows={3}
                    value={tokenizeCommand}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: "monospace", fontSize: "0.875rem" },
                    }}
                    variant="outlined"
                  />
                </Paper>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 3,
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <Code />
                    Upload Command
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Copy Upload Command">
                      <IconButton
                        onClick={() =>
                          navigator.clipboard.writeText(uploadCommand)
                        }
                      >
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Save to File">
                      <IconButton
                        onClick={() => {
                          const blob = new Blob([uploadCommand], {
                            type: "text/plain",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `upload_command_${collectionName}.sh`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                <Paper
                  sx={{
                    p: 2,
                    bgcolor: "grey.50",
                    border: "1px solid",
                    borderColor: "grey.200",
                  }}
                >
                  <TextField
                    multiline
                    fullWidth
                    minRows={3}
                    value={uploadCommand}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: "monospace", fontSize: "0.875rem" },
                    }}
                    variant="outlined"
                  />
                </Paper>
              </CardContent>
            </Card>

            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<GetApp />}
                onClick={() => {
                  const fullScript = `#!/bin/bash\n\n# Tokenize Command\n${tokenizeCommand}\n\n# Check if tokenize command was successful\nif [ $? -eq 0 ]; then\n  echo "Tokenization completed successfully. Starting upload..."\n  # Upload Command\n  ${uploadCommand}\nelse\n  echo "Tokenization failed. Upload skipped."\n  exit 1\nfi`;

                  const blob = new Blob([fullScript], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `run_tokenize_pipeline_${collectionName}.sh`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                size="large"
              >
                Download Complete Shell Script
              </Button>
            </Box>
          </Stack>
        )}
      </Box>
    </Fade>
  );
};

export default TokenizeSolr;
