export enum SemanticFailureCategory {
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  PROVIDER_AUTH_FAILURE = "PROVIDER_AUTH_FAILURE",
  RATE_LIMITED = "RATE_LIMITED",
  RECIPIENT_INVALID = "RECIPIENT_INVALID",
  RECIPIENT_SUPPRESSED = "RECIPIENT_SUPPRESSED",
  MESSAGE_INVALID = "MESSAGE_INVALID",
  POLICY_REJECTED = "POLICY_REJECTED",
  UNKNOWN_TRANSIENT = "UNKNOWN_TRANSIENT",
  UNKNOWN_PERMANENT = "UNKNOWN_PERMANENT",
}

export function isTransientFailure(category: SemanticFailureCategory): boolean {
  return (
    category === SemanticFailureCategory.PROVIDER_UNAVAILABLE ||
    category === SemanticFailureCategory.RATE_LIMITED ||
    category === SemanticFailureCategory.UNKNOWN_TRANSIENT
  );
}
