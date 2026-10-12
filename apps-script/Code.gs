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
 */

var SHEET_NAME = 'Reviews';
var HEADERS = ['Timestamp', 'Name', 'Rating', 'Items', 'Review', 'Instagram', 'Approved'];
var MAX_NAME = 60;
var MAX_ITEMS = 200;
var MAX_TEXT = 800;
var MAX_IG = 40;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setColumnWidth(5, 420);
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

// Public: returns approved reviews only
function doGet() {
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
  try {
    lock.waitLock(10000);
    var p = (e && e.parameter) || {};

    // Honeypot: real visitors never fill this hidden field
    if (p.website) return json_({ ok: true });

    var name = clean_(p.name, MAX_NAME);
    var text = clean_(p.review, MAX_TEXT);
    var rating = parseInt(p.rating, 10);
    if (!name || text.length < 5 || !(rating >= 1 && rating <= 5)) {
      return json_({ ok: false, error: 'invalid' });
    }

    var sh = getSheet_();
    var row = sh.getLastRow() + 1;
    // Store as plain text so nothing typed by a visitor can run as a formula
    sh.getRange(row, 2, 1, 5)
      .setNumberFormat('@')
      .setValues([[name, rating, clean_(p.items, MAX_ITEMS), text, clean_(p.instagram, MAX_IG)]]);
    sh.getRange(row, 1).setValue(new Date());
    // Column 7 (Approved) is intentionally left blank: you approve manually

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
