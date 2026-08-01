const STORAGE_KEYS = {
  accessToken: "agos_access_token",
  accessTokenExpiresAt: "agos_access_token_expires_at",
};

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

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        clearAccessToken();
        return null;
      }

      const data = await response.json();
      persistAccessToken(data.accessToken, data.expiresIn ?? 900);
      return data.accessToken;
    } catch {
      clearAccessToken();
      return null;
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
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
