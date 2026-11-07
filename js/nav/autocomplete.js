    const ROOM_ALIASES = {
        'b3_f1_entrance_west': 'главный вход основной вход западный вход вход к3 корпус 3',
        'b1_f1_entrance_main': 'восточный вход главный вход 2 старый вход вход к1 корпус 1 ремонт',
        'room_4_1_182': '104 4-104 гардероб раздевалка',
        'room_4_1_183': '103 4-103 гардероб раздевалка',
        'room_4_1_186': '1 4-1 туалет санузел',
        'room_4_1_187': '2 4-2 туалет санузел',
        'room_4_1_188': '105 4-105 инвентарная',
        'room_4_1_189': '3 4-3',
        'room_4_1_190': '11 4-11 охлаждаемая камера',
        'room_4_1_191': '12 4-12 бельевая',
        'room_4_1_192': '14 4-14 мойка столовой посуды',
        'room_4_1_193': '15 4-15',
        'room_4_1_194': '16 4-16',
        'room_4_1_195': '17 4-17',
        'room_4_1_196': '18 4-18 хлеборезка',
        'room_4_1_197': '19 4-19 суточный запас продуктов',
        'room_4_1_198': '4 4-4',
        'room_4_1_199': '5 4-5',
        'room_4_1_200': '6 4-6',
        'room_4_1_201': '7 4-7',
        'room_4_1_202': '8 4-8',
        'room_4_1_203': '9 4-9',
        'room_4_1_204': '10 4-10',
        'room_4_1_205': '13 4-13 камера отходов',
        'room_4_1_206': '20 4-20 кладовая сухих продуктов',
        'room_4_1_207': '21 4-21 овощной цех',
        'room_4_1_208': '24 4-24 горячий цех кухня',
        'room_4_1_209': '22 4-22 мясо-рыбный цех',
        'room_4_1_210': '23 4-23 моечная посуды мойка',
        'room_4_2_224': '201 4-201',
        'room_4_2_223': '202 4-202',
        'room_4_2_228': '203 4-203',
        'room_4_2_222': '205 4-205 раздевалка',
        'room_4_2_225': '207 4-207 тренерская снарядная',
        'room_4_2_226': '208 4-208',
        'room_4_2_227': '209 4-209 раздевалка',
        'room_4_2_218': '210 4-210',
        'room_4_2_219': '211 4-211 служебное помещение',
        'room_4_2_220': '212 4-212',
        'room_4_3_237': '301 4-301',
        'room_4_3_238': '302 4-302',
        'room_4_3_239': '303 4-303',
        'room_4_3_247': '304 4-304',
        'room_4_3_240': '305 4-305',
        'room_4_3_246': '306 4-306',
        'room_4_3_248': '308 4-308',
        'room_4_3_249': '309 4-309',
        'room_4_3_243': '310 4-310',
        'room_4_3_242': '311 4-311',
        'room_4_3_241': '312 4-312',
        'room_4_1_184': '102 4-102 столовая буфет обед',
        'room_1_1_0': '102 1-102 гардероб раздевалка одежда',
        'room_2_1_103': '104 2-104 библиотека книги читальный зал',
        'room_4_2_230': '204 4-204 актовый зал сцена',
        'room_4_2_211': '206 4-206 спортзал спортивный зал спорт',
        'room_2_3_135': '308 2-308 спортзал спортивный зал спорт',
        'room_2_3_136': '312 2-312 конференц-зал конференц зал собрания',
        'room_2_2_112': '209 2-209 учебная часть учебная'
    };

    // ------------------------------------------------------------------------
    // АВТОЗАПОЛНЕНИЕ И ПОИСК КАБИНЕТОВ В ПОЛЯХ НАВИГАТОРА
    // ------------------------------------------------------------------------
    function setupNavigatorAutocomplete(inputId, dropdownId, onSelect) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!input || !dropdown) return;

        // AbortController позволяет атомарно снять все listener'ы этого instance
        // при повторном вызове setupNavigatorAutocomplete (или при уничтожении модала).
        const ac = new AbortController();
        const { signal } = ac;

        // Сохраняем контроллер на DOM-элементе, чтобы внешний код мог вызвать cleanup.
        if (input._navAutocompletAC) input._navAutocompletAC.abort();
        input._navAutocompletAC = ac;

        input.addEventListener('input', () => {
            if (inputId === 'nav-input-start' && input.getAttribute('data-is-default') === 'true') {
                input.removeAttribute('data-is-default');
                NAV_STATE.startPoint = null;
            }
            const clearBtnId = inputId === 'nav-input-start' ? 'btn-clear-start' : 'btn-clear-dest';
            const clearBtn = document.getElementById(clearBtnId);
            if (clearBtn) {
                if (input.value.length > 0) clearBtn.classList.remove('hidden');
                else clearBtn.classList.add('hidden');
            }

            const query = input.value.trim().toLowerCase();
            if (query.length === 0) {
                dropdown.classList.add('hidden');
                dropdown.innerHTML = '';
                return;
            }

            if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
            const g = NAV_STATE.graph;

            // ROOM_ALIASES определён на уровне модуля — не пересоздаём при каждом keystroke.

            const matches = [];
            for (const [nid, n] of g.nodes.entries()) {
                if (n.type === 'room' || n.type === 'entrance') {
                    // Кэшируем вычисленные поисковые ключевые слова на узле графа,
                    // избегая квадратичного поиска O(N*M) в ROOMS_REGISTRY на каждое нажатие клавиши
                    if (!n._searchKeywords) {
                        const lbl = (n.label || '').toLowerCase();
                        const alias = (ROOM_ALIASES[nid] || '').toLowerCase();
                        const formattedCode = formatNavNodeName(n.label, n.bldg).toLowerCase();

                        let extraKeywords = '';
                        if (/^wc\b/i.test(lbl)) {
                            extraKeywords = 'туалет санузел уборная wc с/у';
                        } else if (/^с\/у/i.test(lbl)) {
                            extraKeywords = 'служебный с/у санузел';
                        }
                        if (typeof ROOMS_REGISTRY !== 'undefined' && Array.isArray(ROOMS_REGISTRY)) {
                            const rMatch = ROOMS_REGISTRY.find(r => 
                                r.building === n.bldg && 
                                r.floor === n.floor && 
                                (r.text === n.label || r.text.includes(n.label) || (n.bldg > 1 && r.text.includes(`${n.bldg}-${n.label}`)))
                            );
                            if (rMatch) {
                                extraKeywords += ' ' + (rMatch.text || '').toLowerCase();
                                if (typeof getRoomSubjectAndTeacher === 'function') {
                                    const details = getRoomSubjectAndTeacher(n.bldg, n.floor, n.label, rMatch.text);
                                    if (details) {
                                        extraKeywords += ' ' + (details.subject || '').toLowerCase() + ' ' + (details.teacher || '').toLowerCase();
                                    }
                                }
                            }
                        }
                        n._searchKeywords = `${lbl} ${n.bldg}-${lbl} ${formattedCode} ${alias} ${extraKeywords}`;
                    }

                    if (n._searchKeywords.includes(query)) {
                        matches.push(n);
                        if (matches.length >= 8) break;
                    }
                }
            }

            if (matches.length === 0) {
                dropdown.innerHTML = '<div class="px-4 py-3 text-xs font-medium text-slate-400 dark:text-slate-500 text-center">Ничего не найдено</div>';
                dropdown.classList.remove('hidden');
                return;
            }

            dropdown.innerHTML = '';
            matches.sort((a, b) => {
                if (query === 'главный вход') {
                    if (a.id === 'b3_f1_entrance_west') return -1;
                    if (b.id === 'b3_f1_entrance_west') return 1;
                }
                return 0;
            });
            matches.forEach((item, index) => {
                let codeLabel = formatNavNodeName(item.label, item.bldg);
                let displayTitle = item.label;
                let subtitle = `Корпус ${item.bldg} • ${item.floor} этаж`;

                if (typeof formatSearchRoomBadgeAndTitle === 'function') {
                    let rObj = null;
                    if (typeof ROOMS_REGISTRY !== 'undefined' && Array.isArray(ROOMS_REGISTRY)) {
                        rObj = ROOMS_REGISTRY.find(r => 
                            r.building === item.bldg && 
                            r.floor === item.floor && 
                            (r.text === item.label || r.text.includes(item.label) || (item.bldg > 1 && r.text.includes(`${item.bldg}-${item.label}`)))
                        );
                    }
                    const formatted = formatSearchRoomBadgeAndTitle(rObj || {
                        building: item.bldg,
                        floor: item.floor,
                        text: item.label,
                        rawText: item.label
                    });
                    if (formatted) {
                        codeLabel = formatted.codeLabel || codeLabel;
                        displayTitle = formatted.displayTitle || displayTitle;
                        subtitle = formatted.subtitle || subtitle;
                    }
                }

                const row = document.createElement('button');
                row.type = 'button';
                const isActive = index === 0 ? ' is-active' : '';
                row.className = `m3-search-row flex items-stretch w-full transition text-left cursor-pointer${isActive}`;
                row.innerHTML = `
                    <!-- Колонка 1: Номер аудитории -->
                    <div class="m3-search-col-num flex items-center justify-center font-bold text-slate-800 dark:text-slate-100 select-none">
                        ${escapeHtml(codeLabel)}
                    </div>

                    <!-- Колонка 2: Бейджи Корпуса и Этажа -->
                    <div class="m3-search-col-badges flex flex-col justify-stretch p-0 m-0">
                        <div class="m3-search-badge m3-badge-bldg flex items-center justify-center gap-1" title="Корпус ${escapeHtml(item.bldg)}">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="4" y="3" width="7" height="18" rx="1"></rect>
                                <rect x="11" y="9" width="6" height="12" rx="1"></rect>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.bldg)}</span>
                        </div>
                        <div class="m3-search-badge m3-badge-floor flex items-center justify-center gap-1" title="${escapeHtml(item.floor)} этаж">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.floor)}</span>
                        </div>
                    </div>

                    <!-- Колонка 3: Название кабинета + преподаватель / описание -->
                    <div class="m3-search-col-info flex flex-col justify-center min-w-0 flex-1 overflow-hidden">
                        <span class="m3-search-title truncate">${escapeHtml(displayTitle)}</span>
                        <span class="m3-search-subtitle truncate">${escapeHtml(subtitle)}</span>
                    </div>
                `;

                const handleSelect = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    input.value = formatNavInputString(item);
                    if (inputId === 'nav-input-start') {
                        input.removeAttribute('data-is-default');
                    }
                    dropdown.classList.add('hidden');
                    if (clearBtn) clearBtn.classList.remove('hidden');
                    onSelect(item);
                };

                row.onclick = handleSelect;
                row._onItemClick = handleSelect;
                dropdown.appendChild(row);
            });

            dropdown.classList.remove('hidden');
        }, { signal });

        // Клавиша Enter выбирает первый активный элемент из подсказок
        // { signal } обеспечивает автоматическое снятие listener при вызове ac.abort()
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !dropdown.classList.contains('hidden')) {
                const firstRow = dropdown.querySelector('.m3-search-row');
                if (firstRow && firstRow._onItemClick) {
                    e.preventDefault();
                    firstRow._onItemClick();
                }
            }
        }, { signal });

        // Закрытие выпадающего списка при клике вне.
        // { signal } обеспечивает автоматическое снятие listener при вызове ac.abort().
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        }, { signal });
    }

    // ------------------------------------------------------------------------
    // ИНИЦИАЛИЗАЦИЯ И РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ СОБЫТИЙ
    // ------------------------------------------------------------------------
