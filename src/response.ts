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
  static Ok<T extends {}>(obj: any, s?: any) {
    if (s) {
      let pg = false;
      if (obj.hasOwnProperty("total")) {
        pg = true;
      }
      const data = instanceToPlain(
        plainToInstance(s, pg ? obj.data : obj, {
          enableImplicitConversion: true,
          exposeUnsetFields: false,
        }),
        { strategy: "excludeAll" },
      );
      if (pg) {
        return { message: "success", ...obj, data: data };
      } else {
        return { message: "success", data };
      }
    } else {
      return { message: "success", data: obj };
    }
  }

  static NoContent() {}
  static NotFound() {}
  static Unauthorized() {}
  static BadRequest() {}
  static InternalError() {}
  static Forbidden() {}
  static UnknownError() {}
  static MaxInputLimitExceeded() {}
  static InvalidRequest() {}
  static BadBodyFormat() {}
  static BadFileType() {}
  static InvalidHeader() {}
}
