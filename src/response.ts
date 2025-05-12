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
  ClassTransformer,
} from 'class-transformer';

export interface IHttpResponse<T extends any> {
  message: string;
  data: T | null;
}

function isClassTransformerClass(target: any): boolean {
  const prototype = target.prototype;
  const keys = Reflect.getMetadataKeys(prototype);

  // Check for class-transformer metadata
  return keys.some((key) => key.startsWith('class_transformer:'));
}

function isClassTransformerType<T>(target: new () => T): boolean {
  return isClassTransformerClass(target);
}

export class HttpResponse {
  static Ok<T>(obj: any, s?: ClassConstructor<T>): IHttpResponse<T> {
    if (s) {
      const isPaginated = obj?.hasOwnProperty('total');
      const dataToTransform = isPaginated ? obj.data : obj;

      const transformedData = plainToInstance(s, dataToTransform, {
        enableImplicitConversion: true,
        excludeExtraneousValues: true,
      });

      const transformedResult = isPaginated
        ? { ...obj, data: instanceToPlain(transformedData) }
        : { data: instanceToPlain(transformedData) };

      return {
        message: 'success',
        ...transformedResult,
      };
    }

    return { message: 'success', data: obj };
  }

  static Created<T>(obj: any, s?: ClassConstructor<T>): IHttpResponse<T> {
    if (s) {
      const transformedData = plainToInstance(s, obj, {
        enableImplicitConversion: true,
        excludeExtraneousValues: true,
      });

      return {
        message: 'created',
        data: instanceToPlain(transformedData) as T,
      };
    }

    return { message: 'created', data: obj };
  }

  static NoContent(): IHttpResponse<null> {
    return { message: 'no content', data: null };
  }
}
