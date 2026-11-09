// Разбор начальных URL-параметров (?floor, ?bldg, ?top, ?grid, ?bti, ?debug) и наложение БТИ
function applyInitialUrlAndBtiParams() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('territory') && typeof setTerritoryMode === 'function') {
            setTerritoryMode(urlParams.get('territory') !== '0', false);
        }
        if (urlParams.has('floor') && typeof setMode === 'function') {
            const rawF = urlParams.get('floor');
            if (/^[1-7]$/.test(rawF) || rawF === 'all' || rawF === 'slice' || rawF === 'sideBySide') {
                setMode(rawF, false);
            }
        }
        if (urlParams.has('grid') && urlParams.get('grid') !== '0') {
            STATE.showGrid = true;
        }
        if (urlParams.has('bti') && urlParams.get('bti') !== '0') {
            STATE.showBtiOverlay = true;
        }
        if (urlParams.has('debug') && urlParams.get('debug') !== '0') {
            STATE.showGrid = true;
            STATE.showBtiOverlay = true;
            STATE.debugPlan = true;
        }
        if (urlParams.has('bldg') && typeof setBuildingFilter === 'function') {
            setBuildingFilter(urlParams.get('bldg'), false);
            const bldg = urlParams.get('bldg');
            let cx = getActiveCenterX();
            let cz = getActiveCenterZ();
            let distY = (bldg === 'both') ? 75 : 48;
            let offsetZ = (bldg === 'both') ? 22 : 24;

            if (urlParams.has('top') || urlParams.get('view') === 'top') {
                const EPSILON_GIMBAL = 0.001; // Предотвращение блокировки кардана (Gimbal Lock) камеры
                offsetZ = EPSILON_GIMBAL;
                if (bldg === '3') {
                    cx = 6.2;
                    cz = -37.8;
                    distY = 68;
                } else if (bldg === '4') {
                    cx = 48.6;
                    cz = -42.0;
                    distY = 62;
                } else if (bldg === '1') {
                    cx = 1.0;
                    cz = -2.0;
                    distY = 60;
                } else if (bldg === '2') {
                    cx = 44.2;
                    cz = -5.1;
                    distY = 55;
                }
                // Телецентрическая (орто-эквивалентная) проекция с узким углом обзора (FOV = 6°),
                // устраняющая перспективный завал и трапециевидность стен по краям кадра!
                if (camera) {
                    const fovScale = Math.tan(21 * Math.PI / 180) / Math.tan(3 * Math.PI / 180);
                    camera.fov = 6;
                    camera.far = 2000;
                    camera.updateProjectionMatrix();
                    distY *= fovScale;
                    if (controls) {
                        controls.maxDistance = 1200;
                    }
                }
            }
            if (camera && controls) {
                camera.position.set(cx, distY, cz + offsetZ);
                controls.target.set(cx, 0, cz);
                camera.lookAt(cx, 0, cz);
                if (urlParams.has('top') || urlParams.get('view') === 'top') {
                    controls.minPolarAngle = 0;
                    controls.maxPolarAngle = Math.PI / 2 - 0.01;
                    controls.maxDistance = 1200;
                }
                controls.update();
                STATE.targetCamPos = null;
                STATE.targetControlsCenter = null;
            }
        }
        // Наложение эталонного чертежа БТИ прямо на плоскость пола при ?bti=1 или ?debug=1
        if (STATE.showBtiOverlay && urlParams.has('bldg')) {
            const rawB = parseInt(urlParams.get('bldg'), 10);
            const b = Number.isFinite(rawB) ? rawB : 1;
            const rawF = parseInt(urlParams.get('floor') || (STATE && STATE.mode) || '1', 10);
            const f = Number.isFinite(rawF) ? rawF : 1;
            const btiBounds = {
                1: { x1: -14.0, x2: (f <= 3 ? 20.4 : 16.0), z1: -14.0, z2: 14.0, grp: bldg1FloorGroups[f] },
                2: { x1: 20.4, x2: 68.0, z1: -13.8, z2: 3.5, grp: bldg2FloorGroups[f] },
                3: { x1: -1.6, x2: 14.0, z1: -61.6, z2: -14.0, grp: bldg3FloorGroups[f] },
                4: { x1: 27.8, x2: 69.0, z1: -61.6, z2: -24.4, grp: bldg4FloorGroups[f] }
            }[b];
            if (btiBounds && btiBounds.grp && typeof THREE !== 'undefined' && THREE.TextureLoader) {
                const existing = btiBounds.grp.getObjectByName('bti_overlay_plane');
                if (existing) {
                    btiBounds.grp.remove(existing);
                    if (existing.geometry) existing.geometry.dispose();
                    if (existing.material) {
                        if (existing.material.map) existing.material.map.dispose();
                        existing.material.dispose();
                    }
                }
                const loader = new THREE.TextureLoader();
                const btiUrl = `planning_zip/${encodeURIComponent(`Корпус ${b}`)}/${f}.jpg`;
                loader.load(btiUrl, (tex) => {
                    const bw = btiBounds.x2 - btiBounds.x1;
                    const bd = btiBounds.z2 - btiBounds.z1;
                    const plane = new THREE.Mesh(
                        new THREE.PlaneGeometry(bw, bd),
                        new THREE.MeshBasicMaterial({
                            map: tex,
                            transparent: true,
                            opacity: 0.42,
                            depthWrite: false
                        })
                    );
                    plane.name = 'bti_overlay_plane';
                    plane.rotation.x = -Math.PI / 2;
                    plane.position.set((btiBounds.x1 + btiBounds.x2) / 2, 0.03, (btiBounds.z1 + btiBounds.z2) / 2);
                    btiBounds.grp.add(plane);
                    requestRender(30);
                }, undefined, (err) => {
                    console.warn(`[MGKCT] Не удалось загрузить подложку БТИ (${btiUrl}):`, err);
                });
            }
        }
    } catch (e) {
        console.warn('[MGKCT] URL-параметры: ошибка разбора при инициализации:', e);
    }
}
