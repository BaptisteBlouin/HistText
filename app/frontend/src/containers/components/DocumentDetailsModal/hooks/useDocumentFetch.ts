import { useEffect } from 'react';

/**
 * Custom hook to fetch document details from the backend when dialog is open.
 *
 * @param open - Whether the document modal/dialog is open.
 * @param documentId - ID of the document to fetch.
 * @param collectionName - Name of the Solr collection.
 * @param solrDatabaseId - Solr database ID.
 * @param authAxios - Axios instance with authentication.
 * @param setDocument - Callback to set fetched document.
 * @param setLoading - Callback to set loading state.
 * @param setError - Callback to set error message.
 */
export const useDocumentFetch = (
  open: boolean,
  documentId: string,
  collectionName: string,
  solrDatabaseId: number | null,
  authAxios: any,
  setDocument: (doc: any) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) => {
  useEffect(() => {
    const fetchDocumentDetails = async () => {
      if (!open || !documentId || !collectionName || !solrDatabaseId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await authAxios.get(
          `/api/solr/query?collection=${encodeURIComponent(collectionName)}&query=id:${encodeURIComponent(documentId)}&start=0&rows=1&solr_database_id=${solrDatabaseId}`,
        );

        if (response.data?.solr_response?.response?.docs?.length > 0) {
          setDocument(response.data.solr_response.response.docs[0]);
        } else {
          setError('Document not found');
        }
      } catch (err) {
        console.error('Error fetching document details:', err);
        setError('Failed to fetch document details');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentDetails();
  }, [open, documentId, collectionName, solrDatabaseId, authAxios, setDocument, setLoading, setError]);
};