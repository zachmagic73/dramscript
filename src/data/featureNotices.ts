export interface FeatureNotice {
  id: string;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

// Add a new entry here whenever you want to announce a feature.
// Keep the id stable and unique so dismissals persist correctly.
export const featureNotices: FeatureNotice[] = [
  {
    id: '2026-05-freeform-recipes',
    title: 'New: Paste freeform recipe text',
    message: 'Paste any recipe as a block of text — no structured format needed. Dramscript AI parses the text and pre-fills the form. Tip: use your phone\'s speech-to-text feature to dictate recipes hands-free.',
    ctaLabel: 'Add a new recipe',
    ctaHref: '/recipes/new',
  },
  {
    id: '2026-05-slushie-calc',
    title: 'New: Slushie calculator',
    message: 'Scale frozen cocktails at any batch size with automatic dilution and carbonation management. Keep texture and flavor balanced whether you\'re making one drink or 50.',
    ctaLabel: 'Open Calculators',
    ctaHref: '/calculators',
  },
  {
    id: '2026-05-recipe-scanning',
    title: 'New: Recipe scanning',
    message: 'Use Scan a Recipe to upload or snap a photo of a recipe card, cookbook page, or handwritten notes. Dramscript extracts ingredients and steps, then pre-fills the recipe form for quick edits before saving.',
    ctaLabel: 'Scan a Recipe',
    ctaHref: '/recipes/new',
  },
  {
    id: '2026-04-discover-social-search',
    title: 'New: Discover community recipes',
    message: 'Use Discover to browse public cocktail recipes from other users, with search and filters for type and difficulty.',
    ctaLabel: 'Open Discover',
    ctaHref: '/discover',
  },
  {
    id: '2026-04-friends-invites',
    title: 'New: Friends and invites',
    message: 'Find users, send invites, review pending requests, and keep track of invites you have already sent.',
    ctaLabel: 'Open Friends',
    ctaHref: '/friends',
  },
  {
    id: '2026-04-feature-notifications',
    title: 'New feature notifications',
    message: 'Dramscript can now surface product updates in-app. Dismiss a notice once and it stays gone on this device.',
    ctaLabel: 'View profile',
    ctaHref: '/profile',
  },
  {
    id: '2026-04-my-bar',
    title: 'New: My Bar',
    message: 'Track the bottles and ingredients you have at home. My Bar shows you which of your recipes you can make right now — and what you\'re missing for the rest.',
    ctaLabel: 'Open My Bar',
    ctaHref: '/inventory',
  },
  {
    id: '2026-04-calculators',
    title: 'New: Calculators',
    message: 'Three tools to make your recipes work at any scale. Batch calculator scales any recipe with dilution guidance and flags carbonated ingredients that should stay per-glass. ABV estimator shows you pre- and post-dilution strength, seeded from your ingredient data. Cost calculator gives you per-serving and per-batch cost breakdowns.',
    ctaLabel: 'Open Calculators',
    ctaHref: '/calculators',
  },
];