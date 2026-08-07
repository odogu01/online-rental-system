async function generateReport(endpoint, params) {
  const format = params.format || 'json';

  try {
    if (format === 'pdf' || format === 'csv') {
      const queryString = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      await downloadFile(`${endpoint}?${queryString}`, `report-${Date.now()}.${format}`);
      showToast(`${format.toUpperCase()} report downloaded`, 'success');
    } else {
      const result = await apiGet(endpoint, params);
      return result;
    }
  } catch (error) {
    showToast('Failed to generate report: ' + error.message, 'error');
  }
}

async function viewReportInPage(endpoint, params, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  loadingState(container);

  try {
    const result = await generateReport(endpoint, { ...params, format: 'json' });
    if (!result) return;

    const data = result.data;
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
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Collection Rate</p><p class="text-xl font-bold text-green-700">${summary.collectionRate || 0}%</p></div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="bg-gray-100">
            <th class="px-3 py-2 text-left">Reference</th><th class="px-3 py-2 text-left">Property</th>
            <th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2 text-center">Status</th>
            <th class="px-3 py-2 text-right">Date</th>
          </tr></thead>
          <tbody>${payments.map(p => `
            <tr class="border-b hover:bg-gray-50">
              <td class="px-3 py-2">${p.paymentReference || 'N/A'}</td>
              <td class="px-3 py-2">${p.leaseId?.propertyId?.title || 'N/A'}</td>
              <td class="px-3 py-2 text-right font-medium">NGN ${(p.amount || 0).toLocaleString()}</td>
              <td class="px-3 py-2 text-center">${getStatusBadge(p.status)}</td>
              <td class="px-3 py-2 text-right">${formatDate(p.paymentDate)}</td>
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
  const occupiedProperties = data.occupiedProperties || [];

  container.innerHTML = `
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg"><p class="text-sm text-blue-600">Total</p><p class="text-xl font-bold text-blue-700">${summary.totalProperties || 0}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Occupied</p><p class="text-xl font-bold text-green-700">${summary.occupied || 0}</p></div>
        <div class="bg-red-50 p-4 rounded-lg"><p class="text-sm text-red-600">Vacant</p><p class="text-xl font-bold text-red-700">${summary.vacant || 0}</p></div>
        <div class="bg-yellow-50 p-4 rounded-lg"><p class="text-sm text-yellow-600">Vacancy Rate</p><p class="text-xl font-bold text-yellow-700">${summary.vacancyRate || 0}%</p></div>
      </div>
      ${vacantProperties.length > 0 ? `
        <div>
          <h4 class="font-semibold text-red-700 mb-2">Vacant Properties (${vacantProperties.length})</h4>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="bg-red-50">
                <th class="px-3 py-2 text-left">Title</th><th class="px-3 py-2 text-left">Location</th>
                <th class="px-3 py-2 text-right">Rent</th>
              </tr></thead>
              <tbody>${vacantProperties.map(p => `
                <tr class="border-b hover:bg-red-50">
                  <td class="px-3 py-2 font-medium">${p.title}</td>
                  <td class="px-3 py-2">${p.location}</td>
                  <td class="px-3 py-2 text-right">NGN ${(p.rentAmount || 0).toLocaleString()}</td>
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
        <div class="bg-blue-50 p-4 rounded-lg"><p class="text-sm text-blue-600">Total</p><p class="text-xl font-bold text-blue-700">${summary.totalRequests || 0}</p></div>
        <div class="bg-yellow-50 p-4 rounded-lg"><p class="text-sm text-yellow-600">Pending</p><p class="text-xl font-bold text-yellow-700">${summary.pending || 0}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Completed</p><p class="text-xl font-bold text-green-700">${summary.completed || 0}</p></div>
        <div class="bg-green-50 p-4 rounded-lg"><p class="text-sm text-green-600">Completion</p><p class="text-xl font-bold text-green-700">${summary.completionRate || 0}%</p></div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="bg-gray-100">
            <th class="px-3 py-2 text-left">Subject</th><th class="px-3 py-2 text-left">Property</th>
            <th class="px-3 py-2 text-center">Status</th><th class="px-3 py-2 text-center">Urgency</th>
            <th class="px-3 py-2 text-right">Date</th>
          </tr></thead>
          <tbody>${requests.map(r => `
            <tr class="border-b hover:bg-gray-50">
              <td class="px-3 py-2 font-medium">${r.subject}</td>
              <td class="px-3 py-2">${r.propertyId?.title || 'N/A'}</td>
              <td class="px-3 py-2 text-center">${getStatusBadge(r.status)}</td>
              <td class="px-3 py-2 text-center">${getStatusBadge(r.urgency)}</td>
              <td class="px-3 py-2 text-right">${formatDate(r.requestedDate)}</td>
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
        <p class="text-sm text-red-500">${data.arrearsCount || 0} overdue payment(s)</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="bg-red-50">
            <th class="px-3 py-2 text-left">Reference</th><th class="px-3 py-2 text-left">Property</th>
            <th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2 text-right">Due Date</th>
          </tr></thead>
          <tbody>${arrears.map(a => `
            <tr class="border-b hover:bg-red-50">
              <td class="px-3 py-2 font-medium">${a.paymentReference}</td>
              <td class="px-3 py-2">${a.leaseId?.propertyId?.title || 'N/A'}</td>
              <td class="px-3 py-2 text-right font-medium text-red-600">NGN ${(a.amount || 0).toLocaleString()}</td>
              <td class="px-3 py-2 text-right">${formatDate(a.dueDate)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function initReportForm(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const params = Object.fromEntries(formData.entries());

    const viewContainer = document.getElementById('reportView');
    if (viewContainer) {
      await viewReportInPage(endpoint, params, 'reportView');
    }
  });
}
