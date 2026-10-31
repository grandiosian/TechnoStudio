/* TechnoStudio — DESCRIPTEUR DE PASSERELLE
   Contrat entre l'application centralisatrice (la Centrale élèves,
   https://github.com/grandiosian/centrale) et l'application cible TechnoStudio
   (et tout outil qui produit des ateliers pour elle). Il décrit :
     1. les entités échangées (schémas JSON) ;
     2. où et comment chaque côté les stocke (clés de la Centrale, IndexedDB) ;
     3. la synchronisation et la fusion du travail des élèves ;
     4. les points d'accès utilisés (Centrale, serveur de compilation, pont local) ;
     5. les règles de compatibilité entre versions.
   Le validateur (validate) n'utilise que ce fichier : l'appli, l'éditeur et les
   scripts vérifient les mêmes règles. Module UMD (navigateur et Node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.TL = root.TL || {}; root.TL.descriptor = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const str = (extra) => Object.assign({ type: 'string' }, extra);
  const num = (extra) => Object.assign({ type: 'number' }, extra);
  const bool = { type: 'boolean' };
  const arr = (items, extra) => Object.assign({ type: 'array', items }, extra);
  const obj = (properties, required, extra) => Object.assign({ type: 'object', properties, required: required || [] }, extra);
  const md = str({ format: 'markdown' });
  const any = {};
  const alt = str({ description: 'Réponse attendue ; variantes acceptées séparées par « | » (comparaison sans accents ni casse).' });
  const cellIn = obj({ a: alt, choices: arr(str()), check: bool });

  /* ---------- Champs communs à tous les blocs ---------- */
  const COMMON = {
    id: str({ pattern: '^[A-Za-z0-9_-]+$', description: 'Stable : la progression y est rattachée. Généré si absent.' }),
    type: str(),
    question: md,
    tag: str({ enum: ['papier', 'ordi', 'none'], description: 'Étiquette PAPIER (bleue) / ORDI (verte) de la charte.' }),
    num: str({ description: 'Numéro affiché (« 1. », « 1.6 »). Automatique si absent.' }),
    comp: arr(str({ pattern: '^T\\d' }), { description: 'Pastilles de compétences (calque _Comp), ex. T2C11.' }),
    bareme: num({ minimum: 0, description: 'Barème (feuilles d’évaluation, total ramené sur 20).' }),
    hint: str(), explanation: md,
    corr: md, // calque _Corr, réservé enseignant
    demo: bool,
  };

  /* ---------- Types de blocs : champs propres, notation, forme de la réponse ---------- */
  const BLOCKS = {
    text: { family: 'contenu', graded: false, fields: { md }, required: ['md'] },
    image: { family: 'contenu', graded: false, fields: { src: str({ format: 'uri-or-data' }), caption: str(), alt: str() }, required: ['src'] },
    svg: { family: 'contenu', graded: false, fields: { svg: str(), caption: str() } },
    scan: { family: 'contenu', graded: false, fields: { title: str(), pages: arr(str({ format: 'uri-or-data' })), open: bool } },
    link: { family: 'contenu', graded: false, fields: { url: str({ format: 'uri' }), title: str(), text: str(), kind: str({ enum: ['link', 'video'] }) }, required: ['url'] },
    ressource: { family: 'contenu', graded: false, fields: { num: str(), title: str(), md, src: str(), svg: str(), caption: str(), qr: str(), qrLabel: str() } },
    mots: { family: 'contenu', graded: false, fields: { title: str(), items: arr(obj({ mot: str(), def: str() }, ['mot'])) } },
    objectif: { family: 'structure', graded: false, fields: { label: str(), md } },
    retenir: { family: 'structure', graded: false, fields: { title: str(), md } },
    decoupe: { family: 'structure', graded: false, fields: {} },
    filet: { family: 'structure', graded: false, fields: {} },
    qcm: { family: 'exercice', graded: true, fields: { options: arr(obj({ text: str(), correct: bool, feedback: str() }, ['text']), { minItems: 2 }), multiple: bool, shuffle: bool }, required: ['options'], answer: arr(num(), { description: 'indices des options cochées' }) },
    vraifaux: { family: 'exercice', graded: true, fields: { items: arr(obj({ text: str(), v: bool }, ['text', 'v'])), labels: arr(str()) }, required: ['items'], answer: obj({}, [], { description: '{ indice: "v" | "f" }' }) },
    cloze: { family: 'exercice', graded: true, fields: { text: str({ description: '[[réponse]] · [[a|b]] · [[!bonne|leurre]]' }), bank: any, bankExtra: arr(str()) }, required: ['text'], answer: arr(str()) },
    numeric: { family: 'exercice', graded: true, fields: { answer: num(), tolerance: num(), tolerancePct: num(), unit: str(), formula: str() }, required: ['answer'], answer: str() },
    match: { family: 'exercice', graded: true, fields: { pairs: arr(arr(str(), { minItems: 2, maxItems: 2 })), distractors: arr(str()) }, required: ['pairs'], answer: arr(str(), { description: 'élément de droite relié à chaque élément de gauche' }) },
    order: { family: 'exercice', graded: true, fields: { items: arr(str(), { minItems: 2 }) }, required: ['items'], answer: arr(num()) },
    sort: { family: 'exercice', graded: true, fields: { categories: arr(obj({ name: str(), items: arr(str()) }, ['name', 'items'])) }, required: ['categories'], answer: obj({}, [], { description: '{ idEtiquette: idZone }' }) },
    table: { family: 'exercice', graded: true, fields: { headers: arr(str()), rows: arr(arr({ anyOf: [str(), num(), { type: 'null' }, cellIn] })), bank: any, firstRowHead: bool }, required: ['rows'], answer: obj({}, [], { description: '{ "ligne-colonne": valeur }' }) },
    boxes: { family: 'exercice', graded: true, fields: { items: arr(obj({ top: { anyOf: [str(), cellIn] }, bottom: { anyOf: [str(), cellIn] } })), topLabel: str(), bottomLabel: str(), bank: any }, required: ['items'], answer: obj({}) },
    chain: { family: 'exercice', graded: true, fields: { items: arr(obj({ text: str(), slot: str({ enum: ['acquerir', 'traiter', 'communiquer', 'alimenter', 'distribuer', 'convertir', 'transmettre'] }) }, ['text', 'slot'])), infoIn: str(), infoOut: str(), energyIn: str(), action: str() }, required: ['items'], answer: obj({}) },
    label: { family: 'exercice', graded: true, fields: { src: str(), svg: str(), mode: str({ enum: ['liste', 'saisie'] }), points: arr(obj({ x: num({ minimum: 0, maximum: 100 }), y: num({ minimum: 0, maximum: 100 }), answer: alt }, ['x', 'y', 'answer'])), distractors: arr(str()), bank: bool }, required: ['points'], answer: arr(str()) },
    bits: { family: 'exercice', graded: true, fields: { weights: arr(num()), rows: arr(obj({ label: str(), bits: str({ pattern: '^[01]+$' }) }, ['label', 'bits'])), decimal: bool, showCard: bool }, required: ['rows'], answer: arr(obj({ bits: str(), dec: str() })) },
    graph: { family: 'exercice', graded: true, fields: { xmax: num(), ymax: num(), step: num(), unit: str(), tolerance: num(), connect: bool, showTable: bool, points: arr(obj({ name: str(), x: num(), y: num() }, ['name', 'x', 'y'])) }, required: ['points'], answer: arr(obj({ x: num(), y: num() })) },
    draw: { family: 'exercice', graded: true, review: true, fields: { bg: str(), ratio: num(), colors: arr(str()), straight: bool, grid: bool }, answer: obj({ strokes: arr(obj({ c: str(), w: num(), p: arr(arr(num())) })), png: str() }) },
    mindmap: { family: 'exercice', graded: true, fields: { center: str(), branches: arr(obj({ label: str(), n: num(), answers: arr(str()) }, ['label'])) }, required: ['branches'], answer: obj({}) },
    procedure: { family: 'exercice', graded: true, fields: { items: arr(obj({ text: str(), detail: md, image: str(), warn: str() }, ['text'])) }, required: ['items'], answer: obj({}) },
    questions: { family: 'exercice', graded: true, review: true, fields: { title: str(), mode: str({ enum: ['saisie', 'cahier'] }), items: arr({ anyOf: [str(), obj({ q: str(), corr: str(), n: str() }, ['q'])] }) }, required: ['items'], answer: obj({}) },
    report: { family: 'exercice', graded: true, review: true, fields: { placeholder: str(), photo: bool, rows: num() }, answer: obj({ text: str(), photos: arr(str()) }) },
    autoeval: { family: 'exercice', graded: false, fields: { items: arr(str()), scale: arr(str()) }, required: ['items'], answer: obj({}) },
    circuit: { family: 'simulation', graded: true, fields: { cols: num(), rows: num(), battery: num(), palette: obj({}), initial: obj({}, [], { description: '{ "h-L-C" | "v-L-C": composant }' }), goals: arr(obj({ type: str({ enum: ['switchControls', 'noShort', 'lit', 'parallel', 'series', 'eachSwitch', 'ledSafe', 'motorDir', 'darkOn', 'count'] }) }, ['type'])) }, answer: obj({ comps: obj({}) }) },
    blocks: { family: 'simulation', graded: true, fields: { scene: str({ enum: ['eclairage', 'portail', 'serre', 'parking', 'feux'] }), toolbox: arr(str()), vars: arr(str()), start: arr(obj({ op: str() }, ['op'])), tests: arr(obj({ name: str(), init: obj({}), steps: arr(obj({ set: obj({}), run: num(), expect: obj({}) })) }, ['name'])) }, required: ['scene'], answer: obj({ program: arr(obj({})) }) },
    code: { family: 'simulation', graded: true, review: true, fields: { board: str({ enum: ['uno', 'nano', 'esp32', 'esp32-mpy', 'microbit'] }), start: obj({}, [], { description: 'espace de travail Blockly sérialisé (JSON)' }), toolbox: arr(str()), expect: arr(str({ description: 'fragment attendu dans le code généré' })) }, required: ['board'], answer: obj({ workspace: obj({}), code: str(), uploaded: bool }) },
  };
  Object.values(BLOCKS).forEach((b) => { b.fields = Object.assign({}, COMMON, b.fields); });

  const STEP = obj({
    id: str(), title: str(),
    kind: str({ enum: ['feuille', 'ressource', 'synthese', 'evaluation'], description: 'Type de feuille de la charte : P, R, S, E.' }),
    seance: num({ minimum: 1 }), feuille: num({ minimum: 1 }), segpa: bool, verso: bool, big: bool,
    resume: str(), objectif: str(), consignes: str(), numStart: num(),
    blocks: arr({ $ref: 'Block' }),
  }, ['title', 'blocks']);

  const COMPETENCE = { anyOf: [str(), obj({ code: str({ pattern: '^T\\d' }), label: str(), color: str(), co: str(), sub: arr(obj({ code: str(), label: str() }, ['code', 'label'])) }, ['label'])] };

  const ENTITIES = {
    Workshop: obj({
      format: num({ enum: [1, 2] }), id: str({ pattern: '^[A-Za-z0-9-]+$' }), version: num({ minimum: 1 }),
      title: str(), level: str({ enum: ['college', 'sti2d', 'snt', 'pro'] }), niveau: str({ description: '5e, 4e, 3e… (couleur de pastille)' }),
      cycle: num(), seq: num({ description: 'numéro « AT SEQ »' }), duration: num(), author: str(), summary: str(),
      problematique: str(), objet: str(), position: num({ minimum: 0, maximum: 9 }),
      competences: arr(COMPETENCE), presentation: md, synthese: md, evaluation: md, differenciation: md, materiel: md,
      deroulement: arr(obj({ seance: str(), objectif: str(), activites: str(), ressources: str() })),
      prof: obj({ organisation: md, materiel: arr(obj({ seance: str(), contenu: str() })) }, [], { description: 'fiche professeur, jamais transmise aux élèves' }),
      steps: arr({ $ref: 'Step' }),
      updatedAt: num(),
    }, ['id', 'title', 'steps']),
    Step: STEP,
    Answer: obj({
      value: any, done: bool, correct: bool, score: num({ minimum: 0, maximum: 1 }), attempts: num({ minimum: 0 }), revealed: bool,
      at: num({ description: 'horodatage ms (règle de fusion)' }), pendingReview: bool,
      teacher: obj({ grade: str(), comment: str(), by: str(), at: num() }),
    }),
    Progress: obj({ wid: str(), step: num(), answers: obj({}, [], { additionalProperties: { $ref: 'Answer' } }), seen: obj({}), startedAt: num(), updatedAt: num(), completedAt: num() }, ['wid', 'answers']),
    State: obj({ progress: obj({}, [], { additionalProperties: { $ref: 'Progress' } }), profile: obj({ name: str() }) }, ['progress']),
    Session: obj({ ok: bool, classe: str(), eleve: str({ description: 'numéro dans la classe, ex. « 07 » (aucun nom sur le serveur)' }), identifiant: str({ description: 'ex. 4C-LHA-LoutreAgile' }), jeton: str(), expire: num(), espace: obj({ utilise: num(), quota: num() }) }, ['classe', 'eleve', 'jeton'], { description: 'réponse de login.php / session.php' }),
    Ressource: obj({ nom: str({ description: '<atelier>.technostudio.json (ou .gift / .txt GIFT)' }), taille: num(), type: str(), maj: num() }, ['nom', 'maj'], { description: 'fichier déposé par l’enseignant (ressources.php) : un Workshop, un Workshop[] ou un Package' }),
    Activite: obj({ id: str({ pattern: '^[A-Za-z0-9_./-]+$', description: '<atelier>/<code feuille>, ex. charte-lampe-de-poche/P1' }), titre: str(), groupe: str(), total: num() }, ['id'], { description: 'colonne du tableau de suivi (activites.php)' }),
    ProgressionEnvoi: obj({ activite: str(), titre: str(), statut: str({ enum: ['commence', 'termine'] }), faites: num(), total: num(), score: num(), score_max: num(), details: obj({ feuille: str(), reponses: arr(obj({ q: str(), type: str(), r: str(), note: str(), aCorriger: bool })) }, [], { description: '20 Ko au plus' }) }, ['activite'], { description: 'avancement d’une feuille (progression.php) ; la Centrale garde le meilleur' }),
    CompilationDemande: obj({ carte: str({ enum: ['uno', 'nano', 'esp32'] }), code: str({ description: 'C++ Arduino, 100 Ko au plus ; seules les bibliothèques connues peuvent être incluses' }) }, ['carte', 'code']),
    CompilationReponse: obj({ ok: bool, journal: str(), erreur: str(), format: str({ enum: ['hex', 'bin'] }), hex: str(), images: arr(obj({ adresse: num(), donnees: str({ description: 'base64' }) })), duree: num(), cache: bool }, ['ok']),
    Package: obj({ workshops: arr({ $ref: 'Workshop' }), classes: arr(str()) }, ['workshops'], { description: 'paquet de plusieurs ateliers (.technostudio.json)' }),
  };

  const STORAGE = {
    app: {
      engine: 'IndexedDB « technostudio », magasin « kv » (repli en mémoire si indisponible)',
      keys: {
        profile: 'profil local { name, role: "eleve"|"prof", classe } — le nom ne quitte jamais l’appareil',
        'ws:<id>': 'Workshop modifié, importé ou reçu de la Centrale (source « centrale ») ; les démos intégrées ne sont pas stockées',
        'pg:<id>': 'Progress de l’élève pour l’atelier <id> (copie de travail, même hors ligne)',
        'centrale:ressources:<serveur><app>': '{ <nom de ressource>: { maj, ids[] } } : ressources déjà reçues',
        'code:projet': 'projet libre de l’atelier Code { board, ws, at }',
        'ui:panels': 'disposition des panneaux flottants (par mode)',
      },
      rules: [
        'Chaque réponse est écrite immédiatement dans IndexedDB, puis envoyée à la Centrale si l’élève est connecté.',
        'Un atelier de démonstration modifié devient une copie locale avec un nouvel id.',
        'Les champs inconnus d’un atelier reçu sont conservés tels quels à la réexportation.',
        'Réglages du navigateur (localStorage) : ts-centrale (adresse), ts-app (atelier), ts-compilateur (serveur de compilation).',
      ],
    },
    centrale: {
      engine: 'Centrale élèves (PHP + SQLite, alwaysdata) : données JSON par élève, par atelier (app) et par clé ; 2 Mo par clé ; 10 versions d’historique',
      keys: {
        'app': 'identifiant de l’atelier dans la Centrale : « technostudio » par défaut, ou la valeur de ?app= (ex. technostudio-5e)',
        'donnees at/<id atelier>': 'Progress de l’élève pour cet atelier (fusionné réponse par réponse)',
        'donnees code/projet': 'projet libre de l’atelier Code',
        'ressources (*.technostudio.json, *.gift)': 'ateliers déposés par l’enseignant pour cet app, reçus à la connexion',
        'progression <id atelier>/<code feuille>': 'ProgressionEnvoi : faites/total, score/score_max, statut, réponses à corriger dans details',
        'activites': 'Activite[] : une colonne par feuille notée des ateliers reçus (sinon des ateliers du poste)',
      },
    },
  };

  const SYNC = {
    summary: 'L’appli garde la main hors ligne. Connecté, chaque modification est envoyée par le module centrale-client.js (regroupée toutes les 3 s), avec la date de la version lue : la Centrale refuse d’écraser un travail plus récent (409).',
    steps: [
      'Connexion : code élève (login.php) ou jeton transmis par le portail (#centrale=…, session.php).',
      'Réception : ressources.php → chaque fichier nouveau ou modifié (maj) est lu, validé avec ce descripteur, puis enregistré (ws:<id>, source « centrale ») ; les ressources retirées font disparaître leurs ateliers.',
      'Chargement : donnees.php (liste) → pour chaque clé at/<id>, la copie du serveur est fusionnée avec celle du poste ; le résultat est renvoyé s’il diffère.',
      'Fusion : réponse par réponse, celle dont « at » est le plus récent gagne ; « seen » est uni ; « step » suit la copie la plus récente.',
      'À chaque réponse : sauver(at/<id>, Progress) puis, 4 s plus tard, progression.php pour chaque feuille notée modifiée.',
      'Conflit (409, travail modifié sur un autre poste) : relire, fusionner, renvoyer.',
    ],
    triggers: ['après chaque réponse (regroupé 3 s)', 'au retour du réseau (le module renvoie la copie de secours)', 'à la fermeture de l’onglet (dernier envoi)', 'menu Centrale → Enregistrer et recharger'],
    conflicts: 'Deux postes qui répondent au même bloc : la réponse la plus récente gagne, l’autre est perdue pour ce bloc seulement. L’enseignant peut restaurer une version (historique de la Centrale).',
  };

  const AUTH = {
    jeton: 'En-tête X-Jeton: <jeton> fourni par le module de la Centrale (formulaire Centrale.afficherConnexion ou jeton du portail). Les codes élèves sont gérés par la Centrale seule.',
    site: 'Origine du site autorisée dans la Centrale (Réglages → Sites autorisés), sinon 403.',
    compilation: 'Serveur de compilation : X-Jeton de la Centrale (vérifié auprès d’elle, gardé 20 min) ou X-Cle enseignant ; OUVERT=1 sur un réseau local seulement.',
    none: 'Sans authentification.',
    local: 'Pont local (127.0.0.1:8765) : origine autorisée (localhost, réseau local, site de l’appli) ; aucun compte.',
  };

  const C = '<Centrale>/api/';
  const ENDPOINTS = [
    { method: 'GET', path: C, auth: 'none', response: '{ ok, service: "centrale-eleves", version }' },
    { method: 'POST', path: C + 'login.php', auth: 'site', request: '{ code, app }', response: 'Session', errors: { 401: 'code inconnu', 403: 'site non autorisé', 429: 'trop d’essais' } },
    { method: 'GET', path: C + 'session.php?app=', auth: 'jeton', response: 'Session (passage depuis le portail)' },
    { method: 'POST', path: C + 'deconnexion.php', auth: 'jeton' },
    { method: 'GET', path: C + 'ressources.php?app=', auth: 'jeton', response: '{ ressources: Ressource[] }' },
    { method: 'GET', path: C + 'ressources.php?app=&nom=', auth: 'jeton', response: 'le fichier (atelier JSON ou GIFT)' },
    { method: 'GET', path: C + 'donnees.php?app=', auth: 'jeton', response: '{ cles: [{ cle, taille, maj }] }' },
    { method: 'GET', path: C + 'donnees.php?app=&cle=at/<id>', auth: 'jeton', response: '{ existe, valeur: Progress, maj }' },
    { method: 'POST', path: C + 'donnees.php', auth: 'jeton', request: '{ app, cle: "at/<id>", valeur: Progress, base }', response: '{ maj, espace }', errors: { 409: 'plus récent sur le serveur : relire et fusionner', 413: '2 Mo au plus', 507: 'espace plein' } },
    { method: 'POST', path: C + 'progression.php', auth: 'jeton', request: '{ app } & ProgressionEnvoi', response: '{ progression }', errors: { 413: 'details > 20 Ko' } },
    { method: 'POST', path: C + 'activites.php', auth: 'jeton', request: '{ app, activites: Activite[] }' },
    { method: 'POST', path: C + 'surnom.php', auth: 'jeton', request: '{ surnom }', response: '{ identifiant, surnom }' },
    { method: 'GET', path: '<compilation>/etat', auth: 'none', response: '{ version, arduinoCli, cartes: { uno|nano|esp32: { installee } }, auth, file }', note: 'serveur de compilation (serveur-compilation/serveur.js)' },
    { method: 'POST', path: '<compilation>/compiler', auth: 'compilation', request: 'CompilationDemande', response: 'CompilationReponse', errors: { 400: 'code refusé (directive ou bibliothèque non autorisée)', 401: 'non connecté', 429: '12 compilations par minute au plus', 503: 'serveur occupé ou carte non installée' } },
    { method: 'GET', path: 'http://127.0.0.1:8765/status', auth: 'local', response: '{ pont, arduinoCli, mpremote, cores }', note: 'pont local d’un poste équipé (facultatif)' },
    { method: 'GET', path: 'http://127.0.0.1:8765/ports', auth: 'local', response: '{ ports: { address, label, board?, fqbn? }[] }' },
    { method: 'POST', path: 'http://127.0.0.1:8765/compile', auth: 'local', request: '{ board, fqbn, code }', response: '{ ok, log, size? }' },
    { method: 'POST', path: 'http://127.0.0.1:8765/upload', auth: 'local', request: '{ board, fqbn, code, port, lang }', response: '{ ok, log }' },
  ];

  const COMPAT = {
    header: 'Chaque atelier porte son numéro de format (champ « format ») ; l’appli lit les formats ' + '1 et 2.',
    rules: [
      'Même format majeur : échange normal. Champs inconnus : conservés, jamais supprimés.',
      'Type de bloc inconnu côté cible : affiché comme « champ inconnu », la réponse est conservée, il ne compte pas dans le score.',
      'Atelier de format supérieur : accepté en lecture si validate() ne signale pas d’erreur bloquante, sinon ignoré avec la liste des écarts.',
      'Les identifiants (atelier, feuille, bloc) ne changent jamais d’une version à l’autre : sinon la progression des élèves est perdue.',
      'Les clés de la Centrale (at/<id>, code/projet) et les identifiants d’activité (<atelier>/<code feuille>) sont stables : les renommer ferait perdre le travail ou le suivi.',
    ],
  };

  /* ---------- Validateur (sous-ensemble de JSON Schema) ---------- */
  function check(schema, v, path, errs, defs) {
    if (!schema || v === undefined) return;
    if (schema.$ref) return check(defs[schema.$ref], v, path, errs, defs);
    if (schema.anyOf) { if (!schema.anyOf.some((s) => { const e = []; check(s, v, path, e, defs); return !e.length; })) errs.push(path + ' : forme inattendue'); return; }
    const t = schema.type;
    const typeOk = !t || (t === 'array' ? Array.isArray(v) : t === 'null' ? v === null : t === 'object' ? v && typeof v === 'object' && !Array.isArray(v) : typeof v === t);
    if (!typeOk) { errs.push(path + ' : ' + t + ' attendu'); return; }
    if (schema.enum && !schema.enum.includes(v)) errs.push(path + ' : valeur « ' + v + ' » hors de ' + schema.enum.join(', '));
    if (schema.pattern && typeof v === 'string' && !new RegExp(schema.pattern).test(v)) errs.push(path + ' : format invalide');
    if (typeof v === 'number') { if (schema.minimum != null && v < schema.minimum) errs.push(path + ' : < ' + schema.minimum); if (schema.maximum != null && v > schema.maximum) errs.push(path + ' : > ' + schema.maximum); }
    if (t === 'array') { if (schema.minItems && v.length < schema.minItems) errs.push(path + ' : au moins ' + schema.minItems + ' élément(s)'); v.forEach((x, i) => check(schema.items, x, path + '[' + i + ']', errs, defs)); }
    if (t === 'object') {
      (schema.required || []).forEach((k) => { if (v[k] === undefined || v[k] === null || v[k] === '') errs.push(path + '.' + k + ' : obligatoire'); });
      for (const k in schema.properties || {}) check(schema.properties[k], v[k], path + '.' + k, errs, defs);
      if (schema.additionalProperties) for (const k in v) if (!(k in (schema.properties || {}))) check(schema.additionalProperties, v[k], path + '.' + k, errs, defs);
    }
  }
  function blockSchema(b) {
    const def = BLOCKS[b && b.type];
    if (!def) return null;
    return obj(def.fields, ['type'].concat(def.required || []));
  }
  function validate(entity, data) {
    const errors = [], warnings = [];
    const defs = Object.assign({}, ENTITIES, { Block: { type: 'object', required: ['type'] } });
    if (entity === 'Package') { (data && data.workshops || []).forEach((w, i) => { const r = validate('Workshop', w); r.errors.forEach((e) => errors.push('workshops[' + i + ']' + e.slice(1))); r.warnings.forEach((e) => warnings.push('workshops[' + i + ']' + e.slice(1))); }); if (!data || !Array.isArray(data.workshops)) errors.push('$.workshops : liste attendue'); return { ok: !errors.length, errors, warnings }; }
    check(ENTITIES[entity], data, '$', errors, defs);
    if (entity === 'Workshop' && data && Array.isArray(data.steps)) {
      const ids = new Set();
      data.steps.forEach((s, si) => (s.blocks || []).forEach((b, bi) => {
        const p = '$.steps[' + si + '].blocks[' + bi + ']';
        if (b.id) { if (ids.has(b.id)) errors.push(p + '.id : « ' + b.id + ' » en double'); ids.add(b.id); }
        const sch = blockSchema(b);
        if (!sch) { warnings.push(p + ' : type « ' + (b && b.type) + ' » inconnu (conservé, non noté)'); return; }
        check(sch, b, p, errors, defs);
      }));
      if (data.format && data.format > FORMAT) warnings.push('$.format : ' + data.format + ' plus récent que ' + FORMAT + ' (lecture seule conseillée)');
    }
    return { ok: !errors.length, errors, warnings };
  }

  const FORMAT = 2;
  return {
    name: 'technostudio-passerelle', version: '3.0.0', format: FORMAT, formatsAccepted: [1, 2],
    roles: { centralisatrice: 'la Centrale élèves : codes, portail, ressources (ateliers), sauvegarde, progression et suivi', cible: 'TechnoStudio (et tout outil qui produit des ateliers pour lui) : lecture des ateliers, travail des élèves, compte rendu d’avancement' },
    entities: ENTITIES, blocks: BLOCKS, common: COMMON, storage: STORAGE, sync: SYNC, auth: AUTH, endpoints: ENDPOINTS, compatibility: COMPAT,
    validate, blockSchema,
  };
});
