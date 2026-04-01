/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 * GPLv3 License
 */

const api = (typeof browser !== 'undefined') ? browser : chrome;
const storageAPI = api.storage ? api.storage.sync : null;

const activeStorage = {
  get: (keys) => new Promise(res => {
    if (storageAPI) { storageAPI.get(keys, d => res(d || {})); }
    else {
      const r = {}; const ka = Array.isArray(keys) ? keys : [keys];
      ka.forEach(k => { try { r[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){r[k]=null;} });
      res(r);
    }
  }),
  set: (obj) => new Promise(res => {
    if (storageAPI) { storageAPI.set(obj, () => res()); }
    else { for (let k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); res(); }
  })
};

// --- Matrix Rain ---
class MatrixRain {
  constructor() {
    this.canvas = document.getElementById('matrix-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.columns = 0; this.drops = []; this.active = false;
    window.addEventListener('resize', () => this.init());
    this.init();
  }
  init() {
    this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
    this.columns = Math.floor(this.canvas.width / 20);
    this.drops = Array(this.columns).fill(1);
  }
  start() { if (!this.active) { this.active = true; this.animate(); } }
  stop() { this.active = false; }
  animate() {
    if (!this.active || document.hidden) return;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#0f0'; this.ctx.font = '15px monospace';
    for (let i = 0; i < this.drops.length; i++) {
      const text = String.fromCharCode(0x30A0 + Math.random() * 96);
      this.ctx.fillText(text, i * 20, this.drops[i] * 20);
      if (this.drops[i] * 20 > this.canvas.height && Math.random() > 0.975) this.drops[i] = 0;
      this.drops[i]++;
    }
    setTimeout(() => requestAnimationFrame(() => this.animate()), 50);
  }
}

const matrix = new MatrixRain();

// --- Tab Logic ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
    if (['stats', 'about', 'standalone-sw'].includes(btn.dataset.tab)) matrix.start();
    else matrix.stop();
    if (btn.dataset.tab === 'log') renderHistory();
    if (btn.dataset.tab === 'stats') renderStats();
    if (btn.dataset.tab === 'stopwatch') renderProblems();
  });
});

// --- Helpers ---
function formatTime(ms, isSW = false) {
  if (!ms || isNaN(ms)) ms = 0;
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

// --- Badge Update ---
async function updateBadge() {
  const d = await activeStorage.get('leetcode_history');
  const logs = d.leetcode_history || [];
  const todayK = getDateKey(new Date());
  const todayCount = logs.filter(l => getDateKey(l.timestamp) === todayK).length;
  
  if (api.action) {
    api.action.setBadgeText({ text: todayCount > 0 ? todayCount.toString() : "" });
    api.action.setBadgeBackgroundColor({ color: "#FF0000" });
    if (api.action.setBadgeTextColor) api.action.setBadgeTextColor({ color: "#FFFFFF" });
  }
}

// --- Auto-fill Detection ---
let detectedDetails = null;
let detectionRetries = 0;

function updateProblemInput(details) {
  if (!details || !details.name) return false;
  detectedDetails = details;
  const el = document.getElementById('new-problem-name');
  const statusEl = document.getElementById('detection-status');
  if (el && !el.value) {
    el.value = details.name;
    if (statusEl) {
      statusEl.textContent = `✅ Detected: #${details.number || '?'}`;
      statusEl.style.display = 'block';
    }
    return true;
  }
  return false;
}

async function requestLeetCodeTitle() {
  if (!api.tabs) return;
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes('leetcode.com/problems/')) {
      const statusEl = document.getElementById('detection-status');
      if (statusEl) statusEl.style.display = 'none';
      return;
    }
    api.tabs.sendMessage(tab.id, { type: 'get_leetcode_details' }, async (response) => {
      if (api.runtime.lastError || !response) {
        if (api.scripting) {
          try {
            await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            setTimeout(requestLeetCodeTitle, 300);
          } catch(e) {}
        }
        let title = tab.title; if (title.includes(' - LeetCode')) title = title.split(' - LeetCode')[0];
        let num = ""; let name = title; if (title.includes('. ')) { num = title.split('. ')[0]; name = title.split('. ').slice(1).join('. '); }
        updateProblemInput({ number: num, name: name, url: tab.url });
      } else { updateProblemInput(response); }
    });
  } catch (e) { console.error("Detection failed", e); }
}

// --- Logic ---
let timerInterval, swInterval, uiInterval;
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
  if (mins > 0) { timerTargetTime = Date.now() + mins * 60 * 1000; await activeStorage.set({ timer_target: timerTargetTime }); if(api.alarms) api.alarms.create('timer-finished', { when: timerTargetTime }); startTimerUI(); }
});

document.getElementById('timer-pause').addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); });
document.getElementById('timer-reset').addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); document.getElementById('timer-display').textContent = '00:00:00'; });

function updateSwDisplay() { const el = document.getElementById('sw-display'); if (el) el.textContent = formatTime(swElapsedTime, true); }
function startStandaloneSwUI() { if (swInterval) clearInterval(swInterval); swInterval = setInterval(() => { const el = document.getElementById('sw-display'); if(el) el.textContent = formatTime(Date.now() - swStartTime, true); }, 50); }
document.getElementById('sw-start').addEventListener('click', async () => { if (swInterval) return; swStartTime = Date.now() - swElapsedTime; await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime }); startStandaloneSwUI(); });
document.getElementById('sw-pause').addEventListener('click', async () => { if (swInterval) { clearInterval(swInterval); swInterval = null; } swElapsedTime = Date.now() - swStartTime; await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime }); updateSwDisplay(); });
document.getElementById('sw-reset').addEventListener('click', async () => { clearInterval(swInterval); swInterval = null; swElapsedTime = 0; await activeStorage.set({ sw_is_running: false, sw_elapsed: 0 }); updateSwDisplay(); });

document.querySelectorAll('.preset').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('timer-input').value = btn.dataset.time; }); });

// --- Problems ---
async function loadProblems() { const d = await activeStorage.get('leetcode_problems'); problems = d.leetcode_problems || []; renderProblems(); startUIInterval(); }
async function saveProblems() { await activeStorage.set({ leetcode_problems: problems }); }

function renderProblems() {
  const c = document.getElementById('problems-container'); if (!c) return; c.innerHTML = '';
  problems.forEach((p, i) => {
    const r = document.createElement('div'); r.className = 'problem-row';
    const cur = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    const dn = (p.number ? p.number + ". " : "") + p.name;
    const th = p.url ? `<a href="${p.url}" target="_blank" style="color: #0f0; text-decoration: none; border-bottom: 1px dashed #0f0;">${dn}</a>` : dn;
    r.innerHTML = `<div class="problem-header"><span>${th}</span><button class="btn-small" data-index="${i}" data-action="delete">X</button></div>
    <div class="problem-controls"><div class="problem-time" id="time-${i}">${formatTime(cur, true)}</div>
    <button class="btn-small" data-index="${i}" data-action="toggle">${p.isRunning ? 'PAUSE' : 'START'}</button>
    <button class="btn-small" data-index="${i}" data-action="reset">RESET</button><button class="btn-small" data-index="${i}" data-action="finish">FINISH</button></div>`;
    c.appendChild(r);
  });
}

document.getElementById('add-problem').addEventListener('click', async () => {
  const nEl = document.getElementById('new-problem-name'); const nameInput = nEl.value.trim();
  if (nameInput) {
    let fn = nameInput; let fnum = detectedDetails ? detectedDetails.number : ""; let furl = detectedDetails ? detectedDetails.url : "";
    if (fnum && nameInput.startsWith(fnum + ". ")) fn = nameInput.replace(fnum + ". ", "");
    problems.push({ name: fn, number: fnum, url: furl, elapsed: 0, isRunning: false, startTime: 0 });
    nEl.value = ''; const statusEl = document.getElementById('detection-status'); if (statusEl) statusEl.style.display = 'none';
    detectedDetails = null; await saveProblems(); renderProblems(); startUIInterval();
  }
});

document.getElementById('problems-container').addEventListener('click', async (e) => {
  const action = e.target.dataset.action; const i = parseInt(e.target.dataset.index); if (action === undefined || isNaN(i)) return;
  const p = problems[i];
  if (action === 'toggle') { if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; } else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; } }
  else if (action === 'reset') { p.elapsed = 0; p.isRunning = false; }
  else if (action === 'delete') { problems.splice(i, 1); }
  else if (action === 'finish') { const f = p.isRunning ? (Date.now() - p.startTime) : p.elapsed; await logToHistory(p, f); problems.splice(i, 1); updateBadge(); }
  await saveProblems(); renderProblems(); startUIInterval();
});

function startUIInterval() {
  if (uiInterval) clearInterval(uiInterval);
  if (!problems.some(p => p.isRunning)) return;
  uiInterval = setInterval(() => {
    problems.forEach((p, i) => { if (p.isRunning) { const el = document.getElementById(`time-${i}`); if (el) el.textContent = formatTime(Date.now() - p.startTime, true); } });
  }, 100);
}

// --- Listeners ---
api.runtime.onMessage.addListener((msg) => { if (msg.type === 'leetcode_details') updateProblemInput(msg.details); });

// --- History & CSV ---
async function logToHistory(prob, elapsed) {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  h.unshift({ name: prob.name, number: prob.number, url: prob.url, timeStr: formatTime(elapsed, true), elapsedMs: elapsed, timestamp: Date.now() });
  await activeStorage.set({ leetcode_history: h });
}

async function renderHistory() {
  const l = document.getElementById('log-list'); const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  if (!l) return; if (h.length === 0) { l.innerHTML = '<div style="opacity: 0.5;">No history.</div>'; return; }
  l.innerHTML = h.map(i => {
    const dn = (i.number ? i.number + ". " : "") + i.name;
    const th = i.url ? `<a href="${i.url}" target="_blank" style="color: #0f0; text-decoration: none; border-bottom: 1px dashed #0f0;">${dn}</a>` : dn;
    const dd = (val) => { const d = new Date(val); const now = new Date(); if (getDateKey(d) === getDateKey(now)) return "Today " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); return d.toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'}); };
    return `<div class="log-entry"><strong>${th}</strong>: ${i.timeStr}<br><small style="opacity: 0.6;">${dd(i.timestamp)}</small></div>`;
  }).join('');
}

document.getElementById('export-csv').addEventListener('click', async () => {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  if (h.length === 0) return;
  let csv = 'Number,Name,Time,URL,ISO_Date,Local_Time\n';
  h.forEach(i => { const date = new Date(i.timestamp); csv += `"${i.number}","${i.name}","${i.timeStr}","${i.url}","${date.toISOString()}","${date.toLocaleString()}"\n`; });
  const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'leetcode_study_logs.csv'; a.click();
});

let hChart, aChart, hoChart;
async function renderStats() {
  const d = await activeStorage.get(['leetcode_history', 'leetcode_problems']);
  const logs = d.leetcode_history || []; const curr = d.leetcode_problems || [];
  const totalMs = logs.reduce((s, l) => s + (l.elapsedMs || parseTimeToMs(l.timeStr)), 0);
  document.getElementById('total-problems').textContent = logs.length;
  document.getElementById('total-time-spent').textContent = formatTime(totalMs);

  const days = [...new Set(logs.map(l => getDateKey(l.timestamp)))].filter(k => k !== "").sort((a,b) => b.localeCompare(a));
  let streak = 0; if (days.length > 0) {
    let check = new Date(); check.setHours(0,0,0,0);
    const todayK = getDateKey(check); const yesterdayK = getDateKey(new Date(check.getTime() - 86400000));
    if (days[0] === todayK || days[0] === yesterdayK) {
      let curC = (days[0] === todayK) ? check : new Date(check.getTime() - 86400000);
      for (let day of days) { if (day === getDateKey(curC)) { streak++; curC.setDate(curC.getDate() - 1); } else break; }
    }
  }
  document.getElementById('current-streak').textContent = streak;

  const l7k = []; const l7l = []; for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l7k.push(getDateKey(d)); l7l.push((d.getMonth()+1)+'/'+d.getDate()); }
  const dailyMins = l7k.map(k => { const ms = logs.filter(l => getDateKey(l.timestamp) === k).reduce((s,l)=>s+(l.elapsedMs || parseTimeToMs(l.timeStr)), 0); return parseFloat((ms/60000).toFixed(2)); });
  const ctxH = document.getElementById('progressChart');
  if(ctxH) { if (hChart) hChart.destroy(); hChart = new Chart(ctxH, { type:'line', data:{ labels:l7l, datasets:[{ data:dailyMins, borderColor:'#0f0', backgroundColor:'rgba(0,255,0,0.1)', fill:true, tension:0.3 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}} }, plugins:{legend:{display:false}} } }); }

  const activeS = document.getElementById('active-chart-section');
  if (curr.length > 0 && activeS) {
    activeS.style.display = 'flex'; const ctxA = document.getElementById('activeProblemsChart');
    if(ctxA) { if (aChart) aChart.destroy(); aChart = new Chart(ctxA, { type:'bar', data:{ labels:curr.map(p => (p.number ? p.number + " " : "") + p.name.substring(0,8)), datasets:[{ data:curr.map(p => (p.isRunning ? Date.now()-p.startTime : p.elapsed)/60000), backgroundColor:'rgba(0,255,0,0.4)', borderColor:'#00ff00', borderWidth:1 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{beginAtZero:true, ticks:{color:'#0f0', font:{size:9}}}, y:{ticks:{color:'#0f0', font:{size:9}}} }, plugins:{legend:{display:false}} } }); }
  } else if (activeS) activeS.style.display = 'none';

  const hrData = Array(24).fill(0); logs.forEach(l => { const d = new Date(l.timestamp); if (!isNaN(d.getTime())) hrData[d.getHours()]++; });
  const ctxHo = document.getElementById('hourlyActivityChart');
  if(ctxHo) { if (hoChart) hoChart.destroy(); hoChart = new Chart(ctxHo, { type:'bar', data:{ labels:Array.from({length:24}, (_,i) => i === 0 ? '12am' : (i < 12 ? i+'am' : (i === 12 ? '12pm' : (i-12)+'pm'))), datasets:[{ data:hrData, backgroundColor:'rgba(0,255,0,0.6)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:9}}}, x:{grid:{color:'rgba(0,255,0,0.1)'}, ticks:{color:'#0f0', font:{size:7}}} }, plugins:{legend:{display:false}} } }); }
}

document.getElementById('clear-log').addEventListener('click', async () => { if (confirm('Clear?')) { await activeStorage.set({ leetcode_history: [] }); renderHistory(); updateBadge(); if (document.getElementById('stats').classList.contains('active')) renderStats(); } });

// --- Init ---
loadProblems(); initTimers(); requestLeetCodeTitle(); updateBadge();
async function init() { try { await renderHistory(); } catch(e){} } init();
