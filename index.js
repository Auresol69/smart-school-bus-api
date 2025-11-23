const express = require('express');
const app = express();
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const modelRoute = require("./routes/models.route");
const tripRoute = require("./routes/trip.route");
const authRoute = require("./routes/auth.route");
const routeRoute = require("./routes/route.route");
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

// WebSocket
const { Server } = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});
require('./services/initializeSocket.service')(io);

// De embed io vao request cho viec trao doi realtime voi client
app.use((req, res, next) =>{
    req.io = io;
    next();
});

// Database connection
const { DB_URL, PORT } = process.env;
const port = PORT || 3000;
mongoose.connect(DB_URL)
    .then(() => {
        console.log("Database connected successfully!");
        server.listen(port, () => {
            console.log(`App running on port ${port}...`);
        });
    })
    .catch((err) => {
        console.error("🔴 Database connection error:", err.message);
        process.exit(1); // Exit process with failure
    });

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

// Route động (generic) phải được đăng ký SAU CÙNG
app.use("/api/v1/:models", getModel, modelRoute);

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