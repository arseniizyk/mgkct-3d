// Построение стен со скошенными углами (45 градусов) с идеальным бесшовным усредненным стыком (Miter Joint)
// Исключает торчащие углы (шипы) и внутренние поперечные швы на стыках с ортогональными стенами!
function addMiteredChamferWall(targetGroup, x1, z1, x2, z2, thickness = 0.18, isExterior = false, isDoor = false) {
    if (!targetGroup) return;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const half = thickness / 2;
    let V1, V2, V3, V4;
    if (dx > 0 && dz > 0) {
        // Юго-западный скос (Корпус 1): от вертикальной стены X=x1 к горизонтальной стене Z=z2
        // Ортогональные плоские срезы на стыках без зазоров и выступов
        V1 = [x1 - half, z1];
        V2 = [x2, z2 + half];
        V3 = [x2, z2 - half];
        V4 = [x1 + half, z1];
    } else if (dx > 0 && dz < 0) {
        // Скос у кабинета 205 (Корпус 1 Этаж 2): от горизонтальной стены Z=z1 к вертикальной стене X=x2
        // Ортогональные плоские срезы на стыках без зазоров и выступов
        V1 = [x1, z1 + half];
        V2 = [x2 + half, z2];
        V3 = [x2 - half, z2];
        V4 = [x1, z1 - half];
    } else {
        const L = Math.hypot(dx, dz) || 1;
        const nx = -dz / L;
        const nz = dx / L;
        V1 = [x1 + half * nx, z1 + half * nz];
        V2 = [x2 + half * nx, z2 + half * nz];
        V3 = [x2 - half * nx, z2 - half * nz];
        V4 = [x1 - half * nx, z1 - half * nz];
    }

    registerMiterJoint(targetGroup, x1, z1, thickness);
    registerMiterJoint(targetGroup, x2, z2, thickness);

    // В 3D-режиме также регистрируем скошенную стену в индексе отсечения плашек
    if (targetGroup.userData && targetGroup.userData.floor && OCCLUDER_WALLS_BY_FLOOR[targetGroup.userData.floor]) {
        const diagLen = Math.hypot(dx, dz) || 1;
        OCCLUDER_WALLS_BY_FLOOR[targetGroup.userData.floor].push({
            building: targetGroup.userData.building,
            minX: Math.min(x1, x2) - half,
            maxX: Math.max(x1, x2) + half,
            minZ: Math.min(z1, z2) - half,
            maxZ: Math.max(z1, z2) + half,
            isExterior: Boolean(isExterior),
            isDoor: Boolean(isDoor),
            sharedBoundaryWith: null,
            isDiagonal: true,
            x1,
            z1,
            ux: dx / diagLen,
            uz: dz / diagLen,
            len: diagLen,
            halfT: half
        });
    }
    if (!targetGroup._pendingChamferBoxes) {
        targetGroup._pendingChamferBoxes = [];
    }
    targetGroup._pendingChamferBoxes.push({
        id: 'chamfer_' + Math.round(x1 * 100) + '_' + Math.round(z1 * 100),
        isChamfer: true,
        x1, z1, x2, z2,
        minX: Math.min(x1, x2) - half,
        maxX: Math.max(x1, x2) + half,
        minZ: Math.min(z1, z2) - half,
        maxZ: Math.max(z1, z2) + half,
        thickness
    });

    if (!isDoor && targetGroup && targetGroup.userData && targetGroup.userData.floor && typeof WALLS_REGISTRY !== 'undefined' && Array.isArray(WALLS_REGISTRY)) {
        WALLS_REGISTRY.push({
            floor: targetGroup.userData.floor,
            building: targetGroup.userData.building,
            x1: x1,
            z1: z1,
            x2: x2,
            z2: z2,
            thickness: thickness
        });
    }

    const shape = new THREE.Shape();
    shape.moveTo(V1[0], V1[1]);
    shape.lineTo(V2[0], V2[1]);
    shape.lineTo(V3[0], V3[1]);
    shape.lineTo(V4[0], V4[1]);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: 1,
        bevelEnabled: false
    });
    geom.rotateX(Math.PI / 2);
    geom.translate(0, 0.5, 0);

    const mat = isDoor ? MATERIALS.doorThin : MATERIALS.wall;
    const mesh = new THREE.Mesh(geom, mat);

    const h = STATE.wallHeight;
    mesh.scale.set(1, h + WALL_SINK, 1);
    mesh.position.set(0, (h - WALL_SINK) / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const effectiveExterior = isExterior || (thickness >= 0.20);
    mesh.userData.isExterior = effectiveExterior;
    mesh.userData.isInterior = !effectiveExterior && (isDoor || (thickness < 0.20));
    mesh.userData.isDoor = isDoor;
    mesh.userData.isMiteredChamfer = true;
    targetGroup.add(mesh);

    // Бесшовные контурные ребра: только наружный и внутренний фасад (ноль поперечных швов на стыках!)
    const yTop = h;
    const yBot = -WALL_SINK;
    const edgePoints = [
        new THREE.Vector3(V1[0], yTop, V1[1]), new THREE.Vector3(V2[0], yTop, V2[1]),
        new THREE.Vector3(V3[0], yTop, V3[1]), new THREE.Vector3(V4[0], yTop, V4[1]),
        new THREE.Vector3(V1[0], yBot, V1[1]), new THREE.Vector3(V2[0], yBot, V2[1]),
        new THREE.Vector3(V3[0], yBot, V3[1]), new THREE.Vector3(V4[0], yBot, V4[1])
    ];
    const edgeGeom = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.LineSegments(edgeGeom, isDoor ? MATERIALS.edgeDoor : MATERIALS.edgeMain);
    edgeLine.userData.isExterior = effectiveExterior;
    edgeLine.userData.isInterior = mesh.userData.isInterior;
    edgeLine.userData.isDoor = isDoor;
    edgeLine.userData.isMiteredChamfer = true;
    targetGroup.add(edgeLine);

    if (isDoor) {
        doorMeshes.push(mesh);
        doorEdges.push(edgeLine);
    } else {
        wallMeshes.push(mesh);
        wallEdges.push(edgeLine);
    }
}

function createWallSegment(targetGroup, c1, c2, fixedCoord, isHorizontal, angle, thickness, isDoor, isExterior = false, isColumn = false, omitStart = false, omitEnd = false, sharedBoundaryWith = null, customEdgeGeom = null) {
    const len = Math.abs(c2 - c1);
    if (len <= 0.01) return;

    const mid = (c1 + c2) / 2;
    const cx = isHorizontal ? mid : fixedCoord;
    const cz = isHorizontal ? fixedCoord : mid;

    const geom = getCachedBoxGeometry(len, 1, thickness);
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
    if (sharedBoundaryWith !== null) {
        mesh.userData.sharedBoundaryWith = sharedBoundaryWith;
        if (typeof STATE !== 'undefined' && STATE.buildingFilter === 'both') {
            mesh.visible = false;
        }
    }
    if (isColumn) {
        mesh.userData.isColumn = true;
        mesh.userData.isInterior = true;
    }
    targetGroup.add(mesh);

    const edgeGeom = customEdgeGeom || (isDoor ? getCachedEdgesGeometry(geom, len, 1, thickness) : createWallEdgesGeometry(len, thickness, omitStart, omitEnd));
    const edgeLine = new THREE.LineSegments(edgeGeom, isDoor ? MATERIALS.edgeDoor : MATERIALS.edgeMain);
    edgeLine.userData.isExterior = isExterior;
    edgeLine.userData.isInterior = mesh.userData.isInterior;
    edgeLine.userData.isDoor = isDoor;
    if (sharedBoundaryWith !== null) {
        edgeLine.userData.sharedBoundaryWith = sharedBoundaryWith;
    }
    if (isColumn) {
        edgeLine.userData.isColumn = true;
    }
    mesh.add(edgeLine);

    if (isColumn && typeof STATE !== 'undefined' && STATE.is2D) {
        mesh.visible = false;
        edgeLine.visible = false;
    }

    if (isDoor) {
        doorMeshes.push(mesh);
        doorEdges.push(edgeLine);
    } else {
        wallMeshes.push(mesh);
        wallEdges.push(edgeLine);
    }
}

// Построение стен со скошенными углами (45 градусов) с идеальным бесшовным усредненным стыком (Miter Joint)


function addSquareColumn(targetGroup, cx, cz, size = 0.28, isExterior = false) {
    const geom = getCachedBoxGeometry(size, 1, size);
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

    const edgeGeom = getCachedEdgesGeometry(geom, size, 1, size);
    const edgeLine = new THREE.LineSegments(edgeGeom, MATERIALS.edgeMain);
    edgeLine.userData.isExterior = isExterior;
    edgeLine.userData.isInterior = !isExterior;
    edgeLine.userData.isColumn = true;
    mesh.add(edgeLine);

    if (typeof STATE !== 'undefined' && STATE.is2D) {
        mesh.visible = false;
        edgeLine.visible = false;
    }

    wallMeshes.push(mesh);
    wallEdges.push(edgeLine);
}
