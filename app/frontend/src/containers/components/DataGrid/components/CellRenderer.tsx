import React, { useMemo } from "react";
import { Box, Chip } from "@mui/material";
import { isIdField, processContent } from "../utils";

/**
 * Props for the CellRenderer component, which renders table/grid cell values.
 */
interface CellRendererProps {
  value: any;
  colDef: any;
  data: any;
  nerData: any;
  viewNER: boolean;
  formData: any;
  onIdClick: (id: string) => void;
  showConcordance?: boolean;
  mainTextColumn?: string;
}

/**
 * Renders a cell value for a table or grid.
 * - Renders ID fields as clickable, styled boxes.
 * - Uses processContent for NER/highlight and other formatting.
 * - Handles text, NER tags, highlights, and plain spans.
 *
 * @param props - CellRendererProps
 * @returns Rendered cell content or null if value is empty.
 */
const CellRenderer: React.FC<CellRendererProps> = React.memo((props) => {
  const {
    value,
    colDef,
    data,
    nerData,
    viewNER,
    formData,
    onIdClick,
    showConcordance = false,
    mainTextColumn,
  } = props;

  const field = colDef.field;
  const isId = useMemo(() => isIdField(field), [field]);

  const processedContent = useMemo(() => {
    return processContent(
      value,
      field,
      data,
      nerData,
      viewNER,
      formData,
      showConcordance,
      mainTextColumn || "",
    );
  }, [
    value,
    field,
    data,
    nerData,
    viewNER,
    formData,
    showConcordance,
    mainTextColumn,
  ]);

  if (!value && value !== 0) return null;

  if (isId) {
    return (
      <Box
        onClick={() => onIdClick(String(value))}
        sx={{
          cursor: "pointer",
          color: "primary.main",
          textDecoration: "underline",
          fontWeight: "bold",
          padding: "4px",
          "&:hover": {
            backgroundColor: "primary.light",
            color: "primary.contrastText",
            borderRadius: 1,
          },
        }}
      >
        {String(value)}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        lineHeight: 1.4,
        width: "100%",
        padding: "6px 8px",
        fontSize: "0.875rem",
      }}
    >
      {processedContent?.map((element, index) => {
        if (element.type === "ner") {
          return (
            <Chip
              key={element.key || `ner-${index}`}
              label={`${element.content} (${element.label})`}
              size="small"
              sx={{
                backgroundColor: element.color,
                color: "white",
                margin: "2px",
                fontWeight: 500,
                fontSize: "0.75rem",
              }}
            />
          );
        } else if (element.type === "highlight") {
          return (
            <Box
              key={element.key || `highlight-${index}`}
              component="span"
              sx={{
                backgroundColor: "#fbbf24",
                color: "#92400e",
                padding: "2px 6px",
                borderRadius: 1,
                fontWeight: 700,
                border: "1px solid #f59e0b",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                textShadow: "0 1px 1px rgba(255,255,255,0.5)",
                display: "inline-block",
                margin: "0 1px",
              }}
            >
              {String(element.content)}
            </Box>
          );
        } else {
          return <span key={`text-${index}`}>{String(element.content)}</span>;
        }
      })}
    </Box>
  );
});

CellRenderer.displayName = "CellRenderer";

export default CellRenderer;
