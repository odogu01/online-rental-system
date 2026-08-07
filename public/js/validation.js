const ValidationRules = {
  required: (value, fieldName) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${fieldName || 'This field'} is required`;
    }
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const re = /^\S+@\S+\.\S+$/;
    return re.test(value) ? null : 'Please enter a valid email address';
  },

  password: (value) => {
    if (!value) return null;
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])/.test(value)) return 'Password must contain a lowercase letter';
    if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain an uppercase letter';
    if (!/(?=.*\d)/.test(value)) return 'Password must contain a number';
    return null;
  },

  minLength: (min) => (value, fieldName) => {
    if (!value) return null;
    return value.length >= min ? null : `${fieldName || 'This field'} must be at least ${min} characters`;
  },

  maxLength: (max) => (value, fieldName) => {
    if (!value) return null;
    return value.length <= max ? null : `${fieldName || 'This field'} must not exceed ${max} characters`;
  },

  numeric: (value, fieldName) => {
    if (!value) return null;
    return /^\d+(\.\d+)?$/.test(value) ? null : `${fieldName || 'This field'} must be a number`;
  },

  integer: (value, fieldName) => {
    if (!value) return null;
    return /^\d+$/.test(value) ? null : `${fieldName || 'This field'} must be a whole number`;
  },

  min: (min) => (value, fieldName) => {
    if (!value) return null;
    return parseFloat(value) >= min ? null : `${fieldName || 'This field'} must be at least ${min}`;
  },

  max: (max) => (value, fieldName) => {
    if (!value) return null;
    return parseFloat(value) <= max ? null : `${fieldName || 'This field'} must not exceed ${max}`;
  },

  phone: (value) => {
    if (!value) return null;
    return /^\+?[\d\s\-()]{7,20}$/.test(value) ? null : 'Please enter a valid phone number';
  },

  url: (value) => {
    if (!value) return null;
    try { new URL(value); return null; }
    catch { return 'Please enter a valid URL'; }
  },

  oneOf: (options) => (value) => {
    if (!value) return null;
    return options.includes(value) ? null : `Must be one of: ${options.join(', ')}`;
  },

  matchField: (matchValue, fieldName) => (value) => {
    return value === matchValue ? null : `Must match ${fieldName}`;
  },

  date: (value) => {
    if (!value) return null;
    const d = new Date(value);
    return !isNaN(d.getTime()) ? null : 'Please enter a valid date';
  },

  futureDate: (value) => {
    if (!value) return null;
    const d = new Date(value);
    return d > new Date() ? null : 'Date must be in the future';
  },

  dateBefore: (otherDate) => (value) => {
    if (!value || !otherDate) return null;
    return new Date(value) < new Date(otherDate) ? null : 'Start date must be before end date';
  }
};

function validateField(input, rules) {
  const value = input.value;
  const fieldName = input.dataset.label || input.placeholder || input.name || 'Field';
  const errorEl = input.parentElement.querySelector('.error-message') ||
                  input.closest('.form-group')?.querySelector('.error-message');

  for (const rule of rules) {
    const error = typeof rule === 'function' ? rule(value, fieldName) : null;
    if (error) {
      showFieldError(input, error, errorEl);
      return false;
    }
  }

  clearFieldError(input, errorEl);
  return true;
}

function validateForm(form, validationMap) {
  let isValid = true;
  const firstError = [];

  for (const [selector, rules] of Object.entries(validationMap)) {
    const input = form.querySelector(selector);
    if (!input) continue;

    const valid = validateField(input, rules);
    if (!valid) {
      isValid = false;
      if (firstError.length === 0) firstError.push(input);
    }
  }

  if (!isValid && firstError.length > 0) {
    firstError[0].focus();
    showToast('Please fix the errors highlighted in the form', 'error');
  }

  return isValid;
}

function showFieldError(input, message, errorEl) {
  input.classList.add('input-error');
  input.classList.remove('input-success');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    errorEl.classList.add('visible');
  } else {
    const div = document.createElement('p');
    div.className = 'error-message visible text-xs mt-1';
    div.textContent = message;
    input.parentElement.appendChild(div);
  }
}

function clearFieldError(input, errorEl) {
  input.classList.remove('input-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
    errorEl.classList.remove('visible');
  } else {
    const existing = input.parentElement.querySelector('.error-message');
    if (existing) existing.remove();
  }
}

function addRealTimeValidation(input, rules) {
  input.addEventListener('blur', () => validateField(input, rules));
  input.addEventListener('input', () => {
    if (input.classList.contains('border-red-500')) {
      validateField(input, rules);
    }
  });
}

function initFormValidation(formId, validationMap) {
  const form = document.getElementById(formId);
  if (!form) return;

  for (const [selector, rules] of Object.entries(validationMap)) {
    const input = form.querySelector(selector);
    if (input) addRealTimeValidation(input, rules);
  }

  return form;
}
