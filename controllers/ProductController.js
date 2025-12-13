
const express = require('express');
const Product = require("../models/product");
const mongoose = require("mongoose");
const { uploadToCloudinary, cleanupCloudinaryImages } = require('../utils/cloudinary');
const multer = require('multer');
const cloudinary = require('cloudinary');
const User = require('../models/user');
const upload = multer();
const formidable = require('formidable');
const fs = require('fs').promises;
const path = require('path');
const product = require('../models/product');
const { translateProduct } = require('../utils/translate');
const Notification = require('../models/notification');
const { title } = require('process');


// ********** PRODUCT CONTROLLERS ********* //

const getProducts = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const products = await Product.find().sort({ createdAt: -1 });
    if (!products.length) {
      return res.status(400).json({ success: false, message: "No Data Found" });
    }

    const translatedProducts = products.map((p) => ({
      _id: p._id,
      name: p.name[lang] || p.name.en,
      description: p.description[lang] || p.description.en,
      price: p.price,
      category: p.category,
      images: p.images,
      discount: p.discount,
      averageRating: p.averageRating,
      reviewsCount: p.reviewsCount,
      variants: p?.variants
    }));

    // Most liked/rated logic
    const mostRated = [...products]
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 6);

    const mostReviewed = [...products]
      .sort((a, b) => b.reviews.length - a.reviews.length)
      .slice(0, 6);

    let mostProducts = [...mostRated, ...mostReviewed];
    mostProducts = mostProducts.filter(
      (p, index, self) =>
        index === self.findIndex((obj) => obj._id.toString() === p._id.toString())
    );

    const translatedPopular = mostProducts.map((p) => ({
      _id: p._id,
      name: p.name[lang] || p.name.en,
      description: p.description[lang] || p.description.en,
      price: p.price,
      category: p.category,
      images: p.images,
      averageRating: p.averageRating,
      reviewsCount: p.reviewsCount,
      variants: p?.variants
    }));

    return res.status(200).json({
      success: true,
      products: translatedProducts,
      popular: translatedPopular,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getProduct = async (req, res) => {
  const { id } = req.params;
  const lang = req.query.lang || "en";

  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid Id" });
    }
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product Not Found" });
    }

    return res.status(200).json({
      success: true,
      product: {
        ...product.toObject(),
        name: product.name[lang] || product.name.en,
        description: product.description[lang] || product.description.en,
        images: product?.images,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const searchProduct = async (req, res) => {
  try {
    const query = req.query.q?.trim();
    const lang = req.query.lang || "en";

    if (!query) {
      return res.status(200).json({ success: true, results: 0, products: [] });
    }

    const nameField = `name.${lang}`;
    const nameQuery = lang === "ar"
      ? { [nameField]: { $regex: query } }
      : { [nameField]: { $regex: query, $options: "i" } };

    const categoryOptions = ["shirts", "pants", "jeans", "jackets", "shoes", "hoodies"];
    const categoryQuery = categoryOptions.includes(query.toLowerCase()) ? { category: query.toLowerCase() } : {};

    const products = await Product.find({
      $or: [
        nameQuery,
        { brand: { $regex: query, $options: "i" } },
        ...(Object.keys(categoryQuery).length ? [categoryQuery] : []),
      ],
    }).limit(30);

    const translatedProducts = products.map((p) => ({
      _id: p._id,
      name: p.name[lang] || p.name.en,
      description: p.description[lang] || p.description.en,
      price: p.price,
      category: p.category,
      images: p.images,
      discount: p.discount,
      averageRating: p.averageRating,
      reviewsCount: p.reviewsCount,
      variants: p?.variants
    }));

    res.status(200).json({ success: true, results: translatedProducts.length, products: translatedProducts });
  } catch (error) {
    console.error("SEARCH ERROR:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, price, description, brand, category, variants, discount = 0 } = req.body;

    if (!name || !price || !description || !category || !variants) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "At least one image is required" });
    }

    const translations = await translateProduct(name, description);

    const images = await Promise.all(
      req.files.map((file, index) =>
        uploadToCloudinary(file.buffer, `product-${Date.now()}-${index}`)
      )
    );

    let parsedVariants = [];
    try {
      parsedVariants = JSON.parse(variants);
    } catch (err) {
      return res.status(400).json({ success: false, message: "Invalid variants format" });
    }

    const product = await Product.create({
      name: translations.name,
      description: translations.description,
      price: Number(price),
      discount: Number(discount) || 0,
      brand,
      category,
      variants: parsedVariants,
      images,
    });

    return res.status(201).json({
      success: true,
      data: product,
      message: "Product created successfully",
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const editProduct = async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    description, 
    price, 
    category, 
    discount, 
    brand, 
    variants,
    existingImages 
  } = req.body;

  try {

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    let updatedData = {};

    // Detect important changes
    const oldDiscount = existingProduct.discount;
    const oldPrice = existingProduct.price;
    const oldVariants = existingProduct.variants || [];

    let discountChanged = false;
    let priceChanged = false;
    let stockChanged = false;

    if (discount !== undefined && parseFloat(discount) !== oldDiscount) {
      discountChanged = true;
    }

    if (price !== undefined && parseFloat(price) !== oldPrice) {
      priceChanged = true;
    }

    if (variants) {
      const parsedVariants = JSON.parse(variants);

      for (let i = 0; i < parsedVariants.length; i++) {
        const newStock = parsedVariants[i].stock;
        const oldStock = oldVariants[i]?.stock;

        if (newStock !== oldStock) {
          stockChanged = true;
          break;
        }
      }
    }

    // Translation logic
    if (
      (name && name !== existingProduct.name?.en) ||
      (description && description !== existingProduct.description?.en)
    ) {
      const translations = await translateProduct(
        name || existingProduct.name?.en,
        description || existingProduct.description?.en
      );

      updatedData.name = translations.name;
      updatedData.description = translations.description;
    } else {
      updatedData.name = existingProduct.name;
      updatedData.description = existingProduct.description;
    }

    // Images handling
    let finalImages = [];
    const keepImages = existingImages ? JSON.parse(existingImages) : [];
    finalImages = [...keepImages];

    const imagesToDelete =
      existingProduct.images?.filter((oldUrl) => !keepImages.includes(oldUrl)) || [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const imageUrl = await uploadToCloudinary(file.buffer, fileName);
        finalImages.push(imageUrl);
      }
    }

    if (finalImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image is required",
      });
    }

    updatedData.images = finalImages;

    // Fields update
    if (price !== undefined) updatedData.price = parseFloat(price);
    if (category) updatedData.category = category;
    if (discount !== undefined) updatedData.discount = parseFloat(discount);
    if (brand !== undefined) updatedData.brand = brand;

    // Variants
    if (variants) {
      const parsedVariants = JSON.parse(variants);
      updatedData.variants = parsedVariants;
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true,
    });

    // Cleanup removed images
    if (imagesToDelete.length > 0) {
      cleanupCloudinaryImages(imagesToDelete).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });

  } catch (error) {
    console.error("Edit product error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
};

const likeProduct = async (req, res) => {

  const userId = req.user._id;
  const productId = req.params.id;
  const lang = req.query.lang || "en";

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: "Invalid Product Id" });
  }

  try {

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product Not Found" });
    }

    const isLiked = product.likes.some(id => id.equals(userId));

    if (isLiked) {
      // Unlike
      product.likes = product.likes.filter(id => !id.equals(userId));
      await product.save();
      return res.status(200).json({
        success: true,
        message: "Product unliked successfully",
        likesCount: product.likes.length,
        isLiked: false,
        product: {
        ...product.toObject(),
        name: product.name[lang] || product.name.en,
        description: product.description[lang] || product.description.en,
      },
      });
    } else {
      // Like
      product?.likes?.push(userId);
      await product.save();
      return res.status(200).json({
        success: true,
        message: "Product liked successfully",
        likesCount: product.likes.length,
        isLiked: true,
        product: {
        ...product.toObject(),
        name: product.name[lang] || product.name.en,
        description: product.description[lang] || product.description.en,
      },
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteProduct = async (req,res) => {

    const { id } = req.params;
    try {
        if(!mongoose.isValidObjectId(id)){
            return res.status(400).json({success: false, message: 'Invalid Id'});
        }
        const product = await Product.find({id});
        if(!product) {
            return res.status(400).json({success: false, message: 'Product Not Found'});
        }
        await Product.findByIdAndDelete(id);
        return res.status(200).json({success: true, message: 'Deleted Successfully'});
        
    } catch (error) {
        return res.status(500).json({success: false, message: error.message});
    }
};

const suggestedProducts = async (req, res) => {
  
  const { productId } = req.params;
  const { lang } = req.query;

  try {

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Invalid Product Id" });
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not Found' });
    }

    let suggestions = [];

    const categoryProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
    }).limit(6);

    if (categoryProducts.length < 6) {
      const brandProducts = await Product.find({
        brand: product.brand,
        _id: { $ne: product._id },
      }).limit(6 - categoryProducts.length);
      suggestions = [...categoryProducts, ...brandProducts];
    } else {
      suggestions = categoryProducts;
    }

    if (suggestions.length < 6) {

      const trending = await Product.find({
        _id: { $ne: product._id },
      })
        .sort({ likes: -1, reviewsCount: -1 })
        .limit(6 - suggestions.length);
      suggestions = [...suggestions, ...trending];
    }

    // Remove duplicates based on product._id
    const uniqueSuggestions = Array.from(
      new Map(suggestions.map(item => [item._id.toString(), item]))
        .values()
    );

    const translatedSuggestions = uniqueSuggestions.map((p) => ({
      _id: p._id,
      name: p?.name[lang] || p?.name?.en,
      description: p?.description[lang] || p?.description?.en,
      price: p.price,
      category: p.category,
      images: p.images,
      averageRating: p.averageRating,
      reviewsCount: p.reviewsCount,
      variants: p?.variants,
      reviews: p?.reviews,
      replies: p?.replies,
    }))

    return res.status(200).json({
      success: true,
      products: translatedSuggestions
    })
    
  } catch (err) {
    console.error("Add Reply Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ********* REVIEWS CONTROLLERS ********* //

const addReview = async (req, res) => {

  try {
    const { rating, title, comment } = req.body;
    const productId = req.params.id;

    if (!rating || isNaN(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: "Rating must be 1–5" });


    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    // prevent duplicate reviews per user
    const already = product.reviews.some(
      (r) => String(r.user) === String(req.user?._id)
    );
    if (already)
      return res.status(400).json({ success: false, message: "You already reviewed this product" });

    const images = await Promise.all(
      req.files.map((file, index) =>
      uploadToCloudinary(file.buffer, `${file.originalname}-${Date.now()}-${index}`)
    ));

    product.reviews.push({
      user: req.user._id,
      rating: Number(rating),
      title: title?.trim() || null,
      comment: comment?.trim() || null,
      images,
    });


    product.recalculateRating();
    await product.save();

    const populated = await Product.findById(productId)
      .select("reviews averageRating reviewsCount")
      .populate("reviews.user", "firstName lastName email avatar");

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      averageRating: populated.averageRating,
      reviewsCount: populated.reviewsCount,
      reviews: populated.reviews,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const editReview = async (req, res) => {

  const { title, comment, rating } = req.body;
  const productId = req.params.id;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be 1-5' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product Not Found' });
    }

    const existingReview = product.reviews.find(
      (r) => String(r.user) === String(req.user._id)
    );
    if (!existingReview) {
      return res.status(400).json({ success: false, message: "You haven't reviewed this product yet" });
    }

    // Keep existing images
    let keptImages = [];
    if (req.body.existingImages) {
      keptImages = Array.isArray(req.body.existingImages)
        ? req.body.existingImages
        : [req.body.existingImages];

      keptImages = keptImages.filter((url) =>
        existingReview.images.includes(url)
      );
    }

    // Upload new images
    let uploadedImages = [];
    if (req.files && req.files['newImages']) {
      const files = Array.isArray(req.files['newImages'])
        ? req.files['newImages']
        : [req.files['newImages']];

      uploadedImages = await Promise.all(
        files.map((file, idx) =>
          uploadToCloudinary(
            file.buffer,
            `review-${productId}-${req.user._id}-${Date.now()}-${idx}`
          )
        )
      );
    }

    // Combine
    const finalImages = [...keptImages, ...uploadedImages];
    if (finalImages.length > 3) {
      return res.status(400).json({ success: false, message: "Max 3 images allowed" });
    }

    // Cleanup: remove any images that existed before but user didn’t keep
    const removedImages = existingReview.images.filter((url) => !keptImages.includes(url));
    if (removedImages.length > 0) {
      await cleanupCloudinaryImages(removedImages);
    }

    // Update review
    existingReview.title = title || "";
    existingReview.comment = comment || "";
    existingReview.rating = rating;
    existingReview.images = finalImages;
    existingReview.updatedAt = new Date();

    product.recalculateRating();
    await product.save();

    // return updated reviews
    const populated = await Product.findById(productId)
      .select("reviews averageRating reviewsCount")
      .populate("reviews.user", "firstName lastName email avatar");

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      averageRating: populated.averageRating,
      reviewsCount: populated.reviewsCount,
      reviews: populated.reviews,
      updatedReview: populated.reviews.find(r => String(r.user._id) === String(req.user._id))
    });

  } catch (error) {
    console.error("Edit Review Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteReview = async (req, res) => {

  const { productId, reviewId } = req.params;
  const userId = req.user._id;
  const lang = req.query.lang || "en";

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const review = product.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    if (String(review.user) !== String(userId) && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this review" });
    }

    // Cleanup cloudinary images if any
    if (review.images && review.images.length > 0) {
      await cleanupCloudinaryImages(review.images);
    }

    review.deleteOne();

    product.recalculateRating();
    await product.save();

    const populated = await Product.findById(productId)
      .select("reviews averageRating reviewsCount")
      .populate("reviews.user", "firstName lastName email avatar");
    
    if (String(review.user) !== String(userId)) {
      const io = req.app.get("io");
      await Notification.create({
        userId: review.user,
        title: "Your review was deleted",
        message: `Your review on product "${product.name[lang]}" has been removed by an admin.`,
        type: "system",
      });
      io.to(review.user.toString()).emit("new-notification", {
        title: "Your review was deleted",
        message: `Your review on product "${product.name[lang]}" has been removed by an admin.`,
        type: "system",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      averageRating: populated.averageRating,
      reviewsCount: populated.reviewsCount,
      reviews: populated.reviews,
    });

  } catch (error) {
    console.error("Delete Review Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select("reviews averageRating reviewsCount")
      .populate("reviews.user", "firstName lastName email avatar")
      .populate("reviews.replies.user", "firstName lastName email avatar");
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    product.recalculateRating();
    await product.save();

    return res.json({
      success: true,
      reviews: product.reviews.sort((a, b) => b.createdAt - a.createdAt),
      averageRating: product.averageRating,
      reviewsCount: product.reviewsCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const likeReview = async (req, res) => {
  const userId = req.user._id;
  const { id: productId, reviewId } = req.params;
  const lang = req.query.lang || "en";

  if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(reviewId)) {
    return res.status(400).json({ success: false, message: "Invalid Product or Review Id" });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product Not Found" });
    }

    // find review by reviewId
    const review = product.reviews.id(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review Not Found" });
    }

    const isLiked = review.likes.some(id => id.equals(userId));

    if (isLiked) {
      // Unlike
      review.likes = review.likes.filter(id => !id.equals(userId));
    } else {
      // Like
      review.likes.push(userId);
      if (String(review.user) !== String(userId)) {
        const io = req.app.get("io");
        await Notification.create({
          user: review.user,
          title: "Your review got a new like!",
          message: `Someone liked your review on "${product.name[lang]}".`,
          type: "like",
        });
        io.to(review.user.toString()).emit("new-notification", {
          title: "Your review got a new like!",
          message: `Someone liked your review on "${product.name[lang]}".`,
          type: "like",
        });
      }
    }

    await product.save();

    const populated = await Product.findById(productId)
      .select("reviews averageRating reviewsCount")
      .populate("reviews.user", "firstName lastName email avatar");
    
    
    const updatedReview = populated.reviews.id(reviewId);

    return res.status(200).json({
      success: true,
      message: isLiked ? "Review unliked successfully" : "Review liked successfully",
      likesCount: updatedReview.likes.length,
      isLiked: !isLiked,
      review: updatedReview,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// *********** REPLY TO REVIEWS ************/
const addReply = async (req, res) => {

  const { productId, reviewId } = req.params;
  const text = req.body.comment;
  const userId = req.user._id;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ success: false, message: "Reply text is required" });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const review = product.reviews.id(reviewId);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    review.replies.push({ user: userId, comment: text.trim() });

     if (String(review.user) !== String(userId)) {
        const notification = await Notification.create({
          user: review.user,
          type: "reply",
          title: "New reply to your review",
          message: `${req.user.name} replied: ${text}`,
          product: productId,
        });

        const io = req.app.get("io");
        io.to(review.user.toString()).emit("new-notification", notification);
      }


    await product.save();

    const populated = await Product.findById(productId)
      .select("reviews")
      .populate("reviews.user", "firstName lastName email avatar")
      .populate("reviews.replies.user", "firstName lastName email avatar");

    return res.status(201).json({
      success: true,
      message: "Reply added successfully",
      review: populated.reviews.id(reviewId),
      reviews: populated.reviews,
    });
  } catch (err) {
    console.error("Add Reply Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const likeReply = async (req, res) => {
  try {
    const { productId, reviewId, replyId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const review = product.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found." });

    const reply = review.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found." });

    const userId = req.user._id.toString();

    const alreadyLiked = reply.likes.includes(userId);

    if (alreadyLiked) {
      // Unlike
      reply.likes = reply.likes.filter((id) => id.toString() !== userId);
    } else {
      // Like
      reply.likes.push(userId);
      if (String(reply.user) !== String(userId)) {
        const notification = await Notification.create({
          user: reply.user,
          type: "like",
          title: "Your reply was liked",
          message: `${req.user.name} liked your reply`,
          product: productId,
        });

        const io = req.app.get("io");
        io.to(reply.user.toString()).emit("new-notification", notification);
      }
    }

    await product.save();

      const populated = await Product.findById(productId)
      .select("reviews")
      .populate("reviews.user", "firstName lastName email avatar")
      .populate("reviews.replies.user", "firstName lastName email avatar");

    return res.status(201).json({
      success: true,
      message: alreadyLiked ? "Reply unliked." : "Reply liked.",
      likesCount: reply.likes.length,
      review: populated.reviews.id(reviewId),
    });

  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

const deleteReply = async (req, res) => {
  try {
    const { productId, reviewId, replyId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const review = product.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found." });

    const reply = review.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found." });

    if (reply.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this reply." });
    }


    reply.deleteOne();
    await product.save();

    const isOwner = reply.user.toString() === req.user._id.toString();

    if (!isOwner && req.user.isAdmin) {
      const notification = await Notification.create({
        user: reply.user,
        type: "system",
        title: "Your reply was removed",
        message: "An admin deleted your reply for violating our policies.",
        product: productId,
      });

      const io = req.app.get("io");
      io.to(reply.user.toString()).emit("new-notification", notification);
    }

    res.status(200).json({ success: true, message: "Reply deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

const editReply = async (req, res) => {
  try {
    const { productId, reviewId, replyId } = req.params;
    const text = req.body.comment;

    if (!text || text.trim().length < 2) {
      return res.status(400).json({ message: "Reply text is too short." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const review = product.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found." });

    const reply = review.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found." });

    if (reply.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to edit this reply." });
    }

    reply.comment = text;
    await product.save();

      const populated = await Product.findById(productId)
      .select("reviews")
      .populate("reviews.user", "firstName lastName email avatar")
      .populate("reviews.replies.user", "firstName lastName email avatar");

    return res.status(200).json({
      success: true,
      message: "Reply Edited successfully",
      review: populated.reviews.id(reviewId),
      reply
    });

  } catch (error) {
    res.status(500).json({ message: "Server error.", error: error.message });
  }
};

module.exports = {
    getProducts,
  getProduct,
    searchProduct,
    createProduct,
    editProduct,
    deleteProduct,
  likeProduct,
  suggestedProducts,
  addReview,
  getProductReviews,
  editReview,
  deleteReview,
  likeReview,
  addReply,
  editReply,
  deleteReply,
  likeReply
}