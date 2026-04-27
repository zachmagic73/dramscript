import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid2 as Grid, TextField, Select, MenuItem, FormControl,
  InputLabel, Chip, CircularProgress, Alert, InputAdornment,
  Card, CardActionArea, CardContent, Button, Drawer, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import type { Recipe, RecipeType, Difficulty, RecipeTemplate } from '../types';
import { RECIPE_TYPES, DIFFICULTIES } from '../types';
import RecipeCard from '../components/RecipeCard';

const ALL = '';

export default function Dashboard() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [templates, setTemplates] = useState<RecipeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RecipeType | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | ''>('');
  const [tagFilter, setTagFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState<'hide' | 'show'>('hide');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = [
    typeFilter !== '',
    difficultyFilter !== '',
    tagFilter !== '',
    templateFilter !== 'hide',
  ].filter(Boolean).length;

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('q', search);
      if (typeFilter) qs.set('type', typeFilter);
      if (difficultyFilter) qs.set('difficulty', difficultyFilter);
      if (tagFilter) qs.set('tag', tagFilter);

      const requests: Promise<Response>[] = [fetch(`/api/recipes?${qs}`)];

      if (templateFilter === 'show') {
        const tqs = new URLSearchParams();
        if (search) tqs.set('q', search);
        if (typeFilter) tqs.set('type', typeFilter);
        requests.push(fetch(`/api/templates?${tqs}`));
      }

      const [recipesRes, templatesRes] = await Promise.all(requests);
      if (!recipesRes.ok) throw new Error('Failed to load recipes');

      const recipesData = await recipesRes.json() as { recipes: Recipe[] };
      setRecipes(recipesData.recipes);

      if (templatesRes) {
        if (!templatesRes.ok) throw new Error('Failed to load templates');
        const templatesData = await templatesRes.json() as { templates: RecipeTemplate[] };
        setTemplates(templatesData.templates);
      } else {
        setTemplates([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, difficultyFilter, tagFilter, templateFilter]);

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
          {templateFilter === 'show' ? ` • ${templates.length} ${templates.length === 1 ? 'template' : 'templates'}` : ''}
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
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
          sx={{ minWidth: 220, flex: 1, maxWidth: 480 }}
        />

        <Button
          variant={activeFilterCount > 0 ? 'contained' : 'outlined'}
          color="primary"
          startIcon={<FilterListIcon />}
          onClick={() => setFiltersOpen(true)}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
        </Button>
      </Box>

      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      >
        <Box sx={{ width: { xs: '86vw', sm: 360 }, p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Filters</Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Templates</InputLabel>
              <Select
                value={templateFilter}
                label="Templates"
                onChange={(e) => setTemplateFilter(e.target.value as 'hide' | 'show')}
              >
                <MenuItem value="hide">Hide templates</MenuItem>
                <MenuItem value="show">Show templates too</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
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

            <FormControl size="small" fullWidth>
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

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Tags</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {['citrusy', 'boozy', 'herbal', 'tropical', 'bitter', 'smoky'].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    color="primary"
                    variant={tagFilter === tag ? 'filled' : 'outlined'}
                    clickable
                    onClick={() => setTagFilter((t) => t === tag ? '' : tag)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setTypeFilter('');
                  setDifficultyFilter('');
                  setTagFilter('');
                  setTemplateFilter('hide');
                }}
              >
                Clear
              </Button>
              <Button fullWidth variant="contained" onClick={() => setFiltersOpen(false)}>
                Done
              </Button>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* Content */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : recipes.length === 0 && (templateFilter !== 'show' || templates.length === 0) ? (
        <Box
          sx={{
            textAlign: 'center', py: 10,
            border: '1px dashed', borderColor: 'divider', borderRadius: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {search || typeFilter || difficultyFilter || tagFilter || templateFilter !== 'hide'
              ? 'No recipes match your filters'
              : 'No recipes yet'}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Hit the <strong style={{ color: '#D4AF37' }}>+</strong> button to add your first recipe.
          </Typography>
        </Box>
      ) : (
        <Box>
          {recipes.length > 0 && (
            <Grid container spacing={2} sx={{ mb: templateFilter === 'show' && templates.length > 0 ? 3 : 0 }}>
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

          {templateFilter === 'show' && templates.length > 0 && (
            <>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Template Cocktails
              </Typography>
              <Grid container spacing={2}>
                {templates.map((template) => (
                  <Grid key={template.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card sx={{ borderRadius: 2 }}>
                      <CardActionArea onClick={() => navigate(`/templates/${template.id}`)}>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 0.5 }}>{template.name}</Typography>
                          {template.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mb: 1,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {template.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {template.base_type && <Chip size="small" label={template.base_type} />}
                            <Chip size="small" label={`${template.riff_count ?? 0} riffs`} />
                          </Box>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
