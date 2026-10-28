/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import type { Readable } from "stream";

/**
 * Non-enumerable marker the router reads to pick the response status code for
 * a plain object (see `HttpResponse.Created`). It never appears in the JSON.
 */
export const HTTP_STATUS_KEY = Symbol.for("avleon:http-status");

/** Attach a status code to a plain response object without changing its JSON. */
export function withStatus<T extends object>(body: T, statusCode: number): T {
  Object.defineProperty(body, HTTP_STATUS_KEY, {
    value: statusCode,
    enumerable: false,
    configurable: true,
  });
  return body;
}

/**
 * Base class for values a route can return to control the status code,
 * headers and body. The router sends `body` with `statusCode`.
 */
export abstract class HttpResult<B = unknown> {
  abstract readonly statusCode: number;
  readonly headers: Record<string, string> = {};
  abstract readonly body: B | undefined;
}

export class Ok<T> extends HttpResult<{ data: T }> {
  readonly statusCode = 200;
  constructor(public readonly data: T) {
    super();
  }
  get body() {
    return { data: this.data };
  }
}

export class Created<T> extends HttpResult<{ data: T }> {
  readonly statusCode = 201;
  constructor(public readonly data: T) {
    super();
  }
  get body() {
    return { data: this.data };
  }
}

export class NoContent extends HttpResult<undefined> {
  readonly statusCode = 204;
  readonly body = undefined;
}

export class NotFound<T = string> extends HttpResult<{
  code: 404;
  status: "Error";
  message: T;
}> {
  readonly statusCode = 404;
  constructor(public readonly message: T) {
    super();
  }
  get body() {
    return {
      code: 404 as const,
      status: "Error" as const,
      message: this.message,
    };
  }
}

export type OkStreamOptions = {
  /** Defaults to `application/octet-stream`. */
  contentType?: string;
  /** When set, the stream is sent as an attachment with this filename. */
  filename?: string;
};

export class OkStream extends HttpResult<Readable> {
  readonly statusCode = 200;
  constructor(
    public readonly stream: Readable,
    public readonly options: OkStreamOptions = {},
  ) {
    super();
  }
  get body() {
    return this.stream;
  }
}

/**
 * Factory helpers for route results. Each one sets the status code:
 *
 *   return Results.Ok(user);          // 200 { data: user }
 *   return Results.Created(user);     // 201 { data: user }
 *   return Results.NoContent();       // 204, empty body
 *   return Results.NotFound("nope");  // 404 { code, status, message }
 *   return Results.OkStream(stream, { contentType: "text/csv" });
 */
export class Results {
  static Ok<T>(data: T): Ok<T> {
    return new Ok<T>(data);
  }
  static Created<T>(data: T): Created<T> {
    return new Created<T>(data);
  }
  static NoContent(): NoContent {
    return new NoContent();
  }
  static OkStream(stream: Readable, options?: OkStreamOptions): OkStream {
    return new OkStream(stream, options);
  }
  static NotFound<T>(message: T): NotFound<T> {
    return new NotFound<T>(message);
  }
}

export type RouteResult<T = any> = typeof Results.Ok<T>;
