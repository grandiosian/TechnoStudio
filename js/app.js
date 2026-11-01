/* TechnoStudio — application : barre de menus, plan de travail, panneaux,
   bibliothèque, lecteur de feuilles, fiche pédagogique, compte, passerelle. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;

  const app = (TL.app = { profile: null, workshops: new Map(), catalog: [], progress: new Map(), layers: { comp: false, corr: false }, zoom: 1 });
  const stage = () => TL.$('#stage');
  const isProf = () => !!(app.profile && app.profile.role === 'prof');

  /* ================= Données ================= */
  app.loadWorkshops = async function () {
    app.workshops.clear();
    (TL.DEMOS || []).forEach((w) => app.workshops.set(w.id, w));
    (await ateliersPublies()).forEach((w) => app.workshops.set(w.id, w));
    (await TL.db.all('ws:')).forEach((w) => app.workshops.set(w.id, TL.normalizeWorkshop(w)));
  };
  /* Ateliers publiés avec l'appli (dossier ateliers/, listés dans ateliers.json) : disponibles sans serveur.
     Fichier unique (double-clic) : intégrés par tools/build.js. Sinon lus à côté de la page ; une copie est
     gardée sur le poste pour la prochaine ouverture hors ligne. Ils se comportent comme les ateliers intégrés. */
  async function ateliersPublies() {
    const lire = (u, ms) => Promise.race([fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      new Promise((_, ko) => setTimeout(() => ko(new Error('délai')), ms))]);
    let liste = null;
    if (Array.isArray(window.TL_ATELIERS_PUBLIES)) liste = window.TL_ATELIERS_PUBLIES;
    else if (/^https?:$/.test(location.protocol)) {
      try {
        const base = new URL('ateliers.json', location.href), cat = await lire(base, 4000);
        liste = [];
        for (const e of (cat.ateliers || []).filter((x) => x && x.fichier)) {
          const d = await lire(new URL(e.fichier, base), 4000);
          (Array.isArray(d) ? d : d.workshops || [d]).forEach((w) => liste.push(Object.assign({}, w, { publie: e.fichier })));
        }
        TL.db.set('publies', liste).catch(() => {});
      } catch (e) { liste = null; }
    }
    if (!liste) liste = (await TL.db.get('publies').catch(() => null)) || [];
    return liste.filter((w) => TL.descriptor.validate('Workshop', w).ok).map((w) => Object.assign(TL.normalizeWorkshop(TL.clone(w)), { source: 'demo', publie: w.publie || true }));
  }
  app.saveWorkshop = async function (w, source) {
    w = TL.normalizeWorkshop(w);
    w.source = source || w.source || 'local';
    w.updatedAt = Date.now();
    await TL.db.set('ws:' + w.id, w);
    app.workshops.set(w.id, w);
    return w;
  };
  app.deleteWorkshop = async function (id) {
    await TL.db.del('ws:' + id);
    app.workshops.delete(id);
    const demo = (TL.DEMOS || []).find((d) => d.id === id);
    if (demo) app.workshops.set(id, demo);
  };
  app.getProgress = async function (id) {
    if (app.progress.has(id)) return app.progress.get(id);
    const pg = (await TL.db.get('pg:' + id)) || { wid: id, step: 0, answers: {}, seen: {}, startedAt: null, updatedAt: 0 };
    pg.answers = pg.answers || {}; pg.seen = pg.seen || {};
    app.progress.set(id, pg);
    return pg;
  };
  const writes = {};
  app.saveProgress = function (pg) {
    pg.updatedAt = Date.now();
    if (!pg.startedAt) pg.startedAt = pg.updatedAt;
    clearTimeout(writes[pg.wid]);
    writes[pg.wid] = setTimeout(() => TL.db.set('pg:' + pg.wid, pg), 0);
    TL.centrale.sauver(pg);
    TL.emit('progress', pg);
  };
  TL.on('synced', () => {
    const open = (location.hash.match(/^#at-(.+)/) || [])[1];
    for (const k of [...app.progress.keys()]) if (k !== open) app.progress.delete(k);
    if (/^#?(accueil|bibliotheque)?$/.test(location.hash)) route();
  });
  app.refreshCatalog = async function (silent) {
    const Z = TL.centrale;
    if (!Z.connecte()) { if (!silent) app.connexion(); return; }
    try {
      const n = await Z.recevoir();
      if (!silent) TL.toast(n ? n + ' atelier(s) reçu(s) de la Centrale.' : 'Aucun nouvel atelier sur la Centrale.', n ? 'ok' : '');
      if (n) Z.declarer();
      if (/^#?(accueil|bibliotheque)?$/.test(location.hash) || !location.hash) route();
    } catch (e) { if (!silent) TL.toast(e.message, 'bad'); }
  };

  /* ================= Menus ================= */
  const cur = () => { const m = location.hash.match(/^#(at|ed|fiche)-(.+)$/); return m ? app.workshops.get(m[2]) : null; };
  function menus() {
    const w = cur();
    const mode = (location.hash.match(/^#([a-z]+)/) || [, 'accueil'])[1];
    const theme = document.documentElement.dataset.theme || 'auto';
    return [
      { brand: h('span.brandmark', TL.brandSvg(), h('span', 'Techno', h('b', 'Studio'))), items: [
        { label: 'À propos de TechnoStudio', action: about },
        { sep: true }, { head: 'Thème' },
        ...[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => ({ label: l, check: theme === k, action: () => setTheme(k) })),
        { sep: true }, { label: 'Profil et connexion…', action: () => app.go('compte') },
      ] },
      { label: 'Fichier', items: () => [
        { label: 'Bibliothèque', key: 'Ctrl O', action: () => app.go('accueil') },
        { label: 'Nouvel atelier', hidden: !isProf(), action: newWorkshop },
        { label: 'Convertir une fiche papier…', hidden: !isProf(), action: () => TL.editor.importDialog(null) },
        { label: 'Mes ateliers (créer, publier)', hidden: !isProf(), action: () => app.go('creer') },
        { sep: true },
        { label: 'Importer un paquet…', action: importPackage },
        { label: 'Exporter le paquet de l’atelier', disabled: !w, action: () => w && TL.saveAs(slug(w.title) + '.technostudio.json', JSON.stringify(exportable(w), null, 1)) },
        { label: 'Export Moodle (GIFT)', disabled: !w, action: () => w && TL.saveAs(slug(w.title) + '.gift.txt', TL.gift.toGift(w), 'text/plain') },
        { sep: true },
        { label: 'Enregistrer mon travail (fichier)', disabled: !w, action: () => w && enregistrerTravail(w) },
        { label: 'Ouvrir mon travail…', action: ouvrirTravail },
        { label: 'Déposer sur Nuage', disabled: !w, action: () => w && deposerSurNuage(w) },
        { sep: true },
        { label: 'Imprimer la feuille', disabled: mode !== 'at' && mode !== 'fiche', action: () => window.print() },
      ] },
      { label: 'Atelier', hidden: !w, items: () => [
        { label: 'Feuille précédente', key: '←', disabled: mode !== 'at', action: () => app.step && app.step(-1) },
        { label: 'Feuille suivante', key: '→', disabled: mode !== 'at', action: () => app.step && app.step(1) },
        { sep: true },
        { label: 'Fiche pédagogique', check: mode === 'fiche', action: () => app.go('fiche-' + w.id) },
        { label: 'Feuilles de l’atelier', check: mode === 'at', action: () => app.go('at-' + w.id) },
        { label: w && w.source === 'demo' ? 'Dupliquer et modifier' : 'Modifier', hidden: !isProf(), check: mode === 'ed', action: () => app.go('ed-' + w.id) },
        { sep: true },
        { label: 'Effacer ma progression…', action: clearProgress },
      ] },
      { label: 'Insertion', hidden: mode !== 'ed', items: () => TL.editor.insertMenu() },
      { label: 'Outils', items: [
        { label: 'Atelier Code (Arduino, ESP32, micro:bit)', check: mode === 'code', action: () => app.go('code') },
        { label: 'Simulateur de circuit libre', check: mode === 'circuit', action: () => app.go('circuit') },
        { label: 'Maquettes programmables', check: mode === 'maquettes', action: () => app.go('maquettes') },
        { sep: true },
        { label: 'Vérifier un atelier (descripteur)…', action: () => app.go('passerelle') },
      ] },
      { label: 'Affichage', items: () => [
        { label: 'Pastilles de compétences', check: app.layers.comp, action: () => { app.layers.comp = !app.layers.comp; rerender(); } },
        { label: 'Correction (calque _Corr)', hidden: !isProf(), check: app.layers.corr, action: () => { app.layers.corr = !app.layers.corr; rerender(); } },
        { sep: true }, { head: 'Zoom de la feuille' },
        ...[[0.75, '75 %'], [1, '100 %'], [1.25, '125 %']].map(([z, l]) => ({ label: l, check: app.zoom === z, action: () => { app.zoom = z; applyZoom(); } })),
        { sep: true }, { head: 'Panneaux' },
        ...(TL.panels.ids || []).map((id) => ({ label: TL.panels.defs[id].title, check: !!TL.panels.els[id], action: () => TL.panels.toggle(id) })),
        { label: 'Réinitialiser la disposition', disabled: !(TL.panels.ids || []).length, action: () => TL.panels.reset() },
      ] },
      { label: 'Centrale', items: () => {
        const Z = TL.centrale, on = Z.connecte();
        return [
          { label: on ? 'Connecté : ' + Z.user.name : 'Me connecter avec mon code…', action: () => (on ? app.go('compte') : app.connexion()) },
          { label: 'Enregistrer et recharger mon travail', disabled: !on, action: async () => { try { await Z.sync(); TL.toast('Travail à jour.', 'ok'); } catch (e) { TL.toast(e.message, 'bad'); } } },
          { label: 'Recevoir les ateliers du professeur', disabled: !on, action: () => app.refreshCatalog() },
          { label: '← Mes ateliers (portail)', hidden: !Z.lienPortail(), action: () => window.Centrale && window.Centrale.retour() },
          { label: 'Me déconnecter', hidden: !on, action: async () => { await Z.deconnexion(); TL.toast('Déconnecté : ton travail reste sur cet appareil.'); } },
          { sep: true },
          { label: 'Réglages de connexion…', action: () => app.go('compte') },
          { label: 'Passerelle et descripteur', action: () => app.go('passerelle') },
        ];
      } },
      { label: 'Aide', items: [
        { label: 'Raccourcis clavier', action: shortcuts },
        { label: 'Format des ateliers', action: () => app.go('passerelle') },
        { label: 'À propos', action: about },
      ] },
    ];
  }
  const slug = (s) => TL.norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'atelier';
  const exportable = (w) => { const c = TL.clone(w); delete c.source; return c; };
  app.exportable = exportable;

  /* ================= Coquille ================= */
  TL.brandSvg = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 512 512'); s.setAttribute('class', 'brand-mark'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<rect width="512" height="512" rx="112" fill="#2F57A1"/><path d="M120 176h272M256 176v208" stroke="#fff" stroke-width="28" stroke-linecap="round"/><circle cx="120" cy="176" r="30" fill="#F5C400"/><circle cx="392" cy="176" r="30" fill="#fff"/><circle cx="256" cy="384" r="34" fill="#fff"/>'; return s; };
  function drawSync() {
    const Z = TL.centrale, st = Z.connecte() ? Z.status : 'local';
    const txt = { local: 'Sur cet appareil', indispo: 'Sur cet appareil', online: 'Enregistré', offline: 'Hors ligne', syncing: 'Enregistrement…', error: 'À vérifier' }[st] || 'Sur cet appareil';
    TL.$$('[data-sync]').forEach((box) => {
      box.className = 'sync st-' + (st === 'indispo' ? 'local' : st); box.innerHTML = '';
      box.append(h('span.sync-dot'), h('span.sync-txt', txt), Z.user ? h('span.sync-user', Z.user.name) : app.profile ? h('span.sync-user', app.profile.name) : null,
        !Z.connecte() && Z.dispo ? h('span.sync-cta', 'Mon code') : null);
      box.title = Z.message || (Z.connecte() ? 'Centrale ' + Z.serveur.replace(/^https?:\/\//, '').replace(/\/$/, '') + (Z.lastSync ? ' · ' + TL.fmtDate(Z.lastSync) : '') : 'Travail enregistré sur cet appareil. Clique pour te connecter avec ton code élève.');
      box.onclick = () => (Z.connecte() ? app.go('compte') : app.connexion());
    });
  }
  function drawRetour() {
    const zone = TL.$('.mb-right'); if (!zone) return;
    let b = zone.querySelector('.mb-retour');
    const lien = TL.centrale.lienPortail();
    if (!lien) { if (b) b.remove(); return; }
    if (!b) { b = h('button.btn.small.ghost.mb-retour', { type: 'button', title: 'Revenir au portail de la Centrale (ton travail est enregistré)', onclick: () => window.Centrale.retour() }, '← Mes ateliers'); zone.prepend(b); }
  }
  TL.on('hub', () => { drawSync(); drawRetour(); TL.menubar.render(menus()); });
  function setTheme(k) { if (k === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = k; try { localStorage.setItem('tl-theme', k); } catch (e) { /* stockage indisponible */ } TL.menubar.render(menus()); }
  function applyZoom() { TL.$$('.pasteboard .sheet').forEach((s) => (s.style.zoom = app.zoom)); }

  let rerender = () => {};
  // Une seule vue à la fois : un changement demandé pendant l'affichage est rejoué ensuite
  let routing = null, again = false;
  function route() {
    if (routing) { again = true; return routing; }
    routing = (async () => { do { again = false; await routeNow(); } while (again); })().finally(() => { routing = null; });
    return routing;
  }
  async function routeNow() {
    const hash = (location.hash || '#accueil').slice(1);
    // #activite=<atelier> ou <atelier>/<feuille> : ouverture directe, même sans la Centrale
    if (/^activite=/.test(hash)) { let id = ''; try { id = decodeURIComponent(hash.slice(9).split('&')[0]); } catch (e) { /* adresse illisible */ } if (id) { await TL.centrale.ouvrirActivite(id); if (/^#activite=/.test(location.hash)) app.go('accueil'); return; } }
    TL.menubar.render(menus());
    const st = stage();
    st.innerHTML = ''; st.className = 'stage';
    rerender = () => {};
    app.step = null;
    try {
      if (hash.startsWith('at-')) await viewPlayer(hash.slice(3));
      else if (hash.startsWith('fiche-')) await viewFiche(hash.slice(6));
      else if (hash.startsWith('ed-')) { TL.panels.setMode('edit', [], []); await TL.editor.view(st, hash.slice(3)); }
      else if (hash === 'creer') { TL.panels.setMode('creer', [], []); await TL.editor.list(page()); }
      else if (hash === 'compte') { TL.panels.setMode('compte', [], []); await viewAccount(); }
      else if (hash === 'passerelle') { TL.panels.setMode('passerelle', [], []); await viewGateway(); }
      else if (hash === 'code') await viewCode();
      else if (hash === 'circuit') viewCircuitSandbox();
      else if (hash === 'maquettes') viewSceneSandbox();
      else await viewLibrary();
    } catch (e) {
      console.error(e);
      page().append(h('div.empty', h('h2', 'Cette vue n’a pas pu s’afficher'), h('p', e.message), h('a.btn', { href: '#accueil' }, 'Bibliothèque')));
    }
    TL.menubar.render(menus());
  }
  app.route = route;
  app.go = (hash) => { if (location.hash === '#' + hash) route(); else location.hash = hash; };
  const page = (cls) => { const p = h('div.pasteboard.scroll', h('div.desk' + (cls ? '.' + cls : ''))); stage().append(p); return p.firstChild; };

  /* ================= Bibliothèque ================= */
  const filt = { level: 'all', q: '' };
  async function viewLibrary() {
    const desk = page('library');
    const all = [...app.workshops.values()];
    TL.panels.register('bib-filtres', { title: 'Filtres', short: 'Filtres', icon: '⚲', w: 250, render(body) {
      const q = h('input.field', { type: 'search', placeholder: 'Rechercher…', value: filt.q, 'aria-label': 'Rechercher un atelier' });
      q.oninput = TL.debounce(() => { filt.q = q.value; draw(); }, 150);
      body.append(q, h('div.p-label', 'Niveau'), h('div.p-chips', [['all', 'Tous']].concat(Object.entries(TL.LEVELS).map(([k, v]) => [k, v.label])).map(([k, l]) => h('button.fchip' + (filt.level === k ? '.on' : ''), { type: 'button', onclick: () => { filt.level = k; TL.panels.refresh('bib-filtres'); draw(); } }, l))),
        h('div.p-label', 'Ajouter'), h('div.p-col', h('button.btn.small.ghost', { type: 'button', onclick: importPackage }, 'Importer un paquet…'), TL.centrale.connecte() ? h('button.btn.small.ghost', { type: 'button', onclick: () => app.refreshCatalog() }, 'Recevoir de la Centrale') : h('button.btn.small.ghost', { type: 'button', onclick: () => app.connexion() }, 'Me connecter (code élève)'), isProf() ? h('button.btn.small.primary', { type: 'button', onclick: newWorkshop }, 'Nouvel atelier') : null));
    } });
    TL.panels.register('bib-reprendre', { title: 'Reprendre', short: 'Reprendre', icon: '↺', side: 'right', w: 270, render(body) {
      const list = [...app.progress.values()].filter((pg) => pg.updatedAt && app.workshops.get(pg.wid)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
      if (!list.length) { body.append(h('p.small.muted', 'Les ateliers commencés apparaîtront ici.')); return; }
      list.forEach((pg) => { const w = app.workshops.get(pg.wid); const s = TL.workshopStats(w, pg); body.append(h('a.p-row', { href: '#at-' + w.id }, TL.pastille(w), h('span.p-row-t', w.title), h('span.mono.small', s.pct + ' %'))); });
    } });
    for (const w of all) await app.getProgress(w.id);
    TL.panels.setMode('accueil', ['bib-filtres', 'bib-reprendre'], ['bib-filtres', 'bib-reprendre']);
    const grid = h('div.covers');
    const p = app.profile || {};
    desk.append(h('header.desk-head', h('p.eyebrow', TL.centrale.user ? 'Centrale · ' + TL.centrale.user.classe : 'Sur cet appareil'), h('h1', 'Bonjour ' + (p.name || '') + '.'), h('p.lede', 'Choisis un atelier. Les panneaux se déplacent par leur titre et se rouvrent depuis le menu Affichage.')), grid);
    async function draw() {
      grid.innerHTML = '';
      const list = all.filter((w) => (filt.level === 'all' || w.level === filt.level) && (!filt.q || TL.norm(w.title + ' ' + (w.summary || '') + ' ' + (w.problematique || '')).includes(TL.norm(filt.q))))
        .sort((a, b) => (a.seq || 99) - (b.seq || 99) || a.title.localeCompare(b.title));
      if (!list.length) grid.append(h('p.muted', 'Aucun atelier ne correspond.'));
      for (const w of list) grid.append(await cover(w));
    }
    await draw();
  }
  async function cover(w) {
    const pg = await app.getProgress(w.id);
    const st = TL.workshopStats(w, pg);
    const kinds = [...new Set(w.steps.map((s) => (TL.SHEET_KINDS[s.kind || 'feuille'] || {}).short))].join(' · ');
    return h('a.cover', { href: '#at-' + w.id },
      h('div.cover-band', h('span.cover-title', TL.fr('ATELIER - ' + w.title)), TL.pastille(w)),
      h('div.cover-body',
        w.problematique ? h('p.cover-pb', h('b', 'Problématique : '), w.problematique) : w.summary ? h('p.cover-pb', w.summary) : null,
        h('div.cover-meta', h('span.chip.lv-' + w.level, (TL.LEVELS[w.level] || {}).label || w.level), h('span.mono.small', w.steps.length + ' feuilles' + (kinds ? ' · ' + kinds : '')), w.source !== 'demo' ? h('span.tag', w.source === 'centrale' ? 'Centrale' : 'local') : null),
        h('div.meter', { role: 'progressbar', 'aria-valuenow': st.pct, 'aria-label': 'Progression' }, h('span', { style: { width: st.pct + '%' } })),
        h('span.small.muted', st.pct ? (st.pct === 100 ? 'Terminé · ' + st.score + ' %' : st.pct + ' % réalisé') : 'Pas commencé')));
  }

  /* ================= Lecteur de feuilles ================= */
  async function viewPlayer(id) {
    const w = app.workshops.get(id);
    if (!w) { page().append(h('div.empty', h('h2', 'Atelier introuvable'), h('a.btn', { href: '#accueil' }, 'Bibliothèque'))); return; }
    const pg = await app.getProgress(id);
    pg.step = TL.clamp(pg.step || 0, 0, Math.max(0, w.steps.length - 1));
    const board = h('div.pasteboard.scroll');
    stage().append(board);
    const show = (i) => {
      pg.step = TL.clamp(i, 0, w.steps.length - 1);
      const s = w.steps[pg.step];
      if (!s) { board.innerHTML = ''; board.append(h('div.desk', h('p', 'Atelier vide.'))); return; }
      pg.seen[s.id] = true; app.saveProgress(pg);
      board.innerHTML = '';
      const sheet = TL.renderSheet(w, s, pg.step, { pg, layers: app.layers, onResult: () => { TL.panels.refresh('feuilles'); TL.panels.refresh('suivi'); paintNote(); } });
      sheet.style.zoom = app.zoom;
      const nav = h('nav.sheetnav',
        pg.step > 0 ? h('button.btn.ghost', { type: 'button', onclick: () => show(pg.step - 1) }, '← ' + w.steps[pg.step - 1].title) : h('span'),
        h('span.mono.small.muted', 'Feuille ' + (pg.step + 1) + ' / ' + w.steps.length),
        pg.step < w.steps.length - 1 ? h('button.btn.primary', { type: 'button', onclick: () => show(pg.step + 1) }, w.steps[pg.step + 1].title + ' →') : h('button.btn.primary', { type: 'button', onclick: () => finish(w, pg) }, 'Terminer l’atelier'));
      board.append(sheet, nav);
      board.scrollTop = 0;
      paintNote();
      TL.panels.refresh('feuilles'); TL.panels.refresh('suivi');
    };
    function paintNote() {
      const box = board.querySelector('[data-note]');
      if (!box) return;
      let pts = 0, got = 0, any = false;
      w.steps.filter((x) => x.kind === 'evaluation').forEach((x) => x.blocks.forEach((b) => { if (!TL.isGraded(b)) return; const p = b.bareme || 1; pts += p; const a = pg.answers[b.id]; if (a && a.done) { any = true; got += p * (a.score || 0); } }));
      box.textContent = any && pts ? TL.fmtNum((got / pts) * 20, 1) + ' / 20' : '…… / 20';
    }
    app.step = (d) => show(pg.step + d);
    rerender = () => show(pg.step);

    TL.panels.register('feuilles', { title: 'Feuilles', short: 'Feuilles', icon: '❐', w: 250, render(body) {
      body.append(h('a.p-row.fiche-link', { href: '#fiche-' + w.id }, h('span.kind.k-fiche', 'F'), h('span.p-row-t', 'Fiche pédagogique')));
      TL.sheetCodes(w).forEach((code, i) => {
        const s = w.steps[i];
        const done = TL.stepDone(s, pg);
        body.append(h('button.p-row' + (i === pg.step ? '.on' : ''), { type: 'button', onclick: () => show(i) }, h('span.kind.k-' + (s.kind || 'feuille'), code), h('span.p-row-t', s.title, s.segpa ? h('small.muted', ' SEGPA') : null), h('span.p-row-s', done ? '✓' : '')));
      });
    } });
    TL.panels.register('suivi', { title: 'Mon avancement', short: 'Avancement', icon: '◔', side: 'right', w: 270, render(body) {
      const st = TL.workshopStats(w, pg);
      body.append(h('div.p-stat', h('span.mono.big', st.pct + ' %'), h('span.small.muted', st.done + ' / ' + st.total + ' activités · score ' + st.score + ' %')), h('div.meter', h('span', { style: { width: st.pct + '%' } })));
      if (w.problematique) body.append(h('div.p-label', 'Problématique'), h('p.small', w.problematique));
      const comps = (w.competences || []).map((c) => (typeof c === 'string' ? { label: c } : c));
      if (comps.length) body.append(h('div.p-label', 'Compétences'), h('ul.p-comps', comps.map((c) => h('li', c.code ? h('span.ct-tag.small', { style: { background: c.color || TL.CHARTE.themes[(c.code.match(/^T\d/) || ['T2'])[0]] } }, c.code) : null, ' ', c.label))));
      body.append(h('div.p-label', 'Affichage'),
        h('label.p-check', h('input', { type: 'checkbox', checked: app.layers.comp, onchange: (e) => { app.layers.comp = e.target.checked; rerender(); } }), ' Pastilles de compétences'),
        isProf() ? h('label.p-check', h('input', { type: 'checkbox', checked: app.layers.corr, onchange: (e) => { app.layers.corr = e.target.checked; rerender(); } }), ' Correction') : null,
        isProf() ? h('div.p-col', h('a.btn.small.ghost', { href: '#ed-' + w.id }, w.source === 'demo' ? 'Dupliquer et modifier' : 'Modifier cet atelier')) : null);
    } });
    TL.panels.setMode('atelier', ['feuilles', 'suivi'], ['feuilles', 'suivi']);
    show(pg.step);
  }
  function finish(w, pg) {
    const st = TL.workshopStats(w, pg);
    if (!pg.completedAt && st.pct === 100) pg.completedAt = Date.now();
    app.saveProgress(pg);
    TL.modal(st.pct === 100 ? 'Atelier terminé' : 'Pas tout à fait fini', h('div.finish', h('div.finish-score', h('span.mono.big', st.score + ' %'), h('span.small.muted', 'score moyen sur ' + st.total + ' activités')),
      h('p', st.pct === 100 ? (TL.centrale.connecte() ? 'Ton travail est enregistré sur la Centrale : ton professeur voit ton avancement.' : 'Ton travail est enregistré sur cet appareil.') : 'Il reste ' + (st.total - st.done) + ' activité(s). Le panneau « Feuilles » montre celles qui sont terminées (✓).')),
    [{ label: 'Rester ici' }, { label: 'Bibliothèque', primary: true, onClick: () => app.go('accueil') }]);
  }
  async function clearProgress() {
    const w = cur(); if (!w) return;
    if (!(await TL.confirm('Effacer ma progression', 'Toutes tes réponses à « ' + w.title + ' » seront effacées sur cet appareil.', 'Effacer'))) return;
    const pg = await app.getProgress(w.id);
    pg.answers = {}; pg.seen = {}; pg.completedAt = null; pg.step = 0; app.saveProgress(pg); route();
  }

  async function viewFiche(id) {
    const w = app.workshops.get(id);
    if (!w) { page().append(h('p', 'Atelier introuvable.')); return; }
    const board = h('div.pasteboard.scroll');
    const f = TL.renderFiche(w); f.style.zoom = app.zoom;
    board.append(f, h('nav.sheetnav', h('span'), h('a.btn.primary', { href: '#at-' + w.id }, 'Commencer l’atelier →')));
    stage().append(board);
    TL.panels.setMode('fiche', [], []);
  }

  /* ================= Atelier Code ================= */
  async function viewCode() {
    const st = stage(); st.classList.add('full');
    const C = TL.code;
    // Ajout en fin de console sans tout réécrire : une sélection en cours reste en place, et la console
    // ne défile que si l'on était déjà en bas (on peut remonter lire ou copier pendant que la carte écrit).
    const out = (s) => {
      app.codeLog = ((app.codeLog || '') + s).slice(-20000);
      const el = TL.$('.code-console'); if (!el) return;
      const enBas = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      const sel = getSelection(), selectionIci = sel && !sel.isCollapsed && el.contains(sel.anchorNode);
      if (el.textContent.length + s.length > 24000 && !selectionIci) el.textContent = app.codeLog;
      else el.append(s);
      if (enBas && !selectionIci) el.scrollTop = 1e9;
    };
    const log = (s) => out(String(s || '').replace(/\s+$/, '') + '\n');
    C.serial.onData = out;
    let ports = [], via = C.viaDefaut(C.board), port = '';
    TL.panels.register('carte', { title: 'Carte et téléversement', short: 'Carte', icon: '⚙', w: 290, x: 172, render(body) {
      const bsel = h('select.field', { 'aria-label': 'Carte' }, Object.entries(C.BOARDS).map(([k, b]) => h('option', { value: k }, b.name)));
      bsel.value = C.board;
      bsel.onchange = () => { C.setBoard(bsel.value, true); via = C.viaDefaut(bsel.value); TL.panels.refresh('carte'); };
      const ex = h('select.field', { 'aria-label': 'Exemple' }, h('option', { value: '' }, 'Charger un exemple…'), Object.entries(C.EXAMPLES).filter(([, e]) => e.boards.includes(C.board)).map(([k, e]) => h('option', { value: k }, e.name)));
      ex.onchange = () => { if (ex.value) C.loadExample(ex.value); ex.value = ''; };
      const ps = C.pont.status;
      const lang = C.BOARDS[C.board].lang;
      const fe = TL.flash.etat;
      const chip = (k, label, dis) => h('button.fchip' + (via === k ? '.on' : ''), { type: 'button', disabled: !!dis, onclick: () => { via = k; TL.panels.refresh('carte'); } }, label);
      let detail;
      if (via === 'serveur') {
        const cs = C.carteServeur(C.board);
        const carteOk = fe && fe.cartes && fe.cartes[cs] && fe.cartes[cs].installee;
        detail = h('div.p-col',
          h('div.p-state' + (carteOk ? '.ok' : fe ? '.warn' : '.bad'), fe ? (carteOk ? 'Serveur de compilation prêt' : 'Serveur joint, mais la carte ' + C.BOARDS[C.board].name + ' n’y est pas installée') : 'Serveur de compilation injoignable'),
          fe && !carteOk && C.board === 'esp32' ? h('p.small', 'L’ESP32 en C++ n’est pas installé sur ce serveur de compilation. En attendant : carte « ESP32 (MicroPython) » par USB direct, ou le pont local.') : null,
          h('small.muted.mono', TL.flash.adresse().replace(/^https?:\/\//, '')),
          !TL.centrale.connecte() && fe && fe.auth !== 'ouvert' ? h('p.small', 'Connecte-toi avec ton code élève (menu Centrale) pour compiler sur le serveur.') : null,
          C.board === 'microbit' ? null : !TL.flash.supporte ? h('p.small.callout.warn', 'Téléversement USB : utilise Chrome ou Edge sur ordinateur.') : h('p.small.muted', 'Au premier envoi, choisis le port USB de la carte.'),
          h('div.p-row2', h('button.btn.small.ghost', { type: 'button', onclick: async () => { await TL.flash.verifier(); TL.panels.refresh('carte'); } }, '↻ Tester'),
            TL.flash.supporte && C.board !== 'microbit' ? h('button.btn.small.ghost', { type: 'button', onclick: async () => { try { const p = await TL.flash.choisirPort(true); C.serial.port = p; log('Port USB choisi.'); } catch (e) { /* annulé */ } } }, 'Changer de port') : null));
      } else if (via === 'pont') {
        const psel = h('select.field', { 'aria-label': 'Port' }, h('option', { value: '' }, ports.length ? 'Choisir le port…' : 'Aucun port détecté'), ports.map((p) => h('option', { value: p.address }, p.label + (p.board ? ' · ' + p.board : ''))));
        psel.value = port; psel.onchange = () => (port = psel.value);
        detail = h('div.p-col',
          h('div.p-state' + (ps ? '.ok' : '.bad'), ps ? 'Pont actif · arduino-cli ' + (ps.arduinoCli ? (ps.arduinoCli.version || 'ok') : 'absent') + (ps.mpremote ? ' · mpremote ok' : '') : 'Pont non détecté sur ce poste'),
          ps && ps.cores ? h('small.muted', 'Cœurs : ' + (ps.cores.join(', ') || 'aucun')) : null,
          h('div.p-row2', psel, h('button.icon-btn', { type: 'button', title: 'Actualiser les ports', 'aria-label': 'Actualiser les ports', onclick: async () => { await C.pont.check(); if (C.pont.status) { const r = await C.pont.ports(); ports = r.ports || []; if (!port && ports[0]) port = ports[0].address; } TL.panels.refresh('carte'); } }, '↻')),
          !ps ? h('p.small', 'Poste équipé du pont : lance « demarrer-pont » (dossier pont), puis actualise.') : null,
          ps && (!ps.cores || ps.cores.length < 2) ? h('button.btn.small.ghost', { type: 'button', onclick: setupCores }, 'Installer les cœurs Arduino et ESP32') : null);
      } else detail = h('p.small.muted', 'Chrome ou Edge : la carte MicroPython (ESP32, micro:bit) reçoit main.py directement par le câble USB.');
      body.append(h('div.p-label', 'Carte'), bsel, ex,
        h('div.p-label', 'Téléversement'),
        h('div.p-chips', lang === 'cpp' ? chip('serveur', 'Serveur + USB') : C.board === 'microbit' ? chip('serveur', 'Fichier .hex') : null, lang === 'mpy' ? chip('webserial', 'USB direct', !C.serial.supported) : null, chip('pont', 'Pont local')),
        detail,
        h('div.p-label', 'Actions'),
        h('div.p-col',
          lang === 'cpp' ? h('button.btn.small.ghost', { type: 'button', onclick: () => C.actions.verify(log, via) }, '✓ Vérifier (compiler)') : null,
          C.board === 'microbit' && via === 'serveur' ? h('p.small.muted', 'Le fichier .hex contient MicroPython et ton programme : glisse-le sur le lecteur MICROBIT, aucune installation préalable.') : null,
          h('button.btn.small.primary', { type: 'button', onclick: () => C.actions.upload({ via, port, log }) }, '⇪ Téléverser'),
          h('button.btn.small.ghost', { type: 'button', onclick: () => C.actions.exportFile() }, 'Exporter ' + (lang === 'cpp' ? 'le .ino' : 'main.py'))));
    } });
    TL.panels.register('codegen', { title: 'Code généré', short: 'Code', icon: '{}', side: 'right', w: 360, render(body) {
      const c = C.current || { code: '', lang: 'cpp' };
      body.append(h('div.p-row2', h('span.small.muted', c.lang === 'cpp' ? 'C++ Arduino' : 'MicroPython'), h('button.btn.small.ghost', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(c.code); TL.toast('Code copié.', 'ok'); } catch (e) { TL.toast('Copie impossible ici.'); } } }, 'Copier')), h('pre.codegen.mono', c.code));
    } });
    TL.panels.register('console', { title: 'Console et moniteur série', short: 'Console', icon: '▭', side: 'right', top: 400, w: 360, render(body) {
      const baud = h('select.field.small', { 'aria-label': 'Vitesse' }, [9600, 115200].map((b) => h('option', { value: b, selected: b === 115200 }, b + ' bauds')));
      const send = h('input.field', { type: 'text', placeholder: 'Envoyer…', 'aria-label': 'Envoyer sur le port série' });
      send.onkeydown = async (e) => { if (e.key === 'Enter' && C.serial.writer) { await C.serial.write(send.value + '\r\n'); send.value = ''; } };
      body.append(h('pre.code-console.mono', app.codeLog || 'Les messages de compilation et le moniteur série s’affichent ici.\n'),
        h('div.p-row2', C.serial.supported ? h('button.btn.small.ghost', { type: 'button', onclick: async () => { try { if (C.serial.writer) { await C.serial.close(); log('Port série fermé.'); } else { await C.serial.open(+baud.value); log('Port série ouvert.'); } TL.panels.refresh('console'); } catch (e) { log('✗ ' + e.message); } } }, C.serial.writer ? 'Fermer le port' : 'Ouvrir le port USB') : h('small.muted', 'Moniteur USB : Chrome ou Edge'), baud),
        send, h('div.p-row2', h('button.btn.small.ghost', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(app.codeLog || ''); TL.toast('Console copiée.', 'ok'); } catch (e) { TL.toast('Copie impossible ici : sélectionne le texte puis Ctrl+C.'); } } }, 'Copier'),
          h('button.btn.small.ghost', { type: 'button', onclick: () => { app.codeLog = ''; TL.panels.refresh('console'); } }, 'Effacer')));
    } });
    async function setupCores() {
      log('Installation des cœurs (plusieurs minutes, internet nécessaire)…');
      try {
        const r = await fetch((window.TL_PONT || 'http://127.0.0.1:8765') + '/setup');
        const rd = r.body.getReader(); const dec = new TextDecoder();
        for (;;) { const { value, done } = await rd.read(); if (done) break; dec.decode(value).split('\n\n').forEach((l) => { if (l.startsWith('data: ')) { try { out(JSON.parse(l.slice(6))); } catch (e) { /* fragment */ } } }); }
        await C.pont.check(); TL.panels.refresh('carte');
      } catch (e) { log('✗ ' + e.message); }
    }
    if (!app.codeHooks) { app.codeHooks = true; TL.on('code', () => TL.panels.refresh('codegen')); TL.on('pont', () => TL.panels.refresh('carte')); TL.on('compilateur', () => TL.panels.refresh('carte')); }
    TL.panels.setMode('code', ['carte', 'codegen', 'console'], ['carte', 'codegen', 'console']);
    await C.view(st);
    TL.panels.refresh('carte'); TL.panels.refresh('codegen');
    TL.flash.verifier();
    if (await C.pont.check()) { const r = await C.pont.ports(); ports = r.ports || []; if (ports[0]) port = ports[0].address; TL.panels.refresh('carte'); }
  }

  /* ================= Bacs à sable ================= */
  function viewCircuitSandbox() {
    const desk = page('sandbox');
    const sim = new TL.Circuit({ cols: 9, rows: 6, palette: Object.fromEntries(Object.keys(TL.CIRCUIT_COMP).map((k) => [k, -1])) }, {});
    desk.append(h('header.desk-head', h('h1', 'Simulateur de circuit'), h('p.lede', 'Montage libre : place les composants, ferme les interrupteurs, touche un composant pour mesurer tension et intensité.')), h('div.card', sim.el));
    TL.panels.setMode('circuit', [], []);
  }
  function viewSceneSandbox() {
    const desk = page('sandbox');
    let scene = app.sandScene || 'eclairage';
    const holder = h('div');
    const draw = () => { holder.innerHTML = ''; holder.append(TL.activities.blocks.render({ id: 'bac-' + scene, type: 'blocks', scene, tests: [] }, { answer: null, save() {}, result() {}, uid: 'sand', seed: 1 })); };
    const sel = h('select.field', { 'aria-label': 'Maquette', onchange: (e) => { scene = app.sandScene = e.target.value; draw(); } }, Object.entries(TL.SCENES).map(([k, s]) => h('option', { value: k, selected: k === scene }, s.name)));
    desk.append(h('header.desk-head', h('h1', 'Maquettes programmables'), h('p.lede', 'Programme une maquette virtuelle sans carte. Pour une vraie carte, ouvre l’atelier Code (menu Outils).'), sel), h('div.card', holder));
    draw();
    TL.panels.setMode('maquettes', [], []);
  }

  /* ================= Connexion à la Centrale ================= */
  /** Fenêtre « Mon code » : formulaire fourni par la Centrale (code élève géré par elle). */
  app.connexion = async function () {
    const Z = TL.centrale;
    const zone = h('div.centrale-zone', h('p.muted', 'Connexion à la Centrale…'));
    const m = TL.modal('Me connecter à la Centrale', h('div.form',
      h('p', 'Avec ton code, tu reçois les ateliers de ton professeur, ton travail est enregistré et tu le retrouves sur n’importe quel ordinateur.'),
      zone, h('p.small.muted', 'Centrale : ' + Z.serveur.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' · atelier « ' + Z.app + ' »')),
    [{ label: 'Plus tard' }]);
    if (!Z.dispo) await Z.init();
    zone.innerHTML = '';
    if (!Z.afficherConnexion(zone, () => { m.close(); TL.toast('Connecté : ' + Z.user.name, 'ok'); route(); })) zone.append(h('p.callout.warn', 'Centrale injoignable pour le moment. Ton travail reste sur cet appareil ; réessaie plus tard.'));
  };

  async function viewAccount() {
    const desk = page('narrow');
    const p = app.profile;
    const Z = TL.centrale;
    const name = h('input.field', { id: 'pf-name', type: 'text', value: p.name || '', autocomplete: 'name' });
    const role = h('select.field', { id: 'pf-role' }, h('option', { value: 'eleve' }, 'Élève / apprenant'), h('option', { value: 'prof' }, 'Enseignant'));
    role.value = p.role || 'eleve';
    desk.append(h('header.desk-head', h('p.eyebrow', 'Profil, Centrale, compilation'), h('h1', 'Compte et connexion')));
    const box = h('section.card');
    const draw = () => {
      box.innerHTML = '';
      box.append(h('h2', 'Centrale élèves'));
      if (Z.connecte()) {
        const s = Z.session();
        const ident = h('div');
        box.append(h('dl.kv', h('dt', 'Classe'), h('dd', s.classe + ' · élève ' + s.eleve), h('dt', 'Identifiant'), h('dd', ident),
          h('dt', 'Centrale'), h('dd.mono.small', Z.serveur), h('dt', 'Atelier'), h('dd.mono', Z.app),
          h('dt', 'État'), h('dd', h('span.pill.' + (Z.status === 'online' ? 'on' : Z.status === 'error' ? 'bad' : 'neutral'), { 'data-centrale-etat': '' }, { online: 'enregistré', syncing: 'enregistrement…', offline: 'hors ligne', error: 'à vérifier' }[Z.status] || Z.status)),
          s.espace ? [h('dt', 'Espace utilisé'), h('dd', TL.fmtNum(s.espace.utilise / 1048576, 1) + ' Mo sur ' + Math.round(s.espace.quota / 1048576) + ' Mo')] : null),
        Z.message ? h('p.callout.warn', Z.message) : null,
        h('div.actions',
          h('button.btn.primary', { type: 'button', onclick: async () => { try { await Z.sync(); TL.toast('Travail à jour.', 'ok'); } catch (e) { TL.toast(e.message, 'bad'); } draw(); } }, 'Enregistrer et recharger'),
          h('button.btn.ghost', { type: 'button', onclick: () => app.refreshCatalog() }, 'Recevoir les ateliers'),
          Z.lienPortail() ? h('button.btn.ghost', { type: 'button', onclick: () => window.Centrale.retour() }, '← Mes ateliers') : null,
          h('button.btn.ghost', { type: 'button', onclick: async () => { await Z.deconnexion(); draw(); TL.menubar.render(menus()); } }, 'Me déconnecter')));
        try { window.Centrale.afficherIdentifiant(ident, { libelle: '', onChange: () => { app.profile.name = Z.user.name; TL.db.set('profile', app.profile); drawSync(); } }); } catch (e) { ident.textContent = s.identifiant || ''; }
      } else {
        box.append(h('p.muted', Z.dispo ? 'Tape le code personnel distribué par ton professeur pour recevoir ses ateliers et enregistrer ton travail sur la Centrale.' : 'Centrale injoignable pour le moment : tout fonctionne et reste sur cet appareil.'),
          h('div.actions', h('button.btn.primary', { type: 'button', onclick: () => app.connexion() }, 'Me connecter avec mon code'), !Z.dispo ? h('button.btn.ghost', { type: 'button', onclick: async () => { await Z.init(); draw(); } }, 'Réessayer') : null));
      }
    };
    draw();
    TL.on('hub', () => { if (box.isConnected) { const pill = box.querySelector('[data-centrale-etat]'); if (pill) pill.textContent = { online: 'enregistré', syncing: 'enregistrement…', offline: 'hors ligne', error: 'à vérifier' }[Z.status] || Z.status; } });
    desk.append(box,
      h('section.card', h('h2', 'Mon profil sur cet appareil'),
        h('div.form.grid2', h('label', { for: 'pf-name' }, 'Nom affiché', name), h('label', { for: 'pf-role' }, 'Je suis', role)),
        h('p.small.muted', 'Le profil Enseignant donne accès à l’éditeur d’ateliers et à la correction. Le nom reste sur cet appareil : la Centrale ne connaît que l’identifiant.'),
        h('div.actions', h('button.btn.primary', { type: 'button', onclick: async () => { Object.assign(p, { name: name.value.trim() || p.name, role: role.value }); await TL.db.set('profile', p); TL.toast('Profil enregistré.', 'ok'); drawSync(); TL.menubar.render(menus()); } }, 'Enregistrer'))));

    // Réglages avancés : utiles à l'enseignant (autre Centrale, plusieurs ateliers, serveur de compilation)
    const srv = h('input.field.mono', { type: 'url', value: Z.serveur, 'aria-label': 'Adresse de la Centrale' });
    const appId = h('input.field.mono', { type: 'text', value: Z.app, 'aria-label': 'Identifiant de l’atelier dans la Centrale' });
    const comp = h('input.field.mono', { type: 'url', value: TL.flash.adresse(), 'aria-label': 'Serveur de compilation' });
    let cleProf = ''; try { cleProf = localStorage.getItem('ts-compilateur-cle') || ''; } catch (e) { /* rien */ }
    const cle = h('input.field.mono', { type: 'password', value: cleProf, autocomplete: 'off', 'aria-label': 'Clé enseignant du serveur de compilation' });
    const compEtat = h('span.small.muted', '');
    desk.append(h('details.card', h('summary', h('b', 'Réglages de connexion (enseignant)')),
      h('div.form',
        h('label', 'Adresse de la Centrale', srv),
        h('label', 'Identifiant de l’atelier dans la Centrale (app)', appId),
        h('p.small.muted', 'Un atelier Centrale par niveau ? Donne à chacun l’adresse ', h('code', location.origin + location.pathname + '?app=technostudio-5e'), ' : ses ressources et ses classes lui sont propres.'),
        h('label', 'Serveur de compilation (cartes Arduino et ESP32)', comp),
        h('label', 'Clé enseignant du serveur de compilation (facultatif, pour compiler sans code élève)', cle),
        h('div.actions',
          h('button.btn.primary', { type: 'button', onclick: async () => {
            Z.reglerConfig(srv.value.trim(), appId.value.trim());
            TL.flash.reglerAdresse(comp.value.trim() === TL.flash.adresse() ? '' : comp.value.trim());
            try { if (cle.value) localStorage.setItem('ts-compilateur-cle', cle.value); else localStorage.removeItem('ts-compilateur-cle'); } catch (e) { /* rien */ }
            TL.toast('Réglages enregistrés : rechargement…', 'ok'); setTimeout(() => location.reload(), 600);
          } }, 'Enregistrer'),
          h('button.btn.ghost', { type: 'button', onclick: async () => { compEtat.textContent = 'Test…'; const e = await TL.flash.verifier(); compEtat.textContent = e ? 'Serveur de compilation ' + e.version + ' · cartes prêtes : ' + (Object.entries(e.cartes).filter(([, c]) => c.installee).map(([k]) => k).join(', ') || 'aucune') : 'Serveur de compilation injoignable.'; } }, 'Tester le serveur de compilation'), compEtat))));

    const restoreIn = h('input', { type: 'file', accept: '.json', hidden: true });
    restoreIn.onchange = async () => {
      try {
        const data = JSON.parse(await TL.readFileText(restoreIn.files[0]));
        if (!data.technostudioBackup) throw new Error('Ce fichier n’est pas une sauvegarde TechnoStudio.');
        for (const [k, v] of Object.entries(data.items || {})) if (/^(pg|ws):/.test(k)) await TL.db.set(k, v);
        app.progress.clear(); await app.loadWorkshops(); TL.toast('Sauvegarde restaurée.', 'ok');
      } catch (e) { TL.toast(e.message, 'bad'); }
      restoreIn.value = '';
    };
    desk.append(h('section.card', h('h2', 'Données de cet appareil'), h('p.muted', 'Sauvegarde de ton travail et de tes ateliers dans un fichier (utile sans Centrale).'),
      h('div.actions',
        h('button.btn.ghost', { type: 'button', onclick: async () => { const items = {}; for (const k of await TL.db.keys('')) if (/^(pg|ws):/.test(k)) items[k] = await TL.db.get(k); TL.saveAs('technostudio-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ technostudioBackup: 1, at: Date.now(), profile: app.profile, items })); } }, 'Exporter une sauvegarde'),
        h('button.btn.ghost', { type: 'button', onclick: () => restoreIn.click() }, 'Restaurer'), restoreIn)),
    h('p.small.muted.center', 'TechnoStudio ' + TL.VERSION + ' · format d’atelier ' + TL.FORMAT));
  }

  /* ================= Passerelle (descripteur) ================= */
  async function viewGateway() {
    const D = TL.descriptor;
    const desk = page('narrow.wide');
    const compat = h('div.p-state', 'Centrale : vérification…');
    desk.append(h('header.desk-head', h('p.eyebrow', D.name + ' v' + D.version + ' · format ' + D.format), h('h1', 'Passerelle'), h('p.lede', 'Le descripteur est le contrat commun entre la Centrale (centralisatrice) et TechnoStudio (application cible) : structures des ateliers et des réponses, clés de sauvegarde, activités du suivi, points d’accès utilisés.')),
      h('div.actions', h('button.btn.primary', { type: 'button', onclick: () => TL.saveAs('technostudio-descripteur.json', JSON.stringify(Object.assign({}, D, { validate: undefined, blockSchema: undefined }), null, 1)) }, 'Exporter le descripteur (JSON)'), compat));
    (async () => {
      try {
        const r = await fetch(TL.centrale.serveur + 'api/', { cache: 'no-store' });
        const j = await r.json();
        compat.className = 'p-state ' + (j.ok ? 'ok' : 'bad');
        compat.textContent = 'Centrale ' + (j.version || '') + ' joignable · atelier « ' + TL.centrale.app + ' »';
      } catch (e) { compat.className = 'p-state bad'; compat.textContent = 'Centrale injoignable depuis ce site (réseau, ou site non autorisé dans Réglages → Sites autorisés).'; }
    })();
    const out = h('div');
    const file = h('input', { type: 'file', accept: '.json', hidden: true, onchange: async () => {
      out.innerHTML = '';
      try {
        const data = JSON.parse(await TL.readFileText(file.files[0]));
        const ent = Array.isArray(data) || data.workshops ? 'Package' : 'Workshop';
        const r = D.validate(ent, Array.isArray(data) ? { workshops: data } : data);
        out.append(h('div.callout.' + (r.ok ? 'tip' : 'warn'), h('b', r.ok ? 'Conforme au descripteur. ' : r.errors.length + ' écart(s) bloquant(s). '), r.warnings.length ? r.warnings.length + ' avertissement(s).' : ''), h('ul.small.mono', r.errors.concat(r.warnings).slice(0, 80).map((x) => h('li', x))));
      } catch (e) { out.append(h('p.callout.warn', 'Fichier illisible : ' + e.message)); }
      file.value = '';
    } });
    const sect = (t, ...c) => h('section.card', h('h2', t), ...c);
    desk.append(
      sect('Vérifier un atelier ou un paquet', h('p.small.muted', 'TechnoStudio applique ces règles à chaque atelier reçu de la Centrale ou importé : un atelier non conforme est ignoré.'), h('div.actions', h('button.btn.ghost', { type: 'button', onclick: () => file.click() }, 'Choisir un fichier .json'), file), out),
      sect('Rôles', h('dl.kv', h('dt', 'Centralisatrice'), h('dd', D.roles.centralisatrice), h('dt', 'Cible'), h('dd', D.roles.cible))),
      sect('Entités échangées', h('div.ent-list', Object.entries(D.entities).map(([k, s]) => h('details.ent', h('summary', h('b.mono', k), h('span.small.muted', ' ' + Object.keys(s.properties || {}).length + ' champs' + (s.required && s.required.length ? ' · obligatoires : ' + s.required.join(', ') : ''))), h('pre.mono.small.schema', JSON.stringify(s, null, 1)))))),
      sect('Types de blocs (' + Object.keys(D.blocks).length + ')', h('div.tablewrap', h('table.simple', h('thead', h('tr', h('th', 'type'), h('th', 'famille'), h('th', 'noté'), h('th', 'champs propres'), h('th', 'réponse'))),
        h('tbody', Object.entries(D.blocks).map(([k, b]) => h('tr', h('td.mono', k), h('td', b.family), h('td', b.graded ? (b.review ? 'oui + correction' : 'oui') : '—'), h('td.small', Object.keys(b.fields).filter((f) => !(f in D.common)).join(', ')), h('td.small', b.answer ? (b.answer.description || b.answer.type) : '—'))))))),
      sect('Stockage et gestion', h('h3', 'Dans l’application'), h('p.small', D.storage.app.engine), h('dl.kv.small', Object.entries(D.storage.app.keys).map(([k, v]) => [h('dt.mono', k), h('dd', v)])), h('ul.small', D.storage.app.rules.map((r) => h('li', r))),
        h('h3', 'Dans la Centrale'), h('p.small', D.storage.centrale.engine), h('dl.kv.small', Object.entries(D.storage.centrale.keys).map(([k, v]) => [h('dt.mono', k), h('dd', v)]))),
      sect('Synchronisation', h('p', D.sync.summary), h('ol.small', D.sync.steps.map((s) => h('li', s))), h('p.small', h('b', 'Déclenchement : '), D.sync.triggers.join(' · ')), h('p.small', h('b', 'Conflits : '), D.sync.conflicts)),
      sect('Points d’accès', h('div.tablewrap', h('table.simple', h('thead', h('tr', h('th', ''), h('th', 'chemin'), h('th', 'accès'), h('th', 'envoi'), h('th', 'réponse'))),
        h('tbody', D.endpoints.map((e) => h('tr', h('td.mono', e.method), h('td.mono.small', e.path), h('td.small', e.auth), h('td.small', e.request || ''), h('td.small', e.response || '', e.errors ? h('div.muted', Object.entries(e.errors).map(([c, m]) => c + ' ' + m).join(' · ')) : null)))))),
        h('dl.kv.small', Object.entries(D.auth).map(([k, v]) => [h('dt.mono', k), h('dd', v)]))),
      sect('Compatibilité', h('p.small', D.compatibility.header), h('ul.small', D.compatibility.rules.map((r) => h('li', r)))));
  }

  /* ================= Divers ================= */
  async function newWorkshop() {
    const w = await app.saveWorkshop({ format: 2, title: 'Nouvel atelier', level: 'college', niveau: '4e', seq: 1, steps: [{ title: 'Séance 1 - Feuille 1', kind: 'feuille', seance: 1, feuille: 1, blocks: [] }] }, 'local');
    app.go('ed-' + w.id);
  }
  app.newWorkshop = newWorkshop;
  function importPackage() {
    const fileIn = h('input', { type: 'file', accept: '.json,.technostudio', multiple: true, hidden: true });
    fileIn.onchange = async () => {
      let n = 0;
      for (const f of fileIn.files) {
        try {
          const data = JSON.parse(await TL.readFileText(f));
          const arr = Array.isArray(data) ? data : data.workshops ? data.workshops : [data];
          for (const w of arr) {
            const r = TL.descriptor.validate('Workshop', w);
            if (!r.ok) { TL.toast('« ' + (w.title || f.name) + ' » non conforme : ' + r.errors[0], 'bad'); continue; }
            await app.saveWorkshop(w, 'local'); n++;
          }
        } catch (e) { TL.toast('Fichier illisible : ' + f.name, 'bad'); }
      }
      fileIn.remove();
      if (n) { TL.toast(n + ' atelier(s) importé(s).', 'ok'); route(); }
    };
    document.body.append(fileIn); fileIn.click();
  }
  app.importPackage = importPackage;

  /* ---------- Travail de l'élève dans un fichier, et dépôt Nuage de secours (avec ou sans Centrale) ---------- */
  const CLE_NUAGE = 'ts-nuage';
  const lienNuageLocal = () => { try { return localStorage.getItem(CLE_NUAGE) || ''; } catch (e) { return ''; } };
  function nomTravail(w) {
    const s = TL.centrale.session();
    return ((s ? s.classe + '-' + s.eleve + '-' : 'technostudio-') + w.id).replace(/[^A-Za-z0-9_.-]/g, '-') + '.json';
  }
  async function enregistrerTravail(w) {
    const pg = await app.getProgress(w.id);
    TL.download(nomTravail(w), JSON.stringify({ app: 'technostudio', format: 'travail', version: 1, atelier: w.id, titre: w.title, travail: pg }, null, 1), 'application/json');
    TL.toast('Travail enregistré dans tes téléchargements : ' + nomTravail(w), 'ok');
    return true;
  }
  app.enregistrerTravail = enregistrerTravail;
  function ouvrirTravail() {
    const fileIn = h('input', { type: 'file', accept: '.json', hidden: true });
    fileIn.onchange = async () => {
      const f = fileIn.files[0]; fileIn.remove(); if (!f) return;
      try {
        const d = JSON.parse(await TL.readFileText(f));
        if (!d || d.app !== 'technostudio' || d.format !== 'travail' || !d.travail || !d.atelier) throw new Error('format');
        if (!app.workshops.get(d.atelier)) { TL.toast('L’atelier de ce travail n’est pas sur ce poste : ' + (d.titre || d.atelier), 'bad'); return; }
        const pg = TL.centrale.fusion(await app.getProgress(d.atelier), Object.assign({}, d.travail, { wid: d.atelier }));
        app.progress.set(d.atelier, pg); app.saveProgress(pg);
        TL.toast('Travail repris : ' + (d.titre || d.atelier), 'ok'); app.go('at-' + d.atelier);
      } catch (e) { TL.toast('Ce fichier n’est pas un travail TechnoStudio (.json).', 'bad'); }
    };
    document.body.append(fileIn); fileIn.click();
  }
  async function deposerSurNuage(w) {
    await enregistrerTravail(w);
    const s = TL.centrale.session(), lien = (s && s.depot && s.depot.url) || lienNuageLocal();
    if (lien) {
      window.open(lien, '_blank', 'noopener');
      TL.toast('Travail enregistré : glisse le fichier dans la page Nuage qui vient de s’ouvrir.' + (s && s.depot && s.depot.mot_de_passe ? ' Mot de passe : ' + s.depot.mot_de_passe : ''), 'ok');
      return;
    }
    const champ = h('input', { type: 'url', placeholder: 'https://nuage03.apps.education.fr/s/…', value: lienNuageLocal(), 'aria-label': 'Lien du dossier Nuage de la classe' });
    TL.modal('Dépôt Nuage', h('div.form',
      h('p', 'Ton travail est enregistré dans tes téléchargements. Aucun dossier Nuage n’est réglé sur cet ordinateur : demande le lien à ton professeur.'),
      h('label', h('b', 'Professeur : '), 'lien de partage du dossier Nuage de la classe (gardé sur cet ordinateur)', champ)),
    [{ label: 'Fermer' }, { label: 'Garder et ouvrir', primary: true, onClick: () => {
      const v = champ.value.trim();
      if (!/^https:\/\/\S+$/.test(v)) { TL.toast('Le lien doit commencer par https://', 'bad'); return false; }
      try { localStorage.setItem(CLE_NUAGE, v); } catch (e) { /* stockage indisponible */ }
      window.open(v, '_blank', 'noopener'); TL.toast('Lien gardé. Glisse le fichier dans la page Nuage.', 'ok');
    } }]);
  }
  app.deposerSurNuage = deposerSurNuage;
  function about() {
    TL.modal('TechnoStudio ' + TL.VERSION, h('div.prose', { html: TL.md('Ateliers de technologie au format de la charte (feuilles P, ressources R, synthèse S, évaluation E, version SEGPA), simulations, programmation de cartes.\n\nFonctionne hors ligne ; se connecte à la **Centrale élèves** (code élève, ateliers reçus, sauvegarde, suivi) selon le **descripteur de passerelle ' + TL.descriptor.version + '** (format ' + TL.descriptor.format + ').') }), [{ label: 'Fermer', primary: true }]);
  }
  function shortcuts() {
    TL.modal('Raccourcis clavier', h('table.simple', h('tbody', [['← / →', 'Feuille précédente / suivante'], ['Ctrl O', 'Bibliothèque'], ['Échap', 'Fermer un menu ou une fenêtre'], ['Double-clic sur un titre de panneau', 'Replier / déplier'], ['Glisser le titre d’un panneau', 'Le déplacer']].map(([k, v]) => h('tr', h('td.mono', k), h('td', v))))), [{ label: 'Fermer', primary: true }]);
  }
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable],.injectionDiv')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); app.go('accueil'); }
    if (app.step && !e.ctrlKey && !e.metaKey && !e.altKey) { if (e.key === 'ArrowRight') app.step(1); if (e.key === 'ArrowLeft') app.step(-1); }
  });

  // compatibilité avec l'ancienne API (aperçus de l'éditeur, tableau de bord)
  TL.renderBlock = (b, pg, onResult, opts) => TL.renderSheetBlock(b, { pg, onResult, readonly: opts && opts.readonly, layers: {} });

  function onboarding() {
    return new Promise((resolve) => {
      let res = resolve;
      const Z = TL.centrale;
      const name = h('input.field', { type: 'text', placeholder: 'ex. Léa Martin', autocomplete: 'name', 'aria-label': 'Prénom et nom' });
      let role = 'eleve';
      const roles = h('div.rolepick', [['eleve', 'Élève', 'Je fais les ateliers'], ['prof', 'Enseignant', 'Je crée et je diffuse']].map(([v, t, d]) => {
        const b = h('button.rolebtn' + (v === role ? '.on' : ''), { type: 'button', 'aria-pressed': String(v === role), onclick: () => { role = v; TL.$$('.rolebtn', roles).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); } }, h('strong', t), h('small', d));
        return b;
      }));
      const finir = async (profil) => { app.profile = Object.assign({ classe: '', createdAt: Date.now() }, profil); await TL.db.set('profile', app.profile); res(); };
      const zone = h('div.centrale-zone');
      const sans = h('details.onb-sans', h('summary', Z.dispo ? 'Continuer sans code' : 'Commencer'),
        h('label', 'Prénom et nom', name), h('div.p-label', 'Tu es'), roles,
        h('div.actions', h('button.btn.ghost', { type: 'button', onclick: async () => { await finir({ name: name.value.trim() || (role === 'prof' ? 'Enseignant' : 'Élève'), role }); m.close(); } }, Z.dispo ? 'Commencer sans code' : 'Commencer')));
      const m = TL.modal('Bienvenue dans TechnoStudio', h('div.form.onb',
        h('p', 'Tes ateliers de technologie, en classe ou à la maison, même sans internet.'),
        Z.dispo ? h('div.onb-code', zone) : h('p.small.muted', 'La Centrale n’est pas joignable d’ici : tout fonctionne et reste sur cet appareil.'),
        sans), []);
      if (!Z.dispo) sans.open = true;
      // Formulaire « Mon code » fourni par la Centrale
      Z.afficherConnexion(zone, async () => {
        app.profile = app.profile || { name: Z.user ? Z.user.name : 'Élève', role: 'eleve', classe: Z.user ? Z.user.classe : '', createdAt: Date.now() };
        await TL.db.set('profile', app.profile); m.close(); res();
      });
      m.el.querySelector('.modal-head button').remove();
      // Cette fenêtre ne se ferme qu'avec la connexion ou « sans code » (pas de clic à côté ni Échap)
      const garde = (e) => { if (e.type === 'mousedown' ? e.target === m.el.parentNode : e.key === 'Escape') e.stopImmediatePropagation(); };
      m.el.parentNode.addEventListener('mousedown', garde, true);
      window.addEventListener('keydown', garde, true);
      const fin = res; res = () => { window.removeEventListener('keydown', garde, true); fin(); };
    });
  }

  app.start = async function () {
    try { const t = localStorage.getItem('tl-theme'); if (t && t !== 'auto') document.documentElement.dataset.theme = t; } catch (e) { /* rien */ }
    const depuisPortail = /(^|[#&])centrale=/.test(location.hash) || /^#activite=/.test(location.hash);   // ou lien direct vers un atelier
    app.profile = await TL.db.get('profile');
    if (!app.profile && window.TL_DEFAULT_PROFILE) app.profile = Object.assign({ createdAt: Date.now() }, window.TL_DEFAULT_PROFILE);
    if (!app.profile && depuisPortail) app.profile = { name: 'Élève', role: 'eleve', classe: '', createdAt: Date.now() };
    if (app.profile) { try { await TL.db.set('profile', app.profile); } catch (e) { /* mémoire */ } }
    await TL.panels.load();
    await app.loadWorkshops();
    const centrale = TL.centrale.init(); // en parallèle : l'appli s'affiche sans attendre le réseau
    drawSync();
    window.addEventListener('hashchange', route);
    TL.on('synced', () => { drawSync(); TL.menubar.render(menus()); });
    if (!app.profile) { route(); await centrale; await onboarding(); drawSync(); }
    route();
    centrale.then(() => { drawSync(); TL.menubar.render(menus()); });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) && !window.TL_NO_SW) navigator.serviceWorker.register('sw.js').catch(() => {});
  };
})();
