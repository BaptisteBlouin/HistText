import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Chip
} from '@mui/material';
import {
  ExpandMore,
  Close,
  DnsRounded
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import config from '../../../../../config.json';
import { getDatabaseInitials, truncateDescription, getDatabaseDescription } from '../utils/databaseUtils';

interface DatabaseSelectorButtonProps {
  selectedDatabase: any;
  selectedSolrDatabase: any;
  solrDatabasesLength: number;
  isOpen: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onClear: (e: React.MouseEvent) => void;
}

const DatabaseSelectorButton: React.FC<DatabaseSelectorButtonProps> = React.memo(({
  selectedDatabase,
  selectedSolrDatabase,
  solrDatabasesLength,
  isOpen,
  isLoading,
  onToggle,
  onClear
}) => {
  const theme = useTheme();

  return (
    <Paper
      elevation={isOpen ? 8 : 2}
      onClick={onToggle}
      sx={{
        p: 2,
        cursor: 'pointer',
        borderRadius: 3,
        border: `2px solid ${isOpen ? theme.palette.secondary.main : 'transparent'}`,
        background: selectedSolrDatabase 
          ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isOpen ? 'translateY(-2px)' : 'translateY(0)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[6],
          borderColor: theme.palette.secondary.light,
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Database Icon/Avatar */}
        {selectedSolrDatabase ? (
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'secondary.main',
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem'
            }}
          >
            {getDatabaseInitials(selectedSolrDatabase.name)}
          </Avatar>
        ) : (
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'grey.300',
              color: 'grey.600'
            }}
          >
            <DnsRounded />
          </Avatar>
        )}

        {/* Database Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {selectedSolrDatabase ? (
            <>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  fontSize: '1.1rem',
                  lineHeight: 1.2,
                  mb: 0.5
                }}
              >
                {selectedSolrDatabase.name}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {truncateDescription(getDatabaseDescription(selectedSolrDatabase), 80)}
              </Typography>
            </>
          ) : (
            <Typography
              variant="h6"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                fontSize: '1.1rem'
              }}
            >
              {config.solr_selector_sentence || 'Select a database...'}
            </Typography>
          )}
        </Box>

        {/* Action Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 20,
                height: 20,
                border: '2px solid #e0e0e0',
                borderTop: '2px solid #1976d2',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </Box>
          )}
          
          {selectedSolrDatabase && !isLoading && (
            <Tooltip title="Clear selection">
              <IconButton
                size="small"
                onClick={onClear}
                sx={{
                  bgcolor: 'error.light',
                  color: 'error.contrastText',
                  '&:hover': { bgcolor: 'error.main' }
                }}
              >
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          
          <IconButton
            size="small"
            sx={{
              bgcolor: 'secondary.light',
              color: 'secondary.contrastText',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease',
              '&:hover': { bgcolor: 'secondary.main' }
            }}
          >
            <ExpandMore />
          </IconButton>
        </Box>
      </Box>

      {/* Database Count Badge */}
      {solrDatabasesLength > 0 && (
        <Chip
          label={`${solrDatabasesLength} database${solrDatabasesLength !== 1 ? 's' : ''} available`}
          size="small"
          sx={{
            position: 'absolute',
            top: -8,
            right: 12,
            bgcolor: 'secondary.main',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.75rem'
          }}
        />
      )}
    </Paper>
  );
});

DatabaseSelectorButton.displayName = 'DatabaseSelectorButton';

export default DatabaseSelectorButton;