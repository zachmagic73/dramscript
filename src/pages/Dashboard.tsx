import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid2 as Grid, TextField, Select, MenuItem, FormControl,
  InputLabel, Chip, CircularProgress, Alert, InputAdornment,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { Recipe, RecipeType, Difficulty } from '../types';
import { RECIPE_TYPES, DIFFICULTIES } from '../types';
import RecipeCard from '../components/RecipeCard';

const ALL = '';

export default function Dashboard() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RecipeType | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | ''>('');

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('q', search);
      if (typeFilter) qs.set('type', typeFilter);
      if (difficultyFilter) qs.set('difficulty', difficultyFilter);
      const res = await fetch(`/api/recipes?${qs}`);
      if (!res.ok) throw new Error('Failed to load recipes');
      const data = await res.json() as { recipes: Recipe[] };
      setRecipes(data.recipes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, difficultyFilter]);

  useEffect(() => {
    const t = setTimeout(fetchRecipes, 300);
    return () => clearTimeout(t);
  }, [fetchRecipes]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          My Journal
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 220 }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value as RecipeType | '')}
          >
            <MenuItem value={ALL}>All types</MenuItem>
            {RECIPE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Difficulty</InputLabel>
          <Select
            value={difficultyFilter}
            label="Difficulty"
            onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | '')}
          >
            <MenuItem value={ALL}>All</MenuItem>
            {DIFFICULTIES.map((d) => (
              <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Quick tag pills — common tags */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {['citrusy', 'boozy', 'herbal', 'tropical', 'bitter', 'smoky'].map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              color="primary"
              variant="outlined"
              clickable
              onClick={() => setSearch(tag)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Box>

      {/* Content */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : recipes.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center', py: 10,
            border: '1px dashed', borderColor: 'divider', borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {search || typeFilter || difficultyFilter
              ? 'No recipes match your filters'
              : 'No recipes yet'}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Hit the <strong style={{ color: '#D4AF37' }}>+</strong> button to add your first recipe.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {recipes.map((recipe) => (
            <Grid key={recipe.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <RecipeCard
                recipe={recipe}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

// Re-export to prevent unused import warning on ToggleButton/ToggleButtonGroup
export { ToggleButton, ToggleButtonGroup };
