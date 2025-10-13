import { LoggerService } from "./logger";
import pino from "pino";

jest.mock("pino");

describe("LoggerService constructor", () => {
    const mockPino = pino as unknown as jest.Mock;

    beforeEach(() => {
        mockPino.mockClear();
    });

    it("should initialize logger with default level 'info' when LOG_LEVEL is not set", () => {
        delete process.env.LOG_LEVEL;
        new LoggerService();
        expect(mockPino).toHaveBeenCalledWith({
            level: "info",
            transport: {
                target: "pino-pretty",
                options: {
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            },
        });
    });

    it("should initialize logger with LOG_LEVEL from environment", () => {
        process.env.LOG_LEVEL = "debug";
        new LoggerService();
        expect(mockPino).toHaveBeenCalledWith({
            level: "debug",
            transport: {
                target: "pino-pretty",
                options: {
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            },
        });
    });
});