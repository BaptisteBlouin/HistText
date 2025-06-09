import { ColDef } from "ag-grid-community";

export const COLUMN_DEFS = {
  ngram: [
    {
      headerName: "Term/Phrase",
      field: "ngram",
      sortable: true,
      filter: true,
      width: 300,
      pinned: "left",
    },
    {
      headerName: "Frequency",
      field: "count",
      sortable: true,
      filter: true,
      width: 150,
      type: "numericColumn",
    },
  ] as ColDef[],
  wordLength: [
    {
      headerName: "Length (chars)",
      field: "length",
      sortable: true,
      width: 200,
      type: "numericColumn",
    },
    {
      headerName: "Word Count",
      field: "count",
      sortable: true,
      width: 150,
      type: "numericColumn",
    },
  ] as ColDef[],
  languages: [
    {
      headerName: "Language",
      field: "language",
      sortable: true,
      width: 150,
      pinned: "left",
    },
    {
      headerName: "Documents",
      field: "count",
      sortable: true,
      width: 150,
      type: "numericColumn",
    },
  ] as ColDef[],
  punctuation: [
    {
      headerName: "Punctuation",
      field: "punct",
      sortable: true,
      width: 200,
      pinned: "left",
    },
    {
      headerName: "Frequency",
      field: "count",
      sortable: true,
      width: 150,
      type: "numericColumn",
    },
  ] as ColDef[],
  completeness: [
    {
      headerName: "Field Name",
      field: "field",
      sortable: true,
      filter: true,
      width: 300,
      pinned: "left",
    },
    {
      headerName: "Completeness",
      field: "percentage",
      sortable: true,
      width: 150,
    },
  ] as ColDef[],
  overview: [
    {
      headerName: "Metric",
      field: "metric",
      sortable: true,
      filter: true,
      width: 300,
      pinned: "left",
    },
    {
      headerName: "Value",
      field: "value",
      sortable: true,
      filter: true,
      width: 200,
    },
  ] as ColDef[],
  otherStats: [
    {
      headerName: "Item",
      field: "key",
      sortable: true,
      filter: true,
      width: 250,
      pinned: "left",
    },
    {
      headerName: "Value",
      field: "value",
      sortable: true,
      filter: true,
      width: 200,
    },
    {
      headerName: "Count",
      field: "count",
      sortable: true,
      filter: true,
      width: 150,
      type: "numericColumn",
    },
  ] as ColDef[],
};
