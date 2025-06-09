import React from "react";
import { Box, Grid } from "@mui/material";
import { processDocumentFields } from "../utils/documentUtils";
import NERHighlightBanner from "./NERHighlightBanner";
import DocumentField from "./DocumentField";

/**
 * Props for DocumentContent, which renders all fields for a document.
 */
interface DocumentContentProps {
  document: any;
  showNER: boolean;
  nerData?: any;
  documentId: string;
  expandedFields: Set<string>;
  copiedField: string | null;
  onToggleField: (fieldName: string) => void;
  onCopyField: (fieldName: string, content: string) => void;
}

/**
 * Renders the content of a document as a grid of DocumentField components,
 * with an NER highlight banner and support for field expand/copy actions.
 *
 * @param props - DocumentContentProps
 * @returns Document content UI for the sidebar or page.
 */
const DocumentContent: React.FC<DocumentContentProps> = React.memo(
  ({
    document,
    showNER,
    nerData,
    documentId,
    expandedFields,
    copiedField,
    onToggleField,
    onCopyField,
  }) => {
    const documentFields = processDocumentFields(document);
    const hasNERData = nerData && nerData[documentId];

    return (
      <Box sx={{ p: 3 }}>
        <NERHighlightBanner showNER={showNER} hasNERData={hasNERData} />

        <Grid container spacing={3}>
          {documentFields.map(([key, value]) => (
            <DocumentField
              key={key}
              fieldName={key}
              content={String(value)}
              isExpanded={expandedFields.has(key)}
              copiedField={copiedField}
              showNER={showNER}
              nerData={nerData}
              documentId={documentId}
              onToggleExpand={onToggleField}
              onCopyField={onCopyField}
            />
          ))}
        </Grid>
      </Box>
    );
  },
);

DocumentContent.displayName = "DocumentContent";

export default DocumentContent;
