import fs, { PathLike } from "fs";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { MultipartFile } from "../http/multipart";
import { AppService } from "../common/decorators";
import { SystemUseError } from "../common/exceptions/system-exception";
import { SavedMultipartFile } from "@fastify/multipart";
import {
  InternalErrorException,
  NotFoundException,
} from "../common/exceptions/http-exceptions";
import {
  DEFAULT_ALLOWED_UPLOAD_EXTENSIONS,
  fileExtension,
  isSafeFilename,
  randomFilename,
  resolveWithin,
} from "../common/utils/path-utils";

export interface TransformOptions {
  resize?: { width: number; height: number };
  format?: "jpeg" | "png" | "webp" | "avif";
  quality?: number;
}

export interface FileStorageInterface {
  transform(options: TransformOptions): FileStorage;
  save(
    file: MultipartFile,
    options?: SaveOptionsSingle,
  ): Promise<SavedFileInfo>;
  saveAll(
    files: MultipartFile[],
    options?: SaveOptions,
  ): Promise<SavedFileInfo[]>;
  remove(filepath: string): Promise<void>;
}

export interface UploadPolicy {
  /**
   * Allowed file extensions (with the dot, case-insensitive). Defaults to
   * {@link DEFAULT_ALLOWED_UPLOAD_EXTENSIONS}. `null` disables the check.
   */
  allowedExtensions?: string[] | null;
  /**
   * Allowed MIME types as reported by the client. Not checked unless set.
   * Entries ending in `/*` match a whole family, e.g. `"image/*"`.
   */
  allowedMimeTypes?: string[] | null;
  /** Maximum size of a single file in bytes. Defaults to 50MB. */
  maxFileSize?: number;
}

export interface SaveOptions extends UploadPolicy {
  /** Overwrite an existing file with the same name. Defaults to `false`. */
  overwrite?: boolean;
  /** Sub-directory of the storage root to save into. */
  to?: string;
  /**
   * Keep the client's filename instead of generating a random one.
   * Defaults to `false`.
   */
  preserveFilename?: boolean;
  /** Image transformation for this call. */
  transform?: TransformOptions;
}

export interface SaveOptionsSingle extends SaveOptions {
  /** Explicit filename to save as. Must be a plain filename. */
  saveAs?: string;
}

export interface FileStorageOptions extends UploadPolicy {
  /** Storage root. Defaults to `<cwd>/public`. */
  baseDir?: string;
}

export interface SavedFileInfo {
  filename: string;
  originalFilename: string;
  size: number;
  uploadPath: string;
  staticPath: string;
}

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@AppService
export class FileStorage implements FileStorageInterface {
  private transformOptions: TransformOptions | null = null;
  private baseDir: string;
  private policy: Required<UploadPolicy> = {
    allowedExtensions: [...DEFAULT_ALLOWED_UPLOAD_EXTENSIONS],
    allowedMimeTypes: null,
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
  };

  constructor() {
    this.baseDir = path.join(process.cwd(), "public");
  }

  /**
   * Change the storage root and the default upload policy.
   */
  configure(options: FileStorageOptions): this {
    const { baseDir, ...policy } = options;
    if (baseDir) this.baseDir = path.resolve(baseDir);
    for (const [key, value] of Object.entries(policy)) {
      if (value !== undefined) (this.policy as any)[key] = value;
    }
    return this;
  }

  /**
   * Return a storage handle that applies `options` to its next saves.
   *
   * The returned object is scoped to the caller, so concurrent requests on
   * the shared `FileStorage` instance never see each other's transforms.
   */
  transform(options: TransformOptions): FileStorage {
    const scoped = Object.create(this) as FileStorage;
    scoped.transformOptions = options;
    return scoped;
  }

  /**
   * Read a file under the storage root.
   */
  async getUploadFile(filePath: string) {
    const fullPath = await this.resolveExistingFile(filePath);
    return fs.promises.readFile(fullPath);
  }

  /**
   * Stream a file under the storage root as a download.
   */
  async download(filepath: PathLike) {
    const fullPath = await this.resolveExistingFile(filepath.toString());
    return {
      download: true,
      stream: fs.createReadStream(fullPath),
      filename: path.basename(fullPath),
    };
  }

  /**
   * Stream a file under the storage root as a download named `filename`.
   */
  async downloadAs(filepath: PathLike, filename: string) {
    const fullPath = await this.resolveExistingFile(filepath.toString());
    return {
      download: true,
      stream: fs.createReadStream(fullPath),
      filename,
    };
  }

  /**
   * Save a single file with optional transformations
   */
  async save(
    f: MultipartFile,
    options?: SaveOptionsSingle,
  ): Promise<SavedFileInfo> {
    if (!f || f.type !== "file") {
      throw new SystemUseError("Invalid file type");
    }
    const uploadDir = this.resolveUploadDir(options?.to);
    return this.saveOne(f, uploadDir, options ?? {}, options?.saveAs);
  }

  /**
   * Save multiple files
   */
  async saveAll(
    files: MultipartFile[],
    options?: SaveOptions,
  ): Promise<SavedFileInfo[]> {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadDir = this.resolveUploadDir(options?.to);
    const results: SavedFileInfo[] = [];
    for (const f of files) {
      results.push(await this.saveOne(f, uploadDir, options ?? {}));
    }
    return results;
  }

  /**
   * Remove a file from storage
   */
  async remove(filepath: string): Promise<void> {
    const fullPath = resolveWithin(this.baseDir, filepath);
    if (!fullPath) {
      throw new SystemUseError("Invalid file path");
    }

    if (!this.isFileExists(fullPath)) {
      throw new SystemUseError("File doesn't exist");
    }

    try {
      fs.unlinkSync(fullPath);
    } catch (error) {
      console.error("File removal error:", error);
      throw new SystemUseError("Failed to remove file");
    }
  }

  private async saveOne(
    f: MultipartFile,
    uploadDir: string,
    options: SaveOptions,
    saveAs?: string,
  ): Promise<SavedFileInfo> {
    const policy = this.effectivePolicy(options);
    const transform = options.transform ?? this.transformOptions;
    const originalFilename = f.filename;

    this.validateFilename(originalFilename);
    if (saveAs !== undefined) this.validateFilename(saveAs);
    this.checkPolicy(originalFilename, f.mimetype, policy);
    if (saveAs !== undefined) this.checkPolicy(saveAs, undefined, policy);

    const isImage = !!transform && this.isImageFile(originalFilename);
    let filename: string;
    if (saveAs !== undefined) {
      filename = saveAs;
    } else if (options.preserveFilename) {
      filename = originalFilename;
    } else {
      const ext =
        isImage && transform?.format
          ? transform.format === "jpeg"
            ? ".jpg"
            : "." + transform.format
          : fileExtension(originalFilename);
      filename = randomFilename(ext);
    }

    const fullPath = resolveWithin(uploadDir, filename);
    if (!fullPath) {
      throw new SystemUseError("Invalid file path");
    }

    const overwrite = options.overwrite ?? false;
    if (!overwrite && this.isFileExists(fullPath)) {
      throw new SystemUseError(`File ${filename} already exists`);
    }

    const savedFile = f as SavedMultipartFile;
    let source: NodeJS.ReadableStream;
    if (f.file) {
      source = f.file;
    } else if (savedFile.filepath) {
      const { size } = await fs.promises.stat(savedFile.filepath);
      if (size > policy.maxFileSize) {
        this.removeFileSync(savedFile.filepath);
        throw new SystemUseError(
          `File ${originalFilename} exceeds the maximum size`,
        );
      }
      source = fs.createReadStream(savedFile.filepath);
    } else {
      throw new SystemUseError("No file stream or filepath available");
    }

    await this.ensureDirectoryExists(uploadDir);

    let size = 0;
    const limiter = new Transform({
      transform(chunk, _enc, cb) {
        size += chunk.length;
        if (size > policy.maxFileSize) {
          cb(
            new SystemUseError(
              `File ${originalFilename} exceeds the maximum size`,
            ),
          );
        } else {
          cb(null, chunk);
        }
      },
    });
    // "wx" fails if the file appeared after the existence check above.
    const out = fs.createWriteStream(fullPath, {
      flags: overwrite ? "w" : "wx",
    });

    try {
      if (isImage) {
        await this.processImage(source, limiter, out, transform!);
      } else {
        await pipeline(source, limiter, out);
      }
      if ((f.file as any)?.truncated) {
        throw new SystemUseError(
          `File ${originalFilename} exceeds the maximum size`,
        );
      }
    } catch (err: any) {
      if (err?.code !== "EEXIST") this.removeFileSync(fullPath);
      if (
        err instanceof SystemUseError ||
        err instanceof InternalErrorException
      ) {
        throw err;
      }
      if (err?.code === "EEXIST") {
        throw new SystemUseError(`File ${filename} already exists`);
      }
      console.error(`Failed to save file ${originalFilename}:`, err);
      throw new SystemUseError(`Failed to upload file ${originalFilename}`);
    } finally {
      if (savedFile.filepath && !f.file) {
        this.removeFileSync(savedFile.filepath);
      }
    }

    const rel = path.relative(this.baseDir, fullPath).split(path.sep).join("/");
    return {
      filename,
      originalFilename,
      size,
      uploadPath: "/uploads/" + rel,
      staticPath: "/static/" + rel,
    };
  }

  /**
   * Process image with transformations using sharp
   */
  private async processImage(
    fileStream: NodeJS.ReadableStream,
    limiter: Transform,
    out: fs.WriteStream,
    options: TransformOptions,
  ): Promise<void> {
    let sharp: any;
    try {
      sharp = await import("sharp");
    } catch {
      out.destroy();
      throw new InternalErrorException(
        "sharp module not found. Please install sharp to use image transformations.",
      );
    }

    let sharpPipeline = sharp.default();
    if (options.resize) {
      sharpPipeline = sharpPipeline.resize(
        options.resize.width,
        options.resize.height,
        { fit: "inside", withoutEnlargement: true },
      );
    }

    if (options.format) {
      const quality = options.quality || 80;
      switch (options.format) {
        case "jpeg":
          sharpPipeline = sharpPipeline.jpeg({ quality });
          break;
        case "png":
          sharpPipeline = sharpPipeline.png({ quality });
          break;
        case "webp":
          sharpPipeline = sharpPipeline.webp({ quality });
          break;
        case "avif":
          sharpPipeline = sharpPipeline.avif({ quality });
          break;
      }
    }

    try {
      await pipeline(fileStream, limiter, sharpPipeline, out);
    } catch (error: any) {
      if (error instanceof SystemUseError) throw error;
      console.error("Image processing failed:", error);
      throw new InternalErrorException("Image processing failed");
    }
  }

  /**
   * Helper methods
   */
  private effectivePolicy(options: UploadPolicy): Required<UploadPolicy> {
    return {
      allowedExtensions:
        options.allowedExtensions !== undefined
          ? options.allowedExtensions
          : this.policy.allowedExtensions,
      allowedMimeTypes:
        options.allowedMimeTypes !== undefined
          ? options.allowedMimeTypes
          : this.policy.allowedMimeTypes,
      maxFileSize: options.maxFileSize ?? this.policy.maxFileSize,
    };
  }

  private checkPolicy(
    filename: string,
    mimetype: string | undefined,
    policy: Required<UploadPolicy>,
  ): void {
    if (policy.allowedExtensions) {
      const ext = fileExtension(filename);
      const allowed = policy.allowedExtensions.map((e) => e.toLowerCase());
      if (!ext || !allowed.includes(ext)) {
        throw new SystemUseError(
          `File type "${ext || filename}" is not allowed`,
        );
      }
    }
    if (policy.allowedMimeTypes) {
      const type = (mimetype || "").toLowerCase();
      const ok = policy.allowedMimeTypes.some((m) => {
        const want = m.toLowerCase();
        return want.endsWith("/*")
          ? type.startsWith(want.slice(0, -1))
          : type === want;
      });
      if (!ok) {
        throw new SystemUseError(`MIME type "${mimetype}" is not allowed`);
      }
    }
  }

  private resolveUploadDir(to?: string): string {
    if (to === undefined || to === "") return this.baseDir;
    const dir = resolveWithin(this.baseDir, to, true);
    if (!dir) {
      throw new SystemUseError("Invalid upload directory");
    }
    return dir;
  }

  /**
   * Resolve `filePath` inside the storage root, following symlinks, and make
   * sure it is an existing regular file.
   */
  private async resolveExistingFile(filePath: string): Promise<string> {
    const candidate = resolveWithin(this.baseDir, filePath);
    if (!candidate) {
      throw new SystemUseError("Invalid file path");
    }
    let real: string;
    let realBase: string;
    try {
      real = await fs.promises.realpath(candidate);
      realBase = await fs.promises.realpath(this.baseDir);
    } catch {
      throw new NotFoundException("File not found");
    }
    if (!resolveWithin(realBase, real)) {
      throw new SystemUseError("Invalid file path");
    }
    const stat = await fs.promises.stat(real);
    if (!stat.isFile()) {
      throw new NotFoundException("File not found");
    }
    return real;
  }

  private isFileExists(fpath: string): boolean {
    return fs.existsSync(fpath);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  private removeFileSync(filepath: string): void {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (error) {
      console.error("Failed to remove temp file:", error);
    }
  }

  private isImageFile(filename: string): boolean {
    const ext = fileExtension(filename);
    return [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp"].includes(
      ext,
    );
  }

  private validateFilename(filename: string): void {
    if (!isSafeFilename(filename)) {
      throw new SystemUseError("Invalid filename");
    }
  }
}
