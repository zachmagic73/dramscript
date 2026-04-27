import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, Grid2, Card, CardContent,
  CircularProgress, Alert, Divider, Rating, Avatar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import type { RecipeTemplate, Recipe } from '../types';

interface RiffCard {
  id: string;
  name: string;
  author: string | null;
  author_avatar: string | null;
  rating: number | null;
  rating_count: number;
  created_at: string;
}

interface TemplateDetailData extends RecipeTemplate {
  canonical_recipe: Recipe;
  riffs: RiffCard[];
}

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TemplateDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) throw new Error('Template not found');
        const json = await res.json() as { template: TemplateDetailData };
        setData(json.template);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading template');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleStart = async () => {
    if (!id) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/templates/${id}/start`);
      if (!res.ok) throw new Error('Failed to load template');
      const json = await res.json() as { prefill: unknown };
      navigate('/recipes/new', { state: { prefill: json.prefill } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error starting from template');
      setStarting(false);
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress color="primary" />
    </Box>
  );

  if (error || !data) return (
    <Box>
      <Alert severity="error">{error ?? 'Template not found'}</Alert>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/templates')} sx={{ mt: 2 }}>
        Back to templates
      </Button>
    </Box>
  );

  const recipe = data.canonical_recipe;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/templates')} sx={{ mb: 2, color: 'text.secondary' }}>
        Templates
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4">{data.name}</Typography>
          {data.description && (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{data.description}</Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {data.base_type && <Chip label={data.base_type} size="small" />}
            {(data.riff_count ?? 0) > 0 && (
              <Chip label={`${data.riff_count} riff${data.riff_count !== 1 ? 's' : ''}`} size="small" variant="outlined" />
            )}
            {(data.avg_rating ?? 0) > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="caption">{Number(data.avg_rating).toFixed(1)}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Button
          variant="contained" size="large"
          onClick={() => void handleStart()}
          disabled={starting}
        >
          {starting ? <CircularProgress size={20} color="inherit" /> : 'Start from this template'}
        </Button>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* ── Canonical recipe ── */}
      <Grid2 container spacing={4}>
        <Grid2 size={{ xs: 12, md: 5 }}>
          <Typography variant="h6" gutterBottom>Ingredients</Typography>
          {recipe.ingredients && recipe.ingredients.length > 0 ? (
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {recipe.ingredients.map((ing, i) => (
                <Box component="li" key={i} sx={{ mb: 0.5 }}>
                  <Typography variant="body2">
                    {ing.amount != null && (
                      <Box component="span" className="amount">{ing.amount}{ing.unit ? ` ${ing.unit}` : ''} </Box>
                    )}
                    {ing.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No ingredients listed.</Typography>
          )}

          {recipe.garnish && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <Box component="span" sx={{ color: 'text.secondary' }}>Garnish: </Box>
              {recipe.garnish}
            </Typography>
          )}
        </Grid2>

        <Grid2 size={{ xs: 12, md: 7 }}>
          <Typography variant="h6" gutterBottom>Method</Typography>
          {recipe.steps && recipe.steps.length > 0 ? (
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              {recipe.steps.map((step, i) => (
                <Box component="li" key={i} sx={{ mb: 1 }}>
                  <Typography variant="body2">{step.description}</Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No steps listed.</Typography>
          )}
        </Grid2>
      </Grid2>

      {/* ── Community riffs ── */}
      {data.riffs && data.riffs.length > 0 && (
        <Box sx={{ mt: 5 }}>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h5" gutterBottom>Community Riffs</Typography>
          <Grid2 container spacing={2}>
            {data.riffs.map((riff) => (
              <Grid2 key={riff.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  sx={{
                    cursor: 'pointer', border: '1px solid', borderColor: 'divider',
                    '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s',
                  }}
                  onClick={() => navigate(`/recipes/${riff.id}`)}
                >
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600}>{riff.name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Avatar src={riff.author_avatar ?? undefined} sx={{ width: 20, height: 20, fontSize: 10 }}>
                        {riff.author?.slice(0, 1).toUpperCase() ?? '?'}
                      </Avatar>
                      <Typography variant="caption" color="text.secondary">
                        {riff.author ?? 'Anonymous'}
                      </Typography>
                    </Box>
                    {riff.rating_count > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                        <Rating value={riff.rating} readOnly size="small" precision={0.5} />
                        <Typography variant="caption" color="text.secondary">
                          ({riff.rating_count})
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>
        </Box>
      )}
    </Box>
  );
}
