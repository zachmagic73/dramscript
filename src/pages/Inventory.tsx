import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, TextField, IconButton, Chip, Alert,
  CircularProgress, Autocomplete, Paper, Tooltip, Collapse,
  Button, Tabs, Tab, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Link as RouterLink } from 'react-router-dom';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
}

interface IngredientSuggestion {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  region: string | null;
  flavor_notes: string;
}

interface ShoppingListItem {
  ingredient_name: string;
  unblocks_count: number;
  recipes: Array<{ id: string; name: string; source: 'own' | 'saved' }>;
}

interface IngredientMatch {
  name: string;
  match: 'exact' | 'fuzzy' | 'missing';
  matched_by?: string;
}

interface RecipeCoverage {
  id: string;
  name: string;
  source: 'own' | 'saved';
  total_ingredients: number;
  have_count: number;
  missing_count: number;
  ingredient_matches: IngredientMatch[];
}

interface ShoppingListData {
  inventory_count: number;
  want_to_make_count: number;
  shopping_list: ShoppingListItem[];
  recipe_coverage: RecipeCoverage[];
}

const CATEGORY_COLORS: Record<string, string> = {
  spirit: '#D4AF37',
  liqueur: '#A8891A',
  wine: '#9C6B8A',
  bitter: '#C0392B',
  mixer: '#3A6B8A',
  syrup: '#4A7C59',
  fresh: '#6AAF80',
  spice: '#D4622A',
  other: '#B8A48A',
};

function categoryColor(category: string | null): string {
  return CATEGORY_COLORS[category ?? ''] ?? '#B8A48A';
}

// ── My Bar Tab ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  spirit: 'Spirit',
  liqueur: 'Liqueur',
  wine: 'Wine',
  bitter: 'Bitter',
  mixer: 'Mixer',
  syrup: 'Syrup',
  fresh: 'Fresh',
  spice: 'Spice',
  other: 'Other',
};

function MyBarTab() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<IngredientSuggestion | null>(null);
  const [customCategory, setCustomCategory] = useState<string>('other');
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      if (!res.ok) throw new Error();
      const data = await res.json() as { ingredients: InventoryItem[] };
      setItems(data.ingredients);
    } catch {
      // fail silently; show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleInput = (value: string) => {
    setInputValue(value);
    setAddError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const res = await fetch(`/api/ingredient-reference?q=${encodeURIComponent(value)}&limit=12`);
        if (!res.ok) return;
        const data = await res.json() as { results: IngredientSuggestion[] };
        setSuggestions(data.results);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 200);
  };

  const handleAdd = async () => {
    const name = inputValue.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      const category = selectedSuggestion?.category ?? customCategory;
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category }),
      });
      if (res.status === 409) { setAddError('Already in your inventory.'); return; }
      if (!res.ok) throw new Error();
      const data = await res.json() as { ingredient: InventoryItem };
      setItems((prev) => [...prev, data.ingredient].sort((a, b) => {
        const ca = a.category ?? 'z';
        const cb = b.category ?? 'z';
        return ca !== cb ? ca.localeCompare(cb) : a.name.localeCompare(b.name);
      }));
      setInputValue('');
      setSelectedSuggestion(null);
      setSuggestions([]);
      setCustomCategory('other');
    } catch {
      setAddError('Failed to add ingredient. Try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Group by category
  const grouped = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const key = item.category ?? 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <Box>
      {/* Add ingredient */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Autocomplete
          freeSolo
          options={suggestions}
          getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
          inputValue={inputValue}
          onInputChange={(_, v) => handleInput(v)}
          onChange={(_, val) => {
            if (val && typeof val !== 'string') {
              setSelectedSuggestion(val);
              setInputValue(val.name);
            } else {
              setSelectedSuggestion(null);
            }
          }}
          loading={suggestionsLoading}
          renderOption={(props, option) => {
            const opt = option as IngredientSuggestion;
            return (
              <Box component="li" {...props} key={opt.id}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">{opt.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[opt.subcategory, opt.brand, opt.region].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Chip
                  label={opt.category}
                  size="small"
                  sx={{ ml: 1, fontSize: '0.65rem', bgcolor: `${categoryColor(opt.category)}22`, color: categoryColor(opt.category), border: `1px solid ${categoryColor(opt.category)}55` }}
                />
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Add to your bar"
              placeholder="e.g. Rittenhouse Rye, Aperol…"
              error={!!addError}
              helperText={addError ?? undefined}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            />
          )}
          sx={{ flex: 1, minWidth: 200 }}
        />
        {/* Category selector — shown inline when entering a custom ingredient */}
        {inputValue.trim() && !selectedSuggestion && (
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={customCategory}
              label="Category"
              onChange={(e) => setCustomCategory(e.target.value)}
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: categoryColor(key), flexShrink: 0 }} />
                    {label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Tooltip title="Add">
          <span>
            <IconButton
              onClick={() => void handleAdd()}
              disabled={!inputValue.trim() || adding}
              color="primary"
              sx={{ border: '1px solid', borderColor: 'primary.main', mt: 0.125 }}
            >
              {adding ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : items.length === 0 ? (
        <Alert severity="info" icon={<LocalBarIcon />} sx={{ mt: 2 }}>
          Your bar is empty. Start adding ingredients above to unlock the shopping list.
        </Alert>
      ) : (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            {items.length} ingredient{items.length !== 1 ? 's' : ''} in your bar
          </Typography>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, catItems]) => (
              <Box key={category} sx={{ mb: 2 }}>
                <Typography
                  variant="overline"
                  sx={{ color: categoryColor(category), letterSpacing: 1.2, display: 'block', mb: 0.5 }}
                >
                  {category}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {catItems.map((item) => (
                    <Chip
                      key={item.id}
                      label={item.name}
                      onDelete={() => void handleDelete(item.id)}
                      deleteIcon={<DeleteIcon />}
                      size="small"
                      sx={{
                        bgcolor: `${categoryColor(category)}11`,
                        border: `1px solid ${categoryColor(category)}44`,
                        color: 'text.primary',
                        '& .MuiChip-deleteIcon': { color: 'text.secondary', '&:hover': { color: 'error.main' } },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
        </Box>
      )}
    </Box>
  );
}

// ── Shopping List Tab ─────────────────────────────────────────────────────────

function MatchBadge({ match, matchedBy }: { match: IngredientMatch['match']; matchedBy?: string }) {
  if (match === 'exact') {
    return (
      <Tooltip title="In your bar (exact match)">
        <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main', flexShrink: 0 }} />
      </Tooltip>
    );
  }
  if (match === 'fuzzy') {
    return (
      <Tooltip title={`Partial match — you have "${matchedBy}" (verify it's the same)`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
          <WarningAmberIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" color="warning.main">{matchedBy}</Typography>
        </Box>
      </Tooltip>
    );
  }
  return null;
}

function RecipeCoverageRow({ coverage }: { coverage: RecipeCoverage }) {
  const [expanded, setExpanded] = useState(false);
  const pct = coverage.total_ingredients > 0
    ? Math.round((coverage.have_count / coverage.total_ingredients) * 100)
    : 0;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 0.5 }}
        onClick={() => setExpanded((p) => !p)}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              component={RouterLink}
              to={`/recipes/${coverage.id}`}
              onClick={(e) => e.stopPropagation()}
              sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              {coverage.name}
            </Typography>
            {coverage.source === 'saved' && (
              <Chip label="saved" size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
            )}
          </Box>
          {/* Progress bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: pct === 100 ? 'success.main' : 'primary.main', borderRadius: 2 }} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {coverage.have_count}/{coverage.total_ingredients}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider', ml: 0.5 }}>
          {coverage.ingredient_matches.map((ing, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 0.25,
                opacity: ing.match === 'missing' ? 0.5 : 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  textDecoration: ing.match === 'missing' ? 'none' : 'none',
                  color: ing.match === 'exact' ? 'success.main'
                    : ing.match === 'fuzzy' ? 'warning.main'
                    : 'text.secondary',
                }}
              >
                {ing.name}
              </Typography>
              <MatchBadge match={ing.match} matchedBy={ing.matched_by} />
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function ShoppingListTab() {
  const [data, setData] = useState<ShoppingListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/shopping-list');
      if (!res.ok) throw new Error();
      const json = await res.json() as ShoppingListData;
      setData(json);
    } catch {
      setError('Could not load shopping list. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress color="primary" /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const { shopping_list, recipe_coverage, want_to_make_count } = data;

  if (want_to_make_count === 0) {
    return (
      <Alert severity="info" icon={<ShoppingCartIcon />}>
        Flag recipes as "Want to make" (on the recipe or in your saved recipes) and your shopping list will appear here.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Summary */}
      <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {want_to_make_count} recipe{want_to_make_count !== 1 ? 's' : ''} flagged · {data.inventory_count} ingredients in your bar ·{' '}
          <strong style={{ color: shopping_list.length === 0 ? '#4A7C59' : '#D4AF37' }}>
            {shopping_list.length === 0 ? 'You can make everything!' : `${shopping_list.length} item${shopping_list.length !== 1 ? 's' : ''} to buy`}
          </strong>
        </Typography>
      </Box>

      {/* Shopping list */}
      {shopping_list.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
            What to buy
          </Typography>
          {shopping_list.map((item) => (
            <Paper
              key={item.ingredient_name}
              variant="outlined"
              sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>{item.ingredient_name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Needed for:{' '}
                  {item.recipes.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ', '}
                      <RouterLink to={`/recipes/${r.id}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {r.name}
                      </RouterLink>
                      {r.source === 'saved' && ' (saved)'}
                    </span>
                  ))}
                </Typography>
              </Box>
              <Chip
                label={`unlocks ${item.unblocks_count}`}
                size="small"
                color={item.unblocks_count >= 3 ? 'primary' : 'default'}
                sx={{ flexShrink: 0, fontSize: '0.65rem' }}
              />
            </Paper>
          ))}
        </Box>
      )}

      {/* Recipe coverage */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
          Recipe coverage
        </Typography>
        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2, fontSize: '0.75rem' }}>
          <strong>Fuzzy match</strong> — shown with a ⚠ when your inventory partially matches a recipe ingredient (e.g. "bourbon" matches "Bulleit Bourbon"). Verify it's the same thing.
        </Alert>
        {recipe_coverage.map((cov) => (
          <RecipeCoverageRow key={cov.id} coverage={cov} />
        ))}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" color="inherit" onClick={() => void load()}>
          Refresh
        </Button>
      </Box>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Inventory() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', mb: 0.5 }}>
        My Bar
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Track what's in your home bar and generate a shopping list from recipes you want to make.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab label="Inventory" icon={<LocalBarIcon />} iconPosition="start" />
        <Tab label="Shopping List" icon={<ShoppingCartIcon />} iconPosition="start" />
      </Tabs>

      {tab === 0 && <MyBarTab />}
      {tab === 1 && <ShoppingListTab />}
    </Box>
  );
}
