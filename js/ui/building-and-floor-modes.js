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

function resolveSingleFloorTarget() {
    const popupRoom = (typeof currentPopupRoom !== 'undefined' ? currentPopupRoom : window.currentPopupRoom);
    if (popupRoom && popupRoom.floor) {
        return String(popupRoom.floor);
    }
    if (window.NAV_STATE && window.NAV_STATE.activeRoute && Array.isArray(window.NAV_STATE.activeRoute.involvedFloors) && window.NAV_STATE.activeRoute.involvedFloors.length > 0) {
        return String(window.NAV_STATE.activeRoute.involvedFloors[0]);
    }
    const maxAllowed = BUILDING_MAX_FLOORS[STATE.buildingFilter] || 7;
    const lastF = parseInt(STATE.lastSingleFloor, 10) || 1;
    return String(Math.min(Math.max(1, lastF), maxAllowed));
}

function toggleAllFloorsMode() {
    if (STATE.mode === 'all') {
        const targetFloor = resolveSingleFloorTarget();
        const popupRoom = (typeof currentPopupRoom !== 'undefined' ? currentPopupRoom : window.currentPopupRoom);
        if (popupRoom) {
            setMode(targetFloor, true, false);
            selectRoom(popupRoom, true);
        } else {
            setMode(targetFloor);
        }
    } else {
        setMode('all');
    }
}
window.toggleAllFloorsMode = toggleAllFloorsMode;

function setMode(newMode, shouldSave = true, shouldAnimateCam = true) {
    const prevMode = STATE.mode;
    const isNewSingleFloor = /^[1-7]$/.test(String(newMode));
    if (isNewSingleFloor) {
        STATE.lastSingleFloor = String(newMode);
    }
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
    const popupRoom = (typeof currentPopupRoom !== 'undefined' ? currentPopupRoom : window.currentPopupRoom);
    if (popupRoom) {
        let roomIsVisible = true;
        if (newMode === 'slice') {
            roomIsVisible = (popupRoom.floor <= (STATE.sliceMaxFloor || 7));
        } else if (newMode !== 'all' && newMode !== 'sideBySide') {
            roomIsVisible = (String(popupRoom.floor) === String(newMode));
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
        if (shouldAnimateCam) {
            if (typeof resetControlsMomentum === 'function') resetControlsMomentum();
            const cx = getActiveCenterX();
            const cz = getActiveCenterZ();
            const isMobile = window.innerWidth < 768;
            const distY = isMobile ? 65 : 55;
            STATE.targetControlsCenter = new THREE.Vector3(cx, 6, cz);
            STATE.targetCamPos = new THREE.Vector3(cx - 30, distY, cz + (isMobile ? 55 : 65));
        }
    } else if ((prevMode === 'all' || prevMode === 'slice') && isNewSingleFloor) {
        // При выходе из режима слоёв («Все этажи» / «Срез») на конкретный этаж автоматически возвращаем 2D-режим
        if (!STATE.is2D && typeof setViewMode === 'function') {
            setViewMode(true, shouldAnimateCam);
        }
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
