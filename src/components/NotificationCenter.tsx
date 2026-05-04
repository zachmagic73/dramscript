import React, { useEffect } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  Stack,
  Typography,
  Button,
  Box,
  Chip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../hooks/useNotifications';

function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const seconds = now - timestamp;

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
  } = useNotifications();

  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    fetchNotifications(false);
    // Refresh notifications every 30 seconds
    const interval = setInterval(() => fetchNotifications(false), 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={handleClick}
        color={unreadCount > 0 ? 'warning' : 'default'}
        sx={{ position: 'relative' }}
      >
        <Badge badgeContent={unreadCount} color="error" overlap="circular">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ width: 400, maxHeight: 500, overflow: 'auto' }}>
          <Stack sx={{ p: 2, borderBottom: `1px solid #e0e0e0` }}>
            <Typography variant="h6">Notifications</Typography>
          </Stack>

          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="textSecondary">No notifications yet</Typography>
            </Box>
          ) : (
            <Stack divider={<Box sx={{ height: 1, backgroundColor: '#f5f5f5' }} />}>
              {notifications.map((notification) => (
                <Box
                  key={notification.id}
                  sx={{
                    p: 2,
                    backgroundColor: !notification.read_at ? '#f5f5f5' : 'transparent',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f0f0f0' },
                  }}
                  onClick={() => {
                    if (!notification.read_at) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="start">
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {notification.title}
                      </Typography>
                      {!notification.read_at && (
                        <Chip label="New" size="small" color="primary" variant="filled" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="textSecondary">
                      {notification.body}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="textSecondary">
                        {formatTimeAgo(notification.sent_at)}
                      </Typography>
                      {notification.type === 'friend_request_received' && (
                        <Button size="small" color="primary">
                          View Request
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Popover>
    </>
  );
}
