function createBirchClusterGeometry(baseR, scaleX = 1.0, scaleY = 1.0, scaleZ = 1.0, droop = 0.25) {
    const geom = new THREE.IcosahedronGeometry(baseR, 3);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len > 0.0001) {
            const phi = Math.atan2(z, x);
            const theta = Math.acos(Math.max(-1, Math.min(1, y / len)));
            const noise = 1.0 + 0.14 * Math.sin(3 * theta + 2 * phi) + 0.10 * Math.cos(4 * phi - theta) + 0.05 * Math.sin(5 * theta);
            x = (x / len) * baseR * noise * scaleX;
            y = (y / len) * baseR * noise * scaleY;
            z = (z / len) * baseR * noise * scaleZ;
            if (y < 0) {
                y -= Math.abs(y) * droop;
            }
            pos.setXYZ(i, x, y, z);
        }
    }
    geom.computeVertexNormals();
    return geom;
}

let _cachedBirchGeoms = null;
function getBaseBirchGeometries() {
    if (_cachedBirchGeoms) return _cachedBirchGeoms;
    const scale = 1.0;
    const trunkH = 5.2;
    const radialSegs = 12;
    const heightSegs = 16;
    const rBase = 0.14;
    const rTop = 0.035;

    const trunkGeom = new THREE.CylinderGeometry(rTop, rBase, trunkH, radialSegs, heightSegs);
    const tPos = trunkGeom.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
        const yOrig = tPos.getY(i);
        const t = (yOrig + trunkH / 2) / trunkH;
        let x = tPos.getX(i);
        let z = tPos.getZ(i);

        if (t < 0.18) {
            const flare = Math.pow(1.0 - t / 0.18, 2) * 0.065;
            const curR = Math.sqrt(x * x + z * z);
            if (curR > 0.0001) {
                x += (x / curR) * flare;
                z += (z / curR) * flare;
            }
        }

        const dx = (0.22 * Math.sin(Math.PI * t * 0.85) + 0.10 * t * t);
        const dz = (0.15 * Math.sin(Math.PI * t * 1.20) - 0.06 * t);
        tPos.setXYZ(i, x + dx, yOrig, z + dz);
    }
    trunkGeom.computeVertexNormals();
    trunkGeom.translate(0, trunkH / 2, 0);

    const woodGeometries = [trunkGeom];

    function addLimb(tNorm, azimuth, pitchDeg, length, bRadius, tipRadius, curveDroop = 0.15) {
        const yStart = tNorm * trunkH;
        const dxStart = (0.22 * Math.sin(Math.PI * tNorm * 0.85) + 0.10 * tNorm * tNorm);
        const dzStart = (0.15 * Math.sin(Math.PI * tNorm * 1.20) - 0.06 * tNorm);

        const bGeom = new THREE.CylinderGeometry(tipRadius, bRadius, length, 8, 4);
        const bp = bGeom.attributes.position;
        for (let i = 0; i < bp.count; i++) {
            const s = (bp.getY(i) + length / 2) / length;
            const droopOff = Math.sin(s * Math.PI) * curveDroop;
            bp.setZ(i, bp.getZ(i) - droopOff);
        }
        bGeom.computeVertexNormals();
        bGeom.translate(0, length / 2, 0);

        const pitchRad = (pitchDeg * Math.PI) / 180;
        bGeom.rotateX(Math.PI / 2 - pitchRad);
        bGeom.rotateY(azimuth);
        bGeom.translate(dxStart, yStart, dzStart);

        woodGeometries.push(bGeom);
    }

    addLimb(0.42, 0.25, 48, 1.85, 0.038, 0.016, 0.18);
    addLimb(0.58, 2.15, 52, 1.60, 0.032, 0.014, 0.15);
    addLimb(0.70, 4.10, 58, 1.35, 0.026, 0.012, 0.12);
    addLimb(0.82, 5.70, 64, 1.10, 0.022, 0.010, 0.09);

    const lightClusters = [];
    const darkClusters = [];

    const c1 = createBirchClusterGeometry(0.95, 0.88, 1.25, 0.88, 0.15);
    c1.translate(0.18, 5.0, -0.12);
    lightClusters.push(c1);

    const c2 = createBirchClusterGeometry(0.90, 1.05, 0.85, 1.00, 0.28);
    c2.translate(0.80, 4.35, -0.45);
    lightClusters.push(c2);

    const c3 = createBirchClusterGeometry(1.10, 1.10, 0.85, 1.05, 0.25);
    c3.translate(-0.85, 3.80, 0.55);
    darkClusters.push(c3);

    const c4 = createBirchClusterGeometry(1.15, 1.05, 0.90, 1.10, 0.22);
    c4.translate(0.35, 3.60, 0.85);
    darkClusters.push(c4);

    const c5 = createBirchClusterGeometry(1.05, 1.15, 0.78, 1.10, 0.35);
    c5.translate(1.35, 2.75, 0.25);
    lightClusters.push(c5);

    const c6 = createBirchClusterGeometry(1.00, 1.12, 0.80, 1.08, 0.35);
    c6.translate(-1.20, 2.55, -0.45);
    lightClusters.push(c6);

    const c7 = createBirchClusterGeometry(1.25, 1.10, 0.95, 1.10, 0.18);
    c7.translate(0.05, 3.30, 0.05);
    darkClusters.push(c7);

    _cachedBirchGeoms = {
        wood: mergeBufferGeometriesVanilla(woodGeometries),
        lightFoliage: mergeBufferGeometriesVanilla(lightClusters),
        darkFoliage: mergeBufferGeometriesVanilla(darkClusters)
    };
    return _cachedBirchGeoms;
}

function createWhiteBirchTree(scale = 1.0, rotY = 0) {
    const treeGroup = new THREE.Group();
    treeGroup.rotation.y = rotY;
    treeGroup.scale.set(scale, scale, scale);

    const geoms = getBaseBirchGeometries();
    const trunkMesh = new THREE.Mesh(geoms.wood, MATERIALS.birchBark || MATERIALS.treeTrunk);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    const lightMesh = new THREE.Mesh(geoms.lightFoliage, MATERIALS.birchFoliageLight || MATERIALS.treeFoliageLight);
    lightMesh.castShadow = true;
    lightMesh.receiveShadow = true;
    treeGroup.add(lightMesh);

    const darkMesh = new THREE.Mesh(geoms.darkFoliage, MATERIALS.birchFoliage || MATERIALS.treeFoliage);
    darkMesh.castShadow = true;
    darkMesh.receiveShadow = true;
    treeGroup.add(darkMesh);

    return treeGroup;
}

function addBirchTree(group, x, z, scale = 1.0, rotY = 0, y = 0) {
    const tree = createWhiteBirchTree(scale, rotY);
    tree.position.set(x, y, z);
    group.add(tree);
    return tree;
}

// ----------------------------------------------------
// 2. ЛИПА МЕЛКОЛИСТНАЯ (TILIA CORDATA)
// ----------------------------------------------------

function createOrganicFoliageClusterGeometry(radius, detail = 2, seed = 0) {
    const geom = new THREE.DodecahedronGeometry(radius, detail);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const noise = Math.sin(vx * 2.6 + seed) * Math.cos(vy * 2.9 + seed * 1.3) * Math.sin(vz * 2.7)
                    + 0.35 * Math.sin(vx * 5.2 - seed) * Math.cos(vz * 5.5 + seed * 0.7);
        const factor = 1.0 + 0.12 * noise - 0.05 * (vy / radius);
        pos.setXYZ(i, vx * factor, vy * factor * 0.88, vz * factor);
    }
    geom.computeVertexNormals();
    return geom;
}

function addLindenTree(group, x, z, scale = 1.0, seed = 0, y = 0) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    // Ствол и скелетные ветви
    const flareH = 0.45 * scale;
    const flareGeom = new THREE.CylinderGeometry(0.20 * scale, 0.36 * scale, flareH, 14);
    flareGeom.translate(0, flareH / 2, 0);

    const trunkH = 1.75 * scale;
    const trunkGeom = new THREE.CylinderGeometry(0.16 * scale, 0.20 * scale, trunkH, 14);
    trunkGeom.rotateZ(-0.025);
    trunkGeom.translate(0.02 * scale, flareH + trunkH / 2, 0.01 * scale);

    const crotchY = flareH + trunkH;
    const boughs = [
        { az: 0.6,  elev: 0.75, len: 1.55 * scale, r: 0.10 * scale },
        { az: 2.2,  elev: 0.68, len: 1.65 * scale, r: 0.11 * scale },
        { az: 3.9,  elev: 0.78, len: 1.45 * scale, r: 0.095 * scale },
        { az: 5.4,  elev: 0.85, len: 1.75 * scale, r: 0.105 * scale }
    ];

    const woodGeoms = [flareGeom, trunkGeom];
    boughs.forEach(b => {
        const bGeom = new THREE.CylinderGeometry(b.r * 0.55, b.r, b.len, 10);
        bGeom.translate(0, b.len / 2, 0);
        bGeom.rotateZ(Math.PI / 2 - b.elev);
        bGeom.rotateY(-b.az);
        bGeom.translate(
            Math.cos(b.az) * (b.len * 0.42 * Math.cos(b.elev)),
            crotchY + b.len * 0.48 * Math.sin(b.elev),
            Math.sin(b.az) * (b.len * 0.42 * Math.cos(b.elev))
        );
        woodGeoms.push(bGeom);
    });

    const mergedWood = mergeBufferGeometriesVanilla(woodGeoms);
    const trunkMesh = new THREE.Mesh(mergedWood, MATERIALS.lindenTrunk || MATERIALS.treeTrunk);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // Многоярусная крона (7 облаков листвы с повышенной детализацией)
    const lightClusters = [];
    const darkClusters = [];

    const clusters = [
        { x: 0.0, y: 4.6 * scale, z: 0.0, r: 1.60 * scale, isDark: false, s: 1 },
        { x:  1.20 * scale, y: 3.7 * scale, z: -0.70 * scale, r: 1.35 * scale, isDark: false, s: 2 },
        { x:  1.30 * scale, y: 3.5 * scale, z:  0.90 * scale, r: 1.40 * scale, isDark: false, s: 3 },
        { x: -1.10 * scale, y: 3.6 * scale, z:  1.05 * scale, r: 1.30 * scale, isDark: false, s: 4 },
        { x: -1.25 * scale, y: 3.8 * scale, z: -0.60 * scale, r: 1.25 * scale, isDark: false, s: 5 },
        { x:  0.20 * scale, y: 2.8 * scale, z:  1.35 * scale, r: 1.10 * scale, isDark: true,  s: 6 },
        { x: -0.80 * scale, y: 2.9 * scale, z: -1.10 * scale, r: 1.05 * scale, isDark: true,  s: 7 }
    ];

    clusters.forEach(c => {
        const cGeom = createOrganicFoliageClusterGeometry(c.r, 2, c.s + seed);
        cGeom.rotateY((c.s * 1.7) + seed);
        cGeom.translate(c.x, c.y, c.z);
        if (c.isDark) darkClusters.push(cGeom);
        else lightClusters.push(cGeom);
    });

    if (lightClusters.length > 0) {
        const mergedLight = mergeBufferGeometriesVanilla(lightClusters);
        const lightMesh = new THREE.Mesh(mergedLight, MATERIALS.lindenFoliage || MATERIALS.treeFoliage);
        lightMesh.castShadow = true;
        lightMesh.receiveShadow = true;
        treeGroup.add(lightMesh);
    }
    if (darkClusters.length > 0) {
        const mergedDark = mergeBufferGeometriesVanilla(darkClusters);
        const darkMesh = new THREE.Mesh(mergedDark, MATERIALS.lindenFoliageDark || MATERIALS.treeFoliage);
        darkMesh.castShadow = true;
        darkMesh.receiveShadow = true;
        treeGroup.add(darkMesh);
    }

    group.add(treeGroup);
    return treeGroup;
}

window.createWhiteBirchTree = createWhiteBirchTree;
window.addBirchTree = addBirchTree;
window.addLindenTree = addLindenTree;

// ----------------------------------------------------
// 3. ЕЛЬ ОБЫКНОВЕННАЯ (PICEA ABIES)
// ----------------------------------------------------
