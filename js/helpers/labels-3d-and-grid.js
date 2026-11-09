function formatRoomDisplayName(text, buildingNum) {
    if (!text) return '';
    const b = parseInt(buildingNum, 10);
    const raw = String(text).trim();
    if (b <= 1 || isNaN(b)) return raw;
    if (raw.startsWith('2-') || raw.startsWith('3-') || raw.startsWith('4-') || raw.startsWith('5-')) return raw;
    if (/^(?:wc|с\/у)/i.test(raw)) return raw;
    const numPrefixMatch = raw.match(/^(\d+[а-яa-z]?)(.*)$/i);
    if (numPrefixMatch) {
        return b + '-' + numPrefixMatch[1] + numPrefixMatch[2];
    }
    return raw;
}
window.formatRoomDisplayName = formatRoomDisplayName;

let _sharedHiddenLabelMat = null;

function computeRoomLabelPriority(textStr) {
    const t = (textStr || '').trim();
    if (/столов|спорт|актов|гардероб|библиот|конференц|учебн/i.test(t)) return 0;
    if (/^\d+[\u0400-\u04FFA-Za-z]?$/.test(t)) return 1;
    if (t.includes('\n') || t.length > 3) return 2;
    if (t.startsWith('ЛК') || t.startsWith('\u041B\u041A')) return 3;
    if (/^(?:wc|с\/у)/i.test(t)) return 4;
    return 2;
}

function addRoomLabel3D(targetGroup, floorNum, text, x, z, isSmall = false, isWide = false, buildingNum = 1, customScale = 1.0) {
    const lines = text.split('\n');
    const isMultiLine = lines.length > 1;
    const width = isWide ? 768 : (isSmall ? 384 : 512);
    const height = isMultiLine ? 256 : (isSmall ? 192 : 256);

    // Увеличенные комфортные габариты плашки в 3D пространстве (без создания 250 тяжелых CanvasTexture, т.к. рендер идет через 2D Screen-Space Overlay)
    const baseW = isWide ? 6.4 : (isSmall ? 2.8 : 4.0);
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;
    const planeW = baseW * customScale;
    const planeH = planeW * (height / width);
    const geom = new THREE.PlaneGeometry(planeW, planeH);

    if (!_sharedHiddenLabelMat) {
        _sharedHiddenLabelMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
    }
    const mat = _sharedHiddenLabelMat;

    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    // Плашка приподнята над полом комнаты (y = 0.04)
    mesh.position.set(x, 0.04, z);
    mesh.scale.set(scaleMult, scaleMult, 1);
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
        const dispVal = formatRoomDisplayName(text.replace('\n', ' '), buildingNum);
        ROOMS_REGISTRY.push({
            text: dispVal,
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
            ratio: height / width,
            _priority: computeRoomLabelPriority(dispVal)
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

function drawWcIcon(ctx, cx, cy, size, gender, color) {
    const H = size;
    const w = size * 0.74;
    const topY = cy - H / 2;
    const r = H * 0.145;
    const headCy = topY + r;
    const gap = H * 0.09;
    const bodyTop = headCy + r + gap;
    const bodyBot = cy + H / 2;

    ctx.save();
    ctx.fillStyle = color;

    // Круглая голова
    ctx.beginPath();
    ctx.arc(cx, headCy, r, 0, Math.PI * 2);
    ctx.fill();

    // Тело: треугольник со скруглёнными углами
    ctx.beginPath();
    const cornerR = Math.max(H * 0.08, 1.2);
    if (gender === 'female') {
        // Женский силуэт: треугольник вершиной вверх (юбка/платье)
        const p1x = cx, p1y = bodyTop;
        const p2x = cx + w * 0.50, p2y = bodyBot;
        const p3x = cx - w * 0.50, p3y = bodyBot;

        ctx.moveTo(cx, bodyTop + cornerR);
        ctx.arcTo(p2x, p2y, p3x, p3y, cornerR);
        ctx.arcTo(p3x, p3y, p1x, p1y, cornerR);
        ctx.arcTo(p1x, p1y, p2x, p2y, cornerR);
    } else {
        // Мужской силуэт: перевёрнутый треугольник вершиной вниз (широкие плечи)
        const p1x = cx - w * 0.52, p1y = bodyTop;
        const p2x = cx + w * 0.52, p2y = bodyTop;
        const p3x = cx, p3y = bodyBot;

        ctx.moveTo(p1x + cornerR, p1y);
        ctx.arcTo(p2x, p2y, p3x, p3y, cornerR);
        ctx.arcTo(p3x, p3y, p1x, p1y, cornerR);
        ctx.arcTo(p1x, p1y, p2x, p2y, cornerR);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

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


function renderWorldCoordinateGridOverlay(ctx, w, h, activeFloor) {
    if (!camera || typeof STATE === 'undefined') return;
    if (!STATE.showGrid && !STATE.debugPlan) return;

    const fg = (typeof floorGroups !== 'undefined' && floorGroups[activeFloor]) ? floorGroups[activeFloor] : null;
    const baseY = fg ? (fg.position.y + 0.06) : 0.06;
    const bFilter = STATE.buildingFilter;

    let xMin = -18, xMax = 72, zMin = -64, zMax = 18;
    if (bFilter === '1') { xMin = -16; xMax = 22; zMin = -16; zMax = 16; }
    else if (bFilter === '2') { xMin = 18; xMax = 70; zMin = -16; zMax = 6; }
    else if (bFilter === '3') { xMin = -5; xMax = 17; zMin = -64; zMax = -12; }
    else if (bFilter === '4') { xMin = 26; xMax = 71; zMin = -63; zMax = -23; }

    ctx.save();
    const fontStack = '700 10px "SF Mono", Menlo, Consolas, monospace';
    ctx.font = fontStack;

    // 1m and 2m X grid lines (vertical on screen in 2D top view)
    for (let gx = xMin; gx <= xMax; gx++) {
        _tempProjectVec.set(gx, baseY, zMin).project(camera);
        _tempProjectVec2.set(gx, baseY, zMax).project(camera);
        if (_tempProjectVec.z > 1.0 && _tempProjectVec2.z > 1.0) continue;

        const sx1 = (_tempProjectVec.x * 0.5 + 0.5) * w;
        const sy1 = (-_tempProjectVec.y * 0.5 + 0.5) * h;
        const sx2 = (_tempProjectVec2.x * 0.5 + 0.5) * w;
        const sy2 = (-_tempProjectVec2.y * 0.5 + 0.5) * h;

        const isMajor = (gx % 2 === 0);
        ctx.strokeStyle = isMajor ? 'rgba(14, 116, 144, 0.38)' : 'rgba(100, 116, 139, 0.18)';
        ctx.lineWidth = isMajor ? 1.0 : 0.6;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        if (isMajor && sx1 >= 24 && sx1 <= w - 24) {
            const topY = Math.max(54, Math.min(h - 20, Math.min(sy1, sy2) + 10));
            const botY = Math.min(h - 10, Math.max(54, Math.max(sy1, sy2) - 6));
            ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            ctx.fillText(`X=${gx}`, sx1 + 2, topY);
            ctx.fillText(`X=${gx}`, sx2 + 2, botY);
        }
    }

    // 1m and 2m Z grid lines (horizontal on screen in 2D top view)
    for (let gz = zMin; gz <= zMax; gz++) {
        _tempProjectVec.set(xMin, baseY, gz).project(camera);
        _tempProjectVec2.set(xMax, baseY, gz).project(camera);
        if (_tempProjectVec.z > 1.0 && _tempProjectVec2.z > 1.0) continue;

        const sx1 = (_tempProjectVec.x * 0.5 + 0.5) * w;
        const sy1 = (-_tempProjectVec.y * 0.5 + 0.5) * h;
        const sx2 = (_tempProjectVec2.x * 0.5 + 0.5) * w;
        const sy2 = (-_tempProjectVec2.y * 0.5 + 0.5) * h;

        const isMajor = (gz % 2 === 0);
        ctx.strokeStyle = isMajor ? 'rgba(14, 116, 144, 0.38)' : 'rgba(100, 116, 139, 0.18)';
        ctx.lineWidth = isMajor ? 1.0 : 0.6;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        if (isMajor && sy1 >= 50 && sy1 <= h - 16) {
            const leftX = Math.max(8, Math.min(sx1, sx2) + 4);
            const rightX = Math.min(w - 48, Math.max(sx1, sx2) - 42);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
            ctx.fillText(`Z=${gz}`, leftX, sy1 - 2);
            ctx.fillText(`Z=${gz}`, rightX, sy2 - 2);
        }
    }

    // In debugPlan mode, highlight door openings in bright emerald green
    if (STATE.debugPlan && typeof DOORS_REGISTRY !== 'undefined') {
        for (let i = 0; i < DOORS_REGISTRY.length; i++) {
            const d = DOORS_REGISTRY[i];
            if (d.floor !== activeFloor) continue;
            if (bFilter !== 'both' && String(d.building) !== bFilter) continue;
            const x1 = d.isHorizontal ? d.from : d.wallCoord;
            const z1 = d.isHorizontal ? d.wallCoord : d.from;
            const x2 = d.isHorizontal ? d.to : d.wallCoord;
            const z2 = d.isHorizontal ? d.wallCoord : d.to;
            _tempProjectVec.set(x1, baseY + 0.1, z1).project(camera);
            _tempProjectVec2.set(x2, baseY + 0.1, z2).project(camera);
            if (_tempProjectVec.z > 1.0 || _tempProjectVec2.z > 1.0) continue;
            const sx1 = (_tempProjectVec.x * 0.5 + 0.5) * w;
            const sy1 = (-_tempProjectVec.y * 0.5 + 0.5) * h;
            const sx2 = (_tempProjectVec2.x * 0.5 + 0.5) * w;
            const sy2 = (-_tempProjectVec2.y * 0.5 + 0.5) * h;
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.92)';
            ctx.lineWidth = 4.0;
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.stroke();
        }
    }
    ctx.restore();
}


function updateRoomLabelsScale() {
    const scaleMult = (typeof STATE !== 'undefined' && STATE.labelScale) ? STATE.labelScale : 1.0;
    labelSprites.forEach(item => {
        if (!item || !item.mesh) return;
        const planeW = item.baseW * item.customScale * scaleMult;
        const planeH = planeW * item.ratio;
        item.currentW = planeW;
        item.currentH = planeH;
        item.mesh.scale.set(scaleMult, scaleMult, 1);
    });
    if (typeof requestRender === 'function') requestRender(25);
}

// Алиас для обратной совместимости
const addRoomLabel = addRoomLabel3D;
