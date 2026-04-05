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
  
  // Clean up potential extra whitespace or newlines
  fullTitle = fullTitle.replace(/\s+/g, ' ');

  let number = "";
  let name = fullTitle;

  // Pattern: "1. Two Sum" or "1 Two Sum" or "#1 Two Sum"
  const match = fullTitle.match(/^#?(\d+)[\.\s]+(.*)/);
  if (match) {
    number = match[1];
    name = match[2].trim();
  } else if (fullTitle.includes('. ')) {
    const parts = fullTitle.split('. ');
    number = parts[0];
    name = parts.slice(1).join('. ');
  }

  // Fallback: If number is still empty, check the document title
  if (!number) {
    const docTitle = document.title;
    const docMatch = docTitle.match(/^#?(\d+)[\.\s]+(.*)/);
    if (docMatch) {
      number = docMatch[1];
      // We keep the name from the page content as it's usually cleaner
    }
  }

  // Difficulty detection
  let difficulty = "";
  const diffEl = document.querySelector('div[class*="text-difficulty-"], [class*="difficulty"]');
  if (diffEl) {
    difficulty = diffEl.innerText.trim();
  } else {
    // Fallback for different UI versions
    const easy = document.querySelector('.text-easy');
    const medium = document.querySelector('.text-medium');
    const hard = document.querySelector('.text-hard');
    if (easy) difficulty = "Easy";
    else if (medium) difficulty = "Medium";
    else if (hard) difficulty = "Hard";
  }

  // Tags detection
  let tags = [];
  try {
    const tagEls = document.querySelectorAll('a[href^="/tag/"]');
    if (tagEls && tagEls.length > 0) {
      tags = Array.from(tagEls).map(el => el.innerText.trim()).filter(t => t !== "");
    } else {
      // Alternative: check data-key="topic-tags"
      const container = document.querySelector('div[data-key="topic-tags"]');
      if (container) {
        tags = Array.from(container.querySelectorAll('a')).map(el => el.innerText.trim()).filter(t => t !== "");
      }
    }
  } catch (e) {
    console.error("Green Timer: Tag detection error", e);
  }

  return {
    number: number,
    name: name,
    difficulty: difficulty,
    url: window.location.href.split('?')[0].split('#')[0],
    tags: tags
  };
}

function broadcast() {
  const details = getLeetCodeDetails();
  if (details) {
    chrome.runtime.sendMessage({ type: 'leetcode_details', details }).catch(() => {});
  }
}

// Optimization: Use Observer instead of Interval
const observer = new MutationObserver(() => {
  broadcast();
});

// Start observing the main content area
const config = { childList: true, subtree: true };
const targetNode = document.body;
if (targetNode) observer.observe(targetNode, config);

// Initial broadcast
broadcast();

// Direct listener for popup requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_leetcode_details') {
    sendResponse(getLeetCodeDetails());
  }
  return true;
});
