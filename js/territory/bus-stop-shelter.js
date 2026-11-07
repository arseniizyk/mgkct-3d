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


    buildShelterGlazingAndAmenities(shelterGroup, w, h, d, frameMat, steelMat, glassMat, benchWoodMat, benchLegMat);
    group.add(shelterGroup);
}
