// ==========================================
// ГЛАВНЫЙ МОДУЛЬ СЦЕНЫ, СБОРКИ И ЦИКЛА РЕНДЕРИНГА
// ==========================================

function init() {
    // 0. Восстанавливаем сохранённые настройки из LocalStorage до сборки сцены и геометрии
    if (typeof restoreSavedSettings === 'function') {
        restoreSavedSettings();
    }

    if (STATE.slabOpacity !== undefined && MATERIALS.slab && MATERIALS.coreSlab) {
        const isTrans = STATE.slabOpacity < 0.99;
        MATERIALS.slab.transparent = isTrans;
        MATERIALS.coreSlab.transparent = isTrans;
        MATERIALS.slab.opacity = STATE.slabOpacity;
        MATERIALS.coreSlab.opacity = STATE.slabOpacity;
    }

    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b0e); // Stealth Dark Tech Minimal

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.2, 700);
    const cx = (typeof getActiveCenterX === 'function') ? getActiveCenterX() : 16.0;
    const cz = (typeof getActiveCenterZ === 'function') ? getActiveCenterZ() : -18.0;
    const isMobile = window.innerWidth < 768;
    const initCamY = isMobile ? 54 : 64;
    const initCamZ = isMobile ? (cz + 18) : (cz + 22);
    camera.position.set(cx, initCamY, initCamZ);

    // Высокий pixelRatio (до 2.5) для максимальной кристальной чёткости текста на экранах телефонов (Retina)
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.shadowMap.enabled = STATE.showShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    container.appendChild(renderer.domElement);

    // Инициализация кастомных контролов с зумом к позиции курсора
    controls = initControls(camera, renderer.domElement);
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;
    window.controls = controls;

    // Освещение сцены
    const ambientLight = new THREE.AmbientLight(0xdbe2ea, 0.76);
    scene.add(ambientLight);

    dirLight1 = new THREE.DirectionalLight(0xffffff, 0.58);
    dirLight1.position.set(35, 95, 45);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 5;
    dirLight1.shadow.camera.far = 280;
    const d = 85;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    // Идеальный контакт тени без световых щелей и без артефактов (shadow acne):
    dirLight1.shadow.bias = -0.00008;
    dirLight1.shadow.normalBias = 0.005;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.32);
    dirLight2.position.set(-35, 55, -45);
    scene.add(dirLight2);

    // Чертёжная сетка в основании
    const grid = new THREE.GridHelper(320, 320, 0x2e3540, 0x20252d);
    grid.position.set(15, -0.18, -18);
    scene.add(grid);

    // Создаём группы для 1–7 этажей и подгруппы Корпусов 1, 2, 3 и 4
    for (let f = 1; f <= 7; f++) {
        floorGroups[f] = new THREE.Group();
        bldg1FloorGroups[f] = new THREE.Group();
        bldg2FloorGroups[f] = new THREE.Group();
        bldg3FloorGroups[f] = new THREE.Group();
        bldg4FloorGroups[f] = new THREE.Group();
        floorGroups[f].add(bldg1FloorGroups[f]);
        floorGroups[f].add(bldg2FloorGroups[f]);
        floorGroups[f].add(bldg3FloorGroups[f]);
        floorGroups[f].add(bldg4FloorGroups[f]);
        scene.add(floorGroups[f]);
    }
    alignmentGuidesGroup = new THREE.Group();
    scene.add(alignmentGuidesGroup);

    stairValidationGroup = new THREE.Group();
    scene.add(stairValidationGroup);

    territoryGroup = new THREE.Group();
    scene.add(territoryGroup);

    // Сборка Корпуса 1 (Этажи 1–7)
    buildFloor1(bldg1FloorGroups[1]);
    buildFloor2(bldg1FloorGroups[2]);
    buildFloor3(bldg1FloorGroups[3]);
    buildFloor4(bldg1FloorGroups[4]);
    buildFloor5(bldg1FloorGroups[5]);
    buildFloor6(bldg1FloorGroups[6]);
    buildFloor7(bldg1FloorGroups[7]);

    // Сборка Корпуса 2 (Этажи 1–3)
    buildBuilding2Floor1(bldg2FloorGroups[1]);
    buildBuilding2Floor2(bldg2FloorGroups[2]);
    buildBuilding2Floor3(bldg2FloorGroups[3]);

    // Сборка Корпуса 3 (Этажи 1–2)
    buildBuilding3Floor1(bldg3FloorGroups[1]);
    buildBuilding3Floor2(bldg3FloorGroups[2]);

    // Сборка Корпуса 4 (Этажи 1–3) и переходов 2-го этажа к Корпусу 3 и Корпусу 2
    buildBuilding4Floor1(bldg4FloorGroups[1]);
    buildBuilding4Floor2(bldg4FloorGroups[2]);
    buildBuilding4Floor3(bldg4FloorGroups[3]);

    buildRoofs();
    buildTerritory();
    buildAlignmentGuides();
    buildStairValidationAxes();

    updateWallHeights();
    recalcTargetPositions();
    for (let f = 1; f <= 7; f++) {
        floorGroups[f].position.copy(STATE.targetPos[f]);
    }

    updateRoofsVisibility();
    updateTerritoryVisibility();
    updateLabelsVisibility();
    updateEdgesVisibility();
    updateAlignmentGuides();
    updateStairValidationAxes();
    setupUI();
    if (typeof initLabelsOverlay === 'function') {
        initLabelsOverlay();
    }

    // Быстрый отклик на любые действия пользователя для On-Demand рендеринга
    ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove', 'keydown', 'input', 'change'].forEach(evt => {
        window.addEventListener(evt, () => requestRender(15), { passive: true });
    });

    window.addEventListener('resize', onWindowResize);
    updateShadows();
    requestRender(60);
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        if (typeof renderScreenSpaceLabels === 'function') {
            renderScreenSpaceLabels();
        }
    }
    animate();
}

function buildStairValidationAxes() {
    STAIR_SHAFTS_VALIDATION.forEach(s => {
        const cx = (s.x1 + s.x2) / 2;
        const cz = (s.z1 + s.z2) / 2;
        const w = Math.abs(s.x2 - s.x1);
        const d = Math.abs(s.z2 - s.z1);

        const pts = [
            new THREE.Vector3(cx, -0.5, cz),
            new THREE.Vector3(cx, 25, cz)
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const centerLine = new THREE.Line(lineGeom, MATERIALS.stairAxisLine);
        centerLine.computeLineDistances();
        stairValidationGroup.add(centerLine);

        const boxGeom = new THREE.BoxGeometry(w, 1, d);
        const boxEdges = new THREE.EdgesGeometry(boxGeom);
        const wireframeBox = new THREE.LineSegments(boxEdges, MATERIALS.stairBoxEdge);
        wireframeBox.position.set(cx, 1, cz);
        stairValidationGroup.add(wireframeBox);

        stairValidationItems.push({ ...s, cx, cz, centerLine, wireframeBox });
    });
}

function updateStairValidationAxes() {
    const show = STATE.showStairAxes;
    stairValidationGroup.visible = show;
    if (!show) return;

    let botY = floorGroups[1] ? floorGroups[1].position.y : 0;
    let maxActiveF = 7;

    const isSingleFloor = (STATE.mode !== 'all' && STATE.mode !== 'slice' && STATE.mode !== 'sideBySide');
    let selectedFloor = 1;
    if (isSingleFloor) {
        selectedFloor = parseInt(STATE.mode, 10);
        maxActiveF = selectedFloor;
        botY = 0;
    } else if (STATE.mode === 'slice') {
        maxActiveF = STATE.sliceMaxFloor;
    }

    stairValidationItems.forEach(item => {
        let visibleByBuilding =
            (STATE.buildingFilter === 'both' ||
            (STATE.buildingFilter === '1' && item.bldg === 1) ||
            (STATE.buildingFilter === '2' && item.bldg === 2) ||
            (STATE.buildingFilter === '3' && item.bldg === 3) ||
            (STATE.buildingFilter === '4' && item.bldg === 4));

        if (isSingleFloor) {
            if (item.maxFloor < selectedFloor) {
                visibleByBuilding = false;
            }
        }

        item.centerLine.visible = visibleByBuilding;
        item.wireframeBox.visible = visibleByBuilding;
        if (!visibleByBuilding) return;

        let topY, totalH;
        if (isSingleFloor) {
            topY = STATE.wallHeight;
            totalH = STATE.wallHeight + 0.3;
            const posAttr = item.centerLine.geometry.attributes.position;
            posAttr.setXYZ(0, item.cx, -0.2, item.cz);
            posAttr.setXYZ(1, item.cx, topY + 0.5, item.cz);
            posAttr.needsUpdate = true;
            item.centerLine.computeLineDistances();

            item.wireframeBox.scale.y = totalH;
            item.wireframeBox.position.set(item.cx, totalH / 2 - 0.1, item.cz);
        } else {
            const effectiveMax = Math.min(item.maxFloor, maxActiveF);
            topY = (floorGroups[effectiveMax] ? floorGroups[effectiveMax].position.y : 0) + STATE.wallHeight;
            totalH = Math.max(0.5, topY - botY);

            const posAttr = item.centerLine.geometry.attributes.position;
            posAttr.setXYZ(0, item.cx, botY - 0.3, item.cz);
            posAttr.setXYZ(1, item.cx, topY + 0.8, item.cz);
            posAttr.needsUpdate = true;
            item.centerLine.computeLineDistances();

            item.wireframeBox.scale.y = totalH;
            item.wireframeBox.position.set(item.cx, botY + totalH / 2, item.cz);
        }
    });
}

function buildRoofs() {
    // Корпус 1: Кровля 7-го этажа + открытый переход каб. 305 на 3-м этаже
    addRoofRect(bldg1FloorGroups[7], -10.0, -14.0, 16.0, -4.0, 1);
    addRoofRect(bldg1FloorGroups[7], -14.0, -4.0, -5.8, 14.0, 1);
    addRoofRect(bldg1FloorGroups[7], -5.8, -4.0, 16.0, 4.0, 1);
    addRoofRect(bldg1FloorGroups[7], -5.8, 4.0, 12.5, 14.0, 1);
    addRoofRect(bldg1FloorGroups[3], 16.0, -9.5, 20.4, -2.2, 1);

    // Корпус 2: Кровля 3-го этажа
    addRoofRect(bldg2FloorGroups[3], B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_BOT, 2);

    // Корпус 3: Кровля 2-го этажа + переход к Корпусу 4
    addRoofRect(bldg3FloorGroups[2], B3_X_WEST, B3_Z_NORTH, B3_X_EAST, B3_Z_SOUTH, 3);
    addRoofRect(bldg3FloorGroups[2], B3_X_EAST, -47.6, 15.6, -44.0, 3);

    // Корпус 4: Кровля 3-го этажа + сквозные лестничные шахты + переходы 2-го этажа
    addRoofRect(bldg4FloorGroups[3], B4_X_WEST, B4_Z_NORTH, B4_X_EAST, B4_Z_SOUTH, 4);
    addRoofRect(bldg4FloorGroups[3], B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z2, 4);
    addRoofRect(bldg4FloorGroups[3], B4_LK3_X1, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, 4);
    addRoofRect(bldg4FloorGroups[3], B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, 4);
    // Переходы 2-го этажа
    addRoofRect(bldg4FloorGroups[2], 15.6, -46.8, B4_X_WEST, -44.2, 4);
    addRoofRect(bldg4FloorGroups[2], 36.2, B4_Z_SOUTH, B4_LK1_X1, B2_Z_TOP, 4);
}

function updateRoofsVisibility() {
    roofMeshes.forEach(item => {
        item.mesh.visible = STATE.showRoof;
    });
    updateShadows();
    requestRender(20);
}

function updateTerritoryVisibility() {
    if (territoryGroup) {
        territoryGroup.visible = STATE.showTerritory;
    }
    updateShadows();
    requestRender(20);
}

function buildAlignmentGuides() {
    const corners = [
        // Корпус 1 (все 7 этажей)
        { gx: -14.0, gz: -4.0, maxFloor: 7, bldg: 1 },
        { gx: -14.0, gz: 14.0, maxFloor: 7, bldg: 1 },
        { gx: 12.5, gz: 14.0, maxFloor: 7, bldg: 1 },
        { gx: 16.0, gz: -14.0, maxFloor: 7, bldg: 1 },
        { gx: -10.0, gz: -14.0, maxFloor: 7, bldg: 1 },
        // Корпус 2 (этажи 1–3)
        { gx: B2_X_START, gz: B2_Z_TOP, maxFloor: 3, bldg: 2 },
        { gx: B2_X_START, gz: B2_Z_BOT, maxFloor: 3, bldg: 2 },
        { gx: B2_X_END, gz: B2_Z_TOP, maxFloor: 3, bldg: 2 },
        { gx: B2_X_END, gz: B2_Z_BOT, maxFloor: 3, bldg: 2 },
        // Корпус 3 (этажи 1–2)
        { gx: B3_X_WEST, gz: B3_Z_SOUTH, maxFloor: 2, bldg: 3 },
        { gx: B3_X_EAST, gz: B3_Z_SOUTH, maxFloor: 2, bldg: 3 },
        { gx: B3_X_WEST, gz: B3_Z_NORTH, maxFloor: 2, bldg: 3 },
        { gx: B3_X_EAST, gz: B3_Z_NORTH, maxFloor: 2, bldg: 3 },
        // Корпус 4 (этажи 1–3)
        { gx: B4_X_WEST, gz: B4_Z_SOUTH, maxFloor: 3, bldg: 4 },
        { gx: B4_X_EAST, gz: B4_Z_SOUTH, maxFloor: 3, bldg: 4 },
        { gx: B4_X_WEST, gz: B4_Z_NORTH, maxFloor: 3, bldg: 4 },
        { gx: B4_X_EAST, gz: B4_Z_NORTH, maxFloor: 3, bldg: 4 }
    ];

    corners.forEach(item => {
        const pts = [
            new THREE.Vector3(item.gx, 0, item.gz),
            new THREE.Vector3(item.gx, 10, item.gz)
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geom, MATERIALS.guideLine);
        line.computeLineDistances();
        alignmentGuidesGroup.add(line);
        guideLines.push({ ...item, line });
    });
}

function updateAlignmentGuides() {
    const show = STATE.showGuides;
    alignmentGuidesGroup.visible = show;
    if (!show) return;

    let botY = floorGroups[1] ? floorGroups[1].position.y : 0;
    let maxActiveF = 7;

    const isSingleFloor = (STATE.mode !== 'all' && STATE.mode !== 'slice' && STATE.mode !== 'sideBySide');
    let selectedFloor = 1;
    if (isSingleFloor) {
        selectedFloor = parseInt(STATE.mode, 10);
        maxActiveF = selectedFloor;
        botY = 0;
    } else if (STATE.mode === 'slice') {
        maxActiveF = STATE.sliceMaxFloor;
    }

    guideLines.forEach(item => {
        let visibleByBuilding =
            (STATE.buildingFilter === 'both' ||
            (STATE.buildingFilter === '1' && item.bldg === 1) ||
            (STATE.buildingFilter === '2' && item.bldg === 2) ||
            (STATE.buildingFilter === '3' && item.bldg === 3) ||
            (STATE.buildingFilter === '4' && item.bldg === 4));

        if (isSingleFloor) {
            if (item.maxFloor < selectedFloor) {
                visibleByBuilding = false;
            }
        }

        item.line.visible = visibleByBuilding;
        if (!visibleByBuilding) return;

        let topY;
        if (isSingleFloor) {
            topY = STATE.wallHeight;
        } else {
            const effectiveMax = Math.min(item.maxFloor, maxActiveF);
            topY = (floorGroups[effectiveMax] ? floorGroups[effectiveMax].position.y : 0) + STATE.wallHeight;
        }

        const posAttr = item.line.geometry.attributes.position;
        posAttr.setXYZ(0, item.gx, botY, item.gz);
        posAttr.setXYZ(1, item.gx, topY, item.gz);
        posAttr.needsUpdate = true;
        item.line.computeLineDistances();
    });
}

function isPointInFloorFootprint(lx, lz, floorNum, bldId = null) {
    const m = 0.22;
    const showB1 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '1';
    const showB2 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '2';
    const showB3 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '3';
    const showB4 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '4';

    if (showB1 && (!bldId || bldId === 1)) {
        if (lx >= -10.0 - m && lx <= 16.0 + m && lz >= -14.0 - m && lz <= -4.0 + m) return true;
        if (lx >= -14.0 - m && lx <= 16.0 + m && lz >= -4.0 - m && lz <= 4.0 + m) return true;
        if (lx >= -14.0 - m && lx <= 12.5 + m && lz >= 4.0 - m && lz <= 14.0 + m) return true;
        if (floorNum <= 3) {
            if (lx >= 16.0 - m && lx <= 20.4 + m && lz >= -9.5 - m && lz <= -2.2 + m) return true;
        }
    }

    if (showB2 && (!bldId || bldId === 2) && floorNum <= 3) {
        if (lx >= B2_X_START - m && lx <= B2_X_END + m && lz >= B2_Z_TOP - m && lz <= B2_Z_BOT + m) return true;
    }

    if (showB3 && (!bldId || bldId === 3) && floorNum <= 2) {
        if (lx >= B3_X_WEST - m && lx <= B3_X_EAST + m && lz >= B3_Z_NORTH - m && lz <= B3_Z_SOUTH + m) return true;
        if (lx >= B3_X_EAST - m && lx <= 15.6 + m && lz >= -47.6 - m && lz <= -44.0 + m) return true;
    }

    if (showB4 && (!bldId || bldId === 4) && floorNum <= 3) {
        if (floorNum === 3) {
            // На 3-м этаже Корпуса 4 зоны Второго Света (над спортзалом и актовым залом) являются сквозными проемами (нет перекрытия)
            const inGymVoid = (lx >= B4_X_WEST - m && lx <= B4_X_EAST + m && lz >= B4_Z_NORTH - m && lz <= B4_Z_MID_N + m);
            const inHallVoid = (lx >= 48.2 - m && lx <= B4_X_EAST + m && lz >= -43.6 - m && lz <= B4_Z_SOUTH + m);
            if (!inGymVoid && !inHallVoid) {
                if (lx >= B4_X_WEST - m && lx <= B4_X_EAST + m && lz >= B4_Z_NORTH - m && lz <= B4_Z_SOUTH + m) return true;
            }
        } else {
            if (lx >= B4_X_WEST - m && lx <= B4_X_EAST + m && lz >= B4_Z_NORTH - m && lz <= B4_Z_SOUTH + m) return true;
        }
        if (lx >= B4_LK2_X1 - m && lx <= B4_LK2_X2 + m && lz >= B4_LK2_Z1 - m && lz <= B4_LK2_Z2 + m) return true;
        if (lx >= B4_LK3_X1 - m && lx <= B4_LK3_X2 + m && lz >= B4_LK3_Z1 - m && lz <= B4_LK3_Z2 + m) return true;
        if (lx >= B4_LK1_X1 - m && lx <= B4_LK1_X2 + m && lz >= B4_LK1_Z1 - m && lz <= B4_LK1_Z2 + m) return true;
        if (floorNum === 2) {
            if (lx >= 15.6 - m && lx <= B4_X_WEST + m && lz >= -46.8 - m && lz <= -44.2 + m) return true;
            if (lx >= 36.2 - m && lx <= B4_LK1_X1 + m && lz >= B4_Z_SOUTH - m && lz <= B2_Z_TOP + m) return true;
        }
    }
    return false;
}

const _tempLabelWorldPos = new THREE.Vector3();
function isLabelOccludedByUpperSlabs(labelItem, floorNum = null, bldId = null) {
    const f = floorNum !== null ? floorNum : labelItem.floor;
    const fg = floorGroups[f];
    if (!fg || !fg.visible) return true;

    if (labelItem.isVector3) {
        _tempLabelWorldPos.copy(labelItem);
    } else {
        _tempLabelWorldPos.set(
            fg.position.x + labelItem.localX,
            fg.position.y + labelItem.mesh.position.y,
            fg.position.z + labelItem.localZ
        );
    }

    const camPos = camera.position;
    const dy = _tempLabelWorldPos.y - camPos.y;

    for (let u = f + 1; u <= 7; u++) {
        const ug = floorGroups[u];
        if (!ug || !ug.visible) continue;

        const checkHeights = [ug.position.y, ug.position.y + STATE.wallHeight * 0.55];
        for (let i = 0; i < checkHeights.length; i++) {
            const planeY = checkHeights[i];
            if ((camPos.y > planeY && _tempLabelWorldPos.y < planeY) ||
                (camPos.y < planeY && _tempLabelWorldPos.y > planeY)) {
                const t = (planeY - camPos.y) / dy;
                if (t > 0.01 && t < 0.99) {
                    const hitX = camPos.x + t * (_tempLabelWorldPos.x - camPos.x) - ug.position.x;
                    const hitZ = camPos.z + t * (_tempLabelWorldPos.z - camPos.z) - ug.position.z;
                    if (isPointInFloorFootprint(hitX, hitZ, u, bldId)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function updateLabelsVisibility() {
    // 3D-меши надписей всегда скрыты в Three.js, так как они отрисовываются
    // со 100% честной резкостью через Screen-Space 2D Overlay
    labelSprites.forEach(item => {
        if (item.mesh) {
            item.mesh.visible = false;
        }
    });
}

// ==========================================
// ОПТИМИЗАЦИЯ: УМНОЕ СКРЫТИЕ ВНУТРЕННИХ СТЕН
// В режиме стопки скрываются ТОЛЬКО скрытые внутренние перегородки комнат,
// а внешние несущие стены (фасад) и плиты перекрытий ВСЕГДА остаются видимыми!
// ==========================================
function updateEdgesVisibility() {
    wallEdges.forEach(line => {
        if (line) line.visible = STATE.showEdges;
    });
    doorEdges.forEach(line => {
        if (line) line.visible = STATE.showEdges;
    });
    for (let f = 1; f <= 7; f++) {
        if (floorGroups[f]) {
            floorGroups[f].traverse(child => {
                if (child.isLineSegments) {
                    child.visible = STATE.showEdges;
                }
            });
        }
    }
    requestRender(20);
}

function updateFloorsInteriorVisibility() {
    const isStack = (STATE.mode === 'all' || STATE.mode === 'slice') && (!STATE.exploded || STATE.explodeGap < 0.2) && (STATE.slabOpacity > 0.85);

    function setGroupInteriorVisibility(group, isTopFloor) {
        if (!group) return;
        // Внутренние стены и двери показываются, если этажи разнесены взрывом, либо это верхний этаж, либо плиты полупрозрачные
        const showInterior = !isStack || isTopFloor;

        group.traverse(child => {
            if (!child.userData) return;

            // КОНТУРЫ / РЁБРА (LineSegments): строго подчиняются переключателю STATE.showEdges!
            if (child.isLineSegments) {
                child.visible = STATE.showEdges;
                return;
            }

            // КРЫША: управляется исключительно переключателем STATE.showRoof
            if (child.userData.isRoof === true) {
                child.visible = STATE.showRoof;
                return;
            }

            // ВНЕШНИЕ ЭЛЕМЕНТЫ, ДВУСВЕТНЫЕ ПРОСТРАНСТВА И СТУПЕНИ ЛЕСТНИЦ ВСЕГДА ВИДНЫ!
            if (child.userData.isExterior === true || child.userData.isDoubleHeight === true || child.userData.isStair === true) {
                if (child.userData.isDoor) {
                    child.visible = STATE.showDoors;
                } else {
                    child.visible = true;
                }
                return;
            }

            // Скрываем/показываем ТОЛЬКО внутренние перегородки, межкомнатные двери, внутренние ступени и таблички кабинетов
            if (child.userData.isInterior === true) {
                if (child.userData.isDoor) {
                    child.visible = showInterior && STATE.showDoors;
                } else {
                    child.visible = showInterior;
                }
            }
            // ВНЕШНИЕ СТЕНЫ и ПЛИТЫ ПЕРЕКРЫТИЙ ВСЕГДА ВИДНЫ!
            else if (child.userData.isInterior === false) {
                if (child.userData.isDoor) {
                    child.visible = STATE.showDoors;
                } else {
                    child.visible = true;
                }
            }
        });
    }

    const maxF = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;
    // Корпус 1: верхний отображаемый этаж
    for (let f = 1; f <= 7; f++) {
        setGroupInteriorVisibility(bldg1FloorGroups[f], f === Math.min(7, maxF));
    }
    // Корпус 2: верхний отображаемый этаж
    for (let f = 1; f <= 3; f++) {
        setGroupInteriorVisibility(bldg2FloorGroups[f], f === Math.min(3, maxF));
    }
    // Корпус 3: верхний отображаемый этаж
    for (let f = 1; f <= 2; f++) {
        setGroupInteriorVisibility(bldg3FloorGroups[f], f === Math.min(2, maxF));
    }
    // Корпус 4: верхний отображаемый этаж
    for (let f = 1; f <= 3; f++) {
        setGroupInteriorVisibility(bldg4FloorGroups[f], f === Math.min(3, maxF));
    }
}

function recalcTargetPositions() {
    const stepH = STATE.wallHeight + 0.25 + (STATE.exploded ? STATE.explodeGap : 0);
    const showB1 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '1';
    const showB2 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '2';
    const showB3 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '3';
    const showB4 = STATE.buildingFilter === 'both' || STATE.buildingFilter === '4';

    for (let f = 1; f <= 7; f++) {
        bldg1FloorGroups[f].visible = showB1;
        bldg2FloorGroups[f].visible = showB2 && (f <= 3);
        bldg3FloorGroups[f].visible = showB3 && (f <= 2);
        bldg4FloorGroups[f].visible = showB4 && (f <= 3);
    }

    if (STATE.mode === 'all' || STATE.mode === 'slice') {
        const maxF = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;
        for (let f = 1; f <= 7; f++) {
            floorGroups[f].visible = (f <= maxF);
            STATE.targetPos[f].set(0, stepH * (f - 1), 0);
        }
    } else if (STATE.mode === 'sideBySide') {
        for (let f = 1; f <= 7; f++) {
            floorGroups[f].visible = true;
        }
        STATE.targetPos[1].set(-96, 0, 42);
        STATE.targetPos[2].set(0, 0, 42);
        STATE.targetPos[3].set(96, 0, 42);
        STATE.targetPos[4].set(-54, 0, -45);
        STATE.targetPos[5].set(-18, 0, -45);
        STATE.targetPos[6].set(18, 0, -45);
        STATE.targetPos[7].set(54, 0, -45);
    } else {
        const selectedFloor = parseInt(STATE.mode, 10);
        for (let f = 1; f <= 7; f++) {
            floorGroups[f].visible = (f === selectedFloor);
            if (f === selectedFloor) {
                STATE.targetPos[f].set(0, 0, 0);
                floorGroups[f].position.set(0, 0, 0);
            }
        }
    }

    // Применяем умную оптимизацию видимости внутренностей
    updateFloorsInteriorVisibility();
    updateLabelsVisibility();
    updateShadows();
    requestRender(45);
}

function updateWallHeights() {
    wallMeshes.forEach(m => {
        if (m.userData && m.userData.isColumn) {
            m.scale.y = STATE.wallHeight;
            m.position.y = STATE.wallHeight / 2;
        } else {
            m.scale.y = STATE.wallHeight + WALL_SINK;
            m.position.y = (STATE.wallHeight - WALL_SINK) / 2;
        }
    });

    doorMeshes.forEach(m => {
        m.scale.y = STATE.wallHeight + WALL_SINK;
        m.position.y = (STATE.wallHeight - WALL_SINK) / 2;
        m.visible = STATE.showDoors;
    });

    stairMeshes.forEach(st => {
        if (!st) return;
        const mesh = st.mesh || st;
        const heightRatio = st.heightRatio !== undefined ? st.heightRatio : 0.22;
        const yOffset = st.yOffset !== undefined ? st.yOffset : 0;
        const stepH = Math.max(0.06, STATE.wallHeight * heightRatio);
        mesh.scale.y = stepH;
        mesh.position.y = (stepH / 2) + yOffset;
    });

    roofMeshes.forEach(r => {
        r.mesh.position.y = STATE.wallHeight + r.thickness / 2;
    });

    labelSprites.forEach(item => {
        item.mesh.position.y = 0.02;
    });

    recalcTargetPositions();
    updateShadows();
    requestRender(45);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (typeof resizeLabelsOverlay === 'function') {
        resizeLabelsOverlay();
    }
    requestRender(20);
}

// ==========================================
// СИСТЕМА ON-DEMAND РЕНДЕРИНГА И СНИЖЕНИЯ НАГРУЗКИ (IDLE SLEEP)
// ==========================================
let renderRequested = true;
let framesToRender = 60;
let lastRenderTime = 0;
let frameCounter = 0;

function requestRender(frames = 30) {
    framesToRender = Math.max(framesToRender, frames);
    renderRequested = true;
}

function updateShadows() {
    if (renderer && renderer.shadowMap && renderer.shadowMap.enabled) {
        renderer.shadowMap.needsUpdate = true;
        requestRender(10);
    }
}

function applyPreset(presetName, shouldSave = true) {
    if (presetName !== 'eco' && presetName !== 'balance' && presetName !== 'ultra') {
        presetName = 'balance';
    }
    STATE.preset = presetName;

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-preset-' + presetName)?.classList.add('active');

    let shadowSize = 2048;
    let ratio = 1.25;
    let shadowsEnabled = true;

    if (presetName === 'eco') {
        // Минимальная нагрузка для тишины ноута
        shadowSize = 1024;
        ratio = 1.0;
        shadowsEnabled = false;
    } else if (presetName === 'balance') {
        // Оптимальный баланс качества и скорости с поддержкой Retina
        shadowSize = 2048;
        ratio = Math.min(window.devicePixelRatio || 1, 2.0);
        shadowsEnabled = true;
    } else if (presetName === 'ultra') {
        // Максимум детализации (4K / Super Retina)
        shadowSize = 4096;
        ratio = Math.min(window.devicePixelRatio || 1, 3.0);
        shadowsEnabled = true;
    }

    STATE.showShadows = shadowsEnabled;
    const shadowToggle = document.getElementById('toggle-shadows');
    if (shadowToggle) {
        shadowToggle.checked = shadowsEnabled;
    }

    if (renderer) {
        renderer.setPixelRatio(ratio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        if (renderer.shadowMap) {
            renderer.shadowMap.enabled = shadowsEnabled;
        }

        if (dirLight1 && dirLight1.shadow) {
            dirLight1.shadow.mapSize.width = shadowSize;
            dirLight1.shadow.mapSize.height = shadowSize;
            if (dirLight1.shadow.map) {
                dirLight1.shadow.map.dispose();
                dirLight1.shadow.map = null;
            }
        }
        updateShadows();
        requestRender(30);
    }

    if (shouldSave && typeof saveSettings === 'function') {
        saveSettings();
    }
}

function animate(currentTime = 0) {
    requestAnimationFrame(animate);

    // В фоновой вкладке полностью усыпляем рендерер (0% нагрузки на CPU/GPU)
    if (document.hidden) return;

    // Ограничение частоты кадров (60 FPS стандарт/ультра, 30 FPS в экономичном режиме)
    const targetFps = (STATE.preset === 'eco') ? 30 : 60;
    const interval = 1000 / targetFps;
    const delta = currentTime - lastRenderTime;
    if (delta < interval - 1) {
        return;
    }

    // Плавная интерполяция этажей
    for (let f = 1; f <= 7; f++) {
        if (floorGroups[f] && STATE.targetPos[f]) {
            if (floorGroups[f].position.distanceToSquared(STATE.targetPos[f]) > 0.0001) {
                floorGroups[f].position.lerp(STATE.targetPos[f], 0.15);
                if (renderer.shadowMap && renderer.shadowMap.enabled) {
                    renderer.shadowMap.needsUpdate = true;
                }
            } else if (!floorGroups[f].position.equals(STATE.targetPos[f])) {
                floorGroups[f].position.copy(STATE.targetPos[f]);
            }
        }
    }

    // Плавный переход камеры
    if (STATE.targetCamPos) {
        camera.position.lerp(STATE.targetCamPos, 0.14);
        if (camera.position.distanceTo(STATE.targetCamPos) < 0.08) {
            camera.position.copy(STATE.targetCamPos);
            STATE.targetCamPos = null;
        }
    }

    // Плавный переход центра вращения
    if (STATE.targetControlsCenter) {
        controls.target.lerp(STATE.targetControlsCenter, 0.14);
        if (controls.target.distanceTo(STATE.targetControlsCenter) < 0.05) {
            controls.target.copy(STATE.targetControlsCenter);
            STATE.targetControlsCenter = null;
        }
    }

    if (controls) {
        controls.update();
    }

    frameCounter++;
    if (frameCounter % 3 === 0) {
        updateAlignmentGuides();
        updateStairValidationAxes();
        updateLabelsVisibility();
        if (typeof updateAdaptiveLabelScaling === 'function') {
            updateAdaptiveLabelScaling();
        }
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        if (typeof renderScreenSpaceLabels === 'function') {
            renderScreenSpaceLabels();
        }
    }
    lastRenderTime = currentTime - (delta % interval);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
