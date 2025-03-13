/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import "reflect-metadata";
import {
  instanceToPlain,
  plainToInstance,
  ClassConstructor,
  ClassTransformer,
} from "class-transformer";

export interface IHttpResponse<T extends any> {
  message: string;
  data: T | null;
}
function isClassTransformerClass(target: any): boolean {
  const prototype = target.prototype;
  const keys = Reflect.getMetadataKeys(prototype);

  // Check for class-transformer metadata
  return keys.some((key) => key.startsWith("class_transformer:"));
}
function isClassTransformerType<T>(target: new () => T): boolean {
  return isClassTransformerClass(target);
}

export class HttpResponse {
  static Ok<T>(obj: any, s?: ClassConstructor<T>) {
    if (s) {
      const isPaginated = obj?.hasOwnProperty("total");
      // Ensure transformation applies only allowed properties
      const transformedData = plainToInstance(
        s,
        isPaginated ? obj.data : obj,
        {
          enableImplicitConversion: true,
          excludeExtraneousValues: true, // Ensures only @Expose() properties are included
        }
      );

      return {
        message: "success",
        ...(isPaginated ? { ...obj, data: instanceToPlain(transformedData) } : { data: instanceToPlain(transformedData) }),
      };
    }

    return { message: "success", data: obj };
  }

  static NoContent() {}
}
