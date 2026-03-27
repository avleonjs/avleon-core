"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFound = exports.Ok = exports.Results = void 0;
class Results {
    static code = 500;
    message = "Something going wrong";
    static Ok(data) {
        return new Ok(data);
    }
    static NoContent() {
        this.code = 204;
    }
    static OkStream() { }
    static NotFound(message) {
        return new NotFound(message);
    }
}
exports.Results = Results;
class Ok {
    data;
    constructor(data) {
        this.data = data;
    }
}
exports.Ok = Ok;
class NotFound {
    message;
    constructor(message) {
        this.message = message;
    }
}
exports.NotFound = NotFound;
