const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const mongoose = require('mongoose');

const getDashboardStats = async (req, res) => {
  
  try {
    
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments()
    ]);

    // TOTAL REVENUE
    const revenueAgg = await Order.aggregate([
      {
        $match: { isPaid: true }
      },
      {
        $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } }
      }
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    return res.status(200).json({
      success: true,
      products: totalProducts,
      users: totalUsers,
      orders: totalOrders,
      revenue: totalRevenue
    });

  } catch (error) {
    console.log(error?.message);
    return res.status(500).json({ success: false, message: 'Something went wrong' })
  }
};

// Revenue per month (only paid orders)
const getRevenueStats = async () => {

  const result = await Order.aggregate([
    {
      $match: {
        isPaid: true,
        createdAt: { $type: "date" }
      }
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        total: { $sum: "$totalPrice" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    labels: result.map(r => `Month ${r._id}`),
    values: result.map(r => r.total),
  };

};

// Orders per month
const getOrdersStats = async () => {
  const result = await Order.aggregate([
    { $match: { createdAt: { $type: "date" } } },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    labels: result.map(r => `Month ${r._id}`),
    values: result.map(r => r.count),
  };
};

// Sales by category
const getCategoryStats = async () => {
  const result = await Order.aggregate([
    { $unwind: "$orderItems" },
    {
      $lookup: {
        from: "products",
        localField: "orderItems.product",
        foreignField: "_id",
        as: "productInfo",
      },
    },
    { $unwind: "$productInfo" },
    {
      $match: {
        "productInfo.category": { $exists: true, $ne: null, $ne: "" },
      },
    },
    {
      $group: {
        _id: "$productInfo.category",
        count: { $sum: "$orderItems.quantity" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return {
    labels: result.map(r => r._id),
    values: result.map(r => r.count),
  };
};

// User growth per month
const getUserGrowth = async () => {
  const result = await User.aggregate([
    { $match: { createdAt: { $type: "date" } } },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    labels: result.map(r => `Month ${r._id}`),
    values: result.map(r => r.count),
  };
};

// Top-selling products
const fetchTopSellingProducts = async (currentLang = "en") => {
  const topProducts = await Order.aggregate([
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.product",
        totalSold: { $sum: "$orderItems.quantity" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        name: `$product.name.${currentLang}`,
        image: { $arrayElemAt: ["$product.images", 0] },
        price: "$product.price",
        category: "$product.category",
        variants: "$product.variants",
        totalStock: {
          $sum: {
            $map: {
              input: "$product.variants",
              as: "v",
              in: "$$v.stock"
            }
          }
        },
        totalSold: 1,
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 },
  ]);

  return topProducts;
};

const getTopSellingProducts = async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const topProducts = await fetchTopSellingProducts(lang);
    res.status(200).json({ success: true, topProducts });
  } catch (error) {
    console.error("[Top Products Error]", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrderStatusDistribution = async () => {
  const result = await Order.aggregate([
    {
      $group: {
        _id: "$paymentResult.status",
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    labels: result.map(r => r._id || "Unknown"),
    values: result.map(r => r.count),
  };
};

const getAverageOrderValue = async () => {
  const avrg = await Order.aggregate([
    { $match: { isPaid: true, createdAt: { $type: "date" } } },
    {
      $group: {
        _id: { $month: "$createdAt" },
        totalRevenue: { $sum: "$totalPrice" },
        totalOrders: { $sum: 1 },
      },
    },
    {
      $project: {
        month: "$_id",
        aov: {
          $cond: [
            { $gt: ["$totalOrders", 0] },
            { $divide: ["$totalRevenue", "$totalOrders"] },
            0,
          ],
        },
      },
    },
    { $sort: { month: 1 } },
  ]);

  return {
    labels: avrg.map(r => `Month ${r.month}`),
    values: avrg.map(r => parseFloat(r.aov.toFixed(2))),
  };
};

const getBestCustomers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const pipeline = [
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: "$totalPrice" },
          ordersCount: { $sum: 1 },
          lastOrder: { $max: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          email: "$user.email",
          avatar: "$user.avatar",
          phone: "$user.phone",
          totalSpent: 1,
          ordersCount: 1,
          lastOrder: 1,
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: limit },
    ];

    const results = await Order.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching best customers:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Analytics controller
const getAnalytics = async (req, res) => {
  try {
    const [
      revenue,
      orders,
      salesByCategory,
      userGrowth,
      result,
      avrg,
      topProducts,
    ] = await Promise.all([
      getRevenueStats(),
      getOrdersStats(),
      getCategoryStats(),
      getUserGrowth(),
      getOrderStatusDistribution(),
      getAverageOrderValue(),
      fetchTopSellingProducts(),
    ]);

    res.json({
      revenue,
      orders,
      salesByCategory,
      userGrowth,
      orderStatus: result,
      averageOrderValue: avrg,
      topProducts,
    });
  } catch (err) {
    console.error("[Analytics Error]", err);
    res.status(500).json({ message: "Analytics error", error: err.message });
  }
};

module.exports = {
  getAnalytics,
  getTopSellingProducts,
  getDashboardStats,
  getBestCustomers
};
