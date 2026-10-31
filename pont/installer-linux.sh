#!/bin/bash
# TechnoStudio — mise en place de la chaîne de compilation sur Linux (Debian, Ubuntu, Raspberry Pi OS…)
set -e
ESP32_URL="https://espressif.github.io/arduino-esp32/package_esp32_index.json"
mkdir -p "$HOME/.local/bin"
if ! command -v arduino-cli >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR="$HOME/.local/bin" sh
fi
CLI="$(command -v arduino-cli || echo "$HOME/.local/bin/arduino-cli")"
"$CLI" config init --overwrite >/dev/null 2>&1 || true
"$CLI" config add board_manager.additional_urls "$ESP32_URL" || true
"$CLI" core update-index
"$CLI" core install arduino:avr
"$CLI" core install esp32:esp32
"$CLI" lib install Servo ESP32Servo
python3 -m pip install --user mpremote || pipx install mpremote || true
# accès aux ports série sans sudo
if ! groups | grep -q dialout; then sudo usermod -aG dialout "$USER" && echo "Déconnecte-toi puis reconnecte-toi pour accéder aux ports série."; fi
echo "Installation terminée. Lance : node $(dirname "$0")/pont.js"
