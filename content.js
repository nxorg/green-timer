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
  statusDot.style.width = '8px'; statusDot.style.height = '8px';
  statusDot.style.borderRadius = '50%'; statusDot.style.background = '#00ff00';
  statusDot.style.boxShadow = '0 0 5px #00ff00';

  hudElement.appendChild(statusDot);
  hudElement.appendChild(timeSpan);
  document.body.appendChild(hudElement);

  let isDragging = false, offsetX, offsetY;
  hudElement.onmousedown = (e) => { isDragging = true; offsetX = e.clientX - hudElement.getBoundingClientRect().left; offsetY = e.clientY - hudElement.getBoundingClientRect().top; };
  document.onmousemove = (e) => { if (!isDragging) return; hudElement.style.left = (e.clientX - offsetX) + 'px'; hudElement.style.top = (e.clientY - offsetY) + 'px'; hudElement.style.right = 'auto'; };
  document.onmouseup = () => { 
    if (isDragging) {
      isDragging = false;
      // Save position
      const pos = { top: hudElement.style.top, left: hudElement.style.left };
      chrome.storage.local.get('app_settings', (d) => {
        const s = d.app_settings || {};
        s.hudPos = pos;
        chrome.storage.local.set({ app_settings: s });
      });
    }
  };
}

function updateHUD() {
  chrome.storage.local.get(['leetcode_problems', 'app_settings'], (data) => {
    const settings = data.app_settings || {};
    const problems = data.leetcode_problems || [];
    const currentUrl = window.location.href.split('?')[0].split('#')[0];
    const activeProb = problems.find(p => p.url === currentUrl && p.isRunning);
    
    if (activeProb && settings.showHUD !== false) {
      if (!hudElement) createHUD();
      
      // Apply saved position if exists
      if (settings.hudPos) {
        hudElement.style.top = settings.hudPos.top;
        hudElement.style.left = settings.hudPos.left;
        hudElement.style.right = 'auto';
      }

      hudElement.style.display = 'flex';
      if (hudInterval) clearInterval(hudInterval);
      hudInterval = setInterval(() => {
        const elapsed = Date.now() - activeProb.startTime;
        const timeEl = document.getElementById('gt-hud-time');
        if (timeEl) {
          const s = Math.floor(elapsed / 1000) % 60, m = Math.floor(elapsed / 60000) % 60, h = Math.floor(elapsed / 3600000);
          timeEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }
      }, 1000);
    } else {
      if (hudElement) hudElement.style.display = 'none';
      if (hudInterval) clearInterval(hudInterval);
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
