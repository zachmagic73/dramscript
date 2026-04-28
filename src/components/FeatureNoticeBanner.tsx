import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Link as RouterLink } from 'react-router-dom';
import { featureNotices } from '../data/featureNotices';

const DISMISSED_FEATURE_NOTICE_STORAGE_KEY = 'dramscript.dismissedFeatureNotices';

function readDismissedIds() {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const rawValue = window.localStorage.getItem(DISMISSED_FEATURE_NOTICE_STORAGE_KEY);
    if (!rawValue) {
      return new Set<string>();
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    const dismissedIds = parsed.filter((value): value is string => typeof value === 'string');
    return new Set(dismissedIds);
  } catch {
    return new Set<string>();
  }
}

function persistDismissedIds(dismissedIds: Set<string>) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    DISMISSED_FEATURE_NOTICE_STORAGE_KEY,
    JSON.stringify(Array.from(dismissedIds)),
  );
}

export default function FeatureNoticeBanner() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => readDismissedIds());

  useEffect(() => {
    setDismissedIds(readDismissedIds());
  }, []);

  const currentNotice = useMemo(
    () => featureNotices.find((notice) => !dismissedIds.has(notice.id)),
    [dismissedIds],
  );

  if (!currentNotice) {
    return null;
  }

  const handleDismiss = () => {
    setDismissedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(currentNotice.id);
      persistDismissedIds(nextIds);
      return nextIds;
    });
  };

  return (
    <Alert
      severity="info"
      icon={false}
      sx={{
        mb: 3,
        border: '1px solid',
        borderColor: 'primary.main',
        backgroundColor: 'rgba(212,175,55,0.08)',
        color: 'text.primary',
        alignItems: 'flex-start',
        '& .MuiAlert-message': { width: '100%' },
      }}
      action={
        <IconButton
          aria-label="Dismiss feature notice"
          color="inherit"
          size="small"
          onClick={handleDismiss}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      }
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ width: '100%' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {currentNotice.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentNotice.message}
          </Typography>
        </Box>
        {currentNotice.ctaLabel && currentNotice.ctaHref && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              component={RouterLink}
              to={currentNotice.ctaHref}
              variant="outlined"
              size="small"
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              {currentNotice.ctaLabel}
            </Button>
          </Box>
        )}
      </Stack>
    </Alert>
  );
}