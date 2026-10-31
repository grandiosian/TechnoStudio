#!/usr/bin/env bash
# TechnoStudio — installation (ou mise à jour) du compilateur sur le serveur de la Centrale.
# Lancé par le workflow « Chaîne de compilation » du dépôt centrale, en SSH, après l'envoi de ce
# dossier dans ~/technostudio-compilation/code/. Peut aussi être lancé à la main :
#   bash ~/technostudio-compilation/code/installer-centrale.sh
# Sans droit administrateur : arduino-cli dans ~/bin, cœurs dans ~/.arduino15.
# Idempotent : ce qui est déjà installé n'est pas refait.
set -uo pipefail

BASE="$HOME/technostudio-compilation"
CODE="$BASE/code"
TRAVAIL="$BASE/travail"
CLI="$HOME/bin/arduino-cli"
ESP32_VERSION="${ESP32_VERSION:-2.0.17}"
ESP32_URL="https://espressif.github.io/arduino-esp32/package_esp32_index.json"
etape() { printf '\n== %s\n' "$*"; }

mkdir -p "$HOME/bin" "$TRAVAIL/travaux"
chmod 700 "$BASE" "$TRAVAIL"

etape "Node.js"
NODE="$(command -v node || true)"
[ -z "$NODE" ] && for n in /usr/alwaysdata/node/*/bin/node; do [ -x "$n" ] && NODE="$n"; done
if [ -z "$NODE" ]; then echo "Node.js introuvable"; exit 1; fi
NODE="$(readlink -f "$NODE")"
"$NODE" --version

etape "arduino-cli"
if [ ! -x "$CLI" ]; then
  ARCH=$(uname -m); case "$ARCH" in x86_64) F=Linux_64bit;; aarch64|arm64) F=Linux_ARM64;; *) echo "Architecture $ARCH non prévue"; exit 1;; esac
  # version fixée (la « latest » peut être une préversion), repli sur la dernière si elle n'existe plus
  curl -fsSL "https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION:-1.1.1}_${F}.tar.gz" | tar xz -C "$HOME/bin" arduino-cli \
    || curl -fsSL "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_${F}.tar.gz" | tar xz -C "$HOME/bin" arduino-cli
fi
"$CLI" version
[ -f "$HOME/.arduino15/arduino-cli.yaml" ] || "$CLI" config init >/dev/null
"$CLI" config add board_manager.additional_urls "$ESP32_URL" 2>/dev/null || true
# Index rafraîchi au plus une fois par jour
if [ -z "$(find "$HOME/.arduino15" -maxdepth 1 -name 'package_index.json' -mtime -1 2>/dev/null)" ]; then "$CLI" core update-index; "$CLI" lib update-index >/dev/null; fi
[ -f "$HOME/.arduino15/library_index.json" ] || "$CLI" lib update-index >/dev/null

INSTALLES="$("$CLI" core list 2>/dev/null)"
etape "Cœur Arduino AVR (Uno, Nano)"
echo "$INSTALLES" | grep -q '^arduino:avr ' || "$CLI" core install arduino:avr
"$CLI" lib install Servo >/dev/null 2>&1 || true

etape "Cœur ESP32 $ESP32_VERSION"
if echo "$INSTALLES" | grep -q '^esp32:esp32 '; then
  echo "déjà installé"
else
  LIBRE=$(df -Pk "$HOME" 2>/dev/null | awk 'NR==2{print $4}')
  echo "espace libre : $((LIBRE / 1024)) Mo"
  if [ "${LIBRE:-0}" -gt 3000000 ]; then
    "$CLI" core install "esp32:esp32@$ESP32_VERSION" || echo "!! installation ESP32 impossible (voir ci-dessus)"
  else
    echo "!! moins de 3 Go libres : ESP32 non installé"
  fi
fi
"$CLI" lib install ESP32Servo >/dev/null 2>&1 || true

etape "MicroPython micro:bit"
mkdir -p "$CODE/microbit"
for u in https://github.com/bbcmicrobit/micropython/releases/download/v1.1.1/micropython-microbit-v1.1.1.hex \
         https://github.com/microbit-foundation/micropython-microbit-v2/releases/download/v2.1.2/micropython-microbit-v2.1.2.hex; do
  f="$CODE/microbit/$(basename "$u")"
  [ -s "$f" ] || curl -fsSL -o "$f" "$u"
done
ls -la "$CODE/microbit" | grep hex
if [ ! -d "$CODE/node_modules/@microbit/microbit-fs" ]; then (cd "$CODE" && npm install --omit=dev --no-audit --no-fund); fi

etape "Configuration lue par la Centrale (api/compilation.php)"
# Clés enseignant (en-tête X-Cle) : gardées d'une installation à l'autre ; une est créée la première fois.
# Pour la lire : cat ~/technostudio-compilation/config.json (jamais affichée dans les journaux).
CONF="$BASE/config.json"
"$NODE" -e "
const fs = require('fs'), crypto = require('crypto');
let c = {}; try { c = JSON.parse(fs.readFileSync('$CONF', 'utf8')); } catch (e) {}
const cles = Array.isArray(c.cles) && c.cles.length ? c.cles : [crypto.randomBytes(16).toString('hex')];
fs.writeFileSync('$CONF', JSON.stringify({ node: '$NODE', cli: '$CODE/compiler-cli.js', dossier: '$TRAVAIL', cles, installe: new Date().toISOString() }, null, 1));
console.log(JSON.stringify({ node: '$NODE', cli: '$CODE/compiler-cli.js', dossier: '$TRAVAIL', cles: cles.length + ' clé(s)' }));
"
chmod 600 "$CONF"
rm -f "$TRAVAIL/etat.json"

etape "Espace utilisé"
du -sh "$HOME/.arduino15" "$BASE" 2>/dev/null || true

etape "État"
"$NODE" "$CODE/compiler-cli.js" etat --dossier "$TRAVAIL"; echo
