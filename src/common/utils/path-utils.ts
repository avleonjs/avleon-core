/**
 * @copyright 2024
 * @author Tareq Hossain
 * @email xtrinsic96@gmail.com
 * @url https://github.com/xtareq
 */
import path from "path";
import { randomUUID } from "crypto";

/**
 * Extensions accepted for uploads when no allowlist is configured. Anything a
 * browser would execute when served from a static directory (html, svg, js,
 * xml, ...) is deliberately absent.
 */
export const DEFAULT_ALLOWED_UPLOAD_EXTENSIONS: readonly string[] = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".pdf",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".zip",
  ".mp3",
  ".wav",
  ".mp4",
  ".webm",
  ".mov",
];

/**
 * Resolve `target` against `baseDir` and return the absolute path, or `null`
 * when the result escapes `baseDir`. Unlike a plain `startsWith(baseDir)`
 * check, a sibling such as `<baseDir>-evil` is rejected.
 */
export function resolveWithin(
  baseDir: string,
  target: string,
  allowBase = false,
): string | null {
  if (typeof target !== "string" || target.includes("\0")) return null;
  const base = path.resolve(baseDir);
  const full = path.resolve(base, target);
  const rel = path.relative(base, full);
  if (rel === "") return allowBase ? full : null;
  if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
    return null;
  }
  return full;
}

/**
 * True when `filename` is a single, plain path segment: non-empty, no
 * separators, no `..`, no null bytes.
 */
export function isSafeFilename(filename: unknown): filename is string {
  return (
    typeof filename === "string" &&
    filename.trim() !== "" &&
    filename !== "." &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes("\0")
  );
}

/** Lower-cased extension of `filename`, including the dot (`""` if none). */
export function fileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/** A random filename that keeps `ext` (e.g. `".png"`). */
export function randomFilename(ext: string): string {
  return randomUUID() + ext;
}

/**
 * Build a `Content-Disposition: attachment` value that cannot inject headers:
 * the plain `filename` keeps only safe ASCII, and the real name is carried in
 * the RFC 5987 `filename*` parameter.
 */
export function contentDisposition(filename: string): string {
  const name =
    String(filename ?? "")
      .split(/[\/\\]/)
      .pop() || "file";
  const ascii =
    name
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\;]/g, "_")
      .trim() || "file";
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
