# AUDIT_REPORT_PR52.md — Deep Single-Agent Review & Regression Audit

**Target:** Pull Request #52 (`dev` -> `main`)  
**Base Commit:** `0d53dbb` (`origin/main`)  
**Head Commit:** `6fb84e6` (`origin/dev`)  
**Scope:** 129 changed files (+24,955 lines, -21,290 lines) across 69 commits  
**Date:** 2026-11-08  
**Auditor:** Antigravity Deep Auditor (/boost Single-Agent Mode)

---

## 1. Executive Summary & Verdict

### 1.1. Context & Scope
Pull Request #52 represents a massive, foundational milestone for **MGKCT 3D**:
1. **Architectural Modularization**: Decomposition of monolithic legacy files (`navigator.js` [5,082 lines], `territory.js` [3,333 lines], `style.css` [2,623 lines], `helpers.js` [2,126 lines], `ui.js` [2,126 lines]) into focused modules across `js/materials/`, `js/helpers/`, `js/buildings/`, `js/territory/`, `js/controls/`, `js/nav/`, `js/ui/`, `js/main/`, and 10 component CSS files.
2. **Material 3 Expressive UI**: Complete redesign of search sheets, room context cards, route input pills, toast notifications, and mobile floor controls.
3. **Campus Navigation Graph v2.0**: Full coverage of 4 campus buildings across 7 floors (248 rooms, 456 doors, 1,183 walls, 1,136 navigation nodes).
4. **Raycast & Picking Precision**: Elimination of upper-floor raycast height offset and touch gesture tolerance tuning.

### 1.2. Audit Verdict: ⚠️ CONDITIONAL APPROVAL (Requires Priority Hotfixes)
The architectural refactoring and UI improvements are of high engineering quality. All 5 baseline verification suites pass (`check_syntax.js`, `validate_campus_navigation.js`, `validate_floor.js`, `smoke_browser_runtime.js`).

However, this deep audit uncovered **4 bugs** (including duplicate navigation graph nodes with 0-weight edges and unvalidated URL parameters that can hide the entire 3D scene), **4 architectural & scoping issues**, and **coverage blind spots** that existing CI tests did not catch.

---

## 2. 🔴 CRITICAL & HIGH BUGS

### BUG-01: Duplicate Co-Located Graph Nodes with 0-Weight Edges
- **Locations**:
  - [`js/nav/data/bldg2-f3.js:83-88, 177`](file:///c:/Users/Администратор/Desktop/PR/js/nav/data/bldg2-f3.js#L83-L177)
  - [`js/nav/data/bldg3-f2.js:83-93, 195`](file:///c:/Users/Администратор/Desktop/PR/js/nav/data/bldg3-f2.js#L83-L195)
- **Detection Technique**: Graph Adjacency Invariant Analysis & BFS Edge Weight Verification.
- **Root Cause**:
  In `js/nav/data/bldg2-f3.js`:
  ```javascript
  // Line 83:
  g.addNode('outdoor_node_93342', 3, 2, 37.1, -5.8, 'corridor', 'Коридор 3');
  // Line 88:
  g.addNode("b2_f3_c_37.5", 3, 2, 37.1, -5.8, "corridor", "К2 Эт.3 Коридор");
  // Line 177:
  g.addEdge("b2_f3_c_37.5", "outdoor_node_93342");
  ```
  Both nodes share identical coordinates `(X: 37.1, Z: -5.8)`. Euclidean distance $\Delta = 0$, producing a bi-directional edge with `weight: 0`.
  In `js/nav/data/bldg3-f2.js`:
  ```javascript
  // Line 83:
  g.addNode('outdoor_node_57713', 2, 3, 5.9, -25.6, 'corridor', 'Коридор 2');
  // Line 93:
  g.addNode("b3_f2_c_-26.0", 2, 3, 5.9, -25.6, "corridor", "К3 Эт.2 Коридор");
  // Line 195:
  g.addEdge("b3_f2_c_-26.0", "outdoor_node_57713");
  ```
  Both nodes share identical coordinates `(X: 5.9, Z: -25.6)`, creating an edge of `weight: 0`.
- **Impact**:
  A* path reconstruction and step instruction generation can navigate between two co-located nodes, creating zero-length 3D ribbon geometry segments and redundant step instructions.
- **Reproduction**:
  Run `aStarPath(g, 'b2_f3_c_37.5', 'door_corr_room_2_3_127')`. Path returns: `b2_f3_c_37.5 -> outdoor_node_93342 -> door_corr_room_2_3_127`.
- **Fix (Patch)**:
  Consolidate edges to point directly to `b2_f3_c_37.5` and `b3_f2_c_-26.0`, and remove the duplicate `outdoor_node_*` definitions:

```diff
--- a/js/nav/data/bldg2-f3.js
+++ b/js/nav/data/bldg2-f3.js
@@ -83,1 +83,0 @@
-        g.addNode('outdoor_node_93342', 3, 2, 37.1, -5.8, 'corridor', 'Коридор 3');
@@ -166,1 +165,1 @@
-        g.addEdge('outdoor_node_93342', 'outdoor_node_64127');
+        g.addEdge('b2_f3_c_37.5', 'outdoor_node_64127');
@@ -173,2 +172,2 @@
-        g.addEdge('outdoor_node_93342', 'door_corr_room_2_3_127');
-        g.addEdge('outdoor_node_90519', 'outdoor_node_93342');
+        g.addEdge('b2_f3_c_37.5', 'door_corr_room_2_3_127');
+        g.addEdge('outdoor_node_90519', 'b2_f3_c_37.5');
@@ -177,1 +175,0 @@
-        g.addEdge("b2_f3_c_37.5", "outdoor_node_93342");
```

---

### BUG-02: Unvalidated `?floor=` URL Parameter Hides Entire 3D Scene
- **Location**: [`js/main/url-and-bti-overlay.js:8-10`](file:///c:/Users/Администратор/Desktop/PR/js/main/url-and-bti-overlay.js#L8-L10)
- **Detection Technique**: Boundary Value Analysis & URL Sanitation Fuzzing.
- **Root Cause**:
  ```javascript
  if (urlParams.has('floor') && typeof setMode === 'function') {
      setMode(urlParams.get('floor'), false);
  }
  ```
  `setMode` expects `'1'..'7'`, `'all'`, `'sideBySide'`, or `'slice'`. If a user enters `?floor=99` or `?floor=invalid`, `setMode('99')` sets `STATE.mode = '99'`.
  In `js/main/visibility-and-walls.js`:
  ```javascript
  const selectedFloor = parseInt(STATE.mode, 10);
  for (let f = 1; f <= 7; f++) {
      floorGroups[f].visible = (f === selectedFloor);
  }
  ```
  Since `f === 99` is always `false`, all floor groups `1..7` are set to `visible = false`. The canvas renders completely empty.
- **Reproduction**:
  Navigate to `http://localhost:8000/?floor=99` or `http://localhost:8000/?floor=abc`. The entire college building vanishes.
- **Fix (Patch)**:
```diff
--- a/js/main/url-and-bti-overlay.js
+++ b/js/main/url-and-bti-overlay.js
@@ -8,3 +8,6 @@ function applyInitialUrlAndBtiParams() {
         if (urlParams.has('floor') && typeof setMode === 'function') {
-            setMode(urlParams.get('floor'), false);
+            const rawF = urlParams.get('floor');
+            if (/^[1-7]$/.test(rawF) || rawF === 'all' || rawF === 'slice' || rawF === 'sideBySide') {
+                setMode(rawF, false);
+            }
         }
```

---

### BUG-03: Implicit Window Leak on Undeclared `renderedStairBadges`
- **Location**: [`js/nav/route-screen-badges.js:5`](file:///c:/Users/Администратор/Desktop/PR/js/nav/route-screen-badges.js#L5)
- **Detection Technique**: Strict Scope Analysis & Global Identifier Leak Detection.
- **Root Cause**:
  `renderedStairBadges` was declared with `let renderedStairBadges` in `js/nav/nav-core.js:58`. Because scripts in `index.html` execute as separate script tags, lexical `let` at top-level is scoped to that script tag and is NOT added as a property to `window`.
  In `js/nav/route-screen-badges.js:5`:
  ```javascript
  renderedStairBadges = NAV_STATE._renderedStairBadges;
  ```
  This performs an assignment to an undeclared identifier, which creates a property `window.renderedStairBadges` in sloppy mode, but throws `ReferenceError: assignment to undeclared variable renderedStairBadges` if strict mode is activated.
- **Fix (Patch)**:
```diff
--- a/js/nav/route-screen-badges.js
+++ b/js/nav/route-screen-badges.js
@@ -1,6 +1,6 @@
     function renderNavigatorScreenBadges(ctx, dpr, width, height) {
         if (NAV_STATE && NAV_STATE._renderedStairBadges) {
             NAV_STATE._renderedStairBadges.length = 0;
         }
-        renderedStairBadges = NAV_STATE._renderedStairBadges;
+        const renderedStairBadges = NAV_STATE ? NAV_STATE._renderedStairBadges : [];
```

---

### BUG-04: Cross-Floor Room Selection in Navigator Picking Mode
- **Location**: [`js/nav/route-controller.js:201-207, 221-228`](file:///c:/Users/Администратор/Desktop/PR/js/nav/route-controller.js#L201-L228)
- **Detection Technique**: State Transition & Cross-Floor Event Interception.
- **Root Cause**:
  In `handleNavigatorMapClick()`, when `NAV_STATE.pickingMode` or `NAV_STATE.targetToChange` is active:
  ```javascript
  for (let i = window.renderedScreenBadges.length - 1; i >= 0; i--) {
      const b = window.renderedScreenBadges[i];
      if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
          cy >= b.y0 - hitMargin && cy <= b.y1 + hitMargin) {
          onLocationPicked(b.room);
          return true;
      }
  }
  ```
  Unlike `findRoomAtScreenPoint()` in `view-and-picking.js`, this loop lacks the check:
  `if (activeFloor !== null && b.room && b.room.floor !== activeFloor) continue;`
  In multi-floor transitions or when badges overlap near stairwells, the user can accidentally select a room on another floor as a destination.
- **Fix (Patch)**:
```diff
--- a/js/nav/route-controller.js
+++ b/js/nav/route-controller.js
@@ -200,4 +200,6 @@
+                const activeFloor = (typeof STATE !== 'undefined' && STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice') ? parseInt(STATE.mode, 10) : null;
                 for (let i = window.renderedScreenBadges.length - 1; i >= 0; i--) {
                     const b = window.renderedScreenBadges[i];
+                    if (activeFloor !== null && b.room && b.room.floor !== activeFloor) continue;
                     if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
```

---

## 3. 🟠 ARCHITECTURAL, STATE & UI/CSS ISSUES

### ARCH-01: Load Order Discrepancy Between `index.html` and `vm_loader.js`
- **Location**: [`tests/helpers/vm_loader.js:21-23`](file:///c:/Users/Администратор/Desktop/PR/tests/helpers/vm_loader.js#L21-L23) vs [`index.html:759`](file:///c:/Users/Администратор/Desktop/PR/index.html#L759)
- **Detail**:
  In `vm_loader.js`, `LOGICAL_BUNDLE_MAP['js/telemetry.js']` is positioned immediately after `js/state.js`.
  In `index.html` and `AGENTS.md` (Section 2), `js/telemetry.js` is loaded at the very end of the script chain.
- **Remediation**:
  Move `'js/telemetry.js'` in `LOGICAL_BUNDLE_MAP` to the end of the map to mirror `index.html`.

### ARCH-02: Module Size Limit Exceeded (AGENTS.md Convention: $\le 300$ Lines)
- **Violations**:
  - `css/navigator-modal.css` — 757 lines (**+152% over limit**)
  - `css/map-fabs-and-hud.css` — 410 lines (+36%)
  - `js/materials/timetable-board.js` — 370 lines (+23%)
  - `js/nav/nav-core.js` — 352 lines (+17%)
  - `css/search-dock-and-results.css` — 352 lines (+17%)
  - `js/nav/astar-and-instructions.js` — 334 lines (+11%)
  - `js/helpers/labels-screen-overlay.js` — 325 lines (+8%)
  - `js/nav/nav-init.js` — 312 lines (+4%)
  - `js/nav/route-controller.js` — 304 lines (+1%)
  - `js/territory/driveways-and-plaza.js` — 304 lines (+1%)
  - `js/territory/park-benches-and-bins.js` — 303 lines (+1%)
  - `js/helpers/stairs-and-roofs.js` — 302 lines (+1%)
  - `js/territory/landscaping-and-curbs.js` — 301 lines (+0.3%)
- **Remediation**:
  Split `css/navigator-modal.css` into `navigator-inputs.css` and `navigator-dialog.css`. Further minor trimming for files marginally over 300 lines.

### ARCH-03: Hardcoded `z-index: 100` in `.m3-toast`
- **Location**: [`css/navigator-modal.css:498`](file:///c:/Users/Администратор/Desktop/PR/css/navigator-modal.css#L498)
- **Detail**:
  Uses hardcoded `z-index: 100 !important;` instead of design token `z-index: var(--z-toast, 75) !important;` defined in `css/tokens-and-base.css:17`.

### ARCH-04: Top-Level `AbortController` in `room-disciplines.js`
- **Location**: [`js/ui/room-disciplines.js:15`](file:///c:/Users/Администратор/Desktop/PR/js/ui/room-disciplines.js#L15)
- **Detail**:
  `roomDisciplinesAbortController = new AbortController();` runs at top-level. In legacy headless test harnesses or older Android WebViews without `AbortController`, this throws a top-level `ReferenceError`.
- **Remediation**:
  Wrap in capability guard: `if (typeof AbortController !== 'undefined') { ... }`.

---

## 4. 🟡 TECH DEBT, HACKS & 3D PERFORMANCE

1. **Hardcoded Hex Colors (227 occurrences outside tokens-and-base.css)**:
   - `#1a73e8` (77x), `#ffffff` (49x), `#c2e7ff` (31x) are repeated across `css/*.css` instead of `var(--m3-primary)`, `var(--m3-surface)`, etc.
2. **Cascading `setTimeout` UI Transitions**:
   - In `room-popup-actions.js:153-166`: 160ms popup exit $\to$ 250ms delayed floor collapse.
   - In `ui-init-and-popup-show.js:286-289`: `updateAdaptiveFabPosition` invoked at 0ms, 60ms, and 280ms.
   - *Recommendation*: Replace arbitrary timeouts with CSS `transitionend` event listeners.
3. **Spatial Grid Cell Allocation in Render Loop**:
   - In `labels-screen-overlay.js:258`: `cellList = []; spatialGrid.set(cIdx, cellList);` allocates new arrays on frames where screen badges are redrawn. Reusable object pools would eliminate minor GC spikes.

---

## 5. 🟢 QA & TEST COVERAGE GAPS & NEW TEST SUITES

The existing test suites (`validate_floor.js`, `check_syntax.js`, `validate_campus_navigation.js`) are effective for geometry and basic connectivity, but missed:
- Zero-weight edges between co-located nodes.
- URL query parameter boundary fuzzing.
- Undeclared global identifier leaks.

### 5.1. Automated Verification Code (Save as `tests/verify_pr52_regressions.js`)

```javascript
'use strict';

/**
 * tests/verify_pr52_regressions.js
 * Comprehensive automated regression suite covering PR #52 audit findings.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('================================================================');
console.log('  PR #52 REGRESSION & INVARIANT AUDIT TEST SUITE');
console.log('================================================================');

// 1. SETUP VM CONTEXT
const vmLoader = require('./helpers/vm_loader.js');
const context = vm.createContext({
    console, Math, Set, Map, Array, Object, String, Number, Boolean, RegExp,
    parseInt, parseFloat, isNaN, isFinite, setTimeout, clearTimeout,
    document: {
        readyState: 'loading',
        addEventListener: () => {},
        documentElement: { setAttribute: () => {} },
        getElementById: () => null,
        querySelectorAll: () => []
    },
    window: {}
});
context.window = context;

const threeCode = fs.readFileSync(path.join(__dirname, '../js/vendor/three.min.js'), 'utf8');
vm.runInContext(threeCode, context);

// Load Nav Scripts
const navScripts = [
    'js/state.js', 'js/nav/nav-core.js',
    'js/nav/data/bldg1-f1.js', 'js/nav/data/bldg1-f2.js', 'js/nav/data/bldg1-f3.js',
    'js/nav/data/bldg1-f4.js', 'js/nav/data/bldg1-f5.js', 'js/nav/data/bldg1-f6.js',
    'js/nav/data/bldg1-f7-and-outdoor.js', 'js/nav/data/bldg2-f1.js', 'js/nav/data/bldg2-f2.js',
    'js/nav/data/bldg2-f3.js', 'js/nav/data/bldg3-f1.js', 'js/nav/data/bldg3-f2.js',
    'js/nav/data/bldg4-f1.js', 'js/nav/data/bldg4-f2-f3.js', 'js/nav/graph-builder.js',
    'js/nav/astar-and-instructions.js'
];
for (const s of navScripts) {
    const code = fs.readFileSync(path.join(__dirname, '..', s), 'utf8');
    vm.runInContext(code, context, { filename: s });
}

const graph = context.buildCollegeNavGraph();

// TEST 1: Zero-Weight Edge & Co-Located Node Invariant
console.log('\n[TEST 1] Verifying all edges have positive non-zero weights...');
let zeroWeightEdges = [];
for (const [id, edges] of graph.adj.entries()) {
    for (const e of edges) {
        if (typeof e.weight !== 'number' || e.weight <= 0) {
            zeroWeightEdges.push({ from: id, to: e.to, weight: e.weight });
        }
    }
}
if (zeroWeightEdges.length > 0) {
    console.error('FAIL: Found zero-weight edges:', zeroWeightEdges);
} else {
    console.log('✓ PASS: All graph edges have strictly positive weights (weight > 0).');
}

// TEST 2: URL Floor Parameter Sanitation Invariant
console.log('\n[TEST 2] Verifying URL parameter floor parser rejection of out-of-range values...');
const rawUrlScript = fs.readFileSync(path.join(__dirname, '../js/main/url-and-bti-overlay.js'), 'utf8');
const hasFloorSanitation = rawUrlScript.includes('/^[1-7]$/') || rawUrlScript.includes('1-7');
if (!hasFloorSanitation) {
    console.warn('WARN: url-and-bti-overlay.js applies urlParams.get("floor") directly without range validation.');
} else {
    console.log('✓ PASS: Floor parameter is validated against valid floor bounds.');
}

// TEST 3: Strict Mode Undeclared Global Identifier Check in route-screen-badges.js
console.log('\n[TEST 3] Verifying strict mode compliance in route-screen-badges.js...');
const badgeScript = fs.readFileSync(path.join(__dirname, '../js/nav/route-screen-badges.js'), 'utf8');
const hasUndeclaredAssign = badgeScript.includes('renderedStairBadges = NAV_STATE._renderedStairBadges;');
if (hasUndeclaredAssign) {
    console.warn('WARN: route-screen-badges.js assigns to undeclared identifier renderedStairBadges.');
} else {
    console.log('✓ PASS: No undeclared identifier assignments.');
}

console.log('\n================================================================');
console.log('  TEST SUMMARY: Regression suite completed.');
console.log('================================================================');
```

---

## 6. ПЛАН ДОВЕДЕНИЯ ДО ИДЕАЛА (Step-by-Step Action Plan)

1. **[Приоритет 1 — Блокирующий] Исправить BUG-01 в графе навигации**:
   - Применить патч для `js/nav/data/bldg2-f3.js` и `js/nav/data/bldg3-f2.js`, устранив дублирующиеся узлы `outdoor_node_93342` и `outdoor_node_57713`.
2. **[Приоритет 1 — Блокирующий] Обезопасить чтение URL в `url-and-bti-overlay.js` (BUG-02)**:
   - Добавить валидацию `/^[1-7]$/.test(raw) || raw === 'all' ...` перед вызовом `setMode`.
3. **[Приоритет 2 — Высокий] Устранить утечку переменной в `route-screen-badges.js` (BUG-03)**:
   - Заменить `renderedStairBadges = ...` на `const renderedStairBadges = ...`.
4. **[Приоритет 2 — Высокий] Добавить фильтрацию по этажу в `route-controller.js` (BUG-04)**:
   - Проверять `b.room.floor === activeFloor` при клике в режиме выбора точки на карте.
5. **[Приоритет 3 — Средний] Синхронизировать `vm_loader.js` (ARCH-01)**:
   - Переместить `js/telemetry.js` в конец `LOGICAL_BUNDLE_MAP`.
6. **[Приоритет 3 — Средний] Заменить `z-index: 100` на `var(--z-toast)` в `navigator-modal.css` (ARCH-03)**.
7. **[Приоритет 4 — Низкий / Техдолг] Декомпозировать `css/navigator-modal.css`** для соблюдения лимита $\le 300$ строк.

---

## 7. Вспомогательные скрипты аудита

Во время аудита были созданы вспомогательные инструменты проверки в папке `audit_helpers/`:
- `audit_helpers/check_load_order_and_globals.js`
- `audit_helpers/deep_code_inspection.js`
- `audit_helpers/check_css.js`
- `audit_helpers/verify_graph_deep.js`
- `audit_helpers/test_duplicate_nodes.js`
- `audit_helpers/check_line_limits.js`
- `audit_helpers/analyze_pr52_diff.js`

Для их удаления выполните команду:
```powershell
Remove-Item -Recurse -Force audit_helpers
```
