const PDFDocument = require('pdfkit');
const { createObjectCsvStringifier } = require('csv-writer');

const COMPANY_NAME = 'Rental Property Management System';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const COLORS = {
  primary: '#1a365d',
  secondary: '#2d6a9f',
  accent: '#48bb78',
  warning: '#ecc94b',
  danger: '#f56565',
  text: '#333333',
  lightText: '#666666',
  border: '#e2e8f0',
  background: '#f7fafc',
  white: '#ffffff'
};

const createBaseDocument = (doc, title, subtitle) => {
  // Header bar
  doc.rect(0, 0, PAGE_WIDTH, 120).fill(COLORS.primary);

  doc.fill(COLORS.white)
    .fontSize(22)
    .font('Helvetica-Bold')
    .text(COMPANY_NAME, MARGIN, 30, { align: 'center' });

  doc.fontSize(16)
    .font('Helvetica')
    .text(title, MARGIN, 65, { align: 'center' });

  if (subtitle) {
    doc.fontSize(11)
      .text(subtitle, MARGIN, 90, { align: 'center' });
  }

  // Date and reference line
  doc.fill(COLORS.lightText)
    .fontSize(8)
    .font('Helvetica')
    .text(`Generated: ${new Date().toISOString().split('T')[0]} | ${new Date().toLocaleTimeString()}`, MARGIN, 135, { align: 'right' });

  // Horizontal divider
  doc.moveTo(MARGIN, 145)
    .lineTo(PAGE_WIDTH - MARGIN, 145)
    .strokeColor(COLORS.border)
    .stroke();

  return doc;
};

const drawTable = (doc, headers, rows, startY, options = {}) => {
  const { fontSize = 8, headerBg = COLORS.secondary, alternating = true } = options;
  const colWidth = CONTENT_WIDTH / headers.length;
  const rowHeight = 18;
  let currentY = startY;

  // Header row
  doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight).fill(headerBg);
  doc.fill(COLORS.white).font('Helvetica-Bold').fontSize(fontSize);

  headers.forEach((header, i) => {
    doc.text(header, MARGIN + i * colWidth + 4, currentY + 5, {
      width: colWidth - 8,
      align: 'left'
    });
  });

  currentY += rowHeight;

  // Data rows
  rows.forEach((row, rowIndex) => {
    if (currentY > PAGE_HEIGHT - 80) {
      doc.addPage();
      currentY = MARGIN;

      // Repeat header on new page
      doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight).fill(headerBg);
      doc.fill(COLORS.white).font('Helvetica-Bold').fontSize(fontSize);
      headers.forEach((header, i) => {
        doc.text(header, MARGIN + i * colWidth + 4, currentY + 5, {
          width: colWidth - 8,
          align: 'left'
        });
      });
      currentY += rowHeight;
    }

    // Row background
    if (alternating && rowIndex % 2 === 1) {
      doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight).fill(COLORS.background);
    }

    // Row border
    doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();

    // Cell content
    doc.fill(COLORS.text).font('Helvetica').fontSize(fontSize);
    headers.forEach((header, i) => {
      const value = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
      doc.text(value, MARGIN + i * colWidth + 4, currentY + 5, {
        width: colWidth - 8,
        align: i === headers.length - 1 ? 'right' : 'left'
      });
    });

    currentY += rowHeight;
  });

  return currentY;
};

const drawSummaryBox = (doc, items, startY) => {
  const boxWidth = CONTENT_WIDTH / items.length;
  let currentY = startY;

  items.forEach((item, index) => {
    const x = MARGIN + index * boxWidth;
    const colors = [COLORS.secondary, COLORS.accent, COLORS.warning, COLORS.danger];

    doc.rect(x, currentY, boxWidth - 10, 50)
      .fill(colors[index % colors.length]);

    doc.fill(COLORS.white)
      .fontSize(9)
      .font('Helvetica')
      .text(item.label, x + 10, currentY + 8, {
        width: boxWidth - 30,
        align: 'center'
      });

    doc.fontSize(16)
      .font('Helvetica-Bold')
      .text(String(item.value), x + 10, currentY + 22, {
        width: boxWidth - 30,
        align: 'center'
      });
  });

  return currentY + 65;
};

const generateRentCollectionReport = async (data, format, res) => {
  const { payments = [], summary = {} } = data;
  const title = 'Rent Collection Report';
  const subtitle = `Period: ${data.period || 'All Time'} | Total Payments: ${payments.length}`;

  if (format === 'csv') {
    const header = [
      { id: 'paymentReference', title: 'Reference' },
      { id: 'propertyTitle', title: 'Property' },
      { id: 'amount', title: 'Amount (NGN)' },
      { id: 'status', title: 'Status' },
      { id: 'paymentMethod', title: 'Method' },
      { id: 'paymentDate', title: 'Date Paid' },
      { id: 'dueDate', title: 'Due Date' }
    ];

    const records = payments.map(p => ({
      paymentReference: p.paymentReference || 'N/A',
      propertyTitle: p.propertyTitle || p.leaseId?.propertyId?.title || 'N/A',
      amount: p.amount || 0,
      status: p.status || 'N/A',
      paymentMethod: p.paymentMethod || 'N/A',
      paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : 'N/A',
      dueDate: p.dueDate ? new Date(p.dueDate).toISOString().split('T')[0] : 'N/A'
    }));

    const csvStringifier = createObjectCsvStringifier({ header });
    return res.send(
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records)
    );
  }

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=rent-collection-${Date.now()}.pdf`);
  doc.pipe(res);

  createBaseDocument(doc, title, subtitle);

  let currentY = 160;

  // Summary boxes
  currentY = drawSummaryBox(doc, [
    { label: 'Total Collected', value: `NGN ${(summary.totalCollected || 0).toLocaleString()}` },
    { label: 'Pending', value: `NGN ${(summary.pendingAmount || 0).toLocaleString()}` },
    { label: 'Total Payments', value: payments.length },
    { label: 'Overdue', value: payments.filter(p => p.status === 'overdue').length }
  ], currentY);

  currentY += 10;

  // Table header
  doc.fill(COLORS.text).fontSize(12).font('Helvetica-Bold').text('Payment Details', MARGIN, currentY);
  currentY += 20;

  // Table
  const headers = ['Reference', 'Property', 'Amount (NGN)', 'Status', 'Date'];
  const rows = payments.map(p => ({
    'Reference': p.paymentReference || '-',
    'Property': (p.propertyTitle || p.leaseId?.propertyId?.title || 'N/A').substring(0, 20),
    'Amount (NGN)': (p.amount || 0).toLocaleString(),
    'Status': (p.status || '-').toUpperCase(),
    'Date': p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : '-'
  }));

  currentY = drawTable(doc, headers, rows, currentY);

  // Footer note
  doc.fontSize(8).fill(COLORS.lightText)
    .text('This is a system-generated report from Rental Property Management System.', MARGIN, PAGE_HEIGHT - 40, { align: 'center' });

  doc.end();
};

const generateVacancyReport = async (data, format, res) => {
  const { properties = [], summary = {} } = data;
  const title = 'Property Vacancy Report';
  const subtitle = `As of ${new Date().toISOString().split('T')[0]}`;

  if (format === 'csv') {
    const header = [
      { id: 'title', title: 'Property' },
      { id: 'location', title: 'Location' },
      { id: 'status', title: 'Status' },
      { id: 'rentAmount', title: 'Rent (NGN)' },
      { id: 'bedrooms', title: 'Bedrooms' },
      { id: 'bathrooms', title: 'Bathrooms' }
    ];

    const records = properties.map(p => ({
      title: p.title || 'N/A',
      location: p.location || 'N/A',
      status: p.status || 'N/A',
      rentAmount: p.rentAmount || 0,
      bedrooms: p.bedrooms || 0,
      bathrooms: p.bathrooms || 0
    }));

    const csvStringifier = createObjectCsvStringifier({ header });
    return res.send(
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records)
    );
  }

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=vacancy-report-${Date.now()}.pdf`);
  doc.pipe(res);

  createBaseDocument(doc, title, subtitle);

  let currentY = 160;

  // Summary
  currentY = drawSummaryBox(doc, [
    { label: 'Total Properties', value: properties.length },
    { label: 'Vacant', value: properties.filter(p => p.status === 'vacant').length },
    { label: 'Occupied', value: properties.filter(p => p.status === 'occupied').length },
    { label: 'Maintenance', value: properties.filter(p => p.status === 'maintenance').length }
  ], currentY);

  currentY += 10;

  doc.fill(COLORS.text).fontSize(12).font('Helvetica-Bold').text('Property Details', MARGIN, currentY);
  currentY += 20;

  const headers = ['Property', 'Location', 'Status', 'Rent (NGN)', 'Beds'];
  const rows = properties.map(p => ({
    'Property': (p.title || 'N/A').substring(0, 22),
    'Location': (p.location || 'N/A').substring(0, 18),
    'Status': (p.status || 'N/A').toUpperCase(),
    'Rent (NGN)': (p.rentAmount || 0).toLocaleString(),
    'Beds': String(p.bedrooms || 0)
  }));

  currentY = drawTable(doc, headers, rows, currentY);

  // Vacancy rate
  currentY += 20;
  const vacancyRate = properties.length > 0
    ? ((properties.filter(p => p.status === 'vacant').length / properties.length) * 100).toFixed(1)
    : 0;
  doc.fill(COLORS.text).fontSize(10).font('Helvetica')
    .text(`Vacancy Rate: ${vacancyRate}%`, MARGIN, currentY);

  doc.fontSize(8).fill(COLORS.lightText)
    .text('This is a system-generated report from Rental Property Management System.', MARGIN, PAGE_HEIGHT - 40, { align: 'center' });

  doc.end();
};

const generateMaintenanceLog = async (data, format, res) => {
  const { requests = [], summary = {} } = data;
  const title = 'Maintenance Request Log';
  const subtitle = `Total Requests: ${requests.length}`;

  if (format === 'csv') {
    const header = [
      { id: 'subject', title: 'Subject' },
      { id: 'propertyTitle', title: 'Property' },
      { id: 'tenantName', title: 'Tenant' },
      { id: 'status', title: 'Status' },
      { id: 'urgency', title: 'Urgency' },
      { id: 'requestedDate', title: 'Date Requested' },
      { id: 'resolvedDate', title: 'Date Resolved' }
    ];

    const records = requests.map(r => ({
      subject: r.subject || 'N/A',
      propertyTitle: r.propertyTitle || r.propertyId?.title || 'N/A',
      tenantName: r.tenantName || r.tenantId?.fullName || 'N/A',
      status: r.status || 'N/A',
      urgency: r.urgency || 'N/A',
      requestedDate: r.requestedDate ? new Date(r.requestedDate).toISOString().split('T')[0] : 'N/A',
      resolvedDate: r.resolvedDate ? new Date(r.resolvedDate).toISOString().split('T')[0] : '-'
    }));

    const csvStringifier = createObjectCsvStringifier({ header });
    return res.send(
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(records)
    );
  }

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=maintenance-log-${Date.now()}.pdf`);
  doc.pipe(res);

  createBaseDocument(doc, title, subtitle);

  let currentY = 160;

  // Summary
  currentY = drawSummaryBox(doc, [
    { label: 'Total Requests', value: requests.length },
    { label: 'Pending', value: requests.filter(r => r.status === 'pending').length },
    { label: 'In Progress', value: requests.filter(r => r.status === 'in-progress').length },
    { label: 'Completed', value: requests.filter(r => r.status === 'completed').length }
  ], currentY);

  currentY += 10;

  doc.fill(COLORS.text).fontSize(12).font('Helvetica-Bold').text('Request Details', MARGIN, currentY);
  currentY += 20;

  const headers = ['Subject', 'Property', 'Status', 'Urgency', 'Date'];
  const rows = requests.map(r => ({
    'Subject': (r.subject || 'N/A').substring(0, 24),
    'Property': (r.propertyTitle || r.propertyId?.title || 'N/A').substring(0, 16),
    'Status': (r.status || 'N/A').toUpperCase(),
    'Urgency': (r.urgency || 'N/A').toUpperCase(),
    'Date': r.requestedDate ? new Date(r.requestedDate).toISOString().split('T')[0] : '-'
  }));

  currentY = drawTable(doc, headers, rows, currentY);

  doc.fontSize(8).fill(COLORS.lightText)
    .text('This is a system-generated report from Rental Property Management System.', MARGIN, PAGE_HEIGHT - 40, { align: 'center' });

  doc.end();
};

module.exports = {
  generateRentCollectionReport,
  generateVacancyReport,
  generateMaintenanceLog
};
