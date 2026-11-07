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
    const btn2D = document.getElementById('btn-toggle-2d');
    if (btn2D && typeof btn2D.blur === 'function') btn2D.blur();
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

    // Включаем нужный этаж без промежуточного сброса камеры (selectRoom сам наведёт камеру на кабинет)
    if (String(roomInfo.floor) !== String(STATE.mode)) {
        setMode(String(roomInfo.floor), true, false);
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

window.setTerritoryMode = setTerritoryMode;
window.toggleTerritoryView = toggleTerritoryView;
