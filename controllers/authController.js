const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../middleware/errorMiddleware');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const generateRefreshToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

exports.register = async (req, res, next) => {
  try {
    const { fullName, email, password, role, phoneNumber } = req.body;

    if (role && !['tenant', 'landlord'].includes(role)) {
      throw new AppError('Role must be landlord or tenant', 400, 'INVALID_ROLE');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      throw new AppError('Email already registered', 400, 'EMAIL_EXISTS');
    }

    const user = await User.create({
      fullName,
      email: email.toLowerCase().trim(),
      password,
      role: role || 'tenant',
      phoneNumber
    });

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        refreshToken,
        user: user.toJSON()
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: user.toJSON()
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'MISSING_TOKEN');
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired refresh token', 401, 'INVALID_TOKEN'));
    }
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: { user: user.toJSON() }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { fullName, phoneNumber, profileImage } = req.body;

    const updateFields = {};
    if (fullName !== undefined) updateFields.fullName = fullName;
    if (phoneNumber !== undefined) updateFields.phoneNumber = phoneNumber;
    if (profileImage !== undefined) updateFields.profileImage = profileImage;

    if (Object.keys(updateFields).length === 0) {
      throw new AppError('No fields to update', 400, 'NO_UPDATE_FIELDS');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: user.toJSON() }
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400, 'MISSING_FIELDS');
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400, 'WEAK_PASSWORD');
    }

    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from current password', 400, 'SAME_PASSWORD');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    user.password = newPassword;
    await user.save();

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Password changed successfully',
      data: { token }
    });
  } catch (error) {
    next(error);
  }
};
