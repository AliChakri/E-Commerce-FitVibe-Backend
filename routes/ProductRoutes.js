require('dotenv').config()
const express = require("express");
const productRoute = express.Router();

const { 
  getProducts, 
  getProduct,
  suggestedProducts,
  searchProduct,
  getProductReviews,
  createProduct,
  editProduct,
  deleteProduct,
  likeProduct,
  addReview,
  editReview,
  likeReview,
  editReply,
  deleteReply,
  likeReply,
  deleteReview,
  addReply
} = require("../controllers/ProductController");

const { userAuth, checkAdmin } = require("../MiddleWare/authProtect");


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
productRoute.post('/add', userAuth, checkAdmin, createProduct);

// Edit Product
productRoute.put('/edit/:id', userAuth, checkAdmin, editProduct);

// Delete Product
productRoute.delete('/delete/:id', userAuth, checkAdmin, deleteProduct);


// ------------------ LIKES ------------------ //

productRoute.post('/like/:id', userAuth, likeProduct);


// ------------------ REVIEWS ------------------ //

// Add review
productRoute.post('/:id/reviews', userAuth, addReview);

// Edit review
productRoute.put('/:id/reviews', userAuth, editReview);

// Delete review
productRoute.delete('/:productId/reviews/:reviewId', userAuth, deleteReview);

// Like/unlike review
productRoute.put('/:id/reviews/:reviewId/like', userAuth, likeReview);


// ------------------ REPLIES ------------------ //

// Add reply
productRoute.post("/:productId/reviews/:reviewId/replies", userAuth, addReply);

// Edit reply
productRoute.put("/:productId/reviews/:reviewId/replies/:replyId", userAuth, editReply);

// Delete reply
productRoute.delete("/:productId/reviews/:reviewId/replies/:replyId", userAuth, deleteReply);

// Like reply
productRoute.post("/:productId/reviews/:reviewId/replies/:replyId/like", userAuth, likeReply);


module.exports = productRoute;
