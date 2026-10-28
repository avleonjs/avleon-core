import "reflect-metadata";
import {
  AvleonMiddleware,
  AppMiddleware,
  UseMiddleware,
  Authorized,
  CanAuthorize,
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
    // Classes are stored as-is and resolved through DI at route registration.
    expect(middlewares).toEqual([MW1, MW2]);
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
    expect(middlewares).toEqual([MW1]);
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

describe("CanAuthorize", () => {
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
});
