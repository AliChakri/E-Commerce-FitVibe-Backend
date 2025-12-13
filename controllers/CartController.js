const Cart = require("../models/cart");
const product = require("../models/product");
const Product = require("../models/product");
const User = require("../models/user");

const getCarts = async (req, res) => { 

  const lang = req.query.lang || 'en';
    try {
      const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
      
      if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        success: true,
        items: [],
        totalPrice: 0,
      });
    }
      
    const totalPrice = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      
    cart.items = cart.items.map((p) => ({
      _id: p._id,
      product: {
        _id: p.product._id,
        name: p.product.name[lang] || p.product.name["en"], // translation
        description: p.product.description[lang] || p.product.description["en"],
        price: p.product.price,
        images: p.product.images,
      },
      size: p.size,
      color: p.color,
      quantity: p.quantity,
    }));
       
    return res.status(200).json({
      success: true,
      cart,
      totalPrice
    });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { product, size, color, quantity } = req.body;


    if (!product || !size || !color || !quantity) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const productt = await Product.findById(product);
    if (!productt) return res.status(404).json({ message: "Product not found." });

    const variant = productt.variants.find(v => v.size === size && v.color === color);
    if (!variant) return res.status(400).json({ message: "Selected size and color not available." });

    if (variant.stock < quantity) {
      return res.status(400).json({ message: `Only ${variant.stock} in stock for this variant.` });
    }

    let cart = await Cart.findOne({ user: userId });

    const items = [{
      product,
      size,
      color,
      quantity,
    }];

    if (!cart) {
      cart = new Cart({ user: userId, items });
    } else {
      const existingItem = cart?.items?.find(item =>
        item?.product?._id?.toString() === product?._id &&
        item?.size === size &&
        item?.color === color
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart?.items.push(...items);
      }
    }

    cart.items = cart.items.filter(
      item => item.product && item.size && item.color && item.quantity
    );

    await cart.save();
    return res.status(200).json({ message: "Item added to cart.", cart });

  } catch (err) {
    console.error("Add to Cart Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

const editCart = async (req, res) => {
    const { id, quantity, size, color } = req.body;

    try {
        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        let item = cart.items.find(item => 
            item.product.toString() === id &&
            item.size === size &&
            item.color === color
        );

        if (!item) {
            return res.status(404).json({ message: "Product not in cart" });
        }

        item.quantity = quantity;

        await cart.save();
        res.status(200).json({ success: true, cart });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const removeFromCart = async (req, res) => {
    const { size, color, lang = "en" } = req.query;
    const productId = req.params.id;

    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        cart.items = cart.items.filter(item => {
            const itemProductId = item?.product?._id?.toString() || item?.product?.toString();
            return !(itemProductId === productId && item.size === size && item.color === color);
        });

        await cart.save();

        let updatedCart = await Cart.findById(cart._id).populate("items.product");

        updatedCart = updatedCart.toObject();
        updatedCart.items = updatedCart.items.map(item => {
            if (item.product) {
                item.product = {
                    ...item.product,
                    name: item.product.name?.[lang] || item.product.name?.en,
                };
            }
            return item;
        });

        res.status(200).json({ success: true, cart: updatedCart });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const clearCart = async (req, res) => {
    try {
        await Cart.findOneAndDelete({ user: req.user._id });
        res.status(200).json({ message: "Cart cleared" });
    } catch (error) {
        return res.status(500).json({success: false, message: error.message});
    }
};

module.exports = {
    getCarts,
    addToCart,
    editCart,
    removeFromCart,
    clearCart
};
