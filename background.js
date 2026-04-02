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
  } else if (alarm.name === 'daily-summary') {
    showDailySummary();
  }
});

// Create Daily Alarm (once a day at 9 PM)
function setupDailyAlarm() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0, 0); // 9 PM
  if (next < now) next.setDate(next.getDate() + 1);
  chrome.alarms.create('daily-summary', { when: next.getTime() });
}

async function showDailySummary() {
  const data = await chrome.storage.sync.get(['leetcode_history']);
  const logs = data.leetcode_history || [];
  const todayK = getDateKey(new Date());
  const todayLogs = logs.filter(l => getDateKey(l.timestamp) === todayK);
  
  if (todayLogs.length > 0) {
    const totalMs = todayLogs.reduce((s, l) => s + (l.elapsedMs || 0), 0);
    const mins = Math.floor(totalMs / 60000);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: "Today's Achievement!",
      message: `You solved ${todayLogs.length} problems today in ${mins} mins. Keep it up!`,
      priority: 1
    });
  } else {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: "Ready to solve a problem?",
      message: "You haven't tracked any problems yet today. Stay sharp!",
      priority: 1
    });
  }
  // Setup next day alarm
  setupDailyAlarm();
}

// Show a quick notification when a new problem is finished
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.leetcode_history || changes.leetcode_problems)) {
    updateBadge();
    
    if (changes.leetcode_history && changes.leetcode_history.newValue) {
      const oldVal = changes.leetcode_history.oldValue || [];
      const newVal = changes.leetcode_history.newValue;
      if (newVal.length > oldVal.length) {
        const latest = newVal[0];
        const todayK = getDateKey(new Date());
        const todayCount = newVal.filter(l => getDateKey(l.timestamp) === todayK).length;
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: "Problem Finished!",
          message: `Saved "${latest.name}". This is your #${todayCount} problem today!`,
          priority: 1
        });
      }
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
  setupDailyAlarm();
});
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
  setupDailyAlarm();
});
