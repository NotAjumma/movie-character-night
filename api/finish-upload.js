import { CONFIG, requireEnv } from '../lib/config.js';
import { drive, route, readJson, HttpError } from '../lib/google.js';

/** Makes a finished upload link-viewable and marks it for the public gallery. */
export const POST = route(async (request) => {
  const { id } = await readJson(request);
  if (!/^[\w-]{10,100}$/.test(String(id))) throw new HttpError(400, 'Invalid file id.');
  const file = await (await drive('files/' + id + '?fields=id,parents,size,mimeType,trashed')).json();
  if (file.trashed || !file.parents?.includes(requireEnv('DRIVE_FOLDER_ID')))
    throw new HttpError(404, 'Upload not found.');
  if (!CONFIG.ALLOWED_TYPES.includes(file.mimeType) || Number(file.size) > CONFIG.MAX_FILE_MB * 1024 * 1024)
    throw new HttpError(400, 'File rejected.');

  await drive('files/' + id + '/permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });
  await drive('files/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appProperties: { published: '1' } })
  });
  return Response.json({ ok: true, id });
});
