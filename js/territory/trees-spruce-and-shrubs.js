function createSpruceTierGeometry(baseRadius, height, numLobes, droopAmount, rotationOffset = 0) {
    const radialSegs = Math.max(36, numLobes * 6);
    const heightSegs = 6;
    const geom = new THREE.ConeGeometry(baseRadius, height, radialSegs, heightSegs, true);
    const pos = geom.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        const vFactor = THREE.MathUtils.clamp((height / 2 - y) / height, 0.0, 1.0);
        if (vFactor > 0.05) {
            const angle = Math.atan2(z, x) + rotationOffset;
            const r = Math.hypot(x, z);

            const lobeMod = 1.0 + 0.22 * Math.cos(numLobes * angle);
            const droop = droopAmount * Math.pow(vFactor, 1.8) * (0.7 + 0.3 * Math.cos(numLobes * angle));

            const newR = r * lobeMod;
            x = newR * Math.cos(angle - rotationOffset);
            z = newR * Math.sin(angle - rotationOffset);
            y -= droop;

            pos.setXYZ(i, x, y, z);
        }
    }
    geom.computeVertexNormals();
    return geom;
}

function addSpruceTree(group, x, z, scale = 1.0, seed = 0, y = 0) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    // Ствол и шейка
    const trunkH = 7.2 * scale;
    const trunkGeom = new THREE.CylinderGeometry(0.05 * scale, 0.22 * scale, trunkH, 12);
    trunkGeom.translate(0, trunkH / 2, 0);

    const collarH = 0.30 * scale;
    const collarGeom = new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, collarH, 12);
    collarGeom.translate(0, collarH / 2, 0);

    const mergedTrunk = mergeBufferGeometriesVanilla([collarGeom, trunkGeom]);
    const trunkMesh = new THREE.Mesh(mergedTrunk, MATERIALS.spruceTrunk || MATERIALS.treeTrunk);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // 6 ярусов хвои
    const darkTiers = [];
    const mainTiers = [];

    const tiers = [
        { y: 1.35 * scale, h: 1.45 * scale, r: 2.10 * scale, lobes: 8, droop: 0.35 * scale, rot: 0.1, isDark: true },
        { y: 2.45 * scale, h: 1.35 * scale, r: 1.80 * scale, lobes: 8, droop: 0.30 * scale, rot: 0.5, isDark: true },
        { y: 3.55 * scale, h: 1.25 * scale, r: 1.45 * scale, lobes: 7, droop: 0.24 * scale, rot: 0.9, isDark: false },
        { y: 4.65 * scale, h: 1.15 * scale, r: 1.10 * scale, lobes: 7, droop: 0.18 * scale, rot: 1.4, isDark: false },
        { y: 5.70 * scale, h: 1.00 * scale, r: 0.75 * scale, lobes: 6, droop: 0.12 * scale, rot: 1.9, isDark: false },
        { y: 6.55 * scale, h: 0.85 * scale, r: 0.44 * scale, lobes: 6, droop: 0.07 * scale, rot: 2.4, isDark: false }
    ];

    tiers.forEach(t => {
        const tGeom = createSpruceTierGeometry(t.r, t.h, t.lobes, t.droop, t.rot + seed);
        tGeom.translate(0, t.y + t.h / 2, 0);
        if (t.isDark) darkTiers.push(tGeom);
        else mainTiers.push(tGeom);
    });

    // Вершинный побег (apical spire)
    const spireH = 0.65 * scale;
    const spireGeom = new THREE.ConeGeometry(0.16 * scale, spireH, 8);
    spireGeom.translate(0, 7.15 * scale + spireH / 2, 0);
    mainTiers.push(spireGeom);

    const mergedDarkTiers = mergeBufferGeometriesVanilla(darkTiers);
    const darkTierMesh = new THREE.Mesh(mergedDarkTiers, MATERIALS.spruceNeedleDark || MATERIALS.treeFoliage);
    darkTierMesh.castShadow = true;
    darkTierMesh.receiveShadow = true;
    treeGroup.add(darkTierMesh);

    const mergedMainTiers = mergeBufferGeometriesVanilla(mainTiers);
    const mainTierMesh = new THREE.Mesh(mergedMainTiers, MATERIALS.spruceNeedle || MATERIALS.treeFoliage);
    mainTierMesh.castShadow = true;
    mainTierMesh.receiveShadow = true;
    treeGroup.add(mainTierMesh);

    group.add(treeGroup);
    return treeGroup;
}

// ----------------------------------------------------
// 4. ЖИВЫЕ ИЗГОРОДИ, ПРИСТВОЛЬНЫЕ КРУГИ И КУСТАРНИКИ
// ----------------------------------------------------

function addBotanicalHedgeSegment(group, x1, z1, x2, z2, height = 0.85, width = 0.55) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const angle = Math.atan2(dz, dx);

    const hedgeGroup = new THREE.Group();
    hedgeGroup.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    hedgeGroup.rotation.y = -angle;

    const xSegs = Math.max(4, Math.round(len * 3));
    const geom = new THREE.BoxGeometry(len, height, width, xSegs, 5, 4);
    const pos = geom.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);

        if (y > 0) {
            const zNorm = z / (width / 2);
            y -= (zNorm * zNorm) * 0.06;
            const noise = Math.sin(x * 8.5 + z * 12.0) * 0.032 + Math.cos(y * 11.0 + x * 5.5) * 0.022;
            pos.setX(i, x + noise * 0.4);
            pos.setY(i, y + Math.max(-0.02, noise));
            pos.setZ(i, z + noise * 0.4);
        }
    }
    geom.computeVertexNormals();
    geom.translate(0, height / 2, 0);

    const tuftCount = Math.max(3, Math.round(len * 2));
    const hedgeGeoms = [geom];
    for (let t = 0; t < tuftCount; t++) {
        const tuftGeom = new THREE.IcosahedronGeometry(0.14, 1);
        const tx = (((t * 17.3) % (len * 0.8)) - (len * 0.4));
        const tz = (((t * 31.1) % (width * 0.6)) - (width * 0.3));
        const ty = height - 0.02 + ((t * 7) % 10) * 0.008;
        tuftGeom.scale(0.9 + (t % 3) * 0.15, 0.8 + (t % 4) * 0.1, 0.9 + (t % 3) * 0.15);
        tuftGeom.translate(tx, ty, tz);
        hedgeGeoms.push(tuftGeom);
    }

    const mergedHedge = mergeBufferGeometriesVanilla(hedgeGeoms);
    const hedgeMesh = new THREE.Mesh(mergedHedge, MATERIALS.hedgeFoliage);
    hedgeMesh.castShadow = true;
    hedgeMesh.receiveShadow = true;
    hedgeGroup.add(hedgeMesh);

    group.add(hedgeGroup);
}

function addTreeRing(group, x, z, radius = 1.05, y = 0) {
    const ringGroup = new THREE.Group();
    ringGroup.position.set(x, y, z);

    // 1. Приподнятый каменный бордюр приствольного круга
    const ringGeom = new THREE.TorusGeometry(radius, 0.06, 8, 28);
    ringGeom.rotateX(Math.PI / 2);
    ringGeom.translate(0, 0.035, 0);
    const ringMesh = new THREE.Mesh(ringGeom, MATERIALS.curb);
    ringMesh.castShadow = true;
    ringMesh.receiveShadow = true;
    ringGroup.add(ringMesh);

    // 2. Слой органической коры / мульчи
    const mulchGeom = new THREE.CylinderGeometry(radius - 0.02, radius - 0.02, 0.04, 24);
    mulchGeom.translate(0, 0.02, 0);
    const mulchMesh = new THREE.Mesh(mulchGeom, MATERIALS.soilMulch);
    mulchMesh.receiveShadow = true;
    ringGroup.add(mulchMesh);

    // Buttress roots removed per user request (trees sit cleanly in mulch ring)
    group.add(ringGroup);
}

function addDecorativeShrub(group, x, z, type = 'flowering', scale = 1.0, y = 0) {
    const shrubGroup = new THREE.Group();
    shrubGroup.position.set(x, y, z);
    shrubGroup.scale.set(scale, scale, scale);

    if (type === 'flowering') {
        const stemCount = 4;
        const stemGeoms = [];
        for (let s = 0; s < stemCount; s++) {
            const angle = (s / stemCount) * Math.PI * 2 + 0.15;
            const stemGeom = new THREE.CylinderGeometry(0.014, 0.022, 0.42, 6);
            stemGeom.translate(0, 0.21, 0);
            stemGeom.rotateZ(Math.cos(angle) * 0.28);
            stemGeom.rotateX(Math.sin(angle) * 0.28);
            stemGeom.translate(Math.cos(angle) * 0.08, 0, Math.sin(angle) * 0.08);
            stemGeoms.push(stemGeom);
        }
        const mergedStems = mergeBufferGeometriesVanilla(stemGeoms);
        const stemsMesh = new THREE.Mesh(mergedStems, MATERIALS.treeTrunk);
        stemsMesh.castShadow = true;
        shrubGroup.add(stemsMesh);

        const clusterOffsets = [
            [0, 0.62, 0, 0.48],
            [0.26, 0.50, 0.18, 0.38],
            [-0.24, 0.52, -0.16, 0.39],
            [-0.20, 0.48, 0.22, 0.36],
            [0.22, 0.46, -0.22, 0.37]
        ];
        const foliageGeoms = [];
        const blossomGeoms = [];
        clusterOffsets.forEach(c => {
            const cGeom = new THREE.IcosahedronGeometry(c[3], 2);
            cGeom.translate(c[0], c[1], c[2]);
            foliageGeoms.push(cGeom);

            const bGeom = new THREE.SphereGeometry(c[3] * 0.35, 12, 10);
            bGeom.translate(c[0], c[1] + c[3] * 0.72, c[2]);
            blossomGeoms.push(bGeom);
        });

        const mergedFoliage = mergeBufferGeometriesVanilla(foliageGeoms);
        const foliageMesh = new THREE.Mesh(mergedFoliage, MATERIALS.shrubFoliageDeciduous);
        foliageMesh.castShadow = true;
        foliageMesh.receiveShadow = true;
        shrubGroup.add(foliageMesh);

    } else {
        const foliageGeoms = [];
        const tiers = 3;
        for (let t = 0; t < tiers; t++) {
            const r = 0.65 - t * 0.12;
            const y = 0.16 + t * 0.14;
            const tierGeom = new THREE.ConeGeometry(r, 0.22, 16);
            tierGeom.rotateY(t * 0.7);
            tierGeom.translate(0, y, 0);
            foliageGeoms.push(tierGeom);
        }
        const mergedConifer = mergeBufferGeometriesVanilla(foliageGeoms);
        const coniferMesh = new THREE.Mesh(mergedConifer, MATERIALS.shrubFoliageConifer);
        coniferMesh.castShadow = true;
        coniferMesh.receiveShadow = true;
        shrubGroup.add(coniferMesh);
    }

    group.add(shrubGroup);
}

// Универсальный диспетчер для обратной совместимости
function addArchitecturalTree(group, x, z, scale = 1.0, isRound = true) {
    if (isRound) {
        return addLindenTree(group, x, z, scale);
    } else {
        return addSpruceTree(group, x, z, scale);
    }
}

window.addSpruceTree = addSpruceTree;
window.addBotanicalHedgeSegment = addBotanicalHedgeSegment;
window.addTreeRing = addTreeRing;
window.addDecorativeShrub = addDecorativeShrub;
