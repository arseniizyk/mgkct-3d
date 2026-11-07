// Отрисовка 3-колоночной выдачи поиска кабинетов (M3 Expressive)
function renderSearchResults(query) {
    const searchResults = document.getElementById("search-results");
    if (!searchResults) return;
    if (query === undefined) {
        const searchInput = document.getElementById("search-input");
        query = searchInput ? searchInput.value : '';
    }
    query = (query || "").trim().toLowerCase().replace(/ё/g, "е");

        const searchCard = document.querySelector(".m3-search-card");

        // 1) Пустой поисковый запрос: скрываем карточку выдачи (чистый M3 Expressive вид над клавиатурой)
        if (!query) {
            if (searchCard) {
                searchCard.classList.add("hidden");
            }
            searchResults.innerHTML = "";
            return;
        }

        if (searchCard) {
            searchCard.classList.remove("hidden");
        }

        if (typeof ROOMS_REGISTRY === "undefined" || ROOMS_REGISTRY.length === 0) {
            searchResults.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">Загрузка базы кабинетов...</div>';
            return;
        }

        let targetBldg = null;
        let targetRoomQuery = query;

        const dashMatch = query.match(/^([1-4])\s*[-/:.]\s*([а-яa-z0-9№\s]*)$/i);
        const kMatch = query.match(/^(?:к|корп|корпус)\s*([1-4])\s*[-/:.\s]?\s*([а-яa-z0-9№\s]*)$/i);
        const postKMatch = query.match(/^([1-4])\s*(?:к|корп|корпус)\s*[-/:.\s]?\s*([а-яa-z0-9№\s]*)$/i);

        if (dashMatch) {
            targetBldg = parseInt(dashMatch[1], 10);
            targetRoomQuery = (dashMatch[2] || "").trim().replace(/ё/g, "е");
        } else if (kMatch) {
            targetBldg = parseInt(kMatch[1], 10);
            targetRoomQuery = (kMatch[2] || "").trim().replace(/ё/g, "е");
        } else if (postKMatch) {
            targetBldg = parseInt(postKMatch[1], 10);
            targetRoomQuery = (postKMatch[2] || "").trim().replace(/ё/g, "е");
        }

        const filtered = ROOMS_REGISTRY.filter(r => {
            const itemInfo = formatSearchRoomBadgeAndTitle(r);
            const rawOrig = itemInfo._rawLower;
            // Скрываем чисто архитектурные подписи («Второй свет», «Витраж», «Переход...»), если пользователь не ищет их специально
            if (!query && (/второй свет|витраж|переход/i.test(rawOrig))) {
                return false;
            }
            if (!query) return true;

            const roomText = itemInfo._roomTextLower;
            const cleanText = itemInfo._cleanLower;
            const bldg = r.building;
            const titleLower = itemInfo._titleLower;
            const subLower = itemInfo._subLower;
            const codeLower = itemInfo._codeLower;

            let alias = "";
            if (bldg === 4 && r.floor === 1 && (cleanText.includes("102") || cleanText.includes("столов"))) alias = "столовая буфет обед еда 102";
            if (bldg === 4 && r.floor === 2 && (cleanText.includes("206") || cleanText.includes("спорт"))) alias = "спортзал спортивный зал спорт 206";
            if (bldg === 4 && r.floor === 2 && (cleanText.includes("204") || cleanText.includes("актов"))) alias = "актовый зал актовый сцена 204";
            if (bldg === 1 && r.floor === 1 && (cleanText.includes("102") || cleanText.includes("гардероб"))) alias = "гардероб раздевалка одежда 102";
            if (bldg === 2 && r.floor === 1 && (cleanText.includes("104") || cleanText.includes("библиот"))) alias = "библиотека книги читальный зал 104";
            if (bldg === 2 && r.floor === 3 && (cleanText.includes("308") || cleanText.includes("спорт"))) alias = "спортзал спортивный зал спорт 308";
            if (bldg === 2 && r.floor === 3 && (cleanText.includes("312") || cleanText.includes("конференц"))) alias = "конференц-зал конференц зал собрания 312";
            if (bldg === 2 && r.floor === 2 && (cleanText.includes("209") || cleanText.includes("учебн"))) alias = "учебная часть учебная 209 2-209";
            if (/^wc\b/i.test(cleanText)) {
                const isM = /м|муж/i.test(cleanText);
                const isF = /ж|жен/i.test(cleanText);
                alias = "туалет санузел уборная wc с/у" + (isM ? " мужской м" : "") + (isF ? " женский ж" : "");
            } else if (/^с\/у/i.test(cleanText)) {
                alias = "служебный с/у санузел";
            }

            if (targetBldg !== null) {
                if (bldg !== targetBldg) return false;
                if (!targetRoomQuery) return true;
                return cleanText.includes(targetRoomQuery) ||
                       roomText.includes(targetRoomQuery) ||
                       codeLower.includes(targetRoomQuery) ||
                       titleLower.includes(targetRoomQuery) ||
                       subLower.includes(targetRoomQuery) ||
                       alias.includes(targetRoomQuery);
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

            return cleanText.includes(query) ||
                   roomText.includes(query) ||
                   codeLower.includes(query) ||
                   titleLower.includes(query) ||
                   subLower.includes(query) ||
                   alias.includes(query) ||
                   bldgCombos.some(c => c.includes(query)) ||
                   `корпус ${bldg}`.includes(query) ||
                   `этаж ${r.floor}`.includes(query);
        });

        filtered.sort((a, b) => {
            const aInfo = formatSearchRoomBadgeAndTitle(a);
            const bInfo = formatSearchRoomBadgeAndTitle(b);
            const aRaw = aInfo._rawLower;
            const bRaw = bInfo._rawLower;
            const aCode = aInfo._codeLower;
            const bCode = bInfo._codeLower;
            const aTitle = aInfo._titleLower;
            const bTitle = bInfo._titleLower;
            const aSub = aInfo._subLower;
            const bSub = bInfo._subLower;
            const q = targetBldg !== null ? targetRoomQuery : query;

            if (q) {
                const aExact = aRaw === q || aCode === q || aTitle === q;
                const bExact = bRaw === q || bCode === q || bTitle === q;
                if (aExact && !bExact) return -1;
                if (bExact && !aExact) return 1;

                const aStarts = aRaw.startsWith(q) || aCode.startsWith(q) || aTitle.startsWith(q) || aSub.startsWith(q);
                const bStarts = bRaw.startsWith(q) || bCode.startsWith(q) || bTitle.startsWith(q) || bSub.startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (bStarts && !aStarts) return 1;
            }
            if (a.building !== b.building) return a.building - b.building;
            if (a.floor !== b.floor) return a.floor - b.floor;
            return aRaw.localeCompare(bRaw, undefined, { numeric: true });
        });

        const displayItems = filtered.slice(0, 30);

        if (displayItems.length === 0) {
            searchResults.innerHTML = `<div class="text-center py-8 text-xs text-slate-400 dark:text-slate-500">По запросу &laquo;${escapeHtml(query)}&raquo; ничего не найдено</div>`;
            return;
        }

        let html = "";
        displayItems.forEach((item, index) => {
            const { codeLabel, displayTitle, subtitle } = formatSearchRoomBadgeAndTitle(item);
            const dataText = (item.text || "").replace(/\n/g, " ");
            // Первая строка (кандидат по нажатию Enter) выделяется ярким цветом
            const isActive = index === 0 ? " is-active" : "";
            html += `
                <button class="m3-search-row room-search-item flex items-stretch w-full transition text-left group overflow-hidden${isActive}"
                        data-floor="${escapeHtml(item.floor)}" data-bldg="${escapeHtml(item.building)}" data-x="${escapeHtml(item.x)}" data-z="${escapeHtml(item.z)}" data-text="${escapeHtml(dataText)}">
                    <!-- Колонка 1: Номер аудитории -->
                    <div class="m3-search-col-num flex items-center justify-center font-bold text-slate-800 dark:text-slate-100 select-none">
                        ${escapeHtml(codeLabel)}
                    </div>

                    <!-- Колонка 2: Бейджи Корпуса и Этажа (на всю ширину блока) -->
                    <div class="m3-search-col-badges flex flex-col justify-stretch p-0 m-0">
                        <!-- Корпус -->
                        <div class="m3-search-badge m3-badge-bldg flex items-center justify-center gap-1" title="Корпус ${escapeHtml(item.building)}">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="4" y="3" width="7" height="18" rx="1"></rect>
                                <rect x="11" y="9" width="6" height="12" rx="1"></rect>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.building)}</span>
                        </div>
                        <!-- Этаж -->
                        <div class="m3-search-badge m3-badge-floor flex items-center justify-center gap-1" title="${escapeHtml(item.floor)} этаж">
                            <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 19h4v-4h4v-4h4V7h4"></path>
                            </svg>
                            <span class="m3-badge-num">${escapeHtml(item.floor)}</span>
                        </div>
                    </div>

                    <!-- Колонка 3: Название кабинета + преподаватель / описание -->
                    <div class="m3-search-col-info flex flex-col justify-center min-w-0 flex-1 overflow-hidden">
                        <span class="m3-search-title room-search-title leading-snug truncate">${escapeHtml(displayTitle)}</span>
                        <span class="m3-search-subtitle room-search-sub truncate">${escapeHtml(subtitle)}</span>
                    </div>
                </button>
            `;
        });
        searchResults.innerHTML = html;

        searchResults.querySelectorAll(".m3-search-row").forEach(btn => {
            btn.addEventListener("pointerdown", () => {
                // При касании/клике снимаем подсветку со всех остальных строк, оставляя только одну активную
                searchResults.querySelectorAll(".m3-search-row.is-active").forEach(r => {
                    if (r !== btn) r.classList.remove("is-active");
                });
                btn.classList.add("is-active");
            });

            btn.addEventListener("mouseenter", () => {
                // Подсвечиваем только при наведении курсора мыши (исключает ложные срабатывания от тач-событий)
                if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
                searchResults.querySelectorAll(".m3-search-row.is-active").forEach(r => {
                    if (r !== btn) r.classList.remove("is-active");
                });
                btn.classList.add("is-active");
            });
        });
    }

window.renderSearchResults = renderSearchResults;
