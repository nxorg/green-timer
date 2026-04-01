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
