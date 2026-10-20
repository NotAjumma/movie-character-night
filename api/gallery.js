import { CONFIG, requireEnv } from '../lib/config.js';
import { drive, route } from '../lib/google.js';

/** Latest published uploads. To hide one, trash it in Google Drive. */
export const GET = route(async () => {
  const q = `'${requireEnv('DRIVE_FOLDER_ID')}' in parents and trashed = false`
    + ` and appProperties has { key='published' and value='1' }`;
  const params = new URLSearchParams({
    q, orderBy: 'createdTime desc', pageSize: String(CONFIG.MAX_GALLERY),
    fields: 'files(id,name,mimeType,appProperties)'
  });
  const { files } = await (await drive('files?' + params)).json();
  const items = files.map(f => ({
    id: f.id, name: f.name, type: f.mimeType, guest: f.appProperties?.guest || 'Anonymous',
    thumb: 'https://drive.google.com/thumbnail?id=' + f.id + '&sz=w600',
    full: 'https://drive.google.com/thumbnail?id=' + f.id + '&sz=w1600',
    preview: 'https://drive.google.com/file/d/' + f.id + '/preview'
  }));
  return Response.json(items, { headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=30' } });
});
