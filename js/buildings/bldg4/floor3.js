(function() {
    'use strict';

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
            // Единый монолитный контур плит 3-го этажа Корпуса 4 (исключает северный и юго-восточный второй свет и шахту ЛК-1):
            addFloorPolygon(targetGroup, [
                [B4_X_WEST, B4_Z_MID_N],
                [B4_X_S_HALL, B4_Z_MID_N],
                [B4_X_S_HALL, -43.6],
                [49.0, -43.6],
                [49.0, B4_Z_SOUTH],
                [B4_LK1_X2, B4_Z_SOUTH],
                [B4_LK1_X2, -29.6],
                [B4_LK1_X1, -29.6],
                [B4_LK1_X1, B4_Z_SOUTH],
                [B4_X_WEST, B4_Z_SOUTH]
            ], false);

            // Акцентная плитка в блоке двух С/у и в Витраже
            addFloorRect(targetGroup, 39.4, -41.6, 43.1, -37.2, true); // Два С/у
            addFloorRect(targetGroup, 39.4, -37.2, 45.4, -31.0, true); // Витраж

            // Плиты трех сквозных лестничных клеток
            addFloorRect(targetGroup, B4_LK2_X1, B4_LK2_Z1, B4_X_WEST, -46.7, true);
            addFloorRect(targetGroup, 61.9, B4_LK3_Z1, B4_LK3_X2, -46.6, true);
            addFloorRect(targetGroup, 38.8, -29.6, B4_LK1_X2, B4_LK1_Z2, true);

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
            addWallLine(targetGroup, B4_X_WEST, B4_Z_SOUTH, 38.8, B4_Z_SOUTH, [], OUTER_T);
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

            // Шахта ЛК №1 (X [38.8..42.4], Z [-29.6..-24.4]) и стена 310 (Z = -29.6) строго по БТИ 3.jpg
            addWallLine(targetGroup, 38.8, -29.6, 38.8, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, B4_LK1_X2, -29.6, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, 38.8, B4_LK1_Z2, B4_LK1_X2, B4_LK1_Z2, [], OUTER_T);
            addWallLine(targetGroup, 38.8, -29.6, 45.4, -29.6, [
                { from: 39.8, to: 41.4, type: 'door' }, // Двустворчатый вход в ЛК №1
                { from: 43.0, to: 44.0, type: 'door' }  // Вход в холл 310
            ], INNER_T);
            buildB4Staircase(targetGroup, 38.9, B4_LK1_X2 - 0.1, -29.5, B4_LK1_Z2 - 0.1, true);

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

            addRoomLabel(targetGroup, 3, 'С/У', 42.3, -40.5, true, false, 4, 0.72);
            addRoomLabel(targetGroup, 3, 'С/У', 42.3, -38.3, true, false, 4, 0.72);

            addRoomLabel(targetGroup, 3, '306', 34.2, -44.2, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '304', 34.2, -39.4, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '308', 34.2, -34.7, true, false, 4, 0.90);
            addRoomLabel(targetGroup, 3, '309', 34.2, -29.8, true, false, 4, 0.90);
            flushWalls(targetGroup);
        }
    window.buildBuilding4Floor3 = buildBuilding4Floor3;
})();
