"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUEST_METADATA_KEY = void 0;
exports.AvleonRequest = AvleonRequest;
exports.createControllerDecorator = createControllerDecorator;
exports.ApiController = ApiController;
const typedi_1 = require("typedi");
const container_1 = require("./container");
exports.REQUEST_METADATA_KEY = Symbol('avleon:request');
function AvleonRequest() {
    return (target, propertyKey, parameterIndex) => {
        const existingParams = Reflect.getMetadata(exports.REQUEST_METADATA_KEY, target, propertyKey) || [];
        existingParams.push({
            index: parameterIndex,
            type: 'request',
        });
        Reflect.defineMetadata(exports.REQUEST_METADATA_KEY, existingParams, target, propertyKey);
    };
}
function createControllerDecorator(type = "web") {
    return function (pathOrOptions, maybeOptions) {
        return function (target) {
            let path = "/";
            let options = {};
            if (typeof pathOrOptions === "string") {
                path = pathOrOptions;
                options = maybeOptions || {};
            }
            else if (typeof pathOrOptions === "object") {
                options = pathOrOptions;
                path = options.path || "/";
            }
            Reflect.defineMetadata(container_1.API_CONTROLLER_METADATA_KEY, true, target);
            // Ensure Service is applied as a ClassDecorator
            if (typeof typedi_1.Service === "function") {
                (0, container_1.registerController)(target); // Add to custom registry
                (0, typedi_1.Service)()(target); // Apply DI decorator
                Reflect.defineMetadata(container_1.CONTROLLER_META_KEY, { type, path, options }, target);
            }
            else {
                throw new Error("Service decorator is not a function");
            }
        };
    };
}
function ApiController(pathOrOptions = "/", mayBeOptions) {
    if (typeof pathOrOptions == "function") {
        Reflect.defineMetadata(container_1.API_CONTROLLER_METADATA_KEY, true, pathOrOptions);
        // Ensure Service is applied as a ClassDecorator
        if (typeof typedi_1.Service === "function") {
            (0, container_1.registerController)(pathOrOptions); // Add to custom registry
            (0, typedi_1.Service)()(pathOrOptions); // Apply DI decorator
            Reflect.defineMetadata(container_1.CONTROLLER_META_KEY, { type: "api", path: "/", options: {} }, pathOrOptions);
        }
        else {
            throw new Error("Service decorator is not a function");
        }
    }
    else {
        if (mayBeOptions) {
            return createControllerDecorator("api")(pathOrOptions, mayBeOptions);
        }
        return createControllerDecorator("api")(pathOrOptions);
    }
}
