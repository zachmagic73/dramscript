import { useEffect, useState, type MouseEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Chip, Button, Divider, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  List, ListItem, ListItemText, Tooltip, Paper, Menu, MenuItem, useMediaQuery, useTheme,
  ToggleButtonGroup, ToggleButton, TextField, Collapse,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CalculateIcon from '@mui/icons-material/Calculate';
import { Link as RouterLink } from 'react-router-dom';
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
  const location = useLocation();
  const backTo: string = (location.state as { from?: string } | null)?.from ?? '/';
  const backLabel: string = (location.state as { fromLabel?: string } | null)?.fromLabel
    ? `Back to ${(location.state as { fromLabel: string }).fromLabel}`
    : 'Back to journal';
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
  const [calcAnchorEl, setCalcAnchorEl] = useState<null | HTMLElement>(null);
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<Recipe | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<'want_to_make' | 'made' | null>(null);
  const [savedNotes, setSavedNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  // Ingredient coverage (vs. user's inventory)
  interface IngredientMatch { name: string; match: 'exact' | 'fuzzy' | 'missing'; matched_by?: string; }
  const [coverage, setCoverage] = useState<{ has_inventory: boolean; ingredients: IngredientMatch[] } | null>(null);
  const [coverageExpanded, setCoverageExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/recipes/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json() as { recipe: Recipe };
        setRecipe(data.recipe);
        setSavedStatus(data.recipe.saved_status ?? null);
        setSavedNotes(data.recipe.saved_personal_notes ?? '');
        setNotesDirty(false);
      } catch {
        setError('Recipe not found.');
      } finally {
        setLoading(false);
      }

      // Load inventory coverage in the background (non-blocking)
      try {
        const covRes = await fetch(`/api/recipes/${id}/coverage`);
        if (covRes.ok) {
          const covData = await covRes.json() as { has_inventory: boolean; ingredients: Array<{ name: string; match: 'exact' | 'fuzzy' | 'missing'; matched_by?: string }> };
          setCoverage(covData);
        }
      } catch {
        // coverage is non-critical; ignore errors
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

  const upsertSaved = async (
    nextStatus: 'want_to_make' | 'made',
    nextNotes: string,
    successMessage?: string,
  ) => {
    if (!id) return;
    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/recipes/${id}/saved`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          personal_notes: nextNotes,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as {
        saved: {
          status: 'want_to_make' | 'made';
          personal_notes: string | null;
          saved_at: number;
        };
      };

      setSavedStatus(data.saved.status);
      setSavedNotes(data.saved.personal_notes ?? '');
      setNotesDirty(false);
      setRecipe((prev) => prev ? {
        ...prev,
        saved_status: data.saved.status,
        saved_personal_notes: data.saved.personal_notes,
        saved_at: data.saved.saved_at,
      } : prev);
      if (successMessage) setSaveSuccess(successMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save journal entry';
      setSaveError(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAddToJournal = async () => {
    await upsertSaved('want_to_make', savedNotes, 'Added to your journal');
  };

  const handleStatusChange = async (_: MouseEvent<HTMLElement>, value: 'want_to_make' | 'made' | null) => {
    if (!value) return;
    await upsertSaved(value, savedNotes, value === 'made' ? 'Marked as made' : 'Marked as want to make');
  };

  const handleSaveNotes = async () => {
    await upsertSaved(savedStatus ?? 'want_to_make', savedNotes, 'Private notes saved');
  };

  const handleRemoveFromJournal = async () => {
    if (!id) return;
    setSaveLoading(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/recipes/${id}/saved`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setSavedStatus(null);
      setSavedNotes('');
      setNotesDirty(false);
      setRecipe((prev) => prev ? {
        ...prev,
        saved_status: null,
        saved_personal_notes: null,
        saved_at: null,
      } : prev);
      setSaveSuccess('Removed from your journal');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove journal entry';
      setSaveError(msg);
    } finally {
      setSaveLoading(false);
    }
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
  const calcMenuOpen = Boolean(calcAnchorEl);

  return (
    <Box>
      {/* Back */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(backTo)}
        sx={{ mb: 2, color: 'text.secondary' }}
      >
        {backLabel}
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
                  <Divider />
                  <MenuItem onClick={() => { setActionsAnchorEl(null); navigate(`/calculators?recipeId=${id}&tab=batch`); }}>
                    Batch calculator
                  </MenuItem>
                  <MenuItem onClick={() => { setActionsAnchorEl(null); navigate(`/calculators?recipeId=${id}&tab=abv`); }}>
                    ABV calculator
                  </MenuItem>
                  <MenuItem onClick={() => { setActionsAnchorEl(null); navigate(`/calculators?recipeId=${id}&tab=cost`); }}>
                    Cost calculator
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
                <Tooltip title="Open in calculators">
                  <IconButton onClick={(e) => setCalcAnchorEl(e.currentTarget)}>
                    <CalculateIcon />
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
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Create riff of">
              <IconButton onClick={handleRiff}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open in calculators">
              <IconButton onClick={(e) => setCalcAnchorEl(e.currentTarget)}>
                <CalculateIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {!isOwner && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
            My Journal Entry
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This is private to you. The recipe owner cannot see your status or notes.
          </Typography>

          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>{saveSuccess}</Alert>}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
            {!savedStatus && (
              <Button variant="contained" onClick={handleAddToJournal} disabled={saveLoading}>
                Add to My Journal
              </Button>
            )}

            <ToggleButtonGroup
              size="small"
              exclusive
              value={savedStatus ?? ''}
              onChange={handleStatusChange}
              disabled={saveLoading}
            >
              <ToggleButton value="want_to_make">Want To Make</ToggleButton>
              <ToggleButton value="made">Made</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <TextField
            label="My Private Notes"
            value={savedNotes}
            onChange={(e) => {
              setSavedNotes(e.target.value);
              setNotesDirty(true);
              setSaveSuccess(null);
            }}
            multiline
            minRows={3}
            fullWidth
            placeholder="Tasting notes, tweaks, what to buy next time..."
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
            {savedStatus ? (
              <Button color="error" variant="outlined" onClick={handleRemoveFromJournal} disabled={saveLoading}>
                Remove from My Journal
              </Button>
            ) : (
              <Box />
            )}
            <Button
              variant="outlined"
              onClick={handleSaveNotes}
              disabled={saveLoading || (!notesDirty && Boolean(savedStatus))}
            >
              Save Notes
            </Button>
          </Box>
        </Paper>
      )}

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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="h6">Ingredients</Typography>
            {coverage?.has_inventory && (() => {
              const missing = coverage.ingredients.filter((i) => i.match === 'missing').length;
              const fuzzy  = coverage.ingredients.filter((i) => i.match === 'fuzzy').length;
              if (missing === 0 && fuzzy === 0) {
                return (
                  <Chip
                    icon={<CheckCircleOutlineIcon />} label="All in your bar"
                    size="small" color="success" variant="outlined"
                    onClick={() => setCoverageExpanded((p) => !p)}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              }
              return (
                <Chip
                  icon={<WarningAmberIcon />}
                  label={`${missing} missing${fuzzy > 0 ? `, ${fuzzy} fuzzy` : ''}`}
                  size="small" color={missing > 0 ? 'warning' : 'default'} variant="outlined"
                  onClick={() => setCoverageExpanded((p) => !p)}
                  sx={{ cursor: 'pointer' }}
                />
              );
            })()}
          </Box>

          {/* Expandable coverage detail */}
          {coverage?.has_inventory && (
            <Collapse in={coverageExpanded}>
              <Box sx={{ mb: 1.5, p: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Your bar coverage — <RouterLink to="/inventory" style={{ color: 'inherit' }}>manage inventory</RouterLink>
                </Typography>
                {coverage.ingredients.map((ing, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                    {ing.match === 'exact' && <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />}
                    {ing.match === 'fuzzy' && <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0 }} />}
                    {ing.match === 'missing' && <Box sx={{ width: 14, height: 14, flexShrink: 0 }} />}
                    <Typography
                      variant="caption"
                      sx={{
                        flex: 1,
                        color: ing.match === 'exact' ? 'success.main'
                          : ing.match === 'fuzzy' ? 'warning.main'
                          : 'text.disabled',
                      }}
                    >
                      {ing.name}
                      {ing.match === 'fuzzy' && ing.matched_by && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}(matched "{ing.matched_by}" — verify)
                        </Typography>
                      )}
                      {ing.match === 'missing' && (
                        <Typography component="span" variant="caption" color="text.disabled"> — not in your bar</Typography>
                      )}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Collapse>
          )}

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

      {/* Credit / Source */}
      {recipe.source_credit && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Credit / Source
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {recipe.source_credit}
            </Typography>
          </Box>
        </>
      )}

      {/* ── Calculator dropdown menu ── */}
      <Menu
        anchorEl={calcAnchorEl}
        open={calcMenuOpen}
        onClose={() => setCalcAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { setCalcAnchorEl(null); navigate(`/calculators?recipeId=${id}&tab=batch`); }}>
          Batch calculator
        </MenuItem>
        <MenuItem onClick={() => { setCalcAnchorEl(null); navigate(`/calculators?recipeId=${id}&tab=abv`); }}>
          ABV calculator
        </MenuItem>
        <MenuItem onClick={() => { setCalcAnchorEl(null); navigate(`/calculators?recipeId=${id}&tab=cost`); }}>
          Cost calculator
        </MenuItem>
      </Menu>

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
