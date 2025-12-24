
require("dotenv").config();
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../nodemailer');
const { 
    validateLogin, 
    validateRegister, 
    validateResetPassword, 
    validateChangePassword 
} = require("../MiddleWare/authValidators");

// ========================================
// HELPER FUNCTIONS
// ========================================

const createToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d"
    });
};

const setAuthCookie = (res, token) => {
    const isProduction = process.env.NODE_ENV === 'production' ? true : false;
    
    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'none'
    });
};

// ========================================
// REGISTER USER
// ========================================
const registerUser = async (req, res) => {

    const { firstName, lastName, email, password, dateOfBirth } = req.body;

    // Validate input
    const errors = validateRegister(firstName, lastName, email, password,dateOfBirth);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ success: false, errors });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User with this email already exists' 
            });
        }

        // Create user with new schema fields
        const newUser = new User({
            firstName,
            lastName,
            email,
            password,
            dateOfBirth,
            role: 'user'
        });

        // Generate verification token using model method
        const verificationToken = newUser.createVerificationToken();
        await newUser.save();

        // Send verification email
        const verificationUrl = `${process.env.URLRCT}/verify-email/${verificationToken}`;
        
        const mailOptions = {
            from: `"FitVibe Store" <${process.env.SMTP_USER}>`,
            to: newUser.email,
            subject: 'Verify Your Email Address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to FitVibe Store, ${firstName}!</h2>
                    <p>Thank you for registering. Please verify your email address to complete your registration.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" 
                           style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Verify Email
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        This link will expire in 24 hours.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If you didn't create an account, please ignore this email.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        return res.status(201).json({ 
            success: true,
            message: "Registration successful! Please check your email to verify your account.",
            user: {
                id: newUser._id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Registration failed. Please try again.' 
        });
    }
};

// ========================================
// VERIFY EMAIL
// ========================================
const verifyEmail = async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ 
            success: false, 
            message: 'Verification token is required' 
        });
    }

    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            verificationToken: hashedToken,
            verificationTokenExpires: { $gt: Date.now() }
        }).select('+verificationToken +verificationTokenExpires');

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired verification token' 
            });
        }

        // Mark user as verified
        user.isVerified = true;
        user.verificationToken = null;
        user.verificationTokenExpires = null;
        await user.save();

        // Send welcome email
        const mailOptions = {
            from: `"FitVibe Store" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Welcome to FitVibe Store!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome aboard, ${user.firstName}!</h2>
                    <p>Your email has been verified successfully!</p>
                    <p>Explore our latest collections and find your perfect fit.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.URLRCT}/home" 
                           style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Start Shopping
                        </a>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            success: true, 
            message: "Email verified successfully! You can now log in." 
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Email verification failed. Please try again.' 
        });
    }
};

// ========================================
// LOGIN USER
// ========================================
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    const errors = validateLogin(email, password);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ success: false, errors });
    }

    try {
        // Use the static method from model that handles all security checks
        const user = await User.findByCredentials(email, password);

        if (user.email.includes('deleted_')) {
            return res.status(400).json({ 
                success: false, 
                message: 'This account has been deleted'
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({ 
                success: false, 
                message: 'Please verify your email before logging in. Check your inbox.' 
            });
        }

        if (!user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Your account has been deactivated. Please contact support.' 
            });
        }

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        const token = createToken(user._id);

        setAuthCookie(res, token);

        // Return minimal user data
        return res.status(200).json({ 
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        
        // Handle specific error messages
        if (error.message.includes('locked')) {
            return res.status(423).json({ 
                success: false, 
                message: error.message 
            });
        }
        
        if (error.message.includes('banned')) {
            return res.status(403).json({ 
                success: false, 
                message: error.message 
            });
        }

        return res.status(401).json({ 
            success: false, 
            message: 'Invalid email or password' 
        });
    }
};

// ========================================
// FORGOT PASSWORD
// ========================================
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: 'Email is required' 
        });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            // Don't reveal if user exists
            return res.status(200).json({ 
                success: true, 
                message: 'If an account exists with this email, a password reset link has been sent.' 
            });
        }

        // Use model method to create reset token
        const resetToken = user.createPasswordResetToken();
        await user.save();

        const resetUrl = `${process.env.URLRCT}/reset-password/${resetToken}`;

        const mailOptions = {
            from: `"FitVibe Store" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Request</h2>
                    <p>Hi ${user.firstName},</p>
                    <p>You requested to reset your password. Click the button below to proceed:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background-color: #f44336; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        This link will expire in 10 minutes.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        If you didn't request this, please ignore this email and your password will remain unchanged.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ 
            success: true, 
            message: 'If an account exists with this email, a password reset link has been sent.' 
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to process password reset request. Please try again.' 
        });
    }
};

// ========================================
// RESET PASSWORD
// ========================================
const resetPassword = async (req, res) => {
    const { password } = req.body;
    const { token } = req.params;

    // Validate password
    const errors = validateResetPassword(password);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ success: false, errors });
    }

    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        }).select('+passwordResetToken +passwordResetExpires');

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired reset token' 
            });
        }

        // Set new password (will be hashed by pre-save hook)
        user.password = password;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();

        // Send confirmation email
        const mailOptions = {
            from: `"FitVibe Store" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Password Reset Successful',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Changed Successfully</h2>
                    <p>Hi ${user.firstName},</p>
                    <p>Your password has been changed successfully.</p>
                    <p style="color: #f44336; font-weight: bold;">
                        If you didn't make this change, please contact support immediately.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.URLRCT}/login" 
                           style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Login to Your Account
                        </a>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ 
            success: true, 
            message: 'Password reset successfully. You can now log in with your new password.' 
        });

    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to reset password. Please try again.' 
        });
    }
};

// ========================================
// CHANGE PASSWORD (Logged In)
// ========================================
const changePassword = async (req, res) => {
    const user = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: 'Both old and new passwords are required' 
        });
    }

    const errors = validateChangePassword(newPassword);
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ success: false, errors });
    }

    try {
        const foundUser = await User.findById(user._id).select('+password');

        if (!foundUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Verify old password
        const isMatched = await foundUser.comparePassword(oldPassword);

        if (!isMatched) {
            return res.status(400).json({ 
                success: false, 
                message: 'Current password is incorrect' 
            });
        }

        // Check if new password is same as old
        const isSamePassword = await foundUser.comparePassword(newPassword);
        if (isSamePassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'New password must be different from old password' 
            });
        }

        // Set new password (will be hashed by pre-save hook)
        foundUser.password = newPassword;
        await foundUser.save();

        res.clearCookie('token');

        // Send notification email
        const mailOptions = {
            from: `"FitVibe Store" <${process.env.SMTP_USER}>`,
            to: foundUser.email,
            subject: 'Password Changed',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Changed</h2>
                    <p>Hi ${foundUser.firstName},</p>
                    <p>Your password was changed successfully.</p>
                    <p style="color: #f44336; font-weight: bold;">
                        If you didn't make this change, please contact support immediately.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ 
            success: true, 
            message: 'Password changed successfully. Please log in again.' 
        });

    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to change password. Please try again.' 
        });
    }
};

// ========================================
// LOGOUT
// ========================================
const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            sameSite: 'none'
        });

        return res.status(200).json({ 
            success: true, 
            message: 'Logged out successfully' 
        });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Logout failed. Please try again.' 
        });
    }
};

// ========================================
// GET ALL USERS (Admin Only)
// ========================================
const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const filter = {};
        
        if (req.query.role) filter.role = req.query.role;
        if (req.query.isVerified !== undefined) filter.isVerified = req.query.isVerified === 'true';
        if (req.query.isBanned !== undefined) filter.isBanned = req.query.isBanned === 'true';

        const users = await User.find(filter)
            .select('-password -refreshToken -passwordResetToken')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments(filter);

        return res.status(200).json({ 
            success: true,
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
                hasMore: skip + users.length < total
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch users' 
        });
    }
};

// ========================================
// GET CURRENT USER (Me)
// ========================================
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        return res.status(200).json({ 
            success: true,
            user
        });

    } catch (error) {
        console.error('Get current user error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch user data' 
        });
    }
};

module.exports = {
    registerUser,
    verifyEmail,
    loginUser,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    getUsers,
    getCurrentUser, 
};