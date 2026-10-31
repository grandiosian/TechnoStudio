/* TechnoStudio — simulateur de circuits électriques (courant continu).
   Grille de nœuds ; chaque segment porte un composant. Résolution par analyse nodale
   (fils et interrupteurs fermés fusionnés), DEL modélisées par morceaux, détection
   du court-circuit et des DEL grillées. Symboles normalisés français. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const NS = 'http://www.w3.org/2000/svg';
  const S = 76, M = 30;

  const COMP = {
    wire: { name: 'Fil', pre: '' },
    battery: { name: 'Pile', pre: 'G', props: { v: 4.5 }, polar: true },
    lamp: { name: 'Lampe', pre: 'L', props: { r: 9 } },
    switch: { name: 'Interrupteur', pre: 'K' },
    push: { name: 'Bouton poussoir', pre: 'BP' },
    motor: { name: 'Moteur', pre: 'M', props: { r: 6 }, polar: true },
    led: { name: 'DEL', pre: 'D', props: { color: 'red' }, polar: true },
    resistor: { name: 'Résistance', pre: 'R', props: { r: 220 } },
    buzzer: { name: 'Buzzer', pre: 'BZ', props: { r: 150 }, polar: true },
    ldr: { name: 'Photorésistance', pre: 'LDR', props: { light: 70 } },
  };
  TL.CIRCUIT_COMP = COMP;
  const RINT = 0.5, LED_VF = { red: 1.9, green: 2.1, yellow: 2.0, blue: 3.0, white: 3.0 }, LED_RON = 12, LED_IMAX = 0.045;

  function svg(tag, attrs, ...kids) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    kids.flat().forEach((k) => k && el.appendChild(k));
    return el;
  }

  function edgeNodes(key, cols) {
    const [o, r, c] = key.split('-'); const R = +r, C = +c;
    const a = R * cols + C;
    return o === 'h' ? [a, a + 1] : [a, a + cols];
  }

  function resOf(c) {
    if (c.type === 'ldr') { const L = TL.clamp(c.light != null ? c.light : 70, 0, 100); return 150 + (100 - L) * (100 - L) * 1.2; }
    return c.r != null ? c.r : (COMP[c.type].props || {}).r;
  }

  /* ----- Résolution ----- */
  function solve(comps, cols, rows) {
    const N = cols * rows;
    const parent = [...Array(N).keys()];
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const conducting = (c) => c.type === 'wire' || (c.type === 'switch' && c.closed) || (c.type === 'push' && c.pressed);
    const list = Object.entries(comps).map(([k, c]) => { const [a, b] = edgeNodes(k, cols); return { k, c, a, b }; });
    list.forEach((e) => { if (conducting(e.c)) parent[find(e.a)] = find(e.b); });
    const groups = {}; let n = 0;
    for (let i = 0; i < N; i++) { const r = find(i); if (groups[r] == null) groups[r] = n++; }
    const G = (i) => groups[find(i)];
    const active = list.filter((e) => !conducting(e.c) && !['switch', 'push'].includes(e.c.type) && !e.c.burnt);
    let ledOn = {};
    let V = new Array(n).fill(0);
    for (let iter = 0; iter < 12; iter++) {
      const A = Array.from({ length: n }, () => new Float64Array(n));
      const Z = new Float64Array(n);
      for (let i = 0; i < n; i++) A[i][i] += 1e-9;
      const stamp = (a, b, g) => { if (a === b) return; A[a][a] += g; A[b][b] += g; A[a][b] -= g; A[b][a] -= g; };
      active.forEach((e) => {
        const a = G(e.a), b = G(e.b), c = e.c;
        if (c.type === 'battery') {
          const g = 1 / RINT, v = (c.v || 4.5) * (c.dir === -1 ? -1 : 1);
          stamp(a, b, g); if (a !== b) { Z[b] += v * g; Z[a] -= v * g; }
        } else if (c.type === 'led') {
          if (ledOn[e.k]) {
            const g = 1 / LED_RON, vf = LED_VF[c.color || 'red'] || 2;
            const [an, ca] = c.dir === -1 ? [b, a] : [a, b];
            stamp(an, ca, g); if (an !== ca) { Z[an] += g * vf; Z[ca] -= g * vf; }
          }
        } else {
          stamp(a, b, 1 / resOf(c));
        }
      });
      V = gauss(A, Z);
      let changed = false;
      active.filter((e) => e.c.type === 'led').forEach((e) => {
        const a = G(e.a), b = G(e.b), c = e.c;
        const vd = (c.dir === -1 ? V[b] - V[a] : V[a] - V[b]);
        const vf = LED_VF[c.color || 'red'] || 2;
        const on = ledOn[e.k] ? (vd - vf) / LED_RON > 0 : vd > vf;
        if (on !== !!ledOn[e.k]) { ledOn[e.k] = on; changed = true; }
      });
      if (!changed) break;
    }
    const out = { groups: G, V, comp: {}, short: false, nodeV: (i) => V[G(i)] };
    list.forEach((e) => {
      const a = G(e.a), b = G(e.b), c = e.c;
      const u = V[a] - V[b];
      let i = 0, extra = {};
      if (c.burnt) { out.comp[e.k] = { u, i: 0, burnt: true }; return; }
      if (c.type === 'battery') {
        const v = (c.v || 4.5) * (c.dir === -1 ? -1 : 1);
        i = (v - (V[b] - V[a])) / RINT; // courant sortant par la borne +
        if (Math.abs(i) > 2.5) { out.short = true; extra.short = true; }
        out.comp[e.k] = Object.assign({ u: Math.abs(V[b] - V[a]), i: Math.abs(i) }, extra); return;
      }
      if (c.type === 'led') {
        const vf = LED_VF[c.color || 'red'] || 2;
        const vd = c.dir === -1 ? -u : u;
        i = ledOn[e.k] ? Math.max(0, (vd - vf) / LED_RON) : 0;
        out.comp[e.k] = { u: vd, i, on: i > 0.002, over: i > LED_IMAX, bright: TL.clamp(i / 0.02, 0, 1) }; return;
      }
      if (conducting(c) || c.type === 'switch' || c.type === 'push') { out.comp[e.k] = { u: Math.abs(u), i: null }; return; }
      i = u / resOf(c);
      const ai = Math.abs(i);
      const r = { u: Math.abs(u), i: ai, sign: Math.sign(i) * (c.dir === -1 ? -1 : 1) };
      if (c.type === 'lamp') { r.bright = TL.clamp((ai / 0.5) ** 2 * 1.15, 0, 1); r.on = ai > 0.11; r.over = ai > 0.9; }
      if (c.type === 'motor') { r.on = ai > 0.15; r.speed = r.on ? TL.clamp(ai / 0.7, 0.2, 1.6) * r.sign : 0; }
      if (c.type === 'buzzer') r.on = ai > 0.012;
      out.comp[e.k] = r;
    });
    return out;
  }

  function gauss(A, b) {
    const n = b.length; if (!n) return [];
    const M = A.map((r, i) => { const x = Array.from(r); x.push(b[i]); return x; });
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c]; if (Math.abs(d) < 1e-15) continue;
      for (let r = 0; r < n; r++) {
        if (r === c) continue; const f = M[r][c] / d; if (!f) continue;
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => (Math.abs(r[i]) < 1e-15 ? 0 : r[n] / r[i]));
  }

  /* ----- Symboles (coordonnées locales : segment de -S/2 à +S/2) ----- */
  const L = S / 2;
  function symbol(c, st) {
    const g = svg('g', { class: 'sym sym-' + c.type });
    const ln = (x1, y1, x2, y2, cls) => svg('line', { x1, y1, x2, y2, class: cls || 'stroke' });
    const flip = c.dir === -1;
    switch (c.type) {
      case 'wire': g.append(ln(-L, 0, L, 0, 'stroke wire')); break;
      case 'battery': {
        const k = svg('g', flip ? { transform: 'scale(-1,1)' } : {});
        k.append(ln(-L, 0, -5, 0), ln(5, 0, L, 0), svg('line', { x1: -5, y1: -7, x2: -5, y2: 7, class: 'stroke heavy' }), svg('line', { x1: 5, y1: -15, x2: 5, y2: 15, class: 'stroke' }));
        g.append(k, svg('text', { x: flip ? -14 : 14, y: -12, class: 'pol' }, document.createTextNode('+')));
        break;
      }
      case 'lamp': {
        const glow = st && st.on ? st.bright : 0;
        g.append(ln(-L, 0, -13, 0), ln(13, 0, L, 0));
        if (glow) g.append(svg('circle', { r: 13 + 14 * glow, class: 'halo', style: `opacity:${0.25 + 0.55 * glow}` }));
        g.append(svg('circle', { r: 13, class: 'body' + (glow ? ' lit' : ''), style: glow ? `fill-opacity:${0.35 + 0.65 * glow}` : '' }),
          ln(-9, -9, 9, 9), ln(-9, 9, 9, -9));
        break;
      }
      case 'switch': case 'push': {
        const closed = c.type === 'switch' ? c.closed : c.pressed;
        g.append(ln(-L, 0, -13, 0), ln(13, 0, L, 0), svg('circle', { cx: -13, r: 2.5, class: 'dot' }), svg('circle', { cx: 13, r: 2.5, class: 'dot' }));
        if (c.type === 'switch') g.append(closed ? ln(-13, 0, 13, 0, 'stroke lever') : ln(-13, 0, 11, -14, 'stroke lever'));
        else {
          const y = closed ? 0 : -9;
          g.append(ln(-14, y, 14, y, 'stroke lever'), ln(0, y, 0, y - 10, 'stroke'), ln(-5, y - 10, 5, y - 10, 'stroke'));
        }
        g.append(svg('rect', { x: -18, y: -22, width: 36, height: 30, class: 'grab' }));
        break;
      }
      case 'motor': {
        g.append(ln(-L, 0, -14, 0), ln(14, 0, L, 0), svg('circle', { r: 14, class: 'body' + (st && st.on ? ' run' : '') }),
          svg('text', { y: 5, class: 'glyph' }, document.createTextNode('M')),
          svg('path', { d: 'M 0 -19 A 19 19 0 0 1 16 -10', class: 'rotor', 'data-rotor': '1', style: st && st.on ? '' : 'opacity:0' }));
        break;
      }
      case 'led': {
        const col = c.color || 'red';
        const k = svg('g', flip ? { transform: 'scale(-1,1)' } : {});
        k.append(ln(-L, 0, -9, 0), ln(9, 0, L, 0));
        if (st && st.on && !c.burnt) k.append(svg('circle', { r: 16, class: 'halo led-' + col, style: `opacity:${0.25 + 0.6 * st.bright}` }));
        k.append(svg('path', { d: 'M -9 -10 L 9 0 L -9 10 Z', class: 'body led-' + col + (st && st.on ? ' lit' : '') }), ln(9, -10, 9, 10),
          svg('path', { d: 'M 2 -12 l 7 -8 m -4 0 h 4 v 4 M 8 -10 l 7 -8 m -4 0 h 4 v 4', class: 'stroke thin' }));
        g.append(k);
        if (c.burnt) g.append(svg('path', { d: 'M -8 -8 L 8 8 M -8 8 L 8 -8', class: 'stroke burnt' }));
        break;
      }
      case 'resistor': case 'ldr': {
        g.append(ln(-L, 0, -15, 0), ln(15, 0, L, 0), svg('rect', { x: -15, y: -6, width: 30, height: 12, class: 'body' }));
        if (c.type === 'ldr') g.append(svg('circle', { r: 19, class: 'stroke thin nofill' }), svg('path', { d: 'M -16 -22 l 7 8 m -1 -4 v 4 h -4 M -6 -24 l 7 8 m -1 -4 v 4 h -4', class: 'stroke thin' }));
        break;
      }
      case 'buzzer': {
        g.append(ln(-L, 0, -10, 0), ln(10, 0, L, 0), svg('path', { d: 'M -10 -2 L -10 6 L 10 6 L 10 -2 A 10 10 0 0 0 -10 -2 Z', class: 'body' + (st && st.on ? ' run' : '') }));
        if (st && st.on) g.append(svg('path', { d: 'M -8 -16 q 8 -6 16 0 M -12 -21 q 12 -8 24 0', class: 'stroke thin waves' }));
        break;
      }
    }
    return g;
  }

  /* ----- Composant interactif ----- */
  class Circuit {
    constructor(cfg, opts) {
      this.cfg = cfg; this.opts = opts || {};
      this.cols = cfg.cols || 7; this.rows = cfg.rows || 5;
      this.comps = {};
      const init = cfg.initial || {};
      for (const k in init) this.comps[k] = Object.assign({ locked: this.opts.editor ? true : !cfg.editableInitial }, init[k]);
      const saved = this.opts.value && this.opts.value.comps;
      if (saved) for (const k in saved) if (!this.comps[k] || !this.comps[k].locked) this.comps[k] = Object.assign({}, saved[k]); else Object.assign(this.comps[k], { closed: saved[k].closed, light: saved[k].light });
      if (saved) for (const k in this.comps) if (!this.comps[k].locked && !saved[k]) delete this.comps[k];
      this.tool = 'hand'; this.sel = null; this.anim = null;
      this.el = this.build();
      this.update();
    }
    paletteLeft(type) {
      const p = this.cfg.palette;
      if (this.opts.editor || !p) return Infinity;
      if (p[type] == null) return 0;
      if (p[type] < 0) return Infinity;
      const used = Object.values(this.comps).filter((c) => c.type === type && !c.locked).length;
      return p[type] - used;
    }
    build() {
      const W = (this.cols - 1) * S + 2 * M, H = (this.rows - 1) * S + 2 * M;
      this.svg = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'circ-svg', role: 'img', 'aria-label': 'Schéma électrique' });
      this.layerE = svg('g'); this.layerC = svg('g'); this.layerN = svg('g');
      this.svg.append(this.layerE, this.layerC, this.layerN);
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        if (c < this.cols - 1) this.layerE.append(this.edgeHit('h-' + r + '-' + c));
        if (r < this.rows - 1) this.layerE.append(this.edgeHit('v-' + r + '-' + c));
        this.layerN.append(svg('circle', { cx: M + c * S, cy: M + r * S, r: 2.2, class: 'node' }));
      }
      // tracé de fils au glisser
      let drag = null;
      const nodeAt = (ev) => {
        const pt = this.svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
        const c = Math.round((p.x - M) / S), r = Math.round((p.y - M) / S);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return null;
        if (Math.hypot(p.x - (M + c * S), p.y - (M + r * S)) > S * 0.32) return null;
        return [r, c];
      };
      this.svg.addEventListener('pointerdown', (ev) => { if (this.tool === 'wire') { const n = nodeAt(ev); if (n) { drag = n; this.svg.setPointerCapture(ev.pointerId); ev.preventDefault(); } } });
      this.svg.addEventListener('pointermove', (ev) => {
        if (!drag) return; const n = nodeAt(ev); if (!n) return;
        const [r0, c0] = drag, [r1, c1] = n;
        if (Math.abs(r0 - r1) + Math.abs(c0 - c1) !== 1) return;
        const k = r0 === r1 ? 'h-' + r0 + '-' + Math.min(c0, c1) : 'v-' + Math.min(r0, r1) + '-' + c0;
        if (!this.comps[k] && this.paletteLeft('wire') > 0) { this.comps[k] = { type: 'wire' }; this.changed(); }
        drag = n; this.dragged = true;
      });
      const end = () => { drag = null; setTimeout(() => (this.dragged = false), 0); };
      this.svg.addEventListener('pointerup', end); this.svg.addEventListener('pointercancel', end);

      this.palette = h('div.circ-tools', { role: 'toolbar', 'aria-label': 'Composants' });
      this.inspector = h('div.circ-insp');
      this.status = h('div.circ-status', { 'aria-live': 'polite' });
      const wrap = h('div.circ', this.palette, h('div.circ-board', this.svg), this.status, this.inspector);
      this.drawPalette();
      return wrap;
    }
    edgeHit(k) {
      const [o, r, c] = k.split('-').map((x, i) => (i ? +x : x));
      const x1 = M + c * S, y1 = M + r * S, x2 = o === 'h' ? x1 + S : x1, y2 = o === 'h' ? y1 : y1 + S;
      const g = svg('g', { class: 'edge', 'data-k': k });
      g.append(svg('line', { x1, y1, x2, y2, class: 'ghost' }), svg('line', { x1, y1, x2, y2, class: 'hit' }));
      g.addEventListener('click', () => { if (!this.dragged) this.onEdge(k); });
      return g;
    }
    drawPalette() {
      this.palette.innerHTML = '';
      const tools = [['hand', 'Agir / mesurer', '☝']];
      const types = this.opts.editor ? Object.keys(COMP) : Object.keys(COMP).filter((t) => this.cfg.palette && this.cfg.palette[t] != null);
      types.forEach((t) => tools.push([t, COMP[t].name, null]));
      if (!this.cfg.demo || this.opts.editor) tools.push(['erase', 'Gomme', '⌫']);
      if (this.cfg.demo && !this.opts.editor) { this.palette.hidden = true; return; }
      tools.forEach(([id, name, ico]) => {
        const left = COMP[id] ? this.paletteLeft(id) : Infinity;
        const b = h('button.tool' + (this.tool === id ? '.on' : ''), { type: 'button', title: name, 'aria-pressed': String(this.tool === id), disabled: left <= 0 && this.tool !== id },
          ico ? h('span.tool-ico', ico) : h('span.tool-sym', { html: this.miniSym(id) }),
          h('span.tool-name', name), left !== Infinity ? h('span.tool-n.mono', '×' + Math.max(0, left)) : null);
        b.onclick = () => { this.tool = id; this.sel = null; this.drawPalette(); this.update(); };
        this.palette.appendChild(b);
      });
    }
    miniSym(t) {
      const s = svg('svg', { viewBox: '-38 -24 76 48', class: 'mini' });
      s.append(symbol(Object.assign({ type: t }, COMP[t].props), null));
      return s.outerHTML;
    }
    nextLabel(type) {
      const pre = COMP[type].pre; if (!pre) return '';
      const used = new Set(Object.values(this.comps).filter((c) => c.type === type).map((c) => c.label));
      let i = 1; while (used.has(pre + i)) i++; return pre + i;
    }
    onEdge(k) {
      const c = this.comps[k];
      if (this.tool === 'erase') {
        if (c && (!c.locked || this.opts.editor)) { delete this.comps[k]; if (this.sel === k) this.sel = null; this.changed(); }
        return;
      }
      if (c) {
        if (this.tool === 'hand' || this.tool === c.type) {
          if (c.type === 'switch' && this.tool === 'hand') { c.closed = !c.closed; this.sel = k; this.changed(); return; }
          if (c.type === 'push' && this.tool === 'hand') { this.sel = k; this.update(); return; }
          this.sel = this.sel === k ? null : k; this.update(); return;
        }
        if (!c.locked || this.opts.editor) { // remplacement
          if (this.paletteLeft(this.tool) <= 0) return;
          this.comps[k] = this.newComp(this.tool); this.sel = k; this.changed();
        }
        return;
      }
      if (this.tool === 'hand') { this.sel = null; this.update(); return; }
      if (this.paletteLeft(this.tool) <= 0) { TL.toast('Plus de « ' + COMP[this.tool].name + ' » disponible.'); return; }
      this.comps[k] = this.newComp(this.tool);
      if (this.tool !== 'wire') this.sel = k;
      this.changed();
    }
    newComp(type) {
      const c = Object.assign({ type }, TL.clone(COMP[type].props || {}));
      if (COMP[type].pre) c.label = this.nextLabel(type);
      if (type === 'battery' && this.cfg.battery) c.v = this.cfg.battery;
      if (this.opts.editor) c.locked = true;
      return c;
    }
    changed() { this.drawPalette(); this.update(); if (this.opts.onChange) this.opts.onChange(this.serialize()); }
    serialize() {
      const out = {};
      for (const k in this.comps) { const c = Object.assign({}, this.comps[k]); delete c.pressed; if (this.opts.editor) delete c.burnt; out[k] = c; }
      return { comps: out };
    }
    update() {
      const res = (this.res = solve(this.comps, this.cols, this.rows));
      // DEL grillées (surintensité)
      let burnt = false;
      for (const k in res.comp) if (this.comps[k].type === 'led' && res.comp[k].over && !this.comps[k].burnt) { this.comps[k].burnt = true; burnt = true; }
      if (burnt) { TL.toast('Une DEL a grillé : il manque une résistance de protection.', 'bad'); return this.changed(); }
      this.layerC.innerHTML = '';
      const energized = new Set();
      for (const k in this.comps) { const r = res.comp[k]; if (r && r.i != null && r.i > 0.002 && this.comps[k].type !== 'battery' && !res.short) { const [a, b] = edgeNodes(k, this.cols); energized.add(res.groups(a)); energized.add(res.groups(b)); } }
      if (res.short) for (const k in this.comps) if (this.comps[k].type === 'battery' && res.comp[k].short) { const [a, b] = edgeNodes(k, this.cols); energized.add(res.groups(a)); }
      for (const k in this.comps) {
        const c = this.comps[k], st = res.comp[k];
        const [o, r, col] = k.split('-');
        const x = M + (+col) * S + (o === 'h' ? S / 2 : 0), y = M + (+r) * S + (o === 'v' ? S / 2 : 0);
        const g = svg('g', { transform: `translate(${x},${y}) rotate(${o === 'v' ? 90 : 0})`, class: 'comp' + (this.sel === k ? ' sel' : '') + (c.locked && !this.opts.editor ? ' locked' : '') });
        const sym = symbol(c, st);
        if (c.type === 'wire') { const [a] = edgeNodes(k, this.cols); if (energized.has(res.groups(a))) sym.classList.add(res.short ? 'short' : 'live'); }
        if ((c.type === 'switch' || c.type === 'push') && energized.has(res.groups(edgeNodes(k, this.cols)[0])) && (c.closed || c.pressed)) sym.classList.add(res.short ? 'short' : 'live');
        g.append(sym);
        const tg = svg('g', { transform: `translate(${x},${y})`, class: 'ctext' });
        const vert = o === 'v';
        if (c.label) tg.append(svg('text', { x: vert ? 22 : 0, y: vert ? 4 : 32, class: 'clabel', 'text-anchor': vert ? 'start' : 'middle' }, document.createTextNode(c.label)));
        if (c.type === 'resistor') tg.append(svg('text', { x: vert ? -14 : 0, y: vert ? 4 : -12, class: 'cval', 'text-anchor': vert ? 'end' : 'middle' }, document.createTextNode(fmtR(c.r))));
        if (c.type === 'battery') tg.append(svg('text', { x: vert ? 22 : 0, y: vert ? 20 : -20, class: 'cval', 'text-anchor': vert ? 'start' : 'middle' }, document.createTextNode(TL.fmtNum(c.v || 4.5, 1) + ' V')));
        g.addEventListener('click', (e) => { e.stopPropagation(); this.onEdge(k); });
        if (c.type === 'push') {
          const down = (e) => { if (this.tool !== 'hand') return; e.preventDefault(); c.pressed = true; this.update(); };
          const up = () => { if (c.pressed) { c.pressed = false; this.update(); } };
          g.addEventListener('pointerdown', down); g.addEventListener('pointerup', up); g.addEventListener('pointerleave', up); g.addEventListener('pointercancel', up);
        }
        this.layerC.append(g, tg);
      }
      this.svg.classList.toggle('tool-active', this.tool !== 'hand');
      this.drawStatus(); this.drawInspector(); this.animate();
      if (this.opts.onUpdate) this.opts.onUpdate(res);
    }
    animate() {
      const motors = Object.keys(this.comps).filter((k) => this.comps[k].type === 'motor' && this.res.comp[k] && this.res.comp[k].on);
      if (this.anim) cancelAnimationFrame(this.anim);
      if (!motors.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let t0 = performance.now(); const angles = {};
      const step = (t) => {
        if (!this.svg.isConnected) return;
        const dt = (t - t0) / 1000; t0 = t;
        TL.$$('[data-rotor]', this.layerC).forEach((p, i) => {
          const k = motors[i]; if (!k) return; const sp = this.res.comp[k] ? this.res.comp[k].speed : 0;
          angles[i] = ((angles[i] || 0) + sp * 360 * dt) % 360;
          p.setAttribute('transform', `rotate(${angles[i]})`);
        });
        this.anim = requestAnimationFrame(step);
      };
      this.anim = requestAnimationFrame(step);
    }
    drawStatus() {
      const res = this.res; const parts = [];
      const loads = Object.entries(this.comps).filter(([, c]) => ['lamp', 'motor', 'led', 'buzzer'].includes(c.type));
      if (!Object.values(this.comps).some((c) => c.type === 'battery')) parts.push(h('span.pill.neutral', 'Pas de générateur'));
      if (res.short) parts.push(h('span.pill.bad', 'Court-circuit sur la pile !'));
      loads.forEach(([k, c]) => {
        const st = res.comp[k] || {};
        const word = c.burnt ? 'grillée' : c.type === 'motor' ? (st.on ? (st.speed > 0 ? 'tourne ↻' : 'tourne ↺') : 'arrêté') : c.type === 'buzzer' ? (st.on ? 'sonne' : 'muet') : (st.on ? (st.bright < 0.45 && c.type === 'lamp' ? 'faible' : 'allumée') : 'éteinte');
        parts.push(h('span.pill' + (c.burnt ? '.bad' : st.on ? '.on' : '.neutral'), h('b', c.label), ' ' + word));
      });
      this.status.innerHTML = ''; this.status.append(...parts);
    }
    drawInspector() {
      const k = this.sel; this.inspector.innerHTML = '';
      if (!k || !this.comps[k]) { this.inspector.append(h('p.small.muted', this.cfg.demo ? 'Touche les interrupteurs et les composants pour agir et mesurer.' : this.tool === 'hand' ? 'Choisis un composant puis touche un segment de la grille. Avec « Fil », tu peux aussi glisser d’un point à l’autre. Touche un composant pour le mesurer.' : 'Touche un segment pour placer : ' + (COMP[this.tool] ? COMP[this.tool].name : 'gomme') + '.')); return; }
      const c = this.comps[k], st = this.res.comp[k] || {};
      const rows = [h('div.insp-title', h('b', (c.label ? c.label + ' · ' : '') + COMP[c.type].name), c.locked && !this.opts.editor ? h('span.small.muted', ' (fixé)') : null)];
      const meas = [];
      if (st.u != null && c.type !== 'wire') meas.push(['Tension U', TL.fmtNum(Math.abs(st.u), 2) + ' V']);
      if (st.i != null && c.type !== 'wire') meas.push(['Intensité I', st.i < 1 ? TL.fmtNum(st.i * 1000, 0) + ' mA' : TL.fmtNum(st.i, 2) + ' A']);
      if (c.type === 'resistor' || c.type === 'ldr' || c.type === 'lamp' || c.type === 'motor') meas.push(['Résistance', fmtR(resOf(c))]);
      if (meas.length) rows.push(h('dl.meas', meas.map(([a, b]) => [h('dt', a), h('dd.mono', b)])));
      const acts = h('div.insp-acts');
      const editable = !c.locked || this.opts.editor;
      if (c.type === 'switch') acts.append(h('button.btn.small', { type: 'button', onclick: () => { c.closed = !c.closed; this.changed(); } }, c.closed ? 'Ouvrir' : 'Fermer'));
      if (COMP[c.type].polar && editable) acts.append(h('button.btn.small', { type: 'button', onclick: () => { c.dir = c.dir === -1 ? 1 : -1; this.changed(); } }, 'Retourner'));
      if (c.type === 'resistor' && editable) {
        const s = h('select.field.small', { 'aria-label': 'Valeur' }, [10, 47, 100, 220, 330, 470, 1000, 4700, 10000].map((v) => h('option', { value: v, selected: v === c.r }, fmtR(v))));
        s.onchange = () => { c.r = +s.value; this.changed(); }; acts.append(s);
      }
      if (c.type === 'battery' && this.opts.editor) {
        const s = h('select.field.small', { 'aria-label': 'Tension' }, [1.5, 3, 4.5, 6, 9, 12].map((v) => h('option', { value: v, selected: v === c.v }, TL.fmtNum(v) + ' V')));
        s.onchange = () => { c.v = +s.value; this.changed(); }; acts.append(s);
      }
      if (c.type === 'led' && editable) {
        const s = h('select.field.small', { 'aria-label': 'Couleur' }, [['red', 'rouge'], ['green', 'verte'], ['yellow', 'jaune'], ['blue', 'bleue']].map(([v, n]) => h('option', { value: v, selected: v === c.color }, n)));
        s.onchange = () => { c.color = s.value; this.changed(); }; acts.append(s);
      }
      if (c.type === 'ldr') {
        const s = h('input', { type: 'range', min: 0, max: 100, value: c.light != null ? c.light : 70, 'aria-label': 'Éclairement' });
        s.oninput = () => { c.light = +s.value; this.update(); };
        s.onchange = () => this.changed();
        acts.append(h('label.small', 'Lumière ', s));
      }
      if (c.burnt && editable) acts.append(h('button.btn.small', { type: 'button', onclick: () => { delete c.burnt; this.changed(); } }, 'Remplacer la DEL'));
      if (this.opts.editor) acts.append(h('label.small', h('input', { type: 'checkbox', checked: !!c.locked, onchange: (e) => { c.locked = e.target.checked; this.changed(); } }), ' fixé pour l’élève'));
      if (editable && !(this.cfg.demo && !this.opts.editor)) acts.append(h('button.btn.small.ghost', { type: 'button', onclick: () => { delete this.comps[k]; this.sel = null; this.changed(); } }, 'Supprimer'));
      rows.push(acts);
      this.inspector.append(...rows);
    }
    /* Évaluation des objectifs */
    evaluate(goals) {
      const save = TL.clone(this.comps);
      const setSwitches = (v) => Object.values(this.comps).forEach((c) => { if (c.type === 'switch') c.closed = v; if (c.type === 'push') c.pressed = v; });
      const loads = (cs) => Object.entries(cs).filter(([, c]) => ['lamp', 'motor', 'led', 'buzzer'].includes(c.type));
      const on = (res, k) => res.comp[k] && res.comp[k].on && !this.comps[k].burnt;
      const out = goals.map((g) => {
        let ok = false;
        try {
          if (g.type === 'count') ok = Object.values(this.comps).filter((c) => c.type === g.comp).length === g.n;
          else if (g.type === 'noShort') { setSwitches(true); ok = !solve(this.comps, this.cols, this.rows).short; }
          else if (g.type === 'lit' || g.type === 'on') {
            setSwitches(true); const res = solve(this.comps, this.cols, this.rows);
            const L = loads(this.comps).filter(([, c]) => !g.comp || c.type === g.comp);
            const n = L.filter(([k]) => on(res, k)).length;
            ok = !res.short && L.length > 0 && (g.min ? n >= g.min : n === L.length);
          } else if (g.type === 'switchControls') {
            setSwitches(true); const r1 = solve(this.comps, this.cols, this.rows);
            setSwitches(false); const r0 = solve(this.comps, this.cols, this.rows);
            const L = loads(this.comps);
            const hasSw = Object.values(this.comps).some((c) => c.type === 'switch' || c.type === 'push');
            ok = hasSw && L.length > 0 && !r1.short && L.every(([k]) => on(r1, k)) && L.every(([k]) => !on(r0, k));
          } else if (g.type === 'parallel' || g.type === 'series') {
            setSwitches(true);
            const L = loads(this.comps).filter(([, c]) => !g.comp || c.type === g.comp);
            if (L.length < 2) ok = false;
            else {
              const r = solve(this.comps, this.cols, this.rows);
              ok = !r.short && L.every(([k]) => on(r, k)) && L.every(([k]) => {
                const cs = Object.assign({}, this.comps); delete cs[k];
                const rr = solve(cs, this.cols, this.rows);
                const others = L.filter(([x]) => x !== k);
                return g.type === 'parallel' ? others.every(([x]) => rr.comp[x] && rr.comp[x].on) : others.every(([x]) => !(rr.comp[x] && rr.comp[x].on));
              });
            }
          } else if (g.type === 'eachSwitch') {
            // chaque interrupteur commande sa propre charge (montage en dérivation commandé)
            const sws = Object.keys(this.comps).filter((k) => this.comps[k].type === 'switch');
            ok = sws.length >= 2 && sws.every((s) => {
              setSwitches(false); this.comps[s].closed = true;
              const r = solve(this.comps, this.cols, this.rows);
              const n = loads(this.comps).filter(([k]) => on(r, k)).length;
              return n >= 1 && n < loads(this.comps).length;
            });
          } else if (g.type === 'ledSafe') {
            setSwitches(true); const r = solve(this.comps, this.cols, this.rows);
            const leds = Object.keys(this.comps).filter((k) => this.comps[k].type === 'led');
            ok = leds.length > 0 && leds.every((k) => !this.comps[k].burnt && r.comp[k].on && r.comp[k].i <= 0.03);
          } else if (g.type === 'motorDir') {
            setSwitches(true); const r = solve(this.comps, this.cols, this.rows);
            const ms = Object.keys(this.comps).filter((k) => this.comps[k].type === 'motor');
            ok = ms.length > 0 && ms.every((k) => r.comp[k].on && Math.sign(r.comp[k].speed) === (g.dir || 1));
          } else if (g.type === 'darkOn') {
            // la charge s'allume dans l'obscurité et s'éteint en pleine lumière
            const ldr = Object.values(this.comps).filter((c) => c.type === 'ldr');
            setSwitches(true);
            ldr.forEach((c) => (c.light = 5)); const rd = solve(this.comps, this.cols, this.rows);
            ldr.forEach((c) => (c.light = 95)); const rl = solve(this.comps, this.cols, this.rows);
            const L = loads(this.comps).filter(([, c]) => !g.comp || c.type === g.comp);
            ok = ldr.length > 0 && L.length > 0 && L.every(([k]) => on(rd, k)) && L.every(([k]) => !on(rl, k));
          }
        } catch (e) { ok = false; }
        this.comps = TL.clone(save);
        return { goal: g, ok };
      });
      this.comps = save; this.update();
      return out;
    }
  }
  function fmtR(r) { return r >= 1000 ? TL.fmtNum(r / 1000, 1) + ' kΩ' : TL.fmtNum(r, 0) + ' Ω'; }
  TL.Circuit = Circuit;
  TL.solveCircuit = solve;

  const GOAL_TEXT = {
    lit: (g) => g.min ? `Au moins ${g.min} récepteur(s) fonctionne(nt)` : 'Tous les récepteurs fonctionnent',
    noShort: () => 'Pas de court-circuit',
    switchControls: () => 'L’interrupteur commande les récepteurs',
    parallel: () => 'Montage en dérivation : chaque récepteur reste alimenté si on retire l’autre',
    series: () => 'Montage en série : retirer un récepteur éteint les autres',
    eachSwitch: () => 'Chaque interrupteur commande son propre récepteur',
    ledSafe: () => 'La DEL brille sans dépasser 30 mA',
    count: (g) => `Exactement ${g.n} × ${COMP[g.comp] ? COMP[g.comp].name.toLowerCase() : g.comp}`,
    motorDir: (g) => 'Le moteur tourne dans le sens ' + ((g.dir || 1) > 0 ? 'horaire ↻' : 'anti-horaire ↺'),
    darkOn: () => 'Le récepteur s’allume dans l’obscurité et s’éteint à la lumière',
  };
  TL.CIRCUIT_GOALS = GOAL_TEXT;

  /* ----- Activité ----- */
  TL.activities.circuit = {
    label: 'Simulateur de circuit', icon: '⏚', graded: true,
    render(b, ctx) {
      const goals = b.goals || [];
      const goalList = h('ul.goals');
      const drawGoals = (res) => {
        goalList.innerHTML = '';
        goals.forEach((g, i) => goalList.append(h('li' + (res ? (res[i].ok ? '.is-ok' : '.is-bad') : ''), h('span.goal-mark', res ? (res[i].ok ? '✓' : '✗') : '○'), g.text || (GOAL_TEXT[g.type] ? GOAL_TEXT[g.type](g) : g.type))));
      };
      const sim = new Circuit(b, { value: ctx.answer && ctx.answer.value, onChange: (v) => ctx.save({ value: v }) });
      let bar = null;
      if (!b.demo && goals.length) {
        bar = TL.checkBar(ctx, {
          checkLabel: 'Tester mon montage',
          allowRetry: true,
          check() {
            const r = sim.evaluate(goals);
            drawGoals(r);
            const good = r.filter((x) => x.ok).length;
            return { value: sim.serialize(), correct: good === r.length, score: good / r.length, msg: `${good} objectif(s) atteint(s) sur ${r.length}.` };
          },
        });
      }
      drawGoals(ctx.answer && ctx.answer.attempts ? sim.evaluate(goals) : null);
      return h('div.act', b.question ? h('div.qhead', { html: TL.md(b.question) }) : null,
        goals.length && !b.demo ? h('div.goalbox', h('div.label-up', 'Objectifs'), goalList) : null,
        sim.el, bar);
    },
  };
})();
