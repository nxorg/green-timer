/*
 * Green Timer & Stopwatch
 * Copyright (C) 2026 Manoj Kumar
 * GPLv3 License
 */

// Efficient LeetCode Detection using MutationObserver
function getLeetCodeDetails() {
  const selectors = [
    'div[data-cy="question-title"]',
    '.text-title-large',
    '.css-v3d350',
    'h4',
    '.question-title'
  ];

  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl && titleEl.innerText.trim()) break;
  }
  
  if (!titleEl) return null;

  let fullTitle = titleEl.innerText.trim();
  fullTitle = fullTitle.replace(/\s+/g, ' ');

  let number = "";
  let name = fullTitle;

  const match = fullTitle.match(/^#?(\d+)[\.\s]+(.*)/);
  if (match) {
    number = match[1];
    name = match[2].trim();
  } else if (fullTitle.includes('. ')) {
    const parts = fullTitle.split('. ');
    number = parts[0];
    name = parts.slice(1).join('. ');
  }

  if (!number) {
    const docTitle = document.title;
    const docMatch = docTitle.match(/^#?(\d+)[\.\s]+(.*)/);
    if (docMatch) number = docMatch[1];
  }

  let difficulty = "";
  const diffEl = document.querySelector('div[class*="text-difficulty-"], [class*="difficulty"]');
  if (diffEl) {
    difficulty = diffEl.innerText.trim();
  } else {
    const easy = document.querySelector('.text-easy');
    const medium = document.querySelector('.text-medium');
    const hard = document.querySelector('.text-hard');
    if (easy) difficulty = "Easy";
    else if (medium) difficulty = "Medium";
    else if (hard) difficulty = "Hard";
  }

  let tags = [];
  try {
    const tagEls = document.querySelectorAll('a[href^="/tag/"]');
    if (tagEls && tagEls.length > 0) {
      tags = Array.from(tagEls).map(el => el.innerText.trim()).filter(t => t !== "");
    } else {
      const container = document.querySelector('div[data-key="topic-tags"]');
      if (container) tags = Array.from(container.querySelectorAll('a')).map(el => el.innerText.trim()).filter(t => t !== "");
    }
  } catch (e) { console.error("Green Timer: Tag detection error", e); }

  return { number, name, difficulty, url: window.location.href.split('?')[0].split('#')[0], tags };
}

// --- Floating HUD ---
let hudElement = null;
let hudInterval = null;
let isDragging = false;

function createHUD() {
  if (hudElement) return;
  
  hudElement = document.createElement('div');
  hudElement.id = 'green-timer-hud';
  hudElement.style.cssText = `
    position: fixed; top: 60px; right: 20px;
    background: rgba(10, 10, 10, 0.9); border: 1px solid #00ff00;
    color: #00ff00; padding: 8px 12px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 14px; font-weight: bold; z-index: 999999;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.2);
    cursor: move; user-select: none; display: none; align-items: center; gap: 10px;
  `;

  const timeSpan = document.createElement('span');
  timeSpan.id = 'gt-hud-time';
  timeSpan.textContent = '00:00:00';
  
  const statusDot = document.createElement('div');
  statusDot.id = 'gt-hud-dot';
  statusDot.style.width = '8px'; statusDot.style.height = '8px';
  statusDot.style.borderRadius = '50%'; statusDot.style.background = '#00ff00';
  statusDot.style.boxShadow = '0 0 5px #00ff00';

  const controlBtn = document.createElement('div');
  controlBtn.id = 'gt-hud-control';
  controlBtn.textContent = 'PAUSE';
  controlBtn.style.cssText = `
    cursor: pointer; font-size: 10px; padding: 2px 6px;
    border: 1px solid #00ff00; border-radius: 2px;
    margin-left: 5px; background: rgba(0,255,0,0.1);
  `;
  controlBtn.onclick = (e) => {
    e.stopPropagation();
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    const details = getLeetCodeDetails();
    chrome.storage.local.get(['leetcode_problems'], (data) => {
      const problems = data.leetcode_problems || [];
      const idx = problems.findIndex(p => {
        if (details) {
          if (p.number && details.number && p.number === details.number) return true;
          if (p.name && details.name && p.name === details.name) return true;
        }
        return p.url === currentUrl;
      });
      if (idx !== -1) {
        const p = problems[idx];
        if (p.isRunning) {
          p.elapsed = Date.now() - p.startTime;
          p.isRunning = false;
        } else {
          p.startTime = Date.now() - p.elapsed;
          p.isRunning = true;
        }
        chrome.storage.local.set({ leetcode_problems: problems });
      }
    });
  };

  const toggleBtn = document.createElement('div');
  toggleBtn.id = 'gt-hud-toggle';
  toggleBtn.innerHTML = '«';
  toggleBtn.style.cssText = `
    cursor: pointer; opacity: 0.7; font-size: 16px; line-height: 1;
    padding: 2px 5px; border-left: 1px solid rgba(0,255,0,0.2); margin-left: 5px;
  `;
  toggleBtn.title = "Collapse HUD";
  
  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    chrome.storage.local.get('app_settings', (d) => {
      const s = d.app_settings || {};
      s.hudCollapsed = !s.hudCollapsed;
      chrome.storage.local.set({ app_settings: s });
    });
  };
hudElement.appendChild(statusDot);
hudElement.appendChild(timeSpan);
hudElement.appendChild(controlBtn);
hudElement.appendChild(toggleBtn);
document.body.appendChild(hudElement);

// --- High-Performance Draggable Logic ---
let startX, startY, initialLeft, initialTop;
hudElement.addEventListener('mousedown', (e) => {
  // Only drag if not clicking the control or toggle buttons
  if (e.target.id === 'gt-hud-control' || e.target.id === 'gt-hud-toggle') return;

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;

  const rect = hudElement.getBoundingClientRect();
  initialLeft = rect.left;
  initialTop = rect.top;

  hudElement.style.transition = 'none';
  hudElement.style.opacity = '0.8';

  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  requestAnimationFrame(() => {
    hudElement.style.left = (initialLeft + dx) + 'px';
    hudElement.style.top = (initialTop + dy) + 'px';
    hudElement.style.right = 'auto';
  });
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    hudElement.style.opacity = '0.9';

    // Save position
    const pos = { top: hudElement.style.top, left: hudElement.style.left };
    chrome.storage.local.get('app_settings', (d) => {
      const s = d.app_settings || {};
      s.hudPos = pos;
      chrome.storage.local.set({ app_settings: s });
    });
  }
});
}

function updateHUD() {
  const currentDetails = getLeetCodeDetails();
  if (hudInterval) { clearInterval(hudInterval); hudInterval = null; }
  chrome.storage.local.get(['leetcode_problems', 'app_settings'], (data) => {
    const settings = data.app_settings || {};
    const problems = data.leetcode_problems || [];
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    
    // Smart Matching: 
    // 1. Try to match by Number/Name first (most reliable)
    // 2. Fallback to URL match
    const activeProb = problems.find(p => {
      if (currentDetails) {
        if (p.number && currentDetails.number && p.number === currentDetails.number) return true;
        if (p.name && currentDetails.name && p.name === currentDetails.name) return true;
      }
      return p.url === currentUrl;
    });
    
    if (activeProb && settings.showHUD !== false) {
      if (!hudElement) createHUD();
      
      const timeEl = document.getElementById('gt-hud-time');
      const dotEl = document.getElementById('gt-hud-dot');
      const toggleEl = document.getElementById('gt-hud-toggle');
      const controlEl = document.getElementById('gt-hud-control');
      if (!timeEl || !dotEl || !toggleEl || !controlEl) return;

      // Update Control Button and Dot
      controlEl.textContent = activeProb.isRunning ? 'PAUSE' : 'START';
      dotEl.style.background = activeProb.isRunning ? '#00ff00' : '#555';
      dotEl.style.boxShadow = activeProb.isRunning ? '0 0 5px #00ff00' : 'none';

      // Apply saved position if exists AND not currently dragging
      if (settings.hudPos && !isDragging) {
        hudElement.style.top = settings.hudPos.top;
        hudElement.style.left = settings.hudPos.left;
        hudElement.style.right = 'auto';
      }

      // Handle Collapse State
      if (settings.hudCollapsed) {
        timeEl.style.display = 'none';
        dotEl.style.display = 'none';
        controlEl.style.display = 'none';
        toggleEl.innerHTML = '»';
        toggleEl.style.borderLeft = 'none';
        toggleEl.title = "Expand HUD";
        hudElement.style.padding = '4px 8px';
      } else {
        timeEl.style.display = 'inline';
        dotEl.style.display = 'block';
        controlEl.style.display = 'block';
        toggleEl.innerHTML = '«';
        toggleEl.style.borderLeft = '1px solid rgba(0,255,0,0.2)';
        toggleEl.title = "Collapse HUD";
        hudElement.style.padding = '8px 12px';
      }

      hudElement.style.display = 'flex';

      const updateTimeDisplay = () => {
        const elapsed = activeProb.isRunning ? (Date.now() - activeProb.startTime) : activeProb.elapsed;
        const tEl = document.getElementById('gt-hud-time');
        if (tEl) {
          const s = Math.floor(elapsed / 1000) % 60, m = Math.floor(elapsed / 60000) % 60, h = Math.floor(elapsed / 3600000);
          tEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }
      };

      // Initial update
      updateTimeDisplay();

      if (hudInterval) clearInterval(hudInterval);
      if (activeProb.isRunning) {
        hudInterval = setInterval(updateTimeDisplay, 1000);
      }
    } else {
      if (hudElement) hudElement.style.display = 'none';
      if (hudInterval) { clearInterval(hudInterval); hudInterval = null; }
    }
  });
}

function broadcast() {
  const details = getLeetCodeDetails();
  if (details) chrome.runtime.sendMessage({ type: 'leetcode_details', details }).catch(() => {});
}

// Listen for storage changes
chrome.storage.onChanged.addListener(() => updateHUD());

// Optimization: Use Observer instead of Interval
const observer = new MutationObserver(() => { broadcast(); updateHUD(); });
const targetNode = document.body;
if (targetNode) observer.observe(targetNode, { childList: true, subtree: true });

broadcast();
updateHUD();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_leetcode_details') sendResponse(getLeetCodeDetails());
  return true;
});
