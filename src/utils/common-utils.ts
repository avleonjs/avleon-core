/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import fs from "fs";
import crypto from "crypto";

export const uuid = crypto.randomUUID();

export type Constructor<T = any> = new (...args: any[]) => T;

export function isConstructor(func: any): boolean {
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
        const instance = new (func as any)();
        return typeof instance === "object";
    } catch (e) {
        return false;
    }
}

export function formatUrl(path: string): string {
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

export function parsedPath(ipath: string): string {
    return !ipath.startsWith("/") ? "/" + ipath : ipath;
}

export interface MatchLocation {
    line: number;
    column: number;
}
export const getLineNumber = (
    filePath: string,
    rpath: string | RegExp,
): MatchLocation[] | null => {
    let numbers = [];
    try {
        const fileContent = fs.readFileSync(filePath, "utf8");
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
    } catch (error) {
        return numbers;
    }
};

export function normalizePath(base: string = "/", subPath: string = "/") {
    return `/${base}/${subPath}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

export function extrctParamFromUrl(url: string) {
    const splitPart = url
        .split("/")
        .filter((x) => x.startsWith(":") || x.startsWith("?:"));
    return splitPart.map((f) => ({
        key: f.replace(/(\?|:)/g, ""),
        required: !f.startsWith("?:"),
    }));
}

export function findDuplicates(arr: string[]): string[] {
    const seen = new Set();
    const duplicates = new Set();

    for (const str of arr) {
        if (seen.has(str)) {
            duplicates.add(str);
        } else {
            seen.add(str);
        }
    }

    return Array.from(duplicates) as string[];
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
