/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
export type Constructor<T = any> = new (...args: any[]) => T;

export type PackageLoader = {
  <T = any>(name: string): T;
};

export const loadPackageFromClient: PackageLoader = (name: string) => {
  try {
    // Resolve from the consumer's cwd, not from bmq's node_modules
    const resolved = require.resolve(name, { paths: [process.cwd()] });
    return require(resolved);
  } catch {
    throw new Error(
      `${name} is required but not installed. Please install it: npm i ${name} or pnpm add ${name}`,
    );
  }
};
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

export function normalizePath(base: string = "/", subPath: string = "/") {
  return `/${base}/${subPath}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
