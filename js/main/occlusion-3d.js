function isPointOccludedIn3D(worldX, worldY, worldZ, itemFloor = 1, itemBldg = null, isExteriorAnchor = false) {
    if (!camera || STATE.is2D || STATE.smartLabelOcclusion === false) return false;

    const isStack = (STATE.mode === 'all' || STATE.mode === 'slice') &&
        (!STATE.exploded || STATE.explodeGap < 0.2) &&
        (STATE.slabOpacity > 0.85);
    const maxF = STATE.mode === 'slice' ? STATE.sliceMaxFloor : 7;

    // 1. В свёрнутом стеке (Все этажи / Срез без разнесения) герметично закрытые нижние этажи отсекаются за O(1)
    if (!isExteriorAnchor && isStack) {
        if (STATE.showRoof) return true;
        if (itemBldg && itemBldg >= 1 && itemBldg <= 4) {
            const topBldgFloor = Math.min(getBuildingMaxFloorCount(itemBldg), maxF);
            if (itemFloor < topBldgFloor) {
                const itemGroup = floorGroups[itemFloor];
                const lx = worldX - (itemGroup ? itemGroup.position.x : 0);
                const lz = worldZ - (itemGroup ? itemGroup.position.z : 0);
                // Проверяем перекрытие следующим этажом (с учётом открытого второго света над спортзалом и актовым залом К4)
                if (isPointInFloorFootprint(lx, lz, itemFloor + 1, itemBldg)) {
                    return true;
                }
            }
        }
    }

    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const dx = worldX - cx;
    const dy = worldY - cy;
    const dz = worldZ - cz;
    const rayLen = Math.hypot(dx, dy, dz);
    if (rayLen < 0.15) return false;

    const minT = 0.002;
    const maxT = Math.max(0.02, 1.0 - 0.08 / rayLen);
    const hasDy = Math.abs(dy) > 1e-8;
    const invDy = hasDy ? (1.0 / dy) : 0;

    // 2. Пересечение луча со сплошными горизонтальными плитами перекрытий и крышами ВСЕХ видимых корпусов
    if (STATE.slabOpacity > 0.85 && hasDy) {
        for (let u = 1; u <= 7; u++) {
            const ug = floorGroups[u];
            if (!ug || !ug.visible) continue;

            if (u >= 2 || ug.position.y > 0.05) {
                for (let s = 0; s < 2; s++) {
                    const planeY = s === 0 ? ug.position.y : (ug.position.y - 0.25);
                    if ((cy > planeY && worldY < planeY) || (cy < planeY && worldY > planeY)) {
                        const t = (planeY - cy) * invDy;
                        if (t > minT && t < maxT) {
                            const hitX = cx + t * dx - ug.position.x;
                            const hitZ = cz + t * dz - ug.position.z;
                            if (isPointInFloorFootprint(hitX, hitZ, u, null)) {
                                return true;
                            }
                        }
                    }
                }
            }

            if (STATE.showRoof) {
                const roofY = ug.position.y + STATE.wallHeight;
                if ((cy > roofY && worldY < roofY) || (cy < roofY && worldY > roofY)) {
                    const t = (roofY - cy) * invDy;
                    if (t > minT && t < maxT) {
                        const hitX = cx + t * dx - ug.position.x;
                        const hitZ = cz + t * dz - ug.position.z;
                        if ((u === 7 && isPointInFloorFootprint(hitX, hitZ, 7, 1)) ||
                            (u === 3 && (isPointInFloorFootprint(hitX, hitZ, 3, 2) || isPointInFloorFootprint(hitX, hitZ, 3, 4))) ||
                            (u === 2 && isPointInFloorFootprint(hitX, hitZ, 2, 3))) {
                            return true;
                        }
                    }
                }
            }
        }
    }

    // 3. Точное пересечение луча с вертикальными 3D-боксами стен и закрытых дверей (Slab Method)
    const occludersByFloor = (typeof OCCLUDER_WALLS_BY_FLOOR !== 'undefined') ? OCCLUDER_WALLS_BY_FLOOR : null;
    if (!occludersByFloor) return false;

    const hasDx = Math.abs(dx) > 1e-8;
    const invDx = hasDx ? (1.0 / dx) : 0;
    const hasDz = Math.abs(dz) > 1e-8;
    const invDz = hasDz ? (1.0 / dz) : 0;
    const hideShared = (STATE.buildingFilter === 'both');
    const showDoors = Boolean(STATE.showDoors);
    const isVisBldg = (typeof isBuildingVisible === 'function')
        ? isBuildingVisible
        : (b) => (STATE.buildingFilter === 'both' || String(STATE.buildingFilter) === String(b));

    for (let u = 1; u <= 7; u++) {
        const ug = floorGroups[u];
        if (!ug || !ug.visible) continue;
        const walls = occludersByFloor[u];
        if (!walls || walls.length === 0) continue;

        const yBot = ug.position.y - WALL_SINK;
        const yTop = ug.position.y + STATE.wallHeight;
        let tyMin = minT;
        let tyMax = maxT;

        if (!hasDy) {
            if (cy < yBot || cy > yTop) continue;
        } else {
            const t1 = (yBot - cy) * invDy;
            const t2 = (yTop - cy) * invDy;
            const enterY = t1 < t2 ? t1 : t2;
            const exitY = t1 > t2 ? t1 : t2;
            if (enterY > tyMin) tyMin = enterY;
            if (exitY < tyMax) tyMax = exitY;
            if (tyMin > tyMax) continue;
        }

        const ox = ug.position.x;
        const oz = ug.position.z;

        for (let i = 0; i < walls.length; i++) {
            const w = walls[i];
            if (w.building && !isVisBldg(w.building)) continue;
            if (w.sharedBoundaryWith !== null && hideShared) continue;
            if (w.isDoor && !showDoors) continue;
            if (!w.isExterior && isStack && w.building && u < Math.min(getBuildingMaxFloorCount(w.building), maxF)) {
                continue;
            }

            let tmin = tyMin;
            let tmax = tyMax;

            const wx0 = w.minX + ox;
            const wx1 = w.maxX + ox;
            if (!hasDx) {
                if (cx < wx0 || cx > wx1) continue;
            } else {
                const tx1 = (wx0 - cx) * invDx;
                const tx2 = (wx1 - cx) * invDx;
                const enterX = tx1 < tx2 ? tx1 : tx2;
                const exitX = tx1 > tx2 ? tx1 : tx2;
                if (enterX > tmin) tmin = enterX;
                if (exitX < tmax) tmax = exitX;
                if (tmin > tmax) continue;
            }

            const wz0 = w.minZ + oz;
            const wz1 = w.maxZ + oz;
            if (!hasDz) {
                if (cz < wz0 || cz > wz1) continue;
            } else {
                const tz1 = (wz0 - cz) * invDz;
                const tz2 = (wz1 - cz) * invDz;
                const enterZ = tz1 < tz2 ? tz1 : tz2;
                const exitZ = tz1 > tz2 ? tz1 : tz2;
                if (enterZ > tmin) tmin = enterZ;
                if (exitZ < tmax) tmax = exitZ;
                if (tmin > tmax) continue;
            }

            if (w.isDiagonal) {
                const tMid = 0.5 * (tmin + tmax);
                const rx = (cx + tMid * dx - ox) - w.x1;
                const rz = (cz + tMid * dz - oz) - w.z1;
                const uProj = rx * w.ux + rz * w.uz;
                const vPerp = Math.abs(-rx * w.uz + rz * w.ux);
                if (uProj < -w.halfT || uProj > w.len + w.halfT || vPerp > w.halfT) {
                    continue;
                }
            }

            return true;
        }
    }

    return false;
}
window.isPointOccludedIn3D = isPointOccludedIn3D;

const _tempLabelWorldPos = new THREE.Vector3();

function isLabelOccludedByUpperSlabs(labelItem, floorNum = null, bldId = null) {
    const f = floorNum !== null ? floorNum : labelItem.floor;
    const fg = floorGroups[f];
    if (!fg || !fg.visible) return true;

    if (labelItem.isVector3) {
        _tempLabelWorldPos.copy(labelItem);
    } else {
        const lx = labelItem.localX !== undefined ? labelItem.localX : (labelItem.x || 0);
        const lz = labelItem.localZ !== undefined ? labelItem.localZ : (labelItem.z || 0);
        const ly = (labelItem.mesh && labelItem.mesh.position) ? labelItem.mesh.position.y : 0.04;
        _tempLabelWorldPos.set(
            fg.position.x + lx,
            fg.position.y + ly,
            fg.position.z + lz
        );
    }

    const camPos = camera.position;
    const dy = _tempLabelWorldPos.y - camPos.y;

    // Если камера и метка на одной высоте — луч горизонтален, перекрытия нет.
    if (Math.abs(dy) < 1e-6) return false;

    for (let u = f + 1; u <= 7; u++) {
        const ug = floorGroups[u];
        if (!ug || !ug.visible) continue;

        const checkHeights = [ug.position.y, ug.position.y + STATE.wallHeight * 0.55];
        for (let i = 0; i < checkHeights.length; i++) {
            const planeY = checkHeights[i];
            if ((camPos.y > planeY && _tempLabelWorldPos.y < planeY) ||
                (camPos.y < planeY && _tempLabelWorldPos.y > planeY)) {
                const t = (planeY - camPos.y) / dy;
                if (t > 0.01 && t < 0.99) {
                    const hitX = camPos.x + t * (_tempLabelWorldPos.x - camPos.x) - ug.position.x;
                    const hitZ = camPos.z + t * (_tempLabelWorldPos.z - camPos.z) - ug.position.z;
                    if (isPointInFloorFootprint(hitX, hitZ, u, bldId)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function updateLabelsVisibility() {
    // 3D-меши надписей всегда скрыты в Three.js, так как они отрисовываются
    // со 100% честной резкостью через Screen-Space 2D Overlay
    labelSprites.forEach(item => {
        if (item.mesh) {
            item.mesh.visible = false;
        }
    });
}
