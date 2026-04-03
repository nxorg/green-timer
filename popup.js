/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 * GPLv3 License
 */

const api = (typeof browser !== 'undefined') ? browser : chrome;
const storageAPI = (api.storage && api.storage.local) ? api.storage.local : (api.storage ? api.storage.sync : null);

const activeStorage = {
  get: (keys) => new Promise((res, rej) => {
    if (storageAPI) { 
      storageAPI.get(keys, d => api.runtime.lastError ? rej(api.runtime.lastError) : res(d || {})); 
    } else {
      const r = {};
      if (keys === null) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          try { r[k] = JSON.parse(localStorage.getItem(k)); } catch(e) { r[k] = localStorage.getItem(k); }
        }
      } else {
        const ka = Array.isArray(keys) ? keys : [keys];
        ka.forEach(k => { try { r[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ r[k]=null; } });
      }
      res(r);
    }
  }),
  set: (obj) => new Promise((res, rej) => {
    if (storageAPI) { 
      storageAPI.set(obj, () => api.runtime.lastError ? rej(api.runtime.lastError) : res()); 
    } else {
      try { for (let k in obj) localStorage.setItem(k, JSON.stringify(obj[k])); res(); } catch(e) { rej(e); }
    }
  }),
  clear: () => new Promise((res, rej) => {
    if (storageAPI) { storageAPI.clear(() => api.runtime.lastError ? rej(api.runtime.lastError) : res()); }
    else { localStorage.clear(); res(); }
  })
};

// --- Theme ---
async function initTheme() {
  const data = await activeStorage.get('theme');
  if (data.theme === 'light') document.body.classList.add('light-mode');
  else document.body.classList.remove('light-mode');
}

// --- Tab Logic ---
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
      if (btn.dataset.tab === 'log') renderHistory();
      if (btn.dataset.tab === 'stats') setTimeout(renderStats, 50);
      if (btn.dataset.tab === 'stopwatch') renderProblems();
    });
  });
}

// --- Helpers ---
function formatTime(ms, isSW = false) {
  if (!ms || isNaN(ms)) ms = 0;
  let s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
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

// --- Detection ---
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
        let num = "", name = title; if (title.includes('. ')) { num = title.split('. ')[0]; name = title.split('. ').slice(1).join('. '); }
        updateProblemInput({ number: num, name: name, url: tab.url });
      } else { updateProblemInput(response); }
    });
  } catch (e) {}
}

// --- Timer/SW ---
let timerInterval, swInterval, uiInterval, timerTargetTime = 0, swElapsedTime = 0, swStartTime = 0, problems = [];
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
    const el = document.getElementById('timer-display');
    if (tl <= 0) { clearInterval(timerInterval); if(el) el.textContent = '00:00:00.00'; playBeep(); }
    else if(el) el.textContent = formatTime(tl, true);
  }, 50);
}

function updateSwDisplay() { const el = document.getElementById('sw-display'); if (el) el.textContent = formatTime(swElapsedTime, true); }
function startStandaloneSwUI() { 
  if (swInterval) clearInterval(swInterval); 
  swInterval = setInterval(() => { const el = document.getElementById('sw-display'); if(el) el.textContent = formatTime(Date.now() - swStartTime, true); }, 50); 
}

// --- Problems ---
async function loadProblems() { const d = await activeStorage.get('leetcode_problems'); problems = d.leetcode_problems || []; renderProblems(); startUIInterval(); }
async function saveProblems() { await activeStorage.set({ leetcode_problems: problems }); }
function renderProblems() {
  const c = document.getElementById('problems-container'); if (!c) return; c.replaceChildren();
  if (problems.length === 0) {
    const welcome = document.createElement('div'); welcome.style.textAlign = 'center'; welcome.style.padding = '40px 20px'; welcome.style.opacity = '0.6';
    
    const icon = document.createElement('div'); icon.style.fontSize = '2em'; icon.style.marginBottom = '10px'; icon.textContent = '👋';
    const title = document.createElement('div'); title.style.fontWeight = 'bold'; title.style.color = 'var(--green)'; title.textContent = 'Welcome, Coder!';
    const desc = document.createElement('div'); desc.style.fontSize = '0.8em'; desc.style.marginTop = '5px'; desc.textContent = 'Add a LeetCode problem above to start tracking your journey.';
    
    welcome.appendChild(icon); welcome.appendChild(title); welcome.appendChild(desc);
    c.appendChild(welcome); return;
  }
  problems.forEach((p, i) => {
    const r = document.createElement('div'); r.className = 'problem-row';
    const cur = p.isRunning ? (Date.now() - p.startTime) : p.elapsed, dn = (p.number ? p.number + ". " : "") + p.name;
    const header = document.createElement('div'); header.className = 'problem-header';
    const span = document.createElement('span'); span.style.flexGrow = '1'; span.style.marginRight = '8px'; span.style.overflow = 'hidden'; span.style.textOverflow = 'ellipsis'; span.style.whiteSpace = 'nowrap';
    if (p.url) { const a = document.createElement('a'); a.href = p.url; a.target = '_blank'; a.textContent = dn; span.appendChild(a); } else span.textContent = dn;
    const notesBtn = document.createElement('button'); notesBtn.className = 'btn-small'; notesBtn.style.marginRight = '5px'; notesBtn.textContent = p.showNotes ? 'HIDE NOTES' : (p.notes ? 'EDIT NOTES' : 'ADD NOTE'); notesBtn.dataset.index = i; notesBtn.dataset.action = 'toggle-notes';
    if (p.notes && !p.showNotes) notesBtn.style.boxShadow = '0 0 10px var(--green)';
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

function startUIInterval() {
  if (uiInterval) clearInterval(uiInterval); if (!problems.some(p => p.isRunning)) return;
  uiInterval = setInterval(() => { problems.forEach((p, i) => { if (p.isRunning) { const el = document.getElementById(`time-${i}`); if (el) el.textContent = formatTime(Date.now() - p.startTime, true); } }); }, 100);
}

// --- History ---
async function logToHistory(prob, elapsed) {
  const d = await activeStorage.get('leetcode_history'), h = d.leetcode_history || [];
  h.unshift({ name: prob.name, number: prob.number, url: prob.url, difficulty: prob.difficulty || "", timeStr: formatTime(elapsed, true), elapsedMs: elapsed, timestamp: Date.now(), notes: prob.notes || "" });
  await activeStorage.set({ leetcode_history: h });
}
function formatMarkdown(text) {
  if (!text) return "";
  let safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/`(.*?)`/g, '<code style="background:rgba(0,255,0,0.1); padding:1px 3px; border:1px solid rgba(0,255,0,0.3);">$1</code>').replace(/\n/g, '<br>');
  return safe;
}
async function saveHistory() { await activeStorage.set({ leetcode_history: currentHistory }); }

let currentHistory = [];
async function renderHistory() { const l = document.getElementById('log-list'), d = await activeStorage.get('leetcode_history'); currentHistory = d.leetcode_history || []; if (l) filterHistory(); }
function filterHistory() {
  const l = document.getElementById('log-list'); if(!l) return;
  const sEl = document.getElementById('history-search');
  const query = sEl ? sEl.value.toLowerCase() : "";
  const filtered = currentHistory.filter(i => i.name.toLowerCase().includes(query) || (i.number && i.number.toString().includes(query)) || (i.notes && i.notes.toLowerCase().includes(query)));
  l.replaceChildren();
  if (filtered.length === 0) { const msg = document.createElement('div'); msg.style.opacity = '0.5'; msg.style.padding = '10px'; msg.textContent = 'No results found.'; l.appendChild(msg); return; }
  const totalMs = filtered.reduce((s, i) => s + (i.elapsedMs || 0), 0);
  const summary = document.createElement('div'); summary.className = 'log-entry'; summary.style.padding = '8px'; summary.style.borderStyle = 'solid';
  summary.style.display = 'flex'; summary.style.justifyContent = 'space-between'; summary.style.fontSize = '0.8em';
  
  const totalCountSpan = document.createElement('span');
  const countBold = document.createElement('b'); countBold.textContent = 'TOTAL: ';
  totalCountSpan.appendChild(countBold);
  totalCountSpan.appendChild(document.createTextNode(`${filtered.length} problems`));
  
  const totalTimeSpan = document.createElement('span');
  const timeBold = document.createElement('b'); timeBold.textContent = 'TIME: ';
  totalTimeSpan.appendChild(timeBold);
  totalTimeSpan.appendChild(document.createTextNode(formatTime(totalMs)));
  
  summary.appendChild(totalCountSpan);
  summary.appendChild(totalTimeSpan);
  l.appendChild(summary);
  filtered.forEach((i, idx) => {
    let dn = (i.number ? i.number + ". " : "") + i.name; if (dn.length > 50) dn = dn.substring(0, 47) + "...";
    const dd = (val) => { const date = new Date(val); if (isNaN(date.getTime())) return "Unknown"; const now = new Date(); if (getDateKey(date) === getDateKey(now)) return "Today " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    const realIdx = currentHistory.indexOf(i), entry = document.createElement('div'); entry.className = 'log-entry';
    const topRow = document.createElement('div'); topRow.className = 'log-entry-row';
    const left = document.createElement('div'); left.style.flex = "1";
    const title = document.createElement('div'); title.className = 'log-entry-title';
    if (i.url) { const a = document.createElement('a'); a.href = i.url; a.target = '_blank'; a.textContent = dn; title.appendChild(a); } else title.textContent = dn;
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
    const notesBtn = document.createElement('button'); notesBtn.className = 'btn-small'; 
    notesBtn.textContent = i.notes ? 'EDIT' : 'ADD'; notesBtn.dataset.index = realIdx; notesBtn.dataset.action = 'toggle-history-notes';
    const copyBtn = document.createElement('button'); copyBtn.className = 'btn-small'; copyBtn.textContent = 'COPY'; copyBtn.dataset.index = realIdx; copyBtn.dataset.action = 'copy-history-note';
    const delBtn = document.createElement('button'); delBtn.className = 'btn-small'; delBtn.textContent = 'X'; delBtn.style.color = '#ff0000'; delBtn.dataset.index = realIdx; delBtn.dataset.action = 'delete-history';
    btnRow.appendChild(notesBtn); btnRow.appendChild(copyBtn); btnRow.appendChild(delBtn);
    topRow.appendChild(left); topRow.appendChild(btnRow); entry.appendChild(topRow);
    
    const notesSection = document.createElement('div'); notesSection.id = `history-notes-section-${realIdx}`; notesSection.style.display = 'none';
    const notesArea = document.createElement('textarea'); notesArea.className = 'notes-textarea'; notesArea.placeholder = 'Enter notes here...'; notesArea.value = i.notes || '';
    const autoExpand = (el) => { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; };
    notesArea.addEventListener('input', (e) => { currentHistory[realIdx].notes = e.target.value; autoExpand(e.target); saveHistory(); });
    
    notesSection.appendChild(notesArea); entry.appendChild(notesSection); l.appendChild(entry);
  });
}


// --- JSON/CSV Restore ---
async function handleRestore(text, isCSV = false) {
  const importBtn = document.getElementById('import-btn');
  const originalText = importBtn ? importBtn.textContent : 'RESTORE';
  const showStatus = (msg) => { if (importBtn) { importBtn.textContent = msg; setTimeout(() => importBtn.textContent = originalText, 2500); } };

  try {
    const rawText = text.trim();
    if (isCSV) {
      const lines = rawText.split('\n'); if (lines.length < 2) throw new Error("Invalid CSV");
      const logs = [];
      for (let i = 1; i < lines.length; i++) {
        // Robust CSV splitter
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (row && row.length >= 5) {
          const clean = row.map(s => s.replace(/^"|"$/g, '').trim());
          let ts = Date.now() - (i * 1000);
          if (clean[6]) { const dParsed = new Date(clean[6]).getTime(); if (!isNaN(dParsed)) ts = dParsed; }
          logs.push({ number: clean[0], name: clean[1], difficulty: clean[2], timeStr: clean[3], notes: clean[4], url: clean[5] || "", timestamp: ts });
        }
      }
      
      const d = await activeStorage.get('leetcode_history');
      const h = d.leetcode_history || [];
      await activeStorage.set({ leetcode_history: logs.concat(h) });
      
      await loadProblems(); 
      await renderHistory(); 
      if (document.getElementById('stats').classList.contains('active')) await renderStats();
      
      showStatus('IMPORTED!');
    } else {
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        // Fallback for simple key-value dumps
        data = {};
        const lines = rawText.split('\n');
        let currentKey = "";
        lines.forEach(line => {
          const parts = line.split('\t').map(p => p.trim());
          if (parts.length === 1 && parts[0] && isNaN(parts[0])) currentKey = parts[0];
          else if (parts.length >= 2) {
            if (!data[currentKey]) data[currentKey] = currentKey.includes('history') || currentKey.includes('problems') ? [] : {};
          }
        });
        if (Object.keys(data).length === 0) throw err;
      }
      
      // Perform restore WITHOUT confirm() or alert() to prevent popup auto-close issues
      await activeStorage.clear(); 
      await activeStorage.set(data); 
      
      problems = data.leetcode_problems || [];
      await renderProblems(); 
      await renderHistory(); 
      await initTheme(); 
      await initTimers();
      if (document.getElementById('stats').classList.contains('active')) await renderStats();
      
      showStatus('RESTORED!');
    }
  } catch (err) { 
    showStatus('FAILED!');
    console.error('Restore Failed:', err); 
  }
}

// --- Stats & Heatmap ---
let hChart, mChart, aChart, hoChart, dChart, selectedHeatmapYear = 'rolling';
function renderHeatmap(logs, isLight, mainGreen) {
  const canvas = document.getElementById('contributionHeatmap'), selector = document.getElementById('heatmap-year-selector'); if (!canvas || !selector) return;
  const years = [...new Set(logs.filter(l => l && l.timestamp).map(l => new Date(l.timestamp).getFullYear()))].sort((a,b) => b-a);
  const currentOptions = Array.from(selector.options).map(o => o.value);
  years.forEach(y => { if (!currentOptions.includes(y.toString())) { const opt = document.createElement('option'); opt.value = y; opt.textContent = y; selector.appendChild(opt); } });
  const ctx = canvas.getContext('2d'), boxSize = 7, gap = 2, weeks = 53, days = 7, topP = 15, leftP = 20;
  canvas.width = (weeks * (boxSize + gap)) + leftP + 50; canvas.height = (days * (boxSize + gap)) + topP;
  const now = new Date(); let startD, endD;
  if (selectedHeatmapYear === 'rolling') { startD = new Date(now); startD.setDate(now.getDate() - 365); startD.setDate(startD.getDate() - startD.getDay()); endD = now; }
  else { const yr = parseInt(selectedHeatmapYear); startD = new Date(yr, 0, 1); startD.setDate(startD.getDate() - startD.getDay()); endD = new Date(yr, 11, 31); }
  const dailyData = {}; logs.forEach(l => { if (l && l.timestamp) { const k = getDateKey(l.timestamp); dailyData[k] = (dailyData[k] || 0) + 1; } });
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = isLight ? '#666' : '#999'; ctx.font = '7px sans-serif';
  ['M', 'W', 'F'].forEach((day, i) => { ctx.fillText(day, 0, topP + (i * 2 + 2) * (boxSize + gap) - 2); });
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastM = -1, extraG = 0;
  for (let w = 0; w < weeks; w++) {
    const weekS = new Date(startD); weekS.setDate(startD.getDate() + (w * 7));
    const curM = weekS.getMonth(); if (curM !== lastM) { if (lastM !== -1) extraG += 4; ctx.fillStyle = isLight ? '#666' : '#999'; ctx.fillText(monthNames[curM], leftP + w * (boxSize + gap) + extraG, 10); lastM = curM; }
    for (let d = 0; d < days; d++) {
      const dt = new Date(weekS); dt.setDate(weekS.getDate() + d); if (dt > endD || (selectedHeatmapYear !== 'rolling' && dt.getFullYear() > parseInt(selectedHeatmapYear))) continue;
      const k = getDateKey(dt), count = dailyData[k] || 0;
      if (count === 0) ctx.fillStyle = isLight ? 'rgba(0,128,0,0.05)' : 'rgba(255,255,255,0.05)';
      else if (count < 2) ctx.fillStyle = isLight ? 'rgba(0,128,0,0.3)' : 'rgba(0,255,0,0.3)';
      else if (count < 4) ctx.fillStyle = isLight ? 'rgba(0,128,0,0.6)' : 'rgba(0,255,0,0.6)';
      else ctx.fillStyle = mainGreen;
      ctx.fillRect(leftP + w * (boxSize + gap) + extraG, topP + d * (boxSize + gap), boxSize, boxSize);
    }
  }
}
async function renderStats() {
  const d = await activeStorage.get(['leetcode_history', 'leetcode_problems']), logs = d.leetcode_history || [], curr = d.leetcode_problems || [];
  const isLight = document.body.classList.contains('light-mode'), mainGreen = isLight ? '#008000' : '#00ff00', gridColor = isLight ? 'rgba(0, 128, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)';
  renderHeatmap(logs, isLight, mainGreen);
  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  logs.forEach(l => { if (l && l.difficulty) { const dL = l.difficulty.toLowerCase(); if (dL.includes('easy')) diffCounts.easy++; else if (dL.includes('medium')) diffCounts.medium++; else if (dL.includes('hard')) diffCounts.hard++; } });
  const dCtx = document.getElementById('difficultyChart'); if (dCtx) { if (dChart) dChart.destroy(); dChart = new Chart(dCtx, { type: 'doughnut', data: { labels: ['Easy', 'Medium', 'Hard'], datasets: [{ data: [diffCounts.easy, diffCounts.medium, diffCounts.hard], backgroundColor: ['#00af9b', '#ffb800', '#ff2d55'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isLight ? '#333' : '#fff', font: { size: 10 } } } } } }); }
  const totalMs = logs.reduce((s, l) => s + (l ? (l.elapsedMs || parseTimeToMs(l.timeStr) || 0) : 0), 0);
  const tpEl = document.getElementById('total-problems'); if (tpEl) tpEl.textContent = logs.length;
  const ttsEl = document.getElementById('total-time-spent'); if (ttsEl) ttsEl.textContent = formatTime(totalMs);
  const todayK = getDateKey(new Date()), now = new Date(), startW = new Date(now.getTime() - 7 * 86400000), startM = new Date(now.getTime() - 30 * 86400000), thisY = now.getFullYear();
  const stEl = document.getElementById('stat-today'); if (stEl) stEl.textContent = logs.filter(l => getDateKey(l.timestamp) === todayK).length;
  const swEl = document.getElementById('stat-week'); if (swEl) swEl.textContent = logs.filter(l => l.timestamp > startW.getTime()).length;
  const smEl = document.getElementById('stat-month'); if (smEl) smEl.textContent = logs.filter(l => l.timestamp > startM.getTime()).length;
  const syEl = document.getElementById('stat-year'); if (syEl) syEl.textContent = logs.filter(l => new Date(l.timestamp).getFullYear() === thisY).length;
  const csEl = document.getElementById('current-streak'); if (csEl) {
    const daysArr = [...new Set(logs.filter(l => l && l.timestamp).map(l => getDateKey(l.timestamp)))].filter(k => k !== "").sort((a,b) => b.localeCompare(a));
    let streak = 0; if (daysArr.length > 0) {
      let c = new Date(); c.setHours(0,0,0,0); if (daysArr[0] === getDateKey(c) || daysArr[0] === getDateKey(new Date(c.getTime() - 86400000))) {
        let curC = (daysArr[0] === getDateKey(c)) ? c : new Date(c.getTime() - 86400000); for (let day of daysArr) { if (day === getDateKey(curC)) { streak++; curC.setDate(curC.getDate() - 1); } else break; }
      }
    }
    csEl.textContent = streak;
  }
  const l7k = [], l7l = []; for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l7k.push(getDateKey(d)); l7l.push((d.getMonth()+1)+'/'+d.getDate()); }
  const d7Counts = l7k.map(k => logs.filter(l => getDateKey(l.timestamp) === k).length);
  const hCt = document.getElementById('progressChart'); if(hCt) { if (hChart) hChart.destroy(); hChart = new Chart(hCt, { type:'bar', data:{ labels:l7l, datasets:[{ data:d7Counts, backgroundColor:isLight?'rgba(0,128,0,0.5)':'rgba(0,255,0,0.5)', borderColor:mainGreen, borderWidth:1 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}, stepSize:1}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}}} }, plugins:{legend:{display:false}} } }); }
  const l30k = [], l30l = []; for (let i=29; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); l30k.push(getDateKey(d)); l30l.push(i%5===0 ? (d.getMonth()+1)+'/'+d.getDate() : ''); }
  const d30Counts = l30k.map(k => logs.filter(l => getDateKey(l.timestamp) === k).length);
  const mCt = document.getElementById('monthProgressChart'); if(mCt) { if (mChart) mChart.destroy(); mChart = new Chart(mCt, { type:'bar', data:{ labels:l30l, datasets:[{ data:d30Counts, backgroundColor:isLight?'rgba(0,128,0,0.4)':'rgba(0,255,0,0.4)', borderColor:mainGreen, borderWidth:1 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}, stepSize:1}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:7}}} }, plugins:{legend:{display:false}} } }); }
  const hrData = Array(24).fill(0); logs.forEach(l => { if (l && l.timestamp && getDateKey(l.timestamp) === todayK) { const d = new Date(l.timestamp); hrData[d.getHours()]++; } });
  const hoCt = document.getElementById('hourlyActivityChart'); if(hoCt) { if (hoChart) hoChart.destroy(); hoChart = new Chart(hoCt, { type:'bar', data:{ labels:Array.from({length:24}, (_,i) => i === 0 ? '12am' : (i < 12 ? i+'am' : (i === 12 ? '12pm' : (i-12)+'pm'))), datasets:[{ data:hrData, backgroundColor:isLight?'rgba(0,128,0,0.6)':'rgba(0,255,0,0.6)' }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:8}, stepSize:1}}, x:{grid:{color:gridColor}, ticks:{color:mainGreen, font:{size:7}}} }, plugins:{legend:{display:false}} } }); }
  const activeS = document.getElementById('active-chart-section');
  if (curr.length > 0 && activeS) {
    activeS.style.display = 'flex'; const aCt = document.getElementById('activeProblemsChart'); if(aCt) { if (aChart) aChart.destroy(); aChart = new Chart(aCt, { type:'bar', data:{ labels:curr.map(p => (p.number ? p.number + " " : "") + p.name.substring(0,8)), datasets:[{ data:curr.map(p => (p.isRunning ? Date.now()-p.startTime : p.elapsed)/60000), backgroundColor:isLight?'rgba(0,128,0,0.4)':'rgba(0,255,0,0.4)', borderColor:mainGreen, borderWidth:1 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, scales:{ x:{beginAtZero:true, ticks:{color:mainGreen, font:{size:8}}}, y:{ticks:{color:mainGreen, font:{size:8}}} }, plugins:{legend:{display:false}} } }); }
  } else if (activeS) activeS.style.display = 'none';
}

function playBeep() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(), osc = ctx.createOscillator(), gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type = 'square'; osc.frequency.setValueAtTime(880, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime); osc.start(); osc.stop(ctx.currentTime + 0.2); } catch(e) {} }

// --- Shortcuts ---
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault(); 
    const activeContent = document.querySelector('.tab-content.active');
    if(!activeContent) return;
    const aT = activeContent.id;
    if (aT === 'stopwatch') { const fb = document.querySelector('.problem-controls button'); if (fb) fb.click(); }
    else if (aT === 'standalone-sw') { const sb = document.getElementById('sw-start'), pb = document.getElementById('sw-pause'); if (swInterval) pb.click(); else if(sb) sb.click(); }
    else if (aT === 'timer') { const ts = document.getElementById('timer-start'); if(ts) ts.click(); }
  }
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const verEl = document.getElementById('ext-version');
    if (verEl) verEl.textContent = 'v' + api.runtime.getManifest().version;
  } catch (e) {}

  // 1. Migration from sync to local
  if (api.storage && api.storage.local && api.storage.sync) {
    try {
      const localData = await activeStorage.get(null);
      if (Object.keys(localData).length === 0) {
        const syncData = await new Promise(res => api.storage.sync.get(null, d => res(d || {})));
        if (Object.keys(syncData).length > 0) await activeStorage.set(syncData);
      }
    } catch(e) {}
  }

  // 2. Setup Listeners
  initTabs();
  const themeBtn = document.getElementById('theme-toggle'); if(themeBtn) themeBtn.addEventListener('click', async () => { document.body.classList.toggle('light-mode'); await activeStorage.set({ theme: document.body.classList.contains('light-mode') ? 'light' : 'dark' }); renderStats(); });
  const expandBtn = document.getElementById('expand-page-btn'); if(expandBtn) expandBtn.addEventListener('click', () => { api.tabs.create({ url: api.runtime.getURL('popup.html?full=1') }); });
  const historySearch = document.getElementById('history-search'); if(historySearch) historySearch.addEventListener('input', filterHistory);
  
  const tStart = document.getElementById('timer-start'); if(tStart) tStart.addEventListener('click', async () => { const m = parseInt(document.getElementById('timer-input').value) || 0; if (m > 0) { timerTargetTime = Date.now() + m * 60 * 1000; await activeStorage.set({ timer_target: timerTargetTime }); if(api.alarms) api.alarms.create('timer-finished', { when: timerTargetTime }); startTimerUI(); } });
  const tPause = document.getElementById('timer-pause'); if(tPause) tPause.addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); });
  const tReset = document.getElementById('timer-reset'); if(tReset) tReset.addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); const d = document.getElementById('timer-display'); if(d) d.textContent = '00:00:00.00'; });
  
  const sStart = document.getElementById('sw-start'); if(sStart) sStart.addEventListener('click', async () => { if (swInterval) return; swStartTime = Date.now() - swElapsedTime; await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime }); startStandaloneSwUI(); });
  const sPause = document.getElementById('sw-pause'); if(sPause) sPause.addEventListener('click', async () => { if (swInterval) { clearInterval(swInterval); swInterval = null; } swElapsedTime = Date.now() - swStartTime; await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime }); updateSwDisplay(); });
  const sReset = document.getElementById('sw-reset'); if(sReset) sReset.addEventListener('click', async () => { clearInterval(swInterval); swInterval = null; swElapsedTime = 0; await activeStorage.set({ sw_is_running: false, sw_elapsed: 0 }); updateSwDisplay(); });
  
  document.querySelectorAll('.preset-card').forEach(btn => btn.addEventListener('click', () => { const inp = document.getElementById('timer-input'); if(inp) inp.value = btn.dataset.time; }));
  const tInc = document.getElementById('timer-inc'); if(tInc) tInc.addEventListener('click', () => { const inp = document.getElementById('timer-input'); if(inp) inp.value = parseInt(inp.value || 0) + 1; });
  const tDec = document.getElementById('timer-dec'); if(tDec) tDec.addEventListener('click', () => { const inp = document.getElementById('timer-input'); if(inp) { const v = parseInt(inp.value || 0); if (v > 1) inp.value = v - 1; } });
  
  const addProbBtn = document.getElementById('add-problem'); if(addProbBtn) addProbBtn.addEventListener('click', async () => { const nEl = document.getElementById('new-problem-name'); if(!nEl) return; const name = nEl.value.trim(); if (name) { let fn = name, fnum = detectedDetails ? detectedDetails.number : "", furl = detectedDetails ? detectedDetails.url : "", fdiff = detectedDetails ? detectedDetails.difficulty : ""; if (fnum && name.startsWith(fnum + ". ")) fn = name.replace(fnum + ". ", ""); problems.push({ name: fn, number: fnum, url: furl, difficulty: fdiff, elapsed: 0, isRunning: false, startTime: 0, notes: "", showNotes: false }); nEl.value = ''; detectedDetails = null; await saveProblems(); renderProblems(); startUIInterval(); } });
  const probCont = document.getElementById('problems-container'); if(probCont) probCont.addEventListener('click', async (e) => { const action = e.target.dataset.action, i = parseInt(e.target.dataset.index); if (action === undefined || isNaN(i)) return; const p = problems[i]; if (action === 'toggle') { if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; } else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; } } else if (action === 'reset') { p.elapsed = 0; p.isRunning = false; } else if (action === 'delete') problems.splice(i, 1); else if (action === 'finish') { const f = p.isRunning ? (Date.now() - p.startTime) : p.elapsed; await logToHistory(p, f); problems.splice(i, 1); } else if (action === 'toggle-notes') p.showNotes = !p.showNotes; await saveProblems(); renderProblems(); if (action === 'toggle-notes' && p && p.showNotes) { const ta = document.querySelector(`#notes-section-${i} textarea`); if (ta) ta.focus(); } startUIInterval(); });
  
  const importBtn = document.getElementById('import-btn'); if(importBtn) importBtn.addEventListener('click', () => { 
    if (window.location.search.indexOf('full=1') === -1 && window.innerWidth < 800) {
      api.tabs.create({ url: api.runtime.getURL('popup.html?full=1') });
    } else {
      const f = document.getElementById('import-file'); if(f) f.click(); 
    }
  });
  const importFile = document.getElementById('import-file'); if(importFile) importFile.addEventListener('change', (e) => { 
    const file = e.target.files[0]; if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = (ev) => { 
      handleRestore(ev.target.result, file.name.endsWith('.csv')); 
      e.target.value = ''; 
    }; 
    reader.readAsText(file); 
  });
  const exportJson = document.getElementById('export-json'); if(exportJson) exportJson.addEventListener('click', async () => { const data = await activeStorage.get(null); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `green_timer_backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); });
  const exportCsv = document.getElementById('export-csv'); if(exportCsv) exportCsv.addEventListener('click', async () => { const d = await activeStorage.get('leetcode_history'), h = d.leetcode_history || []; if (h.length === 0) return; let csv = 'Number,Name,Difficulty,Time,Notes,URL,ISO_Date,Local_Time\n'; h.forEach(i => { const dt = new Date(i.timestamp), sn = (i.notes || "").replace(/"/g, '""'); csv += `"${i.number}","${i.name}","${i.difficulty || ""}","${i.timeStr}","${sn}","${i.url}","${dt.toISOString()}","${dt.toLocaleString()}"\n`; }); const b = new Blob([csv], { type: 'text/csv' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'leetcode_study_logs.csv'; a.click(); });
  const hYearSel = document.getElementById('heatmap-year-selector'); if(hYearSel) hYearSel.addEventListener('change', (e) => { selectedHeatmapYear = e.target.value; renderStats(); });
  const clearLog = document.getElementById('clear-log'); if(clearLog) clearLog.addEventListener('click', async () => { if (confirm('Clear history?')) { await activeStorage.set({ leetcode_history: [] }); renderHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats(); } });

  const logList = document.getElementById('log-list'); if(logList) logList.addEventListener('click', async (e) => {
    const action = e.target.dataset.action, idx = parseInt(e.target.dataset.index);
    if (!action || isNaN(idx)) return;
    const entry = currentHistory[idx];
    if (action === 'delete-history') {
      if (confirm('Delete this entry?')) {
        currentHistory.splice(idx, 1);
        await activeStorage.set({ leetcode_history: currentHistory });
        renderHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats();
      }
    } else if (action === 'copy-history-note') {
      if (entry.notes) {
        navigator.clipboard.writeText(entry.notes).then(() => {
          const ot = e.target.textContent; e.target.textContent = 'COPIED!';
          setTimeout(() => e.target.textContent = ot, 1500);
        });
      }
    } else if (action === 'toggle-history-notes') {
      const nSection = document.getElementById(`history-notes-section-${idx}`);
      if (nSection) {
        const isHidden = nSection.style.display === 'none';
        nSection.style.display = isHidden ? 'block' : 'none';
        e.target.textContent = isHidden ? '▼ HIDE' : (entry.notes ? 'EDIT' : 'ADD');
        if (isHidden) {
          const ta = nSection.querySelector('textarea');
          if (ta) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
            ta.focus();
          }
        }
      }
    }
  });

  // 3. Final Init
  await initTheme(); await loadProblems(); await initTimers(); requestLeetCodeTitle(); await renderHistory();

  if (window.location.search.indexOf('full=1') !== -1 || window.innerWidth > 500) {
    document.body.classList.add('full-page');
    setTimeout(() => { const logBtn = document.querySelector('.tab-btn[data-tab="log"]'); if(logBtn) logBtn.click(); }, 50);
  }
  });
