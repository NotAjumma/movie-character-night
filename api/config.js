import { CONFIG } from '../lib/config.js';

export function GET() {
  return Response.json({
    name: CONFIG.EVENT_NAME, date: CONFIG.EVENT_DATE, venue: CONFIG.EVENT_VENUE,
    welcome: CONFIG.WELCOME, maxFileMB: CONFIG.MAX_FILE_MB, allowedTypes: CONFIG.ALLOWED_TYPES
  });
}
