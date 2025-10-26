const AppError = require('./appError');
const catchAsync = require('./catchAsync');
const APIFeatures = require('./apiFeatures');

/** @param {import("mongoose").Model} Model */
const selectAll = (Model) => {
    return catchAsync(async (req, res, next) => {

        const features = new APIFeatures(Model.find({ isActive: { $ne: false } }), req.query).filter();

        // Lấy query đã lọc để đếm tổng số kết quả (TRƯỚC KHI phân trang)
        // Dùng .clone() để tạo một bản sao, tránh việc countDocuments bị ảnh hưởng bởi .pagination() sau này
        const countQuery = features.query.clone();

        features.sort().pagination();

        const [models, totalResults] = await Promise.all([
            features.query,
            countQuery.countDocuments() // Dem documents sau khi clone
        ]);

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const totalPages = Math.ceil(totalResults / limit);

        res.json({
            status: "success",
            result: models.length,
            data: models,
            // Gợi ý 2: Cung cấp thêm thông tin cho client
            pagination: {
                totalResults: totalResults,
                totalPages: totalPages,
                currentPage: page,
                limit: limit
            }
        })
    })
}

/** @param {import("mongoose").Model} Model */
const selectOne = (Model) => {
    return catchAsync(async (req, res, next) => {
        const doc = await Model.findById(req.params.id)

        if (!doc)
            return next(new AppError(`No document found with that ID: ${req.params.id} in Collection: ${Model.modelName}`));

        res.status(200).json({
            status: "success",
            data: doc
        })
    })
}

/** @param {import("mongoose").Model} Model */
const createOne = (Model) => {
    return catchAsync(async (req, res, next) => {
        const doc = await Model.create(req.body)

        res.status(201).json({ // 201 Created
            status: "success",
            data: doc // Chỉ trả về document vừa được tạo
        })
    })
}

/** @param {import("mongoose").Model} Model */
const updateOne = (Model) => {
    return catchAsync(async (req, res, next) => {
        const doc = await Model.findByIdAndUpdate(req.params.id,
            req.body,
            {
                new: true, // Trả về tài liệu sau khi cập nhật
                runValidators: true // Chạy lại các hàm kiểm tra hợp lệ (validators) trên schema
            }
        )

        if (!doc)
            return next(new AppError(`No document found with that ID: ${req.params.id} in Collection: ${Model.modelName}`));

        res.status(200).json({
            status: "success",
            data: doc
        })
    })
}

/** @param {import("mongoose").Model} Model */
const deleteOne = (Model) => {
    return catchAsync(async (req, res, next) => {
        const doc = await Model.findByIdAndUpdate(req.params.id, { isActive: false }); // Soft delete

        if (!doc) {
            return next(new AppError(`No document found with that ID: ${req.params.id} in Collection: ${Model.modelName}`, 404));
        }

        res.status(204).json({
            status: "success",
            data: null
        });
    })
}

module.exports = { selectAll, selectOne, createOne, updateOne, deleteOne }