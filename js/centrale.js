/* TechnoStudio — connexion à la Centrale élèves (https://github.com/grandiosian/centrale).

   TechnoStudio fonctionne seul (ateliers intégrés, travail gardé dans le navigateur).
   Avec la Centrale, l'élève tape son code (ou arrive déjà connecté depuis le portail) et :
     • reçoit les ateliers déposés par l'enseignant dans « Ressources des ateliers » ;
     • retrouve son travail sur n'importe quel poste (une donnée par atelier : at/<id>) ;
     • remonte son avancement feuille par feuille dans le tableau de suivi.
   Le module officiel centrale-client.js est chargé depuis le serveur de la Centrale. */
(function () {
  'use strict';
  const TL = window.TL;
  const DEFAUT = 'https://technoversailles.alwaysdata.net/';

  const Z = (TL.centrale = {
    serveur: DEFAUT, app: 'technostudio',
    dispo: false,            // module centrale-client.js chargé
    status: 'local',         // local | online | offline | syncing | error | indispo
    message: '', lastSync: 0,
  });
  TL.hub = Z; // nom historique utilisé par d'autres modules (jeton du serveur de compilation)

  const propre = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  const lireReglage = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const ecrireReglage = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* rien */ } };

  /* ---------- Réglages : serveur et identifiant d'atelier ----------
     ?app=technostudio-5e permet à l'enseignant de créer plusieurs ateliers dans la Centrale
     (un par niveau, avec leurs classes et leurs ressources) qui ouvrent tous TechnoStudio. */
  Z.lireConfig = function () {
    const q = new URLSearchParams(location.search);
    const srv = q.get('centrale') || window.CENTRALE_URL || lireReglage('ts-centrale') || DEFAUT;
    Z.serveur = String(srv).trim().replace(/\/?$/, '/').replace(/api\/$/, '');
    const app = propre(q.get('app')) || propre(lireReglage('ts-app')) || 'technostudio';
    Z.app = app;
    if (q.get('app')) ecrireReglage('ts-app', app);
  };
  Z.reglerConfig = function (serveur, app) {
    ecrireReglage('ts-centrale', serveur && serveur.replace(/\/?$/, '/') !== DEFAUT ? serveur : '');
    ecrireReglage('ts-app', app && propre(app) !== 'technostudio' ? propre(app) : '');
  };

  const etat = (s, msg) => { Z.status = s; Z.message = msg || ''; TL.emit('hub', Z); };
  Z.connecte = () => !!(Z.dispo && window.Centrale.connecte());
  Z.session = () => (Z.connecte() ? window.Centrale.session() : null);
  Z.jeton = () => { const s = Z.session(); return s ? s.jeton : ''; };
  Object.defineProperty(Z, 'token', { get: () => Z.jeton() });
  Object.defineProperty(Z, 'user', { get: () => { const s = Z.session(); return s ? { name: s.identifiant || s.classe + ' · élève ' + s.eleve, classe: s.classe, eleve: s.eleve, role: 'eleve' } : null; } });
  Z.isTeacher = () => false; // l'enseignant suit ses classes dans l'espace enseignant de la Centrale

  /* ---------- Chargement du module officiel ---------- */
  function chargerModule() {
    return new Promise((resolve) => {
      if (window.Centrale) return resolve(true);
      const s = document.createElement('script');
      const t = setTimeout(() => resolve(false), 10000);
      s.src = Z.serveur + 'js/centrale-client.js';
      s.onload = () => { clearTimeout(t); resolve(!!window.Centrale); };
      s.onerror = () => { clearTimeout(t); s.remove(); resolve(false); };
      document.head.appendChild(s);
    });
  }

  Z.init = async function () {
    Z.lireConfig();
    const avecJeton = /(^|[#&])centrale=/.test(location.hash);
    Z.ouvertDepuisPortail = avecJeton;
    if (!(await chargerModule())) {
      etat('indispo', 'Centrale injoignable : TechnoStudio fonctionne sur cet appareil.');
      if (!Z.reessai) { Z.reessai = true; window.addEventListener('online', () => { if (!Z.dispo) Z.init(); }); }
      return;
    }
    Z.dispo = true;
    window.Centrale.init({
      api: Z.serveur + 'api/',
      app: Z.app,
      boutonRetour: false, // « ← Mes ateliers » est placé dans la barre de menus de TechnoStudio
      surEtat: (e) => {
        const map = { enregistre: 'online', enregistrement: 'syncing', modifie: 'syncing', 'hors-ligne': 'offline', erreur: 'error', conflit: 'error' };
        if (!Z.connecte()) return;
        if (e.etat === 'enregistre') Z.lastSync = Date.now();
        if (map[e.etat]) etat(map[e.etat], e.etat === 'erreur' || e.etat === 'conflit' ? e.message : '');
        if (e.etat === 'conflit') resoudreConflits();
      },
      surDeconnexion: () => { etat('local', 'Session terminée : retape ton code pour enregistrer sur la Centrale.'); TL.toast('Session Centrale terminée : ton travail reste sur cet appareil.', ''); },
    });
    if (avecJeton || window.Centrale.connecte()) {
      // Le module consomme le jeton passé par le portail (#centrale=…) via afficherConnexion
      const tampon = document.createElement('div');
      await new Promise((resolve) => {
        window.Centrale.afficherConnexion(tampon, { onConnecte: (infos) => { apresConnexion(infos).finally(resolve); } });
        setTimeout(resolve, 12000);
        if (!avecJeton && !window.Centrale.connecte()) resolve();
      });
    } else etat('local');
  };

  /**
   * Formulaire de connexion de la Centrale (module centrale-client.js) : le code élève,
   * son format et ses messages appartiennent à la Centrale, TechnoStudio ne fait que l'afficher.
   */
  Z.afficherConnexion = function (element, apres) {
    if (!Z.dispo) return false;
    window.Centrale.afficherConnexion(element, { titre: 'Mon code', onConnecte: (infos) => { apresConnexion(infos).finally(() => apres && apres(infos)); } });
    return true;
  };
  /** Connexion directe avec un code (outils et essais) ; l'interface passe par afficherConnexion. */
  Z.connexion = async function (code) {
    if (!Z.dispo) { await Z.init(); if (!Z.dispo) throw new Error('Centrale injoignable. Vérifie la connexion internet.'); }
    const infos = await window.Centrale.connexion(code);
    await apresConnexion(infos);
    return infos;
  };
  Z.deconnexion = async function () {
    if (Z.dispo) window.Centrale.deconnexion();
    etat('local');
  };

  async function apresConnexion(infos) {
    etat('syncing');
    const app = TL.app;
    if (app && app.profile) {
      app.profile.name = infos.identifiant || (infos.classe + ' · élève ' + infos.eleve);
      app.profile.classe = infos.classe;
      if (!app.profile.role) app.profile.role = 'eleve';
      await TL.db.set('profile', app.profile);
    }
    try {
      const n = await Z.recevoir();
      await Z.chargerTout();
      Z.declarer();
      Z.lastSync = Date.now();
      etat('online');
      if (n) TL.toast(n + ' atelier(s) reçu(s) de la Centrale.', 'ok');
    } catch (e) {
      etat(e.horsLigne ? 'offline' : 'error', e.message);
    }
    TL.emit('synced');
    const demande = window.Centrale.activiteDemandee();
    if (demande) ouvrirActivite(demande);
  }

  /* ---------- Contenus : ressources déposées par l'enseignant ---------- */
  const cleRess = () => 'centrale:ressources:' + Z.serveur + Z.app;
  Z.recevoir = async function () {
    if (!Z.connecte()) return 0;
    const liste = await window.Centrale.listeRessources();
    const connu = (await TL.db.get(cleRess())) || {};
    const vus = {};
    let n = 0;
    for (const r of liste) {
      if (!/\.(json|gift|txt)$/i.test(r.nom)) continue;
      vus[r.nom] = true;
      if (connu[r.nom] && connu[r.nom].maj === r.maj) continue;
      try {
        const texte = await (await window.Centrale.chargerRessource(r.nom)).text();
        const ateliers = lireAteliers(texte, r.nom);
        const ids = [];
        for (const w of ateliers) {
          const v = TL.descriptor.validate('Workshop', w);
          if (!v.ok) { TL.toast('« ' + (w.title || r.nom) + ' » ignoré : ' + v.errors[0], 'bad'); continue; }
          w.centrale = { ressource: r.nom, maj: r.maj, app: Z.app };
          const s = await TL.app.saveWorkshop(w, 'centrale');
          ids.push(s.id); n++;
        }
        connu[r.nom] = { maj: r.maj, ids };
      } catch (e) { TL.toast('Ressource « ' + r.nom + ' » illisible : ' + e.message, 'bad'); }
    }
    // Ressources retirées par l'enseignant : leurs ateliers disparaissent aussi de ce poste
    for (const nom of Object.keys(connu)) {
      if (vus[nom]) continue;
      for (const id of connu[nom].ids || []) { const w = TL.app.workshops.get(id); if (w && w.source === 'centrale') await TL.app.deleteWorkshop(id); }
      delete connu[nom];
    }
    await TL.db.set(cleRess(), connu);
    return n;
  };
  function lireAteliers(texte, nom) {
    if (/\.json$/i.test(nom) || /^\s*[[{]/.test(texte)) {
      const d = JSON.parse(texte);
      return Array.isArray(d) ? d : d.workshops ? d.workshops : [d];
    }
    const w = TL.gift.parse(texte, { title: nom.replace(/\.(gift|txt)$/i, '') });
    return [w];
  }
  Z.ateliersRecus = () => [...TL.app.workshops.values()].filter((w) => w.source === 'centrale');

  /* ---------- Travail de l'élève : une donnée par atelier ---------- */
  const cle = (wid) => TL.passerelle.cleAtelier(wid);
  function fusion(local, distant) {
    if (!local) return distant; if (!distant) return local;
    const out = Object.assign({}, distant, local);
    out.answers = Object.assign({}, distant.answers);
    for (const k in local.answers || {}) { const a = local.answers[k], b = out.answers[k]; if (!b || (a.at || 0) >= (b.at || 0)) out.answers[k] = a; }
    out.seen = Object.assign({}, distant.seen, local.seen);
    out.updatedAt = Math.max(local.updatedAt || 0, distant.updatedAt || 0);
    out.step = (local.updatedAt || 0) >= (distant.updatedAt || 0) ? local.step : distant.step;
    out.completedAt = local.completedAt || distant.completedAt || null;
    return out;
  }
  Z.fusion = fusion;

  /** Charge tout le travail enregistré sur la Centrale et le fusionne avec celui du poste. */
  Z.chargerTout = async function () {
    if (!Z.connecte()) return;
    const cles = (await window.Centrale.listeDonnees()).map((c) => c.cle).filter((c) => c.startsWith('at/'));
    const app = TL.app;
    for (const c of cles) {
      const distant = await window.Centrale.charger(c, null);
      if (!distant || !distant.wid) continue;
      const local = await TL.db.get('pg:' + distant.wid);
      const m = fusion(local, distant);
      await TL.db.set('pg:' + m.wid, m);
      if (app.progress.has(m.wid)) Object.assign(app.progress.get(m.wid), m);
      if (JSON.stringify(m) !== JSON.stringify(distant)) window.Centrale.sauver(c, m).catch(() => {});
    }
    // Travail fait sur ce poste avant la connexion : envoyé aussi
    for (const k of await TL.db.keys('pg:')) {
      const pg = await TL.db.get(k);
      if (pg && pg.updatedAt && !cles.includes(cle(pg.wid))) Z.sauver(pg);
    }
  };

  const enAttente = {};
  /** Appelé à chaque réponse (app.saveProgress). Le module regroupe les envois (3 s). */
  Z.sauver = function (pg) {
    if (!Z.connecte() || !pg || !pg.wid) return;
    window.Centrale.sauver(cle(pg.wid), pg).catch((e) => { if (e.statut === 409) resoudreConflit(pg.wid); });
    clearTimeout(enAttente[pg.wid]);
    enAttente[pg.wid] = setTimeout(() => Z.rapport(pg.wid), 4000);
  };
  Z.markDirty = Z.sauver;
  async function resoudreConflit(wid) {
    // Travail modifié sur un autre poste entre-temps : on fusionne réponse par réponse
    try {
      const distant = await window.Centrale.charger(cle(wid), null);
      const local = await TL.db.get('pg:' + wid);
      const m = fusion(local, distant);
      await TL.db.set('pg:' + wid, m);
      if (TL.app.progress.has(wid)) Object.assign(TL.app.progress.get(wid), m);
      await window.Centrale.sauver(cle(wid), m, { immediat: true });
      etat('online');
    } catch (e) { etat('error', e.message); }
  }
  function resoudreConflits() { for (const wid of TL.app.progress.keys()) resoudreConflit(wid); }

  Z.sync = async function () {
    if (!Z.connecte()) throw new Error('Non connecté à la Centrale.');
    etat('syncing');
    await Z.recevoir();
    await Z.chargerTout();
    Z.lastSync = Date.now();
    etat('online');
    TL.emit('synced');
  };

  /* ---------- Avancement : une activité par feuille notée (js/passerelle.js) ---------- */
  const P = TL.passerelle;
  const envoyes = {};
  Z.rapport = function (wid) {
    if (!Z.connecte()) return;
    const w = TL.app.workshops.get(wid);
    const pg = TL.app.progress.get(wid);
    if (!w || !pg) return;
    for (const a of P.activitesAtelier(w)) {
      const envoi = P.progression(w, pg, a);
      if (!envoi) continue;
      const emp = JSON.stringify(envoi);
      if (envoyes[a.id] === emp) continue;
      envoyes[a.id] = emp;
      window.Centrale.progression(a.id, envoi);
    }
  };

  /** Colonnes du suivi : les ateliers intégrés (liste publiée dans centrale.json), puis ceux reçus de la Centrale. */
  Z.activites = function () {
    const tous = [...TL.app.workshops.values()];
    return P.activites(tous.filter((w) => w.source === 'demo')).concat(P.activites(tous.filter((w) => w.source === 'centrale'))).slice(0, 500);
  };
  Z.declarer = function () {
    if (!Z.connecte()) return;
    const liste = Z.activites();
    if (liste.length) window.Centrale.declarerActivites(liste).catch(() => {});
  };

  /** Le portail peut ouvrir directement une feuille : « atelier/P1 » ou un atelier entier. */
  async function ouvrirActivite(id) {
    const [wid, code] = String(id).split('/');
    const w = TL.app.workshops.get(wid);
    if (!w) { TL.toast('Activité « ' + id + ' » introuvable sur ce poste.', 'bad'); return; }
    if (code) {
      const i = P.activitesAtelier(w).find((a) => a.id === P.idActivite(w, code) || a.id === id);
      if (i) { const pg = await TL.app.getProgress(wid); pg.step = i.feuille; }
    }
    TL.app.go('at-' + wid);
  }
  Z.ouvrirActivite = ouvrirActivite;
  Z.lienPortail = () => { try { return (Z.dispo && sessionStorage.getItem('centrale-retour')) || ''; } catch (e) { return ''; } };

  /* ---------- Point d'accès unique : window.TechnoStudio (décrit dans centrale.json → acces_javascript) ---------- */
  const TS = {
    version: P.VERSION,
    descripteur: 'centrale.json',
    /** Liste envoyée à la Centrale : [{ id, titre, groupe, total }]. */
    activites: () => Z.activites(),
    /** Ateliers présents sur ce poste, avec leurs feuilles notées. */
    catalogue: () => [...TL.app.workshops.values()].map((w) => ({ id: w.id, titre: w.title, niveau: w.niveau || '', source: w.source, version: w.version || 1, feuilles: P.activitesAtelier(w).map((a) => ({ id: a.id, titre: a.titre, total: a.total })) })),
    /** Ce qui est (ou serait) envoyé à progression.php pour une activité, ou null. */
    progression: (id) => {
      const wid = String(id).split('/')[0];
      const w = TL.app.workshops.get(wid), pg = TL.app.progress.get(wid);
      const a = w && P.activitesAtelier(w).find((x) => x.id === id);
      return a && pg ? P.progression(w, pg, a) : null;
    },
    /** Valeurs des clés enregistrées : { "at/<id>": Progress, …, "code/projet": … }. */
    donnees: async () => {
      const out = {};
      for (const k of await TL.db.keys('pg:')) { const pg = await TL.db.get(k); if (pg && pg.wid) out[P.cleAtelier(pg.wid)] = pg; }
      const code = await TL.db.get('code:projet'); if (code) out[P.CLE_CODE] = code;
      return out;
    },
    /** Vérifie un atelier avec le descripteur des ateliers : { ok, errors, warnings }. */
    valider: (atelier) => TL.descriptor.validate('Workshop', atelier),
    estAtelier: (atelier) => TL.descriptor.validate('Workshop', atelier).ok,
  };
  Object.defineProperty(TS, 'app', { enumerable: true, get: () => Z.app });
  window.TechnoStudio = TS;
})();
