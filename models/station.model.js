const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    street: String,
    city: String,
    district: String,
    fullAddress: {
        type: String,
        required: true
    },
    latitude: {
        type: Number,
        required: true
    },
    longitude: {
        type: Number,
        required: true
    }
}, { _id: false });

const stationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    address: {
        type: addressSchema,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true,
        select: false
    },
});

module.exports = mongoose.model("Station", stationSchema);