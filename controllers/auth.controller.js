const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user.model");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
require("dotenv").config();

const MAX_SESSIONS = 5;

const generateAccessToken = (id) => {
    return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m'
    });
}

const generateRefreshToken = (id) => {
    const payload = {
        id: id,
        jti: crypto.randomUUID()// JWT id (Universally Unique Identifier - Định danh Duy nhất Toàn cầu)
    };
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    })
}

const sendTokenResponse = async (user, statusCode, res) => {
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await User.updateOne(
        { _id: user._id },
        {
            $push: {
                refreshToken: {
                    $each: [{ token: refreshToken, expiredAt: refreshTokenExpires }],
                    $slice: -MAX_SESSIONS
                }
            }
        }
    )

    user.password = undefined; // Không gửi lại mật khẩu

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true, // Ngan JS doc cookie
        secure: process.env.NODE_ENV === 'production', // Chir gửi qua HTTPS ở môi trường production
        // Default: localhost:3000 la underfined hoac development
        sameSite: 'strict', // Chống tấn công CSRF
        maxAge: 7 * 24 * 60 * 60 * 1000 // ms
        // path: '/' default la /
    });

    res.status(statusCode).json({
        status: "success",
        accessToken: accessToken,
        data: { user: user }
    });
};



/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
const signUp = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        phoneNumber: req.body.phoneNumber,
        password: req.body.password,
        role: req.body.role
    });

    await sendTokenResponse(newUser, 201, res);
});

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
const signIn = catchAsync(async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password)
        return next(new AppError('Please provide email/phone and password!', 400));

    // 1. Lấy user và cả password (vì có select: false trong schema)
    const user = await User.findOne({ $or: [{ phoneNumber: username }, { email: username }] }).select('+password');

    // 2. So sánh mật khẩu
    if (!user || !(await user.comparePassword(password)))
        return next(new AppError('Incorrect email, phone number, or password', 401));

    await sendTokenResponse(user, 200, res);
});

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
const logOut = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;

    // TH1: Chac chan rang khong con cookie sau khi logout
    if (!refreshToken) {
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        return res.sendStatus(204);
    }

    // TH2: chua logout
    await User.updateOne(
        { "refreshToken.token": refreshToken },
        {
            $pull: {
                refreshToken: { token: refreshToken }
            }
        }
    );

    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });

    res.sendStatus(204);
});

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
const refreshToken = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken

    if (!refreshToken)
        return next(new AppError('You are not logged in. Please log in to get access', 401));

    let decode;
    try {
        decode = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
        return next(new AppError('Invalid token. Please log in again', 401));
    }

    const user = await User.findById(decode.id);
    if (!user)
        return next(new AppError('The user belonging to this token does no longer exist.', 401));

    // user.refreshToken la 1 mang chua cac object
    const tokenInDb = user.refreshToken.find(rt => rt.token === refreshToken); // tra ve toan bo object dau tien co truong token === refreshToken
    if (!tokenInDb || tokenInDb.expiredAt < new Date())
        return next(new AppError('Token is invalid or expired. Please log in again', 401));

    const accessToken = generateAccessToken(user._id);

    res.status(200).json({
        status: "success",
        accessToken: accessToken
    });
});

const authenticateToken = catchAsync(async (req, res, next) => {
    let token;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer '))
        token = authHeader.split(' ')[1];

    if (!token)
        return next(new AppError('You are not logged in. Please log in to get access', 401));

    let decode;
    try {
        decode = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        return next(new AppError('Token is invalid or expired. Please log in again', 401));
    }

    const currentUser = await User.findById(decode.id);
    if (!currentUser)
        return next(new AppError('The user belonging to this token does no longer exist.', 401));

    // (Mo rong: Kiểm tra xem user có đổi mật khẩu sau khi token được cấp không)

    req.user = currentUser;
    next();
});

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role))
            return next(new AppError("You don't have permission to perform this action", 403));
        next();
    }
}

module.exports = { signUp, signIn, logOut, refreshToken, authenticateToken, restrictTo }