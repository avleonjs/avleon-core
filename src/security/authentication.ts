/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import { IRequest } from "../core/types";

/**
 * Base class for an authentication handler.
 *
 * Register one with `app.useAuthentication(MyAuth)`. It runs once per request,
 * before any authorization handler, and whatever `authenticate` returns becomes
 * `request.user` — the value `@AuthUser()` injects into controller methods.
 *
 * Returning `null` or `undefined` leaves `request.user` unset. Authentication
 * only establishes *who* the caller is; rejecting anonymous callers is the job
 * of an authorization handler or the route itself.
 *
 * @example
 * ```ts
 * @Service()
 * class JwtAuthentication extends AvleonAuthentication<User> {
 *   async authenticate(request: IRequest) {
 *     const header = request.headers.authorization;
 *     if (!header?.startsWith("Bearer ")) return null;
 *     return verifyToken(header.slice(7));
 *   }
 * }
 *
 * app.useAuthentication(JwtAuthentication);
 * ```
 */
export abstract class AvleonAuthentication<TUser = any> {
  /**
   * Resolve the current user from the request.
   *
   * @returns the authenticated user, or `null`/`undefined` when the request
   *          carries no valid credentials.
   */
  abstract authenticate(
    request: IRequest,
  ): TUser | null | undefined | Promise<TUser | null | undefined>;
}
