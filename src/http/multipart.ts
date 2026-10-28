/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

import {
  MultipartFile as FsM,
  MultipartValue,
  SavedMultipartFile,
} from "@fastify/multipart";
import { IRequest } from "../core/types";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import {
  BadRequestException,
  InternalErrorException,
} from "../common/exceptions";
import {
  DEFAULT_ALLOWED_UPLOAD_EXTENSIONS,
  fileExtension,
  isSafeFilename,
  randomFilename,
  resolveWithin,
} from "../common/utils/path-utils";
import {
  REQUEST_BODY_FILE_KEY,
  REQUEST_BODY_FILES_KEY,
} from "../common/container";

export function UploadFile(fieldName: string) {
  return function (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) {
    if (!Reflect.hasMetadata(REQUEST_BODY_FILE_KEY, target, propertyKey)) {
      Reflect.defineMetadata(REQUEST_BODY_FILE_KEY, [], target, propertyKey);
    }
    const existingMetadata = Reflect.getMetadata(
      REQUEST_BODY_FILE_KEY,
      target,
      propertyKey,
    ) as {
      fieldName: string;
      index: number;
    }[];
    existingMetadata.push({ fieldName, index: parameterIndex });
    Reflect.defineMetadata(
      REQUEST_BODY_FILE_KEY,
      existingMetadata,
      target,
      propertyKey,
    );
  };
}

export function UploadFiles(fieldName?: string) {
  return function (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) {
    if (!Reflect.hasMetadata(REQUEST_BODY_FILES_KEY, target, propertyKey)) {
      Reflect.defineMetadata(REQUEST_BODY_FILES_KEY, [], target, propertyKey);
    }
    const existingMetadata = Reflect.getMetadata(
      REQUEST_BODY_FILES_KEY,
      target,
      propertyKey,
    ) as {
      fieldName: string;
      index: number;
    }[];
    existingMetadata.push({
      fieldName: fieldName ? fieldName : "all",
      index: parameterIndex,
    });
    Reflect.defineMetadata(
      REQUEST_BODY_FILES_KEY,
      existingMetadata,
      target,
      propertyKey,
    );
  };
}

type Foptions = {
  /** Filename to save as. Must be a plain filename. */
  saveAs?: string;
  /** Directory to save into. Defaults to `<cwd>/public`. */
  dest?: string;
  /** Keep the client's filename instead of generating a random one. */
  preserveFilename?: boolean;
  /**
   * Allowed file extensions (with the dot). Defaults to
   * DEFAULT_ALLOWED_UPLOAD_EXTENSIONS; `null` disables the check.
   */
  allowedExtensions?: string[] | null;
};

export type MultipartFile = FsM | SavedMultipartFile;
export function UploadFileFromRequest(req: IRequest, options?: Foptions) {
  return Promise.resolve(
    (req as any).file().then(async (f: any) => {
      if (f && f.file) {
        const original = f.filename;
        const target = options?.saveAs ?? original;
        if (!isSafeFilename(original) || !isSafeFilename(target)) {
          f.file.resume?.();
          throw new BadRequestException("Invalid filename");
        }

        const allowed =
          options?.allowedExtensions !== undefined
            ? options.allowedExtensions
            : DEFAULT_ALLOWED_UPLOAD_EXTENSIONS;
        const ext = fileExtension(target);
        if (
          allowed &&
          (!ext || !allowed.map((e) => e.toLowerCase()).includes(ext))
        ) {
          f.file.resume?.();
          throw new BadRequestException(
            `File type "${ext || target}" is not allowed`,
          );
        }

        const name =
          options?.saveAs || options?.preserveFilename
            ? target
            : randomFilename(ext);
        const dir = path.resolve(
          options?.dest ?? path.join(process.cwd(), "public"),
        );
        const fname = resolveWithin(dir, name);
        if (!fname) {
          f.file.resume?.();
          throw new BadRequestException("Invalid filename");
        }

        if (fs.existsSync(fname)) {
          f.file.resume?.();
          throw new InternalErrorException("File already exists.");
        }

        await fs.promises.mkdir(dir, { recursive: true });
        // "wx" refuses to replace a file created after the check above.
        await pipeline(f.file!, fs.createWriteStream(fname, { flags: "wx" }));

        return {
          ...f,
          filename: name,
          originalFilename: original,
          filepath: fname,
        } as MultipartFile;
      }
    }),
  );
}
