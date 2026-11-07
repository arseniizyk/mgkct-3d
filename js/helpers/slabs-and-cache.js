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

// Пространственный индекс 3D-боксов стен и дверей по этажам (1..7) для быстрого отсечения бейджей в 3D
const OCCLUDER_WALLS_BY_FLOOR = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
window.OCCLUDER_WALLS_BY_FLOOR = OCCLUDER_WALLS_BY_FLOOR;
