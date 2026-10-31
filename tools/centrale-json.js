#!/usr/bin/env node
/* Produit centrale.json (format passerelle.atelier v1) à la racine du site.
   Tout ce qui décrit ce que l'appli envoie vient du code de l'appli elle-même :
   activités (js/passerelle.js appliqué aux ateliers intégrés), schémas (js/descriptor.js).
   Relancer après toute modification ; la vérification GitHub échoue si le fichier n'est pas à jour.
   node tools/centrale-json.js */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/descriptor.js');
const P = require('../js/passerelle.js');
const { ateliers, LEVELS } = require('./charger-ateliers.js')();

const URL_APP = 'https://grandiosian.github.io/TechnoStudio/';

/* Schémas du descripteur des ateliers, renommés et rattachés à $defs */
const NOMS = { Workshop: 'Atelier', Step: 'Feuille', Answer: 'Reponse', Progress: 'TravailAtelier', Block: 'Champ', Package: 'PaquetAteliers', CompilationDemande: 'CompilationDemande', CompilationReponse: 'CompilationReponse' };
const reref = (s) => {
  if (Array.isArray(s)) return s.map(reref);
  if (!s || typeof s !== 'object') return s;
  const o = {};
  for (const [k, v] of Object.entries(s)) o[k] = k === '$ref' ? '#/$defs/' + (NOMS[v] || v) : reref(v);
  if (o.required && !o.required.length) delete o.required;
  return o;
};
const defs = {};
for (const [k, n] of Object.entries(NOMS)) if (D.entities[k]) defs[n] = reref(D.entities[k]);
defs.Champ = { type: 'object', required: ['type'], properties: { type: { enum: Object.keys(D.blocks) }, id: { type: 'string' } }, description: 'Champ d’une feuille ; propriétés détaillées par type dans docs/descripteur-ateliers.md.' };
defs.Progression = {
  type: 'object', required: ['faites', 'total', 'statut'],
  properties: {
    titre: { type: 'string', maxLength: 120 }, faites: { type: 'integer', minimum: 0 }, total: { type: 'integer', minimum: 1 }, statut: { enum: ['commence', 'termine'] },
    score: { type: 'number', minimum: 0 }, score_max: { type: 'number', minimum: 0 },
    details: { type: 'object', properties: { feuille: { type: 'string' }, reponses: { type: 'array', items: { type: 'object', required: ['q', 'type', 'r'], properties: { q: { type: 'string' }, type: { type: 'string' }, r: { type: 'string' }, note: { type: 'string' }, aCorriger: { type: 'boolean' } } } } } },
  },
};
defs.ProjetCode = { type: 'object', required: ['board', 'ws'], properties: { board: { enum: ['uno', 'nano', 'esp32', 'esp32-mpy', 'microbit'] }, ws: { type: 'object', description: 'Espace Blockly (Blockly.serialization.workspaces.save)' }, at: { type: 'number', description: 'horodatage ms : la copie la plus récente gagne' } } };

const liste = P.activites(ateliers);
const desc = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: URL_APP + 'centrale.json',
  format: 'passerelle.atelier',
  version: 1,
  atelier: {
    app: P.APP, nom: 'TechnoStudio', version: P.VERSION,
    description: 'Ateliers de technologie au format de la charte (feuilles, ressources, synthèse, évaluation, SEGPA), simulateur de circuits, maquettes programmables et programmation Blockly de cartes Arduino, ESP32 et micro:bit.',
    url: URL_APP, urls_secours: ['https://technoversailles.alwaysdata.net/miroir/technostudio/'], icone: '🛠️', depot: 'https://github.com/grandiosian/TechnoStudio', langue: 'fr',
    classes: ['5e', '4e', '3e', 'STI2D', 'SNT', 'Pro'],
    parametres: {
      app: 'Autre identifiant d’atelier Centrale ouvrant TechnoStudio (ex. ?app=technostudio-5e) : ressources, données et suivi lui sont propres.',
      centrale: 'Autre adresse de Centrale (ex. ?centrale=https://…/).',
      compilateur: 'Autre serveur de compilation pour les cartes (ex. ?compilateur=https://…/compilation/).',
    },
    _correspondance: 'Champs de la table ateliers de la Centrale : app, nom, description, url, icone, urls_secours.',
  },
  centrale: {
    module: 'js/centrale-client.js',
    serveur_par_defaut: 'https://technoversailles.alwaysdata.net/',
    changer_de_serveur: '?centrale=https://…/ dans l’adresse, window.CENTRALE_URL, ou Compte → Réglages de connexion.',
    sites_a_autoriser: ['https://grandiosian.github.io'],
    chargement: 'Le module est chargé au démarrage, en parallèle de l’affichage. S’il est injoignable, TechnoStudio fonctionne seul (IndexedDB).',
    connexion: {
      bouton: '« Mon code » dans la barre du haut (et à l’accueil) : formulaire Centrale.afficherConnexion ; une fois connecté, l’identifiant de l’élève s’affiche.',
      depuis_le_portail: 'Jeton dans l’adresse (#centrale=…) : connexion automatique, sans écran d’accueil.',
      activite_directe: 'Centrale.activiteDemandee() : « <atelier>/<feuille> » ouvre la feuille, « <atelier> » ouvre l’atelier.',
      retour: 'Bouton « ← Mes ateliers » dans la barre de menus de TechnoStudio (boutonRetour: false).',
    },
    fonctions_utilisees: ['init', 'afficherConnexion', 'connecte', 'session', 'deconnexion', 'charger', 'sauver', 'listeDonnees', 'progression', 'declarerActivites', 'activiteDemandee', 'listeRessources', 'chargerRessource', 'afficherIdentifiant', 'retour'],
    fonctions_non_utilisees: ['envoyerFichier', 'listeFichiers', 'chargerFichier', 'mesProgressions', 'etape', 'projet.*', 'parcours', 'ateliers', 'lien', 'ouvrir'],
  },
  activites: {
    declaration: 'Centrale.declarerActivites(TechnoStudio.activites()) après chaque connexion : la liste ci-dessous (ateliers intégrés), suivie des activités des ateliers reçus en ressources.',
    champs_envoyes: ['id', 'titre', 'groupe', 'total'],
    identifiants_stables: true,
    regle: 'Une activité par feuille contenant au moins un champ noté : id = <id atelier>/<code feuille> (P1, R1, S1, E1, S-P1 pour la version SEGPA) ; total = nombre de champs notés.',
    dynamiques: { motif: '^[A-Za-z0-9-]+/(S-)?[PRSE][0-9]+$', description: 'Ateliers déposés par l’enseignant dans Ressources des ateliers : mêmes règles, déclarés à la connexion après les ateliers intégrés.' },
    liste,
  },
  progression: {
    envoi: 'Centrale.progression(id, TechnoStudio.progression(id)), 4 s après la dernière réponse, seulement si la valeur a changé.',
    quand: ['réponse vérifiée ou rendue dans une feuille notée', 'connexion (le travail fait hors ligne est renvoyé)'],
    champs: {
      titre: '« P1 · titre de la feuille »',
      faites: 'champs notés terminés dans la feuille',
      total: 'champs notés de la feuille',
      statut: 'termine quand tous les champs notés sont faits, sinon commence',
      score: 'points obtenus (barème de chaque champ, 1 par défaut) × réussite',
      score_max: 'somme des barèmes de la feuille',
      details: '{ feuille, reponses: [{ q, type, r, note, aCorriger }] } : réponses ouvertes à lire ou corriger (20 Ko au plus)',
    },
    champs_non_utilises: [],
    a_la_connexion: 'Le travail (donnees at/…) est fusionné réponse par réponse ; la progression est recalculée à partir de lui, pas relue avec mesProgressions().',
    format: { $ref: '#/$defs/Progression' },
  },
  donnees: {
    'at/{atelier}': {
      description: 'Travail de l’élève dans un atelier : réponses par champ, feuille en cours, feuilles vues.',
      motif: '^at/[A-Za-z0-9_.-]+$',
      sauvegarde: 'À chaque réponse ; la Centrale regroupe les envois (3 s au plus).',
      chargement: 'À la connexion : chaque clé est fusionnée avec la copie du poste (réponse la plus récente par champ, champ at) ; sur conflit 409, relecture puis fusion.',
      taille_typique: '1 à 50 Ko ; jusqu’à 1 Mo avec des dessins (limite : 2 Mo par clé).',
      format: { $ref: '#/$defs/TravailAtelier' },
    },
    'code/projet': {
      description: 'Programme libre de l’atelier Code (blocs et carte choisie).',
      sauvegarde: 'À chaque modification des blocs.',
      chargement: 'À l’ouverture de l’atelier Code : la copie la plus récente (champ at) gagne.',
      taille_typique: '2 à 30 Ko.',
      format: { $ref: '#/$defs/ProjetCode' },
    },
  },
  fichiers: {
    utilises: true,
    dossier_projet: false,
    ressources: [
      { nom: '*.technostudio.json', type: 'application/json', description: 'Atelier (ou liste d’ateliers) créé avec l’éditeur de TechnoStudio : Mes ateliers → Pour la Centrale.', format: { $ref: '#/$defs/Atelier' } },
      { nom: '*.gift', type: 'text/plain', description: 'Questions au format GIFT de Moodle, converties en atelier à la réception.' },
    ],
    recoit: [],
    produit: [],
    note: 'TechnoStudio lit les ressources de l’atelier ; il n’envoie pas de fichiers et n’utilise pas encore le dossier de projet. Piste : produit programme.ino / main.py dans un atelier transversal.',
  },
  stockage_local: {
    description: 'Copies dans le navigateur de l’élève (IndexedDB « technostudio », magasin kv), utilisées sans connexion.',
    cles: {
      'pg:<atelier>': { contenu: 'travail de l’atelier (même valeur que at/<atelier>)', format: { $ref: '#/$defs/TravailAtelier' } },
      'ws:<atelier>': { contenu: 'atelier modifié, importé ou reçu de la Centrale', format: { $ref: '#/$defs/Atelier' } },
      'code:projet': { contenu: 'programme libre de l’atelier Code', format: { $ref: '#/$defs/ProjetCode' } },
      profile: { contenu: 'profil local (nom affiché, rôle) ; jamais envoyé à la Centrale' },
      'ui:panels': { contenu: 'disposition des panneaux ; jamais envoyée' },
      'localStorage ts-centrale, ts-app, ts-compilateur': { contenu: 'réglages de connexion du poste' },
    },
  },
  acces_javascript: {
    objet: 'window.TechnoStudio',
    membres: {
      app: 'Identifiant de l’atelier en cours (« technostudio » ou la valeur de ?app=).',
      version: 'Version de TechnoStudio (identique à atelier.version).',
      descripteur: 'Chemin de ce fichier : "centrale.json".',
      'activites()': 'Liste envoyée à la Centrale : [{id, titre, groupe, total}].',
      'catalogue()': 'Ateliers du poste avec leurs feuilles notées.',
      'progression(id)': '{titre, faites, total, statut, score, score_max, details} ou null.',
      'donnees()': 'Promesse : { "at/<atelier>": travail, "code/projet": programme }.',
      'valider(atelier)': 'Vérifie un atelier : { ok, errors, warnings }.',
      'estAtelier(objet)': 'true si l’objet est un atelier valide.',
    },
  },
  compilation: {
    description: 'Programmes des cartes : compilés par la Centrale (api/compilation.php, qui appelle serveur-compilation/compiler-cli.js de ce dépôt), puis écrits dans la carte par le navigateur (Web Serial) ou, pour la micro:bit, enregistrés en .hex à glisser sur le lecteur MICROBIT.',
    adresse_par_defaut: 'https://technoversailles.alwaysdata.net/api/compilation.php',
    installation: 'Workflow « Chaîne de compilation » du dépôt centrale : arduino-cli, cœurs arduino:avr et esp32:esp32, MicroPython micro:bit, dans ~/technostudio-compilation (hors du site).',
    cartes: { uno: '.hex (STK500)', nano: '.hex (STK500, 57600 ou 115200 bauds)', esp32: 'images .bin (esptool-js)', microbit: '.hex universel V1/V2 : MicroPython + main.py' },
    acces: 'En-tête X-Jeton d’un élève connecté, ou X-Cle (clé enseignant, ~/technostudio-compilation/config.json).',
    points_acces: { GET: 'état : { version, cartes: { <carte>: { installee } } }', 'POST { carte, code }': '{ ok, format: hex|bin|hex-microbit, hex | images, journal } ou { enCours, travail }', 'GET ?travail=<id>': 'suite d’une compilation longue' },
    demande: { $ref: '#/$defs/CompilationDemande' },
    reponse: { $ref: '#/$defs/CompilationReponse' },
  },
  enums: {
    niveaux: Object.entries(LEVELS).map(([k, v]) => ({ id: k, titre: v.label })),
    types_feuilles: { feuille: 'P', ressource: 'R', synthese: 'S', evaluation: 'E' },
    types_champs: Object.fromEntries(Object.entries(D.blocks).map(([k, b]) => [k, b.family + (b.graded ? ', noté' : '') + (b.review ? ', à corriger' : '')])),
    cartes: ['uno', 'nano', 'esp32', 'esp32-mpy', 'microbit'],
  },
  $defs: defs,
};

const sortie = path.join(__dirname, '..', 'centrale.json');
fs.writeFileSync(sortie, JSON.stringify(desc, null, 1) + '\n');
console.log('centrale.json : ' + liste.length + ' activités, ' + Object.keys(desc.donnees).length + ' clés de données, version ' + P.VERSION + '.');
