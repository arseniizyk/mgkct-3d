    function updateRouteCardUI(route) {
        const card = document.getElementById('navigator-route-card');
        if (!card) return;

        card.classList.remove('hidden');
        document.body.classList.add('route-active');
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) bottomSearch.classList.add('route-active');

        if (typeof window.setFloorSwitcherCollapsed === 'function' && !window._postponeFloorCollapse) {
            window.setFloorSwitcherCollapsed(true, true);
        }

        if (typeof window.updateAdaptiveFabPosition === 'function') {
            requestAnimationFrame(() => {
                window.updateAdaptiveFabPosition();
                setTimeout(window.updateAdaptiveFabPosition, 50);
                setTimeout(window.updateAdaptiveFabPosition, 180);
            });
        }

        // Дистанция и время
        const distEl = document.getElementById('nav-card-dist');
        const timeEl = document.getElementById('nav-card-time');
        const floorsContainer = document.getElementById('nav-card-floors');
        const titleEl = document.getElementById('nav-card-title');

        if (distEl) distEl.textContent = `${route.totalDistance} м`;
        if (timeEl) timeEl.textContent = `~${route.durationMin} мин`;
        if (titleEl) {
            const startName = formatNavNodeName(route.startNode.label, route.startNode.bldg);
            const destName = formatNavNodeName(route.destNode.label, route.destNode.bldg);

            const startEl = document.getElementById('nav-card-start-label');
            const destEl = document.getElementById('nav-card-dest-badge');
            if (startEl && destEl) {
                // Компактные подписи для карточки в стиле Google Expressive
                const shortStart = startName.replace(/\s*\([^)]*\)/g, '').trim() || startName;
                const shortDest = destName.replace(/^Кабинет\s*/i, '').replace(/\s*\([^)]*\)/g, '').trim() || destName;
                startEl.textContent = shortStart;
                startEl.title = `Откуда: ${startName} (нажмите для смены)`;
                destEl.textContent = shortDest;
                destEl.title = `Куда: ${destName} (нажмите для смены)`;

                let routeEndpointSearchLock = false;
                const handleRouteEndpointGesture = (targetType, badgeEl, e) => {
                    if (e) {
                        e.stopPropagation();
                        if (routeEndpointSearchLock) {
                            if (e.cancelable) e.preventDefault();
                            return;
                        }
                        if (e.type === 'touchend' && e.cancelable) {
                            e.preventDefault();
                        }
                    }
                    routeEndpointSearchLock = true;
                    setTimeout(() => { routeEndpointSearchLock = false; }, 350);

                    if (badgeEl && typeof badgeEl.blur === 'function') {
                        badgeEl.blur();
                    }

                    NAV_STATE.targetToChange = targetType;
                    resetRouteCardPicks();

                    const pill = document.getElementById('search-route-target-pill');
                    const pillText = document.getElementById('search-route-target-text');
                    const sInput = document.getElementById('search-input');

                    if (targetType === 'dest') {
                        badgeEl.classList.add('ring-4', 'ring-white/80', 'ring-offset-2', 'ring-offset-[#1a73e8]');
                        if (pill && pillText) {
                            pillText.textContent = 'Выбор конечного пункта (Куда)';
                            pill.className = 'is-dest mb-2 px-3 py-1.5 rounded-full self-start inline-flex items-center gap-2 text-xs font-bold transition-all shadow-sm bg-[#1a73e8] text-white';
                            pill.classList.remove('hidden');
                        }
                        if (sInput) {
                            sInput.placeholder = 'Куда: выберите конечный кабинет...';
                        }
                    } else {
                        badgeEl.classList.add('ring-4', 'ring-[#1a73e8]', 'ring-offset-2', 'ring-offset-[#c2e7ff]');
                        if (pill && pillText) {
                            pillText.textContent = 'Выбор начального пункта (Откуда)';
                            pill.className = 'is-start mb-2 px-3 py-1.5 rounded-full self-start inline-flex items-center gap-2 text-xs font-bold transition-all shadow-sm bg-[#c2e7ff] text-[#004a77] border border-[#1a73e8]';
                            pill.classList.remove('hidden');
                        }
                        if (sInput) {
                            sInput.placeholder = 'Откуда: выберите начальную точку...';
                        }
                    }

                    // Открываем модалку поиска и синхронно фокусируем инпут в том же тике жеста пользователя
                    if (typeof openSearch === 'function') {
                        openSearch(false, true);
                    }
                };

                // Нажатие на кабинет открывает поиск и клавиатуру для выбора нового конечного пункта
                destEl.onclick = (e) => handleRouteEndpointGesture('dest', destEl, e);
                destEl.ontouchend = (e) => handleRouteEndpointGesture('dest', destEl, e);

                // Нажатие на начальную точку открывает поиск и клавиатуру для выбора начального пункта
                startEl.onclick = (e) => handleRouteEndpointGesture('start', startEl, e);
                startEl.ontouchend = (e) => handleRouteEndpointGesture('start', startEl, e);
            } else {
                titleEl.textContent = `${startName} ➔ ${destName}`;
            }

            titleEl.onclick = (e) => {
                if (e.target.closest('#nav-card-dest-badge') || e.target.closest('#nav-card-start-label')) {
                    return;
                }
                openNavigatorModal();
            };
        }

        // Клик по любой области плашки маршрута открывает модальное меню маршрута,
        // сохраняя при этом быстрый выбор точек по клику на сами бейджи
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            if (e.target.closest('#nav-card-dest-badge')) return;
            if (e.target.closest('#nav-card-start-label')) return;
            if (e.target.closest('#btn-card-close')) return;
            if (e.target.closest('#nav-card-floors') || e.target.closest('.m3-nav-stairs-icon') || e.target.closest('.m3-nav-floor-chip') || e.target.closest('.m3-nav-floor-pill')) return;
            if (e.target.closest('#nav-steps-container')) return;

            openNavigatorModal();
        };

        // Круглая иконка лестницы/лифта: по нажатию переход на следующий этаж маршрута
        const stairsIconEl = card.querySelector('.m3-nav-stairs-icon');
        if (stairsIconEl) {
            stairsIconEl.style.cursor = 'pointer';
            const hasElevator = (route && route.nodes && route.nodes.some(n => n.type === 'elevator')) ||
                                (route && route.instructions && route.instructions.some(i => i.isElevator)) ||
                                (route && route.stairTransitions && route.stairTransitions.some(st => st.isElevator));
            if (hasElevator) {
                stairsIconEl.innerHTML = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-10.5 3c.69 0 1.25.56 1.25 1.25S9.19 8.5 8.5 8.5 7.25 7.94 7.25 7.25 7.81 6 8.5 6zM11 14h-1v4H7v-4H6v-2.5c0-1.1.9-2 2-2h1c1.1 0 2 .9 2 2V14zm4.5 3L13 13h5l-2.5 4zm-2.5-6 2.5-4 2.5 4h-5z"/></svg>`;
                stairsIconEl.title = 'В маршруте используется лифт (нажмите для перехода по этажам)';
            } else {
                stairsIconEl.innerHTML = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h4v-4h4v-4h4V7h4"></path></svg>`;
                stairsIconEl.title = 'Перейти на следующий этаж';
            }
            stairsIconEl.onclick = (e) => {
                e.stopPropagation();
                if (route && route.involvedFloors && route.involvedFloors.length > 1) {
                    const currF = parseInt(STATE.mode, 10);
                    const idx = route.involvedFloors.indexOf(currF);
                    const nextF = (idx !== -1 && idx < route.involvedFloors.length - 1)
                        ? route.involvedFloors[idx + 1]
                        : route.involvedFloors[0];
                    if (typeof setMode === 'function') {
                        setMode(String(nextF));
                        const targetNode = (typeof resolveFloorFocusNode === 'function')
                            ? resolveFloorFocusNode(route, nextF, currF)
                            : route.nodes.find(n => n.floor === nextF);
                        if (targetNode && typeof focusCameraOnSegment === 'function') {
                            focusCameraOnSegment(targetNode);
                        }
                        updateRouteCardUI(route);
                    }
                }
            };
        }

        // Этажные кнопки переключения (круглые Google Maps Indoor Level Buttons, без "эт.")
        if (floorsContainer) {
            floorsContainer.innerHTML = '';
            const activeFloorStr = (STATE && STATE.mode && STATE.mode !== 'all') ? String(STATE.mode) : String(route.startNode ? route.startNode.floor : '1');
            route.involvedFloors.forEach(f => {
                const btn = document.createElement('button');
                const isActive = String(f) === activeFloorStr;
                btn.className = `m3-nav-floor-pill ${isActive ? 'active-pill' : ''}`;
                btn.textContent = String(f);
                btn.title = `Перейти на ${f} этаж`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (typeof setMode === 'function') {
                        const currF = (STATE && STATE.mode && STATE.mode !== 'all') ? parseInt(STATE.mode, 10) : null;
                        setMode(String(f));
                        // Перемещаем камеру к началу отрезка или выходу лестницы при возвращении
                        const targetNode = (typeof resolveFloorFocusNode === 'function')
                            ? resolveFloorFocusNode(route, f, currF)
                            : route.nodes.find(n => n.floor === f);
                        if (targetNode && typeof focusCameraOnSegment === 'function') {
                            focusCameraOnSegment(targetNode);
                        }
                        updateRouteCardUI(route);
                    }
                };
                floorsContainer.appendChild(btn);
            });
        }

        // Список пошаговых инструкций (чистый M3 дизайн с поддержкой светлой и тёмной тем)
        const listEl = document.getElementById('nav-steps-list');
        if (listEl) {
            listEl.innerHTML = '';
            route.instructions.forEach((inst, idx) => {
                const li = document.createElement('li');
                li.className = 'm3-step-item flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition select-none';
                li.innerHTML = `
                    <div class="w-6 h-6 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 shadow-sm">
                        ${idx + 1}
                    </div>
                    <div class="step-text flex-1 min-w-0 text-xs font-semibold leading-snug">
                        ${escapeHtml(inst.text)}
                    </div>
                `;
                li.onclick = () => {
                    if (typeof setMode === 'function' && String(inst.floor) !== STATE.mode) {
                        setMode(String(inst.floor));
                    }
                    const n = NAV_STATE.graph.getNode(inst.nodeId);
                    if (n) focusCameraOnSegment(n);
                };
                listEl.appendChild(li);
            });
        }
    }
