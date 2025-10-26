const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: 1
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        index: 1
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    refreshToken: [{
        token: {
            type: String,
            required: true
        },
        // userAgent: String, Mo rong: Luu thong tin thiet bi, browser
        createAt: {
            type: Date,
            default: Date.now
        },
        expiredAt: {
            type: Date,
            // TTL
        }
    }],
    role: {
        type: String,
        enum: ['Admin', 'Manager', 'Parent', 'Driver'],
        required: true
    },
    isActive: {
        type: Boolean,
        default: true,
        select: false
    },
});

userSchema.pre('save', async function (next) {
    // Chỉ chạy hàm này nếu mật khẩu đã được thay đổi (hoặc là mới)
    if (!this.isModified('password')) return next();

    // Băm mật khẩu với cost factor là 12
    this.password = await bcrypt.hash(this.password, 12);

    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Bug: vi se xoa luon ca document cha tuc la User
// // TTL (index + expireAfterSeconds)
// userSchema.index({"refreshToken.expiredAt": 1}, {expireAfterSeconds: 0});

module.exports = userSchema;