    function findClosestToilet(fromPoint) {
        if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
        const g = NAV_STATE.graph;

        let startP = fromPoint;
        if (!startP) {
            startP = g.getNode('b3_f1_entrance_west') || g.getNode('b1_f1_entrance_main');
        }
        if (!startP) return null;

        const startFloor = startP.floor || 1;
        const startBldg = startP.bldg || startP.building || 1;
        const startX = startP.x !== undefined ? startP.x : 10.5;
        const startZ = startP.z !== undefined ? startP.z : 10.4;

        // Собираем туалетные узлы прямо из графа — их ID валидны для A*.
        // Узел считается туалетом, если его ID содержит '_wc_', тип 'wc',
        // или label начинается с 'WC'.
        let bestNode = null;
        let bestScore = Infinity;

        for (const [nid, node] of g.nodes.entries()) {
            if (node.type === 'door' || node.type === 'corridor') continue;
            const lbl = (node.label || '').trim();
            const isWC = node.type === 'wc'
                || nid.includes('_wc_')
                || /^wc\b/i.test(lbl);
            if (!isWC) continue;

            const floorDiff = Math.abs(node.floor - startFloor);
            const bldgDiff = (node.bldg === startBldg) ? 0 : 1;
            const geomDist = Math.hypot(node.x - startX, node.z - startZ);
            // Штраф за смену этажа (50м) и переход в другой корпус (80м) для приоритета текущего этажа
            const score = geomDist + floorDiff * 50.0 + bldgDiff * 80.0;
            if (score < bestScore) {
                bestScore = score;
                bestNode = node;
            }
        }

        return bestNode;
    }

    function setDefaultStartPoint() {
        if (!NAV_STATE.graph) NAV_STATE.graph = buildCollegeNavGraph();
        const entrance = NAV_STATE.graph.getNode('b3_f1_entrance_west') || NAV_STATE.graph.getNode('b1_f1_entrance_main');
        if (entrance && !NAV_STATE.startPoint) {
            NAV_STATE.startPoint = entrance;
            const inputA = document.getElementById('nav-input-start');
            if (inputA && !inputA.value) {
                inputA.value = formatNavInputString(entrance);
                inputA.setAttribute('data-is-default', 'true');
                const btnClearA = document.getElementById('btn-clear-start');
                if (btnClearA) btnClearA.classList.remove('hidden');
            }
        }
    }

    // ------------------------------------------------------------------------
    function formatNavNodeName(lbl, bldg) {
        if (!lbl) return '';
        const raw = String(lbl).replace(/\s*\n\s*/g, ' ').trim();
        const b = parseInt(bldg, 10);
        if (b <= 1 || isNaN(b)) return raw;
        if (raw.startsWith('2-') || raw.startsWith('3-') || raw.startsWith('4-')) return raw;
        if (/^\d+[а-яa-z]?$/i.test(raw)) {
            return b + '-' + raw;
        }
        return raw;
    }

    function formatNavInputString(nodeOrPoint) {
        if (!nodeOrPoint) return '';
        const rawLbl = String(nodeOrPoint.label || nodeOrPoint.text || '').replace(/\s*\n\s*/g, ' ').trim();
        const b = parseInt(nodeOrPoint.bldg !== undefined ? nodeOrPoint.bldg : nodeOrPoint.building, 10);
        const f = parseInt(nodeOrPoint.floor, 10);

        if (nodeOrPoint.id === 'b3_f1_entrance_west' || /главный вход/i.test(rawLbl)) {
            return 'Главный вход (Корпус 3)';
        }
        if (nodeOrPoint.id === 'b1_f1_entrance_main' || /восточный вход/i.test(rawLbl)) {
            return 'Восточный вход (Корпус 1)';
        }

        // Помещения вида "102 Столовая", "104 Библиотека", "209 Учебная часть"
        const numTitleMatch = rawLbl.match(/^(\d+[а-яa-z]?)\s+(.+)$/i);
        if (numTitleMatch) {
            const numPart = (b > 1 && !numTitleMatch[1].startsWith(`${b}-`)) ? `${b}-${numTitleMatch[1]}` : numTitleMatch[1];
            const cleanTitle = numTitleMatch[2].replace(/^\((.+)\)$/, '$1');
            return `${numPart} • ${cleanTitle}`;
        }

        const disp = formatNavNodeName(rawLbl, b);
        const isNum = /^\d+[а-яa-z]?$/i.test(disp) || /^[2-4]-\d+[а-яa-z]?$/i.test(disp);
        if (isNum) {
            return f > 0 ? `Кабинет ${disp} (${f} эт.)` : `Кабинет ${disp}`;
        }
        if (/^с\/у/i.test(disp)) {
            return (b > 0 && f > 0) ? `${disp} • К${b}, ${f} эт.` : disp;
        }
        if (disp.includes('(') || /корпус|к[1-4]/i.test(disp)) {
            return disp;
        }
        if (b > 0 && f > 0) {
            return `${disp} (К${b}, ${f} эт.)`;
        }
        return disp;
    }
    // АЛГОРИТМ A* (A-STAR) ПОИСКА КРАТЧАЙШЕГО ПУТИ
    // ------------------------------------------------------------------------
    function aStarPath(graph, startId, destId, options = {}) {
        const startNode = graph.getNode(startId);
        const destNode = graph.getNode(destId);
        if (!startNode || !destNode) return null;
        if (startId === destId) return { path: [startId], totalDistance: 0 };

        const allowElev = (options && options.allowElevators !== undefined) ? options.allowElevators : NAV_STATE.allowElevators;

        const frontier = new MinHeap();
        const cameFrom = new Map();
        const costSoFar = new Map();

        frontier.push(startId, 0);
        cameFrom.set(startId, null);
        costSoFar.set(startId, 0);

        const destX = destNode.x;
        const destZ = destNode.z;
        const destFloor = destNode.floor;

        function heuristic(uId) {
            const u = graph.getNode(uId);
            if (!u) return 0;
            const dx = u.x - destX;
            const dz = u.z - destZ;
            const df = Math.abs(u.floor - destFloor);
            return Math.hypot(dx, dz) + df * 4.0;
        }

        const settled = new Set();

        while (!frontier.isEmpty()) {
            const current = frontier.pop();
            if (current === destId) break;
            // Ленивое удаление дубликатов из MinHeap: исключаем повторное раскрытие уже посещенных вершин
            if (settled.has(current)) continue;
            settled.add(current);

            const neighbors = graph.adj.get(current) || [];
            const currentCost = costSoFar.get(current);

            for (let i = 0; i < neighbors.length; i++) {
                const edge = neighbors[i];
                // Если лифты выключены пользователем, пропускаем лифтовые рёбра
                if (edge.isElevator && !allowElev) continue;

                const nxt = edge.to;
                const newCost = currentCost + edge.weight;

                if (!costSoFar.has(nxt) || newCost < costSoFar.get(nxt)) {
                    costSoFar.set(nxt, newCost);
                    cameFrom.set(nxt, current);
                    const priority = newCost + heuristic(nxt);
                    frontier.push(nxt, priority);
                }
            }
        }

        if (!cameFrom.has(destId)) return null;

        // Восстановление пути с защитой от циклов и разрывов
        const path = [];
        const visited = new Set();
        let curr = destId;
        const maxSteps = (graph.nodes && graph.nodes.size) ? graph.nodes.size : 2000;
        while (curr !== null && curr !== undefined && !visited.has(curr) && path.length < maxSteps) {
            visited.add(curr);
            path.push(curr);
            curr = cameFrom.get(curr);
        }
        if (curr !== null) {
            console.warn('[MGKCT Navigator] Предупреждение: обнаружен цикл или разрыв цепи при восстановлении пути для узла:', curr);
            return null;
        }
        path.reverse();

        return {
            path,
            totalDistance: costSoFar.get(destId)
        };
    }

    // ------------------------------------------------------------------------
    // ГЕНЕРАТОР ПОШАГОВЫХ ТЕКСТОВЫХ ИНСТРУКЦИЙ (ПО-РУССКИ)
    // ------------------------------------------------------------------------
    function generateRouteInstructions(graph, path) {
        if (!path || path.length === 0) return [];
        if (path.length === 1) {
            const singleNode = graph.getNode(path[0]);
            const label = singleNode ? formatNavNodeName(singleNode.label, singleNode.bldg) : 'текущей точки';
            const bldgStr = (singleNode && singleNode.bldg > 1 && !/^[2-4]-\d/.test(label)) ? ` (Корпус ${singleNode.bldg})` : '';
            const floorStr = singleNode ? `, Этаж ${singleNode.floor}` : '';
            return [{
                type: 'arrival',
                icon: '<svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
                text: `Вы уже находитесь в точке назначения: ${label}${bldgStr}${floorStr}`,
                floor: singleNode ? singleNode.floor : 1,
                bldg: singleNode ? singleNode.bldg : 1,
                nodeId: path[0]
            }];
        }

        const instructions = [];
        const startNode = graph.getNode(path[0]);
        const destNode = graph.getNode(path[path.length - 1]);

        instructions.push({
            type: 'start',
            icon: '<svg class="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#c2e7ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6z" /></svg>',
            text: `Начните движение от: ${formatNavNodeName(startNode.label, startNode.bldg)}` + (startNode.bldg > 1 && !/^[2-4]-\d/.test(formatNavNodeName(startNode.label, startNode.bldg)) ? ` (Корпус ${startNode.bldg})` : ``) + `, Этаж ${startNode.floor}`,
            floor: startNode.floor,
            bldg: startNode.bldg,
            nodeId: path[0]
        });

        let currentFloor = startNode.floor;
        let currentBldg = startNode.bldg;
        let distAccum = 0;

        for (let i = 1; i < path.length; i++) {
            const prev = graph.getNode(path[i - 1]);
            const curr = graph.getNode(path[i]);
            const segDist = Math.hypot(curr.x - prev.x, curr.z - prev.z);

            // 1. Смена этажа (Лестница или Лифт)
            if (curr.floor !== prev.floor) {
                if (distAccum > 1.0) {
                    instructions.push({
                        type: 'corridor',
                        icon: '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>',
                        text: `Идите по коридору ${Math.round(distAccum)} м`,
                        floor: prev.floor,
                        bldg: prev.bldg,
                        nodeId: prev.id
                    });
                    distAccum = 0;
                }

                const isUp = curr.floor > prev.floor;
                const isElev = prev.type === 'elevator' || curr.type === 'elevator';
                const actionVerb = isElev ? 'Воспользуйтесь лифтом до' : (isUp ? 'Поднимитесь по лестнице на' : 'Спуститесь по лестнице на');
                const stairName = prev.label.includes('ЛК') ? prev.label : 'лестнице';

                instructions.push({
                    type: isUp ? 'stair_up' : 'stair_down',
                    icon: isElev ? '<svg class="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#c2e7ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>' : '<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>',
                    text: `${actionVerb} ${curr.floor} этаж (${stairName})`,
                    floor: curr.floor,
                    bldg: curr.bldg,
                    nodeId: curr.id,
                    isElevator: isElev
                });

                currentFloor = curr.floor;
                currentBldg = curr.bldg;
                continue;
            }

            // 2. Смена корпуса через надземный переход
            if (curr.bldg !== prev.bldg || curr.type === 'bridge' || prev.type === 'bridge') {
                if (curr.bldg !== currentBldg) {
                    if (distAccum > 1.0) {
                        instructions.push({
                            type: 'corridor',
                            icon: '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>',
                            text: `Идите по коридору ${Math.round(distAccum)} м`,
                            floor: prev.floor,
                            bldg: prev.bldg,
                            nodeId: prev.id
                        });
                        distAccum = 0;
                    }

                    instructions.push({
                        type: 'bridge',
                        icon: '<svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>',
                        text: `Пройдите по переходу на 2 этаже в Корпус ${curr.bldg}`,
                        floor: 2,
                        bldg: curr.bldg,
                        nodeId: curr.id
                    });

                    currentBldg = curr.bldg;
                    continue;
                }
            }

            distAccum += segDist;

            // 3. Последний шаг — вход в целевой кабинет
            if (i === path.length - 1) {
                if (distAccum > 2.0) {
                    instructions.push({
                        type: 'corridor',
                        icon: '<svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>',
                        text: `Идите прямо ${Math.round(distAccum)} м`,
                        floor: curr.floor,
                        bldg: curr.bldg,
                        nodeId: curr.id
                    });
                }
            }
        }

        instructions.push({
            type: 'destination',
            icon: '<svg class="w-3.5 h-3.5 text-[#1a73e8] dark:text-[#c2e7ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" fill="currentColor" /></svg>',
            text: `Вы прибыли: ${formatNavNodeName(destNode.label, destNode.bldg)}` + (destNode.bldg > 1 && !/^[2-4]-\d/.test(formatNavNodeName(destNode.label, destNode.bldg)) ? ` (Корпус ${destNode.bldg})` : ``) + `, Этаж ${destNode.floor}`,
            floor: destNode.floor,
            bldg: destNode.bldg,
            nodeId: path[path.length - 1]
        });

        return instructions;
    }

    window.doesIntersectWall = doesIntersectWall;
    window.aStarPath = aStarPath;
    window.generateRouteInstructions = generateRouteInstructions;
    window.formatNavNodeName = formatNavNodeName;
    window.formatNavInputString = formatNavInputString;
    window.findClosestToilet = findClosestToilet;
    window.setDefaultStartPoint = setDefaultStartPoint;
