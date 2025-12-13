require('dotenv').config()
const express = require("express");
const productRoute = express.Router();

const { 
  getProducts, 
  getProduct,
  suggestedProducts,
  searchProduct,
  getProductReviews
} = require("../controllers/ProductController");

const { userAuth } = require("../MiddleWare/authProtect");


// -------------------------------------------------
//  READ-ONLY ROUTES (ALLOWED IN PORTFOLIO MODE)
// -------------------------------------------------

// Get ALL PRODUCTS
productRoute.get('/', getProducts);

// Search products
productRoute.get('/search', searchProduct);

// Get single product
productRoute.get('/:id', getProduct);

// Suggested products
productRoute.get('/:productId/suggestions', suggestedProducts);

// Get reviews
productRoute.get('/:id/reviews', getProductReviews);



// -------------------------------------------------
//  BLOCKED ROUTES FOR PORTFOLIO (SAFE MODE)
// -------------------------------------------------

// Reusable blocked response
const blocked = (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      "This action is disabled in the demo portfolio version. Backend is in Read-Only Mode.",
  });
};


// ------------------ PRODUCT MODIFICATIONS ------------------ //

// Create Product
productRoute.post('/add', blocked);

// Edit Product
productRoute.put('/edit/:id', blocked);

// Delete Product
productRoute.delete('/delete/:id', blocked);


// ------------------ LIKES ------------------ //

productRoute.post('/like/:id', blocked);


// ------------------ REVIEWS ------------------ //

// Add review
productRoute.post('/:id/reviews', blocked);

// Edit review
productRoute.put('/:id/reviews', blocked);

// Delete review
productRoute.delete('/:productId/reviews/:reviewId', blocked);

// Like/unlike review
productRoute.put('/:id/reviews/:reviewId/like', blocked);


// ------------------ REPLIES ------------------ //

// Add reply
productRoute.post("/:productId/reviews/:reviewId/replies", blocked);

// Edit reply
productRoute.put("/:productId/reviews/:reviewId/replies/:replyId", blocked);

// Delete reply
productRoute.delete("/:productId/reviews/:reviewId/replies/:replyId", blocked);

// Like reply
productRoute.post("/:productId/reviews/:reviewId/replies/:replyId/like", blocked);


module.exports = productRoute;
