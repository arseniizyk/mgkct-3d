(function() {
    'use strict';

        function buildFloor1(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // ==========================================
            // 1. ПЛИТЫ ПЕРЕКРЫТИЯ 1 ЭТАЖА (СТРОГО В ТЕПЛОМ КОНТУРЕ)
            // ==========================================
            // Единое бесшовное монолитное полотно 1-го этажа Корпуса 1 (без внутренних стыков на Z = -4.0 и Z = 8.6!)
            addFloorPolygon(targetGroup, [
                [-10.0, -14.0],
                [16.0, -14.0],
                [16.0, 4.0],
                [8.6, 4.0],
                [8.6, 12.2],
                [-8.6, 12.2],
                [-12.2, 8.6],
                [-12.2, -4.0],
                [-10.0, -4.0]
            ], false);

            // Правый выступ (переход на востоке)
            addFloorRect(targetGroup, 16.0, -9.5, 20.4, -2.2, false);

            // Лестничные клетки ЛК№1 и ЛК№2
            addFloorRect(targetGroup, 8.6, -4.0, 16.0, 4.0, true);

            // Площадка крыльца перед входом и ЛК№2
            addFloorRect(targetGroup, 8.6, 4.0, 11.8, 12.2, true);

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

            // Утопленная стена, скошенный угол (идеальный бесшовный усредненный стык Miter) и внешняя стена до площадки входа
            addWallLine(targetGroup, -12.2, -4.0, -12.2, 8.6, [], OUTER_T);
            addMiteredChamferWall(targetGroup, -12.2, 8.6, -8.6, 12.2, OUTER_T, true, false);
            addWallLine(targetGroup, -8.6, 12.2, 8.6, 12.2, [], OUTER_T);

            // Восточная стена северного крыла и правый тамбур-выступ
            addWallLine(targetGroup, 16.0, -14.0, 16.0, 4.0, [
                { from: -5.8, to: -4.2, type: 'door', isExterior: true }
            ], OUTER_T);
            addWallLine(targetGroup, 16.0, -9.5, 20.4, -9.5, [], OUTER_T);
            addWallLine(targetGroup, 16.0, -2.2, 20.4, -2.2, [], OUTER_T);
            addWallLine(targetGroup, 20.4, -9.5, 20.4, -2.2, [
                { from: -6.5, to: -5.1, type: 'door', isExterior: true }
            ], OUTER_T);

            // ==========================================
            // 4. СЕВЕРНЫЙ БЛОК: 102, 106, 105, С/У и 107 (Z [-14.0..-6.2])
            // ==========================================
            addWallLine(targetGroup, -10.0, -6.2, 16.0, -6.2, [
                { from: -4.5, to: -3.2, type: 'door' },
                { from: -1.4, to: -0.2, type: 'door' },
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

            addWallLine(targetGroup, 8.8, -12.4, 8.8, -10.1, [
                { from: -12.2, to: -11.45, type: 'door' },
                { from: -10.95, to: -10.10, type: 'door' }
            ], 0.12);
            addWallLine(targetGroup, 8.8, -10.1, 8.8, -7.8, [
                { from: -10.10, to: -9.25, type: 'door' },
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
                { from: 1.8, to: 3.4, type: 'door' } // двустворчатая дверь между холлом 103 и консьержем 101
            ], INNER_T);

            // ==========================================
            // 6. ЛЕСТНИЧНЫЕ КЛЕТКИ ЛК№1 И ЛК№2 (КАК НА ЭТАЖАХ ВЫШЕ)
            // СТЕНЫ И РАЗМЕРЫ ТЕ ЖЕ, ДВЕРИ ВЕДУТ К ВЫХОДУ И В ПРЕДБАННИК
            // ==========================================
            // Капитальная стена ядра и ЛК (X = 8.6)
            addWallLine(targetGroup, 8.6, -4.0, 8.6, 4.0, [
                { from: 1.0, to: 2.6, type: 'door' } // выход из ЛК№2 в предбанник
            ], INNER_T);

            // Стена ЛК№1 со стороны северного коридора (единая прямая линия со стеной ядра Z = -4.0)
            addWallLine(targetGroup, 8.6, -4.0, 16.0, -4.0, [
                { from: 8.8, to: 10.2, type: 'door' }
            ], INNER_T);

            // Центральная стена между ЛК№1 и ЛК№2 (Z = 0.0)
            addWallLine(targetGroup, 8.6, 0.0, 16.0, 0.0, [], INNER_T);

            // Стена ЛК№2 со стороны выхода на улицу (Z = 4.0) — внешняя стена, не скрывается в срезе
            addWallLine(targetGroup, 8.6, 4.0, 16.0, 4.0, [
                { from: 8.8, to: 10.2, type: 'door', isExterior: true } // дверь на наружную площадку крыльца к лестнице
            ], OUTER_T);

            buildStaircaseUnit(targetGroup, -4.0, 0.0, -2.0, true);
            buildStaircaseUnit(targetGroup, 0.0, 4.0, 2.0, false);

            // ==========================================
            // 7. ПРЕДБАННИК, ПОМЕЩЕНИЕ КОНСЬЕРЖА (101) И ВХОДНОЙ ТАМБУР
            // ПРОПОРЦИИ И СВЯЗИ СТРОГО ПО ПЛАНУ
            // ==========================================
            // 1) Предбанник перед ЛК№2 и консьержем (X [7.0..8.6], Z [0.0..8.6])
            // Стена между предбанником и площадкой крыльца (X = 8.6, Z [4.0..8.6])
            addWallLine(targetGroup, 8.6, 4.0, 8.6, 8.6, [], OUTER_T);
            // Стена между предбанником и холлом 103 (Z = 4.8, X [7.0..8.6]) с проходом
            addWallLine(targetGroup, 7.0, 4.8, 8.6, 4.8, [
                { from: 7.2, to: 8.4, type: 'door' }
            ], INNER_T);

            // 2) Помещение 101 (место консьержа / охраны, X [0.5..7.0], Z [4.8..8.6])
            // Восточная стена 101 с предбанником (X = 7.0, Z [4.8..8.6])
            addWallLine(targetGroup, 7.0, 4.8, 7.0, 8.6, [
                { from: 5.6, to: 6.8, type: 'door' } // дверь в предбанник
            ], INNER_T);
            // Западная стена 101 с главным вестибюлем (X = 0.5, Z [4.8..8.6])
            addWallLine(targetGroup, 0.5, 4.8, 0.5, 8.6, [], INNER_T);
            // Южная стена 101 с главным вестибюлем и входным тамбуром (Z = 8.6, X [0.5..7.0])
            addWallLine(targetGroup, 0.5, 8.6, 7.0, 8.6, [
                { from: 1.8, to: 3.4, type: 'door' }, // окно/дверь консьержа в вестибюль
                { from: 4.8, to: 6.0, type: 'door' }  // дверь консьержа в тамбур
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
            // Верхняя площадка крыльца перед входом и ЛК№2 (X [8.72..11.8], Z [4.0..12.2])
            const landingH = 0.24;
            const mainLandingGeom = new THREE.BoxGeometry(3.08, 1, 8.2);
            registerDynamicStairStep(targetGroup, mainLandingGeom, 10.26, 8.1, landingH, 0, true);

            // Бортик площадки со стороны ЛК№2 (Z = 4.0, X [10.3..11.8], за пределами дверного проема)
            const leftLandingWallGeom = new THREE.BoxGeometry(1.5, 1, 0.24);
            registerDynamicStairStep(targetGroup, leftLandingWallGeom, 11.05, 4.0, landingH + 0.14, 0, true);

            // Торцевой бортик площадки перед ЛК№2 (X = 11.8, Z [4.0..8.6])
            const frontPlatformWallGeom = new THREE.BoxGeometry(0.24, 1, 4.48);
            registerDynamicStairStep(targetGroup, frontPlatformWallGeom, 11.8, 6.24, landingH + 0.14, 0, true);

            // Наружная лестница: ступени спускаются по оси X от 11.8 до 15.6, строго в створе тамбура Z [8.6..12.2]
            // Плита основания под ступенями (устраняет просвет земли под лестницей)
            addFloorRect(targetGroup, 11.8, 8.6, 15.6, 12.2, true);

            const stepCount = 9;
            const stairXStart = 11.8;
            const stairXEnd = 15.6;
            const stepW = (stairXEnd - stairXStart) / stepCount;
            const stairDepth = 3.23; // Пролет ступеней между парапетами Z: 8.72..11.95 (глубина 3.23, центр 10.335)
            const stairCZ = 10.335;

            for (let i = 0; i < stepCount; i++) {
                const sx = stairXStart + (i + 0.5) * stepW;
                const ratio = ((stepCount - i) / stepCount) * landingH;
                const geom = new THREE.BoxGeometry(stepW * 0.98, 1, stairDepth);
                registerDynamicStairStep(targetGroup, geom, sx, stairCZ, ratio, 0, true);
            }

            // Правый наружный парапет лестницы (идет по наружной линии Z = 12.2, без выступающей плиты справа)
            const rightWallFlatGeom = new THREE.BoxGeometry(3.08, 1, 0.25);
            registerDynamicStairStep(targetGroup, rightWallFlatGeom, 10.26, 12.075, landingH + 0.14, 0, true);
            addSlopedWedgeX(targetGroup, 11.8, 15.6, 11.95, 12.20, landingH + 0.14, 0.08);

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
            addRoomLabel3D(targetGroup, 1, '102\nГардероб', -4.6, -10.2, false, true, 1, 1.05);
            addRoomLabel3D(targetGroup, 1, '106', 2.7, -10.2);
            addRoomLabel3D(targetGroup, 1, '105', 6.0, -10.2);
            addRoomLabel3D(targetGroup, 1, 'WC (М)', 9.3, -13.2, true);
            addRoomLabel3D(targetGroup, 1, 'WC (Ж)', 9.3, -7.0, true);
            addRoomLabel3D(targetGroup, 1, '107', 13.6, -10.2);
            addRoomLabel3D(targetGroup, 1, '104', 7.6, -2.4, true, false, 1, 0.90);
            addRoomLabel3D(targetGroup, 1, '103', 5.6, -2.4, true);
            addRoomLabel3D(targetGroup, 1, '103\nХолл', 1.8, 1.8, false, false, 1, 0.95);
            addRoomLabel3D(targetGroup, 1, '101', 3.7, 6.7, true);
            addRoomLabel3D(targetGroup, 1, 'ЛК№1', 9.8, -2.0, true, false, 1, 0.85);
            addRoomLabel3D(targetGroup, 1, 'ЛК№2', 9.8, 2.0, true, false, 1, 0.85);
            flushWalls(targetGroup);
        }

    window.buildFloor1 = buildFloor1;
})();
