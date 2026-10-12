# Cookie Dough by Rana — Website

Small-batch cookie bakery site. Static multi-page site, no build step required.

## Structure

```
├── index.html          Home (shows the 3 latest approved reviews)
├── menu.html           Menu (cookies + boxes)
├── reviews.html        Approved reviews + "Leave a review" form
├── ar/                 Arabic (right-to-left) versions of the three pages above
├── css/style.css       Shared stylesheet for all pages (Arabic rules are under [dir="rtl"])
├── js/reviews.js       Loads approved reviews and sends new ones (English + Arabic pages)
├── apps-script/Code.gs Backend that lives in a Google Sheet (not run by Netlify)
└── assets/img/         Photos
```

## Languages

Every page exists in English (root folder) and Arabic (`ar/`). The nav has a
"العربية" / "English" link that switches to the same page in the other language.
When you change prices, products or text, update **both** versions — e.g.
`menu.html` and `ar/menu.html`.

## How reviews work

```
Customer fills the form on reviews.html
        │  (POST)
        ▼
Google Apps Script (Code.gs)  ──►  Private Google Sheet, tab "Reviews"
        ▲                                   │
        │  (GET: approved rows only)        │  Rana types "yes" in the Approved column
        └───────────────────────────────────┘
reviews.html / index.html (and the ar/ copies) display only the approved reviews
```

- The Sheet is **private**. It is never published to the web.
- New reviews are saved with **Approved blank**, so nothing shows until you type `yes`.
- The website only ever receives name, rating, items and review text. Never the Instagram handle or timestamp.
- The Arabic form sends the same English item names (e.g. "Pretzel Cookie"), so the Sheet stays consistent whichever language the customer used.
- Spam protection: hidden honeypot field, length limits, 60-second resend limit, formulas blocked.

### One-time setup

1. Create a new Google Sheet (e.g. "Cookie Dough Reviews").
2. Extensions → Apps Script → delete the sample code → paste everything from `apps-script/Code.gs` → Save.
3. Deploy → New deployment → gear icon → **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and authorize.
   (Google shows an "unverified app" warning because it's your own script: Advanced → Go to project → Allow.)
4. Copy the **Web app URL** (ends in `/exec`) and paste it into `js/reviews.js` where it says `PASTE_YOUR_WEB_APP_URL_HERE`.
5. Deploy the site.

### Approving reviews

Open the Sheet → **Reviews** tab → type `yes` in the **Approved** column of any row you want to show.
To hide one later, clear the cell. Changes appear on the site on the next page load.

### Changing the Apps Script later

Editing the code is not enough: Deploy → **Manage deployments** → pencil icon → Version: **New version** → Deploy.
The URL stays the same.

## Deploying the site

Static site, no build step. Connect this repo in Netlify (Site settings → Build & deploy → Link repository)
for auto-deploy on every push, or drag the folder into app.netlify.com/drop.

## Adding a new page

Copy the `<div class="topbar">` nav and `<footer>` blocks from any existing page, link `css/style.css`, add your content in between. Create the Arabic copy in `ar/` the same way (start from an existing `ar/` page, which uses `../` paths and `dir="rtl"`).
