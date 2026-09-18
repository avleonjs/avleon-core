import "reflect-metadata";
import {

Route,
Get,
Post,
Put,
Delete,
Patch,
Options,
All,
RouteMethods,
RouteMethodOptions,
} from "./route-methods";

describe("Route Decorators", () => {
class TestController {
    @Get("/get")
    getMethod() {}

    @Post({ path: "/post", name: "customPost" })
    postMethod() {}

    @Put("/put", { name: "putMethod" })
    putMethod() {}

    @Delete()
    deleteMethod() {}

    @Patch({ name: "patchMethod" })
    patchMethod() {}

    @Options("/options")
    optionsMethod() {}

    @All({ path: "/all" })
    allMethod() {}

    @Route("GET", "/custom", { name: "customRoute" })
    customRouteMethod() {}
}

it("should define metadata for Get decorator", () => {
    const meta = Reflect.getMetadata("route:method", TestController.prototype, "getMethod");
    expect(meta).toBe("GET");
    const path = Reflect.getMetadata("route:path", TestController.prototype, "getMethod");
    expect(path).toBe("/get");
});

// it("should define metadata for Post decorator with options object", () => {
//     const meta = Reflect.getMetadata("route:method", TestController.prototype, "postMethod");
//     expect(meta).toBe("POST");
//     const path = Reflect.getMetadata("route:path", TestController.prototype, "postMethod");
//     expect(path).toBe("/post");
//     const options = Reflect.getMetadata("route:options", TestController.prototype, "postMethod");
//     expect(options).toMatchObject({ path: "/post", name: "customPost" });
// });

it("should define metadata for Put decorator with path and options", () => {
    const meta = Reflect.getMetadata("route:method", TestController.prototype, "putMethod");
    expect(meta).toBe("PUT");
    const path = Reflect.getMetadata("route:path", TestController.prototype, "putMethod");
    expect(path).toBe("/put");
    const options = Reflect.getMetadata("route:options", TestController.prototype, "putMethod");
    expect(options).toMatchObject({ name: "putMethod" });
});

it("should define metadata for Delete decorator with default path", () => {
    const meta = Reflect.getMetadata("route:method", TestController.prototype, "deleteMethod");
    expect(meta).toBe("DELETE");
    const path = Reflect.getMetadata("route:path", TestController.prototype, "deleteMethod");
    expect(path).toBe("/");
});

it("should define metadata for Patch decorator with options object", () => {
    const meta = Reflect.getMetadata("route:method", TestController.prototype, "patchMethod");
    expect(meta).toBe("PATCH");
    const path = Reflect.getMetadata("route:path", TestController.prototype, "patchMethod");
    expect(path).toBe("patchMethod");
    const options = Reflect.getMetadata("route:options", TestController.prototype, "patchMethod");
    expect(options).toMatchObject({ name: "patchMethod" });
});

it("should define metadata for Options decorator with path", () => {
    const meta = Reflect.getMetadata("route:method", TestController.prototype, "optionsMethod");
    expect(meta).toBe("OPTIONS");
    const path = Reflect.getMetadata("route:path", TestController.prototype, "optionsMethod");
    expect(path).toBe("/options");
});

it("should define metadata for All decorator with options object", () => {
    const meta = Reflect.getMetadata("route:method", TestController.prototype, "allMethod");
    expect(meta).toBe("ALL");
    const path = Reflect.getMetadata("route:path", TestController.prototype, "allMethod");
    expect(path).toBe("/all");
});

it("should define metadata for generic Route decorator", () => {
    const meta = Reflect.getMetadata("route:method", TestController.prototype, "customRouteMethod");
    expect(meta).toBe("GET");
    const path = Reflect.getMetadata("route:path", TestController.prototype, "customRouteMethod");
    expect(path).toBe("/custom");
    const options = Reflect.getMetadata("route:options", TestController.prototype, "customRouteMethod");
    expect(options).toMatchObject({ name: "customRoute" });
});
});