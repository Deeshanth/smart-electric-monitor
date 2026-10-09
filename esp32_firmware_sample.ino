/*
  ESP32 Firmware Code for Smart Automated Electricity Billing & Monitoring System
  Hardware Setup:
    - ESP32 NodeMCU Wi-Fi
    - INA219 Current / Power Sensor (I2C: SDA=GPIO21, SCL=GPIO22)
    - 0.96" SSD1306 OLED Display (I2C 0x3C)
    - Tamper Push-Button (GPIO4 -> GND with Internal Pull-Up)
    - Status LED Indicator (GPIO2)

  IMPORTANT SAFETY NOTE:
    This is an educational prototype measuring low-voltage DC loads (e.g., 5V DC load).
    DO NOT CONNECT DIRECTLY TO 230V AC MAINS ELECTRICITY!
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ================= USER CONFIGURATION =================
const char* ssid     = "YOUR_WIFI_SSID";       // Replace with your Wi-Fi SSID
const char* password = "YOUR_WIFI_PASSWORD";   // Replace with your Wi-Fi Password

// Replace with your Laptop/Server IP address running the Dashboard backend
// Example: "http://192.168.1.100:5000/api/meter-data"
const char* serverApiUrl = "http://192.168.1.100:5000/api/meter-data";
const char* meterId      = "TN-MTR-001";

// ================= PIN MAPPING =================
#define TAMPER_BUTTON_PIN 4  // Push button connected to GPIO4 and GND
#define STATUS_LED_PIN    2  // Built-in LED on GPIO2

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// INA219 Sensor Instance
Adafruit_INA219 ina219;

// Energy Accumulator variables
float totalEnergyKWh = 0.0;
unsigned long lastTimeMs = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TAMPER_BUTTON_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 OLED allocation failed"));
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Smart Meter Booting...");
    display.display();
  }

  // Initialize INA219 Sensor
  if (!ina219.begin()) {
    Serial.println("Failed to find INA219 chip!");
  } else {
    Serial.println("INA219 Initialized.");
  }

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWi-Fi Connection Failed. Will retry in loop.");
  }

  lastTimeMs = millis();
}

void loop() {
  unsigned long now = millis();
  float deltaTimeHours = (now - lastTimeMs) / 3600000.0;
  lastTimeMs = now;

  // 1. Read Sensor Data from INA219
  float busVoltageV = ina219.getBusVoltage_V();
  float currentmA   = ina219.getCurrent_mA();
  float currentA    = currentmA / 1000.0;
  float powermW     = ina219.getPower_mW();
  float powerW      = powermW / 1000.0;

  if (powerW < 0) powerW = 0;
  totalEnergyKWh += (powerW / 1000.0) * deltaTimeHours;

  // 2. Read Physical Push-Button Tamper Sensor (Active LOW when pressed)
  bool isTampered = (digitalRead(TAMPER_BUTTON_PIN) == LOW);

  // Control Status LED
  if (isTampered) {
    digitalWrite(STATUS_LED_PIN, HIGH); // Turn LED ON on tamper
  } else {
    digitalWrite(STATUS_LED_PIN, LOW);
  }

  // 3. Update OLED Display
  updateOLED(busVoltageV, currentA, powerW, totalEnergyKWh, isTampered);

  // 4. Send JSON Data over Wi-Fi via HTTP POST to Dashboard
  if (WiFi.status() == WL_CONNECTED) {
    sendJsonToDashboard(busVoltageV, currentA, powerW, totalEnergyKWh, isTampered);
  } else {
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    WiFi.reconnect();
  }

  delay(2000); // Send data every 2 seconds
}

void updateOLED(float v, float a, float w, float kwh, bool tamper) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);

  display.print("Meter: ");
  display.println(meterId);

  display.print("V: "); display.print(v, 2); display.println(" V");
  display.print("I: "); display.print(a, 2); display.println(" A");
  display.print("P: "); display.print(w, 2); display.println(" W");
  display.print("E: "); display.print(kwh, 4); display.println(" kWh");

  display.setCursor(0, 54);
  if (tamper) {
    display.print("STATE: ! TAMPERED !");
  } else {
    display.print("STATE: SECURE");
  }
  display.display();
}

void sendJsonToDashboard(float v, float a, float w, float kwh, bool tamper) {
  HTTPClient http;
  http.begin(serverApiUrl);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON String
  String jsonPayload = "{";
  jsonPayload += "\"voltage\":" + String(v, 2) + ",";
  jsonPayload += "\"current\":" + String(a, 2) + ",";
  jsonPayload += "\"power\":" + String(w, 2) + ",";
  jsonPayload += "\"energy\":" + String(kwh, 6) + ",";
  jsonPayload += "\"tamper\":" + String(tamper ? "true" : "false") + ",";
  jsonPayload += "\"meter_id\":\"" + String(meterId) + "\"";
  jsonPayload += "}";

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    Serial.print("HTTP POST Success, Code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("HTTP POST Error Code: ");
    Serial.println(httpResponseCode);
  }

  http.end();
}
