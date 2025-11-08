const mongoose = require("mongoose");
const scheduleModel = require("./schedule.model");
const AppError = require("../utils/appError");

const studentStopSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    // PENDING: Trạng thái chờ, khi chuyến đi mới được tạo
    action: {
        enum: ['PENDING', 'PICKED_UP', 'DROPPED_OFF', 'ABSENT'],
        type: String,
        default: 'PENDING',
        required: true
    },
    timestamp: { type: Date } // Thoi gian quet RFID (null khi PENDING | ABSENT)
}, { _id: false });

const actualStopTimeSchema = new mongoose.Schema({
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    arrivalTime: { type: Date, required: true }, // toi tram
    departureTime: { type: Date } // roi tram
}, { _id: false });

const tripSchema = new mongoose.Schema({
    scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule',
        required: true
    },

    // **TỐI ƯU: Denormalization (Phi chuẩn hóa) để tăng hiệu suất**
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    direction: {
        type: String,
        enum: ['PICK_UP', 'DROP_OFF'],
        required: true
    },

    tripDate: {
        type: Date,
        required: true,
    },
    actualStartTime: {
        type: Date
    },
    actualEndTime: {
        type: Date
    },
    status: {
        type: String,
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'NOT_STARTED'
    },
    studentStops: [studentStopSchema], // Theo dõi trạng thái của từng học sinh tại mỗi trạm
    actualStopTimes: [actualStopTimeSchema] // Theo dõi thời gian thực tế xe đến mỗi trạm
});

// To prevent creating duplicate trips for the same schedule on the same day
tripSchema.index({ scheduleId: 1, tripDate: 1 }, { unique: true });

tripSchema.index({ scheduleId: 1, driverId: 1 });
tripSchema.index({ scheduleId: 1, busId: 1 });

// Middleware chay truoc khi kiem tra
tripSchema.pre('validate', async function (next) {

    // vua moi khoi tao
    if (this.isNew) {
        const schedule = await scheduleModel.findById(this.scheduleId);

        if (!schedule)
            return next(new AppError(`Schedule doesn't exist, please try again.`, 404));

        const { startDate, endDate } = schedule;

        const tripDateStart = new Date(this.tripDate.toISOString().split('T')[0] + 'T00:00:00.000Z');

        const scheduleStart = new Date(startDate);
        scheduleStart.setUTCHours(0, 0, 0, 0);

        const scheduleEnd = new Date(endDate);
        scheduleEnd.setUTCHours(0, 0, 0, 0);


        if (tripDateStart < scheduleStart || tripDateStart > scheduleEnd)
            return next(new AppError(`Invalid tripDate: Trip date (${tripDateStart.toISOString().split('T')[0]}) is outside the valid schedule range (${scheduleStart.toISOString().split('T')[0]} to ${scheduleEnd.toISOString().split('T')[0]}).`, 400));

        this.driverId = schedule.driverId;
        this.busId = schedule.busId;
        this.direction = schedule.direction;

        const initialStudentStops = [];

        schedule.stopTimes.forEach(stop => {
            stop.studentIds.forEach(studentId => {
                initialStudentStops.push({
                    studentId: studentId,
                    stationId: stop.stationId
                });
            });
        }
        );

        this.studentStops = initialStudentStops;

        return next();
    }

    // Logic khi UPDATE một chuyến đi
    if (this.isModified('driverId') || this.isModified('busId') || this.isModified('tripDate')) {
        const startOfDay = new Date(this.tripDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(this.tripDate);
        endOfDay.setHours(23, 59, 59, 999);

        const conflictQuery = {
            _id: { $ne: this._id }, // Loại trừ chính chuyến đi này
            tripDate: { $gte: startOfDay, $lte: endOfDay }, // Xung đột trong cùng một ngày
            direction: this.direction, // Và cùng một chiều (cùng buổi)
            $or: [ // Khi tài xế HOẶC xe buýt đã được gán cho chuyến khác
                { driverId: this.driverId },
                { busId: this.busId }
            ],
        };

        const conflictingTrip = await this.constructor.findOne(conflictQuery);
        if (conflictingTrip) {
            const message = 'Trip conflict: The selected driver or bus is already assigned to another trip on the same day and direction.';
            return next(new AppError(message, 409)); // 409 Conflict
        }
    }

    next();
});

module.exports = mongoose.model("Trip", tripSchema);