# TechnoStudio — notes pour Claude

Ateliers de technologie au format de la charte (feuilles P, ressources, synthèse, évaluation, SEGPA) et programmation
de cartes (Arduino, ESP32, micro:bit) avec Blockly. Site statique, pas de framework. Détails : [README.md](README.md) ;
contrat avec la Centrale : [PASSERELLE.md](PASSERELLE.md). Vue d'ensemble : [../CLAUDE.md](../CLAUDE.md).

## Règles
- Textes visibles en français, simples (élèves de collège).
- **Mode atelier** (ouvert depuis le portail) : `app.regleAtelier('menu'|'bibliotheque'|'niveau')` suit les règles de l'atelier (`TL.passerelle.interfaceAtelier`, champ `interface` d'un atelier, publié dans `ateliers.json`). Par défaut, le logo n'ouvre plus de menu et `app.go('accueil')` (Mes ateliers, Ctrl+O) ramène au portail. Règle commune : SPECIFICATION de la Centrale, §2.6.
- **Le mode élève l'emporte** quand l'application vient du portail (`#centrale=`, `#retour=` ou `sessionStorage['centrale-retour']`), même si le navigateur a une session enseignant : `app.eleveCentrale`. Seul `?mode=enseignant` ouvre le mode enseignant. Exception : la session d'essai de l'enseignant (« Tester à la place d'un élève », `Centrale.session().essai`) affiche, juste après l'atelier au centre de la barre, l'interrupteur **Élève | Enseignant** (`app.basculerVue`, `app.vueProf`). La vue est gardée par la Centrale avec la session (`Centrale.vue()` / `changerVue()`), partagée avec le portail et les autres applications.
- **Charte graphique** : [CHARTE-GRAPHIQUE.md](CHARTE-GRAPHIQUE.md) (logo, couleurs clair / sombre, polices) est à respecter. Un changement de logo ou de couleur principale se fait d'abord dans ce document, puis dans le code et dans le portail de la Centrale (`centrale/public/index.php` : `LOGOS` et `.app-…`).
- La barre du haut suit la règle commune (SPECIFICATION de la Centrale §2.6, NetSim en référence). Une modification se reporte dans NetSim, Établi 3D et le portail.
- Le module `centrale-client.js` vient du serveur de la Centrale : testez une fonction récente avant de l'appeler et gardez l'ancien comportement en repli.
- **À chaque modification visible**, changez la version du cache dans `sw.js` (`technostudio-vX.Y.Z`) : sinon les postes de la salle gardent l'ancienne version.
- Ne jamais écrire `centrale.json` / `ateliers.json` à la main : `node tools/centrale-json.js` (la liste `fonctions_utilisees` est dans ce script).
- Ne renommez aucun identifiant d'atelier, de feuille (`atelier/P1`…) ni de clé de données.

## Carte de `js/`
- `app.js` : la coquille, avec :
  - la barre du haut :
    - `drawSync()` : widget de l'élève (`Centrale.nomAffiche()` : en vue Enseignant d'un essai, le nom de l'élève ou « pas désanonymisé » en italique ; redessiné par `Centrale.surChangementVue`) ; au clic, `Centrale.allerPortail`, en repli `Centrale.menuEleve` ;
    - `drawAtelier()` : pilule centrale, avec les libellés « Atelier » et « Feuille » ;
    - `placerCentre()` : place l'atelier au milieu, ou au plus près, et resserre la barre par paliers `serre-1…8` en commençant par masquer le nom (logo seul). Le titre de l'atelier reste jusqu'au palier 7 (coupé avec « … », la zone du centre est bornée à la place libre) ; le bouton de l'élève part avant lui ;
  - la sous-barre de la feuille (`.sous-barre` : choix de la feuille quand plusieurs sont ouvertes, 📚 Ressources) ;
  - **annuler / rétablir** (`TL.historique`) : chaque vue branche une source `lire()` / `ecrire()`, et les réponses de l'élève sont notées dans `app.saveProgress` ;
  - le lecteur d'atelier (`viewPlayer`) et le choix du mode élève / enseignant ;
  - le **pied de la feuille** (`buildNav` dans `viewPlayer`) : « ← » / « Étape n / N » / « Suivant → ». Ouvert depuis la Centrale (`Centrale.navigation`, branché dans `centrale.js` : `TL.centrale.nav`, événement `nav-centrale`), la suite vient de la Centrale : carte d'atelier du calendrier (activité suivante, page rechargée sur `#activite=`, verrouillée avec la raison), étape de parcours (après la dernière feuille, ou tout de suite si l'étape ne demande qu'une feuille), sinon la feuille suivante. Hors de la Centrale ou module plus ancien : inchangé.
- `centrale.js` (`TL.centrale` : connexion, `boutonPrecedent`, synchronisation), `panels.js`, `sheet.js` (feuilles), `editor2.js` (éditeur enseignant, avec annuler / rétablir branché sur `touch()`), `ressources.js`, `activities.js` / `demos*.js` (ateliers intégrés), `blocks.js` / `code.js` / `flash.js` / `mblock.js` / `robot.js` (programmation et cartes), `mesures.js` (suivi pendant l'atelier).
- `css/app.css` : toute la feuille de style (barre du haut en tête de fichier).
- `dist/technostudio-autonome.html` : version en un seul fichier, produite par `node tools/build.js`.

## Tester
- `for t in mesures robot mblock stk500 serveur-regles; do node tests/$t.test.js; done` puis `node tools/verifier-ateliers.js` : tout doit passer (CI : `.github/workflows/verifier.yml`).
- Après une modification de l'interface : `node tools/build.js`. Ensuite, vérifier dans le navigateur, servi localement ou dans la copie `centrale/public/miroir/technostudio/` d'une Centrale locale. Avant de recharger, désinscrire le service worker et vider ses caches.

## Publier
Push sur `main` → GitHub Pages et miroirs (`.github/workflows/`). Le miroir alwaysdata (construit avec `node tools/centrale-json.js && node tools/build.js`) ne se met à jour qu'au déploiement suivant de la Centrale (voir `../CLAUDE.md` §7).
