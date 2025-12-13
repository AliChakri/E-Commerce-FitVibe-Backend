const express = require("express");
const { userAuth, checkAdmin } = require("../MiddleWare/authProtect");
const { 
    createOrder, 
    getOrders, 
    updateOrderToPaid, 
    getOrder, 
    updateOrderDelivery, 
    createPayPalOrder, 
    capturePayPalOrder, 
    getOrderById, 
    getAllOrders, 
    getUsersOrders 
} = require("../controllers/OrderController");

const orderRoute = express.Router();


// -------------------------------------------------
// READ-ONLY ROUTES (ALLOWED IN PORTFOLIO MODE)
// -------------------------------------------------

// PayPal client ID
orderRoute.get('/paypal/config', (req, res) => {
    return res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

// Admin: Get all orders (read only)
orderRoute.get('/all', userAuth, checkAdmin, getAllOrders);

// Get logged-in user's orders (list)
orderRoute.get('/', userAuth, getOrders);


// Admin: Dashboard orders
orderRoute.get('/all', userAuth, checkAdmin, getUsersOrders);

// Get single order details
orderRoute.get('/:id', userAuth, getOrderById);


// -------------------------------------------------
// BLOCKED ROUTES FOR PORTFOLIO MODE
// -------------------------------------------------

const blocked = (req, res) => {
    return res.status(403).json({
        success: false,
        message: "This action is disabled in the demo portfolio version. Backend is in Read-Only Mode.",
    });
};


// PayPal actions
orderRoute.post('/:id/paypal/create', blocked);
orderRoute.post('/:id/paypal/capture', blocked);

// Create new order
orderRoute.post('/', blocked);

// Update order payment status
orderRoute.put('/:id/:select', blocked);

// Update order delivery status
orderRoute.put('/delivery/:id/:status', blocked);

// Old get order (duplicate)
orderRoute.get('/:id', userAuth, getOrder); // read only stays working


module.exports = orderRoute;
