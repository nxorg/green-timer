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

// --- Analytics ---
let anaChart = null;

async function showProblemAnalytics(problemName, problemNumber) {
  const modal = document.getElementById('analytics-modal');
  if (!modal) return;

  const title = document.getElementById('analytics-title');
  title.textContent = (problemNumber ? problemNumber + ". " : "") + problemName;

  const prob = currentHistory.find(p => p.name === problemName && (p.number === problemNumber || (!p.number && !problemNumber)));
  const attempts = prob ? [...prob.submissions].reverse() : []; // Oldest first for chart

  if (attempts.length === 0) {
    alert("No history found for this problem yet. Finish it once to see analytics!");
    return;
  }

  // Stats
  const elapsedTimes = attempts.map(a => a.elapsedMs || 0);
  const totalMs = elapsedTimes.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / attempts.length;
  const bestMs = Math.min(...elapsedTimes);

  document.getElementById('ana-avg-speed').textContent = formatTime(avgMs).split('.')[0];
  document.getElementById('ana-personal-best').textContent = formatTime(bestMs).split('.')[0];
  document.getElementById('ana-total-time').textContent = formatTime(totalMs).split('.')[0];

  // Timeline
  const timeline = document.getElementById('ana-timeline');
  timeline.replaceChildren();
  [...attempts].reverse().forEach(a => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    const date = document.createElement('div');
    date.className = 'timeline-date';
    date.textContent = new Date(a.timestamp).toLocaleString();
    
    const statusRow = document.createElement('div');
    statusRow.style.display = 'flex';
    statusRow.style.alignItems = 'center';
    statusRow.style.gap = '8px';
    statusRow.style.marginBottom = '4px';

    const statusColor = getStatusColor(a.status);
    const statusBadge = document.createElement('span');
    statusBadge.className = 'tag-badge';
    statusBadge.style.backgroundColor = statusColor.startsWith('var(') ? 'var(--green)' : statusColor;
    statusBadge.style.borderColor = 'transparent';
    statusBadge.style.color = '#000000'; // Dark text for high visibility on green/colored backgrounds
    statusBadge.style.fontSize = '0.55em';
    statusBadge.style.padding = '1px 4px';
    statusBadge.textContent = a.status;

    const time = document.createElement('div');
    time.className = 'timeline-time';
    time.style.margin = '0';
    time.textContent = a.timeStr;
    
    statusRow.appendChild(statusBadge);
    statusRow.appendChild(time);

    item.appendChild(date);
    item.appendChild(statusRow);
    
    if (a.notes) {
      const notes = document.createElement('div');
      notes.className = 'timeline-notes';
      notes.textContent = a.notes;
      item.appendChild(notes);
    }
    
    timeline.appendChild(item);
  });

  // Chart
  const ctx = document.getElementById('ana-trend-chart').getContext('2d');
  if (anaChart) anaChart.destroy();

  const isLight = document.body.classList.contains('light-mode');
  const mainGreen = isLight ? '#008000' : '#00ff00';
  const textColor = isLight ? '#333333' : '#ffffff';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

  const labels = attempts.map((_, i) => `Attempt ${i + 1}`);
  const data = attempts.map(a => (a.elapsedMs || 0) / 60000); // Minutes

  anaChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Minutes',
        data: data,
        borderColor: mainGreen,
        backgroundColor: isLight ? 'rgba(0, 128, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: mainGreen,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Time: ${context.raw.toFixed(2)} mins`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 10 } }
        }
      }
    }
  });

  modal.classList.add('show');
  
  // Copy Report listener
  const copyBtn = document.getElementById('ana-copy-report');
  copyBtn.onclick = () => {
    const report = generateMarkdownReport(problemName, problemNumber, attempts, avgMs, bestMs, totalMs);
    navigator.clipboard.writeText(report).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'COPIED!';
      setTimeout(() => copyBtn.textContent = originalText, 2000);
    });
  };
}

function generateMarkdownReport(name, num, attempts, avg, best, total) {
  let report = `# Problem Report: ${num ? num + ". " : ""}${name}\n\n`;
  report += `## Performance Summary\n`;
  report += `- **Average Speed:** ${formatTime(avg)}\n`;
  report += `- **Personal Best:** ${formatTime(best)}\n`;
  report += `- **Total Time Spent:** ${formatTime(total)}\n`;
  report += `- **Total Attempts:** ${attempts.length}\n\n`;
  report += `## Attempt History\n`;
  
  [...attempts].reverse().forEach((a, i) => {
    report += `### Attempt ${attempts.length - i} (${new Date(a.timestamp).toLocaleDateString()})\n`;
    report += `- **Time:** ${a.timeStr}\n`;
    if (a.notes) report += `- **Notes:** ${a.notes}\n`;
    report += `\n`;
  });
  
  report += `\n---\n*Generated by Green Timer*`;
  return report;
}

// --- Theme ---
async function initTheme() {
  const data = await activeStorage.get('theme');
  if (data.theme === 'light') document.body.classList.add('light-mode');
  else document.body.classList.remove('light-mode');
}

async function saveSettingsTags() {
  await activeStorage.set({ global_tags: globalTags });
}

function renderSettingsTags() {
  const list = document.getElementById('settings-tag-list');
  if (!list) return;
  list.replaceChildren();
  
  // Sort global tags
  globalTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  
  globalTags.forEach(tag => {
    const badge = document.createElement('span');
    badge.className = 'tag-badge removable';
    badge.textContent = tag;
    badge.onclick = async () => {
      if (confirm(`Delete tag "${tag}" from library?`)) {
        globalTags = globalTags.filter(t => t !== tag);
        await saveSettingsTags();
        renderSettingsTags();
      }
    };
    list.appendChild(badge);
  });
}

// --- Tab Logic ---
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const settingsIcon = document.getElementById('settings-icon-btn');

  const switchTab = async (tabName, clickedBtn) => {
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');
    
    // Also highlight the header icon if settings is active
    if (tabName === 'settings' && settingsIcon) settingsIcon.classList.add('active');
    // Highlight the main tab bar button if settings is active
    if (tabName === 'settings') {
      const mainSettingsBtn = document.querySelector('.tabs .tab-btn[data-tab="settings"]');
      if (mainSettingsBtn) mainSettingsBtn.classList.add('active');
    }

    const target = document.getElementById(tabName);
    if (target) target.classList.add('active');
    if (tabName === 'log') renderHistory();
    if (tabName === 'stats') setTimeout(() => renderStats(true), 50);
    if (tabName === 'stopwatch') renderProblems();
    if (tabName === 'settings') { renderStatuses(); renderSettingsTags(); }
    
    await activeStorage.set({ last_tab: tabName });
  };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab || 'settings', btn));
  });

  if (settingsIcon) {
    settingsIcon.addEventListener('click', () => switchTab('settings', settingsIcon));
  }
}

async function restoreLastTab() {
  const data = await activeStorage.get('last_tab');
  const lastTab = data.last_tab || 'stopwatch';
  const targetBtn = document.querySelector(`.tab-btn[data-tab="${lastTab}"]`);
  if (targetBtn) targetBtn.click();
}

// --- Helpers ---
function getStatusColor(status) {
  const isLight = document.body.classList.contains('light-mode');
  const customColor = problemStatusColors[status];
  if (customColor) return customColor;
  
  if (isLight) return DEFAULT_COLORS_LIGHT[status] || 'var(--green)';
  return DEFAULT_COLORS[status] || 'var(--green)';
}

function createCustomDropdown(options, selectedValue, onSelect) {
  const container = document.createElement('div');
  container.className = 'custom-dropdown';
  
  const selected = document.createElement('div');
  selected.className = 'dropdown-selected';
  
  const updateSelectedStyle = (val) => {
    const color = getStatusColor(val);
    selected.replaceChildren();
    
    const bullet = document.createElement('span');
    bullet.style.display = 'inline-block';
    bullet.style.width = '8px';
    bullet.style.height = '8px';
    bullet.style.borderRadius = '50%';
    bullet.style.marginRight = '6px';
    bullet.style.backgroundColor = color.startsWith('var(') ? 'var(--green)' : color;
    
    const text = document.createTextNode(val || options[0]);
    
    selected.appendChild(bullet);
    selected.appendChild(text);
    
    if (color.startsWith('var(')) {
      selected.style.borderColor = '';
    } else {
      selected.style.borderColor = color;
    }
    selected.style.color = 'var(--text-color)';
  };
  updateSelectedStyle(selectedValue || options[0]);
  
  const menu = document.createElement('div');
  menu.className = 'dropdown-options';
  
  options.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'dropdown-option' + (opt === selectedValue ? ' active' : '');
    
    const optColor = getStatusColor(opt);
    const bullet = document.createElement('span');
    bullet.style.display = 'inline-block';
    bullet.style.width = '6px';
    bullet.style.height = '6px';
    bullet.style.borderRadius = '50%';
    bullet.style.marginRight = '8px';
    bullet.style.backgroundColor = optColor.startsWith('var(') ? 'var(--green)' : optColor;
    
    item.appendChild(bullet);
    item.appendChild(document.createTextNode(opt));
    item.style.color = 'var(--text-color)';

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      updateSelectedStyle(opt);
      menu.classList.remove('show');
      onSelect(opt);
    });
    menu.appendChild(item);
  });
  
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShowing = menu.classList.contains('show');
    document.querySelectorAll('.dropdown-options.show').forEach(m => m.classList.remove('show'));
    if (!isShowing) menu.classList.add('show');
  });
  
  container.appendChild(selected);
  container.appendChild(menu);
  return container;
}

function createMultiSelectDropdown(options, selectedValues, placeholder, onSelect) {
  const container = document.createElement('div');
  container.className = 'custom-dropdown';
  
  const selected = document.createElement('div');
  selected.className = 'dropdown-selected';
  selected.style.color = 'var(--text-color)';
  
  const updateSelectedText = () => {
    if (selectedValues.length === 0) {
      selected.textContent = placeholder;
      selected.style.opacity = '0.6';
    } else {
      selected.textContent = selectedValues.length === 1 ? selectedValues[0] : `${selectedValues.length} Tags Selected`;
      selected.style.opacity = '1';
    }
  };
  updateSelectedText();
  
  const menu = document.createElement('div');
  menu.className = 'dropdown-options';
  menu.style.maxHeight = '300px';
  menu.style.overflowY = 'auto';
  
  const renderOptions = () => {
    menu.replaceChildren();
    
    // Clear All option
    if (selectedValues.length > 0) {
      const clearItem = document.createElement('div');
      clearItem.className = 'dropdown-option';
      clearItem.style.color = '#ff4d4d';
      clearItem.style.fontWeight = 'bold';
      clearItem.textContent = '✕ CLEAR ALL';
      clearItem.onclick = (e) => {
        e.stopPropagation();
        selectedValues.length = 0;
        updateSelectedText();
        renderOptions();
        onSelect([...selectedValues]);
      };
      menu.appendChild(clearItem);
    }

    options.forEach(opt => {
      const isSelected = selectedValues.includes(opt);
      if (isSelected) return; // Skip already selected tags to avoid redundancy
      
      const item = document.createElement('div');
      item.className = 'dropdown-option';
      item.textContent = opt;
      item.style.color = 'var(--text-color)';

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedValues.push(opt);
        updateSelectedText();
        renderOptions();
        onSelect([...selectedValues]);
      });
      menu.appendChild(item);
    });
  };
  renderOptions();
  
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShowing = menu.classList.contains('show');
    document.querySelectorAll('.dropdown-options.show').forEach(m => m.classList.remove('show'));
    if (!isShowing) menu.classList.add('show');
  });
  
  container.appendChild(selected);
  container.appendChild(menu);
  return container;
}

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
async function updateProblemInput(details) {
  if (!details || !details.name) return false;
  detectedDetails = details;
  const el = document.getElementById('new-problem-name');
  const statusEl = document.getElementById('detection-status');
  
  if (appSettings.autoAdd) {
    const alreadyExists = problems.some(p => (p.number === details.number && p.number !== "") || p.name === details.name);
    
    // Check if we can upgrade an existing problem that has no number
    const existingProblemWithoutNumber = problems.find(p => !p.number && p.name === details.name);
    
    if (existingProblemWithoutNumber && details.number) {
      existingProblemWithoutNumber.number = details.number;
      if (!existingProblemWithoutNumber.difficulty) existingProblemWithoutNumber.difficulty = details.difficulty;
      await saveProblems();
      renderProblems();
      return true;
    }

    if (!alreadyExists) {
      const initialStatus = appSettings.autoStart ? 'Started' : problemStatuses[0];
      problems.push({ 
        name: details.name, 
        number: details.number || "", 
        url: details.url || "", 
        difficulty: details.difficulty || "", 
        elapsed: 0, 
        isRunning: appSettings.autoStart, 
        startTime: appSettings.autoStart ? Date.now() : 0, 
        notes: "", 
        status: initialStatus, 
        showNotes: false 
      });
      await saveProblems();
      renderProblems();
      if (appSettings.autoStart) startUIInterval();
      if (statusEl) { statusEl.textContent = `✅ Auto-Added: #${details.number || '?'}`; statusEl.style.display = 'block'; }
      return true;
    }
  }

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
let timerInterval, swInterval, uiInterval, timerTargetTime = 0, swElapsedTime = 0, swStartTime = 0, problems = [], problemStatuses = [], problemStatusColors = {}, currentHistoryFilterStatus = "", currentHistoryFilterTags = [], globalTags = [];
let problemMetadata = {}; // Store tags/meta by problem key (number or name)
let taggingContext = { type: '', index: -1 }; // Context for the tag modal
let tagAutocompleteIdx = -1;

const DEFAULT_TAGS = ['Array', 'String', 'Hash Table', 'Dynamic Programming', 'Math', 'Sorting', 'Greedy', 'Depth-First Search', 'Binary Search', 'Breadth-First Search', 'Tree', 'Matrix', 'Two Pointers', 'Binary Tree', 'Stack', 'Design', 'Backtracking', 'Graph', 'Linked List', 'Bit Manipulation', 'Heap (Priority Queue)', 'Sliding Window', 'Union Find', 'Counting', 'Trie', 'Monotonic Stack', 'Recursion', 'Divide and Conquer', 'Queue', 'Memoization', 'Binary Search Tree'];

let appSettings = {
  defaultTime: 25,
  presets: [5, 10, 25, 50],
  soundEnabled: true,
  autoAdd: false,
  autoStart: false,
  dailyGoal: 3
};

const DEFAULT_STATUSES = [
  'Not Started', 'Started', 'Understood Problem', 'Struggled', 'Hint-Assisted', 
  'Solved (With Help)', 'Solved Independently', 'Optimized Solution', 
  'Edge-Case Issues', 'Needs Revision', 'Mastered'
];

const DEFAULT_COLORS = {
  'Not Started': '#E5E7EB',
  'Started': '#60A5FA',
  'Understood Problem': '#BFDBFE',
  'Struggled': '#FDBA74',
  'Hint-Assisted': '#FEF08A',
  'Solved (With Help)': '#D8B4FE',
  'Solved Independently': '#86EFAC',
  'Optimized Solution': '#22C55E',
  'Edge-Case Issues': '#FCA5A5',
  'Needs Revision': '#DC2626',
  'Mastered': '#14B8A6'
};

const DEFAULT_COLORS_LIGHT = {
  'Not Started': '#4B5563',
  'Started': '#2563EB',
  'Understood Problem': '#1D4ED8',
  'Struggled': '#B45309',
  'Hint-Assisted': '#A16207',
  'Solved (With Help)': '#6D28D9',
  'Solved Independently': '#047857',
  'Optimized Solution': '#166534',
  'Edge-Case Issues': '#B91C1C',
  'Needs Revision': '#7F1D1D',
  'Mastered': '#0F766E'
};

async function initTimers() {
  const data = await activeStorage.get(['timer_target', 'sw_elapsed', 'sw_start_time', 'sw_is_running', 'problem_statuses', 'problem_status_colors', 'app_settings', 'global_tags', 'problem_metadata']);
  if (data.timer_target && data.timer_target > Date.now()) { timerTargetTime = data.timer_target; startTimerUI(); }
  swElapsedTime = data.sw_elapsed || 0;
  if (data.sw_is_running) { swStartTime = data.sw_start_time || Date.now(); startStandaloneSwUI(); } else { updateSwDisplay(); }

  problemStatuses = data.problem_statuses || DEFAULT_STATUSES;
  problemStatusColors = data.problem_status_colors || DEFAULT_COLORS;
  globalTags = data.global_tags || DEFAULT_TAGS;
  problemMetadata = data.problem_metadata || {};
  if (data.app_settings) appSettings = { ...appSettings, ...data.app_settings };

  applySettingsToUI();
}function startTimerUI() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const tl = timerTargetTime - Date.now();
    const el = document.getElementById('timer-display');
    if (tl <= 0) { 
      clearInterval(timerInterval); 
      if(el) el.textContent = '00:00:00.00'; 
      if (appSettings.soundEnabled) playBeep(); 
    }
    else if(el) el.textContent = formatTime(tl, true);
  }, 50);
}

function updateSwDisplay() { const el = document.getElementById('sw-display'); if (el) el.textContent = formatTime(swElapsedTime, true); }
function startStandaloneSwUI() { 
  if (swInterval) clearInterval(swInterval); 
  swInterval = setInterval(() => { const el = document.getElementById('sw-display'); if(el) el.textContent = formatTime(Date.now() - swStartTime, true); }, 50); 
}

// --- Problems ---
async function loadProblems() { 
  const d = await activeStorage.get(['leetcode_problems', 'problem_statuses', 'problem_status_colors', 'app_settings']); 
  problems = d.leetcode_problems || []; 
  problemStatuses = d.problem_statuses || DEFAULT_STATUSES;
  problemStatusColors = d.problem_status_colors || DEFAULT_COLORS;
  if (d.app_settings) appSettings = { ...appSettings, ...d.app_settings };
  renderProblems(); 
  startUIInterval(); 
}
async function saveProblems() { await activeStorage.set({ leetcode_problems: problems }); }
async function saveStatuses() { await activeStorage.set({ problem_statuses: problemStatuses, problem_status_colors: problemStatusColors }); }
async function saveSettings() { await activeStorage.set({ app_settings: appSettings }); }

function applySettingsToUI() {
  const timerInput = document.getElementById('timer-input');
  if (timerInput && !timerInterval && timerTargetTime === 0) timerInput.value = appSettings.defaultTime;
  
  const presetsGrid = document.querySelector('.presets-grid');
  if (presetsGrid) {
    presetsGrid.replaceChildren();
    appSettings.presets.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'preset-card';
      btn.dataset.time = p;
      
      const unit = document.createElement('span'); unit.className = 'preset-unit'; unit.textContent = 'MIN';
      const time = document.createElement('span'); time.className = 'preset-time'; time.textContent = p;
      
      btn.appendChild(unit); btn.appendChild(time);
      btn.addEventListener('click', () => { if(timerInput) timerInput.value = p; });
      presetsGrid.appendChild(btn);
    });
  }
}

function renderStatuses() {
  const list = document.getElementById('status-list');
  if (!list) return;
  list.replaceChildren();
  problemStatuses.forEach((status, idx) => {
    const row = document.createElement('div');
    row.className = 'input-row';
    row.style.marginBottom = '5px';
    
    const statusColor = getStatusColor(status);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = status;
    input.style.fontSize = '0.8em';
    input.style.flex = '1';
    input.style.color = 'var(--text-color)';
    input.style.borderColor = statusColor.startsWith('var(') ? 'var(--green)' : statusColor;
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = statusColor;
    colorInput.style.width = '40px';
    colorInput.style.padding = '2px';
    colorInput.style.height = '32px';
    colorInput.style.flexShrink = '0';
    colorInput.style.cursor = 'pointer';
    colorInput.style.border = '1px solid ' + statusColor;
    
    input.addEventListener('change', (e) => {
      const oldName = problemStatuses[idx];
      const newName = e.target.value.trim();
      if (newName && oldName !== newName) {
        problemStatuses[idx] = newName;
        problemStatusColors[newName] = problemStatusColors[oldName];
        delete problemStatusColors[oldName];
        saveStatuses();
        renderHistory();
        renderProblems();
      }
    });

    colorInput.addEventListener('change', (e) => {
      const newColor = e.target.value;
      problemStatusColors[status] = newColor;
      input.style.color = newColor;
      input.style.borderColor = newColor;
      colorInput.style.border = '1px solid ' + newColor;
      saveStatuses();
      renderHistory();
      renderProblems();
    });
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-small';
    delBtn.textContent = 'DELETE';
    delBtn.style.color = '#ff0000';
    delBtn.style.borderColor = '#ff0000';
    delBtn.addEventListener('click', () => {
      delete problemStatusColors[status];
      problemStatuses.splice(idx, 1);
      saveStatuses();
      renderStatuses();
      renderHistory();
      renderProblems();
    });
    
    if (statusColor.startsWith('var(')) {
      input.style.borderColor = 'var(--green)';
      colorInput.style.border = '1px solid var(--green)';
    }
    
    row.appendChild(input);
    row.appendChild(colorInput);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
  renderSettings();
}

function renderSettings() {
  const defaultTimeInp = document.getElementById('setting-default-time');
  if (defaultTimeInp) defaultTimeInp.value = appSettings.defaultTime;
  
  appSettings.presets.forEach((p, idx) => {
    const inp = document.getElementById(`setting-preset-${idx + 1}`);
    if (inp) inp.value = p;
  });
  
  const soundInp = document.getElementById('setting-sound-enabled');
  if (soundInp) soundInp.checked = appSettings.soundEnabled;
  
  const autoAddInp = document.getElementById('setting-auto-add');
  if (autoAddInp) autoAddInp.checked = appSettings.autoAdd;
  
  const autoStartInp = document.getElementById('setting-auto-start');
  if (autoStartInp) autoStartInp.checked = appSettings.autoStart;
  
  const dailyGoalInp = document.getElementById('setting-daily-goal');
  if (dailyGoalInp) dailyGoalInp.value = appSettings.dailyGoal;
}

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
    
    // Top Row: Title (Left) | Action Buttons (Right)
    const topRow = document.createElement('div');
    topRow.className = 'problem-top-row';
    
    const title = document.createElement('div');
    title.className = 'problem-list-title';
    title.title = dn;
    if (p.url) { const a = document.createElement('a'); a.href = p.url; a.target = '_blank'; a.textContent = dn; a.title = dn; title.appendChild(a); } else title.textContent = dn;
    
    const actionButtons = document.createElement('div');
    actionButtons.style.display = 'flex';
    actionButtons.style.gap = '4px';
    
    const tagBtn = document.createElement('button'); tagBtn.className = 'btn-small'; 
    tagBtn.textContent = p.showTags ? 'HIDE TAGS' : 'TAGS'; 
    tagBtn.dataset.index = i; tagBtn.dataset.action = 'toggle-tags';
    const anaBtn = document.createElement('button'); anaBtn.className = 'btn-small'; anaBtn.textContent = '📊'; anaBtn.title = 'Analytics'; anaBtn.dataset.index = i; anaBtn.dataset.action = 'analytics';
    const delBtn = document.createElement('button'); delBtn.className = 'btn-small'; delBtn.textContent = 'X'; delBtn.dataset.index = i; delBtn.dataset.action = 'delete';
    
    actionButtons.appendChild(tagBtn);
    actionButtons.appendChild(anaBtn);
    actionButtons.appendChild(delBtn);
    
    topRow.appendChild(title);
    topRow.appendChild(actionButtons);
    r.appendChild(topRow);

    // Middle: Inline Tags (Conditional)
    if (p.showTags) {
      const tagList = document.createElement('div');
      tagList.className = 'tag-list-inline';
      tagList.style.marginBottom = '10px';
      tagList.style.marginTop = '-5px';
      if (p.tags && p.tags.length > 0) {
        p.tags.forEach(t => {
          const span = document.createElement('span');
          span.className = 'tag-badge';
          span.textContent = t;
          tagList.appendChild(span);
        });
      }
      const manageBtn = document.createElement('button');
      manageBtn.className = 'tag-badge';
      manageBtn.style.borderStyle = 'dashed';
      manageBtn.style.background = 'transparent';
      manageBtn.textContent = '+ MANAGE';
      manageBtn.dataset.index = i;
      manageBtn.dataset.action = 'open-tag-modal';
      tagList.appendChild(manageBtn);
      
      r.appendChild(tagList);
    }

    // Bottom Row: Status/Meta (Left) | Timer/Controls (Right)
    const bottomRow = document.createElement('div');
    bottomRow.className = 'problem-bottom-row';
    
    const metaGroup = document.createElement('div');
    metaGroup.className = 'meta-group';
    
    const statusDropdown = createCustomDropdown(problemStatuses, p.status || problemStatuses[0], async (val) => {
      problems[i].status = val;
      await saveProblems();
    });
    
    metaGroup.appendChild(statusDropdown);
    
    const controlsGroup = document.createElement('div');
    controlsGroup.className = 'controls-group';
    
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'problem-time';
    timeDisplay.id = `time-${i}`;
    timeDisplay.textContent = formatTime(cur, true);
    
    const toggleBtn = document.createElement('button'); toggleBtn.className = 'btn-small'; toggleBtn.textContent = p.isRunning ? 'PAUSE' : 'START'; toggleBtn.dataset.index = i; toggleBtn.dataset.action = 'toggle';
    const resetBtn = document.createElement('button'); resetBtn.className = 'btn-small'; resetBtn.textContent = 'RST'; resetBtn.dataset.index = i; resetBtn.dataset.action = 'reset';
    const finishBtn = document.createElement('button'); finishBtn.className = 'btn-small'; finishBtn.textContent = 'DONE'; finishBtn.dataset.index = i; finishBtn.dataset.action = 'finish';
    
    controlsGroup.appendChild(timeDisplay);
    controlsGroup.appendChild(toggleBtn);
    controlsGroup.appendChild(resetBtn);
    controlsGroup.appendChild(finishBtn);
    
    bottomRow.appendChild(metaGroup);
    bottomRow.appendChild(controlsGroup);
    r.appendChild(bottomRow);

    // Notes Button (moved to action buttons above)
    const notesBtn = document.createElement('button'); 
    notesBtn.className = 'btn-small'; 
    notesBtn.textContent = p.showNotes ? 'HIDE NOTES' : (p.notes ? 'EDIT NOTES' : 'ADD NOTE'); 
    notesBtn.dataset.index = i; notesBtn.dataset.action = 'toggle-notes';
    if (p.notes && !p.showNotes) notesBtn.style.boxShadow = '0 0 10px var(--green)';
    actionButtons.prepend(notesBtn);

    const notesSection = document.createElement('div'); notesSection.id = `notes-section-${i}`; notesSection.style.display = p.showNotes ? 'block' : 'none';
    const notesArea = document.createElement('textarea'); notesArea.className = 'notes-textarea'; notesArea.placeholder = 'Enter notes here (will be saved in history)...'; notesArea.value = p.notes || '';
    const autoExpand = (el) => { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; };
    notesArea.addEventListener('input', (e) => { problems[i].notes = e.target.value; autoExpand(e.target); saveProblems(); });
    setTimeout(() => autoExpand(notesArea), 0);
    notesSection.appendChild(notesArea); r.appendChild(notesSection); c.appendChild(r);
  });
}

function startUIInterval() {
  if (uiInterval) clearInterval(uiInterval); 
  if (!problems.some(p => p.isRunning)) {
    if (document.getElementById('stats').classList.contains('active')) renderStats();
    return;
  }
  uiInterval = setInterval(() => { 
    problems.forEach((p, i) => { 
      if (p.isRunning) { 
        const el = document.getElementById(`time-${i}`); 
        if (el) el.textContent = formatTime(Date.now() - p.startTime, true); 
      } 
    });
    // Update stats tab less frequently to save performance (every 1s)
    if (Date.now() % 1000 < 150) {
      if (document.getElementById('stats').classList.contains('active')) renderStats(false);
    }
  }, 100);
}

// --- Tagging ---
function openTagModal(type, index) {
  taggingContext = { type, index };
  const modal = document.getElementById('tag-modal');
  const title = document.getElementById('tag-modal-title');
  const input = document.getElementById('tag-autocomplete-input');
  
  const p = type === 'active' ? problems[index] : currentHistory[index];
  title.textContent = `Tag: ${p.name}`;
  input.value = '';
  
  renderTagsInModal();
  modal.classList.add('show');
  input.focus();
}

function renderTagsInModal() {
  const container = document.getElementById('current-tags-container');
  container.replaceChildren();
  
  const p = taggingContext.type === 'active' ? problems[taggingContext.index] : currentHistory[taggingContext.index];
  const tags = p.tags || [];
  
  if (tags.length === 0) {
    const empty = document.createElement('div');
    empty.style.opacity = '0.5';
    empty.style.fontSize = '0.7em';
    empty.textContent = 'No tags yet.';
    container.appendChild(empty);
  } else {
    tags.forEach(tag => {
      const badge = document.createElement('span');
      badge.className = 'tag-badge removable';
      badge.textContent = tag;
      badge.onclick = () => removeTagFromProblem(tag);
      container.appendChild(badge);
    });
  }
}

async function addTagToProblem(tag) {
  const { type, index } = taggingContext;
  
  let targetProb;
  if (type === 'active') {
    targetProb = problems[index];
  } else {
    // Index in currentHistory
    targetProb = currentHistory[index];
  }
  
  const metaKey = targetProb.number || targetProb.name;
  
  // 1. Update Centralized Metadata
  if (!problemMetadata[metaKey]) problemMetadata[metaKey] = { tags: [] };
  if (!problemMetadata[metaKey].tags.includes(tag)) {
    problemMetadata[metaKey].tags.push(tag);
    await activeStorage.set({ problem_metadata: problemMetadata });
  }
  const updatedTags = problemMetadata[metaKey].tags;

  // 2. Sync all Active Problems
  problems.forEach(p => {
    if ((p.number || p.name) === metaKey) {
      p.tags = [...updatedTags];
    }
  });
  await saveProblems();

  // 3. Sync nested History Master
  const masterProb = currentHistory.find(p => (p.number || p.name) === metaKey);
  if (masterProb) {
    masterProb.tags = [...updatedTags];
    await saveHistory();
  }

  renderTagsInModal();
  if (type === 'active') renderProblems(); else filterHistory();
}

async function removeTagFromProblem(tag) {
  const { type, index } = taggingContext;
  
  let targetProb;
  if (type === 'active') {
    targetProb = problems[index];
  } else {
    targetProb = currentHistory[index];
  }
  
  const metaKey = targetProb.number || targetProb.name;
  
  // 1. Update Centralized Metadata
  if (problemMetadata[metaKey] && problemMetadata[metaKey].tags) {
    problemMetadata[metaKey].tags = problemMetadata[metaKey].tags.filter(t => t !== tag);
    await activeStorage.set({ problem_metadata: problemMetadata });
  }
  const updatedTags = (problemMetadata[metaKey] && problemMetadata[metaKey].tags) ? problemMetadata[metaKey].tags : [];

  // 2. Sync all Active Problems
  problems.forEach(p => {
    if ((p.number || p.name) === metaKey) {
      p.tags = [...updatedTags];
    }
  });
  await saveProblems();

  // 3. Sync nested History Master
  const masterProb = currentHistory.find(p => (p.number || p.name) === metaKey);
  if (masterProb) {
    masterProb.tags = [...updatedTags];
    await saveHistory();
  }

  renderTagsInModal();
  if (type === 'active') renderProblems(); else filterHistory();
}

function filterTagAutocomplete() {
  const input = document.getElementById('tag-autocomplete-input');
  const list = document.getElementById('tag-autocomplete-list');
  const val = input.value.toLowerCase().trim();
  
  list.replaceChildren();
  tagAutocompleteIdx = -1;
  
  const p = taggingContext.type === 'active' ? problems[taggingContext.index] : currentHistory[taggingContext.index];
  const currentTags = p.tags || [];
  
  // Show top tags if empty, otherwise filter
  let matches = [];
  if (!val) {
    matches = globalTags.filter(t => !currentTags.includes(t)).slice(0, 20);
  } else {
    matches = globalTags.filter(t => t.toLowerCase().includes(val) && !currentTags.includes(t)).slice(0, 15);
  }
  
  if (matches.length > 0) {
    matches.forEach((m, i) => {
      const opt = document.createElement('div');
      opt.className = 'dropdown-option';
      opt.textContent = m;
      opt.onclick = () => {
        addTagToProblem(m);
        input.value = '';
        list.classList.remove('show');
      };
      opt.onmouseenter = () => {
        tagAutocompleteIdx = i;
        updateAutocompleteHighlight(list);
      };
      list.appendChild(opt);
    });
    list.classList.add('show');
  } else {
    list.classList.remove('show');
  }
}

function updateAutocompleteHighlight(list) {
  if (!list) return;
  const options = list.querySelectorAll('.dropdown-option');
  options.forEach((opt, i) => {
    if (i === tagAutocompleteIdx) opt.classList.add('highlighted');
    else opt.classList.remove('highlighted');
  });
}

// --- History ---
let currentHistory = []; // Now stores nested Problem objects: { name, number, ..., submissions: [] }

function migrateHistory(flat) {
  if (!Array.isArray(flat)) return [];
  if (flat.length > 0 && flat[0].submissions) return flat; // Already nested
  
  const nested = [];
  flat.forEach(item => {
    const key = item.number || item.name;
    let prob = nested.find(p => (p.number || p.name) === key);
    if (!prob) {
      prob = {
        name: item.name,
        number: item.number,
        url: item.url,
        difficulty: item.difficulty,
        tags: item.tags || [],
        submissions: []
      };
      nested.push(prob);
    }
    prob.submissions.push({
      status: item.status,
      timeStr: item.timeStr,
      elapsedMs: item.elapsedMs,
      timestamp: item.timestamp,
      notes: item.notes || ""
    });
  });
  // Sort problems by their most recent submission
  return nested.sort((a, b) => {
    const lastA = Math.max(...a.submissions.map(s => s.timestamp));
    const lastB = Math.max(...b.submissions.map(s => s.timestamp));
    return lastB - lastA;
  });
}

function getFlatHistory() {
  const flat = [];
  currentHistory.forEach(p => {
    p.submissions.forEach(s => {
      flat.push({
        ...p,
        ...s,
        submissions: undefined // Exclude the array from the flat objects
      });
    });
  });
  return flat.sort((a, b) => b.timestamp - a.timestamp);
}

async function logToHistory(prob, elapsed) {
  const d = await activeStorage.get('leetcode_history');
  let h = migrateHistory(d.leetcode_history || []);
  
  const key = prob.number || prob.name;
  let existingProb = h.find(p => (p.number || p.name) === key);
  
  const submission = {
    status: prob.status || "Completed",
    timeStr: formatTime(elapsed, true),
    elapsedMs: elapsed,
    timestamp: Date.now(),
    notes: prob.notes || ""
  };

  if (existingProb) {
    existingProb.submissions.unshift(submission);
    // Update master info in case it changed
    existingProb.url = prob.url || existingProb.url;
    existingProb.difficulty = prob.difficulty || existingProb.difficulty;
    existingProb.tags = [...new Set([...(existingProb.tags || []), ...(prob.tags || [])])];
  } else {
    h.unshift({
      name: prob.name,
      number: prob.number,
      url: prob.url,
      difficulty: prob.difficulty || "",
      tags: prob.tags || [],
      submissions: [submission]
    });
  }
  
  currentHistory = h;
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
async function renderHistory() { 
  const l = document.getElementById('log-list'), d = await activeStorage.get(['leetcode_history', 'problem_statuses', 'problem_status_colors']); 
  
  // MIGRATION: Convert to nested structure on load
  currentHistory = migrateHistory(d.leetcode_history || []); 
  
  problemStatuses = d.problem_statuses || DEFAULT_STATUSES;
  problemStatusColors = d.problem_status_colors || DEFAULT_COLORS;

  const filterContainer = document.getElementById('history-filter-container');
  if (filterContainer) {
    let filterDropdown = document.getElementById('history-status-filter-custom');
    if (filterDropdown) filterDropdown.remove();

    filterDropdown = createCustomDropdown(['All Statuses', ...problemStatuses], currentHistoryFilterStatus || 'All Statuses', (val) => {
      currentHistoryFilterStatus = val === 'All Statuses' ? '' : val;
      filterHistory();
    });
    filterDropdown.id = 'history-status-filter-custom';
    filterDropdown.style.width = '100%';
    filterContainer.appendChild(filterDropdown);

    let tagFilterDropdown = document.getElementById('history-tag-filter-custom');
    if (tagFilterDropdown) tagFilterDropdown.remove();

    // Extract all unique tags from nested problems
    const historyTags = [...new Set(currentHistory.flatMap(p => p.tags || []))].sort();
    
    tagFilterDropdown = createMultiSelectDropdown(historyTags, currentHistoryFilterTags, 'Filter by Tags', (vals) => {
      currentHistoryFilterTags = vals;
      filterHistory();
    });
    tagFilterDropdown.id = 'history-tag-filter-custom';
    tagFilterDropdown.style.width = '100%';
    const tagFilterContainer = document.getElementById('history-tag-filter-container');
    if (tagFilterContainer) tagFilterContainer.appendChild(tagFilterDropdown);
  }

  if (l) filterHistory(); 
}

function renderActiveTagFilters() {
  const container = document.getElementById('active-tag-filters');
  if (!container) return;
  container.replaceChildren();
  
  currentHistoryFilterTags.forEach(tag => {
    const badge = document.createElement('span');
    badge.className = 'tag-badge removable';
    badge.style.fontSize = '0.55em';
    badge.textContent = tag;
    badge.onclick = () => {
      currentHistoryFilterTags = currentHistoryFilterTags.filter(t => t !== tag);
      filterHistory();
      renderHistory(); // Refresh dropdown state
    };
    container.appendChild(badge);
  });
}

function filterHistory() {
  const l = document.getElementById('log-list'); if(!l) return;
  renderActiveTagFilters();
  const sEl = document.getElementById('history-search');
  const query = sEl ? sEl.value.toLowerCase() : "";
  const filterStatus = currentHistoryFilterStatus;
  const filterTags = currentHistoryFilterTags;

  const flatHistory = getFlatHistory();

  const filtered = flatHistory.filter(i => {
    const matchesQuery = i.name.toLowerCase().includes(query) || (i.number && i.number.toString().includes(query)) || (i.notes && i.notes.toLowerCase().includes(query)) || (i.status && i.status.toLowerCase().includes(query));
    const matchesStatus = !filterStatus || i.status === filterStatus;
    
    // Multi-tag matching (AND logic: must have all selected tags)
    const matchesTags = filterTags.length === 0 || filterTags.every(t => i.tags && i.tags.includes(t));
    
    return matchesQuery && matchesStatus && matchesTags;
  });
  l.replaceChildren();
  if (filtered.length === 0) { const msg = document.createElement('div'); msg.style.opacity = '0.5'; msg.style.padding = '10px'; msg.textContent = 'No results found.'; l.appendChild(msg); return; }
  const totalMs = filtered.reduce((s, i) => s + (i.elapsedMs || 0), 0);
  const summary = document.createElement('div'); summary.className = 'log-entry'; summary.style.padding = '8px'; summary.style.borderStyle = 'solid';
  summary.style.display = 'flex'; summary.style.justifyContent = 'space-between'; summary.style.fontSize = '0.8em';
  
  const totalCountSpan = document.createElement('span');
  totalCountSpan.className = 'log-summary-text';
  const countBold = document.createElement('b'); countBold.textContent = 'TOTAL: ';
  totalCountSpan.appendChild(countBold);
  totalCountSpan.appendChild(document.createTextNode(`${filtered.length} problems`));
  
  const totalTimeSpan = document.createElement('span');
  totalTimeSpan.className = 'log-summary-text';
  const timeBold = document.createElement('b'); timeBold.textContent = 'TIME: ';
  totalTimeSpan.appendChild(timeBold);
  totalTimeSpan.appendChild(document.createTextNode(formatTime(totalMs)));
  
  summary.appendChild(totalCountSpan);
  summary.appendChild(totalTimeSpan);
  l.appendChild(summary);

  filtered.forEach((i, idx) => {
    const fullDn = (i.number ? i.number + ". " : "") + i.name;
    let dn = fullDn; if (dn.length > 50) dn = dn.substring(0, 47) + "...";
    const dd = (val) => { const date = new Date(val); if (isNaN(date.getTime())) return "Unknown"; const now = new Date(); if (getDateKey(date) === getDateKey(now)) return "Today " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    
    const entry = document.createElement('div'); entry.className = 'log-entry';
    
    // Top Row: Title (Left) | Action Buttons (Right)
    const topRow = document.createElement('div');
    topRow.className = 'problem-top-row';
    
    const title = document.createElement('div');
    title.className = 'log-entry-title';
    title.title = fullDn;
    if (i.url) { const a = document.createElement('a'); a.href = i.url; a.target = '_blank'; a.textContent = dn; a.title = fullDn; title.appendChild(a); } else title.textContent = dn;
    
    const actionButtons = document.createElement('div');
    actionButtons.style.display = 'flex';
    actionButtons.style.gap = '4px';
    
    const notesBtn = document.createElement('button'); notesBtn.className = 'btn-small'; 
    notesBtn.textContent = i.notes ? 'EDIT' : 'ADD'; notesBtn.dataset.index = idx; notesBtn.dataset.action = 'toggle-history-notes';
    const tagBtn = document.createElement('button'); tagBtn.className = 'btn-small'; 
    tagBtn.textContent = i.showTags ? 'HIDE TAGS' : 'TAGS'; 
    tagBtn.dataset.index = idx; tagBtn.dataset.action = 'toggle-history-tags';
    const anaBtn = document.createElement('button'); anaBtn.className = 'btn-small'; anaBtn.textContent = '📊'; anaBtn.title = 'Analytics'; anaBtn.dataset.index = idx; anaBtn.dataset.action = 'history-analytics';
    const copyBtn = document.createElement('button'); copyBtn.className = 'btn-small'; copyBtn.textContent = 'CPY'; copyBtn.dataset.index = idx; copyBtn.dataset.action = 'copy-history-note';
    const delBtn = document.createElement('button'); delBtn.className = 'btn-small'; delBtn.textContent = 'X'; delBtn.dataset.index = idx; delBtn.dataset.action = 'delete-history';
    
    actionButtons.appendChild(notesBtn);
    actionButtons.appendChild(tagBtn);
    actionButtons.appendChild(anaBtn);
    actionButtons.appendChild(copyBtn);
    actionButtons.appendChild(delBtn);
    
    topRow.appendChild(title);
    topRow.appendChild(actionButtons);
    entry.appendChild(topRow);

    // Middle: Inline Tags (Conditional)
    if (i.showTags) {
      const tagList = document.createElement('div');
      tagList.className = 'tag-list-inline';
      tagList.style.marginBottom = '10px';
      tagList.style.marginTop = '-5px';
      if (i.tags && i.tags.length > 0) {
        i.tags.forEach(t => {
          const span = document.createElement('span');
          span.className = 'tag-badge';
          span.textContent = t;
          tagList.appendChild(span);
        });
      }
      const manageBtn = document.createElement('button');
      manageBtn.className = 'tag-badge';
      manageBtn.style.borderStyle = 'dashed';
      manageBtn.style.background = 'transparent';
      manageBtn.textContent = '+ MANAGE';
      manageBtn.dataset.index = idx;
      manageBtn.dataset.action = 'open-history-tag-modal';
      tagList.appendChild(manageBtn);
      
      entry.appendChild(tagList);
    }

    // Bottom Row: Status/Meta (Left) | Time/Date (Right)
    const bottomRow = document.createElement('div');
    bottomRow.className = 'problem-bottom-row';
    
    const metaGroup = document.createElement('div');
    metaGroup.className = 'meta-group';
    
    const statusDropdown = createCustomDropdown(problemStatuses, i.status || problemStatuses[0], async (val) => {
      // Find the specific problem and submission in the master nested data
      const masterProb = currentHistory.find(p => (p.number || p.name) === (i.number || i.name));
      if (masterProb) {
        const sub = masterProb.submissions.find(s => s.timestamp === i.timestamp);
        if (sub) {
          sub.status = val;
          await saveHistory();
          filterHistory(); 
        }
      }
    });
    
    if (i.difficulty) {
      const badge = document.createElement('span'); badge.className = 'difficulty-badge'; badge.textContent = i.difficulty;
      const d = i.difficulty.toLowerCase();
      if (d.includes('easy')) { badge.style.color = '#00af9b'; badge.style.borderColor = '#00af9b'; }
      else if (d.includes('medium')) { badge.style.color = '#ffb800'; badge.style.borderColor = '#ffb800'; }
      else if (d.includes('hard')) { badge.style.color = '#ff2d55'; badge.style.borderColor = '#ff2d55'; }
      metaGroup.appendChild(badge);
    }
    
    metaGroup.appendChild(statusDropdown);
    
    const timeDateGroup = document.createElement('div');
    timeDateGroup.style.display = 'flex';
    timeDateGroup.style.alignItems = 'center';
    timeDateGroup.style.gap = '10px';
    
    const timeSpan = document.createElement('span'); timeSpan.style.fontWeight = "bold"; timeSpan.style.color = "var(--green)"; timeSpan.textContent = i.timeStr;
    const dateSpan = document.createElement('span'); dateSpan.style.fontSize = "0.7em"; dateSpan.style.opacity = "0.6"; dateSpan.textContent = dd(i.timestamp);
    
    timeDateGroup.appendChild(timeSpan);
    timeDateGroup.appendChild(dateSpan);
    
    bottomRow.appendChild(metaGroup);
    bottomRow.appendChild(timeDateGroup);
    entry.appendChild(bottomRow);

    const notesSection = document.createElement('div'); notesSection.id = `history-notes-section-${idx}`; notesSection.style.display = 'none';
    const notesArea = document.createElement('textarea'); notesArea.className = 'notes-textarea'; notesArea.placeholder = 'Enter notes here...'; notesArea.value = i.notes || '';
    const autoExpand = (el) => { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; };
    notesArea.addEventListener('input', async (e) => { 
      const masterProb = currentHistory.find(p => (p.number || p.name) === (i.number || i.name));
      if (masterProb) {
        const sub = masterProb.submissions.find(s => s.timestamp === i.timestamp);
        if (sub) {
          sub.notes = e.target.value;
          autoExpand(e.target);
          await saveHistory();
        }
      }
    });
    
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
          
          // Column Mapping: 0:Number, 1:Name, 2:Difficulty, 3:Time, 4:Tags, 5:Notes, 6:URL, 7:ISO_Date
          const tags = clean[4] ? clean[4].split(';').map(t => t.trim()).filter(t => t !== "") : [];
          if (clean[7]) { const dParsed = new Date(clean[7]).getTime(); if (!isNaN(dParsed)) ts = dParsed; }
          
          logs.push({ 
            number: clean[0], 
            name: clean[1], 
            difficulty: clean[2], 
            timeStr: clean[3], 
            tags: tags,
            notes: clean[5] || "", 
            url: clean[6] || "", 
            timestamp: ts 
          });
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
  const canvas = document.getElementById('contributionHeatmap'), selector = document.getElementById('heatmap-year-selector'); 
  if (!canvas || !selector) return;
  const container = canvas.parentElement; if (!container) return;

  const years = [...new Set(logs.filter(l => l && l.timestamp).map(l => new Date(l.timestamp).getFullYear()))].sort((a,b) => b-a);
  const currentOptions = Array.from(selector.options).map(o => o.value);
  years.forEach(y => { if (!currentOptions.includes(y.toString())) { const opt = document.createElement('option'); opt.value = y; opt.textContent = y; selector.appendChild(opt); } });
  
  const ctx = canvas.getContext('2d');
  const dPR = window.devicePixelRatio || 1;
  
  // Calculate dynamic size
  const containerWidth = container.clientWidth - 16;
  const boxSize = Math.max(Math.floor((containerWidth - 50) / 54), 7);
  const gap = 2, weeks = 53, days = 7, topP = 15, leftP = 20;
  
  canvas.width = (leftP + (weeks * (boxSize + gap)) + 20) * dPR; 
  canvas.height = (topP + (days * (boxSize + gap))) * dPR;
  canvas.style.width = (canvas.width / dPR) + 'px';
  canvas.style.height = (canvas.height / dPR) + 'px';
  ctx.scale(dPR, dPR);

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
function formatDuration(ms) {
  if (!ms || ms < 0) return "0m";
  const hours = ms / (1000 * 60 * 60);
  if (hours >= 1) return hours.toFixed(1) + "h";
  const mins = Math.floor(ms / (1000 * 60));
  return mins + "m";
}

async function renderStats(includeCharts = true) {
  const d = await activeStorage.get(['leetcode_history', 'leetcode_problems', 'app_settings']), logs = d.leetcode_history || [], curr = d.leetcode_problems || [];
  if (d.app_settings) appSettings = { ...appSettings, ...d.app_settings };
  const isLight = document.body.classList.contains('light-mode'), mainGreen = isLight ? '#008000' : '#00ff00', gridColor = isLight ? 'rgba(0, 128, 0, 0.1)' : 'rgba(0, 255, 0, 0.1)';
  
  if (includeCharts) renderHeatmap(logs, isLight, mainGreen);
  
  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  logs.forEach(l => { if (l && l.difficulty) { const dL = l.difficulty.toLowerCase(); if (dL.includes('easy')) diffCounts.easy++; else if (dL.includes('medium')) diffCounts.medium++; else if (dL.includes('hard')) diffCounts.hard++; } });
  
  if (includeCharts) {
    const dCtx = document.getElementById('difficultyChart'); if (dCtx) { if (dChart) dChart.destroy(); dChart = new Chart(dCtx, { type: 'doughnut', data: { labels: ['Easy', 'Medium', 'Hard'], datasets: [{ data: [diffCounts.easy, diffCounts.medium, diffCounts.hard], backgroundColor: ['#00af9b', '#ffb800', '#ff2d55'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: isLight ? '#333' : '#fff', font: { size: 10 } } } } } }); }
  }

  const totalMs = logs.reduce((s, l) => s + (l ? (l.elapsedMs || parseTimeToMs(l.timeStr) || 0) : 0), 0);
  const tpEl = document.getElementById('total-problems'); if (tpEl) tpEl.textContent = logs.length;
  const ttsEl = document.getElementById('total-time-spent'); if (ttsEl) ttsEl.textContent = formatTime(totalMs);
  const todayK = getDateKey(new Date()), now = new Date(), startW = new Date(now.getTime() - 7 * 86400000), startM = new Date(now.getTime() - 30 * 86400000), thisY = now.getFullYear();
  
  // Calculate time from currently running problems
  const activeTimeMs = problems.reduce((s, p) => s + (p.isRunning ? (Date.now() - p.startTime) : p.elapsed), 0);

  const logsToday = logs.filter(l => getDateKey(l.timestamp) === todayK);
  const solvedToday = logsToday.length;
  const stEl = document.getElementById('stat-today'); if (stEl) stEl.textContent = solvedToday;
  const ttEl = document.getElementById('time-today'); if (ttEl) ttEl.textContent = formatDuration(logsToday.reduce((s, l) => s + (l.elapsedMs || 0), 0) + activeTimeMs);

  const logsWeek = logs.filter(l => l.timestamp > startW.getTime());
  const swEl = document.getElementById('stat-week'); if (swEl) swEl.textContent = logsWeek.length;
  const twEl = document.getElementById('time-week'); if (twEl) twEl.textContent = formatDuration(logsWeek.reduce((s, l) => s + (l.elapsedMs || 0), 0) + activeTimeMs);

  const logsMonth = logs.filter(l => l.timestamp > startM.getTime());
  const smEl = document.getElementById('stat-month'); if (smEl) smEl.textContent = logsMonth.length;
  const tmEl = document.getElementById('time-month'); if (tmEl) tmEl.textContent = formatDuration(logsMonth.reduce((s, l) => s + (l.elapsedMs || 0), 0) + activeTimeMs);

  const syEl = document.getElementById('stat-year'); if (syEl) syEl.textContent = logs.filter(l => new Date(l.timestamp).getFullYear() === thisY).length;
  
  const totalMsFromLogs = logs.reduce((s, l) => s + (l.elapsedMs || 0), 0);
  const taEl = document.getElementById('time-all'); if (taEl) taEl.textContent = formatDuration(totalMsFromLogs + activeTimeMs);
  
  const csEl = document.getElementById('current-streak'); if (csEl) {
    const daysArr = [...new Set(logs.filter(l => l && l.timestamp).map(l => getDateKey(l.timestamp)))].filter(k => k !== "").sort((a,b) => b.localeCompare(a));
    let streak = 0; if (daysArr.length > 0) {
      let c = new Date(); c.setHours(0,0,0,0); if (daysArr[0] === getDateKey(c) || daysArr[0] === getDateKey(new Date(c.getTime() - 86400000))) {
        let curC = (daysArr[0] === getDateKey(c)) ? c : new Date(c.getTime() - 86400000); for (let day of daysArr) { if (day === getDateKey(curC)) { streak++; curC.setDate(curC.getDate() - 1); } else break; }
      }
    }
    csEl.textContent = streak;
    if (appSettings.dailyGoal > 0) {
      const goalLabel = document.querySelector('#current-streak + .stat-label');
      if (goalLabel) goalLabel.textContent = `Goal: ${solvedToday}/${appSettings.dailyGoal}`;
    }
  }

  if (includeCharts) {
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

  // Tag Distribution List (Always visible in stats tab)
  const tagCounts = {};
  logs.forEach(l => {
    if (l.tags && Array.isArray(l.tags)) {
      l.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    }
  });
  
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const tagStatsList = document.getElementById('tag-stats-list');
  
  if (tagStatsList) {
    tagStatsList.replaceChildren();
    if (sortedTags.length === 0) {
      const msg = document.createElement('div');
      msg.style.opacity = '0.5';
      msg.style.fontSize = '0.75em';
      msg.textContent = 'No tags used yet.';
      tagStatsList.appendChild(msg);
    } else {
      sortedTags.forEach(([tag, count]) => {
        const badge = document.createElement('span');
        badge.className = 'tag-badge';
        badge.style.cursor = 'pointer';
        badge.innerHTML = `${tag} <span style="opacity:0.6; margin-left:4px;">(${count})</span>`;
        badge.title = `Click to see all ${tag} problems`;
        badge.onclick = () => {
          // 1. Set the global tag filter (reset to just this one for quick drill-down)
          currentHistoryFilterTags = [tag];
          
          // 2. Switch to Log tab
          const logBtn = document.querySelector('.tab-btn[data-tab="log"]');
          if (logBtn) logBtn.click();
          
          // 3. Clear search input to avoid conflicts
          const searchInp = document.getElementById('history-search');
          if (searchInp) searchInp.value = '';
          
          // 4. Trigger filter
          filterHistory();
          renderHistory();
        };
        tagStatsList.appendChild(badge);
      });
    }
  }
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
  const themeBtn = document.getElementById('theme-toggle'); 
  if(themeBtn) themeBtn.addEventListener('click', async () => { 
    document.body.classList.toggle('light-mode'); 
    await activeStorage.set({ theme: document.body.classList.contains('light-mode') ? 'light' : 'dark' }); 
    renderStats(); 
    renderProblems();
    renderHistory();
    renderStatuses();
  });
  const expandBtn = document.getElementById('expand-page-btn'); 
  if(expandBtn) expandBtn.addEventListener('click', () => { 
    api.tabs.create({ url: api.runtime.getURL('popup.html?full=1') }); 
    window.close(); // Close the popup after opening the full page
  });
  const historySearch = document.getElementById('history-search'); if(historySearch) historySearch.addEventListener('input', filterHistory);
  
  const goToSettings = document.getElementById('go-to-settings-link');
  if (goToSettings) {
    goToSettings.addEventListener('click', (e) => {
      e.preventDefault();
      const settingsBtn = document.querySelector('.tab-btn[data-tab="settings"]');
      if (settingsBtn) settingsBtn.click();
    });
  }
  
  const tStart = document.getElementById('timer-start'); if(tStart) tStart.addEventListener('click', async () => { const m = parseInt(document.getElementById('timer-input').value) || 0; if (m > 0) { timerTargetTime = Date.now() + m * 60 * 1000; await activeStorage.set({ timer_target: timerTargetTime }); if(api.alarms) api.alarms.create('timer-finished', { when: timerTargetTime }); startTimerUI(); } });
  const tPause = document.getElementById('timer-pause'); if(tPause) tPause.addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); });
  const tReset = document.getElementById('timer-reset'); if(tReset) tReset.addEventListener('click', () => { clearInterval(timerInterval); if(api.alarms) api.alarms.clear('timer-finished'); activeStorage.set({ timer_target: 0 }); const d = document.getElementById('timer-display'); if(d) d.textContent = '00:00:00.00'; });
  
  const sStart = document.getElementById('sw-start'); if(sStart) sStart.addEventListener('click', async () => { if (swInterval) return; swStartTime = Date.now() - swElapsedTime; await activeStorage.set({ sw_is_running: true, sw_start_time: swStartTime }); startStandaloneSwUI(); });
  const sPause = document.getElementById('sw-pause'); if(sPause) sPause.addEventListener('click', async () => { if (swInterval) { clearInterval(swInterval); swInterval = null; } swElapsedTime = Date.now() - swStartTime; await activeStorage.set({ sw_is_running: false, sw_elapsed: swElapsedTime }); updateSwDisplay(); });
  const sReset = document.getElementById('sw-reset'); if(sReset) sReset.addEventListener('click', async () => { clearInterval(swInterval); swInterval = null; swElapsedTime = 0; await activeStorage.set({ sw_is_running: false, sw_elapsed: 0 }); updateSwDisplay(); });
  
  document.querySelectorAll('.preset-card').forEach(btn => btn.addEventListener('click', () => { const inp = document.getElementById('timer-input'); if(inp) inp.value = btn.dataset.time; }));
  const tInc = document.getElementById('timer-inc'); if(tInc) tInc.addEventListener('click', () => { const inp = document.getElementById('timer-input'); if(inp) inp.value = parseInt(inp.value || 0) + 1; });
  const tDec = document.getElementById('timer-dec'); if(tDec) tDec.addEventListener('click', () => { const inp = document.getElementById('timer-input'); if(inp) { const v = parseInt(inp.value || 0); if (v > 1) inp.value = v - 1; } });
  
  const addProbBtn = document.getElementById('add-problem');
  const addProblem = async () => {
    const nEl = document.getElementById('new-problem-name');
    if(!nEl) return;
    const name = nEl.value.trim();
    if (name) {
      let fn = name, fnum = detectedDetails ? detectedDetails.number : "", furl = detectedDetails ? detectedDetails.url : "", fdiff = detectedDetails ? detectedDetails.difficulty : "", ftags = detectedDetails ? detectedDetails.tags : [];
      if (fnum && name.startsWith(fnum + ". ")) fn = name.replace(fnum + ". ", "");
      
      // Centralized Meta: Check if we have tags for this problem already
      const metaKey = fnum || fn;
      const existingMeta = problemMetadata[metaKey] || {};
      const mergedTags = [...new Set([...(ftags || []), ...(existingMeta.tags || [])])];
      const initialStatus = appSettings.autoStart ? 'Started' : problemStatuses[0];
      
      problems.push({ name: fn, number: fnum, url: furl, difficulty: fdiff, elapsed: 0, isRunning: appSettings.autoStart, startTime: appSettings.autoStart ? Date.now() : 0, notes: "", status: initialStatus, showNotes: false, tags: mergedTags });
      
      // Auto-add detected tags to global library AND problem metadata
      if (mergedTags.length > 0) {
        let updatedLib = false;
        mergedTags.forEach(t => { if (!globalTags.includes(t)) { globalTags.push(t); updatedLib = true; } });
        if (updatedLib) { globalTags.sort(); activeStorage.set({ global_tags: globalTags }); }
        
        problemMetadata[metaKey] = { tags: mergedTags };
        activeStorage.set({ problem_metadata: problemMetadata });
      }
      nEl.value = '';
      detectedDetails = null;
      await saveProblems();
      renderProblems();
      startUIInterval();
    }
  };
  if(addProbBtn) addProbBtn.addEventListener('click', addProblem);
  
  const probNameInput = document.getElementById('new-problem-name');
  if(probNameInput) probNameInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') addProblem(); });
  const probCont = document.getElementById('problems-container'); if(probCont) probCont.addEventListener('click', async (e) => { const action = e.target.dataset.action, i = parseInt(e.target.dataset.index); if (action === undefined || isNaN(i)) return; const p = problems[i]; if (action === 'toggle') { if (p.isRunning) { p.elapsed = Date.now() - p.startTime; p.isRunning = false; } else { p.startTime = Date.now() - p.elapsed; p.isRunning = true; } } else if (action === 'reset') { p.elapsed = 0; p.isRunning = false; } else if (action === 'delete') problems.splice(i, 1); else if (action === 'finish') { const f = p.isRunning ? (Date.now() - p.startTime) : p.elapsed; await logToHistory(p, f); problems.splice(i, 1); } else if (action === 'analytics') showProblemAnalytics(p.name, p.number); else if (action === 'toggle-tags') p.showTags = !p.showTags; else if (action === 'open-tag-modal') openTagModal('active', i); else if (action === 'toggle-notes') p.showNotes = !p.showNotes; await saveProblems(); renderProblems(); if (action === 'toggle-notes' && p && p.showNotes) { const ta = document.querySelector(`#notes-section-${i} textarea`); if (ta) ta.focus(); } startUIInterval(); });
  
  const importBtn = document.getElementById('import-btn'); 
  if(importBtn) {
    importBtn.addEventListener('click', () => { 
      if (window.location.search.indexOf('full=1') === -1 && window.innerWidth < 500) {
        // We are in popup mode, must open full page to prevent auto-close
        api.tabs.create({ url: api.runtime.getURL('popup.html?full=1&action=restore') });
      } else {
        const f = document.getElementById('import-file'); 
        if(f) f.click(); 
      }
    });
  }
  const importFile = document.getElementById('import-file'); if(importFile) importFile.addEventListener('change', (e) => { 
    const file = e.target.files[0]; if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = (ev) => { 
      handleRestore(ev.target.result, file.name.endsWith('.csv')); 
      e.target.value = ''; 
    }; 
    reader.readAsText(file); 
  });
  const exportJson = document.getElementById('export-json');
  if(exportJson) {
    exportJson.addEventListener('click', async () => { 
      const originalText = exportJson.textContent;
      exportJson.textContent = 'EXPORTING...';
      try {
        const data = await activeStorage.get(null); 
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `green_timer_backup_${new Date().toISOString().split('T')[0]}.json`; 
        document.body.appendChild(a);
        a.click();
        
        // Delay cleanup to ensure download starts
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          exportJson.textContent = originalText;
        }, 1000);
      } catch (e) {
        exportJson.textContent = 'ERROR!';
        setTimeout(() => { exportJson.textContent = originalText; }, 2000);
      }
    });
  }

  const exportCsv = document.getElementById('export-csv');
  if(exportCsv) {
    exportCsv.addEventListener('click', async () => { 
      const originalText = exportCsv.textContent;
      exportCsv.textContent = 'EXPORTING...';
      try {
        const d = await activeStorage.get('leetcode_history'), h = d.leetcode_history || []; 
        if (h.length === 0) {
          exportCsv.textContent = 'EMPTY!';
          setTimeout(() => { exportCsv.textContent = originalText; }, 2000);
          return;
        }
        let csv = 'Number,Name,Difficulty,Time,Tags,Notes,URL,ISO_Date,Local_Time\n';
        h.forEach(i => {
          const dt = new Date(i.timestamp), sn = (i.notes || "").replace(/"/g, '""');
          const st = (i.tags || []).join('; ').replace(/"/g, '""');
          csv += `"${i.number}","${i.name}","${i.difficulty || ""}","${i.timeStr}","${st}","${sn}","${i.url}","${dt.toISOString()}","${dt.toLocaleString()}"\n`;
        });        const b = new Blob([csv], { type: 'text/csv' }), u = URL.createObjectURL(b), a = document.createElement('a'); 
        a.href = u; a.download = 'leetcode_study_logs.csv'; 
        document.body.appendChild(a);
        a.click(); 
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(u);
          exportCsv.textContent = originalText;
        }, 1000);
      } catch (e) {
        exportCsv.textContent = 'ERROR!';
        setTimeout(() => { exportCsv.textContent = originalText; }, 2000);
      }
    });
  }
  const hYearSel = document.getElementById('heatmap-year-selector'); if(hYearSel) hYearSel.addEventListener('change', (e) => { selectedHeatmapYear = e.target.value; renderStats(); });
  
  // Advanced Setting Listeners
  const defaultTimeInp = document.getElementById('setting-default-time');
  if (defaultTimeInp) defaultTimeInp.addEventListener('change', (e) => { appSettings.defaultTime = parseInt(e.target.value) || 25; saveSettings(); applySettingsToUI(); });
  
  document.querySelectorAll('.preset-setting').forEach((inp, idx) => {
    inp.addEventListener('change', (e) => { appSettings.presets[idx] = parseInt(e.target.value) || appSettings.presets[idx]; saveSettings(); applySettingsToUI(); });
  });
  
  const soundInp = document.getElementById('setting-sound-enabled');
  if (soundInp) soundInp.addEventListener('change', (e) => { appSettings.soundEnabled = e.target.checked; saveSettings(); });
  
  const autoAddInp = document.getElementById('setting-auto-add');
  if (autoAddInp) autoAddInp.addEventListener('change', (e) => { appSettings.autoAdd = e.target.checked; saveSettings(); });
  
  const autoStartInp = document.getElementById('setting-auto-start');
  if (autoStartInp) autoStartInp.addEventListener('change', (e) => { appSettings.autoStart = e.target.checked; saveSettings(); });
  
  const dailyGoalInp = document.getElementById('setting-daily-goal');
  if (dailyGoalInp) dailyGoalInp.addEventListener('change', (e) => { appSettings.dailyGoal = parseInt(e.target.value) || 3; saveSettings(); if (document.getElementById('stats').classList.contains('active')) renderStats(); });

  const factoryResetBtn = document.getElementById('factory-reset');
  if (factoryResetBtn) factoryResetBtn.addEventListener('click', async () => {
    if (confirm('FACTORY RESET? This will clear ALL data, history, and settings forever.')) {
      await activeStorage.clear();
      window.location.reload();
    }
  });

  const addStatusBtn = document.getElementById('add-status');
  const addTagBtn = document.getElementById('add-tag-btn');
  const newTagNameInput = document.getElementById('new-tag-name');

  if (addTagBtn && newTagNameInput) {
    const list = document.getElementById('settings-tag-autocomplete');
    
    const filterSettingsTags = () => {
      const val = newTagNameInput.value.toLowerCase().trim();
      list.replaceChildren();
      tagAutocompleteIdx = -1;
      
      let matches = [];
      if (!val) {
        matches = globalTags.slice(0, 15);
      } else {
        matches = globalTags.filter(t => t.toLowerCase().includes(val)).slice(0, 10);
      }
      
      if (matches.length > 0) {
        matches.forEach((m, i) => {
          const opt = document.createElement('div');
          opt.className = 'dropdown-option';
          opt.textContent = m;
          opt.onclick = () => {
            newTagNameInput.value = m;
            list.classList.remove('show');
            newTagNameInput.focus();
          };
          opt.onmouseenter = () => {
            tagAutocompleteIdx = i;
            updateAutocompleteHighlight(list);
          };
          list.appendChild(opt);
        });
        list.classList.add('show');
      } else {
        list.classList.remove('show');
      }
    };

    const addTag = async () => {
      const name = newTagNameInput.value.trim();
      if (!name) return;
      
      // Case-insensitive duplicate check
      const exists = globalTags.some(t => t.toLowerCase() === name.toLowerCase());
      
      if (!exists) {
        globalTags.push(name);
        globalTags.sort();
        newTagNameInput.value = '';
        list.classList.remove('show');
        await saveSettingsTags();
        renderSettingsTags();
      } else {
        // Highlight it or just clear
        newTagNameInput.value = '';
        list.classList.remove('show');
      }
    };

    addTagBtn.addEventListener('click', addTag);
    newTagNameInput.addEventListener('keydown', (e) => { 
      const options = list.querySelectorAll('.dropdown-option');
      if (e.key === 'ArrowDown' && list.classList.contains('show')) {
        e.preventDefault();
        tagAutocompleteIdx = Math.min(tagAutocompleteIdx + 1, options.length - 1);
        updateAutocompleteHighlight(list);
      } else if (e.key === 'ArrowUp' && list.classList.contains('show')) {
        e.preventDefault();
        tagAutocompleteIdx = Math.max(tagAutocompleteIdx - 1, 0);
        updateAutocompleteHighlight(list);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (tagAutocompleteIdx >= 0 && options[tagAutocompleteIdx]) {
          options[tagAutocompleteIdx].click();
        } else {
          addTag();
        }
      } else if (e.key === 'Escape') {
        list.classList.remove('show');
      }
    });
    
    newTagNameInput.addEventListener('input', filterSettingsTags);
    newTagNameInput.addEventListener('focus', filterSettingsTags);
  }

  const toggleAddStatusBtn = document.getElementById('toggle-add-status');
  const addStatusContainer = document.getElementById('add-status-container');
  const toggleStatusListBtn = document.getElementById('toggle-status-list');
  const statusList = document.getElementById('status-list');

  if (toggleAddStatusBtn && addStatusContainer) {
    toggleAddStatusBtn.addEventListener('click', () => {
      const isHidden = addStatusContainer.style.display === 'none';
      addStatusContainer.style.display = isHidden ? 'block' : 'none';
      toggleAddStatusBtn.textContent = isHidden ? '✕ CLOSE' : '+ ADD NEW';
    });
  }

  if (toggleStatusListBtn && statusList) {
    toggleStatusListBtn.addEventListener('click', () => {
      const isHidden = statusList.style.display === 'none';
      statusList.style.display = isHidden ? 'flex' : 'none';
      toggleStatusListBtn.textContent = isHidden ? '✕ HIDE LIST' : 'VIEW LIST';
    });
  }

  const toggleAddTagBtn = document.getElementById('toggle-add-tag');
  const addTagContainer = document.getElementById('add-tag-container');
  const toggleTagListBtn = document.getElementById('toggle-tag-list');
  const tagList = document.getElementById('settings-tag-list');

  if (toggleAddTagBtn && addTagContainer) {
    toggleAddTagBtn.addEventListener('click', () => {
      const isHidden = addTagContainer.style.display === 'none';
      addTagContainer.style.display = isHidden ? 'block' : 'none';
      toggleAddTagBtn.textContent = isHidden ? '✕ CLOSE' : '+ ADD NEW';
    });
  }

  if (toggleTagListBtn && tagList) {
    toggleTagListBtn.addEventListener('click', () => {
      const isHidden = tagList.style.display === 'none';
      tagList.style.display = isHidden ? 'flex' : 'none';
      toggleTagListBtn.textContent = isHidden ? '✕ HIDE LIST' : 'VIEW LIST';
    });
  }

  if (addStatusBtn) {
    const input = document.getElementById('new-status-name');
    const colorInput = document.getElementById('new-status-color');
    
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addStatusBtn.click();
        }
      });
    }

    if (colorInput) {
      colorInput.addEventListener('input', (e) => {
        input.style.color = e.target.value;
        input.style.borderColor = e.target.value;
        colorInput.style.border = '1px solid ' + e.target.value;
      });
    }

    addStatusBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      const color = colorInput.value;
      if (name) {
        problemStatuses.push(name);
        problemStatusColors[name] = color;
        input.value = '';
        input.style.color = ''; // Reset to default
        input.style.borderColor = '';
        colorInput.value = '#00ff00';
        colorInput.style.border = '';
        saveStatuses();
        renderStatuses();
        renderHistory(); // Update history filter
        renderProblems(); // Update active dropdowns
        
        // Hide container and show list after adding
        if (addStatusContainer) {
          addStatusContainer.style.display = 'none';
          if (toggleAddStatusBtn) toggleAddStatusBtn.textContent = '+ ADD NEW';
        }
        if (statusList) {
          statusList.style.display = 'flex';
          if (toggleStatusListBtn) toggleStatusListBtn.textContent = '✕ HIDE LIST';
        }
      }
    });
  }

  const clearLog = document.getElementById('clear-log'); if(clearLog) clearLog.addEventListener('click', async () => { if (confirm('Clear history?')) { await activeStorage.set({ leetcode_history: [] }); renderHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats(); } });

  const logList = document.getElementById('log-list'); if(logList) logList.addEventListener('click', async (e) => {
    const action = e.target.dataset.action, idx = parseInt(e.target.dataset.index);
    if (!action || isNaN(idx)) return;
    
    // The index refers to the 'filtered' list in filterHistory()
    // We need to find the specific submission in the master data
    const sEl = document.getElementById('history-search');
    const query = sEl ? sEl.value.toLowerCase() : "";
    const filterStatus = currentHistoryFilterStatus;
    const filterTags = currentHistoryFilterTags;
    
    const flatHistory = getFlatHistory();
    const filtered = flatHistory.filter(i => {
      const matchesQuery = i.name.toLowerCase().includes(query) || (i.number && i.number.toString().includes(query)) || (i.notes && i.notes.toLowerCase().includes(query)) || (i.status && i.status.toLowerCase().includes(query));
      const matchesStatus = !filterStatus || i.status === filterStatus;
      const matchesTags = filterTags.length === 0 || filterTags.every(t => i.tags && i.tags.includes(t));
      return matchesQuery && matchesStatus && matchesTags;
    });

    const entry = filtered[idx];
    if (!entry) return;

    if (action === 'delete-history') {
      if (confirm('Delete this attempt?')) {
        const masterProb = currentHistory.find(p => (p.number || p.name) === (entry.number || entry.name));
        if (masterProb) {
          masterProb.submissions = masterProb.submissions.filter(s => s.timestamp !== entry.timestamp);
          // If no submissions left, remove the problem entirely
          if (masterProb.submissions.length === 0) {
            currentHistory = currentHistory.filter(p => (p.number || p.name) !== (entry.number || entry.name));
          }
          await saveHistory();
          filterHistory(); if (document.getElementById('stats').classList.contains('active')) renderStats();
        }
      }
    } else if (action === 'copy-history-note') {
      if (entry.notes) {
        navigator.clipboard.writeText(entry.notes).then(() => {
          const ot = e.target.textContent; e.target.textContent = 'COPIED!';
          setTimeout(() => e.target.textContent = ot, 1500);
        });
      }
    } else if (action === 'history-analytics') {
      showProblemAnalytics(entry.name, entry.number);
    } else if (action === 'toggle-history-tags') {
      // Tags are at problem level now
      const masterProb = currentHistory.find(p => (p.number || p.name) === (entry.number || entry.name));
      if (masterProb) {
        masterProb.showTags = !masterProb.showTags;
        await saveHistory();
        filterHistory();
      }
    } else if (action === 'open-history-tag-modal') {
      // Find index in master currentHistory for openTagModal
      const masterIdx = currentHistory.findIndex(p => (p.number || p.name) === (entry.number || entry.name));
      if (masterIdx !== -1) {
        taggingContext = { type: 'history', index: masterIdx };
        openTagModal('history', masterIdx);
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
  await initTheme(); await loadProblems(); await initTimers(); requestLeetCodeTitle(); await renderHistory(); await restoreLastTab();

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-options.show').forEach(m => m.classList.remove('show'));
  });

  if (window.location.search.indexOf('full=1') !== -1 || window.innerWidth > 500) {
    document.body.classList.add('full-page');
  }

  // Handle auto-restore action from URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'restore') {
    setTimeout(() => {
      const f = document.getElementById('import-file');
      if(f) f.click();
    }, 500);
  }

  // Analytics Modal Close
  const closeAna = document.getElementById('close-analytics');
  if (closeAna) {
    closeAna.addEventListener('click', () => {
      document.getElementById('analytics-modal').classList.remove('show');
    });
  }

  // Tag Modal Listeners
  const closeTag = document.getElementById('close-tag-modal');
  if (closeTag) closeTag.addEventListener('click', () => document.getElementById('tag-modal').classList.remove('show'));
  
  const tagInput = document.getElementById('tag-autocomplete-input');
  if (tagInput) {
    tagInput.addEventListener('input', filterTagAutocomplete);
    tagInput.addEventListener('focus', filterTagAutocomplete);
    tagInput.addEventListener('click', filterTagAutocomplete);
    tagInput.addEventListener('keydown', (e) => {
      const list = document.getElementById('tag-autocomplete-list');
      const options = list.querySelectorAll('.dropdown-option');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        tagAutocompleteIdx = Math.min(tagAutocompleteIdx + 1, options.length - 1);
        updateAutocompleteHighlight(list);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        tagAutocompleteIdx = Math.max(tagAutocompleteIdx - 1, 0);
        updateAutocompleteHighlight(list);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (tagAutocompleteIdx >= 0 && options[tagAutocompleteIdx]) {
          options[tagAutocompleteIdx].click();
        }
      } else if (e.key === 'Tab' && options.length > 0) {
        e.preventDefault();
        tagAutocompleteIdx = (tagAutocompleteIdx + 1) % options.length;
        updateAutocompleteHighlight(list);
      } else if (e.key === 'Escape') {
        list.classList.remove('show');
      }
    });
  }

  window.addEventListener('click', (e) => {
    const anaModal = document.getElementById('analytics-modal');
    const tagModal = document.getElementById('tag-modal');
    if (e.target === anaModal) anaModal.classList.remove('show');
    if (e.target === tagModal) tagModal.classList.remove('show');
    
    if (e.target !== tagInput) {
      const list = document.getElementById('tag-autocomplete-list');
      if (list) list.classList.remove('show');
    }
    
    const settingsTagInput = document.getElementById('new-tag-name');
    if (e.target !== settingsTagInput) {
      const list = document.getElementById('settings-tag-autocomplete');
      if (list) list.classList.remove('show');
    }
  });
});
