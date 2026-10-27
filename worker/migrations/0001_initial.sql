-- Text and grade CHECKs mirror worker/src/limits.ts and app/src/client-contract.ts.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE
    CHECK (length(username) BETWEEN 3 AND 30),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 50),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  -- Set at the first login, which requires a verified email. Until then the account is not public.
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- One-time codes that move a signed-in native session into a browser.
CREATE TABLE handoffs (
  code_hash TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE gyms (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL CHECK (country_code GLOB '[A-Z][A-Z]'),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  address TEXT NOT NULL CHECK (length(address) BETWEEN 3 AND 200),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  owner_grade TEXT NOT NULL
    CHECK (owner_grade GLOB 'V[0-9]' OR owner_grade GLOB 'V1[0-7]'),
  status TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden')),
  created_at INTEGER NOT NULL,
  -- Photos last: reading any column stored after a large blob walks its overflow pages.
  image BLOB,
  thumb BLOB,
  CHECK (
    (status = 'visible' AND image IS NOT NULL AND thumb IS NOT NULL) OR
    (status = 'hidden' AND image IS NULL AND thumb IS NULL)
  )
);

CREATE TABLE likes (
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (route_id, user_id)
);

-- A climber's log of a route. Only sent ascents count toward the public grade.
CREATE TABLE ascents (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent INTEGER NOT NULL CHECK (sent IN (0, 1)),
  grade TEXT CHECK (grade GLOB 'V[0-9]' OR grade GLOB 'V1[0-7]'),
  note TEXT CHECK (length(note) BETWEEN 1 AND 500),
  updated_at INTEGER NOT NULL,
  UNIQUE (route_id, user_id)
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

-- Reports outlive their reporter, who is anonymized when the account is deleted.
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('route', 'ascent', 'user')),
  target_id TEXT NOT NULL,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'offensive', 'inaccurate', 'other')),
  details TEXT CHECK (length(details) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (target_type, target_id, reporter_id)
);

-- Attempt counters for rate limiting; one row per key and window.
CREATE TABLE throttles (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX routes_feed ON routes(status, created_at DESC);
CREATE INDEX routes_gym ON routes(gym_id, created_at DESC);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX reports_status_created ON reports(status, created_at);
CREATE INDEX throttles_window ON throttles(window_start);

INSERT INTO gyms
  (id, country_code, name, address, latitude, longitude, status, created_at)
VALUES
  ('boulder-plus', 'SG', 'Boulder+ Aperia', '12 Kallang Ave, Singapore',
   1.3115, 103.8644, 'approved', strftime('%s', 'now'));
