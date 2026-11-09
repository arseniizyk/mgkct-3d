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
    if (typeof createExtrudedPolygonGeometry === 'function') {
        return createExtrudedPolygonGeometry(points, yCenter, thickness);
    }
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

window.buildForecourtDualTonePaving = buildForecourtDualTonePaving;
window.buildForecourtAndPlaza = buildForecourtAndPlaza;
