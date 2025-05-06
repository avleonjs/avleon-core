/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
export abstract class BaseHttpException extends Error {
  code: number = 500;
  name: string = "HttpException";
  constructor(message: any) {
    super(JSON.stringify(message));
  }
  isCustomException() {
    return true;  
  }
}

export class BadRequestException extends BaseHttpException {
  name: string = "BadRequest";
  code: number = 400;

  constructor(message: any) {
    super(message);
  }
}

export class ValidationErrorException extends BadRequestException {
  name: string = "ValidationError";
}

export class InternalErrorException extends BaseHttpException {
  name: string = "InternalError";
  code: number = 500;

  constructor(message: any = "Something going wrong") {
    super(message);
  }
}

export class NotFoundException extends BaseHttpException {
  name: string = "NotFound";
  code: number = 404;
  constructor(message: any) {
    super(message);
  }
}

export class UnauthorizedException extends BaseHttpException {
  name: string = "Unauthorized";
  code: number = 401;
  constructor(message: any) {
    super(message);
  }
}

export class ForbiddenException extends BaseHttpException {
  name: string = "Forbidden";
  code: number = 403;
  constructor(message: any) {
    super(message);
  }
}

export type HttpExceptionTypes =
  | NotFoundException
  | BadRequestException
  | UnauthorizedException
  | InternalErrorException
  | ForbiddenException;

// export type HttpExceptions = {
//   NotFound: (message: any) => NotFoundException,
//   ValidationError: (message: any) =>ValidationErrorException,
//   BadRequest: (message: any) => BadRequestException,
//   Unauthorized: (message: any) => UnauthorizedException,
//   Forbidden: (message: any) => ForbiddenException,
//   InternalError: (message: any) => InternalErrorException
// }
export const HttpExceptions = {
  notFound:(message:any="")=>new NotFoundException(message),
  validationError:(message:any="")=>new ValidationErrorException(message),
  badRequest:(message:any="")=>new BadRequestException(message),
  unauthorized:(message:any="")=>new UnauthorizedException(message),
  forbidden:(message:any="")=>new ForbiddenException(message),
  internalError: (message:any="")=> new InternalErrorException(message)
}
