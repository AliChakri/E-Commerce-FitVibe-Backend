const mongoose = require("mongoose");
const Report = require("../models/report");
const Order = require("../models/order");
const Product = require("../models/product");
const Notification = require("../models/notification");

/**
 * Utility: Verify that the target entity exists in the database
 */
const verifyTargetExists = async (type, targetId) => {
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    return { exists: false, error: "Invalid ID format" };
  }

  try {
    switch (type) {
      case "review": {
        const product = await Product.findOne({
          "reviews._id": targetId,
        }).select("_id");
        return { exists: !!product, error: product ? null : "Review not found" };
      }
      
      case "reply": {
        const product = await Product.findOne({
          "reviews.replies._id": targetId,
        }).select("_id");
        return { exists: !!product, error: product ? null : "Reply not found" };
      }
      
      case "order": {
        const order = await Order.exists({ _id: targetId });
        return { exists: !!order, error: order ? null : "Order not found" };
      }
      
      case "product": {
        const product = await Product.exists({ _id: targetId });
        return { exists: !!product, error: product ? null : "Product not found" };
      }
      
      default:
        return { exists: true, error: null };
    }
  } catch (err) {
    console.error(`Error verifying ${type}:`, err);
    return { exists: false, error: "Database verification failed" };
  }
};

/**
 * Rate limiting check: Prevent spam reports
 */
const checkRateLimit = async (userId, limit = 5, windowMinutes = 60) => {
  const timeWindow = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const recentReports = await Report.countDocuments({
    user: userId,
    createdAt: { $gte: timeWindow },
  });

  return {
    allowed: recentReports < limit,
    remaining: Math.max(0, limit - recentReports),
    resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
  };
};

/**
 * Check for duplicate unresolved reports
 */
const checkDuplicateReport = async (userId, type, targetId) => {
  const query = {
    user: userId,
    type,
    status: { $in: ["open", "in-progress"] },
  };

  // For system reports, check if user has any open system report
  if (type === "system") {
    query.targetId = null;
  } else if (targetId) {
    query.targetId = targetId;
  }

  const existingReport = await Report.findOne(query);
  return existingReport;
};

/**
 * CREATE REPORT
 * Handles all 5 report types with proper validation
 */
const createReport = async (req, res) => {
  try {
    const { type, targetId, reason, message, severity } = req.body;
    const userId = req.user?._id;
    const io = req.app.get("io");

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "Authentication required to submit a report" 
      });
    }

    const validTypes = ["review", "reply", "product", "order", "system"];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid report type. Allowed: review, reply, product, order, system" 
      });
    }

    const validSeverities = ["low", "medium", "high", "critical"];
    if (severity && !validSeverities.includes(severity)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid severity. Allowed: low, medium, high, critical" 
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Report reason is required" 
      });
    }

    let finalTargetId = null;

    if (type === "system") {
      finalTargetId = null;
    } else {
      if (!targetId) {
        return res.status(400).json({ 
          success: false,
          message: `Target ID is required for ${type} reports` 
        });
      }

      const verification = await verifyTargetExists(type, targetId);
      if (!verification.exists) {
        return res.status(404).json({ 
          success: false,
          message: verification.error || `${type} not found` 
        });
      }

      finalTargetId = targetId;
    }

    // Rate limiting check
    const rateLimit = await checkRateLimit(userId, 5, 60);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        success: false,
        message: "Too many reports submitted. Please try again later.",
        retryAfter: rateLimit.resetAt,
      });
    }

    const duplicate = await checkDuplicateReport(userId, type, finalTargetId);
    if (duplicate) {
      return res.status(409).json({ 
        success: false,
        message: "You have already submitted a similar unresolved report",
        existingReportId: duplicate._id,
      });
    }

    const newReport = await Report.create({
      user: userId,
      type,
      targetId: finalTargetId,
      reason,
      message: message || "",
      severity: severity || "medium",
      status: "open",
    });

    await newReport.populate("user", "firstName lastName email avatar");

    const userNotif = await Notification.create({
      user: userId,
      title: "Report Submitted",
      message: "Your report has been successfully submitted. Our team will review it shortly.",
      type: "report",
      scope: "single",
    });

    io.to(userId.toString()).emit("new-notification", userNotif);

    return res.status(201).json({ 
      success: true,
      message: "Report submitted successfully",
      report: newReport,
      rateLimitRemaining: rateLimit.remaining,
    });

  } catch (err) {
    console.error(" Error creating report:", err);
    return res.status(500).json({ 
      success: false,
      message: "Server error while submitting report",
      error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
};

/**
 * GET ALL REPORTS (Admin only)
 * Supports filtering, pagination, and sorting
 */
const getReports = async (req, res) => {
  try {
    const { 
      type, 
      status, 
      severity, 
      page = 1, 
      limit = 20,
      sortBy = "createdAt",
      order = "desc"
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("user", "firstName lastName email")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      reports,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });

  } catch (err) {
    console.error(" Error fetching reports:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to load reports" 
    });
  }
};

/**
 * GET REPORT BY ID (Admin only)
 */
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid report ID" 
      });
    }

    const report = await Report.findById(id)
      .populate("user", "firstName lastName email");

    if (!report) {
      return res.status(404).json({ 
        success: false,
        message: "Report not found" 
      });
    }

    return res.json({ 
      success: true,
      report 
    });

  } catch (err) {
    console.error(" Error fetching report:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to load report" 
    });
  }
};

/**
 * UPDATE REPORT STATUS (Admin only)
 */
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNote, assignedTo } = req.body;
    const io = req.app.get("io");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid report ID" 
      });
    }

    const allowedStatuses = ["open", "in-progress", "resolved", "dismissed"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid status. Allowed: open, in-progress, resolved, dismissed" 
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (resolutionNote) updateData.resolutionNote = resolutionNote;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (status === "resolved" || status === "dismissed") {
      updateData.resolvedAt = new Date();
    }

    const updatedReport = await Report.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("user", "firstName lastName email");

    if (!updatedReport) {
      return res.status(404).json({ 
        success: false,
        message: "Report not found" 
      });
    }

    let notifMessage = "";

    switch (status) {
      case "in-progress":
        notifMessage = "Your report is currently being reviewed.";
        break;
      case "resolved":
        notifMessage = "Your report has been resolved.";
        break;
      case "dismissed":
        notifMessage = "Your report has been dismissed.";
        break;
      case "open":
        notifMessage = "Your report has been updated.";
        break;
      default:
        notifMessage = "Your report status has changed.";
    }

    const userNotif = await Notification.create({
      user: updatedReport?.user?._id,
      title: "Report Update",
      message: notifMessage,
      type: "report",
      scope: "single",
    });

    io.to(updatedReport.user._id.toString()).emit("new-notification", userNotif);

    return res.json({ 
      success: true,
      message: "Report updated successfully",
      report: updatedReport 
    });

  } catch (err) {
    console.error(" Error updating report:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to update report" 
    });
  }
};

/**
 * DELETE REPORT (Admin only)
 */
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid report ID" 
      });
    }

    const deletedReport = await Report.findByIdAndDelete(id);

    if (!deletedReport) {
      return res.status(404).json({ 
        success: false,
        message: "Report not found" 
      });
    }

    return res.json({ 
      success: true,
      message: "Report deleted successfully",
      deletedReportId: id
    });

  } catch (err) {
    console.error(" Error deleting report:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to delete report" 
    });
  }
};

/**
 * GET REPORT STATISTICS (Admin only)
 */
const getReportStats = async (req, res) => {
  try {
    const stats = await Report.aggregate([
      {
        $facet: {
          byType: [
            { $group: { _id: "$type", count: { $sum: 1 } } }
          ],
          byStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ],
          bySeverity: [
            { $group: { _id: "$severity", count: { $sum: 1 } } }
          ],
          total: [
            { $count: "count" }
          ],
          recentReports: [
            { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
            { $count: "count" }
          ]
        }
      }
    ]);

    return res.json({ 
      success: true,
      stats: stats[0]
    });

  } catch (err) {
    console.error(" Error fetching stats:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to load statistics" 
    });
  }
};

module.exports = {
  createReport,
  getReports,
  getReportById,
  updateReportStatus,
  deleteReport,
  getReportStats,
};