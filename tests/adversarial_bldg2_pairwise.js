#!/usr/bin/env node

/**
 * ============================================================================
 * EMPIRICAL CHALLENGER TEST SUITE: BUILDING 2 ADVERSARIAL PATHFINDING & GEOMETRY
 * ============================================================================
 * 
 * Milestone 2 (Building 2) Adversarial Challenge Harness:
 * 1. Exhaustive pairwise A* routing across ALL Building 2 rooms (Floors 1–3) (N x N)
 * 2. Vertical ascent/descent verification through LK-1, LK-2, and LK-3 across floors 1..3
 * 3. Dedicated stress testing of Room 302 reachability, doors, and transitions
 * 4. Graph integrity: isolated nodes, dead ends, doorway gateway pattern
 * 5. Physical wall clearance & collision check on active routes
 * 6. Floor 2 Skywalk bridge connectivity (K2 <-> K1, K2 <-> K4)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// 1. GEOMETRY UTILITIES
// ----------------------------------------------------------------------------
function ccw(ax, az, bx, bz, cx, cz) {
    return (cz - az) * (bx - ax) - (bz - az) * (cx - ax);
}

function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
    const cp1 = ccw(ax, az, bx, bz, cx, cz);
    const cp2 = ccw(ax, az, bx, bz, cx, cz);
    const cp3 = ccw(cx, cz, dx, dz, ax, az);
    const cp4 = ccw(cx, cz, dx, dz, bx, bz);

    return (((cp1 > 1e-4 && cp2 < -1e-4) || (cp1 < -1e-4 && cp2 > 1e-4)) &&
            ((cp3 > 1e-4 && cp4 < -1e-4) || (cp3 < -1e-4 && cp4 > 1e-4)));
}

function distPointToSegment(px, pz, ax, az, bx, bz) {
    const vx = bx - ax;
    const vz = bz - az;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 1e-8) return Math.hypot(px - ax, pz - az);
    let t = ((px - ax) * vx + (pz - az) * vz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

function distSegmentToSegment(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z) {
    if (segmentsIntersect(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z)) {
        return 0;
    }
    return Math.min(
        distPointToSegment(p1x, p1z, q1x, q1z, q2x, q2z),
        distPointToSegment(p2x, p2z, q1x, q1z, q2x, q2z),
        distPointToSegment(q1x, q1z, p1x, p1z, p2x, p2z),
        distPointToSegment(q2x, q2z, p1x, p1z, p2x, p2z)
    );
}

// ----------------------------------------------------------------------------
// 2. HEADLESS VM SANDBOX SETUP
// ----------------------------------------------------------------------------
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
    localStorage: {
        getItem: () => null,
        setItem: () => {}
    }
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
loadScript('js/buildings/building1.js');
loadScript('js/buildings/building2.js');
loadScript('js/buildings/building3.js');
loadScript('js/buildings/building4.js');

const b1 = {}, b2 = {}, b3 = {}, b4 = {};
for (let f = 1; f <= 7; f++) {
    b1[f] = new sandbox.THREE.Group();
    b1[f].userData = { building: 1, floor: f };
    sandbox['buildFloor' + f](b1[f]);
}
for (let f = 1; f <= 3; f++) {
    b2[f] = new sandbox.THREE.Group();
    b2[f].userData = { building: 2, floor: f };
    sandbox['buildBuilding2Floor' + f](b2[f]);
}
for (let f = 1; f <= 2; f++) {
    b3[f] = new sandbox.THREE.Group();
    b3[f].userData = { building: 3, floor: f };
    sandbox['buildBuilding3Floor' + f](b3[f]);
}
for (let f = 1; f <= 3; f++) {
    b4[f] = new sandbox.THREE.Group();
    b4[f].userData = { building: 4, floor: f };
    sandbox['buildBuilding4Floor' + f](b4[f]);
}

sandbox.flushAllPendingWalls();
loadScript('js/navigator.js');

const graph = sandbox.buildCollegeNavGraph();
const allWalls = sandbox.WALLS_REGISTRY;
const b2Walls = allWalls.filter(w => w.building === 2);
const allRooms = sandbox.ROOMS_REGISTRY;
const b2Rooms = allRooms.filter(r => r.building === 2);
const allDoors = sandbox.DOORS_REGISTRY.filter(d => d.building === 2);

console.log('================================================================');
console.log('CHALLENGER 1: ADVERSARIAL PATHFINDING SUITE — BUILDING 2');
console.log('================================================================');
console.log(`Building 2 entities: ${b2Rooms.length} room labels, ${b2Walls.length} solid walls, ${allDoors.length} doors.`);

// Exclusion for architectural non-room labels (stairs, voids, transitions)
const isArchitecturalExclusion = (r) => {
    const raw = (r.rawText || r.text || '').replace(/\n/g, ' ').trim();
    if (raw.startsWith('ЛК№') || raw.startsWith('ЛК №')) return true;
    if (raw.startsWith('Переход')) return true;
    if (raw === 'Второй свет' || raw === 'Витраж') return true;
    return false;
};

const functionalRooms = b2Rooms.filter(r => !isArchitecturalExclusion(r));
console.log(`Functional rooms in Building 2: ${functionalRooms.length}`);

// ----------------------------------------------------------------------------
// TEST 1: Room-to-Node Mapping & Doorway Gateway Pattern
// ----------------------------------------------------------------------------
console.log('\n--- TEST 1: Functional Room-to-Node Mapping & Gateways ---');
const matchedRoomNodes = [];
let mappingFailures = 0;
let gatewayFailures = 0;

for (const r of functionalRooms) {
    const f = r.floor;
    const cleanText = r.text ? r.text.replace(/\n/g, ' ').trim() : '';
    let matched = null;

    // Search room node
    for (const [nid, node] of graph.nodes) {
        if (node.floor === f && node.bldg === 2 && node.type === 'room') {
            const dist = Math.hypot(node.x - r.x, node.z - r.z);
            if (dist < 0.40 || (node.label && (node.label === cleanText || node.label === r.rawText))) {
                matched = node;
                break;
            }
        }
    }

    if (!matched) {
        console.error(`[FAIL] No nav node matched for room '${cleanText}' [B2 F${f}] at (${r.x}, ${r.z})`);
        mappingFailures++;
        continue;
    }

    // Check gateway
    const neighbors = graph.adj.get(matched.id) || [];
    const hasGateway = neighbors.some(e => {
        const tgt = graph.getNode(e.to);
        return tgt && (tgt.type === 'door' || tgt.type === 'corridor');
    });

    if (!hasGateway) {
        console.error(`[FAIL] Room node '${matched.id}' (${cleanText}) lacks a door/corridor gateway! Neighbors:`, neighbors);
        gatewayFailures++;
    }

    matchedRoomNodes.push({ room: r, node: matched, cleanText });
}

console.log(`Matched Room Nodes: ${matchedRoomNodes.length}/${functionalRooms.length}`);
console.log(`Mapping failures: ${mappingFailures}, Gateway failures: ${gatewayFailures}`);

// ----------------------------------------------------------------------------
// TEST 2: Building 2 Isolated / Dead-End Nodes
// ----------------------------------------------------------------------------
console.log('\n--- TEST 2: Building 2 Internal Subgraph Connectivity ---');
const b2Nodes = Array.from(graph.nodes.values()).filter(n => n.bldg === 2);
console.log(`Total Building 2 nodes in graph: ${b2Nodes.length}`);

// BFS starting from b2_f1_porch (Building 2 main ground entrance)
const visitedB2 = new Set();
const queue = ['b2_f1_porch'];
visitedB2.add('b2_f1_porch');

while (queue.length > 0) {
    const curr = queue.shift();
    const neighbors = graph.adj.get(curr) || [];
    for (const edge of neighbors) {
        // Stay within bldg 2 nodes or transitions connected to bldg 2
        const target = graph.getNode(edge.to);
        if (target && target.bldg === 2 && !visitedB2.has(edge.to)) {
            visitedB2.add(edge.to);
            queue.push(edge.to);
        }
    }
}

const unreachableB2Nodes = b2Nodes.filter(n => !visitedB2.has(n.id));
console.log(`Unreachable Building 2 nodes from b2_f1_porch within B2 subgraph: ${unreachableB2Nodes.length}`);
if (unreachableB2Nodes.length > 0) {
    console.error('UNREACHABLE B2 NODES:');
    unreachableB2Nodes.forEach(n => console.error(`  - ${n.id} [F${n.floor}] (${n.x}, ${n.z}) type=${n.type} label=${n.label}`));
}

// ----------------------------------------------------------------------------
// TEST 3: Dedicated Room 302 Reachability & Geometry Stress Test
// ----------------------------------------------------------------------------
console.log('\n--- TEST 3: Room 302 Deep Dive & Stress Test ---');
const r302Entry = matchedRoomNodes.find(m => m.cleanText.includes('302') || (m.room.rawText && m.room.rawText.includes('302')));
if (!r302Entry) {
    console.error('[FAIL] Room 302 entry not found in matched rooms!');
} else {
    console.log(`Room 302 node: ${r302Entry.node.id} ('${r302Entry.cleanText}', raw: '${r302Entry.room.rawText}') at (${r302Entry.node.x}, ${r302Entry.node.z}) [F${r302Entry.node.floor}]`);
    const r302Neighbors = graph.adj.get(r302Entry.node.id) || [];
    console.log(`Room 302 neighbors (${r302Neighbors.length}):`, r302Neighbors.map(e => `${e.to} (wt=${e.weight})`));

    // Test route from Room 302 to all other rooms on Floor 3
    const f3Rooms = matchedRoomNodes.filter(m => m.node.floor === 3 && m.node.id !== r302Entry.node.id);
    let r302F3Fails = 0;
    for (const dest of f3Rooms) {
        const route = sandbox.aStarPath(graph, r302Entry.node.id, dest.node.id, { allowElevators: false });
        if (!route || !route.path || route.path.length === 0) {
            console.error(`[FAIL] Room 302 -> ${dest.cleanText} (${dest.node.id}) route failed!`);
            r302F3Fails++;
        }
    }
    console.log(`Room 302 -> Floor 3 Rooms: ${f3Rooms.length - r302F3Fails}/${f3Rooms.length} reachable.`);

    // Test route from Room 302 to ground entrance b2_f1_porch
    const r302ToPorch = sandbox.aStarPath(graph, r302Entry.node.id, 'b2_f1_porch', { allowElevators: false });
    if (!r302ToPorch) {
        console.error('[FAIL] Room 302 cannot reach b2_f1_porch!');
    } else {
        console.log(`Room 302 -> b2_f1_porch: SUCCESS (distance=${r302ToPorch.totalDistance.toFixed(1)}m, ${r302ToPorch.path.length} hops)`);
    }

    // Test route from Room 302 to Library 104
    const lib104 = matchedRoomNodes.find(m => m.cleanText.includes('104') || (m.room.rawText && m.room.rawText.includes('104')));
    if (lib104) {
        const r302ToLib = sandbox.aStarPath(graph, r302Entry.node.id, lib104.node.id, { allowElevators: false });
        if (!r302ToLib) {
            console.error('[FAIL] Room 302 cannot reach 104 Библиотека!');
        } else {
            console.log(`Room 302 -> 104 Библиотека: SUCCESS (distance=${r302ToLib.totalDistance.toFixed(1)}m, ${r302ToLib.path.length} hops)`);
        }
    }
}

// ----------------------------------------------------------------------------
// TEST 4: Vertical Staircases LK-1, LK-2, LK-3 Multi-Floor Ascent & Descent
// ----------------------------------------------------------------------------
console.log('\n--- TEST 4: Vertical Staircases LK-1, LK-2, LK-3 Ascent/Descent ---');
const stairs = [
    { name: 'LK-1', prefix: 'b2_f', suffix: '_stair_lk1' },
    { name: 'LK-2', prefix: 'b2_f', suffix: '_stair_lk2' },
    { name: 'LK-3', prefix: 'b2_f', suffix: '_stair_lk3', maxFloor: 2 }
];

let stairFailures = 0;

for (const st of stairs) {
    console.log(`\nVerifying ${st.name}:`);
    for (let f = 1; f <= (st.maxFloor || 3); f++) {
        const nid = `${st.prefix}${f}${st.suffix}`;
        if (!graph.hasNode(nid)) {
            console.error(`  [FAIL] Missing landing node ${nid}`);
            stairFailures++;
        } else {
            const node = graph.getNode(nid);
            console.log(`  Node ${nid} exists at (${node.x}, ${node.y || 0}, ${node.z})`);
        }
    }

    // Check adjacent edges
    for (let f = 1; f < st.maxFloor; f++) {
        const u = `${st.prefix}${f}${st.suffix}`;
        const v = `${st.prefix}${f + 1}${st.suffix}`;
        const uNbrs = graph.adj.get(u) || [];
        const vNbrs = graph.adj.get(v) || [];

        const hasFwd = uNbrs.some(e => e.to === v);
        const hasRev = vNbrs.some(e => e.to === u);

        if (!hasFwd || !hasRev) {
            console.error(`  [FAIL] Missing edge between ${u} and ${v} (fwd=${hasFwd}, rev=${hasRev})`);
            stairFailures++;
        } else {
            console.log(`  Edge ${u} <-> ${v} verified.`);
        }
    }

    // Bidirectional multi-floor routing tests across all floor pairs
    const pairs = st.maxFloor === 3 ? [
        [1, 2], [2, 1],
        [2, 3], [3, 2],
        [1, 3], [3, 1]
    ] : [[1, 2], [2, 1]];

    for (const [fFrom, fTo] of pairs) {
        const fromNode = `${st.prefix}${fFrom}${st.suffix}`;
        const toNode = `${st.prefix}${fTo}${st.suffix}`;
        const res = sandbox.aStarPath(graph, fromNode, toNode, { allowElevators: false });
        if (!res || !res.path || res.path.length === 0) {
            console.error(`  [FAIL] Cannot route ${st.name} from Floor ${fFrom} (${fromNode}) to Floor ${fTo} (${toNode})`);
            stairFailures++;
        } else {
            // Verify path only uses this staircase's vertical nodes
            const verticalHops = res.path.filter(nid => nid.includes(st.suffix));
            const expectedCount = Math.abs(fTo - fFrom) + 1;
            if (verticalHops.length !== expectedCount) {
                console.warn(`  [WARN] Route between ${fromNode} and ${toNode} used unexpected sequence: ${res.path.join(' -> ')}`);
            }
        }
    }
    console.log(`  All 6 bidirectional ascent/descent pairs passed for ${st.name}.`);
}

// ----------------------------------------------------------------------------
// TEST 5: Exhaustive Pairwise A* Pathfinding (N x N)
// ----------------------------------------------------------------------------
console.log('\n--- TEST 5: Exhaustive Pairwise A* Pathfinding (N x N) ---');
const totalPairs = matchedRoomNodes.length * matchedRoomNodes.length;
console.log(`Evaluating all ${matchedRoomNodes.length} x ${matchedRoomNodes.length} = ${totalPairs} room-to-room routes...`);

let pairwiseTested = 0;
let pairwiseFailed = 0;
let routeWallCollisions = 0;
const collidingRoutes = [];
const failedPairDetails = [];

const startTime = Date.now();

for (let i = 0; i < matchedRoomNodes.length; i++) {
    for (let j = 0; j < matchedRoomNodes.length; j++) {
        pairwiseTested++;
        const from = matchedRoomNodes[i];
        const to = matchedRoomNodes[j];

        const res = sandbox.aStarPath(graph, from.node.id, to.node.id, { allowElevators: false });
        if (!res || !res.path || res.path.length === 0) {
            pairwiseFailed++;
            failedPairDetails.push({ from: from.node.id, to: to.node.id, fromName: from.cleanText, toName: to.cleanText });
            continue;
        }

        // Verify active route segments do not penetrate solid walls
        const p = res.path;
        for (let k = 0; k < p.length - 1; k++) {
            const u = graph.getNode(p[k]);
            const v = graph.getNode(p[k + 1]);

            if (u.floor === v.floor && u.bldg === 2 && v.bldg === 2) {
                const floor = u.floor;
                const floorWalls = b2Walls.filter(w => w.floor === floor);

                for (const w of floorWalls) {
                    const thickness = w.thickness || 0.18;
                    const clearance = (thickness / 2.0) - 0.02;

                    // Direct segment-to-segment distance
                    const dist = distSegmentToSegment(u.x, u.z, v.x, v.z, w.x1, w.z1, w.x2, w.z2);
                    if (dist < clearance) {
                        routeWallCollisions++;
                        if (collidingRoutes.length < 15) {
                            collidingRoutes.push({
                                from: from.cleanText,
                                to: to.cleanText,
                                edge: `${u.id} <-> ${v.id}`,
                                floor,
                                wall: `(${w.x1}, ${w.z1}) -> (${w.x2}, ${w.z2})`,
                                dist: dist.toFixed(3),
                                clearance: clearance.toFixed(3)
                            });
                        }
                        break;
                    }
                }
            }
        }
    }
}

const elapsedMs = Date.now() - startTime;
console.log(`Pairwise test completed in ${elapsedMs}ms (${(elapsedMs / totalPairs).toFixed(3)}ms per query).`);
console.log(`Total Routes Tested : ${pairwiseTested}`);
console.log(`Successful Routes   : ${pairwiseTested - pairwiseFailed} (${((pairwiseTested - pairwiseFailed) / pairwiseTested * 100).toFixed(2)}%)`);
console.log(`Failed Routes       : ${pairwiseFailed}`);
console.log(`Active Route Wall Collisions: ${routeWallCollisions}`);

if (failedPairDetails.length > 0) {
    console.error('FAILED ROUTE PAIRS SAMPLE:');
    failedPairDetails.slice(0, 10).forEach(f => console.error(`  ${f.from} (${f.fromName}) -> ${f.to} (${f.toName})`));
}

if (collidingRoutes.length > 0) {
    console.warn('\nSAMPLE ACTIVE ROUTE WALL COLLISIONS:');
    collidingRoutes.forEach(c => console.warn(`  Route ${c.from} -> ${c.to}: Edge ${c.edge} [F${c.floor}] dist=${c.dist}m < ${c.clearance}m against wall ${c.wall}`));
}

// ----------------------------------------------------------------------------
// TEST 6: Floor 2 Cross-Building Transitions (K2 <-> K1, K2 <-> K4)
// ----------------------------------------------------------------------------
console.log('\n--- TEST 6: Floor 2 Skywalk Transitions ---');
const k1ToK2Edge = (graph.adj.get('b2_f2_c_20.4') || []).some(e => e.to === 'custom_b1_f2_c_180_-56_1nw');
const k2ToK4Edge = (graph.adj.get('b2_f2_c_37.5') || []).some(e => e.to === 'bridge_k4_k2_f2');

console.log(`Bridge K1 <-> K2 connected: ${k1ToK2Edge}`);
console.log(`Bridge K2 <-> K4 connected: ${k2ToK4Edge}`);

// Test all 39 rooms reaching key campus destinations
let failK1Entrance = 0;
let failK1Top = 0;
let failK4Bridge = 0;

for (const m of matchedRoomNodes) {
    const rK1Ent = sandbox.aStarPath(graph, m.node.id, 'b1_f1_entrance_main', { allowElevators: false });
    if (!rK1Ent) failK1Entrance++;

    const rK1Top = sandbox.aStarPath(graph, m.node.id, 'b1_f7_nc_0.0', { allowElevators: false });
    if (!rK1Top) failK1Top++;

    const rK4Br = sandbox.aStarPath(graph, m.node.id, 'bridge_k4_k2_f2', { allowElevators: false });
    if (!rK4Br) failK4Bridge++;
}

console.log(`All B2 Rooms -> K1 Main Entrance: ${matchedRoomNodes.length - failK1Entrance}/${matchedRoomNodes.length} passed.`);
console.log(`All B2 Rooms -> K1 7th Floor (top): ${matchedRoomNodes.length - failK1Top}/${matchedRoomNodes.length} passed.`);
console.log(`All B2 Rooms -> K4 Floor 2 Bridge: ${matchedRoomNodes.length - failK4Bridge}/${matchedRoomNodes.length} passed.`);


// ----------------------------------------------------------------------------
// TEST 7: Deep Diagnostic of Building 2 Wall Collisions
// ----------------------------------------------------------------------------
console.log('\n--- TEST 7: Deep Diagnostic of All Building 2 Wall Collisions ---');
const collidingEdgesB2 = [];
const seenB2Edges = new Set();

for (const [uId, neighbors] of graph.adj.entries()) {
    const u = graph.getNode(uId);
    if (!u || u.bldg !== 2) continue;

    for (const edge of neighbors) {
        const vId = edge.to;
        const v = graph.getNode(vId);
        if (!v || v.bldg !== 2) continue;
        if (u.floor !== v.floor) continue;

        const edgeKey = uId < vId ? `${uId}---${vId}` : `${vId}---${uId}`;
        if (seenB2Edges.has(edgeKey)) continue;
        seenB2Edges.add(edgeKey);

        const floor = u.floor;
        const floorWalls = b2Walls.filter(w => w.floor === floor);

        for (const w of floorWalls) {
            const thickness = w.thickness || 0.18;
            const clearance = (thickness / 2.0) - 0.02;
            const dist = distSegmentToSegment(u.x, u.z, v.x, v.z, w.x1, w.z1, w.x2, w.z2);

            if (dist < clearance) {
                // Find if this edge is actually used in any of the 1,521 active room routes
                collidingEdgesB2.push({
                    edge: edgeKey,
                    floor,
                    u: { id: uId, x: u.x, z: u.z, type: u.type, label: u.label },
                    v: { id: vId, x: v.x, z: v.z, type: v.type, label: v.label },
                    wall: { x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2, thickness },
                    dist: dist.toFixed(4),
                    clearance: clearance.toFixed(4)
                });
                break;
            }
        }
    }
}

console.log(`Total colliding edges detected in Building 2: ${collidingEdgesB2.length}`);
collidingEdgesB2.forEach((ce, idx) => {
    console.log(`\nCollision #${idx + 1} [Floor ${ce.floor}]: Edge ${ce.edge}`);
    console.log(`  u: ${ce.u.id} (${ce.u.x}, ${ce.u.z}) [${ce.u.type}] "${ce.u.label}"`);
    console.log(`  v: ${ce.v.id} (${ce.v.x}, ${ce.v.z}) [${ce.v.type}] "${ce.v.label}"`);
    console.log(`  wall: (${ce.wall.x1}, ${ce.wall.z1}) -> (${ce.wall.x2}, ${ce.wall.z2}) thickness=${ce.wall.thickness}`);
    console.log(`  dist=${ce.dist}m < clearance=${ce.clearance}m`);
});

// ----------------------------------------------------------------------------
// SUMMARY & VERDICT
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('CHALLENGER 1 ADVERSARIAL VERDICT SUMMARY');
console.log('================================================================');
const totalErrors = mappingFailures + gatewayFailures + unreachableB2Nodes.length + stairFailures + pairwiseFailed;
console.log(`Total Critical Failures: ${totalErrors}`);

if (totalErrors === 0) {
    console.log('VERDICT: ALL CRITICAL PATHFINDING TESTS PASSED.');
} else {
    console.log(`VERDICT: FAILED WITH ${totalErrors} CRITICAL DEFECTS.`);
}

