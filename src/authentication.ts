export type CurrentUser = {};

export abstract class Authetication {
  abstract login(): void;
  abstract register(): void;
  abstract verifyToken(): boolean;
  abstract currentUser(): CurrentUser;
}

export function Authorized() {
  
}
export function CurrentUser() {}
