/* ==========================================================================
   ui.js — Shared UI helpers for the Online Rental System
   (toasts, modals, form errors, XSS escaping)
   Load AFTER api.js on every page that uses these helpers.
   ========================================================================== */

/**
 * HTML-escape a value before injecting it into innerHTML (XSS protection).
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Show a toast notification in the top-right corner.
 * @param {string} message - toast text
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 */
function showToast(message, type) {
  type = type || 'success';
  const container = document.querySelector('.toast-container') || (() => {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i><span>' + escapeHtml(message) + '</span><button class="toast-close">&times;</button>';
  toast.querySelector('.toast-close').onclick = () => toast.remove();
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 4000);
}

/**
 * Show an error message inside a form's error container.
 * Accepts a string, an Error, or an object with a .message property.
 * @param {string} elementId - id of the .error-message container
 * @param {string|Error|object} error
 */
function showFormError(elementId, error) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const message = (error && typeof error === 'object' && error.message) ? error.message : String(error || 'Something went wrong');
  el.textContent = message;
  el.classList.remove('hidden');
}

/** Hide a form error container. */
function clearFormError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add('hidden');
}

/**
 * Open a modal by element id (element should have class "modal" or "modal-overlay").
 */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }
}

/**
 * Close a modal by element id.
 */
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  if (!document.querySelector('.modal:not(.hidden), .modal-overlay:not(.hidden)')) {
    document.body.classList.remove('modal-open');
  }
}

// Close modals when clicking the backdrop (outside the .modal-content).
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal')) {
    closeModal(e.target.id);
  }
});

// Close modals with the Escape key.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden), .modal-overlay:not(.hidden)').forEach((m) => closeModal(m.id));
  }
});

/* ══════════════════════════════════════════════════════════════
   CONTACT LANDLORD MODAL (shared by public + tenant property pages)
   Builds a hidden modal on first use, prefills name/email when the
   visitor is logged in, and POSTs to /api/inquiries on submit.
   ══════════════════════════════════════════════════════════════ */

function ensureContactModal() {
  let modal = document.getElementById('contactModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'contactModal';
  modal.className = 'modal hidden';
  modal.innerHTML =
    '<div class="modal-content p-6" style="max-width:520px">' +
      '<div class="flex justify-between items-center mb-4">' +
        '<h3 class="text-lg font-semibold">Contact Landlord</h3>' +
        '<button type="button" onclick="closeModal(\'contactModal\')" class="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>' +
      '</div>' +
      '<p id="contactPropertyInfo" class="text-sm text-gray-500 mb-3"></p>' +
      '<div id="contactFormMessage" class="error-message hidden"></div>' +
      '<form id="contactForm" onsubmit="submitContactForm(event)">' +
        '<div class="mb-3"><label class="label" for="contactName">Your Name</label>' +
        '<input class="input" type="text" id="contactName" name="name" required minlength="2" maxlength="100"></div>' +
        '<div class="mb-3"><label class="label" for="contactEmail">Your Email</label>' +
        '<input class="input" type="email" id="contactEmail" name="email" required></div>' +
        '<div class="mb-3"><label class="label" for="contactPhone">Phone (optional)</label>' +
        '<input class="input" type="tel" id="contactPhone" name="phone"></div>' +
        '<div class="mb-3"><label class="label" for="contactMessage">Message</label>' +
        '<textarea class="input" id="contactMessage" name="message" rows="4" required maxlength="2000" placeholder="I am interested in renting this property..."></textarea></div>' +
        '<div class="flex justify-end gap-3 mt-4">' +
          '<button type="button" class="btn btn-secondary" onclick="closeModal(\'contactModal\')">Cancel</button>' +
          '<button type="submit" class="btn btn-primary" id="contactSubmitBtn"><i class="fas fa-paper-plane mr-1"></i>Send Inquiry</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  document.body.appendChild(modal);
  return modal;
}

/**
 * Open the Contact Landlord modal for a given property.
 * Pre-fills name/email from the logged-in user when available.
 * @param {string} propertyId
 * @param {string} [propertyTitle] - optional title shown above the form
 */
function contactLandlord(propertyId, propertyTitle) {
  ensureContactModal();
  window._contactPropertyId = propertyId;

  const info = document.getElementById('contactPropertyInfo');
  info.textContent = propertyTitle ? 'Regarding: ' + propertyTitle : '';

  // Pre-fill from the logged-in user, if any.
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { /* not logged in */ }
  if (user) {
    document.getElementById('contactName').value = user.fullName || '';
    document.getElementById('contactEmail').value = user.email || '';
  }

  document.getElementById('contactForm').reset();
  if (user) {
    document.getElementById('contactName').value = user.fullName || '';
    document.getElementById('contactEmail').value = user.email || '';
  }
  document.getElementById('contactFormMessage').classList.add('hidden');
  openModal('contactModal');
}

/**
 * Submit the contact form (bound to the modal form's onsubmit).
 */
async function submitContactForm(event) {
  event.preventDefault();
  const propertyId = window._contactPropertyId;
  if (!propertyId) { showFormError('contactFormMessage', 'Missing property reference. Please try again.'); return; }

  const btn = document.getElementById('contactSubmitBtn');
  const payload = {
    propertyId: propertyId,
    name: document.getElementById('contactName').value.trim(),
    email: document.getElementById('contactEmail').value.trim(),
    phone: document.getElementById('contactPhone').value.trim() || undefined,
    message: document.getElementById('contactMessage').value.trim()
  };

  if (!payload.name || !payload.email || !payload.message) {
    showFormError('contactFormMessage', 'Please fill in your name, email and message.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Sending...';
  document.getElementById('contactFormMessage').classList.add('hidden');

  try {
    const result = await authenticatedFetch('/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showToast(result.message || 'Your inquiry has been sent to the landlord.', 'success');
    document.getElementById('contactForm').reset();
    closeModal('contactModal');
  } catch (error) {
    showFormError('contactFormMessage', error.message || 'Failed to send your inquiry. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>Send Inquiry';
  }
}