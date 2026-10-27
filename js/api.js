// ==========================================
// CINEVA API CONNECTOR (Client-side)
// Connects Frontend (GitHub Pages / Local) to CINEVA Database Server
// ==========================================
(() => {
  function getDefaultServerUrl() {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      const origin = window.location.origin;
      if (origin.startsWith('http://') || origin.startsWith('https://')) {
        if (!window.location.hostname.endsWith('github.io')) {
          return origin;
        }
      }
    }
    return 'http://localhost:3000';
  }

  const DEFAULT_SERVER_URL = getDefaultServerUrl();

  class CinevaApiClient {
    constructor() {
      const defaultUrl = getDefaultServerUrl();
      const stored = localStorage.getItem('cineva_server_url');
      if (stored && stored.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.endsWith('github.io')) {
        this.baseUrl = defaultUrl;
        localStorage.setItem('cineva_server_url', defaultUrl);
      } else {
        this.baseUrl = stored || defaultUrl;
      }
      this.token = localStorage.getItem('cineva_server_token') || null;
      this.isOnline = false;
      this.currentUser = null;
      this._statusListeners = [];
    }

    setServerUrl(url) {
      this.baseUrl = String(url || DEFAULT_SERVER_URL).replace(/\/+$/, '');
      localStorage.setItem('cineva_server_url', this.baseUrl);
      this.checkServer();
    }

    onStatusChange(cb) {
      if (typeof cb === 'function') this._statusListeners.push(cb);
    }

    _notifyStatus() {
      this._statusListeners.forEach(cb => {
        try { cb({ isOnline: this.isOnline, user: this.currentUser, baseUrl: this.baseUrl }); } catch (_) {}
      });
      this.renderServerStatusWidget();
    }

    async request(endpoint, options = {}) {
      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        'Accept': 'application/json',
        ...(options.headers || {})
      };

      if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
      }

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 401) {
            this.token = null;
            this.currentUser = null;
            localStorage.removeItem('cineva_server_token');
            this._notifyStatus();
          }
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        return data;
      } catch (err) {
        if (err.message && err.message.includes('Failed to fetch')) {
          this.isOnline = false;
          this._notifyStatus();
          throw new Error('Сервер недоступен. Запустите start-server.bat');
        }
        throw err;
      }
    }

    async checkServer() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${this.baseUrl}/api/status`, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        this.isOnline = Boolean(data && data.ok);

        if (this.isOnline && this.token) {
          try {
            const meRes = await this.request('/api/auth/me');
            this.currentUser = meRes.user || null;
          } catch (_) {
            this.currentUser = null;
          }
        }
      } catch (_) {
        this.isOnline = false;
        this.currentUser = null;
      }
      this._notifyStatus();
      return this.isOnline;
    }

    async register(username, handle, password) {
      const res = await this.request('/api/auth/register', {
        method: 'POST',
        body: { username, handle, password }
      });
      if (res.token) {
        this.token = res.token;
        this.currentUser = res.user;
        localStorage.setItem('cineva_server_token', res.token);
        this._notifyStatus();
      }
      return res;
    }

    async login(handleOrUsername, password) {
      const res = await this.request('/api/auth/login', {
        method: 'POST',
        body: { handle: handleOrUsername, password }
      });
      if (res.token) {
        this.token = res.token;
        this.currentUser = res.user;
        localStorage.setItem('cineva_server_token', res.token);
        this._notifyStatus();
      }
      return res;
    }

    async logout() {
      try {
        await this.request('/api/auth/logout', { method: 'POST' });
      } catch (_) {}
      this.token = null;
      this.currentUser = null;
      localStorage.removeItem('cineva_server_token');
      this._notifyStatus();
    }

    async getProfile() {
      return this.request('/api/user/profile');
    }

    async updateProfile(profileData) {
      const res = await this.request('/api/user/profile', {
        method: 'PUT',
        body: profileData
      });
      if (res.user) this.currentUser = res.user;
      this._notifyStatus();
      return res;
    }

    async getWatchlist() {
      const res = await this.request('/api/user/watchlist');
      return res.items || [];
    }

    async addToWatchlist(item) {
      const res = await this.request('/api/user/watchlist', {
        method: 'POST',
        body: item
      });
      return res.items || [];
    }

    async removeFromWatchlist(mediaId, mediaType) {
      const query = mediaType ? `?type=${encodeURIComponent(mediaType)}` : '';
      const res = await this.request(`/api/user/watchlist/${encodeURIComponent(mediaId)}${query}`, {
        method: 'DELETE'
      });
      return res.items || [];
    }

    async getRatings() {
      const res = await this.request('/api/user/ratings');
      return res.ratings || [];
    }

    async saveRating(rating) {
      const res = await this.request('/api/user/ratings', {
        method: 'POST',
        body: rating
      });
      return res.ratings || [];
    }

    async deleteRating(ratingId) {
      const res = await this.request(`/api/user/ratings/${encodeURIComponent(ratingId)}`, {
        method: 'DELETE'
      });
      return res.ratings || [];
    }

    async getTierlists() {
      const res = await this.request('/api/user/tierlists');
      return res.tierlists || [];
    }

    async saveTierlist(tierlist) {
      const res = await this.request('/api/user/tierlists', {
        method: 'POST',
        body: tierlist
      });
      return res.tierlist;
    }

    async deleteTierlist(tierlistId) {
      const res = await this.request(`/api/user/tierlists/${encodeURIComponent(tierlistId)}`, {
        method: 'DELETE'
      });
      return res.tierlists || [];
    }

    // Server status widget indicator in header
    renderServerStatusWidget() {
      let badge = document.getElementById('cinevaServerStatusBadge');
      if (!badge) {
        const topbar = document.querySelector('.site-topbar');
        if (!topbar) return;
        badge = document.createElement('div');
        badge.id = 'cinevaServerStatusBadge';
        badge.className = 'cv-server-status-pill';
        topbar.appendChild(badge);
      }

      if (this.isOnline) {
        if (this.currentUser) {
          badge.innerHTML = `<span class="status-dot online"></span> <span>Сервер: <strong>@${this.currentUser.handle}</strong></span>`;
          badge.title = `Подключено к базе данных SQLite. Сессия активна (@${this.currentUser.handle})`;
        } else {
          badge.innerHTML = `<span class="status-dot online"></span> <span>Сервер онлайн</span>`;
          badge.title = `Сервер баз данных запущен (${this.baseUrl}). Вы можете войти в аккаунт сервера.`;
        }
        badge.classList.add('is-online');
      } else {
        badge.innerHTML = `<span class="status-dot offline"></span> <span>Офлайн режим</span>`;
        badge.title = `Сервер не запущен. Сайт работает в автономном локальном режиме (LocalStorage).`;
        badge.classList.remove('is-online');
      }
    }
  }

  // Create global singleton
  window.CinevaAPI = new CinevaApiClient();

  // Initialize status check on page load
  document.addEventListener('DOMContentLoaded', () => {
    window.CinevaAPI.checkServer();
  });
})();
