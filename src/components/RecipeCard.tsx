import { Card, CardActionArea, CardContent, CardMedia, Box, Typography, Chip } from '@mui/material';
import type { Recipe } from '../types';

const TYPE_EMOJI: Record<string, string> = {
  cocktail: '🍸', syrup: '🍯', bitter: '🌿', tincture: '🧪',
  shrub:    '🍇', batch: '🫙', other:   '🥃',
};

const DIFFICULTY_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  easy:   'success',
  medium: 'warning',
  hard:   'error',
};

interface RecipeCardProps {
  recipe: Recipe;
  onClick?: () => void;
}

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const imageUrl = recipe.primary_image
    ? `/api/images/${recipe.primary_image}`
    : null;

  return (
    <Card>
      <CardActionArea onClick={onClick}>
        {/* Image or emoji placeholder */}
        {imageUrl ? (
          <CardMedia
            component="img"
            height="160"
            image={imageUrl}
            alt={recipe.name}
            sx={{ objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 48,
              bgcolor: 'background.default',
            }}
          >
            {TYPE_EMOJI[recipe.type] ?? '🥃'}
          </Box>
        )}

        <CardContent>
          <Typography variant="h6" gutterBottom noWrap>
            {recipe.name}
          </Typography>

          {/* Meta chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            <Chip label={recipe.type} size="small" sx={{ textTransform: 'capitalize' }} />
            {recipe.method && (
              <Chip label={recipe.method} size="small" variant="outlined" />
            )}
            {recipe.difficulty && (
              <Chip
                label={recipe.difficulty}
                size="small"
                color={DIFFICULTY_COLOR[recipe.difficulty]}
                variant="outlined"
              />
            )}
            {Boolean(recipe.is_public) && (
              <Chip label="public" size="small" color="info" variant="outlined" />
            )}
          </Box>

          {/* Tags */}
          {recipe.tags?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {recipe.tags.slice(0, 3).map((tag) => (
                <Chip key={tag} label={tag} size="small" color="primary" />
              ))}
              {recipe.tags.length > 3 && (
                <Chip label={`+${recipe.tags.length - 3}`} size="small" />
              )}
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
