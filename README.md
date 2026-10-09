# Smart Automated Electricity Billing and Monitoring System

A complete, modern, hackathon-ready web dashboard and IoT monitoring solution designed for a **5-Day Student Project Exhibition Prototype**.

---

> [!CAUTION]
> **SAFETY DISCLAIMER**: This is an educational prototype measuring a **safe low-voltage DC load** (e.g., 5V DC load).
> **DO NOT CONNECT THE ESP32, INA219, BREADBOARD, OR PUSH BUTTON DIRECTLY TO 230V AC MAINS ELECTRICITY!**

---

## 🌟 Key Features

1. **Real-Time ESP32 Telemetry**: Displays Voltage (V), Current (A), Power (W), and Energy (kWh) streamed from ESP32 + INA219 sensor.
2. **Push-Button Tamper Detection**: Instant visual alarm (`🚨 METER TAMPERING DETECTED`) and status badge shift to `TAMPER ALERT` when the physical push button is pressed.
3. **High Power Consumption Threshold Warning**: Automatic detection banner (`⚠ HIGH CONSUMPTION DETECTED`) when load exceeds configured limit (default: 100 W).
4. **Automated Electricity Billing System**: Calculates units consumed ($Current - Previous$), applies configurable tariff rates (e.g., ₹8.00/unit), displays fixed meter charges, and generates a clean digital invoice (E-Bill).
5. **Monthly Bill Predictor & Load Tier**: Predicts monthly bill based on daily consumption rate with visual indicators (`LOW`, `NORMAL`, `HIGH`).
6. **Electricity Board (EB) Master Console**: Regional grid overview table tracking online/offline status, energy usage, and active security incidents across multiple meters.
7. **Chart.js Analytics**: Live power draw stream graph, 7-day energy usage bar chart, weekly usage trend, and 12-month consumption overview.
8. **Hackathon Demo Mode**: Dedicated simulator mode with quick action triggers ("Simulate High Consumption", "Simulate Tampering", "Reset Alert") ensuring zero presentation failures even if Wi-Fi or hardware fails during exhibition.

---

## 📁 Project Structure

```
smart_energy_monitor/
├── index.html                  # Main Dashboard Web Interface
├── style.css                   # Dark Smart Energy / IoT CSS Styling
├── script.js                   # Dashboard Controller, Chart.js logic & Demo Engine
├── esp32_firmware_sample.ino   # Ready-to-flash C++ Arduino sketch for ESP32
├── backend/
│   ├── server.js               # Node.js Express REST API server
│   ├── server.py               # Zero-dependency Python HTTP backend server
│   └── package.json            # Node.js dependencies
└── README.md                   # Project documentation & Exhibition guide
```

---

## 🔌 Hardware Setup & Schematic Pinout

### Required Components
- **ESP32 NodeMCU Development Board**
- **INA219 I2C Current & Power Sensor Module**
- **0.96" SSD1306 OLED Display (128x64 I2C)**
- **Push Button** (Simulates physical meter tampering)
- **LED Indicator** (Visual tamper alert)
- **Breadboard & Jumper Wires**
- **Low Voltage DC Power Load** (5V DC USB Fan, LED Bulb, or Resistor load)

### Wiring Connections

| Component Pin | ESP32 GPIO Pin | Description |
| :--- | :--- | :--- |
| **INA219 SDA** | GPIO 21 | I2C Data |
| **INA219 SCL** | GPIO 22 | I2C Clock |
| **OLED SDA** | GPIO 21 | Shared I2C Data |
| **OLED SCL** | GPIO 22 | Shared I2C Clock |
| **Push Button Pin 1** | GPIO 4 | Tamper Switch (INPUT_PULLUP) |
| **Push Button Pin 2** | GND | Ground |
| **Status LED Anode (+)** | GPIO 2 | Tamper Indicator |
| **Status LED Cathode (-)**| GND (via 220Ω) | Ground |
| **INA219 VCC / GND** | 3.3V / GND | Power |
| **INA219 VIN+ / VIN-** | Low Voltage DC Load | High-side current measurement |

---

## 📡 ESP32 API Format

The ESP32 communicates with the backend via **HTTP POST** sending JSON data.

### Endpoint URL
```http
POST http://<YOUR_LAPTOP_IP>:5000/api/meter-data
Content-Type: application/json
```

### JSON Payload Example
```json
{
  "voltage": 5.02,
  "current": 0.42,
  "power": 2.11,
  "energy": 0.0042,
  "tamper": false,
  "meter_id": "TN-MTR-001"
}
```

---

## 🚀 How to Run the Dashboard & Backend

### Option A: Using Python (Recommended - No Installation Required)
Since Python is installed on your system, you can run the backend with **zero setup**:

1. Open PowerShell / Command Prompt and navigate to the project backend directory:
   ```powershell
   cd "C:\Users\P R Deeshanth\.gemini\antigravity\scratch\smart_energy_monitor"
   python backend/server.py
   ```
2. Open your web browser and visit:
   ```
   http://localhost:5000
   ```

### Option B: Using Node.js (If Node is installed)
1. Open terminal in `backend/`:
   ```powershell
   cd "C:\Users\P R Deeshanth\.gemini\antigravity\scratch\smart_energy_monitor\backend"
   npm install
   npm start
   ```
2. Open your web browser at `http://localhost:5000`.

---

## 📶 Connecting your ESP32 to the Dashboard

1. Open `esp32_firmware_sample.ino` in Arduino IDE.
2. Install required libraries via Arduino Library Manager:
   - `Adafruit INA219`
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
3. Find your Laptop's Local Wi-Fi IP address (run `ipconfig` in Command Prompt). Example: `192.168.1.100`.
4. Update lines 23-25 in `esp32_firmware_sample.ino`:
   ```cpp
   const char* ssid     = "Your_WiFi_SSID";
   const char* password = "Your_WiFi_Password";
   const char* serverApiUrl = "http://192.168.1.100:5000/api/meter-data";
   ```
5. Flash the sketch to your ESP32.
6. Once connected to Wi-Fi, the ESP32 will automatically send sensor readings to your dashboard every 2 seconds!

---

## 🏆 Hackathon Presentation Walkthrough (Step-by-Step)

Follow this sequence for an impressive exhibition demonstration:

1. **Start Presentation**: Open `http://localhost:5000`. Point out the dark smart-energy dashboard, live parameters strip, and real-time Chart.js graphs.
2. **Show Live Telemetry**: Connect a DC load to the INA219. Show voltage (~5.0V), current (~0.42A), and power (~2.11W) updating live on both the OLED display and web dashboard.
3. **Show Energy Accumulation**: Point to "Today's Energy" increasing as current flows.
4. **Generate E-Bill**: Switch to the **Billing** tab. Click **Generate Digital E-Bill**. Show the official TNEB-style invoice modal with itemized tariff calculation and barcode. Click **Pay Bill (Simulated)** to show instant payment confirmation.
5. **Simulate High Consumption Alert**:
   - In Settings or header quick-actions, click **Simulate High Load**.
   - Point out the yellow alert banner: `⚠ HIGH CONSUMPTION DETECTED (145.8 W > 100 W)`.
   - Show how the EB Dashboard marks meter `TN-MTR-001` with a warning alert.
6. **Trigger Physical Meter Tampering (Main Live Highlight)**:
   - Press the physical push-button connected to GPIO4 on your ESP32 (or click **Simulate Tampering**).
   - The ESP32 LED turns **ON** and OLED displays `STATE: ! TAMPERED !`.
   - The dashboard instantly flashes the red warning card: `🚨 METER TAMPERING DETECTED!`.
   - Status badge shifts to pulsing red `TAMPER ALERT`.
7. **Show Electricity Board View**: Switch to **EB Dashboard** tab. Show how security inspectors receive real-time notification of tamper events across regional meters.
8. **Reset Alert**: Release push button or click **Reset Alert** to return the system to `SECURE` state.
