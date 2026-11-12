// TechnoStudio — mode direct du mBot (version 1)
// Le robot obéit aux ordres envoyés par TechnoStudio sur le câble USB (115200 bauds) :
//   H : présentation · M g d : moteurs · L q r v b : LED · T f : son · S : tout arrêter
//   C : capteurs → « C distance ligneG ligneD lumière boutonA boutonB »

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

char ligne[48];
uint8_t n = 0;
unsigned long dernier = 0;
bool roule = false;

void executer(char *c) {
  char k = c[0];
  char *p = c + 1;
  if (k == 'H') Serial.println(F("OK TS-ROBOT mbot 1"));
  else if (k == 'M') { float g = strtod(p, &p); float d = strtod(p, &p); moteurs(g, d); roule = g != 0 || d != 0; }
  else if (k == 'L') { int q = strtol(p, &p, 10); int r = strtol(p, &p, 10); int v = strtol(p, &p, 10); int b = strtol(p, &p, 10); led(q, r, v, b); }
  else if (k == 'T') { long f = strtol(p, &p, 10); if (f > 0) tone(8, f); else noTone(8); }
  else if (k == 'S') { moteurs(0, 0); roule = false; noTone(8); led(0, 0, 0, 0); }
  else if (k == 'C') {
    Serial.print(F("C "));
    Serial.print(distanceCm(), 1);
    Serial.print(ligneNoire(9) ? F(" 1") : F(" 0"));
    Serial.print(ligneNoire(10) ? F(" 1") : F(" 0"));
    Serial.print(' ');
    Serial.print((int)lumiere());
    Serial.print(boutonCarte() ? F(" 1") : F(" 0"));
    Serial.println(F(" 0"));
  }
}

void setup() {
  pinMode(4, OUTPUT); pinMode(5, OUTPUT); pinMode(6, OUTPUT); pinMode(7, OUTPUT);
  pinMode(9, INPUT); pinMode(10, INPUT); pinMode(13, OUTPUT);
  moteurs(0, 0);
  led(0, 0, 0, 0);
  Serial.begin(115200);
  Serial.println(F("OK TS-ROBOT mbot 1"));
}

void loop() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (n) { ligne[n] = 0; executer(ligne); n = 0; }
      dernier = millis();
    } else if (n < sizeof(ligne) - 1) ligne[n++] = ch;
  }
  // sécurité : plus aucun ordre depuis 1,5 s (câble débranché, onglet fermé) : le robot s’arrête
  if (roule && millis() - dernier > 1500) { moteurs(0, 0); roule = false; noTone(8); }
}
