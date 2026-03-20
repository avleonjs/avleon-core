/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import * as sw from "./swagger-schema";
import "reflect-metadata";
export * from "./decorators";
export * from "./interfaces/avleon-application";
export * from "./core/application";
export * from "./core/testing";
export * from "./core/types";
export * from "./helpers";
export * from "./response";
export * from "./exceptions";
export * from "./openapi";
export * from "./swagger-schema";
export * from "./container";
export * from "./middleware";
export * from "./kenx-provider";
export * from "./collection";
export * from "./event-dispatcher";
export * from "./event-subscriber";
export * from "./queue";
export * from "./file-storage";
export * from "./config";
export * from "./logger";
export * from "./cache";
export * from "./results";
export * from "./environment-variables";

export const GetSchema = sw.generateSwaggerSchema;
export const GetObjectSchema = sw.CreateSwaggerObjectSchema;
export const OpenApiOk = (args1: any) => {
    return sw.OpenApiResponse(200, args1, "Success");
}
export const OpenApiResponse = sw.OpenApiResponse;
export const OpenApiProperty = sw.OpenApiProperty;

export { default as AvleonContainer } from "./container";
