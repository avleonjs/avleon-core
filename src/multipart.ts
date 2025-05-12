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
} from '@fastify/multipart';
import { IRequest } from './icore';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { InternalErrorException } from './exceptions';
import { REQUEST_BODY_FILE_KEY, REQUEST_BODY_FILES_KEY } from './container';

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
      fieldName: fieldName ? fieldName : 'all',
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
  saveAs?: string;
  dest?: true;
};

export type MultipartFile = FsM | SavedMultipartFile;
export function UploadFileFromRequest(req: IRequest, options?: Foptions) {
  return Promise.resolve(
    req.file().then(async (f) => {
      if (f && f.file) {
        let fname = f.filename;
        if (options) {
          if (options.dest) {
            fname = options.saveAs
              ? options.dest + '/' + options.saveAs
              : options.dest + '/' + f.filename;
          } else {
            fname = path.join(
              process.cwd(),
              `public/${options.saveAs ? options.saveAs : f.filename}`,
            );
          }
        } else {
          fname = path.join(process.cwd(), `public/${f.filename}`);
        }

        if (fs.existsSync(fname)) {
          throw new InternalErrorException('File already exists.');
        }

        await pipeline(f.file!, fs.createWriteStream(fname));

        return {
          ...f,
          filename: options?.saveAs ? options.saveAs : f.filename,
        } as MultipartFile;
      }
    }),
  );
}
