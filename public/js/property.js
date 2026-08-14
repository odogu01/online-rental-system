async function loadProperties(containerId, endpoint = '/properties', params = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  loadingState(container);

  try {
    const result = await apiGet(endpoint, params);
    const properties = result.data?.properties || [];

    if (properties.length === 0) {
      emptyState(container, 'No properties found');
      return;
    }

    container.innerHTML = properties.map(property => `
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div class="h-40 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
          <i class="fas fa-building text-4xl text-white opacity-75"></i>
        </div>
        <div class="p-4">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-semibold text-gray-900">${escapeHtml(property.title)}</h3>
            ${getStatusBadge(property.status)}
          </div>
          <p class="text-sm text-gray-500 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${escapeHtml(property.location || 'N/A')}</p>
          <p class="text-sm text-gray-500 mb-2">${escapeHtml(property.bedrooms)} bed · ${escapeHtml(property.bathrooms)} bath</p>
          <p class="text-lg font-bold text-blue-600">NGN ${(property.rentAmount || 0).toLocaleString()}</p>
          <div class="mt-3 flex gap-2">
            <a href="/landlord/property-edit.html?id=${property._id}" class="text-sm text-blue-600 hover:underline"><i class="fas fa-edit mr-1"></i>Edit</a>
            <button onclick="deleteProperty('${property._id}')" class="text-sm text-red-600 hover:underline"><i class="fas fa-trash mr-1"></i>Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    showToast('Failed to load properties: ' + error.message, 'error');
    emptyState(container, 'Error loading properties', 'fa-exclamation-circle');
  }
}

async function loadPropertiesTable(tableBodyId, endpoint = '/properties', params = {}) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8"><div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div></td></tr>';

  try {
    const result = await apiGet(endpoint, params);
    const properties = result.data?.properties || [];

    if (properties.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-gray-500">No properties found</td></tr>';
      return;
    }

    tbody.innerHTML = properties.map((p, i) => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 text-sm text-gray-900">${i + 1}</td>
        <td class="px-4 py-3 text-sm font-medium text-gray-900">${escapeHtml(truncate(p.title, 25))}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(p.location || 'N/A')}</td>
        <td class="px-4 py-3 text-sm">${getStatusBadge(p.status)}</td>
        <td class="px-4 py-3 text-sm text-gray-900">${escapeHtml(p.bedrooms)} / ${escapeHtml(p.bathrooms)}</td>
        <td class="px-4 py-3 text-sm font-medium text-gray-900">NGN ${(p.rentAmount || 0).toLocaleString()}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${formatDate(p.createdAt)}</td>
        <td class="px-4 py-3 text-sm">
          <div class="flex gap-2">
            <a href="/landlord/property-edit.html?id=${p._id}" class="text-blue-600 hover:text-blue-800" title="Edit"><i class="fas fa-edit"></i></a>
            <button onclick="deleteProperty('${p._id}')" class="text-red-600 hover:text-red-800" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Failed to load properties: ' + error.message, 'error');
  }
}

async function loadSingleProperty(propertyId, formId) {
  try {
    const result = await apiGet(`/properties/${propertyId}`);
    const property = result.data?.property;
    if (!property) {
      showToast('Property not found', 'error');
      return;
    }

    const form = document.getElementById(formId);
    if (!form) return;

    form.querySelector('[name="title"]').value = property.title || '';
    form.querySelector('[name="location"]').value = property.location || '';
    form.querySelector('[name="description"]').value = property.description || '';
    form.querySelector('[name="rentAmount"]').value = property.rentAmount || '';
    form.querySelector('[name="bedrooms"]').value = property.bedrooms || 0;
    form.querySelector('[name="bathrooms"]').value = property.bathrooms || 0;
    form.querySelector('[name="amenities"]').value = property.amenities || '';
    form.querySelector('[name="status"]').value = property.status || 'vacant';
  } catch (error) {
    showToast('Failed to load property: ' + error.message, 'error');
  }
}

async function saveProperty(event, propertyId) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const isEdit = !!propertyId;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
  }

  try {
    const formData = {
      title: form.querySelector('[name="title"]')?.value,
      location: form.querySelector('[name="location"]')?.value,
      description: form.querySelector('[name="description"]')?.value,
      rentAmount: form.querySelector('[name="rentAmount"]')?.value,
      bedrooms: form.querySelector('[name="bedrooms"]')?.value,
      bathrooms: form.querySelector('[name="bathrooms"]')?.value,
      amenities: form.querySelector('[name="amenities"]')?.value,
      status: form.querySelector('[name="status"]')?.value || 'vacant'
    };

    const endpoint = isEdit ? `/properties/${propertyId}` : '/properties';
    const method = isEdit ? apiPut : apiPost;
    const result = await method(endpoint, formData);

    // Optional image upload
    const fileInput = document.getElementById('propertyImage');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const imageForm = new FormData();
      imageForm.append('image', fileInput.files[0]);
      const savedId = isEdit ? propertyId : (result.data?.property?._id || result.data?._id);
      if (savedId) {
        await authenticatedFetch(`/properties/${savedId}/image`, { method: 'POST', body: imageForm });
      }
    }

    showToast(isEdit ? 'Property updated successfully' : 'Property created successfully', 'success');
    setTimeout(() => { window.location.href = '/landlord/properties.html'; }, 1000);
    return result;
  } catch (error) {
    showToast(error.message, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = isEdit ? '<i class="fas fa-save mr-2"></i>Update Property' : '<i class="fas fa-plus mr-2"></i>Add Property';
    }
    throw error;
  }
}

async function deleteProperty(id) {
  if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) return;

  try {
    await apiDelete(`/properties/${id}`);
    showToast('Property deleted successfully', 'success');
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function submitPropertyForm(event) {
  return saveProperty(event, event.target.dataset.propertyId || null);
}

/**
 * Render public property cards with a "Contact Landlord" button.
 * Used by public/properties.html and tenant/properties.html.
 */
async function loadPublicPropertiesGrid(containerId, params = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="text-center text-gray-400 py-10"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';

  try {
    const result = await apiGet('/properties', params);
    const properties = result.data?.properties || [];

    if (properties.length === 0) {
      emptyState(container, 'No properties found');
      return;
    }

    container.innerHTML = properties.map(property => `
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div class="h-40 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
          ${property.images
            ? `<img src="${escapeHtml(property.images)}" alt="${escapeHtml(property.title)}" class="w-full h-full object-cover">`
            : '<i class="fas fa-building text-4xl text-white opacity-75"></i>'}
        </div>
        <div class="p-4">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-semibold text-gray-900">${escapeHtml(property.title)}</h3>
            ${getStatusBadge(property.status)}
          </div>
          <p class="text-sm text-gray-500 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${escapeHtml(property.location || 'N/A')}</p>
          <p class="text-sm text-gray-500 mb-2">${escapeHtml(property.bedrooms)} bed · ${escapeHtml(property.bathrooms)} bath</p>
          ${property.amenities ? `<p class="text-xs text-gray-400 mb-2">${escapeHtml(property.amenities)}</p>` : ''}
          <p class="text-lg font-bold text-blue-600">NGN ${(property.rentAmount || 0).toLocaleString()}<span class="text-sm font-normal text-gray-400">/month</span></p>
          <button onclick="contactLandlord('${property._id}', '${escapeHtml(property.title)}')" class="btn btn-primary btn-sm w-full mt-3">
            <i class="fas fa-envelope mr-1"></i>Contact Landlord
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    showToast('Failed to load properties: ' + error.message, 'error');
    emptyState(container, 'Error loading properties');
  }
}
