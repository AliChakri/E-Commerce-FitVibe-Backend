const express = require("express");
const {
  createNotification,
  getUserNotifications,
  markAsRead,
  deleteNotification
} = require("../controllers/NotificationController");

const NotificationRoutes = express.Router();

// ------------------------------------------------------------
// CREATE NOTIFICATION (single, user-specific, global, broadcast)
// ------------------------------------------------------------
NotificationRoutes.post("/", createNotification);

// ------------------------------------------------------------
// GET USER NOTIFICATIONS
// ------------------------------------------------------------
NotificationRoutes.get("/user/:userId", getUserNotifications);

// ------------------------------------------------------------
// MARK AS READ
// ------------------------------------------------------------
NotificationRoutes.patch("/read/:id", markAsRead);

// ------------------------------------------------------------
// DELETE NOTIFICATION
// ------------------------------------------------------------
NotificationRoutes.delete("/:id", deleteNotification);

module.exports = NotificationRoutes;
