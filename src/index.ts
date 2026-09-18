/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import "reflect-metadata";
import * as sw from "./openapi/swagger-schema";

// ─── Core ────────────────────────────────────────────────────────────────────
export * from "./core/application";
export * from "./core/interfaces";
export * from "./core/types";
export * from "./core/testing";
export * from "./core/mock-db";

// ─── HTTP ────────────────────────────────────────────────────────────────────
export * from "./http";

// ─── OpenAPI ─────────────────────────────────────────────────────────────────
export * from "./openapi";

// ─── Data ────────────────────────────────────────────────────────────────────
export * from "./data";

// ─── Config ──────────────────────────────────────────────────────────────────
export * from "./config";

// ─── Events ──────────────────────────────────────────────────────────────────
export * from "./events";

// ─── Queue ───────────────────────────────────────────────────────────────────
export * from "./queue";

// ─── Scheduler ───────────────────────────────────────────────────────────────
export * from "./scheduler/schedule-decorator";

// ─── Security ────────────────────────────────────────────────────────────────
export * from "./security";

// ─── Storage / Realtime / Observability ──────────────────────────────────────
export * from "./storage";
export * from "./realtime";
export * from "./observability";

// ─── Common ──────────────────────────────────────────────────────────────────
export * from "./common/decorators";
export * from "./common/helpers";
export * from "./common/container";
export * from "./common/exceptions";

// ─── Convenience aliases ─────────────────────────────────────────────────────
export const GetSchema = sw.generateSwaggerSchema;
export const GetObjectSchema = sw.CreateSwaggerObjectSchema;
export const OpenApiOk = (args1: any) => {
  return sw.OpenApiResponse(200, args1, "Success");
};
export const OpenApiResponse = sw.OpenApiResponse;
export const OpenApiProperty = sw.OpenApiProperty;

export { default as AvleonContainer } from "./common/container";
