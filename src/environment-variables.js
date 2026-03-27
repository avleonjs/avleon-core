"use strict";
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importStar(require("fs"));
const typedi_1 = require("typedi");
const system_exception_1 = require("./exceptions/system-exception");
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), ".env"), quiet: true });
/**
 * @class Environment
 * @description A service class to manage access to environment variables.
 * It loads variables from `.env` file and merges them with `process.env`,
 * giving precedence to `process.env` values.
 */
let Environment = class Environment {
    /**
   * Parses the given `.env` file and merges it with `process.env`.
   * Values from `process.env` take precedence.
   *
   * @private
   * @param filePath - Absolute path to the `.env` file.
   * @returns A dictionary of merged environment variables.
   */
    parseEnvFile(filePath) {
        try {
            const isExis = (0, fs_1.existsSync)(filePath);
            if (!isExis) {
                return { ...process.env };
            }
            const fileContent = fs_1.default.readFileSync(filePath, "utf8");
            const parsedEnv = dotenv_1.default.parse(fileContent);
            return { ...parsedEnv, ...process.env };
        }
        catch (error) {
            console.error(`Error parsing .env file: ${error}`);
            return {};
        }
    }
    /**
   * Retrieves the value of the specified environment variable.
   *
   * @template T
   * @param key - The name of the environment variable.
   * @returns The value of the variable, or `undefined` if not found.
   */
    get(key) {
        const parsedEnv = this.parseEnvFile(path_1.default.join(process.cwd(), ".env"));
        return parsedEnv[key];
    }
    /**
   * Retrieves the value of the specified environment variable.
   * Throws an error if the variable is not found.
   *
   * @template T
   * @param key - The name of the environment variable.
   * @throws {EnvironmentVariableNotFound} If the variable does not exist.
   * @returns The value of the variable.
   */
    getOrThrow(key) {
        const parsedEnv = this.parseEnvFile(path_1.default.join(process.cwd(), ".env"));
        if (!Object(parsedEnv).hasOwnProperty(key)) {
            throw new system_exception_1.EnvironmentVariableNotFound(key);
        }
        return parsedEnv[key];
    }
    /**
   * Retrieves all available environment variables,
   * with `process.env` values taking precedence over `.env` values.
   *
   * @template T
   * @returns An object containing all environment variables.
   */
    getAll() {
        const parsedEnv = this.parseEnvFile(path_1.default.join(process.cwd(), ".env"));
        return parsedEnv;
    }
};
exports.Environment = Environment;
exports.Environment = Environment = __decorate([
    (0, typedi_1.Service)()
], Environment);
