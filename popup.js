/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 * GPLv3 License
 */

const storageAPI = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.sync : (typeof browser !== 'undefined' && browser.storage ? browser.storage.sync : null);

const activeStorage = {
  get: (keys) => new Promise(res => { if (storageAPI) storageAPI.get(keys, d => res(data || d)); else { const r = {}; const ka = Array.isArray(keys) ? keys : [keys]; ka.forEach(k => { try { r[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){r[k]=null;} }); res(r); } }),
  set: (obj) => new Promise(res => { if (storageAPI) storageAPI.set(obj, () => res()); else { for (let k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); res(); } })
};

// --- Matrix Rain Animation ---
class MatrixRain {
  constructor() {
    this.canvas = document.getElementById('matrix-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.columns = 0; this.drops = [];
    window.addEventListener('resize', () => this.init());
    this.init();
    this.animate();
  }
  init() {
    this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
    this.columns = Math.floor(this.canvas.width / 20);
    this.drops = Array(this.columns).fill(1);
  }
  animate() {
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

// --- Core Logic ---
let problems = [];
async function loadProblems() { const d = await activeStorage.get('leetcode_problems'); problems = d.leetcode_problems || []; renderProblems(); }
async function saveProblems() { await activeStorage.set({ leetcode_problems: problems }); }

function renderProblems() {
  const c = document.getElementById('problems-container'); if (!c) return; c.innerHTML = '';
  problems.forEach((p, i) => {
    const r = document.createElement('div'); r.className = 'problem-row';
    const cur = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    r.innerHTML = `<div class="problem-header"><span>[${p.diff || '?'}] ${p.name}</span><button class="btn-small" data-index="${i}" data-action="delete">X</button></div>
    <div class="problem-controls"><div class="problem-time" id="time-${i}">${formatTime(cur, true)}</div>
    <button class="btn-small" data-index="${i}" data-action="toggle">${p.isRunning ? 'PAUSE' : 'START'}</button>
    <button class="btn-small" data-index="${i}" data-action="reset">RESET</button><button class="btn-small" data-index="${i}" data-action="finish">FINISH</button></div>`;
    c.appendChild(r);
  });
}

document.getElementById('add-problem').addEventListener('click', async () => {
  const nEl = document.getElementById('new-problem-name'); const dEl = document.getElementById('diff-select');
  const name = nEl.value.trim(); const diff = dEl.value;
  if (name) { problems.push({ name, diff, elapsed: 0, isRunning: false, startTime: 0 }); nEl.value = ''; await saveProblems(); renderProblems(); }
});

document.getElementById('problems-container').addEventListener('click', async (e) => {
  const a = e.target.dataset.action; const i = parseInt(e.target.dataset.index); if (a === undefined) return;
  const p = problems[i];
  if (a === 'toggle') { if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; } else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; } }
  else if (a === 'reset') { p.elapsed = 0; p.isRunning = false; }
  else if (a === 'delete') { problems.splice(i, 1); }
  else if (a === 'finish') { const f = p.isRunning ? (Date.now() - p.startTime) : p.elapsed; await logToHistory(p.name, p.diff, f); problems.splice(i, 1); }
  await saveProblems(); renderProblems();
});

// --- Auto-fill from Content Script ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'leetcode_title') {
    const el = document.getElementById('new-problem-name');
    if (el && !el.value) el.value = msg.title;
  }
});

// --- Shortcuts ---
chrome.commands?.onCommand.addListener((cmd) => {
  if (cmd === 'toggle-timer' && problems.length > 0) {
    const p = problems[0];
    if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; }
    else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; }
    saveProblems(); renderProblems();
  }
});

// --- History & CSV ---
async function logToHistory(name, diff, elapsed) {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  h.unshift({ name, diff, timeStr: formatTime(elapsed, true), elapsedMs: elapsed, timestamp: Date.now() });
  await activeStorage.set({ leetcode_history: h });
}

async function renderHistory() {
  const l = document.getElementById('log-list'); const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  if (h.length === 0) { l.innerHTML = '<div style="opacity: 0.5;">No history.</div>'; return; }
  l.innerHTML = h.map(i => `<div class="log-entry"><strong>[${i.diff}] ${i.name}</strong>: ${i.timeStr}<br><small style="opacity: 0.6;">${new Date(i.timestamp).toLocaleString()}</small></div>`).join('');
}

document.getElementById('export-csv').addEventListener('click', async () => {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  if (h.length === 0) return;
  let csv = 'Name,Difficulty,Time,Timestamp\n';
  h.forEach(i => { csv += `"${i.name}","${i.diff}","${i.timeStr}","${new Date(i.timestamp).toLocaleString()}"\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'leetcode_history.csv'; a.click();
});

// --- Stats Charts ---
let hChart, aChart, hoChart, dChart;
async function renderStats() {
  const d = await activeStorage.get(['leetcode_history', 'leetcode_problems']);
  const logs = d.leetcode_history || []; const current = d.leetcode_problems || [];
  
  const totalMs = logs.reduce((s, l) => s + (l.elapsedMs || parseTimeToMs(l.timeStr)), 0);
  document.getElementById('total-problems').textContent = logs.length;
  document.getElementById('total-time-spent').textContent = formatTime(totalMs);

  // Streak
  const days = [...new Set(logs.map(l => getDateKey(l.timestamp)))].sort((a,b) => b.localeCompare(a));
  let streak = 0; if (days.length > 0) { let c = new Date(); c.setHours(0,0,0,0); if (days[0] === getDateKey(c) || days[0] === getDateKey(new Date(c.getTime()-86400000))) { if (days[0] !== getDateKey(c)) c.setDate(c.getDate()-1); for (let day of days) { if (day === getDateKey(c)) { streak++; c.setDate(c.getDate()-1); } else break; } } }
  document.getElementById('current-streak').textContent = streak;

  // Chart 1: 7-Day Line
  const l7k = []; const l7l = []; for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l7k.push(getDateKey(d)); l7l.push((d.getMonth()+1)+'/'+d.getDate()); }
  const dailyMins = l7k.map(k => { const ms = logs.filter(l => getDateKey(l.timestamp) === k).reduce((s,l)=>s+(l.elapsedMs || parseTimeToMs(l.timeStr)), 0); return parseFloat((ms/60000).toFixed(2)); });
  if (hChart) hChart.destroy(); hChart = new Chart(document.getElementById('progressChart'), { type:'line', data:{ labels:l7l, datasets:[{ data:dailyMins, borderColor:'#0f0', backgroundColor:'rgba(0,255,0,0.1)', fill:true, tension:0.3 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}} }, plugins:{legend:{display:false}} } });

  // Chart 2: Difficulty Distribution
  const diffs = { 'Easy': 0, 'Medium': 0, 'Hard': 0 }; logs.forEach(l => { if(diffs[l.diff]!==undefined) diffs[l.diff]++; });
  if (dChart) dChart.destroy(); dChart = new Chart(document.getElementById('diffChart'), { type:'doughnut', data:{ labels:Object.keys(diffs), datasets:[{ data:Object.values(diffs), backgroundColor:['#00ff00', '#ffaa00', '#ff0000'], borderWidth:0 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{color:'#0f0', font:{size:10}} } } } });

  // Chart 3: Hourly
  const hrData = Array(24).fill(0); logs.forEach(l => { hrData[new Date(l.timestamp).getHours()]++; });
  if (hoChart) hoChart.destroy(); hoChart = new Chart(document.getElementById('hourlyActivityChart'), { type:'bar', data:{ labels:Array.from({length:24}, (_,i)=>i), datasets:[{ data:hrData, backgroundColor:'rgba(0,255,0,0.6)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:7}}} }, plugins:{legend:{display:false}} } });
}

// --- Initial Init ---
new MatrixRain();
loadProblems();
initTimers(); // From earlier logic
setInterval(() => { problems.forEach((p,i) => { if (p.isRunning) { const el = document.getElementById(`time-${i}`); if (el) el.textContent = formatTime(Date.now()-p.startTime, true); } }); }, 100);
async function initTimers() {
  const d = await activeStorage.get(['timer_target', 'sw_elapsed', 'sw_start_time', 'sw_is_running']);
  if (d.timer_target && d.timer_target > Date.now()) { startTimerUI(d.timer_target); }
  if (d.sw_is_running) { startSwUI(d.sw_start_time); }
}
// (Include simplified Timer/SW start functions if needed for the combined file)
