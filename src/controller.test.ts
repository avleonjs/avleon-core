import "reflect-metadata";
import { ApiController, createControllerDecorator, ControllerOptions } from "./controller";
import { Service } from "typedi";
import * as containerModule from "./container";
import { Service as TypediService } from "typedi";

describe("Controller Decorators", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("ApiController", () => {
        it("should apply metadata and Service decorator when used as a class decorator", () => {
            const registerControllerSpy = jest.spyOn(containerModule, "registerController");

            @ApiController
            class TestController {}

            expect(Reflect.getMetadata(containerModule.API_CONTROLLER_METADATA_KEY, TestController)).toBe(true);
            expect(registerControllerSpy).toHaveBeenCalledWith(TestController);
            expect(Reflect.getMetadata(containerModule.CONTROLLER_META_KEY, TestController)).toEqual({
                type: "api",
                path: "/",
                options: {},
            });
        });

        it("should apply metadata and Service decorator when used with a path", () => {
            const registerControllerSpy = jest.spyOn(containerModule, "registerController");

            @ApiController("/test")
            class TestController {}

            expect(Reflect.getMetadata(containerModule.API_CONTROLLER_METADATA_KEY, TestController)).toBe(true);
            expect(registerControllerSpy).toHaveBeenCalledWith(TestController);
            expect(Reflect.getMetadata(containerModule.CONTROLLER_META_KEY, TestController)).toEqual({
                type: "api",
                path: "/test",
                options: {},
            });
        });

        it("should apply metadata and Service decorator when used with options", () => {
            const registerControllerSpy = jest.spyOn(containerModule, "registerController");
            const options: ControllerOptions = { name: "Custom", path: "/custom", version: "1.0.0" };

            @ApiController(options)
            class TestController {}

            expect(Reflect.getMetadata(containerModule.API_CONTROLLER_METADATA_KEY, TestController)).toBe(true);
            expect(registerControllerSpy).toHaveBeenCalledWith(TestController);
            expect(Reflect.getMetadata(containerModule.CONTROLLER_META_KEY, TestController)).toEqual({
                type: "api",
                path: "/custom",
                options,
            });
        });

            const originalService = TypediService;
            // @ts-ignore
            (containerModule as any).Service = undefined;
            expect(() => {
                @ApiController
                class TestController {}
            }).toThrow("Service decorator is not a function");
            // Restore
            // @ts-ignore
            (containerModule as any).Service = originalService;
        });
    });


