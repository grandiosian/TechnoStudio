#!/usr/bin/env bash
# TechnoStudio — installation du serveur de compilation (alwaysdata ou tout serveur Linux).
# À lancer une fois dans le terminal SSH du serveur :
#   bash ~/technostudio/serveur-compilation/installer.sh            (Arduino Uno/Nano + ESP32)
#   bash ~/technostudio/serveur-compilation/installer.sh --sans-esp32   (plus léger : Arduino seulement)
# Aucun droit administrateur nécessaire : tout va dans ~/bin et ~/.arduino15.
set -euo pipefail
ESP32=1
for a in "$@"; do [ "$a" = "--sans-esp32" ] && ESP32=0; done

echo "== TechnoStudio : serveur de compilation =="
mkdir -p "$HOME/bin"
if [ ! -x "$HOME/bin/arduino-cli" ]; then
  echo "→ Téléchargement d'arduino-cli…"
  ARCH=$(uname -m); case "$ARCH" in x86_64) F=Linux_64bit;; aarch64|arm64) F=Linux_ARM64;; armv7l) F=Linux_ARMv7;; *) echo "Architecture $ARCH non prévue"; exit 1;; esac
  curl -fsSL "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_${F}.tar.gz" | tar xz -C "$HOME/bin" arduino-cli
fi
CLI="$HOME/bin/arduino-cli"
"$CLI" version

[ -f "$HOME/.arduino15/arduino-cli.yaml" ] || "$CLI" config init >/dev/null
"$CLI" config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json 2>/dev/null || true
echo "→ Index des cartes…"
"$CLI" core update-index
echo "→ Cœur Arduino AVR (Uno, Nano)…"
"$CLI" core install arduino:avr
if [ "$ESP32" = 1 ]; then
  echo "→ Cœur ESP32 (long : environ 1 à 2 Go)…"
  "$CLI" core install esp32:esp32
fi
echo "→ Bibliothèques…"
"$CLI" lib install Servo
[ "$ESP32" = 1 ] && "$CLI" lib install ESP32Servo || true

echo "→ Essai de compilation…"
T=$(mktemp -d); mkdir -p "$T/essai"; printf 'void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,!digitalRead(13));delay(500);}\n' > "$T/essai/essai.ino"
"$CLI" compile --fqbn arduino:avr:uno "$T/essai" >/dev/null && echo "   Uno : OK"
[ "$ESP32" = 1 ] && "$CLI" compile --fqbn esp32:esp32:esp32 "$T/essai" >/dev/null && echo "   ESP32 : OK"
rm -rf "$T"

cat <<EOF

Installation terminée.
Sur alwaysdata : Web → Sites → Ajouter un site
  Type ............ Node.js
  Adresse ......... $(whoami).alwaysdata.net/compilation   (ou un sous-domaine)
  Commande ........ node $HOME/technostudio/serveur-compilation/serveur.js
  Variables ....... CENTRALE=https://$(whoami).alwaysdata.net/api/
                    ORIGINES=https://grandiosian.github.io,https://$(whoami).alwaysdata.net
Puis vérifiez : https://$(whoami).alwaysdata.net/compilation/etat
EOF
