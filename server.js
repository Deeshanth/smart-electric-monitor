/**
 * Backend API Server for Smart Automated Electricity Billing and Monitoring System
 * Framework: Node.js + Express
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON Parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Latest Meter State Store
let latestMeterReading = {
  voltage: 5.02,
  current: 0.42,
  power: 2.11,
  energy: 0.0042,
  tamper: false,
  meter_id: 'TN-MTR-001',
  timestamp: new Date().toISOString()
};

// Log History Store
let meterHistory = [];
let alertLogs = [];

/**
 * POST /api/meter-data
 * Endpoint for ESP32 to send JSON readings via HTTP POST.
 * Expected JSON payload:
 * {
 *   "voltage": 5.02,
 *   "current": 0.42,
 *   "power": 2.11,
 *   "energy": 0.0042,
 *   "tamper": false,
 *   "meter_id": "TN-MTR-001"
 * }
 */
app.post('/api/meter-data', (req, res) => {
  const { voltage, current, power, energy, tamper, meter_id } = req.body;

  if (voltage === undefined || current === undefined || power === undefined) {
    return res.status(400).json({ error: 'Missing required meter data fields (voltage, current, power)' });
  }

  latestMeterReading = {
    voltage: parseFloat(voltage),
    current: parseFloat(current),
    power: parseFloat(power),
    energy: parseFloat(energy || 0.0),
    tamper: Boolean(tamper),
    meter_id: meter_id || 'TN-MTR-001',
    timestamp: new Date().toISOString()
  };

  // Push to history
  meterHistory.unshift(latestMeterReading);
  if (meterHistory.length > 100) meterHistory.pop();

  // If tamper detected, store alert
  if (tamper) {
    alertLogs.unshift({
      type: 'METER_TAMPER',
      meter_id: latestMeterReading.meter_id,
      timestamp: latestMeterReading.timestamp,
      description: 'Physical push-button tamper switch triggered on ESP32!'
    });
  }

  console.log(`[ESP32 POST Received] V: ${voltage}V | I: ${current}A | P: ${power}W | Tamper: ${tamper}`);

  res.status(200).json({
    success: true,
    message: 'Meter data received successfully',
    timestamp: latestMeterReading.timestamp
  });
});

/**
 * GET /api/meter-data
 * Endpoint for Dashboard UI to retrieve the latest meter reading.
 */
app.get('/api/meter-data', (req, res) => {
  res.status(200).json(latestMeterReading);
});

/**
 * GET /api/alerts
 * Endpoint to retrieve alert logs.
 */
app.get('/api/alerts', (req, res) => {
  res.status(200).json(alertLogs);
});

// Start Server
app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(`⚡ Smart Energy Monitor Backend Server running on port ${PORT}`);
  console.log(`🌐 Dashboard URL: http://localhost:${PORT}`);
  console.log(`📡 ESP32 API Endpoint: POST http://localhost:${PORT}/api/meter-data`);
  console.log(`===========================================================`);
});
