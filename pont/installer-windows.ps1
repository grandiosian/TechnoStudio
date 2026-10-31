# TechnoStudio — mise en place de la chaîne de compilation sous Windows (PowerShell)
# Clic droit > Exécuter avec PowerShell
$ErrorActionPreference = "Stop"
$esp32 = "https://espressif.github.io/arduino-esp32/package_esp32_index.json"
$cli = (Get-Command arduino-cli -ErrorAction SilentlyContinue).Source
$ide = Join-Path $env:LOCALAPPDATA "Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"
if (-not $cli -and (Test-Path $ide)) { $cli = $ide; Write-Host "arduino-cli de l'IDE Arduino réutilisé." }
if (-not $cli) {
  winget install --id ArduinoSA.CLI -e --accept-source-agreements --accept-package-agreements
  $cli = (Get-Command arduino-cli -ErrorAction SilentlyContinue).Source
  if (-not $cli) { $cli = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\arduino-cli.exe" }
}
& $cli config init --overwrite | Out-Null
& $cli config add board_manager.additional_urls $esp32
& $cli core update-index
& $cli core install arduino:avr
& $cli core install esp32:esp32
& $cli lib install Servo ESP32Servo
try { py -m pip install --user mpremote } catch { python -m pip install --user mpremote }
[Environment]::SetEnvironmentVariable("ARDUINO_CLI", $cli, "User")
Write-Host "Installation terminée. Double-clique sur demarrer-pont.bat pour lancer le pont."
