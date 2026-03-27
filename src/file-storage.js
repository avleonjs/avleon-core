"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorage = void 0;
const fs_1 = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
const decorators_1 = require("./decorators");
const system_exception_1 = require("./exceptions/system-exception");
const http_exceptions_1 = require("./exceptions/http-exceptions");
let FileStorage = class FileStorage {
    transformOptions = null;
    baseDir;
    maxFileSize = 50 * 1024 * 1024; // 50MB default
    constructor() {
        this.baseDir = path_1.default.join(process.cwd(), "public");
        this.ensureDirectoryExists(this.baseDir);
    }
    /**
     * Set transformation options for the next save operation
     */
    transform(options) {
        this.transformOptions = options;
        return this;
    }
    async getUploadFile(fliePath) {
        const f = await fs_1.default.promises.readFile(path_1.default.join(this.baseDir, fliePath));
        return f;
    }
    async download(filepath) {
        const filename = filepath
            .toString()
            .split(/[\/\\]/)
            .pop() || "file";
        const s = (0, fs_1.createReadStream)(filepath);
        return {
            download: true,
            stream: s,
            filename,
        };
    }
    async downloadAs(filepath, filename) {
        const s = (0, fs_1.createReadStream)(filepath);
        return {
            download: true,
            stream: s,
            filename,
        };
    }
    /**
     * Save a single file with optional transformations
     */
    async save(f, options) {
        const opts = {
            overwrite: options?.overwrite ?? true,
            to: options?.to,
            saveAs: options?.saveAs,
        };
        if (f.type !== "file") {
            throw new system_exception_1.SystemUseError("Invalid file type");
        }
        try {
            const filename = opts.saveAs || f.filename;
            this.validateFilename(filename);
            const uploadDir = opts.to
                ? path_1.default.join(this.baseDir, opts.to)
                : this.baseDir;
            const fullPath = path_1.default.join(uploadDir, filename);
            if (!fullPath.startsWith(this.baseDir)) {
                throw new system_exception_1.SystemUseError("Invalid file path");
            }
            // Check if file exists
            if (!opts.overwrite && this.isFileExists(fullPath)) {
                throw new system_exception_1.SystemUseError("File already exists");
            }
            await this.ensureDirectoryExists(uploadDir);
            let sourceStream;
            const savedFile = f;
            if (savedFile.filepath && !f.file) {
                sourceStream = fs_1.default.createReadStream(savedFile.filepath);
            }
            else if (f.file) {
                sourceStream = f.file;
            }
            else {
                throw new system_exception_1.SystemUseError("No file stream or filepath available");
            }
            if (this.transformOptions && this.isImageFile(filename)) {
                await this.processImage(sourceStream, fullPath);
            }
            else {
                await (0, promises_1.pipeline)(sourceStream, fs_1.default.createWriteStream(fullPath));
            }
            if (savedFile.filepath && fs_1.default.existsSync(savedFile.filepath)) {
                this.removeFileSync(savedFile.filepath);
            }
            if (opts.saveAs) {
                f.filename = opts.saveAs;
            }
            return {
                uploadPath: options?.to ? '/uploads/' + options.to + "/" + f.filename : '/uploads/' + f.filename,
                staticPath: options?.to ? '/static/' + options.to + "/" + f.filename : '/static/' + f.filename
            };
        }
        catch (err) {
            if (err instanceof system_exception_1.SystemUseError ||
                err instanceof http_exceptions_1.InternalErrorException) {
                throw err;
            }
            console.error("File save error:", err);
            throw new system_exception_1.SystemUseError("Failed to upload file");
        }
    }
    /**
     * Save multiple files
     */
    async saveAll(files, options) {
        if (!files || files.length === 0) {
            return [];
        }
        const opts = {
            overwrite: options?.overwrite ?? true,
            to: options?.to,
        };
        const uploadDir = opts.to ? path_1.default.join(this.baseDir, opts.to) : this.baseDir;
        await this.ensureDirectoryExists(uploadDir);
        const results = [];
        for (const f of files) {
            try {
                this.validateFilename(f.filename);
                const fullPath = path_1.default.join(uploadDir, f.filename);
                if (!fullPath.startsWith(this.baseDir)) {
                    throw new system_exception_1.SystemUseError(`Invalid file path for ${f.filename}`);
                }
                if (!opts.overwrite && this.isFileExists(fullPath)) {
                    throw new system_exception_1.SystemUseError(`File ${f.filename} already exists`);
                }
                if (f.file) {
                    if (this.transformOptions && this.isImageFile(f.filename)) {
                        await this.processImage(f.file, fullPath);
                    }
                    else {
                        await (0, promises_1.pipeline)(f.file, fs_1.default.createWriteStream(fullPath));
                    }
                }
                else {
                    const fp = f;
                    if (!fp.filepath) {
                        throw new system_exception_1.SystemUseError(`No filepath for ${f.filename}`);
                    }
                    if (this.transformOptions && this.isImageFile(f.filename)) {
                        await this.processImage(fs_1.default.createReadStream(fp.filepath), fullPath);
                    }
                    else {
                        await (0, promises_1.pipeline)(fs_1.default.createReadStream(fp.filepath), fs_1.default.createWriteStream(fullPath));
                    }
                    this.removeFileSync(fp.filepath);
                }
                results.push({
                    uploadPath: options?.to ? '/uploads/' + options.to + "/" + f.filename : '/uploads/' + f.filename,
                    staticPath: options?.to ? '/static/' + options.to + "/" + f.filename : '/static/' + f.filename
                });
            }
            catch (error) {
                console.error(`Failed to save file ${f.filename}:`, error);
                throw new system_exception_1.SystemUseError(`Failed to upload file ${f.filename}`);
            }
        }
        return results;
    }
    /**
     * Remove a file from storage
     */
    async remove(filepath) {
        const fullPath = path_1.default.join(this.baseDir, filepath);
        // Security check
        if (!fullPath.startsWith(this.baseDir)) {
            throw new system_exception_1.SystemUseError("Invalid file path");
        }
        if (!this.isFileExists(fullPath)) {
            throw new system_exception_1.SystemUseError("File doesn't exist");
        }
        try {
            fs_1.default.unlinkSync(fullPath);
        }
        catch (error) {
            console.error("File removal error:", error);
            throw new system_exception_1.SystemUseError("Failed to remove file");
        }
    }
    /**
     * Process image with transformations using sharp
     */
    async processImage(fileStream, outputPath) {
        try {
            const sharp = await Promise.resolve().then(() => __importStar(require("sharp")));
            let sharpPipeline = sharp.default();
            if (this.transformOptions?.resize) {
                sharpPipeline = sharpPipeline.resize(this.transformOptions.resize.width, this.transformOptions.resize.height, { fit: "inside", withoutEnlargement: true });
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
            await (0, promises_1.pipeline)(fileStream, sharpPipeline, fs_1.default.createWriteStream(outputPath));
        }
        catch (error) {
            if (error.code === "MODULE_NOT_FOUND" &&
                error.message.includes("sharp")) {
                throw new http_exceptions_1.InternalErrorException("sharp module not found. Please install sharp to use image transformations.");
            }
            console.error("Image processing failed:", error);
            throw new http_exceptions_1.InternalErrorException("Image processing failed");
        }
        finally {
            this.transformOptions = null;
        }
    }
    /**
     * Helper methods
     */
    isFileExists(fpath) {
        return fs_1.default.existsSync(fpath);
    }
    async ensureDirectoryExists(dirPath) {
        if (!fs_1.default.existsSync(dirPath)) {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
    }
    removeFileSync(filepath) {
        try {
            if (fs_1.default.existsSync(filepath)) {
                fs_1.default.unlinkSync(filepath);
            }
        }
        catch (error) {
            console.error("Failed to remove temp file:", error);
        }
    }
    isImageFile(filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
        return [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp"].includes(ext);
    }
    validateFilename(filename) {
        if (!filename || filename.trim() === "") {
            throw new system_exception_1.SystemUseError("Invalid filename");
        }
        // Check for path traversal attempts
        if (filename.includes("..") ||
            filename.includes("/") ||
            filename.includes("\\")) {
            throw new system_exception_1.SystemUseError("Invalid filename: path traversal detected");
        }
        // Check for null bytes
        if (filename.includes("\0")) {
            throw new system_exception_1.SystemUseError("Invalid filename: null byte detected");
        }
    }
};
exports.FileStorage = FileStorage;
exports.FileStorage = FileStorage = __decorate([
    decorators_1.AppService,
    __metadata("design:paramtypes", [])
], FileStorage);
