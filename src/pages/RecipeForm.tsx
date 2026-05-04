import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Chip, Autocomplete, Alert,
  CircularProgress, Divider, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkIcon from '@mui/icons-material/Link';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Tesseract from 'tesseract.js';
import type { Recipe, RecipeFormValues } from '../types';
import { RECIPE_TYPES, ICE_TYPES, METHODS, DIFFICULTIES, UNITS, GLASS_TYPES } from '../types';
import CocktailSpritePlaceholder from '../components/CocktailSpritePlaceholder';
import { ICON_COUNT, resolvePlaceholderIcon } from '../utils/cocktailIcons';
import { useAuth } from '../hooks/useAuth';

// ── Ingredient reference suggestion type ─────────────────────────────────────
interface IngRefSuggestion {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
}

// ── AI-parsed recipe shape ────────────────────────────────────────────────────
interface ParsedRecipe {
  name: string | null;
  glass_type: string | null;
  ice_type: string | null;
  method: string | null;
  garnish: string | null;
  ingredients: Array<{ amount: string; unit: string; name: string }>;
  steps: string[];
  notes: string | null;
}

interface ConfidenceReport {
  title: 'high' | 'medium' | 'low';
  ingredients: 'high' | 'medium' | 'low';
  steps: 'high' | 'medium' | 'low';
  warnings: string[];
}

function ConfidenceChip({ level }: { level: 'high' | 'medium' | 'low' }) {
  const colors = { high: '#4A7C59', medium: '#D4622A', low: '#C0392B' } as const;
  const labels = { high: 'High', medium: 'Medium', low: 'Low' } as const;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#fff',
        bgcolor: colors[level],
        ml: 0.5,
      }}
    >
      {labels[level]}
    </Box>
  );
}

// ── Image parse dialog ────────────────────────────────────────────────────────
function ImageParseDialog({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (parsed: ParsedRecipe) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseStage, setParseStage] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceReport | null>(null);

  const reset = () => {
    setPreview(null);
    setParsing(false);
    setParseStage('');
    setParseError(null);
    setParsed(null);
    setConfidence(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsed(null);
    setConfidence(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      await runParse(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const runParse = async (dataUrl: string) => {
    setParsing(true);
    setParseStage('Reading text in browser…');
    setParseError(null);
    setParsed(null);
    setConfidence(null);
    try {
      const ocrResult = await Tesseract.recognize(dataUrl, 'eng');
      const ocrText = ocrResult?.data?.text?.trim() ?? '';
      const ocrConfidence =
        typeof ocrResult?.data?.confidence === 'number' ? ocrResult.data.confidence : null;

      setParseStage('Parsing recipe…');
      const res = await fetch('/api/recipes/parse-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, ocrText, ocrConfidence, diagnostics: true }),
      });
      const data = await res.json() as {
        parsed?: ParsedRecipe;
        confidence?: ConfidenceReport;
        error?: string;
        extractionStatus?: string;
      };

      if (data.confidence) setConfidence(data.confidence);

      if (data.error && data.parsed) {
        // Soft error — partial result available
        setParseError(data.error);
        setParsed(data.parsed);
        return;
      }
      if (!res.ok || data.error) {
        setParseError(data.error ?? 'Parsing failed. Try a clearer photo.');
        return;
      }
      if (!data.parsed || (!data.parsed.name && data.parsed.ingredients.length === 0)) {
        setParseError("Couldn't find a recipe in that image. Try a clearer photo of the recipe card or page.");
        return;
      }
      setParsed(data.parsed);
    } catch {
      setParseError('OCR or network error. Please try again.');
    } finally {
      setParseStage('');
      setParsing(false);
    }
  };

  const handleApply = () => {
    if (parsed) {
      onApply(parsed);
      handleClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DocumentScannerIcon color="primary" />
          Scan a Recipe
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Take a photo or upload an image of a recipe card, cookbook page, or handwritten recipe.
          Fast browser OCR is tried first, and cloud OCR is used automatically if needed.
        </Typography>

        {/* Hidden file input — accept images, allow camera on mobile */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {!preview && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
            >
              Upload Image
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
            >
              Take Photo
            </Button>
          </Box>
        )}

        {preview && (
          <Box sx={{ mb: 2 }}>
            <Box
              component="img"
              src={preview}
              alt="Recipe preview"
              sx={{
                width: '100%',
                maxHeight: 280,
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                display: 'block',
                mb: 1.5,
              }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                reset();
                setTimeout(() => fileInputRef.current?.click(), 50);
              }}
            >
              Use a different image
            </Button>
          </Box>
        )}

        {parsing && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {parseStage || 'Reading recipe…'}
            </Typography>
            <LinearProgress color="primary" />
          </Box>
        )}

        {parseError && (
          <Alert severity="error" sx={{ mt: 2 }}>{parseError}</Alert>
        )}

        {parsed && !parsing && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="success" sx={{ mb: 1.5 }}>
              Recipe parsed! Review what was found below, then click Apply.
            </Alert>

            {confidence && (
              <Box sx={{ mb: 1.5, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  Parse confidence
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.25 }}>
                  <strong>Title:</strong> <ConfidenceChip level={confidence.title} />
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.25 }}>
                  <strong>Ingredients:</strong> <ConfidenceChip level={confidence.ingredients} />
                </Typography>
                <Typography variant="body2" sx={{ mb: confidence.warnings.length ? 0.5 : 0 }}>
                  <strong>Steps:</strong> <ConfidenceChip level={confidence.steps} />
                </Typography>
                {confidence.warnings.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    {confidence.warnings.slice(0, 3).map((warning, idx) => (
                      <Typography key={idx} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        - {warning}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {parsed.name && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Name:</strong> {parsed.name}
              </Typography>
            )}
            {parsed.method && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Method:</strong> {parsed.method}
              </Typography>
            )}
            {parsed.glass_type && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Glass:</strong> {parsed.glass_type}
              </Typography>
            )}
            {parsed.ice_type && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Ice:</strong> {parsed.ice_type}
              </Typography>
            )}
            {parsed.garnish && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Garnish:</strong> {parsed.garnish}
              </Typography>
            )}
            {parsed.ingredients.length > 0 && (
              <Box sx={{ mt: 1, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>Ingredients ({parsed.ingredients.length}):</Typography>
                {parsed.ingredients.map((ing, i) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                    {[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
                  </Typography>
                ))}
              </Box>
            )}
            {parsed.steps.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={600}>Steps ({parsed.steps.length}):</Typography>
                {parsed.steps.slice(0, 3).map((s, i) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                    {i + 1}. {s.length > 80 ? s.slice(0, 80) + '…' : s}
                  </Typography>
                ))}
                {parsed.steps.length > 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                    + {parsed.steps.length - 3} more step{parsed.steps.length - 3 > 1 ? 's' : ''}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">Cancel</Button>
        {parsed && !parsing && (
          <Button onClick={handleApply} variant="contained" color="primary">
            Apply to form
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function TextParseDialog({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (parsed: ParsedRecipe) => void;
}) {
  const [inputText, setInputText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceReport | null>(null);

  const reset = () => {
    setInputText('');
    setParsing(false);
    setParseError(null);
    setParsed(null);
    setConfidence(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const runParse = async () => {
    if (!inputText.trim()) {
      setParseError('Paste or type recipe text first.');
      return;
    }

    setParsing(true);
    setParseError(null);
    setParsed(null);
    setConfidence(null);
    try {
      const res = await fetch('/api/recipes/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, diagnostics: true }),
      });
      const data = await res.json() as {
        parsed?: ParsedRecipe;
        confidence?: ConfidenceReport;
        error?: string;
      };

      if (data.confidence) setConfidence(data.confidence);

      if (data.error && data.parsed) {
        setParseError(data.error);
        setParsed(data.parsed);
        return;
      }
      if (!res.ok || data.error) {
        setParseError(data.error ?? 'Parsing failed. Try formatting the text with ingredients and steps.');
        return;
      }
      if (!data.parsed || (!data.parsed.name && data.parsed.ingredients.length === 0)) {
        setParseError("Couldn't find a recipe in that text. Add more details and try again.");
        return;
      }
      setParsed(data.parsed);
    } catch {
      setParseError('Network error while parsing text. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleApply = () => {
    if (parsed) {
      onApply(parsed);
      handleClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextSnippetIcon color="primary" />
          Paste Recipe Text
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Paste a recipe from notes, a website, or anywhere else. AI will parse the text and pre-fill your form fields.
        </Typography>

        <TextField
          fullWidth
          multiline
          minRows={10}
          maxRows={18}
          placeholder={'Example:\nOld Fashioned\n2 oz Bourbon\n1/4 oz Demerara Syrup\n2 dashes Angostura\nStir with ice and strain over a large cube.'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={parsing}
        />

        {parseError && <Alert severity="error" sx={{ mt: 2 }}>{parseError}</Alert>}

        {parsed && !parsing && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="success" sx={{ mb: 1.5 }}>
              Recipe parsed! Review what was found below, then click Apply.
            </Alert>

            {confidence && (
              <Box sx={{ mb: 1.5, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  Parse confidence
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.25 }}>
                  <strong>Title:</strong> <ConfidenceChip level={confidence.title} />
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.25 }}>
                  <strong>Ingredients:</strong> <ConfidenceChip level={confidence.ingredients} />
                </Typography>
                <Typography variant="body2" sx={{ mb: confidence.warnings.length ? 0.5 : 0 }}>
                  <strong>Steps:</strong> <ConfidenceChip level={confidence.steps} />
                </Typography>
              </Box>
            )}

            {parsed.name && (
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Name:</strong> {parsed.name}
              </Typography>
            )}
            {parsed.ingredients.length > 0 && (
              <Box sx={{ mt: 1, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>Ingredients ({parsed.ingredients.length}):</Typography>
                {parsed.ingredients.map((ing, i) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                    {[ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
                  </Typography>
                ))}
              </Box>
            )}
            {parsed.steps.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={600}>Steps ({parsed.steps.length}):</Typography>
                {parsed.steps.slice(0, 3).map((s, i) => (
                  <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                    {i + 1}. {s.length > 80 ? s.slice(0, 80) + '…' : s}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">Cancel</Button>
        {!parsed && (
          <Button onClick={runParse} variant="contained" disabled={parsing}>
            {parsing ? 'Parsing…' : 'Parse Text'}
          </Button>
        )}
        {parsed && !parsing && (
          <Button onClick={handleApply} variant="contained" color="primary">
            Apply to form
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}



// ── Sortable ingredient row ───────────────────────────────────────────────────
function SortableIngredientRow({
  ing,
  onChange,
  onChangeRef,
  onRemove,
  allRecipes,
}: {
  ing: RecipeFormValues['ingredients'][number];
  onChange: (field: string, value: string) => void;
  onChangeRef: (recipeId: string | null) => void;
  onRemove: () => void;
  allRecipes: Array<{ id: string; name: string; type: string }>;
}) {
  const [showRefDropdown, setShowRefDropdown] = useState(false);
  const [ingRefSuggestions, setIngRefSuggestions] = useState<IngRefSuggestion[]>([]);
  const [ingRefLoading, setIngRefLoading] = useState(false);
  const ingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ing.id });

  const handleIngRefSearch = (value: string) => {
    if (ingDebounceRef.current) clearTimeout(ingDebounceRef.current);
    if (!value.trim()) { setIngRefSuggestions([]); return; }
    ingDebounceRef.current = setTimeout(async () => {
      setIngRefLoading(true);
      try {
        const res = await fetch(`/api/ingredient-reference?q=${encodeURIComponent(value)}&limit=10`);
        if (!res.ok) return;
        const data = await res.json() as { results: IngRefSuggestion[] };
        setIngRefSuggestions(data.results);
      } finally {
        setIngRefLoading(false);
      }
    }, 220);
  };

  // Filter recipes for reference (syrups, bitters, tinctures, shrubs, but not the current recipe being edited)
  const validReferenceRecipes = allRecipes.filter(
    (r) => ['syrup', 'bitter', 'tincture', 'shrub'].includes(r.type)
  );

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: { xs: 'flex-start', sm: 'flex-start' },
        mb: 1,
        p: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <IconButton size="small" sx={{ cursor: 'grab', color: 'text.disabled', touchAction: 'none' }} {...attributes} {...listeners}>
        <DragIndicatorIcon fontSize="small" />
      </IconButton>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Desktop/tablet: single-line layout */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small" placeholder="Amount" value={ing.amount}
            onChange={(e) => onChange('amount', e.target.value)}
            sx={{ width: 80 }}
            slotProps={{ htmlInput: { type: 'number', min: 0, step: 0.25 } }}
          />
          <FormControl size="small" sx={{ width: 100 }}>
            <Select value={ing.unit} onChange={(e) => onChange('unit', e.target.value)} displayEmpty>
              <MenuItem value=""><em>unit</em></MenuItem>
              {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Autocomplete
            freeSolo
            options={ingRefSuggestions}
            getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
            inputValue={ing.name}
            onInputChange={(_, v) => { onChange('name', v); handleIngRefSearch(v); }}
            onChange={(_, val) => { if (val && typeof val !== 'string') onChange('name', val.name); }}
            loading={ingRefLoading}
            renderOption={(props, option) => {
              const opt = option as IngRefSuggestion;
              return (
                <Box component="li" {...props} key={opt.id}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{opt.name}</Typography>
                    {(opt.subcategory || opt.brand) && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {[opt.subcategory, opt.brand].filter(Boolean).join(' · ')}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="Ingredient name" />
            )}
            sx={{ flex: 1, minWidth: 150 }}
          />
        </Box>

        {/* Mobile: amount + unit on first line, ingredient on second line */}
        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small" placeholder="Amount" value={ing.amount}
              onChange={(e) => onChange('amount', e.target.value)}
              sx={{ width: 100 }}
              slotProps={{ htmlInput: { type: 'number', min: 0, step: 0.25 } }}
            />
            <FormControl size="small" sx={{ flex: 1 }}>
              <Select value={ing.unit} onChange={(e) => onChange('unit', e.target.value)} displayEmpty>
                <MenuItem value=""><em>unit</em></MenuItem>
                {UNITS.map((u) => <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <Autocomplete
            freeSolo
            fullWidth
            options={ingRefSuggestions}
            getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
            inputValue={ing.name}
            onInputChange={(_, v) => { onChange('name', v); handleIngRefSearch(v); }}
            onChange={(_, val) => { if (val && typeof val !== 'string') onChange('name', val.name); }}
            loading={ingRefLoading}
            renderOption={(props, option) => {
              const opt = option as IngRefSuggestion;
              return (
                <Box component="li" {...props} key={opt.id}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{opt.name}</Typography>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="Ingredient name" />
            )}
          />
        </Box>

        {/* Recipe reference dropdown (only when link button clicked) */}
        {showRefDropdown && (
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <Select
              value={ing.referenced_recipe_id ?? ''}
              onChange={(e) => {
                onChangeRef(e.target.value || null);
                setShowRefDropdown(false);
              }}
              displayEmpty
            >
              <MenuItem value=""><em>No recipe ref</em></MenuItem>
              {validReferenceRecipes.map((r) => (
                <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Link and Delete buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
        {validReferenceRecipes.length > 0 && (
          <Tooltip title={ing.referenced_recipe_id ? 'Update recipe link' : 'Link to a recipe'}>
            <IconButton
              size="small"
              onClick={() => setShowRefDropdown(!showRefDropdown)}
              color={ing.referenced_recipe_id ? 'primary' : 'inherit'}
            >
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

// ── Sortable step row ─────────────────────────────────────────────────────────
function SortableStepRow({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: RecipeFormValues['steps'][number];
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <IconButton size="small" sx={{ cursor: 'grab', color: 'text.disabled', mt: 0.5, touchAction: 'none' }} {...attributes} {...listeners}>
        <DragIndicatorIcon fontSize="small" />
      </IconButton>
      <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'rgba(212,175,55,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1, flexShrink: 0 }}>
        <Typography variant="caption" color="primary.main" fontWeight={700}>{index + 1}</Typography>
      </Box>
      <TextField
        size="small" multiline minRows={1} maxRows={4}
        placeholder="Describe this step…"
        value={step.description}
        onChange={(e) => onChange(e.target.value)}
        sx={{ flex: 1 }}
      />
      <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyIng(defaultUnit = '') {
  return { id: crypto.randomUUID(), name: '', amount: '', unit: defaultUnit, referenced_recipe_id: null };
}

function emptyStep() {
  return { id: crypto.randomUUID(), description: '' };
}

function recipeToPrefill(r: Recipe): Partial<RecipeFormValues> {
  return {
    name: r.name ?? '',
    type: r.type,
    glass_type: r.glass_type ?? '',
    ice_type: r.ice_type ?? '',
    method: r.method ?? '',
    garnish: r.garnish ?? '',
    notes: r.notes ?? '',
    source_credit: r.source_credit ?? '',
    difficulty: r.difficulty ?? '',
    tags: r.tags ?? [],
    is_public: Boolean(r.is_public),
    visibility: r.visibility ?? 'private',
    want_to_make: Boolean(r.want_to_make),
    placeholder_icon: r.placeholder_icon ?? null,
    template_id: r.template_id ?? null,
    source_recipe_id: (r as Recipe & { source_recipe_id?: string | null }).source_recipe_id ?? null,
    servings: r.servings ?? 1,
    ingredients: r.ingredients?.map((i) => ({
      id: crypto.randomUUID(),
      name: i.name,
      amount: i.amount != null ? String(i.amount) : '',
      unit: i.unit ?? '',
      referenced_recipe_id: i.referenced_recipe_id ?? null,
    })) ?? [],
    steps: r.steps?.map((s) => ({ id: crypto.randomUUID(), description: s.description })) ?? [],
  };
}

const COMMON_TAGS = [
  'citrusy', 'herbal', 'boozy', 'bitter', 'sweet', 'smoky', 'spicy', 'tropical',
  'sour', 'refreshing', 'spirit-forward', 'low-ABV', 'brunch', 'holiday',
  'poolside', 'date night', 'winter', 'summer',
];

const PREP_RECIPE_TYPES = ['syrup', 'bitter', 'tincture', 'shrub'] as const;

// ── Main component ────────────────────────────────────────────────────────────
const DEFAULT_VALUES: RecipeFormValues = {
  name: '', type: 'cocktail', glass_type: '', ice_type: '', method: '',
  garnish: '', notes: '', source_credit: '', difficulty: '', tags: [],
  is_public: false, visibility: 'private', want_to_make: true, placeholder_icon: null,
  template_id: null, source_recipe_id: null,
  servings: 1,
  ingredients: [emptyIng()],
  steps: [emptyStep()],
};

export default function RecipeForm() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = Boolean(id);
  const preferredUnit = user?.default_units ?? 'oz';

  const [values, setValues] = useState<RecipeFormValues>(() => ({
    ...DEFAULT_VALUES,
    ingredients: [emptyIng(preferredUnit)],
  }));
  const hideCocktailFields = PREP_RECIPE_TYPES.includes(values.type as (typeof PREP_RECIPE_TYPES)[number]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [textParseDialogOpen, setTextParseDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [allRecipes, setAllRecipes] = useState<Array<{ id: string; name: string; type: string }>>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load existing recipe for edit, or apply prefill (riff / template)
  useEffect(() => {
    const prefill = (location.state as { prefill?: Recipe } | null)?.prefill;

    // Load templates and all recipes for dropdowns
    void Promise.all([
      fetch('/api/templates').then((r) => r.json()),
      fetch('/api/recipes?all=true').then((r) => r.json()),
    ])
      .then(([tplData, recipeData]) => {
        setTemplates(
          (tplData.templates || []).map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          }))
        );
        setAllRecipes(
          (recipeData.recipes || []).map((r: { id: string; name: string; type: string }) => ({
            id: r.id,
            name: r.name,
            type: r.type,
          }))
        );
      })
      .catch((err) => console.error('Failed to load templates/recipes:', err));

    if (isEdit && id) {
      void (async () => {
        const res = await fetch(`/api/recipes/${id}`);
        if (!res.ok) { setError('Recipe not found'); setLoading(false); return; }
        const data = await res.json() as { recipe: Recipe };
        setValues({ ...DEFAULT_VALUES, ...recipeToPrefill(data.recipe) });
        setLoading(false);
      })();
    } else if (prefill) {
      setValues({ ...DEFAULT_VALUES, ...recipeToPrefill(prefill) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof RecipeFormValues>(field: K, value: RecipeFormValues[K]) =>
    setValues((v) => ({ ...v, [field]: value }));

  // Ingredient helpers
  const updateIng = (idx: number, field: string, value: string) =>
    setValues((v) => {
      const ings = [...v.ingredients];
      ings[idx] = { ...ings[idx], [field]: value };
      return { ...v, ingredients: ings };
    });

  const updateIngRef = (idx: number, recipeId: string | null) =>
    setValues((v) => {
      const ings = [...v.ingredients];
      ings[idx] = { ...ings[idx], referenced_recipe_id: recipeId };
      return { ...v, ingredients: ings };
    });

  const removeIng = (idx: number) =>
    setValues((v) => ({ ...v, ingredients: v.ingredients.filter((_, i) => i !== idx) }));

  const addIng = () => setValues((v) => ({ ...v, ingredients: [...v.ingredients, emptyIng(preferredUnit)] }));

  const onIngDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setValues((v) => {
      const oldIdx = v.ingredients.findIndex((i) => i.id === active.id);
      const newIdx = v.ingredients.findIndex((i) => i.id === over.id);
      return { ...v, ingredients: arrayMove(v.ingredients, oldIdx, newIdx) };
    });
  };

  // Step helpers
  const updateStep = (idx: number, value: string) =>
    setValues((v) => {
      const stps = [...v.steps];
      stps[idx] = { ...stps[idx], description: value };
      return { ...v, steps: stps };
    });

  const removeStep = (idx: number) =>
    setValues((v) => ({ ...v, steps: v.steps.filter((_, i) => i !== idx) }));

  const addStep = () => setValues((v) => ({ ...v, steps: [...v.steps, emptyStep()] }));

  const onStepDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setValues((v) => {
      const oldIdx = v.steps.findIndex((s) => s.id === active.id);
      const newIdx = v.steps.findIndex((s) => s.id === over.id);
      return { ...v, steps: arrayMove(v.steps, oldIdx, newIdx) };
    });
  };

  // Apply AI-parsed recipe fields to the form
  const applyParsed = (parsed: ParsedRecipe) => {
    setValues((v) => {
      const newIng = parsed.ingredients.length > 0
        ? parsed.ingredients.map((i) => ({
            id: crypto.randomUUID(),
            name: i.name,
            amount: i.amount,
            unit: i.unit || preferredUnit,
            referenced_recipe_id: null,
          }))
        : v.ingredients;

      const newSteps = parsed.steps.length > 0
        ? parsed.steps.map((s) => ({ id: crypto.randomUUID(), description: s }))
        : v.steps;

      return {
        ...v,
        name: parsed.name ?? v.name,
        glass_type: parsed.glass_type ?? v.glass_type,
        ice_type: parsed.ice_type ?? v.ice_type,
        method: parsed.method ?? v.method,
        garnish: parsed.garnish ?? v.garnish,
        notes: parsed.notes ? (v.notes ? v.notes + '\n\n' + parsed.notes : parsed.notes) : v.notes,
        ingredients: newIng,
        steps: newSteps,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) { setError('Recipe name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const normalizedValues = hideCocktailFields
        ? {
            ...values,
            glass_type: '',
            ice_type: '',
            method: '',
            garnish: '',
            placeholder_icon: null,
            servings: 1,
          }
        : values;

      const body = {
        ...normalizedValues,
        ingredients: normalizedValues.ingredients
          .filter((i) => i.name.trim())
          .map((i) => ({
            name: i.name,
            amount: i.amount !== '' ? parseFloat(i.amount) : null,
            unit: i.unit || null,
            referenced_recipe_id: i.referenced_recipe_id || null,
          })),
        steps: normalizedValues.steps
          .filter((s) => s.description.trim())
          .map((s) => ({ description: s.description })),
      };

      const url = isEdit ? `/api/recipes/${id}` : '/api/recipes';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save');
      }

      const data = await res.json() as { id?: string };
      navigate(`/recipes/${id ?? data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress color="primary" />
    </Box>
  );

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 700, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2, color: 'text.secondary' }}>
        Back
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">
          {isEdit ? 'Edit Recipe' : 'New Recipe'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Scan a recipe image — AI will pre-fill the form">
            <IconButton
              onClick={() => setParseDialogOpen(true)}
              sx={{
                color: 'primary.main',
                bgcolor: 'rgba(212,175,55,0.1)',
                border: '1px solid',
                borderColor: 'rgba(212,175,55,0.3)',
                '&:hover': { bgcolor: 'rgba(212,175,55,0.2)' },
              }}
            >
              <DocumentScannerIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Paste freeform recipe text — AI will pre-fill the form">
            <IconButton
              onClick={() => setTextParseDialogOpen(true)}
              sx={{
                color: 'primary.main',
                bgcolor: 'rgba(212,175,55,0.1)',
                border: '1px solid',
                borderColor: 'rgba(212,175,55,0.3)',
                '&:hover': { bgcolor: 'rgba(212,175,55,0.2)' },
              }}
            >
              <TextSnippetIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <ImageParseDialog
        open={parseDialogOpen}
        onClose={() => setParseDialogOpen(false)}
        onApply={applyParsed}
      />
      <TextParseDialog
        open={textParseDialogOpen}
        onClose={() => setTextParseDialogOpen(false)}
        onApply={applyParsed}
      />

      {values.source_recipe_id && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Creating a riff — your changes are saved as a new independent recipe.
        </Alert>
      )}
      {values.template_id && !values.source_recipe_id && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Starting from a template. Make it yours!
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Core fields ── */}
      <TextField
        fullWidth required label="Recipe name" value={values.name}
        onChange={(e) => set('name', e.target.value)} sx={{ mb: 2 }}
      />

      <TextField
        select label="Template (optional)" value={values.template_id ?? ''} size="small"
        onChange={(e) => set('template_id', e.target.value || null)}
        sx={{ minWidth: 200, mb: 2 }}
        helperText="Link this recipe to a canonical template (e.g., Negroni, Daiquiri)"
      >
        <MenuItem value=""><em>No template</em></MenuItem>
        {templates.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
      </TextField>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField
          select label="Type" value={values.type} size="small"
          onChange={(e) => set('type', e.target.value as RecipeFormValues['type'])}
          sx={{ minWidth: 140 }}
        >
          {RECIPE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
        </TextField>

        {!hideCocktailFields && (
          <TextField
            select label="Glass" value={values.glass_type} size="small"
            onChange={(e) => set('glass_type', e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {GLASS_TYPES.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
          </TextField>
        )}

        {!hideCocktailFields && (
          <TextField
            select label="Ice" value={values.ice_type} size="small"
            onChange={(e) => set('ice_type', e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value=""><em>Not specified</em></MenuItem>
            {ICE_TYPES.map((i) => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
          </TextField>
        )}

        {!hideCocktailFields && (
          <TextField
            select label="Method" value={values.method} size="small"
            onChange={(e) => set('method', e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value=""><em>Not specified</em></MenuItem>
            {METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
        )}

        <TextField
          select label="Difficulty" value={values.difficulty} size="small"
          onChange={(e) => set('difficulty', e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value=""><em>Not specified</em></MenuItem>
          {DIFFICULTIES.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
        </TextField>

        {!hideCocktailFields && (
          <TextField
            label="Servings" type="number" value={values.servings} size="small"
            onChange={(e) => set('servings', Math.max(1, parseInt(e.target.value) || 1))}
            slotProps={{ htmlInput: { min: 1 } }}
            sx={{ width: 120 }}
          />
        )}
      </Box>

      {!hideCocktailFields && (
        <TextField
          fullWidth label="Garnish" value={values.garnish}
          onChange={(e) => set('garnish', e.target.value)} sx={{ mb: 2 }}
        />
      )}

      {/* ── Tags ── */}
      <Autocomplete
        multiple freeSolo
        options={COMMON_TAGS}
        value={values.tags}
        inputValue={tagInput}
        onInputChange={(_, v) => setTagInput(v)}
        onChange={(_, v) => set('tags', v)}
        renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add a tag…" />}
        renderTags={(val, getTagProps) =>
          val.map((tag, index) => (
            <Chip label={tag} {...getTagProps({ index })} key={tag} size="small" color="primary" />
          ))
        }
        sx={{ mb: 2 }}
      />

      {/* ── Credit / Source ── */}
      <TextField
        fullWidth
        label="Credit / Source (optional)"
        placeholder="e.g. Death & Co, Jim Meehan, Cocktail Codex p. 42"
        value={values.source_credit}
        onChange={(e) => {
          const credit = e.target.value;
          set('source_credit', credit);
          // Force private when a credit is set
          if (credit.trim() && values.visibility !== 'private') {
            set('visibility', 'private');
          }
        }}
        helperText="Attribute the recipe to its original creator or source. Credited recipes are always private."
        sx={{ mb: 2 }}
      />

      {/* ── Visibility control ── */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }} disabled={Boolean(values.source_credit.trim())}>
          <InputLabel>Visibility</InputLabel>
          <Select
            value={values.source_credit.trim() ? 'private' : values.visibility}
            onChange={(e) => set('visibility', e.target.value as 'private' | 'friends' | 'public')}
            label="Visibility"
          >
            <MenuItem value="private">Private (just me)</MenuItem>
            <MenuItem value="friends">Friends only</MenuItem>
            <MenuItem value="public">Public (everyone)</MenuItem>
          </Select>
          {values.source_credit.trim() && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Locked to private — credited recipes can't be shared publicly.
            </Typography>
          )}
        </FormControl>

        <TextField
          select
          label="State"
          size="small"
          value={values.want_to_make ? 'want_to_make' : 'made'}
          onChange={(e) => set('want_to_make', e.target.value === 'want_to_make')}
          sx={{ minWidth: 180 }}
          helperText="Tracked per user + recipe copy"
        >
          <MenuItem value="want_to_make">Want to make</MenuItem>
          <MenuItem value="made">Made</MenuItem>
        </TextField>

        {!hideCocktailFields && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              onClick={() => setIconPickerOpen(true)}
              sx={{
                width: 56,
                height: 56,
                borderRadius: 1,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
              }}
            >
              <CocktailSpritePlaceholder
                seed={`${values.name}:${values.type}:${values.glass_type}:${values.garnish}:${values.ice_type}`}
                fallbackEmoji="🍸"
                iconNumber={resolvePlaceholderIcon(values, values.placeholder_icon)}
                height={56}
                width={56}
                withBottomBorder={false}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Placeholder icon
              </Typography>
              <Button size="small" onClick={() => setIconPickerOpen(true)} sx={{ px: 0.5, minWidth: 'auto' }}>
                {values.placeholder_icon == null ? 'Auto' : `Icon ${values.placeholder_icon}`}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={iconPickerOpen && !hideCocktailFields} onClose={() => setIconPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Choose Placeholder Icon</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 1.5 }}>
            <Button
              variant={values.placeholder_icon == null ? 'contained' : 'outlined'}
              size="small"
              onClick={() => set('placeholder_icon', null)}
            >
              Auto (glass + garnish + ice)
            </Button>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(4, 64px)', sm: 'repeat(6, 64px)' },
              justifyContent: 'center',
              gap: 1,
            }}
          >
            {Array.from({ length: ICON_COUNT }, (_, i) => i + 1).map((iconNum) => {
              const selected = values.placeholder_icon === iconNum;
              return (
                <Box
                  key={iconNum}
                  onClick={() => set('placeholder_icon', iconNum)}
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '2px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    cursor: 'pointer',
                  }}
                >
                  <CocktailSpritePlaceholder
                    seed={`picker:${iconNum}`}
                    fallbackEmoji="🍸"
                    iconNumber={iconNum}
                    height={64}
                    width={64}
                    withBottomBorder={false}
                  />
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIconPickerOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Divider sx={{ my: 3 }} />

      {/* ── Ingredients ── */}
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Ingredients</Typography>
        <Tooltip title="Add ingredient">
          <IconButton size="small" color="primary" onClick={addIng}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
        <SortableContext items={values.ingredients.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {values.ingredients.map((ing, idx) => (
            <SortableIngredientRow
              key={ing.id}
              ing={ing}
              onChange={(field, value) => updateIng(idx, field, value)}
              onChangeRef={(recipeId) => updateIngRef(idx, recipeId)}
              onRemove={() => removeIng(idx)}
              allRecipes={allRecipes}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button startIcon={<AddIcon />} size="small" onClick={addIng} sx={{ mt: 0.5, mb: 3 }}>
        Add ingredient
      </Button>

      <Divider sx={{ my: 3 }} />

      {/* ── Steps ── */}
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Method</Typography>
        <Tooltip title="Add step">
          <IconButton size="small" color="primary" onClick={addStep}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
        <SortableContext items={values.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {values.steps.map((step, idx) => (
            <SortableStepRow
              key={step.id}
              step={step}
              index={idx}
              onChange={(value) => updateStep(idx, value)}
              onRemove={() => removeStep(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button startIcon={<AddIcon />} size="small" onClick={addStep} sx={{ mt: 0.5, mb: 3 }}>
        Add step
      </Button>

      <Divider sx={{ my: 3 }} />

      {/* ── Notes ── */}
      <TextField
        fullWidth multiline minRows={3}
        label="Notes (optional)"
        placeholder="Bartender notes, substitution ideas, serving suggestions…"
        value={values.notes}
        onChange={(e) => set('notes', e.target.value)}
        sx={{ mb: 3 }}
      />

      {/* ── Submit ── */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button type="submit" variant="contained" size="large" disabled={saving}>
          {saving ? <CircularProgress size={20} color="inherit" /> : isEdit ? 'Save changes' : 'Create recipe'}
        </Button>
        <Button size="large" onClick={() => navigate(-1)} disabled={saving}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
