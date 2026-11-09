const EAST_ROAD_X2 = 77.0;

let _curbBatch = null;

function isCachedTerritoryGeometry(geom) {
    if (!geom) return false;
    if (typeof _cachedCampusBenchGeoms !== 'undefined' && _cachedCampusBenchGeoms && 
        (geom === _cachedCampusBenchGeoms.woodGeom || geom === _cachedCampusBenchGeoms.metalGeom)) return true;
    if (typeof _cachedParkWasteBinGeoms !== 'undefined' && _cachedParkWasteBinGeoms && 
        (geom === _cachedParkWasteBinGeoms.bodyGeom || geom === _cachedParkWasteBinGeoms.metalGeom)) return true;
    if (typeof _cachedBicycleStationGeom !== 'undefined' && _cachedBicycleStationGeom && 
        geom === _cachedBicycleStationGeom) return true;
    if (typeof _cachedBirchGeoms !== 'undefined' && _cachedBirchGeoms && 
        (geom === _cachedBirchGeoms.wood || geom === _cachedBirchGeoms.lightFoliage || geom === _cachedBirchGeoms.darkFoliage)) return true;
    return false;
}

function disposeSingleTerritoryMaterial(m) {
    if (!m) return;
    const isShared = (typeof MATERIALS !== 'undefined') && Object.values(MATERIALS).includes(m);
    if (isShared) return;
    if (m.map && typeof m.map.dispose === 'function') m.map.dispose();
    if (m.lightMap && typeof m.lightMap.dispose === 'function') m.lightMap.dispose();
    if (typeof m.dispose === 'function') m.dispose();
}

function disposeTerritoryHierarchy(obj) {
    if (!obj) return;
    if (obj.geometry && typeof obj.geometry.dispose === 'function') {
        if (!isCachedTerritoryGeometry(obj.geometry)) {
            obj.geometry.dispose();
        }
    }
    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(disposeSingleTerritoryMaterial);
        } else {
            disposeSingleTerritoryMaterial(obj.material);
        }
    }
    if (obj.children) {
        for (let i = obj.children.length - 1; i >= 0; i--) {
            disposeTerritoryHierarchy(obj.children[i]);
        }
    }
}

function clearAndDisposeGroup(group) {
    if (!group) return;
    while (group.children.length > 0) {
        const child = group.children[0];
        disposeTerritoryHierarchy(child);
        group.remove(child);
    }
}


// ==========================================
// ПРИЛЕГАЮЩАЯ ТЕРРИТОРИЯ КОЛЛЕДЖА (ДОРОГИ, ОСТАНОВКА, ПОДЪЕЗДЫ)
// ==========================================

function buildTerritory() {
    const tGroup = window.territoryGroup || (typeof territoryGroup !== 'undefined' ? territoryGroup : null);
    if (!tGroup) return;

    // Очищаем группу перед повторным построением
    clearAndDisposeGroup(tGroup);

    const t = tGroup;
    _curbBatch = [];

    // 1. БАЗОВАЯ ЗЕМЛЯ (ГАЗОННАЯ ПОДЛОЖКА ПОД ВСЕМ РАЙОНОМ)
    buildGroundBase(t);

    // 2. ГЛАВНАЯ АВТОДОРОГА (4 ПОЛОСЫ ДВИЖЕНИЯ)
    buildMainRoad(t);

    // 3. АВТОБУСНАЯ ОСТАНОВКА (БОЛЬШОЙ ПАРАПЕТ, КАРМАН И БОЛЬШОЙ ПАВИЛЬОН)
    buildBusStop(t);

    // 4. СЕТЬ ПОДЪЕЗДНЫХ ДОРОГ (ВОСТОЧНЫЙ ВЪЕЗД + ВНУТРЕННИЙ ПРОЕЗД ПОД ПЕРЕХОДАМИ)
    buildDrivewaysAndInnerRoads(t);

    // 5. ПЕРИМЕТРАЛЬНОЕ ОГРАЖДЕНИЕ КАМПУСА МГКЦТ
    buildPerimeterFence(t);

    // 6. ОЗЕЛЕНЕНИЕ (ГАЗОН КОРПУСА 2 С ДЕРЕВЬЯМИ, ДЕРЕВЬЯ ВДОЛЬ ДОРОГ)
    // Forecourt plaza & pedestrian paved areas
    buildForecourtAndPlaza(t);

    buildLandscaping(t);

    // 7. СВЕТИЛЬНИКИ, ШЛАГБАУМЫ И ДОРОЖНЫЕ ЗНАКИ
    buildStreetFurniture(t);

    // Сбрасываем собранные бордюрные блоки в InstancedMesh (1 draw call)
    flushCurbBatch(t);
}
window.buildTerritory = buildTerritory;

// ----------------------------------------------------
// 1. БАЗОВАЯ ПОДЛОЖКА
// ----------------------------------------------------
function buildGroundBase(group) {
    const geom = new THREE.BoxGeometry(117.0, 0.12, 145);
    const mesh = new THREE.Mesh(geom, MATERIALS.lawn);
    mesh.position.set(33.5, -0.12, -24);
    mesh.receiveShadow = true;
    mesh.userData.isExterior = true;
    group.add(mesh);
}

// Вспомогательная функция для генерации квад-геометрии полосы дорожной разметки в мировых координатах
function createRoadStripeQuadGeometry(x1, z1, x2, z2, width = 0.15, y = 0.025) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    const nx = -dz / len;
    const nz = dx / len;
    const hw = width / 2;

    const p0x = x1 + nx * hw, p0z = z1 + nz * hw;
    const p1x = x2 + nx * hw, p1z = z2 + nz * hw;
    const p2x = x2 - nx * hw, p2z = z2 - nz * hw;
    const p3x = x1 - nx * hw, p3z = z1 - nz * hw;

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([
        p0x, y, p0z,
        p1x, y, p1z,
        p2x, y, p2z,
        p3x, y, p3z
    ]);
    const normals = new Float32Array([
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0
    ]);
    const uvs = new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 1
    ]);
    const indices = new Uint16Array([
        0, 1, 2,
        0, 2, 3
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    return geom;
}

// ----------------------------------------------------
// 2. ГЛАВНАЯ АВТОДОРОГА (4 ПОЛОСЫ: 2 В КАЖДУЮ СТОРОНУ)
// ----------------------------------------------------
