const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    grade:{
        type: String,
        required: true
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pickupStopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station'
    },
    dropoffStopId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station'
    },
    isActive: {
        type: Boolean,
        default: true,
        select: false
    }
},{
    timestamps: true
}
);

module.exports = mongoose.model("Student", studentSchema);