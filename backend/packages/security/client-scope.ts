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
  return isClientUser(actor) ? (actor?.clientId ?? null) : null;
}

export function requireClientScope(actor: IdentityContext): string {
  const clientId = clientScopeId(actor);
  if (!clientId) {
    throw new ForbiddenException(
      "No client account has been assigned to your access. Contact your agency administrator.",
    );
  }
  return clientId;
}

export function assertClientScope(
  actor: IdentityContext | undefined,
  targetClientId: string | null | undefined,
) {
  if (!actor || !isClientUser(actor)) return;
  const clientId = requireClientScope(actor);
  if (targetClientId !== clientId) {
    throw new ForbiddenException("You do not have access to this client data.");
  }
}
