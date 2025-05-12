import fs, { createReadStream, PathLike } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import {
  BadRequestException,
  InternalErrorException,
} from './exceptions/http-exceptions';
import { MultipartFile } from './multipart';
import { AppService } from './decorators';
import os from 'os';
import { SystemUseError } from './exceptions/system-exception';
import { SavedMultipartFile } from '@fastify/multipart';

interface TransformOptions {
  resize?: { width: number; height: number };
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
  // Add other sharp options as needed
}

/* 
//temp file
  files[0].type // "file"
  files[0].filepath
  files[0].fieldname
  files[0].filename
  files[0].encoding
  files[0].mimetype
  files[0].fields 

*/

/* 
// stream file
  data.file // stream
  data.fields // other parsed parts
  data.fieldname
  data.filename
  data.encoding
  data.mimetype
*/

export interface FileStorageInterface {
  transform(options: TransformOptions): FileStorage;
  save(
    file: MultipartFile,
    options?: SaveOptionsSingle,
  ): Promise<MultipartFile | undefined>;
  saveAll(
    files: MultipartFile[],
    options?: SaveOptions,
  ): Promise<MultipartFile[] | undefined>;

  remove(filepath: PathLike): Promise<void>;
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

  transform(options: TransformOptions) {
    this.transformOptions = options;
    return this;
  }

  private isFileExists(fpath: PathLike) {
    return fs.existsSync(fpath);
  }

  async save(f: MultipartFile, options?: SaveOptionsSingle) {
    let foptions: SaveOptionsSingle = {
      overwrite: options && options.overwrite ? options.overwrite : true,
    };
    try {
      if (f.type == 'file') {
        const fname = path.join(process.cwd(), `public/${f.filename}`);

        if (!foptions.overwrite && this.isFileExists(fname)) {
          throw new SystemUseError('File already exits.');
        }

        await pipeline(f.file, fs.createWriteStream(fname));
        return f;
      }
    } catch (err) {
      throw new SystemUseError("Can't upload file");
    }
  }

  async remove(filepath: PathLike) {
    if (!this.isFileExists(path.join(process.cwd(), 'public/' + filepath))) {
      throw new SystemUseError("File doesn't exists.");
    }
    return fs.unlinkSync(path.join(process.cwd(), 'public/' + filepath));
  }

  async saveAll(files: MultipartFile[], options?: SaveOptions) {
    try {
      let foptions: SaveOptions = {
        overwrite: options && options.overwrite ? options.overwrite : true,
      };
      for (let f of files) {
        let uploadPath = 'public';
        if (options?.to) {
          uploadPath = `public/${options.to}`;
        }
        const fname = path.join(process.cwd(), `${uploadPath}/${f.filename}`);
        await this.ensureDirectoryExists(fname);
        if (f.file) {
          await pipeline(f.file, fs.createWriteStream(fname));
        } else {
          const fp = f as SavedMultipartFile;
          await pipeline(
            fs.createReadStream(fp.filepath),
            fs.createWriteStream(fname),
          );
          fs.unlinkSync(fp.filepath);
        }
      }
      return files;
    } catch (error) {
      console.error(error);
      throw new SystemUseError("Can't upload file");
    }
  }

  private async processImage(
    fileStream: NodeJS.ReadableStream,
    outputPath: string,
  ) {
    try {
      const sharp = await import('sharp'); // Lazy import sharp

      let sharpPipeline = sharp.default();

      if (this.transformOptions?.resize) {
        sharpPipeline = sharpPipeline.resize(
          this.transformOptions.resize.width,
          this.transformOptions.resize.height,
        );
      }

      if (this.transformOptions?.format) {
        switch (this.transformOptions.format) {
          case 'jpeg':
            sharpPipeline = sharpPipeline.jpeg({
              quality: this.transformOptions.quality || 80,
            });
            break;
          case 'png':
            sharpPipeline = sharpPipeline.png({
              quality: this.transformOptions.quality || 80,
            });
            break;
          case 'webp':
            sharpPipeline = sharpPipeline.webp({
              quality: this.transformOptions.quality || 80,
            });
            break;
          case 'avif':
            sharpPipeline = sharpPipeline.avif({
              quality: this.transformOptions.quality || 80,
            });
            break;
          default:
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
        error.code === 'MODULE_NOT_FOUND' &&
        error.message.includes('sharp')
      ) {
        throw new InternalErrorException(
          'sharp module not found. Please install sharp to use image transformations.',
        );
      }
      console.error('Image processing failed:', error);
      throw new InternalErrorException('Image processing failed.');
    } finally {
      this.transformOptions = null; // Reset transform options after processing
    }
  }

  private async ensureDirectoryExists(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
