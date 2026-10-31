# Format des ateliers TechnoStudio

Un atelier est un fichier JSON (`.technostudio.json`). L'éditeur le produit pour vous ; ce document sert aux échanges par la passerelle, aux scripts et aux corrections fines (bouton **JSON** de chaque bloc dans l'éditeur).

## Structure

```json
{
  "format": 1,
  "id": "portail-4a",
  "title": "Le portail automatique",
  "level": "college",
  "duration": 55,
  "version": 1,
  "author": "M. Caruana",
  "summary": "Chaînes d'information et d'énergie, programme de commande.",
  "competences": ["Écrire, mettre au point et exécuter un programme"],
  "steps": [
    { "id": "e1", "title": "Observer", "blocks": [ { "type": "text", "md": "…" } ] }
  ]
}
```

- `level` : `college`, `sti2d`, `snt` ou `pro`.
- `id` : lettres, chiffres et tirets. Un même `id` publié de nouveau devient une nouvelle version.
- Chaque bloc peut avoir un `id` stable : la progression des élèves y est rattachée. S'il manque, il est attribué automatiquement (`e1-b1`, `e1-b2`…).
- Champs communs aux exercices : `question` (Markdown), `hint` (indice après une erreur), `explanation` (après la réponse).

## Blocs

| type | champs principaux |
|---|---|
| `text` | `md` |
| `image` | `src` (URL ou `data:`), `caption`, `alt` |
| `svg` | `svg` (code), `caption` |
| `scan` | `title`, `pages` (liste d'images), `open` |
| `link` | `url`, `title`, `text`, `kind` (`link` ou `video`) |
| `qcm` | `options`: `[{ "text", "correct", "feedback" }]`, `multiple`, `shuffle` |
| `cloze` | `text` avec `[[réponse]]`, `[[variante1|variante2]]`, `[[!bonne|leurre|leurre]]` |
| `numeric` | `answer`, `tolerance` ou `tolerancePct`, `unit`, `formula` |
| `match` | `pairs`: `[["gauche", "droite"]]`, `distractors` |
| `order` | `items` dans le bon ordre |
| `sort` | `categories`: `[{ "name", "items": [] }]` |
| `chain` | `items`: `[{ "text", "slot" }]`, slot parmi `acquerir`, `traiter`, `communiquer`, `alimenter`, `distribuer`, `convertir`, `transmettre` ; `infoIn`, `infoOut`, `energyIn`, `action` |
| `label` | `src` ou `svg`, `points`: `[{ "x": %, "y": %, "answer" }]`, `distractors` |
| `procedure` | `items`: `[{ "text", "detail", "image", "warn" }]` |
| `report` | `placeholder`, `photo` (false pour interdire les photos) |
| `circuit` | voir ci-dessous |
| `blocks` | voir ci-dessous |

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
