# TechnoStudio — mode direct du Maqueen (version 1)
# La micro:bit obéit aux ordres envoyés par TechnoStudio sur le câble USB (115200 bauds).
from microbit import *
import utime
import neopixel
import music
from machine import time_pulse_us

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

roule = False
dernier = running_time()
tampon = b""

def executer(l):
    global roule
    m = l.split(" ")
    k = m[0]
    if k == "H":
        uart.write("OK TS-ROBOT maqueen 1\n")
    elif k == "M":
        g = float(m[1])
        d = float(m[2])
        moteurs(g, d)
        roule = g != 0 or d != 0
    elif k == "L":
        led(int(m[1]), int(m[2]), int(m[3]), int(m[4]))
    elif k == "T":
        if int(m[1]) > 0:
            music.pitch(int(m[1]), -1, wait=False)
        else:
            music.stop()
    elif k == "S":
        moteurs(0, 0)
        roule = False
        music.stop()
        led(0, 0, 0, 0)
        display.show("D")
    elif k == "A":
        display.scroll(l[2:], wait=False)
    elif k == "I":
        display.show(getattr(Image, m[1]))
    elif k == "C":
        uart.write("C %s %d %d %d %d %d\n" % (distance_cm(), ligne_noire(pin13), ligne_noire(pin14), lumiere(), button_a.is_pressed(), button_b.is_pressed()))

moteurs(0, 0)
led(0, 0, 0, 0)
display.show("D")
uart.init(115200)
uart.write("OK TS-ROBOT maqueen 1\n")
while True:
    if uart.any():
        tampon += uart.read()
        while b"\n" in tampon:
            i = tampon.index(b"\n")
            ligne = tampon[:i]
            tampon = tampon[i + 1:]
            try:
                executer(str(ligne, "utf-8").strip())
            except Exception:
                pass
            dernier = running_time()
        if len(tampon) > 200:
            tampon = b""
    elif roule and running_time() - dernier > 1500:
        # sécurité : plus aucun ordre depuis 1,5 s : le robot s’arrête
        moteurs(0, 0)
        roule = False
        music.stop()
    sleep(2)
