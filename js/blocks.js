/* TechnoStudio — programmation par blocs + maquettes virtuelles.
   Éditeur de blocs tactile (insertion par point d'insertion ou glisser-déposer),
   interpréteur pas à pas (générateurs), traduction Python, tests automatiques. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;

  /* ================= Maquettes ================= */
  const SCENES = (TL.SCENES = {});

  SCENES.eclairage = {
    name: 'Éclairage automatique de couloir',
    sensors: [
      { id: 'presence', name: 'Détecteur de présence', kind: 'bool', control: 'toggle', on: 'Quelqu’un passe', off: 'Personne' },
      { id: 'luminosite', name: 'Luminosité', kind: 'num', control: 'slider', min: 0, max: 100, unit: '%', def: 80 },
    ],
    actuators: [{ id: 'lampe', name: 'Lampe', values: [[0, 'éteinte'], [1, 'allumée']] }],
    init: () => ({}),
    step() {},
    draw(s, a) {
      const L = s.luminosite / 100;
      const sky = `hsl(${205 + (1 - L) * 25} ${40 + L * 30}% ${12 + L * 60}%)`;
      const on = a.lampe ? 1 : 0;
      return `<svg viewBox="0 0 320 180" class="scene">
        <rect x="0" y="0" width="320" height="180" class="sc-wall"/>
        <rect x="200" y="30" width="80" height="70" rx="3" fill="${sky}" class="sc-frame"/>
        ${L > 0.45 ? `<circle cx="258" cy="52" r="${8 + L * 6}" fill="#f4c542"/>` : `<circle cx="258" cy="52" r="9" fill="#e8e6da"/><circle cx="262" cy="49" r="8" fill="${sky}"/>`}
        <line x1="240" y1="30" x2="240" y2="100" class="sc-frame"/>
        <rect x="0" y="150" width="320" height="30" class="sc-floor"/>
        ${on ? `<path d="M 80 34 L 20 150 L 160 150 Z" class="sc-beam"/>` : ''}
        <rect x="70" y="0" width="20" height="22" class="sc-metal"/>
        <circle cx="80" cy="28" r="9" class="${on ? 'sc-bulb-on' : 'sc-bulb'}"/>
        <rect x="150" y="56" width="24" height="16" rx="3" class="sc-metal"/>
        <circle cx="162" cy="64" r="4" fill="${s.presence ? '#e3342f' : '#777'}"/>
        ${s.presence ? `<g class="sc-person" transform="translate(110,92)"><circle cx="0" cy="0" r="9"/><path d="M -10 14 Q 0 8 10 14 L 12 46 L 5 46 L 3 30 L -3 30 L -5 46 L -12 46 Z"/></g>` : ''}
        <text x="10" y="172" class="sc-txt">Couloir — lampe ${on ? 'allumée' : 'éteinte'}</text></svg>`;
    },
  };

  SCENES.portail = {
    name: 'Portail coulissant automatique',
    sensors: [
      { id: 'telecommande', name: 'Télécommande', kind: 'bool', control: 'push', on: 'Appuyer' },
      { id: 'obstacle', name: 'Cellule photoélectrique', kind: 'bool', control: 'toggle', on: 'Véhicule dans le passage', off: 'Passage libre' },
      { id: 'fdc_ouvert', name: 'Fin de course « ouvert »', kind: 'bool', control: 'read' },
      { id: 'fdc_ferme', name: 'Fin de course « fermé »', kind: 'bool', control: 'read' },
    ],
    actuators: [
      { id: 'moteur', name: 'Moteur', values: [[-1, 'fermer'], [0, 'arrêt'], [1, 'ouvrir']] },
      { id: 'gyrophare', name: 'Gyrophare', values: [[0, 'éteint'], [1, 'allumé']] },
    ],
    init: () => ({ pos: 0, collision: 0, t: 0 }),
    step(s, a, dt) {
      s.t += dt;
      s.pos = TL.clamp(s.pos + (a.moteur || 0) * 22 * dt, 0, 100);
      s.fdc_ouvert = s.pos >= 99.9 ? 1 : 0;
      s.fdc_ferme = s.pos <= 0.1 ? 1 : 0;
      if (s.obstacle && a.moteur === -1 && s.pos < 75) { if (!s.collision) s.events.push('Collision : le portail a heurté le véhicule !'); s.collision = 1; }
    },
    draw(s, a) {
      const x = 150 - (s.pos / 100) * 150;
      const blink = a.gyrophare && Math.floor(s.t * 3) % 2 === 0;
      return `<svg viewBox="0 0 320 180" class="scene">
        <rect x="0" y="0" width="320" height="180" class="sc-sky"/>
        <rect x="0" y="140" width="320" height="40" class="sc-floor"/>
        <rect x="40" y="60" width="14" height="82" class="sc-metal"/>
        <rect x="216" y="60" width="14" height="82" class="sc-metal"/>
        <line x1="54" y1="112" x2="216" y2="112" class="${s.obstacle ? 'sc-ray-cut' : 'sc-ray'}"/>
        ${s.obstacle ? `<g transform="translate(92,104)"><rect x="0" y="10" width="78" height="22" rx="6" class="sc-car"/><path d="M 12 10 L 22 -4 L 56 -4 L 66 10 Z" class="sc-car"/><circle cx="18" cy="34" r="7" class="sc-wheel"/><circle cx="60" cy="34" r="7" class="sc-wheel"/></g>` : ''}
        <g transform="translate(${x - 150},0)">
          <rect x="54" y="72" width="156" height="68" class="sc-gate"/>
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<line x1="${66 + i * 17}" y1="74" x2="${66 + i * 17}" y2="138" class="sc-bar"/>`).join('')}
        </g>
        <rect x="236" y="116" width="34" height="24" rx="3" class="sc-metal"/>
        <text x="253" y="132" class="sc-tiny" text-anchor="middle">M</text>
        <rect x="223" y="44" width="10" height="14" class="sc-metal"/>
        <circle cx="228" cy="40" r="7" fill="${blink ? '#ff9f1a' : '#7a6a55'}" class="${blink ? 'sc-glow' : ''}"/>
        <circle cx="48" cy="150" r="4" fill="${s.fdc_ferme ? '#2bb35a' : '#666'}"/><circle cx="222" cy="150" r="4" fill="${s.fdc_ouvert ? '#2bb35a' : '#666'}"/>
        <text x="10" y="172" class="sc-txt">Ouverture ${Math.round(s.pos)} %${s.collision ? ' — COLLISION' : ''}</text></svg>`;
    },
  };

  SCENES.serre = {
    name: 'Serre automatisée',
    sensors: [
      { id: 'temperature', name: 'Température intérieure', kind: 'num', control: 'read', unit: '°C' },
      { id: 'humidite', name: 'Humidité du sol', kind: 'num', control: 'read', unit: '%' },
      { id: 'temp_ext', name: 'Température extérieure', kind: 'num', control: 'slider', min: -5, max: 38, unit: '°C', def: 8 },
    ],
    actuators: [
      { id: 'chauffage', name: 'Chauffage', values: [[0, 'arrêt'], [1, 'marche']] },
      { id: 'ventilation', name: 'Ventilation', values: [[0, 'arrêt'], [1, 'marche']] },
      { id: 'arrosage', name: 'Arrosage', values: [[0, 'fermé'], [1, 'ouvert']] },
    ],
    init: () => ({ temperature: 14, humidite: 45, t: 0 }),
    step(s, a, dt) {
      s.t += dt;
      const dT = 0.06 * (s.temp_ext - s.temperature) + (a.chauffage ? 1.5 : 0) - (a.ventilation ? 0.25 + 0.12 * Math.max(0, s.temperature - s.temp_ext) : 0);
      s.temperature += dT * dt;
      s.humidite = TL.clamp(s.humidite + (-0.6 + (a.arrosage ? 5 : 0)) * dt, 0, 100);
      s.temperature = Math.round(s.temperature * 100) / 100; s.humidite = Math.round(s.humidite * 100) / 100;
    },
    draw(s, a) {
      const T = s.temperature, Hm = s.humidite;
      const th = TL.clamp((T + 5) / 45, 0, 1) * 70;
      const wilt = Hm < 25;
      const rot = (s.t * 400) % 360;
      return `<svg viewBox="0 0 320 180" class="scene">
        <rect x="0" y="0" width="320" height="180" class="sc-sky"/>
        <rect x="0" y="150" width="320" height="30" class="sc-floor"/>
        <path d="M 30 150 L 30 70 L 140 25 L 250 70 L 250 150 Z" class="sc-glass"/>
        <line x1="140" y1="25" x2="140" y2="150" class="sc-frame"/>
        <rect x="70" y="128" width="140" height="22" class="sc-soil"/>
        ${[95, 140, 185].map((x) => `<g transform="translate(${x},128)"><path d="M 0 0 C ${wilt ? '8 -10, 14 -8, 18 2' : '-2 -14, 0 -26, 0 -34'}" class="sc-stem"/><ellipse cx="${wilt ? 10 : -7}" cy="${wilt ? -6 : -20}" rx="8" ry="4" class="sc-leaf" transform="rotate(${wilt ? 30 : -30} ${wilt ? 10 : -7} ${wilt ? -6 : -20})"/><ellipse cx="${wilt ? 16 : 7}" cy="${wilt ? 0 : -28}" rx="8" ry="4" class="sc-leaf" transform="rotate(${wilt ? 50 : 30} ${wilt ? 16 : 7} ${wilt ? 0 : -28})"/></g>`).join('')}
        ${a.arrosage ? [80, 110, 140, 170, 200].map((x, i) => `<circle cx="${x}" cy="${88 + ((s.t * 60 + i * 13) % 36)}" r="2.2" class="sc-drop"/>`).join('') : ''}
        <line x1="70" y1="84" x2="210" y2="84" class="sc-pipe"/>
        <rect x="40" y="126" width="22" height="22" rx="2" class="${a.chauffage ? 'sc-heat-on' : 'sc-metal'}"/>
        <g transform="translate(230,92)"><circle r="13" class="sc-metal"/><g transform="rotate(${a.ventilation ? rot : 0})"><path d="M 0 0 L -3 -11 L 3 -11 Z M 0 0 L 11 -3 L 11 3 Z M 0 0 L 3 11 L -3 11 Z M 0 0 L -11 3 L -11 -3 Z" class="sc-blade"/></g></g>
        <rect x="282" y="40" width="12" height="80" rx="6" class="sc-thermo"/><rect x="285" y="${117 - th}" width="6" height="${th}" rx="3" fill="#e3342f"/><circle cx="288" cy="122" r="8" fill="#e3342f"/>
        <text x="10" y="172" class="sc-txt">${TL.fmtNum(T, 1)} °C · sol ${Math.round(Hm)} %${wilt ? ' — plantes assoiffées' : ''}</text></svg>`;
    },
  };

  SCENES.parking = {
    name: 'Barrière de parking avec compteur',
    sensors: [
      { id: 'entree', name: 'Capteur entrée', kind: 'bool', control: 'push', on: 'Voiture entre' },
      { id: 'sortie', name: 'Capteur sortie', kind: 'bool', control: 'push', on: 'Voiture sort' },
    ],
    actuators: [
      { id: 'barriere', name: 'Barrière', values: [[0, 'baissée'], [1, 'levée']] },
      { id: 'voyant_complet', name: 'Voyant « COMPLET »', values: [[0, 'éteint'], [1, 'allumé']] },
      { id: 'afficheur', name: 'Afficheur places libres', kind: 'num' },
    ],
    init: () => ({ angle: 0 }),
    step(s, a, dt) { s.angle = TL.clamp(s.angle + (a.barriere ? 1 : -1) * 180 * dt, 0, 80); },
    draw(s, a) {
      const ang = -s.angle;
      return `<svg viewBox="0 0 320 180" class="scene">
        <rect x="0" y="0" width="320" height="180" class="sc-sky"/>
        <rect x="0" y="140" width="320" height="40" class="sc-floor"/>
        <rect x="40" y="96" width="22" height="46" class="sc-metal"/>
        <g transform="translate(51,104) rotate(${ang})"><rect x="0" y="-4" width="170" height="8" class="sc-boom"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${12 + i * 32}" y="-4" width="14" height="8" fill="#e3342f"/>`).join('')}</g>
        <rect x="236" y="40" width="68" height="44" rx="4" class="sc-panel"/>
        <text x="270" y="58" class="sc-tiny" text-anchor="middle" fill="#aaa">PLACES</text>
        <text x="270" y="78" class="sc-seg" text-anchor="middle">${a.afficheur == null ? '--' : String(a.afficheur).slice(0, 4)}</text>
        <rect x="236" y="92" width="68" height="18" rx="3" fill="${a.voyant_complet ? '#e3342f' : '#4a3a3a'}" class="${a.voyant_complet ? 'sc-glow' : ''}"/>
        <text x="270" y="105" class="sc-tiny" text-anchor="middle" fill="${a.voyant_complet ? '#fff' : '#999'}">COMPLET</text>
        ${s.entree ? `<g transform="translate(100,112)"><rect x="0" y="6" width="70" height="20" rx="6" class="sc-car"/><circle cx="16" cy="28" r="6" class="sc-wheel"/><circle cx="54" cy="28" r="6" class="sc-wheel"/></g>` : ''}
        <text x="10" y="172" class="sc-txt">Barrière ${s.angle > 70 ? 'levée' : s.angle < 5 ? 'baissée' : 'en mouvement'}</text></svg>`;
    },
  };

  SCENES.feux = {
    name: 'Feu tricolore avec bouton piéton',
    sensors: [{ id: 'bouton_pieton', name: 'Bouton piéton', kind: 'bool', control: 'push', on: 'Appuyer' }],
    actuators: [
      { id: 'rouge', name: 'Feu rouge', values: [[0, 'éteint'], [1, 'allumé']] },
      { id: 'orange', name: 'Feu orange', values: [[0, 'éteint'], [1, 'allumé']] },
      { id: 'vert', name: 'Feu vert', values: [[0, 'éteint'], [1, 'allumé']] },
    ],
    init: () => ({}),
    step() {},
    draw(s, a) {
      const lamp = (y, on, col) => `<circle cx="160" cy="${y}" r="17" fill="${on ? col : '#2a2a2a'}" class="${on ? 'sc-glow' : ''}"/>`;
      return `<svg viewBox="0 0 320 180" class="scene">
        <rect x="0" y="0" width="320" height="180" class="sc-sky"/>
        <rect x="0" y="150" width="320" height="30" class="sc-floor"/>
        <rect x="155" y="128" width="10" height="24" class="sc-metal"/>
        <rect x="134" y="12" width="52" height="118" rx="10" fill="#1b1b1b"/>
        ${lamp(36, a.rouge, '#ff3b30')}${lamp(71, a.orange, '#ff9f0a')}${lamp(106, a.vert, '#30d158')}
        <rect x="214" y="100" width="22" height="30" rx="3" class="sc-metal"/><circle cx="225" cy="114" r="6" fill="${s.bouton_pieton ? '#ffd60a' : '#777'}"/>
        <text x="10" y="172" class="sc-txt">Feu ${a.rouge ? 'rouge' : a.orange ? 'orange' : a.vert ? 'vert' : 'éteint'}</text></svg>`;
    },
  };

  /* ================= Blocs ================= */
  const BLOCKS = {
    forever: { cat: 'ctl', label: 'répéter indéfiniment', body: true },
    repeat: { cat: 'ctl', label: 'répéter … fois', body: true },
    while: { cat: 'ctl', label: 'tant que …', body: true },
    if: { cat: 'ctl', label: 'si … alors', body: true },
    ifelse: { cat: 'ctl', label: 'si … alors … sinon', body: true },
    wait: { cat: 'ctl', label: 'attendre … s' },
    waituntil: { cat: 'ctl', label: 'attendre jusqu’à …' },
    set: { cat: 'act', label: 'mettre l’actionneur …' },
    setvar: { cat: 'var', label: 'mettre la variable …' },
    changevar: { cat: 'var', label: 'ajouter à la variable …' },
    say: { cat: 'out', label: 'afficher …' },
  };
  TL.BLOCKS = BLOCKS;
  const CATS = { ctl: 'Contrôle', act: 'Actionneurs', var: 'Variables', out: 'Affichage' };

  function newNode(op, scene, vars) {
    const n = { id: TL.uid('n'), op };
    if (BLOCKS[op].body) n.body = [];
    if (op === 'ifelse') n.else = [];
    if (op === 'repeat') n.n = 3;
    if (op === 'wait') n.s = 1;
    if (['if', 'ifelse', 'while', 'waituntil'].includes(op)) n.cond = defaultCond(scene, vars);
    if (op === 'set') { const a = scene.actuators[0]; n.target = a.id; n.value = a.values ? a.values[a.values.length - 1][0] : 0; }
    if (op === 'setvar') { n.name = vars[0] || 'compteur'; n.value = 0; }
    if (op === 'changevar') { n.name = vars[0] || 'compteur'; n.by = 1; }
    if (op === 'say') n.text = 'Bonjour';
    return n;
  }
  function defaultCond(scene, vars) {
    const s = scene.sensors[0];
    return { a: s ? 's:' + s.id : 'v:' + (vars[0] || 'compteur'), cmp: s && s.kind === 'num' ? '<' : '=', b: s && s.kind === 'num' ? 30 : 1 };
  }
  function ensureIds(list) { (list || []).forEach((n) => { n.id = n.id || TL.uid('n'); ensureIds(n.body); ensureIds(n.else); }); return list; }

  /* ----- Interpréteur ----- */
  function makeRunner(scene, program, opts) {
    opts = opts || {};
    const st = Object.assign(scene.init(), { events: [] });
    scene.sensors.forEach((s) => { st[s.id] = s.def != null ? s.def : 0; });
    Object.assign(st, opts.sensors || {});
    const act = {}; scene.actuators.forEach((a) => (act[a.id] = a.kind === 'num' ? null : 0));
    const vars = {};
    const log = [];
    const R = { st, act, vars, log, current: null, done: false, error: null, t: 0, waitLeft: 0, ops: 0 };
    const val = (x) => {
      if (x == null) return 0;
      if (typeof x === 'object') { if (x.var != null) return +vars[x.var] || 0; if (x.sensor != null) return +st[x.sensor] || 0; }
      return +x;
    };
    const operand = (a) => (a.startsWith('s:') ? +st[a.slice(2)] || 0 : +vars[a.slice(2)] || 0);
    const cmp = (x, op, y) => ({ '=': x === y, '≠': x !== y, '<': x < y, '>': x > y, '≤': x <= y, '≥': x >= y })[op];
    const test = (c) => {
      if (!c) return false;
      const r = cmp(Math.round(operand(c.a) * 1000) / 1000, c.cmp, +c.b);
      if (c.join && c.c2) return c.join === 'et' ? r && test(c.c2) : r || test(c.c2);
      return r;
    };
    function* run(list) { for (const n of list || []) yield* exec(n); }
    function* exec(n) {
      R.current = n.id;
      if (++R.ops > 5e6) throw new Error('Programme trop long.');
      switch (n.op) {
        case 'forever': for (;;) { yield* run(n.body); yield null; }
        case 'repeat': for (let i = 0; i < Math.min(10000, +n.n || 0); i++) { yield* run(n.body); yield null; } break;
        case 'while': while (test(n.cond)) { yield* run(n.body); yield null; } break;
        case 'if': if (test(n.cond)) yield* run(n.body); break;
        case 'ifelse': if (test(n.cond)) yield* run(n.body); else yield* run(n.else); break;
        case 'wait': yield { wait: Math.max(0, +n.s || 0) }; break;
        case 'waituntil': while (!test(n.cond)) yield null; break;
        case 'set': act[n.target] = val(n.value); break;
        case 'setvar': vars[n.name] = val(n.value); break;
        case 'changevar': vars[n.name] = (+vars[n.name] || 0) + (+n.by || 0); break;
        case 'say': log.push({ t: R.t, text: String(n.text).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? TL.fmtNum(vars[k]) : k in st ? TL.fmtNum(st[k]) : '{' + k + '}')) }); break;
      }
    }
    const gen = run(program);
    R.tick = (dt) => {
      R.t += dt;
      scene.step(st, act, dt);
      while (st.events.length) log.push({ t: R.t, text: st.events.shift(), alert: true });
      if (R.done || R.error) return;
      if (R.waitLeft > 0) { R.waitLeft -= dt; if (R.waitLeft > 1e-9) return; }
      try {
        let k = 0;
        while (k < 200) {
          const r = gen.next();
          if (r.done) { R.done = true; R.current = null; break; }
          if (r.value && r.value.wait != null) { R.waitLeft = r.value.wait; break; }
          if (r.value === null) k++;
        }
      } catch (e) { R.error = e.message; }
    };
    return R;
  }
  TL.makeRunner = makeRunner;

  // Tests automatiques : séquences de consignes capteurs + vérifications
  function runTests(scene, program, tests) {
    const DT = 0.05;
    return tests.map((t) => {
      const R = makeRunner(scene, program, { sensors: t.init });
      const fails = [];
      (t.steps || []).forEach((step, si) => {
        if (fails.length) return;
        Object.assign(R.st, step.set || {});
        const n = Math.round((step.run != null ? step.run : 0.5) / DT);
        for (let i = 0; i < n; i++) R.tick(DT);
        if (R.error) { fails.push(R.error); return; }
        for (const k in step.expect || {}) {
          const exp = step.expect[k];
          const got = k in R.act ? R.act[k] : k in R.st ? R.st[k] : R.vars[k];
          const ok = typeof exp === 'object' && exp != null ? (exp.min == null || got >= exp.min) && (exp.max == null || got <= exp.max) : +got === +exp;
          if (!ok) fails.push(step.why || `Étape ${si + 1} : ${nameOf(scene, k)} vaut ${fmtVal(scene, k, got)}, attendu ${typeof exp === 'object' ? `entre ${exp.min ?? '…'} et ${exp.max ?? '…'}` : fmtVal(scene, k, exp)}.`);
        }
      });
      return { name: t.name, ok: !fails.length, why: fails[0] };
    });
  }
  TL.runBlockTests = runTests;
  function nameOf(scene, k) { const x = scene.actuators.find((a) => a.id === k) || scene.sensors.find((s) => s.id === k); return x ? x.name.toLowerCase() : k; }
  function fmtVal(scene, k, v) {
    const a = scene.actuators.find((x) => x.id === k);
    if (a && a.values) { const f = a.values.find((x) => +x[0] === +v); if (f) return '« ' + f[1] + ' »'; }
    return v == null ? 'rien' : TL.fmtNum(v);
  }

  /* ----- Traduction Python ----- */
  function toPython(list, scene) {
    const out = ['from maquette import lire, ecrire, afficher, attendre', ''];
    const opd = (a) => (a.startsWith('s:') ? `lire("${a.slice(2)}")` : a.slice(2));
    const pyCmp = { '=': '==', '≠': '!=', '<': '<', '>': '>', '≤': '<=', '≥': '>=' };
    const cond = (c) => `${opd(c.a)} ${pyCmp[c.cmp]} ${c.b}` + (c.join && c.c2 ? ` ${c.join === 'et' ? 'and' : 'or'} ` + cond(c.c2) : '');
    const v = (x) => (x && typeof x === 'object' ? (x.var != null ? x.var : `lire("${x.sensor}")`) : String(x));
    const walk = (l, ind) => {
      if (!l || !l.length) { out.push(ind + 'pass'); return; }
      l.forEach((n) => {
        switch (n.op) {
          case 'forever': out.push(ind + 'while True:'); walk(n.body, ind + '    '); break;
          case 'repeat': out.push(ind + `for i in range(${n.n}):`); walk(n.body, ind + '    '); break;
          case 'while': out.push(ind + `while ${cond(n.cond)}:`); walk(n.body, ind + '    '); break;
          case 'if': out.push(ind + `if ${cond(n.cond)}:`); walk(n.body, ind + '    '); break;
          case 'ifelse': out.push(ind + `if ${cond(n.cond)}:`); walk(n.body, ind + '    '); out.push(ind + 'else:'); walk(n.else, ind + '    '); break;
          case 'wait': out.push(ind + `attendre(${n.s})`); break;
          case 'waituntil': out.push(ind + `while not (${cond(n.cond)}):`); out.push(ind + '    pass'); break;
          case 'set': out.push(ind + `ecrire("${n.target}", ${v(n.value)})`); break;
          case 'setvar': out.push(ind + `${n.name} = ${v(n.value)}`); break;
          case 'changevar': out.push(ind + `${n.name} = ${n.name} + ${n.by}`); break;
          case 'say': out.push(ind + `afficher("${String(n.text).replace(/"/g, '\\"')}")`); break;
        }
      });
    };
    walk(list, '');
    return out.join('\n');
  }
  TL.toPython = toPython;

  /* ----- Éditeur de blocs ----- */
  class BlockEditor {
    constructor(cfg, opts) {
      this.cfg = cfg; this.opts = opts || {};
      this.scene = SCENES[cfg.scene] || SCENES.eclairage;
      this.vars = (cfg.vars || []).slice();
      const saved = this.opts.value && this.opts.value.program;
      this.program = ensureIds(TL.clone(saved || cfg.start || []));
      this.collectVars(this.program);
      this.readonly = !!(cfg.demo && !this.opts.editor);
      this.cursor = { list: this.program, index: this.program.length };
      this.dragId = null;
      this.el = h('div.blk');
      this.toolbox = h('div.blk-tools');
      this.area = h('div.blk-area', { role: 'tree', 'aria-label': 'Programme' });
      this.py = h('pre.blk-py.mono', { hidden: true });
      this.pyBtn = h('button.btn.small.ghost', { type: 'button', onclick: () => { this.py.hidden = !this.py.hidden; this.pyBtn.textContent = this.py.hidden ? 'Voir en Python' : 'Masquer Python'; this.drawPy(); } }, 'Voir en Python');
      this.el.append(this.readonly ? null : this.toolbox, h('div.blk-main', h('div.blk-head', h('span.label-up', 'Programme'), this.pyBtn), this.area, this.py));
      this.drawToolbox(); this.draw();
    }
    collectVars(list) { (list || []).forEach((n) => { if (n.name && !this.vars.includes(n.name)) this.vars.push(n.name); if (n.value && n.value.var && !this.vars.includes(n.value.var)) this.vars.push(n.value.var); this.collectVars(n.body); this.collectVars(n.else); }); }
    changed() { this.draw(); if (this.opts.onChange) this.opts.onChange({ program: TL.clone(this.program) }); }
    drawToolbox() {
      const allowed = this.cfg.toolbox && this.cfg.toolbox.length ? this.cfg.toolbox : Object.keys(BLOCKS);
      this.toolbox.innerHTML = '';
      Object.keys(CATS).forEach((cat) => {
        const items = allowed.filter((op) => BLOCKS[op] && BLOCKS[op].cat === cat);
        if (!items.length) return;
        this.toolbox.append(h('div.blk-cat', CATS[cat]), ...items.map((op) => h('button.blk-tool.cat-' + cat, { type: 'button', draggable: true, ondragstart: (e) => { e.dataTransfer.setData('text/plain', 'new:' + op); }, onclick: () => this.insert(op) }, BLOCKS[op].label)));
        if (cat === 'var') this.toolbox.append(h('button.blk-tool.add-var', { type: 'button', onclick: () => this.addVar() }, '+ créer une variable'));
      });
      if (!allowed.some((op) => BLOCKS[op].cat === 'var') && this.vars.length) this.toolbox.append(h('div.small.muted', 'Variables : ' + this.vars.join(', ')));
    }
    addVar() {
      const inp = h('input.field', { type: 'text', placeholder: 'ex. places', 'aria-label': 'Nom de la variable' });
      TL.modal('Nouvelle variable', h('div.form', h('label', 'Nom (lettres, chiffres, _)'), inp), [
        { label: 'Annuler' },
        { label: 'Créer', primary: true, onClick: () => { const n = TL.norm(inp.value).replace(/[^a-z0-9_]/g, '_'); if (!n || /^\d/.test(n)) { TL.toast('Nom invalide.'); return false; } if (!this.vars.includes(n)) this.vars.push(n); this.drawToolbox(); this.draw(); } },
      ]);
    }
    insert(op) {
      const n = newNode(op, this.scene, this.vars.length ? this.vars : ['compteur']);
      if ((op === 'setvar' || op === 'changevar') && !this.vars.includes(n.name)) this.vars.push(n.name);
      const { list, index } = this.cursor;
      list.splice(index, 0, n);
      this.cursor = n.body ? { list: n.body, index: 0 } : { list, index: index + 1 };
      this.changed();
    }
    locate(id, list, parent) {
      list = list || this.program;
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return { list, index: i, node: list[i] };
        for (const k of ['body', 'else']) if (list[i][k]) { const r = this.locate(id, list[i][k]); if (r) return r; }
      }
      return null;
    }
    contains(node, list) { return (node.body && (node.body === list || node.body.some((x) => this.contains(x, list)))) || (node.else && (node.else === list || node.else.some((x) => this.contains(x, list)))); }
    drop(data, list, index) {
      if (this.readonly) return;
      if (data.startsWith('new:')) { this.cursor = { list, index }; this.insert(data.slice(4)); return; }
      const loc = this.locate(data);
      if (!loc) return;
      if (loc.node === undefined || this.contains(loc.node, list)) return;
      loc.list.splice(loc.index, 1);
      if (loc.list === list && loc.index < index) index--;
      list.splice(index, 0, loc.node);
      this.changed();
    }
    draw() {
      this.area.innerHTML = '';
      this.area.append(this.renderList(this.program, true));
      if (!this.program.length && !this.readonly) this.area.append(h('p.small.muted.blk-empty', 'Touche un bloc dans la palette pour l’ajouter ici.'));
      this.drawPy();
    }
    drawPy() { if (!this.py.hidden) this.py.textContent = toPython(this.program, this.scene); }
    slot(list, index) {
      const active = this.cursor.list === list && this.cursor.index === index;
      const s = h('div.blk-slot' + (active ? '.on' : ''), { role: 'button', tabindex: 0, 'aria-label': 'Insérer ici' }, h('span'));
      const set = () => { this.cursor = { list, index }; this.draw(); };
      s.onclick = set; s.onkeydown = (e) => { if (e.key === 'Enter') set(); };
      s.ondragover = (e) => { e.preventDefault(); s.classList.add('over'); };
      s.ondragleave = () => s.classList.remove('over');
      s.ondrop = (e) => { e.preventDefault(); s.classList.remove('over'); this.drop(e.dataTransfer.getData('text/plain'), list, index); };
      return s;
    }
    renderList(list, root) {
      const box = h('div.blk-list' + (root ? '.root' : ''));
      if (!this.readonly) box.append(this.slot(list, 0));
      list.forEach((n, i) => { box.append(this.renderNode(n, list, i)); if (!this.readonly) box.append(this.slot(list, i + 1)); });
      return box;
    }
    renderNode(n, list, i) {
      const B = BLOCKS[n.op] || { cat: 'ctl' };
      const ro = this.readonly;
      const line = h('div.blk-line');
      const sel = (opts, value, on, aria) => { const s = h('select.blk-in', { disabled: ro, 'aria-label': aria || '' }, opts.map(([v, t]) => h('option', { value: v }, t))); s.value = String(value); s.onchange = () => on(s.value); return s; };
      const num = (value, on, w, aria) => { const x = h('input.blk-in.num', { type: 'text', inputmode: 'decimal', value: String(value), disabled: ro, style: { width: (w || 4) + 'ch' }, 'aria-label': aria || 'valeur' }); x.onchange = () => { const v = parseFloat(x.value.replace(',', '.')); on(isFinite(v) ? v : 0); }; return x; };
      const commit = () => this.changed();
      const condUI = (c) => {
        const opts = this.scene.sensors.map((s) => ['s:' + s.id, s.name + (s.unit ? ' (' + s.unit + ')' : '')]).concat(this.vars.map((v) => ['v:' + v, 'variable ' + v]));
        const sensor = c.a.startsWith('s:') ? this.scene.sensors.find((s) => 's:' + s.id === c.a) : null;
        const right = sensor && sensor.kind === 'bool' ? sel([[1, 'vrai (1)'], [0, 'faux (0)']], c.b, (v) => { c.b = +v; commit(); }, 'valeur') : num(c.b, (v) => { c.b = v; commit(); }, 5);
        const parts = [h('span.blk-paren', '⟨'), sel(opts, c.a, (v) => { c.a = v; const s = this.scene.sensors.find((x) => 's:' + x.id === v); if (s && s.kind === 'bool') { c.cmp = '='; c.b = 1; } commit(); }, 'capteur'),
          sel(['=', '≠', '<', '>', '≤', '≥'].map((x) => [x, x]), c.cmp, (v) => { c.cmp = v; commit(); }, 'comparaison'), right];
        if (c.join && c.c2) parts.push(sel([['et', 'et'], ['ou', 'ou']], c.join, (v) => { c.join = v; commit(); }), ...condUI(c.c2).slice(1, -1), ro ? null : h('button.blk-mini', { type: 'button', title: 'Retirer', onclick: () => { delete c.join; delete c.c2; commit(); } }, '−'));
        else if (!ro) parts.push(h('button.blk-mini', { type: 'button', title: 'Ajouter une condition (et / ou)', onclick: () => { c.join = 'et'; c.c2 = defaultCond(this.scene, this.vars); commit(); } }, '+'));
        parts.push(h('span.blk-paren', '⟩'));
        return parts;
      };
      const valUI = (cur, on, actuator) => {
        if (actuator && actuator.values) return sel(actuator.values.map(([v, t]) => [v, t]), cur, (v) => on(+v), 'valeur');
        const isVar = cur && typeof cur === 'object' && cur.var != null;
        const isSen = cur && typeof cur === 'object' && cur.sensor != null;
        const src = sel([['#', 'nombre']].concat(this.vars.map((v) => ['v:' + v, v])).concat(this.scene.sensors.map((s) => ['s:' + s.id, s.name])), isVar ? 'v:' + cur.var : isSen ? 's:' + cur.sensor : '#', (v) => { on(v === '#' ? 0 : v.startsWith('v:') ? { var: v.slice(2) } : { sensor: v.slice(2) }); }, 'source');
        return [src, !isVar && !isSen ? num(cur || 0, (v) => on(v)) : null];
      };
      switch (n.op) {
        case 'forever': line.append('répéter indéfiniment'); break;
        case 'repeat': line.append('répéter', num(n.n, (v) => { n.n = Math.max(0, Math.round(v)); commit(); }, 3, 'nombre de fois'), 'fois'); break;
        case 'while': line.append('tant que', ...condUI(n.cond)); break;
        case 'if': case 'ifelse': line.append('si', ...condUI(n.cond), 'alors'); break;
        case 'wait': line.append('attendre', num(n.s, (v) => { n.s = Math.max(0, v); commit(); }, 4, 'secondes'), 's'); break;
        case 'waituntil': line.append('attendre jusqu’à', ...condUI(n.cond)); break;
        case 'set': {
          const a = this.scene.actuators.find((x) => x.id === n.target) || this.scene.actuators[0];
          line.append('mettre', sel(this.scene.actuators.map((x) => [x.id, x.name]), n.target, (v) => { n.target = v; const na = this.scene.actuators.find((x) => x.id === v); n.value = na.values ? na.values[na.values.length - 1][0] : 0; commit(); }, 'actionneur'), 'à', valUI(n.value, (v) => { n.value = v; commit(); }, a));
          break;
        }
        case 'setvar': line.append('mettre', sel(this.vars.map((v) => [v, v]), n.name, (v) => { n.name = v; commit(); }, 'variable'), 'à', valUI(n.value, (v) => { n.value = v; commit(); })); break;
        case 'changevar': line.append('ajouter', num(n.by, (v) => { n.by = v; commit(); }, 4), 'à', sel(this.vars.map((v) => [v, v]), n.name, (v) => { n.name = v; commit(); }, 'variable')); break;
        case 'say': { const x = h('input.blk-in.txt', { type: 'text', value: n.text, disabled: ro, 'aria-label': 'texte' }); x.onchange = () => { n.text = x.value; commit(); }; line.append('afficher', x); break; }
      }
      const tools = ro ? null : h('span.blk-act',
        h('button.blk-mini', { type: 'button', title: 'Monter', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; commit(); } }, '↑'),
        h('button.blk-mini', { type: 'button', title: 'Descendre', disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; commit(); } }, '↓'),
        h('button.blk-mini', { type: 'button', title: 'Dupliquer', onclick: () => { const c = TL.clone(n); const re = (x) => { x.id = TL.uid('n'); (x.body || []).forEach(re); (x.else || []).forEach(re); }; re(c); list.splice(i + 1, 0, c); commit(); } }, '⧉'),
        h('button.blk-mini.del', { type: 'button', title: 'Supprimer', onclick: () => { list.splice(i, 1); if (this.cursor.list === list && this.cursor.index > i) this.cursor.index--; if (this.contains(n, this.cursor.list) || n.body === this.cursor.list || n.else === this.cursor.list) this.cursor = { list, index: i }; commit(); } }, '✕'));
      const el = h('div.blk-node.cat-' + B.cat, { 'data-id': n.id, role: 'treeitem' }, h('div.blk-row', line, tools));
      if (!ro) {
        el.draggable = true;
        el.addEventListener('dragstart', (e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', n.id); el.classList.add('dragging'); });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));
        el.querySelectorAll('input,select').forEach((x) => { x.addEventListener('mousedown', (e) => e.stopPropagation()); x.draggable = false; });
      }
      if (n.body) el.append(h('div.blk-body', this.renderList(n.body)));
      if (n.op === 'ifelse') el.append(h('div.blk-row.blk-else', 'sinon'), h('div.blk-body', this.renderList(n.else)));
      if (n.body) el.append(h('div.blk-foot'));
      return el;
    }
    highlight(id) {
      TL.$$('.blk-node.running', this.area).forEach((x) => x.classList.remove('running'));
      if (id) { const x = this.area.querySelector(`[data-id="${id}"]`); if (x) x.classList.add('running'); }
    }
  }
  TL.BlockEditor = BlockEditor;

  /* ----- Panneau maquette (exécution en direct) ----- */
  function scenePanel(ed, cfg) {
    const scene = ed.scene;
    let R = null, timer = null, last = 0, speed = 1;
    const view = h('div.scene-view');
    const controls = h('div.scene-ctl');
    const outs = h('div.scene-outs');
    const logBox = h('div.scene-log.mono', { 'aria-live': 'polite' });
    const btnRun = h('button.btn.primary', { type: 'button' }, '▶ Lancer');
    const btnStop = h('button.btn.ghost', { type: 'button', disabled: true }, '■ Arrêter');
    const btnReset = h('button.btn.ghost', { type: 'button' }, '↺ Réinitialiser');
    const spd = h('select.field.small', { 'aria-label': 'Vitesse' }, [[1, '×1'], [2, '×2'], [5, '×5']].map(([v, t]) => h('option', { value: v }, t)));
    spd.onchange = () => (speed = +spd.value);
    const manual = {};
    scene.sensors.forEach((s) => { manual[s.id] = s.def != null ? s.def : 0; });
    const fresh = () => makeRunner(scene, [], { sensors: manual });
    let idle = fresh();
    const cur = () => R || idle;
    const drawCtl = () => {
      controls.innerHTML = '';
      scene.sensors.forEach((s) => {
        const st = cur().st;
        let ctl;
        if (s.control === 'toggle') {
          ctl = h('button.toggle' + (st[s.id] ? '.on' : ''), { type: 'button', 'aria-pressed': String(!!st[s.id]) }, st[s.id] ? s.on : s.off);
          ctl.onclick = () => { manual[s.id] = st[s.id] ? 0 : 1; cur().st[s.id] = manual[s.id]; drawCtl(); paint(); };
        } else if (s.control === 'push') {
          ctl = h('button.toggle.push', { type: 'button' }, s.on);
          const dn = (e) => { e.preventDefault(); cur().st[s.id] = 1; manual[s.id] = 1; ctl.classList.add('on'); paint(); };
          const up = () => { cur().st[s.id] = 0; manual[s.id] = 0; ctl.classList.remove('on'); paint(); };
          ctl.addEventListener('pointerdown', dn); ctl.addEventListener('pointerup', up); ctl.addEventListener('pointerleave', up);
          ctl.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') dn(e); }); ctl.addEventListener('keyup', up);
        } else if (s.control === 'slider') {
          const val = h('span.mono', TL.fmtNum(st[s.id], 0) + ' ' + (s.unit || ''));
          ctl = h('span.slider', h('input', { type: 'range', min: s.min, max: s.max, value: st[s.id], 'aria-label': s.name, oninput: (e) => { manual[s.id] = +e.target.value; cur().st[s.id] = +e.target.value; val.textContent = e.target.value + ' ' + (s.unit || ''); paint(); } }), val);
        } else {
          ctl = h('span.readout.mono', { dataset: { s: s.id } }, fmtSensor(s, st[s.id]));
        }
        controls.append(h('div.ctl-row', h('span.ctl-name', s.name), ctl));
      });
    };
    const fmtSensor = (s, v) => (s.kind === 'bool' ? (v ? '1 · actif' : '0 · inactif') : TL.fmtNum(v, 1) + ' ' + (s.unit || ''));
    const paint = () => {
      const r = cur();
      view.innerHTML = scene.draw(r.st, r.act);
      TL.$$('.readout', controls).forEach((x) => { const s = scene.sensors.find((y) => y.id === x.dataset.s); x.textContent = fmtSensor(s, r.st[s.id]); });
      outs.innerHTML = '';
      scene.actuators.forEach((a) => {
        const v = r.act[a.id];
        const txt = a.values ? (a.values.find((x) => +x[0] === +v) || [v, String(v)])[1] : v == null ? '—' : TL.fmtNum(v);
        outs.append(h('span.pill' + (v && v !== 0 ? '.on' : '.neutral'), h('b', a.name), ' ' + txt));
      });
      Object.keys(r.vars).forEach((k) => outs.append(h('span.pill.var', h('b', k), ' = ' + TL.fmtNum(r.vars[k]))));
    };
    const drawLog = () => {
      const r = cur();
      logBox.innerHTML = '';
      r.log.slice(-6).forEach((l) => logBox.append(h('div' + (l.alert ? '.alert' : ''), h('span.muted', TL.fmtNum(l.t, 1) + ' s  '), l.text)));
      if (r.error) logBox.append(h('div.alert', 'Erreur : ' + r.error));
      if (R && R.done) logBox.append(h('div.muted', 'Programme terminé.'));
    };
    const loop = (t) => {
      if (!R) return;
      const dt = Math.min(0.1, (t - last) / 1000) * speed; last = t;
      const n = Math.max(1, Math.round(dt / 0.02));
      for (let i = 0; i < n; i++) R.tick(dt / n);
      paint(); drawLog(); ed.highlight(R.current);
      if (!view.isConnected) return stop();
      timer = requestAnimationFrame(loop);
    };
    const start = () => {
      R = makeRunner(scene, TL.clone(ed.program), { sensors: Object.assign({}, manual) });
      btnRun.disabled = true; btnStop.disabled = false; last = performance.now();
      timer = requestAnimationFrame(loop);
    };
    const stop = () => { if (timer) cancelAnimationFrame(timer); timer = null; if (R) { idle = R; } R = null; btnRun.disabled = false; btnStop.disabled = true; ed.highlight(null); drawCtl(); paint(); drawLog(); };
    const reset = () => { stop(); idle = fresh(); drawCtl(); paint(); logBox.innerHTML = ''; };
    btnRun.onclick = start; btnStop.onclick = stop; btnReset.onclick = reset;
    drawCtl(); paint();
    return h('div.scene-panel', h('div.scene-title.label-up', scene.name), view, outs,
      h('div.scene-bar', btnRun, btnStop, btnReset, h('label.small', 'Vitesse ', spd)), controls, logBox);
  }
  TL.scenePanel = scenePanel;

  /* ----- Activité ----- */
  TL.activities.blocks = {
    label: 'Programmation par blocs', icon: '⧉', graded: true,
    render(b, ctx) {
      const ed = new BlockEditor(b, { value: ctx.answer && ctx.answer.value, onChange: (v) => ctx.save({ value: v }) });
      const panel = scenePanel(ed, b);
      const tests = b.tests || [];
      const list = h('ul.goals');
      const drawTests = (res) => {
        list.innerHTML = '';
        tests.forEach((t, i) => list.append(h('li' + (res ? (res[i].ok ? '.is-ok' : '.is-bad') : ''), h('span.goal-mark', res ? (res[i].ok ? '✓' : '✗') : '○'), h('span', t.name, res && !res[i].ok && res[i].why ? h('small.why', res[i].why) : null))));
      };
      drawTests(null);
      const bar = !b.demo && tests.length ? TL.checkBar(ctx, {
        checkLabel: 'Tester mon programme',
        allowRetry: true,
        check() {
          const res = runTests(ed.scene, ed.program, tests);
          drawTests(res);
          const good = res.filter((r) => r.ok).length;
          return { value: { program: TL.clone(ed.program) }, correct: good === res.length, score: good / res.length, msg: `${good} test(s) réussi(s) sur ${res.length}.` };
        },
      }) : null;
      if (ctx.answer && ctx.answer.attempts && tests.length && !b.demo) drawTests(runTests(ed.scene, ed.program, tests));
      return h('div.act', b.question ? h('div.qhead', { html: TL.md(b.question) }) : null,
        tests.length && !b.demo ? h('div.goalbox', h('div.label-up', 'Le programme doit…'), list) : null,
        h('div.blk-grid', ed.el, panel), bar);
    },
  };
})();
