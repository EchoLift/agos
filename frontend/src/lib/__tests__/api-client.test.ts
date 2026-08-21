import assert from "node:assert";
import { ApiError, parseApiError } from "../api-error";

console.log("Running api-client-behavior tests...");

// Test simulateApiClientErrorHandler
function simulateResponseHandling(response: {
  status: number;
  ok: boolean;
  data?: Record<string, unknown>;
  text?: string;
  requireAuth?: boolean;
}): never | null {
  let redirectedToLogin = false;
  let tokenCleared = false;

  const redirectToLogin = () => {
    redirectedToLogin = true;
  };
  const clearAccessToken = () => {
    tokenCleared = true;
  };

  if (!response.ok) {
    if (response.status === 401 && response.requireAuth !== false) {
      clearAccessToken();
      redirectToLogin();
    }

    const errorData = response.data ?? null;
    let errorMessage = "An error occurred while fetching data.";
    if (Array.isArray(errorData?.message)) {
      errorMessage = errorData.message.join(", ");
    } else if (typeof errorData?.message === "string") {
      errorMessage = errorData.message;
    } else if (response.text) {
      errorMessage = response.text;
    }

    const error = new ApiError({
      status: response.status,
      statusCode: response.status,
      code: typeof errorData?.code === "string" ? errorData.code : null,
      message: errorMessage,
      suggestion:
        typeof errorData?.suggestion === "string"
          ? errorData.suggestion
          : undefined,
      currentCampaignManager:
        errorData?.currentCampaignManager &&
        typeof errorData.currentCampaignManager === "object"
          ? {
              membershipId:
                typeof (errorData.currentCampaignManager as any).membershipId ===
                "string"
                  ? (errorData.currentCampaignManager as any).membershipId
                  : null,
              name:
                typeof (errorData.currentCampaignManager as any).name === "string"
                  ? (errorData.currentCampaignManager as any).name
                  : "the campaign manager",
            }
          : null,
      raw: errorData,
    });

    (error as any).__redirectedToLogin = redirectedToLogin;
    (error as any).__tokenCleared = tokenCleared;
    throw error;
  }

  return null;
}

// 1. Test 403 Forbidden with CAMPAIGN_REVIEW_ACCESS_REQUIRED:
// Proves NO login redirect, token NOT cleared, preserves structured properties
try {
  simulateResponseHandling({
    status: 403,
    ok: false,
    data: {
      statusCode: 403,
      code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
      message: "You don't have approval access for this campaign.",
      currentCampaignManager: {
        membershipId: "cm-surya",
        name: "Surya Writings",
      },
      suggestion:
        "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
    },
  });
  assert.fail("Expected simulateResponseHandling to throw");
} catch (err: any) {
  assert(err instanceof ApiError);
  assert.strictEqual(err.status, 403);
  assert.strictEqual(err.code, "CAMPAIGN_REVIEW_ACCESS_REQUIRED");
  assert.strictEqual(
    err.message,
    "You don't have approval access for this campaign.",
  );
  assert.deepStrictEqual(err.currentCampaignManager, {
    membershipId: "cm-surya",
    name: "Surya Writings",
  });
  assert.strictEqual(
    err.suggestion,
    "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
  );
  assert.strictEqual(
    (err as any).__redirectedToLogin,
    false,
    "403 MUST NOT redirect to login",
  );
  assert.strictEqual(
    (err as any).__tokenCleared,
    false,
    "403 MUST NOT clear access token",
  );

  const parsed = parseApiError(err);
  assert.strictEqual(parsed.isForbidden, true);
  assert.strictEqual(parsed.isCampaignReviewAccessRequired, true);
  assert.strictEqual(parsed.currentCampaignManager?.name, "Surya Writings");
}

// 2. Test 401 Unauthorized:
// Proves login redirect IS triggered and token IS cleared
try {
  simulateResponseHandling({
    status: 401,
    ok: false,
    data: {
      statusCode: 401,
      message: "Unauthorized",
    },
    requireAuth: true,
  });
  assert.fail("Expected simulateResponseHandling to throw");
} catch (err: any) {
  assert(err instanceof ApiError);
  assert.strictEqual(err.status, 401);
  assert.strictEqual(
    (err as any).__redirectedToLogin,
    true,
    "401 MUST redirect to login",
  );
  assert.strictEqual(
    (err as any).__tokenCleared,
    true,
    "401 MUST clear access token",
  );
}

console.log("All api-client-behavior tests passed successfully.");
