(function () {
  "use strict";

  // Apps Script Web app URL (see apps-script/Code.gs). Redeploying as a
  // "New version" keeps this URL, so it only changes for a brand-new deployment.
  var API_URL = "https://script.google.com/macros/s/AKfycbwcbctcsusIG1_lFj6kQXVj2Wcbt3VVT1JJ3PLTCVYbFSc3JmDJ1f8trOXiU-U0B2IP/exec";
  var CONFIGURED = API_URL.indexOf("https://script.google.com/") === 0;

  // Messages in each site language (picked from <html lang="...">)
  var TEXT = {
    en: {
      customer: "Customer",
      needRating: "Please choose a star rating.",
      needName: "Please add your name.",
      needReview: "Please write a few words about your order.",
      notConnected: "Reviews aren't connected yet. Please try again later.",
      tooSoon: "You just sent a review. Please wait a minute before sending another.",
      sending: "Sending…",
      send: "Send my review",
      failed: "Something went wrong. Please check your connection and try again.",
      busy: "We're getting a lot of reviews right now. Please try again in a little while."
    },
    ar: {
      customer: "زبون",
      needRating: "من فضلك اختر عدد النجوم.",
      needName: "من فضلك أضف اسمك.",
      needReview: "من فضلك اكتب بضع كلمات عن طلبك.",
      notConnected: "التقييمات غير مفعّلة بعد. حاول مرة أخرى لاحقًا.",
      tooSoon: "لقد أرسلت تقييمًا للتو. انتظر دقيقة قبل إرسال تقييم آخر.",
      sending: "جارٍ الإرسال…",
      send: "أرسل تقييمي",
      failed: "حدث خطأ ما. تحقّق من اتصالك وحاول مرة أخرى.",
      busy: "نستقبل الكثير من التقييمات حاليًا. من فضلك حاول مرة أخرى بعد قليل."
    }
  };
  var T = TEXT[document.documentElement.lang] || TEXT.en;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text; // textContent = no HTML injection
    return node;
  }

  function show(id, on) {
    var node = document.getElementById(id);
    if (node) node.classList.toggle("hidden", !on);
  }

  /* ---------- show approved reviews ---------- */
  function buildCard(review) {
    var card = el("div", "review-card");
    var rating = Math.min(5, Math.max(1, Number(review.rating) || 5));
    card.appendChild(el("div", "stars", "★".repeat(rating) + "☆".repeat(5 - rating)));
    var quote = el("p", "quote", review.text || "");
    quote.dir = "auto"; // Arabic and English reviews each read the right way
    card.appendChild(quote);

    var who = el("div", "who");
    var name = String(review.name || T.customer);
    who.appendChild(el("div", "avatar", name.charAt(0).toUpperCase() || "R"));
    var meta = el("div", "meta");
    meta.dir = "auto";
    meta.appendChild(el("b", null, name));
    meta.appendChild(document.createTextNode(review.items || ""));
    who.appendChild(meta);
    card.appendChild(who);
    return card;
  }

  function renderReviews(list) {
    var grid = document.getElementById("reviews-grid");
    if (!grid) return;
    var limit = parseInt(grid.getAttribute("data-limit"), 10);
    if (limit > 0) list = list.slice(0, limit);

    show("loading-state", false);
    if (!list.length) {
      show("empty-state", true);
      return;
    }
    grid.innerHTML = "";
    list.forEach(function (r) { grid.appendChild(buildCard(r)); });
    show("reviews-grid", true);
  }

  function loadReviews() {
    if (!document.getElementById("reviews-grid")) return;
    if (!CONFIGURED) { renderReviews([]); return; }

    fetch(API_URL)
      .then(function (res) { return res.json(); })
      .then(function (data) { renderReviews(data && data.ok ? data.reviews || [] : []); })
      .catch(function () { renderReviews([]); });
  }

  /* ---------- review form ---------- */
  function initForm() {
    var form = document.getElementById("review-form");
    if (!form) return;

    var msg = document.getElementById("form-msg");
    var button = document.getElementById("submit-review");
    var counter = document.getElementById("char-count");
    var textarea = form.elements["review"];
    var shownAt = Date.now();

    function setMsg(text) { msg.textContent = text; msg.classList.toggle("hidden", !text); }

    if (textarea && counter) {
      textarea.addEventListener("input", function () {
        counter.textContent = textarea.value.length + " / " + textarea.maxLength;
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setMsg("");

      var name = form.elements["name"].value.trim();
      var review = form.elements["review"].value.trim();
      var ratingInput = form.querySelector('input[name="rating"]:checked');

      if (!ratingInput) { setMsg(T.needRating); return; }
      if (!name) { setMsg(T.needName); return; }
      if (review.length < 5) { setMsg(T.needReview); return; }
      if (!CONFIGURED) { setMsg(T.notConnected); return; }

      try {
        var last = Number(localStorage.getItem("cdbr_last_review") || 0);
        if (Date.now() - last < 60000) { setMsg(T.tooSoon); return; }
      } catch (e) { /* storage unavailable: ignore */ }

      var items = Array.prototype.map.call(
        form.querySelectorAll('input[name="items"]:checked'),
        function (box) { return box.value; }
      ).join(", ");

      var body = new URLSearchParams();
      body.set("name", name);
      body.set("rating", ratingInput.value);
      body.set("items", items);
      body.set("review", review);
      body.set("instagram", form.elements["instagram"].value.trim());
      body.set("website", form.elements["website"].value); // honeypot
      body.set("elapsed", String(Date.now() - shownAt)); // bots fill forms instantly

      button.disabled = true;
      button.textContent = T.sending;

      function fail(text) {
        button.disabled = false;
        button.textContent = T.send;
        setMsg(text);
      }

      fetch(API_URL, { method: "POST", body: body })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data || !data.ok) return fail(data && data.error === "busy" ? T.busy : T.failed);
          try { localStorage.setItem("cdbr_last_review", String(Date.now())); } catch (e) {}
          form.classList.add("hidden");
          show("form-thanks", true);
        })
        .catch(function () { fail(T.failed); });
    });
  }

  loadReviews();
  initForm();
})();
