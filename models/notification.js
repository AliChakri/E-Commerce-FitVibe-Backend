
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ["order", "discount", "system", "report", "promo", "cart", "like", "review", "reply"],
    default: "system"
  },
  image: { type: String },
  scope: {
    type: String,
    enum: ["single", "global"],
    default: "single"
  },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });


const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

module.exports = Notification;
