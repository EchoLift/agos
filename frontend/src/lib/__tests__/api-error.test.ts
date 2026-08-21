import assert from "node:assert";
import { ApiError, parseApiError } from "../api-error.ts";

console.log("Running api-error unit assertions...");

// 1. ApiError preserves structured fields
const structuredError = new ApiError({
  status: 403,
  statusCode: 403,
  code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
  message: "You don't have approval access for this campaign.",
  currentCampaignManager: {
    membershipId: "cm-1",
    name: "Surya Writings",
  },
  suggestion:
    "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
  raw: { extra: "data" },
});

assert.strictEqual(structuredError.status, 403);
assert.strictEqual(structuredError.statusCode, 403);
assert.strictEqual(structuredError.code, "CAMPAIGN_REVIEW_ACCESS_REQUIRED");
assert.strictEqual(
  structuredError.message,
  "You don't have approval access for this campaign.",
);
assert.deepStrictEqual(structuredError.currentCampaignManager, {
  membershipId: "cm-1",
  name: "Surya Writings",
});
assert.strictEqual(
  structuredError.suggestion,
  "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
);

// 2. parseApiError normalizes ApiError with CAMPAIGN_REVIEW_ACCESS_REQUIRED
const parsed1 = parseApiError(structuredError);
assert.strictEqual(parsed1.status, 403);
assert.strictEqual(parsed1.code, "CAMPAIGN_REVIEW_ACCESS_REQUIRED");
assert.strictEqual(parsed1.isForbidden, true);
assert.strictEqual(parsed1.isCampaignReviewAccessRequired, true);
assert.deepStrictEqual(parsed1.currentCampaignManager, {
  membershipId: "cm-1",
  name: "Surya Writings",
});
assert.strictEqual(
  parsed1.suggestion,
  "Ask to be added as a campaign manager or reviewer, or contact Surya Writings.",
);

// 3. parseApiError normalizes raw NestJS serialized HttpException response
const rawNestJsError = {
  response: {
    status: 403,
    data: {
      statusCode: 403,
      error: "ForbiddenException",
      code: "CAMPAIGN_REVIEW_ACCESS_REQUIRED",
      message: "You don't have approval access for this campaign.",
      currentCampaignManager: {
        membershipId: "cm-2",
        name: "Priya Sharma",
      },
      suggestion:
        "Ask to be added as a campaign manager or reviewer, or contact Priya Sharma.",
    },
  },
};

const parsed2 = parseApiError(rawNestJsError);
assert.strictEqual(parsed2.status, 403);
assert.strictEqual(parsed2.code, "CAMPAIGN_REVIEW_ACCESS_REQUIRED");
assert.strictEqual(parsed2.isForbidden, true);
assert.strictEqual(parsed2.isCampaignReviewAccessRequired, true);
assert.deepStrictEqual(parsed2.currentCampaignManager, {
  membershipId: "cm-2",
  name: "Priya Sharma",
});
assert.strictEqual(
  parsed2.suggestion,
  "Ask to be added as a campaign manager or reviewer, or contact Priya Sharma.",
);

// 4. parseApiError normalizes generic 403 Forbidden without review access code
const generic403Error = {
  status: 403,
  data: {
    message: "You do not have permission to access this resource.",
  },
};

const parsed3 = parseApiError(generic403Error);
assert.strictEqual(parsed3.status, 403);
assert.strictEqual(parsed3.isForbidden, true);
assert.strictEqual(parsed3.isCampaignReviewAccessRequired, false);
assert.strictEqual(
  parsed3.message,
  "You do not have permission to access this resource.",
);
assert.strictEqual(parsed3.currentCampaignManager, undefined);

// 5. parseApiError handles class-validator arrays
const validationError = {
  status: 400,
  data: {
    statusCode: 400,
    message: [
      "title must be longer than 3 characters",
      "type must be a valid enum value",
    ],
  },
};

const parsed4 = parseApiError(validationError);
assert.strictEqual(parsed4.status, 400);
assert.strictEqual(parsed4.isForbidden, false);
assert.strictEqual(
  parsed4.message,
  "title must be longer than 3 characters, type must be a valid enum value",
);

// 6. parseApiError sanitizes 5xx server errors to prevent leaking technical stack traces
const serverError = {
  status: 500,
  data: {
    message: "PrismaClientKnownRequestError: relation \"workflows\" does not exist at /src/db.ts:123",
  },
};

const parsed5 = parseApiError(serverError);
assert.strictEqual(parsed5.status, 500);
assert.strictEqual(
  parsed5.message,
  "An unexpected server error occurred. Please try again later.",
);

// 7. parseApiError handles unexpected strings/nulls gracefully
const parsed6 = parseApiError("Network connection reset");
assert.strictEqual(parsed6.status, null);
assert.strictEqual(parsed6.message, "Network connection reset");
assert.strictEqual(parsed6.isForbidden, false);

const parsed7 = parseApiError(null);
assert.strictEqual(parsed7.message, "An unexpected error occurred.");
assert.strictEqual(parsed7.isForbidden, false);

console.log("All api-error assertions passed successfully.");
