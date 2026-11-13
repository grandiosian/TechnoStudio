/* TechnoStudio — mesures pendant l'atelier (monitoring), rangées dans la progression de l'élève (pg.mesures) :
   • temps actif par feuille et pour l'atelier : compté par tranches de 10 s, seulement quand la page est visible
     et que l'élève a agi (clic, touche, défilement…) dans les 2 dernières minutes ;
   • par question notée : moment où elle est vue débloquée à l'écran (vu), première réponse (premier), nombre d'essais
     (jamais remis à zéro, même avec « Recommencer »), réussite du premier coup (ok1), essai où elle est réussie (okA),
     correction affichée (revele), et délai de première réponse en secondes (delai = premier − vu).
   Rien de personnel : des durées et des compteurs, envoyés avec la progression (js/passerelle.js, champ « mesures »).
   pg.mesures = { v: 1, debut, actif, feuilles: { idFeuille: { debut, actif, vu } }, q: { idChamp: { … } } } */
(function () {
  'use strict';
  const TL = window.TL;
  const M = (TL.mesures = {});
  const TRANCHE = 10;              // secondes
  const INACTIF = 120000;          // ms sans action : on ne compte plus
  const SAUVE = 18;                // tranches entre deux sauvegardes (3 min) quand l'élève lit sans répondre
  const now = () => Date.now();

  let derniere = now();
  const actif = () => { derniere = now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input', 'scroll', 'pointermove'].forEach((e) => document.addEventListener(e, actif, { passive: true, capture: true }));

  const base = (pg) => {
    const m = (pg.mesures = pg.mesures || { v: 1 });
    m.feuilles = m.feuilles || {};
    m.q = m.q || {};
    return m;
  };
  const question = (pg, id) => { const m = base(pg); return (m.q[id] = m.q[id] || {}); };

  /** La question est à l'écran et débloquée : on note la première fois. */
  M.vu = function (pg, id) {
    if (!pg || !id) return;
    const q = question(pg, id);
    if (!q.vu) q.vu = now();
  };

  /** Appelé à chaque résultat d'un champ (sheet.js, ctx.result), avant l'enregistrement. */
  M.resultat = function (pg, b, prev, a, silent) {
    if (!pg || !b || !a || !TL.isGraded(b)) return;
    const q = question(pg, b.id);
    const nouveau = !!a.at && a.at !== (prev && prev.at);
    if (a.revealed && !(prev && prev.revealed)) { q.revele = true; q.dernier = a.at || now(); return; }
    // résultats « silencieux » (étapes d'une procédure cochées une à une) : un essai quand le champ devient fait
    const essai = nouveau && (!silent || (a.done && !(prev && prev.done)));
    if (!essai) { if (nouveau) q.dernier = a.at; return; }
    q.essais = (q.essais || 0) + 1;
    if (!q.premier) {
      q.premier = a.at;
      if (!a.pendingReview) q.ok1 = !!a.correct;   // à corriger par le professeur : pas de « premier coup »
      if (q.vu && a.at >= q.vu) q.delai = Math.min(3 * 3600, Math.round((a.at - q.vu) / 1000));
    }
    if (a.correct && !a.pendingReview && !q.okA) q.okA = q.essais;
    q.dernier = a.at;
  };

  /**
   * Suit une feuille affichée : temps actif et questions vues. Renvoie { maj, stop } ;
   * maj() après un déblocage (les questions déjà à l'écran deviennent « vues »). S'arrête seul quand la feuille quitte la page.
   */
  M.suivre = function (pg, step, sheet) {
    if (!pg || !step || !sheet) return { maj() {}, stop() {} };
    const m = base(pg);
    const f = (m.feuilles[step.id] = m.feuilles[step.id] || {});
    if (!f.debut) f.debut = now();
    if (!m.debut) m.debut = f.debut;
    derniere = now();
    // Question « vue » : débloquée et à l'écran (au moins la moitié, ou 120 px). Vérifié à l'ouverture, au défilement,
    // après chaque déblocage (maj) et à chaque tranche de temps.
    const enVue = (el) => {
      const r = el.getBoundingClientRect(), hv = window.innerHeight || document.documentElement.clientHeight;
      return r.height > 0 && Math.min(r.bottom, hv) - Math.max(r.top, 0) >= Math.min(120, r.height * 0.5);
    };
    const maj = () => {
      if (!sheet.isConnected || document.visibilityState === 'hidden') return;
      sheet.querySelectorAll('.sb.exo[data-id]:not(.is-locked)').forEach((el) => { if (!el.closest('[inert]') && enVue(el)) M.vu(pg, el.dataset.id); });
    };
    let attente = null;
    const auDefilement = () => { if (!attente) attente = setTimeout(() => { attente = null; maj(); }, 400); };
    document.addEventListener('scroll', auDefilement, { passive: true, capture: true });
    setTimeout(maj, 300);
    let n = 0;
    const t = setInterval(() => {
      if (!sheet.isConnected) { stop(); return; }
      maj();
      if (document.visibilityState !== 'visible' || now() - derniere > INACTIF) return;
      f.actif = (f.actif || 0) + TRANCHE;
      m.actif = (m.actif || 0) + TRANCHE;
      f.vu = now();
      if (++n % SAUVE === 0 && TL.app && TL.app.saveProgress) TL.app.saveProgress(pg);
    }, TRANCHE * 1000);
    function stop() { clearInterval(t); clearTimeout(attente); document.removeEventListener('scroll', auDefilement, { capture: true }); }
    return { maj, stop };
  };

  /** Fusion de deux postes (js/centrale.js) : on garde le plus grand temps et la question la plus avancée. */
  M.fusion = function (a, b) {
    if (!a) return b; if (!b) return a;
    const out = { v: 1, debut: Math.min(a.debut || Infinity, b.debut || Infinity), actif: Math.max(a.actif || 0, b.actif || 0), feuilles: {}, q: {} };
    if (!isFinite(out.debut)) delete out.debut;
    for (const k of new Set(Object.keys(a.feuilles || {}).concat(Object.keys(b.feuilles || {})))) {
      const x = (a.feuilles || {})[k] || {}, y = (b.feuilles || {})[k] || {};
      out.feuilles[k] = (x.actif || 0) >= (y.actif || 0) ? x : y;
    }
    for (const k of new Set(Object.keys(a.q || {}).concat(Object.keys(b.q || {})))) {
      const x = (a.q || {})[k] || {}, y = (b.q || {})[k] || {};
      out.q[k] = (x.essais || 0) > (y.essais || 0) || ((x.essais || 0) === (y.essais || 0) && (x.dernier || 0) >= (y.dernier || 0)) ? x : y;
    }
    return out;
  };
})();
