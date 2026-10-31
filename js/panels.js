/* TechnoStudio — barre de menus et panneaux flottants.
   Les panneaux sont translucides, déplaçables (poignée = titre), redimensionnables,
   repliables ; leur disposition est mémorisée pour chaque mode de travail.
   Sur téléphone, un panneau ouvert devient un tiroir en bas d'écran. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;

  /* ================= Barre de menus ================= */
  const MB = (TL.menubar = { menus: [], open: null });
  MB.render = function (menus) {
    MB.menus = menus;
    const bar = TL.$('#menus');
    bar.innerHTML = '';
    menus.forEach((m, mi) => {
      if (m.hidden) return;
      const btn = h('button.mb-top' + (m.brand ? '.brand-btn' : ''), { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', dataset: { mi } }, m.brand ? m.brand : m.label);
      btn.addEventListener('click', (e) => { e.stopPropagation(); MB.open === mi ? MB.close() : MB.show(mi, btn); });
      btn.addEventListener('mouseenter', () => { if (MB.open != null && MB.open !== mi) MB.show(mi, btn); });
      btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); MB.show(mi, btn, true); } });
      bar.append(btn);
    });
  };
  MB.show = function (mi, btn, focus) {
    MB.close();
    const m = MB.menus[mi];
    MB.open = mi;
    btn.setAttribute('aria-expanded', 'true'); btn.classList.add('on');
    const list = h('div.mb-menu', { role: 'menu' });
    const add = (items, into) => items.forEach((it) => {
      if (!it || it.hidden) return;
      if (it.sep) { into.append(h('div.mb-sep', { role: 'separator' })); return; }
      if (it.head) { into.append(h('div.mb-head', it.head)); return; }
      const item = h('button.mb-item', { type: 'button', role: it.check != null ? 'menuitemcheckbox' : 'menuitem', 'aria-checked': it.check != null ? String(!!it.check) : null, disabled: !!it.disabled },
        h('span.mb-check', it.check ? '✓' : ''), h('span.mb-label', it.label), it.key ? h('kbd.mb-key', it.key) : null);
      item.addEventListener('click', (e) => { e.stopPropagation(); MB.close(); if (it.action) it.action(); });
      into.append(item);
    });
    add(typeof m.items === 'function' ? m.items() : m.items, list);
    const r = btn.getBoundingClientRect();
    list.style.left = Math.min(r.left, window.innerWidth - 280) + 'px';
    list.style.top = r.bottom + 'px';
    document.body.append(list);
    MB.el = list;
    const items = TL.$$('.mb-item:not(:disabled)', list);
    if (focus && items[0]) items[0].focus();
    list.addEventListener('keydown', (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      if (e.key === 'Escape') { MB.close(); btn.focus(); }
    });
  };
  MB.close = function () {
    if (MB.el) MB.el.remove();
    MB.el = null; MB.open = null;
    TL.$$('.mb-top').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });
  };
  document.addEventListener('click', () => MB.close());
  window.addEventListener('resize', () => MB.close());

  /* ================= Panneaux flottants ================= */
  const P = (TL.panels = { defs: {}, els: {}, mode: null, state: {}, z: 80 });
  const mobile = () => window.matchMedia('(max-width: 820px)').matches;
  P.load = async function () { try { P.state = (await TL.db.get('ui:panels')) || {}; } catch (e) { P.state = {}; } };
  const save = TL.debounce(() => TL.db.set('ui:panels', P.state), 300);

  P.register = (id, def) => { P.defs[id] = Object.assign({ id }, def); };
  const ws = () => TL.$('#workspace');

  function geom(id) {
    const d = P.defs[id];
    const st = ((P.state[P.mode] = P.state[P.mode] || {})[id] = P.state[P.mode][id] || {});
    const W = ws().clientWidth, H = ws().clientHeight;
    const w = st.w || d.w || 280, hh = st.h || null;
    let x = st.x != null ? st.x : d.side === 'right' ? W - w - 14 : (d.x || 14);
    let y = st.y != null ? st.y : d.top || 14;
    x = TL.clamp(x, 0, Math.max(0, W - 120)); y = TL.clamp(y, 0, Math.max(0, H - 40));
    return { st, x, y, w, h: hh };
  }

  // Ouvre les panneaux d'un mode (ids = panneaux proposés, defaults = ouverts au départ)
  P.setMode = function (mode, ids, defaults) {
    P.close();
    P.mode = mode; P.ids = ids;
    const st = (P.state[mode] = P.state[mode] || {});
    ids.forEach((id) => { if (!st[id]) st[id] = {}; if (st[id].open == null) st[id].open = (defaults || ids).includes(id) && !mobile(); });
    ids.forEach((id) => { if (st[id].open) P.open(id, true); });
    P.drawDock();
  };
  P.close = function () { Object.values(P.els).forEach((e) => e.remove()); P.els = {}; };

  P.open = function (id, silent) {
    const d = P.defs[id]; if (!d) return;
    if (P.els[id]) { P.focus(id); return; }
    if (mobile()) Object.keys(P.els).forEach((k) => P.hide(k));
    const g = geom(id);
    g.st.open = true;
    const body = h('div.panel-body');
    const collapse = h('button.panel-btn', { type: 'button', title: 'Replier', 'aria-label': 'Replier le panneau' }, g.st.collapsed ? '▸' : '▾');
    const head = h('div.panel-head', h('span.panel-ico', { 'aria-hidden': 'true' }, d.icon || '▪'), h('span.panel-title', d.title), collapse, h('button.panel-btn', { type: 'button', title: 'Fermer', 'aria-label': 'Fermer le panneau', onclick: () => P.hide(id) }, '✕'));
    const el = h('section.panel' + (g.st.collapsed ? '.collapsed' : ''), { role: 'region', 'aria-label': d.title, dataset: { panel: id } }, head, body);
    Object.assign(el.style, { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', zIndex: ++P.z });
    if (g.h) el.style.height = g.h + 'px';
    collapse.onclick = () => { g.st.collapsed = !g.st.collapsed; el.classList.toggle('collapsed', g.st.collapsed); collapse.textContent = g.st.collapsed ? '▸' : '▾'; save(); };
    // déplacement
    let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || mobile()) return;
      drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
      head.setPointerCapture(e.pointerId); el.classList.add('dragging'); P.focus(id);
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const W = ws().clientWidth, H = ws().clientHeight;
      const x = TL.clamp(e.clientX - drag.dx, -el.offsetWidth + 80, W - 60), y = TL.clamp(e.clientY - drag.dy, 0, H - 36);
      el.style.left = x + 'px'; el.style.top = y + 'px';
    });
    const end = () => { if (!drag) return; drag = null; el.classList.remove('dragging'); g.st.x = el.offsetLeft; g.st.y = el.offsetTop; save(); };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    head.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) collapse.click(); });
    el.addEventListener('pointerdown', () => P.focus(id));
    // taille mémorisée
    if (typeof ResizeObserver !== 'undefined') {
      let first = true;
      new ResizeObserver(() => { if (first) { first = false; return; } if (mobile() || g.st.collapsed) return; g.st.w = el.offsetWidth; if (el.style.height) g.st.h = el.offsetHeight; save(); }).observe(el);
    }
    ws().append(el);
    P.els[id] = el;
    P.refresh(id);
    if (!silent) { save(); P.drawDock(); }
  };
  P.hide = function (id) {
    const el = P.els[id]; if (el) el.remove(); delete P.els[id];
    const st = P.state[P.mode] && P.state[P.mode][id]; if (st) st.open = false;
    save(); P.drawDock();
  };
  P.toggle = (id) => (P.els[id] ? P.hide(id) : P.open(id));
  P.focus = (id) => { if (P.els[id]) P.els[id].style.zIndex = ++P.z; };
  P.refresh = function (id) {
    const ids = id ? [id] : Object.keys(P.els);
    ids.forEach((k) => {
      const el = P.els[k]; if (!el) return;
      const body = el.querySelector('.panel-body');
      const top = body.scrollTop;
      body.innerHTML = '';
      try { P.defs[k].render(body); } catch (e) { console.error(e); body.append(h('p.small', 'Erreur : ' + e.message)); }
      body.scrollTop = top;
    });
  };
  P.reset = function () { delete P.state[P.mode]; save(); const m = P.mode, ids = P.ids; P.setMode(m, ids, P.lastDefaults); };
  const setModeOrig = P.setMode;
  P.setMode = function (mode, ids, defaults) { P.lastDefaults = defaults; setModeOrig(mode, ids, defaults); };

  // Barre des panneaux (accès rapide, indispensable sur téléphone)
  P.drawDock = function () {
    const dock = TL.$('#dock'); if (!dock) return;
    dock.innerHTML = '';
    (P.ids || []).forEach((id) => {
      const d = P.defs[id];
      dock.append(h('button.dock-btn' + (P.els[id] ? '.on' : ''), { type: 'button', title: d.title, 'aria-pressed': String(!!P.els[id]), onclick: () => P.toggle(id) }, h('span', { 'aria-hidden': 'true' }, d.icon || '▪'), h('span.dock-lbl', d.short || d.title)));
    });
    dock.hidden = !(P.ids || []).length;
  };
  window.addEventListener('resize', TL.debounce(() => {
    Object.entries(P.els).forEach(([id, el]) => { if (mobile()) return; const g = geom(id); el.style.left = g.x + 'px'; el.style.top = g.y + 'px'; });
  }, 150));
})();
