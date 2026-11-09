function addStreetLamp(group, x, z, rotY = 0) {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(x, 0, z);
    lampGroup.rotation.y = rotY;

    const poleH = 5.2;
    const poleGeom = new THREE.CylinderGeometry(0.06, 0.09, poleH, 8);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    lampGroup.add(poleMesh);

    const armGeom = new THREE.BoxGeometry(1.2, 0.05, 0.05);
    const armMesh = new THREE.Mesh(armGeom, MATERIALS.poleMetal);
    armMesh.position.set(0.5, poleH - 0.1, 0);
    lampGroup.add(armMesh);

    const fixtureGeom = new THREE.BoxGeometry(0.55, 0.08, 0.18);
    const fixtureMesh = new THREE.Mesh(fixtureGeom, MATERIALS.shelterRoof);
    fixtureMesh.position.set(1.0, poleH - 0.15, 0);
    lampGroup.add(fixtureMesh);

    group.add(lampGroup);
}

// Шлагбаум поперек проезда с севера на юг (поперек X)
function addBarrierGate(group, x, z, roadWidth = 5.5) {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(x - roadWidth / 2 + 0.3, 0, z);

    const postGeom = new THREE.BoxGeometry(0.35, 1.1, 0.35);
    const postMesh = new THREE.Mesh(postGeom, MATERIALS.signBlue);
    postMesh.position.y = 0.55;
    postMesh.castShadow = true;
    gateGroup.add(postMesh);

    const armLen = roadWidth - 0.8;
    const armGeom = new THREE.BoxGeometry(armLen, 0.08, 0.05);
    const armMesh = new THREE.Mesh(armGeom, MATERIALS.signWhite);
    armMesh.position.set(armLen / 2 + 0.15, 0.9, 0);
    gateGroup.add(armMesh);

    const stripeCount = 4;
    for (let i = 0; i < stripeCount; i++) {
        const sGeom = new THREE.BoxGeometry(armLen / (stripeCount * 2), 0.09, 0.06);
        const sMesh = new THREE.Mesh(sGeom, MATERIALS.signRed);
        sMesh.position.set(0.25 + (i * 2 + 1) * (armLen / (stripeCount * 2)), 0.9, 0);
        gateGroup.add(sMesh);
    }

    group.add(gateGroup);
}

// Шлагбаум поперек проезда с запада на восток (поперек Z)
function addBarrierGateRotated(group, x, z, roadWidth = 5.0) {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(x, 0, z - roadWidth / 2 + 0.3);

    const postGeom = new THREE.BoxGeometry(0.35, 1.1, 0.35);
    const postMesh = new THREE.Mesh(postGeom, MATERIALS.signBlue);
    postMesh.position.y = 0.55;
    postMesh.castShadow = true;
    gateGroup.add(postMesh);

    const armLen = roadWidth - 0.8;
    const armGeom = new THREE.BoxGeometry(0.05, 0.08, armLen);
    const armMesh = new THREE.Mesh(armGeom, MATERIALS.signWhite);
    armMesh.position.set(0, 0.9, armLen / 2 + 0.15);
    gateGroup.add(armMesh);

    const stripeCount = 4;
    for (let i = 0; i < stripeCount; i++) {
        const sGeom = new THREE.BoxGeometry(0.06, 0.09, armLen / (stripeCount * 2));
        const sMesh = new THREE.Mesh(sGeom, MATERIALS.signRed);
        sMesh.position.set(0, 0.9, 0.25 + (i * 2 + 1) * (armLen / (stripeCount * 2)));
        gateGroup.add(sMesh);
    }

    group.add(gateGroup);
}

function addPedestrianCrossingSign(group, x, z, rotY = 0) {
    const signGroup = new THREE.Group();
    signGroup.position.set(x, 0, z);
    signGroup.rotation.y = rotY;

    // 1. Оцинкованная цилиндрическая стойка (18 сегментов)
    const poleH = 3.2;
    const poleGeom = new THREE.CylinderGeometry(0.038, 0.038, poleH, 18);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    signGroup.add(poleMesh);

    // 2. Литой опорный фланец с анкерами в основании
    const flangeGeom = new THREE.CylinderGeometry(0.075, 0.09, 0.08, 18);
    const flangeMesh = new THREE.Mesh(flangeGeom, MATERIALS.poleMetal);
    flangeMesh.position.y = 0.04;
    signGroup.add(flangeMesh);

    const plateGeom = new THREE.BoxGeometry(0.18, 0.02, 0.18);
    const plateMesh = new THREE.Mesh(plateGeom, MATERIALS.poleMetal);
    plateMesh.position.y = 0.01;
    signGroup.add(plateMesh);

    // 3. Верхний защитный колпак стойки
    const capGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.025, 18);
    const capMesh = new THREE.Mesh(capGeom, MATERIALS.poleMetal);
    capMesh.position.y = poleH + 0.012;
    signGroup.add(capMesh);

    // 4. Хомуты крепления на стойку и монтажные кронштейны
    const clampGeom = new THREE.CylinderGeometry(0.044, 0.044, 0.035, 16);
    const clampTop = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clampTop.position.set(0, 2.85, 0);
    signGroup.add(clampTop);

    const clampBot = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clampBot.position.set(0, 2.45, 0);
    signGroup.add(clampBot);

    // Выносные кронштейны-проставки (смещают щит знака вперед от стойки: стойка Z in [-0.038, 0.038], щит Z >= 0.050)
    const standoffGeom = new THREE.BoxGeometry(0.04, 0.03, 0.055);
    const standoffTop = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoffTop.position.set(0, 2.85, 0.025);
    signGroup.add(standoffTop);

    const standoffBot = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoffBot.position.set(0, 2.45, 0.025);
    signGroup.add(standoffBot);

    // Горизонтальные монтажные траверсы
    const railGeom = new THREE.BoxGeometry(0.60, 0.03, 0.02);
    const railTop = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railTop.position.set(0, 2.85, 0.050);
    signGroup.add(railTop);

    const railBot = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railBot.position.set(0, 2.45, 0.050);
    signGroup.add(railBot);

    // 6. Основной синий корпус знака 5.19
    const trayGeom = new THREE.BoxGeometry(0.605, 0.605, 0.014);
    const trayMesh = new THREE.Mesh(trayGeom, MATERIALS.signBlue);
    trayMesh.position.set(0, 2.65, 0.060);
    signGroup.add(trayMesh);

    // 7. Лицевая панель с векторным силуэтом пешехода (СТБ 5.19)
    const faceGeom = new THREE.PlaneGeometry(0.60, 0.60);
    const faceMat = MATERIALS.pedestrianSign || MATERIALS.signBlue;
    const faceMesh = new THREE.Mesh(faceGeom, faceMat);
    faceMesh.position.set(0, 2.65, 0.078);
    signGroup.add(faceMesh);

    // 8. Обратная сторона знака (двусторонний знак для встречного потока)
    const backFaceMat = MATERIALS.pedestrianSignRight || MATERIALS.pedestrianSign || MATERIALS.signBlue;
    const backFaceMesh = new THREE.Mesh(faceGeom, backFaceMat);
    backFaceMesh.rotation.y = Math.PI;
    backFaceMesh.position.set(0, 2.65, 0.042);
    signGroup.add(backFaceMesh);

    group.add(signGroup);
}

function addBusStopSign(group, x, z) {
    const signGroup = new THREE.Group();
    signGroup.position.set(x, 0, z);

    // 1. Оцинкованная цилиндрическая стойка (18 сегментов)
    const poleH = 3.1;
    const poleGeom = new THREE.CylinderGeometry(0.038, 0.038, poleH, 18);
    const poleMesh = new THREE.Mesh(poleGeom, MATERIALS.poleMetal);
    poleMesh.position.y = poleH / 2;
    poleMesh.castShadow = true;
    signGroup.add(poleMesh);

    // 2. Литой опорный фланец с анкерными болтами в основании
    const flangeGeom = new THREE.CylinderGeometry(0.075, 0.09, 0.08, 18);
    const flangeMesh = new THREE.Mesh(flangeGeom, MATERIALS.poleMetal);
    flangeMesh.position.y = 0.04;
    signGroup.add(flangeMesh);

    const plateGeom = new THREE.BoxGeometry(0.18, 0.02, 0.18);
    const plateMesh = new THREE.Mesh(plateGeom, MATERIALS.poleMetal);
    plateMesh.position.y = 0.01;
    signGroup.add(plateMesh);

    // 3. Верхний защитный колпак стойки
    const capGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.025, 18);
    const capMesh = new THREE.Mesh(capGeom, MATERIALS.poleMetal);
    capMesh.position.y = poleH + 0.012;
    signGroup.add(capMesh);

    // 4. Хомуты крепления на стойку и монтажные кронштейны
    const clampGeom = new THREE.CylinderGeometry(0.044, 0.044, 0.035, 16);
    const clamp1 = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clamp1.position.set(0, 2.75, 0);
    signGroup.add(clamp1);

    const clamp2 = new THREE.Mesh(clampGeom, MATERIALS.poleMetal);
    clamp2.position.set(0, 2.35, 0);
    signGroup.add(clamp2);

    // Выносные кронштейны-проставки (смещают щит вперед от стойки)
    const standoffGeom = new THREE.BoxGeometry(0.04, 0.03, 0.055);
    const standoff1 = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoff1.position.set(0, 2.75, 0.025);
    signGroup.add(standoff1);

    const standoff2 = new THREE.Mesh(standoffGeom, MATERIALS.poleMetal);
    standoff2.position.set(0, 2.35, 0.025);
    signGroup.add(standoff2);

    // Горизонтальные монтажные рейки
    const railGeom = new THREE.BoxGeometry(0.48, 0.03, 0.02);
    const railTop = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railTop.position.set(0, 2.75, 0.050);
    signGroup.add(railTop);

    const railBot = new THREE.Mesh(railGeom, MATERIALS.poleMetal);
    railBot.position.set(0, 2.35, 0.050);
    signGroup.add(railBot);

    // 5. Алюминиевый короб знака с отбортовкой
    const trayGeom = new THREE.BoxGeometry(0.52, 0.76, 0.018);
    const trayMesh = new THREE.Mesh(trayGeom, MATERIALS.signBlue);
    trayMesh.position.set(0, 2.55, 0.062);
    trayMesh.castShadow = true;
    signGroup.add(trayMesh);

    // 6. Лицевая панель со знаком СТБ 5.16 «Остановка автобуса»
    const faceGeom = new THREE.PlaneGeometry(0.50, 0.74);
    const faceMat = MATERIALS.busStopSign || MATERIALS.signBlue;
    const faceMesh = new THREE.Mesh(faceGeom, faceMat);
    faceMesh.position.set(0, 2.55, 0.072);
    signGroup.add(faceMesh);

    // Двусторонняя видимость знака для пассажиров на платформе
    const backFaceMesh = new THREE.Mesh(faceGeom, faceMat);
    backFaceMesh.rotation.y = Math.PI;
    backFaceMesh.position.set(0, 2.55, 0.051);
    signGroup.add(backFaceMesh);

    // Timetable on sign post removed per user request (only standard sign 5.16)
    group.add(signGroup);
}

