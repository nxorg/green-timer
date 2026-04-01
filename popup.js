/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 * GPLv3 License
 */

const storageAPI = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : (typeof browser !== 'undefined' && browser.storage ? browser.storage.sync : null);

const activeStorage = {
  get: (keys) => new Promise(res => { if (storageAPI) storageAPI.get(keys, d => res(d || {})); else { const r = {}; const ka = Array.isArray(keys) ? keys : [keys]; ka.forEach(k => { try { r[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){r[k]=null;} }); res(r); } }),
  set: (obj) => new Promise(res => { if (storageAPI) storageAPI.set(obj, () => res()); else { for (let k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); res(); } })
};

// --- Matrix Rain ---
class MatrixRain {
  constructor() {
    this.canvas = document.getElementById('matrix-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.columns = 0; this.drops = [];
    window.addEventListener('resize', () => this.init());
    this.init(); this.animate();
  }
  init() {
    this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
    this.columns = Math.floor(this.canvas.width / 20);
    this.drops = Array(this.columns).fill(1);
  }
  animate() {
    if (document.hidden) { requestAnimationFrame(() => this.animate()); return; }
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#0f0'; this.ctx.font = '15px monospace';
    for (let i = 0; i < this.drops.length; i++) {
      const text = String.fromCharCode(0x30A0 + Math.random() * 96);
      this.ctx.fillText(text, i * 20, this.drops[i] * 20);
      if (this.drops[i] * 20 > this.canvas.height && Math.random() > 0.975) this.drops[i] = 0;
      this.drops[i]++;
    }
    requestAnimationFrame(() => this.animate());
  }
}

// --- Tab Logic ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'log') renderHistory();
    if (btn.dataset.tab === 'stats') renderStats();
    if (btn.dataset.tab === 'stopwatch') renderProblems();
  });
});

// --- Helpers ---
function formatTime(ms, isSW = false) {
  let s = Math.floor(ms / 1000); let m = Math.floor(s / 60); let h = Math.floor(m / 60);
  s %= 60; m %= 60;
  let d = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  if (isSW) d += `.${String(Math.floor((ms%1000)/10)).padStart(2,'0')}`;
  return d;
}
function parseTimeToMs(ts) {
  if (!ts || typeof ts !== 'string') return 0;
  const p = ts.split(':'); if (p.length < 3) return 0;
  const sp = p[2].split('.');
  return (parseInt(p[0]) * 3600000) + (parseInt(p[1]) * 60000) + (parseInt(sp[0]) * 1000) + (sp[1] ? parseInt(sp[1].substring(0,2).padEnd(2,'0'))*10 : 0);
}
function getDateKey(d) { const o = new Date(d); return o.getFullYear()+'-'+String(o.getMonth()+1).padStart(2,'0')+'-'+String(o.getDate()).padStart(2,'0'); }

// --- Auto-fill Detection ---
function updateProblemInput(title) {
  const el = document.getElementById('new-problem-name');
  const statusEl = document.getElementById('detection-status');
  if (el && title) {
    el.value = title;
    if (statusEl) statusEl.style.display = 'block';
  }
}

async function requestLeetCodeTitle() {
  if (!chrome.tabs) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes('leetcode.com/problems/')) {
    chrome.tabs.sendMessage(tab.id, { type: 'get_leetcode_title' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.title) updateProblemInput(response.title);
    });
  }
}

// --- Logic ---
let timerInterval, swInterval;
let timerTargetTime = 0, swElapsedTime = 0, swStartTime = 0;
let problems = [];

async function initTimers() {
  const data = await activeStorage.get(['timer_target', 'sw_elapsed', 'sw_start_time', 'sw_is_running']);
  if (data.timer_target && data.timer_target > Date.now()) { timerTargetTime = data.timer_target; startTimerUI(); }
  swElapsedTime = data.sw_elapsed || 0;
  if (data.sw_is_running) { swStartTime = data.sw_start_time || Date.now(); startStandaloneSwUI(); } else { updateSwDisplay(); }
}

function startTimerUI() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const tl = timerTargetTime - Date.now();
    if (tl <= 0) { clearInterval(timerInterval); document.getElementById('timer-display').textContent = '00:00:00'; }
    else { document.getElementById('timer-display').textContent = formatTime(tl); }
  }, 1000);
}

document.getElementById('timer-start').addEventListener('click', async () => {
  const mins = parseInt(document.getElementById('timer-input').value) || 0;
  if (mins > 0) { timerTargetTime = Date.now() + mins * 60 * 1000; await activeStorage.set({ timer_target: timerTargetTime }); chrome.alarms.create('timer-finished', { when: timerTargetTime }); startTimerUI(); }
});

document.getElementById('timer-pause').addEventListener('click', () => { clearInterval(timerInterval); if(chrome.alarms) chrome.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); });
document.getElementById('timer-reset').addEventListener('click', () => { clearInterval(timerInterval); if(chrome.alarms) chrome.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); document.getElementById('timer-display').textContent = '00:00:00'; });

function updateSwDisplay() { const el = document.getElementById('sw-display'); if (el) el.textContent = formatTime(swElapsedTime, true); }
function startStandaloneSwUI() { if (swInterval) clearInterval(swInterval); swInterval = setInterval(() => { const el = document.getElementById('sw-display'); if(el) el.textContent = formatTime(Date.now() - swStartTime, true); }, 50); }
document.getElementById('sw-start').addEventListener('click', async () => { if (swInterval) return; swStartTime = Date.now() - swElapsedTime; await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime }); startStandaloneSwUI(); });
document.getElementById('sw-pause').addEventListener('click', async () => { if (swInterval) { clearInterval(swInterval); swInterval = null; } swElapsedTime = Date.now() - swStartTime; await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime }); updateSwDisplay(); });
document.getElementById('sw-reset').addEventListener('click', async () => { clearInterval(swInterval); swInterval = null; swElapsedTime = 0; await activeStorage.set({ sw_is_running: false, sw_elapsed: 0 }); updateSwDisplay(); });

document.querySelectorAll('.preset').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('timer-input').value = btn.dataset.time; }); });

// --- Problems ---
async function loadProblems() { const d = await activeStorage.get('leetcode_problems'); problems = d.leetcode_problems || []; renderProblems(); }
async function saveProblems() { await activeStorage.set({ leetcode_problems: problems }); }

function renderProblems() {
  const c = document.getElementById('problems-container'); if (!c) return; c.innerHTML = '';
  problems.forEach((p, i) => {
    const r = document.createElement('div'); r.className = 'problem-row';
    const cur = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    r.innerHTML = `<div class="problem-header"><span>${p.name}</span><button class="btn-small" data-index="${i}" data-action="delete">X</button></div>
    <div class="problem-controls"><div class="problem-time" id="time-${i}">${formatTime(cur, true)}</div>
    <button class="btn-small" data-index="${i}" data-action="toggle">${p.isRunning ? 'PAUSE' : 'START'}</button>
    <button class="btn-small" data-index="${i}" data-action="reset">RESET</button><button class="btn-small" data-index="${i}" data-action="finish">FINISH</button></div>`;
    c.appendChild(r);
  });
}

document.getElementById('add-problem').addEventListener('click', async () => {
  const nEl = document.getElementById('new-problem-name'); const name = nEl.value.trim();
  if (name) {
    problems.push({ name, elapsed: 0, isRunning: false, startTime: 0 });
    nEl.value = '';
    const statusEl = document.getElementById('detection-status');
    if (statusEl) statusEl.style.display = 'none';
    await saveProblems(); renderProblems();
  }
});

document.getElementById('problems-container').addEventListener('click', async (e) => {
  const action = e.target.dataset.action; const i = parseInt(e.target.dataset.index); if (action === undefined || isNaN(i)) return;
  const p = problems[i];
  if (action === 'toggle') { if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; } else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; } }
  else if (action === 'reset') { p.elapsed = 0; p.isRunning = false; }
  else if (action === 'delete') { problems.splice(i, 1); }
  else if (action === 'finish') { const f = p.isRunning ? (Date.now() - p.startTime) : p.elapsed; await logToHistory(p.name, f); problems.splice(i, 1); }
  await saveProblems(); renderProblems();
});

// --- Listeners ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'leetcode_title') updateProblemInput(msg.title);
});

chrome.commands?.onCommand.addListener((cmd) => {
  if (cmd === 'toggle-timer' && problems.length > 0) {
    const p = problems[0]; if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; } else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; }
    saveProblems(); renderProblems();
  }
});

// --- History & Stats ---
async function logToHistory(name, elapsed) {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  h.unshift({ name, timeStr: formatTime(elapsed, true), elapsedMs: elapsed, timestamp: Date.now() });
  await activeStorage.set({ leetcode_history: h });
}

async function renderHistory() {
  const l = document.getElementById('log-list'); const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  if (!l) return;
  if (h.length === 0) { l.innerHTML = '<div style="opacity: 0.5;">No history.</div>'; return; }
  l.innerHTML = h.map(i => `<div class="log-entry"><strong>${i.name}</strong>: ${i.timeStr}<br><small style="opacity: 0.6;">${new Date(i.timestamp).toLocaleString()}</small></div>`).join('');
}

document.getElementById('export-csv').addEventListener('click', async () => {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  if (h.length === 0) return;
  let csv = 'Name,Time,Timestamp\n';
  h.forEach(i => { csv += `"${i.name}","${i.timeStr}","${new Date(i.timestamp).toLocaleString()}"\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'leetcode_history.csv'; a.click();
});

let hChart, aChart, hoChart;
async function renderStats() {
  const d = await activeStorage.get(['leetcode_history', 'leetcode_problems']);
  const logs = d.leetcode_history || []; const curr = d.leetcode_problems || [];
  const totalMs = logs.reduce((s, l) => s + (l.elapsedMs || parseTimeToMs(l.timeStr)), 0);
  document.getElementById('total-problems').textContent = logs.length;
  document.getElementById('total-time-spent').textContent = formatTime(totalMs);

  const days = [...new Set(logs.map(l => getDateKey(l.timestamp)))].sort((a,b) => b.localeCompare(a));
  let streak = 0; if (days.length > 0) { let c = new Date(); c.setHours(0,0,0,0); if (days[0] === getDateKey(c) || days[0] === getDateKey(new Date(c.getTime()-86400000))) { if (days[0] !== getDateKey(c)) c.setDate(c.getDate()-1); for (let day of days) { if (day === getDateKey(c)) { streak++; c.setDate(c.getDate()-1); } else break; } } }
  document.getElementById('current-streak').textContent = streak;

  const l7k = []; const l7l = []; for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l7k.push(getDateKey(d)); l7l.push((d.getMonth()+1)+'/'+d.getDate()); }
  const dailyMins = l7k.map(k => { const ms = logs.filter(l => getDateKey(l.timestamp) === k).reduce((s,l)=>s+(l.elapsedMs || parseTimeToMs(l.timeStr)), 0); return parseFloat((ms/60000).toFixed(2)); });
  const ctxH = document.getElementById('progressChart');
  if(ctxH) {
    if (hChart) hChart.destroy();
    hChart = new Chart(ctxH, { type:'line', data:{ labels:l7l, datasets:[{ data:dailyMins, borderColor:'#0f0', backgroundColor:'rgba(0,255,0,0.1)', fill:true, tension:0.3 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}} }, plugins:{legend:{display:false}} } });
  }

  const activeS = document.getElementById('active-chart-section');
  if (curr.length > 0 && activeS) {
    activeS.style.display = 'flex'; const ctxA = document.getElementById('activeProblemsChart');
    if(ctxA) {
      if (aChart) aChart.destroy();
      aChart = new Chart(ctxA, { type:'bar', data:{ labels:curr.map(p => p.name.substring(0,8)), datasets:[{ data:curr.map(p => (p.isRunning ? Date.now()-p.startTime : p.elapsed)/60000), backgroundColor:'rgba(0,255,0,0.4)', borderColor:'#00ff00', borderWidth:1 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{beginAtZero:true, ticks:{color:'#0f0', font:{size:9}}}, y:{ticks:{color:'#0f0', font:{size:9}}} }, plugins:{legend:{display:false}} } });
    }
  } else if (activeS) activeS.style.display = 'none';

  const hrData = Array(24).fill(0); logs.forEach(l => { hrData[new Date(l.timestamp).getHours()]++; });
  const ctxHo = document.getElementById('hourlyActivityChart');
  if(ctxHo) {
    if (hoChart) hoChart.destroy();
    hoChart = new Chart(ctxHo, { type:'bar', data:{ labels:Array.from({length:24}, (_,i)=>i), datasets:[{ data:hrData, backgroundColor:'rgba(0,255,0,0.6)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:7}}} }, plugins:{legend:{display:false}} } });
  }
}

document.getElementById('clear-log').addEventListener('click', async () => { if (confirm('Clear?')) { await activeStorage.set({ leetcode_history: [] }); renderHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats(); } });

// --- Init ---
new MatrixRain(); loadProblems(); initTimers(); requestLeetCodeTitle();
setInterval(() => { problems.forEach((p,i) => { if (p.isRunning) { const el = document.getElementById(`time-${i}`); if (el) el.textContent = formatTime(Date.now()-p.startTime, true); } }); }, 100);
async function init() { try { await renderHistory(); } catch(e){} } init();
