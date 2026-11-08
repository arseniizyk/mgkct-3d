'use strict';

/**
 * vm_loader.js
 *
 * Shared Zero-Bundler script loader for Node.js VM test suites and BTI linters.
 * Maps both legacy logical bundle names ('js/materials.js', 'js/navigator.js', etc.)
 * and direct modular file paths to the canonical split script files.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '../..');

const LOGICAL_BUNDLE_MAP = {
    'js/state.js': [
        'js/state.js'
    ],
    'js/materials.js': [
        'js/materials/timetable-data.js',
        'js/materials/timetable-board.js',
        'js/materials/timetable-textures.js',
        'js/materials/palettes-and-core.js',
        'js/materials/territory-materials.js'
    ],
    'js/helpers.js': [
        'js/helpers/slabs-and-cache.js',
        'js/helpers/walls-overlaps.js',
        'js/helpers/walls-junctions.js',
        'js/helpers/walls-chamfer-and-segments.js',
        'js/helpers/walls-edges.js',
        'js/helpers/walls-flush.js',
        'js/helpers/labels-3d-and-grid.js',
        'js/helpers/labels-screen-overlay.js',
        'js/helpers/stairs-and-roofs.js'
    ],
    'js/buildings/building1.js': [
        'js/buildings/bldg1/common.js',
        'js/buildings/bldg1/floors-5-to-7.js',
        'js/buildings/bldg1/floors-2-to-4.js',
        'js/buildings/bldg1/floor1.js'
    ],
    'js/buildings/building2.js': [
        'js/buildings/bldg2/common-and-floor1.js',
        'js/buildings/bldg2/floors-2-to-3.js'
    ],
    'js/buildings/building3.js': [
        'js/buildings/bldg3/common.js',
        'js/buildings/bldg3/floor1.js',
        'js/buildings/bldg3/floor2.js'
    ],
    'js/buildings/building4.js': [
        'js/buildings/bldg4/common.js',
        'js/buildings/bldg4/floor1-south.js',
        'js/buildings/bldg4/floor1-kitchen.js',
        'js/buildings/bldg4/floor2.js',
        'js/buildings/bldg4/floor3.js'
    ],
    'js/buildings/building5.js': [
        'js/buildings/building5.js'
    ],
    'js/territory.js': [
        'js/territory/core.js',
        'js/territory/main-road.js',
        'js/territory/bus-stop-shelter.js',
        'js/territory/bus-stop-amenities.js',
        'js/territory/driveways-and-plaza.js',
        'js/territory/park-benches-and-bins.js',
        'js/territory/bike-bollards-and-promenade.js',
        'js/territory/landscaping-and-curbs.js',
        'js/territory/road-markings.js',
        'js/territory/trees-birch-and-linden.js',
        'js/territory/trees-spruce-and-shrubs.js',
        'js/territory/street-signs-and-gates.js',
        'js/territory/ring-road.js',
        'js/territory/traffic-lights-and-fence.js'
    ],
    'js/controls.js': [
        'js/controls/orbit-and-bounds.js',
        'js/controls/view-and-picking.js'
    ],
    'js/navigator.js': [
        'js/nav/nav-core.js',
        'js/nav/data/bldg1-f1.js',
        'js/nav/data/bldg1-f2.js',
        'js/nav/data/bldg1-f3.js',
        'js/nav/data/bldg1-f4.js',
        'js/nav/data/bldg1-f5.js',
        'js/nav/data/bldg1-f6.js',
        'js/nav/data/bldg1-f7-and-outdoor.js',
        'js/nav/data/bldg2-f1.js',
        'js/nav/data/bldg2-f2.js',
        'js/nav/data/bldg2-f3.js',
        'js/nav/data/bldg3-f1.js',
        'js/nav/data/bldg3-f2.js',
        'js/nav/data/bldg4-f1.js',
        'js/nav/data/bldg4-f2-f3.js',
        'js/nav/graph-builder.js',
        'js/nav/astar-and-instructions.js',
        'js/nav/route-3d-geometry.js',
        'js/nav/route-3d-render.js',
        'js/nav/route-screen-badges.js',
        'js/nav/route-controller.js',
        'js/nav/route-card-ui.js',
        'js/nav/navigator-modal.js',
        'js/nav/autocomplete.js',
        'js/nav/nav-init.js',
        'js/nav/nav-chips-and-url.js'
    ],
    'js/ui.js': [
        'js/ui/theme.js',
        'js/ui/building-and-floor-modes.js',
        'js/ui/camera-and-view-controls.js',
        'js/ui/room-disciplines.js',
        'js/ui/history-and-search-modal.js',
        'js/ui/search-gestures.js',
        'js/ui/search-results.js',
        'js/ui/settings-and-viewport.js',
        'js/ui/ui-init-and-popup-show.js',
        'js/ui/room-popup-actions.js',
        'js/ui/feedback.js'
    ],
    'js/main.js': [
        'js/main/scene-init.js',
        'js/main/url-and-bti-overlay.js',
        'js/main/guides-and-roofs.js',
        'js/main/occlusion-3d.js',
        'js/main/visibility-and-walls.js',
        'js/main/render-loop.js'
    ],
    'js/telemetry.js': [
        'js/telemetry.js'
    ]
};

function resolveLogicalScripts(relPath) {
    const normalized = relPath.replace(/\\/g, '/');
    return LOGICAL_BUNDLE_MAP[normalized] || [normalized];
}

function loadScriptIntoContext(relPath, context, rootDir = ROOT_DIR) {
    const files = resolveLogicalScripts(relPath);
    for (const file of files) {
        const fullPath = path.join(rootDir, file);
        const code = fs.readFileSync(fullPath, 'utf8');
        vm.runInContext(code, context, { filename: file });
    }
}

module.exports = {
    ROOT_DIR,
    LOGICAL_BUNDLE_MAP,
    resolveLogicalScripts,
    loadScriptIntoContext
};
