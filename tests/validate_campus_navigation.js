#!/usr/bin/env node

/**
 * ============================================================================
 * MGKCT 3D — HEADLESS CAMPUS NAVIGATION & ARCHITECTURE E2E TEST SUITE
 * ============================================================================
 * 
 * Validates the full campus navigation graph and architectural geometry
 * across Buildings 1–4 and Floors 1–7 without external npm dependencies.
 * 
 * Methodology: 4-Tier Test Framework (TEST_INFRA.md)
 * - Tier 1: Feature Coverage (ROOMS_REGISTRY 100% coverage, door gateways, intra-floor reachability)
 * - Tier 2: Boundary & Corner (Staircase vertical shafts LK-1..3, elevators mode enforcement)
 * - Tier 3: Cross-Feature Combinations (Floor 2 skywalks, connected components, inter-building paths)
 * - Tier 4: Real-World Workloads & Physical Integrity (50-route benchmark latency, 3D wall clearance)
 * 
 * Usage:
 *   node tests/validate_campus_navigation.js [options]
 * 
 * Options:
 *   --building, -b <1..4>   Filter tests to a specific building (M1..M4 verification)
 *   --tier, -t <1..4>       Run only a specific test tier
 *   --strict                Exit with code 1 if any test fails (default)
 *   --allow-defects         Exit with code 0 even if defects exist (baseline inspection)
 *   --json                  Output results in machine-readable JSON format
 *   --verbose, -v           Show detailed defect diagnostics and node lists
 *   --help, -h              Display this help message
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ----------------------------------------------------------------------------
// 1. CLI ARGUMENT PARSING
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const options = {
    building: null,
    tier: null,
    strict: true,
    allowDefects: false,
    json: false,
    verbose: false
};

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
        printHelp();
        process.exit(0);
    } else if (arg === '--building' || arg === '-b') {
        options.building = parseInt(args[++i], 10);
    } else if (arg === '--tier' || arg === '-t') {
        options.tier = parseInt(args[++i], 10);
    } else if (arg === '--strict') {
        options.strict = true;
    } else if (arg === '--allow-defects' || arg === '--baseline') {
        options.allowDefects = true;
    } else if (arg === '--json') {
        options.json = true;
    } else if (arg === '--verbose' || arg === '-v') {
        options.verbose = true;
    }
}

function printHelp() {
    console.log(`
MGKCT 3D Headless E2E Navigation Test Suite

Usage:
  node tests/validate_campus_navigation.js [options]

Options:
  --building, -b <1..4>   Filter tests to a specific building (1, 2, 3, or 4)
  --tier, -t <1..4>       Run only a specific test tier (1, 2, 3, or 4)
  --strict                Exit with code 1 if any failure occurs (default)
  --allow-defects         Exit with code 0 regardless of failures (baseline inspection)
  --json                  Output complete test results in structured JSON format
  --verbose, -v           Print full details of missing rooms, orphan nodes, wall collisions
  --help, -h              Show this help reference
`);
}

// ----------------------------------------------------------------------------
// 2. GEOMETRY & MATH UTILITIES
// ----------------------------------------------------------------------------
function ccw(ax, az, bx, bz, cx, cz) {
    return (cz - az) * (bx - ax) - (bz - az) * (cx - ax);
}

function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
    const cp1 = ccw(ax, az, bx, bz, cx, cz);
    const cp2 = ccw(ax, az, bx, bz, dx, dz);
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
// 3. HEADLESS RUNTIME BOOTSTRAP (ZERO-BUNDLER VM)
// ----------------------------------------------------------------------------
function createHeadlessCampusEnvironment(projectRoot) {
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

    // Load in strict project execution order (AGENTS.md § 2)
    loadScript('js/vendor/three.min.js');
    loadScript('js/state.js');
    loadScript('js/materials.js');
    loadScript('js/helpers.js');
    loadScript('js/buildings/building1.js');
    loadScript('js/buildings/building2.js');
    loadScript('js/buildings/building3.js');
    loadScript('js/buildings/building4.js');

    // Instantiate all 15 floors across Buildings 1–4
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

    // Flush all pending wall geometry into WALLS_REGISTRY & DOORS_REGISTRY
    sandbox.flushAllPendingWalls();

    // Load navigation engine
    loadScript('js/navigator.js');

    // Build the college navigation graph
    const graph = sandbox.buildCollegeNavGraph();

    return {
        sandbox,
        graph,
        wallsRegistry: sandbox.WALLS_REGISTRY,
        roomsRegistry: sandbox.ROOMS_REGISTRY,
        doorsRegistry: sandbox.DOORS_REGISTRY
    };
}

// ----------------------------------------------------------------------------
// 4. TEST SUITE IMPLEMENTATION (TIERS 1–4)
// ----------------------------------------------------------------------------
class NavigationTestSuite {
    constructor(env, opts) {
        this.env = env;
        this.graph = env.graph;
        this.sandbox = env.sandbox;
        this.walls = env.wallsRegistry;
        this.rooms = env.roomsRegistry;
        this.doors = env.doorsRegistry;
        this.opts = opts;

        this.results = {
            timestamp: new Date().toISOString(),
            options: opts,
            metrics: {
                totalRoomsInRegistry: this.rooms.length,
                totalWallsInRegistry: this.walls.length,
                totalDoorsInRegistry: this.doors.length,
                graphNodesCount: this.graph.nodes.size,
                graphEdgesCount: this.graph.adj.size
            },
            tiers: {},
            defects: [],
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                allPassed: true
            }
        };
    }

    recordTest(tierId, testName, passed, details = {}) {
        if (!this.results.tiers[tierId]) {
            this.results.tiers[tierId] = {
                tests: [],
                passed: 0,
                failed: 0
            };
        }
        const record = { testName, passed, details };
        this.results.tiers[tierId].tests.push(record);
        this.results.summary.totalTests++;

        if (passed) {
            this.results.tiers[tierId].passed++;
            this.results.summary.passed++;
        } else {
            this.results.tiers[tierId].failed++;
            this.results.summary.failed++;
            this.results.summary.allPassed = false;
        }
    }

    addDefect(category, severity, description, entity = {}) {
        this.results.defects.push({
            category,
            severity, // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
            description,
            entity
        });
    }

    // ------------------------------------------------------------------------
    // TIER 1: FEATURE COVERAGE
    // ------------------------------------------------------------------------
    runTier1() {
        const tierId = 'tier1_feature_coverage';

        // Filter rooms by building if specified
        let candidateRooms = this.rooms;
        if (this.opts.building !== null) {
            candidateRooms = candidateRooms.filter(r => r.building === this.opts.building);
        }

        // 1. Identify and categorize rooms
        // Known non-walkable architectural / transition markers
        const isArchitecturalExclusion = (r) => {
            const raw = (r.rawText || r.text || '').replace(/\n/g, ' ').trim();
            if (raw === 'Второй свет' || raw === 'Витраж') return true;
            if (raw === 'Переход в корпус №2') return true;
            if (raw.startsWith('ЛК№') || raw.startsWith('ЛК №')) return true; // Stair labels handled in Tier 2
            return false;
        };

        const functionalRooms = candidateRooms.filter(r => !isArchitecturalExclusion(r));
        const matchedRooms = [];
        const missingRooms = [];
        const brokenGateways = [];
        const unreachableRooms = [];

        for (const r of functionalRooms) {
            const f = r.floor;
            const b = r.building;
            const cleanText = r.text ? r.text.replace(/\n/g, ' ').trim() : '';

            // Match room node by proximity or exact room label
            let matchedNode = null;
            for (const [nid, node] of this.graph.nodes) {
                if (node.floor === f && node.bldg === b && node.type === 'room') {
                    const dist = Math.hypot(node.x - r.x, node.z - r.z);
                    if (dist < 0.40) {
                        matchedNode = node;
                        break;
                    }
                    if (node.label && (node.label === cleanText || node.label === r.rawText)) {
                        matchedNode = node;
                        break;
                    }
                }
            }

            if (!matchedNode) {
                missingRooms.push({
                    bldg: b,
                    floor: f,
                    text: cleanText,
                    rawText: r.rawText,
                    x: r.x,
                    z: r.z
                });
                this.addDefect(
                    'MISSING_ROOM_NODE',
                    'HIGH',
                    `Functional room [B${b} F${f}] '${cleanText}' at (${r.x}, ${r.z}) has no corresponding 'room' node in NavGraph`,
                    { building: b, floor: f, text: cleanText, x: r.x, z: r.z }
                );
            } else {
                matchedRooms.push({ room: r, node: matchedNode });

                // Check Door Gateway Pattern: room node must connect to a door or corridor node
                const neighbors = this.graph.adj.get(matchedNode.id) || [];
                const hasDoorOrCorr = neighbors.some(e => {
                    const target = this.graph.getNode(e.to);
                    return target && (target.type === 'door' || target.type === 'corridor');
                });

                if (!hasDoorOrCorr) {
                    brokenGateways.push({ node: matchedNode, room: r });
                    this.addDefect(
                        'BROKEN_DOOR_GATEWAY',
                        'HIGH',
                        `Room node '${matchedNode.id}' [B${b} F${f}] '${cleanText}' has no door or corridor connection`,
                        { nodeId: matchedNode.id, building: b, floor: f, text: cleanText }
                    );
                } else {
                    // Test intra-floor reachability: find closest corridor on same floor and route
                    const closestCorr = this.graph.findClosestNode(f, b, r.x, r.z, ['corridor']);
                    if (closestCorr) {
                        const route = this.sandbox.aStarPath(this.graph, matchedNode.id, closestCorr.id, { allowElevators: false });
                        if (!route) {
                            unreachableRooms.push({ node: matchedNode, room: r });
                            this.addDefect(
                                'UNREACHABLE_ROOM',
                                'HIGH',
                                `Room node '${matchedNode.id}' [B${b} F${f}] '${cleanText}' cannot reach corridor node '${closestCorr.id}' on same floor`,
                                { nodeId: matchedNode.id, building: b, floor: f }
                            );
                        }
                    }
                }
            }
        }

        // Test 1.1: Functional room coverage
        const coverageRate = functionalRooms.length > 0 ? (matchedRooms.length / functionalRooms.length) : 1;
        this.recordTest(
            tierId,
            'Feature 1.1: Functional Room-to-Node Registration (100% Target)',
            missingRooms.length === 0,
            {
                totalFunctionalRooms: functionalRooms.length,
                matchedCount: matchedRooms.length,
                missingCount: missingRooms.length,
                coverageRate: Math.round(coverageRate * 1000) / 10 + '%',
                missingRooms: missingRooms.slice(0, 20)
            }
        );

        // Test 1.2: Door Gateway Pattern
        this.recordTest(
            tierId,
            'Feature 1.2: Safe Door Gateway Pattern Connectivity',
            brokenGateways.length === 0,
            {
                matchedRoomsCount: matchedRooms.length,
                brokenGatewayCount: brokenGateways.length,
                brokenGateways: brokenGateways.map(bg => bg.node.id)
            }
        );

        // Test 1.3: Intra-Floor Room Reachability
        this.recordTest(
            tierId,
            'Feature 1.3: Intra-Floor Room-to-Corridor Access',
            unreachableRooms.length === 0,
            {
                evaluatedRoomsCount: matchedRooms.length - brokenGateways.length,
                unreachableCount: unreachableRooms.length,
                unreachableNodes: unreachableRooms.map(ur => ur.node.id)
            }
        );
    }

    // ------------------------------------------------------------------------
    // TIER 2: BOUNDARY & CORNER CONDITIONS (VERTICAL NAVIGATION)
    // ------------------------------------------------------------------------
    runTier2() {
        const tierId = 'tier2_boundary_corner';

        // 1. Staircase definitions by building
        const staircases = [
            // Building 1
            { id: 'b1_lk1', bldg: 1, name: 'К1 ЛК№1', floors: [1, 2, 3, 4, 5, 6, 7], prefix: 'b1_f', suffix: '_stair_lk1' },
            { id: 'b1_lk2', bldg: 1, name: 'К1 ЛК№2', floors: [1, 2, 3, 4, 5, 6, 7], prefix: 'b1_f', suffix: '_stair_lk2' },
            // Building 2
            { id: 'b2_lk1', bldg: 2, name: 'К2 ЛК№1', floors: [1, 2, 3], prefix: 'b2_f', suffix: '_stair_lk1' },
            { id: 'b2_lk2', bldg: 2, name: 'К2 ЛК№2', floors: [1, 2, 3], prefix: 'b2_f', suffix: '_stair_lk2' },
            { id: 'b2_lk3', bldg: 2, name: 'К2 ЛК№3', floors: [1, 2], prefix: 'b2_f', suffix: '_stair_lk3' },
            // Building 3
            { id: 'b3_south', bldg: 3, name: 'К3 Южная ЛК', floors: [1, 2], prefix: 'b3_f', suffix: '_stair_south' },
            { id: 'b3_north', bldg: 3, name: 'К3 Северная ЛК', floors: [1, 2], prefix: 'b3_f', suffix: '_stair_north' },
            // Building 4
            { id: 'b4_lk1', bldg: 4, name: 'К4 ЛК№1', floors: [1, 2, 3], prefix: 'b4_f', suffix: '_stair_lk1' },
            { id: 'b4_lk2', bldg: 4, name: 'К4 ЛК№2', floors: [1, 2, 3], prefix: 'b4_f', suffix: '_stair_lk2' },
            { id: 'b4_lk3', bldg: 4, name: 'К4 ЛК№3', floors: [1, 2, 3], prefix: 'b4_f', suffix: '_stair_lk3' }
        ];

        let targetStairs = staircases;
        if (this.opts.building !== null) {
            targetStairs = targetStairs.filter(s => s.bldg === this.opts.building);
        }

        const missingStairNodes = [];
        const brokenVerticalEdges = [];
        const multiFloorRouteFailures = [];

        for (const st of targetStairs) {
            // Check landing node existence
            for (const f of st.floors) {
                const nodeId = `${st.prefix}${f}${st.suffix}`;
                if (!this.graph.hasNode(nodeId)) {
                    missingStairNodes.push({ staircase: st.id, floor: f, nodeId });
                    this.addDefect(
                        'MISSING_STAIR_NODE',
                        'HIGH',
                        `Staircase landing node '${nodeId}' [B${st.bldg} F${f}] missing in NavGraph`,
                        { staircase: st.id, floor: f, nodeId }
                    );
                }
            }

            // Check adjacent vertical edges between floors
            for (let i = 0; i < st.floors.length - 1; i++) {
                const f1 = st.floors[i];
                const f2 = st.floors[i + 1];
                const u = `${st.prefix}${f1}${st.suffix}`;
                const v = `${st.prefix}${f2}${st.suffix}`;

                if (this.graph.hasNode(u) && this.graph.hasNode(v)) {
                    const uNbrs = this.graph.adj.get(u) || [];
                    const hasEdge = uNbrs.some(e => e.to === v);
                    if (!hasEdge) {
                        brokenVerticalEdges.push({ u, v, staircase: st.id });
                        this.addDefect(
                            'BROKEN_VERTICAL_STAIR_EDGE',
                            'CRITICAL',
                            `Missing vertical edge between '${u}' and '${v}' in staircase '${st.id}'`,
                            { from: u, to: v, staircase: st.id }
                        );
                    }
                }
            }

            // Multi-floor A* search using stairs only
            const bottomFloor = st.floors[0];
            const topFloor = st.floors[st.floors.length - 1];
            const bottomNode = `${st.prefix}${bottomFloor}${st.suffix}`;
            const topNode = `${st.prefix}${topFloor}${st.suffix}`;

            if (this.graph.hasNode(bottomNode) && this.graph.hasNode(topNode)) {
                const route = this.sandbox.aStarPath(this.graph, bottomNode, topNode, { allowElevators: false });
                if (!route) {
                    multiFloorRouteFailures.push({ from: bottomNode, to: topNode, staircase: st.id });
                    this.addDefect(
                        'STAIRS_ROUTING_FAILURE',
                        'CRITICAL',
                        `Cannot route across floors in staircase '${st.id}' from '${bottomNode}' to '${topNode}' with allowElevators=false`,
                        { from: bottomNode, to: topNode }
                    );
                }
            }
        }

        // Test 2.1: Staircase landing node completeness
        this.recordTest(
            tierId,
            'Feature 2.1: Vertical Staircase Landing Node Completeness',
            missingStairNodes.length === 0,
            { missingNodes: missingStairNodes }
        );

        // Test 2.2: Vertical adjacent staircase edges
        this.recordTest(
            tierId,
            'Feature 2.2: Vertical Staircase Adjacent Floor Edge Continuity',
            brokenVerticalEdges.length === 0,
            { brokenEdges: brokenVerticalEdges }
        );

        // Test 2.3: Multi-Floor Stairs-Only A* Pathfinding
        this.recordTest(
            tierId,
            'Feature 2.3: Stairs-Only Multi-Floor Pathfinding (allowElevators: false)',
            multiFloorRouteFailures.length === 0,
            { routeFailures: multiFloorRouteFailures }
        );

        // Test 2.4: Elevator Policy Enforcement (Building 1)
        if (this.opts.building === null || this.opts.building === 1) {
            let elevDefect = null;
            const b1ElevNodes = [1, 2, 3, 4, 5, 6, 7].map(f => `b1_f${f}_elev`);
            const allElevNodesExist = b1ElevNodes.every(nid => this.graph.hasNode(nid));

            if (!allElevNodesExist) {
                elevDefect = 'Missing one or more Building 1 elevator nodes (b1_f1_elev..b1_f7_elev)';
            } else {
                // Verify vertical elevator edges have isElevator: true
                for (let f = 1; f < 7; f++) {
                    const u = `b1_f${f}_elev`;
                    const v = `b1_f${f + 1}_elev`;
                    const nbrs = this.graph.adj.get(u) || [];
                    const edge = nbrs.find(e => e.to === v);
                    if (!edge || !edge.isElevator) {
                        elevDefect = `Edge between '${u}' and '${v}' is missing or lacks 'isElevator: true'`;
                        break;
                    }
                }

                // Verify policy: when allowElevators: false, elevator edge MUST NOT be used
                if (!elevDefect) {
                    const routeNoElev = this.sandbox.aStarPath(this.graph, 'b1_f1_elev', 'b1_f7_elev', { allowElevators: false });
                    if (routeNoElev) {
                        // Check if route traversed elevator edges directly without stairs
                        const usesElevEdges = routeNoElev.path.some((nid, idx) => {
                            if (idx === 0) return false;
                            const prev = routeNoElev.path[idx - 1];
                            const edge = (this.graph.adj.get(prev) || []).find(e => e.to === nid);
                            return edge && edge.isElevator;
                        });
                        if (usesElevEdges) {
                            elevDefect = 'Path used elevator edges despite allowElevators: false';
                        }
                    }

                    // Verify policy: when allowElevators: true, direct elevator path succeeds
                    const routeWithElev = this.sandbox.aStarPath(this.graph, 'b1_f1_elev', 'b1_f7_elev', { allowElevators: true });
                    if (!routeWithElev) {
                        elevDefect = 'Cannot route through elevators with allowElevators: true';
                    }
                }
            }

            if (elevDefect) {
                this.addDefect('ELEVATOR_POLICY_VIOLATION', 'HIGH', elevDefect);
            }

            this.recordTest(
                tierId,
                'Feature 2.4: Elevator Policy Enforcement (Disabled by Default, Allowed via Options)',
                elevDefect === null,
                { defect: elevDefect }
            );
        }
    }

    // ------------------------------------------------------------------------
    // TIER 3: CROSS-FEATURE COMBINATIONS (SKYWALKS & CAMPUS GRAPH TOPOLOGY)
    // ------------------------------------------------------------------------
    runTier3() {
        const tierId = 'tier3_cross_building';

        // 1. Floor 2 Skywalk Bridges
        const bridges = [
            {
                name: 'K1 ↔ K2 Bridge (Floor 2)',
                nodeA: 'custom_b1_f2_c_180_-56_1nw',
                nodeB: 'b2_f2_c_20.4',
                bldgA: 1,
                bldgB: 2
            },
            {
                name: 'K1 ↔ K3 Junction (Floor 2)',
                nodeA: 'bridge_k1_k3_f2',
                nodeB: 'b3_f2_c_-14.0',
                bldgA: 1,
                bldgB: 3
            },
            {
                name: 'K3 ↔ K4 Bridge (Floor 2)',
                nodeA: 'bridge_k3_k4_f2',
                nodeB: 'b4_f2_bridge_k3_door',
                bldgA: 3,
                bldgB: 4
            },
            {
                name: 'K4 ↔ K2 Bridge (Floor 2)',
                nodeA: 'b4_f2_sw_-27.4',
                nodeB: 'b2_f2_c_37.5',
                intermediate: 'bridge_k4_k2_f2',
                bldgA: 4,
                bldgB: 2
            }
        ];

        const brokenBridges = [];
        for (const br of bridges) {
            const hasA = this.graph.hasNode(br.nodeA);
            const hasB = this.graph.hasNode(br.nodeB);
            const hasMid = br.intermediate ? this.graph.hasNode(br.intermediate) : true;

            if (!hasA || !hasB || !hasMid) {
                brokenBridges.push({ bridge: br.name, reason: 'Missing bridge endpoints' });
                this.addDefect('BROKEN_SKYWALK', 'CRITICAL', `Bridge '${br.name}' endpoints missing`, br);
                continue;
            }

            // Check A* path across bridge
            const route = this.sandbox.aStarPath(this.graph, br.nodeA, br.nodeB, { allowElevators: false });
            if (!route) {
                brokenBridges.push({ bridge: br.name, reason: 'No path across bridge' });
                this.addDefect('BROKEN_SKYWALK', 'CRITICAL', `Cannot route across '${br.name}'`, br);
            }
        }

        this.recordTest(
            tierId,
            'Feature 3.1: Floor 2 Cross-Building Skywalk Bridges (K1-K2, K1-K3, K3-K4, K4-K2)',
            brokenBridges.length === 0,
            { brokenBridges }
        );

        // 2. Connected Components Audit (BFS)
        const visited = new Set();
        const components = [];

        for (const nid of this.graph.nodes.keys()) {
            if (visited.has(nid)) continue;
            const comp = [];
            const queue = [nid];
            visited.add(nid);

            while (queue.length > 0) {
                const u = queue.shift();
                comp.push(u);
                const nbrs = this.graph.adj.get(u) || [];
                for (const edge of nbrs) {
                    if (!visited.has(edge.to)) {
                        visited.add(edge.to);
                        queue.push(edge.to);
                    }
                }
            }
            components.push(comp);
        }

        // Sort descending by component size
        components.sort((a, b) => b.length - a.length);

        const mainComponent = components[0] || [];
        const nonMainComponents = components.slice(1);
        const orphanNodesCount = nonMainComponents.reduce((acc, c) => acc + c.length, 0);

        const isolatedEntities = [];
        for (const comp of nonMainComponents) {
            for (const nid of comp) {
                const n = this.graph.getNode(nid);
                if (n) {
                    isolatedEntities.push({
                        id: nid,
                        type: n.type,
                        bldg: n.bldg,
                        floor: n.floor,
                        label: n.label,
                        compSize: comp.length
                    });
                }
            }
        }

        // Add defects for isolated nodes
        for (const ent of isolatedEntities) {
            const sev = (ent.type === 'room' || ent.type === 'stair') ? 'CRITICAL' : 'MEDIUM';
            this.addDefect(
                'ISOLATED_NODE',
                sev,
                `Node '${ent.id}' (${ent.type}) [B${ent.bldg} F${ent.floor}] '${ent.label}' is isolated from main campus component`,
                ent
            );
        }

        this.recordTest(
            tierId,
            'Feature 3.2: Campus Graph Connectivity & Component Unification (1 Component Target)',
            components.length === 1 && orphanNodesCount === 0,
            {
                totalComponents: components.length,
                mainComponentSize: mainComponent.length,
                otherComponentsCount: nonMainComponents.length,
                orphanNodesCount: orphanNodesCount,
                isolatedEntitiesSample: isolatedEntities.slice(0, 15)
            }
        );

        // 3. Cross-Building A* Routing Matrix (All 6 Building Pairs)
        const sampleNodes = {
            1: 'b1_f1_entrance_main',
            2: 'b2_f1_stair_lk1',
            3: 'b3_f1_stair_north',
            4: 'b4_f1_stair_lk1'
        };

        const pairs = [
            [1, 2], [1, 3], [1, 4],
            [2, 3], [2, 4], [3, 4]
        ];

        const pairFailures = [];
        for (const [bA, bB] of pairs) {
            const nodeA = sampleNodes[bA];
            const nodeB = sampleNodes[bB];
            if (!this.graph.hasNode(nodeA) || !this.graph.hasNode(nodeB)) {
                pairFailures.push({ pair: `K${bA} ↔ K${bB}`, reason: 'Sample endpoints missing' });
                continue;
            }
            const route = this.sandbox.aStarPath(this.graph, nodeA, nodeB, { allowElevators: false });
            if (!route) {
                pairFailures.push({ pair: `K${bA} ↔ K${bB}`, from: nodeA, to: nodeB });
                this.addDefect(
                    'CROSS_BUILDING_ROUTE_FAILURE',
                    'CRITICAL',
                    `Failed to route between Building ${bA} ('${nodeA}') and Building ${bB} ('${nodeB}')`,
                    { bldgA: bA, bldgB: bB, from: nodeA, to: nodeB }
                );
            }
        }

        this.recordTest(
            tierId,
            'Feature 3.3: Cross-Building Full Campus Routing (All 6 Pairs Tested)',
            pairFailures.length === 0,
            { failedPairs: pairFailures }
        );
    }

    // ------------------------------------------------------------------------
    // TIER 4: REAL-WORLD WORKLOADS & PHYSICAL INTEGRITY
    // ------------------------------------------------------------------------
    runTier4() {
        const tierId = 'tier4_workloads_physical';

        // 1. 50 Deterministic Representative Real-World Routes
        const workloadPairs = this.generateRepresentativeWorkloads();
        let successfulRoutes = 0;
        let totalLatencyMs = 0;
        const failedWorkloads = [];
        const slowQueries = [];

        for (const item of workloadPairs) {
            const hasStart = this.graph.hasNode(item.start);
            const hasDest = this.graph.hasNode(item.dest);

            if (!hasStart || !hasDest) {
                failedWorkloads.push({
                    name: item.name,
                    reason: `Node not found: ${!hasStart ? item.start : item.dest}`
                });
                continue;
            }

            const t0 = Date.now();
            const route = this.sandbox.aStarPath(this.graph, item.start, item.dest, {
                allowElevators: item.allowElevators || false
            });
            const dt = Date.now() - t0;
            totalLatencyMs += dt;

            if (dt > 10) {
                slowQueries.push({ name: item.name, latencyMs: dt });
            }

            if (route && route.path && route.path.length > 0) {
                successfulRoutes++;
            } else {
                failedWorkloads.push({ name: item.name, from: item.start, to: item.dest });
                this.addDefect(
                    'WORKLOAD_ROUTE_FAILURE',
                    'HIGH',
                    `Workload route '${item.name}' failed from '${item.start}' to '${item.dest}'`,
                    item
                );
            }
        }

        const avgLatency = workloadPairs.length > 0 ? (totalLatencyMs / workloadPairs.length) : 0;

        this.recordTest(
            tierId,
            'Feature 4.1: Representative Multi-Building Routing Workload (50 Routes)',
            failedWorkloads.length === 0,
            {
                totalWorkloads: workloadPairs.length,
                successfulRoutes: successfulRoutes,
                failedCount: failedWorkloads.length,
                totalLatencyMs: totalLatencyMs,
                avgLatencyMs: Math.round(avgLatency * 100) / 100,
                slowQueriesCount: slowQueries.length,
                failedWorkloads: failedWorkloads.slice(0, 10)
            }
        );

        // 2. 3D Wall Clearance & Physical Obstacle Avoidance
        const collidingEdges = [];
        const seenEdges = new Set();
        let edgesEvaluated = 0;

        for (const [uId, neighbors] of this.graph.adj.entries()) {
            const u = this.graph.getNode(uId);
            if (!u) continue;

            for (const edge of neighbors) {
                const vId = edge.to;
                const edgeKey = uId < vId ? `${uId}---${vId}` : `${vId}---${uId}`;
                if (seenEdges.has(edgeKey)) continue;
                seenEdges.add(edgeKey);

                const v = this.graph.getNode(vId);
                if (!v) continue;

                // Wall collision check only applies to intra-floor edges
                if (u.floor !== v.floor) continue;
                const floor = u.floor;

                // Filter by building if option is active
                if (this.opts.building !== null && u.bldg !== this.opts.building && v.bldg !== this.opts.building) {
                    continue;
                }

                edgesEvaluated++;

                for (let i = 0; i < this.walls.length; i++) {
                    const w = this.walls[i];
                    if (w.floor !== floor) continue;

                    const thickness = w.thickness || 0.18;
                    const clearanceThreshold = (thickness / 2.0) - 0.02;

                    const dist = distSegmentToSegment(u.x, u.z, v.x, v.z, w.x1, w.z1, w.x2, w.z2);

                    if (dist < clearanceThreshold) {
                        collidingEdges.push({
                            edge: edgeKey,
                            floor: floor,
                            bldgU: u.bldg,
                            bldgV: v.bldg,
                            uPos: `(${u.x}, ${u.z})`,
                            vPos: `(${v.x}, ${v.z})`,
                            wall: `(${w.x1}, ${w.z1}) -> (${w.x2}, ${w.z2})`,
                            thickness: thickness,
                            distance: Math.round(dist * 1000) / 1000
                        });

                        this.addDefect(
                            'WALL_COLLISION',
                            'CRITICAL',
                            `Edge '${uId}' <-> '${vId}' [F${floor}] embeds into wall (dist=${dist.toFixed(3)}m < ${clearanceThreshold.toFixed(3)}m)`,
                            { uId, vId, floor, dist, wall: w }
                        );
                        break; // Stop at first colliding wall for this edge
                    }
                }
            }
        }

        this.recordTest(
            tierId,
            'Feature 4.2: 3D Physical Wall Clearance & Collision Avoidance (thickness / 2 Clearance)',
            collidingEdges.length === 0,
            {
                uniqueEdgesEvaluated: edgesEvaluated,
                collidingEdgesCount: collidingEdges.length,
                collidingSample: collidingEdges.slice(0, 15)
            }
        );
    }

    // ------------------------------------------------------------------------
    // WORKLOAD MATRIX GENERATOR (50 REPRESENTATIVE ROUTES)
    // ------------------------------------------------------------------------
    generateRepresentativeWorkloads() {
        const workloads = [];

        // 1. Main Entrance (K1 F1) to Various Heights & Wings (B1)
        workloads.push({ name: 'Entrance -> K1 F7 Top Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f7_nc_0.0' });
        workloads.push({ name: 'Entrance -> K1 F6 Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f6_nc_0.0' });
        workloads.push({ name: 'Entrance -> K1 F5 Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f5_nc_0.0' });
        workloads.push({ name: 'Entrance -> K1 F4 Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f4_nc_0.0' });
        workloads.push({ name: 'Entrance -> K1 F3 Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f3_nc_0.0' });
        workloads.push({ name: 'Entrance -> K1 F2 Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f2_nc_0.0' });
        workloads.push({ name: 'Entrance -> K1 F1 West Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f1_wc_-3.0' });
        workloads.push({ name: 'Entrance -> K1 F1 South Corridor', start: 'b1_f1_entrance_main', dest: 'b1_f1_sc_3.5' });

        // 2. Main Entrance to Other Buildings (Ground & Skywalk)
        workloads.push({ name: 'Entrance -> K2 F1 Corridor', start: 'b1_f1_entrance_main', dest: 'b2_f1_c_37.5' });
        workloads.push({ name: 'Entrance -> K2 F2 Corridor', start: 'b1_f1_entrance_main', dest: 'b2_f2_c_37.5' });
        workloads.push({ name: 'Entrance -> K2 F3 Corridor', start: 'b1_f1_entrance_main', dest: 'b2_f3_c_37.5' });
        workloads.push({ name: 'Entrance -> K3 F1 Corridor', start: 'b1_f1_entrance_main', dest: 'b3_f1_c_-28.6' });
        workloads.push({ name: 'Entrance -> K3 F2 Corridor', start: 'b1_f1_entrance_main', dest: 'b3_f2_c_-26.0' });
        workloads.push({ name: 'Entrance -> K4 F1 Stairs LK-1', start: 'b1_f1_entrance_main', dest: 'b4_f1_stair_lk1' });
        workloads.push({ name: 'Entrance -> K4 F2 Stairs LK-1', start: 'b1_f1_entrance_main', dest: 'b4_f2_stair_lk1' });
        workloads.push({ name: 'Entrance -> K4 F3 Stairs LK-1', start: 'b1_f1_entrance_main', dest: 'b4_f3_stair_lk1' });

        // 3. High-Level Inter-Building Skywalk Routes
        workloads.push({ name: 'K1 F7 Top -> K4 F3 Top', start: 'b1_f7_nc_0.0', dest: 'b4_f3_stair_lk1' });
        workloads.push({ name: 'K1 F5 -> K2 F3', start: 'b1_f5_nc_0.0', dest: 'b2_f3_c_37.5' });
        workloads.push({ name: 'K1 F4 -> K3 F2', start: 'b1_f4_nc_0.0', dest: 'b3_f2_c_-26.0' });
        workloads.push({ name: 'K2 F3 -> K3 F2', start: 'b2_f3_c_37.5', dest: 'b3_f2_c_-26.0' });
        workloads.push({ name: 'K2 F3 -> K4 F3', start: 'b2_f3_c_37.5', dest: 'b4_f3_stair_lk1' });
        workloads.push({ name: 'K3 F2 -> K4 F3', start: 'b3_f2_c_-26.0', dest: 'b4_f3_stair_lk1' });
        workloads.push({ name: 'K4 F2 -> K1 F3', start: 'b4_f2_stair_lk1', dest: 'b1_f3_nc_0.0' });
        workloads.push({ name: 'K3 F1 -> K2 F1', start: 'b3_f1_c_-28.6', dest: 'b2_f1_c_37.5' });
        workloads.push({ name: 'K4 F1 -> K1 F2', start: 'b4_f1_stair_lk1', dest: 'b1_f2_nc_0.0' });
        workloads.push({ name: 'K2 F2 -> K3 F1', start: 'b2_f2_c_37.5', dest: 'b3_f1_c_-28.6' });

        // 4. Vertical Stair Transfers Within and Across Buildings
        workloads.push({ name: 'K1 LK-1 F1 -> K1 LK-2 F7', start: 'b1_f1_stair_lk1', dest: 'b1_f7_stair_lk2' });
        workloads.push({ name: 'K2 LK-1 F1 -> K2 LK-2 F3', start: 'b2_f1_stair_lk1', dest: 'b2_f3_stair_lk2' });
        workloads.push({ name: 'K4 LK-1 F1 -> K4 LK-2 F3', start: 'b4_f1_stair_lk1', dest: 'b4_f3_stair_lk2' });
        workloads.push({ name: 'K3 South LK F1 -> K3 North LK F2', start: 'b3_f1_stair_south', dest: 'b3_f2_stair_north' });
        workloads.push({ name: 'K1 LK-1 F4 -> K2 LK-1 F2', start: 'b1_f4_stair_lk1', dest: 'b2_f2_stair_lk1' });
        workloads.push({ name: 'K3 South LK F2 -> K4 LK-3 F2', start: 'b3_f2_stair_south', dest: 'b4_f2_stair_lk3' });

        // 5. Accessible Elevator Routing (allowElevators: true)
        workloads.push({ name: 'K1 F1 Elev -> K1 F7 Elev (Elev Mode)', start: 'b1_f1_elev', dest: 'b1_f7_elev', allowElevators: true });
        workloads.push({ name: 'K1 F1 Elev -> K1 F5 Elev (Elev Mode)', start: 'b1_f1_elev', dest: 'b1_f5_elev', allowElevators: true });
        workloads.push({ name: 'K1 F2 Elev -> K1 F6 Elev (Elev Mode)', start: 'b1_f2_elev', dest: 'b1_f6_elev', allowElevators: true });
        workloads.push({ name: 'K1 F3 Elev -> K1 F4 Elev (Elev Mode)', start: 'b1_f3_elev', dest: 'b1_f4_elev', allowElevators: true });

        // 6. Restroom Searches (findClosestToilet)
        const toiletPoints = [
            { floor: 1, bldg: 1, x: 0.0, z: 6.0 },
            { floor: 2, bldg: 1, x: 3.5, z: 6.0 },
            { floor: 3, bldg: 1, x: -3.0, z: 1.7 },
            { floor: 4, bldg: 1, x: 9.4, z: 6.0 },
            { floor: 5, bldg: 1, x: 0.0, z: -5.8 }
        ];

        for (let idx = 0; idx < toiletPoints.length; idx++) {
            const tp = toiletPoints[idx];
            const toilet = this.sandbox.findClosestToilet(tp);
            if (toilet && this.graph.hasNode(toilet.id)) {
                const startCorr = this.graph.findClosestNode(tp.floor, tp.bldg, tp.x, tp.z, ['corridor']);
                if (startCorr) {
                    workloads.push({
                        name: `Toilet Search from [B${tp.bldg} F${tp.floor}] (${tp.x}, ${tp.z})`,
                        start: startCorr.id,
                        dest: toilet.id
                    });
                }
            }
        }

        // 7. Academic Room-to-Room Connections
        const sampleRooms = [
            ['room_1_1_1', 'room_1_1_2'],
            ['room_1_2_16', 'room_1_2_20'],
            ['room_1_3_31', 'room_1_3_35'],
            ['room_1_4_46', 'room_1_4_52'],
            ['room_1_5_61', 'room_1_5_67'],
            ['room_1_6_76', 'room_1_6_82'],
            ['room_1_7_91', 'room_1_7_97'],
            ['room_2_1_106', 'room_2_1_112'],
            ['room_2_2_120', 'room_2_2_126'],
            ['room_3_1_150', 'room_3_1_155'],
            ['room_3_2_160', 'room_3_2_165'],
            ['room_4_1_180', 'room_4_1_185'],
            ['room_4_2_200', 'room_4_2_205']
        ];

        for (const [rA, rB] of sampleRooms) {
            if (this.graph.hasNode(rA) && this.graph.hasNode(rB)) {
                workloads.push({ name: `Room ${rA} -> Room ${rB}`, start: rA, dest: rB });
            }
        }

        // Fill remaining slots up to 50 using valid connected corridor pairs
        let corridorNodes = [];
        for (const [nid, node] of this.graph.nodes) {
            if (node.type === 'corridor') corridorNodes.push(nid);
        }
        let cIdx = 0;
        while (workloads.length < 50 && cIdx + 1 < corridorNodes.length) {
            const nA = corridorNodes[cIdx];
            const nB = corridorNodes[cIdx + 1];
            workloads.push({ name: `Circulation ${nA} -> ${nB}`, start: nA, dest: nB });
            cIdx += 2;
        }

        return workloads.slice(0, 50);
    }

    // ------------------------------------------------------------------------
    // RUN ORCHESTRATION
    // ------------------------------------------------------------------------
    run() {
        const runAll = this.opts.tier === null;

        if (runAll || this.opts.tier === 1) this.runTier1();
        if (runAll || this.opts.tier === 2) this.runTier2();
        if (runAll || this.opts.tier === 3) this.runTier3();
        if (runAll || this.opts.tier === 4) this.runTier4();

        return this.results;
    }
}

// ----------------------------------------------------------------------------
// 5. CONSOLE REPORTING & OUTPUT FORMATTER
// ----------------------------------------------------------------------------
function printConsoleReport(results, opts) {
    const isTTY = Boolean(process.stdout.isTTY);
    const color = {
        reset: isTTY ? '\x1b[0m' : '',
        bold: isTTY ? '\x1b[1m' : '',
        red: isTTY ? '\x1b[31m' : '',
        green: isTTY ? '\x1b[32m' : '',
        yellow: isTTY ? '\x1b[33m' : '',
        blue: isTTY ? '\x1b[34m' : '',
        magenta: isTTY ? '\x1b[35m' : '',
        cyan: isTTY ? '\x1b[36m' : '',
        gray: isTTY ? '\x1b[90m' : ''
    };

    console.log(`\n${color.bold}${color.cyan}================================================================================${color.reset}`);
    console.log(`${color.bold}${color.cyan}       MGKCT 3D — HEADLESS CAMPUS NAVIGATION & ARCHITECTURE TEST SUITE          ${color.reset}`);
    console.log(`${color.bold}${color.cyan}================================================================================${color.reset}`);
    console.log(`${color.gray}Runtime: Node.js ${process.version} (Zero-Bundler VM Sandbox) | Timestamp: ${results.timestamp}${color.reset}\n`);

    console.log(`${color.bold}Campus Geometry & Graph Metrics:${color.reset}`);
    console.log(`  • Registered Rooms : ${color.yellow}${results.metrics.totalRoomsInRegistry}${color.reset}`);
    console.log(`  • Solid Walls      : ${color.yellow}${results.metrics.totalWallsInRegistry}${color.reset}`);
    console.log(`  • Door Openings    : ${color.yellow}${results.metrics.totalDoorsInRegistry}${color.reset}`);
    console.log(`  • Navigation Nodes : ${color.yellow}${results.metrics.graphNodesCount}${color.reset}`);
    console.log(`  • Adjacency Edges  : ${color.yellow}${results.metrics.graphEdgesCount}${color.reset}\n`);

    const tierLabels = {
        tier1_feature_coverage: 'TIER 1: Feature Coverage (Rooms & Door Gateways)',
        tier2_boundary_corner: 'TIER 2: Boundary & Corner Conditions (Vertical Stair & Elevators)',
        tier3_cross_building: 'TIER 3: Cross-Feature Combinations (Floor 2 Skywalks & Topology)',
        tier4_workloads_physical: 'TIER 4: Real-World Workloads & Physical Integrity (Latency & Walls)'
    };

    for (const [tierId, tierData] of Object.entries(results.tiers)) {
        const title = tierLabels[tierId] || tierId;
        const tierBadge = tierData.failed === 0
            ? `${color.green}${color.bold}[PASS]${color.reset}`
            : `${color.red}${color.bold}[FAIL]${color.reset}`;

        console.log(`--------------------------------------------------------------------------------`);
        console.log(`${tierBadge} ${color.bold}${title}${color.reset} (${tierData.passed}/${tierData.tests.length} passed)`);
        console.log(`--------------------------------------------------------------------------------`);

        for (const t of tierData.tests) {
            const statusIcon = t.passed ? `${color.green}✓ PASS${color.reset}` : `${color.red}✗ FAIL${color.reset}`;
            console.log(`  ${statusIcon} ${t.testName}`);

            if (!t.passed || opts.verbose) {
                for (const [k, v] of Object.entries(t.details)) {
                    if (Array.isArray(v)) {
                        if (v.length > 0) {
                            console.log(`      ${color.gray}${k} (${v.length} items):${color.reset}`);
                            const displayItems = opts.verbose ? v : v.slice(0, 5);
                            displayItems.forEach(item => {
                                console.log(`        - ${typeof item === 'object' ? JSON.stringify(item) : item}`);
                            });
                            if (!opts.verbose && v.length > 5) {
                                console.log(`        ${color.gray}... and ${v.length - 5} more items (use --verbose to expand)${color.reset}`);
                            }
                        }
                    } else if (typeof v === 'object' && v !== null) {
                        console.log(`      ${color.gray}${k}: ${JSON.stringify(v)}${color.reset}`);
                    } else {
                        console.log(`      ${color.gray}${k}: ${v}${color.reset}`);
                    }
                }
            }
        }
        console.log('');
    }

    // Defect Summary
    console.log(`${color.bold}================================================================================${color.reset}`);
    console.log(`${color.bold}                             TEST EXECUTION SUMMARY                             ${color.reset}`);
    console.log(`${color.bold}================================================================================${color.reset}`);
    console.log(`  Total Tests Executed : ${results.summary.totalTests}`);
    console.log(`  Passed Tests         : ${color.green}${results.summary.passed}${color.reset}`);
    console.log(`  Failed Tests         : ${results.summary.failed > 0 ? color.red : color.green}${results.summary.failed}${color.reset}`);
    console.log(`  Total Defects Logged : ${results.defects.length > 0 ? color.yellow : color.green}${results.defects.length}${color.reset}`);

    if (results.defects.length > 0) {
        const countsByCategory = {};
        for (const d of results.defects) {
            countsByCategory[d.category] = (countsByCategory[d.category] || 0) + 1;
        }

        console.log(`\n${color.bold}Discovered Implementation Defects (Pending Milestone Fixes):${color.reset}`);
        for (const [cat, cnt] of Object.entries(countsByCategory)) {
            console.log(`  • ${color.yellow}${cat}${color.reset}: ${cnt} instances`);
        }
    }

    if (results.summary.allPassed) {
        console.log(`\n${color.bold}${color.green}>>> ALL CAMPUS NAVIGATION & ARCHITECTURE TESTS PASSED SUCCESSFULLY! <<<\n${color.reset}`);
    } else {
        console.log(`\n${color.bold}${color.yellow}>>> BASELINE DEFECTS IDENTIFIED — TO BE RESOLVED ACROSS MILESTONES M1-M5 <<<\n${color.reset}`);
    }
}

// ----------------------------------------------------------------------------
// 6. MAIN RUNNER
// ----------------------------------------------------------------------------
function main() {
    const projectRoot = path.resolve(__dirname, '..');
    const env = createHeadlessCampusEnvironment(projectRoot);
    const suite = new NavigationTestSuite(env, options);
    const results = suite.run();

    if (options.json) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        printConsoleReport(results, options);
    }

    // Determine exit code
    if (options.allowDefects) {
        process.exit(0);
    } else if (options.strict && !results.summary.allPassed) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

main();
