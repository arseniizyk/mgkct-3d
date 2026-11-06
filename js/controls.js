// ==========================================
// УПРАВЛЕНИЕ КАМЕРОЙ И ЗУМ К ТОЧКЕ КУРСОРА (POINTER ZOOM)
// ==========================================

// Независимые рейкастеры и векторы для предотвращения взаимной мутации состояния
const _pickRaycaster = new THREE.Raycaster();
const _pickMouseVec = new THREE.Vector2();

const _zoomRaycaster = new THREE.Raycaster();
const _zoomMouseVec = new THREE.Vector2();
const _zoomFloorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _zoomHitVec = new THREE.Vector3();
const _zoomCamOffset = new THREE.Vector3();
const _zoomTargetOffset = new THREE.Vector3();

let isCtrlZooming = false;
let lastZoomTime = -Infinity;
let _cachedControlsDomRect = null;
let _lastControlsDomRectTime = 0;
if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => { _cachedControlsDomRect = null; }, { passive: true });
    window.addEventListener('scroll', () => { _cachedControlsDomRect = null; }, { passive: true });
}

function resetControlsMomentum() {
    if (!controls) return;
    if (controls.sphericalDelta) {
        controls.sphericalDelta.set(0, 0, 0);
    }
    if (controls.panOffset) {
        controls.panOffset.set(0, 0, 0);
    }
}
window.resetControlsMomentum = resetControlsMomentum;

function resetControlsState(resetCamera = false) {
    isCtrlZooming = false;
    lastZoomTime = -Infinity;
    _cachedControlsDomRect = null;
    resetControlsMomentum();
    if (resetCamera && controls && typeof controls.reset === 'function') {
        controls.reset();
    }
}
window.resetControlsState = resetControlsState;

function initControls(camera, domElement) {
    controls = new THREE.OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.18; // Более быстрый и отзывчивый отклик (было 0.08)
    controls.zoomSpeed = 0.85;     // Контролируемый щипок без гиперчувствительности
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 10;
    controls.maxDistance = 115;
    controls.screenSpacePanning = false; // Важно: строго горизонтальное перемещение по полу (XZ) без дрейфа высоты
    controls.enableZoom = true; // Оставляем включенным для стабильного двухпальцевого pinch-зума на смартфонах

    const cx = (typeof getActiveCenterX === 'function') ? getActiveCenterX() : 24.0;
    const cz = (typeof getActiveCenterZ === 'function') ? getActiveCenterZ() : -22.0;
    controls.target.set(cx, 0, cz);

    controls.resetState = resetControlsState;
    apply2DControls(STATE.is2D);

    // Зум к позиции курсора (BIM / CAD Zoom to Pointer) перехватываем в фазе захвата (capture),
    // чтобы изолировать колесико мыши от OrbitControls и исключить двойной зум
    domElement.addEventListener('wheel', onPointerZoom, { passive: false, capture: true });

    // Отслеживание мультитач-жестов и зума: полностью исключаем случайные клики по кабинетам
    // при двухпальцевом pinch-зуме, панорамировании и зуме колесиком
    let activeTouches = 0;
    let multiTouchActive = false;
    let lastMultiTouchTime = -Infinity;
    const MULTI_TOUCH_GUARD_MS = 450; // Окно блокировки ложных кликов после pinch-зума
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;
    const pointerDownCamPos = new THREE.Vector3();
    const pointerDownTarget = new THREE.Vector3();

    domElement.addEventListener('touchstart', (e) => {
        activeTouches = e.touches ? e.touches.length : 0;
        if (controls) controls.dampingFactor = 0.24;
        if (activeTouches >= 2) {
            multiTouchActive = true;
            lastMultiTouchTime = performance.now();
        }
        if (STATE.targetCamPos || STATE.targetControlsCenter) {
            STATE.targetCamPos = null;
            STATE.targetControlsCenter = null;
            resetControlsMomentum();
            if (controls) controls.update();
        }
    }, { passive: true });

    domElement.addEventListener('touchmove', (e) => {
        activeTouches = e.touches ? e.touches.length : 0;
        if (activeTouches >= 2) {
            multiTouchActive = true;
            lastMultiTouchTime = performance.now();
        }
    }, { passive: true });

    domElement.addEventListener('touchend', (e) => {
        activeTouches = e.touches ? e.touches.length : 0;
        if (controls) controls.dampingFactor = 0.12;
        if (multiTouchActive || activeTouches > 0) {
            lastMultiTouchTime = performance.now();
        }
        if (activeTouches === 0) {
            lastMultiTouchTime = performance.now();
            setTimeout(() => {
                if (activeTouches === 0) {
                    multiTouchActive = false;
                }
            }, MULTI_TOUCH_GUARD_MS);
        }
    }, { passive: true });

    domElement.addEventListener('touchcancel', () => {
        activeTouches = 0;
        multiTouchActive = false;
        if (controls) controls.dampingFactor = 0.12;
        lastMultiTouchTime = performance.now();
    }, { passive: true });

    // Клик / тап по карте для выбора кабинета
    domElement.addEventListener('pointerdown', (e) => {
        if (STATE.targetCamPos || STATE.targetControlsCenter) {
            STATE.targetCamPos = null;
            STATE.targetControlsCenter = null;
            resetControlsMomentum();
            if (controls) controls.update();
        }
        if (e.isPrimary !== false) {
            pointerDownPos = { x: e.clientX, y: e.clientY };
            pointerDownTime = performance.now();
            if (camera && controls) {
                pointerDownCamPos.copy(camera.position);
                pointerDownTarget.copy(controls.target);
            }
        }
    }, { passive: true });

    domElement.addEventListener('pointerup', (e) => {
        // 1. Игнорируем вторичные пальцы / указатели
        if (e.isPrimary === false) {
            return;
        }

        // 2. Блокируем клик, если активен или недавно завершился pinch-зум двумя пальцами
        if (multiTouchActive || (performance.now() - lastMultiTouchTime < MULTI_TOUCH_GUARD_MS)) {
            return;
        }

        // 3. Блокируем клик, если недавно происходил зум к курсору колесиком или кнопками
        if (performance.now() - lastZoomTime < 350) {
            return;
        }

        // 4. Отсекаем долгое удержание пальца (жест панорамирования или ожидания, а не быстрый тап)
        const holdDuration = performance.now() - pointerDownTime;
        if (holdDuration > 550) {
            return;
        }

        // 5. Проверяем физическое смещение курсора на экране
        const dx = Math.abs(e.clientX - pointerDownPos.x);
        const dy = Math.abs(e.clientY - pointerDownPos.y);
        if (Math.hypot(dx, dy) >= 12) {
            return;
        }

        // 6. Физическая проверка: если камера сдвинулась или масштабировалась во время касания,
        // значит выполнялся зум или сдвиг сцены
        if (camera && controls) {
            const camDistMoved = camera.position.distanceTo(pointerDownCamPos);
            const targetDistMoved = controls.target.distanceTo(pointerDownTarget);
            if (camDistMoved > 0.25 || targetDistMoved > 0.25) {
                return;
            }
        }

        // Чистый одиночный клик / тап по карте
        handleMapClick(e);
    });

    // Оповещение цикла рендеринга о движении камеры (On-Demand Render)
    controls.addEventListener('change', () => {
        if (typeof requestRender === 'function') {
            requestRender(20);
        }
    });

    return controls;
}

function apply2DControls(is2D) {
    if (!controls) return;
    controls.enableRotate = !is2D;

    // Сбрасываем инерцию демпфирования, чтобы исключить паразитное вращение
    resetControlsMomentum();

    // В 2D (вид строго сверху) screenSpacePanning=true обязателен:
    // иначе вертикальное панорамирование карты будет заблокировано или нелинейно.
    controls.screenSpacePanning = is2D;

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
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
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
    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        if (hitMesh.userData && hitMesh.userData.roomInfo) {
            return hitMesh.userData.roomInfo;
        }
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

    // Гарантируем, что target.y строго лежит на плоскости этажа
    controls.target.y = activeFloorY;

    // Ограничиваем смещение target границами территории колледжа, чтобы не потерять карту
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -35.0, 95.0);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -80.0, 35.0);

    // Ограничиваем минимальную высоту камеры над полом
    const minCamY = activeFloorY + (STATE.is2D ? 10.0 : 0.80);
    if (camera.position.y < minCamY) {
        camera.position.y = minCamY;
    }

    // Синхронизируем OrbitControls
    controls.update();

    if (typeof requestRender === 'function') {
        requestRender(20);
    }
}
