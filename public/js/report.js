let _currentReport = { endpoint: '', title: '' };

/**
 * Select a report for in-page viewing. Used by the report cards.
 * @param {string} endpoint - e.g. '/reports/rent-collection'
 * @param {string} title
 */
function selectReport(endpoint, title) {
  _currentReport = { endpoint, title };
  const titleEl = document.getElementById('reportTitle');
  if (titleEl) titleEl.textContent = title;
  const containerId = document.getElementById('reportView') ? 'reportView' : null;
  if (containerId) viewReportInPage(endpoint, readReportParams(), containerId);
}

function readReportParams() {
  const params = {};
  const start = document.getElementById('startDate');
  const end = document.getElementById('endDate');
  if (start && start.value) params.startDate = start.value;
  if (end && end.value) params.endDate = end.value;
  return params;
}

/**
 * Download a report in the requested format (pdf | csv | json).
 */
async function generateReport(endpoint, params) {
  const format = params.format || 'json';
  const queryString = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;

  if (format === 'pdf' || format === 'csv') {
    await downloadFile(url, `report-${Date.now()}.${format}`);
    showToast(`${format.toUpperCase()} report downloaded`, 'success');
    return;
  }

  // JSON: fetch and render in the page
  return apiGet(endpoint, params);
}

/**
 * Render a JSON report into a container.
 */
async function viewReportInPage(endpoint, params, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="text-center text-gray-400 py-8"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';

  try {
    const result = await generateReport(endpoint, { ...params, format: 'json' });
    const data = result && result.data;
    if (!data) {
      emptyState(container, 'No data for this report');
      return;
    }

    if (endpoint.includes('rent')) {
      renderRentReport(container, data);
    } else if (endpoint.includes('vacancy')) {
      renderVacancyReport(container, data);
    } else if (endpoint.includes('maintenance')) {
      renderMaintenanceReport(container, data);
    } else if (endpoint.includes('arrears')) {
      renderArrearsReport(container, data);
    } else {
      container.innerHTML = '<p class="text-gray-500">Report type not recognized.</p>';
    }
  } catch (error) {
    emptyState(container, 'Error loading report');
  }
}

function renderRentReport(container, data) {
  const summary = data.summary || {};
  const payments = data.payments || [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg"><p class="text-sm text-blue-600">Total Collected</p><p class="text-xl font-bold text-blue-700">NGN ${(summary.totalCollected || 0).toLocaleString()}</p></div>
        <div class="bg-yellow-50 p-4 rounded-lg"><p class="text-sm text-yellow-600">Pending</p><p class="text-xl font-bold text-yellow-700">NGN ${(summary.pendingAmount || 0).toLocaleString()}</p></div>
        <div class="bg-red-50 p-4 rounded-lg"><p class="text-sm text-red-600">Overdue</p><p class="text-xl font-bold text-red-700">NGN ${(summary.overdueAmount || 0).toLocaleString()}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Collection Rate</p><p class="text-xl font-bold text-green-700">${escapeHtml(summary.collectionRate || 0)}%</p></div>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Reference</th><th>Property</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${payments.map(p => `
            <tr>
              <td>${escapeHtml(p.paymentReference || 'N/A')}</td>
              <td>${escapeHtml(p.leaseId?.propertyId?.title || 'N/A')}</td>
              <td>NGN ${(p.amount || 0).toLocaleString()}</td>
              <td>${getStatusBadge(p.status)}</td>
              <td>${formatDate(p.paymentDate)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderVacancyReport(container, data) {
  const summary = data.summary || {};
  const vacantProperties = data.vacantProperties || [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg"><p class="text-sm text-blue-600">Total</p><p class="text-xl font-bold text-blue-700">${escapeHtml(summary.totalProperties || 0)}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Occupied</p><p class="text-xl font-bold text-green-700">${escapeHtml(summary.occupied || 0)}</p></div>
        <div class="bg-red-50 p-4 rounded-lg"><p class="text-sm text-red-600">Vacant</p><p class="text-xl font-bold text-red-700">${escapeHtml(summary.vacant || 0)}</p></div>
        <div class="bg-yellow-50 p-4 rounded-lg"><p class="text-sm text-yellow-600">Vacancy Rate</p><p class="text-xl font-bold text-yellow-700">${escapeHtml(summary.vacancyRate || 0)}%</p></div>
      </div>
      ${vacantProperties.length > 0 ? `
        <div>
          <h4 class="font-semibold text-red-700 mb-2">Vacant Properties (${vacantProperties.length})</h4>
          <div class="overflow-x-auto">
            <table class="table">
              <thead><tr><th>Title</th><th>Location</th><th>Rent</th></tr></thead>
              <tbody>${vacantProperties.map(p => `
                <tr>
                  <td>${escapeHtml(p.title)}</td>
                  <td>${escapeHtml(p.location)}</td>
                  <td>NGN ${(p.rentAmount || 0).toLocaleString()}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
    </div>
  `;
}

function renderMaintenanceReport(container, data) {
  const summary = data.summary || {};
  const requests = data.requests || [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg"><p class="text-sm text-blue-600">Total</p><p class="text-xl font-bold text-blue-700">${escapeHtml(summary.totalRequests || 0)}</p></div>
        <div class="bg-yellow-50 p-4 rounded-lg"><p class="text-sm text-yellow-600">Pending</p><p class="text-xl font-bold text-yellow-700">${escapeHtml(summary.pending || 0)}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Completed</p><p class="text-xl font-bold text-green-700">${escapeHtml(summary.completed || 0)}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Completion</p><p class="text-xl font-bold text-green-700">${escapeHtml(summary.completionRate || 0)}%</p></div>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Subject</th><th>Property</th><th>Status</th><th>Urgency</th><th>Date</th></tr></thead>
          <tbody>${requests.map(r => `
            <tr>
              <td>${escapeHtml(r.subject)}</td>
              <td>${escapeHtml(r.propertyId?.title || 'N/A')}</td>
              <td>${getStatusBadge(r.status)}</td>
              <td>${getStatusBadge(r.urgency)}</td>
              <td>${formatDate(r.requestedDate)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderArrearsReport(container, data) {
  const arrears = data.arrears || [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-red-50 p-4 rounded-lg">
        <p class="text-sm text-red-600">Total Outstanding Arrears</p>
        <p class="text-2xl font-bold text-red-700">NGN ${(data.totalArrears || 0).toLocaleString()}</p>
        <p class="text-sm text-red-500">${escapeHtml(data.arrearsCount || 0)} overdue payment(s)</p>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Reference</th><th>Property</th><th>Amount</th><th>Due Date</th></tr></thead>
          <tbody>${arrears.map(a => `
            <tr>
              <td>${escapeHtml(a.paymentReference)}</td>
              <td>${escapeHtml(a.leaseId?.propertyId?.title || 'N/A')}</td>
              <td>NGN ${(a.amount || 0).toLocaleString()}</td>
              <td>${formatDate(a.dueDate)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}