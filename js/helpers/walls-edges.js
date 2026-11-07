// Построение геометрии видимых рёбер стен без паразитных швов на Т-стыках и углах (Seamless Junction Solver)
function createResolvedWallEdgesGeometry(seg, wallBoxes) {
    const len = Math.abs(seg.c2 - seg.c1);
    if (len <= 0.001) return new THREE.BufferGeometry();
    const thickness = seg.thickness;
    const hw = len / 2;
    const ht = thickness / 2;
    const isH = seg.isHorizontal;
    const fixed = seg.fixedCoord;
    const c1 = Math.min(seg.c1, seg.c2);
    const c2 = Math.max(seg.c1, seg.c2);
    const mid = (c1 + c2) / 2;
    const cx = isH ? mid : fixed;
    const cz = isH ? fixed : mid;
    const delta = 0.01;
    const yTop = 0.5;
    const yBot = -0.5;

    function isInsideOtherWall(px, pz) {
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (px >= b.minX - 0.002 && px <= b.maxX + 0.002 &&
                pz >= b.minZ - 0.002 && pz <= b.maxZ + 0.002) {
                return true;
            }
        }
        return false;
    }

    const visibleLocalSegments = [];

    if (isH) {
        // Сторона North: Z = fixed - ht, normal (0, -1), local Z = -ht
        const zN = fixed - ht;
        const cutsN = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minZ - 0.005 <= zN && zN <= b.maxZ + 0.005) {
                if (c1 < b.minX && b.minX < c2) cutsN.add(b.minX);
                if (c1 < b.maxX && b.maxX < c2) cutsN.add(b.maxX);
            }
        }
        const sortedN = Array.from(cutsN).sort((a, b) => a - b);
        for (let i = 0; i < sortedN.length - 1; i++) {
            const xa = sortedN[i], xb = sortedN[i + 1];
            if (xb - xa < 0.005) continue;
            if (!isInsideOtherWall((xa + xb) / 2, zN - delta)) {
                visibleLocalSegments.push([xa - cx, -ht, xb - cx, -ht]);
            }
        }

        // Сторона South: Z = fixed + ht, normal (0, +1), local Z = +ht
        const zS = fixed + ht;
        const cutsS = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minZ - 0.005 <= zS && zS <= b.maxZ + 0.005) {
                if (c1 < b.minX && b.minX < c2) cutsS.add(b.minX);
                if (c1 < b.maxX && b.maxX < c2) cutsS.add(b.maxX);
            }
        }
        const sortedS = Array.from(cutsS).sort((a, b) => a - b);
        for (let i = 0; i < sortedS.length - 1; i++) {
            const xa = sortedS[i], xb = sortedS[i + 1];
            if (xb - xa < 0.005) continue;
            if (!isInsideOtherWall((xa + xb) / 2, zS + delta)) {
                visibleLocalSegments.push([xa - cx, ht, xb - cx, ht]);
            }
        }

        // Торец West: X = c1, normal (-1, 0), local X = -hw
        if (!seg.omitStartCap) {
            const cutsW = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minX - 0.005 <= c1 && c1 <= b.maxX + 0.005) {
                    if ((fixed - ht) < b.minZ && b.minZ < (fixed + ht)) cutsW.add(b.minZ);
                    if ((fixed - ht) < b.maxZ && b.maxZ < (fixed + ht)) cutsW.add(b.maxZ);
                }
            }
            const sortedW = Array.from(cutsW).sort((a, b) => a - b);
            for (let i = 0; i < sortedW.length - 1; i++) {
                const za = sortedW[i], zb = sortedW[i + 1];
                if (zb - za < 0.005) continue;
                if (!isInsideOtherWall(c1 - delta, (za + zb) / 2)) {
                    visibleLocalSegments.push([-hw, za - fixed, -hw, zb - fixed]);
                }
            }
        }

        // Торец East: X = c2, normal (+1, 0), local X = +hw
        if (!seg.omitEndCap) {
            const cutsE = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minX - 0.005 <= c2 && c2 <= b.maxX + 0.005) {
                    if ((fixed - ht) < b.minZ && b.minZ < (fixed + ht)) cutsE.add(b.minZ);
                    if ((fixed - ht) < b.maxZ && b.maxZ < (fixed + ht)) cutsE.add(b.maxZ);
                }
            }
            const sortedE = Array.from(cutsE).sort((a, b) => a - b);
            for (let i = 0; i < sortedE.length - 1; i++) {
                const za = sortedE[i], zb = sortedE[i + 1];
                if (zb - za < 0.005) continue;
                if (!isInsideOtherWall(c2 + delta, (za + zb) / 2)) {
                    visibleLocalSegments.push([hw, za - fixed, hw, zb - fixed]);
                }
            }
        }
    } else {
        // Вертикальная стена (rotation.y = -Math.PI / 2)
        // world X = cx - z_local  =>  z_local = fixed - world X
        // world Z = cz + x_local  =>  x_local = world Z - cz

        // Сторона West: world X = fixed - ht, normal (-1, 0), local Z = +ht
        const xW = fixed - ht;
        const cutsW = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minX - 0.005 <= xW && xW <= b.maxX + 0.005) {
                if (c1 < b.minZ && b.minZ < c2) cutsW.add(b.minZ);
                if (c1 < b.maxZ && b.maxZ < c2) cutsW.add(b.maxZ);
            }
        }
        const sortedW = Array.from(cutsW).sort((a, b) => a - b);
        for (let i = 0; i < sortedW.length - 1; i++) {
            const za = sortedW[i], zb = sortedW[i + 1];
            if (zb - za < 0.005) continue;
            if (!isInsideOtherWall(xW - delta, (za + zb) / 2)) {
                visibleLocalSegments.push([za - cz, ht, zb - cz, ht]);
            }
        }

        // Сторона East: world X = fixed + ht, normal (+1, 0), local Z = -ht
        const xE = fixed + ht;
        const cutsE = new Set([c1, c2]);
        for (let k = 0; k < wallBoxes.length; k++) {
            const b = wallBoxes[k];
            if (b.id === seg.id) continue;
            if (b.minX - 0.005 <= xE && xE <= b.maxX + 0.005) {
                if (c1 < b.minZ && b.minZ < c2) cutsE.add(b.minZ);
                if (c1 < b.maxZ && b.maxZ < c2) cutsE.add(b.maxZ);
            }
        }
        const sortedE = Array.from(cutsE).sort((a, b) => a - b);
        for (let i = 0; i < sortedE.length - 1; i++) {
            const za = sortedE[i], zb = sortedE[i + 1];
            if (zb - za < 0.005) continue;
            if (!isInsideOtherWall(xE + delta, (za + zb) / 2)) {
                visibleLocalSegments.push([za - cz, -ht, zb - cz, -ht]);
            }
        }

        // Торец North: world Z = c1, normal (0, -1), local X = -hw
        if (!seg.omitStartCap) {
            const cutsN = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minZ - 0.005 <= c1 && c1 <= b.maxZ + 0.005) {
                    if ((fixed - ht) < b.minX && b.minX < (fixed + ht)) cutsN.add(b.minX);
                    if ((fixed - ht) < b.maxX && b.maxX < (fixed + ht)) cutsN.add(b.maxX);
                }
            }
            const sortedN = Array.from(cutsN).sort((a, b) => a - b);
            for (let i = 0; i < sortedN.length - 1; i++) {
                const xa = sortedN[i], xb = sortedN[i + 1];
                if (xb - xa < 0.005) continue;
                if (!isInsideOtherWall((xa + xb) / 2, c1 - delta)) {
                    visibleLocalSegments.push([-hw, fixed - xa, -hw, fixed - xb]);
                }
            }
        }

        // Торец South: world Z = c2, normal (0, +1), local X = +hw
        if (!seg.omitEndCap) {
            const cutsS = new Set([fixed - ht, fixed + ht]);
            for (let k = 0; k < wallBoxes.length; k++) {
                const b = wallBoxes[k];
                if (b.id === seg.id) continue;
                if (b.minZ - 0.005 <= c2 && c2 <= b.maxZ + 0.005) {
                    if ((fixed - ht) < b.minX && b.minX < (fixed + ht)) cutsS.add(b.minX);
                    if ((fixed - ht) < b.maxX && b.maxX < (fixed + ht)) cutsS.add(b.maxX);
                }
            }
            const sortedS = Array.from(cutsS).sort((a, b) => a - b);
            for (let i = 0; i < sortedS.length - 1; i++) {
                const xa = sortedS[i], xb = sortedS[i + 1];
                if (xb - xa < 0.005) continue;
                if (!isInsideOtherWall((xa + xb) / 2, c2 + delta)) {
                    visibleLocalSegments.push([hw, fixed - xa, hw, fixed - xb]);
                }
            }
        }
    }

    const positions = [];
    // Для каждого видимого отрезка строим ребро сверху (yTop) и снизу (yBot)
    for (let i = 0; i < visibleLocalSegments.length; i++) {
        const segLine = visibleLocalSegments[i];
        const lx1 = segLine[0], lz1 = segLine[1], lx2 = segLine[2], lz2 = segLine[3];
        positions.push(lx1, yTop, lz1,  lx2, yTop, lz2);
        positions.push(lx1, yBot, lz1,  lx2, yBot, lz2);
    }

    // Вертикальные ребра на открытых внешних углах
    const corners = [[-hw, -ht], [-hw, ht], [hw, -ht], [hw, ht]];
    for (let i = 0; i < corners.length; i++) {
        const lx = corners[i][0], lz = corners[i][1];
        let touchesVisible = false;
        for (let j = 0; j < visibleLocalSegments.length; j++) {
            const sl = visibleLocalSegments[j];
            if ((Math.abs(sl[0] - lx) < 0.005 && Math.abs(sl[1] - lz) < 0.005) ||
                (Math.abs(sl[2] - lx) < 0.005 && Math.abs(sl[3] - lz) < 0.005)) {
                touchesVisible = true;
                break;
            }
        }
        if (!touchesVisible) continue;

        const wx = isH ? (cx + lx) : (cx - lz);
        const wz = isH ? (cz + lz) : (cz + lx);
        if (isInsideOtherWall(wx, wz)) continue;

        positions.push(lx, yBot, lz,  lx, yTop, lz);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
}
