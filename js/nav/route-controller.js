    function buildRoute(startPoint, destPoint) {
        if (typeof hideRoomContextPopup === 'function') {
            hideRoomContextPopup(true, true);
        }
        if (!NAV_STATE.graph) {
            NAV_STATE.graph = buildCollegeNavGraph();
        }

        const g = NAV_STATE.graph;
        if (!startPoint || !destPoint) return null;

        const result = aStarPath(g, startPoint.id, destPoint.id);
        if (!result || !result.path || result.path.length < 2) {
            return null;
        }

        const nodes = result.path.map(id => g.getNode(id));
        const instructions = generateRouteInstructions(g, result.path);

        // Находим все этажи, задействованные в маршруте
        const floorSet = new Set(nodes.map(n => n.floor));
        const involvedFloors = Array.from(floorSet).sort((a, b) => a - b);

        // Находим переходы по лестницам
        const stairTransitions = [];
        for (let i = 1; i < nodes.length; i++) {
            const prev = nodes[i - 1];
            const curr = nodes[i];
            if (curr.floor !== prev.floor) {
                stairTransitions.push({
                    fromFloor: prev.floor,
                    toFloor: curr.floor,
                    x: prev.x,
                    z: prev.z,
                    isUp: curr.floor > prev.floor,
                    stairName: prev.label
                });
            }
        }

        // Оценка времени пешком (скорость ~1.15 м/с) + 45 сек на каждый межэтажный лестничный переход
        const stairDelaySec = (stairTransitions ? stairTransitions.length : 0) * 45;
        const totalWalkSec = (result.totalDistance / 1.15) + stairDelaySec;
        const durationMin = Math.max(1, Math.round((totalWalkSec / 60) * 10) / 10);

        const routeData = {
            path: result.path,
            nodes,
            startNode: nodes[0],
            destNode: nodes[nodes.length - 1],
            totalDistance: Math.round(result.totalDistance),
            durationMin,
            instructions,
            involvedFloors,
            stairTransitions
        };

        NAV_STATE.startPoint = startPoint;
        NAV_STATE.destPoint = destPoint;

        // 1. Корпус: если маршрут охватывает корпус, который сейчас скрыт фильтром, переключаем фильтр на 'both'
        const bldgSet = new Set(nodes.map(n => n.bldg));
        if (bldgSet.size > 1 && typeof setBuildingFilter === 'function' && STATE.buildingFilter !== 'both') {
            setBuildingFilter('both', false);
        } else if (startPoint.bldg && typeof setBuildingFilter === 'function' && STATE.buildingFilter !== 'both' && String(STATE.buildingFilter) !== String(startPoint.bldg)) {
            setBuildingFilter(String(startPoint.bldg), false);
        }

        // 2. Этаж: переключаем этаж карты на этаж отправления ДО отрисовки UI карточки и сцены
        const startFloor = String(startPoint.floor || (nodes[0] ? nodes[0].floor : 1));
        if (typeof setMode === 'function') {
            setMode(startFloor, false);
        }

        // 3. Отрисовка в 3D (атомарно устанавливает NAV_STATE.activeRoute при успехе)
        drawRoute3D(routeData);
        if (!NAV_STATE.activeRoute) {
            return null;
        }

        if (typeof pushOverlayState === 'function') {
            pushOverlayState('route');
        }

        // 4. Обновление UI карточки маршрута (STATE.mode уже гарантированно равен startFloor!)
        updateRouteCardUI(routeData);

        // 5. Фокусируем камеру на начальном отрезке пути
        focusCameraOnSegment(nodes[0]);

        return routeData;
    }

    function focusCameraOnSegment(node) {
        if (!node || typeof THREE === 'undefined') return;
        if (typeof resetControlsMomentum === 'function') {
            resetControlsMomentum();
        }

        const targetY = (STATE && STATE.is2D) ? 38 : 28;
        const camZOffset = (STATE && STATE.is2D) ? 14 : 30;
        const camXOffset = (STATE && STATE.is2D) ? 0 : -14;

        if (!STATE.targetControlsCenter) STATE.targetControlsCenter = new THREE.Vector3();
        STATE.targetControlsCenter.set(node.x, 0, node.z);

        if (!STATE.targetCamPos) STATE.targetCamPos = new THREE.Vector3();
        STATE.targetCamPos.set(node.x + camXOffset, targetY, node.z + camZOffset);

        if (typeof requestRender === 'function') requestRender(45);
    }

    // ------------------------------------------------------------------------
    // ОБРАБОТКА КЛИКОВ ПО КАРТЕ ДЛЯ ВЫБОРА ТОЧЕК МАРШРУТА И ЛЕСТНИЦ
    // ------------------------------------------------------------------------
    function applyRoomToActiveRoute(roomInfo, targetType = 'dest') {
        if (!roomInfo) return;
        if (typeof hideRoomContextPopup === 'function') {
            hideRoomContextPopup(true, true);
        }
        const g = NAV_STATE.graph || buildCollegeNavGraph();
        NAV_STATE.graph = g;

        // Находим соответствующий узел в графе с учетом погрешности координат
        let matchedNodeId = null;
        for (const [nid, n] of g.nodes.entries()) {
            if (n.floor === roomInfo.floor && n.bldg === roomInfo.building &&
                Math.hypot(n.x - roomInfo.x, n.z - roomInfo.z) < 0.20) {
                matchedNodeId = nid;
                break;
            }
        }

        if (!matchedNodeId) {
            const closest = g.findClosestNode(roomInfo.floor, roomInfo.building, roomInfo.x, roomInfo.z);
            if (closest) matchedNodeId = closest.id;
        }

        const pointData = {
            id: matchedNodeId,
            text: roomInfo.text ? roomInfo.text.replace(/\n/g, ' ').trim() : 'Кабинет',
            floor: roomInfo.floor,
            building: roomInfo.building,
            x: roomInfo.x,
            z: roomInfo.z
        };

        if (targetType === 'start') {
            NAV_STATE.startPoint = pointData;
            const inputA = document.getElementById('nav-input-start');
            if (inputA) {
                inputA.value = formatNavInputString(pointData);
                inputA.removeAttribute('data-is-default');
            }
            const btnClearA = document.getElementById('btn-clear-start');
            if (btnClearA) btnClearA.classList.remove('hidden');
        } else {
            NAV_STATE.destPoint = pointData;
            const inputB = document.getElementById('nav-input-dest');
            if (inputB) inputB.value = formatNavInputString(pointData);
            const btnClearB = document.getElementById('btn-clear-dest');
            if (btnClearB) btnClearB.classList.remove('hidden');
        }

        if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
            buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
        }

        hidePickBanner();
    }

    function handleNavigatorMapClick(event, preHitRoom = null) {
        // 1. Проверяем клик по экранному бейджу лестницы маршрута на карте
        if (checkStairBadgeClick(event.clientX, event.clientY)) {
            return true;
        }

        // 2. Стандартный режим pickingMode из модалки навигатора
        if (NAV_STATE.pickingMode) {
            if (preHitRoom) {
                onLocationPicked(preHitRoom);
                return true;
            }

            // Если есть бейдж кабинета под курсором
            if (Array.isArray(window.renderedScreenBadges) && window.renderedScreenBadges.length > 0) {
                const cx = event.clientX;
                const cy = event.clientY;
                const hitMargin = 14;

                for (let i = window.renderedScreenBadges.length - 1; i >= 0; i--) {
                    const b = window.renderedScreenBadges[i];
                    if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
                        cy >= b.y0 - hitMargin && cy <= b.y1 + hitMargin) {
                        onLocationPicked(b.room);
                        return true;
                    }
                }
            }

            return true;
        }

        // 3. Если маршрут активен и пользователь явно меняет точку маршрута (targetToChange)
        if (NAV_STATE.activeRoute && NAV_STATE.targetToChange) {
            let hitRoom = preHitRoom;
            if (!hitRoom && Array.isArray(window.renderedScreenBadges) && window.renderedScreenBadges.length > 0) {
                const cx = event.clientX;
                const cy = event.clientY;
                const hitMargin = 14;
                for (let i = window.renderedScreenBadges.length - 1; i >= 0; i--) {
                    const b = window.renderedScreenBadges[i];
                    if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
                        cy >= b.y0 - hitMargin && cy <= b.y1 + hitMargin) {
                        hitRoom = b.room;
                        break;
                    }
                }
            }
            if (hitRoom) {
                const targetType = NAV_STATE.targetToChange || 'dest';
                applyRoomToActiveRoute(hitRoom, targetType);
                NAV_STATE.targetToChange = null;
                hidePickBanner();
                if (typeof closeSearch === 'function') closeSearch(true);
                return true;
            }
        }

        return false;
    }

    function onLocationPicked(roomInfo) {
        const mode = NAV_STATE.pickingMode;
        NAV_STATE.pickingMode = null;

        const banner = document.getElementById('nav-pick-banner');
        if (banner) banner.classList.add('hidden');

        const g = NAV_STATE.graph || buildCollegeNavGraph();
        NAV_STATE.graph = g;

        // Находим соответствующий узел комнаты в графе с учетом погрешности координат
        let matchedNodeId = null;
        for (const [nid, n] of g.nodes.entries()) {
            if (n.floor === roomInfo.floor && n.bldg === roomInfo.building &&
                Math.hypot(n.x - roomInfo.x, n.z - roomInfo.z) < 0.20) {
                matchedNodeId = nid;
                break;
            }
        }

        if (!matchedNodeId) {
            // Если точный узел комнаты не найден, ищем ближайший узел коридора/двери
            const closest = g.findClosestNode(roomInfo.floor, roomInfo.building, roomInfo.x, roomInfo.z);
            if (closest) matchedNodeId = closest.id;
        }

        const pointData = {
            id: matchedNodeId,
            text: roomInfo.text ? roomInfo.text.replace(/\n/g, ' ').trim() : 'Кабинет',
            floor: roomInfo.floor,
            building: roomInfo.building,
            x: roomInfo.x,
            z: roomInfo.z
        };

        if (mode === 'start') {
            NAV_STATE.startPoint = pointData;
            const inputA = document.getElementById('nav-input-start');
            if (inputA) {
                inputA.value = formatNavInputString(pointData);
                inputA.removeAttribute('data-is-default');
            }
            const btnClearA = document.getElementById('btn-clear-start');
            if (btnClearA) btnClearA.classList.remove('hidden');
        } else if (mode === 'dest') {
            NAV_STATE.destPoint = pointData;
            const inputB = document.getElementById('nav-input-dest');
            if (inputB) inputB.value = formatNavInputString(pointData);
            const btnClearB = document.getElementById('btn-clear-dest');
            if (btnClearB) btnClearB.classList.remove('hidden');
        }

        // Если обе точки выбраны, строим маршрут
        if (NAV_STATE.startPoint && NAV_STATE.destPoint) {
            buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
            closeNavigatorModal();
        } else {
            openNavigatorModal();
        }
    }

    window.buildRoute = buildRoute;
    window.applyRoomToActiveRoute = applyRoomToActiveRoute;
    window.handleNavigatorMapClick = handleNavigatorMapClick;
