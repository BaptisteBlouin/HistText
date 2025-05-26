import React from 'react';
import LoadingOverlayComponent from './LoadingOverlayComponent';

interface LoadingOverlayProps {
  loading: boolean;
  progress: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = (props) => {
  return <LoadingOverlayComponent {...props} />;
};

export default LoadingOverlay;