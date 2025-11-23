const axios = require('axios');
const Route = require('../models/route.model');
const catchAsync = require('../utils/catchAsync');
const Station = require('../models/station.model');
const factory = require('../utils/handlerFactory');
const AppError = require('../utils/appError');
require('dotenv').config();

const ORS_API_KEY = process.env.ORS_API_KEY;

exports.getAllRoutes = factory.selectAll(Route);
exports.getRoute = factory.selectOne(Route);
exports.deleteRoute = factory.deleteOne(Route);

exports.createRoute = catchAsync(async (req, res, next) => {
    const { name, stationIds } = req.body;

    // stationIds = [1, 2, 3]
    if (!stationIds || stationIds.length < 2) {
        return next(new AppError('Một tuyến đường cần ít nhất 2 trạm.', 400));
    }

    // Lấy dữ liệu trạm
    // stationsData = [2, 3]
    const stationsData = await Station.find({ _id: { $in: stationIds } });

    // Sắp xếp
    // orderedStations = [undefined, 2, 3]
    const orderedStations = stationIds.map(id =>
        stationsData.find(s => s._id.toString() === id.toString())
    );

    if (orderedStations.includes(undefined)) {
        return next(new AppError('Một số Station ID không tồn tại.', 404));
    }

    // Chuẩn bị tọa độ cho ORS
    // ORS yêu cầu array in array: [[Lng, Lat], [Lng, Lat], ...]
    // LƯU Ý: OpenRouteService dùng [Kinh độ, Vĩ độ] (Ngược với Google)
    const coordinates = orderedStations.map(station => [
        station.address.longitude,
        station.address.latitude
    ]);

    try {
        // 4. Gọi API OpenRouteService
        const orsResponse = await axios.post(
            'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
            {
                coordinates: coordinates
            },
            {
                headers: {
                    'Authorization': ORS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log("🔍 ORS Response Data:", JSON.stringify(orsResponse.data, null, 2));

        // ORS trả về GeoJSON FeatureCollection
        const feature = orsResponse.data.features[0];
        const geometry = feature.geometry; // Chứa coordinates
        const properties = feature.properties; // Chứa distance, duration
        console.log(geometry, '\n', properties);

        // 5. Lưu vào DB
        // KHÔNG CẦN DECODE: ORS trả về coordinates chuẩn
        const newRoute = await Route.create({
            name: name,
            orderedStops: stationIds,
            shape: {
                type: 'LineString',
                coordinates: geometry.coordinates // [[Lng, Lat], ...]
            },
            distanceMeters: Math.round(properties.summary.distance), // m
            durationSeconds: Math.round(properties.summary.duration) // s
        });

        res.status(201).json({
            status: 'success',
            data: {
                route: newRoute,
                // ORS không có encoded polyline giống Google, 
                // nhưng client có thể vẽ từ mảng coordinates trong 'route.shape'
                message: "Tạo tuyến thành công với OpenRouteService"
            }
        });

    } catch (error) {
        console.error("ORS API Error:", error.response?.data || error.message);
        return next(new AppError('Lỗi khi tính toán tuyến đường (ORS).', 500));
    }
});