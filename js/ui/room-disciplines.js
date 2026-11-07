// ============================================================================
// БАЗА ДАННЫХ ДИСЦИПЛИН И ПРЕПОДАВАТЕЛЕЙ
// Загружается динамически из локального файла (без хардкода в коде репозитория)
// ============================================================================
let ROOM_DISCIPLINES = (typeof window !== 'undefined' && window.ROOM_DISCIPLINES) ? window.ROOM_DISCIPLINES : {};
let roomDisciplinesAbortController = null;

function loadRoomDisciplines() {
    if (ROOM_DISCIPLINES && Object.keys(ROOM_DISCIPLINES).length > 0) {
        return;
    }
    if (roomDisciplinesAbortController) {
        roomDisciplinesAbortController.abort();
    }
    roomDisciplinesAbortController = new AbortController();
    const signal = roomDisciplinesAbortController.signal;

    fetch('data/teachers.json', { signal })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (signal.aborted) return;
            if (data && typeof data === 'object') {
                ROOM_DISCIPLINES = data;
                if (typeof window !== 'undefined') window.ROOM_DISCIPLINES = data;
                if (typeof ROOMS_REGISTRY !== 'undefined' && Array.isArray(ROOMS_REGISTRY)) {
                    for (let i = 0; i < ROOMS_REGISTRY.length; i++) {
                        ROOMS_REGISTRY[i]._searchCache = null;
                    }
                }
                if (typeof NAV_STATE !== 'undefined' && NAV_STATE && NAV_STATE.graph && NAV_STATE.graph.nodes) {
                    for (const node of NAV_STATE.graph.nodes.values()) {
                        node._searchKeywords = null;
                    }
                }
                const searchInput = document.getElementById('search-input');
                if (typeof renderSearchResults === 'function') {
                    renderSearchResults(searchInput ? searchInput.value : '');
                } else if (typeof window !== 'undefined' && typeof window.renderSearchResults === 'function') {
                    window.renderSearchResults(searchInput ? searchInput.value : '');
                }
            }
        })
        .catch(err => {
            if (err && err.name === 'AbortError') return;
            // Файл отсутствует в публичном репозитории — работаем в штатном режиме
        });
}
loadRoomDisciplines();

// Функция определения названия дисциплины и преподавателя для аудитории
function getRoomSubjectAndTeacher(building, floor, code, rawText) {
    const b = parseInt(building, 10) || 1;
    const f = parseInt(floor, 10) || 1;
    const stripped = (code || "").replace(/^[1-4]-/, "").trim();
    const full = b > 1 ? `${b}-${stripped}` : stripped;

    // Прямой поиск по всем возможным составным ключам
    const candidates = b > 1 ? [
        `${b}-${f}-${full}`,
        `${b}-${f}-${stripped}`,
        full,
        `${b}-${stripped}`
    ] : [
        `1-${f}-${stripped}`,
        full,
        stripped,
        code
    ];

    for (const k of candidates) {
        if (ROOM_DISCIPLINES && ROOM_DISCIPLINES[k]) {
            return ROOM_DISCIPLINES[k];
        }
    }

    // Хозяйственные и специальные помещения
    if (b === 4 && f === 1 && stripped === "101") {
        return { subject: "Технический архив и серверная", teacher: "" };
    }
    if (b === 4 && f === 1 && stripped === "106") {
        return { subject: "Склад материально-технического снабжения", teacher: "" };
    }

    if (b === 4 && f === 1 && /^\d+$/.test(stripped) && parseInt(stripped, 10) <= 24) {
        return { subject: `Служебное помещение №${stripped}`, teacher: "" };
    }

    return { subject: "", teacher: "" };
}

// Форматирование короткого бейджа и заголовка кабинета для поиска (Предмет + ФИО преподавателя) с кэшированием
function formatSearchRoomBadgeAndTitle(item) {
    if (item && item._searchCache) {
        return item._searchCache;
    }
    const rawOrig = (item.rawText || item.text || "").trim();
    const lines = rawOrig.split("\n").map(s => s.trim()).filter(Boolean);
    const firstLine = lines[0] || "";
    const secondLine = lines.slice(1).join(" ");
    const b = item.building;
    const f = item.floor;

    let codeNum = firstLine;
    let title = "";
    let subtitle = "";

    // Специальные залы и знаковые помещения
    if (b === 4 && f === 1 && /столов/i.test(rawOrig)) {
        codeNum = "102";
        title = "Столовая";
        subtitle = "Зона питания и буфет";
    } else if (b === 1 && f === 1 && /гардероб/i.test(rawOrig)) {
        codeNum = "102";
        title = "Гардероб";
        subtitle = "Раздевалка и приём одежды";
    } else if (b === 2 && f === 1 && /библиот/i.test(rawOrig)) {
        codeNum = "104";
        title = "Библиотека";
        subtitle = "Читальный зал и книжный фонд";
    } else if (b === 4 && f === 2 && /актов/i.test(rawOrig)) {
        codeNum = "204";
        title = "Актовый зал";
        subtitle = "Концертный зал и сцена";
    } else if (b === 4 && f === 2 && /спорт/i.test(rawOrig)) {
        codeNum = "206";
        title = "Спортивный зал";
        subtitle = "Большой спортзал корпуса 4";
    } else if (b === 2 && f === 3 && /спорт/i.test(rawOrig)) {
        codeNum = "308";
        title = "Спортивный зал";
        subtitle = "Спортзал корпуса 2";
    } else if (b === 2 && f === 3 && /конференц/i.test(rawOrig)) {
        codeNum = "312";
        title = "Конференц-зал";
        subtitle = "Зал заседаний и презентаций";
    } else if (b === 2 && f === 2 && (/учебн/i.test(rawOrig) || /209/.test(rawOrig))) {
        codeNum = "209";
        title = "Учебная часть";
        subtitle = "Учебная часть колледжа";
    } else if (/^wc\b/i.test(rawOrig)) {
        const isM = /м|муж/i.test(rawOrig);
        const isF = /ж|жен/i.test(rawOrig);
        codeNum = "WC";
        title = isM ? "WC (мужской)" : (isF ? "WC (женский)" : "WC");
        subtitle = isM ? "Мужской туалет" : (isF ? "Женский туалет" : "Уборная");
    } else if (/^с\/у/i.test(rawOrig)) {
        const isM = /м|муж/i.test(rawOrig);
        const isF = /ж|жен/i.test(rawOrig);
        codeNum = (isM || isF) ? "WC" : "С/У";
        title = isM ? "WC (мужской)" : (isF ? "WC (женский)" : "Служебный с/у");
        subtitle = isM ? "Мужской туалет" : (isF ? "Женский туалет" : "Служебный санузел");
    } else if (/^лк\s*№?\s*(\d+)/i.test(rawOrig)) {
        const m = rawOrig.match(/^лк\s*№?\s*(\d+)/i);
        codeNum = `ЛК${m[1]}`;
        title = `Лестничная клетка №${m[1]}`;
        subtitle = "Эвакуационный и межэтажный проход";
    } else if (/лифт/i.test(rawOrig)) {
        codeNum = "Лифт";
        title = "Лифтовой холл";
        subtitle = "Пассажирский лифт";
    } else if (/переход/i.test(rawOrig)) {
        codeNum = "Перех.";
        title = rawOrig.replace(/\n/g, " ");
        subtitle = "Межкорпусный соединительный переход";
    } else if (/служеб/i.test(rawOrig)) {
        codeNum = "Служ.";
        title = "Служебное помещение";
        subtitle = "Техническая зона";
    } else {
        // Учебные кабинеты (501, 502, 107...)
        const strippedCode = codeNum.replace(/^[1-4]-/, "").trim();
        const formattedRoomCode = b > 1 ? `${b}-${strippedCode}` : strippedCode;

        if (secondLine && !/аудитория|кабинет/i.test(secondLine)) {
            // Если на чертеже есть вторая строка с конкретным назначением (напр. "Лаборатория")
            title = secondLine;
            const details = getRoomSubjectAndTeacher(b, f, strippedCode, rawOrig);
            subtitle = details.teacher ? `${details.teacher} • Корпус ${b}, ${f} этаж` : (details.subject ? `${details.subject} • Корпус ${b}, ${f} этаж` : `Корпус ${b} • ${f} этаж`);
        } else {
            const details = getRoomSubjectAndTeacher(b, f, strippedCode, rawOrig);
            // Если есть специальное административное назначение (напр. "Кабинет директора", "Приёмная", "Учительская")
            if (details.subject && /директор|заместитель|приемн|секретар|бухгалтер|учительск|декан/i.test(details.subject)) {
                title = details.subject;
                subtitle = details.teacher ? `${details.teacher} • Корпус ${b}, ${f} этаж` : `Корпус ${b} • ${f} этаж`;
            } else {
                // Предмет не всегда совпадает с кабинетом (кабинеты универсальные, расписание меняется),
                // поэтому название помещения — "Кабинет X", а предмет / преподаватель отображаются во второй строке
                title = `Кабинет ${formattedRoomCode}`;
                if (details.subject && details.teacher) {
                    subtitle = `${details.subject} (${details.teacher})`;
                } else if (details.subject) {
                    subtitle = `${details.subject} • Корпус ${b}, ${f} этаж`;
                } else {
                    subtitle = `Учебная аудитория • Корпус ${b}, ${f} этаж`;
                }
            }
        }
        codeNum = strippedCode;
    }

    // Для всех кабинетов корпусов 2, 3 и 4: если номер состоит из цифр/букв,
    // он ВСЕГДА отображается в карточке с префиксом корпуса: "2-108", "3-103", "4-104"
    if (b > 1) {
        const cleanBase = codeNum.replace(/^[1-4]-/, "").trim();
        if (/^\d+[а-яa-z]?$/i.test(cleanBase)) {
            codeNum = `${b}-${cleanBase}`;
        }
    }

    const res = {
        codeLabel: codeNum,
        displayTitle: title,
        subtitle: subtitle,
        _codeLower: (codeNum || "").toLowerCase().replace(/ё/g, "е"),
        _titleLower: (title || "").toLowerCase().replace(/ё/g, "е"),
        _subLower: (subtitle || "").toLowerCase().replace(/ё/g, "е"),
        _rawLower: rawOrig.toLowerCase().replace(/ё/g, "е"),
        _cleanLower: rawOrig.toLowerCase().replace(/ё/g, "е").replace(/\n/g, " "),
        _roomTextLower: (item.text || "").toLowerCase().replace(/ё/g, "е")
    };
    if (item && typeof item === 'object') {
        item._searchCache = res;
    }
    return res;
}

// =====================================================================
// --- НЕДАВНИЕ ПОИСКИ (ПОЛНОСТЬЮ ОТКЛЮЧЕНЫ ПО ЗАПРОСУ) ---
try {
    localStorage.removeItem('mgkct_recent_searches');
} catch (_) {}

function getRecentSearches() {
    return [];
}
function saveRecentSearch() {}
function clearRecentSearches() {}

window.saveRecentSearch = saveRecentSearch;
window.getRecentSearches = getRecentSearches;
window.clearRecentSearches = clearRecentSearches;
