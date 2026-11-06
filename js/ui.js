// Вспомогательная функция для безопасного экранирования HTML перед вставкой в innerHTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==========================================
// ОБРАБОТКА ПОЛЬЗОВАТЕЛЬСКОГО ИНТЕРФЕЙСА (UI)
// ИНТЕРАКТИВНАЯ КАРТА КОЛЛЕДЖА (2D / 3D)
// ==========================================

const SETTINGS_KEY = 'college_3d_map_settings_v3';

// getSystemTheme импортирован из единого источника истины в js/state.js

function setTheme(themeName, shouldSave = false) {
    if (themeName !== 'dark' && themeName !== 'light') {
        themeName = getSystemTheme();
    }
    STATE.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    if (document.body) {
        document.body.setAttribute('data-theme', themeName);
    }

    const isDark = (themeName === 'dark');

    // 3D Three.js сцена (приятный картографический фон)
    if (typeof scene !== 'undefined' && scene) {
        scene.background = new THREE.Color(isDark ? 0x0b0f17 : 0xeef2f6);
    }

    // 3D Three.js материалы (сбалансированная палитра для светлого и тёмного режима)
    if (typeof MATERIALS !== 'undefined') {
        if (isDark) {
            // ТЁМНАЯ ТЕМА:
            if (MATERIALS.slab) MATERIALS.slab.color.setHex(0x161f2e);
            if (MATERIALS.coreSlab) MATERIALS.coreSlab.color.setHex(0x121a26);
            if (MATERIALS.wall) MATERIALS.wall.color.setHex(0x283548);
            if (MATERIALS.stair) MATERIALS.stair.color.setHex(0x222e40);
            if (MATERIALS.elevatorCar) MATERIALS.elevatorCar.color.setHex(0x1e293b);
            if (MATERIALS.doorThin) MATERIALS.doorThin.color.setHex(0x3b4d66);
            if (MATERIALS.edgeMain) MATERIALS.edgeMain.color.setHex(0x475569);
            if (MATERIALS.edgeDoor) MATERIALS.edgeDoor.color.setHex(0x475569);
            if (MATERIALS.roof) MATERIALS.roof.color.setHex(0x1e293b);
            if (MATERIALS.edgeRoof) MATERIALS.edgeRoof.color.setHex(0x475569);
            if (MATERIALS.guideLine) MATERIALS.guideLine.color.setHex(0x475569);
            if (MATERIALS.minimalRoadSurface) MATERIALS.minimalRoadSurface.color.setHex(0x1e293b);
            if (MATERIALS.roadContourLine) MATERIALS.roadContourLine.color.setHex(0x94a3b8);
            if (MATERIALS.roadCenterLine) MATERIALS.roadCenterLine.color.setHex(0x475569);
            // Прилегающая территория в тёмной теме
            if (MATERIALS.asphaltRoad) MATERIALS.asphaltRoad.color.setHex(0x18202c);
            if (MATERIALS.asphaltDriveway) MATERIALS.asphaltDriveway.color.setHex(0x1e293b);
            if (MATERIALS.curb) MATERIALS.curb.color.setHex(0x475569);
            if (MATERIALS.sidewalk) MATERIALS.sidewalk.color.setHex(0x2d3748);
            if (MATERIALS.lawn) MATERIALS.lawn.color.setHex(0x16331a);
            if (MATERIALS.treeFoliage) MATERIALS.treeFoliage.color.setHex(0x1e4620);
            if (MATERIALS.treeFoliageLight) MATERIALS.treeFoliageLight.color.setHex(0x2d5a27);
            if (MATERIALS.birchFoliage) MATERIALS.birchFoliage.color.setHex(0x2e541b);
            if (MATERIALS.lindenFoliage) MATERIALS.lindenFoliage.color.setHex(0x224a1f);
            if (MATERIALS.spruceNeedle) MATERIALS.spruceNeedle.color.setHex(0x183a1d);
            if (MATERIALS.hedgeFoliage) MATERIALS.hedgeFoliage.color.setHex(0x1e3a24);
            if (MATERIALS.soilMulch) MATERIALS.soilMulch.color.setHex(0x1f140e);
            if (MATERIALS.steleGranite) MATERIALS.steleGranite.color.setHex(0x1f2937);
            if (MATERIALS.forecourtPaverLight) MATERIALS.forecourtPaverLight.color.setHex(0x222d3d);
            if (MATERIALS.forecourtPaverDark) MATERIALS.forecourtPaverDark.color.setHex(0x161e2a);
            if (MATERIALS.campusBenchWood) MATERIALS.campusBenchWood.color.setHex(0x9a3412);
        } else {
            // Светлая тема:
            if (typeof updateBuildingColors === 'function') {
                updateBuildingColors();
            }
            if (MATERIALS.elevatorCar) MATERIALS.elevatorCar.color.setHex(0xcbd5e1);
            if (MATERIALS.doorThin) MATERIALS.doorThin.color.setHex(0x94a3b8);
            if (MATERIALS.edgeMain) MATERIALS.edgeMain.color.setHex(0x475569);
            if (MATERIALS.edgeDoor) MATERIALS.edgeDoor.color.setHex(0x64748b);
            if (MATERIALS.roof) MATERIALS.roof.color.setHex(0x94a3b8);
            if (MATERIALS.edgeRoof) MATERIALS.edgeRoof.color.setHex(0x475569);
            if (MATERIALS.guideLine) MATERIALS.guideLine.color.setHex(0x94a3b8);
            if (MATERIALS.minimalRoadSurface) MATERIALS.minimalRoadSurface.color.setHex(0xc8d1dc);
            if (MATERIALS.roadContourLine) MATERIALS.roadContourLine.color.setHex(0x334155);
            if (MATERIALS.roadCenterLine) MATERIALS.roadCenterLine.color.setHex(0x94a3b8);
            // Прилегающая территория в светлой теме
            if (MATERIALS.asphaltRoad) MATERIALS.asphaltRoad.color.setHex(0x334155);
            if (MATERIALS.asphaltDriveway) MATERIALS.asphaltDriveway.color.setHex(0x475569);
            if (MATERIALS.curb) MATERIALS.curb.color.setHex(0x64748b);
            if (MATERIALS.sidewalk) MATERIALS.sidewalk.color.setHex(0x94a3b8);
            if (MATERIALS.lawn) MATERIALS.lawn.color.setHex(0x387a3e);
            if (MATERIALS.treeFoliage) MATERIALS.treeFoliage.color.setHex(0x22c55e);
            if (MATERIALS.treeFoliageLight) MATERIALS.treeFoliageLight.color.setHex(0x4ade80);
            if (MATERIALS.birchFoliage) MATERIALS.birchFoliage.color.setHex(0x529432);
            if (MATERIALS.lindenFoliage) MATERIALS.lindenFoliage.color.setHex(0x2e6f2b);
            if (MATERIALS.spruceNeedle) MATERIALS.spruceNeedle.color.setHex(0x184223);
            if (MATERIALS.hedgeFoliage) MATERIALS.hedgeFoliage.color.setHex(0x275e2c);
            if (MATERIALS.soilMulch) MATERIALS.soilMulch.color.setHex(0x2a1d17);
            if (MATERIALS.steleGranite) MATERIALS.steleGranite.color.setHex(0x475569);
            if (MATERIALS.forecourtPaverLight) MATERIALS.forecourtPaverLight.color.setHex(0xf1f5f9);
            if (MATERIALS.forecourtPaverDark) MATERIALS.forecourtPaverDark.color.setHex(0x64748b);
            if (MATERIALS.campusBenchWood) MATERIALS.campusBenchWood.color.setHex(0xb45309);
        }
    }

    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
        sunIcon.classList.toggle('hidden', !isDark);
        moonIcon.classList.toggle('hidden', isDark);
    }

    if (shouldSave) {
        try {
            localStorage.setItem('mgkct_theme', themeName);
        } catch (_) {}
        if (typeof saveSettings === 'function') {
            saveSettings();
        }
    }

    if (typeof requestRender === 'function') {
        requestRender(30);
    }
}

// Автоматическое динамическое переключение темы при смене системной темы на телефоне / ПК
// (применяется только если пользователь явно не выбрал тему вручную)
if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
        let hasUserTheme = false;
        try { hasUserTheme = Boolean(localStorage.getItem('mgkct_theme')); } catch (_) {}
        if (!hasUserTheme) {
            setTheme(e.matches ? 'dark' : 'light', false);
        }
    };
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleSystemThemeChange);
    }

    // Проверка актуальной темы при возврате во вкладку / разблокировке телефона (только если нет ручного выбора)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            let hasUserTheme = false;
            try { hasUserTheme = Boolean(localStorage.getItem('mgkct_theme')); } catch (_) {}
            if (!hasUserTheme) {
                setTheme(getSystemTheme(), false);
            }
        }
    });
    window.addEventListener('focus', () => {
        let hasUserTheme = false;
        try { hasUserTheme = Boolean(localStorage.getItem('mgkct_theme')); } catch (_) {}
        if (!hasUserTheme) {
            setTheme(getSystemTheme(), false);
        }
    });
}
window.setTheme = setTheme;
window.getSystemTheme = getSystemTheme;

const BUILDING_MAX_FLOORS = {
    'both': 7,
    '1': 7,
    '2': 3,
    '3': 2,
    '4': 3,
    '5': 1
};

const BUILDING_NAMES = {
    'both': 'Все корпуса',
    '1': 'Корпус 1',
    '2': 'Корпус 2',
    '3': 'Корпус 3',
    '4': 'Корпус 4',
    '5': 'Гараж (Хозстроение)'
};

function updateTopFloorBadge() {
    const badge = document.getElementById('top-floor-badge');
    if (!badge) return;

    if (STATE.mode === 'all') {
        badge.textContent = 'Все этажи (3D)';
    } else if (STATE.mode === 'sideBySide') {
        badge.textContent = 'Сравнение рядом';
    } else if (STATE.mode === 'slice') {
        badge.textContent = `Срез 1–${STATE.sliceMaxFloor} эт.`;
    } else {
        badge.textContent = `${STATE.mode} этаж`;
    }
}

function updateInfoCard(title, desc) {
    const titleEl = document.getElementById('info-card-title');
    const descEl = document.getElementById('info-card-desc');
    if (titleEl && title) titleEl.textContent = title;
    if (descEl && desc) descEl.textContent = desc;
}

function updateFloorButtonsAvailability() {
    const maxF = BUILDING_MAX_FLOORS[STATE.buildingFilter] || 7;
    for (let f = 1; f <= 7; f++) {
        const btn = document.getElementById(`floor-btn-${f}`);
        if (btn) {
            if (f <= maxF) {
                btn.classList.remove('disabled');
            } else {
                btn.classList.add('disabled');
            }
        }
    }
}

function setBuildingFilter(bFilter, shouldAnimateCam = true) {
    if (STATE.buildingFilter === bFilter && bFilter !== 'both') {
        bFilter = 'both';
    }

    STATE.buildingFilter = bFilter;

    document.querySelectorAll('.bldg-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.bldg === bFilter);
    });

    const btnAllBldg = document.getElementById('btn-toggle-all-bldg') || document.getElementById('btn-bldg-all');
    if (btnAllBldg) {
        btnAllBldg.classList.toggle('mode-active', bFilter === 'both');
        btnAllBldg.classList.toggle('active', bFilter === 'both');
    }

    updateFloorButtonsAvailability();
    const maxAllowed = BUILDING_MAX_FLOORS[bFilter] || 7;
    if (STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice') {
        const currF = parseInt(STATE.mode, 10);
        if (currF > maxAllowed) {
            setMode(String(maxAllowed), false);
        }
    }

    if (shouldAnimateCam && camera && controls) {
        if (typeof resetControlsMomentum === 'function') resetControlsMomentum();
        const cx = getActiveCenterX();
        const cz = getActiveCenterZ();
        const isMobile = window.innerWidth < 768;
        const distY = isMobile
            ? (bFilter === 'both' ? 68 : 46)
            : (bFilter === 'both' ? 75 : 48);
        const offsetZ = isMobile ? (bFilter === 'both' ? 22 : 16) : 24;

        STATE.targetControlsCenter = new THREE.Vector3(cx, 0, cz);
        if (STATE.is2D) {
            STATE.targetCamPos = new THREE.Vector3(cx, distY, cz + offsetZ);
        } else {
            STATE.targetCamPos = new THREE.Vector3(cx - 24, distY * 0.75, cz + 52);
        }
    }

    recalcTargetPositions();
    updateAlignmentGuides();
    updateStairValidationAxes();
    updateFloorInfo();
    saveSettings();
}

function updateFloorInfo() {
    if (STATE.mode === 'all') {
        updateInfoCard('Все этажи комплекса', '3D модель: Корпус 1 (1–7 эт.), К-2 (1–3 эт.), К-3 (1–2 эт.), К-4 (1–3 эт.)');
    } else if (STATE.mode === 'sideBySide') {
        updateInfoCard('Сравнение рядом', 'Все этажи разложены на одной горизонтальной плоскости');
    } else if (STATE.mode === 'slice') {
        updateInfoCard(`Срез: этажи 1–${STATE.sliceMaxFloor}`, 'Сверху срезаны верхние этажи');
    } else {
        const fDesc = FLOOR_DESCRIPTIONS[STATE.mode] || `Этаж ${STATE.mode}`;
        const bName = BUILDING_NAMES[STATE.buildingFilter] || 'Все корпуса';
        updateInfoCard(`Этаж ${STATE.mode} (${bName})`, fDesc);
    }
    updateTopFloorBadge();
}

function setMode(newMode, shouldSave = true) {
    STATE.mode = newMode;

    if (document.body) {
        document.body.classList.toggle('mode-all-floors', newMode === 'all');
    }

    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.floor === newMode);
    });

    const btnAllFloors = document.getElementById('btn-toggle-all-floors');
    if (btnAllFloors) {
        btnAllFloors.classList.toggle('mode-active', newMode === 'all');
        btnAllFloors.classList.toggle('active', newMode === 'all');
    }

    // Синхронизируем этажные таблетки в карточке активного маршрута
    document.querySelectorAll('#nav-card-floors .m3-nav-floor-pill').forEach(btn => {
        btn.classList.toggle('active-pill', btn.textContent.trim() === String(newMode));
    });

    // Скрываем контекстный попап кабинета, только если выбранный этаж стал невидим
    if (currentPopupRoom) {
        let roomIsVisible = true;
        if (newMode === 'slice') {
            roomIsVisible = (currentPopupRoom.floor <= (STATE.sliceMaxFloor || 7));
        } else if (newMode !== 'all' && newMode !== 'sideBySide') {
            roomIsVisible = (String(currentPopupRoom.floor) === String(newMode));
        }
        if (!roomIsVisible) {
            hideRoomContextPopup();
        }
    }

    // При выборе режима «Все этажи» переводим камеру на комфортный общий ракурс 3D здания
    if (newMode === 'all' && camera && controls) {
        if (STATE.is2D && typeof setViewMode === 'function') {
            setViewMode(false, false);
        }
        if (typeof resetControlsMomentum === 'function') resetControlsMomentum();
        const cx = getActiveCenterX();
        const cz = getActiveCenterZ();
        const isMobile = window.innerWidth < 768;
        const distY = isMobile ? 65 : 55;
        STATE.targetControlsCenter = new THREE.Vector3(cx, 6, cz);
        STATE.targetCamPos = new THREE.Vector3(cx - 30, distY, cz + (isMobile ? 55 : 65));
    }

    updateFloorInfo();
    recalcTargetPositions();
    updateAlignmentGuides();
    updateStairValidationAxes();

    if (typeof updateRouteVisibilityForCurrentMode === 'function') {
        updateRouteVisibilityForCurrentMode();
    }
    window.dispatchEvent(new CustomEvent('floorChanged', { detail: { floor: newMode } }));

    if (shouldSave) saveSettings();
}

function setSliceFloor(newFloor) {
    newFloor = Math.max(1, Math.min(7, Math.round(newFloor)));
    STATE.sliceMaxFloor = newFloor;

    const sliderSlice = document.getElementById('slider-slice');
    const valSlice = document.getElementById('slice-val');
    if (sliderSlice) sliderSlice.value = newFloor;
    if (valSlice) valSlice.textContent = newFloor === 1 ? '1 эт.' : `1–${newFloor} эт.`;

    if (newFloor === 7) {
        setMode('all');
    } else {
        // Используем setMode() чтобы корректно обновить кнопки, маршруты,
        // dispatchEvent('floorChanged') и все сопряжённые подсистемы.
        setMode('slice', false);
        saveSettings();
    }
}



function toggle2DView() {
    setViewMode(!STATE.is2D);
}

function setTerritoryMode(enabled, shouldSave = true) {
    STATE.showTerritory = !!enabled;
    const btnTerritory = document.getElementById('btn-toggle-territory');
    if (btnTerritory) {
        btnTerritory.classList.toggle('mode-active', STATE.showTerritory);
        btnTerritory.title = STATE.showTerritory
            ? 'Прилегающая территория: включена (нажмите, чтобы скрыть)'
            : 'Прилегающая территория: выключена (нажмите, чтобы показать)';
    }
    const tTerritory = document.getElementById('toggle-territory');
    if (tTerritory) {
        tTerritory.checked = STATE.showTerritory;
    }
    if (typeof updateTerritoryVisibility === 'function') {
        updateTerritoryVisibility();
    }
    if (typeof updateBuildingColors === 'function') {
        updateBuildingColors();
    }
    if (shouldSave) saveSettings();
}

function toggleTerritoryView() {
    setTerritoryMode(!STATE.showTerritory, true);
}

function updateCameraViewButtons(activeId) {
    ['btn-view-top', 'btn-view-3d', 'btn-view-305', 'btn-view-side'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.toggle('active', id === activeId);
        }
    });
}

function updateWallHeightButtons(height) {
    const h = parseFloat(height);
    document.getElementById('btn-wall-min')?.classList.toggle('active', Math.abs(h - 0.35) < 0.08);
    document.getElementById('btn-wall-mid')?.classList.toggle('active', Math.abs(h - 1.20) < 0.08);
    document.getElementById('btn-wall-max')?.classList.toggle('active', Math.abs(h - 2.40) < 0.08);
}

function setViewMode(is2D, shouldAnimateCam = true) {
    STATE.is2D = is2D;
    const btn2D = document.getElementById('btn-toggle-2d');
    if (btn2D) {
        btn2D.textContent = is2D ? '2D' : '3D';
        btn2D.classList.toggle('mode-active', !is2D);
        btn2D.title = is2D ? 'Режим: 2D карта (нажмите для 3D)' : 'Режим: 3D изометрия (нажмите для 2D)';
    }

    updateCameraViewButtons(is2D ? 'btn-view-top' : 'btn-view-3d');

    // Автоматическая адаптация высоты стен под режим 2D (0.35 м для чтения карты) и 3D (1.50 м для объёма)
    const targetWallH = is2D ? BASE_WALL_HEIGHT : 1.50;
    if (Math.abs(STATE.wallHeight - targetWallH) > 0.02) {
        setWallHeight(targetWallH, false);
    }

    if (typeof apply2DControls === 'function') {
        apply2DControls(is2D);
    }

    if (shouldAnimateCam && camera && controls) {
        if (typeof resetControlsMomentum === 'function') resetControlsMomentum();
        const cx = controls ? controls.target.x : getActiveCenterX();
        const cz = controls ? controls.target.z : getActiveCenterZ();
        const isMobile = window.innerWidth < 768;
        const isBoth = STATE.buildingFilter === 'both';
        const distY = isMobile ? (isBoth ? 54 : 42) : (isBoth ? 68 : 46);
        const offsetZ = isMobile ? (isBoth ? 18 : 14) : 22;

        STATE.targetControlsCenter = new THREE.Vector3(cx, 0, cz);
        if (is2D) {
            STATE.targetCamPos = new THREE.Vector3(cx, distY, cz + offsetZ);
        } else {
            const maxF = STATE.mode === 'slice' ? STATE.sliceMaxFloor : (STATE.mode === 'all' ? 7 : 1);
            const midY = ((STATE.mode === 'all' || STATE.mode === 'slice') && STATE.exploded)
                ? (STATE.wallHeight + STATE.explodeGap) * (maxF / 2)
                : (STATE.wallHeight * 0.45 * maxF);
            STATE.targetCamPos = new THREE.Vector3(cx - 24, 52 + midY, cz + 52);
        }
    }

    if (typeof updateFloorsInteriorVisibility === 'function') {
        updateFloorsInteriorVisibility();
    }
    if (typeof updateEdgesVisibility === 'function') {
        updateEdgesVisibility();
    }
    if (typeof updateBuildingColors === 'function') {
        updateBuildingColors();
    }

    if (typeof requestRender === 'function') requestRender(45);
    saveSettings();
}

function resetToNorth() {
    if (typeof resetControlsMomentum === 'function') resetControlsMomentum();
    const cx = getActiveCenterX();
    const cz = getActiveCenterZ();
    const isMobile = window.innerWidth < 768;
    const isBoth = STATE.buildingFilter === 'both';
    const distY = isMobile ? (isBoth ? 54 : 42) : 68;
    const offsetZ = isMobile ? (isBoth ? 18 : 14) : 22;

    STATE.targetControlsCenter = new THREE.Vector3(cx, 0, cz);
    if (STATE.is2D) {
        STATE.targetCamPos = new THREE.Vector3(cx, distY, cz + offsetZ);
    } else {
        STATE.targetCamPos = new THREE.Vector3(cx - 24, 56, cz + 54);
    }

    if (typeof requestRender === 'function') requestRender(45);
}

function setWallHeight(newHeight, shouldSave = true) {
    newHeight = Math.max(0.15, Math.min(3.5, parseFloat(newHeight)));
    STATE.wallHeight = newHeight;

    const slider = document.getElementById('slider-wall-height');
    const val = document.getElementById('wall-height-val');
    if (slider) slider.value = newHeight;
    if (val) val.textContent = newHeight.toFixed(2) + ' м';

    updateWallHeightButtons(newHeight);

    if (typeof updateWallHeights === 'function') {
        updateWallHeights();
    }
    if (shouldSave) saveSettings();
}

function setLabelScale(scale) {
    STATE.labelScale = scale;

    let btnId = 'btn-labelsize-large';
    if (scale <= 0.85) btnId = 'btn-labelsize-normal';
    else if (scale >= 1.25) btnId = 'btn-labelsize-xl';

    ['btn-labelsize-normal', 'btn-labelsize-large', 'btn-labelsize-xl'].forEach(id => {
        document.getElementById(id)?.classList.toggle('active', id === btnId);
    });

    if (typeof updateRoomLabelsScale === 'function') {
        updateRoomLabelsScale();
    }
    if (typeof requestRender === 'function') requestRender(20);
    saveSettings();
}

// Выбор кабинета (при клике на карте или в поиске)
function selectRoom(roomInfo, shouldFly = true) {
    if (!roomInfo) return;

    // Включаем нужный этаж
    if (String(roomInfo.floor) !== String(STATE.mode)) {
        setMode(String(roomInfo.floor));
    }

    // Очищаем поисковую строку после найденного кабинета
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    if (searchInput) {
        searchInput.value = '';
    }
    if (btnClearSearch) {
        btnClearSearch.classList.add('hidden');
    }

    // Обновляем текст в поисковом виджете шапки
    const { codeLabel, displayTitle, subtitle } = formatSearchRoomBadgeAndTitle(roomInfo);
    const widgetText = document.getElementById('search-widget-text');
    if (widgetText) {
        widgetText.textContent = `${displayTitle} (${codeLabel})`;
    }
    const cardSub = subtitle ? `${subtitle} • Корпус ${roomInfo.building} • ${roomInfo.floor} этаж` : `Корпус ${roomInfo.building} • ${roomInfo.floor} этаж`;
    updateInfoCard(displayTitle, cardSub);

    if (shouldFly && camera && controls) {
        if (typeof resetControlsMomentum === 'function') resetControlsMomentum();
        const targetY = STATE.is2D ? 38 : 28;
        const camZOffset = STATE.is2D ? 14 : 30;
        const camXOffset = STATE.is2D ? 0 : -14;

        STATE.targetControlsCenter = new THREE.Vector3(roomInfo.x, 0, roomInfo.z);
        STATE.targetCamPos = new THREE.Vector3(roomInfo.x + camXOffset, targetY, roomInfo.z + camZOffset);
    }

    if (navigator.vibrate) {
        navigator.vibrate(12);
    }

    if (typeof requestRender === 'function') requestRender(60);
}

// ============================================================================
// БАЗА ДАННЫХ ДИСЦИПЛИН И ПРЕПОДАВАТЕЛЕЙ
// Загружается динамически из локального файла (без хардкода в коде репозитория)
// ============================================================================
let ROOM_DISCIPLINES = (typeof window !== 'undefined' && window.ROOM_DISCIPLINES) ? window.ROOM_DISCIPLINES : {};
let roomDisciplinesAbortController = null;

function loadRoomDisciplines() {
    if (ROOM_DISCIPLINES && Object.keys(ROOM_DISCIPLINES).length > 0) {
        return;
    }
    if (roomDisciplinesAbortController) {
        roomDisciplinesAbortController.abort();
    }
    roomDisciplinesAbortController = new AbortController();
    const signal = roomDisciplinesAbortController.signal;

    fetch('data/teachers.json', { signal })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (signal.aborted) return;
            if (data && typeof data === 'object') {
                ROOM_DISCIPLINES = data;
                if (typeof window !== 'undefined') window.ROOM_DISCIPLINES = data;
                if (typeof NAV_STATE !== 'undefined' && NAV_STATE && NAV_STATE.graph && NAV_STATE.graph.nodes) {
                    for (const node of NAV_STATE.graph.nodes.values()) {
                        node._searchKeywords = null;
                    }
                }
                const searchInput = document.getElementById('search-input');
                if (typeof renderSearchResults === 'function') {
                    renderSearchResults(searchInput ? searchInput.value : '');
                } else if (typeof window !== 'undefined' && typeof window.renderSearchResults === 'function') {
                    window.renderSearchResults(searchInput ? searchInput.value : '');
                }
            }
        })
        .catch(err => {
            if (err && err.name === 'AbortError') return;
            // Файл отсутствует в публичном репозитории — работаем в штатном режиме
        });
}
loadRoomDisciplines();

// Функция определения названия дисциплины и преподавателя для аудитории
function getRoomSubjectAndTeacher(building, floor, code, rawText) {
    const b = parseInt(building, 10) || 1;
    const f = parseInt(floor, 10) || 1;
    const stripped = (code || "").replace(/^[1-4]-/, "").trim();
    const full = b > 1 ? `${b}-${stripped}` : stripped;

    // Прямой поиск по всем возможным составным ключам
    const candidates = b > 1 ? [
        `${b}-${f}-${full}`,
        `${b}-${f}-${stripped}`,
        full,
        `${b}-${stripped}`
    ] : [
        `1-${f}-${stripped}`,
        full,
        stripped,
        code
    ];

    for (const k of candidates) {
        if (ROOM_DISCIPLINES && ROOM_DISCIPLINES[k]) {
            return ROOM_DISCIPLINES[k];
        }
    }

    // Хозяйственные и специальные помещения
    if (b === 4 && f === 1 && stripped === "101") {
        return { subject: "Технический архив и серверная", teacher: "" };
    }
    if (b === 4 && f === 1 && stripped === "106") {
        return { subject: "Склад материально-технического снабжения", teacher: "" };
    }

    if (b === 4 && f === 1 && /^\d+$/.test(stripped) && parseInt(stripped, 10) <= 24) {
        return { subject: `Служебное помещение №${stripped}`, teacher: "" };
    }

    return { subject: "", teacher: "" };
}

// Форматирование короткого бейджа и заголовка кабинета для поиска (Предмет + ФИО преподавателя)
function formatSearchRoomBadgeAndTitle(item) {
    const rawOrig = (item.rawText || item.text || "").trim();
    const lines = rawOrig.split("\n").map(s => s.trim()).filter(Boolean);
    const firstLine = lines[0] || "";
    const secondLine = lines.slice(1).join(" ");
    const b = item.building;
    const f = item.floor;

    let codeNum = firstLine;
    let title = "";
    let subtitle = "";

    // Специальные залы и знаковые помещения
    if (b === 4 && f === 1 && /столов/i.test(rawOrig)) {
        codeNum = "102";
        title = "Столовая";
        subtitle = "Зона питания и буфет";
    } else if (b === 1 && f === 1 && /гардероб/i.test(rawOrig)) {
        codeNum = "102";
        title = "Гардероб";
        subtitle = "Раздевалка и приём одежды";
    } else if (b === 2 && f === 1 && /библиот/i.test(rawOrig)) {
        codeNum = "104";
        title = "Библиотека";
        subtitle = "Читальный зал и книжный фонд";
    } else if (b === 4 && f === 2 && /актов/i.test(rawOrig)) {
        codeNum = "204";
        title = "Актовый зал";
        subtitle = "Концертный зал и сцена";
    } else if (b === 4 && f === 2 && /спорт/i.test(rawOrig)) {
        codeNum = "206";
        title = "Спортивный зал";
        subtitle = "Большой спортзал корпуса 4";
    } else if (b === 2 && f === 3 && /спорт/i.test(rawOrig)) {
        codeNum = "308";
        title = "Спортивный зал";
        subtitle = "Спортзал корпуса 2";
    } else if (b === 2 && f === 3 && /конференц/i.test(rawOrig)) {
        codeNum = "312";
        title = "Конференц-зал";
        subtitle = "Зал заседаний и презентаций";
    } else if (b === 2 && f === 2 && (/учебн/i.test(rawOrig) || /209/.test(rawOrig))) {
        codeNum = "209";
        title = "Учебная часть";
        subtitle = "Учебная часть колледжа";
    } else if (/^с\/у/i.test(rawOrig)) {
        const isM = /м|муж/i.test(rawOrig);
        const isF = /ж|жен/i.test(rawOrig);
        codeNum = "WC";
        title = isM ? "Санузел (мужской)" : (isF ? "Санузел (женский)" : "Санузел");
        subtitle = isM ? "Мужской туалет" : (isF ? "Женский туалет" : "Уборная");
    } else if (/^лк\s*№?\s*(\d+)/i.test(rawOrig)) {
        const m = rawOrig.match(/^лк\s*№?\s*(\d+)/i);
        codeNum = `ЛК${m[1]}`;
        title = `Лестничная клетка №${m[1]}`;
        subtitle = "Эвакуационный и межэтажный проход";
    } else if (/лифт/i.test(rawOrig)) {
        codeNum = "Лифт";
        title = "Лифтовой холл";
        subtitle = "Пассажирский лифт";
    } else if (/переход/i.test(rawOrig)) {
        codeNum = "Перех.";
        title = rawOrig.replace(/\n/g, " ");
        subtitle = "Межкорпусный соединительный переход";
    } else if (/служеб/i.test(rawOrig)) {
        codeNum = "Служ.";
        title = "Служебное помещение";
        subtitle = "Техническая зона";
    } else {
        // Учебные кабинеты (501, 502, 107...)
        const strippedCode = codeNum.replace(/^[1-4]-/, "").trim();
        const formattedRoomCode = b > 1 ? `${b}-${strippedCode}` : strippedCode;

        if (secondLine && !/аудитория|кабинет/i.test(secondLine)) {
            // Если на чертеже есть вторая строка с конкретным назначением (напр. "Лаборатория")
            title = secondLine;
            const details = getRoomSubjectAndTeacher(b, f, strippedCode, rawOrig);
            subtitle = details.teacher ? `${details.teacher} • Корпус ${b}, ${f} этаж` : (details.subject ? `${details.subject} • Корпус ${b}, ${f} этаж` : `Корпус ${b} • ${f} этаж`);
        } else {
            const details = getRoomSubjectAndTeacher(b, f, strippedCode, rawOrig);
            // Если есть специальное административное назначение (напр. "Кабинет директора", "Приёмная", "Учительская")
            if (details.subject && /директор|заместитель|приемн|секретар|бухгалтер|учительск|декан/i.test(details.subject)) {
                title = details.subject;
                subtitle = details.teacher ? `${details.teacher} • Корпус ${b}, ${f} этаж` : `Корпус ${b} • ${f} этаж`;
            } else {
                // Предмет не всегда совпадает с кабинетом (кабинеты универсальные, расписание меняется),
                // поэтому название помещения — "Кабинет X", а предмет / преподаватель отображаются во второй строке
                title = `Кабинет ${formattedRoomCode}`;
                if (details.subject && details.teacher) {
                    subtitle = `${details.subject} (${details.teacher})`;
                } else if (details.subject) {
                    subtitle = `${details.subject} • Корпус ${b}, ${f} этаж`;
                } else {
                    subtitle = `Учебная аудитория • Корпус ${b}, ${f} этаж`;
                }
            }
        }
        codeNum = strippedCode;
    }

    // Для всех кабинетов корпусов 2, 3 и 4: если номер состоит из цифр/букв,
    // он ВСЕГДА отображается в карточке с префиксом корпуса: "2-108", "3-103", "4-104"
    if (b > 1) {
        const cleanBase = codeNum.replace(/^[1-4]-/, "").trim();
        if (/^\d+[а-яa-z]?$/i.test(cleanBase)) {
            codeNum = `${b}-${cleanBase}`;
        }
    }

    return { codeLabel: codeNum, displayTitle: title, subtitle: subtitle };
}

// =====================================================================
// --- НЕДАВНИЕ ПОИСКИ (ПОЛНОСТЬЮ ОТКЛЮЧЕНЫ ПО ЗАПРОСУ) ---
try {
    localStorage.removeItem('mgkct_recent_searches');
} catch (_) {}

function getRecentSearches() {
    return [];
}
function saveRecentSearch() {}
function clearRecentSearches() {}

window.saveRecentSearch = saveRecentSearch;
window.getRecentSearches = getRecentSearches;
window.clearRecentSearches = clearRecentSearches;
// ============================================================================
// УПРАВЛЕНИЕ ЖЕСТОМ «НАЗАД» (MOBILE BACK GESTURE / ANDROID BACK BUTTON)
// Перехватывает системный жест «Назад» на телефоне, чтобы закрывать поиск,
// карточки кабинетов и модальные окна, возвращая пользователя на карту,
// а не выбрасывая из сайта.
// ============================================================================
let activeOverlay = null; // 'search' | 'room-card' | 'navigator' | 'route' | null
let isPoppingStateInternal = false;

function initHistoryManager() {
    if (typeof window === 'undefined' || !window.history) return;
    try {
        if (!history.state || !history.state.page) {
            history.replaceState({ page: 'map' }, '');
        }
    } catch (_) {}

    window.addEventListener('popstate', (e) => {
        if (isPoppingStateInternal) {
            isPoppingStateInternal = false;
            return;
        }

        const targetOverlay = (e.state && e.state.overlay) || null;

        // Проверяем открытые оверлеи
        const searchModal = document.getElementById('search-modal');
        const isSearchOpen = searchModal && (searchModal.classList.contains('active') || searchModal.classList.contains('open'));

        const roomPopup = document.getElementById('room-context-popup');
        const isRoomCardOpen = roomPopup && !roomPopup.classList.contains('hidden');

        const navModal = document.getElementById('navigator-modal');
        const isNavModalOpen = navModal && (navModal.classList.contains('active') || navModal.classList.contains('open'));

        const isRouteActive = (typeof NAV_STATE !== 'undefined' && NAV_STATE.activeRoute);

        // 1. Если была открыта карточка кабинета
        if (isRoomCardOpen) {
            hideRoomContextPopup(true);

            // Если пришли из поиска — возвращаемся обратно в поиск!
            if (targetOverlay === 'search') {
                if (typeof openSearch === 'function') {
                    openSearch(true);
                }
                activeOverlay = 'search';
                return;
            }

            activeOverlay = null;
            return;
        }

        // 2. Если был открыт поиск
        if (isSearchOpen) {
            if (typeof closeSearch === 'function') closeSearch(true);
            activeOverlay = null;
            return;
        }

        // 3. Если было открыто окно навигатора
        if (isNavModalOpen) {
            if (typeof closeNavigatorModal === 'function') closeNavigatorModal(true);
            activeOverlay = null;
            return;
        }

        // 4. Если был активен маршрут
        if (isRouteActive) {
            if (typeof clearRoute === 'function') clearRoute(true);
            activeOverlay = null;
            return;
        }

        activeOverlay = null;
    });
}

function pushOverlayState(name, extra = {}) {
    if (typeof window === 'undefined' || !window.history) return;
    try {
        if (activeOverlay === name) return;
        const stateObj = { page: 'map', overlay: name, ...extra };
        history.pushState(stateObj, '');
        activeOverlay = name;
    } catch (_) {}
}

function popOverlayState(name) {
    if (typeof window === 'undefined' || !window.history) return;
    if (activeOverlay === name) {
        activeOverlay = null;
        if (history.state && history.state.overlay) {
            isPoppingStateInternal = true;
            try {
                history.back();
            } catch (_) {}
            setTimeout(() => { isPoppingStateInternal = false; }, 200);
        }
    }
}

window.pushOverlayState = pushOverlayState;
window.popOverlayState = popOverlayState;
window.initHistoryManager = initHistoryManager;

let _searchSetupDone = false;
function setupSearch() {
    if (_searchSetupDone) return;
    _searchSetupDone = true;

    const searchModal = document.getElementById("search-modal");
    const searchBackdrop = document.getElementById("search-backdrop");
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results");
    const searchTagChips = document.querySelectorAll(".search-tag-chip");
    const btnOpenSearch = document.getElementById("btn-open-search");
    const btnCloseSearch = document.getElementById("btn-close-search");
    const btnClearSearch = document.getElementById("btn-clear-search");
    const btnQuickCanteen = document.getElementById("btn-quick-canteen");
    const btnQuickToilet = document.getElementById("btn-quick-toilet");
    const btnQuickInfo = document.getElementById("btn-quick-info");
    const quickButtons = [btnQuickCanteen, btnQuickToilet, btnQuickInfo];

    function toggleQuickCategory(targetBtn, queryText) {
        const wasActive = targetBtn?.classList.contains("is-active");
        quickButtons.forEach(b => b?.classList.remove("is-active"));
        if (!wasActive && targetBtn) {
            targetBtn.classList.add("is-active");
            if (searchInput) {
                searchInput.value = queryText;
                if (btnClearSearch) btnClearSearch.classList.remove("hidden");
                searchInput.focus();
            }
            renderSearchResults(queryText);
        } else {
            if (searchInput) {
                searchInput.value = "";
                if (btnClearSearch) btnClearSearch.classList.add("hidden");
            }
            renderSearchResults("");
        }
    }

    btnQuickCanteen?.addEventListener("click", () => {
        toggleQuickCategory(btnQuickCanteen, "Столовая");
    });

    btnQuickToilet?.addEventListener("click", () => {
        toggleQuickCategory(btnQuickToilet, "С/У");
    });

    btnQuickInfo?.addEventListener("click", () => {
        toggleQuickCategory(btnQuickInfo, "101");
    });

    function openSearch(fromPopstate = false, shouldFocus = true) {
        hideRoomContextPopup(true);

        // При открытии поиска ВСЕГДА скрываем верхний баннер карты, чтобы он не перекрывал поиск
        const pickBanner = document.getElementById('nav-pick-banner');
        if (pickBanner) pickBanner.classList.add('hidden');

        // Кнопка «Карта» показывается ТОЛЬКО при поиске через составленный маршрут (выбор точки)
        const isRoutePick = !!(window.NAV_STATE && window.NAV_STATE.targetToChange);
        const btnPickMap = document.getElementById("btn-search-pick-map");
        if (btnPickMap) {
            btnPickMap.classList.toggle("is-route-pick", isRoutePick);
        }
        if (searchModal) {
            searchModal.classList.toggle("route-pick-mode", isRoutePick);
        }
        if (!isRoutePick) {
            const pill = document.getElementById('search-route-target-pill');
            if (pill) pill.classList.add('hidden');
        }

        // 1. Делаем модалку активной синхронно в DOM до любых других операций
        if (searchModal) {
            searchModal.style.visibility = 'visible';
            searchModal.classList.add("active");
        }
        if (searchBackdrop) {
            searchBackdrop.classList.add("active");
        }
        document.body.classList.add("search-open");

        // 2. МГНОВЕННЫЙ СИНХРОННЫЙ ВЫЗОВ focus() ДЛЯ ОТКРЫТИЯ КЛАВИАТУРЫ НА ТЕЛЕФОНЕ:
        if (shouldFocus && searchInput) {
            try {
                searchInput.focus({ preventScroll: true });
            } catch (_) {
                try { searchInput.focus(); } catch (_) {}
            }
            try {
                const len = searchInput.value ? searchInput.value.length : 0;
                searchInput.setSelectionRange(len, len);
            } catch (_) {}

            // Страховочный повторный фокус в следующем тике, если браузер пересчитывал layout
            setTimeout(() => {
                if (searchModal?.classList.contains("active") && document.activeElement !== searchInput) {
                    try { searchInput.focus({ preventScroll: true }); } catch (_) {}
                }
            }, 50);
        }

        // 3. Сохранение состояния навигации в history строго после фокусировки
        if (!fromPopstate) {
            pushOverlayState('search');
        }

        const q = searchInput ? searchInput.value : "";
        if (btnClearSearch) {
            btnClearSearch.classList.toggle("hidden", !q);
        }
        renderSearchResults(q);

        if (typeof updateVisualViewportVars === "function") updateVisualViewportVars();
        setTimeout(() => {
            if (typeof updateVisualViewportVars === "function") updateVisualViewportVars();
        }, 120);
        setTimeout(() => {
            if (typeof updateVisualViewportVars === "function") updateVisualViewportVars();
        }, 300);
    }

    function closeSearch(fromPopstate = false, keepPickBanner = false) {
        if (!fromPopstate) {
            popOverlayState('search');
        }
        searchInput?.blur();
        if (searchModal) {
            searchModal.style.visibility = '';
            searchModal.classList.remove("active");
            searchModal.classList.remove("route-pick-mode");
        }
        const btnPickMap = document.getElementById("btn-search-pick-map");
        if (btnPickMap) btnPickMap.classList.remove("is-route-pick");
        const pill = document.getElementById('search-route-target-pill');
        if (pill) pill.classList.add('hidden');
        searchBackdrop?.classList.remove("active");
        document.body.classList.remove("search-open");
        quickButtons.forEach(b => b?.classList.remove("is-active"));
        document.querySelectorAll(".search-tag-chip").forEach(c => c.classList.remove("is-active"));
        const searchCard = document.querySelector(".m3-search-card");
        if (searchCard) {
            searchCard.classList.add("hidden");
        }
        if (searchInput) {
            searchInput.placeholder = 'Поиск по колледжу...';
        }
        if (!keepPickBanner && typeof window.hidePickBanner === 'function') {
            window.hidePickBanner();
        }
    }

    window.openSearch = openSearch;
    window.closeSearch = closeSearch;

    let searchOpeningGesture = false;

    function handleSearchOpenGesture(e) {
        if (searchOpeningGesture) {
            if (e && e.cancelable) e.preventDefault();
            return;
        }
        searchOpeningGesture = true;
        setTimeout(() => { searchOpeningGesture = false; }, 350);

        if (e && e.cancelable) {
            e.preventDefault();
        }

        // Предотвращаем удержание фокуса кнопкой, чтобы клик не перехватывал фокус у инпута
        if (btnOpenSearch && typeof btnOpenSearch.blur === 'function') {
            btnOpenSearch.blur();
        }

        openSearch(false, true);
    }

    btnOpenSearch?.addEventListener("click", handleSearchOpenGesture);
    btnOpenSearch?.addEventListener("touchend", (e) => {
        handleSearchOpenGesture(e);
    });

    const searchBarContainer = document.getElementById("bottom-search-bar")?.querySelector(".m3-search-bar");
    searchBarContainer?.addEventListener("click", (e) => {
        if (e.target !== btnOpenSearch && !btnOpenSearch?.contains(e.target)) {
            handleSearchOpenGesture(e);
        }
    });

    // Нажатие на плашку ввода в модалке всегда фокусирует инпут
    const searchInputPill = searchModal?.querySelector(".m3-search-input-pill");
    searchInputPill?.addEventListener("click", (e) => {
        if (e.target !== btnCloseSearch && !btnCloseSearch?.contains(e.target) &&
            e.target !== btnClearSearch && !btnClearSearch?.contains(e.target)) {
            if (searchInput && document.activeElement !== searchInput) {
                searchInput.focus();
            }
        }
    });

    btnCloseSearch?.addEventListener("click", () => closeSearch());
    searchBackdrop?.addEventListener("click", () => closeSearch());

    // Кнопка «Карта» в поисковой строке для выбора пункта прямо на 3D карте
    const btnSearchPickMap = document.getElementById("btn-search-pick-map");
    btnSearchPickMap?.addEventListener("click", () => {
        const targetType = (window.NAV_STATE && window.NAV_STATE.targetToChange) ? window.NAV_STATE.targetToChange : 'dest';
        const label = targetType === 'dest' ? 'конечный пункт (Куда)' : 'начальный пункт (Откуда)';
        if (typeof window.showPickBanner === 'function') {
            window.showPickBanner(`Нажмите на кабинет на карте (${targetType === 'dest' ? 'Куда' : 'Откуда'})`, targetType);
        }
        closeSearch(false, true);
    });

    window.openSearch = openSearch;
    window.closeSearch = closeSearch;
    window.renderSearchResults = (q) => renderSearchResults(q !== undefined ? q : (searchInput ? searchInput.value : ''));

    const searchForm = searchModal?.querySelector("form");
    searchForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const activeRow = searchResults?.querySelector(".m3-search-row.is-active") || searchResults?.querySelector(".m3-search-row");
        if (activeRow) activeRow.click();
    });

    searchInput?.addEventListener("focus", () => {
        if (typeof updateVisualViewportVars === "function") {
            updateVisualViewportVars();
            setTimeout(updateVisualViewportVars, 80);
            setTimeout(updateVisualViewportVars, 250);
            setTimeout(updateVisualViewportVars, 450);
        }
    });

    searchInput?.addEventListener("blur", () => {
        if (typeof updateVisualViewportVars === "function") {
            setTimeout(updateVisualViewportVars, 80);
            setTimeout(updateVisualViewportVars, 250);
        }
    });

    let searchDebounceTimer = null;
    btnClearSearch?.addEventListener("click", () => {
        if (searchInput) {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = null;
            }
            searchInput.value = "";
            searchInput.focus();
            btnClearSearch.classList.add("hidden");
            searchTagChips.forEach(c => c.classList.remove("is-active"));
            renderSearchResults("");
        }
    });

    searchInput?.addEventListener("input", (e) => {
        const val = (e.target.value || "").trim();
        if (btnClearSearch) {
            btnClearSearch.classList.toggle("hidden", !val);
        }
        quickButtons.forEach(b => b?.classList.remove("is-active"));
        searchTagChips.forEach(c => {
            c.classList.toggle("is-active", Boolean(val) && (c.dataset.query || "").toLowerCase() === val.toLowerCase());
        });
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        const query = e.target.value;
        searchDebounceTimer = setTimeout(() => {
            renderSearchResults(query);
        }, 150);
    });

    searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSearch();
            return;
        }
        if (e.key === "Enter") {
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = null;
                renderSearchResults(searchInput.value);
            }
            const activeRow = searchResults?.querySelector(".m3-search-row.is-active") || searchResults?.querySelector(".m3-search-row");
            if (activeRow) {
                e.preventDefault();
                activeRow.click();
            }
            return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            const rows = Array.from(searchResults?.querySelectorAll(".m3-search-row") || []);
            if (rows.length === 0) return;
            e.preventDefault();
            const curIdx = rows.findIndex(r => r.classList.contains("is-active"));
            let nextIdx = 0;
            if (e.key === "ArrowDown") {
                nextIdx = curIdx < rows.length - 1 ? curIdx + 1 : 0;
            } else {
                nextIdx = curIdx > 0 ? curIdx - 1 : rows.length - 1;
            }
            rows.forEach((r, idx) => r.classList.toggle("is-active", idx === nextIdx));
            rows[nextIdx].scrollIntoView({ block: "nearest" });
        }
    });

    document.querySelectorAll(".search-tag-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const q = chip.dataset.query || "";
            const isAlreadyActive = chip.classList.contains("is-active");

            // Снимаем активность со всех чипов
            document.querySelectorAll(".search-tag-chip").forEach(c => c.classList.remove("is-active"));

            if (isAlreadyActive) {
                // Повторный клик по активному чипу снимает фильтр
                if (searchInput) searchInput.value = "";
                if (btnClearSearch) btnClearSearch.classList.add("hidden");
                renderSearchResults("");
            } else {
                chip.classList.add("is-active");
                if (searchInput) {
                    searchInput.value = q;
                    if (btnClearSearch) btnClearSearch.classList.remove("hidden");
                    searchInput.focus();
                }
                renderSearchResults(q);
            }
        });
    });

    // Делегированный обработчик клика для всех элементов выдачи поиска и кнопки очистки истории
    searchResults?.addEventListener('click', (e) => {
        const clearBtn = e.target.closest('#btn-clear-recent');
        if (clearBtn) {
            e.stopPropagation();
            clearRecentSearches();
            renderSearchResults('');
            return;
        }

        const btn = e.target.closest('.room-search-item, .m3-search-row');
        if (!btn) return;

        const f = parseInt(btn.dataset.floor, 10);
        const b = parseInt(btn.dataset.bldg, 10);
        const x = parseFloat(btn.dataset.x);
        const z = parseFloat(btn.dataset.z);
        const t = btn.dataset.text;
        closeSearch(true);

        // Очищаем строку поиска после выбора найденного кабинета
        if (searchInput) {
            searchInput.value = '';
        }
        if (btnClearSearch) {
            btnClearSearch.classList.add('hidden');
        }
        quickButtons.forEach(b => b?.classList.remove('is-active'));
        if (typeof renderSearchResults === 'function') {
            renderSearchResults('');
        }

        if (typeof setBuildingFilter === "function") {
            setBuildingFilter(String(b), false);
        }
        const roomInfo = { floor: f, building: b, x: x, z: z, text: t };

        // Сохраняем в недавние поиски
        if (typeof saveRecentSearch === "function") {
            saveRecentSearch(roomInfo);
        }

        // Если активен маршрут и пользователь выбирает кабинет в поиске для смены в маршруте
        if (window.NAV_STATE && (window.NAV_STATE.targetToChange || window.NAV_STATE.activeRoute || (document.getElementById('navigator-route-card') && !document.getElementById('navigator-route-card').classList.contains('hidden')))) {
            const targetType = window.NAV_STATE.targetToChange || 'dest';
            if (typeof window.applyRoomToActiveRoute === 'function') {
                window.applyRoomToActiveRoute(roomInfo, targetType);
            }
            window.NAV_STATE.targetToChange = null;
            if (typeof hideRoomContextPopup === 'function') {
                hideRoomContextPopup(true);
            }
            return;
        }
        selectRoom(roomInfo, true);
        if (typeof showRoomContextPopup === "function") {
            showRoomContextPopup(roomInfo, window.innerWidth / 2, window.innerHeight * 0.42, false, true);
        }
    });

    function renderSearchResults(query) {
        if (!searchResults) return;
        query = (query || "").trim().toLowerCase().replace(/ё/g, "е");

        const searchCard = document.querySelector(".m3-search-card");

        // 1) Пустой поисковый запрос: скрываем карточку выдачи (чистый M3 Expressive вид над клавиатурой)
        if (!query) {
            if (searchCard) {
                searchCard.classList.add("hidden");
            }
            searchResults.innerHTML = "";
            return;
        }

        if (searchCard) {
            searchCard.classList.remove("hidden");
        }

        if (typeof ROOMS_REGISTRY === "undefined" || ROOMS_REGISTRY.length === 0) {
            searchResults.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">Загрузка базы кабинетов...</div>';
            return;
        }

        let targetBldg = null;
        let targetRoomQuery = query;

        const dashMatch = query.match(/^([1-4])\s*[-/:.]\s*([а-яa-z0-9№\s]*)$/i);
        const kMatch = query.match(/^(?:к|корп|корпус)\s*([1-4])\s*[-/:.\s]?\s*([а-яa-z0-9№\s]*)$/i);
        const postKMatch = query.match(/^([1-4])\s*(?:к|корп|корпус)\s*[-/:.\s]?\s*([а-яa-z0-9№\s]*)$/i);

        if (dashMatch) {
            targetBldg = parseInt(dashMatch[1], 10);
            targetRoomQuery = (dashMatch[2] || "").trim().replace(/ё/g, "е");
        } else if (kMatch) {
            targetBldg = parseInt(kMatch[1], 10);
            targetRoomQuery = (kMatch[2] || "").trim().replace(/ё/g, "е");
        } else if (postKMatch) {
            targetBldg = parseInt(postKMatch[1], 10);
            targetRoomQuery = (postKMatch[2] || "").trim().replace(/ё/g, "е");
        }

        const filtered = ROOMS_REGISTRY.filter(r => {
            const rawOrig = (r.rawText || r.text || "").toLowerCase().replace(/ё/g, "е");
            // Скрываем чисто архитектурные подписи («Второй свет», «Витраж», «Переход...»), если пользователь не ищет их специально
            if (!query && (/второй свет|витраж|переход/i.test(rawOrig))) {
                return false;
            }
            if (!query) return true;

            const roomText = r.text.toLowerCase().replace(/ё/g, "е");
            const cleanText = rawOrig.replace(/\n/g, " ");
            const bldg = r.building;
            const itemInfo = formatSearchRoomBadgeAndTitle(r);
            const titleLower = (itemInfo.displayTitle || "").toLowerCase().replace(/ё/g, "е");
            const subLower = (itemInfo.subtitle || "").toLowerCase().replace(/ё/g, "е");
            const codeLower = (itemInfo.codeLabel || "").toLowerCase().replace(/ё/g, "е");

            let alias = "";
            if (bldg === 4 && r.floor === 1 && (cleanText.includes("102") || cleanText.includes("столов"))) alias = "столовая буфет обед еда 102";
            if (bldg === 4 && r.floor === 2 && (cleanText.includes("206") || cleanText.includes("спорт"))) alias = "спортзал спортивный зал спорт 206";
            if (bldg === 4 && r.floor === 2 && (cleanText.includes("204") || cleanText.includes("актов"))) alias = "актовый зал актовый сцена 204";
            if (bldg === 1 && r.floor === 1 && (cleanText.includes("102") || cleanText.includes("гардероб"))) alias = "гардероб раздевалка одежда 102";
            if (bldg === 2 && r.floor === 1 && (cleanText.includes("104") || cleanText.includes("библиот"))) alias = "библиотека книги читальный зал 104";
            if (bldg === 2 && r.floor === 3 && (cleanText.includes("308") || cleanText.includes("спорт"))) alias = "спортзал спортивный зал спорт 308";
            if (bldg === 2 && r.floor === 3 && (cleanText.includes("312") || cleanText.includes("конференц"))) alias = "конференц-зал конференц зал собрания 312";
            if (bldg === 2 && r.floor === 2 && (cleanText.includes("209") || cleanText.includes("учебн"))) alias = "учебная часть учебная 209 2-209";
            if (/^с\/у/i.test(cleanText)) {
                const isM = /м|муж/i.test(cleanText);
                const isF = /ж|жен/i.test(cleanText);
                alias = "туалет санузел уборная wc с/у" + (isM ? " мужской м" : "") + (isF ? " женский ж" : "");
            }

            if (targetBldg !== null) {
                if (bldg !== targetBldg) return false;
                if (!targetRoomQuery) return true;
                return cleanText.includes(targetRoomQuery) ||
                       roomText.includes(targetRoomQuery) ||
                       codeLower.includes(targetRoomQuery) ||
                       titleLower.includes(targetRoomQuery) ||
                       subLower.includes(targetRoomQuery) ||
                       alias.includes(targetRoomQuery);
            }

            const bldgCombos = [
                `${bldg}-${roomText}`,
                `${bldg} - ${roomText}`,
                `${bldg}/${roomText}`,
                `${bldg}:${roomText}`,
                `к${bldg}-${roomText}`,
                `к${bldg} ${roomText}`,
                `${bldg}к ${roomText}`,
                `${bldg}к-${roomText}`,
                `корпус ${bldg} ${roomText}`
            ];

            return cleanText.includes(query) ||
                   roomText.includes(query) ||
                   codeLower.includes(query) ||
                   titleLower.includes(query) ||
                   subLower.includes(query) ||
                   alias.includes(query) ||
                   bldgCombos.some(c => c.includes(query)) ||
                   `корпус ${bldg}`.includes(query) ||
                   `этаж ${r.floor}`.includes(query);
        });

        filtered.sort((a, b) => {
            const aRaw = (a.rawText || a.text || "").trim().toLowerCase();
            const bRaw = (b.rawText || b.text || "").trim().toLowerCase();
            const aInfo = formatSearchRoomBadgeAndTitle(a);
            const bInfo = formatSearchRoomBadgeAndTitle(b);
            const aCode = (aInfo.codeLabel || "").toLowerCase();
            const bCode = (bInfo.codeLabel || "").toLowerCase();
            const aTitle = (aInfo.displayTitle || "").toLowerCase();
            const bTitle = (bInfo.displayTitle || "").toLowerCase();
            const aSub = (aInfo.subtitle || "").toLowerCase();
            const bSub = (bInfo.subtitle || "").toLowerCase();
            const q = targetBldg !== null ? targetRoomQuery : query;

            if (q) {
                const aExact = aRaw === q || aCode === q || aTitle === q;
                const bExact = bRaw === q || bCode === q || bTitle === q;
                if (aExact && !bExact) return -1;
                if (bExact && !aExact) return 1;

                const aStarts = aRaw.startsWith(q) || aCode.startsWith(q) || aTitle.startsWith(q) || aSub.startsWith(q);
                const bStarts = bRaw.startsWith(q) || bCode.startsWith(q) || bTitle.startsWith(q) || bSub.startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (bStarts && !aStarts) return 1;
            }
            if (a.building !== b.building) return a.building - b.building;
            if (a.floor !== b.floor) return a.floor - b.floor;
            return aRaw.localeCompare(bRaw, undefined, { numeric: true });
        });

        const displayItems = filtered.slice(0, 30);

        if (displayItems.length === 0) {
            searchResults.innerHTML = `<div class="text-center py-8 text-xs text-slate-400 dark:text-slate-500">По запросу &laquo;${escapeHtml(query)}&raquo; ничего не найдено</div>`;
            return;
        }

        let html = "";
        displayItems.forEach((item, index) => {
            const { codeLabel, displayTitle, subtitle } = formatSearchRoomBadgeAndTitle(item);
            const dataText = (item.text || "").replace(/\n/g, " ");
            // Первая строка (кандидат по нажатию Enter) выделяется ярким цветом
            const isActive = index === 0 ? " is-active" : "";
            html += `
                <button class="m3-search-row room-search-item flex items-stretch w-full transition text-left group overflow-hidden${isActive}"
                        data-floor="${escapeHtml(item.floor)}" data-bldg="${escapeHtml(item.building)}" data-x="${escapeHtml(item.x)}" data-z="${escapeHtml(item.z)}" data-text="${escapeHtml(dataText)}">
                    <!-- Колонка 1: Номер аудитории -->
                    <div class="m3-search-col-num flex items-center justify-center font-bold text-slate-800 dark:text-slate-100 select-none">
                        ${escapeHtml(codeLabel)}
                    </div>

                    <!-- Колонка 2: Бейджи Корпуса и Этажа (на всю ширину блока) -->
                    <div class="m3-search-col-badges flex flex-col justify-stretch p-0 m-0">
                        <!-- Корпус -->
                        <div class="m3-search-badge m3-badge-bldg flex items-center justify-center gap-1" title="Корпус ${escapeHtml(item.building)}">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="4" y="3" width="7" height="18" rx="1"></rect>
                                <rect x="11" y="9" width="6" height="12" rx="1"></rect>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.building)}</span>
                        </div>
                        <!-- Этаж -->
                        <div class="m3-search-badge m3-badge-floor flex items-center justify-center gap-1" title="${escapeHtml(item.floor)} этаж">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 19h4v-4h4v-4h4V7h4"></path>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.floor)}</span>
                        </div>
                    </div>

                    <!-- Колонка 3: Название кабинета + преподаватель / описание -->
                    <div class="m3-search-col-info flex flex-col justify-center min-w-0 flex-1 overflow-hidden">
                        <span class="m3-search-title room-search-title leading-snug truncate">${escapeHtml(displayTitle)}</span>
                        <span class="m3-search-subtitle room-search-sub truncate">${escapeHtml(subtitle)}</span>
                    </div>
                </button>
            `;
        });
        searchResults.innerHTML = html;

        searchResults.querySelectorAll(".m3-search-row").forEach(btn => {
            btn.addEventListener("pointerdown", () => {
                // При касании/клике снимаем подсветку со всех остальных строк, оставляя только одну активную
                searchResults.querySelectorAll(".m3-search-row.is-active").forEach(r => {
                    if (r !== btn) r.classList.remove("is-active");
                });
                btn.classList.add("is-active");
            });

            btn.addEventListener("mouseenter", () => {
                // Подсвечиваем только при наведении курсора мыши (исключает ложные срабатывания от тач-событий)
                if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
                searchResults.querySelectorAll(".m3-search-row.is-active").forEach(r => {
                    if (r !== btn) r.classList.remove("is-active");
                });
                btn.classList.add("is-active");
            });
        });
    }

    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("search")) {
            openSearch();
            const cat = urlParams.get("cat");
            if (cat === "canteen") btnQuickCanteen?.click();
            else if (cat === "toilet") btnQuickToilet?.click();
            else if (cat === "info") btnQuickInfo?.click();
        }
    } catch (_) {}
}

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

// Адаптивная привязка плавающих кнопок FAB над окном карточки кабинета или маршрута
function updateAdaptiveFabPosition() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const popup = document.getElementById('room-context-popup');
    const routeCard = document.getElementById('navigator-route-card');

    let activeCard = null;
    if (popup && !popup.classList.contains('hidden') && document.body.classList.contains('room-card-open')) {
        activeCard = popup;
    } else if (routeCard && !routeCard.classList.contains('hidden') && document.body.classList.contains('route-active')) {
        activeCard = routeCard;
    }

    if (activeCard) {
        const rect = activeCard.getBoundingClientRect();
        if (rect && rect.height > 0) {
            // Отступ снизу viewport до верхней границы карточки + 10px чистого зазора
            const bottomOffset = Math.round(window.innerHeight - rect.top + 10);
            if (bottomOffset > 0 && bottomOffset < window.innerHeight - 30) {
                document.documentElement.style.setProperty('--card-fab-bottom', `${bottomOffset}px`);
                return;
            }
        }
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
        if (popup) ro.observe(popup);
        if (routeCard) ro.observe(routeCard);
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
    if (STATE.theme === 'dark') return;

    // Архитектурная палитра кампуса (Шалфейный гранит) применяется единообразно
    // как с включенной внешней территорией, так и без нее
    const p = (typeof DEFAULT_CAMPUS_COLORS !== 'undefined') ? DEFAULT_CAMPUS_COLORS : {
        slab: 0x9faea0,
        coreSlab: 0x9faea0,
        wall: 0x5b6c5d,
        stair: 0x7d5336
    };
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

function setupUI() {
    initHistoryManager();
    setupVisualViewportHandler();
    setupSearch();
    setupSettingsDrawer();
    setupRoomContextPopup();

    // Селектор этажей (кнопки 1–7)
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.floor;
            if (f) setMode(f);
        });
    });

    // Выбор корпуса (чипсы в шапке)
    document.querySelectorAll('.bldg-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const b = chip.dataset.bldg;
            if (b) setBuildingFilter(b);
        });
    });

    // Плавающие кнопки карты: Все корпуса, Все этажи, Территория, 2D/3D, Зум
    (document.getElementById('btn-toggle-all-bldg') || document.getElementById('btn-bldg-all'))?.addEventListener('click', () => {
        setBuildingFilter('both');
    });

    document.getElementById('btn-toggle-all-floors')?.addEventListener('click', () => {
        if (STATE.mode === 'all') {
            if (window.NAV_STATE && window.NAV_STATE.activeRoute && Array.isArray(window.NAV_STATE.activeRoute.involvedFloors) && window.NAV_STATE.activeRoute.involvedFloors.length > 0) {
                setMode(String(window.NAV_STATE.activeRoute.involvedFloors[0]));
            } else {
                setMode('1');
            }
        } else {
            setMode('all');
        }
    });

    document.getElementById('btn-toggle-territory')?.addEventListener('click', toggleTerritoryView);
    document.getElementById('btn-toggle-2d')?.addEventListener('click', toggle2DView);
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        if (typeof zoomIn === 'function') zoomIn();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        if (typeof zoomOut === 'function') zoomOut();
    });
    document.getElementById('btn-center-view')?.addEventListener('click', resetToNorth);

    // Кнопка переключения темы оформления (Светлая / Тёмная)
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
        let current = STATE.theme;
        try {
            const saved = localStorage.getItem('mgkct_theme');
            if (saved === 'dark' || saved === 'light') current = saved;
        } catch (_) {}
        if (!current) {
            current = (document.body && document.body.getAttribute('data-theme') === 'dark') ? 'dark' : 'light';
        }
        const nextTheme = current === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme, true);
    });

    // Горячая клавиша H — скрыть интерфейс, / или Ctrl/Cmd+K — открыть поиск
    window.addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
            return;
        }
        if (e.code === 'KeyH' || e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
            document.body.classList.toggle('ui-hidden');
            return;
        }
        if (e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            if (typeof openSearch === 'function') openSearch();
            return;
        }
    });

    // Инициализация активных состояний без лишнего перелёта камеры при старте
    setBuildingFilter(STATE.buildingFilter || 'both', false);
    setMode(STATE.mode || '1', false);
    setViewMode(STATE.is2D, false);
    setTerritoryMode(STATE.showTerritory, false);
    setLabelScale(STATE.labelScale || 1.0);
    
    let initialTheme = null;
    try {
        initialTheme = localStorage.getItem('mgkct_theme');
    } catch (_) {}
    if (!initialTheme && typeof STATE !== 'undefined' && (STATE.theme === 'dark' || STATE.theme === 'light')) {
        initialTheme = STATE.theme;
    }
    setTheme(initialTheme || getSystemTheme(), false);
}


// ==========================================
// КОНТЕКСТНЫЙ ПОПАП КАБИНЕТА (ОТСЮДА / СЮДА)
// С ПРИВЯЗКОЙ К 3D-КООРДИНАТАМ КАБИНЕТА
// ==========================================
// Контекстное меню кабинета (Material 3 Expressive Bottom Card & Action Pills)
// ==========================================
let currentPopupRoom = null;
const _popupProjVec = new THREE.Vector3();

function updateRoomContextPopupScreenPos(viewW, viewH) {
    if (!currentPopupRoom) return;
    const popup = document.getElementById('room-context-popup');
    if (!popup || popup.classList.contains('hidden')) return;

    // Нижняя карточка фиксируется у нижнего края экрана через CSS (M3 Bottom Sheet)
    popup.style.left = '';
    popup.style.top = '';
}
window.updateRoomContextPopupScreenPos = updateRoomContextPopupScreenPos;

function estimateWalkTime(roomInfo) {
    if (!roomInfo) return "1м";
    const f = parseInt(roomInfo.floor, 10) || 1;
    const b = parseInt(roomInfo.building, 10) || 1;
    let estDistance = 35;
    if (b === 2) estDistance = 75;
    else if (b === 3) estDistance = 110;
    else if (b === 4) estDistance = 145;
    const floorDiff = Math.abs(f - 1);
    if (typeof calculateWalkTime === 'function') {
        const mins = calculateWalkTime(estDistance, floorDiff);
        return `${mins}м`;
    }
    const totalSec = (estDistance / 1.15) + (floorDiff * 45);
    const mins = Math.max(1, Math.round((totalSec / 60) * 10) / 10);
    return `${mins}м`;
}

function showRoomContextPopup(roomInfo, clientX, clientY, shouldSelectAndFly = true, fromSearch = false) {
    if (!roomInfo) return;

    // Не перекрываем активную карточку навигатора / маршрута
    const routeCard = document.getElementById('navigator-route-card');
    if ((window.NAV_STATE && window.NAV_STATE.activeRoute) || (routeCard && !routeCard.classList.contains('hidden'))) {
        return;
    }

    pushOverlayState('room-card', { fromSearch: Boolean(fromSearch) });
    currentPopupRoom = roomInfo;

    const popup = document.getElementById('room-context-popup');
    if (!popup) return;

    const { codeLabel, displayTitle, subtitle } = formatSearchRoomBadgeAndTitle(roomInfo);

    const codeEl = document.getElementById('popup-room-code');
    const bldgBadgeEl = document.getElementById('popup-room-bldg-badge');
    const floorBadgeEl = document.getElementById('popup-room-floor-badge');
    const bldgNumEl = document.getElementById('popup-room-bldg-num');
    const floorNumEl = document.getElementById('popup-room-floor-num');
    const timeNumEl = document.getElementById('popup-room-time-num');
    const titleEl = document.getElementById('popup-room-title');
    const subtitleEl = document.getElementById('popup-room-subtitle');
    const teacherEl = document.getElementById('popup-room-teacher');
    const nameEl = document.getElementById('popup-room-name');

    const cleanNumber = codeLabel || (roomInfo.text ? roomInfo.text.replace(/\n/g, ' ').trim() : 'Кабинет');
    const details = getRoomSubjectAndTeacher(roomInfo.building, roomInfo.floor, cleanNumber, roomInfo.rawText || roomInfo.text);
    const teacherName = (details && details.teacher) ? details.teacher : (/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\./.test(subtitle) ? subtitle : "");

    const bldgVal = String(roomInfo.building || '1');
    const floorVal = String(roomInfo.floor || '1');

    if (codeEl) codeEl.textContent = cleanNumber;
    if (bldgNumEl) {
        bldgNumEl.textContent = bldgVal;
    } else if (bldgBadgeEl) {
        bldgBadgeEl.innerHTML = `<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="7" height="18" rx="1"></rect><rect x="11" y="9" width="6" height="12" rx="1"></rect></svg><span id="popup-room-bldg-num">${escapeHtml(bldgVal)}</span>`;
    }
    if (bldgBadgeEl) bldgBadgeEl.title = `Корпус ${bldgVal}`;

    if (floorNumEl) {
        floorNumEl.textContent = floorVal;
    } else if (floorBadgeEl) {
        floorBadgeEl.innerHTML = `<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h4v-4h4v-4h4V7h4"></path></svg><span id="popup-room-floor-num">${escapeHtml(floorVal)}</span>`;
    }
    if (floorBadgeEl) floorBadgeEl.title = `Этаж ${floorVal}`;
    if (timeNumEl) timeNumEl.textContent = estimateWalkTime(roomInfo);
    if (titleEl) titleEl.textContent = displayTitle || 'Аудитория';

    // Раздельные секции для предмета (учебник) и преподавателя (иконка персоны)
    const subjectRowEl = document.getElementById('popup-room-subject-row');
    const teacherRowEl = document.getElementById('popup-room-teacher-row');
    const subjectEl = document.getElementById('popup-room-subject');
    const genericRowEl = document.getElementById('popup-room-generic-row');
    const genericTextEl = document.getElementById('popup-room-generic-text');

    const hasSubject = !!(details && details.subject);
    const hasTeacher = !!teacherName;

    if (subjectRowEl) {
        if (hasSubject) {
            subjectRowEl.classList.remove('hidden');
            if (subjectEl) subjectEl.textContent = details.subject;
        } else {
            subjectRowEl.classList.add('hidden');
        }
    }

    if (teacherRowEl) {
        if (hasTeacher) {
            teacherRowEl.classList.remove('hidden');
            if (teacherEl) teacherEl.textContent = teacherName;
        } else {
            teacherRowEl.classList.add('hidden');
        }
    }

    if (genericRowEl) {
        if (!hasSubject && !hasTeacher) {
            genericRowEl.classList.remove('hidden');
            let genText = "";
            if (subtitle && !subtitle.includes("Корпус")) {
                genText = subtitle;
            } else {
                genText = `Учебная аудитория • Корпус ${bldgVal}, ${floorVal} этаж`;
            }
            if (genericTextEl) genericTextEl.textContent = genText;
        } else {
            genericRowEl.classList.add('hidden');
        }
    }

    // Сохраняем совместимость для внешних скриптов
    if (subtitleEl) {
        const fullSub = (hasSubject && hasTeacher) ? `${details.subject} • ${teacherName}` : (hasSubject ? details.subject : (hasTeacher ? teacherName : `Корпус ${bldgVal}, ${floorVal} этаж`));
        if (teacherEl && !teacherRowEl) teacherEl.textContent = fullSub;
    }

    if (nameEl) {
        nameEl.textContent = teacherName ? `${displayTitle} • ${teacherName} (${roomInfo.floor} этаж)` : `${displayTitle} (${roomInfo.floor} этаж)`;
    }

    // Очищаем inline координаты, чтобы сработал CSS bottom-sheet
    popup.style.left = '';
    popup.style.top = '';

    popup.classList.remove('hidden');
    document.body.classList.add('room-card-open');

    requestAnimationFrame(updateAdaptiveFabPosition);

    if (shouldSelectAndFly && typeof selectRoom === 'function') {
        selectRoom(roomInfo, true);
    }
}

function hideRoomContextPopup(fromPopstate = false) {
    if (!fromPopstate) {
        if (history.state && history.state.overlay === 'room-card') {
            if (history.state.fromSearch) {
                isPoppingStateInternal = true;
                try {
                    history.go(-2);
                } catch (_) {
                    history.back();
                }
                setTimeout(() => { isPoppingStateInternal = false; }, 200);
            } else {
                popOverlayState('room-card');
            }
        }
    }
    const popup = document.getElementById('room-context-popup');
    if (popup) popup.classList.add('hidden');
    document.body.classList.remove('room-card-open');
    updateAdaptiveFabPosition();
    currentPopupRoom = null;
    const widgetText = document.getElementById('search-widget-text');
    if (widgetText) {
        widgetText.textContent = 'Поиск по колледжу...';
    }
}

function setupRoomContextPopup() {
    const btnClose = document.getElementById('btn-close-room-popup');
    if (btnClose) btnClose.addEventListener('click', hideRoomContextPopup);

    const popup = document.getElementById('room-context-popup');
    if (popup) {
        popup.addEventListener('transitionend', updateAdaptiveFabPosition);
    }

    function getRoomNavPoint(r) {
        if (!r) return null;
        if (typeof NAV_STATE === 'undefined') return null;
        if (!NAV_STATE.graph && typeof buildCollegeNavGraph === 'function') {
            NAV_STATE.graph = buildCollegeNavGraph();
        }
        const g = NAV_STATE.graph;
        if (!g) return null;

        const f = parseInt(r.floor, 10);
        const b = parseInt(r.building, 10);
        const clean = r.text ? r.text.replace(/\n/g, ' ').trim() : 'Кабинет';

        for (const [, node] of g.nodes.entries()) {
            if (node.floor === f && node.bldg === b && node.type === 'room') {
                if (Math.hypot(node.x - r.x, node.z - r.z) < 0.25) {
                    return node;
                }
            }
        }
        for (const [, node] of g.nodes.entries()) {
            if (node.floor === f && node.bldg === b && node.type === 'room') {
                if (node.label === clean) return node;
            }
        }
        const closest = g.findClosestNode(f, b, r.x, r.z, ['room', 'door', 'corridor']);
        return closest || { id: `room_${b}_${f}`, label: clean, floor: f, bldg: b, x: r.x, z: r.z };
    }

    const btnFrom = document.getElementById('btn-popup-from');
    if (btnFrom) {
        btnFrom.addEventListener('click', () => {
            if (!currentPopupRoom) return;
            const r = currentPopupRoom;
            hideRoomContextPopup();

            if (typeof NAV_STATE !== 'undefined') {
                const roomNode = getRoomNavPoint(r);
                if (roomNode) {
                    NAV_STATE.startPoint = roomNode;
                    const inputA = document.getElementById('nav-input-start');
                    if (inputA) {
                        inputA.value = typeof formatNavInputString === 'function' ? formatNavInputString(roomNode) : `${roomNode.label || r.text.replace(/\n/g, ' ')} (К-${r.building}, ${r.floor} эт.)`;
                        inputA.removeAttribute('data-is-default');
                        const btnClearA = document.getElementById('btn-clear-start');
                        if (btnClearA) btnClearA.classList.remove('hidden');
                    }

                    if (typeof openNavigatorModal === 'function') {
                        openNavigatorModal();
                    }
                }
            }
        });
    }

    const btnTo = document.getElementById('btn-popup-to');
    if (btnTo) {
        btnTo.addEventListener('click', () => {
            if (!currentPopupRoom) return;
            const r = currentPopupRoom;
            hideRoomContextPopup();

            if (typeof NAV_STATE !== 'undefined') {
                const roomNode = getRoomNavPoint(r);
                if (roomNode) {
                    NAV_STATE.destPoint = roomNode;
                    const inputB = document.getElementById('nav-input-dest');
                    if (inputB) {
                        inputB.value = typeof formatNavInputString === 'function' ? formatNavInputString(roomNode) : `${roomNode.label || r.text.replace(/\n/g, ' ')} (К-${r.building}, ${r.floor} эт.)`;
                        const btnClearB = document.getElementById('btn-clear-dest');
                        if (btnClearB) btnClearB.classList.remove('hidden');
                    }

                    const g = NAV_STATE.graph;
                    if (!NAV_STATE.startPoint && g) {
                        const entrance = g.getNode('b3_f1_entrance_west') || g.getNode('b1_f1_entrance_main');
                        if (entrance) {
                            NAV_STATE.startPoint = entrance;
                            const inputA = document.getElementById('nav-input-start');
                            if (inputA) {
                                inputA.value = 'Главный вход (Корпус 3 / Западный)';
                                inputA.setAttribute('data-is-default', 'true');
                            }
                        }
                    }

                    if (NAV_STATE.startPoint && NAV_STATE.destPoint && typeof buildRoute === 'function') {
                        buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                    } else if (typeof openNavigatorModal === 'function') {
                        openNavigatorModal();
                    }
                }
            }
        });
    }
}

window.showRoomContextPopup = showRoomContextPopup;
window.hideRoomContextPopup = hideRoomContextPopup;
window.setTerritoryMode = setTerritoryMode;
window.toggleTerritoryView = toggleTerritoryView;
