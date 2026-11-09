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

window.buildBicycleStation = buildBicycleStation;
window.buildPedestrianBollards = buildPedestrianBollards;
window.buildPromenadeAndForecourtAmenities = buildPromenadeAndForecourtAmenities;

// ----------------------------------------------------
// 6. ОЗЕЛЕНЕНИЕ (ГАЗОН КОРПУСА 2 С ДЕРЕВЬЯМИ И ДЕРЕВЬЯ ВДОЛЬ ВОСТОЧНОЙ ГРАНИЦЫ)
// ----------------------------------------------------
