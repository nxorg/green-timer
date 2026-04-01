// Tab switching
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
  });
});

// Helper to format time
function formatTime(ms, isStopwatch = false) {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);

  seconds %= 60;
  minutes %= 60;

  let display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  if (isStopwatch) {
    let milliseconds = Math.floor((ms % 1000) / 10);
    display += `.${String(milliseconds).padStart(2, '0')}`;
  }
  
  return display;
}

// Timer Logic
let timerInterval;
let timerTimeLeft = 0;

const timerDisplay = document.getElementById('timer-display');
const timerInput = document.getElementById('timer-input');
const timerStartBtn = document.getElementById('timer-start');
const timerPauseBtn = document.getElementById('timer-pause');
const timerResetBtn = document.getElementById('timer-reset');

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(timerTimeLeft);
}

timerStartBtn.addEventListener('click', () => {
  if (timerInterval) return;
  
  if (timerTimeLeft <= 0) {
    const minutes = parseInt(timerInput.value) || 0;
    timerTimeLeft = minutes * 60 * 1000;
  }
  
  if (timerTimeLeft > 0) {
    timerInterval = setInterval(() => {
      timerTimeLeft -= 1000;
      updateTimerDisplay();
      
      if (timerTimeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerTimeLeft = 0;
        updateTimerDisplay();
        notifyUser();
      }
    }, 1000);
  }
});

timerPauseBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
});

timerResetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerTimeLeft = 0;
  timerInput.value = '';
  updateTimerDisplay();
});

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => {
    const mins = parseInt(btn.dataset.time);
    timerTimeLeft = mins * 60 * 1000;
    updateTimerDisplay();
  });
});

function playBeep() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
  gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5); // Beep for 0.5 seconds
}

function notifyUser() {
  // Try sound
  playBeep();

  // System Notification
  if (typeof browser !== 'undefined' && browser.notifications) {
    browser.notifications.create({
      "type": "basic",
      "iconUrl": "icons/icon-48.png",
      "title": "Time's Up!",
      "message": "Your timer has finished."
    });
  } else if (typeof chrome !== 'undefined' && chrome.notifications) {
     chrome.notifications.create({
      "type": "basic",
      "iconUrl": "icons/icon-48.png",
      "title": "Time's Up!",
      "message": "Your timer has finished."
    });
  }
}

// Stopwatch Logic
let swInterval;
let swStartTime;
let swElapsedTime = 0;

const swDisplay = document.getElementById('stopwatch-display');
const swStartBtn = document.getElementById('stopwatch-start');
const swPauseBtn = document.getElementById('stopwatch-pause');
const swResetBtn = document.getElementById('stopwatch-reset');

function updateSwDisplay() {
  swDisplay.textContent = formatTime(swElapsedTime, true);
}

swStartBtn.addEventListener('click', () => {
  if (swInterval) return;
  swStartTime = Date.now() - swElapsedTime;
  swInterval = setInterval(() => {
    swElapsedTime = Date.now() - swStartTime;
    updateSwDisplay();
  }, 10);
});

swPauseBtn.addEventListener('click', () => {
  clearInterval(swInterval);
  swInterval = null;
});

swResetBtn.addEventListener('click', () => {
  clearInterval(swInterval);
  swInterval = null;
  swElapsedTime = 0;
  updateSwDisplay();
});
