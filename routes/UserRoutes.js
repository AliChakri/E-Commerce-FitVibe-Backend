const express = require('express');
const { userAuth, checkAdmin } = require('../MiddleWare/authProtect');
const { 
  getProfile, 
  updateName, 
  updateAddress, 
  updateAvatar, 
  getWishlist, 
  addWishList, 
  removeFromWishList, 
  banUser, 
  deleteUser, 
  changeRole, 
  userDetails 
} = require('../controllers/UserController');

const upload = require("../MiddleWare/upload");

const UserRoute = express.Router();


// -------------------------------------------------
// READ-ONLY ROUTES (ALLOWED IN PORTFOLIO MODE)
// -------------------------------------------------

// User Profile (read only)
UserRoute.get('/me', userAuth, getProfile);

// Wishlist (read only)
UserRoute.get('/me/wishlist', userAuth, getWishlist);



// -------------------------------------------------
// BLOCKED ROUTES FOR PORTFOLIO (SAFE MODE)
// -------------------------------------------------

const blocked = (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      "This action is disabled in the demo portfolio version. Backend is in Read-Only Mode.",
  });
};


// ------------------ USER PROFILE EDITS ------------------ //

UserRoute.put('/me/name', userAuth, updateName);
UserRoute.put('/me/avatar', userAuth, updateAvatar);
UserRoute.put('/me/address', userAuth, updateAddress);


// ------------------ WISHLIST ACTIONS ------------------ //

UserRoute.post('/me/wishlist/add/:productId', userAuth, addWishList);
UserRoute.delete('/me/wishlist/remove/:productId', userAuth, removeFromWishList);


// ------------------ ADMIN ACTIONS ------------------ //

UserRoute.post('/ban/:id', userAuth, checkAdmin, banUser);
UserRoute.delete('/delete/:id', userAuth, checkAdmin, deleteUser);
UserRoute.post('/role/:id', userAuth, checkAdmin, changeRole);
UserRoute.post('/details/:id', userAuth, checkAdmin, userDetails);



module.exports = UserRoute;
