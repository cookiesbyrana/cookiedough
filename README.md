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
- Spam protection (enforced in `Code.gs`, so it can't be bypassed by skipping the website):
  - At most **10 reviews per hour** and **30 per day** are accepted; more are refused with a "try again later" message.
  - At most **5 emails per hour**; after that you get one "lots of reviews" alert and the rest wait in the Sheet.
    This also keeps you under Google's ~100 emails/day limit.
  - Hidden honeypot field, submissions faster than 3 seconds, and exact duplicates are silently dropped.
  - Length limits, and visitor text is stored as plain text so it can't run as a formula.
  - All limits are settings at the top of `Code.gs`.

### One-time setup

1. Create a new Google Sheet (e.g. "Cookie Dough Reviews").
2. Extensions → Apps Script → delete the sample code → paste everything from `apps-script/Code.gs` → Save.
3. Deploy → New deployment → gear icon → **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and authorize.
   (Google shows an "unverified app" warning because it's your own script: Advanced → Go to project → Allow.)
4. Copy the **Web app URL** (ends in `/exec`) into `API_URL` at the top of `js/reviews.js` (already done for the current deployment).
5. Deploy the site.

### Approving reviews

**By email (easiest):** every new review is emailed to you (the Google account that owns the script)
with **Approve** and **Decline** buttons. Tap one, then confirm on the page that opens.
The confirm step stops email security scanners, which open links automatically, from approving or declining on their own.
To send the emails to a different address, set `NOTIFY_EMAIL` at the top of `Code.gs`.

**In the Sheet:** open the **Reviews** tab and type `yes` in the **Approved** column (or `no` to hide).
The **Token** column is the secret that makes the email buttons work. Don't edit it.

Changes appear on the site on the next page load.

### Changing the Apps Script later

Editing the code is not enough: Deploy → **Manage deployments** → pencil icon → Version: **New version** → Deploy.
The URL stays the same. If Google asks for new permissions (e.g. "Send email as you" for the review emails), allow them.

## Deploying the site

Static site, no build step. Connect this repo in Netlify (Site settings → Build & deploy → Link repository)
for auto-deploy on every push, or drag the folder into app.netlify.com/drop.

## Adding a new page

Copy the `<div class="topbar">` nav and `<footer>` blocks from any existing page, link `css/style.css`, add your content in between. Create the Arabic copy in `ar/` the same way (start from an existing `ar/` page, which uses `../` paths and `dir="rtl"`).
