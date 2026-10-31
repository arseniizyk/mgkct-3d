#!/usr/bin/env node
/**
 * capture_floor.js
 * 
 * Утилита для автоматического снятия 2D-скриншота этажа здания MGKCT 3D в headless-режиме Chrome.
 * Запускает временный HTTP-сервер, открывает Chrome с параметрами ?bldg=X&floor=Y в 2D-виде,
 * ожидает стабилизации рендера WebGL и Screen-Space Canvas, делает снимок и сохраняет его в PNG.
 * 
 * Использование:
 *   node .agents/skills/map-architecture-sync/scripts/capture_floor.js --building 1 --floor 2 [--output path.png]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

// Парсинг аргументов
const args = process.argv.slice(2);
let building = '1';
let floor = '1';
let output = '';
let width = 1600;
let height = 1200;
let waitMs = 3000;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--building' || args[i] === '-b') building = args[++i];
    else if (args[i] === '--floor' || args[i] === '-f') floor = args[++i];
    else if (args[i] === '--output' || args[i] === '-o') output = args[++i];
    else if (args[i] === '--width') width = parseInt(args[++i], 10);
    else if (args[i] === '--height') height = parseInt(args[++i], 10);
    else if (args[i] === '--wait') waitMs = parseInt(args[++i], 10);
}

if (!output) {
    const capturesDir = path.resolve(__dirname, '../captures');
    if (!fs.existsSync(capturesDir)) fs.mkdirSync(capturesDir, { recursive: true });
    output = path.join(capturesDir, `render_bldg${building}_floor${floor}.png`);
} else {
    output = path.resolve(output);
    const parentDir = path.dirname(output);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
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

// Запуск временного статического HTTP-сервера
function startStaticServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let reqPath = decodeURI(req.url.split('?')[0]);
            if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
            const filePath = path.join(PROJECT_ROOT, reqPath);

            // Безопасность путей
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
    const chromePath = findChromeExecutable();
    if (!chromePath) {
        console.error('Ошибка: Google Chrome или Chromium не найден в стандартных путях системы.');
        console.error('Установите переменную окружения CHROME_PATH с путем к бинарному файлу Chrome.');
        process.exit(1);
    }

    const { server, port } = await startStaticServer();
    const targetUrl = `http://127.0.0.1:${port}/?bldg=${building}&floor=${floor}`;
    console.log(`[capture_floor] Запущен сервер http://127.0.0.1:${port}`);
    console.log(`[capture_floor] Съемка: Корпус ${building}, Этаж ${floor} -> ${output}`);

    const chromeArgs = [
        '--headless=new',
        '--use-gl=angle',
        '--hide-scrollbars',
        `--window-size=${width},${height}`,
        `--virtual-time-budget=${waitMs}`,
        `--screenshot=${output}`,
        targetUrl
    ];

    const proc = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.on('close', (code) => {
        server.close();
        if (fs.existsSync(output) && fs.statSync(output).size > 0) {
            console.log(`[capture_floor] Скриншот успешно сохранен: ${output}`);
            process.exit(0);
        } else {
            console.error(`[capture_floor] Ошибка: Скриншот не был создан (код выхода Chrome: ${code})`);
            process.exit(1);
        }
    });

    proc.on('error', (err) => {
        server.close();
        console.error(`[capture_floor] Ошибка запуска Chrome: ${err.message}`);
        process.exit(1);
    });
}

run().catch(err => {
    console.error(`[capture_floor] Фатальная ошибка: ${err}`);
    process.exit(1);
});
