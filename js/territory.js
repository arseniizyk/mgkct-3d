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

function disposeTerritoryHierarchy(obj) {
    if (!obj) return;
    if (obj.geometry && typeof obj.geometry.dispose === 'function') {
        if (!isCachedTerritoryGeometry(obj.geometry)) {
            obj.geometry.dispose();
        }
    }
    if (obj.material) {
        const isShared = (typeof MATERIALS !== 'undefined') && Object.values(MATERIALS).includes(obj.material);
        if (!isShared) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m && typeof m.dispose === 'function' && m.dispose());
            } else if (typeof obj.material.dispose === 'function') {
                obj.material.dispose();
            }
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
function buildMainRoad(group) {
    const xStart = -25.0;
    const xEnd = 92;
    const roadLen = xEnd - xStart;

    // 4 полосы движения по 3.5 м = 14.0 м + краевые зоны = 14.6 м
    const roadWidth = 14.6;
    const zCenter = 35.5;
    const zNorth = zCenter - roadWidth / 2; // 28.2
    const zSouth = zCenter + roadWidth / 2; // 42.8

    // Асфальтовое полотно главной дороги
    const roadGeom = new THREE.BoxGeometry(roadLen, 0.14, roadWidth);
    const roadMesh = new THREE.Mesh(roadGeom, MATERIALS.asphaltRoad);
    roadMesh.position.set((xStart + xEnd) / 2, -0.05, zCenter);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Южный бордюр и широкий южный тротуар
    addCurbSegment(group, xStart, zSouth, xEnd, zSouth);
    const southWalkGeom = new THREE.BoxGeometry(roadLen, 0.16, 12.0);
    const southWalkMesh = new THREE.Mesh(southWalkGeom, MATERIALS.sidewalk);
    southWalkMesh.position.set((xStart + xEnd) / 2, -0.02, zSouth + 6.0);
    southWalkMesh.receiveShadow = true;
    group.add(southWalkMesh);

    // Местоположение пешеходного перехода «Зебра» (X: 54.0..58.0)
    const zX1 = 54.0;
    const zX2 = 58.0;

    // Габариты центрального разделительного островка безопасности со спутника:
    const islandHalfW = 0.90; // общая ширина островка 1.8 м
    const zIslandNorth = zCenter - islandHalfW; // 34.6
    const zIslandSouth = zCenter + islandHalfW; // 36.4

    // Островок безопасности посередине проезжей части в створе перехода
    const islandPlatGeom = new THREE.BoxGeometry(zX2 - zX1, 0.16, islandHalfW * 2);
    const islandPlatMesh = new THREE.Mesh(islandPlatGeom, MATERIALS.sidewalk);
    islandPlatMesh.position.set((zX1 + zX2) / 2, -0.02, zCenter);
    islandPlatMesh.receiveShadow = true;
    group.add(islandPlatMesh);

    // Бордюры островка безопасности с востока и запада
    addCurbSegment(group, zX1, zIslandNorth, zX1, zIslandSouth);
    addCurbSegment(group, zX2, zIslandNorth, zX2, zIslandSouth);

    // Тактильная плитка на островке безопасности
    addTactileWarningStrip(group, zX1, zX2, zIslandNorth + 0.05, zIslandNorth + 0.45);
    addTactileWarningStrip(group, zX1, zX2, zIslandSouth - 0.45, zIslandSouth - 0.05);

    // Тактильная предупреждающая плитка у тротуаров
    addTactileWarningStrip(group, zX1 - 0.2, zX2 + 0.2, zNorth - 0.65, zNorth - 0.15);
    addTactileWarningStrip(group, zX1 - 0.2, zX2 + 0.2, zSouth + 0.15, zSouth + 0.65);

    // --- ДОРОЖНАЯ РАЗМЕТКА 4-ПОЛОСНОЙ ДОРОГИ С ОСТРОВКАМИ БЕЗОПАСНОСТИ СО СПУТНИКА ---
    const whiteMarkingGeoms = [];
    function collectStripe(x1, z1, x2, z2, width = 0.15) {
        const g = createRoadStripeQuadGeometry(x1, z1, x2, z2, width, 0.025);
        if (g) whiteMarkingGeoms.push(g);
    }
    function collectDashes(xStart, xEnd, z, dashLen = 3.0, gapLen = 3.0, width = 0.15) {
        let curX = Math.min(xStart, xEnd);
        const maxVal = Math.max(xStart, xEnd);
        while (curX < maxVal) {
            const nextX = Math.min(curX + dashLen, maxVal);
            collectStripe(curX, z, nextX, z, width);
            curX += dashLen + gapLen;
        }
    }

    // 1) Осевая двойная сплошная линия (разметка 1.3)
    // До западного островка: от xStart до X = 41.0
    collectStripe(xStart, zCenter - 0.10, 41.0, zCenter - 0.10, 0.12);
    collectStripe(xStart, zCenter + 0.10, 41.0, zCenter + 0.10, 0.12);
    // После восточного островка: от X = 71.0 до xEnd
    collectStripe(71.0, zCenter - 0.10, xEnd, zCenter - 0.10, 0.12);
    collectStripe(71.0, zCenter + 0.10, xEnd, zCenter + 0.10, 0.12);

    // 2) Западный направляющий островок с шевронами (разметка 1.16.1): X: 41.0..53.6
    // Боковые контуры островка (разметка 1.1, ширина 0.15м)
    collectStripe(41.0, zCenter - 0.10, 52.0, zIslandNorth, 0.15);
    collectStripe(52.0, zIslandNorth, zX1 - 0.4, zIslandNorth, 0.15);
    collectStripe(41.0, zCenter + 0.10, 52.0, zIslandSouth, 0.15);
    collectStripe(52.0, zIslandSouth, zX1 - 0.4, zIslandSouth, 0.15);
    // Торцевая линия перед переходом
    collectStripe(zX1 - 0.4, zIslandNorth, zX1 - 0.4, zIslandSouth, 0.20);

    // Шевронная штриховка внутри западного островка (под 45 градусов)
    const chevronStep = 1.35;
    for (let cx = 42.5; cx <= 52.0; cx += chevronStep) {
        const tRatio = (cx - 41.0) / (52.0 - 41.0);
        const curHalfW = 0.10 + tRatio * (islandHalfW - 0.10);
        const x1 = cx - curHalfW * 0.7;
        const z1 = zCenter - curHalfW + 0.08;
        const x2 = cx + curHalfW * 0.7;
        const z2 = zCenter + curHalfW - 0.08;
        collectStripe(x1, z1, x2, z2, 0.25);
    }

    // 3) Восточный направляющий островок с шевронами (разметка 1.16.1): X: 58.4..71.0
    // Торцевая линия за переходом
    collectStripe(zX2 + 0.4, zIslandNorth, zX2 + 0.4, zIslandSouth, 0.20);
    // Боковые контуры островка
    collectStripe(zX2 + 0.4, zIslandNorth, 60.0, zIslandNorth, 0.15);
    collectStripe(60.0, zIslandNorth, 71.0, zCenter - 0.10, 0.15);
    collectStripe(zX2 + 0.4, zIslandSouth, 60.0, zIslandSouth, 0.15);
    collectStripe(60.0, zIslandSouth, 71.0, zCenter + 0.10, 0.15);

    // Шевронная штриховка внутри восточного островка
    for (let cx = 60.0; cx <= 69.5; cx += chevronStep) {
        const tRatio = 1.0 - (cx - 60.0) / (71.0 - 60.0);
        const curHalfW = 0.10 + tRatio * (islandHalfW - 0.10);
        const x1 = cx - curHalfW * 0.7;
        const z1 = zCenter - curHalfW + 0.08;
        const x2 = cx + curHalfW * 0.7;
        const z2 = zCenter + curHalfW - 0.08;
        collectStripe(x1, z1, x2, z2, 0.25);
    }

    // 4) Две секции «Зебры» 1.14.1 через островок безопасности
    const stripeThickZ = 0.50;
    const stripeGapZ = 0.50;
    const stepZ = stripeThickZ + stripeGapZ;

    // Северная секция: от zNorth + 0.35 до zIslandNorth - 0.15
    let curZ = zNorth + 0.35 + stripeThickZ / 2;
    while (curZ <= zIslandNorth - 0.15 - stripeThickZ / 2) {
        collectStripe(zX1, curZ, zX2, curZ, stripeThickZ);
        curZ += stepZ;
    }

    // Южная секция: от zIslandSouth + 0.25 до zSouth - 0.25
    curZ = zIslandSouth + 0.25 + stripeThickZ / 2;
    while (curZ <= zSouth - 0.25 - stripeThickZ / 2) {
        collectStripe(zX1, curZ, zX2, curZ, stripeThickZ);
        curZ += stepZ;
    }

    // 5) Прерывистые полосы между 1-й и 2-й полосами (разметка 1.5)
    collectDashes(xStart, 50.0, 31.85, 3.0, 3.0, 0.15);
    collectDashes(62.0, xEnd, 31.85, 3.0, 3.0, 0.15);
    collectDashes(xStart, 50.0, 39.15, 3.0, 3.0, 0.15);
    collectDashes(62.0, xEnd, 39.15, 3.0, 3.0, 0.15);

    // 6) Краевые сплошные линии (разметка 1.1)
    collectStripe(xStart, zSouth - 0.45, zX1, zSouth - 0.45, 0.15);
    collectStripe(zX2, zSouth - 0.45, xEnd, zSouth - 0.45, 0.15);
    collectStripe(xStart, zNorth + 0.45, -10.0, zNorth + 0.45, 0.15);
    collectStripe(40.5, zNorth + 0.45, zX1, zNorth + 0.45, 0.15);
    collectStripe(zX2, zNorth + 0.45, 71.0, zNorth + 0.45, 0.15);
    collectStripe(79.0, zNorth + 0.45, xEnd, zNorth + 0.45, 0.15);

    // 7) Поперечные стоп-линии (разметка 1.12)
    // Южное направление (движение на восток): перед переходом
    collectStripe(52.0, zIslandSouth + 0.1, 52.0, zSouth - 0.4, 0.40);
    // Северное направление (движение на запад): перед переходом
    collectStripe(60.0, zNorth + 0.4, 60.0, zIslandNorth - 0.1, 0.40);

    // Сливаем всю белую разметку дороги в 1 Mesh (1 draw call)
    if (whiteMarkingGeoms.length > 0) {
        const mergedWhiteMarkings = mergeBufferGeometriesVanilla(whiteMarkingGeoms);
        const roadMarkingMesh = new THREE.Mesh(mergedWhiteMarkings, MATERIALS.roadMarkingWhite);
        roadMarkingMesh.receiveShadow = true;
        group.add(roadMarkingMesh);
    }

    // Знаки «Пешеходный переход» 5.19.1 и 5.19.2 + светофоры
    addPedestrianCrossingSign(group, zX1 - 0.5, zNorth - 0.5, Math.PI / 2);
    addPedestrianTrafficLight(group, zX2 + 0.8, zNorth - 0.6, Math.PI / 2, 0, -Math.PI / 2);
    // Дублирующие светофоры на островке безопасности (БЕЗ вызывных кнопок)
    addPedestrianTrafficLight(group, zX1 - 0.2, zCenter, Math.PI / 2, 0, -Math.PI / 2, false);
    addPedestrianTrafficLight(group, zX2 + 0.2, zCenter, -Math.PI / 2, Math.PI, Math.PI / 2, false);
    // Южный тротуар
    addPedestrianTrafficLight(group, zX1 - 0.8, zSouth + 0.7, -Math.PI / 2, Math.PI, Math.PI / 2);
    addPedestrianCrossingSign(group, zX2 + 0.5, zSouth + 0.6, -Math.PI / 2);
}

function addCurbCornerPiece(group, x, z, angleIn, angleOut) {
    const r = 0.09;
    const geom = new THREE.CylinderGeometry(r, r, 0.18, 16);
    geom.translate(0, 0.01, 0);
    const mesh = new THREE.Mesh(geom, MATERIALS.curb);
    mesh.position.set(x, 0.02, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
}

function buildBusStop(group) {
    const zRoadNorth = 28.2;
    const pocketDepth = 2.8;
    const zPocketEdge = zRoadNorth - pocketDepth; // 25.4

    // Длина кармана (заезд, от X: -6.0 до 38.0, длина 44 м)
    const xBayStart = -6.0;
    const xBayEnd = 38.0;
    const bayLen = xBayEnd - xBayStart;

    // Карман (асфальт проезжей части)
    const bayGeom = new THREE.BoxGeometry(bayLen, 0.14, pocketDepth);
    const bayMesh = new THREE.Mesh(bayGeom, MATERIALS.asphaltRoad);
    bayMesh.position.set((xBayStart + xBayEnd) / 2, -0.05, (zRoadNorth + zPocketEdge) / 2);
    bayMesh.receiveShadow = true;
    group.add(bayMesh);

    // Дорожные скосы кармана (tapers) в асфальте дороги:
    addAsphaltTriangle(group, [
        [-10.0, zRoadNorth],
        [xBayStart, zPocketEdge],
        [xBayStart, zRoadNorth]
    ], MATERIALS.asphaltRoad);

    // Бордюры скосов и кармана
    addCurbSegment(group, -25.0, zRoadNorth, -10.0, zRoadNorth);
    addCurbSegment(group, -10.0, zRoadNorth, xBayStart, zPocketEdge);
    addCurbCornerPiece(group, xBayStart, zPocketEdge, Math.atan2(zPocketEdge - zRoadNorth, xBayStart - (-10.0)), 0);

    addAsphaltTriangle(group, [
        [xBayEnd, zPocketEdge],
        [40.5, zRoadNorth],
        [xBayEnd, zRoadNorth]
    ], MATERIALS.asphaltRoad);
    addCurbSegment(group, xBayEnd, zPocketEdge, 40.5, zRoadNorth);
    addCurbCornerPiece(group, xBayEnd, zPocketEdge, Math.atan2(zRoadNorth - zPocketEdge, 40.5 - xBayEnd), 0);

    // Желтая зигзаг-разметка 1.17 (СТБ 1300-2014) внутри кармана
    addBusStopYellowZigzag(group, xBayStart + 1.0, xBayEnd - 1.0, zRoadNorth - 0.4, zPocketEdge + 0.4);

    // Тактильная предупреждающая полоса (СТБ П 2443)
    addTactileWarningStrip(group, xBayStart, xBayEnd, zPocketEdge - 0.45, zPocketEdge - 0.10);

    // Бордюр кармана
    addCurbSegment(group, xBayStart, zPocketEdge, xBayEnd, zPocketEdge);

    // Павильон остановки
    buildLargeShelter(group, 12.0, zPocketEdge - 2.0);

    // Дорожные знаки (5.16) — сдвинуты глубже на тротуар за пределы желтой тактильной полосы
    addBusStopSign(group, 32.0, zPocketEdge - 0.85);
    addBusStopSign(group, 2.0, zPocketEdge - 0.85);
}

function buildLargeShelter(group, cx, cz) {
    // Большой современный архитектурный павильон ожидания с консольным изогнутым стеклянным навесом
    // Габариты: ширина 7.80 м, глубина 2.20 м, высота 2.70 м
    const w = 7.80;
    const d = 2.20;
    const h = 2.70;

    const shelterGroup = new THREE.Group();
    shelterGroup.position.set(cx, 0.06, cz); // 0.06 м — уровень посадочной платформы

    const frameMat = MATERIALS.shelterFrameStainless || MATERIALS.shelterFrame;
    const glassMat = MATERIALS.shelterGlass;
    const roofGlassMat = MATERIALS.shelterRoofGlass || MATERIALS.shelterRoof;
    const steelMat = MATERIALS.stainlessSteel || MATERIALS.poleMetal;
    const benchWoodMat = MATERIALS.shelterBenchWood || MATERIALS.shelterBench;
    const benchLegMat = MATERIALS.shelterBenchLegs || frameMat;

    // ----------------------------------------------------
    // 1. ОПОРНЫЕ СТАЛЬНЫЕ КОЛОННЫ (AISI 304 С ФЛАНЦАМИ И АНКЕРАМИ)
    // ----------------------------------------------------
    const postR = 0.050; // 100 мм круглые трубы
    const postGeom = new THREE.CylinderGeometry(postR, postR, h, 24);
    const basePlateGeom = new THREE.BoxGeometry(0.22, 0.025, 0.22);
    const collarGeom = new THREE.CylinderGeometry(0.075, 0.075, 0.04, 24);
    const boltGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.025, 6);

    const postConfigs = [
        { x: -w / 2 + 0.15, z: -d / 2 + 0.15, isRear: true },
        { x: -1.30, z: -d / 2 + 0.15, isRear: true },
        { x: 1.30, z: -d / 2 + 0.15, isRear: true },
        { x: w / 2 - 0.15, z: -d / 2 + 0.15, isRear: true },
        { x: -w / 2 + 0.15, z: d / 2 - 0.15, isRear: false },
        { x: w / 2 - 0.15, z: d / 2 - 0.15, isRear: false }
    ];

    postConfigs.forEach(cfg => {
        // Вертикальная стойка
        const post = new THREE.Mesh(postGeom, frameMat);
        post.position.set(cfg.x, h / 2, cfg.z);
        post.castShadow = true;
        shelterGroup.add(post);

        // Опорный фланец
        const bPlate = new THREE.Mesh(basePlateGeom, frameMat);
        bPlate.position.set(cfg.x, 0.0125, cfg.z);
        bPlate.receiveShadow = true;
        shelterGroup.add(bPlate);

        // Декоративное круглое кольцо-манжета основания
        const collar = new THREE.Mesh(collarGeom, frameMat);
        collar.position.set(cfg.x, 0.02, cfg.z);
        shelterGroup.add(collar);

        // 4 анкерных болта по углам
        const boltOffsets = [-0.08, 0.08];
        boltOffsets.forEach(bx => {
            boltOffsets.forEach(bz => {
                const bolt = new THREE.Mesh(boltGeom, steelMat);
                bolt.position.set(cfg.x + bx, 0.025, cfg.z + bz);
                shelterGroup.add(bolt);
            });
        });
    });

    // ----------------------------------------------------
    // 2. КОНСОЛЬНЫЕ ФЕРМЫ И ПРОДОЛЬНЫЕ БАЛКИ ПЕРЕКРЫТИЯ
    // ----------------------------------------------------
    // Продольные балки между стойками
    const rearBeamGeom = new THREE.BoxGeometry(w, 0.08, 0.08);
    const rearBeam = new THREE.Mesh(rearBeamGeom, frameMat);
    rearBeam.position.set(0, h - 0.04, -d / 2 + 0.15);
    rearBeam.castShadow = true;
    shelterGroup.add(rearBeam);

    // 4 консольные переменного сечения фермы-кронштейны крыши
    const crossXs = [-w / 2 + 0.15, -1.30, 1.30, w / 2 - 0.15];
    crossXs.forEach(cxPos => {
        const rafterShape = new THREE.Shape();
        // Трапециевидная консоль переменного сечения (у стойки 180 мм, на краю 60 мм)
        rafterShape.moveTo(-1.20, 0.00);
        rafterShape.lineTo(1.35, -0.06);
        rafterShape.lineTo(1.35, 0.00);
        rafterShape.lineTo(-1.20, 0.14);
        rafterShape.closePath();

        const rafterGeom = new THREE.ExtrudeGeometry(rafterShape, {
            depth: 0.05,
            bevelEnabled: true,
            bevelThickness: 0.004,
            bevelSize: 0.004,
            bevelSegments: 2
        });
        rafterGeom.translate(0, 0, -0.025);

        const rafter = new THREE.Mesh(rafterGeom, frameMat);
        rafter.rotation.y = Math.PI / 2;
        rafter.position.set(cxPos, h + 0.02, 0.05);
        rafter.castShadow = true;
        shelterGroup.add(rafter);
    });

    // Передний и средний трубчатые прогоны под стекло
    const purlinGeom = new THREE.CylinderGeometry(0.025, 0.025, w + 0.4, 18);
    const frontPurlin = new THREE.Mesh(purlinGeom, frameMat);
    frontPurlin.rotation.z = Math.PI / 2;
    frontPurlin.position.set(0, h + 0.04, d / 2 + 0.25);
    shelterGroup.add(frontPurlin);

    // ----------------------------------------------------
    // 3. ИЗОГНУТАЯ КОНСОЛЬНАЯ СТЕКЛЯННАЯ КРЫША С ШЕЛКОГРАФИЕЙ (FRIT)
    // ----------------------------------------------------
    const roofW = w + 0.60; // 8.40 м
    const zStart = -1.20;
    const zEnd = 1.40;
    const numPts = 24;
    const glassThick = 0.012;

    const roofShape = new THREE.Shape();
    const pts = [];
    for (let i = 0; i <= numPts; i++) {
        const t = i / numPts;
        const z = zStart + t * (zEnd - zStart);
        // Параболическая плавная дуга: наивысшая точка над колоннами, плавный наклон вперед и назад
        const y = 2.86 - 0.075 * Math.pow((z + 0.15) / 1.30, 2);
        pts.push({ z, y });
    }
    roofShape.moveTo(pts[0].z, pts[0].y);
    for (let i = 1; i <= numPts; i++) roofShape.lineTo(pts[i].z, pts[i].y);
    for (let i = numPts; i >= 0; i--) roofShape.lineTo(pts[i].z, pts[i].y - glassThick);
    roofShape.closePath();

    const roofGeom = new THREE.ExtrudeGeometry(roofShape, {
        depth: roofW,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 2
    });
    roofGeom.translate(0, 0, -roofW / 2);

    const roofMesh = new THREE.Mesh(roofGeom, roofGlassMat);
    roofMesh.rotation.y = Math.PI / 2;
    roofMesh.position.set(0, 0, 0);
    roofMesh.castShadow = true;
    shelterGroup.add(roofMesh);

    // Водосточный лоток по задней кромке и вертикальная труба
    const gutterGeom = new THREE.CylinderGeometry(0.04, 0.04, roofW, 16, 1, false, 0, Math.PI);
    const gutterMesh = new THREE.Mesh(gutterGeom, frameMat);
    gutterMesh.rotation.z = Math.PI / 2;
    gutterMesh.rotation.x = Math.PI;
    gutterMesh.position.set(0, 2.74, zStart);
    shelterGroup.add(gutterMesh);

    const downspoutGeom = new THREE.CylinderGeometry(0.022, 0.022, h, 16);
    const downspoutMesh = new THREE.Mesh(downspoutGeom, frameMat);
    downspoutMesh.position.set(-w / 2 + 0.10, h / 2, -d / 2 + 0.15);
    shelterGroup.add(downspoutMesh);

    // ----------------------------------------------------
    // 4. ПАНОРАМНОЕ ОСТЕКЛЕНИЕ И АРХИТЕКТУРНЫЕ СПАЙДЕРНЫЕ УЗЛЫ
    // ----------------------------------------------------
    const glassH = h - 0.35; // 2.35 м
    const wallGlassThick = 0.012;

    function addSpiderFitting(parent, sx, sy, sz, is2Arm = false) {
        const fittingGroup = new THREE.Group();
        fittingGroup.position.set(sx, sy, sz);

        // Хомут на стойку
        const clampGeom = new THREE.CylinderGeometry(0.058, 0.058, 0.045, 20);
        const clamp = new THREE.Mesh(clampGeom, steelMat);
        fittingGroup.add(clamp);

        // Выносной шток-бобышка
        const stemGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.06, 14);
        const stem = new THREE.Mesh(stemGeom, steelMat);
        stem.rotation.x = Math.PI / 2;
        stem.position.set(0, 0, 0.04);
        fittingGroup.add(stem);

        // Центральный диск спайдера
        const hubGeom = new THREE.CylinderGeometry(0.032, 0.032, 0.016, 16);
        const hub = new THREE.Mesh(hubGeom, steelMat);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(0, 0, 0.07);
        fittingGroup.add(hub);

        // Лучи спайдера
        const angles = is2Arm ? [Math.PI / 4, 7 * Math.PI / 4] : [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
        const armLen = 0.09;
        const armGeom = new THREE.CylinderGeometry(0.007, 0.011, armLen, 8);
        const rotuleGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16);
        const boltHoleGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.014, 6);

        angles.forEach(ang => {
            const dx = Math.cos(ang) * armLen * 0.75;
            const dy = Math.sin(ang) * armLen * 0.75;

            const arm = new THREE.Mesh(armGeom, steelMat);
            arm.position.set(dx / 2, dy / 2, 0.07);
            arm.rotation.z = ang - Math.PI / 2;
            fittingGroup.add(arm);

            // Ротула крепления к стеклу с шестигранным шлицем
            const rotule = new THREE.Mesh(rotuleGeom, steelMat);
            rotule.rotation.x = Math.PI / 2;
            rotule.position.set(dx, dy, 0.076);
            fittingGroup.add(rotule);

            const bHole = new THREE.Mesh(boltHoleGeom, frameMat);
            bHole.rotation.x = Math.PI / 2;
            bHole.position.set(dx, dy, 0.082);
            fittingGroup.add(bHole);
        });

        parent.add(fittingGroup);
    }

    // Заднее панорамное остекление (3 панели)
    const rearBayW = (w - 0.40) / 3;
    const rearGlassGeom = new THREE.BoxGeometry(rearBayW - 0.02, glassH, wallGlassThick);
    const rearGlassXs = [-rearBayW, 0, rearBayW];

    rearGlassXs.forEach(gx => {
        const rGlass = new THREE.Mesh(rearGlassGeom, glassMat);
        rGlass.position.set(gx, glassH / 2 + 0.12, -d / 2 + 0.15);
        shelterGroup.add(rGlass);
    });

    // 4-точечные спайдеры на центральных задних колоннах
    addSpiderFitting(shelterGroup, -1.30, 0.75, -d / 2 + 0.15);
    addSpiderFitting(shelterGroup, -1.30, 1.85, -d / 2 + 0.15);
    addSpiderFitting(shelterGroup, 1.30, 0.75, -d / 2 + 0.15);
    addSpiderFitting(shelterGroup, 1.30, 1.85, -d / 2 + 0.15);

    // Боковые ветрозащитные стекла
    const sideGlassW = d - 0.30;
    const sideGlassGeom = new THREE.BoxGeometry(wallGlassThick, glassH, sideGlassW);

    const sideLeft = new THREE.Mesh(sideGlassGeom, glassMat);
    sideLeft.position.set(-w / 2 + 0.15, glassH / 2 + 0.12, 0);
    shelterGroup.add(sideLeft);

    const sideRight = new THREE.Mesh(sideGlassGeom, glassMat);
    sideRight.position.set(w / 2 - 0.15, glassH / 2 + 0.12, 0);
    shelterGroup.add(sideRight);

    // Боковые стекла без выступающих круглых спайдеров

    // ----------------------------------------------------
    // 5. ИНФОРМАЦИОННЫЕ ТАБЛИЧКИ РАСПИСАНИЙ МИНСКТРАНС (3 СТЕНДА)
    // ----------------------------------------------------
    // Стенд 1 (X = -0.80): Троллейбусы 19, 19п (горизонтальная эмалированная табличка 1.6:1)
    // Стенд 2 (X =  0.00): Троллейбусы 27, 27п, 82, 82п
    // Стенд 3 (X = +0.80): Автобусы 40, 107 (строго между колоннами X=±1.30 без пересечений)
    const boardW = 0.76;
    const boardH = 0.475;
    const boardD = 0.015;
    const boardZ = -d / 2 + 0.17;
    const boardY = 1.45;

    const boardBackGeom = new THREE.BoxGeometry(boardW, boardH, boardD);
    const boardFaceGeom = new THREE.PlaneGeometry(boardW - 0.02, boardH - 0.02);
    const coverGlassGeom = new THREE.PlaneGeometry(boardW - 0.015, boardH - 0.015);

    const boardsConfig = [
        { x: -0.80, mat: MATERIALS.trolleybusTimetable1 || MATERIALS.busTimetable },
        { x:  0.00, mat: MATERIALS.trolleybusTimetable2 || MATERIALS.busTimetable },
        { x:  0.80, mat: MATERIALS.busTimetable }
    ];

    let vitrineBox = null;
    let vitrineFace = null;
    let coverGlass = null;

    boardsConfig.forEach(cfg => {
        const box = new THREE.Mesh(boardBackGeom, frameMat);
        box.position.set(cfg.x, boardY, boardZ);
        box.castShadow = true;
        shelterGroup.add(box);
        if (cfg.x === 0.00) vitrineBox = box;

        const face = new THREE.Mesh(boardFaceGeom, cfg.mat);
        face.position.set(cfg.x, boardY, boardZ + boardD / 2 + 0.001);
        shelterGroup.add(face);
        if (cfg.x === 0.00) vitrineFace = face;

        const cover = new THREE.Mesh(coverGlassGeom, glassMat);
        cover.position.set(cfg.x, boardY, boardZ + boardD / 2 + 0.003);
        shelterGroup.add(cover);
        if (cfg.x === 0.00) coverGlass = cover;
    });

    // ----------------------------------------------------
    // 6. ЭРГОНОМИЧНЫЕ СКАМЬИ С ДЕРЕВЯННЫМИ ЛАМЕЛЯМИ И ПОДЛОКОТНИКАМИ
    // ----------------------------------------------------
    function buildErgonomicBench(parent, benchX, benchLen = 2.80) {
        const benchGroup = new THREE.Group();
        benchGroup.position.set(benchX, 0, -d / 2 + 0.52);

        const seatH = 0.46;
        const seatDepth = 0.46;
        const slatThickness = 0.032;
        const slatWidth = 0.068;
        const numSlats = 5;

        // 5 продольных ламелей сиденья
        const slatGeom = new THREE.BoxGeometry(benchLen, slatThickness, slatWidth);
        for (let s = 0; s < numSlats; s++) {
            const slat = new THREE.Mesh(slatGeom, benchWoodMat);
            const sz = (s - (numSlats - 1) / 2) * (slatWidth + 0.012);
            slat.position.set(0, seatH, sz);
            slat.castShadow = true;
            benchGroup.add(slat);
        }

        // 2 наклонные ламели спинки
        const backSlatGeom = new THREE.BoxGeometry(benchLen, slatWidth, slatThickness);
        for (let b = 0; b < 2; b++) {
            const backSlat = new THREE.Mesh(backSlatGeom, benchWoodMat);
            const by = seatH + 0.20 + b * (slatWidth + 0.018);
            const bz = -seatDepth / 2 - 0.03 - b * 0.035;
            backSlat.position.set(0, by, bz);
            backSlat.rotation.x = -0.24; // 14 градусов эргономичный наклон
            backSlat.castShadow = true;
            benchGroup.add(backSlat);
        }

        // 3 изогнутые стальные опоры с подлокотниками
        const legXs = [-benchLen / 2 + 0.20, 0, benchLen / 2 - 0.20];
        legXs.forEach((lx, idx) => {
            // Опорная пятка
            const footGeom = new THREE.BoxGeometry(0.16, 0.016, 0.16);
            const footMesh = new THREE.Mesh(footGeom, benchLegMat);
            footMesh.position.set(lx, 0.008, 0);
            footMesh.receiveShadow = true;
            benchGroup.add(footMesh);

            // Вертикальная стойка
            const legGeom = new THREE.BoxGeometry(0.05, seatH, 0.05);
            const legMesh = new THREE.Mesh(legGeom, benchLegMat);
            legMesh.position.set(lx, seatH / 2, 0);
            legMesh.castShadow = true;
            benchGroup.add(legMesh);

            // Консоль сиденья
            const barGeom = new THREE.BoxGeometry(0.045, 0.035, seatDepth);
            const barMesh = new THREE.Mesh(barGeom, benchLegMat);
            barMesh.position.set(lx, seatH - slatThickness / 2 - 0.018, 0);
            benchGroup.add(barMesh);

            // Стойка спинки
            const backPostGeom = new THREE.BoxGeometry(0.045, 0.36, 0.035);
            const backPost = new THREE.Mesh(backPostGeom, benchLegMat);
            backPost.position.set(lx, seatH + 0.20, -seatDepth / 2 - 0.04);
            backPost.rotation.x = -0.24;
            benchGroup.add(backPost);

            // Арочный подлокотник на крайних опорах
            if (idx === 0 || idx === 2) {
                const armGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.28, 14);
                const armMesh = new THREE.Mesh(armGeom, steelMat);
                armMesh.rotation.x = Math.PI / 2;
                armMesh.position.set(lx, seatH + 0.18, 0.02);
                benchGroup.add(armMesh);
            }
        });

        parent.add(benchGroup);
    }



    // ----------------------------------------------------
    // 7. СОВРЕМЕННЫЕ УРНЫ ИЗ ШЛИФОВАННОЙ НЕРЖАВЕЮЩЕЙ СТАЛИ
    // ----------------------------------------------------
    function buildModernWasteBin(parent, bx, bz) {
        const binGroup = new THREE.Group();
        binGroup.position.set(bx, 0, bz);

        const binH = 0.78;
        const binR = 0.19;

        // Корпус из шлифованной стали
        const bodyGeom = new THREE.CylinderGeometry(binR, binR, binH, 24);
        const bodyMesh = new THREE.Mesh(bodyGeom, steelMat);
        bodyMesh.position.y = binH / 2 + 0.04;
        bodyMesh.castShadow = true;
        binGroup.add(bodyMesh);

        // Цоколь
        const plinthGeom = new THREE.CylinderGeometry(binR * 0.85, binR * 0.85, 0.04, 20);
        const plinthMesh = new THREE.Mesh(plinthGeom, frameMat);
        plinthMesh.position.y = 0.02;
        binGroup.add(plinthMesh);

        // Куполообразная крышка от дождя
        const domeGeom = new THREE.CylinderGeometry(binR + 0.01, binR + 0.02, 0.06, 24);
        const domeMesh = new THREE.Mesh(domeGeom, steelMat);
        domeMesh.position.y = binH + 0.07;
        binGroup.add(domeMesh);

        // Окно для сброса мусора с отбортовкой
        const slotGeom = new THREE.BoxGeometry(0.22, 0.12, 0.06);
        const slotMesh = new THREE.Mesh(slotGeom, frameMat);
        slotMesh.position.set(0, binH - 0.08, binR - 0.02);
        binGroup.add(slotMesh);

        // Внутренний видимый оцинкованный вкладыш
        const linerLipGeom = new THREE.CylinderGeometry(binR - 0.015, binR - 0.015, 0.02, 20);
        const linerLip = new THREE.Mesh(linerLipGeom, steelMat);
        linerLip.position.y = binH + 0.035;
        binGroup.add(linerLip);

        // Пепельница-гаситель окурков
        const ashtrayGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 16);
        const ashtray = new THREE.Mesh(ashtrayGeom, steelMat);
        ashtray.position.set(0, binH + 0.105, 0);
        binGroup.add(ashtray);

        parent.add(binGroup);
    }

    buildModernWasteBin(shelterGroup, -w / 2 - 0.45, d / 2 - 0.30);
    buildModernWasteBin(shelterGroup, w / 2 + 0.45, d / 2 - 0.30);

    group.add(shelterGroup);
}

// ----------------------------------------------------
// 4. СЕТЬ ПОДЪЕЗДНЫХ ДОРОГ (ТОЧНО ПОДОГНАНА ПОД КООРДИНАТЫ СХЕМЫ КОЛЬЦЕВОЙ ДОРОГИ)
// ----------------------------------------------------
function buildDrivewaysAndInnerRoads(group) {
    const roadX1 = 72.0;
    const roadX2 = EAST_ROAD_X2;
    const roadW = roadX2 - roadX1; // 5.0 м
    const roadMidX = (roadX1 + roadX2) / 2; // 74.5
    const drivewayGeoms = [];

    // 1) ВЪЕЗД С ГЛАВНОЙ ДОРОГИ (Z: 24.5..28.2) С АСФАЛЬТОВЫМИ РАСШИРЕНИЯМИ И БОРДЮРАМИ
    const entryZStart = 24.5;
    const entryZEnd = 28.2;
    const entryLen = entryZEnd - entryZStart;
    const entryGeom = new THREE.BoxGeometry(roadW, 0.14, entryLen);
    entryGeom.translate(roadMidX, -0.05, (entryZStart + entryZEnd) / 2);
    drivewayGeoms.push(entryGeom);

    const t1 = createAsphaltTriangleGeometry([
        [70.0, 28.2],
        [roadX1, 24.5],
        [roadX1, 28.2]
    ], 0.02, 0.14);
    if (t1) drivewayGeoms.push(t1);
    addCurbSegment(group, 70.0, 28.2, roadX1, 24.5);

    const t2 = createAsphaltTriangleGeometry([
        [roadX2, 24.5],
        [79.0, 28.2],
        [roadX2, 28.2]
    ], 0.02, 0.14);
    if (t2) drivewayGeoms.push(t2);
    addCurbSegment(group, roadX2, 24.5, 79.0, 28.2);

    // 2) ВОСТОЧНЫЙ ПРОЕЗД (Вдоль Корпуса 2 и Корпуса 4)
    const northRoadZ1 = -71.5;
    const northRoadZ2 = -66.5;
    const northRoadW = 5.0;
    const northRoadZMid = -69.0;

    const innerZSouth = -18.2;
    const innerZNorth = -23.2;
    const innerRoadW = 5.0;
    const innerXWest = 17.5;
    const innerXEast = 22.5;

    const eastLen = entryZStart - northRoadZ1;
    const eastZMid = (entryZStart + northRoadZ1) / 2;
    const eastGeom = new THREE.BoxGeometry(roadW, 0.14, eastLen);
    eastGeom.translate(roadMidX, -0.05, eastZMid);
    drivewayGeoms.push(eastGeom);

    // Внешний восточный бордюр (от въезда до южного края стоянки)
    addCurbSegment(group, roadX2, entryZStart, roadX2, -74.0);

    // Внутренний западный бордюр восточного проезда
    addCurbSegment(group, roadX1, entryZStart, roadX1, innerZSouth);
    addCurbSegment(group, roadX1, innerZNorth, roadX1, northRoadZ2);

    // 3) ВНУТРЕННИЙ ПРОЕЗД МЕЖДУ КОРПУСОМ 2 И КОРПУСОМ 4 (ширина 5.0 м)
    const midZMid = (innerZNorth + innerZSouth) / 2;
    const midLen = roadX1 - innerXEast;
    const midGeom = new THREE.BoxGeometry(midLen, 0.14, innerRoadW);
    midGeom.translate((innerXEast + roadX1) / 2, -0.05, midZMid);
    drivewayGeoms.push(midGeom);

    addCurbSegment(group, innerXEast, innerZSouth, roadX1, innerZSouth);
    addCurbSegment(group, innerXEast, innerZNorth, roadX1, innerZNorth);

    // 4) ВНУТРЕННИЙ ПРОЕЗД МЕЖДУ КОРПУСОМ 3 И КОРПУСОМ 4 (ширина 5.0 м)
    const vertXMid = (innerXWest + innerXEast) / 2;
    const vertLen = Math.abs(innerZSouth - northRoadZ2);
    const vertGeom = new THREE.BoxGeometry(innerRoadW, 0.14, vertLen);
    vertGeom.translate(vertXMid, -0.05, (northRoadZ2 + innerZSouth) / 2);
    drivewayGeoms.push(vertGeom);

    addCurbSegment(group, innerXWest, northRoadZ2, innerXWest, innerZSouth);
    addCurbSegment(group, innerXEast, northRoadZ2, innerXEast, innerZNorth);
    addCurbSegment(group, innerXWest, innerZSouth, innerXEast, innerZSouth);
    addCurbSegment(group, 16.5, northRoadZ1, roadX1, northRoadZ1);
    addCurbSegment(group, 16.5, northRoadZ2, innerXWest, northRoadZ2);

    // 5) СЕВЕРНЫЙ ПРОЕЗД (ширина 5.0 м)
    // Продолжен до западного края карты (X = -45.0) без тупиков:
    const northWestEnd = 16.5;
    const northLen = roadX2 - northWestEnd;
    const northXMid = (northWestEnd + roadX2) / 2;
    const northGeom = new THREE.BoxGeometry(northLen, 0.14, northRoadW);
    northGeom.translate(northXMid, -0.05, northRoadZMid);
    drivewayGeoms.push(northGeom);

    // 6) ПРОДОЛЖЕНИЕ ВОСТОЧНОГО ПРОЕЗДА НА СЕВЕР ЗА КОЛЛЕДЖ ДО КРАЯ КАРТЫ (Z = -96.5):
    const mapNorthZ = -96.5;
    const northDriveLen = Math.abs(northRoadZ1 - mapNorthZ);
    const northDriveMidZ = (northRoadZ1 + mapNorthZ) / 2;
    const northDriveGeom = new THREE.BoxGeometry(roadW, 0.14, northDriveLen);
    northDriveGeom.translate(roadMidX, -0.05, northDriveMidZ);
    drivewayGeoms.push(northDriveGeom);

    // 7) НОВАЯ ПАРКОВКА ЗА КОЛЛЕДЖЕМ (перенесена по спутниковому снимку, X: 77.0..89.0, Z: -74.0..-88.0):
    const parkNorthZ = -88.0;
    const parkSouthZ = -74.0;
    const parkW = 89.0 - 77.0; // 12.0 м
    const parkD = Math.abs(parkSouthZ - parkNorthZ); // 14.0 м
    const parkGeom = new THREE.BoxGeometry(parkW, 0.14, parkD);
    parkGeom.translate((77.0 + 89.0) / 2, -0.05, (parkNorthZ + parkSouthZ) / 2);
    drivewayGeoms.push(parkGeom);

    // Бордюры вокруг новой парковки за колледжем
    addCurbSegment(group, 77.0, parkNorthZ, 89.0, parkNorthZ);
    addCurbSegment(group, 89.0, parkNorthZ, 89.0, parkSouthZ);
    addCurbSegment(group, 89.0, parkSouthZ, 77.0, parkSouthZ);

    // Бордюры северного продолжения восточного проезда
    addCurbSegment(group, roadX1, northRoadZ1, roadX1, mapNorthZ);
    // Въезд на стоянку (между parkSouthZ и parkNorthZ) полностью открыт БЕЗ бордюра!
    addCurbSegment(group, roadX2, parkNorthZ, roadX2, mapNorthZ);

    // Разметка машиномест на новой парковке (вдоль восточной кромки)
    const parkMarkingGeoms = [];
    const zBayLines = [-75.0, -77.5, -80.0, -82.5, -85.0, -87.5];
    zBayLines.forEach(zLine => {
        const g = createRoadStripeQuadGeometry(84.0, zLine, 89.0, zLine, 0.12, 0.025);
        if (g) parkMarkingGeoms.push(g);
    });
    const gDivider = createRoadStripeQuadGeometry(84.0, -75.0, 84.0, -87.5, 0.12, 0.025);
    if (gDivider) parkMarkingGeoms.push(gDivider);

    if (parkMarkingGeoms.length > 0) {
        const mergedParkMarkings = mergeBufferGeometriesVanilla(parkMarkingGeoms);
        const parkMarkingMesh = new THREE.Mesh(mergedParkMarkings, MATERIALS.roadMarkingWhite);
        parkMarkingMesh.receiveShadow = true;
        group.add(parkMarkingMesh);
    }

// Боковые дорожки перенесены в светлое мощение тротуара (MATERIALS.sidewalk)

    // Сливаем все участки асфальта в 1 Mesh
    if (drivewayGeoms.length > 0) {
        const mergedDriveway = mergeBufferGeometriesVanilla(drivewayGeoms);
        const drivewayMesh = new THREE.Mesh(mergedDriveway, MATERIALS.asphaltDriveway);
        drivewayMesh.receiveShadow = true;
        group.add(drivewayMesh);
    }

    // Внешние бордюры северного объезда (до края карты X = -45.0, БЕЗ тупика)
    // Останавливается на западной кромке восточного проезда (X = roadX1 = 72.0), не перерезая дорогу!
    // Бордюры северного проезда (восточный участок вдоль Корпуса 4)
    addCurbSegment(group, innerXEast, northRoadZ2, roadX1, northRoadZ2);
}

// ----------------------------------------------------
// ----------------------------------------------------
// Вспомогательный генератор произвольных полигонов тротуарной плитки
// Строго соосен и компланарен BoxGeometry со сдвигом y = -0.02 и толщиной 0.16:
// Верхняя грань Y = +0.06, нижняя грань Y = -0.10 (без ступеней, перепадов и швов)
// ----------------------------------------------------
function createPavementPolygonGeometry(points, yCenter = -0.02, thickness = 0.16) {
    if (!points || points.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false
    });
    geom.rotateX(Math.PI / 2);
    // ExtrudeGeometry выдавливает вдоль +Z от 0 до thickness.
    // rotateX(PI/2) отображает Z в -Y (от -thickness до 0).
    // Чтобы совместить с BoxGeometry (верх Y = yCenter + thickness/2 = +0.06):
    geom.translate(0, yCenter + thickness / 2, 0);
    geom.computeVertexNormals();
    return geom;
}

// ----------------------------------------------------
// 5. ЗОНА ГЛАВНОГО ВХОДА, ПЛОЩАДЬ И ПРОМЕНАД
// ----------------------------------------------------
function buildForecourtDualTonePaving(group) {
    const paveGeoms = [];
    const mapWestX = -25.0;
    const mapEastX = 92.0;
    const roadX2 = EAST_ROAD_X2;
    const zRoadNorth = 28.2;
    const zPocketEdge = 25.4;
    const xBayStart = -6.0;
    const xBayEnd = 38.0;

    // 1) Центральный променад у южного фасада К1:
    // X: от -10.0 до 20.4, Z: от 17.0 до 21.6
    const promW = 20.4 - (-10.0);
    const promD = 21.6 - 17.0;
    const promGeom = new THREE.BoxGeometry(promW, 0.16, promD);
    promGeom.translate((-10.0 + 20.4) / 2, -0.02, (17.0 + 21.6) / 2);
    paveGeoms.push(promGeom);

    // 2) Входная площадь перед крыльцом Корпуса 1:
    // X: от -8.6 до 20.4, Z: от 12.2 до 17.0
    const plazaW = 20.4 - (-8.6);
    const plazaD = 17.0 - 12.2;
    const plazaGeom = new THREE.BoxGeometry(plazaW, 0.16, plazaD);
    plazaGeom.translate((-8.6 + 20.4) / 2, -0.02, (12.2 + 17.0) / 2);
    paveGeoms.push(plazaGeom);

    // Подходная ступень/уступ перед крыльцом:
    // Начинается строго от X = 15.6 (не перекрывая ступени крыльца К1):
    const entryNotchPave = new THREE.BoxGeometry(20.4 - 15.6, 0.16, 12.2 - 8.6);
    entryNotchPave.translate((15.6 + 20.4) / 2, -0.02, (8.6 + 12.2) / 2);
    paveGeoms.push(entryNotchPave);

    // 3) Тротуар Корпуса 2:
    const b2SouthWalk = new THREE.BoxGeometry(72.0 - 20.4, 0.16, 21.6 - 17.0);
    b2SouthWalk.translate((20.4 + 72.0) / 2, -0.02, (17.0 + 21.6) / 2);
    paveGeoms.push(b2SouthWalk);

    const b2WestWalk = new THREE.BoxGeometry(20.4 - 17.0, 0.16, 17.0 - 8.6);
    b2WestWalk.translate((17.0 + 20.4) / 2, -0.02, (8.6 + 17.0) / 2);
    paveGeoms.push(b2WestWalk);

    // 4) Подход к пешеходному переходу со скосом въезда (ЕДИНЫЙ МОНОЛИТНЫЙ ПОЛИГОН БЕЗ ШВОВ И СТЫКОВ):
    // Точки контура: [40.5, 21.6] -> [72.0, 21.6] -> [72.0, 24.5] -> [70.0, 28.2] -> [40.5, 28.2]
    // Идеально состыкован с тротуаром К2, переходом и диагональным бордюром раструба (без перепадов высоты):
    const crosswalkApproachWalk = createPavementPolygonGeometry([
        [40.5, 21.6],
        [72.0, 21.6],
        [72.0, 24.5],
        [70.0, 28.2],
        [40.5, 28.2]
    ], -0.02, 0.16);
    if (crosswalkApproachWalk) paveGeoms.push(crosswalkApproachWalk);

    // 5) Западный променад (продлён до границы карты X = mapWestX):
    const westPromWalk = new THREE.BoxGeometry(Math.abs(-10.0 - mapWestX), 0.16, 21.6 - 17.0);
    westPromWalk.translate((mapWestX + -10.0) / 2, -0.02, (17.0 + 21.6) / 2);
    paveGeoms.push(westPromWalk);

    // 6) Восточный тротуар променада (строго до Z=24.5, к югу от Z=24.5 до дороги — зеленый газон):
    const eastPromWalk = createPavementPolygonGeometry([
        [roadX2, 20.0],
        [mapEastX, 20.0],
        [mapEastX, 24.5],
        [roadX2, 24.5]
    ], -0.02, 0.16);
    if (eastPromWalk) paveGeoms.push(eastPromWalk);

    // 7) Платформа автобусной остановки (X: -10.0..40.5, Z: 21.6..25.4):
    const platLen = 40.5 - (-10.0);
    const platDepth = zPocketEdge - 21.6; // 3.8 м
    const platGeom = new THREE.BoxGeometry(platLen, 0.16, platDepth);
    platGeom.translate((-10.0 + 40.5) / 2, -0.02, (21.6 + zPocketEdge) / 2);
    paveGeoms.push(platGeom);

    // 8) Западный скос платформы кармана (под тротуаром):
    const westTaperWalk = createPavementPolygonGeometry([
        [-10.0, zPocketEdge],
        [xBayStart, zPocketEdge],
        [-10.0, zRoadNorth]
    ], -0.02, 0.16);
    if (westTaperWalk) paveGeoms.push(westTaperWalk);

    // 9) Восточный скос платформы кармана (под тротуаром):
    const eastTaperWalk = createPavementPolygonGeometry([
        [xBayEnd, zPocketEdge],
        [40.5, zPocketEdge],
        [40.5, zRoadNorth]
    ], -0.02, 0.16);
    if (eastTaperWalk) paveGeoms.push(eastTaperWalk);

    const mergedPave = mergeBufferGeometriesVanilla(paveGeoms);
    const paveMesh = new THREE.Mesh(mergedPave, MATERIALS.sidewalk);
    paveMesh.receiveShadow = true;
    group.add(paveMesh);

    // Бордюры:
    addCurbSegment(group, mapWestX, 17.0, -10.0, 17.0);
    addCurbSegment(group, mapWestX, 21.6, -10.0, 21.6);
    addCurbSegment(group, -10.0, 17.0, -8.6, 17.0);
    addCurbSegment(group, -8.6, 12.2, -8.6, 17.0);

    addCurbSegment(group, roadX2, 20.0, mapEastX, 20.0);
    addCurbSegment(group, roadX2, 24.5, mapEastX, 24.5);
    addCurbSegment(group, 72.0, 17.0, 72.0, 24.5);
    addCurbSegment(group, 40.5, 28.2, 54.0, 28.2);
    addCurbSegment(group, 58.0, 28.2, 70.0, 28.2);
    addCurbSegment(group, 79.0, 28.2, mapEastX, 28.2);

    // Угловые замковые элементы бордюров на стыках скосов въезда (закрывают вырезы и щели на углах):
    addCurbCornerPiece(group, 70.0, 28.2, 0, 0);
    addCurbCornerPiece(group, 72.0, 24.5, 0, 0);
    addCurbCornerPiece(group, 77.0, 24.5, 0, 0);
    addCurbCornerPiece(group, 79.0, 28.2, 0, 0);
}

function buildForecourtAndPlaza(group) {
    buildForecourtDualTonePaving(group);
}

// ==========================================
// M4: ПРОЦЕДУРНЫЕ 3D-МОДЕЛИ БЛАГОУСТРОЙСТВА ТЕРРИТОРИИ
// ==========================================

// 1. ЭРГОНОМИЧНАЯ ПАРКОВАЯ СКАМЬЯ С ФАСОЧНЫМИ ЛАМЕЛЯМИ И ЧУГУННЫМИ ОПОРАМИ
let _cachedCampusBenchGeoms = null;
function getCampusBenchGeometries() {
    if (_cachedCampusBenchGeoms) return _cachedCampusBenchGeoms;
    // Деревянные ламели (10 штук: 5 сиденье с waterfall, 5 спинка с поясничным изгибом)
    const slatShape = new THREE.Shape();
    slatShape.moveTo(-0.0325, -0.014);
    slatShape.lineTo(0.0325, -0.014);
    slatShape.lineTo(0.0325, 0.014);
    slatShape.lineTo(-0.0325, 0.014);
    slatShape.closePath();

    const slatGeomBase = new THREE.ExtrudeGeometry(slatShape, {
        depth: 2.06,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.0035,
        bevelThickness: 0.0035
    });
    slatGeomBase.translate(0, 0, -1.03);
    slatGeomBase.rotateY(Math.PI / 2);

    const slatConfigs = [
        { y: 0.435, z: 0.200, rotX: -12 * Math.PI / 180 },
        { y: 0.450, z: 0.125, rotX: -4 * Math.PI / 180 },
        { y: 0.450, z: 0.050, rotX: 0 },
        { y: 0.442, z: -0.025, rotX: 6 * Math.PI / 180 },
        { y: 0.455, z: -0.100, rotX: 14 * Math.PI / 180 },
        { y: 0.525, z: -0.150, rotX: 18 * Math.PI / 180 },
        { y: 0.605, z: -0.178, rotX: 16 * Math.PI / 180 },
        { y: 0.685, z: -0.205, rotX: 15 * Math.PI / 180 },
        { y: 0.765, z: -0.230, rotX: 14 * Math.PI / 180 },
        { y: 0.840, z: -0.252, rotX: 10 * Math.PI / 180 }
    ];

    const woodGeoms = [];
    slatConfigs.forEach(cfg => {
        const g = slatGeomBase.clone();
        g.rotateX(cfg.rotX);
        g.translate(0, cfg.y, cfg.z);
        woodGeoms.push(g);
    });

    // Металлические элементы: 3 чугунные литые стойки с подлокотниками и крепежом
    const metalGeoms = [];
    const stanchionX = [-0.92, 0.0, 0.92];

    stanchionX.forEach((sx, idx) => {
        const isOuter = (idx === 0 || idx === 2);

        // Опорные фланцевые башмаки в основании (покоятся на уровне Y = 0.000)
        const frontFoot = new THREE.BoxGeometry(0.12, 0.016, 0.09);
        frontFoot.translate(sx, 0.008, 0.22);
        metalGeoms.push(frontFoot);

        const rearFoot = new THREE.BoxGeometry(0.12, 0.016, 0.09);
        rearFoot.translate(sx, 0.008, -0.28);
        metalGeoms.push(rearFoot);

        // Анкерные болты
        const boltF1 = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
        boltF1.translate(sx - 0.035, 0.018, 0.22);
        metalGeoms.push(boltF1);
        const boltF2 = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
        boltF2.translate(sx + 0.035, 0.018, 0.22);
        metalGeoms.push(boltF2);

        const boltR1 = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
        boltR1.translate(sx - 0.035, 0.018, -0.28);
        metalGeoms.push(boltR1);
        const boltR2 = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
        boltR2.translate(sx + 0.035, 0.018, -0.28);
        metalGeoms.push(boltR2);

        // Передняя опора ноги
        const legFront = new THREE.BoxGeometry(0.032, 0.42, 0.045);
        legFront.translate(sx, 0.21, 0.20);
        metalGeoms.push(legFront);

        // Задняя стабилизирующая наклонная опора
        const legRear = new THREE.BoxGeometry(0.032, 0.45, 0.045);
        legRear.rotateX(15 * Math.PI / 180);
        legRear.translate(sx, 0.21, -0.22);
        metalGeoms.push(legRear);

        // Продольная балка люльки сиденья
        const seatCradle = new THREE.BoxGeometry(0.032, 0.045, 0.36);
        seatCradle.translate(sx, 0.41, 0.04);
        metalGeoms.push(seatCradle);

        // Наклонный хребет поддержки спинки
        const backSpine = new THREE.BoxGeometry(0.032, 0.44, 0.040);
        backSpine.rotateX(16 * Math.PI / 180);
        backSpine.translate(sx, 0.65, -0.20);
        metalGeoms.push(backSpine);

        // Подлокотники на крайних стойках
        if (isOuter) {
            const armTop = new THREE.BoxGeometry(0.038, 0.028, 0.36);
            armTop.translate(sx, 0.62, 0.02);
            metalGeoms.push(armTop);

            const armPost = new THREE.CylinderGeometry(0.014, 0.014, 0.18, 12);
            armPost.translate(sx, 0.52, 0.18);
            metalGeoms.push(armPost);
        }

        // Болты крепления ламелей к стойке
        slatConfigs.forEach(cfg => {
            const boltHead = new THREE.CylinderGeometry(0.006, 0.006, 0.036, 8);
            boltHead.rotateZ(Math.PI / 2);
            boltHead.translate(sx, cfg.y, cfg.z);
            metalGeoms.push(boltHead);
        });
    });

    // Продольные стальные стяжки жесткости
    const tie1 = new THREE.CylinderGeometry(0.008, 0.008, 1.88, 12);
    tie1.rotateZ(Math.PI / 2);
    tie1.translate(0, 0.38, 0.10);
    metalGeoms.push(tie1);

    const tie2 = new THREE.CylinderGeometry(0.008, 0.008, 1.88, 12);
    tie2.rotateZ(Math.PI / 2);
    tie2.translate(0, 0.38, -0.15);
    metalGeoms.push(tie2);

    [-0.94, 0.94].forEach(tx => {
        const nut1 = new THREE.SphereGeometry(0.014, 8, 6);
        nut1.translate(tx, 0.38, 0.10);
        metalGeoms.push(nut1);
        const nut2 = new THREE.SphereGeometry(0.014, 8, 6);
        nut2.translate(tx, 0.38, -0.15);
        metalGeoms.push(nut2);
    });

    const woodMerged = mergeBufferGeometriesVanilla(woodGeoms);
    const metalMerged = mergeBufferGeometriesVanilla(metalGeoms);
    metalMerged.computeBoundingBox();
    if (metalMerged.boundingBox && Math.abs(metalMerged.boundingBox.min.y) > 0.0001) {
        const dy = -metalMerged.boundingBox.min.y;
        metalMerged.translate(0, dy, 0);
        woodMerged.translate(0, dy, 0);
    }

    _cachedCampusBenchGeoms = {
        woodGeom: woodMerged,
        metalGeom: metalMerged
    };
    return _cachedCampusBenchGeoms;
}

function buildCampusBench(group, x, z, rotY = 0, yGround = 0.06) {
    const benchGroup = new THREE.Group();
    benchGroup.position.set(x, yGround, z);
    benchGroup.rotation.y = rotY;

    const { woodGeom, metalGeom } = getCampusBenchGeometries();

    const woodMesh = new THREE.Mesh(woodGeom, MATERIALS.campusBenchWood);
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    benchGroup.add(woodMesh);

    const metalMesh = new THREE.Mesh(metalGeom, MATERIALS.campusBenchMetal);
    metalMesh.castShadow = true;
    metalMesh.receiveShadow = true;
    benchGroup.add(metalMesh);

    if (group) group.add(benchGroup);
    return benchGroup;
}

// 2. ПАРКОВАЯ МЕТАЛЛИЧЕСКАЯ УРНА С КУПОЛЬНОЙ КРЫШКОЙ И РЕБРИСТЫМ КОРПУСОМ
let _cachedParkWasteBinGeoms = null;
function getParkWasteBinSubGeometries() {
    if (_cachedParkWasteBinGeoms) return _cachedParkWasteBinGeoms;
    const bodyGeoms = [];

    // Главная цилиндрическая обечайка корпуса урны
    const shell = new THREE.CylinderGeometry(0.205, 0.205, 0.54, 32);
    shell.translate(0, 0.456, 0);
    bodyGeoms.push(shell);

    // 16 вертикальных полукруглых ребер жесткости
    const numRibs = 16;
    for (let r = 0; r < numRibs; r++) {
        const ang = (r / numRibs) * Math.PI * 2;
        const rib = new THREE.CylinderGeometry(0.006, 0.006, 0.48, 8);
        rib.translate(Math.cos(ang) * 0.208, 0.456, Math.sin(ang) * 0.208);
        bodyGeoms.push(rib);
    }

    // Верхний и нижний катаные пояса жесткости
    const bottomBand = new THREE.CylinderGeometry(0.212, 0.212, 0.024, 32);
    bottomBand.translate(0, 0.200, 0);
    bodyGeoms.push(bottomBand);

    const topBand = new THREE.CylinderGeometry(0.212, 0.212, 0.024, 32);
    topBand.translate(0, 0.714, 0);
    bodyGeoms.push(topBand);

    // Литой конический пьедестал
    const pedestal = new THREE.CylinderGeometry(0.08, 0.15, 0.05, 24);
    pedestal.translate(0, 0.041, 0);
    bodyGeoms.push(pedestal);

    // Центральная несущая колонка
    const riser = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16);
    riser.translate(0, 0.126, 0);
    bodyGeoms.push(riser);

    // Металлические детали
    const metalGeoms = [];

    // Опорный фланец основания (покоится на уровне Y = 0.000)
    const flange = new THREE.CylinderGeometry(0.16, 0.16, 0.016, 24);
    flange.translate(0, 0.008, 0);
    metalGeoms.push(flange);

    // 4 анкерных болта
    for (let a = 0; a < 4; a++) {
        const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
        const bolt = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
        bolt.translate(Math.cos(ang) * 0.12, 0.018, Math.sin(ang) * 0.12);
        metalGeoms.push(bolt);
    }

    // Два боковых несущих пилона крышки
    const pylonL = new THREE.BoxGeometry(0.035, 0.13, 0.018);
    pylonL.translate(-0.185, 0.791, 0);
    metalGeoms.push(pylonL);

    const pylonR = new THREE.BoxGeometry(0.035, 0.13, 0.018);
    pylonR.translate(0.185, 0.791, 0);
    metalGeoms.push(pylonR);

    // Шарнирная петля опрокидывания
    const hinge = new THREE.CylinderGeometry(0.012, 0.012, 0.04, 12);
    hinge.rotateZ(Math.PI / 2);
    hinge.translate(-0.185, 0.730, 0);
    metalGeoms.push(hinge);

    // Купольный навес-крышка
    const hoodSkirt = new THREE.CylinderGeometry(0.20, 0.22, 0.06, 32);
    hoodSkirt.translate(0, 0.856, 0);
    metalGeoms.push(hoodSkirt);

    const hoodDome = new THREE.SphereGeometry(0.21, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.35);
    hoodDome.translate(0, 0.840, 0);
    metalGeoms.push(hoodDome);

    // Пепельница / пластина гашения окурков
    const ashtrayRing = new THREE.CylinderGeometry(0.055, 0.055, 0.010, 20);
    ashtrayRing.translate(0, 0.895, 0);
    metalGeoms.push(ashtrayRing);

    const ashtrayGrid = new THREE.CylinderGeometry(0.045, 0.045, 0.004, 16);
    ashtrayGrid.translate(0, 0.900, 0);
    metalGeoms.push(ashtrayGrid);

    // Внутреннее ведро-вкладыш
    const innerLiner = new THREE.CylinderGeometry(0.185, 0.185, 0.48, 24);
    innerLiner.translate(0, 0.456, 0);
    metalGeoms.push(innerLiner);

    _cachedParkWasteBinGeoms = {
        bodyGeom: mergeBufferGeometriesVanilla(bodyGeoms),
        metalGeom: mergeBufferGeometriesVanilla(metalGeoms)
    };
    return _cachedParkWasteBinGeoms;
}

function buildParkWasteBin(group, x, z, rotY = 0, yGround = 0.06) {
    const binGroup = new THREE.Group();
    binGroup.position.set(x, yGround, z);
    binGroup.rotation.y = rotY;

    const { bodyGeom, metalGeom } = getParkWasteBinSubGeometries();

    const bodyMesh = new THREE.Mesh(bodyGeom, MATERIALS.campusWasteBinBody);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    binGroup.add(bodyMesh);

    const metalMesh = new THREE.Mesh(metalGeom, MATERIALS.campusBenchMetal);
    metalMesh.castShadow = true;
    metalMesh.receiveShadow = true;
    binGroup.add(metalMesh);

    if (group) group.add(binGroup);
    return binGroup;
}

// 3. ВЕЛОСИПЕДНАЯ СТАНЦИЯ (5 ИЗОГНУТЫХ ДУГ SHEFFIELD С МЕДАЛЬОНАМИ)
function createSheffieldHoopPath(w = 0.76, h = 0.86, r = 0.13, yBottom = 0.0) {
    const path = new THREE.CurvePath();
    const halfW = w / 2;

    path.add(new THREE.LineCurve3(
        new THREE.Vector3(-halfW, yBottom, 0),
        new THREE.Vector3(-halfW, h - r, 0)
    ));
    path.add(new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-halfW, h - r, 0),
        new THREE.Vector3(-halfW, h, 0),
        new THREE.Vector3(-halfW + r, h, 0)
    ));
    path.add(new THREE.LineCurve3(
        new THREE.Vector3(-halfW + r, h, 0),
        new THREE.Vector3(halfW - r, h, 0)
    ));
    path.add(new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(halfW - r, h, 0),
        new THREE.Vector3(halfW, h, 0),
        new THREE.Vector3(halfW, h - r, 0)
    ));
    path.add(new THREE.LineCurve3(
        new THREE.Vector3(halfW, h - r, 0),
        new THREE.Vector3(halfW, yBottom, 0)
    ));
    return path;
}

let _cachedBicycleStationGeom = null;
function getBicycleStationSubGeometries() {
    if (_cachedBicycleStationGeom) return _cachedBicycleStationGeom;
    const stationGeoms = [];
    const hoopSpacing = 0.95;
    const hoopCount = 5;

    const hoopPath = createSheffieldHoopPath(0.76, 0.86, 0.13, 0.0);
    const baseHoopGeom = new THREE.TubeGeometry(hoopPath, 48, 0.024, 16, false);
    baseHoopGeom.rotateY(Math.PI / 2);

    for (let k = 0; k < hoopCount; k++) {
        const hx = (k - (hoopCount - 1) / 2) * hoopSpacing;

        const hGeom = baseHoopGeom.clone();
        hGeom.translate(hx, 0, 0);
        stationGeoms.push(hGeom);

        // Горизонтальная промежуточная перекладина от угона
        const crossbar = new THREE.CylinderGeometry(0.016, 0.016, 0.712, 16);
        crossbar.rotateX(Math.PI / 2);
        crossbar.translate(hx, 0.44, 0);
        stationGeoms.push(crossbar);

        // Центральный круглый медальон
        const medallion = new THREE.CylinderGeometry(0.040, 0.040, 0.008, 20);
        medallion.rotateZ(Math.PI / 2);
        medallion.translate(hx, 0.44, 0);
        stationGeoms.push(medallion);

        // Опорные фланцы на каждой ноге
        [-0.38, 0.38].forEach(fz => {
            const flange = new THREE.CylinderGeometry(0.065, 0.065, 0.014, 20);
            flange.translate(hx, 0.007, fz);
            stationGeoms.push(flange);

            const sleeve = new THREE.CylinderGeometry(0.028, 0.032, 0.020, 16);
            sleeve.translate(hx, 0.017, fz);
            stationGeoms.push(sleeve);

            for (let b = 0; b < 3; b++) {
                const ang = (b / 3) * Math.PI * 2;
                const bolt = new THREE.SphereGeometry(0.007, 8, 6);
                bolt.translate(hx + Math.cos(ang) * 0.048, 0.014, fz + Math.sin(ang) * 0.048);
                stationGeoms.push(bolt);
            }
        });
    }

    // Продольные соединительные швеллеры-рельсы
    [-0.38, 0.38].forEach(rz => {
        const rail = new THREE.BoxGeometry(4.20, 0.025, 0.06);
        rail.translate(0, 0.0125, rz);
        stationGeoms.push(rail);
    });

    _cachedBicycleStationGeom = mergeBufferGeometriesVanilla(stationGeoms);
    return _cachedBicycleStationGeom;
}

function buildBicycleStation(group, x, z, rotY = 0, yGround = 0.06) {
    const stationGroup = new THREE.Group();
    stationGroup.position.set(x, yGround, z);
    stationGroup.rotation.y = rotY;

    const stationGeom = getBicycleStationSubGeometries();
    const stationMesh = new THREE.Mesh(stationGeom, MATERIALS.bikeRackGalvanized);
    stationMesh.castShadow = true;
    stationMesh.receiveShadow = true;
    stationGroup.add(stationMesh);

    if (group) group.add(stationGroup);
    return stationGroup;
}



// 5. ДЕКОРАТИВНЫЕ ПЕШЕХОДНЫЕ БОЛЛАРДЫ (ЧЕРЕЗ INSTANCEDMESH)
function buildPedestrianBollards(group, positions, yGround = 0.06) {
    if (!positions || positions.length === 0) return null;

    const bollardPoints = [
        new THREE.Vector2(0.080, 0.000), // Ground level base
        new THREE.Vector2(0.108, 0.035), // Flared base plinth top
        new THREE.Vector2(0.085, 0.070), // Scotia transition curve
        new THREE.Vector2(0.078, 0.090), // Lower shaft fillet
        new THREE.Vector2(0.076, 0.100), // Shaft entasis taper start
        new THREE.Vector2(0.074, 0.400), // Shaft midpoint
        new THREE.Vector2(0.072, 0.640), // Shaft taper end
        new THREE.Vector2(0.072, 0.650), // Lower bead collar bottom
        new THREE.Vector2(0.082, 0.660), // Lower bead collar crest
        new THREE.Vector2(0.071, 0.670), // Lower bead collar top
        new THREE.Vector2(0.071, 0.675), // Reflective band groove bottom
        new THREE.Vector2(0.071, 0.735), // Reflective band groove top
        new THREE.Vector2(0.071, 0.740), // Upper bead collar bottom
        new THREE.Vector2(0.080, 0.755), // Upper bead collar crest
        new THREE.Vector2(0.071, 0.765), // Upper bead collar top
        new THREE.Vector2(0.072, 0.780), // Neck transition
        new THREE.Vector2(0.074, 0.810), // Cap dome spring line
        new THREE.Vector2(0.058, 0.855), // Cap dome hemisphere
        new THREE.Vector2(0.025, 0.875), // Cap dome apex curve
        new THREE.Vector2(0.000, 0.880)  // Crown finial peak
    ];
    const bollardGeom = new THREE.LatheGeometry(bollardPoints, 28);
    bollardGeom.computeVertexNormals();

    const ringGeom = new THREE.CylinderGeometry(0.0715, 0.0715, 0.060, 28, 1, true);
    ringGeom.translate(0, 0.705, 0);

    const count = positions.length;
    const instBollards = new THREE.InstancedMesh(bollardGeom, MATERIALS.castIronDark, count);
    instBollards.castShadow = true;
    instBollards.receiveShadow = true;

    const instRings = new THREE.InstancedMesh(ringGeom, MATERIALS.reflectiveWhite, count);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
        const [bx, bz] = positions[i];
        dummy.position.set(bx, yGround, bz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        instBollards.setMatrixAt(i, dummy.matrix);
        instRings.setMatrixAt(i, dummy.matrix);
    }
    instBollards.instanceMatrix.needsUpdate = true;
    instRings.instanceMatrix.needsUpdate = true;

    if (group) {
        group.add(instBollards);
        group.add(instRings);
    }
    return { instBollards, instRings };
}

// 6. КОМПЛЕКСНОЕ РАЗМЕЩЕНИЕ ВСЕХ ОБЪЕКТОВ БЛАГОУСТРОЙСТВА ПАРАДНОЙ ЗОНЫ И ПРОМЕНАДА
function buildPromenadeAndForecourtAmenities(group) {
    const yPave = 0.06;

    // --- 1. УРНЫ И МАФ ---
    const binPositions = [
        { x: 26.2, z: 17.8 },
        { x: 38.2, z: 17.8 },
        { x: 50.2, z: 17.8 },
        { x: 62.2, z: 17.8 },
        { x: -10.2, z: 16.5 },
        { x: -11.8, z: 20.5 },
        { x: 16.8, z: 13.5 }
    ];

    const allBinBodyGeoms = [];
    const allBinMetalGeoms = [];
    const { bodyGeom: binBodyGeom, metalGeom: binMetalGeom } = getParkWasteBinSubGeometries();

    binPositions.forEach(bp => {
        const bg = binBodyGeom.clone();
        bg.translate(bp.x, yPave, bp.z);
        allBinBodyGeoms.push(bg);

        const mg = binMetalGeom.clone();
        mg.translate(bp.x, yPave, bp.z);
        allBinMetalGeoms.push(mg);
    });

    const mergedBinBody = mergeBufferGeometriesVanilla(allBinBodyGeoms);
    const binBodyMesh = new THREE.Mesh(mergedBinBody, MATERIALS.campusWasteBinBody);
    binBodyMesh.castShadow = true;
    binBodyMesh.receiveShadow = true;
    group.add(binBodyMesh);

    const mergedBinMetal = mergeBufferGeometriesVanilla(allBinMetalGeoms);
    const binMetalMesh = new THREE.Mesh(mergedBinMetal, MATERIALS.campusBenchMetal);
    binMetalMesh.castShadow = true;
    binMetalMesh.receiveShadow = true;
    group.add(binMetalMesh);

    // --- 3. ВЕЛОСИПЕДНЫЕ ПАРКОВКИ (2 станции: X=-14.0 у площади и X=66.0 на востоке) ---
    const stationGeom = getBicycleStationSubGeometries();
    const allBikeGeoms = [];

    const bikeStations = [
        { x: -14.0, z: 20.5, rotY: 0 },
        { x: 66.0, z: 21.0, rotY: 0 }
    ];
    bikeStations.forEach(bs => {
        const bg = stationGeom.clone();
        if (bs.rotY !== 0) bg.rotateY(bs.rotY);
        bg.translate(bs.x, yPave, bs.z);
        allBikeGeoms.push(bg);
    });

    const mergedBikes = mergeBufferGeometriesVanilla(allBikeGeoms);
    const bikeMesh = new THREE.Mesh(mergedBikes, MATERIALS.bikeRackGalvanized);
    bikeMesh.castShadow = true;
    bikeMesh.receiveShadow = true;
    group.add(bikeMesh);

    // --- 4. ВХОДНАЯ АРХИТЕКТУРНАЯ СТЕЛА (X = -5.0, Z = 18.5) ---
    // Entrance stele removed per user request

    // --- 5. ДЕКОРАТИВНЫЕ ПЕШЕХОДНЫЕ БОЛЛАРДЫ (восточный и западный периметры) ---
    const bollardPositions = [
        [71.5, 18.0],
        [71.5, 20.0],
        [71.5, 22.0],
        [71.5, 24.0],
        [-23.0, 18.0],
        [-23.0, 21.0],
        [-23.0, 24.0]
    ];
    buildPedestrianBollards(group, bollardPositions, yPave);
}

// ----------------------------------------------------
// 6. ОЗЕЛЕНЕНИЕ (ГАЗОН КОРПУСА 2 С ДЕРЕВЬЯМИ И ДЕРЕВЬЯ ВДОЛЬ ВОСТОЧНОЙ ГРАНИЦЫ)
// ----------------------------------------------------
function buildLandscaping(group) {
    // 1. ВЫДЕЛЕННЫЙ ГАЗОН ПЕРЕД КОРПУСОМ 2 (КРАСНАЯ РАМКА НА СНИМКЕ ПОЛЬЗОВАТЕЛЯ!)
    // X: 20.4..68.0, Z: 3.5..17.0
    const lawnW = 68.0 - 20.4; // 47.6 м
    const lawnD = 17.0 - 3.5;  // 13.5 м
    const lawnGeom = new THREE.BoxGeometry(lawnW, 0.18, lawnD);
    const lawnMesh = new THREE.Mesh(lawnGeom, MATERIALS.lawn);
    lawnMesh.position.set((20.4 + 68.0) / 2, -0.01, (3.5 + 17.0) / 2);
    lawnMesh.receiveShadow = true;
    group.add(lawnMesh);

    // Замкнутый бордюр вокруг газона перед Корпусом 2
    addCurbSegment(group, 20.4, 3.5, 68.0, 3.5);
    addCurbSegment(group, 68.0, 3.5, 68.0, 17.0);
    addCurbSegment(group, 68.0, 17.0, 20.4, 17.0);
    addCurbSegment(group, 20.4, 17.0, 20.4, 3.5);

    // 2. БОТАНИЧЕСКИЕ ЖИВЫЕ ИЗГОРОДИ ВОКРУГ ГАЗОНА И ОСТАНОВКИ
    // Цокольная изгородь вдоль южного фасада Корпуса 2
    addBotanicalHedgeSegment(group, 22.0, 3.8, 66.5, 3.8, 0.95, 0.60);
    // Низкая разделительная изгородь вдоль променада
    addBotanicalHedgeSegment(group, 22.0, 16.6, 66.5, 16.6, 0.75, 0.50);
    // Боковая кулисная изгородь вдоль западной дорожки
    addBotanicalHedgeSegment(group, 20.8, 4.0, 20.8, 16.2, 0.65, 0.45);
    // Восточная живая изгородь газона К2 (замкнутый контур кустарника):
    addBotanicalHedgeSegment(group, 67.5, 4.0, 67.5, 16.2, 0.65, 0.45);
// Фоновая изгородь за остановкой удалена, чтобы не залезать в павильон

    // 3. 5 ДЕРЕВЬЕВ ВЫСОКОЙ ТОЧНОСТИ НА ГАЗОНЕ КОРПУСА 2 С ПРИСТВОЛЬНЫМИ КРУГАМИ:
    // X=26.0: Береза европейская (Betula pendula) [цель теста tree_birch]
    // X=36.0: Липа мелколистная (Tilia cordata)
    // X=46.0: Липа мелколистная (Tilia cordata) [цель теста tree_linden]
    // X=56.0: Липа мелколистная (Tilia cordata)
    // X=64.0: Береза европейская (Betula pendula)
    const b2Trees = [
        { x: 26.0, type: 'birch',  scale: 1.15, rot: 0.35 },
        { x: 36.0, type: 'linden', scale: 1.12, rot: 1.20 },
        { x: 46.0, type: 'linden', scale: 1.20, rot: 0.00 },
        { x: 56.0, type: 'linden', scale: 1.15, rot: 2.10 },
        { x: 64.0, type: 'birch',  scale: 1.18, rot: 1.10 }
    ];

    b2Trees.forEach((t, idx) => {
        // Приствольный круг с темной древесной мульчей (приподнят на высоту газона Корпуса 2 Y = 0.08м)
        addTreeRing(group, t.x, 10.2, 1.15, 0.08);

        if (t.type === 'birch') {
            addBirchTree(group, t.x, 10.2, t.scale, t.rot, 0.08);
        } else {
            addLindenTree(group, t.x, 10.2, t.scale, idx + 1, 0.08);
        }
    });

    // 4. ДЕКОРАТИВНЫЕ КУСТАРНИКИ В УГЛОВЫХ ЗОНАХ ГАЗОНА: убраны по запросу пользователя

// Деревья у входа удалены по запросу пользователя

    // 5. ДЕРЕВЬЯ ВДОЛЬ ВОСТОЧНОГО ПОДЪЕЗДА КОЛЛЕДЖА (X = 80.8)
    // Аллея елей европейских (Picea abies), перемежаемых липами
    // Свободно размещены на газонах вне нового восточного ответвления дороги (Z: 20.0..24.5)
    const drivewayTrees = [
        { x: 82.5, z:  27.0, type: 'spruce', scale: 1.20, seed: 1 },
        { x: 80.8, z:  14.0, type: 'spruce', scale: 1.22, seed: 2 },
        { x: 80.8, z:   2.0, type: 'linden', scale: 1.22, seed: 3 },
        { x: 80.8, z:  -8.0, type: 'spruce', scale: 1.18, seed: 4 },
        { x: 80.8, z: -18.0, type: 'spruce', scale: 1.35, seed: 5 },
        { x: 80.8, z: -30.0, type: 'linden', scale: 1.20, seed: 6 },
        { x: 80.8, z: -42.0, type: 'spruce', scale: 1.30, seed: 7 }
    ];

    // Деревья возле новой парковки за колледжем (как на спутниковом снимке)
    addSpruceTree(group, 90.5, -81.0, 1.25, 9);
    
    drivewayTrees.forEach(t => {
        addTreeRing(group, t.x, t.z, 1.10);
        if (t.type === 'spruce') {
            addSpruceTree(group, t.x, t.z, t.scale, t.seed);
        } else {
            addLindenTree(group, t.x, t.z, t.scale, t.seed);
        }
    });

    // 6. Западная парковая зона (X: -22.0..-12.0, Z: -66.0..-15.0)
    // Разреженная ландшафтная посадка (береза/липа/ель) за западным забором (X = -5.0):
    const westParkTrees = [
        { x: -18.0, z: -66.0, type: 'spruce', scale: 1.25, seed: 14 },
        { x: -12.5, z: -64.0, type: 'linden', scale: 1.18, rot: 1.80 },
        { x: -18.0, z: -58.0, type: 'birch',  scale: 1.18, rot: 0.40 },
        { x: -13.0, z: -56.0, type: 'linden', scale: 1.15, rot: 1.20 },
        { x: -16.5, z: -48.0, type: 'spruce', scale: 1.30, seed: 11 },
        { x: -12.0, z: -46.0, type: 'birch',  scale: 1.12, rot: 0.90 },
        { x: -17.5, z: -38.0, type: 'linden', scale: 1.22, rot: 2.10 },
        { x: -13.0, z: -36.0, type: 'spruce', scale: 1.25, seed: 12 },
        { x: -17.0, z: -28.0, type: 'birch',  scale: 1.16, rot: 1.50 },
        { x: -12.5, z: -26.0, type: 'linden', scale: 1.18, rot: 0.60 },
        { x: -18.0, z: -18.0, type: 'spruce', scale: 1.28, seed: 13 },
        { x: -13.0, z: -16.0, type: 'birch',  scale: 1.15, rot: 2.00 }
    ];

    westParkTrees.forEach((t, idx) => {
        if (t.type === 'birch') {
            addBirchTree(group, t.x, t.z, t.scale, t.rot);
        } else if (t.type === 'linden') {
            addLindenTree(group, t.x, t.z, t.scale, idx + 10);
        } else if (t.type === 'spruce') {
            addSpruceTree(group, t.x, t.z, t.scale, t.seed);
        }
    });

    // 7. Северная парковая лесополоса (X: -20.0..68.0, Z: -73.0..-91.0)
    // Единый живописный массив берез, лип и елей, гармонично продолжающий западный парк за северным забором:
    const northParkTrees = [
        // Северо-западный сектор: огибание угла забора
        { x: -18.0, z: -74.0, type: 'birch',  scale: 1.16, rot: 0.70 },
        { x: -13.0, z: -73.0, type: 'linden', scale: 1.22, rot: 2.30 },
        { x: -16.0, z: -83.0, type: 'spruce', scale: 1.30, seed: 15 },
        { x: -10.0, z: -84.0, type: 'birch',  scale: 1.18, rot: 1.10 },
        { x:  -4.0, z: -79.0, type: 'linden', scale: 1.24, rot: 0.50 },
        { x:  -6.0, z: -88.0, type: 'spruce', scale: 1.28, seed: 16 },

        // Центральная северная панорама: смешанная роща (шахматный двухъярусный ритм)
        { x:   2.5, z: -82.0, type: 'birch',  scale: 1.18, rot: 2.50 },
        { x:   8.0, z: -88.0, type: 'linden', scale: 1.26, rot: 1.40 },
        { x:  14.0, z: -81.0, type: 'spruce', scale: 1.26, seed: 17 },
        { x:  20.0, z: -87.0, type: 'birch',  scale: 1.20, rot: 0.85 },
        { x:  26.0, z: -80.0, type: 'linden', scale: 1.25, rot: 2.10 },
        { x:  32.0, z: -88.0, type: 'spruce', scale: 1.32, seed: 18 },
        { x:  38.0, z: -81.5, type: 'birch',  scale: 1.17, rot: 1.60 },
        { x:  44.0, z: -88.5, type: 'linden', scale: 1.24, rot: 0.30 },
        { x:  50.0, z: -81.0, type: 'spruce', scale: 1.28, seed: 19 },
        { x:  56.0, z: -88.0, type: 'birch',  scale: 1.18, rot: 2.80 },

        // Северо-восточный сектор: плавный переход к елям восточной аллеи у стоянки
        { x:  62.0, z: -81.5, type: 'linden', scale: 1.22, rot: 1.05 },
        { x:  67.5, z: -88.0, type: 'spruce', scale: 1.30, seed: 20 }
    ];

    northParkTrees.forEach((t, idx) => {
        if (t.type === 'birch') {
            addBirchTree(group, t.x, t.z, t.scale, t.rot);
        } else if (t.type === 'linden') {
            addLindenTree(group, t.x, t.z, t.scale, idx + 25);
        } else if (t.type === 'spruce') {
            addSpruceTree(group, t.x, t.z, t.scale, t.seed);
        }
    });
}


function buildStreetFurniture(group) {
    // Опоры освещения размещены СТРОГО на тротуарах и газонах за бордюрами (ноль столбов на проезжей части!)
    // 1) Фонари на тротуаре вдоль дороги (вне кармана остановки: бордюр на Z=28.2, фонарь на Z=27.0)
    // Фонарь у западного края на газоне вдоль дороги
        addStreetLamp(group, 52.0, 27.0, Math.PI / 2);
    addStreetLamp(group, 66.0, 27.0, Math.PI / 2);

    // 2) Фонари посадочной платформы остановки (бордюр кармана на Z=25.4, фонари на задней кромке платформы Z=22.0)
    addStreetLamp(group, 0.0, 22.0, Math.PI / 2);
    addStreetLamp(group, 24.0, 22.0, Math.PI / 2);
}

// ----------------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ГЕОМЕТРИИ
// ----------------------------------------------------

function createAsphaltTriangleGeometry(points, yTop = 0.02, depth = 0.14) {
    if (!points || points.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: depth,
        bevelEnabled: false
    });
    geom.rotateX(Math.PI / 2);
    geom.translate(0, yTop, 0);
    return geom;
}

function addAsphaltTriangle(group, points, material = MATERIALS.asphaltRoad, yTop = 0.02, depth = 0.14) {
    const geom = createAsphaltTriangleGeometry(points, yTop, depth);
    if (!geom) return null;
    if (group) {
        const mesh = new THREE.Mesh(geom, material);
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }
    return geom;
}

// Кэш геометрий сегментированных бордюрных камней (СТБ 1097-2012 / БР 100.30.15)
const _curbGeomCache = new Map();

function flushCurbBatch(group) {
    if (!_curbBatch || _curbBatch.length === 0) {
        _curbBatch = null;
        return;
    }

    const byGeom = new Map();
    for (const item of _curbBatch) {
        if (!byGeom.has(item.geom)) byGeom.set(item.geom, []);
        byGeom.get(item.geom).push(item);
    }

    const dummy = new THREE.Object3D();
    for (const [geom, items] of byGeom.entries()) {
        const instMesh = new THREE.InstancedMesh(geom, MATERIALS.curb, items.length);
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            dummy.position.set(it.bx, it.by, it.bz);
            dummy.rotation.set(0, it.rotY, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            instMesh.setMatrixAt(i, dummy.matrix);
        }
        instMesh.instanceMatrix.needsUpdate = true;
        instMesh.castShadow = true;
        instMesh.receiveShadow = true;
        group.add(instMesh);
    }

    _curbBatch = null;
}

function getCurbBlockGeometry(blockLen) {
    const key = Math.round(blockLen * 1000);
    if (_curbGeomCache.has(key)) return _curbGeomCache.get(key);

    const shape = new THREE.Shape();
    // Поперечный профиль бордюра: ширина 0.18 м, высота 0.20 м
    // X: от -0.09 (лицевая сторона) до +0.09 (тыльная сторона к тротуару)
    // Y: от -0.08 (заглубление в основание) до +0.10 (верхняя грань)
    // Фаска 45° на лицевой грани: от (-0.065, 0.10) до (-0.09, 0.075)
    shape.moveTo(-0.09, -0.08);
    shape.lineTo(0.09, -0.08);
    shape.lineTo(0.09, 0.10);      // тыльный верхний угол (заподлицо с тротуаром)
    shape.lineTo(-0.065, 0.10);    // начало фаски 45°
    shape.lineTo(-0.09, 0.075);    // нижний край фаски
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: blockLen,
        bevelEnabled: false
    });
    // Центрируем по оси выдавливания (Z)
    geom.translate(0, 0, -blockLen / 2);
    // Поворачиваем, чтобы ось выдавливания шла вдоль оси X (вдоль сегмента)
    geom.rotateY(Math.PI / 2);
    geom.computeVertexNormals();

    _curbGeomCache.set(key, geom);
    return geom;
}

function addCurbSegment(group, x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;

    const angle = Math.atan2(dz, dx);
    const targetBlockLen = 1.0; // Стандартный 1-метровый бордюрный камень
    const numBlocks = Math.max(1, Math.round(len / targetBlockLen));
    const blockPitch = len / numBlocks;
    const jointGap = 0.012; // Температурный шов 12 мм между блоками
    const actualBlockLen = Math.max(0.15, blockPitch - jointGap);

    const geom = getCurbBlockGeometry(actualBlockLen);

    for (let i = 0; i < numBlocks; i++) {
        const t = (i + 0.5) / numBlocks;
        const bx = x1 + dx * t;
        const bz = z1 + dz * t;

        if (_curbBatch) {
            _curbBatch.push({ bx, by: 0.02, bz, rotY: -angle, geom });
        } else {
            const curbMesh = new THREE.Mesh(geom, MATERIALS.curb);
            curbMesh.position.set(bx, 0.02, bz);
            curbMesh.rotation.y = -angle;
            curbMesh.castShadow = true;
            curbMesh.receiveShadow = true;
            group.add(curbMesh);
        }
    }
}


function addRoadStripe(group, x1, z1, x2, z2, width = 0.15, material = MATERIALS.roadMarkingWhite) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;

    const angle = Math.atan2(dz, dx);
    const geom = new THREE.PlaneGeometry(len, width);
    const mesh = new THREE.Mesh(geom, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = angle;
    mesh.position.set((x1 + x2) / 2, 0.025, (z1 + z2) / 2);
    group.add(mesh);
}

function addDashedLine(group, xStart, xEnd, z, dashLen = 3.0, gapLen = 3.0, width = 0.15, material = MATERIALS.roadMarkingWhite) {
    let curX = Math.min(xStart, xEnd);
    const maxVal = Math.max(xStart, xEnd);

    while (curX < maxVal) {
        const nextX = Math.min(curX + dashLen, maxVal);
        addRoadStripe(group, curX, z, nextX, z, width, material);
        curX += dashLen + gapLen;
    }
}

// Тактильная предупреждающая плитка (СТБ П 2443 / ГОСТ Р 52875)
function addTactileWarningStrip(group, x1, x2, z1, z2) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const geoms = [];
    const baseGeom = new THREE.BoxGeometry(w, 0.015, d);
    baseGeom.translate(cx, 0.065, cz);
    geoms.push(baseGeom);

    // Продольные направляющие тактильные рифы
    const numRibs = Math.max(3, Math.floor(d / 0.10));
    for (let r = 0; r < numRibs; r++) {
        const rz = (cz - d / 2 + 0.05) + r * (d - 0.10) / Math.max(1, numRibs - 1);
        const ribGeom = new THREE.BoxGeometry(w - 0.04, 0.008, 0.035);
        ribGeom.translate(cx, 0.075, rz);
        geoms.push(ribGeom);
    }

    const merged = mergeBufferGeometriesVanilla(geoms);
    const stripMesh = new THREE.Mesh(merged, MATERIALS.roadMarkingYellow);
    stripMesh.receiveShadow = true;
    group.add(stripMesh);
}



function addBusStopYellowZigzag(group, x1, x2, z1, z2) {
    // Желтая зигзагообразная разметка 1.17 (СТБ 1300-2014) строго в границах кармана
    // Бесшовная геометрия BufferGeometry с аналитическим митер-смещением (0 наложений, 0 щелей)
    const zInner = Math.min(z1, z2); // 25.80 (ближе к бордюру посадочной платформы)
    const zOuter = Math.max(z1, z2); // 27.80 (граница проезжей части)
    const deltaZ = zOuter - zInner;   // 2.00 м (размах зигзага)
    const length = x2 - x1;           // 42.0 м
    const numCycles = 24;             // 24 полуволны (12 полных циклов)
    const p = length / numCycles;     // 1.75 м (шаг по X)
    const w = 0.15;                   // нормальная ширина полосы (15 см)
    const y = 0.026;                  // возвышение над дорожным полотном

    const diagLen = Math.hypot(p, deltaZ); // S = sqrt(p^2 + deltaZ^2)
    // Митер-смещение вдоль оси Z в вершинах зигзага: M = (w * S) / (2 * p)
    const miterZ = (w * diagLen) / (2 * p);

    const vertices = [];
    const indices = [];

    // 1. Вершины непрерывной зигзагообразной ленты
    for (let k = 0; k <= numCycles; k++) {
        const xk = x1 + k * p;
        const zk = (k % 2 === 0) ? zInner : zOuter;

        // Пара вершин (внутренняя и внешняя) вдоль оси Z
        vertices.push(xk, y, zk - miterZ);
        vertices.push(xk, y, zk + miterZ);

        if (k < numCycles) {
            const base = k * 2;
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }
    }

    // 2. Начальная поперечная замыкающая линия на x1
    const endW = 0.18;
    const baseEnd1 = vertices.length / 3;
    vertices.push(
        x1 - endW / 2, y, zInner - miterZ,
        x1 + endW / 2, y, zInner - miterZ,
        x1 + endW / 2, y, zOuter + miterZ,
        x1 - endW / 2, y, zOuter + miterZ
    );
    indices.push(
        baseEnd1, baseEnd1 + 1, baseEnd1 + 2,
        baseEnd1, baseEnd1 + 2, baseEnd1 + 3
    );

    // 3. Конечная поперечная замыкающая линия на x2
    const baseEnd2 = vertices.length / 3;
    vertices.push(
        x2 - endW / 2, y, zInner - miterZ,
        x2 + endW / 2, y, zInner - miterZ,
        x2 + endW / 2, y, zOuter + miterZ,
        x2 - endW / 2, y, zOuter + miterZ
    );
    indices.push(
        baseEnd2, baseEnd2 + 1, baseEnd2 + 2,
        baseEnd2, baseEnd2 + 2, baseEnd2 + 3
    );

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, MATERIALS.roadMarkingYellow);
    mesh.receiveShadow = true;
    group.add(mesh);
}

function addBeveledBayCorners(group, x1, x2, z1, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);

    const cornerGeom = new THREE.BoxGeometry(len, 0.14, 0.8);
    const cornerMesh = new THREE.Mesh(cornerGeom, MATERIALS.asphaltRoad);
    cornerMesh.position.set((x1 + x2) / 2, -0.05, (z1 + z2) / 2);
    cornerMesh.rotation.y = -angle;
    group.add(cornerMesh);

    addCurbSegment(group, x1, z1, x2, z2);
}

// ==========================================
// M3: ПРОЦЕДУРНЫЕ 3D-МОДЕЛИ ДЕРЕВЬЕВ И БОТАНИЧЕСКОГО ОЗЕЛЕНЕНИЯ
// ==========================================

// Примечание: mergeBufferGeometriesVanilla определена и оптимизирована в js/helpers.js

// ----------------------------------------------------
// 1. БЕРЕЗА ЕВРОПЕЙСКАЯ (BETULA PENDULA)
// ----------------------------------------------------

function createBirchClusterGeometry(baseR, scaleX = 1.0, scaleY = 1.0, scaleZ = 1.0, droop = 0.25) {
    const geom = new THREE.IcosahedronGeometry(baseR, 3);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len > 0.0001) {
            const phi = Math.atan2(z, x);
            const theta = Math.acos(Math.max(-1, Math.min(1, y / len)));
            const noise = 1.0 + 0.14 * Math.sin(3 * theta + 2 * phi) + 0.10 * Math.cos(4 * phi - theta) + 0.05 * Math.sin(5 * theta);
            x = (x / len) * baseR * noise * scaleX;
            y = (y / len) * baseR * noise * scaleY;
            z = (z / len) * baseR * noise * scaleZ;
            if (y < 0) {
                y -= Math.abs(y) * droop;
            }
            pos.setXYZ(i, x, y, z);
        }
    }
    geom.computeVertexNormals();
    return geom;
}

let _cachedBirchGeoms = null;
function getBaseBirchGeometries() {
    if (_cachedBirchGeoms) return _cachedBirchGeoms;
    const scale = 1.0;
    const trunkH = 5.2;
    const radialSegs = 12;
    const heightSegs = 16;
    const rBase = 0.14;
    const rTop = 0.035;

    const trunkGeom = new THREE.CylinderGeometry(rTop, rBase, trunkH, radialSegs, heightSegs);
    const tPos = trunkGeom.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
        const yOrig = tPos.getY(i);
        const t = (yOrig + trunkH / 2) / trunkH;
        let x = tPos.getX(i);
        let z = tPos.getZ(i);

        if (t < 0.18) {
            const flare = Math.pow(1.0 - t / 0.18, 2) * 0.065;
            const curR = Math.sqrt(x * x + z * z);
            if (curR > 0.0001) {
                x += (x / curR) * flare;
                z += (z / curR) * flare;
            }
        }

        const dx = (0.22 * Math.sin(Math.PI * t * 0.85) + 0.10 * t * t);
        const dz = (0.15 * Math.sin(Math.PI * t * 1.20) - 0.06 * t);
        tPos.setXYZ(i, x + dx, yOrig, z + dz);
    }
    trunkGeom.computeVertexNormals();
    trunkGeom.translate(0, trunkH / 2, 0);

    const woodGeometries = [trunkGeom];

    function addLimb(tNorm, azimuth, pitchDeg, length, bRadius, tipRadius, curveDroop = 0.15) {
        const yStart = tNorm * trunkH;
        const dxStart = (0.22 * Math.sin(Math.PI * tNorm * 0.85) + 0.10 * tNorm * tNorm);
        const dzStart = (0.15 * Math.sin(Math.PI * tNorm * 1.20) - 0.06 * tNorm);

        const bGeom = new THREE.CylinderGeometry(tipRadius, bRadius, length, 8, 4);
        const bp = bGeom.attributes.position;
        for (let i = 0; i < bp.count; i++) {
            const s = (bp.getY(i) + length / 2) / length;
            const droopOff = Math.sin(s * Math.PI) * curveDroop;
            bp.setZ(i, bp.getZ(i) - droopOff);
        }
        bGeom.computeVertexNormals();
        bGeom.translate(0, length / 2, 0);

        const pitchRad = (pitchDeg * Math.PI) / 180;
        bGeom.rotateX(Math.PI / 2 - pitchRad);
        bGeom.rotateY(azimuth);
        bGeom.translate(dxStart, yStart, dzStart);

        woodGeometries.push(bGeom);
    }

    addLimb(0.42, 0.25, 48, 1.85, 0.038, 0.016, 0.18);
    addLimb(0.58, 2.15, 52, 1.60, 0.032, 0.014, 0.15);
    addLimb(0.70, 4.10, 58, 1.35, 0.026, 0.012, 0.12);
    addLimb(0.82, 5.70, 64, 1.10, 0.022, 0.010, 0.09);

    const lightClusters = [];
    const darkClusters = [];

    const c1 = createBirchClusterGeometry(0.95, 0.88, 1.25, 0.88, 0.15);
    c1.translate(0.18, 5.0, -0.12);
    lightClusters.push(c1);

    const c2 = createBirchClusterGeometry(0.90, 1.05, 0.85, 1.00, 0.28);
    c2.translate(0.80, 4.35, -0.45);
    lightClusters.push(c2);

    const c3 = createBirchClusterGeometry(1.10, 1.10, 0.85, 1.05, 0.25);
    c3.translate(-0.85, 3.80, 0.55);
    darkClusters.push(c3);

    const c4 = createBirchClusterGeometry(1.15, 1.05, 0.90, 1.10, 0.22);
    c4.translate(0.35, 3.60, 0.85);
    darkClusters.push(c4);

    const c5 = createBirchClusterGeometry(1.05, 1.15, 0.78, 1.10, 0.35);
    c5.translate(1.35, 2.75, 0.25);
    lightClusters.push(c5);

    const c6 = createBirchClusterGeometry(1.00, 1.12, 0.80, 1.08, 0.35);
    c6.translate(-1.20, 2.55, -0.45);
    lightClusters.push(c6);

    const c7 = createBirchClusterGeometry(1.25, 1.10, 0.95, 1.10, 0.18);
    c7.translate(0.05, 3.30, 0.05);
    darkClusters.push(c7);

    _cachedBirchGeoms = {
        wood: mergeBufferGeometriesVanilla(woodGeometries),
        lightFoliage: mergeBufferGeometriesVanilla(lightClusters),
        darkFoliage: mergeBufferGeometriesVanilla(darkClusters)
    };
    return _cachedBirchGeoms;
}

function createWhiteBirchTree(scale = 1.0, rotY = 0) {
    const treeGroup = new THREE.Group();
    treeGroup.rotation.y = rotY;
    treeGroup.scale.set(scale, scale, scale);

    const geoms = getBaseBirchGeometries();
    const trunkMesh = new THREE.Mesh(geoms.wood, MATERIALS.birchBark || MATERIALS.treeTrunk);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    const lightMesh = new THREE.Mesh(geoms.lightFoliage, MATERIALS.birchFoliageLight || MATERIALS.treeFoliageLight);
    lightMesh.castShadow = true;
    lightMesh.receiveShadow = true;
    treeGroup.add(lightMesh);

    const darkMesh = new THREE.Mesh(geoms.darkFoliage, MATERIALS.birchFoliage || MATERIALS.treeFoliage);
    darkMesh.castShadow = true;
    darkMesh.receiveShadow = true;
    treeGroup.add(darkMesh);

    return treeGroup;
}

function addBirchTree(group, x, z, scale = 1.0, rotY = 0, y = 0) {
    const tree = createWhiteBirchTree(scale, rotY);
    tree.position.set(x, y, z);
    group.add(tree);
    return tree;
}

// ----------------------------------------------------
// 2. ЛИПА МЕЛКОЛИСТНАЯ (TILIA CORDATA)
// ----------------------------------------------------

function createOrganicFoliageClusterGeometry(radius, detail = 2, seed = 0) {
    const geom = new THREE.DodecahedronGeometry(radius, detail);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const noise = Math.sin(vx * 2.6 + seed) * Math.cos(vy * 2.9 + seed * 1.3) * Math.sin(vz * 2.7)
                    + 0.35 * Math.sin(vx * 5.2 - seed) * Math.cos(vz * 5.5 + seed * 0.7);
        const factor = 1.0 + 0.12 * noise - 0.05 * (vy / radius);
        pos.setXYZ(i, vx * factor, vy * factor * 0.88, vz * factor);
    }
    geom.computeVertexNormals();
    return geom;
}

function addLindenTree(group, x, z, scale = 1.0, seed = 0, y = 0) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    // Ствол и скелетные ветви
    const flareH = 0.45 * scale;
    const flareGeom = new THREE.CylinderGeometry(0.20 * scale, 0.36 * scale, flareH, 14);
    flareGeom.translate(0, flareH / 2, 0);

    const trunkH = 1.75 * scale;
    const trunkGeom = new THREE.CylinderGeometry(0.16 * scale, 0.20 * scale, trunkH, 14);
    trunkGeom.rotateZ(-0.025);
    trunkGeom.translate(0.02 * scale, flareH + trunkH / 2, 0.01 * scale);

    const crotchY = flareH + trunkH;
    const boughs = [
        { az: 0.6,  elev: 0.75, len: 1.55 * scale, r: 0.10 * scale },
        { az: 2.2,  elev: 0.68, len: 1.65 * scale, r: 0.11 * scale },
        { az: 3.9,  elev: 0.78, len: 1.45 * scale, r: 0.095 * scale },
        { az: 5.4,  elev: 0.85, len: 1.75 * scale, r: 0.105 * scale }
    ];

    const woodGeoms = [flareGeom, trunkGeom];
    boughs.forEach(b => {
        const bGeom = new THREE.CylinderGeometry(b.r * 0.55, b.r, b.len, 10);
        bGeom.translate(0, b.len / 2, 0);
        bGeom.rotateZ(Math.PI / 2 - b.elev);
        bGeom.rotateY(-b.az);
        bGeom.translate(
            Math.cos(b.az) * (b.len * 0.42 * Math.cos(b.elev)),
            crotchY + b.len * 0.48 * Math.sin(b.elev),
            Math.sin(b.az) * (b.len * 0.42 * Math.cos(b.elev))
        );
        woodGeoms.push(bGeom);
    });

    const mergedWood = mergeBufferGeometriesVanilla(woodGeoms);
    const trunkMesh = new THREE.Mesh(mergedWood, MATERIALS.lindenTrunk || MATERIALS.treeTrunk);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // Многоярусная крона (7 облаков листвы с повышенной детализацией)
    const lightClusters = [];
    const darkClusters = [];

    const clusters = [
        { x: 0.0, y: 4.6 * scale, z: 0.0, r: 1.60 * scale, isDark: false, s: 1 },
        { x:  1.20 * scale, y: 3.7 * scale, z: -0.70 * scale, r: 1.35 * scale, isDark: false, s: 2 },
        { x:  1.30 * scale, y: 3.5 * scale, z:  0.90 * scale, r: 1.40 * scale, isDark: false, s: 3 },
        { x: -1.10 * scale, y: 3.6 * scale, z:  1.05 * scale, r: 1.30 * scale, isDark: false, s: 4 },
        { x: -1.25 * scale, y: 3.8 * scale, z: -0.60 * scale, r: 1.25 * scale, isDark: false, s: 5 },
        { x:  0.20 * scale, y: 2.8 * scale, z:  1.35 * scale, r: 1.10 * scale, isDark: true,  s: 6 },
        { x: -0.80 * scale, y: 2.9 * scale, z: -1.10 * scale, r: 1.05 * scale, isDark: true,  s: 7 }
    ];

    clusters.forEach(c => {
        const cGeom = createOrganicFoliageClusterGeometry(c.r, 2, c.s + seed);
        cGeom.rotateY((c.s * 1.7) + seed);
        cGeom.translate(c.x, c.y, c.z);
        if (c.isDark) darkClusters.push(cGeom);
        else lightClusters.push(cGeom);
    });

    if (lightClusters.length > 0) {
        const mergedLight = mergeBufferGeometriesVanilla(lightClusters);
        const lightMesh = new THREE.Mesh(mergedLight, MATERIALS.lindenFoliage || MATERIALS.treeFoliage);
        lightMesh.castShadow = true;
        lightMesh.receiveShadow = true;
        treeGroup.add(lightMesh);
    }
    if (darkClusters.length > 0) {
        const mergedDark = mergeBufferGeometriesVanilla(darkClusters);
        const darkMesh = new THREE.Mesh(mergedDark, MATERIALS.lindenFoliageDark || MATERIALS.treeFoliage);
        darkMesh.castShadow = true;
        darkMesh.receiveShadow = true;
        treeGroup.add(darkMesh);
    }

    group.add(treeGroup);
    return treeGroup;
}

// ----------------------------------------------------
// 3. ЕЛЬ ОБЫКНОВЕННАЯ (PICEA ABIES)
// ----------------------------------------------------

function createSpruceTierGeometry(baseRadius, height, numLobes, droopAmount, rotationOffset = 0) {
    const radialSegs = Math.max(36, numLobes * 6);
    const heightSegs = 6;
    const geom = new THREE.ConeGeometry(baseRadius, height, radialSegs, heightSegs, true);
    const pos = geom.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        const vFactor = THREE.MathUtils.clamp((height / 2 - y) / height, 0.0, 1.0);
        if (vFactor > 0.05) {
            const angle = Math.atan2(z, x) + rotationOffset;
            const r = Math.hypot(x, z);

            const lobeMod = 1.0 + 0.22 * Math.cos(numLobes * angle);
            const droop = droopAmount * Math.pow(vFactor, 1.8) * (0.7 + 0.3 * Math.cos(numLobes * angle));

            const newR = r * lobeMod;
            x = newR * Math.cos(angle - rotationOffset);
            z = newR * Math.sin(angle - rotationOffset);
            y -= droop;

            pos.setXYZ(i, x, y, z);
        }
    }
    geom.computeVertexNormals();
    return geom;
}

function addSpruceTree(group, x, z, scale = 1.0, seed = 0, y = 0) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    // Ствол и шейка
    const trunkH = 7.2 * scale;
    const trunkGeom = new THREE.CylinderGeometry(0.05 * scale, 0.22 * scale, trunkH, 12);
    trunkGeom.translate(0, trunkH / 2, 0);

    const collarH = 0.30 * scale;
    const collarGeom = new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, collarH, 12);
    collarGeom.translate(0, collarH / 2, 0);

    const mergedTrunk = mergeBufferGeometriesVanilla([collarGeom, trunkGeom]);
    const trunkMesh = new THREE.Mesh(mergedTrunk, MATERIALS.spruceTrunk || MATERIALS.treeTrunk);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // 6 ярусов хвои
    const darkTiers = [];
    const mainTiers = [];

    const tiers = [
        { y: 1.35 * scale, h: 1.45 * scale, r: 2.10 * scale, lobes: 8, droop: 0.35 * scale, rot: 0.1, isDark: true },
        { y: 2.45 * scale, h: 1.35 * scale, r: 1.80 * scale, lobes: 8, droop: 0.30 * scale, rot: 0.5, isDark: true },
        { y: 3.55 * scale, h: 1.25 * scale, r: 1.45 * scale, lobes: 7, droop: 0.24 * scale, rot: 0.9, isDark: false },
        { y: 4.65 * scale, h: 1.15 * scale, r: 1.10 * scale, lobes: 7, droop: 0.18 * scale, rot: 1.4, isDark: false },
        { y: 5.70 * scale, h: 1.00 * scale, r: 0.75 * scale, lobes: 6, droop: 0.12 * scale, rot: 1.9, isDark: false },
        { y: 6.55 * scale, h: 0.85 * scale, r: 0.44 * scale, lobes: 6, droop: 0.07 * scale, rot: 2.4, isDark: false }
    ];

    tiers.forEach(t => {
        const tGeom = createSpruceTierGeometry(t.r, t.h, t.lobes, t.droop, t.rot + seed);
        tGeom.translate(0, t.y + t.h / 2, 0);
        if (t.isDark) darkTiers.push(tGeom);
        else mainTiers.push(tGeom);
    });

    // Вершинный побег (apical spire)
    const spireH = 0.65 * scale;
    const spireGeom = new THREE.ConeGeometry(0.16 * scale, spireH, 8);
    spireGeom.translate(0, 7.15 * scale + spireH / 2, 0);
    mainTiers.push(spireGeom);

    const mergedDarkTiers = mergeBufferGeometriesVanilla(darkTiers);
    const darkTierMesh = new THREE.Mesh(mergedDarkTiers, MATERIALS.spruceNeedleDark || MATERIALS.treeFoliage);
    darkTierMesh.castShadow = true;
    darkTierMesh.receiveShadow = true;
    treeGroup.add(darkTierMesh);

    const mergedMainTiers = mergeBufferGeometriesVanilla(mainTiers);
    const mainTierMesh = new THREE.Mesh(mergedMainTiers, MATERIALS.spruceNeedle || MATERIALS.treeFoliage);
    mainTierMesh.castShadow = true;
    mainTierMesh.receiveShadow = true;
    treeGroup.add(mainTierMesh);

    group.add(treeGroup);
    return treeGroup;
}

// ----------------------------------------------------
// 4. ЖИВЫЕ ИЗГОРОДИ, ПРИСТВОЛЬНЫЕ КРУГИ И КУСТАРНИКИ
// ----------------------------------------------------

function addBotanicalHedgeSegment(group, x1, z1, x2, z2, height = 0.85, width = 0.55) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const angle = Math.atan2(dz, dx);

    const hedgeGroup = new THREE.Group();
    hedgeGroup.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    hedgeGroup.rotation.y = -angle;

    const xSegs = Math.max(4, Math.round(len * 3));
    const geom = new THREE.BoxGeometry(len, height, width, xSegs, 5, 4);
    const pos = geom.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        if (y > 0) {
            const zNorm = z / (width / 2);
            y -= (zNorm * zNorm) * 0.06;
            const noise = Math.sin(x * 8.5 + z * 12.0) * 0.032 + Math.cos(y * 11.0 + x * 5.5) * 0.022;
            pos.setX(i, x + noise * 0.4);
            pos.setY(i, y + Math.max(-0.02, noise));
            pos.setZ(i, z + noise * 0.4);
        }
    }
    geom.computeVertexNormals();
    geom.translate(0, height / 2, 0);

    const tuftCount = Math.max(3, Math.round(len * 2));
    const hedgeGeoms = [geom];
    for (let t = 0; t < tuftCount; t++) {
        const tuftGeom = new THREE.IcosahedronGeometry(0.14, 1);
        const tx = (((t * 17.3) % (len * 0.8)) - (len * 0.4));
        const tz = (((t * 31.1) % (width * 0.6)) - (width * 0.3));
        const ty = height - 0.02 + ((t * 7) % 10) * 0.008;
        tuftGeom.scale(0.9 + (t % 3) * 0.15, 0.8 + (t % 4) * 0.1, 0.9 + (t % 3) * 0.15);
        tuftGeom.translate(tx, ty, tz);
        hedgeGeoms.push(tuftGeom);
    }

    const mergedHedge = mergeBufferGeometriesVanilla(hedgeGeoms);
    const hedgeMesh = new THREE.Mesh(mergedHedge, MATERIALS.hedgeFoliage);
    hedgeMesh.castShadow = true;
    hedgeMesh.receiveShadow = true;
    hedgeGroup.add(hedgeMesh);

    group.add(hedgeGroup);
}

function addTreeRing(group, x, z, radius = 1.05, y = 0) {
    const ringGroup = new THREE.Group();
    ringGroup.position.set(x, y, z);

    // 1. Приподнятый каменный бордюр приствольного круга
    const ringGeom = new THREE.TorusGeometry(radius, 0.06, 8, 28);
    ringGeom.rotateX(Math.PI / 2);
    ringGeom.translate(0, 0.035, 0);
    const ringMesh = new THREE.Mesh(ringGeom, MATERIALS.curb);
    ringMesh.castShadow = true;
    ringMesh.receiveShadow = true;
    ringGroup.add(ringMesh);

    // 2. Слой органической коры / мульчи
    const mulchGeom = new THREE.CylinderGeometry(radius - 0.02, radius - 0.02, 0.04, 24);
    mulchGeom.translate(0, 0.02, 0);
    const mulchMesh = new THREE.Mesh(mulchGeom, MATERIALS.soilMulch);
    mulchMesh.receiveShadow = true;
    ringGroup.add(mulchMesh);

    // Buttress roots removed per user request (trees sit cleanly in mulch ring)
    group.add(ringGroup);
}

function addDecorativeShrub(group, x, z, type = 'flowering', scale = 1.0, y = 0) {
    const shrubGroup = new THREE.Group();
    shrubGroup.position.set(x, y, z);
    shrubGroup.scale.set(scale, scale, scale);

    if (type === 'flowering') {
        const stemCount = 4;
        const stemGeoms = [];
        for (let s = 0; s < stemCount; s++) {
            const angle = (s / stemCount) * Math.PI * 2 + 0.15;
            const stemGeom = new THREE.CylinderGeometry(0.014, 0.022, 0.42, 6);
            stemGeom.translate(0, 0.21, 0);
            stemGeom.rotateZ(Math.cos(angle) * 0.28);
            stemGeom.rotateX(Math.sin(angle) * 0.28);
            stemGeom.translate(Math.cos(angle) * 0.08, 0, Math.sin(angle) * 0.08);
            stemGeoms.push(stemGeom);
        }
        const mergedStems = mergeBufferGeometriesVanilla(stemGeoms);
        const stemsMesh = new THREE.Mesh(mergedStems, MATERIALS.treeTrunk);
        stemsMesh.castShadow = true;
        shrubGroup.add(stemsMesh);

        const clusterOffsets = [
            [0, 0.62, 0, 0.48],
            [0.26, 0.50, 0.18, 0.38],
            [-0.24, 0.52, -0.16, 0.39],
            [-0.20, 0.48, 0.22, 0.36],
            [0.22, 0.46, -0.22, 0.37]
        ];
        const foliageGeoms = [];
        const blossomGeoms = [];
        clusterOffsets.forEach(c => {
            const cGeom = new THREE.IcosahedronGeometry(c[3], 2);
            cGeom.translate(c[0], c[1], c[2]);
            foliageGeoms.push(cGeom);

            const bGeom = new THREE.SphereGeometry(c[3] * 0.35, 12, 10);
            bGeom.translate(c[0], c[1] + c[3] * 0.72, c[2]);
            blossomGeoms.push(bGeom);
        });

        const mergedFoliage = mergeBufferGeometriesVanilla(foliageGeoms);
        const foliageMesh = new THREE.Mesh(mergedFoliage, MATERIALS.shrubFoliageDeciduous);
        foliageMesh.castShadow = true;
        foliageMesh.receiveShadow = true;
        shrubGroup.add(foliageMesh);

    } else {
        const foliageGeoms = [];
        const tiers = 3;
        for (let t = 0; t < tiers; t++) {
            const r = 0.65 - t * 0.12;
            const y = 0.16 + t * 0.14;
            const tierGeom = new THREE.ConeGeometry(r, 0.22, 16);
            tierGeom.rotateY(t * 0.7);
            tierGeom.translate(0, y, 0);
            foliageGeoms.push(tierGeom);
        }
        const mergedConifer = mergeBufferGeometriesVanilla(foliageGeoms);
        const coniferMesh = new THREE.Mesh(mergedConifer, MATERIALS.shrubFoliageConifer);
        coniferMesh.castShadow = true;
        coniferMesh.receiveShadow = true;
        shrubGroup.add(coniferMesh);
    }

    group.add(shrubGroup);
}

// Универсальный диспетчер для обратной совместимости
function addArchitecturalTree(group, x, z, scale = 1.0, isRound = true) {
    if (isRound) {
        return addLindenTree(group, x, z, scale);
    } else {
        return addSpruceTree(group, x, z, scale);
    }
}

function addStreetLamp(group, x, z, rotY = 0) {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(x, 0, z);
    lampGroup.rotation.y = rotY;

    const poleH = 5.2;
    const poleGeom = new THREE.CylinderGeometry(0.06, 0.09, poleH, 8);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    lampGroup.add(poleMesh);

    const armGeom = new THREE.BoxGeometry(1.2, 0.05, 0.05);
    const armMesh = new THREE.Mesh(armGeom, MATERIALS.poleMetal);
    armMesh.position.set(0.5, poleH - 0.1, 0);
    lampGroup.add(armMesh);

    const fixtureGeom = new THREE.BoxGeometry(0.55, 0.08, 0.18);
    const fixtureMesh = new THREE.Mesh(fixtureGeom, MATERIALS.shelterRoof);
    fixtureMesh.position.set(1.0, poleH - 0.15, 0);
    lampGroup.add(fixtureMesh);

    group.add(lampGroup);
}

// Шлагбаум поперек проезда с севера на юг (поперек X)
function addBarrierGate(group, x, z, roadWidth = 5.5) {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(x - roadWidth / 2 + 0.3, 0, z);

    const postGeom = new THREE.BoxGeometry(0.35, 1.1, 0.35);
    const postMesh = new THREE.Mesh(postGeom, MATERIALS.signBlue);
    postMesh.position.y = 0.55;
    postMesh.castShadow = true;
    gateGroup.add(postMesh);

    const armLen = roadWidth - 0.8;
    const armGeom = new THREE.BoxGeometry(armLen, 0.08, 0.05);
    const armMesh = new THREE.Mesh(armGeom, MATERIALS.signWhite);
    armMesh.position.set(armLen / 2 + 0.15, 0.9, 0);
    gateGroup.add(armMesh);

    const stripeCount = 4;
    for (let i = 0; i < stripeCount; i++) {
        const sGeom = new THREE.BoxGeometry(armLen / (stripeCount * 2), 0.09, 0.06);
        const sMesh = new THREE.Mesh(sGeom, MATERIALS.signRed);
        sMesh.position.set(0.25 + (i * 2 + 1) * (armLen / (stripeCount * 2)), 0.9, 0);
        gateGroup.add(sMesh);
    }

    group.add(gateGroup);
}

// Шлагбаум поперек проезда с запада на восток (поперек Z)
function addBarrierGateRotated(group, x, z, roadWidth = 5.0) {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(x, 0, z - roadWidth / 2 + 0.3);

    const postGeom = new THREE.BoxGeometry(0.35, 1.1, 0.35);
    const postMesh = new THREE.Mesh(postGeom, MATERIALS.signBlue);
    postMesh.position.y = 0.55;
    postMesh.castShadow = true;
    gateGroup.add(postMesh);

    const armLen = roadWidth - 0.8;
    const armGeom = new THREE.BoxGeometry(0.05, 0.08, armLen);
    const armMesh = new THREE.Mesh(armGeom, MATERIALS.signWhite);
    armMesh.position.set(0, 0.9, armLen / 2 + 0.15);
    gateGroup.add(armMesh);

    const stripeCount = 4;
    for (let i = 0; i < stripeCount; i++) {
        const sGeom = new THREE.BoxGeometry(0.06, 0.09, armLen / (stripeCount * 2));
        const sMesh = new THREE.Mesh(sGeom, MATERIALS.signRed);
        sMesh.position.set(0, 0.9, 0.25 + (i * 2 + 1) * (armLen / (stripeCount * 2)));
        gateGroup.add(sMesh);
    }

    group.add(gateGroup);
}

function addPedestrianCrossingSign(group, x, z, rotY = 0) {
    const signGroup = new THREE.Group();
    signGroup.position.set(x, 0, z);
    signGroup.rotation.y = rotY;

    // 1. Оцинкованная цилиндрическая стойка (18 сегментов)
    const poleH = 3.2;
    const poleGeom = new THREE.CylinderGeometry(0.038, 0.038, poleH, 18);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    signGroup.add(poleMesh);

    // 2. Литой опорный фланец с анкерами в основании
    const flangeGeom = new THREE.CylinderGeometry(0.075, 0.09, 0.08, 18);
    const flangeMesh = new THREE.Mesh(flangeGeom, MATERIALS.poleMetal);
    flangeMesh.position.y = 0.04;
    signGroup.add(flangeMesh);

    const plateGeom = new THREE.BoxGeometry(0.18, 0.02, 0.18);
    const plateMesh = new THREE.Mesh(plateGeom, MATERIALS.poleMetal);
    plateMesh.position.y = 0.01;
    signGroup.add(plateMesh);

    // 3. Верхний защитный колпак стойки
    const capGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.025, 18);
    const capMesh = new THREE.Mesh(capGeom, MATERIALS.poleMetal);
    capMesh.position.y = poleH + 0.012;
    signGroup.add(capMesh);

    // 4. Хомуты крепления на стойку и монтажные кронштейны
    const clampGeom = new THREE.CylinderGeometry(0.044, 0.044, 0.035, 16);
    const clampTop = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clampTop.position.set(0, 2.85, 0);
    signGroup.add(clampTop);

    const clampBot = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clampBot.position.set(0, 2.45, 0);
    signGroup.add(clampBot);

    // Выносные кронштейны-проставки (смещают щит знака вперед от стойки: стойка Z in [-0.038, 0.038], щит Z >= 0.050)
    const standoffGeom = new THREE.BoxGeometry(0.04, 0.03, 0.055);
    const standoffTop = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoffTop.position.set(0, 2.85, 0.025);
    signGroup.add(standoffTop);

    const standoffBot = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoffBot.position.set(0, 2.45, 0.025);
    signGroup.add(standoffBot);

    // Горизонтальные монтажные траверсы
    const railGeom = new THREE.BoxGeometry(0.60, 0.03, 0.02);
    const railTop = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railTop.position.set(0, 2.85, 0.050);
    signGroup.add(railTop);

    const railBot = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railBot.position.set(0, 2.45, 0.050);
    signGroup.add(railBot);

    // 6. Основной синий корпус знака 5.19
    const trayGeom = new THREE.BoxGeometry(0.605, 0.605, 0.014);
    const trayMesh = new THREE.Mesh(trayGeom, MATERIALS.signBlue);
    trayMesh.position.set(0, 2.65, 0.060);
    signGroup.add(trayMesh);

    // 7. Лицевая панель с векторным силуэтом пешехода (СТБ 5.19)
    const faceGeom = new THREE.PlaneGeometry(0.60, 0.60);
    const faceMat = MATERIALS.pedestrianSign || MATERIALS.signBlue;
    const faceMesh = new THREE.Mesh(faceGeom, faceMat);
    faceMesh.position.set(0, 2.65, 0.078);
    signGroup.add(faceMesh);

    // 8. Обратная сторона знака (двусторонний знак для встречного потока)
    const backFaceMat = MATERIALS.pedestrianSignRight || MATERIALS.pedestrianSign || MATERIALS.signBlue;
    const backFaceMesh = new THREE.Mesh(faceGeom, backFaceMat);
    backFaceMesh.rotation.y = Math.PI;
    backFaceMesh.position.set(0, 2.65, 0.042);
    signGroup.add(backFaceMesh);

    group.add(signGroup);
}

function addBusStopSign(group, x, z) {
    const signGroup = new THREE.Group();
    signGroup.position.set(x, 0, z);

    // 1. Оцинкованная цилиндрическая стойка (18 сегментов)
    const poleH = 3.1;
    const poleGeom = new THREE.CylinderGeometry(0.038, 0.038, poleH, 18);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    signGroup.add(poleMesh);

    // 2. Литой опорный фланец с анкерными болтами в основании
    const flangeGeom = new THREE.CylinderGeometry(0.075, 0.09, 0.08, 18);
    const flangeMesh = new THREE.Mesh(flangeGeom, MATERIALS.poleMetal);
    flangeMesh.position.y = 0.04;
    signGroup.add(flangeMesh);

    const plateGeom = new THREE.BoxGeometry(0.18, 0.02, 0.18);
    const plateMesh = new THREE.Mesh(plateGeom, MATERIALS.poleMetal);
    plateMesh.position.y = 0.01;
    signGroup.add(plateMesh);

    // 3. Верхний защитный колпак стойки
    const capGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.025, 18);
    const capMesh = new THREE.Mesh(capGeom, MATERIALS.poleMetal);
    capMesh.position.y = poleH + 0.012;
    signGroup.add(capMesh);

    // 4. Хомуты крепления на стойку и монтажные кронштейны
    const clampGeom = new THREE.CylinderGeometry(0.044, 0.044, 0.035, 16);
    const clamp1 = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clamp1.position.set(0, 2.75, 0);
    signGroup.add(clamp1);

    const clamp2 = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clamp2.position.set(0, 2.35, 0);
    signGroup.add(clamp2);

    // Выносные кронштейны-проставки (смещают щит вперед от стойки)
    const standoffGeom = new THREE.BoxGeometry(0.04, 0.03, 0.055);
    const standoff1 = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoff1.position.set(0, 2.75, 0.025);
    signGroup.add(standoff1);

    const standoff2 = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoff2.position.set(0, 2.35, 0.025);
    signGroup.add(standoff2);

    // Горизонтальные монтажные рейки
    const railGeom = new THREE.BoxGeometry(0.48, 0.03, 0.02);
    const railTop = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railTop.position.set(0, 2.75, 0.050);
    signGroup.add(railTop);

    const railBot = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railBot.position.set(0, 2.35, 0.050);
    signGroup.add(railBot);

    // 5. Алюминиевый короб знака с отбортовкой
    const trayGeom = new THREE.BoxGeometry(0.52, 0.76, 0.018);
    const trayMesh = new THREE.Mesh(trayGeom, MATERIALS.signBlue);
    trayMesh.position.set(0, 2.55, 0.062);
    trayMesh.castShadow = true;
    signGroup.add(trayMesh);

    // 6. Лицевая панель со знаком СТБ 5.16 «Остановка автобуса»
    const faceGeom = new THREE.PlaneGeometry(0.50, 0.74);
    const faceMat = MATERIALS.busStopSign || MATERIALS.signBlue;
    const faceMesh = new THREE.Mesh(faceGeom, faceMat);
    faceMesh.position.set(0, 2.55, 0.072);
    signGroup.add(faceMesh);

    // Двусторонняя видимость знака для пассажиров на платформе
    const backFaceMesh = new THREE.Mesh(faceGeom, faceMat);
    backFaceMesh.rotation.y = Math.PI;
    backFaceMesh.position.set(0, 2.55, 0.051);
    signGroup.add(backFaceMesh);

    // Timetable on sign post removed per user request (only standard sign 5.16)
    group.add(signGroup);
}

window.buildTerritory = buildTerritory;


function buildRingRoadAroundCollege(group) {
    const targetGroup = group || window.roadNetworkGroup || (typeof roadNetworkGroup !== 'undefined' ? roadNetworkGroup : null);
    if (!targetGroup) return;
    clearAndDisposeGroup(targetGroup);
    const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');

    // Материалы для упрощенной дорожной сети
    const minimalRoadSurfaceMat = (typeof MATERIALS !== 'undefined' && MATERIALS.minimalRoadSurface) ? MATERIALS.minimalRoadSurface : new THREE.MeshStandardMaterial({
        color: isDark ? 0x181e28 : 0xc8d1dc,
        roughness: 0.95,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
    });

    const roadLineMat = (typeof MATERIALS !== 'undefined' && MATERIALS.roadContourLine) ? MATERIALS.roadContourLine : new THREE.LineBasicMaterial({
        color: isDark ? 0x94a3b8 : 0x334155,
        linewidth: 1
    });

    const roadCenterLineMat = (typeof MATERIALS !== 'undefined' && MATERIALS.roadCenterLine) ? MATERIALS.roadCenterLine : new THREE.LineBasicMaterial({
        color: isDark ? 0x475569 : 0x64748b,
        linewidth: 1
    });

    const ySurface = -0.05;
    const yLine = -0.048;
    const yCenter = -0.046;

    function addRoadRibbon(x1, z1, x2, z2) {
        const xMin = Math.min(x1, x2);
        const xMax = Math.max(x1, x2);
        const zMin = Math.min(z1, z2);
        const zMax = Math.max(z1, z2);
        const w = xMax - xMin;
        const d = zMax - zMin;
        const geom = new THREE.PlaneGeometry(w, d);
        const mesh = new THREE.Mesh(geom, minimalRoadSurfaceMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((xMin + xMax) / 2, ySurface, (zMin + zMax) / 2);
        mesh.receiveShadow = false;
        targetGroup.add(mesh);
    }

    function addEdge(x1, z1, x2, z2) {
        const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x1, yLine, z1),
            new THREE.Vector3(x2, yLine, z2)
        ]);
        const line = new THREE.Line(geom, roadLineMat);
        targetGroup.add(line);
    }

    const dashSegments = [];
    function addCenterDashes(x1, z1, x2, z2, dashLen = 3.0, gapLen = 2.5) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const totalLen = Math.hypot(dx, dz);
        if (totalLen < 0.5) return;
        const ux = dx / totalLen;
        const uz = dz / totalLen;
        let dist = 0;
        while (dist < totalLen) {
            const segLen = Math.min(dashLen, totalLen - dist);
            dashSegments.push(
                new THREE.Vector3(x1 + ux * dist, yCenter, z1 + uz * dist),
                new THREE.Vector3(x1 + ux * (dist + segLen), yCenter, z1 + uz * (dist + segLen))
            );
            dist += dashLen + gapLen;
        }
    }

    // ----------------------------------------------------
    // Габариты и контуры проездов
    // ----------------------------------------------------
    // Внутренний двор между корпусами 2, 3 и 4:
    const innerXWest = 17.5;
    const innerXEast = 22.5;
    const innerZSouth = -18.2;
    const innerZNorth = -23.2;

    // Восточный проезд:
    const eastRoadX1 = 72.0;
    const eastRoadX2 = 77.0;

    // Северный проезд и подъезд к гаражу:
    const northRoadZ1 = -71.5;
    const northRoadZ2 = -66.5;
    const northWestEnd = 16.5; // Как в 3D-виде — отходит в сторону гаража, но не врезается в него
    const northExitZ = -75.5;  // Небольшое продление выезда на север (~1 см на карте, без тупика)

    // Главная южная улица:
    const mainRoadZ1 = 28.5;
    const mainRoadZ2 = 38.5;
    const mainXStart = -35.0;
    const mainXEnd = 88.0;

    // 1. Поверхности проездов
    // Южная улица
    addRoadRibbon(mainXStart, mainRoadZ1, mainXEnd, mainRoadZ2);
    // Восточный проезд
    addRoadRibbon(eastRoadX1, northRoadZ1, eastRoadX2, mainRoadZ1);
    // Короткое продление выезда на север за пределы забора:
    addRoadRibbon(eastRoadX1, northExitZ, eastRoadX2, northRoadZ1);
    // Северный проезд (от отвода у гаража X = 16.5 до восточного проезда X = 77.0)
    addRoadRibbon(northWestEnd, northRoadZ1, eastRoadX2, northRoadZ2);
    // Южный внутренний проезд (между К2 и К4)
    addRoadRibbon(innerXEast, innerZNorth, eastRoadX1, innerZSouth);
    // Западный внутренний проезд (между К3 и К4)
    addRoadRibbon(innerXWest, northRoadZ2, innerXEast, innerZSouth);

    // 2. Линии контура дорог
    // Внутренний контур двора:
    addEdge(innerXEast, northRoadZ2, innerXEast, innerZNorth);
    addEdge(innerXEast, innerZNorth, eastRoadX1, innerZNorth);
    addEdge(innerXWest, northRoadZ2, innerXWest, innerZSouth);
    addEdge(innerXWest, innerZSouth, eastRoadX1, innerZSouth);
    addEdge(innerXWest, innerZSouth, innerXEast, innerZSouth);

    // Восточный проезд и выезд на север:
    // Восточная кромка (доходит до northExitZ, открытый конец БЕЗ поперечного тупика):
    addEdge(eastRoadX2, mainRoadZ1, eastRoadX2, northExitZ);
    // Западная кромка выезда на север (открытый конец БЕЗ поперечного тупика):
    addEdge(eastRoadX1, northRoadZ1, eastRoadX1, northExitZ);
    // Внутренняя (западная) кромка восточного проезда:
    addEdge(eastRoadX1, mainRoadZ1, eastRoadX1, innerZSouth);
    addEdge(eastRoadX1, innerZNorth, eastRoadX1, northRoadZ2);

    // Северный проезд и отвод у гаража:
    // Северная внешняя кромка (до восточного проезда X = 72.0, перекресток открыт):
    addEdge(northWestEnd, northRoadZ1, eastRoadX1, northRoadZ1);
    // Без тупиковой поперечины на торце (открытый выезд к гаражу)
    // Южная кромка отвода у двора:
    addEdge(northWestEnd, northRoadZ2, innerXWest, northRoadZ2);
    // Южная кромка северного проезда вдоль Корпуса 4:
    addEdge(innerXEast, northRoadZ2, eastRoadX1, northRoadZ2);

    // Южная главная улица:
    addEdge(mainXStart, mainRoadZ1, eastRoadX1, mainRoadZ1);
    addEdge(eastRoadX2, mainRoadZ1, mainXEnd, mainRoadZ1);
    addEdge(mainXStart, mainRoadZ2, mainXEnd, mainRoadZ2);

    // 3. Осевая разметка
    const showCenterline = (typeof STATE !== 'undefined' && typeof STATE.showRoadCenterline === 'boolean')
        ? STATE.showRoadCenterline
        : (typeof ROAD_SHOW_CENTERLINE !== 'undefined' ? ROAD_SHOW_CENTERLINE === 1 : true);

    if (showCenterline) {
        addCenterDashes(mainXStart + 2.0, 33.5, mainXEnd - 2.0, 33.5, 3.0, 2.5);
        addCenterDashes(74.5, mainRoadZ1, 74.5, northExitZ, 3.0, 2.5);
        addCenterDashes(northWestEnd + 1.5, -69.0, eastRoadX1 - 1.0, -69.0, 3.0, 2.5);
        addCenterDashes(innerXEast + 1.0, -20.7, eastRoadX1 - 1.0, -20.7, 2.5, 2.0);
        addCenterDashes(20.0, northRoadZ2 + 1.0, 20.0, -20.7, 2.5, 2.0);

        if (dashSegments.length > 0) {
            const centerGeom = new THREE.BufferGeometry().setFromPoints(dashSegments);
            const centerLines = new THREE.LineSegments(centerGeom, roadCenterLineMat);
            targetGroup.add(centerLines);
        }
    }
}

window.buildRingRoadAroundCollege = buildRingRoadAroundCollege;
window.createWhiteBirchTree = createWhiteBirchTree;
window.addBirchTree = addBirchTree;
window.addLindenTree = addLindenTree;
window.addSpruceTree = addSpruceTree;
window.addBotanicalHedgeSegment = addBotanicalHedgeSegment;
window.addTreeRing = addTreeRing;
window.addDecorativeShrub = addDecorativeShrub;
window.buildCampusBench = buildCampusBench;
window.buildParkWasteBin = buildParkWasteBin;
window.buildBicycleStation = buildBicycleStation;
window.buildPedestrianBollards = buildPedestrianBollards;
window.buildForecourtDualTonePaving = buildForecourtDualTonePaving;
window.buildPromenadeAndForecourtAmenities = buildPromenadeAndForecourtAmenities;

// ==========================================
// ПЕШЕХОДНЫЙ И ТРАНСПОРТНЫЙ СВЕТОФОР С КНОПКОЙ ВЫЗОВА
// ==========================================
function addPedestrianTrafficLight(group, x, z, rotRoadY = 0, rotPedY = 0, rotBtnY = Math.PI, hasButton = true) {
    const lightGroup = new THREE.Group();
    lightGroup.position.set(x, 0, z);

    // 1. Оцинкованная восьмигранная/коническая мачта светофора
    const poleH = 4.3;
    const poleGeom = new THREE.CylinderGeometry(0.045, 0.08, poleH, 16);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    lightGroup.add(poleMesh);

    // Опорный фланец с 4 анкерными шпильками и гайками
    const flangeGeom = new THREE.BoxGeometry(0.28, 0.025, 0.28);
    const flangeMesh = new THREE.Mesh(flangeGeom, MATERIALS.poleMetal);
    flangeMesh.position.y = 0.012;
    lightGroup.add(flangeMesh);

    const studGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.04, 8);
    const boltOffsets = [[-0.10, -0.10], [0.10, -0.10], [-0.10, 0.10], [0.10, 0.10]];
    boltOffsets.forEach(([bx, bz]) => {
        const stud = new THREE.Mesh(studGeom, MATERIALS.poleMetal);
        stud.position.set(bx, 0.035, bz);
        lightGroup.add(stud);
    });

    // Ревизионный монтажный люк в нижней части стойки
    const hatchGeom = new THREE.BoxGeometry(0.10, 0.32, 0.015);
    const hatchMesh = new THREE.Mesh(hatchGeom, MATERIALS.poleMetal);
    hatchMesh.position.set(0, 0.45, 0.075);
    lightGroup.add(hatchMesh);

    // Верхний защитный купол мачты
    const capGeom = new THREE.ConeGeometry(0.055, 0.06, 16);
    const capMesh = new THREE.Mesh(capGeom, MATERIALS.poleMetal);
    capMesh.position.y = poleH + 0.03;
    lightGroup.add(capMesh);

    // 2. ТРАНСПОРТНЫЙ ТРЁХСЕКЦИОННЫЙ СВЕТОФОР (Т.1 СТБ 1300 / ГОСТ Р 52282)
    const vehGroup = new THREE.Group();
    vehGroup.position.set(0, 3.25, 0);
    vehGroup.rotation.y = rotRoadY;

    // Монтажный консольный кронштейн на мачту
    const bracketGeom = new THREE.BoxGeometry(0.035, 0.035, 0.22);
    const bTop = new THREE.Mesh(bracketGeom, MATERIALS.poleMetal);
    bTop.position.set(0, 0.28, 0.11);
    vehGroup.add(bTop);
    const bBot = new THREE.Mesh(bracketGeom, MATERIALS.poleMetal);
    bBot.position.set(0, -0.28, 0.11);
    vehGroup.add(bBot);

    // Чёрный контрастный фоновый экран с белой окантовкой (backplate)
    const backplateGeom = new THREE.PlaneGeometry(0.48, 0.96);
    const backplateMesh = new THREE.Mesh(backplateGeom, MATERIALS.trafficBackplate || MATERIALS.trafficHousing);
    backplateMesh.position.set(0, 0, 0.22);
    vehGroup.add(backplateMesh);

    // Основной корпус светофорной головки
    const vehBoxGeom = new THREE.BoxGeometry(0.24, 0.78, 0.15);
    const vehBox = new THREE.Mesh(vehBoxGeom, MATERIALS.trafficHousing || MATERIALS.shelterFrame);
    vehBox.position.set(0, 0, 0.30);
    vehBox.castShadow = true;
    vehGroup.add(vehBox);

    // 3 линзы и глубокие светозащитные козырьки
    const lensGeom = new THREE.CircleGeometry(0.082, 20);
    const visorGeom = new THREE.CylinderGeometry(0.088, 0.088, 0.13, 20, 1, true, 0, Math.PI);
    visorGeom.rotateX(Math.PI / 2);

    // Красный сигнал
    const redMesh = new THREE.Mesh(lensGeom, MATERIALS.trafficRed);
    redMesh.position.set(0, 0.25, 0.376);
    vehGroup.add(redMesh);
    const visorRed = new THREE.Mesh(visorGeom, MATERIALS.trafficHousing);
    visorRed.position.set(0, 0.25, 0.42);
    vehGroup.add(visorRed);

    // Жёлтый сигнал
    const yellowMesh = new THREE.Mesh(lensGeom, MATERIALS.trafficYellow);
    yellowMesh.position.set(0, 0.0, 0.376);
    vehGroup.add(yellowMesh);
    const visorYellow = new THREE.Mesh(visorGeom, MATERIALS.trafficHousing);
    visorYellow.position.set(0, 0.0, 0.42);
    vehGroup.add(visorYellow);

    // Зелёный сигнал
    const greenMesh = new THREE.Mesh(lensGeom, MATERIALS.trafficGreen);
    greenMesh.position.set(0, -0.25, 0.376);
    vehGroup.add(greenMesh);
    const visorGreen = new THREE.Mesh(visorGeom, MATERIALS.trafficHousing);
    visorGreen.position.set(0, -0.25, 0.42);
    vehGroup.add(visorGreen);

    lightGroup.add(vehGroup);

    // 3. ПЕШЕХОДНЫЙ ДВУХСЕКЦИОННЫЙ СВЕТОФОР (П.1 «ЧЕЛОВЕЧКИ»)
    const pedGroup = new THREE.Group();
    pedGroup.position.set(0, 2.30, 0);
    pedGroup.rotation.y = rotPedY;

    // Кронштейн крепления пешеходного блока
    const pedArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.16), MATERIALS.poleMetal);
    pedArm.position.set(0, 0, 0.08);
    pedGroup.add(pedArm);

    // Корпус пешеходного светофора
    const pedBoxGeom = new THREE.BoxGeometry(0.22, 0.52, 0.14);
    const pedBox = new THREE.Mesh(pedBoxGeom, MATERIALS.trafficHousing || MATERIALS.shelterFrame);
    pedBox.position.set(0, 0, 0.23);
    pedBox.castShadow = true;
    pedGroup.add(pedBox);

    const pedLensGeom = new THREE.PlaneGeometry(0.16, 0.16);

    // Верхняя секция: Красный силуэт стоящего человека
    const pedRedMesh = new THREE.Mesh(pedLensGeom, MATERIALS.trafficPedRedMan || MATERIALS.trafficRed);
    pedRedMesh.position.set(0, 0.125, 0.301);
    pedGroup.add(pedRedMesh);

    // Нижняя секция: Зелёный силуэт шагающего человека
    const pedGreenMesh = new THREE.Mesh(pedLensGeom, MATERIALS.trafficPedGreenMan || MATERIALS.trafficGreen);
    pedGreenMesh.position.set(0, -0.125, 0.301);
    pedGroup.add(pedGreenMesh);

    lightGroup.add(pedGroup);

    // 4. ТАБЛО ВЫЗОВА ПЕШЕХОДНОЙ ФАЗЫ (ВПУ С КНОПКОЙ И ДИСПЛЕЕМ «ЖДИТЕ»)
    if (hasButton) {
        const btnGroup = new THREE.Group();
        btnGroup.position.set(0, 1.05, 0);
        btnGroup.rotation.y = rotBtnY;

        // Хомут крепления вызывной кнопки на мачту
        const btnClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16), MATERIALS.poleMetal);
        btnGroup.add(btnClamp);

        // Ярко-жёлтый ударопрочный корпус (RAL 1023) с фасками
        const btnCaseGeom = new THREE.BoxGeometry(0.14, 0.28, 0.09);
        const btnCase = new THREE.Mesh(btnCaseGeom, MATERIALS.trafficButtonYellow || MATERIALS.roadMarkingYellow);
        btnCase.position.set(0, 0, 0.09);
        btnCase.castShadow = true;
        btnGroup.add(btnCase);

        // Информационная лицевая панель «ЖДИТЕ / ДЛЯ ПЕРЕХОДА НАЖМИТЕ КНОПКУ»
        const btnFaceGeom = new THREE.PlaneGeometry(0.12, 0.25);
        const btnFace = new THREE.Mesh(btnFaceGeom, MATERIALS.trafficButtonPlate || MATERIALS.trafficButtonFace);
        btnFace.position.set(0, 0, 0.136);
        btnGroup.add(btnFace);

        // Тактильная металлическая кнопка из нержавеющей стали
        const btnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 20), MATERIALS.trafficButtonChrome || MATERIALS.poleMetal);
        btnMesh.geometry.rotateX(Math.PI / 2);
        btnMesh.position.set(0, -0.015, 0.142);
        btnGroup.add(btnMesh);

        // Светодиодный индикатор подтверждения вызова
        const ledMesh = new THREE.Mesh(new THREE.CircleGeometry(0.014, 14), MATERIALS.trafficRed);
        ledMesh.position.set(0, 0.095, 0.137);
        btnGroup.add(ledMesh);

        lightGroup.add(btnGroup);
    }

    group.add(lightGroup);
}

function buildPerimeterFence(group) {
    const fenceGeoms = [];
    const postW = 0.08;
    const postH = 2.05;
    const baseW = 0.16;
    const baseH = 0.05;
    const railH = 0.04;
    const railW = 0.025;
    const picketW = 0.028;
    const picketD = 0.014;
    const picketH = 1.80;
    const picketStep = 0.14;

    function addFenceLine(x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const totalDist = Math.hypot(dx, dz);
        if (totalDist < 0.5) return;

        const dirX = dx / totalDist;
        const dirZ = dz / totalDist;
        const angleY = Math.atan2(dx, dz);

        const postSpan = 2.50;
        const numPosts = Math.max(1, Math.round(totalDist / postSpan));
        const actualSpan = totalDist / numPosts;

        for (let i = 0; i <= numPosts; i++) {
            const px = x1 + dirX * (i * actualSpan);
            const pz = z1 + dirZ * (i * actualSpan);

            const baseGeom = new THREE.BoxGeometry(baseW, baseH, baseW);
            baseGeom.translate(px, baseH / 2, pz);
            fenceGeoms.push(baseGeom);

            const postGeom = new THREE.BoxGeometry(postW, postH, postW);
            postGeom.translate(px, postH / 2, pz);
            fenceGeoms.push(postGeom);

            const capGeom = new THREE.ConeGeometry(postW * 0.75, 0.05, 4);
            capGeom.rotateY(Math.PI / 4);
            capGeom.translate(px, postH + 0.025, pz);
            fenceGeoms.push(capGeom);
        }

        const railTop = new THREE.BoxGeometry(railW, railH, totalDist);
        railTop.rotateY(angleY);
        railTop.translate((x1 + x2) / 2, 1.70, (z1 + z2) / 2);
        fenceGeoms.push(railTop);

        const railBot = new THREE.BoxGeometry(railW, railH, totalDist);
        railBot.rotateY(angleY);
        railBot.translate((x1 + x2) / 2, 0.40, (z1 + z2) / 2);
        fenceGeoms.push(railBot);

        const numPickets = Math.floor(totalDist / picketStep);
        for (let p = 1; p < numPickets; p++) {
            const distFromStart = p * picketStep;
            if (Math.abs(distFromStart % actualSpan) < 0.08 || Math.abs(actualSpan - (distFromStart % actualSpan)) < 0.08) {
                continue;
            }
            const lx = x1 + dirX * distFromStart;
            const lz = z1 + dirZ * distFromStart;

            const picketGeom = new THREE.BoxGeometry(picketW, picketH, picketD);
            picketGeom.rotateY(angleY);
            picketGeom.translate(lx, 0.20 + picketH / 2, lz);
            fenceGeoms.push(picketGeom);
        }
    }

    // Линии забора вокруг кампуса МГКЦТ:
    // 1. Северный забор: с проездом для пожарного выезда (X: 17.5..22.5) и БЕЗ дырки на 40..46:
        // Новый периметральный забор (красная разметка):
    // 1. Западный забор вдоль Корпуса 3 и Корпуса 5 (X = -5.0, Z от -14.0 до -72.0)
        // Новый периметральный забор (красная разметка):
    // 1. Западный забор вдоль Корпуса 3 и Корпуса 5 (X = -5.0, Z от -14.0 до -72.0)
    addFenceLine(-5.0, -72.0, -5.0, -14.0);

    // 2. Северный забор вдоль северной границы участка (Z = -72.0, X от -5.0 до 72.0)
    addFenceLine(-5.0, -72.0, 72.0, -72.0);

    // 3. Восточный забор вдоль Корпуса 4 и 2 (X = 72.0, к югу от северного проезда Z = -66.5 до ворот Z = -24.0)
    addFenceLine(72.0, -66.5, 72.0, -24.0);
    // Ворота въезда на служебную парковку: Z: -24.0 .. -17.0
    addFenceLine(72.0, -17.0, 72.0, 3.5);

    // 4. Юго-восточный угловой забор у Корпуса 2
    addFenceLine(68.0, 3.5, 72.0, 3.5);

    if (fenceGeoms.length > 0) {
        const mergedFence = mergeBufferGeometriesVanilla(fenceGeoms);
        const fenceMesh = new THREE.Mesh(mergedFence, MATERIALS.perimeterFence);
        fenceMesh.castShadow = true;
        fenceMesh.receiveShadow = true;
        group.add(fenceMesh);
    }
}

window.addPedestrianTrafficLight = addPedestrianTrafficLight;
window.buildPerimeterFence = buildPerimeterFence;
