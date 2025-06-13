import { ColDef } from "ag-grid-community";

// Responsive column width calculator
const getResponsiveWidth = (baseWidth: number, screenWidth: number, breakpoints: { mobile: number; tablet: number; desktop: number }): number => {
  if (screenWidth <= breakpoints.mobile) {
    return Math.max(baseWidth * 0.6, 120); // Minimum 120px on mobile
  } else if (screenWidth <= breakpoints.tablet) {
    return Math.max(baseWidth * 0.8, 150); // Reduced width on tablet
  } else {
    return baseWidth; // Full width on desktop
  }
};

// Get responsive column definitions based on screen size and configuration
export const getResponsiveColumnDefs = (
  screenWidth: number = window.innerWidth,
  breakpoints: { mobile: number; tablet: number; desktop: number } = { mobile: 480, tablet: 768, desktop: 1024 }
) => {
  const isMobile = screenWidth <= breakpoints.mobile;
  const isTablet = screenWidth <= breakpoints.tablet;

  return {
    ngram: [
      {
        headerName: isMobile ? "Term" : "Term/Phrase",
        field: "ngram",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(300, screenWidth, breakpoints),
        pinned: "left",
        flex: isMobile ? 2 : undefined,
      },
      {
        headerName: isMobile ? "Count" : "Frequency",
        field: "count",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(150, screenWidth, breakpoints),
        type: "numericColumn",
        flex: isMobile ? 1 : undefined,
      },
    ] as ColDef[],
    wordLength: [
      {
        headerName: isMobile ? "Length" : "Length (chars)",
        field: "length",
        sortable: true,
        width: getResponsiveWidth(200, screenWidth, breakpoints),
        type: "numericColumn",
        flex: isMobile ? 1 : undefined,
      },
      {
        headerName: isMobile ? "Count" : "Word Count",
        field: "count",
        sortable: true,
        width: getResponsiveWidth(150, screenWidth, breakpoints),
        type: "numericColumn",
        flex: isMobile ? 1 : undefined,
      },
    ] as ColDef[],
    languages: [
      {
        headerName: "Language",
        field: "language",
        sortable: true,
        width: getResponsiveWidth(150, screenWidth, breakpoints),
        pinned: "left",
        flex: isMobile ? 1 : undefined,
      },
      {
        headerName: isMobile ? "Docs" : "Documents",
        field: "count",
        sortable: true,
        width: getResponsiveWidth(150, screenWidth, breakpoints),
        type: "numericColumn",
        flex: isMobile ? 1 : undefined,
      },
    ] as ColDef[],
    punctuation: [
      {
        headerName: isMobile ? "Punct" : "Punctuation",
        field: "punct",
        sortable: true,
        width: getResponsiveWidth(200, screenWidth, breakpoints),
        pinned: "left",
        flex: isMobile ? 2 : undefined,
      },
      {
        headerName: isMobile ? "Count" : "Frequency",
        field: "count",
        sortable: true,
        width: getResponsiveWidth(150, screenWidth, breakpoints),
        type: "numericColumn",
        flex: isMobile ? 1 : undefined,
      },
    ] as ColDef[],
    completeness: [
      {
        headerName: isMobile ? "Field" : "Field Name",
        field: "field",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(300, screenWidth, breakpoints),
        pinned: "left",
        flex: isMobile ? 2 : undefined,
      },
      {
        headerName: isMobile ? "%" : "Completeness",
        field: "percentage",
        sortable: true,
        width: getResponsiveWidth(150, screenWidth, breakpoints),
        flex: isMobile ? 1 : undefined,
      },
    ] as ColDef[],
    overview: [
      {
        headerName: "Metric",
        field: "metric",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(300, screenWidth, breakpoints),
        pinned: "left",
        flex: isMobile ? 2 : undefined,
      },
      {
        headerName: "Value",
        field: "value",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(200, screenWidth, breakpoints),
        flex: isMobile ? 1 : undefined,
      },
    ] as ColDef[],
    otherStats: [
      {
        headerName: "Item",
        field: "key",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(250, screenWidth, breakpoints),
        pinned: "left",
        flex: isMobile ? 2 : undefined,
      },
      {
        headerName: "Value",
        field: "value",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(200, screenWidth, breakpoints),
        flex: isMobile ? 1 : undefined,
      },
      {
        headerName: isMobile ? "#" : "Count",
        field: "count",
        sortable: true,
        filter: !isMobile,
        width: getResponsiveWidth(150, screenWidth, breakpoints),
        type: "numericColumn",
        flex: isMobile ? 1 : undefined,
      },
    ] as ColDef[],
  };
};

// Legacy export for backwards compatibility
export const COLUMN_DEFS = getResponsiveColumnDefs();
