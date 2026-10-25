// ==========================================
// КОРПУС 4 (Этажи 1–3 + переходы) — ИСПРАВЛЕННАЯ ГЕОМЕТРИЯ ПО НАЛОЖЕНИЮ ПЛАНОВ
// ==========================================

        // Координатная сетка Корпуса 4 (единые сквозные шахты лестниц для 1, 2 и 3 этажей)
        const B4_X_S_GYM = 66.0;   // Верхний (северный) край спортзала 206
        const B4_X_S_HALL = 66.0;  // Верхний (северный) край зала 102 / 204 (на одной линии со спортзалом и ЛК №3!)

        // Единая сетка 14 колонн спортзала 206:
        // На 1-м этаже они стоят на улице и держат нависающий 2-й этаж, а на 2-м и 3-м этажах идут внутри стен спортзала 206!
        const B4_GYM_COLUMNS = [
            // Южная сторона спортзала (X = 32.4)
            { x: 32.65, z: -59.2 },
            { x: 32.65, z: -55.8 },
            { x: 32.65, z: -52.5 },
            // Западная (левая) стена спортзала (Z = -61.6) — 8 колонн по плану
            { x: 32.65, z: -61.35 },
            { x: 37.4,  z: -61.35 },
            { x: 42.2,  z: -61.35 },
            { x: 46.9,  z: -61.35 },
            { x: 51.7,  z: -61.35 },
            { x: 56.5,  z: -61.35 },
            { x: 61.2,  z: -61.35 },
            { x: 65.75, z: -61.35 },
            // Северная (верхняя) сторона спортзала (X = 66.0)
            { x: 65.75, z: -58.4 },
            { x: 65.75, z: -55.0 },
            { x: 65.75, z: -51.8 }
        ];

        // Двухмаршевая лестница для Корпуса 4 (поддерживает продольную и поперечную ориентацию маршей)
        function buildB4Staircase(targetGroup, x1, x2, z1, z2, alongZ = true) {
            addFloorRect(targetGroup, x1, z1, x2, z2, true);
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
            if (stepDir === 'south') {
                const w = Math.abs(x2 - x1);
                const cx = (x1 + x2) / 2;
                const sDepth = 1.25 / steps;
                for (let i = 0; i < steps; i++) {
                    const sz = z2 + (i + 0.5) * sDepth;
                    const heightRatio = 0.03 + ((steps - i) / steps) * 0.12;
                    const geom = new THREE.BoxGeometry(w, 1, sDepth * 0.94);
                    registerDynamicStairStep(targetGroup, geom, cx, sz, heightRatio, -0.14, true);
                }
            } else if (stepDir === 'east') {
                const d = Math.abs(z2 - z1);
                const cz = (z1 + z2) / 2;
                const sWidth = 1.35 / steps;
                for (let i = 0; i < steps; i++) {
                    const sx = x2 + (i + 0.5) * sWidth;
                    const heightRatio = 0.03 + ((steps - i) / steps) * 0.12;
                    const geom = new THREE.BoxGeometry(sWidth * 0.94, 1, d);
                    registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, -0.14, true);
                }
            } else if (stepDir === 'west') {
                const d = Math.abs(z2 - z1);
                const cz = (z1 + z2) / 2;
                const sWidth = 1.35 / steps;
                for (let i = 0; i < steps; i++) {
                    const sx = x1 - (i + 0.5) * sWidth;
                    const heightRatio = 0.03 + ((steps - i) / steps) * 0.12;
                    const geom = new THREE.BoxGeometry(sWidth * 0.94, 1, d);
                    registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, -0.14, true);
                }
            } else if (stepDir === 'north') {
                const w = Math.abs(x2 - x1);
                const cx = (x1 + x2) / 2;
                const sDepth = 1.25 / steps;
                for (let i = 0; i < steps; i++) {
                    const sz = z1 - (i + 0.5) * sDepth;
                    const heightRatio = 0.03 + ((steps - i) / steps) * 0.12;
                    const geom = new THREE.BoxGeometry(w, 1, sDepth * 0.94);
                    registerDynamicStairStep(targetGroup, geom, cx, sz, heightRatio, -0.14, true);
                }
            }
        }

        /**
         * КОРПУС 4 — ЭТАЖ 1 (БЕЗ надземных переходов!)
         * Исправлено по наложению планов:
         * 1) Правая часть (104, 103, 102, ЛК №1, ЛК №2, ЛК №3 и центральная ось 11-14-18) 1-в-1 совпадает со 2-м этажом.
         * 2) Левая часть (под спортзалом 206) утоплена внутрь ровно по контуру 1-го этажа (комнаты 4-10, 13, 20-21, 22-23, 24, 19).
         * 3) По внешнему периметру нависающего спортзала 206 стоят 14 опорных колонн точно под колоннами 2-го этажа!
         */
        function buildBuilding4Floor1(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // --- 1. ПЛИТЫ ПЕРЕКРЫТИЯ 1-ГО ЭТАЖА (СТРОГО ПО УТОПЛЕННОМУ КОНТУРУ 1-ГО ЭТАЖА!) ---
            // Южный ряд комнат 4–10 (утоплен относительно X = 32.4 до X = 35.2 / 36.2)
            addFloorRect(targetGroup, 35.2, -59.2, 40.0, -54.8, false); // Комнаты 10, 9, 8
            addFloorRect(targetGroup, 36.2, -54.8, 40.0, -50.2, false); // Комнаты 7, 6, 5
            addFloorRect(targetGroup, 35.2, -50.2, 40.0, -46.8, false); // Комната 4
            addFloorRect(targetGroup, 40.0, -60.2, 41.8, -56.2, false); // Западный входной тамбур у комн. 10 и 13

            // Центральный и северный блок под спортзалом: холл, комн. 12, 13, 15-17, 20-21, зал 24, комн. 19
            // Утоплен слева до Z = -56.2 и сверху до X = 61.6!
            addFloorRect(targetGroup, 40.0, -56.2, 61.6, -49.8, false);
            // Выступающий на запад блок комнат 22 и 23 (X [50.8..61.6], Z [-60.0..-56.2])
            addFloorRect(targetGroup, 50.8, -60.0, 61.6, -56.2, false);

            // Центральная лента (С/У, 11, 14, 18): X [32.4..61.6], Z [-49.8..-45.4]
            addFloorRect(targetGroup, B4_X_WEST, -49.8, 61.6, -45.4, false);

            // Правая нижняя часть (холл, 104, 103, раздевалки 105, 3, 2, 1): X [32.4..45.0], Z [-45.4..-27.4]
            addFloorRect(targetGroup, B4_X_WEST, -45.4, 45.0, B4_Z_SOUTH, false);

            // Большой зал столовой 102 (X [45.0..66.0], Z [-45.4..-27.4]) — совпадает с залом 204 2-го этажа!
            addFloorRect(targetGroup, 45.0, -45.4, B4_X_S_HALL, B4_Z_SOUTH, false);

            // Выступающие лестничные клетки и входные тамбуры 1-го этажа:
            // 1) ЛК №2 (X [27.8..32.4], Z [-49.8..-46.8]) + входной тамбур под переходом (X [28.4..32.4], Z [-46.8..-44.2])
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z2, true);
            addFloorRect(targetGroup, 28.4, B4_LK2_Z2, B4_X_WEST, -44.2, false);
            buildB4ExteriorPorch(targetGroup, 28.6, -51.3, 31.4, B4_LK2_Z1, 'north');
            buildB4ExteriorPorch(targetGroup, 30.6, -44.2, 32.2, -42.8, 'south');

            // 2) ЛК №3 (X [61.6..69.0], Z [-49.8..-45.4]) — северная сквозная шахта
            addFloorRect(targetGroup, 61.6, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, true);

            // 3) Правый нижний узел (Z = -27.4): сквозная шахта ЛК №1 (X [38.8..42.4], Z [-31.2..-24.4])
            // и входной тамбур с крыльцом (X [42.4..45.0], Z [-29.0..-25.6]) между ЛК №1 и столовой 102, как на плане!
            addFloorRect(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, true);
            addFloorRect(targetGroup, B4_LK1_X2, -27.4, 45.0, -25.6, false);
            buildB4ExteriorPorch(targetGroup, B4_LK1_X2, -25.6, 45.0, -24.2, 'south');

            // --- 2. СКВОЗНЫЕ ОПОРНЫЕ КОЛОННЫ НА 1-М ЭТАЖЕ ПОД НАВИСАЮЩИМ СПОРТЗАЛОМ 206 ---
            // Все 14 колонн стоят строго в тех же координатах (X, Z), что и пилястры/колонны зала 206 на 2-м этаже!
            B4_GYM_COLUMNS.forEach(col => {
                addSquareColumn(targetGroup, col.x, col.z, 0.42, true);
            });

            // --- 3. СТЕНЫ ЛЕСТНИЧНЫХ КЛЕТОК И ВНЕШНЕГО ПЕРИМЕТРА 1-ГО ЭТАЖА ---
            // Шахта ЛК №2 (X [27.8..32.4], Z [-49.8..-46.8])
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z1, [
                { from: 29.2, to: 30.8, type: 'door' }
            ], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X1, B4_LK2_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z2, B4_LK2_X2, B4_LK2_Z2, [
                { from: 30.6, to: 31.8, type: 'door' }
            ], OUTER_T);
            buildB4Staircase(targetGroup, B4_LK2_X1 + 0.1, B4_LK2_X2 - 0.1, B4_LK2_Z1 + 0.1, B4_LK2_Z2 - 0.1, false);

            // Входной тамбур правее ЛК №2 под переходом (X [28.4..32.4], Z [-46.8..-44.2])
            addWallLine(targetGroup, 28.4, -46.8, 28.4, -44.2, [], OUTER_T);
            addWallLine(targetGroup, 28.4, -44.2, B4_X_WEST, -44.2, [
                { from: 30.6, to: 32.0, type: 'door' }
            ], OUTER_T);

            // Шахта ЛК №3 (X [61.6..69.0], Z [-49.8..-45.4]) — 100% соосна со 2-м и 3-м этажами!
            addWallLine(targetGroup, 61.6, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, B4_LK3_Z2, B4_LK3_X2, B4_LK3_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK3_X2, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, [
                { from: -48.4, to: -46.8, type: 'door' }
            ], OUTER_T);
            addWallLine(targetGroup, 61.6, B4_LK3_Z2, B4_X_S_HALL, B4_LK3_Z2, [
                { from: 62.0, to: 63.2, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, 63.2, B4_LK3_X2 - 0.15, B4_LK3_Z1 + 0.1, B4_LK3_Z2 - 0.1, false);

            // Шахта ЛК №1 (X [38.8..42.4], Z [-31.2..-24.4]) — 100% соосна со 2-м и 3-м этажами!
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X1, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z2, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z1, [
                { from: 39.8, to: 41.4, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, B4_LK1_X1 + 0.1, B4_LK1_X2 - 0.1, B4_LK1_Z1 + 0.1, B4_LK1_Z2 - 0.1, true);

            // Входной тамбур с двойными дверями ВЫШЕ ЛК №1 перед столовой 102 (X [42.4..45.0], Z [-29.0..-25.6])
            addWallLine(targetGroup, 45.0, -29.0, 45.0, -25.6, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, -29.0, 45.0, -29.0, [
                { from: 43.0, to: 44.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, B4_LK1_X2, -27.4, 45.0, -27.4, [
                { from: 43.0, to: 44.4, type: 'door' }
            ], OUTER_T);

            // Южный и западный ступенчатый внешний контур 1-го этажа (под спортзалом 206):
            // Участок у входа и комнат 104, 103 (X = 32.4, Z [-46.8..-27.4])
            addWallLine(targetGroup, B4_X_WEST, -46.8, B4_X_WEST, B4_Z_SOUTH, [
                { from: -46.2, to: -44.8, type: 'door' }
            ], OUTER_T);
            // Ступенька от ЛК №2 к комнате 4 (Z = -46.8, X [32.4..35.2])
            addWallLine(targetGroup, B4_X_WEST, -46.8, 35.2, -46.8, [
                { from: 33.2, to: 34.6, type: 'door' }
            ], OUTER_T);
            // Стена комнаты 4 (X = 35.2, Z [-50.2..-46.8])
            addWallLine(targetGroup, 35.2, -50.2, 35.2, -46.8, [], OUTER_T);
            addWallLine(targetGroup, 35.2, -50.2, 36.2, -50.2, [], OUTER_T);
            // Стена комнат 5, 6, 7 (X = 36.2, Z [-54.8..-50.2])
            addWallLine(targetGroup, 36.2, -54.8, 36.2, -50.2, [], OUTER_T);
            addWallLine(targetGroup, 35.2, -54.8, 36.2, -54.8, [], OUTER_T);
            // Стена комнат 8, 9, 10 (X = 35.2, Z [-59.2..-54.8])
            addWallLine(targetGroup, 35.2, -59.2, 35.2, -54.8, [], OUTER_T);
            // Западная стена комнаты 10 (Z = -59.2, X [35.2..40.0])
            addWallLine(targetGroup, 35.2, -59.2, 40.0, -59.2, [], OUTER_T);
            // Выступ тамбура у комнаты 10 (X [40.0..41.8], Z [-60.2..-59.2])
            addWallLine(targetGroup, 40.0, -60.2, 40.0, -59.2, [], OUTER_T);
            addWallLine(targetGroup, 40.0, -60.2, 41.8, -60.2, [
                { from: 40.3, to: 41.5, type: 'door' }
            ], OUTER_T);
            addWallLine(targetGroup, 41.8, -60.2, 41.8, -56.2, [], OUTER_T);

            // Западная стена вдоль комнат 13, 20, 21 (Z = -56.2, X [41.8..50.8])
            addWallLine(targetGroup, 41.8, -56.2, 50.8, -56.2, [
                { from: 42.2, to: 43.4, type: 'door' },
                { from: 45.0, to: 46.2, type: 'door' }
            ], OUTER_T);
            // Выступ блока 22–23 на запад (Z [-60.0..-56.2], X [50.8..61.6])
            addWallLine(targetGroup, 50.8, -60.0, 50.8, -56.2, [], OUTER_T);
            addWallLine(targetGroup, 50.8, -60.0, 61.6, -60.0, [], OUTER_T);

            // Северная внешняя стена 1-го этажа вдоль 23, 24, 19, 18 (X = 61.6, Z [-60.0..-45.4])
            addWallLine(targetGroup, 61.6, -60.0, 61.6, -45.4, [
                { from: -49.2, to: -46.0, type: 'open' }
            ], OUTER_T);

            // Северная внешняя стена столовой 102 (X = 66.0, Z [-45.4..-27.4])
            addWallLine(targetGroup, B4_X_S_HALL, -45.4, B4_X_S_HALL, B4_Z_SOUTH, [], OUTER_T);

            // Восточная внешняя стена Корпуса 4 (Z = -27.4, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_SOUTH, B4_X_S_HALL, B4_Z_SOUTH, [
                { from: B4_LK1_X1, to: 45.0, type: 'open' }
            ], OUTER_T);

            // --- 4. ВНУТРЕННИЕ ПЕРЕГОРОДКИ 1-ГО ЭТАЖА КОРПУСА 4 ---
            // Блок 104 и 103 вдоль нижней стены (X [32.4..36.2], Z [-44.2..-29.0]) — совпадает с 205/202/201!
            addWallLine(targetGroup, B4_X_WEST, -44.2, 36.2, -44.2, [], INNER_T);
            addWallLine(targetGroup, B4_X_WEST, -36.8, 36.2, -36.8, [], INNER_T);
            addWallLine(targetGroup, 36.2, -44.2, 36.2, -30.0, [
                { from: -40.8, to: -39.2, type: 'door' }, // Двустворчатая дверь в 104
                { from: -34.2, to: -32.6, type: 'door' }  // Двустворчатая дверь в 103
            ], INNER_T);
            addWallLine(targetGroup, 36.2, -30.0, B4_LK1_X1, -30.0, [], INNER_T);

            // Столовая 102 (X [45.0..66.0], Z [-43.6..-27.4]) — левая и нижняя стены совпадают с 204!
            addWallLine(targetGroup, 45.0, -43.6, B4_X_S_HALL, -43.6, [
                { from: 54.4, to: 55.8, type: 'door' },
                { from: 58.2, to: 59.6, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 45.0, -43.6, 45.0, -29.0, [
                { from: -36.8, to: -35.2, type: 'door' },
                { from: -32.8, to: -31.2, type: 'door' }
            ], INNER_T);

            // Центральный блок перед столовой: 11, 105, 3, 2, 1, 1 (X [38.2..45.0], Z [-49.8..-37.2])
            addWallLine(targetGroup, 38.2, -49.8, 42.4, -49.8, [], INNER_T);
            addWallLine(targetGroup, 38.2, -49.8, 38.2, -45.4, [
                { from: -48.6, to: -47.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 42.4, -49.8, 42.4, -45.4, [
                { from: -47.0, to: -45.8, type: 'door' }
            ], INNER_T);

            // Блок санузлов и раздевалок 105, 3, 2, 1, 1 (X [38.2..45.0], Z [-45.4..-37.2])
            addWallLine(targetGroup, 38.2, -45.4, 45.0, -45.4, [
                { from: 43.2, to: 44.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 38.2, -45.4, 38.2, -37.2, [
                { from: -44.8, to: -43.8, type: 'door' }, // Вход в 105
                { from: -42.6, to: -41.6, type: 'door' }, // Вход в 2
                { from: -40.4, to: -39.4, type: 'door' }  // Вход в 1
            ], INNER_T);
            addWallLine(targetGroup, 38.2, -37.2, 45.0, -37.2, [
                { from: 39.4, to: 41.2, type: 'open' }
            ], INNER_T);
            addWallLine(targetGroup, 40.4, -45.4, 40.4, -43.2, [], INNER_T);
            addWallLine(targetGroup, 38.2, -43.2, 45.0, -43.2, [], INNER_T);
            addWallLine(targetGroup, 38.2, -41.2, 45.0, -41.2, [], INNER_T);
            addWallLine(targetGroup, 38.2, -39.2, 45.0, -39.2, [], INNER_T);
            addWallLine(targetGroup, 41.6, -43.2, 41.6, -39.2, [
                { from: -42.6, to: -41.6, type: 'door' },
                { from: -40.6, to: -39.6, type: 'door' }
            ], 0.12);

            // Отдельно стоящий в холле кабинет 12 (X [39.4..42.6], Z [-53.2..-49.8])
            addWallLine(targetGroup, 39.4, -53.2, 42.6, -53.2, [], INNER_T);
            addWallLine(targetGroup, 39.4, -49.8, 42.6, -49.8, [], INNER_T);
            addWallLine(targetGroup, 39.4, -53.2, 39.4, -49.8, [
                { from: -52.2, to: -51.0, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 42.6, -53.2, 42.6, -49.8, [], INNER_T);

            // Центральная лента: помещение 14 (под Служеб. пом. и 210) и комната 18 (под 212) — Z [-49.8..-45.4]
            addWallLine(targetGroup, 43.2, -49.8, 54.4, -49.8, [], INNER_T);
            addWallLine(targetGroup, 43.2, -45.4, 54.4, -45.4, [], INNER_T);
            addWallLine(targetGroup, 43.2, -49.8, 43.2, -45.4, [
                { from: -49.0, to: -47.8, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 54.4, -49.8, 54.4, -45.4, [
                { from: -48.2, to: -47.0, type: 'door' }
            ], INNER_T);

            // Комната 18 (X [57.4..61.6], Z [-49.8..-45.4])
            addWallLine(targetGroup, 57.4, -49.8, 61.6, -49.8, [], INNER_T);
            addWallLine(targetGroup, 57.4, -45.4, 61.6, -45.4, [], INNER_T);
            addWallLine(targetGroup, 57.4, -49.8, 57.4, -45.4, [
                { from: -48.2, to: -47.0, type: 'door' }
            ], INNER_T);

            // Ряд кабинетов 15, 16, 17 (X [44.2..54.4], Z [-53.2..-49.8]) и комната 19 (X [56.8..61.6], Z [-53.2..-49.8])
            addWallLine(targetGroup, 44.2, -53.2, 54.4, -53.2, [
                { from: 45.4, to: 46.6, type: 'door' },
                { from: 48.8, to: 50.0, type: 'door' },
                { from: 52.2, to: 53.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 44.2, -53.2, 44.2, -49.8, [], INNER_T);
            addWallLine(targetGroup, 47.6, -53.2, 47.6, -49.8, [], INNER_T);
            addWallLine(targetGroup, 51.0, -53.2, 51.0, -49.8, [], INNER_T);
            addWallLine(targetGroup, 54.4, -53.2, 54.4, -49.8, [], INNER_T);

            // Комната 19 и тамбур перед ней
            addWallLine(targetGroup, 54.4, -52.6, 61.6, -52.6, [
                { from: 55.0, to: 56.2, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 56.8, -52.6, 56.8, -49.8, [
                { from: -51.8, to: -50.6, type: 'door' }
            ], INNER_T);

            // Южный ряд комнат 4, 5, 6, 7, 8, 9, 10 (вдоль X [35.2..40.0], Z [-59.2..-46.8])
            addWallLine(targetGroup, 40.0, -59.2, 40.0, -46.8, [
                { from: -57.8, to: -56.6, type: 'door' }, // в 10
                { from: -56.0, to: -55.0, type: 'door' }, // в 9
                { from: -54.6, to: -53.6, type: 'door' }, // в 8
                { from: -53.2, to: -52.2, type: 'door' }, // в 7
                { from: -51.8, to: -50.8, type: 'door' }, // в 6
                { from: -50.4, to: -49.4, type: 'door' }, // в 5
                { from: -48.6, to: -47.4, type: 'door' }  // в 4
            ], INNER_T);
            addWallLine(targetGroup, 35.2, -50.2, 40.0, -50.2, [], INNER_T);
            addWallLine(targetGroup, 36.2, -51.7, 40.0, -51.7, [], INNER_T);
            addWallLine(targetGroup, 36.2, -53.2, 40.0, -53.2, [], INNER_T);
            addWallLine(targetGroup, 35.2, -54.8, 40.0, -54.8, [], INNER_T);
            addWallLine(targetGroup, 35.2, -56.6, 40.0, -56.6, [], INNER_T);

            // Западный блок: комната 13, коридорчик, комнаты 20 и 21, секции 22 и 23, зал 24
            addWallLine(targetGroup, 41.8, -56.2, 44.8, -56.2, [], INNER_T);
            addWallLine(targetGroup, 41.8, -54.2, 44.8, -54.2, [
                { from: 42.6, to: 43.8, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 44.8, -56.2, 44.8, -54.2, [], INNER_T);

            // Блок 20 и 21 (X [46.8..50.8], Z [-56.2..-53.8])
            addWallLine(targetGroup, 46.8, -56.2, 46.8, -53.8, [
                { from: -55.6, to: -54.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 48.8, -56.2, 48.8, -53.8, [], INNER_T);
            addWallLine(targetGroup, 50.8, -56.2, 50.8, -53.8, [
                { from: -55.6, to: -54.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 46.8, -53.8, 50.8, -53.8, [], INNER_T);

            // Выступающие секции 22 и 23 (X [50.8..61.6], Z [-60.0..-56.2])
            addWallLine(targetGroup, 50.8, -56.2, 61.6, -56.2, [
                { from: 54.2, to: 55.6, type: 'door' },
                { from: 59.2, to: 60.6, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 58.4, -60.0, 58.4, -56.2, [], INNER_T);

            // 3D-плашки помещений 1-го этажа Корпуса 4 (buildingId = 4)
            addRoomLabel(targetGroup, 1, 'ЛК№2', 30.1, -48.3, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, 'ЛК№3', 65.2, -47.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, 'ЛК№1', 40.6, -27.8, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 1, '104', 34.3, -40.5, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 1, '103', 34.3, -33.4, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 1, 'Столовая', 55.5, -35.5, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 1, '1', 41.6, -38.2, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '1', 39.8, -40.2, true, false, 4, 0.78);
            addRoomLabel(targetGroup, 1, '2', 39.8, -42.2, true, false, 4, 0.78);
            addRoomLabel(targetGroup, 1, '105', 39.3, -44.3, true, false, 4, 0.78);
            addRoomLabel(targetGroup, 1, '3', 42.6, -44.3, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '11', 40.3, -47.6, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '12', 41.0, -51.5, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '14', 48.8, -47.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '15', 45.9, -51.5, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '16', 49.3, -51.5, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '17', 52.7, -51.5, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '18', 59.5, -47.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '19', 59.2, -51.2, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '4', 37.6, -48.5, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '5', 38.1, -50.9, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '6', 38.1, -52.4, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '7', 38.1, -54.0, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '8', 37.6, -55.7, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '9', 37.6, -57.4, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '10', 37.6, -58.4, true, false, 4, 0.80);
            addRoomLabel(targetGroup, 1, '13', 43.3, -55.2, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '20', 47.8, -55.0, true, false, 4, 0.80);
            addRoomLabel(targetGroup, 1, '21', 49.8, -55.0, true, false, 4, 0.80);
            addRoomLabel(targetGroup, 1, '24', 56.2, -54.5, false, false, 4, 1.1);
            addRoomLabel(targetGroup, 1, '22', 54.6, -58.1, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '23', 60.0, -58.1, true, false, 4, 0.82);
        }

        /**
         * КОРПУС 4 — ЭТАЖ 2 + ДВА ПРЯМЫХ НАДЗЕМНЫХ ПЕРЕХОДА (К КОРПУСУ 3 И К КОРПУСУ 2):
         * Исправлено по наложению:
         * 1) Спортзал 206 (X [32.4..66.0], Z [-61.6..-49.8]) консольно нависает над 1-м этажом и опирается на 14 сквозных колонн!
         * 2) Правая часть (актовый зал 204, Z [-45.4..-27.4]) доходит до X = 66.0 (на одной линии со спортзалом 206 и ЛК №3).
         * 3) Все 3 лестницы (ЛК №1, ЛК №2, ЛК №3) и центральная ось 100% совпадают с 1-м и 3-м этажами.
         */
        function buildBuilding4Floor2(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // 1. Плиты перекрытия 2-го этажа Корпуса 4 (единый контур до X = 66.0):
            // Левая половина (спортзал 206): X [32.4..66.0], Z [-61.6..-49.8] — нависает над 1-м этажом!
            addFloorRect(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_S_GYM, B4_Z_MID_N, false);
            // Правая половина (центральная лента, холл, 205-201, актовый зал 204): X [32.4..66.0], Z [-49.8..-27.4]
            addFloorRect(targetGroup, B4_X_WEST, B4_Z_MID_N, B4_X_S_HALL, B4_Z_SOUTH, false);

            // Выступающие лестничные клетки Корпуса 4:
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z2, true);
            addFloorRect(targetGroup, 61.6, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, true);
            addFloorRect(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, true);

            // --- ДВА ПРЯМЫХ НАДЗЕМНЫХ КОРИДОРА-ПЕРЕХОДА 2-ГО ЭТАЖА ---
            // 1) ПРЯМОЙ ПЕРЕХОД К3 ↔ К4 (X [15.6..32.4], Z [-46.8..-44.2]) — примыкает к ЛК №2
            addFloorRect(targetGroup, 15.6, -46.8, B4_X_WEST, -44.2, false);
            addWallLine(targetGroup, 15.6, -46.8, B4_LK2_X1, -46.8, [], OUTER_T);
            addWallLine(targetGroup, 15.6, -44.2, B4_X_WEST, -44.2, [], OUTER_T);

            // 2) ПРЯМОЙ ПЕРЕХОД К4 ↔ К2 (X [36.2..38.8], Z [-27.4..-13.8]) — между каб. 201 и ЛК №1
            addFloorRect(targetGroup, 36.2, B4_Z_SOUTH, B4_LK1_X1, B2_Z_TOP, false);
            addWallLine(targetGroup, 36.2, B4_Z_SOUTH, 36.2, B2_Z_TOP, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z2, B4_LK1_X1, B2_Z_TOP, [], OUTER_T);
            for (let i = 0; i < 4; i++) {
                const sz = -27.0 + i * 0.36;
                const heightRatio = 0.04 * (4 - i);
                const geom = new THREE.BoxGeometry(2.36, 1, 0.32);
                registerDynamicStairStep(targetGroup, geom, 37.5, sz, heightRatio, 0);
            }

            // --- ВНЕШНИЙ ПЕРИМЕТР И ЛЕСТНИЧНЫХ КЛЕТКИ 2-ГО ЭТАЖА КОРПУСА 4 ---
            // Шахта ЛК №2 (X [27.8..32.4], Z [-49.8..-46.8])
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X1, B4_LK2_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z2, B4_LK2_X2, B4_LK2_Z2, [
                { from: 30.9, to: 32.0, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, B4_LK2_X1 + 0.1, B4_LK2_X2 - 0.1, B4_LK2_Z1 + 0.1, B4_LK2_Z2 - 0.1, false);

            // Шахта ЛК №3 (X [61.6..69.0], Z [-49.8..-45.4])
            addWallLine(targetGroup, B4_X_S_GYM, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, B4_LK3_Z2, B4_LK3_X2, B4_LK3_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK3_X2, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, [], OUTER_T);
            addWallLine(targetGroup, 61.6, B4_LK3_Z1, B4_X_S_GYM, B4_LK3_Z1, [
                { from: 61.8, to: 63.0, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 61.6, B4_LK3_Z2, B4_X_S_HALL, B4_LK3_Z2, [
                { from: 61.8, to: 63.0, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, 63.2, B4_LK3_X2 - 0.15, B4_LK3_Z1 + 0.1, B4_LK3_Z2 - 0.1, false);

            // Шахта ЛК №1 (X [38.8..42.4], Z [-31.2..-24.4])
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X1, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z2, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z1, [
                { from: 39.8, to: 41.4, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, B4_LK1_X1 + 0.1, B4_LK1_X2 - 0.1, B4_LK1_Z1 + 0.1, B4_LK1_Z2 - 0.1, true);

            // Нижняя (южная) внешняя стена Корпуса 4 (X = 32.4):
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_WEST, B4_Z_SOUTH, [
                { from: -49.2, to: -47.4, type: 'door' }, // Двустворчатая дверь из ЛК №2
                { from: -46.4, to: -44.6, type: 'door' }  // Двустворчатая дверь из Перехода
            ], OUTER_T);

            // Верхняя (северная) внешняя стена спортзала 206 (X = 66.0, Z [-61.6..-49.8]) и зала 204 (X = 66.0, Z [-45.4..-27.4])
            addWallLine(targetGroup, B4_X_S_GYM, B4_Z_NORTH, B4_X_S_GYM, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, B4_LK3_Z2, B4_X_S_HALL, B4_Z_SOUTH, [], OUTER_T);

            // Левая (западная) внешняя стена зала 206 (Z = -61.6, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_S_GYM, B4_Z_NORTH, [], OUTER_T);

            // Правая (восточная) внешняя стена Корпуса 4 (Z = -27.4, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_SOUTH, B4_X_S_HALL, B4_Z_SOUTH, [
                { from: 36.5, to: 38.5, type: 'door' },
                { from: B4_LK1_X1, to: B4_LK1_X2, type: 'open' }
            ], OUTER_T);

            // --- ВНУТРЕННЯЯ ПЛАНИРОВКА 2-ГО ЭТАЖА КОРПУСА 4 ---
            // 1) Стена между спортзалом 206 и центральным холлом / помещениями (Z = -49.8, X [32.4..61.6])
            // Ограждает двусветный спортзал 206 — видна сквозь второй свет 3-го этажа!
            addWallLine(targetGroup, B4_X_WEST, B4_Z_MID_N, 61.6, B4_Z_MID_N, [
                { from: 33.4, to: 35.4, type: 'door' },
                { from: 36.6, to: 38.6, type: 'door' },
                { from: 45.6, to: 47.6, type: 'door' }
            ], OUTER_T);

            // 14 сквозных колонн по периметру спортзала 206 — строго над колоннами 1-го этажа!
            B4_GYM_COLUMNS.forEach(col => {
                addSquareColumn(targetGroup, col.x, col.z, 0.38, true);
            });

            // 2) Блок двух С/У (X [40.4..43.2], Z [-49.8..-45.4]) с компактной выемкой по центру
            addFloorRect(targetGroup, 40.8, B4_Z_MID_N, 43.2, B4_Z_MID_S, true);
            addFloorRect(targetGroup, 40.4, -49.8, 40.8, -48.6, true);
            addFloorRect(targetGroup, 40.4, -46.6, 40.8, -45.4, true);

            // Задняя стена санузлов (общая со Служеб. пом.): X = 43.2, Z [-49.8..-45.4]
            addWallLine(targetGroup, 43.2, B4_Z_MID_N, 43.2, B4_Z_MID_S, [], INNER_T);

            // Центральная перегородка между двумя санузлами: Z = -47.6
            addWallLine(targetGroup, 40.8, -47.6, 43.2, -47.6, [], 0.14);

            // Продольные перегородки кабинок туалетов (вдоль оси X) с дверьми на 90 градусов:
            // Левая (западная) кабинка: стена на Z = -48.6, дверь открывается на восток
            addWallLine(targetGroup, 40.8, -48.6, 43.2, -48.6, [
                { from: 41.5, to: 42.7, type: 'door' }
            ], 0.12);
            // Правая (восточная) кабинка: стена на Z = -46.6, дверь открывается на запад
            addWallLine(targetGroup, 40.8, -46.6, 43.2, -46.6, [
                { from: 41.5, to: 42.7, type: 'door' }
            ], 0.12);

            // Передняя стена с компактной выемкой (X [40.4..40.8]):
            // Вход в верхний санузел
            addWallLine(targetGroup, 40.4, -49.8, 40.4, -48.6, [
                { from: -49.6, to: -48.8, type: 'door' }
            ], INNER_T);
            // Торцы выемки (глубина 0.4 м)
            addWallLine(targetGroup, 40.4, -48.6, 40.8, -48.6, [], INNER_T);
            addWallLine(targetGroup, 40.4, -46.6, 40.8, -46.6, [], INNER_T);
            // Задняя стенка выемки в коридоре
            addWallLine(targetGroup, 40.8, -48.6, 40.8, -46.6, [], INNER_T);
            // Вход в нижний санузел
            addWallLine(targetGroup, 40.4, -46.6, 40.4, -45.4, [
                { from: -46.4, to: -45.6, type: 'door' }
            ], INNER_T);

            // Восточная стена блока С/У вдоль коридора: Z = -45.4, от X = 40.4 до X = 43.2
            addWallLine(targetGroup, 40.4, B4_Z_MID_S, 43.2, B4_Z_MID_S, [], INNER_T);

            // 3) Центральная лента (Z [-49.8..-45.4], X от 43.2 до 61.6): Служеб. пом., 210, 211, 212
            addWallLine(targetGroup, 43.2, B4_Z_MID_S, 61.6, B4_Z_MID_S, [
                { from: 51.6, to: 52.8, type: 'door' },
                { from: 53.6, to: 54.6, type: 'door' },
                { from: 60.0, to: 61.2, type: 'door' }
            ], INNER_T);
            [49.2, 53.2, 57.4, 61.6].forEach(xWall => {
                addWallLine(targetGroup, xWall, B4_Z_MID_N, xWall, B4_Z_MID_S, [], INNER_T);
            });
            addWallLine(targetGroup, 54.8, -46.6, 59.8, -46.6, [
                { from: 55.4, to: 56.6, type: 'door' },
                { from: 58.0, to: 59.2, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 54.8, -46.6, 54.8, B4_Z_MID_S, [], 0.12);
            addWallLine(targetGroup, 59.8, -46.6, 59.8, B4_Z_MID_S, [], 0.12);

            // Перегородка с дверью в дальний коридор между С/У и раздевалками:
            // соединяет стену коридора (X = 43.0, Z = -45.4) с углом раздевалки 208 (X = 43.0, Z = -43.6)
            addWallLine(targetGroup, 43.0, B4_Z_MID_S, 43.0, -43.6, [
                { from: -45.0, to: -44.0, type: 'door' }
            ], INNER_T);

            // 4) Блок раздевалок 207 (муж/жен) и 208 (муж/жен), а также комнат 209, 203
            const BX_BOT = 38.2, BX_208_TOP = 45.0, BX_TOP = 49.0;
            const BZ_LEFT = -43.6, BZ_RIGHT = -37.2, BZ_MID_209_203 = -40.4;

            // Внешний контур блока (верхняя стена стыкуется со стеной актового зала 204 на X = 49.0):
            addWallLine(targetGroup, BX_BOT, BZ_LEFT, BX_BOT, BZ_RIGHT, [], INNER_T);
            addWallLine(targetGroup, BX_BOT, BZ_RIGHT, BX_TOP, BZ_RIGHT, [
                { from: 46.2, to: 47.6, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, BX_TOP, BZ_LEFT, BX_TOP, BZ_RIGHT, [], INNER_T);
            addWallLine(targetGroup, BX_208_TOP, BZ_LEFT, BX_208_TOP, BZ_RIGHT, [], INNER_T);
            addWallLine(targetGroup, BX_208_TOP, BZ_MID_209_203, BX_TOP, BZ_MID_209_203, [], INNER_T);

            // Западная стена комнаты 209 (Z = -43.6) с дверью из коридора:
            addWallLine(targetGroup, BX_208_TOP, BZ_LEFT, BX_TOP, BZ_LEFT, [
                { from: 46.2, to: 47.6, type: 'door' }
            ], INNER_T);

            // Западный фасад блока раздевалок (Z = -43.6):
            // стена 208 от комн. 209 до выемки входа (X [43.0..45.0])
            addWallLine(targetGroup, 43.0, BZ_LEFT, BX_208_TOP, BZ_LEFT, [], INNER_T);
            // стена 207 до выемки входа (X [38.2..40.2])
            addWallLine(targetGroup, BX_BOT, BZ_LEFT, 40.2, BZ_LEFT, [], INNER_T);
            // Входная выемка в раздевалки (X [40.2..43.0]) — ОТКРЫТАЯ, БЕЗ ДВЕРИ!

            // Боковые стены выемки со входами в раздевалки:
            // Вход в раздевалку 208 (дверь на северной стене выемки X = 43.0)
            addWallLine(targetGroup, 43.0, BZ_LEFT, 43.0, -42.0, [
                { from: -43.4, to: -42.2, type: 'door' }
            ], INNER_T);
            // Вход в раздевалку 207 (дверь на южной стене выемки X = 40.2)
            addWallLine(targetGroup, 40.2, BZ_LEFT, 40.2, -42.0, [
                { from: -43.4, to: -42.2, type: 'door' }
            ], INNER_T);
            // Глухая задняя стенка входной выемки (Z = -42.0, X [40.2..43.0])
            addWallLine(targetGroup, 40.2, -42.0, 43.0, -42.0, [], INNER_T);

            // Внутренние симметричные санитарные блоки/душевые внутри раздевалок:
            // Плитка пола для внутренних помещений душевых/санузлов раздевалок:
            addFloorRect(targetGroup, 40.2, -42.0, 43.0, -39.8, true);

            // Продольные внутренние стены душевых (X = 43.0 и X = 40.2 от Z = -42.0 до Z = -39.8)
            addWallLine(targetGroup, 43.0, -42.0, 43.0, -39.8, [], INNER_T);
            addWallLine(targetGroup, 40.2, -42.0, 40.2, -39.8, [], INNER_T);

            // Торцевые стены внутренних комнат с дверьми из раздевалок (Z = -39.8):
            // Вход из 208 в свою внутреннюю душевую/комнату
            addWallLine(targetGroup, 41.6, -39.8, 43.0, -39.8, [
                { from: 41.8, to: 42.8, type: 'door' }
            ], INNER_T);
            // Вход из 207 в свою внутреннюю душевую/комнату
            addWallLine(targetGroup, 40.2, -39.8, 41.6, -39.8, [
                { from: 40.4, to: 41.4, type: 'door' }
            ], INNER_T);

            // Центральная разделительная перегородка между раздевалками 207 и 208:
            // идет от задней стенки входной выемки (Z = -42.0) через душевые и залы до восточной стены (Z = -37.2)
            addWallLine(targetGroup, 41.6, -42.0, 41.6, BZ_RIGHT, [], INNER_T);

            // 5) Нижний ряд кабинетов 205, подсобки, 202, 201 (X [32.4..36.2], Z [-44.2..-27.4]) — 1-в-1 над 104 и 103!
            addWallLine(targetGroup, B4_X_WEST, -44.2, 36.2, -44.2, [], INNER_T);
            addWallLine(targetGroup, 36.2, -44.2, 36.2, B4_Z_SOUTH, [
                { from: -40.2, to: -39.0, type: 'door' },
                { from: -35.8, to: -34.6, type: 'door' },
                { from: -30.0, to: -28.8, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, B4_X_WEST, -38.4, 36.2, -38.4, [
                { from: 34.4, to: 35.6, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, B4_X_WEST, -36.4, 36.2, -36.4, [
                { from: 34.4, to: 35.6, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 34.2, -38.4, 34.2, -36.4, [], 0.14);
            addWallLine(targetGroup, B4_X_WEST, -31.4, 36.2, -31.4, [], INNER_T);

            // 6) Большой актовый зал 204 (X [49.0..66.0], Z [-43.6..-27.4]) — двусветный зал!
            // Стены зала 204 ограждают двусветное пространство и строго совпадают с контуром 3-го этажа (X = 49.0)
            addWallLine(targetGroup, 49.0, -43.6, B4_X_S_HALL, -43.6, [
                { from: 58.6, to: 60.4, type: 'door' }
            ], OUTER_T);
            addWallLine(targetGroup, 49.0, BZ_LEFT, 49.0, B4_Z_SOUTH, [
                { from: -36.8, to: -34.8, type: 'door' }
            ], OUTER_T);
            [-34.2, -32.5, -30.8, -29.1].forEach(zRib => {
                addWallLine(targetGroup, 49.0 - 1.15, zRib, 49.0, zRib, [], 0.16);
            });

            // Колонны вдоль восточной стены актового зала 204 (сквозные, видны сквозь второй свет)
            [49.5, 54.8, 60.2, 65.6].forEach(cx => {
                addSquareColumn(targetGroup, cx, B4_Z_SOUTH - 0.25, 0.36, true);
            });

            // ПОДИУМ (СЦЕНА) В ЗАЛЕ 204 — двусветный элемент, всегда видим сквозь второй свет!
            const stageX1 = 61.2, stageX2 = 65.6;
            const stageZ1 = -41.0, stageZ2 = -30.2;
            const mainStageGeom = new THREE.BoxGeometry(stageX2 - (stageX1 + 0.9), 1, stageZ2 - stageZ1);
            registerDynamicStairStep(targetGroup, mainStageGeom, (stageX1 + 0.9 + stageX2) / 2, (stageZ1 + stageZ2) / 2, 0.22, 0.005, true);
            const frontStageGeom = new THREE.BoxGeometry(0.92, 1, (stageZ2 - stageZ1) - 1.8);
            registerDynamicStairStep(targetGroup, frontStageGeom, stageX1 + 0.45, (stageZ1 + stageZ2) / 2, 0.22, 0.005, true);

            // Боковые примыкающие ступени сцены (без наложения граней и с небольшим смещением по Y от плиты пола)
            const stepCount = 4;
            const stepD = 0.28;
            for (let i = 0; i < stepCount; i++) {
                const stepRatio = 0.045 * (i + 1);
                // Микрозазор stepD * 0.96 предотвращает внутреннее соприкосновение и z-fighting смежных граней
                const stepGeom = new THREE.BoxGeometry(1.24, 1, stepD * 0.96);
                const zNorth = stageZ1 - 0.14 - (stepCount - 1 - i) * stepD;
                const zSouth = stageZ2 + 0.14 + (stepCount - 1 - i) * stepD;
                registerDynamicStairStep(targetGroup, stepGeom, stageX2 - 0.8, zNorth, stepRatio, 0.005, true);
                registerDynamicStairStep(targetGroup, stepGeom, stageX2 - 0.8, zSouth, stepRatio, 0.005, true);
            }

            // 3D-плашки помещений 2-го этажа Корпуса 4 и переходов (buildingId = 4)
            addRoomLabel(targetGroup, 2, 'Спортивный зал', 49.2, -55.7, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 2, 'ЛК№2', 30.1, -48.3, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'Переход\nК3 ↔ К4', 24.0, -45.5, false, true, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'Переход\nК4 ↔ К2', 37.5, -20.6, false, true, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'С/У', 42.0, -49.2, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 2, 'С/У', 42.0, -46.0, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 2, 'Служеб.\nпом.', 46.2, -47.6, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, '210', 51.2, -47.6, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, '211', 55.3, -48.2, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '212', 59.5, -48.2, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'ЛК№3', 65.2, -47.6, true, false, 4, 0.85);

            addRoomLabel(targetGroup, 2, '205', 34.3, -41.3, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 2, '202', 34.3, -33.9, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 2, '201', 34.3, -29.4, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, '207', 39.9, -38.5, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '208', 43.3, -38.5, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '209', 47.0, -42.0, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '203', 47.0, -38.8, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'ЛК№1', 40.6, -27.8, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, 'Актовый зал', 56.6, -35.5, false, true, 4, 1.15);
        }

        /**
         * КОРПУС 4 — ЭТАЖ 3:
         * Выстроено строго по чертежу «Корпус 4 - Этаж 3.jpg»:
         * 1) Внешний периметр и сквозные шахты ЛК №1, ЛК №2, ЛК №3 сохранены на 100%.
         * 2) Зоны Второго Света:
         *    - Над спортзалом 206 (X [32.4..66.0], Z [-61.6..-49.8]) — двусветное пространство с колоннами.
         *    - Над актовым залом 204 (X [48.2..66.0], Z [-43.6..-27.4]) — двусветное пространство со сценой и колоннами.
         *    - Внутри проемов второго света на 3-м этаже строится углубленный пол (y = -BASE_FLOOR_STEP)
         *      с флагом isVoidFloor, видимый при одиночном просмотре 3-го этажа, чтобы исключить черную пустоту.
         * 3) Центральная полоса:
         *    - ЛК №3 с торцевой дверью на площадку.
         *    - Тамбур ЛК №3 с дверью в 301 и дверью в служебную зону.
         *    - Служебная комната над 302 (X [56.4..66.0], Z [-47.0..-43.6]) с дверью.
         *    - Коридор 301 с пилястрами вдоль стены второго света и дверью в главный коридор.
         *    - Зал 302 с пилястрой и дверью в 303.
         *    - Зал 303 с закрытой выгородкой в левом нижнем углу и дверью в коридор.
         * 4) Правый блок:
         *    - 305 с дверью из левого холла.
         *    - 312 с дверью из тамбура.
         *    - Тамбур перед 312 и 311 с дверями из холла 310.
         *    - 311 с дверью из холла 310.
         * 5) Средний ряд:
         *    - Входной холл слева от С/у.
         *    - Блок двух С/у с компактными выемками и комната над ними.
         *    - Помещение «Витраж» — глухой замкнутый контур.
         *    - Холл 310 с выходом в ЛК №1 и главный коридор.
         * 6) Главный коридор и нижний ряд кабинетов 306, 304, 308, 309, ЛК №2.
         */
        function buildBuilding4Floor3(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // --- 1. ПЛИТЫ ПЕРЕКРЫТИЯ 3-ГО ЭТАЖА ---
            // Центральная продольная полоса (301, 303, 302, служебный узел у ЛК №3): X [38.2..66.0], Z [-49.8..-43.6]
            addFloorRect(targetGroup, 38.2, B4_Z_MID_N, B4_X_S_HALL, -43.6, false);

            // Правая часть (305, 312, 311, тамбур, С/у, Витраж, холл 310): X [38.2..49.0], Z [-43.6..-27.4]
            addFloorRect(targetGroup, 38.2, -43.6, 49.0, B4_Z_SOUTH, false);

            // Главный коридор и нижний ряд кабинетов (306, 304, 308, 309): X [32.4..38.2], Z [-49.8..-27.4]
            addFloorRect(targetGroup, B4_X_WEST, B4_Z_MID_N, 38.2, B4_Z_SOUTH, false);

            // Акцентная плитка в блоке двух С/у и в Витраже
            addFloorRect(targetGroup, 38.2, -41.4, 41.6, -37.2, true); // Два С/у
            addFloorRect(targetGroup, 38.2, -37.2, 45.4, -33.6, true); // Витраж

            // Плиты трех сквозных лестничных клеток (1-в-1 со 2-м этажом)
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z2, true);
            addFloorRect(targetGroup, 61.6, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, true);
            addFloorRect(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, true);

            // Проемы Второго Света (над спортзалом 206 и над актовым залом 204) — чистые сквозные проёмы без плит пола

            // --- 2. ВНЕШНИЙ ПЕРИМЕТР И ЛЕСТНИЧНЫЕ КЛЕТКИ (100% СОВПАДЕНИЕ СО 2-М ЭТАЖОМ) ---
            // Южная внешняя стена Корпуса 4 (X = 32.4, Z [-61.6..-27.4]) с выходом из ЛК №2
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_WEST, B4_Z_SOUTH, [
                { from: -49.1, to: -47.5, type: 'door' }
            ], OUTER_T);

            // Северная внешняя стена Корпуса 4 (X = 66.0) вдоль обоих Вторых светов и ЛК №3
            addWallLine(targetGroup, B4_X_S_GYM, B4_Z_NORTH, B4_X_S_GYM, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, B4_LK3_Z2, B4_X_S_HALL, B4_Z_SOUTH, [], OUTER_T);

            // Западная внешняя стена левого Второго света над залом 206 (Z = -61.6, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_S_GYM, B4_Z_NORTH, [], OUTER_T);

            // Восточная внешняя стена Корпуса 4 (Z = -27.4, X [32.4..66.0]) с проёмом ЛК №1
            addWallLine(targetGroup, B4_X_WEST, B4_Z_SOUTH, B4_X_S_HALL, B4_Z_SOUTH, [
                { from: B4_LK1_X1, to: B4_LK1_X2, type: 'open' }
            ], OUTER_T);

            // Шахта ЛК №2 (южная, X [27.8..32.4], Z [-49.8..-46.8])
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z2, B4_LK2_X2, B4_LK2_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X1, B4_LK2_Z2, [], OUTER_T);
            buildB4Staircase(targetGroup, B4_LK2_X1 + 0.1, B4_LK2_X2 - 0.1, B4_LK2_Z1 + 0.1, B4_LK2_Z2 - 0.1, false);

            // Шахта ЛК №3 (северная, X [61.6..69.0], Z [-49.8..-45.4])
            addWallLine(targetGroup, B4_X_S_GYM, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, B4_LK3_Z2, B4_LK3_X2, B4_LK3_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK3_X2, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, [], OUTER_T);
            // Торцевая стена площадки ЛК №3 (X = 61.6, Z [-49.8..-45.4]) с дверью на площадку
            addWallLine(targetGroup, 61.6, B4_LK3_Z1, 61.6, B4_LK3_Z2, [
                { from: -49.0, to: -47.6, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, 63.2, B4_LK3_X2 - 0.15, B4_LK3_Z1 + 0.1, B4_LK3_Z2 - 0.1, false);

            // Шахта ЛК №1 (восточная, X [38.8..42.4], Z [-31.2..-24.4])
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X1, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z2, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            // Входная стена ЛК №1 (Z = -31.2, X [38.8..42.4]) с двустворчатой дверью из холла 310
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z1, [
                { from: 39.6, to: 41.6, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, B4_LK1_X1 + 0.1, B4_LK1_X2 - 0.1, B4_LK1_Z1 + 0.1, B4_LK1_Z2 - 0.1, true);

            // --- 3. СТЕНЫ И КОЛОННЫ ОБЕИХ ЗОН ВТОРОГО СВЕТА ---
            // Капитальная стена между левым Вторым светом и полосой 301 (Z = -49.8, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_MID_N, B4_X_S_GYM, B4_Z_MID_N, [], OUTER_T);

            // 14 сквозных колонн по периметру левого Второго света (спортзал 206)
            B4_GYM_COLUMNS.forEach(col => {
                addSquareColumn(targetGroup, col.x, col.z, 0.38, true);
            });

            // Капитальные стены вокруг правого Второго света (над залом 204, X [49.0..66.0], Z [-43.6..-27.4]):
            // Левая стена Второго света (Z = -43.6, X [49.0..66.0])
            addWallLine(targetGroup, 49.0, -43.6, B4_X_S_HALL, -43.6, [], OUTER_T);
            // Нижняя стена Второго света (X = 49.0, Z [-43.6..-27.4]) — на одной линии с перегородкой 302/303!
            addWallLine(targetGroup, 49.0, -43.6, 49.0, B4_Z_SOUTH, [], OUTER_T);

            // 4 колонны вдоль правой внешней стены правого Второго света
            [49.5, 54.8, 60.2, 65.6].forEach(cx => {
                addSquareColumn(targetGroup, cx, B4_Z_SOUTH - 0.25, 0.36, true);
            });

            // --- 4. ЦЕНТРАЛЬНАЯ ПРОДОЛЬНАЯ ПОЛОСА: ЛК №3, 301, 302, 303 И СЛУЖЕБНЫЙ УЗЕЛ НАД 302 ---
            // Нижняя граница 301 и 303 вдоль главного коридора (X = 38.2, Z [-49.8..-43.6]) с двумя дверьми
            addWallLine(targetGroup, 38.2, -49.8, 38.2, -43.6, [
                { from: -49.2, to: -48.0, type: 'door' }, // Вход в коридор 301
                { from: -45.4, to: -44.2, type: 'door' }  // Вход в зал 303
            ], INNER_T);

            // Продольная разделительная стена между коридором 301 и залами 303 / 302 (Z = -47.6, X [38.2..58.2])
            addWallLine(targetGroup, 38.2, -47.6, 58.2, -47.6, [], INNER_T);

            // Тамбур ЛК №3 (X [58.2..61.6], Z [-49.8..-47.6]):
            // Правая стена тамбура (Z = -47.6, X [58.2..61.6]) с дверью в правую служебную зону
            addWallLine(targetGroup, 58.2, -47.6, 61.6, -47.6, [
                { from: 59.4, to: 60.6, type: 'door' }
            ], INNER_T);
            // Поперечная стена с дверью в коридор 301 (X = 58.2, Z [-49.8..-47.6])
            addWallLine(targetGroup, 58.2, -49.8, 58.2, -47.6, [
                { from: -49.2, to: -48.0, type: 'door' }
            ], INNER_T);

            // Служебная зона над залом 302 (X [56.0..66.0], Z [-47.6..-43.6]):
            // Верхняя поперечная стена зала 302 (X = 56.0, Z [-47.6..-43.6])
            addWallLine(targetGroup, 56.0, -47.6, 56.0, -43.6, [], INNER_T);
            // Продольная стена служебного коридора/комнаты (Z = -45.4, X [56.0..66.0]) с дверью
            addWallLine(targetGroup, 56.0, -45.4, 66.0, -45.4, [
                { from: 58.2, to: 59.4, type: 'door' }
            ], INNER_T);
            // Поперечная перегородка подсобки слева (X = 59.8, Z [-47.6..-45.4])
            addWallLine(targetGroup, 59.8, -47.6, 59.8, -45.4, [], 0.14);
            // Задняя перемычка ниши справа (X = 58.2, Z [-45.4..-43.6])
            addWallLine(targetGroup, 58.2, -45.4, 58.2, -43.6, [], 0.14);

            // Пилястры (выступы колонн) строго по плану 3-го этажа:
            addSquareColumn(targetGroup, 44.2, -49.55, 0.36); // Нижняя пилястра на левой стене 301
            addSquareColumn(targetGroup, 49.6, -49.55, 0.36); // Верхняя пилястра на левой стене 301
            addSquareColumn(targetGroup, 52.8, -47.35, 0.36); // Пилястра на стене в зале 302

            // Горизонтальная стена между залами 303 и 302 (X = 49.0, Z [-47.6..-43.6]) — на одной прямой со стеной Второго света!
            addWallLine(targetGroup, 49.0, -47.6, 49.0, -43.6, [
                { from: -45.2, to: -44.0, type: 'door' }
            ], INNER_T);

            // Правая продольная стена зала 303 (Z = -43.6, X [38.2..49.0])
            addWallLine(targetGroup, 38.2, -43.6, 49.0, -43.6, [], INNER_T);

            // Закрытая угловая выгородка (подсобка) в левом нижнем углу зала 303 (X [38.2..41.2], Z [-47.6..-46.2])
            addWallLine(targetGroup, 41.2, -47.6, 41.2, -46.2, [], 0.14);
            addWallLine(targetGroup, 38.2, -46.2, 41.2, -46.2, [
                { from: 38.8, to: 40.0, type: 'door' }
            ], 0.14);

            // --- 5. СРЕДНИЙ БЛОК: 305, 312, 311, С/У, ВИТРАЖ И ХОЛЛ 310 (X [38.2..49.0], Z [-43.6..-27.4]) ---
            // Горизонтальная стена между рядом (305, 312, тамбур, 311) и рядом (холл, С/у, Витраж, 310): X = 45.4
            addWallLine(targetGroup, 45.4, -43.6, 45.4, B4_Z_SOUTH, [
                { from: -43.2, to: -42.0, type: 'door' }, // Вход в 305 из левого холла
                { from: -32.8, to: -31.6, type: 'door' }, // Вход из холла 310 в тамбур перед 312
                { from: -29.4, to: -28.2, type: 'door' }  // Вход из холла 310 в 311
            ], INNER_T);

            // Перегородка между 305 и 312 (Z = -39.6, X [45.4..49.0]) — глухая
            addWallLine(targetGroup, 45.4, -39.6, 49.0, -39.6, [], INNER_T);

            // Перегородка между 312 и правым тамбуром (Z = -33.2, X [45.4..49.0]) с дверью в 312
            addWallLine(targetGroup, 45.4, -33.2, 49.0, -33.2, [
                { from: 45.6, to: 46.8, type: 'door' }
            ], INNER_T);

            // Перегородка ниши внутри тамбура (X = 47.0, Z [-33.2..-31.2])
            addWallLine(targetGroup, 47.0, -33.2, 47.0, -31.2, [], 0.14);

            // Перегородка между тамбуром и комнатой 311 (Z = -29.8, X [45.4..49.0]) — глухая
            addWallLine(targetGroup, 45.4, -29.8, 49.0, -29.8, [], INNER_T);

            // Проходной входной холл слева от С/у (X [38.2..45.4], Z [-43.6..-41.4]):
            // Входная стенка из главного коридора с дверью (X = 38.2, Z [-43.6..-41.4])
            addWallLine(targetGroup, 38.2, -43.6, 38.2, -41.4, [
                { from: -43.2, to: -42.0, type: 'door' }
            ], INNER_T);

            // Блок двух С/у и верхней комнаты (X [38.2..45.4], Z [-41.4..-37.2]):
            // Левая стена блока с дверью в верхнюю служебную комнату (Z = -41.4, X [38.2..45.4])
            addWallLine(targetGroup, 38.2, -41.4, 45.4, -41.4, [
                { from: 43.0, to: 44.2, type: 'door' }
            ], INNER_T);
            // Горизонтальная стена между верхней комнатой и двумя С/у (X = 41.6, Z [-41.4..-37.2])
            addWallLine(targetGroup, 41.6, -41.4, 41.6, -37.2, [], INNER_T);
            // Перегородка между двумя санузлами (Z = -39.3, X [38.2..41.6])
            addWallLine(targetGroup, 38.2, -39.3, 41.6, -39.3, [], 0.14);
            // Перегородки кабинок внутри обоих С/у (X = 39.8, Z [-41.4..-37.2])
            addWallLine(targetGroup, 39.8, -41.4, 39.8, -37.2, [
                { from: -41.0, to: -40.0, type: 'door' },
                { from: -38.9, to: -37.9, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 38.2, -40.3, 39.8, -40.3, [], 0.12);
            addWallLine(targetGroup, 38.2, -38.3, 39.8, -38.3, [], 0.12);
            // Нижняя стена санузлов с двумя входными дверьми (X = 38.2, Z [-41.4..-37.2])
            addWallLine(targetGroup, 38.2, -41.4, 38.2, -37.2, [
                { from: -41.2, to: -40.2, type: 'door' },
                { from: -38.4, to: -37.4, type: 'door' }
            ], INNER_T);

            // Помещение «Витраж» (X [38.2..45.4], Z [-37.2..-33.6]) — глухой замкнутый контур с открытым проходом к ЛК №1
            addWallLine(targetGroup, 38.2, -37.2, 45.4, -37.2, [], INNER_T); // Левая стена (с санузлами)
            addWallLine(targetGroup, 38.2, -33.6, 45.4, -33.6, [], INNER_T); // Правая стена (граница с холлом 310)
            addWallLine(targetGroup, 38.2, -37.2, 38.2, -33.6, [], INNER_T); // Нижняя стена вдоль коридора

            // Холл 310 (X [38.2..45.4], Z [-33.6..-27.4]):
            // Вход из главного коридора в холл 310 с дверью (X = 38.2, Z [-33.6..-31.2])
            addWallLine(targetGroup, 38.2, -33.6, 38.2, B4_LK1_Z1, [
                { from: -33.0, to: -31.8, type: 'door' }
            ], INNER_T);
            // Соединительная стена к углу шахты ЛК №1 (Z = -31.2, X [38.2..38.8])
            addWallLine(targetGroup, 38.2, B4_LK1_Z1, B4_LK1_X1, B4_LK1_Z1, [], INNER_T);

            // --- 6. ГЛАВНЫЙ КОРИДОР И НИЖНИЙ РЯД КАБИНЕТОВ: 306, 304, 308, 309 (X [32.4..36.2]) ---
            // Дверная перегородка в коридоре у ЛК №2 (Z = -46.8, X [36.2..38.2])
            addWallLine(targetGroup, 36.2, -46.8, 38.2, -46.8, [
                { from: 36.5, to: 37.9, type: 'door' }
            ], INNER_T);

            // Левая торцевая стена кабинета 306 (Z = -46.8, X [32.4..36.2])
            addWallLine(targetGroup, B4_X_WEST, -46.8, 36.2, -46.8, [], INNER_T);

            // Горизонтальная стена вдоль южного коридора (X = 36.2, Z [-46.8..-27.4]) с 4 дверьми
            addWallLine(targetGroup, 36.2, -46.8, 36.2, B4_Z_SOUTH, [
                { from: -43.8, to: -42.6, type: 'door' }, // Вход в 306
                { from: -39.4, to: -38.2, type: 'door' }, // Вход в 304
                { from: -34.6, to: -33.4, type: 'door' }, // Вход в 308
                { from: -31.6, to: -30.4, type: 'door' }  // Вход в 309
            ], INNER_T);

            // Вертикальные перегородки между кабинетами 306, 304, 308 и 309
            addWallLine(targetGroup, B4_X_WEST, -41.8, 36.2, -41.8, [], INNER_T); // Между 306 и 304
            addWallLine(targetGroup, B4_X_WEST, -37.2, 36.2, -37.2, [], INNER_T); // Между 304 и 308
            addWallLine(targetGroup, B4_X_WEST, -32.4, 36.2, -32.4, [], INNER_T); // Между 308 и 309

            // --- 7. 3D-ПЛАШКИ ПОМЕЩЕНИЙ 3-ГО ЭТАЖА КОРПУСА 4 (buildingId = 4) ---
            addRoomLabel(targetGroup, 3, 'Второй свет', 49.2, -55.7, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 3, 'Второй свет', 57.5, -35.5, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 3, 'Витраж', 41.8, -35.4, false, true, 4, 0.95);

            addRoomLabel(targetGroup, 3, 'ЛК№2', 30.1, -48.3, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 3, 'ЛК№3', 65.2, -47.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 3, 'ЛК№1', 40.6, -27.8, true, false, 4, 0.88);

            addRoomLabel(targetGroup, 3, '301', 48.0, -48.4, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 3, '302', 51.8, -45.3, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 3, '303', 44.5, -45.3, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 3, '305', 46.6, -41.6, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 3, '312', 46.6, -36.4, false, false, 4, 0.92);
            addRoomLabel(targetGroup, 3, '311', 46.6, -28.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 3, '310', 41.8, -30.2, true, false, 4, 0.88);

            addRoomLabel(targetGroup, 3, 'С/у', 40.7, -40.35, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 3, 'С/у', 40.7, -38.25, true, false, 4, 0.72);

            addRoomLabel(targetGroup, 3, '306', 34.3, -44.3, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '304', 34.3, -39.5, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '308', 34.3, -34.8, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '309', 34.3, -29.9, true, false, 4, 0.90);
        }
window.buildBuilding4Floor1 = buildBuilding4Floor1;
window.buildBuilding4Floor2 = buildBuilding4Floor2;
window.buildBuilding4Floor3 = buildBuilding4Floor3;
