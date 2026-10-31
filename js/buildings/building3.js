// ==========================================
// КОРПУС 3 (Этажи 1–2) — ИСПРАВЛЕННАЯ ВНУТРЕННЯЯ ПЛАНИРОВКА ПО ПЛАНАМ БТИ
// Внешний периметр X [-1.6..14.0], Z [-61.6..-14.0] и точки стыка переходов сохранены 1-в-1!
// ==========================================

        // Двухмаршевая (или одномаршевая для ЛК №2 на 1 эт.) лестница для Корпуса 3 на западной стороне (X от -1.6 до 4.6)
        function buildB3Staircase(targetGroup, xWest, xEast, zNorth, zSouth, singleFlight = false) {
            addFloorRect(targetGroup, xWest, zNorth, xEast, zSouth, true);
            const zMid = (zNorth + zSouth) / 2;
            const xStart = xWest + 0.95;
            const xEnd = xEast - 0.95;

            if (!singleFlight) {
                addWallLine(targetGroup, xStart, zMid, xEnd, zMid, [], 0.08);
            } else {
                addWallLine(targetGroup, xStart, zMid, xEnd, zMid, [], 0.08);
                addWallLine(targetGroup, xStart, zNorth + 0.1, xStart, zMid, [], 0.08);
            }

            const steps = 9;
            const stepW = (xEnd - xStart) / steps;
            const dFlight = (zSouth - zNorth) / 2 - 0.16;

            for (let m = 0; m < (singleFlight ? 1 : 2); m++) {
                const cz = m === 0 ? (zNorth + zMid) / 2 : (zMid + zSouth) / 2;
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

        // Открытое уличное крыльцо для 1-го этажа Корпуса 3 на восточном фасаде (площадка + открытые ступени на восток во двор)
        function buildB3ExteriorPorchEast(targetGroup, zNorth, zSouth, xWall, xOuter) {
            const porchW = Math.abs(xOuter - xWall);
            const steps = 5;
            const xLandingEast = xWall + porchW * 0.45;
            addFloorRect(targetGroup, xWall, zNorth, xLandingEast, zSouth, true);
            const stepSpanX = Math.abs(xOuter - xLandingEast);
            const sDepth = stepSpanX / steps;
            const cz = (zNorth + zSouth) / 2;
            const dz = Math.abs(zSouth - zNorth);
            for (let i = 0; i < steps; i++) {
                const sx = xLandingEast + (i + 0.5) * sDepth;
                const heightRatio = 0.03 + ((steps - i) / steps) * 0.12;
                const geom = new THREE.BoxGeometry(sDepth * 0.94, 1, dz);
                registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, -0.14, true);
            }
        }

        // Открытое уличное крыльцо для 1-го этажа Корпуса 3 на западном фасаде (площадка + открытые ступени БЕЗ боковых стен)
        function buildB3ExteriorPorchWest(targetGroup, zNorth, zSouth, xOuter, xWall, stepsDir = 'west') {
            const porchW = Math.abs(xWall - xOuter);
            const steps = 5;

            if (stepsDir === 'west') {
                // Площадка у стены и широкие ступени на запад (крыльцо у 108/109)
                const xLandingWest = xWall - porchW * 0.45;
                addFloorRect(targetGroup, xLandingWest, zNorth, xWall, zSouth, true);
                const stepSpanX = Math.abs(xLandingWest - xOuter);
                const sDepth = stepSpanX / steps;
                const cz = (zNorth + zSouth) / 2;
                const dz = Math.abs(zSouth - zNorth);
                for (let i = 0; i < steps; i++) {
                    const sx = xLandingWest - (i + 0.5) * sDepth;
                    const heightRatio = 0.03 + ((steps - i) / steps) * 0.12;
                    const geom = new THREE.BoxGeometry(sDepth * 0.94, 1, dz);
                    registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, -0.14, true);
                }
            } else if (stepsDir === 'south') {
                // Площадка у выхода из ЛК №1 и ступени с южной стороны
                addFloorRect(targetGroup, xOuter, zNorth, xWall, zSouth, true);
                const stepSpanZ = 1.25;
                const sDepth = stepSpanZ / steps;
                const cx = (xWall + xOuter) / 2;
                for (let i = 0; i < steps; i++) {
                    const sz = zSouth + (i + 0.5) * sDepth;
                    const heightRatio = 0.03 + ((steps - i) / steps) * 0.12;
                    const geom = new THREE.BoxGeometry(porchW, 1, sDepth * 0.94);
                    registerDynamicStairStep(targetGroup, geom, cx, sz, heightRatio, -0.14, true);
                }
            }
        }

        /**
         * КОРПУС 3 — ЭТАЖ 1 (Габариты: X [-1.6..14.0], Z [-61.6..-14.0])
         * Исправлено строго по плану 1-го этажа:
         * 1) Зал 116 — Г-образный, огибает квадратный северный тамбур коридора (X [4.6..7.2], Z [-54.2..-51.8]) до стены 117 (X = 4.6).
         * 2) Между 114 и 114А — прямая стена Z = -52.2 с дверью у коридора.
         * 3) В 112 (Z [-46.8..-44.2]) — поперечная перегородка посередине (Z = -45.5), отделяющая 112 от выходного тамбура на восток.
         * 4) Кабинет 109 выступает в коридор до X = 5.2, образуя характерный зубец на плане; вход в 108 — из западного тамбура крыльца, в 107 — из бокового коридора.
         * 5) Между 105 и 102 — проход к восточному выходу с тамбуром у внешней стены, входом в 102 сбоку и дверями из коридора.
         */
        function buildBuilding3Floor1(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // Основная плита перекрытия 1-го этажа Корпуса 3
            addFloorRect(targetGroup, B3_X_WEST, B3_Z_NORTH, B3_X_EAST, B3_Z_SOUTH, false);

            // Открытые внешние площадки и крыльца на 1-м этаже:
            // 1) Восточное крыльцо со ступенями во двор у выхода между 105 и 102 (X [14.0..16.0], Z [-30.4..-26.8])
            buildB3ExteriorPorchEast(targetGroup, -30.4, -26.8, B3_X_EAST, 16.0);
            // 2) Восточное крыльцо со ступенями во двор у выхода из 112 (X [14.0..16.0], Z [-46.8..-44.2]) по БТИ
            buildB3ExteriorPorchEast(targetGroup, -46.8, -44.2, B3_X_EAST, 16.0);
            // 3) Западное крыльцо со ступенями на юг у ЛК №1 (X [-3.4..-1.6], Z [-47.8..-45.0])
            buildB3ExteriorPorchWest(targetGroup, B3_SHAFT_NORTH_Z1, -45.0, -3.4, B3_X_WEST, 'south');
            // 4) Западное широкое крыльцо со ступенями на запад у тамбура 108/109 (X [-3.8..-1.6], Z [-39.6..-35.0])
            buildB3ExteriorPorchWest(targetGroup, -39.6, -35.0, -3.8, B3_X_WEST, 'west');

            // --- ВНЕШНИЙ ПЕРИМЕТР СТЕН КОРПУСА 3 (ЭТАЖ 1) ---
            // Южная стена к Корпусу 1 (Z = -14.0): глухая стена между 3-103 и 1-105 (исключение: на плане дверь, в реальности глухая стена)
            addWallLine(targetGroup, B3_X_WEST, B3_Z_SOUTH, B3_X_EAST, B3_Z_SOUTH, [], OUTER_T);
            addWallLine(targetGroup, B3_X_WEST, B3_Z_NORTH, B3_X_EAST, B3_Z_NORTH, [], OUTER_T);

            // Западная внешняя стена X = -1.6 (два двустворчатых выхода на крыльца)
            addWallLine(targetGroup, B3_X_WEST, B3_Z_NORTH, B3_X_WEST, B3_Z_SOUTH, [
                { from: -47.0, to: -45.2, type: 'door' }, // Двустворчатый выход из ЛК №1 на крыльцо
                { from: -37.7, to: -36.5, type: 'door' }  // Двустворчатый выход из помещения под 108 на крыльцо
            ], OUTER_T);

            // Восточная внешняя стена X = 14.0 (выход во двор между 105 и 102, и наружный выход из 112 на крыльцо по БТИ)
            addWallLine(targetGroup, B3_X_EAST, B3_Z_NORTH, B3_X_EAST, B3_Z_SOUTH, [
                { from: -46.2, to: -44.8, type: 'door' }, // Наружный эвакуационный выход из 112 по плану БТИ
                { from: -29.5, to: -27.7, type: 'door' }  // Двустворчатый выход из тамбура между 105 и 102
            ], OUTER_T);

            // --- 1. СЕВЕРНЫЙ ТОРЦЕВОЙ УЗЕЛ: ЗАЛЫ 117, 116 (Г-ОБРАЗНЫЙ) И ТАМБУР КОРИДОРА ---
            // По эталонному плану БТИ: зал 117 занимает X [-1.6..4.6], Z [-61.6..-55.0].
            // Зал 116 занимает X [4.6..14.0] от Z = -61.6 до -57.4 и X [7.2..14.0] от Z = -57.4 до -55.0 (огибая тамбур коридора X [4.6..7.2], Z [-57.4..-55.0]).
            addWallLine(targetGroup, B3_X_CORR_W, B3_Z_NORTH, B3_X_CORR_W, -57.4, [], INNER_T); // Стена между 117 и 116 (X = 4.6, Z [-61.6..-57.4])
            addWallLine(targetGroup, B3_X_WEST, -55.0, B3_X_CORR_W, -55.0, [], INNER_T);         // Стена между 117 и 114А (Z = -55.0, X [-1.6..4.6])

            // Квадратный тамбур в северном торце коридора (X [4.6..7.2], Z [-57.4..-55.0]):
            addWallLine(targetGroup, B3_X_CORR_W, -57.4, B3_X_CORR_W, -55.0, [
                { from: -56.8, to: -55.6, type: 'door' } // Дверь из тамбура налево в 117
            ], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_W, -57.4, B3_X_CORR_E, -57.4, [
                { from: 5.3, to: 6.5, type: 'door' }     // Северная дверь из тамбура прямо в 116
            ], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -57.4, B3_X_CORR_E, -55.0, [], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_W, -55.0, B3_X_CORR_E, -55.0, [
                { from: 5.1, to: 6.7, type: 'door' }     // Двустворчатая дверь из главного коридора в тамбур
            ], INNER_T);

            // --- 2. ЗАПАДНЫЙ РЯД ПОМЕЩЕНИЙ (X от -1.6 до 4.6): 114А, 114, ЛК №1, 3 С/У, 109/108, 107, 106, ЛК №2 ---
            // Западная стена главного коридора X = 4.6:
            // Сегмент 1: от тамбура (Z = -55.0) до выступа комнаты 109 (Z = -39.6)
            addWallLine(targetGroup, B3_X_CORR_W, -55.0, B3_X_CORR_W, -39.6, [
                { from: -54.4, to: -53.2, type: 'door' }, // Дверь из коридора в 114А
                { from: -51.4, to: -49.8, type: 'door' }, // Двустворчатая дверь в 114
                { from: -46.9, to: -45.1, type: 'door' }, // Двустворчатая дверь в ЛК №1
                { from: -43.9, to: -42.9, type: 'door' }, // Дверь в правый (северный) С/У
                { from: -42.4, to: -41.4, type: 'door' }, // Дверь в средний малый С/У
                { from: -40.9, to: -39.9, type: 'door' }  // Дверь в левый (южный) С/У
            ], INNER_T);

            // Прямая перегородка между 114А (Z [-55.0..-52.7]) и 114 (Z [-52.7..-47.8]) с дверью у коридора
            addWallLine(targetGroup, B3_X_WEST, -52.7, B3_X_CORR_W, -52.7, [
                { from: 2.7, to: 3.9, type: 'door' } // Дверь из 114А в 114
            ], INNER_T);

            // Северная шахта лестницы: ЛК №1 (X [-1.6..4.6], Z [-47.8..-44.2]) — двухмаршевая
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_NORTH_Z1, B3_X_CORR_W, B3_SHAFT_NORTH_Z1, [], INNER_T); // Z = -47.8
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_NORTH_Z2, B3_X_CORR_W, B3_SHAFT_NORTH_Z2, [], INNER_T); // Z = -44.2
            buildB3Staircase(targetGroup, B3_X_WEST + 0.1, B3_X_CORR_W - 0.1, B3_SHAFT_NORTH_Z1 + 0.1, B3_SHAFT_NORTH_Z2 - 0.1, false);

            // Блок из 3-х Санузлов С/У (Z [-44.2..-39.6], X [-1.6..4.6]):
            // Малый центральный С/У у коридора (X [2.0..4.6], Z [-42.8..-41.0]) и два больших С/У, смыкающихся по Z = -41.9 за ним
            addFloorRect(targetGroup, B3_X_WEST, B3_SHAFT_NORTH_Z2, B3_X_CORR_W, -39.6, true);
            addWallLine(targetGroup, 2.0, -42.8, B3_X_CORR_W, -42.8, [], 0.14);
            addWallLine(targetGroup, 2.0, -41.0, B3_X_CORR_W, -41.0, [], 0.14);
            addWallLine(targetGroup, 2.0, -42.8, 2.0, -41.0, [], 0.14);
            addWallLine(targetGroup, B3_X_WEST, -41.9, 2.0, -41.9, [], 0.14);
            addWallLine(targetGroup, B3_X_WEST, -39.6, 5.2, -39.6, [
                { from: 3.6, to: 4.5, type: 'door' } // Дверь в 109 с северного уступа (до стены коридора X = 4.6), как на плане!
            ], INNER_T);

            // Узел 109, 108 и входного тамбура к западному крыльцу (Z [-39.6..-35.0]):
            // На плане комната 109 (X [0.8..5.2], Z [-39.6..-36.4]) выступает в главный коридор до X = 5.2!
            addWallLine(targetGroup, 5.2, -39.6, 5.2, -36.4, [], INNER_T);       // Выступающая в коридор стена 109 (X = 5.2)
            addWallLine(targetGroup, 0.8, -36.4, 5.2, -36.4, [], INNER_T);       // Южная стена 109 вдоль бокового прохода (Z = -36.4)
            addWallLine(targetGroup, 0.8, -39.6, 0.8, -36.4, [], INNER_T);       // Западная стена 109 до угла бокового прохода
            addWallLine(targetGroup, B3_X_WEST, -37.8, 0.8, -37.8, [
                { from: -0.9, to: 0.3, type: 'door' }                            // Дверь из комнаты под 108 в комнату 108
            ], INNER_T);
            // Перемычка под кабинетом 108 (Z = -36.4) с дверью в боковой проход у угла 109
            addWallLine(targetGroup, B3_X_WEST, -36.4, 0.8, -36.4, [
                { from: 0.0, to: 0.75, type: 'door' }
            ], INNER_T);

            // Сегмент 2 западной стены коридора: от бокового прохода (Z = -35.0) до зала 103 (Z = -26.8)
            addWallLine(targetGroup, B3_X_CORR_W, -35.0, B3_X_CORR_W, B3_SHAFT_SOUTH_Z2, [
                { from: -31.9, to: -30.7, type: 'door' }, // Дверь из коридора в 106
                { from: -29.5, to: -27.7, type: 'door' }  // Двустворчатая дверь в ЛК №2
            ], INNER_T);

            // Кабинет 107 (Z [-35.0..-32.6], вход из бокового прохода на Z = -35.0) и Кабинет 106 (Z [-32.6..-30.4])
            addWallLine(targetGroup, B3_X_WEST, -35.0, B3_X_CORR_W, -35.0, [
                { from: 1.5, to: 2.7, type: 'door' } // Дверь в 107 из бокового прохода (напротив 109)
            ], INNER_T);
            addWallLine(targetGroup, B3_X_WEST, -32.6, B3_X_CORR_W, -32.6, [], INNER_T);

            // Южная шахта лестницы: ЛК №2 (X [-1.6..4.6], Z [-30.4..-26.8]) — на 1-м этаже одномаршевый подъём
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_SOUTH_Z1, B3_X_CORR_W, B3_SHAFT_SOUTH_Z1, [], INNER_T);
            buildB3Staircase(targetGroup, B3_X_WEST + 0.1, B3_X_CORR_W - 0.1, B3_SHAFT_SOUTH_Z1 + 0.1, B3_SHAFT_SOUTH_Z2 - 0.1, true);

            // --- 3. ВОСТОЧНЫЙ РЯД ПОМЕЩЕНИЙ (X от 7.2 до 14.0): 116, 113, 113А, 112, 111А, 111, 105, выход во двор, 102, 104 ---
            // Восточная стена главного коридора X = 7.2 (от тамбура Z = -55.0 до Z = -26.8)
            addWallLine(targetGroup, B3_X_CORR_E, -55.0, B3_X_CORR_E, B3_SHAFT_SOUTH_Z2, [
                { from: -52.2, to: -50.6, type: 'door' }, // Двустворчатая дверь в 113
                { from: -48.1, to: -47.0, type: 'door' }, // Дверь в 113А
                { from: -46.3, to: -44.7, type: 'door' }, // Двустворчатая дверь в 112
                { from: -43.7, to: -42.3, type: 'door' }, // Двустворчатая дверь в 111А
                { from: -41.4, to: -40.0, type: 'door' }, // Дверь в зал 111 (у стены с 111А по чертежу)
                { from: -32.6, to: -31.4, type: 'door' }, // Дверь в 105 (у стены с 111 по чертежу)
                { from: -29.8, to: -28.4, type: 'door' }  // Дверь из коридора в восточный проход (между 105 и 102)
            ], INNER_T);

            // Зал 113 (Z [-55.0..-48.4]) и узкий кабинет 113А (Z [-48.4..-46.8]) с дверью между ними у коридора
            addWallLine(targetGroup, B3_X_CORR_E, -55.0, B3_X_EAST, -55.0, [], INNER_T); // Стена между 116 и 113
            addWallLine(targetGroup, B3_X_CORR_E, -48.4, B3_X_EAST, -48.4, [
                { from: 7.8, to: 9.0, type: 'door' } // Внутренняя дверь между 113 и 113А
            ], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -46.8, B3_X_EAST, -46.8, [], INNER_T); // Северная стена 112 (-46.8)

            // Помещение 112 (Z [-46.8..-44.2], X [7.2..14.0])
            addWallLine(targetGroup, B3_X_CORR_E, -44.2, B3_X_EAST, -44.2, [], INNER_T); // Южная стена 112 (-44.2)
            // Поперечная перегородка по плану БТИ: отделяет каб. 112 от выходного тамбура к крыльцу
            addWallLine(targetGroup, 10.6, -46.8, 10.6, -44.2, [
                { from: -46.0, to: -45.0, type: 'door' }
            ], INNER_T);

            // Смежный кабинет 111А (Z [-44.2..-42.0]) и большой зал 111 (Z [-42.0..-32.8])
            addWallLine(targetGroup, B3_X_CORR_E, -42.0, B3_X_EAST, -42.0, [
                { from: 9.8, to: 11.0, type: 'door' } // Внутренняя дверь между 111А и 111
            ], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -32.8, B3_X_EAST, -32.8, [], INNER_T);

            // Кабинет 105 (Z [-32.8..-30.4])
            addWallLine(targetGroup, B3_X_CORR_E, -30.4, B3_X_EAST, -30.4, [], INNER_T);

            // Проход к восточному выходу между 105 и 102 (Z [-30.4..-26.8], X [7.2..14.0]):
            // Внешний тамбур у двери во двор (X = 11.6, Z [-30.4..-26.8]) с двустворчатой дверью
            addWallLine(targetGroup, 11.6, -30.4, 11.6, -26.8, [
                { from: -29.5, to: -27.7, type: 'door' }
            ], INNER_T);
            // Стена между проходом и каб. 102 (Z = -26.8, X [7.2..14.0]) с дверью в 102
            addWallLine(targetGroup, B3_X_CORR_E, -26.8, B3_X_EAST, -26.8, [
                { from: 8.6, to: 9.8, type: 'door' } // Вход в 102 из прохода
            ], INNER_T);

            // --- 4. ЮЖНЫЙ Г-ОБРАЗНЫЙ ЗАЛ 103 И ВДАЮЩИЕСЯ В НЕГО КАБИНЕТЫ 102, 104 ---
            // Отсекающая стена между главным коридором и залом 103 (Z = -26.8, X [-1.6..7.2])
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_SOUTH_Z2, B3_X_CORR_E, B3_SHAFT_SOUTH_Z2, [
                { from: 5.2, to: 6.8, type: 'door' } // Двустворчатая дверь из коридора/прохода в зал 103
            ], INNER_T);

            // Кабинеты 102 (Z [-26.8..-24.4]) и 104 (Z [-24.4..-22.0]) в блоке X [7.2..14.0]:
            // На плане их торцевая стена X = 7.2 имеет две двустворчатые двери (из 102 и из 104 в зал 103)!
            addWallLine(targetGroup, B3_X_CORR_E, -26.8, B3_X_CORR_E, -22.0, [
                { from: -26.3, to: -24.9, type: 'door' }, // Двустворчатая дверь из 102 в зал 103
                { from: -23.9, to: -22.5, type: 'door' }  // Двустворчатая дверь из 104 в зал 103
            ], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -24.4, B3_X_EAST, -24.4, [], INNER_T); // Глухая стена между 102 и 104
            addWallLine(targetGroup, B3_X_CORR_E, -22.0, B3_X_EAST, -22.0, [], INNER_T); // Южная стена 104 (дальше до Z = -14.0 идёт зал 103)

            // Маленькая комната у южной стены зала 103 (X [4.6..8.6], Z [-17.5..-14.0])
            addWallLine(targetGroup, 4.6, -17.5, 8.6, -17.5, [
                { from: 5.6, to: 7.6, type: 'door' } // Двустворчатая дверь из зала 103
            ], INNER_T);
            addWallLine(targetGroup, 4.6, -17.5, 4.6, -14.0, [], INNER_T); // Западная перегородка
            addWallLine(targetGroup, 8.6, -17.5, 8.6, -14.0, [], INNER_T); // Восточная перегородка

            // 3D-плашки помещений 1-го этажа Корпуса 3 (buildingId = 3)
            addRoomLabel(targetGroup, 1, '103', 3.2, -20.5, false, false, 3, 1.05);
            addRoomLabel(targetGroup, 1, '104', 10.6, -23.2, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 1, '102', 10.6, -25.6, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 1, '105', 10.6, -31.6, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 1, '111', 10.6, -37.4, false, false, 3, 1.05);
            addRoomLabel(targetGroup, 1, '111А', 10.6, -43.1, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 1, '112', 8.9, -45.5, true, false, 3, 0.85);
            addRoomLabel(targetGroup, 1, '113А', 10.6, -47.6, true, false, 3, 0.88);
            addRoomLabel(targetGroup, 1, '113', 10.6, -51.7, false, false, 3, 1.0);
            addRoomLabel(targetGroup, 1, '116', 10.6, -58.3, false, false, 3, 1.05);

            addRoomLabel(targetGroup, 1, 'ЛК№2', 4.1, -28.6, true, false, 3, 0.88);
            addRoomLabel(targetGroup, 1, '106', 1.5, -31.5, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 1, '107', 1.5, -33.8, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 1, '109', 3.0, -38.0, true, false, 3, 0.88);
            addRoomLabel(targetGroup, 1, '108', -0.4, -38.7, true, false, 3, 0.78);
            addRoomLabel(targetGroup, 1, 'С/У', 0.2, -40.7, true, false, 3, 0.78);
            addRoomLabel(targetGroup, 1, 'С/У', 3.3, -41.9, true, false, 3, 0.76);
            addRoomLabel(targetGroup, 1, 'С/У', 0.2, -43.1, true, false, 3, 0.78);
            addRoomLabel(targetGroup, 1, 'ЛК№1', 4.1, -46.0, true, false, 3, 0.88);
            addRoomLabel(targetGroup, 1, '114', 1.5, -50.2, false, false, 3, 0.95);
            addRoomLabel(targetGroup, 1, '114А', 1.5, -53.8, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 1, '117', 1.5, -58.3, false, false, 3, 1.05);
            flushWalls(targetGroup);
        }

        /**
         * КОРПУС 3 — ЭТАЖ 2 (Габариты: X [-1.6..14.0], Z [-61.6..-14.0], ВПЛОТНУЮ к Корпусу 1)
         * Исправлено строго по плану 2-го этажа:
         * 1) Центральный коридор (X [4.6..7.2]) идёт насквозь до самого северного торца здания Z = -61.6 (зал 212 НЕ перекрывает коридор!).
         * 2) Вдоль 209 и 209А (Z [-61.6..-52.2]) западная стена коридора делает небольшую ступеньку на запад (X = 4.3), а от 207 (Z = -52.2) до 201 идёт по X = 4.6.
         * 3) В южной части (Z [-19.8..-14.0]) коридор расширяется до X [4.2..7.6] вокруг широкого лестничного марша, а вдоль торца Z = -14.0 отделены два узких отсека (Z [-15.2..-14.0]).
         * 4) Все внутренние двери между смежными кабинетами (209↔209А, 212↔212А, 208↔208А, 205↔205А, 202↔202А, 201↔201А) расставлены по чертежу.
         */
        function buildBuilding3Floor2(targetGroup) {
            const OUTER_T = 0.24;
            const INNER_T = 0.18;

            // 1. Основная плита перекрытия 2-го этажа Корпуса 3
            addFloorRect(targetGroup, B3_X_WEST, B3_Z_NORTH, B3_X_EAST, B3_Z_SOUTH, false);

            // Восточный эркер перехода к Корпусу 4 (между 208А и 210: X [14.0..15.6], Z [-46.8..-44.2]) — НЕ ТРОГАЕМ!
            addFloorRect(targetGroup, B3_X_EAST, -46.8, 15.6, -44.2, true);

            // --- ВНЕШНИЙ ПЕРИМЕТР СТЕН КОРПУСА 3 (ЭТАЖ 2) ---
            // Южная торцевая стена Корпуса 3 (Z = -14.0) с двустворчатой дверью стыка с Корпусом 1 (X [4.9..6.9])
            addWallLine(targetGroup, B3_X_WEST, B3_Z_SOUTH, B3_X_EAST, B3_Z_SOUTH, [
                { from: 4.9, to: 6.9, type: 'door' }
            ], OUTER_T);

            // Северная торцевая стена Z = -61.6 (глухая)
            addWallLine(targetGroup, B3_X_WEST, B3_Z_NORTH, B3_X_EAST, B3_Z_NORTH, [], OUTER_T);

            // Западная внешняя стена X = -1.6 (глухая)
            addWallLine(targetGroup, B3_X_WEST, B3_Z_NORTH, B3_X_WEST, B3_Z_SOUTH, [], OUTER_T);

            // Восточная внешняя стена X = 14.0 (с открытым проёмом в восточный эркер Z [-46.8..-44.2])
            addWallLine(targetGroup, B3_X_EAST, B3_Z_NORTH, B3_X_EAST, B3_Z_SOUTH, [
                { from: -46.8, to: -44.2, type: 'open' }
            ], OUTER_T);
            // Стены восточного эркера X [14.0..15.6], Z [-46.8..-44.2]
            addWallLine(targetGroup, B3_X_EAST, -46.8, 15.6, -46.8, [], OUTER_T);
            addWallLine(targetGroup, B3_X_EAST, -44.2, 15.6, -44.2, [], OUTER_T);
            addWallLine(targetGroup, 15.6, -46.8, 15.6, -44.2, [
                { from: -46.3, to: -44.7, type: 'door' }
            ], OUTER_T);

            // --- 1. ЮЖНЫЙ УЗЕЛ СТЫКА, УЗКИЕ ТОРЦЕВЫЕ ОТСЕКИ И СТУПЕНИ В КОРИДОРЕ (Z от -19.8 до -14.0) ---
            // Узкие торцевые секции по бокам от входа (Z = -15.2, слева X [-1.6..4.2] за 201 и справа X [7.6..14.0] за 202)
            addWallLine(targetGroup, B3_X_WEST, -15.2, 4.2, -15.2, [], INNER_T);
            addWallLine(targetGroup, 7.6, -15.2, B3_X_EAST, -15.2, [], INNER_T);

            // Расширенная южная часть коридора вокруг марша ступеней (X = 4.2 слева и X = 7.6 справа, Z [-19.8..-14.0])
            addWallLine(targetGroup, 4.2, -19.8, 4.2, B3_Z_SOUTH, [], INNER_T);
            addWallLine(targetGroup, 7.6, -19.8, 7.6, B3_Z_SOUTH, [], INNER_T);
            addWallLine(targetGroup, 4.2, -15.2, 4.6, -15.2, [], INNER_T);
            addWallLine(targetGroup, 7.2, -15.2, 7.6, -15.2, [], INNER_T);

            // Уступы стен коридора на Z = -19.8 (переход от расширенной части X [4.2..7.6] к основному коридору X [4.6..7.2])
            addWallLine(targetGroup, 4.2, -19.8, B3_X_CORR_W, -19.8, [], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -19.8, 7.6, -19.8, [], INNER_T);

            // Широкий марш ступеней в южной части коридора (X [4.2..7.6], Z [-18.4..-16.4])
            const southCorrW = 7.6 - 4.2;
            const southCorrCx = (4.2 + 7.6) / 2;
            for (let i = 0; i < 6; i++) {
                const sz = -18.4 + i * 0.30;
                const heightRatio = 0.035 * (i + 1);
                const geom = new THREE.BoxGeometry(southCorrW * 0.96, 1, 0.28);
                registerDynamicStairStep(targetGroup, geom, southCorrCx, sz, heightRatio, 0);
            }

            // --- 2. ПРОДОЛЬНЫЕ СТЕНЫ ЦЕНТРАЛЬНОГО КОРИДОРА 2-ГО ЭТАЖА ---
            // Западная стена коридора:
            // Участок 1 (Z от -52.2 до -19.8): идёт ровно по X = 4.6 вдоль 207, ЛК №2, 205А, 205, ЛК №1, 201А, 201
            addWallLine(targetGroup, B3_X_CORR_W, -52.2, B3_X_CORR_W, -19.8, [
                { from: -50.8, to: -49.2, type: 'door' }, // Двустворчатая дверь в 207
                { from: -46.9, to: -45.1, type: 'door' }, // Двустворчатая дверь в ЛК №2 (северная шахта)
                { from: -43.6, to: -42.4, type: 'door' }, // Дверь в 205А
                { from: -41.2, to: -39.6, type: 'door' }, // Северная двустворчатая дверь в 205
                { from: -32.6, to: -31.0, type: 'door' }, // Южная двустворчатая дверь в 205
                { from: -29.5, to: -27.7, type: 'door' }, // Двустворчатая дверь в ЛК №1 (южная шахта)
                { from: -26.4, to: -24.8, type: 'door' }, // Двустворчатая дверь в 201А
                { from: -23.8, to: -22.2, type: 'door' }  // Двустворчатая дверь в 201
            ], INNER_T);

            // Участок 2 (Z от -61.6 до -52.2): на плане у 209 и 209А стена коридора чуть отступает на запад до X = 4.3!
            addWallLine(targetGroup, 4.3, B3_Z_NORTH, 4.3, -52.2, [
                { from: -60.4, to: -59.2, type: 'door' }, // Дверь в 209А
                { from: -53.8, to: -52.6, type: 'door' }  // Дверь в 209
            ], INNER_T);

            // Восточная стена коридора X = 7.2: идёт прямо от самого северного торца Z = -61.6 до Z = -19.8!
            addWallLine(targetGroup, B3_X_CORR_E, B3_Z_NORTH, B3_X_CORR_E, -19.8, [
                { from: -55.8, to: -54.2, type: 'door' }, // Двустворчатая дверь в зал 212
                { from: -53.2, to: -52.0, type: 'door' }, // Дверь в 212А
                { from: -50.6, to: -49.4, type: 'door' }, // Дверь в 210
                { from: -46.4, to: -44.6, type: 'door' }, // Двустворчатая дверь в переход к Корпусу 4
                { from: -43.6, to: -42.4, type: 'door' }, // Дверь в 208А
                { from: -40.8, to: -39.2, type: 'door' }, // Северная двустворчатая дверь в 208
                { from: -34.0, to: -32.8, type: 'door' }, // Южная дверь в 208
                { from: -31.4, to: -29.8, type: 'door' }, // Двустворчатая дверь в 206
                { from: -29.0, to: -27.4, type: 'door' }, // Двустворчатая дверь в 204
                { from: -26.2, to: -25.0, type: 'door' }, // Дверь в 202А
                { from: -23.8, to: -22.6, type: 'door' }  // Дверь в 202
            ], INNER_T);

            // --- 3. ПОПЕРЕЧНЫЕ СТЕНЫ ЗАПАДНОГО РЯДА (X от -1.6 до 4.6): 201, 201А, ЛК №1, 205, 205А, ЛК №2, 207, 209, 209А ---
            // Стена между 201 (Z [-24.4..-15.2]) и 201А (Z [-26.8..-24.4]) с дверью у внешней стены X = -1.6
            addWallLine(targetGroup, B3_X_WEST, -24.4, B3_X_CORR_W, -24.4, [
                { from: -1.1, to: 0.1, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_SOUTH_Z2, B3_X_CORR_W, B3_SHAFT_SOUTH_Z2, [], INNER_T); // Z = -26.8

            // Южная шахта лестницы: ЛК №1 на 2-м этаже (X [-1.6..4.6], Z [-30.4..-26.8]) — соосна с ЛК №2 1-го этажа
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_SOUTH_Z1, B3_X_CORR_W, B3_SHAFT_SOUTH_Z1, [], INNER_T); // Z = -30.4
            buildB3Staircase(targetGroup, B3_X_WEST + 0.1, B3_X_CORR_W - 0.1, B3_SHAFT_SOUTH_Z1 + 0.1, B3_SHAFT_SOUTH_Z2 - 0.1, false);

            // Большой зал 205 (Z [-41.8..-30.4]) и смежный 205А (Z [-44.2..-41.8]) с дверью у коридора
            addWallLine(targetGroup, B3_X_WEST, -41.8, B3_X_CORR_W, -41.8, [
                { from: 2.8, to: 4.0, type: 'door' }
            ], INNER_T);
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_NORTH_Z2, B3_X_CORR_W, B3_SHAFT_NORTH_Z2, [], INNER_T); // Z = -44.2

            // Северная шахта лестницы: ЛК №2 на 2-м этаже (X [-1.6..4.6], Z [-47.8..-44.2]) — соосна с ЛК №1 1-го этажа
            addWallLine(targetGroup, B3_X_WEST, B3_SHAFT_NORTH_Z1, B3_X_CORR_W, B3_SHAFT_NORTH_Z1, [], INNER_T); // Z = -47.8
            buildB3Staircase(targetGroup, B3_X_WEST + 0.1, B3_X_CORR_W - 0.1, B3_SHAFT_NORTH_Z1 + 0.1, B3_SHAFT_NORTH_Z2 - 0.1, false);

            // Кабинет 207 (Z [-52.2..-47.8]), зал 209 (Z [-58.8..-52.2]) и торцевой 209А (Z [-61.6..-58.8])
            addWallLine(targetGroup, B3_X_WEST, -52.2, B3_X_CORR_W, -52.2, [], INNER_T);
            addWallLine(targetGroup, B3_X_WEST, -58.8, 4.3, -58.8, [
                { from: 2.7, to: 3.9, type: 'door' } // Дверь между 209 и 209А у коридора
            ], INNER_T);

            // --- 4. ПОПЕРЕЧНЫЕ СТЕНЫ ВОСТОЧНОГО РЯДА (X от 7.2 до 14.0): 202, 202А, 204, 206, 208, 208А, переход, 210, 212А, 212 ---
            addWallLine(targetGroup, B3_X_CORR_E, -24.4, B3_X_EAST, -24.4, [
                { from: 7.8, to: 9.0, type: 'door' } // Дверь между 202 и 202А у коридора
            ], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -26.8, B3_X_EAST, -26.8, [], INNER_T); // Между 202А и 204
            addWallLine(targetGroup, B3_X_CORR_E, -29.2, B3_X_EAST, -29.2, [], INNER_T); // Между 204 и 206
            addWallLine(targetGroup, B3_X_CORR_E, -31.8, B3_X_EAST, -31.8, [], INNER_T); // Между 206 и 208
            addWallLine(targetGroup, B3_X_CORR_E, -41.8, B3_X_EAST, -41.8, [
                { from: 7.8, to: 9.0, type: 'door' } // Дверь между 208 и 208А у коридора
            ], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -44.2, B3_X_EAST, -44.2, [], INNER_T); // Южная стена прохода к переходу (-44.2)

            // Ступени посередине прохода к восточному эркеру перехода (X [11.8..13.2], Z [-46.8..-44.2])
            const bayDepthZ = 2.6 - 0.28;
            const bayCz = -45.5;
            for (let i = 0; i < 4; i++) {
                const sx = 13.0 - i * 0.34;
                const heightRatio = 0.045 * (i + 1);
                const geom = new THREE.BoxGeometry(0.32, 1, bayDepthZ);
                registerDynamicStairStep(targetGroup, geom, sx, bayCz, heightRatio, 0);
            }

            addWallLine(targetGroup, B3_X_CORR_E, -46.8, B3_X_EAST, -46.8, [], INNER_T); // Северная стена прохода к переходу (-46.8)
            addWallLine(targetGroup, B3_X_CORR_E, -51.4, B3_X_EAST, -51.4, [], INNER_T); // Между 210 и 212А
            addWallLine(targetGroup, B3_X_CORR_E, -53.8, B3_X_EAST, -53.8, [
                { from: 7.8, to: 9.0, type: 'door' } // Дверь между 212А и залом 212 у коридора
            ], INNER_T);

            // 3D-плашки помещений 2-го этажа Корпуса 3 (buildingId = 3)
            addRoomLabel(targetGroup, 2, '201', 1.5, -19.8, false, false, 3, 1.0);
            addRoomLabel(targetGroup, 2, '201А', 1.5, -25.6, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, 'ЛК№1', 4.1, -28.6, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, '205', 1.5, -36.1, false, false, 3, 1.05);
            addRoomLabel(targetGroup, 2, '205А', 1.5, -43.0, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, 'ЛК№2', 4.1, -46.0, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, '207', 1.5, -50.0, false, false, 3, 0.95);
            addRoomLabel(targetGroup, 2, '209', 1.4, -55.5, false, false, 3, 1.0);
            addRoomLabel(targetGroup, 2, '209А', 1.4, -60.2, true, false, 3, 0.90);

            addRoomLabel(targetGroup, 2, '202', 10.6, -19.8, false, false, 3, 1.0);
            addRoomLabel(targetGroup, 2, '202А', 10.6, -25.6, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, '204', 10.6, -28.0, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, '206', 10.6, -30.5, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, '208', 10.6, -36.8, false, false, 3, 1.05);
            addRoomLabel(targetGroup, 2, '208А', 10.6, -43.0, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, '210', 10.6, -49.1, false, false, 3, 0.95);
            addRoomLabel(targetGroup, 2, '212А', 10.6, -52.6, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, '212', 10.6, -57.7, false, false, 3, 1.05);
            flushWalls(targetGroup);
        }
window.buildBuilding3Floor1 = buildBuilding3Floor1;
window.buildBuilding3Floor2 = buildBuilding3Floor2;
