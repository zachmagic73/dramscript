import { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';

interface CocktailSpritePlaceholderProps {
  seed: string;
  fallbackEmoji: string;
  height?: number;
  width?: number;
  iconNumber?: number | null;
  withBottomBorder?: boolean;
}

const SPRITE_CANDIDATES = [
  '/images/cocktail-icons-sheet.jpg',
  '/images/cocktail-icons-sheet.png',
];
const GRID_COLS = 10;
const GRID_ROWS = 5;
const ICON_COUNT = GRID_COLS * GRID_ROWS;

// Source sheet dimensions from the provided art board.
const SHEET_WIDTH = 1280;
const SHEET_HEIGHT = 720;

// Approximate icon area (banner excluded on the right side).
const ICON_AREA_X = 20;
const ICON_AREA_Y = 18;
const ICON_AREA_WIDTH = 1160;
const ICON_AREA_HEIGHT = 688;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default function CocktailSpritePlaceholder({
  seed,
  fallbackEmoji,
  height = 100,
  width,
  iconNumber,
  withBottomBorder = true,
}: CocktailSpritePlaceholderProps) {
  const [spriteReady, setSpriteReady] = useState(false);
  const [spriteUrl, setSpriteUrl] = useState<string>(SPRITE_CANDIDATES[0]);

  useEffect(() => {
    let cancelled = false;

    const tryLoad = (index: number) => {
      if (index >= SPRITE_CANDIDATES.length) {
        if (!cancelled) setSpriteReady(false);
        return;
      }

      const candidate = SPRITE_CANDIDATES[index];
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setSpriteUrl(candidate);
        setSpriteReady(true);
      };
      img.onerror = () => tryLoad(index + 1);
      img.src = candidate;
    };

    setSpriteReady(false);
    tryLoad(0);

    return () => {
      cancelled = true;
    };
  }, []);

  const style = useMemo(() => {
    const explicit = iconNumber && iconNumber >= 1 && iconNumber <= ICON_COUNT
      ? iconNumber - 1
      : null;
    const idx = explicit ?? (hashSeed(seed) % ICON_COUNT);
    const col = idx % GRID_COLS;
    const row = Math.floor(idx / GRID_COLS);

    const cellW = ICON_AREA_WIDTH / GRID_COLS;
    const cellH = ICON_AREA_HEIGHT / GRID_ROWS;

    const targetWidth = width ?? height;
    // Use cover-style scaling so the icon fills the wrapper while staying centered.
    const scale = Math.max(targetWidth / cellW, height / cellH);
    const bgW = SHEET_WIDTH * scale;
    const bgH = SHEET_HEIGHT * scale;

    const posX = -(ICON_AREA_X + col * cellW) * scale + (targetWidth - cellW * scale) / 2;
    const posY = -(ICON_AREA_Y + row * cellH) * scale + (height - cellH * scale) / 2;

    return {
      backgroundImage: `url(${spriteUrl})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${posX}px ${posY}px`,
    };
  }, [height, iconNumber, seed, spriteUrl, width]);

  if (!spriteReady) {
    return (
      <Box
        sx={{
          height,
          width: width ?? '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          bgcolor: 'background.default',
        }}
      >
        {fallbackEmoji}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height,
        width: width ?? '100%',
        borderBottom: withBottomBorder ? '1px solid' : 'none',
        borderColor: withBottomBorder ? 'divider' : 'transparent',
        ...style,
      }}
    />
  );
}