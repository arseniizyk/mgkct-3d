function addRoadStripe(group, x1, z1, x2, z2, width = 0.15, material = MATERIALS.roadMarkingWhite) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;

    const angle = Math.atan2(dz, dx);
    const geom = new THREE.PlaneGeometry(len, width);
    const mesh = new THREE.Mesh(geom, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = angle;
    mesh.position.set((x1 + x2) / 2, 0.025, (z1 + z2) / 2);
    group.add(mesh);
}

function addDashedLine(group, xStart, xEnd, z, dashLen = 3.0, gapLen = 3.0, width = 0.15, material = MATERIALS.roadMarkingWhite) {
    let curX = Math.min(xStart, xEnd);
    const maxVal = Math.max(xStart, xEnd);

    while (curX < maxVal) {
        const nextX = Math.min(curX + dashLen, maxVal);
        addRoadStripe(group, curX, z, nextX, z, width, material);
        curX += dashLen + gapLen;
    }
}

// Тактильная предупреждающая плитка (СТБ П 2443 / ГОСТ Р 52875)
function addTactileWarningStrip(group, x1, x2, z1, z2) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const geoms = [];
    const baseGeom = new THREE.BoxGeometry(w, 0.015, d);
    baseGeom.translate(cx, 0.065, cz);
    geoms.push(baseGeom);

    // Продольные направляющие тактильные рифы
    const numRibs = Math.max(3, Math.floor(d / 0.10));
    for (let r = 0; r < numRibs; r++) {
        const rz = (cz - d / 2 + 0.05) + r * (d - 0.10) / Math.max(1, numRibs - 1);
        const ribGeom = new THREE.BoxGeometry(w - 0.04, 0.008, 0.035);
        ribGeom.translate(cx, 0.075, rz);
        geoms.push(ribGeom);
    }

    const merged = mergeBufferGeometriesVanilla(geoms);
    const stripMesh = new THREE.Mesh(merged, MATERIALS.roadMarkingYellow);
    stripMesh.receiveShadow = true;
    group.add(stripMesh);
}



function addBusStopYellowZigzag(group, x1, x2, z1, z2) {
    // Желтая зигзагообразная разметка 1.17 (СТБ 1300-2014) строго в границах кармана
    // Бесшовная геометрия BufferGeometry с аналитическим митер-смещением (0 наложений, 0 щелей)
    const zInner = Math.min(z1, z2); // 25.80 (ближе к бордюру посадочной платформы)
    const zOuter = Math.max(z1, z2); // 27.80 (граница проезжей части)
    const deltaZ = zOuter - zInner;   // 2.00 м (размах зигзага)
    const length = x2 - x1;           // 42.0 м
    const numCycles = 24;             // 24 полуволны (12 полных циклов)
    const p = length / numCycles;     // 1.75 м (шаг по X)
    const w = 0.15;                   // нормальная ширина полосы (15 см)
    const y = 0.026;                  // возвышение над дорожным полотном

    const diagLen = Math.hypot(p, deltaZ); // S = sqrt(p^2 + deltaZ^2)
    // Митер-смещение вдоль оси Z в вершинах зигзага: M = (w * S) / (2 * p)
    const miterZ = (w * diagLen) / (2 * p);

    const vertices = [];
    const indices = [];

    // 1. Вершины непрерывной зигзагообразной ленты
    for (let k = 0; k <= numCycles; k++) {
        const xk = x1 + k * p;
        const zk = (k % 2 === 0) ? zInner : zOuter;

        // Пара вершин (внутренняя и внешняя) вдоль оси Z
        vertices.push(xk, y, zk - miterZ);
        vertices.push(xk, y, zk + miterZ);

        if (k < numCycles) {
            const base = k * 2;
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }
    }

    // 2. Начальная поперечная замыкающая линия на x1
    const endW = 0.18;
    const baseEnd1 = vertices.length / 3;
    vertices.push(
        x1 - endW / 2, y, zInner - miterZ,
        x1 + endW / 2, y, zInner - miterZ,
        x1 + endW / 2, y, zOuter + miterZ,
        x1 - endW / 2, y, zOuter + miterZ
    );
    indices.push(
        baseEnd1, baseEnd1 + 1, baseEnd1 + 2,
        baseEnd1, baseEnd1 + 2, baseEnd1 + 3
    );

    // 3. Конечная поперечная замыкающая линия на x2
    const baseEnd2 = vertices.length / 3;
    vertices.push(
        x2 - endW / 2, y, zInner - miterZ,
        x2 + endW / 2, y, zInner - miterZ,
        x2 + endW / 2, y, zOuter + miterZ,
        x2 - endW / 2, y, zOuter + miterZ
    );
    indices.push(
        baseEnd2, baseEnd2 + 1, baseEnd2 + 2,
        baseEnd2, baseEnd2 + 2, baseEnd2 + 3
    );

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, MATERIALS.roadMarkingYellow);
    mesh.receiveShadow = true;
    group.add(mesh);
}

function addBeveledBayCorners(group, x1, x2, z1, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);

    const cornerGeom = new THREE.BoxGeometry(len, 0.14, 0.8);
    const cornerMesh = new THREE.Mesh(cornerGeom, MATERIALS.asphaltRoad);
    cornerMesh.position.set((x1 + x2) / 2, -0.05, (z1 + z2) / 2);
    cornerMesh.rotation.y = -angle;
    group.add(cornerMesh);

    addCurbSegment(group, x1, z1, x2, z2);
}

// ==========================================
// M3: ПРОЦЕДУРНЫЕ 3D-МОДЕЛИ ДЕРЕВЬЕВ И БОТАНИЧЕСКОГО ОЗЕЛЕНЕНИЯ
// ==========================================

// Примечание: mergeBufferGeometriesVanilla определена и оптимизирована в js/helpers.js

// ----------------------------------------------------
// 1. БЕРЕЗА ЕВРОПЕЙСКАЯ (BETULA PENDULA)
// ----------------------------------------------------
