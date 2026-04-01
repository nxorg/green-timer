/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 */

const storageAPI = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : (typeof browser !== 'undefined' && browser.storage ? browser.storage.sync : null);

const activeStorage = {
  get: (keys) => {
    return new Promise((resolve) => {
      if (storageAPI) { storageAPI.get(keys, (data) => resolve(data || {})); }
      else {
        const result = {}; const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach(k => { try { result[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { result[k] = null; } });
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

function formatTime(ms, isStopwatch = false) {
  let seconds = Math.floor(ms / 1000); let minutes = Math.floor(seconds / 60); let hours = Math.floor(minutes / 60);
  seconds %= 60; minutes %= 60;
  let display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (isStopwatch) { let milliseconds = Math.floor((ms % 1000) / 10); display += `.${String(milliseconds).padStart(2, '0')}`; }
  return display;
}

function parseTimeToMs(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':'); if (parts.length < 3) return 0;
  const h = parseInt(parts[0]) || 0; const m = parseInt(parts[1]) || 0;
  const sParts = parts[2].split('.'); const s = parseInt(sParts[0]) || 0;
  const ms = sParts[1] ? parseInt(sParts[1].substring(0, 2).padEnd(2, '0')) : 0;
  return (h * 3600000) + (m * 60000) + (s * 1000) + (ms * 10);
}

function getDateKey(dateObj) {
  const d = new Date(dateObj);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

let timerInterval, swInterval;
let timerTargetTime = 0, swElapsedTime = 0, swStartTime = 0;
let problems = [];

async function initTimers() {
  const data = await activeStorage.get(['timer_target', 'sw_elapsed', 'sw_start_time', 'sw_is_running']);
  if (data.timer_target && data.timer_target > Date.now()) { timerTargetTime = data.timer_target; startTimerUI(); }
  swElapsedTime = data.sw_elapsed || 0;
  if (data.sw_is_running) { swStartTime = data.sw_start_time || Date.now(); startSwUI(); } else { updateSwDisplay(); }
}

function startTimerUI() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const timeLeft = timerTargetTime - Date.now();
    if (timeLeft <= 0) { clearInterval(timerInterval); document.getElementById('timer-display').textContent = '00:00:00'; }
    else { document.getElementById('timer-display').textContent = formatTime(timeLeft); }
  }, 1000);
}

document.getElementById('timer-start').addEventListener('click', async () => {
  const mins = parseInt(document.getElementById('timer-input').value) || 0;
  if (mins > 0) { timerTargetTime = Date.now() + mins * 60 * 1000; await activeStorage.set({ timer_target: timerTargetTime }); chrome.alarms.create('timer-finished', { when: timerTargetTime }); startTimerUI(); }
});

document.getElementById('timer-pause').addEventListener('click', () => { clearInterval(timerInterval); chrome.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); });
document.getElementById('timer-reset').addEventListener('click', () => { clearInterval(timerInterval); chrome.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); document.getElementById('timer-display').textContent = '00:00:00'; });

function updateSwDisplay() { const el = document.getElementById('sw-display'); if (el) el.textContent = formatTime(swElapsedTime, true); }
function startSwUI() { if (swInterval) clearInterval(swInterval); swInterval = setInterval(() => { const el = document.getElementById('sw-display'); if(el) el.textContent = formatTime(Date.now() - swStartTime, true); }, 50); }
document.getElementById('sw-start').addEventListener('click', async () => { if (swInterval) return; swStartTime = Date.now() - swElapsedTime; await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime }); startSwUI(); });
document.getElementById('sw-pause').addEventListener('click', async () => { clearInterval(swInterval); swElapsedTime = Date.now() - swStartTime; await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime }); updateSwDisplay(); });
document.getElementById('sw-reset').addEventListener('click', async () => { clearInterval(swInterval); swElapsedTime = 0; await activeStorage.set({ sw_is_running: false, sw_elapsed: 0 }); updateSwDisplay(); });

async function loadProblems() { const data = await activeStorage.get('leetcode_problems'); problems = data.leetcode_problems || []; renderProblems(); }
async function saveProblems() { await activeStorage.set({ leetcode_problems: problems }); }
function renderProblems() {
  const container = document.getElementById('problems-container'); if (!container) return; container.innerHTML = '';
  problems.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'problem-row';
    const cur = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    row.innerHTML = `<div class="problem-header"><span>${p.name}</span><button class="btn-small" data-index="${i}" data-action="delete">X</button></div>
    <div class="problem-controls"><div class="problem-time" id="time-${i}">${formatTime(cur, true)}</div>
    <button class="btn-small" data-index="${i}" data-action="toggle">${p.isRunning ? 'PAUSE' : 'START'}</button>
    <button class="btn-small" data-index="${i}" data-action="reset">RESET</button><button class="btn-small" data-index="${i}" data-action="finish">FINISH</button></div>`;
    container.appendChild(row);
  });
}

document.getElementById('add-problem').addEventListener('click', async () => {
  const el = document.getElementById('new-problem-name'); const name = el.value.trim();
  if (name) { problems.push({ name, elapsed: 0, isRunning: false, startTime: 0 }); el.value = ''; await saveProblems(); renderProblems(); }
});

document.getElementById('problems-container').addEventListener('click', async (e) => {
  const action = e.target.dataset.action; const idx = parseInt(e.target.dataset.index); if (action === undefined) return;
  const p = problems[idx];
  if (action === 'toggle') { if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; } else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; } }
  else if (action === 'reset') { p.elapsed = 0; p.isRunning = false; }
  else if (action === 'delete') { problems.splice(idx, 1); }
  else if (action === 'finish') { const fin = p.isRunning ? (Date.now() - p.startTime) : p.elapsed; await logToHistory(p.name, fin); problems.splice(idx, 1); }
  await saveProblems(); renderProblems();
});

async function logToHistory(name, elapsed) {
  const data = await activeStorage.get('leetcode_history'); const logs = data.leetcode_history || [];
  logs.unshift({ name, timeStr: formatTime(elapsed, true), elapsedMs: elapsed, timestamp: Date.now() });
  await activeStorage.set({ leetcode_history: logs });
}

async function renderHistory() {
  const list = document.getElementById('log-list'); const data = await activeStorage.get('leetcode_history'); const logs = data.leetcode_history || [];
  if (logs.length === 0) { list.innerHTML = '<div style="opacity: 0.5;">No history yet.</div>'; return; }
  list.innerHTML = logs.map(l => `<div class="log-entry"><strong>${l.name}</strong>: ${l.timeStr || l.time}<br><small style="opacity: 0.6;">${new Date(l.timestamp).toLocaleString()}</small></div>`).join('');
}

let hChart, aChart, hoChart;

async function renderStats() {
  const data = await activeStorage.get(['leetcode_history', 'leetcode_problems']);
  const logs = data.leetcode_history || []; const current = data.leetcode_problems || [];
  
  const totalMs = logs.reduce((s, l) => s + (l.elapsedMs || parseTimeToMs(l.timeStr || l.time)), 0);
  const totalMins = Math.floor(totalMs / 60000); const totalSecs = Math.floor((totalMs % 60000) / 1000);
  document.getElementById('total-problems').textContent = logs.length;
  document.getElementById('total-time-spent').textContent = totalMins > 0 ? `${totalMins}m ${totalSecs}s` : `${totalSecs}s`;

  // Streak
  const solvedDays = [...new Set(logs.map(l => getDateKey(l.timestamp)))].sort((a,b) => b.localeCompare(a));
  let streak = 0;
  if (solvedDays.length > 0) {
    let check = new Date(); check.setHours(0,0,0,0);
    if (solvedDays[0] === getDateKey(check) || solvedDays[0] === getDateKey(new Date(check.getTime() - 86400000))) {
      if (solvedDays[0] !== getDateKey(check)) check.setDate(check.getDate() - 1);
      for (let day of solvedDays) {
        if (day === getDateKey(check)) { streak++; check.setDate(check.getDate() - 1); }
        else break;
      }
    }
  }
  document.getElementById('current-streak').textContent = streak;

  const last7Keys = []; const last7Labels = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7Keys.push(getDateKey(d)); last7Labels.push((d.getMonth()+1)+'/'+d.getDate()); }
  const dailyMins = last7Keys.map(k => {
    const ms = logs.filter(l => getDateKey(l.timestamp) === k).reduce((s,l) => s + (l.elapsedMs || parseTimeToMs(l.timeStr || l.time)), 0);
    return parseFloat((ms / 60000).toFixed(2));
  });
  if (hChart) hChart.destroy();
  hChart = new Chart(document.getElementById('progressChart'), {
    type: 'line', data: { labels: last7Labels, datasets: [{ data: dailyMins, borderColor: '#00ff00', backgroundColor: 'rgba(0,255,0,0.1)', fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#00ff00', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#00ff00', font:{size:9}}} }, plugins:{legend:{display:false}} }
  });

  const activeS = document.getElementById('active-chart-section');
  if (current.length > 0) {
    activeS.style.display = 'flex';
    if (aChart) aChart.destroy();
    aChart = new Chart(document.getElementById('activeProblemsChart'), {
      type: 'bar', data: { labels: current.map(p => p.name.substring(0,8)), datasets: [{ data: current.map(p => (p.isRunning ? Date.now()-p.startTime : p.elapsed)/60000), backgroundColor:'rgba(0,255,0,0.4)', borderColor:'#00ff00', borderWidth:1 }] },
      options: { indexAxis:'y', responsive: true, maintainAspectRatio: false, scales: { x:{beginAtZero:true, ticks:{color:'#00ff00', font:{size:9}}}, y:{ticks:{color:'#00ff00', font:{size:9}}} }, plugins:{legend:{display:false}} }
    });
  } else { activeS.style.display = 'none'; }

  const hourlyData = Array(24).fill(0);
  logs.forEach(l => { hourlyData[new Date(l.timestamp).getHours()]++; });
  if (hoChart) hoChart.destroy();
  hoChart = new Chart(document.getElementById('hourlyActivityChart'), {
    type: 'bar', data: { labels: Array.from({length:24}, (_,i) => i === 0 ? '12am' : (i < 12 ? i+'am' : (i === 12 ? '12pm' : (i-12)+'pm'))), datasets: [{ data: hourlyData, backgroundColor:'rgba(0,255,0,0.6)' }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#00ff00', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#00ff00', font:{size:7}}} }, plugins:{legend:{display:false}} }
  });
}

document.getElementById('clear-log').addEventListener('click', async () => { if (confirm('Clear history?')) { await activeStorage.set({ leetcode_history: [] }); renderHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats(); } });

setInterval(() => { problems.forEach((p,i) => { if (p.isRunning) { const el = document.getElementById(`time-${i}`); if (el) el.textContent = formatTime(Date.now()-p.startTime, true); } }); }, 100);
async function init() { try { await initTimers(); await loadProblems(); await renderHistory(); } catch (e) { console.error(e); } }
init();
