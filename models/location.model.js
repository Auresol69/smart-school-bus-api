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
        index: -1
    }
});

module.exports = mongoose.model("Location", locationSchema);