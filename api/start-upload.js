import { CONFIG, requireEnv } from '../lib/config.js';
import { drive, route, readJson, HttpError } from '../lib/google.js';

function safeName(name) {
  return String(name || 'upload').replace(/[\\/\x00-\x1f<>:"|?*]/g, '_').slice(0, 110);
}

/** Opens a Drive resumable upload session. The browser then PUTs the file straight
 * to Google, so large videos never pass through Vercel's 4.5 MB request limit. */
export const POST = route(async (request) => {
  const meta = await readJson(request);
  if (!CONFIG.ALLOWED_TYPES.includes(meta.type)) throw new HttpError(400, 'Unsupported file type: ' + meta.type);
  const size = Number(meta.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > CONFIG.MAX_FILE_MB * 1024 * 1024)
    throw new HttpError(400, 'File must be between 1 byte and ' + CONFIG.MAX_FILE_MB + ' MB.');
  const guest = String(meta.guest || 'Anonymous').trim().slice(0, 60) || 'Anonymous';

  // Drive only allows the browser to use the session URL from the Origin it was opened for.
  const origin = request.headers.get('origin') || new URL(request.url).origin;
  const res = await drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': meta.type,
      'X-Upload-Content-Length': String(size),
      Origin: origin
    },
    body: JSON.stringify({
      name: safeName(meta.name),
      mimeType: meta.type,
      parents: [requireEnv('DRIVE_FOLDER_ID')],
      description: 'Uploaded by ' + guest,
      appProperties: { guest }
    })
  });
  return Response.json({ uploadUrl: res.headers.get('location') });
});
