import { Avleon, AvleonApplication } from "./icore";

describe("Avleon.createApplication", () => {
    it("should return an instance of AvleonApplication", () => {
        const app = Avleon.createApplication();
        expect(app).toBeInstanceOf(AvleonApplication);
    });

    it("should always return the same instance (singleton)", () => {
        const app1 = Avleon.createApplication();
        const app2 = Avleon.createApplication();
        expect(app1).toBe(app2);
    });
});