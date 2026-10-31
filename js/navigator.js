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
        }

        addNode(id, floor, bldg, x, z, type = 'corridor', label = '') {
            if (!this.nodes.has(id)) {
                this.nodes.set(id, {
                    id,
                    floor: parseInt(floor, 10),
                    bldg: parseInt(bldg, 10),
                    x: Math.round(x * 100) / 100,
                    z: Math.round(z * 100) / 100,
                    type,
                    label: label || ''
                });
                this.adj.set(id, []);
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

        // Поиск ближайшего узла графа к заданным координатам на том же этаже и корпусе
        findClosestNode(floor, bldg, x, z, allowedTypes = ['corridor', 'door', 'stair', 'bridge', 'entrance']) {
            let bestNode = null;
            let bestDist = Infinity;

            for (const node of this.nodes.values()) {
                if (node.floor !== floor) continue;
                if (bldg !== null && bldg !== undefined && node.bldg !== bldg) continue;
                if (allowedTypes && !allowedTypes.includes(node.type)) continue;

                const d = Math.hypot(node.x - x, node.z - z);
                if (d < bestDist) {
                    bestDist = d;
                    bestNode = node;
                }
            }

            // Если в рамках одного корпуса не нашли, пробуем любой узел на этом этаже
            if (!bestNode) {
                for (const node of this.nodes.values()) {
                    if (node.floor !== floor) continue;
                    if (allowedTypes && !allowedTypes.includes(node.type)) continue;
                    const d = Math.hypot(node.x - x, node.z - z);
                    if (d < bestDist) {
                        bestDist = d;
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
        g.addNode('b1_f5_nc_-6.0', 5, 1, -6.0, -5.0, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_nc_door_-5.8', 5, 1, -5.8, -5.0, 'door', 'К1 Эт.5 Дверь север');
        g.addNode('b1_f5_nc_-3.0', 5, 1, -3.0, -5.8, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_nc_0.0', 5, 1, 0.0, -5.8, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_nc_3.0', 5, 1, 3.0, -5.8, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_nc_5.9', 5, 1, 5.9, -5.8, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_nc_9.4', 5, 1, 9.4, -5.8, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_nc_12.5', 5, 1, 12.5, -5.8, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_nc_16.0', 5, 1, 15.6, -5.8, 'corridor', 'К1 Эт.5 Сев. коридор');
        g.addNode('b1_f5_wc_-3.0', 5, 1, -3.0, -3.0, 'corridor', 'К1 Эт.5 Зап. коридор');
        g.addNode('b1_f5_wc_0.0', 5, 1, -3.0, 0.0, 'corridor', 'К1 Эт.5 Зап. коридор');
        g.addNode('b1_f5_wc_1.7', 5, 1, -3.0, 1.7, 'corridor', 'К1 Эт.5 Зап. коридор');
        g.addNode('b1_f5_wc_3.5', 5, 1, -3.0, 3.5, 'corridor', 'К1 Эт.5 Зап. коридор');
        g.addNode('b1_f5_wc_6.0', 5, 1, -3.0, 6.0, 'corridor', 'К1 Эт.5 Зап. коридор');
        g.addNode('b1_f5_sc_0.0', 5, 1, 0.0, 6.0, 'corridor', 'К1 Эт.5 Юж. коридор');
        g.addNode('b1_f5_sc_1.8', 5, 1, 1.8, 6.0, 'corridor', 'К1 Эт.5 Юж. коридор');
        g.addNode('b1_f5_sc_3.5', 5, 1, 3.5, 6.0, 'corridor', 'К1 Эт.5 Юж. коридор');
        g.addNode('b1_f5_sc_5.6', 5, 1, 5.6, 6.0, 'corridor', 'К1 Эт.5 Юж. коридор');
        g.addNode('b1_f5_sc_9.4', 5, 1, 9.4, 6.0, 'corridor', 'К1 Эт.5 Юж. коридор');
        g.addNode('b1_f5_sc_10.5', 5, 1, 10.5, 6.0, 'corridor', 'К1 Эт.5 Юж. коридор');
        g.addNode('b1_f5_stair_lk1', 5, 1, 9.4, -1.9, 'stair', 'К1 ЛК№1 (Эт.5)');
        g.addNode('b1_f5_stair_lk2', 5, 1, 9.4, 1.9, 'stair', 'К1 ЛК№2 (Эт.5)');
        g.addNode('b1_f5_elev', 5, 1, 1.8, 1.5, 'elevator', 'К1 Лифты (Эт.5)');
        g.addNode('b1_f6_nc_-6.0', 6, 1, -6.0, -5.0, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_nc_door_-5.8', 6, 1, -5.8, -5.0, 'door', 'К1 Эт.6 Дверь север');
        g.addNode('b1_f6_nc_-3.0', 6, 1, -3.0, -5.8, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_nc_0.0', 6, 1, 0.0, -5.8, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_nc_3.0', 6, 1, 3.0, -5.8, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_nc_5.9', 6, 1, 5.9, -5.8, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_nc_9.4', 6, 1, 9.4, -5.8, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_nc_12.5', 6, 1, 12.5, -5.8, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_nc_16.0', 6, 1, 15.6, -5.8, 'corridor', 'К1 Эт.6 Сев. коридор');
        g.addNode('b1_f6_wc_-3.0', 6, 1, -3.0, -3.0, 'corridor', 'К1 Эт.6 Зап. коридор');
        g.addNode('b1_f6_wc_0.0', 6, 1, -3.0, 0.0, 'corridor', 'К1 Эт.6 Зап. коридор');
        g.addNode('b1_f6_wc_1.7', 6, 1, -3.0, 1.7, 'corridor', 'К1 Эт.6 Зап. коридор');
        g.addNode('b1_f6_wc_3.5', 6, 1, -3.0, 3.5, 'corridor', 'К1 Эт.6 Зап. коридор');
        g.addNode('b1_f6_wc_6.0', 6, 1, -3.0, 6.0, 'corridor', 'К1 Эт.6 Зап. коридор');
        g.addNode('b1_f6_sc_0.0', 6, 1, 0.0, 6.0, 'corridor', 'К1 Эт.6 Юж. коридор');
        g.addNode('b1_f6_sc_1.8', 6, 1, 1.8, 6.0, 'corridor', 'К1 Эт.6 Юж. коридор');
        g.addNode('b1_f6_sc_3.5', 6, 1, 3.5, 6.0, 'corridor', 'К1 Эт.6 Юж. коридор');
        g.addNode('b1_f6_sc_5.6', 6, 1, 5.6, 6.0, 'corridor', 'К1 Эт.6 Юж. коридор');
        g.addNode('b1_f6_sc_9.4', 6, 1, 9.4, 6.0, 'corridor', 'К1 Эт.6 Юж. коридор');
        g.addNode('b1_f6_sc_10.5', 6, 1, 10.5, 6.0, 'corridor', 'К1 Эт.6 Юж. коридор');
        g.addNode('b1_f6_stair_lk1', 6, 1, 9.4, -1.9, 'stair', 'К1 ЛК№1 (Эт.6)');
        g.addNode('b1_f6_stair_lk2', 6, 1, 9.4, 1.9, 'stair', 'К1 ЛК№2 (Эт.6)');
        g.addNode('b1_f6_elev', 6, 1, 1.8, 1.5, 'elevator', 'К1 Лифты (Эт.6)');
        g.addNode('b1_f7_nc_-6.0', 7, 1, -6.0, -5.0, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_nc_door_-5.8', 7, 1, -5.8, -5.0, 'door', 'К1 Эт.7 Дверь север');
        g.addNode('b1_f7_nc_-3.0', 7, 1, -3.0, -5.8, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_nc_0.0', 7, 1, 0.0, -5.8, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_nc_3.0', 7, 1, 3.0, -5.8, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_nc_5.9', 7, 1, 5.9, -5.8, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_nc_9.4', 7, 1, 9.4, -5.8, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_nc_12.5', 7, 1, 12.5, -5.8, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_nc_16.0', 7, 1, 15.6, -5.8, 'corridor', 'К1 Эт.7 Сев. коридор');
        g.addNode('b1_f7_wc_-3.0', 7, 1, -3.0, -3.0, 'corridor', 'К1 Эт.7 Зап. коридор');
        g.addNode('b1_f7_wc_0.0', 7, 1, -3.0, 0.0, 'corridor', 'К1 Эт.7 Зап. коридор');
        g.addNode('b1_f7_wc_1.7', 7, 1, -3.0, 1.7, 'corridor', 'К1 Эт.7 Зап. коридор');
        g.addNode('b1_f7_wc_3.5', 7, 1, -3.0, 3.5, 'corridor', 'К1 Эт.7 Зап. коридор');
        g.addNode('b1_f7_wc_6.0', 7, 1, -3.0, 6.0, 'corridor', 'К1 Эт.7 Зап. коридор');
        g.addNode('b1_f7_sc_0.0', 7, 1, 0.0, 6.0, 'corridor', 'К1 Эт.7 Юж. коридор');
        g.addNode('b1_f7_sc_1.8', 7, 1, 1.8, 6.0, 'corridor', 'К1 Эт.7 Юж. коридор');
        g.addNode('b1_f7_sc_3.5', 7, 1, 3.5, 6.0, 'corridor', 'К1 Эт.7 Юж. коридор');
        g.addNode('b1_f7_sc_5.6', 7, 1, 5.6, 6.0, 'corridor', 'К1 Эт.7 Юж. коридор');
        g.addNode('b1_f7_sc_9.4', 7, 1, 9.4, 6.0, 'corridor', 'К1 Эт.7 Юж. коридор');
        g.addNode('b1_f7_sc_10.5', 7, 1, 10.5, 6.0, 'corridor', 'К1 Эт.7 Юж. коридор');
        g.addNode('b1_f7_stair_lk1', 7, 1, 9.4, -1.9, 'stair', 'К1 ЛК№1 (Эт.7)');
        g.addNode('b1_f7_stair_lk2', 7, 1, 9.4, 1.9, 'stair', 'К1 ЛК№2 (Эт.7)');
        g.addNode('b1_f7_elev', 7, 1, 1.8, 1.5, 'elevator', 'К1 Лифты (Эт.7)');
        g.addNode('room_1_5_56', 5, 1, 6.2, -2.8, 'room', 'С/У');
        g.addNode('door_mid_room_1_5_56', 5, 1, 5.4, -4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_5_56', 5, 1, 5.4, -3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_5_56', 5, 1, 5.4, -4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_5_57', 5, 1, 5.6, 1.3, 'room', 'С/У');
        g.addNode('door_mid_room_1_5_57', 5, 1, 5.5, 4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_5_57', 5, 1, 5.5, 3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_5_57', 5, 1, 5.5, 4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_5_58', 5, 1, 9.4, -1.9, 'room', 'ЛК№1');
        g.addNode('door_mid_room_1_5_58', 5, 1, 9.4, -3.8, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_1_5_58', 5, 1, 9.4, -3.4, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_1_5_58', 5, 1, 9.4, -4.2, 'door', 'Коридор ЛК№1');
        g.addNode('room_1_5_59', 5, 1, 9.4, 1.9, 'room', 'ЛК№2');
        g.addNode('door_mid_room_1_5_59', 5, 1, 9.4, 3.8, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_1_5_59', 5, 1, 9.4, 3.4, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_1_5_59', 5, 1, 9.4, 4.2, 'door', 'Коридор ЛК№2');
        g.addNode('room_1_5_60', 5, 1, 1.8, 1.5, 'room', 'Лифтовой холл');
        g.addNode('door_mid_room_1_5_60', 5, 1, -1.2, 1.7, 'door', 'Дверь Лифтовой холл');
        g.addNode('door_room_room_1_5_60', 5, 1, -0.8, 1.7, 'door', 'Вход Лифтовой холл');
        g.addNode('door_corr_room_1_5_60', 5, 1, -1.6, 1.7, 'door', 'Коридор Лифтовой холл');
        g.addNode('room_1_5_61', 5, 1, -4.2, -10.2, 'room', '503');
        g.addNode('door_mid_room_1_5_61', 5, 1, -0.4, -6.2, 'door', 'Дверь 503');
        g.addNode('door_room_room_1_5_61', 5, 1, -0.4, -6.6, 'door', 'Вход 503');
        g.addNode('door_corr_room_1_5_61', 5, 1, -0.4, -5.8, 'door', 'Коридор 503');
        g.addNode('room_1_5_62', 5, 1, 3.5, -11.4, 'room', '503А');
        g.addNode('door_mid_room_1_5_62', 5, 1, 3.5, -8.6, 'door', 'Дверь 503А');
        g.addNode('door_room_room_1_5_62', 5, 1, 3.5, -9.0, 'door', 'Вход 503А');
        g.addNode('door_corr_room_1_5_62', 5, 1, 3.5, -8.2, 'door', 'Коридор 503А');
        g.addNode('room_1_5_63', 5, 1, 10.6, -10.2, 'room', '504');
        g.addNode('door_mid_room_1_5_63', 5, 1, 7.9, -6.2, 'door', 'Дверь 504');
        g.addNode('door_room_room_1_5_63', 5, 1, 7.9, -6.6, 'door', 'Вход 504');
        g.addNode('door_corr_room_1_5_63', 5, 1, 7.9, -5.8, 'door', 'Коридор 504');
        g.addNode('room_1_5_64', 5, 1, -9.9, -2.0, 'room', '502А');
        g.addNode('door_mid_room_1_5_64', 5, 1, -5.8, -1.6, 'door', 'Дверь 502А');
        g.addNode('door_room_room_1_5_64', 5, 1, -6.2, -1.6, 'door', 'Вход 502А');
        g.addNode('door_corr_room_1_5_64', 5, 1, -5.4, -1.6, 'door', 'Коридор 502А');
        g.addNode('room_1_5_65', 5, 1, -9.9, 7.0, 'room', '502');
        g.addNode('door_mid_room_1_5_65', 5, 1, -5.8, 2.8, 'door', 'Дверь 502');
        g.addNode('door_room_room_1_5_65', 5, 1, -6.2, 2.8, 'door', 'Вход 502');
        g.addNode('door_corr_room_1_5_65', 5, 1, -5.4, 2.8, 'door', 'Коридор 502');
        g.addNode('room_1_5_66', 5, 1, -4.0, 10.8, 'room', '501А');
        g.addNode('door_mid_room_1_5_66', 5, 1, -4.0, 7.2, 'door', 'Дверь 501А');
        g.addNode('door_room_room_1_5_66', 5, 1, -4.0, 7.6, 'door', 'Вход 501А');
        g.addNode('door_corr_room_1_5_66', 5, 1, -4.0, 6.8, 'door', 'Коридор 501А');
        g.addNode('room_1_5_67', 5, 1, 5.2, 10.8, 'room', '501');
        g.addNode('door_mid_room_1_5_67', 5, 1, -0.4, 7.2, 'door', 'Дверь 501');
        g.addNode('door_room_room_1_5_67', 5, 1, -0.4, 7.6, 'door', 'Вход 501');
        g.addNode('door_corr_room_1_5_67', 5, 1, -0.4, 6.8, 'door', 'Коридор 501');
        g.addNode('room_1_6_68', 6, 1, 6.2, -2.8, 'room', 'С/У');
        g.addNode('door_mid_room_1_6_68', 6, 1, 5.4, -4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_6_68', 6, 1, 5.4, -3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_6_68', 6, 1, 5.4, -4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_6_69', 6, 1, 5.6, 1.3, 'room', 'С/У');
        g.addNode('door_mid_room_1_6_69', 6, 1, 5.5, 4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_6_69', 6, 1, 5.5, 3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_6_69', 6, 1, 5.5, 4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_6_70', 6, 1, 9.4, -1.9, 'room', 'ЛК№1');
        g.addNode('door_mid_room_1_6_70', 6, 1, 9.4, -3.8, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_1_6_70', 6, 1, 9.4, -3.4, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_1_6_70', 6, 1, 9.4, -4.2, 'door', 'Коридор ЛК№1');
        g.addNode('room_1_6_71', 6, 1, 9.4, 1.9, 'room', 'ЛК№2');
        g.addNode('door_mid_room_1_6_71', 6, 1, 9.4, 3.8, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_1_6_71', 6, 1, 9.4, 3.4, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_1_6_71', 6, 1, 9.4, 4.2, 'door', 'Коридор ЛК№2');
        g.addNode('room_1_6_72', 6, 1, 1.8, 1.5, 'room', 'Лифтовой холл');
        g.addNode('door_mid_room_1_6_72', 6, 1, -1.2, 1.7, 'door', 'Дверь Лифтовой холл');
        g.addNode('door_room_room_1_6_72', 6, 1, -0.8, 1.7, 'door', 'Вход Лифтовой холл');
        g.addNode('door_corr_room_1_6_72', 6, 1, -1.6, 1.7, 'door', 'Коридор Лифтовой холл');
        g.addNode('room_1_6_73', 6, 1, -4.2, -10.2, 'room', '604');
        g.addNode('door_mid_room_1_6_73', 6, 1, -0.4, -6.2, 'door', 'Дверь 604');
        g.addNode('door_room_room_1_6_73', 6, 1, -0.4, -6.6, 'door', 'Вход 604');
        g.addNode('door_corr_room_1_6_73', 6, 1, -0.4, -5.8, 'door', 'Коридор 604');
        g.addNode('room_1_6_74', 6, 1, 3.5, -11.4, 'room', '604А');
        g.addNode('door_mid_room_1_6_74', 6, 1, 3.5, -8.6, 'door', 'Дверь 604А');
        g.addNode('door_room_room_1_6_74', 6, 1, 3.5, -9.0, 'door', 'Вход 604А');
        g.addNode('door_corr_room_1_6_74', 6, 1, 3.5, -8.2, 'door', 'Коридор 604А');
        g.addNode('room_1_6_75', 6, 1, 10.6, -10.2, 'room', '605');
        g.addNode('door_mid_room_1_6_75', 6, 1, 7.9, -6.2, 'door', 'Дверь 605');
        g.addNode('door_room_room_1_6_75', 6, 1, 7.9, -6.6, 'door', 'Вход 605');
        g.addNode('door_corr_room_1_6_75', 6, 1, 7.9, -5.8, 'door', 'Коридор 605');
        g.addNode('room_1_6_76', 6, 1, -9.9, -2.0, 'room', '603А');
        g.addNode('door_mid_room_1_6_76', 6, 1, -5.8, -1.6, 'door', 'Дверь 603А');
        g.addNode('door_room_room_1_6_76', 6, 1, -6.2, -1.6, 'door', 'Вход 603А');
        g.addNode('door_corr_room_1_6_76', 6, 1, -5.4, -1.6, 'door', 'Коридор 603А');
        g.addNode('room_1_6_77', 6, 1, -9.9, 7.0, 'room', '603');
        g.addNode('door_mid_room_1_6_77', 6, 1, -5.8, 2.8, 'door', 'Дверь 603');
        g.addNode('door_room_room_1_6_77', 6, 1, -6.2, 2.8, 'door', 'Вход 603');
        g.addNode('door_corr_room_1_6_77', 6, 1, -5.4, 2.8, 'door', 'Коридор 603');
        g.addNode('room_1_6_78', 6, 1, -4.0, 10.8, 'room', '602А');
        g.addNode('door_mid_room_1_6_78', 6, 1, -4.0, 7.2, 'door', 'Дверь 602А');
        g.addNode('door_room_room_1_6_78', 6, 1, -4.0, 7.6, 'door', 'Вход 602А');
        g.addNode('door_corr_room_1_6_78', 6, 1, -4.0, 6.8, 'door', 'Коридор 602А');
        g.addNode('room_1_6_79', 6, 1, 3.2, 10.8, 'room', '602');
        g.addNode('door_mid_room_1_6_79', 6, 1, -0.4, 7.2, 'door', 'Дверь 602');
        g.addNode('door_room_room_1_6_79', 6, 1, -0.4, 7.6, 'door', 'Вход 602');
        g.addNode('door_corr_room_1_6_79', 6, 1, -0.4, 6.8, 'door', 'Коридор 602');
        g.addNode('room_1_6_80', 6, 1, 10.5, 10.8, 'room', '601');
        g.addNode('door_mid_room_1_6_80', 6, 1, 9.8, 7.2, 'door', 'Дверь 601');
        g.addNode('door_room_room_1_6_80', 6, 1, 9.8, 7.6, 'door', 'Вход 601');
        g.addNode('door_corr_room_1_6_80', 6, 1, 9.8, 6.8, 'door', 'Коридор 601');
        g.addNode('room_1_7_81', 7, 1, 6.2, -2.8, 'room', 'С/У');
        g.addNode('door_mid_room_1_7_81', 7, 1, 5.4, -4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_7_81', 7, 1, 5.4, -3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_7_81', 7, 1, 5.4, -4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_7_82', 7, 1, 5.6, 1.3, 'room', 'С/У');
        g.addNode('door_mid_room_1_7_82', 7, 1, 5.5, 4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_7_82', 7, 1, 5.5, 3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_7_82', 7, 1, 5.5, 4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_7_83', 7, 1, 9.4, -1.9, 'room', 'ЛК№1');
        g.addNode('door_mid_room_1_7_83', 7, 1, 9.4, -3.8, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_1_7_83', 7, 1, 9.4, -3.4, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_1_7_83', 7, 1, 9.4, -4.2, 'door', 'Коридор ЛК№1');
        g.addNode('room_1_7_84', 7, 1, 9.4, 1.9, 'room', 'ЛК№2');
        g.addNode('door_mid_room_1_7_84', 7, 1, 9.4, 3.8, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_1_7_84', 7, 1, 9.4, 3.4, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_1_7_84', 7, 1, 9.4, 4.2, 'door', 'Коридор ЛК№2');
        g.addNode('room_1_7_85', 7, 1, 1.8, 1.5, 'room', 'Лифтовой холл');
        g.addNode('door_mid_room_1_7_85', 7, 1, -1.2, 1.7, 'door', 'Дверь Лифтовой холл');
        g.addNode('door_room_room_1_7_85', 7, 1, -0.8, 1.7, 'door', 'Вход Лифтовой холл');
        g.addNode('door_corr_room_1_7_85', 7, 1, -1.6, 1.7, 'door', 'Коридор Лифтовой холл');
        g.addNode('room_1_7_86', 7, 1, -6.2, -10.2, 'room', '703');
        g.addNode('door_mid_room_1_7_86', 7, 1, -2.6, -6.2, 'door', 'Дверь 703');
        g.addNode('door_room_room_1_7_86', 7, 1, -2.6, -6.6, 'door', 'Вход 703');
        g.addNode('door_corr_room_1_7_86', 7, 1, -2.6, -5.8, 'door', 'Коридор 703');
        g.addNode('room_1_7_87', 7, 1, -0.3, -11.4, 'room', '703А');
        g.addNode('door_mid_room_1_7_87', 7, 1, -0.3, -8.8, 'door', 'Дверь 703А');
        g.addNode('door_room_room_1_7_87', 7, 1, -0.3, -9.2, 'door', 'Вход 703А');
        g.addNode('door_corr_room_1_7_87', 7, 1, -0.3, -8.4, 'door', 'Коридор 703А');
        g.addNode('room_1_7_88', 7, 1, 10.6, -10.2, 'room', '704');
        g.addNode('door_mid_room_1_7_88', 7, 1, 7.9, -6.2, 'door', 'Дверь 704');
        g.addNode('door_room_room_1_7_88', 7, 1, 7.9, -6.6, 'door', 'Вход 704');
        g.addNode('door_corr_room_1_7_88', 7, 1, 7.9, -5.8, 'door', 'Коридор 704');
        g.addNode('room_1_7_89', 7, 1, -9.9, -1.8, 'room', '702А');
        g.addNode('door_mid_room_1_7_89', 7, 1, -5.8, -1.6, 'door', 'Дверь 702А');
        g.addNode('door_room_room_1_7_89', 7, 1, -6.2, -1.6, 'door', 'Вход 702А');
        g.addNode('door_corr_room_1_7_89', 7, 1, -5.4, -1.6, 'door', 'Коридор 702А');
        g.addNode('room_1_7_90', 7, 1, -9.9, 7.2, 'room', '702');
        g.addNode('door_mid_room_1_7_90', 7, 1, -5.8, 3.2, 'door', 'Дверь 702');
        g.addNode('door_room_room_1_7_90', 7, 1, -6.2, 3.2, 'door', 'Вход 702');
        g.addNode('door_corr_room_1_7_90', 7, 1, -5.4, 3.2, 'door', 'Коридор 702');
        g.addNode('room_1_7_91', 7, 1, -3.7, 10.8, 'room', '701А');
        g.addNode('door_mid_room_1_7_91', 7, 1, -4.0, 7.2, 'door', 'Дверь 701А');
        g.addNode('door_room_room_1_7_91', 7, 1, -4.0, 7.6, 'door', 'Вход 701А');
        g.addNode('door_corr_room_1_7_91', 7, 1, -4.0, 6.8, 'door', 'Коридор 701А');
        g.addNode('room_1_7_92', 7, 1, 3.5, 10.8, 'room', '701');
        g.addNode('door_mid_room_1_7_92', 7, 1, 0.4, 7.2, 'door', 'Дверь 701');
        g.addNode('door_room_room_1_7_92', 7, 1, 0.4, 7.6, 'door', 'Вход 701');
        g.addNode('door_corr_room_1_7_92', 7, 1, 0.4, 6.8, 'door', 'Коридор 701');
        g.addNode('b1_f3_nc_-3.0', 3, 1, -3.0, -5.8, 'corridor', 'К1 Эт.3 Сев. коридор');
        g.addNode('b1_f3_nc_0.0', 3, 1, 0.0, -5.8, 'corridor', 'К1 Эт.3 Сев. коридор');
        g.addNode('b1_f3_nc_3.0', 3, 1, 3.0, -5.8, 'corridor', 'К1 Эт.3 Сев. коридор');
        g.addNode('b1_f3_nc_5.9', 3, 1, 5.9, -5.8, 'corridor', 'К1 Эт.3 Сев. коридор');
        g.addNode('b1_f3_nc_9.4', 3, 1, 9.4, -5.8, 'corridor', 'К1 Эт.3 Сев. коридор');
        g.addNode('b1_f3_nc_12.5', 3, 1, 12.5, -5.8, 'corridor', 'К1 Эт.3 Сев. коридор');
        g.addNode('b1_f3_nc_16.0', 3, 1, 15.6, -5.8, 'corridor', 'К1 Эт.3 Сев. коридор');
        g.addNode('b1_f3_wc_-3.0', 3, 1, -3.0, -3.0, 'corridor', 'К1 Эт.3 Зап. коридор');
        g.addNode('b1_f3_wc_0.0', 3, 1, -3.0, 0.0, 'corridor', 'К1 Эт.3 Зап. коридор');
        g.addNode('b1_f3_wc_1.7', 3, 1, -3.0, 1.7, 'corridor', 'К1 Эт.3 Зап. коридор');
        g.addNode('b1_f3_wc_3.5', 3, 1, -3.0, 3.5, 'corridor', 'К1 Эт.3 Зап. коридор');
        g.addNode('b1_f3_wc_6.0', 3, 1, -3.0, 6.0, 'corridor', 'К1 Эт.3 Зап. коридор');
        g.addNode('b1_f3_sc_0.0', 3, 1, 0.0, 6.0, 'corridor', 'К1 Эт.3 Юж. коридор');
        g.addNode('b1_f3_sc_1.8', 3, 1, 1.8, 6.0, 'corridor', 'К1 Эт.3 Юж. коридор');
        g.addNode('b1_f3_sc_3.5', 3, 1, 3.5, 6.0, 'corridor', 'К1 Эт.3 Юж. коридор');
        g.addNode('b1_f3_sc_5.6', 3, 1, 5.6, 6.0, 'corridor', 'К1 Эт.3 Юж. коридор');
        g.addNode('b1_f3_sc_9.4', 3, 1, 9.4, 6.0, 'corridor', 'К1 Эт.3 Юж. коридор');
        g.addNode('b1_f3_sc_10.5', 3, 1, 10.5, 6.0, 'corridor', 'К1 Эт.3 Юж. коридор');
        g.addNode('b1_f3_stair_lk1', 3, 1, 9.4, -1.9, 'stair', 'К1 ЛК№1 (Эт.3)');
        g.addNode('b1_f3_stair_lk2', 3, 1, 9.4, 1.9, 'stair', 'К1 ЛК№2 (Эт.3)');
        g.addNode('b1_f3_elev', 3, 1, 1.8, 1.5, 'elevator', 'К1 Лифты (Эт.3)');
        // b2_f3_c_20.4 упразднен: на 3 этаже X in [20.4..23.2] занимает каб. 302, коридор начинается от X=23.2
        g.addNode('b2_f3_c_22.6', 3, 2, 24.4, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_d_308', 3, 2, 24.4, -5.0, 'door', 'К2 Эт.3 Дверь 308');
        g.addNode('b2_f3_c_308_hall', 3, 2, 24.4, -3.8, 'corridor', 'К2 Эт.3 Зал 308');
        g.addNode('b2_f3_c_26.0', 3, 2, 26.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_30.0', 3, 2, 30.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_34.0', 3, 2, 34.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_37.5', 3, 2, 37.5, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_41.0', 3, 2, 41.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_43.6', 3, 2, 43.6, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_47.0', 3, 2, 47.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_51.0', 3, 2, 51.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_55.0', 3, 2, 55.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_59.0', 3, 2, 59.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_63.0', 3, 2, 63.0, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_c_66.1', 3, 2, 66.1, -5.8, 'corridor', 'К2 Эт.3 Коридор');
        g.addNode('b2_f3_stair_lk1', 3, 2, 66.1, -10.5, 'stair', 'К2 ЛК№1 (Эт.3)');
        g.addNode('b2_f3_stair_lk2', 3, 2, 42.7, -10.5, 'stair', 'К2 ЛК№2 (Эт.3)');
        // ЛК№3 не продолжается на 3 этаж (на 3 этаже расположена комната 302 по БТИ)
        g.addNode('b4_f3_stair_lk1', 3, 4, 40.6, -27.8, 'stair', 'К4 ЛК№1 (Эт.3)');
        g.addNode('b4_f3_stair_lk1_door', 3, 4, 40.6, -31.2, 'door', 'К4 Дверь ЛК№1 (Эт.3)');
        g.addNode('b4_f3_stair_lk2', 3, 4, 30.1, -48.3, 'stair', 'К4 ЛК№2 (Эт.3)');
        g.addNode('b4_f3_stair_lk2_door', 3, 4, 32.4, -48.3, 'door', 'К4 Дверь ЛК№2 (Эт.3)');
        g.addNode('b4_f3_stair_lk3', 3, 4, 65.2, -47.6, 'stair', 'К4 ЛК№3 (Эт.3)');
        g.addNode('b4_f3_sw_-38.0', 3, 4, 37.5, -38.0, 'corridor', 'К4 Эт.3 Юж. коридор');
        g.addNode('b4_f3_stair_lk3_door', 3, 4, 61.6, -48.3, 'door', 'К4 Дверь ЛК№3 (Эт.3)');
        g.addNode('room_1_3_31', 3, 1, 6.2, -2.8, 'room', 'С/У');
        g.addNode('door_mid_room_1_3_31', 3, 1, 5.4, -4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_3_31', 3, 1, 5.4, -3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_3_31', 3, 1, 5.4, -4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_3_32', 3, 1, 5.6, 1.3, 'room', 'С/У');
        g.addNode('door_mid_room_1_3_32', 3, 1, 5.5, 4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_3_32', 3, 1, 5.5, 3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_3_32', 3, 1, 5.5, 4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_3_33', 3, 1, 9.4, -1.9, 'room', 'ЛК№1');
        g.addNode('door_mid_room_1_3_33', 3, 1, 9.4, -3.8, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_1_3_33', 3, 1, 9.4, -3.4, 'door', 'Вход ЛК№1');
        g.addNode('room_1_3_34', 3, 1, 9.4, 1.9, 'room', 'ЛК№2');
        g.addNode('door_mid_room_1_3_34', 3, 1, 9.4, 3.8, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_1_3_34', 3, 1, 9.4, 3.4, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_1_3_34', 3, 1, 9.4, 4.2, 'door', 'Коридор ЛК№2');
        g.addNode('room_1_3_35', 3, 1, 1.8, 1.5, 'room', 'Лифтовой холл');
        g.addNode('door_mid_room_1_3_35', 3, 1, -1.2, 1.7, 'door', 'Дверь Лифтовой холл');
        g.addNode('door_room_room_1_3_35', 3, 1, -0.8, 1.7, 'door', 'Вход Лифтовой холл');
        g.addNode('door_corr_room_1_3_35', 3, 1, -1.6, 1.7, 'door', 'Коридор Лифтовой холл');
        g.addNode('room_1_3_36', 3, 1, -4.2, -10.2, 'room', '303');
        g.addNode('door_mid_room_1_3_36', 3, 1, -0.4, -6.2, 'door', 'Дверь 303');
        g.addNode('door_room_room_1_3_36', 3, 1, -0.4, -6.6, 'door', 'Вход 303');
        g.addNode('door_corr_room_1_3_36', 3, 1, -0.4, -5.8, 'door', 'Коридор 303');
        g.addNode('room_1_3_37', 3, 1, 3.5, -11.4, 'room', '303А');
        g.addNode('door_mid_room_1_3_37', 3, 1, 3.5, -8.6, 'door', 'Дверь 303А');
        g.addNode('door_room_room_1_3_37', 3, 1, 3.5, -9.0, 'door', 'Вход 303А');
        g.addNode('door_corr_room_1_3_37', 3, 1, 3.5, -8.2, 'door', 'Коридор 303А');
        g.addNode('room_1_3_38', 3, 1, 10.6, -10.2, 'room', '304');
        g.addNode('door_mid_room_1_3_38', 3, 1, 7.9, -6.2, 'door', 'Дверь 304');
        g.addNode('door_corr_room_1_3_39', 3, 1, 15.6, -5.0, 'door', 'Коридор 305');
        g.addNode('door_mid_room_1_3_39', 3, 1, 16.0, -5.0, 'door', 'Дверь 305');
        g.addNode('door_room_room_1_3_39', 3, 1, 16.4, -5.0, 'door', 'Вход 305');
        g.addNode('room_1_3_39', 3, 1, 18.2, -5.8, 'room', '305');
        g.addNode('room_1_3_40', 3, 1, -9.9, -2.0, 'room', '302А');
        g.addNode('door_mid_room_1_3_40', 3, 1, -5.8, -1.6, 'door', 'Дверь 302А');
        g.addNode('door_room_room_1_3_40', 3, 1, -6.2, -1.6, 'door', 'Вход 302А');
        g.addNode('door_corr_room_1_3_40', 3, 1, -5.4, -1.6, 'door', 'Коридор 302А');
        g.addNode('room_1_3_41', 3, 1, -9.9, 7.0, 'room', '302');
        g.addNode('door_mid_room_1_3_41', 3, 1, -5.8, 2.8, 'door', 'Дверь 302');
        g.addNode('door_room_room_1_3_41', 3, 1, -6.2, 2.8, 'door', 'Вход 302');
        g.addNode('door_corr_room_1_3_41', 3, 1, -5.4, 2.8, 'door', 'Коридор 302');
        g.addNode('room_1_3_42', 3, 1, -4.0, 10.8, 'room', '301А');
        g.addNode('door_mid_room_1_3_42', 3, 1, -4.0, 7.2, 'door', 'Дверь 301А');
        g.addNode('door_room_room_1_3_42', 3, 1, -4.0, 7.6, 'door', 'Вход 301А');
        g.addNode('door_corr_room_1_3_42', 3, 1, -4.0, 6.8, 'door', 'Коридор 301А');
        g.addNode('room_1_3_43', 3, 1, 5.2, 10.8, 'room', '301');
        g.addNode('door_mid_room_1_3_43', 3, 1, -0.4, 7.2, 'door', 'Дверь 301');
        g.addNode('door_room_room_1_3_43', 3, 1, -0.4, 7.6, 'door', 'Вход 301');
        g.addNode('door_corr_room_1_3_43', 3, 1, -0.4, 6.8, 'door', 'Коридор 301');
        g.addNode('room_2_3_123', 3, 2, 21.8, -9.2, 'room', '302');
        g.addNode('door_mid_room_2_3_123', 3, 2, 21.8, -4.4, 'door', 'Дверь 302');
        g.addNode('door_room_room_2_3_123', 3, 2, 21.8, -4.8, 'door', 'Вход 302');
        g.addNode('door_corr_room_2_3_123', 3, 2, 21.8, -3.8, 'door', 'Коридор 302');
        g.addNode('room_2_3_124', 3, 2, 27.3, -10.5, 'room', '304');
        g.addNode('door_mid_room_2_3_124', 3, 2, 27.2, -7.2, 'door', 'Дверь 304');
        g.addNode('door_room_room_2_3_124', 3, 2, 27.2, -7.6, 'door', 'Вход 304');
        g.addNode('door_corr_room_2_3_124', 3, 2, 27.2, -6.8, 'door', 'Коридор 304');
        g.addNode('room_2_3_125', 3, 2, 30.6, -10.5, 'room', '305');
        g.addNode('door_mid_room_2_3_125', 3, 2, 30.5, -7.2, 'door', 'Дверь 305');
        g.addNode('door_room_room_2_3_125', 3, 2, 30.5, -7.6, 'door', 'Вход 305');
        g.addNode('door_corr_room_2_3_125', 3, 2, 30.5, -6.8, 'door', 'Коридор 305');
        g.addNode('room_2_3_126', 3, 2, 33.9, -10.5, 'room', '306');
        g.addNode('door_mid_room_2_3_126', 3, 2, 33.8, -7.2, 'door', 'Дверь 306');
        g.addNode('door_room_room_2_3_126', 3, 2, 33.8, -7.6, 'door', 'Вход 306');
        g.addNode('door_corr_room_2_3_126', 3, 2, 33.8, -6.8, 'door', 'Коридор 306');
        g.addNode('room_2_3_127', 3, 2, 37.1, -10.5, 'room', '307');
        g.addNode('door_mid_room_2_3_127', 3, 2, 37.1, -7.2, 'door', 'Дверь 307');
        g.addNode('door_room_room_2_3_127', 3, 2, 37.1, -7.6, 'door', 'Вход 307');
        g.addNode('door_corr_room_2_3_127', 3, 2, 37.1, -6.8, 'door', 'Коридор 307');
        g.addNode('room_2_3_128', 3, 2, 39.5, -7.8, 'room', 'С/У');
        g.addNode('door_mid_room_2_3_128', 3, 2, 39.6, -7.2, 'door', 'Дверь С/У');
        g.addNode('door_room_room_2_3_128', 3, 2, 39.6, -7.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_2_3_128', 3, 2, 39.6, -6.8, 'door', 'Коридор С/У');
        g.addNode('room_2_3_129', 3, 2, 41.0, -7.8, 'room', 'С/У');
        g.addNode('door_mid_room_2_3_129', 3, 2, 41.0, -7.2, 'door', 'Дверь С/У');
        g.addNode('door_room_room_2_3_129', 3, 2, 41.0, -7.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_2_3_129', 3, 2, 41.0, -6.8, 'door', 'Коридор С/У');
        g.addNode('room_2_3_130', 3, 2, 44.5, -12.5, 'room', 'ЛК№2');
        g.addNode('door_mid_room_2_3_130', 3, 2, 44.5, -7.2, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_2_3_130', 3, 2, 44.5, -7.6, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_2_3_130', 3, 2, 44.5, -6.8, 'door', 'Коридор ЛК№2');
        g.addNode('room_2_3_131', 3, 2, 51.3, -10.5, 'room', '313');
        g.addNode('door_mid_room_2_3_131', 3, 2, 51.7, -7.2, 'door', 'Дверь 313');
        g.addNode('door_room_room_2_3_131', 3, 2, 51.7, -7.6, 'door', 'Вход 313');
        g.addNode('door_corr_room_2_3_131', 3, 2, 51.7, -6.8, 'door', 'Коридор 313');
        g.addNode('room_2_3_132', 3, 2, 57.8, -10.5, 'room', '314');
        g.addNode('door_mid_room_2_3_132', 3, 2, 57.1, -7.2, 'door', 'Дверь 314');
        g.addNode('door_room_room_2_3_132', 3, 2, 57.1, -7.6, 'door', 'Вход 314');
        g.addNode('door_corr_room_2_3_132', 3, 2, 57.1, -6.8, 'door', 'Коридор 314');
        g.addNode('room_2_3_133', 3, 2, 62.6, -10.5, 'room', '315');
        g.addNode('door_mid_room_2_3_133', 3, 2, 62.5, -7.2, 'door', 'Дверь 315');
        g.addNode('door_room_room_2_3_133', 3, 2, 62.5, -7.6, 'door', 'Вход 315');
        g.addNode('door_corr_room_2_3_133', 3, 2, 62.5, -6.8, 'door', 'Коридор 315');
        g.addNode('room_2_3_134', 3, 2, 66.0, -12.5, 'room', 'ЛК№1');
        g.addNode('door_mid_room_2_3_134', 3, 2, 64.2, -5.8, 'door', 'Дверь ЛК№1');
        g.addNode('door_corr_room_2_3_134', 3, 2, 63.8, -5.8, 'door', 'Коридор ЛК№1');
        g.addNode('room_2_3_135', 3, 2, 31.1, -0.5, 'room', '308 Спортивный зал');
        g.addNode('door_mid_room_2_3_135', 3, 2, 36.4, -4.4, 'door', 'Дверь 308');
        g.addNode('door_room_room_2_3_135', 3, 2, 36.4, -4.0, 'door', 'Вход 308');
        g.addNode('door_corr_room_2_3_135', 3, 2, 36.4, -4.8, 'door', 'Коридор 308');
        g.addNode('room_2_3_136', 3, 2, 48.2, -0.5, 'room', '312 Конференц-зал');
        g.addNode('door_mid_room_2_3_136', 3, 2, 47.1, -4.4, 'door', 'Дверь 312');
        g.addNode('door_room_room_2_3_136', 3, 2, 47.1, -4.0, 'door', 'Вход 312');
        g.addNode('door_corr_room_2_3_136', 3, 2, 47.1, -4.8, 'door', 'Коридор 312');
        g.addNode('room_2_3_137', 3, 2, 59.4, -0.5, 'room', '316');
        g.addNode('door_mid_room_2_3_137', 3, 2, 62.4, -4.4, 'door', 'Дверь 316');
        g.addNode('door_room_room_2_3_137', 3, 2, 62.4, -4.0, 'door', 'Вход 316');
        g.addNode('door_corr_room_2_3_137', 3, 2, 62.4, -4.8, 'door', 'Коридор 316');
        g.addNode('room_2_3_138', 3, 2, 65.1, -2.8, 'room', '318');
        g.addNode('door_mid_room_2_3_138', 3, 2, 66.0, -2.6, 'door', 'Дверь 318');
        g.addNode('door_room_room_2_3_138', 3, 2, 65.6, -2.6, 'door', 'Вход 318');
        g.addNode('door_room_4_3_232', 3, 4, 37.5, -35.5, 'door', 'Дверь Второй свет');
        g.addNode('room_4_3_234', 3, 4, 30.1, -48.3, 'room', 'ЛК№2');
        g.addNode('door_corr_room_4_3_234', 3, 4, 38.6, -48.6, 'door', 'Коридор ЛК№2');
        g.addNode('room_4_3_235', 3, 4, 65.2, -47.6, 'room', 'ЛК№3');
        g.addNode('door_mid_room_4_3_235', 3, 4, 61.6, -48.3, 'door', 'Дверь ЛК№3');
        g.addNode('door_room_room_4_3_235', 3, 4, 62.0, -48.3, 'door', 'Вход ЛК№3');
        g.addNode('door_corr_room_4_3_235', 3, 4, 61.2, -48.3, 'door', 'Коридор ЛК№3');
        g.addNode('room_4_3_236', 3, 4, 40.6, -27.8, 'room', 'ЛК№1');
        g.addNode('door_mid_room_4_3_236', 3, 4, 40.6, -31.2, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_4_3_236', 3, 4, 40.6, -30.8, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_4_3_236', 3, 4, 40.6, -31.6, 'door', 'Коридор ЛК№1');
        g.addNode('door_room_room_4_3_237', 3, 4, 38.6, -48.6, 'door', 'Вход 301');
        g.addNode('door_mid_room_4_3_238', 3, 4, 38.2, -44.8, 'door', 'Дверь 302');
        g.addNode('door_room_room_4_3_238', 3, 4, 38.6, -44.8, 'door', 'Вход 302');
        g.addNode('door_mid_room_4_3_239', 3, 4, 38.2, -44.8, 'door', 'Дверь 303');
        g.addNode('door_room_room_4_3_239', 3, 4, 38.6, -44.8, 'door', 'Вход 303');
        g.addNode('room_4_3_241', 3, 4, 46.6, -36.4, 'room', '312');
        g.addNode('door_mid_room_4_3_241', 3, 4, 46.2, -33.2, 'door', 'Дверь 312');
        g.addNode('door_room_room_4_3_241', 3, 4, 46.2, -33.6, 'door', 'Вход 312');
        g.addNode('room_4_3_243', 3, 4, 41.8, -30.2, 'room', '310');
        g.addNode('door_mid_room_4_3_243', 3, 4, 40.6, -31.2, 'door', 'Дверь 310');
        g.addNode('door_room_room_4_3_243', 3, 4, 40.6, -30.8, 'door', 'Вход 310');
        g.addNode('door_corr_room_4_3_243', 3, 4, 40.6, -31.6, 'door', 'Коридор 310');
        g.addNode('door_room_room_4_3_244', 3, 4, 38.6, -40.7, 'door', 'Вход С/у');
        g.addNode('room_4_3_245', 3, 4, 40.7, -38.3, 'room', 'С/у');
        g.addNode('door_mid_room_4_3_245', 3, 4, 38.2, -37.9, 'door', 'Дверь С/у');
        g.addNode('door_room_room_4_3_245', 3, 4, 38.6, -37.9, 'door', 'Вход С/у');
        g.addNode('door_corr_room_4_3_245', 3, 4, 37.8, -37.9, 'door', 'Коридор С/у');
        g.addNode('room_4_3_246', 3, 4, 34.3, -44.3, 'room', '306');
        g.addNode('door_room_room_4_3_246', 3, 4, 35.8, -43.2, 'door', 'Вход 306');
        g.addNode('room_4_3_247', 3, 4, 34.3, -39.5, 'room', '304');
        g.addNode('door_mid_room_4_3_247', 3, 4, 36.2, -38.8, 'door', 'Дверь 304');
        g.addNode('door_room_room_4_3_247', 3, 4, 35.8, -38.8, 'door', 'Вход 304');
        g.addNode('room_4_3_248', 3, 4, 34.3, -34.8, 'room', '308');
        g.addNode('door_mid_room_4_3_248', 3, 4, 36.2, -34.0, 'door', 'Дверь 308');
        g.addNode('door_room_room_4_3_248', 3, 4, 35.8, -34.0, 'door', 'Вход 308');
        g.addNode('door_corr_room_4_3_248', 3, 4, 36.6, -34.0, 'door', 'Коридор 308');
        g.addNode('room_4_3_249', 3, 4, 34.3, -29.9, 'room', '309');
        g.addNode('door_mid_room_4_3_249', 3, 4, 36.2, -31.0, 'door', 'Дверь 309');
        g.addNode('door_room_room_4_3_249', 3, 4, 35.8, -31.0, 'door', 'Вход 309');
        g.addNode('door_corr_room_4_3_249', 3, 4, 36.6, -31.0, 'door', 'Коридор 309');
        g.addNode('custom_b1_f3_c_36_-115_ux1', 3, 1, 3.6, -11.5, 'corridor', 'Коридор (3.6, -11.5)');
        g.addNode('custom_b1_f3_c_35_-74_vve', 3, 1, 3.5, -7.4, 'corridor', 'Коридор (3.5, -7.4)');
        g.addNode('custom_b1_f3_c_-5_-73_y4d', 3, 1, -0.5, -7.3, 'corridor', 'Коридор (-0.5, -7.3)');
        g.addNode('custom_b1_f3_d_79_-70_b05', 3, 1, 7.9, -7.0, 'door', 'Дверь (7.9, -7)');
        g.addNode('door_corr_room_1_3_38', 3, 1, 7.9, -5.8, 'door', 'Коридор 304');
        g.addNode('custom_b4_f3_c_443_-324_ohi', 3, 4, 44.3, -32.4, 'corridor', 'Коридор (44.3, -32.4)');
        g.addNode('custom_b4_f3_c_443_-285_p9p', 3, 4, 44.3, -28.5, 'corridor', 'Коридор (44.3, -28.5)');
        g.addNode('custom_b4_f3_c_467_-285_r9w', 3, 4, 46.7, -28.5, 'corridor', 'Коридор (46.7, -28.5)');
        g.addNode('custom_b4_f3_c_442_-430_43l', 3, 4, 44.2, -43.0, 'corridor', 'Коридор (44.2, -43)');
        g.addNode('custom_b4_f3_c_466_-430_6gw', 3, 4, 46.6, -43.0, 'corridor', 'Коридор (46.6, -43)');
        g.addNode('custom_b4_f3_c_466_-415_85f', 3, 4, 46.6, -41.5, 'corridor', 'Коридор (46.6, -41.5)');
        g.addNode('custom_b4_f3_c_445_-448_u0o', 3, 4, 44.5, -44.8, 'corridor', 'Коридор (44.5, -44.8)');
        g.addNode('custom_b4_f3_c_518_-448_vn9', 3, 4, 51.8, -44.8, 'corridor', 'Коридор (51.8, -44.8)');
        g.addNode('custom_b4_f3_c_408_-407_sy9', 3, 4, 40.8, -40.7, 'corridor', 'Коридор (40.8, -40.7)');
        g.addNode('custom_b4_f3_c_375_-388_7pq', 3, 4, 37.5, -38.8, 'corridor', 'Коридор (37.5, -38.8)');
        g.addNode('custom_b4_f3_c_375_-407_bmq', 3, 4, 37.5, -40.7, 'corridor', 'Коридор (37.5, -40.7)');
        g.addNode('custom_b4_f3_c_375_-431_jvr', 3, 4, 37.5, -43.1, 'corridor', 'Коридор (37.5, -43.1)');
        g.addNode('custom_b4_f3_c_375_-447_r8q', 3, 4, 37.5, -44.7, 'corridor', 'Коридор (37.5, -44.7)');
        g.addNode('custom_b4_f3_c_375_-486_uml', 3, 4, 37.5, -48.6, 'corridor', 'Коридор (37.5, -48.6)');
        g.addNode('custom_b4_f3_c_347_-482_3dk', 3, 4, 34.7, -48.2, 'corridor', 'Коридор (34.7, -48.2)');
        g.addNode('custom_b4_f3_c_481_-486_kaq', 3, 4, 48.1, -48.6, 'corridor', 'Коридор (48.1, -48.6)');
        g.addNode('custom_b4_f3_c_599_-486_mu3', 3, 4, 59.9, -48.6, 'corridor', 'Коридор (59.9, -48.6)');
        g.addNode('custom_b4_f3_c_375_-324_3fq', 3, 4, 37.5, -32.4, 'corridor', 'Коридор (37.5, -32.4)');
        g.addNode('custom_b4_f3_c_375_-341_7df', 3, 4, 37.5, -34.1, 'corridor', 'Коридор (37.5, -34.1)');
        g.addNode('custom_b4_f3_c_461_-324_he8', 3, 4, 46.1, -32.4, 'corridor', 'Коридор (46.1, -32.4)');
        g.addNode('custom_b2_f3_c_670_-58_0u0', 3, 2, 67.0, -5.8, 'corridor', 'Коридор (67, -5.8)');
        g.addNode('custom_b2_f3_c_670_-26_1py', 3, 2, 67.0, -2.6, 'corridor', 'Коридор (67, -2.6)');
        g.addNode('custom_b1_f3_c_96_-47_h5d', 3, 1, 9.6, -4.7, 'corridor', 'Коридор (9.6, -4.7)');
        g.addNode('custom_b4_f3_c_375_-310_hzh', 3, 4, 37.5, -31.0, 'corridor', 'Коридор (37.5, -31)');
        g.addNode('custom_b4_f3_c_406_-324_l99', 3, 4, 40.6, -32.4, 'corridor', 'Коридор (40.6, -32.4)');
        g.addNode('b1_f4_nc_-6.0', 4, 1, -6.0, -5.0, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_nc_door_-5.8', 4, 1, -5.8, -5.0, 'door', 'К1 Эт.4 Дверь север');
        g.addNode('b1_f4_nc_-3.0', 4, 1, -3.0, -5.8, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_nc_0.0', 4, 1, 0.0, -5.8, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_nc_3.0', 4, 1, 3.0, -5.8, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_nc_5.9', 4, 1, 5.9, -5.8, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_nc_9.4', 4, 1, 9.4, -5.8, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_nc_12.5', 4, 1, 12.5, -5.8, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_nc_16.0', 4, 1, 15.6, -5.8, 'corridor', 'К1 Эт.4 Сев. коридор');
        g.addNode('b1_f4_wc_-3.0', 4, 1, -3.0, -3.0, 'corridor', 'К1 Эт.4 Зап. коридор');
        g.addNode('b1_f4_wc_0.0', 4, 1, -3.0, 0.0, 'corridor', 'К1 Эт.4 Зап. коридор');
        g.addNode('b1_f4_wc_1.7', 4, 1, -3.0, 1.7, 'corridor', 'К1 Эт.4 Зап. коридор');
        g.addNode('b1_f4_wc_3.5', 4, 1, -3.0, 3.5, 'corridor', 'К1 Эт.4 Зап. коридор');
        g.addNode('b1_f4_wc_6.0', 4, 1, -3.0, 6.0, 'corridor', 'К1 Эт.4 Зап. коридор');
        g.addNode('b1_f4_sc_0.0', 4, 1, 0.0, 6.0, 'corridor', 'К1 Эт.4 Юж. коридор');
        g.addNode('b1_f4_sc_1.8', 4, 1, 1.8, 6.0, 'corridor', 'К1 Эт.4 Юж. коридор');
        g.addNode('b1_f4_sc_3.5', 4, 1, 3.5, 6.0, 'corridor', 'К1 Эт.4 Юж. коридор');
        g.addNode('b1_f4_sc_5.6', 4, 1, 5.6, 6.0, 'corridor', 'К1 Эт.4 Юж. коридор');
        g.addNode('b1_f4_sc_9.4', 4, 1, 9.4, 6.0, 'corridor', 'К1 Эт.4 Юж. коридор');
        g.addNode('b1_f4_sc_10.5', 4, 1, 10.5, 6.0, 'corridor', 'К1 Эт.4 Юж. коридор');
        g.addNode('b1_f4_stair_lk1', 4, 1, 9.4, -1.9, 'stair', 'К1 ЛК№1 (Эт.4)');
        g.addNode('b1_f4_stair_lk2', 4, 1, 9.4, 1.9, 'stair', 'К1 ЛК№2 (Эт.4)');
        g.addNode('b1_f4_elev', 4, 1, 1.8, 1.5, 'elevator', 'К1 Лифты (Эт.4)');
        g.addNode('room_1_4_44', 4, 1, 6.2, -2.8, 'room', 'С/У');
        g.addNode('door_mid_room_1_4_44', 4, 1, 5.4, -4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_4_44', 4, 1, 5.4, -3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_4_44', 4, 1, 5.4, -4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_4_45', 4, 1, 5.6, 1.3, 'room', 'С/У');
        g.addNode('door_mid_room_1_4_45', 4, 1, 5.5, 4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_4_45', 4, 1, 5.5, 3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_4_45', 4, 1, 5.5, 4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_4_46', 4, 1, 9.4, -1.9, 'room', 'ЛК№1');
        g.addNode('door_mid_room_1_4_46', 4, 1, 9.4, -3.8, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_1_4_46', 4, 1, 9.4, -3.4, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_1_4_46', 4, 1, 9.4, -4.2, 'door', 'Коридор ЛК№1');
        g.addNode('room_1_4_47', 4, 1, 9.4, 1.9, 'room', 'ЛК№2');
        g.addNode('door_mid_room_1_4_47', 4, 1, 9.4, 3.8, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_1_4_47', 4, 1, 9.4, 3.4, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_1_4_47', 4, 1, 9.4, 4.2, 'door', 'Коридор ЛК№2');
        g.addNode('room_1_4_48', 4, 1, 1.8, 1.5, 'room', 'Лифтовой холл');
        g.addNode('door_mid_room_1_4_48', 4, 1, -1.2, 1.7, 'door', 'Дверь Лифтовой холл');
        g.addNode('door_room_room_1_4_48', 4, 1, -0.8, 1.7, 'door', 'Вход Лифтовой холл');
        g.addNode('door_corr_room_1_4_48', 4, 1, -1.6, 1.7, 'door', 'Коридор Лифтовой холл');
        g.addNode('room_1_4_49', 4, 1, -4.2, -10.2, 'room', '403');
        g.addNode('door_mid_room_1_4_49', 4, 1, -0.4, -6.2, 'door', 'Дверь 403');
        g.addNode('door_room_room_1_4_49', 4, 1, -0.4, -6.6, 'door', 'Вход 403');
        g.addNode('door_corr_room_1_4_49', 4, 1, -0.4, -5.8, 'door', 'Коридор 403');
        g.addNode('room_1_4_50', 4, 1, 3.5, -11.4, 'room', '403А');
        g.addNode('door_mid_room_1_4_50', 4, 1, 3.5, -8.6, 'door', 'Дверь 403А');
        g.addNode('door_room_room_1_4_50', 4, 1, 3.5, -9.0, 'door', 'Вход 403А');
        g.addNode('door_corr_room_1_4_50', 4, 1, 3.5, -8.2, 'door', 'Коридор 403А');
        g.addNode('door_mid_room_1_4_51', 4, 1, 7.9, -6.2, 'door', 'Дверь 404');
        g.addNode('door_corr_room_1_4_51', 4, 1, 7.9, -5.8, 'door', 'Коридор 404');
        g.addNode('room_1_4_52', 4, 1, -9.9, -2.3, 'room', '402А');
        g.addNode('door_mid_room_1_4_52', 4, 1, -5.8, -2.2, 'door', 'Дверь 402А');
        g.addNode('door_room_room_1_4_52', 4, 1, -6.2, -2.2, 'door', 'Вход 402А');
        g.addNode('door_corr_room_1_4_52', 4, 1, -5.4, -2.2, 'door', 'Коридор 402А');
        g.addNode('room_1_4_53', 4, 1, -9.9, 1.3, 'room', '401А');
        g.addNode('door_mid_room_1_4_53', 4, 1, -5.8, 1.4, 'door', 'Дверь 401А');
        g.addNode('door_room_room_1_4_53', 4, 1, -6.2, 1.4, 'door', 'Вход 401А');
        g.addNode('door_corr_room_1_4_53', 4, 1, -5.4, 1.4, 'door', 'Коридор 401А');
        g.addNode('room_1_4_54', 4, 1, -9.9, 8.5, 'room', '402');
        g.addNode('door_mid_room_1_4_54', 4, 1, -5.8, 5.6, 'door', 'Дверь 402');
        g.addNode('door_room_room_1_4_54', 4, 1, -6.2, 5.6, 'door', 'Вход 402');
        g.addNode('door_corr_room_1_4_54', 4, 1, -5.4, 5.6, 'door', 'Коридор 402');
        g.addNode('room_1_4_55', 4, 1, 3.4, 10.6, 'room', '401');
        g.addNode('door_mid_room_1_4_55', 4, 1, -4.4, 7.2, 'door', 'Дверь 401');
        g.addNode('door_room_room_1_4_55', 4, 1, -4.4, 7.6, 'door', 'Вход 401');
        g.addNode('door_corr_room_1_4_55', 4, 1, -4.4, 6.8, 'door', 'Коридор 401');
        g.addNode('custom_b1_f4_c_-4_-75_ptb', 4, 1, -0.4, -7.5, 'corridor', 'Коридор (-0.4, -7.5)');
        g.addNode('custom_b1_f4_c_33_-75_ydr', 4, 1, 3.3, -7.5, 'corridor', 'Коридор (3.3, -7.5)');
        g.addNode('custom_b1_f4_c_79_-75_z02', 4, 1, 7.9, -7.5, 'corridor', 'Коридор (7.9, -7.5)');
        g.addNode('room_1_4_51', 4, 1, 10.6, -10.2, 'room', '404');
        g.addNode('custom_b1_f4_c_33_-111_dfg', 4, 1, 3.3, -11.1, 'corridor', 'Коридор (3.3, -11.1)');
        g.addNode('b1_f2_nc_-3.0', 2, 1, -3.0, -5.8, 'corridor', 'К1 Эт.2 Сев. коридор');
        g.addNode('b1_f2_nc_0.0', 2, 1, 0.0, -5.8, 'corridor', 'К1 Эт.2 Сев. коридор');
        g.addNode('b1_f2_nc_3.0', 2, 1, 3.0, -5.8, 'corridor', 'К1 Эт.2 Сев. коридор');
        g.addNode('b1_f2_wc_-3.0', 2, 1, -3.0, -3.0, 'corridor', 'К1 Эт.2 Зап. коридор');
        g.addNode('b1_f2_wc_0.0', 2, 1, -3.0, 0.0, 'corridor', 'К1 Эт.2 Зап. коридор');
        g.addNode('b1_f2_wc_1.7', 2, 1, -3.0, 1.7, 'corridor', 'К1 Эт.2 Зап. коридор');
        g.addNode('b1_f2_wc_3.5', 2, 1, -3.0, 3.5, 'corridor', 'К1 Эт.2 Зап. коридор');
        g.addNode('b1_f2_wc_6.0', 2, 1, -3.0, 6.0, 'corridor', 'К1 Эт.2 Зап. коридор');
        g.addNode('b1_f2_sc_0.0', 2, 1, 0.0, 6.0, 'corridor', 'К1 Эт.2 Юж. коридор');
        g.addNode('b1_f2_sc_1.8', 2, 1, 1.8, 6.0, 'corridor', 'К1 Эт.2 Юж. коридор');
        g.addNode('b1_f2_sc_3.5', 2, 1, 3.5, 6.0, 'corridor', 'К1 Эт.2 Юж. коридор');
        g.addNode('b1_f2_sc_5.6', 2, 1, 5.6, 6.0, 'corridor', 'К1 Эт.2 Юж. коридор');
        g.addNode('b1_f2_sc_9.4', 2, 1, 9.4, 6.0, 'corridor', 'К1 Эт.2 Юж. коридор');
        g.addNode('b1_f2_sc_10.5', 2, 1, 10.5, 6.0, 'corridor', 'К1 Эт.2 Юж. коридор');
        g.addNode('b1_f2_stair_lk1', 2, 1, 9.4, -1.9, 'stair', 'К1 ЛК№1 (Эт.2)');
        g.addNode('b1_f2_stair_lk2', 2, 1, 9.4, 1.9, 'stair', 'К1 ЛК№2 (Эт.2)');
        g.addNode('b1_f2_elev', 2, 1, 1.8, 1.5, 'elevator', 'К1 Лифты (Эт.2)');
        g.addNode('b1_f2_room_206_corr_door', 2, 1, -5.8, 1.1, 'door', 'Дверь блока 206');
        g.addNode('b1_f2_room_206_ante', 2, 1, -7.0, 1.4, 'corridor', 'Предбанник 206');
        g.addNode('b1_f2_room_206_inner_door', 2, 1, -8.2, 1.5, 'door', 'Вход в каб. 206');
        g.addNode('b2_f2_c_20.4', 2, 2, 20.4, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_37.5', 2, 2, 37.5, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_43.6', 2, 2, 43.6, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_47.0', 2, 2, 47.0, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_51.0', 2, 2, 51.0, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_55.0', 2, 2, 55.0, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_59.0', 2, 2, 59.0, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_63.0', 2, 2, 63.0, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_c_66.1', 2, 2, 66.1, -5.8, 'corridor', 'К2 Эт.2 Коридор');
        g.addNode('b2_f2_stair_lk1', 2, 2, 66.1, -10.5, 'stair', 'К2 ЛК№1 (Эт.2)');
        g.addNode('b2_f2_stair_lk2', 2, 2, 42.7, -10.5, 'stair', 'К2 ЛК№2 (Эт.2)');
        g.addNode('b2_f2_stair_lk3', 2, 2, 22.6, -10.5, 'stair', 'К2 ЛК№3 (Эт.2)');
        g.addNode('b3_f2_c_-14.0', 2, 3, 5.9, -14.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-18.0', 2, 3, 5.9, -18.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-26.0', 2, 3, 5.9, -26.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-28.6', 2, 3, 5.9, -28.6, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-36.0', 2, 3, 5.9, -36.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-40.0', 2, 3, 5.9, -40.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-45.5', 2, 3, 5.9, -45.5, 'corridor', 'К3 Эт.2 Переход К4');
        g.addNode('b3_f2_c_-46.0', 2, 3, 5.9, -46.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-50.0', 2, 3, 5.9, -50.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_c_-55.0', 2, 3, 5.9, -55.0, 'corridor', 'К3 Эт.2 Коридор');
        g.addNode('b3_f2_stair_south', 2, 3, 4.1, -28.6, 'stair', 'К3 Южная ЛК (Эт.2)');
        g.addNode('b3_f2_stair_north', 2, 3, 4.1, -46.0, 'stair', 'К3 Северная ЛК (Эт.2)');
        g.addNode('b4_f2_stair_lk1', 2, 4, 40.6, -27.8, 'stair', 'К4 ЛК№1 (Эт.2)');
        g.addNode('b4_f2_stair_lk1_door', 2, 4, 40.6, -31.2, 'door', 'К4 Дверь ЛК№1 (Эт.2)');
        g.addNode('b4_f2_stair_lk2', 2, 4, 30.1, -48.3, 'stair', 'К4 ЛК№2 (Эт.2)');
        g.addNode('b4_f2_stair_lk2_door', 2, 4, 32.4, -48.3, 'door', 'К4 Дверь ЛК№2 (Эт.2)');
        g.addNode('b4_f2_stair_lk3', 2, 4, 65.2, -47.6, 'stair', 'К4 ЛК№3 (Эт.2)');
        g.addNode('b4_f2_sw_-44.5', 2, 4, 37.5, -44.5, 'corridor', 'К4 Эт.2 Юж. коридор');
        g.addNode('b4_f2_sw_-43.0', 2, 4, 37.5, -43.0, 'corridor', 'К4 Эт.2 Юж. коридор');
        g.addNode('b4_f2_sw_-27.4', 2, 4, 37.5, -27.4, 'corridor', 'К4 Эт.2 Юж. коридор');
        g.addNode('b4_f2_c_37.5', 2, 4, 37.5, -44.5, 'corridor', 'К4 Эт.2 Коридор');
        g.addNode('b4_f2_c_41.0', 2, 4, 41.0, -44.5, 'corridor', 'К4 Эт.2 Коридор');
        g.addNode('b4_f2_c_45.0', 2, 4, 45.0, -44.5, 'corridor', 'К4 Эт.2 Коридор');
        g.addNode('b4_f2_c_49.0', 2, 4, 49.0, -44.5, 'corridor', 'К4 Эт.2 Коридор');
        g.addNode('b4_f2_c_53.0', 2, 4, 53.0, -44.5, 'corridor', 'К4 Эт.2 Коридор');
        g.addNode('b4_f2_c_57.0', 2, 4, 57.0, -44.5, 'corridor', 'К4 Эт.2 Коридор');
        g.addNode('bridge_k1_k3_f2', 2, 1, 5.9, -14.0, 'bridge', 'Переход К1 ↔ К3 (2 эт.)');
        g.addNode('bridge_k3_k4_f2', 2, 4, 23.2, -45.5, 'bridge', 'Переход К3 ↔ К4 (2 эт.)');
        g.addNode('b4_f2_bridge_k3_door', 2, 4, 32.4, -45.5, 'door', 'Дверь Перехода К3 ↔ К4');
        g.addNode('room_1_2_12', 2, 1, 6.2, -2.8, 'room', 'С/У');
        g.addNode('door_mid_room_1_2_12', 2, 1, 5.4, -4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_2_12', 2, 1, 5.4, -3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_2_12', 2, 1, 5.4, -4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_2_13', 2, 1, 5.6, 1.3, 'room', 'С/У');
        g.addNode('door_mid_room_1_2_13', 2, 1, 5.5, 4.0, 'door', 'Дверь С/У');
        g.addNode('door_room_room_1_2_13', 2, 1, 5.5, 3.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_1_2_13', 2, 1, 5.5, 4.4, 'door', 'Коридор С/У');
        g.addNode('room_1_2_14', 2, 1, 9.4, -1.9, 'room', 'ЛК№1');
        g.addNode('door_mid_room_1_2_14', 2, 1, 9.4, -3.8, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_1_2_14', 2, 1, 9.4, -3.4, 'door', 'Вход ЛК№1');
        g.addNode('room_1_2_15', 2, 1, 9.4, 1.9, 'room', 'ЛК№2');
        g.addNode('door_mid_room_1_2_15', 2, 1, 9.4, 3.8, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_1_2_15', 2, 1, 9.4, 3.4, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_1_2_15', 2, 1, 9.4, 4.2, 'door', 'Коридор ЛК№2');
        g.addNode('room_1_2_16', 2, 1, 1.8, 1.5, 'room', 'Лифтовой холл');
        g.addNode('room_1_2_17', 2, 1, -5.2, -10.2, 'room', '208');
        g.addNode('room_1_2_18', 2, 1, 2.1, -12.7, 'room', '210');
        g.addNode('door_mid_room_1_2_18', 2, 1, 4.6, -12.5, 'door', 'Дверь 210');
        g.addNode('door_room_room_1_2_18', 2, 1, 4.2, -12.5, 'door', 'Вход 210');
        g.addNode('door_corr_room_1_2_18', 2, 1, 5.0, -12.5, 'door', 'Коридор 210');
        g.addNode('door_mid_room_1_2_19', 2, 1, 4.6, -7.6, 'door', 'Дверь 209');
        g.addNode('door_room_room_1_2_19', 2, 1, 4.2, -7.6, 'door', 'Вход 209');
        g.addNode('door_corr_room_1_2_19', 2, 1, 5.0, -7.6, 'door', 'Коридор 209');
        g.addNode('room_1_2_19', 2, 1, 1.8, -10.0, 'room', '209');
        g.addNode('room_1_2_20', 2, 1, 11.6, -11.7, 'room', '211');
        g.addNode('door_mid_room_1_2_20', 2, 1, 7.2, -12.5, 'door', 'Дверь 211');
        g.addNode('door_room_room_1_2_20', 2, 1, 7.6, -12.5, 'door', 'Вход 211');
        g.addNode('door_corr_room_1_2_20', 2, 1, 6.8, -12.5, 'door', 'Коридор 211');
        g.addNode('room_1_2_21', 2, 1, 9.7, -7.8, 'room', '212');
        g.addNode('door_corr_room_1_2_21', 2, 1, 5.9, -5.8, 'door', 'Коридор 212');
        g.addNode('room_1_2_22', 2, 1, 14.1, -7.8, 'room', '213');
        g.addNode('door_mid_room_1_2_22', 2, 1, 13.6, -6.2, 'door', 'Дверь 213');
        g.addNode('door_room_room_1_2_22', 2, 1, 13.6, -6.6, 'door', 'Вход 213');
        g.addNode('door_corr_room_1_2_22', 2, 1, 13.6, -5.8, 'door', 'Коридор 213');
        g.addNode('door_mid_room_1_2_23', 2, 1, 9.4, -3.8, 'door', 'Дверь Переход в корпус №2');
        g.addNode('door_corr_room_1_2_23', 2, 1, 9.4, -3.4, 'door', 'Коридор Переход в корпус №2');
        g.addNode('door_mid_room_1_2_24', 2, 1, -5.8, -1.4, 'door', 'Дверь 207');
        g.addNode('door_room_room_1_2_24', 2, 1, -6.2, -1.4, 'door', 'Вход 207');
        g.addNode('door_corr_room_1_2_24', 2, 1, -5.4, -1.4, 'door', 'Коридор 207');
        g.addNode('room_1_2_24', 2, 1, -11.2, -2.2, 'room', '207');
        g.addNode('room_1_2_25', 2, 1, -11.2, 1.4, 'room', '206');
        g.addNode('room_1_2_26', 2, 1, -10.2, 5.2, 'room', '204');
        g.addNode('door_room_room_1_2_26', 2, 1, -10.2, 3.6, 'door', 'Вход 204');
        g.addNode('room_1_2_27', 2, 1, -8.0, 12.2, 'room', '205');
        g.addNode('door_mid_room_1_2_27', 2, 1, -5.8, 5.1, 'door', 'Дверь 205');
        g.addNode('door_room_room_1_2_27', 2, 1, -6.2, 5.1, 'door', 'Вход 205');
        g.addNode('door_corr_room_1_2_27', 2, 1, -5.4, 5.1, 'door', 'Коридор 205');
        g.addNode('room_1_2_28', 2, 1, -4.2, 11.5, 'room', '203');
        g.addNode('door_mid_room_1_2_28', 2, 1, -4.0, 7.2, 'door', 'Дверь 203');
        g.addNode('door_room_room_1_2_28', 2, 1, -4.0, 7.6, 'door', 'Вход 203');
        g.addNode('door_corr_room_1_2_28', 2, 1, -4.0, 6.8, 'door', 'Коридор 203');
        g.addNode('door_mid_room_1_2_29', 2, 1, -1.4, 7.2, 'door', 'Дверь 202');
        g.addNode('door_room_room_1_2_29', 2, 1, -1.4, 7.6, 'door', 'Вход 202');
        g.addNode('door_corr_room_1_2_29', 2, 1, -1.4, 6.8, 'door', 'Коридор 202');
        g.addNode('room_1_2_29', 2, 1, -0.6, 11.8, 'room', '202');
        g.addNode('room_1_2_30', 2, 1, 8.5, 11.5, 'room', '201');
        g.addNode('door_mid_room_1_2_30', 2, 1, 9.8, 7.2, 'door', 'Дверь 201');
        g.addNode('door_room_room_1_2_30', 2, 1, 9.8, 7.6, 'door', 'Вход 201');
        g.addNode('door_corr_room_1_2_30', 2, 1, 9.8, 6.8, 'door', 'Коридор 201');
        g.addNode('door_corr_b1_f2_r201_west', 2, 1, 5.1, 6.8, 'door', 'Коридор 201 (зап.)');
        g.addNode('door_mid_b1_f2_r201_west', 2, 1, 5.1, 7.2, 'door', 'Дверь 201 (зап.)');
        g.addNode('door_room_b1_f2_r201_west', 2, 1, 5.1, 7.6, 'door', 'Вход 201 (зап.)');
        g.addNode('room_2_2_107', 2, 2, 24.9, -10.5, 'room', '203');
        g.addNode('door_mid_room_2_2_107', 2, 2, 23.4, -8.8, 'door', 'Дверь 203');
        g.addNode('door_room_room_2_2_107', 2, 2, 23.8, -8.8, 'door', 'Вход 203');
        g.addNode('door_corr_room_2_2_107', 2, 2, 23.0, -8.8, 'door', 'Коридор 203');
        g.addNode('room_2_2_108', 2, 2, 31.3, -10.5, 'room', '205');
        g.addNode('door_mid_room_2_2_108', 2, 2, 32.9, -7.2, 'door', 'Дверь 205');
        g.addNode('door_room_room_2_2_108', 2, 2, 32.9, -7.6, 'door', 'Вход 205');
        g.addNode('door_corr_room_2_2_108', 2, 2, 32.9, -6.8, 'door', 'Коридор 205');
        g.addNode('room_2_2_109', 2, 2, 39.5, -8.4, 'room', 'С/У');
        g.addNode('door_mid_room_2_2_109', 2, 2, 39.6, -7.2, 'door', 'Дверь С/У');
        g.addNode('door_room_room_2_2_109', 2, 2, 39.6, -7.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_2_2_109', 2, 2, 39.6, -6.8, 'door', 'Коридор С/У');
        g.addNode('room_2_2_110', 2, 2, 41.0, -8.4, 'room', 'С/У');
        g.addNode('door_mid_room_2_2_110', 2, 2, 41.0, -7.2, 'door', 'Дверь С/У');
        g.addNode('door_room_room_2_2_110', 2, 2, 41.0, -7.6, 'door', 'Вход С/У');
        g.addNode('door_corr_room_2_2_110', 2, 2, 41.0, -6.8, 'door', 'Коридор С/У');
        g.addNode('room_2_2_111', 2, 2, 44.5, -12.5, 'room', 'ЛК№2');
        g.addNode('door_mid_room_2_2_111', 2, 2, 44.5, -7.2, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_2_2_111', 2, 2, 44.5, -7.6, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_2_2_111', 2, 2, 44.5, -6.8, 'door', 'Коридор ЛК№2');
        g.addNode('room_2_2_112', 2, 2, 46.9, -10.5, 'room', '209');
        g.addNode('door_mid_room_2_2_112', 2, 2, 46.9, -7.2, 'door', 'Дверь 209');
        g.addNode('door_room_room_2_2_112', 2, 2, 46.9, -7.6, 'door', 'Вход 209');
        g.addNode('door_corr_room_2_2_112', 2, 2, 46.9, -6.8, 'door', 'Коридор 209');
        g.addNode('room_2_2_113', 2, 2, 54.5, -10.5, 'room', '211');
        g.addNode('door_mid_room_2_2_113', 2, 2, 58.5, -7.2, 'door', 'Дверь 211');
        g.addNode('door_room_room_2_2_113', 2, 2, 58.5, -7.6, 'door', 'Вход 211');
        g.addNode('door_corr_room_2_2_113', 2, 2, 58.5, -6.8, 'door', 'Коридор 211');
        g.addNode('room_2_2_114', 2, 2, 62.4, -8.4, 'room', '213');
        g.addNode('door_mid_room_2_2_114', 2, 2, 62.4, -7.2, 'door', 'Дверь 213');
        g.addNode('door_room_room_2_2_114', 2, 2, 62.4, -7.6, 'door', 'Вход 213');
        g.addNode('door_corr_room_2_2_114', 2, 2, 62.4, -6.8, 'door', 'Коридор 213');
        g.addNode('room_2_2_115', 2, 2, 66.0, -12.5, 'room', 'ЛК№1');
        g.addNode('door_room_2_2_115', 2, 2, 66.0, -7.2, 'door', 'Дверь ЛК№1');
        g.addNode('room_2_2_116', 2, 2, 21.9, -0.5, 'room', '202');
        g.addNode('door_mid_room_2_2_116', 2, 2, 21.9, -4.4, 'door', 'Дверь 202');
        g.addNode('door_room_room_2_2_116', 2, 2, 21.9, -4.0, 'door', 'Вход 202');
        g.addNode('door_corr_room_2_2_116', 2, 2, 21.9, -4.8, 'door', 'Коридор 202');
        g.addNode('room_2_2_117', 2, 2, 24.9, -0.5, 'room', '204');
        g.addNode('door_mid_room_2_2_117', 2, 2, 24.9, -4.4, 'door', 'Дверь 204');
        g.addNode('door_room_room_2_2_117', 2, 2, 24.9, -4.0, 'door', 'Вход 204');
        g.addNode('door_corr_room_2_2_117', 2, 2, 24.9, -4.8, 'door', 'Коридор 204');
        g.addNode('room_2_2_118', 2, 2, 32.6, -0.5, 'room', '206');
        g.addNode('door_mid_room_2_2_118', 2, 2, 28.1, -4.4, 'door', 'Дверь 206');
        g.addNode('door_room_room_2_2_118', 2, 2, 28.1, -4.0, 'door', 'Вход 206');
        g.addNode('door_corr_room_2_2_118', 2, 2, 28.1, -4.8, 'door', 'Коридор 206');
        g.addNode('room_2_2_119', 2, 2, 40.3, -0.5, 'room', '208');
        g.addNode('door_mid_room_2_2_119', 2, 2, 40.2, -4.4, 'door', 'Дверь 208');
        g.addNode('door_room_room_2_2_119', 2, 2, 40.2, -4.0, 'door', 'Вход 208');
        g.addNode('door_corr_room_2_2_119', 2, 2, 40.2, -4.8, 'door', 'Коридор 208');
        g.addNode('room_2_2_120', 2, 2, 46.6, -0.5, 'room', '210');
        g.addNode('door_mid_room_2_2_120', 2, 2, 46.4, -4.4, 'door', 'Дверь 210');
        g.addNode('door_room_room_2_2_120', 2, 2, 46.4, -4.0, 'door', 'Вход 210');
        g.addNode('door_corr_room_2_2_120', 2, 2, 46.4, -4.8, 'door', 'Коридор 210');
        g.addNode('room_2_2_121', 2, 2, 53.0, -0.5, 'room', '212');
        g.addNode('door_mid_room_2_2_121', 2, 2, 49.9, -4.4, 'door', 'Дверь 212');
        g.addNode('door_room_room_2_2_121', 2, 2, 49.9, -4.0, 'door', 'Вход 212');
        g.addNode('door_corr_room_2_2_121', 2, 2, 49.9, -4.8, 'door', 'Коридор 212');
        g.addNode('room_2_2_122', 2, 2, 62.7, -0.5, 'room', '214');
        g.addNode('door_mid_room_2_2_122', 2, 2, 62.5, -4.4, 'door', 'Дверь 214');
        g.addNode('door_room_room_2_2_122', 2, 2, 62.5, -4.0, 'door', 'Вход 214');
        g.addNode('door_corr_room_2_2_122', 2, 2, 62.5, -4.8, 'door', 'Коридор 214');
        g.addNode('room_3_2_161', 2, 3, 1.5, -19.8, 'room', '201');
        g.addNode('door_mid_room_3_2_161', 2, 3, 4.6, -23.0, 'door', 'Дверь 201');
        g.addNode('door_room_room_3_2_161', 2, 3, 4.2, -23.0, 'door', 'Вход 201');
        g.addNode('door_corr_room_3_2_161', 2, 3, 5.0, -23.0, 'door', 'Коридор 201');
        g.addNode('room_3_2_162', 2, 3, 1.5, -25.6, 'room', '201А');
        g.addNode('door_mid_room_3_2_162', 2, 3, 4.6, -25.6, 'door', 'Дверь 201А');
        g.addNode('door_room_room_3_2_162', 2, 3, 4.2, -25.6, 'door', 'Вход 201А');
        g.addNode('door_corr_room_3_2_162', 2, 3, 5.0, -25.6, 'door', 'Коридор 201А');
        g.addNode('room_3_2_163', 2, 3, 4.1, -28.6, 'room', 'ЛК№1');
        g.addNode('door_mid_room_3_2_163', 2, 3, 4.6, -28.6, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_3_2_163', 2, 3, 4.3, -28.6, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_3_2_163', 2, 3, 4.9, -28.6, 'door', 'Коридор ЛК№1');
        g.addNode('room_3_2_164', 2, 3, 1.5, -36.1, 'room', '205');
        g.addNode('door_mid_room_3_2_164', 2, 3, 4.6, -31.8, 'door', 'Дверь 205');
        g.addNode('door_room_room_3_2_164', 2, 3, 4.2, -31.8, 'door', 'Вход 205');
        g.addNode('door_corr_room_3_2_164', 2, 3, 5.0, -31.8, 'door', 'Коридор 205');
        g.addNode('room_3_2_165', 2, 3, 1.5, -43.0, 'room', '205А');
        g.addNode('door_mid_room_3_2_165', 2, 3, 3.4, -41.8, 'door', 'Дверь 205А');
        g.addNode('door_room_room_3_2_165', 2, 3, 3.4, -42.2, 'door', 'Вход 205А');
        g.addNode('door_corr_room_3_2_165', 2, 3, 3.4, -41.4, 'door', 'Коридор 205А');
        g.addNode('room_3_2_166', 2, 3, 4.1, -46.0, 'room', 'ЛК№2');
        g.addNode('room_3_2_167', 2, 3, 1.5, -50.0, 'room', '207');
        g.addNode('door_mid_room_3_2_167', 2, 3, 4.6, -50.0, 'door', 'Дверь 207');
        g.addNode('door_room_room_3_2_167', 2, 3, 4.2, -50.0, 'door', 'Вход 207');
        g.addNode('door_corr_room_3_2_167', 2, 3, 5.0, -50.0, 'door', 'Коридор 207');
        g.addNode('room_3_2_168', 2, 3, 1.4, -55.5, 'room', '209');
        g.addNode('door_mid_room_3_2_168', 2, 3, 4.3, -53.2, 'door', 'Дверь 209');
        g.addNode('door_room_room_3_2_168', 2, 3, 3.9, -53.2, 'door', 'Вход 209');
        g.addNode('door_corr_room_3_2_168', 2, 3, 4.7, -53.2, 'door', 'Коридор 209');
        g.addNode('room_3_2_169', 2, 3, 1.4, -60.2, 'room', '209А');
        g.addNode('door_room_room_3_2_169', 2, 3, 3.9, -59.8, 'door', 'Вход 209А');
        g.addNode('room_3_2_170', 2, 3, 10.6, -19.8, 'room', '202');
        g.addNode('door_mid_room_3_2_170', 2, 3, 7.2, -23.2, 'door', 'Дверь 202');
        g.addNode('door_room_room_3_2_170', 2, 3, 7.6, -23.2, 'door', 'Вход 202');
        g.addNode('door_corr_room_3_2_170', 2, 3, 6.8, -23.2, 'door', 'Коридор 202');
        g.addNode('room_3_2_171', 2, 3, 10.6, -25.6, 'room', '202А');
        g.addNode('door_mid_room_3_2_171', 2, 3, 7.2, -25.6, 'door', 'Дверь 202А');
        g.addNode('door_room_room_3_2_171', 2, 3, 7.6, -25.6, 'door', 'Вход 202А');
        g.addNode('door_corr_room_3_2_171', 2, 3, 6.8, -25.6, 'door', 'Коридор 202А');
        g.addNode('room_3_2_172', 2, 3, 10.6, -28.0, 'room', '204');
        g.addNode('door_mid_room_3_2_172', 2, 3, 7.2, -28.2, 'door', 'Дверь 204');
        g.addNode('door_room_room_3_2_172', 2, 3, 7.6, -28.2, 'door', 'Вход 204');
        g.addNode('door_corr_room_3_2_172', 2, 3, 6.8, -28.2, 'door', 'Коридор 204');
        g.addNode('room_3_2_173', 2, 3, 10.6, -30.5, 'room', '206');
        g.addNode('door_mid_room_3_2_173', 2, 3, 7.2, -30.6, 'door', 'Дверь 206');
        g.addNode('door_room_room_3_2_173', 2, 3, 7.6, -30.6, 'door', 'Вход 206');
        g.addNode('door_corr_room_3_2_173', 2, 3, 6.8, -30.6, 'door', 'Коридор 206');
        g.addNode('room_3_2_174', 2, 3, 10.6, -36.8, 'room', '208');
        g.addNode('door_mid_room_3_2_174', 2, 3, 7.2, -40.0, 'door', 'Дверь 208');
        g.addNode('door_room_room_3_2_174', 2, 3, 7.6, -40.0, 'door', 'Вход 208');
        g.addNode('door_corr_room_3_2_174', 2, 3, 6.8, -40.0, 'door', 'Коридор 208');
        g.addNode('room_3_2_175', 2, 3, 10.6, -43.0, 'room', '208А');
        g.addNode('door_mid_room_3_2_175', 2, 3, 8.4, -41.8, 'door', 'Дверь 208А');
        g.addNode('door_room_room_3_2_175', 2, 3, 8.4, -42.2, 'door', 'Вход 208А');
        g.addNode('room_3_2_176', 2, 3, 10.6, -49.1, 'room', '210');
        g.addNode('door_mid_room_3_2_176', 2, 3, 7.2, -50.0, 'door', 'Дверь 210');
        g.addNode('door_room_room_3_2_176', 2, 3, 7.6, -50.0, 'door', 'Вход 210');
        g.addNode('door_corr_room_3_2_176', 2, 3, 6.8, -50.0, 'door', 'Коридор 210');
        g.addNode('room_3_2_177', 2, 3, 10.6, -52.6, 'room', '212А');
        g.addNode('door_mid_room_3_2_177', 2, 3, 8.4, -53.8, 'door', 'Дверь 212А');
        g.addNode('door_room_room_3_2_177', 2, 3, 8.4, -53.4, 'door', 'Вход 212А');
        g.addNode('door_corr_room_3_2_177', 2, 3, 8.4, -54.2, 'door', 'Коридор 212А');
        g.addNode('room_3_2_178', 2, 3, 10.6, -57.7, 'room', '212');
        g.addNode('door_mid_room_3_2_178', 2, 3, 7.2, -55.0, 'door', 'Дверь 212');
        g.addNode('door_room_room_3_2_178', 2, 3, 7.6, -55.0, 'door', 'Вход 212');
        g.addNode('door_corr_room_3_2_178', 2, 3, 6.8, -55.0, 'door', 'Коридор 212');
        g.addNode('room_4_2_211', 2, 4, 49.2, -55.7, 'room', 'Спортивный зал');
        g.addNode('door_mid_room_4_2_211', 2, 4, 62.4, -49.8, 'door', 'Дверь Спортивный зал');
        g.addNode('door_room_room_4_2_211', 2, 4, 62.4, -50.2, 'door', 'Вход Спортивный зал');
        g.addNode('door_corr_room_4_2_211', 2, 4, 62.4, -49.4, 'door', 'Коридор Спортивный зал');
        g.addNode('room_4_2_212', 2, 4, 30.1, -48.3, 'room', 'ЛК№2');
        g.addNode('door_mid_room_4_2_212', 2, 4, 31.4, -46.8, 'door', 'Дверь ЛК№2');
        g.addNode('room_4_2_213', 2, 4, 24.0, -45.5, 'room', 'Переход К3 ↔ К4');
        g.addNode('door_mid_room_4_2_213', 2, 4, 31.4, -46.8, 'door', 'Дверь Переход К3 ↔ К4');
        g.addNode('room_4_2_214', 2, 4, 37.5, -20.6, 'room', 'Переход К4 ↔ К2');
        g.addNode('door_mid_room_4_2_214', 2, 4, 36.2, -29.4, 'door', 'Дверь Переход К4 ↔ К2');
        g.addNode('door_corr_room_4_2_214', 2, 4, 35.8, -29.4, 'door', 'Коридор Переход К4 ↔ К2');
        g.addNode('door_room_4_2_215', 2, 4, 42.0, -44.5, 'door', 'Дверь С/У');
        g.addNode('room_4_2_218', 2, 4, 51.2, -47.6, 'room', '210');
        g.addNode('door_room_room_4_2_218', 2, 4, 52.2, -45.8, 'door', 'Вход 210');
        g.addNode('door_corr_room_4_2_218', 2, 4, 52.2, -45.0, 'door', 'Коридор 210');
        g.addNode('room_4_2_219', 2, 4, 55.3, -48.2, 'room', '211');
        g.addNode('door_room_room_4_2_219', 2, 4, 54.1, -45.8, 'door', 'Вход 211');
        g.addNode('door_corr_room_4_2_219', 2, 4, 54.1, -45.0, 'door', 'Коридор 211');
        g.addNode('room_4_2_221', 2, 4, 65.2, -47.6, 'room', 'ЛК№3');
        g.addNode('room_4_2_222', 2, 4, 34.3, -41.3, 'room', '205');
        g.addNode('door_mid_room_4_2_222', 2, 4, 36.2, -39.6, 'door', 'Дверь 205');
        g.addNode('door_room_room_4_2_222', 2, 4, 35.8, -39.6, 'door', 'Вход 205');
        g.addNode('room_4_2_223', 2, 4, 34.3, -33.9, 'room', '202');
        g.addNode('door_mid_room_4_2_223', 2, 4, 36.2, -35.2, 'door', 'Дверь 202');
        g.addNode('door_room_room_4_2_223', 2, 4, 35.8, -35.2, 'door', 'Вход 202');
        g.addNode('room_4_2_224', 2, 4, 34.3, -29.4, 'room', '201');
        g.addNode('door_mid_room_4_2_224', 2, 4, 36.2, -29.4, 'door', 'Дверь 201');
        g.addNode('door_room_room_4_2_224', 2, 4, 35.8, -29.4, 'door', 'Вход 201');
        g.addNode('room_4_2_225', 2, 4, 39.9, -38.5, 'room', '207');
        g.addNode('door_room_room_4_2_225', 2, 4, 39.8, -42.8, 'door', 'Вход 207');
        g.addNode('door_corr_room_4_2_225', 2, 4, 40.6, -42.8, 'door', 'Коридор 207');
        g.addNode('room_4_2_226', 2, 4, 43.3, -38.5, 'room', '208');
        g.addNode('door_corr_room_4_2_226', 2, 4, 42.6, -42.8, 'door', 'Коридор 208');
        g.addNode('room_4_2_227', 2, 4, 47.0, -42.0, 'room', '209');
        g.addNode('room_4_2_229', 2, 4, 40.6, -27.8, 'room', 'ЛК№1');
        g.addNode('door_mid_room_4_2_229', 2, 4, 40.6, -31.2, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_4_2_229', 2, 4, 40.6, -30.8, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_4_2_229', 2, 4, 40.6, -31.6, 'door', 'Коридор ЛК№1');
        g.addNode('room_4_2_230', 2, 4, 56.6, -35.5, 'room', 'Актовый зал');
        g.addNode('custom_b4_f2_c_421_-460_ipg', 2, 4, 42.1, -46.0, 'corridor', 'Коридор (42.1, -46)');
        g.addNode('custom_b4_f2_c_420_-492_wlz', 2, 4, 42.0, -49.2, 'corridor', 'Коридор (42, -49.2)');
        g.addNode('custom_b4_f2_c_467_-330_ubd', 2, 4, 46.7, -33.0, 'corridor', 'Коридор (46.7, -33)');
        g.addNode('custom_b4_f2_c_468_-355_akv', 2, 4, 46.8, -35.5, 'corridor', 'Коридор (46.8, -35.5)');
        g.addNode('custom_b4_f2_c_470_-387_ba7', 2, 4, 47.0, -38.7, 'corridor', 'Коридор (47, -38.7)');
        g.addNode('custom_b4_f2_c_461_-475_q2e', 2, 4, 46.1, -47.5, 'corridor', 'Коридор (46.1, -47.5)');
        g.addNode('custom_b4_f2_c_375_-505_yh2', 2, 4, 37.5, -50.5, 'corridor', 'Коридор (37.5, -50.5)');
        g.addNode('custom_b4_f2_c_375_-293_0r9', 2, 4, 37.5, -29.3, 'corridor', 'Коридор (37.5, -29.3)');
        g.addNode('custom_b4_f2_c_406_-330_68u', 2, 4, 40.6, -33.0, 'corridor', 'Коридор (40.6, -33)');
        g.addNode('custom_b4_f2_c_467_-330_7uh', 2, 4, 46.7, -33.0, 'corridor', 'Коридор (46.7, -33)');
        g.addNode('custom_b4_f2_c_469_-445_k0i', 2, 4, 46.9, -44.5, 'corridor', 'Коридор (46.9, -44.5)');
        g.addNode('custom_b4_f2_c_400_-492_pl2', 2, 4, 40.0, -49.2, 'corridor', 'Коридор (40, -49.2)');
        g.addNode('custom_b4_f2_c_400_-459_co7', 2, 4, 40.0, -45.9, 'corridor', 'Коридор (40, -45.9)');
        g.addNode('custom_b4_f2_c_400_-445_ijr', 2, 4, 40.0, -44.5, 'corridor', 'Коридор (40, -44.5)');
        g.addNode('custom_b4_f2_c_340_-456_tzd', 2, 4, 34.0, -45.6, 'corridor', 'Коридор (34, -45.6)');
        g.addNode('custom_b4_f2_c_315_-455_0it', 2, 4, 31.5, -45.5, 'corridor', 'Коридор (31.5, -45.5)');
        g.addNode('custom_b4_f2_c_340_-482_8qd', 2, 4, 34.0, -48.2, 'corridor', 'Коридор (34, -48.2)');
        g.addNode('custom_b1_f2_c_27_-76_oy4', 2, 1, 2.7, -7.6, 'corridor', 'Коридор (2.7, -7.6)');
        g.addNode('custom_b1_f2_c_27_-100_pje', 2, 1, 2.7, -10.0, 'corridor', 'Коридор (2.7, -10)');
        g.addNode('custom_b1_f2_c_59_-76_zai', 2, 1, 5.9, -7.6, 'corridor', 'Коридор (5.9, -7.6)');
        g.addNode('custom_b1_f2_c_59_-124_2uw', 2, 1, 5.9, -12.4, 'corridor', 'Коридор (5.9, -12.4)');
        g.addNode('custom_b3_f2_c_59_-232_f56', 2, 3, 5.9, -23.2, 'corridor', 'Коридор (5.9, -23.2)');
        g.addNode('custom_b3_f2_c_59_-304_oeo', 2, 3, 5.9, -30.4, 'corridor', 'Коридор (5.9, -30.4)');
        g.addNode('custom_b3_f2_c_59_-598_xz2', 2, 3, 5.9, -59.8, 'corridor', 'Коридор (5.9, -59.8)');
        g.addNode('custom_b2_f2_c_246_-88_mx5', 2, 2, 24.6, -8.8, 'corridor', 'Коридор (24.6, -8.8)');
        g.addNode('custom_b2_f2_c_246_-105_p78', 2, 2, 24.6, -10.5, 'corridor', 'Коридор (24.6, -10.5)');
        g.addNode('custom_b2_f2_c_219_-58_veu', 2, 2, 21.9, -5.8, 'corridor', 'Коридор (21.9, -5.8)');
        g.addNode('custom_b2_f2_c_249_-58_wdq', 2, 2, 24.9, -5.8, 'corridor', 'Коридор (24.9, -5.8)');
        g.addNode('custom_b2_f2_c_282_-58_zxs', 2, 2, 28.2, -5.8, 'corridor', 'Коридор (28.2, -5.8)');
        g.addNode('custom_b2_f2_c_328_-58_2yl', 2, 2, 32.8, -5.8, 'corridor', 'Коридор (32.8, -5.8)');
        g.addNode('custom_b2_f2_c_403_-58_82t', 2, 2, 40.3, -5.8, 'corridor', 'Коридор (40.3, -5.8)');
        g.addNode('custom_b1_f2_c_-102_15_l9n', 2, 1, -10.2, 1.5, 'corridor', 'Коридор (-10.2, 1.5)');
        g.addNode('custom_b1_f2_c_-111_15_njt', 2, 1, -11.1, 1.5, 'corridor', 'Коридор (-11.1, 1.5)');
        g.addNode('custom_b1_f2_c_-112_-14_sdr', 2, 1, -11.2, -1.4, 'corridor', 'Коридор (-11.2, -1.4)');
        g.addNode('custom_b1_f2_c_-30_-101_xdd', 2, 1, -3.0, -10.1, 'corridor', 'Коридор (-3, -10.1)');
        g.addNode('custom_b1_f2_c_95_-51_o94', 2, 1, 9.5, -5.1, 'corridor', 'Коридор (9.5, -5.1)');
        g.addNode('custom_b1_f2_c_136_-51_uqh', 2, 1, 13.6, -5.1, 'corridor', 'Коридор (13.6, -5.1)');
        g.addNode('custom_b1_f2_c_180_-56_1nw', 2, 1, 18.0, -5.6, 'corridor', 'Коридор (18, -5.6)');
        g.addNode('custom_b1_f2_c_-15_118_ag9', 2, 1, -1.5, 11.8, 'corridor', 'Коридор (-1.5, 11.8)');
        g.addNode('custom_b1_f2_c_-4_118_api', 2, 1, -0.4, 11.8, 'corridor', 'Коридор (-0.4, 11.8)');
        g.addNode('custom_b1_f2_c_160_-48_j36', 2, 1, 16.0, -4.8, 'corridor', 'Коридор (16, -4.8)');
        g.addNode('bridge_k4_k2_f2', 2, 4, 37.5, -20.6, 'bridge', 'Переход К4 ↔ К2 (2 эт.)');
        g.addNode('custom_b4_f2_c_375_-331_gu8', 2, 4, 37.5, -33.1, 'corridor', 'Коридор (37.5, -33.1)');
        g.addNode('custom_b4_f2_c_375_-352_jlh', 2, 4, 37.5, -35.2, 'corridor', 'Коридор (37.5, -35.2)');
        g.addNode('custom_b4_f2_c_375_-396_r1z', 2, 4, 37.5, -39.6, 'corridor', 'Коридор (37.5, -39.6)');
        g.addNode('custom_b4_f2_c_436_-428_jj3', 2, 4, 43.6, -42.8, 'corridor', 'Коридор (43.6, -42.8)');
        g.addNode('custom_b4_f2_c_606_-481_268', 2, 4, 60.6, -48.1, 'corridor', 'Коридор (60.6, -48.1)');
        g.addNode('custom_b4_f2_c_596_-481_2t5', 2, 4, 59.6, -48.1, 'corridor', 'Коридор (59.6, -48.1)');
        g.addNode('custom_b4_f2_c_624_-461_6cf', 2, 4, 62.4, -46.1, 'corridor', 'Коридор (62.4, -46.1)');
        g.addNode('custom_b4_f2_c_595_-445_bzr', 2, 4, 59.5, -44.5, 'corridor', 'Коридор (59.5, -44.5)');
        g.addNode('custom_b4_f2_c_595_-428_e34', 2, 4, 59.5, -42.8, 'corridor', 'Коридор (59.5, -42.8)');
        g.addNode('custom_b4_f2_c_607_-445_ikv', 2, 4, 60.7, -44.5, 'corridor', 'Коридор (60.7, -44.5)');
        g.addNode('custom_b4_f2_c_624_-445_n35', 2, 4, 62.4, -44.5, 'corridor', 'Коридор (62.4, -44.5)');
        g.addNode('custom_b3_f2_c_59_-430_6v0', 2, 3, 5.9, -43.0, 'corridor', 'Коридор (5.9, -43)');
        g.addNode('custom_b3_f2_c_84_-531_opn', 2, 3, 8.4, -53.1, 'corridor', 'Коридор (8.4, -53.1)');
        g.addNode('custom_b3_f2_c_107_-531_rgj', 2, 3, 10.7, -53.1, 'corridor', 'Коридор (10.7, -53.1)');
        g.addNode('custom_b3_f2_c_58_-318_asy', 2, 3, 5.8, -31.8, 'corridor', 'Коридор (5.8, -31.8)');
        g.addNode('door_mid_room_1_2_16', 2, 1, -1.2, 1.7, 'door', 'Дверь Лифтовой холл');
        g.addNode('door_room_room_1_2_16', 2, 1, -0.8, 1.7, 'door', 'Вход Лифтовой холл');
        g.addNode('door_corr_room_1_2_16', 2, 1, -1.6, 1.7, 'door', 'Коридор Лифтовой холл');
        g.addNode('b1_f1_nc_-3.0', 1, 1, -3.0, -5.8, 'corridor', 'К1 Эт.1 Сев. коридор');
        g.addNode('b1_f1_nc_0.0', 1, 1, 0.0, -5.8, 'corridor', 'К1 Эт.1 Сев. коридор');
        g.addNode('b1_f1_nc_3.0', 1, 1, 3.0, -5.8, 'corridor', 'К1 Эт.1 Сев. коридор');
        g.addNode('b1_f1_nc_5.9', 1, 1, 5.9, -5.8, 'corridor', 'К1 Эт.1 Сев. коридор');
        g.addNode('b1_f1_nc_9.4', 1, 1, 9.4, -5.8, 'corridor', 'К1 Эт.1 Сев. коридор');
        g.addNode('b1_f1_nc_12.5', 1, 1, 12.5, -5.8, 'corridor', 'К1 Эт.1 Сев. коридор');
        g.addNode('b1_f1_nc_16.0', 1, 1, 15.6, -5.0, 'corridor', 'К1 Эт.1 Сев. коридор');
        g.addNode('b1_f1_wc_-3.0', 1, 1, -3.0, -3.0, 'corridor', 'К1 Эт.1 Зап. коридор');
        g.addNode('b1_f1_wc_0.0', 1, 1, -3.0, 0.0, 'corridor', 'К1 Эт.1 Зап. коридор');
        g.addNode('b1_f1_wc_1.7', 1, 1, -3.0, 1.7, 'corridor', 'К1 Эт.1 Зап. коридор');
        g.addNode('b1_f1_wc_3.5', 1, 1, -3.0, 3.5, 'corridor', 'К1 Эт.1 Зап. коридор');
        g.addNode('b1_f1_wc_6.0', 1, 1, -3.0, 6.0, 'corridor', 'К1 Эт.1 Зап. коридор');
        g.addNode('b1_f1_sc_0.0', 1, 1, 0.0, 6.0, 'corridor', 'К1 Эт.1 Юж. коридор');
        g.addNode('b1_f1_sc_1.8', 1, 1, 1.8, 6.0, 'corridor', 'К1 Эт.1 Юж. коридор');
        g.addNode('b1_f1_sc_3.5', 1, 1, 3.5, 6.0, 'corridor', 'К1 Эт.1 Юж. коридор');
        g.addNode('b1_f1_stair_lk1', 1, 1, 9.4, -1.9, 'stair', 'К1 ЛК№1 (Эт.1)');
        g.addNode('b1_f1_stair_lk2', 1, 1, 9.4, 1.9, 'stair', 'К1 ЛК№2 (Эт.1)');
        g.addNode('b1_f1_elev', 1, 1, 1.8, 1.5, 'elevator', 'К1 Лифты (Эт.1)');
        g.addNode('b1_f1_entrance_main', 1, 1, 10.5, 10.4, 'entrance', 'Главный вход (Корпус 1)');
        g.addNode('b1_f1_porch_walk_1', 1, 1, 9.5, 9.8, 'corridor', 'Крыльцо у главного входа');
        g.addNode('b1_f1_porch_doors', 1, 1, 8.6, 9.8, 'door', 'Двери главного входа');
        g.addNode('b1_f1_vestibule', 1, 1, 6.2, 9.8, 'corridor', 'Тамбур главного входа');
        g.addNode('b1_f1_inner_doors', 1, 1, 3.8, 9.8, 'door', 'Вход в вестибюль');
        g.addNode('b1_f1_foyer', 1, 1, 1.8, 9.8, 'corridor', 'Главный вестибюль');
        g.addNode('b1_f1_foyer_w', 1, 1, -3.0, 9.8, 'corridor', 'Вестибюль (Западный угол)');
        g.addNode('b1_f1_inner_door_lk2', 1, 1, 8.6, 1.8, 'door', 'Внутренняя дверь ЛК№2');
        g.addNode('b2_f1_c_20.4', 1, 2, 20.4, -5.8, 'corridor', 'К2 Эт.1 Коридор');
        g.addNode('b2_f1_c_37.5', 1, 2, 37.5, -5.8, 'corridor', 'К2 Эт.1 Коридор');
        g.addNode('b2_f1_c_43.6', 1, 2, 43.6, -5.8, 'corridor', 'К2 Эт.1 Коридор');
        g.addNode('b2_f1_c_47.0', 1, 2, 47.0, -5.8, 'corridor', 'К2 Эт.1 Коридор');
        g.addNode('b2_f1_c_59.0', 1, 2, 59.0, -5.8, 'corridor', 'К2 Эт.1 Коридор');
        g.addNode('b2_f1_c_66.1', 1, 2, 66.1, -5.8, 'corridor', 'К2 Эт.1 Коридор');
        g.addNode('b2_f1_stair_lk1', 1, 2, 66.1, -10.5, 'stair', 'К2 ЛК№1 (Эт.1)');
        g.addNode('b2_f1_stair_lk2', 1, 2, 42.7, -10.5, 'stair', 'К2 ЛК№2 (Эт.1)');
        g.addNode('b2_f1_stair_lk3', 1, 2, 22.6, -12.2, 'stair', 'К2 ЛК№3 (Эт.1)');
        // Внутренний проходной тамбур ЛК №3 <-> Зал 105 по БТИ
        g.addNode('b2_f1_d_lk3_vest', 1, 2, 24.8, -11.35, 'door', 'Дверь ЛК№3 - Тамбур');
        g.addNode('b2_f1_vest_lk3', 1, 2, 26.1, -11.55, 'corridor', 'Тамбур ЛК№3');
        g.addNode('b2_f1_d_vest_105', 1, 2, 27.4, -11.80, 'door', 'Дверь Тамбур - 105');
        // Наружный эвакуационный выход из ЛК №3 на северное крыльцо и во двор
        g.addNode('b2_f1_lk3_exit_door', 1, 2, 21.6, -13.80, 'door', 'Выход во двор из ЛК№3');
        g.addNode('b2_f1_lk3_porch', 1, 2, 21.6, -15.40, 'entrance', 'Крыльцо ЛК№3');
        g.addNode('b2_f1_porch', 1, 2, 20.4, -5.8, 'entrance', 'Вход в Корпус 2');
        g.addNode('b3_f1_c_-28.6', 1, 3, 5.9, -28.6, 'corridor', 'К3 Эт.1 Коридор');
        g.addNode('b3_f1_c_-45.5', 1, 3, 5.9, -45.5, 'corridor', 'К3 Эт.1 Коридор');
        g.addNode('b3_f1_c_-46.0', 1, 3, 5.9, -46.0, 'corridor', 'К3 Эт.1 Коридор');
        g.addNode('b3_f1_c_-55.0', 1, 3, 5.9, -55.0, 'corridor', 'К3 Эт.1 Коридор');
        g.addNode('b3_f1_stair_south', 1, 3, 4.1, -28.6, 'stair', 'К3 Южная ЛК (Эт.1)');
        g.addNode('b3_f1_stair_north', 1, 3, 4.1, -46.0, 'stair', 'К3 Северная ЛК (Эт.1)');
        g.addNode('b3_f1_exit_112_door', 1, 3, 14.0, -45.5, 'door', 'Выход из 112 на крыльцо');
        g.addNode('b3_f1_exit_112_porch', 1, 3, 15.2, -45.5, 'entrance', 'Крыльцо 112');
        g.addNode('b3_f1_stair_north_wp', 1, 3, 1.5, -46.9, 'stair', 'Марш ЛК№1');
        g.addNode('b3_f1_entrance_north', 1, 3, -1.6, -46.1, 'entrance', 'Вход К3 (Северный)');
        g.addNode('b3_f1_entrance_west', 1, 3, -1.6, -37.1, 'entrance', 'Вход К3 (Западный)');
        g.addNode('b3_f1_vest_north', 1, 3, 5.9, -53.0, 'corridor', 'Тамбур К3 Эт.1');
        g.addNode('b3_f1_d_corr_east_exit', 1, 3, 7.2, -29.1, 'door', 'Дверь к восточному выходу');
        g.addNode('b4_f1_stair_lk1', 1, 4, 40.6, -27.8, 'stair', 'К4 ЛК№1 (Эт.1)');
        g.addNode('b4_f1_stair_lk1_door', 1, 4, 40.6, -31.2, 'door', 'К4 Дверь ЛК№1 (Эт.1)');
        g.addNode('b4_f1_stair_lk2', 1, 4, 30.1, -48.3, 'stair', 'К4 ЛК№2 (Эт.1)');
        g.addNode('b4_f1_stair_lk2_door', 1, 4, 32.4, -48.3, 'door', 'К4 Дверь ЛК№2 (Эт.1)');
        g.addNode('b4_f1_stair_lk3', 1, 4, 65.2, -47.6, 'stair', 'К4 ЛК№3 (Эт.1)');
        g.addNode('room_1_1_0', 1, 1, -4.6, -10.2, 'room', '102');
        g.addNode('door_mid_room_1_1_0', 1, 1, -3.9, -6.2, 'door', 'Дверь 102');
        g.addNode('door_room_room_1_1_0', 1, 1, -3.9, -6.6, 'door', 'Вход 102');
        g.addNode('door_corr_room_1_1_0', 1, 1, -3.9, -5.8, 'door', 'Коридор 102');
        g.addNode('room_1_1_1', 1, 1, 2.7, -10.2, 'room', '106');
        g.addNode('door_mid_room_1_1_1', 1, 1, 4.6, -10.0, 'door', 'Дверь 106');
        g.addNode('door_room_room_1_1_1', 1, 1, 4.2, -10.0, 'door', 'Вход 106');
        g.addNode('door_corr_room_1_1_1', 1, 1, 5.0, -10.0, 'door', 'Коридор 106');
        g.addNode('room_1_1_2', 1, 1, 6.0, -10.2, 'room', '105');
        g.addNode('room_1_1_3', 1, 1, 9.3, -13.2, 'room', 'С/У');
        g.addNode('room_1_1_4', 1, 1, 9.3, -7.0, 'room', 'С/У');
        g.addNode('room_1_1_5', 1, 1, 13.6, -10.2, 'room', '107');
        g.addNode('door_mid_room_1_1_5', 1, 1, 13.5, -6.2, 'door', 'Дверь 107');
        g.addNode('door_room_room_1_1_5', 1, 1, 13.5, -6.6, 'door', 'Вход 107');
        g.addNode('door_corr_room_1_1_5', 1, 1, 13.5, -5.8, 'door', 'Коридор 107');
        g.addNode('room_1_1_6', 1, 1, 7.6, -2.4, 'room', '104');
        g.addNode('door_mid_room_1_1_6', 1, 1, 7.6, -4.0, 'door', 'Дверь 104');
        g.addNode('door_room_room_1_1_6', 1, 1, 7.6, -3.6, 'door', 'Вход 104');
        g.addNode('door_corr_room_1_1_6', 1, 1, 7.6, -4.4, 'door', 'Коридор 104');
        g.addNode('room_1_1_7', 1, 1, 5.6, -2.4, 'room', '103');
        g.addNode('door_mid_room_1_1_7', 1, 1, 5.6, -4.0, 'door', 'Дверь 103');
        g.addNode('door_room_room_1_1_7', 1, 1, 5.6, -3.6, 'door', 'Вход 103');
        g.addNode('door_corr_room_1_1_7', 1, 1, 5.6, -4.4, 'door', 'Коридор 103');
        g.addNode('room_1_1_8', 1, 1, 1.8, 1.8, 'room', '103');
        g.addNode('room_1_1_9', 1, 1, 5.4, 6.7, 'room', '101');
        g.addNode('door_mid_room_1_1_9', 1, 1, 3.8, 6.7, 'door', 'Дверь 101');
        g.addNode('door_room_room_1_1_9', 1, 1, 4.2, 6.7, 'door', 'Вход 101');
        g.addNode('door_corr_room_1_1_9', 1, 1, 3.4, 6.7, 'door', 'Коридор 101');
        g.addNode('room_1_1_10', 1, 1, 9.4, -1.9, 'room', 'ЛК№1');
        g.addNode('room_1_1_11', 1, 1, 9.4, 1.9, 'room', 'ЛК№2');
        g.addNode('room_2_1_94', 1, 2, 23.9, -8.7, 'room', '103');
        g.addNode('door_mid_room_2_1_94', 1, 2, 24.6, -7.2, 'door', 'Дверь 103');
        g.addNode('door_room_room_2_1_94', 1, 2, 24.6, -7.6, 'door', 'Вход 103');
        g.addNode('door_corr_room_2_1_94', 1, 2, 24.6, -6.8, 'door', 'Коридор 103');
        g.addNode('room_2_1_95', 1, 2, 33.0, -10.3, 'room', '105');
        g.addNode('door_mid_room_2_1_95', 1, 2, 33.4, -7.2, 'door', 'Дверь 105');
        g.addNode('door_room_room_2_1_95', 1, 2, 33.4, -7.6, 'door', 'Вход 105');
        g.addNode('door_corr_room_2_1_95', 1, 2, 33.4, -6.8, 'door', 'Коридор 105');
        g.addNode('room_2_1_96', 1, 2, 40.2, -8.3, 'room', '107');
        g.addNode('door_mid_room_2_1_96', 1, 2, 40.2, -7.2, 'door', 'Дверь 107');
        g.addNode('door_room_room_2_1_96', 1, 2, 40.2, -7.6, 'door', 'Вход 107');
        g.addNode('door_corr_room_2_1_96', 1, 2, 40.2, -6.8, 'door', 'Коридор 107');
        g.addNode('room_2_1_97', 1, 2, 44.5, -9.2, 'room', 'ЛК№2');
        g.addNode('door_mid_room_2_1_97', 1, 2, 44.5, -7.2, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_2_1_97', 1, 2, 44.5, -7.6, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_2_1_97', 1, 2, 44.5, -6.8, 'door', 'Коридор ЛК№2');
        g.addNode('room_2_1_98', 1, 2, 53.1, -10.3, 'room', '109');
        g.addNode('door_mid_room_2_1_98', 1, 2, 49.9, -7.2, 'door', 'Дверь 109');
        g.addNode('door_room_room_2_1_98', 1, 2, 49.9, -7.6, 'door', 'Вход 109');
        g.addNode('door_corr_room_2_1_98', 1, 2, 49.9, -6.8, 'door', 'Коридор 109');
        g.addNode('room_2_1_99', 1, 2, 59.7, -10.3, 'room', '111');
        g.addNode('door_mid_room_2_1_99', 1, 2, 59.4, -7.2, 'door', 'Дверь 111');
        g.addNode('door_room_room_2_1_99', 1, 2, 59.4, -7.6, 'door', 'Вход 111');
        g.addNode('door_corr_room_2_1_99', 1, 2, 59.4, -6.8, 'door', 'Коридор 111');
        g.addNode('door_corr_room_2_1_100', 1, 2, 62.0, -8.8, 'door', 'Коридор С/У');
        g.addNode('room_2_1_101', 1, 2, 62.7, -8.0, 'room', 'С/У');
        g.addNode('room_2_1_103', 1, 2, 29.5, -0.5, 'room', '104 Библиотека');
        g.addNode('door_mid_room_2_1_103', 1, 2, 31.7, -4.4, 'door', 'Дверь 104');
        g.addNode('door_room_room_2_1_103', 1, 2, 31.7, -4.0, 'door', 'Вход 104');
        g.addNode('door_corr_room_2_1_103', 1, 2, 31.7, -4.8, 'door', 'Коридор 104');
        g.addNode('room_2_1_104', 1, 2, 46.7, -0.5, 'room', '106');
        g.addNode('door_mid_room_2_1_104', 1, 2, 47.1, -4.4, 'door', 'Дверь 106');
        g.addNode('door_room_room_2_1_104', 1, 2, 47.1, -4.0, 'door', 'Вход 106');
        g.addNode('door_corr_room_2_1_104', 1, 2, 47.1, -4.8, 'door', 'Коридор 106');
        g.addNode('room_2_1_105', 1, 2, 59.5, -0.5, 'room', '108');
        g.addNode('door_mid_room_2_1_105', 1, 2, 56.9, -4.4, 'door', 'Дверь 108');
        g.addNode('door_room_room_2_1_105', 1, 2, 56.9, -4.0, 'door', 'Вход 108');
        g.addNode('door_corr_room_2_1_105', 1, 2, 56.9, -4.8, 'door', 'Коридор 108');
        g.addNode('room_2_1_106', 1, 2, 66.0, -0.5, 'room', '110');
        g.addNode('room_3_1_139', 1, 3, 3.2, -20.5, 'room', '103');
        g.addNode('room_3_1_140', 1, 3, 10.6, -23.2, 'room', '104');
        g.addNode('door_mid_room_3_1_140', 1, 3, 7.2, -23.2, 'door', 'Дверь 104');
        g.addNode('door_room_room_3_1_140', 1, 3, 7.6, -23.2, 'door', 'Вход 104');
        g.addNode('room_3_1_141', 1, 3, 10.6, -25.6, 'room', '102');
        g.addNode('door_mid_room_3_1_141', 1, 3, 7.2, -25.6, 'door', 'Дверь 102');
        g.addNode('door_room_room_3_1_141', 1, 3, 7.6, -25.6, 'door', 'Вход 102');
        g.addNode('door_corr_room_3_1_141', 1, 3, 6.8, -25.6, 'door', 'Коридор 102');
        g.addNode('room_3_1_142', 1, 3, 10.6, -31.6, 'room', '105');
        g.addNode('door_mid_room_3_1_142', 1, 3, 7.2, -31.3, 'door', 'Дверь 105');
        g.addNode('room_3_1_143', 1, 3, 10.6, -37.4, 'room', '111');
        g.addNode('door_mid_room_3_1_143', 1, 3, 7.2, -37.5, 'door', 'Дверь 111');
        g.addNode('door_room_room_3_1_143', 1, 3, 7.6, -37.5, 'door', 'Вход 111');
        g.addNode('door_corr_room_3_1_143', 1, 3, 6.8, -37.5, 'door', 'Коридор 111');
        g.addNode('room_3_1_144', 1, 3, 10.6, -43.1, 'room', '111А');
        g.addNode('door_mid_room_3_1_144', 1, 3, 7.2, -43.0, 'door', 'Дверь 111А');
        g.addNode('door_room_room_3_1_144', 1, 3, 7.6, -43.0, 'door', 'Вход 111А');
        g.addNode('room_3_1_145', 1, 3, 10.6, -45.5, 'room', '112');
        g.addNode('door_mid_room_3_1_145', 1, 3, 7.2, -45.5, 'door', 'Дверь 112');
        g.addNode('door_room_room_3_1_145', 1, 3, 7.6, -45.5, 'door', 'Вход 112');
        g.addNode('door_corr_room_3_1_145', 1, 3, 6.8, -45.5, 'door', 'Коридор 112');
        g.addNode('room_3_1_146', 1, 3, 10.6, -47.6, 'room', '113А');
        g.addNode('door_mid_room_3_1_146', 1, 3, 7.2, -47.5, 'door', 'Дверь 113А');
        g.addNode('door_room_room_3_1_146', 1, 3, 7.6, -47.5, 'door', 'Вход 113А');
        g.addNode('room_3_1_147', 1, 3, 10.6, -50.1, 'room', '113');
        g.addNode('door_mid_room_3_1_147', 1, 3, 7.2, -49.4, 'door', 'Дверь 113');
        g.addNode('door_room_room_3_1_147', 1, 3, 7.6, -49.4, 'door', 'Вход 113');
        g.addNode('room_3_1_148', 1, 3, 10.1, -57.2, 'room', '116');
        g.addNode('door_mid_room_3_1_148', 1, 3, 5.9, -54.2, 'door', 'Дверь 116');
        g.addNode('door_room_room_3_1_148', 1, 3, 5.9, -54.6, 'door', 'Вход 116');
        g.addNode('door_corr_room_3_1_148', 1, 3, 5.9, -53.8, 'door', 'Коридор 116');
        g.addNode('room_3_1_149', 1, 3, 4.1, -28.6, 'room', 'ЛК№2');
        g.addNode('door_mid_room_3_1_149', 1, 3, 4.6, -28.6, 'door', 'Дверь ЛК№2');
        g.addNode('door_room_room_3_1_149', 1, 3, 4.3, -28.6, 'door', 'Вход ЛК№2');
        g.addNode('door_corr_room_3_1_149', 1, 3, 4.9, -28.6, 'door', 'Коридор ЛК№2');
        g.addNode('room_3_1_150', 1, 3, 1.5, -31.5, 'room', '106');
        g.addNode('door_mid_room_3_1_150', 1, 3, 4.6, -31.3, 'door', 'Дверь 106');
        g.addNode('door_room_room_3_1_150', 1, 3, 4.2, -31.3, 'door', 'Вход 106');
        g.addNode('room_3_1_151', 1, 3, 1.5, -33.8, 'room', '107');
        g.addNode('door_room_room_3_1_151', 1, 3, 2.1, -34.6, 'door', 'Вход 107');
        g.addNode('room_3_1_152', 1, 3, 3.0, -38.0, 'room', '109');
        g.addNode('room_3_1_153', 1, 3, -0.4, -38.7, 'room', '108');
        g.addNode('door_room_room_3_1_153', 1, 3, -0.3, -37.8, 'door', 'Дверь 108');
        g.addNode('b3_f1_tambur_108', 1, 3, -0.4, -37.1, 'corridor', 'Тамбур входа К3');
        g.addNode('b3_f1_door_tambur_108', 1, 3, 0.4, -36.4, 'door', 'Дверь тамбура К3');
        g.addNode('b3_f1_exit_east_inner', 1, 3, 9.4, -28.6, 'corridor', 'Проход к выходу К3');
        g.addNode('b3_f1_exit_east_door', 1, 3, 13.8, -28.6, 'door', 'Выход К3 во двор');
        g.addNode('room_3_1_154', 1, 3, 0.2, -40.7, 'room', 'С/У');
        g.addNode('door_mid_room_3_1_154', 1, 3, 4.6, -40.4, 'door', 'Дверь С/У');
        g.addNode('door_room_room_3_1_154', 1, 3, 4.2, -40.4, 'door', 'Вход С/У');
        g.addNode('door_corr_room_3_1_154', 1, 3, 5.0, -40.4, 'door', 'Коридор С/У');
        g.addNode('room_3_1_155', 1, 3, 3.3, -41.9, 'room', 'С/У');
        g.addNode('door_mid_room_3_1_155', 1, 3, 4.6, -41.9, 'door', 'Дверь С/У');
        g.addNode('door_room_room_3_1_155', 1, 3, 4.2, -41.9, 'door', 'Вход С/У');
        g.addNode('door_corr_room_3_1_155', 1, 3, 5.0, -41.9, 'door', 'Коридор С/У');
        g.addNode('room_3_1_156', 1, 3, 0.2, -43.1, 'room', 'С/У');
        g.addNode('room_3_1_157', 1, 3, 4.1, -46.0, 'room', 'ЛК№1');
        g.addNode('door_mid_room_3_1_157', 1, 3, 4.6, -46.0, 'door', 'Дверь ЛК№1');
        g.addNode('door_room_room_3_1_157', 1, 3, 4.3, -46.0, 'door', 'Вход ЛК№1');
        g.addNode('door_corr_room_3_1_157', 1, 3, 4.9, -46.0, 'door', 'Коридор ЛК№1');
        g.addNode('room_3_1_158', 1, 3, 1.5, -49.0, 'room', '114');
        g.addNode('door_mid_room_3_1_158', 1, 3, 4.6, -49.0, 'door', 'Дверь 114');
        g.addNode('door_room_room_3_1_158', 1, 3, 4.2, -49.0, 'door', 'Вход 114');
        g.addNode('room_3_1_159', 1, 3, 1.5, -50.5, 'room', '114А');
        g.addNode('door_mid_room_3_1_159', 1, 3, 4.6, -51.0, 'door', 'Дверь 114А');
        g.addNode('door_room_room_3_1_159', 1, 3, 4.2, -51.0, 'door', 'Вход 114А');
        g.addNode('door_corr_room_3_1_159', 1, 3, 5.0, -51.0, 'door', 'Коридор 114А');
        g.addNode('room_3_1_160', 1, 3, 1.5, -54.5, 'room', '117');
        g.addNode('door_room_3_1_160', 1, 3, 4.6, -53.0, 'door', 'Дверь 117');
        g.addNode('custom_b4_f1_d_593_-436_6de', 1, 4, 59.3, -43.6, 'door', 'Дверь (59.3, -43.6)');
        g.addNode('custom_b4_f1_d_339_-469_bso', 1, 4, 33.9, -46.9, 'door', 'Дверь (33.9, -46.9)');
        g.addNode('custom_b4_f1_c_433_-536_d4u', 1, 4, 43.3, -53.6, 'corridor', 'Коридор (43.3, -53.6)');
        g.addNode('custom_b4_f1_d_422_-464_yo1', 1, 4, 42.2, -46.4, 'door', 'Дверь (42.2, -46.4)');
        g.addNode('custom_b4_f1_c_429_-464_2po', 1, 4, 42.9, -46.4, 'corridor', 'Коридор (42.9, -46.4)');
        g.addNode('custom_b4_f1_c_407_-556_vts', 1, 4, 40.7, -55.6, 'corridor', 'Коридор (40.7, -55.6)');
        g.addNode('custom_b4_f1_c_407_-573_wyn', 1, 4, 40.7, -57.3, 'corridor', 'Коридор (40.7, -57.3)');
        g.addNode('custom_b4_f1_d_399_-573_zlv', 1, 4, 39.9, -57.3, 'door', 'Дверь (39.9, -57.3)');
        g.addNode('custom_b4_f1_d_399_-555_4yn', 1, 4, 39.9, -55.5, 'door', 'Дверь (39.9, -55.5)');
        g.addNode('custom_b4_f1_d_399_-540_5z3', 1, 4, 39.9, -54.0, 'door', 'Дверь (39.9, -54)');
        g.addNode('custom_b4_f1_c_408_-538_la7', 1, 4, 40.8, -53.8, 'corridor', 'Коридор (40.8, -53.8)');
        g.addNode('custom_b4_f1_c_382_-539_qon', 1, 4, 38.2, -53.9, 'corridor', 'Коридор (38.2, -53.9)');
        g.addNode('custom_b4_f1_c_376_-583_w14', 1, 4, 37.6, -58.3, 'corridor', 'Коридор (37.6, -58.3)');
        g.addNode('custom_b4_f1_c_377_-574_xym', 1, 4, 37.7, -57.4, 'corridor', 'Коридор (37.7, -57.4)');
        g.addNode('custom_b4_f1_c_379_-554_3yr', 1, 4, 37.9, -55.4, 'corridor', 'Коридор (37.9, -55.4)');
        g.addNode('custom_b4_f1_c_380_-524_6se', 1, 4, 38.0, -52.4, 'corridor', 'Коридор (38, -52.4)');
        g.addNode('custom_b4_f1_c_408_-516_r12', 1, 4, 40.8, -51.6, 'corridor', 'Коридор (40.8, -51.6)');
        g.addNode('custom_b4_f1_c_601_-580_071', 1, 4, 60.1, -58.0, 'corridor', 'Коридор (60.1, -58)');
        g.addNode('custom_b4_f1_d_600_-562_2j2', 1, 4, 60.0, -56.2, 'door', 'Дверь (60, -56.2)');
        g.addNode('custom_b4_f1_c_381_-508_uq8', 1, 4, 38.1, -50.8, 'corridor', 'Коридор (38.1, -50.8)');
        g.addNode('custom_b4_f1_c_552_-549_4n4', 1, 4, 55.2, -54.9, 'corridor', 'Коридор (55.2, -54.9)');
        g.addNode('custom_b4_f1_c_460_-550_j9a', 1, 4, 46.0, -55.0, 'corridor', 'Коридор (46, -55)');
        g.addNode('custom_b2_f1_c_226_-58_h4c', 1, 2, 22.6, -5.8, 'corridor', 'Коридор (22.6, -5.8)');
        g.addNode('custom_b4_f1_c_555_-321_byu', 1, 4, 55.5, -32.1, 'corridor', 'Коридор (55.5, -32.1)');
        g.addNode('custom_b4_f1_c_416_-381_ou5', 1, 4, 41.6, -38.1, 'corridor', 'Коридор (41.6, -38.1)');
        g.addNode('custom_b4_f1_c_403_-381_pfc', 1, 4, 40.3, -38.1, 'corridor', 'Коридор (40.3, -38.1)');
        g.addNode('custom_b4_f1_c_374_-335_h95', 1, 4, 37.4, -33.5, 'corridor', 'Коридор (37.4, -33.5)');
        g.addNode('custom_b4_f1_c_406_-322_sat', 1, 4, 40.6, -32.2, 'corridor', 'Коридор (40.6, -32.2)');
        g.addNode('custom_b4_f1_c_406_-337_upv', 1, 4, 40.6, -33.7, 'corridor', 'Коридор (40.6, -33.7)');
        g.addNode('custom_b4_f1_c_375_-421_98k', 1, 4, 37.5, -42.1, 'corridor', 'Коридор (37.5, -42.1)');
        g.addNode('custom_b4_f1_c_375_-399_ab6', 1, 4, 37.5, -39.9, 'corridor', 'Коридор (37.5, -39.9)');
        g.addNode('custom_b4_f1_c_375_-359_eex', 1, 4, 37.5, -35.9, 'corridor', 'Коридор (37.5, -35.9)');
        g.addNode('custom_b4_f1_c_551_-445_qa9', 1, 4, 55.1, -44.5, 'corridor', 'Коридор (55.1, -44.5)');
        g.addNode('custom_b4_f1_c_561_-476_97n', 1, 4, 56.1, -47.6, 'corridor', 'Коридор (56.1, -47.6)');
        g.addNode('custom_b4_f1_c_561_-445_da8', 1, 4, 56.1, -44.5, 'corridor', 'Коридор (56.1, -44.5)');
        g.addNode('custom_b4_f1_c_593_-445_gtu', 1, 4, 59.3, -44.5, 'corridor', 'Коридор (59.3, -44.5)');
        g.addNode('custom_b4_f1_c_627_-445_hx9', 1, 4, 62.7, -44.5, 'corridor', 'Коридор (62.7, -44.5)');
        g.addNode('custom_b4_f1_c_561_-512_o8y', 1, 4, 56.1, -51.2, 'corridor', 'Коридор (56.1, -51.2)');
        g.addNode('custom_b4_f1_c_460_-536_19u', 1, 4, 46.0, -53.6, 'corridor', 'Коридор (46, -53.6)');
        g.addNode('custom_b4_f1_c_494_-536_23i', 1, 4, 49.4, -53.6, 'corridor', 'Коридор (49.4, -53.6)');
        g.addNode('custom_b4_f1_c_529_-536_2sr', 1, 4, 52.9, -53.6, 'corridor', 'Коридор (52.9, -53.6)');
        g.addNode('custom_b4_f1_c_530_-549_ioh', 1, 4, 53.0, -54.9, 'corridor', 'Коридор (53, -54.9)');
        g.addNode('custom_b4_f1_c_499_-549_jlz', 1, 4, 49.9, -54.9, 'corridor', 'Коридор (49.9, -54.9)');
        g.addNode('custom_b4_f1_c_552_-580_qms', 1, 4, 55.2, -58.0, 'corridor', 'Коридор (55.2, -58)');
        g.addNode('custom_b4_f1_c_599_-530_wca', 1, 4, 59.9, -53.0, 'corridor', 'Коридор (59.9, -53)');
        g.addNode('custom_b4_f1_c_488_-476_4bo', 1, 4, 48.8, -47.6, 'corridor', 'Коридор (48.8, -47.6)');
        g.addNode('custom_b4_f1_c_435_-484_9xi', 1, 4, 43.5, -48.4, 'corridor', 'Коридор (43.5, -48.4)');
        g.addNode('custom_b4_f1_c_428_-484_ar4', 1, 4, 42.8, -48.4, 'corridor', 'Коридор (42.8, -48.4)');
        g.addNode('custom_b4_f1_c_388_-464_v8b', 1, 4, 38.8, -46.4, 'corridor', 'Коридор (38.8, -46.4)');
        g.addNode('custom_b4_f1_c_375_-481_af1', 1, 4, 37.5, -48.1, 'corridor', 'Коридор (37.5, -48.1)');
        g.addNode('custom_b4_f1_c_393_-445_clm', 1, 4, 39.3, -44.5, 'corridor', 'Коридор (39.3, -44.5)');
        g.addNode('custom_b2_f1_c_626_-58_pxf', 1, 2, 62.6, -5.8, 'corridor', 'Коридор (62.6, -5.8)');
        g.addNode('custom_b2_f1_c_620_-125_vbv', 1, 2, 62.0, -12.5, 'corridor', 'Коридор (62, -12.5)');
        g.addNode('custom_b2_f1_c_629_-125_vmm', 1, 2, 62.9, -12.5, 'corridor', 'Коридор (62.9, -12.5)');
        g.addNode('custom_b2_f1_c_317_-58_it3', 1, 2, 31.7, -5.8, 'corridor', 'Коридор (31.7, -5.8)');
        g.addNode('custom_b2_f1_c_334_-58_oms', 1, 2, 33.4, -5.8, 'corridor', 'Коридор (33.4, -5.8)');
        g.addNode('custom_b2_f1_c_402_-58_rs0', 1, 2, 40.2, -5.8, 'corridor', 'Коридор (40.2, -5.8)');
        g.addNode('custom_b2_f1_c_246_-58_wff', 1, 2, 24.6, -5.8, 'corridor', 'Коридор (24.6, -5.8)');
        g.addNode('custom_b3_f1_c_59_-313_m4p', 1, 3, 5.9, -31.3, 'corridor', 'Коридор (5.9, -31.3)');
        g.addNode('custom_b3_f1_c_59_-356_xpk', 1, 3, 5.9, -35.6, 'corridor', 'Коридор (5.9, -35.6)');
        g.addNode('custom_b3_f1_c_59_-375_zxo', 1, 3, 5.9, -37.5, 'corridor', 'Коридор (5.9, -37.5)');
        g.addNode('custom_b3_f1_c_59_-404_5kk', 1, 3, 5.9, -40.4, 'corridor', 'Коридор (5.9, -40.4)');
        g.addNode('custom_b3_f1_c_59_-420_6z7', 1, 3, 5.9, -42.0, 'corridor', 'Коридор (5.9, -42)');
        g.addNode('custom_b3_f1_c_59_-431_8or', 1, 3, 5.9, -43.1, 'corridor', 'Коридор (5.9, -43.1)');
        g.addNode('custom_b3_f1_c_42_-395_irx', 1, 3, 4.2, -39.5, 'corridor', 'Коридор (4.2, -39.5)');
        g.addNode('custom_b3_f1_c_59_-579_ud7', 1, 3, 5.9, -57.9, 'corridor', 'Коридор (5.9, -57.9)');
        g.addNode('custom_b3_f1_c_60_-205_o4u', 1, 3, 6.0, -20.5, 'corridor', 'Коридор (6, -20.5)');
        g.addNode('custom_b3_f1_c_60_-232_qzy', 1, 3, 6.0, -23.2, 'corridor', 'Коридор (6, -23.2)');
        g.addNode('custom_b3_f1_c_60_-257_skf', 1, 3, 6.0, -25.7, 'corridor', 'Коридор (6, -25.7)');
        g.addNode('custom_b3_f1_c_73_-257_vh5', 1, 3, 7.3, -25.7, 'corridor', 'Коридор (7.3, -25.7)');
        g.addNode('custom_b3_f1_c_106_-257_yy3', 1, 3, 10.6, -25.7, 'corridor', 'Коридор (10.6, -25.7)');
        g.addNode('custom_b3_f1_c_21_-356_8ss', 1, 3, 2.1, -35.6, 'corridor', 'Коридор (2.1, -35.6)');
        g.addNode('custom_b3_f1_c_59_-476_pow', 1, 3, 5.9, -47.6, 'corridor', 'Коридор (5.9, -47.6)');
        g.addNode('custom_b3_f1_c_59_-491_r17', 1, 3, 5.9, -49.1, 'corridor', 'Коридор (5.9, -49.1)');
        g.addNode('custom_b3_f1_c_59_-511_sy7', 1, 3, 5.9, -51.1, 'corridor', 'Коридор (5.9, -51.1)');
        g.addNode('custom_b3_f1_c_102_-579_32j', 1, 3, 10.2, -57.9, 'corridor', 'Коридор (10.2, -57.9)');
        g.addNode('custom_b2_f1_c_570_-58_cc0', 1, 2, 57.0, -5.8, 'corridor', 'Коридор (57, -5.8)');
        g.addNode('custom_b1_f1_c_61_-132_nb8', 1, 1, 6.1, -13.2, 'corridor', 'Коридор (6.1, -13.2)');
        g.addNode('custom_b1_f1_c_58_-72_tpz', 1, 1, 5.8, -7.2, 'corridor', 'Коридор (5.8, -7.2)');
        g.addNode('custom_b1_f1_c_58_-101_wov', 1, 1, 5.8, -10.1, 'corridor', 'Коридор (5.8, -10.1)');
        g.addNode('custom_b2_f1_c_500_-59_9s1', 1, 2, 50.0, -5.9, 'corridor', 'Коридор (50, -5.9)');
        // === УЛИЧНЫЕ УЗЛЫ (OUTDOOR NODES) ===
                // --- КОРПУС 4 — ЭТАЖ 1 (ПО СХЕМЕ ЭВАКУАЦИИ) ---
        g.addNode('b4_f1_stair_lk1', 1, 4, 40.6, -27.8, 'stair', 'b4_f1_stair_lk1');
        g.addNode('b4_f1_stair_lk1_door', 1, 4, 40.6, -31.2, 'door', 'b4_f1_stair_lk1_door');
        g.addNode('b4_f1_stair_lk2', 1, 4, 30.1, -48.3, 'stair', 'b4_f1_stair_lk2');
        g.addNode('b4_f1_stair_lk2_door', 1, 4, 32.4, -46.2, 'door', 'b4_f1_stair_lk2_door');
        g.addNode('b4_f1_porch', 1, 4, 30.1, -51.3, 'entrance', 'Вход в Корпус 4');
        g.addNode('b4_f1_stair_lk3', 1, 4, 65.2, -47.6, 'stair', 'b4_f1_stair_lk3');
        g.addNode('b4_f1_stair_lk3_door', 1, 4, 61.6, -47.5, 'door', 'b4_f1_stair_lk3_door');
        g.addNode('b4_f1_foyer_center', 1, 4, 40.6, -33.0, 'corridor', 'Коридор (40.6, -33.0)');
        g.addNode('b4_f1_foyer_entrance', 1, 4, 43.8, -32.1, 'corridor', 'Коридор (43.8, -32.1)');
        g.addNode('b4_f1_foyer_door_102', 1, 4, 44.5, -34.1, 'door', 'Дверь (44.5, -34.1)');
        g.addNode('b4_f1_door_102_inside', 1, 4, 45.5, -34.1, 'door', 'Дверь (45.5, -34.1)');
        g.addNode('room_4_1_182', 1, 4, 34.3, -40.5, 'room', '104');
        g.addNode('door_room_4_1_182', 1, 4, 36.2, -40.0, 'door', 'Дверь (36.2, -40.0)');
        g.addNode('room_4_1_183', 1, 4, 34.3, -33.4, 'room', '103');
        g.addNode('door_room_4_1_183', 1, 4, 36.2, -33.4, 'door', 'Дверь (36.2, -33.4)');
        g.addNode('b4_f1_c_366_320', 1, 4, 36.6, -33.0, 'corridor', 'Коридор (36.6, -33.0)');
        g.addNode('b4_f1_c_366_334', 1, 4, 36.6, -33.4, 'corridor', 'Коридор (36.6, -33.4)');
        g.addNode('b4_f1_c_366_400', 1, 4, 36.6, -40.0, 'corridor', 'Коридор (36.6, -40.0)');
        g.addNode('b4_f1_c_366_462', 1, 4, 36.6, -46.2, 'corridor', 'Коридор (36.6, -46.2)');
        g.addNode('room_4_1_184', 1, 4, 55.5, -35.5, 'room', 'Столовая');
        g.addNode('b4_f1_c_102_east', 1, 4, 59.4, -44.5, 'corridor', 'Коридор (59.4, -44.5)');
        g.addNode('door_102_to_18', 1, 4, 59.4, -45.4, 'door', 'Дверь (59.4, -45.4)');
        g.addNode('b4_f1_nc_324', 1, 4, 32.4, -46.2, 'corridor', 'Коридор (32.4, -46.2)');
        g.addNode('b4_f1_nc_382', 1, 4, 38.2, -46.2, 'corridor', 'Коридор (38.2, -46.2)');
        g.addNode('b4_f1_nc_404', 1, 4, 40.4, -46.2, 'corridor', 'Коридор (40.4, -46.2)');
        g.addNode('b4_f1_nc_414', 1, 4, 41.4, -46.2, 'corridor', 'Коридор (41.4, -46.2)');
        g.addNode('b4_f1_nc_432', 1, 4, 43.2, -46.2, 'corridor', 'Коридор (43.2, -46.2)');
        g.addNode('b4_f1_nc_450', 1, 4, 45.0, -46.2, 'corridor', 'Коридор (45.0, -46.2)');
        g.addNode('b4_f1_nc_500', 1, 4, 50.0, -46.2, 'corridor', 'Коридор (50.0, -46.2)');
        g.addNode('room_4_1_186', 1, 4, 38.2, -41.3, 'room', '1');
        g.addNode('door_room_4_1_186', 1, 4, 38.2, -45.4, 'door', 'Дверь (38.2, -45.4)');
        g.addNode('room_4_1_187', 1, 4, 40.6, -41.3, 'room', '2');
        g.addNode('door_room_4_1_187', 1, 4, 40.4, -45.4, 'door', 'Дверь (40.4, -45.4)');
        g.addNode('room_4_1_188', 1, 4, 43.4, -43.9, 'room', '105');
        g.addNode('door_room_4_1_188', 1, 4, 43.2, -45.4, 'door', 'Дверь (43.2, -45.4)');
        g.addNode('room_4_1_189', 1, 4, 43.4, -39.8, 'room', '3');
        g.addNode('door_room_4_1_189', 1, 4, 43.4, -42.4, 'door', 'Дверь (43.4, -42.4)');
        g.addNode('b4_f1_c414_489', 1, 4, 41.4, -48.9, 'corridor', 'Коридор (41.4, -48.9)');
        g.addNode('b4_f1_c414_512', 1, 4, 41.4, -51.2, 'corridor', 'Коридор (41.4, -51.2)');
        g.addNode('b4_f1_c414_526', 1, 4, 41.4, -52.6, 'corridor', 'Коридор (41.4, -52.6)');
        g.addNode('b4_f1_c414_540', 1, 4, 41.4, -54.0, 'corridor', 'Коридор (41.4, -54.0)');
        g.addNode('b4_f1_c414_551', 1, 4, 41.4, -55.1, 'corridor', 'Коридор (41.4, -55.1)');
        g.addNode('b4_f1_c414_556', 1, 4, 41.4, -55.6, 'corridor', 'Коридор (41.4, -55.6)');
        g.addNode('b4_f1_c414_572', 1, 4, 41.4, -57.2, 'corridor', 'Коридор (41.4, -57.2)');
        g.addNode('b4_f1_c414_581', 1, 4, 41.4, -58.1, 'corridor', 'Коридор (41.4, -58.1)');
        g.addNode('b4_f1_c414_593', 1, 4, 41.4, -59.3, 'corridor', 'Коридор (41.4, -59.3)');
        g.addNode('room_4_1_198', 1, 4, 37.8, -48.6, 'room', '4');
        g.addNode('door_room_4_1_198', 1, 4, 40.4, -48.9, 'door', 'Дверь (40.4, -48.9)');
        g.addNode('room_4_1_199', 1, 4, 37.7, -51.1, 'room', '5');
        g.addNode('door_room_4_1_199', 1, 4, 40.4, -51.2, 'door', 'Дверь (40.4, -51.2)');
        g.addNode('room_4_1_200', 1, 4, 37.7, -52.5, 'room', '6');
        g.addNode('door_room_4_1_200', 1, 4, 40.4, -52.6, 'door', 'Дверь (40.4, -52.6)');
        g.addNode('room_4_1_201', 1, 4, 37.7, -54.0, 'room', '7');
        g.addNode('door_room_4_1_201', 1, 4, 40.4, -54.0, 'door', 'Дверь (40.4, -54.0)');
        g.addNode('room_4_1_202', 1, 4, 37.8, -55.6, 'room', '8');
        g.addNode('door_room_4_1_202', 1, 4, 40.4, -55.6, 'door', 'Дверь (40.4, -55.6)');
        g.addNode('room_4_1_203', 1, 4, 37.8, -57.3, 'room', '9');
        g.addNode('door_room_4_1_203', 1, 4, 40.4, -57.2, 'door', 'Дверь (40.4, -57.2)');
        g.addNode('room_4_1_204', 1, 4, 37.8, -59.3, 'room', '10');
        g.addNode('door_room_4_1_204', 1, 4, 40.4, -59.3, 'door', 'Дверь (40.4, -59.3)');
        g.addNode('room_4_1_190', 1, 4, 43.4, -47.6, 'room', '11');
        g.addNode('door_room_4_1_190', 1, 4, 42.4, -46.3, 'door', 'Дверь (42.4, -46.3)');
        g.addNode('room_4_1_191', 1, 4, 43.4, -52.0, 'room', '12');
        g.addNode('door_room_4_1_191', 1, 4, 42.4, -52.3, 'door', 'Дверь (42.4, -52.3)');
        g.addNode('room_4_1_205', 1, 4, 43.4, -58.2, 'room', '13');
        g.addNode('door_room_4_1_205', 1, 4, 42.4, -58.1, 'door', 'Дверь (42.4, -58.1)');
        g.addNode('b4_f1_kc_450', 1, 4, 45.0, -55.1, 'corridor', 'Коридор (45.0, -55.1)');
        g.addNode('b4_f1_kc_469', 1, 4, 46.9, -55.1, 'corridor', 'Коридор (46.9, -55.1)');
        g.addNode('b4_f1_kc_503', 1, 4, 50.3, -55.1, 'corridor', 'Коридор (50.3, -55.1)');
        g.addNode('b4_f1_kc_537', 1, 4, 53.7, -55.1, 'corridor', 'Коридор (53.7, -55.1)');
        g.addNode('b4_f1_kc_544', 1, 4, 54.4, -55.1, 'corridor', 'Коридор (54.4, -55.1)');
        g.addNode('b4_f1_kc_565_551', 1, 4, 56.5, -55.1, 'corridor', 'Коридор (56.5, -55.1)');
        g.addNode('b4_f1_kc_565_521', 1, 4, 56.5, -52.1, 'corridor', 'Коридор (56.5, -52.1)');
        g.addNode('b4_f1_kc_565_475', 1, 4, 56.5, -47.5, 'corridor', 'Коридор (56.5, -47.5)');
        g.addNode('b4_f1_kc_565_581', 1, 4, 56.5, -58.1, 'corridor', 'Коридор (56.5, -58.1)');
        g.addNode('room_4_1_192', 1, 4, 50.3, -47.6, 'room', '14');
        g.addNode('door_room_4_1_192_east', 1, 4, 55.6, -47.5, 'door', 'Дверь (55.6, -47.5)');
        g.addNode('room_4_1_193', 1, 4, 46.8, -52.0, 'room', '15');
        g.addNode('door_room_4_1_193', 1, 4, 46.7, -54.2, 'door', 'Дверь (46.7, -54.2)');
        g.addNode('room_4_1_194', 1, 4, 50.3, -52.0, 'room', '16');
        g.addNode('door_room_4_1_194', 1, 4, 50.3, -54.2, 'door', 'Дверь (50.3, -54.2)');
        g.addNode('room_4_1_195', 1, 4, 53.8, -52.0, 'room', '17');
        g.addNode('door_room_4_1_195', 1, 4, 53.7, -54.2, 'door', 'Дверь (53.7, -54.2)');
        g.addNode('room_4_1_206', 1, 4, 46.8, -58.2, 'room', '20');
        g.addNode('door_room_4_1_206', 1, 4, 46.9, -56.0, 'door', 'Дверь (46.9, -56.0)');
        g.addNode('door_room_4_1_206_207', 1, 4, 48.5, -58.1, 'door', 'Дверь (48.5, -58.1)');
        g.addNode('room_4_1_207', 1, 4, 50.3, -58.2, 'room', '21');
        g.addNode('door_room_4_1_207', 1, 4, 50.3, -56.0, 'door', 'Дверь (50.3, -56.0)');
        g.addNode('room_4_1_208', 1, 4, 54.8, -57.3, 'room', '24');
        g.addNode('door_room_4_1_208', 1, 4, 54.4, -56.0, 'door', 'Дверь (54.4, -56.0)');
        g.addNode('room_4_1_209', 1, 4, 59.6, -58.2, 'room', '22');
        g.addNode('door_room_4_1_209', 1, 4, 57.6, -58.1, 'door', 'Дверь (57.6, -58.1)');
        g.addNode('room_4_1_210', 1, 4, 59.6, -55.1, 'room', '23');
        g.addNode('door_room_4_1_210', 1, 4, 57.6, -55.2, 'door', 'Дверь (57.6, -55.2)');
        g.addNode('room_4_1_196', 1, 4, 59.6, -47.6, 'room', '18');
        g.addNode('door_room_4_1_196', 1, 4, 57.6, -47.5, 'door', 'Дверь (57.6, -47.5)');
        g.addNode('room_4_1_197', 1, 4, 60.2, -52.0, 'room', '19');
        g.addNode('door_room_4_1_197', 1, 4, 59.6, -49.8, 'door', 'Дверь (59.6, -49.8)');
        g.addNode('custom_b4_f1_c_406_-322_sat', 1, 4, 40.6, -32.2, 'corridor', 'Коридор (40.6, -32.2)');
        g.addNode('custom_b4_f1_c_438_-321_ent', 1, 4, 43.8, -32.1, 'corridor', 'Вход в К4');

g.addNode('outdoor_node_86645', 1, 0, 21.3, -45.3, 'corridor', 'Улица');
        g.addNode('outdoor_node_90724', 1, 0, 21.6, -19.6, 'corridor', 'Улица');
        g.addNode('outdoor_node_78', 1, 0, 43.8, -19.4, 'corridor', 'Улица');
        g.addNode('outdoor_node_52241', 1, 0, 43.8, -32.1, 'corridor', 'Улица');
        g.addNode('outdoor_node_79023', 1, 0, 43.0, -14.8, 'corridor', 'Улица');
        g.addNode('outdoor_node_81120', 1, 0, 42.6, -11.0, 'corridor', 'Улица');
        g.addNode('outdoor_node_74046', 1, 0, 15.2, -28.6, 'corridor', 'Улица');

        // 2. СВЯЗИ МЕЖДУ УЗЛАМИ
        g.addEdge('b1_f5_nc_-6.0', 'b1_f5_nc_door_-5.8', 0.2);
        g.addEdge('b1_f5_nc_door_-5.8', 'b1_f5_nc_-3.0', 2.9);
        g.addEdge('b1_f5_nc_-3.0', 'b1_f5_nc_0.0', 3.0);
        g.addEdge('b1_f5_nc_-3.0', 'b1_f5_wc_-3.0', 2.8);
        g.addEdge('b1_f5_nc_0.0', 'b1_f5_nc_3.0', 3.0);
        g.addEdge('b1_f5_nc_0.0', 'door_corr_room_1_5_61', 0.4);
        g.addEdge('b1_f5_nc_3.0', 'b1_f5_nc_5.9', 2.9);
        g.addEdge('b1_f5_nc_3.0', 'door_corr_room_1_5_62', 2.5);
        g.addEdge('b1_f5_nc_5.9', 'b1_f5_nc_9.4', 3.5);
        g.addEdge('b1_f5_nc_5.9', 'door_corr_room_1_5_56', 1.5);
        g.addEdge('b1_f5_nc_9.4', 'b1_f5_nc_12.5', 3.1);
        g.addEdge('b1_f5_nc_9.4', 'b1_f5_stair_lk1', 3.9);
        g.addEdge('b1_f5_nc_9.4', 'door_corr_room_1_5_58', 1.6);
        g.addEdge('b1_f5_nc_9.4', 'door_corr_room_1_5_63', 1.5);
        g.addEdge('b1_f5_nc_12.5', 'b1_f5_nc_16.0', 3.1);
        g.addEdge('b1_f5_wc_-3.0', 'b1_f5_wc_0.0', 3.0);
        g.addEdge('b1_f5_wc_-3.0', 'door_corr_room_1_5_64', 2.8);
        g.addEdge('b1_f5_wc_0.0', 'b1_f5_wc_1.7', 1.7);
        g.addEdge('b1_f5_wc_1.7', 'b1_f5_wc_3.5', 1.8);
        g.addEdge('b1_f5_wc_1.7', 'b1_f5_elev', 4.8);
        g.addEdge('b1_f5_wc_1.7', 'door_corr_room_1_5_60', 1.4);
        g.addEdge('b1_f5_wc_3.5', 'b1_f5_wc_6.0', 2.5);
        g.addEdge('b1_f5_wc_3.5', 'door_corr_room_1_5_65', 2.5);
        g.addEdge('b1_f5_wc_6.0', 'b1_f5_sc_0.0', 3.0);
        g.addEdge('b1_f5_wc_6.0', 'door_corr_room_1_5_66', 1.3);
        g.addEdge('b1_f5_sc_0.0', 'b1_f5_sc_1.8', 1.8);
        g.addEdge('b1_f5_sc_0.0', 'door_corr_room_1_5_67', 0.9);
        g.addEdge('b1_f5_sc_1.8', 'b1_f5_sc_3.5', 1.7);
        g.addEdge('b1_f5_sc_3.5', 'b1_f5_sc_5.6', 2.1);
        g.addEdge('b1_f5_sc_5.6', 'b1_f5_sc_9.4', 3.8);
        g.addEdge('b1_f5_sc_5.6', 'door_corr_room_1_5_57', 1.6);
        g.addEdge('b1_f5_sc_9.4', 'b1_f5_sc_10.5', 1.1);
        g.addEdge('b1_f5_sc_9.4', 'b1_f5_stair_lk2', 4.1);
        g.addEdge('b1_f5_sc_9.4', 'door_corr_room_1_5_59', 1.8);
        g.addEdge('b1_f5_stair_lk1', 'b1_f6_stair_lk1', 5.5);
        g.addEdge('b1_f5_stair_lk2', 'b1_f6_stair_lk2', 5.5);
        g.addEdge('b1_f5_elev', 'b1_f6_elev', 4.0, true, { isElevator: true });
        g.addEdge('b1_f6_nc_-6.0', 'b1_f6_nc_door_-5.8', 0.2);
        g.addEdge('b1_f6_nc_door_-5.8', 'b1_f6_nc_-3.0', 2.9);
        g.addEdge('b1_f6_nc_-3.0', 'b1_f6_nc_0.0', 3.0);
        g.addEdge('b1_f6_nc_-3.0', 'b1_f6_wc_-3.0', 2.8);
        g.addEdge('b1_f6_nc_0.0', 'b1_f6_nc_3.0', 3.0);
        g.addEdge('b1_f6_nc_0.0', 'door_corr_room_1_6_73', 0.4);
        g.addEdge('b1_f6_nc_3.0', 'b1_f6_nc_5.9', 2.9);
        g.addEdge('b1_f6_nc_3.0', 'door_corr_room_1_6_74', 2.5);
        g.addEdge('b1_f6_nc_5.9', 'b1_f6_nc_9.4', 3.5);
        g.addEdge('b1_f6_nc_5.9', 'door_corr_room_1_6_68', 1.5);
        g.addEdge('b1_f6_nc_9.4', 'b1_f6_nc_12.5', 3.1);
        g.addEdge('b1_f6_nc_9.4', 'b1_f6_stair_lk1', 3.9);
        g.addEdge('b1_f6_nc_9.4', 'door_corr_room_1_6_70', 1.6);
        g.addEdge('b1_f6_nc_9.4', 'door_corr_room_1_6_75', 1.5);
        g.addEdge('b1_f6_nc_12.5', 'b1_f6_nc_16.0', 3.1);
        g.addEdge('b1_f6_wc_-3.0', 'b1_f6_wc_0.0', 3.0);
        g.addEdge('b1_f6_wc_-3.0', 'door_corr_room_1_6_76', 2.8);
        g.addEdge('b1_f6_wc_0.0', 'b1_f6_wc_1.7', 1.7);
        g.addEdge('b1_f6_wc_1.7', 'b1_f6_wc_3.5', 1.8);
        g.addEdge('b1_f6_wc_1.7', 'b1_f6_elev', 4.8);
        g.addEdge('b1_f6_wc_1.7', 'door_corr_room_1_6_72', 1.4);
        g.addEdge('b1_f6_wc_3.5', 'b1_f6_wc_6.0', 2.5);
        g.addEdge('b1_f6_wc_3.5', 'door_corr_room_1_6_77', 2.5);
        g.addEdge('b1_f6_wc_6.0', 'b1_f6_sc_0.0', 3.0);
        g.addEdge('b1_f6_wc_6.0', 'door_corr_room_1_6_78', 1.3);
        g.addEdge('b1_f6_sc_0.0', 'b1_f6_sc_1.8', 1.8);
        g.addEdge('b1_f6_sc_0.0', 'door_corr_room_1_6_79', 0.9);
        g.addEdge('b1_f6_sc_1.8', 'b1_f6_sc_3.5', 1.7);
        g.addEdge('b1_f6_sc_3.5', 'b1_f6_sc_5.6', 2.1);
        g.addEdge('b1_f6_sc_5.6', 'b1_f6_sc_9.4', 3.8);
        g.addEdge('b1_f6_sc_5.6', 'door_corr_room_1_6_69', 1.6);
        g.addEdge('b1_f6_sc_9.4', 'b1_f6_sc_10.5', 1.1);
        g.addEdge('b1_f6_sc_9.4', 'b1_f6_stair_lk2', 4.1);
        g.addEdge('b1_f6_sc_9.4', 'door_corr_room_1_6_71', 1.8);
        g.addEdge('b1_f6_sc_9.4', 'door_corr_room_1_6_80', 0.9);
        g.addEdge('b1_f6_stair_lk1', 'b1_f7_stair_lk1', 5.5);
        g.addEdge('b1_f6_stair_lk2', 'b1_f7_stair_lk2', 5.5);
        g.addEdge('b1_f6_elev', 'b1_f7_elev', 4.0, true, { isElevator: true });
        g.addEdge('b1_f7_nc_-6.0', 'b1_f7_nc_door_-5.8', 0.2);
        g.addEdge('b1_f7_nc_door_-5.8', 'b1_f7_nc_-3.0', 2.9);
        g.addEdge('b1_f7_nc_-3.0', 'b1_f7_nc_0.0', 3.0);
        g.addEdge('b1_f7_nc_-3.0', 'b1_f7_wc_-3.0', 2.8);
        g.addEdge('b1_f7_nc_-3.0', 'door_corr_room_1_7_86', 0.4);
        g.addEdge('b1_f7_nc_0.0', 'b1_f7_nc_3.0', 3.0);
        g.addEdge('b1_f7_nc_0.0', 'door_corr_room_1_7_87', 2.6);
        g.addEdge('b1_f7_nc_3.0', 'b1_f7_nc_5.9', 2.9);
        g.addEdge('b1_f7_nc_5.9', 'b1_f7_nc_9.4', 3.5);
        g.addEdge('b1_f7_nc_5.9', 'door_corr_room_1_7_81', 1.5);
        g.addEdge('b1_f7_nc_9.4', 'b1_f7_nc_12.5', 3.1);
        g.addEdge('b1_f7_nc_9.4', 'b1_f7_stair_lk1', 3.9);
        g.addEdge('b1_f7_nc_9.4', 'door_corr_room_1_7_83', 1.6);
        g.addEdge('b1_f7_nc_9.4', 'door_corr_room_1_7_88', 1.5);
        g.addEdge('b1_f7_nc_12.5', 'b1_f7_nc_16.0', 3.1);
        g.addEdge('b1_f7_wc_-3.0', 'b1_f7_wc_0.0', 3.0);
        g.addEdge('b1_f7_wc_-3.0', 'door_corr_room_1_7_89', 2.8);
        g.addEdge('b1_f7_wc_0.0', 'b1_f7_wc_1.7', 1.7);
        g.addEdge('b1_f7_wc_1.7', 'b1_f7_wc_3.5', 1.8);
        g.addEdge('b1_f7_wc_1.7', 'b1_f7_elev', 4.8);
        g.addEdge('b1_f7_wc_1.7', 'door_corr_room_1_7_85', 1.4);
        g.addEdge('b1_f7_wc_3.5', 'b1_f7_wc_6.0', 2.5);
        g.addEdge('b1_f7_wc_3.5', 'door_corr_room_1_7_90', 2.4);
        g.addEdge('b1_f7_wc_6.0', 'b1_f7_sc_0.0', 3.0);
        g.addEdge('b1_f7_wc_6.0', 'door_corr_room_1_7_91', 1.3);
        g.addEdge('b1_f7_sc_0.0', 'b1_f7_sc_1.8', 1.8);
        g.addEdge('b1_f7_sc_0.0', 'door_corr_room_1_7_92', 0.9);
        g.addEdge('b1_f7_sc_1.8', 'b1_f7_sc_3.5', 1.7);
        g.addEdge('b1_f7_sc_3.5', 'b1_f7_sc_5.6', 2.1);
        g.addEdge('b1_f7_sc_5.6', 'b1_f7_sc_9.4', 3.8);
        g.addEdge('b1_f7_sc_5.6', 'door_corr_room_1_7_82', 1.6);
        g.addEdge('b1_f7_sc_9.4', 'b1_f7_sc_10.5', 1.1);
        g.addEdge('b1_f7_sc_9.4', 'b1_f7_stair_lk2', 4.1);
        g.addEdge('b1_f7_sc_9.4', 'door_corr_room_1_7_84', 1.8);
        g.addEdge('room_1_5_56', 'door_room_room_1_5_56', 1.1);
        g.addEdge('door_mid_room_1_5_56', 'door_room_room_1_5_56', 0.4);
        g.addEdge('door_mid_room_1_5_56', 'door_corr_room_1_5_56', 0.4);
        g.addEdge('room_1_5_57', 'door_room_room_1_5_57', 2.3);
        g.addEdge('door_mid_room_1_5_57', 'door_room_room_1_5_57', 0.4);
        g.addEdge('door_mid_room_1_5_57', 'door_corr_room_1_5_57', 0.4);
        g.addEdge('room_1_5_58', 'door_room_room_1_5_58', 1.5);
        g.addEdge('door_mid_room_1_5_58', 'door_room_room_1_5_58', 0.4);
        g.addEdge('door_mid_room_1_5_58', 'door_corr_room_1_5_58', 0.4);
        g.addEdge('room_1_5_59', 'door_room_room_1_5_59', 1.5);
        g.addEdge('door_mid_room_1_5_59', 'door_room_room_1_5_59', 0.4);
        g.addEdge('door_mid_room_1_5_59', 'door_corr_room_1_5_59', 0.4);
        g.addEdge('room_1_5_60', 'door_room_room_1_5_60', 2.6);
        g.addEdge('door_mid_room_1_5_60', 'door_room_room_1_5_60', 0.4);
        g.addEdge('door_mid_room_1_5_60', 'door_corr_room_1_5_60', 0.4);
        g.addEdge('room_1_5_61', 'door_room_room_1_5_61', 5.2);
        g.addEdge('door_mid_room_1_5_61', 'door_room_room_1_5_61', 0.4);
        g.addEdge('door_mid_room_1_5_61', 'door_corr_room_1_5_61', 0.4);
        g.addEdge('room_1_5_62', 'door_room_room_1_5_62', 2.4);
        g.addEdge('door_mid_room_1_5_62', 'door_room_room_1_5_62', 0.4);
        g.addEdge('door_mid_room_1_5_62', 'door_corr_room_1_5_62', 0.4);
        g.addEdge('room_1_5_63', 'door_room_room_1_5_63', 4.5);
        g.addEdge('door_mid_room_1_5_63', 'door_room_room_1_5_63', 0.4);
        g.addEdge('door_mid_room_1_5_63', 'door_corr_room_1_5_63', 0.4);
        g.addEdge('room_1_5_64', 'door_room_room_1_5_64', 3.7);
        g.addEdge('door_mid_room_1_5_64', 'door_room_room_1_5_64', 0.4);
        g.addEdge('door_mid_room_1_5_64', 'door_corr_room_1_5_64', 0.4);
        g.addEdge('room_1_5_65', 'door_room_room_1_5_65', 5.6);
        g.addEdge('door_mid_room_1_5_65', 'door_room_room_1_5_65', 0.4);
        g.addEdge('door_mid_room_1_5_65', 'door_corr_room_1_5_65', 0.4);
        g.addEdge('room_1_5_66', 'door_room_room_1_5_66', 3.2);
        g.addEdge('door_mid_room_1_5_66', 'door_room_room_1_5_66', 0.4);
        g.addEdge('door_mid_room_1_5_66', 'door_corr_room_1_5_66', 0.4);
        g.addEdge('room_1_5_67', 'door_room_room_1_5_67', 6.4);
        g.addEdge('door_mid_room_1_5_67', 'door_room_room_1_5_67', 0.4);
        g.addEdge('door_mid_room_1_5_67', 'door_corr_room_1_5_67', 0.4);
        g.addEdge('room_1_6_68', 'door_room_room_1_6_68', 1.1);
        g.addEdge('door_mid_room_1_6_68', 'door_room_room_1_6_68', 0.4);
        g.addEdge('door_mid_room_1_6_68', 'door_corr_room_1_6_68', 0.4);
        g.addEdge('room_1_6_69', 'door_room_room_1_6_69', 2.3);
        g.addEdge('door_mid_room_1_6_69', 'door_room_room_1_6_69', 0.4);
        g.addEdge('door_mid_room_1_6_69', 'door_corr_room_1_6_69', 0.4);
        g.addEdge('room_1_6_70', 'door_room_room_1_6_70', 1.5);
        g.addEdge('door_mid_room_1_6_70', 'door_room_room_1_6_70', 0.4);
        g.addEdge('door_mid_room_1_6_70', 'door_corr_room_1_6_70', 0.4);
        g.addEdge('room_1_6_71', 'door_room_room_1_6_71', 1.5);
        g.addEdge('door_mid_room_1_6_71', 'door_room_room_1_6_71', 0.4);
        g.addEdge('door_mid_room_1_6_71', 'door_corr_room_1_6_71', 0.4);
        g.addEdge('room_1_6_72', 'door_room_room_1_6_72', 2.6);
        g.addEdge('door_mid_room_1_6_72', 'door_room_room_1_6_72', 0.4);
        g.addEdge('door_mid_room_1_6_72', 'door_corr_room_1_6_72', 0.4);
        g.addEdge('room_1_6_73', 'door_room_room_1_6_73', 5.2);
        g.addEdge('door_mid_room_1_6_73', 'door_room_room_1_6_73', 0.4);
        g.addEdge('door_mid_room_1_6_73', 'door_corr_room_1_6_73', 0.4);
        g.addEdge('room_1_6_74', 'door_room_room_1_6_74', 2.4);
        g.addEdge('door_mid_room_1_6_74', 'door_room_room_1_6_74', 0.4);
        g.addEdge('door_mid_room_1_6_74', 'door_corr_room_1_6_74', 0.4);
        g.addEdge('room_1_6_75', 'door_room_room_1_6_75', 4.5);
        g.addEdge('door_mid_room_1_6_75', 'door_room_room_1_6_75', 0.4);
        g.addEdge('door_mid_room_1_6_75', 'door_corr_room_1_6_75', 0.4);
        g.addEdge('room_1_6_76', 'door_room_room_1_6_76', 3.7);
        g.addEdge('door_mid_room_1_6_76', 'door_room_room_1_6_76', 0.4);
        g.addEdge('door_mid_room_1_6_76', 'door_corr_room_1_6_76', 0.4);
        g.addEdge('room_1_6_77', 'door_room_room_1_6_77', 5.6);
        g.addEdge('door_mid_room_1_6_77', 'door_room_room_1_6_77', 0.4);
        g.addEdge('door_mid_room_1_6_77', 'door_corr_room_1_6_77', 0.4);
        g.addEdge('room_1_6_78', 'door_room_room_1_6_78', 3.2);
        g.addEdge('door_mid_room_1_6_78', 'door_room_room_1_6_78', 0.4);
        g.addEdge('door_mid_room_1_6_78', 'door_corr_room_1_6_78', 0.4);
        g.addEdge('room_1_6_79', 'door_room_room_1_6_79', 4.8);
        g.addEdge('door_mid_room_1_6_79', 'door_room_room_1_6_79', 0.4);
        g.addEdge('door_mid_room_1_6_79', 'door_corr_room_1_6_79', 0.4);
        g.addEdge('room_1_6_80', 'door_room_room_1_6_80', 3.3);
        g.addEdge('door_mid_room_1_6_80', 'door_room_room_1_6_80', 0.4);
        g.addEdge('door_mid_room_1_6_80', 'door_corr_room_1_6_80', 0.4);
        g.addEdge('room_1_7_81', 'door_room_room_1_7_81', 1.1);
        g.addEdge('door_mid_room_1_7_81', 'door_room_room_1_7_81', 0.4);
        g.addEdge('door_mid_room_1_7_81', 'door_corr_room_1_7_81', 0.4);
        g.addEdge('room_1_7_82', 'door_room_room_1_7_82', 2.3);
        g.addEdge('door_mid_room_1_7_82', 'door_room_room_1_7_82', 0.4);
        g.addEdge('door_mid_room_1_7_82', 'door_corr_room_1_7_82', 0.4);
        g.addEdge('room_1_7_83', 'door_room_room_1_7_83', 1.5);
        g.addEdge('door_mid_room_1_7_83', 'door_room_room_1_7_83', 0.4);
        g.addEdge('door_mid_room_1_7_83', 'door_corr_room_1_7_83', 0.4);
        g.addEdge('room_1_7_84', 'door_room_room_1_7_84', 1.5);
        g.addEdge('door_mid_room_1_7_84', 'door_room_room_1_7_84', 0.4);
        g.addEdge('door_mid_room_1_7_84', 'door_corr_room_1_7_84', 0.4);
        g.addEdge('room_1_7_85', 'door_room_room_1_7_85', 2.6);
        g.addEdge('door_mid_room_1_7_85', 'door_room_room_1_7_85', 0.4);
        g.addEdge('door_mid_room_1_7_85', 'door_corr_room_1_7_85', 0.4);
        g.addEdge('room_1_7_86', 'door_room_room_1_7_86', 5.1);
        g.addEdge('door_mid_room_1_7_86', 'door_room_room_1_7_86', 0.4);
        g.addEdge('door_mid_room_1_7_86', 'door_corr_room_1_7_86', 0.4);
        g.addEdge('room_1_7_87', 'door_room_room_1_7_87', 2.2);
        g.addEdge('door_mid_room_1_7_87', 'door_room_room_1_7_87', 0.4);
        g.addEdge('door_mid_room_1_7_87', 'door_corr_room_1_7_87', 0.4);
        g.addEdge('room_1_7_88', 'door_room_room_1_7_88', 4.5);
        g.addEdge('door_mid_room_1_7_88', 'door_room_room_1_7_88', 0.4);
        g.addEdge('door_mid_room_1_7_88', 'door_corr_room_1_7_88', 0.4);
        g.addEdge('room_1_7_89', 'door_room_room_1_7_89', 3.7);
        g.addEdge('door_mid_room_1_7_89', 'door_room_room_1_7_89', 0.4);
        g.addEdge('door_mid_room_1_7_89', 'door_corr_room_1_7_89', 0.4);
        g.addEdge('room_1_7_90', 'door_room_room_1_7_90', 5.4);
        g.addEdge('door_mid_room_1_7_90', 'door_room_room_1_7_90', 0.4);
        g.addEdge('door_mid_room_1_7_90', 'door_corr_room_1_7_90', 0.4);
        g.addEdge('room_1_7_91', 'door_room_room_1_7_91', 3.2);
        g.addEdge('door_mid_room_1_7_91', 'door_room_room_1_7_91', 0.4);
        g.addEdge('door_mid_room_1_7_91', 'door_corr_room_1_7_91', 0.4);
        g.addEdge('room_1_7_92', 'door_room_room_1_7_92', 4.5);
        g.addEdge('door_mid_room_1_7_92', 'door_room_room_1_7_92', 0.4);
        g.addEdge('door_mid_room_1_7_92', 'door_corr_room_1_7_92', 0.4);
        g.addEdge('b1_f3_nc_-3.0', 'b1_f3_nc_0.0', 3.0);
        g.addEdge('b1_f3_nc_-3.0', 'b1_f3_wc_-3.0', 2.8);
        g.addEdge('b1_f3_nc_0.0', 'b1_f3_nc_3.0', 3.0);
        g.addEdge('b1_f3_nc_0.0', 'door_corr_room_1_3_36', 0.4);
        // убран ошибочный сквозной проход сквозь глухую стену z = -6.2 в 303А
        g.addEdge('b1_f3_nc_3.0', 'b1_f3_nc_5.9', 2.9);
        g.addEdge('b1_f3_nc_5.9', 'door_corr_room_1_3_31', 1.5);
        g.addEdge('b1_f3_nc_5.9', 'door_corr_room_1_3_38', 2.0);
        g.addEdge('b1_f3_nc_5.9', 'b1_f3_nc_9.4', 3.5);
        g.addEdge('b1_f3_nc_9.4', 'b1_f3_nc_12.5', 3.1);
        g.addEdge('b1_f3_nc_9.4', 'b1_f3_stair_lk1', 3.9);
        g.addEdge('b1_f3_nc_12.5', 'b1_f3_nc_16.0', 3.1);
        g.addEdge('b1_f3_stair_lk1', 'room_1_3_33', 0.2);
        g.addEdge('b1_f3_nc_16.0', 'door_corr_room_1_3_39', 0.8);
        g.addEdge('door_corr_room_1_3_39', 'door_mid_room_1_3_39', 0.4);
        g.addEdge('door_mid_room_1_3_39', 'door_room_room_1_3_39', 0.4);
        g.addEdge('door_room_room_1_3_39', 'room_1_3_39', 1.9);
        g.addEdge('b1_f3_wc_-3.0', 'b1_f3_wc_0.0', 3.0);
        g.addEdge('b1_f3_wc_-3.0', 'door_corr_room_1_3_40', 2.8);
        g.addEdge('b1_f3_wc_0.0', 'b1_f3_wc_1.7', 1.7);
        g.addEdge('b1_f3_wc_1.7', 'b1_f3_wc_3.5', 1.8);
        g.addEdge('b1_f3_wc_1.7', 'b1_f3_elev', 4.8);
        g.addEdge('b1_f3_wc_1.7', 'door_corr_room_1_3_35', 1.4);
        g.addEdge('b1_f3_wc_3.5', 'b1_f3_wc_6.0', 2.5);
        g.addEdge('b1_f3_wc_3.5', 'door_corr_room_1_3_41', 2.5);
        g.addEdge('b1_f3_wc_6.0', 'b1_f3_sc_0.0', 3.0);
        g.addEdge('b1_f3_wc_6.0', 'door_corr_room_1_3_42', 1.3);
        g.addEdge('b1_f3_sc_0.0', 'b1_f3_sc_1.8', 1.8);
        g.addEdge('b1_f3_sc_0.0', 'door_corr_room_1_3_43', 0.9);
        g.addEdge('b1_f3_sc_1.8', 'b1_f3_sc_3.5', 1.7);
        g.addEdge('b1_f3_sc_3.5', 'b1_f3_sc_5.6', 2.1);
        g.addEdge('b1_f3_sc_5.6', 'b1_f3_sc_9.4', 3.8);
        g.addEdge('b1_f3_sc_5.6', 'door_corr_room_1_3_32', 1.6);
        g.addEdge('b1_f3_sc_9.4', 'b1_f3_sc_10.5', 1.1);
        g.addEdge('b1_f3_sc_9.4', 'b1_f3_stair_lk2', 4.1);
        g.addEdge('b1_f3_sc_9.4', 'door_corr_room_1_3_34', 1.8);
        g.addEdge('b2_f3_c_22.6', 'b2_f3_c_26.0', 1.6);
        g.addEdge('b2_f3_c_22.6', 'b2_f3_d_308', 0.8);
        g.addEdge('b2_f3_d_308', 'b2_f3_c_308_hall', 1.2);
        g.addEdge('b2_f3_c_308_hall', 'door_corr_room_2_3_123', 2.6);
        g.addEdge('b2_f3_c_26.0', 'b2_f3_c_30.0', 4.0);
        g.addEdge('b2_f3_c_26.0', 'door_corr_room_2_3_124', 1.6);
        g.addEdge('b2_f3_c_30.0', 'b2_f3_c_34.0', 4.0);
        g.addEdge('b2_f3_c_30.0', 'door_corr_room_2_3_125', 1.1);
        g.addEdge('b2_f3_c_34.0', 'b2_f3_c_37.5', 3.5);
        g.addEdge('b2_f3_c_34.0', 'door_corr_room_2_3_126', 1.0);
        g.addEdge('b2_f3_c_37.5', 'b2_f3_c_41.0', 3.5);
        g.addEdge('b2_f3_c_37.5', 'door_corr_room_2_3_127', 1.1);
        g.addEdge('b2_f3_c_37.5', 'door_corr_room_2_3_135', 1.5);
        g.addEdge('b2_f3_c_41.0', 'b2_f3_c_43.6', 2.6);
        g.addEdge('b2_f3_c_41.0', 'door_corr_room_2_3_128', 1.7);
        g.addEdge('b2_f3_c_41.0', 'door_corr_room_2_3_129', 1.0);
        g.addEdge('b2_f3_c_43.6', 'b2_f3_c_47.0', 3.4);
        g.addEdge('b2_f3_c_43.6', 'b2_f3_stair_lk2', 4.7);
        g.addEdge('b2_f3_c_43.6', 'door_corr_room_2_3_130', 1.6);
        g.addEdge('b2_f3_c_47.0', 'b2_f3_c_51.0', 4.0);
        g.addEdge('b2_f3_c_47.0', 'door_corr_room_2_3_136', 1.0);
        g.addEdge('b2_f3_c_51.0', 'b2_f3_c_55.0', 4.0);
        g.addEdge('b2_f3_c_51.0', 'door_corr_room_2_3_131', 1.2);
        g.addEdge('b2_f3_c_55.0', 'b2_f3_c_59.0', 4.0);
        g.addEdge('b2_f3_c_59.0', 'b2_f3_c_63.0', 4.0);
        g.addEdge('b2_f3_c_59.0', 'door_corr_room_2_3_132', 2.1);
        g.addEdge('b2_f3_c_63.0', 'b2_f3_c_66.1', 3.1);
        g.addEdge('b2_f3_c_63.0', 'door_corr_room_2_3_133', 1.1);
        g.addEdge('b2_f3_c_63.0', 'door_corr_room_2_3_134', 0.8);
        g.addEdge('b2_f3_c_63.0', 'door_corr_room_2_3_137', 1.2);
        g.addEdge('b2_f3_c_66.1', 'b2_f3_stair_lk1', 4.7);
        g.addEdge('b2_f3_c_66.1', 'door_mid_room_2_3_134', 1.9);
        g.addEdge('b2_f3_c_66.1', 'custom_b2_f3_c_670_-58_0u0', 0.9);
        g.addEdge('b4_f3_stair_lk1', 'b4_f3_stair_lk1_door', 3.4);
        g.addEdge('b4_f3_stair_lk2', 'b4_f3_stair_lk2_door', 2.3);
        g.addEdge('b4_f3_stair_lk2_door', 'custom_b4_f3_c_347_-482_3dk', 2.3);
        g.addEdge('b4_f3_stair_lk3', 'b4_f3_stair_lk3_door', 3.6);
        g.addEdge('b4_f3_sw_-38.0', 'door_room_4_3_232', 2.5);
        g.addEdge('b4_f3_sw_-38.0', 'door_corr_room_4_3_245', 0.3);
        g.addEdge('b4_f3_sw_-38.0', 'custom_b4_f3_c_375_-388_7pq', 0.8);
        g.addEdge('room_1_3_31', 'door_room_room_1_3_31', 1.1);
        g.addEdge('door_mid_room_1_3_31', 'door_room_room_1_3_31', 0.4);
        g.addEdge('door_mid_room_1_3_31', 'door_corr_room_1_3_31', 0.4);
        g.addEdge('room_1_3_32', 'door_room_room_1_3_32', 2.3);
        g.addEdge('door_mid_room_1_3_32', 'door_room_room_1_3_32', 0.4);
        g.addEdge('door_mid_room_1_3_32', 'door_corr_room_1_3_32', 0.4);
        g.addEdge('room_1_3_33', 'door_room_room_1_3_33', 1.5);
        g.addEdge('door_mid_room_1_3_33', 'door_room_room_1_3_33', 0.4);
        g.addEdge('door_mid_room_1_3_33', 'custom_b1_f3_c_96_-47_h5d', 0.9);
        g.addEdge('room_1_3_34', 'door_room_room_1_3_34', 1.5);
        g.addEdge('door_mid_room_1_3_34', 'door_room_room_1_3_34', 0.4);
        g.addEdge('door_mid_room_1_3_34', 'door_corr_room_1_3_34', 0.4);
        g.addEdge('room_1_3_35', 'door_room_room_1_3_35', 2.6);
        g.addEdge('door_mid_room_1_3_35', 'door_room_room_1_3_35', 0.4);
        g.addEdge('door_mid_room_1_3_35', 'door_corr_room_1_3_35', 0.4);
        g.addEdge('room_1_3_36', 'door_room_room_1_3_36', 5.2);
        g.addEdge('door_mid_room_1_3_36', 'door_room_room_1_3_36', 0.4);
        g.addEdge('door_mid_room_1_3_36', 'door_corr_room_1_3_36', 0.4);
        g.addEdge('door_room_room_1_3_36', 'custom_b1_f3_c_-5_-73_y4d', 0.7);
        g.addEdge('room_1_3_37', 'door_room_room_1_3_37', 2.4);
        g.addEdge('door_mid_room_1_3_37', 'door_room_room_1_3_37', 0.4);
        g.addEdge('door_mid_room_1_3_37', 'door_corr_room_1_3_37', 0.4);
        g.addEdge('door_corr_room_1_3_37', 'custom_b1_f3_c_35_-74_vve', 0.8);
        g.addEdge('room_1_3_38', 'custom_b1_f3_d_79_-70_b05', 4.2);
        g.addEdge('door_mid_room_1_3_38', 'custom_b1_f3_d_79_-70_b05', 0.8);
        g.addEdge('door_mid_room_1_3_38', 'door_corr_room_1_3_38', 0.4);
        g.addEdge('room_1_3_40', 'door_room_room_1_3_40', 3.7);
        g.addEdge('door_mid_room_1_3_40', 'door_room_room_1_3_40', 0.4);
        g.addEdge('door_mid_room_1_3_40', 'door_corr_room_1_3_40', 0.4);
        g.addEdge('room_1_3_41', 'door_room_room_1_3_41', 5.6);
        g.addEdge('door_mid_room_1_3_41', 'door_room_room_1_3_41', 0.4);
        g.addEdge('door_mid_room_1_3_41', 'door_corr_room_1_3_41', 0.4);
        g.addEdge('room_1_3_42', 'door_room_room_1_3_42', 3.2);
        g.addEdge('door_mid_room_1_3_42', 'door_room_room_1_3_42', 0.4);
        g.addEdge('door_mid_room_1_3_42', 'door_corr_room_1_3_42', 0.4);
        g.addEdge('room_1_3_43', 'door_room_room_1_3_43', 6.4);
        g.addEdge('door_mid_room_1_3_43', 'door_room_room_1_3_43', 0.4);
        g.addEdge('door_mid_room_1_3_43', 'door_corr_room_1_3_43', 0.4);
        g.addEdge('room_2_3_123', 'door_room_room_2_3_123', 4.4);
        g.addEdge('door_mid_room_2_3_123', 'door_room_room_2_3_123', 0.4);
        g.addEdge('door_mid_room_2_3_123', 'door_corr_room_2_3_123', 0.4);
        g.addEdge('door_corr_room_2_3_123', 'room_2_3_135', 9.9);
        g.addEdge('room_2_3_124', 'door_room_room_2_3_124', 2.9);
        g.addEdge('door_mid_room_2_3_124', 'door_room_room_2_3_124', 0.4);
        g.addEdge('door_mid_room_2_3_124', 'door_corr_room_2_3_124', 0.4);
        g.addEdge('room_2_3_125', 'door_room_room_2_3_125', 2.9);
        g.addEdge('door_mid_room_2_3_125', 'door_room_room_2_3_125', 0.4);
        g.addEdge('door_mid_room_2_3_125', 'door_corr_room_2_3_125', 0.4);
        g.addEdge('room_2_3_126', 'door_room_room_2_3_126', 2.9);
        g.addEdge('door_mid_room_2_3_126', 'door_room_room_2_3_126', 0.4);
        g.addEdge('door_mid_room_2_3_126', 'door_corr_room_2_3_126', 0.4);
        g.addEdge('room_2_3_127', 'door_room_room_2_3_127', 2.9);
        g.addEdge('door_mid_room_2_3_127', 'door_room_room_2_3_127', 0.4);
        g.addEdge('door_mid_room_2_3_127', 'door_corr_room_2_3_127', 0.4);
        g.addEdge('room_2_3_128', 'door_room_room_2_3_128', 0.3);
        g.addEdge('door_mid_room_2_3_128', 'door_room_room_2_3_128', 0.4);
        g.addEdge('door_mid_room_2_3_128', 'door_corr_room_2_3_128', 0.4);
        g.addEdge('room_2_3_129', 'door_room_room_2_3_129', 0.3);
        g.addEdge('door_mid_room_2_3_129', 'door_room_room_2_3_129', 0.4);
        g.addEdge('door_mid_room_2_3_129', 'door_corr_room_2_3_129', 0.4);
        g.addEdge('room_2_3_130', 'door_room_room_2_3_130', 5.1);
        g.addEdge('door_mid_room_2_3_130', 'door_room_room_2_3_130', 0.4);
        g.addEdge('door_mid_room_2_3_130', 'door_corr_room_2_3_130', 0.4);
        g.addEdge('room_2_3_131', 'door_room_room_2_3_131', 2.9);
        g.addEdge('door_mid_room_2_3_131', 'door_room_room_2_3_131', 0.4);
        g.addEdge('door_mid_room_2_3_131', 'door_corr_room_2_3_131', 0.4);
        g.addEdge('room_2_3_132', 'door_room_room_2_3_132', 3.0);
        g.addEdge('door_mid_room_2_3_132', 'door_room_room_2_3_132', 0.4);
        g.addEdge('door_mid_room_2_3_132', 'door_corr_room_2_3_132', 0.4);
        g.addEdge('room_2_3_133', 'door_room_room_2_3_133', 2.9);
        g.addEdge('door_mid_room_2_3_133', 'door_room_room_2_3_133', 0.4);
        g.addEdge('door_mid_room_2_3_133', 'door_corr_room_2_3_133', 0.4);
        g.addEdge('door_mid_room_2_3_134', 'door_corr_room_2_3_134', 0.4);
        g.addEdge('room_2_3_134', 'door_mid_room_2_3_134', 6.9);
        g.addEdge('room_2_3_135', 'door_room_room_2_3_135', 6.4);
        g.addEdge('b2_f3_c_308_hall', 'room_2_3_135', 7.5);
        g.addEdge('door_mid_room_2_3_135', 'door_room_room_2_3_135', 0.4);
        g.addEdge('door_mid_room_2_3_135', 'door_corr_room_2_3_135', 0.4);
        g.addEdge('room_2_3_136', 'door_room_room_2_3_136', 3.7);
        g.addEdge('door_mid_room_2_3_136', 'door_room_room_2_3_136', 0.4);
        g.addEdge('door_mid_room_2_3_136', 'door_corr_room_2_3_136', 0.4);
        g.addEdge('room_2_3_137', 'door_room_room_2_3_137', 4.6);
        g.addEdge('door_mid_room_2_3_137', 'door_room_room_2_3_137', 0.4);
        g.addEdge('door_mid_room_2_3_137', 'door_corr_room_2_3_137', 0.4);
        g.addEdge('room_2_3_138', 'door_room_room_2_3_138', 0.5);
        g.addEdge('door_mid_room_2_3_138', 'door_room_room_2_3_138', 0.4);
        g.addEdge('door_mid_room_2_3_138', 'custom_b2_f3_c_670_-26_1py', 1.0);
        g.addEdge('door_room_4_3_232', 'custom_b4_f3_c_375_-341_7df', 1.4);
        g.addEdge('door_corr_room_4_3_234', 'custom_b4_f3_c_375_-486_uml', 1.1);
        g.addEdge('door_corr_room_4_3_234', 'custom_b4_f3_c_481_-486_kaq', 9.5);
        g.addEdge('room_4_3_235', 'door_room_room_4_3_235', 3.3);
        g.addEdge('door_mid_room_4_3_235', 'door_room_room_4_3_235', 0.4);
        g.addEdge('door_mid_room_4_3_235', 'door_corr_room_4_3_235', 0.4);
        g.addEdge('door_corr_room_4_3_235', 'custom_b4_f3_c_599_-486_mu3', 1.4);
        g.addEdge('room_4_3_236', 'door_room_room_4_3_236', 3.0);
        g.addEdge('door_mid_room_4_3_236', 'door_room_room_4_3_236', 0.4);
        g.addEdge('door_mid_room_4_3_236', 'door_corr_room_4_3_236', 0.4);
        g.addEdge('door_mid_room_4_3_238', 'door_room_room_4_3_238', 0.4);
        g.addEdge('door_mid_room_4_3_238', 'custom_b4_f3_c_375_-447_r8q', 0.7);
        g.addEdge('door_room_room_4_3_238', 'custom_b4_f3_c_445_-448_u0o', 5.9);
        g.addEdge('door_mid_room_4_3_239', 'door_room_room_4_3_239', 0.4);
        g.addEdge('room_4_3_241', 'door_room_room_4_3_241', 2.8);
        g.addEdge('door_mid_room_4_3_241', 'door_room_room_4_3_241', 0.4);
        g.addEdge('door_mid_room_4_3_241', 'custom_b4_f3_c_461_-324_he8', 0.8);
        g.addEdge('room_4_3_243', 'door_room_room_4_3_243', 1.3);
        g.addEdge('door_mid_room_4_3_243', 'door_room_room_4_3_243', 0.4);
        g.addEdge('door_mid_room_4_3_243', 'door_corr_room_4_3_243', 0.4);
        g.addEdge('door_room_room_4_3_244', 'custom_b4_f3_c_408_-407_sy9', 2.2);
        g.addEdge('door_room_room_4_3_244', 'custom_b4_f3_c_375_-407_bmq', 1.1);
        g.addEdge('room_4_3_245', 'door_room_room_4_3_245', 2.1);
        g.addEdge('door_mid_room_4_3_245', 'door_room_room_4_3_245', 0.4);
        g.addEdge('door_mid_room_4_3_245', 'door_corr_room_4_3_245', 0.4);
        g.addEdge('room_4_3_246', 'door_room_room_4_3_246', 1.9);
        g.addEdge('door_room_room_4_3_246', 'custom_b4_f3_c_375_-431_jvr', 1.7);
        g.addEdge('room_4_3_247', 'door_room_room_4_3_247', 1.7);
        g.addEdge('door_mid_room_4_3_247', 'door_room_room_4_3_247', 0.4);
        g.addEdge('door_mid_room_4_3_247', 'custom_b4_f3_c_375_-388_7pq', 1.3);
        g.addEdge('room_4_3_248', 'door_room_room_4_3_248', 1.7);
        g.addEdge('door_mid_room_4_3_248', 'door_room_room_4_3_248', 0.4);
        g.addEdge('door_mid_room_4_3_248', 'door_corr_room_4_3_248', 0.4);
        g.addEdge('door_corr_room_4_3_248', 'custom_b4_f3_c_375_-341_7df', 0.9);
        g.addEdge('room_4_3_249', 'door_room_room_4_3_249', 1.9);
        g.addEdge('door_mid_room_4_3_249', 'door_room_room_4_3_249', 0.4);
        g.addEdge('door_mid_room_4_3_249', 'door_corr_room_4_3_249', 0.4);
        g.addEdge('custom_b1_f3_c_36_-115_ux1', 'custom_b1_f3_c_35_-74_vve', 4.1);
        g.addEdge('custom_b1_f3_c_35_-74_vve', 'custom_b1_f3_c_-5_-73_y4d', 4.0);
        g.addEdge('custom_b1_f3_c_35_-74_vve', 'custom_b1_f3_d_79_-70_b05', 4.4);
        g.addEdge('door_corr_room_1_3_38', 'custom_b1_f3_c_96_-47_h5d', 2.0);
        g.addEdge('custom_b4_f3_c_443_-324_ohi', 'custom_b4_f3_c_443_-285_p9p', 3.9);
        g.addEdge('custom_b4_f3_c_443_-324_ohi', 'custom_b4_f3_c_461_-324_he8', 1.8);
        g.addEdge('custom_b4_f3_c_443_-285_p9p', 'custom_b4_f3_c_467_-285_r9w', 2.4);
        g.addEdge('custom_b4_f3_c_442_-430_43l', 'custom_b4_f3_c_466_-430_6gw', 2.4);
        g.addEdge('custom_b4_f3_c_466_-430_6gw', 'custom_b4_f3_c_466_-415_85f', 1.5);
        g.addEdge('custom_b4_f3_c_445_-448_u0o', 'custom_b4_f3_c_518_-448_vn9', 7.3);
        g.addEdge('custom_b4_f3_c_375_-388_7pq', 'custom_b4_f3_c_375_-407_bmq', 1.9);
        g.addEdge('custom_b4_f3_c_375_-407_bmq', 'custom_b4_f3_c_375_-431_jvr', 2.4);
        g.addEdge('custom_b4_f3_c_375_-431_jvr', 'custom_b4_f3_c_375_-447_r8q', 1.6);
        g.addEdge('custom_b4_f3_c_375_-447_r8q', 'custom_b4_f3_c_375_-486_uml', 3.9);
        g.addEdge('custom_b4_f3_c_375_-486_uml', 'custom_b4_f3_c_347_-482_3dk', 2.9);
        g.addEdge('custom_b4_f3_c_481_-486_kaq', 'custom_b4_f3_c_599_-486_mu3', 11.8);
        g.addEdge('custom_b4_f3_c_375_-324_3fq', 'custom_b4_f3_c_375_-341_7df', 1.7);
        g.addEdge('custom_b2_f3_c_670_-58_0u0', 'custom_b2_f3_c_670_-26_1py', 3.2);
        g.addEdge('custom_b4_f3_c_375_-324_3fq', 'custom_b4_f3_c_375_-310_hzh', 1.4);
        g.addEdge('custom_b4_f3_c_375_-310_hzh', 'door_corr_room_4_3_249', 0.9);
        g.addEdge('custom_b4_f3_c_375_-324_3fq', 'custom_b4_f3_c_406_-324_l99', 3.1);
        g.addEdge('custom_b4_f3_c_406_-324_l99', 'door_corr_room_4_3_236', 0.8);
        g.addEdge('custom_b4_f3_c_406_-324_l99', 'door_corr_room_4_3_243', 0.8);
        g.addEdge('custom_b4_f3_c_406_-324_l99', 'custom_b4_f3_c_443_-324_ohi', 3.7);
        g.addEdge('b1_f4_nc_-6.0', 'b1_f4_nc_door_-5.8', 0.2);
        g.addEdge('b1_f4_nc_door_-5.8', 'b1_f4_nc_-3.0', 2.9);
        g.addEdge('b1_f4_nc_-3.0', 'b1_f4_nc_0.0', 3.0);
        g.addEdge('b1_f4_nc_-3.0', 'b1_f4_wc_-3.0', 2.8);
        g.addEdge('b1_f4_nc_0.0', 'b1_f4_nc_3.0', 3.0);
        g.addEdge('b1_f4_nc_0.0', 'door_corr_room_1_4_49', 0.4);
        g.addEdge('b1_f4_nc_3.0', 'b1_f4_nc_5.9', 2.9);
        // убран ошибочный сквозной проход сквозь глухую стену z = -6.2 в 403А
        g.addEdge('b1_f4_nc_5.9', 'b1_f4_nc_9.4', 3.5);
        g.addEdge('b1_f4_nc_5.9', 'door_corr_room_1_4_44', 1.5);
        g.addEdge('b1_f4_nc_9.4', 'b1_f4_nc_12.5', 3.1);
        g.addEdge('b1_f4_nc_9.4', 'b1_f4_stair_lk1', 3.9);
        g.addEdge('b1_f4_nc_9.4', 'door_corr_room_1_4_46', 1.6);
        g.addEdge('b1_f4_nc_9.4', 'door_corr_room_1_4_51', 1.5);
        g.addEdge('b1_f4_nc_12.5', 'b1_f4_nc_16.0', 3.1);
        g.addEdge('b1_f4_wc_-3.0', 'b1_f4_wc_0.0', 3.0);
        g.addEdge('b1_f4_wc_-3.0', 'door_corr_room_1_4_52', 2.5);
        g.addEdge('b1_f4_wc_0.0', 'b1_f4_wc_1.7', 1.7);
        g.addEdge('b1_f4_wc_1.7', 'b1_f4_wc_3.5', 1.8);
        g.addEdge('b1_f4_wc_1.7', 'b1_f4_elev', 4.8);
        g.addEdge('b1_f4_wc_1.7', 'door_corr_room_1_4_48', 1.4);
        g.addEdge('b1_f4_wc_1.7', 'door_corr_room_1_4_53', 2.4);
        g.addEdge('b1_f4_wc_3.5', 'b1_f4_wc_6.0', 2.5);
        g.addEdge('b1_f4_wc_6.0', 'b1_f4_sc_0.0', 3.0);
        g.addEdge('b1_f4_wc_6.0', 'door_corr_room_1_4_54', 2.4);
        g.addEdge('b1_f4_wc_6.0', 'door_corr_room_1_4_55', 1.6);
        g.addEdge('b1_f4_sc_0.0', 'b1_f4_sc_1.8', 1.8);
        g.addEdge('b1_f4_sc_1.8', 'b1_f4_sc_3.5', 1.7);
        g.addEdge('b1_f4_sc_3.5', 'b1_f4_sc_5.6', 2.1);
        g.addEdge('b1_f4_sc_5.6', 'b1_f4_sc_9.4', 3.8);
        g.addEdge('b1_f4_sc_5.6', 'door_corr_room_1_4_45', 1.6);
        g.addEdge('b1_f4_sc_9.4', 'b1_f4_sc_10.5', 1.1);
        g.addEdge('b1_f4_sc_9.4', 'b1_f4_stair_lk2', 4.1);
        g.addEdge('b1_f4_sc_9.4', 'door_corr_room_1_4_47', 1.8);
        g.addEdge('b1_f4_stair_lk1', 'b1_f5_stair_lk1', 5.5);
        g.addEdge('b1_f4_stair_lk1', 'b1_f3_stair_lk1', 5.5);
        g.addEdge('b1_f4_stair_lk2', 'b1_f5_stair_lk2', 5.5);
        g.addEdge('b1_f4_stair_lk2', 'b1_f3_stair_lk2', 5.5);
        g.addEdge('b1_f4_elev', 'b1_f5_elev', 4.0, true, { isElevator: true });
        g.addEdge('b1_f4_elev', 'b1_f3_elev', 4.0, true, { isElevator: true });
        g.addEdge('room_1_4_44', 'door_room_room_1_4_44', 1.1);
        g.addEdge('door_mid_room_1_4_44', 'door_room_room_1_4_44', 0.4);
        g.addEdge('door_mid_room_1_4_44', 'door_corr_room_1_4_44', 0.4);
        g.addEdge('room_1_4_45', 'door_room_room_1_4_45', 2.3);
        g.addEdge('door_mid_room_1_4_45', 'door_room_room_1_4_45', 0.4);
        g.addEdge('door_mid_room_1_4_45', 'door_corr_room_1_4_45', 0.4);
        g.addEdge('room_1_4_46', 'door_room_room_1_4_46', 1.5);
        g.addEdge('door_mid_room_1_4_46', 'door_room_room_1_4_46', 0.4);
        g.addEdge('door_mid_room_1_4_46', 'door_corr_room_1_4_46', 0.4);
        g.addEdge('room_1_4_47', 'door_room_room_1_4_47', 1.5);
        g.addEdge('door_mid_room_1_4_47', 'door_room_room_1_4_47', 0.4);
        g.addEdge('door_mid_room_1_4_47', 'door_corr_room_1_4_47', 0.4);
        g.addEdge('room_1_4_48', 'door_room_room_1_4_48', 2.6);
        g.addEdge('door_mid_room_1_4_48', 'door_room_room_1_4_48', 0.4);
        g.addEdge('door_mid_room_1_4_48', 'door_corr_room_1_4_48', 0.4);
        g.addEdge('room_1_4_49', 'door_room_room_1_4_49', 5.2);
        g.addEdge('door_mid_room_1_4_49', 'door_room_room_1_4_49', 0.4);
        g.addEdge('door_mid_room_1_4_49', 'door_corr_room_1_4_49', 0.4);
        g.addEdge('door_room_room_1_4_49', 'custom_b1_f4_c_-4_-75_ptb', 0.9);
        g.addEdge('room_1_4_50', 'door_room_room_1_4_50', 2.4);
        g.addEdge('door_mid_room_1_4_50', 'door_room_room_1_4_50', 0.4);
        g.addEdge('door_mid_room_1_4_50', 'door_corr_room_1_4_50', 0.4);
        g.addEdge('door_corr_room_1_4_50', 'custom_b1_f4_c_33_-75_ydr', 0.8);
        g.addEdge('door_mid_room_1_4_51', 'door_corr_room_1_4_51', 0.4);
        g.addEdge('door_mid_room_1_4_51', 'custom_b1_f4_c_79_-75_z02', 1.3);
        g.addEdge('room_1_4_52', 'door_room_room_1_4_52', 3.7);
        g.addEdge('door_mid_room_1_4_52', 'door_room_room_1_4_52', 0.4);
        g.addEdge('door_mid_room_1_4_52', 'door_corr_room_1_4_52', 0.4);
        g.addEdge('room_1_4_53', 'door_room_room_1_4_53', 3.7);
        g.addEdge('door_mid_room_1_4_53', 'door_room_room_1_4_53', 0.4);
        g.addEdge('door_mid_room_1_4_53', 'door_corr_room_1_4_53', 0.4);
        g.addEdge('room_1_4_54', 'door_room_room_1_4_54', 4.7);
        g.addEdge('door_mid_room_1_4_54', 'door_room_room_1_4_54', 0.4);
        g.addEdge('door_mid_room_1_4_54', 'door_corr_room_1_4_54', 0.4);
        g.addEdge('room_1_4_55', 'door_room_room_1_4_55', 8.3);
        g.addEdge('door_mid_room_1_4_55', 'door_room_room_1_4_55', 0.4);
        g.addEdge('door_mid_room_1_4_55', 'door_corr_room_1_4_55', 0.4);
        g.addEdge('custom_b1_f4_c_-4_-75_ptb', 'custom_b1_f4_c_33_-75_ydr', 3.7);
        g.addEdge('custom_b1_f4_c_33_-75_ydr', 'custom_b1_f4_c_79_-75_z02', 4.6);
        g.addEdge('custom_b1_f4_c_33_-75_ydr', 'custom_b1_f4_c_33_-111_dfg', 3.6);
        g.addEdge('custom_b1_f4_c_79_-75_z02', 'room_1_4_51', 3.8);
        g.addEdge('b1_f2_nc_-3.0', 'b1_f2_nc_0.0', 3.0);
        g.addEdge('b1_f2_nc_-3.0', 'b1_f2_wc_-3.0', 2.8);
        g.addEdge('b1_f2_nc_-3.0', 'custom_b1_f2_c_-30_-101_xdd', 4.3);
        g.addEdge('b1_f2_nc_0.0', 'b1_f2_nc_3.0', 3.0);
        g.addEdge('b1_f2_nc_3.0', 'door_corr_room_1_2_21', 2.9);
        g.addEdge('b1_f2_wc_-3.0', 'b1_f2_wc_0.0', 3.0);
        g.addEdge('b1_f2_wc_0.0', 'b1_f2_wc_1.7', 1.7);
        g.addEdge('b1_f2_wc_0.0', 'door_corr_room_1_2_24', 2.8);
        g.addEdge('b1_f2_wc_1.7', 'b1_f2_wc_3.5', 1.8);
        g.addEdge('b1_f2_wc_1.7', 'b1_f2_elev', 4.8);
        g.addEdge('b1_f2_wc_1.7', 'b1_f2_room_206_corr_door', 2.8);
        g.addEdge('b1_f2_wc_3.5', 'b1_f2_wc_6.0', 2.5);
        g.addEdge('b1_f2_wc_6.0', 'b1_f2_sc_0.0', 3.0);
        g.addEdge('b1_f2_wc_6.0', 'door_corr_room_1_2_27', 2.6);
        g.addEdge('b1_f2_wc_6.0', 'door_corr_room_1_2_28', 1.3);
        g.addEdge('b1_f2_sc_0.0', 'b1_f2_sc_1.8', 1.8);
        g.addEdge('b1_f2_sc_0.0', 'door_corr_room_1_2_29', 1.7);
        g.addEdge('b1_f2_sc_1.8', 'b1_f2_sc_3.5', 1.7);
        g.addEdge('b1_f2_sc_3.5', 'b1_f2_sc_5.6', 2.1);
        g.addEdge('b1_f2_sc_5.6', 'b1_f2_sc_9.4', 3.8);
        g.addEdge('b1_f2_sc_5.6', 'door_corr_room_1_2_13', 1.6);
        g.addEdge('b1_f2_sc_9.4', 'b1_f2_sc_10.5', 1.1);
        g.addEdge('b1_f2_sc_9.4', 'b1_f2_stair_lk2', 4.1);
        g.addEdge('b1_f2_sc_9.4', 'door_corr_room_1_2_15', 1.8);
        g.addEdge('b1_f2_sc_9.4', 'door_corr_room_1_2_30', 0.9);
        g.addEdge('b1_f2_stair_lk1', 'door_corr_room_1_2_23', 1.5);
        g.addEdge('b1_f2_stair_lk1', 'b1_f3_stair_lk1', 5.5);
        g.addEdge('b1_f2_stair_lk2', 'b1_f3_stair_lk2', 5.5);
        g.addEdge('b1_f2_elev', 'b1_f3_elev', 4.0, true, { isElevator: true });
        g.addEdge('b1_f2_room_206_corr_door', 'b1_f2_room_206_ante', 1.2);
        g.addEdge('b1_f2_room_206_ante', 'b1_f2_room_206_inner_door', 1.2);
        g.addEdge('b1_f2_room_206_inner_door', 'custom_b1_f2_c_-102_15_l9n', 2.0);
        g.addEdge('b2_f2_c_20.4', 'custom_b2_f2_c_219_-58_veu', 1.5);
        g.addEdge('b2_f2_c_20.4', 'custom_b1_f2_c_180_-56_1nw', 2.4);
        g.addEdge('b2_f2_c_37.5', 'custom_b2_f2_c_328_-58_2yl', 4.7);
        g.addEdge('b2_f2_c_37.5', 'custom_b2_f2_c_403_-58_82t', 2.8);
        g.addEdge('b2_f2_c_37.5', 'bridge_k4_k2_f2', 14.8);
        g.addEdge('b2_f2_c_43.6', 'b2_f2_c_47.0', 3.4);
        g.addEdge('b2_f2_c_43.6', 'b2_f2_stair_lk2', 4.7);
        g.addEdge('b2_f2_c_43.6', 'door_corr_room_2_2_111', 1.0);
        g.addEdge('b2_f2_c_43.6', 'custom_b2_f2_c_403_-58_82t', 3.3);
        g.addEdge('b2_f2_c_47.0', 'b2_f2_c_51.0', 4.0);
        g.addEdge('b2_f2_c_47.0', 'door_corr_room_2_2_112', 1.0);
        g.addEdge('b2_f2_c_47.0', 'door_corr_room_2_2_120', 1.2);
        g.addEdge('b2_f2_c_51.0', 'b2_f2_c_55.0', 4.0);
        g.addEdge('b2_f2_c_51.0', 'door_corr_room_2_2_121', 1.5);
        g.addEdge('b2_f2_c_55.0', 'b2_f2_c_59.0', 4.0);
        g.addEdge('b2_f2_c_59.0', 'b2_f2_c_63.0', 4.0);
        g.addEdge('b2_f2_c_59.0', 'door_corr_room_2_2_113', 1.1);
        g.addEdge('b2_f2_c_63.0', 'b2_f2_c_66.1', 3.1);
        g.addEdge('b2_f2_c_63.0', 'door_corr_room_2_2_114', 1.2);
        g.addEdge('b2_f2_c_63.0', 'door_corr_room_2_2_122', 1.1);
        g.addEdge('b2_f2_c_66.1', 'b2_f2_stair_lk1', 4.7);
        g.addEdge('b2_f2_c_66.1', 'door_room_2_2_115', 1.4);
        g.addEdge('b2_f2_stair_lk1', 'b2_f3_stair_lk1', 5.5);
        g.addEdge('b2_f2_stair_lk2', 'b2_f3_stair_lk2', 5.5);
        // ЛК№3 не продолжается на 3 этаж (на 3 этаже расположена комната 302 по БТИ)
        g.addEdge('b2_f2_stair_lk3', 'door_corr_room_2_2_107', 1.7);
        g.addEdge('b3_f2_c_-14.0', 'b3_f2_c_-18.0', 4.0);
        g.addEdge('b3_f2_c_-14.0', 'bridge_k1_k3_f2', 1.0);
        g.addEdge('b3_f2_c_-14.0', 'custom_b1_f2_c_59_-124_2uw', 1.6);
        g.addEdge('b3_f2_c_-18.0', 'custom_b3_f2_c_59_-232_f56', 5.2);
        g.addEdge('b3_f2_c_-26.0', 'b3_f2_c_-28.6', 2.6);
        g.addEdge('b3_f2_c_-26.0', 'door_corr_room_3_2_162', 1.0);
        g.addEdge('b3_f2_c_-26.0', 'door_corr_room_3_2_171', 1.0);
        g.addEdge('b3_f2_c_-26.0', 'custom_b3_f2_c_59_-232_f56', 2.8);
        g.addEdge('b3_f2_c_-28.6', 'b3_f2_stair_south', 4.4);
        g.addEdge('b3_f2_c_-28.6', 'door_corr_room_3_2_163', 0.9);
        g.addEdge('b3_f2_c_-28.6', 'door_corr_room_3_2_172', 1.0);
        g.addEdge('b3_f2_c_-28.6', 'custom_b3_f2_c_59_-304_oeo', 1.8);
        g.addEdge('b3_f2_c_-36.0', 'b3_f2_c_-40.0', 4.0);
        g.addEdge('b3_f2_c_-36.0', 'custom_b3_f2_c_58_-318_asy', 4.2);
        g.addEdge('b3_f2_c_-40.0', 'door_corr_room_3_2_165', 2.9);
        g.addEdge('b3_f2_c_-40.0', 'door_corr_room_3_2_174', 0.9);
        g.addEdge('b3_f2_c_-40.0', 'custom_b3_f2_c_59_-430_6v0', 3.0);
        g.addEdge('b3_f2_c_-46.0', 'b3_f2_c_-50.0', 4.0);
        g.addEdge('b3_f2_c_-46.0', 'b3_f2_stair_north', 4.4);
        g.addEdge('b3_f2_c_-46.0', 'custom_b3_f2_c_59_-430_6v0', 3.0);
        g.addEdge('b3_f2_c_-45.5', 'bridge_k3_k4_f2', 17.3);
        g.addEdge('b3_f2_c_-45.5', 'b3_f2_c_-46.0', 0.5);
        g.addEdge('b3_f2_c_-50.0', 'b3_f2_c_-55.0', 5.0);
        g.addEdge('b3_f2_c_-50.0', 'door_corr_room_3_2_167', 0.9);
        g.addEdge('b3_f2_c_-50.0', 'door_corr_room_3_2_176', 0.9);
        g.addEdge('b3_f2_c_-55.0', 'door_corr_room_3_2_168', 2.2);
        g.addEdge('b3_f2_c_-55.0', 'door_corr_room_3_2_178', 0.9);
        g.addEdge('b3_f2_c_-55.0', 'custom_b3_f2_c_59_-598_xz2', 4.8);
        g.addEdge('b4_f2_stair_lk1', 'b4_f2_stair_lk1_door', 3.4);
        g.addEdge('b4_f2_stair_lk1', 'b4_f3_stair_lk1', 5.5);
        g.addEdge('b4_f2_stair_lk2', 'b4_f2_stair_lk2_door', 2.3);
        g.addEdge('b4_f2_stair_lk2', 'b4_f3_stair_lk2', 5.5);
        g.addEdge('b4_f2_stair_lk2', 'door_mid_room_4_2_212', 2.0);
        g.addEdge('b4_f2_stair_lk2_door', 'custom_b4_f2_c_340_-482_8qd', 1.6);
        g.addEdge('b4_f2_stair_lk3', 'door_corr_room_4_2_211', 3.3);
        g.addEdge('b4_f2_stair_lk3', 'b4_f3_stair_lk3', 5.5);
        g.addEdge('b4_f2_stair_lk3', 'custom_b4_f2_c_624_-461_6cf', 3.2);
        g.addEdge('b4_f2_sw_-44.5', 'b4_f2_sw_-43.0', 1.5);
        g.addEdge('b4_f2_sw_-44.5', 'b4_f2_c_37.5', 0.2);
        g.addEdge('b4_f2_sw_-44.5', 'custom_b4_f2_c_375_-505_yh2', 6.0);
        g.addEdge('b4_f2_sw_-44.5', 'custom_b4_f2_c_400_-445_ijr', 2.5);
        g.addEdge('b4_f2_sw_-44.5', 'custom_b4_f2_c_340_-482_8qd', 5.1);
        g.addEdge('b4_f2_sw_-44.5', 'custom_b4_f2_c_340_-456_tzd', 3.6);
        g.addEdge('b4_f2_sw_-43.0', 'custom_b4_f2_c_375_-396_r1z', 3.4);
        g.addEdge('b4_f2_sw_-27.4', 'custom_b4_f2_c_375_-293_0r9', 1.9);
        g.addEdge('b4_f2_sw_-27.4', 'bridge_k4_k2_f2', 6.8);
        g.addEdge('b4_f2_c_37.5', 'b4_f2_c_41.0', 3.5);
        g.addEdge('b4_f2_c_41.0', 'b4_f2_c_45.0', 4.0);
        g.addEdge('b4_f2_c_41.0', 'door_room_4_2_215', 1.0);
        g.addEdge('b4_f2_c_41.0', 'door_corr_room_4_2_225', 1.7);
        g.addEdge('b4_f2_c_41.0', 'door_corr_room_4_2_226', 2.3);
        g.addEdge('b4_f2_c_45.0', 'b4_f2_c_49.0', 4.0);
        g.addEdge('b4_f2_c_49.0', 'b4_f2_c_53.0', 4.0);
        g.addEdge('b4_f2_c_49.0', 'custom_b4_f2_c_469_-445_k0i', 2.1);
        g.addEdge('b4_f2_c_53.0', 'b4_f2_c_57.0', 4.0);
        g.addEdge('b4_f2_c_53.0', 'door_corr_room_4_2_218', 0.9);
        g.addEdge('b4_f2_c_53.0', 'door_corr_room_4_2_219', 1.2);
        g.addEdge('b4_f2_c_57.0', 'custom_b4_f2_c_595_-445_bzr', 2.5);
        g.addEdge('bridge_k1_k3_f2', 'door_corr_room_1_2_18', 1.7);
        g.addEdge('bridge_k1_k3_f2', 'door_corr_room_1_2_20', 1.7);
        g.addEdge('bridge_k3_k4_f2', 'b4_f2_bridge_k3_door', 9.2);
        g.addEdge('bridge_k3_k4_f2', 'custom_b4_f2_c_315_-455_0it', 8.3);
        g.addEdge('room_1_2_12', 'door_room_room_1_2_12', 1.1);
        g.addEdge('door_mid_room_1_2_12', 'door_room_room_1_2_12', 0.4);
        g.addEdge('door_mid_room_1_2_12', 'door_corr_room_1_2_12', 0.4);
        g.addEdge('door_corr_room_1_2_12', 'door_corr_room_1_2_21', 1.5);
        g.addEdge('room_1_2_13', 'door_room_room_1_2_13', 2.3);
        g.addEdge('door_mid_room_1_2_13', 'door_room_room_1_2_13', 0.4);
        g.addEdge('door_mid_room_1_2_13', 'door_corr_room_1_2_13', 0.4);
        g.addEdge('room_1_2_14', 'door_room_room_1_2_14', 1.5);
        g.addEdge('door_mid_room_1_2_14', 'door_room_room_1_2_14', 0.4);
        g.addEdge('door_mid_room_1_2_14', 'custom_b1_f2_c_95_-51_o94', 1.3);
        g.addEdge('room_1_2_15', 'door_room_room_1_2_15', 1.5);
        g.addEdge('door_mid_room_1_2_15', 'door_room_room_1_2_15', 0.4);
        g.addEdge('door_mid_room_1_2_15', 'door_corr_room_1_2_15', 0.4);
        g.addEdge('room_1_2_17', 'custom_b1_f2_c_-30_-101_xdd', 2.2);
        g.addEdge('room_1_2_18', 'door_room_room_1_2_18', 2.1);
        g.addEdge('door_mid_room_1_2_18', 'door_room_room_1_2_18', 0.4);
        g.addEdge('door_mid_room_1_2_18', 'door_corr_room_1_2_18', 0.4);
        g.addEdge('door_mid_room_1_2_18', 'custom_b1_f2_c_59_-124_2uw', 1.3);
        g.addEdge('door_mid_room_1_2_19', 'door_room_room_1_2_19', 0.4);
        g.addEdge('door_mid_room_1_2_19', 'door_corr_room_1_2_19', 0.4);
        g.addEdge('door_mid_room_1_2_19', 'custom_b1_f2_c_27_-76_oy4', 1.9);
        g.addEdge('door_corr_room_1_2_19', 'custom_b1_f2_c_59_-76_zai', 0.9);
        g.addEdge('room_1_2_19', 'custom_b1_f2_c_27_-100_pje', 0.9);
        g.addEdge('room_1_2_20', 'door_room_room_1_2_20', 4.1);
        g.addEdge('door_mid_room_1_2_20', 'door_room_room_1_2_20', 0.4);
        g.addEdge('door_mid_room_1_2_20', 'door_corr_room_1_2_20', 0.4);
        g.addEdge('door_mid_room_1_2_20', 'custom_b1_f2_c_59_-124_2uw', 1.3);
        g.addEdge('room_1_2_21', 'custom_b1_f2_c_59_-76_zai', 3.8);
        g.addEdge('door_corr_room_1_2_21', 'custom_b1_f2_c_59_-76_zai', 1.8);
        g.addEdge('door_corr_room_1_2_21', 'custom_b1_f2_c_95_-51_o94', 3.6);
        g.addEdge('room_1_2_22', 'door_room_room_1_2_22', 1.3);
        g.addEdge('door_mid_room_1_2_22', 'door_room_room_1_2_22', 0.4);
        g.addEdge('door_mid_room_1_2_22', 'door_corr_room_1_2_22', 0.4);
        g.addEdge('door_corr_room_1_2_22', 'custom_b1_f2_c_136_-51_uqh', 0.7);
        g.addEdge('door_mid_room_1_2_23', 'door_corr_room_1_2_23', 0.4);
        g.addEdge('door_mid_room_1_2_24', 'door_room_room_1_2_24', 0.4);
        g.addEdge('door_mid_room_1_2_24', 'door_corr_room_1_2_24', 0.4);
        g.addEdge('door_room_room_1_2_24', 'custom_b1_f2_c_-112_-14_sdr', 5.0);
        g.addEdge('room_1_2_24', 'custom_b1_f2_c_-112_-14_sdr', 0.8);
        g.addEdge('room_1_2_25', 'custom_b1_f2_c_-111_15_njt', 0.2);
        g.addEdge('room_1_2_26', 'door_room_room_1_2_26', 1.6);
        g.addEdge('door_room_room_1_2_26', 'custom_b1_f2_c_-102_15_l9n', 2.1);
        g.addEdge('room_1_2_27', 'door_room_room_1_2_27', 7.3);
        g.addEdge('door_mid_room_1_2_27', 'door_room_room_1_2_27', 0.4);
        g.addEdge('door_mid_room_1_2_27', 'door_corr_room_1_2_27', 0.4);
        g.addEdge('room_1_2_28', 'door_room_room_1_2_28', 3.9);
        g.addEdge('door_mid_room_1_2_28', 'door_room_room_1_2_28', 0.4);
        g.addEdge('door_mid_room_1_2_28', 'door_corr_room_1_2_28', 0.4);
        g.addEdge('door_mid_room_1_2_29', 'door_room_room_1_2_29', 0.4);
        g.addEdge('door_mid_room_1_2_29', 'door_corr_room_1_2_29', 0.4);
        g.addEdge('door_room_room_1_2_29', 'custom_b1_f2_c_-15_118_ag9', 4.2);
        g.addEdge('room_1_2_29', 'custom_b1_f2_c_-4_118_api', 0.2);
        g.addEdge('room_1_2_30', 'door_room_room_1_2_30', 4.1);
        g.addEdge('door_mid_room_1_2_30', 'door_room_room_1_2_30', 0.4);
        g.addEdge('door_mid_room_1_2_30', 'door_corr_room_1_2_30', 0.4);
        g.addEdge('b1_f2_sc_5.6', 'door_corr_b1_f2_r201_west', 0.9);
        g.addEdge('door_corr_b1_f2_r201_west', 'door_mid_b1_f2_r201_west', 0.4);
        g.addEdge('door_mid_b1_f2_r201_west', 'door_room_b1_f2_r201_west', 0.4);
        g.addEdge('door_room_b1_f2_r201_west', 'room_1_2_30', 5.2);
        g.addEdge('room_2_2_107', 'door_room_room_2_2_107', 2.0);
        g.addEdge('door_mid_room_2_2_107', 'door_room_room_2_2_107', 0.4);
        g.addEdge('door_mid_room_2_2_107', 'door_corr_room_2_2_107', 0.4);
        g.addEdge('door_room_room_2_2_107', 'custom_b2_f2_c_246_-88_mx5', 0.8);
        g.addEdge('room_2_2_108', 'door_room_room_2_2_108', 3.3);
        g.addEdge('door_mid_room_2_2_108', 'door_room_room_2_2_108', 0.4);
        g.addEdge('door_mid_room_2_2_108', 'door_corr_room_2_2_108', 0.4);
        g.addEdge('door_corr_room_2_2_108', 'custom_b2_f2_c_328_-58_2yl', 1.0);
        g.addEdge('room_2_2_109', 'door_room_room_2_2_109', 0.8);
        g.addEdge('door_mid_room_2_2_109', 'door_room_room_2_2_109', 0.4);
        g.addEdge('door_mid_room_2_2_109', 'door_corr_room_2_2_109', 0.4);
        g.addEdge('door_corr_room_2_2_109', 'custom_b2_f2_c_403_-58_82t', 1.2);
        g.addEdge('room_2_2_110', 'door_room_room_2_2_110', 0.8);
        g.addEdge('door_mid_room_2_2_110', 'door_room_room_2_2_110', 0.4);
        g.addEdge('door_mid_room_2_2_110', 'door_corr_room_2_2_110', 0.4);
        g.addEdge('door_corr_room_2_2_110', 'custom_b2_f2_c_403_-58_82t', 1.2);
        g.addEdge('room_2_2_111', 'door_room_room_2_2_111', 4.9);
        g.addEdge('door_mid_room_2_2_111', 'door_room_room_2_2_111', 0.4);
        g.addEdge('door_mid_room_2_2_111', 'door_corr_room_2_2_111', 0.4);
        g.addEdge('room_2_2_112', 'door_room_room_2_2_112', 2.9);
        g.addEdge('door_mid_room_2_2_112', 'door_room_room_2_2_112', 0.4);
        g.addEdge('door_mid_room_2_2_112', 'door_corr_room_2_2_112', 0.4);
        g.addEdge('room_2_2_113', 'door_room_room_2_2_113', 4.9);
        g.addEdge('door_mid_room_2_2_113', 'door_room_room_2_2_113', 0.4);
        g.addEdge('door_mid_room_2_2_113', 'door_corr_room_2_2_113', 0.4);
        g.addEdge('room_2_2_114', 'door_room_room_2_2_114', 0.8);
        g.addEdge('door_mid_room_2_2_114', 'door_room_room_2_2_114', 0.4);
        g.addEdge('door_mid_room_2_2_114', 'door_corr_room_2_2_114', 0.4);
        g.addEdge('room_2_2_115', 'door_room_2_2_115', 5.3);
        g.addEdge('room_2_2_116', 'door_room_room_2_2_116', 3.5);
        g.addEdge('door_mid_room_2_2_116', 'door_room_room_2_2_116', 0.4);
        g.addEdge('door_mid_room_2_2_116', 'door_corr_room_2_2_116', 0.4);
        g.addEdge('door_corr_room_2_2_116', 'custom_b2_f2_c_219_-58_veu', 1.0);
        g.addEdge('room_2_2_117', 'door_room_room_2_2_117', 3.5);
        g.addEdge('door_mid_room_2_2_117', 'door_room_room_2_2_117', 0.4);
        g.addEdge('door_mid_room_2_2_117', 'door_corr_room_2_2_117', 0.4);
        g.addEdge('door_corr_room_2_2_117', 'custom_b2_f2_c_249_-58_wdq', 1.0);
        g.addEdge('room_2_2_118', 'door_room_room_2_2_118', 5.7);
        g.addEdge('door_mid_room_2_2_118', 'door_room_room_2_2_118', 0.4);
        g.addEdge('door_mid_room_2_2_118', 'door_corr_room_2_2_118', 0.4);
        g.addEdge('door_corr_room_2_2_118', 'custom_b2_f2_c_282_-58_zxs', 1.0);
        g.addEdge('room_2_2_119', 'door_room_room_2_2_119', 3.5);
        g.addEdge('door_mid_room_2_2_119', 'door_room_room_2_2_119', 0.4);
        g.addEdge('door_mid_room_2_2_119', 'door_corr_room_2_2_119', 0.4);
        g.addEdge('door_corr_room_2_2_119', 'custom_b2_f2_c_403_-58_82t', 1.0);
        g.addEdge('room_2_2_120', 'door_room_room_2_2_120', 3.5);
        g.addEdge('door_mid_room_2_2_120', 'door_room_room_2_2_120', 0.4);
        g.addEdge('door_mid_room_2_2_120', 'door_corr_room_2_2_120', 0.4);
        g.addEdge('room_2_2_121', 'door_room_room_2_2_121', 4.7);
        g.addEdge('door_mid_room_2_2_121', 'door_room_room_2_2_121', 0.4);
        g.addEdge('door_mid_room_2_2_121', 'door_corr_room_2_2_121', 0.4);
        g.addEdge('room_2_2_122', 'door_room_room_2_2_122', 3.5);
        g.addEdge('door_mid_room_2_2_122', 'door_room_room_2_2_122', 0.4);
        g.addEdge('door_mid_room_2_2_122', 'door_corr_room_2_2_122', 0.4);
        g.addEdge('room_3_2_161', 'door_room_room_3_2_161', 4.2);
        g.addEdge('door_mid_room_3_2_161', 'door_room_room_3_2_161', 0.4);
        g.addEdge('door_mid_room_3_2_161', 'door_corr_room_3_2_161', 0.4);
        g.addEdge('door_corr_room_3_2_161', 'custom_b3_f2_c_59_-232_f56', 0.9);
        g.addEdge('room_3_2_162', 'door_room_room_3_2_162', 2.7);
        g.addEdge('door_mid_room_3_2_162', 'door_room_room_3_2_162', 0.4);
        g.addEdge('door_mid_room_3_2_162', 'door_corr_room_3_2_162', 0.4);
        g.addEdge('room_3_2_163', 'door_room_room_3_2_163', 2.7);
        g.addEdge('door_mid_room_3_2_163', 'door_room_room_3_2_163', 0.4);
        g.addEdge('door_mid_room_3_2_163', 'door_corr_room_3_2_163', 0.4);
        g.addEdge('room_3_2_164', 'door_room_room_3_2_164', 5.1);
        g.addEdge('door_mid_room_3_2_164', 'door_room_room_3_2_164', 0.4);
        g.addEdge('door_mid_room_3_2_164', 'door_corr_room_3_2_164', 0.4);
        g.addEdge('door_corr_room_3_2_164', 'custom_b3_f2_c_58_-318_asy', 0.8);
        g.addEdge('room_3_2_165', 'door_room_room_3_2_165', 2.1);
        g.addEdge('door_mid_room_3_2_165', 'door_room_room_3_2_165', 0.4);
        g.addEdge('door_mid_room_3_2_165', 'door_corr_room_3_2_165', 0.4);
        g.addEdge('room_3_2_167', 'door_room_room_3_2_167', 2.7);
        g.addEdge('door_mid_room_3_2_167', 'door_room_room_3_2_167', 0.4);
        g.addEdge('door_mid_room_3_2_167', 'door_corr_room_3_2_167', 0.4);
        g.addEdge('room_3_2_168', 'door_room_room_3_2_168', 3.4);
        g.addEdge('room_3_2_168', 'door_room_room_3_2_169', 5.0);
        g.addEdge('door_mid_room_3_2_168', 'door_room_room_3_2_168', 0.4);
        g.addEdge('door_mid_room_3_2_168', 'door_corr_room_3_2_168', 0.4);
        g.addEdge('room_3_2_169', 'door_room_room_3_2_169', 2.5);
        g.addEdge('door_room_room_3_2_169', 'custom_b3_f2_c_59_-598_xz2', 2.0);
        g.addEdge('room_3_2_170', 'door_room_room_3_2_170', 4.5);
        g.addEdge('door_mid_room_3_2_170', 'door_room_room_3_2_170', 0.4);
        g.addEdge('door_mid_room_3_2_170', 'door_corr_room_3_2_170', 0.4);
        g.addEdge('door_corr_room_3_2_170', 'custom_b3_f2_c_59_-232_f56', 0.9);
        g.addEdge('room_3_2_171', 'door_room_room_3_2_171', 3.0);
        g.addEdge('door_mid_room_3_2_171', 'door_room_room_3_2_171', 0.4);
        g.addEdge('door_mid_room_3_2_171', 'door_corr_room_3_2_171', 0.4);
        g.addEdge('room_3_2_172', 'door_room_room_3_2_172', 3.0);
        g.addEdge('door_mid_room_3_2_172', 'door_room_room_3_2_172', 0.4);
        g.addEdge('door_mid_room_3_2_172', 'door_corr_room_3_2_172', 0.4);
        g.addEdge('room_3_2_173', 'door_room_room_3_2_173', 3.0);
        g.addEdge('door_mid_room_3_2_173', 'door_room_room_3_2_173', 0.4);
        g.addEdge('door_mid_room_3_2_173', 'door_corr_room_3_2_173', 0.4);
        g.addEdge('door_mid_room_3_2_173', 'custom_b3_f2_c_59_-304_oeo', 1.3);
        g.addEdge('room_3_2_174', 'door_room_room_3_2_174', 4.4);
        g.addEdge('door_mid_room_3_2_174', 'door_room_room_3_2_174', 0.4);
        g.addEdge('door_mid_room_3_2_174', 'door_corr_room_3_2_174', 0.4);
        g.addEdge('door_room_room_3_2_174', 'door_mid_room_3_2_175', 1.9);
        g.addEdge('room_3_2_175', 'door_room_room_3_2_175', 2.3);
        g.addEdge('room_3_2_175', 'custom_b3_f2_c_59_-430_6v0', 4.7);
        g.addEdge('door_mid_room_3_2_175', 'door_room_room_3_2_175', 0.4);
        g.addEdge('room_3_2_176', 'door_room_room_3_2_176', 3.1);
        g.addEdge('door_mid_room_3_2_176', 'door_room_room_3_2_176', 0.4);
        g.addEdge('door_mid_room_3_2_176', 'door_corr_room_3_2_176', 0.4);
        g.addEdge('room_3_2_166', 'b3_f2_stair_north', 0.1);
        g.addEdge('room_3_2_177', 'door_room_room_3_2_177', 2.3);
        g.addEdge('door_mid_room_3_2_177', 'door_room_room_3_2_177', 0.4);
        g.addEdge('door_mid_room_3_2_177', 'door_corr_room_3_2_177', 0.4);
        g.addEdge('door_corr_room_3_2_177', 'custom_b3_f2_c_84_-531_opn', 1.1);
        g.addEdge('door_mid_room_3_2_177', 'door_room_room_3_2_178', 1.4);
        g.addEdge('room_3_2_178', 'door_room_room_3_2_178', 4.0);
        g.addEdge('door_mid_room_3_2_178', 'door_room_room_3_2_178', 0.4);
        g.addEdge('door_mid_room_3_2_178', 'door_corr_room_3_2_178', 0.4);
        g.addEdge('room_4_2_211', 'door_room_room_4_2_211', 14.3);
        g.addEdge('room_4_2_211', 'custom_b4_f2_c_461_-475_q2e', 8.8);
        g.addEdge('room_4_2_211', 'custom_b4_f2_c_375_-505_yh2', 12.8);
        g.addEdge('door_mid_room_4_2_211', 'door_room_room_4_2_211', 0.4);
        g.addEdge('door_mid_room_4_2_211', 'door_corr_room_4_2_211', 0.4);
        g.addEdge('door_mid_room_4_2_212', 'custom_b4_f2_c_315_-455_0it', 1.3);
        g.addEdge('door_mid_room_4_2_214', 'door_corr_room_4_2_214', 0.4);
        g.addEdge('door_mid_room_4_2_214', 'room_4_2_224', 1.9);
        g.addEdge('door_mid_room_4_2_214', 'custom_b4_f2_c_375_-293_0r9', 1.3);
        g.addEdge('door_room_4_2_215', 'custom_b4_f2_c_469_-445_k0i', 4.9);
        g.addEdge('door_room_4_2_215', 'custom_b4_f2_c_400_-445_ijr', 2.0);
        g.addEdge('door_room_4_2_215', 'door_corr_room_4_2_225', 2.2);
        g.addEdge('door_room_4_2_215', 'door_corr_room_4_2_226', 1.8);
        g.addEdge('room_4_2_218', 'door_room_room_4_2_218', 2.1);
        g.addEdge('door_room_room_4_2_218', 'door_corr_room_4_2_218', 0.8);
        g.addEdge('room_4_2_219', 'door_room_room_4_2_219', 2.7);
        g.addEdge('door_room_room_4_2_219', 'door_corr_room_4_2_219', 0.8);
        g.addEdge('room_4_2_222', 'door_room_room_4_2_222', 2.3);
        g.addEdge('door_mid_room_4_2_222', 'door_room_room_4_2_222', 0.4);
        g.addEdge('door_mid_room_4_2_222', 'custom_b4_f2_c_375_-396_r1z', 1.3);
        g.addEdge('room_4_2_223', 'door_room_room_4_2_223', 2.0);
        g.addEdge('door_mid_room_4_2_223', 'door_room_room_4_2_223', 0.4);
        g.addEdge('door_mid_room_4_2_223', 'custom_b4_f2_c_375_-352_jlh', 1.3);
        g.addEdge('room_4_2_224', 'door_room_room_4_2_224', 1.5);
        g.addEdge('door_mid_room_4_2_224', 'door_room_room_4_2_224', 0.4);
        g.addEdge('room_4_2_225', 'door_room_room_4_2_225', 4.3);
        g.addEdge('door_room_room_4_2_225', 'door_corr_room_4_2_225', 0.8);
        g.addEdge('door_corr_room_4_2_225', 'door_corr_room_4_2_226', 2.0);
        g.addEdge('room_4_2_226', 'custom_b4_f2_c_436_-428_jj3', 4.3);
        g.addEdge('door_corr_room_4_2_226', 'custom_b4_f2_c_436_-428_jj3', 1.0);
        g.addEdge('room_4_2_227', 'custom_b4_f2_c_469_-445_k0i', 2.5);
        g.addEdge('room_4_2_229', 'door_room_room_4_2_229', 3.0);
        g.addEdge('door_mid_room_4_2_229', 'door_room_room_4_2_229', 0.4);
        g.addEdge('door_mid_room_4_2_229', 'door_corr_room_4_2_229', 0.4);
        g.addEdge('door_corr_room_4_2_229', 'custom_b4_f2_c_406_-330_68u', 1.4);
        g.addEdge('room_4_2_230', 'custom_b4_f2_c_468_-355_akv', 9.8);
        g.addEdge('room_4_2_230', 'custom_b4_f2_c_595_-428_e34', 7.8);
        g.addEdge('custom_b4_f2_c_421_-460_ipg', 'custom_b4_f2_c_400_-459_co7', 2.1);
        g.addEdge('custom_b4_f2_c_420_-492_wlz', 'custom_b4_f2_c_400_-492_pl2', 2.0);
        g.addEdge('custom_b4_f2_c_467_-330_ubd', 'custom_b4_f2_c_468_-355_akv', 2.5);
        g.addEdge('custom_b4_f2_c_468_-355_akv', 'custom_b4_f2_c_470_-387_ba7', 3.2);
        g.addEdge('custom_b4_f2_c_468_-355_akv', 'custom_b4_f2_c_467_-330_7uh', 2.5);
        g.addEdge('custom_b4_f2_c_375_-293_0r9', 'custom_b4_f2_c_375_-331_gu8', 3.8);
        g.addEdge('custom_b4_f2_c_406_-330_68u', 'custom_b4_f2_c_467_-330_7uh', 6.1);
        g.addEdge('custom_b4_f2_c_406_-330_68u', 'custom_b4_f2_c_375_-331_gu8', 3.1);
        g.addEdge('custom_b4_f2_c_400_-492_pl2', 'custom_b4_f2_c_400_-459_co7', 3.3);
        g.addEdge('custom_b4_f2_c_400_-459_co7', 'custom_b4_f2_c_400_-445_ijr', 1.4);
        g.addEdge('custom_b4_f2_c_400_-459_co7', 'custom_b4_f2_c_340_-482_8qd', 6.5);
        g.addEdge('custom_b4_f2_c_340_-456_tzd', 'custom_b4_f2_c_315_-455_0it', 2.5);
        g.addEdge('custom_b4_f2_c_340_-456_tzd', 'custom_b4_f2_c_340_-482_8qd', 2.6);
        g.addEdge('custom_b1_f2_c_27_-76_oy4', 'custom_b1_f2_c_27_-100_pje', 2.4);
        g.addEdge('custom_b1_f2_c_59_-76_zai', 'custom_b1_f2_c_59_-124_2uw', 4.8);
        g.addEdge('custom_b3_f2_c_59_-304_oeo', 'custom_b3_f2_c_58_-318_asy', 1.4);
        g.addEdge('custom_b2_f2_c_246_-88_mx5', 'custom_b2_f2_c_246_-105_p78', 1.7);
        g.addEdge('custom_b2_f2_c_246_-88_mx5', 'custom_b2_f2_c_249_-58_wdq', 3.0);
        g.addEdge('custom_b2_f2_c_219_-58_veu', 'custom_b2_f2_c_249_-58_wdq', 3.0);
        g.addEdge('custom_b2_f2_c_249_-58_wdq', 'custom_b2_f2_c_282_-58_zxs', 3.3);
        g.addEdge('custom_b2_f2_c_282_-58_zxs', 'custom_b2_f2_c_328_-58_2yl', 4.6);
        g.addEdge('custom_b1_f2_c_-102_15_l9n', 'custom_b1_f2_c_-111_15_njt', 0.9);
        g.addEdge('custom_b1_f2_c_95_-51_o94', 'custom_b1_f2_c_136_-51_uqh', 4.1);
        g.addEdge('custom_b1_f2_c_136_-51_uqh', 'custom_b1_f2_c_160_-48_j36', 2.4);
        g.addEdge('custom_b1_f2_c_180_-56_1nw', 'custom_b1_f2_c_160_-48_j36', 2.1);
        g.addEdge('custom_b1_f2_c_-15_118_ag9', 'custom_b1_f2_c_-4_118_api', 1.1);
        g.addEdge('custom_b4_f2_c_375_-331_gu8', 'custom_b4_f2_c_375_-352_jlh', 2.1);
        g.addEdge('custom_b4_f2_c_375_-352_jlh', 'custom_b4_f2_c_375_-396_r1z', 4.4);
        g.addEdge('custom_b4_f2_c_606_-481_268', 'custom_b4_f2_c_596_-481_2t5', 1.0);
        g.addEdge('custom_b4_f2_c_606_-481_268', 'custom_b4_f2_c_607_-445_ikv', 3.6);
        g.addEdge('custom_b4_f2_c_624_-461_6cf', 'custom_b4_f2_c_624_-445_n35', 1.6);
        g.addEdge('custom_b4_f2_c_595_-445_bzr', 'custom_b4_f2_c_595_-428_e34', 1.7);
        g.addEdge('custom_b4_f2_c_595_-445_bzr', 'custom_b4_f2_c_607_-445_ikv', 1.2);
        g.addEdge('custom_b4_f2_c_607_-445_ikv', 'custom_b4_f2_c_624_-445_n35', 1.7);
        g.addEdge('custom_b3_f2_c_84_-531_opn', 'custom_b3_f2_c_107_-531_rgj', 2.3);
        g.addEdge('b1_f2_wc_1.7', 'door_corr_room_1_2_16', 1.4);
        g.addEdge('b1_f2_stair_lk1', 'b1_f1_stair_lk1', 5.5);
        g.addEdge('b1_f2_stair_lk2', 'b1_f1_stair_lk2', 5.5);
        g.addEdge('b1_f2_elev', 'b1_f1_elev', 4.0, true, { isElevator: true });
        g.addEdge('b2_f2_stair_lk1', 'b2_f1_stair_lk1', 5.5);
        g.addEdge('b2_f2_stair_lk2', 'b2_f1_stair_lk2', 5.5);
        g.addEdge('b3_f2_stair_south', 'b3_f1_stair_south', 5.5);
        g.addEdge('b3_f2_stair_north', 'b3_f1_stair_north', 5.5);
        g.addEdge('b4_f2_stair_lk1', 'b4_f1_stair_lk1', 5.5);
        g.addEdge('b4_f2_stair_lk2', 'b4_f1_stair_lk2', 5.5);
        g.addEdge('b4_f2_stair_lk3', 'b4_f1_stair_lk3', 5.5);
        g.addEdge('room_1_2_16', 'door_room_room_1_2_16', 2.6);
        g.addEdge('door_mid_room_1_2_16', 'door_room_room_1_2_16', 0.4);
        g.addEdge('door_mid_room_1_2_16', 'door_corr_room_1_2_16', 0.4);
        g.addEdge('b1_f1_nc_-3.0', 'b1_f1_nc_0.0', 3.0);
        g.addEdge('b1_f1_nc_-3.0', 'b1_f1_wc_-3.0', 2.8);
        g.addEdge('b1_f1_nc_-3.0', 'door_corr_room_1_1_0', 0.9);
        g.addEdge('b1_f1_nc_0.0', 'b1_f1_nc_3.0', 3.0);
        g.addEdge('b1_f1_nc_3.0', 'b1_f1_nc_5.9', 2.9);
        g.addEdge('b1_f1_nc_5.9', 'b1_f1_nc_9.4', 3.5);
        g.addEdge('b1_f1_nc_5.9', 'door_corr_room_1_1_6', 2.2);
        g.addEdge('b1_f1_nc_5.9', 'door_corr_room_1_1_7', 1.4);
        g.addEdge('b1_f1_nc_9.4', 'b1_f1_nc_12.5', 3.1);
        g.addEdge('b1_f1_nc_9.4', 'b1_f1_stair_lk1', 3.9);
        g.addEdge('b1_f1_nc_12.5', 'b1_f1_nc_16.0', 3.1);
        g.addEdge('b1_f1_nc_12.5', 'door_corr_room_1_1_5', 1.0);
        g.addEdge('b1_f1_nc_16.0', 'b2_f1_c_20.4', 4.9);
        g.addEdge('b1_f1_wc_-3.0', 'b1_f1_wc_0.0', 3.0);
        g.addEdge('b1_f1_wc_0.0', 'b1_f1_wc_1.7', 1.7);
        g.addEdge('b1_f1_wc_1.7', 'b1_f1_wc_3.5', 1.8);
        g.addEdge('b1_f1_wc_1.7', 'b1_f1_elev', 4.8);
        g.addEdge('b1_f1_wc_3.5', 'b1_f1_wc_6.0', 2.5);
        g.addEdge('b1_f1_wc_6.0', 'b1_f1_sc_0.0', 3.0);
        g.addEdge('b1_f1_wc_6.0', 'b1_f1_foyer_w', 3.8);
        g.addEdge('b1_f1_sc_0.0', 'b1_f1_sc_1.8', 1.8);
        g.addEdge('b1_f1_sc_1.8', 'b1_f1_sc_3.5', 1.7);
        g.addEdge('b1_f1_sc_1.8', 'b1_f1_foyer', 3.8);
        g.addEdge('b1_f1_sc_3.5', 'b1_f1_foyer', 4.2);
        g.addEdge('b1_f1_sc_3.5', 'door_corr_room_1_1_9', 0.7);
        g.addEdge('b1_f1_stair_lk1', 'room_1_1_10', 0.2);
        g.addEdge('b1_f1_stair_lk2', 'b1_f1_inner_door_lk2', 0.8);
        g.addEdge('b1_f1_stair_lk2', 'room_1_1_11', 0.2);
        g.addEdge('b1_f1_elev', 'b1_f1_inner_door_lk2', 6.8);
        g.addEdge('room_1_1_8', 'b1_f1_elev', 0.3);
        g.addEdge('b1_f1_entrance_main', 'b1_f1_porch_walk_1', 1.2);
        g.addEdge('b1_f1_porch_walk_1', 'b1_f1_porch_doors', 0.9);
        g.addEdge('b1_f1_porch_doors', 'b1_f1_vestibule', 2.4);
        g.addEdge('b1_f1_vestibule', 'b1_f1_inner_doors', 2.4);
        g.addEdge('b1_f1_inner_doors', 'b1_f1_foyer', 2.0);
        g.addEdge('b1_f1_foyer', 'b1_f1_foyer_w', 4.8);
        g.addEdge('b2_f1_c_20.4', 'b2_f1_porch', 1.2);
        g.addEdge('b2_f1_stair_lk3', 'b2_f2_stair_lk3', 5.5);
        // Связь ЛК №3 с залом 105 через проходной тамбур (0 wall collisions)
        g.addEdge('b2_f1_stair_lk3', 'b2_f1_d_lk3_vest', 2.4);
        g.addEdge('b2_f1_d_lk3_vest', 'b2_f1_vest_lk3', 1.3);
        g.addEdge('b2_f1_vest_lk3', 'b2_f1_d_vest_105', 1.3);
        g.addEdge('b2_f1_d_vest_105', 'room_2_1_95', 5.8);

        // Связь ЛК №3 с уличным двором через северное крыльцо (0 wall collisions)
        g.addEdge('b2_f1_stair_lk3', 'b2_f1_lk3_exit_door', 1.9);
        g.addEdge('b2_f1_lk3_exit_door', 'b2_f1_lk3_porch', 1.6);
        g.addEdge('b2_f1_lk3_porch', 'outdoor_node_90724', 4.2);
        g.addEdge('b2_f1_c_20.4', 'custom_b2_f1_c_226_-58_h4c', 2.2);
        g.addEdge('b2_f1_c_37.5', 'custom_b2_f1_c_334_-58_oms', 4.1);
        g.addEdge('b2_f1_c_37.5', 'custom_b2_f1_c_402_-58_rs0', 2.7);
        g.addEdge('b2_f1_c_43.6', 'b2_f1_c_47.0', 3.4);
        g.addEdge('b2_f1_c_43.6', 'b2_f1_stair_lk2', 4.7);
        g.addEdge('b2_f1_c_43.6', 'door_corr_room_2_1_97', 1.0);
        g.addEdge('b2_f1_c_43.6', 'custom_b2_f1_c_402_-58_rs0', 3.4);
        g.addEdge('b2_f1_c_47.0', 'door_corr_room_2_1_104', 1.0);
        g.addEdge('b2_f1_c_59.0', 'door_corr_room_2_1_99', 1.1);
        g.addEdge('b2_f1_c_59.0', 'custom_b2_f1_c_626_-58_pxf', 3.6);
        g.addEdge('b2_f1_c_59.0', 'custom_b2_f1_c_570_-58_cc0', 2.0);
        g.addEdge('b2_f1_c_66.1', 'b2_f1_stair_lk1', 4.7);
        g.addEdge('b2_f1_c_66.1', 'room_2_1_106', 5.3);
        g.addEdge('b2_f1_c_66.1', 'custom_b2_f1_c_626_-58_pxf', 3.5);
        g.addEdge('b3_f1_c_-28.6', 'b3_f1_stair_south', 4.4);
        g.addEdge('b3_f1_c_-28.6', 'door_corr_room_3_1_149', 0.9);
        g.addEdge('b3_f1_c_-28.6', 'custom_b3_f1_c_59_-313_m4p', 2.7);
        g.addEdge('b3_f1_c_-28.6', 'custom_b3_f1_c_60_-257_skf', 2.9);
        g.addEdge('b3_f1_c_-45.5', 'b3_f1_c_-46.0', 0.5);
        g.addEdge('b3_f1_c_-45.5', 'door_corr_room_3_1_145', 0.9);
        g.addEdge('b3_f1_c_-45.5', 'custom_b3_f1_c_59_-431_8or', 2.4);
        g.addEdge('b3_f1_c_-46.0', 'b3_f1_stair_north', 4.4);
        g.addEdge('b3_f1_c_-46.0', 'door_corr_room_3_1_157', 0.9);
        g.addEdge('b3_f1_c_-46.0', 'custom_b3_f1_c_59_-476_pow', 1.6);
        g.addEdge('b3_f1_c_-55.0', 'door_corr_room_3_1_148', 1.2);
        g.addEdge('b3_f1_c_-55.0', 'custom_b3_f1_c_59_-579_ud7', 2.9);
        // убран ошибочный выход сквозь глухую стену ЛК №2 Корпуса 3 (b3_f1_entrance_south)
        g.addEdge('b3_f1_stair_north', 'b3_f1_stair_north_wp', 2.7);
        g.addEdge('b3_f1_stair_north_wp', 'b3_f1_entrance_north', 3.2);
        g.addEdge('room_1_1_0', 'door_room_room_1_1_0', 3.7);
        g.addEdge('door_mid_room_1_1_0', 'door_room_room_1_1_0', 0.4);
        g.addEdge('door_mid_room_1_1_0', 'door_corr_room_1_1_0', 0.4);
        g.addEdge('room_1_1_1', 'door_room_room_1_1_1', 1.5);
        g.addEdge('door_mid_room_1_1_1', 'door_room_room_1_1_1', 0.4);
        g.addEdge('door_mid_room_1_1_1', 'door_corr_room_1_1_1', 0.4);
        g.addEdge('room_1_1_5', 'door_room_room_1_1_5', 3.6);
        g.addEdge('door_mid_room_1_1_5', 'door_room_room_1_1_5', 0.4);
        g.addEdge('door_mid_room_1_1_5', 'door_corr_room_1_1_5', 0.4);
        g.addEdge('room_1_1_6', 'door_room_room_1_1_6', 1.2);
        g.addEdge('door_mid_room_1_1_6', 'door_room_room_1_1_6', 0.4);
        g.addEdge('door_mid_room_1_1_6', 'door_corr_room_1_1_6', 0.4);
        g.addEdge('room_1_1_7', 'door_room_room_1_1_7', 1.2);
        g.addEdge('door_mid_room_1_1_7', 'door_room_room_1_1_7', 0.4);
        g.addEdge('door_mid_room_1_1_7', 'door_corr_room_1_1_7', 0.4);
        g.addEdge('room_1_1_9', 'door_room_room_1_1_9', 1.2);
        g.addEdge('door_mid_room_1_1_9', 'door_room_room_1_1_9', 0.4);
        g.addEdge('door_mid_room_1_1_9', 'door_corr_room_1_1_9', 0.4);
        g.addEdge('room_2_1_94', 'door_room_room_2_1_94', 1.3);
        g.addEdge('door_mid_room_2_1_94', 'door_room_room_2_1_94', 0.4);
        g.addEdge('door_mid_room_2_1_94', 'door_corr_room_2_1_94', 0.4);
        g.addEdge('door_corr_room_2_1_94', 'custom_b2_f1_c_246_-58_wff', 1.0);
        g.addEdge('room_2_1_95', 'door_room_room_2_1_95', 2.7);
        g.addEdge('door_mid_room_2_1_95', 'door_room_room_2_1_95', 0.4);
        g.addEdge('door_mid_room_2_1_95', 'door_corr_room_2_1_95', 0.4);
        g.addEdge('door_corr_room_2_1_95', 'custom_b2_f1_c_334_-58_oms', 1.0);
        g.addEdge('room_2_1_96', 'door_room_room_2_1_96', 0.7);
        g.addEdge('door_mid_room_2_1_96', 'door_room_room_2_1_96', 0.4);
        g.addEdge('door_mid_room_2_1_96', 'door_corr_room_2_1_96', 0.4);
        g.addEdge('door_corr_room_2_1_96', 'custom_b2_f1_c_402_-58_rs0', 1.0);
        g.addEdge('room_2_1_97', 'door_room_room_2_1_97', 1.6);
        g.addEdge('door_mid_room_2_1_97', 'door_room_room_2_1_97', 0.4);
        g.addEdge('door_mid_room_2_1_97', 'door_corr_room_2_1_97', 0.4);
        g.addEdge('room_2_1_98', 'door_room_room_2_1_98', 4.2);
        g.addEdge('door_mid_room_2_1_98', 'door_room_room_2_1_98', 0.4);
        g.addEdge('door_mid_room_2_1_98', 'door_corr_room_2_1_98', 0.4);
        g.addEdge('room_2_1_99', 'door_room_room_2_1_99', 2.7);
        g.addEdge('door_mid_room_2_1_99', 'door_room_room_2_1_99', 0.4);
        g.addEdge('door_mid_room_2_1_99', 'door_corr_room_2_1_99', 0.4);
        g.addEdge('door_corr_room_2_1_100', 'room_2_1_101', 1.1);
        g.addEdge('door_corr_room_2_1_100', 'custom_b2_f1_c_620_-125_vbv', 3.7);
        g.addEdge('room_2_1_101', 'custom_b2_f1_c_626_-58_pxf', 2.2);
        g.addEdge('room_2_1_103', 'door_room_room_2_1_103', 4.1);
        g.addEdge('door_mid_room_2_1_103', 'door_room_room_2_1_103', 0.4);
        g.addEdge('door_mid_room_2_1_103', 'door_corr_room_2_1_103', 0.4);
        g.addEdge('door_corr_room_2_1_103', 'custom_b2_f1_c_317_-58_it3', 1.0);
        g.addEdge('room_2_1_104', 'door_room_room_2_1_104', 3.5);
        g.addEdge('door_mid_room_2_1_104', 'door_room_room_2_1_104', 0.4);
        g.addEdge('door_mid_room_2_1_104', 'door_corr_room_2_1_104', 0.4);
        g.addEdge('room_2_1_105', 'door_room_room_2_1_105', 4.4);
        g.addEdge('door_mid_room_2_1_105', 'door_room_room_2_1_105', 0.4);
        g.addEdge('door_mid_room_2_1_105', 'door_corr_room_2_1_105', 0.4);
        g.addEdge('door_corr_room_2_1_105', 'custom_b2_f1_c_570_-58_cc0', 1.0);
        g.addEdge('room_3_1_139', 'custom_b3_f1_c_60_-205_o4u', 2.8);
        g.addEdge('room_3_1_140', 'door_room_room_3_1_140', 3.0);
        g.addEdge('door_mid_room_3_1_140', 'door_room_room_3_1_140', 0.4);
        g.addEdge('door_mid_room_3_1_140', 'custom_b3_f1_c_60_-232_qzy', 1.2);
        g.addEdge('room_3_1_141', 'door_room_room_3_1_141', 3.0);
        g.addEdge('door_mid_room_3_1_141', 'door_room_room_3_1_141', 0.4);
        g.addEdge('door_mid_room_3_1_141', 'door_corr_room_3_1_141', 0.4);
        g.addEdge('door_corr_room_3_1_141', 'custom_b3_f1_c_60_-257_skf', 0.8);
        g.addEdge('room_3_1_142', 'door_mid_room_3_1_142', 3.4);
        g.addEdge('door_mid_room_3_1_142', 'custom_b3_f1_c_59_-313_m4p', 1.3);
        g.addEdge('room_3_1_143', 'door_room_room_3_1_143', 3.0);
        g.addEdge('door_mid_room_3_1_143', 'door_room_room_3_1_143', 0.4);
        g.addEdge('door_mid_room_3_1_143', 'door_corr_room_3_1_143', 0.4);
        g.addEdge('door_corr_room_3_1_143', 'custom_b3_f1_c_59_-375_zxo', 0.9);
        g.addEdge('room_3_1_144', 'door_room_room_3_1_144', 3.0);
        g.addEdge('door_mid_room_3_1_144', 'door_room_room_3_1_144', 0.4);
        g.addEdge('door_room_room_3_1_144', 'custom_b3_f1_c_59_-431_8or', 1.7);
        g.addEdge('room_3_1_145', 'door_room_room_3_1_145', 3.0);
        g.addEdge('door_mid_room_3_1_145', 'door_room_room_3_1_145', 0.4);
        g.addEdge('door_mid_room_3_1_145', 'door_corr_room_3_1_145', 0.4);
        g.addEdge('room_3_1_145', 'b3_f1_exit_112_door', 3.4);
        g.addEdge('b3_f1_exit_112_door', 'b3_f1_exit_112_porch', 1.2);
        g.addEdge('b3_f1_exit_112_porch', 'outdoor_node_86645', 6.1);
        g.addEdge('room_3_1_146', 'door_room_room_3_1_146', 3.0);
        g.addEdge('door_mid_room_3_1_146', 'door_room_room_3_1_146', 0.4);
        g.addEdge('door_mid_room_3_1_146', 'custom_b3_f1_c_59_-476_pow', 1.3);
        g.addEdge('room_3_1_147', 'door_room_room_3_1_147', 3.1);
        g.addEdge('door_mid_room_3_1_147', 'door_room_room_3_1_147', 0.4);
        g.addEdge('door_mid_room_3_1_147', 'custom_b3_f1_c_59_-491_r17', 1.4);
        g.addEdge('room_3_1_148', 'door_room_room_3_1_148', 4.9);
        g.addEdge('door_mid_room_3_1_148', 'door_room_room_3_1_148', 0.4);
        g.addEdge('door_mid_room_3_1_148', 'door_corr_room_3_1_148', 0.4);
        g.addEdge('door_corr_room_3_1_148', 'custom_b3_f1_c_59_-511_sy7', 2.7);
        g.addEdge('room_3_1_149', 'door_room_room_3_1_149', 4.0);
        g.addEdge('door_mid_room_3_1_149', 'door_room_room_3_1_149', 0.4);
        g.addEdge('door_mid_room_3_1_149', 'door_corr_room_3_1_149', 0.4);
        g.addEdge('room_3_1_150', 'door_room_room_3_1_150', 2.7);
        g.addEdge('door_mid_room_3_1_150', 'door_room_room_3_1_150', 0.4);
        g.addEdge('door_mid_room_3_1_150', 'custom_b3_f1_c_59_-313_m4p', 1.3);
        g.addEdge('room_3_1_151', 'door_room_room_3_1_151', 1.0);
        g.addEdge('door_room_room_3_1_151', 'custom_b3_f1_c_21_-356_8ss', 1.0);
        g.addEdge('room_3_1_152', 'custom_b3_f1_c_42_-395_irx', 1.9);
        g.addEdge('room_3_1_153', 'door_room_room_3_1_153', 0.9);
        g.addEdge('door_room_room_3_1_153', 'b3_f1_tambur_108', 0.8);
        g.addEdge('b3_f1_tambur_108', 'b3_f1_door_tambur_108', 1.0);
        g.addEdge('b3_f1_door_tambur_108', 'custom_b3_f1_c_21_-356_8ss', 1.9);
        g.addEdge('b3_f1_tambur_108', 'b3_f1_entrance_west', 1.2);
        g.addEdge('room_3_1_154', 'door_room_room_3_1_154', 4.0);
        g.addEdge('door_mid_room_3_1_154', 'door_room_room_3_1_154', 0.4);
        g.addEdge('door_mid_room_3_1_154', 'door_corr_room_3_1_154', 0.4);
        g.addEdge('door_room_room_3_1_154', 'custom_b3_f1_c_42_-395_irx', 0.9);
        g.addEdge('door_corr_room_3_1_154', 'custom_b3_f1_c_59_-404_5kk', 0.9);
        g.addEdge('room_3_1_155', 'door_room_room_3_1_155', 0.9);
        g.addEdge('door_mid_room_3_1_155', 'door_room_room_3_1_155', 0.4);
        g.addEdge('door_mid_room_3_1_155', 'door_corr_room_3_1_155', 0.4);
        g.addEdge('door_corr_room_3_1_155', 'custom_b3_f1_c_59_-420_6z7', 0.9);
        g.addEdge('room_3_1_156', 'custom_b3_f1_c_59_-431_8or', 5.7);
        g.addEdge('room_3_1_157', 'door_room_room_3_1_157', 2.7);
        g.addEdge('door_mid_room_3_1_157', 'door_room_room_3_1_157', 0.4);
        g.addEdge('door_mid_room_3_1_157', 'door_corr_room_3_1_157', 0.4);
        g.addEdge('room_3_1_158', 'door_room_room_3_1_158', 2.7);
        g.addEdge('door_mid_room_3_1_158', 'door_room_room_3_1_158', 0.4);
        g.addEdge('door_mid_room_3_1_158', 'custom_b3_f1_c_59_-491_r17', 1.3);
        g.addEdge('room_3_1_159', 'door_room_room_3_1_159', 3.0);
        g.addEdge('door_mid_room_3_1_159', 'door_room_room_3_1_159', 0.4);
        g.addEdge('door_mid_room_3_1_159', 'door_corr_room_3_1_159', 0.4);
        g.addEdge('door_corr_room_3_1_159', 'custom_b3_f1_c_59_-511_sy7', 0.9);
        g.addEdge('room_3_1_160', 'door_room_3_1_160', 3.1);
        g.addEdge('door_room_3_1_160', 'b3_f1_vest_north', 1.3);
        g.addEdge('b3_f1_vest_north', 'b3_f1_c_-55.0', 2.0);
        // убрано ребро сквозь стены кабинета 12 (обход через восточный коридор и холл)
        // Вход в кабинет 12 (room_4_1_191) из коридора без пересечения стен комнат 5-7
        g.addEdge('custom_b2_f1_c_226_-58_h4c', 'custom_b2_f1_c_246_-58_wff', 2.0);
        g.addEdge('custom_b2_f1_c_620_-125_vbv', 'custom_b2_f1_c_629_-125_vmm', 0.9);
        g.addEdge('custom_b2_f1_c_317_-58_it3', 'custom_b2_f1_c_334_-58_oms', 1.7);
        g.addEdge('custom_b2_f1_c_317_-58_it3', 'custom_b2_f1_c_246_-58_wff', 7.1);
        g.addEdge('custom_b3_f1_c_59_-313_m4p', 'custom_b3_f1_c_59_-356_xpk', 4.3);
        g.addEdge('custom_b3_f1_c_59_-356_xpk', 'custom_b3_f1_c_59_-375_zxo', 1.9);
        g.addEdge('custom_b3_f1_c_59_-356_xpk', 'custom_b3_f1_c_21_-356_8ss', 3.8);
        g.addEdge('custom_b3_f1_c_59_-375_zxo', 'custom_b3_f1_c_59_-404_5kk', 2.9);
        g.addEdge('custom_b3_f1_c_59_-404_5kk', 'custom_b3_f1_c_59_-420_6z7', 1.6);
        g.addEdge('custom_b3_f1_c_59_-420_6z7', 'custom_b3_f1_c_59_-431_8or', 1.1);
        g.addEdge('custom_b3_f1_c_59_-579_ud7', 'custom_b3_f1_c_102_-579_32j', 4.3);
        g.addEdge('custom_b3_f1_c_60_-205_o4u', 'custom_b3_f1_c_60_-232_qzy', 2.7);
        g.addEdge('custom_b3_f1_c_60_-232_qzy', 'custom_b3_f1_c_60_-257_skf', 2.5);
        g.addEdge('custom_b3_f1_c_60_-257_skf', 'custom_b3_f1_c_73_-257_vh5', 1.3);
        g.addEdge('custom_b3_f1_c_73_-257_vh5', 'custom_b3_f1_c_106_-257_yy3', 3.3);
        g.addEdge('custom_b3_f1_c_59_-476_pow', 'custom_b3_f1_c_59_-491_r17', 1.5);
        g.addEdge('custom_b3_f1_c_59_-491_r17', 'custom_b3_f1_c_59_-511_sy7', 2.0);
        g.addEdge('room_1_1_3', 'custom_b1_f1_c_61_-132_nb8', 3.2);
        g.addEdge('b1_f1_nc_5.9', 'custom_b1_f1_c_58_-72_tpz', 1.4);
        g.addEdge('custom_b1_f1_c_58_-72_tpz', 'room_1_1_4', 3.5);
        g.addEdge('custom_b1_f1_c_58_-72_tpz', 'custom_b1_f1_c_58_-101_wov', 2.9);
        g.addEdge('custom_b1_f1_c_58_-101_wov', 'custom_b1_f1_c_61_-132_nb8', 3.1);
        g.addEdge('custom_b1_f1_c_58_-101_wov', 'door_corr_room_1_1_1', 0.8);
        g.addEdge('room_1_1_2', 'custom_b1_f1_c_58_-101_wov', 0.2);
        g.addEdge('b2_f1_c_47.0', 'custom_b2_f1_c_500_-59_9s1', 3.0);
        g.addEdge('custom_b2_f1_c_500_-59_9s1', 'door_corr_room_2_1_98', 0.9);
        g.addEdge('custom_b2_f1_c_500_-59_9s1', 'custom_b2_f1_c_570_-58_cc0', 7.0);
        // === УЛИЧНЫЕ СВЯЗИ (OUTDOOR EDGES) ===
        g.addEdge('outdoor_node_86645', 'outdoor_node_90724');
        g.addEdge('outdoor_node_90724', 'outdoor_node_78');
        g.addEdge('outdoor_node_78', 'outdoor_node_52241');
        g.addEdge('outdoor_node_52241', 'custom_b4_f1_c_438_-321_ent', 0.5);
        g.addEdge('outdoor_node_78', 'outdoor_node_79023');
        g.addEdge('outdoor_node_79023', 'outdoor_node_81120');
        g.addEdge('outdoor_node_81120', 'b2_f1_stair_lk2');
        // Обход угла ЛК №2 Корпуса 4 на улице (без пересечения внешних стен)
        g.addNode('outdoor_b4_porch_corner', 1, 0, 26.0, -52.0, 'corridor', 'Улица');
        g.addEdge('b4_f1_porch', 'outdoor_b4_porch_corner', 4.1);
        g.addEdge('outdoor_b4_porch_corner', 'outdoor_node_86645', 8.2);
        // Связи восточного выхода Корпуса 3 во двор (между 105 и 102)
        g.addEdge('b3_f1_c_-28.6', 'b3_f1_d_corr_east_exit', 1.4);
        g.addEdge('b3_f1_d_corr_east_exit', 'b3_f1_exit_east_inner', 2.3);
        g.addEdge('b3_f1_exit_east_inner', 'b3_f1_exit_east_door', 4.4);
        g.addEdge('b3_f1_exit_east_door', 'outdoor_node_74046', 1.4);
        g.addEdge('outdoor_node_90724', 'outdoor_node_74046', 11.0);
        g.addEdge('outdoor_node_86645', 'outdoor_node_74046', 17.8);


                // Связи комнат К4 этажи 2 и 3
        g.addEdge('room_4_3_237', 'custom_b4_f3_c_481_-486_kaq', 0.2);
        g.addEdge('room_4_3_238', 'custom_b4_f3_c_518_-448_vn9', 0.5);
        g.addEdge('room_4_3_239', 'custom_b4_f3_c_445_-448_u0o', 0.5);
        g.addEdge('room_4_3_240', 'custom_b4_f3_c_466_-415_85f', 0.2);
        g.addEdge('room_4_3_242', 'custom_b4_f3_c_467_-285_r9w', 0.2);
        g.addEdge('room_4_2_228', 'custom_b4_f2_c_470_-387_ba7', 0.2);
        g.addEdge('room_4_2_220', 'custom_b4_f2_c_596_-481_2t5', 0.2);
        g.addEdge('room_4_2_212', 'b4_f2_stair_lk2', 0.1);
        g.addEdge('room_4_2_213', 'bridge_k3_k4_f2', 0.1);
        g.addEdge('room_4_2_214', 'bridge_k4_k2_f2', 0.1);
        g.addEdge('room_4_2_221', 'b4_f2_stair_lk3', 0.1);
        g.addEdge('room_4_3_234', 'b4_f3_stair_lk2', 0.1);

        // --- КОРПУС 4 — ЭТАЖ 1 СВЯЗИ (0 КОЛЛИЗИЙ) ---
        g.addEdge('b4_f1_stair_lk1', 'b4_f1_stair_lk1_door', 3.4);
        g.addEdge('b4_f1_stair_lk1_door', 'b4_f1_foyer_center', 1.8);
        g.addEdge('b4_f1_foyer_center', 'b4_f1_foyer_entrance', 3.3);
        g.addEdge('b4_f1_foyer_center', 'b4_f1_foyer_door_102', 4.1);
        g.addEdge('b4_f1_foyer_door_102', 'b4_f1_door_102_inside', 1.0);
        g.addEdge('b4_f1_door_102_inside', 'room_4_1_184', 10.1);
        g.addEdge('b4_f1_foyer_center', 'b4_f1_c_366_320', 4.0);
        g.addEdge('b4_f1_c_366_320', 'b4_f1_c_366_334', 0.4);
        g.addEdge('b4_f1_c_366_334', 'door_room_4_1_183', 0.4);
        g.addEdge('door_room_4_1_183', 'room_4_1_183', 1.9);
        g.addEdge('b4_f1_c_366_334', 'b4_f1_c_366_400', 6.6);
        g.addEdge('b4_f1_c_366_400', 'door_room_4_1_182', 0.4);
        g.addEdge('door_room_4_1_182', 'room_4_1_182', 2.0);
        g.addEdge('b4_f1_c_366_400', 'b4_f1_c_366_462', 6.2);
        g.addEdge('b4_f1_c_366_462', 'b4_f1_nc_382', 1.6);
        g.addEdge('b4_f1_stair_lk2', 'b4_f1_stair_lk2_door', 3.1);
        g.addEdge('b4_f1_stair_lk2_door', 'b4_f1_nc_324', 0.2);
        g.addEdge('b4_f1_stair_lk2', 'b4_f1_porch', 3.0);
        g.addEdge('b4_f1_nc_324', 'b4_f1_c_366_462', 4.2);
        g.addEdge('b4_f1_nc_382', 'door_room_4_1_186', 0.8);
        g.addEdge('door_room_4_1_186', 'room_4_1_186', 4.1);
        g.addEdge('b4_f1_nc_382', 'b4_f1_nc_404', 2.2);
        g.addEdge('b4_f1_nc_404', 'door_room_4_1_187', 0.8);
        g.addEdge('door_room_4_1_187', 'room_4_1_187', 4.1);
        g.addEdge('b4_f1_nc_404', 'b4_f1_nc_414', 1.0);
        g.addEdge('b4_f1_nc_414', 'b4_f1_nc_432', 1.8);
        g.addEdge('b4_f1_nc_432', 'door_room_4_1_188', 0.8);
        g.addEdge('door_room_4_1_188', 'room_4_1_188', 1.5);
        g.addEdge('door_room_4_1_188', 'door_room_4_1_189', 3.0);
        g.addEdge('door_room_4_1_189', 'room_4_1_189', 2.6);
        g.addEdge('b4_f1_nc_432', 'b4_f1_nc_450', 1.8);
        g.addEdge('b4_f1_nc_450', 'b4_f1_nc_500', 5.0);
        g.addEdge('b4_f1_nc_500', 'room_4_1_192', 1.4);
        g.addEdge('b4_f1_door_102_inside', 'b4_f1_c_102_east', 17.4);
        g.addEdge('b4_f1_c_102_east', 'room_4_1_184', 9.8);
        g.addEdge('b4_f1_c_102_east', 'door_102_to_18', 0.9);
        g.addEdge('door_102_to_18', 'room_4_1_196', 2.2);
        g.addEdge('room_4_1_196', 'b4_f1_stair_lk3_door', 2.0);
        g.addEdge('b4_f1_stair_lk3_door', 'b4_f1_stair_lk3', 3.6);
        g.addEdge('b4_f1_nc_414', 'b4_f1_c414_489', 2.7);
        g.addEdge('b4_f1_c414_489', 'door_room_4_1_198', 1.0);
        g.addEdge('door_room_4_1_198', 'room_4_1_198', 2.6);
        g.addEdge('b4_f1_c414_489', 'door_room_4_1_190', 2.8);
        g.addEdge('door_room_4_1_190', 'room_4_1_190', 1.6);
        g.addEdge('b4_f1_c414_489', 'b4_f1_c414_512', 2.3);
        g.addEdge('b4_f1_c414_512', 'door_room_4_1_199', 1.0);
        g.addEdge('door_room_4_1_199', 'room_4_1_199', 2.7);
        g.addEdge('b4_f1_c414_512', 'b4_f1_c414_526', 1.4);
        g.addEdge('b4_f1_c414_526', 'door_room_4_1_200', 1.0);
        g.addEdge('door_room_4_1_200', 'room_4_1_200', 2.7);
        g.addEdge('b4_f1_c414_526', 'door_room_4_1_191', 1.0);
        g.addEdge('door_room_4_1_191', 'room_4_1_191', 1.0);
        g.addEdge('b4_f1_c414_526', 'b4_f1_c414_540', 1.4);
        g.addEdge('b4_f1_c414_540', 'door_room_4_1_201', 1.0);
        g.addEdge('door_room_4_1_201', 'room_4_1_201', 2.7);
        g.addEdge('b4_f1_c414_540', 'b4_f1_c414_551', 1.1);
        g.addEdge('b4_f1_c414_551', 'b4_f1_c414_556', 0.5);
        g.addEdge('b4_f1_c414_556', 'door_room_4_1_202', 1.0);
        g.addEdge('door_room_4_1_202', 'room_4_1_202', 2.6);
        g.addEdge('b4_f1_c414_556', 'b4_f1_c414_572', 1.6);
        g.addEdge('b4_f1_c414_572', 'door_room_4_1_203', 1.0);
        g.addEdge('door_room_4_1_203', 'room_4_1_203', 2.6);
        g.addEdge('b4_f1_c414_572', 'b4_f1_c414_581', 0.9);
        g.addEdge('b4_f1_c414_581', 'door_room_4_1_205', 1.0);
        g.addEdge('door_room_4_1_205', 'room_4_1_205', 1.0);
        g.addEdge('b4_f1_c414_581', 'b4_f1_c414_593', 1.2);
        g.addEdge('b4_f1_c414_593', 'door_room_4_1_204', 1.0);
        g.addEdge('door_room_4_1_204', 'room_4_1_204', 2.6);
        g.addEdge('b4_f1_c414_551', 'b4_f1_kc_450', 3.6);
        g.addEdge('b4_f1_kc_450', 'b4_f1_kc_469', 1.9);
        g.addEdge('b4_f1_kc_469', 'door_room_4_1_193', 0.9);
        g.addEdge('door_room_4_1_193', 'room_4_1_193', 2.2);
        g.addEdge('b4_f1_kc_469', 'door_room_4_1_206', 0.9);
        g.addEdge('door_room_4_1_206', 'room_4_1_206', 2.2);
        g.addEdge('room_4_1_206', 'door_room_4_1_206_207', 1.7);
        g.addEdge('door_room_4_1_206_207', 'room_4_1_207', 1.8);
        g.addEdge('b4_f1_kc_469', 'b4_f1_kc_503', 3.4);
        g.addEdge('b4_f1_kc_503', 'door_room_4_1_194', 0.9);
        g.addEdge('door_room_4_1_194', 'room_4_1_194', 2.2);
        g.addEdge('b4_f1_kc_503', 'door_room_4_1_207', 0.9);
        g.addEdge('door_room_4_1_207', 'room_4_1_207', 2.2);
        g.addEdge('b4_f1_kc_503', 'b4_f1_kc_537', 3.4);
        g.addEdge('b4_f1_kc_537', 'door_room_4_1_195', 0.9);
        g.addEdge('door_room_4_1_195', 'room_4_1_195', 2.2);
        g.addEdge('b4_f1_kc_537', 'b4_f1_kc_544', 0.7);
        g.addEdge('b4_f1_kc_544', 'door_room_4_1_210', 3.2);
        g.addEdge('door_room_4_1_210', 'room_4_1_210', 2.0);
        g.addEdge('b4_f1_kc_544', 'door_room_4_1_208', 0.9);
        g.addEdge('door_room_4_1_208', 'room_4_1_208', 1.4);
        g.addEdge('door_room_4_1_208', 'door_room_4_1_209', 3.8);
        g.addEdge('door_room_4_1_209', 'room_4_1_209', 2.0);
        g.addEdge('room_4_1_196', 'door_room_4_1_197', 2.2);
        g.addEdge('door_room_4_1_197', 'room_4_1_197', 2.3);
        g.addEdge('custom_b4_f1_c_406_-322_sat', 'b4_f1_foyer_center', 1.2);
        g.addEdge('custom_b4_f1_c_406_-322_sat', 'custom_b4_f1_c_438_-321_ent', 3.2);
        g.addEdge('b4_f1_foyer_entrance', 'custom_b4_f1_c_438_-321_ent', 0.2);

        return g;
    }




    // ------------------------------------------------------------------------
    // ПОИСК БЛИЖАЙШЕГО ТУАЛЕТА (С/У)
    // ------------------------------------------------------------------------
    function findClosestToilet(fromPoint) {
        if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
        const g = NAV_STATE.graph;

        let startP = fromPoint;
        if (!startP) {
            startP = g.getNode('b1_f1_entrance_main');
        }
        if (!startP) return null;

        const startFloor = startP.floor || 1;
        const startBldg = startP.building || startP.bldg || 1;
        const startX = startP.x !== undefined ? startP.x : 10.5;
        const startZ = startP.z !== undefined ? startP.z : 10.4;

        if (typeof ROOMS_REGISTRY === 'undefined' || !Array.isArray(ROOMS_REGISTRY)) {
            return null;
        }

        const toilets = ROOMS_REGISTRY.filter(r => {
            const t = (r.text || '').trim();
            const raw = (r.rawText || '').trim();
            return t === 'С/У' || raw === 'С/У' || t === '\u0421/\u0423' || t.toLowerCase().includes('туалет') || t.toLowerCase().includes('санузел');
        });

        if (toilets.length === 0) return null;

        let bestToilet = null;
        let bestScore = Infinity;

        for (let i = 0; i < toilets.length; i++) {
            const t = toilets[i];
            const floorDiff = Math.abs(t.floor - startFloor);
            const bldgDiff = (t.building === startBldg) ? 0 : 1;
            const geomDist = Math.hypot(t.x - startX, t.z - startZ);
            // Штраф за смену этажа (20м) и переход в другой корпус (35м)
            const score = geomDist + floorDiff * 20.0 + bldgDiff * 35.0;
            if (score < bestScore) {
                bestScore = score;
                bestToilet = t;
            }
        }

        if (!bestToilet) return null;

        const tIdx = ROOMS_REGISTRY.indexOf(bestToilet);
        const toiletNodeId = `room_${bestToilet.building}_${bestToilet.floor}_${tIdx}`;
        const toiletNode = g.getNode(toiletNodeId);

        return toiletNode || {
            id: toiletNodeId,
            label: `С/У (К-${bestToilet.building}, ${bestToilet.floor} эт.)`,
            floor: bestToilet.floor,
            bldg: bestToilet.building,
            x: bestToilet.x,
            z: bestToilet.z,
            type: 'room'
        };
    }

    function setDefaultStartPoint() {
        if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
        const entrance = NAV_STATE.graph.getNode('b1_f1_entrance_main');
        if (entrance && !NAV_STATE.startPoint) {
            NAV_STATE.startPoint = entrance;
            const inputA = document.getElementById('nav-input-start');
            if (inputA && !inputA.value) {
                inputA.value = 'Главный вход (Корпус 1)';
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
            return disp + ' (' + (b > 1 ? 'К-' + b + ', ' : '') + f + ' эт.)';
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

        function heuristic(uId) {
            const u = graph.getNode(uId);
            const dx = u.x - destNode.x;
            const dz = u.z - destNode.z;
            const df = Math.abs(u.floor - destNode.floor);
            return Math.hypot(dx, dz) + df * 5.0;
        }

        while (!frontier.isEmpty()) {
            const current = frontier.pop();
            if (current === destId) break;

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

        // Восстановление пути
        const path = [];
        let curr = destId;
        while (curr !== null) {
            path.push(curr);
            curr = cameFrom.get(curr);
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
            icon: '<svg class="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6z" /></svg>',
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
                    icon: isElev ? '<svg class="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>' : '<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>',
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
            icon: '<svg class="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" fill="currentColor" /></svg>',
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
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m && m.dispose && m.dispose());
                    } else if (child.material.dispose) {
                        child.material.dispose();
                    }
                }
            });
        }

        // Удаляем объекты пути с каждого этажа
        for (let f = 1; f <= 7; f++) {
            const fg = NAV_STATE.routeFloorGroups[f];
            if (fg) {
                while (fg.children.length > 0) {
                    const obj = fg.children[0];
                    disposeHierarchy(obj);
                    fg.remove(obj);
                }
            }
        }

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

        NAV_STATE.activeRoute = null;
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
        const color = isUp ? 0x10b981 : 0x06b6d4;

        // Кольцо у входа на лестницу
        const ringGeom = new THREE.RingGeometry(0.40, 0.55, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.06;
        group.add(ring);

        return group;
    }

    function drawRoute3D(routeResult) {
        clearRoute3D();
        if (!routeResult || !routeResult.path || routeResult.path.length < 2) return;
        NAV_STATE.activeRoute = routeResult;

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

        // Рендерим 3D-путь на каждом этаже и прикрепляем в соответствующий floorGroups[f]
        for (let f = 1; f <= 7; f++) {
            if (!NAV_STATE.routeFloorGroups[f]) {
                NAV_STATE.routeFloorGroups[f] = new THREE.Group();
                NAV_STATE.routeFloorGroups[f].name = `routeGroup_floor_${f}`;
            }

            const rGroup = NAV_STATE.routeFloorGroups[f];

            // Прикрепляем к системной группе этажа Three.js
            if (window.floorGroups && window.floorGroups[f]) {
                if (rGroup.parent !== window.floorGroups[f]) {
                    window.floorGroups[f].add(rGroup);
                }
            }

            const segs = floorSegments[f];
            if (segs && segs.length > 0) {
                for (const pts of segs) {
                    const mesh = createLuminousRouteMesh(pts);
                    if (mesh) rGroup.add(mesh);
                }
            }
        }

        // Маркер точки "А" (Откуда) — ярко-зелёный
        const startNode = nodes[0];
        const startGroup = NAV_STATE.routeFloorGroups[startNode.floor];
        if (startGroup) {
            const startMarker = createMarkerRing(0x10b981, 'A', true);
            startMarker.position.set(startNode.x, 0.05, startNode.z);
            startGroup.add(startMarker);
        }

        // Маркер точки "Б" (Куда) — ярко-коралловый/красный
        const destNode = nodes[nodes.length - 1];
        const destGroup = NAV_STATE.routeFloorGroups[destNode.floor];
        if (destGroup) {
            const destMarker = createMarkerRing(0xf43f5e, 'B', true);
            destMarker.position.set(destNode.x, 0.05, destNode.z);
            destGroup.add(destMarker);
        }

        // Маркеры межэтажных лестничных переходов
        for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];
            if (curr.floor !== prev.floor) {
                const isUp = curr.floor > prev.floor;
                const fg = NAV_STATE.routeFloorGroups[prev.floor];
                if (fg) {
                    const stairMarker = createStairTransitionMarker(isUp ? `↑ ${curr.floor} эт.` : `↓ ${curr.floor} эт.`, isUp);
                    stairMarker.position.set(prev.x, 0.05, prev.z);
                    fg.add(stairMarker);
                }
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
                        color: (curr.floor > prev.floor) ? 0x10b981 : 0x06b6d4,
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

        updateRouteVisibilityForCurrentMode();
        if (typeof requestRender === 'function') requestRender(30);
    }

    // ------------------------------------------------------------------------
    // ОБНОВЛЕНИЕ ВИДИМОСТИ ПУТИ ВО ВСЕХ РЕЖИМАХ ОТОБРАЖЕНИЯ КАРТЫ
    // ------------------------------------------------------------------------
    function updateRouteVisibilityForCurrentMode() {
        if (!NAV_STATE.activeRoute) return;

        const mode = (typeof STATE !== 'undefined') ? STATE.mode : '1';
        const isSingleFloor = (mode !== 'all' && mode !== 'sideBySide' && mode !== 'slice');
        const activeFloor = isSingleFloor ? parseInt(mode, 10) : 1;
        const maxFloor = (mode === 'slice') ? STATE.sliceMaxFloor : 7;

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
        }

        if (NAV_STATE.globalRouteGroup) {
            // Межэтажные вертикальные 3D-марши показываем только в общем 3D режиме 'all'
            NAV_STATE.globalRouteGroup.visible = (mode === 'all');
        }
    }

    // ------------------------------------------------------------------------
    // АНИМАЦИЯ ПУЛЬСАЦИИ И ИМПУЛЬСОВ МАРШРУТА
    // ------------------------------------------------------------------------
    function updateNavigatorAnimation(delta) {
        if (!NAV_STATE.activeRoute) return;

        NAV_STATE.animationTime += (delta || 16) * 0.003;
        const scalePulse = 1.0 + Math.sin(NAV_STATE.animationTime * 4.0) * 0.12;
        const opacityPulse = 0.75 + Math.sin(NAV_STATE.animationTime * 4.0) * 0.25;

        for (let f = 1; f <= 7; f++) {
            const rGroup = NAV_STATE.routeFloorGroups[f];
            if (!rGroup || !rGroup.visible) continue;

            rGroup.traverse((child) => {
                if (child.userData && child.userData.isPulsing) {
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
            });
        }
    }

    // ------------------------------------------------------------------------
    // SCREEN-SPACE RETINA БЕЙДЖИ ДЛЯ ТОЧЕК "А", "Б" И ЛЕСТНИЦ НА 2D CANVAS
    // ------------------------------------------------------------------------
    const _tempVec = new THREE.Vector3();

    function renderNavigatorScreenBadges(ctx, dpr, width, height) {
        if (!NAV_STATE.activeRoute || !window.camera) return;

        const route = NAV_STATE.activeRoute;
        const mode = (typeof STATE !== 'undefined') ? STATE.mode : '1';
        const isSingleFloor = (mode !== 'all' && mode !== 'sideBySide' && mode !== 'slice');
        const activeFloor = isSingleFloor ? parseInt(mode, 10) : 1;

        const startNode = route.startNode;
        const destNode = route.destNode;

        function drawScreenBadge(node, label, badgeColor, isDest = false) {
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
            const textWidth = ctx.measureText(label).width;
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

            // Белая обводка
            ctx.shadowColor = 'transparent';
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Иконка точки (кружочек с белой каймой)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bx + 14, by + bHeight / 2, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.arc(bx + 14, by + bHeight / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Текст бейджа
            ctx.fillStyle = '#ffffff';
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

            ctx.restore();
        }

        // Рисуем бейдж Откуда
        drawScreenBadge(startNode, `A: ${formatNavNodeName(startNode.label, startNode.bldg)}`, '#059669', false);
        // Рисуем бейдж Куда
        drawScreenBadge(destNode, `B: ${formatNavNodeName(destNode.label, destNode.bldg)}`, '#e11d48', true);

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
        const text = st.isUp ? `↑ Лестница на ${st.toFloor} эт.` : `↓ Лестница на ${st.toFloor} эт.`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const tw = ctx.measureText(text).width;
        const bw = tw + 18;
        const bh = 22;
        const bx = sx - bw / 2;
        const by = sy - bh;

        ctx.fillStyle = st.isUp ? '#059669' : '#0284c7';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 5);
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, sx, by + bh / 2);

        ctx.restore();
    }

    // ------------------------------------------------------------------------
    // ПУБЛИЧНЫЙ МЕТОД ПОСТРОЕНИЯ МАРШРУТА
    // ------------------------------------------------------------------------
    function buildRoute(startPoint, destPoint) {
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

        // Оценка времени пешком (скорость ~1.15 м/с)
        const durationMin = Math.max(1, Math.round((result.totalDistance / 1.15) / 60 * 10) / 10);

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

        NAV_STATE.activeRoute = routeData;
        NAV_STATE.startPoint = startPoint;
        NAV_STATE.destPoint = destPoint;

        // Отрисовка в 3D
        drawRoute3D(routeData);

        // Обновление UI
        updateRouteCardUI(routeData);

        // Если маршрут охватывает корпус, который сейчас скрыт фильтром, переключаем фильтр на 'both'
        const bldgSet = new Set(nodes.map(n => n.bldg));
        if (bldgSet.size > 1 && typeof setBuildingFilter === 'function' && STATE.buildingFilter !== 'both') {
            setBuildingFilter('both', false);
        }

        // Переключаем этаж карты на этаж отправления
        if (typeof setMode === 'function' && String(startPoint.floor) !== STATE.mode) {
            setMode(String(startPoint.floor));
        }

        // Фокусируем камеру на начальном отрезке пути
        focusCameraOnSegment(nodes[0]);

        return routeData;
    }

    function focusCameraOnSegment(node) {
        if (!node || typeof THREE === 'undefined') return;

        const targetY = (STATE && STATE.is2D) ? 38 : 28;
        const camZOffset = (STATE && STATE.is2D) ? 14 : 30;
        const camXOffset = (STATE && STATE.is2D) ? 0 : -14;

        STATE.targetControlsCenter = new THREE.Vector3(node.x, 0, node.z);
        STATE.targetCamPos = new THREE.Vector3(node.x + camXOffset, targetY, node.z + camZOffset);

        if (typeof requestRender === 'function') requestRender(40);
    }

    // ------------------------------------------------------------------------
    // ОБРАБОТКА КЛИКОВ ПО КАРТЕ ДЛЯ ВЫБОРА ТОЧЕК МАРШРУТА
    // ------------------------------------------------------------------------
    function handleNavigatorMapClick(event) {
        if (!NAV_STATE.pickingMode) return false;

        // Если есть бейдж кабинета под курсором
        if (Array.isArray(window.renderedScreenBadges) && window.renderedScreenBadges.length > 0) {
            const cx = event.clientX;
            const cy = event.clientY;
            const hitMargin = 12;

            for (let i = window.renderedScreenBadges.length - 1; i >= 0; i--) {
                const b = window.renderedScreenBadges[i];
                if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
                    cy >= b.y0 - hitMargin && cy <= b.y1 + hitMargin) {
                    onLocationPicked(b.room);
                    return true;
                }
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

        // Находим соответствующий узел комнаты в графе
        let matchedNodeId = null;
        for (const [nid, n] of g.nodes.entries()) {
            if (n.floor === roomInfo.floor && n.bldg === roomInfo.building &&
                Math.hypot(n.x - roomInfo.x, n.z - roomInfo.z) < 0.2) {
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
            text: roomInfo.text ? roomInfo.text.replace('\n', ' ') : 'Кабинет',
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

        // Дистанция и время
        const distEl = document.getElementById('nav-card-dist');
        const timeEl = document.getElementById('nav-card-time');
        const floorsContainer = document.getElementById('nav-card-floors');
        const titleEl = document.getElementById('nav-card-title');

        if (distEl) distEl.textContent = `${route.totalDistance} м`;
        if (timeEl) timeEl.textContent = `~${route.durationMin} мин`;
        if (titleEl) {
            titleEl.textContent = `${route.startNode.label} ➔ ${route.destNode.label}`;
            titleEl.onclick = openNavigatorModal;
        }

        // Этажные кнопки переключения
        if (floorsContainer) {
            floorsContainer.innerHTML = '';
            route.involvedFloors.forEach(f => {
                const btn = document.createElement('button');
                btn.className = `px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    String(f) === STATE.mode ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/60'
                }`;
                btn.innerHTML = `<span>${f} эт.</span>`;
                btn.onclick = () => {
                    if (typeof setMode === 'function') {
                        setMode(String(f));
                        // Перемещаем камеру к началу этого отрезка
                        const firstOnFloor = route.nodes.find(n => n.floor === f);
                        if (firstOnFloor) focusCameraOnSegment(firstOnFloor);
                    }
                };
                floorsContainer.appendChild(btn);
            });
        }

        // Список пошаговых инструкций
        const listEl = document.getElementById('nav-steps-list');
        if (listEl) {
            listEl.innerHTML = '';
            route.instructions.forEach((inst, idx) => {
                const li = document.createElement('li');
                li.className = 'flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-800/50 cursor-pointer text-xs text-slate-200 transition';
                li.innerHTML = `
                    <span class="text-[11px] font-bold text-sky-400 mr-1.5">${idx + 1}.</span>
                    <span class="flex-1 leading-tight">${inst.text}</span>
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
        setDefaultStartPoint();
        const modal = document.getElementById('navigator-modal');
        const backdrop = document.getElementById('navigator-backdrop');
        if (modal && backdrop) {
            modal.classList.add('open', 'active');
            backdrop.classList.add('open', 'active');
            modal.style.visibility = 'visible';
            backdrop.style.visibility = 'visible';
            modal.style.opacity = '1';
            backdrop.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            backdrop.style.pointerEvents = 'auto';
            const inputDest = document.getElementById('nav-input-dest');
            if (inputDest && (!NAV_STATE.destPoint || !inputDest.value)) {
                setTimeout(() => inputDest.focus(), 150);
            }
        }
    }

    function closeNavigatorModal() {
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
    }

    function clearRoute() {
        NAV_STATE.startPoint = null;
        NAV_STATE.destPoint = null;
        NAV_STATE.activeRoute = null;

        const inputA = document.getElementById('nav-input-start');
        const inputB = document.getElementById('nav-input-dest');
        if (inputA) inputA.value = '';
        if (inputB) inputB.value = '';

        const card = document.getElementById('navigator-route-card');
        if (card) card.classList.add('hidden');

        clearRoute3D();
    }

    // ------------------------------------------------------------------------
    // АВТОЗАПОЛНЕНИЕ И ПОИСК КАБИНЕТОВ В ПОЛЯХ НАВИГАТОРА
    // ------------------------------------------------------------------------
    function setupNavigatorAutocomplete(inputId, dropdownId, onSelect) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;

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

            const ROOM_ALIASES = {
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
                'room_2_3_136': '312 2-312 конференц-зал конференц зал собрания'
            };

            const matches = [];
            for (const [nid, n] of g.nodes.entries()) {
                if (n.type === 'room' || n.type === 'entrance') {
                    const lbl = (n.label || '').toLowerCase();
                    const alias = ROOM_ALIASES[nid] || '';
                    if (lbl.includes(query) || `${n.bldg}-${lbl}`.includes(query) || alias.includes(query)) {
                        matches.push(n);
                        if (matches.length >= 8) break;
                    }
                }
            }

            if (matches.length === 0) {
                dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-slate-400">Ничего не найдено</div>';
                dropdown.classList.remove('hidden');
                return;
            }

            dropdown.innerHTML = '';
            matches.forEach(item => {
                const row = document.createElement('div');
                row.className = 'px-3 py-2 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs text-slate-200 border-b border-slate-800/50 last:border-none transition';
                row.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full ${item.type === 'entrance' ? 'bg-amber-400' : 'bg-sky-400'}"></span>
                        <span class="font-semibold">${formatNavNodeName(item.label, item.bldg)}</span>
                    </div>
                    <span class="text-[10px] text-slate-400">Корпус ${item.bldg}, ${item.floor} эт.</span>
                `;
                row.onclick = () => {
                    input.value = `${item.label} (К-${item.bldg}, ${item.floor} эт.)`;
                    dropdown.classList.add('hidden');
                    onSelect(item);
                };
                dropdown.appendChild(row);
            });

            dropdown.classList.remove('hidden');
        });

        // Закрытие выпадающего списка при клике вне
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    // ------------------------------------------------------------------------
    // ИНИЦИАЛИЗАЦИЯ И РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ СОБЫТИЙ
    // ------------------------------------------------------------------------
    function initNavigator() {
        if (NAV_STATE.isInitialized) return;
        NAV_STATE.graph = buildCollegeNavGraph();
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

        // Переключатель лифтов: свич вкл/выкл
        const switchElev = document.getElementById('toggle-elevators-switch');
        const btnElev = document.getElementById('btn-toggle-elevators');
        const elevText = document.getElementById('elevators-status-text');

        function setElevatorsState(enabled) {
            NAV_STATE.allowElevators = !!enabled;
            if (switchElev) switchElev.checked = NAV_STATE.allowElevators;
            const switchLabel = document.getElementById('elevators-switch-label');
            if (switchLabel) {
                const isLight = document.body.getAttribute('data-theme') === 'light';
                if (NAV_STATE.allowElevators) {
                    if (isLight) {
                        switchLabel.style.borderColor = '#0284c7';
                        switchLabel.style.backgroundColor = '#f0f9ff';
                    } else {
                        switchLabel.classList.add('border-sky-500', 'bg-sky-950/30');
                        switchLabel.classList.remove('bg-slate-900/80', 'border-slate-700/80');
                    }
                } else {
                    if (isLight) {
                        switchLabel.style.borderColor = '#cbd5e1';
                        switchLabel.style.backgroundColor = '#ffffff';
                    } else {
                        switchLabel.classList.remove('border-sky-500', 'bg-sky-950/30');
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
                    inputDest.value = `${toilet.label} (К-${toilet.bldg}, ${toilet.floor} эт.)`;
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
            btnCardClose.addEventListener('click', clearRoute);
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
                const banner = document.getElementById('nav-pick-banner');
                if (banner) banner.classList.add('hidden');
                openNavigatorModal();
            });
        }

        // Быстрые чипы популярных направлений
        const chips = document.querySelectorAll('.nav-quick-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const targetText = chip.getAttribute('data-target');
                if (!targetText) return;

                // Находим целевой узел
                const g = NAV_STATE.graph;
                const q = targetText.toLowerCase();
                let targetNode = null;
                for (const node of g.nodes.values()) {
                    if (node.type === 'room' || node.type === 'entrance') {
                        const lbl = (node.label || '').toLowerCase();
                        const isMatch = lbl.includes(q) ||
                            (q === 'столовая' && ((node.bldg === 4 && node.floor === 1 && lbl.includes('102')) || lbl.includes('столов'))) ||
                            (q === 'спортзал' && ((node.bldg === 4 && node.floor === 2 && lbl.includes('206')) || lbl.includes('спортзал'))) ||
                            (q === 'актовый зал' && ((node.bldg === 4 && node.floor === 2 && lbl.includes('204')) || lbl.includes('актовый'))) ||
                            (q === 'главный вход' && node.id === 'b1_f1_entrance_main');
                        if (isMatch) {
                            targetNode = node;
                            break;
                        }
                    }
                }
                if (targetNode) {
                    NAV_STATE.destPoint = targetNode;
                    const inputB = document.getElementById('nav-input-dest');
                    if (inputB) inputB.value = `${targetNode.label} (К-${targetNode.bldg}, ${targetNode.floor} эт.)`;

                    // Если точка отправления не выбрана, ставим Главный вход
                    if (!NAV_STATE.startPoint) {
                        const mainEntrance = g.getNode('b1_f1_entrance_main');
                        if (mainEntrance) {
                            NAV_STATE.startPoint = mainEntrance;
                            const inputA = document.getElementById('nav-input-start');
                            if (inputA) inputA.value = 'Главный вход (Корпус 1)';
                        }
                    }

                    if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                        buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                        closeNavigatorModal();
                    }
                }
            });
        });

        // Кнопка "Свернуть/Развернуть подробный маршрут"
        const btnToggleSteps = document.getElementById('btn-toggle-steps');
        const stepsContainer = document.getElementById('nav-steps-container');
        if (btnToggleSteps && stepsContainer) {
            btnToggleSteps.addEventListener('click', () => {
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
                            for (const n of g.nodes.values()) {
                                if ((n.type === 'room' || n.type === 'entrance') && n.label.toLowerCase().includes(urlFrom.toLowerCase())) {
                                    fromNode = n;
                                    break;
                                }
                            }
                        }
                        if (urlTo) {
                            for (const n of g.nodes.values()) {
                                if ((n.type === 'room' || n.type === 'entrance') && n.label.toLowerCase().includes(urlTo.toLowerCase())) {
                                    toNode = n;
                                    break;
                                }
                            }
                        }

                        if (fromNode && toNode) {
                            buildRoute(fromNode, toNode);
                        } else if (toNode) {
                            const entrance = g.getNode('b1_f1_entrance_main');
                            if (entrance) buildRoute(entrance, toNode);
                        }
                    }, 500);
                }
            } catch (err) {
                console.warn('Navigator URL params parse error:', err);
            }
        }
    }

    function showPickBanner(text) {
        const banner = document.getElementById('nav-pick-banner');
        const textEl = document.getElementById('nav-pick-text');
        if (banner && textEl) {
            textEl.textContent = text;
            banner.classList.remove('hidden');
        }
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

})();
