// Deck: on wide screens the page is a sideways track of slides. Wheel, swipe and
// arrow keys build up "tension"; once it passes a threshold the deck pulls to the
// next stop. Slides with data-dwell hold still while their figure steps through
// states, reported as a 'dwell' event (0..1). Phones scroll vertically as normal.
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mq = matchMedia('(min-width: 900px) and (min-aspect-ratio: 1/1)');
  const deck = document.getElementById('deck');
  const track = deck.querySelector('.track');
  const slides = [...track.querySelectorAll(':scope > .slide')];
  const TITLES = ['Contents', 'Defining marketing', 'Needs and orientations', 'Branding in entertainment', 'Research', 'Consumer behaviour', 'Conclusion'];
  let on = false, geo = [], maxT = 0, total = 0, pull = 0;

  // ---------- theme ----------
  const tb = document.querySelector('.theme');
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    tb.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    tb.querySelector('span').textContent = dark ? 'Light' : 'Dark';
  };
  tb.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    syncTheme();
  });
  syncTheme();

  // ---------- kinetic chapter titles: one span per letter ----------
  document.querySelectorAll('.kinetic').forEach(h => {
    const text = h.textContent.trim();
    let i = 0;
    const words = text.split(' ').map(w => '<span class="w">' + [...w].map(c => `<span class="ch" style="--i:${i++}">${c}</span>`).join('') + '</span>').join(' ');
    h.setAttribute('aria-label', text);
    h.innerHTML = `<span class="num" aria-hidden="true">${h.dataset.num}</span><span aria-hidden="true">${words}<span class="dot">.</span></span>`;
  });

  // ---------- citations -> reference links ----------
  const refs = {
    'Kotler & Keller 2016':'kotler','Drucker 1954':'drucker','CreateSA n.d.':'createsa','Maslow 1943':'maslow',
    'Live Performance Australia 2024':'lpa','Negus 1999':'negus','Philadelphia Inquirer 2017':'inquirer','Walsh 2021':'walsh',
    'Chartmetric n.d.':'chartmetric','Wikipedia n.d.':'wikipedia','NME 2020':'nme','The Current 2017':'current','The Ringer 2016':'ringer',
    'Euronews 2026':'euronews','Ruiz 2025':'ruiz','TweakTown 2025':'tweaktown','Game Publishing and Marketing Summit 2025':'gpms',
    'Suno n.d.':'suno','Deezer & Ipsos 2025':'deezer','Statista 2025':'statista','McCarthy 1960':'mccarthy','Revolt 2021':'revolt',
    'Rolling Stone 2021':'rollingstone','DeVon 2024':'devon','Legal Information Institute n.d.':'lii','Curios 2023':'curios',
    'Jack11 Poland 2009':'@jack11','Carter 1971':'@carter','NYS Senate Media Services 2025':'@nys',
    "October's Very Own n.d.":'@ovo','OneFour 2025':'@onefour','Team Cherry 2017':'@hk','Team Cherry 2025':'@silksong',
    'Team Cherry n.d.':'@tc','Steam n.d.':'@steam'
  };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(' + Object.keys(refs).sort((a, b) => b.length - a.length).map(esc).join('|') + ')', 'g');
  const walker = document.createTreeWalker(track, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest('.refs, a, svg, title, .card, h1, h2, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const hits = [];
  while (walker.nextNode()) { if (re.test(walker.currentNode.nodeValue)) hits.push(walker.currentNode); re.lastIndex = 0; }
  hits.forEach(node => {
    const frag = document.createDocumentFragment();
    node.nodeValue.split(re).forEach((part, i) => {
      if (i % 2) {
        const a = document.createElement('a'), id = refs[part];
        a.href = id[0] === '@' ? '#img-' + id.slice(1) : '#ref-' + id;
        a.className = 'cite'; a.textContent = part; frag.append(a);
      } else if (part) frag.append(part);
    });
    node.replaceWith(frag);
  });

  // ---------- geometry ----------
  function measure() {
    on = mq.matches;
    root.classList.toggle('deck-on', on);
    track.style.transform = '';
    if (!on) { deck.style.height = ''; geo = []; update(); return; }
    const vw = innerWidth, vh = innerHeight;
    slides.forEach(s => {
      if (s.dataset.w !== 'auto') return;
      // lay the reference columns out on a very wide slide, then shrink it to the last column
      s.style.width = '30000px';
      const c = s.querySelector('.refs-cols'), left = s.getBoundingClientRect().left;
      let right = 0;
      c.querySelectorAll('h2, p, li, footer').forEach(el => { right = Math.max(right, el.getBoundingClientRect().right); });
      s.style.width = Math.max(vw, right - left + vw * .06) + 'px';
    });
    let S = 0, L = 0;
    geo = slides.map(s => {
      const w = s.getBoundingClientRect().width, d = (+s.dataset.dwell || 0) * vh / 100;
      const g = { s, L, S, w, d }; S += d + w; L += w; return g;
    });
    maxT = L - vw;
    const last = geo[geo.length - 1];
    total = last.S + last.d + Math.max(0, last.w - vw);
    deck.style.height = (total + vh) + 'px';
    update();
  }
  const tAt = y => {
    for (const g of geo) {
      if (y <= g.S + g.d) return Math.min(g.L, maxT);
      if (y <= g.S + g.d + g.w) return Math.min(g.L + (y - g.S - g.d), maxT);
    }
    return maxT;
  };

  // ---------- per-frame state ----------
  const now = document.getElementById('now');
  const dockLinks = [...document.querySelectorAll('.dock a[data-ch]')];
  let lastCh = -1;
  function setDwell(s, p) {
    p = Math.min(1, Math.max(0, p));
    if (s._d === p) return;
    s._d = p;
    s.style.setProperty('--d', p.toFixed(4));
    s.dispatchEvent(new CustomEvent('dwell', { detail: p }));
  }
  function seen(s) {
    if (s.classList.contains('seen')) return;
    s.classList.add('seen');
    counters(s);
  }
  let virtualY = null;
  function update() {
    const vw = innerWidth, vh = innerHeight;
    let active = slides[0];
    if (on) {
      const y = Math.max(0, (virtualY ?? scrollY) - deck.offsetTop), T = tAt(y);
      track.style.transform = `translate3d(${(-T - pull).toFixed(1)}px,0,0)`;
      for (const g of geo) {
        const left = g.L - T;
        g.s.classList.toggle('vis', left < vw && left + g.w > 0);
        if (left < vw * .62 && left + g.w > vw * .25) seen(g.s);
        if (left <= vw * .5) active = g.s;
        if (g.d) setDwell(g.s, (y - g.S) / g.d);
      }
      root.style.setProperty('--p', (total ? y / total : 0).toFixed(4));
    } else {
      for (const s of slides) {
        const r = s.getBoundingClientRect();
        s.classList.toggle('vis', r.top < vh && r.bottom > 0);
        if (r.top < vh * .75 && r.bottom > vh * .15) seen(s);
        if (r.top <= vh * .5) active = s;
        if (s.dataset.dwell) setDwell(s, -r.top / (r.height - vh));
      }
      root.style.setProperty('--p', (scrollY / Math.max(1, root.scrollHeight - vh)).toFixed(4));
    }
    slides.forEach(s => s.classList.toggle('is-active', s === active));
    const ch = +active.dataset.ch;
    if (ch !== lastCh) {
      lastCh = ch;
      root.dataset.ch = ch;
      window.__chapter = ch;
      window.dispatchEvent(new CustomEvent('chapter', { detail: ch }));
      now.textContent = TITLES[ch];
      dockLinks.forEach(a => a.setAttribute('aria-current', +a.dataset.ch === ch));
    }
  }
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } }, { passive: true });

  // ---------- stops, gliding and tension ----------
  const states = s => s.classList.contains('persona') ? 6 : s.classList.contains('seg') ? 4 : s.classList.contains('doll') ? 3 : 1;
  function stops() {
    if (!on) return slides.map(s => s.getBoundingClientRect().top + scrollY);
    const out = [], o = deck.offsetTop;
    geo.forEach(g => {
      out.push(o + g.S);
      const n = states(g.s);
      for (let k = 1; k < n; k++) out.push(o + g.S + g.d * (k + .5) / n);
      if (g.w > innerWidth + 1) {
        for (let x = innerWidth * .8; x < g.w - innerWidth; x += innerWidth * .8) out.push(o + g.S + g.d + x);
        out.push(o + g.S + g.d + g.w - innerWidth);
      }
    });
    return out;
  }
  let gliding = false, quietUntil = 0, glideTo = 0, gid = 0;
  // glide: animate the track directly (a virtual scroll position), then settle the real scroll once at the end
  function glide(to) {
    to = Math.max(0, Math.min(to, root.scrollHeight - innerHeight));
    if (reduce || !on) { gid++; gliding = false; virtualY = null; scrollTo(0, to); return; }   // also cancels a glide in flight
    const from = virtualY ?? scrollY, dist = to - from, id = ++gid;
    const dur = Math.min(900, 560 + Math.abs(dist) * .05), t0 = performance.now();
    gliding = true; glideTo = to;
    const step = t => {
      if (id !== gid) return;   // a newer glide took over
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);   // quick to start, soft to land
      virtualY = from + dist * e; update();
      if (k < 1) requestAnimationFrame(step);
      else { virtualY = null; scrollTo(0, to); gliding = false; quietUntil = performance.now() + 120; }
    };
    requestAnimationFrame(step);
  }
  function go(dir) {
    const y = gliding ? glideTo : virtualY ?? scrollY, list = stops();   // mid-glide, step on from where it is heading
    const t = dir > 0 ? list.find(v => v > y + 4) : [...list].reverse().find(v => v < y - 4);
    if (t != null) glide(t);
  }
  const TH = 150;                       // wheel distance (px) before the deck lets go
  let tension = 0, relaxT;
  function setPull(px) { pull = px; update(); }
  function relax() {
    const start = pull, t0 = performance.now();
    tension = 0;
    const step = t => { const k = Math.min(1, (t - t0) / 260); setPull(start * (1 - k) * (1 - k)); if (k < 1 && tension === 0) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  addEventListener('wheel', e => {
    if (!on || e.ctrlKey || e.target.closest('dialog')) return;
    e.preventDefault();
    const nowT = performance.now();
    if (gliding || nowT < quietUntil) { quietUntil = Math.max(quietUntil, nowT + 120); return; }   // swallow trackpad inertia
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    tension += d * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    // the track leans toward where you are pulling, resisting more the further you go
    const k = Math.min(1, Math.abs(tension) / TH);
    setPull(Math.sign(tension) * (1 - Math.pow(1 - k, 2)) * Math.min(70, innerWidth * .05));
    root.style.setProperty('--tension', k.toFixed(3));
    clearTimeout(relaxT);
    relaxT = setTimeout(() => { relax(); root.style.setProperty('--tension', 0); }, 200);
    if (Math.abs(tension) >= TH) {
      const dir = Math.sign(tension);
      tension = 0; pull = 0; root.style.setProperty('--tension', 0);
      go(dir);
    }
  }, { passive: false });
  let tx = null, ty = null;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', e => { if (on && tx != null && !e.target.closest('dialog')) e.preventDefault(); }, { passive: false });
  addEventListener('touchend', e => {
    if (!on || tx == null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    const d = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
    if (Math.abs(d) > 45) go(Math.sign(d));
    tx = ty = null;
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') closePop(true);
    if (!on || e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(e.target.tagName) || e.target.closest('dialog')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key) && !(e.key === ' ' && e.target.closest('button, a'))) { e.preventDefault(); go(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1); }
  });
  document.querySelectorAll('.dock button[data-step]').forEach(b => b.addEventListener('click', () => go(+b.dataset.step)));

  // ---------- in-page links (citations, dock, contents) ----------
  function yFor(el) {
    const s = el.closest('.slide');
    if (!on || !s) return el.getBoundingClientRect().top + scrollY - innerHeight * .15;
    const g = geo.find(g => g.s === s);
    let y = deck.offsetTop + g.S;
    if (g.w > innerWidth + 1) {
      const ox = el.getBoundingClientRect().left - s.getBoundingClientRect().left;
      y += g.d + Math.max(0, Math.min(ox - innerWidth * .3, g.w - innerWidth));
    }
    return y;
  }
  function dwellY(s, p) {
    if (on) { const g = geo.find(g => g.s === s); return deck.offsetTop + g.S + g.d * p; }
    const r = s.getBoundingClientRect();
    return scrollY + r.top + (r.height - innerHeight) * p;
  }
  const toc = document.getElementById('toc');
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    if (toc.open) toc.close();
    const y = yFor(t);
    on ? glide(y) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    if (t.matches('.refs li')) { t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 2600); }
    // move keyboard / screen reader focus to the destination
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    setTimeout(() => t.focus({ preventScroll: true }), on && !reduce ? 1150 : 0);
    history.replaceState(null, '', '#' + id);
  });
  // keyboard focus on an off-screen slide brings the deck to it
  document.addEventListener('focusin', e => {
    if (!on || gliding) return;
    const s = e.target.closest('.slide');
    if (s && !s.classList.contains('vis') && !e.target.closest('.dock, .bar, dialog')) scrollTo({ top: yFor(e.target), behavior: 'auto' });
  });

  // ---------- contents overlay ----------
  document.querySelector('.now').addEventListener('click', () => {
    toc.querySelectorAll('a[data-ch]').forEach(a => a.setAttribute('aria-current', +a.dataset.ch === lastCh));
    toc.showModal();
  });
  toc.querySelector('.toc-close').addEventListener('click', () => toc.close());
  toc.addEventListener('click', e => { if (e.target === toc || e.target === toc.firstElementChild) toc.close(); });   // .toc-inner fills the dialog, so its empty space counts as backdrop

  // ---------- footnotes: a small pop-up bubble, the paragraph never reflows ----------
  const pop = document.createElement('div');
  // a11y: the closed bubble is inert; while open it is a focused note and the source note is hidden from screen readers, so it is read once
  pop.className = 'fn-pop'; pop.inert = true; pop.tabIndex = -1; pop.setAttribute('role', 'note');
  document.body.append(pop);
  document.querySelectorAll('.sidenote a').forEach(a => { a.tabIndex = -1; });   // invisible copies are never tab stops
  let popFor = null;
  function closePop(back) {           // back === true: an explicit close (Escape, Tab out) returns focus to the footnote button
    if (!popFor) return;
    const b = popFor; popFor = null;
    b.setAttribute('aria-expanded', 'false');
    document.getElementById('fn' + b.dataset.fn).removeAttribute('aria-hidden');
    pop.classList.remove('show'); pop.inert = true;
    if (back === true) b.focus({ preventScroll: true });
  }
  document.querySelectorAll('.fn-ref').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (popFor === b) return closePop();
      closePop();
      const src = document.getElementById('fn' + b.dataset.fn), note = src.cloneNode(true);
      note.querySelectorAll('.sr-only').forEach(n => n.remove());
      note.querySelectorAll('a').forEach(a => a.removeAttribute('tabindex'));
      src.setAttribute('aria-hidden', 'true'); pop.inert = false;
      pop.replaceChildren();
      const num = document.createElement('b'); num.textContent = b.dataset.fn;
      pop.append(num, ...note.childNodes);
      const r = b.getBoundingClientRect(), w = Math.min(380, innerWidth - 24), below = r.top < 200;
      pop.style.width = w + 'px';
      pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
      pop.style.top = (below ? r.bottom + 12 : r.top - 12) + 'px';
      pop.classList.toggle('below', below);
      requestAnimationFrame(() => pop.classList.add('show'));
      b.setAttribute('aria-expanded', 'true'); popFor = b;
      pop.setAttribute('aria-label', 'Footnote ' + b.dataset.fn);
      pop.focus({ preventScroll: true });
    });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.fn-pop')) closePop(); });
  // focus moving anywhere else closes the bubble; tabbing past its edges closes it back onto the footnote button
  // (the bubble lives at the end of <body>, so a plain Tab out would otherwise land far away in the page)
  document.addEventListener('focusin', e => { if (popFor && !pop.contains(e.target) && e.target !== popFor) closePop(); });
  pop.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const links = [...pop.querySelectorAll('a')], edges = e.shiftKey ? [pop, links[0]] : [links.at(-1) ?? pop];
    if (edges.includes(e.target)) { e.preventDefault(); closePop(true); }
  });
  addEventListener('scroll', closePop, { passive: true });

  // ---------- figures ----------
  // click-to-reveal controls lose their rainbow ring once used (capture: footnotes stop propagation)
  document.addEventListener('click', e => { const c = e.target.closest('.fn-ref, .ctl button, .card'); if (c) c.dataset.clicked = ''; }, true);
  function counters(scope) {
    scope.querySelectorAll('[data-count]').forEach(c => {
      const end = +c.dataset.count, pre = c.dataset.prefix || '', suf = c.dataset.suffix || '';
      const fmt = v => pre + Math.round(v).toLocaleString('en-AU') + suf;
      if (reduce) return c.textContent = fmt(end);
      const t0 = performance.now(), dur = 1600;
      const tick = t => { const k = Math.min(1, (t - t0) / dur); c.textContent = fmt(end * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }
  const mz = document.querySelector('.maslow');
  mz.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
    mz.dataset.state = b.dataset.set;
    mz.querySelectorAll('[data-set]').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));
  const of = document.querySelector('.orient-fig'), ol = of.querySelector('.orients'), note = of.querySelector('.orient-note');
  const notes = { all: note.textContent, commercial: 'The commercial artist combines a product and holistic marketing orientation (Negus 1999).' };
  of.querySelectorAll('button[data-show]').forEach(b => b.addEventListener('click', () => {
    ol.dataset.show = b.dataset.show; note.textContent = notes[b.dataset.show];
    of.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));

  // brand personality cards: scrolling deals them one by one, clicking jumps to one
  const persona = document.querySelector('.persona');
  const cards = [...persona.querySelectorAll('.card')], pcs = [...persona.querySelectorAll('.pc')], pcount = document.getElementById('pcount');
  let curCard = -1;
  function showCard(i) {
    if (i === curCard) return;
    curCard = i;
    const w = cards[0].offsetWidth || 300;
    cards.forEach((c, k) => {
      const off = k - i;
      let dx, dy, rot, sc, op = 1, z;
      // the deck stacks behind the active card; dealt cards lift away and fade
      if (off >= 0) { dx = off * w * .09; dy = -off * w * .025; rot = off * 3.5; sc = 1 - off * .045; z = 50 - off; op = off > 3 ? 0 : 1; }
      else { dx = -w * .25; dy = -w * .35; rot = -14; sc = .85; op = 0; z = 60; }
      c.style.setProperty('--dx', dx + 'px'); c.style.setProperty('--dy', dy + 'px');
      c.style.setProperty('--rot', rot + 'deg'); c.style.setProperty('--sc', sc);
      c.style.opacity = op; c.style.zIndex = z;
      c.setAttribute('aria-pressed', k === i);
      c.tabIndex = op ? 0 : -1;
      c.style.pointerEvents = op ? '' : 'none';   // hidden cards must not swallow clicks meant for the visible ones
    });
    pcs.forEach((p, k) => p.classList.toggle('on', k === i));
    pcount.textContent = `${i + 1} / ${cards.length}`;
  }
  persona.addEventListener('dwell', e => showCard(Math.max(0, Math.min(cards.length - 1, Math.floor(e.detail * cards.length) || 0))));
  cards.forEach((c, k) => c.addEventListener('click', () => {
    const y = dwellY(persona, (Math.min(cards.length - 1, k === curCard ? k + 1 : k) + .5) / cards.length);
    on ? glide(y) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }));
  if (fine && !reduce) {
    const fan = persona.querySelector('.fan');
    fan.addEventListener('pointermove', e => {
      const c = cards[curCard], r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      c.style.setProperty('--ry', ((px - .5) * 24).toFixed(2) + 'deg');
      c.style.setProperty('--rx', ((.5 - py) * 18).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      c.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    });
    fan.addEventListener('pointerleave', () => cards.forEach(c => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }));
  }

  // segmentation zoom: four levels across the dwell
  const seg = document.querySelector('.seg');
  seg.addEventListener('dwell', e => {
    const lv = Math.max(0, Math.min(3, Math.floor(e.detail * 4) || 0));
    seg.dataset.level = lv;
  });

  // hero title leans toward the pointer (transform only, so nothing reflows)
  const lines = [...document.querySelectorAll('.hero h1 .ln')];
  if (fine && !reduce) addEventListener('pointermove', e => {
    if (!slides[0].classList.contains('is-active')) return;
    lines.forEach(l => {
      const r = l.getBoundingClientRect(), d = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      l.style.setProperty('--lean', Math.max(-1, Math.min(1, d * 3)).toFixed(3));
    });
  }, { passive: true });

  // ---------- boot ----------
  showCard(0);
  let rt;
  const remeasure = () => {
    const keep = slides.find(s => s.classList.contains('is-active'));
    measure();
    if (keep && keep !== slides[0]) scrollTo({ top: yFor(keep), behavior: 'auto' });
  };
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(remeasure, 150); });
  measure();
  document.fonts.ready.then(measure);
  addEventListener('load', () => {
    measure();
    const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) scrollTo({ top: yFor(t), behavior: 'auto' });
  });
  window.__deck = { yFor, go };
})();
