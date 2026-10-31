/* TechnoStudio — ateliers de démonstration intégrés (fonctionnent sans Centrale). */
(function () {
  'use strict';
  const TL = window.TL;

  // Reproduction d'une fiche papier (exemple de conversion)
  const paperSheet = (title, lines) => {
    const rows = lines.map((l, i) => `<text x="40" y="${150 + i * 26}" font-size="13" fill="#2b2b2b">${l}</text>${/\.\.\.\./.test(l) ? '' : ''}`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842"><rect width="595" height="842" fill="#fbfaf6"/>
      ${Array.from({ length: 30 }, (_, i) => `<line x1="30" x2="565" y1="${132 + i * 26}" y2="${132 + i * 26}" stroke="#d8e2ef" stroke-width="1"/>`).join('')}
      <line x1="70" x2="70" y1="0" y2="842" stroke="#f2b8b8"/>
      <rect x="30" y="30" width="535" height="70" fill="none" stroke="#333" stroke-width="1.5"/>
      <text x="45" y="58" font-family="Arial" font-size="12" fill="#555">Technologie — Fiche élève</text>
      <text x="45" y="84" font-family="Arial" font-weight="bold" font-size="18" fill="#111">${title}</text>
      <text x="420" y="58" font-family="Arial" font-size="11" fill="#555">Nom : ..................</text>
      <text x="420" y="80" font-family="Arial" font-size="11" fill="#555">Classe : ..............</text>
      <g font-family="Arial">${rows}</g>
      <rect x="330" y="560" width="220" height="150" fill="none" stroke="#888" stroke-dasharray="4 3"/>
      <text x="345" y="580" font-family="Arial" font-size="11" fill="#777">Schéma à compléter</text>
      <path d="M 360 680 h 60 v -60 h 60 M 380 640 l 20 -20" stroke="#999" fill="none"/>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  const PORTAIL_SVG = `<svg viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg" class="diag">
    <rect x="0" y="170" width="400" height="50" class="d-ground"/>
    <rect x="40" y="70" width="16" height="102" class="d-metal"/><rect x="300" y="70" width="16" height="102" class="d-metal"/>
    <rect x="56" y="85" width="240" height="78" class="d-gate"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => `<line x1="${70 + i * 21}" y1="88" x2="${70 + i * 21}" y2="160" class="d-bar"/>`).join('')}
    <rect x="56" y="163" width="240" height="6" class="d-rack"/>
    <rect x="318" y="138" width="46" height="34" rx="4" class="d-box"/><text x="341" y="160" text-anchor="middle" class="d-txt">M</text>
    <rect x="303" y="50" width="10" height="20" class="d-metal"/><circle cx="308" cy="44" r="9" class="d-gyro"/>
    <rect x="32" y="120" width="10" height="14" class="d-box"/><rect x="314" y="120" width="10" height="14" class="d-box"/>
    <line x1="42" y1="127" x2="314" y2="127" class="d-beam"/>
    <rect x="18" y="20" width="22" height="38" rx="5" class="d-box"/><circle cx="29" cy="32" r="4" class="d-btn"/><path d="M 44 26 q 8 -6 16 0 M 46 18 q 12 -9 24 0" class="d-wave"/>
  </svg>`;

  const DEMOS = [
    /* ===================== COLLÈGE : circuits ===================== */
    {
      id: 'demo-circuits-serie-derivation',
      title: 'Circuits électriques : série et dérivation',
      level: 'college', duration: 55, version: 3, author: 'TechnoStudio (démo)',
      summary: 'Construire un circuit commandé, comparer série et dérivation, protéger une DEL.',
      competences: ['Mesurer des grandeurs de manière directe ou indirecte', 'Associer des solutions techniques à des fonctions', 'Simuler numériquement la structure d’un objet'],
      steps: [
        {
          title: 'Découvrir',
          blocks: [
            { type: 'text', md: 'Un **circuit électrique** est une boucle fermée de conducteurs. Il contient au moins :\n- un **générateur** (la pile) qui fournit l’énergie ;\n- un ou plusieurs **récepteurs** (lampe, moteur, DEL…) qui la convertissent ;\n- des **fils** et souvent un **interrupteur** pour ouvrir ou fermer la boucle.' },
            { type: 'text', md: '> ? Démonstration : touche l’interrupteur **K1** pour ouvrir et fermer le circuit. Touche la lampe pour lire la tension et l’intensité.' },
            {
              type: 'circuit', demo: true, cols: 5, rows: 3,
              initial: {
                'v-0-0': { type: 'battery', v: 4.5, label: 'G1' }, 'v-1-0': { type: 'wire' },
                'h-0-0': { type: 'wire' }, 'h-0-1': { type: 'switch', closed: true, label: 'K1' }, 'h-0-2': { type: 'wire' }, 'h-0-3': { type: 'wire' },
                'v-0-4': { type: 'wire' }, 'v-1-4': { type: 'wire' },
                'h-2-0': { type: 'wire' }, 'h-2-1': { type: 'wire' }, 'h-2-2': { type: 'lamp', r: 9, label: 'L1' }, 'h-2-3': { type: 'wire' },
              },
            },
            { type: 'qcm', question: 'Quand l’interrupteur K1 est **ouvert**, la lampe…', options: [{ text: 'reste allumée, mais moins fort', correct: false }, { text: 's’éteint, car la boucle est coupée', correct: true }, { text: 's’éteint, car la pile est vide', correct: false }], explanation: 'Un interrupteur ouvert interrompt la circulation du courant dans toute la boucle.' },
          ],
        },
        {
          title: 'Mon premier circuit',
          blocks: [
            { type: 'text', md: 'À toi : la pile est déjà en place. Ajoute **une lampe**, **un interrupteur** et les fils nécessaires.\n\nAvec l’outil **Fil**, tu peux glisser d’un point à l’autre de la grille.' },
            {
              type: 'circuit', cols: 6, rows: 4,
              palette: { wire: -1, lamp: 1, switch: 1 },
              initial: { 'v-1-0': { type: 'battery', v: 4.5, label: 'G1' } },
              goals: [{ type: 'switchControls' }, { type: 'noShort' }],
              hint: 'Le courant doit pouvoir faire le tour complet : pile → interrupteur → lampe → retour à la pile.',
            },
          ],
        },
        {
          title: 'Série ou dérivation ?',
          blocks: [
            { type: 'text', md: '| Montage | Si une lampe grille… | Éclat des lampes |\n|---|---|---|\n| **Série** (une seule boucle) | toutes s’éteignent | plus faible |\n| **Dérivation** (plusieurs boucles) | les autres restent allumées | normal |' },
            {
              type: 'circuit', cols: 6, rows: 4,
              question: 'Réalise un montage où **deux lampes** fonctionnent **en dérivation**, commandées par un seul interrupteur.',
              palette: { wire: -1, lamp: 2, switch: 1 },
              initial: { 'v-1-0': { type: 'battery', v: 4.5, label: 'G1' } },
              goals: [{ type: 'parallel', comp: 'lamp' }, { type: 'switchControls' }, { type: 'noShort' }],
              hint: 'Chaque lampe doit avoir sa propre boucle qui passe par la pile.',
            },
            { type: 'qcm', question: 'Dans une maison, les prises et les lampes sont montées…', options: [{ text: 'en série', correct: false, feedback: 'Une seule ampoule grillée couperait toute la maison.' }, { text: 'en dérivation', correct: true }], explanation: 'En dérivation, chaque appareil reçoit la tension du secteur et fonctionne indépendamment des autres.' },
          ],
        },
        {
          title: 'Protéger une DEL',
          blocks: [
            { type: 'text', md: 'Une **DEL** (diode électroluminescente) ne laisse passer le courant que dans **un sens** et ne supporte qu’un courant faible (environ **20 mA**). Il faut lui associer une **résistance de protection** en série.' },
            { type: 'numeric', question: 'La pile fournit 4,5 V, la DEL a besoin de 2 V et d’un courant de 0,02 A. Calcule la résistance minimale : **R = (U pile − U DEL) ÷ I**', answer: 125, tolerance: 1, unit: 'Ω', hint: '(4,5 − 2) ÷ 0,02', explanation: 'R = 2,5 ÷ 0,02 = **125 Ω**. On choisit la valeur normalisée juste au-dessus : 150 Ω ou 220 Ω.' },
            {
              type: 'circuit', cols: 6, rows: 4,
              question: 'Fais briller la DEL sans la griller. Attention au **sens** : touche la DEL puis « Retourner » si besoin.',
              palette: { wire: -1, led: 1, resistor: 1 },
              initial: { 'v-1-0': { type: 'battery', v: 4.5, label: 'G1' } },
              goals: [{ type: 'ledSafe' }, { type: 'noShort' }],
              hint: 'Si la DEL grille, touche-la et choisis « Remplacer la DEL ». Une résistance de 220 Ω convient.',
            },
          ],
        },
        {
          title: 'Bilan',
          blocks: [
            { type: 'cloze', text: 'Un circuit ne fonctionne que s’il est [[fermé|ferme]]. Dans un montage en [[!dérivation|série]], chaque lampe a sa propre boucle. Une DEL se protège avec une [[résistance|resistance]] placée en série.' },
            { type: 'report', question: 'Explique avec tes mots pourquoi on n’utilise pas le montage en série pour l’éclairage d’une classe.', photo: false },
          ],
        },
      ],
    },

    /* ===================== COLLÈGE : portail (chaînes + programmation) ===================== */
    {
      id: 'demo-portail-automatique',
      title: 'Le portail automatique',
      level: 'college', duration: 110, version: 3, author: 'TechnoStudio (démo)',
      summary: 'Fiche papier convertie : chaînes d’information et d’énergie, schéma à légender, programme de commande sécurisé.',
      competences: ['Décrire le fonctionnement d’un objet technique à l’aide de ses chaînes', 'Écrire, mettre au point et exécuter un programme'],
      steps: [
        {
          title: 'Observer le système',
          blocks: [
            { type: 'scan', title: 'Fiche papier d’origine (avant conversion)', pages: [paperSheet('Le portail automatique', ['1. Observe le portail du collège et repère ses éléments.', '2. Légende le schéma ci-contre.', '3. Complète les chaînes d’information et d’énergie.', '4. Écris l’algorigramme de fonctionnement.', '..........................................................', '..........................................................', '5. Quel est le rôle de la cellule photoélectrique ?', '..........................................................'])] },
            { type: 'text', md: 'Un **portail coulissant automatique** s’ouvre quand on appuie sur la télécommande, puis se referme. Une **cellule photoélectrique** détecte un véhicule dans le passage pour éviter tout accident.' },
            { type: 'label', question: 'Légende le schéma du portail.', svg: PORTAIL_SVG, points: [{ x: 7, y: 17, answer: 'Télécommande' }, { x: 77, y: 20, answer: 'Gyrophare' }, { x: 85, y: 70, answer: 'Moteur et carte de commande' }, { x: 45, y: 58, answer: 'Vantail' }, { x: 9, y: 58, answer: 'Cellule photoélectrique' }, { x: 45, y: 77, answer: 'Crémaillère' }], distractors: ['Capteur de température'] },
          ],
        },
        {
          title: 'Les chaînes du système',
          blocks: [
            { type: 'text', md: 'Tout système automatisé se décrit par deux chaînes :\n- la **chaîne d’information** : *acquérir* (capteurs), *traiter* (carte, programme), *communiquer* (signaler, envoyer des ordres) ;\n- la **chaîne d’énergie** : *alimenter*, *distribuer*, *convertir*, *transmettre* jusqu’à l’action.' },
            { type: 'chain', question: 'Place chaque composant du portail dans sa fonction.', infoIn: 'Appui, véhicule', infoOut: 'Lumière clignotante', energyIn: 'Secteur 230 V', action: 'Vantail déplacé', items: [{ text: 'Récepteur radio', slot: 'acquerir' }, { text: 'Cellule photoélectrique', slot: 'acquerir' }, { text: 'Carte à microcontrôleur', slot: 'traiter' }, { text: 'Gyrophare', slot: 'communiquer' }, { text: 'Bloc d’alimentation', slot: 'alimenter' }, { text: 'Relais', slot: 'distribuer' }, { text: 'Moteur électrique', slot: 'convertir' }, { text: 'Pignon et crémaillère', slot: 'transmettre' }] },
            { type: 'order', question: 'Remets dans l’ordre le fonctionnement du portail.', items: ['On appuie sur la télécommande', 'Le gyrophare s’allume', 'Le moteur ouvre le portail', 'Le fin de course « ouvert » est atteint', 'Le portail attend quelques secondes', 'Le moteur referme le portail', 'Le fin de course « fermé » arrête le moteur'] },
          ],
        },
        {
          title: 'Programmer le portail',
          blocks: [
            { type: 'text', md: '> ? Démonstration : ce programme ouvre puis referme le portail. Lance-le, puis appuie sur **Télécommande** dans la maquette.' },
            {
              type: 'blocks', scene: 'portail', demo: true,
              start: [{ op: 'forever', body: [{ op: 'waituntil', cond: { a: 's:telecommande', cmp: '=', b: 1 } }, { op: 'set', target: 'gyrophare', value: 1 }, { op: 'set', target: 'moteur', value: 1 }, { op: 'waituntil', cond: { a: 's:fdc_ouvert', cmp: '=', b: 1 } }, { op: 'set', target: 'moteur', value: 0 }, { op: 'wait', s: 3 }, { op: 'set', target: 'moteur', value: -1 }, { op: 'waituntil', cond: { a: 's:fdc_ferme', cmp: '=', b: 1 } }, { op: 'set', target: 'moteur', value: 0 }, { op: 'set', target: 'gyrophare', value: 0 }] }],
            },
            { type: 'qcm', question: 'Lance la démo, ouvre le portail puis active « Véhicule dans le passage » pendant la fermeture. Que se passe-t-il ?', options: [{ text: 'Le portail s’arrête tout seul', correct: false }, { text: 'Le portail heurte le véhicule', correct: true }, { text: 'Le portail se rouvre', correct: false }], explanation: 'Le programme ne lit jamais la cellule : il manque une **sécurité**.' },
            {
              type: 'blocks', scene: 'portail',
              question: 'Améliore le programme : pendant la fermeture, si la cellule détecte un véhicule, le portail doit **se rouvrir**.',
              start: [{ op: 'forever', body: [{ op: 'waituntil', cond: { a: 's:telecommande', cmp: '=', b: 1 } }, { op: 'set', target: 'gyrophare', value: 1 }, { op: 'set', target: 'moteur', value: 1 }, { op: 'waituntil', cond: { a: 's:fdc_ouvert', cmp: '=', b: 1 } }, { op: 'set', target: 'moteur', value: 0 }, { op: 'wait', s: 3 }, { op: 'set', target: 'moteur', value: -1 }, { op: 'waituntil', cond: { a: 's:fdc_ferme', cmp: '=', b: 1 } }, { op: 'set', target: 'moteur', value: 0 }, { op: 'set', target: 'gyrophare', value: 0 }] }],
              hint: 'Remplace « attendre jusqu’à fin de course fermé » par une boucle « tant que fin de course fermé = 0 » qui contient un « si obstacle = 1 alors mettre moteur à ouvrir ».',
              tests: [
                { name: 'Un appui ouvre le portail jusqu’au fin de course', steps: [{ set: { telecommande: 1 }, run: 0.3 }, { set: { telecommande: 0 }, run: 5, expect: { fdc_ouvert: 1, gyrophare: 1 } }] },
                { name: 'Sans obstacle, le portail se referme et le gyrophare s’éteint', steps: [{ set: { telecommande: 1 }, run: 0.3 }, { set: { telecommande: 0 }, run: 16, expect: { fdc_ferme: 1, gyrophare: 0, moteur: 0 } }] },
                { name: 'Un véhicule pendant la fermeture n’est jamais heurté', steps: [{ set: { telecommande: 1 }, run: 0.3 }, { set: { telecommande: 0 }, run: 8 }, { set: { obstacle: 1 }, run: 6, expect: { collision: 0 } }] },
                { name: 'Le portail repart vers l’ouverture quand le véhicule est détecté', steps: [{ set: { telecommande: 1 }, run: 0.3 }, { set: { telecommande: 0 }, run: 8 }, { set: { obstacle: 1 }, run: 0.4, expect: { moteur: 1 } }] },
              ],
            },
          ],
        },
        {
          title: 'Compte rendu',
          blocks: [
            { type: 'report', question: 'Quel est le rôle de la cellule photoélectrique ? Ajoute une photo de ton algorigramme papier si tu en as fait un.' },
          ],
        },
      ],
    },

    /* ===================== COLLÈGE : éclairage (premier programme) ===================== */
    {
      id: 'demo-eclairage-premier-programme',
      title: 'Éclairage automatique : mon premier programme',
      level: 'college', duration: 55, version: 2, author: 'TechnoStudio (démo)',
      summary: 'Capteurs, actionneurs, conditions : programmer l’éclairage d’un couloir pas à pas.',
      competences: ['Écrire, mettre au point et exécuter un programme', 'Identifier les entrées et sorties d’un système'],
      steps: [
        {
          title: 'Capteurs et actionneurs',
          blocks: [
            { type: 'text', md: 'Un **capteur** prélève une information (présence, lumière, température…). Un **actionneur** agit sur l’environnement (lampe, moteur, buzzer…). Le **programme** décide quoi faire des informations.' },
            { type: 'sort', question: 'Classe ces composants.', categories: [{ name: 'Capteurs', items: ['Détecteur de présence', 'Photorésistance', 'Bouton poussoir', 'Thermistance'] }, { name: 'Actionneurs', items: ['Lampe', 'Moteur', 'Buzzer', 'Vérin'] }] },
          ],
        },
        {
          title: 'Allumer quand quelqu’un passe',
          blocks: [
            { type: 'procedure', question: 'Construis ton programme en suivant ces étapes.', items: [{ text: 'Ajoute le bloc **répéter indéfiniment**.' }, { text: 'Dedans, ajoute **si … alors … sinon**. Choisis la condition *Détecteur de présence = vrai*.' }, { text: 'Dans « alors », ajoute **mettre Lampe à allumée**.' }, { text: 'Touche le point d’insertion de « sinon » puis ajoute **mettre Lampe à éteinte**.' }, { text: 'Clique sur **▶ Lancer** et teste avec le bouton « Personne / Quelqu’un passe ».' }] },
            {
              type: 'blocks', scene: 'eclairage', toolbox: ['forever', 'if', 'ifelse', 'set', 'wait'],
              tests: [
                { name: 'Présence → la lampe s’allume', steps: [{ set: { presence: 1 }, run: 0.5, expect: { lampe: 1 } }] },
                { name: 'Personne → la lampe s’éteint', steps: [{ set: { presence: 1 }, run: 0.5 }, { set: { presence: 0 }, run: 0.5, expect: { lampe: 0 } }] },
              ],
            },
          ],
        },
        {
          title: 'Économiser l’énergie',
          blocks: [
            { type: 'text', md: 'En plein jour, inutile d’allumer ! Améliore ton programme : la lampe ne s’allume que s’il y a **une présence ET une luminosité inférieure à 30 %**. Elle reste ensuite allumée **5 secondes**.\n\n> ? Le bouton **+** à côté d’une condition ajoute un « et » ou un « ou ».' },
            {
              type: 'blocks', scene: 'eclairage', toolbox: ['forever', 'if', 'ifelse', 'set', 'wait'],
              start: [{ op: 'forever', body: [{ op: 'ifelse', cond: { a: 's:presence', cmp: '=', b: 1 }, body: [{ op: 'set', target: 'lampe', value: 1 }], else: [{ op: 'set', target: 'lampe', value: 0 }] }] }],
              tests: [
                { name: 'De jour, même avec présence, la lampe reste éteinte', steps: [{ set: { presence: 1, luminosite: 80 }, run: 1, expect: { lampe: 0 } }] },
                { name: 'De nuit avec présence, la lampe s’allume', steps: [{ set: { presence: 1, luminosite: 10 }, run: 0.5, expect: { lampe: 1 } }] },
                { name: 'Elle reste allumée environ 5 s après le passage', steps: [{ set: { presence: 1, luminosite: 10 }, run: 0.3 }, { set: { presence: 0 }, run: 3.5, expect: { lampe: 1 } }, { run: 3, expect: { lampe: 0 } }] },
              ],
            },
            { type: 'qcm', question: 'Pourquoi ajouter la condition sur la luminosité ?', options: [{ text: 'Pour économiser l’énergie électrique', correct: true }, { text: 'Pour que la lampe dure moins longtemps', correct: false }, { text: 'Pour détecter les personnes plus vite', correct: false }] },
          ],
        },
        {
          title: 'Défi : le feu tricolore',
          blocks: [
            { type: 'text', md: 'Programme un feu : **vert 5 s**, puis **orange 2 s**, puis **rouge 5 s**, et recommence. Un seul feu allumé à la fois !' },
            {
              type: 'blocks', scene: 'feux', toolbox: ['forever', 'repeat', 'set', 'wait', 'if', 'waituntil'],
              tests: [
                { name: 'Au départ, seul le vert est allumé', steps: [{ run: 1, expect: { vert: 1, orange: 0, rouge: 0 } }] },
                { name: 'À 6 s, seul l’orange est allumé', steps: [{ run: 6, expect: { vert: 0, orange: 1, rouge: 0 } }] },
                { name: 'À 9 s, seul le rouge est allumé', steps: [{ run: 9, expect: { vert: 0, orange: 0, rouge: 1 } }] },
                { name: 'À 13 s, le cycle recommence au vert', steps: [{ run: 13, expect: { vert: 1, orange: 0, rouge: 0 } }] },
              ],
            },
          ],
        },
      ],
    },

    /* ===================== STI2D : serre ===================== */
    {
      id: 'demo-sti2d-serre-regulation',
      title: 'Serre automatisée : régulation tout ou rien',
      level: 'sti2d', duration: 120, version: 2, author: 'TechnoStudio (démo)',
      summary: 'Chaîne de puissance, bilan énergétique, régulation à hystérésis de la température et de l’arrosage.',
      competences: ['Analyser le comportement d’un système asservi', 'Évaluer une performance énergétique', 'Programmer une commande tout ou rien avec hystérésis'],
      steps: [
        {
          title: 'Analyse fonctionnelle',
          blocks: [
            { type: 'text', md: 'La serre maintient les plantes dans de bonnes conditions : **température entre 18 et 24 °C**, **humidité du sol entre 30 et 60 %**. Un microcontrôleur lit les capteurs et pilote chauffage, ventilation et électrovanne d’arrosage.' },
            { type: 'chain', question: 'Complète les chaînes pour la fonction « chauffer la serre ».', infoIn: 'Température', infoOut: 'Données vers le superviseur', energyIn: 'Réseau 230 V', action: 'Air chauffé', items: [{ text: 'Sonde PT100', slot: 'acquerir' }, { text: 'Microcontrôleur', slot: 'traiter' }, { text: 'Module LoRa', slot: 'communiquer' }, { text: 'Disjoncteur + réseau', slot: 'alimenter' }, { text: 'Relais statique', slot: 'distribuer' }, { text: 'Résistance chauffante', slot: 'convertir' }, { text: 'Ventilateur de brassage', slot: 'transmettre' }] },
          ],
        },
        {
          title: 'Bilan énergétique',
          blocks: [
            { type: 'numeric', question: 'Le chauffage est une résistance alimentée sous **230 V** et parcourue par **6,5 A**. Calcule sa puissance P = U × I.', answer: 1495, tolerance: 5, unit: 'W' },
            { type: 'numeric', question: 'Il fonctionne en moyenne **5 h par nuit** pendant **90 nuits**. Calcule l’énergie consommée en kWh (E = P × t).', answer: 672.75, tolerance: 3, unit: 'kWh', hint: 'Convertis P en kW, puis multiplie par le nombre total d’heures (5 × 90).', explanation: 'E = 1,495 kW × 450 h ≈ **673 kWh**.' },
            { type: 'numeric', question: 'À **0,25 € le kWh**, quel est le coût de ce chauffage pour la saison ?', answer: 168.19, tolerance: 2, unit: '€' },
          ],
        },
        {
          title: 'Régulation à hystérésis',
          blocks: [
            { type: 'text', md: 'Une régulation **tout ou rien** sans écart provoque des commutations très rapides du relais. On utilise une **hystérésis** : on allume sous le seuil bas, on éteint au-dessus du seuil haut, et entre les deux **on ne change rien**.\n\n| Mesure | Chauffage | Ventilation | Arrosage |\n|---|---|---|---|\n| T < 18 °C | marche | — | — |\n| T > 22 °C | arrêt | — | — |\n| T > 26 °C | — | marche | — |\n| T < 24 °C | — | arrêt | — |\n| Sol < 30 % | — | — | ouvert |\n| Sol > 60 % | — | — | fermé |' },
            {
              type: 'blocks', scene: 'serre',
              question: 'Programme la régulation complète. Teste en direct en changeant la température extérieure.',
              tests: [
                { name: 'Hiver (5 °C dehors) : la température reste entre 17 et 24 °C', init: { temp_ext: 5 }, steps: [{ run: 30 }, { run: 60, expect: { temperature: { min: 17, max: 24 } } }] },
                { name: 'Pas de surchauffe : la température ne dépasse jamais 24 °C', init: { temp_ext: 5 }, steps: [{ run: 9, expect: { temperature: { max: 24 } } }, { run: 4, expect: { temperature: { max: 24 } } }, { run: 5, expect: { temperature: { max: 24 } } }, { run: 7, expect: { temperature: { max: 24 } } }, { run: 11, expect: { temperature: { min: 16, max: 24 } } }] },
                { name: 'Forte chaleur (32 °C dehors) : la ventilation démarre', init: { temp_ext: 32 }, steps: [{ run: 40, expect: { ventilation: 1, chauffage: 0 } }] },
                { name: 'L’humidité du sol reste entre 25 et 65 %', init: { temp_ext: 15 }, steps: [{ run: 120, expect: { humidite: { min: 25, max: 65 } } }] },
              ],
              hint: 'Utilise trois blocs « si » indépendants dans la boucle, un par actionneur, chacun avec deux conditions (seuil bas / seuil haut).',
            },
            { type: 'qcm', question: 'Quel est l’intérêt principal de l’hystérésis ?', options: [{ text: 'Limiter le nombre de commutations du relais', correct: true }, { text: 'Atteindre exactement la consigne', correct: false }, { text: 'Supprimer le capteur de température', correct: false }], explanation: 'Moins de commutations = moins d’usure des contacts et moins de perturbations.' },
          ],
        },
      ],
    },

    /* ===================== SNT / NSI : parking ===================== */
    {
      id: 'demo-snt-parking-connecte',
      title: 'Parking connecté : variables et compteur',
      level: 'snt', duration: 90, version: 2, author: 'TechnoStudio (démo)',
      summary: 'Informatique embarquée : capteurs, variables, boucle d’événements, passage des blocs à Python.',
      competences: ['SNT · Informatique embarquée et objets connectés', 'Écrire un programme simple avec variables et conditions', 'Passer d’un langage par blocs à Python'],
      steps: [
        {
          title: 'Système embarqué',
          blocks: [
            { type: 'text', md: 'Un **système informatique embarqué** est intégré à un objet : il lit des **capteurs**, exécute un **programme** et commande des **actionneurs**, souvent sans écran ni clavier. La barrière d’un parking en est un exemple.' },
            { type: 'match', question: 'Associe chaque élément à son rôle.', pairs: [['Capteur à boucle magnétique', 'Détecte une voiture'], ['Microcontrôleur', 'Exécute le programme'], ['Barrière motorisée', 'Agit sur le monde réel'], ['Variable `places`', 'Mémorise une valeur']] },
          ],
        },
        {
          title: 'Compter les places',
          blocks: [
            { type: 'text', md: 'Le parking compte **5 places**. Programme la barrière :\n1. au démarrage, `places` vaut 5 et l’afficheur l’indique ;\n2. si une voiture se présente **et** qu’il reste des places : lever la barrière, enlever 1 à `places`, mettre à jour l’afficheur, attendre que la voiture soit passée puis 1 s, baisser la barrière ;\n3. si une voiture sort : ajouter 1 à `places` ;\n4. le voyant **COMPLET** s’allume quand `places` vaut 0.' },
            {
              type: 'blocks', scene: 'parking', vars: ['places'],
              start: [{ op: 'setvar', name: 'places', value: 5 }, { op: 'set', target: 'afficheur', value: { var: 'places' } }, { op: 'forever', body: [] }],
              tests: [
                { name: 'Au démarrage, l’afficheur indique 5', steps: [{ run: 0.5, expect: { afficheur: 5 } }] },
                { name: 'Une voiture entre : la barrière se lève et l’afficheur passe à 4', steps: [{ set: { entree: 1 }, run: 0.4, expect: { barriere: 1 } }, { set: { entree: 0 }, run: 2, expect: { afficheur: 4, barriere: 0 } }] },
                { name: 'Une sortie libère une place', steps: [{ set: { entree: 1 }, run: 0.4 }, { set: { entree: 0 }, run: 2 }, { set: { sortie: 1 }, run: 0.4 }, { set: { sortie: 0 }, run: 0.5, expect: { places: 5 } }] },
                { name: 'Après 5 entrées : COMPLET et la barrière reste baissée', steps: [].concat(...Array.from({ length: 5 }, () => [{ set: { entree: 1 }, run: 0.4 }, { set: { entree: 0 }, run: 2 }]), [{ set: { entree: 1 }, run: 0.6, expect: { voyant_complet: 1, barriere: 0, afficheur: 0 } }]) },
              ],
              hint: 'Pour éviter de compter une voiture plusieurs fois, attends que le capteur repasse à 0 (« attendre jusqu’à Capteur entrée = 0 ») avant de continuer.',
            },
          ],
        },
        {
          title: 'Vers Python',
          blocks: [
            { type: 'text', md: 'Clique sur **Voir en Python** sous ton programme : chaque bloc a son équivalent textuel. `while True:` correspond à « répéter indéfiniment », `if … :` à « si … alors ».' },
            { type: 'cloze', text: 'En Python, une boucle infinie s’écrit `[[while True:|while true:|while True]]`. Pour retirer 1 à la variable places, on écrit `places = places [[-]] 1`. Le test « égal à » s’écrit avec [[!==|=|:=]].' },
            { type: 'qcm', question: 'Que fait ce code ?\n\n`if places == 0:`\n`    ecrire("voyant_complet", 1)`', options: [{ text: 'Il allume le voyant quand il ne reste plus de place', correct: true }, { text: 'Il met la variable places à 0', correct: false }, { text: 'Il compte les voitures', correct: false }] },
          ],
        },
      ],
    },

    /* ===================== PRO / BTS : habilitation ===================== */
    {
      id: 'demo-pro-consignation-mesures',
      title: 'Consignation et mesures électriques',
      level: 'pro', duration: 90, version: 2, author: 'TechnoStudio (démo)',
      summary: 'Étapes de la consignation (NF C18-510), EPI, mesures et loi d’Ohm sur maquette virtuelle.',
      competences: ['Mettre en sécurité un ouvrage électrique', 'Réaliser des mesures et exploiter les résultats'],
      steps: [
        {
          title: 'La consignation',
          blocks: [
            { type: 'text', md: '> ! Avant toute intervention sur une installation, elle doit être **consignée** par une personne habilitée. Une erreur d’ordre peut exposer l’intervenant à la tension.' },
            { type: 'order', question: 'Remets les opérations de consignation dans l’ordre.', items: ['Pré-identifier l’ouvrage sur les plans', 'Séparer l’ouvrage de toute source de tension', 'Condamner l’organe de séparation (cadenas, pancarte)', 'Identifier l’ouvrage sur le lieu de travail', 'Vérifier l’absence de tension (VAT)', 'Mettre à la terre et en court-circuit (si nécessaire)'] },
            { type: 'sort', question: 'Classe les équipements.', categories: [{ name: 'Équipement de protection individuelle', items: ['Gants isolants', 'Écran facial anti-UV', 'Vêtement ininflammable'] }, { name: 'Équipement de consignation / mesure', items: ['VAT', 'Cadenas de condamnation', 'Tapis isolant', 'Pancarte « Ne pas manœuvrer »'] }] },
          ],
        },
        {
          title: 'Mesures et loi d’Ohm',
          blocks: [
            { type: 'text', md: 'Sur la maquette, la résistance **R1** est alimentée par une source de **9 V**. Touche R1 pour afficher la tension à ses bornes et l’intensité qui la traverse, comme avec un multimètre.' },
            {
              type: 'circuit', demo: true, cols: 5, rows: 3,
              initial: {
                'v-0-0': { type: 'battery', v: 9, label: 'G1' }, 'v-1-0': { type: 'wire' },
                'h-0-0': { type: 'wire' }, 'h-0-1': { type: 'switch', closed: true, label: 'K1' }, 'h-0-2': { type: 'wire' }, 'h-0-3': { type: 'wire' },
                'v-0-4': { type: 'wire' }, 'v-1-4': { type: 'resistor', r: 470, label: 'R1' },
                'h-2-0': { type: 'wire' }, 'h-2-1': { type: 'wire' }, 'h-2-2': { type: 'wire' }, 'h-2-3': { type: 'wire' },
              },
            },
            { type: 'numeric', question: 'Relève l’intensité dans R1 et calcule sa résistance R = U ÷ I à partir de tes mesures.', answer: 470, tolerancePct: 3, unit: 'Ω' },
            { type: 'numeric', question: 'Calcule la puissance dissipée par R1 : P = U × I.', answer: 0.172, tolerance: 0.006, unit: 'W', explanation: 'P ≈ 8,99 V × 0,0191 A ≈ **0,17 W** : une résistance ¼ W convient, mais sans grande marge.' },
            { type: 'qcm', question: 'Pour mesurer une intensité, l’ampèremètre se branche…', options: [{ text: 'en série dans le circuit', correct: true }, { text: 'en dérivation aux bornes du récepteur', correct: false }] },
          ],
        },
      ],
    },
  ];

  TL.DEMOS = DEMOS.map((w) => Object.assign(TL.normalizeWorkshop(w), { source: 'demo' }));
})();
