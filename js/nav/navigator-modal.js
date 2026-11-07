    function openNavigatorModal(focusField = null) {
        const requestedField = (focusField === 'start' || focusField === 'dest') ? focusField : null;
        if (!NAV_STATE.isInitialized && typeof initNavigator === 'function') {
            initNavigator();
        }
        if (typeof hideRoomContextPopup === 'function') hideRoomContextPopup(true, false);
        setDefaultStartPoint();

        // Синхронизируем поля ввода с актуальными точками текущего маршрута
        const inputA = document.getElementById('nav-input-start');
        const inputB = document.getElementById('nav-input-dest');
        if (inputA && NAV_STATE.startPoint) {
            inputA.value = formatNavInputString(NAV_STATE.startPoint);
            const btnClearA = document.getElementById('btn-clear-start');
            if (btnClearA) btnClearA.classList.remove('hidden');
        }
        if (inputB && NAV_STATE.destPoint) {
            inputB.value = formatNavInputString(NAV_STATE.destPoint);
            const btnClearB = document.getElementById('btn-clear-dest');
            if (btnClearB) btnClearB.classList.remove('hidden');
        }
        const btnElevIcon = document.getElementById('btn-toggle-elevators-icon');
        if (btnElevIcon) {
            btnElevIcon.classList.toggle('active', !!NAV_STATE.allowElevators);
            btnElevIcon.setAttribute('aria-pressed', NAV_STATE.allowElevators ? 'true' : 'false');
        }
        const modal = document.getElementById('navigator-modal');
        const backdrop = document.getElementById('navigator-backdrop');
        if (modal && backdrop) {
            document.body.classList.add('navigator-open');
            modal.classList.add('open', 'active');
            backdrop.classList.add('open', 'active');
            modal.style.visibility = 'visible';
            backdrop.style.visibility = 'visible';
            modal.style.opacity = '1';
            backdrop.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            backdrop.style.pointerEvents = 'auto';

            // 1) При явном запросе поля ('start' / 'dest') синхронно фокусируем инпут в тике жеста (iOS/Android клавиатура)
            if (requestedField) {
                const targetInput = requestedField === 'start' ? inputA : inputB;
                if (targetInput) {
                    try {
                        targetInput.focus({ preventScroll: true });
                    } catch (_) {
                        try { targetInput.focus(); } catch (_) {}
                    }
                }
            } else {
                // 2) При открытии общего окна ромбом не перекрываем быстрые чипы на телефоне, но сохраняем автофокус на ПК
                const isDesktop = (typeof window !== 'undefined' && window.innerWidth >= 640);
                if (isDesktop && inputB && (!NAV_STATE.destPoint || !inputB.value)) {
                    try { inputB.focus({ preventScroll: true }); } catch (_) {}
                }
            }
        }
        if (typeof pushOverlayState === 'function') {
            pushOverlayState('navigator', { overRoute: Boolean(NAV_STATE.activeRoute) });
        }
        if (typeof updateVisualViewportVars === 'function') updateVisualViewportVars();
    }

    function closeNavigatorModal(fromPopstate = false) {
        if (!fromPopstate && typeof popOverlayState === 'function') {
            popOverlayState('navigator');
        }
        document.body.classList.remove('navigator-open');
        const modal = document.getElementById('navigator-modal');
        const backdrop = document.getElementById('navigator-backdrop');
        if (modal && backdrop) {
            modal.classList.remove('open', 'active');
            backdrop.classList.remove('open', 'active');
            modal.style.visibility = '';
            backdrop.style.visibility = '';
            modal.style.opacity = '';
            backdrop.style.opacity = '';
            modal.style.pointerEvents = '';
            backdrop.style.pointerEvents = '';
        }
    }

    function swapStartAndDest() {
        const tmp = NAV_STATE.startPoint;
        NAV_STATE.startPoint = NAV_STATE.destPoint;
        NAV_STATE.destPoint = tmp;

        const inputA = document.getElementById('nav-input-start');
        const inputB = document.getElementById('nav-input-dest');
        if (inputA && inputB) {
            const valA = inputA.value;
            inputA.value = inputB.value;
            inputB.value = valA;
            inputA.removeAttribute('data-is-default');
            inputB.removeAttribute('data-is-default');
        }

        const btnClearA = document.getElementById('btn-clear-start');
        if (btnClearA) {
            btnClearA.classList.toggle('hidden', !inputA || !inputA.value);
        }
        const btnClearB = document.getElementById('btn-clear-dest');
        if (btnClearB) {
            btnClearB.classList.toggle('hidden', !inputB || !inputB.value);
        }

        if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
            buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
        }

        hidePickBanner();
    }

    function clearRoute(fromPopstate = false) {
        if (!fromPopstate && typeof popOverlayState === 'function') {
            popOverlayState('route');
        }
        NAV_STATE.startPoint = null;
        NAV_STATE.destPoint = null;
        NAV_STATE.activeRoute = null;

        const inputA = document.getElementById('nav-input-start');
        const inputB = document.getElementById('nav-input-dest');
        if (inputA) inputA.value = '';
        if (inputB) inputB.value = '';

        const btnClearDest = document.getElementById('btn-clear-dest');
        if (btnClearDest) btnClearDest.classList.add('hidden');
        const dropStart = document.getElementById('nav-dropdown-start');
        if (dropStart) dropStart.classList.add('hidden');
        const dropDest = document.getElementById('nav-dropdown-dest');
        if (dropDest) dropDest.classList.add('hidden');

        // Возвращаем в поле «Отсюда» дефолтный вход в колледж вместо полной очистки
        setDefaultStartPoint();

        const card = document.getElementById('navigator-route-card');
        if (card) card.classList.add('hidden');
        document.body.classList.remove('route-active');
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) bottomSearch.classList.remove('route-active');
        if (typeof window.updateAdaptiveFabPosition === 'function') {
            window.updateAdaptiveFabPosition();
        }

        clearRoute3D();
    }

    window.openNavigatorModal = openNavigatorModal;
    window.closeNavigatorModal = closeNavigatorModal;
    window.swapStartAndDest = swapStartAndDest;
    window.clearRoute = clearRoute;

    // ------------------------------------------------------------------------
    // СЛОВАРЬ ПСЕВДОНИМОВ КАБИНЕТОВ ДЛЯ ПОИСКА НАВИГАТОРА
    // Вынесен на уровень модуля: создаётся один раз, а не при каждом keystroke.
    // ------------------------------------------------------------------------
