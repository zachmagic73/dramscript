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
];