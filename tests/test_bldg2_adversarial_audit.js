#!/usr/bin/env node

/**
 * ============================================================================
 * EMPIRICAL CHALLENGER: AUDIT OF BUILDING 2 ROOM LABELS & PERIMETERS
 * ============================================================================
 * 
 * Adversarially challenges Building 2:
 * 1. Room label centers and perimeters (enclosure, centering/eccentricity)
 * 2. Specific focus labels:
 *    - LK №3 label (Floor 1)
 *    - Room 104 ('104\nБиблиотека', Floor 1)
 *    - Room 308 ('308\nСпортивный зал', Floor 3)
 *    - Room 312 ('312\nКонференц-зал', Floor 3)
 * 3. Horizontal orientation verification (3D mesh rotation & 2D screen overlay)
 * 4. Wall collision analysis:
 *    - Point-to-wall clearance (center point vs solid walls)
 *    - 3D label bounding box vs solid walls
 *    - NavGraph node & edge wall collisions in Building 2
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

// Math utilities
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

function segSegIntersection(x1, z1, x2, z2, x3, z3, x4, z4) {
    const denom = (z4 - z3) * (x2 - x1) - (x4 - x3) * (z2 - z1);
    if (Math.abs(denom) < 1e-9) return null;
    const ua = ((x4 - x3) * (z1 - z3) - (z4 - z3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (z1 - z3) - (z2 - z1) * (x1 - x3)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return {
            x: x1 + ua * (x2 - x1),
            z: z1 + ua * (z2 - z1),
            ua,
            ub
        };
    }
    return null;
}

// Headless VM environment
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
                width: 512,
                height: 256,
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

// Intercept raw wall lines
const rawWallLines = [];
const originalAddWallLine = sandbox.addWallLine;
sandbox.addWallLine = function(targetGroup, x1, z1, x2, z2, openings = [], wallThickness = 0.18, isColumn = false) {
    if (targetGroup && targetGroup.userData) {
        rawWallLines.push({
            building: targetGroup.userData.building || 2,
            floor: targetGroup.userData.floor || 1,
            x1, z1, x2, z2,
            openings: JSON.parse(JSON.stringify(openings)),
            wallThickness,
            isColumn
        });
    }
    return originalAddWallLine.apply(this, arguments);
};

loadScript('js/buildings/building1.js');
loadScript('js/buildings/building2.js');
loadScript('js/buildings/building3.js');
loadScript('js/buildings/building4.js');

// Instantiate Building 2 floors 1..3
const b2Groups = {};
for (let f = 1; f <= 3; f++) {
    b2Groups[f] = new sandbox.THREE.Group();
    b2Groups[f].userData = { building: 2, floor: f };
    sandbox['buildBuilding2Floor' + f](b2Groups[f]);
}

sandbox.flushAllPendingWalls();
loadScript('js/navigator.js');

const graph = sandbox.buildCollegeNavGraph();

const b2RawWalls = rawWallLines.filter(w => w.building === 2);
const b2FlushedWalls = sandbox.WALLS_REGISTRY.filter(w => w.building === 2);
const b2Rooms = sandbox.ROOMS_REGISTRY.filter(r => r.building === 2);

console.log('================================================================================');
console.log('       EMPIRICAL CHALLENGER: BUILDING 2 AUDIT HARNESS');
console.log('================================================================================');
console.log(`Building 2 Entities Loaded:`);
console.log(`  • Raw Walls      : ${b2RawWalls.length}`);
console.log(`  • Flushed Walls  : ${b2FlushedWalls.length}`);
console.log(`  • Registered Rooms: ${b2Rooms.length}`);

let totalErrors = 0;
let totalWarnings = 0;

// ============================================================================
// TEST 1: HORIZONTAL ORIENTATION OF ROOM LABELS (3D & 2D)
// ============================================================================
console.log('\n--- TEST 1: Horizontal Orientation of All Building 2 Room Labels ---');
let orientationErrors = 0;

for (const r of b2Rooms) {
    const cleanText = (r.rawText || r.text || '').replace(/\n/g, ' ').trim();
    if (!r.mesh) {
        console.error(`FAIL: Room label '${cleanText}' [F${r.floor}] has no 3D mesh!`);
        orientationErrors++;
        continue;
    }

    // Mesh rotation.x must be -Math.PI / 2 (flat facing upward)
    const rotX = r.mesh.rotation.x;
    if (Math.abs(rotX - (-Math.PI / 2)) > 1e-4) {
        console.error(`FAIL: Room label '${cleanText}' [F${r.floor}] rotation.x = ${rotX} (expected -PI/2 = -1.5708)`);
        orientationErrors++;
    }

    // Mesh rotation.y and rotation.z must be 0 (aligned along X axis, reading West to East)
    if (Math.abs(r.mesh.rotation.y) > 1e-4 || Math.abs(r.mesh.rotation.z) > 1e-4) {
        console.error(`FAIL: Room label '${cleanText}' [F${r.floor}] rotation Y/Z = (${r.mesh.rotation.y}, ${r.mesh.rotation.z}) (expected (0, 0))`);
        orientationErrors++;
    }
}

if (orientationErrors === 0) {
    console.log(`PASS: All ${b2Rooms.length} Building 2 room labels are strictly horizontally aligned (rotation.x = -PI/2, rot Y/Z = 0).`);
} else {
    console.error(`FAIL: ${orientationErrors} room labels failed horizontal orientation.`);
    totalErrors += orientationErrors;
}

// ============================================================================
// TEST 2: ROOM ENCLOSURE & CENTERING (PERIMETERS)
// ============================================================================
console.log('\n--- TEST 2: Room Enclosure & Bounding Box Centering ---');
let enclosureErrors = 0;
let eccentricityWarnings = 0;

const roomBoundsReport = [];

for (const r of b2Rooms) {
    const f = r.floor;
    const cleanText = (r.rawText || r.text || '').replace(/\n/g, ' ').trim();

    // Raycast in 4 cardinal directions against raw walls on this floor
    const floorRawWalls = b2RawWalls.filter(w => w.floor === f && !w.isColumn);

    let hitEast = false, hitWest = false, hitNorth = false, hitSouth = false;
    let distEast = Infinity, distWest = Infinity, distNorth = Infinity, distSouth = Infinity;
    let wallEast = null, wallWest = null, wallNorth = null, wallSouth = null;

    for (const w of floorRawWalls) {
        // Vertical wall
        if (Math.abs(w.x1 - w.x2) < 1e-3) {
            const wx = w.x1;
            const minZ = Math.min(w.z1, w.z2);
            const maxZ = Math.max(w.z1, w.z2);
            if (r.z >= minZ - 0.15 && r.z <= maxZ + 0.15) {
                if (wx > r.x && (wx - r.x) < distEast) {
                    distEast = wx - r.x;
                    hitEast = true;
                    wallEast = w;
                }
                if (wx < r.x && (r.x - wx) < distWest) {
                    distWest = r.x - wx;
                    hitWest = true;
                    wallWest = w;
                }
            }
        }
        // Horizontal wall
        if (Math.abs(w.z1 - w.z2) < 1e-3) {
            const wz = w.z1;
            const minX = Math.min(w.x1, w.x2);
            const maxX = Math.max(w.x1, w.x2);
            if (r.x >= minX - 0.15 && r.x <= maxX + 0.15) {
                if (wz > r.z && (wz - r.z) < distSouth) {
                    distSouth = wz - r.z;
                    hitSouth = true;
                    wallSouth = w;
                }
                if (wz < r.z && (r.z - wz) < distNorth) {
                    distNorth = r.z - wz;
                    hitNorth = true;
                    wallNorth = w;
                }
            }
        }
    }

    if (!hitEast || !hitWest || !hitNorth || !hitSouth) {
        console.error(`FAIL: Label '${cleanText}' [F${f}] at (${r.x}, ${r.z}) NOT enclosed! Missing: ` +
            `${!hitEast ? 'East ' : ''}${!hitWest ? 'West ' : ''}${!hitNorth ? 'North ' : ''}${!hitSouth ? 'South ' : ''}`);
        enclosureErrors++;
    } else {
        const roomWidthX = distWest + distEast;
        const roomDepthZ = distNorth + distSouth;
        const geomCenterX = r.x - distWest + roomWidthX / 2;
        const geomCenterZ = r.z - distNorth + roomDepthZ / 2;
        const offsetFromCenterX = r.x - geomCenterX;
        const offsetFromCenterZ = r.z - geomCenterZ;
        const eccentricityX = Math.abs(offsetFromCenterX) / (roomWidthX / 2);
        const eccentricityZ = Math.abs(offsetFromCenterZ) / (roomDepthZ / 2);

        roomBoundsReport.push({
            room: cleanText,
            floor: f,
            labelPos: `(${r.x}, ${r.z})`,
            bounds: `X [${(r.x - distWest).toFixed(2)}..${(r.x + distEast).toFixed(2)}], Z [${(r.z - distNorth).toFixed(2)}..${(r.z + distSouth).toFixed(2)}]`,
            size: `${roomWidthX.toFixed(2)}m x ${roomDepthZ.toFixed(2)}m`,
            geomCenter: `(${geomCenterX.toFixed(2)}, ${geomCenterZ.toFixed(2)})`,
            offset: `dx=${offsetFromCenterX.toFixed(2)}m, dz=${offsetFromCenterZ.toFixed(2)}m`,
            eccentricity: `ex=${(eccentricityX * 100).toFixed(1)}%, ez=${(eccentricityZ * 100).toFixed(1)}%`
        });

        // Warn if eccentricity exceeds 50%
        if (eccentricityX > 0.50 || eccentricityZ > 0.50) {
            console.warn(`WARN: Label '${cleanText}' [F${f}] eccentricity high: ex=${(eccentricityX * 100).toFixed(1)}%, ez=${(eccentricityZ * 100).toFixed(1)}%`);
            eccentricityWarnings++;
        }
    }
}

console.log(`Enclosure check: ${enclosureErrors} errors, ${eccentricityWarnings} eccentricity warnings.`);
totalErrors += enclosureErrors;
totalWarnings += eccentricityWarnings;

// ============================================================================
// TEST 3: SPECIFIC TARGET LABELS AUDIT (LK №3, 104, 308, 312)
// ============================================================================
console.log('\n--- TEST 3: Adversarial Audit of Specific Milestone 2 Focus Labels ---');

const focusLabels = [
    { name: 'LK №3', floor: 1, textPattern: /ЛК.*3/i },
    { name: 'Room 104', floor: 1, textPattern: /104/ },
    { name: 'Room 308', floor: 3, textPattern: /308/ },
    { name: 'Room 312', floor: 3, textPattern: /312/ }
];

for (const target of focusLabels) {
    const r = b2Rooms.find(rm => rm.floor === target.floor && target.textPattern.test(rm.rawText || rm.text));
    if (!r) {
        console.error(`FAIL: Target label '${target.name}' [F${target.floor}] NOT FOUND in ROOMS_REGISTRY!`);
        totalErrors++;
        continue;
    }

    const clean = (r.rawText || r.text).replace(/\n/g, ' ');
    console.log(`\n• Target: ${target.name} [F${target.floor}]`);
    console.log(`  Raw Text: "${JSON.stringify(r.rawText)}"`);
    console.log(`  Position: (${r.x}, ${r.z})`);
    console.log(`  Scale/Flags: isSmall=${r.isSmall}, isWide=${r.isWide}, customScale=${r.customScale}`);

    // Compute 3D label dimensions
    const baseW = r.isWide ? 6.4 : (r.isSmall ? 2.8 : 4.0);
    const planeW = baseW * (r.customScale || 1.0);
    const planeH = planeW * (r.ratio || (r.rawText && r.rawText.includes('\n') ? 256/768 : 256/512));
    const bboxX1 = r.x - planeW / 2;
    const bboxX2 = r.x + planeW / 2;
    const bboxZ1 = r.z - planeH / 2;
    const bboxZ2 = r.z + planeH / 2;

    console.log(`  3D Plate BBox: X [${bboxX1.toFixed(3)}..${bboxX2.toFixed(3)}], Z [${bboxZ1.toFixed(3)}..${bboxZ2.toFixed(3)}] (W=${planeW.toFixed(2)}m, H=${planeH.toFixed(2)}m)`);

    // Check distance to closest solid wall (flushed)
    const floorFlushed = b2FlushedWalls.filter(w => w.floor === target.floor);
    let minFlushedDist = Infinity;
    let closestFlushedWall = null;

    for (const w of floorFlushed) {
        const p = distPointToSegment(r.x, r.z, w.x1, w.z1, w.x2, w.z2);
        if (p.dist < minFlushedDist) {
            minFlushedDist = p.dist;
            closestFlushedWall = w;
        }
    }

    const wallThick = closestFlushedWall ? (closestFlushedWall.thickness || 0.18) : 0.18;
    const clearance = minFlushedDist - wallThick / 2;
    console.log(`  Clearance to nearest solid wall: ${clearance.toFixed(3)}m (wall: (${closestFlushedWall.x1.toFixed(2)}, ${closestFlushedWall.z1.toFixed(2)}) -> (${closestFlushedWall.x2.toFixed(2)}, ${closestFlushedWall.z2.toFixed(2)}), thickness=${wallThick})`);

    if (clearance < 0) {
        console.error(`  FAIL: Label center point COLLIDES with solid wall! Clearance = ${clearance.toFixed(3)}m < 0!`);
        totalErrors++;
    } else if (clearance < 0.20) {
        console.warn(`  WARN: Label center point is close to solid wall (${clearance.toFixed(3)}m < 0.20m)`);
        totalWarnings++;
    } else {
        console.log(`  PASS: Label center has generous clearance (>0.20m).`);
    }

    // Check if 3D bounding box intersects any solid wall
    let bboxCollisions = [];
    for (const w of floorFlushed) {
        // Test intersection of wall segment with 4 borders of plate bbox
        const halfT = (w.thickness || 0.18) / 2;
        // Check if wall segment passes through the box [bboxX1, bboxZ1] to [bboxX2, bboxZ2]
        // An approximation: check if segment intersects bbox or if box contains segment points
        const borders = [
            [bboxX1, bboxZ1, bboxX2, bboxZ1],
            [bboxX2, bboxZ1, bboxX2, bboxZ2],
            [bboxX2, bboxZ2, bboxX1, bboxZ2],
            [bboxX1, bboxZ2, bboxX1, bboxZ1]
        ];
        let collides = false;
        for (const b of borders) {
            if (segSegIntersection(w.x1, w.z1, w.x2, w.z2, b[0], b[1], b[2], b[3])) {
                collides = true;
                break;
            }
        }
        if (!collides) {
            // Check if segment midpoint is inside bbox
            const midX = (w.x1 + w.x2) / 2;
            const midZ = (w.z1 + w.z2) / 2;
            if (midX >= bboxX1 && midX <= bboxX2 && midZ >= bboxZ1 && midZ <= bboxZ2) {
                collides = true;
            }
        }
        if (collides) {
            bboxCollisions.push(w);
        }
    }

    if (bboxCollisions.length > 0) {
        console.log(`  Note: 3D plate geometry intersects ${bboxCollisions.length} physical wall segment(s). (Mesh has visible=false, rendered in 2D Screen-Space Canvas).`);
        for (const cw of bboxCollisions) {
            console.log(`    - Wall: (${cw.x1.toFixed(2)}, ${cw.z1.toFixed(2)}) -> (${cw.x2.toFixed(2)}, ${cw.z2.toFixed(2)}) th=${cw.thickness}`);
        }
    } else {
        console.log(`  PASS: 3D plate bounding box has 0 wall collisions.`);
    }
}

// Print bounds report table for focus labels
console.log('\n--- Geometric Enclosure Summary for Focus Labels ---');
for (const row of roomBoundsReport.filter(r => /ЛК.*3|104|308|312/.test(r.room))) {
    console.log(`${row.room} [F${row.floor}]: pos=${row.labelPos}, bounds=${row.bounds}, size=${row.size}, center=${row.geomCenter}, offset=${row.offset}, ${row.eccentricity}`);
}

// ============================================================================
// TEST 4: NAVGRAPH PHYSICAL WALL COLLISIONS IN BUILDING 2
// ============================================================================
console.log('\n--- TEST 4: NavGraph Edges & Physical Wall Collisions in Building 2 ---');

let b2WallCollisions = [];
const evaluatedEdges = new Set();

const b2Nodes = new Map();
for (const [id, node] of graph.nodes) {
    if (node.bldg === 2) {
        b2Nodes.set(id, node);
    }
}

console.log(`Evaluating Building 2 NavGraph Nodes: ${b2Nodes.size}`);

for (const [uId, uNode] of b2Nodes) {
    const neighbors = graph.adj.get(uId) || [];
    for (const edge of neighbors) {
        const vId = edge.to;
        const vNode = graph.nodes.get(vId);
        if (!vNode) continue;

        // Same floor intra-building edges
        if (uNode.floor !== vNode.floor) continue;

        const edgeKey = [uId, vId].sort().join('---');
        if (evaluatedEdges.has(edgeKey)) continue;
        evaluatedEdges.add(edgeKey);

        const f = uNode.floor;
        const floorFlushed = b2FlushedWalls.filter(w => w.floor === f);

        for (const w of floorFlushed) {
            // Check segment intersection between edge (uNode -> vNode) and wall (w.x1, w.z1 -> w.x2, w.z2)
            const inter = segSegIntersection(uNode.x, uNode.z, vNode.x, vNode.z, w.x1, w.z1, w.x2, w.z2);
            if (inter) {
                // Ensure intersection isn't just an endpoint or door opening
                const p1 = distPointToSegment(uNode.x, uNode.z, w.x1, w.z1, w.x2, w.z2);
                const p2 = distPointToSegment(vNode.x, vNode.z, w.x1, w.z1, w.x2, w.z2);
                const halfT = (w.thickness || 0.18) / 2;

                b2WallCollisions.push({
                    edgeKey,
                    floor: f,
                    u: { id: uId, pos: `(${uNode.x}, ${uNode.z})`, type: uNode.type, label: uNode.label },
                    v: { id: vId, pos: `(${vNode.x}, ${vNode.z})`, type: vNode.type, label: vNode.label },
                    wall: `(${w.x1.toFixed(2)}, ${w.z1.toFixed(2)}) -> (${w.x2.toFixed(2)}, ${w.z2.toFixed(2)})`,
                    thickness: w.thickness,
                    intersection: `(${inter.x.toFixed(2)}, ${inter.z.toFixed(2)})`
                });
            }
        }
    }
}

console.log(`Evaluated ${evaluatedEdges.size} unique Building 2 intra-floor edges.`);
console.log(`Building 2 Wall Collisions Found: ${b2WallCollisions.length}`);

for (const c of b2WallCollisions) {
    console.log(`  ✗ Collision: Edge [${c.edgeKey}] on Floor ${c.floor}`);
    console.log(`    U: ${c.u.id} ${c.u.pos} (${c.u.label})`);
    console.log(`    V: ${c.v.id} ${c.v.pos} (${c.v.label})`);
    console.log(`    Wall: ${c.wall} (th=${c.thickness}) at ${c.intersection}`);
}

console.log('\n================================================================================');
console.log(`AUDIT RESULT: ${totalErrors} Errors, ${totalWarnings} Warnings, ${b2WallCollisions.length} Wall Collisions`);
console.log('================================================================================');
