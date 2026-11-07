function apply2DControls(is2D) {
    if (!controls) return;
    controls.enableRotate = !is2D;

    // Сбрасываем инерцию демпфирования, чтобы исключить паразитное вращение
    resetControlsMomentum();

    // Всегда держим screenSpacePanning = false:
    // тогда panUp перемещает камеру строго в горизонтальной плоскости пола (XZ) без ухода target.y под землю!
    controls.screenSpacePanning = false;

    if (is2D) {
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        controls.touches = {
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        // Жестко блокируем азимут на Север (0) — любое вращение в 2D физически исключено
        controls.minAzimuthAngle = 0;
        controls.maxAzimuthAngle = 0;

        // Жестко фиксируем полярный угол 2D-режима, чтобы 2D никогда не заваливался в 3D
        if (camera && controls.target) {
            const dx = camera.position.x - controls.target.x;
            const dy = Math.max(10.0, camera.position.y - controls.target.y);
            const dz = camera.position.z - controls.target.z;
            const radius = Math.hypot(dx, dy, dz);
            const phi2D = radius > 0.001 ? Math.acos(THREE.MathUtils.clamp(dy / radius, -1, 1)) : 0.31;
            const safePhi = THREE.MathUtils.clamp(phi2D, 0.001, 0.42);
            controls.minPolarAngle = safePhi;
            controls.maxPolarAngle = safePhi;
        } else {
            controls.minPolarAngle = 0.31;
            controls.maxPolarAngle = 0.31;
        }

        // Фиксация максимального отдаления в 2D для защиты от мерцания и сливания иконок
        controls.maxDistance = 110;
        controls.minDistance = 12;
    } else {
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        controls.touches = {
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_ROTATE
        };
        controls.minAzimuthAngle = -Infinity;
        controls.maxAzimuthAngle = Infinity;
        controls.minPolarAngle = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.02;

        controls.maxDistance = 125;
        controls.minDistance = 10;
    }
}

function zoomIn() {
    if (!controls || !camera) return;
    lastZoomTime = performance.now();
    STATE.targetCamPos = null;
    STATE.targetControlsCenter = null;
    resetControlsMomentum();
    const factor = 0.80;
    _zoomCamOffset.subVectors(camera.position, controls.target);
    if (_zoomCamOffset.length() * factor >= controls.minDistance) {
        camera.position.copy(controls.target).addScaledVector(_zoomCamOffset, factor);
        controls.update();
        if (typeof requestRender === 'function') requestRender(25);
    }
}

function zoomOut() {
    if (!controls || !camera) return;
    lastZoomTime = performance.now();
    STATE.targetCamPos = null;
    STATE.targetControlsCenter = null;
    resetControlsMomentum();
    const factor = 1.25;
    _zoomCamOffset.subVectors(camera.position, controls.target);
    const currDist = _zoomCamOffset.length();
    if (currDist >= controls.maxDistance) return;
    const newDist = Math.min(currDist * factor, controls.maxDistance);
    camera.position.copy(controls.target).add(_zoomCamOffset.normalize().multiplyScalar(newDist));
    controls.update();
    if (typeof requestRender === 'function') requestRender(25);
}

function findRoomAtScreenPoint(clientX, clientY) {
    // 1. Проверяем попадание в экранные плашки кабинетов (интеллектуальный поиск ближайшего центра)
    if (Array.isArray(renderedScreenBadges) && renderedScreenBadges.length > 0) {
        const hitMargin = 14; // Комфортная зона тапа для мобильного (большой палец)
        let bestBadge = null;
        let bestDist = Infinity;

        for (let i = 0; i < renderedScreenBadges.length; i++) {
            const b = renderedScreenBadges[i];
            if (clientX >= b.x0 - hitMargin && clientX <= b.x1 + hitMargin &&
                clientY >= b.y0 - hitMargin && clientY <= b.y1 + hitMargin) {
                const midX = (b.x0 + b.x1) / 2;
                const midY = (b.y0 + b.y1) / 2;
                const dist = Math.hypot(clientX - midX, clientY - midY);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestBadge = b;
                }
            }
        }

        if (bestBadge && bestBadge.room) {
            return bestBadge.room;
        }
    }

    // 2. Иначе 3D Raycasting по плоскостям плашек видимого этажа
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    _pickMouseVec.set(x, y);
    _pickRaycaster.setFromCamera(_pickMouseVec, camera);

    const activeFloor = (STATE.mode !== 'all' && STATE.mode !== 'sideBySide' && STATE.mode !== 'slice')
        ? parseInt(STATE.mode, 10)
        : null;

    const visibleLabelMeshes = labelSprites
        .filter(l => {
            if (!l.mesh) return false;
            if (activeFloor !== null && l.floor !== activeFloor) return false;
            let p = l.mesh.parent;
            while (p) {
                if (p.visible === false) return false;
                p = p.parent;
            }
            return true;
        })
        .map(l => l.mesh);

    const intersects = _pickRaycaster.intersectObjects(visibleLabelMeshes, false);
    for (let i = 0; i < intersects.length; i++) {
        const hitMesh = intersects[i].object;
        const rInfo = hitMesh && hitMesh.userData ? hitMesh.userData.roomInfo : null;
        if (!rInfo) continue;
        if (!STATE.is2D && typeof isPointOccludedIn3D === 'function') {
            const fg = floorGroups[rInfo.floor];
            const occlY = (fg ? fg.position.y : 0) + Math.min(Math.max(STATE.wallHeight * 0.75, 0.25), 1.35);
            const wx = (fg ? fg.position.x : 0) + rInfo.x;
            const wz = (fg ? fg.position.z : 0) + rInfo.z;
            if (isPointOccludedIn3D(wx, occlY, wz, rInfo.floor, rInfo.building, false)) {
                continue;
            }
        }
        return rInfo;
    }

    return null;
}
window.findRoomAtScreenPoint = findRoomAtScreenPoint;

function handleMapClick(event) {
    if (!renderer || !camera) return;

    // Гасим любую паразитную инерцию от микросдвига пальца при тапе
    resetControlsMomentum();

    const hitRoom = findRoomAtScreenPoint(event.clientX, event.clientY);

    // 0. Режим выбора точки на карте в навигаторе
    if (typeof handleNavigatorMapClick === 'function' && handleNavigatorMapClick(event, hitRoom)) {
        return;
    }

    if (hitRoom) {
        if (typeof showRoomContextPopup === 'function') {
            showRoomContextPopup(hitRoom, event.clientX, event.clientY);
        } else if (typeof selectRoom === 'function') {
            selectRoom(hitRoom);
        }
        return;
    }

    // Если кликнули мимо кабинетов — закрываем всплывающий попап
    if (typeof hideRoomContextPopup === 'function') {
        hideRoomContextPopup();
    }
}

function onPointerZoom(event) {
    if (!controls || !camera || !renderer) return;
    lastZoomTime = performance.now();

    // Предотвращаем дефолтный скролл страницы и блокируем стандартный зум колесиком в OrbitControls
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    STATE.targetCamPos = null;
    STATE.targetControlsCenter = null;
    resetControlsMomentum();

    const domElement = renderer.domElement;
    const now = performance.now();
    if (!_cachedControlsDomRect || (now - _lastControlsDomRectTime > 200)) {
        _cachedControlsDomRect = domElement.getBoundingClientRect();
        _lastControlsDomRectTime = now;
    }
    const rect = _cachedControlsDomRect;
    _zoomMouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _zoomMouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    _zoomRaycaster.setFromCamera(_zoomMouseVec, camera);

    const activeFloorY = (controls.target && !isNaN(controls.target.y)) ? controls.target.y : 0;
    _zoomFloorPlane.constant = -activeFloorY;

    // Ищем точку пересечения луча курсора с плоскостью этажа
    let hitPoint = null;
    if (_zoomRaycaster.ray.intersectPlane(_zoomFloorPlane, _zoomHitVec)) {
        // Проверяем, что точка находится в пределах территории колледжа, а не на горизонте
        const campusCx = (typeof getActiveCenterX === 'function') ? getActiveCenterX() : 16.0;
        const campusCz = (typeof getActiveCenterZ === 'function') ? getActiveCenterZ() : -18.0;
        if (Math.hypot(_zoomHitVec.x - campusCx, _zoomHitVec.z - campusCz) < 350) {
            hitPoint = _zoomHitVec;
        }
    }

    // Если курсор смотрит в бесконечность или мимо кампуса, зумируем относительно текущего центра
    if (!hitPoint) {
        _zoomHitVec.copy(controls.target);
        _zoomHitVec.y = activeFloorY;
        hitPoint = _zoomHitVec;
    }

    const zoomIn = event.deltaY < 0;
    let factor = zoomIn ? 0.85 : 1.18;

    // Корректная проверка дистанции до цели (controls.target)
    const currentDist = camera.position.distanceTo(controls.target);
    const targetDist = currentDist * factor;

    const minD = controls.minDistance || 10;
    const maxD = controls.maxDistance || 115;

    if (targetDist < minD) {
        factor = minD / currentDist;
    } else if (targetDist > maxD) {
        factor = maxD / currentDist;
    }

    if (Math.abs(factor - 1.0) < 0.001) {
        return; // Достигнут лимит приближения/отдаления
    }

    // Зум к точке курсора: точка hitPoint на экране остаётся неподвижной
    _zoomCamOffset.subVectors(camera.position, hitPoint).multiplyScalar(factor);
    _zoomTargetOffset.subVectors(controls.target, hitPoint).multiplyScalar(factor);

    camera.position.addVectors(hitPoint, _zoomCamOffset);
    controls.target.addVectors(hitPoint, _zoomTargetOffset);

    // Гарантируем, что target.y строго лежит на плоскости этажа, и симметрично ограничиваем границы
    controls.target.y = activeFloorY;
    clampCameraBounds();

    // Синхронизируем OrbitControls
    controls.update();

    if (typeof requestRender === 'function') {
        requestRender(20);
    }
}
