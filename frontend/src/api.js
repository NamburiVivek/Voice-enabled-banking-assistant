/**
 * api.js - Axios instance with JWT interceptors.
 * 🔒 Access tokens stored in memory (not localStorage) to mitigate XSS.
 * 🔒 Refresh tokens stored in localStorage — acceptable trade-off; httpOnly
 *    cookies would be ideal but require same-origin or proxy setup.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ── In-memory access token store ──────────────────────────────────────────────
// Using module-level variable so it survives React re-renders but is wiped on page refresh.
// This is safer than localStorage for access tokens (not accessible via XSS).
let _accessToken = null;

export const tokenStore = {
  get: () => _accessToken,
  set: (token) => { _accessToken = token; },
  clear: () => { _accessToken = null; },
};

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',  // 🔒 Helps CSRF detection
  },
  withCredentials: false,
});

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
let _isRefreshing = false;
let _failedQueue = [];

function processQueue(error, token = null) {
  _failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  _failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers['Authorization'] = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      _isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        _isRefreshing = false;
        tokenStore.clear();
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        tokenStore.set(data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        processQueue(null, data.access_token);
        original.headers['Authorization'] = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenStore.clear();
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth API helpers ──────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refresh: (data) => api.post('/auth/refresh', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// ── Banking API helpers ───────────────────────────────────────────────────────
export const bankingApi = {
  getVoxaUsers: () => api.get('/banking/users'),
  verifyRecipient: (identifier) => api.post('/banking/verify-recipient', { identifier }),
  getAccount: () => api.get('/banking/account'),
  transfer: (data) => api.post('/banking/transfer', data),
  deposit: (data) => api.post('/banking/deposit', data),
  billPay: (data) => api.post('/banking/bill-pay', data),
  sync: (data) => api.post('/banking/sync', data),
};


// ─── Voice AI API helpers ───────────────────────────────────────────────────
export const voiceApi = {
  chat: (queryOrPayload, sessionId, currentBalance = null) => {
    if (typeof queryOrPayload === 'object' && queryOrPayload !== null) {
      return api.post('/voice/chat', queryOrPayload);
    }
    return api.post('/voice/chat', {
      query: queryOrPayload,
      session_id: sessionId,
      current_balance: currentBalance,
    });
  },
  resetSession: (sessionId) =>
    api.post(`/voice/reset-session?session_id=${encodeURIComponent(sessionId)}`),
};

export default api;
