function buildElevatorShaftCross(targetGroup, x1, z1, x2, z2) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;

    const geom = new THREE.BoxGeometry(w, 0.08, d);
    const mesh = new THREE.Mesh(geom, MATERIALS.elevatorCar);
    mesh.position.set(cx, 0.04, cz);
    mesh.userData.isInterior = true;
    targetGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geom);
    mesh.add(new THREE.LineSegments(edges, MATERIALS.edgeMain));

    const pts = [
        new THREE.Vector3(x1, 0.09, z1),
        new THREE.Vector3(x2, 0.09, z2),
        new THREE.Vector3(x2, 0.09, z1),
        new THREE.Vector3(x1, 0.09, z2)
    ];
    const crossGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const crossLine = new THREE.LineSegments(crossGeom, MATERIALS.edgeMain);
    crossLine.userData.isInterior = true;
    targetGroup.add(crossLine);
}


function addOutdoorPorchStep(targetGroup, geomOrW, dOrCx, cxOrCz, czOrYTop, yTopOrYBottom, maybeYBottom) {
    let geom, cx, cz, yTop, yBottom, stepH;
    const isBufferGeom = (geomOrW && typeof geomOrW === 'object' && geomOrW.isBufferGeometry);

    if (isBufferGeom) {
        geom = geomOrW;
        cx = dOrCx;
        cz = cxOrCz;
        yTop = czOrYTop;
        yBottom = yTopOrYBottom !== undefined ? yTopOrYBottom : -0.16;
        stepH = Math.max(0.02, yTop - yBottom);
    } else {
        const w = geomOrW;
        const d = dOrCx;
        cx = cxOrCz;
        cz = czOrYTop;
        yTop = yTopOrYBottom;
        yBottom = maybeYBottom !== undefined ? maybeYBottom : -0.16;
        stepH = Math.max(0.02, yTop - yBottom);
        geom = getCachedBoxGeometry(w, stepH, d);
    }

    const mesh = new THREE.Mesh(geom, MATERIALS.coreSlab);
    if (isBufferGeom) {
        mesh.scale.y = stepH;
    }
    mesh.position.set(cx, (yTop + yBottom) / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isInterior = false;
    mesh.userData.isExterior = true;
    mesh.userData.isStair = true;

    const edges = isBufferGeom ? new THREE.EdgesGeometry(geom) : getCachedEdgesGeometry(geom, geomOrW, stepH, dOrCx);
    const edgeLine = new THREE.LineSegments(edges, MATERIALS.edgeMain);
    edgeLine.userData.isInterior = false;
    edgeLine.userData.isExterior = true;
    edgeLine.userData.isStair = true;
    mesh.add(edgeLine);

    targetGroup.add(mesh);
}
window.addOutdoorPorchStep = addOutdoorPorchStep;

function registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, yOffset = 0, isExterior = false) {
    const mesh = new THREE.Mesh(geom, MATERIALS.stair);
    const stepH = Math.max(0.06, STATE.wallHeight * heightRatio);
    mesh.scale.y = stepH;
    mesh.position.set(sx, (stepH / 2) + yOffset, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const effectiveIsExterior = isExterior || (yOffset < -0.05);
    mesh.userData.isInterior = !effectiveIsExterior;
    mesh.userData.isExterior = effectiveIsExterior;
    mesh.userData.isStair = true;

    const edges = (geom.parameters && geom.parameters.width)
        ? getCachedEdgesGeometry(geom, geom.parameters.width, geom.parameters.height || 1, geom.parameters.depth)
        : new THREE.EdgesGeometry(geom);
    const edgeLine = new THREE.LineSegments(edges, MATERIALS.edgeMain);
    edgeLine.userData.isInterior = !effectiveIsExterior;
    edgeLine.userData.isExterior = effectiveIsExterior;
    edgeLine.userData.isStair = true;
    mesh.add(edgeLine);
    targetGroup.add(mesh);

    if (!effectiveIsExterior) {
        stairMeshes.push({ mesh, heightRatio, yOffset });
    }
}

function buildStaircaseUnit(targetGroup, zTop, zBottom, zMid, isUpperStaircase, startX = 10.2, endX = 14.6, landingX = 15.3) {
    addWallLine(targetGroup, startX, zMid, endX, zMid, [], 0.08);

    const stepsCount = 10;
    const stepDepth = (endX - startX) / stepsCount;

    const flights = [
        { z1: zTop + 0.12, z2: zMid - 0.06, dir: isUpperStaircase ? 1 : -1 },
        { z1: zMid + 0.06, z2: zBottom - 0.12, dir: isUpperStaircase ? -1 : 1 }
    ];

    flights.forEach(fl => {
        const flightW = Math.abs(fl.z2 - fl.z1);
        const cz = (fl.z1 + fl.z2) / 2;

        for (let i = 0; i < stepsCount; i++) {
            const ratio = fl.dir === 1 ? (i + 1) / stepsCount : (stepsCount - i) / stepsCount;
            const heightRatio = ratio * 0.52;
            const sx = startX + (i + 0.5) * stepDepth;

            const geom = getCachedBoxGeometry(stepDepth * 0.96, 1, flightW);
            registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, 0);
        }
    });

    // Межэтажная разворотная площадка у наружной стены
    const landingGeom = getCachedBoxGeometry(1.4, 1, Math.abs(zBottom - zTop));
    registerDynamicStairStep(targetGroup, landingGeom, landingX, (zTop + zBottom) / 2, 0.26, 0);
}

function buildCorridorStepsRight(targetGroup) {
    const stepW = 0.28;
    const z1 = -6.1;
    const z2 = -3.6;
    const depthZ = Math.abs(z2 - z1);
    const cz = (z1 + z2) / 2;

    for (let i = 0; i < 3; i++) {
        const sx = 14.3 + i * stepW;
        const heightRatio = 0.055 * (i + 1);
        const geom = getCachedBoxGeometry(stepW * 0.95, 1, depthZ);
        registerDynamicStairStep(targetGroup, geom, sx, cz, heightRatio, 0);
    }
}

function addRoofRect(targetGroup, x1, z1, x2, z2, buildingNum = 1) {
    const w = Math.abs(x2 - x1);
    const d = Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const thickness = 0.16;

    const geom = new THREE.BoxGeometry(w, thickness, d);
    const mesh = new THREE.Mesh(geom, MATERIALS.roof);
    mesh.position.set(cx, STATE.wallHeight + thickness / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isRoof = true;
    mesh.userData.isExterior = true;
    mesh.userData.isInterior = false;
    mesh.visible = STATE.showRoof;

    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, MATERIALS.edgeRoof);
    line.userData.isRoof = true;
    line.userData.isExterior = true;
    line.userData.isInterior = false;
    mesh.add(line);

    targetGroup.add(mesh);
    roofMeshes.push({ mesh, thickness, building: buildingNum });
}

window.addRoomLabel = addRoomLabel3D;


// ==========================================
// VANILLA THREE.JS BUFFER GEOMETRY MERGER
// ==========================================
function mergeBufferGeometriesVanilla(geometries) {
    if (!geometries || geometries.length === 0) return null;

    let totalPositions = 0;
    let totalNormals = 0;
    let totalUvs = 0;
    let totalIndices = 0;

    const validGeoms = [];
    for (let i = 0; i < geometries.length; i++) {
        let geom = geometries[i];
        if (!geom || !geom.attributes || !geom.attributes.position) continue;
        if (!geom.attributes.normal) {
            geom.computeVertexNormals();
        }
        validGeoms.push(geom);

        totalPositions += geom.attributes.position.array.length;
        if (geom.attributes.normal) totalNormals += geom.attributes.normal.array.length;
        if (geom.attributes.uv) totalUvs += geom.attributes.uv.array.length;
        if (geom.index) totalIndices += geom.index.array.length;
        else totalIndices += geom.attributes.position.count;
    }

    if (validGeoms.length === 0) return null;

    // Общее количество вершин — именно оно определяет диапазон адресов индексов.
    // totalIndices — это количество индексов (элементов массива), но каждый индекс
    // адресует вершину. Если вершин > 65535, Uint16 не сможет их адресовать.
    const totalVertices = totalPositions / 3;

    const mergedPositions = new Float32Array(totalPositions);
    const mergedNormals = totalNormals > 0 ? new Float32Array(totalPositions) : null;
    const mergedUvs = totalUvs > 0 ? new Float32Array(totalVertices * 2) : null;
    const mergedIndices = totalVertices <= 65535 ? new Uint16Array(totalIndices) : new Uint32Array(totalIndices);

    let posOffset = 0;
    let normOffset = 0;
    let uvOffset = 0;
    let indexOffset = 0;
    let vertexBase = 0;

    for (let i = 0; i < validGeoms.length; i++) {
        const geom = validGeoms[i];
        const posArray = geom.attributes.position.array;
        mergedPositions.set(posArray, posOffset);

        if (mergedNormals && geom.attributes.normal) {
            mergedNormals.set(geom.attributes.normal.array, normOffset);
        }

        if (mergedUvs && geom.attributes.uv) {
            mergedUvs.set(geom.attributes.uv.array, uvOffset);
        }

        const count = geom.attributes.position.count;
        if (geom.index) {
            const idxArray = geom.index.array;
            for (let j = 0; j < idxArray.length; j++) {
                mergedIndices[indexOffset + j] = idxArray[j] + vertexBase;
            }
            indexOffset += idxArray.length;
        } else {
            for (let j = 0; j < count; j++) {
                mergedIndices[indexOffset + j] = j + vertexBase;
            }
            indexOffset += count;
        }

        posOffset += posArray.length;
        if (mergedNormals) normOffset += posArray.length;
        if (mergedUvs) uvOffset += count * 2;
        vertexBase += count;
    }

    const mergedGeom = new THREE.BufferGeometry();
    mergedGeom.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    if (mergedNormals) mergedGeom.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    if (mergedUvs) mergedGeom.setAttribute('uv', new THREE.BufferAttribute(mergedUvs, 2));
    mergedGeom.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

    return mergedGeom;
}

function createExtrudedPolygonGeometry(points, yCenter = -0.02, thickness = 0.16) {
    if (!points || points.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false
    });
    geom.rotateX(Math.PI / 2);
    geom.translate(0, yCenter + thickness / 2, 0);
    geom.computeVertexNormals();
    return geom;
}

function buildStandardStaircaseFlight(targetGroup, x1, x2, zStart, stepD, steps = 9) {
    const xMid = (x1 + x2) / 2;
    const wFlight = (x2 - x1) / 2 - 0.16;
    for (let m = 0; m < 2; m++) {
        const cx = m === 0 ? (x1 + xMid) / 2 : (xMid + x2) / 2;
        const dir = m === 0 ? 1 : -1;
        for (let i = 0; i < steps; i++) {
            const ratio = dir === 1 ? (i + 1) / steps : (steps - i) / steps;
            const heightRatio = ratio * 0.52;
            const sz = zStart + (i + 0.5) * stepD;
            const geom = new THREE.BoxGeometry(wFlight, 1, stepD * 0.94);
            registerDynamicStairStep(targetGroup, geom, cx, sz, heightRatio, 0);
        }
    }
}

window.createExtrudedPolygonGeometry = createExtrudedPolygonGeometry;
window.buildStandardStaircaseFlight = buildStandardStaircaseFlight;
window.mergeBufferGeometriesVanilla = mergeBufferGeometriesVanilla;
