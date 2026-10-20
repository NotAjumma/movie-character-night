import { requireEnv } from '../lib/config.js';
import { drive, cachedFile, route, HttpError } from '../lib/google.js';

// Each response stays under Vercel's 4.5 MB function response limit; the browser's
// <video> element simply asks for the next range.
const CHUNK = 4 * 1024 * 1024;

/** Streams a published gallery video in byte ranges so phones can play it in a native
 * <video> player, without waiting for Drive's own player to finish processing. */
export const GET = route(async (request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!/^[\w-]{10,100}$/.test(String(id))) throw new HttpError(400, 'Invalid file id.');
  const file = await cachedFile(id, 'parents,size,mimeType,trashed,appProperties');
  if (file.trashed || !file.parents?.includes(requireEnv('DRIVE_FOLDER_ID'))
    || file.appProperties?.published !== '1' || !file.mimeType.startsWith('video/'))
    throw new HttpError(404, 'Video not found.');

  const size = Number(file.size);
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  let start = m?.[1] ? Number(m[1]) : 0;
  let end = m?.[2] ? Number(m[2]) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; } // suffix range: bytes=-N
  if (start >= size || start > end)
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  end = Math.min(end, start + CHUNK - 1, size - 1);

  const res = await drive('files/' + id + '?alt=media', { headers: { Range: 'bytes=' + start + '-' + end } });
  return new Response(res.body, {
    status: 206,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Accept-Ranges': 'bytes',
      // Not CDN-cached: a shared cache keyed only on the URL could serve the wrong range.
      'Cache-Control': 'private, max-age=3600'
    }
  });
});
