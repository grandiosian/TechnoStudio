/* Règles d'acceptation du code par le serveur de compilation (sans arduino-cli). */
'use strict';
const { controlerCode } = require("../serveur-compilation/compilation.js");
const prog = 'void setup(){}\nvoid loop(){}\n';
const cas = [
  [true, '#include <Servo.h>\n' + prog], [true, '#include <ESP32Servo.h> // servo\n' + prog], [true, '#define LED 13\n#ifdef LED\n#endif\n' + prog],
  [false, '#include "/etc/passwd"\n' + prog], [false, '%:include </etc/passwd>\n' + prog], [false, '??=include <x.h>\n' + prog], [false, '#inc\\\nlude <a.h>\n' + prog],
  [false, 'asm(".incbin \\"/etc/passwd\\"");\n' + prog], [false, '__asm__("nop");\n' + prog], [false, '_Pragma("once")\n' + prog], [false, '#pragma GCC x\n' + prog],
  [false, '#line 2 "/x"\n' + prog], [false, '#include <inconnu.h>\n' + prog], [false, '#if __has_include("/etc/passwd")\n#endif\n' + prog], [false, ''], [false, 'x'.repeat(102401)],
  [false, '#embed "/etc/passwd"\n' + prog], [false, '#include_next <Servo.h>\n' + prog],
];
let echec = 0;
for (const [attendu, code] of cas) { const r = controlerCode(code); const accepte = !r; if (accepte !== attendu) { echec++; console.log('✗', JSON.stringify(code.slice(0, 50)), r); } }
console.log(echec ? echec + ' cas en échec' : '✓ ' + cas.length + ' cas conformes');
process.exit(echec ? 1 : 0);
