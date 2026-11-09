    // Кнопки выбора на карте, быстрые чипы популярных направлений и разбор URL-параметров маршрута
    function setupNavQuickChips() {
        // Кнопка "Выбрать на карте" (Откуда)
        const btnPickStart = document.getElementById('btn-pick-start');
        if (btnPickStart) {
            btnPickStart.addEventListener('click', () => {
                NAV_STATE.pickingMode = 'start';
                closeNavigatorModal();
                showPickBanner('Нажмите на кабинет или точку отправления на карте', 'start');
            });
        }

        // Кнопка "Выбрать на карте" (Куда)
        const btnPickDest = document.getElementById('btn-pick-dest');
        if (btnPickDest) {
            btnPickDest.addEventListener('click', () => {
                NAV_STATE.pickingMode = 'dest';
                closeNavigatorModal();
                showPickBanner('Нажмите на кабинет или пункт назначения на карте', 'dest');
            });
        }

        // Кнопка отмены выбора на карте
        const btnCancelPick = document.getElementById('btn-cancel-pick');
        if (btnCancelPick) {
            btnCancelPick.addEventListener('click', () => {
                NAV_STATE.pickingMode = null;
                NAV_STATE.targetToChange = null;
                hidePickBanner();
                if (!NAV_STATE.activeRoute) {
                    openNavigatorModal();
                }
            });
        }

        // Быстрые чипы популярных направлений: используем AbortController для защиты от дублирования
        if (NAV_STATE._chipsAbortController) {
            NAV_STATE._chipsAbortController.abort();
        }
        NAV_STATE._chipsAbortController = new AbortController();
        const chipsSignal = NAV_STATE._chipsAbortController.signal;

        const chips = document.querySelectorAll('.nav-quick-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const targetText = chip.getAttribute('data-target');
                if (!targetText) return;

                // Находим целевой узел
                const g = NAV_STATE.graph;
                const q = targetText.toLowerCase().trim();
                let targetNode = null;

                // Точное соответствие для главного входа (Корпус 3) и входа 2 (Корпус 1)
                if (q === 'главный вход' || q === 'западный вход' || q === 'основной вход' || q === 'вход') {
                    targetNode = g.getNode('b3_f1_entrance_west');
                } else if (q === 'восточный вход' || q === 'главный вход 2' || q === 'старый вход' || q === 'вход к1' || q === 'ремонт') {
                    targetNode = g.getNode('b1_f1_entrance_main');
                } else {
                    for (const node of g.nodes.values()) {
                        if (node.type === 'room' || node.type === 'entrance') {
                            const lbl = (node.label || '').toLowerCase();
                            const isMatch =
                                (q === 'столовая' && ((node.bldg === 4 && node.floor === 1 && lbl.includes('102')) || lbl.includes('столов'))) ||
                                (q === 'спортзал' && ((node.bldg === 4 && node.floor === 2 && lbl.includes('206')) || lbl.includes('спортзал'))) ||
                                (q === 'актовый зал' && ((node.bldg === 4 && node.floor === 2 && lbl.includes('204')) || lbl.includes('актовый'))) ||
                                (q === 'учебная часть' && ((node.bldg === 2 && node.floor === 2 && lbl.includes('209')) || lbl.includes('учебн'))) ||
                                (q === 'гардероб' && ((node.bldg === 1 && node.floor === 1 && lbl.includes('102')) || lbl.includes('гардероб'))) ||
                                (q === 'библиотека' && ((node.bldg === 2 && node.floor === 1 && lbl.includes('104')) || lbl.includes('библиот'))) ||
                                (q === 'конференц-зал' && ((node.bldg === 2 && node.floor === 3 && lbl.includes('312')) || lbl.includes('конференц'))) ||
                                (lbl.includes(q) && !(q === 'главный вход' && node.id === 'b1_f1_entrance_main'));
                            if (isMatch) {
                                targetNode = node;
                                break;
                            }
                        }
                    }
                }
                if (targetNode) {
                    NAV_STATE.destPoint = targetNode;
                    const inputB = document.getElementById('nav-input-dest');
                    if (inputB) {
                        inputB.value = formatNavInputString(targetNode);
                        const btnClearB = document.getElementById('btn-clear-dest');
                        if (btnClearB) btnClearB.classList.remove('hidden');
                    }

                    // Если точка отправления не выбрана, ставим Главный вход
                    if (!NAV_STATE.startPoint) {
                        setDefaultStartPoint();
                    }

                    if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                        buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                        closeNavigatorModal();
                    }
                }
            }, { signal: chipsSignal });
        });

        // Кнопка "Свернуть/Развернуть подробный маршрут"
        const btnToggleSteps = document.getElementById('btn-toggle-steps');
        const stepsContainer = document.getElementById('nav-steps-container');
        if (btnToggleSteps && stepsContainer) {
            btnToggleSteps.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = stepsContainer.classList.contains('hidden');
                stepsContainer.classList.toggle('hidden', !isHidden);
                const icon = btnToggleSteps.querySelector('svg');
                if (icon) {
                    icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            });
        }

        // Хук переключения этажа для синхронизации маршрута
        window.addEventListener('floorChanged', updateRouteVisibilityForCurrentMode);

    }

    function applyNavUrlParams() {
        // Поддержка запуска маршрута через URL параметры: ?from=105&to=206
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlFrom = urlParams.get('from');
                const urlTo = urlParams.get('to');
                if (urlFrom || urlTo) {
                    setTimeout(() => {
                        const g = NAV_STATE.graph;
                        let fromNode = null;
                        let toNode = null;

                        if (urlFrom) {
                            const q = urlFrom.toLowerCase().trim();
                            if (q === 'главный вход' || q === 'западный вход' || q === 'основной вход' || q === 'вход') {
                                fromNode = g.getNode('b3_f1_entrance_west');
                            } else if (q === 'восточный вход' || q === 'главный вход 2' || q === 'старый вход' || q === 'вход к1' || q === 'ремонт') {
                                fromNode = g.getNode('b1_f1_entrance_main');
                            } else {
                                for (const n of g.nodes.values()) {
                                    if ((n.type === 'room' || n.type === 'entrance') && n.label.toLowerCase().includes(q)) {
                                        fromNode = n;
                                        break;
                                    }
                                }
                            }
                        }
                        if (urlTo) {
                            const q = urlTo.toLowerCase().trim();
                            if (q === 'главный вход' || q === 'западный вход' || q === 'основной вход' || q === 'вход') {
                                toNode = g.getNode('b3_f1_entrance_west');
                            } else if (q === 'восточный вход' || q === 'главный вход 2' || q === 'старый вход' || q === 'вход к1' || q === 'ремонт') {
                                toNode = g.getNode('b1_f1_entrance_main');
                            } else {
                                for (const n of g.nodes.values()) {
                                    if ((n.type === 'room' || n.type === 'entrance') && n.label.toLowerCase().includes(q)) {
                                        toNode = n;
                                        break;
                                    }
                                }
                            }
                        }
                        if (fromNode && toNode) {
                            buildRoute(fromNode, toNode);
                        } else if (toNode) {
                            const entrance = g.getNode('b3_f1_entrance_west') || g.getNode('b1_f1_entrance_main');
                            if (entrance) buildRoute(entrance, toNode);
                        }
                    }, 500);
                } else if (urlParams.has('nav') || urlParams.has('navigator')) {
                    openNavigatorModal();
                }
            } catch (err) {
                console.warn('Navigator URL params parse error:', err);
            }
        }
    }

    function resetRouteCardPicks() {
        const startEl = document.getElementById('nav-card-start-label');
        const destEl = document.getElementById('nav-card-dest-badge');
        if (destEl) destEl.classList.remove('ring-4', 'ring-white/80', 'ring-offset-2', 'ring-offset-[#1a73e8]', 'animate-pulse');
        if (startEl) startEl.classList.remove('ring-4', 'ring-[#1a73e8]', 'ring-offset-2', 'ring-offset-[#c2e7ff]', 'animate-pulse');
    }

    function showPickBanner(text, targetType = 'dest') {
        NAV_STATE.pickingMode = targetType;
        document.body.classList.add('nav-picking-active');
        const banner = document.getElementById('nav-pick-banner');
        const textEl = document.getElementById('nav-pick-text');
        const subtextEl = document.getElementById('nav-pick-subtext');
        const iconWrap = document.getElementById('nav-pick-icon-wrap');
        const iconEl = document.getElementById('nav-pick-icon');

        // Эксплицитно скрываем карточку маршрута во время выбора точки, чтобы не было наложения
        const routeCard = document.getElementById('navigator-route-card');
        if (routeCard) {
            routeCard.classList.add('hidden');
            routeCard.setAttribute('data-hidden-by-pick', 'true');
        }

        if (banner) {
            if (textEl) {
                textEl.textContent = 'Выберите на карте';
            }
            if (subtextEl) {
                subtextEl.textContent = targetType === 'start'
                    ? 'Начальная точка (Откуда)'
                    : 'Конечный кабинет (Куда)';
            }
            if (iconWrap) {
                iconWrap.classList.remove('is-start', 'is-dest');
                if (targetType === 'start') {
                    iconWrap.classList.add('is-start');
                    if (iconEl) {
                        iconEl.setAttribute('class', 'w-5 h-5 flex-shrink-0');
                        iconEl.innerHTML = '<path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>';
                    }
                } else {
                    iconWrap.classList.add('is-dest');
                    if (iconEl) {
                        iconEl.setAttribute('class', 'w-5 h-5 flex-shrink-0');
                        iconEl.innerHTML = '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>';
                    }
                }
            }
            banner.classList.remove('hidden');
        }

        if (typeof window.updateAdaptiveFabPosition === 'function') {
            window.updateAdaptiveFabPosition();
        }
    }

    function hidePickBanner() {
        document.body.classList.remove('nav-picking-active');
        const banner = document.getElementById('nav-pick-banner');
        if (banner) banner.classList.add('hidden');
        const pill = document.getElementById('search-route-target-pill');
        if (pill) pill.classList.add('hidden');
        const sInput = document.getElementById('search-input');
        if (sInput) sInput.placeholder = 'Поиск по кабинетам...';
        NAV_STATE.pickingMode = null;
        NAV_STATE.targetToChange = null;
        resetRouteCardPicks();

        // Восстанавливаем карточку маршрута, если есть активный маршрут
        const routeCard = document.getElementById('navigator-route-card');
        if (routeCard) {
            const wasHidden = routeCard.getAttribute('data-hidden-by-pick') === 'true';
            routeCard.removeAttribute('data-hidden-by-pick');
            if (NAV_STATE.activeRoute || wasHidden) {
                if (NAV_STATE.activeRoute) {
                    routeCard.classList.remove('hidden');
                }
            }
        }

        // Восстанавливаем поисковый бар, если маршрута нет
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) {
            bottomSearch.classList.remove('hidden');
            if (!NAV_STATE.activeRoute) {
                bottomSearch.classList.remove('route-active');
                bottomSearch.style.removeProperty('display');
                bottomSearch.style.removeProperty('opacity');
                bottomSearch.style.removeProperty('pointer-events');
            }
        }

        if (typeof window.updateAdaptiveFabPosition === 'function') {
            window.updateAdaptiveFabPosition();
        }
    }

    // Экспорт глобальных функций модуля быстрых чипов и URL
    window.findClosestToilet = findClosestToilet;
    window.setDefaultStartPoint = setDefaultStartPoint;
    window.showPickBanner = showPickBanner;
    window.hidePickBanner = hidePickBanner;
