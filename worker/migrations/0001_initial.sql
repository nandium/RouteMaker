PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE
    CHECK (length(username) BETWEEN 3 AND 30),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 50),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  requested_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  gym_id TEXT NOT NULL REFERENCES gyms(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  owner_grade TEXT NOT NULL
    CHECK (owner_grade GLOB 'V[0-9]' OR owner_grade GLOB 'V1[0-7]'),
  image BLOB,
  status TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden')),
  created_at INTEGER NOT NULL,
  CHECK (
    (status = 'visible' AND image IS NOT NULL) OR
    (status = 'hidden' AND image IS NULL)
  )
);

CREATE TABLE votes (
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (route_id, user_id)
);

CREATE TABLE grades (
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK (grade GLOB 'V[0-9]' OR grade GLOB 'V1[0-7]'),
  PRIMARY KEY (route_id, user_id)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE (route_id, user_id)
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('route', 'comment', 'user')),
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE (target_type, target_id, user_id)
);

CREATE INDEX routes_feed ON routes(status, created_at DESC);
CREATE INDEX routes_gym ON routes(gym_id, created_at DESC);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX comments_route_visible ON comments(route_id, hidden, created_at);
CREATE INDEX reports_status_created ON reports(status, created_at);

INSERT INTO gyms
  (id, country_code, name, address, latitude, longitude, status, created_at)
VALUES
  ('boulder-plus', 'SG', 'Boulder+ Aperia', '12 Kallang Ave, Singapore',
   1.3115, 103.8644, 'approved', strftime('%s', 'now'));
