#!/usr/bin/env node
/* Génère docs/PASSERELLE.md et docs/technostudio-descripteur.json à partir de js/descriptor.js.
   Le descripteur reste la seule source de vérité : relancer ce script après toute modification. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/descriptor.js');
const out = [];
const p = (...l) => out.push(...l);
const schemaLine = (s) => {
  if (!s) return '';
  if (s.$ref) return s.$ref;
  if (s.anyOf) return s.anyOf.map(schemaLine).join(' | ');
  let t = s.type || 'any';
  if (t === 'array') t = schemaLine(s.items) + '[]';
  if (s.enum) t += ' (' + s.enum.join(', ') + ')';
  if (s.pattern) t += ' /' + s.pattern + '/';
  if (s.minimum != null || s.maximum != null) t += ' [' + (s.minimum ?? '…') + '–' + (s.maximum ?? '…') + ']';
  return t;
};
p('# Descripteur de passerelle TechnoStudio', '', `\`${D.name}\` · version **${D.version}** · format d’atelier **${D.format}** (formats acceptés : ${D.formatsAccepted.join(', ')})`, '',
  '> Document généré par `node tools/descripteur-doc.js` à partir de `js/descriptor.js`. Ne pas modifier à la main.', '',
  'Le descripteur est le contrat entre l’application **centralisatrice** (la [Centrale élèves](https://github.com/grandiosian/centrale)) et l’application **cible** TechnoStudio. Il fixe la forme des ateliers que l’enseignant dépose dans la Centrale, la façon dont le travail des élèves y est rangé (clés, fusion, conflits), le compte rendu d’avancement (activités du suivi) et les points d’accès utilisés, y compris le serveur de compilation des cartes. L’appli et l’éditeur valident chaque atelier avec le même `validate()`. Version JSON : `docs/technostudio-descripteur.json`.', '',
  '## Rôles', '', `- **Centralisatrice** : ${D.roles.centralisatrice}`, `- **Cible** : ${D.roles.cible}`, '');
p('## Entités', '');
for (const [name, s] of Object.entries(D.entities)) {
  p(`### ${name}`, '', s.description ? s.description + '\n' : '', '| champ | type | obligatoire |', '|---|---|---|');
  for (const [k, v] of Object.entries(s.properties || {})) p(`| \`${k}\` | ${schemaLine(v).replace(/\|/g, '\\|')}${v.description ? ' — ' + v.description : ''} | ${(s.required || []).includes(k) ? 'oui' : ''} |`);
  p('');
}
p('## Types de blocs', '', 'Champs communs à tous les blocs :', '', '| champ | type |', '|---|---|');
for (const [k, v] of Object.entries(D.common)) p(`| \`${k}\` | ${schemaLine(v)}${v.description ? ' — ' + v.description : ''} |`);
p('', '| type | famille | noté | champs propres (obligatoires en gras) | forme de la réponse (`Answer.value`) |', '|---|---|---|---|---|');
for (const [k, b] of Object.entries(D.blocks)) {
  const own = Object.keys(b.fields).filter((f) => !(f in D.common)).map((f) => ((b.required || []).includes(f) ? `**${f}**` : f)).join(', ');
  p(`| \`${k}\` | ${b.family} | ${b.graded ? (b.review ? 'oui + correction enseignant' : 'oui') : 'non'} | ${own} | ${b.answer ? (b.answer.description || schemaLine(b.answer)) : '—'} |`);
}
p('', '## Stockage et gestion', '', '### Dans l’application', '', D.storage.app.engine, '', '| clé | contenu |', '|---|---|');
for (const [k, v] of Object.entries(D.storage.app.keys)) p(`| \`${k}\` | ${v} |`);
p('', ...D.storage.app.rules.map((r) => '- ' + r), '', '### Dans la Centrale', '', D.storage.centrale.engine, '', '| élément | contenu |', '|---|---|');
for (const [k, v] of Object.entries(D.storage.centrale.keys)) p(`| \`${k}\` | ${v} |`);
p('', '## Synchronisation', '', D.sync.summary, '', ...D.sync.steps.map((s, i) => `${i + 1}. ${s}`), '', '**Déclenchement :** ' + D.sync.triggers.join(' ; ') + '.', '', '**Conflits :** ' + D.sync.conflicts, '');
p('## Authentification', '', '| mode | règle |', '|---|---|', ...Object.entries(D.auth).map(([k, v]) => `| \`${k}\` | ${v} |`), '');
p('## Points d’accès', '', '| méthode | chemin | accès | envoi | réponse | erreurs |', '|---|---|---|---|---|---|');
for (const e of D.endpoints) p(`| ${e.method} | \`${e.path}\` | ${e.auth} | ${(e.request || '').replace(/\|/g, '\\|')} | ${(e.response || '').replace(/\|/g, '\\|')} | ${e.errors ? Object.entries(e.errors).map(([c, m]) => c + ' ' + m).join(' ; ') : ''} |`);
p('', '## Compatibilité', '', D.compatibility.header, '', ...D.compatibility.rules.map((r) => '- ' + r), '',
  '## Brancher une application ou un outil', '',
  '1. **Produire un atelier** : un JSON conforme à l’entité `Workshop` (ou un `Package`), vérifié avec `validate()` de `js/descriptor.js` (Node : `require(\'./js/descriptor.js\').validate(\'Workshop\', atelier)`), nommé `<atelier>.technostudio.json`.',
  '2. **Le diffuser** : le déposer dans la Centrale, espace enseignant → Ressources des ateliers, pour l’atelier `technostudio` (ou `technostudio-5e`, etc.).',
  '3. **Lire le travail des élèves** : espace enseignant de la Centrale → Travail d’un élève → données `at/<id atelier>` (entité `Progress`) ; export ZIP de la classe.',
  '4. **Suivre l’avancement** : onglet Suivi de la Centrale, atelier `technostudio` : une colonne par feuille notée (`<atelier>/<code feuille>`), réponses à corriger dans les détails.',
  '5. **Compiler pour une carte** : `POST <compilation>/compiler` avec `CompilationDemande` et l’en-tête `X-Jeton` d’un élève connecté.', '');
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'PASSERELLE.md'), out.join('\n'));
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'technostudio-descripteur.json'), JSON.stringify(Object.assign({}, D, { validate: undefined, blockSchema: undefined }), null, 1));
console.log('docs/PASSERELLE.md et docs/technostudio-descripteur.json générés (' + Object.keys(D.blocks).length + ' types de blocs, ' + D.endpoints.length + ' points d’accès).');
