// Enhanced detection for Number, Name, and URL
function getLeetCodeDetails() {
  const titleEl = document.querySelector('div[data-cy="question-title"] span') || 
                  document.querySelector('.text-title-large') || 
                  document.querySelector('h4');
  
  if (!titleEl) return null;

  const fullTitle = titleEl.innerText.trim();
  let number = "";
  let name = fullTitle;

  // Split "1. Two Sum" into "1" and "Two Sum"
  if (fullTitle.includes('. ')) {
    const parts = fullTitle.split('. ');
    number = parts[0];
    name = parts.slice(1).join('. ');
  }

  return {
    number: number,
    name: name,
    url: window.location.href.split('?')[0].split('#')[0] // Clean URL
  };
}

function broadcastDetails() {
  const details = getLeetCodeDetails();
  if (details) {
    chrome.runtime.sendMessage({ type: 'leetcode_details', details }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'get_leetcode_details') {
    sendResponse(getLeetCodeDetails());
  }
  return true;
});

setInterval(broadcastDetails, 2000);
broadcastDetails();
