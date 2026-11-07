(function() {
    'use strict';

        function buildBuilding2Floor2(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            addFloorRect(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_BOT, false);

            // Западная внешняя стена (стык с переходом в Корпус 1) — НЕ ТРОГАЕМ!
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_START, B2_Z_BOT, [
                { from: -6.5, to: -5.1, type: 'door' }
            ], OUTER_T);

            // Северная внешняя стена (выход в переход к Корпусу 4 на X [36.0..38.8])
            addWallLine(targetGroup, B2_X_START, B2_Z_TOP, B2_X_END, B2_Z_TOP, [
                { from: 36.0, to: 38.8, type: 'door' }
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
            addWallLine(targetGroup, 26.4, B2_Z_CORR_TOP - 0.32, 31.8, B2_Z_CORR_TOP - 0.32, [], 0.32, true);
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
                { from: -10.9, to: -10.0, type: 'door' }
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
            addRoomLabel3D(targetGroup, 2, 'WC (Ж)', 39.5, -8.4, true, false, 2, 0.80);
            addRoomLabel3D(targetGroup, 2, 'С/У', 41.0, -8.4, true, false, 2, 0.80);
            addRoomLabel3D(targetGroup, 2, 'ЛК№2', 44.5, -12.5, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 2, '209\nУчебная часть', 46.9, -10.5, false, true, 2, 1.05);
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
            flushWalls(targetGroup);
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
                { from: 20.52, to: 22.6, type: 'door' }, // Двустворчатая дверь из 302 прямо в 308!
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
            addRoomLabel3D(targetGroup, 3, 'WC (М)', 39.55, -7.8, true, false, 2, 0.78);
            addRoomLabel3D(targetGroup, 3, 'WC (Ж)', 41.05, -7.8, true, false, 2, 0.78);
            addRoomLabel3D(targetGroup, 3, 'ЛК№2', 44.5, -12.5, true, false, 2, 0.88);
            addRoomLabel3D(targetGroup, 3, '313', 51.3, -10.5, false, false, 2, 1.0);
            addRoomLabel3D(targetGroup, 3, '314', 57.8, -10.5, false, false, 2, 1.0);
            addRoomLabel3D(targetGroup, 3, '315', 62.6, -10.5, true, false, 2, 0.90);
            addRoomLabel3D(targetGroup, 3, 'ЛК№1', 66.0, -12.5, true, false, 2, 0.88);

            // Обновленные таблички по плану БТИ (Корпус 2, Этаж 3): добавлены официальные номера 308 и 312
            addRoomLabel3D(targetGroup, 3, '308\nСпортивный зал', 31.1, -0.5, false, true, 2, 1.1);
            addRoomLabel3D(targetGroup, 3, '312\nКонференц-зал', 48.2, -0.5, false, true, 2, 1.1);
            addRoomLabel3D(targetGroup, 3, '316', 59.4, -0.5, false, false, 2, 1.05);
            addRoomLabel3D(targetGroup, 3, '318', 65.1, -2.8, true, false, 2, 0.82);
            flushWalls(targetGroup);
        }
    window.buildBuilding2Floor2 = buildBuilding2Floor2;
    window.buildBuilding2Floor3 = buildBuilding2Floor3;
})();
