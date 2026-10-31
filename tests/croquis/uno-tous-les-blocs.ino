// Programme généré par TechnoStudio — Arduino Uno
#include <Servo.h>

Servo servo_3;

void setup() {
  pinMode(0, OUTPUT);
  pinMode(3, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  servo_3.attach(3);
}

void loop() {
  digitalWrite(0, HIGH);
  analogWrite(3, 0);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  Serial.println("");
  servo_3.write(90);
  tone(3, 440, 200);
  delay(200);
}
