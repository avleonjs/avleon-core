import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { parseEnv } from "util";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Read the .env file and infer keys dynamically
const envFilePath = path.join(process.cwd(), ".env");
const envContents = fs.readFileSync(envFilePath, "utf-8");

// Parse .env file manually
const parsedEnv: Record<string, string> = Object.fromEntries(
  envContents
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#")) // Ignore empty lines and comments
    .map((line) => {
      const [key, ...valueParts] = line.split("="); // Split key and value
      return [key.trim(), valueParts.join("=").trim()]; // Handle values with `=`
    }),
);

const inferType = (value: string): string | number | boolean => {
  if (!isNaN(Number(value))) return Number(value);
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
};

export const e = parsedEnv;

// Auto-infer TypeScript type
export type Env = typeof e;

export const env = e as Env;
