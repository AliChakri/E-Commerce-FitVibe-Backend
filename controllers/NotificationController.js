const mongoose = require("mongoose");
const Notification = require("../models/notification");
const User = require("../models/user");

// ------------------------------------------------------------
// CREATE NOTIFICATION
// ------------------------------------------------------------
const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type = "system", scope = "single", image } = req.body;
    const io = req.app.get("io");

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    let notifications;

    // GLOBAL NOTIFICATION
    if (scope === "global") {
      const notification = await Notification.create({
        user: null,
        title,
        message,
        type,
        scope,
        image
      });

      io.emit("new-notification", notification);

      notifications = notification;
      return res.status(201).json({
        success: true,
        data: notification
      });
    }

    // SEND TO SPECIFIC USER
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid userId format" });
      }

      const notification = await Notification.create({
        user: new mongoose.Types.ObjectId(userId),
        title,
        message,
        type,
        scope: "single",
        image
      });

      io.to(userId).emit("new-notification", notification);

      notifications = notification;
      return res.status(201).json({
        success: true,
        data: notification
      });
    }

    // BROADCAST: SEND TO ALL USERS (separate notifications)
    const users = await User.find({}, "_id");

    if (users.length === 0) {
      return res.status(404).json({ error: "No users found" });
    }

    const bulkList = users.map((u) => ({
      user: u._id,
      title,
      message,
      type,
      scope: "single",
      image
    }));

    const created = await Notification.insertMany(bulkList);

    created.forEach((notif) => {
      io.to(notif.user.toString()).emit("new-notification", notif);
    });

    notifications = created;

    res.status(201).json({
      success: true,
      count: created.length,
      data: created
    });

  } catch (err) {
    console.error(" Error creating notification:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ------------------------------------------------------------
// GET NOTIFICATIONS FOR USER (INCLUDES GLOBAL)
// ------------------------------------------------------------
const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const notifications = await Notification.find({
      $or: [
        { user: userId },
        { scope: "global" }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(notifications);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------------------------------------------------
// MARK AS READ
// ------------------------------------------------------------
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const updated = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(updated);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------------------------------------------------
// DELETE NOTIFICATION
// ------------------------------------------------------------
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const deleted = await Notification.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({
      success: true,
      message: "Notification deleted",
      deleted
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ------------------------------------------------------------
module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  deleteNotification,
};
