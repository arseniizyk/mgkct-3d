#!/usr/bin/env node
/**
 * capture_floor.js
 * 
 * Утилита для автоматического снятия 2D-скриншота этажа здания MGKCT 3D и генерации
 * попиксельного наложения с эталонным планом БТИ и мировой координатной сеткой (X, Z).
 * 
 * Генерирует в .agents/skills/map-architecture-sync/captures/:
 *   1. render_bldg<B>_floor<F>.png  — Чистый ортогональный 2D-вид этажа без искажений перспективы.
 *   2. overlay_bldg<B>_floor<F>.png — Наложение чертежа БТИ (красный) + 3D-стен (синий) + дверей (зеленый) + сетка 1м (X, Z).
 *   3. nav_bldg<B>_floor<F>.png     — Наложение БТИ + 3D-стен + графа навигации A* (узлы и ребра).
 * 
 * Использование:
 *   node .agents/skills/map-architecture-sync/scripts/capture_floor.js --building 4 --floor 1 [--output path.png] [--browser] [--grid] [--bti] [--debug] [--all]
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const OVERLAY_SCRIPT = path.resolve(__dirname, 'render_floor_overlay.py');

// Парсинг аргументов
const args = process.argv.slice(2);
let building = '1';
let floor = '1';
let output = '';
let width = 1600;
let height = 1500;
let waitMs = 2500;
let useBrowser = false;
let showGrid = false;
let showBti = false;
let debugMode = false;
let renderAll = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--building' || args[i] === '-b') building = args[++i];
    else if (args[i] === '--floor' || args[i] === '-f') floor = args[++i];
    else if (args[i] === '--output' || args[i] === '-o') output = args[++i];
    else if (args[i] === '--width') width = parseInt(args[++i], 10);
    else if (args[i] === '--height') height = parseInt(args[++i], 10);
    else if (args[i] === '--wait') waitMs = parseInt(args[++i], 10);
    else if (args[i] === '--browser') useBrowser = true;
    else if (args[i] === '--grid') showGrid = true;
    else if (args[i] === '--bti') showBti = true;
    else if (args[i] === '--debug') debugMode = true;
    else if (args[i] === '--all') renderAll = true;
}

const capturesDir = path.resolve(__dirname, '../captures');
if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });

if (!output) {
    output = path.join(capturesDir, `render_bldg${building}_floor${floor}.png`);
} else {
    output = path.resolve(output);
    const parentDir = path.dirname(output);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
}

// 1. Всегда запускаем детерминированный ортогональный рендерер + генератор наложения БТИ и координатной сетки
function runDeterministicOverlayRenderer() {
    if (!fs.existsSync(OVERLAY_SCRIPT)) return false;
    const pyArgs = [OVERLAY_SCRIPT];
    if (renderAll) {
        pyArgs.push('--all');
    } else {
        pyArgs.push('--building', String(building), '--floor', String(floor));
        if (output) pyArgs.push('--output', output);
    }
    const res = spawnSync('python3', pyArgs, { cwd: PROJECT_ROOT, stdio: 'inherit' });
    return res.status === 0;
}

// Поиск исполняемого файла Google Chrome / Chromium
function findChromeExecutable() {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        return process.env.CHROME_PATH;
    }

    const platform = process.platform;
    const candidates = [];

    if (platform === 'darwin') {
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
        );
    } else if (platform === 'linux') {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
        );
    } else if (platform === 'win32') {
        candidates.push(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        );
    }

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

function startStaticServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let reqPath = decodeURI(req.url.split('?')[0]);
            if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
            const filePath = path.join(PROJECT_ROOT, reqPath);

            if (!filePath.startsWith(PROJECT_ROOT)) {
                res.writeHead(403);
                return res.end('Forbidden');
            }

            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    res.writeHead(404);
                    return res.end('Not found');
                }

                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-store, must-revalidate'
                });
                fs.createReadStream(filePath).pipe(res);
            });
        });

        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({ server, port });
        });
        server.on('error', reject);
    });
}

async function run() {
    const ok = runDeterministicOverlayRenderer();
    if (renderAll || !useBrowser) {
        if (ok && fs.existsSync(output)) {
            console.log(`[capture_floor] Готово: ${output}`);
            process.exit(0);
        }
    }

    const chromePath = findChromeExecutable();
    if (!chromePath) {
        if (ok && fs.existsSync(output)) {
            process.exit(0);
        }
        console.error('Ошибка: Google Chrome или Chromium не найден.');
        process.exit(1);
    }

    const { server, port } = await startStaticServer();
    let query = `?bldg=${building}&floor=${floor}&top=1`;
    if (showGrid) query += '&grid=1';
    if (showBti) query += '&bti=1';
    if (debugMode) query += '&debug=1';
    const targetUrl = `http://127.0.0.1:${port}/${query}`;
    console.log(`[capture_floor] Запущен WebGL-сервер http://127.0.0.1:${port}${query}`);

    const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'mgkct_chr_'));
    const chromeArgs = [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-crash-reporter',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-proxy-server',
        '--use-gl=angle',
        '--hide-scrollbars',
        `--user-data-dir=${tmpProfile}`,
        `--crash-dumps-dir=${tmpProfile}`,
        `--window-size=${width},${height}`,
        `--virtual-time-budget=${waitMs}`,
        `--screenshot=${output}`,
        targetUrl
    ];

    const proc = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const safetyTimer = setTimeout(() => {
        proc.kill('SIGKILL');
    }, 10000);

    proc.on('close', (code) => {
        clearTimeout(safetyTimer);
        server.close();
        try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch (e) {}
        if (fs.existsSync(output) && fs.statSync(output).size > 2000) {
            console.log(`[capture_floor] Скриншот успешно сохранен: ${output}`);
            process.exit(0);
        } else if (ok) {
            runDeterministicOverlayRenderer();
            process.exit(0);
        } else {
            console.error(`[capture_floor] Ошибка: Скриншот не был создан (код: ${code})`);
            process.exit(1);
        }
    });

    proc.on('error', (err) => {
        clearTimeout(safetyTimer);
        server.close();
        if (ok) process.exit(0);
        console.error(`[capture_floor] Ошибка запуска Chrome: ${err.message}`);
        process.exit(1);
    });
}

run().catch(err => {
    console.error(`[capture_floor] Фатальная ошибка: ${err}`);
    process.exit(1);
});
