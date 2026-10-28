import "reflect-metadata";
import { Readable } from "stream";
import {
  Contains,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { transformAndValidate } from "../common/utils/validation-utils";
import { Type } from "class-transformer";
import { AvleonApplication } from "./application";
import { ApiController } from "../http/controller";
import { Get, Post } from "../http/route-methods";
import { Body, Query } from "../http/params";
import { Authorized } from "../http/middleware";
import { AppService } from "../common/decorators";
import {
  InternalErrorException,
  NotFoundException,
} from "../common/exceptions";
import { IRequest } from "./types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

class AddressDto {
  @IsString()
  city!: string;
}

class CreateUserDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  age?: number;

  // Not encoded in the generated JSON schema, so only class-validator sees it.
  @IsOptional()
  @Contains("@")
  handle?: string;
}

// Nested DTOs are validated directly: route registration with a nested DTO
// still trips the unresolved OpenAPI $ref (tracked separately).
class CreateCustomerDto {
  @IsString()
  name!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}

class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}

@ApiController("/open")
class OpenController {
  @Post("/users")
  create(@Body() body: CreateUserDto) {
    return {
      isInstance: body instanceof CreateUserDto,
      body,
    };
  }

  @Get("/users")
  list(@Query() query: ListQueryDto) {
    return { isInstance: query instanceof ListQueryDto, page: query.page };
  }

  @Get("/download")
  download() {
    return {
      download: true,
      stream: Readable.from(["x"]),
      filename: "evil\"\r\nSet-Cookie: a=b; résumé.txt",
    };
  }

  @Get("/not-found")
  notFound() {
    throw new NotFoundException("User not found");
  }

  @Get("/internal")
  internal() {
    throw new InternalErrorException({ dsn: "postgres://user:secret@db" });
  }

  @Get("/crash")
  crash() {
    throw new Error("connection to db at 10.0.0.5 failed");
  }
}

@ApiController("/guarded")
class GuardedController {
  @Authorized()
  @Get("/")
  get() {
    return { ok: true };
  }
}

@ApiController("/named")
class NamedController {
  @Authorized("missing")
  @Get("/")
  get() {
    return { ok: true };
  }
}

@AppService
class DenyByReturningFalse {
  authorize(req: IRequest) {
    return req.headers["x-allow"] === "yes" ? req : false;
  }
}

// ─── Harness ────────────────────────────────────────────────────────────────

async function boot(setup: (app: AvleonApplication) => void) {
  const app = AvleonApplication.getInternalApp();
  setup(app);
  const before = {
    SIGTERM: process.listeners("SIGTERM"),
    SIGINT: process.listeners("SIGINT"),
  };
  await app.run(0);
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    for (const l of process.listeners(sig)) {
      if (!before[sig].includes(l)) process.removeListener(sig, l);
    }
  }
  return app;
}

describe("request pipeline", () => {
  const savedEnv = process.env.NODE_ENV;
  let spies: jest.SpyInstance[] = [];

  beforeEach(() => {
    spies = (["log", "warn", "error"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => {}),
    );
  });

  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
    process.env.NODE_ENV = savedEnv;
  });

  describe("@Authorized", () => {
    it("denies with 403 when no authorizer is registered", async () => {
      const app = await boot((a) => a.useControllers([GuardedController]));
      try {
        const res = await app.app.inject({ method: "GET", url: "/guarded" });
        expect(res.statusCode).toBe(403);
        expect(spies[1]).toHaveBeenCalledWith(
          expect.stringContaining("no authorization handler"),
        );
      } finally {
        await app.app.close();
      }
    });

    it("treats an authorizer returning false as 403", async () => {
      const app = await boot((a) =>
        a
          .useAuthorization(DenyByReturningFalse)
          .useControllers([GuardedController]),
      );
      try {
        const denied = await app.app.inject({ method: "GET", url: "/guarded" });
        expect(denied.statusCode).toBe(403);
        expect(denied.body).not.toContain("ok");

        const allowed = await app.app.inject({
          method: "GET",
          url: "/guarded",
          headers: { "x-allow": "yes" },
        });
        expect(allowed.statusCode).toBe(200);
        expect(allowed.json()).toEqual({ ok: true });
      } finally {
        await app.app.close();
      }
    });

    it("refuses to boot when a named authorizer is not registered", async () => {
      const app = AvleonApplication.getInternalApp();
      app
        .useAuthorization({ jwt: DenyByReturningFalse })
        .useControllers([NamedController]);
      await expect(app.run(0)).rejects.toThrow(
        /No authorization handler registered/,
      );
      await app.app.close();
    });
  });

  describe("DTO validation", () => {
    let app: AvleonApplication;

    beforeAll(async () => {
      jest.spyOn(console, "log").mockImplementation(() => {});
      app = await boot((a) => a.useControllers([OpenController]));
    });

    afterAll(async () => {
      await app.app.close();
      (console.log as any).mockRestore?.();
    });

    it("passes the validated DTO instance to the handler", async () => {
      const res = await app.app.inject({
        method: "POST",
        url: "/open/users",
        payload: { name: "Ada", age: 36 },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.isInstance).toBe(true);
      expect(json.body).toEqual({ name: "Ada", age: 36 });
    });

    it("rejects properties the DTO does not declare", async () => {
      const res = await app.app.inject({
        method: "POST",
        url: "/open/users",
        payload: { name: "Ada", isAdmin: true },
      });
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json).toMatchObject({ code: 400, status: "Error" });
      expect(json.message).toContain("isAdmin");
      expect(json.errors).toEqual([
        {
          path: "isAdmin",
          constraints: expect.objectContaining({
            whitelistValidation: expect.any(String),
          }),
        },
      ]);
    });

    it("returns a readable message instead of undefined", async () => {
      const res = await app.app.inject({
        method: "POST",
        url: "/open/users",
        payload: { name: "Ada", handle: "ada" },
      });
      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.message).toBe("handle must contain a @ string");
      expect(json.errors.map((e: any) => e.path)).toEqual(["handle"]);
    });

    it("reports nested failures with dotted paths", async () => {
      const { errors } = await transformAndValidate(CreateCustomerDto, {
        name: 42,
        address: { city: 7, zip: "x" },
      });
      expect(errors!.map((e) => e.path).sort()).toEqual([
        "address.city",
        "address.zip",
        "name",
      ]);
    });

    it("rejects an array body for an object DTO", async () => {
      const res = await app.app.inject({
        method: "POST",
        url: "/open/users",
        payload: [{ name: "Ada" }],
      });
      expect(res.statusCode).toBe(400);
    });

    it("passes the transformed query DTO to the handler", async () => {
      const res = await app.app.inject({
        method: "GET",
        url: "/open/users?page=2",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ isInstance: true, page: 2 });

      const bad = await app.app.inject({
        method: "GET",
        url: "/open/users?page=0",
      });
      expect(bad.statusCode).toBe(400);

      const extra = await app.app.inject({
        method: "GET",
        url: "/open/users?admin=1",
      });
      expect(extra.statusCode).toBe(400);
    });

    it("sanitizes the Content-Disposition filename", async () => {
      const res = await app.app.inject({
        method: "GET",
        url: "/open/download",
      });
      expect(res.statusCode).toBe(200);
      const header = String(res.headers["content-disposition"]);
      expect(header).not.toMatch(/[\r\n]/);
      expect(res.headers["set-cookie"]).toBeUndefined();
      expect(header).toMatch(
        /^attachment; filename="[^"]*"; filename\*=UTF-8''/,
      );
      expect(header).toContain("r%C3%A9sum%C3%A9.txt");
    });
  });

  describe("error handler", () => {
    async function get(url: string, env: string | undefined) {
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;
      const app = await boot((a) => a.useControllers([OpenController]));
      try {
        return await app.app.inject({ method: "GET", url });
      } finally {
        await app.app.close();
      }
    }

    it("treats an unset NODE_ENV as production", () => {
      delete process.env.NODE_ENV;
      expect(AvleonApplication.getInternalApp().isDevelopment()).toBe(false);
      process.env.NODE_ENV = "development";
      expect(AvleonApplication.getInternalApp().isDevelopment()).toBe(true);
    });

    it.each([undefined, "production"])(
      "hides 5xx details when NODE_ENV=%s",
      async (env) => {
        const internal = await get("/open/internal", env);
        expect(internal.statusCode).toBe(500);
        expect(internal.body).not.toContain("secret");
        expect(internal.json()).toEqual({
          code: 500,
          status: "Error",
          message: "Internal Server Error",
        });

        const crash = await get("/open/crash", env);
        expect(crash.statusCode).toBe(500);
        expect(crash.body).not.toContain("10.0.0.5");
      },
    );

    it("keeps 4xx messages in production", async () => {
      const res = await get("/open/not-found", "production");
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toBe("User not found");
    });

    it("shows 5xx details in development", async () => {
      const res = await get("/open/internal", "development");
      expect(res.statusCode).toBe(500);
      expect(res.body).toContain("secret");
    });
  });
});
