import { AvleonSocketIo } from "./websocket";

describe("AvleonSocketIo", () => {
    let avleonSocketIo: AvleonSocketIo;

    beforeEach(() => {
        avleonSocketIo = new AvleonSocketIo();
    });

    it("should be defined", () => {
        expect(avleonSocketIo).toBeDefined();
    });

    it("should have sendToAll method", () => {
        expect(typeof avleonSocketIo.sendToAll).toBe("function");
    });

    it("should have sendOnly method", () => {
        expect(typeof avleonSocketIo.sendOnly).toBe("function");
    });

    it("should have sendRoom method", () => {
        expect(typeof avleonSocketIo.sendRoom).toBe("function");
    });

    it("should have receive method", () => {
        expect(typeof avleonSocketIo.receive).toBe("function");
    });

    it("receive should accept a channel string", () => {
        expect(() => avleonSocketIo.receive("test-channel")).not.toThrow();
    });
});