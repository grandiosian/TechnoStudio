# TechnoStudio

Ateliers de technologie au **format de la charte** (fiche pédagogique, feuilles P, ressources R, synthèse S, évaluation E, version SEGPA), simulations, et **programmation de cartes** Arduino, ESP32 et micro:bit avec Blockly.

- **Seul** : l'application s'ouvre dans le navigateur, avec ses ateliers intégrés, et fonctionne hors ligne. Le travail est gardé dans le navigateur.
- **Avec la [Centrale élèves](https://github.com/grandiosian/centrale)** : l'élève se connecte avec le formulaire de la Centrale (ou arrive déjà connecté depuis le portail). Il reçoit alors les ateliers de son professeur et son travail est enregistré sur le serveur : il le retrouve sur n'importe quel poste. Son avancement remonte dans le tableau de suivi.
- **Cartes** : le programme est compilé sur un **serveur de compilation**, puis le navigateur l'écrit lui-même dans la carte branchée en USB. Rien n'est à installer sur les postes élèves.

**Essayer** : https://grandiosian.github.io/TechnoStudio/

```
 Poste élève (Chrome / Edge)                         alwaysdata
┌────────────────────────────────────┐   code élève  ┌──────────────────────────────┐
│ TechnoStudio (GitHub Pages)        │ ────────────► │ Centrale   /api/             │
│  • ateliers intégrés + reçus       │ ◄──────────── │  ressources = ateliers        │
│  • travail dans IndexedDB          │  at/<atelier> │  données, progression, suivi  │
│  • Blockly → C++ / MicroPython     │               ├──────────────────────────────┤
│  • Web Serial ──► carte USB        │ ── C++ ─────► │ Compilation /compilation/    │
│      STK500 (Uno, Nano)            │ ◄─ .hex/.bin  │  arduino-cli (jeton Centrale) │
│      esptool (ESP32)               │               └──────────────────────────────┘
│      REPL MicroPython              │
└────────────────────────────────────┘
```

## Contenu du dépôt

| Dossier / fichier | Rôle |
|---|---|
| `index.html`, `js/`, `css/`, `vendor/`, `sw.js` | l'application (publiée telle quelle par GitHub Pages) |
| `js/centrale.js` | connexion à la Centrale : code, portail, ateliers reçus, sauvegarde, avancement |
| `js/flash.js` | compilation à distance et téléversement par le navigateur (STK500, esptool-js) |
| `centrale.json`, `PASSERELLE.md` | **descripteur d'atelier** commun aux applications de la Centrale (`passerelle.atelier` v1), produit par `tools/centrale-json.js` |
| `js/passerelle.js` | ce que l'appli déclare et envoie à la Centrale (activités, progression, clés) : source de `centrale.json` |
| `js/descriptor.js` | format des ateliers (33 types de champs) et de leurs réponses |
| `serveur-compilation/` | serveur Node.js (sans dépendance) autour d'arduino-cli, et son installateur |
| `pont/` | pont local facultatif, pour un poste équipé d'arduino-cli (salle sans internet) |
| `dist/technostudio-autonome.html` | toute l'appli en un seul fichier (double-clic, clé USB) |
| `docs/passerelle-atelier/` | spécification commune `passerelle.atelier` v1, schéma JSON, modèle vierge (à reprendre dans le dépôt de la Centrale) |
| `docs/descripteur-ateliers.md` | format des ateliers en clair (généré) · `docs/FORMAT-ATELIER.md` : format et GIFT |
| `tests/`, `tools/` | essais (STK500, serveur, Centrale de bout en bout) et outils (construction, documentation) |

## 1. Brancher TechnoStudio sur la Centrale

1. **Autoriser le site** : espace enseignant de la Centrale → Réglages → **Sites autorisés** → ajouter `https://grandiosian.github.io`.
2. **Créer l'atelier** (onglet Ateliers) :
   - identifiant (`app`) : `technostudio` ;
   - adresse : `https://grandiosian.github.io/TechnoStudio/` ;
   - classes concernées : celles de votre choix.

   Pour séparer les niveaux, créez plusieurs ateliers, chacun avec ses classes et ses ressources. Par exemple, l'atelier `technostudio-5e` a pour adresse `https://grandiosian.github.io/TechnoStudio/?app=technostudio-5e`.
3. **Diffuser un atelier** :
   - dans TechnoStudio (profil Enseignant), menu Fichier → Mes ateliers → **Pour la Centrale**, ce qui télécharge `<atelier>.technostudio.json` ;
   - dans la Centrale, déposez ce fichier dans **Ressources des ateliers** pour l'atelier `technostudio`. Les fichiers GIFT (`.gift`) sont aussi acceptés.

   Les élèves le reçoivent à leur connexion. Redéposer un fichier du même nom le met à jour ; supprimer la ressource retire l'atelier.
4. **Suivre** : onglet **Suivi** de la Centrale, atelier `technostudio`.
   - Chaque feuille notée est une colonne, par exemple `charte-lampe-de-poche/P1`. Elle indique le nombre de réponses faites, le score et l'état « terminé ».
   - Les réponses ouvertes (questions, programme, compte rendu) sont dans les détails de la page **Travail** de l'élève.

Côté élève :

- **Mon code** (en haut à droite) ;
- ou le **portail** de la Centrale, qui ouvre TechnoStudio déjà connecté, directement sur une feuille si le parcours le demande. Le bouton « ← Mes ateliers » apparaît alors dans la barre de menus.

Données enregistrées sur la Centrale, pour l'atelier `technostudio` :

| Clé | Contenu |
|---|---|
| `at/<id atelier>` | réponses de l'élève pour un atelier, fusionnées réponse par réponse entre plusieurs postes |
| `code/projet` | son programme libre de l'atelier Code |

Le serveur ne reçoit ni nom ni prénom : seulement la classe, le numéro et l'identifiant (`4C-LHA-LoutreAgile`).

> Copie de secours : ajoutez `technostudio https://github.com/grandiosian/TechnoStudio` dans `miroirs.txt` de la Centrale. L'appli sera aussi servie à `https://technoversailles.alwaysdata.net/miroir/technostudio/`. Ajoutez cette adresse en adresse de secours de l'atelier.

## 2. Compilation des cartes (hébergée par la Centrale)

Le programme de l'élève part à la Centrale, `https://technoversailles.alwaysdata.net/api/compilation.php`, qui renvoie :

| Carte | Ce qui revient | Ce qu'en fait le navigateur |
|---|---|---|
| Arduino Uno / Nano | `.hex` (arduino-cli, `arduino:avr`) | l'écrit par USB (Web Serial, STK500 ; vitesse du bootloader trouvée seule) |
| ESP32 (C++) | images `.bin` (arduino-cli, `esp32:esp32` 2.0.17) | les écrit par USB (esptool-js ; bouton BOOT sur certaines cartes) |
| micro:bit | `.hex` universel V1/V2 = MicroPython + `main.py` | l'enregistre : à glisser sur le lecteur **MICROBIT**, sans rien installer avant |
| ESP32 MicroPython | (pas de compilation) | `main.py` envoyé directement par le câble |

**Installation : automatique.**

- Le workflow **« Chaîne de compilation »** du dépôt `centrale` utilise les secrets SSH déjà configurés pour la Centrale. Il :
  - envoie `serveur-compilation/` dans `~/technostudio-compilation/code/` ;
  - lance `installer-centrale.sh` : arduino-cli dans `~/bin`, cœurs Arduino et ESP32, MicroPython micro:bit ;
  - compile un essai par carte sur le serveur, puis vérifie l'API en ligne.
- Il tourne :
  - à chaque modification de `public/api/compilation.php` ou du workflow ;
  - chaque nuit (pour reprendre les mises à jour de ce dépôt) ;
  - à la demande : Actions → Chaîne de compilation → Run workflow.
- Rien n'est placé dans le site de la Centrale, sauf `api/compilation.php`, qui lit `~/technostudio-compilation/config.json`.

**Accès** :

- Un élève connecté à la Centrale compile sans rien faire de plus : le jeton est vérifié par la Centrale.
- Un enseignant peut compiler sans code élève avec la **clé enseignant** créée à l'installation.
  - Pour la lire : `cat ~/technostudio-compilation/config.json` en SSH.
  - Pour l'utiliser : la saisir dans Compte → Réglages de connexion.

**Sécurité et limites** :

- Le code reçu est seulement compilé, jamais exécuté.
- Seules les bibliothèques connues peuvent être incluses. `#include "…"`, `asm`, `.incbin`, `#pragma`, `#line` et `#embed` sont refusés, pour que le préprocesseur ne puisse pas lire de fichiers du serveur.
- 15 compilations par minute et par élève, une compilation arduino-cli à la fois.
- Les résultats sont en cache, si bien qu'une classe qui compile le même exemple n'occupe le processeur qu'une fois.
- Une compilation de plus de 25 s (premier ESP32) continue en arrière-plan, et l'appli attend son résultat.

**Autre hébergement** : `serveur-compilation/serveur.js` est un serveur Node autonome, avec les mêmes règles et le même compilateur (`compilation.js`). Il s'installe avec `installer.sh`, et son adresse se règle dans Compte → Réglages de connexion.

**Vérification** : à chaque envoi, GitHub installe le compilateur avec le script du serveur, puis compile pour chaque carte les programmes produits par les blocs (`tests/croquis/`).

**Sans internet** : le pont local (`pont/`) compile et téléverse depuis un poste équipé.

| Système | Installation | Lancement |
|---|---|---|
| macOS | `bash pont/installer-mac.sh` | `pont/demarrer-pont.command` |
| Windows | `pont/installer-windows.ps1` | `pont/demarrer-pont.bat` |
| Linux | `bash pont/installer-linux.sh` | `node pont/pont.js` |

## 3. Créer des ateliers

**Fichier → Nouvel atelier** ou **Convertir une fiche papier** (PDF, photos, texte GIFT), avec le profil Enseignant (Compte → Mon profil).

L'éditeur montre la feuille telle que l'élève la verra :

- **Propriétés** : modifier le champ sélectionné ;
- **Insertion** : ajouter un champ ;
- **Feuilles** : gérer les feuilles P / R / S / E et la version SEGPA ;
- **Fiche pédagogique** : compétences, déroulement.

Chaque atelier est vérifié avec le descripteur avant d'être diffusé ou reçu.

## 4. Passerelle avec la Centrale

TechnoStudio publie **`centrale.json`** à la racine de son site (`https://grandiosian.github.io/TechnoStudio/centrale.json`) :

- c'est le même format que NetSim, `passerelle.atelier` v1 ;
- la version lisible est [`PASSERELLE.md`](PASSERELLE.md) ;
- le point d'accès JavaScript est `window.TechnoStudio`.

Le fichier est **produit par le code** (`node tools/centrale-json.js`), à partir de `js/passerelle.js`, que l'appli utilise pour ses envois, et de `js/descriptor.js`. La vérification GitHub échoue s'il n'est pas à jour ou pas conforme au schéma.

La spécification commune, son schéma JSON et un modèle vierge sont dans [`docs/passerelle-atelier/`](docs/passerelle-atelier/SPECIFICATION.md), à reprendre dans le dépôt de la Centrale.

```bash
node tools/centrale-json.js                 # régénérer centrale.json
npm i --no-save ajv@8 && node tools/valider-centrale-json.js centrale.json ../NetSim/centrale.json
node tools/verifier-ateliers.js mon-atelier.technostudio.json   # vérifier des ateliers produits ailleurs
node tools/descripteur-doc.js               # régénérer docs/descripteur-ateliers.md
```

**Codes élèves** : ils sont gérés uniquement par la Centrale. TechnoStudio affiche le formulaire de son module (`Centrale.afficherConnexion`) ou reçoit le jeton du portail. Il ne lit, ne contrôle et ne garde aucun code.

## 5. Développer

Le JavaScript s'exécute sans compilation : modifier `js/`, puis recharger. Les commandes utiles :

```bash
python3 -m http.server 8000                 # http://localhost:8000/?centrale=http://localhost:8081/
node tools/build.js && node tools/centrale-json.js   # à faire avant chaque envoi
node tests/stk500.test.js                   # téléversement Arduino contre un faux bootloader
node tests/serveur-regles.test.js           # règles du serveur de compilation
node tests/compilation.test.js <centrale> <code>  # serveur de compilation (faux arduino-cli) + Centrale
node tests/centrale.e2e.js <appli> <centrale> <codes.json> <base.sqlite>  # Playwright, Centrale PHP locale
```

Pour lancer une Centrale locale : `php -S 127.0.0.1:8081 -t public` dans le dépôt `centrale`, en ajoutant `http://127.0.0.1:8000` dans Sites autorisés.

Pour forcer la mise à jour des postes, changez `CACHE` dans `sw.js`.

## Limites connues

- Téléversement USB : **Chrome ou Edge sur ordinateur** (Web Serial). Sur un autre navigateur, il reste l'export du `.ino` ou de `main.py`.
- Je n'ai pas pu tester une compilation réelle par arduino-cli, ni un téléversement sur une carte physique, dans mon environnement. Ce qui a été vérifié :
  - le protocole STK500, contre un faux bootloader ;
  - le serveur, avec un faux arduino-cli ;
  - la Centrale, de bout en bout, avec sa vraie version PHP.
- ESP32 : certaines cartes demandent de maintenir le bouton **BOOT** au début du téléversement.
