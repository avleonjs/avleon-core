/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { Service as _service } from "typedi";
import container, { registerService } from "./container";
export function AppService(target: any): void;
export function AppService(): any;
export function AppService(target?: any) {
  if (target) {
    _service()(target);
  } else {
    return function (tg: any) {
      _service()(tg);
    };
  }
}

export * from "./controller";
export * from "./route-methods";
export * from "./openapi";
export const Utility = _service;
export const Helper = _service;
export * from "./params";
