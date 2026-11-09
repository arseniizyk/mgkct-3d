(function() {
    'use strict';

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
                { from: -46.68, to: -44.32, type: 'door' }
            ], OUTER_T);

            // --- 1. ЮЖНЫЙ УЗЕЛ СТЫКА, УЗКИЕ ТОРЦЕВЫЕ ОТСЕКИ И СТУПЕНИ В КОРИДОРЕ (Z от -19.8 до -14.0) ---
            // Узкие торцевые секции по бокам от входа (Z = -15.2, слева X [-1.6..4.6] за 201 и справа X [7.2..14.0] за 202)
            addWallLine(targetGroup, B3_X_WEST, -15.2, B3_X_CORR_W, -15.2, [], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -15.2, B3_X_EAST, -15.2, [], INNER_T);

            // Южная часть коридора вокруг марша ступеней — соосна с коридором Корпуса 1 (X = 4.6 слева и X = 7.2 справа, Z [-19.8..-14.0])
            addWallLine(targetGroup, B3_X_CORR_W, -19.8, B3_X_CORR_W, B3_Z_SOUTH, [], INNER_T);
            addWallLine(targetGroup, B3_X_CORR_E, -19.8, B3_X_CORR_E, B3_Z_SOUTH, [], INNER_T);

            // Марш ступеней в южной части коридора (X [4.6..7.2], Z [-18.4..-16.4])
            const southCorrW = B3_X_CORR_E - B3_X_CORR_W;
            const southCorrCx = (B3_X_CORR_W + B3_X_CORR_E) / 2;
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
            addRoomLabel(targetGroup, 2, 'ЛК№1', 1.5, -28.6, true, false, 3, 0.88);
            addRoomLabel(targetGroup, 2, '205', 1.5, -36.1, false, false, 3, 1.05);
            addRoomLabel(targetGroup, 2, '205А', 1.5, -43.0, true, false, 3, 0.90);
            addRoomLabel(targetGroup, 2, 'ЛК№2', 1.5, -46.0, true, false, 3, 0.88);
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
    window.buildBuilding3Floor2 = buildBuilding3Floor2;
})();
