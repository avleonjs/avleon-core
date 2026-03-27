"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Avleon = exports.AvleonTest = void 0;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const application_1 = require("./application");
const typedi_1 = __importDefault(require("typedi"));
const exceptions_1 = require("../exceptions");
const system_exception_1 = require("../exceptions/system-exception");
class AvleonTest {
    constructor() {
        process.env.NODE_ENV = "test";
    }
    static getController(controller, deps = []) {
        const paramTypes = Reflect.getMetadata("design:paramtypes", controller) || [];
        deps.forEach((dep, i) => {
            typedi_1.default.set(paramTypes[i], dep);
        });
        return typedi_1.default.get(controller);
    }
    static getProvider(service, deps = []) {
        const paramTypes = Reflect.getMetadata("design:paramtypes", service) || [];
        deps.forEach((dep, i) => {
            typedi_1.default.set(paramTypes[i], dep);
        });
        return typedi_1.default.get(service);
    }
    static createTestApplication(options) {
        const app = application_1.AvleonApplication.getInternalApp({
            dataSourceOptions: options.dataSource ? options.dataSource : undefined,
        });
        // We need to cast options.controllers to any or Constructor[] for compatibility
        if (options.controllers) {
            app.useControllers(options.controllers);
        }
        return AvleonTest.from(app);
    }
    static from(app) {
        // Logic to return a TestApplication wrapper around the running app
        // This effectively manually builds the routes map if it wasn't run?
        // In icore.ts getTestApp() logic was doing a lot of things manually.
        // We need to replicate that behavior via the `app` instance.
        // BUT, since we split, logic might need access to internals.
        // For now, let's implement the wrapper using app.app (fastify instance)
        try {
            // Note: In original code, getTestApp did _mapControllers().
            // We should access private methods or expose public init method.
            // Since we are in separate file, we can't access private easily.
            // Best approach: add `initForTest()` on AvleonApplication
            // Assuming we added public method or we just cast to any to call private methods (naughty but works)
            app._mapControllers().catch((e) => console.error(e));
            // In icore.ts, it was mapping routes to app.route explicitly. 
            // In our refactor, _mapControllers calls router.buildController -> which adds routes to app.
            // So fastify app should be ready.
            app.app.setErrorHandler(async (error, req, res) => {
                // Reuse error handler logic or simplified version
                if (error instanceof exceptions_1.ValidationErrorException) {
                    return res.status(400).send({
                        code: 400,
                        error: "ValidationError",
                        errors: error.message,
                    });
                }
                return res.status(500).send(error);
            });
            return {
                get: async (url, options) => app.app.inject({ method: "GET", url, ...options }),
                post: async (url, options) => app.app.inject({ method: "POST", url, ...options }),
                put: async (url, options) => app.app.inject({ method: "PUT", url, ...options }),
                patch: async (url, options) => app.app.inject({ method: "PATCH", url, ...options }),
                delete: async (url, options) => app.app.inject({ method: "DELETE", url, ...options }),
                options: async (url, options) => app.app.inject({ method: "OPTIONS", url, ...options }),
                getController: (controller, deps = []) => {
                    return AvleonTest.getController(controller, deps);
                },
            };
        }
        catch (error) {
            throw new system_exception_1.SystemUseError("Can't get test appliction");
        }
    }
    static clean() {
        typedi_1.default.reset();
    }
}
exports.AvleonTest = AvleonTest;
class Avleon {
    static createApplication() {
        const app = application_1.AvleonApplication.getApp();
        return app;
    }
    static createTestApplication(options) {
        const app = AvleonTest.createTestApplication(options);
        return app;
    }
}
exports.Avleon = Avleon;
