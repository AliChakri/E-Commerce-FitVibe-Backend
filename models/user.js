
const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema({
  firstName: { 
    type: String, 
    required: [true, "First name is required"],
    trim: true,
    minlength: [2, "First name must be at least 2 characters"],
    maxlength: [50, "First name cannot exceed 50 characters"]
  },
  lastName: { 
    type: String, 
    required: [true, "Last name is required"],
    trim: true,
    minlength: [2, "Last name must be at least 2 characters"],
    maxlength: [50, "Last name cannot exceed 50 characters"]
  },
  
  dateOfBirth: {
    type: Date,
    required: [true, "Date of birth is required"],
    validate: {
      validator: function(value) {
        // User must be at least 13 years old
        const today = new Date();
        const birthDate = new Date(value);
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          return age - 1 >= 13;
        }
        return age >= 13;
      },
      message: "You must be at least 13 years old to register"
    }
  },
  
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Please provide a valid email address"
    ],
    // ADDED: Index for faster queries
    index: true
  },
  
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [8, "Password must be at least 8 characters"],
    select: false
  },
  
  avatar: {
    type: String,
    default: null,
    // Validation to ensure it's a URL or null
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Check if it's a valid URL or base64 image
        return /^(https?:\/\/.+|data:image\/.+)/.test(v);
      },
      message: "Avatar must be a valid URL or base64 image"
    }
  },
  
  address: {
    country: { 
      type: String, 
      trim: true,
      maxlength: [100, "Country name too long"]
    },
    city: { 
      type: String, 
      trim: true,
      maxlength: [100, "City name too long"]
    },
    postalCode: { 
      type: String, 
      trim: true,
      maxlength: [20, "Postal code too long"]
    },
    street: { 
      type: String, 
      trim: true,
      maxlength: [200, "Street address too long"]
    }
  },
  
  phone: {
    type: String,
    trim: true,
    // Phone validation
    match: [
      /^\+?[1-9]\d{1,14}$/,
      "Please provide a valid phone number"
    ],
    sparse: true
  },
  
  wishList: [
    { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product"
    }
  ],
  
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
  isVerified: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  role: {
    type: String,
    enum: {
      values: ["user", "admin", "moderator"],
      message: "{VALUE} is not a valid role"
    },
    default: "user",
    index: true
  },
  
  isBanned: { 
    type: Boolean, 
    default: false,
    index: true
  },
  
  banReason: {
    type: String,
    default: null,
    maxlength: [500, "Ban reason too long"]
  },
  
  lastLogin: { 
    type: Date, 
    default: null 
  },
  
  passwordResetToken: { 
    type: String, 
    default: null,
    select: false
  },
  
  passwordResetExpires: { 
    type: Date, 
    default: null,
    select: false
  },
  
  verificationToken: {
    type: String,
    default: null,
    select: false
  },
  
  verificationTokenExpires: {
    type: Date,
    default: null,
    select: false
  },
  
  refreshToken: {
    type: String,
    default: null,
    select: false
  },
  
  loginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  
  lockUntil: {
    type: Date,
    default: null,
    select: false
  }
  
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.verificationToken;
      delete ret.refreshToken;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.__v;
      return ret;
    }
  }
});

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  try {
    this.password = await bcryptjs.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

UserSchema.virtual("isLocked").get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcryptjs.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

UserSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

UserSchema.methods.createVerificationToken = function() {
  const verifyToken = crypto.randomBytes(32).toString("hex");
  
  this.verificationToken = crypto
    .createHash("sha256")
    .update(verifyToken)
    .digest("hex");
  
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  return verifyToken;
};

UserSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

UserSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ email }).select("+password +loginAttempts +lockUntil");
  
  if (!user) {
    throw new Error("Invalid credentials");
  }
  
  if (user.isLocked) {
    throw new Error("Account is temporarily locked due to too many failed login attempts. Try again later.");
  }
  
  if (user.isBanned) {
    throw new Error(`Account is banned. Reason: ${user.banReason || "Violation of terms"}`);
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    await user.incLoginAttempts();
    throw new Error("Invalid credentials");
  }
  
  if (user.loginAttempts > 0 || user.lockUntil) {
    await user.updateOne({
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 }
    });
  }
  
  return user;
};

UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ role: 1, isBanned: 1 });
UserSchema.index({ createdAt: -1 });

const User = mongoose.models.User || mongoose.model("User", UserSchema);

module.exports = User;
