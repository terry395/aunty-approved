/* =========================================================
   Aunty Coach chat widget · coach-widget.js
   Self-contained: everything lives inside one IIFE, all CSS
   classes start with "ac-", and nothing in script.js changes.
   - AI chat goes through /api/aunty-coach (Netlify Function),
     so the API key is never in the browser.
   - Aunty's Relative Calculator runs right here in the browser
     (JS port of aunty-coach/calculator.py), works with no key.
   Opens from any [data-open-chat] button via
   window.openAuntyCoachWidget (see openAuntyCoach in script.js).
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     Messages (same as aunty-coach/aunty_coach.py)
     --------------------------------------------------------- */
  var API_URL = "/api/aunty-coach";
  var WELCOME = "Gong Xi Fa Cai! Aunty Coach here 👋 First time bai nian at their house? " +
    "Don't worry lah, Aunty got you. Ask me about kits, prices or delivery, " +
    "or type calculator to find out what to call every relative. What you want to know?";
  var CALC_INTRO = "Okay, Aunty's Relative Calculator! Start from your partner, then pick one person at a time. " +
    "Example: Dad → Older brother → Wife = what to call his wife.";
  var FALLBACK = "Aiyoh, good question! Aunty don't want to anyhow say. Please email hello@auntyapproved.sg " +
    "and the team will reply within 1 working day, okay?";
  var OFFLINE = FALLBACK + "\n\n(Aunty's chat brain is resting right now, but the Relative Calculator still works. Type calculator!)";
  var MAX_CHARS = 500;
  var STORE_KEY = "auntyCoachChat.v1";

  /* =========================================================
     AUNTY'S RELATIVE CALCULATOR (port of calculator.py)
     ========================================================= */
  var Calc = (function () {
    var BUTTONS = ["Dad", "Mum", "Older brother", "Younger brother", "Older sister",
      "Younger sister", "Husband", "Wife", "Daughter", "Son", "Start over", "Done"];

    var MAP = { "Dad": "f", "Mum": "m", "Older brother": "ob", "Younger brother": "yb",
      "Older sister": "os", "Younger sister": "ys", "Husband": "h", "Wife": "w",
      "Son": "s", "Daughter": "d" };

    var NAME = { f: "dad", m: "mum", ob: "older brother", yb: "younger brother",
      os: "older sister", ys: "younger sister", h: "husband", w: "wife",
      s: "son", d: "daughter", bro: "brother", sis: "sister" };

    var ELDER = 'Say: "身体健康, 长命百岁!" (shēn tǐ jiàn kāng, cháng mìng bǎi suì: good health and long life)';
    var ADULT = 'Say: "恭喜发财, 万事如意!" (gōng xǐ fā cái, wàn shì rú yì)';
    var PEER = 'Say: "新年快乐!" (xīn nián kuài lè). For working cousins add "步步高升!" (bù bù gāo shēng)';
    var KID = 'Kids are called by name. Say: "新年快乐, 学业进步!" (xué yè jìn bù: do well in school)';

    var T = {
      "f": ["Uncle / 叔叔 (shū shu). Your partner calls him 爸爸, but you say Uncle for now!", "Uncle", "Uncle", ADULT],
      "m": ["Aunty / 阿姨 (ā yí). Your partner calls her 妈妈, but you say Aunty for now!", "Aunty", "Aunty", ADULT],
      "f,f": ["爷爷 (yé ye)", "Ah Kong", "Yeh Yeh", ELDER],
      "f,m": ["奶奶 (nǎi nai)", "Ah Ma", "Mah Mah", ELDER],
      "m,f": ["外公 (wài gōng)", "Gua Kong", "Gong Gong", ELDER],
      "m,m": ["外婆 (wài pó)", "Gua Ma", "Por Por", ELDER],
      "f,ob": ["伯伯 (bó bo)", "Ah Pek", "Ah Pak", ADULT],
      "f,ob,w": ["伯母 (bó mǔ)", "Ah Mm", "Pak Neung", ADULT],
      "f,yb": ["叔叔 (shū shu)", "Ah Chek", "Ah Suk", ADULT],
      "f,yb,w": ["婶婶 (shěn shen)", "Ah Sim", "Ah Sum", ADULT],
      "f,sis": ["姑姑 (gū gu)", "Ah Koh", "Gu Ma / Gu Jeh", ADULT],
      "f,sis,h": ["姑丈 (gū zhàng)", "Koh Tio", "Gu Jeung", ADULT],
      "m,bro": ["舅舅 (jiù jiu)", "Ah Ku", "Kau Fu", ADULT],
      "m,bro,w": ["舅妈 (jiù mā)", "Ah Kim", "Kam Mo", ADULT],
      "m,sis": ["阿姨 (ā yí)", "Ah Ee", "Ah Yi", ADULT],
      "m,sis,h": ["姨丈 (yí zhàng)", "Ee Tio", "Yi Jeung", ADULT],
      "ob": ["哥哥 (gē ge)", "Ah Hia", "Gor Gor", PEER],
      "os": ["姐姐 (jiě jie)", "Ah Chi", "Je Je", PEER],
      "yb": ["Call him by name (he is 弟弟 dì di to your partner)", "by name", "by name", PEER],
      "ys": ["Call her by name (she is 妹妹 mèi mei to your partner)", "by name", "by name", PEER],
      "bro": ["哥哥 (gē ge) if older than your partner, otherwise by name", "Ah Hia / by name", "Gor Gor / by name", PEER],
      "sis": ["姐姐 (jiě jie) if older than your partner, otherwise by name", "Ah Chi / by name", "Je Je / by name", PEER],
      "bro,w": ["嫂嫂 (sǎo sao) if her husband is older than your partner, otherwise by name", "Ah So / by name", "Ah Sou / by name", PEER],
      "sis,h": ["姐夫 (jiě fu) if his wife is older than your partner, otherwise by name", "Chi Hu / by name", "Je Fu / by name", PEER],
      "ob,w": ["嫂嫂 (sǎo sao)", "Ah So", "Ah Sou", PEER],
      "os,h": ["姐夫 (jiě fu)", "Chi Hu", "Je Fu", PEER],
      "yb,w": ["Call her by name (she is 弟媳 dì xí to your partner)", "by name", "by name", PEER],
      "ys,h": ["Call him by name (he is 妹夫 mèi fu to your partner)", "by name", "by name", PEER],
      "f,bro,s": ["堂哥 (táng gē) if older than your partner, 堂弟 (táng dì) if younger", "Ko Ko / by name", "Gor Gor / by name", PEER],
      "f,bro,d": ["堂姐 (táng jiě) if older than your partner, 堂妹 (táng mèi) if younger", "Ah Chi / by name", "Je Je / by name", PEER],
      "f,sis,s": ["表哥 (biǎo gē) if older than your partner, 表弟 (biǎo dì) if younger", "Ko Ko / by name", "Biu Gor / by name", PEER],
      "f,sis,d": ["表姐 (biǎo jiě) if older than your partner, 表妹 (biǎo mèi) if younger", "Ah Chi / by name", "Biu Je / by name", PEER],
      "m,sib,s": ["表哥 (biǎo gē) if older than your partner, 表弟 (biǎo dì) if younger", "Ko Ko / by name", "Biu Gor / by name", PEER],
      "m,sib,d": ["表姐 (biǎo jiě) if older than your partner, 表妹 (biǎo mèi) if younger", "Ah Chi / by name", "Biu Je / by name", PEER],
      "GP,pek": ["伯公 (bó gōng)", "Pek Kong", "Pak Gung", ELDER],
      "GP,pek,w": ["伯婆 (bó pó)", "Pek Poh", "Pak Po", ELDER],
      "GP,chek": ["叔公 (shū gōng)", "Chek Kong", "Suk Gung", ELDER],
      "GP,chek,w": ["婶婆 (shěn pó)", "Sim Poh", "Sum Po", ELDER],
      "GP,koh": ["姑婆 (gū pó)", "Koh Poh", "Gu Po", ELDER],
      "GP,koh,h": ["姑丈公 (gū zhàng gōng)", "Koh Tio Kong", "Gu Jeung Gung", ELDER],
      "GP,ku": ["舅公 (jiù gōng)", "Ku Kong", "Kau Gung", ELDER],
      "GP,ku,w": ["妗婆 (jìn pó)", "Kim Poh", "Kam Po", ELDER],
      "GP,ee": ["姨婆 (yí pó)", "Ee Poh", "Yi Po", ELDER],
      "GP,ee,h": ["姨丈公 (yí zhàng gōng)", "Ee Tio Kong", "Yi Jeung Gung", ELDER],
      "GGP,m": ["太公 (tài gōng)", "Ah Chor", "Tai Gung", ELDER],
      "GGP,f": ["太婆 (tài pó)", "Ah Chor", "Tai Ma", ELDER],
      "sib,s": ["Your partner's nephew: call him by name", "by name", "by name", KID],
      "sib,d": ["Your partner's niece: call her by name", "by name", "by name", KID]
    };

    var HINT = "\n\nPick another person to continue, or 'Start over' / 'Done' lor.";
    var SIBS = ["ob", "yb", "os", "ys"];
    var PAR = ["f", "m"];
    var KIDS = ["s", "d"];
    var MALE = ["f", "ob", "yb", "h", "s", "bro"];

    function has(list, x) { return list.indexOf(x) !== -1; }
    function own(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
    function names(c) { return c.map(function (x) { return NAME[x]; }).join("'s "); }

    function simplify(c) {
      var changed = true;
      while (changed) {
        changed = false;
        for (var i = 0; i < c.length - 1; i++) {
          var a = c[i], b = c[i + 1], rep = null;
          if (a === "f" && b === "w") rep = ["m"];
          else if (a === "m" && b === "h") rep = ["f"];
          else if ((has(SIBS, a) || a === "bro" || a === "sis") && has(PAR, b)) rep = [b];
          else if ((a === "w" && b === "h") || (a === "h" && b === "w")) rep = [];
          else if (has(KIDS, a) && has(PAR, b)) rep = [];
          else if (has(PAR, a) && has(KIDS, b)) rep = [b === "s" ? "bro" : "sis"];
          if (rep !== null) {
            c.splice.apply(c, [i, 2].concat(rep));
            changed = true;
            break;
          }
        }
      }
      return c;
    }

    function lookupKey(c) {
      if (c.length === 3 && c.every(function (x) { return has(PAR, x); })) {
        return "GGP," + (c[2] === "f" ? "m" : "f");
      }
      if ((c.length === 3 || c.length === 4) && has(PAR, c[0]) && has(PAR, c[1]) && has(SIBS, c[2])) {
        var s = c[2], gp;
        if (c[1] === "f") gp = s === "ob" ? "pek" : (s === "yb" ? "chek" : "koh");
        else gp = (s === "ob" || s === "yb") ? "ku" : "ee";
        return "GP," + gp + (c.length === 4 ? "," + c[3] : "");
      }
      var n = [];
      for (var i = 0; i < c.length; i++) {
        var x = c[i];
        if (i === 1 && c[0] === "f" && (x === "os" || x === "ys")) x = "sis";
        else if (i === 1 && c[0] === "f" && (x === "ob" || x === "yb") && c.length === 3 && has(KIDS, c[2])) x = "bro";
        else if (i === 1 && c[0] === "m" && (x === "ob" || x === "yb")) x = (c.length === 3 && has(KIDS, c[2])) ? "sib" : "bro";
        else if (i === 1 && c[0] === "m" && (x === "os" || x === "ys")) x = (c.length === 3 && has(KIDS, c[2])) ? "sib" : "sis";
        else if (i === 0 && (has(SIBS, x) || x === "bro" || x === "sis") && c.length === 2 && has(KIDS, c[1])) x = "sib";
        n.push(x);
      }
      return n.join(",");
    }

    function figureOut(c) {
      var male = has(MALE, c[c.length - 1]);
      var gen = 0;
      c.forEach(function (x) { if (has(PAR, x)) gen += 1; if (has(KIDS, x)) gen -= 1; });

      var sp = -1;
      for (var i = 0; i < c.length - 1; i++) { if (c[i] === "h" || c[i] === "w") { sp = i; break; } }

      var a;
      if (gen >= 3) a = male ? ["太公 (tài gōng)", "Ah Chor", "Tai Gung", ELDER] : ["太婆 (tài pó)", "Ah Chor", "Tai Ma", ELDER];
      else if (gen === 2) a = male ? ["公公 (gōng gong)", "Ah Kong", "Ah Gung", ELDER] : ["婆婆 (pó po)", "Ah Ma", "Ah Por", ELDER];
      else if (gen === 1) a = male
        ? ["Uncle / 叔叔 (shū shu), or 伯伯 (bó bo) if he looks older than your partner's dad", "Uncle / Ah Pek", "Uncle / Ah Suk", ADULT]
        : ["Aunty / 阿姨 (ā yí)", "Aunty / Ah Ee", "Aunty / Ah Yi", ADULT];
      else if (gen === 0) a = male
        ? ["哥哥 (gē ge) if he is older than you, otherwise by name", "Ko Ko / by name", "Gor Gor / by name", PEER]
        : ["姐姐 (jiě jie) if she is older than you, otherwise by name", "Ah Chi / by name", "Je Je / by name", PEER];
      else a = ["Call " + (male ? "him" : "her") + " by name", "by name", "by name", KID];

      var intro;
      if (sp >= 0) {
        var owner = "your partner's " + names(c.slice(0, sp + 1));
        intro = "Not blood family lah, " + (male ? "he" : "she") + " is from " + owner + "'s side.";
        if (sp === c.length - 2 && has(PAR, c[c.length - 1])) {
          intro += " The family calls " + (male ? "him" : "her") + " 亲家 (qìng jia), the in-law side.";
        }
        intro += " Just go by age, Aunty suggests:";
      } else {
        intro = "Got a proper title for this one, but even Aunty must count fingers! Most families just go by age:";
      }
      return [intro, a];
    }

    function newState() { return { chain: "", calcDone: "no" }; }

    function relativeCalculator(pick, state) {
      pick = String(pick == null ? "" : pick).trim();
      state.calcDone = "no";

      if (/start over/i.test(pick)) {
        state.chain = "";
        return "Okay, start again lah! Who is it to your partner? Pick the first person.";
      }
      if (/done/i.test(pick)) {
        state.chain = "";
        state.calcDone = "yes";
        return "Steady! Remember hor, greet the eldest first and pass the oranges with two hands. Ask Aunty anything else. Huat ah!";
      }
      if (!state.chain && has(["Husband", "Wife", "Son", "Daughter"], pick)) {
        return "Eh, start with your partner's parent or sibling first lah, like Dad, Mum or Older sister.";
      }
      if (!own(MAP, pick)) {
        return "Aiyoh, Aunty catch no ball leh. Pick one from the list can?";
      }

      var chain = (state.chain ? state.chain.split(",") : []).concat([MAP[pick]]);
      state.chain = chain.join(",");
      var path = "Your partner's " + names(chain);
      var c = simplify(chain.slice());

      if (chain.length > 8) {
        state.chain = "";
        return path + ": Wah, so long the chain, Aunty also pening already! Let's start over. " +
          'For anyone that far, a warm "Uncle" or "Aunty" is always safe lah.' + HINT;
      }
      if (c.length === 0) return path + ": Eh, that one is your partner (or you) leh! 😄" + HINT;
      if (c.length === 1 && (c[0] === "h" || c[0] === "w")) return path + ": Haha, that one is you lah!" + HINT;

      var same = "";
      if (c.join(",") !== chain.join(",")) same = " (that's your partner's " + names(c) + ")";

      var key = lookupKey(c);
      var r = own(T, key) ? T[key] : null;
      if (r) {
        return path + same + ":\n• Mandarin: " + r[0] + "\n• Hokkien: " + r[1] +
          "\n• Cantonese: " + r[2] + "\n" + r[3] + HINT;
      }
      var fo = figureOut(c), intro = fo[0], a = fo[1];
      return path + same + ": " + intro + "\n• Mandarin: " + a[0] + "\n• Hokkien: " + a[1] +
        "\n• Cantonese: " + a[2] + "\n" + a[3] +
        "\nWant it exact? The Meet-the-Parents Kit's personalised cheat sheet is checked by hand." + HINT;
    }

    // Accept typed names in any case, e.g. "older brother" (same as run_calculator)
    function normalisePick(text) {
      var t = String(text || "").trim();
      for (var i = 0; i < BUTTONS.length; i++) if (t.toLowerCase() === BUTTONS[i].toLowerCase()) return BUTTONS[i];
      return t;
    }

    return { BUTTONS: BUTTONS, newState: newState, relativeCalculator: relativeCalculator, normalisePick: normalisePick };
  })();

  function wantsCalculator(text) {
    var t = text.toLowerCase();
    return t.indexOf("calculator") !== -1 || t.indexOf("family tree step by step") !== -1;
  }

  // Export the calculator for tests (Node) and stop here if there is no page.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Calc: Calc, wantsCalculator: wantsCalculator };
  }
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__auntyCoachLoaded) return;   // never load twice
  window.__auntyCoachLoaded = true;

  /* =========================================================
     STATE (kept for this browser tab only)
     ========================================================= */
  var state = { history: [], log: [], calc: null };  // history = what Claude sees, log = what's on screen
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage off: fine */ }
  }
  function load() {
    try {
      var s = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      if (s && Array.isArray(s.history) && Array.isArray(s.log)) state = s;
    } catch (e) { /* ignore */ }
  }

  /* =========================================================
     BUILD THE UI (all text via textContent, never innerHTML)
     ========================================================= */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var launcher, panel, list, form, input, sendBtn, chips, typing;
  var busy = false, lastFocus = null;

  function build() {
    launcher = el("button", "ac-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Chat with Aunty Coach");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "acPanel");
    launcher.appendChild(el("span", "ac-launcher-icon", "🍊")).setAttribute("aria-hidden", "true");
    launcher.appendChild(el("span", "ac-launcher-text", "Ask Aunty"));

    panel = el("section", "ac-panel");
    panel.id = "acPanel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "acTitle");

    var head = el("header", "ac-head");
    var avatar = el("span", "ac-avatar", "🍊");
    avatar.setAttribute("aria-hidden", "true");
    var titles = el("div", "ac-titles");
    var title = el("h2", "ac-title", "Aunty Coach");
    title.id = "acTitle";
    titles.appendChild(title);
    titles.appendChild(el("p", "ac-sub", "Kits, delivery & what to call everyone"));
    var reset = el("button", "ac-icon-btn", "↺");
    reset.type = "button";
    reset.title = "Start a new chat";
    reset.setAttribute("aria-label", "Start a new chat");
    reset.addEventListener("click", resetChat);
    var close = el("button", "ac-icon-btn", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    close.addEventListener("click", closePanel);
    head.appendChild(avatar); head.appendChild(titles); head.appendChild(reset); head.appendChild(close);

    list = el("div", "ac-list");
    list.setAttribute("role", "log");
    list.setAttribute("aria-live", "polite");
    list.setAttribute("aria-relevant", "additions");
    list.tabIndex = 0;

    typing = el("div", "ac-msg ac-aunty ac-typing");
    typing.setAttribute("aria-label", "Aunty is typing");
    typing.appendChild(el("span")); typing.appendChild(el("span")); typing.appendChild(el("span"));

    chips = el("div", "ac-chips");

    form = el("form", "ac-form");
    form.setAttribute("autocomplete", "off");
    var label = el("label", "sr-only", "Message Aunty Coach");
    label.setAttribute("for", "acInput");
    input = el("input", "ac-input");
    input.id = "acInput";
    input.type = "text";
    input.maxLength = MAX_CHARS;
    input.placeholder = "Ask Aunty anything…";
    input.setAttribute("enterkeyhint", "send");
    sendBtn = el("button", "ac-send", "Send");
    sendBtn.type = "submit";
    form.appendChild(label); form.appendChild(input); form.appendChild(sendBtn);
    form.addEventListener("submit", function (e) { e.preventDefault(); onSend(input.value); });

    panel.appendChild(head);
    panel.appendChild(list);
    panel.appendChild(chips);
    panel.appendChild(form);
    panel.appendChild(el("p", "ac-foot", "AI helper. Don't share passwords or card details. Payments on this site are demo only."));

    launcher.addEventListener("click", function () { panel.hidden ? openPanel() : closePanel(); });
    document.addEventListener("keydown", function (e) {
      // Escape closes the chat, unless a site dialog (cart, product, policy) is open on top
      if (e.key === "Escape" && !panel.hidden && !document.querySelector("dialog[open]")) closePanel();
    });

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
  }

  // Light, safe formatting: **bold** becomes <strong>, everything else is plain text
  function fillText(node, text) {
    String(text).split(/(\*\*[^*\n]+\*\*)/g).forEach(function (part) {
      if (/^\*\*[^*\n]+\*\*$/.test(part)) node.appendChild(el("strong", null, part.slice(2, -2)));
      else if (part) node.appendChild(document.createTextNode(part));
    });
  }

  function renderMsg(who, text) {
    var m = el("div", "ac-msg " + (who === "you" ? "ac-you" : "ac-aunty"));
    var sr = el("span", "sr-only", who === "you" ? "You: " : "Aunty: ");
    m.appendChild(sr);
    fillText(m, text);
    list.appendChild(m);
    list.scrollTop = list.scrollHeight;
  }

  function addMsg(who, text) {
    state.log.push({ who: who, text: text });
    if (state.log.length > 80) state.log = state.log.slice(-80);
    renderMsg(who, text);
    save();
  }

  function setChips(labels, onPick) {
    chips.textContent = "";
    labels.forEach(function (t) {
      var b = el("button", "ac-chip" + (t === "Done" ? " ac-chip-done" : t === "Start over" ? " ac-chip-muted" : ""), t);
      b.type = "button";
      b.addEventListener("click", function () { onPick(t); });
      chips.appendChild(b);
    });
    chips.hidden = labels.length === 0;
  }

  var STARTERS = ["What's in each kit?", "Is delivery free?", "Relative calculator"];
  function refreshChips() {
    if (state.calc) setChips(Calc.BUTTONS, function (t) { onSend(t); });
    else if (state.history.length === 0) setChips(STARTERS, function (t) { onSend(t); });
    else setChips([], null);
  }

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    input.setAttribute("aria-busy", on ? "true" : "false");
    if (on) { list.appendChild(typing); list.scrollTop = list.scrollHeight; }
    else if (typing.parentNode) typing.parentNode.removeChild(typing);
  }

  /* =========================================================
     CHAT LOGIC (mirrors main() in aunty_coach.py)
     ========================================================= */
  function onSend(raw) {
    var text = String(raw || "").trim().slice(0, MAX_CHARS);
    if (!text || busy) return;
    input.value = "";

    // In the calculator: every message is a pick
    if (state.calc) {
      var pick = Calc.normalisePick(text);
      addMsg("you", pick);
      addMsg("aunty", Calc.relativeCalculator(pick, state.calc));
      if (state.calc.calcDone === "yes") {
        state.calc = null;
        // let the AI know what happened so the chat flows on naturally
        state.history.push({ role: "user", content: "calculator" });
        state.history.push({ role: "assistant", content: "(Customer used the Relative Calculator and tapped Done.)" });
      }
      save(); refreshChips();
      return;
    }

    addMsg("you", text);

    if (wantsCalculator(text)) {
      state.calc = Calc.newState();
      addMsg("aunty", CALC_INTRO);
      save(); refreshChips();
      return;
    }

    state.history.push({ role: "user", content: text });
    if (state.history.length > 40) state.history = state.history.slice(-40);
    save(); refreshChips();
    askAunty();
  }

  function askAunty() {
    setBusy(true);
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);

    fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: state.history.slice(-20) }),
      signal: ctrl ? ctrl.signal : undefined,
      credentials: "same-origin"
    })
      .then(function (res) {
        if (res.status === 429) return { reply: "Wah, you type faster than Aunty can think! Wait a minute and try again, okay?" };
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var reply = data && typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : FALLBACK;
        if (data && data.offline) reply = OFFLINE;
        finish(reply);
      })
      .catch(function (err) {
        console.warn("[Aunty Coach] chat unavailable:", err && err.message);
        finish(OFFLINE);
      });

    function finish(reply) {
      clearTimeout(timer);
      setBusy(false);
      state.history.push({ role: "assistant", content: reply });
      addMsg("aunty", reply);
      refreshChips();
      if (!panel.hidden) input.focus({ preventScroll: true });
    }
  }

  function resetChat() {
    if (busy) return;
    state = { history: [], log: [], calc: null };
    list.textContent = "";
    addMsg("aunty", WELCOME);
    refreshChips();
    input.focus();
  }

  /* =========================================================
     OPEN / CLOSE
     ========================================================= */
  function openPanel() {
    if (!panel.hidden) { input.focus(); return; }
    lastFocus = document.activeElement;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("ac-open");
    list.scrollTop = list.scrollHeight;
    input.focus({ preventScroll: true });
  }

  function closePanel() {
    if (panel.hidden) return;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("ac-open");
    var back = lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : launcher;
    back.focus({ preventScroll: true });
  }

  function init() {
    load();
    build();
    if (state.log.length === 0) addMsg("aunty", WELCOME);
    else state.log.forEach(function (m) { renderMsg(m.who, m.text); });
    refreshChips();
    window.openAuntyCoachWidget = openPanel;
    window.AuntyCoach = { open: openPanel, close: closePanel };
  }

  // Expose the opener right away so early clicks never hit the "getting ready" message
  window.openAuntyCoachWidget = function () {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { openPanel(); });
    else openPanel();
  };

  function safeInit() {
    try { init(); } catch (e) {
      // If anything goes wrong, leave the rest of the website untouched
      console.warn("[Aunty Coach] widget failed to start:", e);
      try { delete window.openAuntyCoachWidget; delete window.AuntyCoach; } catch (e2) { window.openAuntyCoachWidget = undefined; }
      if (launcher && launcher.parentNode) launcher.parentNode.removeChild(launcher);
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeInit);
  else safeInit();
})();
