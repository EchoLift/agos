import { ForbiddenException } from "@nestjs/common";
import { IdentityContext } from "./interfaces/identity-context.interface";

export function roleKeys(actor?: IdentityContext): string[] {
  return [actor?.role, ...(actor?.roles ?? [])]
    .filter(Boolean)
    .map((role) => role!.toUpperCase().replace(/[\s-]+/g, "_"));
}

export function isClientUser(actor?: IdentityContext): boolean {
  const keys = roleKeys(actor);
  return keys.includes("CLIENT") && keys.every((role) => role === "CLIENT");
}

export function clientScopeId(actor?: IdentityContext): string | null {
  return clientScopeIds(actor)[0] ?? null;
}

export function clientScopeIds(actor?: IdentityContext): string[] {
  if (!isClientUser(actor)) return [];
  return [...new Set([...(actor?.clientIds ?? []), actor?.clientId].filter(Boolean))] as string[];
}

export function requireClientScope(actor: IdentityContext): string {
  const clientIds = clientScopeIds(actor);
  if (clientIds.length === 0) {
    throw new ForbiddenException(
      "No client account has been assigned to your access. Contact your agency administrator.",
    );
  }
  return clientIds[0];
}

export function assertClientScope(
  actor: IdentityContext | undefined,
  targetClientId: string | null | undefined,
) {
  if (!actor || !isClientUser(actor)) return;
  const clientIds = clientScopeIds(actor);
  if (clientIds.length === 0) {
    requireClientScope(actor);
  }
  if (!targetClientId || !clientIds.includes(targetClientId)) {
    throw new ForbiddenException("You do not have access to this client data.");
  }
}
