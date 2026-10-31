// Programme généré par TechnoStudio — ESP32 (Arduino C++)
#include <ESP32Servo.h>

Servo servo_13;

long distanceCm(int trig, int echo) {
  pinMode(trig, OUTPUT); pinMode(echo, INPUT);
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long d = pulseIn(echo, HIGH, 30000);
  return d / 58;
}

void setup() {
  servo_13.attach(13);
  servo_13.write(0);
}

void loop() {
  if (distanceCm(5, 18) < 15) {
    servo_13.write(90);
    delay(3000);
  } else {
    servo_13.write(0);
  }
}
