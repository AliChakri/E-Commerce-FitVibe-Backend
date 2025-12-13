

const express = require("express");
const {
    addToCart, 
    clearCart, 
    editCart, 
    removeFromCart, 
    getCarts
} = require("../controllers/CartController");
const { userAuth, checkUser } = require("../MiddleWare/authProtect");
const cartRouter = express.Router();


cartRouter.get('/', userAuth, getCarts);
cartRouter.post('/', userAuth, addToCart);
cartRouter.delete('/', userAuth, clearCart);

cartRouter.put('/', userAuth,  editCart);
cartRouter.delete('/:id', userAuth,  removeFromCart);


module.exports = cartRouter;