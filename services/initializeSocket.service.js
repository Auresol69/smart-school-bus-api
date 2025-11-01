const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const User = require('../models/user.model');
const Bus = require('../models/bus.model');
const Location = require('../models/location.model');

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
                socket.join('live-map');
            }

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

            // ⚠️ QUAN TRỌNG: Không cho join bất kỳ phòng nào cả
            socket.on('gps-ping', async (data) => {
                // data format: {busId: '', coords: {latitude: '',longtitude: ''}}

                // Chỉ tin vào 'bus' đax được xác thực sau Middleware tren
                const busId = socket.bus.id;
                const updatedBus = await Bus.updateCurrentStatus(busId, data.coords);

                // Gui cho nhung ai dang trong phong live-map VA dang coi map
                io.to('live-map').emit('bus-moved', updatedBus);

                // Chi nen su dung khi can data len bao cao
                // await Location.saveHistory(data.busId, data.coords);
            });

            socket.on('disconnect', () => {
                console.log(`Một XE BUÝT đã ngắt kết nối: ${socket.id} (BusId: ${bus.id})`); // Tieng viet cho de hieu
            });
        }

    });
};