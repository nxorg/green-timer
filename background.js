/*
 * Green Code
 * Copyright (C) 2026 Manoj Kumar
 * GPLv3 License
 */

// Helper to get consistent date key (YYYY-MM-DD)
function getDateKey(val) {
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Function to update the icon badge with Solved and Running counts
async function updateBadge(overrideIsRed = null) {
  const storage = chrome.storage.local || chrome.storage.sync;
  const data = await storage.get(['leetcode_history', 'leetcode_problems', 'problem_metadata', 'app_settings', 'env_mode', 'dev_leetcode_history', 'dev_leetcode_problems', 'dev_problem_metadata', 'dev_app_settings']);
  
  const isRed = overrideIsRed !== null ? overrideIsRed : (data.env_mode === 'red');
  const prefix = isRed ? 'dev_' : '';
  
  const settings = data[prefix + 'app_settings'] || {};
  
  // 1. Calculate Solved Today
  const logs = data[prefix + 'leetcode_history'] || [];
  const todayK = getDateKey(new Date());
  
  // Correctly count total submissions across all problems for today
  let solvedToday = 0;
  logs.forEach(p => {
    if (p.submissions) {
      solvedToday += p.submissions.filter(s => getDateKey(s.timestamp) === todayK).length;
    }
  });
  
  // 2. Calculate Currently Running
  const problems = data[prefix + 'leetcode_problems'] || [];
  const runningCount = problems.filter(p => p.isRunning).length;

  // 3. Calculate Due Reviews
  let dueReviewCount = 0;
  if (settings.srsEnabled !== false) {
    const metadata = data[prefix + 'problem_metadata'] || {};
    const now = Date.now();
    dueReviewCount = Object.values(metadata).filter(m => m.nextReview && m.nextReview <= now).length;
  }
  
  // 4. Format Badge Text (e.g., "5:1+2")
  let badgeText = "";
  if (solvedToday > 0 || runningCount > 0 || dueReviewCount > 0) {
    badgeText = solvedToday.toString();
    if (runningCount > 0 || dueReviewCount > 0) {
      badgeText += ":" + runningCount.toString();
    }
    if (dueReviewCount > 0) {
      badgeText += "+" + dueReviewCount.toString();
    }
  }
  
  // 5. Update the Badge
  const action = chrome.action || chrome.browserAction;
  if (action) {
    action.setBadgeText({ text: badgeText });
    action.setBadgeBackgroundColor({ color: isRed ? "#ff3b3b" : "#008000" }); 
    if (action.setBadgeTextColor) action.setBadgeTextColor({ color: "#FFFFFF" });
  }
}

// Handle Messages
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'settings_updated') {
    updateBadge();
  } else if (msg.type === 'leetcode_details') {
    updateBadge(msg.isRed);
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
  } else if (alarm.name === 'daily-summary') {
    showDailySummary();
  } else if (alarm.name === 'review-reminder') {
    checkReviewReminders();
  }
});

// Create Alarms
function setupAlarms() {
  // 1. Daily Summary (9 PM)
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0, 0); 
  if (next < now) next.setDate(next.getDate() + 1);
  chrome.alarms.create('daily-summary', { when: next.getTime() });

  // 2. Review Reminder (Every hour)
  chrome.alarms.create('review-reminder', { periodInMinutes: 60 });
}

async function checkReviewReminders() {
  const storage = chrome.storage.local || chrome.storage.sync;
  const data = await storage.get(['env_mode', 'app_settings', 'problem_metadata', 'dev_app_settings', 'dev_problem_metadata']);
  
  const isRed = data.env_mode === 'red';
  const prefix = isRed ? 'dev_' : '';
  const settings = data[prefix + 'app_settings'] || {};
  
  if (settings.srsEnabled === false) return;

  const metadata = data[prefix + 'problem_metadata'] || {};
  const now = Date.now();
  
  const due = Object.keys(metadata).filter(k => metadata[k].nextReview && metadata[k].nextReview <= now);
  
  if (due.length > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: isRed ? "[DEV] Review Due!" : "Review Due!",
      message: `You have ${due.length} problems ready for revisit today. Keep the logic fresh!`,
      priority: 1
    });
  }
}

async function showDailySummary() {
  const storage = chrome.storage.local || chrome.storage.sync;
  const data = await storage.get(['env_mode', 'leetcode_history', 'dev_leetcode_history']);
  
  const isRed = data.env_mode === 'red';
  const prefix = isRed ? 'dev_' : '';
  const logs = data[prefix + 'leetcode_history'] || [];
  
  const todayK = getDateKey(new Date());
  const todaySubmissions = [];
  logs.forEach(p => {
    if (p.submissions) {
      p.submissions.forEach(s => {
        if (getDateKey(s.timestamp) === todayK) {
          todaySubmissions.push({ ...p, ...s, submissions: undefined });
        }
      });
    }
  });
  
  if (todaySubmissions.length > 0) {
    const totalMs = todaySubmissions.reduce((s, l) => s + (l.elapsedMs || 0), 0);
    const mins = Math.floor(totalMs / 60000);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: isRed ? "[DEV] Today's Achievement!" : "Today's Achievement!",
      message: `You solved ${todaySubmissions.length} problems today in ${mins} mins. Keep it up!`,
      priority: 1
    });
  } else {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: isRed ? "[DEV] Ready to solve a problem?" : "Ready to solve a problem?",
      message: "You haven't tracked any problems yet today. Stay sharp!",
      priority: 1
    });
  }
}

// Show a quick notification when a new problem is finished
chrome.storage.onChanged.addListener((changes, area) => {
  updateBadge();
  
  chrome.storage.local.get(['env_mode'], (data) => {
    const isRed = data.env_mode === 'red';
    const key = (isRed ? 'dev_' : '') + 'leetcode_history';
    
    if (changes[key] && changes[key].newValue) {
      const oldVal = changes[key].oldValue || [];
      const newVal = changes[key].newValue;
      
      const countSubmissions = (arr) => arr.reduce((acc, p) => acc + (p.submissions ? p.submissions.length : 0), 0);
      
      if (countSubmissions(newVal) > countSubmissions(oldVal)) {
        // Find the problem that got a new submission
        let latest = null;
        for (const p of newVal) {
          const oldP = oldVal.find(o => (o.number || o.name) === (p.number || p.name));
          if (!oldP || (p.submissions.length > oldP.submissions.length)) {
            latest = p;
            break;
          }
        }
        
        if (latest) {
          const todayK = getDateKey(new Date());
          let todayCount = 0;
          let latestProblemTodayCount = 0;
          
          newVal.forEach(p => {
            if (p.submissions) {
              const todaySubs = p.submissions.filter(s => getDateKey(s.timestamp) === todayK);
              todayCount += todaySubs.length;
              if ((p.number || p.name) === (latest.number || latest.name)) {
                latestProblemTodayCount = todaySubs.length;
              }
            }
          });
          
          let message = `Saved "${latest.name}". This is your #${todayCount} problem today!`;
          
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-128.png',
            title: isRed ? "[DEV] Problem Finished!" : "Problem Finished!",
            message: message,
            priority: 1
          });
        }
      }
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
  setupAlarms();
});
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
  setupAlarms();
});
