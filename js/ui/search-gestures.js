// Обработка жестов открытия поиска, горячих клавиш, чипов и делегирования кликов по выдаче
function bindSearchGesturesAndEvents(ctx) {
    const { searchModal, searchBackdrop, searchInput, searchResults, searchTagChips, btnOpenSearch, btnCloseSearch, btnClearSearch, openSearch, closeSearch } = ctx;

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
        // Синхронизируем активное состояние чипов с текущим текстом в поле поиска
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

    searchTagChips.forEach(chip => {
        chip.addEventListener("click", () => {
            const q = chip.dataset.query || "";
            const isAlreadyActive = chip.classList.contains("is-active");

            // Снимаем активность со всех чипов
            searchTagChips.forEach(c => c.classList.remove("is-active"));
            if (typeof chip.blur === "function") chip.blur();

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
        const routePickTarget = (window.NAV_STATE && window.NAV_STATE.targetToChange) ? window.NAV_STATE.targetToChange : null;
        closeSearch(!routePickTarget);

        // Очищаем строку поиска после выбора найденного кабинета
        if (searchInput) {
            searchInput.value = '';
        }
        if (btnClearSearch) {
            btnClearSearch.classList.add('hidden');
        }
        searchTagChips.forEach(c => c.classList.remove('is-active'));
        if (typeof renderSearchResults === 'function') {
            renderSearchResults('');
        }

        // Оставляем видимыми все корпуса комплекса, чтобы не изолировать один корпус при поиске кабинета
        if (typeof setBuildingFilter === "function" && STATE.buildingFilter !== "both") {
            setBuildingFilter("both", false);
        }
        const roomInfo = { floor: f, building: b, x: x, z: z, text: t };

        // Сохраняем в недавние поиски
        if (typeof saveRecentSearch === "function") {
            saveRecentSearch(roomInfo);
        }

        // Если пользователь явно открыл поиск для смены точки маршрута (Куда / Откуда)
        if (routePickTarget) {
            if (typeof window.applyRoomToActiveRoute === 'function') {
                window.applyRoomToActiveRoute(roomInfo, routePickTarget);
            }
            if (window.NAV_STATE) {
                window.NAV_STATE.targetToChange = null;
            }
            if (typeof hideRoomContextPopup === 'function') {
                hideRoomContextPopup(true, true);
            }
            return;
        }
        selectRoom(roomInfo, true);
        if (typeof showRoomContextPopup === "function") {
            showRoomContextPopup(roomInfo, window.innerWidth / 2, window.innerHeight * 0.42, false, true);
        }
    });


    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("search")) {
            openSearch();
            const cat = urlParams.get("cat");
            const catQuery = cat === "canteen" ? "Буфет" : (cat === "toilet" ? "Туалет" : (cat === "info" ? "101" : ""));
            if (catQuery) {
                const targetChip = searchTagChips.find(c => (c.dataset.query || "").toLowerCase() === catQuery.toLowerCase());
                if (targetChip) targetChip.click();
            }
        }
    } catch (_) {}
}
