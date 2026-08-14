const nodemailer = require('nodemailer');

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

let transporter = null;
let isConnected = false;

const EMAIL_TEMPLATES = {
  base: (content) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1a365d 0%, #2d6a9f 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .body { padding: 30px; color: #333333; line-height: 1.6; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666666; border-top: 1px solid #e9ecef; }
        .button { display: inline-block; padding: 12px 30px; background: #2d6a9f; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .detail { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #2d6a9f; }
        .detail-item { margin: 5px 0; }
        .detail-label { font-weight: bold; color: #555; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; }
        .badge-paid { background: #d4edda; color: #155724; }
        .badge-pending { background: #fff3cd; color: #856404; }
        .badge-urgent { background: #f8d7da; color: #721c24; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏠 Rental Property Management</h1>
        </div>
        <div class="body">
          ${content}
        </div>
        <div class="footer">
          <p>Rental Property Management System &copy; ${new Date().getFullYear()}</p>
          <p>This is an automated message. Please do not reply directly.</p>
          <p><a href="${APP_URL}" style="color: #2d6a9f;">Login to your account</a></p>
        </div>
      </div>
    </body>
    </html>
  `,

  rentReminder: (data) => `
    <h2>Rent Payment Reminder</h2>
    <p>Dear <strong>${escapeHtml(data.tenantName)}</strong>,</p>
    <p>This is a friendly reminder that your rent payment is due soon.</p>
    <div class="detail">
      <div class="detail-item"><span class="detail-label">Property:</span> ${escapeHtml(data.propertyTitle || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Amount Due:</span> <strong>NGN ${formatCurrency(data.amount)}</strong></div>
      <div class="detail-item"><span class="detail-label">Due Date:</span> <strong>${formatDate(data.dueDate)}</strong></div>
      <div class="detail-item"><span class="detail-label">Status:</span> <span class="badge badge-pending">Pending</span></div>
    </div>
    <p>To avoid late fees, please ensure payment is made before the due date.</p>
    <a href="${APP_URL}/payments" class="button">Make Payment</a>
    <p style="color: #666; font-size: 13px; margin-top: 20px;">If you have already made this payment, please disregard this reminder.</p>
  `,

  paymentConfirmation: (data) => `
    <h2>Payment Confirmed</h2>
    <p>Dear <strong>${escapeHtml(data.tenantName)}</strong>,</p>
    <p>Your payment has been successfully recorded.</p>
    <div class="detail">
      <div class="detail-item"><span class="detail-label">Property:</span> ${escapeHtml(data.propertyTitle || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Amount Paid:</span> <strong>NGN ${formatCurrency(data.amount)}</strong></div>
      <div class="detail-item"><span class="detail-label">Payment Date:</span> ${formatDate(data.paymentDate)}</div>
      <div class="detail-item"><span class="detail-label">Reference:</span> ${escapeHtml(data.paymentReference || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Method:</span> ${escapeHtml(formatMethod(data.paymentMethod))}</div>
      <div class="detail-item"><span class="detail-label">Status:</span> <span class="badge badge-paid">Paid</span></div>
    </div>
    <a href="${APP_URL}/payments" class="button">View Payment History</a>
  `,

  maintenanceUpdate: (data) => `
    <h2>Maintenance Request Update</h2>
    <p>Dear <strong>${escapeHtml(data.recipientName)}</strong>,</p>
    <p>Your maintenance request has been updated.</p>
    <div class="detail">
      <div class="detail-item"><span class="detail-label">Subject:</span> ${escapeHtml(data.subject)}</div>
      <div class="detail-item"><span class="detail-label">Property:</span> ${escapeHtml(data.propertyTitle || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Status:</span> <span class="badge badge-${data.status === 'completed' ? 'paid' : 'pending'}">${escapeHtml(formatStatus(data.status))}</span></div>
      <div class="detail-item"><span class="detail-label">Urgency:</span> ${escapeHtml(data.urgency)}</div>
      ${data.resolutionNotes ? `<div class="detail-item"><span class="detail-label">Notes:</span> ${escapeHtml(data.resolutionNotes)}</div>` : ''}
    </div>
    <a href="${APP_URL}/maintenance" class="button">View Details</a>
  `,

  leaseExpiry: (data) => `
    <h2>Lease Expiry Notice</h2>
    <p>Dear <strong>${escapeHtml(data.recipientName)}</strong>,</p>
    <p>This notice is to inform you that your lease agreement is approaching its expiration date.</p>
    <div class="detail">
      <div class="detail-item"><span class="detail-label">Property:</span> ${escapeHtml(data.propertyTitle || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Lease Period:</span> ${formatDate(data.startDate)} - ${formatDate(data.endDate)}</div>
      <div class="detail-item"><span class="detail-label">Monthly Rent:</span> <strong>NGN ${formatCurrency(data.monthlyRent)}</strong></div>
      <div class="detail-item"><span class="detail-label">Expiry Date:</span> <strong>${formatDate(data.endDate)}</strong></div>
    </div>
    <p>Please contact your landlord or property manager to discuss renewal options or move-out arrangements.</p>
    <a href="${APP_URL}/leases" class="button">View Lease Details</a>
  `,

  maintenanceNotification: (data) => `
    <h2>New Maintenance Request</h2>
    <p>Dear <strong>${escapeHtml(data.landlordName)}</strong>,</p>
    <p>A new maintenance request has been submitted by your tenant.</p>
    <div class="detail">
      <div class="detail-item"><span class="detail-label">Subject:</span> ${escapeHtml(data.subject)}</div>
      <div class="detail-item"><span class="detail-label">Property:</span> ${escapeHtml(data.propertyTitle || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Tenant:</span> ${escapeHtml(data.tenantName)}</div>
      <div class="detail-item"><span class="detail-label">Description:</span> ${escapeHtml(data.description)}</div>
      <div class="detail-item"><span class="detail-label">Urgency:</span> <span class="badge badge-${data.urgency === 'high' ? 'urgent' : 'pending'}">${escapeHtml(data.urgency)}</span></div>
    </div>
    <p>Please log in to review and assign the request.</p>
    <a href="${APP_URL}/maintenance" class="button">Review Request</a>
  `,

  propertyInquiry: (data) => `
    <h2>New Property Inquiry</h2>
    <p>Dear <strong>${escapeHtml(data.landlordName)}</strong>,</p>
    <p>Someone is interested in your property listing and has sent you a message.</p>
    <div class="detail">
      <div class="detail-item"><span class="detail-label">Property:</span> ${escapeHtml(data.propertyTitle || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Location:</span> ${escapeHtml(data.propertyLocation || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">From:</span> ${escapeHtml(data.name)}</div>
      <div class="detail-item"><span class="detail-label">Email:</span> ${escapeHtml(data.email)}</div>
      ${data.phone ? `<div class="detail-item"><span class="detail-label">Phone:</span> ${escapeHtml(data.phone)}</div>` : ''}
      <div class="detail-item"><span class="detail-label">Message:</span> ${escapeHtml(data.message)}</div>
    </div>
    <p>Reply to them directly at <a href="mailto:${escapeHtml(data.email)}" style="color:#2d6a9f;">${escapeHtml(data.email)}</a> or open the message in your dashboard.</p>
    <a href="${APP_URL}/landlord/inquiries.html?id=${data.inquiryId}" class="button">View Inquiry</a>
  `,

  inquiryConfirmation: (data) => `
    <h2>Inquiry Sent</h2>
    <p>Dear <strong>${escapeHtml(data.name)}</strong>,</p>
    <p>Thank you for your interest in <strong>${escapeHtml(data.propertyTitle || 'this property')}</strong>.</p>
    <p>Your inquiry has been sent to the landlord. They will contact you shortly at <strong>${escapeHtml(data.email)}</strong>${data.phone ? ' or <strong>' + escapeHtml(data.phone) + '</strong>' : ''}.</p>
    <div class="detail">
      <div class="detail-item"><span class="detail-label">Property:</span> ${escapeHtml(data.propertyTitle || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Location:</span> ${escapeHtml(data.propertyLocation || 'N/A')}</div>
      <div class="detail-item"><span class="detail-label">Your message:</span> ${escapeHtml(data.message)}</div>
    </div>
    <p style="color: #666; font-size: 13px;">You can also keep browsing available properties in the meantime.</p>
    <a href="${APP_URL}/properties.html" class="button">Browse Properties</a>
  `
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('en-NG');
}

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatStatus(status) {
  const map = {
    'pending': 'Pending',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'rejected': 'Rejected',
    'paid': 'Paid',
    'overdue': 'Overdue'
  };
  return map[status] || status;
}

function formatMethod(method) {
  const map = {
    'cash': 'Cash',
    'bank_transfer': 'Bank Transfer',
    'online': 'Online Payment',
    'cheque': 'Cheque'
  };
  return map[method] || method;
}

const initializeTransporter = () => {
  if (transporter) return transporter;

  const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.warn(`Email service: Missing environment variables: ${missing.join(', ')}. Emails will be logged to console.`);
    return null;
  }

  // Don't activate if using placeholder credentials
  if (process.env.EMAIL_USER === 'your_email@gmail.com') {
    console.log('Email service: Placeholder credentials detected — disabled until configured.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: process.env.EMAIL_SECURE === 'true' || parseInt(process.env.EMAIL_PORT, 10) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  const transport = initializeTransporter();

  if (!transport) {
    console.log('\n--- EMAIL (console fallback) ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body preview:', html.substring(0, 200) + '...');
    console.log('--- END EMAIL ---\n');
    return { messageId: `console-${Date.now()}`, accepted: [to] };
  }

  const mailOptions = {
    from: `"Rental Property Management" <${EMAIL_FROM}>`,
    to,
    subject,
    html,
    headers: {
      'X-Mailer': 'RentalPropertyMgmt/1.0',
      'X-Priority': '3'
    }
  };

  let lastError;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Email retry ${attempt}/${maxRetries} for ${to}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      const info = await transport.sendMail(mailOptions);
      console.log(`Email sent successfully to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      lastError = error;
      console.error(`Email send attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
    }
  }

  console.error(`Failed to send email to ${to} after ${maxRetries + 1} attempts:`, lastError.message);
  return { failed: true, error: lastError.message };
};

const sendRentReminder = async (tenantEmail, tenantName, amount, dueDate, propertyTitle) => {
  return sendEmail({
    to: tenantEmail,
    subject: `Rent Reminder: NGN ${formatCurrency(amount)} due ${formatDate(dueDate)}`,
    html: EMAIL_TEMPLATES.base(EMAIL_TEMPLATES.rentReminder({ tenantName, amount, dueDate, propertyTitle }))
  });
};

const sendPaymentConfirmation = async (tenantEmail, paymentDetails) => {
  return sendEmail({
    to: tenantEmail,
    subject: `Payment Confirmed: NGN ${formatCurrency(paymentDetails.amount)}`,
    html: EMAIL_TEMPLATES.base(EMAIL_TEMPLATES.paymentConfirmation({
      tenantName: paymentDetails.tenantName,
      propertyTitle: paymentDetails.propertyTitle,
      amount: paymentDetails.amount,
      paymentDate: paymentDetails.paymentDate,
      paymentReference: paymentDetails.paymentReference,
      paymentMethod: paymentDetails.paymentMethod
    }))
  });
};

const sendMaintenanceUpdate = async (email, recipientName, requestDetails) => {
  return sendEmail({
    to: email,
    subject: `Maintenance Update: ${requestDetails.subject} - ${formatStatus(requestDetails.status)}`,
    html: EMAIL_TEMPLATES.base(EMAIL_TEMPLATES.maintenanceUpdate({
      recipientName,
      subject: requestDetails.subject,
      propertyTitle: requestDetails.propertyTitle,
      status: requestDetails.status,
      urgency: requestDetails.urgency,
      resolutionNotes: requestDetails.resolutionNotes
    }))
  });
};

const sendLeaseExpiryWarning = async (email, recipientName, leaseDetails) => {
  const daysUntilExpiry = Math.ceil(
    (new Date(leaseDetails.endDate) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return sendEmail({
    to: email,
    subject: `Lease Expiring Soon: ${daysUntilExpiry} days remaining`,
    html: EMAIL_TEMPLATES.base(EMAIL_TEMPLATES.leaseExpiry({
      recipientName,
      propertyTitle: leaseDetails.propertyTitle,
      startDate: leaseDetails.startDate,
      endDate: leaseDetails.endDate,
      monthlyRent: leaseDetails.monthlyRent
    }))
  });
};

const sendMaintenanceNotification = async (landlordEmail, requestDetails) => {
  return sendEmail({
    to: landlordEmail,
    subject: `New Maintenance Request: ${requestDetails.subject} (${requestDetails.urgency})`,
    html: EMAIL_TEMPLATES.base(EMAIL_TEMPLATES.maintenanceNotification({
      landlordName: requestDetails.landlordName,
      subject: requestDetails.subject,
      propertyTitle: requestDetails.propertyTitle,
      tenantName: requestDetails.tenantName,
      description: requestDetails.description,
      urgency: requestDetails.urgency
    }))
  });
};

const sendPropertyInquiryToLandlord = async (landlord, property, inquiry) => {
  const landlordEmail = landlord.email || (landlord._id && landlord.email);
  if (!landlordEmail) {
    console.warn('Email service: landlord has no email address — inquiry email skipped.');
    return { failed: true };
  }
  return sendEmail({
    to: landlordEmail,
    subject: `New Inquiry: ${property.title}`,
    html: EMAIL_TEMPLATES.base(EMAIL_TEMPLATES.propertyInquiry({
      landlordName: landlord.fullName || 'there',
      propertyTitle: property.title,
      propertyLocation: property.location,
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone,
      message: inquiry.message,
      inquiryId: inquiry._id
    }))
  });
};

const sendInquiryConfirmation = async (userEmail, userName, property, message) => {
  return sendEmail({
    to: userEmail,
    subject: `Inquiry Sent: ${property.title}`,
    html: EMAIL_TEMPLATES.base(EMAIL_TEMPLATES.inquiryConfirmation({
      name: userName,
      propertyTitle: property.title,
      propertyLocation: property.location,
      email: userEmail,
      message: message || 'I am interested in this property.'
    }))
  });
};

module.exports = {
  sendEmail,
  sendRentReminder,
  sendPaymentConfirmation,
  sendMaintenanceUpdate,
  sendLeaseExpiryWarning,
  sendMaintenanceNotification,
  sendPropertyInquiryToLandlord,
  sendInquiryConfirmation
};
