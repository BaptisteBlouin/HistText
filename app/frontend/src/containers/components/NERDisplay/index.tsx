import React from "react";
import NERDisplayContainer from "./NERDisplayContainer";

interface NERDisplayProps {
  nerData: Record<string, any>;
  authAxios: any;
  selectedAlias: string;
  selectedSolrDatabase: { id: number } | null;
  viewNER?: boolean;
}

const NERDisplay: React.FC<NERDisplayProps> = (props) => {
  return <NERDisplayContainer {...props} />;
};

export default NERDisplay;
