# Programme généré par TechnoStudio — Maqueen Lite (micro:bit, MicroPython)
from microbit import *
import utime
from machine import time_pulse_us
import neopixel
import music
import random

chrono0 = running_time()

def attendre(s):
    if s > 0:
        sleep(int(s * 1000))

# Moteurs : carte Maqueen à l’adresse I2C 0x10 (0 = gauche, 2 = droit ; sens 0 = avant)
def moteurs(g, d):
    for m, v in ((0, g), (2, d)):
        v = max(-100, min(100, v))
        i2c.write(0x10, bytes([m, 0 if v >= 0 else 1, int(abs(v) * 255 / 100)]))

# Capteur à ultrasons : déclenchement P1, écho P2
def distance_cm():
    pin1.write_digital(0)
    utime.sleep_us(2)
    pin1.write_digital(1)
    utime.sleep_us(10)
    pin1.write_digital(0)
    pin2.read_digital()
    t = time_pulse_us(pin2, 1, 25000)
    if t <= 0:
        return 400
    return round(t / 58, 1)

# Suiveurs de ligne : gauche P13, droit P14 (0 = noir)
def ligne_noire(p):
    return p.read_digital() == 0

# Niveau de lumière mesuré par l’écran de la micro:bit, en %
def lumiere():
    return display.read_light_level() * 100 // 255

# LED rouges P8 (gauche) et P12 (droite), 4 LED RGB sur P15
np = neopixel.NeoPixel(pin15, 4)
# quelle : 0 = toutes, 1 = gauche, 2 = droite
def led(quelle, r, v, b):
    allume = 1 if (r or v or b) else 0
    if quelle != 2:
        pin8.write_digital(allume)
    if quelle != 1:
        pin12.write_digital(allume)
    for i in range(4):
        if quelle == 0 or (quelle == 1 and i < 2) or (quelle == 2 and i >= 2):
            np[i] = (r, v, b)
    np.show()

# Buzzer sur P0 (interrupteur du buzzer sur ON)
def son(f, s):
    music.pitch(int(f), int(s * 1000))

compteur = 0
vitesse = 0

moteurs(0, 0)
led(0, 0, 0, 0)
vitesse = random.randint(int(40), int(80))
chrono0 = running_time()
led(0, 0, 150, 0)
moteurs(60, 60)
attendre(1.5)
moteurs(0, 0)
for i in range(int(3)):
    son(523, 0.1)
    compteur += 1
while not (button_a.is_pressed()):
    sleep(1)
while True:
    if distance_cm() < 15:
        led(1, 150, 0, 0)
        moteurs(-50, -50)
        attendre(0.5)
        moteurs(0, 0)
        moteurs(-50, 50)
        attendre(0.4)
        moteurs(0, 0)
    else:
        if ligne_noire(pin13) and not ligne_noire(pin14):
            moteurs(20, vitesse)
        else:
            moteurs(vitesse / 2, vitesse / 2)
    if ((running_time() - chrono0) / 1000) > 30 or lumiere() == 0:
        display.scroll(str(lumiere() * 2))
        moteurs(0, 0)
        while not (compteur == 0):
            compteur += -1
        led(0, 0, 0, 0)
        attendre(0.2)
        moteurs(30, -30)
        moteurs(-40, -40)
        moteurs(-30, 0 - 30)
        display.scroll(str("fin"))
