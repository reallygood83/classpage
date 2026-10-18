import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveFirebaseConfig } from './config.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const publicFiles = ['index.html', 'app.js', 'core.js', 'discussion.js', 'enrollment.js', 'firebase.js', 'styles.css'];
const assetExtensions = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif', '.ico', '.woff', '.woff2']);

export function build({ rootDir = projectRoot, env = process.env } = {}) {
  const config = resolveFirebaseConfig(env);
  for (const name of publicFiles) {
    if (!lstatSync(join(rootDir, name)).isFile()) throw new Error(`Expected a regular public file: ${name}`);
  }
  const outputDir = join(rootDir, 'dist');
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  for (const name of publicFiles) cpSync(join(rootDir, name), join(outputDir, name));
  const assets = join(rootDir, 'assets');
  if (existsSync(assets)) {
    cpSync(assets, join(outputDir, 'assets'), {
      recursive: true,
      filter(source) {
        const entry = lstatSync(source);
        return !entry.isSymbolicLink() && !basename(source).startsWith('.')
          && (entry.isDirectory() || assetExtensions.has(extname(source).toLowerCase()));
      },
    });
  }
  writeFileSync(join(outputDir, 'firebase-config.js'), `export const firebaseConfig = ${JSON.stringify(config, null, 2)};\n`);
  return outputDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    build();
    console.log('Static application built in dist/');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
