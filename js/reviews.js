// Shared by every page that shows reviews (English and Arabic).
//
// Paste your published Google Sheet CSV link between the quotes below.
// Sheet → File → Share → Publish to web → CSV format → copy the pub?output=csv link.
// Only rows with "yes" in the Approved column are shown.
const SHEET_CSV_URL = "PASTE_YOUR_PUBLISHED_CSV_LINK_HERE";

// Page markup this script looks for:
//   #reviews-grid  – where review cards go. Optional attributes:
//                    data-limit="3"            show only the newest N reviews
//                    data-default-name="..."   name used when a row has none
//   #empty-state   – shown when there are no approved reviews
//   #loading-state – (optional) shown while the sheet loads

(function () {
  const grid = document.getElementById("reviews-grid");
  if (!grid) return;
  const loading = document.getElementById("loading-state");
  const empty = document.getElementById("empty-state");
  const limit = parseInt(grid.dataset.limit, 10) || 0;
  const defaultName = grid.dataset.defaultName || "Customer";

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function findKey(row, matches) {
    const keys = Object.keys(row);
    for (const m of matches) {
      const hit = keys.find(k => k.toLowerCase().includes(m));
      if (hit) return hit;
    }
    return null;
  }

  function starsFor(value) {
    if (!value) return "★★★★★";
    const filled = (value.match(/★|⭐/g) || []).length;
    if (filled > 0) return "★".repeat(filled) + "☆".repeat(Math.max(0, 5 - filled));
    const num = parseInt(value, 10);
    if (!isNaN(num)) return "★".repeat(num) + "☆".repeat(Math.max(0, 5 - num));
    return "★★★★★";
  }

  function showEmpty() {
    if (loading) loading.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
  }

  function renderReviews(rows) {
    if (!rows.length) return showEmpty();

    const sample = rows[0];
    const nameKey = findKey(sample, ["name"]);
    const ratingKey = findKey(sample, ["rate", "rating"]);
    const itemsKey = findKey(sample, ["order"]);
    const textKey = findKey(sample, ["experience", "review"]);

    // Newest submissions are at the bottom of the sheet — show them first.
    rows = rows.slice().reverse();
    if (limit) rows = rows.slice(0, limit);

    grid.innerHTML = rows.map(row => {
      const name = (nameKey && row[nameKey] && row[nameKey].trim()) || defaultName;
      const initial = name.charAt(0).toUpperCase();
      const items = (itemsKey && row[itemsKey]) ? row[itemsKey].split(",")[0].trim() : "";
      const text = (textKey && row[textKey]) ? row[textKey].trim() : "";
      const stars = starsFor(ratingKey ? row[ratingKey] : "");
      return `
        <div class="review-card">
          <div class="stars">${stars}</div>
          <p class="quote" dir="auto">${escapeHtml(text)}</p>
          <div class="who">
            <div class="avatar">${escapeHtml(initial)}</div>
            <div class="meta" dir="auto"><b>${escapeHtml(name)}</b>${escapeHtml(items)}</div>
          </div>
        </div>`;
    }).join("");

    if (loading) loading.classList.add("hidden");
    if (empty) empty.classList.add("hidden");
    grid.classList.remove("hidden");
  }

  if (!SHEET_CSV_URL || SHEET_CSV_URL.indexOf("PASTE_") === 0) return showEmpty();

  fetch(SHEET_CSV_URL)
    .then(res => res.text())
    .then(csvText => {
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      const approvedKey = findKey(parsed.data[0] || {}, ["approved", "show"]);
      const rows = approvedKey
        ? parsed.data.filter(r => (r[approvedKey] || "").trim().toLowerCase().startsWith("y"))
        : parsed.data;
      renderReviews(rows);
    })
    .catch(showEmpty);
})();
