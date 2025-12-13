require("dotenv").config();
const express = require('express');
const app = express();
const mongoose = require("mongoose");
const cors = require('cors');
const cookieParser = require('cookie-parser');

// ---------- ROUTES ----------
const authRouter = require('./routes/AuthRoutes');
const productRoute = require('./routes/ProductRoutes');
const cartRouter = require("./routes/CartRoutes");
const analyticsRoutes = require('./routes/AnalyticsRoutes');
const orderRoute = require("./routes/OrderRoutes");
const UserRoute = require("./routes/UserRoutes");
const NotificationRoutes = require("./routes/NotificationRoutes");
const ReportRoute = require("./routes/ReportRoutes");

// ---------- Middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', UserRoute);
app.use('/products', productRoute);
app.use('/user/cart', cartRouter);
app.use('/api/order', orderRoute);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notification', NotificationRoutes);
app.use('/api/report', ReportRoute);

// --- SOCKET.IO SETUP --- //
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

// create socket.io server
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// socket events
io.on("connection", (socket) => {
  // console.log("User connected:", socket.id);

  // user joins room
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    // console.log(`User ${userId} joined room`);
  });

  // user disconnects
  socket.on("disconnect", () => {
    // console.log(" User disconnected:", socket.id);
  });
});


// make io available in routes/controllers
app.set("io", io);
// --- MONGO + START SERVER --- //
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to DataBase");
    server.listen(process.env.PORT, () => {
      console.log(`Listening on Port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.log(err.message));
