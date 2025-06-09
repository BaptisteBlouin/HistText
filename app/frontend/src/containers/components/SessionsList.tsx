import React, { useEffect, useState } from "react";
import { Box, Typography, Button, Pagination, Grid } from "@mui/material";
import "../css/SessionsList.css";
import { toast } from "react-toastify";

export const SessionsList = ({ auth }) => {
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isFetchingSessions, setFetchingSessions] = useState<boolean>(false);
  const [isDeleting, setDeleting] = useState<boolean>(false);
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
    setDeleting(true);
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
      setDeleting(false);
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
      <Button
        variant="contained"
        color="secondary"
        disabled={isDeleting}
        onClick={deleteAllSessions}
        sx={{ mb: 2 }}
      >
        {isDeleting ? "Deleting..." : "Delete All Sessions"}
      </Button>
      {isFetchingSessions ? (
        <Typography>Fetching sessions...</Typography>
      ) : (
        <Box>
          {sessions.sessions.length === 0 ? (
            <Typography>No active sessions.</Typography>
          ) : (
            sessions.sessions.map((session) => (
              <Box key={session.id} className="session-item" sx={{ mb: 2 }}>
                <pre>{JSON.stringify(session, null, 2)}</pre>
                <Button
                  variant="contained"
                  color="secondary"
                  disabled={isDeleting}
                  onClick={() => deleteSession(session.id)}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </Box>
            ))
          )}
          <Grid container justifyContent="center" sx={{ mt: 3 }}>
            <Pagination
              count={sessions.num_pages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
            />
          </Grid>
        </Box>
      )}
    </Box>
  );
};
