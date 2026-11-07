// Безопасное экранирование HTML берется из js/state.js (с фоллбэком при изолированном запуске)
if (typeof escapeHtml !== 'function') {
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
        allowElevators: false,  // По умолчанию выключены (только лестницы)
        _badgeWidthCache: new Map(),
        _renderedStairBadges: [],
        _tempBadgeVec: (typeof THREE !== 'undefined' && THREE.Vector3) ? new THREE.Vector3() : null
    };

    const _badgeWidthCache = NAV_STATE._badgeWidthCache;
    let renderedStairBadges = NAV_STATE._renderedStairBadges;
    const _tempVec = NAV_STATE._tempBadgeVec;

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
            this.nodesByFloor = new Map(); // floor -> node[] для O(1) пространственной выборки
        }

        addNode(id, floor, bldg, x, z, type = 'corridor', label = '', meta = null) {
            if (!this.nodes.has(id)) {
                const bldgNum = parseInt(bldg, 10);
                const isOutdoor = (meta && meta.isOutdoor !== undefined)
                    ? Boolean(meta.isOutdoor)
                    : (bldgNum === 0);
                const nodeObj = {
                    id,
                    floor: parseInt(floor, 10),
                    bldg: bldgNum,
                    x: Math.round(x * 100) / 100,
                    z: Math.round(z * 100) / 100,
                    type,
                    label: label || '',
                    isOutdoor
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

    let _wallsIndexMap = null;
    let _wallsIndexedCount = -1;

    function getWallsSpatialIndex() {
        if (typeof WALLS_REGISTRY === 'undefined' || !Array.isArray(WALLS_REGISTRY)) {
            return null;
        }
        if (_wallsIndexMap && _wallsIndexedCount === WALLS_REGISTRY.length) {
            return _wallsIndexMap;
        }
        _wallsIndexMap = new Map();
        for (let i = 0; i < WALLS_REGISTRY.length; i++) {
            const w = WALLS_REGISTRY[i];
            const fKey = `f_${w.floor}`;
            let fList = _wallsIndexMap.get(fKey);
            if (!fList) {
                fList = [];
                _wallsIndexMap.set(fKey, fList);
            }
            fList.push(w);

            const bfKey = `bf_${w.building}_${w.floor}`;
            let bfList = _wallsIndexMap.get(bfKey);
            if (!bfList) {
                bfList = [];
                _wallsIndexMap.set(bfKey, bfList);
            }
            bfList.push(w);
        }
        _wallsIndexedCount = WALLS_REGISTRY.length;
        return _wallsIndexMap;
    }

    function doesIntersectWall(floor, bldg, x1, z1, x2, z2) {
        const idx = getWallsSpatialIndex();
        if (!idx) return false;
        const key = (bldg !== null && bldg !== undefined) ? `bf_${bldg}_${floor}` : `f_${floor}`;
        const walls = idx.get(key);
        if (!walls || walls.length === 0) return false;

        for (let i = 0; i < walls.length; i++) {
            const w = walls[i];
            if (segmentsIntersect(x1, z1, x2, z2, w.x1, w.z1, w.x2, w.z2)) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------------
    // ПОСТРОЕНИЕ ПОЛНОГО ГРАФА КОЛЛЕДЖА
    // ------------------------------------------------------------------------
