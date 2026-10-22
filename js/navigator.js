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

        // 1. КОРПУС 1 (Этажи 1–7)
        for (let f = 1; f <= 7; f++) {
            // Северный коридор (Z = -5.8, X [-6.0..16.0])
            let prevN = null;
            const northXs = [-6.0, -3.0, 0.0, 3.0, 5.9, 9.4, 12.5, 16.0];
            for (const x of northXs) {
                const nid = `b1_f${f}_nc_${x.toFixed(1)}`;
                g.addNode(nid, f, 1, x, -5.8, 'corridor', `К1 Эт.${f} Сев. коридор`);
                if (prevN) g.addEdge(prevN, nid);
                prevN = nid;
            }

            // Западный коридор (X = -3.0, Z [-5.8..6.0])
            let prevW = `b1_f${f}_nc_-3.0`;
            const westZs = [-3.0, 0.0, 1.7, 3.5, 6.0];
            for (const z of westZs) {
                const nid = `b1_f${f}_wc_${z.toFixed(1)}`;
                g.addNode(nid, f, 1, -3.0, z, 'corridor', `К1 Эт.${f} Зап. коридор`);
                g.addEdge(prevW, nid);
                prevW = nid;
            }

            // Южный коридор (Z = 6.0)
            let prevS = `b1_f${f}_wc_6.0`;
            // На 1 этаже коридор идет только до X = 3.5, т.к. дальше ядро 101 и предбанник
            const southXs = (f === 1) ? [0.0, 1.8, 3.5] : [0.0, 1.8, 3.5, 5.6, 9.4, 10.5];
            for (const x of southXs) {
                const nid = `b1_f${f}_sc_${x.toFixed(1)}`;
                g.addNode(nid, f, 1, x, 6.0, 'corridor', `К1 Эт.${f} Юж. коридор`);
                g.addEdge(prevS, nid);
                prevS = nid;
            }

            // Лестничная клетка ЛК№1 (Северная): площадка (9.4, -1.9), вход со стороны северного коридора
            const s1 = `b1_f${f}_stair_lk1`;
            g.addNode(s1, f, 1, 9.4, -1.9, 'stair', `К1 ЛК№1 (Эт.${f})`);
            g.addEdge(s1, `b1_f${f}_nc_9.4`, 3.9);

            // Лестничная клетка ЛК№2 (Южная): площадка (9.4, 1.9)
            const s2 = `b1_f${f}_stair_lk2`;
            g.addNode(s2, f, 1, 9.4, 1.9, 'stair', `К1 ЛК№2 (Эт.${f})`);
            if (f > 1) {
                // На этажах 2–7 вход со стороны южного коридора
                g.addEdge(s2, `b1_f${f}_sc_9.4`, 4.1);
            }

            // Лифтовой холл: площадка (1.8, 1.5), вход из западного коридора через дверь X=-1.2, Z=1.7
            const elev = `b1_f${f}_elev`;
            g.addNode(elev, f, 1, 1.8, 1.5, 'elevator', `К1 Лифты (Эт.${f})`);
            g.addEdge(elev, `b1_f${f}_wc_1.7`, 4.8);

            // Межэтажные вертикальные лестничные марши
            if (f > 1) {
                g.addEdge(s1, `b1_f${f - 1}_stair_lk1`, 5.5);
                g.addEdge(s2, `b1_f${f - 1}_stair_lk2`, 5.5);
                // Лифты помечены специальным флагом isElevator
                g.addEdge(elev, `b1_f${f - 1}_elev`, 4.0, true, { isElevator: true });
            }

            // 1 этаж: Главный вход, крыльцо, ЛК№2 с крыльца, тамбур и фойе (точные координаты 3D модели)
            if (f === 1) {
                // Наружная площадка перед главным входом со ступенями (X = 10.5, Z = 10.4)
                g.addNode('b1_f1_entrance_main', 1, 1, 10.5, 10.4, 'entrance', 'Главный вход (Корпус 1)');
                // Прогулочная ось крыльца у главного входа
                g.addNode('b1_f1_porch_walk_1', 1, 1, 9.5, 9.8, 'corridor', 'Крыльцо у главного входа');
                // Наружный ряд дверей тамбура (X = 8.6, Z = 9.8, избегая простенка на Z=10.4)
                g.addNode('b1_f1_porch_doors', 1, 1, 8.6, 9.8, 'door', 'Двери главного входа');
                // Внутренний входной тамбур (X = 6.2, Z = 9.8)
                g.addNode('b1_f1_vestibule', 1, 1, 6.2, 9.8, 'corridor', 'Тамбур главного входа');
                // Внутренний ряд дверей тамбура в вестибюль (X = 3.8, Z = 9.8)
                g.addNode('b1_f1_inner_doors', 1, 1, 3.8, 9.8, 'door', 'Вход в вестибюль');
                // Главный вестибюль / фойе (X = 1.8, Z = 9.8)
                g.addNode('b1_f1_foyer', 1, 1, 1.8, 9.8, 'corridor', 'Главный вестибюль');
                // Западный угол вестибюля перед западным коридором (X = -3.0, Z = 9.8)
                g.addNode('b1_f1_foyer_w', 1, 1, -3.0, 9.8, 'corridor', 'Вестибюль (Западный угол)');

                // Внутренний прямой коридор через холл 103 прямо в ЛК№2 вдоль оси Z = 1.8
                g.addNode('b1_f1_door_foyer_hall103', 1, 1, -1.2, 1.8, 'door', 'Проход в холл 103');
                g.addNode('b1_f1_hall_103', 1, 1, 1.8, 1.8, 'corridor', 'Холл 1 этажа (каб. 103)');
                g.addNode('b1_f1_inner_door_lk2', 1, 1, 8.6, 1.8, 'door', 'Внутренняя дверь ЛК№2');

                g.addEdge('b1_f1_wc_1.7', 'b1_f1_door_foyer_hall103', 1.8);
                g.addEdge('b1_f1_door_foyer_hall103', 'b1_f1_hall_103', 3.0);
                g.addEdge('b1_f1_hall_103', 'b1_f1_inner_door_lk2', 6.8);
                g.addEdge('b1_f1_inner_door_lk2', 'b1_f1_stair_lk2', 0.8);

                // Ребро от главного входа к тамбуру
                g.addEdge('b1_f1_entrance_main', 'b1_f1_porch_walk_1', 1.2);

                // Ребра входа в здание через тамбур и вестибюль
                g.addEdge('b1_f1_porch_walk_1', 'b1_f1_porch_doors', 0.9);
                g.addEdge('b1_f1_porch_doors', 'b1_f1_vestibule', 2.4);
                g.addEdge('b1_f1_vestibule', 'b1_f1_inner_doors', 2.4);
                g.addEdge('b1_f1_inner_doors', 'b1_f1_foyer', 2.0);
                g.addEdge('b1_f1_foyer', 'b1_f1_foyer_w', 4.8);
                g.addEdge('b1_f1_foyer_w', 'b1_f1_wc_6.0', 3.8);
                g.addEdge('b1_f1_foyer', 'b1_f1_sc_1.8', 3.8);
                g.addEdge('b1_f1_foyer', 'b1_f1_sc_3.5', 4.2);

                // Северный блок 1 этажа: предбанник блока 105 и С/У
                g.addNode('b1_f1_suite_105_door', 1, 1, 5.9, -6.2, 'door', 'Дверь блока 105 и С/У');
                g.addNode('b1_f1_suite_105_hall', 1, 1, 5.9, -7.2, 'corridor', 'Холл блока 105 и С/У');
                g.addNode('b1_f1_toilet_door', 1, 1, 7.4, -7.15, 'door', 'Дверь С/У 1 этажа');
                g.addNode('b1_f1_toilet_lobby', 1, 1, 8.4, -7.15, 'corridor', 'Умывальная С/У 1 этажа');

                g.addEdge('b1_f1_nc_5.9', 'b1_f1_suite_105_door', 0.4);
                g.addEdge('b1_f1_suite_105_door', 'b1_f1_suite_105_hall', 1.0);
                g.addEdge('b1_f1_suite_105_hall', 'b1_f1_toilet_door', 1.5);
                g.addEdge('b1_f1_toilet_door', 'b1_f1_toilet_lobby', 1.0);
            }

            // 2 этаж: Предбанник помещения 206
            if (f === 2) {
                g.addNode('b1_f2_room_206_corr_door', 2, 1, -5.8, 1.15, 'door', 'Дверь блока 206');
                g.addNode('b1_f2_room_206_ante', 2, 1, -7.0, 1.35, 'corridor', 'Предбанник 206');
                g.addNode('b1_f2_room_206_inner_door', 2, 1, -8.2, 1.5, 'door', 'Вход в каб. 206');

                g.addEdge('b1_f2_wc_1.7', 'b1_f2_room_206_corr_door', 2.8);
                g.addEdge('b1_f2_room_206_corr_door', 'b1_f2_room_206_ante', 1.2);
                g.addEdge('b1_f2_room_206_ante', 'b1_f2_room_206_inner_door', 1.2);
            }
        }

        // 2. КОРПУС 2 (Этажи 1–3)
        for (let f = 1; f <= 3; f++) {
            // Главный продольный коридор (Z = -5.8, X [20.4..66.5])
            let prevC = null;
            const b2Xs = [20.4, 22.6, 26.0, 30.0, 34.0, 37.5, 41.0, 43.6, 47.0, 51.0, 55.0, 59.0, 63.0, 66.1];
            for (const x of b2Xs) {
                const nid = `b2_f${f}_c_${x.toFixed(1)}`;
                g.addNode(nid, f, 2, x, -5.8, 'corridor', `К2 Эт.${f} Коридор`);
                if (prevC) g.addEdge(prevC, nid);
                prevC = nid;
            }

            // Лестница ЛК№1 (Восточная, X = 66.1, Z = -10.5)
            const s1 = `b2_f${f}_stair_lk1`;
            g.addNode(s1, f, 2, 66.1, -10.5, 'stair', `К2 ЛК№1 (Эт.${f})`);
            g.addEdge(s1, `b2_f${f}_c_66.1`, 4.7);

            // Лестница ЛК№2 (Центральная, X = 43.6, Z = -10.5)
            const s2 = `b2_f${f}_stair_lk2`;
            g.addNode(s2, f, 2, 43.6, -10.5, 'stair', `К2 ЛК№2 (Эт.${f})`);
            g.addEdge(s2, `b2_f${f}_c_43.6`, 4.7);

            // Лестница ЛК№3 / Западный вход (X = 22.6, Z = -10.5)
            const s3 = `b2_f${f}_stair_lk3`;
            g.addNode(s3, f, 2, 22.6, -10.5, 'stair', `К2 ЛК№3 (Эт.${f})`);
            g.addEdge(s3, `b2_f${f}_c_22.6`, 4.7);

            // Межэтажные марши
            if (f > 1) {
                g.addEdge(s1, `b2_f${f - 1}_stair_lk1`, 5.5);
                g.addEdge(s2, `b2_f${f - 1}_stair_lk2`, 5.5);
                g.addEdge(s3, `b2_f${f - 1}_stair_lk3`, 5.5);
            }

            // На 1 этаже: крыльцо / вход К2 (Западный торец коридора X = 20.4, Z = -5.8)
            if (f === 1) {
                g.addNode('b2_f1_porch', 1, 2, 20.4, -5.8, 'entrance', 'Вход в Корпус 2');
                g.addEdge('b2_f1_c_20.4', 'b2_f1_porch', 1.2);
            }
        }

        // 3. КОРПУС 3 (Этажи 1–2)
        for (let f = 1; f <= 2; f++) {
            // Главный коридор вдоль оси Z (X = 5.9, Z [-61.0..-14.0])
            let prevC = null;
            const b3Zs = [-14.0, -18.0, -22.0, -26.0, -28.6, -32.0, -36.0, -40.0, -45.5, -46.0, -50.0, -55.0, -60.0];
            for (const z of b3Zs) {
                const nid = `b3_f${f}_c_${z.toFixed(1)}`;
                g.addNode(nid, f, 3, 5.9, z, 'corridor', `К3 Эт.${f} Коридор`);
                if (prevC) g.addEdge(prevC, nid);
                prevC = nid;
            }

            // Южная ЛК (Z = -28.6, X = 1.5)
            const sSouth = `b3_f${f}_stair_south`;
            g.addNode(sSouth, f, 3, 1.5, -28.6, 'stair', `К3 Южная ЛК (Эт.${f})`);
            g.addEdge(sSouth, `b3_f${f}_c_-28.6`, 4.4);

            // Северная ЛК (Z = -46.0, X = 1.5)
            const sNorth = `b3_f${f}_stair_north`;
            g.addNode(sNorth, f, 3, 1.5, -46.0, 'stair', `К3 Северная ЛК (Эт.${f})`);
            g.addEdge(sNorth, `b3_f${f}_c_-46.0`, 4.4);

            // Межэтажные марши
            if (f > 1) {
                g.addEdge(sSouth, `b3_f${f - 1}_stair_south`, 5.5);
                g.addEdge(sNorth, `b3_f${f - 1}_stair_north`, 5.5);
            }

            // 1 этаж: внешние выходы К3
            if (f === 1) {
                g.addNode('b3_f1_entrance_south', 1, 3, -1.6, -28.6, 'entrance', 'Вход К3 (Южный)');
                g.addNode('b3_f1_entrance_north', 1, 3, -1.6, -46.0, 'entrance', 'Вход К3 (Северный)');
                g.addEdge(sSouth, 'b3_f1_entrance_south', 3.1);
                g.addEdge(sNorth, 'b3_f1_entrance_north', 3.1);
            }
        }

        // 4. КОРПУС 4 (Этажи 1–3)
        for (let f = 1; f <= 3; f++) {
            // Главный коридор вдоль оси X (Z = -47.6, X [32.4..65.0])
            let prevC = null;
            const b4Xs = [32.4, 34.0, 37.5, 41.0, 45.0, 49.0, 53.0, 57.0, 61.4, 65.0];
            for (const x of b4Xs) {
                const nid = `b4_f${f}_c_${x.toFixed(1)}`;
                g.addNode(nid, f, 4, x, -47.6, 'corridor', `К4 Эт.${f} Коридор`);
                if (prevC) g.addEdge(prevC, nid);
                prevC = nid;
            }

            // Южное крыло К4 (X = 37.5, Z [-47.6..-27.4])
            let prevSW = `b4_f${f}_c_37.5`;
            const b4SouthZs = [-45.5, -43.0, -38.0, -33.0, -31.2, -27.4];
            for (const z of b4SouthZs) {
                const nid = `b4_f${f}_sw_${z.toFixed(1)}`;
                g.addNode(nid, f, 4, 37.5, z, 'corridor', `К4 Эт.${f} Юж. крыло`);
                g.addEdge(prevSW, nid);
                prevSW = nid;
            }

            // Лестница ЛК№2 (Западная, X = 30.1, Z = -48.3)
            const s2 = `b4_f${f}_stair_lk2`;
            g.addNode(s2, f, 4, 30.1, -48.3, 'stair', `К4 ЛК№2 (Эт.${f})`);
            g.addEdge(s2, `b4_f${f}_c_32.4`, 2.5);

            // Лестница ЛК№3 (Восточная, X = 65.2, Z = -47.6)
            const s3 = `b4_f${f}_stair_lk3`;
            g.addNode(s3, f, 4, 65.2, -47.6, 'stair', `К4 ЛК№3 (Эт.${f})`);
            g.addEdge(s3, `b4_f${f}_c_65.0`, 1.8);

            // Лестница ЛК№1 (Южная, площадка X = 40.6, Z = -27.8, выход через северную дверь X = 40.6, Z = -31.2)
            const s1 = `b4_f${f}_stair_lk1`;
            const s1Door = `b4_f${f}_stair_lk1_door`;
            g.addNode(s1, f, 4, 40.6, -27.8, 'stair', `К4 ЛК№1 (Эт.${f})`);
            g.addNode(s1Door, f, 4, 40.6, -31.2, 'door', `К4 Дверь ЛК№1 (Эт.${f})`);
            g.addEdge(s1, s1Door, 3.4);
            g.addEdge(s1Door, `b4_f${f}_sw_-31.2`, 3.1);

            // Межэтажные марши
            if (f > 1) {
                g.addEdge(s2, `b4_f${f - 1}_stair_lk2`, 5.5);
                g.addEdge(s3, `b4_f${f - 1}_stair_lk3`, 5.5);
                g.addEdge(s1, `b4_f${f - 1}_stair_lk1`, 5.5);
            }

            // 1 этаж: вход К4
            if (f === 1) {
                g.addNode('b4_f1_porch', 1, 4, 30.1, -51.3, 'entrance', 'Вход в Корпус 4');
                g.addEdge(s2, 'b4_f1_porch', 3.0);
            }
        }

        // 5. НАДЗЕМНЫЕ ОСТЕКЛЁННЫЕ ПЕРЕХОДЫ 2-ГО ЭТАЖА МЕЖДУ КОРПУСАМИ
        // 1) Переход К1 ↔ К2 (X [16.0..20.4], Z = -5.8)
        g.addNode('bridge_k1_k2_f2', 2, 1, 18.2, -5.8, 'bridge', 'Переход К1 ↔ К2 (2 эт.)');
        g.addEdge('b1_f2_nc_16.0', 'bridge_k1_k2_f2', 2.2);
        g.addEdge('bridge_k1_k2_f2', 'b2_f2_c_20.4', 2.2);

        // 2) Переход К1 ↔ К3 (Стык на Z = -14.0, X = 5.9)
        g.addNode('bridge_k1_k3_f2', 2, 1, 5.9, -14.0, 'bridge', 'Переход К1 ↔ К3 (2 эт.)');
        g.addEdge('b1_f2_nc_5.9', 'bridge_k1_k3_f2', 8.2);
        g.addEdge('bridge_k1_k3_f2', 'b3_f2_c_-14.0', 1.0);

        // 3) Переход К3 ↔ К4 (X [14.0..32.4], Z = -45.5) с прямым проходом через внешнюю дверь (32.4, -45.5)
        g.addNode('bridge_k3_k4_f2', 2, 4, 23.2, -45.5, 'bridge', 'Переход К3 ↔ К4 (2 эт.)');
        g.addNode('b4_f2_bridge_k3_door', 2, 4, 32.4, -45.5, 'door', 'Дверь Перехода К3 ↔ К4');
        g.addEdge('b3_f2_c_-45.5', 'bridge_k3_k4_f2', 17.3);
        g.addEdge('bridge_k3_k4_f2', 'b4_f2_bridge_k3_door', 9.2);
        g.addEdge('b4_f2_bridge_k3_door', 'b4_f2_sw_-45.5', 5.1);

        // 4) Переход К4 ↔ К2 (Z [-27.4..-13.8], X = 37.5)
        g.addNode('bridge_k4_k2_f2', 2, 4, 37.5, -20.6, 'bridge', 'Переход К4 ↔ К2 (2 эт.)');
        g.addEdge('b4_f2_sw_-27.4', 'bridge_k4_k2_f2', 6.8);
        g.addEdge('bridge_k4_k2_f2', 'b2_f2_c_37.5', 14.8);

        // 6. ДИНАМИЧЕСКОЕ ПОДКЛЮЧЕНИЕ ВСЕХ КАБИНЕТОВ ИЗ ROOMS_REGISTRY ЧЕРЕЗ АРХИТЕКТУРНЫЕ ДВЕРНЫЕ ПРОЁМЫ
        if (typeof ROOMS_REGISTRY !== 'undefined' && Array.isArray(ROOMS_REGISTRY)) {
            for (let idx = 0; idx < ROOMS_REGISTRY.length; idx++) {
                const r = ROOMS_REGISTRY[idx];
                const rFloor = parseInt(r.floor, 10);
                const rBldg = parseInt(r.building, 10);
                const rId = `room_${rBldg}_${rFloor}_${idx}`;

                const cleanLabel = r.text ? r.text.replace('\n', ' ') : `Помещение ${idx}`;
                // 1. Узел самого кабинета (строго на координатах надписи плашки!)
                g.addNode(rId, rFloor, rBldg, r.x, r.z, 'room', cleanLabel);
                r.navNodeId = rId;

                // Специальные узлы-связки для сложных помещений со шлюзами
                let connectedSpecially = false;
                if (rBldg === 1 && rFloor === 1) {
                    if (r.text === 'С/У' && Math.abs(r.x - 9.3) < 0.6 && Math.abs(r.z - (-7.0)) < 0.6) {
                        g.addEdge(rId, 'b1_f1_toilet_lobby', 1.0);
                        connectedSpecially = true;
                    } else if (r.text === '105') {
                        g.addEdge(rId, 'b1_f1_suite_105_hall', 3.0);
                        connectedSpecially = true;
                    } else if (r.text === 'ЛК№2') {
                        g.addEdge(rId, 'b1_f1_stair_lk2', 0.2);
                        connectedSpecially = true;
                    } else if (r.text === 'ЛК№1') {
                        g.addEdge(rId, 'b1_f1_stair_lk1', 0.2);
                        connectedSpecially = true;
                    }
                } else if (rBldg === 1 && rFloor === 2) {
                    if (r.text === '206') {
                        g.addEdge(rId, 'b1_f2_room_206_inner_door', 3.0);
                        connectedSpecially = true;
                    }
                }

                if (connectedSpecially) continue;

                // 2. Поиск реальной двери из реестра архитектурных проёмов стен
                let bestDoor = null;
                let bestDist = Infinity;
                let bestInRoom = null;
                let bestInCorr = null;
                let bestCorridor = null;

                if (typeof DOORS_REGISTRY !== 'undefined' && Array.isArray(DOORS_REGISTRY)) {
                    for (let dIdx = 0; dIdx < DOORS_REGISTRY.length; dIdx++) {
                        const door = DOORS_REGISTRY[dIdx];
                        if (door.floor !== rFloor || door.building !== rBldg) continue;

                        const dx = door.x;
                        const dz = door.z;
                        const isH = door.isHorizontal;

                        // Пороги с двух сторон проёма
                        const sign = isH ? ((r.z >= dz) ? 1 : -1) : ((r.x >= dx) ? 1 : -1);
                        const inRoomX = isH ? dx : dx + sign * 0.40;
                        const inRoomZ = isH ? dz + sign * 0.40 : dz;
                        const inCorrX = isH ? dx : dx - sign * 0.40;
                        const inCorrZ = isH ? dz - sign * 0.40 : dz;

                        // ПРОВЕРКА 1: Отрезок от центра комнаты до порога двери не должен пересекать капитальные стены!
                        if (doesIntersectWall(rFloor, rBldg, r.x, r.z, inRoomX, inRoomZ)) {
                            continue;
                        }

                        // Поиск ближайшего узла коридора
                        const nearestCorridor = g.findClosestNode(rFloor, rBldg, inCorrX, inCorrZ, ['corridor', 'stair', 'bridge', 'entrance']);
                        if (!nearestCorridor) continue;

                        // ПРОВЕРКА 2: Отрезок от внешнего порога двери до узла коридора не должен пересекать капитальные стены!
                        if (doesIntersectWall(rFloor, rBldg, inCorrX, inCorrZ, nearestCorridor.x, nearestCorridor.z)) {
                            continue;
                        }

                        const distToDoor = Math.hypot(r.x - inRoomX, r.z - inRoomZ);
                        const distToCorr = Math.hypot(inCorrX - nearestCorridor.x, inCorrZ - nearestCorridor.z);
                        const effDist = (door.isExterior ? 25.0 : 0.0) + distToDoor + distToCorr;

                        if (effDist < bestDist) {
                            bestDist = effDist;
                            bestDoor = door;
                            bestInRoom = { x: inRoomX, z: inRoomZ };
                            bestInCorr = { x: inCorrX, z: inCorrZ };
                            bestCorridor = nearestCorridor;
                        }
                    }
                }

                if (bestDoor && bestInRoom && bestInCorr && bestCorridor && bestDist < 30.0) {
                    const doorMidId = `door_mid_${rId}`;
                    const doorRoomId = `door_room_${rId}`;
                    const doorCorrId = `door_corr_${rId}`;

                    g.addNode(doorMidId, rFloor, rBldg, bestDoor.x, bestDoor.z, 'door', `Дверь ${cleanLabel}`);
                    g.addNode(doorRoomId, rFloor, rBldg, bestInRoom.x, bestInRoom.z, 'door', `Вход ${cleanLabel}`);
                    g.addNode(doorCorrId, rFloor, rBldg, bestInCorr.x, bestInCorr.z, 'door', `Коридор ${cleanLabel}`);

                    // Ребро: Надпись/центр комнаты <-> порог внутри кабинета
                    g.addEdge(rId, doorRoomId, Math.max(Math.hypot(r.x - bestInRoom.x, r.z - bestInRoom.z), 0.3));
                    // Ребро: шаг строго через ось дверного проёма
                    g.addEdge(doorRoomId, doorMidId, 0.40);
                    g.addEdge(doorMidId, doorCorrId, 0.40);

                    // Ребро: порог в коридоре <-> ближайший узел магистрального коридора
                    const doorToCorrDist = Math.hypot(bestInCorr.x - bestCorridor.x, bestInCorr.z - bestCorridor.z);
                    g.addEdge(doorCorrId, bestCorridor.id, Math.max(doorToCorrDist, 0.3));
                } else {
                    // Fallback по осям корпусов при отсутствии зарегистрированного дверного проёма
                    let doorX = r.x;
                    let doorZ = r.z;

                    if (rBldg === 2) {
                        doorZ = (r.z < -5.8) ? -7.2 : -4.4;
                    } else if (rBldg === 3) {
                        doorX = (r.x < 5.9) ? 4.6 : 7.2;
                    } else if (rBldg === 4) {
                        if (r.z < -45.4) {
                            doorZ = (r.z < -47.6) ? -49.8 : -45.4;
                        } else {
                            doorX = 37.5;
                        }
                    } else if (rBldg === 1) {
                        if (r.z < -4.0) doorZ = -4.0;
                        else if (r.x < -1.2) doorX = -1.2;
                        else if (r.z > 4.0) doorZ = 4.0;
                    }

                    const doorId = `door_${rId}`;
                    g.addNode(doorId, rFloor, rBldg, doorX, doorZ, 'door', `Дверь ${cleanLabel}`);
                    g.addEdge(rId, doorId, Math.max(Math.hypot(r.x - doorX, r.z - doorZ), 0.5));

                    const nearestCorridor = g.findClosestNode(rFloor, rBldg, doorX, doorZ, ['corridor', 'stair', 'bridge', 'entrance']);
                    if (nearestCorridor) {
                        const doorToCorrDist = Math.hypot(doorX - nearestCorridor.x, doorZ - nearestCorridor.z);
                        g.addEdge(doorId, nearestCorridor.id, Math.max(doorToCorrDist, 0.5));
                    }
                }
            }
        }

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
            text: `Начните движение от: ${startNode.label} (Корпус ${startNode.bldg}, Этаж ${startNode.floor})`,
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
            text: `Вы прибыли: ${destNode.label} (Корпус ${destNode.bldg}, Этаж ${destNode.floor})`,
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

    function createLuminousRouteMesh(points, colorHex = 0x0284c7) {
        if (!points || points.length < 2) return null;

        // Создаём трёхмерную сглаженную трубчатую геометрию (CatmullRomCurve3)
        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.15);
        const segments = Math.max(points.length * 8, 24);
        const tubeGeom = new THREE.TubeGeometry(curve, segments, 0.14, 8, false);

        const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');
        const mainColor = isDark ? 0x38bdf8 : 0x0284c7;

        // Яркий светящийся материал маршрута
        const mat = new THREE.MeshBasicMaterial({
            color: mainColor,
            transparent: true,
            opacity: 0.95,
            depthTest: true
        });

        const mesh = new THREE.Mesh(tubeGeom, mat);
        mesh.renderOrder = 20;

        // Добавляем нижнюю плоскую подложку-контур для идеальной контрастности на любом фоне
        const lineGeom = new THREE.BufferGeometry().setFromPoints(curve.getPoints(segments * 2));
        const lineMat = new THREE.LineBasicMaterial({
            color: isDark ? 0x0f172a : 0xffffff,
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });
        const lineMesh = new THREE.Line(lineGeom, lineMat);
        lineMesh.position.y = -0.02;
        lineMesh.renderOrder = 19;
        mesh.add(lineMesh);

        return mesh;
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
        drawScreenBadge(startNode, `A: ${startNode.label}`, '#059669', false);
        // Рисуем бейдж Куда
        drawScreenBadge(destNode, `B: ${destNode.label}`, '#e11d48', true);

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
            if (inputA) inputA.value = `${pointData.text} (К-${pointData.building}, ${pointData.floor} эт.)`;
        } else if (mode === 'dest') {
            NAV_STATE.destPoint = pointData;
            const inputB = document.getElementById('nav-input-dest');
            if (inputB) inputB.value = `${pointData.text} (К-${pointData.building}, ${pointData.floor} эт.)`;
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

        const elevPill = document.getElementById('nav-card-elev-pill');
        if (elevPill) {
            const usedElevator = route.instructions.some(i => i.isElevator);
            elevPill.textContent = usedElevator ? '🛗 Лифт' : '🪜 Лестницы';
            elevPill.className = usedElevator
                ? 'text-[10px] px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-300 font-semibold border border-sky-700/60'
                : 'text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium border border-slate-700/60';
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

            const matches = [];
            for (const [nid, n] of g.nodes.entries()) {
                if (n.type === 'room' || n.type === 'entrance') {
                    const lbl = (n.label || '').toLowerCase();
                    if (lbl.includes(query) || `${n.bldg}-${lbl}`.includes(query)) {
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
                        <span class="font-semibold">${item.label}</span>
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
        const badgeElev = document.getElementById('elevators-status-badge');
        const btnElev = document.getElementById('btn-toggle-elevators');
        const elevText = document.getElementById('elevators-status-text');

        function setElevatorsState(enabled) {
            NAV_STATE.allowElevators = !!enabled;
            if (switchElev) switchElev.checked = NAV_STATE.allowElevators;
            if (badgeElev) {
                badgeElev.textContent = NAV_STATE.allowElevators ? 'Вкл' : 'Выкл';
                badgeElev.className = NAV_STATE.allowElevators
                    ? 'text-[10px] px-1.5 py-0.5 rounded font-bold bg-sky-500 text-white shadow-sm transition-colors'
                    : 'text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-800 text-slate-300 border border-slate-600 transition-colors';
            }
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

        const btnCardToilet = document.getElementById('btn-card-toilet');
        if (btnCardToilet) btnCardToilet.addEventListener('click', routeToClosestToilet);

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
