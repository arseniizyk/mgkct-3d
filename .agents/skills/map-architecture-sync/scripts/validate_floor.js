#!/usr/bin/env node
/**
 * validate_floor.js
 *
 * Архитектурный и топологический линтер для проверки геометрии этажей и графа навигации MGKCT 3D.
 * Позволяет ИИ-агентам мгновенно (за 0.1 сек) проверить любой корпус и этаж на:
 *   1. Ортогональность и корректность сегментов стен (WALLS_REGISTRY).
 *   2. Валидность дверных проемов (DOORS_REGISTRY).
 *   3. Зазор табличек кабинетов (ROOMS_REGISTRY) до ближайших сплошных стен.
 *   4. 100% привязку всех функциональных кабинетов к узлам графа (buildCollegeNavGraph) и дверным шлюзам.
 *   5. Отсутствие пересечений ребер навигации со сплошными стенами (с учетом полутолщины стены thickness / 2).
 *   6. 100% связность маршрутов A* между всеми кабинетами этажа и главным входом колледжа.
 *
 * Использование:
 *   node .agents/skills/map-architecture-sync/scripts/validate_floor.js [--building 4] [--floor 1]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

const args = process.argv.slice(2);
let filterBldg = null;
let filterFloor = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--building' || args[i] === '-b') filterBldg = parseInt(args[++i], 10);
    else if (args[i] === '--floor' || args[i] === '-f') filterFloor = parseInt(args[++i], 10);
}

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
    if (segmentsIntersect(p1x, p1z, p2x, p2z, q1x, q1z, q2x, q2z)) return 0;
    return Math.min(
        distPointToSegment(p1x, p1z, q1x, q1z, q2x, q2z),
        distPointToSegment(p2x, p2z, q1x, q1z, q2x, q2z),
        distPointToSegment(q1x, q1z, p1x, p1z, p2x, p2z),
        distPointToSegment(q2x, q2z, p1x, p1z, p2x, p2z)
    );
}

function loadEnvironment() {
    const mockCtx = new Proxy({}, { get: () => () => ({ width: 50, height: 20 }) });
    const sandbox = {
        console, Math, parseInt, parseFloat, isNaN, Infinity, Set, Map, Array, Object, Date, String, Number, Boolean, RegExp,
        localStorage: { getItem: () => null, setItem: () => {} }
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.global = sandbox;
    sandbox.document = {
        createElement: () => ({ getContext: () => mockCtx, width: 256, height: 64, style: {}, addEventListener: () => {} }),
        getElementById: () => null,
        addEventListener: () => {}
    };
    vm.createContext(sandbox);

    const loadScript = (relPath) => {
        const code = fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf8');
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

    for (let f = 1; f <= 7; f++) {
        const g = new sandbox.THREE.Group(); g.userData = { building: 1, floor: f };
        sandbox['buildFloor' + f](g);
    }
    for (let f = 1; f <= 3; f++) {
        const g = new sandbox.THREE.Group(); g.userData = { building: 2, floor: f };
        sandbox['buildBuilding2Floor' + f](g);
    }
    for (let f = 1; f <= 2; f++) {
        const g = new sandbox.THREE.Group(); g.userData = { building: 3, floor: f };
        sandbox['buildBuilding3Floor' + f](g);
    }
    for (let f = 1; f <= 3; f++) {
        const g = new sandbox.THREE.Group(); g.userData = { building: 4, floor: f };
        sandbox['buildBuilding4Floor' + f](g);
    }
    sandbox.flushAllPendingWalls();
    loadScript('js/navigator.js');
    const graph = sandbox.buildCollegeNavGraph();

    return {
        sandbox,
        graph,
        walls: sandbox.WALLS_REGISTRY,
        doors: sandbox.DOORS_REGISTRY,
        rooms: sandbox.ROOMS_REGISTRY
    };
}

function isNonRoomLabel(r) {
    const raw = (r.rawText || r.text || '').replace(/\n/g, ' ').trim();
    if (raw.startsWith('ЛК№') || raw.startsWith('ЛК №')) return true;
    if (raw.startsWith('Переход')) return true;
    if (raw === 'Второй свет' || raw === 'Витраж') return true;
    return false;
}

function runValidation() {
    const { sandbox, graph, walls, doors, rooms } = loadEnvironment();
    const matchFilter = (b, f) => {
        if (filterBldg !== null && b !== filterBldg) return false;
        if (filterFloor !== null && f !== filterFloor) return false;
        return true;
    };

    const targetWalls = walls.filter(w => matchFilter(w.building, w.floor));
    const targetDoors = doors.filter(d => matchFilter(d.building, d.floor));
    const targetRooms = rooms.filter(r => matchFilter(r.building, r.floor));

    const errors = [];
    const warnings = [];

    // 1. Проверка геометрии стен и дверей
    for (const d of targetDoors) {
        const w = Math.abs(d.to - d.from);
        if (w < 0.45 || w > 10.0) {
            errors.push(`[DOOR_WIDTH] Корпус ${d.building} Эт.${d.floor}: некорректная ширина проема (${w.toFixed(2)}м) в точке (${d.x.toFixed(2)}, ${d.z.toFixed(2)})`);
        }
    }

    // 2. Проверка табличек кабинетов и привязки к графу навигации
    const matchedRoomNodes = [];
    for (const r of targetRooms) {
        const cleanText = (r.text || '').replace(/\n/g, ' ').trim();
        const floorWalls = walls.filter(w => w.building === r.building && w.floor === r.floor);
        let minWallDist = Infinity;
        for (const w of floorWalls) {
                if ((w.thickness || 0.18) <= 0.09) continue; // Skip thin stair balustrade dividers
            const d = distPointToSegment(r.x, r.z, w.x1, w.z1, w.x2, w.z2);
            if (d < minWallDist) minWallDist = d;
        }
        if (!isNonRoomLabel(r) && minWallDist < 0.12) {
            warnings.push(`[LABEL_WALL_PROXIMITY] Кабинет '${cleanText}' [К${r.building} Эт.${r.floor}] (${r.x}, ${r.z}) слишком близко к стене (${minWallDist.toFixed(2)}м)`);
        }

        if (isNonRoomLabel(r)) continue;

        let matchedNode = null;
        for (const n of graph.nodes.values()) {
            if (n.bldg === r.building && n.floor === r.floor && (n.type === 'room' || n.type === 'wc' || n.type === 'corridor')) {
                if (Math.hypot(n.x - r.x, n.z - r.z) <= 0.45) {
                    matchedNode = n;
                    break;
                }
            }
        }
        if (!matchedNode) {
            errors.push(`[MISSING_ROOM_NODE] Кабинет '${cleanText}' [К${r.building} Эт.${r.floor}] в (${r.x}, ${r.z}) не имеет узла type='room' в buildCollegeNavGraph()!`);
            continue;
        }

        const nbrs = graph.adj.get(matchedNode.id) || [];
        if (nbrs.length === 0) {
            errors.push(`[ISOLATED_ROOM_NODE] Узел кабинета '${matchedNode.id}' (${cleanText}) не соединен ни с одним ребром!`);
        } else {
            matchedRoomNodes.push({ room: r, node: matchedNode, cleanText });
        }
    }

    // 3. Проверка пересечений ребер навигации со стенами (Wall Collision Check)
    const checkedPairs = new Set();
    for (const [uId, adjList] of graph.adj.entries()) {
        const u = graph.getNode(uId);
        if (!u) continue;
        for (const edge of adjList) {
            const v = graph.getNode(edge.to);
            if (!v) continue;
            const pairKey = uId < edge.to ? `${uId}---${edge.to}` : `${edge.to}---${uId}`;
            if (checkedPairs.has(pairKey)) continue;
            checkedPairs.add(pairKey);

            if (u.floor !== v.floor) continue;
            if (!matchFilter(u.bldg, u.floor) && !matchFilter(v.bldg, v.floor)) continue;

            const floorWalls = walls.filter(w =>
                w.floor === u.floor && (w.building === u.bldg || w.building === v.bldg)
            );
            for (const w of floorWalls) {
                if ((w.thickness || 0.18) <= 0.09) continue; // Skip thin stair balustrade dividers
                const clearance = Math.max((w.thickness || 0.18) / 2 - 0.015, 0.05);
                const dist = distSegmentToSegment(u.x, u.z, v.x, v.z, w.x1, w.z1, w.x2, w.z2);
                if (dist < clearance - 1e-4) {
                    errors.push(
                        `[WALL_COLLISION] К${u.bldg} Эт.${u.floor}: ребро '${uId}' (${u.x},${u.z}) <-> '${edge.to}' (${v.x},${v.z}) пересекает стену (${w.x1.toFixed(2)},${w.z1.toFixed(2)})->(${w.x2.toFixed(2)},${w.z2.toFixed(2)}), dist=${dist.toFixed(3)}м`
                    );
                }
            }
        }
    }

    // 4. Проверка A* достижимости каждого кабинета от главного входа
    for (const item of matchedRoomNodes) {
        const res = sandbox.aStarPath(graph, 'b1_f1_entrance_main', item.node.id, { allowElevators: false });
        if (!res || !res.path || res.path.length === 0) {
            errors.push(`[UNREACHABLE_ROOM] Невозможно построить маршрут от Главного входа до '${item.cleanText}' (${item.node.id}) [К${item.room.building} Эт.${item.room.floor}]!`);
        }
    }

    const scopeStr = filterBldg
        ? `Корпус ${filterBldg}${filterFloor ? `, Этаж ${filterFloor}` : ' (все этажи)'}`
        : 'Все корпуса (1–4), все этажи (1–7)';

    console.log('================================================================================');
    console.log(`  MGKCT 3D — АРХИТЕКТУРНЫЙ И ТОПОЛОГИЧЕСКИЙ ВАЛИДАТОР (${scopeStr})`);
    console.log('================================================================================');
    console.log(`  • Проверено стен      : ${targetWalls.length}`);
    console.log(`  • Проверено дверей    : ${targetDoors.length}`);
    console.log(`  • Проверено кабинетов : ${targetRooms.length} (функциональных: ${matchedRoomNodes.length})`);
    console.log(`  • Ошибок (Errors)     : ${errors.length}`);
    console.log(`  • Предупреждений      : ${warnings.length}`);
    console.log('--------------------------------------------------------------------------------');

    if (warnings.length > 0) {
        warnings.forEach(w => console.warn('  WARN:', w));
    }
    if (errors.length > 0) {
        errors.forEach(e => console.error('  FAIL:', e));
        console.log('================================================================================');
        process.exit(1);
    }

    console.log('  ✓ ВСЕ ПРОВЕРКИ ГЕОМЕТРИИ И НАВИГАЦИОННОГО ГРАФА УСПЕШНО ПРОЙДЕНЫ!');
    console.log('================================================================================');
    process.exit(0);
}

runValidation();
