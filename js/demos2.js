/* TechnoStudio — ateliers au format de la charte (modèle Affinity « AT_Exemple_Charte_Atelier »). */
(function () {
  'use strict';
  const TL = window.TL;

  const LAMPE_SVG = `<svg viewBox="0 0 420 170" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="52" width="250" height="82" rx="22" fill="#E9EEF8" stroke="#22348F" stroke-width="4"/>
    <rect x="40" y="70" width="88" height="46" rx="8" fill="#3a3f4b"/><text x="84" y="99" font-family="Arial" font-weight="700" font-size="13" fill="#fff" text-anchor="middle">1,5 V</text>
    <rect x="134" y="70" width="88" height="46" rx="8" fill="#3a3f4b"/><text x="178" y="99" font-family="Arial" font-weight="700" font-size="13" fill="#fff" text-anchor="middle">1,5 V</text>
    <rect x="127" y="86" width="6" height="14" fill="#c9c9c9"/><rect x="221" y="86" width="6" height="14" fill="#c9c9c9"/>
    <rect x="132" y="30" width="44" height="22" rx="4" fill="#E53935" stroke="#22348F" stroke-width="2"/>
    <line x1="154" y1="52" x2="154" y2="74" stroke="#22348F" stroke-width="2"/>
    <path d="M268 60 L320 30 L320 156 L268 126 Z" fill="#fff" stroke="#22348F" stroke-width="4"/>
    <line x1="228" y1="93" x2="282" y2="93" stroke="#E53935" stroke-width="2.5"/>
    <circle cx="290" cy="93" r="10" fill="#FFD23F" stroke="#C99A00" stroke-width="2"/>
    <g stroke="#F5B400" stroke-width="4" stroke-linecap="round"><line x1="334" y1="50" x2="372" y2="38"/><line x1="334" y1="78" x2="378" y2="74"/><line x1="334" y1="106" x2="378" y2="112"/><line x1="334" y1="134" x2="372" y2="148"/></g>
  </svg>`;

  const SYMBOLES_SVG = `<svg viewBox="0 0 520 110" xmlns="http://www.w3.org/2000/svg" font-family="Arial" font-size="15" fill="#22348F">
    <g stroke="#22348F" stroke-width="3" fill="none">
      <line x1="10" y1="40" x2="48" y2="40"/><line x1="48" y1="22" x2="48" y2="58"/><line x1="60" y1="30" x2="60" y2="50" stroke-width="7"/><line x1="60" y1="40" x2="100" y2="40"/>
      <line x1="140" y1="40" x2="170" y2="40"/><circle cx="172" cy="40" r="3" fill="#22348F"/><line x1="172" y1="40" x2="200" y2="24"/><circle cx="206" cy="40" r="3" fill="#22348F"/><line x1="206" y1="40" x2="236" y2="40"/>
      <line x1="280" y1="40" x2="310" y2="40"/><path d="M310 26 L334 40 L310 54 Z" fill="#22348F"/><line x1="334" y1="26" x2="334" y2="54"/><line x1="334" y1="40" x2="364" y2="40"/><path d="M322 22 l8 -10 M330 12 h-5 M330 12 v5 M332 26 l8 -10 M340 16 h-5 M340 16 v5" stroke-width="2"/>
      <line x1="410" y1="40" x2="500" y2="40"/>
    </g>
    <text x="55" y="90" text-anchor="middle">pile</text><text x="188" y="90" text-anchor="middle">interrupteur</text><text x="322" y="90" text-anchor="middle">DEL</text><text x="455" y="90" text-anchor="middle">fil</text>
  </svg>`;

  const lampe = {
    id: 'charte-lampe-de-poche', format: 2, version: 2, title: 'Exemple : la lampe de poche', level: 'college', niveau: '5e', cycle: 4, seq: 1, duration: 220, author: 'Charte TechnoStudio',
    summary: 'découvrir comment fonctionne une lampe de poche, repérer ses constituants et décrire le trajet de l’énergie, sur papier et sur ordinateur.',
    problematique: 'Comment une lampe de poche transforme-t-elle l’énergie des piles en lumière ?',
    objet: 'Lampe de poche', position: 2,
    competences: [
      { code: 'T2C1', color: '#C45CCE', label: 'Décrire et caractériser l’organisation interne d’un objet et ses échanges avec son environnement (énergies, données)', co: 'Constituants, fonctions. Chaîne d’énergie : alimenter, distribuer, convertir. Formes d’énergie.', sub: [{ code: 'T2C11', label: 'Identifier les constituants de la chaîne d’énergie et leurs fonctions' }, { code: 'T2C12', label: 'Identifier les constituants d’un objet réel et les associer à leur fonction' }, { code: 'T2C13', label: 'Représenter un circuit électrique simple avec des symboles' }] },
      { code: 'T3C2', color: '#E8B624', label: 'Valider les solutions techniques par des simulations ou des protocoles de tests', co: 'Simulation, mesure, rendement (énergie utile / perdue).', sub: [{ code: 'T3C21', label: 'Simuler le circuit et relever tension et intensité' }, { code: 'T3C22', label: 'Comparer les performances LED / ampoule' }] },
      { code: 'T2C2', color: '#C45CCE', label: 'Identifier un dysfonctionnement d’un objet technique et y remédier', co: 'Panne, cause, protocole de vérification.', sub: [{ code: 'T2C21', label: 'Trouver la cause d’une panne de lampe et proposer une solution' }] },
    ],
    presentation: 'Les élèves observent une lampe de poche, repèrent ses constituants, décrivent le trajet de l’énergie et comparent LED et ampoule, sur papier et sur ordinateur.',
    synthese: 'Constituants et fonctions ; chaîne d’énergie (alimenter, distribuer, convertir) ; énergie utile et énergie perdue.',
    evaluation: 'Évaluation écrite /20 sans ordinateur, recto verso, avec la ressource évaluation (documents A, B, C).',
    deroulement: [
      { seance: 'Séance 1', objectif: 'Découvrir la lampe', activites: 'Observation, constituants, fonctions', ressources: 'Ressources 1, 3' },
      { seance: 'Séance 2', objectif: 'Le trajet de l’énergie', activites: 'Chaîne d’énergie, schéma électrique', ressources: 'Ressources 2, 3, simulation' },
      { seance: 'Séance 3', objectif: 'LED ou ampoule ?', activites: 'Comparer, mesurer, conclure', ressources: 'Ressource 4' },
      { seance: 'Séance 4', objectif: 'Faire le bilan', activites: 'Synthèse et évaluation', ressources: 'S01, E01 / E02, R02' },
    ],
    differenciation: 'Version SEGPA : mêmes séances et mêmes postes ORDI, consignes courtes, banque de mots, « À retenir » dans chaque partie.',
    materiel: 'Une lampe de poche démontable par îlot ; fichier de simulation Lampe_simulation ; une lampe à LED et une lampe à ampoule.',
    steps: [
      { id: 'p01', title: 'Séance 1 - Feuille 1', kind: 'feuille', seance: 1, feuille: 1, blocks: [
        { id: 'p01-1', type: 'label', mode: 'saisie', tag: 'papier', comp: ['T2C12'], bareme: 4, question: 'Observe la lampe (**ressource 1**) et écris le nom des constituants.', svg: LAMPE_SVG, points: [{ x: 36.7, y: 24, answer: 'interrupteur' }, { x: 13, y: 44, answer: 'pile|piles|les piles' }, { x: 69, y: 54.7, answer: 'LED|DEL|diode' }, { x: 74, y: 21, answer: 'réflecteur|reflecteur' }], corr: '1 interrupteur · 2 pile · 3 LED · 4 réflecteur' },
        { id: 'p01-f1', type: 'filet' },
        { id: 'p01-2s', type: 'circuit', demo: true, tag: 'ordi', question: 'Ouvre **Lampe_simulation**, ferme l’interrupteur et observe la lampe.', cols: 5, rows: 3, initial: { 'v-0-0': { type: 'battery', v: 3, label: 'G1' }, 'v-1-0': { type: 'wire' }, 'h-0-0': { type: 'wire' }, 'h-0-1': { type: 'switch', closed: false, label: 'K1' }, 'h-0-2': { type: 'wire' }, 'h-0-3': { type: 'wire' }, 'v-0-4': { type: 'wire' }, 'v-1-4': { type: 'wire' }, 'h-2-0': { type: 'wire' }, 'h-2-1': { type: 'resistor', r: 47, label: 'R1' }, 'h-2-2': { type: 'led', color: 'yellow', label: 'D1' }, 'h-2-3': { type: 'wire' } } },
        { id: 'p01-2', type: 'table', num: '', tag: 'ordi', comp: ['T2C11'], question: 'Complète les cases.', headers: ['Énergie qui entre', 'Énergie utile', 'Énergie perdue'], rows: [[{ a: 'électrique|electrique|énergie électrique' }, { a: 'lumineuse|lumière|énergie lumineuse' }, { a: 'thermique|chaleur|énergie thermique' }]] },
        { id: 'p01-2t', type: 'text', md: '*Pas d’ordinateur ? La **ressource 2** donne le résultat de la simulation.*' },
        { id: 'p01-q1', type: 'questions', items: [{ q: 'Quelle pièce fournit l’énergie à la lampe ?', corr: 'Les piles.' }, { q: 'Quelle énergie est utile ? Laquelle est perdue ?', corr: 'Utile : lumineuse ; perdue : thermique.' }, { q: 'À quoi sert l’interrupteur ?', corr: 'Il ouvre ou ferme le circuit : il commande le courant.' }] },
        { id: 'p01-d1', type: 'decoupe' },
        { id: 'p01-3', type: 'table', tag: 'papier', comp: ['T2C11'], question: 'Complète le tableau avec les mots : **piles – LED – interrupteur – boîtier**.', headers: ['Fonction', 'Constituant'], rows: [['Fournir l’énergie', { a: 'piles|les piles' }], ['Commander le courant', { a: 'interrupteur|l’interrupteur' }], ['Produire la lumière', { a: 'LED|la LED|DEL' }], ['Protéger et tenir les pièces', { a: 'boîtier|boitier|le boîtier' }]] },
        { id: 'p01-f2', type: 'filet' },
        { id: 'p01-4', type: 'boxes', tag: 'papier', comp: ['T2C11'], question: 'Complète la chaîne d’énergie : fonction puis constituant.', topLabel: 'fonction', bottomLabel: 'constituant', items: [{ top: { a: 'alimenter' }, bottom: { a: 'piles|les piles' } }, { top: { a: 'distribuer' }, bottom: { a: 'interrupteur' } }, { top: { a: 'convertir' }, bottom: { a: 'LED|DEL' } }] },
        { id: 'p01-q2', type: 'questions', items: [{ q: 'Pourquoi la lampe chauffe-t-elle un peu ?', corr: 'Une partie de l’énergie électrique est convertie en chaleur : c’est de l’énergie perdue.' }, { q: 'Que se passe-t-il si on enlève une pile ?', corr: 'Le circuit est ouvert : la lampe s’éteint.' }] },
      ] },
      { id: 'p02', title: 'Séance 2 - Feuille 2', kind: 'feuille', seance: 2, feuille: 2, blocks: [
        { id: 'p02-1', type: 'match', tag: 'papier', comp: ['T2C11'], question: 'Relie chaque constituant à l’énergie qu’il fournit, transporte ou produit.', pairs: [['la pile', 'énergie chimique'], ['la LED', 'énergie lumineuse'], ['le fil électrique', 'énergie électrique']] },
        { id: 'p02-q1', type: 'questions', items: [{ q: 'Quelle énergie est stockée dans la pile ?', corr: 'L’énergie chimique.' }] },
        { id: 'p02-d1', type: 'decoupe' },
        { id: 'p02-2s', type: 'circuit', demo: true, tag: 'ordi', question: 'Dans **Lampe_simulation**, ouvre puis ferme l’interrupteur : touche la lampe pour lire la tension et l’intensité.', cols: 5, rows: 3, initial: { 'v-0-0': { type: 'battery', v: 3, label: 'G1' }, 'v-1-0': { type: 'wire' }, 'h-0-0': { type: 'wire' }, 'h-0-1': { type: 'switch', closed: true, label: 'K1' }, 'h-0-2': { type: 'wire' }, 'h-0-3': { type: 'wire' }, 'v-0-4': { type: 'wire' }, 'v-1-4': { type: 'wire' }, 'h-2-0': { type: 'wire' }, 'h-2-1': { type: 'wire' }, 'h-2-2': { type: 'lamp', r: 15, label: 'L1' }, 'h-2-3': { type: 'wire' } } },
        { id: 'p02-2', type: 'table', num: '', tag: 'ordi', comp: ['T3C21', 'T3C22'], question: 'Relève les mesures et complète le tableau.', headers: ['Situation', 'Tension (V)', 'Intensité (A)', 'La lampe éclaire ?'], rows: [['Interrupteur ouvert', { a: '0' }, { a: '0' }, { a: 'non', choices: ['oui', 'non'] }], ['Interrupteur fermé', { a: '2,9|2.9|3|2,90' }, { a: '0,19|0.19|0,2|0.2' }, { a: 'oui', choices: ['oui', 'non'] }], ['Une pile retirée', { a: '0' }, { a: '0' }, { a: 'non', choices: ['oui', 'non'] }]] },
        { id: 'p02-2t', type: 'text', md: '*Pas d’ordinateur ? Lis les valeurs dans la **ressource 2**.*' },
        { id: 'p02-q2', type: 'questions', items: [{ q: 'Que vaut l’intensité quand le circuit est ouvert ? Pourquoi ?', corr: '0 A : le courant ne circule pas dans un circuit ouvert.' }] },
        { id: 'p02-d2', type: 'decoupe' },
        { id: 'p02-3', type: 'draw', tag: 'papier', comp: ['T2C13'], question: '**Dessine** le schéma électrique de la lampe avec les bons symboles (ressource 2) : pile, interrupteur, DEL, fils.', straight: true, corr: 'Boucle fermée : pile – interrupteur – DEL, symboles normalisés.' },
      ] },
      { id: 'r01', title: 'Ressources 1 à 4', kind: 'ressource', blocks: [
        { id: 'r01-1', type: 'ressource', num: '1', title: 'La lampe de poche : ses constituants', svg: LAMPE_SVG, md: '- **interrupteur** : ouvre ou ferme le circuit ;\n- **réflecteur** : renvoie la lumière vers l’avant ;\n- **LED** : produit la lumière ;\n- **piles** : stockent l’énergie ;\n- **boîtier** : protège les pièces.' },
        { id: 'r01-2', type: 'ressource', num: '2', title: 'Résultats de la simulation et symboles électriques', md: '| Situation | Tension (V) | Intensité (A) | La lampe éclaire ? |\n|---|---|---|---|\n| Interrupteur ouvert | 0 | 0 | non |\n| Interrupteur fermé | 3 | 0,2 | oui |\n| Une pile retirée | 0 | 0 | non |', svg: SYMBOLES_SVG },
        { id: 'r01-3', type: 'ressource', num: '3', title: 'La chaîne d’énergie', md: '**ALIMENTER** → **DISTRIBUER** → **CONVERTIR**\n\n- les **piles** : énergie chimique → électrique ;\n- l’**interrupteur** laisse passer ou non le courant ;\n- la **LED** : électrique → lumineuse (+ un peu de chaleur).' },
        { id: 'r01-4', type: 'ressource', num: '4', title: 'LED ou ampoule ? Où va l’énergie', md: '| | Lumière (utile) | Chaleur (perdue) |\n|---|---|---|\n| LED | 80 % | 20 % |\n| Ampoule à filament | 10 % | 90 % |\n\nLa **LED** transforme plus d’énergie en lumière : elle consomme moins pour éclairer autant.', qr: '#circuit', qrLabel: 'Simulation en ligne' },
        { id: 'r01-5', type: 'mots', items: [{ mot: 'constituant', def: 'une pièce de l’objet' }, { mot: 'fonction', def: 'ce à quoi sert une pièce' }, { mot: 'circuit fermé', def: 'le courant peut faire le tour complet' }, { mot: 'énergie perdue', def: 'énergie qui ne sert pas à l’usage voulu (souvent de la chaleur)' }] },
      ] },
      { id: 's01', title: 'Synthèse', kind: 'synthese', seance: 4, blocks: [
        { id: 's01-1', type: 'cloze', tag: 'none', bank: true, question: 'Complète la synthèse.', text: 'Les [[piles]] stockent de l’énergie [[chimique]]. L’[[interrupteur]] ouvre ou ferme le circuit. La [[LED]] convertit l’énergie [[électrique|electrique]] en énergie [[lumineuse]] ; une partie est perdue en [[chaleur]].' },
        { id: 's01-f1', type: 'filet' },
        { id: 's01-2', type: 'mindmap', tag: 'none', question: 'Complète la carte mentale.', center: 'LA LAMPE DE POCHE', branches: [{ label: 'Constituants', answers: ['piles', 'LED|DEL'] }, { label: 'Énergies', answers: ['chimique', 'lumineuse'] }, { label: 'Chaîne d’énergie', answers: ['alimenter', 'convertir'] }, { label: 'Efficacité', n: 2 }] },
        { id: 's01-f2', type: 'filet' },
        { id: 's01-3', type: 'autoeval', tag: 'none', question: 'Je fais le point : je colorie un rond par ligne.', items: ['Je sais nommer les constituants de la lampe.', 'Je sais donner la fonction de chaque constituant.', 'Je sais décrire la chaîne d’énergie.', 'Je sais expliquer pourquoi la LED chauffe moins.'] },
        { id: 's01-f3', type: 'filet' },
        { id: 's01-4', type: 'questions', title: 'En une phrase : à quoi sert chaque constituant de la lampe ?', items: [{ q: 'Ma phrase :' }] },
      ] },
      { id: 'e01', title: 'Évaluation (recto)', kind: 'evaluation', consignes: 'Sans ordinateur. Utilise la **ressource évaluation** (documents A, B, C).', blocks: [
        { id: 'e01-1', type: 'label', mode: 'saisie', bareme: 4, comp: ['T2C12'], question: 'Écris le nom des constituants numérotés.', svg: LAMPE_SVG, points: [{ x: 36.7, y: 24, answer: 'interrupteur' }, { x: 13, y: 44, answer: 'pile|piles' }, { x: 69, y: 54.7, answer: 'LED|DEL' }, { x: 74, y: 21, answer: 'réflecteur|reflecteur' }] },
        { id: 'e01-f1', type: 'filet' },
        { id: 'e01-2', type: 'table', bareme: 3, comp: ['T2C11'], question: 'Document A : complète le tableau.', headers: ['Constituant', 'Énergie reçue', 'Énergie produite'], rows: [['La pile', '—', { a: 'électrique|electrique' }], ['La LED', { a: 'électrique|electrique' }, { a: 'lumineuse|lumineuse et thermique' }]] },
        { id: 'e01-f2', type: 'filet' },
        { id: 'e01-3', type: 'boxes', bareme: 3, comp: ['T2C11'], question: 'Complète la chaîne d’énergie : fonction puis constituant.', items: [{ top: { a: 'alimenter' }, bottom: { a: 'piles' } }, { top: { a: 'distribuer' }, bottom: { a: 'interrupteur' } }, { top: { a: 'convertir' }, bottom: { a: 'LED|DEL' } }] },
        { id: 'e01-f3', type: 'filet' },
        { id: 'e01-4', type: 'draw', bareme: 4, comp: ['T2C13'], question: 'Dessine le schéma électrique de la lampe (circuit fermé).', straight: true },
      ] },
      { id: 'e02', title: 'Évaluation (verso)', kind: 'evaluation', verso: true, numStart: 5, blocks: [
        { id: 'e02-5', type: 'vraifaux', bareme: 2, comp: ['T2C11'], question: 'Vrai ou faux ? Coche la bonne case.', items: [{ text: 'La pile transforme l’énergie chimique en énergie électrique.', v: true }, { text: 'L’interrupteur fermé laisse passer le courant.', v: true }, { text: 'La LED produit aussi un peu de chaleur.', v: true }, { text: 'Le réflecteur produit de la lumière.', v: false }] },
        { id: 'e02-f1', type: 'filet' },
        { id: 'e02-6', type: 'table', bareme: 2, comp: ['T3C22'], question: 'Document B : compare les deux lampes.', headers: ['Question', 'Réponse'], rows: [['Quelle lampe transforme le plus d’énergie en lumière ?', { a: 'LED|la LED|lampe à LED', choices: ['LED', 'ampoule'] }], ['Quelle lampe chauffe le plus ?', { a: 'ampoule', choices: ['LED', 'ampoule'] }], ['Quelle lampe choisir pour économiser les piles ?', { a: 'LED', choices: ['LED', 'ampoule'] }]] },
        { id: 'e02-f2', type: 'filet' },
        { id: 'e02-7', type: 'questions', bareme: 1, comp: ['T2C21'], title: 'Panne : la lampe ne s’allume pas. Donne une cause possible et une solution (document C).', items: [{ q: 'Cause possible :', corr: 'Piles usées ou pile à l’envers.' }, { q: 'Solution :', corr: 'Remplacer les piles / les remettre dans le bon sens.' }] },
        { id: 'e02-f3', type: 'filet' },
        { id: 'e02-8', type: 'questions', bareme: 1, title: 'En une phrase : pourquoi choisir une lampe à LED ?', items: [{ q: 'Ma phrase :' }] },
        { id: 'e02-b', type: 'autoeval', question: 'Mon bilan (je colorie un rond).', items: ['Je connais les constituants de la lampe.', 'Je sais décrire la chaîne d’énergie.'] },
      ] },
      { id: 'sp01', title: 'SEGPA - Feuille 1', kind: 'feuille', seance: 1, feuille: 1, segpa: true, objectif: 'je sais nommer les pièces de la lampe et dire à quoi elles servent.', blocks: [
        { id: 'sp01-1', type: 'label', mode: 'saisie', bank: true, tag: 'papier', num: '1.1', comp: ['T2C12'], question: '**Observe** le dessin et **écris** le nom des pièces.', svg: LAMPE_SVG, points: [{ x: 36.7, y: 24, answer: 'interrupteur' }, { x: 13, y: 44, answer: 'piles|pile' }, { x: 69, y: 54.7, answer: 'LED' }] },
        { id: 'sp01-f1', type: 'filet' },
        { id: 'sp01-2', type: 'match', tag: 'papier', num: '1.2', comp: ['T2C11'], question: '**Relie** chaque pièce à ce qu’elle fait.', pairs: [['les piles', 'donnent l’énergie'], ['l’interrupteur', 'ouvre ou ferme le circuit'], ['la LED', 'fabrique la lumière']] },
        { id: 'sp01-q1', type: 'questions', title: 'Réponds dans ton cahier, sous la partie collée :', items: [{ q: 'Recopie : « Les piles donnent l’énergie à la lampe. »' }] },
        { id: 'sp01-d1', type: 'decoupe' },
        { id: 'sp01-3', type: 'vraifaux', tag: 'papier', num: '1.3', question: '**Coche** vrai ou faux.', items: [{ text: 'Sans piles, la lampe s’allume.', v: false }, { text: 'L’interrupteur fermé allume la lampe.', v: true }, { text: 'La LED chauffe un peu.', v: true }] },
        { id: 'sp01-f2', type: 'filet' },
        { id: 'sp01-4', type: 'order', tag: 'papier', num: '1.4', question: '**Range** dans l’ordre pour allumer la lampe.', items: ['Je mets les piles dans le bon sens.', 'J’appuie sur l’interrupteur.', 'Le courant passe dans les fils.', 'La LED s’allume.'] },
        { id: 'sp01-r', type: 'retenir', md: 'Une lampe de poche a des **piles** (l’énergie), un **interrupteur** (allumer, éteindre) et une **LED** (la lumière).' },
        { id: 'sp01-q2', type: 'questions', title: 'Réponds dans ton cahier, sous la partie collée :', items: [{ q: 'Recopie « À retenir ».' }] },
      ] },
    ],
  };

  /* --------- Le parking connecté (4e) --------- */
  const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const barriereStart = { blocks: { languageVersion: 0, blocks: [{ type: 'tl_program', x: 20, y: 20, inputs: { SETUP: { block: { type: 'tl_servo', fields: { PIN: '13' }, inputs: { ANGLE: n(0) } } } } }] } };
  const parking = {
    id: 'charte-parking-connecte', format: 2, version: 2, title: 'Le parking connecté', level: 'college', niveau: '4e', cycle: 4, seq: 6, duration: 275, author: 'Pôle des Sciences et de la Technologie',
    summary: 'comprendre comment une barrière connectée reconnaît les véhicules autorisés, décrire ses chaînes et programmer la carte ESP32 de la barrière.',
    problematique: 'Comment des objets connectés communiquent-ils pour ne laisser entrer que les véhicules autorisés ?',
    objet: 'Le parking connecté', position: 6,
    competences: [
      { code: 'T1C1', color: '#30B34A', label: 'Décrire les liens entre usages et évolutions technologiques des objets et des systèmes techniques', co: 'Lignée d’objets, innovation. IA : données étiquetées, biais. Donnée personnelle, identification, authentification, mot de passe WPA2.', sub: [{ code: 'T1C11', label: 'Situer l’évolution des barrières ; avantages, inconvénients, biais d’une IA' }, { code: 'T1C11', label: 'Appliquer des règles de cybersécurité ; repérer les données personnelles' }] },
      { code: 'T2C1', color: '#3A6FD8', label: 'Décrire et caractériser l’organisation interne d’un objet et ses échanges avec son environnement (énergies, données)', co: 'Terminal, serveur, point d’accès WiFi, liaison sans fil, topologie en étoile. Adresse IP (partie réseau / appareil, fixe). Capteur à ultrasons, ESP32, servomoteur. CSV, tableur, octet, ASCII.', sub: [{ code: 'T2C11', label: 'Décrire la chaîne d’énergie de la barrière' }, { code: 'T2C13', label: 'Décrire la chaîne d’information de la barrière' }, { code: 'T2C14', label: 'Réseau local, adresses IP, trames, données CSV, octets' }] },
      { code: 'T2C2', color: '#E53935', label: 'Identifier un dysfonctionnement d’un objet technique et y remédier', co: 'Symptôme, hypothèse, vérification. Conflit d’adresses IP, câblage du servomoteur, seuil du capteur.', sub: [{ code: 'T2C21', label: 'Formuler une hypothèse de panne et proposer une vérification' }] },
      { code: 'T3C3', color: '#E8962A', label: 'Concevoir, écrire, tester et mettre au point un programme', co: 'Protocole, trame. Événement « quand je reçois », instruction conditionnelle, attente sur un capteur, envoi de message. Protocole de test.', sub: [{ code: 'T2C31', label: 'Comprendre le protocole : ordre des échanges' }, { code: 'T3C31', label: 'Compléter et téléverser le programme de la barrière' }, { code: 'T3C22', label: 'Tester : mesurer le temps de réponse (< 2 s)' }] },
    ],
    presentation: 'Dans chaque îlot, un robot ESP32 (le véhicule), une barrière ESP32 et un serveur Raspberry Pi communiquent sur un réseau WiFi local isolé. Les élèves analysent le réseau et les adresses IP, décrivent la barrière, complètent et testent son programme, exploitent le journal CSV, puis sécurisent et dépannent le parking.',
    synthese: 'Terminal, serveur, client / serveur ; réseau local WiFi en étoile ; adresse IP (partie réseau / appareil, fixe ou automatique) ; protocole et trames ; chaînes d’information et d’énergie ; programme événementiel ; journal CSV et octets ; WPA2, authentification ; méthode de dépannage.',
    evaluation: 'Évaluation /20 sans ordinateur, recto verso (E01 / E02), documents A, B, C autorisés ; version SEGPA /20.',
    deroulement: [
      { seance: 'Séance 1', objectif: 'Découvrir le système', activites: 'Évolution des barrières, rôles des objets', ressources: 'P01, R01' },
      { seance: 'Séance 2', objectif: 'Comprendre le réseau local', activites: 'Jeu des messages, IP, IP fixe', ressources: 'P02, R02, R04, Pi + barrière' },
      { seance: 'Séance 3', objectif: 'Chaînes et programme', activites: 'Chaînes, protocole, programme, test', ressources: 'P03, R03, R04, robot + barrière' },
      { seance: 'Séance 4', objectif: 'Données, sécurité, pannes', activites: 'Journal CSV, ASCII, attaque, pannes', ressources: 'P04, R05, tableur, journal CSV' },
      { seance: 'Séance 5', objectif: 'Faire le bilan', activites: 'Synthèse et évaluation', ressources: 'S01, E01 / E02, R06' },
    ],
    differenciation: 'Activités ORDI doublées par une version papier (7 postes pour 30 élèves). SEGPA : 2 feuilles (SEGPA_P01, P02), ressources S1 et S2, évaluation adaptée /20 avec « Mon bilan ».',
    materiel: 'Par îlot : 1 Raspberry Pi (point d’accès WiFi PARKING-ILOTn, programme serveur, journal), 1 robot ESP32 (2 moteurs, capteur ultrason), 1 barrière ESP32 (servomoteur, capteur ultrason de passage, 2 voyants), 1 tablette de supervision. Programmes Barriere_demarrage et Barriere_ouverture ; fichier journal_parking.csv ; tableur ; chronomètres.',
    steps: [
      { id: 'pk-p03', title: 'Séance 3 - Feuille 1', kind: 'feuille', seance: 3, feuille: 1, resume: 'la barrière reçoit un ordre du serveur et détecte le passage du véhicule. Tu décris ses chaînes, tu complètes son programme puis tu le testes.', blocks: [
        { id: 'pk-1', type: 'boxes', tag: 'papier', comp: ['T2C13'], question: 'Complète la **chaîne d’information** de la barrière avec : *capteur à ultrasons – carte ESP32 – module WiFi*.', topLabel: 'fonction', bottomLabel: 'constituant', items: [{ top: 'ACQUÉRIR', bottom: { a: 'capteur à ultrasons|capteur ultrason|capteur' } }, { top: 'TRAITER', bottom: { a: 'carte ESP32|ESP32' } }, { top: 'COMMUNIQUER', bottom: { a: 'module WiFi|WiFi|wifi' } }] },
        { id: 'pk-f1', type: 'filet' },
        { id: 'pk-2', type: 'table', tag: 'papier', comp: ['T2C14'], question: 'Le réseau de l’îlot est **192.168.4.x**. Complète les adresses IP fixes (ressource 4).', headers: ['Objet', 'Rôle', 'Adresse IP'], rows: [['Raspberry Pi', 'serveur', '192.168.4.1'], ['Barrière ESP32', 'client', { a: '192.168.4.10' }], ['Robot ESP32', 'client', { a: '192.168.4.20' }]], bank: ['192.168.4.10', '192.168.4.20'] },
        { id: 'pk-q1', type: 'questions', items: [{ q: 'Quelle partie de l’adresse IP est commune à tous les objets de l’îlot ?', corr: '192.168.4 : la partie réseau.' }, { q: 'Que se passe-t-il si deux objets ont la même adresse ?', corr: 'Conflit d’adresses : les messages n’arrivent plus au bon objet.' }] },
        { id: 'pk-d1', type: 'decoupe' },
        { id: 'pk-3', type: 'code', tag: 'ordi', comp: ['T3C31'], board: 'esp32', question: 'Complète **Barriere_ouverture** : quand le capteur (déclenche 5, écho 18) mesure **moins de 15 cm**, le servomoteur (broche 13) ouvre la barrière à **90°** pendant 3 s, puis la referme à 0°.', start: barriereStart, expect: ['distanceCm(5, 18)', 'servo_13.write(90)', 'servo_13.write(0)', 'delay(3000)'], corr: 'si distance < 15 alors servo 90°, attendre 3000 ms, sinon servo 0°.' },
        { id: 'pk-4', type: 'vraifaux', tag: 'papier', comp: ['T3C22'], question: 'Protocole de test : coche vrai ou faux.', items: [{ text: 'On mesure le temps entre la détection et l’ouverture avec un chronomètre.', v: true }, { text: 'Si la barrière met 5 s à s’ouvrir, le cahier des charges (< 2 s) est respecté.', v: false }, { text: 'On répète la mesure plusieurs fois.', v: true }] },
        { id: 'pk-q2', type: 'questions', items: [{ q: 'Pourquoi la barrière attend-elle 3 secondes avant de se refermer ?', corr: 'Pour laisser passer le véhicule en sécurité.' }] },
      ] },
      { id: 'pk-r', title: 'Ressources 3 et 4', kind: 'ressource', blocks: [
        { id: 'pk-r3', type: 'ressource', num: '3', title: 'La barrière connectée', md: '- **capteur à ultrasons** : mesure la distance au véhicule ;\n- **carte ESP32** : exécute le programme, reçoit les ordres du serveur par **WiFi** ;\n- **servomoteur** : lève ou baisse la barrière ;\n- **voyants** : vert = passage autorisé, rouge = refusé.' },
        { id: 'pk-r4', type: 'ressource', num: '4', title: 'Le réseau de l’îlot', md: '| Objet | Adresse IP |\n|---|---|\n| Raspberry Pi (point d’accès, serveur) | 192.168.4.1 |\n| Barrière ESP32 | 192.168.4.10 |\n| Robot ESP32 | 192.168.4.20 |\n\nLes trois premiers nombres (192.168.4) forment la **partie réseau** ; le dernier identifie l’**appareil**.', qr: '#code', qrLabel: 'Ouvrir l’atelier Code' },
      ] },
    ],
  };

  [lampe, parking].forEach((w) => TL.DEMOS.unshift(Object.assign(TL.normalizeWorkshop(w), { source: 'demo' })));
  // niveaux des démos précédentes (couleur de pastille)
  const niv = { 'demo-circuits-serie-derivation': '5e', 'demo-portail-automatique': '4e', 'demo-eclairage-premier-programme': '5e', 'demo-sti2d-serre-regulation': '1re', 'demo-snt-parking-connecte': '2nde', 'demo-pro-consignation-mesures': 'Pro' };
  TL.DEMOS.forEach((w) => { if (!w.niveau && niv[w.id]) w.niveau = niv[w.id]; });
})();
