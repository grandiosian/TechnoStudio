/* TechnoStudio — rendu « feuille » d'après la charte des ateliers (Affinity) :
   grand en-tête / bandeau fin, pastille de niveau, étiquettes PAPIER / ORDI,
   bande question numérotée, lignes de découpe, cadre « Recopie et réponds »,
   cartouche de fin, pastilles de compétences (_Comp) et correction (_Corr).
   + nouveaux champs : tableau, vrai/faux, cases reliées, grille binaire, repère,
   dessin, carte mentale, auto-évaluation, questions de fin de partie, ressources. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const A = TL.activities;

  TL.CHARTE = {
    band: '#C9D4F4', soft: '#F3F5FB', box: '#E9ECF3', blue: '#2F57A1', ink: '#22348F', navy: '#010958',
    papier: '#2F57A1', ordi: '#2FB844', comp: '#F08C14', objectif: '#FFF0C8', banque: '#E8F4FF', retenir: '#FFF9E1',
    fonction: '#FFE8CD', synthese: '#CB64FF', syntheseSoft: '#F6ECFF',
    niveaux: { '6': '#30C7C7', '5': '#30C700', '4': '#F5C400', '3': '#E53935' },
    themes: { T1: '#30B34A', T2: '#C45CCE', T3: '#E8B624', T4: '#3A6FD8' },   // couleurs des thèmes de la Centrale : OST vert, SFC rose, CCRI jaune orangé
  };
  const KIND = {
    feuille: { label: 'Feuille d’atelier', short: 'P', title: 'ATELIER' },
    ressource: { label: 'Ressources', short: 'R', title: 'RESSOURCES' },
    synthese: { label: 'Synthèse', short: 'S', title: 'SYNTHÈSE' },
    evaluation: { label: 'Évaluation', short: 'E', title: 'ÉVALUATION' },
  };
  TL.SHEET_KINDS = KIND;
  const pad2 = (n) => String(n || 1).padStart(2, '0');
  const niveauNum = (w) => String(w.niveau || '').replace(/\D/g, '') || ({ college: '4', sti2d: '1', snt: '2', pro: 'P' }[w.level] || '4');
  const niveauColor = (w) => TL.CHARTE.niveaux[niveauNum(w)] || TL.CHARTE.blue;
  TL.niveauColor = niveauColor; TL.niveauNum = niveauNum;

  // Blocs « structure » : ni numérotés ni encadrés
  const STRUCT = new Set(['text', 'image', 'svg', 'scan', 'link', 'decoupe', 'filet', 'objectif', 'retenir', 'ressource', 'mots', 'questions']);
  // codes des feuilles comme dans la charte : P01, P02, R01, S01, E01…
  TL.sheetCodes = function (w) {
    const cnt = {};
    return w.steps.map((s) => { const k = s.kind || 'feuille'; const key = k + (s.segpa ? 's' : ''); cnt[key] = (cnt[key] || 0) + 1; return (s.segpa ? 'S·' : '') + KIND[k].short + (k === 'feuille' ? (s.feuille || cnt[key]) : cnt[key]); });
  };
  TL.isExercise = (b) => !STRUCT.has(b.type) && !!(b.question || TL.isGraded(b) || b.demo);

  /* ---------- Pastille / bandeaux ---------- */
  function pastille(w, big) {
    return h('span.pastille' + (big ? '.big' : ''), { style: { background: niveauColor(w) }, title: 'Niveau ' + niveauNum(w) + (niveauNum(w).length === 1 && /\d/.test(niveauNum(w)) ? 'e' : '') }, niveauNum(w));
  }
  TL.pastille = pastille;

  function sheetHeader(w, s, si) {
    const kind = s.kind || 'feuille';
    const seance = s.seance || 1, feuille = s.feuille || (si + 1);
    const seq = w.seq ? 'AT SEQ ' + pad2(w.seq) + ' ' : '';
    if (kind === 'ressource') {
      return h('header.sh-res', h('h1', TL.fr('RESSOURCES' + (s.title ? ' - ' + s.title.toUpperCase() : ''))), pastille(w, true));
    }
    if (kind === 'evaluation') {
      const p = (TL.app && TL.app.profile) || {};
      return h('header.sh-eval',
        h('div.sh-evalband', h('h1', TL.fr('ÉVALUATION' + (s.segpa ? ' SEGPA' : '') + ' - ' + w.title + (s.verso ? ' (verso)' : ''))), pastille(w)),
        s.verso ? null : h('div.sh-ident', h('span', 'Nom : ', h('b', (p.name || '').split(' ').slice(1).join(' ') || '……………………')), h('span', 'Prénom : ', h('b', (p.name || '').split(' ')[0] || '……………………')), h('span', 'Classe : ', h('b', p.classe || '……')), h('span', 'Date : ', h('b', new Date().toLocaleDateString('fr-FR')))),
        s.consignes ? h('div.sh-consignes', { html: TL.inlineMd(s.consignes) }) : null,
        s.verso ? null : h('div.sh-note', h('span.sh-note-val.mono', { 'data-note': '1' }, '…… / 20')));
    }
    const first = s.big != null ? s.big : feuille === 1 || kind === 'synthese' && false;
    const sub = kind === 'synthese' ? 'SYNTHÈSE - Ce que j’ai appris' : (s.segpa ? 'SEGPA : ' : '') + 'SÉANCE ' + seance + ' - Feuille ' + feuille;
    if (first && kind === 'feuille') {
      return h('header.sh-big',
        h('div.sh-bigband', h('div', h('h1', TL.fr('ATELIER - ' + w.title)), h('p.sh-sub', sub)), pastille(w, true)),
        w.summary || s.resume ? h('div.sh-resume', h('b', 'Résumé et objectif de l’atelier : '), h('span', { html: TL.inlineMd(s.resume || w.summary) })) : null);
    }
    return h('header.sh-thin' + (kind === 'synthese' ? '.synth' : ''), h('span.sh-thin-title', TL.fr('ATELIER - ' + w.title)), h('span.sh-thin-sub', kind === 'synthese' ? sub : seq + 'SEANCE ' + pad2(seance) + ' - Feuille ' + pad2(feuille)), pastille(w));
  }

  function cartouche(w, s, si) {
    const kind = s.kind || 'feuille';
    if (kind === 'ressource' || kind === 'evaluation') return s.verso || kind === 'ressource' ? null : h('div.sh-turn', '→ Tourne la page');
    const seq = 'AT SEQ ' + pad2(w.seq || 1) + ' SEANCE ' + pad2(s.seance || 1);
    const what = kind === 'synthese' ? 'FIN Synthèse' : 'FIN Feuille ' + (s.segpa ? 'SEGPA ' : '') + pad2(s.feuille || si + 1);
    return h('div.sh-cartouche', pastille(w), h('div', h('b', 'ATELIER - ' + w.title), h('span', h('b', what), ' - ' + seq)));
  }

  /* ---------- Texte de correction (calque _Corr) ---------- */
  TL.correctionText = function (b) {
    const parts = [];
    try {
      switch (b.type) {
        case 'qcm': parts.push(b.options.filter((o) => o.correct).map((o) => o.text).join(' ; ')); break;
        case 'cloze': parts.push((b.text.match(/\[\[(.+?)\]\]/g) || []).map((m) => m.slice(2, -2).replace(/^!/, '').split('|')[0]).join(' · ')); break;
        case 'numeric': parts.push(TL.fmtNum(b.answer, 4) + (b.unit ? ' ' + b.unit : '')); break;
        case 'match': parts.push(b.pairs.map((p) => p[0] + ' → ' + p[1]).join(' ; ')); break;
        case 'order': parts.push(b.items.map((x, i) => i + 1 + '. ' + x).join('  ')); break;
        case 'sort': parts.push(b.categories.map((c) => c.name + ' : ' + c.items.join(', ')).join(' | ')); break;
        case 'chain': parts.push((b.items || []).map((i) => i.text + ' → ' + i.slot).join(' ; ')); break;
        case 'label': parts.push(b.points.map((p, i) => i + 1 + '. ' + String(p.answer).split('|')[0]).join(' · ')); break;
        case 'table': parts.push(b.rows.map((r) => r.map((c) => (c && typeof c === 'object' ? (c.a != null ? String(c.a).split('|')[0] : c.check ? '✓' : '') : '')).filter(Boolean).join(', ')).filter(Boolean).join(' / ')); break;
        case 'vraifaux': parts.push(b.items.map((it, i) => String.fromCharCode(97 + i) + ') ' + (it.v ? 'vrai' : 'faux')).join('  ')); break;
        case 'boxes': parts.push(b.items.map((it) => [it.top, it.bottom].map((x) => (x && typeof x === 'object' ? String(x.a).split('|')[0] : x)).filter(Boolean).join(' / ')).join(' → ')); break;
        case 'bits': parts.push(b.rows.map((r) => r.label + ' = ' + r.bits + ' = ' + parseInt(r.bits, 2)).join(' ; ')); break;
        case 'graph': parts.push((b.points || []).map((p) => p.name + '(' + p.x + ' ; ' + p.y + ')').join(' ')); break;
        case 'mindmap': parts.push((b.branches || []).map((br) => br.label + ' : ' + (br.answers || []).join(', ')).join(' | ')); break;
      }
    } catch (e) { /* bloc incomplet */ }
    if (b.corr) parts.push(b.corr);
    return parts.filter(Boolean).join('\n');
  };

  /* ---------- Rendu d'une feuille ---------- */
  // opts : { pg, onResult, layers: {comp, corr}, editable, selected, onSelect }
  TL.renderSheet = function (w, s, si, opts) {
    opts = opts || {};
    const kind = s.kind || 'feuille';
    const page = h('article.sheet.k-' + kind + (s.segpa ? '.segpa' : '') + (opts.layers && opts.layers.comp ? '.show-comp' : '') + (opts.layers && opts.layers.corr ? '.show-corr' : ''), { 'data-step': s.id });
    page.append(sheetHeader(w, s, si));
    if (s.objectif) page.append(h('div.sh-objectif', h('b', 'Objectif : '), h('span', { html: TL.inlineMd(s.objectif) })));
    let n = s.numStart ? s.numStart - 1 : 0;
    const body = h('div.sh-body');
    s.blocks.forEach((b, bi) => {
      let num = null;
      if (TL.isExercise(b) && kind !== 'ressource') num = b.num != null ? b.num : String(++n) + '.';
      if (num === false) num = '';
      const el = TL.renderSheetBlock(b, { num, pg: opts.pg, onResult: opts.onResult, layers: opts.layers || {}, sheetKind: kind, readonly: opts.readonly });
      if (opts.editable) {
        el.classList.add('ed-sel');
        el.tabIndex = 0;
        if (opts.selected === b.id) el.classList.add('is-sel');
        el.addEventListener('click', (e) => { if (e.target.closest('.ed-noclick')) return; opts.onSelect && opts.onSelect(b, bi); }, true);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === el) opts.onSelect && opts.onSelect(b, bi); });
      }
      body.append(el);
    });
    if (opts.editable && !s.blocks.length) body.append(h('p.sh-empty', 'Feuille vide : insère un premier champ depuis le panneau « Insertion ».'));
    page.append(body);
    const c = cartouche(w, s, si);
    if (c) page.append(c);
    return page;
  };

  // Un bloc à la manière de la charte (étiquette, bande question, barème, pastilles)
  TL.renderSheetBlock = function (b, o) {
    const exo = TL.isExercise(b);
    const box = h('section.sb.t-' + b.type + (exo ? '.exo' : '') + (b.demo ? '.demo' : ''), { 'data-id': b.id });
    if (b.comp && b.comp.length) box.append(h('div.sb-comp', b.comp.map((c) => h('span.comp-tag', c))));
    if (exo) {
      const tag = b.tag || (['circuit', 'blocks', 'code'].includes(b.type) ? 'ordi' : 'papier');
      const head = h('div.sb-head',
        o.sheetKind === 'evaluation' || b.tag === 'none' ? null : h('span.tagbox.' + tag, tag === 'ordi' ? 'ORDI' : 'PAPIER'),
        h('div.bandq', o.num ? h('b.bandq-n', o.num + ' ') : null, h('span', { html: TL.inlineMd(b.question || (TL.activities[b.type] || {}).label || '') })),
        b.bareme ? h('span.bareme', { title: 'Barème' }, '/' + b.bareme) : null);
      box.append(head);
    }
    const pg = o.pg;
    const ans = pg && pg.answers && pg.answers[b.id];
    const def = A[b.type];
    if (!def) { box.append(h('p.muted', 'Champ inconnu : ' + b.type)); return box; }
    const status = h('span.sb-status');
    const paintStatus = (a) => { status.innerHTML = ''; if (a && a.done) status.append(h('span.badge' + (a.correct ? '.ok' : '.info'), a.revealed ? 'corrigé' : a.teacher ? 'noté · ' + a.teacher.grade : a.pendingReview ? 'rendu' : 'fait')); };
    paintStatus(ans);
    const ctx = {
      block: b, uid: 'b' + TL.hash(b.id + Math.random()), seed: TL.hash(b.id + ((TL.app && TL.app.profile && TL.app.profile.name) || '')) % 9973 + 1,
      answer: ans, readonly: o.readonly,
      save(partial) { if (!pg) return; pg.answers[b.id] = Object.assign({}, pg.answers[b.id], partial); ctx.answer = pg.answers[b.id]; TL.app.saveProgress(pg); },
      result(a, silent) {
        ctx.answer = a;
        if (pg) { pg.answers[b.id] = a; TL.app.saveProgress(pg); }
        paintStatus(a);
        if (o.onResult) o.onResult(a, silent);
      },
    };
    let el;
    try { el = def.render(b, ctx); } catch (e) { console.error(e); el = h('p.callout.warn', 'Erreur d’affichage : ' + e.message); }
    if (exo) { const q = el.querySelector(':scope > .qhead'); if (q) q.remove(); }
    box.append(el);
    if (exo && TL.isGraded(b)) box.append(status);
    const corr = TL.correctionText(b);
    if (corr) box.append(h('div.sb-corr', h('b', 'Correction · '), h('span', { html: TL.md(corr) })));
    return box;
  };

  /* ---------- Fiche pédagogique de séquence ---------- */
  TL.renderFiche = function (w) {
    const C = TL.CHARTE;
    const comps = (w.competences || []).map((c) => (typeof c === 'string' ? { code: '', label: c } : c));
    const pos = TL.clamp(+w.position || 0, 0, 9);
    const sec = (title, content) => (content ? h('section.fi-box', h('h2', title), h('div.fi-txt', { html: TL.md(content) })) : null);
    return h('article.sheet.fiche',
      h('header.fi-head', h('div.fi-cycle', h('span', 'Cycle ' + (w.cycle || 4)), h('span.fi-niv', pastille(w, true), h('sup', 'ème'))),
        h('div.fi-title', h('h1', 'FICHE PÉDAGOGIQUE DE SÉQUENCE'), h('p', w.pole || 'Pôle des Sciences et de la Technologie au collège')),
        h('div.fi-logo', w.etablissement || '')),
      w.problematique ? h('section.fi-box.center', h('h2', 'Problématique'), h('p.fi-strong', w.problematique)) : null,
      h('section.fi-box.fi-row',
        h('div', h('h2', 'Objet ou système technique'), h('p.fi-objet', w.objet || w.title)),
        h('div', h('h2', 'Positionnement sur le cycle'), h('div.fi-cyclebar', [...Array(9)].map((_, i) => h('span' + (i + 1 === pos ? '.on' : '')))), h('div.fi-cyclelbl', h('small', 'Début de cycle'), h('small', 'Fin de cycle')))),
      comps.length ? h('section.fi-ct', h('div.fi-ct-head', h('span', 'Compétences Travaillées (CT)'), h('span', 'Connaissances (CO)')),
        comps.map((c) => h('div.fi-ct-row',
          h('div', c.code ? h('span.ct-tag', { style: { background: c.color || C.themes[(c.code.match(/^T\d/) || ['T2'])[0]] || C.blue } }, c.code) : null, h('b', h('i', (c.code ? ' : ' : '') + c.label)),
            (c.sub || []).map((s) => h('div.ct-sub', h('b', s.code + ' : '), h('i', s.label)))),
          h('div.fi-co', c.co || '')))) : null,
      sec('Présentation de la séquence', w.presentation),
      sec('Éléments de la synthèse', w.synthese),
      sec('Modalités d’évaluation', w.evaluation),
      w.deroulement && w.deroulement.length ? h('section.fi-der', h('h2', 'Déroulement de la séquence'), h('div.tablewrap', h('table',
        h('thead', h('tr', h('th', ''), h('th', 'Objectifs pédagogiques'), h('th', 'Activités'), h('th', 'Ressources / Matériels'))),
        h('tbody', w.deroulement.map((d, i) => h('tr', h('th', d.seance || 'Séance ' + (i + 1)), h('td', h('b', d.objectif || '')), h('td', d.activites || ''), h('td', d.ressources || ''))))))) : null,
      sec('Différenciation', w.differenciation),
      sec('Matériel à prévoir', w.materiel));
  };

  /* ================= Nouveaux champs ================= */
  const qhead = (b, f) => h('div.qhead', { html: TL.md(b.question || f || '') });
  const same = (given, expected) => String(expected).split('|').some((e) => TL.norm(given) === TL.norm(e) || (isFinite(parseFloat(String(given).replace(',', '.'))) && parseFloat(String(given).replace(',', '.')) === parseFloat(String(e).replace(',', '.')) && /^[\d.,\s-]+$/.test(String(e))));
  TL.sameAnswer = same;
  const caseInput = (val, aria, w) => h('input.case', { type: 'text', autocomplete: 'off', spellcheck: false, value: val || '', 'aria-label': aria, style: w ? { width: w } : null });
  const bankBand = (words) => h('div.banque', h('b', 'Banque de mots : '), words.map((x, i) => [i ? h('span.banque-sep', ' – ') : null, h('span', x)]));
  const answersOf = (spec) => String(spec).split('|');

  /* ----- Tableau à compléter ----- */
  A.table = {
    label: 'Tableau à compléter', icon: '▦', graded: true,
    render(b, ctx) {
      const saved = (ctx.answer && ctx.answer.value) || {};
      const fields = [];
      const table = h('table.sh-table');
      if (b.headers && b.headers.length) table.append(h('thead', h('tr', b.headers.map((x) => h('th', { html: TL.inlineMd(x) })))));
      const tb = h('tbody');
      b.rows.forEach((row, ri) => tb.append(h('tr', row.map((cell, ci) => {
        const key = ri + '-' + ci;
        if (cell && typeof cell === 'object') {
          let el;
          if (cell.check != null) { el = h('input.vf', { type: 'checkbox', checked: !!saved[key], 'aria-label': 'Case ' + key }); el._get = () => el.checked; el._ok = () => el.checked === !!cell.check; }
          else if (cell.choices) { el = h('select.case', { 'aria-label': 'Case ' + key }, h('option', { value: '' }, '…'), cell.choices.map((c) => h('option', { value: c }, c))); el.value = saved[key] || ''; el._get = () => el.value; el._ok = () => same(el.value, cell.a); }
          else { el = caseInput(saved[key], 'Case ' + key); el._get = () => el.value; el._ok = () => same(el.value, cell.a); }
          el.addEventListener('input', () => { el.classList.remove('is-ok', 'is-bad'); ctx.save({ value: collect() }); });
          el.addEventListener('change', () => ctx.save({ value: collect() }));
          fields.push({ key, el, cell });
          return h('td.in', el);
        }
        return h(ri === 0 && !b.headers && b.firstRowHead ? 'th' : 'td', { html: TL.inlineMd(cell == null ? '' : String(cell)) });
      }))));
      table.append(tb);
      const collect = () => Object.fromEntries(fields.map((f) => [f.key, f.el._get()]));
      const paint = () => fields.forEach((f) => { const ok = f.el._ok(); f.el.classList.toggle('is-ok', ok); f.el.classList.toggle('is-bad', !ok); });
      const bar = TL.checkBar(ctx, {
        check() {
          paint();
          const good = fields.filter((f) => f.el._ok()).length;
          return { value: collect(), correct: good === fields.length, score: fields.length ? good / fields.length : 1, msg: `${good} case(s) juste(s) sur ${fields.length}.` };
        },
        reveal() { fields.forEach((f) => { if (f.cell.check != null) f.el.checked = !!f.cell.check; else f.el.value = answersOf(f.cell.a)[0]; }); paint(); },
        reset() { fields.forEach((f) => { if (f.cell.check != null) f.el.checked = false; else f.el.value = ''; f.el.classList.remove('is-ok', 'is-bad'); }); },
      });
      if (ctx.answer && ctx.answer.attempts) paint();
      return h('div.act', qhead(b), b.bank ? bankBand(Array.isArray(b.bank) ? b.bank : TL.shuffle(fields.filter((f) => f.cell.a).map((f) => answersOf(f.cell.a)[0]), ctx.seed)) : null, h('div.tablewrap', table), bar);
    },
  };

  /* ----- Vrai / faux ----- */
  A.vraifaux = {
    label: 'Vrai / faux (tableau)', icon: '☑', graded: true,
    render(b, ctx) {
      const saved = (ctx.answer && ctx.answer.value) || {};
      const labels = b.labels || ['vrai', 'faux'];
      const rows = b.items.map((it, i) => {
        const name = ctx.uid + '-vf' + i;
        const mk = (v) => { const r = h('input.vf', { type: 'radio', name, value: v, checked: saved[i] === v, 'aria-label': labels[v === 'v' ? 0 : 1] + ' : ' + it.text }); r.onchange = () => { tr.classList.remove('is-ok', 'is-bad'); ctx.save({ value: collect() }); }; return r; };
        const rv = mk('v'), rf = mk('f');
        const tr = h('tr', h('td.vf-text', { html: TL.inlineMd(it.text) }), h('td.vf-c', rv), h('td.vf-c', rf));
        return { it, rv, rf, tr };
      });
      const collect = () => Object.fromEntries(rows.map((r, i) => [i, r.rv.checked ? 'v' : r.rf.checked ? 'f' : '']));
      const ok = (r) => (r.it.v ? r.rv.checked : r.rf.checked);
      const paint = () => rows.forEach((r) => { r.tr.classList.toggle('is-ok', ok(r)); r.tr.classList.toggle('is-bad', !ok(r)); });
      const bar = TL.checkBar(ctx, {
        check() { paint(); const good = rows.filter(ok).length; return { value: collect(), correct: good === rows.length, score: good / rows.length, msg: `${good} réponse(s) juste(s) sur ${rows.length}.` }; },
        reveal() { rows.forEach((r) => { r.rv.checked = !!r.it.v; r.rf.checked = !r.it.v; }); paint(); },
        reset() { rows.forEach((r) => { r.rv.checked = r.rf.checked = false; r.tr.classList.remove('is-ok', 'is-bad'); }); },
      });
      if (ctx.answer && ctx.answer.attempts) paint();
      return h('div.act', qhead(b), h('table.sh-vf', h('thead', h('tr', h('th', ''), h('th', labels[0]), h('th', labels[1]))), h('tbody', rows.map((r) => r.tr))), bar);
    },
  };

  /* ----- Cases reliées (chaîne à compléter) ----- */
  A.boxes = {
    label: 'Cases reliées (chaîne)', icon: '⇢', graded: true,
    render(b, ctx) {
      const saved = (ctx.answer && ctx.answer.value) || {};
      const fields = [];
      const cell = (spec, key, role) => {
        if (spec && typeof spec === 'object') {
          const el = caseInput(saved[key], role + ' ' + key);
          el.addEventListener('input', () => { el.classList.remove('is-ok', 'is-bad'); ctx.save({ value: Object.fromEntries(fields.map((f) => [f.key, f.el.value])) }); });
          fields.push({ key, el, spec });
          return h('div.bx-cell.' + role, el);
        }
        return h('div.bx-cell.fixed.' + role, spec || '');
      };
      const row = h('div.bx-row');
      b.items.forEach((it, i) => {
        if (i) row.append(h('span.bx-arrow', { 'aria-hidden': 'true' }));
        row.append(h('div.bx-col', it.top != null ? cell(it.top, i + 't', 'top') : null, it.bottom != null ? cell(it.bottom, i + 'b', 'bottom') : null));
      });
      const paint = () => fields.forEach((f) => { const ok = same(f.el.value, f.spec.a); f.el.classList.toggle('is-ok', ok); f.el.classList.toggle('is-bad', !ok); });
      const bar = TL.checkBar(ctx, {
        check() { paint(); const good = fields.filter((f) => same(f.el.value, f.spec.a)).length; return { value: Object.fromEntries(fields.map((f) => [f.key, f.el.value])), correct: good === fields.length, score: good / Math.max(1, fields.length), msg: `${good} case(s) juste(s) sur ${fields.length}.` }; },
        reveal() { fields.forEach((f) => (f.el.value = answersOf(f.spec.a)[0])); paint(); },
        reset() { fields.forEach((f) => { f.el.value = ''; f.el.classList.remove('is-ok', 'is-bad'); }); },
      });
      if (ctx.answer && ctx.answer.attempts) paint();
      const bank = b.bank ? (Array.isArray(b.bank) ? b.bank : TL.shuffle(fields.map((f) => answersOf(f.spec.a)[0]), ctx.seed)) : null;
      return h('div.act', qhead(b), bank ? bankBand(bank) : null, (b.topLabel || b.bottomLabel) ? h('div.bx-legend', b.topLabel ? h('span', '▲ ' + b.topLabel) : null, b.bottomLabel ? h('span', '▼ ' + b.bottomLabel) : null) : null, h('div.bx-wrap', row), bar);
    },
  };

  /* ----- Grille binaire (carte perforée) ----- */
  A.bits = {
    label: 'Grille binaire', icon: '▤', graded: true,
    render(b, ctx) {
      const W = b.weights || [128, 64, 32, 16, 8, 4, 2, 1];
      const saved = (ctx.answer && ctx.answer.value) || {};
      const card = b.showCard === false ? null : h('div.punch', b.rows.map((r) => h('div.punch-row', r.bits.split('').map((x) => h('span.' + (x === '1' ? 'hole' : 'dot'))))));
      const grid = h('table.bits', h('thead', h('tr', h('th', ''), W.map((x) => h('th.mono', String(x))), b.decimal !== false ? [h('th', ''), h('th', 'décimal')] : null)));
      const tb = h('tbody');
      const rows = b.rows.map((r, ri) => {
        const cells = W.map((_, ci) => {
          const v = saved[ri] && saved[ri].bits ? saved[ri].bits[ci] : '';
          const btn = h('button.bit.mono', { type: 'button', 'aria-label': r.label + ' bit ' + W[ci] }, v || '');
          btn.onclick = () => { btn.textContent = btn.textContent === '' ? '1' : btn.textContent === '1' ? '0' : ''; btn.classList.remove('is-ok', 'is-bad'); save(); };
          return btn;
        });
        const dec = b.decimal !== false ? caseInput(saved[ri] && saved[ri].dec, r.label + ' décimal', '6em') : null;
        if (dec) dec.oninput = () => { dec.classList.remove('is-ok', 'is-bad'); save(); };
        tb.append(h('tr', h('th', r.label), cells.map((c, ci) => h('td' + (ci === 4 ? '.mid' : ''), c)), dec ? [h('td.eq', '='), h('td', dec)] : null));
        return { r, cells, dec };
      });
      grid.append(tb);
      const val = () => rows.map((x) => ({ bits: x.cells.map((c) => c.textContent).join(''), dec: x.dec ? x.dec.value : '' }));
      const save = () => ctx.save({ value: val() });
      const paint = () => rows.forEach((x) => {
        x.cells.forEach((c, i) => { const ok = (c.textContent || '0') === x.r.bits[i] && c.textContent !== ''; c.classList.toggle('is-ok', ok); c.classList.toggle('is-bad', !ok); });
        if (x.dec) { const ok = +x.dec.value === parseInt(x.r.bits, 2); x.dec.classList.toggle('is-ok', ok); x.dec.classList.toggle('is-bad', !ok); }
      });
      const bar = TL.checkBar(ctx, {
        check() {
          paint();
          let good = 0, tot = 0;
          rows.forEach((x) => { x.cells.forEach((c, i) => { tot++; if (c.textContent === x.r.bits[i]) good++; }); if (x.dec) { tot++; if (+x.dec.value === parseInt(x.r.bits, 2)) good++; } });
          return { value: val(), correct: good === tot, score: good / tot, msg: `${good} réponse(s) juste(s) sur ${tot}.` };
        },
        reveal() { rows.forEach((x) => { x.cells.forEach((c, i) => (c.textContent = x.r.bits[i])); if (x.dec) x.dec.value = parseInt(x.r.bits, 2); }); paint(); },
        reset() { rows.forEach((x) => { x.cells.forEach((c) => { c.textContent = ''; c.classList.remove('is-ok', 'is-bad'); }); if (x.dec) x.dec.value = ''; }); },
      });
      if (ctx.answer && ctx.answer.attempts) paint();
      return h('div.act', qhead(b), h('div.bits-wrap', card, h('div.tablewrap', grid)), h('p.small.muted', 'Touche une case pour écrire 1, puis 0, puis l’effacer.'), bar);
    },
  };

  /* ----- Repère : placer des points ----- */
  A.graph = {
    label: 'Repère (placer des points)', icon: '⌗', graded: true,
    render(b, ctx) {
      const xmax = b.xmax || 60, ymax = b.ymax || 60, step = b.step || 10, tol = b.tolerance != null ? b.tolerance : step / 2;
      const pts = (b.points || []);
      let placed = ((ctx.answer && ctx.answer.value) || []).slice();
      const W = 420, H = Math.round(W * ymax / xmax), M = 36;
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W + M + 16} ${H + M + 16}`); svg.setAttribute('class', 'graph');
      const sx = (x) => M + (x / xmax) * W, sy = (y) => 8 + H - (y / ymax) * H;
      const el = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
      const draw = (res) => {
        svg.innerHTML = '';
        for (let x = 0; x <= xmax + 1e-9; x += step / 2) svg.append(el('line', { x1: sx(x), y1: sy(0), x2: sx(x), y2: sy(ymax), class: Math.abs(x / step - Math.round(x / step)) < 1e-6 ? 'g-major' : 'g-minor' }));
        for (let y = 0; y <= ymax + 1e-9; y += step / 2) svg.append(el('line', { x1: sx(0), y1: sy(y), x2: sx(xmax), y2: sy(y), class: Math.abs(y / step - Math.round(y / step)) < 1e-6 ? 'g-major' : 'g-minor' }));
        for (let x = 0; x <= xmax + 1e-9; x += step) svg.append(el('text', { x: sx(x), y: sy(0) + 16, class: 'g-lbl', 'text-anchor': 'middle' }, String(x)));
        for (let y = 0; y <= ymax + 1e-9; y += step) svg.append(el('text', { x: sx(0) - 6, y: sy(y) + 4, class: 'g-lbl', 'text-anchor': 'end' }, String(y)));
        svg.append(el('text', { x: sx(xmax), y: sy(0) + 30, class: 'g-axis', 'text-anchor': 'end' }, 'x' + (b.unit ? ' (' + b.unit + ')' : '')), el('text', { x: sx(0) + 6, y: sy(ymax) + 14, class: 'g-axis' }, 'y' + (b.unit ? ' (' + b.unit + ')' : '')));
        if (b.connect !== false && placed.length > 1) svg.append(el('polyline', { points: placed.map((p) => sx(p.x) + ',' + sy(p.y)).join(' '), class: 'g-path' }));
        placed.forEach((p, i) => {
          const ok = res ? res[i] : null;
          svg.append(el('circle', { cx: sx(p.x), cy: sy(p.y), r: 6, class: 'g-pt' + (ok === true ? ' ok' : ok === false ? ' bad' : '') }), el('text', { x: sx(p.x) + 9, y: sy(p.y) - 8, class: 'g-name' }, pts[i] ? pts[i].name : '?'));
        });
      };
      svg.addEventListener('click', (e) => {
        if (placed.length >= pts.length) { TL.toast('Tous les points sont placés. « Annuler » retire le dernier.'); return; }
        const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
        const q = p.matrixTransform(svg.getScreenCTM().inverse());
        const snap = step / 2;
        const x = TL.clamp(Math.round(((q.x - M) / W) * xmax / snap) * snap, 0, xmax), y = TL.clamp(Math.round(((8 + H - q.y) / H) * ymax / snap) * snap, 0, ymax);
        placed.push({ x, y }); draw(); ctx.save({ value: placed.slice() }); next.textContent = nextTxt();
      });
      const nextTxt = () => (placed.length < pts.length ? 'Place le point ' + pts[placed.length].name + ' (' + pts[placed.length].x + ' ; ' + pts[placed.length].y + ')' : 'Tous les points sont placés.');
      const next = h('span.small', nextTxt());
      const tbl = b.showTable === false ? null : h('table.sh-table.small-t', h('thead', h('tr', h('th', 'Point'), h('th', 'x' + (b.unit ? ' (' + b.unit + ')' : '')), h('th', 'y' + (b.unit ? ' (' + b.unit + ')' : '')))), h('tbody', pts.map((p) => h('tr', h('th', p.name), h('td', String(p.x)), h('td', String(p.y))))));
      const res = () => placed.map((p, i) => pts[i] && Math.abs(p.x - pts[i].x) <= tol && Math.abs(p.y - pts[i].y) <= tol);
      const bar = TL.checkBar(ctx, {
        check() { const r = res(); draw(r); const good = r.filter(Boolean).length; return { value: placed.slice(), correct: good === pts.length, score: good / pts.length, msg: `${good} point(s) bien placé(s) sur ${pts.length}.` }; },
        reveal() { placed = pts.map((p) => ({ x: p.x, y: p.y })); draw(res()); },
        reset() { placed = []; draw(); next.textContent = nextTxt(); },
      });
      draw(ctx.answer && ctx.answer.attempts ? res() : null);
      return h('div.act', qhead(b), h('div.graph-wrap', tbl, h('div.graph-box', svg, h('div.actions', next, h('button.btn.small.ghost', { type: 'button', onclick: () => { placed.pop(); draw(); ctx.save({ value: placed.slice() }); next.textContent = nextTxt(); } }, 'Annuler le dernier point')))), bar);
    },
  };

  /* ----- Zone de dessin ----- */
  A.draw = {
    label: 'Zone de dessin', icon: '✏', graded: true,
    render(b, ctx) {
      let strokes = ((ctx.answer && ctx.answer.value && ctx.answer.value.strokes) || []).slice();
      const cols = b.colors || ['#E53935', '#2F57A1', '#111111'];
      let color = cols[0], tool = b.straight ? 'line' : 'pen', cur = null;
      const W = 1000, H = Math.round(W * (b.ratio || 0.45));
      const cv = h('canvas.draw-cv', { width: W, height: H, 'aria-label': 'Zone de dessin' });
      const g = cv.getContext('2d');
      let bg = null;
      if (b.bg) { bg = new Image(); bg.onload = () => paint(); bg.src = b.bg; }
      function paint() {
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        if (bg && bg.complete && bg.naturalWidth) { const s = Math.min(W / bg.naturalWidth, H / bg.naturalHeight); g.drawImage(bg, (W - bg.naturalWidth * s) / 2, (H - bg.naturalHeight * s) / 2, bg.naturalWidth * s, bg.naturalHeight * s); }
        else if (b.grid !== false) { g.strokeStyle = '#E3E8F4'; g.lineWidth = 1; for (let x = 0; x < W; x += 25) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 25) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
        g.lineCap = 'round'; g.lineJoin = 'round';
        strokes.concat(cur ? [cur] : []).forEach((s) => {
          g.strokeStyle = s.c; g.lineWidth = s.w; g.globalCompositeOperation = s.c === 'erase' ? 'destination-out' : 'source-over';
          if (s.c === 'erase') { g.strokeStyle = '#fff'; g.globalCompositeOperation = 'source-over'; }
          g.beginPath(); s.p.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1]))); g.stroke();
        });
        g.globalCompositeOperation = 'source-over';
      }
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)]; };
      cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = { c: tool === 'erase' ? 'erase' : color, w: tool === 'erase' ? 26 : 5, p: [pos(e)] }; if (tool === 'line') cur.p.push(pos(e)); paint(); });
      cv.addEventListener('pointermove', (e) => { if (!cur) return; if (tool === 'line') cur.p[1] = pos(e); else cur.p.push(pos(e)); paint(); });
      const end = () => { if (!cur) return; strokes.push(cur); cur = null; paint(); ctx.save({ value: { strokes } }); };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      const tools = h('div.draw-tools',
        cols.map((c) => h('button.swatch' + (c === color ? '.on' : ''), { type: 'button', style: { background: c }, 'aria-label': 'Couleur', onclick: (e) => { color = c; if (tool === 'erase') tool = 'pen'; TL.$$('.swatch', tools).forEach((x) => x.classList.toggle('on', x === e.currentTarget)); } })),
        ...[['pen', 'Crayon'], ['line', 'Trait droit'], ['erase', 'Gomme']].map(([t, n]) => h('button.btn.small' + (t === tool ? '.primary' : '.ghost'), { type: 'button', dataset: { t }, onclick: (e) => { tool = t; TL.$$('[data-t]', tools).forEach((x) => { x.className = 'btn small ' + (x.dataset.t === t ? 'primary' : 'ghost'); }); } }, n)),
        h('button.btn.small.ghost', { type: 'button', onclick: () => { strokes.pop(); paint(); ctx.save({ value: { strokes } }); } }, 'Annuler'),
        h('button.btn.small.ghost', { type: 'button', onclick: () => { strokes = []; paint(); ctx.save({ value: { strokes } }); } }, 'Tout effacer'));
      const send = h('button.btn.primary', { type: 'button', onclick: () => {
        if (!strokes.length) { TL.toast('Dessine d’abord.'); return; }
        ctx.result(Object.assign({}, ctx.answer, { value: { strokes, png: cv.toDataURL('image/png') }, done: true, correct: true, score: 1, attempts: ((ctx.answer && ctx.answer.attempts) || 0) + 1, at: Date.now(), pendingReview: true }));
        TL.toast('Dessin rendu.', 'ok');
      } }, 'Rendre mon dessin');
      paint();
      return h('div.act', qhead(b), tools, h('div.draw-box', cv), h('div.checkbar', send));
    },
  };

  /* ----- Carte mentale ----- */
  A.mindmap = {
    label: 'Carte mentale', icon: '✺', graded: true,
    render(b, ctx) {
      const saved = (ctx.answer && ctx.answer.value) || {};
      const fields = [];
      const brs = b.branches || [];
      const branch = (br, bi) => {
        const n = br.n || (br.answers || []).length || 2;
        const ins = [...Array(n)].map((_, k) => { const el = caseInput(saved[bi + '-' + k], br.label + ' ' + (k + 1)); el.classList.add('dotted'); el.oninput = () => { el.classList.remove('is-ok', 'is-bad'); ctx.save({ value: collect() }); }; fields.push({ bi, k, el }); return el; });
        return h('div.mm-branch', h('div.mm-box', br.label), ins);
      };
      const half = Math.ceil(brs.length / 2);
      const map = h('div.mm', h('div.mm-col', brs.slice(0, half).map((br, i) => branch(br, i))), h('div.mm-center', h('span', b.center || 'NOTION')), h('div.mm-col', brs.slice(half).map((br, i) => branch(br, i + half))));
      const collect = () => Object.fromEntries(fields.map((f) => [f.bi + '-' + f.k, f.el.value]));
      const graded = brs.some((br) => br.answers && br.answers.length);
      const okBranch = (bi) => { const exp = (brs[bi].answers || []).map((x) => answersOf(x)); const got = fields.filter((f) => f.bi === bi); const used = new Set(); return got.map((f) => { const i = exp.findIndex((alts, j) => !used.has(j) && alts.some((a) => same(f.el.value, a))); if (i >= 0) { used.add(i); return true; } return false; }); };
      const paint = () => brs.forEach((_, bi) => { const r = okBranch(bi); fields.filter((f) => f.bi === bi).forEach((f, k) => { f.el.classList.toggle('is-ok', r[k]); f.el.classList.toggle('is-bad', !r[k]); }); });
      const bar = TL.checkBar(ctx, graded ? {
        check() { paint(); let good = 0; brs.forEach((_, bi) => (good += okBranch(bi).filter(Boolean).length)); return { value: collect(), correct: good === fields.length, score: good / fields.length, msg: `${good} réponse(s) attendue(s) sur ${fields.length}.` }; },
        reveal() { brs.forEach((br, bi) => fields.filter((f) => f.bi === bi).forEach((f, k) => (f.el.value = br.answers && br.answers[k] ? answersOf(br.answers[k])[0] : f.el.value))); paint(); },
        reset() { fields.forEach((f) => { f.el.value = ''; f.el.classList.remove('is-ok', 'is-bad'); }); },
      } : {
        checkLabel: 'Valider ma carte',
        check() { const filled = fields.filter((f) => f.el.value.trim()).length; if (!filled) { TL.toast('Complète au moins une branche.'); return null; } return { value: collect(), correct: true, score: filled / fields.length, msg: '', pendingReview: true }; },
      });
      if (graded && ctx.answer && ctx.answer.attempts) paint();
      return h('div.act', qhead(b), h('div.mm-wrap', map), bar);
    },
  };

  /* ----- Je fais le point (auto-évaluation) ----- */
  A.autoeval = {
    label: 'Je fais le point', icon: '◔', graded: false,
    render(b, ctx) {
      const scale = b.scale || ['oui', 'un peu', 'pas encore'];
      const saved = (ctx.answer && ctx.answer.value) || {};
      return h('div.act', qhead(b, 'Je fais le point : je colorie un rond par ligne.'), h('table.sh-ae', h('thead', h('tr', h('th', ''), scale.map((s) => h('th', s)))),
        h('tbody', b.items.map((it, i) => h('tr', h('td', it), scale.map((s, k) => {
          const r = h('input.ae', { type: 'radio', name: ctx.uid + '-ae' + i, checked: saved[i] === k, 'aria-label': it + ' : ' + s, dataset: { k } });
          r.onchange = () => { saved[i] = k; ctx.save({ value: Object.assign({}, saved), at: Date.now() }); };
          return h('td.vf-c', r);
        }))))));
    },
  };

  /* ----- Questions de fin de partie (« Recopie et réponds… ») ----- */
  A.questions = {
    label: 'Questions de fin de partie', icon: '❝', graded: true,
    render(b, ctx) {
      const saved = (ctx.answer && ctx.answer.value) || {};
      const digital = b.mode !== 'cahier';
      const items = (b.items || []).map((it, i) => {
        const q = typeof it === 'string' ? { q: it } : it;
        const letter = q.n || String.fromCharCode(97 + i) + ')';
        const ta = digital ? h('textarea.case.area', { rows: 2, 'aria-label': 'Réponse ' + letter, placeholder: 'Ta réponse (ou dans ton cahier)' }) : null;
        if (ta) { ta.value = saved[i] || ''; ta.oninput = TL.debounce(() => ctx.save({ value: Object.assign({}, collect()) }), 400); }
        return { q, letter, ta, el: h('li', h('span.rq-l', letter + ' '), h('span', { html: TL.inlineMd(q.q) }), q.corr ? h('div.sb-corr.inline', h('b', 'Corr. '), q.corr) : null, ta) };
      });
      const collect = () => Object.fromEntries(items.map((x, i) => [i, x.ta ? x.ta.value : '']));
      const state = h('span.small.muted');
      const paint = () => { const a = ctx.answer; state.textContent = a && a.done ? 'Réponses rendues le ' + TL.fmtDate(a.at) + (a.teacher ? ' · ' + a.teacher.grade + (a.teacher.comment ? ' — ' + a.teacher.comment : '') : '') : ''; };
      const send = digital ? h('button.btn.primary', { type: 'button', onclick: () => {
        const v = collect(); const n = Object.values(v).filter((x) => x.trim()).length;
        if (!n) { TL.toast('Réponds au moins à une question.'); return; }
        ctx.result(Object.assign({}, ctx.answer, { value: v, done: n === items.length, correct: n === items.length, score: n / items.length, attempts: ((ctx.answer && ctx.answer.attempts) || 0) + 1, at: Date.now(), pendingReview: true }));
        paint(); TL.toast(n === items.length ? 'Réponses rendues.' : n + ' réponse(s) enregistrée(s) sur ' + items.length + '.', 'ok');
      } }, 'Rendre mes réponses') : null;
      paint();
      return h('div.act.recopie', h('p.rq-title', h('b', b.title || 'Recopie et réponds dans ton cahier, sous la partie collée :')), h('ul.rq', items.map((x) => x.el)), digital ? h('div.checkbar', send, state) : null);
    },
  };

  /* ----- Structure et encadrés ----- */
  A.decoupe = { label: 'Ligne de découpe', icon: '✂', render: () => h('div.decoupe', { role: 'separator', 'aria-label': 'Ligne de découpe' }, h('span', '✂')) };
  A.filet = { label: 'Filet séparateur', icon: '—', render: () => h('hr.filet') };
  A.objectif = { label: 'Bandeau objectif', icon: '◎', render: (b) => h('div.sh-objectif', h('b', (b.label || 'Objectif') + ' : '), h('span', { html: TL.inlineMd(b.md || '') })) };
  A.retenir = { label: 'À retenir', icon: '★', render: (b) => h('div.retenir', h('b.retenir-t', b.title || 'À retenir'), h('div', { html: TL.md(b.md || '') })) };
  A.ressource = {
    label: 'Ressource encadrée', icon: '❏',
    render(b) {
      return h('div.res-frame', h('span.res-label', 'Ressource ' + (b.num || '')),
        b.title ? h('h3.res-title', b.title) : null,
        b.md ? h('div.prose', { html: TL.md(b.md) }) : null,
        b.src ? h('figure.figure', h('img', { src: b.src, alt: b.caption || '', loading: 'lazy' }), b.caption ? h('figcaption', b.caption) : null) : null,
        b.svg ? h('div.svgwrap', { html: b.svg }) : null,
        b.qr ? h('a.res-qr', { href: b.qr, target: '_blank', rel: 'noopener' }, h('span', '▣'), b.qrLabel || 'Ouvrir la simulation') : null);
    },
  };
  A.mots = {
    label: 'Les mots à connaître', icon: 'Aa',
    render: (b) => h('div.mots', h('h3', b.title || 'Les mots à connaître'), h('dl', (b.items || []).map((it) => h('div.mot', h('dt', it.mot), h('dd', it.def))))),
  };

  /* ----- Améliorations des champs existants ----- */
  // Association en « relier » (points et traits), comme sur papier
  A.match = {
    label: 'Relier (association)', icon: '⇄', graded: true,
    render(b, ctx) {
      const rights = TL.shuffle([...new Set(b.pairs.map((p) => p[1]).concat(b.distractors || []))], ctx.seed);
      let links = ((ctx.answer && ctx.answer.value) || []).slice();
      if (!Array.isArray(links)) links = [];
      let pickL = null, showRes = !!(ctx.answer && ctx.answer.attempts);
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'rel-lines');
      const L = b.pairs.map((p, i) => h('button.rel-item.left', { type: 'button', onclick: () => { pickL = pickL === i ? null : i; draw(); } }, h('span', { html: TL.inlineMd(p[0]) }), h('span.rel-dot')));
      const R = rights.map((r) => h('button.rel-item.right', { type: 'button', onclick: () => { if (pickL == null) { const i = links.indexOf(r); if (i >= 0) { links[i] = null; changed(); } return; } links[pickL] = r; pickL = null; changed(); } }, h('span.rel-dot'), h('span', { html: TL.inlineMd(r) })));
      const grid = h('div.rel', h('div.rel-col', L), h('div.rel-gap'), h('div.rel-col', R), svg);
      function changed() { showRes = false; draw(); ctx.save({ value: links.slice() }); }
      function draw() {
        L.forEach((x, i) => x.classList.toggle('picked', pickL === i));
        R.forEach((x) => x.classList.toggle('armed', pickL != null));
        requestAnimationFrame(() => {
          svg.innerHTML = '';
          const gr = grid.getBoundingClientRect();
          svg.setAttribute('viewBox', `0 0 ${gr.width} ${gr.height}`);
          links.forEach((r, i) => {
            if (r == null) return;
            const j = rights.indexOf(r); if (j < 0) return;
            const a = L[i].querySelector('.rel-dot').getBoundingClientRect(), c = R[j].querySelector('.rel-dot').getBoundingClientRect();
            const ln = document.createElementNS(NS, 'line');
            ln.setAttribute('x1', a.left + a.width / 2 - gr.left); ln.setAttribute('y1', a.top + a.height / 2 - gr.top);
            ln.setAttribute('x2', c.left + c.width / 2 - gr.left); ln.setAttribute('y2', c.top + c.height / 2 - gr.top);
            ln.setAttribute('class', showRes ? (b.pairs[i][1] === r ? 'ok' : 'bad') : '');
            svg.append(ln);
          });
        });
      }
      const bar = TL.checkBar(ctx, {
        check() { showRes = true; draw(); const good = b.pairs.filter((p, i) => links[i] === p[1]).length; return { value: links.slice(), correct: good === b.pairs.length, score: good / b.pairs.length, msg: `${good} liaison(s) juste(s) sur ${b.pairs.length}.` }; },
        reveal() { links = b.pairs.map((p) => p[1]); showRes = true; draw(); },
        reset() { links = []; showRes = false; draw(); },
      });
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => draw()).observe(grid);
      setTimeout(draw, 30);
      return h('div.act', qhead(b, 'Relie chaque élément.'), h('p.small.muted', 'Touche un élément à gauche, puis celui qui lui correspond à droite.'), grid, bar);
    },
  };

  // Schéma à légender : cases à compléter numérotées (saisie) ou liste
  const labelList = A.label.render;
  A.label.render = function (b, ctx) {
    if (b.mode !== 'saisie') return labelList(b, ctx);
    const saved = (ctx.answer && ctx.answer.value) || [];
    const pic = b.svg ? h('div.lbl-svg', { html: b.svg }) : h('img', { src: b.src, alt: b.alt || 'Schéma' });
    const marks = b.points.map((p, i) => h('span.lbl-mark.mono', { style: { left: p.x + '%', top: p.y + '%' } }, String(i + 1)));
    const ins = b.points.map((p, i) => { const el = caseInput(saved[i], 'Repère ' + (i + 1)); el.classList.add('dotted'); el.onfocus = () => marks.forEach((m, j) => m.classList.toggle('hl', j === i)); el.oninput = () => { el.classList.remove('is-ok', 'is-bad'); ctx.save({ value: ins.map((x) => x.value) }); }; return el; });
    const paint = () => ins.forEach((el, i) => { const ok = same(el.value, b.points[i].answer); el.classList.toggle('is-ok', ok); el.classList.toggle('is-bad', !ok); marks[i].classList.toggle('is-ok', ok); marks[i].classList.toggle('is-bad', !ok); });
    const bar = TL.checkBar(ctx, {
      check() { paint(); const good = ins.filter((el, i) => same(el.value, b.points[i].answer)).length; return { value: ins.map((x) => x.value), correct: good === ins.length, score: good / ins.length, msg: `${good} case(s) juste(s) sur ${ins.length}.` }; },
      reveal() { ins.forEach((el, i) => (el.value = answersOf(b.points[i].answer)[0])); paint(); },
      reset() { ins.forEach((el) => { el.value = ''; el.classList.remove('is-ok', 'is-bad'); }); },
    });
    if (ctx.answer && ctx.answer.attempts) paint();
    const bank = b.bank ? TL.shuffle(b.points.map((p) => answersOf(p.answer)[0]).concat(b.distractors || []), ctx.seed) : null;
    return h('div.act', qhead(b), bank ? bankBand(bank) : null, h('div.lbl', h('div.lbl-pic', pic, marks), h('div.lbl-cases', ins.map((el, i) => h('label.lbl-case', h('span.lbl-num', String(i + 1)), el)))), bar);
  };

  // Texte à trous : banque de mots et pointillés
  const clozeRender = A.cloze.render;
  A.cloze.render = function (b, ctx) {
    const el = clozeRender(b, ctx);
    if (b.bank) {
      const words = Array.isArray(b.bank) ? b.bank : TL.shuffle((b.text.match(/\[\[(.+?)\]\]/g) || []).map((m) => m.slice(2, -2)).filter((x) => !x.startsWith('!')).map((x) => x.split('|')[0]).concat(b.bankExtra || []), ctx.seed);
      el.insertBefore(bankBand(words), el.querySelector('.cloze'));
    }
    return el;
  };
})();
