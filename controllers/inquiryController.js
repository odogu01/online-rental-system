const PropertyInquiry = require('../models/PropertyInquiry');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorMiddleware');
const {
  sendPropertyInquiryToLandlord,
  sendInquiryConfirmation
} = require('../services/emailService');

/**
 * POST /api/inquiries (public)
 * Store a contact message, email the landlord, notify the landlord in-app,
 * and email a confirmation to the sender.
 */
exports.createInquiry = async (req, res, next) => {
  try {
    const { propertyId, name, email, phone, message } = req.body;

    const property = await Property.findById(propertyId).populate('landlordId', 'fullName email');
    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }
    if (!property.landlordId) {
      throw new AppError('This property has no landlord on file', 400, 'NO_LANDLORD');
    }

    const inquiry = await PropertyInquiry.create({
      propertyId: property._id,
      landlordId: property.landlordId._id,
      userId: req.user ? req.user._id : null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      message: message.trim()
    });

    // Email the landlord (fire-and-forget; never block the response)
    sendPropertyInquiryToLandlord(property.landlordId, property, inquiry)
      .catch(err => console.warn('Inquiry email to landlord failed:', err.message));

    // Email confirmation to the sender (fire-and-forget)
    sendInquiryConfirmation(inquiry.email, inquiry.name, property, inquiry.message)
      .catch(err => console.warn('Inquiry confirmation email failed:', err.message));

    // In-app notification for the landlord with a link to view the message
    Notification.create({
      userId: property.landlordId._id,
      type: 'property_inquiry',
      message: `New inquiry from ${inquiry.name} about ${property.title}`,
      link: `/landlord/inquiries.html?id=${inquiry._id}`
    }).catch(err => console.warn('Inquiry notification failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been sent to the landlord.',
      data: { inquiry }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inquiries
 * Role-scoped list: admin sees all; landlord sees inquiries on own properties;
 * tenant sees only their own inquiries.
 */
exports.getInquiries = async (req, res, next) => {
  try {
    const filter = {};
    const { status, propertyId } = req.query;

    if (req.user.role === 'landlord') {
      filter.landlordId = req.user._id;
    } else if (req.user.role === 'tenant') {
      filter.userId = req.user._id;
    }

    if (status === 'read') filter.isRead = true;
    if (status === 'unread') filter.isRead = false;
    if (propertyId) filter.propertyId = propertyId;

    const [inquiries, unreadCount] = await Promise.all([
      PropertyInquiry.find(filter)
        .populate('propertyId', 'title location rentAmount')
        .sort({ createdAt: -1 })
        .limit(100),
      PropertyInquiry.countDocuments({ ...filter, isRead: false })
    ]);

    res.json({
      success: true,
      data: {
        inquiries,
        total: inquiries.length,
        unreadCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/inquiries/:id
 * Single inquiry with ownership check.
 */
exports.getInquiryById = async (req, res, next) => {
  try {
    const inquiry = await PropertyInquiry.findById(req.params.id)
      .populate('propertyId', 'title location rentAmount images');

    if (!inquiry) {
      throw new AppError('Inquiry not found', 404, 'INQUIRY_NOT_FOUND');
    }

    const isLandlord = inquiry.landlordId.toString() === req.user._id.toString();
    const isOwner = inquiry.userId && inquiry.userId.toString() === req.user._id.toString();

    if (!isLandlord && !isOwner && req.user.role !== 'admin') {
      throw new AppError('Not authorized to view this inquiry', 403, 'UNAUTHORIZED');
    }

    res.json({
      success: true,
      data: { inquiry }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/inquiries/:id/read
 * Mark an inquiry as read (same ownership rules as getInquiryById).
 */
exports.markRead = async (req, res, next) => {
  try {
    const inquiry = await PropertyInquiry.findById(req.params.id);

    if (!inquiry) {
      throw new AppError('Inquiry not found', 404, 'INQUIRY_NOT_FOUND');
    }

    const isLandlord = inquiry.landlordId.toString() === req.user._id.toString();
    const isOwner = inquiry.userId && inquiry.userId.toString() === req.user._id.toString();

    if (!isLandlord && !isOwner && req.user.role !== 'admin') {
      throw new AppError('Not authorized to update this inquiry', 403, 'UNAUTHORIZED');
    }

    inquiry.isRead = true;
    inquiry.readAt = new Date();
    await inquiry.save();

    res.json({
      success: true,
      message: 'Inquiry marked as read',
      data: { inquiry }
    });
  } catch (error) {
    next(error);
  }
};
