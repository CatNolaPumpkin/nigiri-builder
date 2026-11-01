/* Shared helpers for the Lennox Game Space academies: tabs, quizzes, flashcards, sounds, saving. */
const LG = (() => {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("lgs-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("lgs-" + k, JSON.stringify(v)); } catch (e) {} }
  };
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ctx;
  function tone(f, d = .1, type = "triangle", vol = .14) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d + .1);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + d + .12);
    } catch (e) {}
  }
  const happy = () => [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, .12), i * 110));
  const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .14), i * 130));
  const sad = () => tone(220, .2);
  const click = () => tone(660, .04, "sine", .08);

  function confetti(n = 30, cols = ["#f2b134", "#f4895f", "#8fbf4a", "#fbf7ef", "#5aa9e6", "#d1495b"]) {
    if (reduce()) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement("div"); c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw"; c.style.background = pick(cols); c.style.animationDelay = Math.random() * .3 + "s";
      document.body.append(c); setTimeout(() => c.remove(), 1900);
    }
  }
  let bannerEl, bannerT;
  function banner(t, sub = "", ms = 2300) {
    if (!bannerEl) { bannerEl = document.createElement("div"); bannerEl.className = "banner"; bannerEl.setAttribute("aria-live", "polite"); document.body.append(bannerEl); }
    bannerEl.innerHTML = `${t}${sub ? `<small>${sub}</small>` : ""}`; bannerEl.classList.add("show");
    clearTimeout(bannerT); bannerT = setTimeout(() => bannerEl.classList.remove("show"), ms);
  }
  function speak(text, lang = "en-US") {
    try { const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = .85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }

  /* Tabs: <nav class="sub"><button data-tab="x"> … and <section data-panel="x"> */
  function tabs(page, onChange) {
    const btns = [...document.querySelectorAll("nav.sub [data-tab]")];
    const panels = [...document.querySelectorAll("[data-panel]")];
    function show(id, focus) {
      if (!btns.some(b => b.dataset.tab === id)) id = btns[0].dataset.tab;
      btns.forEach(b => { const on = b.dataset.tab === id; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      panels.forEach(p => p.hidden = p.dataset.panel !== id);
      store.set(page + "-tab", id); onChange && onChange(id);
      window.scrollTo({ top: 0 });
    }
    const nav = document.querySelector("nav.sub"); nav.setAttribute("role", "tablist");
    btns.forEach((b, i) => {
      b.type = "button"; b.setAttribute("role", "tab");
      b.onclick = () => { click(); show(b.dataset.tab); };
      b.onkeydown = e => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const n = btns[(i + (e.key === "ArrowRight" ? 1 : btns.length - 1)) % btns.length]; show(n.dataset.tab, true); e.preventDefault();
        }
      };
    });
    show(store.get(page + "-tab", btns[0].dataset.tab));
    return show;
  }

  /* Quiz: questions are {q, c:[correct, wrong, wrong…], why, pic?}. The first choice is always the right one; it gets shuffled. */
  function quiz(el, qs, { key, count, onScore } = {}) {
    count = Math.min(count || qs.length, qs.length);
    let order, i, score;
    const start = () => { order = shuffle(qs).slice(0, count); i = 0; score = 0; show(); };
    function show() {
      if (i >= order.length) return end();
      const q = order[i], ch = shuffle(q.c.map((t, k) => ({ t, ok: k === 0 })));
      el.innerHTML = `<div class="quiz">
        <div class="qbar"><span>Question ${i + 1} of ${order.length}</span><span>Correct: ${score}</span></div>
        <div class="qprog"><i style="width:${i / order.length * 100}%"></i></div>
        ${q.pic ? `<div class="qpic">${q.pic}</div>` : ""}
        <p class="qq">${q.q}</p>
        <div class="qchoices">${ch.map((c, k) => `<button type="button" data-k="${k}">${c.t}</button>`).join("")}</div>
        <div class="qwhy" hidden aria-live="polite"></div>
        <div><button type="button" class="primary qnext" hidden></button></div></div>`;
      el.querySelectorAll(".qchoices button").forEach(b => b.onclick = () => {
        const c = ch[+b.dataset.k];
        el.querySelectorAll(".qchoices button").forEach((x, k) => { x.disabled = true; if (ch[k].ok) x.classList.add("right"); });
        if (c.ok) { score++; happy(); } else { b.classList.add("wrong"); sad(); }
        const w = el.querySelector(".qwhy"); w.hidden = false; w.innerHTML = (c.ok ? "<b>Yes!</b> " : "<b>Not quite.</b> ") + q.why;
        const n = el.querySelector(".qnext"); n.hidden = false;
        n.textContent = i + 1 < order.length ? "Next question" : "See my score";
        n.onclick = () => { i++; show(); }; n.focus({ preventScroll: true });
      });
    }
    function end() {
      const best = Math.max(store.get(key + "-best", 0), score); store.set(key + "-best", best);
      const pct = score / order.length;
      const msg = pct === 1 ? "Perfect! You know this like a pro." : pct >= .7 ? "Great job! Almost a pro." : pct >= .4 ? "Good start. Read the lessons and try again!" : "Keep learning. Every pro started here!";
      el.innerHTML = `<div class="qend"><div class="big-num">${score}/${order.length}</div><p class="qq">${msg}</p><p class="muted">Best score: ${best}/${order.length}</p><button type="button" class="primary big">Play again</button></div>`;
      el.querySelector("button").onclick = start;
      if (pct === 1) { fanfare(); confetti(40); }
      onScore && onScore(score, order.length);
    }
    start();
  }

  /* Flashcards: {term, say?, mean, more?}. Tap to flip; speaker button reads the term aloud. */
  function flashcards(el, cards, lang = "en-US") {
    el.innerHTML = `<div class="flash">${cards.map((c, i) => `
      <div class="fc" data-i="${i}">
        <div class="fc-inner">
          <div class="fc-face fc-front" role="button" tabindex="0" aria-label="${c.term}. Tap to see what it means.">
            <button type="button" class="speak" aria-label="Hear ${c.term}">🔊</button>
            <div class="fc-term">${c.term}</div>${c.say ? `<div class="say">say: ${c.say}</div>` : ""}
          </div>
          <div class="fc-face fc-back" role="button" tabindex="0"><b>${c.term}</b>${c.mean}${c.more ? `<span style="opacity:.85">${c.more}</span>` : ""}</div>
        </div>
      </div>`).join("")}</div>`;
    el.querySelectorAll(".fc").forEach(f => {
      const flip = () => { f.classList.toggle("flipped"); click(); };
      f.querySelectorAll(".fc-face").forEach(face => {
        face.onclick = flip;
        face.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
      });
      f.querySelector(".speak").onclick = e => { e.stopPropagation(); speak(cards[+f.dataset.i].speakAs || cards[+f.dataset.i].term, lang); };
    });
  }

  /* Diagram hotspots: elements with class="hotspot" data-k="key"; info[key] = {t, d} shown in target element */
  function hotspots(root, info, target) {
    root.querySelectorAll(".hotspot").forEach(h => {
      h.setAttribute("tabindex", "0"); h.setAttribute("role", "button");
      const k = h.dataset.k; h.setAttribute("aria-label", info[k].t);
      const go = () => { click(); target.innerHTML = `<h3>${info[k].t}</h3><p>${info[k].d}</p>`; root.querySelectorAll(".hotspot").forEach(x => x.classList.toggle("on", x === h)); };
      h.onclick = go; h.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  return { pick, shuffle, store, reduce, tone, happy, fanfare, sad, click, confetti, banner, speak, tabs, quiz, flashcards, hotspots, sleep };
})();
