/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import {
  instanceToPlain,
  plainToInstance,
  ClassConstructor,
} from "class-transformer";
import { withStatus } from "./results";

export interface IHttpResponse<T extends any> {
  message: string;
  data: T | null;
}

export class HttpResponse {
  static Ok<T>(obj: any, s?: ClassConstructor<T>): IHttpResponse<T> {
    if (s) {
      const isPaginated = obj?.hasOwnProperty("total");
      const dataToTransform = isPaginated ? obj.data : obj;

      const transformedData = plainToInstance(s, dataToTransform, {
        enableImplicitConversion: true,
        excludeExtraneousValues: true,
      });

      const transformedResult = isPaginated
        ? { ...obj, data: instanceToPlain(transformedData) }
        : { data: instanceToPlain(transformedData) };

      return {
        message: "success",
        ...transformedResult,
      };
    }

    return { message: "success", data: obj };
  }

  static Created<T>(obj: any, s?: ClassConstructor<T>): IHttpResponse<T> {
    if (s) {
      const transformedData = plainToInstance(s, obj, {
        enableImplicitConversion: true,
        excludeExtraneousValues: true,
      });

      return withStatus(
        { message: "created", data: instanceToPlain(transformedData) as T },
        201,
      );
    }

    return withStatus({ message: "created", data: obj }, 201);
  }

  /** Responds with 204 and an empty body. */
  static NoContent(): IHttpResponse<null> {
    return withStatus({ message: "no content", data: null }, 204);
  }
}
