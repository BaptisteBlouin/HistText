import { isIdField } from './dataUtils';

export const calculateColumnSizes = (results: any[]) => {
  if (results.length === 0) return { mainTextColumn: null, columnSizes: {} };
  
  const sample = results.slice(0, Math.min(20, results.length));
  const fields = Object.keys(results[0])
    .filter(key => !(key.startsWith('_') && key.endsWith('_')))
    .filter(key => !key.startsWith('score'));

  const fieldStats: Record<string, any> = {};
  fields.forEach(field => {
    const lengths = sample.map(row => {
      const value = row[field];
      const stringValue = value ? String(value) : '';
      return stringValue.length;
    });
    
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const maxLength = Math.max(...lengths);
    
    fieldStats[field] = {
      avgLength,
      maxLength,
      totalChars: lengths.reduce((sum, len) => sum + len, 0)
    };
  });

  // Find the main text column (highest total character count)
  const mainTextColumn = fields.reduce((max, field) => 
    fieldStats[field].totalChars > (fieldStats[max]?.totalChars || 0) ? field : max
  );

  const sizes: Record<string, number> = {};
  
  // Calculate widths in pixels instead of percentages for better control
  fields.forEach(field => {
    const { avgLength, maxLength } = fieldStats[field];
    const isId = isIdField(field);
    const isMainColumn = field === mainTextColumn;

    let width;
    if (isId) {
      // ID columns: compact but readable
      width = Math.min(150, Math.max(80, avgLength * 8));
    } else if (isMainColumn) {
      // Main text column: generous width
      width = Math.min(600, Math.max(300, avgLength * 4));
    } else if (maxLength <= 10) {
      // Very short content
      width = Math.max(80, Math.min(120, maxLength * 10));
    } else if (avgLength <= 20) {
      // Short content
      width = Math.max(100, Math.min(180, avgLength * 8));
    } else if (avgLength <= 50) {
      // Medium content
      width = Math.max(150, Math.min(250, avgLength * 5));
    } else {
      // Long content (but not the main column)
      width = Math.max(200, Math.min(350, avgLength * 3));
    }

    sizes[field] = width;
  });

  return { mainTextColumn, columnSizes: sizes };
};

export const createColumnDefs = (
  results: any[],
  columnSizes: Record<string, number>,
  mainTextColumn: string | null,
  showConcordance: boolean,
  nerData: any,
  viewNER: boolean,
  formData: any,
  onIdClick: (id: string) => void
) => {
  if (results.length === 0) return [];

  return Object.keys(results[0])
    .filter(key => !(key.startsWith('_') && key.endsWith('_')))
    .filter(key => !key.startsWith('score'))
    .map(key => {
      const isMainColumn = key === mainTextColumn;
      const isId = isIdField(key);

      return {
        field: key,
        headerName: key.length > 25 ? `${key.slice(0, 25)}...` : key,
        width: columnSizes[key] || 120,
        sortable: true,
        filter: true,
        wrapText: isMainColumn,
        autoHeight: isMainColumn && !showConcordance,
        resizable: true,
        minWidth: isId ? 80 : (isMainColumn ? 300 : 100),
        maxWidth: isMainColumn ? 800 : (isId ? 200 : 400),
        headerTooltip: key,
        cellRenderer: 'cellRenderer',
        cellRendererParams: {
          nerData,
          viewNER,
          formData,
          showConcordance,
          mainTextColumn,
          onIdClick, // Pass onIdClick here
        },
        headerClass: isMainColumn ? 'main-column-header' : (isId ? 'id-column-header' : ''),
        cellClass: isMainColumn ? 'main-column-cell' : (isId ? 'id-column-cell' : ''),
      };
    });
};