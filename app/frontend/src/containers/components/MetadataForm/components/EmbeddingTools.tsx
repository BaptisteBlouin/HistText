import React, { useState, useEffect } from "react";
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Box,
  Zoom,
} from "@mui/material";
import { AutoAwesome, PlayArrow } from "@mui/icons-material";

/**
 * Props for the EmbeddingTools component.
 *
 * @property hasEmbeddings - Whether embeddings are available for the dataset.
 * @property embeddingLoading - Whether an embedding operation is currently running.
 * @property similarityResult - Result object for word similarity computation.
 * @property analogyResult - Result object for analogy computation.
 * @property onGetSimilarity - Handler to trigger similarity computation.
 * @property onGetAnalogy - Handler to trigger analogy computation.
 * @property externalModalOpen - (Optional) Controls modal open state externally.
 * @property onExternalModalClose - (Optional) Handler for external modal close event.
 */
interface EmbeddingToolsProps {
  hasEmbeddings: boolean;
  embeddingLoading: boolean;
  similarityResult: any;
  analogyResult: any;
  onGetSimilarity: (word1: string, word2: string) => void;
  onGetAnalogy: (wordA: string, wordB: string, wordC: string) => void;
  externalModalOpen?: boolean;
  onExternalModalClose?: () => void;
}

/**
 * Semantic analysis tools for word similarity and analogy using embeddings.
 * Displays a floating action button and modal with similarity and analogy forms and results.
 */
const EmbeddingTools: React.FC<EmbeddingToolsProps> = ({
  hasEmbeddings,
  embeddingLoading,
  similarityResult,
  analogyResult,
  onGetSimilarity,
  onGetAnalogy,
  externalModalOpen = false,
  onExternalModalClose,
}) => {
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [similarityWord1, setSimilarityWord1] = useState("");
  const [similarityWord2, setSimilarityWord2] = useState("");
  const [analogyWordA, setAnalogyWordA] = useState("");
  const [analogyWordB, setAnalogyWordB] = useState("");
  const [analogyWordC, setAnalogyWordC] = useState("");

  // Sync modal state with external controls if provided
  useEffect(() => {
    setEmbeddingModalOpen(externalModalOpen);
  }, [externalModalOpen]);

  const handleCloseModal = () => {
    setEmbeddingModalOpen(false);
    if (onExternalModalClose) {
      onExternalModalClose();
    }
  };

  const handleComputeSimilarity = () => {
    if (similarityWord1 && similarityWord2) {
      onGetSimilarity(similarityWord1, similarityWord2);
    }
  };

  const handleComputeAnalogy = () => {
    if (analogyWordA && analogyWordB && analogyWordC) {
      onGetAnalogy(analogyWordA, analogyWordB, analogyWordC);
    }
  };

  if (!hasEmbeddings) return null;

  return (
    <>
      <Zoom in={true}>
        <Fab
          color="secondary"
          aria-label="embedding tools"
          onClick={() => setEmbeddingModalOpen(true)}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
          }}
        >
          <AutoAwesome />
        </Fab>
      </Zoom>

      <Dialog
        open={embeddingModalOpen}
        onClose={handleCloseModal}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoAwesome />
          Semantic Analysis Tools
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  Word Similarity Analysis
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="First Word"
                      value={similarityWord1}
                      onChange={(e) => setSimilarityWord1(e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Second Word"
                      value={similarityWord2}
                      onChange={(e) => setSimilarityWord2(e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="contained"
                      onClick={handleComputeSimilarity}
                      disabled={
                        !similarityWord1 || !similarityWord2 || embeddingLoading
                      }
                      fullWidth
                      startIcon={
                        embeddingLoading ? (
                          <CircularProgress size={16} />
                        ) : (
                          <PlayArrow />
                        )
                      }
                    >
                      Compare
                    </Button>
                  </Grid>
                </Grid>
                {similarityResult && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Similarity between{" "}
                      <strong>"{similarityResult.word1}"</strong> and{" "}
                      <strong>"{similarityResult.word2}"</strong>:
                      <strong>
                        {" "}
                        {(similarityResult.similarity * 100).toFixed(1)}%
                      </strong>
                    </Typography>
                    {!similarityResult.both_found && (
                      <Typography variant="caption" color="warning.main">
                        Note: One or both words were not found in the embeddings
                      </Typography>
                    )}
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Word Analogy Solver
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Find relationships: A is to B as C is to ?
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="A"
                      value={analogyWordA}
                      onChange={(e) => setAnalogyWordA(e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="B"
                      value={analogyWordB}
                      onChange={(e) => setAnalogyWordB(e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="C"
                      value={analogyWordC}
                      onChange={(e) => setAnalogyWordC(e.target.value)}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <Typography variant="body2" sx={{ textAlign: "center" }}>
                      ?
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="contained"
                      onClick={handleComputeAnalogy}
                      disabled={
                        !analogyWordA ||
                        !analogyWordB ||
                        !analogyWordC ||
                        embeddingLoading
                      }
                      fullWidth
                      startIcon={
                        embeddingLoading ? (
                          <CircularProgress size={16} />
                        ) : (
                          <PlayArrow />
                        )
                      }
                    >
                      Solve
                    </Button>
                  </Grid>
                </Grid>
                {analogyResult && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>{analogyResult.analogy}</strong>
                    </Typography>
                    {analogyResult.candidates.length > 0 ? (
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 1,
                          mt: 1,
                        }}
                      >
                        {analogyResult.candidates.map(
                          (candidate: any, index: number) => (
                            <Chip
                              key={index}
                              label={`${candidate.word}${candidate.similarity ? ` (${(candidate.similarity * 100).toFixed(1)}%)` : ""}`}
                              variant={index === 0 ? "filled" : "outlined"}
                              color={index === 0 ? "primary" : "default"}
                              size="small"
                            />
                          ),
                        )}
                      </Box>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        No analogies found or words not in embeddings
                      </Alert>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default React.memo(EmbeddingTools);
