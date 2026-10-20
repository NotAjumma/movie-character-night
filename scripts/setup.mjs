// One-time setup: sign in with the Google account that owns the Drive storage,
// create the uploads folder, and write the credentials to .env.local.
import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { loadEnv, ENV_FILE } from './env.mjs';

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const existing = loadEnv();
const rl = createInterface({ input: process.stdin, output: process.stdout });
const clientId = process.env.GOOGLE_CLIENT_ID || (await rl.question('OAuth Client ID: ')).trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || (await rl.question('OAuth Client Secret: ')).trim();
rl.close();

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId, redirect_uri: REDIRECT, response_type: 'code',
  scope: SCOPE, access_type: 'offline', prompt: 'consent'
});

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (!code && !error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end(code ? 'Done. You can close this tab and return to the terminal.' : 'Sign-in failed: ' + error);
    server.close();
    code ? resolve(code) : reject(new Error(error));
  }).listen(PORT, '127.0.0.1', () => {
    console.log('\nOpen this URL and sign in with the Google account that has the 5TB Drive:\n\n' + authUrl + '\n');
    execFile('open', [authUrl], () => {});
  });
});

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: 'authorization_code' })
});
const tokens = await tokenRes.json();
if (!tokenRes.ok || !tokens.refresh_token) throw new Error('Token exchange failed: ' + JSON.stringify(tokens));

// drive.file scope only sees files this app created, so the folder must be created here.
let folderId = existing.DRIVE_FOLDER_ID;
if (!folderId) {
  const folderRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tokens.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Movie Character Night — Guest Uploads', mimeType: 'application/vnd.google-apps.folder' })
  });
  const folder = await folderRes.json();
  if (!folderRes.ok) throw new Error('Could not create Drive folder: ' + JSON.stringify(folder));
  folderId = folder.id;
}

const env = {
  ...existing,
  GOOGLE_CLIENT_ID: clientId,
  GOOGLE_CLIENT_SECRET: clientSecret,
  GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
  DRIVE_FOLDER_ID: folderId
};
writeFileSync(ENV_FILE, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });

console.log('Saved .env.local');
console.log('Drive folder: https://drive.google.com/drive/folders/' + folderId);
console.log('\nAdd these to Vercel → Project → Settings → Environment Variables:');
for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'DRIVE_FOLDER_ID']) console.log('  ' + k);
