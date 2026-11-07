// ==========================================
// СИСТЕМА ON-DEMAND РЕНДЕРИНГА И СНИЖЕНИЯ НАГРУЗКИ (IDLE SLEEP)
// ==========================================
let renderRequested = true;
let framesToRender = 60;
let lastRenderTime = 0;
let frameCounter = 0;

function requestRender(frames = 30) {
    framesToRender = Math.max(framesToRender, frames);
    renderRequested = true;
}
window.requestRender = requestRender;

function updateShadows() {
    if (renderer && renderer.shadowMap && renderer.shadowMap.enabled) {
        renderer.shadowMap.needsUpdate = true;
        requestRender(10);
    }
}

function applyPreset(presetName, shouldSave = true) {
    if (presetName !== 'eco' && presetName !== 'balance' && presetName !== 'ultra') {
        presetName = 'balance';
    }
    STATE.preset = presetName;

    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-preset-' + presetName)?.classList.add('active');

    let shadowSize = 2048;
    let ratio = 1.25;
    let shadowsEnabled = true;

    if (presetName === 'eco') {
        // Минимальная нагрузка для тишины ноута
        shadowSize = 1024;
        ratio = 1.0;
        shadowsEnabled = false;
    } else if (presetName === 'balance') {
        // Оптимальный баланс качества и скорости с поддержкой Retina
        shadowSize = 2048;
        ratio = Math.min(window.devicePixelRatio || 1, 2.0);
        shadowsEnabled = true;
    } else if (presetName === 'ultra') {
        // Максимум детализации (4K / Super Retina)
        shadowSize = 4096;
        ratio = Math.min(window.devicePixelRatio || 1, 3.0);
        shadowsEnabled = true;
    }

    STATE.showShadows = shadowsEnabled;
    const shadowToggle = document.getElementById('toggle-shadows');
    if (shadowToggle) {
        shadowToggle.checked = shadowsEnabled;
    }

    if (renderer) {
        renderer.setPixelRatio(ratio);
        renderer.setSize(window.innerWidth, window.innerHeight);

        if (renderer.shadowMap) {
            renderer.shadowMap.enabled = shadowsEnabled;
        }

        if (dirLight1 && dirLight1.shadow) {
            dirLight1.shadow.mapSize.width = shadowSize;
            dirLight1.shadow.mapSize.height = shadowSize;
            if (dirLight1.shadow.map) {
                dirLight1.shadow.map.dispose();
                dirLight1.shadow.map = null;
            }
        }
        updateShadows();
        requestRender(30);
    }

    if (shouldSave && typeof saveSettings === 'function') {
        saveSettings();
    }
}

animFrameId = null;
window.animFrameId = null;

function animate(currentTime = 0) {
    if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
    }
    animFrameId = requestAnimationFrame(animate);
    window.animFrameId = animFrameId;

    // В фоновой вкладке полностью усыпляем рендерер (0% нагрузки на CPU/GPU)
    if (document.hidden) return;

    // Ограничение частоты кадров (60 FPS стандарт/ультра, 30 FPS в экономичном режиме)
    const targetFps = (STATE.preset === 'eco') ? 30 : 60;
    const interval = 1000 / targetFps;
    const delta = currentTime - lastRenderTime;
    if (lastRenderTime !== 0 && delta < interval - 1) {
        return;
    }

    // 1. Проверяем анимацию этажей (интерполяция)
    let isFloorsMoving = false;
    let shadowNeedsUpdate = false;
    for (let f = 1; f <= 7; f++) {
        if (floorGroups[f] && STATE.targetPos[f]) {
            if (floorGroups[f].position.distanceToSquared(STATE.targetPos[f]) > 0.0001) {
                isFloorsMoving = true;
                floorGroups[f].position.lerp(STATE.targetPos[f], 0.15);
                shadowNeedsUpdate = true;
            } else if (!floorGroups[f].position.equals(STATE.targetPos[f])) {
                floorGroups[f].position.copy(STATE.targetPos[f]);
                isFloorsMoving = true;
                shadowNeedsUpdate = true;
            }
        }
    }
    if (shadowNeedsUpdate && renderer && renderer.shadowMap && renderer.shadowMap.enabled) {
        renderer.shadowMap.needsUpdate = true;
    }

    // 2. Проверяем синхронную анимацию камеры и центра вращения (без конфликта с инерцией OrbitControls)
    let isCamMoving = false;
    if (STATE.targetCamPos || STATE.targetControlsCenter) {
        isCamMoving = true;
        if (typeof resetControlsMomentum === "function") {
            resetControlsMomentum();
        }

        let centerDone = true;
        if (STATE.targetControlsCenter && controls) {
            controls.target.lerp(STATE.targetControlsCenter, 0.18);
            if (controls.target.distanceTo(STATE.targetControlsCenter) < 0.04) {
                controls.target.copy(STATE.targetControlsCenter);
                STATE.targetControlsCenter = null;
            } else {
                centerDone = false;
            }
        }

        let posDone = true;
        if (STATE.targetCamPos) {
            camera.position.lerp(STATE.targetCamPos, 0.18);
            if (camera.position.distanceTo(STATE.targetCamPos) < 0.04) {
                camera.position.copy(STATE.targetCamPos);
                STATE.targetCamPos = null;
            } else {
                posDone = false;
            }
        }

        if (controls) {
            camera.lookAt(controls.target);
        }

        if (centerDone && posDone) {
            STATE.targetCamPos = null;
            STATE.targetControlsCenter = null;
            if (controls) {
                if (typeof resetControlsMomentum === "function") {
                    resetControlsMomentum();
                }
                if (typeof apply2DControls === "function") {
                    apply2DControls(STATE.is2D);
                }
                controls.update();
            }
        }
    } else if (controls) {
        const controlsMoved = controls.update();
        if (controlsMoved) {
            isCamMoving = true;
        }
        if (typeof clampCameraBounds === 'function') {
            clampCameraBounds();
        }
    }

    // 3. Проверяем анимацию маршрута навигатора
    const isRouteActive = (typeof NAV_STATE !== 'undefined' && NAV_STATE.activeRoute);
    if (isRouteActive) {
        if (typeof updateNavigatorAnimation === 'function') {
            updateNavigatorAnimation(delta);
        }
    }

    // Если есть активные движения, запрашиваем продление рендеринга
    if (isFloorsMoving || isCamMoving || isRouteActive) {
        requestRender(5);
    }

    // ON-DEMAND IDLE SLEEP: Если ничего не движется и лимит запрошенных кадров исчерпан — спим!
    // Полное падение нагрузки на CPU/GPU до 0%, устройство не нагревается и не сажает батарею!
    if (framesToRender <= 0 && !isFloorsMoving && !isCamMoving && !isRouteActive) {
        return;
    }

    if (framesToRender > 0) {
        framesToRender--;
    }

    frameCounter++;
    if (frameCounter % 3 === 0) {
        if (STATE.showGuides && isFloorsMoving) {
            updateAlignmentGuides();
        }
        if (STATE.showStairAxes && isFloorsMoving) {
            updateStairValidationAxes();
        }
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
        if (typeof renderScreenSpaceLabels === 'function') {
            renderScreenSpaceLabels();
        }
    }

    lastRenderTime = currentTime - (delta % interval);
}

window.animate = animate;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
