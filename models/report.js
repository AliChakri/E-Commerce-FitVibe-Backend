const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    // ========== USER WHO SUBMITTED ==========
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // For faster queries
    },

    // ========== REPORT TYPE ==========
    type: {
      type: String,
      enum: ["review", "reply", "product", "order", "system"],
      required: true,
      index: true,
    },

    // ========== TARGET ID (nullable for system reports) ==========
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // null for "system" type
      // Not using refPath since reviews/replies are embedded in Product
    },

    // ========== REASON FOR REPORT ==========
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // ========== ADDITIONAL MESSAGE ==========
    message: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // ========== SEVERITY LEVEL ==========
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },

    // ========== STATUS ==========
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "dismissed"],
      default: "open",
      index: true,
    },

    // ========== RESOLUTION NOTE (Admin use) ==========
    resolutionNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // ========== ASSIGNED ADMIN ==========
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ========== RESOLUTION TIMESTAMP ==========
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// ========== INDEXES FOR PERFORMANCE ==========
reportSchema.index({ user: 1, createdAt: -1 });
reportSchema.index({ type: 1, status: 1 });
reportSchema.index({ createdAt: -1 });

// ========== VIRTUAL FOR TIME SINCE CREATION ==========
reportSchema.virtual("timeSinceCreation").get(function () {
  const now = new Date();
  const diff = now - this.createdAt;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// ========== METHODS ==========

// Check if report is resolved
reportSchema.methods.isResolved = function () {
  return this.status === "resolved" || this.status === "dismissed";
};

// Mark as resolved
reportSchema.methods.resolve = async function (resolutionNote = "") {
  this.status = "resolved";
  this.resolvedAt = new Date();
  if (resolutionNote) this.resolutionNote = resolutionNote;
  return await this.save();
};

// Mark as dismissed
reportSchema.methods.dismiss = async function (resolutionNote = "") {
  this.status = "dismissed";
  this.resolvedAt = new Date();
  if (resolutionNote) this.resolutionNote = resolutionNote;
  return await this.save();
};

// ========== STATIC METHODS ==========

// Get reports by type
reportSchema.statics.getByType = function (type) {
  return this.find({ type }).populate("user", "firstName lastName email");
};

// Get open reports
reportSchema.statics.getOpenReports = function () {
  return this.find({ status: "open" })
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 });
};

// Get user's reports
reportSchema.statics.getUserReports = function (userId) {
  return this.find({ user: userId }).sort({ createdAt: -1 });
};

// ========== PRE-SAVE MIDDLEWARE ==========
reportSchema.pre("save", function (next) {
  // Ensure system reports don't have targetId
  if (this.type === "system" && this.targetId) {
    this.targetId = null;
  }
  next();
});

// ========== ENSURE SINGLE MODEL INSTANCE ==========
const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);

module.exports = Report;