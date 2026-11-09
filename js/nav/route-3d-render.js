    function drawRoute3D(routeResult) {
        clearRoute3D();
        if (!routeResult || !routeResult.path || routeResult.path.length < 2) return;

        try {
            const g = NAV_STATE.graph;
            const nodes = routeResult.path.map(id => g.getNode(id));

        // Группируем последовательные отрезки пути по этажам
        const floorSegments = {};
        for (let f = 1; f <= 7; f++) {
            floorSegments[f] = [];
        }

        let currentFloor = nodes[0].floor;
        let currentPoints = [new THREE.Vector3(nodes[0].x, getRouteNodeBaseY(nodes[0]), nodes[0].z)];

        for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];

            if (curr.floor === prev.floor) {
                currentPoints.push(new THREE.Vector3(curr.x, getRouteNodeBaseY(curr), curr.z));
            } else {
                // Завершаем текущий отрезок на этом этаже
                if (currentPoints.length >= 2) {
                    floorSegments[currentFloor].push(currentPoints);
                }
                // Начинаем отрезок на новом этаже
                currentFloor = curr.floor;
                currentPoints = [new THREE.Vector3(curr.x, getRouteNodeBaseY(curr), curr.z)];
            }
        }
        if (currentPoints.length >= 2) {
            floorSegments[currentFloor].push(currentPoints);
        }

        function getOrCreateFloorRouteGroup(floorNum) {
            if (!NAV_STATE.routeFloorGroups[floorNum]) {
                const grp = new THREE.Group();
                grp.name = `routeGroup_floor_${floorNum}`;
                NAV_STATE.routeFloorGroups[floorNum] = grp;
            }
            const rGroup = NAV_STATE.routeFloorGroups[floorNum];
            if (window.floorGroups && window.floorGroups[floorNum]) {
                if (rGroup.parent !== window.floorGroups[floorNum]) {
                    window.floorGroups[floorNum].add(rGroup);
                }
            }
            return rGroup;
        }

        // Лениво рендерим 3D-путь только на тех этажах, где действительно есть геометрия
        for (let f = 1; f <= 7; f++) {
            const segs = floorSegments[f];
            if (segs && segs.length > 0) {
                const rGroup = getOrCreateFloorRouteGroup(f);
                for (const pts of segs) {
                    const mesh = createLuminousRouteMesh(pts);
                    if (mesh) rGroup.add(mesh);
                }
            }
        }

        const indoorRefY = (typeof ROUTE_INDOOR_Y === 'number') ? ROUTE_INDOOR_Y : 0.08;

        // Маркер точки "А" (Откуда / первичный) — небесно-голубой
        const startNode = nodes[0];
        if (startNode) {
            const startGroup = getOrCreateFloorRouteGroup(startNode.floor);
            const startMarker = createMarkerRing(0x38bdf8, 'A', true);
            const startDeltaY = getRouteNodeBaseY(startNode) - indoorRefY;
            startMarker.position.set(startNode.x, 0.05 + startDeltaY, startNode.z);
            startGroup.add(startMarker);
        }

        // Маркер точки "Б" (Куда / конечный) — синий Google Blue
        const destNode = nodes[nodes.length - 1];
        if (destNode) {
            const destGroup = getOrCreateFloorRouteGroup(destNode.floor);
            const destMarker = createMarkerRing(0x1a73e8, 'B', true);
            const destDeltaY = getRouteNodeBaseY(destNode) - indoorRefY;
            destMarker.position.set(destNode.x, 0.05 + destDeltaY, destNode.z);
            destGroup.add(destMarker);
        }

        // Маркеры межэтажных лестничных переходов
        for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];
            if (curr.floor !== prev.floor) {
                const isUp = curr.floor > prev.floor;
                const fg = getOrCreateFloorRouteGroup(prev.floor);
                const stairMarker = createStairTransitionMarker(isUp ? `↑ ${curr.floor} этаж` : `↓ ${curr.floor} этаж`, isUp);
                stairMarker.position.set(prev.x, 0.05, prev.z);
                fg.add(stairMarker);
            }
        }

        // Создаём 3D-лестничные соединители для общего режима 'all'
        if (window.scene) {
            const globalGroup = new THREE.Group();
            globalGroup.name = 'routeGlobalStairConnectors';

            for (let i = 1; i < nodes.length; i++) {
                const prev = nodes[i - 1];
                const curr = nodes[i];
                if (curr.floor !== prev.floor) {
                    const stepH = (typeof STATE !== 'undefined' && STATE.wallHeight) ? (STATE.wallHeight + 0.25) : 2.65;
                    const y1 = stepH * (prev.floor - 1) + 0.14;
                    const y2 = stepH * (curr.floor - 1) + 0.14;

                    const stairPts = [
                        new THREE.Vector3(prev.x, y1, prev.z),
                        new THREE.Vector3((prev.x + curr.x) / 2, (y1 + y2) / 2, (prev.z + curr.z) / 2),
                        new THREE.Vector3(curr.x, y2, curr.z)
                    ];

                    const stairCurve = new THREE.CatmullRomCurve3(stairPts);
                    const stairGeom = new THREE.TubeGeometry(stairCurve, 16, 0.16, 8, false);
                    const stairMat = new THREE.MeshBasicMaterial({
                        color: 0x38bdf8,
                        transparent: true,
                        opacity: 0.95
                    });
                    const stairMesh = new THREE.Mesh(stairGeom, stairMat);
                    globalGroup.add(stairMesh);
                }
            }

            window.scene.add(globalGroup);
            NAV_STATE.globalRouteGroup = globalGroup;
        }

        // Атомарно мутируем состояние активного маршрута строго после успешной генерации 3D-мешей
        NAV_STATE.activeRoute = routeResult;
        updateRouteVisibilityForCurrentMode();
        if (typeof requestRender === 'function') requestRender(30);
    } catch (err) {
        clearRoute3D();
        console.error('Ошибка генерации 3D-маршрута:', err);
    }
}

    // ------------------------------------------------------------------------
    // ОБНОВЛЕНИЕ ВИДИМОСТИ И ЦВЕТА ПУТИ ВО ВСЕХ РЕЖИМАХ ОТОБРАЖЕНИЯ КАРТЫ
    // ------------------------------------------------------------------------
    function updateRouteVisibilityForCurrentMode() {
        if (!NAV_STATE.activeRoute) return;

        const mode = (typeof STATE !== 'undefined') ? STATE.mode : '1';
        const isSingleFloor = (mode !== 'all' && mode !== 'sideBySide' && mode !== 'slice');
        const parsedFloor = parseInt(mode, 10);
        const activeFloor = (isSingleFloor && Number.isFinite(parsedFloor)) ? parsedFloor : 1;
        const maxFloor = (mode === 'slice') ? STATE.sliceMaxFloor : 7;
        const isAllFloors = (mode === 'all');
        const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');

        // Цвет маршрута: при просмотре всех этажей — нейтрально серый, на отдельном этаже — фирменный голубой/синий
        const ribbonColor = isAllFloors ? (isDark ? 0x71717a : 0x94a3b8) : (isDark ? 0x38bdf8 : 0x0284c7);
        const coreColor = isAllFloors ? (isDark ? 0xa1a1aa : 0xe2e8f0) : (isDark ? 0xf0f9ff : 0xffffff);
        const stairColor = isAllFloors ? (isDark ? 0x71717a : 0x94a3b8) : 0x38bdf8;

        for (let f = 1; f <= 7; f++) {
            const rGroup = NAV_STATE.routeFloorGroups[f];
            if (!rGroup) continue;

            if (isSingleFloor) {
                // В режиме одного этажа видна геометрия только выбранного этажа
                rGroup.visible = (f === activeFloor);
            } else if (mode === 'slice') {
                rGroup.visible = (f <= maxFloor);
            } else {
                // 'all' или 'sideBySide'
                rGroup.visible = true;
            }

            // Динамически обновляем цвета полосы маршрута в зависимости от режима всех этажей
            rGroup.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    if (child.userData && child.userData.isRouteRibbonBase) {
                        child.material.color.setHex(ribbonColor);
                    } else if (child.userData && child.userData.isRouteRibbonCore) {
                        child.material.color.setHex(coreColor);
                    }
                }
            });
        }

        if (NAV_STATE.globalRouteGroup) {
            // Межэтажные вертикальные 3D-марши показываем только в общем 3D режиме 'all'
            NAV_STATE.globalRouteGroup.visible = isAllFloors;
            NAV_STATE.globalRouteGroup.traverse(child => {
                if (child.isMesh && child.material && child.material.color) {
                    child.material.color.setHex(stairColor);
                }
            });
        }

        if (typeof requestRender === 'function') requestRender(30);
    }

    // ------------------------------------------------------------------------
    // АНИМАЦИЯ ПУЛЬСАЦИИ И ИМПУЛЬСОВ МАРШРУТА
    // Кэшируем pulsing-объекты при построении маршрута, чтобы не делать traverse
    // на 60 кадрах в секунду по всему дереву сцены.
    // ------------------------------------------------------------------------
    function updateNavigatorAnimation(delta) {
        if (!NAV_STATE.activeRoute) return;

        NAV_STATE.animationTime += (delta || 16) * 0.003;
        const scalePulse = 1.0 + Math.sin(NAV_STATE.animationTime * 4.0) * 0.12;
        const opacityPulse = 0.75 + Math.sin(NAV_STATE.animationTime * 4.0) * 0.25;

        // Если pulsing-маркеры закэшированы при создании — используем кэш.
        if (NAV_STATE._pulsingObjects && NAV_STATE._pulsingObjects.length > 0) {
            for (let i = 0; i < NAV_STATE._pulsingObjects.length; i++) {
                const child = NAV_STATE._pulsingObjects[i];
                // Пропускаем объекты из невидимых групп
                const fg = child.parent;
                if (!fg || !fg.visible) continue;
                if (child.userData.ring) {
                    child.userData.ring.scale.set(scalePulse, scalePulse, scalePulse);
                    if (child.userData.ring.material) {
                        child.userData.ring.material.opacity = opacityPulse;
                    }
                }
                if (child.userData.disk && child.userData.disk.material) {
                    child.userData.disk.material.opacity = 0.25 + opacityPulse * 0.2;
                }
            }
            return;
        }

        // Fallback: наполняем кэш _pulsingObjects один раз, предотвращая 60 обходов дерева в секунду
        if (!NAV_STATE._pulsingObjects) {
            NAV_STATE._pulsingObjects = [];
        }
        for (let f = 1; f <= 7; f++) {
            const rGroup = NAV_STATE.routeFloorGroups[f];
            if (!rGroup) continue;

            rGroup.traverse((child) => {
                if (child.userData && child.userData.isPulsing) {
                    NAV_STATE._pulsingObjects.push(child);
                }
            });
        }
        if (NAV_STATE._pulsingObjects.length > 0) {
            updateNavigatorAnimation(delta);
        }
    }

    // ------------------------------------------------------------------------
    // SCREEN-SPACE RETINA БЕЙДЖИ ДЛЯ ТОЧЕК "А", "Б" И ЛЕСТНИЦ НА 2D CANVAS
    // ------------------------------------------------------------------------

    function checkStairBadgeClick(clientX, clientY) {
        if (!NAV_STATE || !NAV_STATE.activeRoute) return false;
        if (!renderedStairBadges || renderedStairBadges.length === 0) return false;
        const currentFloor = (typeof STATE !== 'undefined' && STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice')
            ? parseInt(STATE.mode, 10)
            : null;
        const hitMargin = 16;
        for (let i = renderedStairBadges.length - 1; i >= 0; i--) {
            const b = renderedStairBadges[i];
            if (currentFloor !== null && b.fromFloor !== currentFloor) continue;
            if (clientX >= b.x0 - hitMargin && clientX <= b.x1 + hitMargin &&
                clientY >= b.y0 - hitMargin && clientY <= b.y1 + hitMargin) {
                if (typeof setMode === 'function') {
                    setMode(String(b.toFloor));
                    if (b.targetNode && typeof focusCameraOnSegment === 'function') {
                        focusCameraOnSegment(b.targetNode);
                    } else if (typeof resolveFloorFocusNode === 'function' && NAV_STATE && NAV_STATE.activeRoute) {
                        const targetNode = resolveFloorFocusNode(NAV_STATE.activeRoute, b.toFloor, currentFloor);
                        if (targetNode && typeof focusCameraOnSegment === 'function') {
                            focusCameraOnSegment(targetNode);
                        }
                    }
                    if (typeof requestRender === 'function') requestRender(35);
                }
                return true;
            }
        }
        return false;
    }

    window.updateRouteVisibilityForCurrentMode = updateRouteVisibilityForCurrentMode;
    window.checkStairBadgeClick = checkStairBadgeClick;
    window.updateNavigatorAnimation = updateNavigatorAnimation;
