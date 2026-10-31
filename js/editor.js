/* TechnoStudio — éditeur enseignant : création d'ateliers, conversion des fiches papier
   (PDF, photos, texte, GIFT Moodle), export, diffusion par la Centrale. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const E = (TL.editor = {});

  /* ---------- Fichiers : proposer un téléchargement + copie ---------- */
  TL.saveAs = function (name, text, type) {
    const ta = h('textarea.field.code', { readonly: true, rows: 8, 'aria-label': 'Contenu du fichier' });
    ta.value = text.length > 200000 ? text.slice(0, 200000) + '\n…' : text;
    TL.modal('Exporter « ' + name + ' »', h('div.form',
      h('p.small.muted', TL.fmtNum(text.length / 1024, 1) + ' Ko. Si le téléchargement ne démarre pas, copie le contenu et enregistre-le dans un fichier portant ce nom.'), ta), [
      { label: 'Copier', onClick: async () => { try { await navigator.clipboard.writeText(text); TL.toast('Copié.', 'ok'); } catch (e) { ta.select(); TL.toast('Sélectionné : copie avec Ctrl+C.'); } return false; } },
      { label: 'Télécharger', primary: true, onClick: () => { TL.download(name, text, type); return false; } },
    ]);
  };
  const slug = (s) => TL.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'atelier';

  /* ---------- Liste « Créer » ---------- */
  E.list = async function (root) {
    const app = TL.app;
    const page = h('div.page');
    const mine = [...app.workshops.values()].filter((w) => w.source !== 'demo').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const demos = [...app.workshops.values()].filter((w) => w.source === 'demo');
    page.append(h('header.pagehead', h('div', h('p.eyebrow', 'Espace enseignant'), h('h1', 'Créer et convertir')),
      h('div.pagehead-acts',
        h('button.btn.ghost', { type: 'button', onclick: () => E.importDialog(null) }, 'Convertir une fiche papier'),
        h('button.btn.primary', { type: 'button', onclick: async () => { const w = await app.saveWorkshop({ title: 'Nouvel atelier', level: (app.profile && app.profile.level) || 'college', steps: [{ title: 'Découvrir', blocks: [{ type: 'text', md: '' }] }] }, 'local'); app.go('ed-' + w.id); } }, 'Nouvel atelier'))));
    page.append(h('div.howto',
      h('div', h('span.howto-n.mono', '1'), h('strong', 'Numérise'), h('p', 'Importe le PDF de ta fiche ou des photos des pages. Le texte des PDF est récupéré automatiquement.')),
      h('div', h('span.howto-n.mono', '2'), h('strong', 'Convertis'), h('p', 'Colle ou corrige le texte : les questions au format GIFT de Moodle deviennent des exercices interactifs.')),
      h('div', h('span.howto-n.mono', '3'), h('strong', 'Enrichis'), h('p', 'Ajoute simulateur de circuits, programmation, chaînes info/énergie, schémas à légender.')),
      h('div', h('span.howto-n.mono', '4'), h('strong', 'Publie'), h('p', 'Ajoute le fichier au dossier ateliers/ de TechnoStudio : l’atelier est disponible pour tous, même sans serveur.'))));
    page.append(h('h2.sec', 'Mes ateliers'));
    if (!mine.length) page.append(h('p.muted', 'Aucun atelier personnel pour l’instant. Crée-en un, convertis une fiche ou duplique une démo ci-dessous.'));
    else page.append(h('div.rows', mine.map((w) => row(w))));
    page.append(h('h2.sec', 'Démonstrations à dupliquer'), h('div.rows', demos.map((w) => row(w))));
    root.append(page);

    function row(w) {
      const isDemo = w.source === 'demo';
      return h('div.wrow',
        h('div.wrow-main', h('span.chip.lv-' + w.level, (TL.LEVELS[w.level] || {}).short || w.level), h('a.wrow-title', { href: '#at-' + w.id }, w.title),
          h('span.small.muted.mono', w.steps.length + ' ét. · ' + (w.source === 'centrale' ? 'reçu de la Centrale' : isDemo ? 'démo' : 'modifié ' + TL.fmtDate(w.updatedAt)))),
        h('div.wrow-acts',
          h('a.btn.small', { href: '#ed-' + w.id }, isDemo ? 'Dupliquer' : 'Modifier'),
          h('button.btn.small.ghost', { type: 'button', onclick: () => TL.saveAs(slug(w.title) + '.technostudio.json', JSON.stringify(exportable(w), null, 1)) }, 'Exporter'),
          h('button.btn.small.ghost', { type: 'button', onclick: () => E.publish(w) }, 'Publier'),
          !isDemo ? h('button.btn.small.ghost.danger', { type: 'button', onclick: async () => { if (await TL.confirm('Supprimer l’atelier', '« ' + w.title + ' » sera supprimé de cet appareil. Le travail des élèves enregistré sur la Centrale n’est pas touché.', 'Supprimer')) { await TL.app.deleteWorkshop(w.id); TL.app.route(); } } }, 'Supprimer') : null));
    }
  };
  const exportable = (w) => { const c = TL.clone(w); delete c.source; return c; };

  /** Publication : le fichier de l'atelier rejoint le dossier ateliers/ de l'appli (disponible sans serveur, importé
      par la Centrale) ; en attendant, il peut encore être déposé dans « Ressources des ateliers » de la Centrale. */
  E.publish = function (w) {
    const v = TL.descriptor.validate('Workshop', exportable(w));
    const Z = TL.centrale;
    const nom = String(w.id).replace(/[^A-Za-z0-9_-]/g, '-') + '.technostudio.json';
    const sansPublie = (x) => { const c = exportable(x); delete c.publie; return c; };
    TL.modal('Publier l’atelier', h('div.form',
      v.ok ? null : h('p.callout.warn', 'L’atelier n’est pas conforme au descripteur : ' + v.errors[0]),
      h('h3', 'Avec l’application (conseillé : disponible pour tous, sans serveur)'),
      h('ol.steps',
        h('li', h('button.btn.small.primary', { type: 'button', disabled: !v.ok, onclick: () => TL.saveAs(nom, JSON.stringify(sansPublie(w), null, 1)) }, 'Télécharger ' + nom)),
        h('li', 'Sur GitHub, dans le dossier ', h('a', { href: 'https://github.com/grandiosian/TechnoStudio/tree/main/ateliers', target: '_blank', rel: 'noopener' }, 'ateliers/'), ' de TechnoStudio : Add file → Upload files, puis Commit changes.'),
        h('li', 'Quelques minutes plus tard, l’atelier est dans la bibliothèque de TechnoStudio, pour tous les élèves.'),
        h('li', 'Dans la Centrale : Ateliers → « Ateliers des applications » → TechnoStudio → Mettre à jour.')),
      h('h3', 'Par la Centrale (en attendant)'),
      h('ol.steps',
        h('li', 'Ouvre l’espace enseignant de la Centrale : ', h('a', { href: Z.serveur + 'admin/#ressources', target: '_blank', rel: 'noopener' }, Z.serveur.replace(/^https?:\/\//, '') + 'admin/')),
        h('li', 'Dans ', h('b', 'Ressources des ateliers'), ', dépose le fichier pour l’atelier ', h('code', Z.app), '.'),
        h('li', 'Les élèves le reçoivent à leur prochaine connexion (ou avec Centrale → Recevoir les ateliers). Redéposer le fichier avec le même nom le met à jour.')),
      h('p.small.muted', 'Les élèves ne le reçoivent qu’une fois connectés à la Centrale. Un atelier Centrale par niveau : crée par exemple « technostudio-5e » avec l’adresse ', h('code', location.origin + location.pathname + '?app=technostudio-5e'), ' et réserve-le aux classes de 5e.')),
    [{ label: 'Fermer', primary: true }]);
  };

  /* ---------- Modèles de blocs ---------- */
  const TEMPLATES = {
    text: () => ({ type: 'text', md: '' }),
    image: () => ({ type: 'image', src: '', caption: '' }),
    scan: () => ({ type: 'scan', title: 'Fiche papier d’origine', pages: [] }),
    svg: () => ({ type: 'svg', svg: '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="180" height="80" fill="none" stroke="currentColor"/></svg>', caption: '' }),
    link: () => ({ type: 'link', url: 'https://', title: '', kind: 'link' }),
    qcm: () => ({ type: 'qcm', question: '', options: [{ text: '', correct: true }, { text: '', correct: false }, { text: '', correct: false }] }),
    cloze: () => ({ type: 'cloze', text: 'La pile est un [[générateur]]. Le moteur [[!convertit|transmet|distribue]] l’énergie électrique.' }),
    numeric: () => ({ type: 'numeric', question: '', answer: 0, tolerance: 0, unit: '' }),
    match: () => ({ type: 'match', question: 'Associe chaque élément.', pairs: [['', ''], ['', '']] }),
    order: () => ({ type: 'order', question: 'Remets dans l’ordre.', items: ['Première étape', 'Deuxième étape', 'Troisième étape'] }),
    sort: () => ({ type: 'sort', question: 'Classe chaque étiquette.', categories: [{ name: 'Catégorie A', items: [] }, { name: 'Catégorie B', items: [] }] }),
    chain: () => ({ type: 'chain', question: 'Place chaque composant dans sa fonction.', items: [{ text: 'Capteur', slot: 'acquerir' }, { text: 'Carte programmable', slot: 'traiter' }, { text: 'Moteur', slot: 'convertir' }] }),
    label: () => ({ type: 'label', question: 'Légende le schéma.', src: '', points: [] }),
    procedure: () => ({ type: 'procedure', question: 'Réalise la manipulation.', items: [{ text: 'Première action' }, { text: 'Deuxième action' }] }),
    report: () => ({ type: 'report', question: 'Rédige ton compte rendu.', photo: true }),
    circuit: () => ({ type: 'circuit', question: 'Réalise le montage demandé.', cols: 6, rows: 4, palette: { wire: -1, lamp: 1, switch: 1 }, initial: { 'v-1-0': { type: 'battery', v: 4.5, label: 'G1', locked: true } }, goals: [{ type: 'switchControls' }, { type: 'noShort' }] }),
    blocks: () => ({ type: 'blocks', question: 'Écris le programme.', scene: 'eclairage', start: [], tests: [] }),
  };
  E.TEMPLATES = TEMPLATES;

  /* ---------- Formulaires par type ---------- */
  const Q = { k: 'question', kind: 'markdown', label: 'Consigne / question', rows: 2 };
  const HINT = { k: 'hint', kind: 'text', label: 'Indice (après un essai raté)' };
  const EXPL = { k: 'explanation', kind: 'markdown', label: 'Explication (affichée après réponse)', rows: 2 };
  const SCHEMA = {
    text: [{ k: 'md', kind: 'markdown', label: 'Texte', rows: 6, help: '**gras**, *italique*, listes « - », tableaux « | a | b | », encadrés « > ? astuce » ou « > ! attention », images ![légende](adresse).' }],
    image: [{ k: 'src', kind: 'image', label: 'Image' }, { k: 'caption', kind: 'text', label: 'Légende' }, { k: 'alt', kind: 'text', label: 'Description pour l’accessibilité' }],
    svg: [{ k: 'svg', kind: 'code', label: 'Code SVG' }, { k: 'caption', kind: 'text', label: 'Légende' }],
    scan: [{ k: 'title', kind: 'text', label: 'Titre' }, { k: 'pages', kind: 'pages', label: 'Pages' }, { k: 'open', kind: 'check', label: 'Afficher dépliée par défaut' }],
    link: [{ k: 'url', kind: 'text', label: 'Adresse (https://…)' }, { k: 'title', kind: 'text', label: 'Titre' }, { k: 'text', kind: 'text', label: 'Description' }, { k: 'kind', kind: 'select', label: 'Type', opts: [['link', 'Lien'], ['video', 'Vidéo']] }],
    qcm: [Q, { k: 'options', kind: 'options', label: 'Réponses (coche la ou les bonnes)' }, { k: 'shuffle', kind: 'checkInv', label: 'Garder l’ordre des réponses' }, HINT, EXPL],
    cloze: [{ k: 'text', kind: 'textarea', label: 'Texte à trous', rows: 4, help: '[[réponse]] · [[variante1|variante2]] (plusieurs réponses acceptées) · [[!bonne|leurre|leurre]] (liste déroulante).' }, HINT, EXPL],
    numeric: [Q, { k: 'answer', kind: 'number', label: 'Réponse attendue' }, { k: 'tolerance', kind: 'number', label: 'Tolérance (±)' }, { k: 'unit', kind: 'text', label: 'Unité' }, { k: 'formula', kind: 'text', label: 'Formule affichée (facultatif)' }, HINT, EXPL],
    match: [Q, { k: 'pairs', kind: 'pairs', label: 'Paires (gauche → droite)' }, { k: 'distractors', kind: 'csv', label: 'Leurres à droite (séparés par des virgules)' }, HINT, EXPL],
    order: [Q, { k: 'items', kind: 'lines', label: 'Éléments dans le bon ordre (un par ligne)', rows: 5 }, HINT, EXPL],
    sort: [Q, { k: 'categories', kind: 'categories', label: 'Catégories et étiquettes' }, HINT, EXPL],
    chain: [Q, { k: 'items', kind: 'chainItems', label: 'Composants et leur fonction' }, { k: 'infoIn', kind: 'text', label: 'Entrée de la chaîne d’information' }, { k: 'infoOut', kind: 'text', label: 'Sortie (messages)' }, { k: 'energyIn', kind: 'text', label: 'Énergie d’entrée' }, { k: 'action', kind: 'text', label: 'Action réalisée' }, HINT, EXPL],
    label: [Q, { k: '_pic', kind: 'labelPic', label: 'Schéma et repères' }, { k: 'distractors', kind: 'csv', label: 'Étiquettes leurres (virgules)' }, HINT, EXPL],
    procedure: [Q, { k: 'items', kind: 'procItems', label: 'Étapes de la manipulation (une par ligne)', rows: 5, help: 'Commence une ligne par « ! » pour un avertissement de sécurité affiché sous l’étape précédente.' }],
    report: [Q, { k: 'placeholder', kind: 'text', label: 'Aide dans la zone de réponse' }, { k: 'photo', kind: 'checkInv', label: 'Sans ajout de photo' }],
    circuit: [Q, { k: 'demo', kind: 'check', label: 'Démonstration : montage fixe, non noté (l’élève agit sur les interrupteurs et mesure)' }, { k: '_grid', kind: 'grid' }, { k: 'palette', kind: 'palette', label: 'Composants à disposition de l’élève' }, { k: 'goals', kind: 'goals', label: 'Objectifs vérifiés' }, { k: '_initial', kind: 'circuitInit', label: 'Montage de départ' }, HINT],
    blocks: [Q, { k: 'scene', kind: 'select', label: 'Maquette', opts: () => Object.entries(TL.SCENES).map(([k, v]) => [k, v.name]) }, { k: 'demo', kind: 'check', label: 'Démonstration : programme fixe, non noté' }, { k: 'toolbox', kind: 'toolbox', label: 'Blocs disponibles' }, { k: 'vars', kind: 'csv', label: 'Variables prédéfinies (virgules)' }, { k: '_start', kind: 'program', label: 'Programme de départ' }, { k: 'tests', kind: 'tests', label: 'Tests automatiques' }, HINT],
  };

  E.SCHEMA = SCHEMA;
  E.buildForm = function (b, changed) { return buildForm(b, changed); };
  E.fieldFor = function (b, sp, changed, rb) { return fieldFor(b, sp, changed, rb || []); };
  function buildForm(b, changed) {
    const specs = SCHEMA[b.type] || [];
    const rb = [];
    return specs.map((sp) => fieldFor(b, sp, changed, rb)).filter(Boolean);
  }

  function fieldFor(b, sp, changed, rebuilders) {
    const id = TL.uid('f');
    const wrap = (ctl, cls) => h('div.ff' + (cls ? '.' + cls : ''), sp.label ? h('label.ff-label', { for: id }, sp.label) : null, ctl, sp.help ? h('p.ff-help', sp.help) : null);
    const set = (v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length && sp.k !== 'pages')) delete b[sp.k]; else b[sp.k] = v; changed(); };
    switch (sp.kind) {
      case 'text': { const x = h('input.field', { id, type: 'text', value: b[sp.k] || '' }); x.oninput = () => set(x.value); return wrap(x); }
      case 'number': { const x = h('input.field', { id, type: 'text', inputmode: 'decimal', value: b[sp.k] != null ? String(b[sp.k]).replace('.', ',') : '' }); x.oninput = () => { const v = parseFloat(x.value.replace(',', '.')); set(isFinite(v) ? v : undefined); }; return wrap(x, 'short'); }
      case 'textarea': case 'markdown': case 'code': { const x = h('textarea.field' + (sp.kind === 'code' ? '.code' : ''), { id, rows: sp.rows || (sp.kind === 'code' ? 8 : 3), spellcheck: sp.kind !== 'code' }); x.value = b[sp.k] || ''; x.oninput = () => set(x.value); return wrap(x); }
      case 'check': { const x = h('input', { id, type: 'checkbox', checked: !!b[sp.k] }); x.onchange = () => { set(x.checked || undefined); }; return h('div.ff.check', h('label', { for: id }, x, ' ', sp.label)); }
      case 'checkInv': { const x = h('input', { id, type: 'checkbox', checked: b[sp.k] === false }); x.onchange = () => { if (x.checked) b[sp.k] = false; else delete b[sp.k]; changed(); }; return h('div.ff.check', h('label', { for: id }, x, ' ', sp.label)); }
      case 'select': { const opts = typeof sp.opts === 'function' ? sp.opts() : sp.opts; const x = h('select.field', { id }, opts.map(([v, t]) => h('option', { value: v }, t))); x.value = b[sp.k] || opts[0][0]; x.onchange = () => { set(x.value); if (sp.k === 'scene') { b.start = []; b.tests = []; TL.toast('Maquette changée : programme et tests réinitialisés.'); rebuild(); } }; return wrap(x, 'short'); }
      case 'lines': { const x = h('textarea.field', { id, rows: sp.rows || 4 }); x.value = (b[sp.k] || []).join('\n'); x.oninput = () => set(x.value.split('\n').map((s) => s.trim()).filter(Boolean)); return wrap(x); }
      case 'procItems': {
        const x = h('textarea.field', { id, rows: sp.rows || 5 });
        x.value = (b.items || []).map((it) => it.text + (it.warn ? '\n! ' + it.warn : '')).join('\n');
        x.oninput = () => { const items = []; x.value.split('\n').forEach((l) => { l = l.trim(); if (!l) return; if (l.startsWith('!') && items.length) items[items.length - 1].warn = l.slice(1).trim(); else items.push({ text: l }); }); b.items = items; changed(); };
        return wrap(x);
      }
      case 'csv': { const x = h('input.field', { id, type: 'text', value: (b[sp.k] || []).join(', ') }); x.oninput = () => set(x.value.split(',').map((s) => s.trim()).filter(Boolean)); return wrap(x); }
      case 'image': return wrap(imageField(b, sp.k, changed));
      case 'pages': return wrap(pagesField(b, changed));
      case 'options': return wrap(listField(b, 'options', () => ({ text: '', correct: false }), (o, upd) => [
        h('input', { type: 'checkbox', checked: !!o.correct, 'aria-label': 'Bonne réponse', onchange: (e) => { o.correct = e.target.checked; upd(); } }),
        h('input.field', { type: 'text', value: o.text, placeholder: 'Réponse', 'aria-label': 'Texte de la réponse', oninput: (e) => { o.text = e.target.value; upd(); } }),
        h('input.field.fb-in', { type: 'text', value: o.feedback || '', placeholder: 'Retour si choisie (facultatif)', 'aria-label': 'Retour', oninput: (e) => { o.feedback = e.target.value || undefined; upd(); } })], changed, '+ Réponse'));
      case 'pairs': return wrap(listField(b, 'pairs', () => ['', ''], (p, upd) => [
        h('input.field', { type: 'text', value: p[0], placeholder: 'Élément', 'aria-label': 'Gauche', oninput: (e) => { p[0] = e.target.value; upd(); } }), h('span.muted', '→'),
        h('input.field', { type: 'text', value: p[1], placeholder: 'Correspondance', 'aria-label': 'Droite', oninput: (e) => { p[1] = e.target.value; upd(); } })], changed, '+ Paire'));
      case 'categories': return wrap(listField(b, 'categories', () => ({ name: '', items: [] }), (c, upd) => [
        h('input.field.cat-name', { type: 'text', value: c.name, placeholder: 'Catégorie', 'aria-label': 'Nom de la catégorie', oninput: (e) => { c.name = e.target.value; upd(); } }),
        h('input.field', { type: 'text', value: c.items.join(', '), placeholder: 'étiquette, étiquette, …', 'aria-label': 'Étiquettes', oninput: (e) => { c.items = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); upd(); } })], changed, '+ Catégorie'));
      case 'chainItems': {
        const slots = TL.CHAIN.info.concat(TL.CHAIN.energie);
        return wrap(listField(b, 'items', () => ({ text: '', slot: 'acquerir' }), (it, upd) => [
          h('input.field', { type: 'text', value: it.text, placeholder: 'Composant', 'aria-label': 'Composant', oninput: (e) => { it.text = e.target.value; upd(); } }),
          (() => { const s = h('select.field', { 'aria-label': 'Fonction' }, slots.map(([v, t]) => h('option', { value: v }, t))); s.value = it.slot; s.onchange = () => { it.slot = s.value; upd(); }; return s; })()], changed, '+ Composant'));
      }
      case 'labelPic': return labelPicField(b, changed);
      case 'grid': {
        const mk = (k, label, min, max) => { const x = h('input.field', { type: 'number', min, max, value: b[k] || (k === 'cols' ? 7 : 5), 'aria-label': label }); x.onchange = () => { b[k] = TL.clamp(+x.value || min, min, max); changed(); rebuild(); }; return h('label.small', label + ' ', x); };
        return h('div.ff.inline', h('span.ff-label', 'Taille de la grille'), mk('cols', 'Colonnes', 3, 10), mk('rows', 'Lignes', 2, 8));
      }
      case 'palette': {
        const pal = (b.palette = b.palette || {});
        const grid = h('div.palgrid', Object.entries(TL.CIRCUIT_COMP).map(([t, c]) => {
          const x = h('input.field', { type: 'text', inputmode: 'numeric', value: pal[t] == null ? '' : pal[t] < 0 ? '∞' : String(pal[t]), placeholder: '—', 'aria-label': c.name });
          x.oninput = () => { const v = x.value.trim(); if (!v) delete pal[t]; else if (/^(∞|-1|i)/i.test(v)) pal[t] = -1; else if (isFinite(+v)) pal[t] = +v; changed(); };
          return h('label.palitem', h('span', c.name), x);
        }));
        return h('div.ff', h('span.ff-label', sp.label), grid, h('p.ff-help', 'Nombre disponible pour l’élève. Vide : non proposé. ∞ : illimité.'));
      }
      case 'goals': return wrap(goalsField(b, changed));
      case 'circuitInit': {
        const holder = h('div.circ-ed');
        const make = () => {
          holder.innerHTML = '';
          const sim = new TL.Circuit(Object.assign({}, b, { palette: null, demo: false }), { editor: true, value: null, onChange: (v) => { b.initial = v.comps; changed(); } });
          holder.append(sim.el, h('div.actions', h('button.btn.small.ghost', { type: 'button', onclick: async () => {
            if (!b.goals || !b.goals.length) { TL.toast('Aucun objectif défini.'); return; }
            const r = sim.evaluate(b.goals);
            TL.toast(r.filter((x) => x.ok).length + '/' + r.length + ' objectif(s) atteint(s) par ce montage.', r.every((x) => x.ok) ? 'ok' : '');
          } }, 'Tester les objectifs sur ce montage')));
        };
        make();
        rebuilders.push(make);
        return wrap(holder);
      }
      case 'toolbox': {
        const all = Object.keys(TL.BLOCKS);
        const sel = new Set(b.toolbox && b.toolbox.length ? b.toolbox : all);
        return wrap(h('div.checks', all.map((op) => h('label.small', h('input', { type: 'checkbox', checked: sel.has(op), onchange: (e) => { e.target.checked ? sel.add(op) : sel.delete(op); b.toolbox = sel.size === all.length ? undefined : all.filter((x) => sel.has(x)); if (!b.toolbox) delete b.toolbox; changed(); } }), ' ' + TL.BLOCKS[op].label))));
      }
      case 'program': {
        const holder = h('div.prog-ed');
        const make = () => {
          holder.innerHTML = '';
          const ed = new TL.BlockEditor(Object.assign({}, b, { toolbox: null, demo: false, start: b.start || [] }), { editor: true, onChange: (v) => { b.start = v.program; changed(); } });
          E.current.programEditor = ed;
          holder.append(h('div.blk-grid', ed.el, TL.scenePanel(ed, b)));
        };
        make();
        rebuilders.push(make);
        return wrap(holder);
      }
      case 'tests': return wrap(testsField(b, changed));
      default: return E.extraField ? E.extraField(b, sp, changed, wrap, id) : null;
    }
    function rebuild() { rebuilders.forEach((f) => f()); }
  }

  function listField(b, key, blank, cells, changed, addLabel) {
    const box = h('div.listf');
    const draw = () => {
      box.innerHTML = '';
      (b[key] = b[key] || []).forEach((item, i) => box.append(h('div.listf-row', cells(item, changed),
        h('button.icon-btn', { type: 'button', title: 'Retirer', onclick: () => { b[key].splice(i, 1); draw(); changed(); } }, '✕'))));
      box.append(h('button.btn.small.ghost', { type: 'button', onclick: () => { b[key].push(blank()); draw(); changed(); box.querySelectorAll('input.field')[box.querySelectorAll('.listf-row').length * 1 - 1]?.focus(); } }, addLabel));
    };
    draw();
    return box;
  }

  function imageField(b, key, changed) {
    const img = h('img.thumb', { alt: '', hidden: !b[key] });
    if (b[key]) img.src = b[key];
    const url = h('input.field', { type: 'text', placeholder: 'Adresse d’une image (https://…) ou importe un fichier', value: /^data:/.test(b[key] || '') ? '' : (b[key] || ''), 'aria-label': 'Adresse de l’image' });
    url.oninput = () => { b[key] = url.value.trim(); img.src = b[key]; img.hidden = !b[key]; changed(); };
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.onchange = async () => { if (!file.files[0]) return; b[key] = await TL.fileToDataUrl(file.files[0], 1600, 0.85); img.src = b[key]; img.hidden = false; url.value = ''; changed(); };
    return h('div.imgf', img, h('div.imgf-ctl', url, h('button.btn.small.ghost', { type: 'button', onclick: () => file.click() }, 'Importer un fichier'), file));
  }

  function pagesField(b, changed) {
    const box = h('div.pagesf');
    const file = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, hidden: true });
    const draw = () => {
      box.innerHTML = '';
      (b.pages = b.pages || []).forEach((p, i) => box.append(h('div.gal-item', h('img', { src: p, alt: 'Page ' + (i + 1) }), h('button.icon-btn', { type: 'button', 'aria-label': 'Retirer', onclick: () => { b.pages.splice(i, 1); draw(); changed(); } }, '✕'))));
      box.append(h('button.btn.small.ghost', { type: 'button', onclick: () => file.click() }, 'Ajouter des pages (photos ou PDF)'), file);
    };
    file.onchange = async () => {
      const r = await filesToPages([...file.files], () => {});
      b.pages.push(...r.pages); file.value = ''; draw(); changed();
    };
    draw();
    return box;
  }

  function labelPicField(b, changed) {
    b.points = b.points || [];
    const id = TL.uid('lp');
    const stage = h('div.lbl-pic.lbl-edit', { title: 'Clique sur le schéma pour ajouter un repère' });
    const list = h('div.listf');
    const drawPic = () => {
      stage.innerHTML = '';
      stage.append(b.svg ? h('div.lbl-svg', { html: b.svg }) : b.src ? h('img', { src: b.src, alt: '' }) : h('div.lbl-empty.muted', 'Importe une image du schéma (photo de la fiche, capture…).'));
      b.points.forEach((p, i) => stage.append(h('span.lbl-mark.mono', { style: { left: p.x + '%', top: p.y + '%' } }, String(i + 1))));
    };
    const drawList = () => {
      list.innerHTML = '';
      b.points.forEach((p, i) => list.append(h('div.listf-row', h('span.lbl-n.mono', String(i + 1)),
        h('input.field', { type: 'text', value: p.answer, placeholder: 'Légende attendue', 'aria-label': 'Légende ' + (i + 1), oninput: (e) => { p.answer = e.target.value; changed(); } }),
        h('span.small.muted.mono', Math.round(p.x) + ' · ' + Math.round(p.y)),
        h('button.icon-btn', { type: 'button', title: 'Retirer', onclick: () => { b.points.splice(i, 1); drawPic(); drawList(); changed(); } }, '✕'))));
      if (!b.points.length) list.append(h('p.small.muted', 'Clique sur le schéma pour placer les repères à légender.'));
    };
    stage.addEventListener('click', (e) => {
      if (!b.svg && !b.src) return;
      const r = stage.getBoundingClientRect();
      b.points.push({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10, answer: '' });
      drawPic(); drawList(); changed();
      setTimeout(() => { const ins = list.querySelectorAll('input'); ins[ins.length - 1]?.focus(); }, 0);
    });
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.onchange = async () => { if (!file.files[0]) return; b.src = await TL.fileToDataUrl(file.files[0], 1400, 0.85); delete b.svg; drawPic(); changed(); };
    drawPic(); drawList();
    return h('div.ff', h('span.ff-label', { id }, 'Schéma et repères'), h('div.actions', h('button.btn.small.ghost', { type: 'button', onclick: () => file.click() }, b.src || b.svg ? 'Changer d’image' : 'Importer le schéma'), file), h('div.lbl', stage, list));
  }

  function goalsField(b, changed) {
    b.goals = b.goals || [];
    const box = h('div.checks.goals-ed');
    const types = [['switchControls'], ['noShort'], ['lit'], ['parallel'], ['series'], ['eachSwitch'], ['ledSafe'], ['motorDir'], ['darkOn'], ['count']];
    const draw = () => {
      box.innerHTML = '';
      types.forEach(([t]) => {
        const g = b.goals.find((x) => x.type === t);
        const txt = TL.CIRCUIT_GOALS[t](g || { min: 0, n: 1, comp: 'lamp', dir: 1 });
        const params = [];
        if (g && t === 'lit') params.push(h('label.small', ' minimum ', h('input.field.tiny', { type: 'number', min: 0, value: g.min || '', placeholder: 'tous', onchange: (e) => { if (+e.target.value) g.min = +e.target.value; else delete g.min; changed(); draw(); } })));
        if (g && t === 'motorDir') { const s = h('select.field.tiny', h('option', { value: 1 }, 'horaire'), h('option', { value: -1 }, 'anti-horaire')); s.value = String(g.dir || 1); s.onchange = () => { g.dir = +s.value; changed(); draw(); }; params.push(s); }
        if (g && t === 'count') {
          const s = h('select.field.tiny', Object.entries(TL.CIRCUIT_COMP).filter(([k]) => k !== 'wire').map(([k, c]) => h('option', { value: k }, c.name))); s.value = g.comp; s.onchange = () => { g.comp = s.value; changed(); draw(); };
          params.push(h('input.field.tiny', { type: 'number', min: 0, value: g.n, onchange: (e) => { g.n = +e.target.value; changed(); draw(); } }), s);
        }
        box.append(h('div.goal-ed', h('label.small', h('input', { type: 'checkbox', checked: !!g, onchange: (e) => {
          if (e.target.checked) b.goals.push(t === 'count' ? { type: t, comp: 'lamp', n: 1 } : t === 'motorDir' ? { type: t, dir: 1 } : { type: t });
          else b.goals = b.goals.filter((x) => x.type !== t);
          changed(); draw();
        } }), ' ' + txt), ...params));
      });
    };
    draw();
    return box;
  }

  function testsField(b, changed) {
    const ta = h('textarea.field.code', { rows: 8, spellcheck: false, 'aria-label': 'Tests (JSON)' });
    ta.value = JSON.stringify(b.tests || [], null, 1);
    const err = h('p.form-err');
    const out = h('ul.goals');
    ta.oninput = () => { try { const v = JSON.parse(ta.value || '[]'); if (!Array.isArray(v)) throw new Error('il faut une liste [ … ]'); b.tests = v; err.textContent = ''; changed(); } catch (e) { err.textContent = 'JSON invalide : ' + e.message; } };
    const scene = () => TL.SCENES[b.scene] || TL.SCENES.eclairage;
    const example = () => {
      const s = scene(); const a = s.actuators[0]; const sn = s.sensors.find((x) => x.control !== 'read') || s.sensors[0];
      return [{ name: 'Quand ' + sn.name.toLowerCase() + ' est actif, ' + a.name.toLowerCase() + ' fonctionne', steps: [{ set: { [sn.id]: sn.kind === 'num' ? sn.max || 1 : 1 }, run: 1, expect: { [a.id]: a.values ? a.values[a.values.length - 1][0] : 1 } }] }];
    };
    return h('div',
      h('p.ff-help', 'Chaque test enchaîne des étapes : « set » fixe des capteurs, « run » fait tourner le programme (en secondes), « expect » vérifie actionneurs, capteurs ou variables (valeur exacte ou { "min": …, "max": … }).'),
      ta, err,
      h('div.actions',
        h('button.btn.small.ghost', { type: 'button', onclick: () => { b.tests = (b.tests || []).concat(example()); ta.value = JSON.stringify(b.tests, null, 1); changed(); } }, 'Ajouter un exemple'),
        h('button.btn.small.ghost', { type: 'button', onclick: () => {
          const prog = (E.current && E.current.programEditor && E.current.programEditor.program) || b.start || [];
          const res = TL.runBlockTests(scene(), prog, b.tests || []);
          out.innerHTML = '';
          res.forEach((r) => out.append(h('li' + (r.ok ? '.is-ok' : '.is-bad'), h('span.goal-mark', r.ok ? '✓' : '✗'), h('span', r.name, r.why ? h('small.why', r.why) : null))));
        } }, 'Lancer les tests sur le programme ci-dessus')),
      out);
  }

  /* ---------- Import : PDF, images, texte, GIFT ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  async function pdfjs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
    for (const base of ['vendor/', CDN]) {
      try {
        await loadScript(base + 'pdf.worker.min.js');
        await loadScript(base + 'pdf.min.js');
        if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js'; return window.pdfjsLib; }
      } catch (e) { /* essai suivant */ }
    }
    throw new Error('Impossible de charger le lecteur PDF. Hors ligne, importe plutôt des photos des pages.');
  }
  async function filesToPages(files, onProgress) {
    const pages = []; let text = '';
    for (const f of files) {
      if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
        const lib = await pdfjs();
        const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
          onProgress('Page ' + i + ' / ' + doc.numPages);
          const p = await doc.getPage(i);
          const vp0 = p.getViewport({ scale: 1 });
          const vp = p.getViewport({ scale: Math.min(2, 1200 / vp0.width) });
          const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          await p.render({ canvasContext: g, viewport: vp }).promise;
          pages.push(c.toDataURL('image/jpeg', 0.78));
          const tc = await p.getTextContent();
          let lastY = null, line = '';
          tc.items.forEach((it) => {
            const y = Math.round(it.transform[5]);
            if (lastY !== null && Math.abs(y - lastY) > 3) { text += line.trim() + '\n'; line = ''; }
            line += it.str + (it.hasEOL ? '\n' : ''); lastY = y;
          });
          text += line.trim() + '\n\n';
        }
      } else if (/^image\//.test(f.type)) {
        onProgress(f.name);
        pages.push(await TL.fileToDataUrl(f, 1400, 0.8));
      }
    }
    return { pages, text: text.replace(/\n{3,}/g, '\n\n').trim() };
  }
  E.filesToPages = filesToPages;

  const CHEAT = `# Titre de l'atelier
## Nom de l'étape
Un paragraphe de cours, avec **gras**.

[ ] Action de la procédure
[ ] Autre action

::Q1:: Quel composant convertit l'énergie ? {=Le moteur ~La pile ~L'interrupteur}
::Q2:: La pile est un générateur. {T}
Une DEL se protège avec une {=résistance ~bobine ~pile} en série.
::Calcul:: I = 12 V ÷ 4 Ω, en A ? {#3:0.05}
::Assoc:: Associe {
=Moteur -> Convertir
=Carte -> Traiter
}
::Rédaction:: Explique le rôle du capteur. {}

!ordre: Remets dans l'ordre
- Appuyer
- Ouvrir
!classer: Classe
Capteurs = bouton, LDR
Actionneurs = moteur, lampe`;

  E.importDialog = function (target, after) {
    const app = TL.app;
    let pages = [];
    const tabs = h('div.tabs', { role: 'tablist' });
    const panes = h('div');
    const status = h('p.small.muted', { 'aria-live': 'polite' });
    const thumbs = h('div.gal');
    const file = h('input', { type: 'file', accept: 'application/pdf,image/*', multiple: true, hidden: true });
    const drop = h('div.dropbig', { tabindex: 0, role: 'button' }, h('strong', 'Dépose ici le PDF ou les photos de ta fiche'), h('span.small.muted', 'ou clique pour choisir des fichiers'));
    const keepScan = h('input', { type: 'checkbox', checked: true, id: 'imp-keep' });
    const ta = h('textarea.field.code', { rows: 14, spellcheck: false, placeholder: CHEAT, 'aria-label': 'Texte à convertir' });
    const preview = h('div.parseprev');
    const meta = { level: (target && target.level) || 'college' };

    const handle = async (files) => {
      if (!files.length) return;
      status.textContent = 'Lecture…';
      try {
        const r = await filesToPages(files, (m) => (status.textContent = 'Lecture : ' + m));
        pages = pages.concat(r.pages);
        thumbs.innerHTML = '';
        pages.forEach((p, i) => thumbs.append(h('div.gal-item', h('img', { src: p, alt: 'Page ' + (i + 1) }))));
        status.textContent = pages.length + ' page(s) prête(s).' + (r.text ? ' Texte extrait : il est placé dans l’onglet « Texte / GIFT » pour être converti.' : ' Aucun texte détecté (photo ou scan) : recopie ou dicte les questions dans l’onglet « Texte / GIFT ».');
        if (r.text) { ta.value = (ta.value ? ta.value + '\n\n' : '') + r.text; parse(); }
      } catch (e) { status.textContent = e.message; }
    };
    file.onchange = () => { handle([...file.files]); file.value = ''; };
    drop.onclick = () => file.click();
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); handle([...e.dataTransfer.files]); };

    let parsed = null;
    const parse = TL.debounce(() => {
      parsed = TL.gift.parse(ta.value, {});
      preview.innerHTML = '';
      if (!ta.value.trim()) { preview.append(h('p.small.muted', 'L’aperçu de la conversion apparaît ici.')); return; }
      preview.append(h('div.label-up', 'Résultat : ' + parsed.steps.length + ' étape(s)'));
      parsed.steps.forEach((s) => preview.append(h('div.pp-step', h('strong', s.title), h('ul', s.blocks.map((b) => h('li', h('span.pp-ico', TL.activities[b.type].icon), ' ', TL.activities[b.type].label, h('span.muted', ' · ' + String(b.question || b.text || b.md || (b.items || []).map((x) => x.text || x).join(', ')).slice(0, 60))))))));
    }, 250);
    ta.oninput = parse;
    parse();

    const paneScan = h('div.tabpane', drop, file, status, thumbs, h('label.small', keepScan, ' Joindre les pages à l’atelier comme « fiche papier d’origine »'));
    const paneText = h('div.tabpane', { hidden: true },
      h('div.cols2', h('div', ta, h('details.small', h('summary', 'Syntaxe acceptée (GIFT Moodle + extensions TechnoStudio)'), h('pre.code.mono', CHEAT))), preview));
    const tabBtn = (label, pane) => {
      const b = h('button.tab', { type: 'button', role: 'tab', onclick: () => { TL.$$('.tab', tabs).forEach((x) => x.classList.toggle('on', x === b)); [paneScan, paneText].forEach((p) => (p.hidden = p !== pane)); } }, label);
      return b;
    };
    const t1 = tabBtn('1 · Fiche scannée ou PDF', paneScan), t2 = tabBtn('2 · Texte / GIFT', paneText);
    t1.classList.add('on');
    tabs.append(t1, t2); panes.append(paneScan, paneText);

    TL.modal(target ? 'Importer dans « ' + target.title + ' »' : 'Convertir une fiche papier', h('div.importer', tabs, panes), [
      { label: 'Annuler' },
      { label: target ? 'Ajouter à l’atelier' : 'Créer l’atelier', primary: true, onClick: async () => {
        const conv = ta.value.trim() ? TL.gift.parse(ta.value, {}) : { title: '', steps: [] };
        if (!conv.steps.length && !pages.length) { TL.toast('Ajoute une fiche ou du texte à convertir.'); return false; }
        const steps = conv.steps;
        if (pages.length && keepScan.checked) {
          const scan = { type: 'scan', title: 'Fiche papier d’origine', pages };
          if (steps.length) steps[0].blocks.unshift(scan); else steps.push({ title: 'Fiche papier', blocks: [scan] });
        }
        if (target) {
          target.steps.push(...steps);
          TL.normalizeWorkshop(target);
          if (after) after();
          TL.toast(steps.length + ' étape(s) ajoutée(s).', 'ok');
        } else {
          const w = await app.saveWorkshop({ title: conv.title && conv.title !== 'Atelier importé' ? conv.title : 'Fiche convertie', level: meta.level, steps, author: (app.profile && app.profile.name) || '' }, 'local');
          app.go('ed-' + w.id);
        }
      } },
    ]).el.classList.add('wide');
  };
})();
