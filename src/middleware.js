"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizeMiddleware = exports.AvleonMiddleware = void 0;
exports.CanAuthorize = CanAuthorize;
exports.AppAuthorization = AppAuthorization;
exports.Authorized = Authorized;
exports.AppMiddleware = AppMiddleware;
exports.UseMiddleware = UseMiddleware;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const typedi_1 = require("typedi");
const container_1 = require("./container");
class AvleonMiddleware {
}
exports.AvleonMiddleware = AvleonMiddleware;
class AuthorizeMiddleware {
}
exports.AuthorizeMiddleware = AuthorizeMiddleware;
function CanAuthorize(target) {
    if (typeof target.prototype.authorize !== "function") {
        throw new Error(`Class "${target.name}" must implement an "authorize" method.`);
    }
    (0, typedi_1.Service)()(target);
}
function AppAuthorization(target) {
    if (typeof target.prototype.authorize !== "function") {
        throw new Error(`Class "${target.name}" must implement an "authorize" method.`);
    }
    (0, typedi_1.Service)()(target);
}
function Authorized(options = {}) {
    return function (target, propertyKey, descriptor) {
        if (propertyKey && descriptor) {
            Reflect.defineMetadata(container_1.AUTHORIZATION_META_KEY, { authorize: true, options }, target.constructor, propertyKey);
        }
        else {
            Reflect.defineMetadata(container_1.AUTHORIZATION_META_KEY, { authorize: true, options }, target);
        }
    };
}
function AppMiddleware(target) {
    if (typeof target.prototype.invoke !== "function") {
        throw new Error(`Class "${target.name}" must implement an "invoke" method.`);
    }
    (0, typedi_1.Service)()(target);
}
/**
 * A decorator function that applies one or more middleware to a class or a method.
 *
 * When applied to a class, the middleware are registered for the entire controller.
 * When applied to a method, the middleware are registered for that specific route.
 *
 * @param options - A single middleware instance/class or an array of middleware instances/classes to be applied.
 * @returns A decorator that registers the middleware metadata.
 */
function UseMiddleware(options) {
    return function (target, propertyKey, descriptor) {
        const normalizeMiddleware = (middleware) => typeof middleware === "function" ? new middleware() : middleware;
        const middlewareList = (Array.isArray(options) ? options : [options]).map(normalizeMiddleware);
        if (typeof target === "function" && !propertyKey) {
            const existingMiddlewares = Reflect.getMetadata("controller:middleware", target) || [];
            Reflect.defineMetadata("controller:middleware", [...existingMiddlewares, ...middlewareList], target);
        }
        else if (descriptor) {
            const existingMiddlewares = Reflect.getMetadata("route:middleware", target, propertyKey) || [];
            Reflect.defineMetadata("route:middleware", [...existingMiddlewares, ...middlewareList], target, propertyKey);
        }
    };
}
