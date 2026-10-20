import { CONFIG, requireEnv } from '../lib/config.js';
import { drive, route, readJson, HttpError } from '../lib/google.js';

const THUMB_MAX_BYTES = 2 * 1024 * 1024;

/** Loads a file only if it is an untrashed upload in the event folder. */
async function eventFile(id) {
  if (!/^[\w-]{10,100}$/.test(String(id))) throw new HttpError(400, 'Invalid file id.');
  const file = await (await drive('files/' + id + '?fields=id,parents,size,mimeType,trashed')).json();
  if (file.trashed || !file.parents?.includes(requireEnv('DRIVE_FOLDER_ID')))
    throw new HttpError(404, 'Upload not found.');
  return file;
}

async function update(id, appProperties) {
  await drive('files/' + id + '/permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });
  await drive('files/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appProperties })
  });
}

/** Makes a finished upload link-viewable and marks it for the public gallery.
 * Videos may bring a browser-captured thumbnail image (thumbId), shared but not published. */
export const POST = route(async (request) => {
  const { id, thumbId } = await readJson(request);
  const file = await eventFile(id);
  if (!CONFIG.ALLOWED_TYPES.includes(file.mimeType) || Number(file.size) > CONFIG.MAX_FILE_MB * 1024 * 1024)
    throw new HttpError(400, 'File rejected.');

  const props = { published: '1' };
  if (thumbId && file.mimeType.startsWith('video/')) {
    const thumb = await eventFile(thumbId);
    if (thumb.mimeType !== 'image/jpeg' || Number(thumb.size) > THUMB_MAX_BYTES)
      throw new HttpError(400, 'Thumbnail rejected.');
    await update(thumb.id, { thumbOf: file.id });
    props.thumb = thumb.id;
  }
  await update(file.id, props);
  return Response.json({ ok: true, id });
});
