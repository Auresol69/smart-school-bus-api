const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

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
    },
    currentLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        timestamp: { type: Date }
    },
    // ⚠️ Chú ý quan trọn: api Key de cho xe buyt chi gui toa do chu khong doc duoc
    apiKey: {
        type: String,
        required: true,
        unique: true,
        default: () => uuidv4()
    }
});

busSchema.statics.updateCurrentStatus = async function (busId, newCoordinates) {
    const { latitude, longitude } = newCoordinates;
    return await this.findByIdAndUpdate(
        busId,
        {
            $set: {
                currentLocation: { latitude, longitude, timestamp: Date.now() }
            }
        },
        { new: true }
    )
}

module.exports = mongoose.model("Bus", busSchema);