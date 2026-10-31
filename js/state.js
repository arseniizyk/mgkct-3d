// ==========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ И КОНСТАНТЫ МОДЕЛИ
// ==========================================

let scene, camera, renderer, controls, dirLight1;

// Группы для всех 7 этажей и корпусов
const floorGroups = {};
const bldg1FloorGroups = {};
const bldg2FloorGroups = {};
const bldg3FloorGroups = {};
const bldg4FloorGroups = {};
let alignmentGuidesGroup;
let stairValidationGroup;
let territoryGroup;

// Списки элементов для динамического обновления
const wallMeshes = [];
const wallEdges = [];
const doorMeshes = [];
const doorEdges = [];
const slabMeshes = [];
const stairMeshes = [];
const roofMeshes = [];
const labelSprites = [];
const guideLines = [];
const ROOMS_REGISTRY = [];
const DOORS_REGISTRY = [];
const WALLS_REGISTRY = [];

window.labelSprites = labelSprites;
window.ROOMS_REGISTRY = ROOMS_REGISTRY;
window.DOORS_REGISTRY = DOORS_REGISTRY;
window.WALLS_REGISTRY = WALLS_REGISTRY;

const BASE_WALL_HEIGHT = 0.35; // Минимальная высота стен для удобного чтения карты (вид сверху)
const BASE_FLOOR_STEP = 2.65;
const WALL_SINK = 0.025;

// Габариты Корпуса 2
const B2_X_START = 20.4;
const B2_X_END = 68.0;
const B2_Z_TOP = -13.8;
const B2_Z_CORR_TOP = -7.2;
const B2_Z_CORR_BOT = -4.4;
const B2_Z_BOT = 3.5;

// Единые сквозные координаты лестничных клеток Корпуса 2:
const B2_LK2_X1 = 41.8, B2_LK2_X2 = 45.4;
const B2_LK1_X1 = 64.2, B2_LK1_X2 = 68.0;
const B2_LK3_X1 = 20.4, B2_LK3_X2 = 24.8, B2_LK3_Z_BOT = -10.5;

// Габариты Корпуса 3:
const B3_X_WEST = -1.6;
const B3_X_CORR_W = 4.6;
const B3_X_CORR_E = 7.2;
const B3_X_EAST = 14.0;
const B3_Z_SOUTH = -14.0;
const B3_Z_NORTH = -61.6;

// Единые сквозные координаты лестничных клеток Корпуса 3:
const B3_SHAFT_SOUTH_Z1 = -30.4, B3_SHAFT_SOUTH_Z2 = -26.8;
const B3_SHAFT_NORTH_Z1 = -47.8, B3_SHAFT_NORTH_Z2 = -44.2;

// Габариты Корпуса 4:
const B4_X_WEST = 32.4;
const B4_X_EAST = 66.0;
const B4_Z_NORTH = -61.6;
const B4_Z_MID_N = -49.8;
const B4_Z_MID_S = -45.4;
const B4_Z_SOUTH = -27.4;

// Сквозные шахты лестниц Корпуса 4:
const B4_LK2_X1 = 27.8, B4_LK2_X2 = 32.4, B4_LK2_Z1 = -49.8, B4_LK2_Z2 = -46.8;
const B4_LK3_X1 = 61.4, B4_LK3_X2 = 69.0, B4_LK3_Z1 = -49.8, B4_LK3_Z2 = -45.4;
const B4_LK1_X1 = 38.8, B4_LK1_X2 = 42.4, B4_LK1_Z1 = -31.2, B4_LK1_Z2 = -24.4;

const STATE = {
    theme: localStorage.getItem('mgkct_theme') || 'light',
    buildingFilter: 'both',    // 'both' | '1' | '2' | '3' | '4'
    mode: '1',                 // По умолчанию 1-й этаж как в картах (1..7, 'all', 'sideBySide', 'slice')
    sliceMaxFloor: 7,          // 1..7
    is2D: true,                // Вид сверху (2D карта) по умолчанию
    labelScale: 1.0,           // Масштаб шрифта номеров кабинетов
    exploded: false,
    explodeGap: 0.0,
    wallHeight: BASE_WALL_HEIGHT,
    slabOpacity: 1.0,
    showDoors: true,
    showLabels: true,
    smartLabelOcclusion: true,
    showRoof: false,
    showTerritory: false,
    showStairAxes: false,
    showGuides: false,
    showGrid: false,
    showBtiOverlay: false,
    debugPlan: false,
    showEdges: true,
    showShadows: false,        // Для чистого отображения карты и экономии батареи
    preset: 'balance',         // 'eco' | 'balance' | 'ultra'
    targetPos: {
        1: new THREE.Vector3(0, 0, 0),
        2: new THREE.Vector3(0, BASE_FLOOR_STEP * 1, 0),
        3: new THREE.Vector3(0, BASE_FLOOR_STEP * 2, 0),
        4: new THREE.Vector3(0, BASE_FLOOR_STEP * 3, 0),
        5: new THREE.Vector3(0, BASE_FLOOR_STEP * 4, 0),
        6: new THREE.Vector3(0, BASE_FLOOR_STEP * 5, 0),
        7: new THREE.Vector3(0, BASE_FLOOR_STEP * 6, 0)
    },
    targetCamPos: null,
    targetControlsCenter: null
};

window.STATE = STATE;
window.floorGroups = floorGroups;
window.bldg1FloorGroups = bldg1FloorGroups;
window.bldg2FloorGroups = bldg2FloorGroups;
window.bldg3FloorGroups = bldg3FloorGroups;
window.bldg4FloorGroups = bldg4FloorGroups;
window.territoryGroup = territoryGroup;
window.wallMeshes = wallMeshes;
window.wallEdges = wallEdges;
window.doorMeshes = doorMeshes;
window.doorEdges = doorEdges;
window.slabMeshes = slabMeshes;
window.stairMeshes = stairMeshes;
window.roofMeshes = roofMeshes;
window.guideLines = guideLines;

const STAIR_SHAFTS_VALIDATION = [
    // Корпус 1 (Этажи 1–7)
    { name: 'К1 ЛК№1', bldg: 1, maxFloor: 7, x1: 8.6, x2: 16.0, z1: -3.5, z2: 0.15 },
    { name: 'К1 ЛК№2', bldg: 1, maxFloor: 7, x1: 8.6, x2: 16.0, z1: 0.15, z2: 3.8 },
    // Корпус 2 (Этажи 1–3)
    { name: 'К2 ЛК№2', bldg: 2, maxFloor: 3, x1: B2_LK2_X1, x2: B2_LK2_X2, z1: B2_Z_TOP, z2: B2_Z_CORR_TOP },
    { name: 'К2 ЛК№1', bldg: 2, maxFloor: 3, x1: B2_LK1_X1, x2: B2_LK1_X2, z1: B2_Z_TOP, z2: B2_Z_CORR_TOP },
    // Корпус 3 (Этажи 1–2, западная сторона)
    { name: 'К3 Южная ЛК', bldg: 3, maxFloor: 2, x1: B3_X_WEST, x2: B3_X_CORR_W, z1: B3_SHAFT_SOUTH_Z1, z2: B3_SHAFT_SOUTH_Z2 },
    { name: 'К3 Северная ЛК', bldg: 3, maxFloor: 2, x1: B3_X_WEST, x2: B3_X_CORR_W, z1: B3_SHAFT_NORTH_Z1, z2: B3_SHAFT_NORTH_Z2 },
    // Корпус 4 (Этажи 1–3)
    { name: 'К4 ЛК№2', bldg: 4, maxFloor: 3, x1: B4_LK2_X1, x2: B4_LK2_X2, z1: B4_LK2_Z1, z2: B4_LK2_Z2 },
    { name: 'К4 ЛК№3', bldg: 4, maxFloor: 3, x1: B4_LK3_X1, x2: B4_LK3_X2, z1: B4_LK3_Z1, z2: B4_LK3_Z2 },
    { name: 'К4 ЛК№1', bldg: 4, maxFloor: 3, x1: B4_LK1_X1, x2: B4_LK1_X2, z1: B4_LK1_Z1, z2: B4_LK1_Z2 }
];

const stairShaftDefs = STAIR_SHAFTS_VALIDATION;
const stairValidationItems = [];

const FLOOR_DESCRIPTIONS = {
    '7': 'Этаж 7: Корпус 1 (каб. 701–704)',
    '6': 'Этаж 6: Корпус 1 (каб. 601–605)',
    '5': 'Этаж 5: Корпус 1 (каб. 501–504)',
    '4': 'Этаж 4: Корпус 1 (базовый каркас + ядро лифтов и лестниц)',
    '3': 'Этаж 3: Корпус 1 (301–305) + Корпус 2 (302–318) + Корпус 4 (каркас и лестницы)',
    '2': 'Этаж 2: Корпуса 1, 2, 3 и 4 + надземные переходы К1↔К2, К1↔К3, К3↔К4 и К4↔К2',
    '1': 'Этаж 1: Корпус 1 + Корпус 2 (103–111) + Корпус 3 (102–117) + Корпус 4 (1–24, 102–105)'
};

function getActiveCenterX() {
    if (STATE.buildingFilter === '1') return 1.0;
    if (STATE.buildingFilter === '2') return 44.2;
    if (STATE.buildingFilter === '3') return 5.9;
    if (STATE.buildingFilter === '4') return 48.5;
    return 16.0;
}

function getActiveCenterZ() {
    if (STATE.buildingFilter === '1') return -2.0;
    if (STATE.buildingFilter === '2') return -5.1;
    if (STATE.buildingFilter === '3') return -40.2;
    if (STATE.buildingFilter === '4') return -44.5;
    return -18.0;
}
