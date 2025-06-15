import "reflect-metadata";
import { AppConfig, CreateConfig, GetConfig, IConfig } from "./config";
import { Environment } from "./environment-variables";

type AppConfig = { name: string; os: string };

describe("Config", () => {
  describe("class", () => {
    it("should be call by get config", () => {
      @AppConfig
      class MyConfig {
        config(env: Environment) {
          return {
            name: "avleon",
          };
        }
      }
      const mConfig = GetConfig(MyConfig);
      expect(mConfig).toHaveProperty("name");
      expect(mConfig["name"]).toBe("avleon");
    });
  });

  describe("createConfig()", () => {
    it("it should create config and called with GetConfig", () => {
      CreateConfig("myconfig", (env) => ({
        firstname: "tareq",
        os: env.get("name"),
      }));
      const mConfig = GetConfig("myconfig");
      expect(mConfig).toHaveProperty("firstname");
      expect(mConfig.firstname).toBe("tareq");
    });
  });
});
