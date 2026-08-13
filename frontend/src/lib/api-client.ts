import { getAccessToken, getApiBaseUrl, clearAccessToken, refreshAccessToken, redirectToLogin } from "./auth";

interface FetchOptions extends RequestInit {
  agencyId?: string;
  requireAuth?: boolean;
}

export async function apiClient<T = unknown>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { agencyId, requireAuth = true, headers, ...customConfig } = options;
  let token = getAccessToken();

  if (requireAuth && !token) {
    // Try to silently refresh the token before forcing a redirect
    token = await refreshAccessToken();
    if (!token) {
      redirectToLogin();
      throw new Error("Authentication required");
    }
  }

  const url = endpoint.startsWith("http") ? endpoint : `${getApiBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const createConfig = (currentToken: string | null): RequestInit => ({
    ...customConfig,
    headers: {
      "Content-Type": "application/json",
      ...(requireAuth && currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...(agencyId ? { "X-Agency-Id": agencyId } : {}),
      ...headers,
    },
    credentials: "include",
  });

  let response = await fetch(url, createConfig(token));

  // If 401, token might have expired exactly when the request was made. Attempt 1 retry.
  if (response.status === 401 && requireAuth) {
    token = await refreshAccessToken();
    if (token) {
      response = await fetch(url, createConfig(token));
    }
  }

  if (!response.ok) {
    if (response.status === 401 && requireAuth) {
      clearAccessToken();
      redirectToLogin();
    }
    
    let errorMessage = "An error occurred while fetching data.";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      errorMessage = (await response.text()) || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null as unknown as T;
  }

  return response.json();
}
