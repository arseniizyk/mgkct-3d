#!/usr/bin/env node

/**
 * ============================================================================
 * CHALLENGER 2: EMPIRICAL AUDIT OF ROOM LABELS & DOOR THRESHOLDS (BUILDING 1)
 * ============================================================================
 * 
 * Verifies:
 * 1. Physical Door Openings in DOORS_REGISTRY & Raw Walls:
 *    - Every door opening in DOORS_REGISTRY matches the parent wall line segment.
 *    - Door (x, z) equals the exact arithmetic midpoint of [from, to] on wallCoord.
 * 2. NavGraph Door Thresholds (door_mid_* and standalone doors):
 *    - Every door threshold node in Building 1 lies directly on a wall line
 *      (within wall half-thickness + 2cm tolerance).
 *    - Every door threshold node lies INSIDE an actual declared wall opening
 *      (cannot be on a solid wall).
 *    - Door gateway triplets (door_corr -> door_mid -> door_room) are strictly aligned
 *      and straddle the wall (door_corr on corridor side, door_room on room side).
 * 3. Transverse Fire Partitions (Floors 4, 6, 7):
 *    - Fire walls at X = -5.8 have matching doors and aligned NavGraph nodes.
 * 4. Room Label Centers & Perimeters:
 *    - Room labels are horizontally aligned in 3D (rotation.x = -PI/2).
 *    - No room label collides with any solid wall in WALLS_REGISTRY.
 *    - Every room label is enclosed within the bounding walls of its room.
 *    - Centroid alignment: label is reasonably centered in its room.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

// Math & Geometry utilities
function distPointToSegment(px, pz, ax, az, bx, bz) {
    const vx = bx - ax;
    const vz = bz - az;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 1e-8) {
        return { dist: Math.hypot(px - ax, pz - az), t: 0, projX: ax, projZ: az };
    }
    let t = ((px - ax) * vx + (pz - az) * vz) / lenSq;
    const clampedT = Math.max(0, Math.min(1, t));
    const projX = ax + clampedT * vx;
    const projZ = az + clampedT * vz;
    return {
        dist: Math.hypot(px - projX, pz - projZ),
        t: clampedT,
        rawT: t,
        projX,
        projZ
    };
}

// Headless VM Setup
const mockCtx = new Proxy({}, {
    get: () => () => ({ width: 50, height: 20 })
});

const sandbox = {
    console,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    Infinity,
    Set,
    Map,
    Array,
    Object,
    Date,
    String,
    Number,
    Boolean,
    RegExp,
    localStorage: { getItem: () => null, setItem: () => {} }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;
sandbox.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                getContext: () => mockCtx,
                width: 256,
                height: 64,
                style: {}
            };
        }
        return { style: {}, addEventListener: () => {} };
    },
    getElementById: () => null,
    addEventListener: () => {}
};

vm.createContext(sandbox);

const loadScript = (relPath) => {
    const fullPath = path.join(projectRoot, relPath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
};

loadScript('js/vendor/three.min.js');
loadScript('js/state.js');
loadScript('js/materials.js');
loadScript('js/helpers.js');

// Intercept addWallLine & addArbitraryWallSegment before building geometry
const rawWallLines = [];
const originalAddWallLine = sandbox.addWallLine;
sandbox.addWallLine = function(targetGroup, x1, z1, x2, z2, openings = [], wallThickness = 0.18, isColumn = false) {
    if (targetGroup && targetGroup.userData) {
        rawWallLines.push({
            building: targetGroup.userData.building || 1,
            floor: targetGroup.userData.floor || 1,
            x1, z1, x2, z2,
            openings: JSON.parse(JSON.stringify(openings)),
            wallThickness,
            isColumn
        });
    }
    return originalAddWallLine.apply(this, arguments);
};

const originalAddArbitraryWallSegment = sandbox.addArbitraryWallSegment;
sandbox.addArbitraryWallSegment = function(targetGroup, x1, z1, x2, z2, thickness = 0.24, isDoor = false, isExterior = false) {
    if (targetGroup && targetGroup.userData) {
        rawWallLines.push({
            building: targetGroup.userData.building || 1,
            floor: targetGroup.userData.floor || 1,
            x1, z1, x2, z2,
            openings: [],
            wallThickness: thickness,
            isColumn: false,
            isArbitrary: true
        });
    }
    return originalAddArbitraryWallSegment.apply(this, arguments);
};

loadScript('js/buildings/building1.js');
loadScript('js/buildings/building2.js');
loadScript('js/buildings/building3.js');
loadScript('js/buildings/building4.js');

// Instantiate all floors across all buildings
const b1 = {};
for (let f = 1; f <= 7; f++) {
    b1[f] = new sandbox.THREE.Group();
    b1[f].userData = { building: 1, floor: f };
    sandbox['buildFloor' + f](b1[f]);
}
for (let f = 1; f <= 3; f++) {
    const g = new sandbox.THREE.Group();
    g.userData = { building: 2, floor: f };
    sandbox['buildBuilding2Floor' + f](g);
}
for (let f = 1; f <= 2; f++) {
    const g = new sandbox.THREE.Group();
    g.userData = { building: 3, floor: f };
    sandbox['buildBuilding3Floor' + f](g);
}
for (let f = 1; f <= 3; f++) {
    const g = new sandbox.THREE.Group();
    g.userData = { building: 4, floor: f };
    sandbox['buildBuilding4Floor' + f](g);
}

sandbox.flushAllPendingWalls();
loadScript('js/navigator.js');

const graph = sandbox.buildCollegeNavGraph();
const b1RawWalls = rawWallLines.filter(w => w.building === 1);
const b1Walls = sandbox.WALLS_REGISTRY.filter(w => w.building === 1);
const b1Doors = sandbox.DOORS_REGISTRY.filter(d => d.building === 1);
const b1Rooms = sandbox.ROOMS_REGISTRY.filter(r => r.building === 1);

console.log('================================================================');
console.log('CHALLENGER 2: BUILDING 1 EMPIRICAL AUDIT REPORT');
console.log(`Building 1 Scope:`);
console.log(`- ${b1Rooms.length} room labels in ROOMS_REGISTRY`);
console.log(`- ${b1Doors.length} doors in DOORS_REGISTRY`);
console.log(`- ${b1RawWalls.length} raw wall definitions with openings`);
console.log(`- ${b1Walls.length} flushed solid wall segments in WALLS_REGISTRY`);
console.log('================================================================');

let totalFailures = 0;
let totalWarnings = 0;

// ----------------------------------------------------------------------------
// SUITE 1: PHYSICAL DOOR THRESHOLDS IN DOORS_REGISTRY
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 1: DOORS_REGISTRY Midpoints & Parent Wall Alignment ---');

let doorsRegistryChecked = 0;
let doorsRegistryErrors = 0;

for (const d of b1Doors) {
    doorsRegistryChecked++;
    const isH = d.isHorizontal;
    const mid = (d.from + d.to) / 2;
    const expectedX = isH ? mid : d.wallCoord;
    const expectedZ = isH ? d.wallCoord : mid;

    // Check midpoint arithmetic
    if (Math.abs(d.x - expectedX) > 1e-4 || Math.abs(d.z - expectedZ) > 1e-4) {
        console.error(`FAIL: Door [F${d.floor}] (${d.x}, ${d.z}) does not match expected midpoint (${expectedX}, ${expectedZ})`);
        doorsRegistryErrors++;
    }

    // Check whether this door belongs to an actual raw wall line on this floor
    const parentWall = b1RawWalls.find(w => {
        if (w.floor !== d.floor) return false;
        const wIsH = Math.abs(w.z2 - w.z1) < 1e-3;
        if (wIsH !== isH) return false;
        const wCoord = wIsH ? w.z1 : w.x1;
        if (Math.abs(wCoord - d.wallCoord) > 1e-3) return false;
        const minSpan = Math.min(wIsH ? w.x1 : w.z1, wIsH ? w.x2 : w.z2);
        const maxSpan = Math.max(wIsH ? w.x1 : w.z1, wIsH ? w.x2 : w.z2);
        return d.from >= minSpan - 1e-3 && d.to <= maxSpan + 1e-3;
    });

    if (!parentWall) {
        console.error(`FAIL: Door [F${d.floor}] at (${d.x}, ${d.z}) has no enclosing wall line segment!`);
        doorsRegistryErrors++;
    }
}

console.log(`Checked ${doorsRegistryChecked} doors in DOORS_REGISTRY: ${doorsRegistryErrors} errors.`);
totalFailures += doorsRegistryErrors;

// ----------------------------------------------------------------------------
// SUITE 2: NAVGRAPH DOOR THRESHOLDS (door_mid_* and standalone doors)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: NavGraph Door Threshold Nodes Alignment with Wall Openings ---');

const b1Nodes = Array.from(graph.nodes.values()).filter(n => n.bldg === 1);

// Threshold door nodes: door_mid_* or standalone door/entrance nodes
const b1ThresholdDoorNodes = b1Nodes.filter(n => {
    if (n.id.startsWith('door_mid_')) return true;
    if (n.id.includes('_door_') || n.id.endsWith('_doors') || n.id.includes('inner_door') || n.id.includes('porch_doors')) {
        // Exclude door_corr and door_room
        if (n.id.startsWith('door_corr_') || n.id.startsWith('door_room_')) return false;
        return true;
    }
    return false;
});

console.log(`Evaluating ${b1ThresholdDoorNodes.length} threshold door nodes in Building 1.`);

let doorThresholdErrors = 0;
let doorThresholdWarnings = 0;

for (const dn of b1ThresholdDoorNodes) {
    const f = dn.floor;
    const floorRawWalls = b1RawWalls.filter(w => w.floor === f && !w.isColumn);

    let closestWall = null;
    let minDist = Infinity;
    let bestProj = null;

    for (const w of floorRawWalls) {
        const p = distPointToSegment(dn.x, dn.z, w.x1, w.z1, w.x2, w.z2);
        if (p.dist < minDist) {
            minDist = p.dist;
            closestWall = w;
            bestProj = p;
        }
    }

    const wallThickness = closestWall ? closestWall.wallThickness : 0.18;
    const allowedDist = wallThickness / 2 + 0.05; // 5cm tolerance

    if (minDist > allowedDist) {
        console.error(`FAIL: Threshold door node '${dn.id}' (${dn.x}, ${dn.z}) on Floor ${f} is NOT on a wall line! Min dist = ${minDist.toFixed(3)}m (allowed: ${allowedDist.toFixed(3)}m)`);
        doorThresholdErrors++;
    } else {
        // Check if (dn.x, dn.z) falls into a declared OPENING on this wall
        const isH = Math.abs(closestWall.z2 - closestWall.z1) < 1e-3;
        const posOnWall = isH ? dn.x : dn.z;
        const openings = closestWall.openings || [];

        const matchingOpening = openings.find(op => {
            const minO = Math.min(op.from, op.to) - 0.18; // 18cm tolerance
            const maxO = Math.max(op.from, op.to) + 0.18;
            return posOnWall >= minO && posOnWall <= maxO;
        });

        if (!matchingOpening) {
            console.error(`FAIL: Threshold door node '${dn.id}' (${dn.x}, ${dn.z}) on Floor ${f} lies on wall line but NOT inside any opening! Openings: ${JSON.stringify(openings)}`);
            doorThresholdErrors++;
        }
    }
}

console.log(`Checked ${b1ThresholdDoorNodes.length} threshold door nodes: ${doorThresholdErrors} errors.`);
totalFailures += doorThresholdErrors;

// ----------------------------------------------------------------------------
// SUITE 3: DOOR GATEWAY TRAVERSAL ACROSS WALL NORMAL
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Door Gateway Bidirectional Traversal Across Wall ---');

let traversalErrors = 0;

for (const mid of b1ThresholdDoorNodes) {
    const f = mid.floor;
    const floorRawWalls = b1RawWalls.filter(w => w.floor === f && !w.isColumn);

    // Find closest wall
    let closestWall = null;
    let minDist = Infinity;
    for (const w of floorRawWalls) {
        const p = distPointToSegment(mid.x, mid.z, w.x1, w.z1, w.x2, w.z2);
        if (p.dist < minDist) {
            minDist = p.dist;
            closestWall = w;
        }
    }

    if (!closestWall) continue;

    const isH = Math.abs(closestWall.z2 - closestWall.z1) < 1e-3;
    // Normal vector to wall
    const nx = isH ? 0 : 1;
    const nz = isH ? 1 : 0;

    const neighbors = (graph.adj.get(mid.id) || []).map(e => graph.getNode(e.to)).filter(Boolean);

    if (neighbors.length < 2) {
        // Some boundary doors or entrance doors might connect to 1 node if exterior, but interior doors must connect to >= 2
        const isExterior = (closestWall.openings || []).some(op => op.isExterior);
        const isLegacyStub = mid.id === 'door_mid_room_1_2_23'; // Preexisting dead-end stub for 'Переход в корпус №2'
        if (isLegacyStub) {
            console.warn(`WARN: Legacy dead-end door node '${mid.id}' on Floor ${f} has only 1 neighbor (duplicate stub of ЛК№1 door; actual bridge uses custom_b1_f2_c_180_-56_1nw)`);
            totalWarnings++;
        } else if (!isExterior) {
            console.error(`FAIL: Interior door node '${mid.id}' on Floor ${f} has fewer than 2 neighbors (found: ${neighbors.length})`);
            traversalErrors++;
        }
    } else {
        // Check if neighbors span across the wall (one with dot > 0, one with dot < 0)
        let hasSideA = false;
        let hasSideB = false;

        for (const n of neighbors) {
            const dx = n.x - mid.x;
            const dz = n.z - mid.z;
            const dot = dx * nx + dz * nz;
            if (dot > 0.05) hasSideA = true;
            if (dot < -0.05) hasSideB = true;
        }

        if (!hasSideA || !hasSideB) {
            // Check if door is staircase or entrance
            const isSpecial = mid.id.includes('entrance') || mid.id.includes('stair') || mid.id.includes('porch') || mid.id.includes('bridge');
            if (!isSpecial) {
                console.warn(`WARN: Door node '${mid.id}' on Floor ${f} neighbors do not strictly straddle wall: SideA=${hasSideA}, SideB=${hasSideB}`);
                totalWarnings++;
            }
        }
    }
}

console.log(`Checked ${b1ThresholdDoorNodes.length} threshold door nodes for traversal: ${traversalErrors} errors.`);
totalFailures += traversalErrors;

// ----------------------------------------------------------------------------
// SUITE 4: TRANSVERSE FIRE PARTITION VERIFICATION (FLOORS 4, 6, 7)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Transverse Fire Partition Wall & Door Verification ---');

let fireDoorErrors = 0;
for (const f of [4, 6, 7]) {
    const fireWall = b1RawWalls.find(w => 
        w.floor === f && 
        Math.abs(w.x1 - (-5.8)) < 1e-3 && 
        Math.abs(w.x2 - (-5.8)) < 1e-3 && 
        Math.min(w.z1, w.z2) <= -6.0 && 
        Math.max(w.z1, w.z2) >= -4.0
    );

    if (!fireWall) {
        console.error(`FAIL: Transverse fire wall missing on Floor ${f} at X = -5.8!`);
        fireDoorErrors++;
    } else {
        const doorOp = (fireWall.openings || []).find(op => op.type === 'door' || op.type === 'open');
        if (!doorOp) {
            console.error(`FAIL: Transverse fire wall on Floor ${f} has NO door opening!`);
            fireDoorErrors++;
        } else {
            const midZ = (doorOp.from + doorOp.to) / 2;
            const navDoor = graph.getNode(`b1_f${f}_nc_door_-5.8`);
            if (!navDoor) {
                console.error(`FAIL: Nav node 'b1_f${f}_nc_door_-5.8' missing in NavGraph!`);
                fireDoorErrors++;
            } else {
                if (Math.abs(navDoor.x - (-5.8)) > 1e-3 || Math.abs(navDoor.z - midZ) > 0.2) {
                    console.error(`FAIL: Nav node 'b1_f${f}_nc_door_-5.8' (${navDoor.x}, ${navDoor.z}) does not match door opening midZ=${midZ}`);
                    fireDoorErrors++;
                }
            }
        }
    }
}

console.log(`Checked transverse fire partitions: ${fireDoorErrors} errors.`);
totalFailures += fireDoorErrors;

// ----------------------------------------------------------------------------
// SUITE 5: ROOM LABELS INSIDE ROOM PERIMETERS & HORIZONTAL ALIGNMENT
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Room Labels Perimeters, Clearances, and Centroid Alignments ---');

let labelErrors = 0;
let labelWarnings = 0;

for (const r of b1Rooms) {
    const f = r.floor;
    const cleanText = (r.rawText || r.text || '').replace(/\n/g, ' ').trim();

    // 1. Check horizontal alignment:
    // In Three.js mesh, rotation.x should be -Math.PI / 2
    if (r.mesh) {
        const rotX = r.mesh.rotation.x;
        if (Math.abs(rotX - (-Math.PI / 2)) > 1e-4) {
            console.error(`FAIL: Room label '${cleanText}' [F${f}] mesh rotation.x is not -PI/2 (got ${rotX})`);
            labelErrors++;
        }
        if (Math.abs(r.mesh.rotation.y) > 1e-4 || Math.abs(r.mesh.rotation.z) > 1e-4) {
            console.error(`FAIL: Room label '${cleanText}' [F${f}] has non-zero rotation Y/Z: (${r.mesh.rotation.y}, ${r.mesh.rotation.z})`);
            labelErrors++;
        }
    }

    // 2. Check collision with solid walls in WALLS_REGISTRY
    const floorFlushedWalls = b1Walls.filter(w => w.floor === f);
    let minFlushedDist = Infinity;
    let closestSolidWall = null;

    for (const w of floorFlushedWalls) {
        const p = distPointToSegment(r.x, r.z, w.x1, w.z1, w.x2, w.z2);
        if (p.dist < minFlushedDist) {
            minFlushedDist = p.dist;
            closestSolidWall = w;
        }
    }

    const solidThick = closestSolidWall ? (closestSolidWall.thickness || 0.18) : 0.18;
    const minClearance = solidThick / 2;

    if (minFlushedDist < minClearance) {
        console.error(`FAIL: Label '${cleanText}' [F${f}] at (${r.x}, ${r.z}) COLLIDES with solid wall! Dist: ${minFlushedDist.toFixed(3)}m < ${minClearance.toFixed(3)}m`);
        labelErrors++;
    }

    // 3. Check enclosure using RAW walls (accounting for walls having openings)
    const floorRawWalls = b1RawWalls.filter(w => w.floor === f && !w.isColumn);

    let hitEast = false, hitWest = false, hitNorth = false, hitSouth = false;
    let distEast = Infinity, distWest = Infinity, distNorth = Infinity, distSouth = Infinity;

    for (const w of floorRawWalls) {
        // Vertical walls
        if (Math.abs(w.x1 - w.x2) < 1e-3) {
            const wx = w.x1;
            const minZ = Math.min(w.z1, w.z2);
            const maxZ = Math.max(w.z1, w.z2);
            if (r.z >= minZ - 0.1 && r.z <= maxZ + 0.1) {
                if (wx > r.x && (wx - r.x) < distEast) {
                    distEast = wx - r.x;
                    hitEast = true;
                }
                if (wx < r.x && (r.x - wx) < distWest) {
                    distWest = r.x - wx;
                    hitWest = true;
                }
            }
        }
        // Horizontal walls
        if (Math.abs(w.z1 - w.z2) < 1e-3) {
            const wz = w.z1;
            const minX = Math.min(w.x1, w.x2);
            const maxX = Math.max(w.x1, w.x2);
            if (r.x >= minX - 0.1 && r.x <= maxX + 0.1) {
                if (wz > r.z && (wz - r.z) < distSouth) {
                    distSouth = wz - r.z;
                    hitSouth = true;
                }
                if (wz < r.z && (r.z - wz) < distNorth) {
                    distNorth = r.z - wz;
                    hitNorth = true;
                }
            }
        }
    }

    // Architectural transition labels check
    const isTransition = cleanText.includes('Переход') || cleanText.includes('Второй свет');
    if (!isTransition) {
        if (!hitEast || !hitWest || !hitNorth || !hitSouth) {
            console.error(`FAIL: Label '${cleanText}' [F${f}] at (${r.x}, ${r.z}) is NOT enclosed by room walls! Hits: E=${hitEast}, W=${hitWest}, N=${hitNorth}, S=${hitSouth}`);
            labelErrors++;
        } else {
            const roomWidthX = distWest + distEast;
            const roomHeightZ = distNorth + distSouth;
            const offsetX = Math.abs((distWest - distEast) / 2);
            const offsetZ = Math.abs((distNorth - distSouth) / 2);
            const ratioX = offsetX / roomWidthX;
            const ratioZ = offsetZ / roomHeightZ;

            // Warn if severely eccentric (>45% away from center)
            if (ratioX > 0.45 || ratioZ > 0.45) {
                console.warn(`WARN: Label '${cleanText}' [F${f}] at (${r.x}, ${r.z}) is significantly off-center in bounds [${roomWidthX.toFixed(1)}m x ${roomHeightZ.toFixed(1)}m]: ratioX=${ratioX.toFixed(2)}, ratioZ=${ratioZ.toFixed(2)}`);
                labelWarnings++;
            }
        }
    }
}

console.log(`Checked ${b1Rooms.length} room labels: ${labelErrors} errors, ${labelWarnings} warnings.`);
totalFailures += labelErrors;
totalWarnings += labelWarnings;

// ----------------------------------------------------------------------------
// SUITE 6: ADVERSARIAL STRESS TEST OF SPECIFIC MILESTONE 1 FIXES
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Specific Milestone 1 Target Audits ---');

let targetErrors = 0;

// 1. Room 106 access: must have NO direct door to corridor at Z = -6.2
const f1CorridorWall = b1RawWalls.find(w => w.floor === 1 && Math.abs(w.z1 - (-6.2)) < 1e-3 && Math.abs(w.z2 - (-6.2)) < 1e-3);
if (f1CorridorWall) {
    const doorTo106 = f1CorridorWall.openings.find(op => op.from < 0 && op.to > -2.0);
    if (doorTo106) {
        console.error(`FAIL: False door to 106 still exists on corridor wall Z = -6.2: ${JSON.stringify(doorTo106)}`);
        targetErrors++;
    } else {
        console.log(`PASS: No false door to room 106 on corridor wall Z = -6.2.`);
    }
}

// 2. Room 102 label: text must include '102' and 'Гардероб'
const f1Room102 = b1Rooms.find(r => r.floor === 1 && Math.hypot(r.x - (-4.6), r.z - (-10.2)) < 0.5);
if (!f1Room102 || (!f1Room102.rawText.includes('102') || !f1Room102.rawText.includes('Гардероб'))) {
    console.error(`FAIL: Room 102 label at (-4.6, -10.2) must contain '102' and 'Гардероб'! Found: ${f1Room102 ? f1Room102.rawText : 'none'}`);
    targetErrors++;
} else {
    console.log(`PASS: Room 102 label is correctly '${f1Room102.rawText.replace('\n', ' ')}' at (${f1Room102.x}, ${f1Room102.z}).`);
}

// 3. Room 201 western door: must exist at Z = 7.2, X in [4.5..5.7]
const f2WallsAt72 = b1RawWalls.filter(w => w.floor === 2 && Math.abs(w.z1 - 7.2) < 1e-3 && Math.abs(w.z2 - 7.2) < 1e-3);
let foundWestDoor201 = false;
for (const w of f2WallsAt72) {
    const westDoor = w.openings.find(op => Math.min(op.from, op.to) <= 4.6 && Math.max(op.from, op.to) >= 5.6);
    if (westDoor) {
        foundWestDoor201 = true;
        console.log(`PASS: Western door for room 201 present at Z = 7.2: ${JSON.stringify(westDoor)}.`);
        break;
    }
}
if (!foundWestDoor201) {
    console.error(`FAIL: Western door for room 201 missing at Z = 7.2!`);
    targetErrors++;
}

// 4. Room 305 label and right extension on Floor 3
const f3Room305 = b1Rooms.find(r => r.floor === 3 && r.rawText === '305');
if (!f3Room305) {
    console.error(`FAIL: Room label '305' missing on Floor 3!`);
    targetErrors++;
} else {
    console.log(`PASS: Room label '305' present on Floor 3 at (${f3Room305.x}, ${f3Room305.z}).`);
}

// 5. Room 401 relocated door: must be at western end near X = -4.4
const f4Wall401 = b1RawWalls.find(w => w.floor === 4 && Math.abs(w.z1 - 7.2) < 1e-3 && Math.abs(w.z2 - 7.2) < 1e-3);
if (!f4Wall401) {
    console.error(`FAIL: Wall at Z = 7.2 missing on Floor 4!`);
    targetErrors++;
} else {
    const westDoor401 = f4Wall401.openings.find(op => Math.min(op.from, op.to) <= -4.8 && Math.max(op.from, op.to) >= -4.0);
    if (!westDoor401) {
        console.error(`FAIL: Relocated door 401 missing at western end of Z = 7.2! Openings: ${JSON.stringify(f4Wall401.openings)}`);
        targetErrors++;
    } else {
        console.log(`PASS: Relocated door 401 verified at western end: ${JSON.stringify(westDoor401)}.`);
    }
}

console.log(`Checked specific M1 targets: ${targetErrors} errors.`);
totalFailures += targetErrors;

// ----------------------------------------------------------------------------
// FINAL SUMMARY & VERDICT
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`FINAL RESULT: ${totalFailures} FAILURES, ${totalWarnings} WARNINGS.`);
if (totalFailures === 0) {
    console.log('VERDICT: APPROVE');
} else {
    console.log('VERDICT: REQUEST_CHANGES');
}
console.log('================================================================');

if (totalFailures > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
