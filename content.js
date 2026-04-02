// Efficient LeetCode Detection using MutationObserver
function getLeetCodeDetails() {
  const selectors = [
    'div[data-cy="question-title"] span',
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

  const fullTitle = titleEl.innerText.trim();
  let number = "";
  let name = fullTitle;

  if (fullTitle.includes('. ')) {
    const parts = fullTitle.split('. ');
    number = parts[0];
    name = parts.slice(1).join('. ');
  } else if (/^\d+\./.test(fullTitle)) {
    const dotIndex = fullTitle.indexOf('.');
    number = fullTitle.substring(0, dotIndex);
    name = fullTitle.substring(dotIndex + 1).trim();
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

  return {
    number: number,
    name: name,
    difficulty: difficulty,
    url: window.location.href.split('?')[0].split('#')[0]
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
