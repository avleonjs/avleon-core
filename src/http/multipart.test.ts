import { UploadFileFromRequest } from "./multipart";
import {
  BadRequestException,
  InternalErrorException,
} from "../common/exceptions";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { IRequest } from "../core/types";

const mockReq = (fileData: any) =>
  ({
    params: {},
    query: {},
    body: {},
    headers: {},
    method: "POST",
    url: "/upload",
    file: jest.fn().mockResolvedValue(fileData),
  }) as unknown as IRequest;

const upload = (filename: string, content = "data") => ({
  file: Readable.from([Buffer.from(content)]),
  filename,
});

describe("UploadFileFromRequest", () => {
  let dest: string;

  beforeEach(() => {
    dest = fs.mkdtempSync(path.join(os.tmpdir(), "avleon-multipart-"));
  });

  afterEach(() => {
    fs.rmSync(dest, { recursive: true, force: true });
  });

  it("saves under a random name inside dest", async () => {
    const result: any = await UploadFileFromRequest(
      mockReq(upload("photo.png")),
      { dest },
    );

    expect(result.filename).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(result.originalFilename).toBe("photo.png");
    expect(fs.readFileSync(path.join(dest, result.filename), "utf8")).toBe(
      "data",
    );
  });

  it("saves under saveAs when given", async () => {
    const result: any = await UploadFileFromRequest(mockReq(upload("a.txt")), {
      dest,
      saveAs: "b.txt",
    });
    expect(result.filename).toBe("b.txt");
    expect(fs.existsSync(path.join(dest, "b.txt"))).toBe(true);
  });

  it.each(["../evil.txt", "..\\evil.txt", "sub/evil.txt", "..", "a\0.txt"])(
    "rejects client filename %j",
    async (filename) => {
      await expect(
        UploadFileFromRequest(mockReq(upload(filename)), { dest }),
      ).rejects.toThrow(BadRequestException);
      expect(fs.existsSync(path.join(dest, "..", "evil.txt"))).toBe(false);
    },
  );

  it("rejects an unsafe saveAs", async () => {
    await expect(
      UploadFileFromRequest(mockReq(upload("a.txt")), {
        dest,
        saveAs: "../x.txt",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects active-content extensions by default", async () => {
    await expect(
      UploadFileFromRequest(mockReq(upload("index.html")), { dest }),
    ).rejects.toThrow(/not allowed/);
    expect(fs.readdirSync(dest)).toEqual([]);
  });

  it("throws if the target file already exists", async () => {
    fs.writeFileSync(path.join(dest, "exists.txt"), "original");
    await expect(
      UploadFileFromRequest(mockReq(upload("exists.txt")), {
        dest,
        preserveFilename: true,
      }),
    ).rejects.toThrow(InternalErrorException);
    expect(fs.readFileSync(path.join(dest, "exists.txt"), "utf8")).toBe(
      "original",
    );
  });

  it("returns undefined if no file is present", async () => {
    const result = await UploadFileFromRequest(mockReq(null));
    expect(result).toBeUndefined();
  });
});
