// ==========================================
// КОРПУС 2 (Этажи 1–3) — ИСПРАВЛЕННАЯ ВНУТРЕННЯЯ ПЛАНИРОВКА ПО ПЛАНАМ БТИ
// Внешний периметр, сквозные лестницы (ЛК №1, ЛК №2, ЛК №3) и выходы к переходам сохранены 1-в-1!
// ==========================================

        function buildB2Staircase(targetGroup, x1, x2, zTop, zBot) {
            addFloorRect(targetGroup, x1, zTop, x2, zBot, true);
            const xMid = (x1 + x2) / 2;
            const zStart = zTop + 0.85;
            const zEnd = zBot - 0.85;
            addWallLine(targetGroup, xMid, zStart, xMid, zEnd, [], 0.08);

            const steps = 9;
            const stepD = (zEnd - zStart) / steps;
            const wFlight = (x2 - x1) / 2 - 0.16;

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
        }

        function buildB2ExteriorPorch(targetGroup, x1, x2, zNorth, hasSteps = true) {
            const w = Math.abs(x2 - x1);
            const cx = (x1 + x2) / 2;

            if (!hasSteps) {
                addFloorRect(targetGroup, x1, zNorth, x2, B2_Z_TOP, true);
                return;
            }

            const zLandingNorth = B2_Z_TOP - (B2_Z_TOP - zNorth) * 0.42;
            addFloorRect(targetGroup, x1, zLandingNorth, x2, B2_Z_TOP, true);

            const steps = 6;
            const totalStepsDepth = Math.abs(zLandingNorth - zNorth);
            const sDepth = totalStepsDepth / steps;

            for (let i = 0; i < steps; i++) {
                const sz = zNorth + (i + 0.5) * sDepth;
                const heightRatio = 0.03 + ((i + 1) / steps) * 0.12;
                const geom = new THREE.BoxGeometry(w, 1, sDepth * 0.95);
                registerDynamicStairStep(targetGroup, geom, cx, sz, heightRatio, -0.14, true);
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
            // Служебное крыльцо преподавательского выхода из тамбура (X [24.8..27.4])
            buildB2ExteriorPorch(targetGroup, 24.8, 27.4, -15.8, true);

            // --- ВНЕШНИЙ ПЕРИМЕТР СТЕН 1-ГО ЭТАЖА ---
            // Западная стена (стык с переходом в Корпус 1)
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_START, B2_Z_BOT, [
                { from: -6.5, to: -5.1, type: 'door' }
            ], OUTER_T);

            // Северная внешняя стена B2_Z_TOP (-13.8) с 4 выходами (служебный выход преподавателей, два выхода в ЛК №2 и выход в ЛК №1)
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_TOP, [
                { from: 25.4, to: 26.8, type: 'door' }, // Служебный выход (только для преподавателей)
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

            // 1) Помещение (бывш. узел ЛК №3, X [20.4..24.8], Z [-13.8..-10.6]), тамбур (X [24.8..27.4]) и комната 103 (X [20.4..27.4], Z [-10.6..-6.8])
            addWallLine(targetGroup, B2_X_START, B2_LK3_Z_BOT, 27.4, B2_LK3_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, B2_LK3_X2, B2_Z_TOP, B2_LK3_X2, B2_LK3_Z_BOT, [
                { from: -11.9, to: -10.8, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 27.4, B2_Z_TOP, 27.4, B2_Z_CORR_TOP, [
                { from: -12.4, to: -11.2, type: 'door' } // Дверь из тамбура в зал 105
            ], INNER_T);

            // 2) Зал 105 (X [27.4..38.6]) и два широких пристенных короба вдоль коридора (как на чертеже!)
            addWallLine(targetGroup, 38.6, B2_Z_TOP, 38.6, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 29.2, B2_Z_CORR_TOP - 0.35, 32.5, B2_Z_CORR_TOP - 0.35, [], 0.35, true);
            addWallLine(targetGroup, 34.3, B2_Z_CORR_TOP - 0.35, 38.6, B2_Z_CORR_TOP - 0.35, [], 0.35, true);

            // 3) Комната 107 (X [38.6..41.8]): разделена пополам на Z = -9.8 с дверью слева и подсобными нишами справа
            addWallLine(targetGroup, B2_LK2_X1, B2_Z_TOP, B2_LK2_X1, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 38.6, -9.8, B2_LK2_X1, -9.8, [
                { from: 38.9, to: 40.0, type: 'door' }
            ], 0.14);
            addWallLine(targetGroup, 40.1, -12.0, B2_LK2_X1, -12.0, [], 0.12);
            addWallLine(targetGroup, 40.1, -10.9, B2_LK2_X1, -10.9, [], 0.12);
            addWallLine(targetGroup, 40.1, -10.9, 40.1, -9.8, [
                { from: -10.75, to: -9.95, type: 'door' } // Боковая дверь в замкнутый отсек над 107
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
            addWallLine(targetGroup, 51.2, B2_Z_CORR_TOP - 0.35, 58.2, B2_Z_CORR_TOP - 0.35, [], 0.35, true);
            addWallLine(targetGroup, 58.2, B2_Z_TOP, 58.2, B2_Z_CORR_TOP, [
                { from: -8.6, to: -7.4, type: 'door' } // Смежная дверь между 109 и 111 у коридора
            ], INNER_T);
            addWallLine(targetGroup, 61.2, B2_Z_TOP, 61.2, B2_Z_CORR_TOP, [], INNER_T);

            // 6) Блок С/У (X [61.2..64.2], Z [-13.8..-6.8]): нижний С/У, проход слева в верхний С/У и 3 кабинки справа
            addFloorRect(targetGroup, 61.2, B2_Z_TOP, B2_LK1_X1, B2_Z_CORR_TOP, true);
            addWallLine(targetGroup, B2_LK1_X1, B2_Z_TOP, B2_LK1_X1, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 61.2, -9.2, B2_LK1_X1, -9.2, [
                { from: 61.4, to: 62.5, type: 'door' } // Дверь во внутренний верхний С/У
            ], 0.14);
            addWallLine(targetGroup, 62.6, -12.0, B2_LK1_X1, -12.0, [], 0.12);
            addWallLine(targetGroup, 62.6, -11.0, B2_LK1_X1, -11.0, [], 0.12);
            addWallLine(targetGroup, 62.6, -10.1, B2_LK1_X1, -10.1, [], 0.12);
            addWallLine(targetGroup, 62.6, -12.0, 62.6, -9.2, [
                { from: -11.9, to: -11.1, type: 'door' },
                { from: -10.9, to: -10.2, type: 'door' },
                { from: -10.0, to: -9.3, type: 'door' }
            ], 0.12);

            // 7) Шахта ЛК №1 (X [64.2..67.8]) с северным тамбуром у выхода (Z [-13.8..-11.8])
            addWallLine(targetGroup, B2_LK1_X1, -11.8, B2_X_END, -11.8, [
                { from: 64.7, to: 65.9, type: 'door' }
            ], 0.14);
            buildB2Staircase(targetGroup, B2_LK1_X1 + 0.1, B2_LK1_X2 - 0.15, -11.7, B2_Z_CORR_TOP - 0.1);

            // --- ЮЖНАЯ СТЕНА КОРИДОРА (B2_Z_CORR_BOT = -5.0) И ПОМЕЩЕНИЯ 104, 106, 108, 110 ---
            addWallLine(targetGroup, B2_X_START, B2_Z_CORR_BOT, B2_X_END, B2_Z_CORR_BOT, [
                { from: 21.8, to: 23.0, type: 'door' }, // Левая дверь в 104
                { from: 30.8, to: 32.6, type: 'door' }, // Двустворчатая дверь в 104
                { from: 46.2, to: 48.0, type: 'door' }, // Двустворчатая дверь в 106
                { from: 56.0, to: 57.8, type: 'door' }, // Двустворчатая дверь в 108
                { from: 65.4, to: 66.6, type: 'door' }  // Дверь в 110
            ], INNER_T);

            addWallLine(targetGroup, 38.6, B2_Z_CORR_BOT, 38.6, B2_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, 54.8, B2_Z_CORR_BOT, 54.8, B2_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, B2_LK1_X1, B2_Z_CORR_BOT, B2_LK1_X1, B2_Z_BOT, [], INNER_T);

            // Утолщённый простенок у коридора в зале 108 (X [58.0..64.2])
            addWallLine(targetGroup, 58.0, B2_Z_CORR_BOT + 0.35, B2_LK1_X1, B2_Z_CORR_BOT + 0.35, [], 0.35, true);

            // Пристенные квадратные пилястры (колонны) строго вдоль стен коридора, как на чертеже!
            // В комнате 103 (у северной стены коридора Z = -7.05)
            [23.5, 26.8].forEach(cx => addSquareColumn(targetGroup, cx, B2_Z_CORR_TOP - 0.25, 0.38));
            // В залах 104 и 106 (у южной стены коридора Z = -4.75)
            [23.8, 27.0, 30.2, 33.4, 36.6, 42.6, 45.6, 48.8, 52.0].forEach(cx => {
                addSquareColumn(targetGroup, cx, B2_Z_CORR_BOT + 0.25, 0.38);
            });

            // 3D-плашки помещений 1-го этажа Корпуса 2 (buildingId = 2)
            addRoomLabel3D(targetGroup, 1, '103', 23.9, -8.7, false, false, 2, 0.95);
            addRoomLabel3D(targetGroup, 1, '105', 33.0, -10.3, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 1, '107', 40.2, -8.3, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 1, 'ЛК№2', 43.6, -9.2, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 1, '109', 53.1, -10.3, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 1, '111', 59.7, -10.3, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 1, 'С/У', 62.7, -12.6, true, false, 2, 0.82);
            addRoomLabel3D(targetGroup, 1, 'С/У', 62.7, -8.0, true, false, 2, 0.82);
            addRoomLabel3D(targetGroup, 1, 'ЛК№1', 66.0, -9.2, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 1, 'Библиотека', 29.5, -0.5, false, true, 2, 1.1);
            addRoomLabel3D(targetGroup, 1, '106', 46.7, -0.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 1, '108', 59.5, -0.5, false, false, 2, 1.0);
            addRoomLabel3D(targetGroup, 1, '110', 66.0, -0.5, true, false, 2, 0.92);
        }

        /**
         * КОРПУС 2 — ЭТАЖ 2
         * Точное соответствие чертежу 2-го этажа:
         * - Северный ряд: левый торцевой отсек и 203 (соединены дверью), 205, сквозной проход X [36.2..38.8] к переходу в Корпус 4
         * - Блок из двух С/У (X [38.8..41.8]): правый малый у входа, левый глубокий с 3 кабинками
         * - ЛК №2 (X [41.8..45.4]), 209 (X [45.4..48.4]), 211 (X [48.4..60.6]) с 3 пилястрами у коридора, 213 с подсобкой, ЛК №1
         * - Южный ряд: 202, 204, 206, 208, открытый карман коридора X [41.8..44.8] до южной стены, 210, 212, 214
         */
        function buildBuilding2Floor2(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            addFloorRect(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_BOT, false);

            // Западная внешняя стена (стык с переходом в Корпус 1) — НЕ ТРОГАЕМ!
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_START, B2_Z_BOT, [
                { from: -6.5, to: -5.1, type: 'door' }
            ], OUTER_T);

            // Северная внешняя стена (выход в переход к Корпусу 4 на X [36.5..38.5]) — НЕ ТРОГАЕМ!
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_TOP, [
                { from: 36.5, to: 38.5, type: 'door' }
            ], OUTER_T);
            addWallLine(targetGroup, B2_X_START, B2_Z_BOT, B2_X_END, B2_Z_BOT, [], OUTER_T);
            addWallLine(targetGroup, B2_X_END, B2_Z_TOP, B2_X_END, B2_Z_BOT, [], OUTER_T);

            // --- СЕВЕРНАЯ СТЕНА КОРИДОРА 2-ГО ЭТАЖА (B2_Z_CORR_TOP = -6.8) ---
            addWallLine(targetGroup, B2_X_START, B2_Z_CORR_TOP, B2_X_END, B2_Z_CORR_TOP, [
                { from: 24.1, to: 25.3, type: 'door' }, // Дверь в 203
                { from: 32.0, to: 33.8, type: 'door' }, // Двустворчатая дверь в 205
                { from: 36.2, to: 38.8, type: 'open' }, // Открытый проход к переходу в Корпус 4
                { from: 39.1, to: 40.1, type: 'door' }, // Дверь в левый С/У
                { from: 40.5, to: 41.5, type: 'door' }, // Дверь в правый С/У
                { from: 42.6, to: 44.6, type: 'door' }, // Двустворчатая дверь в ЛК №2
                { from: 46.0, to: 47.8, type: 'door' }, // Двустворчатая дверь в 209
                { from: 57.6, to: 59.4, type: 'door' }, // Двустворчатая дверь в 211
                { from: 61.8, to: 63.0, type: 'door' }, // Дверь в 213
                { from: 65.1, to: 67.1, type: 'door' }  // Двустворчатая дверь в ЛК №1
            ], INNER_T);

            // 1) Левый отсек (X [20.4..23.4]), кабинет 203 (X [23.4..26.4]) и зал 205 (X [26.4..36.2])
            addWallLine(targetGroup, 23.4, B2_Z_TOP, 23.4, B2_Z_CORR_TOP, [
                { from: -9.4, to: -8.2, type: 'door' } // Внутренняя дверь из 203 в левый отсек
            ], INNER_T);
            addWallLine(targetGroup, 26.4, B2_Z_TOP, 26.4, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 36.2, B2_Z_TOP, 36.2, B2_Z_CORR_TOP, [], INNER_T);

            // Короба/простенки у коридора в 203 и 205 (как на чертеже)
            addWallLine(targetGroup, 25.5, B2_Z_CORR_TOP - 0.32, 31.8, B2_Z_CORR_TOP - 0.32, [], 0.32, true);
            addWallLine(targetGroup, 34.0, B2_Z_CORR_TOP - 0.32, 36.2, B2_Z_CORR_TOP - 0.32, [], 0.32, true);

            // 2) Блок двух С/У (X [38.8..41.8], Z [-13.8..-6.8]):
            // Правый малый С/У у коридора (X [40.3..41.8], Z [-10.0..-6.8]) и левый глубокий С/У с 3 кабинками справа (Z [-13.2..-10.0])
            addFloorRect(targetGroup, 38.8, B2_Z_TOP, B2_LK2_X1, B2_Z_CORR_TOP, true);
            addWallLine(targetGroup, 38.8, B2_Z_TOP, 38.8, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, B2_LK2_X1, B2_Z_TOP, B2_LK2_X1, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 40.3, -10.0, 40.3, B2_Z_CORR_TOP, [], 0.14);
            addWallLine(targetGroup, 40.3, -13.2, B2_LK2_X1, -13.2, [], 0.12);
            addWallLine(targetGroup, 40.3, -12.1, B2_LK2_X1, -12.1, [], 0.12);
            addWallLine(targetGroup, 40.3, -11.0, B2_LK2_X1, -11.0, [], 0.12);
            addWallLine(targetGroup, 40.3, -10.0, B2_LK2_X1, -10.0, [], 0.12);
            addWallLine(targetGroup, 40.3, -13.2, 40.3, -10.0, [
                { from: -13.0, to: -12.2, type: 'door' },
                { from: -12.0, to: -11.1, type: 'door' },
                { from: -10.9, to: -10.1, type: 'door' }
            ], 0.12);

            // 3) Шахта ЛК №2 (X [41.8..45.4]), каб. 209 (X [45.4..48.4]), зал 211 (X [48.4..60.6]), каб. 213 (X [60.6..64.2]) и ЛК №1 (X [64.2..67.8])
            addWallLine(targetGroup, B2_LK2_X2, B2_Z_TOP, B2_LK2_X2, B2_Z_CORR_TOP, [], INNER_T);
            buildB2Staircase(targetGroup, B2_LK2_X1 + 0.1, B2_LK2_X2 - 0.1, B2_Z_TOP + 0.1, B2_Z_CORR_TOP - 0.1);

            addWallLine(targetGroup, 48.4, B2_Z_TOP, 48.4, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 60.6, B2_Z_TOP, 60.6, B2_Z_CORR_TOP, [], INNER_T);

            addWallLine(targetGroup, B2_LK1_X1, B2_Z_TOP, B2_LK1_X1, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 60.6, -9.8, B2_LK1_X1, -9.8, [
                { from: 60.9, to: 62.1, type: 'door' } // Вход из 213 в заднюю подсобку
            ], INNER_T);

            buildB2Staircase(targetGroup, B2_LK1_X1 + 0.1, B2_LK1_X2 - 0.15, B2_Z_TOP + 0.1, B2_Z_CORR_TOP - 0.1);

            // --- ЮЖНАЯ СТЕНА КОРИДОРА 2-ГО ЭТАЖА (B2_Z_CORR_BOT = -5.0) ---
            // Между 208 (X = 41.8) и 210 (X = 44.8) — открытый карман коридора до самой южной стены B2_Z_BOT!
            addWallLine(targetGroup, B2_X_START, B2_Z_CORR_BOT, B2_X_END, B2_Z_CORR_BOT, [
                { from: 21.1, to: 22.7, type: 'door' }, // Двустворчатая дверь в 202
                { from: 24.1, to: 25.7, type: 'door' }, // Двустворчатая дверь в 204
                { from: 27.2, to: 29.0, type: 'door' }, // Двустворчатая дверь в 206
                { from: 39.6, to: 40.8, type: 'door' }, // Дверь в 208
                { from: 41.8, to: 44.8, type: 'open' }, // Открытый южный карман коридора между 208 и 210
                { from: 45.8, to: 47.0, type: 'door' }, // Дверь в 210
                { from: 49.0, to: 50.8, type: 'door' }, // Двустворчатая дверь в 212
                { from: 61.6, to: 63.4, type: 'door' }  // Двустворчатая дверь в 214
            ], INNER_T);

            // Поперечные стены южного ряда: 202, 204, 206, 208, [карман 41.8..44.8], 210, 212, 214
            [23.4, 26.4, 38.8, 41.8, 44.8, 48.4, 57.6].forEach(vx => {
                addWallLine(targetGroup, vx, B2_Z_CORR_BOT, vx, B2_Z_BOT, [], INNER_T);
            });

            // Утолщённые простенки у южной стены коридора в 212 и 214 (как на плане)
            addWallLine(targetGroup, 54.4, B2_Z_CORR_BOT + 0.32, 57.6, B2_Z_CORR_BOT + 0.32, [], 0.32, true);
            addWallLine(targetGroup, 64.0, B2_Z_CORR_BOT + 0.32, B2_X_END, B2_Z_CORR_BOT + 0.32, [], 0.32, true);

            // Пристенные квадратные пилястры вдоль обеих сторон коридора (строго по плану 2-го этажа!)
            // Северная сторона коридора (в 203 и 211):
            [22.6, 23.7, 51.4, 54.2, 56.8].forEach(cx => {
                addSquareColumn(targetGroup, cx, B2_Z_CORR_TOP - 0.25, 0.36);
            });
            // Южная сторона коридора (в 206, 210, 212, 214):
            [29.5, 32.5, 35.5, 45.1, 51.4, 54.1, 61.0, 63.8].forEach(cx => {
                addSquareColumn(targetGroup, cx, B2_Z_CORR_BOT + 0.25, 0.36);
            });

            // 3D-плашки помещений 2-го этажа Корпуса 2 (buildingId = 2)
            addRoomLabel3D(targetGroup, 2, '203', 24.9, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 2, '205', 31.3, -10.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 2, 'С/У', 39.5, -8.4, true, false, 2, 0.80);
            addRoomLabel3D(targetGroup, 2, 'С/У', 41.0, -8.4, true, false, 2, 0.80);
            addRoomLabel3D(targetGroup, 2, 'ЛК№2', 43.6, -12.5, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 2, '209', 46.9, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 2, '211', 54.5, -10.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 2, '213', 62.4, -8.4, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 2, 'ЛК№1', 66.0, -12.5, true, false, 2, 0.88);

            addRoomLabel3D(targetGroup, 2, '202', 21.9, -0.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 2, '204', 24.9, -0.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 2, '206', 32.6, -0.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 2, '208', 40.3, -0.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 2, '210', 46.6, -0.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 2, '212', 53.0, -0.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 2, '214', 62.7, -0.5, false, false, 2, 1.05);
        }

        /**
         * КОРПУС 2 — ЭТАЖ 3
         * Точное соответствие чертежу 3-го этажа:
         * - Слева: комната 302 (X [20.4..23.2], Z [-13.8..-5.0]) с двустворчатой дверью прямо в огромный зал 308!
         * - Поворот коридора вверх (X [23.2..25.6]) с двустворчатой дверью в верхний отсек и дверью в 304
         * - Кабинеты 304, 305, 306, 307 (между 306 и 307 внутренняя дверь сверху), блок двух С/У (X [38.8..41.8]) с дверью в 307
         * - ЛК №2 (X [41.8..45.4]), отсечённая в коридоре двумя дверями, и открытый карман коридора правее неё (X [45.4..48.0])
         * - Залы 313, 314, 315, ЛК №1 (с дверью-отсечкой в коридоре на X = 64.2)
         * - Внизу: гигантский зал 308 (X [20.4..41.8]), зал 312 (X [41.8..54.6]), зал 316 (X [54.6..64.2]), комната 318 и проход в правый нижний отсек
         */
        function buildBuilding2Floor3(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            addFloorRect(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_BOT, false);

            // Глухой внешний периметр 3-го этажа (без переходов)
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_START, B2_Z_BOT, [], OUTER_T);
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_TOP, [], OUTER_T);
            addWallLine(targetGroup, B2_X_START, B2_Z_BOT, B2_X_END, B2_Z_BOT, [], OUTER_T);
            addWallLine(targetGroup, B2_X_END, B2_Z_TOP, B2_X_END, B2_Z_BOT, [], OUTER_T);

            // 1) Левый торец: комната 302 (X [20.4..23.2], Z [-13.8..-5.0]) и поворот коридора вверх (X [23.2..25.6])
            addWallLine(targetGroup, 23.2, B2_Z_TOP, 23.2, B2_Z_CORR_BOT, [], INNER_T);
            addWallLine(targetGroup, 23.2, -9.8, 25.6, -9.8, [
                { from: 23.8, to: 25.0, type: 'door' } // Двустворчатая дверь в верхний отсек правее 302
            ], INNER_T);

            // --- СЕВЕРНАЯ СТЕНА КОРИДОРА 3-ГО ЭТАЖА (B2_Z_CORR_TOP = -6.8, от X = 25.6 до ЛК №1) ---
            addWallLine(targetGroup, 25.6, B2_Z_CORR_TOP, B2_LK1_X1, B2_Z_CORR_TOP, [
                { from: 26.6, to: 27.8, type: 'door' },      // Дверь в 304
                { from: 29.9, to: 31.1, type: 'door' },      // Дверь в 305
                { from: 33.2, to: 34.4, type: 'door' },      // Дверь в 306
                { from: 36.5, to: 37.7, type: 'door' },      // Дверь в 307
                { from: 39.1, to: 40.1, type: 'door' },      // Дверь в левый С/У
                { from: 40.5, to: 41.5, type: 'door' },      // Дверь в правый С/У
                { from: B2_LK2_X1, to: 48.0, type: 'open' }, // Открытый подход к ЛК №2 и карман коридора правее неё (X [45.4..48.0])
                { from: 51.0, to: 52.4, type: 'door' },      // Дверь в 313
                { from: 56.4, to: 57.8, type: 'door' },      // Дверь в 314
                { from: 61.8, to: 63.2, type: 'door' }       // Дверь в 315
            ], INNER_T);

            // 2) Кабинеты 304, 305, 306, 307 (X [25.6..38.8], Z [-13.8..-6.8])
            addWallLine(targetGroup, 25.6, B2_Z_TOP, 25.6, B2_Z_CORR_TOP, [
                { from: -12.6, to: -11.4, type: 'door' } // Дверь из верхнего отсека в 304
            ], INNER_T);
            addWallLine(targetGroup, 28.9, B2_Z_TOP, 28.9, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 32.2, B2_Z_TOP, 32.2, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 35.5, B2_Z_TOP, 35.5, B2_Z_CORR_TOP, [
                { from: -12.6, to: -11.4, type: 'door' } // Смежная дверь между 306 и 307
            ], INNER_T);
            addWallLine(targetGroup, 38.8, B2_Z_TOP, 38.8, B2_Z_CORR_TOP, [
                { from: -12.6, to: -11.4, type: 'door' } // Дверь между 307 и задней частью С/У
            ], INNER_T);

            // 3) Блок двух С/У (X [38.8..41.8], Z [-13.8..-6.8]) по чертежу 3-го этажа
            addFloorRect(targetGroup, 38.8, B2_Z_TOP, B2_LK2_X1, B2_Z_CORR_TOP, true);
            addWallLine(targetGroup, B2_LK2_X1, B2_Z_TOP, B2_LK2_X1, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 38.8, -10.2, B2_LK2_X1, -10.2, [], 0.14);
            addWallLine(targetGroup, 40.3, -10.2, 40.3, B2_Z_CORR_TOP, [], 0.14);
            addWallLine(targetGroup, 38.8, -8.5, 40.3, -8.5, [
                { from: 39.1, to: 40.0, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 40.3, -8.5, B2_LK2_X1, -8.5, [
                { from: 40.6, to: 41.5, type: 'door' }
            ], 0.12);

            // 4) Шахта ЛК №2 (X [41.8..45.4]) с двумя дверями-отсечками в коридоре и карманом правее неё (X [45.4..48.0])
            addWallLine(targetGroup, B2_LK2_X2, B2_Z_TOP, B2_LK2_X2, B2_Z_CORR_TOP, [], INNER_T);
            buildB2Staircase(targetGroup, B2_LK2_X1 + 0.1, B2_LK2_X2 - 0.1, B2_Z_TOP + 0.1, B2_Z_CORR_TOP - 0.1);
            addWallLine(targetGroup, B2_LK2_X1, B2_Z_CORR_TOP, B2_LK2_X1, B2_Z_CORR_BOT, [
                { from: -6.4, to: -5.2, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, B2_LK2_X2, B2_Z_CORR_TOP, B2_LK2_X2, B2_Z_CORR_BOT, [
                { from: -6.4, to: -5.2, type: 'door' }
            ], INNER_T);

            // 5) Залы 313 (X [48.0..54.6]), 314 (X [54.6..61.0]), 315 (X [61.0..64.2]) и ЛК №1 (X [64.2..67.8])
            addWallLine(targetGroup, 48.0, B2_Z_TOP, 48.0, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 54.6, B2_Z_TOP, 54.6, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, 61.0, B2_Z_TOP, 61.0, B2_Z_CORR_TOP, [], INNER_T);
            addWallLine(targetGroup, B2_LK1_X1, B2_Z_TOP, B2_LK1_X1, B2_Z_CORR_BOT, [
                { from: -6.4, to: -5.2, type: 'door' } // Дверь-отсечка коридора перед ЛК №1
            ], INNER_T);
            buildB2Staircase(targetGroup, B2_LK1_X1 + 0.1, B2_LK1_X2 - 0.15, B2_Z_TOP + 0.1, B2_Z_CORR_TOP - 0.1);

            // --- ЮЖНАЯ СТЕНА КОРИДОРА 3-ГО ЭТАЖА (B2_Z_CORR_BOT = -5.0) И ЗАЛЫ 308, 312, 316, 318 ---
            addWallLine(targetGroup, B2_X_START, B2_Z_CORR_BOT, B2_X_END, B2_Z_CORR_BOT, [
                { from: 21.0, to: 22.6, type: 'door' }, // Двустворчатая дверь из 302 прямо в 308!
                { from: 23.8, to: 25.0, type: 'door' }, // Левая дверь из коридора в 308
                { from: 35.8, to: 37.0, type: 'door' }, // Правая дверь из коридора в 308
                { from: 46.2, to: 48.0, type: 'door' }, // Двустворчатая дверь в 312
                { from: 61.8, to: 63.0, type: 'door' }, // Дверь в 316
                { from: 66.2, to: 67.4, type: 'door' }  // Дверь из площадки ЛК №1 в правый проход мимо 318
            ], INNER_T);

            // Поперечные стены между гигантскими южными залами 308 (X [20.4..41.8]), 312 (X [41.8..54.6]) и 316 (X [54.6..64.2])
            addWallLine(targetGroup, B2_LK2_X1, B2_Z_CORR_BOT, B2_LK2_X1, B2_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, 54.6, B2_Z_CORR_BOT, 54.6, B2_Z_BOT, [], INNER_T);
            addWallLine(targetGroup, B2_LK1_X1, B2_Z_CORR_BOT, B2_LK1_X1, B2_Z_BOT, [], INNER_T);

            // Узел комнаты 318 (X [64.2..66.0], Z [-5.0..-0.6]), бокового прохода (X [66.0..67.8]) и южного торцевого отсека (Z [-0.6..B2_Z_BOT])
            addWallLine(targetGroup, 66.0, B2_Z_CORR_BOT, 66.0, -0.6, [
                { from: -3.2, to: -2.0, type: 'door' } // Дверь из бокового прохода в 318
            ], 0.14);
            addWallLine(targetGroup, B2_LK1_X1, -0.6, B2_X_END, -0.6, [
                { from: 66.2, to: 67.4, type: 'door' } // Дверь из бокового прохода в угловой южный отсек
            ], 0.14);

            // 3D-плашки помещений 3-го этажа Корпуса 2 (buildingId = 2)
            addRoomLabel3D(targetGroup, 3, '302', 21.8, -9.2, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 3, '304', 27.25, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 3, '305', 30.55, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 3, '306', 33.85, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 3, '307', 37.15, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 3, 'С/У', 39.55, -7.8, true, false, 2, 0.78);
            addRoomLabel3D(targetGroup, 3, 'С/У', 41.05, -7.8, true, false, 2, 0.78);
            addRoomLabel3D(targetGroup, 3, 'ЛК№2', 43.6, -12.5, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 3, '313', 51.3, -10.5, false, false, 2, 1.0);
            addRoomLabel3D(targetGroup, 3, '314', 57.8, -10.5, false, false, 2, 1.0);
            addRoomLabel3D(targetGroup, 3, '315', 62.6, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 3, 'ЛК№1', 66.0, -12.5, true, false, 2, 0.88);

            addRoomLabel3D(targetGroup, 3, 'Спортивный зал', 31.1, -0.5, false, true, 2, 1.1);
            addRoomLabel3D(targetGroup, 3, 'Конференц-зал', 48.2, -0.5, false, true, 2, 1.1);
            addRoomLabel3D(targetGroup, 3, '316', 59.4, -0.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 3, '318', 65.1, -2.8, true, false, 2, 0.82);
        }
window.buildBuilding2Floor1 = buildBuilding2Floor1;
window.buildBuilding2Floor2 = buildBuilding2Floor2;
window.buildBuilding2Floor3 = buildBuilding2Floor3;
