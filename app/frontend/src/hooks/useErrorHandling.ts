// hooks/useErrorHandling.ts
import { useState, useCallback } from "react";

interface ErrorState {
  hasError: boolean;
  message: string;
  type: "error" | "warning" | "info";
  source?: string;
}

export const useErrorHandling = () => {
  const [error, setError] = useState<ErrorState | null>(null);

  const handleError = useCallback(
    (
      message: string,
      type: "error" | "warning" | "info" = "error",
      source?: string,
    ) => {
      setError({ hasError: true, message, type, source });
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleValidationError = useCallback(
    (message: string) => {
      handleError(message, "warning", "validation");
    },
    [handleError],
  );

  const handleNetworkError = useCallback(
    (error: any, source: string) => {
      if (error.response?.status === 404) {
        handleError(`No data available for ${source}`, "info", source);
      } else if (error.response?.status >= 500) {
        handleError(`Server error while loading ${source}`, "error", source);
      } else {
        handleError(
          `Failed to load ${source}: ${error.message}`,
          "error",
          source,
        );
      }
    },
    [handleError],
  );

  return {
    error,
    handleError,
    clearError,
    handleValidationError,
    handleNetworkError,
  };
};
