import React from "react";
import LoadingOverlayComponent from "./LoadingOverlayComponent";

/**
 * Props for the LoadingOverlay component.
 *
 * @property loading - Whether loading is active.
 * @property progress - Progress value for the loading indicator.
 */
interface LoadingOverlayProps {
  loading: boolean;
  progress: number;
}

/**
 * Wrapper for LoadingOverlayComponent, forwarding all props.
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = (props) => {
  return <LoadingOverlayComponent {...props} />;
};

export default LoadingOverlay;
