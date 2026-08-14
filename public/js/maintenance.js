async function loadMaintenanceRequests(tableBodyId, params = {}) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8"><div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div></td></tr>';

  try {
    const result = await apiGet('/maintenance', params);
    const requests = result.data?.requests || [];

    if (requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No maintenance requests found</td></tr>';
      return;
    }

    tbody.innerHTML = requests.map(r => {
      const detailContainer = window._maintenanceDetailContent || 'detailContent';
      return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm font-medium text-gray-900">${escapeHtml(truncate(r.subject, 30))}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(r.propertyId?.title || 'N/A')}</td>
        <td class="px-4 py-3 text-sm">${getStatusBadge(r.status)}</td>
        <td class="px-4 py-3 text-sm">${getStatusBadge(r.urgency)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${formatDate(r.requestedDate)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(r.tenantId?.fullName || 'N/A')}</td>
        <td class="px-4 py-3 text-sm">
          <div class="flex gap-2">
            <button onclick="viewRequestDetails('${r._id}', '${detailContainer}')" class="text-blue-600 hover:text-blue-800" title="View Details"><i class="fas fa-eye"></i></button>
            ${typeof window.openStatusModal === 'function' ? `<button onclick="openStatusModal('${r._id}')" class="text-yellow-600 hover:text-yellow-800" title="Update Status"><i class="fas fa-edit"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (error) {
    showToast('Failed to load maintenance requests: ' + error.message, 'error');
  }
}

async function submitMaintenanceRequest(formData) {
  // Accept either a plain data object or a submit Event (read fields from the form)
  if (formData && typeof formData.preventDefault === 'function') {
    const form = formData.target || document.getElementById('maintForm');
    formData = Object.fromEntries(new FormData(form));
  }
  try {
    const result = await apiPost('/maintenance', formData);
    showToast('Maintenance request submitted successfully', 'success');
    setTimeout(() => {
      const role = getUser()?.role;
      window.location.href = role === 'tenant' ? '/tenant/maintenance.html' : '/landlord/maintenance.html';
    }, 1000);
    return result;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

async function updateRequestStatus(requestId, status, resolutionNotes = '') {
  try {
    const body = { status };
    if (resolutionNotes) body.resolutionNotes = resolutionNotes;
    const result = await apiPut(`/maintenance/${requestId}/status`, body);
    showToast(`Request status updated to ${status}`, 'success');
    return result;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

async function submitMaintenanceForm(event) {
  event.preventDefault();
  const form = event.target;
  const formData = Object.fromEntries(new FormData(form));
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Submitting...';

  try {
    await submitMaintenanceRequest(formData);
  } catch (e) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Request';
  }
}

async function viewRequestDetails(requestId, contentContainerId) {
  try {
    const result = await apiGet(`/maintenance/${requestId}`);
    const request = result.data?.request;
    if (!request) return;

    window.currentRequestId = requestId;

    const container = contentContainerId ? document.getElementById(contentContainerId) : null;
    if (!container) {
      showToast('Details container not found', 'error');
      return;
    }

    const isLandlordOrAdmin = (getUser()?.role === 'landlord' || getUser()?.role === 'admin');
    const updateButton = isLandlordOrAdmin
      ? `<button onclick="openStatusModal('${requestId}')" class="btn btn-primary btn-sm mt-3"><i class="fas fa-edit mr-1"></i>Update Status</button>`
      : '';

    container.innerHTML = `
      <div class="space-y-3 text-sm">
        <div><span class="font-semibold text-gray-700">Subject:</span> ${escapeHtml(request.subject)}</div>
        <div><span class="font-semibold text-gray-700">Property:</span> ${escapeHtml(request.propertyId?.title || 'N/A')}</div>
        <div><span class="font-semibold text-gray-700">Status:</span> ${getStatusBadge(request.status)}</div>
        <div><span class="font-semibold text-gray-700">Urgency:</span> ${getStatusBadge(request.urgency)}</div>
        <div><span class="font-semibold text-gray-700">Requested:</span> ${formatDate(request.requestedDate)}</div>
        <div><span class="font-semibold text-gray-700">Resolved:</span> ${request.resolvedDate ? formatDate(request.resolvedDate) : 'Not resolved'}</div>
        <div><span class="font-semibold text-gray-700">Tenant:</span> ${escapeHtml(request.tenantId?.fullName || 'N/A')}</div>
        <div class="pt-2 border-t border-gray-100"><span class="font-semibold text-gray-700">Description:</span><p class="mt-1 text-gray-600 whitespace-pre-wrap">${escapeHtml(request.description)}</p></div>
        ${request.resolutionNotes ? `<div class="pt-2 border-t border-gray-100"><span class="font-semibold text-gray-700">Resolution Notes:</span><p class="mt-1 text-gray-600 whitespace-pre-wrap">${escapeHtml(request.resolutionNotes)}</p></div>` : ''}
        ${updateButton}
      </div>
    `;

    openModal(requestId ? getModalIdFromContent(container) : '');
  } catch (error) {
    showToast('Failed to load request details: ' + error.message, 'error');
  }
}

function getModalIdFromContent(container) {
  // The content container lives inside a modal — find the closest element with class "modal".
  let el = container;
  while (el && !(el.classList && el.classList.contains('modal'))) {
    el = el.parentElement;
  }
  return el ? el.id : '';
}

/**
 * Update a maintenance request's status (used by landlord status modal).
 * @param {string} requestId
 * @param {string} status - 'in-progress' | 'completed' | 'rejected' | 'pending'
 * @param {string} notes - optional resolution notes
 */
async function setMaintenanceStatus(requestId, status, notes) {
  try {
    const body = { status };
    if (notes && notes.trim()) body.resolutionNotes = notes.trim();
    await apiPut(`/maintenance/${requestId}/status`, body);
    showToast(`Request status updated to ${status}`, 'success');
    closeModal('statusModal');
    // Reload the list if it exists on the page
    const container = document.querySelector('tbody[id$="Container"]') || document.getElementById('requestsContainer');
    if (container) loadMaintenanceRequests(container.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadMaintenanceStats(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const result = await apiGet('/maintenance/statistics');
    const stats = result.data?.summary;
    if (!stats) return;

    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="bg-gray-50 p-3 rounded-lg text-center">
          <p class="text-2xl font-bold text-gray-700">${stats.total}</p>
          <p class="text-xs text-gray-500">Total</p>
        </div>
        <div class="bg-yellow-50 p-3 rounded-lg text-center">
          <p class="text-2xl font-bold text-yellow-700">${stats.pending}</p>
          <p class="text-xs text-yellow-600">Pending</p>
        </div>
        <div class="bg-blue-50 p-3 rounded-lg text-center">
          <p class="text-2xl font-bold text-blue-700">${stats.inProgress}</p>
          <p class="text-xs text-blue-600">In Progress</p>
        </div>
        <div class="bg-green-50 p-3 rounded-lg text-center">
          <p class="text-2xl font-bold text-green-700">${stats.completed}</p>
          <p class="text-xs text-green-600">Completed</p>
        </div>
        <div class="bg-red-50 p-3 rounded-lg text-center">
          <p class="text-2xl font-bold text-red-700">${stats.highUrgency}</p>
          <p class="text-xs text-red-600">High Urgency</p>
        </div>
      </div>
    `;
  } catch (error) {
    showToast('Failed to load statistics', 'error');
  }
}
