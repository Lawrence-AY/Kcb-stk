import dotenv from 'dotenv';
dotenv.config();

const readEnv = (key: string, fallback = '') => String(process.env[key] || fallback).trim().replace(/^['"]|['"]$/g, '');
const readBooleanEnv = (key: string, fallback = true) => {
  const raw = readEnv(key);
  if (!raw) return fallback;
  return ['true', '1', 'yes', 'y'].includes(raw.toLowerCase());
};
const readListEnv = (key: string) => readEnv(key)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  PORT: parseInt(readEnv('PORT', '3001'), 10),
  FIREBASE_PROJECT_ID: readEnv('FIREBASE_PROJECT_ID'),
  FIREBASE_CLIENT_EMAIL: readEnv('FIREBASE_CLIENT_EMAIL'),
  FIREBASE_PRIVATE_KEY: readEnv('FIREBASE_PRIVATE_KEY'),
  FIRESTORE_DATABASE_ID: readEnv('FIRESTORE_DATABASE_ID', '(default)'),
  FIRESTORE_REGISTRATIONS_COLLECTION: readEnv('FIRESTORE_REGISTRATIONS_COLLECTION', 'registrations'),
  OAUTH_TOKEN_ENDPOINT: readEnv('OAUTH_TOKEN_ENDPOINT', 'https://uat.buni.kcbgroup.com/token?grant_type=client_credentials'),
  BUNI_BASE_URL: readEnv('BUNI_BASE_URL', 'https://uat.buni.kcbgroup.com'),
  BACKEND_BASE_URL: readEnv('BACKEND_BASE_URL') || readEnv('WORKER_BASE_URL') || `http://localhost:${readEnv('PORT', '3000')}`,
  CONSUMER_KEY: readEnv('CONSUMER_KEY') || readEnv('KCB_USERNAME'),
  CONSUMER_SECRET: readEnv('CONSUMER_SECRET') || readEnv('KCB_PASSWORD'),
  SHARED_SHORTCODE: readBooleanEnv('KCB_SHARED_SHORTCODE', true),
  SHORTCODE: readEnv('KCB_ORG_SHORTCODE') || readEnv('SHORTCODE'),
  PASSKEY: readEnv('KCB_ORG_PASSKEY') || readEnv('PASSKEY'),
  ALLOWED_IPS: readListEnv('ALLOWED_IPS'),
  ALLOWED_COUNTRIES: readListEnv('ALLOWED_COUNTRIES').map((value) => value.toUpperCase()),
  API_KEY_FOR_BACKEND: readEnv('API_KEY_FOR_BACKEND'),
};
