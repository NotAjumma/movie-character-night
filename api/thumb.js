import { requireEnv } from '../lib/config.js';
import { drive, cachedFile, route, HttpError } from '../lib/google.js';

const SIZES = new Set(['600', '1600']);

/** Serves a gallery image or video thumbnail through the app's own Drive access.
 * The public drive.google.com/thumbnail links get rate limited (HTTP 429) when many
 * guests load the gallery, so the browser never talks to Drive for images. */
export const GET = route(async (request) => {
  const params = new URL(request.url).searchParams;
  const id = params.get('id'), size = params.get('sz') || '600';
  if (!/^[\w-]{10,100}$/.test(String(id)) || !SIZES.has(size)) throw new HttpError(400, 'Invalid request.');
  const file = await cachedFile(id, 'parents,trashed,appProperties,thumbnailLink');
  const visible = file.appProperties?.published === '1' || file.appProperties?.thumbOf;
  if (file.trashed || !file.parents?.includes(requireEnv('DRIVE_FOLDER_ID')) || !visible)
    throw new HttpError(404, 'Not found.');
  // Drive has no thumbnail yet (e.g. a video still processing): short cache so it appears soon.
  if (!file.thumbnailLink)
    return new Response(null, { status: 404, headers: { 'Cache-Control': 's-maxage=30' } });

  const res = await drive(file.thumbnailLink.replace(/=s\d+$/, '=w' + size));
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/jpeg',
      // A file's thumbnail never changes, so the CDN can serve repeat views without hitting Drive.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800'
    }
  });
});
