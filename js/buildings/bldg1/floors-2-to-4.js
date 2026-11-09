(function() {
    'use strict';

        function buildFloor4(targetGroup) {
            // 4 этаж: сопоставлен с типовым внешним контуром с поворотом исходного плана на 90° CW
            buildCommonStructure(targetGroup, 4, false);
            const INNER_T = 0.18;

            // 1. Северный блок: помещения 403, 403А и 404 (Z [-14.0..-6.2])
            // Южная стена северного ряда вдоль коридора (убрана ошибочная дверь в тамбур 403А)
            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -1.4, to: 0.6, type: 'door' }, // Двустворчатый вход в 403
                { from: 6.8, to: 9.0, type: 'door' }   // Двустворчатый вход в 404
            ], INNER_T);

            // Вертикальные перегородки между 403, 403А и 404 (входы в тамбур перед 403А)
            addWallLine(targetGroup, 1.6, -14.0, 1.6, -6.2, [
                { from: -8.0, to: -6.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 5.4, -14.0, 5.4, -6.2, [
                { from: -8.0, to: -6.8, type: 'door' }
            ], INNER_T);

            // Внутренняя стенка тамбура со входом в 403А
            addWallLine(targetGroup, 1.6, -8.6, 5.4, -8.6, [
                { from: 2.9, to: 4.1, type: 'door' }
            ], INNER_T);

            // Поперечная противопожарная перегородка коридора (север ↔ запад) по плану 4.jpg
            addWallLine(targetGroup, -5.8, -6.2, -5.8, -4.0, [
                { from: -5.6, to: -4.4, type: 'door' }
            ], INNER_T);

            // 2. Западный блок: препараторские 402А (узкая), 401А (узкая) и кабинет 402 (полноценный)
            // Торцевая стена прохода от коридора к 403
            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], OUTER_T);

            // Стена ряда кабинетов вдоль коридора со входами в 402А, 401А и 402
            addWallLine(targetGroup, -5.8, -4.0, -5.8, 7.2, [
                { from: -2.8, to: -1.6, type: 'door' }, // Вход из коридора в 402А
                { from: 0.8, to: 2.0, type: 'door' },   // Вход из коридора в 401А
                { from: 4.6, to: 6.6, type: 'door' }    // Полноценный двустворчатый вход из коридора в 402
            ], INNER_T);

            // Общая стена между кабинетом 402 и кабинетом 401 (без промежутков и зазоров)
            addWallLine(targetGroup, -5.8, 7.2, -5.8, 14.0, [], INNER_T);

            // Перегородка между узкими препараторскими 402А (Z [-4.0..-0.5]) и 401А (Z [-0.5..3.0])
            addWallLine(targetGroup, -14.0, -0.5, -5.8, -0.5, [], INNER_T);

            // Перегородка между препараторской 401А и аудиторией 402 (Z [3.0..14.0])
            addWallLine(targetGroup, -14.0, 3.0, -5.8, 3.0, [], INNER_T);

            // 3. Южный блок: большой зал 401 (X [-5.8..12.5], Z [7.2..14.0])
            // Вход в 401 расположен у западного края рядом с аудиторией 402 по плану 4.jpg
            addWallLine(targetGroup, -5.8, 7.2, 12.5, 7.2, [
                { from: -5.0, to: -3.8, type: 'door' }
            ], INNER_T);

            // Подписи помещений 4 этажа
            addRoomLabel3D(targetGroup, 4, '403', -4.2, -10.2);
            addRoomLabel3D(targetGroup, 4, '403А', 3.5, -11.4);
            addRoomLabel3D(targetGroup, 4, '404', 10.6, -10.2);
            addRoomLabel3D(targetGroup, 4, '402А', -9.9, -2.25);
            addRoomLabel3D(targetGroup, 4, '401А', -9.9, 1.25);
            addRoomLabel3D(targetGroup, 4, '402', -9.9, 8.5);
            addRoomLabel3D(targetGroup, 4, '401', 3.35, 10.6, false, true);
            flushWalls(targetGroup);
        }

        function buildFloor3(targetGroup) {
            // Правый выступ пристроя присутствует на 3 этаже по плану БТИ 3.jpg (кабинет 305)
            buildCommonStructure(targetGroup, 3, true);
            const INNER_T = 0.18;

            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -1.4, to: 0.6, type: 'door' },
                { from: 6.8, to: 9.0, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 1.6, -14.0, 1.6, -6.2, [
                { from: -8.0, to: -6.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 5.4, -14.0, 5.4, -6.2, [
                { from: -8.0, to: -6.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 1.6, -8.6, 5.4, -8.6, [
                { from: 2.9, to: 4.1, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -5.8, -6.2, -5.8, -4.0, [
                { from: -5.6, to: -4.4, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], OUTER_T);
            addWallLine(targetGroup, -14.0, 0.0, -5.8, 0.0, [
                { from: -8.0, to: -6.8, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, -5.8, -4.0, -5.8, 14.0, [
                { from: -2.2, to: -1.0, type: 'door' },
                { from: 1.8, to: 3.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -5.8, 7.2, 12.5, 7.2, [
                { from: -4.6, to: -3.4, type: 'door' },
                { from: -1.4, to: 0.6, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -2.2, 7.2, -2.2, 14.0, [
                { from: 8.2, to: 9.4, type: 'door' }
            ], INNER_T);

            // Ступени в коридоре перед входом в восточный пристрой (ауд. 305)
            buildCorridorStepsRight(targetGroup);

            addRoomLabel3D(targetGroup, 3, '303', -4.2, -10.2);
            addRoomLabel3D(targetGroup, 3, '303А', 3.5, -11.4);
            addRoomLabel3D(targetGroup, 3, '304', 10.6, -10.2);
            addRoomLabel3D(targetGroup, 3, '302А', -9.9, -2.0);
            addRoomLabel3D(targetGroup, 3, '302', -9.9, 7.0);
            addRoomLabel3D(targetGroup, 3, '301А', -4.0, 10.8);
            addRoomLabel3D(targetGroup, 3, '301', 5.2, 10.8);
            addRoomLabel3D(targetGroup, 3, '305', 18.2, -5.8);
            flushWalls(targetGroup);
        }

        function buildFloor2(targetGroup) {
            // На верхней внешней стене (Z = -14.0) двустворчатый выход из коридора X [4.9..6.9] ведёт в переход к Корпусу 3
            buildCommonStructure(targetGroup, 2, true, [
                { from: 4.9, to: 6.9, type: 'door' }
            ]);
            const INNER_T = 0.18;

            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -3.8, to: -2.6, type: 'door' },
                { from: 4.6, to: 7.2, type: 'open' },
                { from: 13.0, to: 14.2, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -5.8, -6.2, -5.8, -4.0, [
                { from: -5.6, to: -4.4, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -0.4, -14.0, -0.4, -6.2, [], INNER_T);
            addWallLine(targetGroup, -0.4, -11.4, 4.6, -11.4, [], INNER_T);

            addWallLine(targetGroup, 4.6, -14.0, 4.6, -6.2, [
                { from: -13.1, to: -11.9, type: 'door' },
                { from: -8.2, to: -7.0, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 1.55, -8.85, 2.05, -8.85, [], 0.14);
            addWallLine(targetGroup, 1.55, -8.35, 2.05, -8.35, [], 0.14);
            addWallLine(targetGroup, 1.55, -8.85, 1.55, -8.35, [], 0.14);
            addWallLine(targetGroup, 2.05, -8.85, 2.05, -8.35, [], 0.14);
            addWallLine(targetGroup, 3.3, -8.5, 4.6, -8.5, [], INNER_T);

            addWallLine(targetGroup, 7.2, -14.0, 7.2, -6.2, [
                { from: -13.1, to: -11.9, type: 'door' },
                { from: -8.2, to: -7.0, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 7.2, -9.4, 16.0, -9.4, [], INNER_T);
            addWallLine(targetGroup, 12.2, -9.4, 12.2, -6.2, [], INNER_T);

            buildCorridorStepsRight(targetGroup);

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], OUTER_T);

            addWallLine(targetGroup, -5.8, -4.0, -5.8, 14.0, [
                { from: -2.0, to: -0.9, type: 'door' },
                { from: 0.6, to: 1.7, type: 'door' },
                { from: 4.5, to: 5.7, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -14.0, -0.4, -5.8, -0.4, [], INNER_T);
            addWallLine(targetGroup, -7.6, -4.0, -7.6, -0.4, [
                { from: -2.0, to: -0.9, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, -7.6, -2.3, -5.8, -2.3, [
                { from: -7.2, to: -6.2, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -14.0, 3.2, -5.8, 3.2, [
                { from: -10.8, to: -9.6, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, -8.2, -0.4, -8.2, 3.2, [
                { from: 0.9, to: 2.1, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -14.0, 7.2, -5.8, 7.2, [
                { from: -7.4, to: -6.2, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -14.0, 11.2, -11.2, 11.2, [], INNER_T);
            addWallLine(targetGroup, -9.5, 7.2, -9.5, 9.5, [
                { from: 8.2, to: 9.2, type: 'door' }
            ], INNER_T);
            addMiteredChamferWall(targetGroup, -11.2, 11.2, -9.5, 9.5, INNER_T, false, false);

            addWallLine(targetGroup, -5.8, 7.2, 12.5, 7.2, [
                { from: -4.6, to: -3.4, type: 'door' },
                { from: -2.0, to: -0.9, type: 'door' },
                { from: 4.5, to: 5.7, type: 'door' },
                { from: 9.2, to: 10.4, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -2.6, 7.2, -2.6, 14.0, [], INNER_T);

            addWallLine(targetGroup, -0.4, 7.2, -0.4, 9.4, [
                { from: 8.0, to: 9.1, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, -2.6, 9.4, 4.0, 9.4, [
                { from: -2.1, to: -1.0, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 1.4, 9.4, 1.4, 14.0, [], INNER_T);

            addWallLine(targetGroup, 4.0, 7.2, 4.0, 14.0, [
                { from: 11.2, to: 12.6, type: 'open' }
            ], INNER_T);

            addRoomLabel3D(targetGroup, 2, '208', -5.2, -10.2);
            addRoomLabel3D(targetGroup, 2, '210', 2.1, -12.7);
            addRoomLabel3D(targetGroup, 2, '209', 1.8, -10.0);
            addRoomLabel3D(targetGroup, 2, '211', 11.6, -11.7);
            addRoomLabel3D(targetGroup, 2, '212', 9.7, -7.8);
            addRoomLabel3D(targetGroup, 2, '213', 14.1, -7.8);
            addRoomLabel3D(targetGroup, 2, 'Переход в\nкорпус №2', 18.2, -5.8, false, true);
            addRoomLabel3D(targetGroup, 2, '207', -11.2, -2.2);
            addRoomLabel3D(targetGroup, 2, '206', -11.2, 1.4);
            addRoomLabel3D(targetGroup, 2, '204', -10.2, 5.2);
            addRoomLabel3D(targetGroup, 2, '205', -8.0, 12.2);
            addRoomLabel3D(targetGroup, 2, '203', -4.2, 11.5);
            addRoomLabel3D(targetGroup, 2, '202', -0.6, 11.8);
            addRoomLabel3D(targetGroup, 2, '201', 8.5, 11.5);
            flushWalls(targetGroup);
        }

        // Вспомогательная функция для отрисовки квадратных колонн (для 1 и 2 этажей)
    window.buildFloor2 = buildFloor2;
    window.buildFloor3 = buildFloor3;
    window.buildFloor4 = buildFloor4;
})();
