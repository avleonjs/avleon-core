import "reflect-metadata";
import Container, { Service } from "typedi";
import { AvleonApplication } from "../core/application";
import { AvleonTest } from "../core/testing";
import { ApiController } from "../http/controller";
import { Get } from "../http/route-methods";
import { AuthUser } from "../http/params";
import { AvleonAuthentication } from "./authentication";
import { IRequest } from "../core/types";

type User = { id: number; name: string };

@Service()
class HeaderAuthentication extends AvleonAuthentication<User> {
  async authenticate(request: IRequest): Promise<User | null> {
    const token = request.headers["x-token"];
    return token === "valid" ? { id: 1, name: "Tareq" } : null;
  }
}

@ApiController("me")
class MeController {
  @Get()
  whoami(@AuthUser() user: User) {
    return { user: user ?? null };
  }
}

describe("AvleonAuthentication", () => {
  it("resolves the user for valid credentials", async () => {
    const handler = new HeaderAuthentication();
    const req = { headers: { "x-token": "valid" } } as unknown as IRequest;

    await expect(handler.authenticate(req)).resolves.toEqual({ id: 1, name: "Tareq" });
  });

  it("returns null when credentials are absent or wrong", async () => {
    const handler = new HeaderAuthentication();

    await expect(
      handler.authenticate({ headers: {} } as unknown as IRequest),
    ).resolves.toBeNull();
    await expect(
      handler.authenticate({ headers: { "x-token": "nope" } } as unknown as IRequest),
    ).resolves.toBeNull();
  });
});

describe("useAuthentication", () => {
  afterEach(() => {
    Container.reset();
  });

  it("rejects anything that is not a class", () => {
    const app = AvleonApplication.getInternalApp();
    expect(() => (app as any).useAuthentication({ not: "a class" })).toThrow(
      /expects an authentication class/,
    );
  });

  it("is chainable", () => {
    const app = AvleonApplication.getInternalApp();
    expect(app.useAuthentication(HeaderAuthentication)).toBe(app);
  });

  it("populates request.user, which @AuthUser() injects", async () => {
    const app = AvleonApplication.getInternalApp();
    app.useAuthentication(HeaderAuthentication);
    app.useControllers([MeController]);

    const test = AvleonTest.from(app);
    const res = await test.get("/me", { headers: { "x-token": "valid" } });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user).toEqual({ id: 1, name: "Tareq" });
  });

  it("leaves request.user unset when authentication returns null", async () => {
    const app = AvleonApplication.getInternalApp();
    app.useAuthentication(HeaderAuthentication);
    app.useControllers([MeController]);

    const test = AvleonTest.from(app);
    const res = await test.get("/me", { headers: { "x-token": "bad" } });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user).toBeNull();
  });

  it("leaves request.user unset when no handler is registered", async () => {
    const app = AvleonApplication.getInternalApp();
    app.useControllers([MeController]);

    const test = AvleonTest.from(app);
    const res = await test.get("/me", { headers: { "x-token": "valid" } });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user).toBeNull();
  });
});
