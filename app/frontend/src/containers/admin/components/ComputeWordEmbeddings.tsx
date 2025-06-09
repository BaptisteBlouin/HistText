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
  Checkbox,
  FormControlLabel,
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
  Psychology,
  Settings,
  PlayArrow,
  GetApp,
  Code,
  Memory,
} from "@mui/icons-material";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

interface SolrDatabase {
  id: number;
  name: string;
}

/**
 * Maps argument names to help descriptions for CLI generation.
 */
const ARG_DESCRIPTIONS: Record<string, string> = {
  "solr-host": "Solr host (default: localhost)",
  "solr-port": "Solr port (default: 8983)",
  "compute-word-embeddings":
    "Command to compute word embeddings from a collection",
  collection: "Solr collection name",
  "output-file": "Output file path for the embeddings",
  "text-field": "Solr field containing plain text",
  "auto-config": "Automatically configure the embedding parameters",
  "no-header": "Skip header in output file",
};

/**
 * useAuthAxios
 *
 * Returns an Axios instance with the correct Authorization header.
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
 * ComputeWordEmbeddings
 *
 * UI for generating a command-line call to compute word embeddings from a Solr collection.
 *
 * - Loads databases and collections from API.
 * - Allows configuration of all options.
 * - Generates and displays the full CLI command for the user.
 */
const ComputeWordEmbeddings: React.FC = () => {
  const authAxios = useAuthAxios();

  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedSolrDb, setSelectedSolrDb] = useState<SolrDatabase | null>(
    null,
  );
  const [collectionName, setCollectionName] = useState("");

  const [solrHost, setSolrHost] = useState("localhost");
  const [solrPort, setSolrPort] = useState<number | "">(8983);
  const [outputDir, setOutputDir] = useState("");
  const [outputName, setOutputName] = useState("");

  const [textField, setTextField] = useState("");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [autoConfig, setAutoConfig] = useState(true);
  const [noHeader, setNoHeader] = useState(true);

  const [embeddingsCommand, setEmbeddingsCommand] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load available Solr databases from API
  useEffect(() => {
    authAxios
      .get("/api/solr_databases")
      .then(({ data }) => setSolrDatabases(data))
      .catch(() => setSolrDatabases([]));
  }, [authAxios]);

  // Load collection aliases when a database is selected
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
    setOutputName("");
  }, [selectedSolrDb, authAxios]);

  // Load available fields when a collection is chosen
  useEffect(() => {
    if (!collectionName) {
      setAvailableFields([]);
      return;
    }

    setOutputName(collectionName);

    if (!selectedSolrDb) {
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
   * Form is valid if all required fields are set.
   */
  const isFormValid = useMemo(() => {
    return (
      !!collectionName &&
      !!textField &&
      !!outputDir &&
      !!outputName &&
      !!solrHost &&
      solrPort !== ""
    );
  }, [collectionName, textField, outputDir, outputName, solrHost, solrPort]);

  /**
   * Generates the embeddings command and stores it in state.
   */
  const handleGenerate = () => {
    let embeddingsCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} compute-word-embeddings "${collectionName}" "${outputDir}/${outputName}" --text-field "${textField}"`;

    if (autoConfig) embeddingsCmd += ` --auto-config`;
    if (noHeader) embeddingsCmd += ` --no-header`;

    setEmbeddingsCommand(embeddingsCmd);
  };

  return (
    <Fade in={true} timeout={600}>
      <Box>
        {/* Header */}
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
              <Psychology color="primary" />
              Word Embeddings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Generate commands to compute word embeddings from texts in a Solr
              collection
            </Typography>
          </Box>
          <Tooltip title="Show CLI Help">
            <IconButton onClick={() => setHelpOpen(true)} color="primary">
              <Help />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Main Configuration Form */}
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
              {/* Solr Database Selection */}
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

              {/* Collection Name (alias) Selection */}
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

              {/* Solr Host */}
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

              {/* Solr Port */}
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

              {/* Output Directory */}
              <Grid item xs={12} md={3}>
                <TextField
                  label="Output Directory"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  fullWidth
                  required
                  error={!outputDir}
                  helperText={!outputDir && "Required"}
                />
              </Grid>

              {/* Output Name */}
              <Grid item xs={12} md={3}>
                <TextField
                  label="Output Name"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  fullWidth
                  required
                  error={!outputName}
                  helperText={
                    !outputName
                      ? "Required"
                      : "Default: same as Collection Name"
                  }
                />
              </Grid>

              {/* Text Field (from Solr collection metadata) */}
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

              {/* Extra options */}
              <Grid item xs={12} md={6}>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={autoConfig}
                        onChange={(e) => setAutoConfig(e.target.checked)}
                      />
                    }
                    label="Auto Config"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={noHeader}
                        onChange={(e) => setNoHeader(e.target.checked)}
                      />
                    }
                    label="No Header"
                  />
                </Stack>
              </Grid>

              {/* Generate Command Button */}
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
                  Generate Word Embeddings Command
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* CLI Help Dialog */}
        <Dialog
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Help />
            compute-word-embeddings — Command‐Line Arguments
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

        {/* Generated Command Output */}
        {embeddingsCommand && (
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
                  Generated Command
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Copy Command">
                    <IconButton
                      onClick={() =>
                        navigator.clipboard.writeText(embeddingsCommand)
                      }
                    >
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Save to File">
                    <IconButton
                      onClick={() => {
                        const blob = new Blob([embeddingsCommand], {
                          type: "text/plain",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `word_embeddings_command_${collectionName}.sh`;
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
                  value={embeddingsCommand}
                  InputProps={{
                    readOnly: true,
                    sx: { fontFamily: "monospace", fontSize: "0.875rem" },
                  }}
                  variant="outlined"
                />
              </Paper>

              <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<GetApp />}
                  onClick={() => {
                    const fullScript = `#!/bin/bash\n\n# Word Embeddings Command\n${embeddingsCommand}\n\nif [ $? -eq 0 ]; then\n  echo "Word embeddings computation completed successfully."\nelse\n  echo "Word embeddings computation failed."\n  exit 1\nfi\n\necho "Output saved to ${outputDir}/${outputName}"`;

                    const blob = new Blob([fullScript], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `run_word_embeddings_${collectionName}.sh`;
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
            </CardContent>
          </Card>
        )}
      </Box>
    </Fade>
  );
};

export default ComputeWordEmbeddings;
