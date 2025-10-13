import fs, { createReadStream, PathLike } from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { MultipartFile } from "./multipart";
import { AppService } from "./decorators";
import { SystemUseError } from "./exceptions/system-exception";
import { SavedMultipartFile } from "@fastify/multipart";
import { InternalErrorException } from "./exceptions/http-exceptions";
import mime from "mime";
interface TransformOptions {
  resize?: { width: number; height: number };
  format?: "jpeg" | "png" | "webp" | "avif";
  quality?: number;
}

export interface FileStorageInterface {
  transform(options: TransformOptions): FileStorage;
  save(
    file: MultipartFile,
    options?: SaveOptionsSingle,
  ): Promise<MultipartFile>;
  saveAll(
    files: MultipartFile[],
    options?: SaveOptions,
  ): Promise<MultipartFile[]>;
  remove(filepath: string): Promise<void>;
}

export interface SaveOptions {
  overwrite?: boolean;
  to?: string;
}

export interface SaveOptionsSingle extends SaveOptions {
  saveAs?: string;
}

@AppService
export class FileStorage implements FileStorageInterface {
  private transformOptions: TransformOptions | null = null;
  private readonly baseDir: string;
  private readonly maxFileSize: number = 50 * 1024 * 1024; // 50MB default

  constructor() {
    this.baseDir = path.join(process.cwd(), "public");
    this.ensureDirectoryExists(this.baseDir);
  }

  /**
   * Set transformation options for the next save operation
   */
  transform(options: TransformOptions): FileStorage {
    this.transformOptions = options;
    return this;
  }

  async getUploadFile(fliePath: string) {
    const f = await fs.promises.readFile(path.join(this.baseDir, fliePath));
    return f;
  }

  async download(filepath: PathLike) {
    const filename =
      filepath
        .toString()
        .split(/[\/\\]/)
        .pop() || "file";

    const s = createReadStream(filepath);
    return {
      download: true,
      stream: s,
      filename,
    };
  }
  async downloadAs(filepath: PathLike, filename: string) {
    const s = createReadStream(filepath);
    return {
      download: true,
      stream: s,
      filename,
    };
  }

  /**
   * Save a single file with optional transformations
   */
  async save(f: MultipartFile, options?: SaveOptionsSingle): Promise<any> {
    const opts: SaveOptionsSingle = {
      overwrite: options?.overwrite ?? true,
      to: options?.to,
      saveAs: options?.saveAs,
    };

    if (f.type !== "file") {
      throw new SystemUseError("Invalid file type");
    }

    try {
 
      const filename = opts.saveAs || f.filename;
      this.validateFilename(filename);
      const uploadDir = opts.to
        ? path.join(this.baseDir, opts.to)
        : this.baseDir;
      const fullPath = path.join(uploadDir, filename);


      if (!fullPath.startsWith(this.baseDir)) {
        throw new SystemUseError("Invalid file path");
      }

      // Check if file exists
      if (!opts.overwrite && this.isFileExists(fullPath)) {
        throw new SystemUseError("File already exists");
      }
      await this.ensureDirectoryExists(uploadDir);


      let sourceStream: NodeJS.ReadableStream;
      const savedFile = f as SavedMultipartFile;
      if (savedFile.filepath && !f.file) {
        sourceStream = fs.createReadStream(savedFile.filepath);
      } else if (f.file) {
        sourceStream = f.file;
      } else {
        throw new SystemUseError("No file stream or filepath available");
      }
      if (this.transformOptions && this.isImageFile(filename)) {
        await this.processImage(sourceStream, fullPath);
      } else {
        await pipeline(sourceStream, fs.createWriteStream(fullPath));
      }
      if (savedFile.filepath && fs.existsSync(savedFile.filepath)) {
        this.removeFileSync(savedFile.filepath);
      }
      if (opts.saveAs) {
        f.filename = opts.saveAs;
      }

      return { 
        uploadPath:  options?.to ?'/uploads/'+ options.to+"/"+ f.filename: '/uploads/'+ f.filename,
        staticPath: options?.to ? '/static/'+options.to+"/"+ f.filename: '/static/'+ f.filename
      };
    } catch (err) {
      if (
        err instanceof SystemUseError ||
        err instanceof InternalErrorException
      ) {
        throw err;
      }
      console.error("File save error:", err);
      throw new SystemUseError("Failed to upload file");
    }
  }

  /**
   * Save multiple files
   */
  async saveAll(files: MultipartFile[], options?: SaveOptions): Promise<any[]> {
    if (!files || files.length === 0) {
      return [];
    }

    const opts: SaveOptions = {
      overwrite: options?.overwrite ?? true,
      to: options?.to,
    };

    const uploadDir = opts.to ? path.join(this.baseDir, opts.to) : this.baseDir;
    await this.ensureDirectoryExists(uploadDir);

    const results: any[] = [];

    for (const f of files) {
      try {
        this.validateFilename(f.filename);
        const fullPath = path.join(uploadDir, f.filename);
        if (!fullPath.startsWith(this.baseDir)) {
          throw new SystemUseError(`Invalid file path for ${f.filename}`);
        }


        if (!opts.overwrite && this.isFileExists(fullPath)) {
          throw new SystemUseError(`File ${f.filename} already exists`);
        }


        if (f.file) {
          if (this.transformOptions && this.isImageFile(f.filename)) {
            await this.processImage(f.file, fullPath);
          } else {
            await pipeline(f.file, fs.createWriteStream(fullPath));
          }
        } else {
          const fp = f as SavedMultipartFile;
          if (!fp.filepath) {
            throw new SystemUseError(`No filepath for ${f.filename}`);
          }

          if (this.transformOptions && this.isImageFile(f.filename)) {
            await this.processImage(fs.createReadStream(fp.filepath), fullPath);
          } else {
            await pipeline(
              fs.createReadStream(fp.filepath),
              fs.createWriteStream(fullPath),
            );
          }

          this.removeFileSync(fp.filepath);
        }

        results.push({ 
        uploadPath:  options?.to ?'/uploads/'+ options.to+"/"+f.filename: '/uploads/'+f.filename,
        staticPath: options?.to ? '/static/'+options.to+"/"+f.filename: '/static/'+f.filename
      });
      } catch (error) {
        console.error(`Failed to save file ${f.filename}:`, error);
        throw new SystemUseError(`Failed to upload file ${f.filename}`);
      }
    }

    return results;
  }

  /**
   * Remove a file from storage
   */
  async remove(filepath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filepath);

    // Security check
    if (!fullPath.startsWith(this.baseDir)) {
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

  /**
   * Process image with transformations using sharp
   */
  private async processImage(
    fileStream: NodeJS.ReadableStream,
    outputPath: string,
  ): Promise<void> {
    try {
      const sharp = await import("sharp");
      let sharpPipeline = sharp.default();

      if (this.transformOptions?.resize) {
        sharpPipeline = sharpPipeline.resize(
          this.transformOptions.resize.width,
          this.transformOptions.resize.height,
          { fit: "inside", withoutEnlargement: true },
        );
      }

      if (this.transformOptions?.format) {
        const quality = this.transformOptions.quality || 80;
        switch (this.transformOptions.format) {
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

      await pipeline(
        fileStream,
        sharpPipeline,
        fs.createWriteStream(outputPath),
      );
    } catch (error: any) {
      if (
        error.code === "MODULE_NOT_FOUND" &&
        error.message.includes("sharp")
      ) {
        throw new InternalErrorException(
          "sharp module not found. Please install sharp to use image transformations.",
        );
      }
      console.error("Image processing failed:", error);
      throw new InternalErrorException("Image processing failed");
    } finally {
      this.transformOptions = null;
    }
  }

  /**
   * Helper methods
   */
  private isFileExists(fpath: string): boolean {
    return fs.existsSync(fpath);
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
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
    const ext = path.extname(filename).toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp"].includes(
      ext,
    );
  }

  private validateFilename(filename: string): void {
    if (!filename || filename.trim() === "") {
      throw new SystemUseError("Invalid filename");
    }

    // Check for path traversal attempts
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      throw new SystemUseError("Invalid filename: path traversal detected");
    }

    // Check for null bytes
    if (filename.includes("\0")) {
      throw new SystemUseError("Invalid filename: null byte detected");
    }
  }
}
