#!/usr/bin/env node
/* TechnoStudio — serveur de compilation (Node.js 18+, sans dépendance).

   Les élèves programment leur carte dans TechnoStudio (navigateur). Le code C++ généré
   est envoyé ici, compilé avec arduino-cli, et le binaire revient au navigateur, qui le
   téléverse lui-même sur la carte branchée en USB (Web Serial). Aucun logiciel n'est
   donc à installer sur les postes élèves.

     GET  /etat       → { ok, version, cartes, auth, file }
     POST /compiler   { carte: "uno"|"nano"|"esp32", code } (+ en-tête X-Jeton de la Centrale)
                      → { ok, journal, format: "hex", hex }               (Arduino AVR)
                      → { ok, journal, format: "bin", images: [{ adresse, donnees(base64) }] } (ESP32)

   Accès : par défaut, seul un élève connecté à la Centrale peut compiler (le jeton est
   vérifié auprès de la Centrale, puis gardé 20 min). Voir README.md de ce dossier.

   Réglages (variables d'environnement) :
     PORT, IP            adresse d'écoute (alwaysdata les fournit)          défaut 8790, 0.0.0.0
     CENTRALE            API de la Centrale              défaut https://technoversailles.alwaysdata.net/api/
     ORIGINES            sites autorisés, séparés par des virgules (* = tous)
     CLES                clés enseignant acceptées dans l'en-tête X-Cle (séparées par des virgules)
     OUVERT=1            pas de contrôle d'accès (réseau local uniquement !)
     ARDUINO_CLI         chemin d'arduino-cli                                défaut : ~/bin, puis PATH
     PARALLELE           compilations simultanées                            défaut 1
     FILE_MAX            demandes en attente au maximum                      défaut 40
     DOSSIER             dossier de travail                                  défaut ~/.technostudio-compilation */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const C = require('./compilation.js');
const VERSION = C.VERSION;
const env = process.env;
const PORT = +(env.PORT || 8790);
const IP = env.IP || env.HOST || '0.0.0.0';
const CENTRALE = (env.CENTRALE || 'https://technoversailles.alwaysdata.net/api/').replace(/\/?$/, '/');
const ORIGINES = (env.ORIGINES || 'https://grandiosian.github.io,https://technoversailles.alwaysdata.net,http://localhost:8000,http://127.0.0.1:8000,null')
  .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
const CLES = (env.CLES || '').split(',').map((s) => s.trim()).filter((s) => s.length >= 12);
const OUVERT = env.OUVERT === '1';
const MAX_CODE = 100 * 1024;
const OPTIONS = { dossier: env.DOSSIER || path.join(os.homedir(), '.technostudio-compilation') };
const CARTES = C.CARTES;
const controlerCode = C.controlerCode;

/* ---------- Accès ---------- */
const jetonsValides = new Map(); // empreinte → expiration
const empreinte = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function verifierJeton(jeton) {
  const k = empreinte(jeton);
  const exp = jetonsValides.get(k);
  if (exp && exp > Date.now()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const u = new URL(CENTRALE + 'progression.php');
    u.searchParams.set('app', 'technostudio');
    const lib = u.protocol === 'http:' ? http : https;
    const rq = lib.get(u, { headers: { 'X-Jeton': jeton, 'User-Agent': 'technostudio-compilation/' + VERSION }, timeout: 8000 }, (r) => {
      r.resume();
      const ok = r.statusCode === 200;
      if (ok) { jetonsValides.set(k, Date.now() + 20 * 60000); if (jetonsValides.size > 5000) jetonsValides.delete(jetonsValides.keys().next().value); }
      resolve(ok);
    });
    rq.on('timeout', () => rq.destroy());
    rq.on('error', () => resolve(false));
  });
}
async function identifier(req) {
  if (OUVERT) return { id: 'ouvert:' + (req.socket.remoteAddress || '') };
  const cle = req.headers['x-cle'];
  if (cle && CLES.some((c) => c.length === String(cle).length && crypto.timingSafeEqual(Buffer.from(c), Buffer.from(String(cle))))) return { id: 'cle:' + empreinte(cle).slice(0, 8) };
  const jeton = req.headers['x-jeton'];
  if (jeton && /^[a-f0-9]{16,128}$/i.test(jeton) && (await verifierJeton(jeton))) return { id: 'eleve:' + empreinte(jeton).slice(0, 12) };
  return null;
}
const essais = new Map(); // id → [horodatages]
function tropDeDemandes(id) {
  const t = Date.now();
  const l = (essais.get(id) || []).filter((x) => t - x < 60000);
  l.push(t); essais.set(id, l);
  if (essais.size > 10000) essais.delete(essais.keys().next().value);
  return l.length > 12;
}

/* ---------- HTTP ---------- */
function cors(req, res) {
  const o = req.headers.origin;
  if (!o) return true;
  const ok = ORIGINES.includes('*') || ORIGINES.includes(o.replace(/\/$/, ''));
  if (!ok) return false;
  res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Jeton, X-Cle');
  res.setHeader('Access-Control-Max-Age', '86400');
  return true;
}
function json(res, statut, data) {
  res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function lireCorps(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const morceaux = [];
    req.on('data', (d) => { n += d.length; if (n > max) { reject(Object.assign(new Error('Envoi trop gros.'), { statut: 413 })); req.destroy(); } else morceaux.push(d); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(morceaux).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(new Error('JSON invalide.'), { statut: 400 })); } });
    req.on('error', reject);
  });
}

const serveur = http.createServer(async (req, res) => {
  if (!cors(req, res)) return json(res, 403, { ok: false, erreur: 'Ce site n’est pas autorisé à utiliser le serveur de compilation.' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const fin = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  try {
    if (req.method === 'GET' && (fin === 'etat' || fin === '')) {
      return json(res, 200, Object.assign(await C.etat(OPTIONS), { auth: OUVERT ? 'ouvert' : 'centrale' + (CLES.length ? '+cle' : '') }));
    }
    if (req.method === 'POST' && fin === 'compiler') {
      const qui = await identifier(req);
      if (!qui) return json(res, 401, { ok: false, erreur: 'Connecte-toi avec ton code élève (Centrale) pour compiler sur le serveur.' });
      if (tropDeDemandes(qui.id)) return json(res, 429, { ok: false, erreur: 'Trop de compilations en une minute : attends un peu.' });
      const corps = await lireCorps(req, MAX_CODE * 2);
      const carte = String(corps.carte || '');
      const r = await C.compiler(carte, corps.code, OPTIONS);
      if (r.refuse) return json(res, 400, r);
      console.log(new Date().toISOString(), qui.id, carte, r.ok ? 'ok' : 'erreur', (r.duree || 0) + ' ms' + (r.cache ? ' (cache)' : ''));
      return json(res, 200, r);
    }
    json(res, 404, { ok: false, erreur: 'Inconnu. Utilise GET /etat ou POST /compiler.' });
  } catch (e) {
    json(res, e.statut || 500, { ok: false, erreur: e.message });
  }
});

if (require.main === module) {
  C.etat(OPTIONS).then((e) => {
    serveur.listen(PORT, IP, () => {
      console.log(`Serveur de compilation TechnoStudio ${VERSION} sur http://${IP}:${PORT}`);
      console.log('Cartes : ' + Object.entries(e.cartes).map(([k, c]) => k + (c.installee ? ' ✓' : ' ✗')).join(', '));
      console.log('Accès : ' + (OUVERT ? 'OUVERT (sans contrôle)' : 'élèves connectés à ' + CENTRALE + (CLES.length ? ' ou clé enseignant' : '')));
    });
  });
}
module.exports = { controlerCode, CARTES, serveur };
