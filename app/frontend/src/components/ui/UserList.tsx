import React from 'react';
import {
  Box,
  Avatar,
  Typography,
  Chip,
  Tooltip,
  Badge,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Popover,
  Paper,
  Divider,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Person,
  Group,
  ExpandMore,
  MoreVert,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';

interface UserInfo {
  user_id: number;
  username: string;
  error_count?: number;
  last_error?: number;
  last_activity?: number;
  request_count?: number;
}

interface UserListProps {
  users: UserInfo[];
  maxVisibleUsers?: number;
  showDetails?: boolean;
  variant?: 'compact' | 'detailed';
  title?: string;
  emptyMessage?: string;
}

const UserList: React.FC<UserListProps> = ({
  users,
  maxVisibleUsers = 5,
  showDetails = true,
  variant = 'compact',
  title = 'Users',
  emptyMessage = 'No users to display',
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const visibleUsers = users.slice(0, maxVisibleUsers);
  const hiddenCount = Math.max(0, users.length - maxVisibleUsers);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getUserInitials = (username: string) => {
    if (username.includes('@')) {
      // Email format
      return username.split('@')[0].substring(0, 2).toUpperCase();
    }
    if (username.includes(' ')) {
      // Full name format
      const parts = username.split(' ');
      return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
    }
    return username.substring(0, 2).toUpperCase();
  };

  const getUserDisplayName = (username: string) => {
    if (username.includes('<') && username.includes('>')) {
      // Format: "John Doe <john@example.com>"
      const name = username.split('<')[0].trim();
      return name || username;
    }
    return username;
  };

  const getUserEmail = (username: string) => {
    if (username.includes('<') && username.includes('>')) {
      const email = username.match(/<(.+)>/)?.[1];
      return email || '';
    }
    if (username.includes('@')) {
      return username;
    }
    return '';
  };

  if (users.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
        <Person fontSize="small" />
        <Typography variant="body2">{emptyMessage}</Typography>
      </Box>
    );
  }

  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip
          title={
            <Paper sx={{ p: 2, maxWidth: 400 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                {title} ({users.length})
              </Typography>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {users.map((user, index) => (
                  <ListItem key={user.user_id} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          fontSize: '0.75rem',
                          bgcolor: theme.palette.primary.main 
                        }}
                      >
                        {getUserInitials(user.username)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {getUserDisplayName(user.username)}
                        </Typography>
                      }
                      secondary={
                        <Stack spacing={0.5}>
                          {getUserEmail(user.username) && (
                            <Typography variant="caption" color="text.secondary">
                              {getUserEmail(user.username)}
                            </Typography>
                          )}
                          {showDetails && user.error_count && (
                            <Typography variant="caption" color="error.main">
                              {user.error_count} errors
                            </Typography>
                          )}
                          {showDetails && user.request_count && (
                            <Typography variant="caption" color="text.secondary">
                              {user.request_count} requests
                            </Typography>
                          )}
                          {showDetails && (user.last_error || user.last_activity) && (
                            <Typography variant="caption" color="text.secondary">
                              Last: {formatTimestamp(user.last_error || user.last_activity)}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                    {showDetails && user.error_count && (
                      <ListItemSecondaryAction>
                        <Chip
                          label={user.error_count}
                          size="small"
                          color="error"
                          variant="outlined"
                        />
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            </Paper>
          }
          arrow
          placement="bottom-start"
          componentsProps={{
            tooltip: {
              sx: { p: 0 }
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
            <Badge badgeContent={users.length} color="primary" max={999}>
              <Group fontSize="small" />
            </Badge>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {users.length}
            </Typography>
          </Box>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        {title} ({users.length})
      </Typography>
      
      <List dense>
        {visibleUsers.map((user, index) => (
          <React.Fragment key={user.user_id}>
            <ListItem sx={{ px: 0 }}>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  {getUserInitials(user.username)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {getUserDisplayName(user.username)}
                  </Typography>
                }
                secondary={
                  <Stack spacing={0.5}>
                    {getUserEmail(user.username) && (
                      <Typography variant="caption" color="text.secondary">
                        {getUserEmail(user.username)}
                      </Typography>
                    )}
                    {showDetails && (
                      <Stack direction="row" spacing={1}>
                        {user.error_count && (
                          <Chip
                            label={`${user.error_count} errors`}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                        )}
                        {user.request_count && (
                          <Chip
                            label={`${user.request_count} requests`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    )}
                    {showDetails && (user.last_error || user.last_activity) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Schedule fontSize="inherit" />
                        {formatTimestamp(user.last_error || user.last_activity)}
                      </Typography>
                    )}
                  </Stack>
                }
              />
              {showDetails && (
                <ListItemSecondaryAction>
                  <IconButton size="small">
                    <MoreVert fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItem>
            {index < visibleUsers.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>

      {hiddenCount > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ textAlign: 'center' }}>
            <IconButton
              size="small"
              onClick={handleClick}
              sx={{ color: 'text.secondary' }}
            >
              <Typography variant="caption" sx={{ mr: 0.5 }}>
                +{hiddenCount} more
              </Typography>
              <ExpandMore fontSize="small" />
            </IconButton>
          </Box>

          <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
          >
            <Paper sx={{ p: 2, maxWidth: 400, maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                All {title} ({users.length})
              </Typography>
              <List dense>
                {users.slice(maxVisibleUsers).map((user, index) => (
                  <ListItem key={user.user_id} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          fontSize: '0.75rem',
                          bgcolor: theme.palette.secondary.main 
                        }}
                      >
                        {getUserInitials(user.username)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={getUserDisplayName(user.username)}
                      secondary={getUserEmail(user.username)}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Popover>
        </>
      )}
    </Paper>
  );
};

export default UserList;