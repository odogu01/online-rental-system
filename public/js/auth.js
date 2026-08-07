const AUTH_REDIRECTS = {
  'landlord': '/landlord/dashboard.html',
  'tenant': '/tenant/dashboard.html',
  'admin': '/admin/dashboard.html'
};

async function login(email, password) {
  try {
    const result = await apiPost('/auth/login', { email, password });
    const { token, refreshToken, user } = result.data;
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    return { success: true, user };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function register(userData) {
  try {
    const result = await apiPost('/auth/register', userData);
    const { token, refreshToken, user } = result.data;
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    return { success: true, user };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function redirectAfterLogin(role) {
  const target = AUTH_REDIRECTS[role] || '/login.html';
  window.location.href = target;
}

function checkAuth() {
  if (!isAuthenticated()) {
    const publicPages = ['/login.html', '/register.html', '/index.html', '/properties.html'];
    const currentPath = window.location.pathname;
    if (!publicPages.some(p => currentPath.endsWith(p))) {
      window.location.href = '/login.html';
      return false;
    }
  }
  return true;
}

function checkRole(allowedRoles) {
  const user = getUser();
  if (!user || !allowedRoles.includes(user.role)) {
    window.location.href = `/${user?.role || ''}/dashboard.html`;
    return false;
  }
  return true;
}

function protectPage(...allowedRoles) {
  if (!checkAuth()) return false;
  if (allowedRoles.length > 0) {
    return checkRole(allowedRoles);
  }
  return true;
}

function initAuthUI() {
  const user = getUser();
  if (!user) return;

  const userNameEls = document.querySelectorAll('.user-name');
  const userRoleEls = document.querySelectorAll('.user-role');
  const userAvatarEls = document.querySelectorAll('.user-avatar');
  const logoutBtns = document.querySelectorAll('.logout-btn');

  userNameEls.forEach(el => { el.textContent = user.fullName; });
  userRoleEls.forEach(el => {
    el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  });
  userAvatarEls.forEach(el => {
    el.textContent = user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  });
  logoutBtns.forEach(btn => { btn.addEventListener('click', logout); });

  const roleBadgeEls = document.querySelectorAll('.role-badge');
  roleBadgeEls.forEach(el => {
    el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    const colors = { landlord: 'bg-blue-100 text-blue-800', tenant: 'bg-green-100 text-green-800', admin: 'bg-purple-100 text-purple-800' };
    el.className = `role-badge ${colors[user.role] || ''}`;
  });
}

function handleSessionExpired() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('session') === 'expired') {
    showToast('Your session has expired. Please login again.', 'warning');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  handleSessionExpired();
  initAuthUI();
});
