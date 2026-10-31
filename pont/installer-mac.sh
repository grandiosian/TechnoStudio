#!/bin/bash
# TechnoStudio — mise en place de la chaîne de compilation sur macOS.
# Installe (ou réutilise) arduino-cli, les cœurs Arduino AVR et ESP32,
# les bibliothèques Servo/ESP32Servo, mpremote (MicroPython), puis prépare le pont.
# Usage : bash installer-mac.sh [--demarrage-auto]
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ESP32_URL="https://espressif.github.io/arduino-esp32/package_esp32_index.json"
echo "== TechnoStudio : installation de la toolchain =="

IDE_CLI="/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli"
if command -v arduino-cli >/dev/null 2>&1; then CLI="$(command -v arduino-cli)"
elif [ -x "$IDE_CLI" ]; then CLI="$IDE_CLI"; echo "arduino-cli de l'IDE Arduino réutilisé."
elif command -v brew >/dev/null 2>&1; then brew install arduino-cli; CLI="$(command -v arduino-cli)"
else
  mkdir -p "$HOME/.local/bin"
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR="$HOME/.local/bin" sh
  CLI="$HOME/.local/bin/arduino-cli"
fi
echo "arduino-cli : $CLI"

"$CLI" config init --overwrite >/dev/null 2>&1 || true
"$CLI" config add board_manager.additional_urls "$ESP32_URL" || true
"$CLI" core update-index
"$CLI" core install arduino:avr
"$CLI" core install esp32:esp32
"$CLI" lib install Servo ESP32Servo

if ! command -v mpremote >/dev/null 2>&1; then
  if command -v pipx >/dev/null 2>&1; then pipx install mpremote; else python3 -m pip install --user mpremote; fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est nécessaire pour le pont : https://nodejs.org (ou brew install node)"; exit 1
fi

if [ "$1" = "--demarrage-auto" ]; then
  PL="$HOME/Library/LaunchAgents/fr.technostudio.pont.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>fr.technostudio.pont</string>
<key>ProgramArguments</key><array><string>$(command -v node)</string><string>$DIR/pont.js</string></array>
<key>EnvironmentVariables</key><dict><key>ARDUINO_CLI</key><string>$CLI</string><key>PATH</key><string>$PATH</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
</dict></plist>
PLIST
  launchctl unload "$PL" 2>/dev/null || true
  launchctl load "$PL"
  echo "Le pont démarrera automatiquement à chaque ouverture de session."
fi
echo "Installation terminée. Double-clique sur « demarrer-pont.command » pour lancer le pont."
