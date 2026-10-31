// Programme généré par TechnoStudio — Arduino Nano
#include <Servo.h>

Servo servo_9;

long distanceCm(int trig, int echo) {
  pinMode(trig, OUTPUT); pinMode(echo, INPUT);
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long d = pulseIn(echo, HIGH, 30000);
  return d / 58;
}

void setup() {
  servo_9.attach(9);
  servo_9.write(0);
}

void loop() {
  if (distanceCm(7, 8) < 15) {
    servo_9.write(90);
    delay(3000);
  } else {
    servo_9.write(0);
  }
}
