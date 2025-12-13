
const mongoose = require("mongoose");


const CartItemSchema = mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    size: {
        type: String, 
        required: true, 
    },
    color: {
        type: String, 
        required: true, 
    },
    quantity: {
        type: Number, 
        required: true, 
        min: 1,
    },
})

const CartSchema = mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    items: [CartItemSchema],
},
    { timestamps: true }
);

const Cart = mongoose.models.Cart ||  mongoose.model('Cart', CartSchema);

module.exports = Cart;

