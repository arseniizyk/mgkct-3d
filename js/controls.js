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
    controls.minDistance = 5;
    controls.maxDistance = 500;
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
    controls.enableRotate = true;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    controls.touches = {
        ONE: is2D ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
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
    if (camToTarget.length() * factor <= controls.maxDistance) {
        camera.position.copy(controls.target).addScaledVector(camToTarget, factor);
        controls.update();
        if (typeof requestRender === 'function') requestRender(25);
    }
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
