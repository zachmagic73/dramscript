import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid2 as Grid, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Alert, InputAdornment, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { Recipe, RecipeType, Difficulty } from '../types';
import { RECIPE_TYPES, DIFFICULTIES } from '../types';
import RecipeCard from '../components/RecipeCard';

export default function Discover() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      qs.set('limit', '50');

      const response = await fetch(`/api/recipes/public/search?${qs}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { recipes: Recipe[] };
      setRecipes(data.recipes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recipes');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, difficultyFilter]);

  useEffect(() => {
    const timeout = setTimeout(fetchRecipes, 300);
    return () => clearTimeout(timeout);
  }, [fetchRecipes]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Discover
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Explore cocktails shared by the community and your friends
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value as RecipeType | '')}>
            <MenuItem value="">All Types</MenuItem>
            {RECIPE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Difficulty</InputLabel>
          <Select
            value={difficultyFilter}
            label="Difficulty"
            onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | '')}>
            <MenuItem value="">All Levels</MenuItem>
            {DIFFICULTIES.map((d) => (
              <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && recipes.length === 0 && (
        <Alert severity="info">No recipes found. Try different filters!</Alert>
      )}

      {!loading && recipes.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Found {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
          </Typography>
          <Grid container spacing={2}>
            {recipes.map((recipe) => (
              <Grid key={recipe.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Box sx={{ cursor: 'pointer', height: '100%' }}>
                  {recipe.saved_status && (
                    <Box sx={{ mb: 1 }}>
                      <Chip
                        size="small"
                        color={recipe.saved_status === 'made' ? 'success' : 'warning'}
                        label={
                          recipe.saved_status === 'made'
                            ? 'In My Journal • Made'
                            : 'In My Journal • Want To Make'
                        }
                      />
                    </Box>
                  )}
                  <Box onClick={() => navigate(`/recipes/${recipe.id}`)}>
                    <RecipeCard recipe={recipe} showCreator={true} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
