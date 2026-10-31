/* Test du téléversement Arduino (STK500) contre un faux bootloader optiboot. node tests/stk500.test.js */
'use strict';
global.window = global; global.location = { search: '' };
require('../js/flash.js');
const F = window.TL.flash;
function fauxUno(opts) {
  const flash = new Uint8Array(32768).fill(0xff);
  let ctrl, addr = 0, reset = false, buf = [];
  const repondre = (arr) => ctrl.enqueue(Uint8Array.from(arr));
  const traiter = () => {
    for (;;) {
      if (!buf.length) return;
      const c = buf[0];
      const need = { 0x30: 2, 0x75: 2, 0x50: 2, 0x51: 2, 0x55: 4 }[c];
      if (need) { if (buf.length < need) return; const b = buf.splice(0, need);
        if (c === 0x55) addr = (b[1] | (b[2] << 8)) * 2;
        if (c === 0x75) repondre([0x14, 0x1e, 0x95, 0x0f, 0x10]); else repondre([0x14, 0x10]); continue; }
      if (c === 0x64 || c === 0x74) { if (buf.length < 5) return; const n = (buf[1] << 8) | buf[2];
        if (c === 0x64) { if (buf.length < 5 + n) return; const b = buf.splice(0, 5 + n); for (let k = 0; k < n; k++) flash[addr + k] = b[4 + k]; repondre([0x14, 0x10]); }
        else { buf.splice(0, 5); repondre([0x14, ...flash.slice(addr, addr + n), 0x10]); }
        continue; }
      buf.shift(); // octet inconnu ignoré
    }
  };
  const port = {
    readable: null, writable: null, baud: 0,
    async open({ baudRate }) { this.baud = baudRate; this.readable = new ReadableStream({ start(c) { ctrl = c; } }); const self = this;
      this.writable = new WritableStream({ write(chunk) { if (self.baud !== (opts.baud || 115200) || !reset) return; for (const b of chunk) buf.push(b); traiter(); } }); },
    async setSignals(s) { if (s.dataTerminalReady) reset = true; },
    async close() { this.readable = this.writable = null; },
  };
  return { port, flash };
}
function hexDe(octets) {
  const l = [];
  for (let a = 0; a < octets.length; a += 16) { const b = octets.slice(a, a + 16); const r = [b.length, (a >> 8) & 255, a & 255, 0, ...b]; r.push((256 - (r.reduce((s, x) => s + x, 0) & 255)) & 255); l.push(':' + r.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()); }
  return l.concat(':00000001FF').join('\n');
}
(async () => {
  const prog = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7 + 3) & 255);
  const hex = hexDe(prog);
  console.assert(F.lireHex(hex).length === 1000, 'lecture hex');
  const logs = [];
  const u = fauxUno({ baud: 115200 });
  await F.avr(u.port, hex, { log: (s) => logs.push(s) });
  const ok1 = prog.every((b, i) => u.flash[i] === b);
  const n = fauxUno({ baud: 57600 }); // Nano ancien bootloader : la vitesse est retrouvée seule
  await F.avr(n.port, hex, { log: () => {} });
  const ok2 = prog.every((b, i) => n.flash[i] === b);
  let refus = false; try { await F.avr(fauxUno({}).port, hexDe(new Uint8Array(33000)), {}); } catch (e) { refus = /trop gros/.test(e.message); }
  console.log(logs.join('\n'));
  console.log('Uno 115200 :', ok1 ? 'OK' : 'ÉCHEC', '· Nano 57600 :', ok2 ? 'OK' : 'ÉCHEC', '· refus trop gros :', refus ? 'OK' : 'ÉCHEC');
  process.exit(ok1 && ok2 && refus ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
