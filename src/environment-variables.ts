import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { Service } from "typedi";
import { EnvironmentVariableNotFound, SystemUseError } from "./exceptions/system-exception";
// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

@Service()
export class Environment{
   private parseEnvFile(filePath: string): any {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedEnv = dotenv.parse(fileContent);
    return {...parsedEnv, ...process.env};
  } catch (error) {
    console.error(`Error parsing .env file: ${error}`);
    return {};
  }
}
  get<T=any>(key:string):T {
    const parsedEnv = this.parseEnvFile(path.join(process.cwd(), '.env'));

    if (!Object(parsedEnv).hasOwnProperty(key)) {
      throw new EnvironmentVariableNotFound(key)
    }
    return parsedEnv[key] as T;
  }

  getAll<T = any>(): T {
    const parsedEnv = this.parseEnvFile(path.join(process.cwd(), '.env'));
    return parsedEnv as T;
  }
}
