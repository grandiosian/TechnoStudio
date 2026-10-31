/* TechnoStudio — activités : contenus (texte, image, fiche papier, lien) et exercices notés
   (QCM, texte à trous, calcul, association, ordre, classement, chaînes info/énergie,
   schéma à légender, procédure pas à pas, compte rendu). */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const A = (TL.activities = TL.activities || {});

  /* ---------- Barre de vérification commune ---------- */
  // opts.check() → {correct, score, msg}; opts.reveal() affiche la correction.
  TL.checkBar = function (ctx, opts) {
    const fb = h('div.fb', { 'aria-live': 'polite' });
    const btnCheck = h('button.btn.primary', { type: 'button' }, opts.checkLabel || 'Vérifier');
    const btnReveal = h('button.btn.ghost', { type: 'button', hidden: true }, 'Voir la correction');
    const btnRetry = h('button.btn.ghost', { type: 'button', hidden: true }, 'Recommencer');
    const bar = h('div.checkbar', btnCheck, btnReveal, btnRetry, fb);
    const b = ctx.block;
    const showExpl = () => (b.explanation ? h('div.expl', { html: TL.md(b.explanation) }) : null);

    function render(ans) {
      fb.innerHTML = ''; fb.className = 'fb';
      if (!ans || !ans.attempts) { btnReveal.hidden = true; btnRetry.hidden = true; btnCheck.hidden = false; return; }
      if (ans.correct) {
        fb.classList.add('ok');
        fb.append(...[h('strong', ans.revealed ? 'Correction affichée.' : (ans.attempts === 1 ? 'Juste du premier coup.' : 'Juste.')), ' ', ans.msg || '', showExpl()].filter((x) => x != null));
        btnReveal.hidden = true; btnCheck.hidden = true; btnRetry.hidden = !opts.allowRetry;
      } else if (ans.revealed) {
        fb.classList.add('info');
        fb.append(h('strong', 'Correction affichée.'), ' ', showExpl() || '');
        btnReveal.hidden = true; btnCheck.hidden = true; btnRetry.hidden = false;
      } else {
        fb.classList.add('bad');
        fb.append(...[h('strong', 'Pas encore.'), ' ', ans.msg || '', b.hint && ans.attempts >= 1 ? h('div.hint', { html: '<b>Indice</b> · ' + TL.inlineMd(b.hint) }) : null].filter((x) => x != null));
        btnReveal.hidden = !(opts.reveal && ans.attempts >= 2);
        btnCheck.hidden = false; btnRetry.hidden = true;
      }
    }
    btnCheck.onclick = () => {
      const r = opts.check();
      if (!r) return;
      const prev = ctx.answer || {};
      const ans = Object.assign({}, prev, r, { attempts: (prev.attempts || 0) + 1, done: !!r.correct, at: Date.now() });
      if (prev.done && prev.score > ans.score) ans.score = prev.score;
      ctx.result(ans);
      render(ans);
      if (r.correct) bar.closest('.block')?.classList.add('flash-ok');
    };
    btnReveal.onclick = () => {
      opts.reveal();
      const ans = Object.assign({}, ctx.answer, { revealed: true, done: true, correct: false, score: Math.min((ctx.answer && ctx.answer.score) || 0, 0.5), at: Date.now() });
      ctx.result(ans); render(ans);
    };
    btnRetry.onclick = () => { if (opts.reset) opts.reset(); const ans = Object.assign({}, ctx.answer, { correct: false, revealed: false, done: ctx.answer && ctx.answer.done, msg: '' }); ans.attempts = 0; ctx.result(ans); render(ans); };
    if (ctx.readonly) { btnCheck.disabled = false; }
    render(ctx.answer);
    bar.render = render;
    return bar;
  };

  const qhead = (b, fallback) => h('div.qhead', { html: TL.md(b.question || fallback || '') });

  /* ---------- Contenus ---------- */
  A.text = { label: 'Texte / cours', icon: '¶', render: (b) => h('div.prose', { html: TL.md(b.md) }) };

  A.image = {
    label: 'Image', icon: '▣',
    render(b) {
      const img = h('img', { src: b.src, alt: b.alt || b.caption || '', loading: 'lazy' });
      const fig = h('figure.figure' + (b.small ? '.small' : ''), img, b.caption ? h('figcaption', b.caption) : null);
      img.onclick = () => TL.modal(b.caption || 'Image', h('img.zoomed', { src: b.src, alt: b.alt || '' }));
      return fig;
    },
  };

  A.svg = {
    label: 'Schéma (SVG)', icon: '◇',
    render: (b) => h('figure.figure.svgfig', h('div.svgwrap', { html: b.svg || '' }), b.caption ? h('figcaption', b.caption) : null),
  };

  A.scan = {
    label: 'Fiche papier d’origine', icon: '⎙',
    render(b) {
      const pages = b.pages || (b.src ? [b.src] : []);
      const det = h('details.scan', { open: !!b.open },
        h('summary', h('span.scan-ico', '⎙'), b.title || 'Fiche papier d’origine', h('span.muted', ` · ${pages.length} page${pages.length > 1 ? 's' : ''}`)),
        h('div.scan-pages', pages.map((p, i) => h('img', { src: p, alt: 'Page ' + (i + 1), loading: 'lazy', onclick: () => TL.modal('Page ' + (i + 1), h('img.zoomed', { src: p })) }))));
      return det;
    },
  };

  A.link = {
    label: 'Lien / vidéo', icon: '↗',
    render: (b) => h('a.linkcard', { href: b.url, target: '_blank', rel: 'noopener' },
      h('span.linkcard-ico', b.kind === 'video' ? '▶' : '↗'),
      h('span', h('strong', b.title || b.url), b.text ? h('small', b.text) : null, h('small.mono', (b.url || '').replace(/^https?:\/\//, '').slice(0, 60)))),
  };

  /* ---------- QCM ---------- */
  A.qcm = {
    label: 'QCM / Vrai-Faux', icon: '◉', graded: true,
    render(b, ctx) {
      const multiple = b.multiple || b.options.filter((o) => o.correct).length > 1;
      const order = b.shuffle === false ? b.options.map((_, i) => i) : TL.shuffle(b.options.map((_, i) => i), ctx.seed);
      let sel = new Set((ctx.answer && ctx.answer.value) || []);
      const items = order.map((i) => {
        const o = b.options[i];
        const btn = h('button.opt', { type: 'button', role: multiple ? 'checkbox' : 'radio', 'aria-checked': String(sel.has(i)) },
          h('span.opt-mark', multiple ? '' : ''), h('span.opt-text', { html: TL.inlineMd(o.text) }), h('span.opt-fb'));
        btn.onclick = () => {
          if (ctx.answer && ctx.answer.done && ctx.answer.correct) return;
          if (multiple) sel.has(i) ? sel.delete(i) : sel.add(i); else sel = new Set([i]);
          paint(false); ctx.save({ value: [...sel] });
        };
        btn._i = i;
        return btn;
      });
      const list = h('div.opts' + (multiple ? '.multi' : ''), items);
      function paint(showResult, reveal) {
        items.forEach((btn) => {
          const i = btn._i, o = b.options[i];
          btn.setAttribute('aria-checked', String(sel.has(i)));
          btn.classList.remove('is-ok', 'is-bad', 'is-missed');
          btn.querySelector('.opt-fb').textContent = '';
          if (showResult) {
            if (sel.has(i) && o.correct) btn.classList.add('is-ok');
            else if (sel.has(i) && !o.correct) btn.classList.add('is-bad');
            else if (reveal && o.correct) btn.classList.add('is-missed');
            if (sel.has(i) && o.feedback) btn.querySelector('.opt-fb').textContent = o.feedback;
          }
        });
      }
      const bar = TL.checkBar(ctx, {
        check() {
          if (!sel.size) { TL.toast('Choisis une réponse.'); return null; }
          let good = 0, bad = 0;
          const nCorrect = b.options.filter((o) => o.correct).length;
          sel.forEach((i) => (b.options[i].correct ? good++ : bad++));
          const correct = good === nCorrect && bad === 0;
          paint(true);
          const score = multiple ? Math.max(0, (good - bad) / nCorrect) : (correct ? 1 : 0);
          return { value: [...sel], correct, score, msg: multiple && !correct ? `${good} bonne(s) réponse(s) sur ${nCorrect}${bad ? `, ${bad} erreur(s)` : ''}.` : '' };
        },
        reveal() { sel = new Set(b.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0)); paint(true, true); },
        reset() { sel = new Set(); paint(false); },
      });
      if (ctx.answer && ctx.answer.attempts) paint(true, ctx.answer.revealed);
      return h('div.act', qhead(b), multiple ? h('p.small.muted', 'Plusieurs réponses possibles.') : null, list, bar);
    },
  };

  /* ---------- Texte à trous ---------- */
  // [[réponse]]  [[rép1|rép2]] (variantes acceptées)  [[!bonne|leurre|leurre]] (liste)
  function sameAnswer(given, expected) {
    const a = TL.norm(given), e = TL.norm(expected);
    if (a === e) return true;
    const na = parseFloat(a.replace(',', '.')), ne = parseFloat(e.replace(',', '.'));
    return isFinite(na) && isFinite(ne) && /^-?[\d.,]+\s*\w*$/.test(a) && Math.abs(na - ne) < 1e-9 && a.replace(/[\d.,\s-]/g, '') === e.replace(/[\d.,\s-]/g, '');
  }
  A.cloze = {
    label: 'Texte à trous', icon: '▭', graded: true,
    render(b, ctx) {
      const parts = String(b.text || '').split(/(\[\[.+?\]\])/g);
      const fields = [];
      const saved = (ctx.answer && ctx.answer.value) || [];
      const p = h('div.cloze');
      let html = '';
      parts.forEach((part) => {
        const m = part.match(/^\[\[(.+)\]\]$/);
        if (!m) { html += TL.inlineMd(part).replace(/\n/g, '<br>'); return; }
        const k = fields.length;
        const spec = m[1];
        if (spec.startsWith('!')) {
          const opts = spec.slice(1).split('|');
          fields.push({ kind: 'select', answers: [opts[0]], opts });
        } else fields.push({ kind: 'input', answers: spec.split('|') });
        html += `<span class="blank" data-k="${k}"></span>`;
      });
      p.innerHTML = html;
      TL.$$('.blank', p).forEach((span) => {
        const k = +span.dataset.k, f = fields[k];
        let el;
        if (f.kind === 'select') {
          el = h('select.field', { 'aria-label': 'Trou ' + (k + 1) }, h('option', { value: '' }, '…'), TL.shuffle(f.opts, ctx.seed + k).map((o) => h('option', { value: o }, o)));
        } else {
          const w = Math.max(4, ...f.answers.map((a) => a.length)) + 2;
          el = h('input.field', { type: 'text', autocomplete: 'off', spellcheck: false, 'aria-label': 'Trou ' + (k + 1), style: { width: Math.min(w, 28) + 'ch' } });
        }
        el.value = saved[k] || '';
        el.addEventListener('input', () => { el.classList.remove('is-ok', 'is-bad'); ctx.save({ value: fields.map((x) => x.el.value) }); });
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') bar.querySelector('.btn.primary')?.click(); });
        f.el = el; span.appendChild(el);
      });
      const paint = () => fields.forEach((f) => {
        const ok = f.answers.some((a) => sameAnswer(f.el.value, a));
        f.el.classList.toggle('is-ok', ok); f.el.classList.toggle('is-bad', !ok);
      });
      const bar = TL.checkBar(ctx, {
        check() {
          const vals = fields.map((f) => f.el.value);
          if (vals.every((v) => !v.trim())) { TL.toast('Complète au moins un trou.'); return null; }
          paint();
          const good = fields.filter((f) => f.answers.some((a) => sameAnswer(f.el.value, a))).length;
          return { value: vals, correct: good === fields.length, score: good / fields.length, msg: `${good} trou(s) juste(s) sur ${fields.length}.` };
        },
        reveal() { fields.forEach((f) => { f.el.value = f.answers[0]; }); paint(); },
        reset() { fields.forEach((f) => { f.el.value = ''; f.el.classList.remove('is-ok', 'is-bad'); }); },
      });
      if (ctx.answer && ctx.answer.attempts) paint();
      return h('div.act', b.question ? qhead(b) : null, p, bar);
    },
  };

  /* ---------- Calcul / valeur numérique ---------- */
  A.numeric = {
    label: 'Calcul numérique', icon: '#', graded: true,
    render(b, ctx) {
      const inp = h('input.field.num', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Ta réponse', value: (ctx.answer && ctx.answer.value) || '' });
      inp.addEventListener('input', () => { inp.classList.remove('is-ok', 'is-bad'); ctx.save({ value: inp.value }); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') bar.querySelector('.btn.primary')?.click(); });
      const tol = () => (b.tolerancePct ? Math.abs(b.answer) * b.tolerancePct / 100 : (b.tolerance || 0));
      const bar = TL.checkBar(ctx, {
        check() {
          const v = parseFloat(String(inp.value).replace(/\s/g, '').replace(',', '.'));
          if (!isFinite(v)) { TL.toast('Écris un nombre (ex. 2,5).'); return null; }
          const ok = Math.abs(v - b.answer) <= tol() + 1e-9;
          let msg = '';
          if (!ok && b.answer !== 0) {
            const r = v / b.answer;
            if ([10, 100, 1000, 0.1, 0.01, 0.001].some((k) => Math.abs(r - k) / k < 0.02)) msg = 'Vérifie les unités : ton résultat est décalé d’une puissance de 10.';
          }
          inp.classList.toggle('is-ok', ok); inp.classList.toggle('is-bad', !ok);
          return { value: inp.value, correct: ok, score: ok ? 1 : 0, msg };
        },
        reveal() { inp.value = TL.fmtNum(b.answer, 4); inp.classList.add('is-ok'); },
        reset() { inp.value = ''; inp.classList.remove('is-ok', 'is-bad'); },
      });
      return h('div.act', qhead(b), b.formula ? h('div.formula.mono', b.formula) : null,
        h('label.numrow', inp, b.unit ? h('span.unit', b.unit) : null), bar);
    },
  };

  /* ---------- Association ---------- */
  A.match = {
    label: 'Association', icon: '⇄', graded: true,
    render(b, ctx) {
      const rights = TL.shuffle([...new Set(b.pairs.map((p) => p[1]).concat(b.distractors || []))], ctx.seed);
      const saved = (ctx.answer && ctx.answer.value) || [];
      const rows = b.pairs.map((p, i) => {
        const sel = h('select.field', { 'aria-label': p[0] }, h('option', { value: '' }, 'Choisir…'), rights.map((r) => h('option', { value: r }, r)));
        sel.value = saved[i] || '';
        sel.onchange = () => { sel.classList.remove('is-ok', 'is-bad'); ctx.save({ value: rows.map((r) => r.sel.value) }); };
        return { p, sel, el: h('div.match-row', h('div.match-l', { html: TL.inlineMd(p[0]) }), h('span.match-arrow', '→'), sel) };
      });
      const paint = () => rows.forEach((r) => { const ok = r.sel.value === r.p[1]; r.sel.classList.toggle('is-ok', ok); r.sel.classList.toggle('is-bad', !ok); });
      const bar = TL.checkBar(ctx, {
        check() {
          paint();
          const good = rows.filter((r) => r.sel.value === r.p[1]).length;
          return { value: rows.map((r) => r.sel.value), correct: good === rows.length, score: good / rows.length, msg: `${good} association(s) juste(s) sur ${rows.length}.` };
        },
        reveal() { rows.forEach((r) => (r.sel.value = r.p[1])); paint(); },
        reset() { rows.forEach((r) => { r.sel.value = ''; r.sel.classList.remove('is-ok', 'is-bad'); }); },
      });
      if (ctx.answer && ctx.answer.attempts) paint();
      return h('div.act', qhead(b, 'Associe chaque élément.'), h('div.match', rows.map((r) => r.el)), bar);
    },
  };

  /* ---------- Remettre dans l'ordre ---------- */
  A.order = {
    label: 'Remettre dans l’ordre', icon: '↕', graded: true,
    render(b, ctx) {
      const n = b.items.length;
      let cur = (ctx.answer && ctx.answer.value && ctx.answer.value.length === n) ? ctx.answer.value.slice() : TL.shuffle([...Array(n).keys()], ctx.seed);
      if (!ctx.answer && cur.every((v, i) => v === i) && n > 1) cur = cur.slice(1).concat(cur[0]);
      const list = h('ol.order');
      let showRes = false;
      function draw() {
        list.innerHTML = '';
        cur.forEach((idx, pos) => {
          const li = h('li.order-item' + (showRes ? (idx === pos ? '.is-ok' : '.is-bad') : ''),
            h('span.order-n.mono', String(pos + 1)),
            h('span.order-t', { html: TL.inlineMd(b.items[idx]) }),
            h('span.order-btns',
              h('button.icon-btn', { type: 'button', 'aria-label': 'Monter', disabled: pos === 0, onclick: () => move(pos, -1) }, '↑'),
              h('button.icon-btn', { type: 'button', 'aria-label': 'Descendre', disabled: pos === n - 1, onclick: () => move(pos, 1) }, '↓')));
          li.draggable = true;
          li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(pos)); li.classList.add('dragging'); });
          li.addEventListener('dragend', () => li.classList.remove('dragging'));
          li.addEventListener('dragover', (e) => e.preventDefault());
          li.addEventListener('drop', (e) => { e.preventDefault(); const from = +e.dataTransfer.getData('text/plain'); const [x] = cur.splice(from, 1); cur.splice(pos, 0, x); changed(); });
          list.appendChild(li);
        });
      }
      function move(pos, d) { [cur[pos], cur[pos + d]] = [cur[pos + d], cur[pos]]; changed(); }
      function changed() { showRes = false; draw(); ctx.save({ value: cur.slice() }); }
      const bar = TL.checkBar(ctx, {
        check() {
          showRes = true; draw();
          const good = cur.filter((v, i) => v === i).length;
          return { value: cur.slice(), correct: good === n, score: good / n, msg: `${good} élément(s) bien placé(s) sur ${n}.` };
        },
        reveal() { cur = [...Array(n).keys()]; showRes = true; draw(); },
        reset() { cur = TL.shuffle(cur, Date.now() % 1000); showRes = false; draw(); },
      });
      showRes = !!(ctx.answer && ctx.answer.attempts);
      draw();
      return h('div.act', qhead(b, 'Remets dans l’ordre.'), list, bar);
    },
  };

  /* ---------- Classement (et base des chaînes) ---------- */
  // Pose des étiquettes dans des zones : toucher une étiquette puis une zone, ou glisser-déposer.
  function placementBoard(ctx, items, zones, opts) {
    // items : [{id, text, zone}], zones : [{id, name, el?}]
    const placed = Object.assign({}, (ctx.answer && ctx.answer.value) || {});
    let picked = null, showRes = !!(ctx.answer && ctx.answer.attempts);
    const pool = h('div.pool', { 'aria-label': 'Étiquettes à placer' });
    const chipFor = (it) => {
      const c = h('button.tok', { type: 'button', draggable: true, dataset: { id: it.id } }, it.text);
      c.onclick = (e) => {
        e.stopPropagation();
        if (placed[it.id] != null && picked !== it.id) { delete placed[it.id]; picked = null; changed(); return; }
        picked = picked === it.id ? null : it.id; draw();
      };
      c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', it.id); picked = it.id; });
      return c;
    };
    zones.forEach((z) => {
      z.box.classList.add('dropzone');
      z.box.tabIndex = 0;
      const put = () => { if (picked) { placed[picked] = z.id; picked = null; changed(); } };
      z.box.addEventListener('click', put);
      z.box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); put(); } });
      z.box.addEventListener('dragover', (e) => { e.preventDefault(); z.box.classList.add('over'); });
      z.box.addEventListener('dragleave', () => z.box.classList.remove('over'));
      z.box.addEventListener('drop', (e) => { e.preventDefault(); z.box.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id) { placed[id] = z.id; picked = null; changed(); } });
    });
    pool.addEventListener('dragover', (e) => e.preventDefault());
    pool.addEventListener('drop', (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); delete placed[id]; picked = null; changed(); });
    function draw() {
      pool.innerHTML = '';
      zones.forEach((z) => (z.slot.innerHTML = ''));
      items.forEach((it) => {
        const c = chipFor(it);
        if (picked === it.id) c.classList.add('picked');
        const zid = placed[it.id];
        if (zid != null) {
          const z = zones.find((x) => x.id === zid);
          if (showRes) c.classList.add(it.zone === zid ? 'is-ok' : 'is-bad');
          if (z) { z.slot.appendChild(c); return; }
        }
        pool.appendChild(c);
      });
      if (!pool.children.length) pool.appendChild(h('span.muted.small', 'Toutes les étiquettes sont placées.'));
      zones.forEach((z) => z.box.classList.toggle('armed', !!picked));
    }
    function changed() { showRes = false; draw(); ctx.save({ value: Object.assign({}, placed) }); }
    const bar = TL.checkBar(ctx, {
      check() {
        const n = items.length, nPlaced = Object.keys(placed).length;
        if (!nPlaced) { TL.toast('Place au moins une étiquette.'); return null; }
        showRes = true; draw();
        const good = items.filter((it) => placed[it.id] === it.zone).length;
        return { value: Object.assign({}, placed), correct: good === n, score: good / n, msg: `${good} étiquette(s) bien placée(s) sur ${n}${nPlaced < n ? ` (${n - nPlaced} non placée(s))` : ''}.` };
      },
      reveal() { items.forEach((it) => (placed[it.id] = it.zone)); showRes = true; draw(); },
      reset() { Object.keys(placed).forEach((k) => delete placed[k]); showRes = false; draw(); },
    });
    draw();
    return { pool, bar };
  }
  TL.placementBoard = placementBoard;

  A.sort = {
    label: 'Classement', icon: '▤', graded: true,
    render(b, ctx) {
      const items = [];
      b.categories.forEach((c, ci) => c.items.forEach((t, ti) => items.push({ id: ci + '.' + ti, text: t, zone: 'c' + ci })));
      const zones = b.categories.map((c, ci) => {
        const slot = h('div.zone-slot');
        return { id: 'c' + ci, box: h('div.zone', h('div.zone-title', c.name), slot), slot };
      });
      const shuffled = TL.shuffle(items, ctx.seed);
      const board = placementBoard(ctx, shuffled, zones);
      return h('div.act', qhead(b, 'Classe chaque étiquette.'), board.pool, h('div.zones', zones.map((z) => z.box)), board.bar);
    },
  };

  /* ---------- Chaînes d'information et d'énergie ---------- */
  TL.CHAIN = {
    info: [['acquerir', 'Acquérir'], ['traiter', 'Traiter'], ['communiquer', 'Communiquer']],
    energie: [['alimenter', 'Alimenter'], ['distribuer', 'Distribuer'], ['convertir', 'Convertir'], ['transmettre', 'Transmettre']],
  };
  A.chain = {
    label: 'Chaînes info / énergie', icon: '⇉', graded: true,
    render(b, ctx) {
      const zones = [];
      const mk = (id, name, cls) => {
        const slot = h('div.zone-slot');
        const z = { id, box: h('div.cz.' + cls, h('div.cz-title', name), slot), slot };
        zones.push(z); return z.box;
      };
      const arrow = (t) => h('div.cz-arrow', h('span', t || ''));
      const info = h('div.crow.info', h('div.crow-label', 'Chaîne d’information'),
        h('div.crow-in', h('div.cz-ext', b.infoIn || 'Informations'), arrow(),
          ...TL.CHAIN.info.flatMap(([id, n], i) => [mk(id, n, 'info'), i < 2 ? arrow() : null]), arrow(), h('div.cz-ext', b.infoOut || 'Messages')));
      const ordres = h('div.ordres', h('span', '↓ ordres'));
      const nrg = h('div.crow.energie', h('div.crow-label', 'Chaîne d’énergie'),
        h('div.crow-in', h('div.cz-ext', b.energyIn || 'Énergie d’entrée'), arrow(),
          ...TL.CHAIN.energie.flatMap(([id, n], i) => [mk(id, n, 'nrg'), i < 3 ? arrow() : null]), arrow(), h('div.cz-ext.action', b.action || 'Action')));
      const items = (b.items || []).map((it, i) => ({ id: 'i' + i, text: it.text, zone: it.slot }));
      const board = placementBoard(ctx, TL.shuffle(items, ctx.seed), zones);
      return h('div.act', qhead(b, 'Place chaque composant dans la bonne fonction.'), board.pool,
        h('div.chainwrap', h('div.chain', info, ordres, nrg)), board.bar);
    },
  };

  /* ---------- Schéma à légender ---------- */
  A.label = {
    label: 'Schéma à légender', icon: '⌖', graded: true,
    render(b, ctx) {
      const labels = TL.shuffle([...new Set(b.points.map((p) => p.answer).concat(b.distractors || []))], ctx.seed);
      const saved = (ctx.answer && ctx.answer.value) || [];
      const pic = b.svg ? h('div.lbl-svg', { html: b.svg }) : h('img', { src: b.src, alt: b.alt || 'Schéma à légender' });
      const markers = b.points.map((p, i) => h('span.lbl-mark.mono', { style: { left: p.x + '%', top: p.y + '%' } }, String(i + 1)));
      const rows = b.points.map((p, i) => {
        const sel = h('select.field', { 'aria-label': 'Repère ' + (i + 1) }, h('option', { value: '' }, 'Choisir…'), labels.map((l) => h('option', { value: l }, l)));
        sel.value = saved[i] || '';
        sel.onchange = () => { sel.classList.remove('is-ok', 'is-bad'); markers[i].classList.remove('is-ok', 'is-bad'); ctx.save({ value: rows.map((r) => r.sel.value) }); };
        sel.onfocus = () => markers.forEach((m, j) => m.classList.toggle('hl', j === i));
        return { p, sel, el: h('label.lbl-row', h('span.lbl-n.mono', String(i + 1)), sel) };
      });
      const paint = () => rows.forEach((r, i) => { const ok = r.sel.value === r.p.answer; [r.sel, markers[i]].forEach((e) => { e.classList.toggle('is-ok', ok); e.classList.toggle('is-bad', !ok); }); });
      const bar = TL.checkBar(ctx, {
        check() {
          paint();
          const good = rows.filter((r) => r.sel.value === r.p.answer).length;
          return { value: rows.map((r) => r.sel.value), correct: good === rows.length, score: good / rows.length, msg: `${good} légende(s) juste(s) sur ${rows.length}.` };
        },
        reveal() { rows.forEach((r) => (r.sel.value = r.p.answer)); paint(); },
        reset() { rows.forEach((r, i) => { r.sel.value = ''; r.sel.classList.remove('is-ok', 'is-bad'); markers[i].classList.remove('is-ok', 'is-bad'); }); },
      });
      if (ctx.answer && ctx.answer.attempts) paint();
      return h('div.act', qhead(b, 'Légende le schéma.'), h('div.lbl', h('div.lbl-pic', pic, markers), h('div.lbl-list', rows.map((r) => r.el))), bar);
    },
  };

  /* ---------- Procédure pas à pas (manipulation) ---------- */
  A.procedure = {
    label: 'Procédure pas à pas', icon: '☑', graded: true,
    render(b, ctx) {
      const st = Object.assign({}, (ctx.answer && ctx.answer.value) || {});
      const total = b.items.length;
      const meter = h('div.meter', h('span'));
      const status = h('span.small.muted');
      const list = h('ol.proc');
      const upd = () => {
        const n = b.items.filter((_, i) => st[i]).length;
        meter.firstChild.style.width = (n / total) * 100 + '%';
        status.textContent = `${n} / ${total} étapes réalisées`;
        const done = n === total;
        ctx.result(Object.assign({}, ctx.answer, { value: Object.assign({}, st), done, correct: done, score: done ? 1 : n / total, attempts: 1, at: Date.now() }), true);
      };
      b.items.forEach((it, i) => {
        const cb = h('input', { type: 'checkbox', id: ctx.uid + '-p' + i, checked: !!st[i] });
        cb.onchange = () => { st[i] = cb.checked; li.classList.toggle('done', cb.checked); upd(); };
        const li = h('li.proc-item' + (st[i] ? '.done' : ''),
          h('label', { for: cb.id }, cb, h('span.proc-box'), h('span.proc-t', { html: TL.inlineMd(it.text) })),
          it.detail ? h('div.proc-detail', { html: TL.md(it.detail) }) : null,
          it.image ? h('img.proc-img', { src: it.image, alt: '', loading: 'lazy' }) : null,
          it.warn ? h('div.callout.warn', { html: TL.inlineMd(it.warn) }) : null);
        list.appendChild(li);
      });
      const el = h('div.act', b.question ? qhead(b) : null, h('div.proc-meter', meter, status), list);
      setTimeout(() => { const n = b.items.filter((_, i) => st[i]).length; meter.firstChild.style.width = (n / total) * 100 + '%'; status.textContent = `${n} / ${total} étapes réalisées`; });
      return el;
    },
  };

  /* ---------- Compte rendu (texte + photos) ---------- */
  A.report = {
    label: 'Compte rendu / photo', icon: '✎', graded: true,
    render(b, ctx) {
      const v = Object.assign({ text: '', photos: [] }, (ctx.answer && ctx.answer.value) || {});
      const ta = h('textarea.field.area', { rows: b.rows || 5, placeholder: b.placeholder || 'Écris ta réponse…', 'aria-label': 'Ta réponse' });
      ta.value = v.text || '';
      const gal = h('div.gal');
      const state = h('div.small.muted');
      const save = TL.debounce(() => ctx.save({ value: Object.assign({}, v) }), 400);
      ta.oninput = () => { v.text = ta.value; save(); };
      const drawGal = () => {
        gal.innerHTML = '';
        v.photos.forEach((src, i) => gal.appendChild(h('div.gal-item', h('img', { src, alt: 'Photo ' + (i + 1) }),
          h('button.icon-btn', { type: 'button', 'aria-label': 'Retirer la photo', onclick: () => { v.photos.splice(i, 1); drawGal(); save(); } }, '✕'))));
      };
      const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, hidden: true });
      file.onchange = async () => {
        for (const f of file.files) v.photos.push(await TL.fileToDataUrl(f, 1000, 0.7));
        file.value = ''; drawGal(); save();
      };
      const btnPhoto = b.photo !== false ? h('button.btn.ghost', { type: 'button', onclick: () => file.click() }, 'Ajouter une photo') : null;
      const btnSend = h('button.btn.primary', { type: 'button' }, 'Rendre');
      const paintState = () => {
        const a = ctx.answer;
        state.textContent = a && a.done ? 'Rendu le ' + TL.fmtDate(a.at) + (a.teacher ? ' · Note : ' + a.teacher.grade + (a.teacher.comment ? ' — ' + a.teacher.comment : '') : ' · en attente de correction') : '';
      };
      btnSend.onclick = () => {
        if (!v.text.trim() && !v.photos.length) { TL.toast('Écris quelque chose ou ajoute une photo.'); return; }
        ctx.result(Object.assign({}, ctx.answer, { value: Object.assign({}, v), done: true, correct: true, score: 1, attempts: ((ctx.answer && ctx.answer.attempts) || 0) + 1, at: Date.now(), pendingReview: true }));
        paintState(); TL.toast('Compte rendu enregistré.', 'ok');
      };
      drawGal(); paintState();
      return h('div.act', qhead(b), ta, gal, h('div.checkbar', btnPhoto, btnSend, file, state));
    },
  };
})();
