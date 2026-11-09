function buildStairValidationAxes() {
    STAIR_SHAFTS_VALIDATION.forEach(s => {
        const cx = (s.x1 + s.x2) / 2;
        const cz = (s.z1 + s.z2) / 2;
        const w = Math.abs(s.x2 - s.x1);
        const d = Math.abs(s.z2 - s.z1);

        const pts = [
            new THREE.Vector3(cx, -0.5, cz),
            new THREE.Vector3(cx, 25, cz)
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const centerLine = new THREE.Line(lineGeom, MATERIALS.stairAxisLine);
        centerLine.computeLineDistances();
        stairValidationGroup.add(centerLine);

        const boxGeom = new THREE.BoxGeometry(w, 1, d);
        const boxEdges = new THREE.EdgesGeometry(boxGeom);
        boxGeom.dispose();
        const wireframeBox = new THREE.LineSegments(boxEdges, MATERIALS.stairBoxEdge);
        wireframeBox.position.set(cx, 1, cz);
        stairValidationGroup.add(wireframeBox);

        stairValidationItems.push({ ...s, cx, cz, centerLine, wireframeBox });
    });
}

function updateStairValidationAxes() {
    const show = STATE.showStairAxes;
    stairValidationGroup.visible = show;
    if (!show) return;

    let botY = floorGroups[1] ? floorGroups[1].position.y : 0;
    let maxActiveF = 7;

    const isSingleFloor = (STATE.mode !== 'all' && STATE.mode !== 'slice' && STATE.mode !== 'sideBySide');
    let selectedFloor = 1;
    if (isSingleFloor) {
        selectedFloor = parseInt(STATE.mode, 10);
        maxActiveF = selectedFloor;
        botY = 0;
    } else if (STATE.mode === 'slice') {
        maxActiveF = STATE.sliceMaxFloor;
    }

    stairValidationItems.forEach(item => {
        let visibleByBuilding = (typeof isBuildingVisible === 'function')
            ? isBuildingVisible(item.bldg)
            : (STATE.buildingFilter === 'both' || String(STATE.buildingFilter) === String(item.bldg));

        if (isSingleFloor) {
            if (item.maxFloor < selectedFloor) {
                visibleByBuilding = false;
            }
        }

        item.centerLine.visible = visibleByBuilding;
        item.wireframeBox.visible = visibleByBuilding;
        if (!visibleByBuilding) return;

        let topY, totalH;
        if (isSingleFloor) {
            topY = STATE.wallHeight;
            totalH = STATE.wallHeight + 0.3;
            const posAttr = item.centerLine.geometry.attributes.position;
            posAttr.setXYZ(0, item.cx, -0.2, item.cz);
            posAttr.setXYZ(1, item.cx, topY + 0.5, item.cz);
            posAttr.needsUpdate = true;
            item.centerLine.computeLineDistances();

            item.wireframeBox.scale.y = totalH;
            item.wireframeBox.position.set(item.cx, totalH / 2 - 0.1, item.cz);
        } else {
            const effectiveMax = Math.min(item.maxFloor, maxActiveF);
            topY = (floorGroups[effectiveMax] ? floorGroups[effectiveMax].position.y : 0) + STATE.wallHeight;
            totalH = Math.max(0.5, topY - botY);

            const posAttr = item.centerLine.geometry.attributes.position;
            posAttr.setXYZ(0, item.cx, botY - 0.3, item.cz);
            posAttr.setXYZ(1, item.cx, topY + 0.8, item.cz);
            posAttr.needsUpdate = true;
            item.centerLine.computeLineDistances();

            item.wireframeBox.scale.y = totalH;
            item.wireframeBox.position.set(item.cx, botY + totalH / 2, item.cz);
        }
    });
}

function buildRoofs() {
    // Корпус 1: Кровля 7-го этажа + открытый переход каб. 305 на 3-м этаже
    addRoofRect(bldg1FloorGroups[7], -10.0, -14.0, 16.0, -4.0, 1);
    addRoofRect(bldg1FloorGroups[7], -14.0, -4.0, -5.8, 14.0, 1);
    addRoofRect(bldg1FloorGroups[7], -5.8, -4.0, 16.0, 4.0, 1);
    addRoofRect(bldg1FloorGroups[7], -5.8, 4.0, 12.5, 14.0, 1);
    addRoofRect(bldg1FloorGroups[3], 16.0, -9.5, 20.4, -2.2, 1);

    // Корпус 2: Кровля 3-го этажа
    addRoofRect(bldg2FloorGroups[3], B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_BOT, 2);

    // Корпус 3: Кровля 2-го этажа + переход к Корпусу 4
    addRoofRect(bldg3FloorGroups[2], B3_X_WEST, B3_Z_NORTH, B3_X_EAST, B3_Z_SOUTH, 3);
    addRoofRect(bldg3FloorGroups[2], B3_X_EAST, -47.6, 15.6, -44.0, 3);

    // Корпус 4: Кровля 3-го этажа + сквозные лестничные шахты + переходы 2-го этажа
    if (typeof bldg5FloorGroups !== 'undefined' && bldg5FloorGroups[1]) {
        addRoofRect(bldg5FloorGroups[1], -1.6, -71.5, 14.0, -66.0, 5);
    }
    addRoofRect(bldg4FloorGroups[3], B4_X_WEST, B4_Z_NORTH, B4_X_EAST, B4_Z_SOUTH, 4);
    addRoofRect(bldg4FloorGroups[3], B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z2, 4);
    addRoofRect(bldg4FloorGroups[3], B4_LK3_X1, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, 4);
    addRoofRect(bldg4FloorGroups[3], B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, 4);
    // Переходы 2-го этажа
    addRoofRect(bldg4FloorGroups[2], 15.6, -46.8, B4_X_WEST, -44.2, 4);
    addRoofRect(bldg4FloorGroups[2], 36.2, B4_Z_SOUTH, B4_LK1_X1, B2_Z_TOP, 4);
}

function updateRoofsVisibility() {
    roofMeshes.forEach(item => {
        item.mesh.visible = STATE.showRoof;
    });
    updateShadows();
    requestRender(20);
}

function updateTerritoryVisibility() {
    if (territoryGroup) {
        territoryGroup.visible = STATE.showTerritory;
    }
    if (roadNetworkGroup) {
        roadNetworkGroup.visible = !STATE.showTerritory;
    }
    updateShadows();
    requestRender(20);
}

function buildAlignmentGuides() {
    const corners = [
        // Корпус 1 (все 7 этажей)
        { gx: -14.0, gz: -4.0, maxFloor: 7, bldg: 1 },
        { gx: -14.0, gz: 14.0, maxFloor: 7, bldg: 1 },
        { gx: 12.5, gz: 14.0, maxFloor: 7, bldg: 1 },
        { gx: 16.0, gz: -14.0, maxFloor: 7, bldg: 1 },
        { gx: -10.0, gz: -14.0, maxFloor: 7, bldg: 1 },
        // Корпус 2 (этажи 1–3)
        { gx: B2_X_START, gz: B2_Z_TOP, maxFloor: 3, bldg: 2 },
        { gx: B2_X_START, gz: B2_Z_BOT, maxFloor: 3, bldg: 2 },
        { gx: B2_X_END, gz: B2_Z_TOP, maxFloor: 3, bldg: 2 },
        { gx: B2_X_END, gz: B2_Z_BOT, maxFloor: 3, bldg: 2 },
        // Корпус 3 (этажи 1–2)
        { gx: B3_X_WEST, gz: B3_Z_SOUTH, maxFloor: 2, bldg: 3 },
        { gx: B3_X_EAST, gz: B3_Z_SOUTH, maxFloor: 2, bldg: 3 },
        { gx: B3_X_WEST, gz: B3_Z_NORTH, maxFloor: 2, bldg: 3 },
        { gx: B3_X_EAST, gz: B3_Z_NORTH, maxFloor: 2, bldg: 3 },
        // Корпус 4 (этажи 1–3)
        { gx: B4_X_WEST, gz: B4_Z_SOUTH, maxFloor: 3, bldg: 4 },
        { gx: B4_X_EAST, gz: B4_Z_SOUTH, maxFloor: 3, bldg: 4 },
        { gx: B4_X_WEST, gz: B4_Z_NORTH, maxFloor: 3, bldg: 4 },
        { gx: B4_X_EAST, gz: B4_Z_NORTH, maxFloor: 3, bldg: 4 }
    ];

    corners.forEach(item => {
        const pts = [
            new THREE.Vector3(item.gx, 0, item.gz),
            new THREE.Vector3(item.gx, 10, item.gz)
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geom, MATERIALS.guideLine);
        line.computeLineDistances();
        alignmentGuidesGroup.add(line);
        guideLines.push({ ...item, line });
    });
}

function updateAlignmentGuides() {
    const show = STATE.showGuides;
    alignmentGuidesGroup.visible = show;
    if (!show) return;

    let botY = floorGroups[1] ? floorGroups[1].position.y : 0;
    let maxActiveF = 7;

    const isSingleFloor = (STATE.mode !== 'all' && STATE.mode !== 'slice' && STATE.mode !== 'sideBySide');
    let selectedFloor = 1;
    if (isSingleFloor) {
        selectedFloor = parseInt(STATE.mode, 10);
        maxActiveF = selectedFloor;
        botY = 0;
    } else if (STATE.mode === 'slice') {
        maxActiveF = STATE.sliceMaxFloor;
    }

    guideLines.forEach(item => {
        let visibleByBuilding = (typeof isBuildingVisible === 'function')
            ? isBuildingVisible(item.bldg)
            : (STATE.buildingFilter === 'both' || String(STATE.buildingFilter) === String(item.bldg));

        if (isSingleFloor) {
            if (item.maxFloor < selectedFloor) {
                visibleByBuilding = false;
            }
        }

        item.line.visible = visibleByBuilding;
        if (!visibleByBuilding) return;

        let topY;
        if (isSingleFloor) {
            topY = STATE.wallHeight;
        } else {
            const effectiveMax = Math.min(item.maxFloor, maxActiveF);
            topY = (floorGroups[effectiveMax] ? floorGroups[effectiveMax].position.y : 0) + STATE.wallHeight;
        }

        const posAttr = item.line.geometry.attributes.position;
        posAttr.setXYZ(0, item.gx, botY, item.gz);
        posAttr.setXYZ(1, item.gx, topY, item.gz);
        posAttr.needsUpdate = true;
        item.line.computeLineDistances();
    });
}

function isPointInFloorFootprint(lx, lz, floorNum, bldId = null) {
    const m = 0.22;
    const isVisible = (typeof isBuildingVisible === 'function')
        ? isBuildingVisible
        : (b) => (STATE.buildingFilter === 'both' || String(STATE.buildingFilter) === String(b));

    if (isVisible(1) && (!bldId || bldId === 1)) {
        if (lx >= -10.0 - m && lx <= 16.0 + m && lz >= -14.0 - m && lz <= -4.0 + m) return true;
        if (lx >= -14.0 - m && lx <= 16.0 + m && lz >= -4.0 - m && lz <= 4.0 + m) return true;
        if (lx >= -14.0 - m && lx <= 12.5 + m && lz >= 4.0 - m && lz <= 14.0 + m) return true;
        if (floorNum <= 3) {
            if (lx >= 16.0 - m && lx <= 20.4 + m && lz >= -9.5 - m && lz <= -2.2 + m) return true;
        }
    }

    if (isVisible(2) && (!bldId || bldId === 2) && floorNum <= 3) {
        if (lx >= B2_X_START - m && lx <= B2_X_END + m && lz >= B2_Z_TOP - m && lz <= B2_Z_BOT + m) return true;
    }

    if (isVisible(3) && (!bldId || bldId === 3) && floorNum <= 2) {
        if (lx >= B3_X_WEST - m && lx <= B3_X_EAST + m && lz >= B3_Z_NORTH - m && lz <= B3_Z_SOUTH + m) return true;
        if (lx >= B3_X_EAST - m && lx <= 15.6 + m && lz >= -47.6 - m && lz <= -44.0 + m) return true;
    }

    if (isVisible(4) && (!bldId || bldId === 4) && floorNum <= 3) {
        if (floorNum === 3) {
            // На 3-м этаже Корпуса 4 зоны Второго Света (над спортзалом и актовым залом) являются сквозными проемами (нет перекрытия)
            const inGymVoid = (lx >= B4_X_WEST - m && lx <= B4_X_EAST + m && lz >= B4_Z_NORTH - m && lz <= B4_Z_MID_N + m);
            const inHallVoid = (lx >= 48.2 - m && lx <= B4_X_EAST + m && lz >= -43.6 - m && lz <= B4_Z_SOUTH + m);
            if (!inGymVoid && !inHallVoid) {
                if (lx >= B4_X_WEST - m && lx <= B4_X_EAST + m && lz >= B4_Z_NORTH - m && lz <= B4_Z_SOUTH + m) return true;
            }
        } else {
            if (lx >= B4_X_WEST - m && lx <= B4_X_EAST + m && lz >= B4_Z_NORTH - m && lz <= B4_Z_SOUTH + m) return true;
        }
        if (lx >= B4_LK2_X1 - m && lx <= B4_LK2_X2 + m && lz >= B4_LK2_Z1 - m && lz <= B4_LK2_Z2 + m) return true;
        if (lx >= B4_LK3_X1 - m && lx <= B4_LK3_X2 + m && lz >= B4_LK3_Z1 - m && lz <= B4_LK3_Z2 + m) return true;
        if (lx >= B4_LK1_X1 - m && lx <= B4_LK1_X2 + m && lz >= B4_LK1_Z1 - m && lz <= B4_LK1_Z2 + m) return true;
        if (floorNum === 2) {
            if (lx >= 15.6 - m && lx <= B4_X_WEST + m && lz >= -46.8 - m && lz <= -44.2 + m) return true;
            if (lx >= 36.2 - m && lx <= B4_LK1_X1 + m && lz >= B4_Z_SOUTH - m && lz <= B2_Z_TOP + m) return true;
        }
    }
    return false;
}

function getBuildingMaxFloorCount(bldId) {
    if (bldId === 1) return 7;
    if (bldId === 2 || bldId === 4) return 3;
    if (bldId === 3) return 2;
    return 1;
}

// Аналитическое 3D-отсечение экранных плашек за стенами, фасадами, крышей и плитами перекрытий (только для 3D-режима)
