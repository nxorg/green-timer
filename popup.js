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
  // Update charts if they are visible
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
    this.ctx.fillStyle = isLight ? '#008000' : '#0f0'; // Darker green for light mode
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
let detectionRetries = 0;

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
  const c = document.getElementById('problems-container');
  if (!c) return;

  c.replaceChildren();

  problems.forEach((p, i) => {
    const r = document.createElement('div');
    r.className = 'problem-row';

    const cur = p.isRunning ? (Date.now() - p.startTime) : p.elapsed;
    const dn = (p.number ? p.number + ". " : "") + p.name;

    // Header
    const header = document.createElement('div');
    header.className = 'problem-header';

    const span = document.createElement('span');

    if (p.url) {
      const a = document.createElement('a');
      a.href = p.url;
      a.target = '_blank';
      a.style.color = 'var(--green)';
      a.style.textDecoration = 'none';
      a.style.borderBottom = '1px dashed var(--green)';
      a.textContent = dn;
      span.appendChild(a);
    } else {
      span.textContent = dn;
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-small';
    delBtn.textContent = 'X';
    delBtn.dataset.index = i;
    delBtn.dataset.action = 'delete';

    header.appendChild(span);
    header.appendChild(delBtn);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'problem-controls';

    const time = document.createElement('div');
    time.className = 'problem-time';
    time.id = `time-${i}`;
    time.textContent = formatTime(cur, true);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-small';
    toggleBtn.textContent = p.isRunning ? 'PAUSE' : 'START';
    toggleBtn.dataset.index = i;
    toggleBtn.dataset.action = 'toggle';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-small';
    resetBtn.textContent = 'RESET';
    resetBtn.dataset.index = i;
    resetBtn.dataset.action = 'reset';

    const finishBtn = document.createElement('button');
    finishBtn.className = 'btn-small';
    finishBtn.textContent = 'FINISH';
    finishBtn.dataset.index = i;
    finishBtn.dataset.action = 'finish';

    const notesBtn = document.createElement('button');
    notesBtn.className = 'btn-small';
    notesBtn.textContent = p.showNotes ? 'HIDE NOTES' : (p.notes ? 'EDIT NOTES' : 'ADD NOTE');
    notesBtn.dataset.index = i;
    notesBtn.dataset.action = 'toggle-notes';
    if (p.notes && !p.showNotes) notesBtn.style.boxShadow = 'var(--glow)';

    controls.appendChild(time);
    controls.appendChild(toggleBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(finishBtn);
    controls.appendChild(notesBtn);

    r.appendChild(header);
    r.appendChild(controls);

    // Notes Section
    const notesSection = document.createElement('div');
    notesSection.id = `notes-section-${i}`;
    notesSection.style.display = p.showNotes ? 'block' : 'none';

    const notesArea = document.createElement('textarea');
    notesArea.className = 'notes-textarea';
    notesArea.placeholder = 'Enter notes here (will be saved in history)...';
    notesArea.value = p.notes || '';
    notesArea.dataset.index = i;
    
    const autoExpand = (el) => {
      el.style.height = 'auto';
      el.style.height = (el.scrollHeight) + 'px';
    };

    notesArea.addEventListener('input', (e) => {
      problems[i].notes = e.target.value;
      autoExpand(e.target);
      saveProblems();
    });
    
    // Initial expand
    setTimeout(() => autoExpand(notesArea), 0);

    notesSection.appendChild(notesArea);
    r.appendChild(notesSection);

    c.appendChild(r);
  });
}

document.getElementById('add-problem').addEventListener('click', async () => {
  const nEl = document.getElementById('new-problem-name'); const nameInput = nEl.value.trim();
  if (nameInput) {
    let fn = nameInput; let fnum = detectedDetails ? detectedDetails.number : ""; let furl = detectedDetails ? detectedDetails.url : "";
    let fdiff = detectedDetails ? detectedDetails.difficulty : "";
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
  await saveProblems(); 
  renderProblems(); 
  if (action === 'toggle-notes' && p && p.showNotes) {
    const ta = document.querySelector(`#notes-section-${i} textarea`);
    if (ta) ta.focus();
  }
  startUIInterval();
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
  h.unshift({ 
    name: prob.name, 
    number: prob.number, 
    url: prob.url, 
    difficulty: prob.difficulty || "",
    timeStr: formatTime(elapsed, true), 
    elapsedMs: elapsed, 
    timestamp: Date.now(), 
    notes: prob.notes || "" 
  });
  await activeStorage.set({ leetcode_history: h });
}

function formatMarkdown(text) {
  if (!text) return "";
  // Escape HTML to prevent XSS
  let safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  // Bold: **text**
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  
  // Inline Code: `text`
  safe = safe.replace(/`(.*?)`/g, '<code style="background:rgba(0,255,0,0.1); padding:1px 3px; border:1px solid rgba(0,255,0,0.3);">$1</code>');
  
  // Line breaks
  safe = safe.replace(/\n/g, '<br>');
  
  return safe;
}

let currentHistory = [];
async function renderHistory() {
  const l = document.getElementById('log-list'); const d = await activeStorage.get('leetcode_history'); currentHistory = d.leetcode_history || [];
  if (!l) return; filterHistory();
}

function filterHistory() {
  const l = document.getElementById('log-list');
  const query = document.getElementById('history-search').value.toLowerCase();

  const filtered = currentHistory.filter(i =>
    i.name.toLowerCase().includes(query) ||
    (i.number && i.number.toString().includes(query)) ||
    (i.notes && i.notes.toLowerCase().includes(query))
  );

  l.replaceChildren();

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.style.opacity = '0.5';
    msg.style.padding = '10px';
    msg.textContent = 'No results found.';
    l.appendChild(msg);
    return;
  }

  // Summary Row
  const totalMs = filtered.reduce((s, i) => s + (i.elapsedMs || 0), 0);
  const summary = document.createElement('div');
  summary.style.borderBottom = '1px solid var(--green)';
  summary.style.paddingBottom = '5px';
  summary.style.marginBottom = '8px';
  summary.style.fontSize = '0.8em';
  summary.style.display = 'flex';
  summary.style.justifyContent = 'space-between';
  summary.innerHTML = `<span><b>TOTAL:</b> ${filtered.length} problems</span> <span><b>TIME:</b> ${formatTime(totalMs)}</span>`;
  l.appendChild(summary);

  filtered.forEach((i, idx) => {
    let dn = (i.number ? i.number + ". " : "") + i.name;
    if (dn.length > 50) dn = dn.substring(0, 47) + "...";

    const dd = (val) => {
      const date = new Date(val);
      if (isNaN(date.getTime())) return "Unknown";

      const now = new Date();
      if (getDateKey(date) === getDateKey(now)) {
        return "Today " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const realIdx = currentHistory.indexOf(i);

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.style.display = 'flex';
    entry.style.flexDirection = 'column';
    entry.style.gap = '4px';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'flex-start';

    const left = document.createElement('div');

    const strong = document.createElement('strong');

    if (i.url) {
      const a = document.createElement('a');
      a.href = i.url;
      a.target = '_blank';
      a.style.color = 'var(--green)';
      a.style.textDecoration = 'none';
      a.style.borderBottom = '1px dashed var(--green)';
      a.textContent = dn;
      strong.appendChild(a);
    } else {
      strong.textContent = dn;
    }
    
    left.appendChild(strong);

    // Difficulty Badge
    if (i.difficulty) {
      const badge = document.createElement('span');
      badge.style.fontSize = '0.7em';
      badge.style.marginLeft = '8px';
      badge.style.padding = '1px 5px';
      badge.style.border = '1px solid';
      badge.style.fontWeight = 'bold';
      badge.textContent = i.difficulty;
      
      const d = i.difficulty.toLowerCase();
      if (d.includes('easy')) { badge.style.color = '#00af9b'; badge.style.borderColor = '#00af9b'; }
      else if (d.includes('medium')) { badge.style.color = '#ffb800'; badge.style.borderColor = '#ffb800'; }
      else if (d.includes('hard')) { badge.style.color = '#ff2d55'; badge.style.borderColor = '#ff2d55'; }
      else { badge.style.color = 'var(--green)'; badge.style.borderColor = 'var(--green)'; }
      
      left.appendChild(badge);
    }

    const timeText = document.createTextNode(`: ${i.timeStr}`);
    left.appendChild(timeText);

    const br = document.createElement('br');
    left.appendChild(br);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '5px';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small';
    editBtn.textContent = 'EDIT';
    editBtn.dataset.index = realIdx;
    editBtn.dataset.action = 'edit-history-note';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-small';
    copyBtn.textContent = 'COPY';
    copyBtn.dataset.index = realIdx;
    copyBtn.dataset.action = 'copy-history-note';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-small';
    delBtn.textContent = 'X';
    delBtn.style.color = '#ff0000';
    delBtn.style.borderColor = 'rgba(255,0,0,0.3)';
    delBtn.dataset.index = realIdx;
    delBtn.dataset.action = 'delete-history';

    btnRow.appendChild(editBtn);
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(delBtn);

    row.appendChild(left);
    row.appendChild(btnRow);

    entry.appendChild(row);

    const nContainer = document.createElement('div');
    nContainer.id = `history-note-container-${realIdx}`;
    
    if (i.notes && i.notes.trim()) {
      const toggleNotesBtn = document.createElement('button');
      toggleNotesBtn.className = 'btn-small';
      toggleNotesBtn.style.width = '100%';
      toggleNotesBtn.style.marginTop = '4px';
      toggleNotesBtn.style.textAlign = 'left';
      toggleNotesBtn.style.fontSize = '0.7em';
      toggleNotesBtn.style.opacity = '0.7';
      toggleNotesBtn.textContent = '▶ VIEW NOTES/CODE';
      toggleNotesBtn.dataset.index = realIdx;
      toggleNotesBtn.dataset.action = 'toggle-history-display';
      
      const nDisplay = document.createElement('div');
      nDisplay.className = 'history-notes';
      nDisplay.id = `history-note-display-${realIdx}`;
      nDisplay.style.display = 'none'; // Hidden by default
      nDisplay.innerHTML = formatMarkdown(i.notes);
      
      nContainer.appendChild(toggleNotesBtn);
      nContainer.appendChild(nDisplay);
    }
    
    entry.appendChild(nContainer);
    l.appendChild(entry);
  });
}

document.getElementById('history-search').addEventListener('input', filterHistory);
document.getElementById('log-list').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  const idx = parseInt(e.target.dataset.index);
  if (action === 'delete-history') {
    if (confirm('Delete this entry?')) { currentHistory.splice(idx).splice(idx, 1); await activeStorage.set({ leetcode_history: currentHistory }); filterHistory(); }
  } else if (action === 'toggle-history-display') {
    const display = document.getElementById(`history-note-display-${idx}`);
    if (display) {
      const isHidden = display.style.display === 'none';
      display.style.display = isHidden ? 'block' : 'none';
      e.target.textContent = isHidden ? '▼ HIDE NOTES/CODE' : '▶ VIEW NOTES/CODE';
    }
  } else if (action === 'copy-history-note') {
    const note = currentHistory[idx].notes;
    if (note) {
      navigator.clipboard.writeText(note).then(() => {
        const originalText = e.target.textContent;
        e.target.textContent = 'COPIED!';
        setTimeout(() => { e.target.textContent = originalText; }, 1500);
      });
    }
  } else if (action === 'edit-history-note') {
    const entry = currentHistory[idx];
    const container = document.getElementById(`history-note-container-${idx}`);
    if (!container) return;
    
    container.replaceChildren();
    
    const ta = document.createElement('textarea');
    ta.className = 'notes-textarea';
    ta.style.marginTop = '4px';
    ta.value = entry.notes || "";
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-small';
    saveBtn.textContent = 'SAVE';
    saveBtn.style.marginTop = '4px';
    saveBtn.addEventListener('click', async () => {
      currentHistory[idx].notes = ta.value;
      await activeStorage.set({ leetcode_history: currentHistory });
      filterHistory();
    });
    
    container.appendChild(ta);
    container.appendChild(saveBtn);
    ta.focus();
  }
});

document.getElementById('export-csv').addEventListener('click', async () => {
  const d = await activeStorage.get('leetcode_history'); const h = d.leetcode_history || []; if (h.length === 0) return;
  let csv = 'Number,Name,Difficulty,Time,Notes,URL,ISO_Date,Local_Time\n';
  h.forEach(i => { 
    const date = new Date(i.timestamp); 
    const safeNotes = (i.notes || "").replace(/"/g, '""');
    csv += `"${i.number}","${i.name}","${i.difficulty || ""}","${i.timeStr}","${safeNotes}","${i.url}","${date.toISOString()}","${date.toLocaleString()}"\n`; 
  });
  const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'leetcode_study_logs.csv'; a.click();
});

// --- Stats ---
let hChart, aChart, hoChart;
async function renderStats() {
  const d = await activeStorage.get(['leetcode_history', 'leetcode_problems']);
  const logs = d.leetcode_history || []; const curr = d.leetcode_problems || [];
  const isLight = document.body.classList.contains('light-mode');
  const mainGreen = isLight ? '#008000' : '#00ff00';
  const gridColor = isLight ? 'rgba(0, 128, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)';

  const totalMs = logs.reduce((s, l) => s + (l ? (l.elapsedMs || parseTimeToMs(l.timeStr) || 0) : 0), 0);
  document.getElementById('total-problems').textContent = logs.length;
  document.getElementById('total-time-spent').textContent = formatTime(totalMs);

  const days = [...new Set(logs.filter(l => l && l.timestamp).map(l => getDateKey(l.timestamp)))].filter(k => k !== "").sort((a,b) => b.localeCompare(a));
  let streak = 0; if (days.length > 0) {
    let c = new Date(); c.setHours(0,0,0,0);
    if (days[0] === getDateKey(c) || days[0] === getDateKey(new Date(c.getTime() - 86400000))) {
      let curC = (days[0] === getDateKey(c)) ? c : new Date(c.getTime() - 86400000);
      for (let day of days) { if (day === getDateKey(curC)) { streak++; curC.setDate(curC.getDate() - 1); } else break; }
    }
  }
  document.getElementById('current-streak').textContent = streak;

  const l7k = []; const l7l = []; for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l7k.push(getDateKey(d)); l7l.push((d.getMonth()+1)+'/'+d.getDate()); }
  const dailyMins = l7k.map(k => {
    const ms = logs.filter(l => l && l.timestamp && getDateKey(l.timestamp) === k).reduce((s,l)=>s+(l.elapsedMs || parseTimeToMs(l.timeStr) || 0), 0);
    return parseFloat((ms/60000).toFixed(2));
  });
  
  const hCtx = document.getElementById('progressChart');
  if(hCtx) { if (hChart) hChart.destroy(); hChart = new Chart(hCtx, { type:'bar', data:{ labels:l7l, datasets:[{ data:dailyMins, backgroundColor:isLight?'rgba(0,128,0,0.5)':'rgba(0,255,0,0.5)', borderColor:mainGreen, borderWidth:1 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:9}}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:9}}} }, plugins:{legend:{display:false}} } }); }

  const activeS = document.getElementById('active-chart-section');
  if (curr.length > 0 && activeS) {
    activeS.style.display = 'flex'; const aCtx = document.getElementById('activeProblemsChart');
    if(aCtx) { if (aChart) aChart.destroy(); aChart = new Chart(aCtx, { type:'bar', data:{ labels:curr.map(p => (p.number ? p.number + " " : "") + p.name.substring(0,8)), datasets:[{ data:curr.map(p => (p.isRunning ? Date.now()-p.startTime : p.elapsed)/60000), backgroundColor:isLight?'rgba(0,128,0,0.4)':'rgba(0,255,0,0.4)', borderColor:mainGreen, borderWidth:1 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{beginAtZero:true, ticks:{color:mainGreen, font:{size:9}}}, y:{ticks:{color:mainGreen, font:{size:9}}} }, plugins:{legend:{display:false}} } }); }
  } else if (activeS) activeS.style.display = 'none';

  const hrData = Array(24).fill(0); logs.forEach(l => { if (l && l.timestamp) { const d = new Date(l.timestamp); if (!isNaN(d.getTime())) hrData[d.getHours()]++; } });
  const hoCtx = document.getElementById('hourlyActivityChart');
  if(hoCtx) { if (hoChart) hoChart.destroy(); hoChart = new Chart(hoCtx, { type:'bar', data:{ labels:Array.from({length:24}, (_,i) => i === 0 ? '12am' : (i < 12 ? i+'am' : (i === 12 ? '12pm' : (i-12)+'pm'))), datasets:[{ data:hrData, backgroundColor:isLight?'rgba(0,128,0,0.6)':'rgba(0,255,0,0.6)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:9}}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:7}}} }, plugins:{legend:{display:false}} } }); }
}

document.getElementById('clear-log').addEventListener('click', async () => { if (confirm('Clear history?')) { await activeStorage.set({ leetcode_history: [] }); renderHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats(); } });

// --- Init ---
document.getElementById('ext-version').textContent = 'v' + api.runtime.getManifest().version;
initTheme(); loadProblems(); initTimers(); requestLeetCodeTitle();
async function init() { try { await renderHistory(); } catch(e){} } init();
