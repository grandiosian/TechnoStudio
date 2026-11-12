/* TechnoStudio — les ressources à côté de la feuille.
   • Dans une feuille, « ressource 8 », « ressources 10 à 12 », « document A », « ressource S1 »…
     deviennent des liens (TL.ressources.linkify).
   • Un clic ouvre le volet des ressources à droite de la feuille (les deux côte à côte), directement
     sur la bonne ressource, surlignée ; « ↩ Revenir à la question » ramène à la question d'où l'on vient.
   • Le volet montre toutes les feuilles ressources de l'atelier (de la même série : normale ou SEGPA),
     avec un onglet par feuille. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const Rs = (TL.ressources = {});
  const P = { el: null, host: null, w: null, src: null };
  const SHEET_W = 794;

  const cle = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^\s*(ressources?|documents?|doc\.?)\s*/, '').replace(/[\s.]+/g, '');

  /** Feuilles ressources de la série (normale ou SEGPA) ; toutes s'il n'y en a pas dans la série. */
  Rs.steps = function (w, segpa) {
    const all = w.steps.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'ressource');
    const serie = all.filter((x) => !!x.s.segpa === !!segpa);
    return serie.length ? serie : all;
  };
  /** Numéro de ressource (8, A, S1…) → { si, bid } */
  Rs.index = function (w, segpa) {
    const m = {};
    Rs.steps(w, segpa).forEach(({ s, i }) => {
      (s.title || '').replace(/\b(S\d+)\b/g, (_, k) => { if (!m[cle(k)]) m[cle(k)] = { si: i, bid: null }; return _; });
      s.blocks.forEach((b) => { if (b.type === 'ressource' && b.num != null && b.num !== '' && !m[cle(b.num)]) m[cle(b.num)] = { si: i, bid: b.id }; });
      if (/évaluation/i.test(s.title || '') && !m.evaluation) m.evaluation = { si: i, bid: null };
    });
    return m;
  };

  const RE = /\b(ressources?|documents?)(\s+)((?:S?\d+|[A-H]|évaluation)(?:\s*(?:,|et|à|-|–)\s*(?:S?\d+|[A-H]))*)/gi;
  const TEST = new RegExp(RE.source, 'i');
  const SKIP = 'input,textarea,select,button,a,code,svg,.res-link,.blocklyDiv,.mbk-card,.sb-corr,.sh-head,header';
  /** Transforme les mentions de ressources d'un élément en liens. o : { w, segpa, onOpen(num, lien) } */
  Rs.linkify = function (root, o) {
    const idx = Rs.index(o.w, o.segpa);
    if (!Object.keys(idx).length) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : TEST.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
    const nodes = []; let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      const txt = node.nodeValue, frag = document.createDocumentFragment();
      let last = 0; RE.lastIndex = 0; let m;
      while ((m = RE.exec(txt))) {
        frag.append(txt.slice(last, m.index) + m[1] + m[2]);
        // chaque numéro devient un lien (« 10 à 12 » : 10 et 12)
        m[3].split(/(\s*(?:,|et|à|-|–)\s*)/).forEach((part) => {
          const k = cle(part);
          if (idx[k]) frag.append(h('button.res-link', { type: 'button', title: 'Ouvrir la ressource ' + part + ' à côté de la feuille', onclick: (e) => { e.preventDefault(); o.onOpen ? o.onOpen(part, e.currentTarget) : Rs.open(o.w, part, e.currentTarget, o); } }, part));
          else frag.append(part);
        });
        last = m.index + m[0].length;
      }
      frag.append(txt.slice(last));
      node.replaceWith(frag);
    });
  };

  function panel() {
    if (P.el) return P.el;
    const host = document.getElementById('workspace') || document.body;
    P.el = h('aside.res-side', { 'aria-label': 'Ressources' });
    host.append(P.el);
    P.host = host;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && P.host.classList.contains('res-open') && !document.querySelector('.modal')) Rs.close(); });
    return P.el;
  }
  Rs.isOpen = () => !!(P.host && P.host.classList.contains('res-open'));
  Rs.close = function () {
    if (!P.host) return;
    P.host.classList.remove('res-open');
    if (P.ro) { P.ro.disconnect(); P.ro = null; }
    P.src = null;
  };

  /** Ouvre le volet sur la ressource « num » (ou la première feuille ressource si num est vide).
      src : l'élément d'où l'on vient (pour « Revenir à la question »). o : { segpa, pg } */
  Rs.open = function (w, num, src, o) {
    o = o || {};
    if (TL.mblock && TL.mblock.close) TL.mblock.close();
    if (TL.robot && TL.robot.close) TL.robot.close();
    const el = panel();
    const steps = Rs.steps(w, o.segpa);
    if (!steps.length) { TL.toast('Cet atelier n’a pas de feuille ressource.'); return; }
    const target = num ? Rs.index(w, o.segpa)[cle(num)] : null;
    P.w = w; P.src = src || null;
    el.innerHTML = '';
    const codes = TL.sheetCodes(w);
    const body = h('div.res-body');
    const pages = {};
    steps.forEach(({ s, i }) => {
      const page = TL.renderSheet(w, s, i, { pg: o.pg, layers: {} });
      pages[i] = page;
      body.append(page);
    });
    const tabs = h('div.res-tabs', steps.map(({ s, i }) => h('button.res-tab', { type: 'button', title: s.title, onclick: () => aller(i, null) }, codes[i])));
    const back = h('button.btn.small.res-back', { type: 'button', hidden: !src, onclick: () => revenir() }, '↩ Revenir à la question');
    el.append(h('header.res-top', h('span.res-logo', '📚 Ressources'), tabs, h('span.mbk-sp'), back,
      h('button.mbk-x', { type: 'button', title: 'Fermer les ressources (Échap)', 'aria-label': 'Fermer', onclick: () => Rs.close() }, '✕')), body);
    // la feuille ressource tient dans la largeur du volet
    const ajuster = () => { const z = Math.min(1, Math.max(0.45, (body.clientWidth - 28) / SHEET_W)); Object.values(pages).forEach((p) => (p.style.zoom = z)); };
    if (P.ro) P.ro.disconnect();
    P.ro = new ResizeObserver(ajuster); P.ro.observe(body);
    P.host.classList.add('res-open');
    ajuster();
    function aller(si, bid) {
      TL.$$('.res-tab', tabs).forEach((t, k) => t.classList.toggle('on', steps[k].i === si));
      const cible = (bid && pages[si] && pages[si].querySelector('.sb[data-id="' + CSS.escape(bid) + '"]')) || pages[si];
      if (!cible) return;
      requestAnimationFrame(() => {
        body.scrollTop += cible.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
        if (bid) { cible.classList.remove('res-flash'); void cible.offsetWidth; cible.classList.add('res-flash'); }
      });
    }
    aller(target ? target.si : steps[0].i, target && target.bid);
  };

  function revenir() {
    const src = P.src;
    if (!src || !document.body.contains(src)) { Rs.close(); return; }
    const q = src.closest('.sb') || src;
    q.scrollIntoView({ block: 'center', behavior: 'smooth' });
    q.classList.remove('res-flash'); void q.offsetWidth; q.classList.add('res-flash');
  }
  Rs.back = revenir;
})();
