# Cookie Dough by Rana — Website

Small-batch cookie bakery site. Static multi-page site, no build step required.

## Structure

```
├── index.html        Home page
├── menu.html          Full menu (cookies + boxes)
├── reviews.html       Customer reviews (live-synced from Google Sheet)
├── ar/                Arabic (right-to-left) versions of the three pages above
├── css/style.css      Shared stylesheet for all pages (Arabic rules are under [dir="rtl"])
├── js/reviews.js      Loads reviews from the Google Sheet (used by English + Arabic pages)
└── assets/img/        Photos
```

## Languages

Every page exists in English (root folder) and Arabic (`ar/`). The nav has a
"العربية" / "English" link that switches to the same page in the other language.
When you change prices, products or text, update **both** versions — e.g.
`menu.html` and `ar/menu.html`.

## Reviews sync

`reviews.html` pulls approved reviews live from a Google Sheet published as CSV.

- Google Form → linked Google Sheet → add an `Approved` column → mark rows `yes`
- Publish that sheet: File → Share → Publish to web → CSV format
- Paste the resulting URL into `SHEET_CSV_URL` at the top of `js/reviews.js`
- Approved reviews then show on the Reviews pages and (newest 3) on the home pages, in both languages

## Deploying

This site is static — no build step. Deploy the whole folder as-is to:
- **Netlify** (current host): connect this repo under Site settings → Build & deploy → Link repository, for auto-deploy on every push. Or drag-and-drop the folder at app.netlify.com/drop.
- Any other static host (GitHub Pages, Vercel, etc.) works the same way.

## Adding a new page

Copy the `<div class="topbar">` nav and `<footer>` blocks from any existing page so navigation stays consistent, link `css/style.css`, and add your content in between. Create the Arabic copy in `ar/` the same way (starting from an existing `ar/` page, which uses `../` paths and `dir="rtl"`).
