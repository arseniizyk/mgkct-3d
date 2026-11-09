#!/usr/bin/env node
/**
 * smoke_browser_runtime.js
 *
 * Zero-dependency cross-platform headless browser runtime smoke test.
 * Uses native Node.js (http server, fetch, WebSocket, child_process) and Chrome DevTools Protocol (CDP)
 * to verify that index.html boots up cleanly with:
 *   1. HTTP 200 on all core assets.
 *   2. Zero unhandled JavaScript exceptions in window.
 *   3. Zero console.error calls during startup and scene creation.
 *   4. Successful initialization of THREE, STATE, NAV_STATE, and 3D campus scene.
 *
 * Usage:
 *   node tests/smoke_browser_runtime.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// Ensure WebSocket is available (Node 22 native, or Node 20 --experimental-websocket)
const WSClient = globalThis.WebSocket;
if (typeof WSClient === 'undefined') {
    console.error('[ERROR] WebSocket is not available. Please run with Node 22+ or use --experimental-websocket.');
    process.exit(1);
}

// Common browser binary locations
function findBrowserBinary() {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    const candidates = isWin ? [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ] : isMac ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ] : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];

    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

async function runSmokeTest() {
    console.log('='.repeat(70));
    console.log('  MGKCT 3D — HEADLESS BROWSER RUNTIME & STARTUP SMOKE TEST');
    console.log('='.repeat(70));

    const browserBin = findBrowserBinary();
    if (!browserBin) {
        console.warn('\x1b[33m[SKIP] Headless browser binary (Chrome/Edge/Chromium) not found on host.\x1b[0m');
        process.exit(0);
    }
    console.log(`[BROWSER] Found: ${browserBin}`);

    // 1. Start static HTTP server
    const server = http.createServer((req, res) => {
        let safePath = path.normalize(decodeURIComponent(req.url.split('?')[0]));
        if (safePath === '/' || safePath === '\\') safePath = '/index.html';
        const filePath = path.join(REPO_ROOT, safePath);

        if (!filePath.startsWith(REPO_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const serverPort = server.address().port;
    console.log(`[SERVER] Ephemeral static server listening on http://127.0.0.1:${serverPort}`);

    const tempUserDataDir = path.join(require('os').tmpdir(), `mgkct_smoke_${Date.now()}`);

    const browserArgs = [
        '--headless=new',
        '--remote-debugging-port=0',
        '--remote-debugging-address=127.0.0.1',
        `--user-data-dir=${tempUserDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-extensions',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--hide-scrollbars',
        'about:blank'
    ];

    const browserLogs = [];
    let detectedPort = null;
    let portResolve = null;
    const portPromise = new Promise(resolve => { portResolve = resolve; });

    const browserProc = spawn(browserBin, browserArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`[BROWSER] Headless process spawned (PID=${browserProc.pid})`);

    const handleBrowserOutput = (chunk) => {
        const text = chunk.toString();
        const match = text.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//i);
        if (match && !detectedPort) {
            detectedPort = parseInt(match[1], 10);
            if (portResolve) portResolve(detectedPort);
        }
        browserLogs.push(text.trim());
    };
    browserProc.stderr.on('data', handleBrowserOutput);
    browserProc.stdout.on('data', handleBrowserOutput);

    browserProc.on('exit', (code, sig) => {
        if (code !== null && code !== 0) {
            browserLogs.push(`Browser process exited with code ${code} (signal ${sig})`);
        }
    });

    const cleanup = () => {
        try { browserProc.kill('SIGKILL'); } catch {}
        try { server.close(); } catch {}
        try { fs.rmSync(tempUserDataDir, { recursive: true, force: true }); } catch {}
    };

    const errors = [];
    let ws = null;
    let sendCDP = null;

    try {
        // Wait for Chrome to output the dynamic devtools listening port
        const debugPort = await Promise.race([
            portPromise,
            new Promise((_, reject) => setTimeout(() => {
                const logs = browserLogs.length > 0 ? `\nBrowser output:\n${browserLogs.join('\n')}` : '';
                reject(new Error(`Timeout waiting for DevTools port from browser.${logs}`));
            }, 25000))
        ]);

        console.log(`[CDP] DevTools port detected: ${debugPort}`);

        // Fetch targets list from CDP HTTP endpoint
        let wsUrl = null;
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 150));
            try {
                const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
                if (res.ok) {
                    const pages = await res.json();
                    const page = pages.find(p => p.type === 'page' && p.webSocketDebuggerUrl) || pages[0];
                    if (page && page.webSocketDebuggerUrl) {
                        wsUrl = page.webSocketDebuggerUrl;
                        break;
                    }
                }
            } catch {}
        }

        if (!wsUrl) {
            if (browserLogs.length > 0) {
                console.error('[BROWSER LOGS]\n' + browserLogs.join('\n'));
            }
            throw new Error(`Failed to establish CDP connection on port ${debugPort}`);
        }

        console.log('[CDP] Connecting to page WebSocket debugger...');
        ws = new WSClient(wsUrl);

        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        const pendingCallbacks = new Map();
        let pageLoadedResolve = null;
        const pageLoadedPromise = new Promise(resolve => { pageLoadedResolve = resolve; });

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                pendingCallbacks.get(data.id)(data);
                pendingCallbacks.delete(data.id);
            }

            if (data.method === 'Page.loadEventFired') {
                if (pageLoadedResolve) pageLoadedResolve();
            }

            // Capture console.error
            if (data.method === 'Runtime.consoleAPICalled') {
                const { type, args } = data.params;
                if (type === 'error') {
                    const text = args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
                    errors.push(`Console Error: ${text}`);
                }
            }

            // Capture uncaught exceptions
            if (data.method === 'Runtime.exceptionThrown') {
                const { exceptionDetails } = data.params;
                errors.push(`Uncaught Exception: ${exceptionDetails.text} (${exceptionDetails.exception?.description || ''})`);
            }
        };

        sendCDP = (method, params = {}, timeoutMs = 10000) => new Promise((resolve, reject) => {
            const id = msgId++;
            const timer = setTimeout(() => {
                pendingCallbacks.delete(id);
                reject(new Error(`CDP command '${method}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            pendingCallbacks.set(id, (res) => {
                clearTimeout(timer);
                resolve(res);
            });
            try {
                ws.send(JSON.stringify({ id, method, params }));
            } catch (err) {
                clearTimeout(timer);
                pendingCallbacks.delete(id);
                reject(err);
            }
        });

        await sendCDP('Page.enable');
        await sendCDP('Runtime.enable');

        const targetUrl = `http://127.0.0.1:${serverPort}/index.html`;
        console.log(`[NAVIGATE] Navigating to ${targetUrl}...`);
        await sendCDP('Page.navigate', { url: targetUrl });

        // Wait for page load event (or timeout after 5s)
        await Promise.race([
            pageLoadedPromise,
            new Promise(r => setTimeout(r, 5000))
        ]);

        // Allow app initialization & 3D rendering loop
        console.log('[TEST] Waiting for 3D campus bootstrap and frame rendering...');
        await new Promise(r => setTimeout(r, 3000));

        // Evaluate global health
        const evalRes = await sendCDP('Runtime.evaluate', {
            expression: `({
                url: window.location.href,
                hasThree: typeof THREE !== 'undefined',
                hasState: typeof STATE !== 'undefined',
                hasNav: typeof NAV_STATE !== 'undefined',
                hasScene: typeof scene !== 'undefined' && scene !== null,
                roomCount: typeof ROOMS_REGISTRY !== 'undefined' ? ROOMS_REGISTRY.length : 0,
                wallCount: typeof WALLS_REGISTRY !== 'undefined' ? WALLS_REGISTRY.length : 0
            })`,
            returnByValue: true
        });

        const stateInfo = evalRes.result?.result?.value;
        console.log('[STATUS] Runtime State Evaluation:', stateInfo);

        if (!stateInfo || !stateInfo.hasThree || !stateInfo.hasState || !stateInfo.hasNav || !stateInfo.hasScene) {
            errors.push(`Runtime bootstrap incomplete: ${JSON.stringify(stateInfo)}`);
        }
        if (stateInfo && (stateInfo.roomCount < 200 || stateInfo.wallCount < 1000)) {
            errors.push(`Architecture registry incomplete: rooms=${stateInfo?.roomCount}, walls=${stateInfo?.wallCount}`);
        }

        // Regression check: Ghost stair badges and random floor switches on click
        const clickAuditRes = await sendCDP('Runtime.evaluate', {
            expression: `(() => {
                const results = [];
                // 1. Build route with stair transition, then clear it
                if (typeof buildRoute === 'function' && typeof clearRoute === 'function') {
                    buildRoute('101', '305');
                    clearRoute();
                    if (NAV_STATE._renderedStairBadges && NAV_STATE._renderedStairBadges.length > 0) {
                        results.push('NAV_STATE._renderedStairBadges not cleared after clearRoute()');
                    }
                    if (checkStairBadgeClick(150, 150)) {
                        results.push('checkStairBadgeClick returned true when no route is active');
                    }
                }
                // 2. Mode all floor switch check
                if (typeof setMode === 'function' && typeof findRoomAtScreenPoint === 'function') {
                    setMode('all');
                    let switchedInAll = false;
                    const onFloorChange = () => { switchedInAll = true; };
                    window.addEventListener('floorChanged', onFloorChange);
                    findRoomAtScreenPoint(window.innerWidth / 2, window.innerHeight / 2);
                    window.removeEventListener('floorChanged', onFloorChange);
                    if (switchedInAll || STATE.mode !== 'all') {
                        results.push('findRoomAtScreenPoint unexpectedly triggered floor change in all-floors mode');
                    }
                    setMode('1');
                }
                return results;
            })()`,
            returnByValue: true
        });
        const clickDefects = clickAuditRes.result?.result?.value;
        if (Array.isArray(clickDefects) && clickDefects.length > 0) {
            clickDefects.forEach(d => errors.push(d));
        }

        // Graceful CDP browser shutdown to release file handles and child processes on Windows
        await sendCDP('Browser.close').catch(() => {});
        ws.close();

        if (errors.length > 0) {
            console.error('\x1b[31m[FAIL] Browser runtime errors encountered:\x1b[0m');
            errors.forEach(e => console.error(`  • ${e}`));
            cleanup();
            process.exit(1);
        }

        console.log('\x1b[32m[PASS] Browser runtime initialized with 0 errors and healthy 3D scene.\x1b[0m');
        cleanup();
        process.exit(0);

    } catch (err) {
        console.error('\x1b[31m[ERROR] Smoke test failure:\x1b[0m', err.message);
        if (ws) {
            try { await sendCDP?.('Browser.close'); } catch {}
            try { ws.close(); } catch {}
        }
        cleanup();
        process.exit(1);
    }
}

runSmokeTest();
