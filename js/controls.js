// ==========================================
// УПРАВЛЕНИЕ КАМЕРОЙ И ЗУМ К ТОЧКЕ КУРСОРА (POINTER ZOOM)
// ==========================================

let raycaster = null;
let mouseVec = null;
let floorPlane = null;
let isCtrlZooming = false;

function initControls(camera, domElement) {
    controls = new THREE.OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 10;
    controls.maxDistance = 115;
    controls.screenSpacePanning = true; // Важно для плавного перемещения карты

    const cx = (typeof getActiveCenterX === 'function') ? getActiveCenterX() : 24.0;
    const cz = (typeof getActiveCenterZ === 'function') ? getActiveCenterZ() : -22.0;
    controls.target.set(cx, 0, cz);

    apply2DControls(STATE.is2D);

    raycaster = new THREE.Raycaster();
    mouseVec = new THREE.Vector2();
    floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Зум к позиции курсора (BIM / CAD Zoom to Pointer)
    domElement.addEventListener('wheel', onPointerZoom, { passive: false });

    // Клик / тап по карте для выбора кабинета
    let pointerDownPos = { x: 0, y: 0 };
    domElement.addEventListener('pointerdown', (e) => {
        // Если была анимация камеры, прерываем её при первом взаимодействии пользователя
        if (STATE.targetCamPos) {
            STATE.targetCamPos = null;
            STATE.targetControlsCenter = null;
            if (controls) controls.update();
        }
        pointerDownPos = { x: e.clientX, y: e.clientY };
    }, { passive: true });

    domElement.addEventListener('pointerup', (e) => {
        const dx = Math.abs(e.clientX - pointerDownPos.x);
        const dy = Math.abs(e.clientY - pointerDownPos.y);
        // Если это был клик/тап (а не свайп/перетаскивание карты)
        if (dx < 6 && dy < 6) {
            handleMapClick(e);
        }
    });

    // Оповещение цикла рендеринга о движении камеры (On-Demand Render)
    controls.addEventListener('change', () => {
        if (typeof requestRender === 'function') {
            requestRender(15);
        }
    });

    return controls;
}

function apply2DControls(is2D) {
    if (!controls) return;
    controls.enableRotate = !is2D;

    // Сбрасываем инерцию демпфирования, чтобы исключить паразитное вращение
    if (controls.sphericalDelta) {
        controls.sphericalDelta.set(0, 0, 0);
    }
    if (controls.panOffset) {
        controls.panOffset.set(0, 0, 0);
    }

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
    const factor = 0.80;
    const camToTarget = camera.position.clone().sub(controls.target);
    if (camToTarget.length() * factor >= controls.minDistance) {
        camera.position.copy(controls.target).addScaledVector(camToTarget, factor);
        controls.update();
        if (typeof requestRender === 'function') requestRender(25);
    }
}

function zoomOut() {
    if (!controls || !camera) return;
    const factor = 1.25;
    const camToTarget = camera.position.clone().sub(controls.target);
    const currDist = camToTarget.length();
    if (currDist >= controls.maxDistance) return;
    const newDist = Math.min(currDist * factor, controls.maxDistance);
    camera.position.copy(controls.target).add(camToTarget.normalize().multiplyScalar(newDist));
    controls.update();
    if (typeof requestRender === 'function') requestRender(25);
}

function handleMapClick(event) {
    if (!renderer || !camera) return;

    // 1. Проверяем попадание в экранные плашки кабинетов (быстро и супер-точно для пальца)
    if (Array.isArray(renderedScreenBadges) && renderedScreenBadges.length > 0) {
        const cx = event.clientX;
        const cy = event.clientY;
        const hitMargin = 8; // Комфортная зона тапа для мобильного
        for (let i = renderedScreenBadges.length - 1; i >= 0; i--) {
            const b = renderedScreenBadges[i];
            if (cx >= b.x0 - hitMargin && cx <= b.x1 + hitMargin &&
                cy >= b.y0 - hitMargin && cy <= b.y1 + hitMargin) {
                if (typeof selectRoom === 'function') {
                    selectRoom(b.room);
                }
                return;
            }
        }
    }

    // 2. Иначе 3D Raycasting
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const clickRaycaster = new THREE.Raycaster();
    clickRaycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const labelMeshes = labelSprites.map(l => l.mesh);
    const intersects = clickRaycaster.intersectObjects(labelMeshes, false);

    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        if (hitMesh.userData && hitMesh.userData.roomInfo) {
            if (typeof selectRoom === 'function') {
                selectRoom(hitMesh.userData.roomInfo);
            }
        }
    }
}

function onPointerZoom(event) {
    if (!controls || !camera) return;

    // Предотвращаем дефолтный скролл страницы
    event.preventDefault();

    const domElement = renderer.domElement;
    const rect = domElement.getBoundingClientRect();
    mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouseVec, camera);

    // Оптимизация: проверяем пересечение только с плитами перекрытий этажей (быстро, O(1))
    // вместо тяжелого рекурсивного обхода всех тысяч мешей сцены
    const targets = Array.isArray(slabMeshes) && slabMeshes.length > 0 ? slabMeshes : scene.children;
    const intersects = raycaster.intersectObjects(targets, false);
    let hitPoint = null;

    for (let i = 0; i < intersects.length; i++) {
        const hit = intersects[i];
        if (hit.object && hit.object.visible && hit.point) {
            hitPoint = hit.point.clone();
            break;
        }
    }

    // Если курсор смотрит мимо геометрии модели, берем пересечение с горизонтальной плоскостью на высоте таргета
    if (!hitPoint) {
        floorPlane.constant = -controls.target.y;
        const pt = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(floorPlane, pt)) {
            hitPoint = pt;
        }
    }

    if (hitPoint) {
        // Коэффициент зума: чувствительный и плавный
        const zoomIn = event.deltaY < 0;
        const factor = zoomIn ? 0.86 : 1.16;

        // Вектор от точки под курсором к камере и таргету
        const camToHit = camera.position.clone().sub(hitPoint);
        const targetToHit = controls.target.clone().sub(hitPoint);

        const newDist = camToHit.length() * factor;

        if (newDist >= controls.minDistance && newDist <= controls.maxDistance) {
            // Приближаем камеру вдоль луча к точке под курсором
            camera.position.copy(hitPoint).addScaledVector(camToHit, factor);
            
            // Также плавно смещаем фокусную точку таргета в сторону курсора
            controls.target.copy(hitPoint).addScaledVector(targetToHit, factor);

            if (typeof requestRender === 'function') {
                requestRender(20);
            }
        }
    }
}
