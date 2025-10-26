const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
    licensePlate: {
        type: String,
        required: true,
        unique: true
    },
    isAssigned: { type: Boolean, default: false }, // Đang được gán lịch trình
    isActive: {
        type: Boolean,
        default: true,
        select: false
    }
});

module.exports = mongoose.model("Bus", busSchema);