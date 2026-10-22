// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ПОСТРОЕНИЯ 3D-ГЕОМЕТРИИ
// С ПОДДЕРЖКОЙ УМНОГО СКРЫТИЯ ВНУТРЕННОСТЕЙ ЭТАЖЕЙ
// ==========================================

function addFloorRect(targetGroup, x1, z1, x2, z2, isCore = false) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const thickness = 0.16;
    const geom = new THREE.BoxGeometry(w, thickness, d);
    const mat = isCore ? MATERIALS.coreSlab : MATERIALS.slab;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, -thickness / 2 + (isCore ? 0.008 : 0), cz);
    mesh.receiveShadow = true;
    mesh.userData.isFloorSlab = true;
    mesh.userData.isInterior = false;
    mesh.userData.isExterior = true;
    targetGroup.add(mesh);
    slabMeshes.push(mesh);

    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, MATERIALS.edgeMain);
    line.userData.isFloorSlab = true;
    line.userData.isInterior = false;
    line.userData.isExterior = true;
    mesh.add(line);
}

function addFloorPolygon(targetGroup, points, isCore = false) {
    if (!points || points.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();

    const thickness = 0.16;
    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false
    });
    geom.rotateX(Math.PI / 2);

    const mat = isCore ? MATERIALS.coreSlab : MATERIALS.slab;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, (isCore ? 0.008 : 0), 0);
    mesh.receiveShadow = true;
    mesh.userData.isFloorSlab = true;
    mesh.userData.isInterior = false;
    mesh.userData.isExterior = true;
    targetGroup.add(mesh);
    slabMeshes.push(mesh);

    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, MATERIALS.edgeMain);
    line.userData.isFloorSlab = true;
    line.userData.isInterior = false;
    line.userData.isExterior = true;
    mesh.add(line);
}

function addWallLine(targetGroup, x1, z1, x2, z2, openings = [], wallThickness = 0.18) {
    const isHorizontal = Math.abs(z2 - z1) < 0.001;
    const startCoord = isHorizontal ? Math.min(x1, x2) : Math.min(z1, z2);
    const endCoord = isHorizontal ? Math.max(x1, x2) : Math.max(z1, z2);
    const fixedCoord = isHorizontal ? z1 : x1;
    const angle = isHorizontal ? 0 : Math.PI / 2;

    const isOuterWall = wallThickness >= 0.20;

    const sorted = [...openings].sort((a, b) => a.from - b.from);
    let cursor = startCoord;

    for (const op of sorted) {
        const oStart = Math.max(startCoord, op.from);
        const oEnd = Math.min(endCoord, op.to);

        if (oStart > cursor + 0.02) {
            createWallSegment(targetGroup, cursor, oStart, fixedCoord, isHorizontal, angle, wallThickness, false, isOuterWall);
        }

        if (op.type !== 'open') {
            const isExteriorDoor = op.isExterior !== undefined ? op.isExterior : isOuterWall;
            createWallSegment(targetGroup, oStart, oEnd, fixedCoord, isHorizontal, angle, 0.09, true, isExteriorDoor);
        }

        cursor = oEnd;
    }

    if (cursor < endCoord - 0.02) {
        createWallSegment(targetGroup, cursor, endCoord, fixedCoord, isHorizontal, angle, wallThickness, false, isOuterWall);
    }
}

function addArbitraryWallSegment(targetGroup, x1, z1, x2, z2, thickness = 0.18, isDoor = false, isExterior = false) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len <= 0.01) return;

    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const angle = Math.atan2(dz, dx);

    const geom = new THREE.BoxGeometry(len, 1, thickness);
    const mat = isDoor ? MATERIALS.doorThin : MATERIALS.wall;
    const mesh = new THREE.Mesh(geom, mat);

    const h = STATE.wallHeight;
    mesh.scale.y = h + WALL_SINK;
    mesh.position.set(cx, (h - WALL_SINK) / 2, cz);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const effectiveExterior = isExterior || (thickness >= 0.20);
    mesh.userData.isExterior = effectiveExterior;
    mesh.userData.isInterior = !effectiveExterior && (isDoor || (thickness < 0.20));
    mesh.userData.isDoor = isDoor;
    targetGroup.add(mesh);

    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edgeGeom, isDoor ? MATERIALS.edgeDoor : MATERIALS.edgeMain);
    edgeLine.userData.isExterior = effectiveExterior;
    edgeLine.userData.isInterior = mesh.userData.isInterior;
    edgeLine.userData.isDoor = isDoor;
    mesh.add(edgeLine);

    if (isDoor) {
        doorMeshes.push(mesh);
        doorEdges.push(edgeLine);
    } else {
        wallMeshes.push(mesh);
        wallEdges.push(edgeLine);
    }
}

function createWallSegment(targetGroup, c1, c2, fixedCoord, isHorizontal, angle, thickness, isDoor, isExterior = false) {
    const len = Math.abs(c2 - c1);
    if (len <= 0.01) return;

    const mid = (c1 + c2) / 2;
    const cx = isHorizontal ? mid : fixedCoord;
    const cz = isHorizontal ? fixedCoord : mid;

    const geom = new THREE.BoxGeometry(len, 1, thickness);
    const mat = isDoor ? MATERIALS.doorThin : MATERIALS.wall;
    const mesh = new THREE.Mesh(geom, mat);

    const h = STATE.wallHeight;
    mesh.scale.y = h + WALL_SINK;
    mesh.position.set(cx, (h - WALL_SINK) / 2, cz);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isExterior = isExterior;
    mesh.userData.isInterior = !isExterior && (isDoor || (thickness < 0.20));
    mesh.userData.isDoor = isDoor;
    targetGroup.add(mesh);

    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edgeGeom, isDoor ? MATERIALS.edgeDoor : MATERIALS.edgeMain);
    edgeLine.userData.isExterior = isExterior;
    edgeLine.userData.isInterior = mesh.userData.isInterior;
    edgeLine.userData.isDoor = isDoor;
    mesh.add(edgeLine);

    if (isDoor) {
        doorMeshes.push(mesh);
        doorEdges.push(edgeLine);
    } else {
        wallMeshes.push(mesh);
        wallEdges.push(edgeLine);
    }
}

function addSquareColumn(targetGroup, cx, cz, size = 0.28, isExterior = false) {
    const geom = new THREE.BoxGeometry(size, 1, size);
    const mesh = new THREE.Mesh(geom, MATERIALS.wall);
    const h = STATE.wallHeight;
    mesh.scale.y = h;
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isExterior = isExterior;
    mesh.userData.isInterior = !isExterior;
    mesh.userData.isColumn = true;
    targetGroup.add(mesh);

    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edgeGeom, MATERIALS.edgeMain);
    edgeLine.userData.isExterior = isExterior;
    edgeLine.userData.isInterior = !isExterior;
    edgeLine.userData.isColumn = true;
    mesh.add(edgeLine);

    wallMeshes.push(mesh);
    wallEdges.push(edgeLine);
}

function addRoomLabel3D(targetGroup, floorNum, text, x, z, isSmall = false, isWide = false, buildingNum = 1, customScale = 1.0) {
    const canvas = document.createElement('canvas');
    const lines = text.split('\n');
    const isMultiLine = lines.length > 1;

    // Сверхчёткое разрешение Canvas (Power-of-Two для аппаратного Mipmapping без искажений)
    const width = isWide ? 768 : (isSmall ? 384 : 512);
    const height = isMultiLine ? 256 : (isSmall ? 192 : 256);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const r = isSmall ? 28 : 36;
    // Высококонтрастный фон плашек по корпусам с максимальной плотностью цвета
    ctx.fillStyle = buildingNum === 4
        ? '#fefce8'
        : (buildingNum === 3
            ? '#f0fdf4'
            : (buildingNum === 2 ? '#f8fafc' : '#ffffff'));

    ctx.strokeStyle = buildingNum === 4
        ? '#b45309'
        : (buildingNum === 3
            ? '#047857'
            : (buildingNum === 2 ? '#1d4ed8' : '#0f172a'));
    ctx.lineWidth = isSmall ? 10 : 14;

    // Глубокая чёткая тень под плашкой
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;

    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(width - r, 0);
    ctx.quadraticCurveTo(width, 0, width, r);
    ctx.lineTo(width, height - r);
    ctx.quadraticCurveTo(width, height, width - r, height);
    ctx.lineTo(r, height);
    ctx.quadraticCurveTo(0, height, 0, height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Сброс тени перед отрисовкой текста
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Нативный системный шрифт (Apple SF / Roboto) с экстремальной жирностью (900) для кристальной резкости на телефонах
    const fontStack = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    if (isMultiLine) {
        ctx.fillStyle = '#020617';
        ctx.font = '900 84px ' + fontStack;
        ctx.fillText(lines[0], width / 2, height * 0.36);

        ctx.fillStyle = '#334155';
        ctx.font = '800 58px ' + fontStack;
        ctx.fillText(lines[1], width / 2, height * 0.72);
    } else {
        const fontSize = isSmall ? 100 : (isWide ? 116 : 130);
        ctx.font = '900 ' + fontSize + 'px ' + fontStack;

        // Лёгкая светлая обводка текста для максимального микроконтраста букв
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.strokeText(text, width / 2, height / 2);

        ctx.fillStyle = '#020617';
        ctx.fillText(text, width / 2, height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    // Включаем Mipmap + Trilinear filtering для идеальной резкости с любого расстояния
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (typeof renderer !== 'undefined' && renderer && renderer.capabilities) {
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 16);
    }

    // Увеличенные комфортные габариты плашки в 3D пространстве
    const baseW = isWide ? 6.4 : (isSmall ? 2.8 : 4.0);
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;
    const planeW = baseW * customScale * scaleMult;
    const planeH = planeW * (height / width);
    const geom = new THREE.PlaneGeometry(planeW, planeH);

    const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    // Плашка приподнята над полом комнаты (y = 0.04)
    mesh.position.set(x, 0.04, z);
    mesh.userData.isInterior = true;
    mesh.userData.isRoomLabel = true;
    // 3D-меш скрываем из WebGL рендера, так как надписи отрисовываются
    // в 100% честном нативном разрешении экрана Retina через Screen-Space 2D Overlay Canvas!
    mesh.visible = false;
    mesh.userData.roomInfo = {
        text: text,
        floor: floorNum,
        building: buildingNum,
        x: x,
        z: z
    };
    targetGroup.add(mesh);

    const labelItem = {
        mesh,
        floor: floorNum,
        building: buildingNum,
        localX: x,
        localZ: z,
        text: text,
        baseW: baseW,
        customScale: customScale,
        ratio: height / width
    };
    labelSprites.push(labelItem);

    if (typeof ROOMS_REGISTRY !== 'undefined') {
        ROOMS_REGISTRY.push({
            text: text.replace('\n', ' '),
            rawText: text,
            floor: floorNum,
            building: buildingNum,
            x: x,
            z: z,
            mesh: mesh,
            isSmall: isSmall,
            isWide: isWide,
            baseW: baseW,
            customScale: customScale || 1.0,
            ratio: height / width
        });
    }
}

// ==========================================
// SCREEN-SPACE RETINA OVERLAY ДЛЯ НАДПИСЕЙ КАБИНЕТОВ
// 100% честная резкость на любых экранах телефонов (iOS/Android),
// ноль размытия текстур, ноль искажения перспективой, как в картах 2GIS / Google Maps!
// ==========================================

let overlayCanvas = null;
let overlayCtx = null;
let renderedScreenBadges = [];
window.renderedScreenBadges = renderedScreenBadges;
const _tempProjectVec = new THREE.Vector3();
const _tempProjectVec2 = new THREE.Vector3();

function initLabelsOverlay() {
    overlayCanvas = document.getElementById('labels-overlay-canvas');
    if (!overlayCanvas) return;
    overlayCtx = overlayCanvas.getContext('2d');
    resizeLabelsOverlay();
}

function resizeLabelsOverlay() {
    if (!overlayCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3.0);
    const w = window.innerWidth;
    const h = window.innerHeight;
    overlayCanvas.width = Math.round(w * dpr);
    overlayCanvas.height = Math.round(h * dpr);
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

    renderedScreenBadges = [];
    window.renderedScreenBadges = renderedScreenBadges;

    if (!STATE.showLabels || !ROOMS_REGISTRY || ROOMS_REGISTRY.length === 0) {
        overlayCtx.restore();
        return;
    }

    const isSingle = (STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice');
    const activeFloor = isSingle ? parseInt(STATE.mode, 10) : 1;
    const maxFloor = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;
    const bldgFilter = STATE.buildingFilter;
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;

    // Адаптивное увеличение размера текста при приближении камеры к кабинетам
    const camDist = (controls && controls.target) ? camera.position.distanceTo(controls.target) : 68;
    const zoomFactor = Math.min(Math.max(Math.pow(70 / Math.max(camDist, 18), 0.35), 0.95), 1.55);

    // Сортировка: наивысший приоритет у ключевых кабинетов и лабораторий,
    // чтобы при общем виде сверху в первую очередь ВСЕГДА были видны номера комнат,
    // а второстепенные тех. помещения (С/У, ЛК) уступали им место без перекрытия
    function getRoomPriority(r) {
        const t = (r.text || '').trim();
        if (/^\d+[А-Яа-яA-Za-z]?$/.test(t)) return 1; // 101, 102, 111А
        if (t.includes('\n') || t.length > 3) return 2; // Столовая, Фойе
        if (t.startsWith('ЛК')) return 3; // Лестничные клетки
        if (t === 'С/У') return 4; // Санузлы
        return 2;
    }

    const candidateRooms = [];
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

        candidateRooms.push({ room: r, fg });
    }

    candidateRooms.sort((a, b) => getRoomPriority(a.room) - getRoomPriority(b.room));

    // Полифилл roundRect для 100% совместимости
    if (!overlayCtx.roundRect) {
        overlayCtx.roundRect = function(x, y, rw, rh, rad) {
            this.beginPath();
            this.moveTo(x + rad, y);
            this.arcTo(x + rw, y, x + rw, y + rh, rad);
            this.arcTo(x + rw, y + rh, x, y + rh, rad);
            this.arcTo(x, y + rh, x, y, rad);
            this.arcTo(x, y, x + rw, y, rad);
            this.closePath();
            return this;
        };
    }

    const drawnBoxes = [];

    for (let i = 0; i < candidateRooms.length; i++) {
        const { room: r, fg } = candidateRooms[i];

        const worldX = fg.position.x + r.x;
        const worldY = fg.position.y + 0.12;
        const worldZ = fg.position.z + r.z;

        _tempProjectVec.set(worldX, worldY, worldZ).project(camera);

        // Отсекаем то, что за камерой
        if (_tempProjectVec.z > 1.0) continue;

        const sx = (_tempProjectVec.x * 0.5 + 0.5) * w;
        const sy = (-_tempProjectVec.y * 0.5 + 0.5) * h;

        // Отсекаем то, что далеко за пределами экрана
        if (sx < -60 || sx > w + 60 || sy < -40 || sy > h + 40) continue;

        // Исключаем наложение плашек прямо под правые кнопки управления (переключатель этажей)
        if (sx > w - 68 && sy > 140 && sy < h - 45) continue;
        // Исключаем плашки прямо под верхней панелью навигации и чипсами корпусов
        if (sy < 105) continue;

        // 1. Координаты на экране с субпиксельным округлением к физической сетке дисплея (для полного исключения дрожания)
        const physX = Math.round(sx * dpr);
        const physY = Math.round(sy * dpr);
        const drawX = physX / dpr;
        const drawY = physY / dpr;

        // 2. Размер шрифта и плашки:
        // Квантование масштаба зума (шагами), чтобы размер шрифта и ширина плашки не дрожали при микроколебаниях камеры
        const isMulti = r.rawText && r.rawText.includes('\n');
        const lines = isMulti ? r.rawText.split('\n') : [r.text];

        // Базовый размер шрифта:
        const baseFontSize = (r.isSmall ? 13.5 : (r.isWide ? 15.5 : 17)) * scaleMult;
        // Квантованный зум для абсолютной стабильности:
        const stableZoom = Math.round(Math.pow(54 / Math.max(camDist, 16), 0.38) * 10) / 10;
        const fontSize = Math.min(Math.max(Math.round(baseFontSize * stableZoom), 11), 28);

        const fontStack = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif';
        overlayCtx.font = '900 ' + fontSize + 'px ' + fontStack;

        let maxLineW = 0;
        for (let l = 0; l < lines.length; l++) {
            maxLineW = Math.max(maxLineW, overlayCtx.measureText(lines[l]).width);
        }

        const padX = Math.max(Math.round(fontSize * 0.45), 5);
        const padY = Math.max(Math.round(fontSize * 0.28), 3.5);
        const badgeW = Math.round(maxLineW + padX * 2);
        const badgeH = Math.round(isMulti ? (fontSize * 2.15 + padY * 2) : (fontSize + padY * 2 + 2));

        const x0 = Math.round(drawX - badgeW / 2);
        const y0 = Math.round(drawY - badgeH / 2);
        const x1 = x0 + badgeW;
        const y1 = y0 + badgeH;

        // 3. Строгая проверка наложения (плашки НЕ наслаиваются друг на друга):
        // Оставляем гарантированный зазор минимум 3px между любыми плашками
        let overlap = false;
        const margin = 3;
        for (let b = 0; b < drawnBoxes.length; b++) {
            const db = drawnBoxes[b];
            if (!(x1 + margin < db.x0 || x0 - margin > db.x1 || y1 + margin < db.y0 || y0 - margin > db.y1)) {
                overlap = true;
                break;
            }
        }
        if (overlap) continue;

        drawnBoxes.push({ x0, y0, x1, y1 });
        renderedScreenBadges.push({ room: r, x0, y0, x1, y1 });

        // 4. Плашка кабинета в стиле Stealth Dark Tech Minimal (матовый графит, четкая светлая рамка, белый текст):
        overlayCtx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        overlayCtx.shadowBlur = 6;
        overlayCtx.shadowOffsetY = 2;

        overlayCtx.fillStyle = '#11141c';
        overlayCtx.strokeStyle = '#cbd5e1';
        overlayCtx.lineWidth = 1.6;

        overlayCtx.beginPath();
        overlayCtx.roundRect(x0, y0, badgeW, badgeH, 4.5);
        overlayCtx.fill();
        overlayCtx.stroke();

        overlayCtx.shadowColor = 'transparent';
        overlayCtx.shadowBlur = 0;
        overlayCtx.shadowOffsetY = 0;

        overlayCtx.textAlign = 'center';
        overlayCtx.textBaseline = 'middle';
        overlayCtx.fillStyle = '#ffffff';

        if (isMulti) {
            overlayCtx.font = '900 ' + (fontSize - 1) + 'px ' + fontStack;
            overlayCtx.fillText(lines[0], drawX, y0 + padY + (fontSize - 1) / 2);
            overlayCtx.fillStyle = '#94a3b8';
            overlayCtx.font = '800 ' + (fontSize - 2.5) + 'px ' + fontStack;
            overlayCtx.fillText(lines[1], drawX, y0 + badgeH - padY - (fontSize - 2.5) / 2);
        } else {
            overlayCtx.font = '900 ' + fontSize + 'px ' + fontStack;
            overlayCtx.fillText(r.text, drawX, drawY + 0.5);
        }
    }

    overlayCtx.restore();
}

function updateRoomLabelsScale() {
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;
    labelSprites.forEach(item => {
        if (!item || !item.mesh) return;
        const planeW = item.baseW * item.customScale * scaleMult;
        const planeH = planeW * item.ratio;
        item.mesh.geometry.dispose();
        item.mesh.geometry = new THREE.PlaneGeometry(planeW, planeH);
    });
    if (typeof lastAdaptiveDist !== 'undefined') {
        lastAdaptiveDist = -1;
    }
    if (typeof updateAdaptiveLabelScaling === 'function') {
        updateAdaptiveLabelScaling();
    }
    if (typeof requestRender === 'function') requestRender(25);
}

// Алиас для обратной совместимости
const addRoomLabel = addRoomLabel3D;

function buildElevatorShaftCross(targetGroup, x1, z1, x2, z2) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const geom = new THREE.BoxGeometry(w, 0.08, d);
    const mesh = new THREE.Mesh(geom, MATERIALS.elevatorCar);
    mesh.position.set(cx, 0.04, cz);
    mesh.userData.isInterior = true;
    targetGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geom);
    mesh.add(new THREE.LineSegments(edges, MATERIALS.edgeMain));

    const pts = [
        new THREE.Vector3(x1, 0.09, z1),
        new THREE.Vector3(x2, 0.09, z2),
        new THREE.Vector3(x2, 0.09, z1),
        new THREE.Vector3(x1, 0.09, z2)
    ];
    const crossGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const crossLine = new THREE.LineSegments(crossGeom, MATERIALS.edgeMain);
    crossLine.userData.isInterior = true;
    targetGroup.add(crossLine);
}

function registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, yOffset = 0, isExterior = false) {
    const mesh = new THREE.Mesh(geom, MATERIALS.stair);
    const stepH = Math.max(0.06, STATE.wallHeight * heightRatio);
    mesh.scale.y = stepH;
    mesh.position.set(sx, (stepH / 2) + yOffset, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const effectiveIsExterior = isExterior || (yOffset < -0.05);
    mesh.userData.isInterior = !effectiveIsExterior;
    mesh.userData.isExterior = effectiveIsExterior;
    mesh.userData.isStair = true;

    const edges = new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edges, MATERIALS.edgeMain);
    edgeLine.userData.isInterior = !effectiveIsExterior;
    edgeLine.userData.isExterior = effectiveIsExterior;
    edgeLine.userData.isStair = true;
    mesh.add(edgeLine);
    targetGroup.add(mesh);

    stairMeshes.push({ mesh, heightRatio, yOffset });
}

function buildStaircaseUnit(targetGroup, zTop, zBottom, zMid, isUpperStaircase) {
    addWallLine(targetGroup, 10.2, zMid, 14.6, zMid, [], 0.08);

    const stepsCount = 10;
    const startX = 10.2;
    const endX = 14.6;
    const stepDepth = (endX - startX) / stepsCount;

    const flights = [
        { z1: zTop + 0.12, z2: zMid - 0.06, dir: isUpperStaircase ? 1 : -1 },
        { z1: zMid + 0.06, z2: zBottom - 0.12, dir: isUpperStaircase ? -1 : 1 }
    ];

    flights.forEach(fl => {
        const flightW = Math.abs(fl.z2 - fl.z1);
        const cz = (fl.z1 + fl.z2) / 2;

        for (let i = 0; i < stepsCount; i++) {
            const ratio = fl.dir === 1 ? (i + 1) / stepsCount : (stepsCount - i) / stepsCount;
            const heightRatio = ratio * 0.52;
            const sx = startX + (i + 0.5) * stepDepth;

            const geom = new THREE.BoxGeometry(stepDepth * 0.96, 1, flightW);
            registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, 0);
        }
    });

    // Межэтажная разворотная площадка у наружной стены
    const landingGeom = new THREE.BoxGeometry(1.4, 1, Math.abs(zBottom - zTop));
    registerDynamicStairStep(targetGroup, landingGeom, 15.3, (zTop + zBottom) / 2, 0.26, 0);
}

function buildCorridorStepsRight(targetGroup) {
    const stepW = 0.28;
    const z1 = -6.1;
    const z2 = -3.6;
    const depthZ = Math.abs(z2 - z1);
    const cz = (z1 + z2) / 2;

    for (let i = 0; i < 3; i++) {
        const sx = 14.3 + i * stepW;
        const heightRatio = 0.055 * (i + 1);
        const geom = new THREE.BoxGeometry(stepW * 0.95, 1, depthZ);
        registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, 0);
    }
}

function addRoofRect(targetGroup, x1, z1, x2, z2, buildingNum = 1) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const thickness = 0.16;

    const geom = new THREE.BoxGeometry(w, thickness, d);
    const mesh = new THREE.Mesh(geom, MATERIALS.roof);
    mesh.position.set(cx, STATE.wallHeight + thickness / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isRoof = true;
    mesh.userData.isExterior = true;
    mesh.userData.isInterior = false;
    mesh.visible = STATE.showRoof;

    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, MATERIALS.edgeRoof);
    line.userData.isRoof = true;
    line.userData.isExterior = true;
    line.userData.isInterior = false;
    mesh.add(line);

    targetGroup.add(mesh);
    roofMeshes.push({ mesh, thickness, building: buildingNum });
}
