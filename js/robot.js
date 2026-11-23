/* TechnoStudio — environnement « Robots » : programmer le mBot et le Maqueen avec les mêmes blocs.
   • Blocs communs aux deux robots (couleurs et libellés façon mBlock) : un seul programme.
   • Deux générateurs :
       mBot (carte mCore = Arduino Uno)  → C++ sans bibliothèque Makeblock (broches pilotées
                                            directement), compilé par le serveur (carte « uno »),
                                            écrit dans le robot par Web Serial (STK500, flash.js) ;
       Maqueen Lite (micro:bit)          → MicroPython, transformé en .hex par le serveur
                                            (carte « microbit »), enregistré sur le lecteur MICROBIT.
   • On change de robot à tout moment : les blocs restent, le code est régénéré pour l'autre
     robot ; un bloc qu'un robot ne sait pas faire est signalé (triangle) au lieu d'être perdu.
   • Le port USB du mBot est retenu : on passe d'un robot à l'autre sans tout refaire. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const R = (TL.robot = {});

  /* ================= Robots ================= */
  R.ROBOTS = {
    mbot: {
      name: 'mBot', long: 'mBot (carte mCore)', icon: '🤖', lang: 'cpp', langName: 'C++ (Arduino)', carte: 'uno', fichier: 'mbot.ino',
      cable: 'Câble USB du mBot (le robot allumé).',
      brochage: 'Moteurs M1 (gauche) et M2 (droit) · ultrasons sur le port 3 · suiveur de ligne sur le port 2 · 2 LED RGB · buzzer · bouton de la carte.',
    },
    maqueen: {
      name: 'Maqueen', long: 'Maqueen Lite (micro:bit)', icon: '🚗', lang: 'mpy', langName: 'MicroPython', carte: 'microbit', fichier: 'maqueen.hex',
      cable: 'Câble USB de la micro:bit (lecteur MICROBIT).',
      brochage: 'Moteurs par I2C (0x10) · ultrasons P1/P2 · suiveurs de ligne P13/P14 · LED rouges P8/P12 · 4 LED RGB P15 · buzzer P0 · boutons A et B.',
    },
  };
  R.LIST = Object.keys(R.ROBOTS);
  // Image détourée du robot (js/robot-img.js), l'émoji sinon
  R.img = (k, cls) => { const src = (window.TL_ROBOT_IMG || {})[k]; return src ? h('img.rbt-img' + (cls || ''), { src, alt: '', draggable: 'false' }) : h('span' + (cls || ''), R.ROBOTS[k].icon); };

  /* ================= Blocs ================= */
  const CATS = {
    events: { name: 'Événements', colour: '#FFBF00' },
    action: { name: 'Moteurs', colour: '#4C97FF' },
    sensing: { name: 'Capteurs', colour: '#5CB1D6' },
    light: { name: 'Éclairage', colour: '#9966FF' },
    sound: { name: 'Son et affichage', colour: '#CF63CF' },
    control: { name: 'Contrôle', colour: '#FFAB19' },
    ops: { name: 'Opérateurs', colour: '#59C059' },
  };
  const ROBOT_ICO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="11" rx="3" fill="#fff" stroke="#b07d00" stroke-width="1.4"/><circle cx="9" cy="12.5" r="1.8" fill="#b07d00"/><circle cx="15" cy="12.5" r="1.8" fill="#b07d00"/><path d="M12 7V4" stroke="#b07d00" stroke-width="1.4"/><circle cx="12" cy="3.4" r="1.3" fill="#b07d00"/><rect x="2" y="15" width="3" height="5" rx="1" fill="#555"/><rect x="19" y="15" width="3" height="5" rx="1" fill="#555"/></svg>');
  const val = (name, check) => ({ type: 'input_value', name, check });
  const dd = (name, options) => ({ type: 'field_dropdown', name, options });
  const SIDES = [['gauche', 'left'], ['droite', 'right']];
  const SENS = [['reculer', 'back'], ['avancer', 'fwd']];
  const TIP_SENS = 'Choisis le sens : « reculer » si le capteur est tourné vers l’arrière du robot, « avancer » s’il est à l’avant.';
  const COLORS = [['rouge', 'rouge'], ['vert', 'vert'], ['bleu', 'bleu'], ['jaune', 'jaune'], ['violet', 'violet'], ['cyan', 'cyan'], ['blanc', 'blanc'], ['éteinte', 'off']];
  const RGB = { rouge: [150, 0, 0], vert: [0, 150, 0], bleu: [0, 0, 150], jaune: [120, 90, 0], violet: [100, 0, 120], cyan: [0, 110, 110], blanc: [110, 110, 110], off: [0, 0, 0] };
  const ICONS = [['cœur', 'HEART'], ['content', 'HAPPY'], ['triste', 'SAD'], ['oui', 'YES'], ['non', 'NO'], ['flèche haut', 'ARROW_N'], ['flèche bas', 'ARROW_S'], ['carré', 'SQUARE']];
  const DEFS = {
    rb_start: { cat: 'events', hat: true, message0: '%1 quand le robot démarre', args0: [{ type: 'field_image', src: ROBOT_ICO, width: 22, height: 22, alt: 'robot' }], tooltip: 'Le programme commence ici quand le robot est allumé (ou après le téléversement).' },
    rb_fwd: { cat: 'action', message0: 'avancer à la puissance %1 %%', args0: [val('P', 'Number')] },
    // « reculer » garde son identifiant ; la liste SENS (reculer par défaut) permet d'avancer quand le capteur est monté à l'avant
    rb_back: { cat: 'action', message0: '%1 à la puissance %2 %%', args0: [dd('SENS', SENS), val('P', 'Number')], tooltip: TIP_SENS },
    rb_turn: { cat: 'action', message0: 'tourner à %1 à la puissance %2 %%', args0: [dd('DIR', SIDES), val('P', 'Number')], tooltip: 'Une roue avance, l’autre recule : le robot tourne sur place.' },
    rb_fwd_t: { cat: 'action', message0: 'avancer à la puissance %1 %% pendant %2 s', args0: [val('P', 'Number'), val('S', 'Number')] },
    rb_back_t: { cat: 'action', message0: '%1 à la puissance %2 %% pendant %3 s', args0: [dd('SENS', SENS), val('P', 'Number'), val('S', 'Number')], tooltip: TIP_SENS },
    rb_turn_t: { cat: 'action', message0: 'tourner à %1 à la puissance %2 %% pendant %3 s', args0: [dd('DIR', SIDES), val('P', 'Number'), val('S', 'Number')] },
    rb_motors: { cat: 'action', message0: 'moteur gauche %1 %% moteur droit %2 %%', args0: [val('L', 'Number'), val('R', 'Number')], tooltip: 'De −100 (recule) à 100 (avance) pour chaque roue.' },
    rb_stop: { cat: 'action', message0: 'arrêter les moteurs' },
    rb_distance: { cat: 'sensing', output: 'Number', message0: 'distance ultrasons (cm)', tooltip: 'Distance de l’obstacle devant le robot, de 2 à 400 cm (400 : rien devant).' },
    rb_line: { cat: 'sensing', output: 'Boolean', message0: 'le capteur de ligne %1 voit du noir', args0: [dd('SIDE', SIDES)] },
    rb_light: { cat: 'sensing', output: 'Number', message0: 'niveau de lumière (%%)' },
    rb_button: { cat: 'sensing', output: 'Boolean', message0: 'le bouton %1 est appuyé', args0: [dd('BTN', [['A (mBot : bouton de la carte)', 'a'], ['B (Maqueen seulement)', 'b']])] },
    rb_timer: { cat: 'sensing', output: 'Number', message0: 'chronomètre (s)' },
    rb_timer_reset: { cat: 'sensing', message0: 'remettre le chronomètre à zéro' },
    rb_led: { cat: 'light', message0: 'allumer la LED %1 en %2', args0: [dd('SIDE', [['toutes', 'all'], ['gauche', 'left'], ['droite', 'right']]), dd('COLOR', COLORS)] },
    rb_leds_off: { cat: 'light', message0: 'éteindre les LED' },
    rb_tone: { cat: 'sound', message0: 'jouer un son de %1 Hz pendant %2 s', args0: [val('F', 'Number'), val('S', 'Number')] },
    rb_say: { cat: 'sound', message0: 'afficher %1', args0: [val('V')], tooltip: 'Maqueen : fait défiler sur l’écran de la micro:bit. mBot : écrit dans le moniteur série.' },
    rb_icon: { cat: 'sound', message0: 'afficher l’icône %1', args0: [dd('ICON', ICONS)], only: ['maqueen'], tooltip: 'Écran à LED de la micro:bit (Maqueen seulement).' },
    rb_wait: { cat: 'control', message0: 'attendre %1 secondes', args0: [val('S', 'Number')] },
    rb_forever: { cat: 'control', end: true, message0: 'répéter indéfiniment', message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
    rb_repeat: { cat: 'control', message0: 'répéter %1 fois', args0: [val('N', 'Number')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
    rb_if: { cat: 'control', message0: 'si %1 alors', args0: [val('COND', 'Boolean')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
    rb_ifelse: { cat: 'control', message0: 'si %1 alors', args0: [val('COND', 'Boolean')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], message2: 'sinon', message3: '%1', args3: [{ type: 'input_statement', name: 'ELSE' }] },
    rb_wait_until: { cat: 'control', message0: 'attendre jusqu’à %1', args0: [val('COND', 'Boolean')] },
    rb_repeat_until: { cat: 'control', message0: 'répéter jusqu’à %1', args0: [val('COND', 'Boolean')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] },
    rb_arith: { cat: 'ops', output: 'Number', message0: '%1 %2 %3', args0: [val('A', 'Number'), dd('OP', [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/']]), val('B', 'Number')] },
    rb_random: { cat: 'ops', output: 'Number', message0: 'nombre aléatoire entre %1 et %2', args0: [val('A', 'Number'), val('B', 'Number')] },
    rb_lt: { cat: 'ops', output: 'Boolean', message0: '%1 < %2', args0: [val('A'), val('B')] },
    rb_gt: { cat: 'ops', output: 'Boolean', message0: '%1 > %2', args0: [val('A'), val('B')] },
    rb_eq: { cat: 'ops', output: 'Boolean', message0: '%1 = %2', args0: [val('A'), val('B')] },
    rb_and: { cat: 'ops', output: 'Boolean', message0: '%1 et %2', args0: [val('A', 'Boolean'), val('B', 'Boolean')] },
    rb_or: { cat: 'ops', output: 'Boolean', message0: '%1 ou %2', args0: [val('A', 'Boolean'), val('B', 'Boolean')] },
    rb_not: { cat: 'ops', output: 'Boolean', message0: 'non %1', args0: [val('A', 'Boolean')] },
  };
  R.DEFS = DEFS;
  // valeurs par défaut des entrées (ombres) dans la palette
  const SHADOWS = {
    rb_fwd: { P: 50 }, rb_back: { P: 50 }, rb_turn: { P: 50 }, rb_fwd_t: { P: 50, S: 1 }, rb_back_t: { P: 50, S: 1 }, rb_turn_t: { P: 50, S: 0.5 },
    rb_motors: { L: 50, R: 50 }, rb_tone: { F: 440, S: 0.5 }, rb_say: { V: 'Bonjour' }, rb_wait: { S: 1 }, rb_repeat: { N: 4 },
    rb_arith: { A: '', B: '' }, rb_random: { A: 1, B: 10 }, rb_lt: { A: '', B: 15 }, rb_gt: { A: '', B: 50 }, rb_eq: { A: '', B: 0 },
  };
  const DEFAULT_TOOLBOX = Object.keys(DEFS);
  /** Nom lisible d'un bloc (consignes, tests) */
  R.label = (type) => { const d = DEFS[type]; return d ? d.message0.replace(/%\d/g, '…').replace(/%%/g, '%').replace(/^…\s*/, '').replace(/\s+/g, ' ').trim() : type; };

  let defined = false;
  function define() {
    if (defined) return;
    const Bl = window.Blockly;
    Object.entries(DEFS).forEach(([type, d]) => {
      const json = Object.assign({ colour: CATS[d.cat].colour, inputsInline: true, tooltip: '' }, d);
      ['cat', 'hat', 'end', 'only'].forEach((k) => delete json[k]);
      if (!d.output && !d.hat) json.previousStatement = null;
      if (!d.output && !d.end) json.nextStatement = null;
      Bl.Blocks[type] = { init() { this.jsonInit(json); if (d.hat) this.hat = 'cap'; } };
    });
    if (!Bl.registry.hasItem(Bl.registry.Type.THEME, 'mblock') && !(Bl.Themes && Bl.Themes.mblock)) {
      try {
        Bl.Theme.defineTheme('mblock', { base: Bl.Themes.Classic, name: 'mblock', fontStyle: { family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weight: '500', size: 11 },
          componentStyles: { workspaceBackgroundColour: '#F9F9F9', toolboxBackgroundColour: '#FFFFFF', flyoutBackgroundColour: '#F2F4F8', flyoutOpacity: 1, scrollbarColour: '#CECDCE' } });
      } catch (e) { /* thème déjà défini par mblock.js */ }
    }
    defineGenerators();
    defined = true;
  }
  R.load = () => (TL.mblock && TL.mblock.load ? TL.mblock.load() : TL.code.load()).then(define);

  function toolbox(list) {
    const shadow = (v) => ({ shadow: typeof v === 'string' && v && isNaN(+v) ? { type: 'text', fields: { TEXT: v } } : { type: 'math_number', fields: { NUM: v } } });
    const contents = [];
    Object.entries(CATS).forEach(([cat, c]) => {
      const items = list.filter((t) => DEFS[t] && DEFS[t].cat === cat).map((type) => {
        const it = { kind: 'block', type };
        if (SHADOWS[type]) { it.inputs = {}; Object.entries(SHADOWS[type]).forEach(([k, v]) => (it.inputs[k] = shadow(v))); }
        return it;
      });
      if (items.length) contents.push({ kind: 'category', name: c.name, colour: c.colour, contents: items });
    });
    contents.push({ kind: 'category', name: 'Variables', colour: '#FF8C1A', custom: 'VARIABLE' });
    return { kind: 'categoryToolbox', contents };
  }

  /* ================= Générateurs ================= */
  // Ordres de priorité (plus petit = plus prioritaire)
  const O = { ATOMIC: 0, CALL: 1, UNARY: 2, MUL: 3, ADD: 4, REL: 6, EQ: 7, AND: 11, OR: 12, NONE: 99 };
  const neg = (v) => (/^\d+(\.\d+)?$/.test(v) ? '-' + v : '-(' + v + ')');
  const PYO = { ATOMIC: 0, CALL: 2, UNARY: 4, MUL: 5, ADD: 6, REL: 11, NOT: 12, AND: 13, OR: 14, NONE: 99 };
  R.gen = {};

  function base(name, lang) {
    const Bl = window.Blockly;
    const g = new Bl.CodeGenerator(name);
    g.lang = lang;
    g.INDENT = lang === 'cpp' ? '  ' : '    ';
    g.init = function (ws) {
      this.need = new Set(); this.warnings = new Map(); this.vars = [];
      if (!this.nameDB_) this.nameDB_ = new Bl.Names(this.RESERVED_WORDS_); else this.nameDB_.reset();
      this.nameDB_.setVariableMap(ws.getVariableMap());
      this.nameDB_.populateVariables(ws);
      this.vars = ws.getAllVariables().map((v) => this.nameDB_.getName(v.getId(), Bl.Names.NameType.VARIABLE));
    };
    g.scrub_ = function (block, code, thisOnly) {
      const next = block.nextConnection && block.nextConnection.targetBlock();
      return code + (next && !thisOnly ? this.blockToCode(next) : '');
    };
    g.scrubNakedValue = (line) => line + (lang === 'cpp' ? ';\n' : '\n');
    g.finish = (code) => code;
    g.warn = (b, msg) => { if (!g.warnings.has(b.id)) g.warnings.set(b.id, msg); };
    g.num = (b, n, o, d) => g.valueToCode(b, n, o) || (d == null ? '0' : String(d));
    g.v = (b) => g.nameDB_.getName(b.getFieldValue('VAR'), Bl.Names.NameType.VARIABLE);
    return g;
  }

  function defineGenerators() {
    const Bl = window.Blockly;

    /* ---------- mBot : C++ pour la carte mCore (ATmega328P, comme une Arduino Uno) ---------- */
    const c = (R.gen.mbot = base('mBot', 'cpp'));
    c.addReservedWords('setup,loop,int,long,float,double,char,bool,void,if,else,while,for,return,true,false,HIGH,LOW,INPUT,OUTPUT,Serial,delay,millis,random,moteurs,distanceCm,ligneNoire,lumiere,boutonCarte,ledsEnvoyer,led,chrono0,leds,attendre,son');
    const HELP_C = {
      moteurs: '// Moteurs : M1 = roue gauche (vitesse D6, sens D7), M2 = roue droite (vitesse D5, sens D4)\nvoid moteurs(float g, float d) {\n  g = constrain(g, -100, 100);\n  d = constrain(d, -100, 100);\n  digitalWrite(7, g >= 0 ? LOW : HIGH);   // M1 est monté à l’envers\n  analogWrite(6, (int)(fabs(g) * 2.55));\n  digitalWrite(4, d >= 0 ? HIGH : LOW);\n  analogWrite(5, (int)(fabs(d) * 2.55));\n}',
      attendre: 'void attendre(float s) {\n  if (s > 0) delay((unsigned long)(s * 1000));\n}',
      distance: '// Capteur à ultrasons Makeblock sur le port 3 : une seule broche (A3) pour déclencher et écouter\nfloat distanceCm() {\n  pinMode(A3, OUTPUT);\n  digitalWrite(A3, LOW);\n  delayMicroseconds(2);\n  digitalWrite(A3, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(A3, LOW);\n  pinMode(A3, INPUT);\n  long t = pulseIn(A3, HIGH, 25000);\n  if (t == 0) return 400;\n  return t / 58.0;\n}',
      ligne: '// Suiveur de ligne sur le port 2 : capteur gauche D9, droit D10 (LOW = noir)\nbool ligneNoire(int capteur) {\n  return digitalRead(capteur) == LOW;\n}',
      lumiere: '// Capteur de lumière de la carte (A6), en %\nfloat lumiere() {\n  return analogRead(A6) * 100.0 / 1023.0;\n}',
      bouton: '// Bouton de la carte (A7) : appuyé quand la tension tombe\nbool boutonCarte() {\n  return analogRead(A7) < 100;\n}',
      leds: '// 2 LED RGB (WS2812) sur D13 = PB5. Envoi bit à bit, interruptions coupées.\nuint8_t leds[6];   // vert, rouge, bleu pour chaque LED\nvoid ledsEnvoyer() {\n  noInterrupts();\n  for (uint8_t i = 0; i < 6; i++) {\n    uint8_t o = leds[i];\n    for (uint8_t k = 0; k < 8; k++) {\n      if (o & 0x80) { PORTB |= _BV(5); __builtin_avr_delay_cycles(10); PORTB &= ~_BV(5); __builtin_avr_delay_cycles(3); }\n      else { PORTB |= _BV(5); __builtin_avr_delay_cycles(3); PORTB &= ~_BV(5); __builtin_avr_delay_cycles(9); }\n      o <<= 1;\n    }\n  }\n  interrupts();\n  delayMicroseconds(80);\n}\n// quelle : 0 = toutes, 1 = gauche, 2 = droite\nvoid led(int quelle, uint8_t r, uint8_t v, uint8_t b) {\n  for (int i = 0; i < 2; i++) {\n    if (quelle == 0 || (quelle == 1 && i == 1) || (quelle == 2 && i == 0)) { leds[i * 3] = v; leds[i * 3 + 1] = r; leds[i * 3 + 2] = b; }\n  }\n  ledsEnvoyer();\n}',
      son: '// Buzzer de la carte sur D8\nvoid son(float f, float s) {\n  tone(8, (unsigned int)f);\n  attendre(s);\n  noTone(8);\n}',
      chrono: 'unsigned long chrono0 = 0;',
    };
    const NEEDS_C = { son: ['attendre'] };
    const SETUP_C = {
      moteurs: ['pinMode(4, OUTPUT); pinMode(5, OUTPUT); pinMode(6, OUTPUT); pinMode(7, OUTPUT);', 'moteurs(0, 0);'],
      ligne: ['pinMode(9, INPUT); pinMode(10, INPUT);'],
      leds: ['pinMode(13, OUTPUT);', 'led(0, 0, 0, 0);'],
      serial: ['Serial.begin(115200);'],
      chrono: ['chrono0 = millis();'],
    };
    const F = c.forBlock;
    const p = (b, n, d) => c.num(b, n, O.NONE, d == null ? 50 : d);
    const s = (b, n) => c.num(b, n, O.NONE, 1);
    const need = (...k) => k.forEach((x) => c.need.add(x));
    const body = (b, n) => c.statementToCode(b, n);
    F.rb_start = () => '';
    F.rb_fwd = (b) => { need('moteurs'); const v = p(b, 'P'); return `moteurs(${v}, ${v});\n`; };
    F.rb_back = (b) => { need('moteurs'); const v = p(b, 'P'); return b.getFieldValue('SENS') === 'fwd' ? `moteurs(${v}, ${v});\n` : `moteurs(${neg(v)}, ${neg(v)});\n`; };
    F.rb_turn = (b) => { need('moteurs'); const v = p(b, 'P'); return b.getFieldValue('DIR') === 'right' ? `moteurs(${v}, ${neg(v)});\n` : `moteurs(${neg(v)}, ${v});\n`; };
    F.rb_fwd_t = (b) => F.rb_fwd(b) + (need('attendre'), `attendre(${s(b, 'S')});\nmoteurs(0, 0);\n`);
    F.rb_back_t = (b) => F.rb_back(b) + (need('attendre'), `attendre(${s(b, 'S')});\nmoteurs(0, 0);\n`);
    F.rb_turn_t = (b) => F.rb_turn(b) + (need('attendre'), `attendre(${s(b, 'S')});\nmoteurs(0, 0);\n`);
    F.rb_motors = (b) => { need('moteurs'); return `moteurs(${p(b, 'L')}, ${p(b, 'R')});\n`; };
    F.rb_stop = () => { need('moteurs'); return 'moteurs(0, 0);\n'; };
    F.rb_distance = () => { need('distance'); return ['distanceCm()', O.CALL]; };
    F.rb_line = (b) => { need('ligne'); return [`ligneNoire(${b.getFieldValue('SIDE') === 'left' ? 9 : 10})`, O.CALL]; };
    F.rb_light = () => { need('lumiere'); return ['lumiere()', O.CALL]; };
    F.rb_button = (b) => {
      if (b.getFieldValue('BTN') === 'b') { c.warn(b, 'Le mBot n’a qu’un bouton : choisis « A ».'); return ['false', O.ATOMIC]; }
      need('bouton'); return ['boutonCarte()', O.CALL];
    };
    F.rb_timer = () => { need('chrono'); return ['((millis() - chrono0) / 1000.0)', O.ATOMIC]; };
    F.rb_timer_reset = () => { need('chrono'); return 'chrono0 = millis();\n'; };
    F.rb_led = (b) => { need('leds'); const [r, v, bl] = RGB[b.getFieldValue('COLOR')] || RGB.off; return `led(${{ all: 0, left: 1, right: 2 }[b.getFieldValue('SIDE')] || 0}, ${r}, ${v}, ${bl});\n`; };
    F.rb_leds_off = () => { need('leds'); return 'led(0, 0, 0, 0);\n'; };
    F.rb_tone = (b) => { need('son'); return `son(${c.num(b, 'F', O.NONE, 440)}, ${s(b, 'S')});\n`; };
    F.rb_say = (b) => { need('serial'); return `Serial.println(${c.valueToCode(b, 'V', O.NONE) || '""'});\n`; };
    F.rb_icon = (b) => { c.warn(b, 'Le mBot n’a pas d’écran : ce bloc est ignoré (il marche sur le Maqueen).'); return '// (icône : pas d’écran sur le mBot)\n'; };
    F.rb_wait = (b) => { need('attendre'); return `attendre(${s(b, 'S')});\n`; };
    F.rb_forever = (b) => `while (true) {\n${body(b, 'DO')}}\n`;
    F.rb_repeat = (b) => { const i = c.nameDB_.getDistinctName('i', Bl.Names.NameType.VARIABLE); return `for (int ${i} = 0; ${i} < (int)(${c.num(b, 'N', O.NONE, 0)}); ${i}++) {\n${body(b, 'DO')}}\n`; };
    F.rb_if = (b) => `if (${c.num(b, 'COND', O.NONE, 'false')}) {\n${body(b, 'DO')}}\n`;
    F.rb_ifelse = (b) => `if (${c.num(b, 'COND', O.NONE, 'false')}) {\n${body(b, 'DO')}} else {\n${body(b, 'ELSE')}}\n`;
    F.rb_wait_until = (b) => `while (!(${c.num(b, 'COND', O.NONE, 'false')})) {\n  delay(1);\n}\n`;
    F.rb_repeat_until = (b) => `while (!(${c.num(b, 'COND', O.NONE, 'false')})) {\n${body(b, 'DO')}}\n`;
    F.rb_arith = (b) => {
      const op = b.getFieldValue('OP'), o = op === '+' || op === '-' ? O.ADD : O.MUL;
      if (op === '/') return [`((float)(${c.num(b, 'A', O.NONE)}) / (${c.num(b, 'B', O.NONE, 1)}))`, O.ATOMIC];
      return [`${c.num(b, 'A', o)} ${op} ${c.num(b, 'B', o + 0.5)}`, o];
    };
    F.rb_random = (b) => [`random((long)(${c.num(b, 'A', O.NONE, 1)}), (long)(${c.num(b, 'B', O.NONE, 10)}) + 1)`, O.CALL];
    F.rb_lt = (b) => [`${c.num(b, 'A', O.REL)} < ${c.num(b, 'B', O.REL)}`, O.REL];
    F.rb_gt = (b) => [`${c.num(b, 'A', O.REL)} > ${c.num(b, 'B', O.REL)}`, O.REL];
    F.rb_eq = (b) => [`${c.num(b, 'A', O.EQ)} == ${c.num(b, 'B', O.EQ)}`, O.EQ];
    F.rb_and = (b) => [`${c.num(b, 'A', O.AND, 'false')} && ${c.num(b, 'B', O.AND, 'false')}`, O.AND];
    F.rb_or = (b) => [`${c.num(b, 'A', O.OR, 'false')} || ${c.num(b, 'B', O.OR, 'false')}`, O.OR];
    F.rb_not = (b) => [`!(${c.num(b, 'A', O.NONE, 'false')})`, O.UNARY];
    F.math_number = (b) => { const n = Number(b.getFieldValue('NUM')); return [String(isFinite(n) ? n : 0), n < 0 ? O.UNARY : O.ATOMIC]; };
    F.text = (b) => [JSON.stringify(String(b.getFieldValue('TEXT'))), O.ATOMIC];
    F.variables_get = (b) => [c.v(b), O.ATOMIC];
    F.variables_set = (b) => `${c.v(b)} = ${c.num(b, 'VALUE', O.NONE)};\n`;
    F.math_change = (b) => `${c.v(b)} += ${c.num(b, 'DELTA', O.NONE, 1)};\n`;
    c.assemble = function (code) {
      // dépendances entre aides
      [...c.need].forEach((k) => (NEEDS_C[k] || []).forEach((x) => c.need.add(x)));
      const order = ['chrono', 'attendre', 'moteurs', 'distance', 'ligne', 'lumiere', 'bouton', 'leds', 'son'];
      const helpers = order.filter((k) => c.need.has(k)).map((k) => HELP_C[k]);
      const setup = Object.keys(SETUP_C).filter((k) => c.need.has(k)).flatMap((k) => SETUP_C[k]);
      const ind = (t) => t.split('\n').map((l) => (l.trim() ? '  ' + l : l)).join('\n').replace(/\s+$/, '');
      return [
        '// Programme généré par TechnoStudio — mBot (carte mCore, compilée comme une Arduino Uno)',
        '// Sans bibliothèque Makeblock : les broches de la carte mCore sont pilotées directement.',
        '',
        ...(c.vars.length ? c.vars.map((v) => `float ${v} = 0;`).concat(['']) : []),
        ...helpers.map((x) => x + '\n'),
        'void setup() {',
        ...setup.map((x) => '  ' + x),
        ind(code) || '  // ajoute des blocs sous « quand le robot démarre »',
        '}',
        '',
        'void loop() {',
        '}',
        '',
      ].join('\n').replace(/\n{3,}/g, '\n\n');
    };

    /* ---------- Maqueen Lite : MicroPython pour la micro:bit ---------- */
    const y = (R.gen.maqueen = base('Maqueen', 'mpy'));
    y.addReservedWords('False,None,True,and,as,assert,break,class,continue,def,del,elif,else,except,finally,for,from,global,if,import,in,is,lambda,nonlocal,not,or,pass,raise,return,try,while,with,yield,print,int,str,abs,min,max,round,range,display,Image,pin0,pin1,pin2,pin8,pin12,pin13,pin14,pin15,button_a,button_b,i2c,sleep,running_time,music,neopixel,random,utime,time_pulse_us,np,moteurs,distance_cm,ligne_noire,lumiere,led,son,chrono0,attendre');
    const HELP_Y = {
      moteurs: '# Moteurs : carte Maqueen à l’adresse I2C 0x10 (0 = gauche, 2 = droit ; sens 0 = avant)\ndef moteurs(g, d):\n    for m, v in ((0, g), (2, d)):\n        v = max(-100, min(100, v))\n        i2c.write(0x10, bytes([m, 0 if v >= 0 else 1, int(abs(v) * 255 / 100)]))',
      attendre: 'def attendre(s):\n    if s > 0:\n        sleep(int(s * 1000))',
      distance: '# Capteur à ultrasons : déclenchement P1, écho P2\ndef distance_cm():\n    pin1.write_digital(0)\n    utime.sleep_us(2)\n    pin1.write_digital(1)\n    utime.sleep_us(10)\n    pin1.write_digital(0)\n    pin2.read_digital()\n    t = time_pulse_us(pin2, 1, 25000)\n    if t <= 0:\n        return 400\n    return round(t / 58, 1)',
      ligne: '# Suiveurs de ligne : gauche P13, droit P14 (0 = noir)\ndef ligne_noire(p):\n    return p.read_digital() == 0',
      lumiere: '# Niveau de lumière mesuré par l’écran de la micro:bit, en %\ndef lumiere():\n    return display.read_light_level() * 100 // 255',
      leds: '# LED rouges P8 (gauche) et P12 (droite), 4 LED RGB sur P15\nnp = neopixel.NeoPixel(pin15, 4)\n# quelle : 0 = toutes, 1 = gauche, 2 = droite\ndef led(quelle, r, v, b):\n    allume = 1 if (r or v or b) else 0\n    if quelle != 2:\n        pin8.write_digital(allume)\n    if quelle != 1:\n        pin12.write_digital(allume)\n    for i in range(4):\n        if quelle == 0 or (quelle == 1 and i < 2) or (quelle == 2 and i >= 2):\n            np[i] = (r, v, b)\n    np.show()',
      son: '# Buzzer sur P0 (interrupteur du buzzer sur ON)\ndef son(f, s):\n    music.pitch(int(f), int(s * 1000))',
      chrono: 'chrono0 = running_time()',
    };
    const IMPORT_Y = { distance: ['import utime', 'from machine import time_pulse_us'], leds: ['import neopixel'], son: ['import music'], random: ['import random'] };
    const FY = y.forBlock;
    const py = (b, n, d) => y.num(b, n, PYO.NONE, d == null ? 50 : d);
    const ps = (b, n) => y.num(b, n, PYO.NONE, 1);
    const yneed = (...k) => k.forEach((x) => y.need.add(x));
    const ybody = (b, n) => y.statementToCode(b, n) || y.INDENT + 'pass\n';
    FY.rb_start = () => '';
    FY.rb_fwd = (b) => { yneed('moteurs'); const v = py(b, 'P'); return `moteurs(${v}, ${v})\n`; };
    FY.rb_back = (b) => { yneed('moteurs'); const v = py(b, 'P'); return b.getFieldValue('SENS') === 'fwd' ? `moteurs(${v}, ${v})\n` : `moteurs(${neg(v)}, ${neg(v)})\n`; };
    FY.rb_turn = (b) => { yneed('moteurs'); const v = py(b, 'P'); return b.getFieldValue('DIR') === 'right' ? `moteurs(${v}, ${neg(v)})\n` : `moteurs(${neg(v)}, ${v})\n`; };
    FY.rb_fwd_t = (b) => FY.rb_fwd(b) + (yneed('attendre'), `attendre(${ps(b, 'S')})\nmoteurs(0, 0)\n`);
    FY.rb_back_t = (b) => FY.rb_back(b) + (yneed('attendre'), `attendre(${ps(b, 'S')})\nmoteurs(0, 0)\n`);
    FY.rb_turn_t = (b) => FY.rb_turn(b) + (yneed('attendre'), `attendre(${ps(b, 'S')})\nmoteurs(0, 0)\n`);
    FY.rb_motors = (b) => { yneed('moteurs'); return `moteurs(${py(b, 'L')}, ${py(b, 'R')})\n`; };
    FY.rb_stop = () => { yneed('moteurs'); return 'moteurs(0, 0)\n'; };
    FY.rb_distance = () => { yneed('distance'); return ['distance_cm()', PYO.CALL]; };
    FY.rb_line = (b) => { yneed('ligne'); return [`ligne_noire(${b.getFieldValue('SIDE') === 'left' ? 'pin13' : 'pin14'})`, PYO.CALL]; };
    FY.rb_light = () => { yneed('lumiere'); return ['lumiere()', PYO.CALL]; };
    FY.rb_button = (b) => [`button_${b.getFieldValue('BTN') === 'b' ? 'b' : 'a'}.is_pressed()`, PYO.CALL];
    FY.rb_timer = () => { yneed('chrono'); return ['((running_time() - chrono0) / 1000)', PYO.ATOMIC]; };
    FY.rb_timer_reset = () => { yneed('chrono'); return 'chrono0 = running_time()\n'; };
    FY.rb_led = (b) => { yneed('leds'); const [r, v, bl] = RGB[b.getFieldValue('COLOR')] || RGB.off; return `led(${{ all: 0, left: 1, right: 2 }[b.getFieldValue('SIDE')] || 0}, ${r}, ${v}, ${bl})\n`; };
    FY.rb_leds_off = () => { yneed('leds'); return 'led(0, 0, 0, 0)\n'; };
    FY.rb_tone = (b) => { yneed('son'); return `son(${y.num(b, 'F', PYO.NONE, 440)}, ${ps(b, 'S')})\n`; };
    FY.rb_say = (b) => `display.scroll(str(${y.valueToCode(b, 'V', PYO.NONE) || '""'}))\n`;
    FY.rb_icon = (b) => `display.show(Image.${b.getFieldValue('ICON')})\n`;
    FY.rb_wait = (b) => { yneed('attendre'); return `attendre(${ps(b, 'S')})\n`; };
    FY.rb_forever = (b) => `while True:\n${ybody(b, 'DO')}`;
    FY.rb_repeat = (b) => { const i = y.nameDB_.getDistinctName('i', Bl.Names.NameType.VARIABLE); return `for ${i} in range(int(${y.num(b, 'N', PYO.NONE, 0)})):\n${ybody(b, 'DO')}`; };
    FY.rb_if = (b) => `if ${y.num(b, 'COND', PYO.NONE, 'False')}:\n${ybody(b, 'DO')}`;
    FY.rb_ifelse = (b) => `if ${y.num(b, 'COND', PYO.NONE, 'False')}:\n${ybody(b, 'DO')}else:\n${ybody(b, 'ELSE')}`;
    FY.rb_wait_until = (b) => `while not (${y.num(b, 'COND', PYO.NONE, 'False')}):\n    sleep(1)\n`;
    FY.rb_repeat_until = (b) => `while not (${y.num(b, 'COND', PYO.NONE, 'False')}):\n${ybody(b, 'DO')}`;
    FY.rb_arith = (b) => { const op = b.getFieldValue('OP'), o = op === '+' || op === '-' ? PYO.ADD : PYO.MUL; return [`${y.num(b, 'A', o)} ${op} ${y.num(b, 'B', o + 0.5, op === '/' ? 1 : 0)}`, o]; };
    FY.rb_random = (b) => { yneed('random'); return [`random.randint(int(${y.num(b, 'A', PYO.NONE, 1)}), int(${y.num(b, 'B', PYO.NONE, 10)}))`, PYO.CALL]; };
    FY.rb_lt = (b) => [`${y.num(b, 'A', PYO.REL)} < ${y.num(b, 'B', PYO.REL)}`, PYO.REL];
    FY.rb_gt = (b) => [`${y.num(b, 'A', PYO.REL)} > ${y.num(b, 'B', PYO.REL)}`, PYO.REL];
    FY.rb_eq = (b) => [`${y.num(b, 'A', PYO.REL)} == ${y.num(b, 'B', PYO.REL)}`, PYO.REL];
    FY.rb_and = (b) => [`${y.num(b, 'A', PYO.AND, 'False')} and ${y.num(b, 'B', PYO.AND, 'False')}`, PYO.AND];
    FY.rb_or = (b) => [`${y.num(b, 'A', PYO.OR, 'False')} or ${y.num(b, 'B', PYO.OR, 'False')}`, PYO.OR];
    FY.rb_not = (b) => [`not ${y.num(b, 'A', PYO.NOT, 'False')}`, PYO.NOT];
    FY.math_number = (b) => { const n = Number(b.getFieldValue('NUM')); return [String(isFinite(n) ? n : 0), n < 0 ? PYO.UNARY : PYO.ATOMIC]; };
    FY.text = (b) => [JSON.stringify(String(b.getFieldValue('TEXT'))), PYO.ATOMIC];
    FY.variables_get = (b) => [y.v(b), PYO.ATOMIC];
    FY.variables_set = (b) => `${y.v(b)} = ${y.num(b, 'VALUE', PYO.NONE)}\n`;
    FY.math_change = (b) => `${y.v(b)} += ${y.num(b, 'DELTA', PYO.NONE, 1)}\n`;
    y.assemble = function (code) {
      if (y.need.has('son')) y.need.add('attendre');
      const imports = ['from microbit import *'].concat(...Object.keys(IMPORT_Y).filter((k) => y.need.has(k)).map((k) => IMPORT_Y[k]));
      const order = ['chrono', 'attendre', 'moteurs', 'distance', 'ligne', 'lumiere', 'leds', 'son'];
      const helpers = order.filter((k) => y.need.has(k)).map((k) => HELP_Y[k]);
      return [
        '# Programme généré par TechnoStudio — Maqueen Lite (micro:bit, MicroPython)',
        ...[...new Set(imports)],
        '',
        ...helpers.map((x) => x + '\n'),
        ...(y.vars.length ? y.vars.map((v) => `${v} = 0`).concat(['']) : []),
        y.need.has('moteurs') ? 'moteurs(0, 0)' : null,
        y.need.has('leds') ? 'led(0, 0, 0, 0)' : null,
        code.replace(/\s+$/, '') || '# ajoute des blocs sous « quand le robot démarre »',
        '',
      ].filter((x) => x != null).join('\n').replace(/\n{3,}/g, '\n\n');
    };
    R.HELP = { cpp: HELP_C, mpy: HELP_Y };
  }

  /** Génère le code d'un espace de travail pour un robot. → { code, warnings: Map(id → message), start } */
  R.generate = function (ws, robot) {
    const g = R.gen[robot];
    g.init(ws);
    const tops = ws.getTopBlocks(true);
    const start = tops.find((b) => b.type === 'rb_start');
    // blocs « réservés à un robot » : signalés sur l'autre
    ws.getAllBlocks(false).forEach((b) => { const d = DEFS[b.type]; if (d && d.only && !d.only.includes(robot) && b.type !== 'rb_icon') g.warn(b, 'Ce bloc ne marche pas sur le ' + R.ROBOTS[robot].name + '.'); });
    // blocs posés à côté : non exécutés
    tops.forEach((b) => { if (b !== start && !b.outputConnection && b.type !== 'rb_start') g.warn(b, 'Ce bloc n’est pas accroché sous « quand le robot démarre » : il ne sera pas exécuté.'); });
    tops.filter((b) => b.type === 'rb_start' && b !== start).forEach((b) => g.warn(b, 'Un seul « quand le robot démarre » est utilisé : le premier.'));
    let code = '';
    if (start) { const next = start.getNextBlock(); code = next ? g.blockToCode(next) : ''; }
    // blocs non accrochés : générés pour relever leurs avertissements seulement (code et aides ignorés)
    const keep = new Set(g.need);
    tops.filter((b) => b !== start).forEach((b) => { try { g.blockToCode(b); } catch (e) { /* bloc incomplet */ } });
    g.need = keep;
    return { code: g.assemble(start ? code : ''), warnings: new Map(g.warnings), start: !!start };
  };

  /* ================= Téléversement ================= */
  const MICROBIT_VID = 0x0d28;
  /** Ports USB retenus pour la session (choisis dans un clic : geste exigé par le navigateur). */
  R.ports = { mbot: null, maqueen: null };
  const nonMicrobit = (p) => { try { return p.getInfo().usbVendorId !== MICROBIT_VID; } catch (e) { return true; } };
  const estMicrobit = (p) => !nonMicrobit(p);
  async function choisirPort(robot, forcer) {
    if (!TL.flash.supporte) throw new Error('Ce navigateur ne sait pas parler au robot par USB : utilise Chrome ou Edge sur ordinateur.');
    if (!forcer && R.ports[robot]) return R.ports[robot];
    if (!forcer) {
      const deja = (await navigator.serial.getPorts()).filter(robot === 'maqueen' ? estMicrobit : nonMicrobit);
      if (deja.length === 1) return (R.ports[robot] = deja[0]);
    }
    return (R.ports[robot] = await navigator.serial.requestPort(robot === 'maqueen' ? { filters: [{ usbVendorId: MICROBIT_VID }] } : {}));
  }
  const pourcent = (log) => { let dernier = -1; return (v) => { const p = Math.floor(v * 10) * 10; if (p !== dernier) { dernier = p; log('… ' + p + ' %'); } }; };
  // Dernière compilation réussie par programme : réutilisée par « Téléverser » si le code n'a pas changé
  const builds = {};
  R.compiled = (cle, code) => !!(builds[cle] && builds[cle].code === code);

  /** Compile le code d'un robot sur le serveur. cle : clé du cache (robot, ou « mbot-direct »…). → réponse du serveur ou null */
  R.compile = async function (robot, code, log, cle) {
    const rb = R.ROBOTS[robot];
    cle = cle || robot;
    if (R.compiled(cle, code)) { log('✓ Déjà compilé pour le ' + rb.name + ' (le programme n’a pas changé).'); return builds[cle].r; }
    log('Serveur de compilation : ' + TL.flash.adresse().replace(/^https?:\/\//, '').replace(/\?.*$/, ''), true);
    log('Compilation pour le ' + rb.name + '…');
    const r = await TL.flash.compiler(rb.carte, code, log);
    if (r.journal) log(r.journal.trim().split('\n').slice(-20).join('\n'), true);
    if (!r.ok) { log('✗ ' + (r.erreur || 'Erreur de compilation.')); return null; }
    if (r.format === 'hex') log('✓ Compilé' + (r.cache ? ' (déjà en cache)' : '') + ' : ' + TL.flash.lireHex(r.hex).length + ' octets sur 32 256.');
    else if (r.format === 'hex-microbit') log('✓ Fichier .hex prêt (' + Math.round(r.hex.length / 1024) + ' Ko, MicroPython + le programme).');
    builds[cle] = { code, r };
    return r;
  };

  /** Téléverse ; à appeler directement dans le clic. o : { log, nouveauPort, cle, nom } */
  R.upload = async function (robot, code, o) {
    const log = o.log;
    if (robot === 'mbot') {
      let port;
      try { port = await choisirPort('mbot', o.nouveauPort); } catch (e) { log(e.name === 'NotFoundError' ? 'Aucun port choisi.' : '✗ ' + e.message); return false; }
      await R.disconnect('mbot'); // le mode direct libère le port
      const r = await R.compile(robot, code, log, o.cle);
      if (!r) return false;
      if (r.format !== 'hex') { log('✗ Réponse inattendue du serveur.'); return false; }
      try { return await TL.flash.avr(port, r.hex, { bauds: [115200, 57600], log, progres: pourcent(log) }); } catch (e) { R.ports.mbot = null; log('✗ ' + e.message); return false; }
    }
    // Maqueen : écriture directe par USB (fenêtre « Connecter » de Chrome, dans le clic) ;
    // sinon le fichier .hex est enregistré sur le lecteur MICROBIT ou téléchargé
    const nom = o.nom || 'maqueen.hex';
    if (TL.flash.microbitUsbPossible()) {
      let choisie = false;
      try { log('Choisis ta micro:bit dans la fenêtre puis « Connexion »…'); choisie = await TL.flash.choisirMicrobit(o.nouveauPort); }
      catch (e) { log(e.name === 'NotFoundError' ? 'Aucune micro:bit choisie : le fichier .hex sera téléchargé.' : '✗ ' + e.message); }
      if (choisie) {
        await R.disconnect('maqueen'); // libère la micro:bit (mode direct)
        const r = await R.compile(robot, code, log, o.cle);
        if (!r) return false;
        try { return await TL.flash.microbit(r.hex, { log, progres: pourcent(log) }); }
        catch (e) { log('✗ Écriture USB impossible : ' + TL.flash.messageMicrobit(e) + '. Le fichier est téléchargé à la place.'); }
        TL.flash.enregistrerHex(r.hex, nom);
        log('✓ ' + nom + ' téléchargé : glisse-le sur le lecteur MICROBIT (la carte redémarre avec le programme).');
        return true;
      }
    }
    let fichier = null;
    if (window.showSaveFilePicker && !window.TL_NO_PICKER && !TL.flash.microbitUsbPossible()) {
      try {
        log('Choisis le lecteur MICROBIT puis « Enregistrer »…');
        fichier = await window.showSaveFilePicker({ suggestedName: nom, types: [{ description: 'Programme micro:bit', accept: { 'application/octet-stream': ['.hex'] } }] });
      } catch (e) { if (e.name === 'AbortError') { log('Enregistrement annulé.'); return false; } fichier = null; }
    }
    await R.disconnect('maqueen'); // la micro:bit va redémarrer
    const r = await R.compile(robot, code, log, o.cle);
    if (!r) return false;
    if (fichier) {
      try {
        const w = await fichier.createWritable(); await w.write(r.hex); await w.close();
        log('✓ ' + fichier.name + ' écrit. Si c’était le lecteur MICROBIT, sa LED clignote puis la carte redémarre avec le programme.');
        return true;
      } catch (e) { log('Écriture directe impossible (' + e.message + ') : le fichier est téléchargé à la place.'); }
    }
    TL.flash.enregistrerHex(r.hex, nom);
    log('✓ ' + nom + ' téléchargé : glisse-le sur le lecteur MICROBIT (la carte redémarre avec le programme).');
    return true;
  };

  /* ================= Mode direct : programme installé une fois dans le robot =================
     Protocole texte, une ligne par ordre, 115200 bauds, identique pour les deux robots :
       H              → « OK TS-ROBOT <robot> 1 »
       M g d          moteurs gauche / droit, de −100 à 100
       L q r v b      LED (q : 0 toutes, 1 gauche, 2 droite ; r v b de 0 à 255)
       T f            son de f Hz (0 : silence)
       A texte        afficher (écran de la micro:bit ; rien sur le mBot)
       I ICONE        icône (micro:bit)
       S              tout arrêter
       C              → « C distance ligneG ligneD lumière boutonA boutonB »
     Sécurité : sans aucun ordre pendant 1,5 s (câble arraché, onglet fermé), les moteurs s'arrêtent. */
  R.DIRECT_VERSION = 1;
  R.firmware = function (robot) {
    const H = R.HELP;
    if (robot === 'mbot') {
      return [
        '// TechnoStudio — mode direct du mBot (version ' + R.DIRECT_VERSION + ')',
        '// Le robot obéit aux ordres envoyés par TechnoStudio sur le câble USB (115200 bauds) :',
        '//   H : présentation · M g d : moteurs · L q r v b : LED · T f : son · S : tout arrêter',
        '//   C : capteurs → « C distance ligneG ligneD lumière boutonA boutonB »',
        '',
        H.cpp.moteurs, '', H.cpp.distance, '', H.cpp.ligne, '', H.cpp.lumiere, '', H.cpp.bouton, '', H.cpp.leds, '',
        'char ligne[48];',
        'uint8_t n = 0;',
        'unsigned long dernier = 0;',
        'bool roule = false;',
        '',
        'void executer(char *c) {',
        '  char k = c[0];',
        '  char *p = c + 1;',
        '  if (k == \'H\') Serial.println(F("OK TS-ROBOT mbot ' + R.DIRECT_VERSION + '"));',
        '  else if (k == \'M\') { float g = strtod(p, &p); float d = strtod(p, &p); moteurs(g, d); roule = g != 0 || d != 0; }',
        '  else if (k == \'L\') { int q = strtol(p, &p, 10); int r = strtol(p, &p, 10); int v = strtol(p, &p, 10); int b = strtol(p, &p, 10); led(q, r, v, b); }',
        '  else if (k == \'T\') { long f = strtol(p, &p, 10); if (f > 0) tone(8, f); else noTone(8); }',
        '  else if (k == \'S\') { moteurs(0, 0); roule = false; noTone(8); led(0, 0, 0, 0); }',
        '  else if (k == \'C\') {',
        '    Serial.print(F("C "));',
        '    Serial.print(distanceCm(), 1);',
        '    Serial.print(ligneNoire(9) ? F(" 1") : F(" 0"));',
        '    Serial.print(ligneNoire(10) ? F(" 1") : F(" 0"));',
        '    Serial.print(\' \');',
        '    Serial.print((int)lumiere());',
        '    Serial.print(boutonCarte() ? F(" 1") : F(" 0"));',
        '    Serial.println(F(" 0"));',
        '  }',
        '}',
        '',
        'void setup() {',
        '  pinMode(4, OUTPUT); pinMode(5, OUTPUT); pinMode(6, OUTPUT); pinMode(7, OUTPUT);',
        '  pinMode(9, INPUT); pinMode(10, INPUT); pinMode(13, OUTPUT);',
        '  moteurs(0, 0);',
        '  led(0, 0, 0, 0);',
        '  Serial.begin(115200);',
        '  Serial.println(F("OK TS-ROBOT mbot ' + R.DIRECT_VERSION + '"));',
        '}',
        '',
        'void loop() {',
        '  while (Serial.available()) {',
        '    char ch = Serial.read();',
        '    if (ch == \'\\n\' || ch == \'\\r\') {',
        '      if (n) { ligne[n] = 0; executer(ligne); n = 0; }',
        '      dernier = millis();',
        '    } else if (n < sizeof(ligne) - 1) ligne[n++] = ch;',
        '  }',
        '  // sécurité : plus aucun ordre depuis 1,5 s (câble débranché, onglet fermé) : le robot s’arrête',
        '  if (roule && millis() - dernier > 1500) { moteurs(0, 0); roule = false; noTone(8); }',
        '}',
        '',
      ].join('\n');
    }
    return [
      '# TechnoStudio — mode direct du Maqueen (version ' + R.DIRECT_VERSION + ')',
      '# La micro:bit obéit aux ordres envoyés par TechnoStudio sur le câble USB (115200 bauds).',
      'from microbit import *',
      'import utime',
      'import neopixel',
      'import music',
      'from machine import time_pulse_us',
      '',
      H.mpy.moteurs, '', H.mpy.distance, '', H.mpy.ligne, '', H.mpy.lumiere, '', H.mpy.leds, '',
      'roule = False',
      'dernier = running_time()',
      'tampon = b""',
      '',
      'def executer(l):',
      '    global roule',
      '    m = l.split(" ")',
      '    k = m[0]',
      '    if k == "H":',
      '        uart.write("OK TS-ROBOT maqueen ' + R.DIRECT_VERSION + '\\n")',
      '    elif k == "M":',
      '        g = float(m[1])',
      '        d = float(m[2])',
      '        moteurs(g, d)',
      '        roule = g != 0 or d != 0',
      '    elif k == "L":',
      '        led(int(m[1]), int(m[2]), int(m[3]), int(m[4]))',
      '    elif k == "T":',
      '        if int(m[1]) > 0:',
      '            music.pitch(int(m[1]), -1, wait=False)',
      '        else:',
      '            music.stop()',
      '    elif k == "S":',
      '        moteurs(0, 0)',
      '        roule = False',
      '        music.stop()',
      '        led(0, 0, 0, 0)',
      '        display.show("D")',
      '    elif k == "A":',
      '        display.scroll(l[2:], wait=False)',
      '    elif k == "I":',
      '        display.show(getattr(Image, m[1]))',
      '    elif k == "C":',
      '        uart.write("C %s %d %d %d %d %d\\n" % (distance_cm(), ligne_noire(pin13), ligne_noire(pin14), lumiere(), button_a.is_pressed(), button_b.is_pressed()))',
      '',
      'moteurs(0, 0)',
      'led(0, 0, 0, 0)',
      'display.show("D")',
      'uart.init(115200)',
      'uart.write("OK TS-ROBOT maqueen ' + R.DIRECT_VERSION + '\\n")',
      'while True:',
      '    if uart.any():',
      '        tampon += uart.read()',
      '        while b"\\n" in tampon:',
      '            i = tampon.index(b"\\n")',
      '            ligne = tampon[:i]',
      '            tampon = tampon[i + 1:]',
      '            try:',
      '                executer(str(ligne, "utf-8").strip())',
      '            except Exception:',
      '                pass',
      '            dernier = running_time()',
      '        if len(tampon) > 200:',
      '            tampon = b""',
      '    elif roule and running_time() - dernier > 1500:',
      '        # sécurité : plus aucun ordre depuis 1,5 s : le robot s’arrête',
      '        moteurs(0, 0)',
      '        roule = False',
      '        music.stop()',
      '    sleep(2)',
      '',
    ].join('\n');
  };

  /* ---------- Connexion USB permanente (une par robot : les deux peuvent être branchés) ---------- */
  const attendreMs = (ms) => new Promise((r) => setTimeout(r, ms));
  R.live = { mbot: null, maqueen: null };
  const ecouteurs = new Set();
  R.onLive = (fn) => { ecouteurs.add(fn); return () => ecouteurs.delete(fn); };
  const prevenir = (robot) => ecouteurs.forEach((fn) => { try { fn(robot); } catch (e) { console.warn(e); } });

  class Liaison {
    constructor(robot, port) {
      this.robot = robot; this.port = port; this.etat = 'connexion'; this.capteurs = null; this.vu = 0;
      this.file = Promise.resolve(); this.lastM = ''; this.attenteC = 0; this.tampon = ''; this.hello = null;
    }
    async ouvrir() {
      try { await this.port.open({ baudRate: 115200 }); } catch (e) {
        if (/open|already|ouvert/i.test(e.message)) throw new Error('Le port USB est déjà utilisé (autre onglet, moniteur série, mBlock…) : ferme-le puis recommence.');
        throw e;
      }
      this.writer = this.port.writable.getWriter();
      this.lire();
      // Le mBot redémarre quand on ouvre le port : son programme se présente après le chargeur (≈ 1 à 2 s)
      const ok = await this.presentation(this.robot === 'mbot' ? 3500 : 2000);
      this.etat = ok ? 'ok' : 'sans-programme';
      if (ok) this.sonder();
      prevenir(this.robot);
      return ok;
    }
    presentation(delai) {
      return new Promise((res) => {
        let fini = false;
        const fin = (v) => { if (fini) return; fini = true; clearInterval(t); this.hello = null; res(v); };
        this.hello = () => fin(true);
        const t = setInterval(() => this.ecrire('H', true), 600);
        setTimeout(() => this.ecrire('H', true), this.robot === 'mbot' ? 1200 : 50);
        setTimeout(() => fin(false), delai);
      });
    }
    async lire() {
      const dec = new TextDecoder();
      try {
        this.reader = this.port.readable.getReader();
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          this.tampon += dec.decode(value, { stream: true });
          let i;
          while ((i = this.tampon.indexOf('\n')) >= 0) { const l = this.tampon.slice(0, i).trim(); this.tampon = this.tampon.slice(i + 1); if (l) this.ligne(l); }
          if (this.tampon.length > 500) this.tampon = '';
        }
      } catch (e) { /* port fermé ou débranché */ }
      try { this.reader.releaseLock(); } catch (e) { /* déjà libéré */ }
      if (this.etat !== 'ferme') { this.etat = 'ferme'; this.arreterSonde(); if (R.live[this.robot] === this) R.live[this.robot] = null; prevenir(this.robot); }
    }
    ligne(l) {
      if (/^OK TS-ROBOT/.test(l)) { if (this.hello) this.hello(); return; }
      if (l[0] === 'C') {
        const v = l.split(/\s+/).slice(1).map(Number);
        if (v.length >= 6 && v.every((x) => isFinite(x))) { this.capteurs = { distance: v[0], ligneG: !!v[1], ligneD: !!v[2], lumiere: v[3], boutonA: !!v[4], boutonB: !!v[5] }; this.vu = Date.now(); }
        this.attenteC = 0;
      }
    }
    ecrire(l, force) {
      if (!this.writer || (!force && this.etat !== 'ok')) return;
      if (l[0] === 'M') { if (l === this.lastM) return; this.lastM = l; }
      if (l === 'S') this.lastM = 'M 0 0';
      const octets = new TextEncoder().encode(l + '\n');
      this.file = this.file.then(() => this.writer.write(octets)).catch(() => {});
    }
    // Les capteurs sont relus en continu (et servent de signal de vie pour la sécurité du robot)
    sonder() {
      this.arreterSonde();
      this.sonde = setInterval(() => {
        if (this.attenteC && Date.now() - this.attenteC < 400) return;
        this.attenteC = Date.now(); this.ecrire('C');
      }, 70);
    }
    arreterSonde() { clearInterval(this.sonde); this.sonde = null; }
    async fermer() {
      this.arreterSonde();
      if (this.etat === 'ok') { this.ecrire('S'); try { await Promise.race([this.file, attendreMs(300)]); } catch (e) { /* rien */ } }
      this.etat = 'ferme';
      try { await this.reader.cancel(); } catch (e) { /* rien */ }
      try { this.writer.releaseLock(); } catch (e) { /* rien */ }
      try { await this.port.close(); } catch (e) { /* rien */ }
    }
  }
  R.Liaison = Liaison;

  /** Connecte un robot en mode direct ; à appeler dans le clic. → Liaison */
  R.connect = async function (robot, forcer) {
    const port = await choisirPort(robot, forcer);
    await R.disconnect(robot);
    if (robot === 'mbot' && TL.flash.liberer) await TL.flash.liberer(port); // moniteur série de l'atelier Code
    const L = new Liaison(robot, port);
    R.live[robot] = L; prevenir(robot);
    try { await L.ouvrir(); } catch (e) { R.live[robot] = null; R.ports[robot] = null; prevenir(robot); throw e; }
    return L;
  };
  R.disconnect = async function (robot) {
    const L = R.live[robot]; if (!L) return;
    R.live[robot] = null;
    await L.fermer();
    prevenir(robot);
  };

  /* ---------- Interpréteur : les blocs tournent dans l'ordinateur, les ordres partent au robot ----------
     io : { send(ligne), capteurs() → { distance, ligneG, ligneD, lumiere, boutonA, boutonB }, now() en ms,
            log(message), highlight(id) }. step() est appelé régulièrement (toutes les 20 ms). */
  const tops0 = (state) => (state && state.blocks && state.blocks.blocks) || [];
  class Direct {
    constructor(state, robot, io) {
      this.state = state; this.robot = robot; this.io = io; this.vars = {}; this.done = false; this.until = 0; this.error = null;
      (state.variables || []).forEach((v) => (this.vars[v.id] = 0));
      const start = tops0(state).find((b) => b.type === 'rb_start');
      this.start = !!start;
      this.t0 = io.now();
      this.gen = this.seq(start && start.next && start.next.block);
    }
    cap() { return this.io.capteurs() || { distance: 400, ligneG: false, ligneD: false, lumiere: 0, boutonA: false, boutonB: false }; }
    val(inp, d) { const b = inp && (inp.block || inp.shadow); return b ? this.ev(b) : d == null ? 0 : d; }
    num(inp, d) { const v = Number(this.val(inp, d)); return isFinite(v) ? v : 0; }
    ev(b) {
      const f = b.fields || {}, i = b.inputs || {}, c = () => this.cap();
      switch (b.type) {
        case 'math_number': return +f.NUM || 0;
        case 'text': return String(f.TEXT == null ? '' : f.TEXT);
        case 'variables_get': return this.vars[f.VAR && f.VAR.id] || 0;
        case 'rb_distance': return c().distance;
        case 'rb_line': return f.SIDE === 'left' ? c().ligneG : c().ligneD;
        case 'rb_light': return c().lumiere;
        case 'rb_button': return f.BTN === 'b' ? this.robot === 'maqueen' && c().boutonB : c().boutonA;
        case 'rb_timer': return Math.round((this.io.now() - this.t0) / 10) / 100;
        case 'rb_arith': {
          const a = this.num(i.A), bb = this.num(i.B);
          return { '+': a + bb, '-': a - bb, '*': a * bb, '/': bb ? a / bb : 0 }[f.OP] || 0;
        }
        case 'rb_random': { const a = Math.round(this.num(i.A, 1)), bb = Math.round(this.num(i.B, 10)); const lo = Math.min(a, bb), hi = Math.max(a, bb); return lo + Math.floor(Math.random() * (hi - lo + 1)); }
        case 'rb_lt': return this.num(i.A) < this.num(i.B);
        case 'rb_gt': return this.num(i.A) > this.num(i.B);
        case 'rb_eq': { const a = this.val(i.A), bb = this.val(i.B); return typeof a === 'string' || typeof bb === 'string' ? String(a) === String(bb) : Math.abs(a - bb) < 1e-9; }
        case 'rb_and': return !!this.val(i.A, false) && !!this.val(i.B, false);
        case 'rb_or': return !!this.val(i.A, false) || !!this.val(i.B, false);
        case 'rb_not': return !this.val(i.A, false);
      }
      return 0;
    }
    moteurs(g, d) { const k = (v) => Math.round(Math.max(-100, Math.min(100, v))); this.io.send('M ' + k(g) + ' ' + k(d)); }
    *seq(b) { while (b) { yield* this.exec(b); b = b.next && b.next.block; } }
    *exec(b) {
      const f = b.fields || {}, i = b.inputs || {};
      const sub = (k) => i[k] && i[k].block;
      const p = () => this.num(i.P, 50), s = () => Math.max(0, this.num(i.S, 1));
      this.io.highlight(b.id);
      switch (b.type) {
        case 'rb_fwd': this.moteurs(p(), p()); break;
        case 'rb_back': { const v = f.SENS === 'fwd' ? p() : -p(); this.moteurs(v, v); break; }
        case 'rb_turn': { const v = p(); f.DIR === 'right' ? this.moteurs(v, -v) : this.moteurs(-v, v); break; }
        case 'rb_fwd_t': { const v = p(); this.moteurs(v, v); yield { wait: s() }; this.moteurs(0, 0); break; }
        case 'rb_back_t': { const v = f.SENS === 'fwd' ? p() : -p(); this.moteurs(v, v); yield { wait: s() }; this.moteurs(0, 0); break; }
        case 'rb_turn_t': { const v = p(); f.DIR === 'right' ? this.moteurs(v, -v) : this.moteurs(-v, v); yield { wait: s() }; this.moteurs(0, 0); break; }
        case 'rb_motors': this.moteurs(this.num(i.L, 50), this.num(i.R, 50)); break;
        case 'rb_stop': this.moteurs(0, 0); break;
        case 'rb_led': { const [r, v, bl] = RGB[f.COLOR] || RGB.off; this.io.send(`L ${{ all: 0, left: 1, right: 2 }[f.SIDE] || 0} ${r} ${v} ${bl}`); break; }
        case 'rb_leds_off': this.io.send('L 0 0 0 0'); break;
        case 'rb_tone': this.io.send('T ' + Math.max(0, Math.round(this.num(i.F, 440)))); yield { wait: s() }; this.io.send('T 0'); break;
        case 'rb_say': {
          let t = this.val(i.V, ''); if (typeof t === 'number') t = String(Math.round(t * 100) / 100).replace('.', ',');
          t = String(t).replace(/[\r\n]+/g, ' ').slice(0, 60);
          this.io.log('💬 ' + t);
          if (this.robot === 'maqueen') this.io.send('A ' + t);
          break;
        }
        case 'rb_icon': if (this.robot === 'maqueen') this.io.send('I ' + f.ICON); break;
        case 'rb_timer_reset': this.t0 = this.io.now(); break;
        case 'rb_wait': yield { wait: s() }; break;
        case 'rb_forever': for (;;) { yield* this.seq(sub('DO')); yield null; }
        case 'rb_repeat': { const n = Math.min(1e5, Math.max(0, Math.round(this.num(i.N, 0)))); for (let k = 0; k < n; k++) { yield* this.seq(sub('DO')); yield null; } break; }
        case 'rb_if': if (this.val(i.COND, false)) yield* this.seq(sub('DO')); break;
        case 'rb_ifelse': if (this.val(i.COND, false)) yield* this.seq(sub('DO')); else yield* this.seq(sub('ELSE')); break;
        case 'rb_wait_until': while (!this.val(i.COND, false)) yield null; break;
        case 'rb_repeat_until': while (!this.val(i.COND, false)) { yield* this.seq(sub('DO')); yield null; } break;
        case 'variables_set': this.vars[f.VAR && f.VAR.id] = this.val(i.VALUE, 0); break;
        case 'math_change': { const id = f.VAR && f.VAR.id; this.vars[id] = (Number(this.vars[id]) || 0) + this.num(i.DELTA, 1); break; }
      }
    }
    step() {
      if (this.done || this.io.now() < this.until) return;
      try {
        for (let ops = 0; ops < 2000; ops++) {
          const r = this.gen.next();
          if (r.done) { this.done = true; this.io.highlight(null); return; }
          if (r.value && r.value.wait != null) { this.until = this.io.now() + r.value.wait * 1000; return; }
          if (r.value === null) return;
        }
      } catch (e) { this.error = e.message; this.done = true; }
    }
  }
  R.Direct = Direct;

  /* ================= Panneau latéral ================= */
  const P = { el: null, host: null, cur: null };
  const WKEY = 'technostudio.mblock.largeur';
  const RKEY = 'technostudio.robot.dernier';
  const MKEY = 'technostudio.robot.mode';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function panel() {
    if (P.el) return P.el;
    const host = document.getElementById('workspace') || document.body;
    const el = h('aside.rbt-side', { 'aria-label': 'Environnement de programmation des robots' });
    const grip = h('div.mbk-grip', { title: 'Glisser pour élargir', role: 'separator', 'aria-orientation': 'vertical' });
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault(); grip.setPointerCapture(e.pointerId);
      const right = host.getBoundingClientRect().right;
      const mv = (ev) => host.style.setProperty('--mbk-w', Math.round(clamp(right - ev.clientX, 520, Math.max(520, host.getBoundingClientRect().width - 320))) + 'px');
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); try { localStorage.setItem(WKEY, host.style.getPropertyValue('--mbk-w')); } catch (err) { /* stockage indisponible */ } };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
    el.append(grip, h('div.mbk-inner.rbt-inner'));
    host.append(el);
    let saved = null; try { saved = localStorage.getItem(WKEY); } catch (e) { /* stockage indisponible */ }
    if (saved) host.style.setProperty('--mbk-w', saved);
    P.el = el; P.host = host;
    return el;
  }

  R.close = function () {
    const c = P.cur; if (!c) return;
    c.flush(); clearInterval(c.watch);
    if (c.stopAll) c.stopAll();
    try { c.ws.dispose(); } catch (e) { /* déjà détruit */ }
    P.cur = null;
    P.host.classList.remove('rbt-open');
    refreshCards();
  };

  R.open = async function (b, ctx) {
    panel();
    if (P.cur && P.cur.b === b) return;
    if (P.cur) R.close();
    if (TL.mblock && TL.mblock.close) TL.mblock.close();
    if (TL.ressources && TL.ressources.close) TL.ressources.close();
    const inner = P.el.querySelector('.rbt-inner');
    inner.innerHTML = '';
    inner.append(h('p.mbk-loading', 'Chargement des blocs…'));
    P.host.classList.add('rbt-open');
    try { await R.load(); } catch (e) { inner.innerHTML = ''; inner.append(h('p.callout.warn', e.message)); return; }
    build(b, ctx, inner);
    refreshCards();
  };

  const robotsOf = (b) => { const l = (b.robots && b.robots.length ? b.robots : R.LIST).filter((k) => R.ROBOTS[k]); return l.length ? l : R.LIST; };
  const countBlocks = (state) => { let n = 0; const walk = (x) => { if (!x) return; n++; Object.values(x.inputs || {}).forEach((i) => walk(i.block)); walk(x.next && x.next.block); }; ((state && state.blocks && state.blocks.blocks) || []).forEach(walk); return n; };
  const typesOf = (state) => { const s = new Set(); const walk = (x) => { if (!x) return; s.add(x.type); Object.values(x.inputs || {}).forEach((i) => walk(i.block)); walk(x.next && x.next.block); }; ((state && state.blocks && state.blocks.blocks) || []).forEach(walk); return s; };
  R.startProgram = () => ({ blocks: { languageVersion: 0, blocks: [{ type: 'rb_start', x: 30, y: 30 }] } });

  function build(b, ctx, inner) {
    const Bl = window.Blockly;
    const robots = robotsOf(b);
    const prev = (ctx.answer && ctx.answer.value) || {};
    let last = null; try { last = localStorage.getItem(RKEY); } catch (e) { /* rien */ }
    let robot = [prev.robot, b.robot, last].find((k) => k && robots.includes(k)) || robots[0];
    const c = { b, ctx, robot, busy: false, run: null, tick: null };
    c.mode = 'upload'; try { if (localStorage.getItem(MKEY) === 'live') c.mode = 'live'; } catch (e) { /* rien */ }
    P.cur = c;
    inner.innerHTML = '';

    /* --- En-tête : sélecteur de robot --- */
    const sw = h('div.rbt-switch', { role: 'radiogroup', 'aria-label': 'Robot' });
    const swBtns = {};
    robots.forEach((k) => {
      const rb = R.ROBOTS[k];
      const badge = h('span.rbt-badge');
      const bt = h('button.rbt-sw', { type: 'button', role: 'radio', title: 'Programmer le ' + rb.long, onclick: () => setRobot(k) }, h('span.rbt-sw-ico', { 'aria-hidden': 'true' }, R.img(k)), h('span', rb.name), badge);
      bt.badge = badge; swBtns[k] = bt; sw.append(bt);
    });
    const top = h('header.mbk-top.rbt-top',
      h('span.mbk-logo', 'Robots'),
      sw,
      h('span.mbk-sp'),
      h('button.mbk-x', { type: 'button', title: 'Replier l’environnement', 'aria-label': 'Fermer', onclick: () => R.close() }, '✕'));
    const utiles = (b.expect || []).filter((t) => ['rb_forever', 'rb_repeat', 'rb_ifelse', 'rb_if', 'rb_wait_until', 'rb_repeat_until', 'variables_set'].includes(t)).map((t) => ({ variables_set: 'mettre … à', rb_ifelse: 'si … alors … sinon' }[t] || R.label(t)));
    const consigne = b.question ? h('div.mbk-consigne', h('div', { html: TL.inlineMd(b.question) }), utiles.length ? h('div.mbk-utiles', h('b', 'Blocs à utiliser : '), utiles.map((u, i) => [i ? ' · ' : '', h('span.mbk-utile', u)])) : null) : null;

    /* --- Colonne de droite : cible, actions, code, console --- */
    const cible = h('div.rbt-cible');
    const btnCompile = h('button.rbt-act.rbt-adv', { type: 'button', title: 'Compiler sur le serveur (vérifie le programme sans l’envoyer)' }, h('span', { 'aria-hidden': 'true' }, '✓'), ' Compiler');
    const btnUpload = h('button.rbt-act.go.rbt-main-btn', { type: 'button', title: 'Compiler puis envoyer dans le robot' }, h('span', { 'aria-hidden': 'true' }, '⬆'), ' Téléverser dans le robot');
    const btnExport = h('button.rbt-act.ghost.rbt-adv', { type: 'button', title: 'Enregistrer le code source' }, '⤓');
    const bar = h('div.rbt-actions', btnUpload, btnCompile, btnExport);
    // Message court pour l'élève : la dernière étape importante (le détail est dans la console, mode avancé)
    const statut = h('div.rbt-statut', { 'aria-live': 'polite', hidden: true });
    const AKEY = 'technostudio.robot.avance';
    let avance = false; try { avance = localStorage.getItem(AKEY) === '1'; } catch (e) { /* rien */ }
    const btnAvance = h('button.rbt-avance-b', { type: 'button', 'aria-pressed': 'false', title: 'Voir le code, la console, la compilation seule, les branchements' });
    const setAvance = (v) => {
      avance = v; try { localStorage.setItem(AKEY, v ? '1' : '0'); } catch (e) { /* rien */ }
      inner.classList.toggle('rbt-avance', v); btnAvance.setAttribute('aria-pressed', String(v));
      btnAvance.textContent = v ? '▾ Masquer les détails' : '▸ Avancé';
    };
    btnAvance.onclick = () => setAvance(!avance);
    const btnModeUp = h('button.rbt-mode-b', { type: 'button', role: 'radio', title: 'Le programme est compilé puis rangé dans le robot, qui fonctionne seul, sans câble.', onclick: () => setMode('upload') }, '⬆ Téléverser');
    const btnModeLive = h('button.rbt-mode-b', { type: 'button', role: 'radio', title: 'Le programme tourne dans l’ordinateur ; le robot, relié par le câble, obéit en temps réel.', onclick: () => setMode('live') }, '⚡ En direct');
    const modeSw = h('div.rbt-modes', { role: 'radiogroup', 'aria-label': 'Mode' }, btnModeUp, btnModeLive);
    const liveBox = h('div.rbt-live');
    const tabCode = h('button.rbt-tab.on', { type: 'button' }, 'Code');
    const tabLog = h('button.rbt-tab', { type: 'button' }, 'Console');
    const pre = h('pre.rbt-pre.mono', { tabindex: '0' });
    const logBox = h('pre.rbt-pre.rbt-log.mono', { tabindex: '0', hidden: true, 'aria-live': 'polite' });
    const showTab = (which) => { tabCode.classList.toggle('on', which === 'code'); tabLog.classList.toggle('on', which === 'log'); pre.hidden = which !== 'code'; logBox.hidden = which !== 'log'; };
    tabCode.onclick = () => showTab('code'); tabLog.onclick = () => showTab('log');
    const warnBox = h('div.rbt-warn', { hidden: true });
    const log = (s, consoleSeule) => {
      if (!s) return;
      s = String(s).replace(/\s+$/, '');
      logBox.textContent += s + '\n'; logBox.scrollTop = 1e9;
      if (consoleSeule || /\n/.test(s) || /^— /.test(s)) return;
      const pc = s.match(/^… (\d+) %$/);
      const txt = pc ? 'Envoi dans le robot… ' + pc[1] + ' %' : s;
      const k = /^✓/.test(txt) ? 'ok' : /^✗/.test(txt) ? 'err' : /^⚠/.test(txt) ? 'warn' : '';
      statut.hidden = false; statut.className = 'rbt-statut' + (k ? ' ' + k : ''); statut.innerHTML = '';
      statut.append(h('span', txt));
      if (k === 'err' && !avance) statut.append(' ', h('button.rbt-link', { type: 'button', onclick: () => { setAvance(true); showTab('log'); } }, 'détails'));
      if (k === 'err' && avance) showTab('log');
    };

    // Objectifs (facultatifs) et rendu
    const expect = (b.expect || []).filter((t) => DEFS[t] || t === 'variables_set');
    const goals = h('ul.goals.mbk-goals');
    const goalList = () => [{ name: 'Le programme commence par « quand le robot démarre »', ok: (st) => st.start }]
      .concat(expect.map((t) => ({ name: 'Utilise le bloc « ' + (t === 'variables_set' ? 'mettre … à' : R.label(t)) + ' »', ok: (st) => st.types.has(t) })))
      .concat([{ name: 'Le programme est téléversé, ou essayé en direct, sur le robot choisi', ok: (st) => st.compiled }]);
    const drawGoals = (res) => { goals.innerHTML = ''; goalList().forEach((g, i) => goals.append(h('li' + (res ? (res[i] ? '.is-ok' : '.is-bad') : ''), h('span.goal-mark', res ? (res[i] ? '✓' : '✗') : '○'), h('span', g.name)))); };
    drawGoals(prev.goals);
    const check = !b.demo ? TL.checkBar(ctx, {
      checkLabel: 'Rendre mon programme', allowRetry: true,
      check() {
        c.flush();
        const state = save();
        const st = { start: c.gen.start, types: typesOf(state), compiled: R.compiled(c.robot, c.gen.code) || essaye[c.robot] === c.gen.code };
        const res = goalList().map((g) => !!g.ok(st));
        drawGoals(res);
        const good = res.filter(Boolean).length;
        setTimeout(refreshCards, 0);
        return { value: Object.assign({}, valueNow(), { goals: res }), correct: good === res.length, score: good / res.length, pendingReview: true,
          msg: good === res.length ? 'Programme rendu : ton professeur pourra le relire.' : (st.compiled ? '' : 'Clique d’abord sur « Téléverser dans le robot » (ou essaie ton programme en direct). ') + `${good} objectif(s) atteint(s) sur ${res.length}.` };
      },
    }) : null;

    // En haut : à gauche le robot et les actions (ou le mode direct et ses capteurs), à droite le code, la console et les objectifs ; en bas : les blocs
    const right = h('div.rbt-right',
      h('div.rbt-colA', modeSw, cible, bar, liveBox, statut, warnBox, btnAvance),
      h('div.rbt-colB', h('div.rbt-tabs.rbt-adv', tabCode, tabLog, h('span.mbk-sp'), h('span.small.muted.rbt-lang')), h('div.rbt-adv.rbt-prebox', pre, logBox),
        !b.demo ? h('div.rbt-goals', h('div.label-up', 'Objectifs'), goals, check) : null));
    const code = h('div.mbk-code.rbt-code');
    inner.append(top, consigne, h('div.mbk-main.rbt-main', code, right));
    setAvance(avance);

    /* --- Blockly --- */
    const allowed = (b.toolbox && b.toolbox.length ? b.toolbox : DEFAULT_TOOLBOX).filter((t) => DEFS[t]);
    const ws = (c.ws = Bl.inject(code, {
      toolbox: toolbox(allowed), renderer: 'zelos', theme: 'mblock', media: TL.code.media || undefined, trashcan: !!TL.code.media, sounds: false,
      zoom: { controls: true, wheel: true, startScale: 0.72, maxScale: 1.6, minScale: 0.35, scaleSpeed: 1.15 },
      move: { scrollbars: true, drag: true, wheel: true }, grid: { spacing: 24, length: 2, colour: '#ddd', snap: false }, readOnly: !!b.demo,
    }));
    const startState = prev.workspace || b.start || R.startProgram();
    try { Bl.serialization.workspaces.load(startState, ws); } catch (e) { console.warn(e); Bl.serialization.workspaces.load(R.startProgram(), ws); }
    function save() { return c.ws ? Bl.serialization.workspaces.save(c.ws) : startState; }
    const uploaded = Object.assign({}, prev.uploaded);   // { robot: code téléversé }
    const essaye = Object.assign({}, prev.essaye);       // { robot: code essayé en direct }
    const valueNow = () => ({ workspace: save(), robot: c.robot, code: c.gen ? c.gen.code : '', uploaded, essaye });

    /* --- Génération en direct pour le robot actif (et badges des deux robots) --- */
    let applying = false, lastWarn = new Map();
    function regen() {
      c.gen = R.generate(ws, c.robot);
      pre.textContent = c.gen.code;
      applying = true;
      try {
        lastWarn.forEach((_, id) => { if (!c.gen.warnings.has(id)) { const bl = ws.getBlockById(id); if (bl) bl.setWarningText(null); } });
        c.gen.warnings.forEach((msg, id) => { const bl = ws.getBlockById(id); if (bl) bl.setWarningText(msg); });
      } finally { applying = false; }
      lastWarn = c.gen.warnings;
      const msgs = [...new Set(c.gen.warnings.values())];
      warnBox.hidden = !msgs.length && c.gen.start;
      warnBox.innerHTML = '';
      if (!c.gen.start) warnBox.append(h('div', '⚠ Ajoute le bloc « quand le robot démarre » (Événements) et accroche ton programme dessous.'));
      msgs.forEach((m) => warnBox.append(h('div', '⚠ ' + m)));
      refreshBadges();
    }
    function refreshBadges() {
      robots.forEach((k) => {
        const bt = swBtns[k];
        bt.classList.toggle('on', k === c.robot); bt.setAttribute('aria-checked', String(k === c.robot));
        const codeK = k === c.robot ? c.gen.code : R.generate(ws, k).code;
        const up = uploaded[k] && uploaded[k] === codeK, comp = R.compiled(k, codeK), dir = essaye[k] === codeK;
        bt.badge.textContent = up ? '⬆' : comp ? '✓' : dir ? '⚡' : '';
        bt.badge.title = up ? 'Ce programme est dans le robot' : comp ? 'Compilé' : dir ? 'Essayé en direct' : '';
        const L = R.live[k];
        bt.classList.toggle('live', !!(L && L.etat === 'ok'));
        bt.title = 'Programmer le ' + R.ROBOTS[k].long + (L && L.etat === 'ok' ? ' · connecté en direct' : '');
      });
      if (k0 !== c.robot) drawCible();
    }
    let k0 = null;
    function drawCible() {
      k0 = c.robot;
      const rb = R.ROBOTS[c.robot];
      cible.innerHTML = '';
      const port = c.mode === 'live' ? null : c.robot === 'mbot'
        ? h('div.rbt-port.rbt-adv', R.ports.mbot ? '🔌 Port USB du mBot retenu.' : '🔌 Le port USB sera demandé au premier téléversement.', R.ports.mbot ? h('button.rbt-link', { type: 'button', onclick: (e) => { e.preventDefault(); R.ports.mbot = null; drawCible(); } }, 'changer') : null)
        : h('div.rbt-port.rbt-adv', TL.flash && TL.flash.microbitUsbPossible() ? '🔌 Branche la micro:bit en USB : Chrome te demande de la choisir, puis le programme y est écrit directement.' : '💾 Le programme devient un fichier maqueen.hex à enregistrer sur le lecteur MICROBIT.');
      cible.append(h('div.rbt-cible-t', h('span.rbt-cible-ico', { 'aria-hidden': 'true' }, R.img(c.robot)), h('div', h('b', rb.name), h('span.small.muted', rb.cable), h('span.small.muted.rbt-adv', rb.long + ' · ' + rb.langName))), port, h('details.rbt-pins.rbt-adv', h('summary', 'Branchements'), h('p.small', rb.brochage)));
      inner.querySelector('.rbt-lang').textContent = rb.langName;
      btnUpload.title = c.robot === 'mbot' ? 'Compiler puis écrire le programme dans le mBot (câble USB)' : (TL.flash && TL.flash.microbitUsbPossible() ? 'Compiler puis écrire le programme dans la micro:bit (câble USB)' : 'Compiler puis enregistrer maqueen.hex sur le lecteur MICROBIT');
      if (c.liveReady) drawLive();
    }
    function setRobot(k) {
      if (k === c.robot || c.busy) return;
      if (c.run) stopRun();
      c.robot = k;
      try { localStorage.setItem(RKEY, k); } catch (e) { /* rien */ }
      regen();
      log('— Robot choisi : ' + R.ROBOTS[k].long + '. Le programme est le même, le code est régénéré en ' + R.ROBOTS[k].langName + '.');
      statut.hidden = true;
      showTab('code');
      persist();
    }
    drawCible();
    regen();
    const initial = JSON.stringify(save());
    let dirty = false;
    const persist = TL.debounce(() => { if (!b.demo) ctx.save({ value: Object.assign({}, ctx.answer && ctx.answer.value, valueNow()) }); refreshCards(); }, 500);
    const regenSoon = TL.debounce(regen, 150);
    ws.addChangeListener((e) => {
      if (e.isUiEvent || applying) return;
      regenSoon();
      if (!dirty && JSON.stringify(save()) === initial) return;
      dirty = true; persist();
    });
    c.flush = () => { if (!b.demo && dirty) ctx.save({ value: Object.assign({}, ctx.answer && ctx.answer.value, valueNow()) }); };
    new ResizeObserver(() => Bl.svgResize(ws)).observe(code);
    P.el.addEventListener('transitionend', () => Bl.svgResize(ws), { once: true });

    /* --- Actions --- */
    const occupe = async (fn) => {
      if (c.busy) return;
      c.busy = true; [btnCompile, btnUpload].forEach((x) => (x.disabled = true)); sw.classList.add('busy'); modeSw.classList.add('busy');
      if (c.liveReady) drawLive();
      try { await fn(); } catch (e) { log('✗ ' + e.message); } finally { c.busy = false; [btnCompile, btnUpload].forEach((x) => (x.disabled = false)); sw.classList.remove('busy'); modeSw.classList.remove('busy'); refreshBadges(); if (c.liveReady) drawLive(); }
    };
    btnCompile.onclick = () => occupe(async () => { regen(); logBox.textContent = ''; await R.compile(c.robot, c.gen.code, log); });
    btnUpload.onclick = () => occupe(async () => {
      regen(); logBox.textContent = '';
      const k = c.robot, codeK = c.gen.code;
      const ok = await R.upload(k, codeK, { log });
      if (ok) { uploaded[k] = codeK; dirty = true; persist(); if (k === 'mbot') log('✓ Le programme est dans le mBot : il démarre tout seul (débranche le câble pour le laisser rouler).'); }
      drawCible();
    });
    btnExport.onclick = () => { regen(); const rb = R.ROBOTS[c.robot]; TL.saveAs(rb.lang === 'cpp' ? 'mbot.ino' : 'main.py', c.gen.code, rb.lang === 'cpp' ? 'text/x-c++src' : 'text/x-python'); };

    /* --- Mode direct --- */
    let lastHi = null;
    const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
    function setMode(m, init) {
      if (!init && m === c.mode) return;
      if (c.run) stopRun();
      c.mode = m;
      try { localStorage.setItem(MKEY, m); } catch (e) { /* rien */ }
      btnModeUp.classList.toggle('on', m === 'upload'); btnModeUp.setAttribute('aria-checked', String(m === 'upload'));
      btnModeLive.classList.toggle('on', m === 'live'); btnModeLive.setAttribute('aria-checked', String(m === 'live'));
      bar.hidden = m === 'live'; liveBox.hidden = m !== 'live';
      if (!init) statut.hidden = true;
      inner.querySelector('.rbt-main').classList.toggle('is-live', m === 'live');
      drawCible();
    }
    const capt = {};
    function drawLive() {
      if (c.mode !== 'live') return;
      const rb = R.ROBOTS[c.robot], L = R.live[c.robot], etat = L ? L.etat : 'aucun';
      liveBox.innerHTML = '';
      const ligne = (cls, txt, ...btns) => h('div.rbt-live-etat' + cls, h('span', txt), ...btns);
      const lien = (txt, fn, titre) => h('button.rbt-link', { type: 'button', title: titre || '', onclick: fn }, txt);
      if (etat === 'ok') liveBox.append(ligne('.ok', '🟢 ' + rb.name + ' connecté en direct.', lien('déconnecter', () => { stopRun(); R.disconnect(c.robot); })));
      else if (etat === 'connexion') liveBox.append(ligne('', '⏳ Connexion au ' + rb.name + '…'));
      else if (etat === 'sans-programme') liveBox.append(ligne('.warn', '🟠 Le ' + rb.name + ' ne répond pas : il n’a pas encore le programme du mode direct (ou ce n’est pas le bon port).', lien('autre port', () => connecter(true))));
      else liveBox.append(ligne('', '⚪ ' + rb.name + ' pas connecté : branche le câble puis « Connecter ».'));
      const btnCo = h('button.rbt-act', { type: 'button', disabled: c.busy || etat === 'connexion', onclick: () => connecter(false) }, '🔌 Connecter');
      const btnRun = h('button.rbt-act.go', { type: 'button', title: 'Lancer le programme sur le robot', onclick: () => lancer() }, '▶ Lancer');
      const btnStop = h('button.rbt-act.stop', { type: 'button', title: 'Tout arrêter', 'aria-label': 'Arrêter', onclick: () => stopRun() }, '■');
      btnRun.disabled = etat !== 'ok' || c.busy; btnStop.disabled = etat !== 'ok';
      if (c.run) { btnRun.textContent = '↻ Relancer'; }
      liveBox.append(h('div.rbt-actions', etat === 'ok' ? null : btnCo, btnRun, btnStop));
      const g = h('div.rbt-sensors.rbt-adv');
      const cell = (k, label) => { capt[k] = h('b', '—'); g.append(h('div.rbt-sensor', h('span', label), capt[k])); };
      cell('distance', 'Distance'); cell('ligneG', 'Ligne gauche'); cell('ligneD', 'Ligne droite'); cell('lumiere', 'Lumière');
      cell('boutonA', c.robot === 'maqueen' ? 'Bouton A' : 'Bouton'); if (c.robot === 'maqueen') cell('boutonB', 'Bouton B');
      liveBox.append(g);
      const installer = h('button.rbt-link', { type: 'button', onclick: () => installerDirect() }, 'Installer le mode direct dans le ' + rb.name);
      liveBox.append(h('p.small.muted.rbt-live-aide' + (etat === 'ok' ? '.rbt-adv' : ''), etat === 'sans-programme' ? h('b', '→ ') : null, installer,
        c.robot === 'mbot' ? ' (une fois : il remplace le programme du robot).' : ' (une fois : fichier à enregistrer sur MICROBIT).',
        ' Le programme tourne dans l’ordinateur : le robot doit rester branché.'));
      majCapteurs();
    }
    function majCapteurs() {
      if (c.mode !== 'live' || !capt.distance) return;
      const L = R.live[c.robot], cp = L && L.etat === 'ok' && L.capteurs, frais = cp && Date.now() - L.vu < 1500;
      const oui = (v) => (v ? 'noir' : 'blanc');
      const set = (k, v) => { if (capt[k] && capt[k].textContent !== v) capt[k].textContent = v; };
      set('distance', frais ? (cp.distance >= 400 ? 'rien' : fmt(cp.distance) + ' cm') : '—');
      set('ligneG', frais ? oui(cp.ligneG) : '—'); set('ligneD', frais ? oui(cp.ligneD) : '—');
      set('lumiere', frais ? cp.lumiere + ' %' : '—');
      set('boutonA', frais ? (cp.boutonA ? 'appuyé' : '—') : '—'); set('boutonB', frais ? (cp.boutonB ? 'appuyé' : '—') : '—');
    }
    c.sens = setInterval(majCapteurs, 120);
    async function connecter(forcer) {
      if (c.busy) return;
      const k = c.robot;
      log('Connexion au ' + R.ROBOTS[k].long + ' par le câble USB…');
      try {
        const L = await R.connect(k, forcer);
        log(L.etat === 'ok' ? '✓ Connecté : le ' + R.ROBOTS[k].name + ' obéit en direct. Clique sur ▶ Lancer.' : '✗ Le robot ne répond pas. Installe d’abord le mode direct (lien sous les capteurs), une seule fois.');
      } catch (e) { log(e.name === 'NotFoundError' ? 'Aucun port choisi.' : '✗ ' + e.message); }
    }
    function installerDirect() {
      const k = c.robot;
      occupe(async () => {
        if (c.run) stopRun();
        logBox.textContent = '';
        log('Installation du mode direct dans le ' + R.ROBOTS[k].long + '…');
        const ok = await R.upload(k, R.firmware(k), { log, cle: k + '-direct', nom: 'maqueen-mode-direct.hex' });
        if (!ok) return;
        if (k === 'mbot') { log('Connexion…'); try { const L = await R.connect('mbot'); log(L.etat === 'ok' ? '✓ Mode direct prêt : clique sur ▶ Lancer.' : '✗ Le mBot ne répond pas : recommence la connexion.'); } catch (e) { log('✗ ' + e.message); } }
        else log('Attends que la LED de la micro:bit arrête de clignoter : la lettre D s’affiche. Clique alors sur « Connecter ».');
      });
    }
    function lancer() {
      const k = c.robot, L = R.live[k];
      if (!L || L.etat !== 'ok') return;
      if (c.run) stopRun(true);
      regen();
      const run = new R.Direct(save(), k, {
        send: (l) => L.ecrire(l), capteurs: () => L.capteurs, now: () => performance.now(), log,
        highlight: (id) => { if (id !== lastHi) { lastHi = id; try { ws.highlightBlock(id); } catch (e) { /* bloc supprimé */ } } },
      });
      if (!run.start) { log('⚠ Ajoute le bloc « quand le robot démarre » et accroche ton programme dessous.'); return; }
      L.ecrire('S');
      c.run = run;
      essaye[k] = c.gen.code; dirty = true; persist();
      log('▶ Le programme tourne dans l’ordinateur : le ' + R.ROBOTS[k].name + ' obéit en direct.');
      c.tick = setInterval(() => {
        if (c.run !== run) return;
        if (R.live[k] !== L || L.etat !== 'ok') { log('✗ Connexion perdue avec le ' + R.ROBOTS[k].name + '.'); stopRun(); return; }
        run.step();
        if (run.error) { log('✗ ' + run.error); stopRun(); }
        else if (run.done) { clearInterval(c.tick); c.tick = null; c.run = null; log('✓ Programme terminé (le robot garde ses derniers ordres : ■ pour tout arrêter).'); drawLive(); }
      }, 20);
      drawLive(); refreshBadges();
    }
    function stopRun(silencieux) {
      clearInterval(c.tick); c.tick = null;
      const run = c.run; c.run = null;
      const L = R.live[run ? run.robot : c.robot];
      if (L && L.etat === 'ok') L.ecrire('S');
      lastHi = null; try { ws.highlightBlock(null); } catch (e) { /* rien */ }
      if (run && !silencieux) log('■ Arrêté.');
      drawLive();
    }
    const offLive = R.onLive(() => { drawLive(); refreshBadges(); });
    c.stopAll = () => { if (c.run) stopRun(true); clearInterval(c.sens); offLive(); };
    c.liveReady = true;
    setMode(c.mode, true);

    // la feuille a changé (autre atelier, autre page) : on replie
    c.watch = setInterval(() => { if (P.cur === c && !document.querySelector(`.rbt-card[data-rb="${CSS.escape(b.id)}"]`)) R.close(); }, 1000);
  }

  function refreshCards() { TL.$$('.rbt-card').forEach((x) => x.refresh && x.refresh()); }

  /* ================= Activité « robot » dans une feuille ================= */
  TL.activities.robot = {
    label: 'Programmer un robot (mBot, Maqueen)', icon: '🤖', graded: true,
    render(b, ctx) {
      const state = h('span.mbk-state');
      const btn = h('button.btn.primary.mbk-open-btn', { type: 'button' });
      const noms = robotsOf(b).map((k) => R.ROBOTS[k].name).join(' ou ');
      const card = h('div.mbk-card.rbt-card', { dataset: { rb: b.id } },
        h('div.mbk-card-ico.rbt-card-ico', { 'aria-hidden': 'true' }, robotsOf(b).map((k) => R.img(k))),
        h('div.mbk-card-txt', h('b', 'Programmer le robot (' + noms + ')'), h('span.small.muted', 'Programme en blocs, puis envoie-le dans le robot. On peut changer de robot à tout moment.'), state),
        btn);
      card.refresh = () => {
        const open = P.cur && P.cur.b.id === b.id;
        btn.textContent = open ? '◂ Replier' : 'Programmer ▸';
        card.classList.toggle('on', !!open);
        const v = ctx.answer && ctx.answer.value;
        const n = v && v.workspace ? countBlocks(v.workspace) : 0;
        const up = v && v.uploaded ? Object.keys(v.uploaded).filter((k) => R.ROBOTS[k]).map((k) => R.ROBOTS[k].name) : [];
        state.textContent = (n ? n + ' bloc' + (n > 1 ? 's' : '') : 'Programme pas encore commencé') + (v && v.robot && R.ROBOTS[v.robot] ? ' · ' + R.ROBOTS[v.robot].name : '') + (up.length ? ' · téléversé : ' + up.join(', ') : '');
      };
      btn.onclick = () => (P.cur && P.cur.b.id === b.id ? R.close() : R.open(b, ctx));
      card.refresh();
      return card;
    },
  };
})();
