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
    id: '2026-04-feature-notifications',
    title: 'New feature notifications',
    message: 'Dramscript can now surface product updates in-app. Dismiss a notice once and it stays gone on this device.',
    ctaLabel: 'View profile',
    ctaHref: '/profile',
  },
];