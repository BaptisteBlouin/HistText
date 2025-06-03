import { useState, useCallback } from 'react';

/**
 * State hook for managing document details view (sidebar or modal).
 * Handles loading, error, entity highlighting, field expand/collapse, and copy.
 *
 * @returns State and action setters for document details.
 */
export const useDocumentDetailsState = () => {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNER, setShowNER] = useState(false);
  const [expandedFields, setExpandedFields] = useState(new Set(['content']));
  const [copiedField, setCopiedField] = useState<string | null>(null);

  /**
   * Expands or collapses a document field by name.
   */
  const toggleField = useCallback((fieldName: string) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return newSet;
    });
  }, []);

  /**
   * Copies a field's content to clipboard and sets copied state briefly.
   */
  const handleCopyField = useCallback(async (fieldName: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  }, []);

  /**
   * Resets the document details state.
   */
  const resetState = useCallback(() => {
    setDocument(null);
    setError(null);
    setExpandedFields(new Set(['content']));
    setCopiedField(null);
  }, []);

  return {
    document,
    setDocument,
    loading,
    setLoading,
    error,
    setError,
    showNER,
    setShowNER,
    expandedFields,
    copiedField,
    toggleField,
    handleCopyField,
    resetState
  };
};