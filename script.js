/* =========================================================
   Aunty Approved · script.js
   Plain vanilla JS, no frameworks, no build step.
   ========================================================= */

/* ---------------------------------------------------------
   ✏️  WHERE ORDERS GO
   Paste your Google Apps Script web app URL here (see README).
   While it is the placeholder, the site runs in DEMO MODE:
   orders are logged to the browser console instead of being sent.
   --------------------------------------------------------- */
const ORDERS_SHEET_URL = "https://script.google.com/macros/s/AKfycbyZYkd2tGEslZVIkJvzMpGr6YhBwJdh2IOiw_lPb3tWv8LPyq-G-j1OaSTAuoLlYbEnTQ/exec";

/* ---------------------------------------------------------
   ✏️  EDIT EVERYTHING HERE: products, prices, dates, delivery.
   All dates/times are Singapore time (UTC+8). Keep the "+08:00".
   --------------------------------------------------------- */
const CONFIG = {
  currency: "SGD",

  dates: {
    cnyDay1: "2027-02-06T00:00:00+08:00",        // countdown target
    earlyBirdEnds: "2026-12-31T23:59:59+08:00",  // early-bird → usual prices after this
    orderCutoff: "2027-01-30T23:59:59+08:00",    // orders close after this
    deliveryWindowStart: "2027-01-26",           // first delivery date offered
    lastDeliveryDate: "2027-02-03",              // last delivery date offered
    minLeadDays: 2,                              // earliest date = today + this many days
    freeCancellationUntil: "25 Jan 2027"
  },

  delivery: {
    fee: 4.90,            // flat island-wide delivery fee
    freeThreshold: 50     // free delivery when subtotal (after early-bird) ≥ this
  },

  payment: {
    demoUen: "[DEMO-UEN-000000000X]",   // fake placeholder, NOT a real UEN
    timerMinutes: 10
  },

  maxQtyPerItem: 10,

  // Testing helper: add ?now=2027-01-05T12:00 to the URL to pretend it's that
  // date/time in Singapore (checks early-bird switch and order cut-off).
  // Set to false before launch if you don't want this.
  allowTimeTravel: true,

  products: [
    {
      id: "starter",
      name: "Starter Kit",
      tagline: "The essentials, so you don't walk in empty-handed.",
      earlyBirdPrice: 15,
      usualPrice: 18,
      image: "assets/starter-kit.jpg",   // swap for another file in assets/ any time
      imageAlt: "Starter Kit: a fan of red packets with a gold goat design, next to a folded red pocket cheat sheet",
      popular: false,
      needsPersonalisation: false,
      contents: [
        "Goat-year red packets (pack of 10)",
        "Pocket cheat sheet: relative titles + greetings with pinyin",
        "\"What not to say\" list, so you dodge the awkward moments"
      ],
      personalised: "Nothing personalised. The cheat sheet covers the most common relatives and CNY greetings."
    },
    {
      id: "classic",
      name: "Classic Kit",
      tagline: "Everything you need to bai nian like a pro.",
      earlyBirdPrice: 32,
      usualPrice: 38,
      image: "assets/classic-kit.jpg",
      imageAlt: "Classic Kit: goat red packets, a pocket cheat sheet, a pair of mandarin oranges in a red gift bag and an open gold goodies tin",
      popular: true,
      needsPersonalisation: false,
      contents: [
        "Everything in the Starter Kit",
        "A pair of mandarin oranges in a red gift bag",
        "Small goodies tin for the family"
      ],
      personalised: "Nothing personalised. Uses the standard cheat sheet."
    },
    {
      id: "mtp",
      name: "Meet-the-Parents Kit",
      tagline: "For when it really, really matters.",
      earlyBirdPrice: 58,
      usualPrice: 68,
      image: "assets/meet-the-parent-kit.jpg",
      imageAlt: "Meet-the-Parents Kit: a red premium gift box with a pair of mandarin oranges, greeting card, goodies tins, goat red packets and a personalised family-tree cheat sheet",
      popular: false,
      needsPersonalisation: true,
      contents: [
        "Everything in the Classic Kit",
        "Premium goodies",
        "Personalised cheat sheet built from your partner's actual family tree and dialect",
        "Greeting card"
      ],
      personalised: "Your cheat sheet is built from your partner's family tree and dialect (Hokkien, Cantonese, Teochew or Mandarin). You'll describe the family at checkout, and we check every title by hand before printing."
    }
  ]
};

/* =========================================================
   Nothing below needs editing for day-to-day changes.
   ========================================================= */

(() => {
  "use strict";

  const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CART_KEY = "auntyApproved.cart.v1";
  const IS_DEMO_MODE = !ORDERS_SHEET_URL || ORDERS_SHEET_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const productById = (id) => CONFIG.products.find((p) => p.id === id);

  /* ---------- Time (always Singapore time) ---------- */
  let timeOffset = 0;
  if (CONFIG.allowTimeTravel) {
    const param = new URLSearchParams(location.search).get("now");
    if (param) {
      const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(param) ? param : param + (param.length <= 16 ? ":00" : "") + "+08:00";
      const target = Date.parse(iso);
      if (!Number.isNaN(target)) {
        timeOffset = target - Date.now();
        console.info("[Aunty Approved] Time travel on. Pretending SGT time is", iso);
      }
    }
  }
  const now = () => Date.now() + timeOffset;
  const T = {
    cny: Date.parse(CONFIG.dates.cnyDay1),
    earlyBird: Date.parse(CONFIG.dates.earlyBirdEnds),
    cutoff: Date.parse(CONFIG.dates.orderCutoff)
  };

  /** Date object whose UTC fields equal the Singapore wall-clock time. */
  const sgtParts = (ms) => new Date(ms + SGT_OFFSET_MS);
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const prettyDate = (d) => `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const sgtTimestamp = (ms) => { const d = sgtParts(ms); return `${isoDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };

  /** "earlyBird" | "usual" | "closed" */
  const phase = () => { const t = now(); return t > T.cutoff ? "closed" : t > T.earlyBird ? "usual" : "earlyBird"; };
  const isEarlyBird = () => phase() === "earlyBird";
  const isClosed = () => phase() === "closed";

  /* ---------- Money ---------- */
  const money = (n) => "S$" + (Math.round(n * 100) / 100).toFixed(2);
  const priceOf = (p) => (isEarlyBird() ? p.earlyBirdPrice : p.usualPrice);

  /* ---------- Safe storage ---------- */
  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* storage blocked: cart lives in memory */ } },
    remove(key) { try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  };

  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* =========================================================
     CART
     ========================================================= */
  const cart = {
    items: {}, // { productId: qty }
    load() {
      try {
        const raw = JSON.parse(store.get(CART_KEY) || "{}");
        if (raw && typeof raw === "object") {
          for (const [id, q] of Object.entries(raw)) {
            const qty = Math.min(CONFIG.maxQtyPerItem, Math.max(0, parseInt(q, 10) || 0));
            if (productById(id) && qty > 0) this.items[id] = qty;
          }
        }
      } catch (e) { this.items = {}; }
    },
    save() { store.set(CART_KEY, JSON.stringify(this.items)); },
    add(id, qty) { this.set(id, (this.items[id] || 0) + qty); },
    set(id, qty) {
      qty = Math.min(CONFIG.maxQtyPerItem, Math.max(0, qty));
      if (qty === 0) delete this.items[id]; else this.items[id] = qty;
      this.save();
      onCartChange();
    },
    clear() { this.items = {}; store.remove(CART_KEY); onCartChange(); },
    lines() {
      return CONFIG.products.filter((p) => this.items[p.id]).map((p) => ({
        product: p, qty: this.items[p.id], unit: priceOf(p), lineTotal: priceOf(p) * this.items[p.id]
      }));
    },
    count() { return Object.values(this.items).reduce((a, b) => a + b, 0); },
    needsPersonalisation() { return this.lines().some((l) => l.product.needsPersonalisation); },
    totals() {
      const lines = this.lines();
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      const savings = isEarlyBird() ? lines.reduce((s, l) => s + (l.product.usualPrice - l.product.earlyBirdPrice) * l.qty, 0) : 0;
      const delivery = subtotal === 0 || subtotal >= CONFIG.delivery.freeThreshold ? 0 : CONFIG.delivery.fee;
      return { subtotal, savings, delivery, total: subtotal + delivery, toFree: Math.max(0, CONFIG.delivery.freeThreshold - subtotal) };
    }
  };

  /* =========================================================
     DIALOG HELPER (focus trap, Esc, backdrop click, focus restore)
     ========================================================= */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  const openers = new WeakMap();

  function openDialog(dlg, opener) {
    if (dlg.open) return;
    openers.set(dlg, opener || document.activeElement);
    dlg.classList.remove("closing");
    dlg.showModal();
    const first = $("[data-autofocus]", dlg) || $$(FOCUSABLE, dlg).find((el) => el.offsetParent !== null);
    if (first) first.focus();
  }
  function closeDialog(dlg) {
    if (!dlg.open) return;
    const finish = () => {
      dlg.classList.remove("closing");
      dlg.close();
      const back = openers.get(dlg);
      if (back && document.contains(back) && typeof back.focus === "function") back.focus();
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (dlg.classList.contains("drawer") && !reduce) {
      dlg.classList.add("closing");
      setTimeout(finish, 190);
    } else finish();
  }
  $$("dialog").forEach((dlg) => {
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(dlg); }); // Esc
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) closeDialog(dlg);           // backdrop click
      if (e.target.closest("[data-close]")) closeDialog(dlg);
    });
    dlg.addEventListener("keydown", (e) => {            // hard focus trap
      if (e.key !== "Tab") return;
      const f = $$(FOCUSABLE, dlg).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });

  /* =========================================================
     TOAST (top-centre; uses the popover top layer so it shows over dialogs)
     ========================================================= */
  const toastEl = $("#toast");
  const supportsPopover = typeof toastEl.showPopover === "function";
  if (!supportsPopover) toastEl.classList.add("no-popover");
  let toastTimer;
  function toast(msg, ms = 2600) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    if (supportsPopover) {
      try { if (toastEl.matches(":popover-open")) toastEl.hidePopover(); toastEl.showPopover(); } catch (e) { /* ignore */ }
    } else toastEl.classList.add("show");
    toastTimer = setTimeout(() => {
      if (supportsPopover) { try { toastEl.hidePopover(); } catch (e) { /* ignore */ } }
      else toastEl.classList.remove("show");
    }, ms);
  }

  /* =========================================================
     HEADER: mobile nav + cart badge
     ========================================================= */
  const navToggle = $("#navToggle"), mainNav = $("#mainNav");
  function setNav(open) {
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mainNav.classList.toggle("open", open);
  }
  navToggle.addEventListener("click", () => setNav(navToggle.getAttribute("aria-expanded") !== "true"));
  mainNav.addEventListener("click", (e) => { if (e.target.closest("a")) setNav(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && mainNav.classList.contains("open")) { setNav(false); navToggle.focus(); } });
  document.addEventListener("click", (e) => { if (mainNav.classList.contains("open") && !e.target.closest(".site-header")) setNav(false); });

  function renderCartBadge() {
    const n = cart.count();
    const badge = $("#cartCount");
    if (badge.textContent !== String(n)) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
    badge.textContent = n;
    badge.hidden = n === 0;
    $("#cartButton").setAttribute("aria-label", `Open cart, ${n} item${n === 1 ? "" : "s"}`);
  }

  /* =========================================================
     ANNOUNCEMENT BAR + COUNTDOWN + PHASE WATCHER
     ========================================================= */
  function renderAnnouncement() {
    const p = phase();
    const msg =
      p === "earlyBird" ? `Early-bird prices till 31 Dec · Free delivery above $${CONFIG.delivery.freeThreshold}` :
      p === "usual" ? "Order by 30 Jan for guaranteed delivery before CNY" :
      "Orders have closed for CNY 2027 · Gong xi fa cai!";
    $("#announcementText").textContent = msg;
    // Ticker: two identical groups so the -50% slide loops seamlessly
    const group = `<span class="ticker-group">${Array(4).fill(`<span>${escapeHtml(msg)}</span><span class="ticker-sep">✦</span>`).join("")}</span>`;
    $("#tickerTrack").innerHTML = group + group;
    $("#shopLead").textContent =
      p === "earlyBird" ? "Early-bird prices till 31 Dec. Every kit is delivered to your door before CNY." :
      p === "usual" ? "Order by 30 Jan and every kit is delivered to your door by 3 Feb." :
      "Thank you for a wonderful CNY season!";
  }

  function renderCountdown() {
    const diff = T.cny - now();
    const box = $("#countdown");
    if (diff <= 0) {
      box.classList.add("done");
      $("#countdownLabel").textContent = "新年快乐! Happy Year of the Goat. Hope the aunties approved!";
      return;
    }
    const secs = Math.floor(diff / 1000);
    $("#cdDays").textContent = Math.floor(secs / 86400);
    $("#cdHours").textContent = pad(Math.floor((secs % 86400) / 3600));
    $("#cdMins").textContent = pad(Math.floor((secs % 3600) / 60));
    $("#cdSecs").textContent = pad(secs % 60);
  }

  let lastPhase = phase();
  function tick() {
    renderCountdown();
    const p = phase();
    if (p !== lastPhase) { lastPhase = p; renderAll(); }
  }

  /* =========================================================
     SHOP: product cards
     ========================================================= */
  function priceHtml(p) {
    if (isEarlyBird()) {
      const save = p.usualPrice - p.earlyBirdPrice;
      return `<span class="price-now">${money(p.earlyBirdPrice)}</span>
              <span class="price-was"><span class="sr-only">Usual price </span><s>${money(p.usualPrice)}</s></span>
              <span class="save-tag">Save $${save % 1 ? save.toFixed(2) : save}</span>`;
    }
    return `<span class="price-now">${money(p.usualPrice)}</span>`;
  }

  function stepperHtml(id, qty, cls = "") {
    return `<div class="stepper ${cls}" role="group" aria-label="Quantity">
      <button type="button" data-step="-1" aria-label="Decrease quantity" ${qty <= 1 ? "disabled" : ""}>−</button>
      <span class="qty" aria-live="polite" data-qty>${qty}</span>
      <button type="button" data-step="1" aria-label="Increase quantity" ${qty >= CONFIG.maxQtyPerItem ? "disabled" : ""}>+</button>
    </div>`;
  }

  function renderProducts() {
    const closed = isClosed();
    $("#shopClosed").hidden = !closed;
    $("#productGrid").innerHTML = CONFIG.products.map((p) => `
      <article class="product-card ${p.popular ? "popular" : ""}" data-id="${p.id}" aria-labelledby="pt-${p.id}">
        ${p.popular ? `<span class="ribbon">Most popular</span>` : ""}
        <div class="product-media">
          ${p.popular ? `<svg class="card-stamp" role="img" aria-label="Aunty Approved stamp"><use href="#stamp-badge"/></svg>` : ""}
          <!-- ${escapeHtml(p.image)} (replace with your AI-generated image) -->
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.imageAlt)}" width="1200" height="1200" loading="lazy">
        </div>
        <div class="product-body">
          <h3 id="pt-${p.id}">${escapeHtml(p.name)}</h3>
          <p class="tagline">${escapeHtml(p.tagline)}</p>
          <div class="price-row">${priceHtml(p)}</div>
          <button type="button" class="link-btn view-details" data-details="${p.id}" aria-haspopup="dialog">View details<span class="sr-only"> of ${escapeHtml(p.name)}</span></button>
          <div class="product-actions">
            ${stepperHtml(p.id, 1)}
            <button type="button" class="btn btn-primary" data-add="${p.id}" ${closed ? "disabled" : ""}>${closed ? "Orders closed" : "Add to cart"}</button>
          </div>
        </div>
      </article>`).join("");
  }

  // Card + modal steppers (local qty before adding)
  document.addEventListener("click", (e) => {
    const stepBtn = e.target.closest(".product-card .stepper button, #productModal .stepper button");
    if (stepBtn) {
      const stepper = stepBtn.closest(".stepper");
      const qtyEl = $("[data-qty]", stepper);
      const q = Math.min(CONFIG.maxQtyPerItem, Math.max(1, (parseInt(qtyEl.textContent, 10) || 1) + Number(stepBtn.dataset.step)));
      qtyEl.textContent = q;
      $('[data-step="-1"]', stepper).disabled = q <= 1;
      $('[data-step="1"]', stepper).disabled = q >= CONFIG.maxQtyPerItem;
      return;
    }
    const addBtn = e.target.closest("[data-add]");
    if (addBtn) {
      if (isClosed()) { toast("Orders have closed for CNY 2027"); return; }
      const scope = addBtn.closest(".product-card, #productModal");
      const qty = parseInt($("[data-qty]", scope)?.textContent, 10) || 1;
      const id = addBtn.dataset.add;
      const already = cart.items[id] || 0;
      if (already >= CONFIG.maxQtyPerItem) { toast(`Max ${CONFIG.maxQtyPerItem} per kit, okay?`); return; }
      cart.add(id, qty);
      if (scope.id === "productModal") closeDialog($("#productModal"));
      // reset card stepper back to 1
      const card = $(`.product-card[data-id="${id}"]`);
      if (card) { $("[data-qty]", card).textContent = 1; $('[data-step="-1"]', card).disabled = true; $('[data-step="1"]', card).disabled = false; }
      openDialog($("#cartDrawer"), $("#cartButton"));
      toast("Added to cart!");
      return;
    }
    const detailsBtn = e.target.closest("[data-details]");
    if (detailsBtn) { openProductModal(detailsBtn.dataset.details, detailsBtn); return; }
    const policyBtn = e.target.closest("[data-policy]");
    if (policyBtn) { openPolicy(policyBtn.dataset.policy, policyBtn); return; }
    const chatBtn = e.target.closest("[data-open-chat]");
    if (chatBtn) { openAuntyCoach(); }
  });

  /* ---------- Product detail modal ---------- */
  function openProductModal(id, opener) {
    const p = productById(id);
    if (!p) return;
    const closed = isClosed();
    const modal = $("#productModal");
    modal.classList.add("wide");
    $("#productModalBody").innerHTML = `
      <div class="pm-grid">
        <div>
          <div class="pm-media"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.imageAlt)}" width="1200" height="1200"></div>
          <p class="img-note">Illustration only. Actual items may differ slightly.</p>
        </div>
        <div>
          ${p.popular ? `<p class="eyebrow">★ Most popular</p>` : ""}
          <h2 id="pmTitle">${escapeHtml(p.name)}</h2>
          <p class="tagline">${escapeHtml(p.tagline)}</p>
          <div class="price-row" style="margin:10px 0 14px">${priceHtml(p)}</div>
          <h3>What's inside</h3>
          <ul class="pm-list">${p.contents.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
          <div class="pm-personal"><h4>What's personalised?</h4><p>${escapeHtml(p.personalised)}</p></div>
          <div class="product-actions">
            ${stepperHtml(p.id, 1)}
            <button type="button" class="btn btn-primary" data-add="${p.id}" ${closed ? "disabled" : ""}>${closed ? "Orders closed" : "Add to cart"}</button>
          </div>
        </div>
      </div>`;
    openDialog(modal, opener);
  }

  /* ---------- Policy modal ---------- */
  function openPolicy(name, opener) {
    const tpl = $(`#tpl-${name}`);
    if (!tpl) return;
    const body = $("#policyBody");
    body.innerHTML = "";
    body.appendChild(tpl.content.cloneNode(true));
    openDialog($("#policyModal"), opener);
    $("#policyModal .modal-inner").scrollTop = 0;
  }

  /* =========================================================
     CART DRAWER
     ========================================================= */
  function totalsHtml(t, { showFreeBar = true } = {}) {
    const pct = Math.min(100, (t.subtotal / CONFIG.delivery.freeThreshold) * 100);
    return `
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
        ${t.savings > 0 ? `<div class="savings"><dt>Early-bird savings (included)</dt><dd>${money(t.savings)}</dd></div>` : ""}
        <div><dt>Delivery</dt><dd>${t.delivery === 0 ? "FREE" : money(t.delivery)}</dd></div>
        <div class="grand"><dt>Total</dt><dd>${money(t.total)}</dd></div>
      </dl>
      ${showFreeBar ? `
      <p class="free-note ${t.toFree === 0 ? "unlocked" : ""}">${t.toFree === 0
        ? "🎉 You've unlocked free delivery!"
        : `Free delivery for orders $${CONFIG.delivery.freeThreshold} and above. Add <strong>${money(t.toFree)}</strong> more for free delivery.`}</p>
      <div class="free-bar" role="progressbar" aria-label="Progress to free delivery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct}%"></span></div>` : ""}`;
  }

  function renderCartDrawer() {
    const lines = cart.lines();
    const body = $("#cartBody"), foot = $("#cartFoot");
    if (!lines.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <img class="empty-art" src="assets/starter-kit.jpg" alt="">
          <p><strong>Your cart is empty leh.</strong><br>Don't go bai nian empty-handed!</p>
          <a class="btn btn-primary" href="#shop" data-close>Shop the kits</a>
        </div>`;
      foot.innerHTML = "";
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    body.innerHTML = `<ul class="line-items">${lines.map((l) => `
      <li class="line-item" data-id="${l.product.id}">
        <img src="${escapeHtml(l.product.image)}" alt="">
        <div>
          <div class="li-name">${escapeHtml(l.product.name)}</div>
          <div class="li-unit">${money(l.unit)} each</div>
          <div class="li-controls">
            <div class="stepper sm" role="group" aria-label="Quantity for ${escapeHtml(l.product.name)}">
              <button type="button" data-cart-step="-1" aria-label="Decrease ${escapeHtml(l.product.name)} quantity" ${l.qty <= 1 ? "disabled" : ""}>−</button>
              <span class="qty">${l.qty}</span>
              <button type="button" data-cart-step="1" aria-label="Increase ${escapeHtml(l.product.name)} quantity" ${l.qty >= CONFIG.maxQtyPerItem ? "disabled" : ""}>+</button>
            </div>
            <button type="button" class="remove-btn" data-remove aria-label="Remove ${escapeHtml(l.product.name)} from cart">Remove</button>
          </div>
        </div>
        <div class="li-total">${money(l.lineTotal)}</div>
      </li>`).join("")}</ul>`;
    const closed = isClosed();
    foot.innerHTML = `${totalsHtml(cart.totals())}
      <button type="button" class="btn btn-primary btn-lg" id="drawerCheckout" ${closed ? "disabled" : ""}>${closed ? "Orders have closed" : "Checkout"}</button>`;
  }

  $("#cartButton").addEventListener("click", (e) => openDialog($("#cartDrawer"), e.currentTarget));
  $("#cartDrawer").addEventListener("click", (e) => {
    const li = e.target.closest(".line-item");
    if (li) {
      const id = li.dataset.id;
      const stepBtn = e.target.closest("[data-cart-step]");
      if (stepBtn) {
        cart.set(id, (cart.items[id] || 0) + Number(stepBtn.dataset.cartStep));
        // keep focus on the same control after re-render
        const sel = `.line-item[data-id="${id}"] [data-cart-step="${stepBtn.dataset.cartStep}"]`;
        const again = $(sel);
        if (again && !again.disabled) again.focus(); else $(`.line-item[data-id="${id}"] .qty`)?.closest(".stepper")?.querySelector("button:not(:disabled)")?.focus();
        return;
      }
      if (e.target.closest("[data-remove]")) {
        const name = productById(id).name;
        cart.set(id, 0);
        toast(`${name} removed`);
        ($(".line-item [data-remove]") || $("#cartDrawer [data-close]")).focus();
        return;
      }
    }
    if (e.target.closest("#drawerCheckout")) {
      closeDialog($("#cartDrawer"));
      setTimeout(() => goToCheckout(), 220);
    }
  });

  /* =========================================================
     CHECKOUT
     ========================================================= */
  const form = $("#checkoutForm");
  const STEP_LABELS = { details: "Details", delivery: "Delivery", personalise: "Personalise", review: "Review", payment: "Pay" };
  let currentStep = "details";
  let orderNumber = null;
  let lastOrder = null;
  let payTimerEnd = 0;
  let submitting = false;

  const activeSteps = () => ["details", "delivery", ...(cart.needsPersonalisation() ? ["personalise"] : []), "review", "payment"];

  function renderCheckoutState() {
    const closed = isClosed();
    const empty = cart.count() === 0;
    const done = !$("#confirmation").hidden;
    if (done) { $("#checkoutClosed").hidden = true; $("#checkoutEmpty").hidden = true; $("#checkoutFlow").hidden = true; return; }
    $("#checkoutClosed").hidden = !closed;
    $("#checkoutEmpty").hidden = closed || !empty;
    $("#checkoutFlow").hidden = closed || empty;
    if (!closed && !empty) {
      if (!activeSteps().includes(currentStep)) currentStep = "review";
      showStep(currentStep, { focus: false, scroll: false });
      renderSummary();
    }
  }

  function goToCheckout() {
    renderCheckoutState();
    const section = $("#checkout");
    section.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    const target = !$("#checkoutFlow").hidden ? $(`.step[data-step="${currentStep}"] .step-title`) : $("#checkoutTitle");
    setTimeout(() => target?.focus({ preventScroll: true }), 350);
  }

  function renderProgress() {
    const steps = activeSteps();
    const idx = steps.indexOf(currentStep);
    $("#progress").innerHTML = steps.map((s, i) =>
      `<li class="${i < idx ? "done" : i === idx ? "current" : ""}" ${i === idx ? 'aria-current="step"' : ""}><span class="sr-only">Step ${i + 1} of ${steps.length}: </span>${STEP_LABELS[s]}${i < idx ? '<span class="sr-only"> (done)</span>' : ""}</li>`
    ).join("");
  }

  function showStep(step, { focus = true, scroll = true } = {}) {
    currentStep = step;
    $$(".step", form).forEach((el) => { el.hidden = el.dataset.step !== step; });
    renderProgress();
    if (step === "review") renderReview();
    if (step === "payment") startPayment(); else stopPayTimer();
    if (scroll) $("#checkout").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (focus) setTimeout(() => $(`.step[data-step="${step}"] .step-title`)?.focus({ preventScroll: true }), scroll ? 300 : 0);
  }

  function nextStep() {
    if (!validateStep(currentStep)) return;
    const steps = activeSteps();
    showStep(steps[Math.min(steps.length - 1, steps.indexOf(currentStep) + 1)]);
  }
  function prevStep() {
    const steps = activeSteps();
    showStep(steps[Math.max(0, steps.indexOf(currentStep) - 1)]);
  }
  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]")) nextStep();
    else if (e.target.closest("[data-back]")) prevStep();
    else if (e.target.closest("[data-edit]")) showStep(e.target.closest("[data-edit]").dataset.edit);
  });
  // Enter key in an input moves to the next step instead of submitting
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input:not([type=checkbox])")) { e.preventDefault(); nextStep(); }
  });

  /* ---------- Delivery date dropdown (SGT) ---------- */
  function renderDeliveryDates() {
    const sel = $("#fDeliveryDate");
    const keep = sel.value;
    const todaySgt = sgtParts(now());
    const todayUtcMidnight = Date.UTC(todaySgt.getUTCFullYear(), todaySgt.getUTCMonth(), todaySgt.getUTCDate());
    const windowStart = Date.parse(CONFIG.dates.deliveryWindowStart + "T00:00:00Z");
    const last = Date.parse(CONFIG.dates.lastDeliveryDate + "T00:00:00Z");
    let d = Math.max(windowStart, todayUtcMidnight + CONFIG.dates.minLeadDays * DAY_MS);
    const opts = ['<option value="">Choose a date</option>'];
    for (; d <= last; d += DAY_MS) {
      const dd = new Date(d);
      opts.push(`<option value="${isoDate(dd)}">${prettyDate(dd)}</option>`);
    }
    sel.innerHTML = opts.join("");
    if (keep && $(`option[value="${keep}"]`, sel)) sel.value = keep;
  }

  /* ---------- Gift toggle + counters ---------- */
  const giftToggle = $("#fIsGift");
  giftToggle.addEventListener("change", () => {
    const on = giftToggle.checked;
    $("#giftFields").hidden = !on;
    $("#addressLabel").textContent = on ? "Recipient's delivery address" : "Delivery address";
    if (!on) ["fRecipientName", "fRecipientMobile"].forEach((id) => setError($("#" + id), ""));
  });
  const bindCounter = (input, out) => { const upd = () => { out.textContent = input.value.length; }; input.addEventListener("input", upd); upd(); };
  bindCounter($("#fGiftMessage"), $("#giftCount"));
  bindCounter($("#fFamily"), $("#familyCount"));

  /* ---------- Validation ---------- */
  const cleanMobile = (v) => v.replace(/[\s-]/g, "").replace(/^\+?65(?=\d{8}$)/, "");
  const RULES = {
    fName: (v) => !v.trim() ? "Please enter your full name." : v.trim().length < 2 ? "Name looks a bit short." : "",
    fEmail: (v) => !v.trim() ? "Please enter your email." : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "That email doesn't look right. Check again?" : "",
    fMobile: (v) => !v.trim() ? "Please enter your mobile number." : !/^[89]\d{7}$/.test(cleanMobile(v)) ? "Enter an 8-digit Singapore mobile number starting with 8 or 9." : "",
    fAddress: (v) => !v.trim() ? "Please enter the delivery address." : v.trim().length < 5 ? "Please enter the full address." : "",
    fPostal: (v) => !v.trim() ? "Please enter the postal code." : !/^\d{6}$/.test(v.trim()) ? "Singapore postal codes have 6 digits." : "",
    fDeliveryDate: (v) => !v ? "Please choose a delivery date." : "",
    fRecipientName: (v) => giftToggle.checked && !v.trim() ? "Please enter the recipient's name." : "",
    fRecipientMobile: (v) => !giftToggle.checked ? "" : !v.trim() ? "Please enter the recipient's mobile number." : !/^[89]\d{7}$/.test(cleanMobile(v)) ? "Enter an 8-digit Singapore mobile number starting with 8 or 9." : "",
    fDialect: (v) => !v ? "Please choose the family's dialect (or \"Not sure\")." : "",
    fFamily: (v) => !v.trim() ? "Tell Aunty a little about the family so we can build your cheat sheet." : v.trim().length < 10 ? "A bit more detail please, e.g. who's who on mum's and dad's side." : ""
  };
  const STEP_FIELDS = {
    details: ["fName", "fEmail", "fMobile"],
    delivery: ["fRecipientName", "fRecipientMobile", "fAddress", "fPostal", "fDeliveryDate"],
    personalise: ["fDialect", "fFamily"],
    review: [],
    payment: []
  };

  function setError(input, msg) {
    const err = $(`#${input.id}-error`);
    if (err) err.textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    const ids = [`${input.id}-hint`, `${input.id}-error`].filter((id) => document.getElementById(id) && (id.endsWith("hint") || msg));
    if (ids.length) input.setAttribute("aria-describedby", ids.join(" ")); else input.removeAttribute("aria-describedby");
  }
  function validateField(id) {
    const input = $("#" + id);
    const msg = RULES[id](input.value);
    setError(input, msg);
    return !msg;
  }
  function validateStep(step) {
    let firstBad = null;
    for (const id of STEP_FIELDS[step]) { if (!validateField(id) && !firstBad) firstBad = $("#" + id); }
    if (firstBad) { firstBad.focus(); return false; }
    return true;
  }
  // Re-validate on blur/input once a field has been flagged
  Object.keys(RULES).forEach((id) => {
    const input = $("#" + id);
    input.addEventListener("blur", () => { if (input.value) validateField(id); });
    input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") validateField(id); });
    input.addEventListener("change", () => { if (input.getAttribute("aria-invalid") === "true") validateField(id); });
    if ($(`#${id}-hint`)) input.setAttribute("aria-describedby", `${id}-hint`);
  });
  // Digits only for postal code
  $("#fPostal").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });

  /* ---------- Review ---------- */
  const val = (id) => $("#" + id).value.trim();
  function collectForm() {
    const isGift = giftToggle.checked;
    const perso = cart.needsPersonalisation();
    const dateVal = $("#fDeliveryDate").value;
    return {
      name: val("fName"), email: val("fEmail"), mobile: cleanMobile(val("fMobile")),
      address: val("fAddress"), unit: val("fUnit"), postal: val("fPostal"),
      deliveryDate: dateVal, deliveryDatePretty: dateVal ? prettyDate(new Date(Date.parse(dateVal + "T00:00:00Z"))) : "",
      isGift,
      recipientName: isGift ? val("fRecipientName") : "",
      recipientMobile: isGift ? cleanMobile(val("fRecipientMobile")) : "",
      giftMessage: isGift ? val("fGiftMessage") : "",
      dialect: perso ? $("#fDialect").value : "",
      family: perso ? val("fFamily") : "",
      marketing: $("#fMarketing").checked
    };
  }

  function itemsListHtml(lines) {
    return `<ul class="line-items">${lines.map((l) => `
      <li class="line-item"><img src="${escapeHtml(l.product.image)}" alt="">
        <div><div class="li-name">${l.qty}× ${escapeHtml(l.product.name)}</div><div class="li-unit">${money(l.unit)} each</div></div>
        <div class="li-total">${money(l.lineTotal)}</div></li>`).join("")}</ul>`;
  }

  function detailsBlocksHtml(d, { editable }) {
    const edit = (step, label) => editable ? `<button type="button" class="link-btn" data-edit="${step}">Edit<span class="sr-only"> ${label}</span></button>` : "";
    const blocks = [
      `<div class="review-block"><h4>Your details ${edit("details", "your details")}</h4>
        <p>${escapeHtml(d.name)}<br>${escapeHtml(d.email)}<br>+65 ${escapeHtml(d.mobile)}</p></div>`,
      `<div class="review-block"><h4>Delivery ${edit("delivery", "delivery")}</h4>
        <p>${d.isGift ? `<strong>Gift for ${escapeHtml(d.recipientName)}</strong> (+65 ${escapeHtml(d.recipientMobile)})<br>` : ""}
        ${escapeHtml(d.address)}${d.unit ? ", " + escapeHtml(d.unit) : ""}<br>Singapore ${escapeHtml(d.postal)}<br>
        <strong>${escapeHtml(d.deliveryDatePretty)}</strong></p>
        ${d.isGift && d.giftMessage ? `<p style="margin-top:6px"><em>“${escapeHtml(d.giftMessage)}”</em></p>` : ""}</div>`
    ];
    if (d.dialect) blocks.push(`<div class="review-block"><h4>Cheat sheet personalisation ${edit("personalise", "personalisation")}</h4>
        <p><strong>Dialect:</strong> ${escapeHtml(d.dialect)}<br><strong>Family:</strong> ${escapeHtml(d.family)}</p></div>`);
    return blocks.join("");
  }

  function renderReview() {
    const d = collectForm();
    $("#reviewBlock").innerHTML = `
      <div class="review-block"><h4>Items <button type="button" class="link-btn" data-open-cart>Edit<span class="sr-only"> items</span></button></h4>
        ${itemsListHtml(cart.lines())}${totalsHtml(cart.totals(), { showFreeBar: false })}</div>
      ${detailsBlocksHtml(d, { editable: true })}`;
    updatePayButton();
  }
  $("#reviewBlock").addEventListener("click", (e) => { if (e.target.closest("[data-open-cart]")) openDialog($("#cartDrawer"), e.target.closest("button")); });

  function updatePayButton() {
    const ok = $("#fAgreeTerms").checked && $("#fAgreePdpa").checked;
    const closed = isClosed();
    $("#toPaymentBtn").disabled = !ok || closed;
    $("#toPaymentHint").hidden = ok;
    $("#reviewClosedError").textContent = closed ? "Sorry, orders have closed for CNY 2027." : "";
    if (ok) $("#fAgreeTerms-error").textContent = "";
  }
  $("#fAgreeTerms").addEventListener("change", updatePayButton);
  $("#fAgreePdpa").addEventListener("change", updatePayButton);
  $("#toPaymentBtn").addEventListener("click", () => {
    if (isClosed()) { updatePayButton(); return; }
    if (!$("#fAgreeTerms").checked || !$("#fAgreePdpa").checked) { $("#fAgreeTerms-error").textContent = "Please tick both required boxes."; return; }
    // re-check earlier steps in case something changed
    for (const s of activeSteps().slice(0, -2)) {
      if (!STEP_FIELDS[s].every((id) => !RULES[id]($("#" + id).value))) { showStep(s); setTimeout(() => validateStep(s), 320); return; }
    }
    showStep("payment");
  });

  /* ---------- Summary sidebar ---------- */
  function renderSummary() {
    const t = cart.totals();
    $("#summaryBody").innerHTML = itemsListHtml(cart.lines()) + totalsHtml(t);
    $("#summaryTotalShort").textContent = money(t.total);
  }

  /* ---------- Payment (DEMO) ---------- */
  const ORDER_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function newOrderNumber() {
    let s = "";
    const rnd = new Uint32Array(4);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(rnd) : rnd.forEach((_, i) => { rnd[i] = Math.floor(Math.random() * 1e9); });
    rnd.forEach((r) => { s += ORDER_CHARS[r % ORDER_CHARS.length]; });
    return `AA-2027-${s}`;
  }

  // Decorative QR-*style* pattern. Deliberately NOT a valid QR code:
  // only two corner markers, random dots, and a DEMO watermark over it.
  function drawFakeQr(seedStr) {
    let seed = 0;
    for (const c of seedStr) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const N = 29;
    const inFinder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8);
    let dots = "";
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (inFinder(x, y)) continue;
      if (rand() < 0.45) dots += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.42"/>`;
    }
    const finder = (x, y) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.6" fill="none" stroke="#8B0000" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".8" fill="#8B0000"/>`;
    $("#qrSvg").innerHTML = `<g fill="#C8102E">${dots}</g>${finder(0, 0)}${finder(N - 7, 0)}`;
  }

  let payTimerInterval = null;
  function startPayment() {
    if (!orderNumber) orderNumber = newOrderNumber();
    $("#payTotal").textContent = money(cart.totals().total);
    $("#payUen").textContent = CONFIG.payment.demoUen;
    $("#payRef").textContent = orderNumber;
    drawFakeQr(orderNumber);
    $("#submitError").hidden = true;
    $("#processingMsg").textContent = "";
    restartPayTimer();
  }
  function restartPayTimer() {
    payTimerEnd = Date.now() + CONFIG.payment.timerMinutes * 60000;
    $("#payTimerExpired").hidden = true;
    $("#payTimerWrap").hidden = false;
    $("#simulatePayBtn").disabled = false;
    stopPayTimer();
    renderPayTimer();
    payTimerInterval = setInterval(renderPayTimer, 1000);
  }
  function stopPayTimer() { clearInterval(payTimerInterval); payTimerInterval = null; }
  function renderPayTimer() {
    const left = Math.max(0, payTimerEnd - Date.now());
    const s = Math.ceil(left / 1000);
    $("#payTimer").textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    if (left <= 0) {
      stopPayTimer();
      $("#payTimerWrap").hidden = true;
      $("#payTimerExpired").hidden = false;
      if (!submitting) $("#simulatePayBtn").disabled = true;
    }
  }
  $("#restartTimer").addEventListener("click", restartPayTimer);

  function setLoading(on) {
    submitting = on;
    const btn = $("#simulatePayBtn");
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
    $("#payBackBtn").disabled = on;
    $(".btn-label", btn).textContent = on ? "Processing…" : "Simulate payment";
    $("#processingMsg").textContent = on ? "Processing your demo payment…" : "";
  }

  function buildOrder() {
    const d = collectForm();
    const lines = cart.lines();
    const t = cart.totals();
    return {
      timestamp: sgtTimestamp(now()),
      orderNumber,
      customerName: d.name,
      email: d.email,
      mobile: d.mobile,
      items: lines.map((l) => `${l.qty}× ${l.product.name}`).join(", "),
      subtotal: +t.subtotal.toFixed(2),
      earlyBirdSavings: +t.savings.toFixed(2),
      deliveryFee: +t.delivery.toFixed(2),
      total: +t.total.toFixed(2),
      address: d.address,
      unit: d.unit,
      postalCode: d.postal,
      deliveryDate: d.deliveryDate ? `${d.deliveryDate} (${d.deliveryDatePretty})` : "",
      isGift: d.isGift ? "Yes" : "No",
      recipientName: d.recipientName,
      recipientMobile: d.recipientMobile,
      giftMessage: d.giftMessage,
      dialect: d.dialect,
      familyDescription: d.family,
      marketingOptIn: d.marketing ? "Yes" : "No",
      paymentStatus: "DEMO – paid",
      // extra (not a sheet column) for the confirmation screen
      _lines: lines.map((l) => ({ name: l.product.name, qty: l.qty, unit: l.unit, lineTotal: l.lineTotal, image: l.product.image })),
      _form: d,
      _totals: t
    };
  }

  async function sendOrder(order) {
    const { _lines, _form, _totals, ...payload } = order;
    if (IS_DEMO_MODE) {
      console.info("[Aunty Approved] DEMO MODE: ORDERS_SHEET_URL not set, so the order was not sent. Order:", payload);
      return;
    }
    // no-cors + text/plain avoids CORS preflight with Apps Script.
    // The response is opaque; we treat "no network error" as success.
    await fetch(ORDERS_SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }

  async function placeOrder() {
    if (submitting) return;
    if (isClosed()) { toast("Orders have closed for CNY 2027"); renderCheckoutState(); return; }
    if (cart.count() === 0) { renderCheckoutState(); return; }
    $("#submitError").hidden = true;
    setLoading(true);
    const order = buildOrder();
    const started = Date.now();
    try {
      await sendOrder(order);
      const wait = Math.max(0, 2000 - (Date.now() - started)); // show "Processing…" for ~2s
      await new Promise((r) => setTimeout(r, wait));
      lastOrder = order;
      setLoading(false);
      showConfirmation(order);
    } catch (err) {
      console.error("[Aunty Approved] Order submission failed:", err);
      const wait = Math.max(0, 1200 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setLoading(false);
      $("#submitError").hidden = false;
      $("#retrySubmit").focus();
    }
  }
  $("#simulatePayBtn").addEventListener("click", placeOrder);
  $("#retrySubmit").addEventListener("click", placeOrder);

  /* ---------- Confirmation ---------- */
  function showConfirmation(order) {
    stopPayTimer();
    const d = order._form;
    $("#confirmOrderNo").textContent = order.orderNumber;
    $("#confirmBody").innerHTML = `
      <div class="review-block"><h4>Your items</h4>
        <ul class="line-items">${order._lines.map((l) => `<li class="line-item"><img src="${escapeHtml(l.image)}" alt=""><div><div class="li-name">${l.qty}× ${escapeHtml(l.name)}</div><div class="li-unit">${money(l.unit)} each</div></div><div class="li-total">${money(l.lineTotal)}</div></li>`).join("")}</ul>
        ${totalsHtml(order._totals, { showFreeBar: false })}</div>
      <div class="confirm-stack">${detailsBlocksHtml(d, { editable: false })}</div>`;
    $("#confirmEmail").innerHTML = `A confirmation email is on its way to <strong>${escapeHtml(d.email)}</strong>.`;
    $("#checkoutFlow").hidden = true;
    $("#checkoutEmpty").hidden = true;
    $("#confirmation").hidden = false;
    // clear cart + reset form for next time
    cart.clear();
    form.reset();
    $("#giftFields").hidden = true;
    $("#addressLabel").textContent = "Delivery address";
    $("#giftCount").textContent = "0"; $("#familyCount").textContent = "0";
    $$("[aria-invalid]", form).forEach((el) => el.setAttribute("aria-invalid", "false"));
    orderNumber = null;
    currentStep = "details";
    $("#checkout").scrollIntoView({ behavior: "auto", block: "start" });
    setTimeout(() => $("#confirmTitle").focus({ preventScroll: true }), 50);
  }
  $("#backToShop").addEventListener("click", () => {
    $("#confirmation").hidden = true;
    renderCheckoutState();
    $("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { const h = $("#shopTitle"); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }, 400);
  });

  /* =========================================================
     AUNTY COACH (chatbot built separately)
     Tries common widget APIs; otherwise shows a friendly message.
     If your chatbot has its own open function, set
     window.openAuntyCoachWidget = () => { ...open it... } in the embed.
     ========================================================= */
  function openAuntyCoach() {
    const w = window;
    try {
      if (typeof w.openAuntyCoachWidget === "function") { w.openAuntyCoachWidget(); return; }
      if (w.AuntyCoach && typeof w.AuntyCoach.open === "function") { w.AuntyCoach.open(); return; }
      if (w.botpress && typeof w.botpress.open === "function") { w.botpress.open(); return; }
      if (w.botpressWebChat && typeof w.botpressWebChat.sendEvent === "function") { w.botpressWebChat.sendEvent({ type: "show" }); return; }
      if (w.voiceflow && w.voiceflow.chat && typeof w.voiceflow.chat.open === "function") { w.voiceflow.chat.open(); return; }
      if (w.Tawk_API && typeof w.Tawk_API.maximize === "function") { w.Tawk_API.maximize(); return; }
      if (Array.isArray(w.$crisp)) { w.$crisp.push(["do", "chat:open"]); return; }
      if (typeof w.chatbase === "function") { w.chatbase("open"); return; }
      if (w.Intercom && typeof w.Intercom === "function") { w.Intercom("show"); return; }
    } catch (e) { console.warn("[Aunty Approved] Could not open Aunty Coach:", e); }
    // Let a custom widget listen for this event if it wants
    const evt = new CustomEvent("auntycoach:open", { cancelable: true });
    const handled = !document.dispatchEvent(evt);
    if (!handled) toast("Aunty Coach is getting ready. Come back soon!", 3200);
  }

  /* =========================================================
     RENDER ALL + INIT
     ========================================================= */
  function onCartChange() {
    renderCartBadge();
    renderCartDrawer();
    renderCheckoutState();
    if (currentStep === "review" && !$("#checkoutFlow").hidden) renderReview();
    if (currentStep === "payment" && !$("#checkoutFlow").hidden) $("#payTotal").textContent = money(cart.totals().total);
  }

  function renderAll() {
    renderAnnouncement();
    renderCountdown();
    renderProducts();
    renderDeliveryDates();
    onCartChange();
  }

  // Desktop: keep the summary open
  const desktopMq = window.matchMedia("(min-width: 1024px)");
  const syncSummary = () => { if (desktopMq.matches) $("#summaryDetails").open = true; };
  desktopMq.addEventListener?.("change", syncSummary);

  cart.load();
  renderAll();
  syncSummary();
  // On phones, start the summary collapsed so the form is visible first
  if (!desktopMq.matches) $("#summaryDetails").open = false;
  setInterval(tick, 1000);

  if (IS_DEMO_MODE) console.info("[Aunty Approved] Running in DEMO MODE. Paste your Apps Script URL into ORDERS_SHEET_URL to save orders to Google Sheets.");
})();
