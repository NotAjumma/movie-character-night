# Movie Character Night — Google Drive Event Photo & Video Drop

## What this does
- Public QR-linked event landing page.
- Guest photo/video selection, phone camera capture, upload progress.
- Stores original media in **your Google Drive**, metadata in **your Google Sheet**.
- Public gallery of latest 60 files (links to unlisted Google Drive files).
- No guest Google sign-in required.

## Setup (10–20 minutes)
1. Open https://script.google.com/ and select **New project**.
2. Rename it `Movie Character Night`.
3. Replace the default `Code.gs` with the contents of the included `Code.gs`.
4. Add a new HTML file using the **+** button, name it exactly `Index`, and replace its contents with the included `Index.html`.
5. Edit the four `EVENT_*` / `WELCOME` values at the top of `Code.gs` with your event details.
6. Save. In the function dropdown, choose **setup**, then **Run**. Approve Google permissions for Drive and Sheets. Review requested access carefully.
7. In **Executions / Execution log**, find the two links to the created Drive upload folder and Google Sheet. Keep the folder and sheet owned by your account.
8. Click **Deploy → New deployment → Web app**. Select **Execute as: Me** and **Who has access: Anyone**. Authorize if prompted. Copy the resulting **/exec** URL.
9. Open the /exec URL in a private/incognito window (not logged into your Google account), test a small JPG upload, then open the gallery.
10. Create a QR code pointing to that exact /exec URL, and put it on your event poster. Test the QR from a phone on mobile data.

## Important caveats
- This is a practical small-event implementation, **not** a high-volume video hosting service. Google Apps Script has execution, concurrent request, storage, and daily service quotas. Many simultaneous guests or large videos may cause errors.
- Limit is **20 MB per file**, adjustable in `CONFIG.MAX_FILE_MB`. Videos from phones may exceed that quickly. For a larger event or longer videos, migrate the upload API to Cloud Run / Firebase Storage / Google Cloud Storage with appropriate quotas and moderation.
- Public gallery files are set to **Anyone with the link — Viewer**. Guests can view/download them if they have a link. Google Workspace admins may block this sharing mode.
- Since the web app executes as you, **anyone with the public URL can submit files that consume your Drive storage**. Share the QR only with attendees. There is no abuse prevention, rate limiting, moderation, malware scanning, or content filtering in this starter version.
- Google Drive previews/thumbnails sometimes load slowly or may be blocked by browser restrictions. Guests can click through to the Drive viewer.
- Uploads are **not encrypted end-to-end** beyond standard HTTPS; avoid sensitive/private media. Obtain consent from guests before sharing their images.
- Chunk files are stored temporarily. Run `cleanupAbandonedUploads()` occasionally in the Apps Script editor to trash abandoned temporary folders older than 24 hours.
- If you change the source after deploying, go to **Deploy → Manage deployments → Edit → New version → Deploy**. The existing /exec URL stays the same.
- The HTML file works **only when served by Apps Script** because it calls `google.script.run`; opening it locally is not a functioning upload site.

## Testing checklist
- [ ] Open website from phone using QR
- [ ] Upload JPEG and MP4 under 20 MB
- [ ] Camera/photo capture on phone
- [ ] Gallery shows uploaded items
- [ ] Google Drive upload folder has files
- [ ] Google Sheet has log rows
- [ ] Test in incognito to confirm guest access

## Admin controls
- To remove an item from the public gallery, delete its corresponding row in the Google Sheet and trash the file in Google Drive.
- To change event text, edit `CONFIG` in Code.gs and deploy a new version.
- To close uploads after the event, change deployment access or archive the deployment.
