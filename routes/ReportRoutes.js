const express = require("express");
const { userAuth, checkAdmin } = require("../MiddleWare/authProtect");
const {
  createReport,
  getReports,
  getReportById,
  getReportStats,
} = require("../controllers/ReportController");

const ReportRoute = express.Router();

const blocked = (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      "This action is disabled in the demo portfolio version. Backend is in Read-Only Mode.",
  });
};

// Create
ReportRoute.post("/", userAuth, createReport);

// Read
ReportRoute.get("/", userAuth, checkAdmin, getReports);
ReportRoute.get("/stats", userAuth, checkAdmin, getReportStats);
ReportRoute.get("/:id", userAuth, checkAdmin, getReportById);

// ------------------------------
// BLOCKED ROUTES (portfolio mode)
// ------------------------------

ReportRoute.put("/:id", blocked);

ReportRoute.delete("/:id", blocked);

module.exports = ReportRoute;
