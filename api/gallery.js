import { CONFIG, requireEnv } from '../lib/config.js';
import { drive, route } from '../lib/google.js';

// Drive fills videoMediaMetadata once a video is playable. Stop waiting after this
// long so a format Drive never processes doesn't stay "processing" forever.
const PROCESSING_GRACE_MS = 60 * 60 * 1000;

const thumbnail = (id, size) => '/api/thumb?id=' + id + '&sz=' + size;

/** Latest published uploads. To hide one, trash it in Google Drive. */
export const GET = route(async () => {
  const q = `'${requireEnv('DRIVE_FOLDER_ID')}' in parents and trashed = false`
    + ` and appProperties has { key='published' and value='1' }`;
  const params = new URLSearchParams({
    q, orderBy: 'createdTime desc', pageSize: String(CONFIG.MAX_GALLERY),
    fields: 'files(id,name,mimeType,createdTime,appProperties,videoMediaMetadata)'
  });
  const { files } = await (await drive('files?' + params)).json();
  const items = files.map(f => {
    const video = f.mimeType.startsWith('video/');
    // Videos use the frame the guest's browser captured, since Drive has none until processed.
    const thumbId = (video && f.appProperties?.thumb) || f.id;
    return {
      id: f.id, name: f.name, type: f.mimeType, guest: f.appProperties?.guest || 'Anonymous',
      processing: video && !f.videoMediaMetadata && Date.now() - Date.parse(f.createdTime) < PROCESSING_GRACE_MS,
      thumb: thumbnail(thumbId, 600),
      full: thumbnail(f.id, 1600),
      preview: 'https://drive.google.com/file/d/' + f.id + '/preview'
    };
  });
  return Response.json(items, { headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' } });
});
