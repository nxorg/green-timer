// Enhanced detection for Number, Name, and URL
function getLeetCodeDetails() {
  const selectors = [
    'div[data-cy="question-title"] span',
    '.text-title-large',
    '.css-v3d350',
    'h4',
    '.question-title',
    '#question-title'
  ];

  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl && titleEl.innerText.trim()) break;
  }
  
  if (!titleEl) return null;

  const fullTitle = titleEl.innerText.trim();
  let number = "";
  let name = fullTitle;

  // Split "1. Two Sum" into "1" and "Two Sum"
  if (fullTitle.includes('. ')) {
    const parts = fullTitle.split('. ');
    number = parts[0];
    name = parts.slice(1).join('. ');
  } else if (/^\d+\./.test(fullTitle)) {
    // Handle cases like "1.Two Sum"
    const dotIndex = fullTitle.indexOf('.');
    number = fullTitle.substring(0, dotIndex);
    name = fullTitle.substring(dotIndex + 1).trim();
  }

  return {
    number: number,
    name: name,
    url: window.location.href.split('?')[0].split('#')[0]
  };
}

// Listen for direct requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_leetcode_details') {
    const details = getLeetCodeDetails();
    sendResponse(details);
  }
  return true;
});

// Broadcast title to popup
function broadcastDetails() {
  const details = getLeetCodeDetails();
  if (details) {
    chrome.runtime.sendMessage({ type: 'leetcode_details', details }).catch(() => {});
  }
}

setInterval(broadcastDetails, 2000);
broadcastDetails();
