import { useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, IconButton, CircularProgress, Tooltip, Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { RecipeImage } from '../types';

interface ImageManagerProps {
  recipeId: string;
  images: RecipeImage[];
  onClose: () => void;
  onUpdate: (images: RecipeImage[]) => void;
}

export default function ImageManager({ recipeId, images, onClose, onUpdate }: ImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Upload failed');
      }
      const newImage = await res.json() as RecipeImage;
      onUpdate([...images, newImage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (imageId: string) => {
    const res = await fetch(`/api/recipes/${recipeId}/images/${imageId}`, { method: 'DELETE' });
    if (res.ok) {
      onUpdate(images.filter((i) => i.id !== imageId));
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    const res = await fetch(`/api/recipes/${recipeId}/images/${imageId}/primary`, { method: 'PATCH' });
    if (res.ok) {
      onUpdate(images.map((i) => ({ ...i, is_primary: i.id === imageId ? 1 : 0 })));
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Recipe Images</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Upload zone */}
        <Box
          sx={{
            border: '2px dashed', borderColor: 'divider', borderRadius: 2,
            p: 3, textAlign: 'center', mb: 2, cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main' },
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={handleUpload}
          />
          {uploading ? (
            <CircularProgress size={24} color="primary" />
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Click to upload an image (JPEG, PNG, WebP, GIF — max 10 MB)
              </Typography>
            </>
          )}
        </Box>

        {/* Image grid */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {images.map((img) => (
            <Box
              key={img.id}
              sx={{
                position: 'relative',
                width: 120, height: 120,
                borderRadius: 1,
                overflow: 'hidden',
                border: img.is_primary ? '2px solid' : '1px solid',
                borderColor: img.is_primary ? 'primary.main' : 'divider',
              }}
            >
              <Box
                component="img"
                src={`/api/images/${img.r2_key}`}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <Box
                sx={{
                  position: 'absolute', top: 0, right: 0,
                  display: 'flex', flexDirection: 'column',
                  bgcolor: 'rgba(18,18,18,0.7)', borderRadius: '0 0 0 4px',
                }}
              >
                <Tooltip title={img.is_primary ? 'Primary image' : 'Set as primary'}>
                  <IconButton
                    size="small"
                    onClick={() => handleSetPrimary(img.id)}
                    sx={{ color: img.is_primary ? 'primary.main' : 'text.disabled' }}
                  >
                    {img.is_primary ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete image">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(img.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
