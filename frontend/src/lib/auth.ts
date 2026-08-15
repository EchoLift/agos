const STORAGE_KEYS = {
  accessToken: "agencie_access_token",
  accessTokenExpiresAt: "agencie_access_token_expires_at",
};

const REFRESH_TIMEOUT_MS = 15_000;
const REFRESH_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

export class AuthTemporarilyUnavailableError extends Error {
  status?: number;

  constructor(
    message = "Authentication is temporarily unavailable.",
    status?: number,
  ) {
    super(message);
    this.name = "AuthTemporarilyUnavailableError";
    this.status = status;
  }
}

export function isAuthTemporarilyUnavailableError(
  error: unknown,
): error is AuthTemporarilyUnavailableError {
  return error instanceof AuthTemporarilyUnavailableError;
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
}

export function persistAccessToken(accessToken: string, expiresIn: number) {
  if (typeof window === "undefined") return;

  const expiresAt = Date.now() + expiresIn * 1000;
  window.localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  window.localStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, String(expiresAt));
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;

  const token = window.localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAt = Number(window.localStorage.getItem(STORAGE_KEYS.accessTokenExpiresAt) ?? "0");

  if (!token || (expiresAt && Date.now() > expiresAt)) {
    return null;
  }

  return token;
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(STORAGE_KEYS.accessToken);
  window.localStorage.removeItem(STORAGE_KEYS.accessTokenExpiresAt);
}

export async function exchangeGoogleToken(idToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token: idToken }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Unable to sign in with Google.");
  }

  const data = await response.json();
  persistAccessToken(data.accessToken, data.expiresIn ?? 900);

  return data;
}

export function getAuthHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let refreshPromise: Promise<string | null> | null = null;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRefreshToken(): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  try {
    return await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      for (let attempt = 0; attempt <= REFRESH_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const response = await fetchRefreshToken();

          if (response.status === 401) {
            clearAccessToken();
            return null;
          }

          if (!response.ok) {
            throw new AuthTemporarilyUnavailableError(
              "Authentication service is temporarily unavailable.",
              response.status,
            );
          }

          const data = await response.json();
          persistAccessToken(data.accessToken, data.expiresIn ?? 900);
          return data.accessToken;
        } catch (error) {
          if (!isAuthTemporarilyUnavailableError(error)) {
            throw new AuthTemporarilyUnavailableError(
              "Authentication service is temporarily unavailable.",
            );
          }

          const retryDelay = REFRESH_RETRY_DELAYS_MS[attempt];
          if (retryDelay === undefined) {
            throw error;
          }

          await delay(retryDelay);
        }
      }

      throw new AuthTemporarilyUnavailableError();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function logout() {
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore logout network errors.
  }
  clearAccessToken();
  redirectToCentralLogin();
}

export function redirectToCentralLogin() {
  if (typeof window === "undefined") return;

  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname.endsWith(".localhost");

  window.location.href = isLocal
    ? "/login"
    : `${APP_URL}/login`;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function getCentralLoginUrl(returnTo?: string) {
  if (typeof window === "undefined") {
    return `${APP_URL}/login`;
  }

  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname.endsWith(".localhost");

  if (isLocal) {
    return "/login";
  }

  const loginUrl = new URL("/login", APP_URL);

  if (returnTo) {
    loginUrl.searchParams.set("returnTo", returnTo);
  }

  return loginUrl.toString();
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;

  const returnTo =
    `${window.location.origin}${window.location.pathname}` +
    `${window.location.search}${window.location.hash}`;

  window.location.href = getCentralLoginUrl(returnTo);
}
