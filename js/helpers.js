// Единоразовый полифилл roundRect на прототипе CanvasRenderingContext2D
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, rw, rh, rad) {
        const r = typeof rad === 'number' ? rad : (Array.isArray(rad) ? rad[0] : 0);
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + rw, y, x + rw, y + rh, r);
        this.arcTo(x + rw, y + rh, x, y + rh, r);
        this.arcTo(x, y + rh, x, y, r);
        this.arcTo(x, y, x + rw, y, r);
        this.closePath();
        return this;
    };
}

const _registeredMiterJoints = [];

function registerMiterJoint(targetGroup, x, z, thickness) {
    if (!targetGroup) return;
    if (!targetGroup._miterJoints) targetGroup._miterJoints = [];
    targetGroup._miterJoints.push({
        x,
        z,
        thickness
    });
}

// Кэш геометрий Three.js для переиспользования буферов WebGL и ускорения инициализации
const _boxGeomCache = new Map();
const _edgesGeomCache = new Map();
const _wallEdgesGeomCache = new Map();
let _sharedHiddenLabelMat = null;
const _textWidthCache = new Map();

function clearHelpersGeometryCaches() {
    for (const geom of _boxGeomCache.values()) {
        if (geom && geom.dispose) geom.dispose();
    }
    _boxGeomCache.clear();
    for (const geom of _edgesGeomCache.values()) {
        if (geom && geom.dispose) geom.dispose();
    }
    _edgesGeomCache.clear();
    for (const geom of _wallEdgesGeomCache.values()) {
        if (geom && geom.dispose) geom.dispose();
    }
    _wallEdgesGeomCache.clear();
    _textWidthCache.clear();
}
window.clearHelpersGeometryCaches = clearHelpersGeometryCaches;

function getCachedBoxGeometry(w, h, d) {
    const safeW = Math.max(w, 0.001);
    const safeH = Math.max(h, 0.001);
    const safeD = Math.max(d, 0.001);
    const key = `${Math.round(safeW * 1000)}_${Math.round(safeH * 1000)}_${Math.round(safeD * 1000)}`;
    let geom = _boxGeomCache.get(key);
    if (!geom) {
        geom = new THREE.BoxGeometry(safeW, safeH, safeD);
        _boxGeomCache.set(key, geom);
    }
    return geom;
}

function getCachedEdgesGeometry(boxGeom, w, h, d) {
    const key = `${Math.round(w * 1000)}_${Math.round(h * 1000)}_${Math.round(d * 1000)}`;
    let edges = _edgesGeomCache.get(key);
    if (!edges) {
        edges = new THREE.EdgesGeometry(boxGeom);
        _edgesGeomCache.set(key, edges);
    }
    return edges;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ПОСТРОЕНИЯ 3D-ГЕОМЕТРИИ
// С ПОДДЕРЖКОЙ УМНОГО СКРЫТИЯ ВНУТРЕННОСТЕЙ ЭТАЖЕЙ
// ==========================================

function addFloorRect(targetGroup, x1, z1, x2, z2, isCore = false) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const thickness = 0.16;
    const geom = new THREE.BoxGeometry(w, thickness, d);
    const mat = MATERIALS.slab;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, -thickness / 2 + 0, cz);
    mesh.receiveShadow = true;
    mesh.userData.isFloorSlab = true;
    mesh.userData.isInterior = false;
    mesh.userData.isExterior = true;
    targetGroup.add(mesh);
    slabMeshes.push(mesh);


}


function addFloorRightTriangle(targetGroup, xA, zA, xB, zB, xC, zC) {
    if (!targetGroup) return null;
    const geom = new THREE.BufferGeometry();
    const thickness = 0.16;
    const yTop = 0.0;
    const yBottom = yTop - thickness;

    // Треугольная призма в плоскости XZ с нормалями строго наружу и вверх (+Y)
    const vertices = new Float32Array([
        // Верхняя грань (нормаль +Y)
        xA, yTop, zA,
        xB, yTop, zB,
        xC, yTop, zC,

        // Нижняя грань (нормаль -Y)
        xC, yBottom, zC,
        xB, yBottom, zB,
        xA, yBottom, zA,

        // Боковая грань 1 (AB)
        xA, yBottom, zA,
        xB, yBottom, zB,
        xB, yTop, zB,
        xA, yBottom, zA,
        xB, yTop, zB,
        xA, yTop, zA,

        // Боковая грань 2 (BC)
        xB, yBottom, zB,
        xC, yBottom, zC,
        xC, yTop, zC,
        xB, yBottom, zB,
        xC, yTop, zC,
        xB, yTop, zB,

        // Боковая грань 3 (CA)
        xC, yBottom, zC,
        xA, yBottom, zA,
        xA, yTop, zA,
        xC, yBottom, zC,
        xA, yTop, zA,
        xC, yTop, zC
    ]);

    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    const mat = MATERIALS.slab;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.receiveShadow = true;
    mesh.userData.isFloorSlab = true;
    mesh.userData.isExterior = true;
    mesh.userData.isInterior = false;
    targetGroup.add(mesh);
    slabMeshes.push(mesh);
    return mesh;
}

function addFloorPolygon(targetGroup, points, isCore = false) {
    if (!points || points.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();

    const thickness = 0.16;
    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false
    });
    geom.rotateX(Math.PI / 2);

    const mat = MATERIALS.slab;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, 0, 0);
    mesh.receiveShadow = true;
    mesh.userData.isFloorSlab = true;
    mesh.userData.isInterior = false;
    mesh.userData.isExterior = true;
    targetGroup.add(mesh);
    slabMeshes.push(mesh);
}

// Реестр групп с отложенным построением стен для бесшовного совмещения стыков (Junction Solver)
const _pendingWallGroups = new Set();

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
    const miterJoints = targetGroup._miterJoints || _registeredMiterJoints;
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

    // Разделение стен по ориентации для исключения избыточных парных проверок
    const hWalls = [];
    const vWalls = [];
    for (let idx = 0; idx < solved.length; idx++) {
        if (solved[idx].isHorizontal) hWalls.push(solved[idx]);
        else vWalls.push(solved[idx]);
    }

    for (let i = 0; i < hWalls.length; i++) {
        const A = hWalls[i];
        for (let j = 0; j < vWalls.length; j++) {
            const B = vWalls[j];

            const x0 = B.fixedCoord;
                const z0 = A.fixedCoord;

                const xInA = (x0 >= A.origC1 - 0.06 && x0 <= A.origC2 + 0.06);
                const zInB = (z0 >= B.origC1 - 0.06 && z0 <= B.origC2 + 0.06);

                if (xInA && zInB) {
                    const atAStart = Math.abs(x0 - A.origC1) <= 0.06;
                    const atAEnd = Math.abs(x0 - A.origC2) <= 0.06;
                    const aContinues = !atAStart && !atAEnd || !!wallContinuesThrough(A.fixedCoord, x0, true);

                    const atBStart = Math.abs(z0 - B.origC1) <= 0.06;
                    const atBEnd = Math.abs(z0 - B.origC2) <= 0.06;
                    const bContinues = !atBStart && !atBEnd || !!wallContinuesThrough(B.fixedCoord, z0, false);

                    if (!aContinues && bContinues) {
                        // Т-образный стык: стена A упирается в проходящую стену B
                        if (atAStart) {
                            A.c1 = Math.max(A.c1, x0 + B.thickness / 2);
                            A.omitStartCap = true;
                        } else if (atAEnd) {
                            A.c2 = Math.min(A.c2, x0 - B.thickness / 2);
                            A.omitEndCap = true;
                        }
                    } else if (aContinues && !bContinues) {
                        // Т-образный стык: стена B упирается в проходящую стену A
                        if (atBStart) {
                            B.c1 = Math.max(B.c1, z0 + A.thickness / 2);
                            B.omitStartCap = true;
                        } else if (atBEnd) {
                            B.c2 = Math.min(B.c2, z0 - A.thickness / 2);
                            B.omitEndCap = true;
                        }
                    } else if (aContinues && bContinues) {
                        // Крестообразный стык или стык составных стен
                        if (atAEnd || atAStart) {
                            if (atAStart) {
                                A.c1 = Math.max(A.c1, x0 + B.thickness / 2);
                                A.omitStartCap = true;
                            } else if (atAEnd) {
                                A.c2 = Math.min(A.c2, x0 - B.thickness / 2);
                                A.omitEndCap = true;
                            }
                        } else if (atBEnd || atBStart) {
                            if (atBStart) {
                                B.c1 = Math.max(B.c1, z0 + A.thickness / 2);
                                B.omitStartCap = true;
                            } else if (atBEnd) {
                                B.c2 = Math.min(B.c2, z0 - A.thickness / 2);
                                B.omitEndCap = true;
                            }
                        }
                    } else if (!aContinues && !bContinues) {
                        // Г-образный угол: сопряжение двух сходящихся стен
                        let aIsPrimary = true;
                        const bldg2StartX = (typeof B2_X_START !== 'undefined') ? B2_X_START : 20.4;
                        if (Math.abs(B.fixedCoord - bldg2StartX) < 0.05) {
                            // На границе с Корпусом 2 (B2_X_START = 20.4) вертикальная стена приоритетна, чтобы горизонтальные стены не заходили за X = 20.28
                            aIsPrimary = false;
                        } else if (A.isExterior !== B.isExterior) {
                            aIsPrimary = A.isExterior;
                        } else if (Math.abs(A.thickness - B.thickness) > 0.01) {
                            aIsPrimary = A.thickness > B.thickness;
                        }

                        if (aIsPrimary) {
                            if (atAStart) {
                                A.c1 = Math.min(A.c1, x0 - B.thickness / 2);
                            } else {
                                A.c2 = Math.max(A.c2, x0 + B.thickness / 2);
                            }
                            if (atBStart) {
                                B.c1 = Math.max(B.c1, z0 + A.thickness / 2);
                                B.omitStartCap = true;
                            } else {
                                B.c2 = Math.min(B.c2, z0 - A.thickness / 2);
                                B.omitEndCap = true;
                            }
                        } else {
                            if (atBStart) {
                                B.c1 = Math.min(B.c1, z0 - A.thickness / 2);
                            } else {
                                B.c2 = Math.max(B.c2, z0 + A.thickness / 2);
                            }
                            if (atAStart) {
                                A.c1 = Math.max(A.c1, x0 + B.thickness / 2);
                                A.omitStartCap = true;
                            } else {
                                A.c2 = Math.min(A.c2, x0 - B.thickness / 2);
                                A.omitEndCap = true;
                            }
                        }
                    }
                }
            }
        }

    // Финальный проход де-оверлапа: гарантирует 0 взаимных проникновений 3D-боксов стен внутри группы
    let overlapChanged = true;
    let overlapPasses = 0;
    while (overlapChanged && overlapPasses < 5) {
        overlapChanged = false;
        overlapPasses++;
        const toAdd = [];
        const currentLen = solved.length;
        for (let i = 0; i < currentLen; i++) {
            const A = solved[i];
            if (A.c2 - A.c1 <= 0.01) continue;
            for (let j = 0; j < currentLen; j++) {
                if (i === j) continue;
                const B = solved[j];
                if (B.c2 - B.c1 <= 0.01) continue;
                if (A.isHorizontal && !B.isHorizontal) {
                    const ax1 = A.c1, ax2 = A.c2;
                    const az1 = A.fixedCoord - A.thickness / 2, az2 = A.fixedCoord + A.thickness / 2;
                    const bx1 = B.fixedCoord - B.thickness / 2, bx2 = B.fixedCoord + B.thickness / 2;
                    const bz1 = B.c1, bz2 = B.c2;
                    const ox = Math.min(ax2, bx2) - Math.max(ax1, bx1);
                    const oz = Math.min(az2, bz2) - Math.max(az1, bz1);
                    if (ox > 0.001 && oz > 0.001) {
                        if (Math.abs(A.c2 - B.fixedCoord) <= B.thickness + 0.05) {
                            A.c2 = Math.min(A.c2, bx1);
                            A.omitEndCap = true;
                            overlapChanged = true;
                        } else if (Math.abs(A.c1 - B.fixedCoord) <= B.thickness + 0.05) {
                            A.c1 = Math.max(A.c1, bx2);
                            A.omitStartCap = true;
                            overlapChanged = true;
                        } else if (Math.abs(B.c2 - A.fixedCoord) <= A.thickness + 0.05) {
                            B.c2 = Math.min(B.c2, az1);
                            B.omitEndCap = true;
                            overlapChanged = true;
                        } else if (Math.abs(B.c1 - A.fixedCoord) <= A.thickness + 0.05) {
                            B.c1 = Math.max(B.c1, az2);
                            B.omitStartCap = true;
                            overlapChanged = true;
                        } else if (B.thickness <= A.thickness && B.c1 < az1 && B.c2 > az2) {
                            const tailC2 = B.c2;
                            const tailOmitEnd = B.omitEndCap;
                            B.c2 = az1;
                            B.omitEndCap = true;
                            toAdd.push({
                                ...B,
                                id: id++,
                                c1: az2,
                                c2: tailC2,
                                origC1: az2,
                                origC2: tailC2,
                                omitStartCap: true,
                                omitEndCap: tailOmitEnd
                            });
                            overlapChanged = true;
                        } else if (A.c1 < bx1 && A.c2 > bx2) {
                            const tailC2 = A.c2;
                            const tailOmitEnd = A.omitEndCap;
                            A.c2 = bx1;
                            A.omitEndCap = true;
                            toAdd.push({
                                ...A,
                                id: id++,
                                c1: bx2,
                                c2: tailC2,
                                origC1: bx2,
                                origC2: tailC2,
                                omitStartCap: true,
                                omitEndCap: tailOmitEnd
                            });
                            overlapChanged = true;
                        }
                    }
                }
            }
        }
        if (toAdd.length > 0) {
            for (let k = 0; k < toAdd.length; k++) {
                solved.push(toAdd[k]);
            }
        }
    }

    // Подрезка дверных полотен, примыкающих к перпендикулярным или продольным стенам
    for (let i = 0; i < solvedDoors.length; i++) {
        const D = solvedDoors[i];
        for (let j = 0; j < solved.length; j++) {
            const W = solved[j];

            // 1. Перпендикулярное пересечение двери со стеной
            if (D.isHorizontal !== W.isHorizontal) {
                const dCoord = D.fixedCoord; // координата линии двери
                const wCoord = W.fixedCoord; // координата линии стены

                const wInD = (wCoord >= D.origC1 - 0.05 && wCoord <= D.origC2 + 0.05);
                const dInW = (dCoord >= W.origC1 - 0.05 && dCoord <= W.origC2 + 0.05);

                if (wInD && dInW) {
                    if (Math.abs(wCoord - D.origC1) <= W.thickness / 2 + 0.08) {
                        D.c1 = Math.max(D.c1, wCoord + W.thickness / 2);
                    } else if (Math.abs(wCoord - D.origC2) <= W.thickness / 2 + 0.08) {
                        D.c2 = Math.min(D.c2, wCoord - W.thickness / 2);
                    }
                }
            }
            // 2. Параллельное или продольное наложение
            else if (Math.abs(D.fixedCoord - W.fixedCoord) <= (D.thickness + W.thickness) / 2 - 0.02) {
                const oStart = Math.max(D.origC1, W.origC1);
                const oEnd = Math.min(D.origC2, W.origC2);
                if (oEnd - oStart > 0.02) {
                    if (D.origC1 < oStart) {
                        D.c2 = Math.min(D.c2, oStart);
                    } else if (D.origC2 > oEnd) {
                        D.c1 = Math.max(D.c1, oEnd);
                    }
                }
            }
        }
    }

    // Исключаем микроскопические осколки стен (< 4 см), остающиеся при наложении дверных коробок
    const validWalls = solved.filter(w => (w.c2 - w.c1) > 0.04);
    const validDoors = solvedDoors.filter(d => (d.c2 - d.c1) > 0.05);
    return [...validWalls, ...validDoors];
}

// Построение геометрии видимых рёбер стен без паразитных швов на Т-стыках и углах (Seamless Junction Solver)
function createResolvedWallEdgesGeometry(seg, wallBoxes) {
    const len = Math.abs(seg.c2 - seg.c1);
    if (len <= 0.001) return new THREE.BufferGeometry();
    const thickness = seg.thickness;
    const hw = len / 2;
    const ht = thickness / 2;
    const isH = seg.isHorizontal;
    const fixed = seg.fixedCoord;
    const c1 = Math.min(seg.c1, seg.c2);
    const c2 = Math.max(seg.c1, seg.c2);
    const mid = (c1 + c2) / 2;
    const cx = isH ? mid : fixed;
    const cz = isH ? fixed : mid;
    const delta = 0.01;
    const yTop = 0.5;
    const yBot = -0.5;

    function isInsideOtherWall(px, pz) {
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (px >= b.minX - 0.002 && px <= b.maxX + 0.002 &&
                pz >= b.minZ - 0.002 && pz <= b.maxZ + 0.002) {
                return true;
            }
        }
        return false;
    }

    const visibleLocalSegments = [];

    if (isH) {
        // Сторона North: Z = fixed - ht, normal (0, -1), local Z = -ht
        const zN = fixed - ht;
        const cutsN = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minZ - 0.005 <= zN && zN <= b.maxZ + 0.005) {
                if (c1 < b.minX && b.minX < c2) cutsN.add(b.minX);
                if (c1 < b.maxX && b.maxX < c2) cutsN.add(b.maxX);
            }
        }
        const sortedN = Array.from(cutsN).sort((a, b) => a - b);
        for (let i = 0; i < sortedN.length - 1; i++) {
            const xa = sortedN[i], xb = sortedN[i + 1];
            if (xb - xa < 0.005) continue;
            if (!isInsideOtherWall((xa + xb) / 2, zN - delta)) {
                visibleLocalSegments.push([xa - cx, -ht, xb - cx, -ht]);
            }
        }

        // Сторона South: Z = fixed + ht, normal (0, +1), local Z = +ht
        const zS = fixed + ht;
        const cutsS = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minZ - 0.005 <= zS && zS <= b.maxZ + 0.005) {
                if (c1 < b.minX && b.minX < c2) cutsS.add(b.minX);
                if (c1 < b.maxX && b.maxX < c2) cutsS.add(b.maxX);
            }
        }
        const sortedS = Array.from(cutsS).sort((a, b) => a - b);
        for (let i = 0; i < sortedS.length - 1; i++) {
            const xa = sortedS[i], xb = sortedS[i + 1];
            if (xb - xa < 0.005) continue;
            if (!isInsideOtherWall((xa + xb) / 2, zS + delta)) {
                visibleLocalSegments.push([xa - cx, ht, xb - cx, ht]);
            }
        }

        // Торец West: X = c1, normal (-1, 0), local X = -hw
        if (!seg.omitStartCap) {
            const cutsW = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minX - 0.005 <= c1 && c1 <= b.maxX + 0.005) {
                    if ((fixed - ht) < b.minZ && b.minZ < (fixed + ht)) cutsW.add(b.minZ);
                    if ((fixed - ht) < b.maxZ && b.maxZ < (fixed + ht)) cutsW.add(b.maxZ);
                }
            }
            const sortedW = Array.from(cutsW).sort((a, b) => a - b);
            for (let i = 0; i < sortedW.length - 1; i++) {
                const za = sortedW[i], zb = sortedW[i + 1];
                if (zb - za < 0.005) continue;
                if (!isInsideOtherWall(c1 - delta, (za + zb) / 2)) {
                    visibleLocalSegments.push([-hw, za - fixed, -hw, zb - fixed]);
                }
            }
        }

        // Торец East: X = c2, normal (+1, 0), local X = +hw
        if (!seg.omitEndCap) {
            const cutsE = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minX - 0.005 <= c2 && c2 <= b.maxX + 0.005) {
                    if ((fixed - ht) < b.minZ && b.minZ < (fixed + ht)) cutsE.add(b.minZ);
                    if ((fixed - ht) < b.maxZ && b.maxZ < (fixed + ht)) cutsE.add(b.maxZ);
                }
            }
            const sortedE = Array.from(cutsE).sort((a, b) => a - b);
            for (let i = 0; i < sortedE.length - 1; i++) {
                const za = sortedE[i], zb = sortedE[i + 1];
                if (zb - za < 0.005) continue;
                if (!isInsideOtherWall(c2 + delta, (za + zb) / 2)) {
                    visibleLocalSegments.push([hw, za - fixed, hw, zb - fixed]);
                }
            }
        }
    } else {
        // Вертикальная стена (rotation.y = -Math.PI / 2)
        // world X = cx - z_local  =>  z_local = fixed - world X
        // world Z = cz + x_local  =>  x_local = world Z - cz

        // Сторона West: world X = fixed - ht, normal (-1, 0), local Z = +ht
        const xW = fixed - ht;
        const cutsW = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minX - 0.005 <= xW && xW <= b.maxX + 0.005) {
                if (c1 < b.minZ && b.minZ < c2) cutsW.add(b.minZ);
                if (c1 < b.maxZ && b.maxZ < c2) cutsW.add(b.maxZ);
            }
        }
        const sortedW = Array.from(cutsW).sort((a, b) => a - b);
        for (let i = 0; i < sortedW.length - 1; i++) {
            const za = sortedW[i], zb = sortedW[i + 1];
            if (zb - za < 0.005) continue;
            if (!isInsideOtherWall(xW - delta, (za + zb) / 2)) {
                visibleLocalSegments.push([za - cz, ht, zb - cz, ht]);
            }
        }

        // Сторона East: world X = fixed + ht, normal (+1, 0), local Z = -ht
        const xE = fixed + ht;
        const cutsE = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minX - 0.005 <= xE && xE <= b.maxX + 0.005) {
                if (c1 < b.minZ && b.minZ < c2) cutsE.add(b.minZ);
                if (c1 < b.maxZ && b.maxZ < c2) cutsE.add(b.maxZ);
            }
        }
        const sortedE = Array.from(cutsE).sort((a, b) => a - b);
        for (let i = 0; i < sortedE.length - 1; i++) {
            const za = sortedE[i], zb = sortedE[i + 1];
            if (zb - za < 0.005) continue;
            if (!isInsideOtherWall(xE + delta, (za + zb) / 2)) {
                visibleLocalSegments.push([za - cz, -ht, zb - cz, -ht]);
            }
        }

        // Торец North: world Z = c1, normal (0, -1), local X = -hw
        if (!seg.omitStartCap) {
            const cutsN = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minZ - 0.005 <= c1 && c1 <= b.maxZ + 0.005) {
                    if ((fixed - ht) < b.minX && b.minX < (fixed + ht)) cutsN.add(b.minX);
                    if ((fixed - ht) < b.maxX && b.maxX < (fixed + ht)) cutsN.add(b.maxX);
                }
            }
            const sortedN = Array.from(cutsN).sort((a, b) => a - b);
            for (let i = 0; i < sortedN.length - 1; i++) {
                const xa = sortedN[i], xb = sortedN[i + 1];
                if (xb - xa < 0.005) continue;
                if (!isInsideOtherWall((xa + xb) / 2, c1 - delta)) {
                    visibleLocalSegments.push([-hw, fixed - xa, -hw, fixed - xb]);
                }
            }
        }

        // Торец South: world Z = c2, normal (0, +1), local X = +hw
        if (!seg.omitEndCap) {
            const cutsS = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minZ - 0.005 <= c2 && c2 <= b.maxZ + 0.005) {
                    if ((fixed - ht) < b.minX && b.minX < (fixed + ht)) cutsS.add(b.minX);
                    if ((fixed - ht) < b.maxX && b.maxX < (fixed + ht)) cutsS.add(b.maxX);
                }
            }
            const sortedS = Array.from(cutsS).sort((a, b) => a - b);
            for (let i = 0; i < sortedS.length - 1; i++) {
                const xa = sortedS[i], xb = sortedS[i + 1];
                if (xb - xa < 0.005) continue;
                if (!isInsideOtherWall((xa + xb) / 2, c2 + delta)) {
                    visibleLocalSegments.push([hw, fixed - xa, hw, fixed - xb]);
                }
            }
        }
    }

    const positions = [];
    // Для каждого видимого отрезка строим ребро сверху (yTop) и снизу (yBot)
    for (let i = 0; i < visibleLocalSegments.length; i++) {
        const segLine = visibleLocalSegments[i];
        const lx1 = segLine[0], lz1 = segLine[1], lx2 = segLine[2], lz2 = segLine[3];
        positions.push(lx1, yTop, lz1,  lx2, yTop, lz2);
        positions.push(lx1, yBot, lz1,  lx2, yBot, lz2);
    }

    // Вертикальные ребра на открытых внешних углах
    const corners = [[-hw, -ht], [-hw, ht], [hw, -ht], [hw, ht]];
    for (let i = 0; i < corners.length; i++) {
        const lx = corners[i][0], lz = corners[i][1];
        let touchesVisible = false;
        for (let j = 0; j < visibleLocalSegments.length; j++) {
            const sl = visibleLocalSegments[j];
            if ((Math.abs(sl[0] - lx) < 0.005 && Math.abs(sl[1] - lz) < 0.005) ||
                (Math.abs(sl[2] - lx) < 0.005 && Math.abs(sl[3] - lz) < 0.005)) {
                touchesVisible = true;
                break;
            }
        }
        if (!touchesVisible) continue;

        const wx = isH ? (cx + lx) : (cx - lz);
        const wz = isH ? (cz + lz) : (cz + lx);
        if (isInsideOtherWall(wx, wz)) continue;

        positions.push(lx, yBot, lz,  lx, yTop, lz);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
}

function flushWalls(targetGroup) {
    if (!targetGroup || !targetGroup._pendingWallLines || targetGroup._pendingWallLines.length === 0) return;
    const pendingLines = targetGroup._pendingWallLines;
    targetGroup._pendingWallLines = [];
    _pendingWallGroups.delete(targetGroup);

    const solvedSegments = solveCampusJunctions(targetGroup, pendingLines);

    // Сбор всех прямоугольных боксов стен этажа для точной резолюции бесшовных контурных рёбер
    const wallBoxes = [];
    if (targetGroup._pendingChamferBoxes) {
        for (let i = 0; i < targetGroup._pendingChamferBoxes.length; i++) {
            wallBoxes.push(targetGroup._pendingChamferBoxes[i]);
        }
    }
    for (let i = 0; i < solvedSegments.length; i++) {
        const s = solvedSegments[i];
        if (s.isDoor || s.isColumn) continue;
        const isH = s.isHorizontal;
        const cMin = Math.min(s.c1, s.c2);
        const cMax = Math.max(s.c1, s.c2);
        const ht = s.thickness / 2;
        wallBoxes.push({
            id: s.id,
            isH: isH,
            c1: cMin,
            c2: cMax,
            fixedCoord: s.fixedCoord,
            thickness: s.thickness,
            minX: isH ? cMin : s.fixedCoord - ht,
            maxX: isH ? cMax : s.fixedCoord + ht,
            minZ: isH ? s.fixedCoord - ht : cMin,
            maxZ: isH ? s.fixedCoord + ht : cMax
        });
    }

    const bldgNum = (targetGroup && targetGroup.userData) ? targetGroup.userData.building : null;
    for (let i = 0; i < solvedSegments.length; i++) {
        const seg = solvedSegments[i];
        const angle = seg.isHorizontal ? 0 : Math.PI / 2;
        // Определяем общую межкорпусную стену, чтобы не дублировать меш в режиме показа всех корпусов (both)
        let sharedBoundaryWith = null;
        if (bldgNum === 1 && !seg.isHorizontal && Math.abs(seg.fixedCoord - 20.4) < 0.05) {
            sharedBoundaryWith = 2;
        } else if (bldgNum === 3 && seg.isHorizontal && Math.abs(seg.fixedCoord - (-14.0)) < 0.05) {
            sharedBoundaryWith = 1;
        }

        let customEdgeGeom = null;
        if (!seg.isDoor) {
            customEdgeGeom = createResolvedWallEdgesGeometry(seg, wallBoxes);
        }

        createWallSegment(
            targetGroup,
            seg.c1,
            seg.c2,
            seg.fixedCoord,
            seg.isHorizontal,
            angle,
            seg.thickness,
            seg.isDoor,
            seg.isExterior,
            seg.isColumn,
            seg.omitStartCap,
            seg.omitEndCap,
            sharedBoundaryWith,
            customEdgeGeom
        );

        if (!seg.isDoor && !seg.isColumn && targetGroup.userData && targetGroup.userData.floor && typeof WALLS_REGISTRY !== 'undefined' && Array.isArray(WALLS_REGISTRY)) {
            const wallEntry = {
                floor: targetGroup.userData.floor,
                building: targetGroup.userData.building,
                x1: seg.isHorizontal ? seg.c1 : seg.fixedCoord,
                z1: seg.isHorizontal ? seg.fixedCoord : seg.c1,
                x2: seg.isHorizontal ? seg.c2 : seg.fixedCoord,
                z2: seg.isHorizontal ? seg.fixedCoord : seg.c2,
                thickness: seg.thickness
            };
            if (sharedBoundaryWith !== null) {
                wallEntry.sharedBoundaryWith = sharedBoundaryWith;
            }
            WALLS_REGISTRY.push(wallEntry);
        }
    }
    // Очищаем локальный список сопряжений группы после генерации
    targetGroup._miterJoints = null;
}

const finalizeFloorWalls = flushWalls;
window.finalizeFloorWalls = finalizeFloorWalls;
window.flushWalls = flushWalls;

function flushAllPendingWalls() {
    for (const group of _pendingWallGroups) {
        flushWalls(group);
    }
    _pendingWallGroups.clear();
}

function addArbitraryWallSegment(targetGroup, x1, z1, x2, z2, thickness = 0.18, isDoor = false, isExterior = false) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len <= 0.01) return;

    registerMiterJoint(targetGroup, x1, z1, thickness);
    registerMiterJoint(targetGroup, x2, z2, thickness);

    if (!isDoor && targetGroup && targetGroup.userData && targetGroup.userData.floor && typeof WALLS_REGISTRY !== 'undefined' && Array.isArray(WALLS_REGISTRY)) {
        WALLS_REGISTRY.push({
            floor: targetGroup.userData.floor,
            building: targetGroup.userData.building,
            x1: x1,
            z1: z1,
            x2: x2,
            z2: z2,
            thickness: thickness
        });
    }

    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const angle = Math.atan2(dz, dx);

    const geom = new THREE.BoxGeometry(len, 1, thickness);
    const mat = isDoor ? MATERIALS.doorThin : MATERIALS.wall;
    const mesh = new THREE.Mesh(geom, mat);

    const h = STATE.wallHeight;
    mesh.scale.y = h + WALL_SINK;
    mesh.position.set(cx, (h - WALL_SINK) / 2, cz);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const effectiveExterior = isExterior || (thickness >= 0.20);
    mesh.userData.isExterior = effectiveExterior;
    mesh.userData.isInterior = !effectiveExterior && (isDoor || (thickness < 0.20));
    mesh.userData.isDoor = isDoor;
    targetGroup.add(mesh);

    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edgeGeom, isDoor ? MATERIALS.edgeDoor : MATERIALS.edgeMain);
    edgeLine.userData.isExterior = effectiveExterior;
    edgeLine.userData.isInterior = mesh.userData.isInterior;
    edgeLine.userData.isDoor = isDoor;
    mesh.add(edgeLine);

    if (isDoor) {
        doorMeshes.push(mesh);
        doorEdges.push(edgeLine);
    } else {
        wallMeshes.push(mesh);
        wallEdges.push(edgeLine);
    }
}

// Построение стен со скошенными углами (45 градусов) с идеальным бесшовным усредненным стыком (Miter Joint)
// Исключает торчащие углы (шипы) и внутренние поперечные швы на стыках с ортогональными стенами!
function addMiteredChamferWall(targetGroup, x1, z1, x2, z2, thickness = 0.18, isExterior = false, isDoor = false) {
    if (!targetGroup) return;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const half = thickness / 2;
    let V1, V2, V3, V4;
    if (dx > 0 && dz > 0) {
        // Юго-западный скос (Корпус 1): от вертикальной стены X=x1 к горизонтальной стене Z=z2
        // Ортогональные плоские срезы на стыках без зазоров и выступов
        V1 = [x1 - half, z1];
        V2 = [x2, z2 + half];
        V3 = [x2, z2 - half];
        V4 = [x1 + half, z1];
    } else if (dx > 0 && dz < 0) {
        // Скос у кабинета 205 (Корпус 1 Этаж 2): от горизонтальной стены Z=z1 к вертикальной стене X=x2
        // Ортогональные плоские срезы на стыках без зазоров и выступов
        V1 = [x1, z1 + half];
        V2 = [x2 + half, z2];
        V3 = [x2 - half, z2];
        V4 = [x1, z1 - half];
    } else {
        const L = Math.hypot(dx, dz) || 1;
        const nx = -dz / L;
        const nz = dx / L;
        V1 = [x1 + half * nx, z1 + half * nz];
        V2 = [x2 + half * nx, z2 + half * nz];
        V3 = [x2 - half * nx, z2 - half * nz];
        V4 = [x1 - half * nx, z1 - half * nz];
    }

    registerMiterJoint(targetGroup, x1, z1, thickness);
    registerMiterJoint(targetGroup, x2, z2, thickness);

    // Регистрация бокса скошенной стены для резолюции видимых ребер (подавление поперечных торцевых швов)
    if (!targetGroup._pendingChamferBoxes) {
        targetGroup._pendingChamferBoxes = [];
    }
    targetGroup._pendingChamferBoxes.push({
        id: 'chamfer_' + Math.round(x1 * 100) + '_' + Math.round(z1 * 100),
        isChamfer: true,
        x1, z1, x2, z2,
        minX: Math.min(x1, x2) - half,
        maxX: Math.max(x1, x2) + half,
        minZ: Math.min(z1, z2) - half,
        maxZ: Math.max(z1, z2) + half,
        thickness
    });

    if (!isDoor && targetGroup && targetGroup.userData && targetGroup.userData.floor && typeof WALLS_REGISTRY !== 'undefined' && Array.isArray(WALLS_REGISTRY)) {
        WALLS_REGISTRY.push({
            floor: targetGroup.userData.floor,
            building: targetGroup.userData.building,
            x1: x1,
            z1: z1,
            x2: x2,
            z2: z2,
            thickness: thickness
        });
    }

    const shape = new THREE.Shape();
    shape.moveTo(V1[0], V1[1]);
    shape.lineTo(V2[0], V2[1]);
    shape.lineTo(V3[0], V3[1]);
    shape.lineTo(V4[0], V4[1]);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: 1,
        bevelEnabled: false
    });
    geom.rotateX(Math.PI / 2);
    geom.translate(0, 0.5, 0);

    const mat = isDoor ? MATERIALS.doorThin : MATERIALS.wall;
    const mesh = new THREE.Mesh(geom, mat);

    const h = STATE.wallHeight;
    mesh.scale.set(1, h + WALL_SINK, 1);
    mesh.position.set(0, (h - WALL_SINK) / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const effectiveExterior = isExterior || (thickness >= 0.20);
    mesh.userData.isExterior = effectiveExterior;
    mesh.userData.isInterior = !effectiveExterior && (isDoor || (thickness < 0.20));
    mesh.userData.isDoor = isDoor;
    mesh.userData.isMiteredChamfer = true;
    targetGroup.add(mesh);

    // Бесшовные контурные ребра: только наружный и внутренний фасад (ноль поперечных швов на стыках!)
    const yTop = h;
    const yBot = -WALL_SINK;
    const edgePoints = [
        new THREE.Vector3(V1[0], yTop, V1[1]), new THREE.Vector3(V2[0], yTop, V2[1]),
        new THREE.Vector3(V3[0], yTop, V3[1]), new THREE.Vector3(V4[0], yTop, V4[1]),
        new THREE.Vector3(V1[0], yBot, V1[1]), new THREE.Vector3(V2[0], yBot, V2[1]),
        new THREE.Vector3(V3[0], yBot, V3[1]), new THREE.Vector3(V4[0], yBot, V4[1])
    ];
    const edgeGeom = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.LineSegments(edgeGeom, isDoor ? MATERIALS.edgeDoor : MATERIALS.edgeMain);
    edgeLine.userData.isExterior = effectiveExterior;
    edgeLine.userData.isInterior = mesh.userData.isInterior;
    edgeLine.userData.isDoor = isDoor;
    edgeLine.userData.isMiteredChamfer = true;
    targetGroup.add(edgeLine);

    if (isDoor) {
        doorMeshes.push(mesh);
        doorEdges.push(edgeLine);
    } else {
        wallMeshes.push(mesh);
        wallEdges.push(edgeLine);
    }
}

function createWallSegment(targetGroup, c1, c2, fixedCoord, isHorizontal, angle, thickness, isDoor, isExterior = false, isColumn = false, omitStart = false, omitEnd = false, sharedBoundaryWith = null, customEdgeGeom = null) {
    const len = Math.abs(c2 - c1);
    if (len <= 0.01) return;

    const mid = (c1 + c2) / 2;
    const cx = isHorizontal ? mid : fixedCoord;
    const cz = isHorizontal ? fixedCoord : mid;

    const geom = getCachedBoxGeometry(len, 1, thickness);
    const mat = isDoor ? MATERIALS.doorThin : MATERIALS.wall;
    const mesh = new THREE.Mesh(geom, mat);

    const h = STATE.wallHeight;
    mesh.scale.y = h + WALL_SINK;
    mesh.position.set(cx, (h - WALL_SINK) / 2, cz);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isExterior = isExterior;
    mesh.userData.isInterior = !isExterior && (isDoor || (thickness < 0.20));
    mesh.userData.isDoor = isDoor;
    if (sharedBoundaryWith !== null) {
        mesh.userData.sharedBoundaryWith = sharedBoundaryWith;
        if (typeof STATE !== 'undefined' && STATE.buildingFilter === 'both') {
            mesh.visible = false;
        }
    }
    if (isColumn) {
        mesh.userData.isColumn = true;
        mesh.userData.isInterior = true;
    }
    targetGroup.add(mesh);

    const edgeGeom = customEdgeGeom || (isDoor ? getCachedEdgesGeometry(geom, len, 1, thickness) : createWallEdgesGeometry(len, thickness, omitStart, omitEnd));
    const edgeLine = new THREE.LineSegments(edgeGeom, isDoor ? MATERIALS.edgeDoor : MATERIALS.edgeMain);
    edgeLine.userData.isExterior = isExterior;
    edgeLine.userData.isInterior = mesh.userData.isInterior;
    edgeLine.userData.isDoor = isDoor;
    if (sharedBoundaryWith !== null) {
        edgeLine.userData.sharedBoundaryWith = sharedBoundaryWith;
    }
    if (isColumn) {
        edgeLine.userData.isColumn = true;
    }
    mesh.add(edgeLine);

    if (isColumn && typeof STATE !== 'undefined' && STATE.is2D) {
        mesh.visible = false;
        edgeLine.visible = false;
    }

    if (isDoor) {
        doorMeshes.push(mesh);
        doorEdges.push(edgeLine);
    } else {
        wallMeshes.push(mesh);
        wallEdges.push(edgeLine);
    }
}

// Построение стен со скошенными углами (45 градусов) с идеальным бесшовным усредненным стыком (Miter Joint)


function addSquareColumn(targetGroup, cx, cz, size = 0.28, isExterior = false) {
    const geom = getCachedBoxGeometry(size, 1, size);
    const mesh = new THREE.Mesh(geom, MATERIALS.wall);
    const h = STATE.wallHeight;
    mesh.scale.y = h;
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isExterior = isExterior;
    mesh.userData.isInterior = !isExterior;
    mesh.userData.isColumn = true;
    targetGroup.add(mesh);

    const edgeGeom = getCachedEdgesGeometry(geom, size, 1, size);
    const edgeLine = new THREE.LineSegments(edgeGeom, MATERIALS.edgeMain);
    edgeLine.userData.isExterior = isExterior;
    edgeLine.userData.isInterior = !isExterior;
    edgeLine.userData.isColumn = true;
    mesh.add(edgeLine);

    if (typeof STATE !== 'undefined' && STATE.is2D) {
        mesh.visible = false;
        edgeLine.visible = false;
    }

    wallMeshes.push(mesh);
    wallEdges.push(edgeLine);
}

function formatRoomDisplayName(text, buildingNum) {
    if (!text) return '';
    const b = parseInt(buildingNum, 10);
    const raw = String(text).trim();
    if (b <= 1 || isNaN(b)) return raw;
    if (raw.startsWith('2-') || raw.startsWith('3-') || raw.startsWith('4-') || raw.startsWith('5-')) return raw;
    if (raw.startsWith('С/У') || raw.startsWith('С/У')) return raw;
    const numPrefixMatch = raw.match(/^(\d+[а-яa-z]?)(.*)$/i);
    if (numPrefixMatch) {
        return b + '-' + numPrefixMatch[1] + numPrefixMatch[2];
    }
    return raw;
}
window.formatRoomDisplayName = formatRoomDisplayName;

function computeRoomLabelPriority(textStr) {
    const t = (textStr || '').trim();
    if (/столов|спорт|актов|гардероб|библиот|конференц|учебн/i.test(t)) return 0;
    if (/^\d+[\u0400-\u04FFA-Za-z]?$/.test(t)) return 1;
    if (t.includes('\n') || t.length > 3) return 2;
    if (t.startsWith('ЛК') || t.startsWith('\u041B\u041A')) return 3;
    if (t.startsWith('С/У') || t.startsWith('\u0421/\u0423')) return 4;
    return 2;
}

function addRoomLabel3D(targetGroup, floorNum, text, x, z, isSmall = false, isWide = false, buildingNum = 1, customScale = 1.0) {
    const lines = text.split('\n');
    const isMultiLine = lines.length > 1;
    const width = isWide ? 768 : (isSmall ? 384 : 512);
    const height = isMultiLine ? 256 : (isSmall ? 192 : 256);

    // Увеличенные комфортные габариты плашки в 3D пространстве (без создания 250 тяжелых CanvasTexture, т.к. рендер идет через 2D Screen-Space Overlay)
    const baseW = isWide ? 6.4 : (isSmall ? 2.8 : 4.0);
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;
    const planeW = baseW * customScale;
    const planeH = planeW * (height / width);
    const geom = new THREE.PlaneGeometry(planeW, planeH);

    if (!_sharedHiddenLabelMat) {
        _sharedHiddenLabelMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }
    const mat = _sharedHiddenLabelMat;

    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    // Плашка приподнята над полом комнаты (y = 0.04)
    mesh.position.set(x, 0.04, z);
    mesh.scale.set(scaleMult, scaleMult, 1);
    mesh.userData.isInterior = true;
    mesh.userData.isRoomLabel = true;
    // 3D-меш скрываем из WebGL рендера, так как надписи отрисовываются
    // в 100% честном нативном разрешении экрана Retina через Screen-Space 2D Overlay Canvas!
    mesh.visible = false;
    mesh.userData.roomInfo = {
        text: text,
        floor: floorNum,
        building: buildingNum,
        x: x,
        z: z
    };
    targetGroup.add(mesh);

    const labelItem = {
        mesh,
        floor: floorNum,
        building: buildingNum,
        localX: x,
        localZ: z,
        text: text,
        baseW: baseW,
        customScale: customScale,
        ratio: height / width
    };
    labelSprites.push(labelItem);

    if (typeof ROOMS_REGISTRY !== 'undefined') {
        const dispVal = formatRoomDisplayName(text.replace('\n', ' '), buildingNum);
        ROOMS_REGISTRY.push({
            text: dispVal,
            rawText: text,
            floor: floorNum,
            building: buildingNum,
            x: x,
            z: z,
            mesh: mesh,
            isSmall: isSmall,
            isWide: isWide,
            baseW: baseW,
            customScale: customScale || 1.0,
            ratio: height / width,
            _priority: computeRoomLabelPriority(dispVal)
        });
    }
}

// ==========================================
// SCREEN-SPACE RETINA OVERLAY ДЛЯ НАДПИСЕЙ КАБИНЕТОВ
// 100% честная резкость на любых экранах телефонов (iOS/Android),
// ноль размытия текстур, ноль искажения перспективой, как в картах 2GIS / Google Maps!
// ==========================================

let overlayCanvas = null;
let overlayCtx = null;
let renderedScreenBadges = [];

function drawWcIcon(ctx, cx, cy, size, gender, color) {
    const H = size;
    const w = size * 0.74;
    const topY = cy - H / 2;
    const r = H * 0.145;
    const headCy = topY + r;
    const gap = H * 0.09;
    const bodyTop = headCy + r + gap;
    const bodyBot = cy + H / 2;

    ctx.save();
    ctx.fillStyle = color;

    // Круглая голова
    ctx.beginPath();
    ctx.arc(cx, headCy, r, 0, Math.PI * 2);
    ctx.fill();

    // Тело: треугольник со скруглёнными углами
    ctx.beginPath();
    const cornerR = Math.max(H * 0.08, 1.2);
    if (gender === 'female') {
        // Женский силуэт: треугольник вершиной вверх (юбка/платье)
        const p1x = cx, p1y = bodyTop;
        const p2x = cx + w * 0.50, p2y = bodyBot;
        const p3x = cx - w * 0.50, p3y = bodyBot;

        ctx.moveTo(cx, bodyTop + cornerR);
        ctx.arcTo(p2x, p2y, p3x, p3y, cornerR);
        ctx.arcTo(p3x, p3y, p1x, p1y, cornerR);
        ctx.arcTo(p1x, p1y, p2x, p2y, cornerR);
    } else {
        // Мужской силуэт: перевёрнутый треугольник вершиной вниз (широкие плечи)
        const p1x = cx - w * 0.52, p1y = bodyTop;
        const p2x = cx + w * 0.52, p2y = bodyTop;
        const p3x = cx, p3y = bodyBot;

        ctx.moveTo(p1x + cornerR, p1y);
        ctx.arcTo(p2x, p2y, p3x, p3y, cornerR);
        ctx.arcTo(p3x, p3y, p1x, p1y, cornerR);
        ctx.arcTo(p1x, p1y, p2x, p2y, cornerR);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
window.renderedScreenBadges = renderedScreenBadges;
let activeBadgeKeys = new Set();
const _tempProjectVec = new THREE.Vector3();
const _tempProjectVec2 = new THREE.Vector3();

function initLabelsOverlay() {
    overlayCanvas = document.getElementById('labels-overlay-canvas');
    if (!overlayCanvas) return;
    overlayCtx = overlayCanvas.getContext('2d');
    resizeLabelsOverlay();
}

function resizeLabelsOverlay() {
    if (!overlayCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3.0);
    const w = window.innerWidth;
    const h = window.innerHeight;
    overlayCanvas.width = Math.round(w * dpr);
    overlayCanvas.height = Math.round(h * dpr);
}


function renderWorldCoordinateGridOverlay(ctx, w, h, activeFloor) {
    if (!camera || typeof STATE === 'undefined') return;
    if (!STATE.showGrid && !STATE.debugPlan) return;

    const fg = (typeof floorGroups !== 'undefined' && floorGroups[activeFloor]) ? floorGroups[activeFloor] : null;
    const baseY = fg ? (fg.position.y + 0.06) : 0.06;
    const bFilter = STATE.buildingFilter;

    let xMin = -18, xMax = 72, zMin = -64, zMax = 18;
    if (bFilter === '1') { xMin = -16; xMax = 22; zMin = -16; zMax = 16; }
    else if (bFilter === '2') { xMin = 18; xMax = 70; zMin = -16; zMax = 6; }
    else if (bFilter === '3') { xMin = -5; xMax = 17; zMin = -64; zMax = -12; }
    else if (bFilter === '4') { xMin = 26; xMax = 71; zMin = -63; zMax = -23; }

    ctx.save();
    const fontStack = '700 10px "SF Mono", Menlo, Consolas, monospace';
    ctx.font = fontStack;

    // 1m and 2m X grid lines (vertical on screen in 2D top view)
    for (let gx = xMin; gx <= xMax; gx++) {
        _tempProjectVec.set(gx, baseY, zMin).project(camera);
        _tempProjectVec2.set(gx, baseY, zMax).project(camera);
        if (_tempProjectVec.z > 1.0 && _tempProjectVec2.z > 1.0) continue;

        const sx1 = (_tempProjectVec.x * 0.5 + 0.5) * w;
        const sy1 = (-_tempProjectVec.y * 0.5 + 0.5) * h;
        const sx2 = (_tempProjectVec2.x * 0.5 + 0.5) * w;
        const sy2 = (-_tempProjectVec2.y * 0.5 + 0.5) * h;

        const isMajor = (gx % 2 === 0);
        ctx.strokeStyle = isMajor ? 'rgba(14, 116, 144, 0.38)' : 'rgba(100, 116, 139, 0.18)';
        ctx.lineWidth = isMajor ? 1.0 : 0.6;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        if (isMajor && sx1 >= 24 && sx1 <= w - 24) {
            const topY = Math.max(54, Math.min(h - 20, Math.min(sy1, sy2) + 10));
            const botY = Math.min(h - 10, Math.max(54, Math.max(sy1, sy2) - 6));
            ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            ctx.fillText(`X=${gx}`, sx1 + 2, topY);
            ctx.fillText(`X=${gx}`, sx2 + 2, botY);
        }
    }

    // 1m and 2m Z grid lines (horizontal on screen in 2D top view)
    for (let gz = zMin; gz <= zMax; gz++) {
        _tempProjectVec.set(xMin, baseY, gz).project(camera);
        _tempProjectVec2.set(xMax, baseY, gz).project(camera);
        if (_tempProjectVec.z > 1.0 && _tempProjectVec2.z > 1.0) continue;

        const sx1 = (_tempProjectVec.x * 0.5 + 0.5) * w;
        const sy1 = (-_tempProjectVec.y * 0.5 + 0.5) * h;
        const sx2 = (_tempProjectVec2.x * 0.5 + 0.5) * w;
        const sy2 = (-_tempProjectVec2.y * 0.5 + 0.5) * h;

        const isMajor = (gz % 2 === 0);
        ctx.strokeStyle = isMajor ? 'rgba(14, 116, 144, 0.38)' : 'rgba(100, 116, 139, 0.18)';
        ctx.lineWidth = isMajor ? 1.0 : 0.6;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        if (isMajor && sy1 >= 50 && sy1 <= h - 16) {
            const leftX = Math.max(8, Math.min(sx1, sx2) + 4);
            const rightX = Math.min(w - 48, Math.max(sx1, sx2) - 42);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            ctx.fillText(`Z=${gz}`, leftX, sy1 - 2);
            ctx.fillText(`Z=${gz}`, rightX, sy2 - 2);
        }
    }

    // In debugPlan mode, highlight door openings in bright emerald green
    if (STATE.debugPlan && typeof DOORS_REGISTRY !== 'undefined') {
        for (let i = 0; i < DOORS_REGISTRY.length; i++) {
            const d = DOORS_REGISTRY[i];
            if (d.floor !== activeFloor) continue;
            if (bFilter !== 'both' && String(d.building) !== bFilter) continue;
            const x1 = d.isHorizontal ? d.from : d.wallCoord;
            const z1 = d.isHorizontal ? d.wallCoord : d.from;
            const x2 = d.isHorizontal ? d.to : d.wallCoord;
            const z2 = d.isHorizontal ? d.wallCoord : d.to;
            _tempProjectVec.set(x1, baseY + 0.1, z1).project(camera);
            _tempProjectVec2.set(x2, baseY + 0.1, z2).project(camera);
            if (_tempProjectVec.z > 1.0 || _tempProjectVec2.z > 1.0) continue;
            const sx1 = (_tempProjectVec.x * 0.5 + 0.5) * w;
            const sy1 = (-_tempProjectVec.y * 0.5 + 0.5) * h;
            const sx2 = (_tempProjectVec2.x * 0.5 + 0.5) * w;
            const sy2 = (-_tempProjectVec2.y * 0.5 + 0.5) * h;
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.92)';
            ctx.lineWidth = 4.0;
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function renderScreenSpaceLabels() {
    if (!overlayCanvas) {
        initLabelsOverlay();
    }
    if (!overlayCanvas || !overlayCtx || !camera) return;

    // Гарантируем актуальность матриц камеры для проекции координат
    camera.updateMatrixWorld();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3.0);

    if (overlayCanvas.width !== Math.round(w * dpr) || overlayCanvas.height !== Math.round(h * dpr)) {
        overlayCanvas.width = Math.round(w * dpr);
        overlayCanvas.height = Math.round(h * dpr);
    }

    overlayCtx.save();
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.scale(dpr, dpr);

    renderedScreenBadges = [];
    window.renderedScreenBadges = renderedScreenBadges;
    const nextActiveBadgeKeys = new Set();

    if (!STATE.showLabels || !ROOMS_REGISTRY || ROOMS_REGISTRY.length === 0) {
        activeBadgeKeys.clear();
        overlayCtx.restore();
        return;
    }

    const isSingle = (STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice');
    const activeFloor = isSingle ? parseInt(STATE.mode, 10) : 1;
    const maxFloor = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;
    const bldgFilter = STATE.buildingFilter;
    if (STATE.showGrid || STATE.debugPlan) {
        renderWorldCoordinateGridOverlay(overlayCtx, w, h, activeFloor);
    }
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;

    // Дистанция камеры до карты для плавного масштабирования плашек при зуме
    const camDist = (controls && controls.target) ? camera.position.distanceTo(controls.target) : 55;
    const isFarZoom = camDist > 55;

    // Плавное пропорциональное масштабирование плашек при отдалении:
    // При приближении (camDist <= 28) плашки крупнее (1.05)
    // При отдалении (camDist = 55..100+) плашки плавно сжимаются до 0.58 от нормального размера,
    // что позволяет им оставаться ВНУТРИ кабинетов и НЕ пропадать с чертежа!
    const zoomScale = Math.min(Math.max(38 / Math.max(camDist, 22), 0.55), 1.05);

    // Сортировка: наивысший приоритет у ключевых кабинетов и лабораторий,
    // чтобы при общем виде сверху в первую очередь ВСЕГДА были видны номера комнат,
    // а второстепенные тех. помещения (С/У, ЛК) уступали им место без перекрытия
    function getRoomPriority(r) {
        if (r._priority !== undefined) return r._priority;
        r._priority = computeRoomLabelPriority(r.text);
        return r._priority;
    }

    const candidateRooms = [];
    for (let i = 0; i < ROOMS_REGISTRY.length; i++) {
        const r = ROOMS_REGISTRY[i];

        if (bldgFilter !== 'both' && String(r.building) !== bldgFilter) continue;
        if (isSingle) {
            if (r.floor !== activeFloor) continue;
        } else if (STATE.mode === 'slice') {
            if (r.floor > maxFloor) continue;
        }

        const fg = floorGroups[r.floor];
        if (!fg || !fg.visible) continue;

        // В многоэтажном виде отсекаем кабинеты, которые перекрыты сплошными плитами верхних этажей,
        // чтобы они не просвечивали сквозь потолок и не конфликтовали с верхними плашками
        if (!isSingle && typeof isLabelOccludedByUpperSlabs === 'function') {
            if (isLabelOccludedByUpperSlabs(r, r.floor, r.building)) {
                continue;
            }
        }

        candidateRooms.push({ room: r, fg });
    }

    // 100% Детерминированная сортировка: приоритет + точный порядок по номеру комнаты и координатам
    // (полностью исключает случайную инверсию порядка и мерцание плашек от кадра к кадру)
    candidateRooms.sort((a, b) => {
        const pa = getRoomPriority(a.room);
        const pb = getRoomPriority(b.room);
        if (pa !== pb) return pa - pb;
        const textCmp = a.room.text.localeCompare(b.room.text, undefined, { numeric: true });
        if (textCmp !== 0) return textCmp;
        if (a.room.floor !== b.room.floor) return a.room.floor - b.room.floor;
        if (a.room.building !== b.room.building) return a.room.building - b.room.building;
        if (a.room.x !== b.room.x) return a.room.x - b.room.x;
        return a.room.z - b.room.z;
    });



    let _labelQueryStamp = 0;
    // Пространственная 2D-сетка (Spatial Grid) для детекции коллизий бейджей с O(N) вместо O(N^2)
    const GRID_CELL_SIZE = 96;
    const gridCols = Math.max(1, Math.ceil(w / GRID_CELL_SIZE) + 2);
    const gridRows = Math.max(1, Math.ceil(h / GRID_CELL_SIZE) + 2);
    const spatialGrid = new Map();

    function getGridCellIndices(bx0, by0, bx1, by1) {
        const cMinX = Math.max(0, Math.floor((bx0 + 80) / GRID_CELL_SIZE));
        const cMaxX = Math.min(gridCols - 1, Math.floor((bx1 + 80) / GRID_CELL_SIZE));
        const cMinY = Math.max(0, Math.floor((by0 + 40) / GRID_CELL_SIZE));
        const cMaxY = Math.min(gridRows - 1, Math.floor((by1 + 40) / GRID_CELL_SIZE));
        const indices = [];
        for (let cy = cMinY; cy <= cMaxY; cy++) {
            for (let cx = cMinX; cx <= cMaxX; cx++) {
                indices.push(cy * gridCols + cx);
            }
        }
        return indices;
    }

    for (let i = 0; i < candidateRooms.length; i++) {
        const { room: r, fg } = candidateRooms[i];

        const worldX = fg.position.x + r.x;
        const worldY = fg.position.y + 0.12;
        const worldZ = fg.position.z + r.z;

        _tempProjectVec.set(worldX, worldY, worldZ).project(camera);

        // Отсекаем то, что за камерой
        if (_tempProjectVec.z > 1.0) continue;

        const sx = (_tempProjectVec.x * 0.5 + 0.5) * w;
        const sy = (-_tempProjectVec.y * 0.5 + 0.5) * h;

        // Отсекаем только то, что полностью за видимыми границами экрана
        if (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40) continue;

        // 1. Координаты на экране с субпиксельным округлением к физической сетке дисплея (для полного исключения дрожания)
        const physX = Math.round(sx * dpr);
        const physY = Math.round(sy * dpr);
        const drawX = physX / dpr;
        const drawY = physY / dpr;

        // 2. Размер шрифта и плашки: плавно уменьшаются при отдалении камеры, чтобы оставаться на схеме и не пропадать
        const isMulti = r.rawText && r.rawText.includes('\n');
        const lines = isMulti ? r.rawText.split('\n') : [r.text];

        // Базовый размер шрифта масштабируется в зависимости от удаления камеры (от 1.05 до 0.55)
        const customScaleFactor = (typeof r.customScale === 'number' && r.customScale > 0) ? r.customScale : 1.0;
        const baseFontSize = (r.isSmall ? 12.5 : (r.isWide ? 14.5 : 15.5)) * customScaleFactor * scaleMult;
        const fontSize = Math.max(Math.round(baseFontSize * zoomScale), 8.5);

        const fontStack = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
        const fontStr = '900 ' + fontSize + 'px ' + fontStack;
        if (overlayCtx.font !== fontStr) {
            overlayCtx.font = fontStr;
        }

        let maxLineW = 0;
        for (let l = 0; l < lines.length; l++) {
            const mKey = fontSize + '|' + lines[l];
            let lw = _textWidthCache.get(mKey);
            if (lw === undefined) {
                if (_textWidthCache.size > 2000) {
                    const oldestKey = _textWidthCache.keys().next().value;
                    _textWidthCache.delete(oldestKey);
                }
                lw = overlayCtx.measureText(lines[l]).width;
                _textWidthCache.set(mKey, lw);
            }
            if (lw > maxLineW) maxLineW = lw;
        }

        // Определение гендерного санузла (М / Ж)
        const rawWcText = (r.rawText || r.text || '');
        const isMaleWc = /с\/у\s*\(?м\)?/i.test(rawWcText);
        const isFemaleWc = /с\/у\s*\(?ж\)?/i.test(rawWcText);
        const isWcIcon = isMaleWc || isFemaleWc;

        // Отступы пропорционально сжимаются при отдалении камеры
        const padX = Math.max(Math.round(fontSize * 0.36), 2.5);
        const padY = Math.max(Math.round(fontSize * 0.20), 1.5);
        const iconSize = Math.max(Math.round(fontSize * 1.25), 12);
        const badgeW = isWcIcon ? Math.max(Math.round(iconSize * 1.30), 18) : Math.round(maxLineW + padX * 2);
        const badgeH = isWcIcon ? Math.max(Math.round(iconSize * 1.30), 18) : Math.round(isMulti ? (fontSize * 2.1 + padY * 2) : (fontSize + padY * 2 + 1.5));

        const x0 = Math.round(drawX - badgeW / 2);
        const y0 = Math.round(drawY - badgeH / 2);
        const x1 = x0 + badgeW;
        const y1 = y0 + badgeH;

        // 3. Строгая проверка наложения с гарантированным зазором через пространственную сетку:
        const badgeKey = `${r.building}-${r.floor}-${r.text}-${Math.round(r.x * 10)}-${Math.round(r.z * 10)}`;
        const wasVisible = activeBadgeKeys.has(badgeKey);
        const baseMargin = Math.max(1.6, Math.min(2.8, 2.6 * zoomScale));
        const margin = wasVisible ? Math.max(0.8, 1.0 * zoomScale) : baseMargin;

        const checkCells = getGridCellIndices(x0 - margin, y0 - margin, x1 + margin, y1 + margin);
        let overlap = false;
        _labelQueryStamp++;

        for (let c = 0; c < checkCells.length; c++) {
            const cellBoxes = spatialGrid.get(checkCells[c]);
            if (!cellBoxes) continue;
            for (let b = 0; b < cellBoxes.length; b++) {
                const db = cellBoxes[b];
                if (db._stamp === _labelQueryStamp) continue;
                db._stamp = _labelQueryStamp;
                if (!(x1 + margin < db.x0 || x0 - margin > db.x1 || y1 + margin < db.y0 || y0 - margin > db.y1)) {
                    overlap = true;
                    break;
                }
            }
            if (overlap) break;
        }
        if (overlap) continue;

        nextActiveBadgeKeys.add(badgeKey);
        const boxObj = { x0, y0, x1, y1 };
        for (let c = 0; c < checkCells.length; c++) {
            const cIdx = checkCells[c];
            let cellList = spatialGrid.get(cIdx);
            if (!cellList) {
                cellList = [];
                spatialGrid.set(cIdx, cellList);
            }
            cellList.push(boxObj);
        }
        renderedScreenBadges.push({ room: r, x0, y0, x1, y1 });

        // 4. Отрисовка плашки номера кабинета (Тёмная / Светлая тема):
        const isDarkTheme = (typeof STATE !== 'undefined' && STATE.theme === 'dark');
        const badgeBg = isDarkTheme ? '#1e293b' : '#ffffff';
        const badgeStroke = isDarkTheme ? '#475569' : '#94a3b8';
        const badgeText = isDarkTheme ? '#f8fafc' : '#0f172a';
        const badgeSec = isDarkTheme ? '#94a3b8' : '#475569';

        overlayCtx.shadowColor = isDarkTheme ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.10)';
        overlayCtx.shadowBlur = Math.round(4 * zoomScale);
        overlayCtx.shadowOffsetY = Math.round(1.5 * zoomScale);

        overlayCtx.fillStyle = badgeBg;
        overlayCtx.strokeStyle = badgeStroke;
        overlayCtx.lineWidth = Math.max(1.3 * zoomScale, 1.0);

        overlayCtx.beginPath();
        overlayCtx.roundRect(x0, y0, badgeW, badgeH, Math.max(4.0 * zoomScale, 2.5));
        overlayCtx.fill();
        overlayCtx.stroke();

        overlayCtx.shadowColor = 'transparent';
        overlayCtx.shadowBlur = 0;
        overlayCtx.shadowOffsetY = 0;

        overlayCtx.textAlign = 'center';
        overlayCtx.textBaseline = 'middle';
        overlayCtx.fillStyle = badgeText;

        if (isWcIcon) {
            // Векторная отрисовка силуэтной иконки М/Ж со скруглёнными углами (акцентный цвет)
            const wcColor = isDarkTheme ? (isMaleWc ? '#38bdf8' : '#fb7185') : (isMaleWc ? '#0284c7' : '#e11d48');
            drawWcIcon(overlayCtx, drawX, drawY, iconSize, isMaleWc ? 'male' : 'female', wcColor);
        } else if (isMulti) {
            overlayCtx.font = '900 ' + (fontSize - 1) + 'px ' + fontStack;
            overlayCtx.fillText(lines[0], drawX, y0 + padY + (fontSize - 1) / 2);
            overlayCtx.fillStyle = badgeSec;
            overlayCtx.font = '800 ' + Math.max(fontSize - 2, 7.5) + 'px ' + fontStack;
            overlayCtx.fillText(lines[1], drawX, y0 + badgeH - padY - Math.max(fontSize - 2, 7.5) / 2);
        } else {
            overlayCtx.font = '900 ' + fontSize + 'px ' + fontStack;
            overlayCtx.fillText(r.text, drawX, drawY + 0.5);
        }
    }

    activeBadgeKeys = nextActiveBadgeKeys;

    // Отрисовка Screen-Space Retina бейджей навигатора (Точки А, Б, лестничные указатели)
    if (typeof renderNavigatorScreenBadges === 'function' && typeof NAV_STATE !== 'undefined' && NAV_STATE.activeRoute) {
        renderNavigatorScreenBadges(overlayCtx, dpr, w, h);
    }

    // Синхронизация позиции всплывающего попапа выбранного кабинета с его 3D-координатами
    if (typeof updateRoomContextPopupScreenPos === 'function') {
        updateRoomContextPopupScreenPos(w, h);
    }

    overlayCtx.restore();
}

function updateRoomLabelsScale() {
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;
    labelSprites.forEach(item => {
        if (!item || !item.mesh) return;
        const planeW = item.baseW * item.customScale * scaleMult;
        const planeH = planeW * item.ratio;
        item.currentW = planeW;
        item.currentH = planeH;
        item.mesh.scale.set(scaleMult, scaleMult, 1);
    });
    if (typeof lastAdaptiveDist !== 'undefined') {
        lastAdaptiveDist = -1;
    }
    if (typeof updateAdaptiveLabelScaling === 'function') {
        updateAdaptiveLabelScaling();
    }
    if (typeof requestRender === 'function') requestRender(25);
}

// Алиас для обратной совместимости
const addRoomLabel = addRoomLabel3D;

function buildElevatorShaftCross(targetGroup, x1, z1, x2, z2) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const geom = new THREE.BoxGeometry(w, 0.08, d);
    const mesh = new THREE.Mesh(geom, MATERIALS.elevatorCar);
    mesh.position.set(cx, 0.04, cz);
    mesh.userData.isInterior = true;
    targetGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geom);
    mesh.add(new THREE.LineSegments(edges, MATERIALS.edgeMain));

    const pts = [
        new THREE.Vector3(x1, 0.09, z1),
        new THREE.Vector3(x2, 0.09, z2),
        new THREE.Vector3(x2, 0.09, z1),
        new THREE.Vector3(x1, 0.09, z2)
    ];
    const crossGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const crossLine = new THREE.LineSegments(crossGeom, MATERIALS.edgeMain);
    crossLine.userData.isInterior = true;
    targetGroup.add(crossLine);
}


function addOutdoorPorchStep(targetGroup, geomOrW, dOrCx, cxOrCz, czOrYTop, yTopOrYBottom, maybeYBottom) {
    let geom, cx, cz, yTop, yBottom, stepH;
    const isBufferGeom = (geomOrW && typeof geomOrW === 'object' && geomOrW.isBufferGeometry);

    if (isBufferGeom) {
        geom = geomOrW;
        cx = dOrCx;
        cz = cxOrCz;
        yTop = czOrYTop;
        yBottom = yTopOrYBottom !== undefined ? yTopOrYBottom : -0.16;
        stepH = Math.max(0.02, yTop - yBottom);
    } else {
        const w = geomOrW;
        const d = dOrCx;
        cx = cxOrCz;
        cz = czOrYTop;
        yTop = yTopOrYBottom;
        yBottom = maybeYBottom !== undefined ? maybeYBottom : -0.16;
        stepH = Math.max(0.02, yTop - yBottom);
        geom = getCachedBoxGeometry(w, stepH, d);
    }

    const mesh = new THREE.Mesh(geom, MATERIALS.coreSlab);
    if (isBufferGeom) {
        mesh.scale.y = stepH;
    }
    mesh.position.set(cx, (yTop + yBottom) / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isInterior = false;
    mesh.userData.isExterior = true;
    mesh.userData.isStair = true;

    const edges = isBufferGeom ? new THREE.EdgesGeometry(geom) : getCachedEdgesGeometry(geom, geomOrW, stepH, dOrCx);
    const edgeLine = new THREE.LineSegments(edges, MATERIALS.edgeMain);
    edgeLine.userData.isInterior = false;
    edgeLine.userData.isExterior = true;
    edgeLine.userData.isStair = true;
    mesh.add(edgeLine);

    targetGroup.add(mesh);
}
window.addOutdoorPorchStep = addOutdoorPorchStep;

function registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, yOffset = 0, isExterior = false) {
    const mesh = new THREE.Mesh(geom, MATERIALS.stair);
    const stepH = Math.max(0.06, STATE.wallHeight * heightRatio);
    mesh.scale.y = stepH;
    mesh.position.set(sx, (stepH / 2) + yOffset, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const effectiveIsExterior = isExterior || (yOffset < -0.05);
    mesh.userData.isInterior = !effectiveIsExterior;
    mesh.userData.isExterior = effectiveIsExterior;
    mesh.userData.isStair = true;

    const edges = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edges, MATERIALS.edgeMain);
    edgeLine.userData.isInterior = !effectiveIsExterior;
    edgeLine.userData.isExterior = effectiveIsExterior;
    edgeLine.userData.isStair = true;
    mesh.add(edgeLine);
    targetGroup.add(mesh);

    if (!effectiveIsExterior) {
        stairMeshes.push({ mesh, heightRatio, yOffset });
    }
}

function buildStaircaseUnit(targetGroup, zTop, zBottom, zMid, isUpperStaircase, startX = 10.2, endX = 14.6, landingX = 15.3) {
    addWallLine(targetGroup, startX, zMid, endX, zMid, [], 0.08);

    const stepsCount = 10;
    const stepDepth = (endX - startX) / stepsCount;

    const flights = [
        { z1: zTop + 0.12, z2: zMid - 0.06, dir: isUpperStaircase ? 1 : -1 },
        { z1: zMid + 0.06, z2: zBottom - 0.12, dir: isUpperStaircase ? -1 : 1 }
    ];

    flights.forEach(fl => {
        const flightW = Math.abs(fl.z2 - fl.z1);
        const cz = (fl.z1 + fl.z2) / 2;

        for (let i = 0; i < stepsCount; i++) {
            const ratio = fl.dir === 1 ? (i + 1) / stepsCount : (stepsCount - i) / stepsCount;
            const heightRatio = ratio * 0.52;
            const sx = startX + (i + 0.5) * stepDepth;

            const geom = new THREE.BoxGeometry(stepDepth * 0.96, 1, flightW);
            registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, 0);
        }
    });

    // Межэтажная разворотная площадка у наружной стены
    const landingGeom = new THREE.BoxGeometry(1.4, 1, Math.abs(zBottom - zTop));
    registerDynamicStairStep(targetGroup, landingGeom, landingX, (zTop + zBottom) / 2, 0.26, 0);
}

function buildCorridorStepsRight(targetGroup) {
    const stepW = 0.28;
    const z1 = -6.1;
    const z2 = -3.6;
    const depthZ = Math.abs(z2 - z1);
    const cz = (z1 + z2) / 2;

    for (let i = 0; i < 3; i++) {
        const sx = 14.3 + i * stepW;
        const heightRatio = 0.055 * (i + 1);
        const geom = new THREE.BoxGeometry(stepW * 0.95, 1, depthZ);
        registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, 0);
    }
}

function addRoofRect(targetGroup, x1, z1, x2, z2, buildingNum = 1) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const thickness = 0.16;

    const geom = new THREE.BoxGeometry(w, thickness, d);
    const mesh = new THREE.Mesh(geom, MATERIALS.roof);
    mesh.position.set(cx, STATE.wallHeight + thickness / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isRoof = true;
    mesh.userData.isExterior = true;
    mesh.userData.isInterior = false;
    mesh.visible = STATE.showRoof;

    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, MATERIALS.edgeRoof);
    line.userData.isRoof = true;
    line.userData.isExterior = true;
    line.userData.isInterior = false;
    mesh.add(line);

    targetGroup.add(mesh);
    roofMeshes.push({ mesh, thickness, building: buildingNum });
}

window.addRoomLabel = addRoomLabel3D;


// ==========================================
// VANILLA THREE.JS BUFFER GEOMETRY MERGER
// ==========================================
function mergeBufferGeometriesVanilla(geometries) {
    if (!geometries || geometries.length === 0) return null;

    let totalPositions = 0;
    let totalNormals = 0;
    let totalUvs = 0;
    let totalIndices = 0;

    const validGeoms = [];
    for (let i = 0; i < geometries.length; i++) {
        let geom = geometries[i];
        if (!geom || !geom.attributes || !geom.attributes.position) continue;
        if (!geom.attributes.normal) {
            geom.computeVertexNormals();
        }
        validGeoms.push(geom);

        totalPositions += geom.attributes.position.array.length;
        if (geom.attributes.normal) totalNormals += geom.attributes.normal.array.length;
        if (geom.attributes.uv) totalUvs += geom.attributes.uv.array.length;
        if (geom.index) totalIndices += geom.index.array.length;
        else totalIndices += geom.attributes.position.count;
    }

    if (validGeoms.length === 0) return null;

    // Общее количество вершин — именно оно определяет диапазон адресов индексов.
    // totalIndices — это количество индексов (элементов массива), но каждый индекс
    // адресует вершину. Если вершин > 65535, Uint16 не сможет их адресовать.
    const totalVertices = totalPositions / 3;

    const mergedPositions = new Float32Array(totalPositions);
    const mergedNormals = totalNormals > 0 ? new Float32Array(totalPositions) : null;
    const mergedUvs = totalUvs > 0 ? new Float32Array(totalVertices * 2) : null;
    const mergedIndices = totalVertices <= 65535 ? new Uint16Array(totalIndices) : new Uint32Array(totalIndices);

    let posOffset = 0;
    let normOffset = 0;
    let uvOffset = 0;
    let indexOffset = 0;
    let vertexBase = 0;

    for (let i = 0; i < validGeoms.length; i++) {
        const geom = validGeoms[i];
        const posArray = geom.attributes.position.array;
        mergedPositions.set(posArray, posOffset);

        if (mergedNormals && geom.attributes.normal) {
            mergedNormals.set(geom.attributes.normal.array, normOffset);
        }

        if (mergedUvs && geom.attributes.uv) {
            mergedUvs.set(geom.attributes.uv.array, uvOffset);
        }

        const count = geom.attributes.position.count;
        if (geom.index) {
            const idxArray = geom.index.array;
            for (let j = 0; j < idxArray.length; j++) {
                mergedIndices[indexOffset + j] = idxArray[j] + vertexBase;
            }
            indexOffset += idxArray.length;
        } else {
            for (let j = 0; j < count; j++) {
                mergedIndices[indexOffset + j] = j + vertexBase;
            }
            indexOffset += count;
        }

        posOffset += posArray.length;
        if (mergedNormals) normOffset += posArray.length;
        if (mergedUvs) uvOffset += count * 2;
        vertexBase += count;
    }

    const mergedGeom = new THREE.BufferGeometry();
    mergedGeom.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    if (mergedNormals) mergedGeom.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    if (mergedUvs) mergedGeom.setAttribute('uv', new THREE.BufferAttribute(mergedUvs, 2));
    mergedGeom.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

    return mergedGeom;
}

window.mergeBufferGeometriesVanilla = mergeBufferGeometriesVanilla;
