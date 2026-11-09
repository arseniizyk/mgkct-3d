function collapseRoomCardHistoryForTarget(targetOverlay) {
    if (typeof window === 'undefined' || !window.history) return;
    const state = history.state || {};
    if (state.overlay !== 'room-card') return;

    if (state.overRoute && targetOverlay === 'route' && window.NAV_STATE && window.NAV_STATE.activeRoute) {
        if (state.fromSearch) {
            activeOverlay = 'route';
            isPoppingStateInternal = true;
            try {
                history.go(-2);
            } catch (_) {
                history.back();
            }
            setTimeout(() => { isPoppingStateInternal = false; }, 200);
        } else {
            popOverlayState('room-card');
        }
    } else {
        replaceOverlayState(targetOverlay, {
            overRoute: Boolean(state.overRoute && targetOverlay !== 'route')
        });
    }
}

function hideRoomContextPopup(fromPopstate = false, suppressRouteRestore = false) {
    const wasOverRoute = Boolean(
        (typeof history !== 'undefined' && history.state && history.state.overRoute) ||
        (window.NAV_STATE && window.NAV_STATE.activeRoute)
    );
    if (!fromPopstate) {
        if (history.state && history.state.overlay === 'room-card') {
            if (history.state.fromSearch) {
                activeOverlay = (wasOverRoute && window.NAV_STATE && window.NAV_STATE.activeRoute) ? 'route' : null;
                isPoppingStateInternal = true;
                try {
                    history.go(-2);
                } catch (_) {
                    history.back();
                }
                setTimeout(() => { isPoppingStateInternal = false; }, 200);
            } else {
                popOverlayState('room-card');
            }
        }
    }
    const popup = document.getElementById('room-context-popup');
    if (popup) popup.classList.add('hidden');
    document.body.classList.remove('room-card-open');
    currentPopupRoom = null;
    window.currentPopupRoom = null;

    if (!suppressRouteRestore && window.NAV_STATE && window.NAV_STATE.activeRoute) {
        const routeCard = document.getElementById('navigator-route-card');
        if (routeCard) routeCard.classList.remove('hidden');
        document.body.classList.add('route-active');
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) bottomSearch.classList.add('route-active');
        const floorsContainer = document.getElementById('nav-card-floors');
        if (floorsContainer && typeof STATE !== 'undefined') {
            const activeFloorStr = String(STATE.mode);
            floorsContainer.querySelectorAll('.m3-nav-floor-pill').forEach(btn => {
                btn.classList.toggle('active-pill', btn.textContent.trim() === activeFloorStr);
            });
        }
    } else if (!suppressRouteRestore) {
        if (typeof setFloorSwitcherCollapsed === 'function') {
            setFloorSwitcherCollapsed(false);
        }
        const widgetText = document.getElementById('search-widget-text');
        if (widgetText) {
            widgetText.textContent = 'Поиск по колледжу...';
        }
        const bottomSearch = document.getElementById('bottom-search-bar');
        if (bottomSearch) {
            bottomSearch.classList.remove('route-active', 'hidden');
            bottomSearch.style.removeProperty('display');
            bottomSearch.style.removeProperty('opacity');
            bottomSearch.style.removeProperty('pointer-events');
        }
    }

    updateAdaptiveFabPosition();
}

function setupRoomContextPopup() {
    const btnClose = document.getElementById('btn-close-room-popup');
    if (btnClose) btnClose.addEventListener('click', () => hideRoomContextPopup(false, false));

    const popup = document.getElementById('room-context-popup');
    if (popup) {
        popup.addEventListener('transitionend', updateAdaptiveFabPosition);
        popup.addEventListener('animationend', updateAdaptiveFabPosition);
    }

    function getRoomNavPoint(r) {
        if (!r) return null;
        if (typeof NAV_STATE === 'undefined') return null;
        if (!NAV_STATE.graph && typeof buildCollegeNavGraph === 'function') {
            NAV_STATE.graph = buildCollegeNavGraph();
        }
        const g = NAV_STATE.graph;
        if (!g) return null;

        const f = parseInt(r.floor, 10);
        const b = parseInt(r.building, 10);
        const clean = r.text ? r.text.replace(/\n/g, ' ').trim() : 'Кабинет';

        for (const [, node] of g.nodes.entries()) {
            if (node.floor === f && node.bldg === b && (node.type === 'room' || node.type === 'entrance')) {
                if (Math.hypot(node.x - r.x, node.z - r.z) < 0.25) {
                    return node;
                }
            }
        }
        for (const [, node] of g.nodes.entries()) {
            if (node.floor === f && node.bldg === b && (node.type === 'room' || node.type === 'entrance')) {
                if (node.label === clean || (r.isEntrance && node.type === 'entrance')) return node;
            }
        }
        const closest = g.findClosestNode(f, b, r.x, r.z, ['room', 'door', 'corridor', 'entrance']);
        return closest || { id: `room_${b}_${f}`, label: clean, floor: f, bldg: b, x: r.x, z: r.z };
    }

    const btnFrom = document.getElementById('btn-popup-from');
    if (btnFrom) {
        btnFrom.addEventListener('click', () => {
            if (!currentPopupRoom) return;
            const r = currentPopupRoom;

            if (typeof NAV_STATE !== 'undefined') {
                const roomNode = getRoomNavPoint(r);
                if (roomNode) {
                    const canRebuildActiveRoute = Boolean(
                        NAV_STATE.activeRoute &&
                        NAV_STATE.destPoint &&
                        NAV_STATE.destPoint.id !== roomNode.id &&
                        typeof buildRoute === 'function'
                    );

                    NAV_STATE.startPoint = roomNode;
                    const inputA = document.getElementById('nav-input-start');
                    if (inputA) {
                        inputA.value = typeof formatNavInputString === 'function' ? formatNavInputString(roomNode) : `${roomNode.label || r.text.replace(/\n/g, ' ')} (К-${r.building}, ${r.floor} эт.)`;
                        inputA.removeAttribute('data-is-default');
                        const btnClearA = document.getElementById('btn-clear-start');
                        if (btnClearA) btnClearA.classList.remove('hidden');
                    }

                    if (canRebuildActiveRoute) {
                        const popup = document.getElementById('room-context-popup');
                        if (popup) popup.classList.add('closing-down');
                        setTimeout(() => {
                            if (popup) popup.classList.remove('closing-down');
                            document.body.classList.add('route-active');
                            collapseRoomCardHistoryForTarget('route');
                            hideRoomContextPopup(true, true);
                            window._postponeFloorCollapse = true;
                            buildRoute(roomNode, NAV_STATE.destPoint);
                            window._postponeFloorCollapse = false;
                            setTimeout(() => {
                                if (typeof setFloorSwitcherCollapsed === 'function') {
                                    setFloorSwitcherCollapsed(true, true);
                                }
                            }, 250);
                        }, 160);
                    } else {
                        collapseRoomCardHistoryForTarget('navigator');
                        hideRoomContextPopup(true, true);
                        if (typeof openNavigatorModal === 'function') {
                            openNavigatorModal('dest');
                        }
                    }
                    return;
                }
            }
            hideRoomContextPopup(false, false);
        });
    }

    const btnTo = document.getElementById('btn-popup-to');
    if (btnTo) {
        btnTo.addEventListener('click', () => {
            if (!currentPopupRoom) return;
            const r = currentPopupRoom;

            if (typeof NAV_STATE !== 'undefined') {
                const roomNode = getRoomNavPoint(r);
                if (roomNode) {
                    NAV_STATE.destPoint = roomNode;
                    const inputB = document.getElementById('nav-input-dest');
                    if (inputB) {
                        inputB.value = typeof formatNavInputString === 'function' ? formatNavInputString(roomNode) : `${roomNode.label || r.text.replace(/\n/g, ' ')} (К-${r.building}, ${r.floor} эт.)`;
                        const btnClearB = document.getElementById('btn-clear-dest');
                        if (btnClearB) btnClearB.classList.remove('hidden');
                    }

                    if (!NAV_STATE.startPoint) {
                        if (typeof setDefaultStartPoint === 'function') {
                            setDefaultStartPoint();
                        } else {
                            const g = NAV_STATE.graph;
                            if (g) {
                                const entrance = g.getNode('b3_f1_entrance_west') || g.getNode('b1_f1_entrance_main');
                                if (entrance) {
                                    NAV_STATE.startPoint = entrance;
                                    const inputA = document.getElementById('nav-input-start');
                                    if (inputA) {
                                        inputA.value = typeof formatNavInputString === 'function' ? formatNavInputString(entrance) : 'Главный вход (Корпус 3)';
                                        inputA.setAttribute('data-is-default', 'true');
                                        const btnClearA = document.getElementById('btn-clear-start');
                                        if (btnClearA) btnClearA.classList.remove('hidden');
                                    }
                                }
                            }
                        }
                    }

                    const willBuildRoute = Boolean(NAV_STATE.startPoint && NAV_STATE.destPoint && typeof buildRoute === 'function');
                    if (willBuildRoute) {
                        const popup = document.getElementById('room-context-popup');
                        if (popup) popup.classList.add('closing-down');

                        setTimeout(() => {
                            if (popup) popup.classList.remove('closing-down');
                            document.body.classList.add('route-active');
                            collapseRoomCardHistoryForTarget('route');
                            hideRoomContextPopup(true, true);
                            window._postponeFloorCollapse = true;
                            buildRoute(NAV_STATE.startPoint, NAV_STATE.destPoint);
                            window._postponeFloorCollapse = false;
                            setTimeout(() => {
                                if (typeof setFloorSwitcherCollapsed === 'function') {
                                    setFloorSwitcherCollapsed(true, true);
                                }
                            }, 250);
                        }, 160);
                    } else if (typeof openNavigatorModal === 'function') {
                        collapseRoomCardHistoryForTarget('navigator');
                        hideRoomContextPopup(true, true);
                        openNavigatorModal();
                    }
                    return;
                }
            }
            hideRoomContextPopup(false, false);
        });
    }
}

window.showRoomContextPopup = showRoomContextPopup;
window.hideRoomContextPopup = hideRoomContextPopup;
window.toggleTerritoryView = toggleTerritoryView;
