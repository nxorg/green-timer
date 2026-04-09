# Green Timer - Development Mandates

This document serves as the "Source of Truth" for the architecture, coding standards, and UI patterns of the Green Timer & Stopwatch extension.

## 🏗️ Data Architecture (Problem-Centric Nested Model)
*   **Storage Key**: `leetcode_history`
*   **Structure**: A Problem object contains metadata (`name`, `number`, `url`, `difficulty`, `tags`) and a nested `submissions` array.
*   **Rule**: Metadata is stored **once** at the problem level. Do not duplicate metadata inside individual submissions.
*   **Synchronization**: Any change to a problem's tags must be synchronized across all active problems and historical records via the `problemMetadata` centralized store.
*   **Scalability**: The system must handle 15,000+ submissions through lazy-loading (50 items initial) and O(N) Map-based migration.

## 🛡️ Security & Environment Standards
*   **Mandate**: Never use `innerHTML` for dynamic content or user-provided data.
*   **Environment Isolation**: Red Mode (Testing) must strictly use `dev_` prefixed storage keys via the `activeStorage` layer to protect Live data.
*   **SRS 2.0**: Spaced Repetition must use confidence-based scheduling (1-5 stars) to determine review intervals.
*   **Pattern**: Use `document.createTextNode()` or `element.textContent` for all notes, names, and tags.
*   **SVG Injection**: Use the `injectAnalyticsIcon(parent)` helper for secure SVG rendering.

## 🎨 UI & Layout Patterns
*   **File Naming**: Use the `app.*` convention (`app.html`, `app.css`, `app.js`).
*   **Unified Row Design**: All rows must follow the two-row flexbox structure.
*   **Filter UI**: History filters must be hidden within the toggleable "FILTERS" section by default.
*   **Iconography**: Use the centralized `ANALYTICS_SVG` constant for all trend/analytics buttons.
*   **Interaction**: Icons must have `pointer-events: none` to ensure clicks reach the parent button.

## 🏷️ Tagging System
*   **Library Policy**: Only tags existing in the `global_tags` library should be used.
*   **Case Sensitivity**: Always perform case-insensitive checks for library additions.

## 🚀 Versioning & Build
*   **Version Source**: `manifest.json`.
*   **Packaging**: Always use `./build.sh`.

---
*Updated at v1.5.0 - Engineering Innovation for Everyone.*
