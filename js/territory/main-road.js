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
