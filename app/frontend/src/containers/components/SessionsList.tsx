import React, { useEffect, useState } from "react";
import { Box, Typography, Button, Pagination, Grid, CircularProgress, Skeleton } from "@mui/material";
import { LoadingButton } from "@mui/lab";
import "../css/SessionsList.css";
import { toast } from "react-toastify";

export const SessionsList = ({ auth }: { auth: any }) => {
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isFetchingSessions, setFetchingSessions] = useState<boolean>(false);
  const [isDeleting, setDeleting] = useState<boolean>(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<UserSessionResponse>({
    sessions: [],
    num_pages: 1,
  });

  useEffect(() => {
    fetchSessions();
  }, [auth.isAuthenticated, page, pageSize]);

  const fetchSessions = async () => {
    setFetchingSessions(true);
    try {
      if (!auth.isAuthenticated) {
        setSessions({ sessions: [], num_pages: 1 });
        setFetchingSessions(false);
        return;
      }

      const response = await fetch(
        `/api/auth/sessions?page=${page - 1}&page_size=${pageSize}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const sessionsData = await response.json();
      setSessions(sessionsData);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch sessions.");
    } finally {
      setFetchingSessions(false);
    }
  };

  const deleteSession = async (id: number) => {
    setDeletingSessionId(id);
    try {
      const response = await fetch(`/api/auth/sessions/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      if (sessions.sessions.length === 1 && page !== 1) {
        setPage(page - 1);
      }
      await fetchSessions();
      toast.success("Session deleted successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete session.");
    } finally {
      setDeletingSessionId(null);
    }
  };

  const deleteAllSessions = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/auth/sessions`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete all sessions");
      }

      setPage(1);
      await fetchSessions();
      toast.success("All sessions deleted successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete all sessions.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ backgroundColor: "#f9f9f9", p: 3, borderRadius: 2 }}>
      <Typography variant="h6">Sessions</Typography>
      <LoadingButton
        variant="contained"
        color="secondary"
        loading={isDeleting}
        disabled={deletingSessionId !== null}
        onClick={deleteAllSessions}
        loadingIndicator="Deleting all sessions..."
        sx={{ mb: 2 }}
      >
        Delete All Sessions
      </LoadingButton>
      
      {isFetchingSessions ? (
        <Box>
          {[...Array(3)].map((_, index) => (
            <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Skeleton variant="text" width="60%" height={20} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={16} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" height={16} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width={80} height={36} />
            </Box>
          ))}
        </Box>
      ) : (
        <Box>
          {sessions.sessions.length === 0 ? (
            <Typography>No active sessions.</Typography>
          ) : (
            sessions.sessions.map((session) => (
              <Box key={session.id} className="session-item" sx={{ mb: 2 }}>
                <pre>{JSON.stringify(session, null, 2)}</pre>
                <LoadingButton
                  variant="contained"
                  color="secondary"
                  loading={deletingSessionId === session.id}
                  disabled={isDeleting || deletingSessionId !== null}
                  onClick={() => deleteSession(session.id)}
                  loadingIndicator="Deleting..."
                  size="small"
                >
                  Delete
                </LoadingButton>
              </Box>
            ))
          )}
          <Grid container justifyContent="center" sx={{ mt: 3 }}>
            <Pagination
              count={sessions.num_pages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
              disabled={isFetchingSessions || isDeleting || deletingSessionId !== null}
            />
          </Grid>
        </Box>
      )}
    </Box>
  );
};
