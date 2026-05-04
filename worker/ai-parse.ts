import type { Env } from './types';
import { requireAuth, json } from './middleware';

// ── Parsed recipe shape returned to the frontend ──────────────────────────────

export interface ParsedRecipe {
  name: string | null;
  glass_type: string | null;
  ice_type: string | null;
  method: string | null;
  garnish: string | null;
  ingredients: Array<{ amount: string; unit: string; name: string }>;
  steps: string[];
  notes: string | null;
}

export interface ConfidenceReport {
  title: 'high' | 'medium' | 'low';
  ingredients: 'high' | 'medium' | 'low';
  steps: 'high' | 'medium' | 'low';
  warnings: string[];
}

interface ParsedIngredient {
  amount: string;
  unit: string;
  name: string;
}

// Normalise the AI's free-text glass value to our enum values
const GLASS_MAP: Record<string, string> = {
  coupe: 'coupe',
  rocks: 'rocks',
  'old fashioned': 'rocks',
  highball: 'highball',
  martini: 'martini',
  'nick & nora': 'nick_and_nora',
  'nick and nora': 'nick_and_nora',
  mule: 'mule',
  'copper mug': 'mule',
  collins: 'collins',
  pint: 'pint',
  hurricane: 'hurricane',
  flute: 'flute',
  champagne: 'flute',
  tiki: 'tiki',
  shot: 'shot',
  snifter: 'snifter',
  wine: 'wine',
};

const ICE_MAP: Record<string, string> = {
  none: 'none',
  'no ice': 'none',
  cubed: 'cubed',
  cube: 'cubed',
  large: 'large_cube',
  'large cube': 'large_cube',
  'large ice': 'large_cube',
  crushed: 'crushed',
  cracked: 'cracked',
  sphere: 'sphere',
  ball: 'sphere',
};

const METHOD_MAP: Record<string, string> = {
  stirred: 'stirred',
  stir: 'stirred',
  shaken: 'shaken',
  shake: 'shaken',
  built: 'built',
  build: 'built',
  blended: 'blended',
  blend: 'blended',
  thrown: 'thrown',
  throw: 'thrown',
  batch: 'batch',
};

function normaliseGlass(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(GLASS_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function normaliseIce(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(ICE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function normaliseMethod(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(METHOD_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function parseIngredientsFromLines(lines: string[]): ParsedIngredient[] {
  const amountWithUnit = /^\s*(\d+(?:[./]\d+)?)\s*(oz|ml|dash(?:es)?|barspoon(?:s)?|tsp|tbsp|cup(?:s)?)\b\s*(.+)$/i;
  const amountOnly = /^\s*(\d+(?:[./]\d+)?)\s+(.+)$/;

  const toTitleCase = (value: string): string =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const withUnit = line.match(amountWithUnit);
      if (withUnit) {
        return {
          amount: withUnit[1] ?? '',
          unit: (withUnit[2] ?? '').toLowerCase(),
          name: toTitleCase((withUnit[3] ?? '').trim()),
        };
      }

      const withAmountOnly = line.match(amountOnly);
      if (withAmountOnly) {
        return {
          amount: withAmountOnly[1] ?? '',
          unit: '',
          name: toTitleCase((withAmountOnly[2] ?? '').trim()),
        };
      }

      return {
        amount: '',
        unit: '',
        name: toTitleCase(line),
      };
    });
}

function parseExactLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.toUpperCase() !== 'EMPTY')
    .filter((l) => !/^```/.test(l));
}

function isSectionLabel(line: string): boolean {
  return /^(ingredients?|instructions?|directions?|method|steps?|garnish)$/i.test(line.trim());
}

function looksLikeNoise(line: string): boolean {
  const lower = line.toLowerCase();
  if (!lower.trim()) return true;
  if (/^h\s*h\s+an\s+n$/.test(lower.trim())) return true;
  if (/^©|cocktails?|old-fashioned|bourbon\s+cincinnati\s+easy/.test(lower)) return true;
  if (/^ingredients?\s*[-+x]*$/i.test(line)) return true;
  return false;
}

function isLikelyStepLine(line: string): boolean {
  return /^\s*(?:step\s*)?\d+\s*[.):-]?\s*(add|stir|strain|express|tuck|drop|shake|build|combine|muddle|garnish|serve)\b/i.test(line);
}

function isLikelyIngredientLine(line: string): boolean {
  if (/\(garnish\)/i.test(line)) return true;
  if (/^\s*\d+(?:[./]\d+)?\s*(oz|ml|dash(?:es)?|barspoon(?:s)?|tsp|tbsp|cup(?:s)?|fresh)\b/i.test(line)) return true;
  return false;
}

function splitMixedLine(line: string): { ingredientPart: string | null; stepPart: string | null } {
  // Handles OCR lines like: "3 dashes orange bitters 5 Tuck the orange peel..."
  const marker = line.match(/\s(\d{1,2})\s*(?:[.):-])?\s*(Add|Stir|Strain|Express|Tuck|Drop|Shake|Build|Combine|Muddle|Garnish|Serve)\b/i);
  if (!marker || marker.index === undefined) return { ingredientPart: line.trim(), stepPart: null };

  const splitIndex = marker.index + 1;
  const before = line.slice(0, splitIndex).trim();
  const after = line.slice(splitIndex).trim();
  return {
    ingredientPart: before.length > 0 ? before : null,
    stepPart: after.length > 0 ? after : null,
  };
}

function dedupeLines(lines: string[], max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
    if (out.length >= max) break;
  }
  return out;
}

function classifyOcrLines(lines: string[]): { ingredients: string[]; steps: string[] } {
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || looksLikeNoise(line) || isSectionLabel(line)) continue;

    if (isLikelyStepLine(line)) {
      stepLines.push(line);
      continue;
    }

    const mixed = splitMixedLine(line);
    if (mixed.stepPart && isLikelyStepLine(mixed.stepPart)) {
      if (mixed.ingredientPart && isLikelyIngredientLine(mixed.ingredientPart)) {
        ingredientLines.push(mixed.ingredientPart);
      }
      stepLines.push(mixed.stepPart);
      continue;
    }

    if (isLikelyIngredientLine(line)) {
      ingredientLines.push(line);
    }
  }

  return {
    ingredients: dedupeLines(ingredientLines, 20),
    steps: dedupeLines(stepLines, 12),
  };
}

function normalizeStepText(stepLine: string): string {
  return stepLine
    .replace(/^\s*(?:step\s*)?\d+\s*[.):-]\s*/i, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPathologicalRepetition(stepLines: string[]): boolean {
  if (stepLines.length < 8) return false;
  const counts = new Map<string, number>();
  for (const line of stepLines) {
    const k = normalizeStepText(line);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const uniqueRatio = counts.size / stepLines.length;
  const maxRepeat = Math.max(...Array.from(counts.values()));
  return uniqueRatio < 0.5 || maxRepeat >= 4;
}

function dedupeAndCapSteps(stepLines: string[], maxSteps = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of stepLines) {
    const key = normalizeStepText(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.replace(/^\s*(?:step\s*)?\d+\s*[.):-]?\s*/i, '').trim());
    if (out.length >= maxSteps) break;
  }
  return out;
}

function chooseName(fullOcrLines: string[], titleLines: string[]): string | null {
  const fromFull = extractNameFromFullOcr(fullOcrLines);
  const candidate = (fromFull ?? titleLines[0] ?? '').trim();
  if (!candidate) return null;
  if (candidate.length > 140) return titleLines[0]?.trim() || null;
  // reject obvious repetition loops
  const words = candidate.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 20) {
    const tail = words.slice(-12).join(' ');
    const occurrences = candidate.toLowerCase().split(tail).length - 1;
    if (occurrences > 2) return titleLines[0]?.trim() || null;
  }
  return candidate;
}

function extractNameFromFullOcr(lines: string[]): string | null {
  for (const line of lines) {
    if (/^(ingredients?|instructions?|directions?|method|steps?)\b/i.test(line)) continue;
    if (/^\s*(?:step\s*)?\d+\s*[.):-]/i.test(line)) continue;
    if (line.length > 1) return line;
  }
  return null;
}

// ── Google Cloud Vision OCR ───────────────────────────────────────────────────
// Handles both printed text and handwriting via DOCUMENT_TEXT_DETECTION.
// Free tier: 1,000 units/month. Key from Google Cloud Console → Vision API.

async function ocrWithGoogleVision(base64Image: string, apiKey: string): Promise<string> {
  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  };

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google Vision API ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json() as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      textAnnotations?: Array<{ description?: string }>;
      error?: { message?: string; code?: number };
    }>;
  };

  const response = data.responses?.[0];
  if (response?.error) {
    throw new Error(`Google Vision API error: ${response.error.message}`);
  }

  // fullTextAnnotation preserves paragraph/line structure better than textAnnotations[0]
  return (
    response?.fullTextAnnotation?.text ??
    response?.textAnnotations?.[0]?.description ??
    ''
  );
}

// ── Cloudflare Workers AI structured parser ───────────────────────────────────
// Text-only step: takes raw OCR text, returns structured JSON.
// Uses a capable instruction-following model — no vision quota consumed here.

const PARSE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function structuredParseWithAI(ocrText: string, env: Env): Promise<ParsedRecipe | null> {
  if (!env.AI) return null;

  const systemPrompt = `You are a cocktail recipe parser. Parse OCR text from a recipe image and return ONLY a raw JSON object — no markdown, no explanation, no code fences.

Required fields:
- name: the cocktail/recipe name (string or null)
- glass_type: one of: coupe, rocks, highball, martini, nick_and_nora, mule, collins, pint, hurricane, flute, tiki, shot, snifter, wine — or null
- ice_type: one of: none, cubed, large_cube, crushed, cracked, sphere — or null
- method: one of: stirred, shaken, built, blended, thrown, batch — or null
- garnish: garnish description (string or null)
- ingredients: array of { "amount": string, "unit": string, "name": string }
  - amount: numeric value as string ("1.5", "3/4", "2") or "" if not given
  - unit: one of oz, ml, dash, barspoon, tsp, tbsp, cup — or "" if none
  - name: ingredient name in Title Case
- steps: array of instruction strings (plain sentences, strip any leading step numbers)
- notes: any additional tips or notes (string or null)

Rules:
- Extract ONLY what is present in the OCR text — never invent ingredients or steps
- Return null for unknown fields, [] for empty arrays
- Output valid JSON only`;

  const userPrompt = `Parse this recipe OCR text:\n---\n${ocrText.slice(0, 3000)}\n---`;

  try {
    // Cast because CF AI types don't enumerate all available models
    const result = await (env.AI as unknown as {
      run: (model: string, opts: object) => Promise<{ response?: string }>;
    }).run(PARSE_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
    });

    const text = result?.response ?? '';
    // Strip markdown code fences if the model wraps its output
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return validateAndSanitize(parsed);
  } catch (err) {
    console.error('Workers AI structured parse error:', err);
    return null;
  }
}

async function structuredParseFreeformTextWithAI(
  freeformText: string,
  env: Env
): Promise<ParsedRecipe | null> {
  if (!env.AI) return null;

  const systemPrompt = `You are a cocktail recipe parser for freeform prose text (notes, paragraphs, copy/paste blocks).
Return ONLY a raw JSON object — no markdown, no explanation, no code fences.

Required fields:
- name: cocktail name (string or null)
- glass_type: one of coupe, rocks, highball, martini, nick_and_nora, mule, collins, pint, hurricane, flute, tiki, shot, snifter, wine — or null
- ice_type: one of none, cubed, large_cube, crushed, cracked, sphere — or null
- method: one of stirred, shaken, built, blended, thrown, batch — or null
- garnish: garnish description (string or null)
- ingredients: array of { "amount": string, "unit": string, "name": string }
  - amount should be normalized to numeric text when possible:
    - "half" => "1/2"
    - "quarter" => "1/4"
    - "one and a half" => "1.5"
    - "four" => "4"
  - unit: one of oz, ml, dash, barspoon, tsp, tbsp, cup — or "" if none
  - name: ingredient name in Title Case
- steps: array of instruction strings as concise imperative steps
- notes: optional extra notes or serving remarks (string or null)

Rules:
- Parse freeform narrative language, not OCR lines
- Extract ONLY what exists in the text (no invention)
- If confidence is uncertain, prefer null/empty instead of guessing
- Return valid JSON only`;

  const userPrompt = `Parse this freeform recipe text:\n---\n${freeformText.slice(0, 4000)}\n---`;

  try {
    const result = await (env.AI as unknown as {
      run: (model: string, opts: object) => Promise<{ response?: string }>;
    }).run(PARSE_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
    });

    const text = result?.response ?? '';
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return validateAndSanitize(parsed);
  } catch (err) {
    console.error('Workers AI freeform parse error:', err);
    return null;
  }
}

function normaliseAmountWord(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[-,]/g, ' ').replace(/\s+/g, ' ').trim();

  if (/^(a|an)$/.test(cleaned)) return '1';
  if (/^(half|a half|one half)$/.test(cleaned)) return '1/2';
  if (/^(quarter|a quarter|one quarter)$/.test(cleaned)) return '1/4';
  if (/^(three quarters|three quarter)$/.test(cleaned)) return '3/4';
  if (/^(one and a half|one and half)$/.test(cleaned)) return '1.5';
  if (/^(two and a half|two and half)$/.test(cleaned)) return '2.5';

  const wordNums: Record<string, string> = {
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  };
  if (wordNums[cleaned]) return wordNums[cleaned];

  if (/^\d+(?:\.\d+)?$/.test(cleaned) || /^\d+\/\d+$/.test(cleaned)) return cleaned;
  return raw.trim();
}

function normaliseUnit(raw: string): string {
  const u = raw.toLowerCase().trim();
  if (u.startsWith('oz') || u.startsWith('ounce')) return 'oz';
  if (u === 'ml') return 'ml';
  if (u.startsWith('dash')) return 'dash';
  if (u.startsWith('barspoon')) return 'barspoon';
  if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') return 'tsp';
  if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') return 'tbsp';
  if (u === 'cup' || u === 'cups') return 'cup';
  return '';
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function heuristicParseFreeformText(text: string): ParsedRecipe {
  const normalizedText = text
    .replace(/\ba\s+half\s*,\s*an?\s+ounce\b/gi, 'half ounce')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = normalizedText.toLowerCase();

  let name: string | null = null;
  const namedMatch = lower.match(/\b(?:recipe\s+is\s+for|make|making|for)\s+an?\s+([a-z][a-z\s'&-]{2,40})\b/i);
  if (namedMatch?.[1]) {
    name = titleCaseWords(namedMatch[1].replace(/\bin\s+a\s+[a-z\s]+$/i, '').trim());
  }

  const ingredientPattern = /(\b(?:\d+(?:\.\d+)?|\d+\/\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|one\s+and\s+a\s+half|two\s+and\s+a\s+half|three\s+quarters?)\b)\s*(oz|ounce|ounces|ml|dash|dashes|barspoon|barspoons|tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons|cup|cups)\s*(?:of\s+)?([a-z][a-z0-9'\-\s]{1,80}?)(?=,|\.|\band\s+(?:\d|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\b|$)/gi;

  const ingredients: ParsedRecipe['ingredients'] = [];
  for (const m of normalizedText.matchAll(ingredientPattern)) {
    const amountRaw = m[1] ?? '';
    const unitRaw = m[2] ?? '';
    let nameRaw = (m[3] ?? '').trim();
    nameRaw = nameRaw.replace(/\bthen\b.*$/i, '').replace(/\badd\b.*$/i, '').trim();
    if (!nameRaw) continue;

    ingredients.push({
      amount: normaliseAmountWord(amountRaw),
      unit: normaliseUnit(unitRaw),
      name: titleCaseWords(nameRaw),
    });
  }

  const sentenceSteps = normalizedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /\b(add|stir|shake|strain|express|muddle|build|combine|garnish|serve|enjoy)\b/i.test(s));

  const steps = dedupeLines(sentenceSteps.map((s) => s.replace(/\s+/g, ' ')), 10);

  let garnish: string | null = null;
  const garnishMatch = normalizedText.match(/\bexpress\s+(?:an?\s+|the\s+)?([a-z\s]+?)\s+peel\b/i);
  if (garnishMatch?.[1]) {
    garnish = `${titleCaseWords(garnishMatch[1].trim())} peel`;
  }

  return {
    name,
    glass_type: normaliseGlass(normalizedText),
    ice_type: normaliseIce(normalizedText),
    method: normaliseMethod(normalizedText),
    garnish,
    ingredients,
    steps,
    notes: null,
  };
}

async function runTextParsePipeline(text: string, env: Env): Promise<{
  cleanedResult: ParsedRecipe;
  confidence: ConfidenceReport;
  failedExtraction: boolean;
  parseMethod: string;
  linePreview: string[];
  heuristicResult: ParsedRecipe;
  aiModelParse: ParsedRecipe | null;
  matchedIngredients: Array<{
    amount: string;
    unit: string;
    name: string;
    dbMatched?: boolean;
    originalName?: string;
    matchedName?: string;
  }>;
}> {
  const linePreview = parseExactLines(text);
  const heuristicResult = heuristicParseFreeformText(text);

  let aiModelParse: ParsedRecipe | null = null;
  if (env.AI) {
    aiModelParse = await structuredParseFreeformTextWithAI(text, env);
  }

  const aiHasIngredients = (aiModelParse?.ingredients.length ?? 0) > 0;
  const aiHasSteps = (aiModelParse?.steps.length ?? 0) > 0;
  const finalResult: ParsedRecipe =
    aiModelParse && (aiHasIngredients || aiHasSteps || aiModelParse.name)
      ? aiModelParse
      : heuristicResult;

  const parseMethod =
    aiModelParse && (aiHasIngredients || aiHasSteps || aiModelParse.name)
      ? `${PARSE_MODEL}-freeform`
      : 'freeform-heuristic';

  const matchedIngredients = await Promise.all(
    finalResult.ingredients.map(async (ing) => {
      if (!ing.name) return ing;
      try {
        const row = await env.dramscript_db
          .prepare(
            `SELECT name FROM ingredient_reference
             WHERE lower(name) = lower(?1)
                OR lower(name) LIKE lower(?2)
             LIMIT 1`
          )
          .bind(ing.name, `%${ing.name}%`)
          .first<{ name: string }>();
        return row
          ? { ...ing, dbMatched: true, originalName: ing.name, matchedName: row.name }
          : { ...ing, dbMatched: false, originalName: ing.name };
      } catch {
        return { ...ing, dbMatched: false, originalName: ing.name };
      }
    })
  );

  const cleanedResult: ParsedRecipe = {
    ...finalResult,
    ingredients: matchedIngredients
      .filter((ing) => ing.name.length > 0)
      .map((ing) => ({ amount: ing.amount, unit: ing.unit, name: ing.name })),
  };

  const confidence = scoreConfidence(cleanedResult, text.trim().length, 'text');
  const failedExtraction = cleanedResult.ingredients.length === 0 && cleanedResult.steps.length === 0;

  return {
    cleanedResult,
    confidence,
    failedExtraction,
    parseMethod,
    linePreview,
    heuristicResult,
    aiModelParse,
    matchedIngredients,
  };
}

// ── Schema validation + normalization ─────────────────────────────────────────

function validateAndSanitize(raw: unknown): ParsedRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const ingredients: Array<{ amount: string; unit: string; name: string }> = [];
  if (Array.isArray(r.ingredients)) {
    for (const ing of r.ingredients) {
      if (!ing || typeof ing !== 'object') continue;
      const i = ing as Record<string, unknown>;
      const name = typeof i.name === 'string' ? i.name.trim() : '';
      if (!name) continue;
      ingredients.push({
        amount: typeof i.amount === 'string' ? i.amount.trim() : String(i.amount ?? '').trim(),
        unit: typeof i.unit === 'string' ? i.unit.trim().toLowerCase() : '',
        name,
      });
    }
  }

  const steps: string[] = [];
  if (Array.isArray(r.steps)) {
    for (const s of r.steps) {
      if (typeof s === 'string' && s.trim()) {
        steps.push(s.trim().replace(/^\s*(?:step\s*)?\d+\s*[.):-]\s*/i, '').trim());
      }
    }
  }

  const rawName = typeof r.name === 'string' ? r.name.trim() : null;
  const name =
    rawName && rawName.length > 0 && rawName.toUpperCase() !== 'EMPTY' && rawName.toUpperCase() !== 'NULL'
      ? rawName
      : null;

  return {
    name,
    glass_type: normaliseGlass(typeof r.glass_type === 'string' ? r.glass_type : null),
    ice_type: normaliseIce(typeof r.ice_type === 'string' ? r.ice_type : null),
    method: normaliseMethod(typeof r.method === 'string' ? r.method : null),
    garnish:
      typeof r.garnish === 'string' && r.garnish.trim() && r.garnish.toUpperCase() !== 'NULL'
        ? r.garnish.trim()
        : null,
    ingredients,
    steps,
    notes:
      typeof r.notes === 'string' && r.notes.trim() && r.notes.toUpperCase() !== 'NULL'
        ? r.notes.trim()
        : null,
  };
}

// ── Confidence scoring ─────────────────────────────────────────────────────────

function scoreConfidence(
  parsed: ParsedRecipe,
  inputTextLength: number,
  source: 'image' | 'text' = 'image'
): ConfidenceReport {
  const warnings: string[] = [];

  let title: 'high' | 'medium' | 'low';
  if (!parsed.name) {
    title = 'low';
    warnings.push('Recipe name could not be extracted — add it manually.');
  } else if (parsed.name.length > 120 || /^\d/.test(parsed.name)) {
    title = 'medium';
    warnings.push('Recipe name may include extra text — review before saving.');
  } else {
    title = 'high';
  }

  let ingredients: 'high' | 'medium' | 'low';
  const ingCount = parsed.ingredients.length;
  const withAmount = parsed.ingredients.filter((i) => i.amount && i.amount !== '').length;
  if (ingCount === 0) {
    ingredients = 'low';
    warnings.push(
      source === 'image'
        ? (inputTextLength < 30
            ? 'Image may be too blurry or low-resolution — try a sharper photo.'
            : 'No ingredients found — try a clearer photo of the ingredients section.')
        : 'No ingredients found — include amounts and ingredient names in the text.'
    );
  } else if (ingCount < 2 || withAmount < ingCount * 0.5) {
    ingredients = 'medium';
    if (ingCount < 2) warnings.push(`Only ${ingCount} ingredient(s) found — there may be more.`);
    if (withAmount < ingCount * 0.5)
      warnings.push('Some ingredient amounts could not be read — review before saving.');
  } else {
    ingredients = 'high';
  }

  let steps: 'high' | 'medium' | 'low';
  const stepCount = parsed.steps.length;
  if (stepCount === 0) {
    steps = 'low';
    if (inputTextLength > 50) {
      warnings.push(
        source === 'image'
          ? 'No steps extracted — the method may be handwritten or unlabeled. Add steps manually.'
          : 'No steps extracted — include preparation directions in sentence form.'
      );
    }
  } else if (stepCount === 1) {
    steps = 'medium';
    warnings.push(
      source === 'image'
        ? 'Only 1 step extracted — there may be more in the image.'
        : 'Only 1 step extracted — there may be more in the text.'
    );
  } else {
    steps = 'high';
  }

  return { title, ingredients, steps, warnings };
}

async function runParsePipeline(ocrText: string, env: Env): Promise<{
  cleanedResult: ParsedRecipe;
  confidence: ConfidenceReport;
  failedExtraction: boolean;
  parseMethod: string;
  ocrLines: string[];
  deterministicResult: ParsedRecipe;
  aiModelParse: ParsedRecipe | null;
  matchedIngredients: Array<{
    amount: string;
    unit: string;
    name: string;
    dbMatched?: boolean;
    originalName?: string;
    matchedName?: string;
  }>;
}> {
  const ocrLines = parseExactLines(ocrText);
  const deterministicResult = deterministicParseFromLines(ocrLines, ocrText);

  let aiModelParse: ParsedRecipe | null = null;
  if (env.AI) {
    aiModelParse = await structuredParseWithAI(ocrText, env);
  }

  const aiHasIngredients = (aiModelParse?.ingredients.length ?? 0) > 0;
  const aiHasSteps = (aiModelParse?.steps.length ?? 0) > 0;
  const finalResult: ParsedRecipe =
    aiModelParse && (aiHasIngredients || aiHasSteps || aiModelParse.name)
      ? aiModelParse
      : deterministicResult;

  const parseMethod =
    aiModelParse && (aiHasIngredients || aiHasSteps || aiModelParse.name)
      ? PARSE_MODEL
      : 'deterministic-classifier';

  const matchedIngredients = await Promise.all(
    finalResult.ingredients.map(async (ing) => {
      if (!ing.name) return ing;
      try {
        const row = await env.dramscript_db
          .prepare(
            `SELECT name FROM ingredient_reference
             WHERE lower(name) = lower(?1)
                OR lower(name) LIKE lower(?2)
             LIMIT 1`
          )
          .bind(ing.name, `%${ing.name}%`)
          .first<{ name: string }>();
        return row
          ? { ...ing, dbMatched: true, originalName: ing.name, matchedName: row.name }
          : { ...ing, dbMatched: false, originalName: ing.name };
      } catch {
        return { ...ing, dbMatched: false, originalName: ing.name };
      }
    })
  );

  const cleanedResult: ParsedRecipe = {
    ...finalResult,
    ingredients: matchedIngredients
      .filter((ing) => ing.name.length > 0)
      .map((ing) => ({ amount: ing.amount, unit: ing.unit, name: ing.name })),
  };

  const confidence = scoreConfidence(cleanedResult, ocrText.trim().length);
  const failedExtraction = cleanedResult.ingredients.length === 0 && cleanedResult.steps.length === 0;

  return {
    cleanedResult,
    confidence,
    failedExtraction,
    parseMethod,
    ocrLines,
    deterministicResult,
    aiModelParse,
    matchedIngredients,
  };
}

export async function parseRecipeFromText(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  let inputText = '';
  let diagnosticsRequested = true;
  try {
    const body = (await request.json()) as {
      text?: string;
      diagnostics?: boolean | string;
    };
    inputText = typeof body.text === 'string' ? body.text.trim() : '';
    if (body.diagnostics === false || body.diagnostics === 'false') diagnosticsRequested = false;
    if (body.diagnostics === true || body.diagnostics === 'true') diagnosticsRequested = true;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!inputText) {
    return json({ error: 'Missing text field' }, 400);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('diagnostics') === '1' || url.searchParams.get('debug') === '1')
    diagnosticsRequested = true;
  if (url.searchParams.get('diagnostics') === '0' || url.searchParams.get('debug') === '0')
    diagnosticsRequested = false;

  try {
    const pipeline = await runTextParsePipeline(inputText, env);

    if (diagnosticsRequested) {
      return json({
        parsed: pipeline.cleanedResult,
        confidence: pipeline.confidence,
        extractionStatus: pipeline.failedExtraction ? 'empty-extraction' : 'ok',
        diagnostics: {
          source: 'freeform-text',
          parseMethod: pipeline.parseMethod,
          text: inputText.slice(0, 3000),
          lines: pipeline.linePreview.slice(0, 200),
          comparison: {
            heuristicParse: pipeline.heuristicResult,
            aiModelParse: pipeline.aiModelParse,
          },
          matchedIngredients: pipeline.matchedIngredients,
        },
      });
    }

    if (pipeline.failedExtraction) {
      return json({
        error: 'Could not extract ingredients or steps from this text. Add more detail and try again.',
        parsed: pipeline.cleanedResult,
        confidence: pipeline.confidence,
      });
    }

    return json({ parsed: pipeline.cleanedResult, confidence: pipeline.confidence });
  } catch (err) {
    console.error('AI text parse error:', err);
    return json({ error: 'AI processing failed. Please try again.' }, 500);
  }
}

// ── The endpoint ──────────────────────────────────────────────────────────────

export async function parseRecipeFromImage(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  let imageBase64 = '';
  let clientOcrText = '';
  let clientOcrConfidence: number | null = null;
  let diagnosticsRequested = true;
  try {
    const body = (await request.json()) as {
      image?: string;
      ocrText?: string;
      ocrConfidence?: number;
      diagnostics?: boolean | string;
    };
    if (!body.image) return json({ error: 'Missing image field' }, 400);
    imageBase64 = body.image;
    clientOcrText = typeof body.ocrText === 'string' ? body.ocrText.trim() : '';
    clientOcrConfidence = typeof body.ocrConfidence === 'number' ? body.ocrConfidence : null;
    if (body.diagnostics === false || body.diagnostics === 'false') diagnosticsRequested = false;
    if (body.diagnostics === true || body.diagnostics === 'true') diagnosticsRequested = true;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('diagnostics') === '1' || url.searchParams.get('debug') === '1')
    diagnosticsRequested = true;
  if (url.searchParams.get('diagnostics') === '0' || url.searchParams.get('debug') === '0')
    diagnosticsRequested = false;

  // Strip data URL prefix to get raw base64
  const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
  if (!rawBase64) return json({ error: 'Invalid base64 image data' }, 400);

  try {
    const confidenceToScore = (conf: ConfidenceReport): number => {
      const weight: Record<ConfidenceReport['title'], number> = {
        low: 0,
        medium: 1,
        high: 2,
      };
      return weight[conf.title] + weight[conf.ingredients] + weight[conf.steps];
    };

    let ocrText = clientOcrText;
    let ocrSource = clientOcrText ? 'tesseract-client' : 'google-cloud-vision';
    let fallbackTriggered = false;
    let fallbackReason: string | null = null;
    let fallbackAttempted = false;
    let fallbackOutcome: 'not-needed' | 'vision-error' | 'vision-empty' | 'vision-selected' | 'kept-client' = 'not-needed';
    let fallbackError: string | null = null;

    if (!ocrText) {
      if (!env.GOOGLE_VISION_API_KEY) {
        return json({
          error: 'OCR is not configured. Set GOOGLE_VISION_API_KEY or send client OCR text.',
          parsed: null,
          confidence: null,
        }, 503);
      }
      try {
        ocrText = await ocrWithGoogleVision(rawBase64, env.GOOGLE_VISION_API_KEY);
        console.log('Google Vision OCR preview:', JSON.stringify(ocrText.slice(0, 600)));
      } catch (err) {
        console.error('Google Vision OCR failed:', err);
        return json({ error: 'OCR service error. Please try again.' }, 502);
      }
    }

    if (!ocrText.trim()) {
      return json({ error: 'Could not read any text from the image. Try a clearer photo.', parsed: null, confidence: null });
    }

    let pipeline = await runParsePipeline(ocrText, env);

    const clientText = clientOcrText.trim();
    const clientAlphaChars = (clientText.match(/[A-Za-z]/g) ?? []).length;
    const clientAlphaRatio = clientText.length > 0 ? clientAlphaChars / clientText.length : 0;
    const clientLineCount = parseExactLines(clientText).length;
    const parseDensity = pipeline.cleanedResult.ingredients.length + pipeline.cleanedResult.steps.length;

    const shouldFallbackForLowConfidence =
      clientOcrText.length > 0 && clientOcrConfidence !== null && clientOcrConfidence < 70;
    const shouldFallbackForSparseText = clientOcrText.length > 0 && clientText.length < 80;
    const shouldFallbackForLowAlphaRatio = clientOcrText.length > 0 && clientAlphaRatio < 0.5;
    const shouldFallbackForFewLines = clientOcrText.length > 0 && clientLineCount < 3;
    const shouldFallbackForWeakExtraction =
      clientOcrText.length > 0 &&
      (pipeline.failedExtraction ||
        pipeline.confidence.ingredients === 'low' ||
        pipeline.confidence.steps === 'low' ||
        parseDensity <= 2);

    const weakClientParse =
      shouldFallbackForLowConfidence ||
      shouldFallbackForSparseText ||
      shouldFallbackForLowAlphaRatio ||
      shouldFallbackForFewLines ||
      shouldFallbackForWeakExtraction;

    if (shouldFallbackForLowConfidence) fallbackReason = 'low-tesseract-confidence';
    else if (shouldFallbackForSparseText) fallbackReason = 'sparse-client-ocr-text';
    else if (shouldFallbackForLowAlphaRatio) fallbackReason = 'low-alpha-ratio-client-ocr';
    else if (shouldFallbackForFewLines) fallbackReason = 'too-few-client-ocr-lines';
    else if (shouldFallbackForWeakExtraction) fallbackReason = 'weak-parse-from-client-ocr';

    if (weakClientParse && env.GOOGLE_VISION_API_KEY) {
      fallbackAttempted = true;
      try {
        const visionText = await ocrWithGoogleVision(rawBase64, env.GOOGLE_VISION_API_KEY);
        if (visionText.trim()) {
          const visionPipeline = await runParsePipeline(visionText, env);
          const currentRecipeDensity =
            pipeline.cleanedResult.ingredients.length + pipeline.cleanedResult.steps.length;
          const visionRecipeDensity =
            visionPipeline.cleanedResult.ingredients.length + visionPipeline.cleanedResult.steps.length;

          const currentConfidenceScore = confidenceToScore(pipeline.confidence);
          const visionConfidenceScore = confidenceToScore(visionPipeline.confidence);
          const visionTextStronger = visionText.trim().length > clientText.length * 1.25;
          const visionParseMeaningfullyBetter =
            (pipeline.failedExtraction && !visionPipeline.failedExtraction) ||
            visionRecipeDensity > currentRecipeDensity ||
            visionConfidenceScore > currentConfidenceScore ||
            (currentRecipeDensity <= 2 && visionRecipeDensity >= 3) ||
            (pipeline.confidence.steps === 'low' && visionPipeline.confidence.steps !== 'low') ||
            (pipeline.confidence.ingredients === 'low' && visionPipeline.confidence.ingredients !== 'low') ||
            visionTextStronger;

          const preferVisionBecauseVeryLowClientConfidence =
            shouldFallbackForLowConfidence &&
            clientOcrConfidence !== null &&
            clientOcrConfidence < 55 &&
            !visionPipeline.failedExtraction;

          if (
            visionParseMeaningfullyBetter || preferVisionBecauseVeryLowClientConfidence
          ) {
            pipeline = visionPipeline;
            ocrText = visionText;
            ocrSource = 'google-cloud-vision-fallback';
            fallbackTriggered = true;
            fallbackOutcome = 'vision-selected';
          } else {
            fallbackOutcome = 'kept-client';
          }
        } else {
          fallbackOutcome = 'vision-empty';
        }
      } catch (err) {
        console.error('Google Vision fallback OCR failed:', err);
        fallbackOutcome = 'vision-error';
        fallbackError = err instanceof Error ? err.message : String(err);
      }
    }

    console.log('Parse complete:', JSON.stringify({
      ocrSource,
      parseMethod: pipeline.parseMethod,
      fallbackTriggered,
      fallbackReason,
      fallbackAttempted,
      fallbackOutcome,
      name: pipeline.cleanedResult.name,
      ingredientCount: pipeline.cleanedResult.ingredients.length,
      stepCount: pipeline.cleanedResult.steps.length,
      confidence: {
        title: pipeline.confidence.title,
        ingredients: pipeline.confidence.ingredients,
        steps: pipeline.confidence.steps,
      },
    }));

    if (diagnosticsRequested) {
      return json({
        parsed: pipeline.cleanedResult,
        confidence: pipeline.confidence,
        extractionStatus: pipeline.failedExtraction ? 'empty-extraction' : 'ok',
        diagnostics: {
          ocrSource,
          fallbackTriggered,
          fallbackReason,
          fallbackAttempted,
          fallbackOutcome,
          fallbackError,
          clientOcrConfidence,
          clientAlphaRatio: Number(clientAlphaRatio.toFixed(3)),
          clientLineCount,
          parseMethod: pipeline.parseMethod,
          ocrText: ocrText.slice(0, 3000),
          ocrLines: pipeline.ocrLines.slice(0, 200),
          comparison: {
            deterministicParse: pipeline.deterministicResult,
            aiModelParse: pipeline.aiModelParse,
          },
          matchedIngredients: pipeline.matchedIngredients,
        },
      });
    }

    if (pipeline.failedExtraction) {
      return json({
        error: 'Could not extract ingredients or steps from this image. Try a clearer photo.',
        parsed: pipeline.cleanedResult,
        confidence: pipeline.confidence,
      });
    }

    return json({ parsed: pipeline.cleanedResult, confidence: pipeline.confidence });
  } catch (err) {
    console.error('AI parse error:', err);
    return json({ error: 'AI processing failed. Please try again.' }, 500);
  }
}

// ── Deterministic OCR-only classifier (fallback + comparison) ─────────────────
// Used as the comparison baseline in diagnostics and as the fallback
// when the AI structured parse returns empty.

function deterministicParseFromLines(ocrLines: string[], fullOcrText: string): ParsedRecipe {
  const titleLines = ocrLines.filter(
    (l) =>
      !/^(ingredients?|instructions?|directions?|method|steps?)\b/i.test(l) &&
      !/^\s*(?:step\s*)?\d+\s*[.):-]/i.test(l) &&
      l.length > 1
  );

  const classified = classifyOcrLines(ocrLines);

  const filteredIngredientLines = dedupeLines(classified.ingredients, 20)
    .filter((line) => !/^garnish$/i.test(line.trim()))
    .slice(0, 20);

  const primaryStepsDeduped = dedupeAndCapSteps(classified.steps, 12);
  const primaryIsUsable =
    primaryStepsDeduped.length > 0 && !hasPathologicalRepetition(classified.steps);
  const cleanedStepLines = primaryIsUsable ? primaryStepsDeduped : [];

  return {
    name: chooseName(ocrLines, titleLines),
    glass_type: normaliseGlass(fullOcrText),
    ice_type: normaliseIce(fullOcrText),
    method: normaliseMethod(fullOcrText),
    garnish: null,
    ingredients: parseIngredientsFromLines(filteredIngredientLines).filter(
      (ing) => ing.name.length > 0
    ),
    steps: cleanedStepLines,
    notes: null,
  };
}
