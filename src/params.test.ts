import "reflect-metadata";
import { Param, Query, Body, Header, AuthUser } from "./params";
import {

PARAM_META_KEY,
QUERY_META_KEY,
REQUEST_BODY_META_KEY,
REQUEST_HEADER_META_KEY,
REQUEST_USER_META_KEY,
} from "./container";

describe("Parameter Decorators", () => {
class DummyValidator {}

class TestController {
    testMethod(
        @Param("id") id: string,
        @Query("search") search: string,
        @Body() body: DummyValidator,
        @Header("x-token") token: string,
        @AuthUser() user: any,
    ) {}
}

it("should define metadata for Param decorator", () => {
    const meta = Reflect.getMetadata(
        PARAM_META_KEY,
        TestController.prototype,
        "testMethod",
    );
    expect(meta).toBeDefined();
    expect(meta[0].key).toBe("id");
    expect(meta[0].type).toBe("route:param");
});

it("should define metadata for Query decorator", () => {
    const meta = Reflect.getMetadata(
        QUERY_META_KEY,
        TestController.prototype,
        "testMethod",
    );
    expect(meta).toBeDefined();
    expect(meta[1].key).toBe("search");
    expect(meta[1].type).toBe("route:query");
});

it("should define metadata for Body decorator", () => {
    const meta = Reflect.getMetadata(
        REQUEST_BODY_META_KEY,
        TestController.prototype,
        "testMethod",
    );
    expect(meta).toBeDefined();
    expect(meta[2].key).toBe("all");
    expect(meta[2].type).toBe("route:body");
});

it("should define metadata for Header decorator", () => {
    const meta = Reflect.getMetadata(
        REQUEST_HEADER_META_KEY,
        TestController.prototype,
        "testMethod",
    );
    expect(meta).toBeDefined();
    expect(meta[3].key).toBe("x-token");
    expect(meta[3].type).toBe("route:header");
});

it("should define metadata for AuthUser decorator", () => {
    const meta = Reflect.getMetadata(
        REQUEST_USER_META_KEY,
        TestController.prototype,
        "testMethod",
    );
    expect(meta).toBeDefined();
    expect(meta[4].key).toBe("all");
    expect(meta[4].type).toBe("route:user");
});

it("should set required and validate options to true by default", () => {
    const meta = Reflect.getMetadata(
        PARAM_META_KEY,
        TestController.prototype,
        "testMethod",
    );
    expect(meta[0].required).toBe(true);
    expect(meta[0].validate).toBe(true);
});

it("should allow overriding required and validate options", () => {
    class AnotherController {
        test(
            @Param("id", { required: false, validate: false }) id: string,
        ) {}
    }
    const meta = Reflect.getMetadata(
        PARAM_META_KEY,
        AnotherController.prototype,
        "test",
    );
    expect(meta[0].required).toBe(false);
    expect(meta[0].validate).toBe(false);
});
});