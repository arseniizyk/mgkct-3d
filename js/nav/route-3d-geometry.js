    function clearRoute3D() {
        function disposeHierarchy(root) {
            if (!root) return;
            root.traverse((child) => {
                if (child.geometry && typeof child.geometry.dispose === 'function') {
                    child.geometry.dispose();
                }
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(m => {
                        if (!m) return;
                        if (m.map && typeof m.map.dispose === 'function') {
                            m.map.dispose();
                        }
                        if (typeof m.dispose === 'function') {
                            m.dispose();
                        }
                    });
                }
            });
        }

        // Удаляем объекты пути с каждого этажа и отсоединяем пустые группы
        for (let f = 1; f <= 7; f++) {
            const fg = NAV_STATE.routeFloorGroups[f];
            if (fg) {
                while (fg.children.length > 0) {
                    const obj = fg.children[0];
                    disposeHierarchy(obj);
                    fg.remove(obj);
                }
                if (fg.parent) {
                    fg.parent.remove(fg);
                }
            }
        }
        NAV_STATE.routeFloorGroups = {};

        // Удаляем глобальную группу межэтажных переходов в режиме 'all'
        if (NAV_STATE.globalRouteGroup && window.scene) {
            window.scene.remove(NAV_STATE.globalRouteGroup);
            while (NAV_STATE.globalRouteGroup.children.length > 0) {
                const obj = NAV_STATE.globalRouteGroup.children[0];
                disposeHierarchy(obj);
                NAV_STATE.globalRouteGroup.remove(obj);
            }
            NAV_STATE.globalRouteGroup = null;
        }

        if (NAV_STATE._pulsingObjects) {
            NAV_STATE._pulsingObjects.length = 0;
        }
        if (NAV_STATE._renderedStairBadges) {
            NAV_STATE._renderedStairBadges.length = 0;
        }
        NAV_STATE.activeRoute = null;
        if (NAV_STATE._badgeWidthCache) {
            NAV_STATE._badgeWidthCache.clear();
        }
        if (typeof requestRender === 'function') requestRender(20);
    }

    function getRouteNodeBaseY(node) {
        const indoorY = (typeof ROUTE_INDOOR_Y === 'number') ? ROUTE_INDOOR_Y : 0.08;
        const curbTopY = (typeof CURB_TOP_Y === 'number') ? CURB_TOP_Y : 0.12;
        const clearance = (typeof ROUTE_OUTDOOR_CLEARANCE === 'number') ? ROUTE_OUTDOOR_CLEARANCE : 0.012;
        return (node && node.isOutdoor) ? (curbTopY + clearance) : indoorY;
    }

    function simplifyRoutePoints(points) {
        if (!points || points.length <= 2) return points || [];
        const clean = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = clean[clean.length - 1];
            const curr = points[i];
            const next = points[i + 1];

            const dx1 = curr.x - prev.x;
            const dz1 = curr.z - prev.z;
            const dx2 = next.x - curr.x;
            const dz2 = next.z - curr.z;

            const l1 = Math.hypot(dx1, dz1);
            const l2 = Math.hypot(dx2, dz2);

            // Пропускаем дубликаты точек ближе 4 см, если высота не меняется
            const dy1 = Math.abs((curr.y || 0) - (prev.y || 0));
            const dy2 = Math.abs((next.y || 0) - (curr.y || 0));
            if (l1 < 0.04 && dy1 < 0.001) continue;
            if (l2 < 0.04 && dy2 < 0.001) continue;

            // Сохраняем перелом высоты между внутренними помещениями и уличным полотном
            if (dy1 > 0.001 || dy2 > 0.001) {
                clean.push(curr);
                continue;
            }

            const dot = (dx1 * dx2 + dz1 * dz2) / (l1 * l2);
            // Если вектор направления не меняется — схлопываем промежуточную точку!
            if (dot > 0.996) {
                continue;
            }
            clean.push(curr);
        }
        clean.push(points[points.length - 1]);
        return clean;
    }

    function createFlatRibbonGeometry(pts, width, yOffset = 0) {
        if (!pts || pts.length < 2) return null;
        const halfW = width / 2;
        const defaultIndoorY = (typeof ROUTE_INDOOR_Y === 'number') ? ROUTE_INDOOR_Y : 0.08;
        const positions = [];
        const indices = [];

        // 1. Прямоугольные отрезки постоянной ширины вдоль всей траектории с учётом высоты каждой вершины
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i + 1];
            const dx = p1.x - p0.x;
            const dz = p1.z - p0.z;
            const len = Math.hypot(dx, dz);
            if (len < 1e-4) continue;

            const y0 = (typeof p0.y === 'number' ? p0.y : defaultIndoorY) + yOffset;
            const y1 = (typeof p1.y === 'number' ? p1.y : defaultIndoorY) + yOffset;
            const nx = (-dz / len) * halfW;
            const nz = (dx / len) * halfW;
            const baseIdx = positions.length / 3;

            positions.push(p0.x + nx, y0, p0.z + nz);
            positions.push(p0.x - nx, y0, p0.z - nz);
            positions.push(p1.x + nx, y1, p1.z + nz);
            positions.push(p1.x - nx, y1, p1.z - nz);

            indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
            indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
        }

        // 2. Круглые диски на всех поворотах и концах (Round Caps & Round Joins)
        // Гарантируют абсолютно плавные скругленные повороты и монолитную линию без изломов
        const circleSegments = 16;
        for (let i = 0; i < pts.length; i++) {
            const center = pts[i];
            const yc = (typeof center.y === 'number' ? center.y : defaultIndoorY) + yOffset;
            const centerIdx = positions.length / 3;
            positions.push(center.x, yc, center.z);

            for (let s = 0; s <= circleSegments; s++) {
                const angle = (s / circleSegments) * Math.PI * 2;
                const rx = center.x + Math.cos(angle) * halfW;
                const rz = center.z + Math.sin(angle) * halfW;
                positions.push(rx, yc, rz);
            }

            for (let s = 0; s < circleSegments; s++) {
                indices.push(centerIdx, centerIdx + 1 + s, centerIdx + 2 + s);
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setIndex(indices);
        geom.computeVertexNormals();
        return geom;
    }

    function createLuminousRouteMesh(rawPoints, colorHex = 0x0284c7) {
        if (!rawPoints || rawPoints.length < 2) return null;

        const points = simplifyRoutePoints(rawPoints);
        if (points.length < 2) return null;

        const isDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');
        const mainColor = isDark ? 0x38bdf8 : 0x0284c7;
        const coreColor = isDark ? 0xf0f9ff : 0xffffff;

        const group = new THREE.Group();

        // 1. Основная плоская светящаяся полоса (ширина 0.34м, высота по узлам pt.y + 0)
        const baseGeom = createFlatRibbonGeometry(points, 0.34, 0);
        if (!baseGeom) return null;

        const baseMat = new THREE.MeshBasicMaterial({
            color: mainColor,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            depthTest: true
        });
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.renderOrder = 20;
        baseMesh.userData = { isRouteRibbonBase: true };
        group.add(baseMesh);

        // 2. Внутренняя контрастная сердцевина (ширина 0.12м, +0.005м над основой)
        const coreGeom = createFlatRibbonGeometry(points, 0.12, 0.005);
        if (coreGeom) {
            const coreMat = new THREE.MeshBasicMaterial({
                color: coreColor,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                depthTest: true
            });
            const coreMesh = new THREE.Mesh(coreGeom, coreMat);
            coreMesh.renderOrder = 21;
            coreMesh.userData = { isRouteRibbonCore: true };
            group.add(coreMesh);
        }

        return group;
    }

    function createMarkerRing(colorHex, labelText = 'A', isPulsing = true) {
        const group = new THREE.Group();

        // 1. Внешнее светящееся кольцо на полу
        const ringGeom = new THREE.RingGeometry(0.55, 0.75, 32);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.08;
        group.add(ring);

        // 2. Внутренний залитый диск
        const diskGeom = new THREE.CircleGeometry(0.50, 32);
        diskGeom.rotateX(-Math.PI / 2);
        const diskMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.35
        });
        const disk = new THREE.Mesh(diskGeom, diskMat);
        disk.position.y = 0.07;
        group.add(disk);

        // 3. Вертикальный маячок
        const beaconGeom = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 16);
        beaconGeom.translate(0, 0.6, 0);
        const beaconMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.85
        });
        const beacon = new THREE.Mesh(beaconGeom, beaconMat);
        group.add(beacon);

        // 4. Сфера на верхушке маяка
        const sphereGeom = new THREE.SphereGeometry(0.22, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sphere = new THREE.Mesh(sphereGeom, sphereMat);
        sphere.position.y = 1.25;
        group.add(sphere);

        group.userData = { ring, disk, beacon, sphere, baseColor: colorHex, isPulsing };
        return group;
    }

    function createStairTransitionMarker(text, isUp = true) {
        const group = new THREE.Group();
        const color = 0x38bdf8; // Голубой цвет лестницы

        // Кольцо у входа на лестницу
        const ringGeom = new THREE.RingGeometry(0.40, 0.55, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.06;
        group.add(ring);

        // Внутренний диск
        const diskGeom = new THREE.CircleGeometry(0.38, 24);
        diskGeom.rotateX(-Math.PI / 2);
        const diskMat = new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.35
        });
        const disk = new THREE.Mesh(diskGeom, diskMat);
        disk.position.y = 0.055;
        group.add(disk);

        return group;
    }
