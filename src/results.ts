export type OkOptions = {
  streamable: boolean;
};

export class Results {
  static code = 500;
  message: string = "Something going wrong";

  static Ok<T>(data: T): Ok<T> {
    return new Ok<T>(data);
  }
  static NoContent() {
    this.code = 204;
  }
  static OkStream() {
    
  }
  static NotFound<T>(message: T) {
    return new NotFound<T>(message);
  }
}

export class Ok<T> {
  constructor(public data: T) {}
}

export class NotFound<T> {
  constructor(public message: T) {}
}

// This type ensures methods must return Results.Ok
export type RouteResult<T = any> = typeof Results.Ok<T>;
