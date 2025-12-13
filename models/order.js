const mongoose = require("mongoose");
const Product = require("./product"); // <-- Make sure this path is correct

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        size: { type: String },
        color: { type: String },
      },
    ],

    totalPrice: {
      type: Number,
      required: true,
    },

    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },

    isPaid: {
      type: Boolean,
      default: false,
    },

    paidAt: {
      type: Date,
    },

    paypalID: {
      type: String,
    },

    delivery: {
      type: String,
      enum: ["processing", "shipped", "in transit", "delivered", "cancelled"],
      default: "processing",
      required: true,
    },

    paymentResult: {
      transactionId: { type: String },
      status: { type: String },
      email: { type: String },
    },
  },
  { timestamps: true }
);

/* -----------------------------------------------------------
   🔥 MIDDLEWARE: Apply product discount & recalculate total
----------------------------------------------------------- */
OrderSchema.pre("save", async function (next) {
  if (!this.isModified("orderItems")) return next();

  let newTotal = 0;

  // Loop through order items
  for (let item of this.orderItems) {
    const product = await Product.findById(item.product);

    if (!product) continue;

    // Base price
    let finalPrice = product.price;

    // If product has a discount
    if (product?.discount && product.discount?.percentage > 0) {
      const discountAmount = (product.discount.percentage / 100) * product.price;
      finalPrice = product.price - discountAmount;
    }

    // Update the item's price to reflect discount
    item.price = Number(finalPrice.toFixed(2));

    // Add to total
    newTotal += item.price * item.quantity;
  }

  this.totalPrice = Number(newTotal.toFixed(2));

  next();
});

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

module.exports = Order;
