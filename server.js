require("dotenv").config();
const express = require('express');
const app = express();
const mongoose = require("mongoose");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require("http");
const { Server } = require("socket.io");

// ---------- Middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// ---------- ROUTES ----------
app.use('/api/auth', require('./routes/AuthRoutes'));
app.use('/api/users', require('./routes/UserRoutes'));
app.use('/api/products', require('./routes/ProductRoutes'));
app.use('/api/cart', require("./routes/CartRoutes"));
app.use('/api/order', require("./routes/OrderRoutes"));
app.use('/api/analytics', require('./routes/AnalyticsRoutes'));
app.use('/api/notification', require("./routes/NotificationRoutes"));
app.use('/api/report', require("./routes/ReportRoutes"));

// ---------- SOCKET.IO ----------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
  });
});

app.set("io", io);

// ---------- MONGO + START SERVER ----------
const PORT = process.env.PORT || 10000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to Database");
    server.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err.message));
