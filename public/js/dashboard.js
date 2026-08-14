async function loadDashboardStats(endpoint, cardMappings) {
  try {
    showSkeletonLoading();

    const data = await apiGet(endpoint);

    for (const [key, selector] of Object.entries(cardMappings)) {
      const value = getNestedValue(data, key);
      const el = document.querySelector(selector);
      if (el) {
        el.textContent = value !== undefined && value !== null ? value : '0';
        animateCounter(el, value || 0);
      }
    }

    return data;
  } catch (error) {
    showToast('Failed to load dashboard data: ' + error.message, 'error');
  } finally {
    hideSkeletonLoading();
  }
}

function animateCounter(el, target) {
  const current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (target === current) return;

  const duration = 800;
  const steps = 20;
  const increment = (target - current) / steps;
  let step = 0;

  const timer = setInterval(() => {
    step++;
    const value = Math.round(current + increment * step);
    el.textContent = value.toLocaleString();
    if (step >= steps) {
      el.textContent = target.toLocaleString();
      clearInterval(timer);
    }
  }, duration / steps);
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function showSkeletonLoading() {
  document.querySelectorAll('.skeleton').forEach(el => {
    el.classList.add('animate-pulse', 'bg-gray-200', 'rounded');
  });
}

function hideSkeletonLoading() {
  document.querySelectorAll('.skeleton').forEach(el => {
    el.classList.remove('animate-pulse', 'bg-gray-200', 'rounded');
  });
}

function loadRecentActivities(endpoint, containerSelector, templateFn) {
  apiGet(endpoint)
    .then(data => {
      const items = data.data?.activities || data.data?.leases || data.data?.payments || data.data?.requests || [];
      const container = document.querySelector(containerSelector);
      if (!container) return;

      if (items.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-3xl mb-2"></i><p>No recent activities</p></div>';
        return;
      }

      container.innerHTML = items.slice(0, 5).map(templateFn).join('');
    })
    .catch(() => {});
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatCurrency(amount) {
  return 'NGN ' + (parseFloat(amount) || 0).toLocaleString();
}

function truncate(str, len = 30) {
  return str && str.length > len ? str.substring(0, len) + '...' : str || 'N/A';
}

function getStatusBadge(status) {
  const badges = {
    'vacant': 'bg-green-100 text-green-800',
    'occupied': 'bg-blue-100 text-blue-800',
    'maintenance': 'bg-yellow-100 text-yellow-800',
    'active': 'bg-green-100 text-green-800',
    'expired': 'bg-red-100 text-red-800',
    'terminated': 'bg-gray-100 text-gray-800',
    'paid': 'bg-green-100 text-green-800',
    'pending': 'bg-yellow-100 text-yellow-800',
    'overdue': 'bg-red-100 text-red-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800',
    'low': 'bg-green-100 text-green-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'high': 'bg-red-100 text-red-800'
  };

  const color = badges[status] || 'bg-gray-100 text-gray-800';
  return `<span class="px-2 py-1 text-xs font-medium rounded-full ${color}">${escapeHtml(status)}</span>`;
}

function emptyState(container, message = 'No data available', icon = 'fa-inbox') {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.innerHTML = `
    <div class="text-center py-12">
      <i class="fas ${icon} text-5xl text-gray-300 mb-4"></i>
      <p class="text-gray-500 text-lg">${escapeHtml(message)}</p>
    </div>
  `;
}

function loadingState(container) {
  if (!container) return;
  container.innerHTML = `
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      <p class="text-gray-500 mt-2">Loading...</p>
    </div>
  `;
}
