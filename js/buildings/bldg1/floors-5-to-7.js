(function() {
    'use strict';

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

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], OUTER_T);
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

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], OUTER_T);
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

            addWallLine(targetGroup, -10.0, -4.0, -5.8, -4.0, [], OUTER_T);
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

    window.buildFloor5 = buildFloor5;
    window.buildFloor6 = buildFloor6;
    window.buildFloor7 = buildFloor7;
})();
