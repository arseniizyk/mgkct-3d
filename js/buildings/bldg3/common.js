(function() {
    'use strict';

// ==========================================
// КОРПУС 3 (Этажи 1–2) — ИСПРАВЛЕННАЯ ВНУТРЕННЯЯ ПЛАНИРОВКА ПО ПЛАНАМ БТИ
// Внешний периметр X [-1.6..14.0], Z [-61.6..-14.0] и точки стыка переходов сохранены 1-в-1!
// ==========================================

        // Двухмаршевая (или одномаршевая для ЛК №2 на 1 эт.) лестница для Корпуса 3 на западной стороне (X от -1.6 до 4.6)
        function buildB3Staircase(targetGroup, xWest, xEast, zNorth, zSouth, singleFlight = false) {
            addFloorRect(targetGroup, xWest, zNorth, xEast, zSouth, true);
            const zMid = (zNorth + zSouth) / 2;
            const xStart = xWest + 0.95;
            const xEnd = xEast - 0.95;

            if (!singleFlight) {
                addWallLine(targetGroup, xStart, zMid, xEnd, zMid, [], 0.08);
            } else {
                addWallLine(targetGroup, xStart - 0.04, zMid, xEnd, zMid, [], 0.08);
                addWallLine(targetGroup, xStart, zNorth + 0.1, xStart, zMid, [], 0.08);
            }

            const steps = 9;
            const stepW = (xEnd - xStart) / steps;
            const dFlight = (zSouth - zNorth) / 2 - 0.16;

            for (let m = 0; m < (singleFlight ? 1 : 2); m++) {
                const cz = m === 0 ? (zNorth + zMid) / 2 : (zMid + zSouth) / 2;
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

        // Открытое уличное крыльцо для 1-го этажа Корпуса 3 на восточном фасаде (площадка + открытые ступени на восток во двор)
        function buildB3ExteriorPorchEast(targetGroup, zNorth, zSouth, xWall, xOuter) {
            const porchW = Math.abs(xOuter - xWall);
            const steps = 5;
            const xLandingEast = xWall + porchW * 0.45;
            addFloorRect(targetGroup, xWall, zNorth, xLandingEast, zSouth, true);
            const stepSpanX = Math.abs(xOuter - xLandingEast);
            const sDepth = stepSpanX / steps;
            const cz = (zNorth + zSouth) / 2;
            const dz = Math.abs(zSouth - zNorth);
            for (let i = 0; i < steps; i++) {
                const sx = xLandingEast + (i + 0.5) * sDepth;
                const ratio = (i + 1) / (steps + 1);
                const yTop = 0.008 - ratio * 0.056;
                addOutdoorPorchStep(targetGroup, sDepth * 1.01, dz, sx, cz, yTop, -0.16);
            }
        }

        // Открытое уличное крыльцо для 1-го этажа Корпуса 3 на западном фасаде (площадка + открытые ступени БЕЗ боковых стен)
        function buildB3ExteriorPorchWest(targetGroup, zNorth, zSouth, xOuter, xWall, stepsDir = 'west') {
            const porchW = Math.abs(xWall - xOuter);
            if (stepsDir === 'west') {
                const xLandingWest = xWall - porchW * 0.45;
                addFloorRect(targetGroup, xLandingWest, zNorth, xWall, zSouth, true);

                const steps = 5;
                const totalStepsWidth = Math.abs(xLandingWest - xOuter);
                const sWidth = totalStepsWidth / steps;
                const cz = (zNorth + zSouth) / 2;
                const dz = Math.abs(zSouth - zNorth);
                for (let i = 0; i < steps; i++) {
                    const sx = xLandingWest - (i + 0.5) * sWidth;
                    const ratio = (i + 1) / (steps + 1);
                    const yTop = 0.008 - ratio * 0.056;
                    addOutdoorPorchStep(targetGroup, sWidth * 1.01, dz, sx, cz, yTop, -0.16);
                }
            } else if (stepsDir === 'south') {
                // Площадка у выхода из ЛК №1 и ступени с южной стороны
                addFloorRect(targetGroup, xOuter, zNorth, xWall, zSouth, true);
                const steps = 5;
                const totalStepsDepth = 1.25;
                const sDepth = totalStepsDepth / steps;
                const cx = (xWall + xOuter) / 2;
                for (let i = 0; i < steps; i++) {
                    const sz = zSouth + (i + 0.5) * sDepth;
                    const ratio = (i + 1) / (steps + 1);
                    const yTop = 0.008 - ratio * 0.056;
                    addOutdoorPorchStep(targetGroup, porchW, sDepth * 1.01, cx, sz, yTop, -0.16);
                }
            }
        }
    window.buildB3Staircase = buildB3Staircase;
    window.buildB3ExteriorPorchEast = buildB3ExteriorPorchEast;
    window.buildB3ExteriorPorchWest = buildB3ExteriorPorchWest;
})();
