/* TechnoStudio — éditeur v2 : la feuille au centre du plan de travail, panneaux
   Feuilles · Insertion · Propriétés · Fiche pédagogique autour.
   Champs de la charte : tableau, vrai/faux, cases reliées, binaire, repère,
   dessin, carte mentale, auto-évaluation, questions de fin de partie, etc. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const E = TL.editor;
  const T = E.TEMPLATES, S = E.SCHEMA;

  /* ---------- Modèles des nouveaux champs ---------- */
  Object.assign(T, {
    decoupe: () => ({ type: 'decoupe' }),
    filet: () => ({ type: 'filet' }),
    objectif: () => ({ type: 'objectif', md: 'je sais …' }),
    retenir: () => ({ type: 'retenir', md: 'Ce qu’il faut retenir.' }),
    ressource: () => ({ type: 'ressource', num: '1', title: 'Titre de la ressource', md: '' }),
    mots: () => ({ type: 'mots', items: [{ mot: 'constituant', def: 'une pièce de l’objet' }] }),
    questions: () => ({ type: 'questions', items: [{ q: 'Première question ?' }, { q: 'Deuxième question ?' }] }),
    table: () => ({ type: 'table', question: 'Complète le tableau.', tag: 'papier', headers: ['Fonction', 'Constituant'], rows: [['Fournir l’énergie', { a: 'piles|les piles' }], ['Commander le courant', { a: 'interrupteur' }]] }),
    vraifaux: () => ({ type: 'vraifaux', question: 'Coche vrai ou faux.', tag: 'papier', items: [{ text: 'Première affirmation', v: true }, { text: 'Deuxième affirmation', v: false }] }),
    boxes: () => ({ type: 'boxes', question: 'Complète la chaîne d’énergie : fonction puis constituant.', tag: 'papier', items: [{ top: { a: 'Alimenter' }, bottom: { a: 'piles' } }, { top: { a: 'Distribuer' }, bottom: { a: 'interrupteur' } }, { top: { a: 'Convertir' }, bottom: { a: 'LED' } }] }),
    bits: () => ({ type: 'bits', question: 'Numérise la carte : trou = 1, pas de trou = 0. Écris les 8 bits puis la valeur décimale.', tag: 'papier', rows: [{ label: 'L1', bits: '10000011' }, { label: 'L2', bits: '01001001' }] }),
    graph: () => ({ type: 'graph', question: 'Place les points dans l’ordre et relie-les.', tag: 'papier', xmax: 60, ymax: 60, step: 10, unit: 'mm', points: [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: 40, y: 0 }, { name: 'C', x: 40, y: 30 }] }),
    draw: () => ({ type: 'draw', question: 'Dessine le schéma électrique.', tag: 'papier' }),
    mindmap: () => ({ type: 'mindmap', question: 'Complète la carte mentale.', center: 'NOTION', branches: [{ label: 'Branche 1', answers: ['', ''] }, { label: 'Branche 2', n: 2 }] }),
    autoeval: () => ({ type: 'autoeval', question: 'Je fais le point : je colorie un rond par ligne.', items: ['Je sais nommer les constituants.', 'Je sais décrire la chaîne d’énergie.'] }),
    code: () => ({ type: 'code', question: 'Programme la carte.', tag: 'ordi', board: 'uno' }),
  });

  /* ---------- Formulaires ---------- */
  const Q = { k: 'question', kind: 'markdown', label: 'Consigne (bande question)', rows: 2 };
  const HINT = { k: 'hint', kind: 'text', label: 'Indice (après un essai raté)' };
  const EXPL = { k: 'explanation', kind: 'markdown', label: 'Explication (après réponse)', rows: 2 };
  Object.assign(S, {
    decoupe: [], filet: [],
    objectif: [{ k: 'label', kind: 'text', label: 'Intitulé (Objectif)' }, { k: 'md', kind: 'markdown', label: 'Texte', rows: 2 }],
    retenir: [{ k: 'title', kind: 'text', label: 'Titre (À retenir)' }, { k: 'md', kind: 'markdown', label: 'Texte', rows: 4 }],
    ressource: [{ k: 'num', kind: 'text', label: 'Numéro (1, 2, S1, A…)' }, { k: 'title', kind: 'text', label: 'Titre' }, { k: 'md', kind: 'markdown', label: 'Texte', rows: 5 }, { k: 'src', kind: 'image', label: 'Image' }, { k: 'caption', kind: 'text', label: 'Légende' }, { k: 'qr', kind: 'text', label: 'Lien vers une simulation (QR)' }],
    mots: [{ k: 'title', kind: 'text', label: 'Titre' }, { k: 'items', kind: 'motsItems', label: 'Mots (« mot : définition », un par ligne)' }],
    questions: [{ k: 'title', kind: 'text', label: 'Phrase d’introduction', help: 'Par défaut : « Recopie et réponds dans ton cahier, sous la partie collée : »' }, { k: 'items', kind: 'qItems', label: 'Questions (une par ligne ; « || » puis la correction)' }, { k: 'mode', kind: 'select', label: 'Réponses', opts: [['saisie', 'dans l’appli et/ou le cahier'], ['cahier', 'dans le cahier seulement']] }],
    table: [Q, { k: 'rows', kind: 'tableEd', label: 'Tableau', help: 'Case à compléter : commence par « ? » (variantes séparées par « | »). Case à cocher : [x] ou [ ]. Sinon : texte affiché.' }, { k: 'bank', kind: 'check', label: 'Afficher une banque de mots' }, HINT, EXPL],
    vraifaux: [Q, { k: 'items', kind: 'vfItems', label: 'Affirmations (« V | texte » ou « F | texte »)' }, HINT, EXPL],
    boxes: [Q, { k: 'items', kind: 'boxItems', label: 'Cases (« haut | bas » par case ; « ? » = à compléter)', help: 'Exemple : ?Alimenter | ?piles' }, { k: 'topLabel', kind: 'text', label: 'Légende rangée du haut' }, { k: 'bottomLabel', kind: 'text', label: 'Légende rangée du bas' }, { k: 'bank', kind: 'check', label: 'Afficher une banque de mots' }, HINT, EXPL],
    bits: [Q, { k: 'rows', kind: 'bitsRows', label: 'Lignes (« L1 | 10000011 »)' }, { k: 'decimal', kind: 'checkInv', label: 'Sans valeur décimale' }, { k: 'showCard', kind: 'checkInv', label: 'Sans dessin de la carte perforée' }, HINT, EXPL],
    graph: [Q, { k: 'points', kind: 'ptsItems', label: 'Points (« A | 0 | 0 »)' }, { k: 'xmax', kind: 'number', label: 'x max' }, { k: 'ymax', kind: 'number', label: 'y max' }, { k: 'step', kind: 'number', label: 'Pas de graduation' }, { k: 'unit', kind: 'text', label: 'Unité' }, { k: 'connect', kind: 'checkInv', label: 'Ne pas relier les points' }, HINT, EXPL],
    draw: [Q, { k: 'bg', kind: 'image', label: 'Image de fond (facultatif)' }, { k: 'ratio', kind: 'number', label: 'Hauteur / largeur (0,45 par défaut)' }, { k: 'straight', kind: 'check', label: 'Traits droits par défaut' }],
    mindmap: [Q, { k: 'center', kind: 'text', label: 'Centre' }, { k: 'branches', kind: 'brItems', label: 'Branches (« Titre : réponse ; réponse » ou « Titre : 2 » pour 2 cases libres)' }, HINT],
    autoeval: [Q, { k: 'items', kind: 'lines', label: 'Critères (un par ligne)', rows: 4 }, { k: 'scale', kind: 'csv', label: 'Échelle (oui, un peu, pas encore)' }],
    code: [Q, { k: 'board', kind: 'select', label: 'Carte', opts: () => Object.entries(TL.code.BOARDS).map(([k, b]) => [k, b.name]) }, { k: '_ws', kind: 'codeWs', label: 'Programme de départ' }, { k: 'expect', kind: 'lines', label: 'Fragments attendus dans le code généré (un par ligne, facultatif)', rows: 3 }, { k: 'demo', kind: 'check', label: 'Démonstration (non notée)' }],
  });
  S.label = S.label.slice(); S.label.splice(1, 0, { k: 'mode', kind: 'select', label: 'Réponse', opts: [['liste', 'liste déroulante'], ['saisie', 'cases à compléter (saisie)']] }, { k: 'bank', kind: 'check', label: 'Banque de mots (mode saisie)' });
  S.cloze = S.cloze.slice(); S.cloze.splice(1, 0, { k: 'bank', kind: 'check', label: 'Afficher une banque de mots' });
  // champs communs de la charte
  const LAYOUT = [
    { k: 'tag', kind: 'select', label: 'Étiquette', opts: [['papier', 'PAPIER'], ['ordi', 'ORDI'], ['none', 'aucune']] },
    { k: 'num', kind: 'text', label: 'Numéro (auto si vide)' },
    { k: 'comp', kind: 'csv', label: 'Compétences (T2C11, …)' },
    { k: 'bareme', kind: 'number', label: 'Barème (évaluation)' },
    { k: 'corr', kind: 'markdown', label: 'Correction (calque _Corr, visible enseignant)', rows: 2 },
  ];

  const lines = (v) => String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const cellToTxt = (c) => (c && typeof c === 'object' ? (c.check != null ? (c.check ? '[x]' : '[ ]') : '?' + (c.a || '')) : c == null ? '' : String(c));
  const txtToCell = (t) => { t = String(t || ''); if (/^\[x\]$/i.test(t.trim())) return { check: true }; if (/^\[ \]$/.test(t.trim())) return { check: false }; if (t.startsWith('?')) return { a: t.slice(1).trim() }; return t; };

  E.extraField = function (b, sp, changed, wrap, id) {
    const area = (value, parse, rows) => { const x = h('textarea.field', { id, rows: rows || 5 }); x.value = value; x.oninput = () => { parse(x.value); changed(); }; return wrap(x); };
    switch (sp.kind) {
      case 'motsItems': return area((b.items || []).map((i) => i.mot + ' : ' + i.def).join('\n'), (v) => (b.items = lines(v).map((l) => { const i = l.indexOf(':'); return i < 0 ? { mot: l, def: '' } : { mot: l.slice(0, i).trim(), def: l.slice(i + 1).trim() }; })));
      case 'qItems': return area((b.items || []).map((q) => (typeof q === 'string' ? q : q.q + (q.corr ? ' || ' + q.corr : ''))).join('\n'), (v) => (b.items = lines(v).map((l) => { const [q, c] = l.split('||'); return c ? { q: q.trim(), corr: c.trim() } : { q: q.trim() }; })));
      case 'vfItems': return area((b.items || []).map((i) => (i.v ? 'V' : 'F') + ' | ' + i.text).join('\n'), (v) => (b.items = lines(v).map((l) => { const m = l.match(/^([VF])\s*\|\s*(.*)$/i); return m ? { text: m[2], v: m[1].toUpperCase() === 'V' } : { text: l, v: true }; })));
      case 'boxItems': return area((b.items || []).map((i) => [i.top, i.bottom].map((x) => (x == null ? '' : cellToTxt(x))).join(' | ')).join('\n'), (v) => (b.items = lines(v).map((l) => { const [t, bo] = l.split('|').map((x) => x.trim()); return { top: t ? txtToCell(t) : undefined, bottom: bo ? txtToCell(bo) : undefined }; })));
      case 'bitsRows': return area((b.rows || []).map((r) => r.label + ' | ' + r.bits).join('\n'), (v) => (b.rows = lines(v).map((l) => { const [lab, bits] = l.split('|').map((x) => x.trim()); return { label: lab, bits: (bits || '').replace(/[^01]/g, '') }; })), 3);
      case 'ptsItems': return area((b.points || []).map((p) => p.name + ' | ' + p.x + ' | ' + p.y).join('\n'), (v) => (b.points = lines(v).map((l) => { const [n, x, y] = l.split('|').map((s) => s.trim()); return { name: n, x: parseFloat(String(x).replace(',', '.')) || 0, y: parseFloat(String(y).replace(',', '.')) || 0 }; })));
      case 'brItems': return area((b.branches || []).map((br) => br.label + ' : ' + (br.answers && br.answers.some(Boolean) ? br.answers.join(' ; ') : br.n || 2)).join('\n'), (v) => (b.branches = lines(v).map((l) => { const i = l.indexOf(':'); const lab = (i < 0 ? l : l.slice(0, i)).trim(); const rest = i < 0 ? '' : l.slice(i + 1).trim(); return /^\d+$/.test(rest) ? { label: lab, n: +rest } : { label: lab, answers: rest.split(';').map((s) => s.trim()).filter(Boolean) }; })));
      case 'tableEd': {
        const box = h('div.tabled');
        const draw = () => {
          box.innerHTML = '';
          b.headers = b.headers || [];
          b.rows = b.rows && b.rows.length ? b.rows : [['', { a: '' }]];
          const cols = Math.max(b.headers.length, ...b.rows.map((r) => r.length));
          const t = h('table.tabled-t');
          t.append(h('tr', [...Array(cols)].map((_, c) => h('th', h('input.field.small', { type: 'text', value: b.headers[c] || '', placeholder: 'En-tête', 'aria-label': 'En-tête ' + (c + 1), oninput: (e) => { b.headers[c] = e.target.value; changed(); } }))), h('th')));
          b.rows.forEach((r, ri) => t.append(h('tr', [...Array(cols)].map((_, c) => h('td', h('input.field.small' + (r[c] && typeof r[c] === 'object' ? '.ans' : ''), { type: 'text', value: cellToTxt(r[c]), 'aria-label': 'Case ' + (ri + 1) + '-' + (c + 1), oninput: (e) => { r[c] = txtToCell(e.target.value); e.target.classList.toggle('ans', typeof r[c] === 'object'); changed(); } }))),
            h('td', h('button.icon-btn', { type: 'button', title: 'Supprimer la ligne', onclick: () => { b.rows.splice(ri, 1); draw(); changed(); } }, '✕')))));
          box.append(h('div.tablewrap', t), h('div.actions', h('button.btn.small.ghost', { type: 'button', onclick: () => { b.rows.push([...Array(cols)].map(() => '')); draw(); changed(); } }, '+ Ligne'), h('button.btn.small.ghost', { type: 'button', onclick: () => { b.headers.push(''); b.rows.forEach((r) => r.push('')); draw(); changed(); } }, '+ Colonne'), h('button.btn.small.ghost', { type: 'button', disabled: cols < 2, onclick: () => { b.headers.pop(); b.rows.forEach((r) => r.splice(cols - 1)); draw(); changed(); } }, '− Colonne')));
        };
        draw();
        return wrap(box);
      }
      case 'codeWs': {
        const holder = h('div.code-ed', h('p.small.muted', 'Chargement de Blockly…'));
        TL.code.load().then(() => {
          holder.innerHTML = '';
          const div = h('div.blockly-host.small');
          holder.append(div);
          const board = b.board || 'uno';
          const old = TL.code.board; TL.code.board = board;
          const ws = window.Blockly.inject(div, { toolbox: TL.code.toolbox(board), media: TL.code.media || undefined, trashcan: false, sounds: false, renderer: 'zelos', zoom: { wheel: false, startScale: 0.7 }, move: { scrollbars: true, drag: true, wheel: false } });
          try { window.Blockly.serialization.workspaces.load(b.start || TL.code.EXAMPLES.vide.ws(), ws); } catch (e) { window.Blockly.serialization.workspaces.load(TL.code.EXAMPLES.vide.ws(), ws); }
          TL.code.board = old;
          ws.addChangeListener(TL.debounce((ev) => { if (ev && ev.isUiEvent) return; b.start = window.Blockly.serialization.workspaces.save(ws); changed(); }, 400));
          new ResizeObserver(() => window.Blockly.svgResize(ws)).observe(holder);
        }).catch((e) => { holder.innerHTML = ''; holder.append(h('p.callout.warn', e.message)); });
        return wrap(holder);
      }
    }
    return null;
  };

  /* ---------- Insertion ---------- */
  const GROUPS = [
    ['Mise en page', ['objectif', 'decoupe', 'filet', 'questions', 'retenir']],
    ['Contenus', ['text', 'ressource', 'mots', 'image', 'scan', 'svg', 'link']],
    ['Comme sur papier', ['label', 'table', 'vraifaux', 'qcm', 'cloze', 'match', 'boxes', 'order', 'sort', 'numeric', 'bits', 'graph', 'draw', 'mindmap', 'procedure', 'report', 'autoeval']],
    ['Numérique (ORDI)', ['circuit', 'blocks', 'code', 'chain']],
  ];
  let ctx = null; // { w, s, sel, insert(type) }
  E.insertMenu = function () {
    const items = [];
    GROUPS.forEach(([g, types], gi) => { if (gi) items.push({ sep: true }); items.push({ head: g }); types.forEach((t) => items.push({ label: TL.activities[t].label, action: () => ctx && ctx.insert(t) })); });
    return items;
  };

  /* ---------- Vue d'édition ---------- */
  E.view = async function (root, id) {
    const app = TL.app;
    let w = app.workshops.get(id);
    if (!w) { root.append(h('div.pasteboard', h('div.desk', h('p', 'Atelier introuvable.')))); return; }
    if (w.source === 'demo') {
      const copy = TL.clone(w); copy.id = TL.uid('at-'); copy.title = w.title + ' (ma version)'; copy.author = (app.profile && app.profile.name) || ''; copy.version = 1;
      const saved = await app.saveWorkshop(copy, 'local');
      TL.toast('Copie créée : tu peux la modifier librement.');
      location.replace('#ed-' + saved.id); return;
    }
    w = TL.clone(w);
    TL.normalizeWorkshop(w);
    E.current = { w };
    let si = 0, sel = null;
    const board = h('div.pasteboard.scroll.editing');
    const status = h('span.savestate.small', 'Enregistré');
    const bar = h('div.ed-bar', h('a.btn.small.ghost', { href: '#creer' }, '← Mes ateliers'), h('span.ed-title', w.title), status,
      h('span.ed-bar-sp'),
      h('a.btn.small.ghost', { href: '#at-' + w.id, onclick: async () => { await app.saveWorkshop(w, w.source); } }, 'Voir comme un élève'),
      h('button.btn.small.ghost', { type: 'button', onclick: () => E.importDialog(w, () => { redraw(); touch(); TL.panels.refresh('ed-feuilles'); }) }, 'Importer fiche / texte'),
      h('button.btn.small.primary', { type: 'button', onclick: async () => { await app.saveWorkshop(w, w.source); E.publish(app.workshops.get(w.id)); } }, 'Publier'));
    root.append(bar, board);
    const save = TL.debounce(async () => {
      const v = TL.descriptor.validate('Workshop', w);
      await app.saveWorkshop(TL.clone(w), w.source);
      status.textContent = v.ok ? 'Enregistré' : 'Enregistré · ' + v.errors.length + ' point(s) à corriger';
      status.title = v.errors.slice(0, 8).join('\n');
      status.classList.toggle('warn', !v.ok); status.classList.remove('dirty');
    }, 500);
    const touch = () => { status.textContent = 'Modifications…'; status.classList.add('dirty'); bar.querySelector('.ed-title').textContent = w.title; save(); };
    const redraw = TL.debounce(() => {
      const top = board.scrollTop;
      board.innerHTML = '';
      const s = w.steps[si];
      if (!s) { board.append(h('div.desk', h('p.muted', 'Ajoute une feuille dans le panneau « Feuilles ».'))); return; }
      const sheet = TL.renderSheet(w, s, si, { pg: null, readonly: true, layers: { comp: true, corr: true }, editable: true, selected: sel, onSelect: (b) => { sel = b.id; TL.$$('.sb.is-sel', board).forEach((x) => x.classList.remove('is-sel')); const el = board.querySelector('.sb[data-id="' + CSS.escape(b.id) + '"]'); if (el) el.classList.add('is-sel'); TL.panels.open('ed-props'); TL.panels.refresh('ed-props'); } });
      sheet.style.zoom = app.zoom;
      board.append(sheet);
      board.scrollTop = top;
    }, 200);
    const curStep = () => w.steps[si];
    const selBlock = () => { const s = curStep(); return s && s.blocks.find((b) => b.id === sel); };
    ctx = {
      insert(type) {
        const s = curStep(); if (!s) return;
        const nb = Object.assign({ id: TL.uid(s.id + '-b') }, T[type]());
        const at = sel ? s.blocks.findIndex((b) => b.id === sel) + 1 : s.blocks.length;
        s.blocks.splice(at < 1 ? s.blocks.length : at, 0, nb);
        sel = nb.id; redraw(); touch(); TL.panels.open('ed-props'); TL.panels.refresh('ed-props');
        setTimeout(() => { const el = board.querySelector('.sb[data-id="' + CSS.escape(nb.id) + '"]'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 260);
      },
    };

    /* Panneau Feuilles */
    TL.panels.register('ed-feuilles', { title: 'Feuilles', short: 'Feuilles', icon: '❐', w: 260, render(body) {
      const codes = TL.sheetCodes(w);
      w.steps.forEach((s, i) => {
        body.append(h('div.p-row' + (i === si ? '.on' : ''), { role: 'button', tabindex: 0, onclick: () => { si = i; sel = null; redraw(); TL.panels.refresh('ed-feuilles'); TL.panels.refresh('ed-props'); } },
          h('span.kind.k-' + (s.kind || 'feuille'), codes[i]), h('span.p-row-t', s.title),
          h('span.p-mini', h('button.icon-btn', { type: 'button', title: 'Monter', disabled: !i, onclick: (e) => { e.stopPropagation(); [w.steps[i - 1], w.steps[i]] = [w.steps[i], w.steps[i - 1]]; si = i - 1; redraw(); touch(); TL.panels.refresh('ed-feuilles'); } }, '↑'),
            h('button.icon-btn', { type: 'button', title: 'Dupliquer', onclick: (e) => { e.stopPropagation(); const c = TL.clone(s); c.id = TL.uid('e'); c.title += ' (copie)'; c.blocks.forEach((b) => (b.id = TL.uid(c.id + '-b'))); w.steps.splice(i + 1, 0, c); si = i + 1; redraw(); touch(); TL.panels.refresh('ed-feuilles'); } }, '⧉'),
            h('button.icon-btn', { type: 'button', title: 'Supprimer', onclick: async (e) => { e.stopPropagation(); if (await TL.confirm('Supprimer la feuille', '« ' + s.title + ' » et ses ' + s.blocks.length + ' champ(s) seront supprimés.', 'Supprimer')) { w.steps.splice(i, 1); si = Math.max(0, si - 1); redraw(); touch(); TL.panels.refresh('ed-feuilles'); } } }, '✕'))));
      });
      const kind = h('select.field.small', { 'aria-label': 'Type de feuille' }, Object.entries(TL.SHEET_KINDS).map(([k, v]) => h('option', { value: k }, v.label)));
      body.append(h('div.p-row2', kind, h('button.btn.small.ghost', { type: 'button', onclick: () => {
        const last = w.steps[w.steps.length - 1] || {};
        const seance = last.seance || 1, feuille = (last.feuille || 0) + 1;
        const k = kind.value;
        w.steps.push({ id: TL.uid('e'), title: k === 'feuille' ? 'Séance ' + seance + ' - Feuille ' + feuille : TL.SHEET_KINDS[k].label, kind: k, seance, feuille: k === 'feuille' ? feuille : 1, blocks: [] });
        si = w.steps.length - 1; sel = null; redraw(); touch(); TL.panels.refresh('ed-feuilles');
      } }, '+ Ajouter')));
      const s = curStep(); if (!s) return;
      body.append(h('div.p-label', 'Cette feuille'));
      const f = (k, label, type, opts) => {
        const idf = TL.uid('sf');
        let x;
        if (type === 'check') { x = h('input', { id: idf, type: 'checkbox', checked: !!s[k], onchange: () => { s[k] = x.checked || undefined; redraw(); touch(); } }); return h('label.p-check', { for: idf }, x, ' ' + label); }
        if (type === 'select') { x = h('select.field.small', { id: idf }, opts.map(([v, t]) => h('option', { value: v }, t))); x.value = s[k] || opts[0][0]; x.onchange = () => { s[k] = x.value; redraw(); touch(); TL.panels.refresh('ed-feuilles'); }; }
        else if (type === 'area') { x = h('textarea.field.small', { id: idf, rows: 2 }); x.value = s[k] || ''; x.oninput = () => { s[k] = x.value || undefined; redraw(); touch(); }; }
        else { x = h('input.field.small', { id: idf, type: type === 'number' ? 'number' : 'text', min: 1, value: s[k] || '' }); x.oninput = () => { s[k] = type === 'number' ? (+x.value || undefined) : x.value; redraw(); touch(); if (k === 'title') TL.panels.refresh('ed-feuilles'); }; }
        return h('label.p-field', { for: idf }, h('span', label), x);
      };
      body.append(f('title', 'Titre (panneau)', 'text'), f('kind', 'Type', 'select', Object.entries(TL.SHEET_KINDS).map(([k, v]) => [k, v.label])),
        h('div.p-row2', f('seance', 'Séance', 'number'), f('feuille', 'Feuille', 'number')),
        f('segpa', 'Version SEGPA', 'check'),
        (s.kind || 'feuille') === 'feuille' ? f('objectif', 'Bandeau objectif (SEGPA)', 'area') : null,
        (s.kind || 'feuille') === 'feuille' ? f('resume', 'Résumé (grand en-tête, sinon celui de l’atelier)', 'area') : null,
        s.kind === 'evaluation' ? f('consignes', 'Bandeau consignes', 'area') : null,
        s.kind === 'evaluation' ? f('verso', 'Verso (petit bandeau)', 'check') : null,
        f('numStart', 'Numéroter à partir de', 'number'));
    } });

    /* Panneau Insertion */
    TL.panels.register('ed-insertion', { title: 'Insertion', short: 'Insérer', icon: '+', w: 260, top: 330, render(body) {
      body.append(h('p.small.muted', sel ? 'Insère après le champ sélectionné.' : 'Insère en fin de feuille. Sélectionne un champ sur la feuille pour insérer après lui.'));
      GROUPS.forEach(([g, types]) => body.append(h('div.p-label', g), h('div.ins-grid', types.map((t) => h('button.ins-btn', { type: 'button', title: TL.activities[t].label, onclick: () => ctx.insert(t) }, h('span.ins-ico', { 'aria-hidden': 'true' }, TL.activities[t].icon), h('span', TL.activities[t].label))))));
    } });

    /* Panneau Propriétés */
    TL.panels.register('ed-props', { title: 'Propriétés', short: 'Propriétés', icon: '☰', side: 'right', w: 360, render(body) {
      const b = selBlock();
      if (!b) { body.append(h('p.small.muted', 'Clique sur un champ de la feuille pour le modifier ici.')); return; }
      const s = curStep(); const i = s.blocks.indexOf(b);
      const changed = () => { redraw(); touch(); };
      let json = false;
      const formBox = h('div.p-form');
      const drawForm = () => {
        formBox.innerHTML = '';
        if (json) {
          const ta = h('textarea.field.code', { rows: 16, spellcheck: false, 'aria-label': 'JSON du champ' }); ta.value = JSON.stringify(b, null, 1);
          const err = h('p.form-err');
          ta.oninput = () => { try { const nb = JSON.parse(ta.value); Object.keys(b).forEach((k) => delete b[k]); Object.assign(b, nb); err.textContent = ''; changed(); } catch (e) { err.textContent = 'JSON invalide : ' + e.message; } };
          formBox.append(ta, err); return;
        }
        formBox.append(...E.buildForm(b, changed));
        if (!['decoupe', 'filet', 'objectif', 'retenir', 'ressource', 'mots', 'questions', 'text', 'image', 'svg', 'scan', 'link'].includes(b.type)) {
          const det = h('details.p-layout', h('summary', 'Mise en page de la charte'));
          LAYOUT.forEach((sp) => { const el = E.fieldFor(b, sp, changed); if (el) det.append(el); });
          formBox.append(det);
        }
        const v = TL.descriptor.validate('Workshop', { id: 'x', title: 'x', steps: [{ title: 'x', blocks: [b] }] });
        if (!v.ok) formBox.append(h('div.callout.warn.small', v.errors.map((e) => e.replace(/^\$\.steps\[0\]\.blocks\[0\]/, 'champ')).join(' · ')));
      };
      body.append(h('div.p-row2', h('b', TL.activities[b.type] ? TL.activities[b.type].label : b.type),
        h('span.p-mini',
          h('button.icon-btn', { type: 'button', title: 'Monter', disabled: !i, onclick: () => { [s.blocks[i - 1], s.blocks[i]] = [s.blocks[i], s.blocks[i - 1]]; changed(); TL.panels.refresh('ed-props'); } }, '↑'),
          h('button.icon-btn', { type: 'button', title: 'Descendre', disabled: i === s.blocks.length - 1, onclick: () => { [s.blocks[i + 1], s.blocks[i]] = [s.blocks[i], s.blocks[i + 1]]; changed(); TL.panels.refresh('ed-props'); } }, '↓'),
          h('button.icon-btn', { type: 'button', title: 'Dupliquer', onclick: () => { const c = TL.clone(b); c.id = TL.uid(s.id + '-b'); s.blocks.splice(i + 1, 0, c); sel = c.id; changed(); TL.panels.refresh('ed-props'); } }, '⧉'),
          h('button.icon-btn', { type: 'button', title: 'Supprimer', onclick: async () => { if (await TL.confirm('Supprimer le champ', 'Ce champ sera supprimé de la feuille.', 'Supprimer')) { s.blocks.splice(i, 1); sel = null; changed(); TL.panels.refresh('ed-props'); } } }, '✕'),
          h('button.btn.small.ghost', { type: 'button', onclick: (e) => { json = !json; e.target.textContent = json ? 'Formulaire' : 'JSON'; drawForm(); } }, 'JSON'))), formBox);
      drawForm();
    } });

    /* Panneau Fiche pédagogique */
    TL.panels.register('ed-fiche', { title: 'Fiche pédagogique', short: 'Fiche', icon: 'F', side: 'right', w: 360, render(body) {
      const f = (k, label, type, extra) => {
        const idf = TL.uid('wf'); let x;
        if (type === 'area') { x = h('textarea.field.small', { id: idf, rows: (extra && extra.rows) || 2 }); x.value = w[k] || ''; x.oninput = () => { w[k] = x.value || undefined; touch(); if (k === 'summary') redraw(); }; }
        else if (type === 'select') { x = h('select.field.small', { id: idf }, extra.opts.map(([v, t]) => h('option', { value: v }, t))); x.value = w[k] || extra.opts[0][0]; x.onchange = () => { w[k] = x.value; redraw(); touch(); }; }
        else { x = h('input.field.small', { id: idf, type: type === 'number' ? 'number' : 'text', value: w[k] != null ? w[k] : '', min: extra && extra.min, max: extra && extra.max }); x.oninput = () => { w[k] = type === 'number' ? (x.value === '' ? undefined : +x.value) : x.value; redraw(); touch(); }; }
        return h('label.p-field', { for: idf }, h('span', label), x);
      };
      const compsTxt = (w.competences || []).map((c) => (typeof c === 'string' ? c : (c.code ? c.code + ' | ' : '') + c.label + (c.co ? ' | CO : ' + c.co : '') + (c.sub || []).map((s) => '\n- ' + s.code + ' : ' + s.label).join(''))).join('\n');
      const comps = h('textarea.field.small.code', { rows: 6, 'aria-label': 'Compétences' }); comps.value = compsTxt;
      comps.oninput = () => {
        const out = [];
        lines(comps.value).forEach((l) => {
          if (/^-/.test(l) && out.length) { const m = l.replace(/^-\s*/, '').match(/^(\S+)\s*:\s*(.*)$/); const last = out[out.length - 1]; if (typeof last === 'object') { last.sub = last.sub || []; last.sub.push(m ? { code: m[1], label: m[2] } : { code: '', label: l.slice(1).trim() }); } return; }
          const parts = l.split('|').map((x) => x.trim());
          const code = /^T\d/.test(parts[0]) ? parts.shift() : '';
          const co = parts.find((p) => /^CO\s*:/i.test(p));
          out.push({ code, label: parts.filter((p) => p !== co).join(' | '), co: co ? co.replace(/^CO\s*:\s*/i, '') : undefined });
        });
        w.competences = out; touch();
      };
      const der = h('textarea.field.small', { rows: 4, 'aria-label': 'Déroulement' });
      der.value = (w.deroulement || []).map((d) => [d.seance, d.objectif, d.activites, d.ressources].join(' | ')).join('\n');
      der.oninput = () => { w.deroulement = lines(der.value).map((l) => { const [seance, objectif, activites, ressources] = l.split('|').map((x) => (x || '').trim()); return { seance, objectif, activites, ressources }; }); touch(); };
      body.append(
        f('title', 'Titre de l’atelier', 'text'),
        h('div.p-row2', f('level', 'Filière', 'select', { opts: Object.entries(TL.LEVELS).map(([k, v]) => [k, v.label]) }), f('niveau', 'Niveau (pastille)', 'select', { opts: [['6e', '6e'], ['5e', '5e (vert)'], ['4e', '4e (jaune)'], ['3e', '3e (rouge)'], ['2nde', '2nde'], ['1re', '1re'], ['Tle', 'Tle'], ['Pro', 'Pro / BTS']] })),
        h('div.p-row2', f('cycle', 'Cycle', 'number'), f('seq', 'AT SEQ n°', 'number'), f('duration', 'Durée (min)', 'number')),
        f('summary', 'Résumé et objectif de l’atelier', 'area', { rows: 3 }),
        f('problematique', 'Problématique', 'area'), f('objet', 'Objet ou système technique', 'text'), f('position', 'Positionnement sur le cycle (1 à 9)', 'number', { min: 1, max: 9 }),
        h('label.p-field', h('span', 'Compétences (CT) — « T2C1 | intitulé | CO : connaissances », sous-compétences « - T2C11 : … »'), comps),
        f('presentation', 'Présentation de la séquence', 'area', { rows: 3 }), f('synthese', 'Éléments de la synthèse', 'area'), f('evaluation', 'Modalités d’évaluation', 'area'),
        h('label.p-field', h('span', 'Déroulement — « Séance 1 | objectif | activités | ressources »'), der),
        f('differenciation', 'Différenciation', 'area'), f('materiel', 'Matériel à prévoir', 'area'), f('author', 'Auteur', 'text'),
        h('div.p-col', h('a.btn.small.ghost', { href: '#fiche-' + w.id, onclick: async () => { await app.saveWorkshop(TL.clone(w), w.source); } }, 'Voir la fiche pédagogique')));
    } });

    TL.panels.setMode('edit', ['ed-feuilles', 'ed-insertion', 'ed-props', 'ed-fiche'], ['ed-feuilles', 'ed-insertion', 'ed-props']);
    redraw();
  };
})();
