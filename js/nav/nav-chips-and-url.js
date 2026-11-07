    // Кнопки выбора на карте, быстрые чипы популярных направлений и разбор URL-параметров маршрута
    function setupNavQuickChips() {
        // Кнопка "Выбрать на карте" (Откуда)
        const btnPickStart = document.getElementById('btn-pick-start');
        if (btnPickStart) {
            btnPickStart.addEventListener('click', () => {
                NAV_STATE.pickingMode = 'start';
                closeNavigatorModal();
                showPickBanner('Нажмите на кабинет или точку отправления на карте');
            });
        }

        // Кнопка "Выбрать на карте" (Куда)
        const btnPickDest = document.getElementById('btn-pick-dest');
        if (btnPickDest) {
            btnPickDest.addEventListener('click', () => {
                NAV_STATE.pickingMode = 'dest';
                closeNavigatorModal();
                showPickBanner('Нажмите на кабинет или пункт назначения на карте');
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
        const banner = document.getElementById('nav-pick-banner');
        const textEl = document.getElementById('nav-pick-text');
        const dotEl = document.getElementById('nav-pick-dot');
        if (banner && textEl) {
            textEl.textContent = text;
            if (dotEl) {
                dotEl.className = targetType === 'dest'
                    ? 'w-3 h-3 rounded-full bg-[#1a73e8] animate-ping'
                    : 'w-3 h-3 rounded-full bg-[#38bdf8] animate-ping';
            }
            banner.classList.remove('hidden');
        }
    }

    function hidePickBanner() {
        const banner = document.getElementById('nav-pick-banner');
        if (banner) banner.classList.add('hidden');
        const pill = document.getElementById('search-route-target-pill');
        if (pill) pill.classList.add('hidden');
        const sInput = document.getElementById('search-input');
        if (sInput) sInput.placeholder = 'Поиск по кабинетам...';
        resetRouteCardPicks();
    }

    // Экспорт глобальных функций модуля быстрых чипов и URL
    window.findClosestToilet = findClosestToilet;
    window.setDefaultStartPoint = setDefaultStartPoint;
    window.showPickBanner = showPickBanner;
    window.hidePickBanner = hidePickBanner;
