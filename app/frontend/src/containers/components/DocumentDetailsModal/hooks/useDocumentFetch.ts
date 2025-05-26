import { useEffect } from 'react';

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