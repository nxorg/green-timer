# Green Timer - Development Mandates

This document serves as the "Source of Truth" for the architecture, coding standards, and UI patterns of the Green Timer & Stopwatch extension.

## 🏗️ Data Architecture (Problem-Centric Nested Model)
*   **Storage Key**: `leetcode_history`
*   **Structure**: A Problem object contains metadata (`name`, `number`, `url`, `difficulty`, `tags`) and a nested `submissions` array.
*   **Rule**: Metadata is stored **once** at the problem level. Do not duplicate metadata inside individual submissions.
*   **Synchronization**: Any change to a problem's tags must be synchronized across all active problems and historical records via the `problemMetadata` centralized store.

## 🛡️ Security Standards
*   **Mandate**: Never use `innerHTML` for dynamic content or user-provided data.
*   **Pattern**: Use `document.createTextNode()` or `element.textContent` for all notes, names, and tags.
*   **SVG Injection**: Use the `injectAnalyticsIcon(parent)` helper which utilizes `DOMParser` for secure SVG rendering.

## 🎨 UI & Layout Patterns
*   **Unified Row Design**: All problem/history rows must follow the two-row flexbox structure:
    *   **Top Row**: Title/Link (Left) + Action Buttons (Right).
    *   **Bottom Row**: Status/Difficulty (Left) + Timer/Date (Right).
*   **Iconography**: Use the centralized `ANALYTICS_SVG` constant for all trend/analytics buttons.
*   **Theme Consistency**: Always verify contrast in both Dark (#00ff00) and Light (#008000) modes.

## 🏷️ Tagging System
*   **Library Policy**: Only tags existing in the `global_tags` library should be used to maintain data cleanliness.
*   **Case Sensitivity**: Always perform case-insensitive checks when adding tags to the library to prevent duplicates like "Math" and "math".

## 🚀 Versioning & Build
*   **Version Source**: `manifest.json` is the source of truth for the version number.
*   **Packaging**: Always use `./build.sh` to generate the production zip. It automatically handles version naming and directory cleanup.

---
*Generated at v1.2.6 - Engineering Innovation for Everyone.*
