# Passerelle TechnoStudio ↔ Centrale

Ce document est le contrat entre deux applications :

- **la Centrale**, l'application centralisatrice : connexion des élèves, sauvegarde, progression, portail, parcours, suivi ;
- **TechnoStudio**, l'application cible.

Il résume les structures de données de TechnoStudio, la façon dont elles sont gérées, et ce que chaque côté s'engage à respecter. Il suit le même plan que les passerelles de [NetSim](https://github.com/grandiosian/NetSim/blob/main/PASSERELLE.md) et des autres ateliers.

La version lisible par une machine est **[`centrale.json`](centrale.json)**, au format commun `passerelle.atelier` v1 (spécification : [`docs/passerelle-atelier/`](docs/passerelle-atelier/SPECIFICATION.md)). Elle est servie à l'adresse :

```
https://grandiosian.github.io/TechnoStudio/centrale.json
```

`centrale.json` est **produit par le code de l'application** : `node tools/centrale-json.js`.

- Les activités sont calculées par `js/passerelle.js`, que l'appli utilise aussi pour ses envois.
- Les schémas viennent de `js/descriptor.js`.
- La vérification GitHub échoue si le fichier publié n'est plus à jour.

Ce que déclare le descripteur et ce que l'application envoie ne peuvent donc pas diverger.

---

## 1. Le descripteur d'atelier (`passerelle.atelier` v1)

| Section | Contenu chez TechnoStudio |
|---|---|
| `format`, `version` | `"passerelle.atelier"`, `1` |
| `atelier` | `app: "technostudio"`, nom, adresse, version. `parametres` : `?app=`, `?centrale=`, `?compilateur=` |
| `centrale` | module, serveur par défaut, site à autoriser (`https://grandiosian.github.io`), connexion, fonctions utilisées |
| `activites` | `liste` (feuilles notées des ateliers intégrés) et `dynamiques` (ateliers reçus en ressources) |
| `progression` | `faites`, `total`, `statut`, et aussi `score`, `score_max`, `details` |
| `donnees` | `at/{atelier}` (travail d'un atelier), `code/projet` (programme libre) |
| `fichiers` | `utilises: true` pour les **ressources** (ateliers déposés par l'enseignant) ; pas de dossier de projet |
| `stockage_local`, `acces_javascript`, `enums`, `$defs` | facultatifs, tous présents |
| `compilation` | section propre à TechnoStudio : le serveur de compilation des cartes |

### Règles à respecter

**Côté TechnoStudio**

- Une activité est une **feuille notée** : `id = <id atelier>/<code feuille>`, par exemple `charte-lampe-de-poche/P1`, ou `…/S-P1` pour une feuille SEGPA.
  - Les identifiants d'atelier, de feuille et de champ ne changent jamais d'une version à l'autre.
  - Un atelier modifié en profondeur reçoit un nouvel `id`.
- `Centrale.declarerActivites` envoie exactement `activites.liste`, dans le même ordre, suivie des activités des ateliers reçus. Celles-ci respectent le motif `activites.dynamiques.motif`.
- Chaque valeur passée à `Centrale.sauver` respecte le schéma de `donnees.<clé>.format`.
- `atelier.version` (= `TechnoStudio.version`) est augmentée à chaque changement du descripteur.
- L'application fonctionne sans la Centrale. Le module est chargé en parallèle et TechnoStudio ne bloque jamais sur lui.

**Côté Centrale** (comportement actuel)

- L'application est identifiée par `atelier.app`. Un enseignant peut ouvrir TechnoStudio sous un autre identifiant (`?app=technostudio-5e`) : ressources, données et suivi sont alors séparés.
- `faites` et `score` ne baissent jamais : le meilleur résultat est gardé.
- **Les codes élèves, leur format, leur saisie et leurs messages appartiennent à la Centrale.** TechnoStudio affiche le formulaire du module (`Centrale.afficherConnexion`). Il ne lit, ne contrôle et ne garde aucun code.
- Les clés et champs inconnus sont ignorés.

---

## 2. Les données de TechnoStudio

### Vue d'ensemble

```
                 ┌────────────── TechnoStudio (navigateur de l'élève) ──────────────┐
                 │                                                                    │
                 │  Ateliers : intégrés (js/demos*.js) + reçus (ws:<id>) + créés      │
                 │     └─ feuilles P / R / S / E (SEGPA) ─ champs (33 types)          │
                 │                                                                    │
                 │  Travail  pg:<atelier>  ──► IndexedDB « technostudio »             │
                 │     ├─ answers { <champ> : { value, done, score, at, … } }         │
                 │     ├─ step, seen, startedAt, updatedAt, completedAt               │
                 │  Code     code:projet { board, ws (Blockly), at }                  │
                 │                                                                    │
                 │  window.TechnoStudio  ◄── point d'accès unique                     │
                 └───────────────┬────────────────────────────────────────────────────┘
                                 │ centrale-client.js (si connecté)
     listeRessources / chargerRessource  ◄── ateliers *.technostudio.json, *.gift
     sauver / charger("at/<atelier>")    ◄─► travail, fusionné réponse par réponse
     sauver / charger("code/projet")     ◄─► programme libre
     progression("<atelier>/<feuille>")  ──► avancement, score, réponses à corriger
     declarerActivites(liste)            ──► colonnes du suivi
     activiteDemandee()                  ◄── ouverture directe depuis le portail
                                 ▼
                            Centrale (alwaysdata)
```

### Le travail d'un atelier (`at/{atelier}`)

Exemple réduit :

```json
{
  "wid": "charte-lampe-de-poche",
  "step": 1,
  "answers": {
    "p01-1": { "value": { "1": "interrupteur", "2": "pile" }, "done": true, "correct": true, "score": 1, "attempts": 1, "at": 1793432081000 },
    "p01-q1": { "value": { "0": "La pile fournit l'énergie" }, "done": true, "score": 1, "pendingReview": true, "at": 1793432090000 }
  },
  "seen": { "p01": true, "p02": true },
  "startedAt": 1793432000000, "updatedAt": 1793432090000, "completedAt": null
}
```

| Champ | Description |
|---|---|
| `answers.<champ>.value` | Réponse, dont la forme dépend du type de champ : voir [`docs/descripteur-ateliers.md`](docs/descripteur-ateliers.md). |
| `done`, `correct`, `score` (0 à 1) | État du champ ; `score × barème` donne les points. |
| `at` | Horodatage en ms : c'est la règle de fusion entre postes. |
| `pendingReview` | Réponse ouverte, à corriger par l'enseignant. |
| `step`, `seen` | Feuille en cours, feuilles déjà ouvertes. |

### La progression

Une activité par feuille notée, envoyée par `Centrale.progression(id, TechnoStudio.progression(id))` :

```json
{ "titre": "P1 · Séance 1 - Feuille 1", "faites": 4, "total": 6, "statut": "commence",
  "score": 3.5, "score_max": 6,
  "details": { "feuille": "Séance 1 - Feuille 1",
               "reponses": [ { "q": "Recopie et réponds…", "type": "questions", "r": "…", "aCorriger": true } ] } }
```

| TechnoStudio | Centrale | Règle |
|---|---|---|
| champs notés faits | `faites` | Jamais diminué (la Centrale garde le meilleur). |
| champs notés de la feuille | `total` | Fixé par l'atelier. |
| tous faits | `statut: "termine"` | Sinon `"commence"`. |
| Σ barème × réussite | `score` / `score_max` | Barème du champ (1 par défaut). |
| réponses ouvertes | `details.reponses` | 20 Ko au plus, tronqué au besoin ; les dessins sont remplacés par `[dessin]`. |

### Quand les données circulent

| Moment | TechnoStudio fait |
|---|---|
| Chargement de la page | Lit IndexedDB ; charge le module de la Centrale en parallèle (sans effet s'il est injoignable). |
| Connexion (formulaire de la Centrale, ou jeton `#centrale=`) | Dans l'ordre : `listeRessources()` puis lit les ateliers nouveaux ou modifiés, après validation ; `listeDonnees()` puis `charger("at/…")` et fusion ; renvoie ce qui est plus récent sur le poste ; `declarerActivites()` ; ouvre `activiteDemandee()`. |
| Chaque réponse | IndexedDB tout de suite, `sauver("at/<atelier>")` (regroupé à 3 s par le module), puis `progression()` 4 s plus tard, si la valeur a changé. |
| Conflit 409 (autre poste) | `charger`, fusion réponse par réponse, puis `sauver` immédiat. |
| Atelier Code | `sauver("code/projet")` à chaque modification ; `charger` à l'ouverture, la copie la plus récente gagne. |
| Déconnexion | Le module envoie ce qui reste ; TechnoStudio continue en local. |

---

## 3. Point d'accès JavaScript

`window.TechnoStudio` est le seul endroit où lire les données de TechnoStudio : pour un test, un autre module ou une autre application.

| Membre | Rôle |
|---|---|
| `TechnoStudio.app`, `TechnoStudio.version` | Identifiant de l'atelier en cours (`technostudio` ou `?app=`), et version (identique à `centrale.json`). |
| `TechnoStudio.activites()` | Liste envoyée à `declarerActivites`. |
| `TechnoStudio.catalogue()` | Ateliers du poste avec leurs feuilles notées. |
| `TechnoStudio.progression(id)` | `{titre, faites, total, statut, score, score_max, details}` ou `null`. |
| `TechnoStudio.donnees()` | Promesse `{ "at/<atelier>": …, "code/projet": … }`. |
| `TechnoStudio.valider(atelier)`, `estAtelier(atelier)` | Vérification d'un atelier avec le descripteur des ateliers. |

---

## 4. Faire évoluer TechnoStudio sans casser la Centrale

1. **Ajouter un atelier ou une feuille notée** : nouvel `id`, jamais réutilisé. Puis `node tools/centrale-json.js`.
2. **Changer la version** : modifier `VERSION` dans `js/passerelle.js`. Elle est reportée dans `atelier.version` et dans `TechnoStudio.version`.
3. **Vérifier** : `node tools/verifier-ateliers.js` pour les ateliers, `node tools/centrale-json.js` pour régénérer le descripteur. La vérification GitHub valide `centrale.json` avec le schéma commun.
4. **Changer la forme d'une donnée enregistrée** : mettre à jour `js/descriptor.js` (donc `$defs`) et garder la lecture de l'ancienne forme, puisque les élèves ont déjà du travail enregistré.

## 5. Pistes pour la suite

- **Ateliers transversaux** : TechnoStudio pourrait **produire** `programme.ino` ou `main.py` dans le dossier de projet, par exemple « Établi 3D modélise le boîtier, TechnoStudio programme la carte ». Il pourrait aussi **recevoir** un cahier des charges. Le format `recoit` / `produit` est déjà prévu par la spécification commune.
- **Centrale** : lire `centrale.json` depuis l'onglet Ateliers, pour remplir la fiche, les colonnes du suivi et la liste des ressources attendues.
