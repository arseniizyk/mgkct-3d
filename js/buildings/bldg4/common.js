(function() {
    'use strict';

// ==========================================
// КОРПУС 4 (Этажи 1–3 + переходы) — ИСПРАВЛЕННАЯ ГЕОМЕТРИЯ ПО НАЛОЖЕНИЮ ПЛАНОВ БТИ
// ==========================================

        // Координатная сетка Корпуса 4 (единые сквозные шахты лестниц для 1, 2 и 3 этажей)
        const B4_X_S_EAST = 66.0;  // Единый восточный край спортзала 206 и зала 102 / 204 (на одной линии с ЛК №3)
        const B4_X_S_GYM = B4_X_S_EAST;
        const B4_X_S_HALL = B4_X_S_EAST;

        // Единая сетка 14 колонн спортзала 206:
        // На 1-м этаже они стоят на улице и держат нависающий 2-й этаж, а на 2-м и 3-м этажах идут внутри стен спортзала 206
        const B4_GYM_COLUMNS = [
            // Западная сторона спортзала (X = 32.4)
            { x: 32.65, z: -59.2 },
            { x: 32.65, z: -55.8 },
            { x: 32.65, z: -52.5 },
            // Северная стена спортзала (Z = -61.6) — 8 колонн по плану
            { x: 32.65, z: -61.35 },
            { x: 37.4,  z: -61.35 },
            { x: 42.2,  z: -61.35 },
            { x: 46.9,  z: -61.35 },
            { x: 51.7,  z: -61.35 },
            { x: 56.5,  z: -61.35 },
            { x: 61.2,  z: -61.35 },
            { x: 65.75, z: -61.35 },
            // Восточная сторона спортзала (X = 66.0)
            { x: 65.75, z: -58.4 },
            { x: 65.75, z: -55.0 },
            { x: 65.75, z: -51.8 }
        ];

        // Двухмаршевая лестница для Корпуса 4 (поддерживает продольную и поперечную ориентацию маршей)
        function buildB4Staircase(targetGroup, x1, x2, z1, z2, alongZ = true) {
            const steps = 9;

            if (alongZ) {
                const xMid = (x1 + x2) / 2;
                const zStart = z1 + 0.65;
                const zEnd = z2 - 0.65;
                addWallLine(targetGroup, xMid, zStart, xMid, zEnd, [], 0.08);
                const stepD = (zEnd - zStart) / steps;
                const wFlight = (x2 - x1) / 2 - 0.14;

                for (let m = 0; m < 2; m++) {
                    const cx = m === 0 ? (x1 + xMid) / 2 : (xMid + x2) / 2;
                    const dir = m === 0 ? 1 : -1;
                    for (let i = 0; i < steps; i++) {
                        const ratio = dir === 1 ? (i + 1) / steps : (steps - i) / steps;
                        const heightRatio = ratio * 0.52;
                        const sz = zStart + (i + 0.5) * stepD;
                        const geom = new THREE.BoxGeometry(wFlight, 1, stepD * 0.94);
                        registerDynamicStairStep(targetGroup, geom, cx, sz, heightRatio, 0);
                    }
                }
            } else {
                const zMid = (z1 + z2) / 2;
                const xStart = x1 + 0.75;
                const xEnd = x2 - 0.75;
                addWallLine(targetGroup, xStart, zMid, xEnd, zMid, [], 0.08);
                const stepW = (xEnd - xStart) / steps;
                const dFlight = (z2 - z1) / 2 - 0.14;

                for (let m = 0; m < 2; m++) {
                    const cz = m === 0 ? (z1 + zMid) / 2 : (zMid + z2) / 2;
                    const dir = m === 0 ? -1 : 1;
                    for (let i = 0; i < steps; i++) {
                        const ratio = dir === 1 ? (i + 1) / steps : (steps - i) / steps;
                        const heightRatio = ratio * 0.52;
                        const sx = xStart + (i + 0.5) * stepW;
                        const geom = new THREE.BoxGeometry(stepW * 0.94, 1, dFlight);
                        registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, 0);
                    }
                }
            }
        }

        // Открытое уличное крыльцо для 1-го этажа Корпуса 4 (без боковых стен)
        function buildB4ExteriorPorch(targetGroup, x1, z1, x2, z2, stepDir = 'south') {
            addFloorRect(targetGroup, x1, z1, x2, z2, true);

            const steps = 5;
            const cx = (x1 + x2) / 2;
            const cz = (z1 + z2) / 2;

            if (stepDir === 'south') {
                const w = Math.abs(x2 - x1);
                const sDepth = 1.25 / steps;
                for (let i = 0; i < steps; i++) {
                    const sz = z2 + (i + 0.5) * sDepth;
                    const ratio = (i + 1) / (steps + 1);
                    const yTop = 0.008 - ratio * 0.056;
                    addOutdoorPorchStep(targetGroup, w, sDepth * 1.01, cx, sz, yTop, -0.16);
                }
            } else if (stepDir === 'east') {
                const d = Math.abs(z2 - z1);
                const sWidth = 1.35 / steps;
                for (let i = 0; i < steps; i++) {
                    const sx = x2 + (i + 0.5) * sWidth;
                    const ratio = (i + 1) / (steps + 1);
                    const yTop = 0.008 - ratio * 0.056;
                    addOutdoorPorchStep(targetGroup, sWidth * 1.01, d, sx, cz, yTop, -0.16);
                }
            } else if (stepDir === 'west') {
                const d = Math.abs(z2 - z1);
                const sWidth = 1.35 / steps;
                for (let i = 0; i < steps; i++) {
                    const sx = x1 - (i + 0.5) * sWidth;
                    const ratio = (i + 1) / (steps + 1);
                    const yTop = 0.008 - ratio * 0.056;
                    addOutdoorPorchStep(targetGroup, sWidth * 1.01, d, sx, cz, yTop, -0.16);
                }
            } else if (stepDir === 'north') {
                const w = Math.abs(x2 - x1);
                const sDepth = 1.25 / steps;
                for (let i = 0; i < steps; i++) {
                    const sz = z1 - (i + 0.5) * sDepth;
                    const ratio = (i + 1) / (steps + 1);
                    const yTop = 0.008 - ratio * 0.056;
                    addOutdoorPorchStep(targetGroup, w, sDepth * 1.01, cx, sz, yTop, -0.16);
                }
            }
        }
    window.B4_X_S_EAST = B4_X_S_EAST;
    window.B4_X_S_GYM = B4_X_S_GYM;
    window.B4_X_S_HALL = B4_X_S_HALL;
    window.B4_GYM_COLUMNS = B4_GYM_COLUMNS;
    window.buildB4Staircase = buildB4Staircase;
    window.buildB4ExteriorPorch = buildB4ExteriorPorch;
})();
