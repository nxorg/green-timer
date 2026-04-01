// Helper to get consistent date key (YYYY-MM-DD)
function getDateKey(val) {
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Function to update the icon badge with Solved and Running counts
async function updateBadge() {
  const data = await chrome.storage.sync.get(['leetcode_history', 'leetcode_problems']);
  
  // 1. Calculate Solved Today
  const logs = data.leetcode_history || [];
  const todayK = getDateKey(new Date());
  const solvedToday = logs.filter(l => getDateKey(l.timestamp) === todayK).length;
  
  // 2. Calculate Currently Running
  const problems = data.leetcode_problems || [];
  const runningCount = problems.filter(p => p.isRunning).length;
  
  // 3. Format Badge Text (e.g., "5" or "5:1")
  let badgeText = "";
  if (solvedToday > 0 || runningCount > 0) {
    badgeText = solvedToday.toString();
    if (runningCount > 0) {
      badgeText += ":" + runningCount.toString();
    }
  }
  
  // 4. Update the Badge
  const action = chrome.action || chrome.browserAction;
  if (action) {
    action.setBadgeText({ text: badgeText });
    action.setBadgeBackgroundColor({ color: "#FF0000" }); // Keep it Red as requested
    if (action.setBadgeTextColor) action.setBadgeTextColor({ color: "#FFFFFF" });
  }
}

// Listeners for automatic updates
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.leetcode_history || changes.leetcode_problems)) {
    updateBadge();
  }
});

// Handle Timer Alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timer-finished') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: "Time's Up!",
      message: 'Your countdown timer has finished.',
      priority: 2
    });
  }
});
