const express = require('express');
const tripController = require('../controllers/trip.controller');
const { authenticateToken, restrictTo } = require('../controllers/auth.controller');

const route = express.Router();

// Áp dụng middleware xác thực cho tất cả các route bên dưới
route.use(authenticateToken);

// === CÁC ROUTE SỬ DỤNG CONTROLLER TÙY CHỈNH ===

route.post(
    '/',
    restrictTo('Admin', 'Manager'),
    tripController.createTrip
);

route.patch(
    '/:id',
    restrictTo('Admin', 'Manager'),
    tripController.updateTrip
);

route.get(
    '/my-schedule',
    restrictTo('Driver'),
    tripController.getMySchedule
);

route.get('/:id/students',
    restrictTo('Driver'),
    tripController.getStudents
);

route.patch(
    '/:id/check-in',
    restrictTo('Admin', 'Driver'),
    tripController.checkIn
);

route.patch(
    '/:id/mark-absent',
    restrictTo('Driver'),
    tripController.markAsAbsent
);

// === CÁC ROUTE VẪN SỬ DỤNG FACTORY (HOẶC CONTROLLER ĐÃ WRAP FACTORY) ===

route.get(
    '/',
    restrictTo('Admin', 'Manager', 'Driver', 'Parent'),
    tripController.getAllTrips
);

route.get(
    '/:id',
    restrictTo('Admin', 'Manager', 'Driver', 'Parent'),
    tripController.getTrip
);

route.delete('/:id', restrictTo('Admin', 'Manager'), tripController.deleteTrip);

module.exports = route;