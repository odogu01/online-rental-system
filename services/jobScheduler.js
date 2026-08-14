const cron = require('node-cron');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const {
  sendRentReminder,
  sendLeaseExpiryWarning
} = require('./emailService');

const DAY_MS = 24 * 60 * 60 * 1000;

const lastDayOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
};

/**
 * 1) Flip pending payments whose due date has passed to 'overdue'.
 */
const markOverduePayments = async () => {
  const result = await Payment.updateMany(
    { status: 'pending', dueDate: { $lt: new Date() } },
    { status: 'overdue' }
  );
  if (result.modifiedCount > 0) {
    console.log(`[job] Marked ${result.modifiedCount} payment(s) as overdue`);
  }
  return result.modifiedCount;
};

/**
 * 2) Send rent reminders for active leases with no payment recorded this month.
 */
const sendRentReminders = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const leases = await Lease.find({ status: 'active' })
    .populate('propertyId', 'title')
    .populate('tenantId', 'fullName email')
    .limit(100);

  let sent = 0;
  for (const lease of leases) {
    if (!lease.tenantId || !lease.tenantId.email) continue;

    const paidThisMonth = await Payment.exists({
      leaseId: lease._id,
      status: 'paid',
      paymentDate: { $gte: monthStart, $lte: monthEnd }
    });

    if (!paidThisMonth) {
      const dueDate = lastDayOfMonth(now);
      await sendRentReminder(
        lease.tenantId.email,
        lease.tenantId.fullName,
        lease.monthlyRent,
        dueDate,
        lease.propertyId?.title || 'your property'
      ).catch(err => console.warn('[job] Rent reminder email failed:', err.message));

      await Notification.create({
        userId: lease.tenantId._id,
        type: 'rent_reminder',
        message: `Your rent of ₦${lease.monthlyRent.toLocaleString()} for ${lease.propertyId?.title || 'your property'} is due on ${dueDate.toLocaleDateString('en-GB')}`,
        link: '/tenant/payments.html'
      }).catch(err => console.warn('[job] Rent reminder notification failed:', err.message));

      sent += 1;
    }
  }
  if (sent > 0) console.log(`[job] Sent ${sent} rent reminder(s)`);
  return sent;
};

/**
 * 3) Warn tenants whose active lease expires within the next 30 days.
 */
const sendLeaseExpiryWarnings = async () => {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * DAY_MS);

  const leases = await Lease.find({
    status: 'active',
    endDate: { $gte: now, $lte: thirtyDaysFromNow }
  })
    .populate('propertyId', 'title')
    .populate('tenantId', 'fullName email');

  let sent = 0;
  for (const lease of leases) {
    if (!lease.tenantId || !lease.tenantId.email) continue;

    await sendLeaseExpiryWarning(lease.tenantId.email, lease.tenantId.fullName, {
      propertyTitle: lease.propertyId?.title || 'N/A',
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: lease.monthlyRent
    }).catch(err => console.warn('[job] Lease expiry email failed:', err.message));

    await Notification.create({
      userId: lease.tenantId._id,
      type: 'lease_expiry',
      message: `Your lease for ${lease.propertyId?.title || 'your property'} expires on ${lease.endDate.toLocaleDateString('en-GB')}`,
      link: '/tenant/my-property.html'
    }).catch(err => console.warn('[job] Lease expiry notification failed:', err.message));

    sent += 1;
  }
  if (sent > 0) console.log(`[job] Sent ${sent} lease expiry warning(s)`);
  return sent;
};

const runDailyJobs = async () => {
  console.log(`[job] Running daily jobs at ${new Date().toISOString()}`);
  try {
    await markOverduePayments();
  } catch (err) {
    console.error('[job] markOverduePayments failed:', err.message);
  }
  try {
    await sendRentReminders();
  } catch (err) {
    console.error('[job] sendRentReminders failed:', err.message);
  }
  try {
    await sendLeaseExpiryWarnings();
  } catch (err) {
    console.error('[job] sendLeaseExpiryWarnings failed:', err.message);
  }
};

/**
 * Start the scheduled jobs. Daily at 09:00 server time.
 * Safe to call multiple times (guards against duplicate schedules).
 */
let started = false;
const startScheduledJobs = () => {
  if (started) return;
  started = true;
  cron.schedule('0 9 * * *', runDailyJobs);
  console.log('[job] Scheduled daily jobs (09:00)');
};

module.exports = {
  startScheduledJobs,
  runDailyJobs,
  markOverduePayments,
  sendRentReminders,
  sendLeaseExpiryWarnings
};
