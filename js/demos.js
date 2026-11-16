/* TechnoStudio — ateliers intégrés (premiers pas, fonctionnent sans Centrale) : circuits série et dérivation,
   éclairage automatique (premier programme). La lampe de poche est dans js/demos2.js. Les autres ateliers sont
   transférés par la Centrale (dossier ateliers/technostudio/ de son dépôt, js/transferes.js) : n'en ajoutez pas ici. */
(function () {
  'use strict';
  const TL = window.TL;

  const DEMOS = [
    /* ===================== COLLÈGE : circuits ===================== */
    {
      id: 'demo-circuits-serie-derivation',
      title: 'Circuits électriques : série et dérivation',
      level: 'college', duration: 55, version: 3, author: 'TechnoStudio (démo)',
      summary: 'Construire un circuit commandé, comparer série et dérivation, protéger une DEL.',
      competences: ['Mesurer des grandeurs de manière directe ou indirecte', 'Associer des solutions techniques à des fonctions', 'Simuler numériquement la structure d’un objet'],
      referentiel: ['SFC11.5.1', 'CCRI22.5.1'], // capacités du référentiel de la Centrale
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

    /* ===================== COLLÈGE : éclairage (premier programme) ===================== */
    {
      id: 'demo-eclairage-premier-programme',
      title: 'Éclairage automatique : mon premier programme',
      level: 'college', duration: 55, version: 2, author: 'TechnoStudio (démo)',
      summary: 'Capteurs, actionneurs, conditions : programmer l’éclairage d’un couloir pas à pas.',
      competences: ['Écrire, mettre au point et exécuter un programme', 'Identifier les entrées et sorties d’un système'],
      referentiel: ['CCRI31.5.3', 'SFC13.5.1'], // capacités du référentiel de la Centrale
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
  ];

  TL.DEMOS = DEMOS.map((w) => Object.assign(TL.normalizeWorkshop(w), { source: 'demo' }));
})();
