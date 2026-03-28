// api.js — клиент для работы с бэкендом ArtWin
const API = 'https://api.artwin.live/api';

// ===== TOKEN MANAGEMENT =====
const Token = {
  get: () => localStorage.getItem('artwin_access'),
  getRefresh: () => localStorage.getItem('artwin_refresh'),
  set: (access, refresh) => {
    localStorage.setItem('artwin_access', access);
    if (refresh) localStorage.setItem('artwin_refresh', refresh);
  },
  clear: () => {
    localStorage.removeItem('artwin_access');
    localStorage.removeItem('artwin_refresh');
    localStorage.removeItem('artwin_user');
  },
};

const User = {
  get: () => { try { return JSON.parse(localStorage.getItem('artwin_user')); } catch { return null; } },
  set: (u) => localStorage.setItem('artwin_user', JSON.stringify(u)),
  clear: () => localStorage.removeItem('artwin_user'),
};

// ===== BASE FETCH =====
let isRefreshing = false;
let refreshQueue = [];

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = Token.get();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API + path, { ...options, headers });

  // Попытка обновить токен
  if (res.status === 401) {
    const data = await res.json();
    if (data.code === 'TOKEN_EXPIRED') {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(API + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: Token.getRefresh() }),
          });
          if (refreshRes.ok) {
            const tokens = await refreshRes.json();
            Token.set(tokens.accessToken, tokens.refreshToken);
            isRefreshing = false;
            refreshQueue.forEach(cb => cb(tokens.accessToken));
            refreshQueue = [];
            // Повторяем исходный запрос
            return apiFetch(path, options);
          } else {
            Token.clear();
            isRefreshing = false;
            window.location.reload();
          }
        } catch {
          Token.clear();
          isRefreshing = false;
        }
      }
      // Ждём пока обновится токен
      return new Promise((resolve) => {
        refreshQueue.push(() => resolve(apiFetch(path, options)));
      });
    }
    throw { status: 401, message: data.error };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: json.error || json.errors?.[0]?.msg || 'Ошибка запроса' };
  return json;
}

// ===== AUTH API =====
const AuthAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmail: (userId, code) => apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ userId, code }) }),
  resendCode: (userId) => apiFetch('/auth/resend-code', { method: 'POST', body: JSON.stringify({ userId }) }),
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: Token.getRefresh() }) }),
};

// ===== JOBS API =====
const JobsAPI = {
  list: (params = {}) => apiFetch('/jobs?' + new URLSearchParams(params)),
  get: (uuid) => apiFetch('/jobs/' + uuid),
  create: (data) => apiFetch('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: (uuid, data) => apiFetch('/jobs/' + uuid, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (uuid) => apiFetch('/jobs/' + uuid, { method: 'DELETE' }),
  myPosted: () => apiFetch('/jobs/my/posted'),
  myProposals: () => apiFetch('/jobs/my/proposals'),
  getProposals: (uuid) => apiFetch('/jobs/' + uuid + '/proposals'),
  apply: (uuid, data) => apiFetch('/jobs/' + uuid + '/proposals', { method: 'POST', body: JSON.stringify(data) }),
};

// ===== USERS API =====
const UsersAPI = {
  me: () => apiFetch('/users/me'),
  updateMe: (data) => apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  updateSkills: (skills) => apiFetch('/users/me/skills', { method: 'PUT', body: JSON.stringify({ skills }) }),
  get: (uuid) => apiFetch('/users/' + uuid),
  list: (params = {}) => apiFetch('/users?' + new URLSearchParams(params)),
  getPortfolio: () => apiFetch('/users/me/portfolio'),
  addPortfolio: (data) => apiFetch('/users/me/portfolio', { method: 'POST', body: JSON.stringify(data) }),
  deletePortfolio: (id) => apiFetch('/users/me/portfolio/' + id, { method: 'DELETE' }),
};

// ===== MESSAGES API =====
const MessagesAPI = {
  conversations: () => apiFetch('/messages/conversations'),
  history: (uuid) => apiFetch('/messages/' + uuid),
  send: (uuid, content) => apiFetch('/messages/' + uuid, { method: 'POST', body: JSON.stringify({ content }) }),
};

// ===== WALLET API =====
const WalletAPI = {
  get: () => apiFetch('/wallet'),
  transactions: (params = {}) => apiFetch('/wallet/transactions?' + new URLSearchParams(params)),
  withdraw: (amount, method) => apiFetch('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount, method }) }),
};

// ===== NOTIFICATIONS API =====
const NotifsAPI = {
  list: () => apiFetch('/notifications'),
  readAll: () => apiFetch('/notifications/read-all', { method: 'PATCH' }),
  read: (id) => apiFetch('/notifications/' + id + '/read', { method: 'PATCH' }),
};
