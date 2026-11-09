function addWallLine(targetGroup, x1, z1, x2, z2, openings = [], wallThickness = 0.18, isColumn = false) {
    const isHorizontal = Math.abs(z2 - z1) < 0.001;
    const fixedCoord = isHorizontal ? z1 : x1;
    const isOuterWall = wallThickness >= 0.20;

    // Регистрация дверей для архитектурного графа навигатора
    if (targetGroup && targetGroup.userData && targetGroup.userData.floor) {
        const f = targetGroup.userData.floor;
        const b = targetGroup.userData.building;
        if (typeof DOORS_REGISTRY !== 'undefined' && Array.isArray(DOORS_REGISTRY)) {
            for (let i = 0; i < openings.length; i++) {
                const op = openings[i];
                if (op.type === 'door' || op.type === 'open') {
                    const mid = (op.from + op.to) / 2;
                    DOORS_REGISTRY.push({
                        floor: f,
                        building: b,
                        x: isHorizontal ? mid : fixedCoord,
                        z: isHorizontal ? fixedCoord : mid,
                        isExterior: (op.isExterior !== undefined) ? !!op.isExterior : isOuterWall,
                        isHorizontal: isHorizontal,
                        wallCoord: fixedCoord,
                        from: op.from,
                        to: op.to
                    });
                }
            }
        }
    }

    if (!targetGroup) return;
    if (!targetGroup._pendingWallLines) {
        targetGroup._pendingWallLines = [];
    }
    targetGroup._pendingWallLines.push({
        x1, z1, x2, z2, openings, wallThickness, isColumn
    });
    _pendingWallGroups.add(targetGroup);
}

// Построение геометрии рёбер стен без паразитных поперечных линий на торцах стыкующихся стен
function createWallEdgesGeometry(len, thickness, omitStart = false, omitEnd = false) {
    const cacheKey = `${Math.round(len * 1000)}_${Math.round(thickness * 1000)}_${omitStart ? 1 : 0}_${omitEnd ? 1 : 0}`;
    const cached = _wallEdgesGeomCache.get(cacheKey);
    if (cached) return cached;
    const hw = len / 2;
    const ht = thickness / 2;
    const yTop = 0.5;
    const yBot = -0.5;
    const positions = [];

    // 4 продольных ребра (вдоль длины стены)
    positions.push(-hw, yTop, -ht,  hw, yTop, -ht);
    positions.push(-hw, yTop,  ht,  hw, yTop,  ht);
    positions.push(-hw, yBot, -ht,  hw, yBot, -ht);
    positions.push(-hw, yBot,  ht,  hw, yBot,  ht);

    // 4 вертикальных угловых ребра
    positions.push(-hw, yBot, -ht, -hw, yTop, -ht);
    positions.push(-hw, yBot,  ht, -hw, yTop,  ht);
    positions.push( hw, yBot, -ht,  hw, yTop, -ht);
    positions.push( hw, yBot,  ht,  hw, yTop,  ht);

    // Поперечные рёбра начального торца (только если торец не примыкает к смежной стене)
    if (!omitStart) {
        positions.push(-hw, yTop, -ht, -hw, yTop, ht);
        positions.push(-hw, yBot, -ht, -hw, yBot, ht);
    }

    // Поперечные рёбра конечного торца (только если торец не примыкает к смежной стене)
    if (!omitEnd) {
        positions.push(hw, yTop, -ht, hw, yTop, ht);
        positions.push(hw, yBot, -ht, hw, yBot, ht);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    _wallEdgesGeomCache.set(cacheKey, geom);
    return geom;
}

// Алгоритм бесшовного сопряжения и устранения взаимного проникновения стен (Junction Solver)
function solveCampusJunctions(targetGroup, pendingLines) {
    const segments = [];
    let id = 0;

    for (const line of pendingLines) {
        const isHorizontal = Math.abs(line.z2 - line.z1) < 0.001;
        const startCoord = isHorizontal ? Math.min(line.x1, line.x2) : Math.min(line.z1, line.z2);
        const endCoord = isHorizontal ? Math.max(line.x1, line.x2) : Math.max(line.z1, line.z2);
        const fixedCoord = isHorizontal ? line.z1 : line.x1;
        const sorted = [...line.openings].sort((a, b) => a.from - b.from);
        let cursor = startCoord;

        for (const op of sorted) {
            const oStart = Math.max(startCoord, op.from);
            const oEnd = Math.min(endCoord, op.to);
            if (oStart > cursor + 0.02) {
                segments.push({
                    id: id++,
                    isHorizontal,
                    c1: cursor,
                    c2: oStart,
                    fixedCoord,
                    thickness: line.wallThickness,
                    isColumn: line.isColumn,
                    isExterior: line.wallThickness >= 0.20,
                    isDoor: false
                });
            }
            if (op.type !== 'open') {
                const isExtDoor = op.isExterior !== undefined ? op.isExterior : (line.wallThickness >= 0.20);
                segments.push({
                    id: id++,
                    isHorizontal,
                    c1: oStart,
                    c2: oEnd,
                    fixedCoord,
                    thickness: 0.09,
                    isColumn: line.isColumn,
                    isExterior: isExtDoor,
                    isDoor: true
                });
            }
            cursor = oEnd;
        }
        if (cursor < endCoord - 0.02) {
            segments.push({
                id: id++,
                isHorizontal,
                c1: cursor,
                c2: endCoord,
                fixedCoord,
                thickness: line.wallThickness,
                isColumn: line.isColumn,
                isExterior: line.wallThickness >= 0.20,
                isDoor: false
            });
        }
    }

    const walls = segments.filter(s => !s.isDoor);
    const doors = segments.filter(s => s.isDoor);

    const solved = walls.map(w => ({
        ...w,
        origC1: w.c1,
        origC2: w.c2,
        omitStartCap: false,
        omitEndCap: false
    }));

    // Бесшовное сопряжение ортогональных стен с диагональными скосами (Miter Joints)
    const miterJoints = targetGroup._miterJoints || [];
    for (const w of solved) {
        if (w.isHorizontal) {
            const z0 = w.fixedCoord;
            for (const mj of miterJoints) {
                if ((!mj.group || mj.group === targetGroup) && Math.abs(mj.z - z0) < 0.14) {
                    if (Math.abs(mj.x - w.origC1) < 0.14) {
                        w.omitStartCap = true;
                    }
                    if (Math.abs(mj.x - w.origC2) < 0.14) {
                        w.omitEndCap = true;
                    }
                }
            }
        } else {
            const x0 = w.fixedCoord;
            for (const mj of miterJoints) {
                if ((!mj.group || mj.group === targetGroup) && Math.abs(mj.x - x0) < 0.14) {
                    if (Math.abs(mj.z - w.origC1) < 0.14) {
                        w.omitStartCap = true;
                    }
                    if (Math.abs(mj.z - w.origC2) < 0.14) {
                        w.omitEndCap = true;
                    }
                }
            }
        }
    }

    // Интеллектуальная подрезка дверных полотен на стыках со смежными стенами
    const solvedDoors = doors.map(d => ({
        ...d,
        origC1: d.c1,
        origC2: d.c2
    }));

    // Пространственный индекс для ускорения поиска коллинеарных стен с O(N) до O(1)
    const collinearMap = new Map();
    function getCollinearKey(isH, fixedCoord) {
        return (isH ? 'H_' : 'V_') + Math.round(fixedCoord * 20);
    }
    for (let idx = 0; idx < solved.length; idx++) {
        const w = solved[idx];
        const k = getCollinearKey(w.isHorizontal, w.fixedCoord);
        let list = collinearMap.get(k);
        if (!list) {
            list = [];
            collinearMap.set(k, list);
        }
        list.push(w);
    }

    function wallContinuesThrough(fixedCoord, axisCoord, isH) {
        const prefix = isH ? 'H_' : 'V_';
        const b = Math.round(fixedCoord * 20);
        const candidates = [];
        for (let db = -1; db <= 1; db++) {
            const list = collinearMap.get(prefix + (b + db));
            if (list) {
                for (let li = 0; li < list.length; li++) {
                    candidates.push(list[li]);
                }
            }
        }
        if (candidates.length === 0) return null;
        for (let idx = 0; idx < candidates.length; idx++) {
            const other = candidates[idx];
            if (Math.abs(other.fixedCoord - fixedCoord) < 0.05) {
                if (axisCoord > other.origC1 + 0.06 && axisCoord < other.origC2 - 0.06) {
                    return other;
                }
                for (let idx2 = 0; idx2 < candidates.length; idx2++) {
                    if (idx === idx2) continue;
                    const o2 = candidates[idx2];
                    if (Math.abs(o2.fixedCoord - fixedCoord) < 0.05) {
                        if (Math.abs(other.origC2 - axisCoord) <= 0.06 && Math.abs(o2.origC1 - axisCoord) <= 0.06) {
                            return other;
                        }
                    }
                }
            }
        }
        return null;
    }


    solveWallOrthogonalIntersections(solved, wallContinuesThrough);
    return resolveWallOverlapsAndDoors(solved, solvedDoors, id);
}
