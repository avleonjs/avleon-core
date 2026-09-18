export function optionalRequire<T = any>(
  moduleName: string,
  options: {
    failOnMissing?: boolean;
    customMessage?: string;
  } = {},
): T | undefined {
  try {
    return require(moduleName);
  } catch (err: any) {
    if (err.code === "MODULE_NOT_FOUND" && err.message.includes(moduleName)) {
      if (options.failOnMissing) {
        throw new Error(
          options.customMessage ||
            `Optional dependency "${moduleName}" is not installed.\nInstall it with:\n\n  npm install ${moduleName}`,
        );
      }
      return undefined;
    }
    throw err;
  }
}

export async function optionalImport<T = any>(
  moduleName: string,
  options: {
    failOnMissing?: boolean;
    customMessage?: string;
  } = {},
): Promise<T | undefined> {
  try {
    const mod = await import(moduleName);
    return mod as T;
  } catch (err: any) {
    if (
      (err.code === "ERR_MODULE_NOT_FOUND" ||
        err.code === "MODULE_NOT_FOUND") &&
      err.message.includes(moduleName)
    ) {
      if (options.failOnMissing) {
        throw new Error(
          options.customMessage ||
            `Optional dependency "${moduleName}" is not installed.\nInstall it with:\n\n  npm install ${moduleName}`,
        );
      }
      return undefined;
    }
    throw err;
  }
}
