const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema({
  size: { type: String, required: true },
  color: { type: String, required: true },
  stock: { type: Number, required: true, min: 0 },
});

// Reply Schema
const ReplySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    comment: { type: String, trim: true, maxlength: 1000, required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reports: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reason: { 
          type: String,
          enum: ["Spam", "Offensive", "Misleading", "Other"],
          required: true,
        },
        comment: { type: String, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Review Schema
const ReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, trim: true, maxlength: 2000 },
    images: { type: [String], default: [] },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reports: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reason: {
          type: String,
          enum: ["Spam", "Offensive", "Misleading", "Other"],
          required: true,
        },
        comment: { type: String, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // one-level replies
    replies: [ReplySchema],
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: true },
      fr: { type: String, required: true },
      ar: { type: String, required: true },
    },

    description: {
      en: { type: String },
      fr: { type: String },
      ar: { type: String },
    },

    brand: { type: String },
     
    category: {
      type: String,
      enum: ["shirts", "pants", "jeans", "jackets", "shoes", "hoodies"],
      required: true
    },

    price: { type: Number, required: true },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    images: { type: [String], required: true },

    variants: [VariantSchema],

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    reviews: [ReviewSchema],
    averageRating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Helper to recalc avg & count
ProductSchema.methods.recalculateRating = function () {
  const total = this.reviews.length;
  if (!total) {
    this.averageRating = 0;
    this.reviewsCount = 0;
    return;
  }
  const sum = this.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  this.averageRating = Math.round((sum / total) * 10) / 10; // 1 decimal
  this.reviewsCount = total;
};

module.exports =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);
