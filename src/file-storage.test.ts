import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { FileStorage } from "./file-storage";
import { SystemUseError } from "./exceptions/system-exception";
import { InternalErrorException } from "./exceptions/http-exceptions";
import { MultipartFile } from "./multipart";
import { pipeline } from "stream/promises";

jest.mock("fs");
jest.mock("stream/promises", () => ({
    pipeline: jest.fn((...args) => Promise.resolve()),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe("FileStorage", () => {
    let fileStorage: FileStorage;
    const testFile: MultipartFile = {
        type: "file",
        filename: "test.txt",
        file: new Readable({ read() {} }),
    } as MultipartFile;

    beforeEach(() => {
        jest.clearAllMocks();
        fileStorage = new FileStorage();
        mockFs.existsSync.mockReturnValue(false);
        mockFs.createWriteStream.mockReturnValue({} as any);
        mockFs.createReadStream.mockReturnValue({} as any);
        mockFs.unlinkSync.mockImplementation(() => {});
        mockFs.mkdirSync.mockImplementation(() => undefined);
    });

    describe("save", () => {
        it("should save a file successfully", async () => {
            await expect(fileStorage.save(testFile)).resolves.toEqual(testFile);
        });

        it("should throw SystemUseError if file exists and overwrite is false", async () => {
            mockFs.existsSync.mockReturnValue(true);
            await expect(
                fileStorage.save(testFile, { overwrite: false }),
            ).rejects.toThrow(SystemUseError);
        });

        it("should throw SystemUseError on pipeline error", async () => {
            (pipeline as jest.Mock).mockImplementationOnce(() => {
                throw new Error("Pipeline failed");
            });
            await expect(fileStorage.save(testFile)).rejects.toThrow(SystemUseError);
        });
    });

    describe("remove", () => {
        it("should remove a file successfully", async () => {
            mockFs.existsSync.mockReturnValue(true);
            await expect(fileStorage.remove("test.txt")).resolves.toBeUndefined();
            expect(mockFs.unlinkSync).toHaveBeenCalled();
        });

        it("should throw SystemUseError if file does not exist", async () => {
            mockFs.existsSync.mockReturnValue(false);
            await expect(fileStorage.remove("test.txt")).rejects.toThrow(SystemUseError);
        });
    });

    describe("saveAll", () => {
        it("should save multiple files successfully", async () => {
            const files: MultipartFile[] = [
                { ...testFile, filename: "a.txt" },
                { ...testFile, filename: "b.txt" },
            ];
            await expect(fileStorage.saveAll(files)).resolves.toEqual(files);
        });

        it("should throw SystemUseError on error", async () => {
            (pipeline as jest.Mock).mockImplementationOnce(() => {
                throw new Error("Pipeline failed");
            });
            await expect(fileStorage.saveAll([testFile])).rejects.toThrow(SystemUseError);
        });
    });

    describe("transform", () => {
        it("should set transform options and return itself", () => {
            const options:any = { resize: { width: 100, height: 100 }, format: "jpeg" };
            const result = fileStorage.transform(options);
            expect(result).toBe(fileStorage);
            // @ts-ignore
            expect(fileStorage.transformOptions).toEqual(options);
        });
    });

    // describe("processImage", () => {
    //     it("should throw InternalErrorException if sharp is not installed", async () => {
    //         jest.resetModules();
    //         const fileStorage = new (require("./file-storage").FileStorage)();
    //         fileStorage.transform({ format: "jpeg" });
    //         await expect(
    //             fileStorage["processImage"](new Readable({ read() {} }), "output.jpg"),
    //         ).rejects.toThrow(InternalErrorException);
    //     });
    // });

    describe("ensureDirectoryExists", () => {
        it("should create directory if not exists", async () => {
            mockFs.existsSync.mockReturnValue(false);
            await fileStorage["ensureDirectoryExists"]("public/test.txt");
            expect(mockFs.mkdirSync).toHaveBeenCalled();
        });

        it("should not create directory if exists", async () => {
            mockFs.existsSync.mockReturnValue(true);
            await fileStorage["ensureDirectoryExists"]("public/test.txt");
            expect(mockFs.mkdirSync).not.toHaveBeenCalled();
        });
    });
});