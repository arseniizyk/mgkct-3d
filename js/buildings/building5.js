// ==========================================
// Гараж (хозяйственное строение к северу от Корпуса 3)
// Координаты по ширине выровнены строго по створу Корпуса 3:
// X [-1.6..14.0], Z [-71.5..-66.0], глубина 5.5 м, ширина 15.6 м
// Единое неподписанное помещение с широким гаражным заездом справа (со стороны дороги)
// ==========================================

(function() {
    'use strict';

    // Габариты гаража строго по ширине Корпуса 3 (B3_X_WEST = -1.6, B3_X_EAST = 14.0)
    const B5_X_WEST = -1.6;
    const B5_X_EAST = 14.0;
    const B5_Z_NORTH = -71.5;
    const B5_Z_SOUTH = -66.0;

    const OUTER_T = 0.24;

    function buildBuilding5Floor1(targetGroup) {
        if (!targetGroup) return;

        // 1. Плита пола (фундамент) строго под стенами здания (без выступающего наружу цоколя)
        addFloorRect(targetGroup, B5_X_WEST, B5_Z_NORTH, B5_X_EAST, B5_Z_SOUTH, false);

        // 2. Внешние несущие стены (BASE_WALL_HEIGHT = 0.35 м)
        // Северная глухая стена вдоль границы участка
        addWallLine(targetGroup, B5_X_WEST, B5_Z_NORTH, B5_X_EAST, B5_Z_NORTH, [], OUTER_T);

        // Западная глухая стена строго в створе Корпуса 3
        addWallLine(targetGroup, B5_X_WEST, B5_Z_NORTH, B5_X_WEST, B5_Z_SOUTH, [], OUTER_T);

        // Южная глухая стена со стороны Корпуса 3
        addWallLine(targetGroup, B5_X_WEST, B5_Z_SOUTH, B5_X_EAST, B5_Z_SOUTH, [], OUTER_T);

        // Восточная стена СО СТОРОНЫ ДОРОГИ: широкий гаражный заезд (ширина 3.4 м: Z [-70.4..-67.0])
        addWallLine(targetGroup, B5_X_EAST, B5_Z_NORTH, B5_X_EAST, B5_Z_SOUTH, [
            { from: -70.4, to: -67.0, type: 'door' } // Большой гаражный заезд со стороны дороги
        ], OUTER_T);

        // Помещение единое и неподписанное (без внутренних перегородок, без выступающего пола и без подписей)
    }

    // Экспорт в глобальную область видимости
    window.buildBuilding5Floor1 = buildBuilding5Floor1;
})();
