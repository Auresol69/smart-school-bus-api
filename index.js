const express = require('express');
const app = express();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require('cors');
const modelRoute = require("./routes/models.route");
const tripRoute = require("./routes/trip.route");
const authRoute = require("./routes/auth.route");
const routeRoute = require("./routes/route.route");
const stationRoute = require("./routes/station.route")
require("dotenv").config();

const User = require("./models/user.model");
const Alert = require("./models/alert.model");
const Bus = require("./models/bus.model");
const Location = require("./models/location.model");
const Notification = require("./models/notification.model");
const Route = require("./models/route.model");
const Schedule = require("./models/schedule.model");
const Station = require("./models/station.model");
const Student = require("./models/student.model");
const Trip = require("./models/trip.model");
const AppError = require("./utils/appError");

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const { DB_URL, PORT } = process.env;
const port = PORT || 3000;

// CORS cho HTTP API
app.use(cors({
    origin: CLIENT_URL, // domain frontend
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true // Cho phép cookie token
}));

// WebSocket
const { Server } = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true
    }
});

// KHỞI CHẠY SOCKET & CRON JOB
require('./services/initializeSocket.service')(io);

// De embed io vao request cho viec trao doi realtime voi client
app.use((req, res, next) => {
    req.io = io;
    next();
});

// HACK CHO RENDER (PING ROUTE)
// Để UptimeRobot gọi vào đây giữ server không ngủ
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Database connection
mongoose.connect(DB_URL)
    .then(() => {
        console.log("Database connected successfully!");
        server.listen(port, () => {
            console.log(`🚀 App running on port ${port}...`);
            console.log(`🔗 Client URL allowed: ${CLIENT_URL}`);
        });
    })
    .catch((err) => {
        console.error("🔴 Database connection error:", err.message);
        process.exit(1); // Exit process with failure
    });

if (DB_URL)
    console.log("Connecting to DB URL:", DB_URL.split('@')[1]);

/**
 * @type {import('express').RequestHandler}
 */

// MIDDLEWARES
app.use(express.json()); // Body parser, for reading data from body into req.body

app.use(cookieParser()); // send Cookie for JWT

const models = {
    users: User,
    alerts: Alert,
    buses: Bus,
    locations: Location,
    notifications: Notification,
    routes: Route,
    schedules: Schedule,
    stations: Station,
    students: Student,
    trips: Trip
}

// Middleware to get the correct model based on the URL parameter
const getModel = (req, res, next) => {
    const modelName = req.params.models.toLowerCase();
    req.Model = models[modelName] // if modelName = users => models[modelName] = User (object)
    if (!req.Model)
        return next(new AppError(`Model '${req.params.models}' not found`, 404));
    console.log(`Request for model: ${req.Model.modelName}`);
    next();
}

// --- ROUTES ---
// Các route cụ thể phải được đăng ký TRƯỚC các route động

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/trips", tripRoute);
app.use("/api/v1/routes", routeRoute);
app.use("/api/v1/stations", stationRoute);

// Route động (generic) phải được đăng ký SAU CÙNG
app.use("/api/v1/:models", getModel, modelRoute);

app.get("/", (req, res) => {
    res.status(200).json({
        service: "🚌 Smart School Bus API 🚌",
        status: "✅ Đang hoạt động ngon lành!",
        version: "v1.0",
        message: "😉 Chào mấy ní! Backend ready rùi nè. ✨ Các API xịn xò đang chờ ở /api/v1/",
        // Thêm uptime để prove cho server không bị ngủ đông 💤
        uptime: process.uptime(),
        github: "https://github.com/Auresol69/" // Thêm link repo của bạn (optional)
    });
});

// Khong tim thay endpoint phu hop
// This middleware will run for any request that didn't match a route above
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl}`, 404));
})

// MIDDLEWARE XỬ LÝ LỖI TẬP TRUNG (Global Error Handler)
app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    res.status(err.statusCode).json({
        status: err.status,
        msg: err.message
    })
})