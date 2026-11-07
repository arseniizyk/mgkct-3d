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
    if (typeof controls.resetMomentum === 'function') {
        controls.resetMomentum();
    }
    if (controls.sphericalDelta) {
        controls.sphericalDelta.set(0, 0, 0);
    }
    if (controls.panOffset) {
        controls.panOffset.set(0, 0, 0);
    }
}
window.resetControlsMomentum = resetControlsMomentum;

const MAP_BOUNDS = {
    minX: -35.0,
    maxX: 95.0,
    minZ: -85.0,
    maxZ: 40.0
};

function clampCameraBounds() {
    if (!controls || !camera) return;
    if (typeof STATE !== 'undefined' && STATE.mode === 'sideBySide') return;

    // 1. В 2D-режиме или режиме одиночного этажа жестко фиксируем target.y = 0,
    // чтобы камера никогда не проваливалась под плоскость карты
    const isMultiFloor3D = typeof STATE !== 'undefined' && !STATE.is2D && (STATE.mode === 'all' || STATE.mode === 'slice');
    const minTargetY = 0;
    const maxTargetY = isMultiFloor3D ? 25.0 : 0;
    const clampedY = THREE.MathUtils.clamp(controls.target.y, minTargetY, maxTargetY);
    const dy = clampedY - controls.target.y;
    if (Math.abs(dy) > 1e-5) {
        controls.target.y = clampedY;
        camera.position.y += dy;
    }

    // 2. Симметрично ограничиваем горизонтальные границы карты (X и Z),
    // сдвигая и controls.target, и camera.position на одинаковую дельту (dx, dz),
    // чтобы вектор смещения камеры (и угол наклона в 2D/3D) никогда не ломался!
    const clampedX = THREE.MathUtils.clamp(controls.target.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
    const clampedZ = THREE.MathUtils.clamp(controls.target.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);
    const dx = clampedX - controls.target.x;
    const dz = clampedZ - controls.target.z;

    if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
        controls.target.x = clampedX;
        controls.target.z = clampedZ;
        camera.position.x += dx;
        camera.position.z += dz;
    }

    // 3. Гарантируем минимальную высоту камеры над уровнем этажа
    const minCamY = controls.target.y + ((typeof STATE !== 'undefined' && STATE.is2D) ? 10.0 : 0.80);
    if (camera.position.y < minCamY) {
        camera.position.y = minCamY;
    }
}
window.clampCameraBounds = clampCameraBounds;

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

    // Оповещение цикла рендеринга о движении камеры (On-Demand Render) и удержание в границах карты
    let _isClampingBounds = false;
    controls.addEventListener('change', () => {
        if (!_isClampingBounds && (!STATE.targetCamPos && !STATE.targetControlsCenter)) {
            _isClampingBounds = true;
            clampCameraBounds();
            _isClampingBounds = false;
        }
        if (typeof requestRender === 'function') {
            requestRender(20);
        }
    });

    return controls;
}
