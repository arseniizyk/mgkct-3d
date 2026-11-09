function drawScrew(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 1);
    ctx.lineTo(x + 3, y + 1);
    ctx.stroke();
    ctx.restore();
}

function drawMinsktransFooterPlaque(ctx, CW, code) {
    const sx0 = 16, sy0 = 508, sx1 = CW - 16, sy1 = 628;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx0 + 2, sy0 + 2, sx1 - sx0 - 4, sy1 - sy0 - 4);

    drawScrew(ctx, sx0 + 8, sy0 + (sy1 - sy0) / 2);
    drawScrew(ctx, sx1 - 8, sy0 + (sy1 - sy0) / 2);

    // QR-код слева
    const qx = sx0 + 24, qy = sy0 + 14, qs = 90;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(qx, qy, qs, qs);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx + 5, qy + 5, qs - 10, qs - 10);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(qx + 12, qy + 12, 24, 24);
    ctx.fillRect(qx + qs - 36, qy + 12, 24, 24);
    ctx.fillRect(qx + 12, qy + qs - 36, 24, 24);
    ctx.fillRect(qx + 40, qy + 40, 20, 20);

    // USSD блок
    ctx.beginPath();
    ctx.moveTo(sx0 + 130, sy0 + 10); ctx.lineTo(sx0 + 130, sy1 - 10);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11.5px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('USSD-запыт пра прыбыццё', sx0 + 144, sy0 + 16);

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 20px "Inter", monospace, sans-serif';
    ctx.fillText(`*960*${code}#`, sx0 + 144, sy0 + 38);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 12.5px "Inter", sans-serif';
    ctx.fillText('ПАСЛУГА ПЛАТНАЯ', sx0 + 144, sy0 + 68);

    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillText('A1   life:)   МТС', sx0 + 144, sy0 + 88);

    // Блок 488 (как на фото)
    ctx.beginPath();
    ctx.moveTo(sx0 + 430, sy0 + 10); ctx.lineTo(sx0 + 430, sy1 - 10);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.fillText('КАРОТКІ НУМАР 488 (ПАСЛУГА БЯСПЛАТНАЯ)', sx0 + 448, sy0 + 16);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px "Inter", sans-serif';
    ctx.fillText('Патэлефануй па нумары 488  •  Паведамі код прыпынку ' + code, sx0 + 448, sy0 + 46);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillText('Атрымай галасавую інфармацыю пра час да прыбыцця транспарту', sx0 + 448, sy0 + 76);
}

function drawMinsktransBoardCanvas(canvas, kind, title, code, routes, isBus) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const CW = canvas.width || 1024;
    const CH = canvas.height || 640;

    ctx.clearRect(0, 0, CW, CH);

    // ----------------------------------------------------
    // 1. ВЕРХНЯЯ ЭМАЛИРОВАННАЯ ТАБЛИЧКА СО СКОШЕННЫМИ УГЛАМИ 45°
    // ----------------------------------------------------
    const px0 = 16, py0 = 12, px1 = CW - 16, py1 = 492;
    const c = 20; // скос углов 45 градусов

    function traceChamferedRect(x0, y0, x1, y1, ch) {
        ctx.beginPath();
        ctx.moveTo(x0 + ch, y0);
        ctx.lineTo(x1 - ch, y0);
        ctx.lineTo(x1, y0 + ch);
        ctx.lineTo(x1, y1 - ch);
        ctx.lineTo(x1 - ch, y1);
        ctx.lineTo(x0 + ch, y1);
        ctx.lineTo(x0, y1 - ch);
        ctx.lineTo(x0, y0 + ch);
        ctx.closePath();
    }

    // Тело эмалированной таблички (белая эмаль)
    traceChamferedRect(px0, py0, px1, py1, c);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Внутренняя черная кайма
    traceChamferedRect(px0 + 3, py0 + 3, px1 - 3, py1 - 3, c - 2);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Крепежные винты по 4 скошенным углам
    drawScrew(ctx, px0 + c / 2 + 2, py0 + c / 2 + 2);
    drawScrew(ctx, px1 - c / 2 - 2, py0 + c / 2 + 2);
    drawScrew(ctx, px1 - c / 2 - 2, py1 - c / 2 - 2);
    drawScrew(ctx, px0 + c / 2 + 2, py1 - c / 2 - 2);

    // Шапка: Эмблема, Название остановки, Оранжевый бейдж кода
    if (kind === 'trolley') {
        ctx.fillStyle = '#0f5fa6';
        const lx = 36, ly = 22, lw = 42, lh = 46;
        const stemW = 16, barH = 12;
        const stemX = lx + (lw - stemW) / 2;
        ctx.fillRect(lx, ly, lw, barH);
        ctx.fillRect(stemX, ly + barH, stemW, lh - barH);
        ctx.fillRect(stemX - 5, ly + lh - 6, stemW + 10, 6);
    } else {
        ctx.fillStyle = '#d32f2f';
        ctx.font = '900 56px "Inter", "Arial Black", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('А', 36, 14);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '800 32px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, 94, 26);

    const bx = px1 - 138, by = 20, bw = 126, bh = 46, br = 6;
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(bx, by, bw, bh, br);
    } else {
        ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#c2410c';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 28px "Inter", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, bx + bw / 2, by + bh / 2 + 1);

    // Табличная шапка Минсктранс
    const yTop = 76, yH = 44;
    const col1 = px0 + 106, col2 = px0 + 214, col3 = px1 - 126;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(px0 + 8, yTop, px1 - px0 - 16, yH);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px0 + 8, yTop, px1 - px0 - 16, yH);

    ctx.beginPath();
    ctx.moveTo(col1, yTop); ctx.lineTo(col1, yTop + yH);
    ctx.moveTo(col2, yTop); ctx.lineTo(col2, yTop + yH);
    ctx.moveTo(col3, yTop); ctx.lineTo(col3, yTop + yH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(col2, yTop + 20); ctx.lineTo(col3, yTop + 20);
    const intW = (col3 - col2) / 4;
    for (let i = 1; i < 4; i++) {
        ctx.moveTo(col2 + intW * i, yTop + 20);
        ctx.lineTo(col2 + intW * i, yTop + yH);
    }
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12.5px "Inter", sans-serif';
    ctx.fillText('№ МАРШ-', (px0 + 8 + col1) / 2, yTop + 12);
    ctx.fillText('РУТАЎ', (px0 + 8 + col1) / 2, yTop + 30);

    ctx.fillText('ПАЧАТАК', (col1 + col2) / 2, yTop + 12);
    ctx.fillText('РУХУ', (col1 + col2) / 2, yTop + 30);

    ctx.fillText('ІНТЭРВАЛ РУХУ ПА ГАДЗІНАХ СУТАК, ХВІЛ.', (col2 + col3) / 2, yTop + 10);
    ctx.font = 'bold 11.5px "Inter", sans-serif';
    const subLabels = ['6-9', '9-15', '15-19', '19-24'];
    for (let i = 0; i < 4; i++) {
        ctx.fillText(subLabels[i], col2 + intW * (i + 0.5), yTop + 31);
    }

    ctx.font = 'bold 12.5px "Inter", sans-serif';
    ctx.fillText('ЗАКАНЧЭННЕ', (col3 + px1 - 8) / 2, yTop + 12);
    ctx.fillText('РУХУ', (col3 + px1 - 8) / 2, yTop + 30);

    // Строки маршрутов с точным расписанием
    const yStart = yTop + yH;
    const yEnd = py1 - 6;
    const availableH = yEnd - yStart;

    const fRnum = isBus ? '900 44px "Inter", sans-serif' : '900 38px "Inter", sans-serif';
    const fDest = isBus ? 'bold 16px "Inter", sans-serif' : 'bold 14.5px "Inter", sans-serif';
    const fDay = 'bold 13px "Inter", sans-serif';
    const fHour = '900 13px "Inter", monospace, sans-serif';
    const fMin = '600 12px "Inter", monospace, sans-serif';

    const lineStep = isBus ? 18 : 16;
    const dayGap = isBus ? 6 : 4;
    const destGap = 6;
    const hourOffset = 48;
    const itemGap = 6;

    const routeLayouts = [];
    let totalWeight = 0;

    routes.forEach(r => {
        const dayLayouts = [];
        let rLinesCount = 0;
        r.days.forEach(sRow => {
            const lines = [];
            let curLine = [];
            let curX = col1 + 10 + hourOffset;

            const hourWidthMap = new Map();
            const minWidthMap = new Map();
            sRow.hours.forEach(item => {
                const hStr = item.h;
                const mStr = item.m.join(',');
                let hw = hourWidthMap.get(hStr);
                if (hw === undefined) {
                    ctx.font = fHour;
                    hw = ctx.measureText(hStr).width;
                    hourWidthMap.set(hStr, hw);
                }
                let mw = minWidthMap.get(mStr);
                if (mw === undefined) {
                    ctx.font = fMin;
                    mw = ctx.measureText(mStr).width;
                    minWidthMap.set(mStr, mw);
                }
                const itemW = hw + mw + itemGap;

                if (curX + itemW > px1 - 14 && curLine.length > 0) {
                    lines.push(curLine);
                    curLine = [];
                    curX = col1 + 10 + hourOffset;
                }
                curLine.push({ h: hStr, m: mStr, hw, mw });
                curX += itemW;
            });

            if (curLine.length > 0) lines.push(curLine);
            dayLayouts.push({ label: sRow.label, lines });
            rLinesCount += lines.length;
        });

        const neededH = 18 + destGap + rLinesCount * lineStep + dayLayouts.length * dayGap + 8;
        routeLayouts.push({ route: r, dayLayouts, linesCount: rLinesCount, neededH });
        totalWeight += neededH;
    });

    const scale = availableH / (totalWeight || 1);
    let curY = yStart;

    routeLayouts.forEach((rl, idx) => {
        const r = rl.route;
        const rH = (idx === routeLayouts.length - 1) ? (yEnd - curY) : Math.round(rl.neededH * scale);
        const contentH = 18 + destGap + rl.linesCount * lineStep + rl.dayLayouts.length * dayGap;
        const offsetY = Math.max(3, Math.floor((rH - contentH) / 2));
        const contentTop = curY + offsetY;

        // Номер маршрута слева
        ctx.fillStyle = '#0f172a';
        ctx.font = fRnum;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const numCenterX = (px0 + 8 + col1) / 2;
        const numCenterY = curY + rH / 2 - (r.wheelchair ? 8 : 1);
        ctx.fillText(r.num, numCenterX, numCenterY);

        if (r.wheelchair) {
            ctx.fillStyle = '#0284c7';
            ctx.font = 'bold 15px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.fillText('♿', numCenterX, numCenterY + 24);
        }

        // Направление маршрута
        ctx.fillStyle = '#0f172a';
        ctx.font = fDest;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(r.dest, col1 + 10, contentTop);

        // Дата утверждения
        if (r.date) {
            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 11px "Inter", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(r.date, px1 - 14, contentTop + 2);
        }

        // Строки отправлений (красный час, черные минуты)
        let lineY = contentTop + 18 + destGap;
        rl.dayLayouts.forEach(dl => {
            ctx.fillStyle = '#334155';
            ctx.font = fDay;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(dl.label, col1 + 10, lineY);

            dl.lines.forEach(l => {
                let xPos = col1 + 10 + hourOffset;
                l.forEach(item => {
                    ctx.fillStyle = '#dc2626'; // Красный час
                    ctx.font = fHour;
                    ctx.fillText(item.h, xPos, lineY);
                    xPos += item.hw + 2;

                    ctx.fillStyle = '#0f172a'; // Черные минуты
                    ctx.font = fMin;
                    ctx.fillText(item.m, xPos, lineY);
                    xPos += item.mw + itemGap;
                });
                lineY += lineStep;
            });
            lineY += dayGap;
        });

        curY += rH;
        if (idx < routeLayouts.length - 1) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px0 + 8, curY); ctx.lineTo(px1 - 8, curY);
            ctx.stroke();
        }
    });


    drawMinsktransFooterPlaque(ctx, CW, code);
}
