/**
 * Cookie Dough by Rana — reviews backend (Google Apps Script)
 *
 * Paste this into the Apps Script editor of a Google Sheet
 * (Sheet → Extensions → Apps Script), then Deploy → New deployment → Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * The Sheet itself stays PRIVATE. The website can only:
 *   - POST a new review (saved with Approved left blank)
 *   - GET reviews where the Approved column starts with "y" (e.g. "yes")
 * Instagram handles, timestamps and unapproved reviews are never sent to the site.
 *
 * Every new review is emailed to you with Approve / Decline buttons.
 * Each review gets a secret random Token, so only the links in your email work.
 */

var SHEET_NAME = 'Reviews';
var HEADERS = ['Timestamp', 'Name', 'Rating', 'Items', 'Review', 'Instagram', 'Approved', 'Token'];
var MAX_NAME = 60;
var MAX_ITEMS = 200;
var MAX_TEXT = 800;
var MAX_IG = 40;

// Spam protection. A small bakery gets far fewer real reviews than this, so these only
// kick in if someone floods the form. Reviews over the limit are refused, not saved.
var MAX_REVIEWS_PER_HOUR = 10;
var MAX_REVIEWS_PER_DAY = 30;
// At most this many review emails per hour; after that you get ONE "lots of reviews" alert
// and the rest wait in the Sheet. Keeps your inbox (and Google's ~100 emails/day limit) safe.
var MAX_EMAILS_PER_HOUR = 5;
// Real people take longer than this to fill in the form; bots usually don't.
var MIN_FILL_SECONDS = 3;

// Where new-review emails go. Leave empty to use the Google account that owns this script.
var NOTIFY_EMAIL = '';
var SITE_URL = 'https://cookiesbyrana.netlify.app/reviews.html';

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setColumnWidth(5, 420);
  } else if (sh.getRange(1, HEADERS.length).getValue() !== HEADERS[HEADERS.length - 1]) {
    // Sheets created before email approval have no Token column yet
    sh.getRange(1, HEADERS.length).setValue(HEADERS[HEADERS.length - 1]).setFontWeight('bold');
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean_(value, maxLen) {
  var s = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return s.length > maxLen ? s.substring(0, maxLen) : s;
}

function esc_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stars_(rating) {
  var n = Math.min(5, Math.max(1, Number(rating) || 5));
  return new Array(n + 1).join('★') + new Array(6 - n).join('☆');
}

// Public: returns approved reviews only; also handles the Approve / Decline links from emails
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action) return handleDecision_(p);

  var sh = getSheet_();
  var values = sh.getDataRange().getValues();
  var head = values.shift();
  var col = function (name) { return head.indexOf(name); };

  var reviews = values
    .filter(function (r) {
      return String(r[col('Approved')]).trim().toLowerCase().indexOf('y') === 0;
    })
    .map(function (r) {
      return {
        name: String(r[col('Name')]),
        rating: Math.min(5, Math.max(1, Number(r[col('Rating')]) || 5)),
        items: String(r[col('Items')]),
        text: String(r[col('Review')])
      };
    })
    .reverse(); // newest first

  return json_({ ok: true, reviews: reviews });
}

// Public: receives a new review from the website form
function doPost(e) {
  var lock = LockService.getScriptLock();
  var saved = null;
  try {
    lock.waitLock(10000);
    var p = (e && e.parameter) || {};

    // Honeypot: real visitors never fill this hidden field.
    // Too-fast submissions are bots too. Both get a fake "ok" so they don't learn anything.
    if (p.website) return json_({ ok: true });
    if (p.elapsed && Number(p.elapsed) < MIN_FILL_SECONDS * 1000) return json_({ ok: true });

    var name = clean_(p.name, MAX_NAME);
    var text = clean_(p.review, MAX_TEXT);
    var rating = parseInt(p.rating, 10);
    if (!name || text.length < 5 || !(rating >= 1 && rating <= 5)) {
      return json_({ ok: false, error: 'invalid' });
    }

    var sh = getSheet_();
    var recent = recentActivity_(sh);
    if (recent.lastHour >= MAX_REVIEWS_PER_HOUR || recent.lastDay >= MAX_REVIEWS_PER_DAY) {
      return json_({ ok: false, error: 'busy' });
    }
    // Same text sent again (double click, or a bot repeating itself): don't store it twice
    if (recent.texts.indexOf(text.toLowerCase()) !== -1) return json_({ ok: true });

    var row = sh.getLastRow() + 1;
    var token = Utilities.getUuid();
    saved = {
      name: name, rating: rating, items: clean_(p.items, MAX_ITEMS),
      text: text, instagram: clean_(p.instagram, MAX_IG), token: token
    };
    // Store as plain text so nothing typed by a visitor can run as a formula
    sh.getRange(row, 2, 1, 5)
      .setNumberFormat('@')
      .setValues([[saved.name, saved.rating, saved.items, saved.text, saved.instagram]]);
    sh.getRange(row, 1).setValue(new Date());
    // Column 7 (Approved) is intentionally left blank: you approve from the email or the Sheet
    sh.getRange(row, 8).setValue(token);
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }

  // A failed email must never lose the review, which is already saved
  try {
    var thisHour = recent.lastHour + 1;
    if (thisHour <= MAX_EMAILS_PER_HOUR) notify_(saved);
    else if (thisHour === MAX_EMAILS_PER_HOUR + 1) notifyFlood_();
  } catch (err) { console.error('Review email failed: ' + err); }
  return json_({ ok: true });
}

// Counts recent reviews from the Sheet itself, so no extra storage is needed
function recentActivity_(sh) {
  var last = sh.getLastRow();
  var out = { lastHour: 0, lastDay: 0, texts: [] };
  if (last < 2) return out;
  var first = Math.max(2, last - 199); // the newest 200 rows are plenty
  var rows = sh.getRange(first, 1, last - first + 1, 5).getValues();
  var now = Date.now();
  rows.forEach(function (r) {
    var t = r[0] instanceof Date ? r[0].getTime() : new Date(r[0]).getTime();
    if (!isNaN(t) && now - t < 3600 * 1000) out.lastHour++;
    if (!isNaN(t) && now - t < 24 * 3600 * 1000) out.lastDay++;
    out.texts.push(String(r[4]).trim().toLowerCase());
  });
  return out;
}

function notifyFlood_() {
  MailApp.sendEmail({
    to: NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
    subject: 'Lots of new reviews on your website',
    body: 'More than ' + MAX_EMAILS_PER_HOUR + ' reviews arrived in the last hour, so review emails are paused ' +
      'until it calms down. Nothing is shown on the site until you approve it.\n\n' +
      'Open the Reviews tab in your Sheet to look through them. If they look like spam, ' +
      'just delete those rows.',
    name: 'Cookie Dough by Rana website'
  });
}

/* ---------- email approval ---------- */

function notify_(review) {
  var to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  var base = ScriptApp.getService().getUrl();
  var link = function (action) {
    return base + '?action=' + action + '&token=' + encodeURIComponent(review.token);
  };
  var button = function (href, label, color) {
    return '<a href="' + href + '" style="display:inline-block;background:' + color + ';color:#fff;' +
      'text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:100px;margin:0 6px 8px 0;">' +
      label + '</a>';
  };

  var html =
    '<div style="font-family:Arial,sans-serif;color:#3B2417;max-width:520px;">' +
      '<h2 style="margin:0 0 4px;">New review 🍪</h2>' +
      '<p style="margin:0 0 16px;color:#5A3B2A;">Someone left a review on your website.</p>' +
      '<div style="background:#FFFCF6;border:1px solid #e6d8c4;border-radius:14px;padding:18px;margin-bottom:18px;">' +
        '<div style="color:#B87F42;font-size:18px;letter-spacing:2px;">' + stars_(review.rating) + '</div>' +
        '<p dir="auto" style="font-size:15px;line-height:1.5;margin:10px 0 14px;">' + esc_(review.text) + '</p>' +
        '<div dir="auto"><b>' + esc_(review.name) + '</b></div>' +
        (review.items ? '<div style="color:#5A3B2A;font-size:13px;">Ordered: ' + esc_(review.items) + '</div>' : '') +
        (review.instagram ? '<div style="color:#5A3B2A;font-size:13px;">Instagram: ' + esc_(review.instagram) + ' (private)</div>' : '') +
      '</div>' +
      button(link('approve'), '✓ Approve', '#2E7D4F') +
      button(link('decline'), '✕ Decline', '#7E2E38') +
      '<p style="font-size:12px;color:#8a7262;margin-top:14px;">Approved reviews appear on the website straight away. ' +
      'You can change your mind later with the other button, or in the Approved column of the Sheet.</p>' +
    '</div>';

  MailApp.sendEmail({
    to: to,
    subject: 'New review from ' + review.name + ' ' + stars_(review.rating),
    htmlBody: html,
    body: review.name + ' (' + review.rating + '/5): ' + review.text +
      '\n\nApprove: ' + link('approve') + '\nDecline: ' + link('decline'),
    name: 'Cookie Dough by Rana website'
  });
}

function findRowByToken_(sh, token) {
  if (!token) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var tokens = sh.getRange(2, 8, last - 1, 1).getValues();
  for (var i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]) === token) return i + 2;
  }
  return 0;
}

function page_(title, message, extraHtml) {
  var html =
    '<div style="font-family:Arial,sans-serif;color:#3B2417;max-width:460px;margin:40px auto;padding:0 18px;text-align:center;">' +
      '<h2>' + title + '</h2><p style="color:#5A3B2A;line-height:1.5;">' + message + '</p>' + (extraHtml || '') +
    '</div>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Cookie Dough by Rana — reviews')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// The email buttons open a confirmation page first, and only the button on that page
// changes the review. Some email security scanners open every link in a message
// automatically; this stops them from approving or declining on their own.
function handleDecision_(p) {
  var action = p.action === 'approve' ? 'approve' : p.action === 'decline' ? 'decline' : '';
  var sh = getSheet_();
  var row = action ? findRowByToken_(sh, String(p.token || '')) : 0;
  if (!row) {
    return page_('Link not valid', 'This review could not be found. It may have been deleted from the Sheet.');
  }

  var values = sh.getRange(row, 1, 1, 7).getValues()[0];
  var name = esc_(values[1]);
  var verb = action === 'approve' ? 'Approve' : 'Decline';

  if (p.confirm !== '1') {
    var confirmUrl = ScriptApp.getService().getUrl() + '?action=' + action +
      '&token=' + encodeURIComponent(p.token) + '&confirm=1';
    var color = action === 'approve' ? '#2E7D4F' : '#7E2E38';
    return page_(verb + ' this review?',
      '<b>' + name + '</b> · ' + stars_(values[2]) + '<br><span dir="auto">' + esc_(values[4]) + '</span>',
      '<a href="' + confirmUrl + '" target="_top" style="display:inline-block;background:' + color +
      ';color:#fff;text-decoration:none;font-weight:bold;padding:14px 30px;border-radius:100px;margin-top:10px;">' +
      'Yes, ' + verb.toLowerCase() + '</a>');
  }

  sh.getRange(row, 7).setValue(action === 'approve' ? 'yes' : 'no');
  if (action === 'approve') {
    return page_('Approved ✓', 'The review from <b>' + name + '</b> is now on your website.',
      '<a href="' + SITE_URL + '" target="_top" style="color:#7E2E38;font-weight:bold;">See it on the site</a>');
  }
  return page_('Declined', 'The review from <b>' + name + '</b> will not be shown on your website.');
}
