import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, Button, Divider, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  List, ListItem, ListItemText, Tooltip, Paper,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import type { Recipe, RecipeVersion } from '../types';
import ImageManager from '../components/ImageManager';
import { useAuth } from '../hooks/useAuth';

const DIFFICULTY_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  easy: 'success', medium: 'warning', hard: 'error',
};

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/recipes/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json() as { recipe: Recipe };
        setRecipe(data.recipe);
      } catch {
        setError('Recipe not found.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    if (res.ok) navigate('/');
  };

  const handleRiff = async () => {
    if (!id) return;
    const res = await fetch(`/api/recipes/${id}/riff`);
    if (!res.ok) return;
    const data = await res.json() as { prefill: Recipe };
    navigate('/recipes/new', { state: { prefill: data.prefill } });
  };

  const loadVersions = async () => {
    if (!id) return;
    setVersionsLoading(true);
    const res = await fetch(`/api/recipes/${id}/versions`);
    const data = await res.json() as { versions: RecipeVersion[] };
    setVersions(data.versions);
    setVersionsLoading(false);
    setShowVersions(true);
  };

  const previewVersion = async (versionId: string) => {
    const res = await fetch(`/api/versions/${versionId}`);
    const data = await res.json() as { snapshot: Recipe };
    setPreviewSnapshot(data.snapshot);
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress color="primary" />
    </Box>
  );

  if (error || !recipe) return (
    <Alert severity="error">{error ?? 'Recipe not found'}</Alert>
  );

  const isOwner = user?.id === recipe.user_id;
  const primaryImage = recipe.images?.find((i) => i.is_primary);

  return (
    <Box>
      {/* Back */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        Back to journal
      </Button>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>{recipe.name}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <Chip label={recipe.type} size="small" sx={{ textTransform: 'capitalize' }} />
            {recipe.method && <Chip label={recipe.method} size="small" variant="outlined" />}
            {recipe.glass_type && <Chip label={recipe.glass_type.replace('_', ' ')} size="small" variant="outlined" />}
            {recipe.ice_type && recipe.ice_type !== 'none' && (
              <Chip label={`${recipe.ice_type.replace('_', ' ')} ice`} size="small" variant="outlined" />
            )}
            {recipe.difficulty && (
              <Chip label={recipe.difficulty} size="small" color={DIFFICULTY_COLOR[recipe.difficulty]} />
            )}
            {Boolean(recipe.is_public) && <Chip label="public" size="small" color="info" />}
            <Chip label={`v${recipe.version}`} size="small" />
          </Box>
        </Box>

        {/* Actions */}
        {isOwner && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Manage images">
              <IconButton onClick={() => setShowImages(true)}>
                <ImageIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Version history">
              <IconButton onClick={loadVersions}>
                <HistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Create riff of">
              <IconButton onClick={handleRiff}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton onClick={() => navigate(`/recipes/${id}/edit`)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton color="error" onClick={() => setConfirmDelete(true)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        {!isOwner && (
          <Tooltip title="Create riff of">
            <IconButton onClick={handleRiff}>
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Primary image */}
      {primaryImage && (
        <Box
          component="img"
          src={`/api/images/${primaryImage.r2_key}`}
          alt={recipe.name}
          sx={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 2, mb: 3 }}
        />
      )}

      {/* Tags */}
      {recipe.tags?.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
          {recipe.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" color="primary" />
          ))}
        </Box>
      )}

      {/* Garnish */}
      {recipe.garnish && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>Garnish:</strong> {recipe.garnish}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Ingredients</Typography>
          <List dense>
            {recipe.ingredients.map((ing) => (
              <ListItem key={ing.id} disableGutters sx={{ py: 0.5 }}>
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                      {(ing.amount !== null || ing.unit) && (
                        <Typography component="span" className="amount" color="primary.main">
                          {ing.amount != null ? ing.amount : ''}{ing.unit ? ` ${ing.unit}` : ''}
                        </Typography>
                      )}
                      <Typography component="span">{ing.name}</Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Steps */}
      {recipe.steps && recipe.steps.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Method</Typography>
          <List>
            {recipe.steps.map((step, idx) => (
              <ListItem key={step.id} alignItems="flex-start" disableGutters sx={{ py: 1 }}>
                <Box sx={{ mr: 2, minWidth: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="primary.main" fontWeight={700}>{idx + 1}</Typography>
                </Box>
                <ListItemText primary={step.description} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Notes */}
      {recipe.notes && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Notes</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {recipe.notes}
            </Typography>
          </Box>
        </>
      )}

      {/* ── Delete confirmation ── */}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete recipe?</DialogTitle>
        <DialogContent>
          <Typography>
            "{recipe.name}" will be permanently deleted, including all versions and images.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── Version history ── */}
      <Dialog open={showVersions} onClose={() => { setShowVersions(false); setPreviewSnapshot(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Version History</DialogTitle>
        <DialogContent>
          {versionsLoading ? (
            <CircularProgress color="primary" />
          ) : versions.length === 0 ? (
            <Typography color="text.secondary">No previous versions saved yet.</Typography>
          ) : (
            <>
              <List>
                {versions.map((v) => (
                  <ListItem key={v.id} disableGutters>
                    <ListItemText
                      primary={`Version ${v.version}`}
                      secondary={new Date(v.changed_at * 1000).toLocaleString()}
                    />
                    <Button size="small" onClick={() => previewVersion(v.id)}>
                      Preview
                    </Button>
                  </ListItem>
                ))}
              </List>
              {previewSnapshot && (
                <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Preview — v{previewSnapshot.version}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {previewSnapshot.ingredients?.map((i) =>
                      `${i.amount ?? ''} ${i.unit ?? ''} ${i.name}`.trim()
                    ).join(', ')}
                  </Typography>
                </Paper>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowVersions(false); setPreviewSnapshot(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Image manager ── */}
      {showImages && id && (
        <ImageManager
          recipeId={id}
          images={recipe.images ?? []}
          onClose={() => setShowImages(false)}
          onUpdate={(images) => setRecipe((r) => r ? { ...r, images } : r)}
        />
      )}
    </Box>
  );
}
