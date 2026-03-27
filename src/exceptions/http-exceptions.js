"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptions = exports.ForbiddenException = exports.UnauthorizedException = exports.NotFoundException = exports.InternalErrorException = exports.ValidationErrorException = exports.BadRequestException = exports.BaseHttpException = void 0;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
class BaseHttpException extends Error {
    code = 500;
    name = "HttpException";
    payload;
    constructor(message) {
        const stringMessage = typeof message === "string" ? message : JSON.stringify(message);
        super(stringMessage);
        this.payload = typeof message === "string" ? { message } : message;
    }
    isCustomException() {
        return true;
    }
}
exports.BaseHttpException = BaseHttpException;
class BadRequestException extends BaseHttpException {
    name = "BadRequest";
    code = 400;
    constructor(message) {
        super(message);
    }
}
exports.BadRequestException = BadRequestException;
class ValidationErrorException extends BadRequestException {
    name = "ValidationError";
}
exports.ValidationErrorException = ValidationErrorException;
class InternalErrorException extends BaseHttpException {
    name = "InternalError";
    code = 500;
    constructor(message = "Something going wrong") {
        super(message);
    }
}
exports.InternalErrorException = InternalErrorException;
class NotFoundException extends BaseHttpException {
    name = "NotFound";
    code = 404;
    constructor(message) {
        super(message);
    }
}
exports.NotFoundException = NotFoundException;
class UnauthorizedException extends BaseHttpException {
    name = "Unauthorized";
    code = 401;
    constructor(message) {
        super(message);
    }
}
exports.UnauthorizedException = UnauthorizedException;
class ForbiddenException extends BaseHttpException {
    name = "Forbidden";
    code = 403;
    constructor(message) {
        super(message);
    }
}
exports.ForbiddenException = ForbiddenException;
// export type HttpExceptions = {
//   NotFound: (message: any) => NotFoundException,
//   ValidationError: (message: any) =>ValidationErrorException,
//   BadRequest: (message: any) => BadRequestException,
//   Unauthorized: (message: any) => UnauthorizedException,
//   Forbidden: (message: any) => ForbiddenException,
//   InternalError: (message: any) => InternalErrorException
// }
exports.HttpExceptions = {
    notFound: (message = "") => new NotFoundException(message),
    validationError: (message = "") => new ValidationErrorException(message),
    badRequest: (message = "") => new BadRequestException(message),
    unauthorized: (message = "") => new UnauthorizedException(message),
    forbidden: (message = "") => new ForbiddenException(message),
    internalError: (message = "") => new InternalErrorException(message),
};
