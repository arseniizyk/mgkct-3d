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
            hideRoomContextPopup(true, false);

            // Если пришли из поиска — возвращаемся обратно в поиск!
            if (targetOverlay === 'search') {
                if (typeof openSearch === 'function') {
                    openSearch(true, false);
                }
                activeOverlay = 'search';
                return;
            }

            activeOverlay = (targetOverlay === 'route' || isRouteActive) ? 'route' : null;
            return;
        }

        // 2. Если был открыт поиск
        if (isSearchOpen) {
            if (typeof closeSearch === 'function') closeSearch(true);
            activeOverlay = (targetOverlay === 'route' || isRouteActive) ? 'route' : null;
            return;
        }

        // 3. Если было открыто окно навигатора
        if (isNavModalOpen) {
            if (typeof closeNavigatorModal === 'function') closeNavigatorModal(true);
            activeOverlay = (targetOverlay === 'route' || isRouteActive) ? 'route' : null;
            return;
        }

        // 4. Если был активен маршрут
        if (isRouteActive) {
            if (typeof clearRoute === 'function') clearRoute(true);
            if (targetOverlay === 'search' && typeof openSearch === 'function') {
                openSearch(true, false);
                activeOverlay = 'search';
                return;
            }
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

function replaceOverlayState(name, extra = {}) {
    if (typeof window === 'undefined' || !window.history) return;
    try {
        const stateObj = { page: 'map', overlay: name, ...extra };
        history.replaceState(stateObj, '');
        activeOverlay = name;
    } catch (_) {}
}

function popOverlayState(name) {
    if (typeof window === 'undefined' || !window.history) return;
    if (activeOverlay === name) {
        const restoreRouteOverlay = Boolean(
            name !== 'route' &&
            history.state &&
            history.state.overRoute &&
            typeof NAV_STATE !== 'undefined' &&
            NAV_STATE.activeRoute
        );
        activeOverlay = restoreRouteOverlay ? 'route' : null;
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
window.replaceOverlayState = replaceOverlayState;
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
    const searchTagChips = searchModal ? Array.from(searchModal.querySelectorAll(".search-tag-chip")) : [];
    const btnOpenSearch = document.getElementById("btn-open-search");
    const btnCloseSearch = document.getElementById("btn-close-search");
    const btnClearSearch = document.getElementById("btn-clear-search");

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
            pushOverlayState('search', {
                overRoute: Boolean(window.NAV_STATE && window.NAV_STATE.activeRoute)
            });
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
        searchTagChips.forEach(c => c.classList.remove("is-active"));
        const searchCard = document.querySelector(".m3-search-card");
        if (searchCard) {
            searchCard.classList.add("hidden");
        }
        if (searchInput) {
            searchInput.placeholder = 'Поиск по колледжу...';
        }
        if (!keepPickBanner) {
            if (window.NAV_STATE) {
                window.NAV_STATE.targetToChange = null;
            }
            if (typeof window.hidePickBanner === 'function') {
                window.hidePickBanner();
            }
        }
    }

    window.openSearch = openSearch;
    window.closeSearch = closeSearch;

    bindSearchGesturesAndEvents({ searchModal, searchBackdrop, searchInput, searchResults, searchTagChips, btnOpenSearch, btnCloseSearch, btnClearSearch, openSearch, closeSearch });
}
