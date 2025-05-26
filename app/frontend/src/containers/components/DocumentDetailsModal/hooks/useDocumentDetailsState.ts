import { useState, useCallback } from 'react';

export const useDocumentDetailsState = () => {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNER, setShowNER] = useState(false);
  const [expandedFields, setExpandedFields] = useState(new Set(['content']));
  const [copiedField, setCopiedField] = useState(null);

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

  const handleCopyField = useCallback(async (fieldName: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  }, []);

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