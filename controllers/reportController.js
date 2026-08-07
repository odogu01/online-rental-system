const Payment = require('../models/Payment');
const Property = require('../models/Property');
const Lease = require('../models/Lease');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const { AppError } = require('../middleware/errorMiddleware');
const {
  generateRentCollectionReport,
  generateVacancyReport,
  generateMaintenanceLog
} = require('../services/reportGenerator');

const getLandlordLeaseIds = async (landlordId) => {
  const properties = await Property.find({ landlordId }).select('_id');
  const leases = await Lease.find({
    propertyId: { $in: properties.map(p => p._id) }
  }).select('_id');
  return leases.map(l => l._id);
};

exports.generateRentReport = async (req, res, next) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;

    if (!['json', 'pdf', 'csv'].includes(format)) {
      throw new AppError('Format must be json, pdf, or csv', 400, 'INVALID_FORMAT');
    }

    const filter = {};
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    if (req.user.role === 'landlord') {
      const leaseIds = await getLandlordLeaseIds(req.user._id);
      filter.leaseId = { $in: leaseIds };
    } else if (req.user.role === 'tenant') {
      const leases = await Lease.find({ tenantId: req.user._id }).select('_id');
      filter.leaseId = { $in: leases.map(l => l._id) };
    }

    const payments = await Payment.find(filter)
      .populate({
        path: 'leaseId',
        select: 'monthlyRent',
        populate: { path: 'propertyId', select: 'title location' }
      })
      .sort({ paymentDate: -1 });

    const totalCollected = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingAmount = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const overdueAmount = payments
      .filter(p => p.status === 'overdue')
      .reduce((sum, p) => sum + p.amount, 0);

    if (format === 'pdf') {
      return generateRentCollectionReport(
        {
          payments,
          summary: { totalCollected, pendingAmount, overdueAmount },
          period: startDate && endDate
            ? `${startDate} to ${endDate}`
            : 'All Time'
        },
        'pdf',
        res
      );
    }

    if (format === 'csv') {
      return generateRentCollectionReport(
        { payments, summary: { totalCollected, pendingAmount, overdueAmount } },
        'csv',
        res
      );
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalPayments: payments.length,
          totalCollected,
          pendingAmount,
          overdueAmount,
          collectionRate: (totalCollected + pendingAmount + overdueAmount) > 0
            ? ((totalCollected / (totalCollected + pendingAmount + overdueAmount)) * 100).toFixed(1)
            : 0
        },
        payments
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.generateVacancyReport = async (req, res, next) => {
  try {
    const { format = 'json' } = req.query;

    if (!['json', 'pdf', 'csv'].includes(format)) {
      throw new AppError('Format must be json, pdf, or csv', 400, 'INVALID_FORMAT');
    }

    const filter = {};
    if (req.user.role === 'landlord') filter.landlordId = req.user._id;
    if (req.user.role === 'tenant') {
      throw new AppError('Tenants cannot generate vacancy reports', 403, 'UNAUTHORIZED');
    }

    const properties = await Property.find(filter).populate('landlordId', 'fullName email');

    const total = properties.length;
    const vacant = properties.filter(p => p.status === 'vacant');
    const occupied = properties.filter(p => p.status === 'occupied');
    const maintenance = properties.filter(p => p.status === 'maintenance');

    const estimatedMonthlyLoss = vacant.reduce((sum, p) => sum + p.rentAmount, 0);

    if (format === 'pdf') {
      return generateVacancyReport(
        {
          properties,
          summary: { total, vacant: vacant.length, occupied: occupied.length, maintenance: maintenance.length }
        },
        'pdf',
        res
      );
    }

    if (format === 'csv') {
      return generateVacancyReport(
        { properties },
        'csv',
        res
      );
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalProperties: total,
          vacant: vacant.length,
          occupied: occupied.length,
          underMaintenance: maintenance.length,
          occupancyRate: total > 0 ? ((occupied.length / total) * 100).toFixed(2) : 0,
          vacancyRate: total > 0 ? ((vacant.length / total) * 100).toFixed(2) : 0,
          estimatedMonthlyLoss
        },
        vacantProperties: vacant,
        occupiedProperties: occupied,
        maintenanceProperties: maintenance
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.generateMaintenanceReport = async (req, res, next) => {
  try {
    const { format = 'json', status, urgency } = req.query;

    if (!['json', 'pdf', 'csv'].includes(format)) {
      throw new AppError('Format must be json, pdf, or csv', 400, 'INVALID_FORMAT');
    }

    const filter = {};
    if (status) filter.status = status;
    if (urgency) filter.urgency = urgency;

    if (req.user.role === 'landlord') {
      const properties = await Property.find({ landlordId: req.user._id }).select('_id');
      filter.propertyId = { $in: properties.map(p => p._id) };
    } else if (req.user.role === 'tenant') {
      filter.tenantId = req.user._id;
    }

    const requests = await MaintenanceRequest.find(filter)
      .populate('propertyId', 'title location')
      .populate('tenantId', 'fullName email')
      .sort({ createdAt: -1 });

    if (format === 'pdf') {
      return generateMaintenanceLog({ requests }, 'pdf', res);
    }

    if (format === 'csv') {
      return generateMaintenanceLog({ requests }, 'csv', res);
    }

    const pending = requests.filter(r => r.status === 'pending').length;
    const inProgress = requests.filter(r => r.status === 'in-progress').length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    res.json({
      success: true,
      data: {
        summary: {
          totalRequests: requests.length,
          pending,
          inProgress,
          completed,
          rejected,
          completionRate: requests.length > 0
            ? ((completed / requests.length) * 100).toFixed(1)
            : 0
        },
        requests
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.generateArrearsReport = async (req, res, next) => {
  try {
    const { format = 'json' } = req.query;

    if (!['json', 'pdf', 'csv'].includes(format)) {
      throw new AppError('Format must be json, pdf, or csv', 400, 'INVALID_FORMAT');
    }

    let filter = { status: 'overdue' };

    if (req.user.role === 'landlord') {
      const leaseIds = await getLandlordLeaseIds(req.user._id);
      filter.leaseId = { $in: leaseIds };
    } else if (req.user.role === 'tenant') {
      const leases = await Lease.find({ tenantId: req.user._id }).select('_id');
      filter.leaseId = { $in: leases.map(l => l._id) };
    }

    const arrears = await Payment.find(filter)
      .populate({
        path: 'leaseId',
        select: 'monthlyRent',
        populate: [
          { path: 'propertyId', select: 'title location' },
          { path: 'tenantId', select: 'fullName email phoneNumber' }
        ]
      })
      .sort({ dueDate: 1 });

    const totalArrears = arrears.reduce((sum, p) => sum + p.amount, 0);

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=arrears-report-${Date.now()}.pdf`);
      doc.pipe(res);

      doc.rect(0, 0, 595.28, 120).fill('#1a365d');
      doc.fill('#ffffff').fontSize(20).font('Helvetica-Bold')
        .text('Outstanding Arrears Report', 50, 30, { align: 'center' });
      doc.fontSize(12).font('Helvetica')
        .text(`Total Outstanding: NGN ${totalArrears.toLocaleString()}`, 50, 65, { align: 'center' });
      doc.text(`Generated: ${new Date().toISOString().split('T')[0]}`, 50, 90, { align: 'center' });

      let yPos = 150;
      arrears.forEach(a => {
        if (yPos > 700) { doc.addPage(); yPos = 50; }
        doc.fill('#333').fontSize(10)
          .text(`${a.paymentReference} | ${a.leaseId?.propertyId?.title || 'N/A'} | NGN ${a.amount} | Due: ${a.dueDate.toISOString().split('T')[0]}`, 50, yPos);
        yPos += 20;
      });

      doc.end();
      return;
    }

    if (format === 'csv') {
      const { createObjectCsvStringifier } = require('csv-writer');
      const csvStringifier = createObjectCsvStringifier({
        header: [
          { id: 'reference', title: 'Reference' },
          { id: 'property', title: 'Property' },
          { id: 'tenant', title: 'Tenant' },
          { id: 'amount', title: 'Amount (NGN)' },
          { id: 'dueDate', title: 'Due Date' }
        ]
      });
      const records = arrears.map(a => ({
        reference: a.paymentReference,
        property: a.leaseId?.propertyId?.title || 'N/A',
        tenant: a.leaseId?.tenantId?.fullName || 'N/A',
        amount: a.amount,
        dueDate: a.dueDate.toISOString().split('T')[0]
      }));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=arrears-${Date.now()}.csv`);
      return res.send(csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records));
    }

    res.json({
      success: true,
      data: {
        totalArrears,
        arrearsCount: arrears.length,
        arrears
      }
    });
  } catch (error) {
    next(error);
  }
};
