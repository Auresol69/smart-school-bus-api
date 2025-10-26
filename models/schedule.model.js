const mongoose = require("mongoose");

const stopTimesSchema = new mongoose.Schema({
    stationId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: true
    },
    arrivalAt:{
        type: Date,
        required: true
    }
})

const scheduleSchema = new mongoose.Schema({
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: true
    },
    busId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bus',
        required: true
    },
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    stopTimes: [stopTimesSchema],
    studentIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    isActive: {
        type: Boolean,
        default: true,
        select: false
    }
});

module.exports = mongoose.model("Schedule", scheduleSchema);