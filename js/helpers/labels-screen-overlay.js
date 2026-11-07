let activeBadgeKeys = new Set();
let nextActiveBadgeKeys = new Set();
const candidateRooms = [];
const _tempProjectVec = new THREE.Vector3();
const _tempProjectVec2 = new THREE.Vector3();
const _gridCellIndices = [];
const spatialGrid = new Map();
const _boxObjPool = [];
let _boxObjPoolIdx = 0;
let _labelQueryStamp = 0;

function acquireBoxObj(x0, y0, x1, y1) {
    if (_boxObjPoolIdx < _boxObjPool.length) {
        const b = _boxObjPool[_boxObjPoolIdx++];
        b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1; b._stamp = 0;
        return b;
    }
    const b = { x0, y0, x1, y1, _stamp: 0 };
    _boxObjPool.push(b);
    _boxObjPoolIdx++;
    return b;
}

function renderScreenSpaceLabels() {
    if (!overlayCanvas) {
        initLabelsOverlay();
    }
    if (!overlayCanvas || !overlayCtx || !camera) return;

    // Гарантируем актуальность матриц камеры для проекции координат
    camera.updateMatrixWorld();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3.0);

    if (overlayCanvas.width !== Math.round(w * dpr) || overlayCanvas.height !== Math.round(h * dpr)) {
        overlayCanvas.width = Math.round(w * dpr);
        overlayCanvas.height = Math.round(h * dpr);
    }

    overlayCtx.save();
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.scale(dpr, dpr);

    renderedScreenBadges.length = 0;
    _boxObjPoolIdx = 0;
    nextActiveBadgeKeys.clear();

    if (!STATE.showLabels || !ROOMS_REGISTRY || ROOMS_REGISTRY.length === 0) {
        activeBadgeKeys.clear();
        overlayCtx.restore();
        return;
    }

    const isSingle = (STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice');
    const activeFloor = isSingle ? parseInt(STATE.mode, 10) : 1;
    const maxFloor = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;
    const bldgFilter = STATE.buildingFilter;
    if (STATE.showGrid || STATE.debugPlan) {
        renderWorldCoordinateGridOverlay(overlayCtx, w, h, activeFloor);
    }
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;

    // Дистанция камеры до карты для плавного масштабирования плашек при зуме
    const camDist = (controls && controls.target) ? camera.position.distanceTo(controls.target) : 55;
    const isFarZoom = camDist > 55;

    // Плавное пропорциональное масштабирование плашек при отдалении:
    // При приближении (camDist <= 28) плашки крупнее (1.05)
    // При отдалении (camDist = 55..100+) плашки плавно сжимаются до 0.58 от нормального размера,
    // что позволяет им оставаться ВНУТРИ кабинетов и НЕ пропадать с чертежа!
    const zoomScale = Math.min(Math.max(38 / Math.max(camDist, 22), 0.55), 1.05);

    // Сортировка: наивысший приоритет у ключевых кабинетов и лабораторий,
    // чтобы при общем виде сверху в первую очередь ВСЕГДА были видны номера комнат,
    // а второстепенные тех. помещения (С/У, ЛК) уступали им место без перекрытия
    function getRoomPriority(r) {
        if (r._priority !== undefined) return r._priority;
        r._priority = computeRoomLabelPriority(r.text);
        return r._priority;
    }

    candidateRooms.length = 0;
    for (let i = 0; i < ROOMS_REGISTRY.length; i++) {
        const r = ROOMS_REGISTRY[i];

        if (bldgFilter !== 'both' && String(r.building) !== bldgFilter) continue;
        if (isSingle) {
            if (r.floor !== activeFloor) continue;
        } else if (STATE.mode === 'slice') {
            if (r.floor > maxFloor) continue;
        }

        const fg = floorGroups[r.floor];
        if (!fg || !fg.visible) continue;

        // В 3D-режиме отсекаем плашки кабинетов, перекрытые вертикальными 3D-стенами, фасадами, крышей или плитами перекрытий
        if (!STATE.is2D && typeof isPointOccludedIn3D === 'function') {
            const occlAnchorY = fg.position.y + Math.min(Math.max(STATE.wallHeight * 0.75, 0.25), 1.35);
            if (isPointOccludedIn3D(fg.position.x + r.x, occlAnchorY, fg.position.z + r.z, r.floor, r.building, false)) {
                continue;
            }
        } else if (!isSingle && typeof isLabelOccludedByUpperSlabs === 'function') {
            // В многоэтажном 2D/плоском виде отсекаем кабинеты, перекрытые сплошными плитами верхних этажей
            if (isLabelOccludedByUpperSlabs(r, r.floor, r.building)) {
                continue;
            }
        }

        candidateRooms.push(r);
    }

    // 100% Детерминированная сортировка: приоритет + точный порядок по номеру комнаты и координатам
    // (полностью исключает случайную инверсию порядка и мерцание плашек от кадра к кадру)
    candidateRooms.sort((a, b) => {
        const pa = getRoomPriority(a);
        const pb = getRoomPriority(b);
        if (pa !== pb) return pa - pb;
        if (a.text !== b.text) {
            const textCmp = a.text.localeCompare(b.text, undefined, { numeric: true });
            if (textCmp !== 0) return textCmp;
        }
        if (a.floor !== b.floor) return a.floor - b.floor;
        if (a.building !== b.building) return a.building - b.building;
        if (a.x !== b.x) return a.x - b.x;
        return a.z - b.z;
    });

    // Пространственная 2D-сетка (Spatial Grid) для детекции коллизий бейджей с O(N) вместо O(N^2)
    const GRID_CELL_SIZE = 96;
    const gridCols = Math.max(1, Math.ceil(w / GRID_CELL_SIZE) + 2);
    const gridRows = Math.max(1, Math.ceil(h / GRID_CELL_SIZE) + 2);
    for (const cellList of spatialGrid.values()) {
        cellList.length = 0;
    }

    function getGridCellIndices(bx0, by0, bx1, by1) {
        const cMinX = Math.max(0, Math.floor((bx0 + 80) / GRID_CELL_SIZE));
        const cMaxX = Math.min(gridCols - 1, Math.floor((bx1 + 80) / GRID_CELL_SIZE));
        const cMinY = Math.max(0, Math.floor((by0 + 40) / GRID_CELL_SIZE));
        const cMaxY = Math.min(gridRows - 1, Math.floor((by1 + 40) / GRID_CELL_SIZE));
        _gridCellIndices.length = 0;
        for (let cy = cMinY; cy <= cMaxY; cy++) {
            for (let cx = cMinX; cx <= cMaxX; cx++) {
                _gridCellIndices.push(cy * gridCols + cx);
            }
        }
        return _gridCellIndices;
    }

    for (let i = 0; i < candidateRooms.length; i++) {
        const r = candidateRooms[i];
        const fg = floorGroups[r.floor];
        if (!fg) continue;

        const worldX = fg.position.x + r.x;
        const worldY = fg.position.y + 0.12;
        const worldZ = fg.position.z + r.z;

        _tempProjectVec.set(worldX, worldY, worldZ).project(camera);

        // Отсекаем то, что за камерой
        if (_tempProjectVec.z > 1.0) continue;

        const sx = (_tempProjectVec.x * 0.5 + 0.5) * w;
        const sy = (-_tempProjectVec.y * 0.5 + 0.5) * h;

        // Отсекаем только то, что полностью за видимыми границами экрана
        if (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40) continue;

        // 1. Координаты на экране с субпиксельным округлением к физической сетке дисплея (для полного исключения дрожания)
        const physX = Math.round(sx * dpr);
        const physY = Math.round(sy * dpr);
        const drawX = physX / dpr;
        const drawY = physY / dpr;

        // 2. Размер шрифта и плашки: плавно уменьшаются при отдалении камеры, чтобы оставаться на схеме и не пропадать
        const isMulti = r.rawText && r.rawText.includes('\n');
        const lines = isMulti ? r.rawText.split('\n') : [r.text];

        // Базовый размер шрифта масштабируется в зависимости от удаления камеры (от 1.05 до 0.55)
        const customScaleFactor = (typeof r.customScale === 'number' && r.customScale > 0) ? r.customScale : 1.0;
        const baseFontSize = (r.isSmall ? 12.5 : (r.isWide ? 14.5 : 15.5)) * customScaleFactor * scaleMult;
        const fontSize = Math.max(Math.round(baseFontSize * zoomScale), 8.5);

        const fontStack = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
        const fontStr = '900 ' + fontSize + 'px ' + fontStack;
        if (overlayCtx.font !== fontStr) {
            overlayCtx.font = fontStr;
        }

        let maxLineW = 0;
        for (let l = 0; l < lines.length; l++) {
            const mKey = fontSize + '|' + lines[l];
            let lw = _textWidthCache.get(mKey);
            if (lw === undefined) {
                if (_textWidthCache.size > 2000) {
                    const oldestKey = _textWidthCache.keys().next().value;
                    _textWidthCache.delete(oldestKey);
                }
                lw = overlayCtx.measureText(lines[l]).width;
                _textWidthCache.set(mKey, lw);
            }
            if (lw > maxLineW) maxLineW = lw;
        }

        // Определение гендерного санузла (М / Ж)
        const rawWcText = (r.rawText || r.text || '');
        const isMaleWc = /^wc\s*\(?м\)?/i.test(rawWcText);
        const isFemaleWc = /^wc\s*\(?ж\)?/i.test(rawWcText);
        const isWcIcon = isMaleWc || isFemaleWc;

        // Отступы пропорционально сжимаются при отдалении камеры
        const padX = Math.max(Math.round(fontSize * 0.36), 2.5);
        const padY = Math.max(Math.round(fontSize * 0.20), 1.5);
        const iconSize = Math.max(Math.round(fontSize * 1.25), 12);
        const badgeW = isWcIcon ? Math.max(Math.round(iconSize * 1.30), 18) : Math.round(maxLineW + padX * 2);
        const badgeH = isWcIcon ? Math.max(Math.round(iconSize * 1.30), 18) : Math.round(isMulti ? (fontSize * 2.1 + padY * 2) : (fontSize + padY * 2 + 1.5));

        const x0 = Math.round(drawX - badgeW / 2);
        const y0 = Math.round(drawY - badgeH / 2);
        const x1 = x0 + badgeW;
        const y1 = y0 + badgeH;

        // 3. Строгая проверка наложения с гарантированным зазором через пространственную сетку:
        const badgeKey = `${r.building}-${r.floor}-${r.text}-${Math.round(r.x * 10)}-${Math.round(r.z * 10)}`;
        const wasVisible = activeBadgeKeys.has(badgeKey);
        const baseMargin = Math.max(1.6, Math.min(2.8, 2.6 * zoomScale));
        const margin = wasVisible ? Math.max(0.8, 1.0 * zoomScale) : baseMargin;

        const checkCells = getGridCellIndices(x0 - margin, y0 - margin, x1 + margin, y1 + margin);
        let overlap = false;
        _labelQueryStamp++;

        for (let c = 0; c < checkCells.length; c++) {
            const cellBoxes = spatialGrid.get(checkCells[c]);
            if (!cellBoxes) continue;
            for (let b = 0; b < cellBoxes.length; b++) {
                const db = cellBoxes[b];
                if (db._stamp === _labelQueryStamp) continue;
                db._stamp = _labelQueryStamp;
                if (!(x1 + margin < db.x0 || x0 - margin > db.x1 || y1 + margin < db.y0 || y0 - margin > db.y1)) {
                    overlap = true;
                    break;
                }
            }
            if (overlap) break;
        }
        if (overlap) continue;

        nextActiveBadgeKeys.add(badgeKey);
        const boxObj = acquireBoxObj(x0, y0, x1, y1);
        for (let c = 0; c < checkCells.length; c++) {
            const cIdx = checkCells[c];
            let cellList = spatialGrid.get(cIdx);
            if (!cellList) {
                cellList = [];
                spatialGrid.set(cIdx, cellList);
            }
            cellList.push(boxObj);
        }
        renderedScreenBadges.push({ room: r, x0, y0, x1, y1 });

        // 4. Отрисовка плашки номера кабинета (Тёмная / Светлая тема):
        const isDarkTheme = (typeof STATE !== 'undefined' && STATE.theme === 'dark');
        const badgeBg = isDarkTheme ? '#262d3a' : '#ffffff';
        const badgeStroke = isDarkTheme ? '#3b4658' : '#94a3b8';
        const badgeText = isDarkTheme ? '#f1f5f9' : '#0f172a';
        const badgeSec = isDarkTheme ? '#94a3b8' : '#475569';

        overlayCtx.shadowColor = isDarkTheme ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.10)';
        overlayCtx.shadowBlur = Math.round(4 * zoomScale);
        overlayCtx.shadowOffsetY = Math.round(1.5 * zoomScale);

        overlayCtx.fillStyle = badgeBg;
        overlayCtx.strokeStyle = badgeStroke;
        overlayCtx.lineWidth = Math.max(1.3 * zoomScale, 1.0);

        overlayCtx.beginPath();
        overlayCtx.roundRect(x0, y0, badgeW, badgeH, Math.max(4.0 * zoomScale, 2.5));
        overlayCtx.fill();
        overlayCtx.stroke();

        overlayCtx.shadowColor = 'transparent';
        overlayCtx.shadowBlur = 0;
        overlayCtx.shadowOffsetY = 0;

        overlayCtx.textAlign = 'center';
        overlayCtx.textBaseline = 'middle';
        overlayCtx.fillStyle = badgeText;

        if (isWcIcon) {
            // Векторная отрисовка силуэтной иконки М/Ж со скруглёнными углами (акцентный цвет)
            const wcColor = isDarkTheme ? (isMaleWc ? '#38bdf8' : '#fb7185') : (isMaleWc ? '#0284c7' : '#e11d48');
            drawWcIcon(overlayCtx, drawX, drawY, iconSize, isMaleWc ? 'male' : 'female', wcColor);
        } else if (isMulti) {
            overlayCtx.font = '900 ' + (fontSize - 1) + 'px ' + fontStack;
            overlayCtx.fillText(lines[0], drawX, y0 + padY + (fontSize - 1) / 2);
            overlayCtx.fillStyle = badgeSec;
            overlayCtx.font = '800 ' + Math.max(fontSize - 2, 7.5) + 'px ' + fontStack;
            overlayCtx.fillText(lines[1], drawX, y0 + badgeH - padY - Math.max(fontSize - 2, 7.5) / 2);
        } else {
            overlayCtx.font = '900 ' + fontSize + 'px ' + fontStack;
            overlayCtx.fillText(r.text, drawX, drawY + 0.5);
        }
    }

    const tmpSet = activeBadgeKeys;
    activeBadgeKeys = nextActiveBadgeKeys;
    nextActiveBadgeKeys = tmpSet;

    // Отрисовка Screen-Space Retina бейджей навигатора (Точки А, Б, лестничные указатели)
    if (typeof renderNavigatorScreenBadges === 'function' && typeof NAV_STATE !== 'undefined' && NAV_STATE.activeRoute) {
        renderNavigatorScreenBadges(overlayCtx, dpr, w, h);
    }

    // Синхронизация позиции всплывающего попапа выбранного кабинета с его 3D-координатами
    if (typeof updateRoomContextPopupScreenPos === 'function') {
        updateRoomContextPopupScreenPos(w, h);
    }

    overlayCtx.restore();
}
