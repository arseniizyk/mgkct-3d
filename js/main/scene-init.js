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
    const isDarkBg = (typeof STATE !== 'undefined' && STATE.theme === 'dark');
    scene.background = new THREE.Color(isDarkBg ? 0x171c24 : 0xeef2f6);

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

    // Создаём группы для 1–7 этажей и подгруппы Корпусов 1, 2, 3 и 4
    for (let f = 1; f <= 7; f++) {
        floorGroups[f] = new THREE.Group();
        bldg1FloorGroups[f] = new THREE.Group();
        bldg1FloorGroups[f].userData = { building: 1, floor: f };
        bldg2FloorGroups[f] = new THREE.Group();
        bldg2FloorGroups[f].userData = { building: 2, floor: f };
        bldg3FloorGroups[f] = new THREE.Group();
        bldg3FloorGroups[f].userData = { building: 3, floor: f };
        bldg4FloorGroups[f] = new THREE.Group();
        bldg4FloorGroups[f].userData = { building: 4, floor: f };
        bldg5FloorGroups[f] = new THREE.Group();
        bldg5FloorGroups[f].userData = { building: 5, floor: f };
        floorGroups[f].add(bldg1FloorGroups[f]);
        floorGroups[f].add(bldg2FloorGroups[f]);
        floorGroups[f].add(bldg3FloorGroups[f]);
        floorGroups[f].add(bldg4FloorGroups[f]);
        floorGroups[f].add(bldg5FloorGroups[f]);
        scene.add(floorGroups[f]);
    }
    alignmentGuidesGroup = new THREE.Group();
    scene.add(alignmentGuidesGroup);

    stairValidationGroup = new THREE.Group();
    scene.add(stairValidationGroup);

    territoryGroup = new THREE.Group();
    window.territoryGroup = territoryGroup;
    scene.add(territoryGroup);

    roadNetworkGroup = new THREE.Group();
    window.roadNetworkGroup = roadNetworkGroup;
    scene.add(roadNetworkGroup);

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
    if (typeof buildBuilding5Floor1 === 'function') buildBuilding5Floor1(bldg5FloorGroups[1]);

    // Построение стен со сопряжением стыков (устранение взаимного проникновения)
    if (typeof flushAllPendingWalls === 'function') {
        flushAllPendingWalls();
    }

    buildRoofs();
    buildTerritory();
    if (typeof buildRingRoadAroundCollege === 'function') buildRingRoadAroundCollege(roadNetworkGroup);
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
    applyInitialUrlAndBtiParams();
    if (typeof initNavigator === 'function') {
        initNavigator();
    }
    if (typeof initLabelsOverlay === 'function') {
        initLabelsOverlay();
    }

    // Быстрый отклик на любые действия пользователя для On-Demand рендеринга
    ['pointerdown', 'pointermove', 'wheel', 'touchstart', 'touchmove', 'keydown', 'input', 'change'].forEach(evt => {
        window.addEventListener(evt, () => requestRender(25), { passive: true });
    });

    window.addEventListener('resize', (e) => {
        if (typeof onWindowResize === 'function') onWindowResize(e);
        else if (typeof window.onWindowResize === 'function') window.onWindowResize(e);
    });
    updateShadows();
    requestRender(60);
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        if (typeof renderScreenSpaceLabels === 'function') {
            renderScreenSpaceLabels();
        }
    }

    // Отложенная загрузка детальных табличек расписаний в фоновом режиме (Zero main-thread blocking)
    if (typeof loadTimetableTexturesAsync === 'function') {
        loadTimetableTexturesAsync();
    }

    const curAnimId = (typeof animFrameId !== 'undefined') ? animFrameId : window.animFrameId;
    if (curAnimId !== null && curAnimId !== undefined && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(curAnimId);
        animFrameId = null;
        window.animFrameId = null;
    }
    if (typeof animate === 'function') {
        animate();
    } else if (typeof window.animate === 'function') {
        window.animate();
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (document.body) document.body.classList.add('ui-ready');
        });
    });
}
