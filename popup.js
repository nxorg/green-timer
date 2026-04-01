const storage = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : (typeof browser !== 'undefined' ? browser.storage.sync : null);

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

// Timer Logic (Countdown)
let timerInterval;
let timerTimeLeft = 0;
const timerDisplay = document.getElementById('timer-display');
const timerInput = document.getElementById('timer-input');

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(timerTimeLeft);
}

document.getElementById('timer-start').addEventListener('click', () => {
  if (timerInterval) return;
  if (timerTimeLeft <= 0) {
    const minutes = parseInt(timerInput.value) || 0;
    timerTimeLeft = minutes * 60 * 1000;
  }
  if (timerTimeLeft > 0) {
    timerInterval = setInterval(() => {
      timerTimeLeft -= 1000;
      updateTimerDisplay();
      if (timerTimeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerTimeLeft = 0;
        updateTimerDisplay();
        notifyUser();
      }
    }, 1000);
  }
});

document.getElementById('timer-pause').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
});

document.getElementById('timer-reset').addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerTimeLeft = 0;
  updateTimerDisplay();
});

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    timerTimeLeft = parseInt(btn.dataset.time) * 60 * 1000;
    updateTimerDisplay();
  });
});

// Standalone Stopwatch Logic
let swElapsedTime = 0;
let swStartTime = 0;
let swInterval = null;
const swDisplay = document.getElementById('sw-display');

async function initStandaloneSw() {
  if (storage) {
    const data = await storage.get('sw_elapsed');
    swElapsedTime = data.sw_elapsed || 0;
    updateSwDisplay();
  }
}

function updateSwDisplay() {
  swDisplay.textContent = formatTime(swElapsedTime, true);
}

document.getElementById('sw-start').addEventListener('click', () => {
  if (swInterval) return;
  swStartTime = Date.now() - swElapsedTime;
  swInterval = setInterval(() => {
    swElapsedTime = Date.now() - swStartTime;
    updateSwDisplay();
    if (storage) storage.set({ sw_elapsed: swElapsedTime });
  }, 10);
});

document.getElementById('sw-pause').addEventListener('click', () => {
  clearInterval(swInterval);
  swInterval = null;
});

document.getElementById('sw-reset').addEventListener('click', () => {
  clearInterval(swInterval);
  swInterval = null;
  swElapsedTime = 0;
  if (storage) storage.set({ sw_elapsed: 0 });
  updateSwDisplay();
});

// Problems (Multi-Stopwatch) Logic
let problems = [];

async function loadProblems() {
  if (storage) {
    const data = await storage.get('leetcode_problems');
    problems = data.leetcode_problems || [];
    renderProblems();
  }
}

async function saveProblems() {
  if (storage) {
    await storage.set({ leetcode_problems: problems });
  }
}

function renderProblems() {
  const container = document.getElementById('problems-container');
  container.innerHTML = '';
  problems.forEach((p, index) => {
    const row = document.createElement('div');
    row.className = 'problem-row';
    row.innerHTML = `
      <div class="problem-header">
        <span>${p.name}</span>
        <button class="btn-small" data-index="${index}" data-action="delete">X</button>
      </div>
      <div class="problem-controls">
        <div class="problem-time" id="time-${index}">${formatTime(p.elapsed, true)}</div>
        <button class="btn-small" data-index="${index}" data-action="toggle">
          ${p.isRunning ? 'PAUSE' : 'START'}
        </button>
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
  problems.push({ name, elapsed: 0, isRunning: false, lastTick: 0 });
  input.value = '';
  await saveProblems();
  renderProblems();
});

document.getElementById('problems-container').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  const index = parseInt(e.target.dataset.index);
  if (action === undefined) return;
  
  if (action === 'toggle') {
    const p = problems[index];
    p.isRunning = !p.isRunning;
    p.lastTick = Date.now();
  } else if (action === 'reset') {
    problems[index].elapsed = 0;
    problems[index].isRunning = false;
  } else if (action === 'delete') {
    problems.splice(index, 1);
  } else if (action === 'finish') {
    const p = problems[index];
    await logToHistory(p.name, p.elapsed);
    problems.splice(index, 1);
  }
  await saveProblems();
  renderProblems();
});

// Update running timers
setInterval(async () => {
  let changed = false;
  problems.forEach((p, index) => {
    if (p.isRunning) {
      const now = Date.now();
      const delta = now - p.lastTick;
      p.elapsed += delta;
      p.lastTick = now;
      changed = true;
      const timeEl = document.getElementById(`time-${index}`);
      if (timeEl) timeEl.textContent = formatTime(p.elapsed, true);
    }
  });
  if (changed) await saveProblems();
}, 100);

// History Logic
async function logToHistory(name, elapsed) {
  if (storage) {
    const data = await storage.get('leetcode_history');
    const logs = data.leetcode_history || [];
    logs.unshift({ name, time: formatTime(elapsed, true), timestamp: new Date().toLocaleString() });
    await storage.set({ leetcode_history: logs });
  }
}

async function renderHistory() {
  const list = document.getElementById('log-list');
  if (storage) {
    const data = await storage.get('leetcode_history');
    const logs = data.leetcode_history || [];
    if (logs.length === 0) {
      list.innerHTML = '<div style="opacity: 0.5;">No history yet.</div>';
      return;
    }
    list.innerHTML = logs.map(l => `
      <div style="border-bottom: 1px dashed #00ff0033; padding: 5px 0;">
        <strong>${l.name}</strong>: ${l.time}<br>
        <small style="opacity: 0.6;">${l.timestamp}</small>
      </div>
    `).join('');
  }
}

document.getElementById('clear-log').addEventListener('click', async () => {
  if (confirm('Clear all history?')) {
    if (storage) await storage.set({ leetcode_history: [] });
    await renderHistory();
  }
});

// Notifications
function playBeep() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
}

function notifyUser() {
  playBeep();
  const options = { type: "basic", iconUrl: "icons/icon-48.png", title: "Time's Up!", message: "Your timer has finished." };
  if (typeof chrome !== 'undefined' && chrome.notifications) chrome.notifications.create(options);
  else if (typeof browser !== 'undefined' && browser.notifications) browser.notifications.create(options);
}

// Initial loads
initStandaloneSw();
loadProblems();
