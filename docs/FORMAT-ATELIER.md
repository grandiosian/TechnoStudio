# Format des ateliers TechnoStudio

Un atelier est un fichier JSON (`.technostudio.json`, **format 2**). L'éditeur le produit pour vous ; ce document sert aux échanges par la passerelle, aux scripts et aux corrections fines (bouton **JSON** de chaque bloc dans l'éditeur). La liste complète et à jour des champs est produite depuis le code : [descripteur-ateliers.md](descripteur-ateliers.md) (`node tools/descripteur-doc.js`). Pas à pas, de la fiche papier aux élèves : procédure de la Centrale, `passerelle/?doc=creer-atelier`.

## Structure

```json
{
  "format": 2,
  "id": "programmer-robots-mbot-maqueen",
  "version": 4,
  "title": "Programmer les robots mBot et Maqueen",
  "level": "college", "niveau": "5e", "cycle": 4, "seq": 2, "duration": 110,
  "author": "Pôle des Sciences et de la Technologie",
  "summary": "Programmer un robot avec des blocs, compiler puis téléverser.",
  "problematique": "Comment un même programme peut-il commander deux robots différents ?",
  "objet": "Robots mBot et Maqueen",
  "competences": [
    { "code": "T3C3", "label": "Concevoir, écrire, tester et mettre au point un programme",
      "sub": [ { "code": "T3C31", "label": "Écrire un programme", "ref": ["CCRI31.5.1", "CCRI31.5.2"] } ] }
  ],
  "deroulement": [ { "seance": "Séance 1", "objectif": "…", "activites": "…", "ressources": "Ressource 1" } ],
  "prof": { "organisation": "… jamais montré aux élèves" },
  "steps": [
    { "id": "p01", "title": "Séance 1 - Feuille 1", "kind": "feuille", "seance": 1, "feuille": 1,
      "blocks": [
        { "id": "p01-t", "type": "text", "md": "# 1. Mon premier programme" },
        { "id": "p01-q", "type": "questions", "comp": ["T3C31"], "items": [ { "q": "…", "corr": "…" } ] }
      ] },
    { "id": "r01", "title": "Ressources 1 et 2", "kind": "ressource",
      "blocks": [ { "id": "r01-1", "type": "ressource", "num": "1", "title": "Compiler et téléverser", "md": "…" } ] }
  ]
}
```

- `level` : `college`, `sti2d`, `snt` ou `pro` ; `niveau` (6e, 5e, 4e, 3e…) donne la couleur de la pastille ; `seq` (n° AT SEQ) sert au tri.
- Fiche pédagogique : `presentation`, `deroulement`, `synthese`, `evaluation`, `differenciation`, `materiel` (Markdown) ; `prof` n'est jamais transmis aux élèves.
- `interface` (facultatif) : `{ "menu": false, "bibliotheque": false, "niveau": false }`, ce que l'élève garde en mode atelier (ouvert depuis le portail).

## Identifiants : ce qui ne doit jamais changer

Le travail des élèves est rattaché aux identifiants. Une fois l'atelier publié :

- **`id` de l'atelier** : lettres sans accent, chiffres et tirets. L'éditeur le propose d'après le titre et le laisse modifier (panneau Fiche → Identifiant) **tant que l'atelier n'a jamais été publié** ; il est figé ensuite. « Modifier » un atelier publié garde son `id` ; « Dupliquer » en crée un autre.
- **Activité de la Centrale** = une feuille qui contient au moins un bloc noté. Son identifiant : `<id>/<code de la feuille>`, par exemple `programmer-robots-mbot-maqueen/P1`.
- **Code d'une feuille** : `kind` donne la lettre (`feuille` → P, `ressource` → R, `synthese` → S, `evaluation` → E ; SEGPA, `segpa: true` → `S·P1`). Le numéro d'une feuille P vient de `feuille` (ou de son rang) ; celui d'une feuille R, S ou E vient de son **rang** : insérer ou déplacer une feuille R/S/E change les codes suivants. Ajoutez les nouvelles feuilles à la fin.
- **`id` de chaque bloc** : unique dans tout l'atelier, la progression de l'élève y est rattachée. S'il manque, il est attribué automatiquement.
- **`version`** : l'éditeur l'augmente à la publication d'un atelier déjà publié dont le contenu a changé. Elle est recopiée dans `ateliers.json` et la Centrale l'affiche.

## Compétences

- `competences` : les compétences de la fiche (`T2C3`…) et leurs sous-compétences (`T2C31`…). Chacune peut porter `ref` : les codes du référentiel commun de la Centrale (`SFC31.5.1`…). Dans l'éditeur : « - T2C31 : intitulé → SFC31.5.1, SFC31.5.2 ».
- Une question notée porte des pastilles `comp` : un code de la fiche (`T3C31`), relié au référentiel par son `ref`, ou directement un code du référentiel. **Sans `ref`, la compétence n'arrive pas à la Centrale.** Une question notée sans pastille prend `referentiel` (capacités de l'atelier).
- Vérifier : Centrale → Ateliers → Inspecter (« aucun lien au référentiel » est signalé).

## Blocs

Champs communs : `id`, `type`, `question` (Markdown), `tag` (`papier`, `ordi` ou `none`), `num`, `comp` (pastilles), `bareme`, `bonus`, `hint` (indice après une erreur), `explanation` (après la réponse), `corr` (correction, enseignant), `demo` (démonstration non notée).

| famille | types |
|---|---|
| contenu (non noté) | `text`, `image`, `programme`, `svg`, `scan`, `link`, `ressource`, `mots` |
| mise en page | `objectif`, `retenir`, `decoupe`, `filet` |
| exercices notés | `qcm`, `vraifaux`, `cloze`, `numeric`, `match`, `order`, `sort`, `table`, `boxes`, `chain`, `label`, `bits`, `graph`, `mindmap`, `procedure` |
| notés, corrigés par l'enseignant | `draw`, `questions`, `report` (`autoeval` n'est pas noté) |
| simulations (notées) | `circuit`, `blocks`, `mblock`, `robot`, `code` |

Les plus courants :

| type | champs principaux |
|---|---|
| `text` | `md` |
| `image` | `src` (URL ou `data:`), `caption`, `alt` |
| `svg` | `svg` (code), `caption` |
| `scan` | `title`, `pages` (liste d'images), `open` |
| `link` | `url`, `title`, `text`, `kind` (`link` ou `video`) |
| `ressource` | `num` (numéro cité dans les feuilles : « ressource 2 » devient un lien), `title`, `md`, `src`, `program` |
| `qcm` | `options`: `[{ "text", "correct", "feedback" }]`, `multiple`, `shuffle` |
| `cloze` | `text` avec `[[réponse]]`, `[[variante1|variante2]]`, `[[!bonne|leurre|leurre]]` |
| `numeric` | `answer`, `tolerance` ou `tolerancePct`, `unit`, `formula` |
| `match` | `pairs`: `[["gauche", "droite"]]`, `distractors` |
| `order` | `items` dans le bon ordre |
| `sort` | `categories`: `[{ "name", "items": [] }]` |
| `chain` | `items`: `[{ "text", "slot" }]`, slot parmi `acquerir`, `traiter`, `communiquer`, `alimenter`, `distribuer`, `convertir`, `transmettre` ; `infoIn`, `infoOut`, `energyIn`, `action` |
| `label` | `src` ou `svg`, `points`: `[{ "x": %, "y": %, "answer" }]`, `distractors` |
| `procedure` | `items`: `[{ "text", "detail", "image", "warn" }]` |
| `questions` | `items`: `[{ "q", "corr" }]` |
| `report` | `placeholder`, `photo` (false pour interdire les photos) |
| `circuit` | voir ci-dessous |
| `blocks` | voir ci-dessous |
| `mblock` | `mode` (`sprite` ou `mbot`), `decor`, `toolbox`, `start`, `solution` (jamais montrée), `tests` |
| `robot` | `robot` (`mbot` ou `maqueen`), `robots`, `toolbox` (`rb_…`), `start`, `expect` |
| `code` | `board` (`uno`, `nano`, `esp32`, `esp32-mpy`, `microbit`), `start`, `toolbox`, `expect` |

Les images sont gardées dans le fichier (`data:image/…`, réduites à 1 400 px par l'éditeur) : au-delà de 1 à 2 Mo, les postes de la salle chargent l'atelier lentement.

### Simulateur de circuits

```json
{
  "type": "circuit", "cols": 6, "rows": 4,
  "palette": { "wire": -1, "lamp": 2, "switch": 1 },
  "initial": { "v-1-0": { "type": "battery", "v": 4.5, "label": "G1", "locked": true } },
  "goals": [ { "type": "parallel", "comp": "lamp" }, { "type": "switchControls" }, { "type": "noShort" } ],
  "demo": false
}
```

- Segments : `h-L-C` relie le nœud (ligne L, colonne C) à son voisin de droite ; `v-L-C` à son voisin du dessous.
- Composants : `wire`, `battery` (`v`, `dir`), `lamp`, `switch` (`closed`), `push`, `motor`, `led` (`color`, `dir`), `resistor` (`r` en Ω), `buzzer`, `ldr` (`light` 0–100).
- `palette` : nombre disponible pour l'élève, `-1` = illimité, absent = non proposé.
- Objectifs : `switchControls`, `noShort`, `lit` (`min`), `parallel`, `series`, `eachSwitch`, `ledSafe`, `motorDir` (`dir`: 1 ou -1), `darkOn`, `count` (`comp`, `n`).

### Programmation par blocs

```json
{
  "type": "blocks", "scene": "eclairage",
  "toolbox": ["forever", "ifelse", "set", "wait"],
  "vars": ["compteur"],
  "start": [],
  "tests": [
    { "name": "De nuit avec présence, la lampe s'allume",
      "init": { "luminosite": 10 },
      "steps": [ { "set": { "presence": 1 }, "run": 0.5, "expect": { "lampe": 1 } } ] }
  ]
}
```

| maquette | capteurs | actionneurs |
|---|---|---|
| `eclairage` | `presence`, `luminosite` (%) | `lampe` |
| `portail` | `telecommande`, `obstacle`, `fdc_ouvert`, `fdc_ferme` | `moteur` (-1 fermer, 0, 1 ouvrir), `gyrophare` |
| `serre` | `temperature`, `humidite`, `temp_ext` | `chauffage`, `ventilation`, `arrosage` |
| `parking` | `entree`, `sortie` | `barriere`, `voyant_complet`, `afficheur` (nombre) |
| `feux` | `bouton_pieton` | `rouge`, `orange`, `vert` |

Blocs : `forever`, `repeat` (`n`), `while`, `if`, `ifelse` (`else`), `wait` (`s`), `waituntil`, `set` (`target`, `value`), `setvar` (`name`, `value`), `changevar` (`name`, `by`), `say` (`text`, `{variable}` est remplacé par sa valeur).
Condition : `{ "a": "s:capteur" | "v:variable", "cmp": "=", "b": 1, "join": "et" | "ou", "c2": { … } }`.

Dans un test, `expect` vérifie un actionneur, un capteur, une variable ou un état de la maquette (`collision` pour le portail). Une valeur exacte, ou `{ "min": 17, "max": 24 }`.

## Conversion depuis du texte (fiche papier, Moodle)

Le convertisseur accepte le format **GIFT** de Moodle et quelques ajouts pour les fiches de technologie. Une question GIFT se termine par une ligne vide.

```
# Titre de l'atelier
## Nom d'une étape
Un paragraphe de cours, avec **gras** et *italique*.

[ ] Action de la procédure à cocher
[ ] Action suivante

::Q1:: Quel composant convertit l'énergie ? {=Le moteur#Bravo ~La pile ~L'interrupteur ####Le moteur convertit l'énergie électrique.}

::Q2:: La pile est un générateur. {T}

Une DEL se protège avec une {=résistance ~bobine ~pile} en série.

Le capteur est un {=détecteur =capteur} de position.

::Calcul:: I = 12 V ÷ 4 Ω, en A ? {#3:0.05}

::Assoc:: Associe {
=Moteur -> Convertir
=Carte -> Traiter
}

::Rédaction:: Explique le rôle du capteur. {}

!image: https://exemple.fr/schema.png | Schéma du système

!ordre: Remets dans l'ordre
- Appuyer sur la télécommande
- Le portail s'ouvre

!classer: Classe ces composants
Capteurs = bouton, photorésistance
Actionneurs = moteur, lampe
```

| écrit | devient |
|---|---|
| `{=bonne ~fausse}` | QCM |
| `{~%50%a ~%50%b ~c}` | QCM à plusieurs réponses |
| `{T}` / `{F}` | vrai / faux |
| texte `{=a ~b}` suite du texte | texte à trous (liste) |
| `{=a =b}` | texte à trous (saisie, plusieurs variantes acceptées) |
| `{#valeur:tolérance}` ou `{#min..max}` | calcul numérique |
| `{=x -> y …}` | association |
| `{}` | compte rendu |
| `[ ] …` | procédure pas à pas |
| `!ordre:` / `!classer:` / `!image:` | remise en ordre / classement / image |

Les caractères `: { } = ~ #` s'échappent avec `\` dans le texte des questions, comme dans Moodle.
