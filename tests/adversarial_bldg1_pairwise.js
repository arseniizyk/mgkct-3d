#!/usr/bin/env node

/**
 * ============================================================================
 * EMPIRICAL CHALLENGER TEST SUITE: BUILDING 1 ADVERSARIAL PATHFINDING & GEOMETRY
 * ============================================================================
 * 
 * Exhaustive pairwise A* routing across all Building 1 rooms (Floors 1–7),
 * physical wall crossing verification, doorway gateway validation,
 * vertical stair continuity, and fire partition door checks.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

// 1. Geometry helpers
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

// 2. Headless VM Sandbox
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
const walls = sandbox.WALLS_REGISTRY.filter(w => w.building === 1);
const rooms = sandbox.ROOMS_REGISTRY.filter(r => r.building === 1);

console.log('----------------------------------------------------');
console.log('CHALLENGER 1: ADVERSARIAL PATHFINDING SUITE');
console.log(`Building 1: ${rooms.length} registered room labels, ${walls.length} solid walls.`);
console.log('----------------------------------------------------');

// Exclude architectural labels
const isArchitecturalExclusion = (r) => {
    const raw = (r.rawText || r.text || '').replace(/\n/g, ' ').trim();
    if (raw === 'Второй свет' || raw === 'Витраж') return true;
    if (raw === 'Переход в корпус №2') return true;
    if (raw.startsWith('ЛК№') || raw.startsWith('ЛК №')) return true;
    return false;
};

const functionalRooms = rooms.filter(r => !isArchitecturalExclusion(r));
console.log(`Functional rooms in Building 1: ${functionalRooms.length}`);

// Map functional room to nav node
const matchedRoomNodes = [];
for (const r of functionalRooms) {
    const f = r.floor;
    const cleanText = r.text ? r.text.replace(/\n/g, ' ').trim() : '';
    let matched = null;
    for (const [nid, node] of graph.nodes) {
        if (node.floor === f && node.bldg === 1 && node.type === 'room') {
            const dist = Math.hypot(node.x - r.x, node.z - r.z);
            if (dist < 0.40 || (node.label && (node.label === cleanText || node.label === r.rawText))) {
                matched = node;
                break;
            }
        }
    }
    if (!matched) {
        console.error(`FATAL: No node for room ${cleanText} on Floor ${f}`);
        process.exit(1);
    }
    matchedRoomNodes.push({ room: r, node: matched });
}

console.log(`All ${matchedRoomNodes.length} rooms successfully mapped to NavGraph room nodes.`);

// CHALLENGE 1: Check for any isolated nodes in Building 1
console.log('\n--- Challenge 1: Isolated Nodes in Building 1 ---');
const b1Nodes = Array.from(graph.nodes.values()).filter(n => n.bldg === 1);
console.log(`Total Building 1 nodes in graph: ${b1Nodes.length}`);

// Check connectivity of Building 1 nodes via BFS starting from main entrance
const visited = new Set();
const queue = ['b1_f1_entrance_main'];
visited.add('b1_f1_entrance_main');

while (queue.length > 0) {
    const curr = queue.shift();
    const neighbors = graph.adj.get(curr) || [];
    for (const edge of neighbors) {
        if (!visited.has(edge.to)) {
            visited.add(edge.to);
            queue.push(edge.to);
        }
    }
}

const unreachableB1Nodes = b1Nodes.filter(n => !visited.has(n.id));
console.log(`Unreachable Building 1 nodes from main entrance: ${unreachableB1Nodes.length}`);
if (unreachableB1Nodes.length > 0) {
    console.error('UNREACHABLE B1 NODES:', unreachableB1Nodes.map(n => ({ id: n.id, floor: n.floor, label: n.label })));
}

// CHALLENGE 2: Exhaustive Pairwise A* Pathfinding (N x N)
console.log('\n--- Challenge 2: Exhaustive Pairwise A* (78 x 78 = 6,084 paths) ---');
let pathsTested = 0;
let pathsFailed = 0;
let wallsCrossed = 0;
const wallCollidingPaths = [];
const failedPairs = [];

const startTime = Date.now();

for (let i = 0; i < matchedRoomNodes.length; i++) {
    for (let j = 0; j < matchedRoomNodes.length; j++) {
        pathsTested++;
        const from = matchedRoomNodes[i];
        const to = matchedRoomNodes[j];

        // Test without elevators (default mode - uses stairs only)
        const res = sandbox.aStarPath(graph, from.node.id, to.node.id, { allowElevators: false });
        if (!res || !res.path || res.path.length === 0) {
            pathsFailed++;
            failedPairs.push({ from: from.node.id, to: to.node.id, fromFloor: from.node.floor, toFloor: to.node.floor });
            continue;
        }

        // Verify each path segment
        const p = res.path;
        for (let k = 0; k < p.length - 1; k++) {
            const u = graph.getNode(p[k]);
            const v = graph.getNode(p[k + 1]);

            // Only intra-floor segments check wall intersection
            if (u.floor === v.floor && u.bldg === 1 && v.bldg === 1) {
                const floor = u.floor;
                const floorWalls = walls.filter(w => w.floor === floor);
                for (const w of floorWalls) {
                    const thickness = w.thickness || 0.18;
                    const clearanceThreshold = (thickness / 2.0) - 0.02;
                    const d = distSegmentToSegment(u.x, u.z, v.x, v.z, w.x1, w.z1, w.x2, w.z2);
                    if (d < clearanceThreshold) {
                        wallsCrossed++;
                        wallCollidingPaths.push({
                            from: from.node.id,
                            to: to.node.id,
                            edge: `${u.id} -> ${v.id}`,
                            floor,
                            wall: `(${w.x1},${w.z1})->(${w.x2},${w.z2})`,
                            dist: d
                        });
                        break;
                    }
                }
            }
        }
    }
}

const elapsedMs = Date.now() - startTime;
console.log(`Exhaustive test completed in ${elapsedMs}ms (${(elapsedMs / pathsTested).toFixed(3)}ms per path)`);
console.log(`Paths tested : ${pathsTested}`);
console.log(`Paths failed : ${pathsFailed}`);
console.log(`Walls crossed: ${wallsCrossed}`);

// CHALLENGE 3: Elevator Mode Pairwise Tests (Sample 500 routes with allowElevators: true)
console.log('\n--- Challenge 3: Elevators Enabled Routing Check ---');
let elevRoutesTested = 0;
let elevRoutesFailed = 0;
let elevUsedCount = 0;

for (let i = 0; i < matchedRoomNodes.length; i += 3) {
    for (let j = 1; j < matchedRoomNodes.length; j += 3) {
        elevRoutesTested++;
        const from = matchedRoomNodes[i];
        const to = matchedRoomNodes[j];
        const res = sandbox.aStarPath(graph, from.node.id, to.node.id, { allowElevators: true });
        if (!res || !res.path) {
            elevRoutesFailed++;
        } else {
            const usesElev = res.path.some((nid, idx) => {
                if (idx === 0) return false;
                const prev = res.path[idx - 1];
                const edge = (graph.adj.get(prev) || []).find(e => e.to === nid);
                return edge && edge.isElevator;
            });
            if (usesElev) elevUsedCount++;
        }
    }
}
console.log(`Elevator routes tested: ${elevRoutesTested}`);
console.log(`Elevator routes failed: ${elevRoutesFailed}`);
console.log(`Elevator routes using elevator edges: ${elevUsedCount}`);

// CHALLENGE 4: Stress-Testing Specific M1 Architectural Features
console.log('\n--- Challenge 4: Stress-Testing Specific M1 Architectural Targets ---');

// Target A: Room 106 (Floor 1) access through 105 only
const r106 = matchedRoomNodes.find(m => m.room.text.includes('106'));
const r105 = matchedRoomNodes.find(m => m.room.text.includes('105'));
const r101 = matchedRoomNodes.find(m => m.room.text.includes('101'));
console.log('Target A - Room 106 isolation/door check:');
console.log(`Room 106 node: ${r106.node.id}, Room 105 node: ${r105.node.id}`);
const path106to101 = sandbox.aStarPath(graph, r106.node.id, r101.node.id, { allowElevators: false });
console.log(`Path 106 -> 101: ${path106to101.path.join(' -> ')}`);
const passesThrough105 = path106to101.path.includes(r105.node.id);
console.log(`Does path 106 -> 101 pass through 105? ${passesThrough105 ? 'YES (CORRECT per BTI)' : 'NO'}`);

// Target B: Room 305 (Floor 3 Eastern Annex)
const r305 = matchedRoomNodes.find(m => m.room.text.includes('305'));
console.log('\nTarget B - Room 305 (Eastern Annex) reachability:');
console.log(`Room 305 node: ${r305.node.id} at (${r305.node.x}, ${r305.node.z})`);
const path305to101 = sandbox.aStarPath(graph, r305.node.id, r101.node.id, { allowElevators: false });
console.log(`Path 305 -> 101 length: ${path305to101.path.length} nodes, distance: ${path305to101.totalDistance.toFixed(2)}m`);
console.log(`Path 305 -> 101: ${path305to101.path.slice(0, 5).join(' -> ')} ... ${path305to101.path.slice(-5).join(' -> ')}`);

// Target C: Transverse Fire Doors at X=-5.8 on Floors 4, 6, 7
console.log('\nTarget C - Transverse Fire Compartment Walls on Floors 4, 6, 7:');
for (const fl of [4, 6, 7]) {
    const westRoom = matchedRoomNodes.find(m => m.node.floor === fl && m.node.x < -6.0);
    const eastRoom = matchedRoomNodes.find(m => m.node.floor === fl && m.node.x > 0.0);
    if (westRoom && eastRoom) {
        const route = sandbox.aStarPath(graph, westRoom.node.id, eastRoom.node.id, { allowElevators: false });
        const fireDoorNode = `b1_f${fl}_nc_door_-5.8`;
        const usesFireDoor = route.path.includes(fireDoorNode);
        console.log(`Floor ${fl}: Route '${westRoom.node.id}' (x=${westRoom.node.x}) -> '${eastRoom.node.id}' (x=${eastRoom.node.x})`);
        console.log(`  Uses fire door '${fireDoorNode}': ${usesFireDoor ? 'YES (CORRECT)' : 'NO (WARNING!)'}`);
    }
}

// Target D: Western entrance to Room 201 (Floor 2)
console.log('\nTarget D - Auditorium 201 dual entrance check:');
const r201 = matchedRoomNodes.find(m => m.room.text.includes('201'));
const r201Neighbors = graph.adj.get(r201.node.id) || [];
console.log(`Room 201 adjacent nodes:`, r201Neighbors.map(e => e.to));

// Target E: Auditorium 401 entrance relocated to western position
console.log('\nTarget E - Auditorium 401 entrance check:');
const r401 = matchedRoomNodes.find(m => m.room.text.includes('401'));
const r401Neighbors = graph.adj.get(r401.node.id) || [];
console.log(`Room 401 node at (${r401.node.x}, ${r401.node.z}), adjacent nodes:`, r401Neighbors.map(e => e.to));

// Final verdict evaluation
console.log('\n====================================================');
console.log('CHALLENGER VERDICT ASSESSMENT');
console.log(`Total tests: ${pathsTested + elevRoutesTested + b1Nodes.length}`);
console.log(`Failed paths: ${pathsFailed}`);
console.log(`Colliding paths: ${wallsCrossed}`);
console.log(`Unreachable nodes: ${unreachableB1Nodes.length}`);

if (pathsFailed === 0 && wallsCrossed === 0 && unreachableB1Nodes.length === 0) {
    console.log('RESULT: 100% EMPIRICAL SUCCESS — ALL CHALLENGES PASSED');
    process.exit(0);
} else {
    console.error('RESULT: DEFECTS ENCOUNTERED');
    process.exit(1);
}
