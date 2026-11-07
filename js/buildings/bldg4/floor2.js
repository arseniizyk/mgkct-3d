(function() {
    'use strict';

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

            // 1. Единая монолитная плита перекрытия 2-го этажа Корпуса 4 (включая переходы К3 ↔ К4 и К4 ↔ К2 без поперечных стыков):
            addFloorPolygon(targetGroup, [
                [B4_X_WEST, B4_Z_NORTH],
                [B4_X_S_GYM, B4_Z_NORTH],
                [B4_X_S_GYM, B4_Z_SOUTH],
                [B4_LK1_X1, B4_Z_SOUTH],
                [B4_LK1_X1, B2_Z_TOP],
                [36.0, B2_Z_TOP],
                [36.0, B4_Z_SOUTH],
                [B4_X_WEST, B4_Z_SOUTH],
                [B4_X_WEST, -44.2],
                [15.6, -44.2],
                [15.6, -46.8],
                [B4_X_WEST, -46.8]
            ], false);

            // Выступающие лестничные клетки Корпуса 4:
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_X_WEST, B4_LK2_Z2, true);
            addFloorRect(targetGroup, 63.6, B4_LK3_Z1, B4_LK3_X2, -46.8, true);
            addFloorRect(targetGroup, B4_LK1_X1, B4_LK1_Z1, B4_LK1_X2, B4_LK1_Z2, true);

            // --- ДВА ПРЯМЫХ НАДЗЕМНЫХ КОРИДОРА-ПЕРЕХОДА 2-ГО ЭТАЖА ---
            // 1) ПРЯМОЙ ПЕРЕХОД К3 ↔ К4 (X [15.6..32.4], Z [-46.8..-44.2]) — стыкуется со стеной X = 15.6 без нахлёста
            addWallLine(targetGroup, 15.60, -46.8, B4_LK2_X1, -46.8, [], OUTER_T);
            addWallLine(targetGroup, 15.60, -44.2, B4_X_WEST, -44.2, [], OUTER_T);

            // 2) ПРЯМОЙ ПЕРЕХОД К4 ↔ К2 (X [36.0..38.8], Z [-27.4..-13.8]) — стыкуется со стеной Z = -13.8 без нахлёста
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
            addWallLine(targetGroup, B4_X_WEST, -44.2, B4_X_WEST, B4_Z_SOUTH, [], OUTER_T);

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
            // Плита перекрытия санузлов 2-го этажа монолитно покрыта базовым полотном addFloorRect(targetGroup, B4_X_WEST, B4_Z_MID_N, B4_X_S_HALL, B4_Z_SOUTH)
            // (дублирующие фрагменты удалены для исключения внутренних стыков в кабинках)

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
                { from: -49.8, to: -48.7, type: 'door' }
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
                { from: 42.46, to: 43.4, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 41.35, -39.9, 42.46, -39.9, [
                { from: 41.5, to: 42.46, type: 'door' }
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
            addRoomLabel(targetGroup, 2, 'WC (М)', 43.8, -49.1, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 2, 'WC (Ж)', 43.8, -46.0, true, false, 4, 0.72);
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

    window.buildBuilding4Floor2 = buildBuilding4Floor2;
})();
