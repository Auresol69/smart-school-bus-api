const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const User = require('../models/user.model');
const Bus = require('../models/bus.model');
const Location = require('../models/location.model');
const Trip = require('../models/trip.model');
const Student = require('../models/student.model');

/**
 * Initializes Socket.IO event listeners and middleware.
 * @param {import('socket.io').Server} io The Socket.IO server instance.
 */
module.exports = (io) => {
    // Middleware truoc khi khoi tao ket noi
    io.use(async (socket, next) => {
        // let token = socket.handshake.auth.token; // Mo rong chua co

        const apiKey = socket.handshake.auth.apiKey;

        // handshake: Là một đối tượng chứa thông tin về "cái bắt tay" (handshake) ban đầu — tức là quá trình thiết lập kết nối. 
        // Nó chứa mọi thứ về request HTTP(S) ban đầu, bao gồm headers, địa chỉ IP, và query parameters.
        const authHeader = socket.handshake.headers['authorization'];

        try {
            if (authHeader) {
                let token;

                if (authHeader.startsWith('Bearer '))
                    token = authHeader.split(' ')[1];

                if (!token)
                    return next(new AppError('Authentication error: Token not provided.', 401));

                let decode;
                try {
                    decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
                    const user = await User.findById(decode.id).select('+isActive');
                    if (!user || !user.isActive)
                        return next(new AppError('Authentication error: User not found or inactive.', 401));

                    socket.user = user;
                    return next();

                } catch (error) {
                    return next(new AppError('Authentication error: Invalid token.', 401));
                }
            }
            else if (apiKey) {
                const bus = await Bus.findOne({ apiKey: apiKey });

                if (!bus)
                    return next(new AppError('Authentication error: Invalid API Key.', 401));

                socket.bus = bus;
                return next();
            }
            else {
                return next(new AppError('Authentication error: No credentials provided.', 401));
            }
        } catch (error) {
            return next(new AppError('Authentication error: Invalid credentials.', 401));
        }
    });

    // Xy ly su kien chinh
    io.on('connect', async (socket) => {
        // Nguoi xem
        if (socket.user) {
            const user = socket.user;
            console.log(`Một NGƯỜI XEM đã kết nối: ${socket.id} (UserId: ${user.id})`); // Tieng viet cho de hieu

            socket.join(`user:${user.id}`);
            socket.join(`role:${user.role}`);

            if (user.role === 'Admin' || user.role === 'Manager') {
                socket.join(`receive_notification`);
                // Khong join o day de tranh tinh trang xem dong thoi 300 xe :)))
                // socket.join('live-map');
            }

            // để đăng ký nhận thông báo cho chuyến đi đó.
            socket.on('join_trip_room', async (tripId) => {

                try {
                    let isAllowed = false;
                    let tripExists = false;

                    if (user.role === 'Admin' || user.role === 'Manager') {
                        const trip = await Trip.findById(tripId).select('_id');

                        if (trip) {
                            isAllowed = true;
                            tripExists = true;
                        }
                    }

                    else if (user.role === 'Parent') {
                        // Xu ly tac vu check xem co con minh trong chuyen do khong

                        const userStudents = await Student.find({ parentId: user._id }).select('_id');

                        if (userStudents.length > 0) {
                            const studentIds = userStudents.map(s => s._id);

                            const trip = await Trip.findOne(
                                {
                                    _id: tripId,
                                    'studentStops.studentId': { $in: studentIds }
                                }
                            ).select('_id');

                            if (trip) {
                                isAllowed = true;
                                tripExists = true;
                            }
                        }
                    }

                    if (isAllowed) {
                        socket.rooms.forEach(room => {
                            if (room.startsWith('trip_'))
                                socket.leave(room);
                        });
                        socket.join(`trip_${tripId}`);
                        console.log(`Một NGƯỜI XEM đã vào phòng với tripId: ${tripId} (UserId: ${user.id})`);
                    }

                    else {
                        if (!tripExists) {
                            console.log(`User ${user.id} BỊ TỪ CHỐI (Trip không tồn tại): ${tripId}`);
                        } else {
                            console.log(`User ${user.id} BỊ TỪ CHỐI (Không có quyền): ${tripId}`);
                        }
                    }

                } catch (error) {
                    console.error(`Lỗi khi ${socket.user.id} join phòng trip_${tripId}:`, error);
                }

            });

            socket.on('disconnect', () => {
                console.log(`Một NGƯỜI XEM đã ngắt kết nối: ${socket.id} (UserId: ${user.id})`); // Tieng viet cho de hieu
            });
        }
        // Nguoi gui
        else if (socket.bus) {
            const bus = socket.bus;
            console.log(`Một XE BUÝT đã kết nối: ${socket.id} (BusId: ${bus.id})`); // Tieng viet cho de hieu
            // Client (điện thoại của bạn bè): Lấy vị trí GPS (navigator.geolocation).

            // Gửi lên Server: emit tọa độ lên server (gps-ping).

            // Server (backend): Nhận tọa độ đó và emit xuống cho (người đang xem bản đồ).

            // Xe buýt phải emit sự kiện này 1 LẦN KHI BẮT ĐẦU CHUYẾN
            socket.on('driver:start_trip', async (data) => {
                try {
                    const tripId = data.tripId;
                    const busId = socket.bus.id;

                    const trip = await Trip.findById(tripId);

                    if (!trip)
                        return socket.emit('trip:error', 'Trip ID không tồn tại.');

                    if (trip.busId.toString() !== busId.toString())
                        return socket.emit('trip:error', 'Xe buýt không được gán cho chuyến này.');

                    if (trip.status !== 'NOT_STARTED') {
                        // Có thể không phải lỗi, chỉ cần báo là đã chạy rồi
                        console.log(`Xe buýt ${busId} đã RESUME chuyến ${trip._id.toString()}`);
                    } else {
                        // Tac vu bat buoc => MUST AWAIT (tranh race condition)
                        trip.status = 'IN_PROGRESS';
                        trip.actualStartTime = new Date();
                        await trip.save();
                    }

                    socket.tripId = trip._id.toString();
                    console.log(`Xe buýt ${busId} đã BẮT ĐẦU chuyến ${socket.tripId}`);
                    socket.emit('trip:started_successfully');

                } catch (error) {
                    // Nếu .save() hoặc .findById() bị lỗi, nó sẽ nhảy vào đây
                    console.error(`Lỗi khi xe ${socket.bus.id} bắt đầu chuyến ${data.tripId}:`, error.message);
                    socket.emit('trip:error', 'Lỗi server, không thể bắt đầu chuyến đi.');
                }
            });

            // ⚠️ QUAN TRỌNG: Không cho join bất kỳ phòng nào cả
            socket.on('driver:update_location', async (data) => {
                // data format: {busId: '', coords: {latitude: '',longtitude: ''}}

                // Chỉ tin vào 'bus' đax được xác thực sau Middleware tren
                const busId = socket.bus.id;
                const validatedTripId = socket.tripId;

                if (!validatedTripId) {
                    return; // Bỏ qua nếu xe chưa bắt đầu chuyến (start_trip)
                }

                // Uu tien 2 => KHONG DUNG await de tranh tac nghen
                Bus.updateCurrentStatus(busId, data.coords)
                    .catch(err => console.error(`Lỗi cập nhật status bus ${busId}:`, err));

                // Uu tien 1
                // Gui cho nhung ai dang trong phong live-map VA dang coi map
                io.to(`trip_${validatedTripId}`).emit('bus:location_changed', data.coords);

                // Chi nen su dung khi can data len bao cao
                // await Location.saveHistory(busId, data.coords);
            });

            // Da toi 1 tram
            socket.on('driver:arrived_at_station', async (data) => {
                const { stationId } = data;
                const validatedTripId = socket.tripId;

                if (!validatedTripId) {
                    console.warn(`Xe buýt ${socket.bus.id} gửi sự kiện 'arrived' (đến trạm) nhưng chưa bắt đầu chuyến đi (start_trip). Bỏ qua.`);
                    return;
                }

                // Ve Logic that su co station do trong schedule cua trip khong:
                // Chi can trong trip.studentStops co chua stationId thi di nhien la co station do.
                // 
                try {
                    const updateResult = await Trip.updateOne(
                        {
                            _id: validatedTripId,

                            // Huong giai quyet logic tren
                            'studentStops.stationId': stationId,

                            // Va chua duoc them vao actualStopTimes
                            'actualStopTimes.stationId': { $ne: stationId }
                        },
                        {
                            $push: {
                                actualStopTimes: {
                                    stationId: stationId,
                                    arrivalTime: new Date()
                                }
                            }
                        }
                    );

                    // Kiểm tra xem update có thành công không
                    if (updateResult.modifiedCount > 0) {
                        console.log(`Đã ghi nhận xe ${socket.bus.id} đến trạm ${stationId} (Hợp lệ)`);
                    } else {
                        console.warn(`Bỏ qua ghi nhận trạm ${stationId} cho chuyến ${validatedTripId} (Trạm không hợp lệ hoặc đã tồn tại)`);
                    }
                } catch (error) {
                    console.error(`Lỗi CSDL khi ghi nhận ĐẾN trạm ${stationId}:`, error);
                    socket.emit('trip:error', 'Lỗi server khi ghi nhận đến trạm.');
                }
            });

            // Da roi 1 tram
            socket.on('driver:departed_from_station', async (data) => {
                const { stationId } = data;
                const validatedTripId = socket.tripId;

                if (!validatedTripId) {
                    console.warn(`Xe buýt ${socket.bus.id} gửi sự kiện 'departed' (rời trạm) nhưng chưa bắt đầu chuyến đi (start_trip). Bỏ qua.`);
                    return;
                }

                try {
                    const updateResult = await Trip.updateOne(
                        {
                            _id: validatedTripId,

                            'actualStopTimes.stationId': stationId,

                            // kỹ thuật gọi là "Idempotency" (tạm dịch: tính bất biến).
                            // Nó đảm bảo rằng dù app của tài xế có gửi sự kiện departed 5 lần
                            // (do lag, nhấn nhầm, retry...), server cũng chỉ cập nhật 1 lần duy nhất.
                            // VD: Chỉ tìm phần tử mảng mà 'departureTime' chưa được set
                            'actualStopTimes.departureTime': { $exists: false }
                        },
                        {
                            $set: {
                                'actualStopTimes.$.departureTime': new Date()
                            }
                        }
                    );

                    // Kiểm tra xem update có thành công không
                    if (updateResult.modifiedCount > 0) {
                        console.log(`Đã ghi nhận xe ${socket.bus.id} rời trạm ${stationId} (Hợp lệ)`);
                    } else {
                        console.warn(`Lỗi khi ghi nhận xe ${socket.bus.id} RỜI trạm ${stationId}:`);
                    }

                    // Auto absent voi nhung hoc sinh chua len xe
                    // Để cập nhật TẤT CẢ các học sinh thỏa mãn điều kiện, bắt buộc phải dùng arrayFilters.
                    Trip.updateMany(
                        {
                            _id: validatedTripId
                        },
                        {
                            $set: {
                                'studentStops.$[elem].action': 'ABSENT'
                            }
                        },
                        {
                            arrayFilters: {
                                'elem.stationId': stationId,
                                'elem.action': 'PENDING'
                            }
                        }
                    )
                        .then(updateResult => {
                            if (updateResult.modifiedCount > 0) {

                                // Khong xai socket.to('room').emit() vi tai xe hoac xe buyt dang khong trong 'room' do.
                                // io la toan server quan ly tat ca nen thong bao duoc
                                // Note: Chua giai quyet duoc viec bao vang specific (cu the).
                                console.log(`Đã tự động báo vắng ${updateResult.modifiedCount} học sinh tại trạm ${stationId}`);
                                io.to(`trip_${validatedTripId}`).emit('trip:students_marked_absent',
                                    {
                                        stationId: stationId,
                                        count: updateResult.modifiedCount
                                    });
                            }
                        })
                        .catch(err => {
                            console.error(`Lỗi tự động báo vắng cho chuyến ${validatedTripId}:`, err);
                        });
                } catch (error) {
                    console.error(`Lỗi CSDL khi ghi nhận RỜI trạm ${stationId}:`, error);
                    socket.emit('trip:error', 'Lỗi server khi ghi nhận rời trạm.');
                }
            });

            // Ket thuc chuyen
            // Tài xế bấm nút KẾT THÚC
            socket.on('driver:end_trip', async () => {
                try {
                    const validatedTripId = socket.tripId;
                    const busId = socket.bus.id;

                    if (!validatedTripId) {
                        return socket.emit('trip:error', 'Không thể kết thúc chuyến đi chưa bắt đầu.');
                    }

                    // 1. Cập nhật CSDL
                    // Dùng await vì đây là tác vụ quan trọng
                    const updateResult = await Trip.updateOne(
                        { _id: validatedTripId, status: 'IN_PROGRESS' },
                        {
                            $set: {
                                status: 'COMPLETED',
                                // (Tùy chọn: Thêm trường này để biết giờ kết thúc)
                                actualEndTime: new Date()
                            }
                        }
                    );

                    if (updateResult.modifiedCount > 0) {
                        console.log(`Xe buýt ${busId} đã KẾT THÚC chuyến ${validatedTripId}`);

                        // 2. Thông báo cho Phụ huynh/Admin
                        io.to(`trip_${validatedTripId}`).emit('trip:completed');

                        // 3. Dọn dẹp
                        socket.tripId = null;
                    }

                } catch (error) {
                    console.error(`Lỗi khi xe ${socket.bus.id} kết thúc chuyến:`, error);
                    socket.emit('trip:error', 'Lỗi server khi kết thúc chuyến đi.');
                }
            });

            socket.on('disconnect', () => {
                console.log(`Một XE BUÝT đã ngắt kết nối: ${socket.id} (BusId: ${bus.id})`); // Tieng viet cho de hieu
            });
        }

    });
};