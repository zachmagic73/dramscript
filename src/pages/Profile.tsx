import { useState } from 'react';
import {
  Box, Typography, TextField, Button, FormControl, InputLabel,
  Select, MenuItem, Alert, CircularProgress, Avatar, Divider,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, setUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [defaultUnits, setDefaultUnits] = useState<'oz' | 'ml'>(user?.default_units ?? 'oz');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() || null, default_units: defaultUnits }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save');
      }
      const data = await res.json() as {
        user: {
          display_name: string | null;
          default_units: 'oz' | 'ml';
        };
      };
      setUser({ ...user, display_name: data.user.display_name, default_units: data.user.default_units });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const initials = (user.display_name ?? user.email ?? '?').slice(0, 2).toUpperCase();

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Profile</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar
          src={user.avatar_url ?? undefined}
          sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.5rem' }}
        >
          {user.avatar_url ? null : (initials || <PersonIcon />)}
        </Avatar>
        <Box>
          <Typography variant="h6">{user.display_name ?? user.email}</Typography>
          <Typography variant="body2" color="text.secondary">{user.email}</Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {success && <Alert severity="success" sx={{ mb: 2 }}>Saved!</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How should we call you?"
          helperText="Optional. Shown on public recipes."
        />

        <FormControl>
          <InputLabel>Default units</InputLabel>
          <Select
            value={defaultUnits}
            label="Default units"
            onChange={(e) => setDefaultUnits(e.target.value as 'oz' | 'ml')}
          >
            <MenuItem value="oz">oz (ounces)</MenuItem>
            <MenuItem value="ml">ml (millilitres)</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={20} color="inherit" /> : 'Save changes'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
