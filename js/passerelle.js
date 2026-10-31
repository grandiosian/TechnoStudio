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
  const VERSION = '3.2.0'; // = atelier.version de centrale.json, augmentée à chaque changement du descripteur
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

  /** Activités d'un atelier : une par feuille qui contient au moins un champ noté. */
  function activitesAtelier(w) {
    const codes = codesFeuilles(w);
    const out = [];
    (w.steps || []).forEach((s, i) => {
      const notes = (s.blocks || []).filter(estNote);
      if (notes.length) out.push({ id: idActivite(w, codes[i]), titre: (codes[i] + ' · ' + s.title).slice(0, 120), groupe: groupe(w), total: notes.length, feuille: i, champs: notes.map((b) => b.id) });
    });
    return out;
  }
  /** Liste envoyée à la Centrale (activites.php) : champs id, titre, groupe, total, dans l'ordre des ateliers. */
  function activites(ateliers) {
    const liste = [];
    ateliers.slice().sort((a, b) => (a.seq || 99) - (b.seq || 99) || String(a.title).localeCompare(String(b.title), 'fr'))
      .forEach((w) => activitesAtelier(w).forEach((a) => liste.push({ id: a.id, titre: a.titre, groupe: a.groupe, total: a.total })));
    return liste.slice(0, 500);
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
  /** Ce qui part à progression.php pour une feuille (null si rien n'est commencé). */
  function progression(w, pg, act) {
    const blocs = {};
    (w.steps || []).forEach((s) => (s.blocks || []).forEach((b) => (blocs[b.id] = b)));
    let faites = 0, score = 0, max = 0;
    const reponses = [];
    for (const id of act.champs) {
      const b = blocs[id], r = pg && pg.answers && pg.answers[id], pts = b.bareme || 1;
      max += pts;
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
    return { titre: act.titre, faites, total: act.total, statut: faites === act.total ? 'termine' : 'commence', score: Math.round(score * 100) / 100, score_max: max, details };
  }

  /** Clés passées à Centrale.sauver / charger. */
  const cleAtelier = (wid) => 'at/' + String(wid).replace(/[^A-Za-z0-9_\-.]/g, '-');
  const CLE_CODE = 'code/projet';

  return { APP, VERSION, codesFeuilles, estNote, idActivite, activitesAtelier, activites, progression, cleAtelier, CLE_CODE, resume };
});
