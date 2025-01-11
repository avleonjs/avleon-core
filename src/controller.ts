import Container, { Service } from "typedi";
import container, { API_CONTROLLER_METADATA_KEY, CONTROLLER_META_KEY, registerController } from "./container";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
/**
 * Options for configuring a controller.
 * @remarks
 * Controller default options
 * @type {Object} ControllerOptions
 * @property {string} [name] - The name of the controller.
 * @property {string} [path] - The base path for the controller's routes.
 * @property {string} [version] - The version of the controller. If not provided, it will default to the version from `package.json`.
 * @property {string} [since] - The date or version since the controller was introduced.
 * @property {any} [meta] - Additional metadata associated with the controller.
 */
export type ControllerOptions = {
  /**
   *@property {string} name
   *@description Name of the controller. If specified it'll used as  swagger tags
   *@default Contorller class name
   * */
  name?: string;
  path?: string;
  version?: string; // Will look at package.json if not set
  since?: string;
  meta?: any;
};

export function createControllerDecorator(
  type: "api" | "web" = "web",
): (
  pathOrOptions?: string | ControllerOptions,
  maybeOptions?: ControllerOptions,
) => ClassDecorator {
  return function(
    pathOrOptions?: string | ControllerOptions,
    maybeOptions?: ControllerOptions,
  ): ClassDecorator {
    return function(target: Function) {
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
        Reflect.defineMetadata(CONTROLLER_META_KEY, { type, path, options }, target);
      } else {
        throw new Error("Service decorator is not a function");
      }
    };
  };
}

// Predefined Controller Decorators
//export const Controller = createControllerDecorator("web");
/**
 *@description Api controller's are used for rest . It will populate
 * json on return and all it http methods {get} {post} etc must return
 *Results.*
 * @param path {string} this will used as route prefix
 *
 **/
export function ApiController(path?: string): ClassDecorator;
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
  pathOrOptions: string | ControllerOptions = "/",
  mayBeOptions?: ControllerOptions,
): ClassDecorator {
  if (mayBeOptions) {
    return createControllerDecorator("api")(pathOrOptions, mayBeOptions);
  }
  return createControllerDecorator("api")(pathOrOptions);
}
