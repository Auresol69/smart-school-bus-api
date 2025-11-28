class APIFeatures {
    // CHAINING: features.filter().limitField().pagination()
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    filter() {
        const queryObj = { ...this.queryString };
        const excludeFields = ['page', 'limit', 'sort', 'fields']; // fields: Mo rong

        excludeFields.forEach(el => delete queryObj[el]); // Xóa các trường đặc biệt ra khỏi đối tượng filter

        this.query = this.query.find(queryObj);

        return this; // chaining, this = object APIFeatures moi
    }

    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        }
        else {
            this.query = this.query.sort('-createdAt'); // default: thoi gian gan day nhat
        }

        return this; // chaining, this = object APIFeatures moi
    }

    pagination() {
        const page = parseInt(this.queryString.page, 10) || 1;
        const limit = parseInt(this.queryString.limit, 10) || 10;

        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);

        return this; // chaining, this = object APIFeatures moi
    }

    // Mo rong (api/users?fields=name, email) 
    // Note: không cho phép trộn lẫn giữa việc "chọn lấy" (inclusion) và "loại bỏ" (exclusion)
    limitField() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        }
        else
            this.query = this.query.select('-__v');

        return this;
    }
};

module.exports = APIFeatures