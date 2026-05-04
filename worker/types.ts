export interface Env {
  dramscript_db: D1Database;
  SESSIONS: KVNamespace;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  AI: Ai;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET_NAME?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  /**
   * Google Cloud Vision API key — enables handwriting-capable OCR (Phase 13).
   * Get from: Google Cloud Console → APIs & Services → Credentials → Create API Key
   * Enable: Cloud Vision API. Free tier: 1,000 units/month.
   * If absent, falls back to deterministic OCR-only parsing (no handwriting support).
   */
  GOOGLE_VISION_API_KEY?: string;
  /**
   * VAPID key pair for Web Push notifications.
   * Generate with: node -e "require('./scripts/gen-vapid')"
   * Add as Cloudflare Worker secrets: npx wrangler secret put VAPID_PUBLIC_KEY
   */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

export interface SessionData {
  user_id: string;
  email: string;
  expires_at: number;
}

export interface DbUser {
  id: string;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  default_units: 'oz' | 'ml';
  created_at: number;
  updated_at: number;
}
