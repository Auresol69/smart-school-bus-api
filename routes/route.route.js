const express = require('express');
const routeController = require('../controllers/route.controller');
const { authenticateToken, restrictTo } = require('../controllers/auth.controller');

const route = express.Router();

route.use(authenticateToken);

route.post(
    '/',
    restrictTo('Admin', 'Manager'),
    routeController.createRoute
)

route.get(
    '/',
    restrictTo('Admin', 'Manager', 'Driver', 'Parent'),
    routeController.getAllRoutes
);

route.get(
    '/:id',
    restrictTo('Admin', 'Manager', 'Driver', 'Parent'),
    routeController.getRoute
);

route.delete('/:id', restrictTo('Admin', 'Manager'), routeController.deleteRoute);

module.exports = route;