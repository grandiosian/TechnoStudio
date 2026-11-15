/* TechnoStudio — application : barre de menus, plan de travail, panneaux,
   bibliothèque, lecteur de feuilles, fiche pédagogique, compte, passerelle. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;

  const app = (TL.app = { profile: null, workshops: new Map(), catalog: [], progress: new Map(), layers: { comp: false, corr: false }, zoom: 1 });
  const stage = () => TL.$('#stage');
  /* Deux modes :
     • élève (par défaut, pour tous les élèves) : présentation minimale et parcours guidé (feuille en cours,
       questions qui se débloquent une à une, ressources à côté) ; le travail est enregistré comme avant ;
     • enseignant (admin) : toute l'interface et toutes les options d'affichage. On y entre avec la clé enseignant,
       vérifiée par le serveur de compilation ; « Aperçu élève » montre la présentation des élèves. */
  // Ouvert depuis le portail élève de la Centrale (app.eleveCentrale) : toujours l'interface élève, même si ce navigateur
  // a aussi une session de l'espace enseignant (l'enseignant qui « teste à la place d'un élève »).
  const vraiProf = () => !app.eleveCentrale && (!!app.enseignantCentrale || !!(app.profile && app.profile.role === 'prof'));
  const isProf = () => vraiProf() && !app.apercu;
  const eleveUI = () => !!app.seul || !isProf();
  app.eleveUI = eleveUI; app.vraiProf = vraiProf;

  /* Mode « atelier seul » : ?atelier=<id> (ou <id>/<feuille>, ou &feuille=P2). Pour un lien court donné en classe :
     interface réduite au strict minimum (l'atelier et ses feuilles, pas à pas), aucune connexion à la Centrale,
     aucun profil, et rien n'est enregistré (ni sur le poste ni sur un serveur) : un rechargement repart de zéro. */
  app.seul = (() => {
    try {
      const q = new URLSearchParams(location.search), v = (q.get('atelier') || '').trim();
      if (!v) return null;
      const [id, f] = v.split('/');
      const feuille = (f || q.get('feuille') || '').trim();
      return { id, feuille, segpa: q.get('segpa') === '1' || /^(s·|s\.|sp)/i.test(feuille) };
    } catch (e) { return null; }
  })();

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
    const pg = (app.seul ? null : await TL.db.get('pg:' + id)) || { wid: id, step: 0, answers: {}, seen: {}, startedAt: null, updatedAt: 0 };
    pg.answers = pg.answers || {}; pg.seen = pg.seen || {};
    app.progress.set(id, pg);
    return pg;
  };
  const writes = {};
  app.saveProgress = function (pg) {
    pg.updatedAt = Date.now();
    if (!pg.startedAt) pg.startedAt = pg.updatedAt;
    hist.noter('pg:' + pg.wid);   // annuler / rétablir : un pas si les réponses ont changé
    if (app.seul) { TL.emit('progress', pg); return; } // atelier seul : en mémoire seulement
    clearTimeout(writes[pg.wid]);
    writes[pg.wid] = setTimeout(() => TL.db.set('pg:' + pg.wid, pg), 0);
    TL.centrale.sauver(pg);
    TL.emit('progress', pg);
  };

  /* ================= Annuler / rétablir ================= */
  /* Historique du travail de la vue en cours : dans le lecteur, les réponses de l'élève à l'atelier ouvert (pg.answers :
     textes, cases cochées, dessins, programmes…) ; dans l'éditeur, l'atelier entier. La vue « branche » une source :
     lire() rend l'état (texte JSON), ecrire(état) le remet, l'enregistre par le chemin habituel (poste et Centrale)
     et redessine. Chaque changement noté garde l'état d'avant ; des changements rapprochés (moins de 600 ms : un mot
     tapé) ne font qu'un pas. 50 pas au plus par atelier, en mémoire pour la séance (rien n'est enregistré). */
  const HIST_MAX = 50, HIST_GROUPE = 600, HIST_POIDS = 30e6;
  const hist = (TL.historique = { source: null, piles: new Map(), calmeJusque: 0 });
  hist.brancher = function (cle, lire, ecrire) {
    let p = hist.piles.get(cle);
    if (!p) hist.piles.set(cle, (p = { annuler: [], retablir: [], base: '', t: 0 }));
    p.base = lire(); p.t = 0;
    hist.source = { cle, lire, ecrire, p };
    hist.maj();
  };
  hist.debrancher = function () { hist.source = null; hist.maj(); };
  // Quelques instants où l'état peut bouger sans geste de l'utilisateur (un champ qui se redessine et s'enregistre
  // de lui-même : Blockly, ordre tiré au sort…) : l'état de départ suit, sans faire de pas ni vider « Rétablir ».
  hist.calme = function (ms) { hist.calmeJusque = Math.max(hist.calmeJusque, Date.now() + (ms || 0)); };
  hist.noter = function (cle) {
    const S = hist.source; if (!S || (cle && cle !== S.cle)) return;
    const p = S.p, etat = S.lire();
    if (etat === p.base) return;
    const t = Date.now();
    if (t < hist.calmeJusque) { p.base = etat; return; }
    if (!p.annuler.length || t - p.t > HIST_GROUPE) {
      p.annuler.push(p.base);
      let poids = p.annuler.reduce((n, x) => n + x.length, 0);   // ateliers avec images : on borne aussi la mémoire
      while (p.annuler.length > HIST_MAX || (poids > HIST_POIDS && p.annuler.length > 1)) poids -= p.annuler.shift().length;
    }
    p.retablir = [];
    p.base = etat; p.t = t;
    hist.maj();
  };
  function histBouger(de, vers) {
    const S = hist.source; if (!S) return;
    const p = S.p;
    hist.noter(S.cle);   // un changement pas encore noté devient un pas
    if (!p[de].length) return;
    const etat = p[de].pop();
    p[vers].push(p.base);
    p.t = 0;
    hist.calme(800);
    try { S.ecrire(etat); } catch (e) { console.error(e); }
    p.base = S.lire();   // ecrire peut retoucher l'état (réponses datées pour la Centrale)
    hist.maj();
  }
  // travail rechargé de la Centrale (fusionné sur place) : c'est le nouveau point de départ, pas un geste à annuler
  TL.on('synced', () => { const S = hist.source; if (S) S.p.base = S.lire(); });
  hist.annuler = () => histBouger('annuler', 'retablir');
  hist.retablir = () => histBouger('retablir', 'annuler');
  hist.maj = function () {
    const p = hist.source && hist.source.p, a = TL.$('#bAnnuler'), r = TL.$('#bRetablir');
    if (a) a.disabled = !(p && p.annuler.length);
    if (r) r.disabled = !(p && p.retablir.length);
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
  /* Mode atelier (SPECIFICATION de la Centrale §2.6) : ouvert depuis le portail, l'élève reste sur son atelier. Règles de
     l'atelier (TL.passerelle.interfaceAtelier, publiées dans ateliers.json) : menu du logo, bibliothèque, niveau. */
  app.regleAtelier = (cle) => {
    if (!app.eleveCentrale || app.seul || app.apercu) return true;
    const P = TL.passerelle;
    return !(P && P.interfaceAtelier) || P.interfaceAtelier(cur())[cle] !== false;
  };
  app.versPortail = () => { const C = window.Centrale; if (C && C.allerPortail && C.allerPortail()) return; if (C && C.retour) C.retour(); };
  // Élève : barre réduite (logo et son petit menu ; le lecteur y ajoute l'atelier et ses feuilles). Atelier seul : dessinée par le lecteur.
  const renderMenus = () => {
    if (!app.seul) {
      if (eleveUI()) { if (!/^#at-/.test(location.hash)) barreEleve(); }
      else TL.menubar.render(menus());
    }
    drawAtelier();
  };
  function menuEleve() {
    return [
      { label: 'Mes ateliers', action: () => app.go('accueil') },
      { label: TL.centrale.connecte() ? 'Mon compte (' + TL.centrale.user.name + ')' : 'Me connecter avec mon code…', action: () => (TL.centrale.connecte() ? app.go('compte') : app.connexion()) },
      { sep: true },
      app.apercu ? { label: '← Revenir au mode enseignant', action: () => { app.apercu = false; route(); } } : app.eleveCentrale ? null : { label: 'Mode enseignant…', action: () => app.modeEnseignant() },
      { label: 'À propos de TechnoStudio', action: about },
    ].filter(Boolean);
  }
  function barreEleve() {
    TL.menubar.render([{ brand: h('span.brandmark', TL.brandSvg(), h('span', 'Techno', h('b', 'Studio'))), items: menuEleve }]);
    if (!app.regleAtelier('menu')) { const b = TL.$('#menus .brand-btn'); if (b) { b.disabled = true; b.removeAttribute('aria-haspopup'); } }   // mode atelier : pas de menu du logo
    if (app.apercu) TL.$('#menus').append(h('span.apercu-tag', { title: 'Vous voyez TechnoStudio comme un élève' }, 'Aperçu', h('span.apercu-plus', ' élève')));
  }
  /* Roue dentée (à droite de la barre) : thème, profil et connexion, mode enseignant. */
  function menuReglages() {
    const theme = document.documentElement.dataset.theme || 'auto';
    const mode = app.apercu ? [{ label: '← Revenir au mode enseignant', action: () => { app.apercu = false; route(); } }]
      : vraiProf() ? [{ label: 'Aperçu élève (présentation et parcours des élèves)', action: () => { app.apercu = true; if (TL.panels.close) TL.panels.close(); route(); } }, { label: 'Quitter le mode enseignant', action: () => app.quitterEnseignant() }]
        : app.eleveCentrale ? [] : [{ label: 'Mode enseignant…', action: () => app.modeEnseignant() }];   // élève venu du portail : pas d'accès enseignant
    return [
      { head: 'Thème' },
      ...[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => ({ label: l, check: theme === k, action: () => setTheme(k) })),
      { sep: true },
      { label: 'Profil et connexion…', action: () => app.go('compte') },
      ...mode,
      { sep: true },
      { label: 'À propos de TechnoStudio', action: about },
    ];
  }
  /* Mode enseignant par la Centrale : TechnoStudio copié sur le serveur de la Centrale (…/miroir/technostudio/)
     est sur le même site que l'espace enseignant ; il lui demande si ce navigateur y est connecté. */
  const baseCentrale = () => (/\/miroir\//.test(location.pathname) ? location.origin + location.pathname.split('/miroir/')[0] + '/' : null);
  app.sessionEnseignant = async function () {
    const base = baseCentrale(); if (!base) return null;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch(base + 'api/enseignant.php', { credentials: 'same-origin', cache: 'no-store', signal: ctl.signal }); clearTimeout(t);
      if (!r.ok) return null;
      return !!(await r.json()).enseignant;
    } catch (e) { return null; }
  };
  app.modeEnseignant = function () {
    const base = baseCentrale();
    const etat = h('p.small.muted');
    const verifier = async () => {
      etat.textContent = 'Vérification…';
      const ok = await app.sessionEnseignant();
      if (ok) { app.enseignantCentrale = true; app.apercu = false; m.close(); TL.toast('Mode enseignant : toutes les options sont disponibles.', 'ok'); drawSync(); route(); }
      else etat.textContent = ok === false ? 'Pas encore connecté à l’espace enseignant de ce navigateur.' : 'La Centrale ne répond pas.';
    };
    const principal = base
      ? h('div', h('p', 'Connecte-toi à l’**espace enseignant** de la Centrale avec ton mot de passe, puis reviens ici.'.replace(/\*\*(.+?)\*\*/g, '$1')),
        h('div.actions', h('a.btn.primary', { href: base + 'admin/', target: '_blank', rel: 'noopener' }, 'Ouvrir l’espace enseignant'), h('button.btn.ghost', { type: 'button', onclick: verifier }, 'C’est fait : vérifier')), etat)
      : h('div', h('p', 'Le mode enseignant s’ouvre depuis la Centrale : espace enseignant → bouton « TechnoStudio · enseignant ».'),
        h('div.actions', h('a.btn.primary', { href: 'https://technoversailles.alwaysdata.net/admin/', target: '_blank', rel: 'noopener' }, 'Ouvrir l’espace enseignant')));
    // Secours (Centrale injoignable, autre adresse) : la clé du serveur de compilation
    const champ = h('input.field', { type: 'password', autocomplete: 'off', placeholder: 'clé de secours', 'aria-label': 'Clé de secours' });
    const msg = h('p.small.muted', 'La clé du serveur de compilation (~/technostudio-compilation/config.json).');
    const valider = async () => {
      const cle = champ.value.trim();
      if (cle.length < 12) { msg.textContent = 'Clé trop courte.'; return; }
      msg.textContent = 'Vérification…';
      let ok = await TL.flash.verifierCle(cle);
      if (ok === null) { let gardee = ''; try { gardee = localStorage.getItem('ts-compilateur-cle') || ''; } catch (e) { /* rien */ } ok = gardee !== '' && gardee === cle; if (!ok) { msg.textContent = 'Serveur injoignable : impossible de vérifier la clé pour le moment.'; return; } }
      if (!ok) { msg.textContent = 'Clé refusée.'; champ.select(); return; }
      try { localStorage.setItem('ts-compilateur-cle', cle); } catch (e) { /* rien */ }
      app.profile = Object.assign(app.profile || { name: 'Enseignant', classe: '', createdAt: Date.now() }, { role: 'prof', profOk: true });
      await TL.db.set('profile', app.profile);
      app.apercu = false; m.close();
      TL.toast('Mode enseignant : toutes les options sont disponibles.', 'ok');
      drawSync(); route();
    };
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
    const secours = h('details.ens-secours', h('summary', 'Clé de secours'), h('div.form', champ, msg, h('div.actions', h('button.btn.small', { type: 'button', onclick: valider }, 'Entrer avec la clé'))));
    const m = TL.modal('Mode enseignant', h('div.form', principal, secours), [{ label: 'Fermer' }]);
  };
  app.quitterEnseignant = async function () {
    const parCentrale = !!app.enseignantCentrale;
    app.enseignantCentrale = false;
    if (app.profile) { app.profile.role = 'eleve'; app.profile.profOk = false; await TL.db.set('profile', app.profile); }
    app.apercu = false;
    TL.toast(parCentrale ? 'Mode élève. Pour que ce poste reste en mode élève, déconnecte-toi aussi de l’espace enseignant de la Centrale.' : 'Mode élève.');
    drawSync(); route();
  };
  function menus() {
    if (app.seul) return [];
    const w = cur();
    const modeItems = [{ sep: true }, { label: 'Aperçu élève (présentation et parcours des élèves)', action: () => { app.apercu = true; if (TL.panels.close) TL.panels.close(); route(); } }, { label: 'Quitter le mode enseignant', action: () => app.quitterEnseignant() }];
    const mode = (location.hash.match(/^#([a-z]+)/) || [, 'accueil'])[1];
    return [
      { brand: h('span.brandmark', TL.brandSvg(), h('span', 'Techno', h('b', 'Studio'))), items: [
        { label: 'À propos de TechnoStudio', action: about },
        { sep: true }, { label: 'Profil et connexion…', action: () => app.go('compte') },
        ...modeItems,
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
        { label: 'Copier le lien d’essai (atelier seul, sans enregistrement)…', hidden: !isProf(), action: () => w && lienEssai(w) },
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
  /* Barre du haut commune aux applications de la Centrale (même disposition que NetSim et Établi 3D) :
     à gauche le logo et ses menus, puis le widget de l'élève (« ← » et identifiant) ; au centre l'atelier en cours ;
     à droite le thème et les réglages. */
  const icone = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = d; return s; };
  const ICO = {
    personne: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    lune: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  };
  /* Widget de l'élève : « Visiteur », ou son identifiant une fois connecté à la Centrale (clic : « Mon code » ou son compte).
     Le bouton « ← » est placé à sa gauche : étape précédente du parcours, sinon « Mes ateliers » (portail). */
  function drawSync() {
    const widget = TL.$('#widgetCentrale'), moi = TL.$('#bCentrale');
    if (!widget || !moi) return;
    moi.innerHTML = '';
    if (app.seul) {
      moi.className = 'tbid-moi st-local seul-note'; moi.onclick = null; moi.setAttribute('aria-disabled', 'true');
      moi.title = 'Atelier en mode essai : les réponses restent dans cette page et disparaissent si on la recharge ou la ferme.';
      moi.append(h('span.sync-dot'), h('span.sync-txt', 'Rien n’est enregistré'));
      return;
    }
    const Z = TL.centrale, on = Z.connecte(), st = on ? Z.status : 'local';
    const etatTxt = { online: 'enregistré', offline: 'hors ligne', syncing: 'enregistrement…', error: 'à vérifier' }[st] || 'sur cet appareil';
    moi.className = 'tbid-moi st-' + (st === 'indispo' ? 'local' : st);
    moi.append(icone(ICO.personne), h('span.tbid-nom', on ? Z.user.name : 'Visiteur'), on ? h('span.sync-dot') : null);
    moi.title = Z.message || (on ? 'Connecté à la Centrale ' + Z.serveur.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' : travail ' + etatTxt + (Z.lastSync ? ' (' + TL.fmtDate(Z.lastSync) + ')' : '') + '. Clic : retour sur la Centrale.'
      : 'Visiteur : ton travail est enregistré sur cet appareil. Clique pour te connecter avec ton code élève (Mon code).');
    moi.setAttribute('aria-label', on ? 'Mon compte : ' + Z.user.name + ', travail ' + etatTxt : 'Visiteur : me connecter avec mon code');
    // connecté : retour sur la Centrale (le compte et le surnom se gèrent sur le portail) ; module plus ancien : le menu
    // de l'élève commun, sinon la page « Compte » ; visiteur : se connecter avec son code
    moi.onclick = (e) => {
      e.stopPropagation();
      if (!Z.connecte()) { app.connexion(); return; }
      const C = window.Centrale;
      if (C && C.allerPortail && C.allerPortail()) return;
      const ouvert = C && C.menuEleve && C.menuEleve(moi, {
        liens: [{ texte: 'Mon compte et mes réglages…', action: () => app.go('compte') },
          { texte: 'Se déconnecter', classe: 'cme-sortir', action: async () => { await Z.deconnexion(); TL.toast('Déconnecté : ton travail reste sur cet appareil.'); } }],
        deconnexion: false,
        onChange: () => drawSync(),
      });
      if (!ouvert) app.go('compte');
    };
    // « ← » : bouton partagé du module de la Centrale s'il le propose, sinon l'ancien « ← Mes ateliers » (Centrale.retour)
    const ret = widget.querySelector('.tbid-ret');
    const P = Z.boutonPrecedent ? Z.boutonPrecedent() : null;
    if (P) { if (ret !== P.bouton) { if (ret) ret.remove(); widget.prepend(P.bouton); } }
    else if (Z.lienPortail()) {
      if (!ret) widget.prepend(h('button.tbid-ret.mb-retour', { type: 'button', title: 'Revenir à tous tes ateliers sur la Centrale (ton travail est enregistré)', 'aria-label': 'Mes ateliers', onclick: (e) => { e.stopPropagation(); window.Centrale.retour(); } },
        h('span', { 'aria-hidden': 'true' }, '←'), h('span.centrale-precedent-txt', 'Mes ateliers')));
    } else if (ret) ret.remove();
  }
  /* Feuilles comptées dans l'avancement : celles de la série en cours (normale ou SEGPA), sans les ressources. */
  function feuillesAtelier(w, pg) {
    const s0 = pg && w.steps[pg.step], segpa = !!(s0 && s0.segpa);
    let idx = w.steps.map((s, i) => i).filter((i) => w.steps[i].kind !== 'ressource');
    if (idx.some((i) => !!w.steps[i].segpa === segpa)) idx = idx.filter((i) => !!w.steps[i].segpa === segpa);
    return idx.map((i) => ({ fait: !!TL.stepDone(w.steps[i], pg), ici: !!pg && i === pg.step }));
  }
  /* Centre de la barre : l'atelier en cours, en clair — pastille de niveau, « Atelier » et son titre | « Feuille » et son
     code, petites barres (une par feuille) et « 1/5 feuilles faites » —, « Choisis un atelier » sinon. Le choix de la
     feuille et 📚 Ressources sont dans la sous-barre du lecteur, juste en dessous (viewPlayer). */
  function drawAtelier() {
    const zone = TL.$('#tbAtelier'); if (!zone) return;
    const w = cur();
    const b = w && app.barre && app.barre.wid === w.id ? app.barre : null;
    let pill;
    if (!w) pill = app.seul ? null : h('button.tbres.tb-at.tb-choix', { type: 'button', title: 'Voir mes ateliers', onclick: () => app.go('accueil') }, h('span.tpnom', 'Choisis un atelier'));
    else {
      const feuilles = b ? b.feuilles() : feuillesAtelier(w, app.progress.get(w.id));
      const faites = feuilles.filter((f) => f.fait).length, n = feuilles.length;
      const code = b && b.code ? b.code() : '';
      // les petites étiquettes (.tb-lbl) sont les premières à disparaître faute de place (palier serre-2)
      const kids = [TL.pastille(w), h('span.tb-lbl', 'Atelier'), h('span.tpnom', w.title),
        code || n ? h('span.tb-sep', { 'aria-hidden': 'true' }) : null,
        code ? h('span.tb-lbl', 'Feuille') : null, code ? h('span.tpcn', code) : null,
        n && n <= 14 ? h('span.tb-barres', { 'aria-hidden': 'true' }, feuilles.map((f) => h('i' + (f.fait ? '.on' : '') + (f.ici ? '.ici' : '')))) : null,
        n ? h('span.tbpct', faites + '/' + n, h('span.tb-lbl', n > 1 ? ' feuilles faites' : ' feuille faite')) : null];
      const resume = 'Atelier « ' + w.title + ' »' + (code ? ' · feuille ' + code : '') + (n ? ' · ' + faites + ' feuille' + (faites > 1 ? 's' : '') + ' faite' + (faites > 1 ? 's' : '') + ' sur ' + n : '');
      // atelier seul (lien d'essai) : la pastille nomme l'atelier, sans clic ; ouvert depuis le portail de la Centrale,
      // elle ramène au portail (« Mes ateliers ») ; sinon, elle ouvre la bibliothèque de TechnoStudio
      const portail = !app.seul && app.eleveCentrale;
      const versPortail = app.versPortail;
      const attrs = { style: '--cl:' + TL.niveauColor(w), title: resume + (app.seul ? '' : portail ? ' · retour à mes ateliers, sur la Centrale' : ' · voir mes ateliers'), 'aria-label': resume };
      pill = app.seul ? h('div.tbres.tb-at', attrs, ...kids) : h('button.tbres.tb-at', Object.assign({ type: 'button', onclick: portail ? versPortail : () => app.go('accueil') }, attrs), ...kids);
    }
    const old = zone.querySelector('.tb-at');
    if (old && pill) old.replaceWith(pill); else if (old) old.remove(); else if (pill) zone.prepend(pill);
    placerCentre();
  }
  app.majAtelier = drawAtelier;
  /* Rien ne doit se chevaucher, et le thème et les réglages (à droite) restent toujours visibles. Faute de place, la barre
     se resserre par paliers (classes serre-1 … serre-8 de .menubar, voir app.css), du moins utile au plus utile :
     1 le logo seul (sans le texte « TechnoStudio ») · 2 les petites étiquettes de l'atelier (« Atelier », « Feuille »,
     « feuilles faites »), « Aperçu » court · 3 texte du « ← », feuille et barres de l'atelier · 4 compteur
     « faites/total », marges réduites · 5 pastille de l'atelier · 6 nom de l'élève et « Aperçu » · 7 bouton de l'élève
     (le « ← » reste) · 8 tout le centre. Le titre de l'atelier reste jusqu'au palier 7 : coupé avec « … », il peut
     descendre à 48 px à partir du palier 3.
     Annuler / rétablir restent toujours (ils sont avant le widget de l'élève, compté dans le côté gauche).
     À chaque palier, l'atelier est placé au milieu de la barre (comme NetSim), ou au plus près s'il toucherait un côté. */
  const SERRE = 8;
  function placerCentre() {
    const bar = TL.$('.menubar'), zone = TL.$('#tbAtelier'), gauche = TL.$('#widgetCentrale'), droite = TL.$('.menubar .mb-right'), menus = TL.$('#menus');
    if (!bar || !zone || !gauche || !droite) return;
    const deborde = (el) => !!el && el.offsetWidth > 0 && el.scrollWidth > el.clientWidth + 1;
    const tient = (n) => {
      const b = bar.getBoundingClientRect(), g = gauche.getBoundingClientRect(), d = droite.getBoundingClientRect();
      if (d.right > b.right + 1 || g.right > d.left - 6 || deborde(menus)) return false;
      if (!zone.offsetWidth) return true;
      const z = zone.getBoundingClientRect();
      if (z.left < g.right + 5.5 || z.right > d.left - 5.5 || deborde(zone)) return false;   // demi-pixel de marge (arrondis)
      const pill = zone.querySelector('.tb-at');
      if (deborde(pill)) return false;
      const nom = pill && pill.offsetWidth ? pill.querySelector('.tpnom') : null;
      return !(nom && nom.scrollWidth > nom.clientWidth + 1 && nom.clientWidth < (n >= 3 ? 48 : 90));   // titre trop coupé (ou réduit à rien) : palier suivant
    };
    // l'atelier au milieu de la barre ; s'il touche un côté, glissé juste ce qu'il faut (au plus près du milieu)
    // tant que le nom « TechnoStudio » est affiché (palier 0), l'atelier doit être pile au milieu ; sinon, logo seul d'abord
    const placer = (n) => {
      zone.classList.add('au-milieu'); zone.style.left = '';
      // l'atelier ne dépasse pas la place libre entre les deux côtés : son titre se coupe avec « … » au lieu de tout cacher
      const g0 = gauche.getBoundingClientRect(), d0 = droite.getBoundingClientRect();
      zone.style.maxWidth = Math.max(0, Math.floor(d0.left - g0.right - 14)) + 'px';   // 6 px de chaque côté, plus 1 px pour les arrondis
      if (!zone.offsetWidth) return n >= SERRE || !zone.querySelector('.tb-at') ? tient(n) : false;   // atelier écrasé faute de place : palier suivant
      const b = bar.getBoundingClientRect(), g = gauche.getBoundingClientRect(), d = droite.getBoundingClientRect(), w = zone.offsetWidth;
      const mini = g.right - b.left + 6 + w / 2, maxi = d.left - b.left - 6 - w / 2;
      if (mini > maxi || (n === 0 && (mini > b.width / 2 + 1 || maxi < b.width / 2 - 1))) return false;
      zone.style.left = Math.min(Math.max(b.width / 2, mini), maxi) + 'px';
      return tient(n);
    };
    for (let n = 0; n <= SERRE; n++) {
      for (let k = 1; k <= SERRE; k++) bar.classList.toggle('serre-' + k, k <= n);
      if (placer(n)) return;
    }
  }
  let rafCentre = 0;
  const replacer = () => { cancelAnimationFrame(rafCentre); rafCentre = requestAnimationFrame(placerCentre); };
  window.addEventListener('resize', replacer);
  /* À droite : bouton du thème (clair / sombre) et roue dentée des réglages. */
  const themeSombre = () => (document.documentElement.dataset.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  function drawTheme() {
    TL.$$('[data-theme-btn]').forEach((b) => {
      const sombre = themeSombre();
      b.replaceChildren(icone(sombre ? ICO.soleil : ICO.lune));
      b.title = sombre ? 'Passer en thème clair' : 'Passer en thème sombre';
      b.setAttribute('aria-label', b.title);
      b.onclick = (e) => { e.stopPropagation(); setTheme(themeSombre() ? 'light' : 'dark'); };
    });
  }
  function initBarre() {
    drawTheme();
    const bA = TL.$('#bAnnuler'), bR = TL.$('#bRetablir');
    if (bA) bA.onclick = (e) => { e.stopPropagation(); hist.annuler(); };
    if (bR) bR.onclick = (e) => { e.stopPropagation(); hist.retablir(); };
    hist.maj();
    // le « ← » apparaît plus tard (module de la Centrale), les polices se chargent : la barre se recalcule
    try { const ro = new ResizeObserver(replacer); ['#widgetCentrale', '#menus'].forEach((s) => TL.$(s) && ro.observe(TL.$(s))); } catch (e) { /* ancien navigateur */ }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(replacer).catch(() => {});
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawTheme); } catch (e) { /* ancien navigateur */ }
    const b = TL.$('#bReglages'); if (!b) return;
    if (app.seul) { b.hidden = true; return; }   // atelier seul : le strict minimum (le thème reste)
    const ouvrir = (focus) => TL.menubar.ouvrir('reglages', b, menuReglages, focus);
    b.onclick = (e) => { e.stopPropagation(); if (TL.menubar.open === 'reglages') TL.menubar.close(); else ouvrir(); };
    b.onkeydown = (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); ouvrir(true); } };
  }
  TL.on('hub', () => { drawSync(); renderMenus(); });
  TL.on('ressources', () => { const b = TL.$('.sous-barre .seul-res'); if (b) b.setAttribute('aria-pressed', String(TL.ressources.isOpen())); });
  function setTheme(k) { if (k === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = k; try { localStorage.setItem('tl-theme', k); } catch (e) { /* stockage indisponible */ } renderMenus(); drawTheme(); }
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
    if (app.seul && location.hash !== '#at-' + app.seul.id) history.replaceState(null, '', location.pathname + location.search + '#at-' + app.seul.id);
    let hash = (location.hash || '#accueil').slice(1);
    if (!app.seul && eleveUI() && /^(ed-|fiche-|creer$|passerelle$|code$|circuit$|maquettes$)/.test(hash)) { history.replaceState(null, '', location.pathname + location.search + '#accueil'); hash = 'accueil'; }
    // #activite=<atelier> ou <atelier>/<feuille> : ouverture directe, même sans la Centrale
    if (/^activite=/.test(hash)) { let id = ''; try { id = decodeURIComponent(hash.slice(9).split('&')[0]); } catch (e) { /* adresse illisible */ } if (id) { await TL.centrale.ouvrirActivite(id); if (/^#activite=/.test(location.hash)) app.go('accueil'); return; } }
    app.barre = null;   // atelier en cours (centre de la barre) : renseigné par le lecteur
    hist.debrancher();  // annuler / rétablir : la nouvelle vue branche sa propre source (lecteur, éditeur)
    renderMenus();
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
    renderMenus();
  }
  app.route = route;
  app.go = (hash) => {
    if (hash === 'accueil' && !app.regleAtelier('bibliotheque')) { app.versPortail(); return; }   // mode atelier : retour au portail plutôt que la bibliothèque
    if (location.hash === '#' + hash) route(); else location.hash = hash;
  };
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
    if (eleveUI()) TL.panels.setMode('accueil-eleve', [], []);
    else TL.panels.setMode('accueil', ['bib-filtres', 'bib-reprendre'], ['bib-filtres', 'bib-reprendre']);
    const grid = h('div.covers');
    const p = app.profile || {};
    desk.append(h('header.desk-head', h('p.eyebrow', TL.centrale.user ? 'Centrale · ' + TL.centrale.user.classe : 'Sur cet appareil'), h('h1', 'Bonjour ' + (p.name || '') + '.'), h('p.lede', eleveUI() ? 'Choisis un atelier.' : 'Choisis un atelier. Les panneaux se déplacent par leur titre et se rouvrent depuis le menu Affichage.')), grid);
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
    const codes = TL.sheetCodes(w);
    /* Mode élève guidé (atelier seul) : la série de l'élève (normale ou SEGPA), seulement la feuille en cours
       et celles déjà faites ; les ressources s'ouvrent à côté ; les questions se débloquent une à une. */
    const demande = app.seul || (app.demande && app.demande.id === w.id ? app.demande : null);
    if (app.demande && app.demande.id === w.id) app.demande = null;   // la feuille demandée (portail) ne sert qu'à l'ouverture
    const G = eleveUI() ? guide(w, pg, codes, demande || {}) : null;
    let choix = null, btnResG = null, boiteChoix = null, sousBarre = null;
    const resOpts = () => ({ segpa: !!(w.steps[pg.step] && w.steps[pg.step].segpa), pg });
    if (G) {
      /* Sous-barre, juste sous la barre du haut : le choix de la feuille (dès que la feuille suivante est débloquée)
         et 📚 Ressources (si l'atelier en a) ; absente si ni l'un ni l'autre. L'atelier lui-même est au centre de la
         barre du haut (drawAtelier). Le menu garde le focus : ses options sont refaites sur place (paintChoix). */
      choix = h('select.field.seul-feuille', { 'aria-label': 'Feuille', onchange: () => show(+choix.value) });
      boiteChoix = h('label.ssb-feuille', h('span.ssb-lbl', 'Feuille'), choix);
      btnResG = G.hasRes ? h('button.btn.small.seul-res', { type: 'button', title: 'Ouvrir ou fermer les documents ressources, à côté de la feuille', 'aria-pressed': String(TL.ressources.isOpen()), onclick: () => (TL.ressources.isOpen() ? TL.ressources.close() : TL.ressources.open(w, null, null, resOpts())) }, h('span', { 'aria-hidden': 'true' }, '📚'), h('span', 'Ressources')) : null;
      sousBarre = h('div.sous-barre', { role: 'toolbar', 'aria-label': 'Feuille et ressources', hidden: true }, h('div.ssb-in', boiteChoix, btnResG));
      board.before(sousBarre);
      if (app.seul) { const bar = TL.$('#menus'); bar.innerHTML = ''; bar.append(h('span.seul-brand', TL.brandSvg())); }
      else barreEleve();
      // ouverture : la feuille demandée, sinon la plus avancée des feuilles débloquées
      if (demande && demande.feuille) pg.step = G.parcours[G.base];
      else if (!G.ok(pg.step)) pg.step = G.parcours[G.maxOpen()];
    }
    app.barre = {
      wid: w.id,
      code: () => codes[pg.step] || '',
      feuilles: () => (G ? G.parcours.slice(G.base).map((si) => ({ fait: !!G.done(si), ici: si === pg.step })) : feuillesAtelier(w, pg)),
    };
    const paintChoix = () => {
      if (!choix) return;
      choix.innerHTML = '';
      const max = G.maxOpen();
      G.parcours.forEach((si, k) => { if (k >= G.base && k <= max) choix.append(h('option', { value: si }, codes[si] + ' · ' + w.steps[si].title)); });
      if (max < G.parcours.length - 1) choix.append(h('option', { value: '', disabled: true }, '🔒 La suite se débloque quand la feuille est finie'));
      choix.value = String(pg.step);
      // une seule feuille ouverte : pas de choix à faire ; ni choix ni ressources : pas de sous-barre
      boiteChoix.hidden = max <= G.base;
      sousBarre.hidden = boiteChoix.hidden && !btnResG;
    };
    let nav = null, wasDone = null;
    const buildNav = () => {
      let prev, next;
      if (G) { const k = G.parcours.indexOf(pg.step); prev = k > G.base ? G.parcours[k - 1] : null; next = k >= 0 && k < G.parcours.length - 1 ? G.parcours[k + 1] : null; }
      else { prev = pg.step > 0 ? pg.step - 1 : null; next = pg.step < w.steps.length - 1 ? pg.step + 1 : null; }
      const bloque = G && next != null && !G.done(pg.step);
      const el = h('nav.sheetnav',
        prev != null ? h('button.btn.ghost', { type: 'button', onclick: () => show(prev) }, '← ' + w.steps[prev].title) : h('span'),
        h('span.mono.small.muted', G ? 'Feuille ' + (G.parcours.indexOf(pg.step) - G.base + 1) + ' / ' + (G.parcours.length - G.base) : 'Feuille ' + (pg.step + 1) + ' / ' + w.steps.length),
        next != null ? h('button.btn.primary', { type: 'button', disabled: bloque, title: bloque ? 'Réponds à toutes les questions de la feuille pour passer à la suivante' : '', onclick: () => show(next) }, bloque ? '🔒 ' + w.steps[next].title : w.steps[next].title + ' →')
          : h('button.btn.primary', { type: 'button', onclick: () => finish(w, pg) }, 'Terminer l’atelier'));
      if (nav) nav.replaceWith(el);
      nav = el;
      return el;
    };
    let sheet = null, suivi = null;
    const afterResult = () => {
      TL.panels.refresh('feuilles'); TL.panels.refresh('suivi'); paintNote(); drawAtelier();
      if (!G) return;
      G.lock(sheet, w.steps[pg.step]);
      if (suivi) suivi.maj();   // questions débloquées déjà à l'écran : « vues » maintenant
      const fini = G.done(pg.step);
      if (fini !== wasDone) {
        buildNav(); paintChoix();
        if (fini && wasDone === false && G.parcours.indexOf(pg.step) < G.parcours.length - 1) TL.toast('Feuille terminée : la feuille suivante est débloquée.', 'ok');
      }
      wasDone = fini;
    };
    const show = (i) => {
      if (G && !G.ok(i)) return;
      pg.step = TL.clamp(i, 0, w.steps.length - 1);
      const s = w.steps[pg.step];
      if (!s) { board.innerHTML = ''; board.append(h('div.desk', h('p', 'Atelier vide.'))); return; }
      hist.calme(1000);   // la feuille se dessine : ses champs peuvent s'enregistrer d'eux-mêmes (pas un geste de l'élève)
      pg.seen[s.id] = true; app.saveProgress(pg);
      board.innerHTML = '';
      sheet = TL.renderSheet(w, s, pg.step, { pg, layers: app.layers, onResult: () => setTimeout(afterResult, 0) });
      sheet.style.zoom = app.zoom;
      // « ressource 8 », « document A »… : liens vers le volet des ressources, à côté de la feuille
      if (s.kind !== 'ressource') TL.ressources.linkify(sheet, { w, segpa: !!s.segpa, pg });
      nav = null;
      board.append(sheet, buildNav());
      if (G) { G.lock(sheet, s); wasDone = G.done(pg.step); paintChoix(); }
      // Mesures (temps actif, questions vues, essais) : js/mesures.js
      if (suivi) suivi.stop();
      suivi = TL.mesures ? TL.mesures.suivre(pg, s, sheet) : null;
      board.scrollTop = 0;
      paintNote();
      TL.panels.refresh('feuilles'); TL.panels.refresh('suivi');
      drawAtelier();
    };
    function paintNote() {
      const box = board.querySelector('[data-note]');
      if (!box) return;
      let pts = 0, got = 0, any = false;
      w.steps.filter((x) => x.kind === 'evaluation').forEach((x) => x.blocks.forEach((b) => { if (!TL.isGraded(b)) return; const p = b.bareme || 1; if (!b.bonus) pts += p; const a = pg.answers[b.id]; if (a && a.done) { any = true; got += p * (a.score || 0); } }));
      box.textContent = any && pts ? TL.fmtNum(Math.min(20, (got / pts) * 20), 1) + ' / 20' : '…… / 20';
    }
    app.step = (d) => {
      if (!G) { show(pg.step + d); return; }
      const k = G.parcours.indexOf(pg.step) + d, si = G.parcours[k];
      if (si != null && k >= G.base && G.ok(si)) show(si);
    };
    rerender = () => show(pg.step);
    /* Annuler / rétablir : les réponses de cet atelier. La Centrale fusionne réponse par réponse en gardant la plus
       récente (at) : chaque réponse remise est datée de maintenant, et une réponse retirée devient une réponse vide
       datée (sinon la copie du serveur la ferait revenir). Puis la feuille est redessinée, à la même hauteur. */
    hist.brancher('pg:' + w.id, () => JSON.stringify(pg.answers || {}), (etat) => {
      const avant = pg.answers || {}, apres = JSON.parse(etat), t = Date.now();
      Object.keys(avant).forEach((k) => { if (!(k in apres)) apres[k] = { at: t }; });
      Object.keys(apres).forEach((k) => { if (JSON.stringify(apres[k]) !== JSON.stringify(avant[k])) apres[k] = Object.assign({}, apres[k], { at: t }); });
      pg.answers = apres;
      app.saveProgress(pg);
      const haut = board.scrollTop, etait = pg.step;
      if (G && !G.ok(pg.step)) pg.step = G.parcours[G.maxOpen()];   // feuille de nouveau verrouillée : la plus avancée ouverte
      show(pg.step);
      if (pg.step === etait) board.scrollTop = haut;
    });

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
    if (G) TL.panels.setMode('seul', [], []);
    else TL.panels.setMode('atelier', ['feuilles', 'suivi'], ['feuilles', 'suivi']);
    show(pg.step);
  }
  /* Mode élève guidé : parcours (feuilles P, puis synthèse et évaluation) de la série de l'élève, feuille de départ
     (lien ?atelier=<id>/P2), une question n'est accessible que si la précédente a reçu une réponse. */
  function guide(w, pg, codes, o) {
    const fx = (o.feuille || '').toLowerCase();
    // série SEGPA : demandée par le lien, ou celle de la feuille où l'élève en est
    const segpa = !!(o.segpa || /^(s·|s\.|sp)/i.test(fx) || (!fx && w.steps[pg.step] && w.steps[pg.step].segpa));
    let serie = w.steps.map((s, i) => i).filter((i) => !!w.steps[i].segpa === segpa);
    if (!serie.length) serie = w.steps.map((s, i) => i);
    const parcours = serie.filter((i) => w.steps[i].kind !== 'ressource');
    const hasRes = TL.ressources.steps(w, segpa).length > 0;
    let base = 0;
    if (o.feuille) {
      const f = o.feuille.toLowerCase(), court = (x) => x.toLowerCase().replace(/^([a-z·]+)0*/, '$1');
      const k = parcours.findIndex((i) => w.steps[i].id.toLowerCase() === f || codes[i].toLowerCase() === f || court(codes[i]) === court(f));
      if (k >= 0) base = k;
    }
    // une question est « faite » : juste, corrigée, rendue, ou essayée deux fois (la correction est alors proposée)
    const faite = (b) => {
      if (!TL.isGraded(b)) return true;
      const a = pg.answers[b.id];
      if (!a) return false;
      if (b.type === 'procedure') return !!a.done;
      return !!(a.done || a.revealed || a.pendingReview || (a.attempts || 0) >= 2);
    };
    const done = (si) => w.steps[si].blocks.every(faite);
    const maxOpen = () => { let k = base; while (k < parcours.length - 1 && done(parcours[k])) k++; return k; };
    const ok = (si) => { const k = parcours.indexOf(si); return k >= base && k <= maxOpen(); };
    function lock(sheet, s) {
      if (!sheet) return;
      TL.$$('.lock-note', sheet).forEach((x) => x.remove());
      let ferme = false, note = false;
      s.blocks.forEach((b) => {
        const el = sheet.querySelector('.sb[data-id="' + CSS.escape(b.id) + '"]');
        if (!el) return;
        el.classList.toggle('is-locked', ferme); el.inert = ferme;
        if (ferme && !note) { el.before(h('div.lock-note', { role: 'note' }, '🔒 La suite se débloque quand tu as répondu à la question ci-dessus.')); note = true; }
        if (!ferme && !faite(b)) ferme = true;
      });
    }
    return { parcours, base, hasRes, done, maxOpen, ok, lock };
  }
  function finish(w, pg) {
    const st = TL.workshopStats(w, pg);
    if (!pg.completedAt && st.pct === 100) pg.completedAt = Date.now();
    app.saveProgress(pg);
    if (app.seul) {
      TL.modal(st.pct === 100 ? 'Atelier terminé' : 'Pas tout à fait fini', h('div.finish', h('div.finish-score', h('span.mono.big', st.score + ' %'), h('span.small.muted', 'score moyen sur ' + st.total + ' activités')),
        h('p', st.pct === 100 ? 'Bravo, tu as fait toutes les activités.' : 'Il reste ' + (st.total - st.done) + ' activité(s) : la liste des feuilles, en haut, te permet d’y revenir.'),
        h('p.small.muted', 'Atelier en mode essai : rien n’est enregistré.')), [{ label: 'Fermer', primary: true }]);
      return;
    }
    TL.modal(st.pct === 100 ? 'Atelier terminé' : 'Pas tout à fait fini', h('div.finish', h('div.finish-score', h('span.mono.big', st.score + ' %'), h('span.small.muted', 'score moyen sur ' + st.total + ' activités')),
      h('p', st.pct === 100 ? (TL.centrale.connecte() ? 'Ton travail est enregistré sur la Centrale : ton professeur voit ton avancement.' : 'Ton travail est enregistré sur cet appareil.') : 'Il reste ' + (st.total - st.done) + ' activité(s). Le panneau « Feuilles » montre celles qui sont terminées (✓).')),
    [{ label: 'Rester ici' }, { label: app.regleAtelier('bibliotheque') ? 'Bibliothèque' : 'Retour à mes ateliers', primary: true, onClick: () => app.go('accueil') }]);
  }
  // Lien « atelier seul » : l'élève n'a que l'atelier, rien n'est enregistré (essai en classe sans codes élèves)
  async function lienEssai(w) {
    const u = location.origin + location.pathname + '?atelier=' + encodeURIComponent(w.id);
    const champ = h('input.field.mono', { type: 'text', readonly: true, value: u, onfocus: (e) => e.target.select() });
    TL.modal('Lien d’essai pour la classe', h('div',
      h('p', 'Ce lien ouvre seulement « ' + w.title + ' », avec le strict minimum : les feuilles, pas à pas. Pas de connexion, pas de profil, rien n’est enregistré (recharger la page repart de zéro).'),
      champ,
      h('p.small.muted', 'Pour ouvrir directement une feuille, ajoute « /P2 » (ou /R1…) après l’identifiant. Un raccourcisseur d’adresse peut en faire un lien court.'),
      w.source !== 'demo' ? h('p.callout.warn', 'Cet atelier n’est que sur ce poste : publie-le avec l’application (dossier ateliers/) pour que le lien marche chez les élèves.') : null),
    [{ label: 'Copier', primary: true, onClick: async () => { try { await navigator.clipboard.writeText(u); TL.toast('Lien copié.', 'ok'); } catch (e) { champ.select(); } } }, { label: 'Fermer' }]);
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
    const role = vraiProf()
      ? h('div', h('span.pill.on', 'Mode enseignant'), ' ', h('button.btn.small.ghost', { type: 'button', onclick: () => app.quitterEnseignant() }, 'Quitter le mode enseignant'))
      : h('div', h('span.pill.neutral', 'Élève'), app.eleveCentrale ? null : ' ', app.eleveCentrale ? null : h('button.btn.small.ghost', { type: 'button', onclick: () => app.modeEnseignant() }, 'Mode enseignant…'));
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
          h('button.btn.ghost', { type: 'button', onclick: async () => { await Z.deconnexion(); draw(); renderMenus(); } }, 'Me déconnecter')));
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
        h('div.form.grid2', h('label', { for: 'pf-name' }, 'Nom affiché', name), h('div', h('div.p-label', 'Mode'), role)),
        h('p.small.muted', 'Le mode enseignant donne toute l’interface : éditeur d’ateliers, correction, options d’affichage, tous les outils. Il s’ouvre depuis l’espace enseignant de la Centrale (bouton « TechnoStudio · enseignant »). Le nom reste sur cet appareil : la Centrale ne connaît que l’identifiant.'),
        h('div.actions', h('button.btn.primary', { type: 'button', onclick: async () => { Object.assign(p, { name: name.value.trim() || p.name }); await TL.db.set('profile', p); TL.toast('Profil enregistré.', 'ok'); drawSync(); renderMenus(); } }, 'Enregistrer'))));

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
    TL.modal('Raccourcis clavier', h('table.simple', h('tbody', [['← / →', 'Feuille précédente / suivante'], ['Ctrl Z', 'Annuler (hors d’un champ de texte)'], ['Ctrl Y ou Ctrl Maj Z', 'Rétablir'], ['Ctrl O', 'Bibliothèque'], ['Échap', 'Fermer un menu ou une fenêtre'], ['Double-clic sur un titre de panneau', 'Replier / déplier'], ['Glisser le titre d’un panneau', 'Le déplacer']].map(([k, v]) => h('tr', h('td.mono', k), h('td', v))))), [{ label: 'Fermer', primary: true }]);
  }
  document.addEventListener('keydown', (e) => {
    // dans un champ (texte, éditeur de code, Blockly) : le navigateur ou l'éditeur gère lui-même Ctrl+Z
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable],.injectionDiv,.blocklyWidgetDiv')) return;
    const touche = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (touche === 'z' || touche === 'y')) {
      if (document.querySelector('.modal')) return;
      e.preventDefault();
      if (touche === 'y' || e.shiftKey) hist.retablir(); else hist.annuler();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && !app.seul) { e.preventDefault(); app.go('accueil'); }
    if (app.step && !e.ctrlKey && !e.metaKey && !e.altKey) { if (e.key === 'ArrowRight') app.step(1); if (e.key === 'ArrowLeft') app.step(-1); }
  });

  // compatibilité avec l'ancienne API (aperçus de l'éditeur, tableau de bord)
  TL.renderBlock = (b, pg, onResult, opts) => TL.renderSheetBlock(b, { pg, onResult, readonly: opts && opts.readonly, layers: {} });

  function onboarding() {
    return new Promise((resolve) => {
      let res = resolve;
      const Z = TL.centrale;
      const name = h('input.field', { type: 'text', placeholder: 'ex. Léa Martin', autocomplete: 'name', 'aria-label': 'Prénom et nom' });
      const role = 'eleve';   // l'enseignant passe par « Mode enseignant » (clé vérifiée par le serveur)
      const roles = h('button.btn.small.ghost.onb-prof', { type: 'button', onclick: async () => { await finir({ name: name.value.trim() || 'Enseignant', role }); m.close(); setTimeout(() => app.modeEnseignant(), 50); } }, 'Je suis l’enseignant…');
      const finir = async (profil) => { app.profile = Object.assign({ classe: '', createdAt: Date.now() }, profil); await TL.db.set('profile', app.profile); res(); };
      const zone = h('div.centrale-zone');
      const sans = h('details.onb-sans', h('summary', Z.dispo ? 'Continuer sans code' : 'Commencer'),
        h('label', 'Prénom et nom', name),
        h('div.actions', h('button.btn.ghost', { type: 'button', onclick: async () => { await finir({ name: name.value.trim() || 'Élève', role }); m.close(); } }, Z.dispo ? 'Commencer sans code' : 'Commencer'), roles));
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
    if (app.seul) return startSeul();
    // Lancé depuis la Centrale : ?mode=enseignant (session de l'espace enseignant) ou ?mode=eleve (présentation des élèves)
    let modeDemande = ''; try { modeDemande = new URLSearchParams(location.search).get('mode') || ''; } catch (e) { /* rien */ }
    const depuisPortail = /(^|[#&])centrale=/.test(location.hash) || /^#activite=/.test(location.hash);   // ou lien direct vers un atelier
    // Venu du portail élève (jeton, adresse de retour dans l'adresse ou gardée par le module pour cet onglet) : mode élève
    let retourPortail = /(^|[#&])retour=/.test(location.hash);
    try { retourPortail = retourPortail || !!sessionStorage.getItem('centrale-retour'); } catch (e) { /* rien */ }
    app.eleveCentrale = modeDemande !== 'enseignant' && (/(^|[#&])centrale=/.test(location.hash) || retourPortail);
    app.enseignantCentrale = !app.eleveCentrale && (await app.sessionEnseignant()) === true;
    if (modeDemande === 'eleve' && app.enseignantCentrale) app.apercu = true;
    app.profile = await TL.db.get('profile');
    if (!app.profile && window.TL_DEFAULT_PROFILE) app.profile = Object.assign({ createdAt: Date.now(), profOk: true }, window.TL_DEFAULT_PROFILE);
    if (app.profile && app.profile.role === 'prof' && !app.profile.profOk) app.profile.role = 'eleve';   // « Enseignant » choisi sans clé : redevient élève
    if (!app.profile && depuisPortail) app.profile = { name: 'Élève', role: 'eleve', classe: '', createdAt: Date.now() };
    if (!app.profile && app.enseignantCentrale) app.profile = { name: 'Enseignant', role: 'eleve', classe: '', createdAt: Date.now() };   // l'enseignant n'a pas d'accueil élève à remplir
    if (app.profile) { try { await TL.db.set('profile', app.profile); } catch (e) { /* mémoire */ } }
    await TL.panels.load();
    await app.loadWorkshops();
    const centrale = TL.centrale.init(); // en parallèle : l'appli s'affiche sans attendre le réseau
    initBarre();
    drawSync();
    window.addEventListener('hashchange', route);
    TL.on('synced', () => { drawSync(); renderMenus(); });
    if (!app.profile) { route(); await centrale; await onboarding(); drawSync(); }
    route();
    centrale.then(() => { drawSync(); renderMenus(); });
    if (modeDemande === 'enseignant' && !vraiProf()) setTimeout(() => app.modeEnseignant(), 300);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) && !window.TL_NO_SW) navigator.serviceWorker.register('sw.js').catch(() => {});
  };
  // Atelier seul : ni profil ni Centrale ; l'élève arrive directement sur la feuille demandée
  async function startSeul() {
    document.body.classList.add('mode-seul');
    app.profile = { name: 'Élève', role: 'eleve', classe: '' }; // en mémoire seulement
    app.layers.corr = false;
    await TL.panels.load();
    await app.loadWorkshops();
    const w = app.workshops.get(app.seul.id);
    initBarre();
    drawSync();
    if (!w) {
      TL.$('#menus').append(h('span.seul-brand', TL.brandSvg()));
      stage().append(h('div.pasteboard.scroll', h('div.desk', h('div.empty', h('h2', 'Atelier introuvable'), h('p', 'Le lien ne correspond à aucun atelier (« ' + app.seul.id + ' »). Vérifie l’adresse donnée par ton professeur.')))));
      return;
    }
    document.title = w.title + ' · TechnoStudio';
    window.addEventListener('hashchange', route);
    // les réponses ne sont gardées que dans la page : on prévient avant de la quitter
    window.addEventListener('beforeunload', (e) => { const pg = app.progress.get(w.id); if (pg && Object.keys(pg.answers).length) { e.preventDefault(); e.returnValue = ''; } });
    route();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) && !window.TL_NO_SW) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
