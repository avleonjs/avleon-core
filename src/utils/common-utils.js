"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineNumber = exports.uuid = void 0;
exports.isConstructor = isConstructor;
exports.formatUrl = formatUrl;
exports.parsedPath = parsedPath;
exports.normalizePath = normalizePath;
exports.extrctParamFromUrl = extrctParamFromUrl;
exports.findDuplicates = findDuplicates;
exports.sleep = sleep;
/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
exports.uuid = crypto_1.default.randomUUID();
function isConstructor(func) {
    if (typeof func !== "function") {
        return false;
    }
    if (func === Function.prototype.bind || func instanceof RegExp) {
        return false;
    }
    if (func.prototype && typeof func.prototype === "object") {
        return true;
    }
    try {
        const instance = new func();
        return typeof instance === "object";
    }
    catch (e) {
        return false;
    }
}
function formatUrl(path) {
    if (typeof path !== "string") {
        throw new Error("The path must be a string");
    }
    path = path.trim();
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    path = path.replace(/\/\/+/g, "/");
    if (path.endsWith("/")) {
        path = path.slice(0, -1);
    }
    return path;
}
function parsedPath(ipath) {
    return !ipath.startsWith("/") ? "/" + ipath : ipath;
}
const getLineNumber = (filePath, rpath) => {
    let numbers = [];
    try {
        const fileContent = fs_1.default.readFileSync(filePath, "utf8");
        const lines = fileContent.split("\n");
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(rpath);
            if (match) {
                console.log(match);
                numbers.push({
                    line: i + 1,
                    column: match.index ?? 0,
                });
            }
        }
        return numbers;
    }
    catch (error) {
        return numbers;
    }
};
exports.getLineNumber = getLineNumber;
function normalizePath(base = "/", subPath = "/") {
    return `/${base}/${subPath}`.replace(/\/+/g, "/").replace(/\/$/, "");
}
function extrctParamFromUrl(url) {
    const splitPart = url
        .split("/")
        .filter((x) => x.startsWith(":") || x.startsWith("?:"));
    return splitPart.map((f) => ({
        key: f.replace(/(\?|:)/g, ""),
        required: !f.startsWith("?:"),
    }));
}
function findDuplicates(arr) {
    const seen = new Set();
    const duplicates = new Set();
    for (const str of arr) {
        if (seen.has(str)) {
            duplicates.add(str);
        }
        else {
            seen.add(str);
        }
    }
    return Array.from(duplicates);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
