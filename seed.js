require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Property = require('./models/Property');
const Lease = require('./models/Lease');
const Payment = require('./models/Payment');
const MaintenanceRequest = require('./models/MaintenanceRequest');
const Notification = require('./models/Notification');

const DEMO_PASSWORD = 'Password123!';

// ---------- Seed data ----------
async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB Atlas');

    // Clear existing demo data (order matters for FK constraints)
    await Notification.deleteMany({});
    await MaintenanceRequest.deleteMany({});
    await Payment.deleteMany({});
    await Lease.deleteMany({});
    await Property.deleteMany({});
    await User.deleteMany({});
    console.log('🧹 Cleared existing data');

    // ── 1. Users ──────────────────────────────────────────────────────
    // Pass plain passwords — User model's pre-save hook handles hashing
    const admin = await User.create({
      fullName: 'Admin David',
      email: 'admin@rentalsystem.com',
      password: DEMO_PASSWORD,
      role: 'admin',
      phoneNumber: '+2348010000000',
      isActive: true
    });
    console.log(`✅ Admin created: ${admin.email}`);

    const landlord1 = await User.create({
      fullName: 'Chief Nnamdi Okonkwo',
      email: 'landlord1@rentalsystem.com',
      password: DEMO_PASSWORD,
      role: 'landlord',
      phoneNumber: '+2348021111111',
      isActive: true
    });
    console.log(`✅ Landlord created: ${landlord1.email}`);

    const landlord2 = await User.create({
      fullName: 'Mrs. Chioma Eze',
      email: 'landlord2@rentalsystem.com',
      password: DEMO_PASSWORD,
      role: 'landlord',
      phoneNumber: '+2348032222222',
      isActive: true
    });
    console.log(`✅ Landlord created: ${landlord2.email}`);

    const tenant1 = await User.create({
      fullName: 'Emmanuel Johnson',
      email: 'tenant1@rentalsystem.com',
      password: DEMO_PASSWORD,
      role: 'tenant',
      phoneNumber: '+2348043333333',
      isActive: true
    });
    console.log(`✅ Tenant created: ${tenant1.email}`);

    const tenant2 = await User.create({
      fullName: 'Grace Akpan',
      email: 'tenant2@rentalsystem.com',
      password: DEMO_PASSWORD,
      role: 'tenant',
      phoneNumber: '+2348054444444',
      isActive: true
    });
    console.log(`✅ Tenant created: ${tenant2.email}`);

    const tenant3 = await User.create({
      fullName: 'Michael Obi',
      email: 'tenant3@rentalsystem.com',
      password: DEMO_PASSWORD,
      role: 'tenant',
      phoneNumber: '+2348065555555',
      isActive: true
    });
    console.log(`✅ Tenant created: ${tenant3.email}`);

    // ── 2. Properties ────────────────────────────────────────────────
    const prop1 = await Property.create({
      landlordId: landlord1._id,
      title: 'Luxury 3-Bedroom Duplex in Ikoyi',
      location: '15 Thompson Avenue, Ikoyi, Lagos',
      description: 'Beautifully finished duplex with modern fittings, central AC, standby generator, 24/7 security, and a private swimming pool. Located in the heart of Ikoyi.',
      rentAmount: 1500000,
      bedrooms: 3,
      bathrooms: 3,
      amenities: 'Central A/C, Generator, Swimming Pool, Security, Parking, WiFi, DSTV, Kitchen Cabinets, Wardrobes',
      status: 'occupied'
    });
    console.log(`✅ Property created: ${prop1.title}`);

    const prop2 = await Property.create({
      landlordId: landlord1._id,
      title: '2-Bedroom Flat in Lekki Phase 1',
      location: 'Block 42, Road 8, Lekki Phase 1, Lagos',
      description: 'Spacious ground-floor flat with tiled floors, netted windows, fitted kitchen, and a small garden. Close to shopping malls and schools.',
      rentAmount: 600000,
      bedrooms: 2,
      bathrooms: 2,
      amenities: 'Tiled Floors, Fitted Kitchen, Garden, Parking, Security, Netting, Water Storage',
      status: 'occupied'
    });
    console.log(`✅ Property created: ${prop2.title}`);

    const prop3 = await Property.create({
      landlordId: landlord1._id,
      title: 'Self-Contained Studio in Yaba',
      location: '23 Moriamo Street, Yaba, Lagos',
      description: 'Cozy self-contained studio apartment ideal for a single professional or student. Close to Unilag and major bus stops.',
      rentAmount: 350000,
      bedrooms: 1,
      bathrooms: 1,
      amenities: 'Tiled Floor, Ceiling Fan, Kitchen Area, Wardrobe, 24/7 Water Supply, Security',
      status: 'vacant'
    });
    console.log(`✅ Property created: ${prop3.title}`);

    const prop4 = await Property.create({
      landlordId: landlord2._id,
      title: '4-Bedroom Detached House in Enugu',
      location: '10 Presidential Road, Enugu',
      description: 'Spacious detached house with a large compound, boys\' quarters, and a garage. Ideal for a large family. Gated estate with 24/7 security.',
      rentAmount: 800000,
      bedrooms: 4,
      bathrooms: 3,
      amenities: 'Boys Quarters, Garage, Garden, Generator, Security, Borehole, CCTVs',
      status: 'occupied'
    });
    console.log(`✅ Property created: ${prop4.title}`);

    const prop5 = await Property.create({
      landlordId: landlord2._id,
      title: '1-Bedroom Annex in Surulere',
      location: '7 Bode Thomas Street, Surulere, Lagos',
      description: 'Furnished annex with a living room, bedroom, kitchenette, and bathroom. Walking distance to restaurants and cinemas.',
      rentAmount: 450000,
      bedrooms: 1,
      bathrooms: 1,
      amenities: 'Furnished, A/C, Kitchenette, Hot Water, WiFi, Security, Parking',
      status: 'vacant'
    });
    console.log(`✅ Property created: ${prop5.title}`);

    const prop6 = await Property.create({
      landlordId: landlord2._id,
      title: 'Mini Flat in Abuja CBD',
      location: '12 Adetokunbo Ademola Crescent, Wuse 2, Abuja',
      description: 'Modern mini-flat in the heart of Abuja. Walking distance to banks, supermarkets, and restaurants. Excellent for a young professional.',
      rentAmount: 720000,
      bedrooms: 1,
      bathrooms: 1,
      amenities: 'A/C, Tiled Floors, Fitted Kitchen, 24/7 Electricity, Security, Parking, Elevator',
      status: 'maintenance'
    });
    console.log(`✅ Property created: ${prop6.title}`);

    // ── 3. Leases ─────────────────────────────────────────────────────
    const lease1 = await Lease.create({
      propertyId: prop1._id,
      tenantId: tenant1._id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      monthlyRent: 1500000,
      securityDeposit: 1500000,
      status: 'active'
    });
    await Property.findByIdAndUpdate(prop1._id, { status: 'occupied' });
    console.log(`✅ Lease created: ${prop1.title} → ${tenant1.fullName}`);

    const lease2 = await Lease.create({
      propertyId: prop2._id,
      tenantId: tenant2._id,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2026-02-28'),
      monthlyRent: 600000,
      securityDeposit: 600000,
      status: 'active'
    });
    await Property.findByIdAndUpdate(prop2._id, { status: 'occupied' });
    console.log(`✅ Lease created: ${prop2.title} → ${tenant2.fullName}`);

    const lease3 = await Lease.create({
      propertyId: prop4._id,
      tenantId: tenant3._id,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2025-05-31'),
      monthlyRent: 800000,
      securityDeposit: 800000,
      status: 'active'
    });
    await Property.findByIdAndUpdate(prop4._id, { status: 'occupied' });
    console.log(`✅ Lease created: ${prop4.title} → ${tenant3.fullName}`);

    const lease4 = await Lease.create({
      propertyId: prop6._id,
      tenantId: tenant1._id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      monthlyRent: 720000,
      securityDeposit: 720000,
      status: 'expired'
    });
    console.log(`✅ Lease created (expired): ${prop6.title} → ${tenant1.fullName}`);

    // ── 4. Payments ───────────────────────────────────────────────────
    const payments = await Payment.create([
      {
        leaseId: lease1._id,
        amount: 1500000,
        paymentDate: new Date('2025-01-05'),
        dueDate: new Date('2025-01-01'),
        paymentMethod: 'bank_transfer',
        status: 'paid'
      },
      {
        leaseId: lease1._id,
        amount: 1500000,
        paymentDate: new Date('2025-02-03'),
        dueDate: new Date('2025-02-01'),
        paymentMethod: 'online',
        status: 'paid'
      },
      {
        leaseId: lease1._id,
        amount: 1500000,
        paymentDate: new Date('2025-03-04'),
        dueDate: new Date('2025-03-01'),
        paymentMethod: 'bank_transfer',
        status: 'paid'
      },
      {
        leaseId: lease1._id,
        amount: 1500000,
        paymentDate: null,
        dueDate: new Date('2025-04-01'),
        paymentMethod: 'online',
        status: 'overdue'
      },
      {
        leaseId: lease2._id,
        amount: 600000,
        paymentDate: new Date('2025-03-10'),
        dueDate: new Date('2025-03-01'),
        paymentMethod: 'cash',
        status: 'paid'
      },
      {
        leaseId: lease2._id,
        amount: 600000,
        paymentDate: new Date('2025-04-05'),
        dueDate: new Date('2025-04-01'),
        paymentMethod: 'bank_transfer',
        status: 'paid'
      },
      {
        leaseId: lease3._id,
        amount: 800000,
        paymentDate: new Date('2025-04-02'),
        dueDate: new Date('2025-04-01'),
        paymentMethod: 'online',
        status: 'paid'
      },
      {
        leaseId: lease3._id,
        amount: 800000,
        paymentDate: null,
        dueDate: new Date('2025-05-01'),
        paymentMethod: 'online',
        status: 'pending'
      },
      {
        leaseId: lease4._id,
        amount: 720000,
        paymentDate: new Date('2024-01-10'),
        dueDate: new Date('2024-01-01'),
        paymentMethod: 'cheque',
        status: 'paid'
      }
    ]);
    console.log(`✅ ${payments.length} payments created`);

    // ── 5. Maintenance Requests ───────────────────────────────────────
    const maintenanceRequests = await MaintenanceRequest.create([
      {
        tenantId: tenant1._id,
        propertyId: prop1._id,
        subject: 'A/C not cooling properly',
        description: 'The living room air conditioner has not been cooling for the past 3 days. It is blowing warm air.',
        urgency: 'high',
        status: 'in-progress',
        requestedDate: new Date('2025-04-10')
      },
      {
        tenantId: tenant2._id,
        propertyId: prop2._id,
        subject: 'Kitchen sink leaking',
        description: 'The kitchen sink has a slow leak under the cabinet. The wooden base is starting to swell.',
        urgency: 'medium',
        status: 'pending',
        requestedDate: new Date('2025-04-15')
      },
      {
        tenantId: tenant3._id,
        propertyId: prop4._id,
        subject: 'Burglary door grill loose',
        description: 'The burglary grill at the back door has come loose on one side. Needs tightening for security.',
        urgency: 'high',
        status: 'completed',
        requestedDate: new Date('2025-04-01'),
        resolvedDate: new Date('2025-04-05'),
        resolutionNotes: 'Reinforced the grill mounts and replaced two rusted bolts.'
      },
      {
        tenantId: tenant1._id,
        propertyId: prop1._id,
        subject: 'Replace bathroom faucet',
        description: 'The hot water faucet in the master bathroom is dripping constantly. Please replace.',
        urgency: 'low',
        status: 'pending',
        requestedDate: new Date('2025-04-18')
      }
    ]);
    console.log(`✅ ${maintenanceRequests.length} maintenance requests created`);

    // ── 6. Notifications ──────────────────────────────────────────────
    const notifications = await Notification.create([
      {
        userId: tenant1._id,
        type: 'rent_reminder',
        message: 'Your rent of ₦1,500,000 for Luxury 3-Bedroom Duplex in Ikoyi is now overdue. Please make payment immediately to avoid penalties.',
        isRead: false
      },
      {
        userId: tenant1._id,
        type: 'payment_confirmation',
        message: 'Your payment of ₦1,500,000 for March rent has been received and confirmed. Thank you!',
        isRead: true
      },
      {
        userId: tenant1._id,
        type: 'maintenance_update',
        message: 'Your A/C maintenance request has been assigned to a technician and is now in progress.',
        isRead: false
      },
      {
        userId: tenant2._id,
        type: 'maintenance_update',
        message: 'Your kitchen sink maintenance request has been received. A plumber will contact you within 48 hours.',
        isRead: false
      },
      {
        userId: tenant3._id,
        type: 'maintenance_update',
        message: 'Your burglary grill repair has been completed successfully. Please confirm it\'s satisfactory.',
        isRead: true
      },
      {
        userId: tenant3._id,
        type: 'rent_reminder',
        message: 'Your rent of ₦800,000 for 4-Bedroom Detached House in Enugu is due on May 1st. Please pay on time.',
        isRead: false
      },
      {
        userId: landlord1._id,
        type: 'maintenance_update',
        message: 'A new maintenance request was raised for Luxury 3-Bedroom Duplex in Ikoyi — A/C issue marked as high urgency.',
        isRead: false
      },
      {
        userId: landlord2._id,
        type: 'maintenance_update',
        message: 'Maintenance request for 4-Bedroom Detached House in Enugu has been resolved.',
        isRead: true
      },
      {
        userId: admin._id,
        type: 'lease_expiry',
        message: 'Lease for 4-Bedroom Detached House in Enugu (tenant: Michael Obi) expires on May 31st, 2025. Review renewal.',
        isRead: false
      }
    ]);
    console.log(`✅ ${notifications.length} notifications created`);

    // ── Summary ───────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log('🎉 SEED COMPLETE');
    console.log('══════════════════════════════════════════');
    console.log(`Users:             ${await User.countDocuments()}`);
    console.log(`Properties:        ${await Property.countDocuments()}`);
    console.log(`Leases:            ${await Lease.countDocuments()}`);
    console.log(`Payments:          ${await Payment.countDocuments()}`);
    console.log(`Maintenance Reqs:  ${await MaintenanceRequest.countDocuments()}`);
    console.log(`Notifications:     ${await Notification.countDocuments()}`);
    console.log('────────────────────────────────────────────');
    console.log('🔑 Demo Login Credentials:');
    console.log('   Admin:     admin@rentalsystem.com / Password123!');
    console.log('   Landlord1: landlord1@rentalsystem.com / Password123!');
    console.log('   Landlord2: landlord2@rentalsystem.com / Password123!');
    console.log('   Tenant1:   tenant1@rentalsystem.com / Password123!');
    console.log('   Tenant2:   tenant2@rentalsystem.com / Password123!');
    console.log('   Tenant3:   tenant3@rentalsystem.com / Password123!');
    console.log('══════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
