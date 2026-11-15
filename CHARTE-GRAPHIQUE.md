# Charte graphique — TechnoStudio

Ce document fixe l'identité visuelle de TechnoStudio. Il s'impose à l'application, au portail de la Centrale (cartes d'atelier, pastille du haut), aux fiches et aux documents qui la présentent.

Pour changer un élément, on modifie d'abord ce document, puis :
- le code de TechnoStudio (`css/app.css`, `TL.brandSvg` dans `js/app.js`, `icon.svg`) ;
- le portail de la Centrale (`centrale/public/index.php` : `LOGOS.technostudio` et la classe `.app-technostudio`).

Règles communes aux applications élèves (barre du haut, mesures) : [SPECIFICATION de la Centrale, §2.6](../centrale/public/passerelle/SPECIFICATION.md).

Les **feuilles d'atelier** elles-mêmes suivent la charte des fiches de technologie (couleurs `--sh-*`, voir le §3). Elle est distincte de l'interface de l'application.

## 1. Identité

| | |
|---|---|
| Nom | **TechnoStudio**, écrit « Techno**Studio** » dans la barre (« Studio » en gras) |
| Identifiant | `technostudio` (ne change jamais) |
| Rôle | Ateliers de technologie au format de la charte, et programmation de cartes (Arduino, ESP32, micro:bit) |
| Icône de secours | 🛠️ (`centrale.json`, champ `icone`) |

## 2. Logo

Un carré bleu aux coins arrondis, avec un T blanc dont les trois extrémités sont des nœuds. Celui de gauche est jaune.

```svg
<svg viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#2F57A1"/>
  <path d="M120 176h272M256 176v208" stroke="#fff" stroke-width="28" stroke-linecap="round"/>
  <circle cx="120" cy="176" r="30" fill="#F5C400"/>
  <circle cx="392" cy="176" r="30" fill="#fff"/>
  <circle cx="256" cy="384" r="34" fill="#fff"/>
</svg>
```

- **Où il se trouve** :
  - `TL.brandSvg()` dans `js/app.js` ;
  - `icon.svg`, ainsi que `icon-192.png` et `icon-512.png` pour l'installation.
- **Couleurs fixes** : le logo est le même en thème clair et en thème sombre, car le carré bleu porte son propre fond.
- **Tailles** :
  - barre du haut : 28 px ;
  - tuile du portail : 74 % de la tuile.
- **Interdits** :
  - changer le bleu du carré ;
  - changer la position du nœud jaune ;
  - enlever les coins arrondis ;
  - écrire dans le carré.

## 3. Couleurs

### Interface de l'application

| Rôle | Clair | Sombre | Variable |
|---|---|---|---|
| **Couleur principale** (portail : `--app`) | `#2F57A1` bleu TechnoStudio | `#8fa9ff` | `--accent` |
| Fond doux de la couleur principale | `#dbe3f6` | `#2b3556` | `--accent-soft` |
| **Bande des cartes du portail** (bleu clair, pour la distinguer du bleu marine de NetSim) | `#6f9bff` | `#8fb4ff` | portail : `--app-bande` |
| Barre et bureau | `#f4f6fb` / `#dfe3ec` | `#23262d` / `#16181d` | `--ui-bar`, `--ui-desk` |
| Panneaux | `#fbfcff` | `#2a2e37` | `--ui-panel` |
| Texte | `#1c2333` | `#e8ebf2` | `--ui-ink`, `--ink` |
| Texte secondaire | `#5d6679` | `#9aa3b5` | `--ui-muted`, `--muted` |
| Signal (jaune du logo) | `#e3a600` (logo : `#F5C400`) | idem | `--signal` |
| Réussite | `#1d7a43` | idem | `--ok` |
| Erreur | `#c0302d` | idem | `--bad` |
| Information | `#5b4fb0` | idem | `--info` |

### Blocs de programmation

| Famille | Couleur | Variable |
|---|---|---|
| Contrôle | `#c07a00` | `--cat-ctl` |
| Actions | `#2F57A1` | `--cat-act` |
| Variables | `#c4398f` | `--cat-var` |
| Sorties | `#1d7a6d` | `--cat-out` |

### Feuilles d'atelier (charte des fiches)

| Rôle | Couleur | Variable |
|---|---|---|
| Bandeau | `#C9D4F4` | `--sh-band` |
| Bleu des titres | `#2F57A1` | `--sh-blue` |
| Encre des titres | `#22348F` | `--sh-ink` |
| Marine | `#010958` | `--sh-navy` |
| Activité sur ordinateur | `#2FB844` | `--sh-ordi` |
| Compétence | `#F08C14` | `--sh-comp` |

### Filières

| Filière | Couleur | Variable |
|---|---|---|
| Collège | `#2a7a52` | `--lv-college` |
| STI2D | `#b4501f` | `--lv-sti2d` |
| SNT | `#6a47c2` | `--lv-snt` |
| Pro | `#1e6f9a` | `--lv-pro` |

## 4. Typographies

| Usage | Police | Variable |
|---|---|---|
| Logo, titres des feuilles | Arial Black (repli Archivo Black) | `--f-display` |
| Texte des feuilles | Arial (repli Arimo) | `--f-body` |
| Interface | police du système | `--f-ui` |
| Code | JetBrains Mono | `--f-mono` |

## 5. Règles d'usage

- **Barre du haut** : la référence commune. Faute de place, elle se resserre par paliers et le titre de l'atelier reste jusqu'au bout (`placerCentre`).
- **Feuilles d'atelier** : elles imitent la fiche papier de la charte de technologie. On ne les recolore pas avec les couleurs de l'interface.
- **Après chaque changement visible** : changer la version du cache dans `sw.js`.
- **Textes visibles** : en français, simples, pour des élèves de collège.
