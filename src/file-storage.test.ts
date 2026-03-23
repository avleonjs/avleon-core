import fs, { PathLike } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { FileStorage } from "./file-storage";
import { SystemUseError } from "./exceptions/system-exception";
import { MultipartFile } from "./multipart";
import { SavedMultipartFile } from "@fastify/multipart";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("fs");
jest.mock("stream/promises", () => ({
  pipeline: jest.fn(() => Promise.resolve()),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPipeline = pipeline as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<MultipartFile> = {}): MultipartFile {
  return {
    type: "file",
    filename: "test.txt",
    file: new Readable({ read() {} }),
    ...overrides,
  } as MultipartFile;
}

// Models a file that was already saved to disk by @fastify/multipart
// (has a filepath, no .file stream)
function makeSavedFile(
  overrides: Partial<SavedMultipartFile> = {},
): MultipartFile {
  return {
    type: "file",
    filename: "saved.txt",
    filepath: "/tmp/saved.txt",
    file: undefined,
    ...overrides,
  } as unknown as MultipartFile;
}

// Suppress expected console.error noise from the implementation's catch blocks
// so the test output stays clean. Errors are still thrown and asserted on.
let consoleSpy: jest.SpyInstance;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("FileStorage", () => {
  let storage: FileStorage;
  const baseDir = path.join(process.cwd(), "public");

  beforeEach(() => {
    jest.clearAllMocks();

    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Default: nothing exists on disk
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.createWriteStream.mockReturnValue({} as any);
    mockFs.createReadStream.mockReturnValue(new Readable({ read() {} }) as any);
    mockFs.unlinkSync.mockImplementation(() => {});
    mockPipeline.mockResolvedValue(undefined);

    // FileStorage constructor calls ensureDirectoryExists(baseDir).
    // At that point existsSync returns false so mkdirSync fires once.
    // We create the instance AFTER setting up mocks so the call is counted,
    // then we clear the mock before individual tests that need a clean slate.
    storage = new FileStorage();

    // Clear constructor-time calls so per-test assertions are unambiguous
    mockFs.mkdirSync.mockClear();
    mockFs.existsSync.mockClear();
    // Restore default after clear
    mockFs.existsSync.mockReturnValue(false);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ── transform ───────────────────────────────────────────────────────────────

  describe("transform", () => {
    it("should store transform options and return the same instance (fluent API)", () => {
      const opts = {
        resize: { width: 200, height: 200 },
        format: "webp" as const,
        quality: 75,
      };
      const result = storage.transform(opts);

      expect(result).toBe(storage);
      // @ts-ignore — accessing private field for assertion
      expect(storage.transformOptions).toEqual(opts);
    });
  });

  // ── save — happy paths ───────────────────────────────────────────────────────

  describe("save", () => {
    it("should save a file to baseDir and return correct paths", async () => {
      const result = await storage.save(makeFile());
      expect(result).toEqual({
        uploadPath: "/uploads/test.txt",
        staticPath: "/static/test.txt",
      });
    });

    it("should save to a subdirectory when options.to is provided", async () => {
      const result = await storage.save(makeFile(), { to: "images" });
      expect(result).toEqual({
        uploadPath: "/uploads/images/test.txt",
        staticPath: "/static/images/test.txt",
      });
    });

    it("should save under saveAs filename when provided", async () => {
      const result = await storage.save(makeFile(), { saveAs: "renamed.txt" });
      expect(result).toEqual({
        uploadPath: "/uploads/renamed.txt",
        staticPath: "/static/renamed.txt",
      });
    });

    it("should save under saveAs inside subdirectory", async () => {
      const result = await storage.save(makeFile(), {
        to: "docs",
        saveAs: "renamed.txt",
      });
      expect(result).toEqual({
        uploadPath: "/uploads/docs/renamed.txt",
        staticPath: "/static/docs/renamed.txt",
      });
    });

    it("should use savedFile.filepath read stream when file.file is absent", async () => {
      const saved = makeSavedFile({ filename: "disk.txt" });
      // Only the temp file path exists
      mockFs.existsSync.mockImplementation((p) => p === "/tmp/saved.txt");

      const result = await storage.save(saved);
      expect(mockFs.createReadStream).toHaveBeenCalledWith("/tmp/saved.txt");
      expect(result.uploadPath).toBe("/uploads/disk.txt");
    });

    it("should delete the temp filepath after saving a SavedMultipartFile", async () => {
      const saved = makeSavedFile({ filename: "disk.txt" });
      mockFs.existsSync.mockImplementation((p) => p === "/tmp/saved.txt");

      await storage.save(saved);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith("/tmp/saved.txt");
    });

    it("should overwrite by default (overwrite defaults to true)", async () => {
      mockFs.existsSync.mockReturnValue(true); // file already exists
      await expect(storage.save(makeFile())).resolves.toBeDefined();
    });

    it("should create upload directory if it does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);
      await storage.save(makeFile(), { to: "newdir" });
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join(baseDir, "newdir"),
        { recursive: true },
      );
    });

    // ── save — error paths ────────────────────────────────────────────────────

    it("should throw SystemUseError when file type is not 'file'", async () => {
      const bad = makeFile({ type: "field" as any });
      await expect(storage.save(bad)).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError when overwrite is false and file exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      await expect(
        storage.save(makeFile(), { overwrite: false }),
      ).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError when both file.file and savedFile.filepath are absent", async () => {
      const bad = { type: "file", filename: "ghost.txt" } as MultipartFile;
      await expect(storage.save(bad)).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError when pipeline fails", async () => {
      mockPipeline.mockRejectedValueOnce(new Error("pipeline error"));
      await expect(storage.save(makeFile())).rejects.toThrow(SystemUseError);
    });

    it("should re-throw a SystemUseError with its original message (not double-wrapped)", async () => {
      mockPipeline.mockRejectedValueOnce(new SystemUseError("original"));
      await expect(storage.save(makeFile())).rejects.toThrow("original");
    });

    // ── save — filename validation ────────────────────────────────────────────

    it("should throw SystemUseError for an empty filename", async () => {
      await expect(storage.save(makeFile({ filename: "" }))).rejects.toThrow(
        SystemUseError,
      );
    });

    it("should throw SystemUseError for a blank (whitespace-only) filename", async () => {
      await expect(storage.save(makeFile({ filename: "   " }))).rejects.toThrow(
        SystemUseError,
      );
    });

    it("should throw SystemUseError for path traversal with ..", async () => {
      await expect(
        storage.save(makeFile({ filename: "../evil.txt" })),
      ).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError for filename containing forward slash", async () => {
      await expect(
        storage.save(makeFile({ filename: "dir/evil.txt" })),
      ).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError for filename containing backslash", async () => {
      await expect(
        storage.save(makeFile({ filename: "dir\\evil.txt" })),
      ).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError for filename containing null byte", async () => {
      await expect(
        storage.save(makeFile({ filename: "evil\0.txt" })),
      ).rejects.toThrow(SystemUseError);
    });
  });

  // ── saveAll ──────────────────────────────────────────────────────────────────

  describe("saveAll", () => {
    it("should return an empty array when given an empty array", async () => {
      await expect(storage.saveAll([])).resolves.toEqual([]);
    });

    it("should return an empty array for null input", async () => {
      await expect(storage.saveAll(null as any)).resolves.toEqual([]);
    });

    it("should save multiple files and return correct paths", async () => {
      const files = [
        makeFile({ filename: "a.txt" }),
        makeFile({ filename: "b.txt" }),
      ];
      const result = await storage.saveAll(files);
      expect(result).toEqual([
        { uploadPath: "/uploads/a.txt", staticPath: "/static/a.txt" },
        { uploadPath: "/uploads/b.txt", staticPath: "/static/b.txt" },
      ]);
    });

    it("should save to a subdirectory when options.to is provided", async () => {
      const result = await storage.saveAll(
        [makeFile({ filename: "img.png" })],
        {
          to: "photos",
        },
      );
      expect(result).toEqual([
        {
          uploadPath: "/uploads/photos/img.png",
          staticPath: "/static/photos/img.png",
        },
      ]);
    });

    it("should throw SystemUseError when overwrite is false and file exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      await expect(
        storage.saveAll([makeFile()], { overwrite: false }),
      ).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError when pipeline fails for a file", async () => {
      mockPipeline.mockRejectedValueOnce(new Error("disk full"));
      await expect(storage.saveAll([makeFile()])).rejects.toThrow(
        SystemUseError,
      );
    });

    it("should throw SystemUseError for path traversal in a filename", async () => {
      const bad = makeFile({ filename: "../etc/passwd" });
      await expect(storage.saveAll([bad])).rejects.toThrow(SystemUseError);
    });

    it("should use savedFile.filepath when file.file is absent", async () => {
      const saved = makeSavedFile({ filename: "disk.png" });
      mockFs.existsSync.mockImplementation((p) => p === "/tmp/saved.txt");

      await storage.saveAll([saved]);
      expect(mockFs.createReadStream).toHaveBeenCalledWith("/tmp/saved.txt");
    });

    it("should throw SystemUseError when SavedMultipartFile has no filepath", async () => {
      const bad = { type: "file", filename: "ghost.txt" } as MultipartFile;
      await expect(storage.saveAll([bad])).rejects.toThrow(SystemUseError);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("should remove an existing file successfully", async () => {
      mockFs.existsSync.mockReturnValue(true);
      await expect(storage.remove("test.txt")).resolves.toBeUndefined();
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        path.join(baseDir, "test.txt"),
      );
    });

    it("should throw SystemUseError when the file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);
      await expect(storage.remove("missing.txt")).rejects.toThrow(
        SystemUseError,
      );
    });

    it("should throw SystemUseError when unlinkSync throws", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error("permission denied");
      });
      await expect(storage.remove("test.txt")).rejects.toThrow(SystemUseError);
    });

    it("should throw SystemUseError for a path traversal attempt", async () => {
      // path.join(baseDir, '../secret.txt') resolves outside baseDir
      await expect(storage.remove("../secret.txt")).rejects.toThrow(
        SystemUseError,
      );
    });
  });

  // ── download ─────────────────────────────────────────────────────────────────

  describe("download", () => {
    it("should return a download object with the correct filename", async () => {
      const result = await storage.download("/public/uploads/photo.jpg");
      expect(result).toMatchObject({
        download: true,
        filename: "photo.jpg",
      });
      expect(result.stream).toBeDefined();
    });

    it("should fall back to 'file' when the path has no filename segment", async () => {
      const result = await storage.download("" as PathLike);
      expect(result.filename).toBe("file");
    });
  });

  // ── downloadAs ───────────────────────────────────────────────────────────────

  describe("downloadAs", () => {
    it("should return a download object with the provided custom filename", async () => {
      const result = await storage.downloadAs(
        "/public/uploads/photo.jpg",
        "custom-name.jpg",
      );
      expect(result).toMatchObject({
        download: true,
        filename: "custom-name.jpg",
      });
      expect(result.stream).toBeDefined();
    });
  });

  // ── ensureDirectoryExists (private) ─────────────────────────────────────────

  describe("ensureDirectoryExists (private)", () => {
    it("should call mkdirSync with recursive: true when directory is absent", async () => {
      mockFs.existsSync.mockReturnValue(false);
      // @ts-ignore
      await storage["ensureDirectoryExists"]("/some/new/dir");
      expect(mockFs.mkdirSync).toHaveBeenCalledWith("/some/new/dir", {
        recursive: true,
      });
    });

    it("should NOT call mkdirSync when directory already exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      // @ts-ignore
      await storage["ensureDirectoryExists"]("/some/existing/dir");
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  // ── isImageFile (private) ────────────────────────────────────────────────────

  describe("isImageFile (private)", () => {
    it.each([
      ["photo.jpg", true],
      ["photo.jpeg", true],
      ["photo.png", true],
      ["photo.webp", true],
      ["photo.avif", true],
      ["photo.gif", true],
      ["photo.bmp", true],
      ["document.pdf", false],
      ["archive.zip", false],
      ["script.js", false],
      ["PHOTO.JPG", true], // case-insensitive
    ])("%s → %s", (filename, expected) => {
      // @ts-ignore
      expect(storage["isImageFile"](filename)).toBe(expected);
    });
  });

  // ── validateFilename (private) ───────────────────────────────────────────────

  describe("validateFilename (private)", () => {
    it("should not throw for a valid filename", () => {
      // @ts-ignore
      expect(() =>
        storage["validateFilename"]("valid-file_123.txt"),
      ).not.toThrow();
    });

    it("should throw for an empty string", () => {
      // @ts-ignore
      expect(() => storage["validateFilename"]("")).toThrow(SystemUseError);
    });

    it("should throw for a whitespace-only string", () => {
      // @ts-ignore
      expect(() => storage["validateFilename"]("   ")).toThrow(SystemUseError);
    });

    it("should throw for filenames containing '..'", () => {
      // @ts-ignore
      expect(() => storage["validateFilename"]("../up.txt")).toThrow(
        SystemUseError,
      );
    });

    it("should throw for filenames containing '/'", () => {
      // @ts-ignore
      expect(() => storage["validateFilename"]("sub/file.txt")).toThrow(
        SystemUseError,
      );
    });

    it("should throw for filenames containing '\\'", () => {
      // @ts-ignore
      expect(() => storage["validateFilename"]("sub\\file.txt")).toThrow(
        SystemUseError,
      );
    });

    it("should throw for filenames containing null bytes", () => {
      // @ts-ignore
      expect(() => storage["validateFilename"]("file\0.txt")).toThrow(
        SystemUseError,
      );
    });
  });
});

