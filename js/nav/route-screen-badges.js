    function renderNavigatorScreenBadges(ctx, dpr, width, height) {
        if (NAV_STATE && NAV_STATE._renderedStairBadges) {
            NAV_STATE._renderedStairBadges.length = 0;
        }
        const renderedStairBadges = (NAV_STATE && NAV_STATE._renderedStairBadges) ? NAV_STATE._renderedStairBadges : [];

        if (!NAV_STATE.activeRoute || !window.camera) return;

        const route = NAV_STATE.activeRoute;
        const mode = (typeof STATE !== 'undefined') ? STATE.mode : '1';
        const isSingleFloor = (mode !== 'all' && mode !== 'sideBySide' && mode !== 'slice');
        const parsedFloor = parseInt(mode, 10);
        const activeFloor = (isSingleFloor && Number.isFinite(parsedFloor)) ? parsedFloor : 1;

        const startNode = route.startNode;
        const destNode = route.destNode;

        function drawScreenBadge(node, label, badgeColor, textColor = '#ffffff', borderColor = '#ffffff', isDest = false) {
            if (!node) return;
            if (isSingleFloor && node.floor !== activeFloor) return;

            // Вычисляем мировые координаты с учётом смещения группы этажа
            const fg = window.floorGroups ? window.floorGroups[node.floor] : null;
            const posY = fg ? fg.position.y : 0;
            const posX = fg ? fg.position.x : 0;
            const posZ = fg ? fg.position.z : 0;

            if (typeof STATE !== 'undefined' && !STATE.is2D && typeof window.isPointOccludedIn3D === 'function') {
                const isExtAnchor = Boolean(node.isOutdoor || node.type === 'entrance');
                if (window.isPointOccludedIn3D(posX + node.x, posY + 1.35, posZ + node.z, node.floor, node.bldg, isExtAnchor)) {
                    return;
                }
            }

            _tempVec.set(posX + node.x, posY + 1.35, posZ + node.z).project(window.camera);
            if (_tempVec.z > 1.0) return; // За камерой

            const sx = (_tempVec.x * 0.5 + 0.5) * width;
            const sy = (-_tempVec.y * 0.5 + 0.5) * height;

            if (sx < -100 || sx > width + 100 || sy < -50 || sy > height + 50) return;

            ctx.save();
            ctx.font = 'bold 12px Inter, sans-serif';
            let textWidth = _badgeWidthCache.get(label);
            if (textWidth === undefined) {
                textWidth = ctx.measureText(label).width;
                _badgeWidthCache.set(label, textWidth);
            }
            const bWidth = textWidth + 28;
            const bHeight = 26;
            const bx = sx - bWidth / 2;
            const by = sy - bHeight - 12;

            // Тень бейджа
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 3;

            // Фон бейджа
            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.roundRect(bx, by, bWidth, bHeight, 7);
            ctx.fill();

            // Обводка бейджа
            ctx.shadowColor = 'transparent';
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = borderColor;
            ctx.stroke();

            // Иконка точки (кружочек с контрастной каймой)
            ctx.fillStyle = textColor === '#ffffff' ? '#ffffff' : borderColor;
            ctx.beginPath();
            ctx.arc(bx + 14, by + bHeight / 2, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.arc(bx + 14, by + bHeight / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Текст бейджа
            ctx.fillStyle = textColor;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, bx + 24, by + bHeight / 2);

            // Маленький указатель (хвостик) вниз
            ctx.fillStyle = badgeColor;
            ctx.beginPath();
            ctx.moveTo(sx - 5, by + bHeight);
            ctx.lineTo(sx, by + bHeight + 6);
            ctx.lineTo(sx + 5, by + bHeight);
            ctx.closePath();
            ctx.fill();

            // Обводка хвостика
            if (borderColor && borderColor !== 'transparent') {
                ctx.lineWidth = 1.2;
                ctx.strokeStyle = borderColor;
                ctx.beginPath();
                ctx.moveTo(sx - 5, by + bHeight);
                ctx.lineTo(sx, by + bHeight + 6);
                ctx.lineTo(sx + 5, by + bHeight);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Рисуем бейдж Откуда (первичный пункт — голубой)
        drawScreenBadge(startNode, `A: ${formatNavNodeName(startNode.label, startNode.bldg)}`, '#c2e7ff', '#004a77', '#1a73e8', false);
        // Рисуем бейдж Куда (конечный пункт — синий)
        drawScreenBadge(destNode, `B: ${formatNavNodeName(destNode.label, destNode.bldg)}`, '#1a73e8', '#ffffff', '#ffffff', true);

        // Рисуем бейджи лестничных переходов
        if (route.stairTransitions) {
            for (const st of route.stairTransitions) {
                if (isSingleFloor && st.fromFloor !== activeFloor) continue;
                drawStairTransitionBadge(st, ctx, width, height);
            }
        }
    }

    function drawStairTransitionBadge(st, ctx, width, height) {
        const fg = window.floorGroups ? window.floorGroups[st.fromFloor] : null;
        const posY = fg ? fg.position.y : 0;
        const posX = fg ? fg.position.x : 0;
        const posZ = fg ? fg.position.z : 0;

        if (typeof STATE !== 'undefined' && !STATE.is2D && typeof window.isPointOccludedIn3D === 'function') {
            if (window.isPointOccludedIn3D(posX + st.x, posY + 0.8, posZ + st.z, st.fromFloor, null, false)) {
                return;
            }
        }

        _tempVec.set(posX + st.x, posY + 0.8, posZ + st.z).project(window.camera);
        if (_tempVec.z > 1.0) return;

        const sx = (_tempVec.x * 0.5 + 0.5) * width;
        const sy = (-_tempVec.y * 0.5 + 0.5) * height;

        ctx.save();
        const text = st.isElevator
            ? (st.isUp ? `↑ Лифт на ${st.toFloor} этаж` : `↓ Лифт на ${st.toFloor} этаж`)
            : (st.isUp ? `↑ Лестница на ${st.toFloor} этаж` : `↓ Лестница на ${st.toFloor} этаж`);
        ctx.font = 'bold 11px Inter, sans-serif';
        const tw = ctx.measureText(text).width;
        const bw = tw + 22;
        const bh = 24;
        const bx = sx - bw / 2;
        const by = sy - bh - 6;

        // Тень бейджа
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // Фон бейджа лестницы — ГОЛУБОЙ (Google Light Blue)
        ctx.fillStyle = '#c2e7ff';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 6);
        ctx.fill();

        // Обводка бейджа лестницы — синяя Google Blue
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = '#1a73e8';
        ctx.stroke();

        // Точка-индикатор
        ctx.fillStyle = '#1a73e8';
        ctx.beginPath();
        ctx.arc(bx + 11, by + bh / 2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Текст — темно-синий (#004a77) для максимального контраста
        ctx.fillStyle = '#004a77';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + 18, by + bh / 2);

        // Хвостик указателя вниз
        ctx.fillStyle = '#c2e7ff';
        ctx.beginPath();
        ctx.moveTo(sx - 4, by + bh);
        ctx.lineTo(sx, by + bh + 5);
        ctx.lineTo(sx + 4, by + bh);
        ctx.closePath();
        ctx.fill();

        ctx.lineWidth = 1.0;
        ctx.strokeStyle = '#1a73e8';
        ctx.beginPath();
        ctx.moveTo(sx - 4, by + bh);
        ctx.lineTo(sx, by + bh + 5);
        ctx.lineTo(sx + 4, by + bh);
        ctx.stroke();

        ctx.restore();

        renderedStairBadges.push({
            x0: bx,
            y0: by,
            x1: bx + bw,
            y1: by + bh + 5,
            fromFloor: st.fromFloor,
            toFloor: st.toFloor,
            targetNode: st.toNode
        });
    }

    window.renderNavigatorScreenBadges = renderNavigatorScreenBadges;

    // ------------------------------------------------------------------------
    // ПУБЛИЧНЫЙ МЕТОД ПОСТРОЕНИЯ МАРШРУТА
    // ------------------------------------------------------------------------
