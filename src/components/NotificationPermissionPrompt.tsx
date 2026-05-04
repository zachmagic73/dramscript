import { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Box,
  Stack,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CloseIcon from '@mui/icons-material/Close';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationPermissionPrompt() {
  const { permissionStatus, requestPermissionAndSubscribe, isLoading } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if permission already granted or dismissed
  if (dismissed || permissionStatus === 'granted') {
    return null;
  }

  if (permissionStatus === 'denied') {
    return null;
  }

  return (
    <Alert
      severity="info"
      sx={{
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
      icon={<NotificationsIcon sx={{ mr: 1 }} />}
    >
      <Box sx={{ flex: 1 }}>
        <AlertTitle>Enable Notifications</AlertTitle>
        Get notified when you receive friend requests and when friends accept your requests.
      </Box>
      <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
        <Button
          variant="contained"
          size="small"
          color="primary"
          onClick={async () => {
            await requestPermissionAndSubscribe();
            setDismissed(true);
          }}
          disabled={isLoading}
        >
          Enable
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => setDismissed(true)}
          sx={{ minWidth: 'auto' }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </Button>
      </Stack>
    </Alert>
  );
}
