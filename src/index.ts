/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import * as sw from "./swagger-schema";
export * from "./icore";
export * from "./testing";
export { inject, validateRequestBody, pick, exclude } from "./helpers";
export * from "./decorators";
export * from "./middleware";
export * from "./config";
export * from "./openapi";
export * from "./map-types";
export * from "./response";
export * from "./exceptions";
export * from "./validator-extend";
export * from "./validation";
export * from "./environment-variables";
export * from "./collection";
export * from "./queue";
export * from "./utils/hash";
export * from "./multipart";
export * from "./file-storage";
export * from "./logger";
export * from "./event-dispatcher";
export * from "./kenx-provider";
export { Subscribe, Private } from "./event-subscriber";

export const GetSchema = sw.generateSwaggerSchema;
export const GetObjectSchema = sw.CreateSwaggerObjectSchema;
export const OpenApiOk = (args1:any)=>{
    return sw.OpenApiResponse(200, args1, "Success");
}
export const OpenApiResponse = sw.OpenApiResponse;
export const OpenApiProperty = sw.OpenApiProperty;

export { default as AvleonContainer } from "./container";
