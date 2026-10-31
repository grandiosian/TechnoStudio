// Programme généré par TechnoStudio — ESP32 (Arduino C++)
#include <ESP32Servo.h>

Servo servo_2;

void setup() {
  pinMode(2, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  servo_2.attach(2);
}

void loop() {
  digitalWrite(2, HIGH);
  analogWrite(2, 0);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  Serial.println("");
  servo_2.write(90);
  tone(2, 440, 200);
  delay(200);
}
