import { useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Grid2 as Grid, Chip, CircularProgress, Alert,
  Button, Select, MenuItem, FormControl, InputLabel,
  Card, CardActionArea, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, List, ListItem, ListItemText,
  Autocomplete, TextField, FormControlLabel, Switch,
} from '@mui/material';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import MoodIcon from '@mui/icons-material/EmojiEmotions';
import SpiritIcon from '@mui/icons-material/Liquor';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import GrassIcon from '@mui/icons-material/Grass';
import TerrainIcon from '@mui/icons-material/Terrain';
import SpaIcon from '@mui/icons-material/Spa';
import ParkIcon from '@mui/icons-material/Park';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import WineBarIcon from '@mui/icons-material/WineBar';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import AirIcon from '@mui/icons-material/Air';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import OpacityIcon from '@mui/icons-material/Opacity';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import FilterVintageIcon from '@mui/icons-material/FilterVintage';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import GrainIcon from '@mui/icons-material/Grain';
import RecipeCard from '../components/RecipeCard';
import type { Recipe } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryResult {
  id: string;
  name: string;
  type: string;
  difficulty: string | null;
  tags: string[];
  display_name: string | null;
  primary_image: string | null;
  placeholder_icon: number | null;
  glass_type: string | null;
  garnish: string | null;
  ice_type: string | null;
  missing_count: number;
  missing_ingredients: string[];
  total_ingredients: number;
}

interface MoodResult {
  id: string;
  name: string;
  type: string;
  difficulty: string | null;
  tags: string[];
  display_name: string | null;
  primary_image: string | null;
  placeholder_icon: number | null;
  glass_type: string | null;
  garnish: string | null;
  ice_type: string | null;
  score: number;
  matched_moods: string[];
}

interface MoodDiscoverResponse {
  results: MoodResult[];
  template_results: TemplateDiscoverResult[];
  inventory_count?: number;
}

interface SpiritResult {
  id: string;
  name: string;
  type: string;
  difficulty: string | null;
  tags: string[];
  display_name: string | null;
  primary_image: string | null;
  placeholder_icon: number | null;
  glass_type: string | null;
  garnish: string | null;
  ice_type: string | null;
  matched_spirit: string | null;
  matched_modifier: string | null;
}

interface SpiritDiscoverResponse {
  results: SpiritResult[];
  template_results: TemplateDiscoverResult[];
  inventory_count?: number;
}

interface TemplateDiscoverResult {
  id: string;
  name: string;
  description: string | null;
  base_type: string | null;
  riff_count: number;
  // inventory mode only:
  missing_count?: number;
  missing_ingredients?: string[];
  total_ingredients?: number;
}

interface AiSuggestion {
  name: string;
  pitch: string;
  ingredients: string[];
  steps: string[];
}

interface IngredientSuggestion {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  region: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WIZARD_STEPS: Array<{
  id: string;
  question: string;
  icon: typeof LocalBarIcon;
  options: Array<{ value: string; label: string; icon: typeof LocalBarIcon }>;
}> = [
  {
    id: 'spirit',
    question: "What's your base spirit?",
    icon: SpiritIcon,
    options: [
      { value: 'bourbon', label: 'Bourbon', icon: SportsBarIcon },
      { value: 'rye', label: 'Rye Whiskey', icon: GrassIcon },
      { value: 'scotch', label: 'Scotch', icon: TerrainIcon },
      { value: 'gin', label: 'Gin', icon: SpaIcon },
      { value: 'rum', label: 'Rum', icon: LocalBarIcon },
      { value: 'tequila', label: 'Tequila', icon: ParkIcon },
      { value: 'mezcal', label: 'Mezcal', icon: WhatshotIcon },
      { value: 'vodka', label: 'Vodka', icon: AcUnitIcon },
      { value: 'brandy', label: 'Brandy', icon: WineBarIcon },
      { value: 'amaro', label: 'Amaro', icon: SpaIcon },
    ],
  },
  {
    id: 'character',
    question: "What's the vibe?",
    icon: AutoAwesomeIcon,
    options: [
      { value: 'sweet', label: 'Sweet', icon: BakeryDiningIcon },
      { value: 'dry', label: 'Dry', icon: GrassIcon },
      { value: 'sour', label: 'Sour & Tart', icon: MyLocationIcon },
      { value: 'bitter', label: 'Bitter', icon: SpaIcon },
      { value: 'smoky', label: 'Smoky', icon: AirIcon },
      { value: 'boozy', label: 'Boozy', icon: FitnessCenterIcon },
      { value: 'refreshing', label: 'Refreshing', icon: OpacityIcon },
      { value: 'cozy', label: 'Cozy', icon: WbSunnyIcon },
      { value: 'low-abv', label: 'Low ABV', icon: BubbleChartIcon },
    ],
  },
  {
    id: 'finish',
    question: 'Any flavor notes?',
    icon: MyLocationIcon,
    options: [
      { value: 'citrusy', label: 'Citrusy', icon: WbSunnyIcon },
      { value: 'floral', label: 'Floral', icon: LocalFloristIcon },
      { value: 'tropical', label: 'Tropical', icon: ParkIcon },
      { value: 'spirit-forward', label: 'Spirit-Forward', icon: LocalBarIcon },
      { value: 'herbal', label: 'Herbal', icon: SpaIcon },
      { value: 'spiced', label: 'Spiced', icon: WhatshotIcon },
      { value: 'nutty', label: 'Nutty', icon: GrainIcon },
      { value: 'fruity', label: 'Fruity', icon: FilterVintageIcon },
      { value: 'earthy', label: 'Earthy', icon: RestaurantIcon },
    ],
  },
];

const SPIRIT_OPTIONS = [
  { value: 'bourbon', label: 'Bourbon' },
  { value: 'rye', label: 'Rye Whiskey' },
  { value: 'scotch', label: 'Scotch' },
  { value: 'whiskey', label: 'Whiskey (All)' },
  { value: 'gin', label: 'Gin' },
  { value: 'rum', label: 'Rum' },
  { value: 'tequila', label: 'Tequila' },
  { value: 'mezcal', label: 'Mezcal' },
  { value: 'vodka', label: 'Vodka' },
  { value: 'brandy', label: 'Brandy / Cognac' },
  { value: 'agave', label: 'Agave (All)' },
];

const MODIFIER_OPTIONS = [
  { value: '', label: 'Any / None' },
  { value: 'vermouth', label: 'Vermouth' },
  { value: 'amaro', label: 'Amaro / Aperitif' },
  { value: 'citrus', label: 'Citrus' },
  { value: 'syrup', label: 'Sweet / Syrup' },
  { value: 'bitter', label: 'Bitters' },
  { value: 'liqueur', label: 'Liqueur' },
  { value: 'wine', label: 'Wine / Sparkling' },
  { value: 'mixer', label: 'Mixer / Soda' },
  { value: 'specific-ingredient', label: 'Specific Ingredient' },
];

// ── Shared result card ────────────────────────────────────────────────────────

function DiscoverRecipeCard({
  id,
  name,
  type,
  difficulty,
  tags,
  display_name,
  primary_image,
  placeholder_icon,
  glass_type,
  garnish,
  ice_type,
  children,
  onClick,
}: {
  id: string;
  name: string;
  type: string;
  difficulty: string | null;
  tags: string[];
  display_name: string | null;
  primary_image: string | null;
  placeholder_icon: number | null;
  glass_type: string | null;
  garnish: string | null;
  ice_type: string | null;
  children?: React.ReactNode;
  onClick: () => void;
}) {
  const recipe: Recipe = {
    id,
    name,
    type: type as Recipe['type'],
    difficulty: difficulty as Recipe['difficulty'],
    tags,
    user_id: '',
    glass_type: glass_type as Recipe['glass_type'],
    ice_type: ice_type as Recipe['ice_type'],
    method: null,
    garnish,
    notes: null,
    source_credit: null,
    version: 1,
    is_public: 1,
    want_to_make: 0,
    placeholder_icon,
    template_id: null,
    source_recipe_id: null,
    servings: 1,
    created_at: 0,
    updated_at: 0,
    display_name: display_name ?? undefined,
    primary_image: primary_image ?? null,
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={onClick} sx={{ flexGrow: 1, alignItems: 'flex-start', display: 'flex', flexDirection: 'column', width: '100%' }}>
        <RecipeCard recipe={recipe} showCreator={true} bare />
      </CardActionArea>
      {children && <Box sx={{ px: 2, pb: 2 }}>{children}</Box>}
    </Card>
  );
}

// ── Template results section ──────────────────────────────────────────────────

function TemplateResultSection({
  templateResults,
  onNavigate,
}: {
  templateResults: TemplateDiscoverResult[];
  onNavigate: (id: string) => void;
}) {
  if (templateResults.length === 0) return null;
  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Typography variant="h6" sx={{ mb: 2 }}>From The Template Library</Typography>
      <Grid container spacing={2}>
        {templateResults.map((t) => (
          <Grid key={t.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea
                onClick={() => onNavigate(t.id)}
                sx={{ p: 2, height: '100%', flexDirection: 'column', alignItems: 'flex-start', display: 'flex' }}>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                  <Chip label="Template" size="small" variant="outlined" color="info" />
                  {t.base_type && <Chip label={t.base_type} size="small" />}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>{t.name}</Typography>
                {t.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.description}
                  </Typography>
                )}
                <Box sx={{ mt: 'auto', pt: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {t.missing_count !== undefined ? (
                    t.missing_count === 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckCircleOutlineIcon fontSize="small" color="success" />
                        <Typography variant="caption" color="success.light">Fully makeable</Typography>
                      </Box>
                    ) : (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <WarningAmberIcon fontSize="small" color="warning" />
                          <Typography variant="caption" color="warning.light">
                            Missing {t.missing_count} of {t.total_ingredients}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                          {(t.missing_ingredients ?? []).slice(0, 3).join(', ')}
                          {(t.missing_ingredients?.length ?? 0) > 3 ? ` +${(t.missing_ingredients?.length ?? 0) - 3} more` : ''}
                        </Typography>
                      </Box>
                    )
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      {t.riff_count} riff{t.riff_count !== 1 ? 's' : ''}
                    </Typography>
                  )}
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

// ── AI Suggestions Panel ──────────────────────────────────────────────────────

function AiRecipeDialog({
  suggestion,
  onClose,
}: {
  suggestion: AiSuggestion | null;
  onClose: () => void;
}) {
  if (!suggestion) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon color="primary" fontSize="small" />
        {suggestion.name}
        <Chip label="AI Generated" size="small" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {suggestion.pitch}
        </Typography>

        {suggestion.ingredients?.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Ingredients</Typography>
            <List dense disablePadding sx={{ mb: 2 }}>
              {suggestion.ingredients.map((ing, i) => (
                <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                  <ListItemText primary={ing} primaryTypographyProps={{ variant: 'body2' }} />
                </ListItem>
              ))}
            </List>
            <Divider sx={{ mb: 2 }} />
          </>
        )}

        {suggestion.steps?.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Steps</Typography>
            <List dense disablePadding>
              {suggestion.steps.map((step, i) => (
                <ListItem key={i} disableGutters alignItems="flex-start" sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`${i + 1}. ${step}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function AiSuggestionsPanel({
  suggestions,
  loading,
  error: _error,
}: {
  suggestions: AiSuggestion[];
  loading: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<AiSuggestion | null>(null);

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mt: 3,
          borderColor: 'primary.main',
          borderStyle: 'dashed',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}>
        <AutoAwesomeIcon color="primary" />
        <Box>
          <Typography variant="subtitle2" color="primary">AI Picks</Typography>
          <Typography variant="body2" color="text.secondary">Generating suggestions…</Typography>
        </Box>
        <CircularProgress size={20} sx={{ ml: 'auto' }} />
      </Paper>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <>
      <Paper variant="outlined" sx={{ p: 3, mt: 3, borderColor: 'primary.main', borderStyle: 'dashed' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AutoAwesomeIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" color="primary">AI Picks</Typography>
          <Chip label="AI Generated" size="small" sx={{ ml: 'auto', fontSize: '0.65rem' }} />
        </Box>
        <Grid container spacing={2}>
          {suggestions.map((s, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                onClick={() => setSelected(s)}>
                <CardActionArea sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>{s.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{s.pitch}</Typography>
                  <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                    Tap to see full recipe →
                  </Typography>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
      <AiRecipeDialog suggestion={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type DiscoverMode = 'inventory' | 'mood' | 'spirit-modifier';

export default function SuggestADrink() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as DiscoverMode) ?? 'inventory';
  const [mode, setMode] = useState<DiscoverMode>(initialMode);

  // Inventory mode
  const [inventoryResults, setInventoryResults] = useState<InventoryResult[] | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [missingTolerance, setMissingTolerance] = useState(0);
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);

  // Bartender's Choice wizard mode
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<(string | null)[]>([null, null, null]);
  const [moodInventoryOnly, setMoodInventoryOnly] = useState(true);
  const [moodInventoryCount, setMoodInventoryCount] = useState<number | null>(null);
  const [moodResults, setMoodResults] = useState<MoodResult[] | null>(null);
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodError, setMoodError] = useState<string | null>(null);

  // Spirit+Modifier mode
  const [selectedSpirit, setSelectedSpirit] = useState('');
  const [selectedModifier, setSelectedModifier] = useState('');
  const [spiritInventoryOnly, setSpiritInventoryOnly] = useState(true);
  const [spiritInventoryCount, setSpiritInventoryCount] = useState<number | null>(null);
  const [specificIngredientQuery, setSpecificIngredientQuery] = useState('');
  const [specificIngredientValue, setSpecificIngredientValue] = useState('');
  const [specificIngredientOptions, setSpecificIngredientOptions] = useState<IngredientSuggestion[]>([]);
  const [specificIngredientLoading, setSpecificIngredientLoading] = useState(false);
  const specificIngredientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spiritResults, setSpiritResults] = useState<SpiritResult[] | null>(null);
  const [spiritLoading, setSpiritLoading] = useState(false);
  const [spiritError, setSpiritError] = useState<string | null>(null);

  // AI shared
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [templateResults, setTemplateResults] = useState<TemplateDiscoverResult[] | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleModeChange = (_: unknown, newMode: DiscoverMode) => {
    setMode(newMode);
    setSearchParams({ mode: newMode });
    setAiSuggestions([]);
    setAiError(null);
    setTemplateResults(null);
    setWizardStep(0);
    setWizardAnswers([null, null, null]);
    setMoodResults(null);
  };

  const fetchAiSuggestions = useCallback(async (aiMode: string, context: Record<string, unknown>) => {
    if (aiAbortRef.current) aiAbortRef.current.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/discover/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: aiMode, context }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { suggestions: AiSuggestion[] };
      setAiSuggestions(data.suggestions ?? []);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setAiError(err instanceof Error ? err.message : 'AI unavailable');
      }
    } finally {
      setAiLoading(false);
    }
  }, []);

  const fetchInventory = useCallback(async (tolerance: number) => {
    setInventoryLoading(true);
    setInventoryError(null);
    setAiSuggestions([]);
    try {
      const res = await fetch(`/api/discover/inventory?missing=${tolerance}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: InventoryResult[]; inventory_count: number; template_results: TemplateDiscoverResult[] };
      setInventoryResults(data.results);
      setInventoryCount(data.inventory_count);
      setTemplateResults(data.template_results ?? []);
    } catch (err) {
      setInventoryError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const fetchMood = useCallback(async (moods: string[], inventoryOnly: boolean) => {
    if (moods.length === 0) return;
    setMoodLoading(true);
    setMoodError(null);
    setAiSuggestions([]);
    try {
      const qs = new URLSearchParams({
        moods: moods.join(','),
        inventoryOnly: inventoryOnly ? '1' : '0',
      });
      const res = await fetch(`/api/discover/mood?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MoodDiscoverResponse;
      setMoodResults(data.results);
      setTemplateResults(data.template_results ?? []);
      setMoodInventoryCount(data.inventory_count ?? null);
    } catch (err) {
      setMoodError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setMoodLoading(false);
    }
  }, []);

  const fetchSpiritModifier = useCallback(async (spirit: string, modifier: string, inventoryOnly: boolean) => {
    if (!spirit) return;
    setSpiritLoading(true);
    setSpiritError(null);
    setAiSuggestions([]);
    try {
      const qs = new URLSearchParams({
        spirit,
        inventoryOnly: inventoryOnly ? '1' : '0',
      });
      if (modifier) qs.set('modifier', modifier);
      const res = await fetch(`/api/discover/spirit-modifier?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SpiritDiscoverResponse;
      setSpiritResults(data.results);
      setTemplateResults(data.template_results ?? []);
      setSpiritInventoryCount(data.inventory_count ?? null);
    } catch (err) {
      setSpiritError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSpiritLoading(false);
    }
  }, []);

  const handleSpecificIngredientInput = (value: string) => {
    setSpecificIngredientQuery(value);
    if (!value.trim()) {
      setSpecificIngredientOptions([]);
      setSpecificIngredientValue('');
      return;
    }
    if (specificIngredientDebounceRef.current) clearTimeout(specificIngredientDebounceRef.current);
    specificIngredientDebounceRef.current = setTimeout(async () => {
      setSpecificIngredientLoading(true);
      try {
        const res = await fetch(`/api/ingredient-reference?q=${encodeURIComponent(value)}&limit=12`);
        if (!res.ok) return;
        const data = (await res.json()) as { results: IngredientSuggestion[] };
        setSpecificIngredientOptions(data.results);
      } finally {
        setSpecificIngredientLoading(false);
      }
    }, 200);
  };

  const SUGGEST_NAV_STATE = { from: '/suggest', fromLabel: 'Suggest a Drink' };
  const handleRecipeClick = (id: string) => navigate(`/recipes/${id}`, { state: SUGGEST_NAV_STATE });

  const handleMoodInventoryOnlyChange = useCallback((checked: boolean) => {
    setMoodInventoryOnly(checked);
    setAiSuggestions([]);
    setAiError(null);

    if (wizardStep === WIZARD_STEPS.length) {
      const selectedMoods = wizardAnswers.filter((answer): answer is string => Boolean(answer));
      if (selectedMoods.length > 0) {
        void fetchMood(selectedMoods, checked);
      }
    }
  }, [fetchMood, wizardAnswers, wizardStep]);

  const handleSpiritInventoryOnlyChange = useCallback((checked: boolean) => {
    setSpiritInventoryOnly(checked);
    setAiSuggestions([]);
    setAiError(null);

    const isSpecificIngredient = selectedModifier === 'specific-ingredient';
    const effectiveModifier = isSpecificIngredient ? specificIngredientValue : selectedModifier;
    const canSearch = !!selectedSpirit && (!isSpecificIngredient || !!specificIngredientValue);

    if (canSearch) {
      void fetchSpiritModifier(selectedSpirit, effectiveModifier, checked);
    }
  }, [fetchSpiritModifier, selectedModifier, selectedSpirit, specificIngredientValue]);

  // ── Mode renders ───────────────────────────────────────────────────────────

  function renderInventoryMode() {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Find cocktails you can make right now based on your home bar inventory.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 230 }}>
            <InputLabel>Missing ingredients allowed</InputLabel>
            <Select
              value={missingTolerance}
              label="Missing ingredients allowed"
              onChange={(e) => setMissingTolerance(Number(e.target.value))}>
              <MenuItem value={0}>0 — Only what I have</MenuItem>
              <MenuItem value={1}>1 missing ingredient</MenuItem>
              <MenuItem value={2}>2 missing ingredients</MenuItem>
              <MenuItem value={3}>3 missing ingredients</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<LocalBarIcon />}
            onClick={() => fetchInventory(missingTolerance)}
            disabled={inventoryLoading}>
            Find Drinks
          </Button>
        </Box>

        {inventoryLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {inventoryError && <Alert severity="error">{inventoryError}</Alert>}

        {inventoryResults !== null && !inventoryLoading && (
          <>
            {inventoryCount === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Your inventory is empty.{' '}
                <a href="/inventory" style={{ color: 'inherit' }}>Add ingredients</a> to get started.
              </Alert>
            )}
            {inventoryResults.length === 0 && (inventoryCount ?? 0) > 0 && (
              <Alert severity="info">
                No recipes match your current inventory
                {missingTolerance > 0 ? ` (even allowing ${missingTolerance} missing)` : ''}.
                Try allowing more missing ingredients, or add more recipes.
              </Alert>
            )}
            {inventoryResults.length > 0 && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {inventoryResults.filter((r) => r.missing_count === 0).length} fully makeable
                  {missingTolerance > 0 && ` · ${inventoryResults.filter((r) => r.missing_count > 0).length} need up to ${missingTolerance} more`}
                </Typography>
                <Grid container spacing={2}>
                  {inventoryResults.map((r) => (
                    <Grid key={r.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                      <DiscoverRecipeCard
                        id={r.id} name={r.name} type={r.type}
                        difficulty={r.difficulty} tags={r.tags} display_name={r.display_name}
                        primary_image={r.primary_image}
                        placeholder_icon={r.placeholder_icon}
                        glass_type={r.glass_type}
                        garnish={r.garnish}
                        ice_type={r.ice_type}
                        onClick={() => handleRecipeClick(r.id)}>
                        {r.missing_count === 0 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CheckCircleOutlineIcon fontSize="small" color="success" />
                            <Typography variant="caption" color="success.light">Fully makeable</Typography>
                          </Box>
                        ) : (
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <WarningAmberIcon fontSize="small" color="warning" />
                              <Typography variant="caption" color="warning.light">
                                Missing {r.missing_count} of {r.total_ingredients}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                              {r.missing_ingredients.slice(0, 3).join(', ')}
                              {r.missing_ingredients.length > 3 ? ` +${r.missing_ingredients.length - 3} more` : ''}
                            </Typography>
                          </Box>
                        )}
                      </DiscoverRecipeCard>
                    </Grid>
                  ))}
                </Grid>
              </>
            )}
          </>
        )}

        {templateResults !== null && (
          <TemplateResultSection
            templateResults={templateResults}
            onNavigate={(id) => navigate(`/templates/${id}`, { state: SUGGEST_NAV_STATE })}
          />
        )}

        {inventoryResults !== null && !inventoryLoading && inventoryResults.length > 0 && !aiLoading && (
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => {
              const existingNames = [
                ...(inventoryResults ?? []).map(r => r.name),
                ...(templateResults ?? []).map(t => t.name),
              ].slice(0, 20);
              void fetchAiSuggestions('inventory', { missingTolerance, existingNames });
            }}
            color="primary"
            sx={{ mt: 3 }}
          >
            {aiSuggestions.length > 0 ? 'Refresh AI Picks' : 'Get AI Picks'}
          </Button>
        )}
        <AiSuggestionsPanel suggestions={aiSuggestions} loading={aiLoading} error={aiError} />
      </Box>
    );
  }

  function renderMoodMode() {
    const isShowingResults = wizardStep === WIZARD_STEPS.length;
    const showEmptyInventoryAlert = moodInventoryOnly && moodInventoryCount === 0;

    function handleWizardAnswer(stepIndex: number, value: string) {
      const newAnswers = [...wizardAnswers];
      newAnswers[stepIndex] = value;
      setWizardAnswers(newAnswers);
      if (stepIndex < WIZARD_STEPS.length - 1) {
        setWizardStep(stepIndex + 1);
      } else {
        setWizardStep(WIZARD_STEPS.length);
        void fetchMood(newAnswers.filter((a): a is string => Boolean(a)), moodInventoryOnly);
      }
    }

    function handleWizardSkip(stepIndex: number) {
      const newAnswers = [...wizardAnswers];
      newAnswers[stepIndex] = null;
      setWizardAnswers(newAnswers);
      if (stepIndex < WIZARD_STEPS.length - 1) {
        setWizardStep(stepIndex + 1);
      } else {
        setWizardStep(WIZARD_STEPS.length);
        void fetchMood(newAnswers.filter((a): a is string => Boolean(a)), moodInventoryOnly);
      }
    }

    function resetWizard() {
      setWizardStep(0);
      setWizardAnswers([null, null, null]);
      setMoodResults(null);
      setMoodInventoryCount(null);
      setTemplateResults(null);
      setAiSuggestions([]);
      setAiError(null);
    }

    if (!isShowingResults) {
      const step = WIZARD_STEPS[wizardStep];
      const StepIcon = step.icon;
      const prevAnsweredLabels = wizardAnswers
        .slice(0, wizardStep)
        .map((ans, i) => (ans ? (WIZARD_STEPS[i].options.find((o) => o.value === ans)?.label ?? ans) : null))
        .filter((l): l is string => l !== null);

      return (
        <Box>
          <FormControlLabel
            sx={{ mb: 2 }}
            control={
              <Switch
                checked={moodInventoryOnly}
                onChange={(event) => handleMoodInventoryOnlyChange(event.target.checked)}
                color="primary"
              />
            }
            label="Only show drinks I can make"
          />

          {showEmptyInventoryAlert && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Your inventory is empty, so makeable-only Bartender&apos;s Choice results will stay empty until you{' '}
              <a href="/inventory" style={{ color: 'inherit' }}>add ingredients</a>.
            </Alert>
          )}

          {/* Step progress */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            {WIZARD_STEPS.map((s, i) => (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 28, height: 28, borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    bgcolor: i < wizardStep ? 'success.main' : i === wizardStep ? 'primary.main' : 'action.selected',
                    cursor: i < wizardStep ? 'pointer' : 'default',
                    transition: 'background-color 0.2s',
                  }}
                  onClick={() => { if (i < wizardStep) setWizardStep(i); }}
                >
                  {i < wizardStep ? '✓' : i + 1}
                </Box>
                {i < WIZARD_STEPS.length - 1 && (
                  <Box sx={{ width: 32, height: 2, bgcolor: i < wizardStep ? 'success.main' : 'action.disabled', transition: 'background-color 0.2s' }} />
                )}
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              Step {wizardStep + 1} of {WIZARD_STEPS.length}
            </Typography>
          </Box>

          {/* Question */}
          <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
            <StepIcon sx={{ fontSize: '1.5rem', mr: 1, verticalAlign: 'text-bottom' }} />
            {step.question}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Pick one to continue, or skip to keep it open.
          </Typography>

          {/* Options grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 1.5,
              mb: 3,
            }}
          >
            {step.options.map((opt) => {
              const OptionIcon = opt.icon;
              return (
                <Paper
                  key={opt.value}
                  variant="outlined"
                  onClick={() => handleWizardAnswer(wizardStep, opt.value)}
                  sx={{
                    p: 2, cursor: 'pointer', textAlign: 'center', borderRadius: 2,
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  }}
                >
                  <OptionIcon sx={{ fontSize: '1.75rem', mb: 0.75, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{opt.label}</Typography>
                </Paper>
              );
            })}
          </Box>

          {/* Navigation */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {wizardStep > 0 && (
              <Button size="small" onClick={() => setWizardStep(wizardStep - 1)}>← Back</Button>
            )}
            <Button size="small" color="inherit" onClick={() => handleWizardSkip(wizardStep)}>
              Skip →
            </Button>
          </Box>

          {/* Previous picks summary */}
          {prevAnsweredLabels.length > 0 && (
            <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">So far:</Typography>
              {prevAnsweredLabels.map((label) => (
                <Chip key={label} label={label} size="small" color="primary" variant="outlined" />
              ))}
            </Box>
          )}
        </Box>
      );
    }

    // ── Results view ────────────────────────────────────────────────────────
    const answeredLabels = wizardAnswers
      .map((ans, i) => (ans ? (WIZARD_STEPS[i].options.find((o) => o.value === ans)?.label ?? ans) : null))
      .filter((l): l is string => l !== null);

    return (
      <Box>
        <FormControlLabel
          sx={{ mb: 2 }}
          control={
            <Switch
              checked={moodInventoryOnly}
              onChange={(event) => handleMoodInventoryOnlyChange(event.target.checked)}
              color="primary"
            />
          }
          label="Only show drinks I can make"
        />

        {showEmptyInventoryAlert && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Your inventory is empty, so makeable-only Bartender&apos;s Choice results will stay empty until you{' '}
            <a href="/inventory" style={{ color: 'inherit' }}>add ingredients</a>.
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {answeredLabels.map((label) => (
            <Chip key={label} label={label} size="small" color="primary" />
          ))}
          {answeredLabels.length === 0 && (
            <Typography variant="body2" color="text.secondary">No filters applied.</Typography>
          )}
          <Button size="small" onClick={resetWizard} sx={{ ml: 'auto' }}>↩ Start Over</Button>
        </Box>

        {moodLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {moodError && <Alert severity="error">{moodError}</Alert>}

        {moodResults === null && !moodLoading && !moodError && answeredLabels.length === 0 && (
          <Alert severity="info">
            You skipped all three questions.{' '}
            <Button size="small" onClick={resetWizard}>Try again</Button>
          </Alert>
        )}

        {moodResults !== null && !moodLoading && (
          <Box>
            {moodResults.length === 0 ? (
              <Alert severity="info">
                {showEmptyInventoryAlert
                  ? 'No makeable recipes matched those vibes with your current inventory. '
                  : 'No recipes matched those vibes. '}
                <Button size="small" onClick={resetWizard}>Try different picks</Button>
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {moodResults.length} recipe{moodResults.length !== 1 ? 's' : ''} matched
                </Typography>
                <Grid container spacing={2}>
                  {moodResults.map((r) => (
                    <Grid key={r.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                      <DiscoverRecipeCard
                        id={r.id} name={r.name} type={r.type}
                        difficulty={r.difficulty} tags={r.tags} display_name={r.display_name}
                        primary_image={r.primary_image}
                        placeholder_icon={r.placeholder_icon}
                        glass_type={r.glass_type}
                        garnish={r.garnish}
                        ice_type={r.ice_type}
                        onClick={() => handleRecipeClick(r.id)}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {r.matched_moods.map((m) => (
                            <Chip key={m} label={m} size="small" color="primary" variant="outlined" />
                          ))}
                        </Box>
                      </DiscoverRecipeCard>
                    </Grid>
                  ))}
                </Grid>
              </>
            )}
          </Box>
        )}

        {templateResults !== null && (
          <TemplateResultSection
            templateResults={templateResults}
            onNavigate={(id) => navigate(`/templates/${id}`, { state: SUGGEST_NAV_STATE })}
          />
        )}

        {!moodInventoryOnly && wizardAnswers.some(Boolean) && !aiLoading && (
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => {
              const existingNames = [
                ...(moodResults ?? []).map((r) => r.name),
                ...(templateResults ?? []).map((t) => t.name),
              ].slice(0, 20);
              void fetchAiSuggestions('mood', { moods: wizardAnswers.filter(Boolean), existingNames });
            }}
            color="primary"
            sx={{ mt: 3 }}
          >
            {aiSuggestions.length > 0 ? 'Refresh AI Picks' : 'Get AI Picks'}
          </Button>
        )}
        {!moodInventoryOnly && <AiSuggestionsPanel suggestions={aiSuggestions} loading={aiLoading} error={aiError} />}
      </Box>
    );
  }

  function renderSpiritModifierMode() {
    const isSpecificIngredient = selectedModifier === 'specific-ingredient';
    const effectiveModifier = isSpecificIngredient ? specificIngredientValue : selectedModifier;
    const canSearch = !!selectedSpirit && (!isSpecificIngredient || !!specificIngredientValue);
    const showEmptyInventoryAlert = spiritInventoryOnly && spiritInventoryCount === 0;

    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Explore cocktails built on a specific spirit and modifier combination.
        </Typography>

        <FormControlLabel
          sx={{ mb: 2 }}
          control={
            <Switch
              checked={spiritInventoryOnly}
              onChange={(event) => handleSpiritInventoryOnlyChange(event.target.checked)}
              color="primary"
            />
          }
          label="Only show drinks I can make"
        />

        {showEmptyInventoryAlert && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Your inventory is empty, so makeable-only Spirit + Modifier results will stay empty until you{' '}
            <a href="/inventory" style={{ color: 'inherit' }}>add ingredients</a>.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Base Spirit</InputLabel>
            <Select
              value={selectedSpirit}
              label="Base Spirit"
              onChange={(e) => setSelectedSpirit(e.target.value)}>
              {SPIRIT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Modifier</InputLabel>
            <Select
              value={selectedModifier}
              label="Modifier"
              onChange={(e) => {
                setSelectedModifier(e.target.value);
                setSpecificIngredientQuery('');
                setSpecificIngredientValue('');
                setSpecificIngredientOptions([]);
              }}>
              {MODIFIER_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {isSpecificIngredient && (
            <Autocomplete
              freeSolo
              options={specificIngredientOptions}
              getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
              inputValue={specificIngredientQuery}
              onInputChange={(_, v) => handleSpecificIngredientInput(v)}
              onChange={(_, val) => {
                if (val && typeof val !== 'string') {
                  setSpecificIngredientValue(val.name);
                  setSpecificIngredientQuery(val.name);
                } else if (typeof val === 'string') {
                  setSpecificIngredientValue(val);
                } else {
                  setSpecificIngredientValue('');
                }
              }}
              loading={specificIngredientLoading}
              renderOption={(props, option) => {
                const opt = option as IngredientSuggestion;
                return (
                  <Box component="li" {...props} key={opt.id}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{opt.name}</Typography>
                      {(opt.subcategory || opt.brand) && (
                        <Typography variant="caption" color="text.secondary">
                          {[opt.subcategory, opt.brand].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Ingredient"
                  placeholder="e.g. Campari, lime juice…"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {specificIngredientLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ minWidth: 220 }}
            />
          )}

          <Button
            variant="contained"
            startIcon={<SpiritIcon />}
            onClick={() => fetchSpiritModifier(selectedSpirit, effectiveModifier, spiritInventoryOnly)}
            disabled={spiritLoading || !canSearch}>
            Find Drinks
          </Button>
        </Box>

        {spiritLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {spiritError && <Alert severity="error">{spiritError}</Alert>}

        {spiritResults !== null && !spiritLoading && (
          <Box>
            {spiritResults.length === 0 ? (
              <Alert severity="info">
                {showEmptyInventoryAlert
                  ? 'No makeable recipes found for that combination with your current inventory. Try turning off the filter or add ingredients to your bar.'
                  : 'No recipes found for that combination. Try a different modifier, or add some recipes!'}
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {spiritResults.length} recipe{spiritResults.length !== 1 ? 's' : ''} found
                </Typography>
                <Grid container spacing={2}>
                  {spiritResults.map((r) => (
                    <Grid key={r.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                      <DiscoverRecipeCard
                        id={r.id} name={r.name} type={r.type}
                        difficulty={r.difficulty} tags={r.tags} display_name={r.display_name}
                        primary_image={r.primary_image}
                        placeholder_icon={r.placeholder_icon}
                        glass_type={r.glass_type}
                        garnish={r.garnish}
                        ice_type={r.ice_type}
                        onClick={() => handleRecipeClick(r.id)}>
                        <Typography variant="caption" color="text.secondary">
                          {[r.matched_spirit, r.matched_modifier].filter(Boolean).join(' + ')}
                        </Typography>
                      </DiscoverRecipeCard>
                    </Grid>
                  ))}
                </Grid>
              </>
            )}
          </Box>
        )}

        {templateResults !== null && (
          <TemplateResultSection
            templateResults={templateResults}
            onNavigate={(id) => navigate(`/templates/${id}`, { state: SUGGEST_NAV_STATE })}
          />
        )}

        {!spiritInventoryOnly && spiritResults !== null && !spiritLoading && (
          <>
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => {
                const existingNames = [
                  ...(spiritResults ?? []).map(r => r.name),
                  ...(templateResults ?? []).map(t => t.name),
                ].slice(0, 20);
                void fetchAiSuggestions('spirit-modifier', { spirit: selectedSpirit, modifier: effectiveModifier, existingNames });
              }}
              disabled={aiLoading}
              color="primary"
              sx={{ mt: 3 }}
            >
              {aiSuggestions.length > 0 ? 'Refresh AI Picks' : 'Get AI Picks'}
            </Button>
            <AiSuggestionsPanel suggestions={aiSuggestions} loading={aiLoading} error={aiError} />
          </>
        )}
      </Box>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Suggest a Drink
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Find your next drink — by inventory, mood, or spirit
      </Typography>

      <FormControl size="small" sx={{ mb: 3, minWidth: 260 }}>
        <InputLabel>Mode</InputLabel>
        <Select
          value={mode}
          label="Mode"
          onChange={(e) => handleModeChange(null, e.target.value as DiscoverMode)}
        >
          <MenuItem value="inventory">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalBarIcon fontSize="small" /> What Can I Make
            </Box>
          </MenuItem>
          <MenuItem value="mood">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MoodIcon fontSize="small" /> Bartender&apos;s Choice
            </Box>
          </MenuItem>
          <MenuItem value="spirit-modifier">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SpiritIcon fontSize="small" /> Spirit + Modifier
            </Box>
          </MenuItem>
        </Select>
      </FormControl>

      {mode === 'inventory' && renderInventoryMode()}
      {mode === 'mood' && renderMoodMode()}
      {mode === 'spirit-modifier' && renderSpiritModifierMode()}
    </Box>
  );
}
