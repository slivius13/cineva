// ==========================================
// CINEVA HTTP & REST API SERVER
// Built with Node.js standard library (Zero dependencies)
// Supports Localhost & GitHub Pages via Universal CORS
// ==========================================
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const os = require('node:os');
const db = require('./db.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const STATIC_ROOT = path.resolve(__dirname, '..');

function getLocalIpAddresses() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+([a-f0-9]+)$/i);
  if (!match) return null;
  return db.getUserByToken(match[1]);
}

// ==========================================
// STATIC FILE SERVING
// ==========================================
function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(STATIC_ROOT, relativePath));

  // Security check: restrict within workspace
  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// ==========================================
// REQUEST ROUTER
// ==========================================
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // 1. Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // 2. REST API Routes
  if (pathname.startsWith('/api/')) {
    try {
      // Status
      if (method === 'GET' && pathname === '/api/status') {
        const stats = db.getStats();
        return sendJson(res, 200, {
          ok: true,
          service: 'CINEVA Cinema Server',
          version: '2.0.0',
          database: 'SQLite (Built-in)',
          stats
        });
      }

      // --- AUTHENTICATION ---
      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await parseJsonBody(req);
        const user = db.createUser(body);
        const session = db.createSession(user.id);
        return sendJson(res, 201, { ok: true, user, token: session.token });
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await parseJsonBody(req);
        const user = db.authenticateUser(body.handle || body.username, body.password);
        const session = db.createSession(user.id);
        return sendJson(res, 200, { ok: true, user, token: session.token });
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        return sendJson(res, 200, { ok: true, user });
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        const authHeader = req.headers.authorization || '';
        const match = authHeader.match(/^Bearer\s+([a-f0-9]+)$/i);
        if (match) db.deleteSession(match[1]);
        return sendJson(res, 200, { ok: true });
      }

      if (method === 'POST' && pathname === '/api/auth/password') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const body = await parseJsonBody(req);
        db.changeUserPassword(user.id, body.oldPassword, body.newPassword);
        return sendJson(res, 200, { ok: true, message: 'Пароль успешно изменён' });
      }

      // --- USER PROFILE ---
      if (method === 'GET' && pathname === '/api/user/profile') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const watchlist = db.getWatchlist(user.id);
        const ratings = db.getRatings(user.id);
        const tierlists = db.getTierlists(user.id);
        return sendJson(res, 200, {
          ok: true,
          user,
          watchlist,
          ratings,
          tierlists
        });
      }

      if (method === 'PUT' && pathname === '/api/user/profile') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const body = await parseJsonBody(req);
        const updated = db.updateUserProfile(user.id, body);
        return sendJson(res, 200, { ok: true, user: updated });
      }

      // --- WATCHLIST ---
      if (method === 'GET' && pathname === '/api/user/watchlist') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const items = db.getWatchlist(user.id);
        return sendJson(res, 200, { ok: true, items });
      }

      if (method === 'POST' && pathname === '/api/user/watchlist') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const body = await parseJsonBody(req);
        const items = db.addToWatchlist(user.id, body);
        return sendJson(res, 200, { ok: true, items });
      }

      if (method === 'DELETE' && pathname.startsWith('/api/user/watchlist/')) {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const mediaId = pathname.replace('/api/user/watchlist/', '');
        const mediaType = parsedUrl.query.type;
        const items = db.removeFromWatchlist(user.id, mediaId, mediaType);
        return sendJson(res, 200, { ok: true, items });
      }

      if (method === 'POST' && pathname === '/api/user/watchlist/clear') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        db.clearWatchlist(user.id);
        return sendJson(res, 200, { ok: true, items: [] });
      }

      // --- RATINGS ---
      if (method === 'GET' && pathname === '/api/user/ratings') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const ratings = db.getRatings(user.id);
        return sendJson(res, 200, { ok: true, ratings });
      }

      if (method === 'POST' && pathname === '/api/user/ratings') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const body = await parseJsonBody(req);
        const ratings = db.saveRating(user.id, body);
        return sendJson(res, 200, { ok: true, ratings });
      }

      if (method === 'DELETE' && pathname.startsWith('/api/user/ratings/')) {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const ratingId = pathname.replace('/api/user/ratings/', '');
        const ratings = db.deleteRating(user.id, ratingId);
        return sendJson(res, 200, { ok: true, ratings });
      }

      // --- TIERLISTS ---
      if (method === 'GET' && pathname === '/api/user/tierlists') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const tierlists = db.getTierlists(user.id);
        return sendJson(res, 200, { ok: true, tierlists });
      }

      if (method === 'POST' && pathname === '/api/user/tierlists') {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const body = await parseJsonBody(req);
        const tierlist = db.saveTierlist(user.id, body);
        return sendJson(res, 200, { ok: true, tierlist });
      }

      if (method === 'DELETE' && pathname.startsWith('/api/user/tierlists/')) {
        const user = getAuthUser(req);
        if (!user) return sendJson(res, 401, { ok: false, error: 'Не авторизован' });
        const tierlistId = pathname.replace('/api/user/tierlists/', '');
        const tierlists = db.deleteTierlist(user.id, tierlistId);
        return sendJson(res, 200, { ok: true, tierlists });
      }

      // --- PUBLIC VIEWS (Direct shareable links) ---
      if (method === 'GET' && pathname.startsWith('/api/public/tierlist/')) {
        const id = pathname.replace('/api/public/tierlist/', '');
        const tierlist = db.getTierlistById(id);
        if (!tierlist) return sendJson(res, 404, { ok: false, error: 'Тирлист не найден' });
        const author = db.getUserById(tierlist.user_id);
        return sendJson(res, 200, {
          ok: true,
          tierlist: { ...tierlist, authorUser: author ? { username: author.username, handle: author.handle, avatar: author.avatar } : null }
        });
      }

      if (method === 'GET' && pathname.startsWith('/api/public/user/')) {
        const handle = pathname.replace('/api/public/user/', '');
        const author = db.getUserByHandle(handle);
        if (!author) return sendJson(res, 404, { ok: false, error: 'Пользователь не найден' });
        const ratings = db.getRatings(author.id);
        const tierlists = db.getTierlists(author.id);
        return sendJson(res, 200, {
          ok: true,
          user: author,
          ratingsCount: ratings.length,
          tierlistsCount: tierlists.length,
          tierlists
        });
      }

      // Unknown API route
      return sendJson(res, 404, { ok: false, error: `Маршрут ${method} ${pathname} не найден` });
    } catch (err) {
      console.error(`[API Error] ${method} ${pathname}:`, err);
      return sendJson(res, 400, { ok: false, error: err.message || 'Ошибка сервера' });
    }
  }

  // 3. Serve Frontend Static Files
  serveStaticFile(req, res, pathname);
});

// Start listening
server.listen(PORT, HOST, () => {
  const ips = getLocalIpAddresses();
  console.log('====================================================');
  console.log('🎬 [CINEVA] Сервер успешно запущен на вашем ПК!');
  console.log(`💾 База данных SQLite: ${db.DB_PATH}`);
  console.log('----------------------------------------------------');
  console.log(`💻 На этом компьютере: http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`📱 С телефона / планшета (${ip.name}): http://${ip.address}:${PORT}`);
  });
  console.log('----------------------------------------------------');
  console.log('🌐 Все данные с любых устройств сохраняются прямо в вашу базу на этом ПК.');
  console.log('====================================================');
});
