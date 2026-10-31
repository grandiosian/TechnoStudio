# TechnoStudio

Ateliers de technologie au **format de la charte** (fiche pédagogique, feuilles P, ressources R, synthèse S, évaluation E, version SEGPA), simulations, et **programmation de cartes** Arduino, ESP32 et micro:bit avec Blockly.

- **Seul** : l'application s'ouvre dans le navigateur, avec ses ateliers intégrés, et fonctionne hors ligne. Le travail est gardé dans le navigateur.
- **Avec la [Centrale élèves](https://github.com/grandiosian/centrale)** : l'élève tape son code (ou arrive déjà connecté depuis le portail). Il reçoit alors les ateliers de son professeur et son travail est enregistré sur le serveur : il le retrouve sur n'importe quel poste. Son avancement remonte dans le tableau de suivi.
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
| `js/descriptor.js` | **descripteur de passerelle** : formats des ateliers et du travail, clés de la Centrale, points d'accès |
| `serveur-compilation/` | serveur Node.js (sans dépendance) autour d'arduino-cli, et son installateur |
| `pont/` | pont local facultatif, pour un poste équipé d'arduino-cli (salle sans internet) |
| `dist/technostudio-autonome.html` | toute l'appli en un seul fichier (double-clic, clé USB) |
| `docs/PASSERELLE.md` | le descripteur en clair (généré) · `docs/FORMAT-ATELIER.md` : format des ateliers et GIFT |
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

## 2. Serveur de compilation (cartes Arduino et ESP32)

Le C++ généré par Blockly est envoyé au serveur, qui renvoie le binaire. Le navigateur écrit ensuite ce binaire dans la carte par Web Serial :

- **Uno / Nano** : protocole STK500. Les deux vitesses de bootloader sont essayées, ce qui couvre les Nano anciennes et récentes.
- **ESP32** : esptool-js.
- **MicroPython** (ESP32, micro:bit) : pas de compilation. `main.py` est envoyé directement par le câble.

**Installation sur alwaysdata** (terminal SSH) :

```bash
git clone https://github.com/grandiosian/TechnoStudio ~/technostudio
bash ~/technostudio/serveur-compilation/installer.sh            # Uno, Nano et ESP32 (~2 Go)
# ou : bash ~/technostudio/serveur-compilation/installer.sh --sans-esp32
```

Ensuite, dans l'administration alwaysdata, **Web → Sites → Ajouter un site** :

| Réglage | Valeur |
|---|---|
| Type | Node.js |
| Adresse | `technoversailles.alwaysdata.net/compilation` |
| Commande | `node ~/technostudio/serveur-compilation/serveur.js` |
| Variables | `CENTRALE=https://technoversailles.alwaysdata.net/api/` et `ORIGINES=https://grandiosian.github.io,https://technoversailles.alwaysdata.net` |

Vérification : `https://technoversailles.alwaysdata.net/compilation/etat`. C'est l'adresse utilisée par défaut par l'appli. Une autre adresse se règle dans Compte → Réglages de connexion, ou avec `?compilateur=` dans l'adresse.

**Sécurité** :

- Seul un élève connecté à la Centrale peut compiler. Son jeton est vérifié auprès d'elle, sans effet de bord.
- Un enseignant peut compiler sans code élève avec une clé : variable `CLES=…`, saisie dans les réglages de l'appli.
- Le code reçu est seulement compilé, jamais exécuté. Le préprocesseur pourrait pourtant lire des fichiers du serveur : seules les bibliothèques connues peuvent donc être incluses. `#include "…"`, `asm`, `.incbin`, `#pragma`, `#line` et `#embed` sont refusés.
- Limites :
  - 12 compilations par minute et par élève ;
  - file d'attente de 40 demandes ;
  - les résultats sont mis en cache, si bien qu'une classe qui compile le même exemple n'occupe le processeur qu'une fois.

  Pour isoler complètement les fichiers de la Centrale, le serveur peut tourner sur un autre compte.

**Mise à jour automatique** : le workflow `.github/workflows/deployer-compilation.yml` envoie le dossier `serveur-compilation/` à chaque modification. Il faut ajouter dans GitHub les secrets `ALWAYSDATA_COMPTE` et `ALWAYSDATA_SSH_KEY`, les mêmes que pour la Centrale. Pour redémarrer le site automatiquement, ajoutez aussi `ALWAYSDATA_API_TOKEN` et la variable `ALWAYSDATA_SITE_ID`.

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

## 4. Passerelle (descripteur)

`js/descriptor.js` est la référence commune. Il décrit :

- les entités : `Workshop`, `Progress`, `Session`, `Ressource`, `Activite`, `ProgressionEnvoi`, `CompilationDemande` et `CompilationReponse` ;
- les 33 types de champs ;
- les clés de stockage dans le navigateur et dans la Centrale ;
- la fusion du travail entre postes ;
- les points d'accès utilisés.

Il est lisible dans l'appli (Centrale → Passerelle et descripteur) et dans `docs/PASSERELLE.md`.

```bash
node tools/verifier-ateliers.js mon-atelier.technostudio.json   # vérifier des ateliers produits ailleurs
node tools/descripteur-doc.js                                    # régénérer docs/PASSERELLE.md
```

## 5. Développer

Le JavaScript s'exécute sans compilation : modifier `js/`, puis recharger. Les commandes utiles :

```bash
python3 -m http.server 8000                 # http://localhost:8000/?centrale=http://localhost:8081/
node tools/build.js                         # régénère dist/technostudio-autonome.html (à faire avant chaque envoi)
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
