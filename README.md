# Movie Character Night — Event Photo & Video Drop (Vercel + Google Drive)

Guests scan a QR code, upload photos/videos (or capture with their phone camera), and browse a gallery — all without leaving the page. Files go **directly from the guest's browser into your Google Drive** (resumable upload), so large videos don't hit Vercel's 4.5 MB request limit.

```
browser ──POST /api/start-upload──▶ Vercel ──▶ Drive (opens upload session)
browser ──PUT file (progress bar)──────────────▶ Drive
browser ──POST /api/finish-upload─▶ Vercel ──▶ Drive (share link + publish to gallery)
```

The previous Google Apps Script version is kept in [apps-script/](apps-script/).

## Setup

### 1. Google Cloud OAuth client (one time, ~10 min)
1. Go to https://console.cloud.google.com/ → create a project (e.g. `movie-character-night`).
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **Google Auth Platform**: User type **External**, fill in app name + your email (no logo; a logo triggers verification).
   On **Audience → Test users** add your own Google account. While the app is in *Testing* mode the refresh token expires after 7 days, which is fine for trying things out.
4. After the first Vercel deploy, set **Branding → Home page** to `https://<your-app>.vercel.app` and **Privacy policy** to `https://<your-app>.vercel.app/privacy.html`, then **Audience → Publish app**. Re-run `npm run setup` and update `GOOGLE_REFRESH_TOKEN` in Vercel so the token no longer expires.
   The `drive.file` scope is non-sensitive, so no Google verification is needed.
5. **Clients → Create client** → type **Desktop app** → copy the Client ID and Client Secret.

### 2. Connect your Drive
```bash
npm run setup
```
Paste the Client ID/Secret, sign in with the account that has the 5TB Drive. This creates the folder **Movie Character Night — Guest Uploads** and writes `.env.local`.

The app uses the `drive.file` scope: it can only see files and folders it created itself, not the rest of your Drive.

### 3. Test locally
```bash
npm run dev     # http://localhost:3005
```
Upload a photo and a video, then open the gallery. Event text can be set with `EVENT_NAME`, `EVENT_DATE`, `EVENT_VENUE`, `EVENT_WELCOME` in `.env.local` (see `.env.example`).

### 4. Deploy to Vercel (free Hobby plan)
1. Push this folder to a GitHub repo.
2. https://vercel.com/new → import the repo. Framework preset: **Other**. No build command needed.
3. **Settings → Environment Variables**: add every value from `.env.local` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `DRIVE_FOLDER_ID`, plus any `EVENT_*`). Redeploy.
4. Open the `*.vercel.app` URL on a phone using mobile data, upload a test file, and check that it shows up in the gallery.
5. Make a QR code for that URL.

## Admin
- **Remove from gallery:** trash the file in the Drive folder. The gallery updates within about 10 seconds.
- **Who uploaded what:** each file's Drive description says `Uploaded by <name>`.
- **Close uploads after the event:** delete `GOOGLE_REFRESH_TOKEN` in Vercel, or pause the project.
- **File size limit:** `MAX_FILE_MB` (default 1024).

## Caveats
- Anyone with the URL can upload into your Drive. There is no rate limiting, moderation or malware scanning, so share the QR only with guests.
- Gallery files are shared as **Anyone with the link → Viewer**.
- Each file uploads in a single request. If a guest's connection drops or the phone locks/backgrounds the tab, that file has to be retried. The page keeps the screen awake (where supported) and warns before closing mid-upload.
- New videos need a few minutes of Drive processing before they play in the gallery preview.
- Vercel Hobby is for personal, non-commercial use.
