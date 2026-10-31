# AGENTS.md — AI Agent Guide for MGKCT 3D

This document provides architectural context, conventions, and operational rules for AI assistants working on the **MGKCT 3D** codebase.

---

## 1. Project Overview

**MGKCT 3D** is an interactive, browser-based 3D/2D indoor map and campus navigation system for the Minsk State College of Digital Technologies (МГКЦТ).
- **Buildings & Levels**: 4 interconnected buildings, up to 7 floors (15 floor plans total).
- **Key Features**:
  - Interactive 3D isometric view and telecentric 2D top-down plan view (`?top=1`).
  - Multi-floor selector (Floors 1–7) with animated transitions.
  - Screen-space 2D Retina overlay for high-DPI room labels and optional world coordinate grid (`?grid=1`).
  - Built-in BTI blueprint alignment plane (`?bti=1` / `?debug=1`).
  - Indoor navigation system using A* algorithm across corridors, doors, stairs, elevators, and 2nd-floor building skywalks.
  - Visual node and edge graph editor (`node_editor/`).

---

## 2. Technology Stack & Runtime Architecture

### Zero-Bundler / Vanilla Architecture
The project does **not** use build tools (no Webpack, Vite, npm scripts, or Babel). It runs directly in modern browsers via standard ES6 scripts and CDN dependencies.

> **CRITICAL RULE**: Do not convert the project to an npm/bundler-based setup or introduce ES modules (`import`/`export`) unless explicitly instructed. Scripts rely on execution order and the global browser scope (`window`).

### Core Dependencies
- **Three.js** (`r128`): 3D scene, geometry generation, camera, lighting, and route path rendering.
- **OrbitControls**: Camera navigation (pan, tilt, zoom to cursor/pinch).
- **Tailwind CSS** (via CDN): Responsive UI overlays and panels.
- **Google Fonts (Inter)**: Typography.

### Dual-Layer Rendering Engine
1. **WebGL Canvas (`#canvas-container`)**:
   - Renders 3D geometry: slabs, walls, doors, stairs, furniture, territory landscape, BTI debug planes, and route tubes.
   - Walls use a minimal height (`BASE_WALL_HEIGHT = 0.35m`) for readable 2D/3D architectural views.
2. **2D Screen-Space Overlay Canvas (`#labels-overlay-canvas`)**:
   - Fixed overlay canvas synced with camera projection on every frame.
   - Draws crisp room numbers, icons, badges, and debug coordinate grids at native display pixel ratio (Retina support up to `2.5x`).

### Script Execution Order
Scripts in [`index.html`](index.html) must be loaded in the following strict order due to global dependencies:

1. [`js/state.js`](js/state.js): Global state (`STATE`), constants, building dimensions, and registries (`ROOMS_REGISTRY`, `DOORS_REGISTRY`, `WALLS_REGISTRY`, `SLABS_REGISTRY`, `STAIRS_REGISTRY`).
2. [`js/materials.js`](js/materials.js): Three.js materials registry (`MATERIALS`).
3. [`js/helpers.js`](js/helpers.js): Geometry builders for slabs, walls, doors, labels, BTI overlay planes, and room markers.
4. [`js/buildings/building1.js`](js/buildings/building1.js): Building 1 (Floors 1–7) geometry.
5. [`js/buildings/building2.js`](js/buildings/building2.js): Building 2 (Floors 1–3) geometry.
6. [`js/buildings/building3.js`](js/buildings/building3.js): Building 3 (Floors 1–2) geometry.
7. [`js/buildings/building4.js`](js/buildings/building4.js): Building 4 (Floors 1–3) geometry.
8. [`js/territory.js`](js/territory.js): Exterior grounds, paths, greenery, and fences.
9. [`js/controls.js`](js/controls.js): Camera controls, touch handlers, and view framing.
10. [`js/navigator.js`](js/navigator.js): `NAV_STATE`, `NavigationGraph`, `MinHeap`, A* routing, and path rendering.
11. [`js/ui.js`](js/ui.js): Search bar, modal dialogs, route cards, floor switch buttons, and settings.
12. [`js/main.js`](js/main.js): Scene setup, lighting, animation loop (`requestAnimationFrame`), and initialization.

---

## 3. Coordinate System & Geometry Conventions

All dimensions in the code are in virtual world units (meters).

- **Axes**:
  - `X`: West (-) to East (+)
  - `Y`: Vertical elevation (height). Floor elevation is calculated as:
    `y = (floor - 1) * BASE_FLOOR_STEP`
  - `Z`: North (-) to South (+)
- **Key Geometric Constants** (defined in [`js/state.js`](js/state.js)):
  - `BASE_WALL_HEIGHT = 0.35`: Keeps interior partitions visible in isometric view without occluding hallways.
  - `BASE_FLOOR_STEP = 2.65`: Vertical distance between adjacent floors.
  - `WALL_SINK = 0.025`: Offsets walls slightly into slabs to prevent z-fighting.
- **Campus Buildings**:
  - **Building 1** (Main Tower): Floors 1 to 7 (`X: [-24..24], Z: [-8..8]`).
  - **Building 2**: Floors 1 to 3 (`X: [16.5..72.0], Z: [-16.6..6.4]`).
  - **Building 3**: Floors 1 to 2 (`X: [-1.8..13.6], Z: [-61.8..-14.4]`).
  - **Building 4**: Floors 1 to 3 (`X: [27.5..68.8], Z: [-61.2..-24.6]` on Floor 1; `Z: [-61.2..-45.6]` on Floors 2–3).
  - **Skywalk Transitions**: High-level cross-building connections occur on **Floor 2**.

---

## 4. Navigation System & Graph Architecture

The navigation engine resides in [`js/navigator.js`](js/navigator.js).

### Data Structures
- **`NavigationGraph`**:
  - Stores nodes in a `Map<id, Node>` and adjacency lists in a `Map<id, Edge[]>`.
  - Node schema:
    ```js
    {
      id: "b1_f1_c1",        // Unique string identifier
      floor: 1,              // Floor number (1-7)
      bldg: 1,               // Building number (1-4)
      x: 12.5,               // X coordinate
      z: -18.2,              // Z coordinate
      type: "corridor",      // corridor | room | stair | elevator | transition | entrance | wc
      label: "Кабинет 101"   // Display name or room number
    }
    ```
  - Edge schema:
    ```js
    {
      to: "target_node_id",
      weight: 4.2,           // Traversal cost (distance + penalties)
      meta: {}               // Optional metadata (e.g. isElevator, isStair)
    }
    ```
- **`MinHeap`**:
  - Binary min-heap implementation used as a priority queue for A* exploration.

### Pathfinding Rules
1. **Wall & Obstacle Avoidance**:
   - Nodes are strictly placed in walkable areas (corridor centerlines, room entrances, stair landings).
   - Rooms connect to corridors only through designated door nodes. Zero wall crossings are permitted.
2. **Vertical Navigation**:
   - Staircases (LK-1, LK-2, LK-3) and elevators connect identical X/Z coordinates across different floors.
   - Vertical transitions incur edge weights reflecting physical stairs effort.
   - Elevators are disabled by default (`allowElevators: false`) and can be enabled via UI settings.
3. **Route Rendering**:
   - Active routes are rendered as smooth 3D glowing tubes/ribbons (`routeFloorGroups`) per floor, updating dynamically when switching floor views.

### Visual Graph Editor (`node_editor/`)
- Located at [`node_editor/index.html`](node_editor/index.html) and [`node_editor/editor.js`](node_editor/editor.js).
- Provides an interactive visual tool to view, add, move, and connect nodes across floors directly on top of the 3D model geometry.
- Used to export and update node coordinates into `buildCollegeNavGraph()` in `js/navigator.js`.

---

## 5. Directory Structure

```
mgkct-3d/
├── index.html            # Main entry point and DOM layout
├── README.md             # Project documentation (in Russian)
├── AGENTS.md             # Developer & AI Agent specification
├── css/
│   └── style.css         # Glassmorphism UI, custom scrollbars, map HUD styles
├── js/
│   ├── state.js          # Global STATE, registry arrays, coordinate constants
│   ├── materials.js      # Three.js material definitions (slabs, walls, glass, accents)
│   ├── helpers.js        # Mesh generators, text canvases, room bounding helpers
│   ├── controls.js       # OrbitControls wrapper & touch/pointer gesture handler
│   ├── navigator.js      # A* engine, graph definitions, route path rendering
│   ├── territory.js      # Landscape, outdoor greenery, fences, road markings
│   ├── ui.js             # UI event handling, search modal, settings, notifications
│   ├── main.js           # Scene bootstrap, lighting, resize handler, render loop
│   ├── buildings/        # Floor-by-floor 3D models per building
│   │   ├── building1.js  # Floors 1–7
│   │   ├── building2.js  # Floors 1–3
│   │   ├── building3.js  # Floors 1–2
│   │   └── building4.js  # Floors 1–3
│   └── vendor/           # Local vendor copies (three.min.js, OrbitControls.js)
├── node_editor/          # Visual pathfinding node editor tool
│   ├── index.html
│   └── editor.js
├── planning_zip/         # Reference floor plans (Корпус 1..4/{1..7}.jpg)
├── tests/                # Automated campus navigation & adversarial test suites
└── .agents/
    └── skills/
        └── map-architecture-sync/ # Architectural verification & 2D blueprint sync harness (v2.0)
```

---

## 6. Local Development, Debugging & Testing

Since this project has no build step, you can serve it with any local static HTTP server:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js (npx)
npx serve .
```

Then navigate to:
- Main application: `http://localhost:8000/`
- Direct building/floor 2D telecentric view: `http://localhost:8000/?bldg=4&floor=1&top=1`
- Full architectural debug view (coordinate grid + BTI overlay + door markers): `http://localhost:8000/?bldg=4&floor=1&top=1&debug=1`
- Node editor: `http://localhost:8000/node_editor/`

### Automated Verification Suites
Always run these before finishing any geometry or navigation changes:
```bash
# Fast architectural & navigation linter across all 15 floors:
node .agents/skills/map-architecture-sync/scripts/validate_floor.js

# Full campus-wide navigation & wall-collision test suite:
node tests/validate_campus_navigation.js
```

---

## 7. Guidelines for AI Agents

1. **No Auto-Commit Policy**:
   - Never execute `git commit` autonomously. Only stage/edit files and leave them in the working tree for user review. Only commit if the user explicitly instructs you to do so (e.g., "commit changes").
2. **Preserve Code Comments**:
   - The codebase contains descriptive Russian comments and docstrings explaining coordinates, offsets, and geometry formulas. Always preserve existing comments and documentation unless specifically asked to refactor them.
3. **Global Scope Awareness**:
   - Code modules share objects on `window` (`window.STATE`, `window.NAV_STATE`, `window.MATERIALS`, `window.scene`, etc.). Be mindful of global variable naming collisions.
4. **Git Commit Messages**:
   - When asked to commit, follow Conventional Commits (e.g., `feat(navigator): ...`, `fix(map): ...`, `refactor(bldg2): ...`).

---

## 8. Architectural Floor Plan Verification Harness (v2.0)

When modifying or verifying floor layouts, walls, doors, or rooms, ALWAYS follow the workspace skill:
[`.agents/skills/map-architecture-sync/SKILL.md`](.agents/skills/map-architecture-sync/SKILL.md)

- **Strict Blueprint Adherence**: All wall, door, room, and corridor coordinates must match the official BTI blueprints in `planning_zip/Корпус <1..4>/<этаж>.jpg`. Unprompted deviations from the blueprints are strictly prohibited.
- **No Coordinate Guessing**: Never guess `(X, Z)` coordinates from a plain screenshot. Run `node .agents/skills/map-architecture-sync/scripts/capture_floor.js --building <B> --floor <F>` and inspect `.agents/skills/map-architecture-sync/captures/overlay_bldg<B>_floor<F>.png`, which plots the red BTI blueprint, blue 3D walls, green doors, and 1m/2m world coordinate grid `(X, Z)` on a single image.
- **Automated Linter**: Run `node .agents/skills/map-architecture-sync/scripts/validate_floor.js` and `node tests/validate_campus_navigation.js` to verify `0` wall collisions, `100%` room reachability, and aligned staircase shafts across all floors.
