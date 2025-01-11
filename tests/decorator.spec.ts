import "reflect-metadata";
import {  ApiController, Get } from "../src/decorators";
import container, { getRegisteredControllers } from "../src/container";
import Container, { Inject } from "typedi";


@ApiController({
  path: "/home",
})
class HomeController {}

@ApiController({
  name: "Products",
})
class ProductController {}

describe("All decorator test", () => {
  describe("Contorller decorator test", () => {
    it("it should be have name as prefix", () => {
      getRegisteredControllers().forEach((c) => {
        console.log(c.name);
      });
    });

    it("should have options ", () => {
      const instance = Container.get(HomeController);
      expect(instance).toBeDefined();
    });
  });
});
