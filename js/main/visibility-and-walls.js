// ==========================================
// ОПТИМИЗАЦИЯ: УМНОЕ СКРЫТИЕ ВНУТРЕННИХ СТЕН
// В режиме стопки скрываются ТОЛЬКО скрытые внутренние перегородки комнат,
// а внешние несущие стены (фасад) и плиты перекрытий ВСЕГДА остаются видимыми!
// ==========================================
function updateEdgesVisibility() {
    const hideSharedBoundary = (STATE.buildingFilter === 'both');

    // Используем Set для O(1) проверки — traverse не обрабатывает то, что уже обработано.
    const handled = new Set();

    function applyEdgeVisibility(line) {
        if (!line) return;
        handled.add(line);
        if (line.userData && line.userData.sharedBoundaryWith !== undefined && hideSharedBoundary) {
            line.visible = false;
        } else if (line.userData && line.userData.isColumn && STATE.is2D) {
            line.visible = false;
        } else {
            line.visible = STATE.showEdges;
        }
    }

    wallEdges.forEach(applyEdgeVisibility);
    doorEdges.forEach(applyEdgeVisibility);

    // Кэшированный список вспомогательных LineSegments (без рекурсивного traverse каждого этажа)
    if (!STATE.auxEdgesList) {
        STATE.auxEdgesList = [];
        for (let f = 1; f <= 7; f++) {
            if (floorGroups[f]) {
                floorGroups[f].traverse(child => {
                    if (child.isLineSegments && !handled.has(child)) {
                        STATE.auxEdgesList.push(child);
                    }
                });
            }
        }
    }
    for (let i = 0; i < STATE.auxEdgesList.length; i++) {
        applyEdgeVisibility(STATE.auxEdgesList[i]);
    }
    requestRender(20);
}

function updateFloorsInteriorVisibility() {
    const isStack = (STATE.mode === 'all' || STATE.mode === 'slice') && (!STATE.exploded || STATE.explodeGap < 0.2) && (STATE.slabOpacity > 0.85);

    function setGroupInteriorVisibility(group, isTopFloor) {
        if (!group) return;
        // Внутренние стены и двери показываются, если этажи разнесены взрывом, либо это верхний этаж, либо плиты полупрозрачные
        const showInterior = !isStack || isTopFloor;

        const hideSharedBoundary = (STATE.buildingFilter === 'both');
        if (!group._interiorElements) {
            group._interiorElements = [];
            group.traverse(child => {
                if (child.userData) group._interiorElements.push(child);
            });
        }
        const elements = group._interiorElements;
        for (let eIdx = 0; eIdx < elements.length; eIdx++) {
            const child = elements[eIdx];
            if (child.userData.sharedBoundaryWith !== undefined) {
                if (hideSharedBoundary) {
                    child.visible = false;
                    continue;
                }
            }

            // КОЛОННЫ: в 2D виде полностью скрываются с карты, в 3D остаются видимыми!
            if (child.userData.isColumn === true) {
                if (STATE.is2D) {
                    child.visible = false;
                } else {
                    if (child.isLineSegments) {
                        child.visible = STATE.showEdges;
                    } else if (child.userData.isExterior === true) {
                        child.visible = true;
                    } else {
                        child.visible = showInterior;
                    }
                }
                continue;
            }

            // КОНТУРЫ / РЁБРА (LineSegments): строго подчиняются переключателю STATE.showEdges!
            if (child.isLineSegments) {
                child.visible = STATE.showEdges;
                continue;
            }

            // КРЫША: управляется исключительно переключателем STATE.showRoof
            if (child.userData.isRoof === true) {
                child.visible = STATE.showRoof;
                continue;
            }

            // ВНЕШНИЕ ЭЛЕМЕНТЫ, ДВУСВЕТНЫЕ ПРОСТРАНСТВА И СТУПЕНИ ЛЕСТНИЦ ВСЕГДА ВИДНЫ!
            if (child.userData.isExterior === true || child.userData.isDoubleHeight === true || child.userData.isStair === true) {
                if (child.userData.isDoor) {
                    child.visible = STATE.showDoors;
                } else {
                    child.visible = true;
                }
                continue;
            }

            // Скрываем/показываем ТОЛЬКО внутренние перегородки, межкомнатные двери, внутренние ступени и таблички кабинетов
            if (child.userData.isInterior === true) {
                if (child.userData.isDoor) {
                    child.visible = showInterior && STATE.showDoors;
                } else {
                    child.visible = showInterior;
                }
            }
            // ВНЕШНИЕ СТЕНЫ и ПЛИТЫ ПЕРЕКРЫТИЙ ВСЕГДА ВИДНЫ!
            else if (child.userData.isInterior === false) {
                if (child.userData.isDoor) {
                    child.visible = STATE.showDoors;
                } else {
                    child.visible = true;
                }
            }
        }
    }

    const maxF = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;
    // Корпус 1: верхний отображаемый этаж
    for (let f = 1; f <= 7; f++) {
        setGroupInteriorVisibility(bldg1FloorGroups[f], f === Math.min(7, maxF));
    }
    // Корпус 2: верхний отображаемый этаж
    for (let f = 1; f <= 3; f++) {
        setGroupInteriorVisibility(bldg2FloorGroups[f], f === Math.min(3, maxF));
    }
    // Корпус 3: верхний отображаемый этаж
    for (let f = 1; f <= 2; f++) {
        setGroupInteriorVisibility(bldg3FloorGroups[f], f === Math.min(2, maxF));
    }
    // Корпус 4: верхний отображаемый этаж
    for (let f = 1; f <= 3; f++) {
        setGroupInteriorVisibility(bldg4FloorGroups[f], f === Math.min(3, maxF));
    }
}

function recalcTargetPositions() {
    const stepH = STATE.wallHeight + 0.25 + (STATE.exploded ? STATE.explodeGap : 0);
    const isVisible = (typeof isBuildingVisible === 'function')
        ? isBuildingVisible
        : (b) => (STATE.buildingFilter === 'both' || String(STATE.buildingFilter) === String(b));

    for (let f = 1; f <= 7; f++) {
        bldg1FloorGroups[f].visible = isVisible(1);
        bldg2FloorGroups[f].visible = isVisible(2) && (f <= 3);
        bldg3FloorGroups[f].visible = isVisible(3) && (f <= 2);
        bldg4FloorGroups[f].visible = isVisible(4) && (f <= 3);
        if (typeof bldg5FloorGroups !== 'undefined' && bldg5FloorGroups[f]) {
            bldg5FloorGroups[f].visible = isVisible(5) && (f <= 1);
        }
    }

    if (STATE.mode === 'all' || STATE.mode === 'slice') {
        const maxF = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;
        for (let f = 1; f <= 7; f++) {
            floorGroups[f].visible = (f <= maxF);
            STATE.targetPos[f].set(0, stepH * (f - 1), 0);
        }
    } else if (STATE.mode === 'sideBySide') {
        for (let f = 1; f <= 7; f++) {
            floorGroups[f].visible = true;
        }
        STATE.targetPos[1].set(-96, 0, 42);
        STATE.targetPos[2].set(0, 0, 42);
        STATE.targetPos[3].set(96, 0, 42);
        STATE.targetPos[4].set(-54, 0, -45);
        STATE.targetPos[5].set(-18, 0, -45);
        STATE.targetPos[6].set(18, 0, -45);
        STATE.targetPos[7].set(54, 0, -45);
    } else {
        const selectedFloor = parseInt(STATE.mode, 10);
        for (let f = 1; f <= 7; f++) {
            floorGroups[f].visible = (f === selectedFloor);
            if (f === selectedFloor) {
                STATE.targetPos[f].set(0, 0, 0);
                floorGroups[f].position.set(0, 0, 0);
            }
        }
    }

    // Синхронизируем высотную отметку прилегающей территории и дорог (этажи парят в небе на естественной высоте)
    const isSingleFloorMode = (STATE.mode !== 'all' && STATE.mode !== 'slice' && STATE.mode !== 'sideBySide');
    const groundElevationY = isSingleFloorMode ? -((parseInt(STATE.mode, 10) || 1) - 1) * BASE_FLOOR_STEP : 0;
    if (typeof territoryGroup !== 'undefined' && territoryGroup) {
        territoryGroup.position.y = groundElevationY;
    }
    if (typeof roadNetworkGroup !== 'undefined' && roadNetworkGroup) {
        roadNetworkGroup.position.y = groundElevationY;
    }

    // Применяем умную оптимизацию видимости внутренностей
    updateFloorsInteriorVisibility();
    updateLabelsVisibility();
    updateShadows();
    requestRender(45);
}

function updateWallHeights() {
    wallMeshes.forEach(m => {
        if (m.userData && m.userData.isColumn) {
            m.scale.y = STATE.wallHeight;
            m.position.y = STATE.wallHeight / 2;
        } else {
            m.scale.y = STATE.wallHeight + WALL_SINK;
            m.position.y = (STATE.wallHeight - WALL_SINK) / 2;
        }
    });

    doorMeshes.forEach(m => {
        m.scale.y = STATE.wallHeight + WALL_SINK;
        m.position.y = (STATE.wallHeight - WALL_SINK) / 2;
        m.visible = STATE.showDoors;
    });

    stairMeshes.forEach(st => {
        if (!st) return;
        const mesh = st.mesh || st;
        const heightRatio = st.heightRatio !== undefined ? st.heightRatio : 0.22;
        const yOffset = st.yOffset !== undefined ? st.yOffset : 0;
        const stepH = Math.max(0.06, STATE.wallHeight * heightRatio);
        mesh.scale.y = stepH;
        mesh.position.y = (stepH / 2) + yOffset;
    });

    roofMeshes.forEach(r => {
        r.mesh.position.y = STATE.wallHeight + r.thickness / 2;
    });

    labelSprites.forEach(item => {
        item.mesh.position.y = 0.02;
    });

    recalcTargetPositions();
    updateShadows();
    requestRender(45);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (typeof resizeLabelsOverlay === 'function') {
        resizeLabelsOverlay();
    }
    requestRender(20);
}
window.onWindowResize = onWindowResize;
