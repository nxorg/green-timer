// Helper to get consistent date key (YYYY-MM-DD)
function getDateKey(val) {
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Function to update the icon badge
async function updateBadge() {
  const data = await chrome.storage.sync.get('leetcode_history');
  const logs = data.leetcode_history || [];
  const todayK = getDateKey(new Date());
  const todayCount = logs.filter(l => getDateKey(l.timestamp) === todayK).length;
  
  const badgeText = todayCount > 0 ? todayCount.toString() : "";
  
  // Update badge for all platforms (Chrome/Firefox)
  const action = chrome.action || chrome.browserAction;
  if (action) {
    action.setBadgeText({ text: badgeText });
    action.setBadgeBackgroundColor({ color: "#FF0000" });
    if (action.setBadgeTextColor) action.setBadgeTextColor({ color: "#FFFFFF" });
  }
}

// Update badge when extension starts
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);

// CRITICAL: Update badge whenever history changes in storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.leetcode_history) {
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
