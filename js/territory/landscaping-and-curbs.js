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
    if (typeof createExtrudedPolygonGeometry === 'function') {
        return createExtrudedPolygonGeometry(points, yTop - depth / 2, depth);
    }
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

    const baseY = (typeof CURB_BASE_Y === 'number') ? CURB_BASE_Y : 0.02;
    const topY = ((typeof CURB_TOP_Y === 'number') ? CURB_TOP_Y : 0.12) - baseY;

    const shape = new THREE.Shape();
    // Поперечный профиль бордюра: ширина 0.18 м, высота 0.20 м
    // X: от -0.09 (лицевая сторона) до +0.09 (тыльная сторона к тротуару)
    // Y: от -0.08 (заглубление в основание) до topY (верхняя грань = CURB_TOP_Y в мире)
    // Фаска 45° на лицевой грани: от (-0.065, topY) до (-0.09, topY - 0.025)
    shape.moveTo(-0.09, -0.08);
    shape.lineTo(0.09, -0.08);
    shape.lineTo(0.09, topY);          // тыльный верхний угол (заподлицо с тротуаром)
    shape.lineTo(-0.065, topY);        // начало фаски 45°
    shape.lineTo(-0.09, topY - 0.025); // нижний край фаски
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
    const curbBaseY = (typeof CURB_BASE_Y === 'number') ? CURB_BASE_Y : 0.02;

    for (let i = 0; i < numBlocks; i++) {
        const t = (i + 0.5) / numBlocks;
        const bx = x1 + dx * t;
        const bz = z1 + dz * t;

        if (_curbBatch) {
            _curbBatch.push({ bx, by: curbBaseY, bz, rotY: -angle, geom });
        } else {
            const curbMesh = new THREE.Mesh(geom, MATERIALS.curb);
            curbMesh.position.set(bx, curbBaseY, bz);
            curbMesh.rotation.y = -angle;
            curbMesh.castShadow = true;
            curbMesh.receiveShadow = true;
            group.add(curbMesh);
        }
    }
}

