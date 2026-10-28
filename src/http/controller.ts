/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import { Service } from "typedi";
import {
  API_CONTROLLER_METADATA_KEY,
  CONTROLLER_META_KEY,
  registerController,
} from "../common/container";

export const REQUEST_METADATA_KEY = Symbol("avleon:request");

export function AvleonRequest(): ParameterDecorator {
  return (target, propertyKey: any, parameterIndex) => {
    const existingParams =
      Reflect.getMetadata(REQUEST_METADATA_KEY, target, propertyKey) || [];

    existingParams.push({
      index: parameterIndex,
      type: "request",
    });

    Reflect.defineMetadata(
      REQUEST_METADATA_KEY,
      existingParams,
      target,
      propertyKey,
    );
  };
}

/**
 * Options for configuring a controller.
 */
export type ControllerOptions = {
  /**
   * Name of the controller, used as its OpenAPI tag.
   * @default the class name without the `Controller` suffix
   */
  name?: string;
  /** Base path for the controller's routes. */
  path?: string;
};

export function createControllerDecorator(
  type: "api" | "web" = "web",
): (
  pathOrOptions?: string | ControllerOptions,
  maybeOptions?: ControllerOptions,
) => ClassDecorator {
  return function (
    pathOrOptions?: string | ControllerOptions,
    maybeOptions?: ControllerOptions,
  ): ClassDecorator {
    return function (target: Function) {
      let path = "/";
      let options: ControllerOptions = {};

      if (typeof pathOrOptions === "string") {
        path = pathOrOptions;
        options = maybeOptions || {};
      } else if (typeof pathOrOptions === "object") {
        options = pathOrOptions;
        path = options.path || "/";
      }
      Reflect.defineMetadata(API_CONTROLLER_METADATA_KEY, true, target);
      // Ensure Service is applied as a ClassDecorator
      if (typeof Service === "function") {
        registerController(target); // Add to custom registry
        Service()(target); // Apply DI decorator
        Reflect.defineMetadata(
          CONTROLLER_META_KEY,
          { type, path, options },
          target,
        );
      } else {
        throw new Error("Service decorator is not a function");
      }
    };
  };
}

/**
 *@description Api controller's are used for rest . It will populate
 * json on return and all it http methods {get} {post} etc must return
 *Results.*
 * @param path {string} this will used as route prefix
 *
 **/

export function ApiController(target: Function): void;
export function ApiController(path: string): ClassDecorator;
/**
 *@description Api controller's are used for rest . It will populate
 * json on return and all it http methods {get} {post} etc must return
 * Results.*
 * @param {ControllerOptions} options this will used as route prefix
 *
 **/
export function ApiController(options: ControllerOptions): ClassDecorator;
export function ApiController(
  path: string,
  options?: ControllerOptions,
): ClassDecorator;
export function ApiController(
  pathOrOptions: Function | string | ControllerOptions = "/",
  mayBeOptions?: ControllerOptions,
): any {
  if (typeof pathOrOptions == "function") {
    Reflect.defineMetadata(API_CONTROLLER_METADATA_KEY, true, pathOrOptions);
    // Ensure Service is applied as a ClassDecorator
    if (typeof Service === "function") {
      registerController(pathOrOptions); // Add to custom registry
      Service()(pathOrOptions); // Apply DI decorator
      Reflect.defineMetadata(
        CONTROLLER_META_KEY,
        { type: "api", path: "/", options: {} },
        pathOrOptions,
      );
    } else {
      throw new Error("Service decorator is not a function");
    }
  } else {
    if (mayBeOptions) {
      return createControllerDecorator("api")(pathOrOptions, mayBeOptions);
    }
    return createControllerDecorator("api")(pathOrOptions);
  }
}
