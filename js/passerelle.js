/* TechnoStudio — passerelle avec la Centrale : ce que l'appli déclare et envoie.
   Un seul endroit, utilisé à la fois par l'appli (js/centrale.js, window.TechnoStudio)
   et par tools/centrale-json.js qui produit centrale.json (format passerelle.atelier v1) :
   le descripteur publié et ce que l'appli envoie réellement ne peuvent pas diverger.
   Module UMD sans DOM (navigateur et Node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./descriptor.js'));
  else { root.TL = root.TL || {}; root.TL.passerelle = factory(root.TL.descriptor); }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const APP = 'technostudio';
  const VERSION = '3.6.0'; // = atelier.version de centrale.json, augmentée à chaque changement du descripteur
  /* Ateliers intégrés : les premiers pas, seuls à rester dans le code de l'appli (js/demos*.js) et dans ateliers.json.
     Tous les autres sont transférés par la Centrale (dossier ateliers/technostudio/ de son dépôt, js/transferes.js).
     Règle : Centrale, passerelle/ATELIERS-INTEGRES-ET-TRANSFERES.md. */
  const INTEGRES = ['charte-lampe-de-poche', 'demo-eclairage-premier-programme', 'demo-circuits-serie-derivation'];
  const KIND = { feuille: 'P', ressource: 'R', synthese: 'S', evaluation: 'E', fiche: 'F' };

  /** Codes des feuilles d'un atelier, comme sur le papier : P1, P2, R1, S1, E1, S·P1 (SEGPA). */
  function codesFeuilles(w) {
    const cnt = {};
    return (w.steps || []).map((s) => {
      const k = s.kind || 'feuille', cle = k + (s.segpa ? 's' : '');
      cnt[cle] = (cnt[cle] || 0) + 1;
      return (s.segpa ? 'S·' : '') + (KIND[k] || 'P') + (k === 'feuille' ? (s.feuille || cnt[cle]) : cnt[cle]);
    });
  }
  /** Un champ compte dans l'avancement s'il est noté (descripteur) et n'est pas une démonstration. */
  const estNote = (b) => !!(b && D.blocks[b.type] && D.blocks[b.type].graded && !b.demo);
  /** Identifiant d'activité, stable : <id atelier>/<code feuille> (ex. charte-lampe-de-poche/P1, …/S-P1). */
  const idActivite = (w, code) => (w.id + '/' + code).replace(/[^A-Za-z0-9_\-./]/g, '-');
  const groupe = (w) => ((w.niveau ? w.niveau + ' · ' : '') + w.title).slice(0, 80);

  /* ---------- Compétences : codes du référentiel commun de la Centrale (/passerelle/competences.json) ----------
     Une question porte des pastilles « comp » : un code de la fiche (T2C11), relié au référentiel par le champ « ref »
     de la compétence ou de la sous-compétence, ou directement un code du référentiel (SFC11.5.2).
     Une question notée sans pastille prend les capacités de l'atelier (« referentiel »). */
  const RE_REF = /^(OST|SFC|CCRI)\d{2}(\.[3-6]\.\d+)?$/;
  const listeRef = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((c) => RE_REF.test(c));
  function refsFiche(w) {
    const m = {};
    const ajouter = (code, ref) => { const l = listeRef(ref); if (code && l.length) m[code] = (m[code] || []).concat(l); };
    (w.competences || []).forEach((c) => { if (c && typeof c === 'object') { ajouter(c.code, c.ref); (c.sub || []).forEach((s) => s && ajouter(s.code, s.ref)); } });
    return m;
  }
  /** Codes du référentiel d'une question. */
  function codesBloc(w, b, m) {
    m = m || refsFiche(w);
    const comp = b.comp || [];
    if (!comp.length) return listeRef(w.referentiel);
    const out = [];
    comp.forEach((c) => (RE_REF.test(c) ? out.push(c) : (m[c] || []).forEach((r) => out.push(r))));
    return [...new Set(out)];
  }
  const union = (listes) => [...new Set([].concat(...listes))];

  /** Activités d'un atelier : une par feuille qui contient au moins un champ noté. */
  function activitesAtelier(w) {
    const codes = codesFeuilles(w), m = refsFiche(w);
    const out = [];
    (w.steps || []).forEach((s, i) => {
      const notes = (s.blocks || []).filter(estNote);
      if (notes.length) out.push({ id: idActivite(w, codes[i]), titre: (codes[i] + ' · ' + s.title).slice(0, 120), groupe: groupe(w), total: notes.length, feuille: i, champs: notes.map((b) => b.id),
        competences: union(notes.map((b) => codesBloc(w, b, m))) });
    });
    return out;
  }
  const trier = (ateliers) => ateliers.slice().sort((a, b) => (a.seq || 99) - (b.seq || 99) || String(a.title).localeCompare(String(b.title), 'fr'));
  /** Liste envoyée à la Centrale (activites.php) : champs id, titre, groupe, total, competences, dans l'ordre des ateliers. */
  function activites(ateliers) {
    const liste = [];
    trier(ateliers).forEach((w) => activitesAtelier(w).forEach((a) => liste.push({ id: a.id, titre: a.titre, groupe: a.groupe, total: a.total, competences: a.competences })));
    return liste.slice(0, 500);
  }

  /* ---------- Catalogue des ateliers (ateliers.json, format catalogue.ateliers v1 de la Centrale) ---------- */
  const NIVEAUX = { college: '', sti2d: 'lycee', snt: 'lycee', pro: 'lycee' };
  function niveauCatalogue(w) {
    const m = /^\s*([3-6])\s*e/i.exec(w.niveau || '');
    return m ? m[1] + 'e' : NIVEAUX[w.level] != null ? NIVEAUX[w.level] : '';
  }
  /* Mode atelier (SPECIFICATION de la Centrale §2.6) : lancé depuis le portail, l'atelier ferme par défaut le menu du logo,
     la bibliothèque (« Mes ateliers », Ctrl O) et le changement de niveau ; un atelier peut en rouvrir avec interface:{…}. */
  const INTERFACE_ATELIER = { menu: false, bibliotheque: false, niveau: false };
  function interfaceAtelier(w) { return Object.assign({}, INTERFACE_ATELIER, (w && w.interface) || {}); }
  /** Un atelier du catalogue ; fichier : adresse d'un contenu séparé (vide pour un atelier du code, le cas des ateliers intégrés). */
  function atelierCatalogue(w, fichier) {
    const acts = activitesAtelier(w);
    const e = { id: w.id, titre: String(w.title).slice(0, 120), niveau: niveauCatalogue(w), resume: String(w.summary || w.problematique || '').slice(0, 600),
      duree: w.duration ? w.duration + ' min' : '', competences: union([listeRef(w.referentiel)].concat(acts.map((a) => a.competences))),
      activites: acts.map((a) => ({ id: a.id, titre: a.titre, total: a.total, competences: a.competences })), ouvrir: w.id };
    if (fichier) e.fichier = fichier;
    e.version = w.version || 1;
    e.interface = interfaceAtelier(w);   // ce que l'élève peut ouvrir quand l'atelier est lancé depuis la Centrale
    if (w.author) e.auteur = String(w.author).slice(0, 80);
    return e;
  }
  /** Contenu de ateliers.json. publies : { id atelier → fichier } pour un atelier qui a un fichier séparé (aucun aujourd'hui). */
  function catalogue(ateliers, publies) {
    publies = publies || {};
    return { format: 'catalogue.ateliers', version: 1, app: APP, app_version: VERSION, referentiel: 'technologie-c4-2024',
      ateliers: trier(ateliers).map((w) => atelierCatalogue(w, publies[w.id])) };
  }

  /* ---------- Constats de compétences (envoyés avec la progression d'une feuille terminée) ----------
     Pour chaque code : part des points obtenus sur les questions de ce code → niveau 1 à 4
     (moins de 40 % : MI ; moins de 70 % : MF ; moins de 90 % : MS ; sinon TBM). Une question qui attend
     la correction du professeur suspend son code. */
  const niveauPart = (p) => (p < 0.4 ? 1 : p < 0.7 ? 2 : p < 0.9 ? 3 : 4);
  function constats(w, pg, act, code) {
    const blocs = {}, m = refsFiche(w);
    (w.steps || []).forEach((s) => (s.blocks || []).forEach((b) => (blocs[b.id] = b)));
    const parCode = {};
    for (const id of act.champs) {
      const b = blocs[id], r = pg && pg.answers && pg.answers[id];
      if (!b || !r || !r.done) return [];   // feuille pas terminée : pas encore de constat
      const pts = b.bareme || 1, enAttente = r.pendingReview || r.score == null;
      for (const c of codesBloc(w, b, m)) {
        const x = (parCode[c] = parCode[c] || { pts: 0, obtenus: 0, attente: false });
        if (enAttente) x.attente = true; else { x.pts += pts; x.obtenus += pts * r.score; }
      }
    }
    const feuille = code || act.titre.split(' · ')[0];
    return Object.entries(parCode).filter(([, x]) => !x.attente && x.pts > 0).map(([c, x]) => {
      const p = x.obtenus / x.pts;
      return { competence: c, niveau: niveauPart(p), reussi: p >= 0.5,
        preuve: ('Feuille ' + feuille + ' « ' + w.title + ' » : ' + Math.round(x.obtenus * 10) / 10 + ' / ' + x.pts + ' point' + (x.pts > 1 ? 's' : '')).slice(0, 200) };
    }).slice(0, 50);
  }

  const resume = (v) => {
    if (v == null) return '';
    if (typeof v === 'string') return v.startsWith('data:image') ? '[dessin]' : v.slice(0, 600);
    if (typeof v !== 'object') return String(v);
    if (v.png) return '[dessin]';
    if (v.code) return String(v.code).slice(0, 1500);
    if (v.text) return String(v.text).slice(0, 600);
    try { return JSON.stringify(v, (k, x) => (typeof x === 'string' && x.startsWith('data:') ? '[fichier]' : x)).slice(0, 600); } catch (e) { return ''; }
  };
  /**
   * Mesures d'une feuille (js/mesures.js → pg.mesures), envoyées avec sa progression :
   * { temps_actif (s), essais, questions (champs notés essayés), premier_coup, revelees, delai_median (s, première réponse),
   *   detail: [{ q, essais, ok1, okA, delai, revele }] } — null s'il n'y a rien.
   */
  function mesures(w, pg, act) {
    const m = pg && pg.mesures;
    if (!m) return null;
    const s = w.steps[act.feuille] || {};
    const f = (m.feuilles || {})[s.id] || {};
    const blocs = {};
    (s.blocks || []).forEach((b) => (blocs[b.id] = b));
    let essais = 0, questions = 0, premier = 0, revelees = 0;
    const delais = [], detail = [];
    for (const id of act.champs) {
      const q = (m.q || {})[id];
      if (!q || (!q.essais && !q.revele)) continue;
      const b = blocs[id] || {};
      questions++;
      essais += q.essais || 0;
      if (q.ok1) premier++;
      if (q.revele) revelees++;
      if (q.delai != null) delais.push(q.delai);
      const x = { q: (b.num ? b.num + ' ' : '') + String(b.question || b.title || b.type || id).replace(/<[^>]+>/g, '').replace(/\*\*/g, '').slice(0, 80), essais: q.essais || 0 };
      if (q.ok1 != null) x.ok1 = q.ok1;
      if (q.okA) x.okA = q.okA;
      if (q.delai != null) x.delai = q.delai;
      if (q.revele) x.revele = true;
      detail.push(x);
    }
    if (!f.actif && !detail.length) return null;
    delais.sort((a, b) => a - b);
    const med = delais.length ? (delais.length % 2 ? delais[(delais.length - 1) / 2] : Math.round((delais[delais.length / 2 - 1] + delais[delais.length / 2]) / 2)) : null;
    return { temps_actif: f.actif || 0, essais, questions, premier_coup: premier, revelees, delai_median: med, detail };
  }

  /** Ce qui part à progression.php pour une feuille (null si rien n'est commencé). */
  function progression(w, pg, act) {
    const blocs = {};
    (w.steps || []).forEach((s) => (s.blocks || []).forEach((b) => (blocs[b.id] = b)));
    let faites = 0, score = 0, max = 0;
    const reponses = [];
    for (const id of act.champs) {
      const b = blocs[id], r = pg && pg.answers && pg.answers[id], pts = b.bareme || 1;
      if (!b.bonus) max += pts;   // bonus : ajouté à la note, pas au total
      if (r && r.done) { faites++; score += pts * (r.score || 0); }
      if (r && r.value != null) {
        const x = { q: String(b.question || b.prompt || b.title || b.type).replace(/<[^>]+>/g, '').slice(0, 100), type: b.type, r: resume(r.value) };
        if (r.score != null) x.note = Math.round(r.score * 100) + ' %';
        if (r.pendingReview) x.aCorriger = true;
        reponses.push(x);
      }
    }
    if (!faites && !reponses.length) return null;
    const details = { feuille: w.steps[act.feuille].title, reponses };
    while (JSON.stringify(details).length > 18000 && details.reponses.length) {
      details.reponses = details.reponses.map((x) => Object.assign({}, x, { r: String(x.r).slice(0, Math.floor(String(x.r).length / 2)) }));
      if (details.reponses.every((x) => x.r.length < 20)) details.reponses.pop();
    }
    const envoi = { titre: act.titre, faites, total: act.total, statut: faites === act.total ? 'termine' : 'commence', score: Math.round(Math.min(score, max) * 100) / 100, score_max: max, details };
    const me = mesures(w, pg, act);
    if (me) envoi.mesures = me;
    return envoi;
  }

  /** Clés passées à Centrale.sauver / charger. */
  const cleAtelier = (wid) => 'at/' + String(wid).replace(/[^A-Za-z0-9_\-.]/g, '-');
  const CLE_CODE = 'code/projet';

  return { APP, VERSION, INTEGRES, codesFeuilles, estNote, idActivite, activitesAtelier, activites, progression, mesures, cleAtelier, CLE_CODE, resume,
    RE_REF, refsFiche, codesBloc, atelierCatalogue, catalogue, constats, niveauPart, interfaceAtelier };
});
