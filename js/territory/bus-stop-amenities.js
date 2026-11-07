function buildShelterGlazingAndAmenities(shelterGroup, w, h, d, frameMat, steelMat, glassMat, benchWoodMat, benchLegMat) {
    // ----------------------------------------------------
    // 4. ПАНОРАМНОЕ ОСТЕКЛЕНИЕ И АРХИТЕКТУРНЫЕ СПАЙДЕРНЫЕ УЗЛЫ
    // ----------------------------------------------------
    const glassH = h - 0.35; // 2.35 м
    const wallGlassThick = 0.012;

    function addSpiderFitting(parent, sx, sy, sz, is2Arm = false) {
        const fittingGroup = new THREE.Group();
        fittingGroup.position.set(sx, sy, sz);

        // Хомут на стойку
        const clampGeom = new THREE.CylinderGeometry(0.058, 0.058, 0.045, 20);
        const clamp = new THREE.Mesh(clampGeom, steelMat);
        fittingGroup.add(clamp);

        // Выносной шток-бобышка
        const stemGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.06, 14);
        const stem = new THREE.Mesh(stemGeom, steelMat);
        stem.rotation.x = Math.PI / 2;
        stem.position.set(0, 0, 0.04);
        fittingGroup.add(stem);

        // Центральный диск спайдера
        const hubGeom = new THREE.CylinderGeometry(0.032, 0.032, 0.016, 16);
        const hub = new THREE.Mesh(hubGeom, steelMat);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(0, 0, 0.07);
        fittingGroup.add(hub);

        // Лучи спайдера
        const angles = is2Arm ? [Math.PI / 4, 7 * Math.PI / 4] : [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
        const armLen = 0.09;
        const armGeom = new THREE.CylinderGeometry(0.007, 0.011, armLen, 8);
        const rotuleGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16);
        const boltHoleGeom = new THREE.CylinderGeometry(0.006, 0.006, 0.014, 6);

        angles.forEach(ang => {
            const dx = Math.cos(ang) * armLen * 0.75;
            const dy = Math.sin(ang) * armLen * 0.75;

            const arm = new THREE.Mesh(armGeom, steelMat);
            arm.position.set(dx / 2, dy / 2, 0.07);
            arm.rotation.z = ang - Math.PI / 2;
            fittingGroup.add(arm);

            // Ротула крепления к стеклу с шестигранным шлицем
            const rotule = new THREE.Mesh(rotuleGeom, steelMat);
            rotule.rotation.x = Math.PI / 2;
            rotule.position.set(dx, dy, 0.076);
            fittingGroup.add(rotule);

            const bHole = new THREE.Mesh(boltHoleGeom, frameMat);
            bHole.rotation.x = Math.PI / 2;
            bHole.position.set(dx, dy, 0.082);
            fittingGroup.add(bHole);
        });

        parent.add(fittingGroup);
    }

    // Заднее панорамное остекление (3 панели)
    const rearBayW = (w - 0.40) / 3;
    const rearGlassGeom = new THREE.BoxGeometry(rearBayW - 0.02, glassH, wallGlassThick);
    const rearGlassXs = [-rearBayW, 0, rearBayW];

    rearGlassXs.forEach(gx => {
        const rGlass = new THREE.Mesh(rearGlassGeom, glassMat);
        rGlass.position.set(gx, glassH / 2 + 0.12, -d / 2 + 0.15);
        shelterGroup.add(rGlass);
    });

    // 4-точечные спайдеры на центральных задних колоннах
    addSpiderFitting(shelterGroup, -1.30, 0.75, -d / 2 + 0.15);
    addSpiderFitting(shelterGroup, -1.30, 1.85, -d / 2 + 0.15);
    addSpiderFitting(shelterGroup, 1.30, 0.75, -d / 2 + 0.15);
    addSpiderFitting(shelterGroup, 1.30, 1.85, -d / 2 + 0.15);

    // Боковые ветрозащитные стекла
    const sideGlassW = d - 0.30;
    const sideGlassGeom = new THREE.BoxGeometry(wallGlassThick, glassH, sideGlassW);

    const sideLeft = new THREE.Mesh(sideGlassGeom, glassMat);
    sideLeft.position.set(-w / 2 + 0.15, glassH / 2 + 0.12, 0);
    shelterGroup.add(sideLeft);

    const sideRight = new THREE.Mesh(sideGlassGeom, glassMat);
    sideRight.position.set(w / 2 - 0.15, glassH / 2 + 0.12, 0);
    shelterGroup.add(sideRight);

    // Боковые стекла без выступающих круглых спайдеров

    // ----------------------------------------------------
    // 5. ИНФОРМАЦИОННЫЕ ТАБЛИЧКИ РАСПИСАНИЙ МИНСКТРАНС (3 СТЕНДА)
    // ----------------------------------------------------
    // Стенд 1 (X = -0.80): Троллейбусы 19, 19п (горизонтальная эмалированная табличка 1.6:1)
    // Стенд 2 (X =  0.00): Троллейбусы 27, 27п, 82, 82п
    // Стенд 3 (X = +0.80): Автобусы 40, 107 (строго между колоннами X=±1.30 без пересечений)
    const boardW = 0.76;
    const boardH = 0.475;
    const boardD = 0.015;
    const boardZ = -d / 2 + 0.17;
    const boardY = 1.45;

    const boardBackGeom = new THREE.BoxGeometry(boardW, boardH, boardD);
    const boardFaceGeom = new THREE.PlaneGeometry(boardW - 0.02, boardH - 0.02);
    const coverGlassGeom = new THREE.PlaneGeometry(boardW - 0.015, boardH - 0.015);

    const boardsConfig = [
        { x: -0.80, mat: MATERIALS.trolleybusTimetable1 || MATERIALS.busTimetable },
        { x:  0.00, mat: MATERIALS.trolleybusTimetable2 || MATERIALS.busTimetable },
        { x:  0.80, mat: MATERIALS.busTimetable }
    ];

    let vitrineBox = null;
    let vitrineFace = null;
    let coverGlass = null;

    boardsConfig.forEach(cfg => {
        const box = new THREE.Mesh(boardBackGeom, frameMat);
        box.position.set(cfg.x, boardY, boardZ);
        box.castShadow = true;
        shelterGroup.add(box);
        if (cfg.x === 0.00) vitrineBox = box;

        const face = new THREE.Mesh(boardFaceGeom, cfg.mat);
        face.position.set(cfg.x, boardY, boardZ + boardD / 2 + 0.001);
        shelterGroup.add(face);
        if (cfg.x === 0.00) vitrineFace = face;

        const cover = new THREE.Mesh(coverGlassGeom, glassMat);
        cover.position.set(cfg.x, boardY, boardZ + boardD / 2 + 0.003);
        shelterGroup.add(cover);
        if (cfg.x === 0.00) coverGlass = cover;
    });

    // ----------------------------------------------------
    // 6. ЭРГОНОМИЧНЫЕ СКАМЬИ С ДЕРЕВЯННЫМИ ЛАМЕЛЯМИ И ПОДЛОКОТНИКАМИ
    // ----------------------------------------------------
    function buildErgonomicBench(parent, benchX, benchLen = 2.80) {
        const benchGroup = new THREE.Group();
        benchGroup.position.set(benchX, 0, -d / 2 + 0.52);

        const seatH = 0.46;
        const seatDepth = 0.46;
        const slatThickness = 0.032;
        const slatWidth = 0.068;
        const numSlats = 5;

        // 5 продольных ламелей сиденья
        const slatGeom = new THREE.BoxGeometry(benchLen, slatThickness, slatWidth);
        for (let s = 0; s < numSlats; s++) {
            const slat = new THREE.Mesh(slatGeom, benchWoodMat);
            const sz = (s - (numSlats - 1) / 2) * (slatWidth + 0.012);
            slat.position.set(0, seatH, sz);
            slat.castShadow = true;
            benchGroup.add(slat);
        }

        // 2 наклонные ламели спинки
        const backSlatGeom = new THREE.BoxGeometry(benchLen, slatWidth, slatThickness);
        for (let b = 0; b < 2; b++) {
            const backSlat = new THREE.Mesh(backSlatGeom, benchWoodMat);
            const by = seatH + 0.20 + b * (slatWidth + 0.018);
            const bz = -seatDepth / 2 - 0.03 - b * 0.035;
            backSlat.position.set(0, by, bz);
            backSlat.rotation.x = -0.24; // 14 градусов эргономичный наклон
            backSlat.castShadow = true;
            benchGroup.add(backSlat);
        }

        // 3 изогнутые стальные опоры с подлокотниками
        const legXs = [-benchLen / 2 + 0.20, 0, benchLen / 2 - 0.20];
        legXs.forEach((lx, idx) => {
            // Опорная пятка
            const footGeom = new THREE.BoxGeometry(0.16, 0.016, 0.16);
            const footMesh = new THREE.Mesh(footGeom, benchLegMat);
            footMesh.position.set(lx, 0.008, 0);
            footMesh.receiveShadow = true;
            benchGroup.add(footMesh);

            // Вертикальная стойка
            const legGeom = new THREE.BoxGeometry(0.05, seatH, 0.05);
            const legMesh = new THREE.Mesh(legGeom, benchLegMat);
            legMesh.position.set(lx, seatH / 2, 0);
            legMesh.castShadow = true;
            benchGroup.add(legMesh);

            // Консоль сиденья
            const barGeom = new THREE.BoxGeometry(0.045, 0.035, seatDepth);
            const barMesh = new THREE.Mesh(barGeom, benchLegMat);
            barMesh.position.set(lx, seatH - slatThickness / 2 - 0.018, 0);
            benchGroup.add(barMesh);

            // Стойка спинки
            const backPostGeom = new THREE.BoxGeometry(0.045, 0.36, 0.035);
            const backPost = new THREE.Mesh(backPostGeom, benchLegMat);
            backPost.position.set(lx, seatH + 0.20, -seatDepth / 2 - 0.04);
            backPost.rotation.x = -0.24;
            benchGroup.add(backPost);

            // Арочный подлокотник на крайних опорах
            if (idx === 0 || idx === 2) {
                const armGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.28, 14);
                const armMesh = new THREE.Mesh(armGeom, steelMat);
                armMesh.rotation.x = Math.PI / 2;
                armMesh.position.set(lx, seatH + 0.18, 0.02);
                benchGroup.add(armMesh);
            }
        });

        parent.add(benchGroup);
    }



    // ----------------------------------------------------
    // 7. СОВРЕМЕННЫЕ УРНЫ ИЗ ШЛИФОВАННОЙ НЕРЖАВЕЮЩЕЙ СТАЛИ
    // ----------------------------------------------------
    function buildModernWasteBin(parent, bx, bz) {
        const binGroup = new THREE.Group();
        binGroup.position.set(bx, 0, bz);

        const binH = 0.78;
        const binR = 0.19;

        // Корпус из шлифованной стали
        const bodyGeom = new THREE.CylinderGeometry(binR, binR, binH, 24);
        const bodyMesh = new THREE.Mesh(bodyGeom, steelMat);
        bodyMesh.position.y = binH / 2 + 0.04;
        bodyMesh.castShadow = true;
        binGroup.add(bodyMesh);

        // Цоколь
        const plinthGeom = new THREE.CylinderGeometry(binR * 0.85, binR * 0.85, 0.04, 20);
        const plinthMesh = new THREE.Mesh(plinthGeom, frameMat);
        plinthMesh.position.y = 0.02;
        binGroup.add(plinthMesh);

        // Куполообразная крышка от дождя
        const domeGeom = new THREE.CylinderGeometry(binR + 0.01, binR + 0.02, 0.06, 24);
        const domeMesh = new THREE.Mesh(domeGeom, steelMat);
        domeMesh.position.y = binH + 0.07;
        binGroup.add(domeMesh);

        // Окно для сброса мусора с отбортовкой
        const slotGeom = new THREE.BoxGeometry(0.22, 0.12, 0.06);
        const slotMesh = new THREE.Mesh(slotGeom, frameMat);
        slotMesh.position.set(0, binH - 0.08, binR - 0.02);
        binGroup.add(slotMesh);

        // Внутренний видимый оцинкованный вкладыш
        const linerLipGeom = new THREE.CylinderGeometry(binR - 0.015, binR - 0.015, 0.02, 20);
        const linerLip = new THREE.Mesh(linerLipGeom, steelMat);
        linerLip.position.y = binH + 0.035;
        binGroup.add(linerLip);

        // Пепельница-гаситель окурков
        const ashtrayGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 16);
        const ashtray = new THREE.Mesh(ashtrayGeom, steelMat);
        ashtray.position.set(0, binH + 0.105, 0);
        binGroup.add(ashtray);

        parent.add(binGroup);
    }

    buildModernWasteBin(shelterGroup, -w / 2 - 0.45, d / 2 - 0.30);
    buildModernWasteBin(shelterGroup, w / 2 + 0.45, d / 2 - 0.30);
}
