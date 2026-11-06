CREATE TABLE IF NOT EXISTS visits (
    session_id TEXT PRIMARY KEY,
    visitor_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    duration_sec INTEGER DEFAULT 0,
    device_type TEXT DEFAULT 'desktop',
    os TEXT DEFAULT 'Unknown',
    browser TEXT DEFAULT 'Unknown',
    screen TEXT DEFAULT '',
    viewport TEXT DEFAULT '',
    dpr REAL DEFAULT 1,
    touch INTEGER DEFAULT 0,
    cores INTEGER DEFAULT 0,
    memory REAL DEFAULT 0,
    gpu_vendor TEXT DEFAULT '',
    gpu_renderer TEXT DEFAULT '',
    country TEXT DEFAULT 'XX',
    city TEXT DEFAULT '',
    region TEXT DEFAULT '',
    timezone TEXT DEFAULT '',
    asn TEXT DEFAULT '',
    colo TEXT DEFAULT '',
    conn_type TEXT DEFAULT '',
    lang TEXT DEFAULT '',
    referrer TEXT DEFAULT '',
    utm_source TEXT DEFAULT '',
    page_path TEXT DEFAULT '/',
    theme TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_visitor_hash ON visits(visitor_hash);
CREATE INDEX IF NOT EXISTS idx_visits_device_type ON visits(device_type);
CREATE INDEX IF NOT EXISTS idx_visits_country ON visits(country);
