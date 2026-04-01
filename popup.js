/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : (typeof browser !== 'undefined' ? browser.storage.sync : null);

// Dynamic storage selection with multi-layer fallback
const getStorage = () => {
  if (typeof chrome !== 'undefined') {
    if (chrome.storage && chrome.storage.sync) return chrome.storage.sync;
    if (chrome.storage && chrome.storage.local) return chrome.storage.local;
  }
  if (typeof browser !== 'undefined' && browser.storage) {
    if (browser.storage.sync) return browser.storage.sync;
    if (browser.storage.local) return browser.storage.local;
  }
  return {
    get: (key) => Promise.resolve({ [key]: JSON.parse(localStorage.getItem(key) || 'null') }),
    set: (obj) => {
      for (let key in obj) localStorage.setItem(key, JSON.stringify(obj[key]));
      return Promise.resolve();
    }
  };
};

const activeStorage = getStorage();

// Tab switching
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
    if (button.dataset.tab === 'log') renderHistory();
    if (button.dataset.tab === 'stopwatch') renderProblems();
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
let timerTargetTime = 0; // When the timer will end

async function initTimer() {
  const data = await activeStorage.get('timer_target');
  if (data.timer_target) {
    timerTargetTime = data.timer_target;
    startTimerUI();
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
    chrome.alarms.create('timer-finished', { when: timerTargetTime });
    startTimerUI();
  }
});

document.getElementById('timer-pause').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  chrome.alarms.clear('timer-finished');
  activeStorage.set({ timer_target: 0 });
});

document.getElementById('timer-reset').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerTargetTime = 0;
  chrome.alarms.clear('timer-finished');
  activeStorage.set({ timer_target: 0 });
  document.getElementById('timer-display').textContent = '00:00:00';
});

// --- Standalone Stopwatch Logic ---
let swElapsedTime = 0;
let swStartTime = 0;
let swInterval = null;
const swDisplay = document.getElementById('sw-display');

async function initStandaloneSw() {
  const data = await activeStorage.get(['sw_elapsed', 'sw_start_time', 'sw_is_running']);
  swElapsedTime = data.sw_elapsed || 0;
  if (data.sw_is_running) {
    swStartTime = data.sw_start_time;
    startSwUI();
  } else {
    updateSwDisplay();
  }
}

function updateSwDisplay() {
  if (swDisplay) swDisplay.textContent = formatTime(swElapsedTime, true);
}

function startSwUI() {
  if (swInterval) clearInterval(swInterval);
  swInterval = setInterval(() => {
    const currentElapsed = Date.now() - swStartTime;
    swDisplay.textContent = formatTime(currentElapsed, true);
  }, 50);
}

document.getElementById('sw-start').addEventListener('click', async () => {
  if (swInterval) return;
  swStartTime = Date.now() - swElapsedTime;
  await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime });
  startSwUI();
});

document.getElementById('sw-pause').addEventListener('click', async () => {
  clearInterval(swInterval);
  swInterval = null;
  swElapsedTime = Date.now() - swStartTime;
  await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime });
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
  if (action === undefined) return;
  const p = problems[index];
  if (action === 'toggle') {
    if (p.isRunning) {
      p.elapsed = Date.now() - p.startTime;
      p.isRunning = false;
    } else {
      p.startTime = Date.now() - p.elapsed;
      p.isRunning = true;
    }
  } else if (action === 'reset') {
    p.elapsed = 0;
    p.isRunning = false;
  } else if (action === 'delete') {
    problems.splice(index, 1);
  } else if (action === 'finish') {
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

// --- History Logic ---
async function logToHistory(name, elapsed) {
  const data = await activeStorage.get('leetcode_history');
  const logs = data.leetcode_history || [];
  logs.unshift({ name, time: formatTime(elapsed, true), timestamp: new Date().toLocaleString() });
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
  list.innerHTML = logs.map(l => `<div class="log-entry"><strong>${l.name}</strong>: ${l.time}<br><small style="opacity: 0.6;">${l.timestamp}</small></div>`).join('');
}

document.getElementById('clear-log').addEventListener('click', async () => {
  if (confirm('Clear all history?')) {
    await activeStorage.set({ leetcode_history: [] });
    await renderHistory();
  }
});

// Initial loads
async function init() {
  await initTimer();
  await initStandaloneSw();
  await loadProblems();
  await renderHistory();
}

init();
