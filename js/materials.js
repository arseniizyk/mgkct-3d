// ==========================================
// МАТЕРИАЛЫ СЦЕНЫ THREE.JS (МИНИМАЛИСТИЧНЫЙ ДИЗАЙН)
// ==========================================

const isInitialDark = (typeof STATE !== 'undefined' && STATE.theme === 'dark');

// Вспомогательный быстрый генератор минималистичных текстур (power-of-two 256x256, чистый цвет)
function createMinimalTexture(colorHex = '#ffffff', w = 256, h = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

// Легковесный плейсхолдер расписаний для мгновенного старта (0 мс задержки при начальной загрузке страницы)
let _timetablePlaceholderTex = null;
function getTimetablePlaceholderTexture() {
    if (!_timetablePlaceholderTex) {
        _timetablePlaceholderTex = createMinimalTexture('#ffffff', 64, 64);
    }
    return _timetablePlaceholderTex;
}

// Генераторы текстур для совместимости со сторонними интерфейсами и тестами
function createGlassFritTexture() { return createMinimalTexture('#d8e8f0', 256, 256); }

// ============================================================================
// ЭТАЛОННЫЕ ТАБЛИЧКИ РАСПИСАНИЙ МИНСКТРАНС (ОСТАНОВКА 57991 "КАЛЕДЖ ЛІЧБАВЫХ ТЭХНАЛОГІЙ")
// ============================================================================
const MINSKTRANS_STOP_SCHEDULES = {
    buses: {
        '40': [
            [
                {h:'5',m:['27','41','58']},{h:'6',m:['15','32','49']},{h:'7',m:['03','18','32','46']},{h:'8',m:['03','22','39','56']},
                {h:'9',m:['13','29','45']},{h:'10',m:['02','21','45']},{h:'11',m:['09','33','57']},{h:'12',m:['20','44']},
                {h:'13',m:['08','31','55']},{h:'14',m:['19','43']},{h:'15',m:['03','21','40','58']},{h:'16',m:['16','34','53']},
                {h:'17',m:['11','29','47']},{h:'18',m:['06','24','43']},{h:'19',m:['02','21','41']},{h:'20',m:['01','21','41']},
                {h:'21',m:['01','22','46']},{h:'22',m:['10','34']},{h:'23',m:['03','38']}
            ],
            [
                {h:'5',m:['48']},{h:'6',m:['12','34','53']},{h:'7',m:['15','38']},{h:'8',m:['00','22','44']},{h:'9',m:['10','38']},
                {h:'10',m:['08','38']},{h:'11',m:['09','39']},{h:'12',m:['09','39']},{h:'13',m:['09','39']},{h:'14',m:['09','39']},
                {h:'15',m:['09','31','53']},{h:'16',m:['16','38']},{h:'17',m:['00','22','44']},{h:'18',m:['07','30','52']},
                {h:'19',m:['15','39']},{h:'20',m:['04','28','52']},{h:'21',m:['16','41']},{h:'22',m:['05','29','53']},{h:'23',m:['38']}
            ]
        ],
        '107': [
            [
                {h:'5',m:['21','28','38','48','57']},{h:'6',m:['07','17','25','34','44','53']},{h:'7',m:['02','12','22','32','42','53']},
                {h:'8',m:['04','14','25','37','49']},{h:'9',m:['04','19','34','49']},{h:'10',m:['04','19','34','49']},{h:'11',m:['04','19','34','49']},
                {h:'12',m:['05','20','35','50']},{h:'13',m:['05','20','35','50']},{h:'14',m:['05','20','35','49']},{h:'15',m:['01','11','20','30','40','49','58']},
                {h:'16',m:['08','18','27','37','47','56']},{h:'17',m:['06','16','25','35','45','55']},{h:'18',m:['05','14','24','34','43','53']},
                {h:'19',m:['03','13','24','36','50']},{h:'20',m:['05','20','36','53']},{h:'21',m:['10','28','47']},{h:'22',m:['06','26','46']},
                {h:'23',m:['06','26','56']},{h:'0',m:['15']}
            ],
            [
                {h:'5',m:['35','55']},{h:'6',m:['15','36','58']},{h:'7',m:['20','41']},{h:'8',m:['02','23','44']},{h:'9',m:['05','27','54']},
                {h:'10',m:['21','48']},{h:'11',m:['15','42']},{h:'12',m:['09','36']},{h:'13',m:['03','30','57']},{h:'14',m:['24','51']},
                {h:'15',m:['18','44']},{h:'16',m:['07','30','52']},{h:'17',m:['15','37','59']},{h:'18',m:['22','44']},{h:'19',m:['06','30','55']},
                {h:'20',m:['20','45']},{h:'21',m:['10','35']},{h:'22',m:['00','25','50']},{h:'23',m:['15','43']},{h:'0',m:['08']}
            ]
        ]
    },
    trolleys: {
        '19': [
            [
                {h:'5',m:['51']},{h:'6',m:['06','21','31','40','49','58']},{h:'7',m:['07','16','25','34','43','53']},{h:'8',m:['03','14','25','36','48','59']},
                {h:'9',m:['10','25','40','55']},{h:'10',m:['11','25','40','56']},{h:'11',m:['11','26','41','57']},{h:'12',m:['13','30','47']},
                {h:'13',m:['04','21','37','52']},{h:'14',m:['08','24','40','57']},{h:'15',m:['14','24','34','45','55']},{h:'16',m:['05','15','26','37','48','58']},
                {h:'17',m:['08','18','29','39','50']},{h:'18',m:['02','15','30','45']},{h:'19',m:['01','16','35','54']},{h:'20',m:['13','33','53']},
                {h:'21',m:['13','30','48']},{h:'22',m:['05','24','41','58']},{h:'23',m:['17','36']}
            ],
            [
                {h:'5',m:['58']},{h:'6',m:['16','33','51']},{h:'7',m:['08','26','43']},{h:'8',m:['01','18','34','50']},{h:'9',m:['09','27','45']},
                {h:'10',m:['04','23','42']},{h:'11',m:['01','20','37','54']},{h:'12',m:['09','23','37','51']},{h:'13',m:['06','20','35','49']},
                {h:'14',m:['03','17','31','45','59']},{h:'15',m:['14','28','43','57']},{h:'16',m:['11','25','39','53']},{h:'17',m:['08','24','40','57']},
                {h:'18',m:['14','33','52']},{h:'19',m:['11','29','47']},{h:'20',m:['03','21','39','57']},{h:'21',m:['15','33','50']},
                {h:'22',m:['07','24','41','58']},{h:'23',m:['17','36']}
            ]
        ],
        '19p': [
            [
                {h:'9',m:['20','45']},{h:'10',m:['40']},{h:'12',m:['04']},{h:'19',m:['01','21']},{h:'21',m:['06','21','39','57']},{h:'23',m:['49']},{h:'0',m:['04','21','42']}
            ],
            [
                {h:'21',m:['14','40']},{h:'22',m:['14']},{h:'23',m:['49']},{h:'0',m:['05','21','42']}
            ]
        ],
        '27': [
            [
                {h:'6',m:['09','17','25','33','41','48','54','59']},{h:'7',m:['04','09','14','18','23','28','33','38','43','48','53','58']},
                {h:'8',m:['03','08','13','18','23','29','36','44','52']},{h:'9',m:['00','13','25','38','50']},{h:'10',m:['03','15','28','34','41','54']},
                {h:'11',m:['06','16','26','36','45','55']},{h:'12',m:['04','14','24','34','43','53']},{h:'13',m:['02','12','22','32','41','51']},
                {h:'14',m:['00','10','20','30','41','52']},{h:'15',m:['02','09','17','25','32','40','48','55']},{h:'16',m:['02','09','13','19','25','31','36','41','46','52','57']},
                {h:'17',m:['03','08','13','19','25','30','36','41','46','52','58']},{h:'18',m:['05','12','19','26','35','43','52']},{h:'19',m:['02','12','21','30','40','49','59']},
                {h:'20',m:['07','17','27','38','50','56']},{h:'21',m:['02','10','20','27','34','42','49','57']},{h:'22',m:['10','25','40','55']},
                {h:'23',m:['10','25','40','54']},{h:'0',m:['18','33','47']}
            ],
            [
                {h:'6',m:['08','26','45']},{h:'7',m:['03','21','39','52']},{h:'8',m:['06','20','34','48']},{h:'9',m:['03','17','31','49']},
                {h:'10',m:['07','25','41','54']},{h:'11',m:['06','18','30','42','53']},{h:'12',m:['04','15','26','37','48','59']},{h:'13',m:['10','21','32','43','54']},
                {h:'14',m:['05','16','27','38','49']},{h:'15',m:['00','12','23','34','45','56']},{h:'16',m:['07','18','29','40','51']},{h:'17',m:['02','13','24','35','47','59']},
                {h:'18',m:['14','28','42','56']},{h:'19',m:['10','24','38','52']},{h:'20',m:['05','18','32','47']},{h:'21',m:['02','17','32','47']},
                {h:'22',m:['03','19','37','55']},{h:'23',m:['01','13','31','49']}
            ]
        ],
        '27p': [
            [
                {h:'9',m:['21']},{h:'10',m:['12']},{h:'18',m:['16','45','57']},{h:'0',m:['06']}
            ],
            [
                {h:'21',m:['11']},{h:'22',m:['40']},{h:'0',m:['06','24']}
            ]
        ],
        '82': [
            [
                {h:'5',m:['41']},{h:'6',m:['14','34','54']},{h:'7',m:['14','33','48']},{h:'8',m:['02','13','24','35','49']},
                {h:'9',m:['03','19','34','50']},{h:'10',m:['16','42']},{h:'11',m:['08','34','52']},{h:'12',m:['26','52']},
                {h:'13',m:['18','47']},{h:'14',m:['10','36']},{h:'15',m:['01','17','30','41','54']},{h:'16',m:['07','20','33','47']},
                {h:'17',m:['01','15','27','39','53']},{h:'18',m:['06','20','36']},{h:'19',m:['01','26','51']},{h:'20',m:['21','51']},
                {h:'21',m:['25','59']},{h:'22',m:['33']},{h:'23',m:['08','36']}
            ]
        ],
        '82p': [
            [
                {h:'12',m:['11']}
            ]
        ]
    }
};

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

    // ----------------------------------------------------
    // 2. НИЖНЯЯ ОТДЕЛЬНАЯ ПЛАНКА (USSD, КОРОТКИЙ НОМЕР 488, QR)
    // ----------------------------------------------------
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

// 1. Табличка троллейбусов №1 (Маршруты 19 и 19п)
function createTrolleybusTimetable1Texture() {
    if (typeof document === 'undefined') return createMinimalTexture('#ffffff', 256, 256);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const routes = [
        {
            num: '19',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ст.м. «АЎТАЗАВОДСКАЯ»',
            wheelchair: false,
            date: 'з 20.11.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19'][1] }
            ]
        },
        {
            num: '19п',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ТРАНСПАРТНЫ ПАРК №2 (у парк)',
            wheelchair: false,
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19p'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['19p'][1] }
            ]
        }
    ];
    drawMinsktransBoardCanvas(canvas, 'trolley', 'Каледж лічбавых тэхналогій', '57991', routes, false);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

// 2. Табличка троллейбусов №2 (Маршруты 27, 27п, 82, 82п)
function createTrolleybusTimetable2Texture() {
    if (typeof document === 'undefined') return createMinimalTexture('#ffffff', 256, 256);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const routes = [
        {
            num: '27',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ДС «ДРУЖНАЯ»',
            wheelchair: false,
            date: 'з 20.11.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27'][1] }
            ]
        },
        {
            num: '27п',
            dest: 'ДС «КУРАСОЎШЧЫНА» — ТРАНСПАРТНЫ ПАРК №2 (у парк)',
            wheelchair: false,
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27p'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['27p'][1] }
            ]
        },
        {
            num: '82',
            dest: 'КАРЖАНЕЎСКАГА — ДС «СЕРАБРАНКА»',
            wheelchair: false,
            date: 'з 20.11.2024',
            days: [
                { label: 'штодз.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['82'][0] }
            ]
        },
        {
            num: '82п',
            dest: 'КАРЖАНЕЎСКАГА — ТРАНСПАРТНЫ ПАРК №2 (у парк)',
            wheelchair: false,
            days: [
                { label: 'штодз.', hours: MINSKTRANS_STOP_SCHEDULES.trolleys['82p'][0] }
            ]
        }
    ];
    drawMinsktransBoardCanvas(canvas, 'trolley', 'Каледж лічбавых тэхналогій', '57991', routes, false);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

/**
 * Алиас для обратной совместимости: возвращает текстуру основного
 * расписания троллейбусов (маршруты 19 и 27) для остановки «Колледж технологии и дизайна».
 */
function createTrolleybusTimetableTexture() {
    return createTrolleybusTimetable1Texture();
}

// 3. Табличка автобусов (Маршруты 40 и 107)
function createBusTimetableTexture() {
    if (typeof document === 'undefined') return createMinimalTexture('#ffffff', 256, 256);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 640;
    const routes = [
        {
            num: '40',
            dest: 'ЛАНДЭРА — ДС «КУНЦАЎШЧЫНА»',
            wheelchair: true,
            date: 'з 20.11.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.buses['40'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.buses['40'][1] }
            ]
        },
        {
            num: '107',
            dest: 'КАРЖАНЕЎСКАГА — ДС «КУНЦАЎШЧЫНА»',
            wheelchair: true,
            date: 'з 01.12.2024',
            days: [
                { label: 'буд.', hours: MINSKTRANS_STOP_SCHEDULES.buses['107'][0] },
                { label: 'вых.', hours: MINSKTRANS_STOP_SCHEDULES.buses['107'][1] }
            ]
        }
    ];
    drawMinsktransBoardCanvas(canvas, 'bus', 'Каледж лічбавых тэхналогій', '57991', routes, true);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}
function createBusStopSignTexture() { return createMinimalTexture('#0284c7', 256, 256); }
function createPedestrianSignTexture(flip = false) { return createMinimalTexture('#0284c7', 256, 256); }
function createBirchBarkTexture() { return createMinimalTexture('#f8fafc', 256, 256); }
function createBirchBarkBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createLindenBarkTexture() { return createMinimalTexture('#473322', 256, 256); }
function createLindenFoliageTexture() { return createMinimalTexture('#2e6f2b', 256, 256); }
function createSpruceBarkTexture() { return createMinimalTexture('#382419', 256, 256); }
function createSpruceNeedleTexture() { return createMinimalTexture('#184223', 256, 256); }
function createHedgeFoliageTexture() { return createMinimalTexture('#275e2c', 256, 256); }
function createHedgeBumpTexture() { return createMinimalTexture('#808080', 256, 256); }
function createSoilMulchTexture() { return createMinimalTexture('#2a1d17', 256, 256); }
function createLawnTexture() { return createMinimalTexture('#387a3e', 256, 256); }
function createCollegeSteleLogoTexture() { return createMinimalTexture('#0284c7', 256, 256); }
function createWoodPlankTexture() { return createMinimalTexture('#b45309', 256, 256); }
function createWoodPlankBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createBrushedDarkMetalTexture() { return createMinimalTexture('#1e293b', 256, 256); }
function createBrushedMetalBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createPaverTileTexture() { return createMinimalTexture('#f1f5f9', 256, 256); }
function createPaverTileBumpMap() { return createMinimalTexture('#808080', 256, 256); }
function createTrafficBackplateTexture() { return createMinimalTexture('#0f172a', 256, 256); }
function createPedestrianTrafficLensTexture(color = 'red') { return createMinimalTexture(color === 'red' ? '#ef4444' : '#10b981', 256, 256); }
function createPedestrianButtonPlateTexture() { return createMinimalTexture('#facc15', 256, 256); }

// ============================================================================
// Фиксированная архитектурная цветовая палитра колледжа (Шалфейный гранит / Шалфейный лес)
const DEFAULT_CAMPUS_COLORS = {
    slab: 0x9faea0,
    coreSlab: 0x9faea0,
    wall: 0x5b6c5d,
    stair: 0x7d5336
};
window.DEFAULT_CAMPUS_COLORS = DEFAULT_CAMPUS_COLORS;

const _sharedShelterFrameMat = new THREE.MeshStandardMaterial({
    color: 0xd4dce4,
    roughness: 0.25,
    metalness: 0.88
});

const MATERIALS = {
    // 1. Плиты перекрытий и несущие ядра
    slab: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x161f2e : DEFAULT_CAMPUS_COLORS.slab,
        roughness: 0.90,
        metalness: 0.02,
        transparent: false,
        opacity: 1.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    coreSlab: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x121a26 : DEFAULT_CAMPUS_COLORS.coreSlab,
        roughness: 0.90,
        metalness: 0.02,
        transparent: false,
        opacity: 1.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    wall: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x283548 : DEFAULT_CAMPUS_COLORS.wall,
        roughness: 0.65,
        metalness: 0.03
    }),
    doorThin: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x3b4d66 : 0x94a3b8,
        roughness: 0.55,
        metalness: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    stair: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x222e40 : DEFAULT_CAMPUS_COLORS.stair,
        roughness: 0.72,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    elevatorCar: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e293b : 0xcbd5e1,
        roughness: 0.75
    }),
    edgeMain: new THREE.LineBasicMaterial({ color: isInitialDark ? 0x475569 : 0x64748b, linewidth: 1 }),
    edgeDoor: new THREE.LineBasicMaterial({ color: isInitialDark ? 0x475569 : 0x64748b, linewidth: 1 }),
    guideLine: new THREE.LineDashedMaterial({
        color: 0x94a3b8,
        dashSize: 0.45,
        gapSize: 0.3,
        transparent: true,
        opacity: 0.6
    }),
    stairAxisLine: new THREE.LineDashedMaterial({
        color: 0x10b981,
        dashSize: 0.5,
        gapSize: 0.25,
        transparent: true,
        opacity: 0.9
    }),
    stairBoxEdge: new THREE.LineBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.65
    }),
    roof: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e293b : 0x94a3b8,
        roughness: 0.85,
        metalness: 0.08,
        transparent: false,
        opacity: 1.0
    }),
    edgeRoof: new THREE.LineBasicMaterial({
        color: 0x475569,
        linewidth: 1
    }),

    // 2. Дороги и территория (минималистичные и 3D)
    minimalRoadSurface: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e293b : 0x475569,
        roughness: 0.90,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2
    }),
    roadContourLine: new THREE.LineBasicMaterial({
        color: isInitialDark ? 0x94a3b8 : 0x334155,
        linewidth: 1
    }),
    roadCenterLine: new THREE.LineBasicMaterial({
        color: isInitialDark ? 0x475569 : 0x94a3b8,
        linewidth: 1
    }),
    asphaltRoad: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x18202c : 0x334155,
        roughness: 0.90,
        metalness: 0.04
    }),
    asphaltDriveway: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e293b : 0x475569,
        roughness: 0.88,
        metalness: 0.04
    }),
    curb: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x475569 : 0x64748b,
        roughness: 0.85,
        metalness: 0.05
    }),
    sidewalk: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2d3748 : 0x94a3b8,
        roughness: 0.85,
        metalness: 0.03
    }),
    lawn: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x16331a : 0x387a3e,
        roughness: 0.95,
        metalness: 0.0
    }),
    roadMarkingWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.5,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    }),
    roadMarkingYellow: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.5,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    }),

    // 3. Остановочный павильон и навесы
    shelterFrame: _sharedShelterFrameMat,
    shelterFrameStainless: _sharedShelterFrameMat,
    shelterGlass: new THREE.MeshStandardMaterial({
        color: 0xd8e8f0,
        transparent: true,
        opacity: 0.35,
        roughness: 0.10,
        metalness: 0.15
    }),
    shelterRoof: new THREE.MeshStandardMaterial({
        color: 0xd4e2ec,
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
        metalness: 0.10,
        side: THREE.DoubleSide
    }),
    shelterRoofGlass: new THREE.MeshStandardMaterial({
        color: 0xd4e2ec,
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
        metalness: 0.10,
        side: THREE.DoubleSide
    }),
    shelterBench: new THREE.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.42,
        metalness: 0.02
    }),
    shelterBenchWood: new THREE.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.42,
        metalness: 0.02
    }),
    shelterBenchLegs: new THREE.MeshStandardMaterial({
        color: 0x242d38,
        roughness: 0.40,
        metalness: 0.60
    }),
    busTimetable: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: getTimetablePlaceholderTexture(),
        roughness: 0.25,
        metalness: 0.05
    }),
    trolleybusTimetable1: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: getTimetablePlaceholderTexture(),
        roughness: 0.25,
        metalness: 0.05
    }),
    trolleybusTimetable2: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: getTimetablePlaceholderTexture(),
        roughness: 0.25,
        metalness: 0.05
    }),
    stainlessSteel: new THREE.MeshStandardMaterial({
        color: 0xdde4ec,
        roughness: 0.28,
        metalness: 0.88
    }),
    busStopSign: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        metalness: 0.05
    }),
    pedestrianSign: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),
    pedestrianSignRight: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.35,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    }),

    // 4. Ботанические элементы (деревья, кустарники, живая изгородь)
    birchBark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0xe2e8f0 : 0xf8fafc,
        roughness: 0.75,
        metalness: 0.04
    }),
    birchFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2e541b : 0x529432,
        roughness: 0.82,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    birchFoliageLight: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x487928 : 0x72b036,
        roughness: 0.78,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    lindenTrunk: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2c221a : 0x473322,
        roughness: 0.90,
        metalness: 0.02
    }),
    lindenFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x224a1f : 0x2e6f2b,
        roughness: 0.80,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    lindenFoliageDark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x163415 : 0x21521f,
        roughness: 0.86,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    spruceTrunk: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2c1a12 : 0x382419,
        roughness: 0.88,
        metalness: 0.02
    }),
    spruceNeedle: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x183a1d : 0x184223,
        roughness: 0.82,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    spruceNeedleDark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x0f2613 : 0x102e18,
        roughness: 0.86,
        metalness: 0.0,
        side: THREE.DoubleSide
    }),
    hedgeFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e3a24 : 0x275e2c,
        roughness: 0.65,
        metalness: 0.02,
        side: THREE.DoubleSide
    }),
    soilMulch: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1f140e : 0x2a1d17,
        roughness: 0.95,
        metalness: 0.0
    }),
    shrubFoliageDeciduous: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1b4022 : 0x2d5a27,
        roughness: 0.75,
        metalness: 0.02,
        side: THREE.DoubleSide
    }),
    shrubFoliageConifer: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x132e22 : 0x234e3f,
        roughness: 0.85,
        metalness: 0.01,
        side: THREE.DoubleSide
    }),
    flowerBlossomWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.5,
        emissive: 0xffffff,
        emissiveIntensity: 0.12
    }),
    flowerBlossomGold: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.5,
        emissive: 0xd97706,
        emissiveIntensity: 0.15
    }),
    treeTrunk: new THREE.MeshStandardMaterial({
        color: 0x5b3a29,
        roughness: 0.9
    }),
    treeFoliage: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1e4620 : 0x22c55e,
        roughness: 0.85,
        metalness: 0.0
    }),
    treeFoliageLight: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x2d5a27 : 0x4ade80,
        roughness: 0.85,
        metalness: 0.0
    }),
    poleMetal: new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
        metalness: 0.7
    }),
    signBlue: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.4
    }),
    signRed: new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        roughness: 0.4
    }),
    signWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.4
    }),

    // 5. Благоустройство (скамейки, урны, велопарковки, стела, плитка)
    campusBenchWood: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x9a3412 : 0xb45309,
        roughness: 0.44,
        metalness: 0.02,
        side: THREE.FrontSide
    }),
    campusBenchMetal: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.38,
        metalness: 0.72
    }),
    campusWasteBinBody: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.34,
        metalness: 0.78
    }),
    bikeRackGalvanized: new THREE.MeshStandardMaterial({
        color: 0xdde4ec,
        roughness: 0.22,
        metalness: 0.88
    }),
    steleGranite: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x1f2937 : 0x475569,
        roughness: 0.82,
        metalness: 0.06
    }),
    steleLogoPlaque: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.28,
        metalness: 0.18,
        emissive: 0x0369a1,
        emissiveIntensity: 0.30
    }),
    forecourtPaverLight: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x222d3d : 0xf1f5f9,
        roughness: 0.88,
        metalness: 0.03
    }),
    forecourtPaverDark: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x161e2a : 0x64748b,
        roughness: 0.84,
        metalness: 0.05
    }),
    castIronDark: new THREE.MeshStandardMaterial({
        color: 0x1a202c,
        roughness: 0.58,
        metalness: 0.65
    }),
    reflectiveWhite: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.15,
        metalness: 0.08,
        emissive: 0xf8fafc,
        emissiveIntensity: 0.22
    }),

    // 6. Светофоры и ограждение
    trafficHousing: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.5,
        metalness: 0.15
    }),
    trafficRed: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 1.2,
        roughness: 0.2
    }),
    trafficYellow: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.2,
        roughness: 0.2
    }),
    trafficGreen: new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 1.2,
        roughness: 0.2
    }),
    trafficButtonYellow: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.35,
        metalness: 0.05
    }),
    trafficButtonFace: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.5
    }),
    trafficButtonChrome: new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.85,
        roughness: 0.2
    }),
    trafficBackplate: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.5,
        metalness: 0.1
    }),
    trafficPedRedMan: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
        roughness: 0.2
    }),
    trafficPedGreenMan: new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.9,
        roughness: 0.2
    }),
    trafficButtonPlate: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.35,
        metalness: 0.05
    }),
    perimeterFence: new THREE.MeshStandardMaterial({
        color: isInitialDark ? 0x0f172a : 0x1e293b,
        metalness: 0.75,
        roughness: 0.35
    })
};

// Экспорт в глобальный scope window
MATERIALS.trolleybusTimetable = MATERIALS.trolleybusTimetable1;
window.MATERIALS = MATERIALS;
window.createMinimalTexture = createMinimalTexture;
window.createGlassFritTexture = createGlassFritTexture;
window.createBusTimetableTexture = createBusTimetableTexture;
window.createTrolleybusTimetableTexture = createTrolleybusTimetableTexture;
window.createTrolleybusTimetable1Texture = createTrolleybusTimetable1Texture;
window.createTrolleybusTimetable2Texture = createTrolleybusTimetable2Texture;
window.createBusStopSignTexture = createBusStopSignTexture;
window.createPedestrianSignTexture = createPedestrianSignTexture;
window.createBirchBarkTexture = createBirchBarkTexture;
window.createBirchBarkBumpMap = createBirchBarkBumpMap;
window.createLindenBarkTexture = createLindenBarkTexture;
window.createLindenFoliageTexture = createLindenFoliageTexture;
window.createSpruceBarkTexture = createSpruceBarkTexture;
window.createSpruceNeedleTexture = createSpruceNeedleTexture;
window.createHedgeFoliageTexture = createHedgeFoliageTexture;
window.createHedgeBumpTexture = createHedgeBumpTexture;
window.createSoilMulchTexture = createSoilMulchTexture;
window.createLawnTexture = createLawnTexture;
window.createCollegeSteleLogoTexture = createCollegeSteleLogoTexture;
window.createWoodPlankTexture = createWoodPlankTexture;
window.createWoodPlankBumpMap = createWoodPlankBumpMap;
window.createBrushedDarkMetalTexture = createBrushedDarkMetalTexture;
window.createBrushedMetalBumpMap = createBrushedMetalBumpMap;
window.createPaverTileTexture = createPaverTileTexture;
window.createPaverTileBumpMap = createPaverTileBumpMap;
window.createTrafficBackplateTexture = createTrafficBackplateTexture;
window.createPedestrianTrafficLensTexture = createPedestrianTrafficLensTexture;
window.createPedestrianButtonPlateTexture = createPedestrianButtonPlateTexture;

// ============================================================================
// АСИНХРОННЫЙ ОТЛОЖЕННЫЙ ЗАГРУЗЧИК ВЫСОКОДЕТАЛИЗИРОВАННЫХ ТАБЛИЧЕК РАСПИСАНИЙ
// Оптимизация: генерация тяжелых Canvas 2D вынесена в requestIdleCallback / таймер,
// исключая блокировку главного потока при начальном парсинге и рендеринге 3D-сцены.
// ============================================================================
let _timetablesLoaded = false;
function loadTimetableTexturesAsync() {
    if (_timetablesLoaded) return;
    _timetablesLoaded = true;

    const doLoad = () => {
        try {
            const texBus = createBusTimetableTexture();
            const texTrolley1 = createTrolleybusTimetable1Texture();
            const texTrolley2 = createTrolleybusTimetable2Texture();

            if (MATERIALS.busTimetable) {
                MATERIALS.busTimetable.map = texBus;
                MATERIALS.busTimetable.needsUpdate = true;
            }
            if (MATERIALS.trolleybusTimetable1) {
                MATERIALS.trolleybusTimetable1.map = texTrolley1;
                MATERIALS.trolleybusTimetable1.needsUpdate = true;
            }
            if (MATERIALS.trolleybusTimetable2) {
                MATERIALS.trolleybusTimetable2.map = texTrolley2;
                MATERIALS.trolleybusTimetable2.needsUpdate = true;
            }
            if (typeof requestRender === 'function') {
                requestRender(15);
            }
        } catch (e) {
            console.warn('Async timetable texture generation:', e);
        }
    };

    if (typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(doLoad, { timeout: 2000 });
        } else if ('requestAnimationFrame' in window) {
            window.requestAnimationFrame(() => doLoad());
        } else {
            doLoad();
        }
    } else {
        doLoad();
    }
}

window.loadTimetableTexturesAsync = loadTimetableTexturesAsync;

// Централизованное освобождение WebGL материалов и текстур для предотвращения утечек GPU
function disposeAllMaterials() {
    if (typeof MATERIALS === 'undefined' || !MATERIALS) return;
    for (const key of Object.keys(MATERIALS)) {
        const mat = MATERIALS[key];
        if (!mat) continue;
        if (mat.map && typeof mat.map.dispose === 'function') {
            mat.map.dispose();
        }
        if (mat.lightMap && typeof mat.lightMap.dispose === 'function') {
            mat.lightMap.dispose();
        }
        if (typeof mat.dispose === 'function') {
            mat.dispose();
        }
    }
}
window.disposeAllMaterials = disposeAllMaterials;
