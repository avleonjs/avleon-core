import { Environment } from "./environment-variables";
import fs from "fs";
import path from "path";

jest.mock("fs");
const mockedFs = fs as jest.Mocked<typeof fs>;

describe("Environment", () => {
    const envFilePath = path.join(process.cwd(), ".env");
    const envContent = "TEST_KEY=123\nANOTHER_KEY=abc";
    const parsedEnv = { TEST_KEY: "123", ANOTHER_KEY: "abc" };

    beforeEach(() => {
        jest.resetModules();
        mockedFs.existsSync.mockClear();
        mockedFs.readFileSync.mockClear();
        process.env.TEST_KEY = "override";
        process.env.ONLY_PROCESS = "proc";
    });

    afterEach(() => {
        delete process.env.TEST_KEY;
        delete process.env.ONLY_PROCESS;
    });

    it("should get value from process.env if present", () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(envContent);
        const env = new Environment();
        expect(env.get("TEST_KEY")).toBe("override");
    });

    it("should get value from .env file if not in process.env", () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(envContent);
        const env = new Environment();
        expect(env.get("ANOTHER_KEY")).toBe("abc");
    });

    it("should return undefined for missing key", () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(envContent);
        const env = new Environment();
        expect(env.get("MISSING_KEY")).toBeUndefined();
    });

    it("should throw EnvironmentVariableNotFound for getOrThrow if missing", () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(envContent);
        const env = new Environment();
        expect(() => env.getOrThrow("MISSING_KEY")).toThrow();
    });

    it("should get all variables with process.env taking precedence", () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(envContent);
        const env = new Environment();
        const all = env.getAll();
        expect(all.TEST_KEY).toBe("override");
        expect(all.ANOTHER_KEY).toBe("abc");
        expect(all.ONLY_PROCESS).toBe("proc");
    });

    it("should handle missing .env file gracefully", () => {
        mockedFs.existsSync.mockReturnValue(false);
        const env = new Environment();
        expect(env.get("ONLY_PROCESS")).toBe("proc");
        expect(env.get("TEST_KEY")).toBe("override");
    });

    it("should return empty object if error occurs during parsing", () => {
        mockedFs.existsSync.mockImplementation(() => { throw new Error("fs error"); });
        const env = new Environment();
        expect(env.getAll()).toEqual({});
    });
});