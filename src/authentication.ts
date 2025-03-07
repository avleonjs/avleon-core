export type CurrentUser = {};

export abstract class BaseAuthetication {
  abstract  authenticate(): Promise<Boolean>;
  abstract  authorize(): Promise<Boolean>;

}

export function Authorized() {
  
}
export function CurrentUser() {}
