/**
 * MGKCT 3D — Serverless Telemetry Worker (Cloudflare Workers + D1 SQLite)
 *
 * Endpoints:
 *   POST /collect  — Ingests page visits and session duration updates
 *   GET  /stats    — Returns aggregated telemetry and filtered recent visits (requires key)
 *   GET  /health   — Health check
 */

const BOT_UA_REGEX = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|facebookexternalhit|whatsapp|telegrambot|discordbot|preview|curl|wget|python-requests/i;

function getCorsHeaders(request) {
    const origin = request.headers.get('Origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telemetry-Key',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function jsonResponse(data, status = 200, request) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...getCorsHeaders(request)
        }
    });
}

async function sha256Short(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function cleanStr(val, maxLen = 120) {
    if (typeof val !== 'string') return '';
    return val.trim().slice(0, maxLen);
}

function parseUserAgent(ua) {
    const s = ua || '';
    let os = 'Other';
    if (/Windows NT 10|Windows NT 11/i.test(s)) os = 'Windows';
    else if (/Windows/i.test(s)) os = 'Windows';
    else if (/Android/i.test(s)) {
        const m = s.match(/Android\s+([0-9.]+)/i);
        os = m ? `Android ${m[1].split('.')[0]}` : 'Android';
    } else if (/iPhone|iPad|iPod/i.test(s)) {
        const m = s.match(/OS\s+([0-9_]+)/i);
        os = m ? `iOS ${m[1].split('_')[0]}` : 'iOS';
    } else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
    else if (/CrOS/i.test(s)) os = 'ChromeOS';
    else if (/Linux/i.test(s)) os = 'Linux';

    let browser = 'Other';
    if (/YaBrowser/i.test(s)) browser = 'Yandex';
    else if (/EdgA?|EdgiOS/i.test(s)) browser = 'Edge';
    else if (/OPR|Opera/i.test(s)) browser = 'Opera';
    else if (/SamsungBrowser/i.test(s)) browser = 'Samsung Internet';
    else if (/Firefox|FxiOS/i.test(s)) browser = 'Firefox';
    else if (/CriOS|Chrome/i.test(s) && !/Edg|OPR|YaBrowser/i.test(s)) browser = 'Chrome';
    else if (/Safari/i.test(s) && !/Chrome|CriOS|Android/i.test(s)) browser = 'Safari';

    let deviceType = 'desktop';
    if (/iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) {
        deviceType = 'tablet';
    } else if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(s)) {
        deviceType = 'mobile';
    }

    return { os, browser, deviceType };
}

function checkAuth(request, env) {
    const requiredKey = env.STATS_KEY;
    if (!requiredKey) return false;
    const url = new URL(request.url);
    const headerKey = request.headers.get('X-Telemetry-Key') ||
        (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const queryKey = url.searchParams.get('key') || '';
    return headerKey === requiredKey || queryKey === requiredKey;
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: getCorsHeaders(request) });
        }

        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '') || '/';

        if (path === '/health' || path === '') {
            return jsonResponse({ ok: true, service: 'mgkct-telemetry', timestamp: Date.now() }, 200, request);
        }

        try {
            if (path === '/collect' && request.method === 'POST') {
                return await handleCollect(request, env);
            }

            if (path === '/stats' && request.method === 'GET') {
                if (!checkAuth(request, env)) {
                    return jsonResponse({ error: 'Unauthorized: invalid telemetry key' }, 401, request);
                }
                return await handleStats(request, env, url);
            }

            return jsonResponse({ error: 'Not found' }, 404, request);
        } catch (err) {
            return jsonResponse({ error: 'Internal server error', message: String(err && err.message || err) }, 500, request);
        }
    }
};

async function handleCollect(request, env) {
    const ua = request.headers.get('User-Agent') || '';
    if (!ua || BOT_UA_REGEX.test(ua)) {
        return jsonResponse({ ok: true, skipped: 'bot' }, 200, request);
    }

    let body = {};
    try {
        const rawText = await request.text();
        if (rawText) body = JSON.parse(rawText);
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON payload' }, 400, request);
    }

    const sessionId = cleanStr(body.sessionId, 64);
    if (!sessionId || sessionId.length < 8) {
        return jsonResponse({ error: 'Missing valid sessionId' }, 400, request);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const durationSec = Math.max(0, Math.min(86400, Math.round(Number(body.durationSec) || 0)));

    // Extract Cloudflare network & geolocation metadata
    const cf = request.cf || {};
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '0.0.0.0';
    const country = cleanStr(cf.country || request.headers.get('CF-IPCountry') || 'XX', 8);
    const city = cleanStr(cf.city || '', 64);
    const region = cleanStr(cf.region || '', 64);
    const timezone = cleanStr(cf.timezone || body.timezone || '', 64);
    const asn = cf.asn ? `AS${cf.asn} ${cleanStr(cf.asOrganization || '', 48)}`.trim() : '';
    const colo = cleanStr(cf.colo || '', 16);

    const parsedUA = parseUserAgent(ua);
    const deviceType = ['mobile', 'tablet', 'desktop'].includes(body.deviceType)
        ? body.deviceType
        : parsedUA.deviceType;
    const os = cleanStr(body.os || parsedUA.os, 40) || parsedUA.os;
    const browser = cleanStr(body.browser || parsedUA.browser, 40) || parsedUA.browser;

    const screen = cleanStr(body.screen, 24);
    const viewport = cleanStr(body.viewport, 24);
    const dpr = Math.max(0.5, Math.min(5, Number(body.dpr) || 1));
    const touch = body.touch ? 1 : 0;
    const cores = Math.max(0, Math.min(256, Math.round(Number(body.cores) || 0)));
    const memory = Math.max(0, Math.min(1024, Number(body.memory) || 0));
    const gpuVendor = cleanStr(body.gpuVendor, 64);
    const gpuRenderer = cleanStr(body.gpuRenderer, 120);
    const connType = cleanStr(body.connType, 24);
    const lang = cleanStr(body.lang || (request.headers.get('Accept-Language') || '').split(',')[0], 24);
    const referrer = cleanStr(body.referrer, 200);
    const utmSource = cleanStr(body.utmSource, 64);
    const pagePath = cleanStr(body.pagePath || '/', 120);
    const theme = cleanStr(body.theme, 16);

    const salt = env.HASH_SALT || 'anon-salt';
    const visitorHash = await sha256Short(`${ip}|${ua}|${screen}|${salt}`);

    await env.DB.prepare(`
        INSERT INTO visits (
            session_id, visitor_hash, created_at, updated_at, duration_sec,
            device_type, os, browser, screen, viewport, dpr, touch, cores, memory,
            gpu_vendor, gpu_renderer, country, city, region, timezone, asn, colo,
            conn_type, lang, referrer, utm_source, page_path, theme
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
            ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22,
            ?23, ?24, ?25, ?26, ?27, ?28
        )
        ON CONFLICT(session_id) DO UPDATE SET
            updated_at = excluded.updated_at,
            duration_sec = MAX(visits.duration_sec, excluded.duration_sec),
            viewport = CASE WHEN excluded.viewport != '' THEN excluded.viewport ELSE visits.viewport END,
            theme = CASE WHEN excluded.theme != '' THEN excluded.theme ELSE visits.theme END
    `).bind(
        sessionId, visitorHash, nowSec, nowSec, durationSec,
        deviceType, os, browser, screen, viewport, dpr, touch, cores, memory,
        gpuVendor, gpuRenderer, country, city, region, timezone, asn, colo,
        connType, lang, referrer, utmSource, pagePath, theme
    ).run();

    return jsonResponse({ ok: true, sessionId, visitorHash }, 200, request);
}

async function handleStats(request, env, url) {
    const period = url.searchParams.get('period') || '7d';
    const deviceFilter = cleanStr(url.searchParams.get('device') || '', 24);
    const osFilter = cleanStr(url.searchParams.get('os') || '', 40);
    const browserFilter = cleanStr(url.searchParams.get('browser') || '', 40);
    const countryFilter = cleanStr(url.searchParams.get('country') || '', 8);
    const searchFilter = cleanStr(url.searchParams.get('q') || '', 64);
    const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '100', 10)));

    const nowSec = Math.floor(Date.now() / 1000);
    let sinceSec = 0;
    if (period === '24h') sinceSec = nowSec - 86400;
    else if (period === '7d') sinceSec = nowSec - 7 * 86400;
    else if (period === '30d') sinceSec = nowSec - 30 * 86400;
    else if (period === '90d') sinceSec = nowSec - 90 * 86400;

    const conditions = ['created_at >= ?'];
    const params = [sinceSec];

    if (deviceFilter) {
        conditions.push('device_type = ?');
        params.push(deviceFilter);
    }
    if (osFilter) {
        conditions.push('os = ?');
        params.push(osFilter);
    }
    if (browserFilter) {
        conditions.push('browser = ?');
        params.push(browserFilter);
    }
    if (countryFilter) {
        conditions.push('country = ?');
        params.push(countryFilter);
    }
    if (searchFilter) {
        conditions.push('(gpu_renderer LIKE ? OR city LIKE ? OR asn LIKE ? OR referrer LIKE ? OR visitor_hash LIKE ? OR screen LIKE ?)');
        const likeVal = `%${searchFilter}%`;
        params.push(likeVal, likeVal, likeVal, likeVal, likeVal, likeVal);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const summaryStmt = env.DB.prepare(`
        SELECT
            COUNT(*) AS total_visits,
            COUNT(DISTINCT visitor_hash) AS unique_visitors,
            ROUND(AVG(CASE WHEN duration_sec > 0 THEN duration_sec ELSE NULL END), 1) AS avg_duration_sec,
            SUM(CASE WHEN device_type = 'mobile' OR device_type = 'tablet' THEN 1 ELSE 0 END) AS mobile_visits,
            SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) AS active_now
        FROM visits
        ${whereClause}
    `).bind(nowSec - 300, ...params);

    const devicesStmt = env.DB.prepare(`
        SELECT device_type AS name, COUNT(*) AS count
        FROM visits ${whereClause}
        GROUP BY device_type ORDER BY count DESC
    `).bind(...params);

    const osStmt = env.DB.prepare(`
        SELECT os AS name, COUNT(*) AS count
        FROM visits ${whereClause}
        GROUP BY os ORDER BY count DESC LIMIT 10
    `).bind(...params);

    const browsersStmt = env.DB.prepare(`
        SELECT browser AS name, COUNT(*) AS count
        FROM visits ${whereClause}
        GROUP BY browser ORDER BY count DESC LIMIT 10
    `).bind(...params);

    const gpusStmt = env.DB.prepare(`
        SELECT CASE WHEN gpu_renderer != '' THEN gpu_renderer ELSE 'Unknown GPU' END AS name, COUNT(*) AS count
        FROM visits ${whereClause}
        GROUP BY name ORDER BY count DESC LIMIT 10
    `).bind(...params);

    const countriesStmt = env.DB.prepare(`
        SELECT country AS name, city, COUNT(*) AS count
        FROM visits ${whereClause}
        GROUP BY country, city ORDER BY count DESC LIMIT 12
    `).bind(...params);

    const screensStmt = env.DB.prepare(`
        SELECT CASE WHEN screen != '' THEN screen ELSE 'Unknown' END AS name, COUNT(*) AS count
        FROM visits ${whereClause}
        GROUP BY name ORDER BY count DESC LIMIT 8
    `).bind(...params);

    const referrersStmt = env.DB.prepare(`
        SELECT CASE WHEN referrer != '' THEN referrer ELSE 'Прямой заход (Direct)' END AS name, COUNT(*) AS count
        FROM visits ${whereClause}
        GROUP BY name ORDER BY count DESC LIMIT 8
    `).bind(...params);

    const bucketSeconds = period === '24h' ? 3600 : 86400;
    const timelineStmt = env.DB.prepare(`
        SELECT
            (created_at / ${bucketSeconds}) * ${bucketSeconds} AS bucket_ts,
            COUNT(*) AS visits,
            COUNT(DISTINCT visitor_hash) AS uniques
        FROM visits ${whereClause}
        GROUP BY bucket_ts
        ORDER BY bucket_ts ASC
        LIMIT 90
    `).bind(...params);

    const recentStmt = env.DB.prepare(`
        SELECT
            session_id, visitor_hash, created_at, updated_at, duration_sec,
            device_type, os, browser, screen, viewport, dpr, touch, cores, memory,
            gpu_vendor, gpu_renderer, country, city, region, timezone, asn,
            conn_type, lang, referrer, utm_source, page_path, theme
        FROM visits
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ?
    `).bind(...params, limit);

    const [
        summaryRes,
        devicesRes,
        osRes,
        browsersRes,
        gpusRes,
        countriesRes,
        screensRes,
        referrersRes,
        timelineRes,
        recentRes
    ] = await env.DB.batch([
        summaryStmt,
        devicesStmt,
        osStmt,
        browsersStmt,
        gpusStmt,
        countriesStmt,
        screensStmt,
        referrersStmt,
        timelineStmt,
        recentStmt
    ]);

    return jsonResponse({
        ok: true,
        period,
        summary: (summaryRes.results && summaryRes.results[0]) || {
            total_visits: 0,
            unique_visitors: 0,
            avg_duration_sec: 0,
            mobile_visits: 0,
            active_now: 0
        },
        breakdown: {
            devices: devicesRes.results || [],
            os: osRes.results || [],
            browsers: browsersRes.results || [],
            gpus: gpusRes.results || [],
            locations: countriesRes.results || [],
            screens: screensRes.results || [],
            referrers: referrersRes.results || []
        },
        timeline: timelineRes.results || [],
        recent: recentRes.results || []
    }, 200, request);
}
