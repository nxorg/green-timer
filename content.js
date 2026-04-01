// Function to find the title on the page using multiple selectors
function findTitle() {
  // Try modern LeetCode selectors first
  const selectors = [
    'div[data-cy="question-title"] span',
    '.text-title-large',
    '.css-v3d350',
    'h4',
    '.question-title'
  ];

  for (let selector of selectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText.trim()) {
      return el.innerText.trim();
    }
  }

  // Fallback: Use the document title (remove " - LeetCode")
  let docTitle = document.title;
  if (docTitle && docTitle.includes(' - LeetCode')) {
    return docTitle.split(' - LeetCode')[0].trim();
  }

  return null;
}

// Broadcast title to popup if it's already open
function broadcastTitle() {
  const title = findTitle();
  if (title) {
    chrome.runtime.sendMessage({ type: 'leetcode_title', title }).catch(() => {
      // Ignore errors when popup is closed
    });
  }
}

// Listen for direct requests from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_leetcode_title') {
    const title = findTitle();
    sendResponse({ title });
  }
  return true;
});

// Check frequently as users navigate within LeetCode
setInterval(broadcastTitle, 2000);
broadcastTitle();
