import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl,
  Button, Switch, FormControlLabel, Chip, Autocomplete, Alert,
  CircularProgress, Divider, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Recipe, RecipeFormValues } from '../types';
import { RECIPE_TYPES, ICE_TYPES, METHODS, DIFFICULTIES, UNITS, GLASS_TYPES } from '../types';
import CocktailSpritePlaceholder from '../components/CocktailSpritePlaceholder';
import { ICON_COUNT, resolvePlaceholderIcon } from '../utils/cocktailIcons';

// ── Sortable ingredient row ───────────────────────────────────────────────────
function SortableIngredientRow({
  ing,
  onChange,
  onRemove,
}: {
  ing: RecipeFormValues['ingredients'][number];
  onChange: (field: string, value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ing.id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: { xs: 'flex-start', sm: 'center' },
        mb: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <IconButton size="small" sx={{ cursor: 'grab', color: 'text.disabled', touchAction: 'none' }} {...attributes} {...listeners}>
        <DragIndicatorIcon fontSize="small" />
      </IconButton>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Desktop/tablet: single-line layout */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Amount" value={ing.amount}
            onChange={(e) => onChange('amount', e.target.value)}
            sx={{ width: 90 }}
            slotProps={{ htmlInput: { type: 'number', min: 0, step: 0.25 } }}
          />
          <FormControl size="small" sx={{ width: 110 }}>
            <Select value={ing.unit} onChange={(e) => onChange('unit', e.target.value)} displayEmpty>
              <MenuItem value=""><em>unit</em></MenuItem>
              {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" placeholder="Ingredient name" value={ing.name}
            onChange={(e) => onChange('name', e.target.value)}
            sx={{ flex: 1 }}
          />
        </Box>

        {/* Mobile: amount + unit on first line, ingredient on second line */}
        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small" placeholder="Amount" value={ing.amount}
              onChange={(e) => onChange('amount', e.target.value)}
              sx={{ width: 110 }}
              slotProps={{ htmlInput: { type: 'number', min: 0, step: 0.25 } }}
            />
            <FormControl size="small" sx={{ width: 130 }}>
              <Select value={ing.unit} onChange={(e) => onChange('unit', e.target.value)} displayEmpty>
                <MenuItem value=""><em>unit</em></MenuItem>
                {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Ingredient name"
            value={ing.name}
            onChange={(e) => onChange('name', e.target.value)}
          />
        </Box>
      </Box>

      <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: { xs: 0.5, sm: 0 } }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Sortable step row ─────────────────────────────────────────────────────────
function SortableStepRow({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: RecipeFormValues['steps'][number];
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <IconButton size="small" sx={{ cursor: 'grab', color: 'text.disabled', mt: 0.5, touchAction: 'none' }} {...attributes} {...listeners}>
        <DragIndicatorIcon fontSize="small" />
      </IconButton>
      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(212,175,55,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1, flexShrink: 0 }}>
        <Typography variant="caption" color="primary.main" fontWeight={700}>{index + 1}</Typography>
      </Box>
      <TextField
        size="small" multiline minRows={1} maxRows={4}
        placeholder="Describe this step…"
        value={step.description}
        onChange={(e) => onChange(e.target.value)}
        sx={{ flex: 1 }}
      />
      <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyIng() {
  return { id: crypto.randomUUID(), name: '', amount: '', unit: '' };
}

function emptyStep() {
  return { id: crypto.randomUUID(), description: '' };
}

function recipeToPrefill(r: Recipe): Partial<RecipeFormValues> {
  return {
    name: r.name ?? '',
    type: r.type,
    glass_type: r.glass_type ?? '',
    ice_type: r.ice_type ?? '',
    method: r.method ?? '',
    garnish: r.garnish ?? '',
    notes: r.notes ?? '',
    difficulty: r.difficulty ?? '',
    tags: r.tags ?? [],
    is_public: Boolean(r.is_public),
    want_to_make: Boolean(r.want_to_make),
    placeholder_icon: r.placeholder_icon ?? null,
    template_id: r.template_id ?? null,
    source_recipe_id: (r as Recipe & { source_recipe_id?: string | null }).source_recipe_id ?? null,
    servings: r.servings ?? 1,
    ingredients: r.ingredients?.map((i) => ({
      id: crypto.randomUUID(),
      name: i.name,
      amount: i.amount != null ? String(i.amount) : '',
      unit: i.unit ?? '',
    })) ?? [],
    steps: r.steps?.map((s) => ({ id: crypto.randomUUID(), description: s.description })) ?? [],
  };
}

const COMMON_TAGS = [
  'citrusy', 'herbal', 'boozy', 'bitter', 'sweet', 'smoky', 'tropical',
  'sour', 'refreshing', 'spirit-forward', 'low-ABV', 'brunch', 'holiday',
  'poolside', 'date night', 'winter', 'summer',
];

// ── Main component ────────────────────────────────────────────────────────────
const DEFAULT_VALUES: RecipeFormValues = {
  name: '', type: 'cocktail', glass_type: '', ice_type: '', method: '',
  garnish: '', notes: '', difficulty: '', tags: [],
  is_public: false, want_to_make: true, placeholder_icon: null,
  template_id: null, source_recipe_id: null,
  servings: 1,
  ingredients: [emptyIng()],
  steps: [emptyStep()],
};

export default function RecipeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = Boolean(id);

  const [values, setValues] = useState<RecipeFormValues>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load existing recipe for edit, or apply prefill (riff / template)
  useEffect(() => {
    const prefill = (location.state as { prefill?: Recipe } | null)?.prefill;

    if (isEdit && id) {
      void (async () => {
        const res = await fetch(`/api/recipes/${id}`);
        if (!res.ok) { setError('Recipe not found'); setLoading(false); return; }
        const data = await res.json() as { recipe: Recipe };
        setValues({ ...DEFAULT_VALUES, ...recipeToPrefill(data.recipe) });
        setLoading(false);
      })();
    } else if (prefill) {
      setValues({ ...DEFAULT_VALUES, ...recipeToPrefill(prefill) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof RecipeFormValues>(field: K, value: RecipeFormValues[K]) =>
    setValues((v) => ({ ...v, [field]: value }));

  // Ingredient helpers
  const updateIng = (idx: number, field: string, value: string) =>
    setValues((v) => {
      const ings = [...v.ingredients];
      ings[idx] = { ...ings[idx], [field]: value };
      return { ...v, ingredients: ings };
    });

  const removeIng = (idx: number) =>
    setValues((v) => ({ ...v, ingredients: v.ingredients.filter((_, i) => i !== idx) }));

  const addIng = () => setValues((v) => ({ ...v, ingredients: [...v.ingredients, emptyIng()] }));

  const onIngDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setValues((v) => {
      const oldIdx = v.ingredients.findIndex((i) => i.id === active.id);
      const newIdx = v.ingredients.findIndex((i) => i.id === over.id);
      return { ...v, ingredients: arrayMove(v.ingredients, oldIdx, newIdx) };
    });
  };

  // Step helpers
  const updateStep = (idx: number, value: string) =>
    setValues((v) => {
      const stps = [...v.steps];
      stps[idx] = { ...stps[idx], description: value };
      return { ...v, steps: stps };
    });

  const removeStep = (idx: number) =>
    setValues((v) => ({ ...v, steps: v.steps.filter((_, i) => i !== idx) }));

  const addStep = () => setValues((v) => ({ ...v, steps: [...v.steps, emptyStep()] }));

  const onStepDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setValues((v) => {
      const oldIdx = v.steps.findIndex((s) => s.id === active.id);
      const newIdx = v.steps.findIndex((s) => s.id === over.id);
      return { ...v, steps: arrayMove(v.steps, oldIdx, newIdx) };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) { setError('Recipe name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...values,
        ingredients: values.ingredients
          .filter((i) => i.name.trim())
          .map((i) => ({
            name: i.name,
            amount: i.amount !== '' ? parseFloat(i.amount) : null,
            unit: i.unit || null,
          })),
        steps: values.steps
          .filter((s) => s.description.trim())
          .map((s) => ({ description: s.description })),
      };

      const url = isEdit ? `/api/recipes/${id}` : '/api/recipes';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save');
      }

      const data = await res.json() as { id?: string };
      navigate(`/recipes/${id ?? data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress color="primary" />
    </Box>
  );

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 700, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2, color: 'text.secondary' }}>
        Back
      </Button>

      <Typography variant="h4" gutterBottom>
        {isEdit ? 'Edit Recipe' : 'New Recipe'}
      </Typography>

      {values.source_recipe_id && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Creating a riff — your changes are saved as a new independent recipe.
        </Alert>
      )}
      {values.template_id && !values.source_recipe_id && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Starting from a template. Make it yours!
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Core fields ── */}
      <TextField
        fullWidth required label="Recipe name" value={values.name}
        onChange={(e) => set('name', e.target.value)} sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField
          select label="Type" value={values.type} size="small"
          onChange={(e) => set('type', e.target.value as RecipeFormValues['type'])}
          sx={{ minWidth: 140 }}
        >
          {RECIPE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>

        <TextField
          select label="Glass" value={values.glass_type} size="small"
          onChange={(e) => set('glass_type', e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value=""><em>None</em></MenuItem>
          {GLASS_TYPES.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
        </TextField>

        <TextField
          select label="Ice" value={values.ice_type} size="small"
          onChange={(e) => set('ice_type', e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value=""><em>Not specified</em></MenuItem>
          {ICE_TYPES.map((i) => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
        </TextField>

        <TextField
          select label="Method" value={values.method} size="small"
          onChange={(e) => set('method', e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value=""><em>Not specified</em></MenuItem>
          {METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </TextField>

        <TextField
          select label="Difficulty" value={values.difficulty} size="small"
          onChange={(e) => set('difficulty', e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value=""><em>Not specified</em></MenuItem>
          {DIFFICULTIES.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
        </TextField>

        <TextField
          label="Servings" type="number" value={values.servings} size="small"
          onChange={(e) => set('servings', Math.max(1, parseInt(e.target.value) || 1))}
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 120 }}
        />
      </Box>

      <TextField
        fullWidth label="Garnish" value={values.garnish}
        onChange={(e) => set('garnish', e.target.value)} sx={{ mb: 2 }}
      />

      {/* ── Tags ── */}
      <Autocomplete
        multiple freeSolo
        options={COMMON_TAGS}
        value={values.tags}
        inputValue={tagInput}
        onInputChange={(_, v) => setTagInput(v)}
        onChange={(_, v) => set('tags', v)}
        renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add a tag…" />}
        renderTags={(val, getTagProps) =>
          val.map((tag, index) => (
            <Chip label={tag} {...getTagProps({ index })} key={tag} size="small" color="primary" />
          ))
        }
        sx={{ mb: 2 }}
      />

      {/* ── Visibility toggles ── */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControlLabel
          control={<Switch checked={values.is_public} onChange={(e) => set('is_public', e.target.checked)} color="primary" />}
          label={(
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography component="span">Public recipe</Typography>
              <Tooltip title="Public recipes can be viewed and riffed by other users. Your private notes stay on your own journal copy.">
                <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Tooltip>
            </Box>
          )}
        />

        <TextField
          select
          label="State"
          size="small"
          value={values.want_to_make ? 'want_to_make' : 'made'}
          onChange={(e) => set('want_to_make', e.target.value === 'want_to_make')}
          sx={{ minWidth: 180 }}
          helperText="Tracked per user + recipe copy"
        >
          <MenuItem value="want_to_make">Want to make</MenuItem>
          <MenuItem value="made">Made</MenuItem>
        </TextField>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            onClick={() => setIconPickerOpen(true)}
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
            }}
          >
            <CocktailSpritePlaceholder
              seed={`${values.name}:${values.type}:${values.glass_type}:${values.garnish}:${values.ice_type}`}
              fallbackEmoji="🍸"
              iconNumber={resolvePlaceholderIcon(values, values.placeholder_icon)}
              height={56}
              width={56}
              withBottomBorder={false}
            />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Placeholder icon
            </Typography>
            <Button size="small" onClick={() => setIconPickerOpen(true)} sx={{ px: 0.5, minWidth: 'auto' }}>
              {values.placeholder_icon == null ? 'Auto' : `Icon ${values.placeholder_icon}`}
            </Button>
          </Box>
        </Box>
      </Box>

      <Dialog open={iconPickerOpen} onClose={() => setIconPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Choose Placeholder Icon</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 1.5 }}>
            <Button
              variant={values.placeholder_icon == null ? 'contained' : 'outlined'}
              size="small"
              onClick={() => set('placeholder_icon', null)}
            >
              Auto (glass + garnish + ice)
            </Button>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(4, 64px)', sm: 'repeat(6, 64px)' },
              justifyContent: 'center',
              gap: 1,
            }}
          >
            {Array.from({ length: ICON_COUNT }, (_, i) => i + 1).map((iconNum) => {
              const selected = values.placeholder_icon === iconNum;
              return (
                <Box
                  key={iconNum}
                  onClick={() => set('placeholder_icon', iconNum)}
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '2px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    cursor: 'pointer',
                  }}
                >
                  <CocktailSpritePlaceholder
                    seed={`picker:${iconNum}`}
                    fallbackEmoji="🍸"
                    iconNumber={iconNum}
                    height={64}
                    width={64}
                    withBottomBorder={false}
                  />
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIconPickerOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Divider sx={{ my: 3 }} />

      {/* ── Ingredients ── */}
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Ingredients</Typography>
        <Tooltip title="Add ingredient">
          <IconButton size="small" color="primary" onClick={addIng}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
        <SortableContext items={values.ingredients.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {values.ingredients.map((ing, idx) => (
            <SortableIngredientRow
              key={ing.id}
              ing={ing}
              onChange={(field, value) => updateIng(idx, field, value)}
              onRemove={() => removeIng(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button startIcon={<AddIcon />} size="small" onClick={addIng} sx={{ mt: 0.5, mb: 3 }}>
        Add ingredient
      </Button>

      <Divider sx={{ my: 3 }} />

      {/* ── Steps ── */}
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Method</Typography>
        <Tooltip title="Add step">
          <IconButton size="small" color="primary" onClick={addStep}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
        <SortableContext items={values.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {values.steps.map((step, idx) => (
            <SortableStepRow
              key={step.id}
              step={step}
              index={idx}
              onChange={(value) => updateStep(idx, value)}
              onRemove={() => removeStep(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button startIcon={<AddIcon />} size="small" onClick={addStep} sx={{ mt: 0.5, mb: 3 }}>
        Add step
      </Button>

      <Divider sx={{ my: 3 }} />

      {/* ── Notes ── */}
      <TextField
        fullWidth multiline minRows={3}
        label="Notes (optional)"
        placeholder="Bartender notes, substitution ideas, serving suggestions…"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
        sx={{ mb: 3 }}
      />

      {/* ── Submit ── */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button type="submit" variant="contained" size="large" disabled={saving}>
          {saving ? <CircularProgress size={20} color="inherit" /> : isEdit ? 'Save changes' : 'Create recipe'}
        </Button>
        <Button size="large" onClick={() => navigate(-1)} disabled={saving}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
