function updateVisualViewportVars() {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const layoutH = window.innerHeight;
    const vvh = vv ? vv.height : layoutH;
    const vvo = vv ? vv.offsetTop : 0;
    
    // Высота экранной клавиатуры (отступ снизу)
    const keyboardInset = Math.max(0, layoutH - (vvh + vvo));

    document.documentElement.style.setProperty("--vvh", `${Math.round(vvh)}px`);
    document.documentElement.style.setProperty("--vvo", `${Math.round(vvo)}px`);
    document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(keyboardInset)}px`);

    if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
    }
}
window.updateVisualViewportVars = updateVisualViewportVars;

// Адаптивная привязка плавающих кнопок FAB над окном карточки кабинета, маршрута или баннера выбора
function updateAdaptiveFabPosition() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const popup = document.getElementById('room-context-popup');
    const routeCard = document.getElementById('navigator-route-card');
    const pickBanner = document.getElementById('nav-pick-banner');

    let activeCard = null;
    if (pickBanner && !pickBanner.classList.contains('hidden')) {
        activeCard = pickBanner;
    } else if (popup && !popup.classList.contains('hidden')) {
        activeCard = popup;
    } else if (routeCard && !routeCard.classList.contains('hidden')) {
        activeCard = routeCard;
    }

    if (activeCard) {
        const cs = window.getComputedStyle(activeCard);
        const cssBottom = parseFloat(cs.bottom) || 12;
        const layoutHeight = activeCard.offsetHeight || 0;
        const rect = activeCard.getBoundingClientRect();
        const rectFromBottom = (rect && rect.height > 0) ? (window.innerHeight - rect.top) : 0;
        // Используем cssBottom + layoutHeight, чтобы стартовая CSS-анимация (translateY/scale)
        // не занижала позицию кнопок FAB в момент открытия карточки
        const cardTopFromBottom = Math.max(cssBottom + layoutHeight, rectFromBottom);
        if (cardTopFromBottom > 0) {
            const bottomOffset = Math.round(cardTopFromBottom + 12);
            if (bottomOffset > 0 && bottomOffset < window.innerHeight - 30) {
                document.documentElement.style.setProperty('--card-fab-bottom', `${bottomOffset}px`);
                return;
            }
        }
    } else {
        document.documentElement.style.removeProperty('--card-fab-bottom');
    }
}
window.updateAdaptiveFabPosition = updateAdaptiveFabPosition;

function setupVisualViewportHandler() {
    updateVisualViewportVars();
    updateAdaptiveFabPosition();

    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
            updateAdaptiveFabPosition();
        });
        const popup = document.getElementById('room-context-popup');
        const routeCard = document.getElementById('navigator-route-card');
        const pickBanner = document.getElementById('nav-pick-banner');
        if (popup) ro.observe(popup);
        if (routeCard) ro.observe(routeCard);
        if (pickBanner) ro.observe(pickBanner);
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => {
            updateVisualViewportVars();
            updateAdaptiveFabPosition();
        }, { passive: true });
        window.visualViewport.addEventListener("scroll", updateVisualViewportVars, { passive: true });
    }
    window.addEventListener("resize", () => {
        updateVisualViewportVars();
        updateAdaptiveFabPosition();
    }, { passive: true });
    window.addEventListener("orientationchange", () => {
        setTimeout(() => {
            updateVisualViewportVars();
            updateAdaptiveFabPosition();
        }, 100);
        setTimeout(() => {
            updateVisualViewportVars();
            updateAdaptiveFabPosition();
        }, 300);
    }, { passive: true });
}

function setupSettingsDrawer() {
    // Шторка настроек убрана из основного UI; оставляем безопасную заглушку
}



// ==========================================
// Переключатель архитектурных палитр здания (только для спутникового вида)
// ==========================================
function updateBuildingColors() {
    if (typeof MATERIALS === 'undefined') return;
    const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');

    // Архитектурная палитра кампуса (в тёмной теме — нейтральный графит Material 3 + сине-серые лестницы)
    // применяется единообразно как с включенной внешней территорией, так и без нее
    const p = isDark
        ? ((typeof DARK_CAMPUS_COLORS !== 'undefined') ? DARK_CAMPUS_COLORS : {
            slab: 0x222833,
            coreSlab: 0x1c212b,
            wall: 0x424c5c,
            stair: 0x364962
        })
        : ((typeof DEFAULT_CAMPUS_COLORS !== 'undefined') ? DEFAULT_CAMPUS_COLORS : {
            slab: 0x9faea0,
            coreSlab: 0x9faea0,
            wall: 0x5b6c5d,
            stair: 0x7d5336
        });
    if (MATERIALS.slab) MATERIALS.slab.color.setHex(p.slab);
    if (MATERIALS.coreSlab) MATERIALS.coreSlab.color.setHex(p.coreSlab);
    if (MATERIALS.wall) MATERIALS.wall.color.setHex(p.wall);
    if (MATERIALS.stair) MATERIALS.stair.color.setHex(p.stair);
}


window.updateBuildingColors = updateBuildingColors;

function saveSettings() {
    try {
        const payload = {
            preset: STATE.preset || 'balance',
            showShadows: STATE.showShadows ?? false,
            wallHeight: STATE.wallHeight,
            labelScale: STATE.labelScale || 1.0,
            slabOpacity: STATE.slabOpacity,
            showDoors: STATE.showDoors,
            showLabels: STATE.showLabels,
            smartLabelOcclusion: STATE.smartLabelOcclusion,
            showRoof: STATE.showRoof,
            showTerritory: STATE.showTerritory,
            showStairAxes: STATE.showStairAxes,
            showGuides: STATE.showGuides,
            showEdges: STATE.showEdges,
            buildingFilter: STATE.buildingFilter,
            mode: STATE.mode,
            is2D: STATE.is2D,
            sliceMaxFloor: STATE.sliceMaxFloor,
            explodeGap: STATE.explodeGap,
            exploded: STATE.exploded,
            theme: STATE.theme
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('LocalStorage save error:', e);
    }
}

function restoreSavedSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (typeof s.is2D === 'boolean') STATE.is2D = s.is2D;
        // wallHeight вычисляем из is2D — не доверяем сохранённому значению
        STATE.wallHeight = STATE.is2D ? BASE_WALL_HEIGHT : 1.50;
        // Восстанавливаем все сохранённые булевы настройки
        if (typeof s.showDoors === 'boolean') STATE.showDoors = s.showDoors;
        if (typeof s.showLabels === 'boolean') STATE.showLabels = s.showLabels;
        if (typeof s.showEdges === 'boolean') STATE.showEdges = s.showEdges;
        if (typeof s.showRoof === 'boolean') STATE.showRoof = s.showRoof;
        if (typeof s.showTerritory === 'boolean') STATE.showTerritory = s.showTerritory;
        if (typeof s.showStairAxes === 'boolean') STATE.showStairAxes = s.showStairAxes;
        if (typeof s.showGuides === 'boolean') STATE.showGuides = s.showGuides;
        if (typeof s.smartLabelOcclusion === 'boolean') STATE.smartLabelOcclusion = s.smartLabelOcclusion;
        // Числовые настройки с санитарными проверками диапазона
        if (typeof s.labelScale === 'number' && s.labelScale >= 0.5 && s.labelScale <= 3.0) STATE.labelScale = s.labelScale;
        if (typeof s.slabOpacity === 'number' && s.slabOpacity >= 0.1 && s.slabOpacity <= 1.0) STATE.slabOpacity = s.slabOpacity;
        if (typeof s.explodeGap === 'number' && s.explodeGap >= 0 && s.explodeGap <= 14) STATE.explodeGap = s.explodeGap;
        if (typeof s.exploded === 'boolean') STATE.exploded = s.exploded;
        if (typeof s.sliceMaxFloor === 'number' && s.sliceMaxFloor >= 1 && s.sliceMaxFloor <= 7) STATE.sliceMaxFloor = s.sliceMaxFloor;
        // preset восстанавливается только если это валидный вариант
        if (s.preset === 'eco' || s.preset === 'balance' || s.preset === 'ultra') STATE.preset = s.preset;
        if (typeof s.buildingFilter === 'string') STATE.buildingFilter = s.buildingFilter;
        // mode: принимаем числовой этаж или системные режимы
        if (typeof s.mode === 'string' && (/^[1-7]$/.test(s.mode) || s.mode === 'all' || s.mode === 'sideBySide' || s.mode === 'slice')) {
            STATE.mode = s.mode;
        }
        try {
            const explicit = localStorage.getItem('mgkct_theme');
            if (explicit === 'dark' || explicit === 'light') {
                STATE.theme = explicit;
            } else if (s.theme === 'dark' || s.theme === 'light') {
                STATE.theme = s.theme;
            }
        } catch (_) {
            if (s.theme === 'dark' || s.theme === 'light') STATE.theme = s.theme;
        }
    } catch (e) {
        console.warn('[MGKCT] restoreSavedSettings: не удалось разобрать localStorage:', e);
    }
}

function resetSettingsToDefault() {
    try {
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem('mgkct_theme');
    } catch (e) {}

    STATE.preset = 'balance';
    STATE.showShadows = false;
    STATE.is2D = true;
    STATE.wallHeight = BASE_WALL_HEIGHT;
    STATE.labelScale = 1.0;
    STATE.slabOpacity = 1.0;
    STATE.showDoors = true;
    STATE.showLabels = true;
    STATE.smartLabelOcclusion = true;
    STATE.showRoof = false;
    STATE.showTerritory = (typeof ROAD_3D_MINIMALISM !== 'undefined' ? ROAD_3D_MINIMALISM === 0 : false);
    STATE.showStairAxes = false;
    STATE.showGuides = false;
    STATE.showEdges = true;
    STATE.buildingFilter = 'both';
    STATE.mode = '1';
    STATE.sliceMaxFloor = 7;
    STATE.explodeGap = 0.0;
    STATE.exploded = false;

    setBuildingFilter('both', false);
    setMode('1', false);
    setViewMode(true, false);
    setTerritoryMode(STATE.showTerritory, false);
    setLabelScale(1.0);

    if (typeof updateWallHeights === 'function') updateWallHeights();
    if (typeof updateEdgesVisibility === 'function') updateEdgesVisibility();
    if (typeof updateLabelsVisibility === 'function') updateLabelsVisibility();
    if (typeof updateRoofsVisibility === 'function') updateRoofsVisibility();
    if (typeof updateTerritoryVisibility === 'function') updateTerritoryVisibility();
    if (typeof updateBuildingColors === 'function') updateBuildingColors();

    resetToNorth();
    saveSettings();
}
