// ============================================================================
// Фиксированная архитектурная цветовая палитра колледжа (Шалфейный гранит / Шалфейный лес)
const DEFAULT_CAMPUS_COLORS = {
    slab: 0x9faea0,
    coreSlab: 0x9faea0,
    wall: 0x5b6c5d,
    stair: 0x7d5336
};
window.DEFAULT_CAMPUS_COLORS = DEFAULT_CAMPUS_COLORS;

// Каноничная тёмная архитектурная палитра здания (нейтральный графит Material 3 + контрастные стены + сине-серые лестницы)
const DARK_CAMPUS_COLORS = {
    slab: 0x222833,
    coreSlab: 0x1c212b,
    wall: 0x424c5c,
    stair: 0x364962
};
window.DARK_CAMPUS_COLORS = DARK_CAMPUS_COLORS;

const _sharedShelterFrameMat = new THREE.MeshStandardMaterial({
    color: isInitialDark ? 0x475569 : 0xd4dce4,
    roughness: 0.25,
    metalness: 0.88
});

const MATERIALS = {
    // 1. Плиты перекрытий и несущие ядра
    slab: new THREE.MeshStandardMaterial({
        color: isInitialDark ? DARK_CAMPUS_COLORS.slab : DEFAULT_CAMPUS_COLORS.slab,
        roughness: 0.90,
        metalness: 0.02,
        transparent: false,
        opacity: 1.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    coreSlab: new THREE.MeshStandardMaterial({
        color: isInitialDark ? DARK_CAMPUS_COLORS.coreSlab : DEFAULT_CAMPUS_COLORS.coreSlab,
        roughness: 0.90,
        metalness: 0.02,
        transparent: false,
        opacity: 1.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    wall: new THREE.MeshStandardMaterial({
        color: isInitialDark ? DARK_CAMPUS_COLORS.wall : DEFAULT_CAMPUS_COLORS.wall,
        roughness: 0.65,
        metalness: 0.03
    }),
    doorThin: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x56657a : 0x94a3b8,
        roughness: 0.55,
        metalness: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    stair: new THREE.MeshStandardMaterial({
        color: isInitialDark ? DARK_CAMPUS_COLORS.stair : DEFAULT_CAMPUS_COLORS.stair,
        roughness: 0.72,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    elevatorCar: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x334357 : 0xcbd5e1,
        roughness: 0.75
    }),
    edgeMain: new THREE.LineBasicMaterial({ color: isInitialDark ? 0x252c38 : 0x64748b, linewidth: 1 }),
    edgeDoor: new THREE.LineBasicMaterial({ color: isInitialDark ? 0x313c4a : 0x64748b, linewidth: 1 }),
    guideLine: new THREE.LineDashedMaterial({
        color: 0x94a3b8,
        dashSize: 0.45,
        gapSize: 0.3,
        transparent: true,
        opacity: 0.6
    }),
    stairAxisLine: new THREE.LineDashedMaterial({
        color: 0x10b981,
        dashSize: 0.5,
        gapSize: 0.25,
        transparent: true,
        opacity: 0.9
    }),
    stairBoxEdge: new THREE.LineBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.65
    }),
    roof: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x212731 : 0x94a3b8,
        roughness: 0.85,
        metalness: 0.08,
        transparent: false,
        opacity: 1.0
    }),
    edgeRoof: new THREE.LineBasicMaterial({
        color: isInitialDark ? 0x181d24 : 0x475569,
        linewidth: 1
    }),

    // 2. Дороги и территория (минималистичные и 3D)
    minimalRoadSurface: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1d2430 : 0x475569,
        roughness: 0.90,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
    }),
    roadContourLine: new THREE.LineBasicMaterial({
        color: isInitialDark ? 0x94a3b8 : 0x334155,
        linewidth: 1
    }),
    roadCenterLine: new THREE.LineBasicMaterial({
        color: isInitialDark ? 0x475569 : 0x94a3b8,
        linewidth: 1
    }),
    asphaltRoad: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x171d28 : 0x334155,
        roughness: 0.90,
        metalness: 0.04
    }),
    asphaltDriveway: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1d2430 : 0x475569,
        roughness: 0.88,
        metalness: 0.04
    }),
    curb: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x3b4758 : 0x64748b,
        roughness: 0.85,
        metalness: 0.05
    }),
    sidewalk: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x262f3d : 0x94a3b8,
        roughness: 0.85,
        metalness: 0.03
    }),
    lawn: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1f3624 : 0x387a3e,
        roughness: 0.95,
        metalness: 0.0
    }),
    roadMarkingWhite: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x7c8ca1 : 0xf8fafc,
        roughness: 0.5,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    }),
    roadMarkingYellow: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x967228 : 0xf59e0b,
        roughness: 0.5,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    }),

    // 3. Остановочный павильон и навесы
    shelterFrame: _sharedShelterFrameMat,
    shelterFrameStainless: _sharedShelterFrameMat,
    shelterGlass: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x334459 : 0xd8e8f0,
        transparent: true,
        opacity: 0.35,
        roughness: 0.10,
        metalness: 0.15
    }),
    shelterRoof: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x384960 : 0xd4e2ec,
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
        metalness: 0.10,
        side: THREE.DoubleSide
    }),
    shelterRoofGlass: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x384960 : 0xd4e2ec,
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
        metalness: 0.10,
        side: THREE.DoubleSide
    }),
    shelterBench: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x853f18 : 0xb45309,
        roughness: 0.42,
        metalness: 0.02
    }),
    shelterBenchWood: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x853f18 : 0xb45309,
        roughness: 0.42,
        metalness: 0.02
    }),
    shelterBenchLegs: new THREE.MeshStandardMaterial({
        color: 0x242d38,
        roughness: 0.40,
        metalness: 0.60
    }),
    busTimetable: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x7c8ca1 : 0xffffff,
        map: getTimetablePlaceholderTexture(),
        roughness: 0.25,
        metalness: 0.05
    }),
    trolleybusTimetable1: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x7c8ca1 : 0xffffff,
        map: getTimetablePlaceholderTexture(),
        roughness: 0.25,
        metalness: 0.05
    }),
    trolleybusTimetable2: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x7c8ca1 : 0xffffff,
        map: getTimetablePlaceholderTexture(),
        roughness: 0.25,
        metalness: 0.05
    }),
    stainlessSteel: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x4b5c73 : 0xdde4ec,
        roughness: 0.28,
        metalness: 0.88
    }),
    busStopSign: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        metalness: 0.05
    }),
    pedestrianSign: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    pedestrianSignRight: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),

    // 4. Ботанические элементы (деревья, кустарники, живая изгородь)
    birchBark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x94a3b8 : 0xf8fafc,
        roughness: 0.75,
        metalness: 0.04
    }),
    birchFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e4620 : 0x529432,
        roughness: 0.82,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    birchFoliageLight: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x255223 : 0x72b036,
        roughness: 0.78,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    lindenTrunk: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2c221a : 0x473322,
        roughness: 0.90,
        metalness: 0.02
    }),
    lindenFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x224a1f : 0x2e6f2b,
        roughness: 0.80,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    lindenFoliageDark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x163415 : 0x21521f,
        roughness: 0.86,
        metalness: 0.0,
        side: THREE.DoubleSide
    })
};
window.MATERIALS = MATERIALS;
