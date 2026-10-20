const env = process.env;

export const CONFIG = Object.freeze({
  EVENT_NAME: env.EVENT_NAME || 'Movie Character Night',
  EVENT_DATE: env.EVENT_DATE || 'Set your event date',
  EVENT_VENUE: env.EVENT_VENUE || 'Set your event venue',
  WELCOME: env.EVENT_WELCOME || 'Lights. Camera. Memories. Share your red-carpet moments!',
  MAX_FILE_MB: Number(env.MAX_FILE_MB) || 1024,
  MAX_GALLERY: 60,
  ALLOWED_TYPES: ['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm']
});

export function requireEnv(name) {
  const value = env[name];
  if (!value) throw new Error('Missing environment variable ' + name + '. Run npm run setup.');
  return value;
}
