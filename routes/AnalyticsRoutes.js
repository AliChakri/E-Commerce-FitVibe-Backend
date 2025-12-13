
const express = require('express');
const { getAnalytics, getTopSellingProducts, getDashboardStats, getBestCustomers } = require('../controllers/AnalyticsController');
const { userAuth, checkAdmin } = require('../MiddleWare/authProtect');
const analyticsRoutes = express.Router();

analyticsRoutes.get('/', getAnalytics);
analyticsRoutes.get('/top-products', getTopSellingProducts);
analyticsRoutes.get('/dashboard', userAuth, checkAdmin, getDashboardStats);
analyticsRoutes.get('/customers/best', userAuth, checkAdmin, getBestCustomers);


module.exports = analyticsRoutes;
