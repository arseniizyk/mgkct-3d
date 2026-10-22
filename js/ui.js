// ==========================================
// ОБРАБОТКА ПОЛЬЗОВАТЕЛЬСКОГО ИНТЕРФЕЙСА (UI)
// ИНТЕРАКТИВНАЯ КАРТА КОЛЛЕДЖА (2D / 3D)
// ==========================================

const SETTINGS_KEY = 'college_3d_map_settings_v2';

const BUILDING_MAX_FLOORS = {
    'both': 7,
    '1': 7,
    '2': 3,
    '3': 2,
    '4': 3
};

const BUILDING_NAMES = {
    'both': 'Все корпуса',
    '1': 'Корпус 1',
    '2': 'Корпус 2',
    '3': 'Корпус 3',
    '4': 'Корпус 4'
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
    STATE.buildingFilter = bFilter;

    // Обновляем визуальное состояние чипсов выбора корпуса
    document.querySelectorAll('.bldg-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.bldg === bFilter);
    });

    // Ограничиваем этажи доступными для выбранного корпуса
    updateFloorButtonsAvailability();
    const maxAllowed = BUILDING_MAX_FLOORS[bFilter] || 7;
    if (STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice') {
        const currF = parseInt(STATE.mode, 10);
        if (currF > maxAllowed) {
            setMode(String(maxAllowed), false);
        }
    }

    // Центрируем камеру на выбранном корпусе
    if (shouldAnimateCam && camera && controls) {
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

    // Обновляем правый селектор этажей
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.floor === newMode);
    });

    updateFloorInfo();
    recalcTargetPositions();
    updateAlignmentGuides();
    updateStairValidationAxes();
    updateExplodeButtonStyle();
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
        STATE.mode = 'slice';
        document.querySelectorAll('.floor-btn').forEach(btn => btn.classList.remove('active'));
        updateFloorInfo();
        recalcTargetPositions();
        updateAlignmentGuides();
        updateStairValidationAxes();
        saveSettings();
    }
}

function updateExplodeButtonStyle() {
    const btnExplode = document.getElementById('btn-explode');
    if (!btnExplode) return;

    if (STATE.exploded && (STATE.mode === 'all' || STATE.mode === 'slice') && STATE.explodeGap > 0.2) {
        btnExplode.classList.add('explode-btn-active');
        btnExplode.innerHTML = '<span class="flex items-center justify-center gap-1.5"><svg class="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg> Собрать этажи</span>';
    } else {
        btnExplode.classList.remove('explode-btn-active');
        btnExplode.innerHTML = '<span class="flex items-center justify-center gap-1.5"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> Разнести этажи</span>';
    }
}

function toggle2DView() {
    setViewMode(!STATE.is2D);
}

function setViewMode(is2D) {
    STATE.is2D = is2D;
    const btn2D = document.getElementById('btn-toggle-2d');
    if (btn2D) {
        btn2D.textContent = is2D ? '2D' : '3D';
        btn2D.classList.toggle('mode-active', !is2D);
        btn2D.title = is2D ? 'Режим: 2D карта (нажмите для 3D)' : 'Режим: 3D изометрия (нажмите для 2D)';
    }

    if (typeof apply2DControls === 'function') {
        apply2DControls(is2D);
    }

    const cx = controls ? controls.target.x : getActiveCenterX();
    const cz = controls ? controls.target.z : getActiveCenterZ();
    const isMobile = window.innerWidth < 768;
    const isBoth = STATE.buildingFilter === 'both';
    const distY = isMobile ? (isBoth ? 54 : 42) : (isBoth ? 68 : 46);
    const offsetZ = isMobile ? (isBoth ? 18 : 14) : 22;

    if (is2D) {
        // Вид сверху прямо на карту под комфортным углом 72° без сингулярности
        STATE.targetCamPos = new THREE.Vector3(cx, distY, cz + offsetZ);
    } else {
        // Перспективный 3D ракурс под углом
        const maxF = STATE.mode === 'slice' ? STATE.sliceMaxFloor : (STATE.mode === 'all' ? 7 : 1);
        const midY = ((STATE.mode === 'all' || STATE.mode === 'slice') && STATE.exploded)
            ? (STATE.wallHeight + STATE.explodeGap) * (maxF / 2)
            : (STATE.wallHeight * 0.45 * maxF);
        STATE.targetCamPos = new THREE.Vector3(cx - 24, 52 + midY, cz + 52);
    }

    if (typeof requestRender === 'function') requestRender(45);
    saveSettings();
}

function resetToNorth() {
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

function setWallHeight(newHeight) {
    newHeight = Math.max(0.15, Math.min(3.5, parseFloat(newHeight)));
    STATE.wallHeight = newHeight;

    const slider = document.getElementById('slider-wall-height');
    const val = document.getElementById('wall-height-val');
    if (slider) slider.value = newHeight;
    if (val) val.textContent = newHeight.toFixed(2) + ' м';

    if (typeof updateWallHeights === 'function') {
        updateWallHeights();
    }
    saveSettings();
}

function setLabelScale(scale) {
    STATE.labelScale = scale;

    document.querySelectorAll('.labelsize-btn').forEach(b => {
        b.classList.remove('active', 'bg-sky-600', 'text-white', 'border-sky-400');
        b.classList.add('bg-slate-800', 'text-slate-300', 'border-slate-700/60');
    });

    let btnId = 'btn-labelsize-large';
    if (scale <= 0.85) btnId = 'btn-labelsize-normal';
    else if (scale >= 1.25) btnId = 'btn-labelsize-xl';

    const activeBtn = document.getElementById(btnId);
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-sky-600', 'text-white', 'border-sky-400');
        activeBtn.classList.remove('bg-slate-800', 'text-slate-300', 'border-slate-700/60');
    }

    if (typeof updateRoomLabelsScale === 'function') {
        updateRoomLabelsScale();
    }
    saveSettings();
}

// Выбор кабинета (при клике на карте или в поиске)
function selectRoom(roomInfo) {
    if (!roomInfo) return;

    // Включаем нужный этаж
    setMode(String(roomInfo.floor));

    // Обновляем нижнюю инфо-карточку
    const cleanName = roomInfo.text ? roomInfo.text.replace('\n', ' ') : 'Кабинет';
    updateInfoCard(`Кабинет ${cleanName}`, `Корпус ${roomInfo.building} • ${roomInfo.floor} этаж`);

    // Центрируем камеру на кабинете
    const targetY = STATE.is2D ? 38 : 28;
    const camZOffset = STATE.is2D ? 14 : 30;
    const camXOffset = STATE.is2D ? 0 : -14;

    STATE.targetControlsCenter = new THREE.Vector3(roomInfo.x, 0, roomInfo.z);
    STATE.targetCamPos = new THREE.Vector3(roomInfo.x + camXOffset, targetY, roomInfo.z + camZOffset);

    // Тактильный отклик на телефоне
    if (navigator.vibrate) {
        navigator.vibrate(15);
    }

    if (typeof requestRender === 'function') requestRender(60);
}

// Поиск кабинетов
function setupSearch() {
    const searchModal = document.getElementById('search-modal');
    const searchBackdrop = document.getElementById('search-backdrop');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const btnOpenSearch = document.getElementById('btn-open-search');
    const btnCloseSearch = document.getElementById('btn-close-search');

    function openSearch() {
        searchModal?.classList.add('active');
        searchBackdrop?.classList.add('active');
        setTimeout(() => searchInput?.focus(), 150);
        renderSearchResults(searchInput ? searchInput.value : '');
    }

    function closeSearch() {
        searchModal?.classList.remove('active');
        searchBackdrop?.classList.remove('active');
    }

    btnOpenSearch?.addEventListener('click', openSearch);
    btnCloseSearch?.addEventListener('click', closeSearch);
    searchBackdrop?.addEventListener('click', closeSearch);

    searchInput?.addEventListener('input', (e) => {
        renderSearchResults(e.target.value);
    });

    document.querySelectorAll('.search-tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.dataset.query || '';
            if (searchInput) searchInput.value = q;
            renderSearchResults(q);
        });
    });

    function renderSearchResults(query) {
        if (!searchResults) return;
        query = (query || '').trim().toLowerCase();

        if (typeof ROOMS_REGISTRY === 'undefined' || ROOMS_REGISTRY.length === 0) {
            searchResults.innerHTML = '<div class="text-center py-4 text-xs text-slate-500">Загрузка базы кабинетов...</div>';
            return;
        }

        // Поддержка поиска с указанием корпуса (например: 2-102, 2/102, 2:102, к2-102, 2к 102, 2к102, корпус 2 102)
        let targetBldg = null;
        let targetRoomQuery = query;

        const dashMatch = query.match(/^([1-4])\s*[-/:.]\s*([а-яa-z0-9№\s]*)$/i);
        const kMatch = query.match(/^(?:к|корп|корпус)\s*([1-4])\s*[-/:.\s]?\s*([а-яa-z0-9№\s]*)$/i);
        const postKMatch = query.match(/^([1-4])\s*(?:к|корп|корпус)\s*[-/:.\s]?\s*([а-яa-z0-9№\s]*)$/i);

        if (dashMatch) {
            targetBldg = parseInt(dashMatch[1], 10);
            targetRoomQuery = (dashMatch[2] || '').trim();
        } else if (kMatch) {
            targetBldg = parseInt(kMatch[1], 10);
            targetRoomQuery = (kMatch[2] || '').trim();
        } else if (postKMatch) {
            targetBldg = parseInt(postKMatch[1], 10);
            targetRoomQuery = (postKMatch[2] || '').trim();
        }

        const filtered = ROOMS_REGISTRY.filter(r => {
            if (!query) return true;

            const roomText = r.text.toLowerCase();
            const bldg = r.building;

            if (targetBldg !== null) {
                if (bldg !== targetBldg) return false;
                if (!targetRoomQuery) return true;
                return roomText.includes(targetRoomQuery);
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

            return roomText.includes(query) ||
                   bldgCombos.some(c => c.includes(query)) ||
                   `корпус ${bldg}`.includes(query) ||
                   `этаж ${r.floor}`.includes(query);
        });

        // Сортировка: точные совпадения корпуса и номера кабинета всегда вверху
        filtered.sort((a, b) => {
            const aText = a.text.toLowerCase();
            const bText = b.text.toLowerCase();
            const q = targetBldg !== null ? targetRoomQuery : query;

            if (q) {
                if (aText === q && bText !== q) return -1;
                if (bText === q && aText !== q) return 1;
                if (aText.startsWith(q) && !bText.startsWith(q)) return -1;
                if (bText.startsWith(q) && !aText.startsWith(q)) return 1;
            }
            if (a.building !== b.building) return a.building - b.building;
            return a.floor - b.floor;
        });

        const displayItems = filtered.slice(0, 30);

        if (displayItems.length === 0) {
            searchResults.innerHTML = `<div class="text-center py-6 text-xs text-slate-500">По запросу «${query}» ничего не найдено</div>`;
            return;
        }

        let html = '';
        displayItems.forEach(item => {
            const bldgLabel = `Корпус ${item.building}`;
            const floorLabel = `${item.floor} этаж`;
            const codeLabel = `${item.building}-${item.text}`;
            html += `
                <button class="room-search-item flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition text-left w-full group"
                        data-floor="${item.floor}" data-bldg="${item.building}" data-x="${item.x}" data-z="${item.z}" data-text="${item.text}">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-12 h-8 rounded-lg bg-sky-950/70 border border-sky-800/60 flex items-center justify-center font-black text-sky-300 text-xs tracking-tight flex-shrink-0">
                            ${codeLabel}
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-slate-200 text-xs truncate group-hover:text-sky-300 transition">Кабинет ${item.text}</div>
                            <div class="text-[10px] text-slate-400">${bldgLabel} • ${floorLabel}</div>
                        </div>
                    </div>
                    <svg class="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            `;
        });
        searchResults.innerHTML = html;

        searchResults.querySelectorAll('.room-search-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = parseInt(btn.dataset.floor, 10);
                const b = parseInt(btn.dataset.bldg, 10);
                const x = parseFloat(btn.dataset.x);
                const z = parseFloat(btn.dataset.z);
                const t = btn.dataset.text;
                closeSearch();
                if (typeof setBuildingFilter === 'function') {
                    setBuildingFilter(String(b), false);
                }
                selectRoom({ floor: f, building: b, x: x, z: z, text: t });
            });
        });
    }
}

// Настройка шторки параметров (Settings Drawer)
function setupSettingsDrawer() {
    const drawer = document.getElementById('settings-drawer');
    const backdrop = document.getElementById('settings-backdrop');
    const btnOpen = document.getElementById('btn-open-settings');
    const btnClose = document.getElementById('btn-close-settings');

    function openDrawer() {
        drawer?.classList.add('active');
        backdrop?.classList.add('active');
    }

    function closeDrawer() {
        drawer?.classList.remove('active');
        backdrop?.classList.remove('active');
    }

    btnOpen?.addEventListener('click', openDrawer);
    btnClose?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);
}

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
            exploded: STATE.exploded
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
        if (typeof s.preset === 'string') STATE.preset = s.preset;
        if (typeof s.showShadows === 'boolean') STATE.showShadows = s.showShadows;
        if (typeof s.wallHeight === 'number' && !isNaN(s.wallHeight) && s.wallHeight >= 0.15 && s.wallHeight <= 4.0) {
            STATE.wallHeight = s.wallHeight;
        }
        if (typeof s.labelScale === 'number' && !isNaN(s.labelScale)) {
            STATE.labelScale = s.labelScale;
        }
        if (typeof s.is2D === 'boolean') STATE.is2D = s.is2D;
        if (typeof s.showDoors === 'boolean') STATE.showDoors = s.showDoors;
        if (typeof s.showLabels === 'boolean') STATE.showLabels = s.showLabels;
        if (typeof s.showRoof === 'boolean') STATE.showRoof = s.showRoof;
        if (typeof s.showTerritory === 'boolean') STATE.showTerritory = s.showTerritory;
        if (typeof s.showEdges === 'boolean') STATE.showEdges = s.showEdges;
        if (typeof s.buildingFilter === 'string') STATE.buildingFilter = s.buildingFilter;
        if (typeof s.mode === 'string') STATE.mode = s.mode;
        if (typeof s.sliceMaxFloor === 'number') STATE.sliceMaxFloor = s.sliceMaxFloor;
        if (typeof s.explodeGap === 'number') STATE.explodeGap = s.explodeGap;
        if (typeof s.exploded === 'boolean') STATE.exploded = s.exploded;
    } catch (e) {
        console.warn('LocalStorage load error:', e);
    }
}

function resetSettingsToDefault() {
    try {
        localStorage.removeItem(SETTINGS_KEY);
    } catch (e) {}

    STATE.preset = 'balance';
    STATE.showShadows = false;
    STATE.wallHeight = BASE_WALL_HEIGHT;
    STATE.labelScale = 1.0;
    STATE.is2D = true;
    STATE.slabOpacity = 1.0;
    STATE.showDoors = true;
    STATE.showLabels = true;
    STATE.smartLabelOcclusion = true;
    STATE.showRoof = false;
    STATE.showTerritory = false;
    STATE.showStairAxes = false;
    STATE.showGuides = false;
    STATE.showEdges = true;
    STATE.buildingFilter = 'both';
    STATE.mode = '1';
    STATE.sliceMaxFloor = 7;
    STATE.explodeGap = 0.0;
    STATE.exploded = false;

    // Сброс значений слайдеров и чекбоксов
    const sliderHeight = document.getElementById('slider-wall-height');
    const valHeight = document.getElementById('wall-height-val');
    if (sliderHeight) sliderHeight.value = BASE_WALL_HEIGHT;
    if (valHeight) valHeight.textContent = BASE_WALL_HEIGHT.toFixed(2) + ' м';

    const tShadows = document.getElementById('toggle-shadows');
    if (tShadows) tShadows.checked = false;
    const tDoors = document.getElementById('toggle-doors');
    if (tDoors) tDoors.checked = true;
    const tLabels = document.getElementById('toggle-labels');
    if (tLabels) tLabels.checked = true;
    const tEdges = document.getElementById('toggle-edges');
    if (tEdges) tEdges.checked = true;
    const tRoof = document.getElementById('toggle-roof');
    if (tRoof) tRoof.checked = false;
    const tTerritory = document.getElementById('toggle-territory');
    if (tTerritory) tTerritory.checked = false;

    setBuildingFilter('both', false);
    setMode('1', false);
    setViewMode(true);
    setLabelScale(1.0);
    setWallHeight(BASE_WALL_HEIGHT);

    if (typeof updateWallHeights === 'function') updateWallHeights();
    if (typeof updateEdgesVisibility === 'function') updateEdgesVisibility();
    if (typeof updateLabelsVisibility === 'function') updateLabelsVisibility();
    if (typeof updateRoofsVisibility === 'function') updateRoofsVisibility();
    if (typeof updateTerritoryVisibility === 'function') updateTerritoryVisibility();

    resetToNorth();
    saveSettings();
}

function setupUI() {
    // 1. Поиск кабинетов и шторка параметров
    setupSearch();
    setupSettingsDrawer();

    // 2. Селектор этажей (кнопки 1–7 и Все)
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.floor;
            if (f) setMode(f);
        });
    });

    // 3. Выбор корпуса (чипсы в шапке)
    document.querySelectorAll('.bldg-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const b = chip.dataset.bldg;
            if (b) setBuildingFilter(b);
        });
    });

    // 4. Плавающие кнопки карты: 2D/3D, компас, зум
    document.getElementById('btn-toggle-2d')?.addEventListener('click', toggle2DView);
    document.getElementById('btn-compass')?.addEventListener('click', resetToNorth);
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        if (typeof zoomIn === 'function') zoomIn();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        if (typeof zoomOut === 'function') zoomOut();
    });
    document.getElementById('btn-center-view')?.addEventListener('click', resetToNorth);

    // 5. Высота стен
    const sliderHeight = document.getElementById('slider-wall-height');
    const valHeight = document.getElementById('wall-height-val');
    if (sliderHeight) sliderHeight.value = STATE.wallHeight;
    if (valHeight) valHeight.textContent = STATE.wallHeight.toFixed(2) + ' м';

    sliderHeight?.addEventListener('input', e => {
        setWallHeight(e.target.value);
    });

    document.getElementById('btn-wall-min')?.addEventListener('click', () => setWallHeight(0.35));
    document.getElementById('btn-wall-mid')?.addEventListener('click', () => setWallHeight(1.20));
    document.getElementById('btn-wall-max')?.addEventListener('click', () => setWallHeight(2.40));

    // 6. Размер номеров кабинетов
    document.getElementById('btn-labelsize-normal')?.addEventListener('click', () => setLabelScale(0.8));
    document.getElementById('btn-labelsize-large')?.addEventListener('click', () => setLabelScale(1.0));
    document.getElementById('btn-labelsize-xl')?.addEventListener('click', () => setLabelScale(1.35));

    // 7. Ракурсы в шторке
    document.getElementById('btn-view-top')?.addEventListener('click', () => setViewMode(true));
    document.getElementById('btn-view-3d')?.addEventListener('click', () => setViewMode(false));
    document.getElementById('btn-view-side')?.addEventListener('click', () => setMode('sideBySide'));
    document.getElementById('btn-view-305')?.addEventListener('click', () => {
        STATE.targetCamPos = new THREE.Vector3(36.0, 36.0, -2.0);
        STATE.targetControlsCenter = new THREE.Vector3(36.0, 3.5, -28.0);
        if (typeof requestRender === 'function') requestRender(40);
    });

    // 8. Срез и разнос этажей
    const sliderSlice = document.getElementById('slider-slice');
    sliderSlice?.addEventListener('input', e => {
        setSliceFloor(parseInt(e.target.value, 10));
    });

    const sliderExplode = document.getElementById('slider-explode');
    const valExplode = document.getElementById('explode-val');
    if (sliderExplode) sliderExplode.value = STATE.explodeGap || 0;
    if (valExplode) valExplode.textContent = (STATE.explodeGap || 0).toFixed(1) + ' м';

    sliderExplode?.addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        STATE.explodeGap = v;
        STATE.exploded = v > 0.1;
        if (valExplode) valExplode.textContent = v.toFixed(1) + ' м';
        recalcTargetPositions();
        saveSettings();
    });

    // 9. Переключатели слоёв
    const tLabels = document.getElementById('toggle-labels');
    if (tLabels) tLabels.checked = STATE.showLabels;
    tLabels?.addEventListener('change', e => {
        STATE.showLabels = e.target.checked;
        if (typeof updateLabelsVisibility === 'function') updateLabelsVisibility();
        saveSettings();
    });

    const tDoors = document.getElementById('toggle-doors');
    if (tDoors) tDoors.checked = STATE.showDoors;
    tDoors?.addEventListener('change', e => {
        STATE.showDoors = e.target.checked;
        if (typeof updateWallHeights === 'function') updateWallHeights();
        saveSettings();
    });

    const tEdges = document.getElementById('toggle-edges');
    if (tEdges) tEdges.checked = STATE.showEdges;
    tEdges?.addEventListener('change', e => {
        STATE.showEdges = e.target.checked;
        if (typeof updateEdgesVisibility === 'function') updateEdgesVisibility();
        saveSettings();
    });

    const tShadows = document.getElementById('toggle-shadows');
    if (tShadows) tShadows.checked = STATE.showShadows;
    tShadows?.addEventListener('change', e => {
        STATE.showShadows = e.target.checked;
        if (renderer && renderer.shadowMap) {
            renderer.shadowMap.enabled = e.target.checked;
            renderer.shadowMap.needsUpdate = true;
        }
        if (typeof requestRender === 'function') requestRender(25);
        saveSettings();
    });

    const tTerritory = document.getElementById('toggle-territory');
    if (tTerritory) tTerritory.checked = STATE.showTerritory;
    tTerritory?.addEventListener('change', e => {
        STATE.showTerritory = e.target.checked;
        if (typeof updateTerritoryVisibility === 'function') updateTerritoryVisibility();
        saveSettings();
    });

    const tRoof = document.getElementById('toggle-roof');
    if (tRoof) tRoof.checked = STATE.showRoof;
    tRoof?.addEventListener('change', e => {
        STATE.showRoof = e.target.checked;
        if (typeof updateRoofsVisibility === 'function') updateRoofsVisibility();
        saveSettings();
    });

    // 10. Кнопка сброса настроек
    document.getElementById('btn-reset-settings')?.addEventListener('click', resetSettingsToDefault);

    // Горячая клавиша H — скрыть интерфейс
    window.addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
            return;
        }
        if (e.code === 'KeyH' || e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
            document.body.classList.toggle('ui-hidden');
        }
    });

    // Инициализация активных состояний
    setBuildingFilter(STATE.buildingFilter || 'both', false);
    setMode(STATE.mode || '1', false);
    setViewMode(STATE.is2D);
    setLabelScale(STATE.labelScale || 1.0);
}
