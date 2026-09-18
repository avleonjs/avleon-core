import "reflect-metadata";
import { Service } from "typedi";
import {

AvleonMiddleware,
AppMiddleware,
UseMiddleware,
Authorized,
CanAuthorize,
AppAuthorization,
AuthorizeMiddleware,
} from "./middleware";

describe("AvleonMiddleware", () => {
class TestMiddleware extends AvleonMiddleware {
    async invoke(req: any, res?: any) {
        return req;
    }
}

it("should allow AppMiddleware decorator on valid class", () => {
    expect(() => AppMiddleware(TestMiddleware)).not.toThrow();
});

it("should throw error if AppMiddleware is used on class without invoke", () => {
    class InvalidMiddleware {}
    expect(() => AppMiddleware(InvalidMiddleware as any)).toThrow(
        /must implement an "invoke" method/,
    );
});
});

describe("UseMiddleware", () => {
class MW1 extends AvleonMiddleware {
    async invoke(req: any) {
        return req;
    }
}
class MW2 extends AvleonMiddleware {
    async invoke(req: any) {
        return req;
    }
}

it("should attach middleware to class", () => {
    @UseMiddleware([MW1, MW2])
    class TestController {}

    const middlewares = Reflect.getMetadata(
        "controller:middleware",
        TestController,
    );
    expect(middlewares).toHaveLength(2);
    expect(middlewares[0]).toBeInstanceOf(MW1);
    expect(middlewares[1]).toBeInstanceOf(MW2);
});

it("should attach middleware to method", () => {
    class TestController {
        @UseMiddleware(MW1)
        testMethod() {}
    }
    const middlewares = Reflect.getMetadata(
        "route:middleware",
        TestController.prototype,
        "testMethod",
    );
    expect(middlewares).toHaveLength(1);
    expect(middlewares[0]).toBeInstanceOf(MW1);
});
});

// describe("Authorized decorator", () => {
// it("should define metadata on class", () => {
//     @Authorized({ roles: ["admin"] })
//     class TestClass {}

//     const meta = Reflect.getMetadata("AUTHORIZATION_META_KEY", TestClass);
//     expect(meta).toEqual({ authorize: true, options: { roles: ["admin"] } });
// });

// it("should define metadata on method", () => {
//     class TestClass {
//         @Authorized({ roles: ["user"] })
//         testMethod() {}
//     }
//     const meta = Reflect.getMetadata(
//         "AUTHORIZATION_META_KEY",
//         TestClass.constructor,
//         "testMethod",
//     );
//     expect(meta).toEqual({ authorize: true, options: { roles: ["user"] } });
// });


describe("CanAuthorize and AppAuthorization", () => {
class ValidAuthorize {
    authorize(req: any, options?: any) {
        return req;
    }
}

it("should not throw for valid CanAuthorize", () => {
    expect(() => CanAuthorize(ValidAuthorize)).not.toThrow();
});

it("should throw for invalid CanAuthorize", () => {
    class InvalidAuthorize {}
    expect(() => CanAuthorize(InvalidAuthorize as any)).toThrow(
        /must implement an "authorize" method/,
    );
});

it("should not throw for valid AppAuthorization", () => {
    expect(() => AppAuthorization(ValidAuthorize)).not.toThrow();
});

it("should throw for invalid AppAuthorization", () => {
    class InvalidAuthorize {}
    expect(() => AppAuthorization(InvalidAuthorize as any)).toThrow(
        /must implement an "authorize" method/,
    );
});
});

describe("AuthorizeMiddleware", () => {
class TestAuthorizeMiddleware extends AuthorizeMiddleware {
    authorize(roles: string[]) {
        return (req: any) => req;
    }
}

it("should implement authorize method", () => {
    const mw = new TestAuthorizeMiddleware();
    const handler = mw.authorize(["admin"]);
    expect(typeof handler).toBe("function");
    const req = {};
    expect(handler(req)).toBe(req);
});
});