/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */

export type CurrentUser = {};

export abstract class BaseAuthetication {
  abstract  authenticate(): Promise<Boolean>;
  abstract  authorize(): Promise<Boolean>;

}

export function Authorized() {
  
}
export function CurrentUser() {}
