"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.All = exports.Options = exports.Patch = exports.Delete = exports.Put = exports.Post = exports.Get = void 0;
exports.Route = Route;
const container_1 = require("./container");
/**
 * Generic Route decorator factory
 */
function Route(method, pathOrOptions, maybeOptions) {
    return function (target, propertyKey, descriptor) {
        let path = "/";
        let options = {};
        if (typeof pathOrOptions === "string") {
            path = pathOrOptions || "/";
            options = maybeOptions || {};
        }
        else if (typeof pathOrOptions === "object" && pathOrOptions !== null) {
            options = pathOrOptions;
            path = options.path || options.name || "/";
        }
        else {
            // @Get() called with no args
            options = maybeOptions || {};
            path = "/";
        }
        //Ensure path is always a string
        path = typeof path === "string" ? path : "/";
        Reflect.defineMetadata("route:path", path, target, propertyKey);
        Reflect.defineMetadata("route:method", method, target, propertyKey);
        Reflect.defineMetadata(container_1.ROUTE_META_KEY, {
            ...options,
            method,
            path,
            controller: target.constructor.name,
        }, target, propertyKey);
        if (options) {
            Reflect.defineMetadata("route:options", options, target, propertyKey);
        }
    };
}
const Get = (pathOrOptions, maybeOptions) => Route("GET", pathOrOptions, maybeOptions);
exports.Get = Get;
const Post = (pathOrOptions, maybeOptions) => Route("POST", pathOrOptions, maybeOptions);
exports.Post = Post;
const Put = (pathOrOptions, maybeOptions) => Route("PUT", pathOrOptions, maybeOptions);
exports.Put = Put;
const Delete = (pathOrOptions, maybeOptions) => Route("DELETE", pathOrOptions, maybeOptions);
exports.Delete = Delete;
const Patch = (pathOrOptions, maybeOptions) => Route("PATCH", pathOrOptions, maybeOptions);
exports.Patch = Patch;
const Options = (pathOrOptions, maybeOptions) => Route("OPTIONS", pathOrOptions, maybeOptions);
exports.Options = Options;
const All = (pathOrOptions, maybeOptions) => Route("ALL", pathOrOptions, maybeOptions);
exports.All = All;
