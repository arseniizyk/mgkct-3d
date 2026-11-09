(function() {
    'use strict';

// ==========================================
// КОРПУС 1 (Этажи 1–7)
// ==========================================
// Примечание: OUTER_T и INNER_T экспортированы глобально из js/state.js

        function buildCommonStructure(targetGroup, floorNum, hasRightExtension = false, topWallOpenings = []) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // 1. Единое монолитное полотно базового контура этажей 2–7 (без внутренних стыков на Z = -4.0!)
            addFloorPolygon(targetGroup, [
                [-10.0, -14.0],
                [16.0, -14.0],
                [16.0, 4.0],
                [12.5, 4.0],
                [12.5, 14.0],
                [-14.0, 14.0],
                [-14.0, -4.0],
                [-10.0, -4.0]
            ], false);

            // Правый выступ (для 1 и 2 этажей: Переход в корпус №2)
            if (hasRightExtension) {
                addFloorRect(targetGroup, 16.0, -9.5, 20.4, -2.2, false);
            }

            // Лестничные клетки ЛК№1 и ЛК№2 (дублирующая вставка в лифтовом холле удалена для исключения стыков)
            addFloorRect(targetGroup, 8.6, -4.0, 16.0, 4.0, true);

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
                // На 2 этаже здесь переход в Корпус 2; на 3 этаже (каб. 305) стена глухая
                if (floorNum !== 2) {
                    addWallLine(targetGroup, 20.4, -9.5, 20.4, -2.2, [], OUTER_T);
                } else {
                    addWallLine(targetGroup, 20.4, -9.5, 20.4, -2.2, [{ from: -6.5, to: -5.1, type: 'open' }], OUTER_T);
                }
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

            // Правый пассажирский лифт (X [2.0..4.8], Z [-3.3..-1.0], восток ограничен стеной санузлов X=4.8)
            addWallLine(targetGroup, 2.0, -3.3, 4.8, -3.3, [], INNER_T);
            addWallLine(targetGroup, 2.0, -3.3, 2.0, -1.0, [], INNER_T);
            addWallLine(targetGroup, 2.0, -1.0, 4.8, -1.0, [
                { from: 2.5, to: 3.7, type: 'door' }
            ], INNER_T);
            buildElevatorShaftCross(targetGroup, 2.05, -3.2, 4.75, -1.1);

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
            // Северная стена ЛК№1 со входом из северного коридора (единая прямая линия со стеной ядра Z = -4.0)
            addWallLine(targetGroup, 8.6, -4.0, 16.0, -4.0, [
                { from: 8.8, to: 10.0, type: 'door' }
            ], INNER_T);

            // Центральная противопожарная разделительная стена между ЛК№1 и ЛК№2
            addWallLine(targetGroup, 8.6, 0.0, 16.0, 0.0, [], INNER_T);

            // Южная стена ЛК№2 со входом из южного коридора (единая линия со стеной ядра Z = 4.0 до поворота фасада X = 12.5)
            addWallLine(targetGroup, 8.6, 4.0, 12.5, 4.0, [
                { from: 8.8, to: 10.0, type: 'door' }
            ], INNER_T);

            // Лестничные марши с входными и межэтажными площадками
            buildStaircaseUnit(targetGroup, -4.0, 0.0, -2.0, true);
            buildStaircaseUnit(targetGroup, 0.0, 4.0, 2.0, false);

            // Общие плашки ядра и лестниц
            addRoomLabel3D(targetGroup, floorNum, 'WC (М)', 6.2, -2.8, true);
            addRoomLabel3D(targetGroup, floorNum, 'WC (Ж)', 5.6, 1.3, true);
            addRoomLabel3D(targetGroup, floorNum, 'ЛК№1', 9.8, -2.0, true, false, 1, 0.85);
            addRoomLabel3D(targetGroup, floorNum, 'ЛК№2', 9.8, 2.0, true, false, 1, 0.85);
            addRoomLabel3D(targetGroup, floorNum, 'Лифтовой\nхолл', 1.8, 1.5, false, true);
        }


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

    window.buildCommonStructure = buildCommonStructure;
    window.buildSquareColumn = buildSquareColumn;
    window.addSlopedWedgeX = addSlopedWedgeX;
})();
