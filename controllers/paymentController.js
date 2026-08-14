const Payment = require('../models/Payment');
const Lease = require('../models/Lease');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorMiddleware');
const { sendPaymentConfirmation } = require('../services/emailService');

const buildScopeLeaseFilter = async (req) => {
  if (req.user.role === 'landlord') {
    const properties = await Property.find({ landlordId: req.user._id }).select('_id');
    return { propertyId: { $in: properties.map(p => p._id) } };
  }
  if (req.user.role === 'tenant') {
    return { tenantId: req.user._id };
  }
  return {};
};

const computeOutstanding = async (scopeFilter) => {
  const leases = await Lease.find({
    ...scopeFilter,
    status: 'active'
  })
    .populate('propertyId', 'title')
    .populate('tenantId', 'fullName');

  const outstanding = [];

  for (const lease of leases) {
    const now = new Date();
    const startDate = new Date(lease.startDate);
    const endDate = new Date(lease.endDate);
    const capDate = now < endDate ? now : endDate;

    const monthsActive = Math.max(0,
      (capDate.getFullYear() - startDate.getFullYear()) * 12 +
      (capDate.getMonth() - startDate.getMonth()) + 1
    );

    const paidPayments = await Payment.find({
      leaseId: lease._id,
      status: 'paid'
    });

    const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const expectedTotal = monthsActive * lease.monthlyRent;
    const balance = expectedTotal - totalPaid;

    if (balance > 0) {
      outstanding.push({
        leaseId: lease._id,
        propertyTitle: lease.propertyId?.title || 'Unknown',
        tenantName: lease.tenantId?.fullName || 'Unknown',
        monthlyRent: lease.monthlyRent,
        monthsActive,
        totalPaid,
        balance
      });
    }
  }

  return outstanding;
};

exports.recordPayment = async (req, res, next) => {
  try {
    const { leaseId, amount, dueDate, paymentMethod, notes } = req.body;

    const lease = await Lease.findById(leaseId)
      .populate('propertyId', 'title')
      .populate('tenantId', 'fullName email');
    if (!lease) {
      throw new AppError('Lease not found', 404, 'LEASE_NOT_FOUND');
    }

    if (lease.status !== 'active') {
      throw new AppError('Cannot record payment for an inactive lease', 400, 'LEASE_NOT_ACTIVE');
    }

    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400, 'INVALID_AMOUNT');
    }

    const payment = await Payment.create({
      leaseId,
      amount: amountNum,
      dueDate: new Date(dueDate),
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'cash',
      status: 'paid'
    });

    // Send confirmation email (async - don't block response)
    sendPaymentConfirmation(lease.tenantId.email, {
      tenantName: lease.tenantId.fullName,
      propertyTitle: lease.propertyId?.title,
      amount: amountNum,
      paymentDate: new Date(),
      paymentReference: payment.paymentReference,
      paymentMethod: payment.paymentMethod
    }).catch(err => console.warn('Payment email failed:', err.message));

    // Notify the tenant in-app
    Notification.create({
      userId: lease.tenantId._id,
      type: 'payment_confirmation',
      message: `Payment of ₦${amountNum.toLocaleString()} recorded for ${lease.propertyId?.title || 'your property'}`,
      link: '/tenant/payments.html'
    }).catch(err => console.warn('Payment notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const filter = {};
    const { leaseId, status, startDate, endDate, method } = req.query;

    if (leaseId) filter.leaseId = leaseId;
    if (status) filter.status = status;
    if (method) filter.paymentMethod = method;

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    // Role-based filtering
    const scopeFilter = await buildScopeLeaseFilter(req);
    if (Object.keys(scopeFilter).length > 0) {
      const leases = await Lease.find(scopeFilter).select('_id');
      filter.leaseId = { $in: leases.map(l => l._id) };
    }

    const payments = await Payment.find(filter)
      .populate({
        path: 'leaseId',
        select: 'monthlyRent startDate endDate',
        populate: {
          path: 'propertyId',
          select: 'title location'
        }
      })
      .sort({ paymentDate: -1 });

    const outstandingList = await computeOutstanding(scopeFilter);
    const summary = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((s, p) => s + p.amount, 0),
      paid: payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
      pending: payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
      overdue: payments.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0),
      outstanding: outstandingList.reduce((s, o) => s + o.balance, 0)
    };

    res.json({
      success: true,
      data: { payments, summary }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate({
        path: 'leaseId',
        select: 'monthlyRent startDate endDate',
        populate: {
          path: 'propertyId',
          select: 'title location landlordId'
        }
      });

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    // Authorization check
    const property = payment.leaseId?.propertyId;
    if (property && req.user.role !== 'admin') {
      const isLandlord = property.landlordId?.toString() === req.user._id?.toString();
      const lease = await Lease.findById(payment.leaseId);
      const isTenant = lease?.tenantId?.toString() === req.user._id?.toString();
      if (!isLandlord && !isTenant) {
        throw new AppError('Not authorized to view this payment', 403, 'UNAUTHORIZED');
      }
    }

    res.json({
      success: true,
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

exports.generateReceipt = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate({
        path: 'leaseId',
        select: 'tenantId startDate endDate monthlyRent',
        populate: {
          path: 'propertyId',
          select: 'title location landlordId'
        }
      });

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    // Authorization: admin, the lease's landlord, or the tenant on the lease
    const isAdmin = req.user.role === 'admin';
    const property = payment.leaseId?.propertyId;
    const isLandlord = property?.landlordId?.toString() === req.user._id?.toString();
    const isTenant = payment.leaseId?.tenantId?.toString() === req.user._id?.toString();

    if (!isAdmin && !isLandlord && !isTenant) {
      throw new AppError('Not authorized to view this receipt', 403, 'PAYMENT_ACCESS_DENIED');
    }

    const PDFDocument = require('pdfkit');

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Receipt - ${payment.paymentReference}`,
        Author: 'Rental Property Management System'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.paymentReference}-${Date.now()}.pdf`);
    doc.pipe(res);

    // Header
    doc.rect(0, 0, 595.28, 140).fill('#1a365d');
    doc.fill('#ffffff').fontSize(24).font('Helvetica-Bold')
      .text('PAYMENT RECEIPT', 50, 30, { align: 'center' });
    doc.fontSize(12).font('Helvetica')
      .text('Rental Property Management System', 50, 70, { align: 'center' });
    doc.fontSize(10).text(`Receipt #: ${payment.paymentReference}`, 50, 100, { align: 'center' });
    doc.text(`Date: ${payment.paymentDate.toISOString().split('T')[0]}`, 50, 120, { align: 'center' });

    // Divider
    doc.fillColor('#1a365d').rect(50, 155, 495.28, 2).fill();

    // Details section
    let yPos = 180;
    doc.fill('#333333').fontSize(11).font('Helvetica');

    const addField = (label, value) => {
      doc.fill('#666666').font('Helvetica-Bold').text(label, 50, yPos);
      doc.fill('#333333').font('Helvetica').text(String(value || 'N/A'), 200, yPos);
      yPos += 22;
    };

    addField('Property:', payment.leaseId?.propertyId?.title || 'N/A');
    addField('Location:', payment.leaseId?.propertyId?.location || 'N/A');
    addField('Amount Paid:', `NGN ${payment.amount.toLocaleString()}`);
    addField('Payment Method:', payment.paymentMethod.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    addField('Status:', payment.status.toUpperCase());
    addField('Due Date:', payment.dueDate.toISOString().split('T')[0]);
    addField('Payment Date:', payment.paymentDate.toISOString().split('T')[0]);

    // Amount box
    yPos += 20;
    doc.rect(50, yPos, 495.28, 50).fill('#f0f4f8');
    doc.fill('#1a365d').fontSize(14).font('Helvetica-Bold')
      .text(`Total Amount Paid: NGN ${payment.amount.toLocaleString()}`, 60, yPos + 15);

    // Footer
    doc.fill('#999999').fontSize(8).font('Helvetica')
      .text('This is a computer-generated receipt. No signature required.', 50, 750, { align: 'center' })
      .text(`Generated on ${new Date().toISOString()}`, 50, 765, { align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
};

exports.getOutstandingBalance = async (req, res, next) => {
  try {
    const { leaseId } = req.query;

    const filter = await buildScopeLeaseFilter(req);
    if (leaseId) filter._id = leaseId;

    const outstanding = await computeOutstanding(filter);
    const totalOutstanding = outstanding.reduce((sum, o) => sum + o.balance, 0);

    res.json({
      success: true,
      data: {
        outstanding,
        totalOutstanding,
        leaseCount: outstanding.length
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getOverduePayments = async (req, res, next) => {
  try {
    if (req.user.role === 'tenant') {
      throw new AppError('Only landlords can view overdue payments', 403, 'UNAUTHORIZED');
    }

    const filter = { status: { $in: ['pending', 'overdue'] } };

    if (req.user.role === 'landlord') {
      const properties = await Property.find({ landlordId: req.user._id }).select('_id');
      const leases = await Lease.find({
        propertyId: { $in: properties.map(p => p._id) }
      }).select('_id');
      filter.leaseId = { $in: leases.map(l => l._id) };
    }

    const overduePayments = await Payment.find(filter)
      .populate({
        path: 'leaseId',
        select: 'monthlyRent startDate endDate',
        populate: [
          { path: 'propertyId', select: 'title location' },
          { path: 'tenantId', select: 'fullName email phoneNumber' }
        ]
      })
      .sort({ dueDate: 1 });

    res.json({
      success: true,
      data: {
        overduePayments,
        totalOverdue: overduePayments.reduce((s, p) => s + p.amount, 0),
        count: overduePayments.length
      }
    });
  } catch (error) {
    next(error);
  }
};
