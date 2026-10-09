/**
 * Smart Energy Monitor - JavaScript Controller
 * Automated Electricity Billing and Monitoring System (ESP32 Prototype)
 */

// ================= GLOBAL STATE =================
let isDemoMode = true;
let pollTimer = null;
let lastServerResponseTime = Date.now();

let settings = {
  apiUrl: 'http://localhost:5000/api/meter-data',
  meterId: 'TN-MTR-001',
  tariff: 8.00,
  highThreshold: 5.0,
  pollInterval: 2000
};

let meterData = {
  voltage: 5.02,
  current: 0.42,
  power: 2.11,
  energy: 0.0042,
  tamper: false,
  lastUpdated: new Date().toLocaleTimeString(),
  status: 'ONLINE'
};

let alertLogs = [
  {
    id: 'ALT-1001',
    timestamp: new Date(Date.now() - 3600000).toLocaleTimeString(),
    rawTime: Date.now() - 3600000,
    type: 'HIGH_LOAD',
    meterId: 'TN-MTR-001',
    value: '6.5 W',
    status: 'RESOLVED',
    description: 'Power load exceeded threshold limit of 5.0 W.'
  }
];

// Regional Meter Fleet Data for Electricity Board View
let ebMeters = [
  { id: 'TN-MTR-001', location: 'Household Prototype A', power: 2.11, todayKwh: 3.82, status: 'ONLINE', alert: 'Normal' },
  { id: 'TN-MTR-002', location: 'Household B (Residential)', power: 34.2, todayKwh: 4.10, status: 'ONLINE', alert: 'Normal' },
  { id: 'TN-MTR-003', location: 'Commercial Complex C', power: 185.0, todayKwh: 14.5, status: 'ONLINE', alert: 'High Load' },
  { id: 'TN-MTR-004', location: 'Apartment Block D', power: 0.0, todayKwh: 2.10, status: 'OFFLINE', alert: 'Offline' },
  { id: 'TN-MTR-005', location: 'Industrial Unit E', power: 420.0, todayKwh: 32.0, status: 'ONLINE', alert: 'Normal' }
];

// Charts references
let liveChart = null;
let dailyChart = null;
let weeklyChart = null;
let monthlyChart = null;

const liveChartMaxPoints = 15;
let liveChartLabels = [];
let liveChartData = [];

// Peak Statistics tracking
let peakLoadToday = 0.0;
let minLoadToday = 999.0;
let totalPowerSum = 0.0;
let powerReadingsCount = 0;

// ================= DOM INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  loadSettingsFromStorage();
  updateDashboard();
  calculateBill();
  calculateEstimatedBill();
  renderAlertsTable();
  renderEBMetersTable();

  // Start initial polling or simulation loop
  startDataLoop();
});

// ================= CHART.JS INITIALIZATION =================
function initCharts() {
  const ctxLive = document.getElementById('livePowerChart').getContext('2d');
  const ctxDaily = document.getElementById('dailyEnergyChart').getContext('2d');
  const ctxWeekly = document.getElementById('weeklyUsageChart').getContext('2d');
  const ctxMonthly = document.getElementById('monthlyUsageChart').getContext('2d');

  // 1. Live Power Chart (Line)
  liveChart = new Chart(ctxLive, {
    type: 'line',
    data: {
      labels: liveChartLabels,
      datasets: [{
        label: 'Power Draw (Watts)',
        data: liveChartData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' }, beginAtZero: true }
      },
      plugins: { legend: { display: false } }
    }
  });

  // 2. Daily Energy Chart (Bar)
  dailyChart = new Chart(ctxDaily, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Energy Consumed (kWh)',
        data: [3.2, 4.1, 3.8, 4.5, 5.0, 4.2, 3.82],
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' }, beginAtZero: true }
      },
      plugins: { legend: { display: false } }
    }
  });

  // 3. Weekly Usage Chart (Line)
  weeklyChart = new Chart(ctxWeekly, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Weekly kWh',
        data: [24.5, 28.2, 26.8, 30.1],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // 4. Monthly Usage Chart (Bar)
  monthlyChart = new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Monthly Usage (kWh)',
        data: [115, 122, 130, 128, 145, 138, 140, 135, 129, 130, 125, 132],
        backgroundColor: '#a855f7',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// ================= DATA LOOP & POLLING =================
function startDataLoop() {
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(() => {
    if (isDemoMode) {
      generateDemoReading();
    } else {
      fetchMeterData();
    }
  }, settings.pollInterval);
}

// ================= FETCH REAL ESP32 DATA FROM API =================
async function fetchMeterData() {
  try {
    const response = await fetch(settings.apiUrl, { method: 'GET' });
    if (response.ok) {
      const data = await response.json();
      lastServerResponseTime = Date.now();
      
      // ESP32 is online and responding!
      updateMeterData(data);
      setConnectionStatus('ONLINE', 'ESP32 CONNECTED');
    } else {
      checkTimeoutOffline();
    }
  } catch (error) {
    console.warn("API fetch error or ESP32 unreachable:", error.message);
    checkTimeoutOffline();
  }
}

function checkTimeoutOffline() {
  // If no data received for over 6 seconds, mark OFFLINE
  if (Date.now() - lastServerResponseTime > 6000) {
    setConnectionStatus('OFFLINE', 'ESP32 OFFLINE');
  }
}

// ================= UPDATE METER DATA STATE =================
function updateMeterData(data) {
  if (data.voltage !== undefined) meterData.voltage = parseFloat(data.voltage);
  if (data.current !== undefined) meterData.current = parseFloat(data.current);
  if (data.power !== undefined) meterData.power = parseFloat(data.power);
  if (data.energy !== undefined) meterData.energy = parseFloat(data.energy);
  if (data.tamper !== undefined) meterData.tamper = Boolean(data.tamper);

  meterData.lastUpdated = new Date().toLocaleTimeString();

  // Track Peak / Avg / Min power statistics
  if (meterData.power > peakLoadToday) peakLoadToday = meterData.power;
  if (meterData.power < minLoadToday && meterData.power > 0) minLoadToday = meterData.power;
  totalPowerSum += meterData.power;
  powerReadingsCount++;

  // Run security checks
  checkHighConsumption();
  checkTampering();

  // Append data to live chart
  appendLiveChartData(meterData.power);

  // Update UI
  updateDashboard();
}

// ================= DEMO MODE GENERATOR =================
function generateDemoReading() {
  // Generate slight realistic voltage & current fluctuations
  const baseVoltage = 5.0 + (Math.random() * 0.1 - 0.05); // ~5.0V DC
  
  // Keep power normal unless currently in high power demo mode
  let powerVal = meterData.power;
  if (powerVal > 100) {
    // High consumption active
    powerVal += (Math.random() * 4 - 2);
  } else {
    // Normal consumption (~2.0W to ~45W)
    powerVal = 2.11 + (Math.random() * 1.5 - 0.75);
  }
  if (powerVal < 0) powerVal = 0.5;

  const currentVal = powerVal / baseVoltage;
  const energyVal = meterData.energy + (powerVal / 3600000); // Increment energy slightly

  const simData = {
    voltage: parseFloat(baseVoltage.toFixed(2)),
    current: parseFloat(currentVal.toFixed(2)),
    power: parseFloat(powerVal.toFixed(2)),
    energy: parseFloat(energyVal.toFixed(4)),
    tamper: meterData.tamper // Retain tamper flag
  };

  updateMeterData(simData);
  setConnectionStatus('ONLINE', 'DEMO SIMULATOR ACTIVE');
}

// ================= UI UPDATE ENGINE =================
function updateDashboard() {
  // 1. Metric Cards
  document.getElementById('cardPower').innerHTML = `${meterData.power.toFixed(1)} <span class="unit">W</span>`;
  document.getElementById('cardTodayEnergy').innerHTML = `${(3.82 + meterData.energy).toFixed(2)} <span class="unit">kWh</span>`;
  document.getElementById('lastUpdatedTime').textContent = meterData.lastUpdated;

  // 2. Live Parameters Strip
  document.getElementById('paramVoltage').textContent = `${meterData.voltage.toFixed(2)} V`;
  document.getElementById('paramCurrent').textContent = `${meterData.current.toFixed(2)} A`;
  document.getElementById('paramTotalUnits').textContent = `${(130 + meterData.energy).toFixed(4)} kWh`;

  // 3. Meter Hardware Details Tab
  document.getElementById('meterDetailId').textContent = settings.meterId;
  document.getElementById('meterDetailVoltage').textContent = `${meterData.voltage.toFixed(2)} V`;
  document.getElementById('meterDetailCurrent').textContent = `${meterData.current.toFixed(2)} A`;
  document.getElementById('meterDetailPower').textContent = `${meterData.power.toFixed(2)} W`;
  document.getElementById('meterDetailEnergy').textContent = `${meterData.energy.toFixed(4)} kWh`;
  document.getElementById('meterDetailTamper').textContent = meterData.tamper ? '🚨 TAMPERED (True)' : 'SECURE (False)';
  document.getElementById('meterDetailLastTime').textContent = meterData.lastUpdated;

  // 4. Energy Stats Tab
  document.getElementById('statPeakLoad').textContent = `${peakLoadToday.toFixed(1)} W`;
  document.getElementById('statMinPower').textContent = `${minLoadToday === 999 ? 0 : minLoadToday.toFixed(1)} W`;
  const avg = powerReadingsCount > 0 ? (totalPowerSum / powerReadingsCount).toFixed(1) : '0.0';
  document.getElementById('statAvgPower').textContent = `${avg} W`;

  // 5. Update Electricity Board View
  updateEBDashboard();
}

// ================= SECURITY & THRESHOLD CHECKS =================
function checkHighConsumption() {
  const banner = document.getElementById('highPowerBanner');
  if (meterData.power > settings.highThreshold) {
    banner.classList.remove('hidden');
    document.getElementById('bannerPowerVal').textContent = `${meterData.power.toFixed(1)} W`;
    document.getElementById('bannerThresholdVal').textContent = `${settings.highThreshold} W`;
    document.getElementById('cardPowerSub').innerHTML = `<span class="text-amber"><i class="fa-solid fa-triangle-exclamation"></i> High Load</span>`;

    // Log alert if not already logged recently
    logAlert('HIGH_LOAD', `${meterData.power.toFixed(1)} W`, `Current load exceeds ${settings.highThreshold} W limit.`);
  } else {
    banner.classList.add('hidden');
    document.getElementById('cardPowerSub').textContent = 'Normal load range';
  }
}

function checkTampering() {
  const banner = document.getElementById('tamperBanner');
  const cardStatus = document.getElementById('cardMeterStatus');
  const cardTamperSub = document.getElementById('cardTamperStatus');
  const securityText = document.getElementById('securityStatusText');

  if (meterData.tamper) {
    // TAMPER EVENT DETECTED!
    banner.classList.remove('hidden');
    setConnectionStatus('TAMPER', 'TAMPER ALERT');

    cardStatus.textContent = 'TAMPER ALERT';
    cardStatus.className = 'card-value status-text-tamper';
    cardTamperSub.innerHTML = `<span class="text-red font-semibold">🚨 Switch Triggered!</span>`;
    
    if (securityText) {
      securityText.textContent = 'BREACH DETECTED';
      securityText.className = 'text-red font-semibold';
    }

    logAlert('METER_TAMPER', 'PHYSICAL SWITCH', 'Meter tamper button trigger activated!');
  } else {
    // SECURE STATE
    banner.classList.add('hidden');
    if (meterData.status !== 'OFFLINE') {
      setConnectionStatus('ONLINE', isDemoMode ? 'DEMO MODE' : 'ESP32 ONLINE');
      cardStatus.textContent = 'ONLINE';
      cardStatus.className = 'card-value status-text-online';
    }
    cardTamperSub.textContent = 'Tamper: Secure';

    if (securityText) {
      securityText.textContent = 'SECURE';
      securityText.className = 'text-green font-semibold';
    }
  }
}

function setConnectionStatus(type, label) {
  const badge = document.getElementById('statusBadge');
  const text = document.getElementById('statusText');
  const icon = document.getElementById('statusIcon');
  meterData.status = type;

  if (type === 'TAMPER') {
    badge.className = 'status-badge tamper';
    icon.className = 'fa-solid fa-triangle-exclamation';
  } else if (type === 'ONLINE') {
    badge.className = 'status-badge online';
    icon.className = 'fa-solid fa-signal';
  } else {
    badge.className = 'status-badge offline';
    icon.className = 'fa-solid fa-plane-slash';
  }
  text.textContent = label;
}

// ================= LIVE CHART DATA APPEND =================
function appendLiveChartData(powerValue) {
  if (!liveChart) return;

  const timeLabel = new Date().toLocaleTimeString().split(' ')[0]; // HH:MM:SS
  liveChartLabels.push(timeLabel);
  liveChartData.push(powerValue);

  if (liveChartLabels.length > liveChartMaxPoints) {
    liveChartLabels.shift();
    liveChartData.shift();
  }

  liveChart.update();
}

// ================= BILLING SYSTEM CALCULATIONS =================
function calculateBill() {
  const prev = parseFloat(document.getElementById('prevReading').value) || 0;
  const curr = parseFloat(document.getElementById('currReading').value) || 0;
  const tariff = parseFloat(document.getElementById('tariffRateInput').value) || settings.tariff;

  let units = curr - prev;
  if (units < 0) units = 0;

  const energyCharge = units * tariff;
  const fixedCharge = 50.00;
  const tax = energyCharge * 0.05;
  const total = energyCharge + fixedCharge + tax;

  document.getElementById('calculatedUnits').value = `${units.toFixed(1)} kWh`;
  document.getElementById('sumUnits').textContent = units.toFixed(1);
  document.getElementById('sumRate').textContent = tariff.toFixed(2);
  document.getElementById('sumEnergyCharge').textContent = `₹${energyCharge.toFixed(2)}`;
  document.getElementById('sumTax').textContent = `₹${tax.toFixed(2)}`;
  document.getElementById('sumTotalBill').textContent = `₹${total.toFixed(2)}`;

  // Also update overall estimated bill card
  document.getElementById('cardEstBill').textContent = `₹${total.toFixed(0)}`;
}

function calculateEstimatedBill() {
  const avgDailyKwh = 4.28;
  const daysInMonth = 30;
  const projectedUnits = avgDailyKwh * daysInMonth;
  const tariff = settings.tariff;
  const estBill = (projectedUnits * tariff) + 50.00;

  document.getElementById('projMonthlyBill').textContent = `₹${estBill.toFixed(2)}`;
  document.getElementById('projAvgDaily').textContent = `${avgDailyKwh.toFixed(2)} kWh/day`;
  document.getElementById('projMonthlyUnits').textContent = `${projectedUnits.toFixed(1)} kWh`;

  const tierBadge = document.getElementById('tierBadge');
  const billPill = document.getElementById('billPill');

  if (projectedUnits > 200) {
    tierBadge.textContent = 'HIGH CONSUMPTION TIER';
    tierBadge.className = 'badge-pill pill-high';
    if (billPill) { billPill.textContent = 'High Rate'; billPill.className = 'card-sub badge-pill pill-high'; }
  } else if (projectedUnits < 80) {
    tierBadge.textContent = 'LOW CONSUMPTION TIER';
    tierBadge.className = 'badge-pill pill-low';
    if (billPill) { billPill.textContent = 'Economy Rate'; billPill.className = 'card-sub badge-pill pill-low'; }
  } else {
    tierBadge.textContent = 'NORMAL CONSUMPTION TIER';
    tierBadge.className = 'badge-pill pill-normal';
    if (billPill) { billPill.textContent = 'Normal Rate'; billPill.className = 'card-sub badge-pill pill-normal'; }
  }
}

// Generate Clean E-Bill Modal
function generateEBill() {
  calculateBill();
  const prev = document.getElementById('prevReading').value;
  const curr = document.getElementById('currReading').value;
  const units = document.getElementById('calculatedUnits').value;
  const rate = document.getElementById('tariffRateInput').value;
  const total = document.getElementById('sumTotalBill').textContent;

  document.getElementById('bTablePrev').textContent = `${prev} kWh`;
  document.getElementById('bTableCurr').textContent = `${curr} kWh`;
  document.getElementById('bTableUnits').textContent = units;
  document.getElementById('bTableRate').textContent = `₹${rate} / kWh`;
  document.getElementById('bTableTotal').textContent = total;
  document.getElementById('billDate').textContent = new Date().toLocaleDateString();
  document.getElementById('billMeterId').textContent = settings.meterId;

  document.getElementById('ebillModal').classList.remove('hidden');
}

function closeEBillModal() {
  document.getElementById('ebillModal').classList.add('hidden');
}

function simulatePayment() {
  const alertBox = document.getElementById('paymentStatusAlert');
  const statusTag = document.getElementById('billStatusTag');

  alertBox.classList.remove('hidden');
  if (statusTag) {
    statusTag.textContent = 'PAID';
    statusTag.className = 'bill-status-paid';
  }

  setTimeout(() => {
    alertBox.classList.add('hidden');
  }, 4000);
}

// ================= ALERTS & EVENT LOGGING =================
function logAlert(type, value, description) {
  // Prevent excessive duplicate alerts
  const lastAlert = alertLogs[0];
  if (lastAlert && lastAlert.type === type && (Date.now() - new Date(lastAlert.rawTime).getTime() < 10000)) {
    return;
  }

  const alertObj = {
    id: `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toLocaleTimeString(),
    rawTime: Date.now(),
    type: type,
    meterId: settings.meterId,
    value: value,
    status: type === 'METER_TAMPER' ? 'ACTIVE' : 'WARNING',
    description: description
  };

  alertLogs.unshift(alertObj);
  if (alertLogs.length > 50) alertLogs.pop();

  renderAlertsTable();
}

function renderAlertsTable() {
  const tbody = document.getElementById('alertsTableBody');
  const badge = document.getElementById('alertCountBadge');
  if (!tbody) return;

  tbody.innerHTML = '';
  let tamperCount = 0;
  let highLoadCount = 0;

  alertLogs.forEach(log => {
    if (log.type === 'METER_TAMPER') tamperCount++;
    if (log.type === 'HIGH_LOAD') highLoadCount++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-semibold text-blue">${log.id}</td>
      <td>${log.timestamp}</td>
      <td>
        <span class="badge-pill ${log.type === 'METER_TAMPER' ? 'pill-high' : 'pill-normal'}">
          ${log.type === 'METER_TAMPER' ? '🚨 TAMPER DETECTED' : '⚠ HIGH CONSUMPTION'}
        </span>
      </td>
      <td><span class="meter-id-tag">${log.meterId}</span></td>
      <td>${log.value}</td>
      <td><span class="text-${log.status === 'ACTIVE' ? 'red' : 'amber'} font-semibold">${log.status}</span></td>
      <td>${log.description}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('countTamperAlerts').textContent = tamperCount;
  document.getElementById('countHighLoadAlerts').textContent = highLoadCount;

  if (alertLogs.length > 0) {
    badge.textContent = alertLogs.length;
    badge.classList.remove('hidden');
  }
}

function clearAlertLogs() {
  alertLogs = [];
  renderAlertsTable();
}

// ================= ELECTRICITY BOARD (EB) DASHBOARD =================
function updateEBDashboard() {
  // Sync TN-MTR-001 with live meter state
  ebMeters[0].power = meterData.power;
  ebMeters[0].todayKwh = 3.82 + meterData.energy;
  ebMeters[0].status = meterData.status === 'TAMPER' ? 'TAMPER ALERT' : meterData.status;
  ebMeters[0].alert = meterData.tamper ? '🚨 TAMPER ALERT' : (meterData.power > settings.highThreshold ? '⚠ High Load' : 'Normal');

  renderEBMetersTable();
}

function renderEBMetersTable() {
  const tbody = document.getElementById('ebMetersTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  let onlineCount = 0;
  let loadAlertsCount = 0;
  let tamperAlertsCount = 0;

  ebMeters.forEach(m => {
    if (m.status === 'ONLINE' || m.status === 'TAMPER ALERT') onlineCount++;
    if (m.alert.includes('High Load')) loadAlertsCount++;
    if (m.alert.includes('TAMPER')) tamperAlertsCount++;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="meter-id-tag">${m.id}</span></td>
      <td>${m.location}</td>
      <td class="font-semibold">${m.power.toFixed(1)} W</td>
      <td>${m.todayKwh.toFixed(2)} kWh</td>
      <td>
        <span class="badge-pill ${m.status === 'ONLINE' ? 'pill-low' : (m.status === 'TAMPER ALERT' ? 'pill-high' : 'pill-normal')}">
          ${m.status}
        </span>
      </td>
      <td>
        <span class="text-${m.alert.includes('TAMPER') ? 'red' : (m.alert.includes('High') ? 'amber' : 'green')} font-semibold">
          ${m.alert}
        </span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="inspectMeter('${m.id}')">Inspect</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('ebOnlineCount').textContent = `${onlineCount} / ${ebMeters.length}`;
  document.getElementById('ebLoadAlerts').textContent = loadAlertsCount;
  document.getElementById('ebTamperAlerts').textContent = tamperAlertsCount;
}

function inspectMeter(meterId) {
  switchTab('meter');
}

// ================= HACKATHON DEMO SIMULATION CONTROLS =================
function triggerHighConsumptionDemo() {
  enableDemoMode(true);
  meterData.power = 145.8; // Set > 100 W threshold
  updateMeterData({ power: 145.8 });
  switchTab('overview');
}

function triggerTamperDemo() {
  enableDemoMode(true);
  meterData.tamper = true;
  updateMeterData({ tamper: true });
  switchTab('overview');
}

function resetDemoAlerts() {
  meterData.tamper = false;
  meterData.power = 2.11;
  updateMeterData({ power: 2.11, tamper: false });
  document.getElementById('highPowerBanner').classList.add('hidden');
  document.getElementById('tamperBanner').classList.add('hidden');
}

function toggleDemoMode(enabled) {
  isDemoMode = enabled;
  const badge = document.getElementById('modeBadge');
  const text = document.getElementById('modeText');

  if (enabled) {
    badge.className = 'mode-badge demo-active';
    text.textContent = 'DEMO MODE ACTIVE';
  } else {
    badge.className = 'mode-badge live-active';
    text.textContent = 'ESP32 LIVE LISTENER';
  }

  startDataLoop();
}

// ================= NAVIGATION & TAB SWITCHING =================
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

  const activeNav = document.querySelector(`.nav-item[href="#${tabId}"]`);
  const activeSec = document.getElementById(`section-${tabId}`);

  if (activeNav) activeNav.classList.add('active');
  if (activeSec) activeSec.classList.add('active');

  // Trigger chart resizes if switching tabs
  setTimeout(() => {
    if (liveChart) liveChart.resize();
    if (dailyChart) dailyChart.resize();
    if (weeklyChart) weeklyChart.resize();
    if (monthlyChart) monthlyChart.resize();
  }, 100);
}

function dismissBanner(bannerId) {
  document.getElementById(bannerId).classList.add('hidden');
}

// ================= SETTINGS FORM =================
function saveSettings() {
  settings.apiUrl = document.getElementById('apiUrlInput').value;
  settings.meterId = document.getElementById('meterIdInput').value;
  settings.tariff = parseFloat(document.getElementById('tariffConfigInput').value) || 8.00;
  settings.highThreshold = parseFloat(document.getElementById('thresholdInput').value) || 100.0;
  settings.pollInterval = parseInt(document.getElementById('pollIntervalInput').value) || 2000;

  localStorage.setItem('smart_energy_settings', JSON.stringify(settings));
  alert('Settings saved successfully!');
  
  calculateBill();
  calculateEstimatedBill();
  startDataLoop();
}

function loadSettingsFromStorage() {
  const saved = localStorage.getItem('smart_energy_settings');
  if (saved) {
    try {
      settings = JSON.parse(saved);
      document.getElementById('apiUrlInput').value = settings.apiUrl;
      document.getElementById('meterIdInput').value = settings.meterId;
      document.getElementById('tariffConfigInput').value = settings.tariff;
      document.getElementById('thresholdInput').value = settings.highThreshold;
      document.getElementById('pollIntervalInput').value = settings.pollInterval;
    } catch (e) {
      console.warn("Could not parse saved settings");
    }
  }
}
