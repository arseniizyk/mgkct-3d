// ==========================================
// МОДУЛЬ АНОНИМНОЙ ТЕЛЕМЕТРИИ ПОСЕЩЕНИЙ (CLOUDFLARE D1)
// ==========================================
(function() {
    'use strict';

    const DEFAULT_ENDPOINT = '__TELEMETRY_API_URL__/collect';

    // Polyfill for fetchLater() per modern web analytics guidance:
    // uses fetch keepalive or navigator.sendBeacon on visibilitychange when native fetchLater is unavailable.
    if (typeof globalThis.fetchLater !== 'function') {
        globalThis.fetchLater = function fetchLater(url, init) {
            const opts = init || {};
            let timeoutHandle;
            let activated = false;

            function destroy() {
                document.removeEventListener('visibilitychange', sendNow);
                clearTimeout(timeoutHandle);
            }

            function sendNow() {
                if (!(opts.signal && opts.signal.aborted)) {
                    try {
                        if ('keepalive' in Request.prototype || opts.method !== 'POST' || opts.headers) {
                            fetch(url, Object.assign({}, opts, { keepalive: true })).catch(function() {});
                            activated = true;
                        } else if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                            activated = navigator.sendBeacon(url, opts.body);
                        }
                    } catch (_) {}
                }
                destroy();
            }

            if (document.visibilityState === 'hidden') {
                queueMicrotask(sendNow);
            } else {
                document.addEventListener('visibilitychange', sendNow);
                if (typeof opts.activateAfter === 'number' && opts.activateAfter >= 0) {
                    timeoutHandle = setTimeout(sendNow, opts.activateAfter);
                }
            }

            if (opts.signal) {
                opts.signal.addEventListener('abort', destroy);
            }

            return {
                get activated() {
                    return activated;
                }
            };
        };
    }

    function generateSessionId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function getSessionId() {
        try {
            const key = 'mgkct_telemetry_sid';
            let sid = sessionStorage.getItem(key);
            if (!sid) {
                sid = generateSessionId();
                sessionStorage.setItem(key, sid);
            }
            return sid;
        } catch (_) {
            return generateSessionId();
        }
    }

    function detectGpuInfo() {
        try {
            let gl = null;
            if (typeof window !== 'undefined' && window.renderer && typeof window.renderer.getContext === 'function') {
                gl = window.renderer.getContext();
            }
            if (!gl && typeof document !== 'undefined') {
                const canvas = document.createElement('canvas');
                gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            }
            if (!gl) return { vendor: '', renderer: '' };

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                return {
                    vendor: String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '').trim(),
                    renderer: String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').trim()
                };
            }
            return {
                vendor: String(gl.getParameter(gl.VENDOR) || '').trim(),
                renderer: String(gl.getParameter(gl.RENDERER) || '').trim()
            };
        } catch (_) {
            return { vendor: '', renderer: '' };
        }
    }

    function detectDeviceType() {
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
        const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
        if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
            return 'tablet';
        }
        if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua) || w < 768) {
            return 'mobile';
        }
        return 'desktop';
    }

    function collectPayload(sessionId, startMs) {
        const gpu = detectGpuInfo();
        const nav = typeof navigator !== 'undefined' ? navigator : {};
        const scr = typeof window !== 'undefined' && window.screen ? window.screen : {};
        const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
        const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

        let referrerHost = '';
        try {
            if (typeof document !== 'undefined' && document.referrer) {
                const refUrl = new URL(document.referrer);
                if (typeof location === 'undefined' || refUrl.hostname !== location.hostname) {
                    referrerHost = refUrl.hostname + (refUrl.pathname && refUrl.pathname !== '/' ? refUrl.pathname : '');
                }
            }
        } catch (_) {}

        let timezone = '';
        try {
            timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (_) {}

        const durationSec = Math.max(0, Math.round((Date.now() - startMs) / 1000));
        const theme = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || '';

        return {
            sessionId: sessionId,
            durationSec: durationSec,
            deviceType: detectDeviceType(),
            screen: (scr.width && scr.height) ? (scr.width + 'x' + scr.height) : '',
            viewport: (typeof window !== 'undefined') ? (window.innerWidth + 'x' + window.innerHeight) : '',
            dpr: (typeof window !== 'undefined' && window.devicePixelRatio) ? Number(window.devicePixelRatio.toFixed(2)) : 1,
            touch: (typeof window !== 'undefined') && ('ontouchstart' in window || (nav.maxTouchPoints || 0) > 0),
            cores: nav.hardwareConcurrency || 0,
            memory: nav.deviceMemory || 0,
            gpuVendor: gpu.vendor,
            gpuRenderer: gpu.renderer,
            connType: conn.effectiveType || '',
            lang: nav.language || '',
            timezone: timezone,
            referrer: referrerHost,
            utmSource: params.get('utm_source') || params.get('ref') || '',
            pagePath: (typeof location !== 'undefined' ? location.pathname : '/'),
            theme: theme
        };
    }

    function initTelemetry() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        const ua = (navigator && navigator.userAgent) || '';
        // Skip automated headless test runs to avoid polluting live campus analytics
        if (/HeadlessChrome/i.test(ua) || (navigator && navigator.webdriver)) return;

        const rawEndpoint = window.MGKCT_TELEMETRY_ENDPOINT ||
            (function() { try { return localStorage.getItem('mgkct_telemetry_api'); } catch (_) { return ''; } })() ||
            DEFAULT_ENDPOINT;
        if (!rawEndpoint || rawEndpoint.indexOf('__TELEMETRY_API_URL__') !== -1) return;
        const endpoint = rawEndpoint.replace(/\/+$/, '').endsWith('/collect')
            ? rawEndpoint.replace(/\/+$/, '')
            : rawEndpoint.replace(/\/+$/, '') + '/collect';
        const sessionId = getSessionId();
        const startMs = Date.now();
        let fetchLaterController = null;

        function queueSessionBeacon(activateAfterMs) {
            if (fetchLaterController) {
                fetchLaterController.abort();
            }
            fetchLaterController = new AbortController();

            const payload = collectPayload(sessionId, startMs);
            try {
                globalThis.fetchLater(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: fetchLaterController.signal,
                    activateAfter: activateAfterMs
                });
            } catch (_) {}
        }

        // Send initial pageview immediately (activateAfter: 0) so active visits appear right away
        setTimeout(function() {
            queueSessionBeacon(0);
        }, 600);

        // Refresh queued session duration snapshot every 15 seconds for full-session measurement
        setInterval(function() {
            if (document.visibilityState === 'visible') {
                queueSessionBeacon(15000);
            }
        }, 15000);
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'complete') {
            initTelemetry();
        } else {
            window.addEventListener('load', initTelemetry, { once: true });
        }
    }
})();
