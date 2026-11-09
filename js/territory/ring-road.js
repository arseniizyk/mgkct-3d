function buildRingRoadAroundCollege(group) {
    const targetGroup = group || window.roadNetworkGroup || (typeof roadNetworkGroup !== 'undefined' ? roadNetworkGroup : null);
    if (!targetGroup) return;
    clearAndDisposeGroup(targetGroup);
    const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');

    // Материалы для упрощенной дорожной сети
    const minimalRoadSurfaceMat = (typeof MATERIALS !== 'undefined' && MATERIALS.minimalRoadSurface) ? MATERIALS.minimalRoadSurface : new THREE.MeshStandardMaterial({
        color: isDark ? 0x181e28 : 0xc8d1dc,
        roughness: 0.95,
        metalness: 0.02,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
    });

    const roadLineMat = (typeof MATERIALS !== 'undefined' && MATERIALS.roadContourLine) ? MATERIALS.roadContourLine : new THREE.LineBasicMaterial({
        color: isDark ? 0x94a3b8 : 0x334155,
        linewidth: 1
    });

    const roadCenterLineMat = (typeof MATERIALS !== 'undefined' && MATERIALS.roadCenterLine) ? MATERIALS.roadCenterLine : new THREE.LineBasicMaterial({
        color: isDark ? 0x475569 : 0x64748b,
        linewidth: 1
    });

    const ySurface = -0.05;
    const yLine = -0.048;
    const yCenter = -0.046;

    function addRoadRibbon(x1, z1, x2, z2) {
        const xMin = Math.min(x1, x2);
        const xMax = Math.max(x1, x2);
        const zMin = Math.min(z1, z2);
        const zMax = Math.max(z1, z2);
        const w = xMax - xMin;
        const d = zMax - zMin;
        const geom = new THREE.PlaneGeometry(w, d);
        const mesh = new THREE.Mesh(geom, minimalRoadSurfaceMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((xMin + xMax) / 2, ySurface, (zMin + zMax) / 2);
        mesh.receiveShadow = false;
        targetGroup.add(mesh);
    }

    function addEdge(x1, z1, x2, z2) {
        const geom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x1, yLine, z1),
            new THREE.Vector3(x2, yLine, z2)
        ]);
        const line = new THREE.Line(geom, roadLineMat);
        targetGroup.add(line);
    }

    const dashSegments = [];
    function addCenterDashes(x1, z1, x2, z2, dashLen = 3.0, gapLen = 2.5) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const totalLen = Math.hypot(dx, dz);
        if (totalLen < 0.5) return;
        const ux = dx / totalLen;
        const uz = dz / totalLen;
        let dist = 0;
        while (dist < totalLen) {
            const segLen = Math.min(dashLen, totalLen - dist);
            dashSegments.push(
                new THREE.Vector3(x1 + ux * dist, yCenter, z1 + uz * dist),
                new THREE.Vector3(x1 + ux * (dist + segLen), yCenter, z1 + uz * (dist + segLen))
            );
            dist += dashLen + gapLen;
        }
    }

    // ----------------------------------------------------
    // Габариты и контуры проездов
    // ----------------------------------------------------
    // Внутренний двор между корпусами 2, 3 и 4:
    const innerXWest = 17.5;
    const innerXEast = 22.5;
    const innerZSouth = -18.2;
    const innerZNorth = -23.2;

    // Восточный проезд:
    const eastRoadX1 = 72.0;
    const eastRoadX2 = 77.0;

    // Северный проезд и подъезд к гаражу:
    const northRoadZ1 = -71.5;
    const northRoadZ2 = -66.5;
    const northWestEnd = 16.5; // Как в 3D-виде — отходит в сторону гаража, но не врезается в него
    const northExitZ = -75.5;  // Небольшое продление выезда на север (~1 см на карте, без тупика)

    // Главная южная улица:
    const mainRoadZ1 = 28.5;
    const mainRoadZ2 = 38.5;
    const mainXStart = -35.0;
    const mainXEnd = 88.0;

    // 1. Поверхности проездов
    // Южная улица
    addRoadRibbon(mainXStart, mainRoadZ1, mainXEnd, mainRoadZ2);
    // Восточный проезд
    addRoadRibbon(eastRoadX1, northRoadZ1, eastRoadX2, mainRoadZ1);
    // Короткое продление выезда на север за пределы забора:
    addRoadRibbon(eastRoadX1, northExitZ, eastRoadX2, northRoadZ1);
    // Северный проезд (от отвода у гаража X = 16.5 до восточного проезда X = 77.0)
    addRoadRibbon(northWestEnd, northRoadZ1, eastRoadX2, northRoadZ2);
    // Южный внутренний проезд (между К2 и К4)
    addRoadRibbon(innerXEast, innerZNorth, eastRoadX1, innerZSouth);
    // Западный внутренний проезд (между К3 и К4)
    addRoadRibbon(innerXWest, northRoadZ2, innerXEast, innerZSouth);

    // 2. Линии контура дорог
    // Внутренний контур двора:
    addEdge(innerXEast, northRoadZ2, innerXEast, innerZNorth);
    addEdge(innerXEast, innerZNorth, eastRoadX1, innerZNorth);
    addEdge(innerXWest, northRoadZ2, innerXWest, innerZSouth);
    addEdge(innerXWest, innerZSouth, eastRoadX1, innerZSouth);
    addEdge(innerXWest, innerZSouth, innerXEast, innerZSouth);

    // Восточный проезд и выезд на север:
    // Восточная кромка (доходит до northExitZ, открытый конец БЕЗ поперечного тупика):
    addEdge(eastRoadX2, mainRoadZ1, eastRoadX2, northExitZ);
    // Западная кромка выезда на север (открытый конец БЕЗ поперечного тупика):
    addEdge(eastRoadX1, northRoadZ1, eastRoadX1, northExitZ);
    // Внутренняя (западная) кромка восточного проезда:
    addEdge(eastRoadX1, mainRoadZ1, eastRoadX1, innerZSouth);
    addEdge(eastRoadX1, innerZNorth, eastRoadX1, northRoadZ2);

    // Северный проезд и отвод у гаража:
    // Северная внешняя кромка (до восточного проезда X = 72.0, перекресток открыт):
    addEdge(northWestEnd, northRoadZ1, eastRoadX1, northRoadZ1);
    // Без тупиковой поперечины на торце (открытый выезд к гаражу)
    // Южная кромка отвода у двора:
    addEdge(northWestEnd, northRoadZ2, innerXWest, northRoadZ2);
    // Южная кромка северного проезда вдоль Корпуса 4:
    addEdge(innerXEast, northRoadZ2, eastRoadX1, northRoadZ2);

    // Южная главная улица:
    addEdge(mainXStart, mainRoadZ1, eastRoadX1, mainRoadZ1);
    addEdge(eastRoadX2, mainRoadZ1, mainXEnd, mainRoadZ1);
    addEdge(mainXStart, mainRoadZ2, mainXEnd, mainRoadZ2);

    // 3. Осевая разметка
    const showCenterline = (typeof STATE !== 'undefined' && typeof STATE.showRoadCenterline === 'boolean')
        ? STATE.showRoadCenterline
        : (typeof ROAD_SHOW_CENTERLINE !== 'undefined' ? ROAD_SHOW_CENTERLINE === 1 : true);

    if (showCenterline) {
        addCenterDashes(mainXStart + 2.0, 33.5, mainXEnd - 2.0, 33.5, 3.0, 2.5);
        addCenterDashes(74.5, mainRoadZ1, 74.5, northExitZ, 3.0, 2.5);
        addCenterDashes(northWestEnd + 1.5, -69.0, eastRoadX1 - 1.0, -69.0, 3.0, 2.5);
        addCenterDashes(innerXEast + 1.0, -20.7, eastRoadX1 - 1.0, -20.7, 2.5, 2.0);
        addCenterDashes(20.0, northRoadZ2 + 1.0, 20.0, -20.7, 2.5, 2.0);

        if (dashSegments.length > 0) {
            const centerGeom = new THREE.BufferGeometry().setFromPoints(dashSegments);
            const centerLines = new THREE.LineSegments(centerGeom, roadCenterLineMat);
            targetGroup.add(centerLines);
        }
    }
}

window.buildRingRoadAroundCollege = buildRingRoadAroundCollege;
