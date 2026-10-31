# Programme généré par TechnoStudio — micro:bit (MicroPython)
from microbit import *

display.show(Image.HAPPY)
while True:
  if button_a.is_pressed():
    display.scroll(str(temperature()))
  sleep(100)
