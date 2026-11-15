# Ateliers publiés avec TechnoStudio

Ce dossier contient les ateliers créés par les enseignants et publiés **avec l'application** : ils sont disponibles pour tous, sans serveur, comme les ateliers intégrés. Un fichier = un atelier, nommé d'après son identifiant : `<id>.technostudio.json`.

Procédure complète, de la fiche papier aux élèves : Centrale → Ateliers → « Procédure de création » (`passerelle/?doc=creer-atelier`). Format : [docs/FORMAT-ATELIER.md](../docs/FORMAT-ATELIER.md).

## Publier un nouvel atelier

1. Dans TechnoStudio (profil Enseignant), panneau **Fiche** de l'éditeur : donner un **identifiant** lisible (« Proposer » le tire du titre). Il ne pourra plus changer après la publication.
2. Fichier → Mes ateliers (créer, publier) → **Publier** sur la ligne de l'atelier → « Télécharger `<id>.technostudio.json` ».
3. Sur GitHub, dans ce dossier `ateliers/` : **Add file → Upload files**, déposer le fichier, valider (*Commit changes*).
4. La publication (GitHub Pages et la forge) vérifie l'atelier et refait `ateliers.json`, `centrale.json` et le fichier unique : l'atelier apparaît dans la bibliothèque de TechnoStudio quelques minutes plus tard. Une erreur dans le fichier bloque la publication : voir l'onglet *Actions*.
5. Pousser la Centrale (un commit vide suffit) pour mettre à jour sa copie, puis : Ateliers → « Imports et disponibilité » → TechnoStudio → **Mettre à jour**, et **Inspecter** l'atelier.

## Modifier un atelier publié

Dans Mes ateliers, section « Ateliers publiés avec TechnoStudio » : **Modifier**. L'atelier garde son identifiant, et le travail des élèves y reste rattaché. **Publier** propose alors la version suivante (augmentée automatiquement si le contenu a changé) ; redéposer le fichier, **du même nom**, dans ce dossier : il remplace l'ancien. Ensuite, étapes 4 et 5.

- Ne pas renuméroter les feuilles déjà utilisées : le code d'une feuille R, S ou E vient de son rang. Ajouter les nouvelles feuilles à la fin.
- **Dupliquer** fait un autre atelier (nouvel identifiant, sans le travail des élèves).
- **Abandonner** (dans Mes ateliers) efface les modifications de ce poste : la version publiée revient.

Pour retirer un atelier, supprimer son fichier : la Centrale le marque « retiré » au prochain import (le travail des élèves est gardé).

Chaque fichier est vérifié avec le descripteur des ateliers (`node tools/verifier-ateliers.js`, et la vérification GitHub).
