const catchAsync = require("../utils/catchAsync");
const Station = require("../models/station.model");
const factory = require('../utils/handlerFactory');
const AppError = require('../utils/appError');
const axios = require("axios");
require('dotenv').config();

const ORS_API_KEY = process.env.ORS_API_KEY;

exports.getAllStations = factory.selectAll(Station);
exports.getStation = factory.selectOne(Station);
exports.createStation = factory.createOne(Station);
exports.deleteStation = factory.deleteOne(Station);

// API: GET /api/v1/stations/:id/walking-directions?lat=...&lng=...
exports.getWalkingDirectionsToStation = catchAsync(async (req, res, next) => {
    const stationId = req.params.id;
    // Tọa độ current của user
    const { lat, lng } = req.query;

    if (!lat || !lng)   
        return next(new AppError('Vui lòng cung cấp tọa độ current (lat, lng).', 400));

    const station = await Station.findById(stationId);

    if (!station)
        return next(new AppError('Trạm không tồn tại.', 404));

    const start = `${lng},${lat}`;
    const end = `${station.address.longitude},${station.address.latitude}`;

    try {
        const url = `https://api.openrouteservice.org/v2/directions/foot-walking?start=${start}&end=${end}`;

        const response = await axios.get(url, {
            headers: { 'Authorization': ORS_API_KEY }
        });

        const routeData = response.data.features[0];

        res.status(200).json({
            status: 'success',
            data: {
                destination: station.name,
                distanceMeters: routeData.properties.summary.distance,
                durationSeconds: routeData.properties.summary.duration,
                shape: routeData.geometry,
                steps: routeData.properties.segments[0].steps
            }
        });
    } catch (error) {
        console.log("ORS Error:", error.response?.data || error.message);
        return next(new AppError('Không tìm được đường đi bộ.', 500));
    }
});