# Green Timer - Developer Documentation 🛠️

Welcome to the internal engineering guide for **Green Timer & Stopwatch**. This document explains the technical architecture, data patterns, and development workflows used in this project.

---

## 1. Technical Stack
*   **Platform**: Web Extensions (Manifest V3)
*   **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
*   **Visualization**: Chart.js (included locally as `chart.js`)
*   **Storage**: `chrome.storage.local` (persistent, high-capacity)
*   **Permissions**: `unlimitedStorage` is enabled to support 15,000+ history entries.

---

## 2. Core Architecture

### 🧬 Problem-Centric Data Model
We use a nested architecture to minimize data redundancy and maximize performance.

**Master Key**: `leetcode_history`
```typescript
interface Problem {
  name: string;
  number: string;
  url: string;
  difficulty: string;
  tags: string[];
  submissions: Submission[]; // Nested attempts
}

interface Submission {
  status: string;
  timeStr: string;
  elapsedMs: number;
  timestamp: number;
  notes: string;
}
```

### 🛡️ Environment Isolation (Database Partitioning)
The extension implements a strict **Red Mode (Testing)** vs **Green Mode (Live)** isolation at the storage layer to prevent accidental data corruption during development.

*   **Active Mode**: Detected via `red-mode=1` URL parameter or `test.html` pathname.
*   **Key Prefixing**: In Red Mode, `activeStorage` automatically prefixes all keys with `dev_` (e.g., `dev_leetcode_history`).
*   **Data Stripping**: When reading data in Red Mode, the `dev_` prefix is transparently stripped so the app logic remains unchanged.
*   **Safety Barrier**: `activeStorage.clear()` only removes `dev_` keys when in Red Mode, ensuring your real LeetCode history is never wiped by a test script.

### 🔄 Centralized Synchronization
The `problem_metadata` store acts as a global lookup for tags and review dates. Any update to a problem's tags triggers a **Sync Loop** that updates:
1. The master metadata.
2. Every active problem in the Problems tab.
3. Every historical entry in the History tab.

---

## 3. Project Structure

*   `app.html / app.js / app.css`: The primary User Interface (Popup/Dashboard).
*   `content.js`: The "Sniffer" and "HUD". Detects LeetCode titles/tags and injects the floating timer.
*   `background.js`: Handles alarms (daily reminders), badges (counts), and cross-page state monitoring.
*   `stress.js / test.html`: Internal stress-test tools (excluded from production builds).
*   `build.sh`: Automated packaging script for store deployment.

---

## 4. Engineering Standards

### 🛡️ Security (XSS Prevention)
*   **Strict Rule**: No `innerHTML` for user-defined data.
*   **Pattern**: Use `element.textContent` or `document.createDocumentFragment()` for all dynamic injections.
*   **SVG**: Inject icons using the `injectAnalyticsIcon(parent)` helper to ensure proper namespace parsing.

### ⚡ Performance Optimization
*   **O(N) Migration**: Uses `Map` objects for history migration to prevent O(N²) lag.
*   **DOM Batching**: Uses `DocumentFragment` to prevent excessive browser reflows.
*   **Lazy Loading**: History rendering is capped at 50 items with a "Load More" trigger.
*   **Flat Caching**: The chronological log uses `cachedFlatHistory` to prevent re-sorting on every tab switch.

---

## 5. Development Workflow

### Local Setup
1. Clone the repository.
2. Open Chrome/Firefox.
3. Go to Extensions (`chrome://extensions` or `about:debugging`).
4. Enable **"Developer Mode"**.
5. Click **"Load Unpacked"** and select the project folder.

### Stress Testing & Red Mode
To verify O(N) performance with 15,000+ entries without affecting your real data:
1.  Open the **Settings** tab.
2.  Click the **"GREEN TIMER" logo** 5 times rapidly to reveal the hidden developer tools.
3.  Click **"DEV: OPEN STRESS TEST"**.
4.  The system automatically enters **Red Mode** (notice the UI turning red with a "TESTING ENVIRONMENT" banner).
5.  Run the generator in the new tab; data will be injected into the `dev_` database only.
6.  Close the tab or remove `?red-mode=1` from the URL to return to your live data.

### Building for Production
Always run the build script before uploading to the store:
```bash
./build.sh
```
The script automatically:
*   Extracts the version from `manifest.json`.
*   Cleans the `dist/` directory.
*   Excludes dev tools (`test.html`, `stress.js`).
*   Packages a production-ready `.zip`.

---

## 📜 Project Mandates
For deep logic rules and "laws of the project," refer to **`GEMINI.md`**.

**Engineering Innovation for Everyone.**  
*Maintained by NXORG*
