"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadFile = UploadFile;
exports.UploadFiles = UploadFiles;
exports.UploadFileFromRequest = UploadFileFromRequest;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
const exceptions_1 = require("./exceptions");
const container_1 = require("./container");
function UploadFile(fieldName) {
    return function (target, propertyKey, parameterIndex) {
        if (!Reflect.hasMetadata(container_1.REQUEST_BODY_FILE_KEY, target, propertyKey)) {
            Reflect.defineMetadata(container_1.REQUEST_BODY_FILE_KEY, [], target, propertyKey);
        }
        const existingMetadata = Reflect.getMetadata(container_1.REQUEST_BODY_FILE_KEY, target, propertyKey);
        existingMetadata.push({ fieldName, index: parameterIndex });
        Reflect.defineMetadata(container_1.REQUEST_BODY_FILE_KEY, existingMetadata, target, propertyKey);
    };
}
function UploadFiles(fieldName) {
    return function (target, propertyKey, parameterIndex) {
        if (!Reflect.hasMetadata(container_1.REQUEST_BODY_FILES_KEY, target, propertyKey)) {
            Reflect.defineMetadata(container_1.REQUEST_BODY_FILES_KEY, [], target, propertyKey);
        }
        const existingMetadata = Reflect.getMetadata(container_1.REQUEST_BODY_FILES_KEY, target, propertyKey);
        existingMetadata.push({
            fieldName: fieldName ? fieldName : "all",
            index: parameterIndex,
        });
        Reflect.defineMetadata(container_1.REQUEST_BODY_FILES_KEY, existingMetadata, target, propertyKey);
    };
}
function UploadFileFromRequest(req, options) {
    return Promise.resolve(req.file().then(async (f) => {
        if (f && f.file) {
            let fname = f.filename;
            if (options) {
                if (options.dest) {
                    fname = options.saveAs
                        ? options.dest + "/" + options.saveAs
                        : options.dest + "/" + f.filename;
                }
                else {
                    fname = path_1.default.join(process.cwd(), `public/${options.saveAs ? options.saveAs : f.filename}`);
                }
            }
            else {
                fname = path_1.default.join(process.cwd(), `public/${f.filename}`);
            }
            if (fs_1.default.existsSync(fname)) {
                throw new exceptions_1.InternalErrorException("File already exists.");
            }
            await (0, promises_1.pipeline)(f.file, fs_1.default.createWriteStream(fname));
            return {
                ...f,
                filename: options?.saveAs ? options.saveAs : f.filename,
            };
        }
    }));
}
