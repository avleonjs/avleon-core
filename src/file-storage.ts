import fs, { createReadStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { InternalErrorException } from './exceptions/http-exceptions';
import { MultipartFile } from './multipart';
import { AppService } from './decorators';
import os from 'os';

interface TransformOptions {
    resize?: { width: number; height: number };
    format?: 'jpeg' | 'png' | 'webp' | 'avif';
    quality?: number;
    // Add other sharp options as needed
}

@AppService
export class FileStorage {
    private transformOptions: TransformOptions | null = null;

    transform(options: TransformOptions) {
        this.transformOptions = options;
        return this;
    }

    async save(f: MultipartFile, options: any) {
        if (f && f.file) {
            let fname = f.filename;
            if (options) {
                if (options.dest) {
                    fname = options.saveAs ? options.dest + '/' + options.saveAs : options.dest + '/' + f.filename;
                } else {
                    fname = path.join(process.cwd(), `public/${options.saveAs ? options.saveAs : f.filename}`);
                }
            } else {
                fname = path.join(process.cwd(), `public/${f.filename}`);
            }
            if (fs.existsSync(fname) && !options.overwrite) {
                throw new InternalErrorException("File already exists.");
            }

            if (this.transformOptions) {
                const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}-${f.filename}`);
                await pipeline(f.file!, fs.createWriteStream(tempFilePath));
                await this.processImage(fs.createReadStream(tempFilePath), fname);
                fs.unlinkSync(tempFilePath);
            } else {
                await pipeline(f.file!, fs.createWriteStream(fname));
            }
            return { ...f, filename: options?.saveAs ? options.saveAs : f.filename } as MultipartFile;
        }
    }

    async saveAs(f: MultipartFile, filename: string, options: any) {
        if (f && f.file) {
            let fname = filename;

            if (options && options.dest) {
                fname = options.dest + '/' + filename;
            } else {
                fname = path.join(process.cwd(), `public/${filename}`);
            }

            if (fs.existsSync(fname) && !options.overwrite) {
                throw new InternalErrorException("File already exists.");
            }

            if (this.transformOptions) {
                await this.processImage(f.file, fname);
            } else {
                await pipeline(f.file!, fs.createWriteStream(fname));
            }

            return { ...f, filename: filename } as MultipartFile;
        }
    }

    private async processImage(fileStream: NodeJS.ReadableStream, outputPath: string) {
        try {
            const sharp = await import('sharp'); // Lazy import sharp

            let sharpPipeline = sharp.default();

            if (this.transformOptions?.resize) {
                sharpPipeline = sharpPipeline.resize(
                    this.transformOptions.resize.width,
                    this.transformOptions.resize.height
                );
            }

            if (this.transformOptions?.format) {
                switch (this.transformOptions.format) {
                    case 'jpeg':
                        sharpPipeline = sharpPipeline.jpeg({ quality: this.transformOptions.quality || 80 });
                        break;
                    case 'png':
                        sharpPipeline = sharpPipeline.png({ quality: this.transformOptions.quality || 80 });
                        break;
                    case 'webp':
                        sharpPipeline = sharpPipeline.webp({ quality: this.transformOptions.quality || 80 });
                        break;
                    case 'avif':
                        sharpPipeline = sharpPipeline.avif({ quality: this.transformOptions.quality || 80 });
                        break;
                    default:
                        break;
                }
            }

            await pipeline(fileStream, sharpPipeline, fs.createWriteStream(outputPath));
        } catch (error: any) {
            if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('sharp')) {
                throw new InternalErrorException('sharp module not found. Please install sharp to use image transformations.');
            }
            console.error('Image processing failed:', error);
            throw new InternalErrorException('Image processing failed.');
        } finally {
            this.transformOptions = null; // Reset transform options after processing
        }
    }
}