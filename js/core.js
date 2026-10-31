/* TechnoStudio — noyau : utilitaires, stockage local, état, markdown, bus d'événements.
   Scripts classiques (pas de modules) pour fonctionner aussi en double-clic (file://). */
(function () {
  'use strict';
  const TL = (window.TL = window.TL || {});
  TL.VERSION = '3.1.0';
  TL.FORMAT = 2;

  /* ---------- DOM ---------- */
  TL.$ = (sel, root) => (root || document).querySelector(sel);
  TL.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // h('div.cls#id', {attrs}, ...children)
  TL.h = function h(tag, attrs, ...kids) {
    const m = String(tag).match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, v) => {
      if (t === '.') el.classList.add(v); else el.id = v;
    });
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      kids.unshift(attrs); attrs = null;
    }
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k in el && typeof v !== 'string') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    appendKids(el, kids);
    return el;
  };
  function appendKids(el, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) appendKids(el, k);
      else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }

  // append() natif écrit « null » en texte : on ignore les valeurs vides
  ['append', 'prepend'].forEach((m) => {
    const native = Element.prototype[m];
    Element.prototype[m] = function (...a) { return native.apply(this, a.filter((x) => x != null && x !== false)); };
  });

  TL.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // typographie française : espace insécable avant : ; ! ? et à l'intérieur des guillemets
  TL.fr = (s) => String(s == null ? '' : s).replace(/ ([:;!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
  TL.uid = (p) => (p || '') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  TL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  TL.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  TL.clone = (o) => JSON.parse(JSON.stringify(o));
  TL.norm = (s) => String(s == null ? '' : s).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').replace(/[’']/g, "'");
  TL.shuffle = (arr, seed) => {
    const a = arr.slice(); let s = seed || 1;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  TL.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };
  TL.fmtNum = (v, d) => {
    if (!isFinite(v)) return '—';
    const n = Math.abs(v) < 1e-9 ? 0 : v;
    return n.toLocaleString('fr-FR', { maximumFractionDigits: d == null ? 2 : d });
  };
  TL.fmtDate = (t) => {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  /* ---------- Bus d'événements ---------- */
  const bus = {};
  TL.on = (ev, fn) => { (bus[ev] = bus[ev] || []).push(fn); return () => (bus[ev] = bus[ev].filter((f) => f !== fn)); };
  TL.emit = (ev, data) => (bus[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); } });

  /* ---------- Toasts ---------- */
  TL.toast = function (msg, kind) {
    let box = TL.$('#toasts');
    if (!box) { box = TL.h('div#toasts', { role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    const t = TL.h('div.toast' + (kind ? '.' + kind : ''), msg);
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  };

  /* ---------- Mini markdown ---------- */
  function inline(s) {
    s = TL.esc(TL.fr(s));
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${safeUrl(u)}" alt="${a}" loading="lazy">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener">${t}</a>`);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    s = s.replace(/\^\^([^^]+)\^\^/g, '<sup>$1</sup>');
    s = s.replace(/,,([^,]+),,/g, '<sub>$1</sub>');
    return s;
  }
  function safeUrl(u) {
    u = String(u).replace(/&amp;/g, '&');
    if (/^(https?:|data:image\/|#|\.?\/|[\w-]+\.(png|jpe?g|svg|gif|webp)$)/i.test(u)) return TL.esc(u);
    return '#';
  }
  TL.md = function (src) {
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    let out = '', list = null, para = [];
    const flushP = () => { if (para.length) { out += '<p>' + inline(para.join(' ')) + '</p>'; para = []; } };
    const flushL = () => { if (list) { out += `</${list}>`; list = null; } };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      let m;
      if (!l.trim()) { flushP(); flushL(); continue; }
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) { flushP(); flushL(); const n = Math.min(6, m[1].length + 2); out += `<h${n}>${inline(m[2])}</h${n}>`; continue; }
      if ((m = l.match(/^>\s?(!|\?)?\s*(.*)/))) {
        flushP(); flushL();
        const kind = m[1] === '!' ? 'warn' : m[1] === '?' ? 'tip' : 'note';
        let body = [m[2]];
        while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) body.push(lines[++i].replace(/^>\s?/, ''));
        out += `<div class="callout ${kind}">${inline(body.join(' '))}</div>`; continue;
      }
      if ((m = l.match(/^\s*[-*]\s+(.*)/))) { flushP(); if (list !== 'ul') { flushL(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; continue; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; continue; }
      if (/^\|.*\|\s*$/.test(l)) {
        flushP(); flushL();
        const rows = [l];
        while (i + 1 < lines.length && /^\|.*\|\s*$/.test(lines[i + 1])) rows.push(lines[++i]);
        const cells = (r) => r.trim().slice(1, -1).split('|').map((c) => c.trim());
        let html = '<div class="tablewrap"><table>';
        rows.forEach((r, ri) => {
          if (/^\|[\s:-|]+\|$/.test(r.trim())) return;
          const tag = ri === 0 ? 'th' : 'td';
          html += '<tr>' + cells(r).map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
        });
        out += html + '</table></div>'; continue;
      }
      flushL(); para.push(l.trim());
    }
    flushP(); flushL();
    return out;
  };
  TL.inlineMd = inline;

  /* ---------- Stockage local (IndexedDB, repli mémoire) ---------- */
  const mem = new Map();
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((res) => {
      try {
        if (!window.indexedDB) return res(null);
        const rq = indexedDB.open('technostudio', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
        rq.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return openDb().then((db) => new Promise((res) => {
      if (!db) return res(fn(null));
      try {
        const t = db.transaction('kv', mode);
        const st = t.objectStore('kv');
        const r = fn(st);
        t.oncomplete = () => res(typeof IDBRequest !== 'undefined' && r instanceof IDBRequest ? r.result : r);
        t.onerror = () => res(undefined);
        t.onabort = () => res(undefined);
      } catch (e) { res(fn(null)); }
    }));
  }
  TL.db = {
    get(k) { return tx('readonly', (st) => (st ? st.get(k) : mem.get(k))); },
    set(k, v) { mem.set(k, v); return tx('readwrite', (st) => (st ? st.put(v, k) : null)).then(() => v); },
    del(k) { mem.delete(k); return tx('readwrite', (st) => (st ? st.delete(k) : null)); },
    keys(prefix) {
      return openDb().then((db) => new Promise((res) => {
        if (!db) return res([...mem.keys()].filter((k) => k.startsWith(prefix || '')));
        try {
          const rq = db.transaction('kv').objectStore('kv').getAllKeys();
          rq.onsuccess = () => res(rq.result.filter((k) => String(k).startsWith(prefix || '')));
          rq.onerror = () => res([]);
        } catch (e) { res([]); }
      }));
    },
    async all(prefix) {
      const ks = await TL.db.keys(prefix);
      const out = [];
      for (const k of ks) out.push(await TL.db.get(k));
      return out.filter(Boolean);
    },
  };

  /* ---------- Modèle d'atelier ---------- */
  TL.LEVELS = {
    college: { label: 'Collège', short: 'Coll.' },
    sti2d: { label: 'STI2D / SI', short: 'STI2D' },
    snt: { label: 'SNT / NSI', short: 'SNT' },
    pro: { label: 'Pro / BTS', short: 'Pro' },
  };

  // Complète un atelier : identifiants de blocs, champs par défaut.
  TL.normalizeWorkshop = function (w) {
    w = w || {};
    w.format = w.format || TL.FORMAT;
    w.id = String(w.id || TL.uid('at-')).replace(/[^A-Za-z0-9-]/g, '-');
    w.title = w.title || 'Atelier sans titre';
    w.level = w.level || 'college';
    w.version = w.version || 1;
    w.steps = Array.isArray(w.steps) ? w.steps : [];
    w.steps.forEach((s, si) => {
      s.id = s.id || 'e' + (si + 1);
      s.title = s.title || 'Étape ' + (si + 1);
      s.blocks = Array.isArray(s.blocks) ? s.blocks : [];
      s.blocks.forEach((b, bi) => { b.id = b.id || s.id + '-b' + (bi + 1); });
    });
    return w;
  };

  TL.isGraded = (b) => !!(TL.activities && TL.activities[b.type] && TL.activities[b.type].graded && !b.demo);

  TL.workshopStats = function (w, pg) {
    let total = 0, done = 0, score = 0;
    (w.steps || []).forEach((s) => s.blocks.forEach((b) => {
      if (!TL.isGraded(b)) return;
      total++;
      const a = pg && pg.answers && pg.answers[b.id];
      if (a && a.done) { done++; score += a.score || 0; }
    }));
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, score: total ? Math.round((score / total) * 100) : 0 };
  };

  TL.stepDone = function (s, pg) {
    const g = s.blocks.filter(TL.isGraded);
    if (!g.length) return pg && pg.seen && pg.seen[s.id];
    return g.every((b) => pg && pg.answers && pg.answers[b.id] && pg.answers[b.id].done);
  };

  /* ---------- Images : compression avant stockage ---------- */
  TL.fileToDataUrl = function (file, maxW, quality) {
    maxW = maxW || 1400; quality = quality || 0.82;
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => {
        if (!/^image\//.test(file.type) || /svg/.test(file.type)) return res(fr.result);
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => res(fr.result);
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  // Téléchargement d'un fichier généré (export de paquet, etc.)
  TL.download = function (name, data, type) {
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/json' });
      const a = TL.h('a', { href: URL.createObjectURL(blob), download: name });
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      return true;
    } catch (e) { return false; }
  };

  TL.readFileText = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsText(file); });

  // Petite boîte de dialogue intégrée (les dialogues natifs peuvent être bloqués)
  TL.modal = function (title, body, actions) {
    const back = TL.h('div.modal-back');
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const box = TL.h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      TL.h('div.modal-head', TL.h('h2', title), TL.h('button.icon-btn', { 'aria-label': 'Fermer', onclick: close }, '✕')),
      TL.h('div.modal-body', body),
      actions && actions.length ? TL.h('div.modal-foot', actions.map((a) => TL.h('button.btn' + (a.primary ? '.primary' : '') + (a.danger ? '.danger' : ''), {
        onclick: async () => { const r = a.onClick ? await a.onClick() : null; if (r !== false) close(); },
      }, a.label))) : null);
    back.appendChild(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    document.body.appendChild(back);
    const f = box.querySelector('input,textarea,select,button.primary');
    if (f) setTimeout(() => f.focus(), 30);
    return { close, el: box };
  };

  TL.confirm = (title, text, label) => new Promise((res) => {
    let ok = false;
    const m = TL.modal(title, TL.h('p', text), [
      { label: 'Annuler', onClick: () => { res(false); } },
      { label: label || 'Confirmer', primary: true, danger: /suppr|effac/i.test(label || ''), onClick: () => { ok = true; res(true); } },
    ]);
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!ok) res(false); } });
    obs.observe(document.body, { childList: true });
  });
})();
