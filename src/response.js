"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpResponse = void 0;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const class_transformer_1 = require("class-transformer");
function isClassTransformerClass(target) {
    const prototype = target.prototype;
    const keys = Reflect.getMetadataKeys(prototype);
    // Check for class-transformer metadata
    return keys.some((key) => key.startsWith("class_transformer:"));
}
function isClassTransformerType(target) {
    return isClassTransformerClass(target);
}
class HttpResponse {
    static Ok(obj, s) {
        if (s) {
            const isPaginated = obj?.hasOwnProperty("total");
            const dataToTransform = isPaginated ? obj.data : obj;
            const transformedData = (0, class_transformer_1.plainToInstance)(s, dataToTransform, {
                enableImplicitConversion: true,
                excludeExtraneousValues: true,
            });
            const transformedResult = isPaginated
                ? { ...obj, data: (0, class_transformer_1.instanceToPlain)(transformedData) }
                : { data: (0, class_transformer_1.instanceToPlain)(transformedData) };
            return {
                message: "success",
                ...transformedResult,
            };
        }
        return { message: "success", data: obj };
    }
    static Created(obj, s) {
        if (s) {
            const transformedData = (0, class_transformer_1.plainToInstance)(s, obj, {
                enableImplicitConversion: true,
                excludeExtraneousValues: true,
            });
            return {
                message: "created",
                data: (0, class_transformer_1.instanceToPlain)(transformedData),
            };
        }
        return { message: "created", data: obj };
    }
    static NoContent() {
        return { message: "no content", data: null };
    }
}
exports.HttpResponse = HttpResponse;
