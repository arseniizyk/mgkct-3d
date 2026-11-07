    // ------------------------------------------------------------------------
    // ИНИЦИАЛИЗАЦИЯ И РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ СОБЫТИЙ
    // ------------------------------------------------------------------------
    function initNavigator() {
        if (NAV_STATE.isInitialized) return;
        if (!NAV_STATE.graph) {
            NAV_STATE.graph = buildCollegeNavGraph();
        }
        NAV_STATE.isInitialized = true;

        // Google Maps: начальная установка точки отправления
        setDefaultStartPoint();

        // Поведение поля "Откуда": автоочистка дефолтного значения при первом вводе
        const inputStart = document.getElementById('nav-input-start');
        if (inputStart) {
            const selectIfDefault = () => {
                if (inputStart.getAttribute('data-is-default') === 'true') {
                    inputStart.select();
                }
            };
            inputStart.addEventListener('focus', selectIfDefault);
            inputStart.addEventListener('click', selectIfDefault);
            inputStart.addEventListener('keydown', (e) => {
                if (inputStart.getAttribute('data-is-default') === 'true') {
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        inputStart.value = '';
                        inputStart.removeAttribute('data-is-default');
                        NAV_STATE.startPoint = null;
                        const btnClearA = document.getElementById('btn-clear-start');
                        if (btnClearA) btnClearA.classList.remove('hidden');
                    } else if (e.key === 'Backspace' || e.key === 'Delete') {
                        inputStart.value = '';
                        inputStart.removeAttribute('data-is-default');
                        NAV_STATE.startPoint = null;
                    }
                }
            });
        }

        // Кнопка очистки поля "Откуда"
        const btnClearStart = document.getElementById('btn-clear-start');
        if (btnClearStart) {
            btnClearStart.addEventListener('click', () => {
                if (inputStart) {
                    inputStart.value = '';
                    inputStart.removeAttribute('data-is-default');
                    inputStart.focus();
                }
                NAV_STATE.startPoint = null;
                btnClearStart.classList.add('hidden');
                const dropStart = document.getElementById('nav-dropdown-start');
                if (dropStart) dropStart.classList.add('hidden');
            });
        }

        // Кнопка очистки поля "Куда"
        const inputDest = document.getElementById('nav-input-dest');
        const btnClearDest = document.getElementById('btn-clear-dest');
        if (btnClearDest) {
            btnClearDest.addEventListener('click', () => {
                if (inputDest) {
                    inputDest.value = '';
                    inputDest.focus();
                }
                NAV_STATE.destPoint = null;
                btnClearDest.classList.add('hidden');
                const dropDest = document.getElementById('nav-dropdown-dest');
                if (dropDest) dropDest.classList.add('hidden');
            });
        }

        // Синхронная делегация фокуса при нажатии на бейджи «Отсюда» / «Сюда» и строки ввода в модалке маршрута
        [inputStart, inputDest].forEach((inp) => {
            if (!inp) return;
            inp.addEventListener('focus', () => {
                if (typeof updateVisualViewportVars === 'function') {
                    updateVisualViewportVars();
                    setTimeout(updateVisualViewportVars, 80);
                    setTimeout(updateVisualViewportVars, 250);
                }
            });
            inp.addEventListener('blur', () => {
                if (typeof updateVisualViewportVars === 'function') {
                    setTimeout(updateVisualViewportVars, 80);
                    setTimeout(updateVisualViewportVars, 250);
                }
            });

            const rowEl = inp.closest('.m3-nav-input-row');
            if (rowEl) {
                const focusRowInput = (e) => {
                    if (!e || !e.target) return;
                    if (e.target === inp) return;
                    if (e.target.closest('button') || e.target.closest('#nav-dropdown-start') || e.target.closest('#nav-dropdown-dest')) {
                        return;
                    }
                    if (e.type === 'touchend' && e.cancelable) {
                        e.preventDefault();
                    }
                    try {
                        inp.focus({ preventScroll: true });
                    } catch (_) {
                        try { inp.focus(); } catch (_) {}
                    }
                };
                rowEl.addEventListener('click', focusRowInput);
                rowEl.addEventListener('touchend', focusRowInput);
            }
        });

        // Переключатель лифтов: свич вкл/выкл и иконка
        const switchElev = document.getElementById('toggle-elevators-switch');
        const btnElev = document.getElementById('btn-toggle-elevators');
        const btnElevIcon = document.getElementById('btn-toggle-elevators-icon');
        const elevText = document.getElementById('elevators-status-text');

        function setElevatorsState(enabled) {
            NAV_STATE.allowElevators = !!enabled;
            if (switchElev) switchElev.checked = NAV_STATE.allowElevators;
            if (btnElevIcon) {
                btnElevIcon.classList.toggle('active', NAV_STATE.allowElevators);
                btnElevIcon.setAttribute('aria-pressed', NAV_STATE.allowElevators ? 'true' : 'false');
                btnElevIcon.title = NAV_STATE.allowElevators ? 'Лифты включены (нажмите, чтобы выключить)' : 'Использовать лифты';
            }
            const switchLabel = document.getElementById('elevators-switch-label');
            if (switchLabel) {
                const isLight = document.body.getAttribute('data-theme') === 'light';
                if (NAV_STATE.allowElevators) {
                    if (isLight) {
                        switchLabel.style.borderColor = '#1a73e8';
                        switchLabel.style.backgroundColor = '#c2e7ff';
                    } else {
                        switchLabel.classList.add('border-[#1a73e8]', 'bg-[#1a73e8]/25');
                        switchLabel.classList.remove('bg-slate-900/80', 'border-slate-700/80');
                    }
                } else {
                    if (isLight) {
                        switchLabel.style.borderColor = '#cbd5e1';
                        switchLabel.style.backgroundColor = '#ffffff';
                    } else {
                        switchLabel.classList.remove('border-[#1a73e8]', 'bg-[#1a73e8]/25');
                        switchLabel.classList.add('bg-slate-900/80', 'border-slate-700/80');
                    }
                }
            }
            if (elevText) {
                elevText.textContent = NAV_STATE.allowElevators ? 'Лифты: вкл' : 'Без лифтов';
            }
            if (btnElev) {
                btnElev.classList.toggle('active', NAV_STATE.allowElevators);
            }
            if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
            }
        }

        if (btnElevIcon) {
            btnElevIcon.addEventListener('click', () => {
                setElevatorsState(!NAV_STATE.allowElevators);
            });
        }
        if (switchElev) {
            switchElev.checked = NAV_STATE.allowElevators;
            switchElev.addEventListener('change', () => {
                setElevatorsState(switchElev.checked);
            });
        }
        if (btnElev) {
            btnElev.addEventListener('click', () => {
                setElevatorsState(!NAV_STATE.allowElevators);
            });
        }

        // Быстрый маршрут к ближайшему туалету
        function routeToClosestToilet() {
            if (!NAV_STATE.startPoint) setDefaultStartPoint();
            const toilet = findClosestToilet(NAV_STATE.startPoint);
            if (toilet) {
                NAV_STATE.destPoint = toilet;
                if (inputDest) {
                    inputDest.value = formatNavInputString(toilet);
                    if (btnClearDest) btnClearDest.classList.remove('hidden');
                }
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                closeNavigatorModal();
            }
        }

        const btnQuickToilet = document.getElementById('btn-quick-toilet');
        if (btnQuickToilet) btnQuickToilet.addEventListener('click', routeToClosestToilet);

        // Кнопка "Построить маршрут" (ОК)
        const btnConfirmRoute = document.getElementById('btn-confirm-route');
        if (btnConfirmRoute) {
            btnConfirmRoute.addEventListener('click', () => {
                if (!NAV_STATE.startPoint) setDefaultStartPoint();
                if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                    buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                    closeNavigatorModal();
                } else if (!NAV_STATE.destPoint && inputDest) {
                    inputDest.focus();
                    inputDest.classList.add('ring-2', 'ring-rose-500');
                    setTimeout(() => inputDest.classList.remove('ring-2', 'ring-rose-500'), 1200);
                }
            });
        }

        // Кнопка открытия навигатора в шапке
        const btnOpen = document.getElementById('btn-open-navigator');
        if (btnOpen) {
            btnOpen.addEventListener('click', () => openNavigatorModal(null));
        }

        // Кнопка закрытия модалки
        const btnClose = document.getElementById('btn-close-navigator');
        if (btnClose) {
            btnClose.addEventListener('click', () => closeNavigatorModal(false));
        }

        const backdrop = document.getElementById('navigator-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => closeNavigatorModal(false));
        }

        // Закрытие модалки по клавише Escape
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('navigator-modal');
                if (modal && (modal.classList.contains('open') || modal.classList.contains('active'))) {
                    closeNavigatorModal();
                }
            }
        });

        // Кнопка инверсии точек
        const btnSwap = document.getElementById('btn-nav-swap');
        if (btnSwap) {
            btnSwap.addEventListener('click', swapStartAndDest);
        }

        // Кнопка очистки
        const btnClear = document.getElementById('btn-nav-clear');
        if (btnClear) {
            btnClear.addEventListener('click', clearRoute);
        }

        // Кнопка закрытия карточки маршрута
        const btnCardClose = document.getElementById('btn-card-close');
        if (btnCardClose) {
            btnCardClose.addEventListener('click', (e) => {
                e.stopPropagation();
                clearRoute();
            });
        }

        // Автодополнение для поля "Откуда"
        setupNavigatorAutocomplete('nav-input-start', 'nav-dropdown-start', (item) => {
            NAV_STATE.startPoint = item;
            if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                closeNavigatorModal();
            }
        });

        // Автодополнение для поля "Куда"
        setupNavigatorAutocomplete('nav-input-dest', 'nav-dropdown-dest', (item) => {
            NAV_STATE.destPoint = item;
            if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
                buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                closeNavigatorModal();
            }
        });


        setupNavQuickChips();
        applyNavUrlParams();
    }
    window.initNavigator = initNavigator;
