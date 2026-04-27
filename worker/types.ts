export interface Env {
  dramscript_db: D1Database;
  SESSIONS: KVNamespace;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
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
