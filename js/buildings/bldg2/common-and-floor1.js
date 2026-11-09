(function() {
    'use strict';

// ==========================================
// КОРПУС 2 (Этажи 1–3) — ИСПРАВЛЕННАЯ ВНУТРЕННЯЯ ПЛАНИРОВКА ПО ПЛАНАМ БТИ
// Внешний периметр, сквозные лестницы (ЛК №1, ЛК №2, ЛК №3) и выходы к переходам сохранены 1-в-1!
// ==========================================

        function buildB2Staircase(targetGroup, x1, x2, zTop, zBot) {
            // Основание лестницы уже монолитно покрыто базовой плитой этажа addFloorRect(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_BOT)
            const xMid = (x1 + x2) / 2;
            const zStart = zTop + 0.85;
            const zEnd = zBot - 0.85;
            addWallLine(targetGroup, xMid, zStart, xMid, zEnd, [], 0.08);

            const steps = 9;
            const stepD = (zEnd - zStart) / steps;
            buildStandardStaircaseFlight(targetGroup, x1, x2, zStart, stepD, steps);
        }

        /**
         * Лестничная клетка ЛК №3 (Корпус 2, Этаж 1)
         * Двухмаршевая лестница с горизонтальным направлением маршей строго по чертежу БТИ:
         * - Западный сквозной проход X [20.4..22.8] к наружному крыльцу и двери тамбура
         * - Нижний марш X [22.8..24.4], Z [-12.15..-10.6] (подъём на восток)
         * - Верхний марш X [22.8..24.4], Z [-13.7..-12.25] (подъём на запад)
         */
        function buildB2LK3Staircase(targetGroup) {
            const xStairStart = 22.8;
            const xStairEnd = 24.4;
            const zDivider = -12.2;
            const zNorthFlight = -13.7;
            const zSouthFlight = -10.6;
            const steps = 6;
            const stepW = (xStairEnd - xStairStart) / steps;

            // Центральная перегородка между маршами
            addWallLine(targetGroup, xStairStart, zDivider, xStairEnd, zDivider, [], 0.08);

            // Нижний южный марш: подъём на восток к промежуточной площадке
            const dSouthFlight = Math.abs(zDivider - zSouthFlight) - 0.12;
            const czSouth = (zDivider + zSouthFlight) / 2;
            for (let i = 0; i < steps; i++) {
                const ratio = (i + 1) / steps;
                const heightRatio = 0.03 + ratio * 0.23;
                const sx = xStairStart + (i + 0.5) * stepW;
                const geom = new THREE.BoxGeometry(stepW * 0.94, 1, dSouthFlight);
                registerDynamicStairStep(targetGroup, geom, sx, czSouth, heightRatio, 0);
            }

            // Промежуточная площадка у восточной стены X [24.1..24.8]
            const landingGeom = new THREE.BoxGeometry(0.7, 1, Math.abs(zDivider - zNorthFlight) * 0.95);
            registerDynamicStairStep(targetGroup, landingGeom, 24.45, (zNorthFlight + zDivider) / 2, 0.26, 0);

            // Верхний северный марш: подъём на запад со стрелкой к уровню 2-го этажа
            const dNorthFlight = Math.abs(zNorthFlight - zDivider) - 0.12;
            const czNorth = (zNorthFlight + zDivider) / 2;
            for (let i = 0; i < steps; i++) {
                const ratio = (steps - i) / steps;
                const heightRatio = 0.28 + (1 - ratio) * 0.24;
                const sx = xStairStart + (i + 0.5) * stepW;
                const geom = new THREE.BoxGeometry(stepW * 0.94, 1, dNorthFlight);
                registerDynamicStairStep(targetGroup, geom, sx, czNorth, heightRatio, 0);
            }
        }

        function buildB2ExteriorPorch(targetGroup, x1, x2, zNorth, hasSteps = true) {
            const w = Math.abs(x2 - x1);
            const cx = (x1 + x2) / 2;

            if (!hasSteps) {
                addFloorRect(targetGroup, x1, zNorth, x2, B2_Z_TOP, true);
                return;
            }

            // Наружное крыльцо выхода из ЛК №3 во двор:
            // Площадка перед дверью (глубина 1.0 м от стены B2_Z_TOP = -13.8)
            const zLandingNorth = -14.8;
            addFloorRect(targetGroup, x1, zLandingNorth, x2, B2_Z_TOP, true);

            // Ступени спускаются на север строго до края бордюра дороги (бордюр на Z = -16.3)!
            const B2_PORCH_Z_END = -16.2;
            const zStepsEnd = B2_PORCH_Z_END;
            const steps = 5;
            const totalStepsDepth = Math.abs(zLandingNorth - zStepsEnd);
            const sDepth = totalStepsDepth / steps;

            for (let i = 0; i < steps; i++) {
                // i = 0 (верхняя ступень у площадки) -> i = 4 (нижняя ступень у бордюра)
                const sz = zLandingNorth - (i + 0.5) * sDepth;
                const ratio = (i + 1) / (steps + 1);
                const yTop = 0.008 - ratio * 0.056;
                addOutdoorPorchStep(targetGroup, w, sDepth * 1.01, cx, sz, yTop, -0.16);
            }
        }
        /**
         * КОРПУС 2 — ЭТАЖ 1
         * Точное соответствие чертежу 1-го этажа:
         * - Слева вверху: ЛК №3 с крыльцом, правее неё проходной тамбур в 105, ниже — комната 103
         * - 105 с двумя утолщёнными простенками у коридора, 107 с внутренней перегородкой и отсеками
         * - ЛК №2 с двойным северным тамбуром и уличной площадкой, правее неё — открытый карман коридора до северной стены
         * - 109 и 111 (соединены дверью у коридора), С/У с двумя зонами и 3 кабинками, ЛК №1 с северным тамбуром выхода
         * - Южный ряд: 104, 106, 108, 110 с пристенными пилястрами вдоль коридора
         */
        function buildBuilding2Floor1(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            addFloorRect(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_BOT, false);

            // Площадка у выходов ЛК №2
            buildB2ExteriorPorch(targetGroup, B2_LK2_X1, B2_LK2_X2, -15.4, false);
            // Наружное уличное крыльцо выхода из ЛК №3 во двор (X [20.4..22.6], Z [-17.0..-13.8])
            buildB2ExteriorPorch(targetGroup, B2_X_START, 22.6, -16.2, true);

            // --- ВНЕШНИЙ ПЕРИМЕТР СТЕН 1-ГО ЭТАЖА ---
            // Западная стена (стык с переходом в Корпус 1)
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_START, B2_Z_BOT, [
                { from: -6.5, to: -5.1, type: 'door' }
            ], OUTER_T);

            // Северная внешняя стена B2_Z_TOP (-13.8) с 4 выходами по БТИ (выход из ЛК №3 во двор, два выхода в ЛК №2 и выход в ЛК №1)
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_TOP, [
                { from: 21.0, to: 22.2, type: 'door' }, // Наружный эвакуационный выход из ЛК №3 на крыльцо
                { from: 42.1, to: 43.3, type: 'door' },
                { from: 43.9, to: 45.1, type: 'door' },
                { from: 64.8, to: 66.1, type: 'door' }
            ], OUTER_T);

            addWallLine(targetGroup, B2_X_START, B2_Z_BOT, B2_X_END, B2_Z_BOT, [], OUTER_T);
            addWallLine(targetGroup, B2_X_END, B2_Z_TOP, B2_X_END, B2_Z_BOT, [], OUTER_T);

            // --- СЕВЕРНАЯ СТЕНА КОРИДОРА (B2_Z_CORR_TOP = -6.8) ---
            addWallLine(targetGroup, B2_X_START, B2_Z_CORR_TOP, B2_X_END, B2_Z_CORR_TOP, [
                { from: 24.0, to: 25.2, type: 'door' },       // Дверь в 103
                { from: 32.8, to: 34.0, type: 'door' },       // Дверь в 105 (между двумя широкими коробами)
                { from: 39.6, to: 40.8, type: 'door' },       // Дверь в 107
                { from: 42.6, to: 44.6, type: 'door' },       // Двустворчатая дверь в ЛК №2
                { from: B2_LK2_X2, to: 48.0, type: 'open' },  // Открытый карман коридора правее ЛК №2
                { from: 49.0, to: 50.8, type: 'door' },       // Двустворчатая дверь в 109
                { from: 58.8, to: 60.0, type: 'door' },       // Дверь в 111
                { from: 62.0, to: 63.2, type: 'door' },       // Дверь в С/У
                { from: 65.1, to: 67.1, type: 'door' }        // Двустворчатая дверь в ЛК №1
            ], INNER_T);

            // 1) Шахта ЛК №3 (X [20.4..24.8], Z [-13.8..-10.5]), тамбур (X [24.8..27.4]) и комната 103 (X [20.4..27.4], Z [-10.5..-6.8])
            addWallLine(targetGroup, B2_X_START, B2_LK3_Z_BOT, 27.4, B2_LK3_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, B2_LK3_X2, B2_Z_TOP, B2_LK3_X2, B2_LK3_Z_BOT, [
                { from: -11.9, to: -10.8, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 27.4, B2_Z_TOP, 27.4, B2_Z_CORR_TOP, [
                { from: -12.4, to: -11.2, type: 'door' } // Дверь из тамбура в зал 105
            ], INNER_T);
            buildB2LK3Staircase(targetGroup);

            // 2) Зал 105 (X [27.4..38.6]) и два широких пристенных короба вдоль коридора (как на чертеже!)
            addWallLine(targetGroup, 38.6, B2_Z_TOP, 38.6, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 29.2, B2_Z_CORR_TOP - 0.265, 32.5, B2_Z_CORR_TOP - 0.265, [], 0.35, true);
            addWallLine(targetGroup, 34.3, B2_Z_CORR_TOP - 0.265, 38.6, B2_Z_CORR_TOP - 0.265, [], 0.35, true);

            // 3) Комната 107 (X [38.6..41.8]): разделена пополам на Z = -9.8 с дверью слева и подсобными нишами справа
            addWallLine(targetGroup, B2_LK2_X1, B2_Z_TOP, B2_LK2_X1, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 38.6, -9.8, B2_LK2_X1, -9.8, [
                { from: 38.9, to: 40.0, type: 'door' }
            ], 0.14);
            addWallLine(targetGroup, 40.1, -12.0, B2_LK2_X1, -12.0, [], 0.12);
            addWallLine(targetGroup, 40.1, -10.9, B2_LK2_X1, -10.9, [], 0.12);
            addWallLine(targetGroup, 40.1, -10.9, 40.1, -9.8, [
                { from: -10.75, to: -9.8, type: 'door' } // Боковая дверь в замкнутый отсек над 107
            ], 0.12);

            // 4) Шахта ЛК №2 (X [41.8..45.4]) с северным тамбуром у выходов (Z [-13.8..-11.6]) и маршем ниже (Z [-11.6..-6.8])
            addWallLine(targetGroup, B2_LK2_X2, B2_Z_TOP, B2_LK2_X2, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 43.6, B2_Z_TOP, 43.6, -11.6, [], 0.14);
            addWallLine(targetGroup, B2_LK2_X1, -11.6, 43.6, -11.6, [
                { from: 42.1, to: 43.3, type: 'door' }
            ], 0.14);
            buildB2Staircase(targetGroup, B2_LK2_X1 + 0.1, B2_LK2_X2 - 0.1, -11.5, B2_Z_CORR_TOP - 0.1);

            // 5) Зал 109 (X [48.0..58.2]) с широким пристенным коробом у коридора и смежной дверью в 111 (X [58.2..61.2])
            addWallLine(targetGroup, 48.0, B2_Z_TOP, 48.0, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 51.2, B2_Z_CORR_TOP - 0.265, 58.2, B2_Z_CORR_TOP - 0.265, [], 0.35, true);
            addWallLine(targetGroup, 58.2, B2_Z_TOP, 58.2, B2_Z_CORR_TOP, [
                { from: -9.4, to: -8.2, type: 'door' } // Смежная дверь между 109 и 111 (строго по БТИ 1.jpg, выше короба)
            ], INNER_T);
            addWallLine(targetGroup, 61.2, B2_Z_TOP, 61.2, B2_Z_CORR_TOP, [], INNER_T);

            // 6) Блок С/У (X [61.2..64.2], Z [-13.8..-6.8]): нижний С/У, проход слева в верхний С/У и 3 кабинки справа
            addFloorRect(targetGroup, 61.2, B2_Z_TOP, B2_LK1_X1, B2_Z_CORR_TOP, true);
            addWallLine(targetGroup, B2_LK1_X1, B2_Z_TOP, B2_LK1_X1, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 61.2, -9.2, B2_LK1_X1, -9.2, [
                { from: 61.35, to: 62.45, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 62.6, -12.0, B2_LK1_X1, -12.0, [], 0.12);
            addWallLine(targetGroup, 62.6, -11.0, B2_LK1_X1, -11.0, [], 0.12);
            addWallLine(targetGroup, 62.6, -10.1, B2_LK1_X1, -10.1, [], 0.12);
            addWallLine(targetGroup, 62.6, -12.0, 62.6, -9.2, [
                { from: -11.9, to: -11.1, type: 'door' },
                { from: -10.9, to: -10.2, type: 'door' },
                { from: -10.0, to: -9.3, type: 'door' }
            ], 0.12);

            // 7) Шахта ЛК №1 (X [64.2..68.0]) с тамбуром у входа (Z [-13.8..-11.8])
            addWallLine(targetGroup, B2_LK1_X1, -11.8, B2_X_END, -11.8, [
                { from: 64.7, to: 65.9, type: 'door' }
            ], INNER_T);
            buildB2Staircase(targetGroup, B2_LK1_X1 + 0.15, B2_LK1_X2 - 0.2, -11.7, B2_Z_CORR_TOP - 0.15);

            // --- Южный фронт коридора (B2_Z_CORR_BOT = -5.0) к залам 104, 106, 108, 110 ---
            addWallLine(targetGroup, B2_X_START, B2_Z_CORR_BOT, B2_X_END, B2_Z_CORR_BOT, [
                { from: 21.8, to: 23.0, type: 'door' },
                { from: 30.8, to: 32.6, type: 'door' },
                { from: 46.2, to: 48.0, type: 'door' },
                { from: 56.0, to: 57.8, type: 'door' },
                { from: 65.2, to: 66.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 38.6, B2_Z_CORR_BOT, 38.6, B2_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, 54.8, B2_Z_CORR_BOT, 54.8, B2_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, B2_LK1_X1, B2_Z_CORR_BOT, B2_LK1_X1, B2_Z_BOT, [], INNER_T);

            // Пристенный короб в зале 108 (X [58.0..64.2])
            addWallLine(targetGroup, 58.0, B2_Z_CORR_BOT + 0.265, B2_LK1_X1 - 0.1, B2_Z_CORR_BOT + 0.265, [], 0.35, true);

            [23.5, 26.8].forEach(cx => addSquareColumn(targetGroup, cx, B2_Z_CORR_TOP - 0.25, 0.38));
            // В залах 104 и 106 (у южной стены коридора Z = -4.75)
            [23.8, 27.0, 30.2, 33.4, 36.6, 42.6, 45.6, 48.8, 52.0].forEach(cx => {
                addSquareColumn(targetGroup, cx, B2_Z_CORR_BOT + 0.25, 0.38);
            });

            // 3D-плашки помещений 1-го этажа Корпуса 2 (buildingId = 2)
            addRoomLabel3D(targetGroup, 1, 'ЛК№3', 22.6, -12.2, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 1, '103', 23.9, -8.7, false, false, 2, 0.95);
            addRoomLabel3D(targetGroup, 1, '105', 33.0, -10.3, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 1, '107', 40.2, -8.3, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 1, 'ЛК№2', 44.5, -9.2, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 1, '109', 53.1, -10.3, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 1, '111', 59.7, -10.3, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 1, 'WC (М)', 62.7, -8.0, true, false, 2, 0.82);
            addRoomLabel3D(targetGroup, 1, 'ЛК№1', 66.0, -9.2, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 1, '104\nБиблиотека', 29.5, -0.5, false, true, 2, 1.1);
            addRoomLabel3D(targetGroup, 1, '106', 46.7, -0.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 1, '108', 59.5, -0.5, false, false, 2, 1.0);
            addRoomLabel3D(targetGroup, 1, '110', 66.0, -0.5, true, false, 2, 0.92);
            flushWalls(targetGroup);
        }

        /**
         * КОРПУС 2 — ЭТАЖ 2
         * Точное соответствие чертежу 2-го этажа:
         * - Северный ряд: левый торцевой отсек и 203 (соединены дверью), 205, сквозной проход X [36.2..38.8] к переходу в Корпус 4
         * - Блок из двух С/У (X [38.8..41.8]): правый малый у входа, левый глубокий с 3 кабинками
         * - ЛК №2 (X [41.8..45.4]), 209 (X [45.4..48.4]), 211 (X [48.4..60.6]) с 3 пилястрами у коридора, 213 с подсобкой, ЛК №1
         * - Южный ряд: 202, 204, 206, 208, открытый карман коридора X [41.8..44.8] до южной стены, 210, 212, 214
         */
    window.buildB2Staircase = buildB2Staircase;
    window.buildB2LK3Staircase = buildB2LK3Staircase;
    window.buildB2ExteriorPorch = buildB2ExteriorPorch;
    window.buildBuilding2Floor1 = buildBuilding2Floor1;
})();
