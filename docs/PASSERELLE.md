# Descripteur de passerelle TechnoStudio

`technostudio-passerelle` · version **3.0.0** · format d’atelier **2** (formats acceptés : 1, 2)

> Document généré par `node tools/descripteur-doc.js` à partir de `js/descriptor.js`. Ne pas modifier à la main.

Le descripteur est le contrat entre l’application **centralisatrice** (la [Centrale élèves](https://github.com/grandiosian/centrale)) et l’application **cible** TechnoStudio. Il fixe la forme des ateliers que l’enseignant dépose dans la Centrale, la façon dont le travail des élèves y est rangé (clés, fusion, conflits), le compte rendu d’avancement (activités du suivi) et les points d’accès utilisés, y compris le serveur de compilation des cartes. L’appli et l’éditeur valident chaque atelier avec le même `validate()`. Version JSON : `docs/technostudio-descripteur.json`.

## Rôles

- **Centralisatrice** : la Centrale élèves : codes, portail, ressources (ateliers), sauvegarde, progression et suivi
- **Cible** : TechnoStudio (et tout outil qui produit des ateliers pour lui) : lecture des ateliers, travail des élèves, compte rendu d’avancement

## Entités

### Workshop


| champ | type | obligatoire |
|---|---|---|
| `format` | number (1, 2) |  |
| `id` | string /^[A-Za-z0-9-]+$/ | oui |
| `version` | number [1–…] |  |
| `title` | string | oui |
| `level` | string (college, sti2d, snt, pro) |  |
| `niveau` | string — 5e, 4e, 3e… (couleur de pastille) |  |
| `cycle` | number |  |
| `seq` | number — numéro « AT SEQ » |  |
| `duration` | number |  |
| `author` | string |  |
| `summary` | string |  |
| `problematique` | string |  |
| `objet` | string |  |
| `position` | number [0–9] |  |
| `competences` | string \| object[] |  |
| `presentation` | string |  |
| `synthese` | string |  |
| `evaluation` | string |  |
| `differenciation` | string |  |
| `materiel` | string |  |
| `deroulement` | object[] |  |
| `prof` | object — fiche professeur, jamais transmise aux élèves |  |
| `steps` | Step[] | oui |
| `updatedAt` | number |  |

### Step


| champ | type | obligatoire |
|---|---|---|
| `id` | string |  |
| `title` | string | oui |
| `kind` | string (feuille, ressource, synthese, evaluation) — Type de feuille de la charte : P, R, S, E. |  |
| `seance` | number [1–…] |  |
| `feuille` | number [1–…] |  |
| `segpa` | boolean |  |
| `verso` | boolean |  |
| `big` | boolean |  |
| `resume` | string |  |
| `objectif` | string |  |
| `consignes` | string |  |
| `numStart` | number |  |
| `blocks` | Block[] | oui |

### Answer


| champ | type | obligatoire |
|---|---|---|
| `value` | any |  |
| `done` | boolean |  |
| `correct` | boolean |  |
| `score` | number [0–1] |  |
| `attempts` | number [0–…] |  |
| `revealed` | boolean |  |
| `at` | number — horodatage ms (règle de fusion) |  |
| `pendingReview` | boolean |  |
| `teacher` | object |  |

### Progress


| champ | type | obligatoire |
|---|---|---|
| `wid` | string | oui |
| `step` | number |  |
| `answers` | object | oui |
| `seen` | object |  |
| `startedAt` | number |  |
| `updatedAt` | number |  |
| `completedAt` | number |  |

### State


| champ | type | obligatoire |
|---|---|---|
| `progress` | object | oui |
| `profile` | object |  |

### Session

réponse de login.php / session.php

| champ | type | obligatoire |
|---|---|---|
| `ok` | boolean |  |
| `classe` | string | oui |
| `eleve` | string — numéro dans la classe, ex. « 07 » (aucun nom sur le serveur) | oui |
| `identifiant` | string — ex. 4C-LHA-LoutreAgile |  |
| `jeton` | string | oui |
| `expire` | number |  |
| `espace` | object |  |

### Ressource

fichier déposé par l’enseignant (ressources.php) : un Workshop, un Workshop[] ou un Package

| champ | type | obligatoire |
|---|---|---|
| `nom` | string — <atelier>.technostudio.json (ou .gift / .txt GIFT) | oui |
| `taille` | number |  |
| `type` | string |  |
| `maj` | number | oui |

### Activite

colonne du tableau de suivi (activites.php)

| champ | type | obligatoire |
|---|---|---|
| `id` | string /^[A-Za-z0-9_./-]+$/ — <atelier>/<code feuille>, ex. charte-lampe-de-poche/P1 | oui |
| `titre` | string |  |
| `groupe` | string |  |
| `total` | number |  |

### ProgressionEnvoi

avancement d’une feuille (progression.php) ; la Centrale garde le meilleur

| champ | type | obligatoire |
|---|---|---|
| `activite` | string | oui |
| `titre` | string |  |
| `statut` | string (commence, termine) |  |
| `faites` | number |  |
| `total` | number |  |
| `score` | number |  |
| `score_max` | number |  |
| `details` | object — 20 Ko au plus |  |

### CompilationDemande


| champ | type | obligatoire |
|---|---|---|
| `carte` | string (uno, nano, esp32) | oui |
| `code` | string — C++ Arduino, 100 Ko au plus ; seules les bibliothèques connues peuvent être incluses | oui |

### CompilationReponse


| champ | type | obligatoire |
|---|---|---|
| `ok` | boolean | oui |
| `journal` | string |  |
| `erreur` | string |  |
| `format` | string (hex, bin) |  |
| `hex` | string |  |
| `images` | object[] |  |
| `duree` | number |  |
| `cache` | boolean |  |

### Package

paquet de plusieurs ateliers (.technostudio.json)

| champ | type | obligatoire |
|---|---|---|
| `workshops` | Workshop[] | oui |
| `classes` | string[] |  |

## Types de blocs

Champs communs à tous les blocs :

| champ | type |
|---|---|
| `id` | string /^[A-Za-z0-9_-]+$/ — Stable : la progression y est rattachée. Généré si absent. |
| `type` | string |
| `question` | string |
| `tag` | string (papier, ordi, none) — Étiquette PAPIER (bleue) / ORDI (verte) de la charte. |
| `num` | string — Numéro affiché (« 1. », « 1.6 »). Automatique si absent. |
| `comp` | string /^T\d/[] — Pastilles de compétences (calque _Comp), ex. T2C11. |
| `bareme` | number [0–…] — Barème (feuilles d’évaluation, total ramené sur 20). |
| `hint` | string |
| `explanation` | string |
| `corr` | string |
| `demo` | boolean |

| type | famille | noté | champs propres (obligatoires en gras) | forme de la réponse (`Answer.value`) |
|---|---|---|---|---|
| `text` | contenu | non | **md** | — |
| `image` | contenu | non | **src**, caption, alt | — |
| `svg` | contenu | non | svg, caption | — |
| `scan` | contenu | non | title, pages, open | — |
| `link` | contenu | non | **url**, title, text, kind | — |
| `ressource` | contenu | non | title, md, src, svg, caption, qr, qrLabel | — |
| `mots` | contenu | non | title, items | — |
| `objectif` | structure | non | label, md | — |
| `retenir` | structure | non | title, md | — |
| `decoupe` | structure | non |  | — |
| `filet` | structure | non |  | — |
| `qcm` | exercice | oui | **options**, multiple, shuffle | indices des options cochées |
| `vraifaux` | exercice | oui | **items**, labels | { indice: "v" | "f" } |
| `cloze` | exercice | oui | **text**, bank, bankExtra | string[] |
| `numeric` | exercice | oui | **answer**, tolerance, tolerancePct, unit, formula | string |
| `match` | exercice | oui | **pairs**, distractors | élément de droite relié à chaque élément de gauche |
| `order` | exercice | oui | **items** | number[] |
| `sort` | exercice | oui | **categories** | { idEtiquette: idZone } |
| `table` | exercice | oui | headers, **rows**, bank, firstRowHead | { "ligne-colonne": valeur } |
| `boxes` | exercice | oui | **items**, topLabel, bottomLabel, bank | object |
| `chain` | exercice | oui | **items**, infoIn, infoOut, energyIn, action | object |
| `label` | exercice | oui | src, svg, mode, **points**, distractors, bank | string[] |
| `bits` | exercice | oui | weights, **rows**, decimal, showCard | object[] |
| `graph` | exercice | oui | xmax, ymax, step, unit, tolerance, connect, showTable, **points** | object[] |
| `draw` | exercice | oui + correction enseignant | bg, ratio, colors, straight, grid | object |
| `mindmap` | exercice | oui | center, **branches** | object |
| `procedure` | exercice | oui | **items** | object |
| `questions` | exercice | oui + correction enseignant | title, mode, **items** | object |
| `report` | exercice | oui + correction enseignant | placeholder, photo, rows | object |
| `autoeval` | exercice | non | **items**, scale | object |
| `circuit` | simulation | oui | cols, rows, battery, palette, initial, goals | object |
| `blocks` | simulation | oui | **scene**, toolbox, vars, start, tests | object |
| `code` | simulation | oui + correction enseignant | **board**, start, toolbox, expect | object |

## Stockage et gestion

### Dans l’application

IndexedDB « technostudio », magasin « kv » (repli en mémoire si indisponible)

| clé | contenu |
|---|---|
| `profile` | profil local { name, role: "eleve"|"prof", classe } — le nom ne quitte jamais l’appareil |
| `ws:<id>` | Workshop modifié, importé ou reçu de la Centrale (source « centrale ») ; les démos intégrées ne sont pas stockées |
| `pg:<id>` | Progress de l’élève pour l’atelier <id> (copie de travail, même hors ligne) |
| `centrale:ressources:<serveur><app>` | { <nom de ressource>: { maj, ids[] } } : ressources déjà reçues |
| `code:projet` | projet libre de l’atelier Code { board, ws, at } |
| `ui:panels` | disposition des panneaux flottants (par mode) |

- Chaque réponse est écrite immédiatement dans IndexedDB, puis envoyée à la Centrale si l’élève est connecté.
- Un atelier de démonstration modifié devient une copie locale avec un nouvel id.
- Les champs inconnus d’un atelier reçu sont conservés tels quels à la réexportation.
- Réglages du navigateur (localStorage) : ts-centrale (adresse), ts-app (atelier), ts-compilateur (serveur de compilation).

### Dans la Centrale

Centrale élèves (PHP + SQLite, alwaysdata) : données JSON par élève, par atelier (app) et par clé ; 2 Mo par clé ; 10 versions d’historique

| élément | contenu |
|---|---|
| `app` | identifiant de l’atelier dans la Centrale : « technostudio » par défaut, ou la valeur de ?app= (ex. technostudio-5e) |
| `donnees at/<id atelier>` | Progress de l’élève pour cet atelier (fusionné réponse par réponse) |
| `donnees code/projet` | projet libre de l’atelier Code |
| `ressources (*.technostudio.json, *.gift)` | ateliers déposés par l’enseignant pour cet app, reçus à la connexion |
| `progression <id atelier>/<code feuille>` | ProgressionEnvoi : faites/total, score/score_max, statut, réponses à corriger dans details |
| `activites` | Activite[] : une colonne par feuille notée des ateliers reçus (sinon des ateliers du poste) |

## Synchronisation

L’appli garde la main hors ligne. Connecté, chaque modification est envoyée par le module centrale-client.js (regroupée toutes les 3 s), avec la date de la version lue : la Centrale refuse d’écraser un travail plus récent (409).

1. Connexion : code élève (login.php) ou jeton transmis par le portail (#centrale=…, session.php).
2. Réception : ressources.php → chaque fichier nouveau ou modifié (maj) est lu, validé avec ce descripteur, puis enregistré (ws:<id>, source « centrale ») ; les ressources retirées font disparaître leurs ateliers.
3. Chargement : donnees.php (liste) → pour chaque clé at/<id>, la copie du serveur est fusionnée avec celle du poste ; le résultat est renvoyé s’il diffère.
4. Fusion : réponse par réponse, celle dont « at » est le plus récent gagne ; « seen » est uni ; « step » suit la copie la plus récente.
5. À chaque réponse : sauver(at/<id>, Progress) puis, 4 s plus tard, progression.php pour chaque feuille notée modifiée.
6. Conflit (409, travail modifié sur un autre poste) : relire, fusionner, renvoyer.

**Déclenchement :** après chaque réponse (regroupé 3 s) ; au retour du réseau (le module renvoie la copie de secours) ; à la fermeture de l’onglet (dernier envoi) ; menu Centrale → Enregistrer et recharger.

**Conflits :** Deux postes qui répondent au même bloc : la réponse la plus récente gagne, l’autre est perdue pour ce bloc seulement. L’enseignant peut restaurer une version (historique de la Centrale).

## Authentification

| mode | règle |
|---|---|
| `jeton` | En-tête X-Jeton: <jeton> reçu de login.php (12 h, durée de l’onglet). Code élève du type 4C-LHA-9943-kfmz-tqpr. |
| `site` | Origine du site autorisée dans la Centrale (Réglages → Sites autorisés), sinon 403. |
| `compilation` | Serveur de compilation : X-Jeton de la Centrale (vérifié auprès d’elle, gardé 20 min) ou X-Cle enseignant ; OUVERT=1 sur un réseau local seulement. |
| `none` | Sans authentification. |
| `local` | Pont local (127.0.0.1:8765) : origine autorisée (localhost, réseau local, site de l’appli) ; aucun compte. |

## Points d’accès

| méthode | chemin | accès | envoi | réponse | erreurs |
|---|---|---|---|---|---|
| GET | `<Centrale>/api/` | none |  | { ok, service: "centrale-eleves", version } |  |
| POST | `<Centrale>/api/login.php` | site | { code, app } | Session | 401 code inconnu ; 403 site non autorisé ; 429 trop d’essais |
| GET | `<Centrale>/api/session.php?app=` | jeton |  | Session (passage depuis le portail) |  |
| POST | `<Centrale>/api/deconnexion.php` | jeton |  |  |  |
| GET | `<Centrale>/api/ressources.php?app=` | jeton |  | { ressources: Ressource[] } |  |
| GET | `<Centrale>/api/ressources.php?app=&nom=` | jeton |  | le fichier (atelier JSON ou GIFT) |  |
| GET | `<Centrale>/api/donnees.php?app=` | jeton |  | { cles: [{ cle, taille, maj }] } |  |
| GET | `<Centrale>/api/donnees.php?app=&cle=at/<id>` | jeton |  | { existe, valeur: Progress, maj } |  |
| POST | `<Centrale>/api/donnees.php` | jeton | { app, cle: "at/<id>", valeur: Progress, base } | { maj, espace } | 409 plus récent sur le serveur : relire et fusionner ; 413 2 Mo au plus ; 507 espace plein |
| POST | `<Centrale>/api/progression.php` | jeton | { app } & ProgressionEnvoi | { progression } | 413 details > 20 Ko |
| POST | `<Centrale>/api/activites.php` | jeton | { app, activites: Activite[] } |  |  |
| POST | `<Centrale>/api/surnom.php` | jeton | { surnom } | { identifiant, surnom } |  |
| GET | `<compilation>/etat` | none |  | { version, arduinoCli, cartes: { uno\|nano\|esp32: { installee } }, auth, file } |  |
| POST | `<compilation>/compiler` | compilation | CompilationDemande | CompilationReponse | 400 code refusé (directive ou bibliothèque non autorisée) ; 401 non connecté ; 429 12 compilations par minute au plus ; 503 serveur occupé ou carte non installée |
| GET | `http://127.0.0.1:8765/status` | local |  | { pont, arduinoCli, mpremote, cores } |  |
| GET | `http://127.0.0.1:8765/ports` | local |  | { ports: { address, label, board?, fqbn? }[] } |  |
| POST | `http://127.0.0.1:8765/compile` | local | { board, fqbn, code } | { ok, log, size? } |  |
| POST | `http://127.0.0.1:8765/upload` | local | { board, fqbn, code, port, lang } | { ok, log } |  |

## Compatibilité

Chaque atelier porte son numéro de format (champ « format ») ; l’appli lit les formats 1 et 2.

- Même format majeur : échange normal. Champs inconnus : conservés, jamais supprimés.
- Type de bloc inconnu côté cible : affiché comme « champ inconnu », la réponse est conservée, il ne compte pas dans le score.
- Atelier de format supérieur : accepté en lecture si validate() ne signale pas d’erreur bloquante, sinon ignoré avec la liste des écarts.
- Les identifiants (atelier, feuille, bloc) ne changent jamais d’une version à l’autre : sinon la progression des élèves est perdue.
- Les clés de la Centrale (at/<id>, code/projet) et les identifiants d’activité (<atelier>/<code feuille>) sont stables : les renommer ferait perdre le travail ou le suivi.

## Brancher une application ou un outil

1. **Produire un atelier** : un JSON conforme à l’entité `Workshop` (ou un `Package`), vérifié avec `validate()` de `js/descriptor.js` (Node : `require('./js/descriptor.js').validate('Workshop', atelier)`), nommé `<atelier>.technostudio.json`.
2. **Le diffuser** : le déposer dans la Centrale, espace enseignant → Ressources des ateliers, pour l’atelier `technostudio` (ou `technostudio-5e`, etc.).
3. **Lire le travail des élèves** : espace enseignant de la Centrale → Travail d’un élève → données `at/<id atelier>` (entité `Progress`) ; export ZIP de la classe.
4. **Suivre l’avancement** : onglet Suivi de la Centrale, atelier `technostudio` : une colonne par feuille notée (`<atelier>/<code feuille>`), réponses à corriger dans les détails.
5. **Compiler pour une carte** : `POST <compilation>/compiler` avec `CompilationDemande` et l’en-tête `X-Jeton` d’un élève connecté.
