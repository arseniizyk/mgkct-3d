// 1. Табличка троллейбусов №1 (Маршруты 19 и 19п)
function createTrolleybusTimetable1Texture() {
    if (typeof document === 'undefined') return createMinimalTexture('#ffffff', 256, 256);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const routes = [
        {
            num: '19',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ст.м. «АЎТАЗАВОДСКАЯ»',
            wheelchair: false,
            date: 'з 20.11.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19'][1] }
            ]
        },
        {
            num: '19п',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ТРАНСПАРТНЫ ПАРК №2 (у парк)',
            wheelchair: false,
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19p'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19p'][1] }
            ]
        }
    ];
    drawMinsktransBoardCanvas(canvas, 'trolley', 'Каледж лічбавых тэхналогій', '57991', routes, false);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

// 2. Табличка троллейбусов №2 (Маршруты 27, 27п, 82, 82п)
function createTrolleybusTimetable2Texture() {
    if (typeof document === 'undefined') return createMinimalTexture('#ffffff', 256, 256);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const routes = [
        {
            num: '27',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ДС «ДРУЖНАЯ»',
            wheelchair: false,
            date: 'з 20.11.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27'][1] }
            ]
        },
        {
            num: '27п',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ТРАНСПАРТНЫ ПАРК №2 (у парк)',
            wheelchair: false,
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27p'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27p'][1] }
            ]
        },
        {
            num: '82',
            dest: 'КАРЖАНЕЎСКАГА — ДС «СЕРАБРАНКА»',
            wheelchair: false,
            date: 'з 20.11.2024',
            days: [
                { label: 'штодз.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['82'][0] }
            ]
        },
        {
            num: '82п',
            dest: 'КАРЖАНЕЎСКАГА — ТРАНСПАРТНЫ ПАРК №2 (у парк)',
            wheelchair: false,
            days: [
                { label: 'штодз.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['82p'][0] }
            ]
        }
    ];
    drawMinsktransBoardCanvas(canvas, 'trolley', 'Каледж лічбавых тэхналогій', '57991', routes, false);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

/**
 * Алиас для обратной совместимости: возвращает текстуру основного
 * расписания троллейбусов (маршруты 19 и 27) для остановки «Колледж технологии и дизайна».
 */
function createTrolleybusTimetableTexture() {
    return createTrolleybusTimetable1Texture();
}

// 3. Табличка автобусов (Маршруты 40 и 107)
function createBusTimetableTexture() {
    if (typeof document === 'undefined') return createMinimalTexture('#ffffff', 256, 256);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const routes = [
        {
            num: '40',
            dest: 'ЛАНДЭРА — ДС «КУНЦАЎШЧЫНА»',
            wheelchair: true,
            date: 'з 20.11.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.buses['40'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.buses['40'][1] }
            ]
        },
        {
            num: '107',
            dest: 'КАРЖАНЕЎСКАГА — ДС «КУНЦАЎШЧЫНА»',
            wheelchair: true,
            date: 'з 01.12.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.buses['107'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.buses['107'][1] }
            ]
        }
    ];
    drawMinsktransBoardCanvas(canvas, 'bus', 'Каледж лічбавых тэхналогій', '57991', routes, true);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}
function createBusStopSignTexture() { return createMinimalTexture('#0284c7', 256, 256); }
function createPedestrianSignTexture(flip = false) { return createMinimalTexture('#0284c7', 256, 256); }
function createBirchBarkTexture() { return createMinimalTexture('#f8fafc', 256, 256); }
function createBirchBarkBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createLindenBarkTexture() { return createMinimalTexture('#473322', 256, 256); }
function createLindenFoliageTexture() { return createMinimalTexture('#2e6f2b', 256, 256); }
function createSpruceBarkTexture() { return createMinimalTexture('#382419', 256, 256); }
function createSpruceNeedleTexture() { return createMinimalTexture('#184223', 256, 256); }
function createHedgeFoliageTexture() { return createMinimalTexture('#275e2c', 256, 256); }
function createHedgeBumpTexture() { return createMinimalTexture('#808080', 256, 256); }
function createSoilMulchTexture() { return createMinimalTexture('#2a1d17', 256, 256); }
function createLawnTexture() { return createMinimalTexture('#387a3e', 256, 256); }
function createCollegeSteleLogoTexture() { return createMinimalTexture('#0284c7', 256, 256); }
function createWoodPlankTexture() { return createMinimalTexture('#b45309', 256, 256); }
function createWoodPlankBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createBrushedDarkMetalTexture() { return createMinimalTexture('#1e293b', 256, 256); }
function createBrushedMetalBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createPaverTileTexture() { return createMinimalTexture('#f1f5f9', 256, 256); }
function createPaverTileBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createTrafficBackplateTexture() { return createMinimalTexture('#0f172a', 256, 256); }
function createPedestrianTrafficLensTexture(color = 'red') { return createMinimalTexture(color === 'red' ? '#ef4444' : '#10b981', 256, 256); }
function createPedestrianButtonPlateTexture() { return createMinimalTexture('#facc15', 256, 256); }


// ============================================================================
// АСИНХРОННЫЙ ОТЛОЖЕННЫЙ ЗАГРУЗЧИК ВЫСОКОДЕТАЛИЗИРОВАННЫХ ТАБЛИЧЕК РАСПИСАНИЙ
// Оптимизация: генерация тяжелых Canvas 2D вынесена в requestIdleCallback / таймер,
// исключая блокировку главного потока при начальном парсинге и рендеринге 3D-сцены.
// ============================================================================
let _timetablesLoaded = false;
function loadTimetableTexturesAsync() {
    if (_timetablesLoaded) return;
    _timetablesLoaded = true;

    const doLoad = () => {
        try {
            const texBus = createBusTimetableTexture();
            const texTrolley1 = createTrolleybusTimetable1Texture();
            const texTrolley2 = createTrolleybusTimetable2Texture();

            if (MATERIALS.busTimetable) {
                MATERIALS.busTimetable.map = texBus;
                MATERIALS.busTimetable.needsUpdate = true;
            }
            if (MATERIALS.trolleybusTimetable1) {
                MATERIALS.trolleybusTimetable1.map = texTrolley1;
                MATERIALS.trolleybusTimetable1.needsUpdate = true;
            }
            if (MATERIALS.trolleybusTimetable2) {
                MATERIALS.trolleybusTimetable2.map = texTrolley2;
                MATERIALS.trolleybusTimetable2.needsUpdate = true;
            }
            if (typeof requestRender === 'function') {
                requestRender(15);
            }
        } catch (e) {
            console.warn('Async timetable texture generation:', e);
        }
    };

    if (typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(doLoad, { timeout: 2000 });
        } else if ('requestAnimationFrame' in window) {
            window.requestAnimationFrame(() => doLoad());
        } else {
            doLoad();
        }
    } else {
        doLoad();
    }
}

window.loadTimetableTexturesAsync = loadTimetableTexturesAsync;

// Централизованное освобождение WebGL материалов и текстур для предотвращения утечек GPU
function disposeAllMaterials() {
    if (typeof MATERIALS === 'undefined' || !MATERIALS) return;
    for (const key of Object.keys(MATERIALS)) {
        const mat = MATERIALS[key];
        if (!mat) continue;
        if (mat.map && typeof mat.map.dispose === 'function') {
            mat.map.dispose();
        }
        if (mat.lightMap && typeof mat.lightMap.dispose === 'function') {
            mat.lightMap.dispose();
        }
        if (typeof mat.dispose === 'function') {
            mat.dispose();
        }
    }
}
window.disposeAllMaterials = disposeAllMaterials;
