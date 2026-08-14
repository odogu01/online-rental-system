async function loadPayments(tableBodyId, params = {}) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8"><div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div></td></tr>';

  try {
    const result = await apiGet('/payments', params);
    const payments = result.data?.payments || [];

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No payments found</td></tr>';
      return;
    }

    tbody.innerHTML = payments.map(p => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(p.leaseId?.propertyId?.title || 'N/A')}</td>
        <td class="px-4 py-3 text-sm font-medium text-gray-900">NGN ${(p.amount || 0).toLocaleString()}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml((p.paymentMethod || 'N/A').replace(/_/g, ' '))}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${formatDate(p.paymentDate)}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${formatDate(p.dueDate)}</td>
        <td class="px-4 py-3 text-sm">${getStatusBadge(p.status)}</td>
        <td class="px-4 py-3 text-sm">
          <div class="flex gap-2">
            <button onclick="downloadReceipt('${p._id}')" class="text-blue-600 hover:text-blue-800" title="Download Receipt"><i class="fas fa-download"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Failed to load payments: ' + error.message, 'error');
  }
}

async function downloadReceipt(event, paymentId) {
  if (event && event.preventDefault) event.preventDefault();
  try {
    await downloadFile(`/payments/receipt/${paymentId}`, `receipt-${paymentId}.pdf`);
  } catch (error) {
    showToast('Failed to download receipt: ' + error.message, 'error');
  }
}

async function recordPayment(formData) {
  try {
    const result = await apiPost('/payments', formData);
    showToast('Payment recorded successfully', 'success');
    setTimeout(() => {
      window.location.href = '/landlord/payments.html';
    }, 1000);
    return result;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

async function submitPaymentForm(event) {
  event.preventDefault();
  const form = event.target;
  const formData = Object.fromEntries(new FormData(form));
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Recording...';

  try {
    await recordPayment(formData);
  } catch (e) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Record Payment';
  }
}

async function loadPaymentSummary(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const result = await apiGet('/payments');
    const summary = result.data?.summary;

    if (!summary) return;

    const total = summary.totalAmount || 0;
    const paid = summary.paid || 0;
    const pending = summary.pending || 0;
    const overdue = summary.overdue || 0;

    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg">
          <p class="text-sm text-blue-600 font-medium">Total</p>
          <p class="text-2xl font-bold text-blue-700">NGN ${total.toLocaleString()}</p>
        </div>
        <div class="bg-green-50 p-4 rounded-lg">
          <p class="text-sm text-green-600 font-medium">Paid</p>
          <p class="text-2xl font-bold text-green-700">NGN ${paid.toLocaleString()}</p>
        </div>
        <div class="bg-yellow-50 p-4 rounded-lg">
          <p class="text-sm text-yellow-600 font-medium">Pending</p>
          <p class="text-2xl font-bold text-yellow-700">NGN ${pending.toLocaleString()}</p>
        </div>
        <div class="bg-red-50 p-4 rounded-lg">
          <p class="text-sm text-red-600 font-medium">Overdue</p>
          <p class="text-2xl font-bold text-red-700">NGN ${overdue.toLocaleString()}</p>
        </div>
      </div>
    `;
  } catch (error) {
    showToast('Failed to load payment summary', 'error');
  }
}
