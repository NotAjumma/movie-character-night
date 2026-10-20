/** Movie Character Night — Google Apps Script backend.
 * Deploy as Web App: Execute as Me; access Anyone.
 * Run setup() once from editor, authorize, then deploy.
 */
const CONFIG = Object.freeze({
  EVENT_NAME: 'Movie Character Night',
  EVENT_DATE: 'Set your event date',
  EVENT_VENUE: 'Set your event venue',
  WELCOME: 'Lights. Camera. Memories. Share your red-carpet moments!',
  MAX_FILE_MB: 20,
  CHUNK_BYTES: 384 * 1024,
  MAX_GALLERY: 60,
  ALLOWED_TYPES: ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
});
const P = PropertiesService.getScriptProperties();

function setup() {
  if (!P.getProperty('FOLDER_ID')) {
    const folder = DriveApp.createFolder('Movie Character Night — Guest Uploads');
    P.setProperty('FOLDER_ID', folder.getId());
  }
  if (!P.getProperty('TEMP_ID')) {
    const folder = DriveApp.createFolder('Movie Character Night — Temporary Chunks');
    P.setProperty('TEMP_ID', folder.getId());
  }
  if (!P.getProperty('SHEET_ID')) {
    const ss = SpreadsheetApp.create('Movie Character Night — Upload Log');
    ss.getActiveSheet().appendRow(['Uploaded At','Guest','Filename','MIME Type','Bytes','Drive File ID','View URL']);
    P.setProperty('SHEET_ID', ss.getId());
  }
  Logger.log('Upload folder: https://drive.google.com/drive/folders/' + P.getProperty('FOLDER_ID'));
  Logger.log('Upload log: https://docs.google.com/spreadsheets/d/' + P.getProperty('SHEET_ID'));
  return 'Setup complete';
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CONFIG.EVENT_NAME)
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}

function getConfig() {
  return {name: CONFIG.EVENT_NAME, date: CONFIG.EVENT_DATE, venue: CONFIG.EVENT_VENUE,
    welcome: CONFIG.WELCOME, maxFileMB: CONFIG.MAX_FILE_MB, chunkBytes: CONFIG.CHUNK_BYTES};
}

function safeName(name) {
  return String(name || 'upload').replace(/[\\/\x00-\x1f<>:"|?*]/g,'_').slice(0,110);
}
function requireSetup() {
  if (!P.getProperty('FOLDER_ID') || !P.getProperty('TEMP_ID') || !P.getProperty('SHEET_ID'))
    throw Error('Administrator must run setup() first.');
}
function validateType(type) {
  if (!CONFIG.ALLOWED_TYPES.includes(type)) throw Error('Unsupported file type: ' + type);
}
function sessionKey(id) { return 'UPLOAD_' + id; }
function sessionInfo(id) {
  const raw = P.getProperty(sessionKey(id));
  if (!raw) throw Error('Upload session expired or not found. Start again.');
  return JSON.parse(raw);
}
function startUpload(meta) {
  requireSetup();
  validateType(meta.type);
  const bytes = Number(meta.size);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > CONFIG.MAX_FILE_MB*1024*1024)
    throw Error('File must be between 1 byte and ' + CONFIG.MAX_FILE_MB + ' MB.');
  const count = Math.ceil(bytes / CONFIG.CHUNK_BYTES);
  const id = Utilities.getUuid();
  const sessionFolder = DriveApp.getFolderById(P.getProperty('TEMP_ID')).createFolder(id);
  P.setProperty(sessionKey(id), JSON.stringify({folderId:sessionFolder.getId(),
    guest:String(meta.guest || 'Anonymous').trim().slice(0,60),name:safeName(meta.name),
    type:meta.type,size:bytes,count:count,created:Date.now()}));
  return {id:id,chunkBytes:CONFIG.CHUNK_BYTES,count:count};
}
function uploadChunk(id, index, base64) {
  const s = sessionInfo(id);
  if (Date.now()-s.created > 45*60*1000) throw Error('Upload session timed out.');
  if (!Number.isInteger(index) || index < 0 || index >= s.count) throw Error('Invalid chunk number.');
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > CONFIG.CHUNK_BYTES) throw Error('Invalid chunk size.');
  const folder = DriveApp.getFolderById(s.folderId);
  const name = 'part_' + String(index).padStart(5,'0');
  const existing = folder.getFilesByName(name);
  while (existing.hasNext()) existing.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(bytes,'application/octet-stream',name));
  return index;
}
function finishUpload(id) {
  requireSetup();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = sessionInfo(id);
    const folder = DriveApp.getFolderById(s.folderId);
    const parts = {};
    const it = folder.getFiles();
    while (it.hasNext()) { const f = it.next(); if (/^part_\d{5}$/.test(f.getName())) parts[f.getName()] = f; }
    const combined = [];
    for (let i=0;i<s.count;i++) {
      const key='part_'+String(i).padStart(5,'0');
      if (!parts[key]) throw Error('Missing upload chunk ' + (i+1));
      const bytes = parts[key].getBlob().getBytes();
      for (let j=0;j<bytes.length;j++) combined.push(bytes[j]);
    }
    if (combined.length !== s.size) throw Error('File size verification failed.');
    const file = DriveApp.getFolderById(P.getProperty('FOLDER_ID'))
      .createFile(Utilities.newBlob(combined,s.type,s.name));
    // Public gallery uses unlisted Drive file links. Do not use for private events.
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW); }
    catch (e) { file.setTrashed(true); throw Error('Your Google account blocks link-sharing. Enable Anyone with the link or use another account.'); }
    const url='https://drive.google.com/file/d/'+file.getId()+'/view';
    SpreadsheetApp.openById(P.getProperty('SHEET_ID')).getSheets()[0]
      .appendRow([new Date(),s.guest,s.name,s.type,s.size,file.getId(),url]);
    folder.setTrashed(true);
    P.deleteProperty(sessionKey(id));
    return {ok:true,id:file.getId(),url:url};
  } finally { lock.releaseLock(); }
}
function listGallery() {
  requireSetup();
  const sheet=SpreadsheetApp.openById(P.getProperty('SHEET_ID')).getSheets()[0];
  const last=sheet.getLastRow();
  if (last<2) return [];
  const start=Math.max(2,last-CONFIG.MAX_GALLERY+1);
  const rows=sheet.getRange(start,1,last-start+1,7).getValues();
  return rows.reverse().map(r=>({guest:String(r[1]),name:String(r[2]),type:String(r[3]),
    id:String(r[5]),url:String(r[6]),thumb:'https://drive.google.com/thumbnail?id='+encodeURIComponent(String(r[5]))+'&sz=w600',
    preview:'https://drive.google.com/file/d/'+encodeURIComponent(String(r[5]))+'/preview'}));
}
/** Optional admin cleanup: run from editor occasionally for abandoned uploads. */
function cleanupAbandonedUploads() {
  requireSetup();
  const folder=DriveApp.getFolderById(P.getProperty('TEMP_ID'));
  const iter=folder.getFolders();
  const cutoff=Date.now()-24*60*60*1000;
  while(iter.hasNext()) { const f=iter.next(); if(f.getDateCreated().getTime()<cutoff) f.setTrashed(true); }
}
