// ==========================================
// КОРПУС 1 (Этажи 1–7)
// ==========================================

        function buildCommonStructure(targetGroup, floorNum, hasRightExtension = false, topWallOpenings = []) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // 1. Плиты перекрытия базового контура
            addFloorRect(targetGroup, -10.0, -14.0, 16.0, -4.0, false);
            addFloorRect(targetGroup, -14.0, -4.0, -5.8, 14.0, false);
            addFloorRect(targetGroup, -5.8, -4.0, 16.0, 4.0, false);
            addFloorRect(targetGroup, -5.8, 4.0, 12.5, 14.0, false);

            // Правый выступ (для 1 и 2 этажей: Переход в корпус №2)
            if (hasRightExtension) {
                addFloorRect(targetGroup, 16.0, -9.5, 20.4, -2.2, false);
            }

            // Выделенная тонировка центрального ядра и лестниц
            addFloorRect(targetGroup, -1.2, -4.0, 8.6, 4.0, true);
            addFloorRect(targetGroup, 8.6, -3.5, 16.0, 3.8, true);

            // 2. Внешний периметр стен
            addWallLine(targetGroup, -10.0, -14.0, 16.0, -14.0, topWallOpenings, OUTER_T);
            addWallLine(targetGroup, -10.0, -14.0, -10.0, -4.0, [], OUTER_T);
            addWallLine(targetGroup, -14.0, -4.0, -10.0, -4.0, [], OUTER_T);
            addWallLine(targetGroup, -14.0, -4.0, -14.0, 14.0, [], OUTER_T);
            addWallLine(targetGroup, -14.0, 14.0, 12.5, 14.0, [], OUTER_T);
            addWallLine(targetGroup, 12.5, 4.0, 12.5, 14.0, [], OUTER_T);
            addWallLine(targetGroup, 12.5, 4.0, 16.0, 4.0, [], OUTER_T);

            if (!hasRightExtension) {
                addWallLine(targetGroup, 16.0, -14.0, 16.0, 4.0, [], OUTER_T);
            } else {
                addWallLine(targetGroup, 16.0, -14.0, 16.0, 4.0, [
                    { from: -5.6, to: -4.0, type: 'door' }
                ], OUTER_T);

                addWallLine(targetGroup, 16.0, -9.5, 20.4, -9.5, [], OUTER_T);
                addWallLine(targetGroup, 16.0, -2.2, 20.4, -2.2, [], OUTER_T);
                addWallLine(targetGroup, 20.4, -9.5, 20.4, -2.2, [
                    { from: -6.5, to: -5.1, type: 'door' }
                ], OUTER_T);
            }

            // 3. Центральное ядро: Лифты и Санузлы (X [-1.2..8.6], Z [-4.0..4.0])
            // Северная стена ядра со входом в северный С/У
            addWallLine(targetGroup, -1.2, -4.0, 8.6, -4.0, [
                { from: 4.9, to: 5.9, type: 'door' }
            ], INNER_T);

            // Западная стена ядра: двустворчатый вход в лифтовой холл
            addWallLine(targetGroup, -1.2, -4.0, -1.2, 4.0, [
                { from: 0.8, to: 2.6, type: 'door' }
            ], INNER_T);

            // Южная стена ядра со входом в шлюз южного С/У (смещена ниже к лифтовому холлу по планам 2–7 этажей)
            addWallLine(targetGroup, -1.2, 4.0, 8.6, 4.0, [
                { from: 5.0, to: 6.0, type: 'door' }
            ], INNER_T);

            // Восточная стена ядра (разделяет С/У и лестничный блок)
            addWallLine(targetGroup, 8.6, -4.0, 8.6, 4.0, [], INNER_T);

            // --- ШАХТЫ ЛИФТОВ ---
            // Левый грузопассажирский лифт (X [-0.9..1.4], Z [-3.8..-1.0])
            addWallLine(targetGroup, -0.9, -3.8, 1.4, -3.8, [], INNER_T);
            addWallLine(targetGroup, -0.9, -3.8, -0.9, -1.0, [], INNER_T);
            addWallLine(targetGroup, 1.4, -3.8, 1.4, -1.0, [], INNER_T);
            addWallLine(targetGroup, -0.9, -1.0, 1.4, -1.0, [
                { from: -0.2, to: 1.0, type: 'door' }
            ], INNER_T);
            buildElevatorShaftCross(targetGroup, -0.85, -3.7, 1.35, -1.1);

            // Правый пассажирский лифт (X [2.0..4.6], Z [-3.3..-1.0])
            addWallLine(targetGroup, 2.0, -3.3, 4.6, -3.3, [], INNER_T);
            addWallLine(targetGroup, 2.0, -3.3, 2.0, -1.0, [], INNER_T);
            addWallLine(targetGroup, 4.6, -3.3, 4.6, -1.0, [], INNER_T);
            addWallLine(targetGroup, 2.0, -1.0, 4.6, -1.0, [
                { from: 2.5, to: 3.7, type: 'door' }
            ], INNER_T);
            buildElevatorShaftCross(targetGroup, 2.05, -3.2, 4.55, -1.1);

            // Пилон между шахтами лифтов (сплошной колонный монолит 0.6x0.4м)
            addWallLine(targetGroup, 1.4, -0.8, 2.0, -0.8, [], 0.4, true);

            // Разделительная капитальная стена между лифтовым холлом и санузлами
            addWallLine(targetGroup, 4.8, -4.0, 4.8, 4.0, [], INNER_T);

            // --- САНИТАРНЫЙ БЛОК (С/У) ---
            // Центральная капитальная стена между северным и южным С/У
            addWallLine(targetGroup, 4.8, 0.0, 8.6, 0.0, [], INNER_T);

            // 1) СЕВЕРНЫЙ С/У (Z [-4.0..0.0]): предбанник с севера, кабинки одна за другой по оси X
            // Перегородка кабинного блока со входами в кабинки из предбанника
            addWallLine(targetGroup, 5.7, -1.6, 8.6, -1.6, [
                { from: 5.9, to: 6.9, type: 'door' },
                { from: 7.3, to: 8.3, type: 'door' }
            ], 0.12);
            // Торцевая стенка кабинок
            addWallLine(targetGroup, 5.7, -1.6, 5.7, 0.0, [], 0.12);
            // Поперечная перегородка между кабинками
            addWallLine(targetGroup, 7.1, -1.6, 7.1, 0.0, [], 0.12);

            // 2) ЮЖНЫЙ С/У (Z [0.0..4.0]): шлюз у восточной стены, предбанник и кабинки бок о бок по оси Z
            // Стена шлюза/тамбура с дверью в предбанник
            addWallLine(targetGroup, 4.8, 2.6, 8.6, 2.6, [
                { from: 5.0, to: 6.0, type: 'door' }
            ], 0.12);
            // Стена входов в кабинки из предбанника
            addWallLine(targetGroup, 6.4, 0.0, 6.4, 2.6, [
                { from: 0.3, to: 1.2, type: 'door' },
                { from: 1.5, to: 2.4, type: 'door' }
            ], 0.12);
            // Разделительная перегородка между двумя кабинками
            addWallLine(targetGroup, 6.4, 1.3, 8.6, 1.3, [], 0.12);

            // 4. Две параллельные лестничные клетки ЛК№1 и ЛК№2
            // Северная стена ЛК№1 со входом из северного коридора
            addWallLine(targetGroup, 8.6, -3.8, 16.0, -3.8, [
                { from: 8.8, to: 10.0, type: 'door' }
            ], INNER_T);

            // Центральная противопожарная разделительная стена между ЛК№1 и ЛК№2
            addWallLine(targetGroup, 8.6, 0.0, 16.0, 0.0, [], INNER_T);

            // Южная стена ЛК№2 со входом из южного коридора (до поворота фасада X = 12.5)
            addWallLine(targetGroup, 8.6, 3.8, 12.5, 3.8, [
                { from: 8.8, to: 10.0, type: 'door' }
            ], INNER_T);

            // Лестничные марши с входными и межэтажными площадками
            buildStaircaseUnit(targetGroup, -3.8, 0.0, -1.9, true);
            buildStaircaseUnit(targetGroup, 0.0, 3.8, 1.9, false);

            // Общие плашки ядра и лестниц
            addRoomLabel3D(targetGroup, floorNum, 'С/У', 6.2, -2.8, true);
            addRoomLabel3D(targetGroup, floorNum, 'С/У', 5.6, 1.3, true);
            addRoomLabel3D(targetGroup, floorNum, 'ЛК№1', 9.4, -1.9, true);
            addRoomLabel3D(targetGroup, floorNum, 'ЛК№2', 9.4, 1.9, true);
            addRoomLabel3D(targetGroup, floorNum, 'Лифтовой\nхолл', 1.8, 1.5, false, true);
        }

        function buildFloor7(targetGroup) {
            buildCommonStructure(targetGroup, 7, false);
            const INNER_T = 0.18;

            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -3.2, to: -2.0, type: 'door' },
                { from: -1.0, to: 0.2, type: 'door' },
                { from: 6.8, to: 9.0, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -2.2, -14.0, -2.2, -8.8, [], INNER_T);
            addWallLine(targetGroup, 1.6, -14.0, 1.6, -8.8, [], INNER_T);

            addWallLine(targetGroup, -2.2, -8.8, 5.4, -8.8, [
                { from: -0.9, to: 0.2, type: 'door' },
                { from: 3.0, to: 4.1, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 1.6, -11.4, 5.4, -11.4, [
                { from: 3.0, to: 4.1, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 5.4, -14.0, 5.4, -6.2, [
                { from: -13.3, to: -12.1, type: 'door' },
                { from: -8.2, to: -7.0, type: 'door' }
            ], INNER_T);

            // Поперечная противопожарная перегородка коридора (север ↔ запад) по плану 7.jpg
            addWallLine(targetGroup, -5.8, -6.2, -5.8, -4.0, [
                { from: -5.6, to: -4.4, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], INNER_T);
            addWallLine(targetGroup, -14.0, 0.5, -5.8, 0.5, [], INNER_T);
            addWallLine(targetGroup, -5.8, -4.0, -5.8, 14.0, [
                { from: -2.2, to: -1.0, type: 'door' },
                { from: 2.2, to: 4.2, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -5.8, 7.2, 12.5, 7.2, [
                { from: -4.6, to: -3.4, type: 'door' },
                { from: -0.6, to: 1.4, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -1.6, 7.2, -1.6, 14.0, [
                { from: 9.6, to: 10.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 8.6, 9.4, 12.5, 9.4, [], INNER_T);
            addWallLine(targetGroup, 8.6, 9.4, 8.6, 14.0, [
                { from: 10.8, to: 12.0, type: 'open' }
            ], INNER_T);

            addRoomLabel3D(targetGroup, 7, '703', -6.2, -10.2);
            addRoomLabel3D(targetGroup, 7, '703А', -0.3, -11.4);
            addRoomLabel3D(targetGroup, 7, '704', 10.6, -10.2);
            addRoomLabel3D(targetGroup, 7, '702А', -9.9, -1.8);
            addRoomLabel3D(targetGroup, 7, '702', -9.9, 7.2);
            addRoomLabel3D(targetGroup, 7, '701А', -3.7, 10.8);
            addRoomLabel3D(targetGroup, 7, '701', 3.5, 10.8);
            flushWalls(targetGroup);
        }

        function buildFloor6(targetGroup) {
            buildCommonStructure(targetGroup, 6, false);
            const INNER_T = 0.18;

            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -1.4, to: 0.6, type: 'door' },
                { from: 2.9, to: 4.1, type: 'door' },
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

            // Поперечная противопожарная перегородка коридора (север ↔ запад) по плану 6.jpg
            addWallLine(targetGroup, -5.8, -6.2, -5.8, -4.0, [
                { from: -5.6, to: -4.4, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], INNER_T);
            addWallLine(targetGroup, -14.0, 0.0, -5.8, 0.0, [
                { from: -9.2, to: -8.0, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, -5.8, -4.0, -5.8, 14.0, [
                { from: -2.2, to: -1.0, type: 'door' },
                { from: 1.8, to: 3.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -5.8, 7.2, 12.5, 7.2, [
                { from: -4.6, to: -3.4, type: 'door' },
                { from: -1.4, to: 0.6, type: 'door' },
                { from: 9.2, to: 10.4, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -2.2, 7.2, -2.2, 14.0, [], INNER_T);
            addWallLine(targetGroup, 8.6, 7.2, 8.6, 14.0, [], INNER_T);

            addRoomLabel3D(targetGroup, 6, '604', -4.2, -10.2);
            addRoomLabel3D(targetGroup, 6, '604А', 3.5, -11.4);
            addRoomLabel3D(targetGroup, 6, '605', 10.6, -10.2);
            addRoomLabel3D(targetGroup, 6, '603А', -9.9, -2.0);
            addRoomLabel3D(targetGroup, 6, '603', -9.9, 7.0);
            addRoomLabel3D(targetGroup, 6, '602А', -4.0, 10.8);
            addRoomLabel3D(targetGroup, 6, '602', 3.2, 10.8);
            addRoomLabel3D(targetGroup, 6, '601', 10.5, 10.8);
            flushWalls(targetGroup);
        }

        function buildFloor5(targetGroup) {
            buildCommonStructure(targetGroup, 5, false);
            const INNER_T = 0.18;

            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -1.4, to: 0.6, type: 'door' },
                { from: 2.9, to: 4.1, type: 'door' },
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

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], INNER_T);
            addWallLine(targetGroup, -14.0, 0.0, -5.8, 0.0, [], INNER_T);
            addWallLine(targetGroup, -5.8, -4.0, -5.8, 14.0, [
                { from: -2.2, to: -1.0, type: 'door' },
                { from: 1.8, to: 3.8, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -5.8, 7.2, 12.5, 7.2, [
                { from: -4.6, to: -3.4, type: 'door' },
                { from: -1.4, to: 0.6, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, -2.2, 7.2, -2.2, 14.0, [], INNER_T);

            addRoomLabel3D(targetGroup, 5, '503', -4.2, -10.2);
            addRoomLabel3D(targetGroup, 5, '503А', 3.5, -11.4);
            addRoomLabel3D(targetGroup, 5, '504', 10.6, -10.2);
            addRoomLabel3D(targetGroup, 5, '502А', -9.9, -2.0);
            addRoomLabel3D(targetGroup, 5, '502', -9.9, 7.0);
            addRoomLabel3D(targetGroup, 5, '501А', -4.0, 10.8);
            addRoomLabel3D(targetGroup, 5, '501', 5.2, 10.8);
            flushWalls(targetGroup);
        }

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
            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], INNER_T);

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

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], INNER_T);
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

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], INNER_T);

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
            addWallLine(targetGroup, -9.5, 7.2, -9.5, 8.2, [], INNER_T);
            addArbitraryWallSegment(targetGroup, -9.5, 8.2, -9.5, 9.2, 0.06, true);
            addWallLine(targetGroup, -9.5, 9.2, -9.5, 9.5, [], INNER_T);
            addArbitraryWallSegment(targetGroup, -11.2, 11.2, -9.5, 9.5, INNER_T, false);

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
        function buildSquareColumn(targetGroup, cx, cz, size = 0.5, thickness = 0.14) {
            addSquareColumn(targetGroup, cx, cz, size, false);
        }

       // Создаёт гладкий треугольный/трапециевидный клин вдоль оси X (для гладкого пандуса и каменных бортиков как на фото)
        // hLeftRatio — высота слева (у площадки), hRightRatio — высота справа (внизу у тротуара)
        function addSlopedWedgeX(targetGroup, x1, x2, z1, z2, hLeftRatio, hRightRatio) {
            const w = Math.abs(x2 - x1);
            const d = Math.abs(z2 - z1);
            const cx = (x1 + x2) / 2;
            const cz = (z1 + z2) / 2;
            const maxRatio = Math.max(hLeftRatio, hRightRatio, 0.01);

            const lH = hLeftRatio / maxRatio;
            const rH = hRightRatio / maxRatio;

            // Профиль клина в плоскости XY (центрирован по X [-w/2..w/2] и по Y [-0.5..0.5])
            const shape = new THREE.Shape();
            shape.moveTo(-w / 2, -0.5);
            shape.lineTo(w / 2, -0.5);
            shape.lineTo(w / 2, -0.5 + rH);
            shape.lineTo(-w / 2, -0.5 + lH);
            shape.closePath();

            const geom = new THREE.ExtrudeGeometry(shape, {
                depth: d,
                bevelEnabled: false
            });
            // Центрируем экструзию по оси Z [-d/2..d/2]
            geom.translate(0, 0, -d / 2);

            registerDynamicStairStep(targetGroup, geom, cx, cz, maxRatio, 0, true);
        }

        function buildFloor1(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // ==========================================
            // 1. ПЛИТЫ ПЕРЕКРЫТИЯ 1 ЭТАЖА (СТРОГО В ТЕПЛОМ КОНТУРЕ)
            // ==========================================
            // Северный блок (102, 106, 105, С/У, 107)
            addFloorRect(targetGroup, -10.0, -14.0, 16.0, -4.0, false);

            // Основной теплый контур 1-го этажа со скошенным юго-западным углом (без уличной плиты под столбами)
            addFloorPolygon(targetGroup, [
                [-12.2, -4.0],
                [8.6, -4.0],
                [8.6, 12.2],
                [-8.6, 12.2],
                [-12.2, 8.6]
            ], false);

            // Правый выступ (переход на востоке)
            addFloorRect(targetGroup, 16.0, -9.5, 20.4, -2.2, false);

            // Центральное ядро (лифты, 103, 104, холл 103, 101, предбанник)
            addFloorRect(targetGroup, -1.2, -4.0, 8.6, 8.6, true);
            // Лестничные клетки ЛК№1 и ЛК№2
            addFloorRect(targetGroup, 8.6, -3.8, 16.0, 3.8, true);

            // Площадка крыльца перед входом и ЛК№2 (строго в габаритах крыльца, без наружного выступа за парапет)
            addFloorRect(targetGroup, 8.6, 3.8, 11.8, 12.2, true);

            // ==========================================
            // 2. 7 ОПОРНЫХ КОЛОНН ПОД НАВИСАЮЩИМИ 2–7 ЭТАЖАМИ (БЕЗ ПОДЛОЖКИ)
            // ==========================================
            const colSize = 0.56;

            [-3.7, 2.1, 7.9, 13.7].forEach(cz => {
                addSquareColumn(targetGroup, -13.7, cz, colSize, true);
            });

            [-6.3, 1.0, 8.4].forEach(cx => {
                addSquareColumn(targetGroup, cx, 13.7, colSize, true);
            });

            // ==========================================
            // 3. ВНЕШНИЙ ПЕРИМЕТР СТЕН 1 ЭТАЖА
            // ==========================================
            addWallLine(targetGroup, -10.0, -14.0, 16.0, -14.0, [], OUTER_T);
            addWallLine(targetGroup, -10.0, -14.0, -10.0, -4.0, [], OUTER_T);
            addWallLine(targetGroup, -12.2, -4.0, -10.0, -4.0, [], OUTER_T);

            // Утопленная стена, скошенный угол и внешняя стена до площадки входа (X = 8.6, Z = 12.2)
            addWallLine(targetGroup, -12.2, -4.0, -12.2, 8.6, [], OUTER_T);
            addArbitraryWallSegment(targetGroup, -12.2, 8.6, -8.6, 12.2, OUTER_T, false, true);
            addWallLine(targetGroup, -8.6, 12.2, 8.6, 12.2, [], OUTER_T);

            // Восточная стена северного крыла и правый тамбур-выступ
            addWallLine(targetGroup, 16.0, -14.0, 16.0, 3.8, [
                { from: -5.8, to: -4.2, type: 'door', isExterior: true }
            ], OUTER_T);
            addWallLine(targetGroup, 16.0, -9.5, 20.4, -9.5, [], OUTER_T);
            addWallLine(targetGroup, 16.0, -2.2, 20.4, -2.2, [], OUTER_T);
            addWallLine(targetGroup, 20.4, -9.5, 20.4, -2.2, [
                { from: -6.6, to: -5.0, type: 'door', isExterior: true }
            ], OUTER_T);

            // ==========================================
            // 4. СЕВЕРНЫЙ БЛОК: 102, 106, 105, С/У и 107 (Z [-14.0..-6.2])
            // ==========================================
            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -4.5, to: -3.2, type: 'door' },
                { from: 4.9, to: 6.9, type: 'door' },
                { from: 12.8, to: 14.2, type: 'door' }
            ], INNER_T);

            addWallLine(targetGroup, 0.8, -14.0, 0.8, -6.2, [], INNER_T);
            addWallLine(targetGroup, 4.6, -14.0, 4.6, -6.2, [
                { from: -10.6, to: -9.4, type: 'door' }
            ], INNER_T);

            buildSquareColumn(targetGroup, 1.8, -7.2, 0.5, 0.14);
            addWallLine(targetGroup, 3.1, -8.5, 4.6, -8.5, [], INNER_T);

            addWallLine(targetGroup, 7.4, -14.0, 7.4, -6.2, [
                { from: -13.6, to: -12.5, type: 'door' },
                { from: -7.7, to: -6.6, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, 11.2, -14.0, 11.2, -6.2, [], INNER_T);
            addWallLine(targetGroup, 7.4, -10.1, 11.2, -10.1, [], INNER_T);

            addWallLine(targetGroup, 8.8, -12.4, 8.8, -7.8, [
                { from: -12.2, to: -11.45, type: 'door' },
                { from: -10.95, to: -10.25, type: 'door' },
                { from: -9.95, to: -9.25, type: 'door' },
                { from: -8.75, to: -8.0, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 7.4, -12.4, 11.2, -12.4, [], 0.12);
            addWallLine(targetGroup, 8.8, -11.25, 11.2, -11.25, [], 0.12);
            addWallLine(targetGroup, 8.8, -8.95, 11.2, -8.95, [], 0.12);
            addWallLine(targetGroup, 7.4, -7.8, 11.2, -7.8, [], 0.12);

            // ==========================================
            // 5. ЦЕНТРАЛЬНОЕ ЯДРО: ЛИФТЫ, 103 (МАЛАЯ), 104 И ХОЛЛ 103
            // ВНЕШНЯЯ СТЕНА ЯДРА ОГОРАЖИВАЕТ ЛИФТЫ С ЗАПАДА И С ЮГА (КАК НА ЭТАЖАХ 2-7)
            // ==========================================
            // Западная внешняя стена ядра вдоль коридора (Z = -4.0, от X = -1.2 до 8.6)
            addWallLine(targetGroup, -1.2, -4.0, 8.6, -4.0, [
                { from: 5.0, to: 6.2, type: 'door' }, // вход в 103 малое
                { from: 7.0, to: 8.2, type: 'door' }  // вход в 104
            ], INNER_T);

            // Южная торцевая стена ядра (X = -1.2, от Z = -4.0 до 4.8)
            addWallLine(targetGroup, -1.2, -4.0, -1.2, 4.8, [
                { from: 1.0, to: 2.8, type: 'door' }  // двустворчатый вход из вестибюля в лифтовой холл 103
            ], INNER_T);

            // Нижний лифт (X [-0.9..1.4], Z [-3.8..-1.0])
            addWallLine(targetGroup, -0.9, -3.8, 1.4, -3.8, [], INNER_T);
            addWallLine(targetGroup, -0.9, -3.8, -0.9, -1.0, [], INNER_T);
            addWallLine(targetGroup, 1.4, -3.8, 1.4, -1.0, [], INNER_T);
            addWallLine(targetGroup, -0.9, -1.0, 1.4, -1.0, [
                { from: -0.2, to: 1.0, type: 'door' }
            ], INNER_T);
            buildElevatorShaftCross(targetGroup, -0.85, -3.7, 1.35, -1.1);

            // Верхний лифт (X [2.0..4.6], Z [-3.8..-1.0])
            addWallLine(targetGroup, 2.0, -3.8, 4.6, -3.8, [], INNER_T);
            addWallLine(targetGroup, 2.0, -3.8, 2.0, -1.0, [], INNER_T);
            addWallLine(targetGroup, 4.6, -3.8, 4.6, -1.0, [], INNER_T);
            addWallLine(targetGroup, 2.0, -1.0, 4.6, -1.0, [
                { from: 2.5, to: 3.7, type: 'door' }
            ], INNER_T);
            buildElevatorShaftCross(targetGroup, 2.05, -3.7, 4.55, -1.1);

            buildSquareColumn(targetGroup, 1.7, -0.8, 0.45, 0.12);

            // Помещения 103 (малое) и 104 над лифтами под ЛК№1 (X [4.6..8.6], Z [-4.0..-1.0])
            addWallLine(targetGroup, 4.6, -1.0, 8.6, -1.0, [], INNER_T);
            addWallLine(targetGroup, 6.6, -4.0, 6.6, -1.0, [], INNER_T);

            // Стена между холлом 103 и помещением консьержа 101 (Z = 4.8, X [-1.2..7.0])
            addWallLine(targetGroup, -1.2, 4.8, 7.0, 4.8, [
                { from: 4.6, to: 6.0, type: 'door' } // дверь между холлом 103 и консьержем 101
            ], INNER_T);

            // ==========================================
            // 6. ЛЕСТНИЧНЫЕ КЛЕТКИ ЛК№1 И ЛК№2 (КАК НА ЭТАЖАХ ВЫШЕ)
            // СТЕНЫ И РАЗМЕРЫ ТЕ ЖЕ, ДВЕРИ ВЕДУТ К ВЫХОДУ И В ПРЕДБАННИК
            // ==========================================
            // Капитальная стена ядра и ЛК (X = 8.6)
            addWallLine(targetGroup, 8.6, -4.0, 8.6, 3.8, [
                { from: 1.0, to: 2.6, type: 'door' } // выход из ЛК№2 в предбанник
            ], INNER_T);

            // Стена ЛК№1 со стороны северного коридора (Z = -3.8)
            addWallLine(targetGroup, 8.6, -3.8, 16.0, -3.8, [
                { from: 8.8, to: 10.2, type: 'door' }
            ], INNER_T);

            // Центральная стена между ЛК№1 и ЛК№2 (Z = 0.0)
            addWallLine(targetGroup, 8.6, 0.0, 16.0, 0.0, [], INNER_T);

            // Стена ЛК№2 со стороны выхода на улицу (Z = 3.8) — внешняя стена, не скрывается в срезе
            addWallLine(targetGroup, 8.6, 3.8, 16.0, 3.8, [
                { from: 8.8, to: 10.2, type: 'door', isExterior: true } // дверь на наружную площадку крыльца к лестнице
            ], OUTER_T);

            buildStaircaseUnit(targetGroup, -3.8, 0.0, -1.9, true);
            buildStaircaseUnit(targetGroup, 0.0, 3.8, 1.9, false);

            // ==========================================
            // 7. ПРЕДБАННИК, ПОМЕЩЕНИЕ КОНСЬЕРЖА (101) И ВХОДНОЙ ТАМБУР
            // ПРОПОРЦИИ И СВЯЗИ СТРОГО ПО ПЛАНУ
            // ==========================================
            // 1) Предбанник перед ЛК№2 и консьержем (X [7.0..8.6], Z [0.0..8.6])
            // Стена между предбанником и площадкой крыльца (X = 8.6, Z [3.8..8.6])
            addWallLine(targetGroup, 8.6, 3.8, 8.6, 8.6, [], OUTER_T);
            // Стена между предбанником и холлом 103 (Z = 4.8, X [7.0..8.6]) с проходом
            addWallLine(targetGroup, 7.0, 4.8, 8.6, 4.8, [
                { from: 7.2, to: 8.4, type: 'door' }
            ], INNER_T);

            // 2) Помещение 101 (место консьержа / охраны, X [3.8..7.0], Z [4.8..8.6])
            // Северная стена 101 с предбанником (X = 7.0, Z [4.8..8.6])
            addWallLine(targetGroup, 7.0, 4.8, 7.0, 8.6, [
                { from: 5.6, to: 6.8, type: 'door' } // дверь в предбанник
            ], INNER_T);
            // Южная стена 101 с главным вестибюлем (X = 3.8, Z [4.8..8.6])
            addWallLine(targetGroup, 3.8, 4.8, 3.8, 8.6, [
                { from: 6.0, to: 7.4, type: 'door' } // дверь/окно консьержа в вестибюль
            ], INNER_T);
            // Восточная стена 101 с входным тамбуром (Z = 8.6, X [3.8..7.0])
            addWallLine(targetGroup, 3.8, 8.6, 7.0, 8.6, [
                { from: 4.8, to: 6.0, type: 'door' } // дверь консьержа в тамбур
            ], INNER_T);

            // 3) Главный входной тамбур (шлюз, X [3.8..8.6], Z [8.6..12.2])
            // Продолжение стены Z = 8.6 вдоль предбанника (X [7.0..8.6])
            addWallLine(targetGroup, 7.0, 8.6, 8.6, 8.6, [], INNER_T);

            // Северный ряд дверей тамбура (вход с наружного крыльца, X = 8.6, Z [8.6..12.2])
            addWallLine(targetGroup, 8.6, 8.6, 8.6, 12.2, [
                { from: 8.9, to: 10.1, type: 'door', isExterior: true },
                { from: 10.7, to: 11.9, type: 'door', isExterior: true }
            ], OUTER_T);

            // Южный ряд дверей тамбура (выход в вестибюль, X = 3.8, Z [8.6..12.2])
            addWallLine(targetGroup, 3.8, 8.6, 3.8, 12.2, [
                { from: 8.9, to: 10.1, type: 'door' },
                { from: 10.7, to: 11.9, type: 'door' }
            ], INNER_T);

            // Центральный простенок-разделитель потоков в тамбуре
            addWallLine(targetGroup, 4.5, 10.4, 7.9, 10.4, [], 0.12);

            // ==========================================
            // 8. КРЫЛЬЦО И НАРУЖНАЯ ЛЕСТНИЦА (СТРОГО В СТВОРЕ ТАМБУРА, НЕ ВО ВСЮ ШИРИНУ)
            // ==========================================
            // Верхняя площадка крыльца перед входом и ЛК№2 (X [8.72..11.8], Z [3.92..12.2])
            const landingH = 0.24;
            const mainLandingGeom = new THREE.BoxGeometry(3.08, 1, 8.28);
            registerDynamicStairStep(targetGroup, mainLandingGeom, 10.26, 8.06, landingH, 0, true);

            // Бортик площадки со стороны ЛК№2 (Z = 3.8, X [10.3..11.8], за пределами дверного проема)
            const leftLandingWallGeom = new THREE.BoxGeometry(1.5, 1, 0.24);
            registerDynamicStairStep(targetGroup, leftLandingWallGeom, 11.05, 3.8, landingH + 0.14, 0, true);

            // Торцевой бортик площадки перед ЛК№2 (X = 11.8, Z [3.8..8.6])
            const frontPlatformWallGeom = new THREE.BoxGeometry(0.24, 1, 4.8);
            registerDynamicStairStep(targetGroup, frontPlatformWallGeom, 11.8, 6.2, landingH + 0.14, 0, true);

            // Наружная лестница: ступени спускаются по оси X от 11.8 до 15.6, строго в створе тамбура Z [8.6..12.2]
            const stepCount = 9;
            const stairXStart = 11.8;
            const stairXEnd = 15.6;
            const stepW = (stairXEnd - stairXStart) / stepCount;
            const stairDepth = 3.3; // ширина лестницы по Z (от Z = 8.7 до Z = 12.0)
            const stairCZ = 10.35;

            for (let i = 0; i < stepCount; i++) {
                const sx = stairXStart + (i + 0.5) * stepW;
                const ratio = ((stepCount - i) / stepCount) * landingH;
                const geom = new THREE.BoxGeometry(stepW * 0.98, 1, stairDepth);
                registerDynamicStairStep(targetGroup, geom, sx, stairCZ, ratio, 0, true);
            }

            // Правый наружный парапет лестницы (идет по наружной линии Z = 12.2, без выступающей плиты справа)
            const rightWallFlatGeom = new THREE.BoxGeometry(3.08, 1, 0.3);
            registerDynamicStairStep(targetGroup, rightWallFlatGeom, 10.26, 12.2, landingH + 0.14, 0, true);
            addSlopedWedgeX(targetGroup, 11.8, 15.6, 12.05, 12.35, landingH + 0.14, 0.08);

            // Левый бортик лестницы (между площадкой ЛК№2 и ступенями, вдоль Z = 8.6 от X = 8.72 до X = 15.6)
            const midStairFlatGeom = new THREE.BoxGeometry(3.08, 1, 0.24);
            registerDynamicStairStep(targetGroup, midStairFlatGeom, 10.26, 8.6, landingH + 0.14, 0, true);
            addSlopedWedgeX(targetGroup, 11.8, 15.6, 8.48, 8.72, landingH + 0.14, 0.08);

            // ==========================================
            // 9. ВНУТРЕННИЕ КОЛОННЫ И ПЕРЕГОРОДКИ ФОЙЕ
            // ==========================================
            buildSquareColumn(targetGroup, -5.8, 1.5, 0.55, INNER_T);
            buildSquareColumn(targetGroup, -5.8, 6.8, 0.55, INNER_T);
            addWallLine(targetGroup, -5.8, 6.8, -5.8, 12.2, [], INNER_T);
            addWallLine(targetGroup, -12.2, 1.5, -9.8, 1.5, [], INNER_T);

            // ==========================================
            // 10. ПОДПИСИ ПОМЕЩЕНИЙ 1 ЭТАЖА
            // ==========================================
            addRoomLabel3D(targetGroup, 1, '102', -4.6, -10.2);
            addRoomLabel3D(targetGroup, 1, '106', 2.7, -10.2);
            addRoomLabel3D(targetGroup, 1, '105', 6.0, -10.2);
            addRoomLabel3D(targetGroup, 1, 'С/У', 9.3, -13.2, true);
            addRoomLabel3D(targetGroup, 1, 'С/У', 9.3, -7.0, true);
            addRoomLabel3D(targetGroup, 1, '107', 13.6, -10.2);
            addRoomLabel3D(targetGroup, 1, '104', 7.6, -2.4, true);
            addRoomLabel3D(targetGroup, 1, '103', 5.6, -2.4, true);
            addRoomLabel3D(targetGroup, 1, '103', 1.8, 1.8);
            addRoomLabel3D(targetGroup, 1, '101', 5.4, 6.7, true);
            addRoomLabel3D(targetGroup, 1, 'ЛК№1', 9.4, -1.9, true);
            addRoomLabel3D(targetGroup, 1, 'ЛК№2', 9.4, 1.9, true);
            flushWalls(targetGroup);
        }


window.buildFloor1 = buildFloor1;
window.buildFloor2 = buildFloor2;
window.buildFloor3 = buildFloor3;
window.buildFloor4 = buildFloor4;
window.buildFloor5 = buildFloor5;
window.buildFloor6 = buildFloor6;
window.buildFloor7 = buildFloor7;
