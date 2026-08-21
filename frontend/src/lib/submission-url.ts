// src/lib/submission-url.ts

export function isValidSubmissionUrl(value: string): boolean {
  const trimmed = value.trim();

  // URL may be optional when notes/body are allowed.
  if (!trimmed) return true;

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Local development exception
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    // Reject things like https://dsdsds
    if (!hostname.includes(".")) {
      return false;
    }

    // Reject malformed edge cases
    if (
      hostname.startsWith(".") ||
      hostname.endsWith(".") ||
      hostname.includes("..")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}