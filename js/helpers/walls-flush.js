function flushWalls(targetGroup) {
    if (!targetGroup || !targetGroup._pendingWallLines || targetGroup._pendingWallLines.length === 0) return;
    const pendingLines = targetGroup._pendingWallLines;
    targetGroup._pendingWallLines = [];
    _pendingWallGroups.delete(targetGroup);

    const solvedSegments = solveCampusJunctions(targetGroup, pendingLines);

    // Сбор всех прямоугольных боксов стен этажа для точной резолюции бесшовных контурных рёбер
    const wallBoxes = [];
    if (targetGroup._pendingChamferBoxes) {
        for (let i = 0; i < targetGroup._pendingChamferBoxes.length; i++) {
            wallBoxes.push(targetGroup._pendingChamferBoxes[i]);
        }
    }
    for (let i = 0; i < solvedSegments.length; i++) {
        const s = solvedSegments[i];
        if (s.isDoor || s.isColumn) continue;
        const isH = s.isHorizontal;
        const cMin = Math.min(s.c1, s.c2);
        const cMax = Math.max(s.c1, s.c2);
        const ht = s.thickness / 2;
        wallBoxes.push({
            id: s.id,
            isH: isH,
            c1: cMin,
            c2: cMax,
            fixedCoord: s.fixedCoord,
            thickness: s.thickness,
            minX: isH ? cMin : s.fixedCoord - ht,
            maxX: isH ? cMax : s.fixedCoord + ht,
            minZ: isH ? s.fixedCoord - ht : cMin,
            maxZ: isH ? s.fixedCoord + ht : cMax
        });
    }

    const bldgNum = (targetGroup && targetGroup.userData) ? targetGroup.userData.building : null;
    for (let i = 0; i < solvedSegments.length; i++) {
        const seg = solvedSegments[i];
        const angle = seg.isHorizontal ? 0 : Math.PI / 2;
        // Определяем общую межкорпусную стену, чтобы не дублировать меш в режиме показа всех корпусов (both)
        let sharedBoundaryWith = null;
        if (bldgNum === 1 && !seg.isHorizontal && Math.abs(seg.fixedCoord - 20.4) < 0.05) {
            sharedBoundaryWith = 2;
        } else if (bldgNum === 3 && seg.isHorizontal && Math.abs(seg.fixedCoord - (-14.0)) < 0.05) {
            sharedBoundaryWith = 1;
        }

        let customEdgeGeom = null;
        if (!seg.isDoor) {
            customEdgeGeom = createResolvedWallEdgesGeometry(seg, wallBoxes);
        }

        createWallSegment(
            targetGroup,
            seg.c1,
            seg.c2,
            seg.fixedCoord,
            seg.isHorizontal,
            angle,
            seg.thickness,
            seg.isDoor,
            seg.isExterior,
            seg.isColumn,
            seg.omitStartCap,
            seg.omitEndCap,
            sharedBoundaryWith,
            customEdgeGeom
        );

        if (!seg.isColumn && targetGroup.userData && targetGroup.userData.floor) {
            const flNum = targetGroup.userData.floor;
            const cMin = Math.min(seg.c1, seg.c2);
            const cMax = Math.max(seg.c1, seg.c2);
            const halfT = seg.thickness / 2;
            if (OCCLUDER_WALLS_BY_FLOOR[flNum]) {
                OCCLUDER_WALLS_BY_FLOOR[flNum].push({
                    building: targetGroup.userData.building,
                    minX: seg.isHorizontal ? cMin : seg.fixedCoord - halfT,
                    maxX: seg.isHorizontal ? cMax : seg.fixedCoord + halfT,
                    minZ: seg.isHorizontal ? seg.fixedCoord - halfT : cMin,
                    maxZ: seg.isHorizontal ? seg.fixedCoord + halfT : cMax,
                    isExterior: Boolean(seg.isExterior),
                    isDoor: Boolean(seg.isDoor),
                    sharedBoundaryWith: sharedBoundaryWith,
                    isDiagonal: false
                });
            }
        }

        if (!seg.isDoor && !seg.isColumn && targetGroup.userData && targetGroup.userData.floor && typeof WALLS_REGISTRY !== 'undefined' && Array.isArray(WALLS_REGISTRY)) {
            const wallEntry = {
                floor: targetGroup.userData.floor,
                building: targetGroup.userData.building,
                x1: seg.isHorizontal ? seg.c1 : seg.fixedCoord,
                z1: seg.isHorizontal ? seg.fixedCoord : seg.c1,
                x2: seg.isHorizontal ? seg.c2 : seg.fixedCoord,
                z2: seg.isHorizontal ? seg.fixedCoord : seg.c2,
                thickness: seg.thickness
            };
            if (sharedBoundaryWith !== null) {
                wallEntry.sharedBoundaryWith = sharedBoundaryWith;
            }
            WALLS_REGISTRY.push(wallEntry);
        }
    }
    // Очищаем локальный список сопряжений группы после генерации
    targetGroup._miterJoints = null;
}

const finalizeFloorWalls = flushWalls;
window.finalizeFloorWalls = finalizeFloorWalls;
window.flushWalls = flushWalls;

function flushAllPendingWalls() {
    for (const group of _pendingWallGroups) {
        flushWalls(group);
    }
    _pendingWallGroups.clear();
}

function addArbitraryWallSegment(targetGroup, x1, z1, x2, z2, thickness = 0.18, isDoor = false, isExterior = false) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len <= 0.01) return;

    registerMiterJoint(targetGroup, x1, z1, thickness);
    registerMiterJoint(targetGroup, x2, z2, thickness);

    if (targetGroup && targetGroup.userData && targetGroup.userData.floor && OCCLUDER_WALLS_BY_FLOOR[targetGroup.userData.floor]) {
        const halfT = thickness / 2;
        OCCLUDER_WALLS_BY_FLOOR[targetGroup.userData.floor].push({
            building: targetGroup.userData.building,
            minX: Math.min(x1, x2) - halfT,
            maxX: Math.max(x1, x2) + halfT,
            minZ: Math.min(z1, z2) - halfT,
            maxZ: Math.max(z1, z2) + halfT,
            isExterior: Boolean(isExterior),
            isDoor: Boolean(isDoor),
            sharedBoundaryWith: null,
            isDiagonal: true,
            x1,
            z1,
            ux: dx / len,
            uz: dz / len,
            len,
            halfT
        });
    }

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
