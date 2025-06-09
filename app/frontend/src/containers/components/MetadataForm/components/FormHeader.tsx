import React from "react";
import { Alert, Typography, Button, IconButton, Box } from "@mui/material";
import { AutoAwesome, Lightbulb, Close } from "@mui/icons-material";

/**
 * Props for the FormHeader component.
 *
 * @property hasEmbeddings - Whether the collection has word embeddings enabled.
 * @property showEmbeddingAlert - Whether to show the semantic search alert.
 * @property onShowEmbeddingAlert - Handler to show/hide the alert.
 * @property onOpenEmbeddingModal - Handler to open the embedding tools modal.
 */
interface FormHeaderProps {
  hasEmbeddings: boolean;
  showEmbeddingAlert: boolean;
  onShowEmbeddingAlert: (show: boolean) => void;
  onOpenEmbeddingModal: () => void;
}

/**
 * Banner alert for semantic search capabilities, shown when embeddings are available.
 * Displays an "Explore" button and dismiss action.
 */
const FormHeader: React.FC<FormHeaderProps> = ({
  hasEmbeddings,
  showEmbeddingAlert,
  onShowEmbeddingAlert,
  onOpenEmbeddingModal,
}) => {
  if (!hasEmbeddings || !showEmbeddingAlert) return null;

  return (
    <Alert
      severity="info"
      icon={<AutoAwesome />}
      action={
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            color="inherit"
            size="small"
            onClick={onOpenEmbeddingModal}
            startIcon={<Lightbulb />}
          >
            Explore
          </Button>
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => onShowEmbeddingAlert(false)}
          >
            <Close fontSize="inherit" />
          </IconButton>
        </Box>
      }
      sx={{ mb: 3 }}
    >
      <Typography variant="subtitle2" gutterBottom>
        Semantic Search Available
      </Typography>
      <Typography variant="body2">
        This collection has word embeddings enabled. Use the ⭐ button next to
        text fields for semantic search and explore advanced tools.
      </Typography>
    </Alert>
  );
};

export default React.memo(FormHeader);
