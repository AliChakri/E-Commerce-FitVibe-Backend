const express = require("express");
const {
  registerUser,
  verifyEmail,
  loginUser,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getUsers,
  getCurrentUser
} = require("../controllers/AuthController");

const {
  checkUser,
  userAuth,
  checkAdmin,
  checkVerified,
  userRateLimit
} = require("../MiddleWare/authProtect");

const authRouter = express.Router();


// -------------------------------------------------
// BLOCKED ROUTES (PORTFOLIO MODE)
// -------------------------------------------------

const blocked = (req, res) => {
  return res.status(403).json({
    success: false,
    message: "This action is disabled in the demo portfolio version. Backend is in Read-Only Mode.",
  });
};

// -------------------------------------------------
// PUBLIC ROUTES
// -------------------------------------------------

// Registration
authRouter.post('/signup', userRateLimit(3, 10 * 60 * 1000), registerUser);

// Email verification
authRouter.get('/verify-email/:token', userRateLimit(5, 10 * 60 * 1000),verifyEmail);

// Login
authRouter.post('/login', userRateLimit(5, 10 * 60 * 1000), loginUser);

// Forgot / reset password (BLOCKED)
authRouter.post('/forgot-password', userRateLimit(5, 10 * 60 * 1000),userAuth, forgotPassword);
authRouter.post('/reset-password/:token', userRateLimit(5, 10 * 60 * 1000),userAuth, resetPassword);

// Check user (optional)
authRouter.get('/check-user', checkUser);

// -------------------------------------------------
// PROTECTED ROUTES
// -------------------------------------------------

// Current user
authRouter.get('/me', userAuth, getCurrentUser);

// Change password (BLOCKED)
authRouter.post(
  '/change-password',
  changePassword
);

// Logout
authRouter.post('/logout', userRateLimit(5, 10 * 60 * 1000),userAuth, logout);

// Check admin role
authRouter.get('/check-admin', userAuth, checkAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: "User is admin",
    user: {
      id: req.user._id,
      role: req.user.role
    }
  });
});

// Admin: list users
authRouter.get('/users', userAuth, checkAdmin, getUsers);


module.exports = authRouter;
