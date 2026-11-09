const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon'
};

const COMPRESSIBLE_EXTS = new Set(['.html', '.js', '.css', '.json', '.svg']);

function handleRequest(req, res) {
    let reqPath;
    try {
        reqPath = decodeURI(req.url.split('?')[0]);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Bad Request');
    }
    if (reqPath === '/' || reqPath === '') {
        reqPath = '/index.html';
    }

    const safeRoot = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
    const filePath = path.normalize(path.join(ROOT, reqPath));
    if (filePath !== ROOT && !filePath.startsWith(safeRoot)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('File not found: ' + reqPath);
        }

        let actualFilePath = filePath;
        if (stats.isDirectory()) {
            actualFilePath = path.join(filePath, 'index.html');
            if (!fs.existsSync(actualFilePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end('File not found: ' + reqPath);
            }
        }

        const ext = path.extname(actualFilePath).toLowerCase();
        const contentType = MIME[ext] || 'application/octet-stream';

        const headers = {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        };

        const acceptEncoding = req.headers['accept-encoding'] || '';
        const shouldGzip = COMPRESSIBLE_EXTS.has(ext) && /\bgzip\b/.test(acceptEncoding);
        if (shouldGzip) {
            headers['Content-Encoding'] = 'gzip';
            headers['Vary'] = 'Accept-Encoding';
        }

        res.writeHead(200, headers);

        const fileStream = fs.createReadStream(actualFilePath);
        fileStream.on('error', () => {
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            }
            res.end('Internal Server Error');
        });

        if (shouldGzip) {
            fileStream.pipe(zlib.createGzip()).pipe(res);
        } else {
            fileStream.pipe(res);
        }
    });
}

const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    console.log(`Server running at:`);
    console.log(`  Local:   http://localhost:${PORT}/`);
    addresses.forEach(ip => {
        console.log(`  Network: http://${ip}:${PORT}/`);
    });
});
