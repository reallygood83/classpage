import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firebaseConfig } from '../firebase-config.js';
import { resolveFirebaseConfig } from '../scripts/config.mjs';
import { build } from '../scripts/build.mjs';

const deploymentEnv = {
  VERCEL: '1',
  FIREBASE_API_KEY: 'public-key',
  FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'example',
  FIREBASE_STORAGE_BUCKET: 'example.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: '12345',
  FIREBASE_APP_ID: '1:12345:web:example',
  FIREBASE_MEASUREMENT_ID: 'G-EXAMPLE',
};

test('local builds use committed Firebase defaults and explicit overrides', () => {
  assert.deepEqual(resolveFirebaseConfig({}), firebaseConfig);
  assert.deepEqual(resolveFirebaseConfig({ FIREBASE_PROJECT_ID: ' local-example ' }), { ...firebaseConfig, projectId: 'local-example' });
});

test('Vercel uses all seven variables without serializing unrelated environment', () => {
  const result = resolveFirebaseConfig({ ...deploymentEnv, DATABASE_PASSWORD: 'never-public', FIREBASE_ADMIN_PRIVATE_KEY: 'never-public' });
  assert.deepEqual(result, { apiKey: 'public-key', authDomain: 'example.firebaseapp.com', projectId: 'example', storageBucket: 'example.firebasestorage.app', messagingSenderId: '12345', appId: '1:12345:web:example', measurementId: 'G-EXAMPLE' });
});

test('Vercel fails for each missing or blank required variable and permits absent measurement', () => {
  for (const variable of Object.keys(deploymentEnv).filter((key) => key !== 'VERCEL' && key !== 'FIREBASE_MEASUREMENT_ID')) {
    for (const value of [undefined, '   ']) {
      assert.throws(() => resolveFirebaseConfig({ ...deploymentEnv, [variable]: value }), new RegExp(variable));
    }
  }
  const result = resolveFirebaseConfig({ ...deploymentEnv, FIREBASE_MEASUREMENT_ID: undefined });
  assert.equal('measurementId' in result, false);
});

test('build emits an importable config and only allowlisted static files', async (t) => {
  const rootDir = mkdtempSync(join(tmpdir(), 'classpage-build-'));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  for (const name of ['index.html', 'app.js', 'core.js', 'discussion.js', 'firebase.js', 'styles.css']) writeFileSync(join(rootDir, name), name);
  for (const name of ['assets', '.git', '.omo', 'tests']) mkdirSync(join(rootDir, name));
  writeFileSync(join(rootDir, '.env'), 'DATABASE_PASSWORD=private');
  writeFileSync(join(rootDir, 'README.md'), 'internal');
  writeFileSync(join(rootDir, 'assets', 'hero.jpg'), 'image');
  writeFileSync(join(rootDir, 'assets', 'prompt.md'), 'private prompt');
  writeFileSync(join(rootDir, 'assets', '.hidden.png'), 'private');
  symlinkSync(join(rootDir, '.env'), join(rootDir, 'assets', 'secret.jpg'));
  const outputDir = build({ rootDir, env: { ...deploymentEnv, FIREBASE_API_KEY: 'quote"\nvalue', SERVICE_ACCOUNT: 'do-not-leak' } });
  assert.deepEqual(readdirSync(outputDir).sort(), ['app.js', 'assets', 'core.js', 'discussion.js', 'firebase-config.js', 'firebase.js', 'index.html', 'styles.css']);
  assert.deepEqual(readdirSync(join(outputDir, 'assets')), ['hero.jpg']);
  const source = readFileSync(join(outputDir, 'firebase-config.js'), 'utf8');
  assert.equal(source.includes('do-not-leak'), false);
  const generated = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal(generated.firebaseConfig.apiKey, 'quote"\nvalue');
  writeFileSync(join(outputDir, 'stale-file.txt'), 'old output');
  build({ rootDir, env: {} });
  assert.equal(readdirSync(outputDir).includes('stale-file.txt'), false);
  const localSource = readFileSync(join(outputDir, 'firebase-config.js'), 'utf8');
  const local = await import(`data:text/javascript;base64,${Buffer.from(localSource).toString('base64')}`);
  assert.deepEqual(local.firebaseConfig, firebaseConfig);
});
