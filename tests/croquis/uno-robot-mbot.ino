// Programme généré par TechnoStudio — mBot (carte mCore, compilée comme une Arduino Uno)
// Sans bibliothèque Makeblock : les broches de la carte mCore sont pilotées directement.

float compteur = 0;
float vitesse = 0;

unsigned long chrono0 = 0;

void attendre(float s) {
  if (s > 0) delay((unsigned long)(s * 1000));
}

// Moteurs : M1 = roue gauche (vitesse D6, sens D7), M2 = roue droite (vitesse D5, sens D4)
void moteurs(float g, float d) {
  g = constrain(g, -100, 100);
  d = constrain(d, -100, 100);
  digitalWrite(7, g >= 0 ? LOW : HIGH);   // M1 est monté à l’envers
  analogWrite(6, (int)(fabs(g) * 2.55));
  digitalWrite(4, d >= 0 ? HIGH : LOW);
  analogWrite(5, (int)(fabs(d) * 2.55));
}

// Capteur à ultrasons Makeblock sur le port 3 : une seule broche (A3) pour déclencher et écouter
float distanceCm() {
  pinMode(A3, OUTPUT);
  digitalWrite(A3, LOW);
  delayMicroseconds(2);
  digitalWrite(A3, HIGH);
  delayMicroseconds(10);
  digitalWrite(A3, LOW);
  pinMode(A3, INPUT);
  long t = pulseIn(A3, HIGH, 25000);
  if (t == 0) return 400;
  return t / 58.0;
}

// Suiveur de ligne sur le port 2 : capteur gauche D9, droit D10 (LOW = noir)
bool ligneNoire(int capteur) {
  return digitalRead(capteur) == LOW;
}

// Capteur de lumière de la carte (A6), en %
float lumiere() {
  return analogRead(A6) * 100.0 / 1023.0;
}

// Bouton de la carte (A7) : appuyé quand la tension tombe
bool boutonCarte() {
  return analogRead(A7) < 100;
}

// 2 LED RGB (WS2812) sur D13 = PB5. Envoi bit à bit, interruptions coupées.
uint8_t leds[6];   // vert, rouge, bleu pour chaque LED
void ledsEnvoyer() {
  noInterrupts();
  for (uint8_t i = 0; i < 6; i++) {
    uint8_t o = leds[i];
    for (uint8_t k = 0; k < 8; k++) {
      if (o & 0x80) { PORTB |= _BV(5); __builtin_avr_delay_cycles(10); PORTB &= ~_BV(5); __builtin_avr_delay_cycles(3); }
      else { PORTB |= _BV(5); __builtin_avr_delay_cycles(3); PORTB &= ~_BV(5); __builtin_avr_delay_cycles(9); }
      o <<= 1;
    }
  }
  interrupts();
  delayMicroseconds(80);
}
// quelle : 0 = toutes, 1 = gauche, 2 = droite
void led(int quelle, uint8_t r, uint8_t v, uint8_t b) {
  for (int i = 0; i < 2; i++) {
    if (quelle == 0 || (quelle == 1 && i == 1) || (quelle == 2 && i == 0)) { leds[i * 3] = v; leds[i * 3 + 1] = r; leds[i * 3 + 2] = b; }
  }
  ledsEnvoyer();
}

// Buzzer de la carte sur D8
void son(float f, float s) {
  tone(8, (unsigned int)f);
  attendre(s);
  noTone(8);
}

void setup() {
  pinMode(4, OUTPUT); pinMode(5, OUTPUT); pinMode(6, OUTPUT); pinMode(7, OUTPUT);
  moteurs(0, 0);
  pinMode(9, INPUT); pinMode(10, INPUT);
  pinMode(13, OUTPUT);
  led(0, 0, 0, 0);
  Serial.begin(115200);
  chrono0 = millis();
  vitesse = random((long)(40), (long)(80) + 1);
  chrono0 = millis();
  led(0, 0, 150, 0);
  moteurs(60, 60);
  attendre(1.5);
  moteurs(0, 0);
  for (int i = 0; i < (int)(3); i++) {
    son(523, 0.1);
    compteur += 1;
  }
  while (!(boutonCarte())) {
    delay(1);
  }
  while (true) {
    if (distanceCm() < 15) {
      led(1, 150, 0, 0);
      moteurs(-50, -50);
      attendre(0.5);
      moteurs(0, 0);
      moteurs(-50, 50);
      attendre(0.4);
      moteurs(0, 0);
    } else {
      if (ligneNoire(9) && !(ligneNoire(10))) {
        moteurs(20, vitesse);
      } else {
        moteurs(((float)(vitesse) / (2)), ((float)(vitesse) / (2)));
      }
    }
    if (((millis() - chrono0) / 1000.0) > 30 || lumiere() == 0) {
      Serial.println(lumiere() * 2);
      moteurs(0, 0);
      while (!(compteur == 0)) {
        compteur += -1;
      }
      led(0, 0, 0, 0);
      attendre(0.2);
      moteurs(30, -30);
      moteurs(-40, -40);
      moteurs(-30, 0 - 30);
      Serial.println("fin");
    }
  }
}

void loop() {
}
