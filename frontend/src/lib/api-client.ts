import { getAccessToken, getApiBaseUrl, clearAccessToken, refreshAccessToken, redirectToLogin } from "./auth";
import { ApiError } from "./api-error";

export { ApiError } from "./api-error";

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
      throw new ApiError({
        status: 401,
        statusCode: 401,
        message: "Authentication required",
      });
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
    
    let errorData: Record<string, unknown> | null = null;
    let errorMessage = "An error occurred while fetching data.";
    try {
      errorData = (await response.json()) as Record<string, unknown>;
      if (Array.isArray(errorData?.message)) {
        errorMessage = errorData.message.join(", ");
      } else if (typeof errorData?.message === "string") {
        errorMessage = errorData.message;
      }
    } catch {
      try {
        errorMessage = (await response.text()) || errorMessage;
      } catch {
        // Keep default message
      }
    }
    
    throw new ApiError({
      status: response.status,
      statusCode: response.status,
      code: typeof errorData?.code === "string" ? errorData.code : null,
      message: errorMessage,
      suggestion:
        typeof errorData?.suggestion === "string"
          ? errorData.suggestion
          : undefined,
      currentCampaignManager: (() => {
        const ccm = errorData?.currentCampaignManager;
        if (!ccm || typeof ccm !== "object") return null;
        const manager = ccm as Record<string, unknown>;
        return {
          membershipId:
            typeof manager.membershipId === "string"
              ? manager.membershipId
              : null,
          name:
            typeof manager.name === "string"
              ? manager.name
              : "the campaign manager",
        };
      })(),
      raw: errorData,
    });
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return null as unknown as T;
  }

  return response.json();
}
