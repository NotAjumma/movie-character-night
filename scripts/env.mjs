import { readFileSync, existsSync } from 'node:fs';

export const ENV_FILE = new URL('../.env.local', import.meta.url);

/** Minimal KEY=value parser for .env.local; existing process.env wins. */
export function loadEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const values = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  for (const [k, v] of Object.entries(values)) process.env[k] ??= v;
  return values;
}
