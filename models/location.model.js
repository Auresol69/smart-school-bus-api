const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
    busId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bus',
        required: true,
        index: 1
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: -1,
        expires: '7d'
    }
});

const lastSaveTimestamps = new Map();
const SAVE_INTERVAL = 30000; // ms

// LƯU LỊCH SỬ (có lọc)
locationSchema.statics.saveHistory = async function (busId, newCoords) {
    const { latitude, longitude } = newCoords;
    const now = Date.now();

    // Lấy thời gian lưu cuối cùng của xe này
    const lastSave = lastSaveTimestamps.get(busId) || 0;

    // Chỉ lưu nếu đã quá 30 giây
    if (now - lastSave < SAVE_INTERVAL) {
        return;
    }

    // Đur thời gian -> Tiến hành lưu
    lastSaveTimestamps.set(busId, now); // Cập nhật thời gian lưu cuối

    return this.create({
        busId: busId,
        latitude: latitude,
        longitude: longitude,
        timestamp: now
    });
};

module.exports = mongoose.model("Location", locationSchema);