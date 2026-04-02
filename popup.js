/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 * GPLv3 License
 */

const api = (typeof browser !== 'undefined') ? browser : chrome;

// Update version immediately from manifest
document.addEventListener('DOMContentLoaded', async () => {
  try {
    document.getElementById('ext-version').textContent = 'v' + api.runtime.getManifest().version;
  } catch (e) {}
  
  // Migration Check: If local is empty but sync has data, migrate it.
  if (api.storage && api.storage.local && api.storage.sync) {
    const localData = await api.storage.local.get(null);
    if (Object.keys(localData).length === 0) {
      const syncData = await api.storage.sync.get(null);
      if (Object.keys(syncData).length > 0) {
        await api.storage.local.set(syncData);
        console.log("Data migrated to local storage.");
      }
    }
  }
});

const storageAPI = (api.storage && api.storage.local) ? api.storage.local : (api.storage ? api.storage.sync : null);

const activeStorage = {
  get: (keys) => new Promise((res, rej) => {
    if (storageAPI) { 
      storageAPI.get(keys, d => {
        if (api.runtime.lastError) rej(api.runtime.lastError);
        else res(d || {});
      }); 
    } else {
      const r = {};
      if (keys === null) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          try { r[k] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
        }
      } else {
        const ka = Array.isArray(keys) ? keys : [keys];
        ka.forEach(k => { try { r[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){r[k]=null;} });
      }
      res(r);
    }
  }),
  set: (obj) => new Promise((res, rej) => {
    if (storageAPI) { 
      storageAPI.set(obj, () => {
        if (api.runtime.lastError) rej(api.runtime.lastError);
        else res();
      }); 
    }
    else { try { for (let k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); res(); } catch(e) { rej(e); } }
  }),
  clear: () => new Promise((res, rej) => {
    if (storageAPI) { 
      storageAPI.clear(() => {
        if (api.runtime.lastError) rej(api.runtime.lastError);
        else res();
      }); 
    }
    else { localStorage.clear(); res(); }
  })
};

// --- Theme Logic ---
async function initTheme() {
  const data = await activeStorage.get('theme');
  if (data.theme === 'light') {
    document.body.classList.add('light-mode');
  }
}

document.getElementById('theme-toggle').addEventListener('click', async () => {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  await activeStorage.set({ theme: isLight ? 'light' : 'dark' });
  if (document.getElementById('stats').classList.contains('active')) renderStats();
});

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
    const isLight = document.body.classList.contains('light-mode');
    this.ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = isLight ? '#008000' : '#0f0';
    this.ctx.font = '15px monospace';
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
    if (btn.dataset.tab === 'stats') setTimeout(renderStats, 50);
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
function getDateKey(d) { if(!d) return ""; const o = new Date(d); if(isNaN(o.getTime())) return ""; return o.getFullYear()+'-'+String(o.getMonth()+1).padStart(2,'0')+'-'+String(o.getDate()).padStart(2,'0'); }

// --- Auto-fill Detection ---
let detectedDetails = null;
function updateProblemInput(details) {
  if (!details || !details.name) return false;
  detectedDetails = details;
  const el = document.getElementById('new-problem-name');
  const statusEl = document.getElementById('detection-status');
  if (el && !el.value) {
    el.value = details.name;
    if (statusEl) { statusEl.textContent = `✅ Detected: #${details.number || '?'}`; statusEl.style.display = 'block'; }
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
      const statusEl = document.getElementById('detection-status'); if (statusEl) statusEl.style.display = 'none';
      return;
    }
    api.tabs.sendMessage(tab.id, { type: 'get_leetcode_details' }, async (response) => {
      if (api.runtime.lastError || !response) {
        if (api.scripting) { try { await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); setTimeout(requestLeetCodeTitle, 300); } catch(e) {} }
        let title = tab.title; if (title.includes(' - LeetCode')) title = title.split(' - LeetCode')[0];
        let num = ""; let name = title; if (title.includes('. ')) { num = title.split('. ')[0]; name = title.split('. ').slice(1).join('. '); }
        updateProblemInput({ number: num, name: name, url: tab.url });
      } else { updateProblemInput(response); }
    });
  } catch (e) {}
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
    if (tl <= 0) { clearInterval(timerInterval); document.getElementById('timer-display').textContent = '00:00:00.00'; playBeep(); }
    else { document.getElementById('timer-display').textContent = formatTime(tl, true); }
  }, 50);
}

document.getElementById('timer-start').addEventListener('click', async () => {
  const mins = parseInt(document.getElementById('timer-input').value) || 0;
  if (mins > 0) { timerTargetTime = Date.now() + mins * 60 * 1000; await activeStorage.set({ timer_target: timerTargetTime }); if(api.alarms) api.alarms.create('timer-finished', { when: timerTargetTime }); startTimerUI(); }
});

document.getElementById('timer-pause').addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); });
document.getElementById('timer-reset').addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); document.getElementById('timer-display').textContent = '00:00:00.00'; });

function updateSwDisplay() { const el = document.getElementById('sw-display'); if (el) el.textContent = formatTime(swElapsedTime, true); }
function startStandaloneSwUI() { if (swInterval) clearInterval(swInterval); swInterval = setInterval(() => { const el = document.getElementById('sw-display'); if(el) el.textContent = formatTime(Date.now() - swStartTime, true); }, 50); }
document.getElementById('sw-start').addEventListener('click', async () => { if (swInterval) return; swStartTime = Date.now() - swElapsedTime; await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime }); startStandaloneSwUI(); });
document.getElementById('sw-pause').addEventListener('click', async () => { if (swInterval) { clearInterval(swInterval); swInterval = null; } swElapsedTime = Date.now() - swStartTime; await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime }); updateSwDisplay(); });
document.getElementById('sw-reset').addEventListener('click', async () => { clearInterval(swInterval); swInterval = null; swElapsedTime = 0; await activeStorage.set({ sw_is_running: false, sw_elapsed: 0 }); updateSwDisplay(); });

document.querySelectorAll('.preset-card').forEach(btn => { btn.addEventListener('click', () => { document.getElementById('timer-input').value = btn.dataset.time; }); });
document.getElementById('timer-inc').addEventListener('click', () => { const input = document.getElementById('timer-input'); input.value = parseInt(input.value || 0) + 1; });
document.getElementById('timer-dec').addEventListener('click', () => { const input = document.getElementById('timer-input'); const val = parseInt(input.value || 0); if (val > 1) input.value = val - 1; });

// --- Problems ---
async function loadProblems() { const d = await activeStorage.get('leetcode_problems'); problems = d.leetcode_problems || []; renderProblems(); startUIInterval(); }
async function saveProblems() { await activeStorage.set({ leetcode_problems: problems }); }

function renderProblems() {
  const c = document.getElementById('problems-container');
  if (!c) return;
  c.replaceChildren();
  
  if (problems.length === 0) {
    const welcome = document.createElement('div');
    welcome.style.textAlign = 'center'; welcome.style.padding = '40px 20px'; welcome.style.opacity = '0.6';
    welcome.innerHTML = `<div style="font-size: 2em; margin-bottom: 10px;">👋</div>
      <div style="font-weight: bold; color: var(--green);">Welcome, Coder!</div>
      <div style="font-size: 0.8em; margin-top: 5px;">Add a LeetCode problem above to start tracking your journey.</div>`;
    c.appendChild(welcome);
    return;
  }

  problems.forEach((p, i) => {
    const r = document.createElement('div'); r.className = 'problem-row';
    const cur = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    const dn = (p.number ? p.number + ". " : "") + p.name;
    const header = document.createElement('div'); header.className = 'problem-header';
    const span = document.createElement('span'); span.style.flexGrow = '1'; span.style.marginRight = '8px'; span.style.overflow = 'hidden'; span.style.textOverflow = 'ellipsis'; span.style.whiteSpace = 'nowrap';
    if (p.url) { const a = document.createElement('a'); a.href = p.url; a.target = '_blank'; a.textContent = dn; span.appendChild(a); } else { span.textContent = dn; }
    const notesBtn = document.createElement('button'); notesBtn.className = 'btn-small'; notesBtn.style.marginRight = '5px'; notesBtn.textContent = p.showNotes ? 'HIDE NOTES' : (p.notes ? 'EDIT NOTES' : 'ADD NOTE'); notesBtn.dataset.index = i; notesBtn.dataset.action = 'toggle-notes';
    if (p.notes && !p.showNotes) notesBtn.style.boxShadow = 'var(--glow)';
    const delBtn = document.createElement('button'); delBtn.className = 'btn-small'; delBtn.textContent = 'X'; delBtn.dataset.index = i; delBtn.dataset.action = 'delete';
    header.appendChild(span); header.appendChild(notesBtn); header.appendChild(delBtn);
    const controls = document.createElement('div'); controls.className = 'problem-controls';
    const time = document.createElement('div'); time.className = 'problem-time'; time.id = `time-${i}`; time.textContent = formatTime(cur, true);
    const toggleBtn = document.createElement('button'); toggleBtn.className = 'btn-small'; toggleBtn.textContent = p.isRunning ? 'PAUSE' : 'START'; toggleBtn.dataset.index = i; toggleBtn.dataset.action = 'toggle';
    const resetBtn = document.createElement('button'); resetBtn.className = 'btn-small'; resetBtn.textContent = 'RESET'; resetBtn.dataset.index = i; resetBtn.dataset.action = 'reset';
    const finishBtn = document.createElement('button'); finishBtn.className = 'btn-small'; finishBtn.textContent = 'FINISH'; finishBtn.dataset.index = i; finishBtn.dataset.action = 'finish';
    controls.appendChild(time); controls.appendChild(toggleBtn); controls.appendChild(resetBtn); controls.appendChild(finishBtn);
    r.appendChild(header); r.appendChild(controls);
    const notesSection = document.createElement('div'); notesSection.id = `notes-section-${i}`; notesSection.style.display = p.showNotes ? 'block' : 'none';
    const notesArea = document.createElement('textarea'); notesArea.className = 'notes-textarea'; notesArea.placeholder = 'Enter notes here (will be saved in history)...'; notesArea.value = p.notes || '';
    const autoExpand = (el) => { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; };
    notesArea.addEventListener('input', (e) => { problems[i].notes = e.target.value; autoExpand(e.target); saveProblems(); });
    setTimeout(() => autoExpand(notesArea), 0);
    notesSection.appendChild(notesArea); r.appendChild(notesSection); c.appendChild(r);
  });
}

document.getElementById('add-problem').addEventListener('click', async () => {
  const nEl = document.getElementById('new-problem-name'); const nameInput = nEl.value.trim();
  if (nameInput) {
    let fn = nameInput; let fnum = detectedDetails ? detectedDetails.number : ""; let furl = detectedDetails ? detectedDetails.url : ""; let fdiff = detectedDetails ? detectedDetails.difficulty : "";
    if (fnum && nameInput.startsWith(fnum + ". ")) fn = nameInput.replace(fnum + ". ", "");
    problems.push({ name: fn, number: fnum, url: furl, difficulty: fdiff, elapsed: 0, isRunning: false, startTime: 0, notes: "", showNotes: false });
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
  else if (action === 'finish') { const f = p.isRunning ? (Date.now() - p.startTime) : p.elapsed; await logToHistory(p, f); problems.splice(i, 1); }
  else if (action === 'toggle-notes') { p.showNotes = !p.showNotes; }
  await saveProblems(); renderProblems(); if (action === 'toggle-notes' && p && p.showNotes) { const ta = document.querySelector(`#notes-section-${i} textarea`); if (ta) ta.focus(); }
  startUIInterval();
});

function startUIInterval() {
  if (uiInterval) clearInterval(uiInterval);
  if (!problems.some(p => p.isRunning)) return;
  uiInterval = setInterval(() => { problems.forEach((p, i) => { if (p.isRunning) { const el = document.getElementById(`time-${i}`); if (el) el.textContent = formatTime(Date.now() - p.startTime, true); } }); }, 100);
}

api.runtime.onMessage.addListener((msg) => { if (msg.type === 'leetcode_details') updateProblemInput(msg.details); });

async function logToHistory(prob, elapsed) {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || [];
  h.unshift({ name: prob.name, number: prob.number, url: prob.url, difficulty: prob.difficulty || "", timeStr: formatTime(elapsed, true), elapsedMs: elapsed, timestamp: Date.now(), notes: prob.notes || "" });
  await activeStorage.set({ leetcode_history: h });
}

function formatMarkdown(text) {
  if (!text) return "";
  let safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  safe = safe.replace(/`(.*?)`/g, '<code style="background:rgba(0,255,0,0.1); padding:1px 3px; border:1px solid rgba(0,255,0,0.3);">$1</code>');
  safe = safe.replace(/\n/g, '<br>');
  return safe;
}

let currentHistory = [];
async function renderHistory() { const l = document.getElementById('log-list'); const d = await activeStorage.get('leetcode_history'); currentHistory = d.leetcode_history || []; if (!l) return; filterHistory(); }

function filterHistory() {
  const l = document.getElementById('log-list'); const query = document.getElementById('history-search').value.toLowerCase();
  const filtered = currentHistory.filter(i => i.name.toLowerCase().includes(query) || (i.number && i.number.toString().includes(query)) || (i.notes && i.notes.toLowerCase().includes(query)));
  l.replaceChildren();
  if (filtered.length === 0) { const msg = document.createElement('div'); msg.style.opacity = '0.5'; msg.style.padding = '10px'; msg.textContent = 'No results found.'; l.appendChild(msg); return; }
  const totalMs = filtered.reduce((s, i) => s + (i.elapsedMs || 0), 0);
  const summary = document.createElement('div'); summary.style.borderBottom = '1px solid var(--border-color)'; summary.style.paddingBottom = '5px'; summary.style.marginBottom = '8px'; summary.style.fontSize = '0.8em'; summary.style.display = 'flex'; summary.style.justifyContent = 'space-between';
  summary.innerHTML = `<span><b>TOTAL:</b> ${filtered.length} problems</span> <span><b>TIME:</b> ${formatTime(totalMs)}</span>`;
  l.appendChild(summary);
  filtered.forEach((i, idx) => {
    let dn = (i.number ? i.number + ". " : "") + i.name; if (dn.length > 50) dn = dn.substring(0, 47) + "...";
    const dd = (val) => { const date = new Date(val); if (isNaN(date.getTime())) return "Unknown"; const now = new Date(); if (getDateKey(date) === getDateKey(now)) return "Today " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    const realIdx = currentHistory.indexOf(i);
    const entry = document.createElement('div'); entry.className = 'log-entry';
    const topRow = document.createElement('div'); topRow.className = 'log-entry-row';
    const left = document.createElement('div'); left.style.flex = "1";
    const title = document.createElement('div'); title.className = 'log-entry-title';
    if (i.url) { const a = document.createElement('a'); a.href = i.url; a.target = '_blank'; a.textContent = dn; title.appendChild(a); } else { title.textContent = dn; }
    left.appendChild(title);
    const meta = document.createElement('div'); meta.className = 'log-entry-meta';
    if (i.difficulty) {
      const badge = document.createElement('span'); badge.className = 'difficulty-badge'; badge.style.marginRight = '8px'; badge.textContent = i.difficulty;
      const d = i.difficulty.toLowerCase();
      if (d.includes('easy')) { badge.style.color = '#00af9b'; badge.style.borderColor = '#00af9b'; }
      else if (d.includes('medium')) { badge.style.color = '#ffb800'; badge.style.borderColor = '#ffb800'; }
      else if (d.includes('hard')) { badge.style.color = '#ff2d55'; badge.style.borderColor = '#ff2d55'; }
      meta.appendChild(badge);
    }
    const timeSpan = document.createElement('span'); timeSpan.style.fontWeight = "bold"; timeSpan.style.color = "var(--text-color)"; timeSpan.textContent = i.timeStr; meta.appendChild(timeSpan);
    const dateSpan = document.createElement('span'); dateSpan.style.marginLeft = "8px"; dateSpan.textContent = dd(i.timestamp); meta.appendChild(dateSpan);
    left.appendChild(meta);
    const btnRow = document.createElement('div'); btnRow.style.display = 'flex'; btnRow.style.gap = '5px';
    const editBtn = document.createElement('button'); editBtn.className = 'btn-small'; editBtn.textContent = 'EDIT'; editBtn.dataset.index = realIdx; editBtn.dataset.action = 'edit-history-note';
    const copyBtn = document.createElement('button'); copyBtn.className = 'btn-small'; copyBtn.textContent = 'COPY'; copyBtn.dataset.index = realIdx; copyBtn.dataset.action = 'copy-history-note';
    const delBtn = document.createElement('button'); delBtn.className = 'btn-small'; delBtn.textContent = 'X'; delBtn.style.color = '#ff0000'; delBtn.dataset.index = realIdx; delBtn.dataset.action = 'delete-history';
    btnRow.appendChild(editBtn); btnRow.appendChild(copyBtn); btnRow.appendChild(delBtn);
    topRow.appendChild(left); topRow.appendChild(btnRow); entry.appendChild(topRow);
    const nContainer = document.createElement('div'); nContainer.id = `history-note-container-${realIdx}`;
    if (i.notes && i.notes.trim()) {
      const toggleNotesBtn = document.createElement('button'); toggleNotesBtn.className = 'btn-small'; toggleNotesBtn.style.width = '100%'; toggleNotesBtn.style.marginTop = '4px'; toggleNotesBtn.style.textAlign = 'center'; toggleNotesBtn.style.fontSize = '0.7em'; toggleNotesBtn.textContent = '▶ VIEW NOTES / CODE'; toggleNotesBtn.dataset.index = realIdx; toggleNotesBtn.dataset.action = 'toggle-history-display';
      const nDisplay = document.createElement('div'); nDisplay.className = 'history-notes'; nDisplay.id = `history-note-display-${realIdx}`; nDisplay.style.display = 'none'; nDisplay.innerHTML = formatMarkdown(i.notes);
      nContainer.appendChild(toggleNotesBtn); nContainer.appendChild(nDisplay);
    }
    entry.appendChild(nContainer); l.appendChild(entry);
  });
}

document.getElementById('history-search').addEventListener('input', filterHistory);
document.getElementById('log-list').addEventListener('click', async (e) => {
  const action = e.target.dataset.action; const idx = parseInt(e.target.dataset.index);
  if (action === 'delete-history') { if (confirm('Delete this entry?')) { currentHistory.splice(idx, 1); await activeStorage.set({ leetcode_history: currentHistory }); filterHistory(); } }
  else if (action === 'toggle-history-display') { const display = document.getElementById(`history-note-display-${idx}`); if (display) { const isHidden = display.style.display === 'none'; display.style.display = isHidden ? 'block' : 'none'; e.target.textContent = isHidden ? '▼ HIDE NOTES/CODE' : '▶ VIEW NOTES/CODE'; } }
  else if (action === 'copy-history-note') { const note = currentHistory[idx].notes; if (note) { navigator.clipboard.writeText(note).then(() => { const originalText = e.target.textContent; e.target.textContent = 'COPIED!'; setTimeout(() => { e.target.textContent = originalText; }, 1500); }); } }
  else if (action === 'edit-history-note') {
    const entry = currentHistory[idx]; const container = document.getElementById(`history-note-container-${idx}`); if (!container) return;
    container.replaceChildren();
    const ta = document.createElement('textarea'); ta.className = 'notes-textarea'; ta.style.marginTop = '4px'; ta.value = entry.notes || "";
    const saveBtn = document.createElement('button'); saveBtn.className = 'btn-small'; saveBtn.textContent = 'SAVE'; saveBtn.style.marginTop = '4px';
    saveBtn.addEventListener('click', async () => { currentHistory[idx].notes = ta.value; await activeStorage.set({ leetcode_history: currentHistory }); filterHistory(); });
    container.appendChild(ta); container.appendChild(saveBtn); ta.focus();
  }
});

document.getElementById('export-csv').addEventListener('click', async () => {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || []; if (h.length === 0) return;
  let csv = 'Number,Name,Difficulty,Time,Notes,URL,ISO_Date,Local_Time\n';
  h.forEach(i => { const date = new Date(i.timestamp); const safeNotes = (i.notes || "").replace(/"/g, '""'); csv += `"${i.number}","${i.name}","${i.difficulty || ""}","${i.timeStr}","${safeNotes}","${i.url}","${date.toISOString()}","${date.toLocaleString()}"\n`; });
  const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'leetcode_study_logs.csv'; a.click();
});

// --- Stats ---
let hChart, mChart, aChart, hoChart, dChart;
let selectedHeatmapYear = 'rolling';
document.getElementById('heatmap-year-selector').addEventListener('change', (e) => { selectedHeatmapYear = e.target.value; renderStats(); });

function renderHeatmap(logs, isLight, mainGreen) {
  const canvas = document.getElementById('contributionHeatmap'); const section = document.getElementById('heatmap-section'); const selector = document.getElementById('heatmap-year-selector'); if (!canvas || !section || !selector) return;
  const years = [...new Set(logs.filter(l => l && l.timestamp).map(l => new Date(l.timestamp).getFullYear()))].sort((a,b) => b-a);
  const currentOptions = Array.from(selector.options).map(o => o.value);
  years.forEach(y => { if (!currentOptions.includes(y.toString())) { const opt = document.createElement('option'); opt.value = y; opt.textContent = y; selector.appendChild(opt); } });
  const ctx = canvas.getContext('2d'); const boxSize = 7; const gap = 2; const weeks = 53; const days = 7; const topPadding = 15; const leftPadding = 20;
  canvas.width = (weeks * (boxSize + gap)) + leftPadding + 50; canvas.height = (days * (boxSize + gap)) + topPadding;
  const now = new Date(); let startDate, endDate;
  if (selectedHeatmapYear === 'rolling') { startDate = new Date(now); startDate.setDate(now.getDate() - 365); startDate.setDate(startDate.getDate() - startDate.getDay()); endDate = now; }
  else { const yr = parseInt(selectedHeatmapYear); startDate = new Date(yr, 0, 1); startDate.setDate(startDate.getDate() - startDate.getDay()); endDate = new Date(yr, 11, 31); }
  const dailyData = {}; logs.forEach(l => { if (l && l.timestamp) { const k = getDateKey(l.timestamp); dailyData[k] = (dailyData[k] || 0) + 1; } });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isLight ? '#666' : '#999'; ctx.font = '7px sans-serif'; ['M', 'W', 'F'].forEach((day, i) => { ctx.fillText(day, 0, topPadding + (i * 2 + 2) * (boxSize + gap) - 2); });
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth = -1; let extraGap = 0;
  for (let w = 0; w < weeks; w++) {
    const weekStartDate = new Date(startDate); weekStartDate.setDate(startDate.getDate() + (w * 7));
    const currentMonth = weekStartDate.getMonth();
    if (currentMonth !== lastMonth) { if (lastMonth !== -1) extraGap += 4; ctx.fillStyle = isLight ? '#666' : '#999'; ctx.fillText(monthNames[currentMonth], leftPadding + w * (boxSize + gap) + extraGap, 10); lastMonth = currentMonth; }
    for (let d = 0; d < days; d++) {
      const date = new Date(weekStartDate); date.setDate(weekStartDate.getDate() + d);
      if (date > endDate || (selectedHeatmapYear !== 'rolling' && date.getFullYear() > parseInt(selectedHeatmapYear))) continue;
      const k = getDateKey(date); const count = dailyData[k] || 0;
      if (count === 0) { ctx.fillStyle = isLight ? 'rgba(0,128,0,0.05)' : 'rgba(255,255,255,0.05)'; }
      else if (count < 2) { ctx.fillStyle = isLight ? 'rgba(0,128,0,0.3)' : 'rgba(0,255,0,0.3)'; }
      else if (count < 4) { ctx.fillStyle = isLight ? 'rgba(0,128,0,0.6)' : 'rgba(0,255,0,0.6)'; }
      else { ctx.fillStyle = mainGreen; }
      ctx.fillRect(leftPadding + w * (boxSize + gap) + extraGap, topPadding + d * (boxSize + gap), boxSize, boxSize);
    }
  }
}

async function renderStats() {
  const d = await activeStorage.get(['leetcode_history', 'leetcode_problems']);
  const logs = d.leetcode_history || []; const curr = d.leetcode_problems || [];
  const isLight = document.body.classList.contains('light-mode');
  const mainGreen = isLight ? '#008000' : '#00ff00';
  const gridColor = isLight ? 'rgba(0, 128, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)';
  renderHeatmap(logs, isLight, mainGreen);
  
  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  logs.forEach(l => { if (l && l.difficulty) { const dLow = l.difficulty.toLowerCase(); if (dLow.includes('easy')) diffCounts.easy++; else if (dLow.includes('medium')) diffCounts.medium++; else if (dLow.includes('hard')) diffCounts.hard++; } });
  const dCtx = document.getElementById('difficultyChart');
  if (dCtx) { if (dChart) dChart.destroy(); dChart = new Chart(dCtx, { type: 'doughnut', data: { labels: ['Easy', 'Medium', 'Hard'], datasets: [{ data: [diffCounts.easy, diffCounts.medium, diffCounts.hard], backgroundColor: ['#00af9b', '#ffb800', '#ff2d55'], borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isLight ? '#333' : '#fff', font: { size: 10 } } } } } }); }

  const totalMs = logs.reduce((s, l) => s + (l ? (l.elapsedMs || parseTimeToMs(l.timeStr) || 0) : 0), 0);
  const tpEl = document.getElementById('total-problems'); if (tpEl) tpEl.textContent = logs.length;
  const ttsEl = document.getElementById('total-time-spent'); if (ttsEl) ttsEl.textContent = formatTime(totalMs);
  const todayK = getDateKey(new Date()); const now = new Date(); const startOfWeek = new Date(now.getTime() - 7 * 86400000); const startOfMonth = new Date(now.getTime() - 30 * 86400000); const thisYear = now.getFullYear();
  const stEl = document.getElementById('stat-today'); if (stEl) stEl.textContent = logs.filter(l => getDateKey(l.timestamp) === todayK).length;
  const swEl = document.getElementById('stat-week'); if (swEl) swEl.textContent = logs.filter(l => l.timestamp > startOfWeek.getTime()).length;
  const smEl = document.getElementById('stat-month'); if (smEl) smEl.textContent = logs.filter(l => l.timestamp > startOfMonth.getTime()).length;
  const syEl = document.getElementById('stat-year'); if (syEl) syEl.textContent = logs.filter(l => new Date(l.timestamp).getFullYear() === thisYear).length;
  const daysArr = [...new Set(logs.filter(l => l && l.timestamp).map(l => getDateKey(l.timestamp)))].filter(k => k !== "").sort((a,b) => b.localeCompare(a));
  let streak = 0; if (daysArr.length > 0) {
    let c = new Date(); c.setHours(0,0,0,0);
    if (daysArr[0] === getDateKey(c) || daysArr[0] === getDateKey(new Date(c.getTime() - 86400000))) {
      let curC = (daysArr[0] === getDateKey(c)) ? c : new Date(c.getTime() - 86400000);
      for (let day of daysArr) { if (day === getDateKey(curC)) { streak++; curC.setDate(curC.getDate() - 1); } else break; }
    }
  }
  const csEl = document.getElementById('current-streak'); if (csEl) csEl.textContent = streak;
  const l7k = []; const l7l = []; for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l7k.push(getDateKey(d)); l7l.push((d.getMonth()+1)+'/'+d.getDate()); }
  const d7Counts = l7k.map(k => logs.filter(l => getDateKey(l.timestamp) === k).length);
  const hCtx = document.getElementById('progressChart');
  if(hCtx) { if (hChart) hChart.destroy(); hChart = new Chart(hCtx, { type:'bar', data:{ labels:l7l, datasets:[{ data:d7Counts, backgroundColor:isLight?'rgba(0,128,0,0.5)':'rgba(0,255,0,0.5)', borderColor:mainGreen, borderWidth:1 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}, stepSize:1}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}}} }, plugins:{legend:{display:false}} } }); }
  const l30k = []; const l30l = []; for (let i=29; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l30k.push(getDateKey(d)); l30l.push(i%5===0 ? (d.getMonth()+1)+'/'+d.getDate() : ''); }
  const d30Counts = l30k.map(k => logs.filter(l => getDateKey(l.timestamp) === k).length);
  const mCtx = document.getElementById('monthProgressChart');
  if(mCtx) { if (mChart) mChart.destroy(); mChart = new Chart(mCtx, { type:'bar', data:{ labels:l30l, datasets:[{ data:d30Counts, backgroundColor:isLight?'rgba(0,128,0,0.4)':'rgba(0,255,0,0.4)', borderColor:mainGreen, borderWidth:1 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}, stepSize:1}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:7}}} }, plugins:{legend:{display:false}} } }); }
  const hrData = Array(24).fill(0); logs.forEach(l => { if (l && l.timestamp && getDateKey(l.timestamp) === todayK) { const d = new Date(l.timestamp); hrData[d.getHours()]++; } });
  const hoCtx = document.getElementById('hourlyActivityChart');
  if(hoCtx) { if (hoChart) hoChart.destroy(); hoChart = new Chart(hoCtx, { type:'bar', data:{ labels:Array.from({length:24}, (_,i) => i === 0 ? '12am' : (i < 12 ? i+'am' : (i === 12 ? '12pm' : (i-12)+'pm'))), datasets:[{ data:hrData, backgroundColor:isLight?'rgba(0,128,0,0.6)':'rgba(0,255,0,0.6)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}, stepSize:1}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:7}}} }, plugins:{legend:{display:false}} } }); }
  const activeS = document.getElementById('active-chart-section');
  if (curr.length > 0 && activeS) {
    activeS.style.display = 'flex'; const aCtx = document.getElementById('activeProblemsChart');
    if(aCtx) { if (aChart) aChart.destroy(); aChart = new Chart(aCtx, { type:'bar', data:{ labels:curr.map(p => (p.number ? p.number + " " : "") + p.name.substring(0,8)), datasets:[{ data:curr.map(p => (p.isRunning ? Date.now()-p.startTime : p.elapsed)/60000), backgroundColor:isLight?'rgba(0,128,0,0.4)':'rgba(0,255,0,0.4)', borderColor:mainGreen, borderWidth:1 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{beginAtZero:true, ticks:{color:mainGreen, font:{size:8}}}, y:{ticks:{color:mainGreen, font:{size:8}}} }, plugins:{legend:{display:false}} } }); }
  } else if (activeS) activeS.style.display = 'none';
}

document.getElementById('clear-log').addEventListener('click', async () => { if (confirm('Clear history?')) { await activeStorage.set({ leetcode_history: [] }); renderHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats(); } });

// --- Shortcuts ---
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault();
    const activeTab = document.querySelector('.tab-content.active').id;
    if (activeTab === 'stopwatch') {
      const firstBtn = document.querySelector('.problem-controls button');
      if (firstBtn) firstBtn.click();
    } else if (activeTab === 'standalone-sw') {
      const startBtn = document.getElementById('sw-start');
      const pauseBtn = document.getElementById('sw-pause');
      if (swInterval) pauseBtn.click(); else startBtn.click();
    } else if (activeTab === 'timer') {
      document.getElementById('timer-start').click();
    }
  }
});

document.getElementById('export-json').addEventListener('click', async () => {
  const data = await activeStorage.get(null);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `green_timer_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
});

document.getElementById('import-json').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (confirm('Importing will overwrite current data. Continue?')) {
        await activeStorage.clear();
        await activeStorage.set(data);
        alert('Data restored successfully!');
        window.location.reload();
      }
    } catch (err) { alert('Error: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset to allow re-selecting same file
});

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square'; osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start(); osc.stop(ctx.currentTime + 0.2);
  } catch(e) {}
}

// --- Init ---
initTheme(); loadProblems(); initTimers(); requestLeetCodeTitle();
async function init() { try { await renderHistory(); } catch(e){} } init();
