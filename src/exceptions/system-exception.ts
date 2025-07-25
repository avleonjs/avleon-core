/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
export interface IRouteDuplicateErr {
  path: string;
  mpath: string;
  method: string;
  controller: string;
  inverseController?: string;
}

export class SystemUseError extends Error {
  constructor(message: string) {
    super(message);
  }
}
export class DuplicateRouteException extends Error {
  constructor(params: IRouteDuplicateErr) {
    let sameController = params.controller == params.inverseController;
    let message = `Duplicate route found for method ${params.method.toUpperCase()}:${params.path == "" ? "'/'" : params.path} `;
    message += sameController
      ? `in ${params.controller}`
      : `both in ${params.controller} and ${params.inverseController}`;
    super(message);
  }
}

export class EnvironmentVariableNotFound extends Error {
  constructor(key: string) {
    super(`${key} not found in environment variables.`);
  }
}
