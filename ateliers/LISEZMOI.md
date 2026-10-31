# Ateliers publiés avec TechnoStudio

Ce dossier contient les ateliers créés par les enseignants et publiés **avec l'application** : ils sont disponibles pour tous, sans serveur, comme les ateliers intégrés.

## Publier un atelier

1. Dans TechnoStudio (profil Enseignant) : Fichier → Mes ateliers → **Publier** sur la ligne de l'atelier → « Télécharger `<id>.technostudio.json` ».
2. Sur GitHub, dans ce dossier `ateliers/` : **Add file → Upload files**, déposer le fichier, valider (*Commit changes*).
3. La publication refait `ateliers.json`, `centrale.json` et le fichier unique : l'atelier apparaît dans la bibliothèque de TechnoStudio quelques minutes plus tard.
4. Dans la Centrale : Ateliers → « Ateliers des applications » → TechnoStudio → **Mettre à jour**.

Pour modifier un atelier publié, redéposer un fichier **du même nom** (l'identifiant de l'atelier ne change pas : le travail des élèves y reste rattaché). Pour le retirer, supprimer le fichier.

Chaque fichier est vérifié avec le descripteur des ateliers (`node tools/verifier-ateliers.js`, et la vérification GitHub).
