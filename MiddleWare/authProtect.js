require('dotenv').config();
const jwt = require("jsonwebtoken");
const User = require('../models/user');

// ========================================
// PROTECT ROUTES - USER AUTHENTICATION
// ========================================
/**
 * FIXED: Uses single token instead of accessToken/refreshToken
 */
const userAuth = async (req, res, next) => {
    try {
        let token = req.cookies.token;
        
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required. Please log in.',
                code: 'NO_TOKEN'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not found. Please log in again.',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if user is banned
        if (user.isBanned) {
            return res.status(403).json({ 
                success: false, 
                message: `Your account has been banned. Reason: ${user.banReason || 'Terms violation'}`,
                code: 'USER_BANNED'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Your account has been deactivated. Please contact support.',
                code: 'USER_INACTIVE'
            });
        }

        // Attach user to request object
        req.user = user;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Your session has expired. Please log in again.',
                code: 'TOKEN_EXPIRED'
                // REMOVED: shouldRefresh (no refresh token in simple JWT)
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid authentication token. Please log in again.',
                code: 'INVALID_TOKEN'
            });
        }

        // Generic error
        console.error('Auth middleware error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication failed. Please log in again.',
            code: 'AUTH_FAILED'
        });
    }
};

// ========================================
// CHECK USER - OPTIONAL AUTHENTICATION
// ========================================
/**
 * Doesn't block request if no token
 * Used for routes that work with or without login
 */
const checkUser = async (req, res, next) => {
    try {
        let token = req.cookies.token;
        
        if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            req.user = null;
            return next ? next() : res.json({ user: null });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.isActive || user.isBanned) {
            req.user = null;
            return next ? next() : res.json({ user: null });
        }

        req.user = user;
        
        if (next) {
            return next();
        }

        return res.json({ 
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
        // Don't throw error, just continue without user
        req.user = null;
        return next ? next() : res.json({ user: null });
    }
};

// ========================================
// CHECK ADMIN - ROLE-BASED AUTHORIZATION
// ========================================
const checkAdmin = (req, res, next) => {
    const user = req.user;

    if (!user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required. Please log in.',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (user.role === 'admin') {
        return next();
    }

    return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Administrator privileges required.',
        code: 'INSUFFICIENT_PERMISSIONS'
    });
};

// ========================================
// CHECK MODERATOR OR ADMIN
// ========================================
const checkModerator = (req, res, next) => {
    const user = req.user;

    if (!user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required. Please log in.',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (user.role === 'admin' || user.role === 'moderator') {
        return next();
    }

    return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Moderator or administrator privileges required.',
        code: 'INSUFFICIENT_PERMISSIONS'
    });
};

// ========================================
// CHECK SPECIFIC ROLES (FLEXIBLE)
// ========================================
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (allowedRoles.includes(user.role)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    };
};

// ========================================
// CHECK VERIFIED EMAIL
// ========================================
const checkVerified = (req, res, next) => {
    const user = req.user;

    if (!user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required. Please log in.',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (!user.isVerified) {
        return res.status(403).json({ 
            success: false, 
            message: 'Please verify your email address to access this resource.',
            code: 'EMAIL_NOT_VERIFIED'
        });
    }

    next();
};

// ========================================
// CHECK SELF OR ADMIN
// ========================================
const checkSelfOrAdmin = (req, res, next) => {
    const user = req.user;
    const targetUserId = req.params.id || req.params.userId;

    if (!user) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required. Please log in.',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (user.role === 'admin' || user._id.toString() === targetUserId) {
        return next();
    }

    return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access your own data.',
        code: 'INSUFFICIENT_PERMISSIONS'
    });
};

// ========================================
// RATE LIMIT BY USER
// ========================================
/**
 * Tracks requests per user (prevents abuse)
 * Simple in-memory implementation (use Redis in production)
 */
const userRateLimitStore = new Map();

const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    return (req, res, next) => {
        const user = req.user;

        if (!user) {
            return next();
        }

        const userId = user._id.toString();
        const now = Date.now();

        if (!userRateLimitStore.has(userId)) {
            userRateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const userLimit = userRateLimitStore.get(userId);

        if (now > userLimit.resetTime) {
            userRateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
            return next();
        }

        if (userLimit.count >= maxRequests) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
            });
        }

        userLimit.count++;
        userRateLimitStore.set(userId, userLimit);
        next();
    };
};

module.exports = {
    userAuth,          
    checkUser,      
    checkAdmin, 
    checkModerator, 
    checkRole,  
    checkVerified,  
    checkSelfOrAdmin,
    userRateLimit   
};