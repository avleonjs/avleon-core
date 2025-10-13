import { UploadFileFromRequest, MultipartFile } from "./multipart";
import { InternalErrorException } from "./exceptions";
import fs from "fs";
import { pipeline } from "stream/promises";
import { IRequest } from "./icore";

jest.mock("fs");
jest.mock("stream/promises", () => ({
    pipeline: jest.fn(() => Promise.resolve()),
}));

const mockFileStream = {} as NodeJS.ReadableStream;

const mockReq = (fileData: any) => ({
    params: {},
    query: {},
    body: {},
    headers: {},
    method: "POST",
    url: "/upload",
    file: jest.fn().mockResolvedValue(fileData),
    // Add any other required IRequest properties as needed for type compatibility
} as unknown as IRequest);

describe("UploadFileFromRequest", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fs.existsSync as jest.Mock).mockReturnValue(false);
    });

    // it("should save file to default location", async () => {
    //     const fileData = {
    //         file: mockFileStream,
    //         filename: "test.txt",
    //     };
    //     const req = mockReq(fileData);

    //     const result = await UploadFileFromRequest(req);

    //     expect(fs.existsSync).toHaveBeenCalled();
    //     expect(pipeline).toHaveBeenCalledWith(mockFileStream, expect.anything());
    //     expect(result).toMatchObject({
    //         ...fileData,
    //         filename: "test.txt",
    //     });
    // });

    // it("should save file to custom location with saveAs", async () => {
    //     const fileData = {
    //         file: mockFileStream,
    //         filename: "original.txt",
    //     };
    //     const req = mockReq(fileData);

    //     const options = { saveAs: "custom.txt" };
    //     const result = await UploadFileFromRequest(req, options);

    //     expect(fs.existsSync).toHaveBeenCalled();
    //     expect(pipeline).toHaveBeenCalledWith(mockFileStream, expect.anything());
    //     expect(result).toMatchObject({
    //         ...fileData,
    //         filename: "custom.txt",
    //     });
    // });

    // it("should save file to custom dest", async () => {
    //     const fileData = {
    //         file: mockFileStream,
    //         filename: "file.txt",
    //     };
    //     const req = mockReq(fileData);

    //     const options:any = { dest: "/tmp" };
    //     const result = await UploadFileFromRequest(req, options);

    //     expect(fs.existsSync).toHaveBeenCalled();
    //     expect(pipeline).toHaveBeenCalledWith(mockFileStream, expect.anything());
    //     expect(result).toMatchObject({
    //         ...fileData,
    //         filename: "file.txt",
    //     });
    // });

    it("should throw error if file already exists", async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);

        const fileData = {
            file: mockFileStream,
            filename: "exists.txt",
        };
        const req = mockReq(fileData);

        await expect(UploadFileFromRequest(req)).rejects.toThrow(InternalErrorException);
    });

    it("should return undefined if no file is present", async () => {
        const req = mockReq(null);

        const result = await UploadFileFromRequest(req);

        expect(result).toBeUndefined();
    });
});