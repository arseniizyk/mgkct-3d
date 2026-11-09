// ==========================================
// ПЕШЕХОДНЫЙ И ТРАНСПОРТНЫЙ СВЕТОФОР С КНОПКОЙ ВЫЗОВА
// ==========================================
function addPedestrianTrafficLight(group, x, z, rotRoadY = 0, rotPedY = 0, rotBtnY = Math.PI, hasButton = true) {
    const lightGroup = new THREE.Group();
    lightGroup.position.set(x, 0, z);

    // 1. Оцинкованная восьмигранная/коническая мачта светофора
    const poleH = 4.3;
    const poleGeom = new THREE.CylinderGeometry(0.045, 0.08, poleH, 16);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    lightGroup.add(poleMesh);

    // Опорный фланец с 4 анкерными шпильками и гайками
    const flangeGeom = new THREE.BoxGeometry(0.28, 0.025, 0.28);
    const flangeMesh = new THREE.Mesh(flangeGeom, MATERIALS.poleMetal);
    flangeMesh.position.y = 0.012;
    lightGroup.add(flangeMesh);

    const studGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.04, 8);
    const boltOffsets = [[-0.10, -0.10], [0.10, -0.10], [-0.10, 0.10], [0.10, 0.10]];
    boltOffsets.forEach(([bx, bz]) => {
        const stud = new THREE.Mesh(studGeom, MATERIALS.poleMetal);
        stud.position.set(bx, 0.035, bz);
        lightGroup.add(stud);
    });

    // Ревизионный монтажный люк в нижней части стойки
    const hatchGeom = new THREE.BoxGeometry(0.10, 0.32, 0.015);
    const hatchMesh = new THREE.Mesh(hatchGeom, MATERIALS.poleMetal);
    hatchMesh.position.set(0, 0.45, 0.075);
    lightGroup.add(hatchMesh);

    // Верхний защитный купол мачты
    const capGeom = new THREE.ConeGeometry(0.055, 0.06, 16);
    const capMesh = new THREE.Mesh(capGeom, MATERIALS.poleMetal);
    capMesh.position.y = poleH + 0.03;
    lightGroup.add(capMesh);

    // 2. ТРАНСПОРТНЫЙ ТРЁХСЕКЦИОННЫЙ СВЕТОФОР (Т.1 СТБ 1300 / ГОСТ Р 52282)
    const vehGroup = new THREE.Group();
    vehGroup.position.set(0, 3.25, 0);
    vehGroup.rotation.y = rotRoadY;

    // Монтажный консольный кронштейн на мачту
    const bracketGeom = new THREE.BoxGeometry(0.035, 0.035, 0.22);
    const bTop = new THREE.Mesh(bracketGeom, MATERIALS.poleMetal);
    bTop.position.set(0, 0.28, 0.11);
    vehGroup.add(bTop);
    const bBot = new THREE.Mesh(bracketGeom, MATERIALS.poleMetal);
    bBot.position.set(0, -0.28, 0.11);
    vehGroup.add(bBot);

    // Чёрный контрастный фоновый экран с белой окантовкой (backplate)
    const backplateGeom = new THREE.PlaneGeometry(0.48, 0.96);
    const backplateMesh = new THREE.Mesh(backplateGeom, MATERIALS.trafficBackplate || MATERIALS.trafficHousing);
    backplateMesh.position.set(0, 0, 0.22);
    vehGroup.add(backplateMesh);

    // Основной корпус светофорной головки
    const vehBoxGeom = new THREE.BoxGeometry(0.24, 0.78, 0.15);
    const vehBox = new THREE.Mesh(vehBoxGeom, MATERIALS.trafficHousing || MATERIALS.shelterFrame);
    vehBox.position.set(0, 0, 0.30);
    vehBox.castShadow = true;
    vehGroup.add(vehBox);

    // 3 линзы и глубокие светозащитные козырьки
    const lensGeom = new THREE.CircleGeometry(0.082, 20);
    const visorGeom = new THREE.CylinderGeometry(0.088, 0.088, 0.13, 20, 1, true, 0, Math.PI);
    visorGeom.rotateX(Math.PI / 2);

    // Красный сигнал
    const redMesh = new THREE.Mesh(lensGeom, MATERIALS.trafficRed);
    redMesh.position.set(0, 0.25, 0.376);
    vehGroup.add(redMesh);
    const visorRed = new THREE.Mesh(visorGeom, MATERIALS.trafficHousing);
    visorRed.position.set(0, 0.25, 0.42);
    vehGroup.add(visorRed);

    // Жёлтый сигнал
    const yellowMesh = new THREE.Mesh(lensGeom, MATERIALS.trafficYellow);
    yellowMesh.position.set(0, 0.0, 0.376);
    vehGroup.add(yellowMesh);
    const visorYellow = new THREE.Mesh(visorGeom, MATERIALS.trafficHousing);
    visorYellow.position.set(0, 0.0, 0.42);
    vehGroup.add(visorYellow);

    // Зелёный сигнал
    const greenMesh = new THREE.Mesh(lensGeom, MATERIALS.trafficGreen);
    greenMesh.position.set(0, -0.25, 0.376);
    vehGroup.add(greenMesh);
    const visorGreen = new THREE.Mesh(visorGeom, MATERIALS.trafficHousing);
    visorGreen.position.set(0, -0.25, 0.42);
    vehGroup.add(visorGreen);

    lightGroup.add(vehGroup);

    // 3. ПЕШЕХОДНЫЙ ДВУХСЕКЦИОННЫЙ СВЕТОФОР (П.1 «ЧЕЛОВЕЧКИ»)
    const pedGroup = new THREE.Group();
    pedGroup.position.set(0, 2.30, 0);
    pedGroup.rotation.y = rotPedY;

    // Кронштейн крепления пешеходного блока
    const pedArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.16), MATERIALS.poleMetal);
    pedArm.position.set(0, 0, 0.08);
    pedGroup.add(pedArm);

    // Корпус пешеходного светофора
    const pedBoxGeom = new THREE.BoxGeometry(0.22, 0.52, 0.14);
    const pedBox = new THREE.Mesh(pedBoxGeom, MATERIALS.trafficHousing || MATERIALS.shelterFrame);
    pedBox.position.set(0, 0, 0.23);
    pedBox.castShadow = true;
    pedGroup.add(pedBox);

    const pedLensGeom = new THREE.PlaneGeometry(0.16, 0.16);

    // Верхняя секция: Красный силуэт стоящего человека
    const pedRedMesh = new THREE.Mesh(pedLensGeom, MATERIALS.trafficPedRedMan || MATERIALS.trafficRed);
    pedRedMesh.position.set(0, 0.125, 0.301);
    pedGroup.add(pedRedMesh);

    // Нижняя секция: Зелёный силуэт шагающего человека
    const pedGreenMesh = new THREE.Mesh(pedLensGeom, MATERIALS.trafficPedGreenMan || MATERIALS.trafficGreen);
    pedGreenMesh.position.set(0, -0.125, 0.301);
    pedGroup.add(pedGreenMesh);

    lightGroup.add(pedGroup);

    // 4. ТАБЛО ВЫЗОВА ПЕШЕХОДНОЙ ФАЗЫ (ВПУ С КНОПКОЙ И ДИСПЛЕЕМ «ЖДИТЕ»)
    if (hasButton) {
        const btnGroup = new THREE.Group();
        btnGroup.position.set(0, 1.05, 0);
        btnGroup.rotation.y = rotBtnY;

        // Хомут крепления вызывной кнопки на мачту
        const btnClamp = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16), MATERIALS.poleMetal);
        btnGroup.add(btnClamp);

        // Ярко-жёлтый ударопрочный корпус (RAL 1023) с фасками
        const btnCaseGeom = new THREE.BoxGeometry(0.14, 0.28, 0.09);
        const btnCase = new THREE.Mesh(btnCaseGeom, MATERIALS.trafficButtonYellow || MATERIALS.roadMarkingYellow);
        btnCase.position.set(0, 0, 0.09);
        btnCase.castShadow = true;
        btnGroup.add(btnCase);

        // Информационная лицевая панель «ЖДИТЕ / ДЛЯ ПЕРЕХОДА НАЖМИТЕ КНОПКУ»
        const btnFaceGeom = new THREE.PlaneGeometry(0.12, 0.25);
        const btnFace = new THREE.Mesh(btnFaceGeom, MATERIALS.trafficButtonPlate || MATERIALS.trafficButtonFace);
        btnFace.position.set(0, 0, 0.136);
        btnGroup.add(btnFace);

        // Тактильная металлическая кнопка из нержавеющей стали
        const btnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 20), MATERIALS.trafficButtonChrome || MATERIALS.poleMetal);
        btnMesh.geometry.rotateX(Math.PI / 2);
        btnMesh.position.set(0, -0.015, 0.142);
        btnGroup.add(btnMesh);

        // Светодиодный индикатор подтверждения вызова
        const ledMesh = new THREE.Mesh(new THREE.CircleGeometry(0.014, 14), MATERIALS.trafficRed);
        ledMesh.position.set(0, 0.095, 0.137);
        btnGroup.add(ledMesh);

        lightGroup.add(btnGroup);
    }

    group.add(lightGroup);
}

function buildPerimeterFence(group) {
    const fenceGeoms = [];
    const postW = 0.08;
    const postH = 2.05;
    const baseW = 0.16;
    const baseH = 0.05;
    const railH = 0.04;
    const railW = 0.025;
    const picketW = 0.028;
    const picketD = 0.014;
    const picketH = 1.80;
    const picketStep = 0.14;

    function addFenceLine(x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const totalDist = Math.hypot(dx, dz);
        if (totalDist < 0.5) return;

        const dirX = dx / totalDist;
        const dirZ = dz / totalDist;
        const angleY = Math.atan2(dx, dz);

        const postSpan = 2.50;
        const numPosts = Math.max(1, Math.round(totalDist / postSpan));
        const actualSpan = totalDist / numPosts;

        for (let i = 0; i <= numPosts; i++) {
            const px = x1 + dirX * (i * actualSpan);
            const pz = z1 + dirZ * (i * actualSpan);

            const baseGeom = new THREE.BoxGeometry(baseW, baseH, baseW);
            baseGeom.translate(px, baseH / 2, pz);
            fenceGeoms.push(baseGeom);

            const postGeom = new THREE.BoxGeometry(postW, postH, postW);
            postGeom.translate(px, postH / 2, pz);
            fenceGeoms.push(postGeom);

            const capGeom = new THREE.ConeGeometry(postW * 0.75, 0.05, 4);
            capGeom.rotateY(Math.PI / 4);
            capGeom.translate(px, postH + 0.025, pz);
            fenceGeoms.push(capGeom);
        }

        const railTop = new THREE.BoxGeometry(railW, railH, totalDist);
        railTop.rotateY(angleY);
        railTop.translate((x1 + x2) / 2, 1.70, (z1 + z2) / 2);
        fenceGeoms.push(railTop);

        const railBot = new THREE.BoxGeometry(railW, railH, totalDist);
        railBot.rotateY(angleY);
        railBot.translate((x1 + x2) / 2, 0.40, (z1 + z2) / 2);
        fenceGeoms.push(railBot);

        const numPickets = Math.floor(totalDist / picketStep);
        for (let p = 1; p < numPickets; p++) {
            const distFromStart = p * picketStep;
            if (Math.abs(distFromStart % actualSpan) < 0.08 || Math.abs(actualSpan - (distFromStart % actualSpan)) < 0.08) {
                continue;
            }
            const lx = x1 + dirX * distFromStart;
            const lz = z1 + dirZ * distFromStart;

            const picketGeom = new THREE.BoxGeometry(picketW, picketH, picketD);
            picketGeom.rotateY(angleY);
            picketGeom.translate(lx, 0.20 + picketH / 2, lz);
            fenceGeoms.push(picketGeom);
        }
    }

    // Линии забора вокруг кампуса МГКЦТ:
    // 1. Северный забор: с проездом для пожарного выезда (X: 17.5..22.5) и БЕЗ дырки на 40..46:
        // Новый периметральный забор (красная разметка):
    // 1. Западный забор вдоль Корпуса 3 и Корпуса 5 (X = -5.0, Z от -14.0 до -72.0)
        // Новый периметральный забор (красная разметка):
    // 1. Западный забор вдоль Корпуса 3 и Корпуса 5 (X = -5.0, Z от -14.0 до -72.0)
    addFenceLine(-5.0, -72.0, -5.0, -14.0);

    // 2. Северный забор вдоль северной границы участка (Z = -72.0, X от -5.0 до 72.0)
    addFenceLine(-5.0, -72.0, 72.0, -72.0);

    // 3. Восточный забор вдоль Корпуса 4 и 2 (X = 72.0, к югу от северного проезда Z = -66.5 до ворот Z = -24.0)
    addFenceLine(72.0, -66.5, 72.0, -24.0);
    // Ворота въезда на служебную парковку: Z: -24.0 .. -17.0
    addFenceLine(72.0, -17.0, 72.0, 3.5);

    // 4. Юго-восточный угловой забор у Корпуса 2
    addFenceLine(68.0, 3.5, 72.0, 3.5);

    if (fenceGeoms.length > 0) {
        const mergedFence = mergeBufferGeometriesVanilla(fenceGeoms);
        const fenceMesh = new THREE.Mesh(mergedFence, MATERIALS.perimeterFence);
        fenceMesh.castShadow = true;
        fenceMesh.receiveShadow = true;
        group.add(fenceMesh);
    }
}

window.addPedestrianTrafficLight = addPedestrianTrafficLight;
window.buildPerimeterFence = buildPerimeterFence;
