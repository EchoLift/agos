export interface IdentityContext {
  authUserId: string;
  userId: string;
  sessionId: string;
  agencyId?: string;
  membershipId?: string;
  clientId?: string | null;
  clientIds?: string[];
  role?: string;
  roles?: string[];
  permissions: string[];
}
