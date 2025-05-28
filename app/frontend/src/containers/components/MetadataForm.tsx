// app/frontend/src/containers/components/MetadataForm.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Grid,
  Alert,
  Chip
} from '@mui/material';
import { PlayArrow, QueryStats, CheckCircle } from '@mui/icons-material';
import axios from 'axios';
import config from '../../../config.json';
import { buildQueryString } from './buildQueryString';
import { useAuth } from '../../hooks/useAuth';
import { useEmbeddings } from './MetadataForm/hooks/useEmbeddings';
import { useSmartValidation } from '../../hooks/useSmartValidation';
import { shouldExcludeField, isTextField, sortFieldsByPriority } from './MetadataForm/utils/fieldUtils';
import FormHeader from './MetadataForm/components/FormHeader';
import FormField from './MetadataForm/components/FormField';
import DateRangeField from './MetadataForm/components/DateRangeField';
import QueryOptions from './MetadataForm/components/QueryOptions';
import CodeGeneration from './MetadataForm/components/CodeGeneration';
import EmbeddingTools from './MetadataForm/components/EmbeddingTools';

type StatsLevel = (typeof config.statsLevelOptions)[number];
type DocLevel = (typeof config.docLevelOptions)[number];

interface CollectionInfo {
  solr_database_id: number;
  collection_name: string;
  description: string;
  embeddings: string;
  lang: string | null;
  text_field: string;
  tokenizer: string | null;
  to_not_display: string[];
}

interface MetadataFormProps {
  metadata: any[];
  formData: {
    [key: string]: { value: string; operator: string; not?: boolean }[];
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    [key: string]: { value: string; operator: string; not?: boolean }[];
  }>>;
  dateRange: { min: string; max: string } | null;
  handleQuery: (
    e: React.FormEvent,
    onlyComputeStats: boolean,
    getNER: boolean,
    downloadOnly: boolean,
    statsLevel: StatsLevel,
    docLevel: DocLevel,
  ) => void;
  getNER: boolean;
  setGetNER: React.Dispatch<React.SetStateAction<boolean>>;
  downloadOnly: boolean;
  setdownloadOnly: React.Dispatch<React.SetStateAction<boolean>>;
  statsLevel: StatsLevel;
  setStatsLevel: React.Dispatch<React.SetStateAction<StatsLevel>>;
  docLevel: DocLevel;
  setDocLevel: React.Dispatch<React.SetStateAction<DocLevel>>;
  solrDatabaseId: number | null;
  selectedAlias: string;
}

const MetadataForm: React.FC<MetadataFormProps> = ({
  metadata,
  formData,
  setFormData,
  dateRange,
  handleQuery,
  getNER,
  setGetNER,
  downloadOnly,
  setdownloadOnly,
  statsLevel,
  setStatsLevel,
  docLevel,
  setDocLevel,
  solrDatabaseId,
  selectedAlias,
}) => {
  const { accessToken } = useAuth();
  const [collectionInfo, setCollectionInfo] = useState<CollectionInfo | null>(null);
  const [hasEmbeddings, setHasEmbeddings] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEmbeddingAlert, setShowEmbeddingAlert] = useState(false);
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);

  // Custom hooks
  const {
    neighbors,
    loadingNeighbors,
    similarityResult,
    analogyResult,
    embeddingLoading,
    getNeighbors,
    removeNeighborDropdown,
    getSimilarity,
    getAnalogy,
    setSimilarityResult,
    setAnalogyResult
  } = useEmbeddings(solrDatabaseId, selectedAlias, accessToken, hasEmbeddings);

  // Smart validation hook
  const { validateField, formValidation } = useSmartValidation(formData, metadata, collectionInfo);

  // Fetch collection info
  useEffect(() => {
    if (solrDatabaseId && selectedAlias) {
      axios
        .get(`/api/solr_database_info/${solrDatabaseId}/${selectedAlias}`)
        .then(response => {
          setCollectionInfo(response.data);
          setHasEmbeddings(response.data.embeddings !== 'none');
          if (response.data.embeddings !== 'none') {
            setShowEmbeddingAlert(true);
          }
        })
        .catch(error => {
          console.error('Failed to fetch collection info:', error);
          setCollectionInfo(null);
          setHasEmbeddings(false);
        });
    } else {
      setCollectionInfo(null);
      setHasEmbeddings(false);
    }
  }, [solrDatabaseId, selectedAlias]);

  // Initialize form data
  useEffect(() => {
    const initializedFormData: any = {};
    metadata.forEach((field: any) => {
      if (!formData[field.name]) {
        initializedFormData[field.name] = [{ value: '', operator: '', not: false }];
      }
    });
    setFormData((prevData: any) => ({ ...prevData, ...initializedFormData }));
  }, [metadata, setFormData, formData]);

  // Handlers
  const handleFormChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>,
    index: number,
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name!]: (prev[name!] || []).map((entry, i) =>
        i === index ? { ...entry, value: value.toString() } : entry,
      ),
    }));
  }, [setFormData]);

  const handleSelectChange = useCallback((fieldName: string, newValue: string | null, index: number = 0) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).map((entry, i) =>
        i === index ? { ...entry, value: newValue || '' } : entry,
      ),
    }));
  }, [setFormData]);

  const addBooleanField = useCallback((name: string, operator: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: [...(prev[name] || []), { value: '', operator, not: false }],
    }));
  }, [setFormData]);

  const removeBooleanField = useCallback((name: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [name]: (prev[name] || []).filter((_, i) => i !== index),
    }));
  }, [setFormData]);

  const toggleNotCondition = useCallback((name: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [name]: (prev[name] || []).map((entry, i) =>
        i === index ? { ...entry, not: !entry.not } : entry,
      ),
    }));
  }, [setFormData]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (formValidation.canSubmit) {
      handleQuery(e, false, getNER, downloadOnly, statsLevel, docLevel);
    }
  }, [handleQuery, getNER, downloadOnly, statsLevel, docLevel, formValidation.canSubmit]);

  const handleOpenEmbeddingModal = useCallback(() => {
    setEmbeddingModalOpen(true);
  }, []);

  const handleCloseEmbeddingModal = useCallback(() => {
    setEmbeddingModalOpen(false);
  }, []);

  // Filter and sort fields
  const visibleFields = sortFieldsByPriority(
    metadata.filter(field => !shouldExcludeField(field.name, collectionInfo))
  );

  return (
    <Box sx={{ width: '100%' }}>
      <FormHeader
        hasEmbeddings={hasEmbeddings}
        showEmbeddingAlert={showEmbeddingAlert}
        onShowEmbeddingAlert={setShowEmbeddingAlert}
        onOpenEmbeddingModal={handleOpenEmbeddingModal}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QueryStats />
              Search Fields
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {visibleFields.map(field => (
                <Grid item xs={12} md={6} lg={4} key={field.name}>
                  <FormField
                    field={field}
                    formData={formData}
                    collectionInfo={collectionInfo}
                    hasEmbeddings={hasEmbeddings}
                    neighbors={neighbors}
                    loadingNeighbors={loadingNeighbors}
                    metadata={metadata}
                    onFormChange={handleFormChange}
                    onSelectChange={handleSelectChange}
                    onToggleNot={toggleNotCondition}
                    onAddBooleanField={addBooleanField}
                    onRemoveBooleanField={removeBooleanField}
                    onFetchNeighbors={getNeighbors}
                    onRemoveNeighborDropdown={removeNeighborDropdown}
                  />
                </Grid>
              ))}
            </Grid>

            <DateRangeField
              dateRange={dateRange}
              formData={formData}
              onFormChange={handleFormChange}
            />

            <QueryOptions
              getNER={getNER}
              setGetNER={setGetNER}
              downloadOnly={downloadOnly}
              setDownloadOnly={setdownloadOnly}
              statsLevel={statsLevel}
              setStatsLevel={setStatsLevel}
              docLevel={docLevel}
              setDocLevel={setDocLevel}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
            />

            {/* Form Validation Summary */}
            <Box sx={{ mb: 3 }}>
              <Alert 
                severity={
                  formValidation.overallStatus === 'error' ? 'error' :
                  formValidation.overallStatus === 'ready' ? 'success' : 'info'
                }
                sx={{ mb: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">
                    {formValidation.summary}
                  </Typography>

                </Box>
              </Alert>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="contained" 
                color="primary" 
                type="submit"
                size="large"
                startIcon={<PlayArrow />}
                disabled={!formValidation.canSubmit}
                sx={{ 
                  minWidth: 120,
                  opacity: formValidation.canSubmit ? 1 : 0.6,
                  cursor: formValidation.canSubmit ? 'pointer' : 'not-allowed'
                }}
              >
                Execute Query
              </Button>
              
              {solrDatabaseId && (
                <CodeGeneration
                  formData={formData}
                  dateRange={dateRange}
                  selectedAlias={selectedAlias}
                  solrDatabaseId={solrDatabaseId}
                  getNER={getNER}
                  downloadOnly={downloadOnly}
                  statsLevel={statsLevel}
                  accessToken={accessToken}
                />
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <EmbeddingTools
        hasEmbeddings={hasEmbeddings}
        embeddingLoading={embeddingLoading}
        similarityResult={similarityResult}
        analogyResult={analogyResult}
        onGetSimilarity={getSimilarity}
        onGetAnalogy={getAnalogy}
        externalModalOpen={embeddingModalOpen}
        onExternalModalClose={handleCloseEmbeddingModal}
      />
    </Box>
  );
};

export default MetadataForm;