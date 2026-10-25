/**
 * MGKCT // НАВИГАЦИОННЫЙ РЕДАКТОР НОДОВ И ПУТЕЙ (Node Editor)
 * Отображает полноценную 3D/2D карту колледжа (все 4 корпуса, коридоры, кабинеты,
 * лестницы, двери, зелёный внутренний двор) поверх которой наложен граф путей.
 */
(function() {
    'use strict';

    let scene, camera, renderer, controls;
    let editorGraph = null;

    // Режимы взаимодействия: 'select' | 'move' | 'add' | 'connect' | 'del-edge' | 'delete'
    let currentMode = 'select';
    let activeFloor = 1;
    let selectedNodeId = null;
    let connectFirstNodeId = null;
    let isDragging = false;
    let dragNode = null;

    // Отслеживание клика vs перетаскивания камеры (чтобы случайное движение не считалось кликом)
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;

    // Группы 3D объектов
    let masterMapGroup = null;
    const editorGroup = new THREE.Group();
    editorGroup.name = 'EditorNodesAndEdgesGroup';

    const clickableMeshes = [];
    const nodeMeshMap = new Map();

    // Общие переиспользуемые геометрии для молниеносной производительности
    const sphereGeom = new THREE.SphereGeometry(0.32, 10, 10);
    const selectedSphereGeom = new THREE.SphereGeometry(0.5, 14, 14);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Отслеживание изменений для экспорта чистого JS-кода
    const createdNodes = [];
    const createdEdges = [];
    const movedNodes = new Map();
    const removedNodes = new Set();
    const removedEdges = [];

    // Цветовая схема узлов графа
    const NODE_COLORS = {
        outdoor: 0x10b981,    // Изумрудно-зеленый для уличных узлов
        door: 0x38bdf8,       // Голубой для дверей
        porch: 0x06b6d4,      // Бирюзовый для крылец
        hallway: 0x94a3b8,    // Серый для коридоров
        room: 0xf59e0b,       // Янтарный для кабинетов
        stair: 0xec4899,      // Розовый для лестниц
        transition: 0x8b5cf6  // Фиолетовый для переходов
    };

    // 1. Инициализация Three.js сцены с полной картой колледжа
    function init() {
        const container = document.getElementById('canvas-container');
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x11141a);

        // Камера
        camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.2, 1000);
        camera.position.set(28, 70, -25);

        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);

        // Настройка управления камерой:
        // ЛКМ (в пустом месте / Drag) = Панорамирование (Pan / Move)
        // ПКМ = Вращение (Rotate)
        // Колесико / СКМ = Зум / Панорамирование
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(28, 0, -25);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI / 2 - 0.01;
        controls.screenSpacePanning = true;

        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };

        // Освещение
        const ambient = new THREE.AmbientLight(0xdce3ed, 0.9);
        scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
        dirLight.position.set(40, 110, 40);
        scene.add(dirLight);

        const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.35);
        dirLight2.position.set(-40, 60, -40);
        scene.add(dirLight2);

        // Инженерная координатная сетка
        const grid = new THREE.GridHelper(300, 150, 0x387cff, 0x1e2638);
        grid.position.y = -0.02;
        scene.add(grid);

        // Плоскость для рейкастинга кликов по полу (в режиме ADD и MOVE)
        const groundGeom = new THREE.PlaneGeometry(500, 500);
        const groundMat = new THREE.MeshBasicMaterial({ visible: false });
        const groundMesh = new THREE.Mesh(groundGeom, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.name = 'GroundRaycastPlane';
        scene.add(groundMesh);

        // 2. Сборка 3D модели колледжа и территории
        buildFullCollegeMap();

        // Добавляем слой узлов и путей
        scene.add(editorGroup);

        // Слушатели событий
        window.addEventListener('resize', onWindowResize);
        container.addEventListener('pointerdown', onPointerDown, false);
        container.addEventListener('pointermove', onPointerMove, false);
        window.addEventListener('pointerup', onPointerUp, false);
        window.addEventListener('keydown', onKeyDown, false);

        setupUI();
        loadNavigatorGraph();
        animate();
    }

    // 2. Сборка всех зданий и территории
    function buildFullCollegeMap() {
        masterMapGroup = new THREE.Group();
        masterMapGroup.name = 'MasterCollegeMapGroup';

        for (let f = 1; f <= 7; f++) {
            window.floorGroups[f] = new THREE.Group();
            window.bldg1FloorGroups[f] = new THREE.Group();
            window.bldg2FloorGroups[f] = new THREE.Group();
            window.bldg3FloorGroups[f] = new THREE.Group();
            window.bldg4FloorGroups[f] = new THREE.Group();

            window.floorGroups[f].add(window.bldg1FloorGroups[f]);
            window.floorGroups[f].add(window.bldg2FloorGroups[f]);
            window.floorGroups[f].add(window.bldg3FloorGroups[f]);
            window.floorGroups[f].add(window.bldg4FloorGroups[f]);

            masterMapGroup.add(window.floorGroups[f]);
        }

        window.territoryGroup = new THREE.Group();
        masterMapGroup.add(window.territoryGroup);

        try {
            if (typeof buildFloor1 === 'function') buildFloor1(window.bldg1FloorGroups[1]);
            if (typeof buildFloor2 === 'function') buildFloor2(window.bldg1FloorGroups[2]);
            if (typeof buildFloor3 === 'function') buildFloor3(window.bldg1FloorGroups[3]);
            if (typeof buildFloor4 === 'function') buildFloor4(window.bldg1FloorGroups[4]);
            if (typeof buildFloor5 === 'function') buildFloor5(window.bldg1FloorGroups[5]);
            if (typeof buildFloor6 === 'function') buildFloor6(window.bldg1FloorGroups[6]);
            if (typeof buildFloor7 === 'function') buildFloor7(window.bldg1FloorGroups[7]);

            if (typeof buildBuilding2Floor1 === 'function') buildBuilding2Floor1(window.bldg2FloorGroups[1]);
            if (typeof buildBuilding2Floor2 === 'function') buildBuilding2Floor2(window.bldg2FloorGroups[2]);
            if (typeof buildBuilding2Floor3 === 'function') buildBuilding2Floor3(window.bldg2FloorGroups[3]);

            if (typeof buildBuilding3Floor1 === 'function') buildBuilding3Floor1(window.bldg3FloorGroups[1]);
            if (typeof buildBuilding3Floor2 === 'function') buildBuilding3Floor2(window.bldg3FloorGroups[2]);

            if (typeof buildBuilding4Floor1 === 'function') buildBuilding4Floor1(window.bldg4FloorGroups[1]);
            if (typeof buildBuilding4Floor2 === 'function') buildBuilding4Floor2(window.bldg4FloorGroups[2]);
            if (typeof buildBuilding4Floor3 === 'function') buildBuilding4Floor3(window.bldg4FloorGroups[3]);

            if (typeof buildTerritory === 'function') {
                buildTerritory();
            }

            updateMapFloorsVisibility();
            scene.add(masterMapGroup);
            console.log('[NodeEditor] 3D Карта колледжа успешно собрана!');
        } catch (err) {
            console.error('[NodeEditor] Ошибка сборки 3D модели колледжа:', err);
        }
    }

    function updateMapFloorsVisibility() {
        if (!masterMapGroup) return;
        for (let f = 1; f <= 7; f++) {
            const fg = window.floorGroups[f];
            if (fg) {
                if (activeFloor === 'all') {
                    fg.visible = true;
                    fg.position.y = (f - 1) * 3.6;
                } else {
                    fg.visible = (f === activeFloor);
                    fg.position.y = 0;
                }
            }
        }
    }

    // 3. Загрузка графа из навигатора
    function loadNavigatorGraph() {
        if (typeof window.buildCollegeNavGraph === 'function') {
            editorGraph = window.buildCollegeNavGraph();
            console.log('[NodeEditor] Граф загружен через buildCollegeNavGraph. Узлов:', editorGraph.nodes.size);
            updateStatusText();
            redrawGraph();
        } else if (window.NAV_STATE && window.NAV_STATE.graph) {
            editorGraph = window.NAV_STATE.graph;
            console.log('[NodeEditor] Граф взят из NAV_STATE.graph. Узлов:', editorGraph.nodes.size);
            updateStatusText();
            redrawGraph();
        } else {
            console.error('[NodeEditor] Граф навигации не найден!');
        }
    }

    // 4. Отрисовка узлов и связей
    function redrawGraph() {
        if (!editorGraph) return;

        while (editorGroup.children.length > 0) {
            const obj = editorGroup.children[0];
            editorGroup.remove(obj);
            if (obj.geometry && obj.geometry !== sphereGeom && obj.geometry !== selectedSphereGeom) {
                obj.geometry.dispose();
            }
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        }
        clickableMeshes.length = 0;
        nodeMeshMap.clear();

        const showNodesLayer = document.getElementById('toggle-layer-nodes')?.classList.contains('active') ?? true;
        if (!showNodesLayer) return;

        // Отрисовка узлов
        editorGraph.nodes.forEach((node, id) => {
            if (removedNodes.has(id)) return;
            if (activeFloor !== 'all' && node.floor !== activeFloor) return;

            const isSelected = (id === selectedNodeId);
            const isConnectTarget = (id === connectFirstNodeId);
            let color = NODE_COLORS[node.type] || 0x38bdf8;
            if (isSelected) color = 0xf59e0b; // Золотистый акцент
            if (isConnectTarget) color = 0xec4899; // Розовый акцент для первой точки связки

            const mat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: (isSelected || isConnectTarget) ? 0xd97706 : (node.type === 'outdoor' ? 0x065f46 : 0x111111),
                emissiveIntensity: (isSelected || isConnectTarget) ? 0.8 : 0.25,
                roughness: 0.35
            });

            const mesh = new THREE.Mesh((isSelected || isConnectTarget) ? selectedSphereGeom : sphereGeom, mat);
            const yPos = (activeFloor === 'all') ? ((node.floor - 1) * 3.6 + 0.45) : 0.45;
            mesh.position.set(node.x, yPos, node.z);
            mesh.userData = { nodeId: id, node: node };

            editorGroup.add(mesh);
            clickableMeshes.push(mesh);
            nodeMeshMap.set(id, mesh);
        });

        // Отрисовка рёбер графа
        const drawnEdges = new Set();
        const indoorLinePositions = [];
        const outdoorLinePositions = [];

        editorGraph.adj.forEach((edges, uId) => {
            if (removedNodes.has(uId)) return;
            const uNode = editorGraph.getNode(uId);
            if (!uNode) return;
            if (activeFloor !== 'all' && uNode.floor !== activeFloor) return;

            edges.forEach(e => {
                const vId = e.to;
                if (removedNodes.has(vId)) return;
                const vNode = editorGraph.getNode(vId);
                if (!vNode) return;
                if (activeFloor !== 'all' && vNode.floor !== activeFloor) return;

                const pairKey = [uId, vId].sort().join('--');
                if (drawnEdges.has(pairKey)) return;
                drawnEdges.add(pairKey);

                const yU = (activeFloor === 'all') ? ((uNode.floor - 1) * 3.6 + 0.45) : 0.45;
                const yV = (activeFloor === 'all') ? ((vNode.floor - 1) * 3.6 + 0.45) : 0.45;

                const isOutdoor = (uNode.type === 'outdoor' || vNode.type === 'outdoor');
                if (isOutdoor) {
                    outdoorLinePositions.push(uNode.x, yU, uNode.z, vNode.x, yV, vNode.z);
                } else {
                    indoorLinePositions.push(uNode.x, yU, uNode.z, vNode.x, yV, vNode.z);
                }
            });
        });

        if (indoorLinePositions.length > 0) {
            const lineGeom = new THREE.BufferGeometry();
            lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(indoorLinePositions, 3));
            const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, opacity: 0.6, transparent: true });
            const lineMesh = new THREE.LineSegments(lineGeom, lineMat);
            editorGroup.add(lineMesh);
        }

        if (outdoorLinePositions.length > 0) {
            const lineGeom = new THREE.BufferGeometry();
            lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(outdoorLinePositions, 3));
            const lineMat = new THREE.LineBasicMaterial({ color: 0x10b981, opacity: 0.95, transparent: true, linewidth: 2 });
            const lineMesh = new THREE.LineSegments(lineGeom, lineMat);
            editorGroup.add(lineMesh);
        }

        updatePropsPanel();
    }

    // 5. Инспектор свойств выбранного узла
    function updatePropsPanel() {
        const emptyMsg = document.getElementById('props-empty-msg');
        const details = document.getElementById('props-details');
        const statusTag = document.getElementById('prop-status-tag');

        const hasSelected = selectedNodeId && editorGraph && (
            (typeof editorGraph.hasNode === 'function' ? editorGraph.hasNode(selectedNodeId) : editorGraph.nodes.has(selectedNodeId))
        );

        if (!hasSelected) {
            emptyMsg?.classList.remove('hidden');
            details?.classList.add('hidden');
            if (statusTag) {
                statusTag.innerText = '[НЕТ ВЫБОРА]';
                statusTag.style.color = '#828ea3';
            }
            return;
        }

        const node = editorGraph.getNode(selectedNodeId);
        emptyMsg?.classList.add('hidden');
        details?.classList.remove('hidden');
        if (statusTag) {
            statusTag.innerText = `[ВЫБРАН: ${node.id}]`;
            statusTag.style.color = '#58a6ff';
        }

        document.getElementById('prop-id').innerText = node.id;
        document.getElementById('prop-type').innerText = node.type;
        document.getElementById('prop-bldg').innerText = node.bldg === 0 ? '0 (Улица)' : `Корпус ${node.bldg}`;
        document.getElementById('prop-floor').innerText = node.floor;
        document.getElementById('prop-coords').innerText = `${node.x.toFixed(1)}, ${node.z.toFixed(1)}`;
        document.getElementById('prop-label').innerText = node.label || '—';

        // Список связанных ребер
        const neighbors = (editorGraph.adj.get(selectedNodeId) || []).filter(e => !removedNodes.has(e.to));
        document.getElementById('prop-edges-count').innerText = neighbors.length;

        const listEl = document.getElementById('prop-edges-list');
        listEl.innerHTML = '';
        if (neighbors.length === 0) {
            listEl.innerHTML = '<li class="edge-item" style="color:#da3633; font-style:italic;">Изолированный узел (нет связей)</li>';
        } else {
            neighbors.forEach(e => {
                const li = document.createElement('li');
                li.className = 'edge-item';
                li.innerHTML = `
                    <span title="${e.to}">${e.to}</span>
                    <button class="edge-del-btn" title="Разорвать связь">&times;</button>
                `;
                li.querySelector('.edge-del-btn').addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    disconnectNodes(selectedNodeId, e.to);
                });
                listEl.appendChild(li);
            });
        }
    }

    function disconnectNodes(u, v) {
        const adjU = editorGraph.adj.get(u) || [];
        editorGraph.adj.set(u, adjU.filter(e => e.to !== v));
        const adjV = editorGraph.adj.get(v) || [];
        editorGraph.adj.set(v, adjV.filter(e => e.to !== u));

        removedEdges.push({ u, v });
        setHint(`Связь разорвана: ${u} ✂ ${v}`);
        redrawGraph();
    }

    function showConfirmModal(title, msg, onConfirm) {
        // Защита от бешеных вращений камеры
        controls.resetDelta?.();

        const overlay = document.getElementById('confirm-modal-overlay');
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-msg');
        const okBtn = document.getElementById('confirm-modal-ok');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        if (!overlay) {
            if (confirm(msg)) onConfirm();
            return;
        }

        titleEl.innerText = title;
        msgEl.innerText = msg;
        overlay.classList.remove('hidden');

        const cleanup = () => {
            overlay.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            // Сбрасываем инерцию камеры, чтобы не раскручивалась
            controls.dampingFactor = 0.08;
        };

        okBtn.onclick = () => {
            cleanup();
            onConfirm();
        };

        cancelBtn.onclick = () => {
            cleanup();
        };
    }

    function deleteNode(id) {
        showConfirmModal('Удаление узла', `Удалить навигационный узел ${id}?`, () => {
            removedNodes.add(id);
            editorGraph.nodes.delete(id);
            if (selectedNodeId === id) selectedNodeId = null;
            if (connectFirstNodeId === id) connectFirstNodeId = null;
            setHint(`Узел ${id} удален`);
            redrawGraph();
        });
    }

    // 6. Мышь и управление картой
    function getPointerPos(e) {
        const container = document.getElementById('canvas-container');
        const rect = container.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((e.clientY - rect.top) / rect.height) * 2 + 1
        };
    }

    function onPointerDown(e) {
        if (e.target.closest('#top-toolbar') || e.target.closest('.side-panel') || e.target.closest('#export-modal') || e.target.closest('#confirm-modal-overlay')) {
            return;
        }

        pointerDownPos = { x: e.clientX, y: e.clientY };
        pointerDownTime = performance.now();

        if (e.button !== 0) return; // Только ЛКМ для интерактивных действий инструментов

        const pos = getPointerPos(e);
        mouse.x = pos.x;
        mouse.y = pos.y;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(clickableMeshes, false);
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const nodeId = hitMesh.userData.nodeId;

            if (currentMode === 'move') {
                isDragging = true;
                dragNode = hitMesh.userData.node;
                selectedNodeId = nodeId;
                controls.enabled = false;
                redrawGraph();
                return;
            }
        }
    }

    function onPointerMove(e) {
        const pos = getPointerPos(e);
        mouse.x = pos.x;
        mouse.y = pos.y;
        raycaster.setFromCamera(mouse, camera);

        const ground = scene.getObjectByName('GroundRaycastPlane');
        if (ground) {
            const hits = raycaster.intersectObject(ground, false);
            if (hits.length > 0) {
                const pt = hits[0].point;
                const coordsEl = document.getElementById('status-cursor-coords');
                if (coordsEl) {
                    coordsEl.innerText = `X: ${pt.x.toFixed(1)} | Z: ${pt.z.toFixed(1)}`;
                }

                if (isDragging && dragNode) {
                    dragNode.x = parseFloat(pt.x.toFixed(1));
                    dragNode.z = parseFloat(pt.z.toFixed(1));
                    movedNodes.set(dragNode.id, { x: dragNode.x, z: dragNode.z });
                    redrawGraph();
                }
            }
        }
    }

    function onPointerUp(e) {
        if (isDragging) {
            isDragging = false;
            dragNode = null;
            controls.enabled = true;
            return;
        }

        if (e.button !== 0) return;
        if (e.target.closest('#top-toolbar') || e.target.closest('.side-panel') || e.target.closest('#export-modal') || e.target.closest('#confirm-modal-overlay')) {
            return;
        }

        // Проверяем, был ли это чистый клик или перетаскивание панорамы
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
            // Пользователь перемещал камеру, не считаем это кликом по карте
            return;
        }

        const pos = getPointerPos(e);
        mouse.x = pos.x;
        mouse.y = pos.y;
        raycaster.setFromCamera(mouse, camera);

        // 1. Проверяем клик по узлу
        const intersects = raycaster.intersectObjects(clickableMeshes, false);
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const nodeId = hitMesh.userData.nodeId;
            handleNodeClick(nodeId);
            return;
        }

        // 2. Клик в пустое место
        handleEmptyClick();
    }

    function handleEmptyClick() {
        if (currentMode === 'add') {
            // В режиме ADD создаем новый узел на полу
            const ground = scene.getObjectByName('GroundRaycastPlane');
            if (ground) {
                const hits = raycaster.intersectObject(ground, false);
                if (hits.length > 0) {
                    const pt = hits[0].point;
                    addNewNodeAt(pt.x, pt.z);
                }
            }
            return;
        }

        // В любых других режимах (select, connect, del-edge, delete) клик в пустоту сбрасывает выбор
        if (selectedNodeId !== null || connectFirstNodeId !== null) {
            selectedNodeId = null;
            connectFirstNodeId = null;
            setHint('Выбор сброшен. Кликните узел для работы или выберите инструмент.');
            redrawGraph();
        }
    }

    function handleNodeClick(nodeId) {
        if (currentMode === 'select' || currentMode === 'move') {
            selectedNodeId = nodeId;
            connectFirstNodeId = null;
            setHint(`Выбран узел: ${nodeId}`);
            redrawGraph();
            return;
        }

        if (currentMode === 'add') {
            // В режиме ADD клик по существующему узлу делает его началом цепочки
            selectedNodeId = nodeId;
            setHint(`Узел ${nodeId} выбран как начало цепочки. Следующий клик по карте соединит новую точку с ним.`);
            redrawGraph();
            return;
        }

        if (currentMode === 'connect') {
            if (!connectFirstNodeId) {
                connectFirstNodeId = nodeId;
                selectedNodeId = nodeId;
                setHint(`[1/2] Начальный узел: ${nodeId}. Теперь кликните 2-й узел для создания ребра.`);
                redrawGraph();
            } else if (connectFirstNodeId !== nodeId) {
                editorGraph.addEdge(connectFirstNodeId, nodeId);
                createdEdges.push({ u: connectFirstNodeId, v: nodeId });
                setHint(`Связано: ${connectFirstNodeId} ↔ ${nodeId}. Кликните следующий для продолжения.`);
                connectFirstNodeId = nodeId; // Готово к непрерывной связке цепочкой
                selectedNodeId = nodeId;
                redrawGraph();
            }
            return;
        }

        if (currentMode === 'del-edge') {
            if (!connectFirstNodeId) {
                connectFirstNodeId = nodeId;
                selectedNodeId = nodeId;
                setHint(`[1/2] Первый узел: ${nodeId}. Кликните соседний узел для удаления ребра.`);
                redrawGraph();
            } else if (connectFirstNodeId !== nodeId) {
                disconnectNodes(connectFirstNodeId, nodeId);
                connectFirstNodeId = null;
                selectedNodeId = null;
            }
            return;
        }

        if (currentMode === 'delete') {
            deleteNode(nodeId);
        }
    }

    function addNewNodeAt(x, z) {
        const type = document.getElementById('new-node-type').value || 'outdoor';
        const bldg = parseInt(document.getElementById('new-node-building').value, 10) || 0;
        const label = document.getElementById('new-node-label').value.trim() || (type === 'outdoor' ? 'Внутренний двор' : 'Новый узел');
        const floor = (activeFloor === 'all') ? 1 : activeFloor;

        const rnd = Math.floor(10000 + Math.random() * 90000);
        const newId = (type === 'outdoor') ? `outdoor_node_${rnd}` : `custom_node_${rnd}`;

        const nodeObj = {
            id: newId,
            floor: floor,
            bldg: bldg,
            x: parseFloat(x.toFixed(1)),
            z: parseFloat(z.toFixed(1)),
            type: type,
            label: label
        };

        editorGraph.addNode(nodeObj.id, nodeObj.floor, nodeObj.bldg, nodeObj.x, nodeObj.z, nodeObj.type, nodeObj.label);
        createdNodes.push(nodeObj);

        // Если был выбран предыдущий узел, сразу связываем цепочкой
        const prevId = selectedNodeId;
        const hasPrev = prevId && editorGraph && (
            (typeof editorGraph.hasNode === 'function' ? editorGraph.hasNode(prevId) : editorGraph.nodes.has(prevId))
        );

        if (hasPrev) {
            editorGraph.addEdge(prevId, newId);
            createdEdges.push({ u: prevId, v: newId });
            setHint(`Добавлен и связан узел ${newId} (${nodeObj.x}, ${nodeObj.z}) с ${prevId}. [Esc - разорвать цепочку]`);
        } else {
            setHint(`Добавлен узел ${newId} (${nodeObj.x}, ${nodeObj.z}). [Esc - сбросить выбор]`);
        }

        selectedNodeId = newId;
        redrawGraph();
    }

    function onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Esc: сброс выбора и отмена цепочки
        if (e.key === 'Escape') {
            selectedNodeId = null;
            connectFirstNodeId = null;
            if (isDragging) {
                isDragging = false;
                dragNode = null;
                controls.enabled = true;
            }
            setHint('Выбор и цепочка сброшены (Esc).');
            redrawGraph();
            return;
        }

        // Delete / Backspace: удалить выбранный узел
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
            deleteNode(selectedNodeId);
            return;
        }

        // Цифровые горячие клавиши для быстрой смены режимов
        if (e.key === '1') setToolMode('select');
        if (e.key === '2') setToolMode('move');
        if (e.key === '3') setToolMode('add');
        if (e.key === '4') setToolMode('connect');
        if (e.key === '5') setToolMode('del-edge');
        if (e.key === '6') setToolMode('delete');
    }

    function setToolMode(mode) {
        currentMode = mode;
        isDragging = false;
        dragNode = null;
        connectFirstNodeId = null;

        document.querySelectorAll('.mode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === currentMode);
        });

        if (currentMode === 'select') setHint('[1] Режим: Выбор. Кликните узел для просмотра свойств. Клик в пустоту — сброс.');
        if (currentMode === 'move') setHint('[2] Режим: Двигать. Зажмите узел левой кнопкой мыши и перемещайте.');
        if (currentMode === 'add') setHint('[3] Режим: + Узел. Кликайте по карте — точки связываются цепочкой! Esc — прервать цепочку.');
        if (currentMode === 'connect') setHint('[4] Режим: Связать. Кликните первый узел, затем второй.');
        if (currentMode === 'del-edge') setHint('[5] Режим: Разрыв. Кликните два узла для удаления ребра между ними.');
        if (currentMode === 'delete') setHint('[6] Режим: Удалить. Кликните по узлу для удаления.');

        redrawGraph();
    }

    function setHint(text) {
        const el = document.getElementById('status-hint');
        if (el) el.innerText = text;
    }

    function updateStatusText() {
        if (!editorGraph) return;
        setHint(`Граф готов. Узлов: ${editorGraph.nodes.size} | Этаж: ${activeFloor} | ЛКМ/СКМ — перемещение карты, ПКМ — вращение`);
    }

    // 7. Экспорт готового кода
    function generateExportCode() {
        let code = `// ============================================================================\n`;
        code += `// СГЕНЕРИРОВАННЫЙ КОД ДЛЯ js/navigator.js -> buildCollegeNavGraph()\n`;
        code += `// ============================================================================\n\n`;

        if (movedNodes.size > 0) {
            code += `// --- ИЗМЕНЕННЫЕ КООРДИНАТЫ УЗЛОВ ---\n`;
            for (const [id, c] of movedNodes.entries()) {
                code += `// Узел ${id}: обновить x: ${c.x}, z: ${c.z}\n`;
            }
            code += `\n`;
        }

        if (createdNodes.length > 0) {
            code += `        // --- 1. НОВЫЕ УЗЛЫ (Вставить в раздел g.addNode) ---\n`;
            createdNodes.forEach(n => {
                code += `        g.addNode('${n.id}', ${n.floor}, ${n.bldg}, ${n.x}, ${n.z}, '${n.type}', '${n.label}');\n`;
            });
            code += `\n`;
        }

        if (createdEdges.length > 0) {
            code += `        // --- 2. НОВЫЕ СВЯЗИ (Вставить в раздел g.addEdge перед return g) ---\n`;
            createdEdges.forEach(e => {
                code += `        g.addEdge('${e.u}', '${e.v}');\n`;
            });
            code += `\n`;
        }

        if (removedEdges.length > 0) {
            code += `        // --- 3. УДАЛЕННЫЕ РЕБРА (Удалите соответствующие вызовы g.addEdge) ---\n`;
            removedEdges.forEach(e => {
                code += `        // Удалить: g.addEdge('${e.u}', '${e.v}');\n`;
            });
            code += `\n`;
        }

        if (removedNodes.size > 0) {
            code += `        // --- 4. УДАЛЕННЫЕ УЗЛЫ ---\n`;
            removedNodes.forEach(id => {
                code += `        // Удалить узел: ${id}\n`;
            });
            code += `\n`;
        }

        if (createdNodes.length === 0 && createdEdges.length === 0 && removedEdges.length === 0 && movedNodes.size === 0 && removedNodes.size === 0) {
            code += `// Изменений нет. Поставьте или измените узлы в редакторе!\n`;
        }

        const modal = document.getElementById('export-modal');
        const textarea = document.getElementById('export-textarea');
        textarea.value = code;
        modal.classList.remove('hidden');
    }

    // 8. Настройка UI кнопок и переключателей
    function setupUI() {
        document.querySelectorAll('.floor-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = btn.dataset.floor;
                activeFloor = f === 'all' ? 'all' : parseInt(f, 10);
                document.querySelectorAll('.floor-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.floor == f);
                });
                updateMapFloorsVisibility();
                updateStatusText();
                redrawGraph();
            });
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setToolMode(btn.dataset.mode);
            });
        });

        document.getElementById('toggle-layer-buildings')?.addEventListener('click', function() {
            this.classList.toggle('active');
            const visible = this.classList.contains('active');
            for (let f = 1; f <= 7; f++) {
                if (window.bldg1FloorGroups[f]) window.bldg1FloorGroups[f].visible = visible;
                if (window.bldg2FloorGroups[f]) window.bldg2FloorGroups[f].visible = visible;
                if (window.bldg3FloorGroups[f]) window.bldg3FloorGroups[f].visible = visible;
                if (window.bldg4FloorGroups[f]) window.bldg4FloorGroups[f].visible = visible;
            }
        });

        document.getElementById('toggle-layer-territory')?.addEventListener('click', function() {
            this.classList.toggle('active');
            if (window.territoryGroup) {
                window.territoryGroup.visible = this.classList.contains('active');
            }
        });

        document.getElementById('toggle-layer-nodes')?.addEventListener('click', function() {
            this.classList.toggle('active');
            redrawGraph();
        });

        document.getElementById('btn-view-top')?.addEventListener('click', () => {
            camera.position.set(28, 90, -25);
            controls.target.set(28, 0, -25);
            controls.update();
        });

        document.getElementById('btn-view-persp')?.addEventListener('click', () => {
            camera.position.set(28, 65, 15);
            controls.target.set(28, 0, -25);
            controls.update();
        });

        document.getElementById('walls-opacity')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (window.MATERIALS && MATERIALS.wall) {
                MATERIALS.wall.transparent = val < 0.99;
                MATERIALS.wall.opacity = val;
            }
            if (window.MATERIALS && MATERIALS.innerWall) {
                MATERIALS.innerWall.transparent = val < 0.99;
                MATERIALS.innerWall.opacity = val;
            }
        });

        document.getElementById('btn-delete-node')?.addEventListener('click', () => {
            if (selectedNodeId) deleteNode(selectedNodeId);
        });

        document.getElementById('btn-export-code')?.addEventListener('click', generateExportCode);
        document.getElementById('btn-close-modal')?.addEventListener('click', () => {
            document.getElementById('export-modal').classList.add('hidden');
        });
        document.getElementById('btn-dismiss-modal')?.addEventListener('click', () => {
            document.getElementById('export-modal').classList.add('hidden');
        });
        document.getElementById('btn-copy-code')?.addEventListener('click', () => {
            const ta = document.getElementById('export-textarea');
            ta.select();
            navigator.clipboard.writeText(ta.value).then(() => {
                alert('JS-код скопирован в буфер обмена!');
            }).catch(() => {
                document.execCommand('copy');
                alert('JS-код скопирован!');
            });
        });
    }

    function onWindowResize() {
        const container = document.getElementById('canvas-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener('DOMContentLoaded', init);
})();
