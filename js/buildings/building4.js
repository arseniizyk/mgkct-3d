// ==========================================
// КОРПУС 4 (Этажи 1–3 + переходы) — ИСПРАВЛЕННАЯ ГЕОМЕТРИЯ ПО НАЛОЖЕНИЮ ПЛАНОВ БТИ
// ==========================================

        // Координатная сетка Корпуса 4 (единые сквозные шахты лестниц для 1, 2 и 3 этажей)
        const B4_X_S_GYM = 66.0;   // Восточный край спортзала 206
        const B4_X_S_HALL = 66.0;  // Восточный край зала 102 / 204 (на одной линии со спортзалом и ЛК №3)

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
         * КОРПУС 4 — ЭТАЖ 1 (СТРОГО ПО ЧЕРТЕЖУ БТИ planning_zip/Корпус 4/1.jpg):
         * 1) Шахта ЛК №2 (X [27.8..34.4], Z [-49.8..-45.4]) с северным крыльцом, боковым выходом в тамбур (X = 34.4)
         *    и дверью из тамбура ЛК №2 на юг в западный входной тамбур (X [32.4..34.6], Z [-45.4..-42.4]).
         * 2) Под нависающим переходом 2-го этажа (X [28.8..32.4], Z [-45.4..-42.4]) — открытая площадка крыльца со ступенями на юг.
         * 3) Блок 11, 3-дверный тамбур (перегородка X = 42.6), 105, 3, санузлы 2 и 1 (раздельные перегородки кабинок без пересечений), зал 1.
         * 4) Южный входной тамбур правее ЛК №1 (X [42.4..45.0]): внутренняя дверь на Z = -30.5, наружная на Z = -27.4 (в створ со столовой 102), крыльцо ниже Z = -27.4.
         * 5) Производственный блок столовой (4–10, 12–24) строго по координатам БТИ.
         */
        function buildBuilding4Floor1(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // --- 1. ПЛИТЫ ПЕРЕКРЫТИЯ 1-ГО ЭТАЖА (СТРОГО ПО ЭТАЛОННОМУ ЧЕРТЕЖУ БТИ 1.JPG) ---
            // Большой зал столовой 102 (X [45.0..66.0], Z [-45.4..-27.4])
            addFloorRect(targetGroup, 45.0, -45.4, 66.0, -27.4, false);

            // Юго-западный блок комнат 104, 103 и холла (X [32.4..39.2], Z [-45.4..-36.2])
            addFloorRect(targetGroup, 32.4, -45.4, 39.2, -36.2, false);

            // Блок помещений 105, 3, 2, 1 (X [39.2..45.0], Z [-46.2..-36.2])
            addFloorRect(targetGroup, 39.2, -46.2, 45.0, -36.2, false);

            // Единое сплошное южное фойе перед входом и ЛК №1 (X [32.4..45.0], Z [-36.2..-27.4])
            addFloorRect(targetGroup, 32.4, -36.2, 45.0, -27.4, false);

            // Открытая площадка западного крыльца под переходом (X [28.8..32.4], Z [-45.4..-42.4]) и ступени на юг
            addFloorRect(targetGroup, 28.8, -45.4, 32.4, -42.4, true);
            buildB4ExteriorPorch(targetGroup, 30.8, -42.4, 32.4, -41.0, 'south');

            // Шахта ЛК №2 (X [27.8..35.6], Z [-49.8..-45.4]) и северное крыльцо
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, 35.6, -45.4, true);
            buildB4ExteriorPorch(targetGroup, 28.7, -51.3, 31.4, B4_LK2_Z1, 'north');

            // Западный блок комнат 8–10 (строго под стенами X [35.6..40.7], Z [-60.4..-54.3])
            addFloorRect(targetGroup, 35.6, -60.4, 40.7, -54.3, false);
            buildB4ExteriorPorch(targetGroup, 40.8, -61.6, 42.4, -60.4, 'north');

            // Западный ряд комнат 4–7 (X [35.6..39.2], Z [-54.3..-45.4])
            addFloorRect(targetGroup, 35.6, -54.3, 39.2, -45.4, false);

            // Единый монолитный контур северного производственного блока (цеха 22, 23, 24, комн. 12, 13, 15–17, 19, 20, 21 и коридоры)
            addFloorPolygon(targetGroup, [
                [39.2, -49.7],
                [39.2, -54.3],
                [40.7, -54.3],
                [40.7, -60.4],
                [42.6, -60.4],
                [42.6, -58.4],
                [52.4, -58.4],
                [52.4, -60.4],
                [62.3, -60.4],
                [62.3, -49.7]
            ], false);

            // Кабинет 11 и 3-дверный тамбур (X [39.2..45.0], Z [-49.7..-46.2])
            addFloorRect(targetGroup, 39.2, -49.7, 45.0, -46.2, false);

            // Мойка 14 (строго по периметру стен X [45.0..55.4], Z [-49.7..-45.4])
            addFloorRect(targetGroup, 45.0, -49.7, 55.4, -45.4, false);

            // Восточный коридор и комната 18 (X [55.4..62.3], Z [-49.7..-45.4])
            addFloorRect(targetGroup, 55.4, -49.7, 62.3, -45.4, false);

            // Шахта ЛК №3 (X [62.3..69.0], Z [-49.8..-45.4])
            addFloorRect(targetGroup, 62.3, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z2, true);

            // Южный узел: ЛК №1 (X [38.8..42.4], Z [-31.2..-24.4]) и крыльцо входного тамбура столовой
            addFloorRect(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, true);
            buildB4ExteriorPorch(targetGroup, B4_LK1_X2, -27.4, 45.0, -25.1, 'south');

            // Акцентный пол санузлов 2 и 1 (X [39.2..45.0], Z [-43.5..-39.4])
            addFloorRect(targetGroup, 39.2, -43.5, 45.0, -39.4, true);

            // --- 2. СКВОЗНЫЕ ОПОРНЫЕ КОЛОННЫ НА 1-М ЭТАЖЕ ПОД НАВИСАЮЩИМ СПОРТЗАЛОМ 206 ---
            B4_GYM_COLUMNS.forEach(col => {
                addSquareColumn(targetGroup, col.x, col.z, 0.42, true);
            });

            // --- 3. СТЕНЫ ЛЕСТНИЧНЫХ КЛЕТОК И ВНЕШНЕГО ПЕРИМЕТРА 1-ГО ЭТАЖА ---
            // Шахта ЛК №1 (X [38.8..42.4], Z [-31.2..-24.4])
            addWallLine(targetGroup, 38.8, -31.2, 38.8, -24.4, [], OUTER_T);
            addWallLine(targetGroup, 42.4, -31.2, 42.4, -24.4, [], OUTER_T);
            addWallLine(targetGroup, 38.8, -24.4, 42.4, -24.4, [], OUTER_T);
            addWallLine(targetGroup, 38.8, -31.2, 42.4, -31.2, [{ from: 39.8, to: 41.4, type: 'door' }], INNER_T);
            buildB4Staircase(targetGroup, 38.9, 42.3, -31.1, -24.5, true);

            // Входной тамбур правее ЛК №1 (X [42.4..45.0], Z [-30.5..-27.4]) строго по БТИ 1.jpg
            addWallLine(targetGroup, 42.4, -30.5, 45.0, -30.5, [{ from: 43.0, to: 44.4, type: 'door' }], INNER_T);
            addWallLine(targetGroup, 42.4, -27.4, 45.0, -27.4, [{ from: 43.0, to: 44.4, type: 'door' }], OUTER_T);
            addWallLine(targetGroup, 45.0, -30.5, 45.0, -27.4, [], OUTER_T);

            // Южная внешняя стена 1-го этажа (Z = -27.4) и восточная стена зала 102 (X = 66.0)
            addWallLine(targetGroup, 32.4, -27.4, 38.8, -27.4, [], OUTER_T);
            addWallLine(targetGroup, 45.0, -27.4, 66.0, -27.4, [], OUTER_T);
            addWallLine(targetGroup, 66.0, -45.4, 66.0, -27.4, [], OUTER_T);

            // Шахта ЛК №2 (X [27.8..35.6], Z [-49.8..-45.4])
            addWallLine(targetGroup, 27.8, -49.8, 35.6, -49.8, [{ from: 29.2, to: 30.4, type: 'door' }], OUTER_T);
            addWallLine(targetGroup, 27.8, -49.8, 27.8, -45.4, [], OUTER_T);
            addWallLine(targetGroup, 27.8, -45.4, 35.6, -45.4, [{ from: 34.5, to: 35.5, type: 'door' }], OUTER_T);
            buildB4Staircase(targetGroup, 29.2, 34.2, -49.7, -45.5, false);

            // Западный входной тамбур (X [32.4..34.6], Z [-45.4..-42.4]) по БТИ 1.jpg
            addWallLine(targetGroup, 32.4, -45.4, 32.4, -42.4, [{ from: -44.6, to: -43.2, type: 'door' }], OUTER_T);
            addWallLine(targetGroup, 34.6, -45.4, 34.6, -42.4, [{ from: -44.6, to: -43.2, type: 'door' }], INNER_T);

            // Западная внешняя стена вдоль 104, 103 (X = 32.4, Z [-42.4..-27.4])
            addWallLine(targetGroup, 32.4, -42.4, 32.4, -27.4, [], OUTER_T);

            // Прямая западная внешняя стена комнат 4–10 (X = 35.6, Z [-60.4..-45.4]) по БТИ
            addWallLine(targetGroup, 35.6, -60.4, 35.6, -45.4, [], OUTER_T);
            addWallLine(targetGroup, 35.6, -60.4, 40.7, -60.4, [], OUTER_T);

            // Северный выход из коридора между 10 и 13 (X [40.7..42.6], Z = -60.4 / -59.3)
            addWallLine(targetGroup, 40.7, -60.4, 42.6, -60.4, [{ from: 41.1, to: 42.2, type: 'door' }], OUTER_T);
            addWallLine(targetGroup, 40.7, -59.3, 42.6, -59.3, [{ from: 41.1, to: 42.2, type: 'door' }], INNER_T);
            addWallLine(targetGroup, 42.6, -60.4, 42.6, -58.4, [], OUTER_T);

            // Уступ северного фасада над 13, проходом, 20 и 21 (Z = -58.4, X [42.6..52.4])
            addWallLine(targetGroup, 42.6, -58.4, 52.4, -58.4, [
                { from: 43.4, to: 44.6, type: 'door' }, // Двустворчатый выход тамбура 13
                { from: 46.1, to: 47.4, type: 'door' }  // Двустворчатый выход прохода правее 13
            ], OUTER_T);
            addWallLine(targetGroup, 52.4, -60.4, 52.4, -58.4, [], OUTER_T);

            // Северная внешняя стена цехов 22 и 23 (Z = -60.4, X [52.4..62.3])
            addWallLine(targetGroup, 52.4, -60.4, 62.3, -60.4, [], OUTER_T);

            // Восточная внешняя стена цехов 23, 24, 19, 18 по линии ЛК №3 (X = 62.3, Z [-60.4..-45.4])
            addWallLine(targetGroup, 62.3, -60.4, 62.3, -49.8, [], OUTER_T);
            addWallLine(targetGroup, 62.3, -49.8, 62.3, -45.4, [], INNER_T);

            // Шахта ЛК №3 (X [62.3..69.0], Z [-49.8..-45.4])
            addWallLine(targetGroup, 62.3, -49.8, 69.0, -49.8, [], OUTER_T);
            addWallLine(targetGroup, 69.0, -49.8, 69.0, -45.4, [{ from: -48.4, to: -46.8, type: 'door' }], OUTER_T);
            addWallLine(targetGroup, 62.3, -45.4, 66.0, -45.4, [
                { from: 62.7, to: 64.1, type: 'door' } // Двустворчатая дверь из ЛК №3 в столовую 102
            ], INNER_T);
            addWallLine(targetGroup, 66.0, -45.4, 69.0, -45.4, [], OUTER_T);
            buildB4Staircase(targetGroup, 64.3, 68.85, -49.7, -45.5, false);

            // --- 4. ВНУТРЕННИЕ ПЕРЕГОРОДКИ 1-ГО ЭТАЖА КОРПУСА 4 ПО ПЛАНУ БТИ ---
            // Блок комнат 104 и 103 (X [32.4..37.4], Z [-42.4..-27.4])
            addWallLine(targetGroup, 32.4, -42.4, 37.4, -42.4, [], INNER_T);
            addWallLine(targetGroup, 32.4, -36.2, 37.4, -36.2, [], INNER_T);
            addWallLine(targetGroup, 37.4, -42.4, 37.4, -30.5, [
                { from: -39.2, to: -37.8, type: 'door' }, // Дверь в 104
                { from: -32.8, to: -31.4, type: 'door' }  // Дверь в 103
            ], INNER_T);
            addWallLine(targetGroup, 37.4, -30.5, 38.8, -30.5, [], INNER_T);

            // --- БЛОК 105, 3, 2, 1 (ВЕРХНИЙ С/У), 1 (НИЖНИЙ ЗАЛ) (X [39.2..45.0], Z [-46.2..-36.2]) ---
            // Северная стена блока 105 и 3 (Z = -46.2, X [39.2..45.0]) с дверью в 3 из 3-дверного тамбура
            addWallLine(targetGroup, 39.2, -46.2, 45.0, -46.2, [
                { from: 43.4, to: 44.5, type: 'door' }   // Вход в 3 из тамбура
            ], INNER_T);

            // Вертикальная перегородка между 105 и 3 (X = 40.9, Z [-46.2..-43.5])
            addWallLine(targetGroup, 40.9, -46.2, 40.9, -43.5, [], INNER_T);

            // Горизонтальная стена между (105, 3) и санузлом 2 (Z = -43.5, X [39.2..45.0])
            addWallLine(targetGroup, 39.2, -43.5, 45.0, -43.5, [], INNER_T);

            // Горизонтальная стена между санузлом 2 и верхним санузлом 1 (Z = -41.4, X [39.2..45.0])
            addWallLine(targetGroup, 39.2, -41.4, 45.0, -41.4, [], INNER_T);

            // Горизонтальная стена между верхним санузлом 1 и нижним помещением 1 (Z = -39.4, X [39.2..45.0])
            addWallLine(targetGroup, 39.2, -39.4, 45.0, -39.4, [], INNER_T);

            // Южная стена нижнего помещения 1 (Z = -36.2, X [39.2..45.0]) с двумя проемами в южное фойе
            addWallLine(targetGroup, 39.2, -36.2, 45.0, -36.2, [
                { from: 40.0, to: 41.7, type: 'open' },
                { from: 42.3, to: 44.0, type: 'open' }
            ], INNER_T);

            // Внутренние перегородки и кабинки санузла 2 (Z [-43.5..-41.4]) и санузла 1 (Z [-41.4..-39.4]) — разделены по Z = -41.4 без взаимного пересечения!
            addWallLine(targetGroup, 41.5, -43.5, 41.5, -41.4, [
                { from: -43.2, to: -42.3, type: 'door' }  // Проход к кабинкам 2
            ], 0.12);
            addWallLine(targetGroup, 41.5, -41.4, 41.5, -39.4, [
                { from: -40.5, to: -39.6, type: 'door' }  // Проход к кабинкам 1
            ], 0.12);
            addWallLine(targetGroup, 42.7, -43.5, 42.7, -41.4, [
                { from: -43.3, to: -42.6, type: 'door' },
                { from: -42.3, to: -41.6, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 42.7, -41.4, 42.7, -39.4, [
                { from: -41.2, to: -40.5, type: 'door' },
                { from: -40.2, to: -39.5, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 42.7, -42.45, 45.0, -42.45, [], 0.10);
            addWallLine(targetGroup, 42.7, -40.4, 45.0, -40.4, [], 0.10);

            // Западная стена зала столовой 102 (X = 45.0, Z [-45.4..-30.5]) с двумя двустворчатыми дверьми из южного фойе
            addWallLine(targetGroup, 45.0, -45.4, 45.0, -30.5, [
                { from: -36.0, to: -34.5, type: 'door' }, // Северная дверь в столовую 102
                { from: -32.6, to: -31.1, type: 'door' }  // Южная дверь в столовую 102
            ], INNER_T);

            // --- ЗАПАДНЫЙ РЯД КОМНАТ 4–10 (X [35.6..40.7], Z [-60.4..-45.4]) ---
            // Коридорная стена комнат 8, 9, 10 (X = 40.7, Z [-60.4..-54.3])
            addWallLine(targetGroup, 40.7, -60.4, 40.7, -54.3, [
                { from: -58.3, to: -57.3, type: 'door' }, // Вход в 10
                { from: -56.6, to: -55.7, type: 'door' }, // Вход в 9
                { from: -55.3, to: -54.4, type: 'door' }  // Вход в 8
            ], INNER_T);

            // Единая прямая коридорная стена комнат 4–7 и блока 105, 2, 1 (X = 39.2, Z [-54.3..-36.2])
            addWallLine(targetGroup, 39.2, -54.3, 39.2, -36.2, [
                { from: -54.1, to: -53.3, type: 'door' }, // Вход в 7
                { from: -52.9, to: -52.1, type: 'door' }, // Вход в 6
                { from: -51.7, to: -50.9, type: 'door' }, // Вход в 5
                { from: -50.5, to: -49.5, type: 'door' }, // Вход в 4
                { from: -45.4, to: -44.2, type: 'door' }, // Вход в 105
                { from: -42.9, to: -41.8, type: 'door' }, // Вход в санузел 2
                { from: -40.9, to: -39.8, type: 'door' }  // Вход в верхний санузел 1
            ], INNER_T);

            // Горизонтальные перегородки комнат 4..10
            addWallLine(targetGroup, 35.6, -57.2, 40.7, -57.2, [], INNER_T); // Между 10 и 9
            addWallLine(targetGroup, 35.6, -55.5, 40.7, -55.5, [], INNER_T); // Между 9 и 8
            addWallLine(targetGroup, 35.6, -54.3, 40.7, -54.3, [
                { from: 39.3, to: 40.5, type: 'door' } // Дверь на уступе коридора у комн. 7/8
            ], INNER_T);
            addWallLine(targetGroup, 35.6, -53.1, 39.2, -53.1, [], INNER_T); // Между 7 и 6
            addWallLine(targetGroup, 35.6, -51.9, 39.2, -51.9, [], INNER_T); // Между 6 и 5
            addWallLine(targetGroup, 35.6, -50.7, 39.2, -50.7, [], INNER_T); // Между 5 и 4
            addWallLine(targetGroup, 35.6, -45.4, 39.2, -45.4, [], INNER_T); // Глухая южная стена комн. 4

            // --- ОСТРОВНОЙ КАБИНЕТ 12, КАБИНЕТ 11 И 3-ДВЕРНЫЙ ТАМБУР (X [39.2..45.0], Z [-52.6..-46.2]) ---
            // Кабинет 12 (X [41.0..43.3], Z [-52.6..-49.7])
            addWallLine(targetGroup, 41.0, -52.6, 43.3, -52.6, [], INNER_T);
            addWallLine(targetGroup, 43.3, -52.6, 43.3, -49.7, [], INNER_T);
            addWallLine(targetGroup, 41.0, -52.6, 41.0, -49.7, [
                { from: -52.3, to: -51.3, type: 'door' } // Вход в 12 из западного коридора
            ], INNER_T);

            // Кабинет 11 (X [39.2..42.6], Z [-49.7..-46.2]) и 3-дверный тамбур (X [42.6..45.0], Z [-49.7..-46.2])
            addWallLine(targetGroup, 39.2, -49.7, 45.0, -49.7, [
                { from: 43.4, to: 44.5, type: 'door' }   // Дверь из прохода (между 12 и 15) в тамбур
            ], INNER_T);
            addWallLine(targetGroup, 42.6, -49.7, 42.6, -46.2, [
                { from: -48.2, to: -47.1, type: 'door' } // Дверь из тамбура в 11
            ], INNER_T);

            // --- СЕВЕРНЫЙ ЦЕНТР: КАБИНЕТ 13, ПРОХОД ПРАВЕЕ 13, КАБИНЕТЫ 20 И 21 (X [42.6..52.4], Z [-58.4..-54.3]) ---
            // Западная стена 13 и её тамбура вдоль северного коридора (X = 42.6, Z [-58.4..-54.3])
            addWallLine(targetGroup, 42.6, -58.4, 42.6, -54.3, [
                { from: -58.1, to: -57.3, type: 'door' } // Боковой вход из коридора в тамбур 13
            ], INNER_T);
            // Перегородка тамбура над 13 (Z = -57.35, X [42.6..45.4])
            addWallLine(targetGroup, 42.6, -57.35, 45.4, -57.35, [
                { from: 43.4, to: 44.6, type: 'door' }   // Вход из тамбура в 13
            ], INNER_T);
            // Глухая южная стена 13 (Z = -55.6, X [42.6..45.4])
            addWallLine(targetGroup, 42.6, -55.6, 45.4, -55.6, [], INNER_T);
            // Восточная стена 13 (X = 45.4, Z [-58.4..-54.3])
            addWallLine(targetGroup, 45.4, -58.4, 45.4, -54.3, [], INNER_T);

            // Проход правее 13 (X [45.4..48.1], Z [-58.4..-54.3])
            addWallLine(targetGroup, 45.4, -57.35, 48.1, -57.35, [
                { from: 46.1, to: 47.4, type: 'door' }   // Внутренняя двустворчатая дверь тамбура
            ], INNER_T);
            addWallLine(targetGroup, 45.4, -54.3, 48.1, -54.3, [
                { from: 45.8, to: 47.7, type: 'open' }   // Открытый проем в главный коридор кухни
            ], INNER_T);

            // Комнаты 20 (X [48.1..50.3]) и 21 (X [50.3..52.4]), Z [-58.4..-54.3]
            addWallLine(targetGroup, 48.1, -58.4, 48.1, -54.3, [
                { from: -56.8, to: -55.6, type: 'door' } // Вход в 20 из бокового прохода
            ], INNER_T);
            addWallLine(targetGroup, 48.1, -54.3, 52.4, -54.3, [], INNER_T); // Глухая южная стена 20 и 21
            addWallLine(targetGroup, 50.3, -58.4, 50.3, -54.3, [
                { from: -55.4, to: -54.5, type: 'open' } // Проем между 20 и 21 внизу
            ], INNER_T);
            addWallLine(targetGroup, 52.4, -58.4, 52.4, -54.3, [
                { from: -57.8, to: -56.6, type: 'door' } // Выход из 21 в горячий цех 24
            ], INNER_T);

            // --- РЯД 15, 16, 17 (X [45.3..54.2], Z [-52.6..-49.7]) И МОЙКА 14 (X [45.0..55.4], Z [-49.7..-45.4]) ---
            addWallLine(targetGroup, 45.3, -52.6, 54.2, -52.6, [
                { from: 46.6, to: 47.8, type: 'door' },  // Вход в 15
                { from: 49.3, to: 50.5, type: 'door' }   // Вход в 16
            ], INNER_T);
            addWallLine(targetGroup, 45.3, -52.6, 45.3, -49.7, [], INNER_T); // Западная стена 15 (коридор между 12 и 15)
            addWallLine(targetGroup, 48.5, -52.6, 48.5, -49.7, [], INNER_T); // Перегородка 15 и 16
            addWallLine(targetGroup, 51.0, -52.6, 51.0, -49.7, [], INNER_T); // Перегородка 16 и 17
            addWallLine(targetGroup, 54.2, -52.6, 54.2, -49.7, [
                { from: -50.9, to: -49.8, type: 'door' } // Боковой вход в 17 со стороны восточного коридора
            ], INNER_T);

            // Мойка столовой посуды 14 (X [45.0..55.4], Z [-49.7..-45.4])
            addWallLine(targetGroup, 45.0, -49.7, 55.4, -49.7, [], INNER_T);
            addWallLine(targetGroup, 45.0, -49.7, 45.0, -45.4, [], INNER_T); // Западная стена мойки 14
            addWallLine(targetGroup, 55.4, -49.7, 55.4, -45.4, [
                { from: -48.4, to: -47.0, type: 'door' } // Вход в 14 из восточного коридора
            ], INNER_T);
            addWallLine(targetGroup, 45.0, -45.4, 55.4, -45.4, [], INNER_T);

            // --- СЕВЕРО-ВОСТОЧНЫЙ БЛОК: ЦЕХА 22, 23, ГОРЯЧИЙ ЦЕХ 24, КОМНАТЫ 19 И 18 (X [52.4..62.3]) ---
            // Перегородка между 22 и 23 (X = 59.9, Z [-60.4..-58.4])
            addWallLine(targetGroup, 59.9, -60.4, 59.9, -58.4, [], INNER_T);
            // Южная стена 22 и 23 (Z = -58.4, X [52.4..62.3]) с двумя дверьми в зал 24
            addWallLine(targetGroup, 52.4, -58.4, 62.3, -58.4, [
                { from: 56.4, to: 57.6, type: 'door' },  // Дверь из 22 в 24
                { from: 60.8, to: 62.0, type: 'door' }   // Дверь из 23 в 24
            ], INNER_T);

            // Южная граница зала 24 и вход в восточный тамбур-коридор (Z = -52.0, X [54.2..62.3])
            addWallLine(targetGroup, 54.2, -52.0, 62.3, -52.0, [
                { from: 55.8, to: 57.0, type: 'door' }   // Дверь из зала 24 в восточный коридор
            ], INNER_T);

            // Комната 19 (X [57.8..62.3], Z [-52.0..-49.8])
            addWallLine(targetGroup, 57.8, -52.0, 57.8, -49.8, [
                { from: -51.2, to: -50.0, type: 'door' } // Вход в 19
            ], INNER_T);
            addWallLine(targetGroup, 57.8, -49.8, 62.3, -49.8, [], INNER_T);

            // Комната 18 (X [59.0..62.3], Z [-49.8..-45.4])
            addWallLine(targetGroup, 59.0, -49.8, 59.0, -45.4, [
                { from: -48.4, to: -47.0, type: 'door' } // Вход в 18
            ], INNER_T);
            addWallLine(targetGroup, 59.0, -45.4, 62.3, -45.4, [], INNER_T);

            // Дверь из восточного коридора (между 14 и 18) в зал столовой 102 (Z = -45.4, X [55.4..59.0])
            addWallLine(targetGroup, 55.4, -45.4, 59.0, -45.4, [
                { from: 56.4, to: 57.8, type: 'door' }
            ], INNER_T);

            // 3D-плашки помещений 1-го этажа Корпуса 4 (buildingId = 4)
            addRoomLabel(targetGroup, 1, 'ЛК№2', 30.1, -48.3, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, 'ЛК№3', 65.6, -47.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, 'ЛК№1', 40.6, -27.8, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 1, '104', 34.9, -39.2, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 1, '103', 34.9, -32.2, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 1, '102\nСтоловая', 55.5, -36.4, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 1, '1', 42.0, -37.8, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '2', 40.3, -42.4, true, false, 4, 0.78);
            addRoomLabel(targetGroup, 1, '105', 40.0, -44.8, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '3', 43.0, -44.8, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '11', 40.9, -47.9, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '12', 42.1, -51.1, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '13', 44.0, -56.4, true, false, 4, 0.80);
            addRoomLabel(targetGroup, 1, '14', 50.2, -47.5, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '15', 46.9, -51.1, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '16', 49.7, -51.1, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '17', 52.6, -51.1, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '18', 60.6, -47.6, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '19', 60.0, -50.9, true, false, 4, 0.82);
            addRoomLabel(targetGroup, 1, '4', 37.4, -48.0, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '5', 37.4, -51.3, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '6', 37.4, -52.5, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '7', 37.4, -53.7, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '8', 38.1, -54.9, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '9', 38.1, -56.3, true, false, 4, 0.76);
            addRoomLabel(targetGroup, 1, '10', 38.1, -58.8, true, false, 4, 0.80);
            addRoomLabel(targetGroup, 1, '20', 49.2, -56.4, true, false, 4, 0.80);
            addRoomLabel(targetGroup, 1, '21', 51.3, -56.4, true, false, 4, 0.80);
            addRoomLabel(targetGroup, 1, '24', 57.3, -55.2, false, false, 4, 1.1);
            addRoomLabel(targetGroup, 1, '22', 56.1, -59.4, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 1, '23', 61.1, -59.4, true, false, 4, 0.80);
            flushWalls(targetGroup);
        }

        /**
         * КОРПУС 4 — ЭТАЖ 2 + ДВА ПРЯМЫХ НАДЗЕМНЫХ ПЕРЕХОДА (СТРОГО ПО ЧЕРТЕЖУ БТИ planning_zip/Корпус 4/2.jpg):
         * 1) Западный ряд X [32.4..36.0]: единая стена X = 36.0 от Z = -49.8 до Z = -27.4 (отделяет входной холл ЛК №2 и Перехода К3↔К4,
         *    кабинет 205, две раздельные подсобки между 205 и 202 с глухой перегородкой Z = -37.3, кабинет 202 и 201).
         * 2) Входы в спортзал 206 (Z = -49.8): два двустворчатых входа из главного холла (X [37.2..39.0] и [39.3..41.1]),
         *    двустворчатый вход из Служеб. пом. (X [46.8..48.4]) и вход из предбанника ЛК №3 (X [62.4..63.4]).
         * 3) Центральная лента Z [-49.8..-45.4] строго по БТИ: два С/у (X [42.0..45.5]), Служеб. пом. (X [45.5..51.1]),
         *    210 (X [51.1..54.4]), 211 (X [54.4..58.1]), 212 (X [58.1..62.1]) и предбанник ЛК №3 (X [62.1..63.6]).
         * 4) Блок раздевалок 207 (X [39.4..42.46]), 208 (X [42.46..45.5]), комнат 209 и 203 (X [45.5..49.0]) и актового зала 204 (X [49.0..66.0]).
         */
        function buildBuilding4Floor2(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // 1. Плиты перекрытия 2-го этажа Корпуса 4 (единый контур до X = 66.0):
            addFloorRect(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_S_GYM, B4_Z_MID_N, false);
            addFloorRect(targetGroup, B4_X_WEST, B4_Z_MID_N, B4_X_S_HALL, B4_Z_SOUTH, false);

            // Выступающие лестничные клетки Корпуса 4:
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, 34.8, B4_LK2_Z2, true);
            addFloorRect(targetGroup, 63.6, B4_LK3_Z1, B4_LK3_X2, -46.8, true);
            addFloorRect(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, true);

            // --- ДВА ПРЯМЫХ НАДЗЕМНЫХ КОРИДОРА-ПЕРЕХОДА 2-ГО ЭТАЖА ---
            // 1) ПРЯМОЙ ПЕРЕХОД К3 ↔ К4 (X [15.6..32.4], Z [-46.8..-44.0]) — стыкуется со стеной X = 15.6 без нахлёста
            addFloorRect(targetGroup, 15.6, -46.8, B4_X_WEST, -44.0, false);
            addWallLine(targetGroup, 15.72, -46.8, B4_LK2_X1, -46.8, [], OUTER_T);
            addWallLine(targetGroup, 15.72, -44.0, B4_X_WEST, -44.0, [], OUTER_T);

            // 2) ПРЯМОЙ ПЕРЕХОД К4 ↔ К2 (X [36.0..38.8], Z [-27.4..-13.8]) — стыкуется со стеной Z = -13.8 без нахлёста
            addFloorRect(targetGroup, 36.0, B4_Z_SOUTH, B4_LK1_X1, B2_Z_TOP, false);
            addWallLine(targetGroup, 36.0, B4_Z_SOUTH, 36.0, B2_Z_TOP - OUTER_T / 2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z2, B4_LK1_X1, B2_Z_TOP - OUTER_T / 2, [], OUTER_T);
            for (let i = 0; i < 4; i++) {
                const sz = -27.0 + i * 0.36;
                const heightRatio = 0.04 * (4 - i);
                const geom = new THREE.BoxGeometry(2.5, 1, 0.32);
                registerDynamicStairStep(targetGroup, geom, 37.4, sz, heightRatio, 0);
            }

            // --- ВНЕШНИЙ ПЕРИМЕТР И ЛЕСТНИЧНЫЕ КЛЕТКИ 2-ГО ЭТАЖА КОРПУСА 4 ---
            // Шахта ЛК №2 (X [27.8..34.6], Z [-49.8..-46.8]) — южная стена Z = -46.8 глухая по БТИ 2.jpg!
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X1, B4_LK2_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z2, 34.8, B4_LK2_Z2, [], INNER_T);
            buildB4Staircase(targetGroup, 30.8, 34.6, B4_LK2_Z1 + 0.1, B4_LK2_Z2 - 0.1, false);

            // Шахта ЛК №3 (X [63.6..69.0], Z [-49.8..-46.8]) и предбанник (X [62.1..63.6], Z [-49.8..-45.4]) по БТИ 2.jpg
            addWallLine(targetGroup, B4_X_S_GYM, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, 63.6, -46.8, B4_LK3_X2, -46.8, [], OUTER_T);
            addWallLine(targetGroup, B4_LK3_X2, B4_LK3_Z1, B4_LK3_X2, -46.8, [], OUTER_T);
            addWallLine(targetGroup, 63.6, B4_LK3_Z1, 63.6, B4_Z_MID_S, [
                { from: -48.3, to: -47.1, type: 'door' } // Выход из предбанника на площадку ЛК №3 по БТИ 2.jpg
            ], INNER_T);
            buildB4Staircase(targetGroup, 63.75, 67.2, B4_LK3_Z1 + 0.1, -46.9, false);

            // Шахта ЛК №1 (X [38.8..42.4], Z [-31.2..-24.4])
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X1, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z2, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z1, [
                { from: 39.8, to: 41.4, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, B4_LK1_X1 + 0.1, B4_LK1_X2 - 0.1, B4_LK1_Z1 + 0.1, B4_LK1_Z2 - 0.1, true);

            // Западная внешняя стена Корпуса 4 (X = 32.4) вдоль спортзала 206 и кабинетов 205–201
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_WEST, B4_Z_MID_N, [], OUTER_T);
            addWallLine(targetGroup, B4_X_WEST, -44.0, B4_X_WEST, B4_Z_SOUTH, [], OUTER_T);

            // Восточная внешняя стена спортзала 206 (X = 66.0, Z [-61.6..-49.8]) и зала 204 (X = 66.0, Z [-46.8..-27.4])
            addWallLine(targetGroup, B4_X_S_GYM, B4_Z_NORTH, B4_X_S_GYM, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, -46.8, B4_X_S_HALL, B4_Z_SOUTH, [], OUTER_T);

            // Северная внешняя стена зала 206 (Z = -61.6, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_S_GYM, B4_Z_NORTH, [], OUTER_T);

            // Южная внешняя стена Корпуса 4 (Z = -27.4, X [32.4..38.8] и X [42.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_SOUTH, B4_LK1_X1, B4_Z_SOUTH, [
                { from: 36.4, to: 38.4, type: 'door' }
            ], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, B4_Z_SOUTH, B4_X_S_HALL, B4_Z_SOUTH, [], OUTER_T);

            // --- ВНУТРЕННЯЯ ПЛАНИРОВКА 2-ГО ЭТАЖА КОРПУСА 4 ПО БТИ 2.JPG ---
            // 1) Стена между спортзалом 206 и центральным холлом / помещениями (Z = -49.8, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_MID_N, B4_X_S_GYM, B4_Z_MID_N, [
                { from: 37.2, to: 39.0, type: 'door' }, // Левый двустворчатый вход в спортзал 206 из холла
                { from: 39.3, to: 41.1, type: 'door' }, // Правый двустворчатый вход в спортзал 206 из холла
                { from: 46.8, to: 48.4, type: 'door' }, // Двустворчатый вход в спортзал 206 из Служеб. пом.
                { from: 62.4, to: 63.4, type: 'door' }  // Вход в спортзал 206 из предбанника ЛК №3
            ], OUTER_T);

            // 14 сквозных колонн по периметру спортзала 206
            B4_GYM_COLUMNS.forEach(col => {
                addSquareColumn(targetGroup, col.x, col.z, 0.38, true);
            });

            // 2) Блок двух С/у (X [42.0..45.5], Z [-49.8..-45.4]) строго по БТИ 2.jpg
            addFloorRect(targetGroup, 42.7, B4_Z_MID_N, 45.5, B4_Z_MID_S, true);
            addFloorRect(targetGroup, 42.0, -49.8, 42.7, -48.5, true);
            addFloorRect(targetGroup, 42.0, -46.7, 42.7, -45.4, true);

            // Восточная стена санузлов (общая со Служеб. пом.): X = 45.5, Z [-49.8..-45.4]
            addWallLine(targetGroup, 45.5, B4_Z_MID_N, 45.5, B4_Z_MID_S, [], INNER_T);

            // Центральная перегородка между двумя санузлами: Z = -47.6, X [42.7..45.5]
            addWallLine(targetGroup, 42.7, -47.6, 45.5, -47.6, [], 0.14);

            // Внутренние перегородки кабинок (без взаимного пересечения):
            addWallLine(targetGroup, 42.7, -48.5, 45.5, -48.5, [
                { from: 43.6, to: 44.5, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 42.7, -46.7, 45.5, -46.7, [
                { from: 43.6, to: 44.5, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 43.5, -48.5, 43.5, -47.6, [], 0.12);
            addWallLine(targetGroup, 43.5, -47.6, 43.5, -46.7, [], 0.12);

            // Западная стена С/у с выемкой (X [42.0..42.7]):
            addWallLine(targetGroup, 42.0, -49.8, 42.0, -48.5, [
                { from: -49.6, to: -48.7, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 42.0, -48.5, 42.7, -48.5, [], INNER_T);
            addWallLine(targetGroup, 42.0, -46.7, 42.7, -46.7, [], INNER_T);
            addWallLine(targetGroup, 42.7, -48.5, 42.7, -46.7, [], INNER_T);
            addWallLine(targetGroup, 42.0, -46.7, 42.0, -45.4, [
                { from: -46.5, to: -45.6, type: 'door' }
            ], INNER_T);

            // Южная стена блока С/у вдоль коридора: Z = -45.4, X [42.0..45.5]
            addWallLine(targetGroup, 42.0, B4_Z_MID_S, 45.5, B4_Z_MID_S, [], INNER_T);

            // 3) Центральная лента (Z [-49.8..-45.4], X от 45.5 до 63.6): Служеб. пом., 210, 211, 212 и предбанник ЛК №3
            addWallLine(targetGroup, 45.5, B4_Z_MID_S, 63.6, B4_Z_MID_S, [
                { from: 53.2, to: 54.2, type: 'door' }, // Вход в 210
                { from: 54.6, to: 55.6, type: 'door' }, // Вход в 211
                { from: 60.7, to: 61.8, type: 'door' }, // Вход в 212
                { from: 62.4, to: 63.4, type: 'door' }  // Выход из предбанника ЛК №3 в коридор
            ], INNER_T);
            [51.1, 54.4, 58.1, 62.1].forEach(xWall => {
                addWallLine(targetGroup, xWall, B4_Z_MID_N, xWall, B4_Z_MID_S, [], INNER_T);
            });
            // Внутренние выгородки в 211 (X [55.9..58.1]) и 212 (X [58.1..60.4])
            addWallLine(targetGroup, 55.9, -46.6, 58.1, -46.6, [
                { from: 56.2, to: 57.2, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 58.1, -46.6, 60.4, -46.6, [
                { from: 59.0, to: 60.0, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 55.9, -46.6, 55.9, B4_Z_MID_S, [], 0.12);
            addWallLine(targetGroup, 60.4, -46.6, 60.4, B4_Z_MID_S, [], 0.12);

            // Перегородка с дверью в коридор между С/у и раздевалкой 208 (X = 43.5, Z [-45.4..-44.0])
            addWallLine(targetGroup, 43.5, B4_Z_MID_S, 43.5, -44.0, [
                { from: -45.2, to: -44.2, type: 'door' }
            ], INNER_T);

            // 4) Блок раздевалок 207 (X [39.4..42.46]), 208 (X [42.46..45.5]) и комнат 209, 203 (X [45.5..49.0], Z [-44.0..-37.3])
            const BX_BOT = 39.4, BX_208_TOP = 45.5, BX_TOP = 49.0;
            const BZ_LEFT = -44.0, BZ_RIGHT = -37.3, BZ_MID_209_203 = -40.65;

            addWallLine(targetGroup, BX_BOT, BZ_LEFT, BX_BOT, BZ_RIGHT, [], INNER_T);
            addWallLine(targetGroup, BX_BOT, BZ_RIGHT, BX_TOP, BZ_RIGHT, [
                { from: 46.8, to: 47.9, type: 'door' } // Вход в 203
            ], INNER_T);
            addWallLine(targetGroup, BX_208_TOP, BZ_LEFT, BX_208_TOP, BZ_RIGHT, [], INNER_T);
            addWallLine(targetGroup, BX_208_TOP, BZ_MID_209_203, BX_TOP, BZ_MID_209_203, [], INNER_T);

            // Северная стена комнаты 209 (Z = -44.0) с дверью из коридора:
            addWallLine(targetGroup, BX_208_TOP, BZ_LEFT, BX_TOP, BZ_LEFT, [
                { from: 46.8, to: 47.9, type: 'door' } // Вход в 209
            ], INNER_T);

            // Северный фасад блока раздевалок (Z = -44.0) с открытой выемкой входа X [41.35..43.56]:
            addWallLine(targetGroup, 43.56, BZ_LEFT, BX_208_TOP, BZ_LEFT, [], INNER_T);
            addWallLine(targetGroup, BX_BOT, BZ_LEFT, 41.35, BZ_LEFT, [], INNER_T);

            // Боковые стены входной выемки со входами в раздевалки 207 и 208:
            addWallLine(targetGroup, 43.56, BZ_LEFT, 43.56, -42.4, [
                { from: -43.8, to: -42.6, type: 'door' } // Вход в 208
            ], INNER_T);
            addWallLine(targetGroup, 41.35, BZ_LEFT, 41.35, -42.4, [
                { from: -43.8, to: -42.6, type: 'door' } // Вход в 207
            ], INNER_T);
            addWallLine(targetGroup, 41.35, -42.4, 43.56, -42.4, [], INNER_T);

            // Внутренние душевые/санузлы раздевалок (X [41.35..43.56], Z [-42.4..-39.9]):
            addFloorRect(targetGroup, 41.35, -42.4, 43.56, -39.9, true);
            addWallLine(targetGroup, 43.56, -42.4, 43.56, -39.9, [], INNER_T);
            addWallLine(targetGroup, 41.35, -42.4, 41.35, -39.9, [], INNER_T);
            addWallLine(targetGroup, 42.46, -39.9, 43.56, -39.9, [
                { from: 42.6, to: 43.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 41.35, -39.9, 42.46, -39.9, [
                { from: 41.5, to: 42.3, type: 'door' }
            ], INNER_T);

            // Центральная разделительная перегородка между раздевалками 207 и 208 (X = 42.46, Z [-42.4..-37.3]):
            addWallLine(targetGroup, 42.46, -42.4, 42.46, BZ_RIGHT, [], INNER_T);

            // 5) Западный ряд: входной холл у ЛК №2 и Перехода, 205, две подсобки, 202, 201 (X [32.4..36.0], Z [-49.8..-27.4])
            addWallLine(targetGroup, 36.0, B4_Z_MID_N, 36.0, B4_Z_SOUTH, [
                { from: -49.0, to: -47.6, type: 'door' }, // Дверь из холла ЛК №2 в главный холл
                { from: -46.3, to: -44.7, type: 'door' }, // Двустворчатая дверь из тамбура Перехода в главный холл
                { from: -40.1, to: -39.1, type: 'door' }, // Вход в 205
                { from: -35.4, to: -34.4, type: 'door' }, // Вход в 202
                { from: -29.6, to: -28.6, type: 'door' }  // Вход в 201
            ], INNER_T);
            addWallLine(targetGroup, B4_X_WEST, -44.0, 36.0, -44.0, [], INNER_T); // Северная стена 205
            addWallLine(targetGroup, B4_X_WEST, -37.3, 36.0, -37.3, [], INNER_T); // Глухая стена между 205 и 202
            addWallLine(targetGroup, 33.8, -38.6, 36.0, -38.6, [
                { from: 34.3, to: 35.3, type: 'door' } // Вход из 205 в верхнюю подсобку
            ], 0.14);
            addWallLine(targetGroup, 33.8, -36.0, 36.0, -36.0, [
                { from: 34.3, to: 35.3, type: 'door' } // Вход из 202 в нижнюю подсобку
            ], 0.14);
            addWallLine(targetGroup, 33.8, -38.6, 33.8, -37.3, [], 0.14);
            addWallLine(targetGroup, 33.8, -37.3, 33.8, -36.0, [], 0.14);
            addWallLine(targetGroup, B4_X_WEST, -31.0, 36.0, -31.0, [], INNER_T); // Стена между 202 и 201

            // 6) Большой актовый зал 204 (X [49.0..66.0], Z [-44.0..-27.4]) — двусветный зал!
            addWallLine(targetGroup, 49.0, -44.0, B4_X_S_HALL, -44.0, [
                { from: 62.5, to: 64.3, type: 'door' } // Двустворчатый вход в зал 204 у ЛК №3
            ], OUTER_T);
            addWallLine(targetGroup, 49.0, BZ_LEFT, 49.0, B4_Z_SOUTH, [
                { from: -36.8, to: -34.8, type: 'door' }
            ], OUTER_T);
            [-34.2, -32.5, -30.8, -29.1].forEach(zRib => {
                addWallLine(targetGroup, 49.0 - 1.1, zRib, 49.0, zRib, [], 0.16);
            });

            // Колонны вдоль южной стены актового зала 204
            [51.4, 58.0, 61.8, 65.6].forEach(cx => {
                addSquareColumn(targetGroup, cx, B4_Z_SOUTH - 0.25, 0.36, true);
            });

            // ПОДИУМ (СЦЕНА) В ЗАЛЕ 204 строго по контуру чертежа 2.jpg (X [59.6..65.6], Z [-41.9..-29.3])
            const stageX1 = 59.6, stageX2 = 65.6;
            const stageZ1 = -41.9, stageZ2 = -29.3;
            const mainStageGeom = new THREE.BoxGeometry(stageX2 - (stageX1 + 0.9), 1, stageZ2 - stageZ1);
            registerDynamicStairStep(targetGroup, mainStageGeom, (stageX1 + 0.9 + stageX2) / 2, (stageZ1 + stageZ2) / 2, 0.22, 0.005, true);
            const frontStageGeom = new THREE.BoxGeometry(0.92, 1, (stageZ2 - stageZ1) - 1.8);
            registerDynamicStairStep(targetGroup, frontStageGeom, stageX1 + 0.45, (stageZ1 + stageZ2) / 2, 0.22, 0.005, true);

            // Боковые ступени сцены
            const stepCount = 4;
            const stepD = 0.28;
            for (let i = 0; i < stepCount; i++) {
                const stepRatio = 0.045 * (i + 1);
                const stepGeom = new THREE.BoxGeometry(1.24, 1, stepD * 0.96);
                const zNorth = stageZ1 + 0.7 + i * stepD;
                const zSouth = stageZ2 - 0.7 - i * stepD;
                registerDynamicStairStep(targetGroup, stepGeom, stageX2 - 0.65, zNorth, stepRatio, 0.005, true);
                registerDynamicStairStep(targetGroup, stepGeom, stageX2 - 0.65, zSouth, stepRatio, 0.005, true);
            }

            // 3D-плашки помещений 2-го этажа Корпуса 4 и переходов (buildingId = 4)
            addRoomLabel(targetGroup, 2, '206\nСпортивный зал', 49.2, -55.7, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 2, 'ЛК№2', 30.1, -48.3, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'Переход\nК3 ↔ К4', 24.0, -45.4, false, true, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'Переход\nК4 ↔ К2', 37.4, -20.6, false, true, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'С/У', 43.8, -49.1, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 2, 'С/У', 43.8, -46.0, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 2, 'Служеб.\nпом.', 48.3, -47.6, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, '210', 52.7, -47.6, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, '211', 56.2, -48.2, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '212', 60.1, -48.2, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'ЛК№3', 66.2, -48.3, true, false, 4, 0.85);

            addRoomLabel(targetGroup, 2, '205', 34.2, -41.3, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 2, '202', 34.2, -33.5, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 2, '201', 34.2, -29.2, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, '207', 40.9, -38.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '208', 44.0, -38.6, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '209', 47.2, -42.3, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, '203', 47.2, -39.0, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 2, 'ЛК№1', 40.6, -27.8, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 2, '204\nАктовый зал', 55.0, -35.5, false, true, 4, 1.15);
            flushWalls(targetGroup);
        }

        /**
         * КОРПУС 4 — ЭТАЖ 3 (СТРОГО ПО ЧЕРТЕЖУ БТИ planning_zip/Корпус 4/3.jpg):
         * 1) Западный ряд кабинетов 306, 304, 308, 309 и выход из ЛК №2 по единой стене X = 36.0.
         * 2) Восточная стена главного коридора по линии X = 39.4 (301, 303, проходной холл, два С/у, Витраж, холл 310).
         * 3) Полоса 301–303–302 и служебный узел перед ЛК №3 (тамбур ЛК №3 X [58.4..61.9], две верхние кладовые и две нижние комнаты).
         * 4) Средний блок: два С/у (X [39.4..43.1]), смежная комната (X [43.1..45.4]), Витраж (Z [-37.2..-31.0]),
         *    305 (Z [-43.6..-39.4]), 312 (Z [-39.4..-32.9]), предбанник и боковая комната (Z [-32.9..-29.4]), 311 (Z [-29.4..-27.4]).
         */
        function buildBuilding4Floor3(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // --- 1. ПЛИТЫ ПЕРЕКРЫТИЯ 3-ГО ЭТАЖА ---
            // Центральная продольная полоса (301, 303, 302, служебный узел у ЛК №3): X [39.4..66.0], Z [-49.8..-43.6]
            addFloorRect(targetGroup, 39.4, B4_Z_MID_N, B4_X_S_HALL, -43.6, false);

            // Средний блок (305, 312, 311, предбанник, С/у, Витраж, холл 310): X [39.4..49.0], Z [-43.6..-27.4]
            addFloorRect(targetGroup, 39.4, -43.6, 49.0, B4_Z_SOUTH, false);

            // Главный коридор и западный ряд кабинетов (306, 304, 308, 309): X [32.4..39.4], Z [-49.8..-27.4]
            addFloorRect(targetGroup, B4_X_WEST, B4_Z_MID_N, 39.4, B4_Z_SOUTH, false);

            // Акцентная плитка в блоке двух С/у и в Витраже
            addFloorRect(targetGroup, 39.4, -41.6, 43.1, -37.2, true); // Два С/у
            addFloorRect(targetGroup, 39.4, -37.2, 45.4, -31.0, true); // Витраж

            // Плиты трех сквозных лестничных клеток
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, 34.6, -46.7, true);
            addFloorRect(targetGroup, 61.9, B4_LK3_Z1, B4_LK3_X2, -46.6, true);
            addFloorRect(targetGroup, 39.4, -29.6, B4_LK1_X2, B4_LK1_Z2, true);

            // --- 2. ВНЕШНИЙ ПЕРИМЕТР И ЛЕСТНИЧНЫЕ КЛЕТКИ ---
            // Западная внешняя стена Корпуса 4 (X = 32.4) вдоль Второго света и кабинетов 306–309
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_WEST, B4_Z_MID_N, [], OUTER_T);
            addWallLine(targetGroup, B4_X_WEST, -46.7, B4_X_WEST, B4_Z_SOUTH, [], OUTER_T);

            // Восточная внешняя стена Корпуса 4 (X = 66.0) вдоль обоих Вторых светов и ЛК №3
            addWallLine(targetGroup, B4_X_S_GYM, B4_Z_NORTH, B4_X_S_GYM, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, -46.6, B4_X_S_HALL, B4_Z_SOUTH, [], OUTER_T);

            // Северная внешняя стена Второго света над залом 206 (Z = -61.6, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_NORTH, B4_X_S_GYM, B4_Z_NORTH, [], OUTER_T);

            // Южная внешняя стена Корпуса 4 (Z = -27.4, X [32.4..38.8] и X [42.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_SOUTH, 39.4, B4_Z_SOUTH, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, B4_Z_SOUTH, B4_X_S_HALL, B4_Z_SOUTH, [], OUTER_T);

            // Шахта ЛК №2 (X [27.8..34.6], Z [-49.8..-46.7])
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X2, B4_LK2_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, -46.7, 36.0, -46.7, [], OUTER_T);
            addWallLine(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_LK2_X1, -46.7, [], OUTER_T);
            buildB4Staircase(targetGroup, 30.6, 34.5, B4_LK2_Z1 + 0.1, -46.8, false);

            // Шахта ЛК №3 (X [61.9..69.0], Z [-49.8..-46.6])
            addWallLine(targetGroup, B4_X_S_GYM, B4_LK3_Z1, B4_LK3_X2, B4_LK3_Z1, [], OUTER_T);
            addWallLine(targetGroup, B4_X_S_HALL, -46.6, B4_LK3_X2, -46.6, [], OUTER_T);
            addWallLine(targetGroup, B4_LK3_X2, B4_LK3_Z1, B4_LK3_X2, -46.6, [], OUTER_T);
            addWallLine(targetGroup, 61.9, B4_LK3_Z1, 61.9, -46.6, [
                { from: -49.4, to: -48.4, type: 'door' }
            ], INNER_T);
            buildB4Staircase(targetGroup, 63.65, 67.35, B4_LK3_Z1 + 0.1, -46.7, false);

            // Шахта ЛК №1 (X [39.4..42.4], Z [-29.6..-24.4]) и стена 310 (Z = -29.6) строго по БТИ 3.jpg
            addWallLine(targetGroup, 39.4, -29.6, 39.4, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, -29.6, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, 39.4, B4_LK1_Z2, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, 39.4, -29.6, 45.4, -29.6, [
                { from: 39.8, to: 41.4, type: 'door' }, // Двустворчатый вход в ЛК №1
                { from: 43.0, to: 44.0, type: 'door' }  // Вход в холл 310
            ], INNER_T);
            buildB4Staircase(targetGroup, 39.5, B4_LK1_X2 - 0.1, -29.5, B4_LK1_Z2 - 0.1, true);

            // --- 3. СТЕНЫ И КОЛОННЫ ОБЕИХ ЗОН ВТОРОГО СВЕТА ---
            // Капитальная стена между северным Вторым светом и полосой 301 (Z = -49.8, X [32.4..66.0])
            addWallLine(targetGroup, B4_X_WEST, B4_Z_MID_N, B4_X_S_GYM, B4_Z_MID_N, [], OUTER_T);

            // 14 сквозных колонн по периметру северного Второго света (спортзал 206)
            B4_GYM_COLUMNS.forEach(col => {
                addSquareColumn(targetGroup, col.x, col.z, 0.38, true);
            });

            // Капитальные стены вокруг юго-восточного Второго света (над залом 204, X [49.0..66.0], Z [-43.6..-27.4]):
            addWallLine(targetGroup, 49.0, -43.6, B4_X_S_HALL, -43.6, [], OUTER_T);
            addWallLine(targetGroup, 49.0, -43.6, 49.0, B4_Z_SOUTH, [], OUTER_T);

            // 4 колонны вдоль южной внешней стены Второго света
            [51.4, 58.0, 61.8, 65.6].forEach(cx => {
                addSquareColumn(targetGroup, cx, B4_Z_SOUTH - 0.25, 0.36, true);
            });

            // --- 4. ЦЕНТРАЛЬНАЯ ПРОДОЛЬНАЯ ПОЛОСА: 301, 303, 302 И СЛУЖЕБНЫЙ УЗЕЛ У ЛК №3 ---
            // Западная граница 301 и 303 вдоль главного коридора (X = 39.4, Z [-49.8..-43.6])
            addWallLine(targetGroup, 39.4, -49.8, 39.4, -43.6, [
                { from: -49.4, to: -48.4, type: 'door' }, // Вход в коридор 301
                { from: -44.8, to: -43.8, type: 'door' }  // Вход в зал 303
            ], INNER_T);

            // Продольная разделительная стена между коридором 301 и залами 303 / 302 (Z = -47.7, X [39.4..61.9])
            addWallLine(targetGroup, 39.4, -47.7, 61.9, -47.7, [
                { from: 60.7, to: 61.7, type: 'door' }    // Дверь из тамбура ЛК №3 в служебный проход
            ], INNER_T);

            // Поперечная стена с дверью из 301 в тамбур ЛК №3 (X = 58.4, Z [-49.8..-47.7])
            addWallLine(targetGroup, 58.4, -49.8, 58.4, -47.7, [
                { from: -49.4, to: -48.4, type: 'door' }
            ], INNER_T);

            // Служебный узел правее зала 302 (X [56.1..66.0], Z [-47.7..-43.6]) строго по БТИ 3.jpg:
            addWallLine(targetGroup, 56.1, -47.7, 56.1, -43.6, [], INNER_T); // Восточная стена зала 302
            addWallLine(targetGroup, 59.0, -47.7, 59.0, -46.6, [], 0.14);
            addWallLine(targetGroup, 60.1, -47.7, 60.1, -46.6, [], 0.14);
            addWallLine(targetGroup, 56.1, -46.6, 66.0, -46.6, [
                { from: 60.8, to: 61.7, type: 'door' }
            ], INNER_T);
            // Две малые комнаты у стены Второго света (Z [-45.1..-43.6]):
            addWallLine(targetGroup, 56.1, -45.1, 58.3, -45.1, [], 0.14);
            addWallLine(targetGroup, 58.3, -45.1, 58.3, -43.6, [], 0.14);
            addWallLine(targetGroup, 59.3, -45.1, 61.3, -45.1, [
                { from: 60.0, to: 61.0, type: 'door' }
            ], 0.14);
            addWallLine(targetGroup, 59.3, -45.1, 59.3, -43.6, [], 0.14);
            addWallLine(targetGroup, 61.3, -45.1, 61.3, -43.6, [], 0.14);

            // Пилястры строго по плану 3-го этажа:
            addSquareColumn(targetGroup, 44.2, -49.55, 0.36);
            addSquareColumn(targetGroup, 51.0, -49.55, 0.36);
            addSquareColumn(targetGroup, 53.5, -47.45, 0.36);

            // Поперечная стена между залами 303 и 302 (X = 47.7, Z [-47.7..-43.6]) по БТИ 3.jpg
            addWallLine(targetGroup, 47.7, -47.7, 47.7, -43.6, [
                { from: -45.3, to: -44.3, type: 'door' }
            ], INNER_T);

            // Южная продольная стена зала 303 и 302 (Z = -43.6, X [39.4..49.0])
            addWallLine(targetGroup, 39.4, -43.6, 49.0, -43.6, [], INNER_T);

            // Закрытая выгородка в верхнем левом углу зала 303 (X [40.5..42.9], Z [-47.7..-46.3]) по БТИ 3.jpg
            addWallLine(targetGroup, 40.5, -47.7, 40.5, -46.3, [], 0.14);
            addWallLine(targetGroup, 42.9, -47.7, 42.9, -46.3, [], 0.14);
            addWallLine(targetGroup, 40.5, -46.3, 42.9, -46.3, [
                { from: 40.6, to: 41.5, type: 'door' }
            ], 0.14);

            // --- 5. СРЕДНИЙ БЛОК: 305, 312, 311, С/У, ВИТРАЖ И ХОЛЛ 310 (X [39.4..49.0], Z [-43.6..-27.4]) ---
            // Вертикальная стена между рядом (305, 312, предбанник, 311) и рядом (холл, С/у, Витраж, проход, 310): X = 45.4
            addWallLine(targetGroup, 45.4, -43.6, 45.4, B4_Z_SOUTH, [
                { from: -43.0, to: -42.0, type: 'door' }, // Вход в 305 из проходного холла
                { from: -30.8, to: -29.8, type: 'door' }, // Вход из коридора в предбанник перед 312
                { from: -29.0, to: -28.0, type: 'door' }  // Вход из 310 в 311
            ], INNER_T);

            // Перегородка между 305 и 312 (Z = -39.4, X [45.4..49.0]) — глухая
            addWallLine(targetGroup, 45.4, -39.4, 49.0, -39.4, [], INNER_T);

            // Перегородка между 312 и предбанником (Z = -32.9, X [45.4..49.0]) с дверью в 312
            addWallLine(targetGroup, 45.4, -32.9, 49.0, -32.9, [
                { from: 45.6, to: 46.7, type: 'door' }
            ], INNER_T);

            // Вертикальная перегородка между предбанником и боковой комнатой (X = 47.0, Z [-32.9..-29.4]) с дверью
            addWallLine(targetGroup, 47.0, -32.9, 47.0, -29.4, [
                { from: -32.0, to: -30.8, type: 'door' }
            ], 0.14);

            // Перегородка между предбанником/боковой комнатой и 311 (Z = -29.4, X [45.4..49.0]) — глухая
            addWallLine(targetGroup, 45.4, -29.4, 49.0, -29.4, [], INNER_T);

            // Проходной входной холл над С/у (X [39.4..45.4], Z [-43.6..-41.6]):
            addWallLine(targetGroup, 39.4, -43.6, 39.4, -41.6, [
                { from: -43.0, to: -42.0, type: 'door' }
            ], INNER_T);

            // Блок двух С/у (X [39.4..43.1]) и смежной комнаты (X [43.1..45.4]), Z [-41.6..-37.2]:
            addWallLine(targetGroup, 39.4, -41.6, 45.4, -41.6, [
                { from: 43.5, to: 44.5, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 43.1, -41.6, 43.1, -37.2, [], INNER_T);
            // Перегородка между двумя санузлами (Z = -39.4, X [39.4..43.1])
            addWallLine(targetGroup, 39.4, -39.4, 43.1, -39.4, [], 0.14);
            // Перегородки кабинок внутри обоих С/у (X = 41.5, разделены по Z = -39.4 без пересечений)
            addWallLine(targetGroup, 41.5, -41.6, 41.5, -39.4, [
                { from: -41.3, to: -40.5, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 41.5, -39.4, 41.5, -37.2, [
                { from: -38.2, to: -37.4, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 39.4, -39.9, 41.5, -39.9, [], 0.12);
            addWallLine(targetGroup, 39.4, -38.8, 41.5, -38.8, [], 0.12);
            // Западная стена санузлов с двумя входными дверьми (X = 39.4, Z [-41.6..-37.2])
            addWallLine(targetGroup, 39.4, -41.6, 39.4, -37.2, [
                { from: -41.2, to: -40.2, type: 'door' },
                { from: -38.3, to: -37.3, type: 'door' }
            ], INNER_T);

            // Помещение «Витраж» (X [39.4..45.4], Z [-37.2..-31.0]) строго по БТИ 3.jpg
            addWallLine(targetGroup, 39.4, -37.2, 45.4, -37.2, [], INNER_T);
            addWallLine(targetGroup, 39.4, -31.0, 45.4, -31.0, [], INNER_T);
            addWallLine(targetGroup, 39.4, -37.2, 39.4, -31.0, [], INNER_T);

            // Проход к ЛК №1 и 310 (X [39.4..45.4], Z [-31.0..-29.6]):
            addWallLine(targetGroup, 39.4, -31.0, 39.4, -29.6, [
                { from: -30.8, to: -29.8, type: 'door' }
            ], INNER_T);

            // --- 6. ГЛАВНЫЙ КОРИДОР И ЗАПАДНЫЙ РЯД КАБИНЕТОВ: 306, 304, 308, 309 (X [32.4..36.0]) ---
            // Единая стена вдоль западного ряда и площадки ЛК №2 (X = 36.0, Z [-49.8..-27.4]) с 5 дверьми по БТИ 3.jpg
            addWallLine(targetGroup, 36.0, B4_Z_MID_N, 36.0, B4_Z_SOUTH, [
                { from: -48.6, to: -47.6, type: 'door' }, // Выход с площадки ЛК №2 в коридор
                { from: -43.1, to: -42.1, type: 'door' }, // Вход в 306
                { from: -38.8, to: -37.8, type: 'door' }, // Вход в 304
                { from: -33.9, to: -32.9, type: 'door' }, // Вход в 308
                { from: -31.6, to: -30.6, type: 'door' }  // Вход в 309
            ], INNER_T);

            // Горизонтальные перегородки между кабинетами 306, 304, 308 и 309
            addWallLine(targetGroup, B4_X_WEST, -41.6, 36.0, -41.6, [], INNER_T); // Между 306 и 304
            addWallLine(targetGroup, B4_X_WEST, -37.2, 36.0, -37.2, [], INNER_T); // Между 304 и 308
            addWallLine(targetGroup, B4_X_WEST, -32.3, 36.0, -32.3, [], INNER_T); // Между 308 и 309

            // --- 7. 3D-ПЛАШКИ ПОМЕЩЕНИЙ 3-ГО ЭТАЖА КОРПУСА 4 (buildingId = 4) ---
            addRoomLabel(targetGroup, 3, 'Второй свет', 49.2, -55.7, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 3, 'Второй свет', 57.5, -35.5, false, true, 4, 1.15);
            addRoomLabel(targetGroup, 3, 'Витраж', 42.4, -34.1, false, true, 4, 0.95);

            addRoomLabel(targetGroup, 3, 'ЛК№2', 30.1, -48.3, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 3, 'ЛК№3', 65.5, -48.2, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 3, 'ЛК№1', 40.6, -27.8, true, false, 4, 0.88);

            addRoomLabel(targetGroup, 3, '301', 48.8, -48.7, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 3, '302', 51.9, -45.6, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 3, '303', 44.2, -45.2, false, false, 4, 0.95);
            addRoomLabel(targetGroup, 3, '305', 47.2, -41.5, true, false, 4, 0.88);
            addRoomLabel(targetGroup, 3, '312', 47.2, -36.1, false, false, 4, 0.92);
            addRoomLabel(targetGroup, 3, '311', 47.2, -28.4, true, false, 4, 0.85);
            addRoomLabel(targetGroup, 3, '310', 43.9, -28.5, true, false, 4, 0.88);

            addRoomLabel(targetGroup, 3, 'С/у', 42.3, -40.5, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 3, 'С/у', 42.3, -38.3, true, false, 4, 0.72);

            addRoomLabel(targetGroup, 3, '306', 34.2, -44.2, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '304', 34.2, -39.4, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '308', 34.2, -34.7, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '309', 34.2, -29.8, true, false, 4, 0.90);
            flushWalls(targetGroup);
        }
window.buildBuilding4Floor1 = buildBuilding4Floor1;
window.buildBuilding4Floor2 = buildBuilding4Floor2;
window.buildBuilding4Floor3 = buildBuilding4Floor3;
