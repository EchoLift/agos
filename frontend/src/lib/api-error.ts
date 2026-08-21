export interface CampaignManagerInfo {
  membershipId: string | null;
  name: string;
}

export interface ApiErrorInit {
  status?: number | null;
  statusCode?: number | null;
  code?: string | null;
  message: string;
  suggestion?: string;
  currentCampaignManager?: CampaignManagerInfo | null;
  raw?: unknown;
}

export class ApiError extends Error {
  readonly status: number | null;
  readonly statusCode: number | null;
  readonly code: string | null;
  readonly suggestion?: string;
  readonly currentCampaignManager?: CampaignManagerInfo | null;
  readonly raw?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status ?? init.statusCode ?? null;
    this.statusCode = init.statusCode ?? init.status ?? null;
    this.code = init.code ?? null;
    this.suggestion = init.suggestion;
    this.currentCampaignManager = init.currentCampaignManager ?? null;
    this.raw = init.raw;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ParsedApiError {
  status: number | null;
  code: string | null;
  message: string;
  suggestion?: string;
  currentCampaignManager?: CampaignManagerInfo;
  isForbidden: boolean;
  isCampaignReviewAccessRequired: boolean;
}

function normalizeMessage(rawMessage: unknown): string {
  if (Array.isArray(rawMessage)) {
    return rawMessage
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
    return rawMessage.trim();
  }
  if (rawMessage && typeof rawMessage === "object") {
    const objMsg = (rawMessage as Record<string, unknown>).message;
    if (objMsg && objMsg !== rawMessage) {
      return normalizeMessage(objMsg);
    }
  }
  return "";
}

export function parseApiError(error: unknown): ParsedApiError {
  if (error instanceof ApiError) {
    const isForbidden = error.status === 403 || error.statusCode === 403;
    const isCampaignReviewAccessRequired =
      error.code === "CAMPAIGN_REVIEW_ACCESS_REQUIRED" ||
      (isForbidden &&
        /approval access|review access/i.test(error.message || ""));

    return {
      status: error.status,
      code: error.code,
      message: error.message || "An unexpected error occurred.",
      suggestion: error.suggestion,
      currentCampaignManager: error.currentCampaignManager ?? undefined,
      isForbidden,
      isCampaignReviewAccessRequired,
    };
  }

  let status: number | null = null;
  let code: string | null = null;
  let message = "";
  let suggestion: string | undefined = undefined;
  let currentCampaignManager: CampaignManagerInfo | undefined = undefined;

  if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    const response = errObj.response as Record<string, unknown> | undefined;
    const data = (response?.data ?? errObj.data ?? errObj) as Record<
      string,
      unknown
    >;

    if (typeof response?.status === "number") {
      status = response.status;
    } else if (typeof errObj.status === "number") {
      status = errObj.status;
    } else if (typeof data?.statusCode === "number") {
      status = data.statusCode;
    } else if (typeof errObj.statusCode === "number") {
      status = errObj.statusCode;
    }

    if (typeof data?.code === "string") {
      code = data.code;
    } else if (typeof errObj.code === "string" && !errObj.code.startsWith("ERR_")) {
      code = errObj.code;
    }

    if (typeof data?.suggestion === "string") {
      suggestion = data.suggestion;
    } else if (typeof errObj.suggestion === "string") {
      suggestion = errObj.suggestion;
    }

    const rawManager = data?.currentCampaignManager ?? errObj.currentCampaignManager;
    if (rawManager && typeof rawManager === "object") {
      const mgrObj = rawManager as Record<string, unknown>;
      currentCampaignManager = {
        membershipId:
          typeof mgrObj.membershipId === "string" ? mgrObj.membershipId : null,
        name: typeof mgrObj.name === "string" ? mgrObj.name : "the campaign manager",
      };
    }

    const rawMessage = data?.message ?? errObj.message;
    message = normalizeMessage(rawMessage);
  } else if (typeof error === "string") {
    message = error;
  }

  if (status !== null && status >= 500) {
    message = "An unexpected server error occurred. Please try again later.";
  }

  if (!message) {
    message = "An unexpected error occurred.";
  }

  const isForbidden = status === 403;
  const isCampaignReviewAccessRequired =
    code === "CAMPAIGN_REVIEW_ACCESS_REQUIRED" ||
    (isForbidden && /approval access|review access/i.test(message));

  return {
    status,
    code,
    message,
    suggestion,
    currentCampaignManager,
    isForbidden,
    isCampaignReviewAccessRequired,
  };
}
