/* TechnoStudio — environnement de programmation « façon mBlock » qui se déplie à côté de la feuille.
   Blocs Blockly aux couleurs et libellés de mBlock 5, limités à ceux dont l'activité a besoin :
     • mode « sprite » : le robot vu de dessus sur la scène (x de −240 à 240, y de −180 à 180),
       lignes rouges ou cage selon le décor, pilotage par les flèches ;
     • mode « mbot » : le mBot sur une table avec des obstacles, capteur à ultrasons, moteurs.
   L'interpréteur lit l'espace de travail sérialisé : les tests automatiques tournent sans affichage. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const M = (TL.mblock = {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = (d) => (d * Math.PI) / 180;

  /* ================= Blocs ================= */
  const CATS = {
    events: { name: 'Événements', colour: '#FFBF00' },
    motion: { name: 'Mouvement', colour: '#4C97FF' },
    action: { name: 'Action', colour: '#4C97FF' },
    sensing: { name: 'Capteurs', colour: '#5CB1D6' },
    light: { name: 'Éclairage', colour: '#9966FF' },
    control: { name: 'Contrôle', colour: '#FFAB19' },
    ops: { name: 'Opérateurs', colour: '#59C059' },
  };
  const FLAG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 3v19" stroke="#3d8a36" stroke-width="2.4" stroke-linecap="round"/><path d="M6 4c4-2 6 2 12 0v9c-6 2-8-2-12 0z" fill="#4cbf56" stroke="#3d8a36" stroke-width="1.2" stroke-linejoin="round"/></svg>');
  const nb = (name, value, min, max) => ({ type: 'field_number', name, value, min, max });
  const val = (name, check) => ({ type: 'input_value', name, check });
  const DIRS = [['gauche', 'left'], ['droite', 'right']];
  const DEFS = {
    mb_flag: { cat: 'events', hat: true, message0: 'lorsque vous cliquez sur %1', args0: [{ type: 'field_image', src: FLAG, width: 22, height: 22, alt: 'drapeau vert' }] },
    mb_key: { cat: 'events', hat: true, message0: 'quand la touche %1 est pressée', args0: [{ type: 'field_dropdown', name: 'KEY', options: [['flèche du haut', 'up'], ['flèche du bas', 'down'], ['flèche droite', 'right'], ['flèche gauche', 'left'], ['espace', 'space']] }] },
    mb_start: { cat: 'events', hat: true, message0: 'quand le mBot démarre' },
    mb_move: { cat: 'motion', message0: 'bouger de %1 pas', args0: [nb('N', 10)] },
    mb_turn_right: { cat: 'motion', message0: 'tourner ↻ de %1 degrés', args0: [nb('N', 15)] },
    mb_turn_left: { cat: 'motion', message0: 'tourner ↺ de %1 degrés', args0: [nb('N', 15)] },
    mb_point: { cat: 'motion', message0: 'pointer en direction de %1', args0: [nb('N', 90)] },
    mb_goto: { cat: 'motion', message0: 'aller à x: %1 y: %2', args0: [nb('X', 0), nb('Y', 0)] },
    mb_setx: { cat: 'motion', message0: 'définir x à %1', args0: [nb('N', 0)] },
    mb_sety: { cat: 'motion', message0: 'définir y à %1', args0: [nb('N', 0)] },
    mb_bounce: { cat: 'motion', message0: 'rebondir si le bord est atteint' },
    mb_x: { cat: 'motion', output: 'Number', message0: 'position x' },
    mb_y: { cat: 'motion', output: 'Number', message0: 'position y' },
    mb_dir: { cat: 'motion', output: 'Number', message0: 'direction' },
    mbot_fwd: { cat: 'action', message0: 'avancer à la puissance %1 %%', args0: [nb('P', 50, 0, 100)] },
    mbot_back: { cat: 'action', message0: 'reculer à la puissance %1 %%', args0: [nb('P', 50, 0, 100)] },
    mbot_turn: { cat: 'action', message0: 'tourner à %1 à %2 %%', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }, nb('P', 50, 0, 100)] },
    mbot_fwd_t: { cat: 'action', message0: 'avancer à la puissance %1 %% pendant %2 s', args0: [nb('P', 50, 0, 100), nb('S', 1, 0)] },
    mbot_back_t: { cat: 'action', message0: 'reculer à la puissance %1 %% pendant %2 s', args0: [nb('P', 50, 0, 100), nb('S', 1, 0)] },
    mbot_turn_t: { cat: 'action', message0: 'tourner à %1 à %2 %% pendant %3 s', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }, nb('P', 50, 0, 100), nb('S', 1, 0)] },
    mbot_stop: { cat: 'action', message0: 'arrêter les moteurs' },
    mbot_dist: { cat: 'sensing', output: 'Number', message0: 'distance ultrasons %1 (cm)', args0: [{ type: 'field_dropdown', name: 'PORT', options: [['port3', '3'], ['port1', '1'], ['port2', '2'], ['port4', '4']] }] },
    mbot_led: { cat: 'light', message0: 'allumer la LED %1 en %2', args0: [{ type: 'field_dropdown', name: 'SIDE', options: [['toutes', 'all'], ['gauche', 'left'], ['droite', 'right']] }, { type: 'field_dropdown', name: 'COLOR', options: [['rouge', '#ff3b30'], ['vert', '#30d158'], ['bleu', '#2f7bff'], ['jaune', '#ffd60a'], ['blanc', '#ffffff'], ['éteinte', '']] }] },
    mb_wait: { cat: 'control', message0: 'attendre %1 secondes', args0: [nb('N', 1, 0)] },
    mb_forever: { cat: 'control', end: true, message0: 'répéter indéfiniment', message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
    mb_repeat: { cat: 'control', message0: 'répéter %1 fois', args0: [nb('N', 10, 0)], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
    mb_if: { cat: 'control', message0: 'si %1 alors', args0: [val('COND', 'Boolean')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
    mb_ifelse: { cat: 'control', message0: 'si %1 alors', args0: [val('COND', 'Boolean')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], message2: 'sinon', message3: '%1', args3: [{ type: 'input_statement', name: 'ELSE' }] },
    mb_lt: { cat: 'ops', output: 'Boolean', message0: '%1 < %2', args0: [val('A'), val('B')] },
    mb_gt: { cat: 'ops', output: 'Boolean', message0: '%1 > %2', args0: [val('A'), val('B')] },
    mb_eq: { cat: 'ops', output: 'Boolean', message0: '%1 = %2', args0: [val('A'), val('B')] },
    mb_and: { cat: 'ops', output: 'Boolean', message0: '%1 et %2', args0: [val('A', 'Boolean'), val('B', 'Boolean')] },
    mb_or: { cat: 'ops', output: 'Boolean', message0: '%1 ou %2', args0: [val('A', 'Boolean'), val('B', 'Boolean')] },
    mb_not: { cat: 'ops', output: 'Boolean', message0: 'non %1', args0: [val('A', 'Boolean')] },
  };
  M.DEFS = DEFS;
  // Blocs proposés quand l'activité ne précise pas sa palette
  const DEFAULT_TOOLBOX = {
    sprite: ['mb_flag', 'mb_key', 'mb_move', 'mb_turn_right', 'mb_turn_left', 'mb_point', 'mb_setx', 'mb_sety', 'mb_bounce', 'mb_x', 'mb_y', 'mb_dir', 'mb_wait', 'mb_forever', 'mb_if', 'mb_ifelse', 'mb_lt', 'mb_gt'],
    mbot: ['mb_start', 'mbot_fwd', 'mbot_back', 'mbot_turn', 'mbot_back_t', 'mbot_turn_t', 'mbot_stop', 'mbot_dist', 'mb_wait', 'mb_forever', 'mb_if', 'mb_ifelse', 'mb_lt', 'mb_gt'],
  };
  const DEF_B = { mb_lt: 100, mb_gt: 100, mb_eq: 0 };

  let defined = false;
  function define() {
    if (defined) return;
    const Bl = window.Blockly;
    Object.entries(DEFS).forEach(([type, d]) => {
      const json = Object.assign({ colour: CATS[d.cat].colour, inputsInline: true, tooltip: '' }, d);
      ['cat', 'hat', 'end'].forEach((k) => delete json[k]);
      if (!d.output && !d.hat) json.previousStatement = null;
      if (!d.output && !d.end) json.nextStatement = null;
      Bl.Blocks[type] = { init() { this.jsonInit(json); if (d.hat) this.hat = 'cap'; } };
    });
    Bl.Theme.defineTheme('mblock', {
      base: Bl.Themes.Classic, name: 'mblock',
      fontStyle: { family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weight: '500', size: 11 },
      componentStyles: { workspaceBackgroundColour: '#F9F9F9', toolboxBackgroundColour: '#FFFFFF', flyoutBackgroundColour: '#F2F4F8', flyoutOpacity: 1, scrollbarColour: '#CECDCE', insertionMarkerColour: '#000000', insertionMarkerOpacity: 0.2 },
    });
    defined = true;
  }
  M.load = () => TL.code.load().then(define);

  const shadow = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  function toolbox(list) {
    const contents = [];
    Object.entries(CATS).forEach(([cat, c]) => {
      const items = list.filter((t) => DEFS[t] && DEFS[t].cat === cat).map((type) => {
        const it = { kind: 'block', type };
        if (['mb_lt', 'mb_gt', 'mb_eq'].includes(type)) it.inputs = { A: shadow(''), B: shadow(DEF_B[type]) };
        return it;
      });
      if (items.length) contents.push({ kind: 'category', name: c.name, colour: c.colour, contents: items });
    });
    return { kind: 'categoryToolbox', contents };
  }

  /* ================= Mondes simulés ================= */
  const DECORS = {
    libre: { name: 'Scène libre', lines: [] },
    ligne: { name: 'Ligne rouge (x = 100)', lines: [{ x: 100 }] },
    double: { name: 'Deux lignes rouges (x = −200 et x = 100)', lines: [{ x: -200 }, { x: 100 }] },
    cage: { name: 'Cage rouge (x : −200 à 100, y : −150 à 150)', lines: [{ x: -200, y0: -150, y1: 150 }, { x: 100, y0: -150, y1: 150 }, { y: -150, x0: -200, x1: 100 }, { y: 150, x0: -200, x1: 100 }] },
  };
  const normDir = (d) => { d = ((((d + 180) % 360) + 360) % 360) - 180; return d === -180 ? 180 : d; };
  const statKeys = ['x', 'y', 'dir'];

  function spriteWorld(cfg) {
    const decor = DECORS[cfg.decor] || DECORS.libre;
    const init = Object.assign({ x: -100, y: 0, dir: 90 }, cfg.init);
    const W = { kind: 'sprite', decor, r: 24, events: [] };
    W.reset = () => { Object.assign(W, { x: init.x, y: init.y, dir: init.dir }); W.events = []; W.resetStats(); };
    W.resetStats = () => { W.stats = {}; statKeys.forEach((k) => (W.stats[k] = { min: W[k], max: W[k] })); W.px = W.x; W.py = W.y; };
    W.track = () => {
      statKeys.forEach((k) => { const s = W.stats[k]; s.min = Math.min(s.min, W[k]); s.max = Math.max(s.max, W[k]); });
      decor.lines.forEach((l) => {
        const crossed = l.x != null ? (W.px - l.x) * (W.x - l.x) < 0 : (W.py - l.y) * (W.y - l.y) < 0;
        const inSpan = l.x != null ? l.y0 == null || (W.y >= l.y0 && W.y <= l.y1) : W.x >= l.x0 && W.x <= l.x1;
        if (crossed && inSpan) W.events.push('Le robot a franchi la ligne rouge ' + (l.x != null ? 'x = ' + l.x : 'y = ' + l.y) + ' !');
      });
      W.px = W.x; W.py = W.y;
    };
    const fence = () => { W.x = clamp(W.x, -235, 235); W.y = clamp(W.y, -175, 175); };
    W.move = (n) => { W.x += n * Math.sin(rad(W.dir)); W.y += n * Math.cos(rad(W.dir)); W.x = Math.round(W.x * 1e6) / 1e6; W.y = Math.round(W.y * 1e6) / 1e6; fence(); };
    W.turn = (d) => { W.dir = normDir(W.dir + d); };
    W.point = (d) => { W.dir = normDir(d); };
    W.goto = (x, y) => { W.x = x; W.y = y; fence(); };
    W.bounce = () => {
      const r = W.r;
      const d = { left: W.x - r + 240, right: 240 - W.x - r, top: 180 - W.y - r, bottom: W.y - r + 180 };
      const edge = Object.keys(d).reduce((a, k) => (d[k] < d[a] ? k : a), 'left');
      if (d[edge] > 0) return;
      let dx = Math.sin(rad(W.dir)), dy = Math.cos(rad(W.dir));
      if (edge === 'left') dx = Math.max(0.2, Math.abs(dx));
      if (edge === 'right') dx = -Math.max(0.2, Math.abs(dx));
      if (edge === 'top') dy = -Math.max(0.2, Math.abs(dy));
      if (edge === 'bottom') dy = Math.max(0.2, Math.abs(dy));
      W.dir = normDir(Math.round((Math.atan2(dx, dy) * 180) / Math.PI * 1e6) / 1e6);
      W.x = clamp(W.x, -240 + r, 240 - r); W.y = clamp(W.y, -180 + r, 180 - r);
    };
    W.step = () => {};
    W.monitors = () => [['Robot : position x', fmt(W.x)], ['Robot : direction', fmt(W.dir)], ['Robot : position y', fmt(W.y)]];
    W.draw = (g, s) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 480, 360);
      g.strokeStyle = '#e53935'; g.lineWidth = 4; g.lineCap = 'round';
      g.font = '600 11px Helvetica, Arial, sans-serif'; g.fillStyle = '#e53935';
      decor.lines.forEach((l) => {
        g.beginPath();
        if (l.x != null) { const X = 240 + l.x; g.moveTo(X, 180 - (l.y1 != null ? l.y1 : 180)); g.lineTo(X, 180 - (l.y0 != null ? l.y0 : -180)); }
        else { const Y = 180 - l.y; g.moveTo(240 + l.x0, Y); g.lineTo(240 + l.x1, Y); }
        g.stroke();
        if (l.x != null && l.y0 == null) g.fillText('x = ' + l.x, 240 + l.x + 5, 352);
      });
      drawSpriteRobot(g, 240 + W.x, 180 - W.y, W.dir);
      drawMonitors(g, W.monitors());
    };
    W.reset();
    return W;
  }

  function drawSpriteRobot(g, X, Y, dir) {
    g.save(); g.translate(X, Y); g.rotate(rad(dir - 90));
    g.fillStyle = '#1d1d1d'; g.fillRect(-14, -22, 22, 7); g.fillRect(-14, 15, 22, 7);
    g.fillStyle = '#4C97FF'; g.fillRect(-22, -15, 44, 30);
    g.fillStyle = '#9b9b9b'; g.strokeStyle = '#6b6b6b'; g.lineWidth = 1.5; g.fillRect(-16, -11, 30, 22); g.strokeRect(-16, -11, 30, 22);
    g.fillStyle = '#3a3a3a'; g.fillRect(18, -7, 6, 14);
    g.restore();
  }
  function drawMonitors(g, rows) {
    g.font = '600 10.5px Helvetica, Arial, sans-serif'; g.textBaseline = 'middle';
    rows.forEach(([k, v], i) => {
      const y = 8 + i * 24, wk = g.measureText(k).width, wv = Math.max(30, g.measureText(v).width + 14);
      g.fillStyle = '#E6F0FF'; g.strokeStyle = '#C3D5F5'; g.lineWidth = 1; roundRect(g, 6, y, wk + wv + 20, 20, 4); g.fill(); g.stroke();
      g.fillStyle = '#575E75'; g.fillText(k, 12, y + 10.5);
      g.fillStyle = '#4C97FF'; roundRect(g, 18 + wk, y + 3, wv, 14, 4); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(v, 18 + wk + wv / 2, y + 10.5); g.textAlign = 'left';
    });
    g.textBaseline = 'alphabetic';
  }
  function roundRect(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const fmt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

  /* Le mBot sur une table de 200 × 150 cm (coordonnées en cm, origine au centre, direction 0 = vers le haut) */
  const ARENA = { w: 200, h: 150, obstacles: [{ x: 50, y: 0, w: 24, h: 36 }, { x: -40, y: 48, w: 44, h: 18 }, { x: -58, y: -22, w: 18, h: 30 }] };
  const K_V = 0.3, K_W = 1.6, BODY = 7.5, SENSOR = 4, CONE = [-20, -10, 0, 10, 20];
  function mbotWorld(cfg) {
    const arena = cfg.arena || ARENA;
    const init = Object.assign({ x: -60, y: 0, dir: 90 }, cfg.init);
    const W = { kind: 'mbot', arena, events: [] };
    W.reset = () => {
      Object.assign(W, { x: init.x, y: init.y, dir: init.dir, l: 0, r: 0, leds: ['', ''], chocs: 0, parcours: 0, touching: false, obstacles: TL.clone(arena.obstacles) });
      W.events = []; W.resetStats();
    };
    W.resetStats = () => { W.stats = { chocs: { min: 0, max: 0 }, parcours: { min: 0, max: 0 } }; W.chocs = 0; W.parcours = 0; };
    W.track = () => {};
    W.motors = (l, r) => { W.l = clamp(l, -100, 100); W.r = clamp(r, -100, 100); };
    W.led = (side, c) => { if (side !== 'right') W.leds[0] = c; if (side !== 'left') W.leds[1] = c; };
    // Contacts du corps (cercle) avec les murs et les boîtes : point de contact le plus proche
    const contacts = (x, y) => {
      const out = [], hw = arena.w / 2, hh = arena.h / 2;
      if (x > hw - BODY) out.push([hw, y]); if (x < -hw + BODY) out.push([-hw, y]);
      if (y > hh - BODY) out.push([x, hh]); if (y < -hh + BODY) out.push([x, -hh]);
      W.obstacles.forEach((o) => { const px = clamp(x, o.x - o.w / 2, o.x + o.w / 2), py = clamp(y, o.y - o.h / 2, o.y + o.h / 2); if ((x - px) ** 2 + (y - py) ** 2 < BODY * BODY) out.push([px, py]); });
      return out;
    };
    W.step = (dt) => {
      const v = ((W.l + W.r) / 2) * K_V, w = ((W.l - W.r) / 2) * K_W;
      W.dir = normDir(W.dir + w * dt);
      let nx = W.x + v * dt * Math.sin(rad(W.dir)), ny = W.y + v * dt * Math.cos(rad(W.dir));
      const ahead = v >= 0 ? W.dir : W.dir + 180;
      let hit = false;
      for (const [px, py] of v ? contacts(nx, ny) : []) {
        const d = Math.hypot(nx - px, ny - py) || 1e-6;
        if (Math.abs(normDir((Math.atan2(px - nx, py - ny) * 180) / Math.PI - ahead)) < 30) { hit = true; break; } // contact devant : choc
        nx += ((nx - px) / d) * (BODY - d); ny += ((ny - py) / d) * (BODY - d); // contact sur le côté : le robot frotte et glisse
      }
      if (hit) {
        if (!W.touching) { W.chocs++; W.events.push('Choc ! Le mBot a heurté un obstacle.'); }
        W.touching = true;
      } else {
        if (v) W.touching = false;
        W.parcours += Math.hypot(nx - W.x, ny - W.y); W.x = nx; W.y = ny;
      }
      W.stats.chocs.max = W.chocs; W.stats.parcours.max = W.parcours;
    };
    // Lancer de rayon depuis le capteur : distance au premier mur ou obstacle (3 rayons pour le cône)
    const ray = (ox, oy, d) => {
      const dx = Math.sin(rad(d)), dy = Math.cos(rad(d));
      let best = 400;
      const rect = (x0, x1, y0, y1) => {
        let t0 = -Infinity, t1 = Infinity;
        for (const [o, dd, a, b] of [[ox, dx, x0, x1], [oy, dy, y0, y1]]) {
          if (Math.abs(dd) < 1e-9) { if (o < a || o > b) return; continue; }
          let ta = (a - o) / dd, tb = (b - o) / dd; if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        }
        if (t0 <= t1 && t0 >= 0) best = Math.min(best, t0);
      };
      const W2 = arena.w / 2, H2 = arena.h / 2;
      if (dx > 1e-9) best = Math.min(best, (W2 - ox) / dx); if (dx < -1e-9) best = Math.min(best, (-W2 - ox) / dx);
      if (dy > 1e-9) best = Math.min(best, (H2 - oy) / dy); if (dy < -1e-9) best = Math.min(best, (-H2 - oy) / dy);
      W.obstacles.forEach((o) => rect(o.x - o.w / 2, o.x + o.w / 2, o.y - o.h / 2, o.y + o.h / 2));
      return best;
    };
    W.distance = () => {
      const ox = W.x + SENSOR * Math.sin(rad(W.dir)), oy = W.y + SENSOR * Math.cos(rad(W.dir));
      return Math.round(Math.min(400, ...CONE.map((c) => ray(ox, oy, W.dir + c))) * 10) / 10;
    };
    W.monitors = () => [['distance ultrasons port3', fmt(W.distance()) + ' cm'], ['chocs', String(W.chocs)]];
    W.draw = (g) => {
      const S = 480 / arena.w, cx = 240, cy = 180;
      const P = (x, y) => [cx + x * S, cy - y * S];
      g.fillStyle = '#5a4634'; g.fillRect(0, 0, 480, 360);
      g.fillStyle = '#f3efe6'; g.fillRect(4, 4, 472, 352);
      g.strokeStyle = 'rgba(0,0,0,.06)'; g.lineWidth = 1;
      for (let x = -arena.w / 2 + 10; x < arena.w / 2; x += 10) { const [X] = P(x, 0); g.beginPath(); g.moveTo(X, 4); g.lineTo(X, 356); g.stroke(); }
      for (let y = -arena.h / 2 + 10; y < arena.h / 2; y += 10) { const [, Y] = P(0, y); g.beginPath(); g.moveTo(4, Y); g.lineTo(476, Y); g.stroke(); }
      W.obstacles.forEach((o) => {
        const [X, Y] = P(o.x - o.w / 2, o.y + o.h / 2);
        g.fillStyle = '#c99b5f'; g.strokeStyle = '#8a6334'; g.lineWidth = 2; g.fillRect(X, Y, o.w * S, o.h * S); g.strokeRect(X, Y, o.w * S, o.h * S);
        g.strokeStyle = 'rgba(138,99,52,.5)'; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + o.w * S, Y + o.h * S); g.stroke();
      });
      // faisceau du capteur
      const d = W.distance();
      const [sx, sy] = P(W.x + SENSOR * Math.sin(rad(W.dir)), W.y + SENSOR * Math.cos(rad(W.dir)));
      g.save(); g.translate(sx, sy); g.rotate(rad(W.dir));
      const L = Math.min(d, 400) * S;
      g.fillStyle = d < 10 ? 'rgba(229,57,53,.22)' : 'rgba(76,151,255,.16)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-Math.tan(rad(20)) * L, -L); g.lineTo(Math.tan(rad(20)) * L, -L); g.closePath(); g.fill();
      g.restore();
      const [X, Y] = P(W.x, W.y);
      drawMbot(g, X, Y, W.dir, S, W.leds, W.touching);
      drawMonitors(g, W.monitors());
    };
    W.reset();
    return W;
  }
  function drawMbot(g, X, Y, dir, S, leds, hit) {
    g.save(); g.translate(X, Y); g.rotate(rad(dir)); g.scale(S / 2.4, S / 2.4);
    if (hit) { g.fillStyle = 'rgba(229,57,53,.35)'; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill(); }
    g.fillStyle = '#1f1f1f'; g.fillRect(-22, -10, 6, 20); g.fillRect(16, -10, 6, 20);
    g.fillStyle = '#5b9be6'; g.strokeStyle = '#2d5f9e'; g.lineWidth = 1.5; roundRect(g, -16, -20, 32, 38, 5); g.fill(); g.stroke();
    g.fillStyle = '#1c4f9c'; g.fillRect(-10, -8, 20, 16);
    g.fillStyle = '#2d5f9e'; g.fillRect(-12, -26, 24, 8);
    g.fillStyle = '#dfe3ea'; g.beginPath(); g.arc(-6, -22, 3.2, 0, 7); g.arc(6, -22, 3.2, 0, 7); g.fill();
    [[-7, leds[0]], [7, leds[1]]].forEach(([x, c]) => { g.fillStyle = c || '#e8e8e8'; g.beginPath(); g.arc(x, -13, 2.2, 0, 7); g.fill(); });
    g.restore();
  }

  M.world = (cfg) => (cfg.mode === 'mbot' ? mbotWorld(cfg) : spriteWorld(cfg));

  /* ================= Interpréteur (fils d'exécution à la Scratch) ================= */
  const tops = (state) => (state && state.blocks && state.blocks.blocks) || [];
  class Runtime {
    constructor(world) { this.world = world; this.threads = []; this.state = null; this.error = null; this.ops = 0; }
    fire(kind, key) {
      if (kind !== 'key') this.stopAll();
      const type = { flag: 'mb_flag', start: 'mb_start', key: 'mb_key' }[kind];
      tops(this.state).filter((b) => b.type === type && (kind !== 'key' || (b.fields && b.fields.KEY) === key)).forEach((top) => {
        const id = top.id || top;
        if (this.threads.some((T) => T.top === id)) return; // une touche n'interrompt pas le script déjà lancé
        const T = { top: id, kind, wait: 0 };
        T.gen = this.seq(top.next && top.next.block);
        this.threads.push(T);
      });
    }
    stopAll() { this.threads = []; if (this.world.motors) this.world.motors(0, 0); }
    val(inp) { const b = inp && (inp.block || inp.shadow); return b ? this.ev(b) : 0; }
    ev(b) {
      const W = this.world, f = b.fields || {}, i = b.inputs || {};
      switch (b.type) {
        case 'math_number': return +f.NUM || 0;
        case 'mb_x': return W.x || 0;
        case 'mb_y': return W.y || 0;
        case 'mb_dir': return W.dir || 0;
        case 'mbot_dist': return W.distance ? W.distance() : 400;
        case 'mb_lt': return this.val(i.A) < this.val(i.B);
        case 'mb_gt': return this.val(i.A) > this.val(i.B);
        case 'mb_eq': return Math.abs(this.val(i.A) - this.val(i.B)) < 1e-9;
        case 'mb_and': return !!this.val(i.A) && !!this.val(i.B);
        case 'mb_or': return !!this.val(i.A) || !!this.val(i.B);
        case 'mb_not': return !this.val(i.A);
      }
      return 0;
    }
    *seq(b) { while (b) { yield* this.exec(b); b = b.next && b.next.block; } }
    *exec(b) {
      const W = this.world, f = b.fields || {}, i = b.inputs || {};
      const sub = (k) => i[k] && i[k].block;
      const p = clamp(+f.P || 0, 0, 100), s = Math.max(0, +f.S || 0);
      if (++this.ops > 2e6) throw new Error('Programme trop long.');
      switch (b.type) {
        case 'mb_move': W.move && W.move(+f.N || 0); break;
        case 'mb_turn_right': W.turn && W.turn(+f.N || 0); break;
        case 'mb_turn_left': W.turn && W.turn(-(+f.N || 0)); break;
        case 'mb_point': W.point && W.point(+f.N || 0); break;
        case 'mb_goto': W.goto && W.goto(+f.X || 0, +f.Y || 0); break;
        case 'mb_setx': W.goto && W.goto(+f.N || 0, W.y); break;
        case 'mb_sety': W.goto && W.goto(W.x, +f.N || 0); break;
        case 'mb_bounce': W.bounce && W.bounce(); break;
        case 'mb_wait': yield { wait: Math.max(0, +f.N || 0) }; break;
        case 'mb_forever': for (;;) { yield* this.seq(sub('DO')); yield null; }
        case 'mb_repeat': for (let k = 0; k < Math.min(1e4, Math.round(+f.N || 0)); k++) { yield* this.seq(sub('DO')); yield null; } break;
        case 'mb_if': if (this.val(i.COND)) yield* this.seq(sub('DO')); break;
        case 'mb_ifelse': if (this.val(i.COND)) yield* this.seq(sub('DO')); else yield* this.seq(sub('ELSE')); break;
        case 'mbot_fwd': W.motors(p, p); break;
        case 'mbot_back': W.motors(-p, -p); break;
        case 'mbot_turn': f.DIR === 'right' ? W.motors(p, -p) : W.motors(-p, p); break;
        case 'mbot_fwd_t': W.motors(p, p); yield { wait: s }; W.motors(0, 0); break;
        case 'mbot_back_t': W.motors(-p, -p); yield { wait: s }; W.motors(0, 0); break;
        case 'mbot_turn_t': f.DIR === 'right' ? W.motors(p, -p) : W.motors(-p, p); yield { wait: s }; W.motors(0, 0); break;
        case 'mbot_stop': W.motors(0, 0); break;
        case 'mbot_led': W.led(f.SIDE, f.COLOR); break;
      }
      W.track();
    }
    step(dt) {
      this.world.step(dt);
      for (const T of this.threads) {
        if (T.wait > 0) { T.wait -= dt; if (T.wait > 1e-9) continue; }
        try {
          for (;;) {
            const r = T.gen.next();
            if (r.done) { T.done = true; break; }
            if (r.value && r.value.wait != null) { T.wait = r.value.wait; break; }
            if (r.value === null) break;
          }
        } catch (e) { this.error = e.message; T.done = true; }
      }
      this.threads = this.threads.filter((T) => !T.done);
    }
  }
  M.Runtime = Runtime;
  const DT = 1 / 30;

  /* ================= Tests automatiques =================
     test = { name, steps: [ { flag | start | key: 'up', n | run: s | set: {x, dir…} } ], expect: [ { v, max, min, reachMax, reachMin } ] } */
  const LABEL = { x: 'la position x', y: 'la position y', dir: 'la direction', chocs: 'le nombre de chocs', parcours: 'la distance parcourue (cm)' };
  function runTest(cfg, state, t) {
    const W = M.world(cfg), R = new Runtime(W);
    R.state = state;
    const frames = (n) => { for (let k = 0; k < n && !R.error; k++) R.step(DT); };
    (t.steps || []).forEach((st) => {
      if (R.error) return;
      if (st.flag || st.start) { R.fire(st.flag ? 'flag' : 'start'); R.step(DT); W.resetStats(); }
      if (st.set) { Object.assign(W, st.set); W.track(); }
      // une pression = une image, puis on laisse finir les scripts de touche (comme une touche maintenue)
      if (st.key) for (let k = 0; k < (st.n || 1); k++) { R.fire('key', st.key); let m = 0; do R.step(DT); while (R.threads.some((T) => T.kind === 'key') && ++m < 30); }
      if (st.run) frames(Math.round(st.run / DT));
    });
    if (R.error) return { name: t.name, ok: false, why: 'Erreur : ' + R.error };
    for (const e of t.expect || []) {
      const s = W.stats[e.v]; if (!s) continue;
      const n = (v) => fmt(v);
      if (e.max != null && s.max > e.max + 1e-6) return { name: t.name, ok: false, why: e.why || `${cap(LABEL[e.v])} monte jusqu’à ${n(s.max)} : il ne faut pas dépasser ${n(e.max)}.` };
      if (e.min != null && s.min < e.min - 1e-6) return { name: t.name, ok: false, why: e.why || `${cap(LABEL[e.v])} descend jusqu’à ${n(s.min)} : il ne faut pas aller en dessous de ${n(e.min)}.` };
      if (e.reachMax != null && s.max < e.reachMax) return { name: t.name, ok: false, why: e.whyReach || `${cap(LABEL[e.v])} n’atteint jamais ${n(e.reachMax)} (au plus ${n(s.max)}).` };
      if (e.reachMin != null && s.min > e.reachMin) return { name: t.name, ok: false, why: e.whyReach || `${cap(LABEL[e.v])} ne descend jamais jusqu’à ${n(e.reachMin)} (au plus bas ${n(s.min)}).` };
      if (e.finalMax != null && W[e.v] > e.finalMax) return { name: t.name, ok: false, why: e.whyFinal || `À la fin, ${LABEL[e.v]} vaut ${n(W[e.v])}.` };
    }
    return { name: t.name, ok: true };
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  M.runTests = (cfg, state) => (cfg.tests || []).map((t) => runTest(cfg, state, t));

  const countBlocks = (state) => { let n = 0; const walk = (b) => { if (!b) return; n++; Object.values(b.inputs || {}).forEach((i) => walk(i.block)); walk(b.next && b.next.block); }; tops(state).forEach(walk); return n; };

  /* ================= Panneau latéral ================= */
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ' ': 'space' };
  const P = { el: null, cur: null, focus: false, raf: 0 };
  const WKEY = 'technostudio.mblock.largeur';

  function panel() {
    if (P.el) return P.el;
    const host = document.getElementById('workspace') || document.body;
    const el = h('aside.mbk-side', { 'aria-label': 'Environnement de programmation mBlock' });
    const grip = h('div.mbk-grip', { title: 'Glisser pour élargir', role: 'separator', 'aria-orientation': 'vertical' });
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault(); grip.setPointerCapture(e.pointerId);
      const right = host.getBoundingClientRect().right;
      const mv = (ev) => setWidth(right - ev.clientX);
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); try { localStorage.setItem(WKEY, host.style.getPropertyValue('--mbk-w')); } catch (err) { /* stockage indisponible */ } };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
    el.append(grip, h('div.mbk-inner'));
    host.append(el);
    let saved = null; try { saved = localStorage.getItem(WKEY); } catch (e) { /* stockage indisponible */ }
    if (saved) host.style.setProperty('--mbk-w', saved);
    document.addEventListener('pointerdown', (e) => { P.focus = !!(P.el && P.el.contains(e.target)); }, true);
    document.addEventListener('keydown', onKey);
    P.el = el; P.host = host;
    return el;
  }
  function setWidth(px) {
    const max = P.host.getBoundingClientRect().width - 320;
    P.host.style.setProperty('--mbk-w', Math.round(clamp(px, 460, Math.max(460, max))) + 'px');
  }
  function onKey(e) {
    const c = P.cur; if (!c || !P.focus || c.cfg.mode === 'mbot') return;
    const k = KEYS[e.key]; if (!k) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    c.press(k);
  }

  M.close = function () {
    const c = P.cur; if (!c) return;
    c.flush(); cancelAnimationFrame(P.raf);
    try { c.ws.dispose(); } catch (e) { /* déjà détruit */ }
    P.cur = null;
    P.host.classList.remove('mbk-open');
    refreshCards();
  };

  M.open = async function (b, ctx) {
    panel();
    if (P.cur && P.cur.b === b) return;
    if (P.cur) M.close();
    const inner = P.el.querySelector('.mbk-inner');
    inner.innerHTML = '';
    inner.append(h('p.mbk-loading', 'Chargement de mBlock…'));
    P.host.classList.add('mbk-open');
    try { await M.load(); } catch (e) { inner.innerHTML = ''; inner.append(h('p.callout.warn', e.message)); return; }
    build(b, ctx, inner);
    refreshCards();
  };

  function build(b, ctx, inner) {
    const cfg = b, mode = cfg.mode === 'mbot' ? 'mbot' : 'sprite';
    const W = M.world(cfg), R = new Runtime(W);
    const c = { b, cfg, ctx, W, R };
    P.cur = c;
    inner.innerHTML = '';
    // En-tête
    const top = h('header.mbk-top',
      h('span.mbk-logo', 'mBlock'),
      h('span.mbk-mode', mode === 'mbot' ? 'mBot · simulation' : (DECORS[cfg.decor] || DECORS.libre).name),
      h('span.mbk-sp'),
      h('button.mbk-x', { type: 'button', title: 'Replier l’environnement', 'aria-label': 'Fermer', onclick: () => M.close() }, '✕'));
    const consigne = b.question ? h('div.mbk-consigne', { html: TL.inlineMd(b.question) }) : null;
    // Scène
    const canvas = h('canvas.mbk-canvas', { width: 480, height: 360, 'aria-label': mode === 'mbot' ? 'Table de test du mBot' : 'Scène du robot' });
    const g = canvas.getContext('2d');
    const btnGo = h('button.mbk-go', { type: 'button', title: mode === 'mbot' ? 'Démarrer le mBot' : 'Drapeau vert' }, h('img', { src: FLAG, alt: '' }), mode === 'mbot' ? ' Démarrer' : '');
    const btnStop = h('button.mbk-stop', { type: 'button', title: 'Arrêter', 'aria-label': 'Arrêter' });
    const btnReset = h('button.mbk-btn', { type: 'button', title: 'Remettre la scène comme au départ' }, '↺ Replacer');
    btnGo.onclick = () => { R.error = null; R.fire(mode === 'mbot' ? 'start' : 'flag'); };
    btnStop.onclick = () => R.stopAll();
    btnReset.onclick = () => { R.stopAll(); W.reset(); };
    const bar = h('div.mbk-stagebar', btnGo, btnStop, h('span.mbk-sp'), btnReset);
    let pad = null;
    if (mode === 'sprite') {
      const key = (k, label, aria) => {
        const bt = h('button.mbk-key', { type: 'button', 'aria-label': aria, dataset: { k } }, label);
        let t1 = 0, t2 = 0;
        const stop = () => { clearTimeout(t1); clearInterval(t2); bt.classList.remove('on'); };
        bt.addEventListener('pointerdown', (e) => { e.preventDefault(); c.press(k); bt.classList.add('on'); t1 = setTimeout(() => { t2 = setInterval(() => c.press(k), 70); }, 350); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => bt.addEventListener(ev, stop));
        return bt;
      };
      pad = h('div.mbk-pad', h('span.small.muted', 'Touches :'), key('left', '←', 'flèche gauche'), key('up', '↑', 'flèche du haut'), key('down', '↓', 'flèche du bas'), key('right', '→', 'flèche droite'), h('span.small.muted.mbk-hint', 'ou le clavier, après un clic sur la scène'));
    }
    const logBox = h('div.mbk-log', { 'aria-live': 'polite' });
    // Tests
    const tests = cfg.tests || [];
    const list = h('ul.goals.mbk-goals');
    const drawTests = (res) => {
      list.innerHTML = '';
      tests.forEach((t, i) => list.append(h('li' + (res ? (res[i].ok ? '.is-ok' : '.is-bad') : ''), h('span.goal-mark', res ? (res[i].ok ? '✓' : '✗') : '○'), h('span', t.name, res && !res[i].ok && res[i].why ? h('small.why', res[i].why) : null))));
    };
    drawTests(ctx.answer && ctx.answer.value && ctx.answer.value.tests);
    const check = tests.length && !b.demo ? TL.checkBar(ctx, {
      checkLabel: 'Tester mon programme', allowRetry: true,
      check() {
        c.flush();
        const state = save(), res = M.runTests(cfg, state);
        drawTests(res);
        const good = res.filter((r) => r.ok).length;
        const out = { value: { workspace: state, tests: res }, correct: good === res.length, score: good / res.length, msg: `${good} test(s) réussi(s) sur ${res.length}.` };
        setTimeout(refreshCards, 0);
        return out;
      },
    }) : null;
    const left = h('div.mbk-left', h('div.mbk-stagewrap', canvas), bar, pad, logBox, tests.length ? h('div.mbk-tests', h('div.label-up', 'Tests'), list, check) : null);
    const code = h('div.mbk-code');
    inner.append(top, consigne, h('div.mbk-main', left, code));

    // Blockly
    const Bl = window.Blockly;
    const allowed = (cfg.toolbox && cfg.toolbox.length ? cfg.toolbox : DEFAULT_TOOLBOX[mode]).filter((t) => DEFS[t]);
    const ws = (c.ws = Bl.inject(code, {
      toolbox: toolbox(allowed), renderer: 'zelos', theme: 'mblock', media: TL.code.media || undefined, trashcan: false, sounds: false,
      zoom: { controls: true, wheel: true, startScale: 0.68, maxScale: 1.6, minScale: 0.35, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: true }, grid: { spacing: 24, length: 2, colour: '#ddd', snap: false }, readOnly: !!b.demo,
    }));
    const start = (ctx.answer && ctx.answer.value && ctx.answer.value.workspace) || cfg.start || { blocks: { languageVersion: 0, blocks: [] } };
    try { Bl.serialization.workspaces.load(start, ws); } catch (e) { console.warn(e); }
    function save() { return c.ws ? Bl.serialization.workspaces.save(c.ws) : start; }
    R.state = save();
    const initial = JSON.stringify(R.state);
    let dirty = false;
    const persist = TL.debounce(() => { if (!b.demo) ctx.save({ value: Object.assign({}, ctx.answer && ctx.answer.value, { workspace: R.state }) }); refreshCards(); }, 500);
    ws.addChangeListener((e) => { if (e.isUiEvent) return; R.state = save(); if (!dirty && JSON.stringify(R.state) === initial) return; dirty = true; persist(); });
    c.flush = () => { R.state = save(); if (!b.demo && dirty) ctx.save({ value: Object.assign({}, ctx.answer && ctx.answer.value, { workspace: R.state }) }); };
    c.press = (k) => { P.focus = true; R.error = null; R.fire('key', k); };
    new ResizeObserver(() => Bl.svgResize(ws)).observe(code);
    P.el.addEventListener('transitionend', () => Bl.svgResize(ws), { once: true });

    // Glisser le robot (ou un obstacle) sur la scène
    canvas.addEventListener('pointerdown', (e) => {
      P.focus = true;
      const rc = canvas.getBoundingClientRect();
      const toWorld = (ev) => {
        const px = ((ev.clientX - rc.left) / rc.width) * 480, py = ((ev.clientY - rc.top) / rc.height) * 360;
        return mode === 'mbot' ? [(px - 240) / (480 / W.arena.w), (180 - py) / (480 / W.arena.w)] : [px - 240, 180 - py];
      };
      const [x0, y0] = toWorld(e);
      let target = null;
      if (Math.hypot(x0 - W.x, y0 - W.y) < (mode === 'mbot' ? 14 : 30)) target = W;
      else if (mode === 'mbot') target = W.obstacles.find((o) => Math.abs(x0 - o.x) < o.w / 2 && Math.abs(y0 - o.y) < o.h / 2) || null;
      if (!target) return;
      canvas.setPointerCapture(e.pointerId);
      const ox = target.x - x0, oy = target.y - y0;
      const mv = (ev) => { const [x, y] = toWorld(ev); target.x = Math.round(x + ox); target.y = Math.round(y + oy); if (target === W) { W.px = W.x; W.py = W.y; } };
      const up = () => { canvas.removeEventListener('pointermove', mv); canvas.removeEventListener('pointerup', up); };
      canvas.addEventListener('pointermove', mv); canvas.addEventListener('pointerup', up);
    });

    // Boucle d'animation
    let last = performance.now(), acc = 0, lastHi = new Set(), check1 = 0;
    const loop = (t) => {
      if (P.cur !== c) return;
      acc += Math.min(0.25, (t - last) / 1000); last = t;
      while (acc >= DT) { R.step(DT); acc -= DT; }
      W.draw(g);
      // blocs de départ des scripts en cours : surbrillance
      const hi = new Set(R.threads.map((T) => T.top));
      lastHi.forEach((id) => { if (!hi.has(id) && ws.getBlockById(id)) ws.highlightBlock(id, false); });
      hi.forEach((id) => { if (!lastHi.has(id) && ws.getBlockById(id)) ws.highlightBlock(id, true); });
      lastHi = hi;
      if (W.events.length || R.error) {
        W.events.splice(0).forEach((m) => logBox.prepend(h('div.alert', m)));
        if (R.error) { logBox.prepend(h('div.alert', 'Erreur : ' + R.error)); R.error = null; }
        while (logBox.childNodes.length > 4) logBox.lastChild.remove();
      }
      if (++check1 % 30 === 0 && !document.querySelector(`.mbk-card[data-b="${CSS.escape(b.id)}"]`)) { M.close(); return; }
      P.raf = requestAnimationFrame(loop);
    };
    P.raf = requestAnimationFrame(loop);
  }

  function refreshCards() { TL.$$('.mbk-card').forEach((x) => x.refresh && x.refresh()); }

  /* ================= Activité « mblock » dans une feuille ================= */
  TL.activities.mblock = {
    label: 'Programmer dans mBlock (simulation)', icon: '🧩', graded: true,
    render(b, ctx) {
      const mode = b.mode === 'mbot' ? 'mbot' : 'sprite';
      const state = h('span.mbk-state');
      const btn = h('button.btn.primary.mbk-open-btn', { type: 'button' });
      const card = h('div.mbk-card', { dataset: { b: b.id } },
        h('div.mbk-card-ico', { 'aria-hidden': 'true' }, mode === 'mbot' ? '🤖' : '🧩'),
        h('div.mbk-card-txt', h('b', mode === 'mbot' ? 'Programmer le mBot dans mBlock' : 'Programmer le robot dans mBlock'), h('span.small.muted', mode === 'mbot' ? 'Simulation : le mBot roule sur une table avec des obstacles.' : (DECORS[b.decor] || DECORS.libre).name), state),
        btn);
      card.refresh = () => {
        const open = P.cur && P.cur.b.id === b.id;
        btn.textContent = open ? '◂ Replier mBlock' : 'Programmer ▸';
        card.classList.toggle('on', !!open);
        const a = ctx.answer, v = a && a.value;
        const n = v && v.workspace ? countBlocks(v.workspace) : 0;
        const t = v && v.tests;
        state.textContent = (n ? n + ' bloc' + (n > 1 ? 's' : '') : 'Programme pas encore commencé') + (t && t.length ? ` · tests : ${t.filter((x) => x.ok).length}/${t.length}` : '');
      };
      btn.onclick = () => (P.cur && P.cur.b.id === b.id ? M.close() : M.open(b, ctx));
      card.refresh();
      return card;
    },
  };
})();
