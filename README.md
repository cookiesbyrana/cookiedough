# Cookie Dough by Rana — Website

Small-batch cookie bakery site. Static multi-page site, no build step required.

## Structure

```
├── index.html        Home page
├── menu.html          Full menu (cookies + boxes)
├── reviews.html       Customer reviews (live-synced from Google Sheet)
├── css/style.css      Shared stylesheet for all pages
└── assets/img/        Photos
```

## Reviews sync

`reviews.html` pulls approved reviews live from a Google Sheet published as CSV.

- Google Form → linked Google Sheet → add an `Approved` column → mark rows `yes`
- Publish that sheet: File → Share → Publish to web → CSV format
- Paste the resulting URL into `SHEET_CSV_URL` near the bottom of `reviews.html`

## Deploying

This site is static — no build step. Deploy the whole folder as-is to:
- **Netlify** (current host): connect this repo under Site settings → Build & deploy → Link repository, for auto-deploy on every push. Or drag-and-drop the folder at app.netlify.com/drop.
- Any other static host (GitHub Pages, Vercel, etc.) works the same way.

## Adding a new page

Copy the `<div class="topbar">` nav and `<footer>` blocks from any existing page so navigation stays consistent, link `css/style.css`, and add your content in between.
