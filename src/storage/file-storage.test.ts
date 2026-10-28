import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { FileStorage } from "./file-storage";
import { SystemUseError } from "../common/exceptions/system-exception";
import { NotFoundException } from "../common/exceptions/http-exceptions";
import { MultipartFile } from "../http/multipart";

// These tests run against a real temporary directory so path checks are
// exercised against the actual filesystem rather than mocks.

function makeFile(
  filename = "test.txt",
  content: string | Buffer = "hello",
  extra: Record<string, any> = {},
): MultipartFile {
  return {
    type: "file",
    filename,
    mimetype: "text/plain",
    file: Readable.from([Buffer.from(content)]),
    ...extra,
  } as unknown as MultipartFile;
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of stream as any) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString();
}

function makeSavedFile(tmpPath: string, filename = "saved.txt"): MultipartFile {
  return {
    type: "file",
    filename,
    mimetype: "text/plain",
    filepath: tmpPath,
    file: undefined,
  } as unknown as MultipartFile;
}

describe("FileStorage", () => {
  let root: string;
  let baseDir: string;
  let storage: FileStorage;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "avleon-storage-"));
    baseDir = path.join(root, "public");
    fs.mkdirSync(baseDir);
    storage = new FileStorage().configure({ baseDir });
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe("save", () => {
    it("saves under a random name that keeps the extension", async () => {
      const result = await storage.save(
        makeFile("photo.png", "x", { mimetype: "image/png" }),
      );

      expect(result.filename).toMatch(/^[0-9a-f-]{36}\.png$/);
      expect(result.originalFilename).toBe("photo.png");
      expect(result.uploadPath).toBe(`/uploads/${result.filename}`);
      expect(result.staticPath).toBe(`/static/${result.filename}`);
      expect(fs.readFileSync(path.join(baseDir, result.filename), "utf8")).toBe(
        "x",
      );
    });

    it("keeps the client filename when preserveFilename is set", async () => {
      const result = await storage.save(makeFile("notes.txt"), {
        preserveFilename: true,
      });
      expect(result.filename).toBe("notes.txt");
      expect(fs.existsSync(path.join(baseDir, "notes.txt"))).toBe(true);
    });

    it("saves under saveAs inside a subdirectory", async () => {
      const result = await storage.save(makeFile(), {
        to: "docs/2026",
        saveAs: "a.txt",
      });
      expect(result.uploadPath).toBe("/uploads/docs/2026/a.txt");
      expect(fs.existsSync(path.join(baseDir, "docs", "2026", "a.txt"))).toBe(
        true,
      );
    });

    it("does not overwrite by default", async () => {
      fs.writeFileSync(path.join(baseDir, "index.txt"), "original");
      await expect(
        storage.save(makeFile("index.txt", "evil"), { preserveFilename: true }),
      ).rejects.toThrow(SystemUseError);
      expect(fs.readFileSync(path.join(baseDir, "index.txt"), "utf8")).toBe(
        "original",
      );
    });

    it("overwrites when overwrite is true", async () => {
      fs.writeFileSync(path.join(baseDir, "a.txt"), "old");
      await storage.save(makeFile("a.txt", "new"), {
        saveAs: "a.txt",
        overwrite: true,
      });
      expect(fs.readFileSync(path.join(baseDir, "a.txt"), "utf8")).toBe("new");
    });

    it("rejects extensions outside the default allowlist", async () => {
      await expect(
        storage.save(makeFile("index.html", "<script>")),
      ).rejects.toThrow(/not allowed/);
      await expect(storage.save(makeFile("logo.svg"))).rejects.toThrow(
        /not allowed/,
      );
      await expect(storage.save(makeFile(".htaccess"))).rejects.toThrow(
        /not allowed/,
      );
      expect(fs.readdirSync(baseDir)).toEqual([]);
    });

    it("rejects a saveAs with a disallowed extension", async () => {
      await expect(
        storage.save(makeFile("a.txt"), { saveAs: "index.html" }),
      ).rejects.toThrow(/not allowed/);
    });

    it("accepts a custom extension allowlist, or none", async () => {
      await expect(
        storage.save(makeFile("model.stl"), { allowedExtensions: [".STL"] }),
      ).resolves.toBeDefined();
      await expect(
        storage.save(makeFile("anything.xyz"), { allowedExtensions: null }),
      ).resolves.toBeDefined();
    });

    it("enforces a MIME allowlist when configured", async () => {
      await expect(
        storage.save(makeFile("a.png", "x", { mimetype: "text/html" }), {
          allowedMimeTypes: ["image/*"],
        }),
      ).rejects.toThrow(/MIME type/);
      await expect(
        storage.save(makeFile("a.png", "x", { mimetype: "image/png" }), {
          allowedMimeTypes: ["image/*"],
        }),
      ).resolves.toBeDefined();
    });

    it("enforces maxFileSize and removes the partial file", async () => {
      await expect(
        storage.save(makeFile("big.txt", Buffer.alloc(1024)), {
          maxFileSize: 100,
        }),
      ).rejects.toThrow(/maximum size/);
      expect(fs.readdirSync(baseDir)).toEqual([]);
    });

    it("rejects a stream that @fastify/multipart truncated", async () => {
      const f = makeFile("a.txt");
      (f.file as any).truncated = true;
      await expect(storage.save(f)).rejects.toThrow(/maximum size/);
      expect(fs.readdirSync(baseDir)).toEqual([]);
    });

    it("reads from filepath for an already-saved file and removes the temp file", async () => {
      const tmp = path.join(root, "upload.tmp");
      fs.writeFileSync(tmp, "from-disk");
      const result = await storage.save(makeSavedFile(tmp));
      expect(fs.readFileSync(path.join(baseDir, result.filename), "utf8")).toBe(
        "from-disk",
      );
      expect(fs.existsSync(tmp)).toBe(false);
    });

    it("throws when file type is not 'file'", async () => {
      await expect(storage.save({ type: "field" } as any)).rejects.toThrow(
        "Invalid file type",
      );
    });

    it("throws when there is no stream or filepath", async () => {
      await expect(
        storage.save({ type: "file", filename: "a.txt" } as any),
      ).rejects.toThrow("No file stream or filepath available");
    });

    it.each(["", "   ", "..", "../a.txt", "a/b.txt", "a\\b.txt", "a\0.txt"])(
      "rejects unsafe filename %j",
      async (name) => {
        await expect(storage.save(makeFile(name))).rejects.toThrow(
          SystemUseError,
        );
        await expect(
          storage.save(makeFile("a.txt"), { saveAs: name }),
        ).rejects.toThrow(SystemUseError);
      },
    );

    it("rejects a `to` that escapes the root, including a sibling prefix", async () => {
      fs.mkdirSync(path.join(root, "public-evil"));
      for (const to of [
        "..",
        "../public-evil",
        "../../etc",
        "a/../../x",
        path.join(root, "x"),
      ]) {
        await expect(storage.save(makeFile(), { to })).rejects.toThrow(
          "Invalid upload directory",
        );
      }
      expect(fs.readdirSync(path.join(root, "public-evil"))).toEqual([]);
    });
  });

  describe("transform", () => {
    it("does not leak transform options into other saves", async () => {
      const scoped = storage.transform({ format: "webp" });
      expect(scoped).not.toBe(storage);
      expect((storage as any).transformOptions).toBeNull();
      expect((scoped as any).transformOptions).toEqual({ format: "webp" });

      // A save on the shared instance must not pick up the scoped transform.
      const result = await storage.save(makeFile("a.png", "x"));
      expect(result.filename.endsWith(".png")).toBe(true);
    });
  });

  describe("saveAll", () => {
    it("returns [] for empty or null input", async () => {
      expect(await storage.saveAll([])).toEqual([]);
      expect(await storage.saveAll(null as any)).toEqual([]);
    });

    it("saves every file into the subdirectory", async () => {
      const results = await storage.saveAll(
        [makeFile("a.txt"), makeFile("b.txt")],
        {
          to: "batch",
        },
      );
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.uploadPath).toBe(`/uploads/batch/${r.filename}`);
        expect(fs.existsSync(path.join(baseDir, "batch", r.filename))).toBe(
          true,
        );
      }
    });

    it("rejects a sibling-prefix `to`", async () => {
      await expect(
        storage.saveAll([makeFile()], { to: "../public-evil" }),
      ).rejects.toThrow("Invalid upload directory");
    });

    it("rejects unsafe filenames", async () => {
      await expect(storage.saveAll([makeFile("../x.txt")])).rejects.toThrow(
        SystemUseError,
      );
    });
  });

  describe("remove", () => {
    it("removes an existing file", async () => {
      fs.writeFileSync(path.join(baseDir, "a.txt"), "x");
      await storage.remove("a.txt");
      expect(fs.existsSync(path.join(baseDir, "a.txt"))).toBe(false);
    });

    it("throws when the file does not exist", async () => {
      await expect(storage.remove("missing.txt")).rejects.toThrow(
        "File doesn't exist",
      );
    });

    it("rejects paths outside the root, including a sibling prefix", async () => {
      fs.mkdirSync(path.join(root, "public-evil"));
      fs.writeFileSync(path.join(root, "public-evil", "x.txt"), "x");
      await expect(storage.remove("../public-evil/x.txt")).rejects.toThrow(
        "Invalid file path",
      );
      await expect(storage.remove("../secret.txt")).rejects.toThrow(
        "Invalid file path",
      );
      expect(fs.existsSync(path.join(root, "public-evil", "x.txt"))).toBe(true);
    });
  });

  describe("reads", () => {
    beforeEach(() => {
      fs.writeFileSync(path.join(baseDir, "report.pdf"), "pdf");
      fs.writeFileSync(path.join(root, "secret.txt"), "secret");
      fs.mkdirSync(path.join(root, "public-evil"));
      fs.writeFileSync(path.join(root, "public-evil", "x.txt"), "x");
    });

    it("getUploadFile reads files under the root", async () => {
      expect((await storage.getUploadFile("report.pdf")).toString()).toBe(
        "pdf",
      );
    });

    it("download accepts relative paths and absolute paths inside the root", async () => {
      const a = await storage.download("report.pdf");
      expect(a.filename).toBe("report.pdf");
      expect(await readAll(a.stream)).toBe("pdf");
      const b = await storage.download(path.join(baseDir, "report.pdf"));
      expect(b.filename).toBe("report.pdf");
      expect(await readAll(b.stream)).toBe("pdf");
    });

    it("downloadAs uses the given filename", async () => {
      const r = await storage.downloadAs("report.pdf", "Q3 Report.pdf");
      expect(r.filename).toBe("Q3 Report.pdf");
      expect(await readAll(r.stream)).toBe("pdf");
    });

    it.each([["../secret.txt"], ["../public-evil/x.txt"], ["/etc/passwd"]])(
      "refuses to read %s",
      async (p) => {
        await expect(storage.getUploadFile(p)).rejects.toThrow();
        await expect(storage.download(p)).rejects.toThrow();
        await expect(storage.downloadAs(p, "x")).rejects.toThrow();
      },
    );

    it("refuses an absolute path outside the root", async () => {
      await expect(
        storage.download(path.join(root, "secret.txt")),
      ).rejects.toThrow("Invalid file path");
    });

    it("throws NotFoundException for missing files and directories", async () => {
      await expect(storage.download("missing.pdf")).rejects.toThrow(
        NotFoundException,
      );
      fs.mkdirSync(path.join(baseDir, "dir"));
      await expect(storage.download("dir")).rejects.toThrow(NotFoundException);
    });

    it("refuses a symlink that points outside the root", async () => {
      const link = path.join(baseDir, "link.txt");
      try {
        fs.symlinkSync(path.join(root, "secret.txt"), link);
      } catch {
        return; // symlinks need extra privileges on some Windows setups
      }
      await expect(storage.getUploadFile("link.txt")).rejects.toThrow(
        "Invalid file path",
      );
    });
  });
});
