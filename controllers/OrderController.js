require('dotenv').config();
const express = require('express');
const Order = require('../models/order');
const mongoose = require("mongoose");

const axios = require('axios');
const { getPayPalAccessToken } = require('../utils/paypal');
const Product = require('../models/product');
const Notification = require('../models/notification');

const createPayPalOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("orderItems.product");
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Validate total
    const total = order.orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (Number(total.toFixed(2)) !== Number(order.totalPrice.toFixed(2))) {
      return res.status(400).json({ message: "Price mismatch" });
    }

    // Create PayPal order
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${process.env.PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: total.toFixed(2),
            },
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("PayPal create error:", data);
      return res.status(400).json(data);
    }

    // Save PayPal order ID to DB
    order.paymentResult = { paypalOrderId: data.id, status: "pending" };
    await order.save();

    res.json({ id: data.id, order });
  } catch (error) {
    console.error("Server error in create:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const capturePayPalOrder = async (req, res) => {
  try {
    const { orderID } = req.body; // PayPal order ID
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const accessToken = await getPayPalAccessToken();

    // Capture payment in PayPal
    const response = await fetch(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("PayPal capture error:", data);
      return res.status(400).json(data);
    }

    // Extract capture details properly
    const capture =
      data.purchase_units?.[0]?.payments?.captures?.[0] || null;

    if (!capture) {
      return res.status(400).json({ message: "No capture details from PayPal" });
    }

    // Update DB order status
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      paypalOrderId: orderID,
      transactionId: capture.id,
      status: "paid",
      email: data.payer?.email_address || "",
    };

    await order.save();

    const io = req.app.get("io");
    const notification = await Notification.create({
      user: order.user,
      type: "order",
      title: "Payment Successful",
      message: `Your payment for order #${order._id} has been processed successfully.`,
      order: order._id,
    });

    io.to(order.user.toString()).emit("new-notification", notification);

    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error("Server error in capture:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Create DB Order (pending, unpaid)
const createOrder = async (req, res) => {
  const { orderItems, totalPrice, shippingAddress } = req.body;
  const lang = req.query.lang || "en";

  if (!orderItems || orderItems.length === 0 || !shippingAddress) {
    return res.status(400).json({ success: false, message: 'Order items required' });
  }

  try {
    const order = new Order({
      user: req.user._id,
      orderItems,
      totalPrice,
      isPaid: false,
      paymentResult: { status: "pending" },
      shippingAddress: req.user?.address
    });

    let createdOrder = await order.save();

    createdOrder = await Order.findById(createdOrder._id).populate("orderItems.product");
    createdOrder = createdOrder.toObject();

    createdOrder.orderItems = createdOrder.orderItems.map(item => {
      if (item.product) {
        item.product = {
          ...item.product,
          name: item.product.name?.[lang] || item.product.name?.en,
          images: item.product.images,
          description: item.product.description?.[lang] || item.product.description?.en,
          category: item.product.category?.[lang] || item.product.category?.en,
        };
      }
      return item;
    });

    return res.status(201).json({
      success: true,
      message: "Order created, awaiting PayPal payment",
      order: createdOrder
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOrders = async (req, res) => {
  const lang = req.query.lang || "en";

  try {
    let userId = req.user._id;
    if (typeof userId === "string") {
      userId = new mongoose.Types.ObjectId(userId);
    }

    let orders = await Order.find({ user: userId })
      .populate("orderItems.product", "name description images price")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this user",
      });
    }

    orders = orders.map((order) => {
      const localizedItems = order.orderItems.map((item) => {
        const product = item.product;
        return {
          ...item,
          product: {
            ...product,
            name:
              typeof product.name === "string"
                ? product.name
                : product.name?.[lang] || product.name?.en,
            description:
              typeof product.description === "string"
                ? product.description
                : product.description?.[lang] || product.description?.en,
            images: product.images,
            price: product.price,
          },
        };
      });

      return {
        ...order,
        orderItems: localizedItems,
      };
    });

    return res.status(200).json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error in getOrders:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.user._id)
      .populate('orderItems.product', 'name price images');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "firstName lastName email")
      .populate("orderItems.product", "name price images");

    if (!order) return res.status(404).json({ message: "Order not found" });

    
    return res.json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateOrderToPaid = async (req, res) => {
  const { id, select } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentResult.status = select;

    if (select === 'pending' || select === 'paid') {
      order.isPaid = true;
      await order.save();
    }

    const io = req.app.get("io");
    const notification = await Notification.create({
      user: order?.user,
      type: "order",
      title: "Payment Status Updated",
      message: `Your order #${order._id} payment status is now: ${select}.`,
      order: order._id,
    });

    await order.save();

    io.to(order.user.toString()).emit("new-notification", notification);

    return res.status(200).json({ success: true, message: `Order marked as ${select}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrderDelivery = async (req, res) => {
  const { id, status } = req.params;

  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (status !== order.delivery) {
      order.delivery = status;
      await order.save();
    }

    await order.save();

    const io = req.app.get("io");
    const notification = await Notification.create({
      user: order.user,
      type: "order",
      title: "Delivery Status Updated",
      message: `Your order #${order._id} delivery status is now: ${status}.`,
      order: order._id,
    });

    io.to(order.user.toString()).emit("new-notification", notification);

    return res.status(200).json({ success: true, message: `Order marked as ${status}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { status, search, startDate, endDate, date, sort, delivery, page = 1, limit = 10 } = req.query;

    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const query = {};

    if (status) {
      query['paymentResult.status'] = status;
    }
    
    if (search) {
      query['paymentResult.email'] = { $regex: search, $options: 'i' };
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        query.createdAt = {
          $gte: start,
          $lte: end
        };
      } else {
        console.log(" Invalid date format");
      }
    }
    
    if (delivery) {
      query.delivery = delivery;
    }

    const pageNumber = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNumber - 1) * pageSize;

    const sortByLatest = date === 'false' || date === false;
    let sortOptions = { createdAt: sortByLatest ? -1 : 1 };

    if (sort === 'priceDesc') {
      sortOptions = { totalPrice: -1 };
    } else if (sort === 'priceAsc') {
      sortOptions = { totalPrice: 1 };
    }

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / pageSize);

    const orders = await Order.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name price images variants');

    const response = {
      success: true,
      orders,
      currentPage: pageNumber,
      totalPages,
      totalOrders,
      user: {
        id: user._id || user.id,
        email: user.email
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error(" FULL ERROR DETAILS ");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error(" END ERROR DETAILS ");
    
    // Specific error handling
    if (error.name === 'CastError') {
      console.log("CastError detected - Invalid ObjectId or query parameter");
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid query parameters',
        details: error.message
      });
    }

    if (error.name === 'ValidationError') {
      console.log(" ValidationError detected");
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        details: error.message
      });
    }

    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      console.log(" Database error detected");
      return res.status(500).json({ 
        success: false, 
        message: 'Database error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Database connection issue'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      errorType: error.name
    });
  }
};

const getUsersOrders = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const orders = await Order.find().sort({ createdAt: -1 });
      
      return res.status(200).json({
        success: true,
        orders: orders || [],
        totalOrders: orders.length || 0,
        user: {
          id: user._id || user.id,
          email: user.email
        }
      })

    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    createOrder,
    getOrders,
    getOrder,
  updateOrderToPaid,
    updateOrderDelivery,
    getAllOrders,
  createPayPalOrder,
  getOrderById,
  capturePayPalOrder,
    getUsersOrders
};


