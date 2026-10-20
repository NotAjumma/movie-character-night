import { requireEnv } from './config.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let cached = null;

async function accessToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: requireEnv('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Google auth failed: ' + (data.error_description || data.error));
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

/** Authenticated Drive API call. Relative paths resolve against drive/v3. */
export async function drive(path, init = {}) {
  const url = path.startsWith('https://') ? path : 'https://www.googleapis.com/drive/v3/' + path;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: 'Bearer ' + await accessToken(), ...init.headers }
  });
  if (!res.ok) throw new Error('Drive API ' + res.status + ': ' + (await res.text()).slice(0, 300));
  return res;
}

/** Wraps a route so thrown errors become JSON; only HttpError messages reach guests. */
export function route(fn) {
  return async (request) => {
    try { return await fn(request); }
    catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: 'Server error. Please try again.' }, { status: 500 });
    }
  };
}

export async function readJson(request) {
  try { return await request.json(); }
  catch { throw new HttpError(400, 'Invalid request body.'); }
}
