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

window.buildCampusBench = buildCampusBench;
window.buildParkWasteBin = buildParkWasteBin;

// 3. ВЕЛОСИПЕДНАЯ СТАНЦИЯ (5 ИЗОГНУТЫХ ДУГ SHEFFIELD С МЕДАЛЬОНАМИ)
