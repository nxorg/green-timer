/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Better storage wrapper for cross-browser MV3
const storageAPI = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : (typeof browser !== 'undefined' && browser.storage ? browser.storage.sync : null);

const activeStorage = {
  get: (keys) => {
    return new Promise((resolve) => {
      if (storageAPI) {
        storageAPI.get(keys, (data) => resolve(data || {}));
      } else {
        const result = {};
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach(k => {
          try { result[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { result[k] = null; }
        });
        resolve(result);
      }
    });
  },
  set: (obj) => {
    return new Promise((resolve) => {
      if (storageAPI) { storageAPI.set(obj, () => resolve()); }
      else { for (let k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); resolve(); }
    });
  }
};

// Tab switching
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
    
    if (button.dataset.tab === 'log') renderHistory();
    if (button.dataset.tab === 'stopwatch') renderProblems();
    if (button.dataset.tab === 'stats') renderStats();
  });
});

// Helper to format time
function formatTime(ms, isStopwatch = false) {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  seconds %= 60; minutes %= 60;
  let display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (isStopwatch) {
    let milliseconds = Math.floor((ms % 1000) / 10);
    display += `.${String(milliseconds).padStart(2, '0')}`;
  }
  return display;
}

// --- Timer Logic (Countdown) ---
let timerInterval;
let timerTargetTime = 0;

async function initTimer() {
  const data = await activeStorage.get('timer_target');
  if (data.timer_target && data.timer_target > Date.now()) {
    timerTargetTime = data.timer_target;
    startTimerUI();
  } else {
    document.getElementById('timer-display').textContent = '00:00:00';
  }
}

function startTimerUI() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const timeLeft = timerTargetTime - Date.now();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      document.getElementById('timer-display').textContent = '00:00:00';
      activeStorage.set({ timer_target: 0 });
    } else {
      document.getElementById('timer-display').textContent = formatTime(timeLeft);
    }
  }, 1000);
}

document.getElementById('timer-start').addEventListener('click', async () => {
  const minutes = parseInt(document.getElementById('timer-input').value) || 0;
  if (minutes > 0) {
    timerTargetTime = Date.now() + minutes * 60 * 1000;
    await activeStorage.set({ timer_target: timerTargetTime });
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.create('timer-finished', { when: timerTargetTime });
    }
    startTimerUI();
  }
});

document.getElementById('timer-pause').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  if (typeof chrome !== 'undefined' && chrome.alarms) chrome.alarms.clear('timer-finished');
  activeStorage.set({ timer_target: 0 });
});

document.getElementById('timer-reset').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerTargetTime = 0;
  if (typeof chrome !== 'undefined' && chrome.alarms) chrome.alarms.clear('timer-finished');
  activeStorage.set({ timer_target: 0 });
  document.getElementById('timer-display').textContent = '00:00:00';
});

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('timer-input').value = btn.dataset.time;
  });
});

// --- Standalone Stopwatch Logic ---
let swElapsedTime = 0;
let swStartTime = 0;
let swInterval = null;

async function initStandaloneSw() {
  const data = await activeStorage.get(['sw_elapsed', 'sw_start_time', 'sw_is_running']);
  swElapsedTime = data.sw_elapsed || 0;
  if (data.sw_is_running) {
    swStartTime = data.sw_start_time || Date.now();
    startSwUI();
  } else {
    updateSwDisplay();
  }
}

function updateSwDisplay() {
  const display = document.getElementById('sw-display');
  if (display) display.textContent = formatTime(swElapsedTime, true);
}

function startSwUI() {
  if (swInterval) clearInterval(swInterval);
  swInterval = setInterval(() => {
    const currentElapsed = Date.now() - swStartTime;
    const display = document.getElementById('sw-display');
    if (display) display.textContent = formatTime(currentElapsed, true);
  }, 50);
}

document.getElementById('sw-start').addEventListener('click', async () => {
  if (swInterval) return;
  swStartTime = Date.now() - swElapsedTime;
  await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime });
  startSwUI();
});

document.getElementById('sw-pause').addEventListener('click', async () => {
  if (swInterval) { clearInterval(swInterval); swInterval = null; }
  swElapsedTime = Date.now() - swStartTime;
  await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime });
  updateSwDisplay();
});

document.getElementById('sw-reset').addEventListener('click', async () => {
  clearInterval(swInterval);
  swInterval = null;
  swElapsedTime = 0;
  await activeStorage.set({ sw_is_running: false, sw_elapsed: 0 });
  updateSwDisplay();
});

// --- Problems (Multi-Stopwatch) Logic ---
let problems = [];

async function loadProblems() {
  const data = await activeStorage.get('leetcode_problems');
  problems = data.leetcode_problems || [];
  renderProblems();
}

async function saveProblems() {
  await activeStorage.set({ leetcode_problems: problems });
}

function renderProblems() {
  const container = document.getElementById('problems-container');
  if (!container) return;
  container.innerHTML = '';
  problems.forEach((p, index) => {
    const currentElapsed = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    const row = document.createElement('div');
    row.className = 'problem-row';
    row.innerHTML = `
      <div class="problem-header">
        <span>${p.name}</span>
        <button class="btn-small" data-index="${index}" data-action="delete">X</button>
      </div>
      <div class="problem-controls">
        <div class="problem-time" id="time-${index}">${formatTime(currentElapsed, true)}</div>
        <button class="btn-small" data-index="${index}" data-action="toggle">${p.isRunning ? 'PAUSE' : 'START'}</button>
        <button class="btn-small" data-index="${index}" data-action="reset">RESET</button>
        <button class="btn-small" data-index="${index}" data-action="finish">FINISH</button>
      </div>
    `;
    container.appendChild(row);
  });
}

document.getElementById('add-problem').addEventListener('click', async () => {
  const input = document.getElementById('new-problem-name');
  const name = input.value.trim();
  if (!name) return;
  problems.push({ name, elapsed: 0, isRunning: false, startTime: 0 });
  input.value = '';
  await saveProblems();
  renderProblems();
});

document.getElementById('problems-container').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  const index = parseInt(e.target.dataset.index);
  if (action === undefined || isNaN(index)) return;
  const p = problems[index];
  if (action === 'toggle') {
    if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; }
    else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; }
  } else if (action === 'reset') { p.elapsed = 0; p.isRunning = false; }
  else if (action === 'delete') { problems.splice(index, 1); }
  else if (action === 'finish') {
    const finalElapsed = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    await logToHistory(p.name, finalElapsed);
    problems.splice(index, 1);
  }
  await saveProblems();
  renderProblems();
});

// Update UI for running problems
setInterval(() => {
  problems.forEach((p, index) => {
    if (p.isRunning) {
      const timeEl = document.getElementById(`time-${index}`);
      if (timeEl) timeEl.textContent = formatTime(Date.now() - p.startTime, true);
    }
  });
}, 100);

// --- History & Stats Logic ---
async function logToHistory(name, elapsed) {
  const data = await activeStorage.get('leetcode_history');
  const logs = data.leetcode_history || [];
  // Store both the readable time and the raw milliseconds/timestamp for better stats
  logs.unshift({
    name,
    timeStr: formatTime(elapsed, true),
    elapsedMs: elapsed,
    timestamp: Date.now(),
    dateStr: new Date().toLocaleDateString()
  });
  await activeStorage.set({ leetcode_history: logs });
}

async function renderHistory() {
  const list = document.getElementById('log-list');
  if (!list) return;
  const data = await activeStorage.get('leetcode_history');
  const logs = data.leetcode_history || [];
  if (logs.length === 0) {
    list.innerHTML = '<div style="opacity: 0.5;">No history yet.</div>';
    return;
  }
  list.innerHTML = logs.map(l => `<div class="log-entry"><strong>${l.name}</strong>: ${l.timeStr || l.time}<br><small style="opacity: 0.6;">${new Date(l.timestamp).toLocaleString()}</small></div>`).join('');
}

let myChart;
async function renderStats() {
  const data = await activeStorage.get('leetcode_history');
  const logs = data.leetcode_history || [];
  
  // Calculate total stats
  const totalProblems = logs.length;
  const totalMs = logs.reduce((sum, l) => sum + (l.elapsedMs || 0), 0);
  const totalMins = Math.round(totalMs / 60000);
  
  document.getElementById('total-problems').textContent = totalProblems;
  document.getElementById('total-time-spent').textContent = `${totalMins}m`;
  
  // Group by last 7 days for the chart
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toLocaleDateString());
  }
  
  const dailyMins = last7Days.map(dateStr => {
    const dayLogs = logs.filter(l => new Date(l.timestamp).toLocaleDateString() === dateStr);
    const dayMs = dayLogs.reduce((sum, l) => sum + (l.elapsedMs || 0), 0);
    return Math.round(dayMs / 60000);
  });
  
  // Render Chart.js
  const ctx = document.getElementById('progressChart').getContext('2d');
  if (myChart) myChart.destroy();
  
  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last7Days.map(d => d.split('/')[0] + '/' + d.split('/')[1]), // Short date format
      datasets: [{
        label: 'Minutes Spent',
        data: dailyMins,
        borderColor: '#00ff00',
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0, 255, 0, 0.1)' }, ticks: { color: '#00ff00' } },
        x: { grid: { color: 'rgba(0, 255, 0, 0.1)' }, ticks: { color: '#00ff00' } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

document.getElementById('clear-log').addEventListener('click', async () => {
  if (confirm('Clear all history?')) {
    await activeStorage.set({ leetcode_history: [] });
    await renderHistory();
  }
});

// Initial load
async function init() {
  try {
    await initTimer();
    await initStandaloneSw();
    await loadProblems();
    await renderHistory();
  } catch (e) { console.error("Initialization failed:", e); }
}

init();
