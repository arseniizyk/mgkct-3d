(function() {
    'use strict';

    function buildBuilding4Floor1KitchenAndLabels(targetGroup, INNER_T) {
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
                { from: -50.5, to: -49.7, type: 'door' }, // Вход в 4
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
                { from: 45.4, to: 47.7, type: 'open' }   // Открытый проем в главный коридор кухни
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
                { from: -58.4, to: -57.2, type: 'door' } // Выход из 21 в горячий цех 24
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
            addWallLine(targetGroup, 59.0, -52.0, 59.0, -49.8, [
                { from: -51.2, to: -50.0, type: 'door' } // Вход в 19
            ], INNER_T);
            addWallLine(targetGroup, 59.0, -49.8, 62.3, -49.8, [], INNER_T);

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
    window.buildBuilding4Floor1KitchenAndLabels = buildBuilding4Floor1KitchenAndLabels;
})();
