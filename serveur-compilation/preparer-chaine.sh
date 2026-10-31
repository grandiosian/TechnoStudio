#!/usr/bin/env bash
# TechnoStudio — prépare la chaîne de compilation complète SUR UNE MACHINE DE CONSTRUCTION
# (GitHub Actions, Linux x86_64), pour la copier ensuite telle quelle sur un hébergement qui
# limite la mémoire (alwaysdata : arduino-cli y est tué pendant l'installation des cœurs).
#
#   bash preparer-chaine.sh <dossier de sortie>            Uno, Nano et ESP32 (≈ 900 Mo)
#   ESP32=non bash preparer-chaine.sh <dossier de sortie>  Uno et Nano seulement (≈ 200 Mo)
#
# Produit, dans <sortie> :
#   bin/arduino-cli                 version fixée
#   arduino15/                      cœurs arduino:avr et esp32:esp32 (toolchains inutiles retirées),
#                                   index réduits aux seules versions installées (peu de mémoire)
#   Arduino/libraries/              Servo, ESP32Servo
# puis compile un essai Uno et ESP32 avec ce résultat.
set -euo pipefail
SORTIE="$(mkdir -p "$1" && cd "$1" && pwd)"
ICI="$(cd "$(dirname "$0")" && pwd)"
CLI_VERSION="${ARDUINO_CLI_VERSION:-1.1.1}"
ESP32_VERSION="${ESP32_VERSION:-2.0.17}"
export ARDUINO_DIRECTORIES_DATA="$SORTIE/arduino15"
export ARDUINO_DIRECTORIES_USER="$SORTIE/Arduino"
export ARDUINO_DIRECTORIES_DOWNLOADS="$SORTIE/telechargements"
export ARDUINO_BOARD_MANAGER_ADDITIONAL_URLS="https://espressif.github.io/arduino-esp32/package_esp32_index.json"
CLI="$SORTIE/bin/arduino-cli"

mkdir -p "$SORTIE/bin"
[ -x "$CLI" ] || curl -fsSL "https://downloads.arduino.cc/arduino-cli/arduino-cli_${CLI_VERSION}_Linux_64bit.tar.gz" | tar xz -C "$SORTIE/bin" arduino-cli
"$CLI" version
"$CLI" core update-index
"$CLI" core install arduino:avr
[ "${ESP32:-oui}" = non ] || "$CLI" core install "esp32:esp32@$ESP32_VERSION"
"$CLI" lib update-index
"$CLI" lib install Servo
[ "${ESP32:-oui}" = non ] || "$CLI" lib install ESP32Servo

# Outils propres aux autres puces ESP (S2, S3, C3…) : inutiles pour l'ESP32 classique
du -sh "$SORTIE/arduino15/packages/esp32/tools"/* 2>/dev/null | sort -h || true
for t in xtensa-esp32s2-elf-gcc xtensa-esp32s3-elf-gcc riscv32-esp-elf-gcc riscv32-esp-elf-gdb xtensa-esp-elf-gdb openocd-esp32; do
  rm -rf "$SORTIE/arduino15/packages/esp32/tools/$t"
done
# Bibliothèques précompilées des autres puces dans le cœur ESP32 (plusieurs centaines de Mo)
for sdk in "$SORTIE"/arduino15/packages/esp32/hardware/esp32/*/tools/sdk/*; do
  case "$(basename "$sdk")" in esp32) ;; *) rm -rf "$sdk" ;; esac
done
rm -rf "$ARDUINO_DIRECTORIES_DOWNLOADS" "$SORTIE/arduino15/staging"

# Index réduits : seules les versions installées (arduino-cli les charge en mémoire à chaque appel)
node "$ICI/filtrer-index.js" "$SORTIE/arduino15"
rm -f "$SORTIE/arduino15/library_index.json"* "$SORTIE/arduino15/"*.sig

echo "== Essais avec la chaîne préparée"
T=$(mktemp -d); mkdir -p "$T/essai"
printf '#include <Servo.h>\nServo s;\nvoid setup(){pinMode(13,OUTPUT);s.attach(9);}\nvoid loop(){digitalWrite(13,!digitalRead(13));delay(500);}\n' > "$T/essai/essai.ino"
"$CLI" compile --fqbn arduino:avr:uno "$T/essai"
printf '#include <ESP32Servo.h>\nServo s;\nvoid setup(){pinMode(2,OUTPUT);s.attach(13);}\nvoid loop(){digitalWrite(2,!digitalRead(2));delay(500);}\n' > "$T/essai/essai.ino"
[ "${ESP32:-oui}" = non ] || "$CLI" compile --fqbn esp32:esp32:esp32 "$T/essai"
rm -rf "$T"
# arduino-cli recrée parfois l'index des bibliothèques : inutile sur le serveur
rm -rf "$SORTIE/arduino15/library_index.json"* "$SORTIE/arduino15/staging" "$SORTIE/arduino15/"*.sig "$SORTIE/telechargements"
du -sh "$SORTIE"/* "$SORTIE/arduino15/packages"/* "$SORTIE"/arduino15/packages/esp32/hardware/esp32/*/tools/sdk/* 2>/dev/null || true
