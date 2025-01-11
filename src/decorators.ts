import { Service as _service } from "typedi";
import container, { registerService } from "./container";
export const AppService = _service;

export * from "./controller";
export * from "./route-methods";
export * from "./openapi";
export const Utility = _service;
export const Helper = _service;
export * from "./params";
