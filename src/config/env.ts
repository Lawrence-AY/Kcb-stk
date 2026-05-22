import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_KEY: process.env.SUPABASE_KEY!,
  OAUTH_TOKEN_ENDPOINT: process.env.OAUTH_TOKEN_ENDPOINT!,
  BUNI_BASE_URL: process.env.BUNI_BASE_URL!,
  WORKER_BASE_URL: process.env.WORKER_BASE_URL!,
  CONSUMER_KEY: process.env.CONSUMER_KEY!,
  CONSUMER_SECRET: process.env.CONSUMER_SECRET!,
  SHORTCODE: process.env.SHORTCODE!,
  PASSKEY: process.env.PASSKEY!,
  ALLOWED_IPS: process.env.ALLOWED_IPS?.split(',').map(s => s.trim()) || [],
  ALLOWED_COUNTRIES: process.env.ALLOWED_COUNTRIES?.split(',').map(s => s.trim().toUpperCase()) || [],
  API_KEY_FOR_BACKEND: process.env.API_KEY_FOR_BACKEND,
};