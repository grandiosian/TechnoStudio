# Les ateliers ne sont plus publiés ici

Depuis le 16 novembre 2026, TechnoStudio ne garde dans son code que ses **ateliers intégrés** (les premiers pas) :
la lampe de poche (`charte-lampe-de-poche`), l'éclairage automatique (`demo-eclairage-premier-programme`) et
les circuits série et dérivation (`demo-circuits-serie-derivation`), écrits dans `js/demos.js` et `js/demos2.js`.

Tous les autres ateliers sont **transférés par la Centrale** : un fichier `<id>.json` par atelier, dans le dossier
[`ateliers/technostudio/`](https://github.com/grandiosian/centrale/tree/main/ateliers/technostudio) du dépôt de la Centrale.
TechnoStudio les demande à la Centrale quand un élève les ouvre, et en garde une copie sur le poste : ils s'ouvrent
même pendant une panne du serveur.

## Publier ou modifier un atelier

1. TechnoStudio (profil Enseignant) → Mes ateliers → **Modifier** (l'identifiant ne change pas) ou un nouvel atelier.
2. **Publier** → « Télécharger `<id>.json` ».
3. Sur GitHub, dans le dossier `ateliers/technostudio/` de la Centrale : **Add file → Upload files**, puis *Commit changes*.
   Le même nom remplace l'ancienne version (sa `version` doit être plus haute).
4. Le déploiement de la Centrale met l'atelier en ligne et dans son catalogue ; le vérifier avec Ateliers → **Inspecter**.

Règle complète : Centrale → `passerelle/ATELIERS-INTEGRES-ET-TRANSFERES.md`. Procédure : `passerelle/?doc=creer-atelier`.
