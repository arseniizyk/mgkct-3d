// Безопасное экранирование HTML для предотвращения XSS-инъекций в автокомплите и навигаторе
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
if (typeof window !== 'undefined' && !window.escapeHtml) {
    window.escapeHtml = escapeHtml;
}

function calculateWalkTime(totalDistance, stairTransitionsCount = 0) {
    const stairDelaySec = (stairTransitionsCount || 0) * 45;
    const totalWalkSec = (totalDistance / 1.15) + stairDelaySec;
    return Math.max(1, Math.round((totalWalkSec / 60) * 10) / 10);
}
window.calculateWalkTime = calculateWalkTime;

// ============================================================================
// МОДУЛЬ НАВИГАТОРА И ПОСТРОЕНИЯ КРАТЧАЙШИХ МАРШРУТОВ ПО КОЛЛЕДЖУ (A*)
// Полнофункциональная сквозная навигация: кабинеты, коридоры, лестницы, переходы
// ============================================================================

(function() {
    'use strict';

    // ------------------------------------------------------------------------
    // СОСТОЯНИЕ НАВИГАТОРА
    // ------------------------------------------------------------------------
    const NAV_STATE = {
        _graph: null,
        get graph() {
            if (!this._graph) {
                this._graph = buildCollegeNavGraph();
            }
            return this._graph;
        },
        set graph(val) {
            this._graph = val;
        },
        isInitialized: false,
        startPoint: null,       // { id, text, floor, building, x, z, type }
        destPoint: null,        // { id, text, floor, building, x, z, type }
        activeRoute: null,      // Полный объект рассчитанного маршрута
        pickingMode: null,      // 'start' | 'dest' | null (выбор точки на карте)
        routeFloorGroups: {},   // floorNum -> THREE.Group с геометрией пути
        animationTime: 0,
        activeStepIndex: 0,
        allowElevators: false // По умолчанию выключены (только лестницы)
    };

    window.NAV_STATE = NAV_STATE;
    window.buildCollegeNavGraph = buildCollegeNavGraph;

    // ------------------------------------------------------------------------
    // ПРИОРИТЕТНАЯ ОЧЕРЕДЬ (BINARY MIN-HEAP) ДЛЯ АЛГОРИТМА A*
    // ------------------------------------------------------------------------
    class MinHeap {
        constructor() {
            this.heap = [];
        }
        push(item, priority) {
            this.heap.push({ item, priority });
            this._bubbleUp(this.heap.length - 1);
        }
        pop() {
            if (this.heap.length === 0) return null;
            const top = this.heap[0].item;
            const bottom = this.heap.pop();
            if (this.heap.length > 0) {
                this.heap[0] = bottom;
                this._bubbleDown(0);
            }
            return top;
        }
        isEmpty() {
            return this.heap.length === 0;
        }
        _bubbleUp(idx) {
            while (idx > 0) {
                const parentIdx = (idx - 1) >> 1;
                if (this.heap[idx].priority < this.heap[parentIdx].priority) {
                    const tmp = this.heap[idx];
                    this.heap[idx] = this.heap[parentIdx];
                    this.heap[parentIdx] = tmp;
                    idx = parentIdx;
                } else {
                    break;
                }
            }
        }
        _bubbleDown(idx) {
            const length = this.heap.length;
            while (true) {
                let smallest = idx;
                const left = (idx << 1) + 1;
                const right = left + 1;
                if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
                    smallest = left;
                }
                if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
                    smallest = right;
                }
                if (smallest !== idx) {
                    const tmp = this.heap[idx];
                    this.heap[idx] = this.heap[smallest];
                    this.heap[smallest] = tmp;
                    idx = smallest;
                } else {
                    break;
                }
            }
        }
    }

    // ------------------------------------------------------------------------
    // ГРАФ НАВИГАЦИИ
    // ------------------------------------------------------------------------
    class NavigationGraph {
        constructor() {
            this.nodes = new Map(); // id -> node
            this.adj = new Map();   // id -> [{ to, weight }]
            this.nodesByFloor = new Map(); // floor -> node[] для O(1) пространственной выборки
        }

        addNode(id, floor, bldg, x, z, type = 'corridor', label = '') {
            if (!this.nodes.has(id)) {
                const nodeObj = {
                    id,
                    floor: parseInt(floor, 10),
                    bldg: parseInt(bldg, 10),
                    x: Math.round(x * 100) / 100,
                    z: Math.round(z * 100) / 100,
                    type,
                    label: label || ''
                };
                this.nodes.set(id, nodeObj);
                this.adj.set(id, []);
                let floorList = this.nodesByFloor.get(nodeObj.floor);
                if (!floorList) {
                    floorList = [];
                    this.nodesByFloor.set(nodeObj.floor, floorList);
                }
                floorList.push(nodeObj);
            }
            return id;
        }

        addEdge(u, v, customWeight = null, bidirectional = true, meta = {}) {
            const nodeU = this.nodes.get(u);
            const nodeV = this.nodes.get(v);
            if (!nodeU || !nodeV) return;

            let w = customWeight;
            if (w === null) {
                const dx = nodeU.x - nodeV.x;
                const dz = nodeU.z - nodeV.z;
                const floorDiff = Math.abs(nodeU.floor - nodeV.floor);
                // Стоимость перехода по этажу: горизонтальное расстояние + вес подъёма по лестнице
                w = Math.hypot(dx, dz) + floorDiff * 5.0;
            }

            const isElev = Boolean(meta.isElevator);
            this.adj.get(u).push({ to: v, weight: w, isElevator: isElev });
            if (bidirectional) {
                this.adj.get(v).push({ to: u, weight: w, isElevator: isElev });
            }
        }

        hasNode(id) {
            return this.nodes.has(id);
        }

        getNode(id) {
            return this.nodes.get(id);
        }

        // Поиск ближайшего узла графа к заданным координатам через индекс этажей nodesByFloor
        findClosestNode(floor, bldg, x, z, allowedTypes = ['corridor', 'door', 'stair', 'bridge', 'entrance']) {
            let bestNode = null;
            let bestDistSq = Infinity;
            const floorNum = parseInt(floor, 10);
            const candidates = this.nodesByFloor.get(floorNum) || [];
            const typeSet = (Array.isArray(allowedTypes) && allowedTypes.length > 0) ? new Set(allowedTypes) : null;

            for (let i = 0; i < candidates.length; i++) {
                const node = candidates[i];
                if (bldg !== null && bldg !== undefined && node.bldg !== bldg) continue;
                if (typeSet && !typeSet.has(node.type)) continue;

                const dx = node.x - x;
                const dz = node.z - z;
                const dSq = dx * dx + dz * dz;
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    bestNode = node;
                }
            }

            // Если в рамках одного корпуса не нашли, пробуем любой узел на этом этаже
            if (!bestNode) {
                for (let i = 0; i < candidates.length; i++) {
                    const node = candidates[i];
                    if (typeSet && !typeSet.has(node.type)) continue;
                    const dx = node.x - x;
                    const dz = node.z - z;
                    const dSq = dx * dx + dz * dz;
                    if (dSq < bestDistSq) {
                        bestDistSq = dSq;
                        bestNode = node;
                    }
                }
            }

            return bestNode;
        }
    }

    // ------------------------------------------------------------------------
    // ПРОВЕРКА ПЕРЕСЕЧЕНИЯ ОТРЕЗКА ПУТИ С КАПИТАЛЬНЫМИ СТЕНАМИ
    // ------------------------------------------------------------------------
    function ccw(ax, az, bx, bz, cx, cz) {
        return (cz - az) * (bx - ax) - (bz - az) * (cx - ax);
    }

    function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
        const cp1 = ccw(ax, az, bx, bz, cx, cz);
        const cp2 = ccw(ax, az, bx, bz, dx, dz);
        const cp3 = ccw(cx, cz, dx, dz, ax, az);
        const cp4 = ccw(cx, cz, dx, dz, bx, bz);

        if (((cp1 > 1e-4 && cp2 < -1e-4) || (cp1 < -1e-4 && cp2 > 1e-4)) &&
            ((cp3 > 1e-4 && cp4 < -1e-4) || (cp3 < -1e-4 && cp4 > 1e-4))) {
            return true;
        }
        return false;
    }

    function doesIntersectWall(floor, bldg, x1, z1, x2, z2) {
        if (typeof WALLS_REGISTRY === 'undefined' || !Array.isArray(WALLS_REGISTRY) || WALLS_REGISTRY.length === 0) {
            return false;
        }
        for (let i = 0; i < WALLS_REGISTRY.length; i++) {
            const w = WALLS_REGISTRY[i];
            if (w.floor !== floor) continue;
            if (bldg !== null && bldg !== undefined && w.building !== bldg) continue;
            if (segmentsIntersect(x1, z1, x2, z2, w.x1, w.z1, w.x2, w.z2)) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------------
    // ПОСТРОЕНИЕ ПОЛНОГО ГРАФА КОЛЛЕДЖА
    // ------------------------------------------------------------------------
    function buildCollegeNavGraph() {
        const g = new NavigationGraph();
        // 1. УЗЛЫ ПУТЕЙ
        g.addNode("b1_f5_nc_-6.0", 5, 1, -6, -5, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_nc_door_-5.8", 5, 1, -5.8, -5, "door", "К1 Эт.5 Дверь север");
        g.addNode("b1_f5_nc_-3.0", 5, 1, -3, -5.8, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_nc_0.0", 5, 1, 0, -5.8, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_nc_3.0", 5, 1, 3, -5.8, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_nc_5.9", 5, 1, 5.9, -5.8, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_nc_9.4", 5, 1, 9.4, -5.8, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_nc_12.5", 5, 1, 12.5, -5.8, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_nc_16.0", 5, 1, 15.6, -5.8, "corridor", "К1 Эт.5 Сев. коридор");
        g.addNode("b1_f5_wc_-3.0", 5, 1, -3, -3, "corridor", "К1 Эт.5 Зап. коридор");
        g.addNode("b1_f5_wc_0.0", 5, 1, -3, 0, "corridor", "К1 Эт.5 Зап. коридор");
        g.addNode("b1_f5_wc_1.7", 5, 1, -3, 1.7, "corridor", "К1 Эт.5 Зап. коридор");
        g.addNode("b1_f5_wc_3.5", 5, 1, -3, 3.5, "corridor", "К1 Эт.5 Зап. коридор");
        g.addNode("b1_f5_wc_6.0", 5, 1, -3, 6, "corridor", "К1 Эт.5 Зап. коридор");
        g.addNode("b1_f5_sc_0.0", 5, 1, 0, 6, "corridor", "К1 Эт.5 Юж. коридор");
        g.addNode("b1_f5_sc_1.8", 5, 1, 1.8, 6, "corridor", "К1 Эт.5 Юж. коридор");
        g.addNode("b1_f5_sc_3.5", 5, 1, 3.5, 6, "corridor", "К1 Эт.5 Юж. коридор");
        g.addNode("b1_f5_sc_5.6", 5, 1, 5.6, 6, "corridor", "К1 Эт.5 Юж. коридор");
        g.addNode("b1_f5_sc_9.4", 5, 1, 9.4, 6, "corridor", "К1 Эт.5 Юж. коридор");
        g.addNode("b1_f5_sc_10.5", 5, 1, 10.5, 6, "corridor", "К1 Эт.5 Юж. коридор");
        g.addNode("b1_f5_stair_lk1", 5, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.5)");
        g.addNode("b1_f5_stair_lk2", 5, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.5)");
        g.addNode("b1_f5_elev", 5, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.5)");
        g.addNode("b1_f6_nc_-6.0", 6, 1, -6, -5, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_nc_door_-5.8", 6, 1, -5.8, -5, "door", "К1 Эт.6 Дверь север");
        g.addNode("b1_f6_nc_-3.0", 6, 1, -3, -5.8, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_nc_0.0", 6, 1, 0, -5.8, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_nc_3.0", 6, 1, 3, -5.8, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_nc_5.9", 6, 1, 5.9, -5.8, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_nc_9.4", 6, 1, 9.4, -5.8, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_nc_12.5", 6, 1, 12.5, -5.8, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_nc_16.0", 6, 1, 15.6, -5.8, "corridor", "К1 Эт.6 Сев. коридор");
        g.addNode("b1_f6_wc_-3.0", 6, 1, -3, -3, "corridor", "К1 Эт.6 Зап. коридор");
        g.addNode("b1_f6_wc_0.0", 6, 1, -3, 0, "corridor", "К1 Эт.6 Зап. коридор");
        g.addNode("b1_f6_wc_1.7", 6, 1, -3, 1.7, "corridor", "К1 Эт.6 Зап. коридор");
        g.addNode("b1_f6_wc_3.5", 6, 1, -3, 3.5, "corridor", "К1 Эт.6 Зап. коридор");
        g.addNode("b1_f6_wc_6.0", 6, 1, -3, 6, "corridor", "К1 Эт.6 Зап. коридор");
        g.addNode("b1_f6_sc_0.0", 6, 1, 0, 6, "corridor", "К1 Эт.6 Юж. коридор");
        g.addNode("b1_f6_sc_1.8", 6, 1, 1.8, 6, "corridor", "К1 Эт.6 Юж. коридор");
        g.addNode("b1_f6_sc_3.5", 6, 1, 3.5, 6, "corridor", "К1 Эт.6 Юж. коридор");
        g.addNode("b1_f6_sc_5.6", 6, 1, 5.6, 6, "corridor", "К1 Эт.6 Юж. коридор");
        g.addNode("b1_f6_sc_9.4", 6, 1, 9.4, 6, "corridor", "К1 Эт.6 Юж. коридор");
        g.addNode("b1_f6_sc_10.5", 6, 1, 10.5, 6, "corridor", "К1 Эт.6 Юж. коридор");
        g.addNode("b1_f6_stair_lk1", 6, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.6)");
        g.addNode("b1_f6_stair_lk2", 6, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.6)");
        g.addNode("b1_f6_elev", 6, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.6)");
        g.addNode("b1_f7_nc_-6.0", 7, 1, -6, -5, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_door_-5.8", 7, 1, -5.8, -5, "door", "К1 Эт.7 Дверь север");
        g.addNode("b1_f7_nc_-3.0", 7, 1, -3, -5.8, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_0.0", 7, 1, 0, -5.8, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_3.0", 7, 1, 3, -5.8, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_5.9", 7, 1, 5.9, -5.8, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_9.4", 7, 1, 9.4, -5.8, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_12.5", 7, 1, 12.5, -5.8, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_nc_16.0", 7, 1, 15.6, -5.8, "corridor", "К1 Эт.7 Сев. коридор");
        g.addNode("b1_f7_wc_-3.0", 7, 1, -3, -3, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_wc_0.0", 7, 1, -3, 0, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_wc_1.7", 7, 1, -3, 1.7, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_wc_3.5", 7, 1, -3, 3.5, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_wc_6.0", 7, 1, -3, 6, "corridor", "К1 Эт.7 Зап. коридор");
        g.addNode("b1_f7_sc_0.0", 7, 1, 0, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_1.8", 7, 1, 1.8, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_3.5", 7, 1, 3.5, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_5.6", 7, 1, 5.6, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_9.4", 7, 1, 9.4, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_sc_10.5", 7, 1, 10.5, 6, "corridor", "К1 Эт.7 Юж. коридор");
        g.addNode("b1_f7_stair_lk1", 7, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.7)");
        g.addNode("b1_f7_stair_lk2", 7, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.7)");
        g.addNode("b1_f7_elev", 7, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.7)");
        g.addNode("room_1_5_56", 5, 1, 6.2, -2.8, "room", "С/У (М)");
        g.addNode("door_mid_room_1_5_56", 5, 1, 5.4, -4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_5_56", 5, 1, 5.4, -3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_5_56", 5, 1, 5.4, -4.4, "door", "Коридор С/У");
        g.addNode("room_1_5_57", 5, 1, 5.6, 1.3, "room", "С/У (Ж)");
        g.addNode("door_mid_room_1_5_57", 5, 1, 5.5, 4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_5_57", 5, 1, 5.5, 3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_5_57", 5, 1, 5.5, 4.4, "door", "Коридор С/У");
        g.addNode("room_1_5_58", 5, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("door_mid_room_1_5_58", 5, 1, 9.4, -3.8, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_1_5_58", 5, 1, 9.4, -3.4, "door", "Вход ЛК№1");
        g.addNode("door_corr_room_1_5_58", 5, 1, 9.4, -4.2, "door", "Коридор ЛК№1");
        g.addNode("room_1_5_59", 5, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("door_mid_room_1_5_59", 5, 1, 9.4, 3.8, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_1_5_59", 5, 1, 9.4, 3.4, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_1_5_59", 5, 1, 9.4, 4.2, "door", "Коридор ЛК№2");
        g.addNode("room_1_5_60", 5, 1, 1.8, 1.5, "room", "Лифтовой холл");
        g.addNode("door_mid_room_1_5_60", 5, 1, -1.2, 1.7, "door", "Дверь Лифтовой холл");
        g.addNode("door_room_room_1_5_60", 5, 1, -0.8, 1.7, "door", "Вход Лифтовой холл");
        g.addNode("door_corr_room_1_5_60", 5, 1, -1.6, 1.7, "door", "Коридор Лифтовой холл");
        g.addNode("room_1_5_61", 5, 1, -4.2, -10.2, "room", "503");
        g.addNode("door_mid_room_1_5_61", 5, 1, -0.4, -6.2, "door", "Дверь 503");
        g.addNode("door_room_room_1_5_61", 5, 1, -0.4, -6.6, "door", "Вход 503");
        g.addNode("door_corr_room_1_5_61", 5, 1, -0.4, -5.8, "door", "Коридор 503");
        g.addNode("room_1_5_62", 5, 1, 3.5, -11.4, "room", "503А");
        g.addNode("door_mid_room_1_5_62", 5, 1, 3.5, -8.6, "door", "Дверь 503А");
        g.addNode("door_room_room_1_5_62", 5, 1, 3.5, -9, "door", "Вход 503А");
        g.addNode("door_corr_room_1_5_62", 5, 1, 3.5, -8.2, "door", "Коридор 503А");
        g.addNode("room_1_5_63", 5, 1, 10.6, -10.2, "room", "504");
        g.addNode("door_mid_room_1_5_63", 5, 1, 7.9, -6.2, "door", "Дверь 504");
        g.addNode("door_room_room_1_5_63", 5, 1, 7.9, -6.6, "door", "Вход 504");
        g.addNode("door_corr_room_1_5_63", 5, 1, 7.9, -5.8, "door", "Коридор 504");
        g.addNode("room_1_5_64", 5, 1, -9.9, -2, "room", "502А");
        g.addNode("door_mid_room_1_5_64", 5, 1, -5.8, -1.6, "door", "Дверь 502А");
        g.addNode("door_room_room_1_5_64", 5, 1, -6.2, -1.6, "door", "Вход 502А");
        g.addNode("door_corr_room_1_5_64", 5, 1, -5.4, -1.6, "door", "Коридор 502А");
        g.addNode("room_1_5_65", 5, 1, -9.9, 7, "room", "502");
        g.addNode("door_mid_room_1_5_65", 5, 1, -5.8, 2.8, "door", "Дверь 502");
        g.addNode("door_room_room_1_5_65", 5, 1, -6.2, 2.8, "door", "Вход 502");
        g.addNode("door_corr_room_1_5_65", 5, 1, -5.4, 2.8, "door", "Коридор 502");
        g.addNode("room_1_5_66", 5, 1, -4, 10.8, "room", "501А");
        g.addNode("door_mid_room_1_5_66", 5, 1, -4, 7.2, "door", "Дверь 501А");
        g.addNode("door_room_room_1_5_66", 5, 1, -4, 7.6, "door", "Вход 501А");
        g.addNode("door_corr_room_1_5_66", 5, 1, -4, 6.8, "door", "Коридор 501А");
        g.addNode("room_1_5_67", 5, 1, 5.2, 10.8, "room", "501");
        g.addNode("door_mid_room_1_5_67", 5, 1, -0.4, 7.2, "door", "Дверь 501");
        g.addNode("door_room_room_1_5_67", 5, 1, -0.4, 7.6, "door", "Вход 501");
        g.addNode("door_corr_room_1_5_67", 5, 1, -0.4, 6.8, "door", "Коридор 501");
        g.addNode("room_1_6_68", 6, 1, 6.2, -2.8, "room", "С/У (М)");
        g.addNode("door_mid_room_1_6_68", 6, 1, 5.4, -4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_6_68", 6, 1, 5.4, -3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_6_68", 6, 1, 5.4, -4.4, "door", "Коридор С/У");
        g.addNode("room_1_6_69", 6, 1, 5.6, 1.3, "room", "С/У (Ж)");
        g.addNode("door_mid_room_1_6_69", 6, 1, 5.5, 4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_6_69", 6, 1, 5.5, 3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_6_69", 6, 1, 5.5, 4.4, "door", "Коридор С/У");
        g.addNode("room_1_6_70", 6, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("door_mid_room_1_6_70", 6, 1, 9.4, -3.8, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_1_6_70", 6, 1, 9.4, -3.4, "door", "Вход ЛК№1");
        g.addNode("door_corr_room_1_6_70", 6, 1, 9.4, -4.2, "door", "Коридор ЛК№1");
        g.addNode("room_1_6_71", 6, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("door_mid_room_1_6_71", 6, 1, 9.4, 3.8, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_1_6_71", 6, 1, 9.4, 3.4, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_1_6_71", 6, 1, 9.4, 4.2, "door", "Коридор ЛК№2");
        g.addNode("room_1_6_72", 6, 1, 1.8, 1.5, "room", "Лифтовой холл");
        g.addNode("door_mid_room_1_6_72", 6, 1, -1.2, 1.7, "door", "Дверь Лифтовой холл");
        g.addNode("door_room_room_1_6_72", 6, 1, -0.8, 1.7, "door", "Вход Лифтовой холл");
        g.addNode("door_corr_room_1_6_72", 6, 1, -1.6, 1.7, "door", "Коридор Лифтовой холл");
        g.addNode("room_1_6_73", 6, 1, -4.2, -10.2, "room", "604");
        g.addNode("door_mid_room_1_6_73", 6, 1, -0.4, -6.2, "door", "Дверь 604");
        g.addNode("door_room_room_1_6_73", 6, 1, -0.4, -6.6, "door", "Вход 604");
        g.addNode("door_corr_room_1_6_73", 6, 1, -0.4, -5.8, "door", "Коридор 604");
        g.addNode("room_1_6_74", 6, 1, 3.5, -11.4, "room", "604А");
        g.addNode("door_mid_room_1_6_74", 6, 1, 3.5, -8.6, "door", "Дверь 604А");
        g.addNode("door_room_room_1_6_74", 6, 1, 3.5, -9, "door", "Вход 604А");
        g.addNode("door_corr_room_1_6_74", 6, 1, 3.5, -8.2, "door", "Коридор 604А");
        g.addNode("room_1_6_75", 6, 1, 10.6, -10.2, "room", "605");
        g.addNode("door_mid_room_1_6_75", 6, 1, 7.9, -6.2, "door", "Дверь 605");
        g.addNode("door_room_room_1_6_75", 6, 1, 7.9, -6.6, "door", "Вход 605");
        g.addNode("door_corr_room_1_6_75", 6, 1, 7.9, -5.8, "door", "Коридор 605");
        g.addNode("room_1_6_76", 6, 1, -9.9, -2, "room", "603А");
        g.addNode("door_mid_room_1_6_76", 6, 1, -5.8, -1.6, "door", "Дверь 603А");
        g.addNode("door_room_room_1_6_76", 6, 1, -6.2, -1.6, "door", "Вход 603А");
        g.addNode("door_corr_room_1_6_76", 6, 1, -5.4, -1.6, "door", "Коридор 603А");
        g.addNode("room_1_6_77", 6, 1, -9.9, 7, "room", "603");
        g.addNode("door_mid_room_1_6_77", 6, 1, -5.8, 2.8, "door", "Дверь 603");
        g.addNode("door_room_room_1_6_77", 6, 1, -6.2, 2.8, "door", "Вход 603");
        g.addNode("door_corr_room_1_6_77", 6, 1, -5.4, 2.8, "door", "Коридор 603");
        g.addNode("room_1_6_78", 6, 1, -4, 10.8, "room", "602А");
        g.addNode("door_mid_room_1_6_78", 6, 1, -4, 7.2, "door", "Дверь 602А");
        g.addNode("door_room_room_1_6_78", 6, 1, -4, 7.6, "door", "Вход 602А");
        g.addNode("door_corr_room_1_6_78", 6, 1, -4, 6.8, "door", "Коридор 602А");
        g.addNode("room_1_6_79", 6, 1, 3.2, 10.8, "room", "602");
        g.addNode("door_mid_room_1_6_79", 6, 1, -0.4, 7.2, "door", "Дверь 602");
        g.addNode("door_room_room_1_6_79", 6, 1, -0.4, 7.6, "door", "Вход 602");
        g.addNode("door_corr_room_1_6_79", 6, 1, -0.4, 6.8, "door", "Коридор 602");
        g.addNode("room_1_6_80", 6, 1, 10.5, 10.8, "room", "601");
        g.addNode("door_mid_room_1_6_80", 6, 1, 9.8, 7.2, "door", "Дверь 601");
        g.addNode("door_room_room_1_6_80", 6, 1, 9.8, 7.6, "door", "Вход 601");
        g.addNode("door_corr_room_1_6_80", 6, 1, 9.8, 6.8, "door", "Коридор 601");
        g.addNode("room_1_7_81", 7, 1, 6.2, -2.8, "room", "С/У (М)");
        g.addNode("door_mid_room_1_7_81", 7, 1, 5.4, -4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_7_81", 7, 1, 5.4, -3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_7_81", 7, 1, 5.4, -4.4, "door", "Коридор С/У");
        g.addNode("room_1_7_82", 7, 1, 5.6, 1.3, "room", "С/У (Ж)");
        g.addNode("door_mid_room_1_7_82", 7, 1, 5.5, 4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_7_82", 7, 1, 5.5, 3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_7_82", 7, 1, 5.5, 4.4, "door", "Коридор С/У");
        g.addNode("room_1_7_83", 7, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("door_mid_room_1_7_83", 7, 1, 9.4, -3.8, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_1_7_83", 7, 1, 9.4, -3.4, "door", "Вход ЛК№1");
        g.addNode("door_corr_room_1_7_83", 7, 1, 9.4, -4.2, "door", "Коридор ЛК№1");
        g.addNode("room_1_7_84", 7, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("door_mid_room_1_7_84", 7, 1, 9.4, 3.8, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_1_7_84", 7, 1, 9.4, 3.4, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_1_7_84", 7, 1, 9.4, 4.2, "door", "Коридор ЛК№2");
        g.addNode("room_1_7_85", 7, 1, 1.8, 1.5, "room", "Лифтовой холл");
        g.addNode("door_mid_room_1_7_85", 7, 1, -1.2, 1.7, "door", "Дверь Лифтовой холл");
        g.addNode("door_room_room_1_7_85", 7, 1, -0.8, 1.7, "door", "Вход Лифтовой холл");
        g.addNode("door_corr_room_1_7_85", 7, 1, -1.6, 1.7, "door", "Коридор Лифтовой холл");
        g.addNode("room_1_7_86", 7, 1, -6.2, -10.2, "room", "703");
        g.addNode("door_mid_room_1_7_86", 7, 1, -2.6, -6.2, "door", "Дверь 703");
        g.addNode("door_room_room_1_7_86", 7, 1, -2.6, -6.6, "door", "Вход 703");
        g.addNode("door_corr_room_1_7_86", 7, 1, -2.6, -5.8, "door", "Коридор 703");
        g.addNode("room_1_7_87", 7, 1, -0.3, -11.4, "room", "703А");
        g.addNode("door_mid_room_1_7_87", 7, 1, -0.3, -8.8, "door", "Дверь 703А");
        g.addNode("door_room_room_1_7_87", 7, 1, -0.3, -9.2, "door", "Вход 703А");
        g.addNode("door_corr_room_1_7_87", 7, 1, -0.3, -8.4, "door", "Коридор 703А");
        g.addNode("room_1_7_88", 7, 1, 10.6, -10.2, "room", "704");
        g.addNode("door_mid_room_1_7_88", 7, 1, 7.9, -6.2, "door", "Дверь 704");
        g.addNode("door_room_room_1_7_88", 7, 1, 7.9, -6.6, "door", "Вход 704");
        g.addNode("door_corr_room_1_7_88", 7, 1, 7.9, -5.8, "door", "Коридор 704");
        g.addNode("room_1_7_89", 7, 1, -9.9, -1.8, "room", "702А");
        g.addNode("door_mid_room_1_7_89", 7, 1, -5.8, -1.6, "door", "Дверь 702А");
        g.addNode("door_room_room_1_7_89", 7, 1, -6.2, -1.6, "door", "Вход 702А");
        g.addNode("door_corr_room_1_7_89", 7, 1, -5.4, -1.6, "door", "Коридор 702А");
        g.addNode("room_1_7_90", 7, 1, -9.9, 7.2, "room", "702");
        g.addNode("door_mid_room_1_7_90", 7, 1, -5.8, 3.2, "door", "Дверь 702");
        g.addNode("door_room_room_1_7_90", 7, 1, -6.2, 3.2, "door", "Вход 702");
        g.addNode("door_corr_room_1_7_90", 7, 1, -5.4, 3.2, "door", "Коридор 702");
        g.addNode("room_1_7_91", 7, 1, -3.7, 10.8, "room", "701А");
        g.addNode("door_mid_room_1_7_91", 7, 1, -4, 7.2, "door", "Дверь 701А");
        g.addNode("door_room_room_1_7_91", 7, 1, -4, 7.6, "door", "Вход 701А");
        g.addNode("door_corr_room_1_7_91", 7, 1, -4, 6.8, "door", "Коридор 701А");
        g.addNode("room_1_7_92", 7, 1, 3.5, 10.8, "room", "701");
        g.addNode("door_mid_room_1_7_92", 7, 1, 0.4, 7.2, "door", "Дверь 701");
        g.addNode("door_room_room_1_7_92", 7, 1, 0.4, 7.6, "door", "Вход 701");
        g.addNode("door_corr_room_1_7_92", 7, 1, 0.4, 6.8, "door", "Коридор 701");
        g.addNode("b1_f3_nc_-3.0", 3, 1, -3, -5.8, "corridor", "К1 Эт.3 Сев. коридор");
        g.addNode("b1_f3_nc_0.0", 3, 1, 0, -5.8, "corridor", "К1 Эт.3 Сев. коридор");
        g.addNode("b1_f3_nc_3.0", 3, 1, 3, -5.8, "corridor", "К1 Эт.3 Сев. коридор");
        g.addNode("b1_f3_nc_5.9", 3, 1, 5.9, -5.8, "corridor", "К1 Эт.3 Сев. коридор");
        g.addNode("b1_f3_nc_9.4", 3, 1, 9.4, -5.8, "corridor", "К1 Эт.3 Сев. коридор");
        g.addNode("b1_f3_nc_12.5", 3, 1, 12.5, -5.8, "corridor", "К1 Эт.3 Сев. коридор");
        g.addNode("b1_f3_nc_16.0", 3, 1, 15.6, -5.8, "corridor", "К1 Эт.3 Сев. коридор");
        g.addNode("b1_f3_wc_-3.0", 3, 1, -3, -3, "corridor", "К1 Эт.3 Зап. коридор");
        g.addNode("b1_f3_wc_0.0", 3, 1, -3, 0, "corridor", "К1 Эт.3 Зап. коридор");
        g.addNode("b1_f3_wc_1.7", 3, 1, -3, 1.7, "corridor", "К1 Эт.3 Зап. коридор");
        g.addNode("b1_f3_wc_3.5", 3, 1, -3, 3.5, "corridor", "К1 Эт.3 Зап. коридор");
        g.addNode("b1_f3_wc_6.0", 3, 1, -3, 6, "corridor", "К1 Эт.3 Зап. коридор");
        g.addNode("b1_f3_sc_0.0", 3, 1, 0, 6, "corridor", "К1 Эт.3 Юж. коридор");
        g.addNode("b1_f3_sc_1.8", 3, 1, 1.8, 6, "corridor", "К1 Эт.3 Юж. коридор");
        g.addNode("b1_f3_sc_3.5", 3, 1, 3.5, 6, "corridor", "К1 Эт.3 Юж. коридор");
        g.addNode("b1_f3_sc_5.6", 3, 1, 5.6, 6, "corridor", "К1 Эт.3 Юж. коридор");
        g.addNode("b1_f3_sc_9.4", 3, 1, 9.4, 6, "corridor", "К1 Эт.3 Юж. коридор");
        g.addNode("b1_f3_sc_10.5", 3, 1, 10.5, 6, "corridor", "К1 Эт.3 Юж. коридор");
        g.addNode("b1_f3_stair_lk1", 3, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.3)");
        g.addNode("b1_f3_stair_lk2", 3, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.3)");
        g.addNode("b1_f3_elev", 3, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.3)");
        g.addNode("b2_f3_c_22.6", 3, 2, 24.4, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_d_308", 3, 2, 24.4, -5, "door", "К2 Эт.3 Дверь 308");
        g.addNode("b2_f3_c_308_hall", 3, 2, 24.4, -3.8, "corridor", "К2 Эт.3 Зал 308");
        g.addNode("b2_f3_c_26.0", 3, 2, 26, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_30.0", 3, 2, 30, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_34.0", 3, 2, 34, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_37.5", 3, 2, 37.5, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_41.0", 3, 2, 41, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_43.6", 3, 2, 43.6, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_47.0", 3, 2, 47, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_51.0", 3, 2, 51, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_55.0", 3, 2, 55, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_59.0", 3, 2, 59, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_63.0", 3, 2, 63, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_c_66.1", 3, 2, 66.1, -5.8, "corridor", "К2 Эт.3 Коридор");
        g.addNode("b2_f3_stair_lk1", 3, 2, 66.1, -10.5, "stair", "К2 ЛК№1 (Эт.3)");
        g.addNode("b2_f3_stair_lk2", 3, 2, 42.7, -10.5, "stair", "К2 ЛК№2 (Эт.3)");
        g.addNode("room_1_3_31", 3, 1, 6.2, -2.8, "room", "С/У (М)");
        g.addNode("door_mid_room_1_3_31", 3, 1, 5.4, -4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_3_31", 3, 1, 5.4, -3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_3_31", 3, 1, 5.4, -4.4, "door", "Коридор С/У");
        g.addNode("room_1_3_32", 3, 1, 5.6, 1.3, "room", "С/У (Ж)");
        g.addNode("door_mid_room_1_3_32", 3, 1, 5.5, 4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_3_32", 3, 1, 5.5, 3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_3_32", 3, 1, 5.5, 4.4, "door", "Коридор С/У");
        g.addNode("room_1_3_33", 3, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("door_mid_room_1_3_33", 3, 1, 9.4, -3.8, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_1_3_33", 3, 1, 9.4, -3.4, "door", "Вход ЛК№1");
        g.addNode("room_1_3_34", 3, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("door_mid_room_1_3_34", 3, 1, 9.4, 3.8, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_1_3_34", 3, 1, 9.4, 3.4, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_1_3_34", 3, 1, 9.4, 4.2, "door", "Коридор ЛК№2");
        g.addNode("room_1_3_35", 3, 1, 1.8, 1.5, "room", "Лифтовой холл");
        g.addNode("door_mid_room_1_3_35", 3, 1, -1.2, 1.7, "door", "Дверь Лифтовой холл");
        g.addNode("door_room_room_1_3_35", 3, 1, -0.8, 1.7, "door", "Вход Лифтовой холл");
        g.addNode("door_corr_room_1_3_35", 3, 1, -1.6, 1.7, "door", "Коридор Лифтовой холл");
        g.addNode("room_1_3_36", 3, 1, -4.2, -10.2, "room", "303");
        g.addNode("door_mid_room_1_3_36", 3, 1, -0.4, -6.2, "door", "Дверь 303");
        g.addNode("door_room_room_1_3_36", 3, 1, -0.4, -6.6, "door", "Вход 303");
        g.addNode("door_corr_room_1_3_36", 3, 1, -0.4, -5.8, "door", "Коридор 303");
        g.addNode("room_1_3_37", 3, 1, 3.5, -11.4, "room", "303А");
        g.addNode("door_mid_room_1_3_37", 3, 1, 3.5, -8.6, "door", "Дверь 303А");
        g.addNode("door_room_room_1_3_37", 3, 1, 3.5, -9, "door", "Вход 303А");
        g.addNode("door_corr_room_1_3_37", 3, 1, 3.5, -8.2, "door", "Коридор 303А");
        g.addNode("room_1_3_38", 3, 1, 10.6, -10.2, "room", "304");
        g.addNode("door_mid_room_1_3_38", 3, 1, 7.9, -6.2, "door", "Дверь 304");
        g.addNode("door_corr_room_1_3_39", 3, 1, 15.6, -5, "door", "Коридор 305");
        g.addNode("door_mid_room_1_3_39", 3, 1, 16, -5, "door", "Дверь 305");
        g.addNode("door_room_room_1_3_39", 3, 1, 16.4, -5, "door", "Вход 305");
        g.addNode("room_1_3_39", 3, 1, 18.2, -5.8, "room", "305");
        g.addNode("room_1_3_40", 3, 1, -9.9, -2, "room", "302А");
        g.addNode("door_mid_room_1_3_40", 3, 1, -5.8, -1.6, "door", "Дверь 302А");
        g.addNode("door_room_room_1_3_40", 3, 1, -6.2, -1.6, "door", "Вход 302А");
        g.addNode("door_corr_room_1_3_40", 3, 1, -5.4, -1.6, "door", "Коридор 302А");
        g.addNode("room_1_3_41", 3, 1, -9.9, 7, "room", "302");
        g.addNode("door_mid_room_1_3_41", 3, 1, -5.8, 2.8, "door", "Дверь 302");
        g.addNode("door_room_room_1_3_41", 3, 1, -6.2, 2.8, "door", "Вход 302");
        g.addNode("door_corr_room_1_3_41", 3, 1, -5.4, 2.8, "door", "Коридор 302");
        g.addNode("room_1_3_42", 3, 1, -4, 10.8, "room", "301А");
        g.addNode("door_mid_room_1_3_42", 3, 1, -4, 7.2, "door", "Дверь 301А");
        g.addNode("door_room_room_1_3_42", 3, 1, -4, 7.6, "door", "Вход 301А");
        g.addNode("door_corr_room_1_3_42", 3, 1, -4, 6.8, "door", "Коридор 301А");
        g.addNode("room_1_3_43", 3, 1, 5.2, 10.8, "room", "301");
        g.addNode("door_mid_room_1_3_43", 3, 1, -0.4, 7.2, "door", "Дверь 301");
        g.addNode("door_room_room_1_3_43", 3, 1, -0.4, 7.6, "door", "Вход 301");
        g.addNode("door_corr_room_1_3_43", 3, 1, -0.4, 6.8, "door", "Коридор 301");
        g.addNode("room_2_3_123", 3, 2, 21.8, -9.2, "room", "302");
        g.addNode("door_mid_room_2_3_123", 3, 2, 21.8, -4.4, "door", "Дверь 302");
        g.addNode("door_room_room_2_3_123", 3, 2, 21.8, -4.8, "door", "Вход 302");
        g.addNode("door_corr_room_2_3_123", 3, 2, 21.8, -3.8, "door", "Коридор 302");
        g.addNode("room_2_3_124", 3, 2, 27.3, -10.5, "room", "304");
        g.addNode("door_mid_room_2_3_124", 3, 2, 27.2, -7.2, "door", "Дверь 304");
        g.addNode("door_room_room_2_3_124", 3, 2, 27.2, -7.6, "door", "Вход 304");
        g.addNode("door_corr_room_2_3_124", 3, 2, 27.2, -6.8, "door", "Коридор 304");
        g.addNode("room_2_3_125", 3, 2, 30.6, -10.5, "room", "305");
        g.addNode("door_mid_room_2_3_125", 3, 2, 30.5, -7.2, "door", "Дверь 305");
        g.addNode("door_room_room_2_3_125", 3, 2, 30.5, -7.6, "door", "Вход 305");
        g.addNode("door_corr_room_2_3_125", 3, 2, 30.5, -6.8, "door", "Коридор 305");
        g.addNode("room_2_3_126", 3, 2, 33.9, -10.5, "room", "306");
        g.addNode("door_mid_room_2_3_126", 3, 2, 33.8, -7.2, "door", "Дверь 306");
        g.addNode("door_room_room_2_3_126", 3, 2, 33.8, -7.6, "door", "Вход 306");
        g.addNode("door_corr_room_2_3_126", 3, 2, 33.8, -6.8, "door", "Коридор 306");
        g.addNode("room_2_3_127", 3, 2, 37.1, -10.5, "room", "307");
        g.addNode("door_mid_room_2_3_127", 3, 2, 37.1, -7.2, "door", "Дверь 307");
        g.addNode("door_room_room_2_3_127", 3, 2, 37.1, -7.6, "door", "Вход 307");
        g.addNode("door_corr_room_2_3_127", 3, 2, 37.1, -6.8, "door", "Коридор 307");
        g.addNode("room_2_3_128", 3, 2, 39.5, -7.8, "room", "С/У (М)");
        g.addNode("door_mid_room_2_3_128", 3, 2, 39.6, -7.2, "door", "Дверь С/У");
        g.addNode("door_room_room_2_3_128", 3, 2, 39.6, -7.6, "door", "Вход С/У");
        g.addNode("door_corr_room_2_3_128", 3, 2, 39.6, -6.8, "door", "Коридор С/У");
        g.addNode("room_2_3_129", 3, 2, 41, -7.8, "room", "С/У (Ж)");
        g.addNode("door_mid_room_2_3_129", 3, 2, 41, -7.2, "door", "Дверь С/У");
        g.addNode("door_room_room_2_3_129", 3, 2, 41, -7.6, "door", "Вход С/У");
        g.addNode("door_corr_room_2_3_129", 3, 2, 41, -6.8, "door", "Коридор С/У");
        g.addNode("room_2_3_130", 3, 2, 44.5, -12.5, "room", "ЛК№2");
        g.addNode("door_mid_room_2_3_130", 3, 2, 44.5, -7.2, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_2_3_130", 3, 2, 44.5, -7.6, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_2_3_130", 3, 2, 44.5, -6.8, "door", "Коридор ЛК№2");
        g.addNode("room_2_3_131", 3, 2, 51.3, -10.5, "room", "313");
        g.addNode("door_mid_room_2_3_131", 3, 2, 51.7, -7.2, "door", "Дверь 313");
        g.addNode("door_room_room_2_3_131", 3, 2, 51.7, -7.6, "door", "Вход 313");
        g.addNode("door_corr_room_2_3_131", 3, 2, 51.7, -6.8, "door", "Коридор 313");
        g.addNode("room_2_3_132", 3, 2, 57.8, -10.5, "room", "314");
        g.addNode("door_mid_room_2_3_132", 3, 2, 57.1, -7.2, "door", "Дверь 314");
        g.addNode("door_room_room_2_3_132", 3, 2, 57.1, -7.6, "door", "Вход 314");
        g.addNode("door_corr_room_2_3_132", 3, 2, 57.1, -6.8, "door", "Коридор 314");
        g.addNode("room_2_3_133", 3, 2, 62.6, -10.5, "room", "315");
        g.addNode("door_mid_room_2_3_133", 3, 2, 62.5, -7.2, "door", "Дверь 315");
        g.addNode("door_room_room_2_3_133", 3, 2, 62.5, -7.6, "door", "Вход 315");
        g.addNode("door_corr_room_2_3_133", 3, 2, 62.5, -6.8, "door", "Коридор 315");
        g.addNode("room_2_3_134", 3, 2, 66, -12.5, "room", "ЛК№1");
        g.addNode("door_mid_room_2_3_134", 3, 2, 64.2, -5.8, "door", "Дверь ЛК№1");
        g.addNode("door_corr_room_2_3_134", 3, 2, 63.8, -5.8, "door", "Коридор ЛК№1");
        g.addNode("room_2_3_135", 3, 2, 31.1, -0.5, "room", "308 Спортивный зал");
        g.addNode("door_mid_room_2_3_135", 3, 2, 36.4, -4.4, "door", "Дверь 308");
        g.addNode("door_room_room_2_3_135", 3, 2, 36.4, -4, "door", "Вход 308");
        g.addNode("door_corr_room_2_3_135", 3, 2, 36.4, -4.8, "door", "Коридор 308");
        g.addNode("room_2_3_136", 3, 2, 48.2, -0.5, "room", "312 Конференц-зал");
        g.addNode("door_mid_room_2_3_136", 3, 2, 47.1, -4.4, "door", "Дверь 312");
        g.addNode("door_room_room_2_3_136", 3, 2, 47.1, -4, "door", "Вход 312");
        g.addNode("door_corr_room_2_3_136", 3, 2, 47.1, -4.8, "door", "Коридор 312");
        g.addNode("room_2_3_137", 3, 2, 59.4, -0.5, "room", "316");
        g.addNode("door_mid_room_2_3_137", 3, 2, 62.4, -4.4, "door", "Дверь 316");
        g.addNode("door_room_room_2_3_137", 3, 2, 62.4, -4, "door", "Вход 316");
        g.addNode("door_corr_room_2_3_137", 3, 2, 62.4, -4.8, "door", "Коридор 316");
        g.addNode("room_2_3_138", 3, 2, 65.1, -2.8, "room", "318");
        g.addNode("door_mid_room_2_3_138", 3, 2, 66, -2.6, "door", "Дверь 318");
        g.addNode("door_room_room_2_3_138", 3, 2, 65.6, -2.6, "door", "Вход 318");
        g.addNode("custom_b1_f3_c_36_-115_ux1", 3, 1, 3.6, -11.5, "corridor", "Коридор (3.6, -11.5)");
        g.addNode("custom_b1_f3_c_35_-74_vve", 3, 1, 3.5, -7.4, "corridor", "Коридор (3.5, -7.4)");
        g.addNode("custom_b1_f3_c_-5_-73_y4d", 3, 1, -0.5, -7.3, "corridor", "Коридор (-0.5, -7.3)");
        g.addNode("custom_b1_f3_d_79_-70_b05", 3, 1, 7.9, -7, "door", "Дверь (7.9, -7)");
        g.addNode("door_corr_room_1_3_38", 3, 1, 7.9, -5.8, "door", "Коридор 304");
        g.addNode("custom_b2_f3_c_670_-58_0u0", 3, 2, 67, -5.8, "corridor", "Коридор (67, -5.8)");
        g.addNode("custom_b2_f3_c_670_-26_1py", 3, 2, 67, -2.6, "corridor", "Коридор (67, -2.6)");
        g.addNode("custom_b1_f3_c_96_-47_h5d", 3, 1, 9.6, -4.7, "corridor", "Коридор (9.6, -4.7)");
        g.addNode("b1_f4_nc_-6.0", 4, 1, -6, -5, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_nc_door_-5.8", 4, 1, -5.8, -5, "door", "К1 Эт.4 Дверь север");
        g.addNode("b1_f4_nc_-3.0", 4, 1, -3, -5.8, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_nc_0.0", 4, 1, 0, -5.8, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_nc_3.0", 4, 1, 3, -5.8, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_nc_5.9", 4, 1, 5.9, -5.8, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_nc_9.4", 4, 1, 9.4, -5.8, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_nc_12.5", 4, 1, 12.5, -5.8, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_nc_16.0", 4, 1, 15.6, -5.8, "corridor", "К1 Эт.4 Сев. коридор");
        g.addNode("b1_f4_wc_-3.0", 4, 1, -3, -3, "corridor", "К1 Эт.4 Зап. коридор");
        g.addNode("b1_f4_wc_0.0", 4, 1, -3, 0, "corridor", "К1 Эт.4 Зап. коридор");
        g.addNode("b1_f4_wc_1.7", 4, 1, -3, 1.7, "corridor", "К1 Эт.4 Зап. коридор");
        g.addNode("b1_f4_wc_3.5", 4, 1, -3, 3.5, "corridor", "К1 Эт.4 Зап. коридор");
        g.addNode("b1_f4_wc_6.0", 4, 1, -3, 6, "corridor", "К1 Эт.4 Зап. коридор");
        g.addNode("b1_f4_sc_0.0", 4, 1, 0, 6, "corridor", "К1 Эт.4 Юж. коридор");
        g.addNode("b1_f4_sc_1.8", 4, 1, 1.8, 6, "corridor", "К1 Эт.4 Юж. коридор");
        g.addNode("b1_f4_sc_3.5", 4, 1, 3.5, 6, "corridor", "К1 Эт.4 Юж. коридор");
        g.addNode("b1_f4_sc_5.6", 4, 1, 5.6, 6, "corridor", "К1 Эт.4 Юж. коридор");
        g.addNode("b1_f4_sc_9.4", 4, 1, 9.4, 6, "corridor", "К1 Эт.4 Юж. коридор");
        g.addNode("b1_f4_sc_10.5", 4, 1, 10.5, 6, "corridor", "К1 Эт.4 Юж. коридор");
        g.addNode("b1_f4_stair_lk1", 4, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.4)");
        g.addNode("b1_f4_stair_lk2", 4, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.4)");
        g.addNode("b1_f4_elev", 4, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.4)");
        g.addNode("room_1_4_44", 4, 1, 6.2, -2.8, "room", "С/У (М)");
        g.addNode("door_mid_room_1_4_44", 4, 1, 5.4, -4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_4_44", 4, 1, 5.4, -3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_4_44", 4, 1, 5.4, -4.4, "door", "Коридор С/У");
        g.addNode("room_1_4_45", 4, 1, 5.6, 1.3, "room", "С/У (Ж)");
        g.addNode("door_mid_room_1_4_45", 4, 1, 5.5, 4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_4_45", 4, 1, 5.5, 3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_4_45", 4, 1, 5.5, 4.4, "door", "Коридор С/У");
        g.addNode("room_1_4_46", 4, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("door_mid_room_1_4_46", 4, 1, 9.4, -3.8, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_1_4_46", 4, 1, 9.4, -3.4, "door", "Вход ЛК№1");
        g.addNode("door_corr_room_1_4_46", 4, 1, 9.4, -4.2, "door", "Коридор ЛК№1");
        g.addNode("room_1_4_47", 4, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("door_mid_room_1_4_47", 4, 1, 9.4, 3.8, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_1_4_47", 4, 1, 9.4, 3.4, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_1_4_47", 4, 1, 9.4, 4.2, "door", "Коридор ЛК№2");
        g.addNode("room_1_4_48", 4, 1, 1.8, 1.5, "room", "Лифтовой холл");
        g.addNode("door_mid_room_1_4_48", 4, 1, -1.2, 1.7, "door", "Дверь Лифтовой холл");
        g.addNode("door_room_room_1_4_48", 4, 1, -0.8, 1.7, "door", "Вход Лифтовой холл");
        g.addNode("door_corr_room_1_4_48", 4, 1, -1.6, 1.7, "door", "Коридор Лифтовой холл");
        g.addNode("room_1_4_49", 4, 1, -4.2, -10.2, "room", "403");
        g.addNode("door_mid_room_1_4_49", 4, 1, -0.4, -6.2, "door", "Дверь 403");
        g.addNode("door_room_room_1_4_49", 4, 1, -0.4, -6.6, "door", "Вход 403");
        g.addNode("door_corr_room_1_4_49", 4, 1, -0.4, -5.8, "door", "Коридор 403");
        g.addNode("room_1_4_50", 4, 1, 3.5, -11.4, "room", "403А");
        g.addNode("door_mid_room_1_4_50", 4, 1, 3.5, -8.6, "door", "Дверь 403А");
        g.addNode("door_room_room_1_4_50", 4, 1, 3.5, -9, "door", "Вход 403А");
        g.addNode("door_corr_room_1_4_50", 4, 1, 3.5, -8.2, "door", "Коридор 403А");
        g.addNode("door_mid_room_1_4_51", 4, 1, 7.9, -6.2, "door", "Дверь 404");
        g.addNode("door_corr_room_1_4_51", 4, 1, 7.9, -5.8, "door", "Коридор 404");
        g.addNode("room_1_4_52", 4, 1, -9.9, -2.3, "room", "402А");
        g.addNode("door_mid_room_1_4_52", 4, 1, -5.8, -2.2, "door", "Дверь 402А");
        g.addNode("door_room_room_1_4_52", 4, 1, -6.2, -2.2, "door", "Вход 402А");
        g.addNode("door_corr_room_1_4_52", 4, 1, -5.4, -2.2, "door", "Коридор 402А");
        g.addNode("room_1_4_53", 4, 1, -9.9, 1.3, "room", "401А");
        g.addNode("door_mid_room_1_4_53", 4, 1, -5.8, 1.4, "door", "Дверь 401А");
        g.addNode("door_room_room_1_4_53", 4, 1, -6.2, 1.4, "door", "Вход 401А");
        g.addNode("door_corr_room_1_4_53", 4, 1, -5.4, 1.4, "door", "Коридор 401А");
        g.addNode("room_1_4_54", 4, 1, -9.9, 8.5, "room", "402");
        g.addNode("door_mid_room_1_4_54", 4, 1, -5.8, 5.6, "door", "Дверь 402");
        g.addNode("door_room_room_1_4_54", 4, 1, -6.2, 5.6, "door", "Вход 402");
        g.addNode("door_corr_room_1_4_54", 4, 1, -5.4, 5.6, "door", "Коридор 402");
        g.addNode("room_1_4_55", 4, 1, 3.4, 10.6, "room", "401");
        g.addNode("door_mid_room_1_4_55", 4, 1, -4.4, 7.2, "door", "Дверь 401");
        g.addNode("door_room_room_1_4_55", 4, 1, -4.4, 7.6, "door", "Вход 401");
        g.addNode("door_corr_room_1_4_55", 4, 1, -4.4, 6.8, "door", "Коридор 401");
        g.addNode("custom_b1_f4_c_-4_-75_ptb", 4, 1, -0.4, -7.5, "corridor", "Коридор (-0.4, -7.5)");
        g.addNode("custom_b1_f4_c_33_-75_ydr", 4, 1, 3.3, -7.5, "corridor", "Коридор (3.3, -7.5)");
        g.addNode("custom_b1_f4_c_79_-75_z02", 4, 1, 7.9, -7.5, "corridor", "Коридор (7.9, -7.5)");
        g.addNode("room_1_4_51", 4, 1, 10.6, -10.2, "room", "404");
        g.addNode("custom_b1_f4_c_33_-111_dfg", 4, 1, 3.3, -11.1, "corridor", "Коридор (3.3, -11.1)");
        g.addNode("b1_f2_nc_-3.0", 2, 1, -3, -5.8, "corridor", "К1 Эт.2 Сев. коридор");
        g.addNode("b1_f2_nc_0.0", 2, 1, 0, -5.8, "corridor", "К1 Эт.2 Сев. коридор");
        g.addNode("b1_f2_nc_3.0", 2, 1, 3, -5.8, "corridor", "К1 Эт.2 Сев. коридор");
        g.addNode("b1_f2_wc_-3.0", 2, 1, -3, -3, "corridor", "К1 Эт.2 Зап. коридор");
        g.addNode("b1_f2_wc_0.0", 2, 1, -3, 0, "corridor", "К1 Эт.2 Зап. коридор");
        g.addNode("b1_f2_wc_1.7", 2, 1, -3, 1.7, "corridor", "К1 Эт.2 Зап. коридор");
        g.addNode("b1_f2_wc_3.5", 2, 1, -3, 3.5, "corridor", "К1 Эт.2 Зап. коридор");
        g.addNode("b1_f2_wc_6.0", 2, 1, -3, 6, "corridor", "К1 Эт.2 Зап. коридор");
        g.addNode("b1_f2_sc_0.0", 2, 1, 0, 6, "corridor", "К1 Эт.2 Юж. коридор");
        g.addNode("b1_f2_sc_1.8", 2, 1, 1.8, 6, "corridor", "К1 Эт.2 Юж. коридор");
        g.addNode("b1_f2_sc_3.5", 2, 1, 3.5, 6, "corridor", "К1 Эт.2 Юж. коридор");
        g.addNode("b1_f2_sc_5.6", 2, 1, 5.6, 6, "corridor", "К1 Эт.2 Юж. коридор");
        g.addNode("b1_f2_sc_9.4", 2, 1, 9.4, 6, "corridor", "К1 Эт.2 Юж. коридор");
        g.addNode("b1_f2_sc_10.5", 2, 1, 10.5, 6, "corridor", "К1 Эт.2 Юж. коридор");
        g.addNode("b1_f2_stair_lk1", 2, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.2)");
        g.addNode("b1_f2_stair_lk2", 2, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.2)");
        g.addNode("b1_f2_elev", 2, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.2)");
        g.addNode("b1_f2_room_206_corr_door", 2, 1, -5.8, 1.1, "door", "Дверь блока 206");
        g.addNode("b1_f2_room_206_ante", 2, 1, -7, 1.4, "corridor", "Предбанник 206");
        g.addNode("b1_f2_room_206_inner_door", 2, 1, -8.2, 1.5, "door", "Вход в каб. 206");
        g.addNode("b2_f2_c_20.4", 2, 2, 20.4, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_37.5", 2, 2, 37.5, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_43.6", 2, 2, 43.6, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_47.0", 2, 2, 47, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_51.0", 2, 2, 51, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_55.0", 2, 2, 55, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_59.0", 2, 2, 59, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_63.0", 2, 2, 63, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_c_66.1", 2, 2, 66.1, -5.8, "corridor", "К2 Эт.2 Коридор");
        g.addNode("b2_f2_stair_lk1", 2, 2, 66.1, -10.5, "stair", "К2 ЛК№1 (Эт.2)");
        g.addNode("b2_f2_stair_lk2", 2, 2, 42.7, -10.5, "stair", "К2 ЛК№2 (Эт.2)");
        g.addNode("b2_f2_stair_lk3", 2, 2, 22.6, -10.5, "stair", "К2 ЛК№3 (Эт.2)");
        g.addNode("b3_f2_c_-14.0", 2, 3, 5.9, -14, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-18.0", 2, 3, 5.9, -18, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-26.0", 2, 3, 5.9, -26, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-28.6", 2, 3, 5.9, -28.6, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-36.0", 2, 3, 5.9, -36, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-40.0", 2, 3, 5.9, -40, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-45.5", 2, 3, 5.9, -45.5, "corridor", "К3 Эт.2 Переход К4");
        g.addNode("b3_f2_c_-46.0", 2, 3, 5.9, -46, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-50.0", 2, 3, 5.9, -50, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_c_-55.0", 2, 3, 5.9, -55, "corridor", "К3 Эт.2 Коридор");
        g.addNode("b3_f2_stair_south", 2, 3, 4.1, -28.6, "stair", "К3 Южная ЛК (Эт.2)");
        g.addNode("b3_f2_stair_north", 2, 3, 4.1, -46, "stair", "К3 Северная ЛК (Эт.2)");
        g.addNode("bridge_k1_k3_f2", 2, 1, 5.9, -14, "bridge", "Переход К1 ↔ К3 (2 эт.)");
        g.addNode("room_1_2_12", 2, 1, 6.2, -2.8, "room", "С/У (М)");
        g.addNode("door_mid_room_1_2_12", 2, 1, 5.4, -4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_2_12", 2, 1, 5.4, -3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_2_12", 2, 1, 5.4, -4.4, "door", "Коридор С/У");
        g.addNode("room_1_2_13", 2, 1, 5.6, 1.3, "room", "С/У (Ж)");
        g.addNode("door_mid_room_1_2_13", 2, 1, 5.5, 4, "door", "Дверь С/У");
        g.addNode("door_room_room_1_2_13", 2, 1, 5.5, 3.6, "door", "Вход С/У");
        g.addNode("door_corr_room_1_2_13", 2, 1, 5.5, 4.4, "door", "Коридор С/У");
        g.addNode("room_1_2_14", 2, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("door_mid_room_1_2_14", 2, 1, 9.4, -3.8, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_1_2_14", 2, 1, 9.4, -3.4, "door", "Вход ЛК№1");
        g.addNode("room_1_2_15", 2, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("door_mid_room_1_2_15", 2, 1, 9.4, 3.8, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_1_2_15", 2, 1, 9.4, 3.4, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_1_2_15", 2, 1, 9.4, 4.2, "door", "Коридор ЛК№2");
        g.addNode("room_1_2_16", 2, 1, 1.8, 1.5, "room", "Лифтовой холл");
        g.addNode("room_1_2_17", 2, 1, -5.2, -10.2, "room", "208");
        g.addNode("room_1_2_18", 2, 1, 2.1, -12.7, "room", "210");
        g.addNode("door_mid_room_1_2_18", 2, 1, 4.6, -12.5, "door", "Дверь 210");
        g.addNode("door_room_room_1_2_18", 2, 1, 4.2, -12.5, "door", "Вход 210");
        g.addNode("door_corr_room_1_2_18", 2, 1, 5, -12.5, "door", "Коридор 210");
        g.addNode("door_mid_room_1_2_19", 2, 1, 4.6, -7.6, "door", "Дверь 209");
        g.addNode("door_room_room_1_2_19", 2, 1, 4.2, -7.6, "door", "Вход 209");
        g.addNode("door_corr_room_1_2_19", 2, 1, 5, -7.6, "door", "Коридор 209");
        g.addNode("room_1_2_19", 2, 1, 1.8, -10, "room", "209");
        g.addNode("room_1_2_20", 2, 1, 11.6, -11.7, "room", "211");
        g.addNode("door_mid_room_1_2_20", 2, 1, 7.2, -12.5, "door", "Дверь 211");
        g.addNode("door_room_room_1_2_20", 2, 1, 7.6, -12.5, "door", "Вход 211");
        g.addNode("door_corr_room_1_2_20", 2, 1, 6.8, -12.5, "door", "Коридор 211");
        g.addNode("room_1_2_21", 2, 1, 9.7, -7.8, "room", "212");
        g.addNode("door_corr_room_1_2_21", 2, 1, 5.9, -5.8, "door", "Коридор 212");
        g.addNode("room_1_2_22", 2, 1, 14.1, -7.8, "room", "213");
        g.addNode("door_mid_room_1_2_22", 2, 1, 13.6, -6.2, "door", "Дверь 213");
        g.addNode("door_room_room_1_2_22", 2, 1, 13.6, -6.6, "door", "Вход 213");
        g.addNode("door_corr_room_1_2_22", 2, 1, 13.6, -5.8, "door", "Коридор 213");
        g.addNode("door_mid_room_1_2_23", 2, 1, 9.4, -3.8, "door", "Дверь Переход в корпус №2");
        g.addNode("door_corr_room_1_2_23", 2, 1, 9.4, -3.4, "door", "Коридор Переход в корпус №2");
        g.addNode("door_mid_room_1_2_24", 2, 1, -5.8, -1.4, "door", "Дверь 207");
        g.addNode("door_room_room_1_2_24", 2, 1, -6.2, -1.4, "door", "Вход 207");
        g.addNode("door_corr_room_1_2_24", 2, 1, -5.4, -1.4, "door", "Коридор 207");
        g.addNode("room_1_2_24", 2, 1, -11.2, -2.2, "room", "207");
        g.addNode("room_1_2_25", 2, 1, -11.2, 1.4, "room", "206");
        g.addNode("room_1_2_26", 2, 1, -10.2, 5.2, "room", "204");
        g.addNode("door_room_room_1_2_26", 2, 1, -10.2, 3.6, "door", "Вход 204");
        g.addNode("room_1_2_27", 2, 1, -8, 12.2, "room", "205");
        g.addNode("door_mid_room_1_2_27", 2, 1, -5.8, 5.1, "door", "Дверь 205");
        g.addNode("door_room_room_1_2_27", 2, 1, -6.2, 5.1, "door", "Вход 205");
        g.addNode("door_corr_room_1_2_27", 2, 1, -5.4, 5.1, "door", "Коридор 205");
        g.addNode("room_1_2_28", 2, 1, -4.2, 11.5, "room", "203");
        g.addNode("door_mid_room_1_2_28", 2, 1, -4, 7.2, "door", "Дверь 203");
        g.addNode("door_room_room_1_2_28", 2, 1, -4, 7.6, "door", "Вход 203");
        g.addNode("door_corr_room_1_2_28", 2, 1, -4, 6.8, "door", "Коридор 203");
        g.addNode("door_mid_room_1_2_29", 2, 1, -1.4, 7.2, "door", "Дверь 202");
        g.addNode("door_room_room_1_2_29", 2, 1, -1.4, 7.6, "door", "Вход 202");
        g.addNode("door_corr_room_1_2_29", 2, 1, -1.4, 6.8, "door", "Коридор 202");
        g.addNode("room_1_2_29", 2, 1, -0.6, 11.8, "room", "202");
        g.addNode("room_1_2_30", 2, 1, 8.5, 11.5, "room", "201");
        g.addNode("door_mid_room_1_2_30", 2, 1, 9.8, 7.2, "door", "Дверь 201");
        g.addNode("door_room_room_1_2_30", 2, 1, 9.8, 7.6, "door", "Вход 201");
        g.addNode("door_corr_room_1_2_30", 2, 1, 9.8, 6.8, "door", "Коридор 201");
        g.addNode("door_corr_b1_f2_r201_west", 2, 1, 5.1, 6.8, "door", "Коридор 201 (зап.)");
        g.addNode("door_mid_b1_f2_r201_west", 2, 1, 5.1, 7.2, "door", "Дверь 201 (зап.)");
        g.addNode("door_room_b1_f2_r201_west", 2, 1, 5.1, 7.6, "door", "Вход 201 (зап.)");
        g.addNode("room_2_2_107", 2, 2, 24.9, -10.5, "room", "203");
        g.addNode("door_mid_room_2_2_107", 2, 2, 23.4, -8.8, "door", "Дверь 203");
        g.addNode("door_room_room_2_2_107", 2, 2, 23.8, -8.8, "door", "Вход 203");
        g.addNode("door_corr_room_2_2_107", 2, 2, 23, -8.8, "door", "Коридор 203");
        g.addNode("room_2_2_108", 2, 2, 31.3, -10.5, "room", "205");
        g.addNode("door_mid_room_2_2_108", 2, 2, 32.9, -7.2, "door", "Дверь 205");
        g.addNode("door_room_room_2_2_108", 2, 2, 32.9, -7.6, "door", "Вход 205");
        g.addNode("door_corr_room_2_2_108", 2, 2, 32.9, -6.8, "door", "Коридор 205");
        g.addNode("room_2_2_109", 2, 2, 39.5, -8.4, "room", "С/У (Ж)");
        g.addNode("door_mid_room_2_2_109", 2, 2, 39.6, -7.2, "door", "Дверь С/У");
        g.addNode("door_room_room_2_2_109", 2, 2, 39.6, -7.6, "door", "Вход С/У");
        g.addNode("door_corr_room_2_2_109", 2, 2, 39.6, -6.8, "door", "Коридор С/У");
        g.addNode("room_2_2_110", 2, 2, 41, -8.4, "room", "С/У");
        g.addNode("door_mid_room_2_2_110", 2, 2, 41, -7.2, "door", "Дверь С/У");
        g.addNode("door_room_room_2_2_110", 2, 2, 41, -7.6, "door", "Вход С/У");
        g.addNode("door_corr_room_2_2_110", 2, 2, 41, -6.8, "door", "Коридор С/У");
        g.addNode("room_2_2_111", 2, 2, 44.5, -12.5, "room", "ЛК№2");
        g.addNode("door_mid_room_2_2_111", 2, 2, 44.5, -7.2, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_2_2_111", 2, 2, 44.5, -7.6, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_2_2_111", 2, 2, 44.5, -6.8, "door", "Коридор ЛК№2");
        g.addNode("room_2_2_112", 2, 2, 46.9, -10.5, "room", "209 Учебная часть");
        g.addNode("door_mid_room_2_2_112", 2, 2, 46.9, -7.2, "door", "Дверь 209");
        g.addNode("door_room_room_2_2_112", 2, 2, 46.9, -7.6, "door", "Вход 209");
        g.addNode("door_corr_room_2_2_112", 2, 2, 46.9, -6.8, "door", "Коридор 209");
        g.addNode("room_2_2_113", 2, 2, 54.5, -10.5, "room", "211");
        g.addNode("door_mid_room_2_2_113", 2, 2, 58.5, -7.2, "door", "Дверь 211");
        g.addNode("door_room_room_2_2_113", 2, 2, 58.5, -7.6, "door", "Вход 211");
        g.addNode("door_corr_room_2_2_113", 2, 2, 58.5, -6.8, "door", "Коридор 211");
        g.addNode("room_2_2_114", 2, 2, 62.4, -8.4, "room", "213");
        g.addNode("door_mid_room_2_2_114", 2, 2, 62.4, -7.2, "door", "Дверь 213");
        g.addNode("door_room_room_2_2_114", 2, 2, 62.4, -7.6, "door", "Вход 213");
        g.addNode("door_corr_room_2_2_114", 2, 2, 62.4, -6.8, "door", "Коридор 213");
        g.addNode("room_2_2_115", 2, 2, 66, -12.5, "room", "ЛК№1");
        g.addNode("door_room_2_2_115", 2, 2, 66, -7.2, "door", "Дверь ЛК№1");
        g.addNode("room_2_2_116", 2, 2, 21.9, -0.5, "room", "202");
        g.addNode("door_mid_room_2_2_116", 2, 2, 21.9, -4.4, "door", "Дверь 202");
        g.addNode("door_room_room_2_2_116", 2, 2, 21.9, -4, "door", "Вход 202");
        g.addNode("door_corr_room_2_2_116", 2, 2, 21.9, -4.8, "door", "Коридор 202");
        g.addNode("room_2_2_117", 2, 2, 24.9, -0.5, "room", "204");
        g.addNode("door_mid_room_2_2_117", 2, 2, 24.9, -4.4, "door", "Дверь 204");
        g.addNode("door_room_room_2_2_117", 2, 2, 24.9, -4, "door", "Вход 204");
        g.addNode("door_corr_room_2_2_117", 2, 2, 24.9, -4.8, "door", "Коридор 204");
        g.addNode("room_2_2_118", 2, 2, 32.6, -0.5, "room", "206");
        g.addNode("door_mid_room_2_2_118", 2, 2, 28.1, -4.4, "door", "Дверь 206");
        g.addNode("door_room_room_2_2_118", 2, 2, 28.1, -4, "door", "Вход 206");
        g.addNode("door_corr_room_2_2_118", 2, 2, 28.1, -4.8, "door", "Коридор 206");
        g.addNode("room_2_2_119", 2, 2, 40.3, -0.5, "room", "208");
        g.addNode("door_mid_room_2_2_119", 2, 2, 40.2, -4.4, "door", "Дверь 208");
        g.addNode("door_room_room_2_2_119", 2, 2, 40.2, -4, "door", "Вход 208");
        g.addNode("door_corr_room_2_2_119", 2, 2, 40.2, -4.8, "door", "Коридор 208");
        g.addNode("room_2_2_120", 2, 2, 46.6, -0.5, "room", "210");
        g.addNode("door_mid_room_2_2_120", 2, 2, 46.4, -4.4, "door", "Дверь 210");
        g.addNode("door_room_room_2_2_120", 2, 2, 46.4, -4, "door", "Вход 210");
        g.addNode("door_corr_room_2_2_120", 2, 2, 46.4, -4.8, "door", "Коридор 210");
        g.addNode("room_2_2_121", 2, 2, 53, -0.5, "room", "212");
        g.addNode("door_mid_room_2_2_121", 2, 2, 49.9, -4.4, "door", "Дверь 212");
        g.addNode("door_room_room_2_2_121", 2, 2, 49.9, -4, "door", "Вход 212");
        g.addNode("door_corr_room_2_2_121", 2, 2, 49.9, -4.8, "door", "Коридор 212");
        g.addNode("room_2_2_122", 2, 2, 62.7, -0.5, "room", "214");
        g.addNode("door_mid_room_2_2_122", 2, 2, 62.5, -4.4, "door", "Дверь 214");
        g.addNode("door_room_room_2_2_122", 2, 2, 62.5, -4, "door", "Вход 214");
        g.addNode("door_corr_room_2_2_122", 2, 2, 62.5, -4.8, "door", "Коридор 214");
        g.addNode("room_3_2_161", 2, 3, 1.5, -19.8, "room", "201");
        g.addNode("door_mid_room_3_2_161", 2, 3, 4.6, -23, "door", "Дверь 201");
        g.addNode("door_room_room_3_2_161", 2, 3, 4.2, -23, "door", "Вход 201");
        g.addNode("door_corr_room_3_2_161", 2, 3, 5, -23, "door", "Коридор 201");
        g.addNode("room_3_2_162", 2, 3, 1.5, -25.6, "room", "201А");
        g.addNode("door_mid_room_3_2_162", 2, 3, 4.6, -25.6, "door", "Дверь 201А");
        g.addNode("door_room_room_3_2_162", 2, 3, 4.2, -25.6, "door", "Вход 201А");
        g.addNode("door_corr_room_3_2_162", 2, 3, 5, -25.6, "door", "Коридор 201А");
        g.addNode("room_3_2_163", 2, 3, 4.1, -28.6, "room", "ЛК№1");
        g.addNode("door_mid_room_3_2_163", 2, 3, 4.6, -28.6, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_3_2_163", 2, 3, 4.3, -28.6, "door", "Вход ЛК№1");
        g.addNode("door_corr_room_3_2_163", 2, 3, 4.9, -28.6, "door", "Коридор ЛК№1");
        g.addNode("room_3_2_164", 2, 3, 1.5, -36.1, "room", "205");
        g.addNode("door_mid_room_3_2_164", 2, 3, 4.6, -31.8, "door", "Дверь 205");
        g.addNode("door_room_room_3_2_164", 2, 3, 4.2, -31.8, "door", "Вход 205");
        g.addNode("door_corr_room_3_2_164", 2, 3, 5, -31.8, "door", "Коридор 205");
        g.addNode("room_3_2_165", 2, 3, 1.5, -43, "room", "205А");
        g.addNode("door_mid_room_3_2_165", 2, 3, 3.4, -41.8, "door", "Дверь 205А");
        g.addNode("door_room_room_3_2_165", 2, 3, 3.4, -42.2, "door", "Вход 205А");
        g.addNode("door_corr_room_3_2_165", 2, 3, 3.4, -41.4, "door", "Коридор 205А");
        g.addNode("room_3_2_166", 2, 3, 4.1, -46, "room", "ЛК№2");
        g.addNode("room_3_2_167", 2, 3, 1.5, -50, "room", "207");
        g.addNode("door_mid_room_3_2_167", 2, 3, 4.6, -50, "door", "Дверь 207");
        g.addNode("door_room_room_3_2_167", 2, 3, 4.2, -50, "door", "Вход 207");
        g.addNode("door_corr_room_3_2_167", 2, 3, 5, -50, "door", "Коридор 207");
        g.addNode("room_3_2_168", 2, 3, 1.4, -55.5, "room", "209");
        g.addNode("door_mid_room_3_2_168", 2, 3, 4.3, -53.2, "door", "Дверь 209");
        g.addNode("door_room_room_3_2_168", 2, 3, 3.9, -53.2, "door", "Вход 209");
        g.addNode("door_corr_room_3_2_168", 2, 3, 4.7, -53.2, "door", "Коридор 209");
        g.addNode("room_3_2_169", 2, 3, 1.4, -60.2, "room", "209А");
        g.addNode("door_room_room_3_2_169", 2, 3, 3.9, -59.8, "door", "Вход 209А");
        g.addNode("room_3_2_170", 2, 3, 10.6, -19.8, "room", "202");
        g.addNode("door_mid_room_3_2_170", 2, 3, 7.2, -23.2, "door", "Дверь 202");
        g.addNode("door_room_room_3_2_170", 2, 3, 7.6, -23.2, "door", "Вход 202");
        g.addNode("door_corr_room_3_2_170", 2, 3, 6.8, -23.2, "door", "Коридор 202");
        g.addNode("room_3_2_171", 2, 3, 10.6, -25.6, "room", "202А");
        g.addNode("door_mid_room_3_2_171", 2, 3, 7.2, -25.6, "door", "Дверь 202А");
        g.addNode("door_room_room_3_2_171", 2, 3, 7.6, -25.6, "door", "Вход 202А");
        g.addNode("door_corr_room_3_2_171", 2, 3, 6.8, -25.6, "door", "Коридор 202А");
        g.addNode("room_3_2_172", 2, 3, 10.6, -28, "room", "204");
        g.addNode("door_mid_room_3_2_172", 2, 3, 7.2, -28.2, "door", "Дверь 204");
        g.addNode("door_room_room_3_2_172", 2, 3, 7.6, -28.2, "door", "Вход 204");
        g.addNode("door_corr_room_3_2_172", 2, 3, 6.8, -28.2, "door", "Коридор 204");
        g.addNode("room_3_2_173", 2, 3, 10.6, -30.5, "room", "206");
        g.addNode("door_mid_room_3_2_173", 2, 3, 7.2, -30.6, "door", "Дверь 206");
        g.addNode("door_room_room_3_2_173", 2, 3, 7.6, -30.6, "door", "Вход 206");
        g.addNode("door_corr_room_3_2_173", 2, 3, 6.8, -30.6, "door", "Коридор 206");
        g.addNode("room_3_2_174", 2, 3, 10.6, -36.8, "room", "208");
        g.addNode("door_mid_room_3_2_174", 2, 3, 7.2, -40, "door", "Дверь 208");
        g.addNode("door_room_room_3_2_174", 2, 3, 7.6, -40, "door", "Вход 208");
        g.addNode("door_corr_room_3_2_174", 2, 3, 6.8, -40, "door", "Коридор 208");
        g.addNode("room_3_2_175", 2, 3, 10.6, -43, "room", "208А");
        g.addNode("door_mid_room_3_2_175", 2, 3, 8.4, -41.8, "door", "Дверь 208А");
        g.addNode("door_room_room_3_2_175", 2, 3, 8.4, -42.2, "door", "Вход 208А");
        g.addNode("room_3_2_176", 2, 3, 10.6, -49.1, "room", "210");
        g.addNode("door_mid_room_3_2_176", 2, 3, 7.2, -50, "door", "Дверь 210");
        g.addNode("door_room_room_3_2_176", 2, 3, 7.6, -50, "door", "Вход 210");
        g.addNode("door_corr_room_3_2_176", 2, 3, 6.8, -50, "door", "Коридор 210");
        g.addNode("room_3_2_177", 2, 3, 10.6, -52.6, "room", "212А");
        g.addNode("door_mid_room_3_2_177", 2, 3, 8.4, -53.8, "door", "Дверь 212А");
        g.addNode("door_room_room_3_2_177", 2, 3, 8.4, -53.4, "door", "Вход 212А");
        g.addNode("door_corr_room_3_2_177", 2, 3, 8.4, -54.2, "door", "Коридор 212А");
        g.addNode("room_3_2_178", 2, 3, 10.6, -57.7, "room", "212");
        g.addNode("door_mid_room_3_2_178", 2, 3, 7.2, -55, "door", "Дверь 212");
        g.addNode("door_room_room_3_2_178", 2, 3, 7.6, -55, "door", "Вход 212");
        g.addNode("door_corr_room_3_2_178", 2, 3, 6.8, -55, "door", "Коридор 212");
        g.addNode("custom_b1_f2_c_27_-76_oy4", 2, 1, 2.7, -7.6, "corridor", "Коридор (2.7, -7.6)");
        g.addNode("custom_b1_f2_c_27_-100_pje", 2, 1, 2.7, -10, "corridor", "Коридор (2.7, -10)");
        g.addNode("custom_b1_f2_c_59_-76_zai", 2, 1, 5.9, -7.6, "corridor", "Коридор (5.9, -7.6)");
        g.addNode("custom_b1_f2_c_59_-124_2uw", 2, 1, 5.9, -12.4, "corridor", "Коридор (5.9, -12.4)");
        g.addNode("custom_b3_f2_c_59_-232_f56", 2, 3, 5.9, -23.2, "corridor", "Коридор (5.9, -23.2)");
        g.addNode("custom_b3_f2_c_59_-304_oeo", 2, 3, 5.9, -30.4, "corridor", "Коридор (5.9, -30.4)");
        g.addNode("custom_b3_f2_c_59_-598_xz2", 2, 3, 5.9, -59.8, "corridor", "Коридор (5.9, -59.8)");
        g.addNode("custom_b2_f2_c_246_-88_mx5", 2, 2, 24.6, -8.8, "corridor", "Коридор (24.6, -8.8)");
        g.addNode("custom_b2_f2_c_246_-105_p78", 2, 2, 24.6, -10.5, "corridor", "Коридор (24.6, -10.5)");
        g.addNode("custom_b2_f2_c_219_-58_veu", 2, 2, 21.9, -5.8, "corridor", "Коридор (21.9, -5.8)");
        g.addNode("custom_b2_f2_c_249_-58_wdq", 2, 2, 24.9, -5.8, "corridor", "Коридор (24.9, -5.8)");
        g.addNode("custom_b2_f2_c_282_-58_zxs", 2, 2, 28.2, -5.8, "corridor", "Коридор (28.2, -5.8)");
        g.addNode("custom_b2_f2_c_328_-58_2yl", 2, 2, 32.8, -5.8, "corridor", "Коридор (32.8, -5.8)");
        g.addNode("custom_b2_f2_c_403_-58_82t", 2, 2, 40.3, -5.8, "corridor", "Коридор (40.3, -5.8)");
        g.addNode("custom_b1_f2_c_-102_15_l9n", 2, 1, -10.2, 1.5, "corridor", "Коридор (-10.2, 1.5)");
        g.addNode("custom_b1_f2_c_-111_15_njt", 2, 1, -11.1, 1.5, "corridor", "Коридор (-11.1, 1.5)");
        g.addNode("custom_b1_f2_c_-112_-14_sdr", 2, 1, -11.2, -1.4, "corridor", "Коридор (-11.2, -1.4)");
        g.addNode("custom_b1_f2_c_-30_-101_xdd", 2, 1, -3, -10.1, "corridor", "Коридор (-3, -10.1)");
        g.addNode("custom_b1_f2_c_95_-51_o94", 2, 1, 9.5, -5.1, "corridor", "Коридор (9.5, -5.1)");
        g.addNode("custom_b1_f2_c_136_-51_uqh", 2, 1, 13.6, -5.1, "corridor", "Коридор (13.6, -5.1)");
        g.addNode("custom_b1_f2_c_180_-56_1nw", 2, 1, 18, -5.6, "corridor", "Коридор (18, -5.6)");
        g.addNode("custom_b1_f2_c_-15_118_ag9", 2, 1, -1.5, 11.8, "corridor", "Коридор (-1.5, 11.8)");
        g.addNode("custom_b1_f2_c_-4_118_api", 2, 1, -0.4, 11.8, "corridor", "Коридор (-0.4, 11.8)");
        g.addNode("custom_b1_f2_c_160_-48_j36", 2, 1, 16, -4.8, "corridor", "Коридор (16, -4.8)");
        g.addNode("custom_b3_f2_c_59_-430_6v0", 2, 3, 5.9, -43, "corridor", "Коридор (5.9, -43)");
        g.addNode("custom_b3_f2_c_84_-531_opn", 2, 3, 8.4, -53.1, "corridor", "Коридор (8.4, -53.1)");
        g.addNode("custom_b3_f2_c_107_-531_rgj", 2, 3, 10.7, -53.1, "corridor", "Коридор (10.7, -53.1)");
        g.addNode("custom_b3_f2_c_58_-318_asy", 2, 3, 5.8, -31.8, "corridor", "Коридор (5.8, -31.8)");
        g.addNode("door_mid_room_1_2_16", 2, 1, -1.2, 1.7, "door", "Дверь Лифтовой холл");
        g.addNode("door_room_room_1_2_16", 2, 1, -0.8, 1.7, "door", "Вход Лифтовой холл");
        g.addNode("door_corr_room_1_2_16", 2, 1, -1.6, 1.7, "door", "Коридор Лифтовой холл");
        g.addNode("b1_f1_nc_-3.0", 1, 1, -3, -5.8, "corridor", "К1 Эт.1 Сев. коридор");
        g.addNode("b1_f1_nc_0.0", 1, 1, 0, -5.8, "corridor", "К1 Эт.1 Сев. коридор");
        g.addNode("b1_f1_nc_3.0", 1, 1, 3, -5.8, "corridor", "К1 Эт.1 Сев. коридор");
        g.addNode("b1_f1_nc_5.9", 1, 1, 5.9, -5.8, "corridor", "К1 Эт.1 Сев. коридор");
        g.addNode("b1_f1_nc_9.4", 1, 1, 9.4, -5.8, "corridor", "К1 Эт.1 Сев. коридор");
        g.addNode("b1_f1_nc_12.5", 1, 1, 12.5, -5.8, "corridor", "К1 Эт.1 Сев. коридор");
        g.addNode("b1_f1_nc_16.0", 1, 1, 15.6, -5, "corridor", "К1 Эт.1 Сев. коридор");
        g.addNode("b1_f1_wc_-3.0", 1, 1, -3, -3, "corridor", "К1 Эт.1 Зап. коридор");
        g.addNode("b1_f1_wc_0.0", 1, 1, -3, 0, "corridor", "К1 Эт.1 Зап. коридор");
        g.addNode("b1_f1_wc_1.7", 1, 1, -3, 1.7, "corridor", "К1 Эт.1 Зап. коридор");
        g.addNode("b1_f1_wc_3.5", 1, 1, -3, 3.5, "corridor", "К1 Эт.1 Зап. коридор");
        g.addNode("b1_f1_wc_6.0", 1, 1, -3, 6, "corridor", "К1 Эт.1 Зап. коридор");
        g.addNode("b1_f1_sc_0.0", 1, 1, -0.5, 6, "corridor", "К1 Эт.1 Юж. коридор");
        g.addNode("b1_f1_sc_1.8", 1, 1, 0, 9.8, "corridor", "К1 Эт.1 Юж. коридор");
        g.addNode("b1_f1_sc_3.5", 1, 1, 3.5, 9.8, "corridor", "К1 Эт.1 Юж. коридор");
        g.addNode("b1_f1_stair_lk1", 1, 1, 9.4, -2.0, "stair", "К1 ЛК№1 (Эт.1)");
        g.addNode("b1_f1_stair_lk2", 1, 1, 9.4, 1.9, "stair", "К1 ЛК№2 (Эт.1)");
        g.addNode("b1_f1_elev", 1, 1, 1.8, 1.5, "elevator", "К1 Лифты (Эт.1)");
        g.addNode("b1_f1_entrance_main", 1, 1, 10.5, 10.4, "entrance", "Восточный вход (Корпус 1 — на ремонте)");
        g.addNode("b1_f1_porch_walk_1", 1, 1, 9.5, 9.8, "corridor", "Крыльцо у главного входа");
        g.addNode("b1_f1_porch_doors", 1, 1, 8.6, 9.8, "door", "Двери главного входа");
        g.addNode("b1_f1_vestibule", 1, 1, 6.2, 9.8, "corridor", "Тамбур главного входа");
        g.addNode("b1_f1_inner_doors", 1, 1, 3.8, 9.8, "door", "Вход в вестибюль");
        g.addNode("b1_f1_foyer", 1, 1, 1.8, 9.8, "corridor", "Главный вестибюль");
        g.addNode("b1_f1_foyer_w", 1, 1, -3, 9.8, "corridor", "Вестибюль (Западный угол)");
        g.addNode("b1_f1_inner_door_lk2", 1, 1, 8.6, 1.8, "door", "Внутренняя дверь ЛК№2");
        g.addNode("b2_f1_c_20.4", 1, 2, 20.4, -5.8, "corridor", "К2 Эт.1 Коридор");
        g.addNode("b2_f1_c_37.5", 1, 2, 37.5, -5.8, "corridor", "К2 Эт.1 Коридор");
        g.addNode("b2_f1_c_43.6", 1, 2, 43.6, -5.8, "corridor", "К2 Эт.1 Коридор");
        g.addNode("b2_f1_c_47.0", 1, 2, 47, -5.8, "corridor", "К2 Эт.1 Коридор");
        g.addNode("b2_f1_c_59.0", 1, 2, 59, -5.8, "corridor", "К2 Эт.1 Коридор");
        g.addNode("b2_f1_c_66.1", 1, 2, 66.1, -5.8, "corridor", "К2 Эт.1 Коридор");
        g.addNode("b2_f1_stair_lk1", 1, 2, 66.1, -10.5, "stair", "К2 ЛК№1 (Эт.1)");
        g.addNode("b2_f1_stair_lk2", 1, 2, 42.7, -10.5, "stair", "К2 ЛК№2 (Эт.1)");
        g.addNode("b2_f1_stair_lk3", 1, 2, 22.6, -12.2, "stair", "К2 ЛК№3 (Эт.1)");
        g.addNode("b2_f1_d_lk3_vest", 1, 2, 24.8, -11.35, "door", "Дверь ЛК№3 - Тамбур");
        g.addNode("b2_f1_vest_lk3", 1, 2, 26.1, -11.55, "corridor", "Тамбур ЛК№3");
        g.addNode("b2_f1_d_vest_105", 1, 2, 27.4, -11.8, "door", "Дверь Тамбур - 105");
        g.addNode("b2_f1_porch", 1, 2, 20.4, -5.8, "entrance", "Вход в Корпус 2");
        g.addNode("custom_b2_f1_c_226_-58_h4c", 1, 2, 22.6, -5.8, "corridor", "К2 Эт.1 Коридор");
        g.addNode("b3_f1_c_-28.6", 1, 3, 5.9, -28.6, "corridor", "К3 Эт.1 Коридор");
        g.addNode("b3_f1_c_-45.5", 1, 3, 5.9, -45.5, "corridor", "К3 Эт.1 Коридор");
        g.addNode("b3_f1_c_-46.0", 1, 3, 5.9, -46, "corridor", "К3 Эт.1 Коридор");
        g.addNode("b3_f1_c_-55.0", 1, 3, 5.9, -53.8, "corridor", "К3 Эт.1 Коридор");
        g.addNode("b3_f1_stair_south", 1, 3, 4.1, -28.6, "stair", "К3 Южная ЛК (Эт.1)");
        g.addNode("b3_f1_stair_north", 1, 3, 4.1, -46, "stair", "К3 Северная ЛК (Эт.1)");
        g.addNode("b3_f1_stair_north_wp", 1, 3, 1.5, -46.9, "stair", "Марш ЛК№1");
        g.addNode("b3_f1_entrance_north", 1, 3, -1.6, -46.1, "entrance", "Вход К3 (Северный)");
        g.addNode("b3_f1_entrance_west", 1, 3, -1.6, -36.5, "entrance", "Главный вход (Корпус 3 / Западный)");
        g.addNode("b3_f1_vest_north", 1, 3, 5.9, -56.2, "corridor", "Тамбур К3 Эт.1");
        g.addNode("b3_f1_door_vest_south", 1, 3, 5.9, -55, "door", "Дверь тамбура К3 Эт.1");
        g.addNode("b3_f1_d_corr_east_exit", 1, 3, 7.2, -29.1, "door", "Дверь к восточному выходу");
        g.addNode("room_1_1_0", 1, 1, -4.6, -10.2, "room", "102 Гардероб");
        g.addNode("door_mid_room_1_1_0", 1, 1, -3.9, -6.2, "door", "Дверь 102");
        g.addNode("door_room_room_1_1_0", 1, 1, -3.9, -6.6, "door", "Вход 102");
        g.addNode("door_corr_room_1_1_0", 1, 1, -3.9, -5.8, "door", "Коридор 102");
        g.addNode("room_1_1_1", 1, 1, 2.7, -10.2, "room", "106");
        g.addNode("door_mid_room_1_1_1", 1, 1, 4.6, -10, "door", "Дверь 106");
        g.addNode("door_room_room_1_1_1", 1, 1, 4.2, -10, "door", "Вход 106");
        g.addNode("door_corr_room_1_1_1", 1, 1, 5, -10, "door", "Коридор 106");
        g.addNode("room_1_1_2", 1, 1, 6, -10.2, "room", "105");
        g.addNode("room_1_1_3", 1, 1, 9.3, -13.2, "room", "С/У (М)");
        g.addNode("room_1_1_4", 1, 1, 9.3, -7, "room", "С/У (Ж)");
        g.addNode("room_1_1_5", 1, 1, 13.6, -10.2, "room", "107");
        g.addNode("door_mid_room_1_1_5", 1, 1, 13.5, -6.2, "door", "Дверь 107");
        g.addNode("door_room_room_1_1_5", 1, 1, 13.5, -6.6, "door", "Вход 107");
        g.addNode("door_corr_room_1_1_5", 1, 1, 13.5, -5.8, "door", "Коридор 107");
        g.addNode("room_1_1_6", 1, 1, 7.6, -2.4, "room", "104");
        g.addNode("door_mid_room_1_1_6", 1, 1, 7.6, -4, "door", "Дверь 104");
        g.addNode("door_room_room_1_1_6", 1, 1, 7.6, -3.6, "door", "Вход 104");
        g.addNode("door_corr_room_1_1_6", 1, 1, 7.6, -4.4, "door", "Коридор 104");
        g.addNode("room_1_1_7", 1, 1, 5.6, -2.4, "room", "103");
        g.addNode("door_mid_room_1_1_7", 1, 1, 5.6, -4, "door", "Дверь 103");
        g.addNode("door_room_room_1_1_7", 1, 1, 5.6, -3.6, "door", "Вход 103");
        g.addNode("door_corr_room_1_1_7", 1, 1, 5.6, -4.4, "door", "Коридор 103");
        g.addNode("room_1_1_8", 1, 1, 1.8, 1.8, "room", "103 (Холл)");
        g.addNode("door_room_room_1_1_8", 1, 1, -0.8, 1.7, "door", "Вход Холл 103");
        g.addNode("door_mid_room_1_1_8", 1, 1, -1.2, 1.7, "door", "Дверь Холл 103");
        g.addNode("door_corr_room_1_1_8", 1, 1, -1.6, 1.7, "door", "Коридор Холл 103");
        g.addNode("room_1_1_9", 1, 1, 3.7, 6.7, "room", "101");
        g.addNode("door_mid_room_1_1_9", 1, 1, 2.6, 8.6, "door", "Дверь 101");
        g.addNode("door_room_room_1_1_9", 1, 1, 2.6, 8.2, "door", "Вход 101");
        g.addNode("door_corr_room_1_1_9", 1, 1, 2.6, 9.0, "door", "Коридор 101");
        g.addNode("room_1_1_10", 1, 1, 9.4, -1.9, "room", "ЛК№1");
        g.addNode("room_1_1_11", 1, 1, 9.4, 1.9, "room", "ЛК№2");
        g.addNode("room_2_1_94", 1, 2, 23.9, -8.7, "room", "103");
        g.addNode("door_mid_room_2_1_94", 1, 2, 24.6, -7.2, "door", "Дверь 103");
        g.addNode("door_room_room_2_1_94", 1, 2, 24.6, -7.6, "door", "Вход 103");
        g.addNode("door_corr_room_2_1_94", 1, 2, 24.6, -6.8, "door", "Коридор 103");
        g.addNode("room_2_1_95", 1, 2, 33, -10.3, "room", "105");
        g.addNode("door_mid_room_2_1_95", 1, 2, 33.4, -7.2, "door", "Дверь 105");
        g.addNode("door_room_room_2_1_95", 1, 2, 33.4, -7.6, "door", "Вход 105");
        g.addNode("door_corr_room_2_1_95", 1, 2, 33.4, -6.8, "door", "Коридор 105");
        g.addNode("room_2_1_96", 1, 2, 40.2, -8.3, "room", "107");
        g.addNode("door_mid_room_2_1_96", 1, 2, 40.2, -7.2, "door", "Дверь 107");
        g.addNode("door_room_room_2_1_96", 1, 2, 40.2, -7.6, "door", "Вход 107");
        g.addNode("door_corr_room_2_1_96", 1, 2, 40.2, -6.8, "door", "Коридор 107");
        g.addNode("room_2_1_97", 1, 2, 44.5, -9.2, "room", "ЛК№2");
        g.addNode("door_mid_room_2_1_97", 1, 2, 44.5, -7.2, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_2_1_97", 1, 2, 44.5, -7.6, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_2_1_97", 1, 2, 44.5, -6.8, "door", "Коридор ЛК№2");
        g.addNode("room_2_1_98", 1, 2, 53.1, -10.3, "room", "109");
        g.addNode("door_mid_room_2_1_98", 1, 2, 49.9, -7.2, "door", "Дверь 109");
        g.addNode("door_room_room_2_1_98", 1, 2, 49.9, -7.6, "door", "Вход 109");
        g.addNode("door_corr_room_2_1_98", 1, 2, 49.9, -6.8, "door", "Коридор 109");
        g.addNode("room_2_1_99", 1, 2, 59.7, -10.3, "room", "111");
        g.addNode("door_mid_room_2_1_99", 1, 2, 59.4, -7.2, "door", "Дверь 111");
        g.addNode("door_room_room_2_1_99", 1, 2, 59.4, -7.6, "door", "Вход 111");
        g.addNode("door_corr_room_2_1_99", 1, 2, 59.4, -6.8, "door", "Коридор 111");
        g.addNode("door_corr_room_2_1_100", 1, 2, 62, -8.8, "door", "Коридор С/У");
        g.addNode("room_2_1_101", 1, 2, 62.7, -8, "room", "С/У (М)");
        g.addNode("room_2_1_103", 1, 2, 29.5, -0.5, "room", "104 Библиотека");
        g.addNode("door_mid_room_2_1_103", 1, 2, 31.7, -4.4, "door", "Дверь 104");
        g.addNode("door_room_room_2_1_103", 1, 2, 31.7, -4, "door", "Вход 104");
        g.addNode("door_corr_room_2_1_103", 1, 2, 31.7, -4.8, "door", "Коридор 104");
        g.addNode("room_2_1_104", 1, 2, 46.7, -0.5, "room", "106");
        g.addNode("door_mid_room_2_1_104", 1, 2, 47.1, -4.4, "door", "Дверь 106");
        g.addNode("door_room_room_2_1_104", 1, 2, 47.1, -4, "door", "Вход 106");
        g.addNode("door_corr_room_2_1_104", 1, 2, 47.1, -4.8, "door", "Коридор 106");
        g.addNode("room_2_1_105", 1, 2, 59.5, -0.5, "room", "108");
        g.addNode("door_mid_room_2_1_105", 1, 2, 56.9, -4.4, "door", "Дверь 108");
        g.addNode("door_room_room_2_1_105", 1, 2, 56.9, -4, "door", "Вход 108");
        g.addNode("door_corr_room_2_1_105", 1, 2, 56.9, -4.8, "door", "Коридор 108");
        g.addNode("room_2_1_106", 1, 2, 66, -0.5, "room", "110");
        g.addNode("door_mid_room_2_1_106", 1, 2, 65.8, -4.4, "door", "Дверь 110");
        g.addNode("door_room_room_2_1_106", 1, 2, 65.8, -4, "door", "Вход 110");
        g.addNode("door_corr_room_2_1_106", 1, 2, 65.8, -4.8, "door", "Коридор 110");
        g.addNode("room_3_1_139", 1, 3, 3.2, -20.5, "room", "103");
        g.addNode("room_3_1_140", 1, 3, 10.6, -23.2, "room", "104");
        g.addNode("door_mid_room_3_1_140", 1, 3, 7.2, -23.2, "door", "Дверь 104");
        g.addNode("door_room_room_3_1_140", 1, 3, 7.6, -23.2, "door", "Вход 104");
        g.addNode("room_3_1_141", 1, 3, 10.6, -25.6, "room", "102");
        g.addNode("door_mid_room_3_1_141", 1, 3, 7.2, -25.6, "door", "Дверь 102");
        g.addNode("door_room_room_3_1_141", 1, 3, 7.6, -25.6, "door", "Вход 102");
        g.addNode("door_corr_room_3_1_141", 1, 3, 6.8, -25.6, "door", "Коридор 102");
        g.addNode("room_3_1_142", 1, 3, 10.6, -31.6, "room", "105");
        g.addNode("door_mid_room_3_1_142", 1, 3, 7.2, -32, "door", "Дверь 105");
        g.addNode("room_3_1_143", 1, 3, 10.6, -37.4, "room", "111");
        g.addNode("door_mid_room_3_1_143", 1, 3, 7.2, -40.7, "door", "Дверь 111");
        g.addNode("door_room_room_3_1_143", 1, 3, 7.6, -40.7, "door", "Вход 111");
        g.addNode("door_corr_room_3_1_143", 1, 3, 6.8, -40.7, "door", "Коридор 111");
        g.addNode("room_3_1_144", 1, 3, 10.6, -43.1, "room", "111А");
        g.addNode("door_mid_room_3_1_144", 1, 3, 7.2, -43, "door", "Дверь 111А");
        g.addNode("door_room_room_3_1_144", 1, 3, 7.6, -43, "door", "Вход 111А");
        g.addNode("room_3_1_145", 1, 3, 8.9, -45.5, "room", "112");
        g.addNode("door_mid_room_3_1_145", 1, 3, 7.2, -45.5, "door", "Дверь 112");
        g.addNode("door_room_room_3_1_145", 1, 3, 7.6, -45.5, "door", "Вход 112");
        g.addNode("door_corr_room_3_1_145", 1, 3, 6.8, -45.5, "door", "Коридор 112");
        g.addNode("b3_f1_door_room_112_vestibule", 1, 3, 10.6, -45.5, "door", "Дверь тамбура 112");
        g.addNode("room_3_1_146", 1, 3, 10.6, -47.6, "room", "113А");
        g.addNode("door_mid_room_3_1_146", 1, 3, 7.2, -47.5, "door", "Дверь 113А");
        g.addNode("door_room_room_3_1_146", 1, 3, 7.6, -47.5, "door", "Вход 113А");
        g.addNode("room_3_1_147", 1, 3, 10.6, -51.7, "room", "113");
        g.addNode("door_mid_room_3_1_147", 1, 3, 7.2, -51.4, "door", "Дверь 113");
        g.addNode("door_room_room_3_1_147", 1, 3, 7.6, -51.4, "door", "Вход 113");
        g.addNode("room_3_1_148", 1, 3, 10.6, -58.3, "room", "116");
        g.addNode("door_mid_room_3_1_148", 1, 3, 5.9, -57.4, "door", "Дверь 116");
        g.addNode("door_room_room_3_1_148", 1, 3, 5.9, -57.8, "door", "Вход 116");
        g.addNode("door_corr_room_3_1_148", 1, 3, 5.9, -56.9, "door", "Коридор 116");
        g.addNode("room_3_1_149", 1, 3, 4.1, -28.6, "room", "ЛК№2");
        g.addNode("door_mid_room_3_1_149", 1, 3, 4.6, -28.6, "door", "Дверь ЛК№2");
        g.addNode("door_room_room_3_1_149", 1, 3, 4.3, -28.6, "door", "Вход ЛК№2");
        g.addNode("door_corr_room_3_1_149", 1, 3, 4.9, -28.6, "door", "Коридор ЛК№2");
        g.addNode("room_3_1_150", 1, 3, 1.5, -31.5, "room", "106");
        g.addNode("door_mid_room_3_1_150", 1, 3, 4.6, -31.3, "door", "Дверь 106");
        g.addNode("door_room_room_3_1_150", 1, 3, 4.2, -31.3, "door", "Вход 106");
        g.addNode("room_3_1_151", 1, 3, 1.5, -33.8, "room", "107");
        g.addNode("door_room_room_3_1_151", 1, 3, 2.1, -34.6, "door", "Вход 107");
        g.addNode("room_3_1_152", 1, 3, 3, -38, "room", "109");
        g.addNode("room_3_1_153", 1, 3, -0.4, -38.7, "room", "108");
        g.addNode("door_room_room_3_1_153", 1, 3, -0.3, -37.8, "door", "Дверь 108");
        g.addNode("b3_f1_tambur_108", 1, 3, -0.4, -36.5, "corridor", "Тамбур входа К3");
        g.addNode("b3_f1_door_tambur_108", 1, 3, 0.4, -36.4, "door", "Дверь тамбура К3");
        g.addNode("b3_f1_exit_east_inner", 1, 3, 9.4, -28.6, "corridor", "Проход к выходу К3");
        g.addNode("b3_f1_exit_east_door", 1, 3, 13.8, -28.6, "door", "Выход К3 во двор");
        g.addNode("room_3_1_154", 1, 3, 0.2, -40.7, "room", "С/У (Ж)");
        g.addNode("door_mid_room_3_1_154", 1, 3, 4.6, -40.4, "door", "Дверь С/У");
        g.addNode("door_room_room_3_1_154", 1, 3, 4.2, -40.4, "door", "Вход С/У");
        g.addNode("door_corr_room_3_1_154", 1, 3, 5, -40.4, "door", "Коридор С/У");
        g.addNode("room_3_1_155", 1, 3, 3.3, -41.9, "room", "С/У");
        g.addNode("door_mid_room_3_1_155", 1, 3, 4.6, -41.9, "door", "Дверь С/У");
        g.addNode("door_room_room_3_1_155", 1, 3, 4.2, -41.9, "door", "Вход С/У");
        g.addNode("door_corr_room_3_1_155", 1, 3, 5, -41.9, "door", "Коридор С/У");
        g.addNode("room_3_1_156", 1, 3, 0.2, -43.1, "room", "С/У (М)");
        g.addNode("room_3_1_157", 1, 3, 4.1, -46, "room", "ЛК№1");
        g.addNode("door_mid_room_3_1_157", 1, 3, 4.6, -46, "door", "Дверь ЛК№1");
        g.addNode("door_room_room_3_1_157", 1, 3, 4.3, -46, "door", "Вход ЛК№1");
        g.addNode("door_corr_room_3_1_157", 1, 3, 4.9, -46, "door", "Коридор ЛК№1");
        g.addNode("room_3_1_158", 1, 3, 1.5, -50.2, "room", "114");
        g.addNode("door_mid_room_3_1_158", 1, 3, 4.6, -50.6, "door", "Дверь 114");
        g.addNode("door_room_room_3_1_158", 1, 3, 4.2, -50.6, "door", "Вход 114");
        g.addNode("room_3_1_159", 1, 3, 1.5, -53.8, "room", "114А");
        g.addNode("door_mid_room_3_1_159", 1, 3, 4.6, -53.8, "door", "Дверь 114А");
        g.addNode("door_room_room_3_1_159", 1, 3, 4.2, -53.8, "door", "Вход 114А");
        g.addNode("door_corr_room_3_1_159", 1, 3, 5, -53.8, "door", "Коридор 114А");
        g.addNode("room_3_1_160", 1, 3, 1.5, -58.3, "room", "117");
        g.addNode("door_room_3_1_160", 1, 3, 4.6, -56.2, "door", "Дверь 117");
        g.addNode("custom_b2_f1_c_626_-58_pxf", 1, 2, 62.6, -5.8, "corridor", "Коридор (62.6, -5.8)");
        g.addNode("custom_b2_f1_c_620_-125_vbv", 1, 2, 62, -12.5, "corridor", "Коридор (62, -12.5)");
        g.addNode("custom_b2_f1_c_629_-125_vmm", 1, 2, 62.9, -12.5, "corridor", "Коридор (62.9, -12.5)");
        g.addNode("custom_b2_f1_c_317_-58_it3", 1, 2, 31.7, -5.8, "corridor", "Коридор (31.7, -5.8)");
        g.addNode("custom_b2_f1_c_334_-58_oms", 1, 2, 33.4, -5.8, "corridor", "Коридор (33.4, -5.8)");
        g.addNode("custom_b2_f1_c_402_-58_rs0", 1, 2, 40.2, -5.8, "corridor", "Коридор (40.2, -5.8)");
        g.addNode("custom_b2_f1_c_246_-58_wff", 1, 2, 24.6, -5.8, "corridor", "Коридор (24.6, -5.8)");
        g.addNode("custom_b3_f1_c_59_-313_m4p", 1, 3, 5.9, -31.3, "corridor", "Коридор (5.9, -31.3)");
        g.addNode("custom_b3_f1_c_59_-356_xpk", 1, 3, 5.9, -35.6, "corridor", "Коридор (5.9, -35.6)");
        g.addNode("custom_b3_f1_c_59_-375_zxo", 1, 3, 5.9, -37.5, "corridor", "Коридор (5.9, -37.5)");
        g.addNode("custom_b3_f1_c_59_-404_5kk", 1, 3, 5.9, -40.4, "corridor", "Коридор (5.9, -40.4)");
        g.addNode("custom_b3_f1_c_59_-420_6z7", 1, 3, 5.9, -42, "corridor", "Коридор (5.9, -42)");
        g.addNode("custom_b3_f1_c_59_-431_8or", 1, 3, 5.9, -43.1, "corridor", "Коридор (5.9, -43.1)");
        g.addNode("custom_b3_f1_c_42_-395_irx", 1, 3, 4.2, -39.5, "corridor", "Коридор (4.2, -39.5)");
        g.addNode("custom_b3_f1_c_59_-579_ud7", 1, 3, 5.9, -57.9, "corridor", "Коридор (5.9, -57.9)");
        g.addNode("custom_b3_f1_c_60_-205_o4u", 1, 3, 6, -20.5, "corridor", "Коридор (6, -20.5)");
        g.addNode("custom_b3_f1_c_60_-232_qzy", 1, 3, 6, -23.2, "corridor", "Коридор (6, -23.2)");
        g.addNode("custom_b3_f1_c_60_-257_skf", 1, 3, 6, -25.7, "corridor", "Коридор (6, -25.7)");
        g.addNode("custom_b3_f1_c_73_-257_vh5", 1, 3, 7.3, -25.7, "corridor", "Коридор (7.3, -25.7)");
        g.addNode("custom_b3_f1_c_106_-257_yy3", 1, 3, 10.6, -25.7, "corridor", "Коридор (10.6, -25.7)");
        g.addNode("custom_b3_f1_c_21_-356_8ss", 1, 3, 2.1, -35.6, "corridor", "Коридор (2.1, -35.6)");
        g.addNode("custom_b3_f1_c_59_-476_pow", 1, 3, 5.9, -47.6, "corridor", "Коридор (5.9, -47.6)");
        g.addNode("custom_b3_f1_c_59_-491_r17", 1, 3, 5.9, -50.6, "corridor", "Коридор (5.9, -50.6)");
        g.addNode("custom_b3_f1_c_59_-511_sy7", 1, 3, 5.9, -51.4, "corridor", "Коридор (5.9, -51.4)");
        g.addNode("custom_b3_f1_c_102_-579_32j", 1, 3, 10.2, -57.9, "corridor", "Коридор (10.2, -57.9)");
        g.addNode("custom_b2_f1_c_570_-58_cc0", 1, 2, 57, -5.8, "corridor", "Коридор (57, -5.8)");
        g.addNode("custom_b1_f1_c_61_-132_nb8", 1, 1, 6.1, -13.2, "corridor", "Коридор (6.1, -13.2)");
        g.addNode("custom_b1_f1_c_58_-72_tpz", 1, 1, 5.8, -7.2, "corridor", "Коридор (5.8, -7.2)");
        g.addNode("custom_b1_f1_c_58_-101_wov", 1, 1, 5.8, -10.1, "corridor", "Коридор (5.8, -10.1)");
        g.addNode("custom_b2_f1_c_500_-59_9s1", 1, 2, 50, -5.9, "corridor", "Коридор (50, -5.9)");
        // Семантический узел северной части внутреннего проезда между К3 и К4
        g.addNode("outdoor_court_north", 1, 0, 21.3, -45.3, "corridor", "Внутренний проезд (север)");
        g.addNode("outdoor_node_86645", 1, 0, 21.3, -45.3, "corridor", "Внутренний проезд (север)");
        g.addEdge("outdoor_court_north", "outdoor_node_86645", 0.0);
        g.addNode("outdoor_node_90724", 1, 0, 21.6, -19.6, "corridor", "Улица");
        g.addNode("outdoor_node_78", 1, 0, 43.8, -19.4, "corridor", "Улица");
        g.addNode("outdoor_node_52241", 1, 0, 43.8, -32.1, "corridor", "Улица");
        g.addNode("outdoor_node_79023", 1, 0, 43, -14.8, "corridor", "Улица");
        g.addNode("outdoor_node_81120", 1, 0, 42.6, -11, "corridor", "Улица");
        g.addNode("outdoor_node_74046", 1, 0, 15.2, -28.6, "corridor", "Улица");
        g.addNode("outdoor_b4_porch_corner", 1, 0, 26, -52, "corridor", "Улица");
        g.addNode("b4_f1_stair_lk1", 1, 4, 41.4, -30.5, "stair", "К4 ЛК№1 (Эт.1)");
        g.addNode("b4_f1_stair_lk1_door", 1, 4, 40.6, -31.2, "door", "К4 Дверь ЛК№1 (Эт.1)");
        g.addNode("b4_f1_stair_lk2", 1, 4, 33.8, -46.5, "stair", "К4 ЛК№2 (Эт.1)");
        g.addNode("b4_f1_stair_lk2_north_turn", 1, 4, 29.5, -48.8, "corridor", "Площадка ЛК№2 (север)");
        g.addNode("b4_f1_stair_lk2_north_door", 1, 4, 29.8, -49.8, "door", "Северный выход ЛК№2");
        g.addNode("b4_f1_porch", 1, 4, 30.1, -51.3, "entrance", "Вход в Корпус 4");
        g.addNode("b4_f1_nc_324", 1, 4, 29.5, -46.5, "corridor", "Площадка у ЛК№2");
        g.addNode("b4_f1_vest_w_north", 1, 4, 35, -46.5, "corridor", "Проход у ЛК№2");
        g.addNode("b4_f1_vest_w_door_n", 1, 4, 35, -45.4, "door", "Дверь тамбура ЛК№2");
        g.addNode("b4_f1_vest_w_center", 1, 4, 35.1, -43.9, "corridor", "Западный холл у тамбура");
        g.addNode("b4_f1_vest_w_door_e", 1, 4, 34.6, -43.9, "door", "Дверь западного тамбура");
        g.addNode("b4_f1_stair_lk3", 1, 4, 63.4, -47.6, "stair", "К4 ЛК№3 (Эт.1)");
        g.addNode("b4_f1_stair_lk3_door", 1, 4, 63.4, -45.4, "door", "Дверь ЛК№3 (Эт.1)");
        g.addNode("b4_f1_lk3_south_corr", 1, 4, 63.4, -44.4, "corridor", "Коридор у ЛК№3");
        g.addNode("b4_f1_foyer_center", 1, 4, 40.6, -33, "corridor", "Фойе столовой");
        g.addNode("b4_f1_foyer_entrance", 1, 4, 43.7, -31.8, "corridor", "Входной холл К4");
        g.addNode("custom_b4_f1_c_406_-322_sat", 1, 4, 40.6, -31.8, "corridor", "Коридор у ЛК№1");
        g.addNode("custom_b4_f1_c_438_-321_ent", 1, 4, 43.7, -31.8, "corridor", "Вход в К4");
        g.addNode("b4_f1_foyer_door_102", 1, 4, 44.5, -35.25, "door", "Дверь в столовую 102");
        g.addNode("b4_f1_door_102_inside", 1, 4, 45.5, -35.25, "door", "Вход в столовую 102");
        g.addNode("room_4_1_184", 1, 4, 55.5, -36.4, "room", "102\nСтоловая");
        g.addNode("b4_f1_c_dining_center", 1, 4, 55.5, -36.4, "corridor", "Столовая (зал)");
        g.addNode("b4_f1_c_102_east", 1, 4, 57.1, -44.4, "corridor", "Северо-восток столовой");
        g.addNode("door_102_to_18", 1, 4, 57.1, -45.4, "door", "Дверь из столовой в коридор кухни");
        g.addNode("b4_f1_c_366_320", 1, 4, 38.25, -33, "corridor", "Западный коридор (юг)");
        g.addNode("b4_f1_c_366_334", 1, 4, 38.25, -32.1, "corridor", "Коридор у 103");
        g.addNode("b4_f1_c_366_400", 1, 4, 38.25, -38.5, "corridor", "Коридор у 104");
        g.addNode("b4_f1_c_366_424", 1, 4, 38.25, -42.35, "corridor", "Коридор у 2");
        g.addNode("b4_f1_c_366_439", 1, 4, 38.25, -43.9, "corridor", "Западный холл");
        g.addNode("b4_f1_c_366_462", 1, 4, 38.25, -44.8, "corridor", "Коридор у 105");
        g.addNode("room_4_1_182", 1, 4, 34.9, -39.2, "room", "104");
        g.addNode("door_room_4_1_182", 1, 4, 37.4, -38.5, "door", "Дверь 104");
        g.addNode("room_4_1_183", 1, 4, 34.9, -32.2, "room", "103");
        g.addNode("door_room_4_1_183", 1, 4, 37.4, -32.1, "door", "Дверь 103");
        g.addNode("room_4_1_186", 1, 4, 42, -37.8, "room", "1");
        g.addNode("door_room_4_1_186", 1, 4, 40.85, -36.2, "door", "Проем 1");
        g.addNode("room_4_1_187", 1, 4, 40.3, -42.4, "room", "2");
        g.addNode("door_room_4_1_187", 1, 4, 39.2, -42.35, "door", "Дверь 2");
        g.addNode("room_4_1_188", 1, 4, 40, -44.8, "room", "105");
        g.addNode("door_room_4_1_188", 1, 4, 39.2, -44.8, "door", "Дверь 105");
        g.addNode("room_4_1_189", 1, 4, 43, -44.8, "room", "3");
        g.addNode("door_room_4_1_189", 1, 4, 43.95, -46.2, "door", "Дверь 3");
        g.addNode("b4_f1_vest_3_11", 1, 4, 43.95, -47.65, "corridor", "Тамбур 3/11");
        g.addNode("b4_f1_door_vest_north", 1, 4, 43.95, -49.7, "door", "Дверь тамбура 11 (север)");
        g.addNode("b4_f1_pass_12_15", 1, 4, 44.3, -51.1, "corridor", "Проход между 12 и 15");
        g.addNode("b4_f1_kc_443", 1, 4, 44.3, -53.5, "corridor", "Перекресток у 12 и 15");
        g.addNode("room_4_1_190", 1, 4, 40.9, -47.9, "room", "11");
        g.addNode("door_room_4_1_190", 1, 4, 42.6, -47.65, "door", "Дверь 11");
        g.addNode("room_4_1_191", 1, 4, 42.1, -51.1, "room", "12");
        g.addNode("door_room_4_1_191", 1, 4, 41, -51.8, "door", "Дверь 12");
        g.addNode("b4_f1_c401_500", 1, 4, 40.1, -50.0, "corridor", "Коридор у 4");
        g.addNode("b4_f1_c401_513", 1, 4, 40.1, -51.3, "corridor", "Коридор у 5");
        g.addNode("b4_f1_c401_518", 1, 4, 40.1, -51.8, "corridor", "Коридор у 12");
        g.addNode("b4_f1_c401_525", 1, 4, 40.1, -52.5, "corridor", "Коридор у 6");
        g.addNode("b4_f1_c401_535", 1, 4, 40.1, -53.5, "corridor", "Поворот коридора у 7");
        g.addNode("b4_f1_c401_537", 1, 4, 40.1, -53.7, "corridor", "Коридор у 7");
        g.addNode("b4_f1_door_step_7_8", 1, 4, 39.9, -54.3, "door", "Дверь коридора 7/8");
        g.addNode("b4_f1_c416_548", 1, 4, 41.65, -54.85, "corridor", "Коридор у 8");
        g.addNode("b4_f1_c416_561", 1, 4, 41.65, -56.15, "corridor", "Коридор у 9");
        g.addNode("b4_f1_c416_574", 1, 4, 41.65, -57.7, "corridor", "Коридор у 13");
        g.addNode("b4_f1_c416_578", 1, 4, 41.65, -57.8, "corridor", "Коридор у 10");
        g.addNode("room_4_1_198", 1, 4, 37.4, -48.0, "room", "4");
        g.addNode("door_room_4_1_198", 1, 4, 39.2, -50.0, "door", "Дверь 4");
        g.addNode("room_4_1_199", 1, 4, 37.4, -51.3, "room", "5");
        g.addNode("door_room_4_1_199", 1, 4, 39.2, -51.3, "door", "Дверь 5");
        g.addNode("room_4_1_200", 1, 4, 37.4, -52.5, "room", "6");
        g.addNode("door_room_4_1_200", 1, 4, 39.2, -52.5, "door", "Дверь 6");
        g.addNode("room_4_1_201", 1, 4, 37.4, -53.7, "room", "7");
        g.addNode("door_room_4_1_201", 1, 4, 39.2, -53.7, "door", "Дверь 7");
        g.addNode("room_4_1_202", 1, 4, 38.1, -54.9, "room", "8");
        g.addNode("door_room_4_1_202", 1, 4, 40.7, -54.85, "door", "Дверь 8");
        g.addNode("room_4_1_203", 1, 4, 38.1, -56.3, "room", "9");
        g.addNode("door_room_4_1_203", 1, 4, 40.7, -56.15, "door", "Дверь 9");
        g.addNode("room_4_1_204", 1, 4, 38.1, -58.8, "room", "10");
        g.addNode("door_room_4_1_204", 1, 4, 40.7, -57.8, "door", "Дверь 10");
        g.addNode("b4_f1_door_13_west", 1, 4, 42.6, -57.7, "door", "Боковая дверь тамбура 13");
        g.addNode("b4_f1_vest_13", 1, 4, 44, -57.7, "corridor", "Тамбур 13");
        g.addNode("door_room_4_1_205", 1, 4, 44, -57.35, "door", "Дверь 13");
        g.addNode("room_4_1_205", 1, 4, 44, -56.4, "room", "13");
        g.addNode("b4_f1_kc_467", 1, 4, 46.75, -53.5, "corridor", "Коридор у прохода 20");
        g.addNode("b4_f1_kc_472", 1, 4, 47.2, -53.5, "corridor", "Коридор у 15");
        g.addNode("b4_f1_kc_499", 1, 4, 49.9, -53.5, "corridor", "Коридор у 16");
        g.addNode("b4_f1_kc_550", 1, 4, 55, -53.5, "corridor", "Коридор у 17");
        g.addNode("b4_f1_kc_564_528", 1, 4, 56.4, -52.8, "corridor", "Подход к 24");
        g.addNode("b4_f1_kc_564_506", 1, 4, 56.4, -50.6, "corridor", "Коридор между 17 и 19");
        g.addNode("b4_f1_kc_571_477", 1, 4, 57.1, -47.7, "corridor", "Коридор между 14 и 18");
        g.addNode("b4_f1_open_pass_20", 1, 4, 46.75, -54.3, "door", "Проем к 20");
        g.addNode("b4_f1_pass_20", 1, 4, 46.75, -56.2, "corridor", "Проход у 20");
        g.addNode("door_room_4_1_206", 1, 4, 48.1, -56.2, "door", "Дверь 20");
        g.addNode("room_4_1_206", 1, 4, 49.2, -56.4, "room", "20");
        g.addNode("b4_f1_20_south", 1, 4, 49.2, -54.95, "corridor", "Юг 20");
        g.addNode("door_room_4_1_206_207", 1, 4, 50.3, -54.95, "door", "Проем 20-21");
        g.addNode("b4_f1_21_south", 1, 4, 51.3, -54.95, "corridor", "Юг 21");
        g.addNode("room_4_1_207", 1, 4, 51.3, -56.4, "room", "21");
        g.addNode("door_room_4_1_207_24", 1, 4, 52.4, -57.8, "door", "Дверь 21-24");
        g.addNode("room_4_1_193", 1, 4, 46.9, -51.1, "room", "15");
        g.addNode("door_room_4_1_193", 1, 4, 47.2, -52.6, "door", "Дверь 15");
        g.addNode("room_4_1_194", 1, 4, 49.7, -51.1, "room", "16");
        g.addNode("door_room_4_1_194", 1, 4, 49.9, -52.6, "door", "Дверь 16");
        g.addNode("room_4_1_195", 1, 4, 52.6, -51.1, "room", "17");
        g.addNode("door_room_4_1_195", 1, 4, 54.2, -50.35, "door", "Дверь 17");
        g.addNode("room_4_1_192", 1, 4, 50.2, -47.5, "room", "14");
        g.addNode("door_room_4_1_192_east", 1, 4, 55.4, -47.7, "door", "Дверь 14");
        g.addNode("room_4_1_197", 1, 4, 60, -50.9, "room", "19");
        g.addNode("door_room_4_1_197", 1, 4, 57.8, -50.6, "door", "Дверь 19");
        g.addNode("room_4_1_196", 1, 4, 60.6, -47.6, "room", "18");
        g.addNode("door_room_4_1_196", 1, 4, 59, -47.7, "door", "Дверь 18");
        g.addNode("room_4_1_208", 1, 4, 57.3, -55.2, "room", "24");
        g.addNode("door_room_4_1_208", 1, 4, 56.4, -52, "door", "Дверь 24");
        g.addNode("room_4_1_209", 1, 4, 56.1, -59.4, "room", "22");
        g.addNode("door_room_4_1_209", 1, 4, 57, -58.4, "door", "Дверь 22");
        g.addNode("room_4_1_210", 1, 4, 61.1, -59.4, "room", "23");
        g.addNode("door_room_4_1_210", 1, 4, 61.4, -58.4, "door", "Дверь 23");
        g.addNode("b4_f2_stair_lk1", 2, 4, 41.4, -30.5, "stair", "К4 ЛК№1 (Эт.2)");
        g.addNode("b4_f2_stair_lk1_door", 2, 4, 40.6, -31.2, "door", "К4 Дверь ЛК№1 (Эт.2)");
        g.addNode("b4_f2_stair_lk2", 2, 4, 34.8, -48.3, "stair", "К4 ЛК№2 (Эт.2)");
        g.addNode("b4_f2_stair_lk2_door", 2, 4, 36, -48.3, "door", "К4 Дверь ЛК№2 (Эт.2)");
        g.addNode("b4_f2_stair_lk3", 2, 4, 64.5, -47.7, "stair", "К4 ЛК№3 (Эт.2)");
        g.addNode("b4_f2_stair_lk3_door", 2, 4, 63.6, -47.7, "door", "К4 Дверь ЛК№3 (Эт.2)");
        g.addNode("b4_f2_vest_lk3", 2, 4, 62.9, -47.7, "corridor", "Предбанник ЛК№3 (Эт.2)");
        g.addNode("b4_f2_door_vest_lk3_s", 2, 4, 62.9, -45.4, "door", "Выход предбанника ЛК№3");
        g.addNode("bridge_k3_k4_f2", 2, 4, 23.2, -45.4, "bridge", "Переход К3 ↔ К4 (2 эт.)");
        g.addNode("room_4_2_213", 2, 4, 24, -45.4, "room", "Переход\nК3 ↔ К4");
        g.addNode("b4_f2_bridge_k3_door", 2, 4, 32.4, -45.4, "door", "Дверь Перехода К3 ↔ К4");
        g.addNode("b4_f2_vest_k3", 2, 4, 34.8, -45.5, "corridor", "Тамбур Перехода К3 ↔ К4");
        g.addNode("b4_f2_door_vest_k3", 2, 4, 36, -45.5, "door", "Вход из Перехода в холл К4");
        g.addNode("bridge_k4_k2_f2", 2, 4, 37.4, -20.6, "bridge", "Переход К4 ↔ К2 (2 эт.)");
        g.addNode("room_4_2_214", 2, 4, 37.4, -20.6, "room", "Переход\nК4 ↔ К2");
        g.addNode("b4_f2_sw_-27.4", 2, 4, 37.4, -27.4, "corridor", "К4 Эт.2 Юж. коридор");
        g.addNode("b4_f2_c_375_483", 2, 4, 37.5, -48.3, "corridor", "К4 Эт.2 Холл у ЛК№2");
        g.addNode("b4_f2_c_375_455", 2, 4, 37.5, -45.5, "corridor", "К4 Эт.2 Холл у Перехода");
        g.addNode("b4_f2_sw_-44.5", 2, 4, 37.5, -44.7, "corridor", "К4 Эт.2 Юж. коридор");
        g.addNode("b4_f2_c_375_396", 2, 4, 37.5, -39.6, "corridor", "К4 Эт.2 Коридор у 205");
        g.addNode("b4_f2_c_375_349", 2, 4, 37.5, -34.9, "corridor", "К4 Эт.2 Коридор у 202");
        g.addNode("b4_f2_c_375_330", 2, 4, 37.5, -33, "corridor", "К4 Эт.2 Юж. холл");
        g.addNode("b4_f2_c_375_291", 2, 4, 37.5, -29.1, "corridor", "К4 Эт.2 Коридор у 201");
        g.addNode("b4_f2_c_lk1", 2, 4, 40.6, -33, "corridor", "К4 Эт.2 Холл у ЛК№1");
        g.addNode("b4_f2_c_473_330", 2, 4, 47.35, -33, "corridor", "К4 Эт.2 Холл у 204");
        g.addNode("b4_f2_c_473_358", 2, 4, 47.35, -35.8, "corridor", "К4 Эт.2 Подход к 203/204");
        g.addNode("b4_f2_c_410_491", 2, 4, 41, -49.15, "corridor", "Подход к сев. С/У");
        g.addNode("b4_f2_c_410_460", 2, 4, 41, -46.05, "corridor", "Подход к юж. С/У");
        g.addNode("b4_f2_c_410_447", 2, 4, 41, -44.7, "corridor", "К4 Эт.2 Коридор");
        g.addNode("b4_f2_c_424_447", 2, 4, 42.46, -44.7, "corridor", "К4 Эт.2 У раздевалок");
        g.addNode("door_room_4_2_215", 2, 4, 43.5, -44.7, "door", "Дверь коридора 2 эт.");
        g.addNode("b4_f2_c_473_447", 2, 4, 47.35, -44.7, "corridor", "К4 Эт.2 Коридор у 209");
        g.addNode("b4_f2_c_537_447", 2, 4, 53.7, -44.7, "corridor", "К4 Эт.2 Коридор у 210");
        g.addNode("b4_f2_c_551_447", 2, 4, 55.1, -44.7, "corridor", "К4 Эт.2 Коридор у 211");
        g.addNode("b4_f2_c_612_447", 2, 4, 61.25, -44.7, "corridor", "К4 Эт.2 Коридор у 212");
        g.addNode("b4_f2_c_629", 2, 4, 62.9, -44.7, "corridor", "К4 Эт.2 Коридор у ЛК№3");
        g.addNode("b4_f2_c_634_447", 2, 4, 63.4, -44.7, "corridor", "К4 Эт.2 Подход к 204 (сев)");
        g.addNode("room_4_2_211", 2, 4, 49.2, -55.7, "room", "206\nСпортивный зал");
        g.addNode("b4_f2_door_gym_w", 2, 4, 38.1, -49.8, "door", "Западный вход в спортзал 206");
        g.addNode("door_mid_room_4_2_211", 2, 4, 62.9, -49.8, "door", "Восточный вход в спортзал 206");
        g.addNode("room_4_2_wc_north", 2, 4, 43.8, -49.1, "room", "С/У (М)");
        g.addNode("b4_f2_door_wc_n", 2, 4, 42, -49.15, "door", "Дверь С/У (сев)");
        g.addNode("room_4_2_wc_south", 2, 4, 43.8, -46, "room", "С/У (Ж)");
        g.addNode("b4_f2_door_wc_s", 2, 4, 42, -46.05, "door", "Дверь С/У (юг)");
        g.addNode("room_4_2_service", 2, 4, 48.3, -47.6, "room", "Служеб.\nпом.");
        g.addNode("b4_f2_door_service_n", 2, 4, 47.6, -49.8, "door", "Дверь Служеб. пом.");
        g.addNode("room_4_2_218", 2, 4, 52.7, -47.6, "room", "210");
        g.addNode("door_room_room_4_2_218", 2, 4, 53.7, -45.4, "door", "Дверь 210");
        g.addNode("room_4_2_219", 2, 4, 56.2, -48.2, "room", "211");
        g.addNode("b4_f2_211_s", 2, 4, 55.1, -46.8, "corridor", "Вход 211");
        g.addNode("door_room_room_4_2_219", 2, 4, 55.1, -45.4, "door", "Дверь 211");
        g.addNode("room_4_2_212", 2, 4, 60.1, -48.2, "room", "212");
        g.addNode("room_4_2_220", 2, 4, 60.1, -48.2, "room", "212");
        g.addNode("b4_f2_212_s", 2, 4, 61.25, -46.8, "corridor", "Вход 212");
        g.addNode("door_room_4_2_212", 2, 4, 61.25, -45.4, "door", "Дверь 212");
        g.addNode("room_4_2_222", 2, 4, 34.2, -41.3, "room", "205");
        g.addNode("door_room_room_4_2_222", 2, 4, 35.5, -39.6, "door", "Вход 205");
        g.addNode("door_mid_room_4_2_222", 2, 4, 36, -39.6, "door", "Дверь 205");
        g.addNode("room_4_2_223", 2, 4, 34.2, -33.5, "room", "202");
        g.addNode("door_room_room_4_2_223", 2, 4, 35.5, -34.9, "door", "Вход 202");
        g.addNode("door_mid_room_4_2_223", 2, 4, 36, -34.9, "door", "Дверь 202");
        g.addNode("room_4_2_224", 2, 4, 34.2, -29.2, "room", "201");
        g.addNode("door_room_room_4_2_224", 2, 4, 35.5, -29.1, "door", "Вход 201");
        g.addNode("door_mid_room_4_2_224", 2, 4, 36, -29.1, "door", "Дверь 201");
        g.addNode("b4_f2_recess_207_208", 2, 4, 42.46, -43.2, "corridor", "Ниша раздевалок 207/208");
        g.addNode("door_room_room_4_2_225", 2, 4, 41.35, -43.2, "door", "Дверь 207");
        g.addNode("b4_f2_207_n", 2, 4, 40.5, -43.2, "corridor", "Вход в 207");
        g.addNode("room_4_2_225", 2, 4, 40.9, -38.6, "room", "207");
        g.addNode("door_corr_room_4_2_226", 2, 4, 43.56, -43.2, "door", "Дверь 208");
        g.addNode("b4_f2_208_n", 2, 4, 44.4, -43.2, "corridor", "Вход в 208");
        g.addNode("room_4_2_226", 2, 4, 44, -38.6, "room", "208");
        g.addNode("room_4_2_227", 2, 4, 47.2, -42.3, "room", "209");
        g.addNode("b4_f2_door_209", 2, 4, 47.35, -44, "door", "Дверь 209");
        g.addNode("room_4_2_228", 2, 4, 47.2, -39, "room", "203");
        g.addNode("b4_f2_door_203", 2, 4, 47.35, -37.3, "door", "Дверь 203");
        g.addNode("room_4_2_230", 2, 4, 55, -35.5, "room", "204\nАктовый зал");
        g.addNode("b4_f2_door_204_w", 2, 4, 49, -35.8, "door", "Западный вход в актовый зал 204");
        g.addNode("b4_f2_door_204_n", 2, 4, 63.4, -44, "door", "Северный вход в актовый зал 204");
        g.addNode("b4_f3_stair_lk1", 3, 4, 41.4, -28.8, "stair", "К4 ЛК№1 (Эт.3)");
        g.addNode("b4_f3_stair_lk1_door", 3, 4, 40.6, -29.6, "door", "К4 Дверь ЛК№1 (Эт.3)");
        g.addNode("b4_f3_stair_lk2", 3, 4, 34.8, -48.1, "stair", "К4 ЛК№2 (Эт.3)");
        g.addNode("b4_f3_stair_lk2_door", 3, 4, 36, -48.1, "door", "К4 Дверь ЛК№2 (Эт.3)");
        g.addNode("b4_f3_stair_lk3", 3, 4, 62.8, -48.9, "stair", "К4 ЛК№3 (Эт.3)");
        g.addNode("b4_f3_stair_lk3_door", 3, 4, 61.9, -48.9, "door", "К4 Дверь ЛК№3 (Эт.3)");
        g.addNode("b4_f3_c_377_489", 3, 4, 37.7, -48.9, "corridor", "К4 Эт.3 Коридор у 301");
        g.addNode("b4_f3_c_377_481", 3, 4, 37.7, -48.1, "corridor", "К4 Эт.3 Коридор у ЛК№2");
        g.addNode("b4_f3_c_377_443", 3, 4, 37.7, -44.3, "corridor", "К4 Эт.3 Коридор у 303");
        g.addNode("b4_f3_c_377_426", 3, 4, 37.7, -42.6, "corridor", "К4 Эт.3 Коридор у 306");
        g.addNode("b4_f3_c_377_407", 3, 4, 37.7, -40.7, "corridor", "К4 Эт.3 Коридор у сев. С/у");
        g.addNode("b4_f3_c_377_383", 3, 4, 37.7, -38.3, "corridor", "К4 Эт.3 Коридор у 304");
        g.addNode("b4_f3_sw_-38.0", 3, 4, 37.7, -37.8, "corridor", "К4 Эт.3 Коридор у юж. С/у");
        g.addNode("b4_f3_c_377_334", 3, 4, 37.7, -33.4, "corridor", "К4 Эт.3 Коридор у 308");
        g.addNode("b4_f3_c_377_311", 3, 4, 37.7, -31.1, "corridor", "К4 Эт.3 Коридор у 309");
        g.addNode("b4_f3_c_377_303", 3, 4, 37.7, -30.3, "corridor", "К4 Эт.3 Поворот к ЛК№1");
        g.addNode("b4_f3_door_corr_303", 3, 4, 39.4, -30.3, "door", "Дверь в южный проход 3 эт.");
        g.addNode("b4_f3_c_406_303", 3, 4, 40.6, -30.3, "corridor", "Проход у ЛК№1 (Эт.3)");
        g.addNode("b4_f3_c_435_303", 3, 4, 43.5, -30.3, "corridor", "Проход у 310 (Эт.3)");
        g.addNode("b4_f3_door_301_w", 3, 4, 39.4, -48.9, "door", "Западный вход 301");
        g.addNode("room_4_3_237", 3, 4, 48.8, -48.7, "room", "301");
        g.addNode("b4_f3_door_301_e", 3, 4, 58.4, -48.9, "door", "Восточный выход 301");
        g.addNode("b4_f3_vest_lk3", 3, 4, 60.1, -48.9, "corridor", "Тамбур ЛК№3 (Эт.3)");
        g.addNode("door_mid_room_4_3_239", 3, 4, 39.4, -44.3, "door", "Дверь 303");
        g.addNode("room_4_3_239", 3, 4, 44.2, -45.2, "room", "303");
        g.addNode("b4_f3_door_303_302", 3, 4, 47.7, -44.8, "door", "Дверь 303-302");
        g.addNode("room_4_3_238", 3, 4, 51.9, -45.6, "room", "302");
        g.addNode("b4_f3_door_hall_305", 3, 4, 39.4, -42.5, "door", "Дверь в холл 305");
        g.addNode("b4_f3_c_440_425", 3, 4, 44, -42.5, "corridor", "Холл перед 305");
        g.addNode("b4_f3_door_305", 3, 4, 45.4, -42.5, "door", "Дверь 305");
        g.addNode("room_4_3_240", 3, 4, 47.2, -41.5, "room", "305");
        g.addNode("b4_f3_door_wc_n", 3, 4, 39.4, -40.7, "door", "Дверь С/у (сев)");
        g.addNode("b4_f3_wc_n_in", 3, 4, 40.5, -40.9, "corridor", "Вход С/у (сев)");
        g.addNode("b4_f3_door_wc_n_inner", 3, 4, 41.5, -40.9, "door", "Внутр. дверь С/у (сев)");
        g.addNode("room_4_3_244", 3, 4, 42.3, -40.5, "room", "С/у");
        g.addNode("b4_f3_door_wc_s", 3, 4, 39.4, -37.8, "door", "Дверь С/у (юг)");
        g.addNode("b4_f3_wc_s_in", 3, 4, 40.5, -37.8, "corridor", "Вход С/у (юг)");
        g.addNode("b4_f3_door_wc_s_inner", 3, 4, 41.5, -37.8, "door", "Внутр. дверь С/у (юг)");
        g.addNode("room_4_3_245", 3, 4, 42.3, -38.3, "room", "С/у");
        g.addNode("b4_f3_door_ante_312", 3, 4, 45.4, -30.3, "door", "Дверь в предбанник 312");
        g.addNode("b4_f3_ante_312_s", 3, 4, 46.15, -30.3, "corridor", "Предбанник 312 (юг)");
        g.addNode("b4_f3_ante_312_n", 3, 4, 46.15, -32.2, "corridor", "Предбанник 312 (север)");
        g.addNode("door_mid_room_4_3_241", 3, 4, 46.15, -32.9, "door", "Дверь 312");
        g.addNode("room_4_3_241", 3, 4, 47.2, -36.1, "room", "312");
        g.addNode("b4_f3_door_310", 3, 4, 43.5, -29.6, "door", "Дверь 310");
        g.addNode("room_4_3_243", 3, 4, 43.9, -28.5, "room", "310");
        g.addNode("b4_f3_door_311", 3, 4, 45.4, -28.5, "door", "Дверь 311");
        g.addNode("room_4_3_242", 3, 4, 47.2, -28.4, "room", "311");
        g.addNode("room_4_3_246", 3, 4, 34.2, -44.2, "room", "306");
        g.addNode("door_room_room_4_3_246", 3, 4, 36, -42.6, "door", "Дверь 306");
        g.addNode("room_4_3_247", 3, 4, 34.2, -39.4, "room", "304");
        g.addNode("door_mid_room_4_3_247", 3, 4, 36, -38.3, "door", "Дверь 304");
        g.addNode("room_4_3_248", 3, 4, 34.2, -34.7, "room", "308");
        g.addNode("door_mid_room_4_3_248", 3, 4, 36, -33.4, "door", "Дверь 308");
        g.addNode("room_4_3_249", 3, 4, 34.2, -29.8, "room", "309");
        g.addNode("door_mid_room_4_3_249", 3, 4, 36, -31.1, "door", "Дверь 309");

        // 2. РЁБРА (СВЯЗИ)
        g.addEdge("b1_f5_nc_-6.0", "b1_f5_nc_door_-5.8", 0.2);
        g.addEdge("b1_f5_nc_door_-5.8", "b1_f5_nc_-3.0", 2.9);
        g.addEdge("b1_f5_nc_-3.0", "b1_f5_nc_0.0", 3);
        g.addEdge("b1_f5_nc_-3.0", "b1_f5_wc_-3.0", 2.8);
        g.addEdge("b1_f5_nc_0.0", "b1_f5_nc_3.0", 3);
        g.addEdge("b1_f5_nc_0.0", "door_corr_room_1_5_61", 0.4);
        g.addEdge("b1_f5_nc_3.0", "b1_f5_nc_5.9", 2.9);
        g.addEdge("b1_f5_nc_3.0", "door_corr_room_1_5_62", 2.5);
        g.addEdge("b1_f5_nc_5.9", "b1_f5_nc_9.4", 3.5);
        g.addEdge("b1_f5_nc_5.9", "door_corr_room_1_5_56", 1.5);
        g.addEdge("b1_f5_nc_9.4", "b1_f5_nc_12.5", 3.1);
        g.addEdge("b1_f5_nc_9.4", "b1_f5_stair_lk1", 3.9);
        g.addEdge("b1_f5_nc_9.4", "door_corr_room_1_5_58", 1.6);
        g.addEdge("b1_f5_nc_9.4", "door_corr_room_1_5_63", 1.5);
        g.addEdge("b1_f5_nc_12.5", "b1_f5_nc_16.0", 3.1);
        g.addEdge("b1_f5_wc_-3.0", "b1_f5_wc_0.0", 3);
        g.addEdge("b1_f5_wc_-3.0", "door_corr_room_1_5_64", 2.8);
        g.addEdge("b1_f5_wc_0.0", "b1_f5_wc_1.7", 1.7);
        g.addEdge("b1_f5_wc_1.7", "b1_f5_wc_3.5", 1.8);
        g.addEdge("b1_f5_wc_1.7", "b1_f5_elev", 4.8);
        g.addEdge("b1_f5_wc_1.7", "door_corr_room_1_5_60", 1.4);
        g.addEdge("b1_f5_wc_3.5", "b1_f5_wc_6.0", 2.5);
        g.addEdge("b1_f5_wc_3.5", "door_corr_room_1_5_65", 2.5);
        g.addEdge("b1_f5_wc_6.0", "b1_f5_sc_0.0", 3);
        g.addEdge("b1_f5_wc_6.0", "door_corr_room_1_5_66", 1.3);
        g.addEdge("b1_f5_sc_0.0", "b1_f5_sc_1.8", 1.8);
        g.addEdge("b1_f5_sc_0.0", "door_corr_room_1_5_67", 0.9);
        g.addEdge("b1_f5_sc_1.8", "b1_f5_sc_3.5", 1.7);
        g.addEdge("b1_f5_sc_3.5", "b1_f5_sc_5.6", 2.1);
        g.addEdge("b1_f5_sc_5.6", "b1_f5_sc_9.4", 3.8);
        g.addEdge("b1_f5_sc_5.6", "door_corr_room_1_5_57", 1.6);
        g.addEdge("b1_f5_sc_9.4", "b1_f5_sc_10.5", 1.1);
        g.addEdge("b1_f5_sc_9.4", "b1_f5_stair_lk2", 4.1);
        g.addEdge("b1_f5_sc_9.4", "door_corr_room_1_5_59", 1.8);
        g.addEdge("b1_f5_stair_lk1", "b1_f6_stair_lk1", 5.5);
        g.addEdge("b1_f5_stair_lk1", "b1_f4_stair_lk1", 5.5);
        g.addEdge("b1_f5_stair_lk2", "b1_f6_stair_lk2", 5.5);
        g.addEdge("b1_f5_stair_lk2", "b1_f4_stair_lk2", 5.5);
        g.addEdge("b1_f5_elev", "b1_f6_elev", 4, true, { isElevator: true });
        g.addEdge("b1_f5_elev", "b1_f4_elev", 4, true, { isElevator: true });
        g.addEdge("b1_f6_nc_-6.0", "b1_f6_nc_door_-5.8", 0.2);
        g.addEdge("b1_f6_nc_door_-5.8", "b1_f6_nc_-3.0", 2.9);
        g.addEdge("b1_f6_nc_-3.0", "b1_f6_nc_0.0", 3);
        g.addEdge("b1_f6_nc_-3.0", "b1_f6_wc_-3.0", 2.8);
        g.addEdge("b1_f6_nc_0.0", "b1_f6_nc_3.0", 3);
        g.addEdge("b1_f6_nc_0.0", "door_corr_room_1_6_73", 0.4);
        g.addEdge("b1_f6_nc_3.0", "b1_f6_nc_5.9", 2.9);
        g.addEdge("b1_f6_nc_3.0", "door_corr_room_1_6_74", 2.5);
        g.addEdge("b1_f6_nc_5.9", "b1_f6_nc_9.4", 3.5);
        g.addEdge("b1_f6_nc_5.9", "door_corr_room_1_6_68", 1.5);
        g.addEdge("b1_f6_nc_9.4", "b1_f6_nc_12.5", 3.1);
        g.addEdge("b1_f6_nc_9.4", "b1_f6_stair_lk1", 3.9);
        g.addEdge("b1_f6_nc_9.4", "door_corr_room_1_6_70", 1.6);
        g.addEdge("b1_f6_nc_9.4", "door_corr_room_1_6_75", 1.5);
        g.addEdge("b1_f6_nc_12.5", "b1_f6_nc_16.0", 3.1);
        g.addEdge("b1_f6_wc_-3.0", "b1_f6_wc_0.0", 3);
        g.addEdge("b1_f6_wc_-3.0", "door_corr_room_1_6_76", 2.8);
        g.addEdge("b1_f6_wc_0.0", "b1_f6_wc_1.7", 1.7);
        g.addEdge("b1_f6_wc_1.7", "b1_f6_wc_3.5", 1.8);
        g.addEdge("b1_f6_wc_1.7", "b1_f6_elev", 4.8);
        g.addEdge("b1_f6_wc_1.7", "door_corr_room_1_6_72", 1.4);
        g.addEdge("b1_f6_wc_3.5", "b1_f6_wc_6.0", 2.5);
        g.addEdge("b1_f6_wc_3.5", "door_corr_room_1_6_77", 2.5);
        g.addEdge("b1_f6_wc_6.0", "b1_f6_sc_0.0", 3);
        g.addEdge("b1_f6_wc_6.0", "door_corr_room_1_6_78", 1.3);
        g.addEdge("b1_f6_sc_0.0", "b1_f6_sc_1.8", 1.8);
        g.addEdge("b1_f6_sc_0.0", "door_corr_room_1_6_79", 0.9);
        g.addEdge("b1_f6_sc_1.8", "b1_f6_sc_3.5", 1.7);
        g.addEdge("b1_f6_sc_3.5", "b1_f6_sc_5.6", 2.1);
        g.addEdge("b1_f6_sc_5.6", "b1_f6_sc_9.4", 3.8);
        g.addEdge("b1_f6_sc_5.6", "door_corr_room_1_6_69", 1.6);
        g.addEdge("b1_f6_sc_9.4", "b1_f6_sc_10.5", 1.1);
        g.addEdge("b1_f6_sc_9.4", "b1_f6_stair_lk2", 4.1);
        g.addEdge("b1_f6_sc_9.4", "door_corr_room_1_6_71", 1.8);
        g.addEdge("b1_f6_sc_9.4", "door_corr_room_1_6_80", 0.9);
        g.addEdge("b1_f6_stair_lk1", "b1_f7_stair_lk1", 5.5);
        g.addEdge("b1_f6_stair_lk2", "b1_f7_stair_lk2", 5.5);
        g.addEdge("b1_f6_elev", "b1_f7_elev", 4, true, { isElevator: true });
        g.addEdge("b1_f7_nc_-6.0", "b1_f7_nc_door_-5.8", 0.2);
        g.addEdge("b1_f7_nc_door_-5.8", "b1_f7_nc_-3.0", 2.9);
        g.addEdge("b1_f7_nc_-3.0", "b1_f7_nc_0.0", 3);
        g.addEdge("b1_f7_nc_-3.0", "b1_f7_wc_-3.0", 2.8);
        g.addEdge("b1_f7_nc_-3.0", "door_corr_room_1_7_86", 0.4);
        g.addEdge("b1_f7_nc_0.0", "b1_f7_nc_3.0", 3);
        g.addEdge("b1_f7_nc_0.0", "door_corr_room_1_7_87", 2.6);
        g.addEdge("b1_f7_nc_3.0", "b1_f7_nc_5.9", 2.9);
        g.addEdge("b1_f7_nc_5.9", "b1_f7_nc_9.4", 3.5);
        g.addEdge("b1_f7_nc_5.9", "door_corr_room_1_7_81", 1.5);
        g.addEdge("b1_f7_nc_9.4", "b1_f7_nc_12.5", 3.1);
        g.addEdge("b1_f7_nc_9.4", "b1_f7_stair_lk1", 3.9);
        g.addEdge("b1_f7_nc_9.4", "door_corr_room_1_7_83", 1.6);
        g.addEdge("b1_f7_nc_9.4", "door_corr_room_1_7_88", 1.5);
        g.addEdge("b1_f7_nc_12.5", "b1_f7_nc_16.0", 3.1);
        g.addEdge("b1_f7_wc_-3.0", "b1_f7_wc_0.0", 3);
        g.addEdge("b1_f7_wc_-3.0", "door_corr_room_1_7_89", 2.8);
        g.addEdge("b1_f7_wc_0.0", "b1_f7_wc_1.7", 1.7);
        g.addEdge("b1_f7_wc_1.7", "b1_f7_wc_3.5", 1.8);
        g.addEdge("b1_f7_wc_1.7", "b1_f7_elev", 4.8);
        g.addEdge("b1_f7_wc_1.7", "door_corr_room_1_7_85", 1.4);
        g.addEdge("b1_f7_wc_3.5", "b1_f7_wc_6.0", 2.5);
        g.addEdge("b1_f7_wc_3.5", "door_corr_room_1_7_90", 2.4);
        g.addEdge("b1_f7_wc_6.0", "b1_f7_sc_0.0", 3);
        g.addEdge("b1_f7_wc_6.0", "door_corr_room_1_7_91", 1.3);
        g.addEdge("b1_f7_sc_0.0", "b1_f7_sc_1.8", 1.8);
        g.addEdge("b1_f7_sc_0.0", "door_corr_room_1_7_92", 0.9);
        g.addEdge("b1_f7_sc_1.8", "b1_f7_sc_3.5", 1.7);
        g.addEdge("b1_f7_sc_3.5", "b1_f7_sc_5.6", 2.1);
        g.addEdge("b1_f7_sc_5.6", "b1_f7_sc_9.4", 3.8);
        g.addEdge("b1_f7_sc_5.6", "door_corr_room_1_7_82", 1.6);
        g.addEdge("b1_f7_sc_9.4", "b1_f7_sc_10.5", 1.1);
        g.addEdge("b1_f7_sc_9.4", "b1_f7_stair_lk2", 4.1);
        g.addEdge("b1_f7_sc_9.4", "door_corr_room_1_7_84", 1.8);
        g.addEdge("room_1_5_56", "door_room_room_1_5_56", 1.1);
        g.addEdge("door_mid_room_1_5_56", "door_room_room_1_5_56", 0.4);
        g.addEdge("door_mid_room_1_5_56", "door_corr_room_1_5_56", 0.4);
        g.addEdge("room_1_5_57", "door_room_room_1_5_57", 2.3);
        g.addEdge("door_mid_room_1_5_57", "door_room_room_1_5_57", 0.4);
        g.addEdge("door_mid_room_1_5_57", "door_corr_room_1_5_57", 0.4);
        g.addEdge("room_1_5_58", "door_room_room_1_5_58", 1.5);
        g.addEdge("door_mid_room_1_5_58", "door_room_room_1_5_58", 0.4);
        g.addEdge("door_mid_room_1_5_58", "door_corr_room_1_5_58", 0.4);
        g.addEdge("room_1_5_59", "door_room_room_1_5_59", 1.5);
        g.addEdge("door_mid_room_1_5_59", "door_room_room_1_5_59", 0.4);
        g.addEdge("door_mid_room_1_5_59", "door_corr_room_1_5_59", 0.4);
        g.addEdge("room_1_5_60", "door_room_room_1_5_60", 2.6);
        g.addEdge("door_mid_room_1_5_60", "door_room_room_1_5_60", 0.4);
        g.addEdge("door_mid_room_1_5_60", "door_corr_room_1_5_60", 0.4);
        g.addEdge("room_1_5_61", "door_room_room_1_5_61", 5.2);
        g.addEdge("door_mid_room_1_5_61", "door_room_room_1_5_61", 0.4);
        g.addEdge("door_mid_room_1_5_61", "door_corr_room_1_5_61", 0.4);
        g.addEdge("room_1_5_62", "door_room_room_1_5_62", 2.4);
        g.addEdge("door_mid_room_1_5_62", "door_room_room_1_5_62", 0.4);
        g.addEdge("door_mid_room_1_5_62", "door_corr_room_1_5_62", 0.4);
        g.addEdge("room_1_5_63", "door_room_room_1_5_63", 4.5);
        g.addEdge("door_mid_room_1_5_63", "door_room_room_1_5_63", 0.4);
        g.addEdge("door_mid_room_1_5_63", "door_corr_room_1_5_63", 0.4);
        g.addEdge("room_1_5_64", "door_room_room_1_5_64", 3.7);
        g.addEdge("door_mid_room_1_5_64", "door_room_room_1_5_64", 0.4);
        g.addEdge("door_mid_room_1_5_64", "door_corr_room_1_5_64", 0.4);
        g.addEdge("room_1_5_65", "door_room_room_1_5_65", 5.6);
        g.addEdge("door_mid_room_1_5_65", "door_room_room_1_5_65", 0.4);
        g.addEdge("door_mid_room_1_5_65", "door_corr_room_1_5_65", 0.4);
        g.addEdge("room_1_5_66", "door_room_room_1_5_66", 3.2);
        g.addEdge("door_mid_room_1_5_66", "door_room_room_1_5_66", 0.4);
        g.addEdge("door_mid_room_1_5_66", "door_corr_room_1_5_66", 0.4);
        g.addEdge("room_1_5_67", "door_room_room_1_5_67", 6.4);
        g.addEdge("door_mid_room_1_5_67", "door_room_room_1_5_67", 0.4);
        g.addEdge("door_mid_room_1_5_67", "door_corr_room_1_5_67", 0.4);
        g.addEdge("room_1_6_68", "door_room_room_1_6_68", 1.1);
        g.addEdge("door_mid_room_1_6_68", "door_room_room_1_6_68", 0.4);
        g.addEdge("door_mid_room_1_6_68", "door_corr_room_1_6_68", 0.4);
        g.addEdge("room_1_6_69", "door_room_room_1_6_69", 2.3);
        g.addEdge("door_mid_room_1_6_69", "door_room_room_1_6_69", 0.4);
        g.addEdge("door_mid_room_1_6_69", "door_corr_room_1_6_69", 0.4);
        g.addEdge("room_1_6_70", "door_room_room_1_6_70", 1.5);
        g.addEdge("door_mid_room_1_6_70", "door_room_room_1_6_70", 0.4);
        g.addEdge("door_mid_room_1_6_70", "door_corr_room_1_6_70", 0.4);
        g.addEdge("room_1_6_71", "door_room_room_1_6_71", 1.5);
        g.addEdge("door_mid_room_1_6_71", "door_room_room_1_6_71", 0.4);
        g.addEdge("door_mid_room_1_6_71", "door_corr_room_1_6_71", 0.4);
        g.addEdge("room_1_6_72", "door_room_room_1_6_72", 2.6);
        g.addEdge("door_mid_room_1_6_72", "door_room_room_1_6_72", 0.4);
        g.addEdge("door_mid_room_1_6_72", "door_corr_room_1_6_72", 0.4);
        g.addEdge("room_1_6_73", "door_room_room_1_6_73", 5.2);
        g.addEdge("door_mid_room_1_6_73", "door_room_room_1_6_73", 0.4);
        g.addEdge("door_mid_room_1_6_73", "door_corr_room_1_6_73", 0.4);
        g.addEdge("room_1_6_74", "door_room_room_1_6_74", 2.4);
        g.addEdge("door_mid_room_1_6_74", "door_room_room_1_6_74", 0.4);
        g.addEdge("door_mid_room_1_6_74", "door_corr_room_1_6_74", 0.4);
        g.addEdge("room_1_6_75", "door_room_room_1_6_75", 4.5);
        g.addEdge("door_mid_room_1_6_75", "door_room_room_1_6_75", 0.4);
        g.addEdge("door_mid_room_1_6_75", "door_corr_room_1_6_75", 0.4);
        g.addEdge("room_1_6_76", "door_room_room_1_6_76", 3.7);
        g.addEdge("door_mid_room_1_6_76", "door_room_room_1_6_76", 0.4);
        g.addEdge("door_mid_room_1_6_76", "door_corr_room_1_6_76", 0.4);
        g.addEdge("room_1_6_77", "door_room_room_1_6_77", 5.6);
        g.addEdge("door_mid_room_1_6_77", "door_room_room_1_6_77", 0.4);
        g.addEdge("door_mid_room_1_6_77", "door_corr_room_1_6_77", 0.4);
        g.addEdge("room_1_6_78", "door_room_room_1_6_78", 3.2);
        g.addEdge("door_mid_room_1_6_78", "door_room_room_1_6_78", 0.4);
        g.addEdge("door_mid_room_1_6_78", "door_corr_room_1_6_78", 0.4);
        g.addEdge("room_1_6_79", "door_room_room_1_6_79", 4.8);
        g.addEdge("door_mid_room_1_6_79", "door_room_room_1_6_79", 0.4);
        g.addEdge("door_mid_room_1_6_79", "door_corr_room_1_6_79", 0.4);
        g.addEdge("room_1_6_80", "door_room_room_1_6_80", 3.3);
        g.addEdge("door_mid_room_1_6_80", "door_room_room_1_6_80", 0.4);
        g.addEdge("door_mid_room_1_6_80", "door_corr_room_1_6_80", 0.4);
        g.addEdge("room_1_7_81", "door_room_room_1_7_81", 1.1);
        g.addEdge("door_mid_room_1_7_81", "door_room_room_1_7_81", 0.4);
        g.addEdge("door_mid_room_1_7_81", "door_corr_room_1_7_81", 0.4);
        g.addEdge("room_1_7_82", "door_room_room_1_7_82", 2.3);
        g.addEdge("door_mid_room_1_7_82", "door_room_room_1_7_82", 0.4);
        g.addEdge("door_mid_room_1_7_82", "door_corr_room_1_7_82", 0.4);
        g.addEdge("room_1_7_83", "door_room_room_1_7_83", 1.5);
        g.addEdge("door_mid_room_1_7_83", "door_room_room_1_7_83", 0.4);
        g.addEdge("door_mid_room_1_7_83", "door_corr_room_1_7_83", 0.4);
        g.addEdge("room_1_7_84", "door_room_room_1_7_84", 1.5);
        g.addEdge("door_mid_room_1_7_84", "door_room_room_1_7_84", 0.4);
        g.addEdge("door_mid_room_1_7_84", "door_corr_room_1_7_84", 0.4);
        g.addEdge("room_1_7_85", "door_room_room_1_7_85", 2.6);
        g.addEdge("door_mid_room_1_7_85", "door_room_room_1_7_85", 0.4);
        g.addEdge("door_mid_room_1_7_85", "door_corr_room_1_7_85", 0.4);
        g.addEdge("room_1_7_86", "door_room_room_1_7_86", 5.1);
        g.addEdge("door_mid_room_1_7_86", "door_room_room_1_7_86", 0.4);
        g.addEdge("door_mid_room_1_7_86", "door_corr_room_1_7_86", 0.4);
        g.addEdge("room_1_7_87", "door_room_room_1_7_87", 2.2);
        g.addEdge("door_mid_room_1_7_87", "door_room_room_1_7_87", 0.4);
        g.addEdge("door_mid_room_1_7_87", "door_corr_room_1_7_87", 0.4);
        g.addEdge("room_1_7_88", "door_room_room_1_7_88", 4.5);
        g.addEdge("door_mid_room_1_7_88", "door_room_room_1_7_88", 0.4);
        g.addEdge("door_mid_room_1_7_88", "door_corr_room_1_7_88", 0.4);
        g.addEdge("room_1_7_89", "door_room_room_1_7_89", 3.7);
        g.addEdge("door_mid_room_1_7_89", "door_room_room_1_7_89", 0.4);
        g.addEdge("door_mid_room_1_7_89", "door_corr_room_1_7_89", 0.4);
        g.addEdge("room_1_7_90", "door_room_room_1_7_90", 5.4);
        g.addEdge("door_mid_room_1_7_90", "door_room_room_1_7_90", 0.4);
        g.addEdge("door_mid_room_1_7_90", "door_corr_room_1_7_90", 0.4);
        g.addEdge("room_1_7_91", "door_room_room_1_7_91", 3.2);
        g.addEdge("door_mid_room_1_7_91", "door_room_room_1_7_91", 0.4);
        g.addEdge("door_mid_room_1_7_91", "door_corr_room_1_7_91", 0.4);
        g.addEdge("room_1_7_92", "door_room_room_1_7_92", 4.5);
        g.addEdge("door_mid_room_1_7_92", "door_room_room_1_7_92", 0.4);
        g.addEdge("door_mid_room_1_7_92", "door_corr_room_1_7_92", 0.4);
        g.addEdge("b1_f3_nc_-3.0", "b1_f3_nc_0.0", 3);
        g.addEdge("b1_f3_nc_-3.0", "b1_f3_wc_-3.0", 2.8);
        g.addEdge("b1_f3_nc_0.0", "b1_f3_nc_3.0", 3);
        g.addEdge("b1_f3_nc_0.0", "door_corr_room_1_3_36", 0.4);
        g.addEdge("b1_f3_nc_3.0", "b1_f3_nc_5.9", 2.9);
        g.addEdge("b1_f3_nc_5.9", "door_corr_room_1_3_31", 1.5);
        g.addEdge("b1_f3_nc_5.9", "door_corr_room_1_3_38", 2);
        g.addEdge("b1_f3_nc_5.9", "b1_f3_nc_9.4", 3.5);
        g.addEdge("b1_f3_nc_9.4", "b1_f3_nc_12.5", 3.1);
        g.addEdge("b1_f3_nc_9.4", "b1_f3_stair_lk1", 3.9);
        g.addEdge("b1_f3_nc_12.5", "b1_f3_nc_16.0", 3.1);
        g.addEdge("b1_f3_nc_16.0", "door_corr_room_1_3_39", 0.8);
        g.addEdge("b1_f3_wc_-3.0", "b1_f3_wc_0.0", 3);
        g.addEdge("b1_f3_wc_-3.0", "door_corr_room_1_3_40", 2.8);
        g.addEdge("b1_f3_wc_0.0", "b1_f3_wc_1.7", 1.7);
        g.addEdge("b1_f3_wc_1.7", "b1_f3_wc_3.5", 1.8);
        g.addEdge("b1_f3_wc_1.7", "b1_f3_elev", 4.8);
        g.addEdge("b1_f3_wc_1.7", "door_corr_room_1_3_35", 1.4);
        g.addEdge("b1_f3_wc_3.5", "b1_f3_wc_6.0", 2.5);
        g.addEdge("b1_f3_wc_3.5", "door_corr_room_1_3_41", 2.5);
        g.addEdge("b1_f3_wc_6.0", "b1_f3_sc_0.0", 3);
        g.addEdge("b1_f3_wc_6.0", "door_corr_room_1_3_42", 1.3);
        g.addEdge("b1_f3_sc_0.0", "b1_f3_sc_1.8", 1.8);
        g.addEdge("b1_f3_sc_0.0", "door_corr_room_1_3_43", 0.9);
        g.addEdge("b1_f3_sc_1.8", "b1_f3_sc_3.5", 1.7);
        g.addEdge("b1_f3_sc_3.5", "b1_f3_sc_5.6", 2.1);
        g.addEdge("b1_f3_sc_5.6", "b1_f3_sc_9.4", 3.8);
        g.addEdge("b1_f3_sc_5.6", "door_corr_room_1_3_32", 1.6);
        g.addEdge("b1_f3_sc_9.4", "b1_f3_sc_10.5", 1.1);
        g.addEdge("b1_f3_sc_9.4", "b1_f3_stair_lk2", 4.1);
        g.addEdge("b1_f3_sc_9.4", "door_corr_room_1_3_34", 1.8);
        g.addEdge("b1_f3_stair_lk1", "room_1_3_33", 0.2);
        g.addEdge("b1_f3_stair_lk1", "b1_f4_stair_lk1", 5.5);
        g.addEdge("b1_f3_stair_lk1", "b1_f2_stair_lk1", 5.5);
        g.addEdge("b1_f3_stair_lk2", "b1_f4_stair_lk2", 5.5);
        g.addEdge("b1_f3_stair_lk2", "b1_f2_stair_lk2", 5.5);
        g.addEdge("b1_f3_elev", "b1_f4_elev", 4, true, { isElevator: true });
        g.addEdge("b1_f3_elev", "b1_f2_elev", 4, true, { isElevator: true });
        g.addEdge("b2_f3_c_22.6", "b2_f3_c_26.0", 1.6);
        g.addEdge("b2_f3_c_22.6", "b2_f3_d_308", 0.8);
        g.addEdge("b2_f3_d_308", "b2_f3_c_308_hall", 1.2);
        g.addEdge("b2_f3_c_308_hall", "door_corr_room_2_3_123", 2.6);
        g.addEdge("b2_f3_c_308_hall", "room_2_3_135", 7.5);
        g.addEdge("b2_f3_c_26.0", "b2_f3_c_30.0", 4);
        g.addEdge("b2_f3_c_26.0", "door_corr_room_2_3_124", 1.6);
        g.addEdge("b2_f3_c_30.0", "b2_f3_c_34.0", 4);
        g.addEdge("b2_f3_c_30.0", "door_corr_room_2_3_125", 1.1);
        g.addEdge("b2_f3_c_34.0", "b2_f3_c_37.5", 3.5);
        g.addEdge("b2_f3_c_34.0", "door_corr_room_2_3_126", 1);
        g.addEdge("b2_f3_c_37.5", "b2_f3_c_41.0", 3.5);
        g.addEdge("b2_f3_c_37.5", "door_corr_room_2_3_127", 1.1);
        g.addEdge("b2_f3_c_37.5", "door_corr_room_2_3_135", 1.5);
        g.addEdge("b2_f3_c_41.0", "b2_f3_c_43.6", 2.6);
        g.addEdge("b2_f3_c_41.0", "door_corr_room_2_3_128", 1.7);
        g.addEdge("b2_f3_c_41.0", "door_corr_room_2_3_129", 1);
        g.addEdge("b2_f3_c_43.6", "b2_f3_c_47.0", 3.4);
        g.addEdge("b2_f3_c_43.6", "b2_f3_stair_lk2", 4.7);
        g.addEdge("b2_f3_c_43.6", "door_corr_room_2_3_130", 1.6);
        g.addEdge("b2_f3_c_47.0", "b2_f3_c_51.0", 4);
        g.addEdge("b2_f3_c_47.0", "door_corr_room_2_3_136", 1);
        g.addEdge("b2_f3_c_51.0", "b2_f3_c_55.0", 4);
        g.addEdge("b2_f3_c_51.0", "door_corr_room_2_3_131", 1.2);
        g.addEdge("b2_f3_c_55.0", "b2_f3_c_59.0", 4);
        g.addEdge("b2_f3_c_59.0", "b2_f3_c_63.0", 4);
        g.addEdge("b2_f3_c_59.0", "door_corr_room_2_3_132", 2.1);
        g.addEdge("b2_f3_c_63.0", "b2_f3_c_66.1", 3.1);
        g.addEdge("b2_f3_c_63.0", "door_corr_room_2_3_133", 1.1);
        g.addEdge("b2_f3_c_63.0", "door_corr_room_2_3_134", 0.8);
        g.addEdge("b2_f3_c_63.0", "door_corr_room_2_3_137", 1.2);
        g.addEdge("b2_f3_c_66.1", "b2_f3_stair_lk1", 4.7);
        g.addEdge("b2_f3_c_66.1", "door_mid_room_2_3_134", 1.9);
        g.addEdge("b2_f3_c_66.1", "custom_b2_f3_c_670_-58_0u0", 0.9);
        g.addEdge("b2_f3_stair_lk1", "b2_f2_stair_lk1", 5.5);
        g.addEdge("b2_f3_stair_lk2", "b2_f2_stair_lk2", 5.5);
        g.addEdge("room_1_3_31", "door_room_room_1_3_31", 1.1);
        g.addEdge("door_mid_room_1_3_31", "door_room_room_1_3_31", 0.4);
        g.addEdge("door_mid_room_1_3_31", "door_corr_room_1_3_31", 0.4);
        g.addEdge("room_1_3_32", "door_room_room_1_3_32", 2.3);
        g.addEdge("door_mid_room_1_3_32", "door_room_room_1_3_32", 0.4);
        g.addEdge("door_mid_room_1_3_32", "door_corr_room_1_3_32", 0.4);
        g.addEdge("room_1_3_33", "door_room_room_1_3_33", 1.5);
        g.addEdge("door_mid_room_1_3_33", "door_room_room_1_3_33", 0.4);
        g.addEdge("door_mid_room_1_3_33", "custom_b1_f3_c_96_-47_h5d", 0.9);
        g.addEdge("room_1_3_34", "door_room_room_1_3_34", 1.5);
        g.addEdge("door_mid_room_1_3_34", "door_room_room_1_3_34", 0.4);
        g.addEdge("door_mid_room_1_3_34", "door_corr_room_1_3_34", 0.4);
        g.addEdge("room_1_3_35", "door_room_room_1_3_35", 2.6);
        g.addEdge("door_mid_room_1_3_35", "door_room_room_1_3_35", 0.4);
        g.addEdge("door_mid_room_1_3_35", "door_corr_room_1_3_35", 0.4);
        g.addEdge("room_1_3_36", "door_room_room_1_3_36", 5.2);
        g.addEdge("door_mid_room_1_3_36", "door_room_room_1_3_36", 0.4);
        g.addEdge("door_mid_room_1_3_36", "door_corr_room_1_3_36", 0.4);
        g.addEdge("door_room_room_1_3_36", "custom_b1_f3_c_-5_-73_y4d", 0.7);
        g.addEdge("room_1_3_37", "door_room_room_1_3_37", 2.4);
        g.addEdge("door_mid_room_1_3_37", "door_room_room_1_3_37", 0.4);
        g.addEdge("door_mid_room_1_3_37", "door_corr_room_1_3_37", 0.4);
        g.addEdge("door_corr_room_1_3_37", "custom_b1_f3_c_35_-74_vve", 0.8);
        g.addEdge("room_1_3_38", "custom_b1_f3_d_79_-70_b05", 4.2);
        g.addEdge("door_mid_room_1_3_38", "custom_b1_f3_d_79_-70_b05", 0.8);
        g.addEdge("door_mid_room_1_3_38", "door_corr_room_1_3_38", 0.4);
        g.addEdge("door_corr_room_1_3_39", "door_mid_room_1_3_39", 0.4);
        g.addEdge("door_mid_room_1_3_39", "door_room_room_1_3_39", 0.4);
        g.addEdge("door_room_room_1_3_39", "room_1_3_39", 1.9);
        g.addEdge("room_1_3_40", "door_room_room_1_3_40", 3.7);
        g.addEdge("door_mid_room_1_3_40", "door_room_room_1_3_40", 0.4);
        g.addEdge("door_mid_room_1_3_40", "door_corr_room_1_3_40", 0.4);
        g.addEdge("room_1_3_41", "door_room_room_1_3_41", 5.6);
        g.addEdge("door_mid_room_1_3_41", "door_room_room_1_3_41", 0.4);
        g.addEdge("door_mid_room_1_3_41", "door_corr_room_1_3_41", 0.4);
        g.addEdge("room_1_3_42", "door_room_room_1_3_42", 3.2);
        g.addEdge("door_mid_room_1_3_42", "door_room_room_1_3_42", 0.4);
        g.addEdge("door_mid_room_1_3_42", "door_corr_room_1_3_42", 0.4);
        g.addEdge("room_1_3_43", "door_room_room_1_3_43", 6.4);
        g.addEdge("door_mid_room_1_3_43", "door_room_room_1_3_43", 0.4);
        g.addEdge("door_mid_room_1_3_43", "door_corr_room_1_3_43", 0.4);
        g.addEdge("room_2_3_123", "door_room_room_2_3_123", 4.4);
        g.addEdge("door_mid_room_2_3_123", "door_room_room_2_3_123", 0.4);
        g.addEdge("door_mid_room_2_3_123", "door_corr_room_2_3_123", 0.4);
        g.addEdge("door_corr_room_2_3_123", "room_2_3_135", 9.9);
        g.addEdge("room_2_3_124", "door_room_room_2_3_124", 2.9);
        g.addEdge("door_mid_room_2_3_124", "door_room_room_2_3_124", 0.4);
        g.addEdge("door_mid_room_2_3_124", "door_corr_room_2_3_124", 0.4);
        g.addEdge("room_2_3_125", "door_room_room_2_3_125", 2.9);
        g.addEdge("door_mid_room_2_3_125", "door_room_room_2_3_125", 0.4);
        g.addEdge("door_mid_room_2_3_125", "door_corr_room_2_3_125", 0.4);
        g.addEdge("room_2_3_126", "door_room_room_2_3_126", 2.9);
        g.addEdge("door_mid_room_2_3_126", "door_room_room_2_3_126", 0.4);
        g.addEdge("door_mid_room_2_3_126", "door_corr_room_2_3_126", 0.4);
        g.addEdge("room_2_3_127", "door_room_room_2_3_127", 2.9);
        g.addEdge("door_mid_room_2_3_127", "door_room_room_2_3_127", 0.4);
        g.addEdge("door_mid_room_2_3_127", "door_corr_room_2_3_127", 0.4);
        g.addEdge("room_2_3_128", "door_room_room_2_3_128", 0.3);
        g.addEdge("door_mid_room_2_3_128", "door_room_room_2_3_128", 0.4);
        g.addEdge("door_mid_room_2_3_128", "door_corr_room_2_3_128", 0.4);
        g.addEdge("room_2_3_129", "door_room_room_2_3_129", 0.3);
        g.addEdge("door_mid_room_2_3_129", "door_room_room_2_3_129", 0.4);
        g.addEdge("door_mid_room_2_3_129", "door_corr_room_2_3_129", 0.4);
        g.addEdge("room_2_3_130", "door_room_room_2_3_130", 5.1);
        g.addEdge("door_mid_room_2_3_130", "door_room_room_2_3_130", 0.4);
        g.addEdge("door_mid_room_2_3_130", "door_corr_room_2_3_130", 0.4);
        g.addEdge("room_2_3_131", "door_room_room_2_3_131", 2.9);
        g.addEdge("door_mid_room_2_3_131", "door_room_room_2_3_131", 0.4);
        g.addEdge("door_mid_room_2_3_131", "door_corr_room_2_3_131", 0.4);
        g.addEdge("room_2_3_132", "door_room_room_2_3_132", 3);
        g.addEdge("door_mid_room_2_3_132", "door_room_room_2_3_132", 0.4);
        g.addEdge("door_mid_room_2_3_132", "door_corr_room_2_3_132", 0.4);
        g.addEdge("room_2_3_133", "door_room_room_2_3_133", 2.9);
        g.addEdge("door_mid_room_2_3_133", "door_room_room_2_3_133", 0.4);
        g.addEdge("door_mid_room_2_3_133", "door_corr_room_2_3_133", 0.4);
        g.addEdge("room_2_3_134", "door_mid_room_2_3_134", 6.9);
        g.addEdge("door_mid_room_2_3_134", "door_corr_room_2_3_134", 0.4);
        g.addEdge("room_2_3_135", "door_room_room_2_3_135", 6.4);
        g.addEdge("door_mid_room_2_3_135", "door_room_room_2_3_135", 0.4);
        g.addEdge("door_mid_room_2_3_135", "door_corr_room_2_3_135", 0.4);
        g.addEdge("room_2_3_136", "door_room_room_2_3_136", 3.7);
        g.addEdge("door_mid_room_2_3_136", "door_room_room_2_3_136", 0.4);
        g.addEdge("door_mid_room_2_3_136", "door_corr_room_2_3_136", 0.4);
        g.addEdge("room_2_3_137", "door_room_room_2_3_137", 4.6);
        g.addEdge("door_mid_room_2_3_137", "door_room_room_2_3_137", 0.4);
        g.addEdge("door_mid_room_2_3_137", "door_corr_room_2_3_137", 0.4);
        g.addEdge("room_2_3_138", "door_room_room_2_3_138", 0.5);
        g.addEdge("door_mid_room_2_3_138", "door_room_room_2_3_138", 0.4);
        g.addEdge("door_mid_room_2_3_138", "custom_b2_f3_c_670_-26_1py", 1);
        g.addEdge("custom_b1_f3_c_36_-115_ux1", "custom_b1_f3_c_35_-74_vve", 4.1);
        g.addEdge("custom_b1_f3_c_35_-74_vve", "custom_b1_f3_c_-5_-73_y4d", 4);
        g.addEdge("custom_b1_f3_c_35_-74_vve", "custom_b1_f3_d_79_-70_b05", 4.4);
        g.addEdge("door_corr_room_1_3_38", "custom_b1_f3_c_96_-47_h5d", 2);
        g.addEdge("custom_b2_f3_c_670_-58_0u0", "custom_b2_f3_c_670_-26_1py", 3.2);
        g.addEdge("b1_f4_nc_-6.0", "b1_f4_nc_door_-5.8", 0.2);
        g.addEdge("b1_f4_nc_door_-5.8", "b1_f4_nc_-3.0", 2.9);
        g.addEdge("b1_f4_nc_-3.0", "b1_f4_nc_0.0", 3);
        g.addEdge("b1_f4_nc_-3.0", "b1_f4_wc_-3.0", 2.8);
        g.addEdge("b1_f4_nc_0.0", "b1_f4_nc_3.0", 3);
        g.addEdge("b1_f4_nc_0.0", "door_corr_room_1_4_49", 0.4);
        g.addEdge("b1_f4_nc_3.0", "b1_f4_nc_5.9", 2.9);
        g.addEdge("b1_f4_nc_5.9", "b1_f4_nc_9.4", 3.5);
        g.addEdge("b1_f4_nc_5.9", "door_corr_room_1_4_44", 1.5);
        g.addEdge("b1_f4_nc_9.4", "b1_f4_nc_12.5", 3.1);
        g.addEdge("b1_f4_nc_9.4", "b1_f4_stair_lk1", 3.9);
        g.addEdge("b1_f4_nc_9.4", "door_corr_room_1_4_46", 1.6);
        g.addEdge("b1_f4_nc_9.4", "door_corr_room_1_4_51", 1.5);
        g.addEdge("b1_f4_nc_12.5", "b1_f4_nc_16.0", 3.1);
        g.addEdge("b1_f4_wc_-3.0", "b1_f4_wc_0.0", 3);
        g.addEdge("b1_f4_wc_-3.0", "door_corr_room_1_4_52", 2.5);
        g.addEdge("b1_f4_wc_0.0", "b1_f4_wc_1.7", 1.7);
        g.addEdge("b1_f4_wc_1.7", "b1_f4_wc_3.5", 1.8);
        g.addEdge("b1_f4_wc_1.7", "b1_f4_elev", 4.8);
        g.addEdge("b1_f4_wc_1.7", "door_corr_room_1_4_48", 1.4);
        g.addEdge("b1_f4_wc_1.7", "door_corr_room_1_4_53", 2.4);
        g.addEdge("b1_f4_wc_3.5", "b1_f4_wc_6.0", 2.5);
        g.addEdge("b1_f4_wc_6.0", "b1_f4_sc_0.0", 3);
        g.addEdge("b1_f4_wc_6.0", "door_corr_room_1_4_54", 2.4);
        g.addEdge("b1_f4_wc_6.0", "door_corr_room_1_4_55", 1.6);
        g.addEdge("b1_f4_sc_0.0", "b1_f4_sc_1.8", 1.8);
        g.addEdge("b1_f4_sc_1.8", "b1_f4_sc_3.5", 1.7);
        g.addEdge("b1_f4_sc_3.5", "b1_f4_sc_5.6", 2.1);
        g.addEdge("b1_f4_sc_5.6", "b1_f4_sc_9.4", 3.8);
        g.addEdge("b1_f4_sc_5.6", "door_corr_room_1_4_45", 1.6);
        g.addEdge("b1_f4_sc_9.4", "b1_f4_sc_10.5", 1.1);
        g.addEdge("b1_f4_sc_9.4", "b1_f4_stair_lk2", 4.1);
        g.addEdge("b1_f4_sc_9.4", "door_corr_room_1_4_47", 1.8);
        g.addEdge("room_1_4_44", "door_room_room_1_4_44", 1.1);
        g.addEdge("door_mid_room_1_4_44", "door_room_room_1_4_44", 0.4);
        g.addEdge("door_mid_room_1_4_44", "door_corr_room_1_4_44", 0.4);
        g.addEdge("room_1_4_45", "door_room_room_1_4_45", 2.3);
        g.addEdge("door_mid_room_1_4_45", "door_room_room_1_4_45", 0.4);
        g.addEdge("door_mid_room_1_4_45", "door_corr_room_1_4_45", 0.4);
        g.addEdge("room_1_4_46", "door_room_room_1_4_46", 1.5);
        g.addEdge("door_mid_room_1_4_46", "door_room_room_1_4_46", 0.4);
        g.addEdge("door_mid_room_1_4_46", "door_corr_room_1_4_46", 0.4);
        g.addEdge("room_1_4_47", "door_room_room_1_4_47", 1.5);
        g.addEdge("door_mid_room_1_4_47", "door_room_room_1_4_47", 0.4);
        g.addEdge("door_mid_room_1_4_47", "door_corr_room_1_4_47", 0.4);
        g.addEdge("room_1_4_48", "door_room_room_1_4_48", 2.6);
        g.addEdge("door_mid_room_1_4_48", "door_room_room_1_4_48", 0.4);
        g.addEdge("door_mid_room_1_4_48", "door_corr_room_1_4_48", 0.4);
        g.addEdge("room_1_4_49", "door_room_room_1_4_49", 5.2);
        g.addEdge("door_mid_room_1_4_49", "door_room_room_1_4_49", 0.4);
        g.addEdge("door_mid_room_1_4_49", "door_corr_room_1_4_49", 0.4);
        g.addEdge("door_room_room_1_4_49", "custom_b1_f4_c_-4_-75_ptb", 0.9);
        g.addEdge("room_1_4_50", "door_room_room_1_4_50", 2.4);
        g.addEdge("door_mid_room_1_4_50", "door_room_room_1_4_50", 0.4);
        g.addEdge("door_mid_room_1_4_50", "door_corr_room_1_4_50", 0.4);
        g.addEdge("door_corr_room_1_4_50", "custom_b1_f4_c_33_-75_ydr", 0.8);
        g.addEdge("door_mid_room_1_4_51", "door_corr_room_1_4_51", 0.4);
        g.addEdge("door_mid_room_1_4_51", "custom_b1_f4_c_79_-75_z02", 1.3);
        g.addEdge("room_1_4_52", "door_room_room_1_4_52", 3.7);
        g.addEdge("door_mid_room_1_4_52", "door_room_room_1_4_52", 0.4);
        g.addEdge("door_mid_room_1_4_52", "door_corr_room_1_4_52", 0.4);
        g.addEdge("room_1_4_53", "door_room_room_1_4_53", 3.7);
        g.addEdge("door_mid_room_1_4_53", "door_room_room_1_4_53", 0.4);
        g.addEdge("door_mid_room_1_4_53", "door_corr_room_1_4_53", 0.4);
        g.addEdge("room_1_4_54", "door_room_room_1_4_54", 4.7);
        g.addEdge("door_mid_room_1_4_54", "door_room_room_1_4_54", 0.4);
        g.addEdge("door_mid_room_1_4_54", "door_corr_room_1_4_54", 0.4);
        g.addEdge("room_1_4_55", "door_room_room_1_4_55", 8.3);
        g.addEdge("door_mid_room_1_4_55", "door_room_room_1_4_55", 0.4);
        g.addEdge("door_mid_room_1_4_55", "door_corr_room_1_4_55", 0.4);
        g.addEdge("custom_b1_f4_c_-4_-75_ptb", "custom_b1_f4_c_33_-75_ydr", 3.7);
        g.addEdge("custom_b1_f4_c_33_-75_ydr", "custom_b1_f4_c_79_-75_z02", 4.6);
        g.addEdge("custom_b1_f4_c_33_-75_ydr", "custom_b1_f4_c_33_-111_dfg", 3.6);
        g.addEdge("custom_b1_f4_c_79_-75_z02", "room_1_4_51", 3.8);
        g.addEdge("b1_f2_nc_-3.0", "b1_f2_nc_0.0", 3);
        g.addEdge("b1_f2_nc_-3.0", "b1_f2_wc_-3.0", 2.8);
        g.addEdge("b1_f2_nc_-3.0", "custom_b1_f2_c_-30_-101_xdd", 4.3);
        g.addEdge("b1_f2_nc_0.0", "b1_f2_nc_3.0", 3);
        g.addEdge("b1_f2_nc_3.0", "door_corr_room_1_2_21", 2.9);
        g.addEdge("b1_f2_wc_-3.0", "b1_f2_wc_0.0", 3);
        g.addEdge("b1_f2_wc_0.0", "b1_f2_wc_1.7", 1.7);
        g.addEdge("b1_f2_wc_0.0", "door_corr_room_1_2_24", 2.8);
        g.addEdge("b1_f2_wc_1.7", "b1_f2_wc_3.5", 1.8);
        g.addEdge("b1_f2_wc_1.7", "b1_f2_elev", 4.8);
        g.addEdge("b1_f2_wc_1.7", "b1_f2_room_206_corr_door", 2.8);
        g.addEdge("b1_f2_wc_1.7", "door_corr_room_1_2_16", 1.4);
        g.addEdge("b1_f2_wc_3.5", "b1_f2_wc_6.0", 2.5);
        g.addEdge("b1_f2_wc_6.0", "b1_f2_sc_0.0", 3);
        g.addEdge("b1_f2_wc_6.0", "door_corr_room_1_2_27", 2.6);
        g.addEdge("b1_f2_wc_6.0", "door_corr_room_1_2_28", 1.3);
        g.addEdge("b1_f2_sc_0.0", "b1_f2_sc_1.8", 1.8);
        g.addEdge("b1_f2_sc_0.0", "door_corr_room_1_2_29", 1.7);
        g.addEdge("b1_f2_sc_1.8", "b1_f2_sc_3.5", 1.7);
        g.addEdge("b1_f2_sc_3.5", "b1_f2_sc_5.6", 2.1);
        g.addEdge("b1_f2_sc_5.6", "b1_f2_sc_9.4", 3.8);
        g.addEdge("b1_f2_sc_5.6", "door_corr_room_1_2_13", 1.6);
        g.addEdge("b1_f2_sc_5.6", "door_corr_b1_f2_r201_west", 0.9);
        g.addEdge("b1_f2_sc_9.4", "b1_f2_sc_10.5", 1.1);
        g.addEdge("b1_f2_sc_9.4", "b1_f2_stair_lk2", 4.1);
        g.addEdge("b1_f2_sc_9.4", "door_corr_room_1_2_15", 1.8);
        g.addEdge("b1_f2_sc_9.4", "door_corr_room_1_2_30", 0.9);
        g.addEdge("b1_f2_stair_lk1", "door_corr_room_1_2_23", 1.5);
        g.addEdge("door_corr_room_1_2_23", "door_room_room_1_2_14", 0.1);
        g.addEdge("b1_f2_stair_lk1", "door_room_room_1_2_14", 1.5);
        g.addEdge("b1_f2_stair_lk1", "room_1_2_14", 0.2);
        g.addEdge("b1_f2_stair_lk1", "b1_f1_stair_lk1", 5.5);
        g.addEdge("b1_f2_stair_lk2", "b1_f1_stair_lk2", 5.5);
        g.addEdge("b1_f2_elev", "b1_f1_elev", 4, true, { isElevator: true });
        g.addEdge("b1_f2_room_206_corr_door", "b1_f2_room_206_ante", 1.2);
        g.addEdge("b1_f2_room_206_ante", "b1_f2_room_206_inner_door", 1.2);
        g.addEdge("b1_f2_room_206_inner_door", "custom_b1_f2_c_-102_15_l9n", 2);
        g.addEdge("b2_f2_c_20.4", "custom_b2_f2_c_219_-58_veu", 1.5);
        g.addEdge("b2_f2_c_20.4", "custom_b1_f2_c_180_-56_1nw", 2.4);
        g.addEdge("b2_f2_c_37.5", "custom_b2_f2_c_328_-58_2yl", 4.7);
        g.addEdge("b2_f2_c_37.5", "custom_b2_f2_c_403_-58_82t", 2.8);
        g.addEdge("b2_f2_c_43.6", "b2_f2_c_47.0", 3.4);
        g.addEdge("b2_f2_c_43.6", "b2_f2_stair_lk2", 4.7);
        g.addEdge("b2_f2_c_43.6", "door_corr_room_2_2_111", 1);
        g.addEdge("b2_f2_c_43.6", "custom_b2_f2_c_403_-58_82t", 3.3);
        g.addEdge("b2_f2_c_47.0", "b2_f2_c_51.0", 4);
        g.addEdge("b2_f2_c_47.0", "door_corr_room_2_2_112", 1);
        g.addEdge("b2_f2_c_47.0", "door_corr_room_2_2_120", 1.2);
        g.addEdge("b2_f2_c_51.0", "b2_f2_c_55.0", 4);
        g.addEdge("b2_f2_c_51.0", "door_corr_room_2_2_121", 1.5);
        g.addEdge("b2_f2_c_55.0", "b2_f2_c_59.0", 4);
        g.addEdge("b2_f2_c_59.0", "b2_f2_c_63.0", 4);
        g.addEdge("b2_f2_c_59.0", "door_corr_room_2_2_113", 1.1);
        g.addEdge("b2_f2_c_63.0", "b2_f2_c_66.1", 3.1);
        g.addEdge("b2_f2_c_63.0", "door_corr_room_2_2_114", 1.2);
        g.addEdge("b2_f2_c_63.0", "door_corr_room_2_2_122", 1.1);
        g.addEdge("b2_f2_c_66.1", "b2_f2_stair_lk1", 4.7);
        g.addEdge("b2_f2_c_66.1", "door_room_2_2_115", 1.4);
        g.addEdge("b2_f2_stair_lk1", "b2_f1_stair_lk1", 5.5);
        g.addEdge("b2_f2_stair_lk2", "b2_f1_stair_lk2", 5.5);
        g.addEdge("b2_f2_stair_lk3", "door_corr_room_2_2_107", 1.7);
        g.addEdge("b2_f2_stair_lk3", "b2_f1_stair_lk3", 5.5);
        g.addEdge("b3_f2_c_-14.0", "b3_f2_c_-18.0", 4);
        g.addEdge("b3_f2_c_-14.0", "bridge_k1_k3_f2", 1);
        g.addEdge("b3_f2_c_-14.0", "custom_b1_f2_c_59_-124_2uw", 1.6);
        g.addEdge("b3_f2_c_-18.0", "custom_b3_f2_c_59_-232_f56", 5.2);
        g.addEdge("b3_f2_c_-26.0", "b3_f2_c_-28.6", 2.6);
        g.addEdge("b3_f2_c_-26.0", "door_corr_room_3_2_162", 1);
        g.addEdge("b3_f2_c_-26.0", "door_corr_room_3_2_171", 1);
        g.addEdge("b3_f2_c_-26.0", "custom_b3_f2_c_59_-232_f56", 2.8);
        g.addEdge("b3_f2_c_-28.6", "b3_f2_stair_south", 4.4);
        g.addEdge("b3_f2_c_-28.6", "door_corr_room_3_2_163", 0.9);
        g.addEdge("b3_f2_c_-28.6", "door_corr_room_3_2_172", 1);
        g.addEdge("b3_f2_c_-28.6", "custom_b3_f2_c_59_-304_oeo", 1.8);
        g.addEdge("b3_f2_c_-36.0", "b3_f2_c_-40.0", 4);
        g.addEdge("b3_f2_c_-36.0", "custom_b3_f2_c_58_-318_asy", 4.2);
        g.addEdge("b3_f2_c_-40.0", "door_corr_room_3_2_165", 2.9);
        g.addEdge("b3_f2_c_-40.0", "door_corr_room_3_2_174", 0.9);
        g.addEdge("b3_f2_c_-40.0", "custom_b3_f2_c_59_-430_6v0", 3);
        g.addEdge("b3_f2_c_-45.5", "b3_f2_c_-46.0", 0.5);
        g.addEdge("b3_f2_c_-46.0", "b3_f2_c_-50.0", 4);
        g.addEdge("b3_f2_c_-46.0", "b3_f2_stair_north", 4.4);
        g.addEdge("b3_f2_c_-46.0", "custom_b3_f2_c_59_-430_6v0", 3);
        g.addEdge("b3_f2_c_-50.0", "b3_f2_c_-55.0", 5);
        g.addEdge("b3_f2_c_-50.0", "door_corr_room_3_2_167", 0.9);
        g.addEdge("b3_f2_c_-50.0", "door_corr_room_3_2_176", 0.9);
        g.addEdge("b3_f2_c_-55.0", "door_corr_room_3_2_168", 2.2);
        g.addEdge("b3_f2_c_-55.0", "door_corr_room_3_2_178", 0.9);
        g.addEdge("b3_f2_c_-55.0", "custom_b3_f2_c_59_-598_xz2", 4.8);
        g.addEdge("b3_f2_stair_south", "b3_f1_stair_south", 5.5);
        g.addEdge("b3_f2_stair_north", "room_3_2_166", 0.1);
        g.addEdge("b3_f2_stair_north", "b3_f1_stair_north", 5.5);
        g.addEdge("bridge_k1_k3_f2", "door_corr_room_1_2_18", 1.7);
        g.addEdge("bridge_k1_k3_f2", "door_corr_room_1_2_20", 1.7);
        g.addEdge("room_1_2_12", "door_room_room_1_2_12", 1.1);
        g.addEdge("door_mid_room_1_2_12", "door_room_room_1_2_12", 0.4);
        g.addEdge("door_mid_room_1_2_12", "door_corr_room_1_2_12", 0.4);
        g.addEdge("door_corr_room_1_2_12", "door_corr_room_1_2_21", 1.5);
        g.addEdge("room_1_2_13", "door_room_room_1_2_13", 2.3);
        g.addEdge("door_mid_room_1_2_13", "door_room_room_1_2_13", 0.4);
        g.addEdge("door_mid_room_1_2_13", "door_corr_room_1_2_13", 0.4);
        g.addEdge("room_1_2_14", "door_room_room_1_2_14", 1.5);
        g.addEdge("door_mid_room_1_2_14", "door_room_room_1_2_14", 0.4);
        g.addEdge("door_mid_room_1_2_14", "custom_b1_f2_c_95_-51_o94", 1.3);
        g.addEdge("room_1_2_15", "door_room_room_1_2_15", 1.5);
        g.addEdge("door_mid_room_1_2_15", "door_room_room_1_2_15", 0.4);
        g.addEdge("door_mid_room_1_2_15", "door_corr_room_1_2_15", 0.4);
        g.addEdge("room_1_2_16", "door_room_room_1_2_16", 2.6);
        g.addEdge("room_1_2_17", "custom_b1_f2_c_-30_-101_xdd", 2.2);
        g.addEdge("room_1_2_18", "door_room_room_1_2_18", 2.1);
        g.addEdge("door_mid_room_1_2_18", "door_room_room_1_2_18", 0.4);
        g.addEdge("door_mid_room_1_2_18", "door_corr_room_1_2_18", 0.4);
        g.addEdge("door_mid_room_1_2_18", "custom_b1_f2_c_59_-124_2uw", 1.3);
        g.addEdge("door_mid_room_1_2_19", "door_room_room_1_2_19", 0.4);
        g.addEdge("door_mid_room_1_2_19", "door_corr_room_1_2_19", 0.4);
        g.addEdge("door_mid_room_1_2_19", "custom_b1_f2_c_27_-76_oy4", 1.9);
        g.addEdge("door_corr_room_1_2_19", "custom_b1_f2_c_59_-76_zai", 0.9);
        g.addEdge("room_1_2_19", "custom_b1_f2_c_27_-100_pje", 0.9);
        g.addEdge("room_1_2_20", "door_room_room_1_2_20", 4.1);
        g.addEdge("door_mid_room_1_2_20", "door_room_room_1_2_20", 0.4);
        g.addEdge("door_mid_room_1_2_20", "door_corr_room_1_2_20", 0.4);
        g.addEdge("door_mid_room_1_2_20", "custom_b1_f2_c_59_-124_2uw", 1.3);
        g.addEdge("room_1_2_21", "custom_b1_f2_c_59_-76_zai", 3.8);
        g.addEdge("door_corr_room_1_2_21", "custom_b1_f2_c_59_-76_zai", 1.8);
        g.addEdge("door_corr_room_1_2_21", "custom_b1_f2_c_95_-51_o94", 3.6);
        g.addEdge("room_1_2_22", "door_room_room_1_2_22", 1.3);
        g.addEdge("door_mid_room_1_2_22", "door_room_room_1_2_22", 0.4);
        g.addEdge("door_mid_room_1_2_22", "door_corr_room_1_2_22", 0.4);
        g.addEdge("door_corr_room_1_2_22", "custom_b1_f2_c_136_-51_uqh", 0.7);
        g.addEdge("door_mid_room_1_2_23", "door_corr_room_1_2_23", 0.4);
        g.addEdge("door_mid_room_1_2_24", "door_room_room_1_2_24", 0.4);
        g.addEdge("door_mid_room_1_2_24", "door_corr_room_1_2_24", 0.4);
        g.addEdge("door_room_room_1_2_24", "custom_b1_f2_c_-112_-14_sdr", 5);
        g.addEdge("room_1_2_24", "custom_b1_f2_c_-112_-14_sdr", 0.8);
        g.addEdge("room_1_2_25", "custom_b1_f2_c_-111_15_njt", 0.2);
        g.addEdge("room_1_2_26", "door_room_room_1_2_26", 1.6);
        g.addEdge("door_room_room_1_2_26", "custom_b1_f2_c_-102_15_l9n", 2.1);
        g.addEdge("room_1_2_27", "door_room_room_1_2_27", 7.3);
        g.addEdge("door_mid_room_1_2_27", "door_room_room_1_2_27", 0.4);
        g.addEdge("door_mid_room_1_2_27", "door_corr_room_1_2_27", 0.4);
        g.addEdge("room_1_2_28", "door_room_room_1_2_28", 3.9);
        g.addEdge("door_mid_room_1_2_28", "door_room_room_1_2_28", 0.4);
        g.addEdge("door_mid_room_1_2_28", "door_corr_room_1_2_28", 0.4);
        g.addEdge("door_mid_room_1_2_29", "door_room_room_1_2_29", 0.4);
        g.addEdge("door_mid_room_1_2_29", "door_corr_room_1_2_29", 0.4);
        g.addEdge("door_room_room_1_2_29", "custom_b1_f2_c_-15_118_ag9", 4.2);
        g.addEdge("room_1_2_29", "custom_b1_f2_c_-4_118_api", 0.2);
        g.addEdge("room_1_2_30", "door_room_room_1_2_30", 4.1);
        g.addEdge("room_1_2_30", "door_room_b1_f2_r201_west", 5.2);
        g.addEdge("door_mid_room_1_2_30", "door_room_room_1_2_30", 0.4);
        g.addEdge("door_mid_room_1_2_30", "door_corr_room_1_2_30", 0.4);
        g.addEdge("door_corr_b1_f2_r201_west", "door_mid_b1_f2_r201_west", 0.4);
        g.addEdge("door_mid_b1_f2_r201_west", "door_room_b1_f2_r201_west", 0.4);
        g.addEdge("room_2_2_107", "door_room_room_2_2_107", 2);
        g.addEdge("door_mid_room_2_2_107", "door_room_room_2_2_107", 0.4);
        g.addEdge("door_mid_room_2_2_107", "door_corr_room_2_2_107", 0.4);
        g.addEdge("door_room_room_2_2_107", "custom_b2_f2_c_246_-88_mx5", 0.8);
        g.addEdge("room_2_2_108", "door_room_room_2_2_108", 3.3);
        g.addEdge("door_mid_room_2_2_108", "door_room_room_2_2_108", 0.4);
        g.addEdge("door_mid_room_2_2_108", "door_corr_room_2_2_108", 0.4);
        g.addEdge("door_corr_room_2_2_108", "custom_b2_f2_c_328_-58_2yl", 1);
        g.addEdge("room_2_2_109", "door_room_room_2_2_109", 0.8);
        g.addEdge("door_mid_room_2_2_109", "door_room_room_2_2_109", 0.4);
        g.addEdge("door_mid_room_2_2_109", "door_corr_room_2_2_109", 0.4);
        g.addEdge("door_corr_room_2_2_109", "custom_b2_f2_c_403_-58_82t", 1.2);
        g.addEdge("room_2_2_110", "door_room_room_2_2_110", 0.8);
        g.addEdge("door_mid_room_2_2_110", "door_room_room_2_2_110", 0.4);
        g.addEdge("door_mid_room_2_2_110", "door_corr_room_2_2_110", 0.4);
        g.addEdge("door_corr_room_2_2_110", "custom_b2_f2_c_403_-58_82t", 1.2);
        g.addEdge("room_2_2_111", "door_room_room_2_2_111", 4.9);
        g.addEdge("door_mid_room_2_2_111", "door_room_room_2_2_111", 0.4);
        g.addEdge("door_mid_room_2_2_111", "door_corr_room_2_2_111", 0.4);
        g.addEdge("room_2_2_112", "door_room_room_2_2_112", 2.9);
        g.addEdge("door_mid_room_2_2_112", "door_room_room_2_2_112", 0.4);
        g.addEdge("door_mid_room_2_2_112", "door_corr_room_2_2_112", 0.4);
        g.addEdge("room_2_2_113", "door_room_room_2_2_113", 4.9);
        g.addEdge("door_mid_room_2_2_113", "door_room_room_2_2_113", 0.4);
        g.addEdge("door_mid_room_2_2_113", "door_corr_room_2_2_113", 0.4);
        g.addEdge("room_2_2_114", "door_room_room_2_2_114", 0.8);
        g.addEdge("door_mid_room_2_2_114", "door_room_room_2_2_114", 0.4);
        g.addEdge("door_mid_room_2_2_114", "door_corr_room_2_2_114", 0.4);
        g.addEdge("room_2_2_115", "door_room_2_2_115", 5.3);
        g.addEdge("room_2_2_116", "door_room_room_2_2_116", 3.5);
        g.addEdge("door_mid_room_2_2_116", "door_room_room_2_2_116", 0.4);
        g.addEdge("door_mid_room_2_2_116", "door_corr_room_2_2_116", 0.4);
        g.addEdge("door_corr_room_2_2_116", "custom_b2_f2_c_219_-58_veu", 1);
        g.addEdge("room_2_2_117", "door_room_room_2_2_117", 3.5);
        g.addEdge("door_mid_room_2_2_117", "door_room_room_2_2_117", 0.4);
        g.addEdge("door_mid_room_2_2_117", "door_corr_room_2_2_117", 0.4);
        g.addEdge("door_corr_room_2_2_117", "custom_b2_f2_c_249_-58_wdq", 1);
        g.addEdge("room_2_2_118", "door_room_room_2_2_118", 5.7);
        g.addEdge("door_mid_room_2_2_118", "door_room_room_2_2_118", 0.4);
        g.addEdge("door_mid_room_2_2_118", "door_corr_room_2_2_118", 0.4);
        g.addEdge("door_corr_room_2_2_118", "custom_b2_f2_c_282_-58_zxs", 1);
        g.addEdge("room_2_2_119", "door_room_room_2_2_119", 3.5);
        g.addEdge("door_mid_room_2_2_119", "door_room_room_2_2_119", 0.4);
        g.addEdge("door_mid_room_2_2_119", "door_corr_room_2_2_119", 0.4);
        g.addEdge("door_corr_room_2_2_119", "custom_b2_f2_c_403_-58_82t", 1);
        g.addEdge("room_2_2_120", "door_room_room_2_2_120", 3.5);
        g.addEdge("door_mid_room_2_2_120", "door_room_room_2_2_120", 0.4);
        g.addEdge("door_mid_room_2_2_120", "door_corr_room_2_2_120", 0.4);
        g.addEdge("room_2_2_121", "door_room_room_2_2_121", 4.7);
        g.addEdge("door_mid_room_2_2_121", "door_room_room_2_2_121", 0.4);
        g.addEdge("door_mid_room_2_2_121", "door_corr_room_2_2_121", 0.4);
        g.addEdge("room_2_2_122", "door_room_room_2_2_122", 3.5);
        g.addEdge("door_mid_room_2_2_122", "door_room_room_2_2_122", 0.4);
        g.addEdge("door_mid_room_2_2_122", "door_corr_room_2_2_122", 0.4);
        g.addEdge("room_3_2_161", "door_room_room_3_2_161", 4.2);
        g.addEdge("door_mid_room_3_2_161", "door_room_room_3_2_161", 0.4);
        g.addEdge("door_mid_room_3_2_161", "door_corr_room_3_2_161", 0.4);
        g.addEdge("door_corr_room_3_2_161", "custom_b3_f2_c_59_-232_f56", 0.9);
        g.addEdge("room_3_2_162", "door_room_room_3_2_162", 2.7);
        g.addEdge("door_mid_room_3_2_162", "door_room_room_3_2_162", 0.4);
        g.addEdge("door_mid_room_3_2_162", "door_corr_room_3_2_162", 0.4);
        g.addEdge("room_3_2_163", "door_room_room_3_2_163", 2.7);
        g.addEdge("door_mid_room_3_2_163", "door_room_room_3_2_163", 0.4);
        g.addEdge("door_mid_room_3_2_163", "door_corr_room_3_2_163", 0.4);
        g.addEdge("room_3_2_164", "door_room_room_3_2_164", 5.1);
        g.addEdge("door_mid_room_3_2_164", "door_room_room_3_2_164", 0.4);
        g.addEdge("door_mid_room_3_2_164", "door_corr_room_3_2_164", 0.4);
        g.addEdge("door_corr_room_3_2_164", "custom_b3_f2_c_58_-318_asy", 0.8);
        g.addEdge("room_3_2_165", "door_room_room_3_2_165", 2.1);
        g.addEdge("door_mid_room_3_2_165", "door_room_room_3_2_165", 0.4);
        g.addEdge("door_mid_room_3_2_165", "door_corr_room_3_2_165", 0.4);
        g.addEdge("room_3_2_167", "door_room_room_3_2_167", 2.7);
        g.addEdge("door_mid_room_3_2_167", "door_room_room_3_2_167", 0.4);
        g.addEdge("door_mid_room_3_2_167", "door_corr_room_3_2_167", 0.4);
        g.addEdge("room_3_2_168", "door_room_room_3_2_168", 3.4);
        g.addEdge("room_3_2_168", "door_room_room_3_2_169", 5);
        g.addEdge("door_mid_room_3_2_168", "door_room_room_3_2_168", 0.4);
        g.addEdge("door_mid_room_3_2_168", "door_corr_room_3_2_168", 0.4);
        g.addEdge("room_3_2_169", "door_room_room_3_2_169", 2.5);
        g.addEdge("door_room_room_3_2_169", "custom_b3_f2_c_59_-598_xz2", 2);
        g.addEdge("room_3_2_170", "door_room_room_3_2_170", 4.5);
        g.addEdge("door_mid_room_3_2_170", "door_room_room_3_2_170", 0.4);
        g.addEdge("door_mid_room_3_2_170", "door_corr_room_3_2_170", 0.4);
        g.addEdge("door_corr_room_3_2_170", "custom_b3_f2_c_59_-232_f56", 0.9);
        g.addEdge("room_3_2_171", "door_room_room_3_2_171", 3);
        g.addEdge("door_mid_room_3_2_171", "door_room_room_3_2_171", 0.4);
        g.addEdge("door_mid_room_3_2_171", "door_corr_room_3_2_171", 0.4);
        g.addEdge("room_3_2_172", "door_room_room_3_2_172", 3);
        g.addEdge("door_mid_room_3_2_172", "door_room_room_3_2_172", 0.4);
        g.addEdge("door_mid_room_3_2_172", "door_corr_room_3_2_172", 0.4);
        g.addEdge("room_3_2_173", "door_room_room_3_2_173", 3);
        g.addEdge("door_mid_room_3_2_173", "door_room_room_3_2_173", 0.4);
        g.addEdge("door_mid_room_3_2_173", "door_corr_room_3_2_173", 0.4);
        g.addEdge("door_mid_room_3_2_173", "custom_b3_f2_c_59_-304_oeo", 1.3);
        g.addEdge("room_3_2_174", "door_room_room_3_2_174", 4.4);
        g.addEdge("door_mid_room_3_2_174", "door_room_room_3_2_174", 0.4);
        g.addEdge("door_mid_room_3_2_174", "door_corr_room_3_2_174", 0.4);
        g.addEdge("door_room_room_3_2_174", "door_mid_room_3_2_175", 1.9);
        g.addEdge("room_3_2_175", "door_room_room_3_2_175", 2.3);
        g.addEdge("room_3_2_175", "custom_b3_f2_c_59_-430_6v0", 4.7);
        g.addEdge("door_mid_room_3_2_175", "door_room_room_3_2_175", 0.4);
        g.addEdge("room_3_2_176", "door_room_room_3_2_176", 3.1);
        g.addEdge("door_mid_room_3_2_176", "door_room_room_3_2_176", 0.4);
        g.addEdge("door_mid_room_3_2_176", "door_corr_room_3_2_176", 0.4);
        g.addEdge("room_3_2_177", "door_room_room_3_2_177", 2.3);
        g.addEdge("door_mid_room_3_2_177", "door_room_room_3_2_177", 0.4);
        g.addEdge("door_mid_room_3_2_177", "door_corr_room_3_2_177", 0.4);
        g.addEdge("door_mid_room_3_2_177", "door_room_room_3_2_178", 1.4);
        g.addEdge("door_corr_room_3_2_177", "custom_b3_f2_c_84_-531_opn", 1.1);
        g.addEdge("room_3_2_178", "door_room_room_3_2_178", 4);
        g.addEdge("door_mid_room_3_2_178", "door_room_room_3_2_178", 0.4);
        g.addEdge("door_mid_room_3_2_178", "door_corr_room_3_2_178", 0.4);
        g.addEdge("custom_b1_f2_c_27_-76_oy4", "custom_b1_f2_c_27_-100_pje", 2.4);
        g.addEdge("custom_b1_f2_c_59_-76_zai", "custom_b1_f2_c_59_-124_2uw", 4.8);
        g.addEdge("custom_b3_f2_c_59_-304_oeo", "custom_b3_f2_c_58_-318_asy", 1.4);
        g.addEdge("custom_b2_f2_c_246_-88_mx5", "custom_b2_f2_c_246_-105_p78", 1.7);
        g.addEdge("custom_b2_f2_c_246_-88_mx5", "custom_b2_f2_c_249_-58_wdq", 3);
        g.addEdge("custom_b2_f2_c_219_-58_veu", "custom_b2_f2_c_249_-58_wdq", 3);
        g.addEdge("custom_b2_f2_c_249_-58_wdq", "custom_b2_f2_c_282_-58_zxs", 3.3);
        g.addEdge("custom_b2_f2_c_282_-58_zxs", "custom_b2_f2_c_328_-58_2yl", 4.6);
        g.addEdge("custom_b1_f2_c_-102_15_l9n", "custom_b1_f2_c_-111_15_njt", 0.9);
        g.addEdge("custom_b1_f2_c_95_-51_o94", "custom_b1_f2_c_136_-51_uqh", 4.1);
        g.addEdge("custom_b1_f2_c_136_-51_uqh", "custom_b1_f2_c_160_-48_j36", 2.4);
        g.addEdge("custom_b1_f2_c_180_-56_1nw", "custom_b1_f2_c_160_-48_j36", 2.1);
        g.addEdge("custom_b1_f2_c_-15_118_ag9", "custom_b1_f2_c_-4_118_api", 1.1);
        g.addEdge("custom_b3_f2_c_84_-531_opn", "custom_b3_f2_c_107_-531_rgj", 2.3);
        g.addEdge("door_mid_room_1_2_16", "door_room_room_1_2_16", 0.4);
        g.addEdge("door_mid_room_1_2_16", "door_corr_room_1_2_16", 0.4);
        g.addEdge("b1_f1_nc_-3.0", "b1_f1_nc_0.0", 3);
        g.addEdge("b1_f1_nc_-3.0", "b1_f1_wc_-3.0", 2.8);
        g.addEdge("b1_f1_nc_-3.0", "door_corr_room_1_1_0", 0.9);
        g.addEdge("b1_f1_nc_0.0", "b1_f1_nc_3.0", 3);
        g.addEdge("b1_f1_nc_3.0", "b1_f1_nc_5.9", 2.9);
        g.addEdge("b1_f1_nc_5.9", "b1_f1_nc_9.4", 3.5);
        g.addEdge("b1_f1_nc_5.9", "door_corr_room_1_1_6", 2.2);
        g.addEdge("b1_f1_nc_5.9", "door_corr_room_1_1_7", 1.4);
        g.addEdge("b1_f1_nc_5.9", "custom_b1_f1_c_58_-72_tpz", 1.4);
        g.addEdge("b1_f1_nc_9.4", "b1_f1_nc_12.5", 3.1);
        g.addEdge("b1_f1_nc_9.4", "b1_f1_stair_lk1", 3.9);
        g.addEdge("b1_f1_nc_12.5", "b1_f1_nc_16.0", 3.1);
        g.addEdge("b1_f1_nc_12.5", "door_corr_room_1_1_5", 1);
        g.addEdge("b1_f1_nc_16.0", "b2_f1_c_20.4", 4.9);
        g.addEdge("b1_f1_wc_-3.0", "b1_f1_wc_0.0", 3);
        g.addEdge("b1_f1_wc_0.0", "b1_f1_wc_1.7", 1.7);
        g.addEdge("b1_f1_wc_1.7", "b1_f1_wc_3.5", 1.8);
        g.addEdge("b1_f1_wc_1.7", "b1_f1_elev", 4.8);
        g.addEdge("b1_f1_wc_3.5", "b1_f1_wc_6.0", 2.5);
        g.addEdge("b1_f1_wc_6.0", "b1_f1_sc_0.0", 2.5);
        g.addEdge("b1_f1_wc_6.0", "b1_f1_foyer_w", 3.8);
        g.addEdge("b1_f1_sc_0.0", "b1_f1_sc_1.8", 3.8);
        g.addEdge("b1_f1_sc_1.8", "b1_f1_foyer_w", 3.0);
        g.addEdge("b1_f1_sc_1.8", "b1_f1_foyer", 1.8);
        g.addEdge("b1_f1_foyer", "b1_f1_sc_3.5", 1.7);
        g.addEdge("b1_f1_sc_3.5", "b1_f1_inner_doors", 0.3);
        g.addEdge("b1_f1_sc_3.5", "door_corr_room_1_1_9", 1.2);
        g.addEdge("b1_f1_foyer", "door_corr_room_1_1_9", 1.1);
        g.addEdge("b1_f1_stair_lk1", "room_1_1_10", 0.2);
        g.addEdge("b1_f1_stair_lk2", "b1_f1_inner_door_lk2", 0.8);
        g.addEdge("b1_f1_stair_lk2", "room_1_1_11", 0.2);
        g.addEdge("b1_f1_elev", "b1_f1_inner_door_lk2", 6.8);
        g.addEdge("b1_f1_elev", "room_1_1_8", 0.3);
        g.addEdge("room_1_1_8", "door_room_room_1_1_8", 2.6);
        g.addEdge("door_mid_room_1_1_8", "door_room_room_1_1_8", 0.4);
        g.addEdge("door_mid_room_1_1_8", "door_corr_room_1_1_8", 0.4);
        g.addEdge("b1_f1_wc_1.7", "door_corr_room_1_1_8", 1.4);
        g.addEdge("b1_f1_entrance_main", "b1_f1_porch_walk_1", 1.2);
        g.addEdge("b1_f1_porch_walk_1", "b1_f1_porch_doors", 0.9);
        g.addEdge("b1_f1_porch_doors", "b1_f1_vestibule", 2.4);
        g.addEdge("b1_f1_vestibule", "b1_f1_inner_doors", 2.4);
        g.addEdge("b1_f1_inner_doors", "b1_f1_foyer", 2);
        g.addEdge("b1_f1_foyer", "b1_f1_foyer_w", 4.8);
        g.addEdge("b2_f1_c_20.4", "b2_f1_porch", 1.2);
        g.addEdge("b2_f1_c_20.4", "custom_b2_f1_c_226_-58_h4c", 2.2);
        g.addEdge("b2_f1_c_37.5", "custom_b2_f1_c_334_-58_oms", 4.1);
        g.addEdge("b2_f1_c_37.5", "custom_b2_f1_c_402_-58_rs0", 2.7);
        g.addEdge("b2_f1_c_43.6", "b2_f1_c_47.0", 3.4);
        g.addEdge("b2_f1_c_43.6", "b2_f1_stair_lk2", 4.7);
        g.addEdge("b2_f1_c_43.6", "door_corr_room_2_1_97", 1);
        g.addEdge("b2_f1_c_43.6", "custom_b2_f1_c_402_-58_rs0", 3.4);
        g.addEdge("b2_f1_c_47.0", "door_corr_room_2_1_104", 1);
        g.addEdge("b2_f1_c_47.0", "custom_b2_f1_c_500_-59_9s1", 3);
        g.addEdge("b2_f1_c_59.0", "door_corr_room_2_1_99", 1.1);
        g.addEdge("b2_f1_c_59.0", "custom_b2_f1_c_626_-58_pxf", 3.6);
        g.addEdge("b2_f1_c_59.0", "custom_b2_f1_c_570_-58_cc0", 2);
        g.addEdge("b2_f1_c_66.1", "b2_f1_stair_lk1", 4.7);
        g.addEdge("b2_f1_c_66.1", "door_corr_room_2_1_106", 1);
        g.addEdge("b2_f1_c_66.1", "custom_b2_f1_c_626_-58_pxf", 3.5);
        g.addEdge("b2_f1_stair_lk2", "outdoor_node_81120", 0.5099019513592787);
        g.addEdge("b2_f1_stair_lk3", "b2_f1_d_lk3_vest", 2.4);
        g.addEdge("b2_f1_d_lk3_vest", "b2_f1_vest_lk3", 1.3);
        g.addEdge("b2_f1_vest_lk3", "b2_f1_d_vest_105", 1.3);
        g.addEdge("b2_f1_d_vest_105", "room_2_1_95", 5.8);
        g.addEdge("custom_b2_f1_c_226_-58_h4c", "custom_b2_f1_c_246_-58_wff", 2);
        g.addEdge("b3_f1_c_-28.6", "b3_f1_stair_south", 4.4);
        g.addEdge("b3_f1_c_-28.6", "door_corr_room_3_1_149", 0.9);
        g.addEdge("b3_f1_c_-28.6", "custom_b3_f1_c_59_-313_m4p", 2.7);
        g.addEdge("b3_f1_c_-28.6", "custom_b3_f1_c_60_-257_skf", 2.9);
        g.addEdge("b3_f1_c_-28.6", "b3_f1_d_corr_east_exit", 1.4);
        g.addEdge("b3_f1_c_-45.5", "b3_f1_c_-46.0", 0.5);
        g.addEdge("b3_f1_c_-45.5", "door_corr_room_3_1_145", 0.9);
        g.addEdge("b3_f1_c_-45.5", "custom_b3_f1_c_59_-431_8or", 2.4);
        g.addEdge("b3_f1_c_-46.0", "b3_f1_stair_north", 4.4);
        g.addEdge("b3_f1_c_-46.0", "door_corr_room_3_1_157", 0.9);
        g.addEdge("b3_f1_c_-46.0", "custom_b3_f1_c_59_-476_pow", 1.6);
        g.addEdge("b3_f1_c_-55.0", "door_corr_room_3_1_159", 0.9);
        g.addEdge("b3_f1_c_-55.0", "b3_f1_door_vest_south", 1.2);
        g.addEdge("b3_f1_c_-55.0", "custom_b3_f1_c_59_-511_sy7", 2.4);
        g.addEdge("b3_f1_stair_north", "b3_f1_stair_north_wp", 2.7);
        g.addEdge("b3_f1_stair_north_wp", "b3_f1_entrance_north", 3.2);
        g.addEdge("b3_f1_entrance_west", "b3_f1_tambur_108", 1.2);
        g.addEdge("b3_f1_vest_north", "door_corr_room_3_1_148", 0.7);
        g.addEdge("b3_f1_vest_north", "door_room_3_1_160", 1.3);
        g.addEdge("b3_f1_vest_north", "b3_f1_door_vest_south", 1.2);
        g.addEdge("b3_f1_d_corr_east_exit", "b3_f1_exit_east_inner", 2.3);
        g.addEdge("room_1_1_0", "door_room_room_1_1_0", 3.7);
        g.addEdge("door_mid_room_1_1_0", "door_room_room_1_1_0", 0.4);
        g.addEdge("door_mid_room_1_1_0", "door_corr_room_1_1_0", 0.4);
        g.addEdge("room_1_1_1", "door_room_room_1_1_1", 1.5);
        g.addEdge("door_mid_room_1_1_1", "door_room_room_1_1_1", 0.4);
        g.addEdge("door_mid_room_1_1_1", "door_corr_room_1_1_1", 0.4);
        g.addEdge("door_corr_room_1_1_1", "custom_b1_f1_c_58_-101_wov", 0.8);
        g.addEdge("room_1_1_2", "custom_b1_f1_c_58_-101_wov", 0.2);
        g.addEdge("room_1_1_3", "custom_b1_f1_c_61_-132_nb8", 3.2);
        g.addEdge("room_1_1_4", "custom_b1_f1_c_58_-72_tpz", 3.5);
        g.addEdge("room_1_1_5", "door_room_room_1_1_5", 3.6);
        g.addEdge("door_mid_room_1_1_5", "door_room_room_1_1_5", 0.4);
        g.addEdge("door_mid_room_1_1_5", "door_corr_room_1_1_5", 0.4);
        g.addEdge("room_1_1_6", "door_room_room_1_1_6", 1.2);
        g.addEdge("door_mid_room_1_1_6", "door_room_room_1_1_6", 0.4);
        g.addEdge("door_mid_room_1_1_6", "door_corr_room_1_1_6", 0.4);
        g.addEdge("room_1_1_7", "door_room_room_1_1_7", 1.2);
        g.addEdge("door_mid_room_1_1_7", "door_room_room_1_1_7", 0.4);
        g.addEdge("door_mid_room_1_1_7", "door_corr_room_1_1_7", 0.4);
        g.addEdge("room_1_1_9", "door_room_room_1_1_9", 1.9);
        g.addEdge("door_mid_room_1_1_9", "door_room_room_1_1_9", 0.4);
        g.addEdge("door_mid_room_1_1_9", "door_corr_room_1_1_9", 0.4);
        g.addEdge("room_2_1_94", "door_room_room_2_1_94", 1.3);
        g.addEdge("door_mid_room_2_1_94", "door_room_room_2_1_94", 0.4);
        g.addEdge("door_mid_room_2_1_94", "door_corr_room_2_1_94", 0.4);
        g.addEdge("door_corr_room_2_1_94", "custom_b2_f1_c_246_-58_wff", 1);
        g.addEdge("room_2_1_95", "door_room_room_2_1_95", 2.7);
        g.addEdge("door_mid_room_2_1_95", "door_room_room_2_1_95", 0.4);
        g.addEdge("door_mid_room_2_1_95", "door_corr_room_2_1_95", 0.4);
        g.addEdge("door_corr_room_2_1_95", "custom_b2_f1_c_334_-58_oms", 1);
        g.addEdge("room_2_1_96", "door_room_room_2_1_96", 0.7);
        g.addEdge("door_mid_room_2_1_96", "door_room_room_2_1_96", 0.4);
        g.addEdge("door_mid_room_2_1_96", "door_corr_room_2_1_96", 0.4);
        g.addEdge("door_corr_room_2_1_96", "custom_b2_f1_c_402_-58_rs0", 1);
        g.addEdge("room_2_1_97", "door_room_room_2_1_97", 1.6);
        g.addEdge("door_mid_room_2_1_97", "door_room_room_2_1_97", 0.4);
        g.addEdge("door_mid_room_2_1_97", "door_corr_room_2_1_97", 0.4);
        g.addEdge("room_2_1_98", "door_room_room_2_1_98", 4.2);
        g.addEdge("door_mid_room_2_1_98", "door_room_room_2_1_98", 0.4);
        g.addEdge("door_mid_room_2_1_98", "door_corr_room_2_1_98", 0.4);
        g.addEdge("door_corr_room_2_1_98", "custom_b2_f1_c_500_-59_9s1", 0.9);
        g.addEdge("room_2_1_99", "door_room_room_2_1_99", 2.7);
        g.addEdge("door_mid_room_2_1_99", "door_room_room_2_1_99", 0.4);
        g.addEdge("door_mid_room_2_1_99", "door_corr_room_2_1_99", 0.4);
        g.addEdge("door_corr_room_2_1_100", "room_2_1_101", 1.1);
        g.addEdge("door_corr_room_2_1_100", "custom_b2_f1_c_620_-125_vbv", 3.7);
        g.addEdge("room_2_1_101", "custom_b2_f1_c_626_-58_pxf", 2.2);
        g.addEdge("room_2_1_103", "door_room_room_2_1_103", 4.1);
        g.addEdge("door_mid_room_2_1_103", "door_room_room_2_1_103", 0.4);
        g.addEdge("door_mid_room_2_1_103", "door_corr_room_2_1_103", 0.4);
        g.addEdge("door_corr_room_2_1_103", "custom_b2_f1_c_317_-58_it3", 1);
        g.addEdge("room_2_1_104", "door_room_room_2_1_104", 3.5);
        g.addEdge("door_mid_room_2_1_104", "door_room_room_2_1_104", 0.4);
        g.addEdge("door_mid_room_2_1_104", "door_corr_room_2_1_104", 0.4);
        g.addEdge("room_2_1_105", "door_room_room_2_1_105", 4.4);
        g.addEdge("door_mid_room_2_1_105", "door_room_room_2_1_105", 0.4);
        g.addEdge("door_mid_room_2_1_105", "door_corr_room_2_1_105", 0.4);
        g.addEdge("door_corr_room_2_1_105", "custom_b2_f1_c_570_-58_cc0", 1);
        g.addEdge("room_2_1_106", "door_room_room_2_1_106", 3.5);
        g.addEdge("door_mid_room_2_1_106", "door_corr_room_2_1_106", 0.4);
        g.addEdge("door_mid_room_2_1_106", "door_room_room_2_1_106", 0.4);
        g.addEdge("room_3_1_139", "custom_b3_f1_c_60_-205_o4u", 2.8);
        g.addEdge("room_3_1_140", "door_room_room_3_1_140", 3);
        g.addEdge("door_mid_room_3_1_140", "door_room_room_3_1_140", 0.4);
        g.addEdge("door_mid_room_3_1_140", "custom_b3_f1_c_60_-232_qzy", 1.2);
        g.addEdge("room_3_1_141", "door_room_room_3_1_141", 3);
        g.addEdge("door_mid_room_3_1_141", "door_room_room_3_1_141", 0.4);
        g.addEdge("door_mid_room_3_1_141", "door_corr_room_3_1_141", 0.4);
        g.addEdge("door_corr_room_3_1_141", "custom_b3_f1_c_60_-257_skf", 0.8);
        g.addEdge("room_3_1_142", "door_mid_room_3_1_142", 3.4);
        g.addEdge("door_mid_room_3_1_142", "custom_b3_f1_c_59_-313_m4p", 1.3);
        g.addEdge("room_3_1_143", "door_room_room_3_1_143", 3);
        g.addEdge("door_mid_room_3_1_143", "door_room_room_3_1_143", 0.4);
        g.addEdge("door_mid_room_3_1_143", "door_corr_room_3_1_143", 0.4);
        g.addEdge("door_corr_room_3_1_143", "custom_b3_f1_c_59_-404_5kk", 0.9);
        g.addEdge("room_3_1_144", "door_room_room_3_1_144", 3);
        g.addEdge("door_mid_room_3_1_144", "door_room_room_3_1_144", 0.4);
        g.addEdge("door_room_room_3_1_144", "custom_b3_f1_c_59_-431_8or", 1.7);
        g.addEdge("room_3_1_145", "door_room_room_3_1_145", 1.3);
        g.addEdge("room_3_1_145", "b3_f1_door_room_112_vestibule", 1.7);
        g.addEdge("door_mid_room_3_1_145", "door_room_room_3_1_145", 0.4);
        g.addEdge("door_mid_room_3_1_145", "door_corr_room_3_1_145", 0.4);
        g.addEdge("room_3_1_146", "door_room_room_3_1_146", 3);
        g.addEdge("door_mid_room_3_1_146", "door_room_room_3_1_146", 0.4);
        g.addEdge("door_mid_room_3_1_146", "custom_b3_f1_c_59_-476_pow", 1.3);
        g.addEdge("room_3_1_147", "door_room_room_3_1_147", 3);
        g.addEdge("door_mid_room_3_1_147", "door_room_room_3_1_147", 0.4);
        g.addEdge("door_mid_room_3_1_147", "custom_b3_f1_c_59_-511_sy7", 1.3);
        g.addEdge("room_3_1_148", "custom_b3_f1_c_102_-579_32j", 0.6);
        g.addEdge("door_mid_room_3_1_148", "door_room_room_3_1_148", 0.4);
        g.addEdge("door_mid_room_3_1_148", "door_corr_room_3_1_148", 0.5);
        g.addEdge("door_room_room_3_1_148", "custom_b3_f1_c_59_-579_ud7", 0.3);
        g.addEdge("room_3_1_149", "door_room_room_3_1_149", 4);
        g.addEdge("door_mid_room_3_1_149", "door_room_room_3_1_149", 0.4);
        g.addEdge("door_mid_room_3_1_149", "door_corr_room_3_1_149", 0.4);
        g.addEdge("room_3_1_150", "door_room_room_3_1_150", 2.7);
        g.addEdge("door_mid_room_3_1_150", "door_room_room_3_1_150", 0.4);
        g.addEdge("door_mid_room_3_1_150", "custom_b3_f1_c_59_-313_m4p", 1.3);
        g.addEdge("room_3_1_151", "door_room_room_3_1_151", 1);
        g.addEdge("door_room_room_3_1_151", "custom_b3_f1_c_21_-356_8ss", 1);
        g.addEdge("room_3_1_152", "custom_b3_f1_c_42_-395_irx", 1.9);
        g.addEdge("room_3_1_153", "door_room_room_3_1_153", 0.9);
        g.addEdge("door_room_room_3_1_153", "b3_f1_tambur_108", 0.8);
        g.addEdge("b3_f1_tambur_108", "b3_f1_door_tambur_108", 1);
        g.addEdge("b3_f1_door_tambur_108", "custom_b3_f1_c_21_-356_8ss", 1.9);
        g.addEdge("b3_f1_exit_east_inner", "b3_f1_exit_east_door", 4.4);
        g.addEdge("b3_f1_exit_east_door", "outdoor_node_74046", 1.4);
        g.addEdge("room_3_1_154", "door_room_room_3_1_154", 4);
        g.addEdge("door_mid_room_3_1_154", "door_room_room_3_1_154", 0.4);
        g.addEdge("door_mid_room_3_1_154", "door_corr_room_3_1_154", 0.4);
        g.addEdge("door_room_room_3_1_154", "custom_b3_f1_c_42_-395_irx", 0.9);
        g.addEdge("door_corr_room_3_1_154", "custom_b3_f1_c_59_-404_5kk", 0.9);
        g.addEdge("room_3_1_155", "door_room_room_3_1_155", 0.9);
        g.addEdge("door_mid_room_3_1_155", "door_room_room_3_1_155", 0.4);
        g.addEdge("door_mid_room_3_1_155", "door_corr_room_3_1_155", 0.4);
        g.addEdge("door_corr_room_3_1_155", "custom_b3_f1_c_59_-420_6z7", 0.9);
        g.addEdge("room_3_1_156", "custom_b3_f1_c_59_-431_8or", 5.7);
        g.addEdge("room_3_1_157", "door_room_room_3_1_157", 2.7);
        g.addEdge("door_mid_room_3_1_157", "door_room_room_3_1_157", 0.4);
        g.addEdge("door_mid_room_3_1_157", "door_corr_room_3_1_157", 0.4);
        g.addEdge("room_3_1_158", "door_room_room_3_1_158", 2.7);
        g.addEdge("door_mid_room_3_1_158", "door_room_room_3_1_158", 0.4);
        g.addEdge("door_mid_room_3_1_158", "custom_b3_f1_c_59_-491_r17", 1.3);
        g.addEdge("room_3_1_159", "door_room_room_3_1_159", 2.7);
        g.addEdge("door_mid_room_3_1_159", "door_room_room_3_1_159", 0.4);
        g.addEdge("door_mid_room_3_1_159", "door_corr_room_3_1_159", 0.4);
        g.addEdge("room_3_1_160", "door_room_3_1_160", 3.7);
        g.addEdge("custom_b2_f1_c_620_-125_vbv", "custom_b2_f1_c_629_-125_vmm", 0.9);
        g.addEdge("custom_b2_f1_c_317_-58_it3", "custom_b2_f1_c_334_-58_oms", 1.7);
        g.addEdge("custom_b2_f1_c_317_-58_it3", "custom_b2_f1_c_246_-58_wff", 7.1);
        g.addEdge("custom_b3_f1_c_59_-313_m4p", "custom_b3_f1_c_59_-356_xpk", 4.3);
        g.addEdge("custom_b3_f1_c_59_-356_xpk", "custom_b3_f1_c_59_-375_zxo", 1.9);
        g.addEdge("custom_b3_f1_c_59_-356_xpk", "custom_b3_f1_c_21_-356_8ss", 3.8);
        g.addEdge("custom_b3_f1_c_59_-375_zxo", "custom_b3_f1_c_59_-404_5kk", 2.9);
        g.addEdge("custom_b3_f1_c_59_-404_5kk", "custom_b3_f1_c_59_-420_6z7", 1.6);
        g.addEdge("custom_b3_f1_c_59_-420_6z7", "custom_b3_f1_c_59_-431_8or", 1.1);
        g.addEdge("custom_b3_f1_c_59_-579_ud7", "custom_b3_f1_c_102_-579_32j", 4.3);
        g.addEdge("custom_b3_f1_c_60_-205_o4u", "custom_b3_f1_c_60_-232_qzy", 2.7);
        g.addEdge("custom_b3_f1_c_60_-232_qzy", "custom_b3_f1_c_60_-257_skf", 2.5);
        g.addEdge("custom_b3_f1_c_60_-257_skf", "custom_b3_f1_c_73_-257_vh5", 1.3);
        g.addEdge("custom_b3_f1_c_73_-257_vh5", "custom_b3_f1_c_106_-257_yy3", 3.3);
        g.addEdge("custom_b3_f1_c_59_-476_pow", "custom_b3_f1_c_59_-491_r17", 1.5);
        g.addEdge("custom_b3_f1_c_59_-491_r17", "custom_b3_f1_c_59_-511_sy7", 2);
        g.addEdge("custom_b2_f1_c_570_-58_cc0", "custom_b2_f1_c_500_-59_9s1", 7);
        g.addEdge("custom_b1_f1_c_61_-132_nb8", "custom_b1_f1_c_58_-101_wov", 3.1);
        g.addEdge("custom_b1_f1_c_58_-72_tpz", "custom_b1_f1_c_58_-101_wov", 2.9);
        g.addEdge("outdoor_court_north", "outdoor_node_90724", 25.701750913118737);
        g.addEdge("outdoor_court_north", "outdoor_b4_porch_corner", 8.2);
        g.addEdge("outdoor_court_north", "outdoor_node_74046", 17.8);
        g.addEdge("outdoor_node_90724", "outdoor_node_78", 22.200900882621855);
        g.addEdge("outdoor_node_90724", "outdoor_node_74046", 11);
        g.addEdge("outdoor_node_78", "outdoor_node_52241", 12.700000000000003);
        g.addEdge("outdoor_node_78", "outdoor_node_79023", 4.669047011971498);
        g.addEdge("outdoor_node_79023", "outdoor_node_81120", 3.8209946349085606);
        g.addEdge("outdoor_node_52241", "custom_b4_f1_c_438_-321_ent", 0.5);
        g.addEdge("b4_f1_porch", "outdoor_b4_porch_corner", 4.1);
        g.addEdge("b4_f1_stair_lk1", "b4_f1_stair_lk1_door", 0.9);
        g.addEdge("b4_f1_stair_lk1_door", "b4_f1_foyer_center", 1.8);
        g.addEdge("b4_f1_foyer_center", "b4_f1_foyer_entrance", 3.3);
        g.addEdge("custom_b4_f1_c_406_-322_sat", "b4_f1_foyer_center", 1.2);
        g.addEdge("custom_b4_f1_c_406_-322_sat", "custom_b4_f1_c_438_-321_ent", 3.1);
        g.addEdge("b4_f1_foyer_entrance", "custom_b4_f1_c_438_-321_ent", 0.1);
        g.addEdge("b4_f1_foyer_center", "b4_f1_foyer_door_102", 4.5);
        g.addEdge("b4_f1_foyer_door_102", "b4_f1_door_102_inside", 1);
        g.addEdge("b4_f1_door_102_inside", "room_4_1_184", 10.1);
        g.addEdge("b4_f1_door_102_inside", "b4_f1_c_102_east", 14.8);
        g.addEdge("b4_f1_c_102_east", "room_4_1_184", 8.2);
        g.addEdge("b4_f1_c_102_east", "door_102_to_18", 1);
        g.addEdge("b4_f1_c_dining_center", "b4_f1_door_102_inside", 10.1);
        g.addEdge("room_4_1_184", "b4_f1_c_dining_center", 0.1);
        g.addEdge("b4_f1_stair_lk3", "b4_f1_stair_lk3_door", 2.2);
        g.addEdge("b4_f1_stair_lk3_door", "b4_f1_lk3_south_corr", 1);
        g.addEdge("b4_f1_lk3_south_corr", "b4_f1_c_102_east", 6.3);
        g.addEdge("b4_f1_foyer_center", "b4_f1_c_366_320", 2.4);
        g.addEdge("b4_f1_c_366_320", "b4_f1_c_366_334", 0.9);
        g.addEdge("b4_f1_c_366_334", "door_room_4_1_183", 0.85);
        g.addEdge("door_room_4_1_183", "room_4_1_183", 2.5);
        g.addEdge("b4_f1_c_366_334", "b4_f1_c_366_400", 6.4);
        g.addEdge("b4_f1_c_366_400", "door_room_4_1_182", 0.85);
        g.addEdge("door_room_4_1_182", "room_4_1_182", 2.5);
        g.addEdge("b4_f1_c_366_400", "b4_f1_c_366_424", 3.85);
        g.addEdge("b4_f1_c_366_424", "door_room_4_1_187", 0.85);
        g.addEdge("door_room_4_1_187", "room_4_1_187", 1.2);
        g.addEdge("b4_f1_c_366_424", "b4_f1_c_366_439", 1.55);
        g.addEdge("b4_f1_c_366_439", "b4_f1_c_366_462", 0.9);
        g.addEdge("b4_f1_c_366_462", "door_room_4_1_188", 0.85);
        g.addEdge("door_room_4_1_188", "room_4_1_188", 0.9);
        g.addEdge("b4_f1_foyer_center", "door_room_4_1_186", 3.2);
        g.addEdge("door_room_4_1_186", "room_4_1_186", 2);
        g.addEdge("b4_f1_porch", "b4_f1_stair_lk2_north_door", 1.6);
        g.addEdge("b4_f1_stair_lk2_north_door", "b4_f1_stair_lk2_north_turn", 1.4);
        g.addEdge("b4_f1_stair_lk2_north_turn", "b4_f1_nc_324", 2.3);
        g.addEdge("b4_f1_nc_324", "b4_f1_stair_lk2", 4.3);
        g.addEdge("b4_f1_stair_lk2", "b4_f1_vest_w_north", 1.2);
        g.addEdge("b4_f1_vest_w_north", "b4_f1_vest_w_door_n", 1.1);
        g.addEdge("b4_f1_vest_w_door_n", "b4_f1_vest_w_center", 1.5);
        g.addEdge("b4_f1_vest_w_center", "b4_f1_vest_w_door_e", 0.5);
        g.addEdge("b4_f1_vest_w_center", "b4_f1_c_366_439", 3.15);
        g.addEdge("door_room_4_1_198", "room_4_1_198", 2.7);
        g.addEdge("door_room_4_1_198", "b4_f1_c401_500", 0.9);
        g.addEdge("b4_f1_c401_500", "b4_f1_c401_513", 1.3);
        g.addEdge("b4_f1_c401_513", "door_room_4_1_199", 0.9);
        g.addEdge("door_room_4_1_199", "room_4_1_199", 1.8);
        g.addEdge("b4_f1_c401_513", "b4_f1_c401_518", 0.5);
        g.addEdge("b4_f1_c401_518", "door_room_4_1_191", 0.9);
        g.addEdge("door_room_4_1_191", "room_4_1_191", 1.3);
        g.addEdge("b4_f1_c401_518", "b4_f1_c401_525", 0.7);
        g.addEdge("b4_f1_c401_525", "door_room_4_1_200", 0.9);
        g.addEdge("door_room_4_1_200", "room_4_1_200", 1.8);
        g.addEdge("b4_f1_c401_525", "b4_f1_c401_535", 1);
        g.addEdge("b4_f1_c401_535", "b4_f1_c401_537", 0.2);
        g.addEdge("b4_f1_c401_537", "door_room_4_1_201", 0.9);
        g.addEdge("door_room_4_1_201", "room_4_1_201", 1.8);
        g.addEdge("b4_f1_c401_537", "b4_f1_door_step_7_8", 0.65);
        g.addEdge("b4_f1_door_step_7_8", "b4_f1_c416_548", 1.8);
        g.addEdge("b4_f1_c416_548", "door_room_4_1_202", 0.95);
        g.addEdge("door_room_4_1_202", "room_4_1_202", 2.6);
        g.addEdge("b4_f1_c416_548", "b4_f1_c416_561", 1.3);
        g.addEdge("b4_f1_c416_561", "door_room_4_1_203", 0.95);
        g.addEdge("door_room_4_1_203", "room_4_1_203", 2.6);
        g.addEdge("b4_f1_c416_561", "b4_f1_c416_574", 1.55);
        g.addEdge("b4_f1_c416_574", "b4_f1_door_13_west", 0.95);
        g.addEdge("b4_f1_door_13_west", "b4_f1_vest_13", 1.4);
        g.addEdge("b4_f1_vest_13", "door_room_4_1_205", 0.35);
        g.addEdge("door_room_4_1_205", "room_4_1_205", 0.95);
        g.addEdge("b4_f1_c416_574", "b4_f1_c416_578", 0.2);
        g.addEdge("b4_f1_c416_578", "door_room_4_1_204", 0.95);
        g.addEdge("door_room_4_1_204", "room_4_1_204", 2.8);
        g.addEdge("b4_f1_c401_535", "b4_f1_kc_443", 4.2);
        g.addEdge("b4_f1_kc_443", "b4_f1_pass_12_15", 2.4);
        g.addEdge("b4_f1_pass_12_15", "b4_f1_door_vest_north", 1.5);
        g.addEdge("b4_f1_door_vest_north", "b4_f1_vest_3_11", 2.05);
        g.addEdge("b4_f1_vest_3_11", "door_room_4_1_190", 1.35);
        g.addEdge("door_room_4_1_190", "room_4_1_190", 1.75);
        g.addEdge("b4_f1_vest_3_11", "door_room_4_1_189", 1.45);
        g.addEdge("door_room_4_1_189", "room_4_1_189", 1.7);
        g.addEdge("b4_f1_kc_443", "b4_f1_kc_467", 2.45);
        g.addEdge("b4_f1_kc_467", "b4_f1_open_pass_20", 0.8);
        g.addEdge("b4_f1_open_pass_20", "b4_f1_pass_20", 1.9);
        g.addEdge("b4_f1_pass_20", "door_room_4_1_206", 1.35);
        g.addEdge("door_room_4_1_206", "room_4_1_206", 1.1);
        g.addEdge("room_4_1_206", "b4_f1_20_south", 1.45);
        g.addEdge("b4_f1_20_south", "door_room_4_1_206_207", 1.1);
        g.addEdge("door_room_4_1_206_207", "b4_f1_21_south", 1);
        g.addEdge("b4_f1_21_south", "room_4_1_207", 1.45);
        g.addEdge("room_4_1_207", "door_room_4_1_207_24", 1.4);
        g.addEdge("door_room_4_1_207_24", "room_4_1_208", 5.3);
        g.addEdge("b4_f1_kc_467", "b4_f1_kc_472", 0.45);
        g.addEdge("b4_f1_kc_472", "door_room_4_1_193", 0.9);
        g.addEdge("door_room_4_1_193", "room_4_1_193", 1.5);
        g.addEdge("b4_f1_kc_472", "b4_f1_kc_499", 2.7);
        g.addEdge("b4_f1_kc_499", "door_room_4_1_194", 0.9);
        g.addEdge("door_room_4_1_194", "room_4_1_194", 1.5);
        g.addEdge("b4_f1_kc_499", "b4_f1_kc_550", 5.1);
        g.addEdge("b4_f1_kc_550", "b4_f1_kc_564_528", 1.6);
        g.addEdge("b4_f1_kc_564_528", "door_room_4_1_208", 0.8);
        g.addEdge("door_room_4_1_208", "room_4_1_208", 3.3);
        g.addEdge("room_4_1_208", "door_room_4_1_209", 3.2);
        g.addEdge("door_room_4_1_209", "room_4_1_209", 1.3);
        g.addEdge("room_4_1_208", "door_room_4_1_210", 5.2);
        g.addEdge("door_room_4_1_210", "room_4_1_210", 1.1);
        g.addEdge("door_room_4_1_208", "b4_f1_kc_564_506", 1.4);
        g.addEdge("b4_f1_kc_564_506", "door_room_4_1_195", 2.2);
        g.addEdge("door_room_4_1_195", "room_4_1_195", 1.8);
        g.addEdge("b4_f1_kc_564_506", "door_room_4_1_197", 1.4);
        g.addEdge("door_room_4_1_197", "room_4_1_197", 2.2);
        g.addEdge("b4_f1_kc_564_506", "b4_f1_kc_571_477", 3);
        g.addEdge("b4_f1_kc_571_477", "door_room_4_1_192_east", 1.7);
        g.addEdge("door_room_4_1_192_east", "room_4_1_192", 5.2);
        g.addEdge("b4_f1_kc_571_477", "door_room_4_1_196", 1.9);
        g.addEdge("door_room_4_1_196", "room_4_1_196", 1.6);
        g.addEdge("b4_f1_kc_571_477", "door_102_to_18", 2.3);
        g.addEdge("b3_f2_c_-45.5", "bridge_k3_k4_f2", 17.3);
        g.addEdge("bridge_k3_k4_f2", "room_4_2_213", 0.8);
        g.addEdge("room_4_2_213", "b4_f2_bridge_k3_door", 8.4);
        g.addEdge("bridge_k3_k4_f2", "b4_f2_bridge_k3_door", 9.2);
        g.addEdge("b4_f2_bridge_k3_door", "b4_f2_vest_k3", 2.4);
        g.addEdge("b4_f2_vest_k3", "b4_f2_door_vest_k3", 1.2);
        g.addEdge("b4_f2_door_vest_k3", "b4_f2_c_375_455", 1.5);
        g.addEdge("b2_f2_c_37.5", "bridge_k4_k2_f2", 14.8);
        g.addEdge("bridge_k4_k2_f2", "room_4_2_214", 0.1);
        g.addEdge("bridge_k4_k2_f2", "b4_f2_sw_-27.4", 6.8);
        g.addEdge("room_4_2_214", "b4_f2_sw_-27.4", 6.8);
        g.addEdge("b4_f2_stair_lk2", "b4_f2_stair_lk2_door", 1.2);
        g.addEdge("b4_f2_stair_lk2_door", "b4_f2_c_375_483", 1.5);
        g.addEdge("b4_f2_c_375_483", "b4_f2_c_375_455", 2.8);
        g.addEdge("b4_f2_c_375_455", "b4_f2_sw_-44.5", 0.8);
        g.addEdge("b4_f2_sw_-44.5", "b4_f2_c_375_396", 5.1);
        g.addEdge("b4_f2_c_375_396", "b4_f2_c_375_349", 4.7);
        g.addEdge("b4_f2_c_375_349", "b4_f2_c_375_330", 1.9);
        g.addEdge("b4_f2_c_375_330", "b4_f2_c_375_291", 3.9);
        g.addEdge("b4_f2_c_375_291", "b4_f2_sw_-27.4", 1.7);
        g.addEdge("b4_f2_stair_lk1", "b4_f2_stair_lk1_door", 1.1);
        g.addEdge("b4_f2_stair_lk1_door", "b4_f2_c_lk1", 1.8);
        g.addEdge("b4_f2_c_375_330", "b4_f2_c_lk1", 3.1);
        g.addEdge("b4_f2_c_lk1", "b4_f2_c_473_330", 6.75);
        g.addEdge("b4_f2_c_473_330", "b4_f2_c_473_358", 2.8);
        g.addEdge("b4_f2_c_375_483", "b4_f2_door_gym_w", 1.6);
        g.addEdge("b4_f2_door_gym_w", "room_4_2_211", 12.6);
        g.addEdge("room_4_2_211", "b4_f2_door_service_n", 6.1);
        g.addEdge("b4_f2_door_service_n", "room_4_2_service", 2.3);
        g.addEdge("room_4_2_211", "door_mid_room_4_2_211", 14.9);
        g.addEdge("door_mid_room_4_2_211", "b4_f2_vest_lk3", 2.1);
        g.addEdge("b4_f2_stair_lk3", "b4_f2_stair_lk3_door", 0.9);
        g.addEdge("b4_f2_stair_lk3_door", "b4_f2_vest_lk3", 0.7);
        g.addEdge("b4_f2_vest_lk3", "b4_f2_door_vest_lk3_s", 2.3);
        g.addEdge("b4_f2_door_vest_lk3_s", "b4_f2_c_629", 0.7);
        g.addEdge("b4_f2_sw_-44.5", "b4_f2_c_410_447", 3.5);
        g.addEdge("b4_f2_c_410_447", "b4_f2_c_410_460", 1.35);
        g.addEdge("b4_f2_c_410_460", "b4_f2_c_410_491", 3.1);
        g.addEdge("b4_f2_c_410_491", "b4_f2_door_wc_n", 1);
        g.addEdge("b4_f2_door_wc_n", "room_4_2_wc_north", 1.8);
        g.addEdge("b4_f2_c_410_460", "b4_f2_door_wc_s", 1);
        g.addEdge("b4_f2_door_wc_s", "room_4_2_wc_south", 1.8);
        g.addEdge("b4_f2_c_410_447", "b4_f2_c_424_447", 1.46);
        g.addEdge("b4_f2_c_424_447", "door_room_4_2_215", 1.04);
        g.addEdge("door_room_4_2_215", "b4_f2_c_473_447", 3.85);
        g.addEdge("b4_f2_c_473_447", "b4_f2_c_537_447", 6.35);
        g.addEdge("b4_f2_c_537_447", "b4_f2_c_551_447", 1.4);
        g.addEdge("b4_f2_c_551_447", "b4_f2_c_612_447", 6.15);
        g.addEdge("b4_f2_c_612_447", "b4_f2_c_629", 1.65);
        g.addEdge("b4_f2_c_629", "b4_f2_c_634_447", 0.5);
        g.addEdge("b4_f2_c_424_447", "b4_f2_recess_207_208", 1.5);
        g.addEdge("b4_f2_recess_207_208", "door_room_room_4_2_225", 1.11);
        g.addEdge("door_room_room_4_2_225", "b4_f2_207_n", 0.85);
        g.addEdge("b4_f2_207_n", "room_4_2_225", 4.6);
        g.addEdge("b4_f2_recess_207_208", "door_corr_room_4_2_226", 1.1);
        g.addEdge("door_corr_room_4_2_226", "b4_f2_208_n", 0.84);
        g.addEdge("b4_f2_208_n", "room_4_2_226", 4.6);
        g.addEdge("b4_f2_c_473_447", "b4_f2_door_209", 0.7);
        g.addEdge("b4_f2_door_209", "room_4_2_227", 1.7);
        g.addEdge("b4_f2_c_473_358", "b4_f2_door_203", 1.5);
        g.addEdge("b4_f2_door_203", "room_4_2_228", 1.7);
        g.addEdge("b4_f2_c_537_447", "door_room_room_4_2_218", 0.7);
        g.addEdge("door_room_room_4_2_218", "room_4_2_218", 2.4);
        g.addEdge("b4_f2_c_551_447", "door_room_room_4_2_219", 0.7);
        g.addEdge("door_room_room_4_2_219", "b4_f2_211_s", 1.4);
        g.addEdge("b4_f2_211_s", "room_4_2_219", 1.8);
        g.addEdge("b4_f2_c_612_447", "door_room_4_2_212", 0.7);
        g.addEdge("door_room_4_2_212", "b4_f2_212_s", 1.4);
        g.addEdge("b4_f2_212_s", "room_4_2_212", 1.8);
        g.addEdge("b4_f2_212_s", "room_4_2_220", 1.8);
        g.addEdge("b4_f2_c_375_396", "door_mid_room_4_2_222", 1.5);
        g.addEdge("door_mid_room_4_2_222", "door_room_room_4_2_222", 0.5);
        g.addEdge("door_room_room_4_2_222", "room_4_2_222", 2.1);
        g.addEdge("b4_f2_c_375_349", "door_mid_room_4_2_223", 1.5);
        g.addEdge("door_mid_room_4_2_223", "door_room_room_4_2_223", 0.5);
        g.addEdge("door_room_room_4_2_223", "room_4_2_223", 1.9);
        g.addEdge("b4_f2_c_375_291", "door_mid_room_4_2_224", 1.5);
        g.addEdge("door_mid_room_4_2_224", "door_room_room_4_2_224", 0.5);
        g.addEdge("door_room_room_4_2_224", "room_4_2_224", 1.3);
        g.addEdge("b4_f2_c_473_358", "b4_f2_door_204_w", 1.65);
        g.addEdge("b4_f2_door_204_w", "room_4_2_230", 6);
        g.addEdge("b4_f2_c_634_447", "b4_f2_door_204_n", 0.7);
        g.addEdge("b4_f2_door_204_n", "room_4_2_230", 11.9);
        g.addEdge("b4_f3_stair_lk2", "b4_f3_stair_lk2_door", 1.2);
        g.addEdge("b4_f3_stair_lk2_door", "b4_f3_c_377_481", 1.7);
        g.addEdge("b4_f3_c_377_489", "b4_f3_c_377_481", 0.8);
        g.addEdge("b4_f3_c_377_481", "b4_f3_c_377_443", 3.8);
        g.addEdge("b4_f3_c_377_443", "b4_f3_c_377_426", 1.7);
        g.addEdge("b4_f3_c_377_426", "b4_f3_c_377_407", 1.9);
        g.addEdge("b4_f3_c_377_407", "b4_f3_c_377_383", 2.4);
        g.addEdge("b4_f3_c_377_383", "b4_f3_sw_-38.0", 0.5);
        g.addEdge("b4_f3_sw_-38.0", "b4_f3_c_377_334", 4.4);
        g.addEdge("b4_f3_c_377_334", "b4_f3_c_377_311", 2.3);
        g.addEdge("b4_f3_c_377_311", "b4_f3_c_377_303", 0.8);
        g.addEdge("b4_f3_c_377_489", "b4_f3_door_301_w", 1.7);
        g.addEdge("b4_f3_door_301_w", "room_4_3_237", 9.4);
        g.addEdge("room_4_3_237", "b4_f3_door_301_e", 9.6);
        g.addEdge("b4_f3_door_301_e", "b4_f3_vest_lk3", 1.7);
        g.addEdge("b4_f3_vest_lk3", "b4_f3_stair_lk3_door", 1.8);
        g.addEdge("b4_f3_stair_lk3_door", "b4_f3_stair_lk3", 0.9);
        g.addEdge("b4_f3_c_377_443", "door_mid_room_4_3_239", 1.7);
        g.addEdge("door_mid_room_4_3_239", "room_4_3_239", 4.9);
        g.addEdge("room_4_3_239", "b4_f3_door_303_302", 3.5);
        g.addEdge("b4_f3_door_303_302", "room_4_3_238", 4.3);
        g.addEdge("b4_f3_c_377_426", "b4_f3_door_hall_305", 1.7);
        g.addEdge("b4_f3_door_hall_305", "b4_f3_c_440_425", 4.6);
        g.addEdge("b4_f3_c_440_425", "b4_f3_door_305", 1.4);
        g.addEdge("b4_f3_door_305", "room_4_3_240", 2.1);
        g.addEdge("b4_f3_c_377_407", "b4_f3_door_wc_n", 1.7);
        g.addEdge("b4_f3_door_wc_n", "b4_f3_wc_n_in", 1.1);
        g.addEdge("b4_f3_wc_n_in", "b4_f3_door_wc_n_inner", 1);
        g.addEdge("b4_f3_door_wc_n_inner", "room_4_3_244", 0.9);
        g.addEdge("b4_f3_sw_-38.0", "b4_f3_door_wc_s", 1.7);
        g.addEdge("b4_f3_door_wc_s", "b4_f3_wc_s_in", 1.1);
        g.addEdge("b4_f3_wc_s_in", "b4_f3_door_wc_s_inner", 1);
        g.addEdge("b4_f3_door_wc_s_inner", "room_4_3_245", 0.95);
        g.addEdge("b4_f3_c_377_426", "door_room_room_4_3_246", 1.7);
        g.addEdge("door_room_room_4_3_246", "room_4_3_246", 2.4);
        g.addEdge("b4_f3_c_377_383", "door_mid_room_4_3_247", 1.7);
        g.addEdge("door_mid_room_4_3_247", "room_4_3_247", 2.1);
        g.addEdge("b4_f3_c_377_334", "door_mid_room_4_3_248", 1.7);
        g.addEdge("door_mid_room_4_3_248", "room_4_3_248", 2.2);
        g.addEdge("b4_f3_c_377_311", "door_mid_room_4_3_249", 1.7);
        g.addEdge("door_mid_room_4_3_249", "room_4_3_249", 2.2);
        g.addEdge("b4_f3_c_377_303", "b4_f3_door_corr_303", 1.7);
        g.addEdge("b4_f3_door_corr_303", "b4_f3_c_406_303", 1.2);
        g.addEdge("b4_f3_c_406_303", "b4_f3_stair_lk1_door", 0.7);
        g.addEdge("b4_f3_stair_lk1_door", "b4_f3_stair_lk1", 1.1);
        g.addEdge("b4_f3_c_406_303", "b4_f3_c_435_303", 2.9);
        g.addEdge("b4_f3_c_435_303", "b4_f3_door_310", 0.7);
        g.addEdge("b4_f3_door_310", "room_4_3_243", 1.2);
        g.addEdge("room_4_3_243", "b4_f3_door_311", 1.5);
        g.addEdge("b4_f3_door_311", "room_4_3_242", 1.8);
        g.addEdge("b4_f3_c_435_303", "b4_f3_door_ante_312", 1.9);
        g.addEdge("b4_f3_door_ante_312", "b4_f3_ante_312_s", 0.75);
        g.addEdge("b4_f3_ante_312_s", "b4_f3_ante_312_n", 1.9);
        g.addEdge("b4_f3_ante_312_n", "door_mid_room_4_3_241", 0.7);
        g.addEdge("door_mid_room_4_3_241", "room_4_3_241", 3.4);
        g.addEdge("b4_f1_stair_lk1", "b4_f2_stair_lk1", 5.5);
        g.addEdge("b4_f2_stair_lk1", "b4_f3_stair_lk1", 5.5);
        g.addEdge("b4_f1_stair_lk2", "b4_f2_stair_lk2", 5.5);
        g.addEdge("b4_f2_stair_lk2", "b4_f3_stair_lk2", 5.5);
        g.addEdge("b4_f1_stair_lk3", "b4_f2_stair_lk3", 5.5);
        g.addEdge("b4_f2_stair_lk3", "b4_f3_stair_lk3", 5.5);
        
        // --- Гараж (хозяйственное строение, заезд с северного проезда) ---
        // bldg: 5 — корректный идентификатор корпуса 5 (был bldg: 0, что делало
        // узлы недостижимыми через findClosestNode при фильтрации по корпусу).
        g.addNode("b5_f1_interior", 1, 5, 11.0, -68.7, "corridor", "Гараж");
        g.addNode("b5_f1_gate", 1, 5, 14.0, -68.7, "door", "Въезд в гараж");
        g.addNode("outdoor_b5_apron", 1, 5, 16.5, -68.7, "corridor", "Подъезд к гаражу");
        g.addNode("outdoor_b5_junc", 1, 5, 19.0, -68.7, "corridor", "Проезд к гаражу");

        g.addEdge("outdoor_court_north", "outdoor_b5_junc", 23.5);
        g.addEdge("outdoor_b5_junc", "outdoor_b5_apron", 2.5);
        g.addEdge("outdoor_b5_apron", "b5_f1_gate", 2.5);
        g.addEdge("b5_f1_gate", "b5_f1_interior", 3.0);

        return g;
    }




    // ------------------------------------------------------------------------
    // ПОИСК БЛИЖАЙШЕГО ТУАЛЕТА (С/У) — ищем напрямую по узлам графа.
    // Прежняя реализация генерировала ID через ROOMS_REGISTRY.indexOf(),
    // что никогда не совпадало с именованными ID туалетных узлов в графе
    // (например room_4_2_wc_north, b1_f1_wc_1.7 и т.д.).
    // Теперь поиск ведётся непосредственно по g.nodes — ID гарантированно валиден для A*.
    // ------------------------------------------------------------------------
    function findClosestToilet(fromPoint) {
        if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
        const g = NAV_STATE.graph;

        let startP = fromPoint;
        if (!startP) {
            startP = g.getNode('b3_f1_entrance_west') || g.getNode('b1_f1_entrance_main');
        }
        if (!startP) return null;

        const startFloor = startP.floor || 1;
        const startBldg = startP.bldg || startP.building || 1;
        const startX = startP.x !== undefined ? startP.x : 10.5;
        const startZ = startP.z !== undefined ? startP.z : 10.4;

        // Собираем туалетные узлы прямо из графа — их ID валидны для A*.
        // Узел считается туалетом, если его ID содержит '_wc_', тип 'wc',
        // или label === 'С/У' / 'С/У'.
        let bestNode = null;
        let bestScore = Infinity;

        for (const [nid, node] of g.nodes.entries()) {
            const lbl = (node.label || '').trim();
            const isWC = node.type === 'wc'
                || nid.includes('_wc_')
                || lbl.startsWith('С/У')
                || lbl.startsWith('\u0421/\u0423')
                || lbl.toLowerCase().includes('туалет')
                || lbl.toLowerCase().includes('санузел');
            if (!isWC) continue;

            const floorDiff = Math.abs(node.floor - startFloor);
            const bldgDiff = (node.bldg === startBldg) ? 0 : 1;
            const geomDist = Math.hypot(node.x - startX, node.z - startZ);
            // Штраф за смену этажа (50м) и переход в другой корпус (80м) для приоритета текущего этажа
            const score = geomDist + floorDiff * 50.0 + bldgDiff * 80.0;
            if (score < bestScore) {
                bestScore = score;
                bestNode = node;
            }
        }

        return bestNode;
    }

    function setDefaultStartPoint() {
        if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
        const entrance = NAV_STATE.graph.getNode('b3_f1_entrance_west') || NAV_STATE.graph.getNode('b1_f1_entrance_main');
        if (entrance && !NAV_STATE.startPoint) {
            NAV_STATE.startPoint = entrance;
            const inputA = document.getElementById('nav-input-start');
            if (inputA && !inputA.value) {
                inputA.value = 'Главный вход (Корпус 3 / Западный)';
                inputA.setAttribute('data-is-default', 'true');
                const btnClearA = document.getElementById('btn-clear-start');
                if (btnClearA) btnClearA.classList.remove('hidden');
            }
        }
    }

    // ------------------------------------------------------------------------
    function formatNavNodeName(lbl, bldg) {
        if (!lbl) return '';
        const raw = String(lbl).trim();
        const b = parseInt(bldg, 10);
        if (b <= 1 || isNaN(b)) return raw;
        if (raw.startsWith('2-') || raw.startsWith('3-') || raw.startsWith('4-')) return raw;
        if (/^\d+[а-яa-z]?$/i.test(raw)) {
            return b + '-' + raw;
        }
        return raw;
    }

    function formatNavInputString(nodeOrPoint) {
        if (!nodeOrPoint) return '';
        const rawLbl = nodeOrPoint.label || nodeOrPoint.text || '';
        const b = parseInt(nodeOrPoint.bldg !== undefined ? nodeOrPoint.bldg : nodeOrPoint.building, 10);
        const f = parseInt(nodeOrPoint.floor, 10);
        const disp = formatNavNodeName(rawLbl, b);
        const isNum = /^\d/.test(disp) || /^[2-4]-\d/.test(disp);
        if (isNum) {
            return disp;
        }
        if (b > 0 && f > 0) {
            return disp + ' (' + (b > 1 ? 'Корпус ' + b + ', ' : '') + f + ' этаж)';
        }
        return disp;
    }
    // АЛГОРИТМ A* (A-STAR) ПОИСКА КРАТЧАЙШЕГО ПУТИ
    // ------------------------------------------------------------------------
    function aStarPath(graph, startId, destId, options = {}) {
        const startNode = graph.getNode(startId);
        const destNode = graph.getNode(destId);
        if (!startNode || !destNode) return null;
        if (startId === destId) return { path: [startId], totalDistance: 0 };

        const allowElev = (options && options.allowElevators !== undefined) ? options.allowElevators : NAV_STATE.allowElevators;

        const frontier = new MinHeap();
        const cameFrom = new Map();
        const costSoFar = new Map();

        frontier.push(startId, 0);
        cameFrom.set(startId, null);
        costSoFar.set(startId, 0);

        const destX = destNode.x;
        const destZ = destNode.z;
        const destFloor = destNode.floor;

        function heuristic(uId) {
            const u = graph.getNode(uId);
            if (!u) return 0;
            const dx = u.x - destX;
            const dz = u.z - destZ;
            const df = Math.abs(u.floor - destFloor);
            return Math.hypot(dx, dz) + df * 5.0;
        }

        const settled = new Set();

        while (!frontier.isEmpty()) {
            const current = frontier.pop();
            if (current === destId) break;
            // Ленивое удаление дубликатов из MinHeap: исключаем повторное раскрытие уже посещенных вершин
            if (settled.has(current)) continue;
            settled.add(current);

            const neighbors = graph.adj.get(current) || [];
            const currentCost = costSoFar.get(current);

            for (let i = 0; i < neighbors.length; i++) {
                const edge = neighbors[i];
                // Если лифты выключены пользователем, пропускаем лифтовые рёбра
                if (edge.isElevator && !allowElev) continue;

                const nxt = edge.to;
                const newCost = currentCost + edge.weight;

                if (!costSoFar.has(nxt) || newCost < costSoFar.get(nxt)) {
                    costSoFar.set(nxt, newCost);
                    cameFrom.set(nxt, current);
                    const priority = newCost + heuristic(nxt);
                    frontier.push(nxt, priority);
                }
            }
        }

        if (!cameFrom.has(destId)) return null;

        // Восстановление пути с защитой от циклов и разрывов
        const path = [];
        const visited = new Set();
        let curr = destId;
        const maxSteps = (graph.nodes && graph.nodes.size) ? graph.nodes.size : 2000;
        while (curr !== null && curr !== undefined && !visited.has(curr) && path.length < maxSteps) {
            visited.add(curr);
            path.push(curr);
            curr = cameFrom.get(curr);
        }
        if (curr !== null) {
            console.warn('[MGKCT Navigator] Предупреждение: обнаружен цикл или разрыв цепи при восстановлении пути для узла:', curr);
            return null;
        }
        path.reverse();

        return {
            path,
            totalDistance: costSoFar.get(destId)
        };
    }

    // ------------------------------------------------------------------------
    // ГЕНЕРАТОР ПОШАГОВЫХ ТЕКСТОВЫХ ИНСТРУКЦИЙ (ПО-РУССКИ)
    // ------------------------------------------------------------------------
    function generateRouteInstructions(graph, path) {
        if (!path || path.length < 2) return [];

        const instructions = [];
        const startNode = graph.getNode(path[0]);
        const destNode = graph.getNode(path[path.length - 1]);

        instructions.push({
            type: 'start',
            icon: '<svg class="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#c2e7ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6z" /></svg>',
            text: `Начните движение от: ${formatNavNodeName(startNode.label, startNode.bldg)}` + (startNode.bldg > 1 && !/^[2-4]-\d/.test(formatNavNodeName(startNode.label, startNode.bldg)) ? ` (Корпус ${startNode.bldg})` : ``) + `, Этаж ${startNode.floor}`,
            floor: startNode.floor,
            bldg: startNode.bldg,
            nodeId: path[0]
        });

        let currentFloor = startNode.floor;
        let currentBldg = startNode.bldg;
        let distAccum = 0;

        for (let i = 1; i < path.length; i++) {
            const prev = graph.getNode(path[i - 1]);
            const curr = graph.getNode(path[i]);
            const segDist = Math.hypot(curr.x - prev.x, curr.z - prev.z);

            // 1. Смена этажа (Лестница или Лифт)
            if (curr.floor !== prev.floor) {
                if (distAccum > 1.0) {
                    instructions.push({
                        type: 'corridor',
                        icon: '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>',
                        text: `Идите по коридору ${Math.round(distAccum)} м`,
                        floor: prev.floor,
                        bldg: prev.bldg,
                        nodeId: prev.id
                    });
                    distAccum = 0;
                }

                const isUp = curr.floor > prev.floor;
                const isElev = prev.type === 'elevator' || curr.type === 'elevator';
                const actionVerb = isElev ? 'Воспользуйтесь лифтом до' : (isUp ? 'Поднимитесь по лестнице на' : 'Спуститесь по лестнице на');
                const stairName = prev.label.includes('ЛК') ? prev.label : 'лестнице';

                instructions.push({
                    type: isUp ? 'stair_up' : 'stair_down',
                    icon: isElev ? '<svg class="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#c2e7ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>' : '<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>',
                    text: `${actionVerb} ${curr.floor} этаж (${stairName})`,
                    floor: curr.floor,
                    bldg: curr.bldg,
                    nodeId: curr.id,
                    isElevator: isElev
                });

                currentFloor = curr.floor;
                currentBldg = curr.bldg;
                continue;
            }

            // 2. Смена корпуса через надземный переход
            if (curr.bldg !== prev.bldg || curr.type === 'bridge' || prev.type === 'bridge') {
                if (curr.bldg !== currentBldg) {
                    if (distAccum > 1.0) {
                        instructions.push({
                            type: 'corridor',
                            icon: '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>',
                            text: `Идите по коридору ${Math.round(distAccum)} м`,
                            floor: prev.floor,
                            bldg: prev.bldg,
                            nodeId: prev.id
                        });
                        distAccum = 0;
                    }

                    instructions.push({
                        type: 'bridge',
                        icon: '<svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>',
                        text: `Пройдите по переходу на 2 этаже в Корпус ${curr.bldg}`,
                        floor: 2,
                        bldg: curr.bldg,
                        nodeId: curr.id
                    });

                    currentBldg = curr.bldg;
                    continue;
                }
            }

            distAccum += segDist;

            // 3. Последний шаг — вход в целевой кабинет
            if (i === path.length - 1) {
                if (distAccum > 2.0) {
                    instructions.push({
                        type: 'corridor',
                        icon: '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>',
                        text: `Идите прямо ${Math.round(distAccum)} м`,
                        floor: curr.floor,
                        bldg: curr.bldg,
                        nodeId: curr.id
                    });
                }
            }
        }

        instructions.push({
            type: 'destination',
            icon: '<svg class="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#c2e7ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" fill="currentColor" /></svg>',
            text: `Вы прибыли: ${formatNavNodeName(destNode.label, destNode.bldg)}` + (destNode.bldg > 1 && !/^[2-4]-\d/.test(formatNavNodeName(destNode.label, destNode.bldg)) ? ` (Корпус ${destNode.bldg})` : ``) + `, Этаж ${destNode.floor}`,
            floor: destNode.floor,
            bldg: destNode.bldg,
            nodeId: path[path.length - 1]
        });

        return instructions;
    }

    // ------------------------------------------------------------------------
    // ПОСТРОЕНИЕ 3D-ВИЗУАЛИЗАЦИИ МАРШРУТА В СЦЕНЕ THREE.JS
    // ------------------------------------------------------------------------
    function clearRoute3D() {
        function disposeHierarchy(root) {
            if (!root) return;
            root.traverse((child) => {
                if (child.geometry && typeof child.geometry.dispose === 'function') {
                    child.geometry.dispose();
                }
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(m => {
                        if (!m) return;
                        if (m.map && typeof m.map.dispose === 'function') {
                            m.map.dispose();
                        }
                        if (typeof m.dispose === 'function') {
                            m.dispose();
                        }
                    });
                }
            });
        }

        // Удаляем объекты пути с каждого этажа и отсоединяем пустые группы
        for (let f = 1; f <= 7; f++) {
            const fg = NAV_STATE.routeFloorGroups[f];
            if (fg) {
                while (fg.children.length > 0) {
                    const obj = fg.children[0];
                    disposeHierarchy(obj);
                    fg.remove(obj);
                }
                if (fg.parent) {
                    fg.parent.remove(fg);
                }
            }
        }
        NAV_STATE.routeFloorGroups = {};

        // Удаляем глобальную группу межэтажных переходов в режиме 'all'
        if (NAV_STATE.globalRouteGroup && window.scene) {
            window.scene.remove(NAV_STATE.globalRouteGroup);
            while (NAV_STATE.globalRouteGroup.children.length > 0) {
                const obj = NAV_STATE.globalRouteGroup.children[0];
                disposeHierarchy(obj);
                NAV_STATE.globalRouteGroup.remove(obj);
            }
            NAV_STATE.globalRouteGroup = null;
        }

        if (NAV_STATE._pulsingObjects) {
            NAV_STATE._pulsingObjects.length = 0;
        }
        NAV_STATE.activeRoute = null;
        _badgeWidthCache.clear();
        if (typeof requestRender === 'function') requestRender(20);
    }

    function simplifyRoutePoints(points) {
        if (!points || points.length <= 2) return points || [];
        const clean = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = clean[clean.length - 1];
            const curr = points[i];
            const next = points[i + 1];

            const dx1 = curr.x - prev.x;
            const dz1 = curr.z - prev.z;
            const dx2 = next.x - curr.x;
            const dz2 = next.z - curr.z;

            const l1 = Math.hypot(dx1, dz1);
            const l2 = Math.hypot(dx2, dz2);

            // Пропускаем дубликаты точек ближе 4 см
            if (l1 < 0.04) continue;
            if (l2 < 0.04) continue;

            const dot = (dx1 * dx2 + dz1 * dz2) / (l1 * l2);
            // Если вектор направления не меняется — схлопываем промежуточную точку!
            if (dot > 0.996) {
                continue;
            }
            clean.push(curr);
        }
        clean.push(points[points.length - 1]);
        return clean;
    }

    function createFlatRibbonGeometry(pts, width, yElevation) {
        if (!pts || pts.length < 2) return null;
        const halfW = width / 2;
        const positions = [];
        const indices = [];

        // 1. Прямоугольные отрезки постоянной ширины вдоль всей траектории
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const dx = p1.x - p0.x;
            const dz = p1.z - p0.z;
            const len = Math.hypot(dx, dz);
            if (len < 1e-4) continue;

            const nx = (-dz / len) * halfW;
            const nz = (dx / len) * halfW;
            const baseIdx = positions.length / 3;

            positions.push(p0.x + nx, yElevation, p0.z + nz);
            positions.push(p0.x - nx, yElevation, p0.z - nz);
            positions.push(p1.x + nx, yElevation, p1.z + nz);
            positions.push(p1.x - nx, yElevation, p1.z - nz);

            indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
            indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
        }

        // 2. Круглые диски на всех поворотах и концах (Round Caps & Round Joins)
        // Гарантируют абсолютно плавные скругленные повороты и монолитную линию без изломов
        const circleSegments = 16;
        for (let i = 0; i < pts.length; i++) {
            const center = pts[i];
            const centerIdx = positions.length / 3;
            positions.push(center.x, yElevation, center.z);

            for (let s = 0; s <= circleSegments; s++) {
                const angle = (s / circleSegments) * Math.PI * 2;
                const rx = center.x + Math.cos(angle) * halfW;
                const rz = center.z + Math.sin(angle) * halfW;
                positions.push(rx, yElevation, rz);
            }

            for (let s = 0; s < circleSegments; s++) {
                indices.push(centerIdx, centerIdx + 1 + s, centerIdx + 2 + s);
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        return geom;
    }

    function createLuminousRouteMesh(rawPoints, colorHex = 0x0284c7) {
        if (!rawPoints || rawPoints.length < 2) return null;

        const points = simplifyRoutePoints(rawPoints);
        if (points.length < 2) return null;

        const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');
        const mainColor = isDark ? 0x38bdf8 : 0x0284c7;
        const coreColor = isDark ? 0xf0f9ff : 0xffffff;

        const group = new THREE.Group();

        // 1. Основная плоская светящаяся полоса на полу (ширина 0.34м, Y = 0.08)
        const baseGeom = createFlatRibbonGeometry(points, 0.34, 0.08);
        if (!baseGeom) return null;

        const baseMat = new THREE.MeshBasicMaterial({
            color: mainColor,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            depthTest: true
        });
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.renderOrder = 20;
        baseMesh.userData = { isRouteRibbonBase: true };
        group.add(baseMesh);

        // 2. Внутренняя контрастная сердцевина (ширина 0.12м, Y = 0.085)
        const coreGeom = createFlatRibbonGeometry(points, 0.12, 0.085);
        if (coreGeom) {
            const coreMat = new THREE.MeshBasicMaterial({
                color: coreColor,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                depthTest: true
            });
            const coreMesh = new THREE.Mesh(coreGeom, coreMat);
            coreMesh.renderOrder = 21;
            coreMesh.userData = { isRouteRibbonCore: true };
            group.add(coreMesh);
        }

        return group;
    }

    function createMarkerRing(colorHex, labelText = 'A', isPulsing = true) {
        const group = new THREE.Group();

        // 1. Внешнее светящееся кольцо на полу
        const ringGeom = new THREE.RingGeometry(0.55, 0.75, 32);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.08;
        group.add(ring);

        // 2. Внутренний залитый диск
        const diskGeom = new THREE.CircleGeometry(0.50, 32);
        diskGeom.rotateX(-Math.PI / 2);
        const diskMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.35
        });
        const disk = new THREE.Mesh(diskGeom, diskMat);
        disk.position.y = 0.07;
        group.add(disk);

        // 3. Вертикальный маячок
        const beaconGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 16);
        beaconGeom.translate(0, 0.6, 0);
        const beaconMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.85
        });
        const beacon = new THREE.Mesh(beaconGeom, beaconMat);
        group.add(beacon);

        // 4. Сфера на верхушке маяка
        const sphereGeom = new THREE.SphereGeometry(0.22, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sphere = new THREE.Mesh(sphereGeom, sphereMat);
        sphere.position.y = 1.25;
        group.add(sphere);

        group.userData = { ring, disk, beacon, sphere, baseColor: colorHex, isPulsing };
        return group;
    }

    function createStairTransitionMarker(text, isUp = true) {
        const group = new THREE.Group();
        const color = 0x38bdf8; // Голубой цвет лестницы

        // Кольцо у входа на лестницу
        const ringGeom = new THREE.RingGeometry(0.40, 0.55, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.06;
        group.add(ring);

        // Внутренний диск
        const diskGeom = new THREE.CircleGeometry(0.38, 24);
        diskGeom.rotateX(-Math.PI / 2);
        const diskMat = new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.35
        });
        const disk = new THREE.Mesh(diskGeom, diskMat);
        disk.position.y = 0.055;
        group.add(disk);

        return group;
    }

    function drawRoute3D(routeResult) {
        clearRoute3D();
        if (!routeResult || !routeResult.path || routeResult.path.length < 2) return;

        try {
            const g = NAV_STATE.graph;
            const nodes = routeResult.path.map(id => g.getNode(id));

        // Группируем последовательные отрезки пути по этажам
        const floorSegments = {};
        for (let f = 1; f <= 7; f++) {
            floorSegments[f] = [];
        }

        let currentFloor = nodes[0].floor;
        let currentPoints = [new THREE.Vector3(nodes[0].x, 0.14, nodes[0].z)];

        for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];

            if (curr.floor === prev.floor) {
                currentPoints.push(new THREE.Vector3(curr.x, 0.14, curr.z));
            } else {
                // Завершаем текущий отрезок на этом этаже
                if (currentPoints.length >= 2) {
                    floorSegments[currentFloor].push(currentPoints);
                }
                // Начинаем отрезок на новом этаже
                currentFloor = curr.floor;
                currentPoints = [new THREE.Vector3(curr.x, 0.14, curr.z)];
            }
        }
        if (currentPoints.length >= 2) {
            floorSegments[currentFloor].push(currentPoints);
        }

        function getOrCreateFloorRouteGroup(floorNum) {
            if (!NAV_STATE.routeFloorGroups[floorNum]) {
                const grp = new THREE.Group();
                grp.name = `routeGroup_floor_${floorNum}`;
                NAV_STATE.routeFloorGroups[floorNum] = grp;
            }
            const rGroup = NAV_STATE.routeFloorGroups[floorNum];
            if (window.floorGroups && window.floorGroups[floorNum]) {
                if (rGroup.parent !== window.floorGroups[floorNum]) {
                    window.floorGroups[floorNum].add(rGroup);
                }
            }
            return rGroup;
        }

        // Лениво рендерим 3D-путь только на тех этажах, где действительно есть геометрия
        for (let f = 1; f <= 7; f++) {
            const segs = floorSegments[f];
            if (segs && segs.length > 0) {
                const rGroup = getOrCreateFloorRouteGroup(f);
                for (const pts of segs) {
                    const mesh = createLuminousRouteMesh(pts);
                    if (mesh) rGroup.add(mesh);
                }
            }
        }

        // Маркер точки "А" (Откуда / первичный) — небесно-голубой
        const startNode = nodes[0];
        if (startNode) {
            const startGroup = getOrCreateFloorRouteGroup(startNode.floor);
            const startMarker = createMarkerRing(0x38bdf8, 'A', true);
            startMarker.position.set(startNode.x, 0.05, startNode.z);
            startGroup.add(startMarker);
        }

        // Маркер точки "Б" (Куда / конечный) — синий Google Blue
        const destNode = nodes[nodes.length - 1];
        if (destNode) {
            const destGroup = getOrCreateFloorRouteGroup(destNode.floor);
            const destMarker = createMarkerRing(0x1a73e8, 'B', true);
            destMarker.position.set(destNode.x, 0.05, destNode.z);
            destGroup.add(destMarker);
        }

        // Маркеры межэтажных лестничных переходов
        for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];
            if (curr.floor !== prev.floor) {
                const isUp = curr.floor > prev.floor;
                const fg = getOrCreateFloorRouteGroup(prev.floor);
                const stairMarker = createStairTransitionMarker(isUp ? `↑ ${curr.floor} этаж` : `↓ ${curr.floor} этаж`, isUp);
                stairMarker.position.set(prev.x, 0.05, prev.z);
                fg.add(stairMarker);
            }
        }

        // Создаём 3D-лестничные соединители для общего режима 'all'
        if (window.scene) {
            const globalGroup = new THREE.Group();
            globalGroup.name = 'routeGlobalStairConnectors';

            for (let i = 1; i < nodes.length; i++) {
                const prev = nodes[i - 1];
                const curr = nodes[i];
                if (curr.floor !== prev.floor) {
                    const stepH = (typeof STATE !== 'undefined' && STATE.wallHeight) ? (STATE.wallHeight + 0.25) : 2.65;
                    const y1 = stepH * (prev.floor - 1) + 0.14;
                    const y2 = stepH * (curr.floor - 1) + 0.14;

                    const stairPts = [
                        new THREE.Vector3(prev.x, y1, prev.z),
                        new THREE.Vector3((prev.x + curr.x) / 2, (y1 + y2) / 2, (prev.z + curr.z) / 2),
                        new THREE.Vector3(curr.x, y2, curr.z)
                    ];

                    const stairCurve = new THREE.CatmullRomCurve3(stairPts);
                    const stairGeom = new THREE.TubeGeometry(stairCurve, 16, 0.16, 8, false);
                    const stairMat = new THREE.MeshBasicMaterial({
                        color: 0x38bdf8,
                        transparent: true,
                        opacity: 0.95
                    });
                    const stairMesh = new THREE.Mesh(stairGeom, stairMat);
                    globalGroup.add(stairMesh);
                }
            }

            window.scene.add(globalGroup);
            NAV_STATE.globalRouteGroup = globalGroup;
        }

        // Атомарно мутируем состояние активного маршрута строго после успешной генерации 3D-мешей
        NAV_STATE.activeRoute = routeResult;
        updateRouteVisibilityForCurrentMode();
        if (typeof requestRender === 'function') requestRender(30);
    } catch (err) {
        clearRoute3D();
        console.error('Ошибка генерации 3D-маршрута:', err);
    }
}

    // ------------------------------------------------------------------------
    // ОБНОВЛЕНИЕ ВИДИМОСТИ И ЦВЕТА ПУТИ ВО ВСЕХ РЕЖИМАХ ОТОБРАЖЕНИЯ КАРТЫ
    // ------------------------------------------------------------------------
    function updateRouteVisibilityForCurrentMode() {
        if (!NAV_STATE.activeRoute) return;

        const mode = (typeof STATE !== 'undefined') ? STATE.mode : '1';
        const isSingleFloor = (mode !== 'all' && mode !== 'sideBySide' && mode !== 'slice');
        const parsedFloor = parseInt(mode, 10);
        const activeFloor = (isSingleFloor && Number.isFinite(parsedFloor)) ? parsedFloor : 1;
        const maxFloor = (mode === 'slice') ? STATE.sliceMaxFloor : 7;
        const isAllFloors = (mode === 'all');
        const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');

        // Цвет маршрута: при просмотре всех этажей — нейтрально серый, на отдельном этаже — фирменный голубой/синий
        const ribbonColor = isAllFloors ? (isDark ? 0x71717a : 0x94a3b8) : (isDark ? 0x38bdf8 : 0x0284c7);
        const coreColor = isAllFloors ? (isDark ? 0xa1a1aa : 0xe2e8f0) : (isDark ? 0xf0f9ff : 0xffffff);
        const stairColor = isAllFloors ? (isDark ? 0x71717a : 0x94a3b8) : 0x38bdf8;

        for (let f = 1; f <= 7; f++) {
            const rGroup = NAV_STATE.routeFloorGroups[f];
            if (!rGroup) continue;

            if (isSingleFloor) {
                // В режиме одного этажа видна геометрия только выбранного этажа
                rGroup.visible = (f === activeFloor);
            } else if (mode === 'slice') {
                rGroup.visible = (f <= maxFloor);
            } else {
                // 'all' или 'sideBySide'
                rGroup.visible = true;
            }

            // Динамически обновляем цвета полосы маршрута в зависимости от режима всех этажей
            rGroup.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    if (child.userData && child.userData.isRouteRibbonBase) {
                        child.material.color.setHex(ribbonColor);
                    } else if (child.userData && child.userData.isRouteRibbonCore) {
                        child.material.color.setHex(coreColor);
                    }
                }
            });
        }

        if (NAV_STATE.globalRouteGroup) {
            // Межэтажные вертикальные 3D-марши показываем только в общем 3D режиме 'all'
            NAV_STATE.globalRouteGroup.visible = isAllFloors;
            NAV_STATE.globalRouteGroup.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    child.material.color.setHex(stairColor);
                }
            });
        }

        if (typeof requestRender === 'function') requestRender(30);
    }

    // ------------------------------------------------------------------------
    // АНИМАЦИЯ ПУЛЬСАЦИИ И ИМПУЛЬСОВ МАРШРУТА
    // Кэшируем pulsing-объекты при построении маршрута, чтобы не делать traverse
    // на 60 кадрах в секунду по всему дереву сцены.
    // ------------------------------------------------------------------------
    function updateNavigatorAnimation(delta) {
        if (!NAV_STATE.activeRoute) return;

        NAV_STATE.animationTime += (delta || 16) * 0.003;
        const scalePulse = 1.0 + Math.sin(NAV_STATE.animationTime * 4.0) * 0.12;
        const opacityPulse = 0.75 + Math.sin(NAV_STATE.animationTime * 4.0) * 0.25;

        // Если pulsing-маркеры закэшированы при создании — используем кэш.
        if (NAV_STATE._pulsingObjects && NAV_STATE._pulsingObjects.length > 0) {
            for (let i = 0; i < NAV_STATE._pulsingObjects.length; i++) {
                const child = NAV_STATE._pulsingObjects[i];
                // Пропускаем объекты из невидимых групп
                const fg = child.parent;
                if (!fg || !fg.visible) continue;
                if (child.userData.ring) {
                    child.userData.ring.scale.set(scalePulse, scalePulse, scalePulse);
                    if (child.userData.ring.material) {
                        child.userData.ring.material.opacity = opacityPulse;
                    }
                }
                if (child.userData.disk && child.userData.disk.material) {
                    child.userData.disk.material.opacity = 0.25 + opacityPulse * 0.2;
                }
            }
            return;
        }

        // Fallback: наполняем кэш _pulsingObjects один раз, предотвращая 60 обходов дерева в секунду
        if (!NAV_STATE._pulsingObjects) {
            NAV_STATE._pulsingObjects = [];
        }
        for (let f = 1; f <= 7; f++) {
            const rGroup = NAV_STATE.routeFloorGroups[f];
            if (!rGroup) continue;

            rGroup.traverse((child) => {
                if (child.userData && child.userData.isPulsing) {
                    NAV_STATE._pulsingObjects.push(child);
                }
            });
        }
        if (NAV_STATE._pulsingObjects.length > 0) {
            updateNavigatorAnimation(delta);
        }
    }

    // ------------------------------------------------------------------------
    // SCREEN-SPACE RETINA БЕЙДЖИ ДЛЯ ТОЧЕК "А", "Б" И ЛЕСТНИЦ НА 2D CANVAS
    // ------------------------------------------------------------------------
    const _tempVec = new THREE.Vector3();
    let renderedStairBadges = [];
    const _badgeWidthCache = new Map();

    function checkStairBadgeClick(clientX, clientY) {
        if (!renderedStairBadges || renderedStairBadges.length === 0) return false;
        const hitMargin = 16;
        for (let i = renderedStairBadges.length - 1; i >= 0; i--) {
            const b = renderedStairBadges[i];
            if (clientX >= b.x0 - hitMargin && clientX <= b.x1 + hitMargin &&
                clientY >= b.y0 - hitMargin && clientY <= b.y1 + hitMargin) {
                if (typeof setMode === 'function') {
                    setMode(String(b.toFloor));
                    if (typeof requestRender === 'function') requestRender(35);
                }
                return true;
            }
        }
        return false;
    }

    function renderNavigatorScreenBadges(ctx, dpr, width, height) {
        if (!NAV_STATE.activeRoute || !window.camera) return;

        renderedStairBadges = [];

        const route = NAV_STATE.activeRoute;
        const mode = (typeof STATE !== 'undefined') ? STATE.mode : '1';
        const isSingleFloor = (mode !== 'all' && mode !== 'sideBySide' && mode !== 'slice');
        const parsedFloor = parseInt(mode, 10);
        const activeFloor = (isSingleFloor && Number.isFinite(parsedFloor)) ? parsedFloor : 1;

        const startNode = route.startNode;
        const destNode = route.destNode;

        function drawScreenBadge(node, label, badgeColor, textColor = '#ffffff', borderColor = '#ffffff', isDest = false) {
            if (!node) return;
            if (isSingleFloor && node.floor !== activeFloor) return;

            // Вычисляем мировые координаты с учётом смещения группы этажа
            const fg = window.floorGroups ? window.floorGroups[node.floor] : null;
            const posY = fg ? fg.position.y : 0;
            const posX = fg ? fg.position.x : 0;
            const posZ = fg ? fg.position.z : 0;

            _tempVec.set(posX + node.x, posY + 1.35, posZ + node.z).project(window.camera);
            if (_tempVec.z > 1.0) return; // За камерой

            const sx = (_tempVec.x * 0.5 + 0.5) * width;
            const sy = (-_tempVec.y * 0.5 + 0.5) * height;

            if (sx < -100 || sx > width + 100 || sy < -50 || sy > height + 50) return;

            ctx.save();
            ctx.font = 'bold 12px Inter, sans-serif';
            let textWidth = _badgeWidthCache.get(label);
            if (textWidth === undefined) {
                textWidth = ctx.measureText(label).width;
                _badgeWidthCache.set(label, textWidth);
            }
            const bWidth = textWidth + 28;
            const bHeight = 26;
            const bx = sx - bWidth / 2;
            const by = sy - bHeight - 12;

            // Тень бейджа
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;

            // Фон бейджа
            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.roundRect(bx, by, bWidth, bHeight, 7);
            ctx.fill();

            // Обводка бейджа
            ctx.shadowColor = 'transparent';
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = borderColor;
            ctx.stroke();

            // Иконка точки (кружочек с контрастной каймой)
            ctx.fillStyle = textColor === '#ffffff' ? '#ffffff' : borderColor;
            ctx.beginPath();
            ctx.arc(bx + 14, by + bHeight / 2, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.arc(bx + 14, by + bHeight / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Текст бейджа
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, bx + 24, by + bHeight / 2);

            // Маленький указатель (хвостик) вниз
            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.moveTo(sx - 5, by + bHeight);
            ctx.lineTo(sx, by + bHeight + 6);
            ctx.lineTo(sx + 5, by + bHeight);
            ctx.closePath();
            ctx.fill();

            // Обводка хвостика
            if (borderColor && borderColor !== 'transparent') {
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = borderColor;
                ctx.beginPath();
                ctx.moveTo(sx - 5, by + bHeight);
                ctx.lineTo(sx, by + bHeight + 6);
                ctx.lineTo(sx + 5, by + bHeight);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Рисуем бейдж Откуда (первичный пункт — голубой)
        drawScreenBadge(startNode, `A: ${formatNavNodeName(startNode.label, startNode.bldg)}`, '#c2e7ff', '#004a77', '#1a73e8', false);
        // Рисуем бейдж Куда (конечный пункт — синий)
        drawScreenBadge(destNode, `B: ${formatNavNodeName(destNode.label, destNode.bldg)}`, '#1a73e8', '#ffffff', '#ffffff', true);

        // Рисуем бейджи лестничных переходов
        if (route.stairTransitions) {
            for (const st of route.stairTransitions) {
                if (isSingleFloor && st.fromFloor !== activeFloor) continue;
                drawStairTransitionBadge(st, ctx, width, height);
            }
        }
    }

    function drawStairTransitionBadge(st, ctx, width, height) {
        const fg = window.floorGroups ? window.floorGroups[st.fromFloor] : null;
        const posY = fg ? fg.position.y : 0;
        const posX = fg ? fg.position.x : 0;
        const posZ = fg ? fg.position.z : 0;

        _tempVec.set(posX + st.x, posY + 0.8, posZ + st.z).project(window.camera);
        if (_tempVec.z > 1.0) return;

        const sx = (_tempVec.x * 0.5 + 0.5) * width;
        const sy = (-_tempVec.y * 0.5 + 0.5) * height;

        ctx.save();
        const text = st.isUp ? `↑ Лестница на ${st.toFloor} этаж` : `↓ Лестница на ${st.toFloor} этаж`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const tw = ctx.measureText(text).width;
        const bw = tw + 22;
        const bh = 24;
        const bx = sx - bw / 2;
        const by = sy - bh - 6;

        // Тень бейджа
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // Фон бейджа лестницы — ГОЛУБОЙ (Google Light Blue)
        ctx.fillStyle = '#c2e7ff';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 6);
        ctx.fill();

        // Обводка бейджа лестницы — синяя Google Blue
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = '#1a73e8';
        ctx.stroke();

        // Точка-индикатор
        ctx.fillStyle = '#1a73e8';
        ctx.beginPath();
        ctx.arc(bx + 11, by + bh / 2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Текст — темно-синий (#004a77) для максимального контраста
        ctx.fillStyle = '#004a77';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + 18, by + bh / 2);

        // Хвостик указателя вниз
        ctx.fillStyle = '#c2e7ff';
        ctx.beginPath();
        ctx.moveTo(sx - 4, by + bh);
        ctx.lineTo(sx, by + bh + 5);
        ctx.lineTo(sx + 4, by + bh);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 1.0;
        ctx.strokeStyle = '#1a73e8';
        ctx.beginPath();
        ctx.moveTo(sx - 4, by + bh);
        ctx.lineTo(sx, by + bh + 5);
        ctx.lineTo(sx + 4, by + bh);
        ctx.stroke();

        ctx.restore();

        renderedStairBadges.push({
            x0: bx,
            y0: by,
            x1: bx + bw,
            y1: by + bh + 5,
            fromFloor: st.fromFloor,
            toFloor: st.toFloor
        });
    }

    // ------------------------------------------------------------------------
    // ПУБЛИЧНЫЙ МЕТОД ПОСТРОЕНИЯ МАРШРУТА
    // ------------------------------------------------------------------------
    function buildRoute(startPoint, destPoint) {
        if (typeof hideRoomContextPopup === 'function') {
            hideRoomContextPopup(true);
        }
        if (!NAV_STATE.graph) {
            NAV_STATE.graph = buildCollegeNavGraph();
        }

        const g = NAV_STATE.graph;
        if (!startPoint || !destPoint) return null;

        const result = aStarPath(g, startPoint.id, destPoint.id);
        if (!result || !result.path || result.path.length < 2) {
            return null;
        }

        const nodes = result.path.map(id => g.getNode(id));
        const instructions = generateRouteInstructions(g, result.path);

        // Находим все этажи, задействованные в маршруте
        const floorSet = new Set(nodes.map(n => n.floor));
        const involvedFloors = Array.from(floorSet).sort((a, b) => a - b);

        // Находим переходы по лестницам
        const stairTransitions = [];
        for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];
            if (curr.floor !== prev.floor) {
                stairTransitions.push({
                    fromFloor: prev.floor,
                    toFloor: curr.floor,
                    x: prev.x,
                    z: prev.z,
                    isUp: curr.floor > prev.floor,
                    stairName: prev.label
                });
            }
        }

        // Оценка времени пешком (скорость ~1.15 м/с) + 45 сек на каждый межэтажный лестничный переход
        const stairDelaySec = (stairTransitions ? stairTransitions.length : 0) * 45;
        const totalWalkSec = (result.totalDistance / 1.15) + stairDelaySec;
        const durationMin = Math.max(1, Math.round((totalWalkSec / 60) * 10) / 10);

        const routeData = {
            path: result.path,
            nodes,
            startNode: nodes[0],
            destNode: nodes[nodes.length - 1],
            totalDistance: Math.round(result.totalDistance),
            durationMin,
            instructions,
            involvedFloors,
            stairTransitions
        };

        NAV_STATE.startPoint = startPoint;
        NAV_STATE.destPoint = destPoint;

        // 1. Корпус: если маршрут охватывает корпус, который сейчас скрыт фильтром, переключаем фильтр на 'both'
        const bldgSet = new Set(nodes.map(n => n.bldg));
        if (bldgSet.size > 1 && typeof setBuildingFilter === 'function' && STATE.buildingFilter !== 'both') {
            setBuildingFilter('both', false);
        } else if (startPoint.bldg && typeof setBuildingFilter === 'function' && STATE.buildingFilter !== 'both' && String(STATE.buildingFilter) !== String(startPoint.bldg)) {
            setBuildingFilter(String(startPoint.bldg), false);
        }

        // 2. Этаж: переключаем этаж карты на этаж отправления ДО отрисовки UI карточки и сцены
        const startFloor = String(startPoint.floor || (nodes[0] ? nodes[0].floor : 1));
        if (typeof setMode === 'function') {
            setMode(startFloor, false);
        }

        // 3. Отрисовка в 3D (атомарно устанавливает NAV_STATE.activeRoute при успехе)
        drawRoute3D(routeData);
        if (!NAV_STATE.activeRoute) {
            return null;
        }

        if (typeof pushOverlayState === 'function') {
            pushOverlayState('route');
        }

        // 4. Обновление UI карточки маршрута (STATE.mode уже гарантированно равен startFloor!)
        updateRouteCardUI(routeData);

        // 5. Фокусируем камеру на начальном отрезке пути
        focusCameraOnSegment(nodes[0]);

        return routeData;
    }

    function focusCameraOnSegment(node) {
        if (!node || typeof THREE === 'undefined') return;
        if (typeof resetControlsMomentum === 'function') {
            resetControlsMomentum();
        }

        const targetY = (STATE && STATE.is2D) ? 38 : 28;
        const camZOffset = (STATE && STATE.is2D) ? 14 : 30;
        const camXOffset = (STATE && STATE.is2D) ? 0 : -14;

        if (!STATE.targetControlsCenter) STATE.targetControlsCenter = new THREE.Vector3();
        STATE.targetControlsCenter.set(node.x, 0, node.z);

        if (!STATE.targetCamPos) STATE.targetCamPos = new THREE.Vector3();
        STATE.targetCamPos.set(node.x + camXOffset, targetY, node.z + camZOffset);

        if (typeof requestRender === 'function') requestRender(45);
    }

    // ------------------------------------------------------------------------
    // ОБРАБОТКА КЛИКОВ ПО КАРТЕ ДЛЯ ВЫБОРА ТОЧЕК МАРШРУТА И ЛЕСТНИЦ
    // ------------------------------------------------------------------------
    function applyRoomToActiveRoute(roomInfo, targetType = 'dest') {
        if (!roomInfo) return;
        if (typeof hideRoomContextPopup === 'function') {
            hideRoomContextPopup(true);
        }
        const g = NAV_STATE.graph || buildCollegeNavGraph();
        NAV_STATE.graph = g;

        // Находим соответствующий узел в графе с учетом погрешности координат
        let matchedNodeId = null;
        for (const [nid, n] of g.nodes.entries()) {
            if (n.floor === roomInfo.floor && n.bldg === roomInfo.building &&
                Math.hypot(n.x - roomInfo.x, n.z - roomInfo.z) < 0.20) {
                matchedNodeId = nid;
                break;
            }
        }

        if (!matchedNodeId) {
            const closest = g.findClosestNode(roomInfo.floor, roomInfo.building, roomInfo.x, roomInfo.z);
            if (closest) matchedNodeId = closest.id;
        }

        const pointData = {
            id: matchedNodeId,
            text: roomInfo.text ? roomInfo.text.replace(/\n/g, ' ').trim() : 'Кабинет',
            floor: roomInfo.floor,
            building: roomInfo.building,
            x: roomInfo.x,
            z: roomInfo.z
        };

        if (targetType === 'start') {
            NAV_STATE.startPoint = pointData;
            const inputA = document.getElementById('nav-input-start');
            if (inputA) inputA.value = formatNavInputString(pointData);
        } else {
            NAV_STATE.destPoint = pointData;
            const inputB = document.getElementById('nav-input-dest');
            if (inputB) inputB.value = formatNavInputString(pointData);
        }

        if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
            buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
        }

        hidePickBanner();
    }

    function handleNavigatorMapClick(event, preHitRoom = null) {
        // 1. Проверяем клик по экранному бейджу лестницы маршрута на карте
        if (checkStairBadgeClick(event.clientX, event.clientY)) {
            return true;
        }

        // 2. Стандартный режим pickingMode из модалки навигатора
        if (NAV_STATE.pickingMode) {
            if (preHitRoom) {
                onLocationPicked(preHitRoom);
                return true;
            }

            // Если есть бейдж кабинета под курсором
            if (Array.isArray(window.renderedScreenBadges) && window.renderedScreenBadges.length > 0) {
                const cx = event.clientX;
                const cy = event.clientY;
                const hitMargin = 14;

                for (let i = window.renderedScreenBadges.length - 1; i >= 0; i--) {
                    const b = window.renderedScreenBadges[i];
                    if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
                        cy >= b.y0 - hitMargin && cy <= b.y1 + hitMargin) {
                        onLocationPicked(b.room);
                        return true;
                    }
                }
            }

            return true;
        }

        // 3. Если маршрут активен и пользователь меняет кабинет (targetToChange) ИЛИ открыт поиск и кликнули по кабинету на карте
        if (NAV_STATE.activeRoute && (NAV_STATE.targetToChange || (document.getElementById('search-modal') && document.getElementById('search-modal').classList.contains('active')))) {
            let hitRoom = preHitRoom;
            if (!hitRoom && Array.isArray(window.renderedScreenBadges) && window.renderedScreenBadges.length > 0) {
                const cx = event.clientX;
                const cy = event.clientY;
                const hitMargin = 14;
                for (let i = window.renderedScreenBadges.length - 1; i >= 0; i--) {
                    const b = window.renderedScreenBadges[i];
                    if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
                        cy >= b.y0 - hitMargin && cy <= b.y1 + hitMargin) {
                        hitRoom = b.room;
                        break;
                    }
                }
            }
            if (hitRoom) {
                const targetType = NAV_STATE.targetToChange || 'dest';
                applyRoomToActiveRoute(hitRoom, targetType);
                NAV_STATE.targetToChange = null;
                hidePickBanner();
                if (typeof closeSearch === 'function') closeSearch(true);
                return true;
            }
        }

        return false;
    }

    function onLocationPicked(roomInfo) {
        const mode = NAV_STATE.pickingMode;
        NAV_STATE.pickingMode = null;

        const banner = document.getElementById('nav-pick-banner');
        if (banner) banner.classList.add('hidden');

        const g = NAV_STATE.graph || buildCollegeNavGraph();
        NAV_STATE.graph = g;

        // Находим соответствующий узел комнаты в графе с учетом погрешности координат
        let matchedNodeId = null;
        for (const [nid, n] of g.nodes.entries()) {
            if (n.floor === roomInfo.floor && n.bldg === roomInfo.building &&
                Math.hypot(n.x - roomInfo.x, n.z - roomInfo.z) < 0.20) {
                matchedNodeId = nid;
                break;
            }
        }

        if (!matchedNodeId) {
            // Если точный узел комнаты не найден, ищем ближайший узел коридора/двери
            const closest = g.findClosestNode(roomInfo.floor, roomInfo.building, roomInfo.x, roomInfo.z);
            if (closest) matchedNodeId = closest.id;
        }

        const pointData = {
            id: matchedNodeId,
            text: roomInfo.text ? roomInfo.text.replace(/\n/g, ' ').trim() : 'Кабинет',
            floor: roomInfo.floor,
            building: roomInfo.building,
            x: roomInfo.x,
            z: roomInfo.z
        };

        if (mode === 'start') {
            NAV_STATE.startPoint = pointData;
            const inputA = document.getElementById('nav-input-start');
            if (inputA) inputA.value = formatNavInputString(pointData);
        } else if (mode === 'dest') {
            NAV_STATE.destPoint = pointData;
            const inputB = document.getElementById('nav-input-dest');
            if (inputB) inputB.value = formatNavInputString(pointData);
        }

        // Если обе точки выбраны, строим маршрут
        if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
            buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
            closeNavigatorModal();
        } else {
            openNavigatorModal();
        }
    }

    // ------------------------------------------------------------------------
    // UI: ОБНОВЛЕНИЕ ПАНЕЛЕЙ И МОДАЛОК
    // ------------------------------------------------------------------------
    function updateRouteCardUI(route) {
        const card = document.getElementById('navigator-route-card');
        if (!card) return;

        card.classList.remove('hidden');
        document.body.classList.add('route-active');
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) bottomSearch.classList.add('route-active');

        if (typeof window.updateAdaptiveFabPosition === 'function') {
            requestAnimationFrame(() => {
                window.updateAdaptiveFabPosition();
                setTimeout(window.updateAdaptiveFabPosition, 50);
                setTimeout(window.updateAdaptiveFabPosition, 180);
            });
        }

        // Дистанция и время
        const distEl = document.getElementById('nav-card-dist');
        const timeEl = document.getElementById('nav-card-time');
        const floorsContainer = document.getElementById('nav-card-floors');
        const titleEl = document.getElementById('nav-card-title');

        if (distEl) distEl.textContent = `${route.totalDistance} м`;
        if (timeEl) timeEl.textContent = `~${route.durationMin} мин`;
        if (titleEl) {
            const startName = formatNavNodeName(route.startNode.label, route.startNode.bldg);
            const destName = formatNavNodeName(route.destNode.label, route.destNode.bldg);

            const startEl = document.getElementById('nav-card-start-label');
            const destEl = document.getElementById('nav-card-dest-badge');
            if (startEl && destEl) {
                // Компактные подписи для карточки в стиле Google Expressive
                const shortStart = startName.replace(/\s*\([^)]*\)/g, '').trim() || startName;
                const shortDest = destName.replace(/^Кабинет\s*/i, '').replace(/\s*\([^)]*\)/g, '').trim() || destName;
                startEl.textContent = shortStart;
                startEl.title = `Откуда: ${startName} (нажмите для смены)`;
                destEl.textContent = shortDest;
                destEl.title = `Куда: ${destName} (нажмите для смены)`;

                // Нажатие на кабинет открывает поиск для выбора нового конечного пункта
                destEl.onclick = (e) => {
                    e.stopPropagation();
                    NAV_STATE.targetToChange = 'dest';
                    resetRouteCardPicks();
                    destEl.classList.add('ring-4', 'ring-white/80', 'ring-offset-2', 'ring-offset-[#1a73e8]', 'animate-pulse');

                    if (typeof openSearch === 'function') {
                        openSearch();
                        const pill = document.getElementById('search-route-target-pill');
                        const pillText = document.getElementById('search-route-target-text');
                        if (pill && pillText) {
                            pillText.textContent = 'Выбор конечного пункта (Куда)';
                            pill.className = 'mb-2 px-3 py-1.5 rounded-full inline-flex items-center gap-2 text-xs font-bold transition-all shadow-sm bg-[#1a73e8] text-white';
                            pill.classList.remove('hidden');
                        }
                        const sInput = document.getElementById('search-input');
                        if (sInput) {
                            sInput.placeholder = 'Куда: выберите конечный кабинет...';
                            sInput.focus();
                        }
                    }
                };

                // Нажатие на начальную точку открывает поиск для выбора начального пункта
                startEl.onclick = (e) => {
                    e.stopPropagation();
                    NAV_STATE.targetToChange = 'start';
                    resetRouteCardPicks();
                    startEl.classList.add('ring-4', 'ring-[#1a73e8]', 'ring-offset-2', 'ring-offset-[#c2e7ff]', 'animate-pulse');

                    if (typeof openSearch === 'function') {
                        openSearch();
                        const pill = document.getElementById('search-route-target-pill');
                        const pillText = document.getElementById('search-route-target-text');
                        if (pill && pillText) {
                            pillText.textContent = 'Выбор начального пункта (Откуда)';
                            pill.className = 'mb-2 px-3 py-1.5 rounded-full inline-flex items-center gap-2 text-xs font-bold transition-all shadow-sm bg-[#c2e7ff] text-[#004a77] border border-[#1a73e8]';
                            pill.classList.remove('hidden');
                        }
                        const sInput = document.getElementById('search-input');
                        if (sInput) {
                            sInput.placeholder = 'Откуда: выберите начальную точку...';
                            sInput.focus();
                        }
                    }
                };
            } else {
                titleEl.textContent = `${startName} ➔ ${destName}`;
            }

            titleEl.onclick = (e) => {
                if (e.target.closest('#nav-card-dest-badge') || e.target.closest('#nav-card-start-label')) {
                    return;
                }
                openNavigatorModal();
            };
        }

        // Клик по любой области плашки маршрута открывает модальное меню маршрута,
        // сохраняя при этом быстрый выбор точек по клику на сами бейджи
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            if (e.target.closest('#nav-card-dest-badge')) return;
            if (e.target.closest('#nav-card-start-label')) return;
            if (e.target.closest('#btn-card-close')) return;
            if (e.target.closest('#nav-card-floors') || e.target.closest('.m3-nav-stairs-icon') || e.target.closest('.m3-nav-floor-chip') || e.target.closest('.m3-nav-floor-pill')) return;
            if (e.target.closest('#nav-steps-container')) return;

            openNavigatorModal();
        };

        // Круглая иконка лестницы: по нажатию переход на следующий этаж маршрута
        const stairsIconEl = card.querySelector('.m3-nav-stairs-icon');
        if (stairsIconEl) {
            stairsIconEl.style.cursor = 'pointer';
            stairsIconEl.title = 'Перейти на следующий этаж';
            stairsIconEl.onclick = (e) => {
                e.stopPropagation();
                if (route && route.involvedFloors && route.involvedFloors.length > 1) {
                    const currF = parseInt(STATE.mode, 10);
                    const idx = route.involvedFloors.indexOf(currF);
                    const nextF = (idx !== -1 && idx < route.involvedFloors.length - 1)
                        ? route.involvedFloors[idx + 1]
                        : route.involvedFloors[0];
                    if (typeof setMode === 'function') {
                        setMode(String(nextF));
                        const firstOnFloor = route.nodes.find(n => n.floor === nextF);
                        if (firstOnFloor) focusCameraOnSegment(firstOnFloor);
                        updateRouteCardUI(route);
                    }
                }
            };
        }

        // Этажные кнопки переключения (круглые Google Maps Indoor Level Buttons, без "эт.")
        if (floorsContainer) {
            floorsContainer.innerHTML = '';
            const activeFloorStr = (STATE && STATE.mode && STATE.mode !== 'all') ? String(STATE.mode) : String(route.startNode ? route.startNode.floor : '1');
            route.involvedFloors.forEach(f => {
                const btn = document.createElement('button');
                const isActive = String(f) === activeFloorStr;
                btn.className = `m3-nav-floor-pill ${isActive ? 'active-pill' : ''}`;
                btn.textContent = String(f);
                btn.title = `Перейти на ${f} этаж`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof setMode === 'function') {
                        setMode(String(f));
                        // Перемещаем камеру к началу этого отрезка
                        const firstOnFloor = route.nodes.find(n => n.floor === f);
                        if (firstOnFloor) focusCameraOnSegment(firstOnFloor);
                        updateRouteCardUI(route);
                    }
                };
                floorsContainer.appendChild(btn);
            });
        }

        // Список пошаговых инструкций (чистый M3 дизайн с поддержкой светлой и тёмной тем)
        const listEl = document.getElementById('nav-steps-list');
        if (listEl) {
            listEl.innerHTML = '';
            route.instructions.forEach((inst, idx) => {
                const li = document.createElement('li');
                li.className = 'm3-step-item flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition select-none';
                li.innerHTML = `
                    <div class="w-6 h-6 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm">
                        ${idx + 1}
                    </div>
                    <div class="step-text flex-1 min-w-0 text-xs font-semibold leading-snug">
                        ${escapeHtml(inst.text)}
                    </div>
                `;
                li.onclick = () => {
                    if (typeof setMode === 'function' && String(inst.floor) !== STATE.mode) {
                        setMode(String(inst.floor));
                    }
                    const n = NAV_STATE.graph.getNode(inst.nodeId);
                    if (n) focusCameraOnSegment(n);
                };
                listEl.appendChild(li);
            });
        }
    }

    function openNavigatorModal() {
        if (!NAV_STATE.isInitialized && typeof initNavigator === 'function') {
            initNavigator();
        }
        if (typeof hideRoomContextPopup === 'function') hideRoomContextPopup(true);
        if (typeof pushOverlayState === 'function') pushOverlayState('navigator');
        if (typeof updateVisualViewportVars === 'function') updateVisualViewportVars();
        setDefaultStartPoint();

        // Синхронизируем поля ввода с актуальными точками текущего маршрута
        const inputA = document.getElementById('nav-input-start');
        const inputB = document.getElementById('nav-input-dest');
        if (inputA && NAV_STATE.startPoint) {
            inputA.value = formatNavInputString(NAV_STATE.startPoint);
            const btnClearA = document.getElementById('btn-clear-start');
            if (btnClearA) btnClearA.classList.remove('hidden');
        }
        if (inputB && NAV_STATE.destPoint) {
            inputB.value = formatNavInputString(NAV_STATE.destPoint);
            const btnClearB = document.getElementById('btn-clear-dest');
            if (btnClearB) btnClearB.classList.remove('hidden');
        }
        const btnElevIcon = document.getElementById('btn-toggle-elevators-icon');
        if (btnElevIcon) {
            btnElevIcon.classList.toggle('active', !!NAV_STATE.allowElevators);
            btnElevIcon.setAttribute('aria-pressed', NAV_STATE.allowElevators ? 'true' : 'false');
        }
        const modal = document.getElementById('navigator-modal');
        const backdrop = document.getElementById('navigator-backdrop');
        if (modal && backdrop) {
            document.body.classList.add('navigator-open');
            modal.classList.add('open', 'active');
            backdrop.classList.add('open', 'active');
            modal.style.visibility = 'visible';
            backdrop.style.visibility = 'visible';
            modal.style.opacity = '1';
            backdrop.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            backdrop.style.pointerEvents = 'auto';
            const inputDest = document.getElementById('nav-input-dest');
            const isDesktop = (typeof window !== 'undefined' && window.innerWidth >= 640);
            if (isDesktop && inputDest && (!NAV_STATE.destPoint || !inputDest.value)) {
                setTimeout(() => inputDest.focus({ preventScroll: true }), 120);
            }
        }
    }

    function closeNavigatorModal(fromPopstate = false) {
        if (!fromPopstate && typeof popOverlayState === 'function') {
            popOverlayState('navigator');
        }
        document.body.classList.remove('navigator-open');
        const modal = document.getElementById('navigator-modal');
        const backdrop = document.getElementById('navigator-backdrop');
        if (modal && backdrop) {
            modal.classList.remove('open', 'active');
            backdrop.classList.remove('open', 'active');
            modal.style.visibility = '';
            backdrop.style.visibility = '';
            modal.style.opacity = '';
            backdrop.style.opacity = '';
            modal.style.pointerEvents = '';
            backdrop.style.pointerEvents = '';
        }
    }

    function swapStartAndDest() {
        const tmp = NAV_STATE.startPoint;
        NAV_STATE.startPoint = NAV_STATE.destPoint;
        NAV_STATE.destPoint = tmp;

        const inputA = document.getElementById('nav-input-start');
        const inputB = document.getElementById('nav-input-dest');
        if (inputA && inputB) {
            const valA = inputA.value;
            inputA.value = inputB.value;
            inputB.value = valA;
        }

        if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
            buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
        }

        hidePickBanner();
    }

    function clearRoute(fromPopstate = false) {
        if (!fromPopstate && typeof popOverlayState === 'function') {
            popOverlayState('route');
        }
        NAV_STATE.startPoint = null;
        NAV_STATE.destPoint = null;
        NAV_STATE.activeRoute = null;

        const inputA = document.getElementById('nav-input-start');
        const inputB = document.getElementById('nav-input-dest');
        if (inputA) inputA.value = '';
        if (inputB) inputB.value = '';

        const card = document.getElementById('navigator-route-card');
        if (card) card.classList.add('hidden');
        document.body.classList.remove('route-active');
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) bottomSearch.classList.remove('route-active');
        if (typeof window.updateAdaptiveFabPosition === 'function') {
            window.updateAdaptiveFabPosition();
        }

        clearRoute3D();
    }

    // ------------------------------------------------------------------------
    // СЛОВАРЬ ПСЕВДОНИМОВ КАБИНЕТОВ ДЛЯ ПОИСКА НАВИГАТОРА
    // Вынесен на уровень модуля: создаётся один раз, а не при каждом keystroke.
    // ------------------------------------------------------------------------
    const ROOM_ALIASES = {
        'b3_f1_entrance_west': 'главный вход основной вход западный вход вход к3 корпус 3',
        'b1_f1_entrance_main': 'восточный вход главный вход 2 старый вход вход к1 корпус 1 ремонт',
        'room_4_1_182': '104 4-104 гардероб раздевалка',
        'room_4_1_183': '103 4-103 гардероб раздевалка',
        'room_4_1_186': '1 4-1 туалет санузел',
        'room_4_1_187': '2 4-2 туалет санузел',
        'room_4_1_188': '105 4-105 инвентарная',
        'room_4_1_189': '3 4-3',
        'room_4_1_190': '11 4-11 охлаждаемая камера',
        'room_4_1_191': '12 4-12 бельевая',
        'room_4_1_192': '14 4-14 мойка столовой посуды',
        'room_4_1_193': '15 4-15',
        'room_4_1_194': '16 4-16',
        'room_4_1_195': '17 4-17',
        'room_4_1_196': '18 4-18 хлеборезка',
        'room_4_1_197': '19 4-19 суточный запас продуктов',
        'room_4_1_198': '4 4-4',
        'room_4_1_199': '5 4-5',
        'room_4_1_200': '6 4-6',
        'room_4_1_201': '7 4-7',
        'room_4_1_202': '8 4-8',
        'room_4_1_203': '9 4-9',
        'room_4_1_204': '10 4-10',
        'room_4_1_205': '13 4-13 камера отходов',
        'room_4_1_206': '20 4-20 кладовая сухих продуктов',
        'room_4_1_207': '21 4-21 овощной цех',
        'room_4_1_208': '24 4-24 горячий цех кухня',
        'room_4_1_209': '22 4-22 мясо-рыбный цех',
        'room_4_1_210': '23 4-23 моечная посуды мойка',
        'room_4_2_224': '201 4-201',
        'room_4_2_223': '202 4-202',
        'room_4_2_228': '203 4-203',
        'room_4_2_222': '205 4-205 раздевалка',
        'room_4_2_225': '207 4-207 тренерская снарядная',
        'room_4_2_226': '208 4-208',
        'room_4_2_227': '209 4-209 раздевалка',
        'room_4_2_218': '210 4-210',
        'room_4_2_219': '211 4-211 служебное помещение',
        'room_4_2_220': '212 4-212',
        'room_4_3_237': '301 4-301',
        'room_4_3_238': '302 4-302',
        'room_4_3_239': '303 4-303',
        'room_4_3_247': '304 4-304',
        'room_4_3_240': '305 4-305',
        'room_4_3_246': '306 4-306',
        'room_4_3_248': '308 4-308',
        'room_4_3_249': '309 4-309',
        'room_4_3_243': '310 4-310',
        'room_4_3_242': '311 4-311',
        'room_4_3_241': '312 4-312',
        'room_4_1_184': '102 4-102 столовая буфет обед',
        'room_1_1_0': '102 1-102 гардероб раздевалка одежда',
        'room_2_1_103': '104 2-104 библиотека книги читальный зал',
        'room_4_2_230': '204 4-204 актовый зал сцена',
        'room_4_2_211': '206 4-206 спортзал спортивный зал спорт',
        'room_2_3_135': '308 2-308 спортзал спортивный зал спорт',
        'room_2_3_136': '312 2-312 конференц-зал конференц зал собрания',
        'room_2_2_112': '209 2-209 учебная часть учебная'
    };

    // ------------------------------------------------------------------------
    // АВТОЗАПОЛНЕНИЕ И ПОИСК КАБИНЕТОВ В ПОЛЯХ НАВИГАТОРА
    // ------------------------------------------------------------------------
    function setupNavigatorAutocomplete(inputId, dropdownId, onSelect) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;

        // AbortController позволяет атомарно снять все listener'ы этого instance
        // при повторном вызове setupNavigatorAutocomplete (или при уничтожении модала).
        const ac = new AbortController();
        const { signal } = ac;

        // Сохраняем контроллер на DOM-элементе, чтобы внешний код мог вызвать cleanup.
        if (input._navAutocompletAC) input._navAutocompletAC.abort();
        input._navAutocompletAC = ac;

        input.addEventListener('input', () => {
            if (inputId === 'nav-input-start' && input.getAttribute('data-is-default') === 'true') {
                input.removeAttribute('data-is-default');
                NAV_STATE.startPoint = null;
            }
            const clearBtnId = inputId === 'nav-input-start' ? 'btn-clear-start' : 'btn-clear-dest';
            const clearBtn = document.getElementById(clearBtnId);
            if (clearBtn) {
                if (input.value.length > 0) clearBtn.classList.remove('hidden');
                else clearBtn.classList.add('hidden');
            }

            const query = input.value.trim().toLowerCase();
            if (query.length === 0) {
                dropdown.classList.add('hidden');
                dropdown.innerHTML = '';
                return;
            }

            if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
            const g = NAV_STATE.graph;

            // ROOM_ALIASES определён на уровне модуля — не пересоздаём при каждом keystroke.

            const matches = [];
            for (const [nid, n] of g.nodes.entries()) {
                if (n.type === 'room' || n.type === 'entrance') {
                    // Кэшируем вычисленные поисковые ключевые слова на узле графа,
                    // избегая квадратичного поиска O(N*M) в ROOMS_REGISTRY на каждое нажатие клавиши
                    if (!n._searchKeywords) {
                        const lbl = (n.label || '').toLowerCase();
                        const alias = (ROOM_ALIASES[nid] || '').toLowerCase();
                        const formattedCode = formatNavNodeName(n.label, n.bldg).toLowerCase();

                        let extraKeywords = '';
                        if (typeof ROOMS_REGISTRY !== 'undefined' && Array.isArray(ROOMS_REGISTRY)) {
                            const rMatch = ROOMS_REGISTRY.find(r => 
                                r.building === n.bldg && 
                                r.floor === n.floor && 
                                (r.text === n.label || r.text.includes(n.label) || (n.bldg > 1 && r.text.includes(`${n.bldg}-${n.label}`)))
                            );
                            if (rMatch) {
                                extraKeywords = (rMatch.text || '').toLowerCase();
                                if (typeof getRoomSubjectAndTeacher === 'function') {
                                    const details = getRoomSubjectAndTeacher(n.bldg, n.floor, n.label, rMatch.text);
                                    if (details) {
                                        extraKeywords += ' ' + (details.subject || '').toLowerCase() + ' ' + (details.teacher || '').toLowerCase();
                                    }
                                }
                            }
                        }
                        n._searchKeywords = `${lbl} ${n.bldg}-${lbl} ${formattedCode} ${alias} ${extraKeywords}`;
                    }

                    if (n._searchKeywords.includes(query)) {
                        matches.push(n);
                        if (matches.length >= 8) break;
                    }
                }
            }

            if (matches.length === 0) {
                dropdown.innerHTML = '<div class="px-4 py-3 text-xs font-medium text-slate-400 dark:text-slate-500 text-center">Ничего не найдено</div>';
                dropdown.classList.remove('hidden');
                return;
            }

            dropdown.innerHTML = '';
            matches.sort((a, b) => {
                if (query === 'главный вход') {
                    if (a.id === 'b3_f1_entrance_west') return -1;
                    if (b.id === 'b3_f1_entrance_west') return 1;
                }
                return 0;
            });
            matches.forEach((item, index) => {
                let codeLabel = formatNavNodeName(item.label, item.bldg);
                let displayTitle = item.label;
                let subtitle = `Корпус ${item.bldg} • ${item.floor} этаж`;

                if (typeof formatSearchRoomBadgeAndTitle === 'function') {
                    let rObj = null;
                    if (typeof ROOMS_REGISTRY !== 'undefined' && Array.isArray(ROOMS_REGISTRY)) {
                        rObj = ROOMS_REGISTRY.find(r => 
                            r.building === item.bldg && 
                            r.floor === item.floor && 
                            (r.text === item.label || r.text.includes(item.label) || (item.bldg > 1 && r.text.includes(`${item.bldg}-${item.label}`)))
                        );
                    }
                    const formatted = formatSearchRoomBadgeAndTitle(rObj || {
                        building: item.bldg,
                        floor: item.floor,
                        text: item.label,
                        rawText: item.label
                    });
                    if (formatted) {
                        codeLabel = formatted.codeLabel || codeLabel;
                        displayTitle = formatted.displayTitle || displayTitle;
                        subtitle = formatted.subtitle || subtitle;
                    }
                }

                const row = document.createElement('button');
                row.type = 'button';
                const isActive = index === 0 ? ' is-active' : '';
                row.className = `m3-search-row flex items-stretch w-full transition text-left cursor-pointer${isActive}`;
                row.innerHTML = `
                    <!-- Колонка 1: Номер аудитории -->
                    <div class="m3-search-col-num flex items-center justify-center font-bold text-slate-800 dark:text-slate-100 select-none">
                        ${escapeHtml(codeLabel)}
                    </div>

                    <!-- Колонка 2: Бейджи Корпуса и Этажа -->
                    <div class="m3-search-col-badges flex flex-col justify-stretch p-0 m-0">
                        <div class="m3-search-badge m3-badge-bldg flex items-center justify-center gap-1" title="Корпус ${escapeHtml(item.bldg)}">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="4" y="3" width="7" height="18" rx="1"></rect>
                                <rect x="11" y="9" width="6" height="12" rx="1"></rect>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.bldg)}</span>
                        </div>
                        <div class="m3-search-badge m3-badge-floor flex items-center justify-center gap-1" title="${escapeHtml(item.floor)} этаж">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.floor)}</span>
                        </div>
                    </div>

                    <!-- Колонка 3: Название кабинета + преподаватель / описание -->
                    <div class="m3-search-col-info flex flex-col justify-center min-w-0 flex-1 overflow-hidden">
                        <span class="m3-search-title truncate">${escapeHtml(displayTitle)}</span>
                        <span class="m3-search-subtitle truncate">${escapeHtml(subtitle)}</span>
                    </div>
                `;

                const handleSelect = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    input.value = formatNavInputString(item);
                    dropdown.classList.add('hidden');
                    if (clearBtn) clearBtn.classList.remove('hidden');
                    onSelect(item);
                };

                row.onclick = handleSelect;
                row._onItemClick = handleSelect;
                dropdown.appendChild(row);
            });

            dropdown.classList.remove('hidden');
        }, { signal });

        // Клавиша Enter выбирает первый активный элемент из подсказок
        // { signal } обеспечивает автоматическое снятие listener при вызове ac.abort()
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !dropdown.classList.contains('hidden')) {
                const firstRow = dropdown.querySelector('.m3-search-row');
                if (firstRow && firstRow._onItemClick) {
                    e.preventDefault();
                    firstRow._onItemClick();
                }
            }
        }, { signal });

        // Закрытие выпадающего списка при клике вне.
        // { signal } обеспечивает автоматическое снятие listener при вызове ac.abort().
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        }, { signal });
    }

    // ------------------------------------------------------------------------
    // ИНИЦИАЛИЗАЦИЯ И РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ СОБЫТИЙ
    // ------------------------------------------------------------------------
    function initNavigator() {
        if (NAV_STATE.isInitialized) return;
        if (!NAV_STATE.graph) {
            NAV_STATE.graph = buildCollegeNavGraph();
        }
        NAV_STATE.isInitialized = true;

        // Google Maps: начальная установка точки отправления
        setDefaultStartPoint();

        // Поведение поля "Откуда": автоочистка дефолтного значения при первом вводе
        const inputStart = document.getElementById('nav-input-start');
        if (inputStart) {
            const selectIfDefault = () => {
                if (inputStart.getAttribute('data-is-default') === 'true') {
                    inputStart.select();
                }
            };
            inputStart.addEventListener('focus', selectIfDefault);
            inputStart.addEventListener('click', selectIfDefault);
            inputStart.addEventListener('keydown', (e) => {
                if (inputStart.getAttribute('data-is-default') === 'true') {
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        inputStart.value = '';
                        inputStart.removeAttribute('data-is-default');
                        NAV_STATE.startPoint = null;
                        const btnClearA = document.getElementById('btn-clear-start');
                        if (btnClearA) btnClearA.classList.remove('hidden');
                    } else if (e.key === 'Backspace' || e.key === 'Delete') {
                        inputStart.value = '';
                        inputStart.removeAttribute('data-is-default');
                        NAV_STATE.startPoint = null;
                    }
                }
            });
        }

        // Кнопка очистки поля "Откуда"
        const btnClearStart = document.getElementById('btn-clear-start');
        if (btnClearStart) {
            btnClearStart.addEventListener('click', () => {
                if (inputStart) {
                    inputStart.value = '';
                    inputStart.removeAttribute('data-is-default');
                    inputStart.focus();
                }
                NAV_STATE.startPoint = null;
                btnClearStart.classList.add('hidden');
                const dropStart = document.getElementById('nav-dropdown-start');
                if (dropStart) dropStart.classList.add('hidden');
            });
        }

        // Кнопка очистки поля "Куда"
        const inputDest = document.getElementById('nav-input-dest');
        const btnClearDest = document.getElementById('btn-clear-dest');
        if (btnClearDest) {
            btnClearDest.addEventListener('click', () => {
                if (inputDest) {
                    inputDest.value = '';
                    inputDest.focus();
                }
                NAV_STATE.destPoint = null;
                btnClearDest.classList.add('hidden');
                const dropDest = document.getElementById('nav-dropdown-dest');
                if (dropDest) dropDest.classList.add('hidden');
            });
        }

        // Переключатель лифтов: свич вкл/выкл и иконка
        const switchElev = document.getElementById('toggle-elevators-switch');
        const btnElev = document.getElementById('btn-toggle-elevators');
        const btnElevIcon = document.getElementById('btn-toggle-elevators-icon');
        const elevText = document.getElementById('elevators-status-text');

        function setElevatorsState(enabled) {
            NAV_STATE.allowElevators = !!enabled;
            if (switchElev) switchElev.checked = NAV_STATE.allowElevators;
            if (btnElevIcon) {
                btnElevIcon.classList.toggle('active', NAV_STATE.allowElevators);
                btnElevIcon.setAttribute('aria-pressed', NAV_STATE.allowElevators ? 'true' : 'false');
                btnElevIcon.title = NAV_STATE.allowElevators ? 'Лифты включены (нажмите, чтобы выключить)' : 'Использовать лифты';
            }
            const switchLabel = document.getElementById('elevators-switch-label');
            if (switchLabel) {
                const isLight = document.body.getAttribute('data-theme') === 'light';
                if (NAV_STATE.allowElevators) {
                    if (isLight) {
                        switchLabel.style.borderColor = '#1a73e8';
                        switchLabel.style.backgroundColor = '#c2e7ff';
                    } else {
                        switchLabel.classList.add('border-[#1a73e8]', 'bg-[#1a73e8]/25');
                        switchLabel.classList.remove('bg-slate-900/80', 'border-slate-700/80');
                    }
                } else {
                    if (isLight) {
                        switchLabel.style.borderColor = '#cbd5e1';
                        switchLabel.style.backgroundColor = '#ffffff';
                    } else {
                        switchLabel.classList.remove('border-[#1a73e8]', 'bg-[#1a73e8]/25');
                        switchLabel.classList.add('bg-slate-900/80', 'border-slate-700/80');
                    }
                }
            }
            if (elevText) {
                elevText.textContent = NAV_STATE.allowElevators ? 'Лифты: вкл' : 'Без лифтов';
            }
            if (btnElev) {
                btnElev.classList.toggle('active', NAV_STATE.allowElevators);
            }
            if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
            }
        }

        if (btnElevIcon) {
            btnElevIcon.addEventListener('click', () => {
                setElevatorsState(!NAV_STATE.allowElevators);
            });
        }
        if (switchElev) {
            switchElev.checked = NAV_STATE.allowElevators;
            switchElev.addEventListener('change', () => {
                setElevatorsState(switchElev.checked);
            });
        }
        if (btnElev) {
            btnElev.addEventListener('click', () => {
                setElevatorsState(!NAV_STATE.allowElevators);
            });
        }

        // Быстрый маршрут к ближайшему туалету
        function routeToClosestToilet() {
            if (!NAV_STATE.startPoint) setDefaultStartPoint();
            const toilet = findClosestToilet(NAV_STATE.startPoint);
            if (toilet) {
                NAV_STATE.destPoint = toilet;
                if (inputDest) {
                    inputDest.value = `${toilet.label} (Корпус ${toilet.bldg}, ${toilet.floor} этаж)`;
                    if (btnClearDest) btnClearDest.classList.remove('hidden');
                }
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                closeNavigatorModal();
            }
        }

        const btnQuickToilet = document.getElementById('btn-quick-toilet');
        if (btnQuickToilet) btnQuickToilet.addEventListener('click', routeToClosestToilet);

        // Кнопка "Построить маршрут" (ОК)
        const btnConfirmRoute = document.getElementById('btn-confirm-route');
        if (btnConfirmRoute) {
            btnConfirmRoute.addEventListener('click', () => {
                if (!NAV_STATE.startPoint) setDefaultStartPoint();
                if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                    buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                    closeNavigatorModal();
                } else if (!NAV_STATE.destPoint && inputDest) {
                    inputDest.focus();
                    inputDest.classList.add('ring-2', 'ring-rose-500');
                    setTimeout(() => inputDest.classList.remove('ring-2', 'ring-rose-500'), 1200);
                }
            });
        }

        // Кнопка открытия навигатора в шапке
        const btnOpen = document.getElementById('btn-open-navigator');
        if (btnOpen) {
            btnOpen.addEventListener('click', openNavigatorModal);
        }

        // Кнопка закрытия модалки
        const btnClose = document.getElementById('btn-close-navigator');
        if (btnClose) {
            btnClose.addEventListener('click', closeNavigatorModal);
        }

        const backdrop = document.getElementById('navigator-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeNavigatorModal);
        }

        // Закрытие модалки по клавише Escape
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('navigator-modal');
                if (modal && (modal.classList.contains('open') || modal.classList.contains('active'))) {
                    closeNavigatorModal();
                }
            }
        });

        // Кнопка инверсии точек
        const btnSwap = document.getElementById('btn-nav-swap');
        if (btnSwap) {
            btnSwap.addEventListener('click', swapStartAndDest);
        }

        // Кнопка очистки
        const btnClear = document.getElementById('btn-nav-clear');
        if (btnClear) {
            btnClear.addEventListener('click', clearRoute);
        }

        // Кнопка закрытия карточки маршрута
        const btnCardClose = document.getElementById('btn-card-close');
        if (btnCardClose) {
            btnCardClose.addEventListener('click', (e) => {
                e.stopPropagation();
                clearRoute();
            });
        }

        // Автодополнение для поля "Откуда"
        setupNavigatorAutocomplete('nav-input-start', 'nav-dropdown-start', (item) => {
            NAV_STATE.startPoint = item;
            if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                closeNavigatorModal();
            }
        });

        // Автодополнение для поля "Куда"
        setupNavigatorAutocomplete('nav-input-dest', 'nav-dropdown-dest', (item) => {
            NAV_STATE.destPoint = item;
            if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                closeNavigatorModal();
            }
        });

        // Кнопка "Выбрать на карте" (Откуда)
        const btnPickStart = document.getElementById('btn-pick-start');
        if (btnPickStart) {
            btnPickStart.addEventListener('click', () => {
                NAV_STATE.pickingMode = 'start';
                closeNavigatorModal();
                showPickBanner('Нажмите на кабинет или точку отправления на карте');
            });
        }

        // Кнопка "Выбрать на карте" (Куда)
        const btnPickDest = document.getElementById('btn-pick-dest');
        if (btnPickDest) {
            btnPickDest.addEventListener('click', () => {
                NAV_STATE.pickingMode = 'dest';
                closeNavigatorModal();
                showPickBanner('Нажмите на кабинет или пункт назначения на карте');
            });
        }

        // Кнопка отмены выбора на карте
        const btnCancelPick = document.getElementById('btn-cancel-pick');
        if (btnCancelPick) {
            btnCancelPick.addEventListener('click', () => {
                NAV_STATE.pickingMode = null;
                NAV_STATE.targetToChange = null;
                hidePickBanner();
                if (!NAV_STATE.activeRoute) {
                    openNavigatorModal();
                }
            });
        }

        // Быстрые чипы популярных направлений: используем AbortController для защиты от дублирования
        if (NAV_STATE._chipsAbortController) {
            NAV_STATE._chipsAbortController.abort();
        }
        NAV_STATE._chipsAbortController = new AbortController();
        const chipsSignal = NAV_STATE._chipsAbortController.signal;

        const chips = document.querySelectorAll('.nav-quick-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const targetText = chip.getAttribute('data-target');
                if (!targetText) return;

                // Находим целевой узел
                const g = NAV_STATE.graph;
                const q = targetText.toLowerCase().trim();
                let targetNode = null;

                // Точное соответствие для главного входа (Корпус 3) и входа 2 (Корпус 1)
                if (q === 'главный вход' || q === 'западный вход' || q === 'основной вход' || q === 'вход') {
                    targetNode = g.getNode('b3_f1_entrance_west');
                } else if (q === 'восточный вход' || q === 'главный вход 2' || q === 'старый вход' || q === 'вход к1' || q === 'ремонт') {
                    targetNode = g.getNode('b1_f1_entrance_main');
                } else {
                    for (const node of g.nodes.values()) {
                        if (node.type === 'room' || node.type === 'entrance') {
                            const lbl = (node.label || '').toLowerCase();
                            const isMatch =
                                (q === 'столовая' && ((node.bldg === 4 && node.floor === 1 && lbl.includes('102')) || lbl.includes('столов'))) ||
                                (q === 'спортзал' && ((node.bldg === 4 && node.floor === 2 && lbl.includes('206')) || lbl.includes('спортзал'))) ||
                                (q === 'актовый зал' && ((node.bldg === 4 && node.floor === 2 && lbl.includes('204')) || lbl.includes('актовый'))) ||
                                (q === 'учебная часть' && ((node.bldg === 2 && node.floor === 2 && lbl.includes('209')) || lbl.includes('учебн'))) ||
                                (q === 'гардероб' && ((node.bldg === 1 && node.floor === 1 && lbl.includes('102')) || lbl.includes('гардероб'))) ||
                                (q === 'библиотека' && ((node.bldg === 2 && node.floor === 1 && lbl.includes('104')) || lbl.includes('библиот'))) ||
                                (q === 'конференц-зал' && ((node.bldg === 2 && node.floor === 3 && lbl.includes('312')) || lbl.includes('конференц'))) ||
                                (lbl.includes(q) && !(q === 'главный вход' && node.id === 'b1_f1_entrance_main'));
                            if (isMatch) {
                                targetNode = node;
                                break;
                            }
                        }
                    }
                }
                if (targetNode) {
                    NAV_STATE.destPoint = targetNode;
                    const inputB = document.getElementById('nav-input-dest');
                    if (inputB) inputB.value = `${targetNode.label} (Корпус ${targetNode.bldg}, ${targetNode.floor} этаж)`;

                    // Если точка отправления не выбрана, ставим Главный вход
                    if (!NAV_STATE.startPoint) {
                        const mainEntrance = g.getNode('b3_f1_entrance_west') || g.getNode('b1_f1_entrance_main');
                        if (mainEntrance) {
                            NAV_STATE.startPoint = mainEntrance;
                            const inputA = document.getElementById('nav-input-start');
                            if (inputA) inputA.value = 'Главный вход (Корпус 3 / Западный)';
                        }
                    }

                    if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                        buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                        closeNavigatorModal();
                    }
                }
            }, { signal: chipsSignal });
        });

        // Кнопка "Свернуть/Развернуть подробный маршрут"
        const btnToggleSteps = document.getElementById('btn-toggle-steps');
        const stepsContainer = document.getElementById('nav-steps-container');
        if (btnToggleSteps && stepsContainer) {
            btnToggleSteps.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = stepsContainer.classList.contains('hidden');
                stepsContainer.classList.toggle('hidden', !isHidden);
                const icon = btnToggleSteps.querySelector('svg');
                if (icon) {
                    icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            });
        }

        // Хук переключения этажа для синхронизации маршрута
        window.addEventListener('floorChanged', updateRouteVisibilityForCurrentMode);

        // Поддержка запуска маршрута через URL параметры: ?from=105&to=206
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlFrom = urlParams.get('from');
                const urlTo = urlParams.get('to');
                if (urlFrom || urlTo) {
                    setTimeout(() => {
                        const g = NAV_STATE.graph;
                        let fromNode = null;
                        let toNode = null;

                        if (urlFrom) {
                            const q = urlFrom.toLowerCase().trim();
                            if (q === 'главный вход' || q === 'западный вход' || q === 'основной вход' || q === 'вход') {
                                fromNode = g.getNode('b3_f1_entrance_west');
                            } else if (q === 'восточный вход' || q === 'главный вход 2' || q === 'старый вход' || q === 'вход к1' || q === 'ремонт') {
                                fromNode = g.getNode('b1_f1_entrance_main');
                            } else {
                                for (const n of g.nodes.values()) {
                                    if ((n.type === 'room' || n.type === 'entrance') && n.label.toLowerCase().includes(q)) {
                                        fromNode = n;
                                        break;
                                    }
                                }
                            }
                        }
                        if (urlTo) {
                            const q = urlTo.toLowerCase().trim();
                            if (q === 'главный вход' || q === 'западный вход' || q === 'основной вход' || q === 'вход') {
                                toNode = g.getNode('b3_f1_entrance_west');
                            } else if (q === 'восточный вход' || q === 'главный вход 2' || q === 'старый вход' || q === 'вход к1' || q === 'ремонт') {
                                toNode = g.getNode('b1_f1_entrance_main');
                            } else {
                                for (const n of g.nodes.values()) {
                                    if ((n.type === 'room' || n.type === 'entrance') && n.label.toLowerCase().includes(q)) {
                                        toNode = n;
                                        break;
                                    }
                                }
                            }
                        }
                        if (fromNode && toNode) {
                            buildRoute(fromNode, toNode);
                        } else if (toNode) {
                            const entrance = g.getNode('b3_f1_entrance_west') || g.getNode('b1_f1_entrance_main');
                            if (entrance) buildRoute(entrance, toNode);
                        }
                    }, 500);
                } else if (urlParams.has('nav') || urlParams.has('navigator')) {
                    openNavigatorModal();
                }
            } catch (err) {
                console.warn('Navigator URL params parse error:', err);
            }
        }
    }

    function resetRouteCardPicks() {
        const startEl = document.getElementById('nav-card-start-label');
        const destEl = document.getElementById('nav-card-dest-badge');
        if (destEl) destEl.classList.remove('ring-4', 'ring-white/80', 'ring-offset-2', 'ring-offset-[#1a73e8]', 'animate-pulse');
        if (startEl) startEl.classList.remove('ring-4', 'ring-[#1a73e8]', 'ring-offset-2', 'ring-offset-[#c2e7ff]', 'animate-pulse');
    }

    function showPickBanner(text, targetType = 'dest') {
        const banner = document.getElementById('nav-pick-banner');
        const textEl = document.getElementById('nav-pick-text');
        const dotEl = document.getElementById('nav-pick-dot');
        if (banner && textEl) {
            textEl.textContent = text;
            if (dotEl) {
                dotEl.className = targetType === 'dest'
                    ? 'w-3 h-3 rounded-full bg-[#1a73e8] animate-ping'
                    : 'w-3 h-3 rounded-full bg-[#38bdf8] animate-ping';
            }
            banner.classList.remove('hidden');
        }
    }

    function hidePickBanner() {
        const banner = document.getElementById('nav-pick-banner');
        if (banner) banner.classList.add('hidden');
        const pill = document.getElementById('search-route-target-pill');
        if (pill) pill.classList.add('hidden');
        const sInput = document.getElementById('search-input');
        if (sInput) sInput.placeholder = 'Поиск по кабинетам...';
        resetRouteCardPicks();
    }

    // Экспорт глобальных функций
    window.initNavigator = initNavigator;
    window.buildRoute = buildRoute;
    window.clearRoute = clearRoute;
    window.openNavigatorModal = openNavigatorModal;
    window.closeNavigatorModal = closeNavigatorModal;
    window.handleNavigatorMapClick = handleNavigatorMapClick;
    window.renderNavigatorScreenBadges = renderNavigatorScreenBadges;
    window.updateNavigatorAnimation = updateNavigatorAnimation;
    window.updateRouteVisibilityForCurrentMode = updateRouteVisibilityForCurrentMode;
    window.findClosestToilet = findClosestToilet;
    window.setDefaultStartPoint = setDefaultStartPoint;
    window.aStarPath = aStarPath;
    window.NAV_STATE = NAV_STATE;
    window.doesIntersectWall = doesIntersectWall;
    window.formatNavNodeName = formatNavNodeName;
    window.formatNavInputString = formatNavInputString;
    window.applyRoomToActiveRoute = applyRoomToActiveRoute;
    window.checkStairBadgeClick = checkStairBadgeClick;
    window.showPickBanner = showPickBanner;
    window.hidePickBanner = hidePickBanner;

})();
