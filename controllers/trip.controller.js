const Trip = require('../models/trip.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('../utils/handlerFactory');
const scheduleModel = require('../models/schedule.model');
const tripModel = require('../models/trip.model');
const studentModel = require('../models/student.model');
const NotificationModel = require('../models/notification.model')

// Sử dụng lại factory cho các hành động đơn giản
exports.getAllTrips = factory.selectAll(Trip);
exports.getTrip = factory.selectOne(Trip);
exports.deleteTrip = factory.deleteOne(Trip);

/**
 * Tạo một chuyến đi mới.
 * Logic phức tạp hơn việc chỉ tạo document đơn thuần.
 * Ví dụ: Có thể cần kiểm tra xem lịch trình có đang hoạt động không,
 * hoặc gửi thông báo khi tạo chuyến đi.
 */
exports.createTrip = catchAsync(async (req, res, next) => {
    try {
        // Sử dụng Trip.create để Mongoose tự động gọi new và save()
        // Hook pre('save') sẽ được kích hoạt tự động
        const newTrip = await Trip.create(req.body);

        res.status(201).json({
            status: 'success',
            data: newTrip,
        });
    } catch (error) {
        // Bắt lỗi validation từ Mongoose (nếu có)
        if (error.name === 'ValidationError') {
            return next(new AppError(error.message, 400));
        }
        next(error); // Chuyển các lỗi khác (ví dụ: lỗi từ pre-save hook) đi tiếp
    }
});

/**
 * Cập nhật một chuyến đi.
 * Có thể có các quy tắc nghiệp vụ đặc biệt, ví dụ: không cho phép
 * thay đổi tài xế/xe buýt khi chuyến đi đang diễn ra.
 */
exports.updateTrip = catchAsync(async (req, res, next) => {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
        return next(new AppError(`No trip found with that ID: ${req.params.id}`, 404));
    }

    // Ví dụ về nghiệp vụ: Không cho phép thay đổi thông tin quan trọng khi chuyến đi đang diễn ra
    if (trip.status === 'IN_PROGRESS' && (req.body.driverId || req.body.busId)) {
        return next(new AppError('Cannot change driver or bus while the trip is in progress.', 400));
    }

    // Tối ưu: Thay vì gọi lại factory (sẽ query lại DB),
    // chúng ta cập nhật trực tiếp trip đã tìm thấy.
    Object.assign(trip, req.body);

    // trip.save() sẽ kích hoạt hook pre('save') để kiểm tra xung đột
    const updatedTrip = await trip.save();

    res.status(200).json({
        status: 'success',
        data: {
            data: updatedTrip,
        },
    });
});

/**
 * Lấy các chuyến đi (trips) được phân công cho tài xế trong ngày hôm nay.
 */
exports.getMySchedule = catchAsync(async (req, res, next) => {
    const today = new Date();

    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

    // 1. Tìm tất cả các lịch trình (schedules) đang hoạt động của tài xế cho ngày hôm nay
    const activeSchedules = await scheduleModel.find({
        driverId: req.user.id,
        isActive: true,
        startDate: { $lte: today },
        endDate: { $gte: today },
        daysOfWeek: dayOfWeek
    }).select('_id');

    if (!activeSchedules.length) {
        return res.status(200).json({
            status: 'success',
            results: 0,
            data: [], // Trả về mảng rỗng nếu không có lịch trình nào
        });
    }

    const scheduleIds = activeSchedules.map(s => s._id);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todaysTrips = await Trip.find({
        scheduleId: { $in: scheduleIds },
        tripDate: { $gte: startOfDay, $lte: endOfDay }
    }).populate({
        path: 'busId',
        select: 'licensePlate'
    });

    res.status(200).json({
        status: "success",
        results: todaysTrips.length,
        data: todaysTrips,
    });
});

exports.getStudents = catchAsync(async (req, res, next) => {
    const tripId = req.params.id;

    const trip = await tripModel.findById(tripId).populate({
        path: 'studentStops.studentId',
        select: 'name grade'
    }).populate({
        path: 'studentStops.stationId',
        select: 'name'
    });

    if (!trip) {
        return next(new AppError("No trip found with that ID", 404));
    }

    res.status(200).json({
        status: "success",
        data: trip.studentStops
    });
});

/**
 * Cập nhật trạng thái của một học sinh trong một chuyến đi (check-in/check-out/absent).
 * @param {'PICKED_UP' | 'DROPPED_OFF' | 'ABSENT'} action - Hành động cần thực hiện.
 */
const updateStudentStatusInTrip = (action) => catchAsync(async (req, res, next) => {
    const tripId = req.params.id;
    const { studentId, stationId } = req.body;

    if (!studentId) {
        return next(new AppError("Please provide a studentId.", 400));
    }

    // Sử dụng findOneAndUpdate để tìm và cập nhật trong một thao tác (atomic)
    // Điều kiện: tìm đúng trip và đúng studentId trong mảng studentStops
    // Cập nhật: set action và timestamp cho studentStop tương ứng
    const updatedTrip = await tripModel.findOneAndUpdate(
        {
            _id: tripId,
            'studentStops.studentId': studentId
        },
        {
            $set: {
                // Xu ly luon ca truong hop Student don tram sau
                'studentStops.$.stationId': stationId,
                'studentStops.$.action': action,

                'studentStops.$.timestamp': new Date()
            }
        },
        {
            new: true, // Trả về document đã được cập nhật
            runValidators: true
        }
    );

    if (!updatedTrip) {
        return next(new AppError('Trip not found or student not on this trip.', 404));
    }

    const currentStudentStop = updatedTrip.studentStops.find(s => s.studentId.toString() === studentId);

    if (currentStudentStop && (action === 'PICKED_UP' || action === 'DROPPED_OFF')) {
        const fieldToUpdate = action === 'PICKED_UP' ? 'pickupStopId' : 'dropoffStopId';

        const updatePayload = { [fieldToUpdate]: currentStudentStop.stationId };

        // tac vu doc lap nen khong can await
        studentModel.findByIdAndUpdate(studentId, { $set: updatePayload });
    }

    // (Như cũ - Báo cho live-map biết trạng thái đã thay đổi)
    req.io.to(`trip_${updatedTrip._id}`).emit('student:checked_in', {
        studentId: studentId,
        action: action
    });

    studentModel.findById(studentId).select('name parentId')
        .then(student => {
            if (!student || !student.parentId)
                return;

            let message;
            if (action === 'PICKED_UP') {
                message = `Con của bạn, ${student.name}, đã được đón lên xe.`;
            } else if (action === 'DROPPED_OFF') {
                message = `Con của bạn, ${student.name}, đã được trả xuống xe.`;
            } else if (action === 'ABSENT') {
                message = `Con của bạn, ${student.name}, đã bị đánh dấu vắng mặt.`;
            } else {
                return; // Không thông báo cho 'PENDING'
            }

            NotificationModel.create({
                recipientId: student.parentId,
                contextStudentId: studentId,
                message: message
            });

            req.io.to(`user:${student.parentId}`).emit(`notification:new`, {
                message: message,
                studentId: studentId,
                action: action
            });
        })
        .catch(err => console.error('Lỗi lưu notification:', err));


    res.status(200).json({
        status: 'success',
        message: `Student status updated to ${action}.`,
        data: updatedTrip.studentStops.find(s => s.studentId.toString() === studentId)
    });
});

/**
 * Check-in một học sinh.
 * Dựa vào `direction` của chuyến đi để quyết định trạng thái là 'PICKED_UP' hay 'DROPPED_OFF'.
 */
exports.checkIn = catchAsync(async (req, res, next) => {
    const trip = await tripModel.findById(req.params.id).select('direction');
    if (!trip) {
        return next(new AppError('Trip not found.', 404));
    }

    const action = trip.direction === 'PICK_UP' ? 'PICKED_UP' : 'DROPPED_OFF';
    return updateStudentStatusInTrip(action)(req, res, next);
});

exports.markAsAbsent = updateStudentStatusInTrip('ABSENT');