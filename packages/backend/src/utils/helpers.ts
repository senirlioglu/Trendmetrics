import { randomUUID, createHash } from "node:crypto";

/**
 * Generate a random UUID v4 string.
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Produce a deterministic SHA-256 hex hash from a flat key-value map.
 * Keys are sorted alphabetically so parameter order is irrelevant.
 */
export function hashParams(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ""}`)
    .join("&");
  return createHash("sha256").update(sorted).digest("hex");
}

/**
 * Strip the most common XSS vectors from a string.
 * This is a lightweight sanitiser -- for rich HTML use a library like DOMPurify.
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Truncate a string to `len` characters, appending an ellipsis when trimmed.
 */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "...";
}

/**
 * Promise-based sleep.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential back-off.
 *
 * @param fn          The async operation to attempt.
 * @param maxRetries  Maximum number of retries (default 3).
 * @param baseDelayMs Initial delay in ms; doubled after each attempt (default 500).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
