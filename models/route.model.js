const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên tuyến đường là bắt buộc'],
        unique: true
    },
    orderedStops: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station'
    }],
    
    // Bộ 3 hỗ trợ cho việc vẽ tuyến đường nhựa Routes API
    shape: {
        type: {
            type: String,
            enum: ['LineString'],
            required: true
        },
        coordinates: {
            type: [[Number]],
            required: true
        }
    },
    distanceMeters: {
        type: Number,
        required: true,
        default: 0
    },
    durationSeconds: {
        type: Number,
        required: true,
        default: 0
    },

    isActive: {
        type: Boolean,
        default: true,
        select: false
    }
});

// Tìm xe chệch tuyến
routeSchema.index({ shape: '2dsphere' });

module.exports = mongoose.model("Route", routeSchema);