import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, Paper, TextField, Button, IconButton,
  Select, MenuItem, FormControl, InputLabel, Divider, Chip, Alert,
  CircularProgress, Tooltip, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CalculateIcon from '@mui/icons-material/Calculate';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { Recipe } from '../types';
import { useAuth } from '../hooks/useAuth';

// ── Unit conversions ───────────────────────────────────────────────────────

const ML_PER_OZ = 29.5735;

const UNIT_TO_ML: Record<string, number> = {
  oz: ML_PER_OZ,
  ml: 1,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
  dash: 0.616,
  barspoon: 5,
  pinch: 0.3,
};

function toMl(amount: number, unit: string): number {
  return amount * (UNIT_TO_ML[unit.toLowerCase()] ?? 1);
}

function formatVolume(ml: number, preferred: 'oz' | 'ml'): string {
  if (preferred === 'ml') {
    return `${ml < 10 ? (Math.round(ml * 10) / 10) : Math.round(ml)} ml`;
  }
  const oz = ml / ML_PER_OZ;
  if (oz < 0.1) return `${Math.round(ml)} ml`;
  return `${Math.round(oz * 100) / 100} oz`;
}

const COMMON_UNITS = ['oz', 'ml', 'dash', 'barspoon', 'tsp', 'tbsp', 'cup'];

// Dilution percentages by method (fraction of total volume added as water)
const DILUTION_BY_METHOD: Record<string, number> = {
  stirred: 0.20,
  shaken: 0.25,
  built: 0.10,
  blended: 0.15,
  batch: 0.20,
  thrown: 0.20,
  none: 0,
};

const DILUTION_NOTE: Record<string, string> = {
  stirred: 'Stirred cocktails dilute ~20% from ice. Pre-batch by adding chilled water.',
  shaken: 'Shaken cocktails dilute ~25% from ice. Pre-batch by adding chilled water.',
  built: 'Built drinks dilute naturally over ice in the glass. Add ~10% water if pre-batching.',
  blended: 'Blended drinks add ~15% dilution from ice. Account for this when batching.',
  batch: 'Stirred batch: add chilled water to compensate for the lack of ice dilution.',
  thrown: 'Thrown cocktails dilute similarly to stirred. Pre-batch as needed.',
  none: 'No dilution adjustment added.',
};

// ── Ingredient reference type (returned by /api/ingredient-reference) ──────

interface IngredientRef {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  abv: number | null;
}

// ── Batch warning helpers ─────────────────────────────────────────────────────

// Ingredients that go flat / lose carbonation when pre-batched
const DONT_BATCH_PHRASES = [
  'soda water', 'club soda', 'seltzer', 'sparkling water', 'sparkling mineral',
  'tonic water', 'ginger beer', 'ginger ale', 'prosecco', 'champagne',
  'cava', 'crémant', 'sparkling wine', 'kombucha',
];

function getBatchWarning(name: string): 'skip' | 'caution' | null {
  const n = name.toLowerCase();
  if (DONT_BATCH_PHRASES.some((p) => n.includes(p))) return 'skip';
  // Standalone beer / ale / lager / stout
  if (/\b(beer|lager|stout|porter|\bale\b)/.test(n)) return 'skip';
  if (['egg white', 'aquafaba'].some((p) => n.includes(p))) return 'caution';
  return null;
}

// Bottle size defaults by ingredient category
function defaultBottleSize(category: string): { bottleSize: string; bottleSizeUnit: string } {
  switch (category.toLowerCase()) {
    case 'bitter': return { bottleSize: '150', bottleSizeUnit: 'ml' };
    case 'beer':   return { bottleSize: '355', bottleSizeUnit: 'ml' };
    case 'mixer':  return { bottleSize: '1000', bottleSizeUnit: 'ml' };
    default:       return { bottleSize: '750', bottleSizeUnit: 'ml' };
  }
}

// ── Row types ──────────────────────────────────────────────────────────────

interface BatchRow {
  id: string;
  name: string;
  amount: string;
  unit: string;
}

interface AbvRow {
  id: string;
  name: string;
  amount: string;
  unit: string;
  abv: string;
}

interface CostRow {
  id: string;
  name: string;
  amount: string;
  unit: string;
  bottleSize: string;
  bottleSizeUnit: string;
  price: string;
}

const newBatchRow = (): BatchRow => ({ id: crypto.randomUUID(), name: '', amount: '', unit: 'oz' });
const newAbvRow = (): AbvRow => ({ id: crypto.randomUUID(), name: '', amount: '', unit: 'oz', abv: '' });
const newCostRow = (): CostRow => ({
  id: crypto.randomUUID(), name: '', amount: '', unit: 'oz',
  bottleSize: '750', bottleSizeUnit: 'ml', price: '',
});

// ── Helpers ────────────────────────────────────────────────────────────────

function UnitSelect({
  value,
  onChange,
  units = COMMON_UNITS,
}: {
  value: string;
  onChange: (v: string) => void;
  units?: string[];
}) {
  return (
    <FormControl size="small" sx={{ width: 80 }}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {units.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Calculators() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const tabParam = searchParams.get('tab');
  const recipeIdParam = searchParams.get('recipeId');

  const [tab, setTab] = useState<number>(
    tabParam === 'abv'
      ? 1
      : tabParam === 'cost'
        ? 2
        : tabParam === 'slushie'
          ? 3
          : 0,
  );

  // Recipe loading
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [loadedRecipeName, setLoadedRecipeName] = useState('');
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // ── Batch state ──────────────────────────────────────────────────────────
  const [batchRows, setBatchRows] = useState<BatchRow[]>([newBatchRow()]);
  const [batchServings, setBatchServings] = useState('8');
  const [batchMethod, setBatchMethod] = useState('stirred');

  // ── ABV state ────────────────────────────────────────────────────────────
  const [abvRows, setAbvRows] = useState<AbvRow[]>([newAbvRow()]);
  const [abvMethod, setAbvMethod] = useState('stirred');
  const [abvCustomDilution, setAbvCustomDilution] = useState('');

  // ── Cost state ───────────────────────────────────────────────────────────
  const [costRows, setCostRows] = useState<CostRow[]>([newCostRow()]);
  const [costServings, setCostServings] = useState('1');

  // ── Slushie state ────────────────────────────────────────────────────────
  const [slushBaseVolume, setSlushBaseVolume] = useState('2000');
  const [slushBaseAbv, setSlushBaseAbv] = useState('18');
  const [slushCurrentBrix, setSlushCurrentBrix] = useState('11');
  const [slushTargetBrix, setSlushTargetBrix] = useState('14');
  const [slushInitialWaterPct, setSlushInitialWaterPct] = useState('20');
  const [slushSyrupBrix, setSlushSyrupBrix] = useState('50');

  // Load all user recipes for the search autocomplete
  useEffect(() => {
    void (async () => {
      setLoadingAll(true);
      try {
        const res = await fetch('/api/recipes');
        if (!res.ok) return;
        const data = await res.json() as { recipes: Recipe[] };
        setAllRecipes(data.recipes);
      } finally {
        setLoadingAll(false);
      }
    })();
  }, []);

  // Populate rows from a recipe, enriching ABV + bottle sizes from ingredient reference
  const loadAndPopulateRecipe = async (r: Recipe) => {
    const ings = r.ingredients ?? [];

    // Fetch reference data for all ingredients in parallel
    const refData: (IngredientRef | null)[] = await Promise.all(
      ings.map(async (ing) => {
        if (!ing.name.trim()) return null;
        try {
          const res = await fetch(
            `/api/ingredient-reference?q=${encodeURIComponent(ing.name)}&limit=1`,
          );
          if (!res.ok) return null;
          const data = await res.json() as { results: IngredientRef[] };
          return data.results[0] ?? null;
        } catch {
          return null;
        }
      }),
    );

    setLoadedRecipeName(r.name);

    if (ings.length > 0) {
      setBatchRows(ings.map((i) => ({
        id: crypto.randomUUID(),
        name: i.name,
        amount: i.amount != null ? String(i.amount) : '',
        unit: i.unit ?? 'oz',
      })));
      setAbvRows(ings.map((i, idx) => ({
        id: crypto.randomUUID(),
        name: i.name,
        amount: i.amount != null ? String(i.amount) : '',
        unit: i.unit ?? 'oz',
        // Pre-fill ABV from reference DB if available and non-zero
        abv: refData[idx]?.abv ? String(refData[idx]!.abv) : '',
      })));
      setCostRows(ings.map((i, idx) => {
        const ref = refData[idx];
        const { bottleSize, bottleSizeUnit } = defaultBottleSize(ref?.category ?? '');
        return {
          id: crypto.randomUUID(),
          name: i.name,
          amount: i.amount != null ? String(i.amount) : '',
          unit: i.unit ?? 'oz',
          bottleSize,
          bottleSizeUnit,
          price: '',
        };
      }));
    }

    if (r.method) {
      setBatchMethod(r.method);
      setAbvMethod(r.method);
    }
    if (r.servings > 1) {
      setBatchServings(String(r.servings));
    }

    // Slushie defaults from loaded recipe: total recipe volume and estimated pre-dilution ABV.
    if (ings.length > 0) {
      const servings = r.servings > 0 ? r.servings : 1;
      const totalIngredientMl = ings.reduce((sum, i) => {
        if (i.amount == null || !isFinite(i.amount)) return sum;
        return sum + toMl(i.amount, i.unit ?? 'oz');
      }, 0);

      if (totalIngredientMl > 0) {
        setSlushBaseVolume(String(Math.round(totalIngredientMl * servings)));
      }

      let totalAlcoholMl = 0;
      for (let idx = 0; idx < ings.length; idx += 1) {
        const ing = ings[idx];
        if (ing.amount == null || !isFinite(ing.amount)) continue;
        const amtMl = toMl(ing.amount, ing.unit ?? 'oz');
        const inferredAbv = refData[idx]?.abv ?? 0;
        if (inferredAbv > 0) totalAlcoholMl += amtMl * (inferredAbv / 100);
      }

      if (totalIngredientMl > 0 && totalAlcoholMl > 0) {
        const estimatedAbv = (totalAlcoholMl / totalIngredientMl) * 100;
        setSlushBaseAbv((Math.round(estimatedAbv * 10) / 10).toString());
      }
    }
  };

  // Load recipe from URL param on mount
  useEffect(() => {
    if (!recipeIdParam) return;
    void (async () => {
      setLoadingRecipe(true);
      try {
        const res = await fetch(`/api/recipes/${recipeIdParam}`);
        if (!res.ok) return;
        const data = await res.json() as { recipe: Recipe };
        await loadAndPopulateRecipe(data.recipe);
      } finally {
        setLoadingRecipe(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeIdParam]);

  // ── Batch calculations ───────────────────────────────────────────────────

  const batchResults = useMemo(() => {
    const servings = parseFloat(batchServings);
    if (!isFinite(servings) || servings <= 0) return null;
    const activeRows = batchRows.filter((r) => r.name.trim() && parseFloat(r.amount) > 0);
    if (activeRows.length === 0) return null;

    const scaled = activeRows.map((r) => ({
      ...r,
      scaledAmountMl: toMl(parseFloat(r.amount), r.unit) * servings,
      scaledAmount: parseFloat(r.amount) * servings,
    }));

    const singleTotalMl = activeRows.reduce((sum, r) => {
      const amt = parseFloat(r.amount);
      return sum + (isFinite(amt) ? toMl(amt, r.unit) : 0);
    }, 0);

    const dilutionPct = DILUTION_BY_METHOD[batchMethod] ?? 0.20;
    const dilutionMl = singleTotalMl * servings * dilutionPct;
    const totalBatchMl = singleTotalMl * servings + dilutionMl;

    return { scaled, dilutionMl, dilutionPct, singleTotalMl, totalBatchMl };
  }, [batchRows, batchServings, batchMethod]);

  // ── ABV calculations ─────────────────────────────────────────────────────

  const abvResults = useMemo(() => {
    const activeRows = abvRows.filter((r) => r.name.trim() && parseFloat(r.amount) > 0);
    if (activeRows.length === 0) return null;

    let totalAlcoholMl = 0;
    let totalVolumeMl = 0;

    for (const r of activeRows) {
      const amtMl = toMl(parseFloat(r.amount), r.unit);
      const abvVal = parseFloat(r.abv);
      totalVolumeMl += amtMl;
      totalAlcoholMl += amtMl * (isFinite(abvVal) && abvVal > 0 ? abvVal / 100 : 0);
    }

    if (totalVolumeMl === 0) return null;

    const neatAbv = (totalAlcoholMl / totalVolumeMl) * 100;

    const dilutionPct = abvCustomDilution !== ''
      ? Math.max(0, parseFloat(abvCustomDilution) / 100)
      : (DILUTION_BY_METHOD[abvMethod] ?? 0.20);

    const dilutionMl = totalVolumeMl * dilutionPct;
    const dilutedAbv = (totalAlcoholMl / (totalVolumeMl + dilutionMl)) * 100;

    return { neatAbv, dilutedAbv, totalVolumeMl, dilutionMl, dilutionPct };
  }, [abvRows, abvMethod, abvCustomDilution]);

  // ── Cost calculations ────────────────────────────────────────────────────

  const costResults = useMemo(() => {
    const servings = parseFloat(costServings);
    const activeRows = costRows.filter(
      (r) => r.name.trim() && parseFloat(r.amount) > 0 && parseFloat(r.price) > 0 && parseFloat(r.bottleSize) > 0,
    );
    if (activeRows.length === 0) return null;

    const itemized = activeRows.map((r) => {
      const amtMl = toMl(parseFloat(r.amount), r.unit);
      const bottleMl = toMl(parseFloat(r.bottleSize), r.bottleSizeUnit);
      const price = parseFloat(r.price);
      const costPerUse = bottleMl > 0 ? (amtMl / bottleMl) * price : 0;
      return { name: r.name, costPerUse };
    });

    const totalPerServing = itemized.reduce((s, i) => s + i.costPerUse, 0);
    const totalBatch = isFinite(servings) && servings > 0 ? totalPerServing * servings : null;

    return { itemized, totalPerServing, totalBatch };
  }, [costRows, costServings]);

  // ── Slushie calculations ─────────────────────────────────────────────────

  const slushieResults = useMemo(() => {
    const baseVolumeMl = parseFloat(slushBaseVolume);
    const baseAbvPct = parseFloat(slushBaseAbv);
    const currentBrixPct = parseFloat(slushCurrentBrix);
    const targetBrixPct = parseFloat(slushTargetBrix);
    const initialWaterPct = parseFloat(slushInitialWaterPct);
    const syrupBrixPct = parseFloat(slushSyrupBrix);

    if (!isFinite(baseVolumeMl) || baseVolumeMl <= 0) return null;
    if (!isFinite(baseAbvPct) || baseAbvPct < 0) return null;
    if (!isFinite(currentBrixPct) || currentBrixPct < 0) return null;
    if (!isFinite(targetBrixPct) || targetBrixPct <= 0 || targetBrixPct >= 100) return null;
    if (!isFinite(initialWaterPct) || initialWaterPct < 0) return null;
    if (!isFinite(syrupBrixPct) || syrupBrixPct <= 0 || syrupBrixPct >= 100) return null;

    const t = targetBrixPct / 100;
    const p = syrupBrixPct / 100;

    const initialWaterMl = baseVolumeMl * (initialWaterPct / 100);
    const preAdjustedVolumeMl = baseVolumeMl + initialWaterMl;

    // Approximation: 1 ml mix ~= 1 g solution for practical bar calculations.
    const sugarMassG = baseVolumeMl * (currentBrixPct / 100);
    const preAdjustedBrixPct = preAdjustedVolumeMl > 0 ? (sugarMassG / preAdjustedVolumeMl) * 100 : 0;

    let adjustMode: 'water' | 'syrup' | 'none' | 'invalid' = 'none';
    let adjustmentMl = 0;

    if (Math.abs(preAdjustedBrixPct - targetBrixPct) > 0.01) {
      if (preAdjustedBrixPct > targetBrixPct) {
        // Add water: S / (V + W) = t  ->  W = S/t - V
        adjustmentMl = (sugarMassG / t) - preAdjustedVolumeMl;
        adjustMode = adjustmentMl > 0 ? 'water' : 'none';
      } else {
        // Add syrup: (S + pX) / (V + X) = t  ->  X = (tV - S)/(p - t)
        if (p <= t) {
          adjustMode = 'invalid';
        } else {
          adjustmentMl = ((t * preAdjustedVolumeMl) - sugarMassG) / (p - t);
          adjustMode = adjustmentMl > 0 ? 'syrup' : 'none';
        }
      }
    }

    const finalVolumeMl = preAdjustedVolumeMl + (adjustMode === 'invalid' ? 0 : adjustmentMl);
    const finalSugarMassG = sugarMassG + (adjustMode === 'syrup' ? adjustmentMl * p : 0);
    const finalBrixPct = finalVolumeMl > 0 ? (finalSugarMassG / finalVolumeMl) * 100 : 0;

    const alcoholMl = baseVolumeMl * (baseAbvPct / 100);
    const finalAbvPct = finalVolumeMl > 0 ? (alcoholMl / finalVolumeMl) * 100 : 0;

    return {
      initialWaterMl,
      preAdjustedBrixPct,
      adjustMode,
      adjustmentMl: Math.max(0, adjustmentMl),
      finalVolumeMl,
      finalBrixPct,
      finalAbvPct,
    };
  }, [
    slushBaseVolume,
    slushBaseAbv,
    slushCurrentBrix,
    slushTargetBrix,
    slushInitialWaterPct,
    slushSyrupBrix,
  ]);

  // ── Shared recipe loader UI ──────────────────────────────────────────────

  function RecipeLoader() {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Autocomplete
          size="small"
          sx={{ width: 280 }}
          options={allRecipes}
          getOptionLabel={(r) => r.name}
          loading={loadingAll}
          onChange={(_, recipe) => {
            if (!recipe) return;
            void (async () => {
              setLoadingRecipe(true);
              try {
                const res = await fetch(`/api/recipes/${recipe.id}`);
                if (!res.ok) return;
                const data = await res.json() as { recipe: Recipe };
                await loadAndPopulateRecipe(data.recipe);
              } finally {
                setLoadingRecipe(false);
              }
            })();
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Load a recipe"
              placeholder="Search your recipes…"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingAll ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        {loadingRecipe && <CircularProgress size={20} color="primary" />}
        {loadedRecipeName && !loadingRecipe && (
          <Chip
            label={`Loaded: ${loadedRecipeName}`}
            size="small"
            color="primary"
            variant="outlined"
            onDelete={() => {
              setLoadedRecipeName('');
              setBatchRows([newBatchRow()]);
              setAbvRows([newAbvRow()]);
              setCostRows([newCostRow()]);
            }}
          />
        )}
      </Box>
    );
  }

  // ── Batch tab ────────────────────────────────────────────────────────────

  function BatchTab() {
    const preferred = user?.default_units ?? 'oz';

    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Scale any recipe to a batch. Scaled ingredient quantities are calculated automatically.
          For stirred or shaken batches, the recommended dilution water is shown to compensate
          for the ice dilution that normally happens per-serve.
        </Typography>

        <RecipeLoader />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Method</InputLabel>
            <Select
              label="Method"
              value={batchMethod}
              onChange={(e) => setBatchMethod(e.target.value)}
            >
              {Object.keys(DILUTION_BY_METHOD).map((m) => (
                <MenuItem key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Scale to (servings)"
            size="small"
            type="number"
            value={batchServings}
            onChange={(e) => setBatchServings(e.target.value)}
            sx={{ width: 180 }}
            inputProps={{ min: 1, step: 1 }}
          />
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Single-Serving Ingredients
        </Typography>

        {batchRows.map((row, idx) => {
          const batchWarn = getBatchWarning(row.name);
          return (
            <Box key={row.id} sx={{ mb: 1.5 }}>
              <TextField
                size="small"
                placeholder="Ingredient name"
                value={row.name}
                onChange={(e) => setBatchRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r)
                )}
                sx={{ width: '100%' }}
              />
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="Amount"
                  type="number"
                  value={row.amount}
                  onChange={(e) => setBatchRows((rows) =>
                    rows.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r)
                  )}
                  sx={{ width: 90 }}
                  inputProps={{ min: 0, step: 0.25 }}
                />
                <UnitSelect
                  value={row.unit}
                  onChange={(v) => setBatchRows((rows) =>
                    rows.map((r, i) => i === idx ? { ...r, unit: v } : r)
                  )}
                />
                {batchWarn === 'skip' && (
                  <Tooltip title="Carbonated — add per glass when serving, not to the pre-batch">
                    <Chip
                      icon={<WarningAmberIcon />}
                      label="don't batch"
                      size="small"
                      color="warning"
                      variant="outlined"
                      sx={{ height: 24 }}
                    />
                  </Tooltip>
                )}
                {batchWarn === 'caution' && (
                  <Tooltip title="Foam or texture may be affected by pre-batching">
                    <Chip label="check texture" size="small" variant="outlined" sx={{ height: 24, opacity: 0.75 }} />
                  </Tooltip>
                )}
                <Tooltip title="Remove row">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => setBatchRows((rows) => rows.filter((_, i) => i !== idx))}
                      disabled={batchRows.length === 1}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          );
        })}

        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setBatchRows((r) => [...r, newBatchRow()])}
          sx={{ mb: 3 }}
        >
          Add ingredient
        </Button>

        {/* Results */}
        {batchResults ? (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontFamily: '"Playfair Display", serif' }}
            >
              Batch Results — {batchServings} servings
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {batchResults.scaled.some((r) => getBatchWarning(r.name) === 'skip') && (
              <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningAmberIcon />}>
                <Typography variant="caption">
                  <strong>Carbonated ingredients detected</strong> — add these per glass when
                  serving, not to the pre-batch. They are crossed out below.
                </Typography>
              </Alert>
            )}

            {batchResults.scaled.map((r, i) => {
              const resultWarn = getBatchWarning(r.name);
              return (
                <Box
                  key={i}
                  sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, alignItems: 'center' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography
                      variant="body2"
                      sx={{ color: resultWarn === 'skip' ? 'text.disabled' : 'inherit' }}
                    >
                      {r.name}
                    </Typography>
                    {resultWarn === 'caution' && (
                      <Chip label="check texture" size="small" sx={{ height: 18, fontSize: '0.65rem', opacity: 0.7 }} />
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    className="amount"
                    color={resultWarn === 'skip' ? 'text.disabled' : 'primary.main'}
                    sx={{
                      fontWeight: 600,
                      ml: 2,
                      textDecoration: resultWarn === 'skip' ? 'line-through' : 'none',
                    }}
                  >
                    {formatVolume(r.scaledAmountMl, preferred)}
                  </Typography>
                </Box>
              );
            })}

            {batchResults.dilutionPct > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, alignItems: 'baseline' }}>
                  <Typography variant="body2" color="text.secondary">
                    + Dilution water
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      (~{Math.round(batchResults.dilutionPct * 100)}%)
                    </Typography>
                  </Typography>
                  <Typography variant="body2" className="amount" color="text.secondary" sx={{ ml: 2 }}>
                    {formatVolume(batchResults.dilutionMl, preferred)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, alignItems: 'baseline' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Total batch volume</Typography>
                  <Typography variant="body2" className="amount" sx={{ fontWeight: 600, ml: 2 }}>
                    {formatVolume(batchResults.totalBatchMl, preferred)}
                  </Typography>
                </Box>

                <Alert severity="info" sx={{ mt: 2 }} icon={false}>
                  <Typography variant="caption">
                    {DILUTION_NOTE[batchMethod]}
                  </Typography>
                </Alert>
              </>
            )}
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2.5, opacity: 0.5, textAlign: 'center' }}>
            <CalculateIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Add ingredients and a serving count to see your batch amounts.
            </Typography>
          </Paper>
        )}
      </Box>
    );
  }

  // ── ABV tab ──────────────────────────────────────────────────────────────

  function AbvTab() {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Estimate the final ABV of your cocktail. Enter each ingredient's amount and ABV%, then
          choose a method to account for ice dilution. Non-alcoholic ingredients (ABV = 0) still
          contribute to total volume and lower the final ABV.
        </Typography>

        <RecipeLoader />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3, alignItems: 'flex-start' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Dilution method</InputLabel>
            <Select
              label="Dilution method"
              value={abvMethod}
              onChange={(e) => { setAbvMethod(e.target.value); setAbvCustomDilution(''); }}
            >
              {Object.keys(DILUTION_BY_METHOD).map((m) => (
                <MenuItem key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}{' '}
                  ({Math.round(DILUTION_BY_METHOD[m] * 100)}%)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Custom dilution %"
            size="small"
            type="number"
            value={abvCustomDilution}
            onChange={(e) => setAbvCustomDilution(e.target.value)}
            sx={{ width: 160 }}
            inputProps={{ min: 0, max: 100, step: 1 }}
            placeholder={`${Math.round(DILUTION_BY_METHOD[abvMethod] * 100)}%`}
          />
        </Box>

        <Typography variant="subtitle2" gutterBottom>Ingredients</Typography>

        {abvRows.map((row, idx) => (
          <Box key={row.id} sx={{ mb: 1.5 }}>
            <TextField
              size="small"
              placeholder="Ingredient"
              value={row.name}
              onChange={(e) => setAbvRows((rows) =>
                rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r)
              )}
              sx={{ width: '100%' }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
              <TextField
                size="small"
                placeholder="Amount"
                type="number"
                value={row.amount}
                onChange={(e) => setAbvRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r)
                )}
                sx={{ width: 90 }}
                inputProps={{ min: 0, step: 0.25 }}
              />
              <UnitSelect
                value={row.unit}
                onChange={(v) => setAbvRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, unit: v } : r)
                )}
              />
              <TextField
                size="small"
                placeholder="ABV %"
                type="number"
                value={row.abv}
                onChange={(e) => setAbvRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, abv: e.target.value } : r)
                )}
                sx={{ width: 90 }}
                inputProps={{ min: 0, max: 100, step: 0.5 }}
                label="ABV %"
              />
              <Tooltip title="Remove row">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setAbvRows((rows) => rows.filter((_, i) => i !== idx))}
                    disabled={abvRows.length === 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        ))}

        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setAbvRows((r) => [...r, newAbvRow()])}
          sx={{ mb: 3 }}
        >
          Add ingredient
        </Button>

        {/* Results */}
        {abvResults ? (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontFamily: '"Playfair Display", serif' }}
            >
              ABV Results
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Neat ABV (pre-dilution)
                </Typography>
                <Typography variant="h4" color="primary.main" sx={{ fontFamily: '"Playfair Display", serif' }}>
                  {abvResults.neatAbv.toFixed(1)}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Final ABV (after ~{Math.round(abvResults.dilutionPct * 100)}% dilution)
                </Typography>
                <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif' }}>
                  {abvResults.dilutedAbv.toFixed(1)}%
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 1.5 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Total ingredient volume</Typography>
              <Typography variant="body2" className="amount">
                {formatVolume(abvResults.totalVolumeMl, user?.default_units ?? 'oz')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Dilution water (~{Math.round(abvResults.dilutionPct * 100)}%)
              </Typography>
              <Typography variant="body2" className="amount">
                {formatVolume(abvResults.dilutionMl, user?.default_units ?? 'oz')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Final volume</Typography>
              <Typography variant="body2" className="amount" sx={{ fontWeight: 600 }}>
                {formatVolume(abvResults.totalVolumeMl + abvResults.dilutionMl, user?.default_units ?? 'oz')}
              </Typography>
            </Box>

            {abvResults.dilutionPct > 0 && (
              <Alert severity="info" sx={{ mt: 2 }} icon={false}>
                <Typography variant="caption">
                  {DILUTION_NOTE[abvMethod]}
                </Typography>
              </Alert>
            )}
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2.5, opacity: 0.5, textAlign: 'center' }}>
            <CalculateIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Add at least one ingredient with amount and ABV% to see results.
            </Typography>
          </Paper>
        )}
      </Box>
    );
  }

  // ── Cost tab ─────────────────────────────────────────────────────────────

  function CostTab() {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Calculate the ingredient cost per serving and per batch. Enter the bottle price and
          size (e.g., $35 / 750 ml) for each ingredient — the calculator converts your pour size
          to a fraction of the bottle.
        </Typography>

        <RecipeLoader />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <TextField
            label="Servings (for batch cost)"
            size="small"
            type="number"
            value={costServings}
            onChange={(e) => setCostServings(e.target.value)}
            sx={{ width: 200 }}
            inputProps={{ min: 1, step: 1 }}
          />
        </Box>

        <Typography variant="subtitle2" gutterBottom>Ingredients</Typography>

        {costRows.map((row, idx) => (
          <Box
            key={row.id}
            sx={{
              mb: 2, pb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            {/* Line 1: name + delete */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.75 }}>
              <TextField
                size="small"
                placeholder="Ingredient"
                value={row.name}
                onChange={(e) => setCostRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r)
                )}
                sx={{ flex: 1 }}
              />
              <Tooltip title="Remove row">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setCostRows((rows) => rows.filter((_, i) => i !== idx))}
                    disabled={costRows.length === 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            {/* Line 2: pour */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 36 }}>
                Pour:
              </Typography>
              <TextField
                size="small"
                placeholder="Amount"
                type="number"
                value={row.amount}
                onChange={(e) => setCostRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r)
                )}
                sx={{ width: 80 }}
                inputProps={{ min: 0, step: 0.25 }}
              />
              <UnitSelect
                value={row.unit}
                onChange={(v) => setCostRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, unit: v } : r)
                )}
              />
            </Box>

            {/* Line 3: bottle */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 36 }}>
                Bottle:
              </Typography>
              <TextField
                size="small"
                placeholder="Size"
                type="number"
                value={row.bottleSize}
                onChange={(e) => setCostRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, bottleSize: e.target.value } : r)
                )}
                sx={{ width: 80 }}
                inputProps={{ min: 0, step: 50 }}
              />
              <UnitSelect
                value={row.bottleSizeUnit}
                onChange={(v) => setCostRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, bottleSizeUnit: v } : r)
                )}
                units={['ml', 'oz', 'L', 'cup']}
              />
              <TextField
                size="small"
                placeholder="$"
                type="number"
                value={row.price}
                onChange={(e) => setCostRows((rows) =>
                  rows.map((r, i) => i === idx ? { ...r, price: e.target.value } : r)
                )}
                sx={{ width: 80 }}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{ startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>$</Typography> }}
              />
            </Box>
          </Box>
        ))}

        <Button
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setCostRows((r) => [...r, newCostRow()])}
          sx={{ mb: 3 }}
        >
          Add ingredient
        </Button>

        {/* Results */}
        {costResults ? (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontFamily: '"Playfair Display", serif' }}
            >
              Cost Results
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {costResults.itemized.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">{item.name}</Typography>
                <Typography variant="body2" className="amount">
                  ${item.costPerUse.toFixed(2)}
                </Typography>
              </Box>
            ))}

            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Cost per serving</Typography>
              <Typography
                variant="body2"
                className="amount"
                color="primary.main"
                sx={{ fontWeight: 700, fontSize: '1.1rem' }}
              >
                ${costResults.totalPerServing.toFixed(2)}
              </Typography>
            </Box>
            {costResults.totalBatch !== null && parseFloat(costServings) > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Cost for {costServings} servings
                </Typography>
                <Typography variant="body2" className="amount" sx={{ fontWeight: 600 }}>
                  ${costResults.totalBatch.toFixed(2)}
                </Typography>
              </Box>
            )}
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2.5, opacity: 0.5, textAlign: 'center' }}>
            <CalculateIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Add ingredients with a bottle price and size to see cost estimates.
            </Typography>
          </Paper>
        )}
      </Box>
    );
  }

  // ── Slushie tab ──────────────────────────────────────────────────────────

  function SlushieTab() {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Build slushie-machine batches by starting with about 20% dilution,
          then adjust until the mix lands in the 13-15 Brix zone.
          This estimates the water or syrup adjustment needed and your final ABV.
        </Typography>

        <RecipeLoader />

        <Alert severity="info" sx={{ mb: 3 }} icon={false}>
          <Typography variant="caption">
            Recommended starting targets: 20% water dilution, 13-15 Brix final mix.
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <TextField
            label="Base batch volume"
            size="small"
            type="number"
            value={slushBaseVolume}
            onChange={(e) => setSlushBaseVolume(e.target.value)}
            sx={{ width: 180 }}
            inputProps={{ min: 1, step: 50 }}
            helperText="ml"
          />
          <TextField
            label="Base ABV"
            size="small"
            type="number"
            value={slushBaseAbv}
            onChange={(e) => setSlushBaseAbv(e.target.value)}
            sx={{ width: 140 }}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            helperText="%"
          />
          <TextField
            label="Current Brix"
            size="small"
            type="number"
            value={slushCurrentBrix}
            onChange={(e) => setSlushCurrentBrix(e.target.value)}
            sx={{ width: 140 }}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            helperText="%"
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <TextField
            label="Initial water dilution"
            size="small"
            type="number"
            value={slushInitialWaterPct}
            onChange={(e) => setSlushInitialWaterPct(e.target.value)}
            sx={{ width: 190 }}
            inputProps={{ min: 0, max: 200, step: 1 }}
            helperText="% (20 is common)"
          />
          <TextField
            label="Target Brix"
            size="small"
            type="number"
            value={slushTargetBrix}
            onChange={(e) => setSlushTargetBrix(e.target.value)}
            sx={{ width: 140 }}
            inputProps={{ min: 1, max: 99, step: 0.1 }}
            helperText="13-15"
          />
          <TextField
            label="Syrup Brix"
            size="small"
            type="number"
            value={slushSyrupBrix}
            onChange={(e) => setSlushSyrupBrix(e.target.value)}
            sx={{ width: 140 }}
            inputProps={{ min: 1, max: 99, step: 0.1 }}
            helperText="50 for 1:1"
          />
        </Box>

        {slushieResults ? (
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontFamily: '"Playfair Display", serif' }}
            >
              Slushie Results
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Initial water to add</Typography>
              <Typography variant="body2" className="amount" color="primary.main" sx={{ fontWeight: 600 }}>
                {formatVolume(slushieResults.initialWaterMl, user?.default_units ?? 'oz')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Brix after initial dilution</Typography>
              <Typography variant="body2" className="amount">
                {slushieResults.preAdjustedBrixPct.toFixed(1)}%
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {slushieResults.adjustMode === 'water' && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Extra water adjustment</Typography>
                <Typography variant="body2" className="amount" sx={{ fontWeight: 600 }}>
                  {formatVolume(slushieResults.adjustmentMl, user?.default_units ?? 'oz')}
                </Typography>
              </Box>
            )}

            {slushieResults.adjustMode === 'syrup' && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Syrup adjustment ({slushSyrupBrix}% Brix)
                </Typography>
                <Typography variant="body2" className="amount" sx={{ fontWeight: 600 }}>
                  {formatVolume(slushieResults.adjustmentMl, user?.default_units ?? 'oz')}
                </Typography>
              </Box>
            )}

            {slushieResults.adjustMode === 'none' && (
              <Alert severity="success" sx={{ my: 1.5 }}>
                You&apos;re already at your target Brix after the initial dilution.
              </Alert>
            )}

            {slushieResults.adjustMode === 'invalid' && (
              <Alert severity="warning" sx={{ my: 1.5 }}>
                Syrup Brix must be higher than target Brix to raise sweetness. Use a richer syrup.
              </Alert>
            )}

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Final Brix</Typography>
              <Typography variant="body2" className="amount" sx={{ fontWeight: 600 }}>
                {slushieResults.finalBrixPct.toFixed(1)}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Projected final ABV</Typography>
              <Typography variant="body2" className="amount" sx={{ fontWeight: 600 }}>
                {slushieResults.finalAbvPct.toFixed(1)}%
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Final batch volume</Typography>
              <Typography variant="body2" className="amount" sx={{ fontWeight: 600 }}>
                {formatVolume(slushieResults.finalVolumeMl, user?.default_units ?? 'oz')}
              </Typography>
            </Box>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 2.5, opacity: 0.5, textAlign: 'center' }}>
            <CalculateIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Enter a valid volume, ABV, and Brix to calculate slushie adjustments.
            </Typography>
          </Paper>
        )}
      </Box>
    );
  }

  // ── Page render ───────────────────────────────────────────────────────────

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <CalculateIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif' }}>
          Calculators
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Batch scale, estimate ABV, and calculate ingredient costs. Load any recipe as a starting point or build from scratch.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Batch" />
        <Tab label="ABV" />
        <Tab label="Cost" />
        <Tab label="Slushie" />
      </Tabs>

      {tab === 0 && <BatchTab />}
      {tab === 1 && <AbvTab />}
      {tab === 2 && <CostTab />}
      {tab === 3 && <SlushieTab />}
    </Box>
  );
}
