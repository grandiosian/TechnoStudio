#!/usr/bin/env bash
# Compile tests/croquis/* et un essai par carte ; chaque résultat devient une annotation GitHub
# (lisible dans l'onglet Actions et par l'API, même sans accès aux journaux).
# Utilisation : bash tests/compiler-croquis.sh <dossier du code du compilateur> <dossier de travail>
CODE="$1"; D="$2"; ko=0
annoter() { # niveau titre texte
  local t="${3//'%'/'%25'}"; t="${t//$'\n'/'%0A'}"; t="${t//$'\r'/}"
  echo "::$1 title=$2::${t:0:3500}"
}
cd "$(dirname "$0")/.." || exit 1
for f in tests/croquis/*; do
  b=$(basename "$f"); carte=${b%%-*}
  sortie=$(node "$CODE/compiler-cli.js" fichier "$carte" "$f" --dossier "$D" 2>&1); r=$?
  if [ $r -eq 0 ]; then annoter notice "$b" "$sortie"; else annoter error "$b" "$sortie"; ko=1; fi
done
for c in uno nano esp32 microbit; do
  sortie=$(node "$CODE/compiler-cli.js" essai $c --dossier "$D" 2>&1); r=$?
  if [ $r -eq 0 ]; then annoter notice "essai $c" "$sortie"; else annoter error "essai $c" "$sortie"; ko=1; fi
done
annoter notice "état" "$(node "$CODE/compiler-cli.js" etat --dossier "$D")"
exit $ko
