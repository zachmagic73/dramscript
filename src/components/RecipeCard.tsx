import { Card, CardActionArea, CardContent, CardMedia, Box, Typography, Chip, Avatar } from '@mui/material';
import type { Recipe } from '../types';
import CocktailSpritePlaceholder from './CocktailSpritePlaceholder';
import { resolvePlaceholderIcon } from '../utils/cocktailIcons';

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
  showCreator?: boolean;
}

export default function RecipeCard({ recipe, onClick, showCreator }: RecipeCardProps) {
  const imageUrl = recipe.primary_image
    ? `/api/images/${recipe.primary_image}`
    : null;
  const placeholderIcon = resolvePlaceholderIcon(recipe, recipe.placeholder_icon);

  return (
    <Card>
      <CardActionArea onClick={onClick}>
        <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
          {imageUrl ? (
            <CardMedia
              component="img"
              image={imageUrl}
              alt={recipe.name}
              sx={{ width: 110, height: 110, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <CocktailSpritePlaceholder
              seed={`${recipe.id}:${recipe.name}`}
              fallbackEmoji={TYPE_EMOJI[recipe.type] ?? '🥃'}
              iconNumber={placeholderIcon}
              height={110}
              width={110}
              withBottomBorder={false}
            />
          )}

          <CardContent sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
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

          {/* Creator info (for discovered recipes) */}
          {showCreator && recipe.display_name && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Avatar src={recipe.avatar_url || undefined} sx={{ width: 24, height: 24 }} />
              <Typography variant="caption" color="text.secondary">
                {recipe.display_name}
              </Typography>
            </Box>
          )}
          </CardContent>
        </Box>
      </CardActionArea>
    </Card>
  );
}
