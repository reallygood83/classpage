import { firebaseConfig } from '../firebase-config.js';

const fields = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'FIREBASE_AUTH_DOMAIN',
  projectId: 'FIREBASE_PROJECT_ID',
  storageBucket: 'FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
  appId: 'FIREBASE_APP_ID',
  measurementId: 'FIREBASE_MEASUREMENT_ID',
};

export function resolveFirebaseConfig(env) {
  const config = {};
  const missing = [];
  for (const [field, variable] of Object.entries(fields)) {
    const value = typeof env[variable] === 'string' ? env[variable].trim() : '';
    if (value) config[field] = value;
    else if (env.VERCEL !== '1') config[field] = firebaseConfig[field];
    else if (field !== 'measurementId') missing.push(variable);
  }
  if (missing.length) throw new Error(`Missing required Firebase environment variables: ${missing.join(', ')}`);
  return config;
}
