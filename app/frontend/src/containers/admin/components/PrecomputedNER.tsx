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
  Alert,
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
  SmartToy,
} from "@mui/icons-material";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

interface SolrDatabase {
  id: number;
  name: string;
}

/**
 * Maps CLI arguments to their descriptions for the help dialog.
 */
const ARG_DESCRIPTIONS: Record<string, string> = {
  "solr-host": "Solr host (default: localhost)",
  "solr-port": "Solr port (default: 8983)",
  "cache-dir": "Root directory where JSONL will be cached",
  ner: "Command to precompute NER for a collection",
  collection: "Solr collection name",
  "model-name": "Model name or path to use for NER",
  "model-type": "Type of model to use (spacy, transformers, etc.)",
  "text-field": "Solr field containing plain text",
  "filter-query": "Additional Solr fq to restrict documents",
  "batch-size": "Number of Solr docs per batch",
  "num-batches": "Limit number of batches (None = all)",
  "entity-types":
    "Entity types to extract (Person, Organization, Location, etc.)",
  upload: "Command to upload processed files to Solr",
  schema: "Schema file to use for upload",
  "compact-labels": "Use compact labels for smaller file sizes",
  "label-stats": "Show label distribution statistics",
};

/**
 * Model type configurations with preset model names
 */
const MODEL_CONFIGURATIONS = {
  spacy: {
    label: "spaCy",
    description: "Fast, production-ready NER",
    presets: [
      "en_core_web_sm",
      "en_core_web_md",
      "en_core_web_lg",
      "en_core_web_trf",
      "zh_core_web_sm",
      "de_core_news_sm",
      "fr_core_news_sm",
      "es_core_news_sm",
      "ja_core_news_sm",
      "ko_core_news_sm",
    ],
    default: "en_core_web_sm",
  },
  transformers: {
    label: "Transformers (HuggingFace)",
    description: "State-of-the-art transformer models",
    presets: [
      "xlm-roberta-large-finetuned-conll03-english",
      "xlm-roberta-base-finetuned-conll03-english",
      "dbmdz/bert-base-historic-multilingual-cased",
      "ckiplab/bert-base-chinese-ner",
      "cl-tohoku/bert-base-japanese-char-whole-word-masking",
      "klue/bert-base",
      "aubmindlab/bert-base-arabertv2",
      "bert-base-multilingual-cased",
      "distilbert-base-multilingual-cased",
    ],
    default: "xlm-roberta-base-finetuned-conll03-english",
  },
  gliner: {
    label: "GLiNER",
    description: "Zero-shot entity recognition",
    presets: [
      "urchade/gliner_mediumv2.1",
      "urchade/gliner_largev2.1",
      "urchade/gliner_small-v2.1",
      "numind/NuNerZero",
    ],
    default: "urchade/gliner_mediumv2.1",
  },
  stanza: {
    label: "Stanza",
    description: "Multilingual NLP (50+ languages)",
    presets: ["en", "zh-hans", "ja", "ko", "de", "fr", "es", "ru", "ar", "hi"],
    default: "en",
  },
  flair: {
    label: "Flair",
    description: "Research-grade NER",
    presets: [
      "ner",
      "ner-large",
      "ner-ontonotes",
      "ner-ontonotes-large",
      "ner-multi",
      "ner-multi-fast",
      "ner-german",
      "ner-german-large",
    ],
    default: "ner",
  },
  llm_ner: {
    label: "LLM NER",
    description: "Large Language Models for NER",
    presets: [
      "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
      "microsoft/DialoGPT-medium",
      "microsoft/Phi-3-mini-4k-instruct",
      "Qwen/Qwen-7B-Chat",
      "mistralai/Mistral-7B-Instruct-v0.3",
    ],
    default: "microsoft/DialoGPT-medium",
  },
  multilingual: {
    label: "Auto Multilingual",
    description: "Best multilingual model selection",
    presets: ["auto", "multilingual", "historical"],
    default: "auto",
  },
  fastnlp: {
    label: "FastNLP",
    description: "High-performance Chinese NLP",
    presets: [
      "ner-msra",
      "ner-ontonotes",
      "ner-weibo",
      "cws-pku",
      "en-ner-conll",
    ],
    default: "ner-msra",
  },
  fasthan: {
    label: "FastHan",
    description: "Fast Chinese NER",
    presets: ["base", "large", "small"],
    default: "base",
  },
  lac: {
    label: "Baidu LAC",
    description: "Chinese lexical analysis",
    presets: ["lac"],
    default: "lac",
  },
};

/**
 * useAuthAxios
 *
 * Returns an Axios instance with Authorization header set.
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
 * PrecomputeNER
 *
 * UI to generate command lines for precomputing and uploading NER data from a Solr collection.
 * Allows the user to configure all relevant options, get the full CLI, and download a script.
 */
const PrecomputeNER: React.FC = () => {
  const authAxios = useAuthAxios();

  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedSolrDb, setSelectedSolrDb] = useState<SolrDatabase | null>(
    null,
  );
  const [collectionName, setCollectionName] = useState("");

  const [solrHost, setSolrHost] = useState("localhost");
  const [solrPort, setSolrPort] = useState<number | "">(8983);
  const [cacheDir, setCacheDir] = useState("./cache");

  const [modelType, setModelType] = useState("transformers");
  const [modelName, setModelName] = useState("");
  const [textField, setTextField] = useState("");
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  const [filterQuery, setFilterQuery] = useState("");
  const [batchSize, setBatchSize] = useState<number | "">(1000);
  const [nbatches, setNbatches] = useState<number | "">("");
  const [entityTypes, setEntityTypes] = useState<string[]>([
    "Person",
    "Organization",
    "Location",
  ]);
  const [useCompactLabels, setUseCompactLabels] = useState(true);
  const [showLabelStats, setShowLabelStats] = useState(false);

  const [nerCommand, setNerCommand] = useState("");
  const [uploadCommand, setUploadCommand] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Available entity types
  const availableEntityTypes = [
    "Person",
    "Organization",
    "Location",
    "Date",
    "Time",
    "Money",
    "Percent",
    "Product",
    "Event",
    "Miscellaneous",
    "GPE",
    "NORP",
    "FAC",
    "WORK_OF_ART",
    "LAW",
    "LANGUAGE",
  ];

  // Set default model name when model type changes
  useEffect(() => {
    if (
      modelType &&
      MODEL_CONFIGURATIONS[modelType as keyof typeof MODEL_CONFIGURATIONS]
    ) {
      const config =
        MODEL_CONFIGURATIONS[modelType as keyof typeof MODEL_CONFIGURATIONS];
      setModelName(config.default);
    }
  }, [modelType]);

  // Load available Solr databases
  useEffect(() => {
    authAxios
      .get("/api/solr_databases")
      .then(({ data }) => setSolrDatabases(data))
      .catch(() => setSolrDatabases([]));
  }, [authAxios]);

  // Load aliases when a database is selected
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

  // Load available fields when a collection is chosen
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
   * Returns true if the form is valid and a command can be generated.
   */
  const isFormValid = useMemo(() => {
    return (
      !!collectionName &&
      !!modelName &&
      !!modelType &&
      !!textField &&
      !!cacheDir &&
      !!solrHost &&
      solrPort !== ""
    );
  }, [
    collectionName,
    modelName,
    modelType,
    textField,
    cacheDir,
    solrHost,
    solrPort,
  ]);

  /**
   * Generates cache model name from model name
   */
  const getCacheModelName = (modelName: string): string => {
    // Remove special characters and replace with underscores
    return modelName
      .replace(/[\/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/[^\w\-_.]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  };

  /**
   * Generates the NER and upload command lines and saves them in state.
   */
  const handleGenerate = () => {
    const cacheModelName = getCacheModelName(modelName);

    // Build NER command
    let nerCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} --cache-dir "${cacheDir}" ner "${collectionName}" --model-name "${modelName}" --model-type "${modelType}" --text-field "${textField}"`;

    // Add optional parameters
    if (filterQuery) {
      nerCmd += ` --filter-query "${filterQuery}"`;
    }
    if (batchSize !== "") {
      nerCmd += ` --batch-size ${batchSize}`;
    }
    if (nbatches !== "") {
      nerCmd += ` --num-batches ${nbatches}`;
    }
    if (entityTypes.length > 0) {
      nerCmd += ` --entity-types ${entityTypes.join(" ")}`;
    }
    if (useCompactLabels) {
      nerCmd += ` --compact-labels`;
    } else {
      nerCmd += ` --full-labels`;
    }
    if (showLabelStats) {
      nerCmd += ` --label-stats`;
    }

    setNerCommand(nerCmd);

    // Generate upload command
    const uploadCmd = `python -m histtext_toolkit.main --solr-host ${solrHost} --solr-port ${solrPort} upload "${collectionName}-ner" "${cacheDir}/${cacheModelName}/${collectionName}/${textField}/*.jsonl" --schema "${cacheDir}/${collectionName}-ner.yaml"`;

    setUploadCommand(uploadCmd);
  };

  /**
   * Get current model configuration
   */
  const currentModelConfig = useMemo(() => {
    return (
      MODEL_CONFIGURATIONS[modelType as keyof typeof MODEL_CONFIGURATIONS] ||
      null
    );
  }, [modelType]);

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
              <SmartToy color="primary" />
              Named Entity Recognition
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Generate commands to precompute NER for texts in a Solr collection
            </Typography>
          </Box>
          <Tooltip title="Show CLI Help">
            <IconButton onClick={() => setHelpOpen(true)} color="primary">
              <Help />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Configuration Form */}
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

              {/* Cache Output Directory */}
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

              {/* Model Type Selection */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!modelType}>
                  <InputLabel>Model Type</InputLabel>
                  <Select
                    value={modelType}
                    label="Model Type"
                    onChange={(e) => setModelType(e.target.value)}
                  >
                    {Object.entries(MODEL_CONFIGURATIONS).map(
                      ([type, config]) => (
                        <MenuItem key={type} value={type}>
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <SmartToy fontSize="small" />
                              {config.label}
                            </Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {config.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              </Grid>

              {/* Model Name Selection */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={currentModelConfig?.presets || []}
                  value={modelName}
                  inputValue={modelName}
                  onInputChange={(_, v) => setModelName(v)}
                  onChange={(_, v) => setModelName(v || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Model Name"
                      required
                      error={!modelName}
                      helperText={
                        !modelName
                          ? "Required"
                          : currentModelConfig
                            ? `${currentModelConfig.description} - Type to add custom model`
                            : "Enter model name or path"
                      }
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body2">{option}</Typography>
                        {option === currentModelConfig?.default && (
                          <Chip
                            label="Recommended"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                />
              </Grid>

              {/* Text Field Selection */}
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

              {/* Entity Types Selection */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={availableEntityTypes}
                  value={entityTypes}
                  onChange={(_, newValue) => setEntityTypes(newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        {...getTagProps({ index })}
                        key={option}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Entity Types"
                      placeholder="Select entity types to extract"
                      helperText="Leave empty to extract all types"
                    />
                  )}
                />
              </Grid>

              {/* Advanced Options */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Filter Query (optional)"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  fullWidth
                  helperText="Solr filter query to restrict documents"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="Batch Size"
                  type="number"
                  value={batchSize}
                  onChange={(e) =>
                    setBatchSize(e.target.value === "" ? "" : +e.target.value)
                  }
                  fullWidth
                  helperText="Documents per batch"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  label="Max Batches (optional)"
                  type="number"
                  value={nbatches}
                  onChange={(e) =>
                    setNbatches(e.target.value === "" ? "" : +e.target.value)
                  }
                  fullWidth
                  helperText="Limit number of batches"
                />
              </Grid>

              {/* Options */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <FormControl>
                    <InputLabel>Label Format</InputLabel>
                    <Select
                      value={useCompactLabels ? "compact" : "full"}
                      onChange={(e) =>
                        setUseCompactLabels(e.target.value === "compact")
                      }
                      label="Label Format"
                      size="small"
                    >
                      <MenuItem value="compact">
                        Compact (P, O, L) - Smaller files
                      </MenuItem>
                      <MenuItem value="full">Full (PERSON, ORG, LOC)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <InputLabel>Statistics</InputLabel>
                    <Select
                      value={showLabelStats ? "yes" : "no"}
                      onChange={(e) =>
                        setShowLabelStats(e.target.value === "yes")
                      }
                      label="Statistics"
                      size="small"
                    >
                      <MenuItem value="no">No statistics</MenuItem>
                      <MenuItem value="yes">Show label distribution</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>

              {/* Generate Button */}
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
                  Generate NER Commands
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Help Dialog */}
        <Dialog
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Help />
            histtext_toolkit.main — Command‐Line Arguments
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

        {/* NER & Upload Command Output */}
        {nerCommand && (
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
                    NER Command
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Copy NER Command">
                      <IconButton
                        onClick={() =>
                          navigator.clipboard.writeText(nerCommand)
                        }
                      >
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Save to File">
                      <IconButton
                        onClick={() => {
                          const blob = new Blob([nerCommand], {
                            type: "text/plain",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `ner_command_${collectionName}.sh`;
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
                    value={nerCommand}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: "monospace", fontSize: "0.875rem" },
                    }}
                    variant="outlined"
                  />
                </Paper>

                {/* Show cache model name info */}
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Cache Model Name:</strong>{" "}
                    {getCacheModelName(modelName)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Automatically generated from model name for file system
                    compatibility
                  </Typography>
                </Alert>
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
                  const fullScript = `#!/bin/bash

# Named Entity Recognition Pipeline
# Generated for collection: ${collectionName}
# Model: ${modelName} (${modelType})
# Cache Model Name: ${getCacheModelName(modelName)}

echo "Starting NER pipeline for collection: ${collectionName}"
echo "Using model: ${modelName} (${modelType})"
echo "Cache directory: ${cacheDir}"
echo ""

# NER Command
echo "Step 1: Running NER extraction..."
${nerCommand}

# Check if NER command was successful
if [ $? -eq 0 ]; then
 echo ""
 echo "✅ NER processing completed successfully!"
 echo "Step 2: Starting upload to Solr..."
 echo ""
 
 # Upload Command
 ${uploadCommand}
 
 if [ $? -eq 0 ]; then
   echo ""
   echo "✅ Upload completed successfully!"
   echo "NER data is now available in collection: ${collectionName}-ner"
   echo ""
   echo "You can now query the NER results using:"
   echo "  - Field 't': Entity text"
   echo "  - Field 'l': Entity label${useCompactLabels ? " (compact format: P=Person, O=Organization, L=Location, etc.)" : ""}"
   echo "  - Field 's': Start position"
   echo "  - Field 'e': End position" 
   echo "  - Field 'c': Confidence score"
   echo "  - Field 'doc_id': Original document ID"
 else
   echo "❌ Upload failed!"
   exit 1
 fi
else
 echo "❌ NER processing failed! Upload skipped."
 exit 1
fi

echo ""
echo "🎉 NER pipeline completed successfully!"`;

                  const blob = new Blob([fullScript], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `ner_pipeline_${collectionName}_${modelType}.sh`;
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

            {/* Additional Information */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📋 Pipeline Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Model Configuration:</strong>
                    </Typography>
                    <Typography variant="body2">
                      • Type: {currentModelConfig?.label || modelType}
                    </Typography>
                    <Typography variant="body2">
                      • Model: {modelName}
                    </Typography>
                    <Typography variant="body2">
                      • Cache Name: {getCacheModelName(modelName)}
                    </Typography>
                    <Typography variant="body2">
                      • Description:{" "}
                      {currentModelConfig?.description || "Custom model"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Output Configuration:</strong>
                    </Typography>
                    <Typography variant="body2">
                      • Label Format:{" "}
                      {useCompactLabels
                        ? "Compact (P, O, L, ...)"
                        : "Full (PERSON, ORG, LOC, ...)"}
                    </Typography>
                    <Typography variant="body2">
                      • Entity Types:{" "}
                      {entityTypes.length > 0
                        ? entityTypes.join(", ")
                        : "All types"}
                    </Typography>
                    <Typography variant="body2">
                      • Statistics: {showLabelStats ? "Enabled" : "Disabled"}
                    </Typography>
                    <Typography variant="body2">
                      • Target Collection: {collectionName}-ner
                    </Typography>
                  </Grid>
                </Grid>

                {useCompactLabels && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Compact Labels Mapping:</strong> P=Person,
                      O=Organization, L=Location, G=GPE, N=NORP, F=Facility,
                      PR=Product, E=Event, W=Work of Art, LA=Law, D=Date,
                      T=Time, M=Money, PE=Percent, Q=Quantity, OR=Ordinal,
                      C=Cardinal, LG=Language, MI=Miscellaneous
                    </Typography>
                  </Alert>
                )}

                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Next Steps:</strong>
                  </Typography>
                  <Typography variant="body2">
                    1. Run the NER command to process your documents
                  </Typography>
                  <Typography variant="body2">
                    2. Check the cache directory for generated JSONL files
                  </Typography>
                  <Typography variant="body2">
                    3. Run the upload command to load results into Solr
                  </Typography>
                  <Typography variant="body2">
                    4. Query the new collection "{collectionName}-ner" for NER
                    results (Optional)
                  </Typography>
                  <Typography variant="body2">
                    5. The new collection "{collectionName}-ner" NER results
                    will be automatically link to "{collectionName}".
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Box>
    </Fade>
  );
};

export default PrecomputeNER;
