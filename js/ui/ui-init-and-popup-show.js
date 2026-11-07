function setupUI() {
    initHistoryManager();
    setupVisualViewportHandler();
    setupSearch();
    setupSettingsDrawer();
    setupRoomContextPopup();

    // Селектор этажей (кнопки 1–7 и Все этажи)
    document.querySelectorAll('.floor-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.floor;
            if (!f) return;
            if (f === 'all') {
                toggleAllFloorsMode();
            } else {
                setMode(f);
            }
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

    document.getElementById('btn-toggle-all-floors')?.addEventListener('click', toggleAllFloorsMode);

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
currentPopupRoom = null;
window.currentPopupRoom = null;
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

    const routeCard = document.getElementById('navigator-route-card');
    const hasActiveRoute = Boolean(window.NAV_STATE && window.NAV_STATE.activeRoute);

    // Временно скрываем DOM-карточку активного маршрута, сохраняя сам 3D-маршрут на сцене
    if (hasActiveRoute) {
        if (routeCard) routeCard.classList.add('hidden');
        document.body.classList.remove('route-active');
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) bottomSearch.classList.remove('route-active');
    }

    const overlayMeta = { fromSearch: Boolean(fromSearch), overRoute: hasActiveRoute };
    if (activeOverlay === 'room-card') {
        replaceOverlayState('room-card', overlayMeta);
    } else {
        pushOverlayState('room-card', overlayMeta);
    }
    currentPopupRoom = roomInfo;
    window.currentPopupRoom = currentPopupRoom;

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

    updateAdaptiveFabPosition();
    requestAnimationFrame(updateAdaptiveFabPosition);
    setTimeout(updateAdaptiveFabPosition, 60);
    setTimeout(updateAdaptiveFabPosition, 280);

    if (shouldSelectAndFly && typeof selectRoom === 'function') {
        selectRoom(roomInfo, true);
    }
}
