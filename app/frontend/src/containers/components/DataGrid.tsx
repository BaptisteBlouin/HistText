import React, { useMemo, useRef, useCallback, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Button } from '@mui/material';
import { Download } from 'lucide-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import config from '../../../config.json';
import DocumentDetailsModal from './DocumentDetailsModal';

const viewNERFields = config.viewNERFields;
const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
const NERLABELS2FULL = config.NERLABELS2FULL;

// Array of possible ID field names to detect
const ID_FIELD_NAMES = [
  'id',
  'Id',
  'ID',
  'docId',
  'DocId',
  'documentId',
  'DocumentId',
  'identifier',
  'Identifier',
  'doc_id',
  'document_id',
  '_id',
];

const DataGridComponent = ({
  results,
  formData,
  nerData,
  viewNER,
  selectedAlias,
  selectedSolrDatabase,
  authAxios,
}) => {
  const gridRef = useRef();
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine if a field is an ID field
  const isIdField = fieldName => {
    return ID_FIELD_NAMES.some(
      idName =>
        fieldName === idName ||
        fieldName.toLowerCase() === idName.toLowerCase() ||
        fieldName.toLowerCase().includes('_id') ||
        fieldName.toLowerCase().includes('id_'),
    );
  };

  const getColumnSizes = useCallback(() => {
    if (results.length === 0) return {};

    const columnSizes = {};
    const fields = Object.keys(results[0])
      .filter(key => !(key.startsWith('_') && key.endsWith('_')))
      .filter(key => !key.startsWith('score'));

    fields.forEach(field => {
      const maxLength = Math.max(
        field.length,
        ...results.map(row => String(row[field] || '').length),
      );

      if (maxLength < 20) {
        columnSizes[field] = 0.4;
      } else if (maxLength < 40) {
        columnSizes[field] = 0.8;
      } else if (maxLength < 60) {
        columnSizes[field] = 1.2;
      } else {
        columnSizes[field] = 3;
      }
    });

    return columnSizes;
  }, [results]);

  const onGridReady = useCallback(() => {
    if (gridRef.current) {
      setTimeout(() => {
        gridRef.current.api.autoSizeAllColumns();
        gridRef.current.api.sizeColumnsToFit();
      }, 0);
    }
  }, []);

  // Handle click on ID field
  const handleIdClick = documentId => {
    setSelectedDocumentId(documentId);
    setIsModalOpen(true);
  };

  const rowData = useMemo(() => results.map((row, i) => ({ id: i, ...row })), [results]);
  const columnDefs = useMemo(() => {
    if (results.length === 0) return [];

    const columnSizes = getColumnSizes();

    return Object.keys(results[0])
      .filter(key => !(key.startsWith('_') && key.endsWith('_')))
      .filter(key => !key.startsWith('score'))
      .map(key => {
        const isId = isIdField(key);

        return {
          field: key,
          headerName: key.length > 20 ? `${key.slice(0, 20)}...` : key,
          flex: columnSizes[key],
          sortable: true,
          filter: true,
          wrapText: true,
          autoHeight: true,
          minWidth: 80 * columnSizes[key],
          maxWidth: columnSizes[key] === 1 ? 150 : undefined,
          // Add special styling for ID fields
          headerClass: isId ? 'id-column-header' : '',
          cellClass: isId ? 'id-column-cell' : '',
          cellRenderer: params => {
            const field = params.colDef.field;
            const value = params.value;
            const documentId = isId ? value : params.data.id;

            if (!value) return null;

            // For ID fields, make them clickable
            if (isId) {
              return (
                <div
                  onClick={() => handleIdClick(value)}
                  style={{
                    cursor: 'pointer',
                    color: '#1976d2',
                    textDecoration: 'underline',
                    fontWeight: 'bold',
                    padding: '4px',
                  }}
                >
                  {value}
                </div>
              );
            }

            // Regular field rendering with NER highlighting logic
            let elements = [];
            let lastIndex = 0;

            // Apply NER highlights if enabled
            if (
              viewNER &&
              viewNERFields.some(
                fieldValue => field === fieldValue || field.includes(fieldValue),
              ) &&
              nerData &&
              nerData[documentId] &&
              Array.isArray(nerData[documentId].t)
            ) {
              const annotations = nerData[documentId].t.map((text, index) => ({
                t: text,
                l: nerData[documentId].l[index],
                s: nerData[documentId].s[index],
                e: nerData[documentId].e[index],
                c: nerData[documentId].c[index],
              }));

              // Sort annotations by start position and span length
              const sortedAnnotations = annotations.sort((a, b) => {
                if (a.s !== b.s) {
                  return a.s - b.s;
                }
                return b.e - b.s - (a.e - a.s);
              });

              // Process annotations
              sortedAnnotations.forEach(({ s, e, l }) => {
                if (s > lastIndex) {
                  elements.push(value.slice(lastIndex, s));
                }
                const label = l[0];
                const color = NER_LABELS_COLORS[label] || 'lightgray';
                elements.push(
                  <span
                    key={`${s}-${e}`}
                    className="ner-highlight-wrapper"
                    style={{
                      backgroundColor: color,
                      padding: '2px',
                      borderRadius: '3px',
                      display: 'inline-block',
                    }}
                  >
                    <span className="ner-highlight">{value.slice(s, e)}</span>
                    <span className="ner-class" style={{ marginLeft: '3px', fontSize: '0.8em' }}>
                      {NERLABELS2FULL[label]}
                    </span>
                  </span>,
                );
                lastIndex = e;
              });

              if (lastIndex < value.length) {
                elements.push(value.slice(lastIndex));
              }
            } else {
              elements = [value];
            }

            // Process keyword highlighting
            const wordsToHighlight = formData?.[params.colDef.field]?.map(item => item.value) || [];
            wordsToHighlight.forEach(word => {
              elements = elements.flatMap(element => {
                if (typeof element === 'string') {
                  const regex = new RegExp(`(${word})`, 'gi');
                  const parts = element.split(regex);
                  return parts.map((part, index) =>
                    index % 2 === 1 ? (
                      <span key={`${word}-${index}`} style={{ backgroundColor: 'yellow' }}>
                        {part}
                      </span>
                    ) : (
                      part
                    ),
                  );
                }
                return element;
              });
            });

            return (
              <div
                style={{
                  whiteSpace: 'normal',
                  overflowWrap: 'break-word',
                  lineHeight: '1.5',
                  width: '100%',
                  height: '100%',
                  padding: '4px',
                }}
              >
                {elements}
              </div>
            );
          },
        };
      });
  }, [results, formData, nerData, viewNER, getColumnSizes]);

  const downloadCSV = () => {
    if (results.length === 0) {
      alert('No data to download');
      return;
    }

    const headers = Object.keys(results[0]).filter(
      key => !(key.startsWith('_') && key.endsWith('_')),
    );
    const csvRows = [headers.join(',')];

    results.forEach(row => {
      const values = headers.map(header => JSON.stringify(row[header] || ''));
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.csv';
    a.click();
  };

  // Add custom CSS to highlight ID columns
  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .id-column-header {
        background-color: #f0f7ff !important;
      }
      .id-column-cell {
        background-color: #f5f9ff !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="w-full h-full" style={{ padding: '16px' }}>
      <div
        className="ag-theme-alpine w-full"
        style={{
          marginTop: '0vh',
          height: '72vh',
          width: '100%',
          position: 'relative',
        }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          pagination={true}
          paginationPageSize={20}
          suppressCellFocus={true}
          defaultColDef={{
            resizable: true,
          }}
          domLayout="normal"
          rowHeight={undefined}
          suppressRowTransform={true}
          enableCellTextSelection={true}
          suppressScrollOnNewData={true}
        />
      </div>
      <div className="flex justify-between items-center mt-4">
        <Button variant="contained" startIcon={<Download />} onClick={downloadCSV} color="primary">
          Download CSV
        </Button>
      </div>

      {/* Document Details Modal */}
      <DocumentDetailsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentId={selectedDocumentId}
        collectionName={selectedAlias}
        solrDatabaseId={selectedSolrDatabase?.id}
        authAxios={authAxios}
        nerData={nerData}
        viewNER={viewNER}
      />
    </div>
  );
};

export default DataGridComponent;
