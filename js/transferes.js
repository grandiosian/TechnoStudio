/* TechnoStudio — ateliers transférés par la Centrale.

   Règle (Centrale, passerelle/ATELIERS-INTEGRES-ET-TRANSFERES.md) : TechnoStudio n'a dans son code que les premiers pas
   (TL.passerelle.INTEGRES). Les autres ateliers sont des fichiers de la Centrale (dépôt centrale, ateliers/technostudio/<id>.json),
   servis par son API publique : api/atelier-fichier.php?app=technostudio[&id=<id>] (sans connexion d'élève).

   - Un atelier demandé (#activite=, ?atelier=, #at-) que l'appli n'a pas est demandé à la Centrale, puis ouvert.
   - Une copie est gardée sur le poste (IndexedDB, clé « transfere:<id> », avec sa version) : pendant une panne du serveur,
     l'atelier s'ouvre encore. Une version plus récente sur la Centrale remplace la copie.
   - Connectée, la bibliothèque montre aussi les ateliers de la Centrale pas encore sur le poste (T.liste).
   Un atelier transféré se comporte comme un atelier publié : source « demo », publie « centrale » (Modifier garde son id). */
(function () {
  'use strict';
  const TL = window.TL;
  const APP = 'technostudio';
  const CLE = 'transfere:';

  const T = (TL.transferes = { liste: null, erreur: '' });

  /** Adresse de la Centrale (réglages de js/centrale.js : ?centrale=, copie servie par une Centrale, ts-centrale…). */
  T.serveur = function () {
    const Z = TL.centrale;
    if (Z && Z.lireConfig && !T.configLue) { try { Z.lireConfig(); T.configLue = true; } catch (e) { /* adresse par défaut */ } }
    return (Z && Z.serveur) || 'https://technoversailles.alwaysdata.net/';
  };
  T.adresse = (id) => T.serveur() + 'api/atelier-fichier.php?app=' + APP + (id ? '&id=' + encodeURIComponent(id) : '');

  async function lireJson(url, ms) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms);
    try {
      const r = await fetch(url, { cache: 'no-cache', credentials: 'omit', signal: ctl ? ctl.signal : undefined });
      if (!r.ok) { const e = new Error(r.status === 404 ? 'pas sur la Centrale' : 'erreur ' + r.status); e.statut = r.status; throw e; }
      return await r.json();
    } finally { clearTimeout(t); }
  }

  /** Atelier prêt pour l'appli (normalisé, marqué transféré). */
  T.preparer = function (w) {
    return Object.assign(TL.normalizeWorkshop(TL.clone(w)), { source: 'demo', publie: 'centrale', transfere: true });
  };
  /** Le fichier reçu est-il un atelier utilisable, sous cet identifiant ? '' ou la raison. */
  function probleme(j, id) {
    if (!j || typeof j !== 'object' || Array.isArray(j)) return 'fichier illisible';
    if (j.id !== id) return 'identifiant différent (« ' + j.id + ' »)';
    if (!Number.isInteger(j.format) || !Number.isInteger(j.version)) return 'format ou version manquant';
    if (j.format > TL.FORMAT) return 'format ' + j.format + ' trop récent pour cette version de TechnoStudio';
    const v = TL.descriptor.validate('Workshop', j);
    return v.ok ? '' : v.errors[0];
  }

  /** Copies gardées sur le poste : [{ w, version, recu, serveur }]. */
  T.copies = async () => (await TL.db.all(CLE)).filter((c) => c && c.w && c.w.id);
  T.copie = (id) => TL.db.get(CLE + id).catch(() => null);

  /** Demande un atelier à la Centrale et en garde la copie. L'atelier préparé, ou null (raison dans T.erreur). */
  T.demander = async function (id, ms) {
    T.erreur = '';
    if (!/^[A-Za-z0-9-]{1,80}$/.test(String(id || ''))) { T.erreur = 'identifiant invalide'; return null; }
    try {
      const j = await lireJson(T.adresse(id), ms || 8000);
      const p = probleme(j, id);
      if (p) { T.erreur = p; return null; }
      await TL.db.set(CLE + id, { w: j, version: j.version, recu: Date.now(), serveur: T.serveur() }).catch(() => {});
      return T.preparer(j);
    } catch (e) {
      T.erreur = e.name === 'AbortError' ? 'Centrale trop lente à répondre' : e.statut ? e.message : 'Centrale injoignable';
      return null;
    }
  };

  /** Liste des ateliers de la Centrale (fiches courtes), ou null hors connexion. Gardée dans T.liste. */
  T.lireListe = async function (ms) {
    try {
      const l = await lireJson(T.adresse(''), ms || 5000);
      T.liste = l && l.format === 'ateliers.centrale' && Array.isArray(l.ateliers) ? l.ateliers.filter((a) => a && a.id) : null;
    } catch (e) { T.liste = null; }
    return T.liste;
  };

  /** Connectée : relit la liste et remplace les copies dont la Centrale a une version plus récente. Renvoie les ateliers mis à jour. */
  T.actualiser = async function () {
    const liste = await T.lireListe();
    if (!liste) return [];
    const maj = [];
    for (const c of await T.copies()) {
      const a = liste.find((x) => x.id === c.w.id);
      if (a && Number(a.version) > Number(c.version || c.w.version || 0)) {
        const w = await T.demander(c.w.id);
        if (w) maj.push(w);
      }
    }
    return maj;
  };

  /** Anciennes copies des ateliers publiés avec l'appli (clé « publies », avant le passage par la Centrale) : reprises
      comme copies d'ateliers transférés, pour qu'elles s'ouvrent encore hors connexion. Une seule fois. */
  T.reprendreAnciennesCopies = async function () {
    const anciens = await TL.db.get('publies').catch(() => null);
    if (!Array.isArray(anciens) || !anciens.length) return;
    const integres = (TL.passerelle && TL.passerelle.INTEGRES) || [];
    for (const w of anciens) {
      if (!w || !w.id || integres.includes(w.id) || (await T.copie(w.id))) continue;
      const x = TL.clone(w); delete x.publie;
      if (!probleme(x, w.id)) await TL.db.set(CLE + w.id, { w: x, version: x.version, recu: 0, serveur: '' }).catch(() => {});
    }
    await TL.db.del('publies').catch(() => {});
  };
})();
