import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid2, Card, CardContent, CardActions,
  Button, Chip, CircularProgress, Alert, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import PeopleIcon from '@mui/icons-material/People';
import type { RecipeTemplate } from '../types';

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<RecipeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/templates');
        if (!res.ok) throw new Error('Failed to load templates');
        const data = await res.json() as { templates: RecipeTemplate[] };
        setTemplates(data.templates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading templates');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = templates.filter((t) =>
    !query || t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.description?.toLowerCase().includes(query.toLowerCase())
  );

  const handleStartFromTemplate = async (templateId: string) => {
    const res = await fetch(`/api/templates/${templateId}/start`);
    if (!res.ok) { setError('Failed to load template'); return; }
    const data = await res.json() as { prefill: { recipe: { ingredients?: unknown[]; steps?: unknown[] } } };
    navigate('/recipes/new', { state: { prefill: data.prefill } });
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress color="primary" />
    </Box>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Classic Templates</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Start your recipe journal with a proven classic and make it your own.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        fullWidth placeholder="Search templates…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="small"
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {filtered.length === 0 ? (
        <Typography color="text.secondary">No templates found.</Typography>
      ) : (
        <Grid2 container spacing={3}>
          {filtered.map((t) => (
            <Grid2 key={t.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 6, borderColor: 'primary.main' },
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                }}
                onClick={() => navigate(`/templates/${t.id}`)}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" sx={{ lineHeight: 1.2 }}>{t.name}</Typography>
                    {t.base_type && (
                      <Chip label={t.base_type} size="small" sx={{ ml: 1, flexShrink: 0 }} />
                    )}
                  </Box>
                  {t.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {t.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {(t.riff_count ?? 0) > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PeopleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {t.riff_count} riff{t.riff_count !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    )}
                    {(t.avg_rating ?? 0) > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                        <Typography variant="caption" color="text.secondary">
                          {Number(t.avg_rating).toFixed(1)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    variant="contained" size="small" fullWidth
                    onClick={(e) => { e.stopPropagation(); void handleStartFromTemplate(t.id); }}
                  >
                    Start from this template
                  </Button>
                </CardActions>
              </Card>
            </Grid2>
          ))}
        </Grid2>
      )}
    </Box>
  );
}
