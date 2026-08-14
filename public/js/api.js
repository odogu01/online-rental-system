const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

async function authenticatedFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
    // Never let the browser serve or revalidate API responses from its HTTP cache.
    // Without this, Express's ETag makes the browser re-request with If-None-Match
    // and the server answers 304 Not Modified with an empty body, which breaks
    // response.json() and surfaces as "Request failed with status 304".
    cache: 'no-store'
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    let response = await fetch(`${API_BASE}${endpoint}`, config);

    // A 304 can still slip through if a proxy or a stale browser cache entry
    // sends a conditional request. A 304 has no body, so retry once with a
    // cache-busting query param instead of surfacing a confusing error.
    if (response.status === 304) {
      const separator = endpoint.includes('?') ? '&' : '?';
      response = await fetch(`${API_BASE}${endpoint}${separator}_=${Date.now()}`, config);
    }

    if (response.status === 401 && !endpoint.includes('/auth/')) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && !endpoint.includes('/auth/refresh')) {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem('token', refreshData.data.token);
            headers['Authorization'] = `Bearer ${refreshData.data.token}`;
            const retryResponse = await fetch(`${API_BASE}${endpoint}`, { ...config, headers });
            return handleResponse(retryResponse);
          }
        } catch (e) {
          // Refresh failed, redirect to login
        }
      }
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login.html?session=expired';
      throw new ApiError('Session expired', 401, null);
    }

    return handleResponse(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message || 'Network error', 0, null);
  }
}

async function handleResponse(response) {
  // A 304 has no body and must never reach JSON parsing.
  // (Normally prevented by cache: 'no-store' + the server's Cache-Control header.)
  if (response.status === 304) {
    throw new ApiError('Stale cached response — please refresh the page and try again.', 304, null);
  }

  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('application/pdf')) {
    const blob = await response.blob();
    return { blob, filename: extractFilename(response) };
  }

  if (contentType && contentType.includes('text/csv')) {
    const text = await response.text();
    return { csv: text, filename: extractFilename(response) };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

function extractFilename(response) {
  const disposition = response.headers.get('content-disposition');
  if (disposition) {
    const match = disposition.match(/filename="?(.+?)"?$/);
    if (match) return match[1];
  }
  return `download-${Date.now()}`;
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

function isAuthenticated() {
  return !!localStorage.getItem('token');
}

function getRole() {
  const user = getUser();
  return user ? user.role : null;
}

async function apiGet(endpoint, params = {}) {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = query ? `${endpoint}?${query}` : endpoint;
  return authenticatedFetch(url);
}

async function apiPost(endpoint, data) {
  return authenticatedFetch(endpoint, { method: 'POST', body: data });
}

async function apiPut(endpoint, data) {
  return authenticatedFetch(endpoint, { method: 'PUT', body: data });
}

async function apiDelete(endpoint) {
  return authenticatedFetch(endpoint, { method: 'DELETE' });
}

async function downloadFile(endpoint, filename) {
  try {
    const result = await authenticatedFetch(endpoint);
    if (result.blob) {
      const url = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || filename || 'download.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else if (result.csv) {
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || filename || 'download.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}
