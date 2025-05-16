// src/pages/AdminPanel.tsx
import React, { useState, Suspense, useEffect } from 'react';
import { useAuth, useAuthCheck } from '../../hooks/useAuth';
import { Box, Typography, Card, CardContent, Tabs, Tab, Button } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Lazy-loaded component imports
const Users = React.lazy(() => import('./components/Users'));
const RolePermissions = React.lazy(() => import('./components/RolePermissions'));
const UserRoles = React.lazy(() => import('./components/UserRoles'));
const SolrDatabase = React.lazy(() => import('./components/SolrDatabase'));
const SolrDatabasePermissions = React.lazy(() => import('./components/SolrDatabasePermissions'));
const SolrDatabaseInfo = React.lazy(() => import('./components/SolrDatabaseInfo'));
const UpdateConfig = React.lazy(() => import('./components/UpdateConfig'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const PrecomputeNER = React.lazy(() => import('./components/PrecomputedNER'));
const TokenizeSolr = React.lazy(() => import('./components/TokenizeSolr')); // New component
const ComputeWordEmbeddings = React.lazy(() => import('./components/ComputeWordEmbeddings')); // New component

// ReadMeTab now fetches markdown from an external file in public/docs/README_NLP.md
const ReadMeTab: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/docs/READMES.md')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch README: ${res.statusText}`);
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <Typography>Loading ReadMe...</Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 4 },
        ml: 0,
        fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: '16px',
        lineHeight: 1.6,
        color: 'rgba(0, 0, 0, 0.87)',

        // Headers
        '& h1': {
          fontSize: '2rem',
          mt: 4,
          mb: 2,
          pb: 1,
          borderBottom: '1px solid #eaecef',
          fontWeight: 600,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        '& h2': {
          fontSize: '1.5rem',
          mt: 3,
          mb: 2,
          pb: 0.5,
          borderBottom: '1px solid #eaecef',
          fontWeight: 600,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        '& h3': {
          fontSize: '1.25rem',
          mt: 3,
          mb: 1.5,
          fontWeight: 600,
          lineHeight: 1.25,
          fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        '& h4': {
          fontSize: '1rem',
          mt: 2,
          mb: 1,
          fontWeight: 600,
          lineHeight: 1.25,
          fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        '& h5': {
          fontSize: '0.875rem',
          mt: 2,
          mb: 1,
          fontWeight: 600,
          lineHeight: 1.25,
          fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },

        // Links
        '& a': {
          color: '#0366d6',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },

        // Paragraphs
        '& p': {
          mt: 0,
          mb: 1.5,
          lineHeight: 1.6,
        },

        // Lists
        '& ul, & ol': {
          mt: 0,
          mb: 2,
          paddingLeft: '2em',
          '& li': {
            mb: 0.5,
            '& > p': {
              mb: 0.75,
            },
            '& > ul, & > ol': {
              mb: 0.75,
            },
          },
        },

        // Tables
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          my: 2,
          display: 'block',
          overflow: 'auto',
        },
        '& thead': {
          backgroundColor: '#f6f8fa',
        },
        '& th': {
          border: '1px solid #dfe2e5',
          p: 1.5,
          fontWeight: 600,
        },
        '& td': {
          border: '1px solid #dfe2e5',
          p: 1.5,
        },

        // Code blocks
        '& pre': {
          backgroundColor: '#f6f8fa',
          borderRadius: 3,
          fontSize: '0.85rem',
          lineHeight: 1.45,
          overflow: 'auto',
          p: 1.5,
          mb: 2,
          fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
        },
        '& :not(pre) > code': {
          fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
          backgroundColor: 'rgba(27, 31, 35, 0.05)',
          padding: '0.2em 0.4em',
          borderRadius: 3,
          fontSize: '85%',
          wordBreak: 'break-word',
        },

        // Blockquotes
        '& blockquote': {
          paddingLeft: 2,
          marginLeft: 0,
          marginRight: 0,
          borderLeft: '0.25em solid #dfe2e5',
          color: '#6a737d',
        },

        // Horizontal rules
        '& hr': {
          height: '0.25em',
          padding: 0,
          margin: '24px 0',
          backgroundColor: '#e1e4e8',
          border: 0,
        },

        // Images
        '& img': {
          maxWidth: '100%',
          boxSizing: 'content-box',
          backgroundColor: '#fff',
        },

        // Strong, Emphasis
        '& strong': {
          fontWeight: 600,
        },
        '& em': {
          fontStyle: 'italic',
        },

        // Details & Summary
        '& details': {
          display: 'block',
          mb: 2,
        },
        '& summary': {
          display: 'list-item',
          cursor: 'pointer',
          fontWeight: 600,
        },

        // Alignment for overall container
        textAlign: 'left',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
};

// API Documentation component that redirects to Swagger UI
const ApiDocumentation: React.FC = () => {
  const handleOpenApiDocs = () => {
    // Open each API documentation in a new tab
    window.open('/swagger-ui/', '_blank');
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        API Documentation
      </Typography>
      <Typography paragraph>
        Access the complete API documentation with interactive endpoints using Swagger UI. This
        documentation covers all available endpoints organized into three main sections:
      </Typography>
      <ul>
        <li>User Management API - user accounts, roles, and permissions</li>
        <li>Solr Administration API - database configurations and permissions</li>
        <li>HistText Core API - document search, metadata, and text analysis</li>
      </ul>
      <Button variant="contained" color="primary" onClick={handleOpenApiDocs} sx={{ mt: 2 }}>
        Open API Documentation
      </Button>
    </Box>
  );
};

const AdminPanel: React.FC = () => {
  useAuthCheck();
  const auth = useAuth();
  const isAdmin = auth.session?.hasRole('Admin');

  const [mainTab, setMainTab] = useState<number>(() => {
    const storedTab = localStorage.getItem('mainTab');
    return storedTab ? parseInt(storedTab, 10) : 0;
  });
  const [subTab, setSubTab] = useState<number>(0);

  const handleMainTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setMainTab(newValue);
    localStorage.setItem('mainTab', newValue.toString());
    if (newValue !== 3) setSubTab(0);
  };

  const handleSubTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setSubTab(newValue);
  };

  if (!auth.session) return <div>Loading...</div>;
  if (!isAdmin) return <div>Access Denied</div>;

  return (
    <Box sx={{ p: 3 }}>
      <Tabs value={mainTab} onChange={handleMainTabChange} aria-label="Admin Panel Tabs">
        <Tab label="Dashboard" />
        <Tab label="User & Role Management" />
        <Tab label="Solr Management" />
        <Tab label="NLP Management" />
        <Tab label="API Documentation" />
      </Tabs>

      {mainTab === 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Suspense fallback={<div>Loading Dashboard...</div>}>
              <Dashboard />
            </Suspense>
          </CardContent>
        </Card>
      )}

      {mainTab === 1 && (
        <>
          <Tabs
            value={subTab}
            onChange={handleSubTabChange}
            aria-label="User Management Subtabs"
            sx={{ mt: 2 }}
          >
            <Tab label="Users" />
            <Tab label="User Roles" />
            <Tab label="Role Permissions" />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {[Users, UserRoles, RolePermissions].map(
              (Component, index) =>
                subTab === index && (
                  <Card key={index} sx={{ mb: 2 }}>
                    <CardContent>
                      <Suspense fallback={<div>Loading...</div>}>
                        <Component />
                      </Suspense>
                    </CardContent>
                  </Card>
                ),
            )}
          </Box>
        </>
      )}

      {mainTab === 2 && (
        <>
          <Tabs
            value={subTab}
            onChange={handleSubTabChange}
            aria-label="Solr Management Subtabs"
            sx={{ mt: 2 }}
          >
            <Tab label="Databases" />
            <Tab label="Database Info" />
            <Tab label="Database Permissions" />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {[SolrDatabase, SolrDatabaseInfo, SolrDatabasePermissions].map(
              (Component, index) =>
                subTab === index && (
                  <Card key={index} sx={{ mb: 2 }}>
                    <CardContent>
                      <Suspense fallback={<div>Loading...</div>}>
                        <Component />
                      </Suspense>
                    </CardContent>
                  </Card>
                ),
            )}
          </Box>
        </>
      )}

      {mainTab === 3 && (
        <>
          <Tabs
            value={subTab}
            onChange={handleSubTabChange}
            aria-label="NLP Management Subtabs"
            sx={{ mt: 2 }}
          >
            <Tab label="Read Me" />
            <Tab label="Named Entity Recognition" />
            <Tab label="Tokenization" />
            <Tab label="Word Embeddings" />
          </Tabs>
          <Box sx={{ mt: 2 }}>
            {[ReadMeTab, PrecomputeNER, TokenizeSolr, ComputeWordEmbeddings].map(
              (Component, index) =>
                subTab === index && (
                  <Card key={index} sx={{ mb: 2 }}>
                    <CardContent>
                      <Suspense fallback={<div>Loading...</div>}>
                        <Component />
                      </Suspense>
                    </CardContent>
                  </Card>
                ),
            )}
          </Box>
        </>
      )}

      {mainTab === 4 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Suspense fallback={<div>Loading API Documentation...</div>}>
              <ApiDocumentation />
            </Suspense>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default AdminPanel;
