import { getLineNumber } from "./../helpers";
import path from "path";

export class BaseHttpException extends Error {
  code: number = 500;
  name: string = "HttpException";
  constructor(message: any) {
    super(message);
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





