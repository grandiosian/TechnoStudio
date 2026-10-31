/* TechnoStudio — atelier Code : programmation Blockly de cartes (Arduino Uno/Nano, ESP32,
   micro:bit), génération C++ (Arduino) ou MicroPython, téléversement :
     • C++ : compilation sur le serveur de compilation, puis écriture dans la carte par le
       navigateur (Web Serial : STK500 pour Uno/Nano, esptool pour ESP32) — voir flash.js ;
     • MicroPython : main.py envoyé directement par le câble USB (Web Serial) ;
     • ou par le pont local d'un poste équipé (pont/pont.js → arduino-cli, mpremote) ;
     • ou en exportant le fichier .ino / .py. */
(function () {
  'use strict';
  const TL = window.TL;
  const { h } = TL;
  const C = (TL.code = {});

  /* ================= Cartes ================= */
  const D = (n) => [...Array(n).keys()];
  C.BOARDS = {
    uno: { name: 'Arduino Uno', lang: 'cpp', fqbn: 'arduino:avr:uno', digital: D(14).map(String), analog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'], pwm: ['3', '5', '6', '9', '10', '11'], led: '13', servoLib: 'Servo.h', adcMax: 1023 },
    nano: { name: 'Arduino Nano', lang: 'cpp', fqbn: 'arduino:avr:nano', digital: D(14).map(String), analog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'], pwm: ['3', '5', '6', '9', '10', '11'], led: '13', servoLib: 'Servo.h', adcMax: 1023 },
    esp32: { name: 'ESP32 (Arduino C++)', lang: 'cpp', fqbn: 'esp32:esp32:esp32', digital: ['2', '4', '5', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23', '25', '26', '27', '32', '33'], analog: ['32', '33', '34', '35', '36', '39'], pwm: ['2', '4', '5', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23', '25', '26', '27', '32', '33'], led: '2', servoLib: 'ESP32Servo.h', adcMax: 4095 },
    'esp32-mpy': { name: 'ESP32 (MicroPython)', lang: 'mpy', digital: ['2', '4', '5', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23', '25', '26', '27', '32', '33'], analog: ['32', '33', '34', '35', '36', '39'], pwm: ['2', '4', '5', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23', '25', '26', '27', '32', '33'], led: '2', adcMax: 1023 },
    microbit: { name: 'micro:bit (MicroPython)', lang: 'mpy', mb: true, digital: ['0', '1', '2', '8', '12', '13', '14', '15', '16'], analog: ['0', '1', '2'], pwm: ['0', '1', '2', '8', '12', '13', '14', '15', '16'], led: null, adcMax: 1023 },
  };
  C.board = 'uno';
  const B = () => C.BOARDS[C.board] || C.BOARDS.uno;
  const pinOpts = (kind) => () => (B()[kind] || B().digital).map((p) => [B().mb ? 'P' + p : p, p]);

  /* ================= Chargement de Blockly ================= */
  let loading = null;
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  C.load = function () {
    if (window.Blockly && window.Blockly.Python && C.ready) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      if (window.Blockly && window.Blockly.Python) { C.media = window.TL_BLOCKLY_MEDIA || null; defineBlocks(); defineCpp(); defineMpy(); C.ready = true; return; }
      const files = ['blockly_compressed.js', 'blocks_compressed.js', 'python_compressed.js', 'fr.js'];
      const bases = [(window.TL_VENDOR || 'vendor/') + 'blockly/', 'https://unpkg.com/blockly@10.4.3/'];
      let ok = false;
      for (const base of bases) {
        try {
          for (const f of files) await loadScript(base + (f === 'fr.js' && base.includes('unpkg') ? 'msg/fr.js' : f));
          if (window.Blockly && window.Blockly.Python) { C.media = base.includes('unpkg') ? null : base + 'media/'; ok = true; break; }
        } catch (e) { /* source suivante */ }
      }
      if (!ok) throw new Error('Blockly n’a pas pu être chargé.');
      defineBlocks(); defineCpp(); defineMpy();
      C.ready = true;
    })();
    return loading;
  };

  /* ================= Blocs personnalisés ================= */
  const COL = { io: 200, sensor: 160, act: 20, time: 120, serial: 290, mb: 330, struct: 45 };
  function defineBlocks() {
    const Bl = window.Blockly;
    const J = (type, json) => { Bl.Blocks[type] = { init() { this.jsonInit(json); } }; };
    Bl.Blocks.tl_program = { init() {
      this.appendDummyInput().appendField('au démarrage');
      this.appendStatementInput('SETUP');
      this.appendDummyInput().appendField('répéter indéfiniment');
      this.appendStatementInput('LOOP');
      this.setColour(COL.struct); this.setDeletable(false); this.setTooltip('Structure du programme : ce qui se fait une fois, puis en boucle.');
    } };
    const pin = (kind) => ({ type: 'field_dropdown', name: 'PIN', options: pinOpts(kind) });
    J('tl_digital_write', { message0: 'mettre la broche %1 à %2', args0: [pin('digital'), { type: 'field_dropdown', name: 'STATE', options: [['HAUT', '1'], ['BAS', '0']] }], previousStatement: null, nextStatement: null, colour: COL.io, tooltip: 'Sortie numérique : allume (HAUT) ou éteint (BAS).' });
    J('tl_digital_read', { message0: 'broche %1 est à l’état haut', args0: [pin('digital')], output: 'Boolean', colour: COL.io, tooltip: 'Entrée numérique (bouton, capteur tout ou rien).' });
    J('tl_analog_read', { message0: 'valeur analogique broche %1', args0: [pin('analog')], output: 'Number', colour: COL.sensor, tooltip: 'Mesure de 0 à 1023 (capteur de lumière, potentiomètre…).' });
    J('tl_pwm_write', { message0: 'MLI broche %1 valeur %2', args0: [pin('pwm'), { type: 'input_value', name: 'VALUE', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: COL.io, tooltip: 'Sortie MLI (PWM) de 0 à 255 : vitesse d’un moteur, intensité d’une DEL.' });
    J('tl_led_builtin', { message0: 'DEL intégrée %1', args0: [{ type: 'field_dropdown', name: 'STATE', options: [['allumée', '1'], ['éteinte', '0']] }], previousStatement: null, nextStatement: null, colour: COL.io });
    J('tl_delay', { message0: 'attendre %1 ms', args0: [{ type: 'input_value', name: 'MS', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: COL.time });
    J('tl_millis', { message0: 'temps écoulé (ms)', output: 'Number', colour: COL.time });
    J('tl_serial_print', { message0: 'écrire sur le port série %1', args0: [{ type: 'input_value', name: 'TEXT' }], previousStatement: null, nextStatement: null, colour: COL.serial, tooltip: 'Affiche dans le moniteur série (115200 bauds).' });
    J('tl_servo', { message0: 'servomoteur broche %1 angle %2 °', args0: [pin('pwm'), { type: 'input_value', name: 'ANGLE', check: 'Number' }], inputsInline: true, previousStatement: null, nextStatement: null, colour: COL.act });
    J('tl_tone', { message0: 'son de %1 Hz pendant %2 ms broche %3', args0: [{ type: 'input_value', name: 'FREQ', check: 'Number' }, { type: 'input_value', name: 'DUR', check: 'Number' }, pin('pwm')], inputsInline: true, previousStatement: null, nextStatement: null, colour: COL.act });
    J('tl_ultrason', { message0: 'distance (cm) déclenche %1 écho %2', args0: [{ type: 'field_dropdown', name: 'TRIG', options: pinOpts('digital') }, { type: 'field_dropdown', name: 'ECHO', options: pinOpts('digital') }], output: 'Number', colour: COL.sensor, tooltip: 'Capteur à ultrasons HC-SR04.' });
    J('tl_map', { message0: 'convertir %1 de 0–%2 vers 0–%3', args0: [{ type: 'input_value', name: 'V', check: 'Number' }, { type: 'field_number', name: 'A', value: 1023 }, { type: 'field_number', name: 'B', value: 255 }], inputsInline: true, output: 'Number', colour: 230 });
    // micro:bit
    J('tl_mb_scroll', { message0: 'faire défiler %1', args0: [{ type: 'input_value', name: 'TEXT' }], previousStatement: null, nextStatement: null, colour: COL.mb });
    J('tl_mb_icon', { message0: 'afficher l’icône %1', args0: [{ type: 'field_dropdown', name: 'ICON', options: [['cœur', 'HEART'], ['content', 'HAPPY'], ['triste', 'SAD'], ['oui', 'YES'], ['non', 'NO'], ['flèche haut', 'ARROW_N'], ['flèche bas', 'ARROW_S'], ['carré', 'SQUARE'], ['diamant', 'DIAMOND']] }], previousStatement: null, nextStatement: null, colour: COL.mb });
    J('tl_mb_clear', { message0: 'effacer l’écran', previousStatement: null, nextStatement: null, colour: COL.mb });
    J('tl_mb_button', { message0: 'bouton %1 appuyé', args0: [{ type: 'field_dropdown', name: 'BTN', options: [['A', 'a'], ['B', 'b']] }], output: 'Boolean', colour: COL.mb });
    J('tl_mb_accel', { message0: 'accélération %1', args0: [{ type: 'field_dropdown', name: 'AXIS', options: [['x', 'x'], ['y', 'y'], ['z', 'z']] }], output: 'Number', colour: COL.mb });
    J('tl_mb_temp', { message0: 'température (°C)', output: 'Number', colour: COL.mb });
    J('tl_mb_light', { message0: 'niveau de lumière', output: 'Number', colour: COL.mb });
  }

  C.toolbox = function (board) {
    const mb = C.BOARDS[board].mb;
    const num = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
    const cat = (name, colour, contents) => ({ kind: 'category', name, colour: String(colour), contents });
    const b = (type, inputs) => Object.assign({ kind: 'block', type }, inputs ? { inputs } : {});
    return { kind: 'categoryToolbox', contents: [
      cat('Structure', COL.struct, [b('tl_program'), b('tl_delay', { MS: num(1000) }), b('tl_millis')]),
      cat('Logique', 210, [b('controls_if'), b('logic_compare'), b('logic_operation'), b('logic_negate'), b('logic_boolean')]),
      cat('Boucles', 120, [b('controls_repeat_ext', { TIMES: num(3) }), b('controls_whileUntil')]),
      cat('Maths', 230, [b('math_number'), b('math_arithmetic'), b('math_random_int', { FROM: num(1), TO: num(6) }), b('tl_map', { V: num(512) })]),
      { kind: 'category', name: 'Variables', colour: '330', custom: 'VARIABLE' },
      cat('Entrées / sorties', COL.io, [b('tl_digital_write'), b('tl_digital_read'), b('tl_pwm_write', { VALUE: num(128) })].concat(C.BOARDS[board].led ? [b('tl_led_builtin')] : [])),
      cat('Capteurs', COL.sensor, [b('tl_analog_read'), b('tl_ultrason')].concat(mb ? [b('tl_mb_temp'), b('tl_mb_light'), b('tl_mb_accel')] : [])),
      cat('Actionneurs', COL.act, [b('tl_servo', { ANGLE: num(90) }), b('tl_tone', { FREQ: num(440), DUR: num(200) })]),
      cat('Communication', COL.serial, [b('tl_serial_print', { TEXT: { shadow: { type: 'text', fields: { TEXT: 'Bonjour' } } } }), b('text')]),
    ].concat(mb ? [cat('micro:bit', COL.mb, [b('tl_mb_scroll', { TEXT: { shadow: { type: 'text', fields: { TEXT: 'Bonjour' } } } }), b('tl_mb_icon'), b('tl_mb_clear'), b('tl_mb_button')])] : []) };
  };

  /* ================= Générateur Arduino (C++) ================= */
  const O = { ATOMIC: 0, UNARY: 2, MUL: 3, ADD: 4, REL: 6, EQ: 7, AND: 11, OR: 12, NONE: 99 };
  function defineCpp() {
    const Bl = window.Blockly;
    const g = (C.cpp = new Bl.CodeGenerator('Arduino'));
    g.INDENT = '  ';
    g.addReservedWords('setup,loop,int,long,float,double,char,bool,void,if,else,while,for,return,HIGH,LOW,INPUT,OUTPUT,Serial,delay,millis');
    g.init = function (ws) {
      this.includes = {}; this.globals = {}; this.setups = {}; this.funcs = {};
      if (!this.nameDB_) this.nameDB_ = new Bl.Names(this.RESERVED_WORDS_); else this.nameDB_.reset();
      this.nameDB_.setVariableMap(ws.getVariableMap());
      this.nameDB_.populateVariables(ws);
      ws.getAllVariables().forEach((v) => { this.globals['var_' + v.name] = 'long ' + this.nameDB_.getName(v.getId(), Bl.Names.NameType.VARIABLE) + ' = 0;'; });
    };
    g.scrub_ = function (block, code, thisOnly) { const next = block.nextConnection && block.nextConnection.targetBlock(); return code + (next && !thisOnly ? this.blockToCode(next) : ''); };
    g.scrubNakedValue = (line) => line + ';\n';
    g.finish = function (code) { return code; };
    const val = (b, n, o, d) => g.valueToCode(b, n, o) || (d == null ? '0' : d);
    const st = (b, n) => g.statementToCode(b, n);
    const v = (b, f) => g.nameDB_.getName(b.getFieldValue(f), Bl.Names.NameType.VARIABLE);
    const F = g.forBlock;
    F.tl_program = (b) => '__SETUP__' + st(b, 'SETUP') + '__LOOP__' + st(b, 'LOOP') + '__END__';
    F.tl_digital_write = (b) => { const p = b.getFieldValue('PIN'); g.setups['pin' + p] = `pinMode(${p}, OUTPUT);`; return `digitalWrite(${p}, ${b.getFieldValue('STATE') === '1' ? 'HIGH' : 'LOW'});\n`; };
    F.tl_digital_read = (b) => { const p = b.getFieldValue('PIN'); g.setups['pinin' + p] = `pinMode(${p}, INPUT);`; return [`(digitalRead(${p}) == HIGH)`, O.EQ]; };
    F.tl_analog_read = (b) => [B().adcMax === 4095 ? `(analogRead(${b.getFieldValue('PIN')}) / 4)` : `analogRead(${b.getFieldValue('PIN')})`, O.ATOMIC];
    F.tl_pwm_write = (b) => { const p = b.getFieldValue('PIN'); g.setups['pin' + p] = `pinMode(${p}, OUTPUT);`; return `analogWrite(${p}, ${val(b, 'VALUE', O.NONE)});\n`; };
    F.tl_led_builtin = (b) => { g.setups.led = 'pinMode(LED_BUILTIN, OUTPUT);'; return `digitalWrite(LED_BUILTIN, ${b.getFieldValue('STATE') === '1' ? 'HIGH' : 'LOW'});\n`; };
    F.tl_delay = (b) => `delay(${val(b, 'MS', O.NONE, '1000')});\n`;
    F.tl_millis = () => ['millis()', O.ATOMIC];
    F.tl_serial_print = (b) => { g.setups.serial = 'Serial.begin(115200);'; return `Serial.println(${val(b, 'TEXT', O.NONE, '""')});\n`; };
    F.tl_servo = (b) => {
      const p = b.getFieldValue('PIN');
      g.includes.servo = '#include <' + (B().servoLib || 'Servo.h') + '>';
      g.globals['servo' + p] = `Servo servo_${p};`; g.setups['servo' + p] = `servo_${p}.attach(${p});`;
      return `servo_${p}.write(${val(b, 'ANGLE', O.NONE, '90')});\n`;
    };
    F.tl_tone = (b) => { const p = b.getFieldValue('PIN'); return `tone(${p}, ${val(b, 'FREQ', O.NONE, '440')}, ${val(b, 'DUR', O.NONE, '200')});\ndelay(${val(b, 'DUR', O.NONE, '200')});\n`; };
    F.tl_ultrason = (b) => {
      const t = b.getFieldValue('TRIG'), e = b.getFieldValue('ECHO');
      g.funcs.ultra = 'long distanceCm(int trig, int echo) {\n  pinMode(trig, OUTPUT); pinMode(echo, INPUT);\n  digitalWrite(trig, LOW); delayMicroseconds(2);\n  digitalWrite(trig, HIGH); delayMicroseconds(10);\n  digitalWrite(trig, LOW);\n  long d = pulseIn(echo, HIGH, 30000);\n  return d / 58;\n}';
      return [`distanceCm(${t}, ${e})`, O.ATOMIC];
    };
    F.tl_map = (b) => [`map(${val(b, 'V', O.NONE)}, 0, ${b.getFieldValue('A')}, 0, ${b.getFieldValue('B')})`, O.ATOMIC];
    ['tl_mb_scroll', 'tl_mb_icon', 'tl_mb_clear'].forEach((t) => (F[t] = () => '// (bloc micro:bit ignoré sur cette carte)\n'));
    ['tl_mb_button', 'tl_mb_accel', 'tl_mb_temp', 'tl_mb_light'].forEach((t) => (F[t] = () => ['0', O.ATOMIC]));
    // blocs standard
    F.math_number = (b) => [String(b.getFieldValue('NUM')), O.ATOMIC];
    F.text = (b) => [JSON.stringify(b.getFieldValue('TEXT')), O.ATOMIC];
    F.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];
    F.logic_negate = (b) => ['!' + val(b, 'BOOL', O.UNARY, 'true'), O.UNARY];
    F.logic_compare = (b) => { const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')]; const o = /[<>]/.test(op) ? O.REL : O.EQ; return [val(b, 'A', o) + ' ' + op + ' ' + val(b, 'B', o), o]; };
    F.logic_operation = (b) => { const and = b.getFieldValue('OP') === 'AND'; const o = and ? O.AND : O.OR; return [val(b, 'A', o, 'false') + (and ? ' && ' : ' || ') + val(b, 'B', o, 'false'), o]; };
    F.math_arithmetic = (b) => { const m = { ADD: [' + ', O.ADD], MINUS: [' - ', O.ADD], MULTIPLY: [' * ', O.MUL], DIVIDE: [' / ', O.MUL] }[b.getFieldValue('OP')]; if (!m) return [`pow(${val(b, 'A', O.NONE)}, ${val(b, 'B', O.NONE)})`, O.ATOMIC]; return [val(b, 'A', m[1]) + m[0] + val(b, 'B', m[1]), m[1]]; };
    F.math_random_int = (b) => [`random(${val(b, 'FROM', O.NONE)}, ${val(b, 'TO', O.ADD)} + 1)`, O.ATOMIC];
    F.controls_if = (b) => {
      let code = '', n = 0;
      do { code += (n ? ' else if (' : 'if (') + val(b, 'IF' + n, O.NONE, 'false') + ') {\n' + st(b, 'DO' + n) + '}'; n++; } while (b.getInput('IF' + n));
      if (b.getInput('ELSE')) code += ' else {\n' + st(b, 'ELSE') + '}';
      return code + '\n';
    };
    F.controls_repeat_ext = (b) => { const i = g.nameDB_.getDistinctName('i', Bl.Names.NameType.VARIABLE); return `for (int ${i} = 0; ${i} < ${val(b, 'TIMES', O.REL, '0')}; ${i}++) {\n${st(b, 'DO')}}\n`; };
    F.controls_whileUntil = (b) => { let c = val(b, 'BOOL', O.NONE, 'false'); if (b.getFieldValue('MODE') === 'UNTIL') c = '!(' + c + ')'; return `while (${c}) {\n${st(b, 'DO')}}\n`; };
    F.variables_get = (b) => [v(b, 'VAR'), O.ATOMIC];
    F.variables_set = (b) => `${v(b, 'VAR')} = ${val(b, 'VALUE', O.NONE)};\n`;
    F.math_change = (b) => `${v(b, 'VAR')} = ${v(b, 'VAR')} + ${val(b, 'DELTA', O.ADD, '1')};\n`;
  }

  /* ================= Générateur MicroPython ================= */
  function defineMpy() {
    const Bl = window.Blockly;
    const P = Bl.Python;
    const PO = window.python.Order;
    const val = (b, n, d) => P.valueToCode(b, n, PO.NONE) || (d == null ? '0' : d);
    const mb = () => !!B().mb;
    const imp = (k, line) => { P.definitions_['import_' + k] = line; };
    const pinObj = (p, mode) => {
      if (mb()) return 'pin' + p;
      imp('machine', 'from machine import Pin, ADC, PWM, time_pulse_us');
      const name = 'p' + p + (mode === 'out' ? '' : mode);
      const init = mode === 'out' ? `Pin(${p}, Pin.OUT)` : mode === 'in' ? `Pin(${p}, Pin.IN)` : mode === 'adc' ? `ADC(Pin(${p}))` : mode === 'pwm' ? `PWM(Pin(${p}), freq=1000)` : `PWM(Pin(${p}), freq=50)`;
      if (mode === 'adc') P.definitions_['atten' + p] = `${name} = ${init}\n${name}.atten(ADC.ATTN_11DB)`; else P.definitions_['pin_' + name] = `${name} = ${init}`;
      return name;
    };
    const sleep = (ms) => { if (mb()) return `sleep(${ms})`; imp('time', 'import time'); return `time.sleep_ms(int(${ms}))`; };
    const F = P.forBlock;
    F.tl_program = (b) => {
      if (mb()) imp('microbit', 'from microbit import *');
      let setup = P.statementToCode(b, 'SETUP').replace(/^ {2}/gm, '');
      let loop = P.statementToCode(b, 'LOOP');
      return setup + 'while True:\n' + (loop || P.INDENT + 'pass\n');
    };
    F.tl_digital_write = (b) => (mb() ? `pin${b.getFieldValue('PIN')}.write_digital(${b.getFieldValue('STATE')})\n` : `${pinObj(b.getFieldValue('PIN'), 'out')}.value(${b.getFieldValue('STATE')})\n`);
    F.tl_digital_read = (b) => [mb() ? `(pin${b.getFieldValue('PIN')}.read_digital() == 1)` : `(${pinObj(b.getFieldValue('PIN'), 'in')}.value() == 1)`, PO.RELATIONAL];
    F.tl_analog_read = (b) => [mb() ? `pin${b.getFieldValue('PIN')}.read_analog()` : `(${pinObj(b.getFieldValue('PIN'), 'adc')}.read_u16() >> 6)`, PO.FUNCTION_CALL];
    F.tl_pwm_write = (b) => (mb() ? `pin${b.getFieldValue('PIN')}.write_analog(int(${val(b, 'VALUE')}) * 4)\n` : `${pinObj(b.getFieldValue('PIN'), 'pwm')}.duty(int(${val(b, 'VALUE')}) * 4)\n`);
    F.tl_led_builtin = (b) => (mb() ? '' : `${pinObj(B().led, 'out')}.value(${b.getFieldValue('STATE')})\n`);
    F.tl_delay = (b) => sleep(val(b, 'MS', '1000')) + '\n';
    F.tl_millis = () => { if (mb()) return ['running_time()', PO.FUNCTION_CALL]; imp('time', 'import time'); return ['time.ticks_ms()', PO.FUNCTION_CALL]; };
    F.tl_serial_print = (b) => `print(${val(b, 'TEXT', '""')})\n`;
    F.tl_servo = (b) => {
      const p = b.getFieldValue('PIN'), a = val(b, 'ANGLE', '90');
      if (mb()) { P.definitions_['servo' + p] = `pin${p}.set_analog_period(20)`; return `pin${p}.write_analog(int(26 + (${a}) * 102 / 180))\n`; }
      return `${pinObj(p, 'servo')}.duty_u16(int(1638 + (${a}) * 6553 / 180))\n`;
    };
    F.tl_tone = (b) => {
      const f = val(b, 'FREQ', '440'), d = val(b, 'DUR', '200'), p = b.getFieldValue('PIN');
      if (mb()) { imp('music', 'import music'); return `music.pitch(int(${f}), int(${d}), pin${p})\n`; }
      const o = pinObj(p, 'pwm');
      return `${o}.freq(int(${f}))\n${o}.duty(512)\n${sleep(d)}\n${o}.duty(0)\n`;
    };
    F.tl_ultrason = (b) => {
      const t = b.getFieldValue('TRIG'), e = b.getFieldValue('ECHO');
      if (mb()) {
        imp('machine', 'from machine import time_pulse_us'); imp('utime', 'import utime');
        P.definitions_.ultra = 'def distance_cm(trig, echo):\n    trig.write_digital(0)\n    utime.sleep_us(2)\n    trig.write_digital(1)\n    utime.sleep_us(10)\n    trig.write_digital(0)\n    echo.read_digital()\n    d = time_pulse_us(echo, 1, 30000)\n    return max(0, d) // 58';
        return [`distance_cm(pin${t}, pin${e})`, PO.FUNCTION_CALL];
      }
      imp('machine', 'from machine import Pin, ADC, PWM, time_pulse_us'); imp('time', 'import time');
      P.definitions_.ultra = 'def distance_cm(trig, echo):\n    t = Pin(trig, Pin.OUT)\n    e = Pin(echo, Pin.IN)\n    t.value(0)\n    time.sleep_us(2)\n    t.value(1)\n    time.sleep_us(10)\n    t.value(0)\n    d = time_pulse_us(e, 1, 30000)\n    return max(0, d) // 58';
      return [`distance_cm(${t}, ${e})`, PO.FUNCTION_CALL];
    };
    F.tl_map = (b) => [`int((${val(b, 'V')}) * ${b.getFieldValue('B')} / ${b.getFieldValue('A')})`, PO.FUNCTION_CALL];
    F.tl_mb_scroll = (b) => (mb() ? `display.scroll(str(${val(b, 'TEXT', '""')}))\n` : `print(${val(b, 'TEXT', '""')})\n`);
    F.tl_mb_icon = (b) => (mb() ? `display.show(Image.${b.getFieldValue('ICON')})\n` : '');
    F.tl_mb_clear = () => (mb() ? 'display.clear()\n' : '');
    F.tl_mb_button = (b) => [mb() ? `button_${b.getFieldValue('BTN')}.is_pressed()` : 'False', PO.FUNCTION_CALL];
    F.tl_mb_accel = (b) => [mb() ? `accelerometer.get_${b.getFieldValue('AXIS')}()` : '0', PO.FUNCTION_CALL];
    F.tl_mb_temp = () => [mb() ? 'temperature()' : '0', PO.FUNCTION_CALL];
    F.tl_mb_light = () => [mb() ? 'display.read_light_level()' : '0', PO.FUNCTION_CALL];
  }

  /* ================= Génération ================= */
  C.generate = function (ws, board) {
    const old = C.board; C.board = board || C.board;
    try {
      if (B().lang === 'cpp') {
        const g = C.cpp;
        g.init(ws);
        const tops = ws.getTopBlocks(true);
        const prog = tops.find((b) => b.type === 'tl_program');
        let body = prog ? g.blockToCode(prog) : '__SETUP____LOOP____END__';
        // blocs isolés : ignorés (comme dans l'IDE Arduino par blocs)
        const m = body.match(/__SETUP__([\s\S]*)__LOOP__([\s\S]*)__END__/) || [, '', ''];
        const ind = (s) => s.split('\n').map((l) => (l.trim() ? '  ' + l.replace(/^ {2}/, '') : l)).join('\n');
        const out = [
          '// Programme généré par TechnoStudio — ' + B().name,
          ...Object.values(g.includes), Object.keys(g.includes).length ? '' : null,
          ...Object.values(g.globals), Object.keys(g.globals).length ? '' : null,
          ...Object.values(g.funcs).map((f) => f + '\n'),
          'void setup() {', ...Object.values(g.setups).map((s) => '  ' + s), ind(m[1]).replace(/\s+$/, '') || null, '}', '',
          'void loop() {', ind(m[2]).replace(/\s+$/, ''), '}', '',
        ].filter((x) => x != null);
        return out.join('\n').replace(/\n{3,}/g, '\n\n');
      }
      const P = window.Blockly.Python;
      P.init(ws);
      const prog = ws.getTopBlocks(true).find((b) => b.type === 'tl_program');
      let body = prog ? P.blockToCode(prog) : 'while True:\n    pass\n';
      if (B().mb) P.definitions_.import_microbit = 'from microbit import *';
      const code = P.finish(body);
      return '# Programme généré par TechnoStudio — ' + B().name + '\n' + code.replace(/\n{3,}/g, '\n\n');
    } finally { C.board = old; }
  };

  /* ================= Exemples ================= */
  const prog = (setup, loop) => ({ blocks: { languageVersion: 0, blocks: [{ type: 'tl_program', x: 20, y: 20, inputs: Object.assign({}, setup ? { SETUP: { block: setup } } : {}, loop ? { LOOP: { block: loop } } : {}) }] } });
  const chain = (...bs) => { for (let i = bs.length - 2; i >= 0; i--) bs[i].next = { block: bs[i + 1] }; return bs[0]; };
  const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  C.EXAMPLES = {
    blink: { name: 'Faire clignoter une DEL', boards: ['uno', 'nano', 'esp32', 'esp32-mpy'], ws: () => prog(null, chain({ type: 'tl_digital_write', fields: { PIN: B().digital.includes('13') ? '13' : '2', STATE: '1' } }, { type: 'tl_delay', inputs: { MS: n(500) } }, { type: 'tl_digital_write', fields: { PIN: B().digital.includes('13') ? '13' : '2', STATE: '0' } }, { type: 'tl_delay', inputs: { MS: n(500) } })) },
    barriere: { name: 'Barrière de parking (servo + ultrasons)', boards: ['uno', 'nano', 'esp32', 'esp32-mpy'], ws: () => prog(
      { type: 'tl_servo', fields: { PIN: B().pwm.includes('9') ? '9' : '13' }, inputs: { ANGLE: n(0) } },
      { type: 'controls_if', extraState: { hasElse: true }, inputs: {
        IF0: { block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: { block: { type: 'tl_ultrason', fields: { TRIG: B().digital.includes('7') ? '7' : '5', ECHO: B().digital.includes('8') ? '8' : '18' } } }, B: n(15) } } },
        DO0: { block: chain({ type: 'tl_servo', fields: { PIN: B().pwm.includes('9') ? '9' : '13' }, inputs: { ANGLE: n(90) } }, { type: 'tl_delay', inputs: { MS: n(3000) } }) },
        ELSE: { block: { type: 'tl_servo', fields: { PIN: B().pwm.includes('9') ? '9' : '13' }, inputs: { ANGLE: n(0) } } } } }) },
    thermo: { name: 'micro:bit : thermomètre', boards: ['microbit'], ws: () => prog({ type: 'tl_mb_icon', fields: { ICON: 'HAPPY' } }, chain({ type: 'controls_if', inputs: { IF0: { block: { type: 'tl_mb_button', fields: { BTN: 'a' } } }, DO0: { block: { type: 'tl_mb_scroll', inputs: { TEXT: { block: { type: 'tl_mb_temp' } } } } } } }, { type: 'tl_delay', inputs: { MS: n(100) } })) },
    vide: { name: 'Programme vide', boards: Object.keys(C.BOARDS), ws: () => prog(null, null) },
  };

  /* ================= Pont local (toolchain) ================= */
  const PONT = () => (window.TL_PONT || 'http://127.0.0.1:8765');
  C.pont = {
    status: null,
    async check() {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1500);
        const r = await fetch(PONT() + '/status', { signal: ctl.signal }); clearTimeout(t);
        C.pont.status = await r.json();
      } catch (e) { C.pont.status = null; }
      TL.emit('pont', C.pont.status);
      return C.pont.status;
    },
    async call(path, body) {
      const r = await fetch(PONT() + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({ ok: false, log: 'Réponse illisible du pont.' }));
      if (!r.ok && j.ok == null) j.ok = false;
      return j;
    },
    ports: () => C.pont.call('/ports'),
  };

  /* ================= Web Serial (MicroPython, moniteur) ================= */
  C.serial = {
    port: null, reader: null, writer: null, onData: null, supported: typeof navigator !== 'undefined' && 'serial' in navigator,
    async open(baud) {
      if (!this.supported) throw new Error('Ce navigateur ne gère pas le port série (utilise Chrome ou Edge).');
      if (!this.port) this.port = await navigator.serial.requestPort();
      if (!this.port.readable) await this.port.open({ baudRate: baud || 115200 });
      this.writer = this.port.writable.getWriter();
      this.readLoop();
    },
    async readLoop() {
      const dec = new TextDecoder();
      try {
        this.reader = this.port.readable.getReader();
        for (;;) { const { value, done } = await this.reader.read(); if (done) break; if (this.onData) this.onData(dec.decode(value)); }
      } catch (e) { /* port fermé */ } finally { try { this.reader.releaseLock(); } catch (e) { /* déjà libéré */ } }
    },
    async write(s) { await this.writer.write(new TextEncoder().encode(s)); },
    async close() { try { await this.reader?.cancel(); } catch (e) {} try { this.writer?.releaseLock(); } catch (e) {} try { await this.port?.close(); } catch (e) {} this.reader = this.writer = null; },
    // Écrit main.py par le REPL brut de MicroPython puis redémarre la carte
    async uploadMpy(code, log) {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      if (!this.writer) await this.open(115200);
      log('Interruption du programme en cours…');
      await this.write('\r\x03\x03'); await wait(200);
      await this.write('\x01'); await wait(300); // REPL brut
      const lines = ['f=open("main.py","w")'];
      const chunk = 200;
      for (let i = 0; i < code.length; i += chunk) lines.push('f.write(' + JSON.stringify(code.slice(i, i + chunk)) + ')');
      lines.push('f.close()');
      log('Envoi de main.py (' + code.length + ' caractères)…');
      for (const l of lines) { await this.write(l + '\n'); await wait(25); }
      await this.write('\x04'); await wait(600);
      await this.write('\x02'); await wait(200); // sortie du REPL brut
      await this.write('\x04'); // redémarrage logiciel : main.py s'exécute
      log('Téléversé. La carte redémarre et lance main.py.');
    },
  };

  /* ================= Atelier Code (vue complète) ================= */
  C.view = async function (root, opts) {
    opts = opts || {};
    const wrap = h('div.code-stage', h('div.code-loading', 'Chargement de Blockly…'));
    root.append(wrap);
    try { await C.load(); } catch (e) { wrap.innerHTML = ''; wrap.append(h('div.empty', h('h2', 'Blockly indisponible'), h('p', e.message))); return; }
    let saved = (await TL.db.get('code:projet')) || {};
    const Z = TL.centrale;
    if (Z && Z.connecte()) { // projet libre de l'élève : aussi enregistré sur la Centrale
      try { const d = await window.Centrale.charger('code/projet', null); if (d && d.ws && (d.at || 0) > (saved.at || 0)) saved = d; } catch (e) { /* hors ligne */ }
    }
    C.board = saved.board || C.board;
    wrap.innerHTML = '';
    const div = h('div.blockly-host');
    wrap.append(div);
    const ws = (C.ws = window.Blockly.inject(div, {
      toolbox: C.toolbox(C.board), media: C.media || undefined, trashcan: !!C.media, sounds: false, renderer: 'zelos', theme: window.Blockly.Themes.Classic,
      grid: { spacing: 24, length: 3, colour: '#cfd8ef', snap: true }, zoom: { controls: !!C.media, wheel: true, startScale: 0.85 }, move: { scrollbars: true, drag: true, wheel: false },
    }));
    const load = (state) => { ws.clear(); try { window.Blockly.serialization.workspaces.load(state, ws); } catch (e) { window.Blockly.serialization.workspaces.load(C.EXAMPLES.vide.ws(), ws); } };
    load(saved.ws && saved.board === C.board ? saved.ws : C.EXAMPLES[B().mb ? 'thermo' : 'blink'].ws());
    let manual = null; // code saisi à la main (remplace les blocs)
    const regen = TL.debounce(() => {
      const code = manual != null ? manual : C.generate(ws);
      C.current = { board: C.board, code, lang: B().lang };
      TL.emit('code', C.current);
      const projet = { board: C.board, ws: window.Blockly.serialization.workspaces.save(ws), at: Date.now() };
      TL.db.set('code:projet', projet);
      if (TL.centrale && TL.centrale.connecte()) window.Centrale.sauver('code/projet', projet).catch(() => {});
    }, 250);
    ws.addChangeListener((e) => { if (!e.isUiEvent) regen(); });
    C.setBoard = (b, keep) => {
      const state = window.Blockly.serialization.workspaces.save(ws);
      C.board = b; ws.updateToolbox(C.toolbox(b));
      load(keep ? state : C.EXAMPLES[C.BOARDS[b].mb ? 'thermo' : 'blink'].ws());
      regen();
    };
    C.loadExample = (k) => { load(C.EXAMPLES[k].ws()); regen(); };
    C.setManual = (code) => { manual = code; regen(); };
    regen();
    const ro = new ResizeObserver(() => window.Blockly.svgResize(ws));
    ro.observe(wrap);
    C.pont.check();
    if (TL.flash) TL.flash.verifier();
  };

  // Mode de téléversement conseillé pour une carte
  // micro:bit : fichier .hex fabriqué par le serveur (aucun micrologiciel à installer avant, tout navigateur)
  C.viaDefaut = (board) => (board === 'microbit' ? 'serveur' : C.BOARDS[board] && C.BOARDS[board].lang === 'mpy' ? (C.serial.supported ? 'webserial' : 'pont') : 'serveur');
  /** Carte telle que le serveur de compilation la connaît. */
  C.carteServeur = (board) => (board === 'microbit' ? 'microbit' : C.BOARDS[board] && C.BOARDS[board].lang === 'cpp' ? board : null);
  const pourcent = (log) => { let dernier = -1; return (v) => { const p = Math.floor(v * 10) * 10; if (p !== dernier) { dernier = p; log('… ' + p + ' %'); } }; };

  // Actions communes (panneaux et bloc d'atelier)
  C.actions = {
    async verify(log, via) {
      const cur = C.current; if (!cur) return;
      if (cur.lang !== 'cpp' && !(cur.board === 'microbit' && via === 'serveur')) { log('Code MicroPython : pas de compilation, il est vérifié par la carte au lancement.'); return; }
      if (via === 'pont') {
        if (!(await C.pont.check())) { log('Pont local introuvable : lance pont/demarrer-pont, ou utilise le serveur de compilation.'); return; }
        log('Compilation locale pour ' + C.BOARDS[cur.board].name + '…');
        const r = await C.pont.call('/compile', { board: cur.board, fqbn: C.BOARDS[cur.board].fqbn, code: cur.code });
        log(r.log || ''); log(r.ok ? '✓ Compilation réussie.' : '✗ Erreur de compilation.');
        return r.ok;
      }
      log('Compilation sur le serveur pour ' + C.BOARDS[cur.board].name + '…');
      try {
        const r = await TL.flash.compiler(C.carteServeur(cur.board), cur.code, log);
        if (r.journal) log(r.journal.trim().split('\n').slice(-25).join('\n'));
        log(r.ok ? '✓ Compilation réussie' + (r.format === 'hex' ? ' (' + TL.flash.lireHex(r.hex).length + ' octets).' : '.') : '✗ ' + (r.erreur || 'Erreur de compilation.'));
        return r.ok;
      } catch (e) { log('✗ ' + e.message); return false; }
    },
    /** o : { via: 'serveur'|'pont'|'webserial', port (pont), log, nouveauPort }. À appeler directement depuis un clic. */
    async upload(o) {
      const cur = C.current; if (!cur) return;
      const log = o.log || (() => {});
      const via = o.via || C.viaDefaut(cur.board);
      if (via === 'serveur') {
        const carte = C.carteServeur(cur.board);
        if (!carte) { log('ESP32 en MicroPython : choisis « USB direct ».'); return false; }
        let usb = null;
        if (carte !== 'microbit') { // le port se choisit dans le clic, avant d'attendre le serveur
          try { usb = await TL.flash.choisirPort(o.nouveauPort); } catch (e) { log(e.name === 'NotFoundError' ? 'Aucun port choisi.' : '✗ ' + e.message); return false; }
        }
        try { return await TL.flash.televerser(usb, carte, cur.code, { log, progres: pourcent(log) }); } catch (e) { log('✗ ' + e.message); return false; }
      }
      if (via === 'webserial') {
        if (cur.lang !== 'mpy') { log('Carte Arduino / ESP32 C++ : choisis « Serveur ».'); return false; }
        try { await C.serial.uploadMpy(cur.code, log); return true; } catch (e) { log('✗ ' + e.message); return false; }
      }
      if (!(await C.pont.check())) { log('Pont local introuvable sur ce poste.'); return false; }
      let port = o.port;
      if (!port) { const p = await C.pont.ports(); port = p.ports && p.ports[0] && p.ports[0].address; }
      if (!port) { log('Aucune carte détectée par le pont : branche-la puis actualise.'); return false; }
      log('Téléversement par le pont vers ' + port + '…');
      const r = await C.pont.call('/upload', { board: cur.board, fqbn: C.BOARDS[cur.board].fqbn, code: cur.code, port, lang: cur.lang });
      log(r.log || ''); log(r.ok ? '✓ Téléversé.' : '✗ Échec du téléversement.');
      return r.ok;
    },
    exportFile() {
      const cur = C.current; if (!cur) return;
      if (cur.lang === 'cpp') TL.saveAs('technostudio.ino', cur.code, 'text/x-c++src');
      else TL.saveAs('main.py', cur.code, 'text/x-python');
    },
  };

  /* ================= Bloc « code » dans un atelier ================= */
  TL.activities.code = {
    label: 'Programmer une carte (Blockly)', icon: '⌨', graded: true,
    render(b, ctx) {
      const box = h('div.act');
      const host = h('div.code-inline', h('p.muted', 'Chargement de Blockly…'));
      const pre = h('pre.blk-py.mono', { hidden: true });
      const logBox = h('pre.code-log.mono', { hidden: true });
      const log = (s) => { if (!s) return; logBox.hidden = false; logBox.textContent += s.replace(/\s+$/, '') + '\n'; logBox.scrollTop = 1e9; };
      box.append(h('div.code-inline-bar', h('span.chip.neutral', (C.BOARDS[b.board] || C.BOARDS.uno).name), h('button.btn.small.ghost', { type: 'button', onclick: () => { pre.hidden = !pre.hidden; } }, 'Voir le code')), host, pre, logBox);
      C.load().then(() => {
        host.innerHTML = '';
        const div = h('div.blockly-host.small');
        host.append(div);
        const board = b.board || 'uno';
        const old = C.board; C.board = board;
        const ws = window.Blockly.inject(div, { toolbox: C.toolbox(board), media: C.media || undefined, trashcan: false, sounds: false, renderer: 'zelos', zoom: { wheel: false, startScale: 0.75, controls: false }, move: { scrollbars: true, drag: true, wheel: false }, readOnly: !!b.demo });
        const state = (ctx.answer && ctx.answer.value && ctx.answer.value.workspace) || b.start || C.EXAMPLES.vide.ws();
        try { window.Blockly.serialization.workspaces.load(state, ws); } catch (e) { window.Blockly.serialization.workspaces.load(C.EXAMPLES.vide.ws(), ws); }
        C.board = old;
        const gen = () => C.generate(ws, board);
        const refresh = TL.debounce(() => { pre.textContent = gen(); if (!b.demo) ctx.save({ value: Object.assign({}, ctx.answer && ctx.answer.value, { workspace: window.Blockly.serialization.workspaces.save(ws), code: pre.textContent }) }); }, 400);
        ws.addChangeListener((e) => { if (!e.isUiEvent) refresh(); });
        pre.textContent = gen();
        new ResizeObserver(() => window.Blockly.svgResize(ws)).observe(host);
        const up = async () => {
          C.current = { board, code: gen(), lang: C.BOARDS[board].lang };
          logBox.textContent = '';
          const ok = await C.actions.upload({ via: C.viaDefaut(board), log });
          if (ok) ctx.save({ value: Object.assign({}, ctx.answer && ctx.answer.value, { uploaded: true }) });
        };
        if (!b.demo) box.append(h('div.checkbar',
          h('button.btn.ghost', { type: 'button', onclick: up }, 'Téléverser sur la carte'),
          h('button.btn.ghost', { type: 'button', onclick: () => { C.current = { board, code: gen(), lang: C.BOARDS[board].lang }; C.actions.exportFile(); } }, 'Exporter le fichier'),
          h('button.btn.primary', { type: 'button', onclick: () => {
            const code = gen();
            const exp = b.expect || [];
            const found = exp.filter((x) => code.includes(x)).length;
            const correct = !exp.length || found === exp.length;
            ctx.result(Object.assign({}, ctx.answer, { value: Object.assign({}, ctx.answer && ctx.answer.value, { workspace: window.Blockly.serialization.workspaces.save(ws), code }), done: true, correct, score: exp.length ? found / exp.length : 1, attempts: ((ctx.answer && ctx.answer.attempts) || 0) + 1, at: Date.now(), pendingReview: true }));
            TL.toast(correct ? 'Programme rendu.' : 'Programme rendu. Il manque encore des éléments attendus.', correct ? 'ok' : '');
          } }, 'Rendre mon programme')));
      }).catch((e) => { host.innerHTML = ''; host.append(h('p.callout.warn', e.message)); });
      return box;
    },
  };
})();
