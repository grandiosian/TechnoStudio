/* TechnoStudio — compilation à distance et téléversement depuis le navigateur.
   1. Le code C++ part au serveur de compilation (serveur-compilation/serveur.js),
      qui renvoie le binaire (.hex pour Arduino AVR, images .bin pour ESP32).
   2. Le navigateur l'écrit lui-même dans la carte branchée en USB (Web Serial,
      Chrome ou Edge) : protocole STK500 pour Uno/Nano, esptool-js pour ESP32.
   Rien à installer sur les postes élèves. */
(function () {
  'use strict';
  const TL = window.TL || (window.TL = {});
  const F = (TL.flash = {});
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const DEFAUT = 'https://technoversailles.alwaysdata.net/compilation/';

  /* ================= Serveur de compilation ================= */
  F.adresse = function () {
    let u = window.TS_COMPILATEUR || '';
    try { u = new URLSearchParams(location.search).get('compilateur') || localStorage.getItem('ts-compilateur') || u; } catch (e) { /* stockage indisponible */ }
    u = String(u || DEFAUT).trim();
    return u.replace(/\/?$/, '/');
  };
  F.reglerAdresse = function (u) { try { if (u) localStorage.setItem('ts-compilateur', u.trim()); else localStorage.removeItem('ts-compilateur'); } catch (e) { /* rien */ } F.etat = null; };
  F.etat = null;
  F.verifier = async function () {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(F.adresse() + 'etat', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
      F.etat = r.ok ? await r.json() : null;
    } catch (e) { F.etat = null; }
    if (TL.emit) TL.emit('compilateur', F.etat);
    return F.etat;
  };
  F.compiler = async function (carte, code) {
    const headers = { 'Content-Type': 'application/json' };
    const jeton = TL.centrale && TL.centrale.jeton();
    if (jeton) headers['X-Jeton'] = jeton;
    let cle = ''; try { cle = localStorage.getItem('ts-compilateur-cle') || ''; } catch (e) { /* rien */ }
    if (cle) headers['X-Cle'] = cle;
    let r;
    try { r = await fetch(F.adresse() + 'compiler', { method: 'POST', headers, body: JSON.stringify({ carte, code }) }); } catch (e) {
      throw new Error('Serveur de compilation injoignable (' + F.adresse() + ').');
    }
    let j = {};
    try { j = await r.json(); } catch (e) { /* réponse non JSON */ }
    if (!r.ok && !j.journal) throw new Error(j.erreur || 'Erreur du serveur de compilation (' + r.status + ').');
    return j;
  };

  /* ================= Port USB ================= */
  F.supporte = typeof navigator !== 'undefined' && 'serial' in navigator;
  /** À appeler directement dans le clic (le navigateur exige un geste pour choisir un port). */
  F.choisirPort = async function (forcer) {
    if (!F.supporte) throw new Error('Ce navigateur ne sait pas téléverser par USB : utilise Chrome ou Edge sur ordinateur.');
    const C = TL.code;
    if (!forcer && C && C.serial && C.serial.port) return C.serial.port;
    if (!forcer) { const deja = await navigator.serial.getPorts(); if (deja.length === 1) return deja[0]; }
    return navigator.serial.requestPort();
  };
  /** Libère le port s'il est ouvert par le moniteur série. */
  F.liberer = async function (port) {
    const C = TL.code;
    if (C && C.serial && C.serial.port === port && C.serial.writer) await C.serial.close();
    if (port.readable || port.writable) { try { await port.close(); } catch (e) { /* déjà fermé */ } }
  };

  /* Lecture/écriture avec délais, au-dessus d'un port Web Serial */
  class Ligne {
    constructor(port) { this.port = port; this.buf = []; this.attente = null; }
    async ouvrir(baud) {
      await this.port.open({ baudRate: baud, bufferSize: 4096 });
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      this.fini = false;
      (async () => {
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            for (const b of value) this.buf.push(b);
            if (this.attente) this.attente();
          }
        } catch (e) { /* port fermé */ }
        this.fini = true;
        if (this.attente) this.attente();
      })();
    }
    vider() { this.buf = []; }
    async ecrire(octets) { await this.writer.write(octets instanceof Uint8Array ? octets : new Uint8Array(octets)); }
    async lire(n, delai) {
      const fin = Date.now() + (delai || 1000);
      while (this.buf.length < n) {
        const reste = fin - Date.now();
        if (reste <= 0 || this.fini) throw new Error('pas de réponse de la carte');
        await new Promise((r) => { const t = setTimeout(r, reste); this.attente = () => { clearTimeout(t); r(); }; });
        this.attente = null;
      }
      return Uint8Array.from(this.buf.splice(0, n));
    }
    async signaux(dtr, rts) { await this.port.setSignals({ dataTerminalReady: dtr, requestToSend: rts }); }
    async fermer() {
      try { await this.reader.cancel(); } catch (e) { /* rien */ }
      try { this.reader.releaseLock(); } catch (e) { /* rien */ }
      try { this.writer.releaseLock(); } catch (e) { /* rien */ }
      try { await this.port.close(); } catch (e) { /* rien */ }
    }
  }
  F.Ligne = Ligne;

  /* ================= Intel HEX ================= */
  F.lireHex = function (texte) {
    const octets = new Uint8Array(256 * 1024).fill(0xff);
    let base = 0, max = 0, fin = false;
    String(texte).split(/\r?\n/).forEach((l, i) => {
      l = l.trim();
      if (!l || fin) return;
      if (l[0] !== ':') throw new Error('Fichier .hex invalide (ligne ' + (i + 1) + ').');
      const b = l.slice(1).match(/../g).map((x) => parseInt(x, 16));
      const n = b[0], adr = (b[1] << 8) | b[2], type = b[3];
      if (b.length !== n + 5 || (b.reduce((s, x) => s + x, 0) & 0xff) !== 0) throw new Error('Somme de contrôle incorrecte (ligne ' + (i + 1) + ').');
      if (type === 0) { for (let k = 0; k < n; k++) octets[base + adr + k] = b[4 + k]; max = Math.max(max, base + adr + n); }
      else if (type === 1) fin = true;
      else if (type === 2) base = ((b[4] << 8) | b[5]) << 4;
      else if (type === 4) base = ((b[4] << 8) | b[5]) << 16;
    });
    return octets.slice(0, max);
  };

  /* ================= Arduino Uno / Nano : STK500 v1 (bootloader optiboot) ================= */
  const OK = 0x14, EOP = 0x20, FIN = 0x10;
  F.avr = async function (port, hex, o) {
    o = o || {};
    const log = o.log || (() => {}), progres = o.progres || (() => {});
    const prog = F.lireHex(hex);
    const page = o.page || 128;
    const maxi = o.max || 32256;
    if (prog.length > maxi) throw new Error('Programme trop gros pour la carte (' + prog.length + ' octets, ' + maxi + ' au plus).');
    await F.liberer(port);
    const bauds = o.bauds || [115200, 57600];
    let L = null;
    for (const baud of bauds) {
      L = new Ligne(port);
      try {
        await L.ouvrir(baud);
        log('Redémarrage de la carte (' + baud + ' bauds)…');
        await L.signaux(false, false); await wait(250);
        await L.signaux(true, true); await wait(50);
        let synchro = false;
        for (let k = 0; k < 12 && !synchro; k++) {
          L.vider();
          await L.ecrire([0x30, EOP]);
          try { const r = await L.lire(2, 200); synchro = r[0] === OK && r[1] === FIN; } catch (e) { /* nouvel essai */ }
        }
        if (synchro) break;
        await L.fermer(); L = null;
      } catch (e) { if (L) await L.fermer(); L = null; if (/open|ouvr|already/i.test(e.message)) throw new Error('Le port USB est déjà utilisé (moniteur série, IDE Arduino…) : ferme-le et recommence.'); }
    }
    if (!L) throw new Error('La carte ne répond pas. Vérifie le câble, le type de carte (Uno, Nano) et que le port est le bon.');
    const cmd = async (octets, n, delai) => {
      await L.ecrire(octets.concat([EOP]));
      const r = await L.lire((n || 0) + 2, delai || 1000);
      if (r[0] !== OK || r[r.length - 1] !== FIN) throw new Error('réponse inattendue de la carte');
      return r.slice(1, r.length - 1);
    };
    try {
      const sig = await cmd([0x75], 3);
      const hexs = Array.from(sig).map((x) => x.toString(16).padStart(2, '0')).join(' ');
      log('Microcontrôleur : ' + ({ '1e 95 0f': 'ATmega328P', '1e 95 14': 'ATmega328', '1e 95 16': 'ATmega328PB', '1e 94 06': 'ATmega168' }[hexs] || 'signature ' + hexs));
      await cmd([0x50]);
      const pages = Math.ceil(prog.length / page);
      log('Écriture de ' + prog.length + ' octets…');
      for (let p = 0; p < pages; p++) {
        const a = p * page;
        const bloc = Array.from(prog.slice(a, a + page));
        while (bloc.length < page) bloc.push(0xff);
        await cmd([0x55, (a >> 1) & 0xff, (a >> 9) & 0xff]);
        await cmd([0x64, (page >> 8) & 0xff, page & 0xff, 0x46].concat(bloc), 0, 2000);
        progres((p + 1) / pages / 2);
      }
      log('Vérification…');
      for (let p = 0; p < pages; p++) {
        const a = p * page;
        await cmd([0x55, (a >> 1) & 0xff, (a >> 9) & 0xff]);
        const lu = await cmd([0x74, (page >> 8) & 0xff, page & 0xff, 0x46], page, 2000);
        for (let k = 0; k < page && a + k < prog.length; k++) if (lu[k] !== prog[a + k]) throw new Error('Vérification échouée à l’adresse 0x' + (a + k).toString(16) + '.');
        progres(0.5 + (p + 1) / pages / 2);
      }
      await cmd([0x51]);
      log('✓ Programme écrit et vérifié. La carte redémarre.');
    } finally { await L.fermer(); }
    return true;
  };

  /* ================= ESP32 : esptool-js ================= */
  let chargement = null;
  F.chargerEsptool = function () {
    if (window.esptoolJs) return Promise.resolve(window.esptoolJs);
    if (!chargement) chargement = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = (window.TL_VENDOR || 'vendor/') + 'esptool/esptool.js';
      s.onload = () => (window.esptoolJs ? res(window.esptoolJs) : rej(new Error('esptool indisponible')));
      s.onerror = () => { chargement = null; rej(new Error('esptool n’a pas pu être chargé.')); };
      document.head.appendChild(s);
    });
    return chargement;
  };
  const versChaine = (b64) => { const bin = atob(b64); return bin; };
  F.esp32 = async function (port, images, o) {
    o = o || {};
    const log = o.log || (() => {}), progres = o.progres || (() => {});
    const { ESPLoader, Transport } = await F.chargerEsptool();
    await F.liberer(port);
    const transport = new Transport(port, false);
    const terminal = { clean() {}, writeLine: (s) => log(String(s)), write: () => {} };
    const loader = new ESPLoader({ transport, baudrate: o.baud || 460800, romBaudrate: 115200, terminal });
    try {
      log('Connexion à l’ESP32 (si rien ne se passe, maintiens le bouton BOOT de la carte)…');
      const puce = await loader.main();
      log('Carte détectée : ' + puce);
      const fileArray = images.map((im) => ({ address: im.adresse, data: versChaine(im.donnees) }));
      const total = fileArray.reduce((s, f) => s + f.data.length, 0);
      let avant = 0;
      await loader.writeFlash({
        fileArray, flashSize: 'keep', flashMode: 'keep', flashFreq: 'keep', eraseAll: false, compress: true,
        reportProgress: (i, ecrit) => { const deja = fileArray.slice(0, i).reduce((s, f) => s + f.data.length, 0); const v = (deja + ecrit) / total; if (v - avant > 0.02 || v >= 1) { avant = v; progres(v); } },
      });
      log('Redémarrage de la carte…');
      await loader.hardReset();
      log('✓ Programme écrit. La carte redémarre.');
    } finally {
      try { await transport.disconnect(); } catch (e) { /* déjà fermé */ }
    }
    return true;
  };

  /* ================= Enchaînement complet ================= */
  /** port : choisi au préalable dans le clic (F.choisirPort). */
  F.televerser = async function (port, carte, code, o) {
    o = o || {};
    const log = o.log || (() => {});
    log('Compilation sur le serveur (' + F.adresse().replace(/^https?:\/\//, '') + ')…');
    const r = await F.compiler(carte, code);
    if (r.journal) log(r.journal.trim().split('\n').slice(-25).join('\n'));
    if (!r.ok) { log('✗ ' + (r.erreur || 'Erreur de compilation : corrige le programme.')); return false; }
    log('✓ Compilé' + (r.cache ? ' (déjà en cache)' : r.duree ? ' en ' + (r.duree / 1000).toFixed(1) + ' s' : '') + '.');
    if (r.format === 'hex') return F.avr(port, r.hex, Object.assign({ bauds: carte === 'nano' ? [57600, 115200] : [115200, 57600] }, o));
    if (r.format === 'bin') return F.esp32(port, r.images, o);
    throw new Error('Réponse inconnue du serveur.');
  };
})();
