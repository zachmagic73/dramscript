import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Chip, Button, Divider, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  List, ListItem, ListItemText, Tooltip, Paper, Menu, MenuItem, useMediaQuery, useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { Recipe, RecipeVersion } from '../types';
import ImageManager from '../components/ImageManager';
import { useAuth } from '../hooks/useAuth';
import { formatAmountWithPreference } from '../utils/units';

const DIFFICULTY_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  easy: 'success', medium: 'warning', hard: 'error',
};

function formatFieldLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [actionsAnchorEl, setActionsAnchorEl] = useState<null | HTMLElement>(null);
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

  const restoreVersion = async (versionId: string) => {
    if (!id) return;
    const res = await fetch(`/api/versions/${versionId}`, { method: 'POST' });
    if (!res.ok) return;
    await loadVersions();
    const recipeRes = await fetch(`/api/recipes/${id}`);
    if (!recipeRes.ok) return;
    const data = await recipeRes.json() as { recipe: Recipe };
    setRecipe(data.recipe);
    setPreviewSnapshot(null);
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
  const ownerMenuOpen = Boolean(actionsAnchorEl);

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
            {recipe.method && <Chip label={recipe.method} size="small" variant="outlined" />}
            {recipe.difficulty && (
              <Chip label={recipe.difficulty} size="small" color={DIFFICULTY_COLOR[recipe.difficulty]} />
            )}
            {Boolean(recipe.is_public) && <Chip label="public" size="small" color="info" />}
            <Chip label={`v${recipe.version}`} size="small" />
          </Box>
        </Box>

        {/* Actions */}
        {isOwner && (
          <>
            {isMobile ? (
              <>
                <IconButton onClick={(e) => setActionsAnchorEl(e.currentTarget)} aria-label="Recipe actions">
                  <MoreVertIcon />
                </IconButton>
                <Menu
                  anchorEl={actionsAnchorEl}
                  open={ownerMenuOpen}
                  onClose={() => setActionsAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem onClick={() => { setActionsAnchorEl(null); setShowImages(true); }}>
                    Manage images
                  </MenuItem>
                  <MenuItem onClick={() => { setActionsAnchorEl(null); void loadVersions(); }}>
                    Version history
                  </MenuItem>
                  <MenuItem onClick={() => { setActionsAnchorEl(null); void handleRiff(); }}>
                    Create riff of
                  </MenuItem>
                  <MenuItem onClick={() => { setActionsAnchorEl(null); navigate(`/recipes/${id}/edit`); }}>
                    Edit
                  </MenuItem>
                  <MenuItem
                    onClick={() => { setActionsAnchorEl(null); setConfirmDelete(true); }}
                    sx={{ color: 'error.main' }}
                  >
                    Delete
                  </MenuItem>
                </Menu>
              </>
            ) : (
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
          </>
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
          sx={{
            width: { xs: '100%', sm: 320 },
            height: { xs: 'auto', sm: 320 },
            aspectRatio: { xs: 'auto', sm: '1' },
            objectFit: 'cover',
            borderRadius: 2,
            mb: 3,
            mx: { xs: 0, sm: 'auto' },
            display: { xs: 'block', sm: 'block' },
          }}
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        <strong>Type:</strong> {formatFieldLabel(recipe.type)}
      </Typography>
      {recipe.glass_type && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <strong>Glassware:</strong> {formatFieldLabel(recipe.glass_type)}
        </Typography>
      )}
      {recipe.ice_type && recipe.ice_type !== 'none' && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <strong>Ice:</strong> {formatFieldLabel(recipe.ice_type)}
        </Typography>
      )}
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
              <ListItem key={ing.id} disableGutters sx={{ py: 0.5, flexDirection: 'column', alignItems: 'flex-start' }}>
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      {(ing.amount !== null || ing.unit) && (
                        <Typography component="span" className="amount" color="primary.main">
                          {formatAmountWithPreference(ing.amount, ing.unit, user?.default_units ?? 'oz')}
                        </Typography>
                      )}
                      <Typography component="span">{ing.name}</Typography>
                      {(ing as any).referenced_recipe_id && (ing as any).referencedRecipe && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/recipes/${(ing as any).referencedRecipe.id}`)}
                          sx={{ textTransform: 'none', ml: 'auto' }}
                        >
                          → {(ing as any).referencedRecipe.name}
                        </Button>
                      )}
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
                    <Button size="small" color="warning" onClick={() => restoreVersion(v.id)}>
                      Restore
                    </Button>
                  </ListItem>
                ))}
              </List>
              {previewSnapshot && (
                <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Preview — v{previewSnapshot.version}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {previewSnapshot.ingredients?.map((i) =>
                      `${formatAmountWithPreference(i.amount, i.unit, user?.default_units ?? 'oz')} ${i.name}`.trim()
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
