/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { AvleonApplication } from "./application";
import Container from "typedi";
import { Constructor } from "../helpers";
import { TestApplication, TestAppOptions } from "../interfaces/avleon-application";
import { InjectOptions } from "fastify";
import { ValidationErrorException } from "../exceptions";
import { SystemUseError } from "../exceptions/system-exception";

export class AvleonTest {
    private constructor() {
        process.env.NODE_ENV = "test";
    }

    static getController<T>(controller: Constructor<T>, deps: any[] = []) {
        const paramTypes =
            Reflect.getMetadata("design:paramtypes", controller) || [];

        deps.forEach((dep, i) => {
            Container.set(paramTypes[i], dep);
        });

        return Container.get(controller);
    }

    static getProvider<T>(service: Constructor<T>, deps: any[] = []) {
        const paramTypes = Reflect.getMetadata("design:paramtypes", service) || [];

        deps.forEach((dep, i) => {
            Container.set(paramTypes[i], dep);
        });

        return Container.get(service);
    }

    static createTestApplication(options: TestAppOptions) {
        const app = AvleonApplication.getInternalApp({
            dataSourceOptions: options.dataSource ? options.dataSource : undefined,
        });
        // We need to cast options.controllers to any or Constructor[] for compatibility
        if (options.controllers) {
            app.useControllers(options.controllers as Constructor[]);
        }
        return AvleonTest.from(app);
    }

    static from(app: AvleonApplication): TestApplication {
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
            (app as any)._mapControllers().catch((e: any) => console.error(e));

            // In icore.ts, it was mapping routes to app.route explicitly. 
            // In our refactor, _mapControllers calls router.buildController -> which adds routes to app.
            // So fastify app should be ready.

            app.app.setErrorHandler(async (error, req, res) => {
                // Reuse error handler logic or simplified version
                if (error instanceof ValidationErrorException) {
                    return res.status(400).send({
                        code: 400,
                        error: "ValidationError",
                        errors: error.message,
                    });
                }
                return res.status(500).send(error);
            });

            return {
                get: async (url: string, options?: InjectOptions) =>
                    app.app.inject({ method: "GET", url, ...options }),
                post: async (url: string, options?: InjectOptions) =>
                    app.app.inject({ method: "POST", url, ...options }),
                put: async (url: string, options?: InjectOptions) =>
                    app.app.inject({ method: "PUT", url, ...options }),
                patch: async (url: string, options?: InjectOptions) =>
                    app.app.inject({ method: "PATCH", url, ...options }),
                delete: async (url: string, options?: InjectOptions) =>
                    app.app.inject({ method: "DELETE", url, ...options }),
                options: async (url: string, options?: InjectOptions) =>
                    app.app.inject({ method: "OPTIONS", url, ...options }),
                getController: <T>(controller: Constructor<T>, deps: any[] = []) => {
                    return AvleonTest.getController(controller, deps);
                },
            };
        } catch (error) {
            throw new SystemUseError("Can't get test appliction");
        }
    }

    static clean() {
        Container.reset();
    }
}

export class Avleon {
    static createApplication() {
        const app = AvleonApplication.getApp();
        return app;
    }
    static createTestApplication(options: TestAppOptions) {
        const app = AvleonTest.createTestApplication(options);
        return app;
    }
}
