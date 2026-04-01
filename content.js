// Extract LeetCode problem title
function getProblemTitle() {
  const titleEl = document.querySelector('div[data-cy="question-title"] span') || document.querySelector('h4');
  if (titleEl) {
    chrome.runtime.sendMessage({ type: 'leetcode_title', title: titleEl.innerText });
  }
}

// Check every few seconds as LeetCode is a SPA (Single Page App)
setInterval(getProblemTitle, 3000);
getProblemTitle();
