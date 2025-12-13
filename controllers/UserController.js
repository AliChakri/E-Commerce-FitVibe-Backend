const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/user');
const { UploadStream } = require('cloudinary');
const Product = require('../models/product');
const Order = require('../models/order');
const Cart = require('../models/cart');
const { uploadToCloudinary, cleanupCloudinaryImages } = require('../utils/cloudinary');
const cloudinary = require('cloudinary').v2;


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateName = async (req, res) => {
  const { nameData} = req.body;

  if (!nameData) {
    return res.status(400).json({ success: false, message: 'Invalid Credentials' });
  }

  try {
    const user = await User.findByIdAndUpdate(req.user._id, {
      firstName: nameData.firstName,
      lastName: nameData.lastName
    },
      { new: true }).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(201).json({ success: true, user });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAvatar = async (req, res) => {
  try {
    // Ensure file is uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No avatar uploaded" });
    }

    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Upload new avatar to cloudinary
    const fileBuffer = req.file.buffer;
    const fileName = `avatar_${user._id}_${Date.now()}`;

    const uploadedUrl = await uploadToCloudinary(fileBuffer, fileName);

    // Delete previous avatar (if exists)
    if (user.avatar) {
      await cleanupCloudinaryImages([user.avatar]);
    }

    user.avatar = uploadedUrl;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      user,
    });

  } catch (error) {
    console.error("Avatar Update Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateAddress = async (req, res) => {
  const { address} = req.body;

  if (!address) {
    return res.status(400).json({ success: false, message: 'Invalid Credentials' });
  }

  try {
    const user = await User.findByIdAndUpdate(req.user._id,{address},
      { new: true }).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(201).json({ success: true, user });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getWishlist = async (req, res) => {

  try {

    const userId = req.user._id;
    const lang = req.query.lang || 'en';

    const user = await User.findById(userId).populate('wishList');

    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    const translated = user?.wishList?.map((p) => ({
      _id: p?._id,
      name: p?.name[lang] || p?.name?.en,
      description: p?.description[lang] || p?.description?.en,
      category: p?.category,
      images: p?.images,
      variants: p?.variants,
      price: p?.price,
      reviews: p?.reviews,
      likes: p?.likes,
      averageRating: p?.averageRating,
      reviewsCount: p?.reviewsCount,

    }));


    return res.status(200).json({ success: true, wishlist: translated });

  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const addWishList = async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(404).json({ success: false, message: "Product Id not found" });
  }

  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const productExists = await Product.findById(productId);
    if (!productExists) return res.status(404).json({ success: false, message: "Product not found" });

    const isProductInWishList = user.wishList.some(id => id.toString() === productId);
    if (isProductInWishList) return res.status(400).json({ success: false, message: "Product already in wishlist" });

    user.wishList.push(productId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Product added to wishlist successfully',
      user
    });

  } catch (error) {
    console.error("Error adding to wishlist:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeFromWishList = async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(404).json({ success: false, message: "Product Id not found" });
  }

  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const productExists = await Product.findById(productId);
    if (!productExists) return res.status(404).json({ success: false, message: "Product not found" });

    const isProductExist = user.wishList.some(id => id.toString() === productId);
    if (!isProductExist) return res.status(404).json({ success: false, message: "Product already removed" });

    user.wishList = user.wishList.filter(id => id.toString() !== productId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist successfully",
      user
    });

  } catch (error) {
    console.error("Error removing from wishlist:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ========== ADMIN CONTROLLERS ==========

const banUser = async (req, res) => {
  
  try {
    
    const id = req.params.id;

     if (!req.user?.role === 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    };


    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User Not Found' });
    }

    if (user._id.equals(req.user._id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot ban yourself' 
      });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    return res.status(200).json({ 
      success: true, 
      message: `${(user?.firstName + ' ' + user?.lastName)} has been ${user.isBanned ? 'banned' : 'unbanned'}`,
      user
    });

  } catch (error) {
    console.error('Ban user error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

const deleteUser = async (req, res) => {
  try {

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!req.user?.role === 'admin' || !user?._id.equals(req?.user?._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    if (user?.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    if (user.email.includes('deleted_')) {
      return res.status(400).json({
        success: false,
        message: 'User is already deleted'
      });
    }

    // Soft delete instead of hard delete
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User has been deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const changeRole = async (req, res) => {
  try {
    if (!req.user?.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (user?._id.equals(req?.user?._id)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your Role'
      });
    }

    user.role = user.role === 'admin' ? 'user' : 'admin';
    await user.save();

    return res.status(200).json({
      success: true,
      message: `${(user?.firstName + ' ' + user?.lastName)} has set to ${user.role === 'admin' ? 'Admin' : 'User'}`,
      user
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const userDetails = async (req, res) => {
  const lang = req.query.lang || 'en';
  try {
    if (!req.user?.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const orders = await Order.find({ user: req.params.id })
      .populate('orderItems.product', 'name price images category discount')
      .sort({ createdAt: -1 });
    
    let total = 0;
    orders.forEach((p) => {
      total += p?.totalPrice;
    });
    
    const cart = await Cart.findOne({ user: req.params.id })
      .populate('items.product', 'name price images category discount');

    return res.status(200).json({
      success: true,
      orders,
      user,
      total,
      cart: cart || { items: [] }
    });
    
  } catch (error) {
    console.log(error || error?.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = {
  getProfile,
  updateName,
  updateAvatar,
  updateAddress,
  getWishlist,
  addWishList,
  removeFromWishList,
  banUser,
  deleteUser,
  changeRole,
  userDetails
};
