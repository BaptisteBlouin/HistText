import React, { useMemo, useCallback, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ModuleRegistry, ColDef, GridReadyEvent } from '@ag-grid-community/core';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import '../css/HistText.css';
import config from '../../../config.json';
import DocumentDetailsModal from './DocumentDetailsModal';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule]);

interface Annotation {
  t: string; // text
  l: string[]; // labels
  s: number; // start index
  e: number; // end index
  c: number; // confidence
}

interface NerData {
  id: string;
  t: string[];
  l: string[];
  s: number[];
  e: number[];
  c: number[];
}

interface NERDisplayProps {
  nerData: Record<string, NerData>;
  authAxios: any;
  selectedAlias: string;
  selectedSolrDatabase: { id: number } | null;
  viewNER?: boolean;
}

// Main component
const NERDisplay: React.FC<NERDisplayProps> = ({
  nerData,
  authAxios,
  selectedAlias,
  selectedSolrDatabase,
  viewNER = false,
}) => {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Styles for container and grid
  const containerStyle = useMemo(() => ({ width: '100%', height: '70vh', marginTop: '2vh' }), []);
  const gridStyle = useMemo(() => ({ height: '70vh', width: '100%' }), []);

  // Flatten NER data into rowData
  const rowData = useMemo(
    () =>
      Object.entries(nerData).flatMap(([id, data]) => {
        if (!Array.isArray(data.t)) return [];
        return data.t.map((_, idx) => ({
          id,
          text: data.t[idx],
          label: config.NERLABELS2FULL[data.l[idx]] || data.l[idx],
          start: data.s[idx],
          end: data.e[idx],
          confidence: data.c[idx].toFixed(2),
        }));
      }),
    [nerData],
  );

  // Column definitions including clickable ID
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: 'id',
        headerName: 'ID',
        minWidth: 150,
        flex: 1,
        cellRenderer: params => (
          <span
            onClick={() => {
              setSelectedDocumentId(params.value);
              setIsModalOpen(true);
            }}
            style={{
              cursor: 'pointer',
              color: '#1976d2',
              textDecoration: 'underline',
              fontWeight: 'bold',
            }}
          >
            {params.value}
          </span>
        ),
      },
      { field: 'text', headerName: 'Text', minWidth: 150, flex: 1 },
      { field: 'label', headerName: 'Label', minWidth: 150, flex: 1 },
      { field: 'start', headerName: 'Start', minWidth: 100, flex: 1 },
      { field: 'end', headerName: 'End', minWidth: 100, flex: 1 },
      { field: 'confidence', headerName: 'Confidence', minWidth: 100, flex: 1 },
    ],
    [nerData],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ filter: true, resizable: true, editable: false }),
    [],
  );

  // Fit columns when grid ready
  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  // CSV download
  const downloadCSV = () => {
    if (!rowData.length) {
      alert('No data to download');
      return;
    }
    const headers = Object.keys(rowData[0]);
    const csvRows = [headers.join(',')];

    rowData.forEach(row => {
      const values = headers.map(header => `"${String((row as any)[header]).replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ner_data.csv';
    a.click();
  };

  return (
    <>
      <div id="NerTable" style={containerStyle}>
        <div style={gridStyle} className="ag-theme-quartz">
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={onGridReady}
            pagination
            paginationPageSize={50}
          />
        </div>
        <button
          onClick={downloadCSV}
          className="btn btn-primary base-button"
          style={{ marginBottom: '10px' }}
        >
          Download CSV
        </button>
      </div>

      {/* Document Details Modal triggered by clicking ID */}
      <DocumentDetailsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentId={selectedDocumentId || ''}
        collectionName={selectedAlias}
        solrDatabaseId={selectedSolrDatabase?.id || null}
        authAxios={authAxios}
        nerData={nerData}
        viewNER={viewNER}
      />
    </>
  );
};

export default NERDisplay;
