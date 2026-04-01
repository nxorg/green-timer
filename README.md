# Green Timer & Stopwatch

A sleek, #00ff00 (Matrix-style) themed browser extension designed for developers and LeetCode practitioners. Track your problem-solving speed, set countdown timers, and sync your progress across devices.

## 🚀 Features

- **Problems (Multi-Timer):** Add multiple LeetCode problems and track each one with its own independent stopwatch.
- **Standalone Stopwatch:** A dedicated, large stopwatch for general timing.
- **Countdown Timer:** Simple countdown with 5m, 10m, and 25m (Pomodoro) presets. Includes system notifications and a beep sound when time is up.
- **History Log:** Automatically saves finished problem times with timestamps.
- **Account Sync:** Uses `storage.sync` to automatically backup and sync your data with your Google or Firefox account.
- **Mobile Responsive:** Designed to work on desktop and mobile browsers (e.g., Firefox for Android).
- **GPLv3 Licensed:** Open-source and free to modify.

## 🛠️ Installation

### Manual Installation (Development Mode)

#### For Firefox:
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Select the `manifest.json` file in this directory.

#### For Chrome:
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **"Developer mode"** (top right).
3. Click **"Load unpacked"** and select the project folder.

## 📦 Publishing

This extension is built with **Manifest V3** and is ready for submission to the [Chrome Web Store](https://chrome.google.com/webstore/devconsole) and [Firefox Add-ons (AMO)](https://addons.mozilla.org/en-US/developers/).

### Packaging
To create a store-ready zip:
```bash
zip -r green-timer.zip manifest.json popup.html popup.css popup.js icons/ LICENSE README.md
```

## 📜 License

Copyright (C) 2026 Manoj Kumar

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See the [LICENSE](LICENSE) file for more details.
