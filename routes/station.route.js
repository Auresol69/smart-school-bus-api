const express = require('express');
const stationController = require('../controllers/station.controller');
const { authenticateToken, restrictTo } = require('../controllers/auth.controller');

const route = express.Router();

route.use(authenticateToken);

route.post(
    '/',
    restrictTo('Admin', 'Manager'),
    stationController.createStation
)

route.get(
    '/',
    restrictTo('Admin', 'Manager', 'Driver', 'Parent'),
    stationController.getAllStations
);

// API: GET /api/v1/stations/:id/walking-directions?lat=...&lng=...
route.get(
    '/:id/walking-directions',
    restrictTo('Admin', 'Manager', 'Driver', 'Parent'),
    stationController.getWalkingDirectionsToStation
);

route.get('/:id',
    restrictTo('Admin', 'Manager', 'Driver', 'Parent'),
    stationController.getStation
);

route.delete('/:id', restrictTo('Admin', 'Manager'), stationController.deleteStation);

module.exports = route;