import bcrypt from 'bcryptjs';
export const hashPasswordSync = (password: string) => bcrypt.hashSync(password,12);
export const matchPasswordSync = (password: string, hash: string) => bcrypt.compareSync(password, hash);
export const hashPassword = (password: string) => bcrypt.hash(password,12);
export const matchPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
