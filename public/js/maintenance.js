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

    tbody.innerHTML = requests.map(r => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm font-medium text-gray-900">${truncate(r.subject, 30)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${r.propertyId?.title || 'N/A'}</td>
        <td class="px-4 py-3 text-sm">${getStatusBadge(r.status)}</td>
        <td class="px-4 py-3 text-sm">${getStatusBadge(r.urgency)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${formatDate(r.requestedDate)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${r.tenantId?.fullName || 'N/A'}</td>
        <td class="px-4 py-3 text-sm">
          <button onclick="viewRequestDetails('${r._id}')" class="text-blue-600 hover:text-blue-800" title="View Details"><i class="fas fa-eye"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Failed to load maintenance requests: ' + error.message, 'error');
  }
}

async function submitMaintenanceRequest(formData) {
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

async function viewRequestDetails(requestId) {
  try {
    const result = await apiGet(`/maintenance/${requestId}`);
    const request = result.data?.request;
    if (!request) return;

    const modal = document.getElementById('requestDetailModal');
    if (!modal) return;

    document.getElementById('detail-subject').textContent = request.subject;
    document.getElementById('detail-description').textContent = request.description;
    document.getElementById('detail-property').textContent = request.propertyId?.title || 'N/A';
    document.getElementById('detail-tenant').textContent = request.tenantId?.fullName || 'N/A';
    document.getElementById('detail-status').innerHTML = getStatusBadge(request.status);
    document.getElementById('detail-urgency').innerHTML = getStatusBadge(request.urgency);
    document.getElementById('detail-date').textContent = formatDate(request.requestedDate);
    document.getElementById('detail-resolved').textContent = request.resolvedDate ? formatDate(request.resolvedDate) : 'Not resolved';
    document.getElementById('detail-notes').textContent = request.resolutionNotes || 'No resolution notes';

    const statusForm = document.getElementById('updateStatusForm');
    if (statusForm) {
      statusForm.dataset.requestId = requestId;
      statusForm.querySelector('[name="status"]').value = request.status;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } catch (error) {
    showToast('Failed to load request details: ' + error.message, 'error');
  }
}

function closeRequestDetail() {
  const modal = document.getElementById('requestDetailModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function submitStatusUpdate(event) {
  event.preventDefault();
  const form = event.target;
  const requestId = form.dataset.requestId;
  const formData = new FormData(form);
  const status = formData.get('status');
  const notes = formData.get('resolutionNotes');

  try {
    await updateRequestStatus(requestId, status, notes);
    closeRequestDetail();
    setTimeout(() => window.location.reload(), 500);
  } catch (e) {}
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
