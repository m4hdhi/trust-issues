# Trust Issues | أزمة ثقة — Chrome extension

Flags fake and scam links where people in the UAE actually meet them, and stops you before you open one.

- **Google Search**: badges on organic and sponsored results: green **Official / رسمي**, amber **Suspicious / مشبوه**, red **Scam / احتيال** with the impersonated brand ("Fake Salik site / موقع مزيّف ينتحل صفة سالك").
- **Google Maps**: checks the *Website* link on place panels and result cards. If a listing's website is flagged, its phone number gets a "Verify this number / تحقّق من هذا الرقم" warning.
- **WhatsApp Web**: checks links inside chat messages.
- **Click protection**: clicking a scam link (or a suspicious one scoring 60+) opens a full-screen bilingual warning with *Go back*, *Full analysis* (starts a deep scan and opens the report) and *Proceed anyway*. Clicks on links whose verdict is still loading are held for up to 4 seconds.
- **Toolbar popup**: verdict and risk score for the current tab, with *Deep scan this page* and *Report as scam*. The toolbar icon shows how many flagged links are on the page.
- **Right-click any link** → *Check link with Trust Issues / افحص الرابط* to run a deep scan in a new tab.

All lookups go through the background service worker to the Trust Issues backend (`POST /api/check`, batched, cached for 10 minutes). Page content is never sent, only the link URLs.

## Install (Load unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension` folder.
4. Pin *Trust Issues* from the puzzle-piece menu so the toolbar badge is visible.

No build step is needed. Plain JavaScript, Chrome 110 or newer.

## Backend URL

The extension talks to `http://localhost:8000` by default. To point it at the deployed backend:

1. Right-click the toolbar icon → **Options** (or the gear in the popup).
2. Enter the backend URL, e.g. `https://your-app.up.railway.app`.
3. Click **Test connection**, then **Save**.

The options page also sets the language display: **Both**, **English** or **العربية**.

## Files

| Path | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `background.js` | Service worker: API calls, cache, context menu, toolbar badge |
| `lib/api.js` | Shared settings and backend client (worker, popup, options) |
| `content/core.js` | Link collection, badges, click protection and warning screen |
| `content/google-search.js`, `content/google-maps.js`, `content/whatsapp.js` | Per-site link selectors |
| `popup.*`, `options.*` | Toolbar popup and settings page |
| `icons/` | Toolbar and store icons |

## Known limits

- Google and WhatsApp change their markup often. Selectors target stable hooks (`#rso`, `h3`/`role="heading"` titles, `data-pcu` on ads, `data-item-id="authority"` on Maps, `#main` on WhatsApp) but may need updating.
- Badges are skipped where inserting one would break a layout (carousels, flex/grid rows on Search, link-preview cards on WhatsApp). Click protection still applies there.
- Google Search runs on the domains listed in `manifest.json` (google.com, google.ae and other regional domains); add more there if needed.
- Opening a link with the right-click menu or by dragging it bypasses click protection.
