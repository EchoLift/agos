export interface IdentityContext {
  authUserId: string;
  userId: string;
  sessionId: string;
  agencyId?: string;
  membershipId?: string;
  role?: string;
  roles?: string[];
  permissions: string[];
}
