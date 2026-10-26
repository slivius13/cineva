// ==========================================
// CINEVA DATABASE ENGINE (SQLite built-in)
// Node.js official node:sqlite module (Zero external dependencies)
// ==========================================
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const DB_DIR = __dirname;
const DB_PATH = path.join(DB_DIR, 'cineva.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Open or create SQLite database file
const db = new DatabaseSync(DB_PATH);

// Enable WAL (Write-Ahead Logging) mode and foreign keys for high performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    avatar TEXT DEFAULT '🎬',
    avatar_type TEXT DEFAULT 'emoji',
    bio TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    year TEXT DEFAULT '',
    poster TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(user_id, media_id, media_type),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    title TEXT NOT NULL,
    year TEXT DEFAULT '',
    poster_url TEXT DEFAULT '',
    score INTEGER NOT NULL,
    tier TEXT NOT NULL,
    tier_short TEXT NOT NULL,
    tier_color TEXT NOT NULL,
    review TEXT DEFAULT '',
    criteria_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tierlists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    rows_json TEXT NOT NULL,
    unranked_json TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
  CREATE INDEX IF NOT EXISTS idx_tierlists_user ON tierlists(user_id);
`);

// ==========================================
// PASSWORD UTILITIES (Crypto Scrypt)
// ==========================================
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch (_) {
    return false;
  }
}

// ==========================================
// USER REPOSITORY
// ==========================================
function transliterate(str) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };
  return String(str || '').toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('');
}

function createUser({ username, handle, password, avatar = '🎬', bio = '' }) {
  const cleanUsername = String(username || handle || '').trim();
  if (!cleanUsername) throw new Error('Имя пользователя не может быть пустым');
  if (!password || password.length < 4) throw new Error('Пароль должен содержать минимум 4 символа');

  let cleanHandle = String(handle || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_-]/g, '');
  if (cleanHandle.length < 2) {
    cleanHandle = transliterate(cleanUsername).replace(/[^a-z0-9_-]/g, '');
  }
  if (cleanHandle.length < 2) {
    cleanHandle = 'user_' + crypto.randomBytes(3).toString('hex');
  }

  const existing = db.prepare('SELECT id FROM users WHERE handle = ?').get(cleanHandle);
  if (existing) throw new Error(`Пользователь с логином @${cleanHandle} уже зарегистрирован`);

  const id = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, username, handle, password_hash, password_salt, avatar, bio, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, cleanUsername, cleanHandle, hash, salt, avatar, bio, now, now);

  return getUserById(id);
}

function authenticateUser(handleOrName, password) {
  const query = String(handleOrName || '').trim().toLowerCase().replace(/^@/, '');
  const translitQuery = transliterate(query);
  const user = db.prepare('SELECT * FROM users WHERE LOWER(handle) = ? OR LOWER(handle) = ? OR LOWER(username) = ?').get(query, translitQuery, query);
  if (!user) throw new Error('Пользователь с таким логином не найден');

  const valid = verifyPassword(password, user.password_hash, user.password_salt);
  if (!valid) throw new Error('Неверный пароль');

  return sanitizeUser(user);
}

function getUserById(id) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return user ? sanitizeUser(user) : null;
}

function getUserByHandle(handle) {
  const cleanHandle = String(handle || '').trim().toLowerCase().replace(/^@/, '');
  const user = db.prepare('SELECT * FROM users WHERE handle = ?').get(cleanHandle);
  return user ? sanitizeUser(user) : null;
}

function updateUserProfile(id, { username, bio, avatar, avatarType }) {
  const existing = getUserById(id);
  if (!existing) throw new Error('Пользователь не найден');

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE users
    SET username = COALESCE(?, username),
        bio = COALESCE(?, bio),
        avatar = COALESCE(?, avatar),
        avatar_type = COALESCE(?, avatar_type),
        updated_at = ?
    WHERE id = ?
  `);
  stmt.run(username || null, bio !== undefined ? bio : null, avatar || null, avatarType || null, now, id);
  return getUserById(id);
}

function changeUserPassword(id, oldPassword, newPassword) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw new Error('Пользователь не найден');
  if (!verifyPassword(oldPassword, user.password_hash, user.password_salt)) {
    throw new Error('Старый пароль указан неверно');
  }
  if (!newPassword || newPassword.length < 4) {
    throw new Error('Новый пароль должен содержать минимум 4 символа');
  }
  const { hash, salt } = hashPassword(newPassword);
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
    .run(hash, salt, now, id);
  return true;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, password_salt, ...safe } = user;
  return safe;
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================
function createSession(userId, daysValid = 30) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + daysValid * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
  stmt.run(token, userId, now.toISOString(), expiresAt);
  return { token, expiresAt };
}

function getUserByToken(token) {
  if (!token) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return getUserById(session.user_id);
}

function deleteSession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ==========================================
// WATCHLIST REPOSITORY
// ==========================================
function getWatchlist(userId) {
  return db.prepare('SELECT * FROM watchlist WHERE user_id = ? ORDER BY id DESC').all(userId);
}

function addToWatchlist(userId, item) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO watchlist (user_id, media_id, media_type, source, title, year, poster, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, media_id, media_type) DO UPDATE SET
      title = excluded.title,
      year = excluded.year,
      poster = excluded.poster
  `);
  stmt.run(
    userId,
    String(item.id || item.media_id),
    item.media_type || item.type || 'movie',
    item.source || 'tmdb',
    item.title || item.name || 'Без названия',
    String(item.year || ''),
    item.poster || item.posterUrl || '',
    now
  );
  return getWatchlist(userId);
}

function removeFromWatchlist(userId, mediaId, mediaType) {
  if (mediaType) {
    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND media_id = ? AND media_type = ?')
      .run(userId, String(mediaId), mediaType);
  } else {
    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND media_id = ?')
      .run(userId, String(mediaId));
  }
  return getWatchlist(userId);
}

function clearWatchlist(userId) {
  db.prepare('DELETE FROM watchlist WHERE user_id = ?').run(userId);
  return [];
}

// ==========================================
// RATINGS REPOSITORY
// ==========================================
function getRatings(userId) {
  const rows = db.prepare('SELECT * FROM ratings WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return rows.map(r => ({
    ...r,
    criteria: JSON.parse(r.criteria_json || '{}')
  }));
}

function saveRating(userId, rating) {
  const now = new Date().toISOString();
  const id = rating.id || ('rate_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'));
  const criteriaJson = typeof rating.criteria === 'string' ? rating.criteria : JSON.stringify(rating.criteria || {});

  const stmt = db.prepare(`
    INSERT INTO ratings (id, user_id, media_id, title, year, poster_url, score, tier, tier_short, tier_color, review, criteria_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      year = excluded.year,
      poster_url = excluded.poster_url,
      score = excluded.score,
      tier = excluded.tier,
      tier_short = excluded.tier_short,
      tier_color = excluded.tier_color,
      review = excluded.review,
      criteria_json = excluded.criteria_json,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    id,
    userId,
    String(rating.media_id || rating.filmId || rating.id || ''),
    rating.title || 'Без названия',
    String(rating.year || ''),
    rating.poster_url || rating.posterUrl || '',
    Number(rating.score || 0),
    rating.tier || 'Ранг',
    rating.tier_short || rating.tierShort || '',
    rating.tier_color || rating.tierColor || '#34d399',
    rating.review || '',
    criteriaJson,
    rating.created_at || now,
    now
  );
  return getRatings(userId);
}

function deleteRating(userId, ratingId) {
  db.prepare('DELETE FROM ratings WHERE user_id = ? AND id = ?').run(userId, ratingId);
  return getRatings(userId);
}

// ==========================================
// TIERLISTS REPOSITORY
// ==========================================
function getTierlists(userId) {
  const rows = db.prepare('SELECT * FROM tierlists WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  return rows.map(t => ({
    ...t,
    rows: JSON.parse(t.rows_json || '[]'),
    unranked: JSON.parse(t.unranked_json || '[]')
  }));
}

function getTierlistById(id) {
  const t = db.prepare('SELECT * FROM tierlists WHERE id = ?').get(id);
  if (!t) return null;
  return {
    ...t,
    rows: JSON.parse(t.rows_json || '[]'),
    unranked: JSON.parse(t.unranked_json || '[]')
  };
}

function saveTierlist(userId, tierlist) {
  const now = new Date().toISOString();
  const id = tierlist.id || ('tier_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'));
  const rowsJson = typeof tierlist.rows === 'string' ? tierlist.rows : JSON.stringify(tierlist.rows || []);
  const unrankedJson = typeof tierlist.unranked === 'string' ? tierlist.unranked : JSON.stringify(tierlist.unranked || []);

  const stmt = db.prepare(`
    INSERT INTO tierlists (id, user_id, kind, title, author, rows_json, unranked_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      title = excluded.title,
      author = excluded.author,
      rows_json = excluded.rows_json,
      unranked_json = excluded.unranked_json,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    id,
    userId,
    tierlist.kind || 'movies',
    tierlist.title || 'Мой тирлист',
    tierlist.author || '',
    rowsJson,
    unrankedJson,
    tierlist.created_at || now,
    now
  );
  return getTierlistById(id);
}

function deleteTierlist(userId, tierlistId) {
  db.prepare('DELETE FROM tierlists WHERE user_id = ? AND id = ?').run(userId, tierlistId);
  return getTierlists(userId);
}

function getStats() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
  const ratingCount = db.prepare('SELECT COUNT(*) as count FROM ratings').get()?.count || 0;
  const tierlistCount = db.prepare('SELECT COUNT(*) as count FROM tierlists').get()?.count || 0;
  const watchlistCount = db.prepare('SELECT COUNT(*) as count FROM watchlist').get()?.count || 0;
  return { userCount, ratingCount, tierlistCount, watchlistCount };
}

module.exports = {
  db,
  DB_PATH,
  createUser,
  authenticateUser,
  getUserById,
  getUserByHandle,
  updateUserProfile,
  changeUserPassword,
  createSession,
  getUserByToken,
  deleteSession,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  clearWatchlist,
  getRatings,
  saveRating,
  deleteRating,
  getTierlists,
  getTierlistById,
  saveTierlist,
  deleteTierlist,
  getStats
};
