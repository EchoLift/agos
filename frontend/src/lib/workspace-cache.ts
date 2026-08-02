export function agencyStorageKey(agencyId: string | undefined | null, key: string) {
  return agencyId ? `agos.${agencyId}.${key}` : `agos.unscoped.${key}`;
}

export function clearAgencyScopedUiState(previousAgencyId?: string | null, nextAgencyId?: string | null) {
  if (typeof window === "undefined") return;

  const keysToRemove = [
    "agos.calendar.visibleTypes",
    previousAgencyId ? agencyStorageKey(previousAgencyId, "calendar.visibleTypes") : null,
  ].filter((key): key is string => Boolean(key));

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  window.dispatchEvent(
    new CustomEvent("agos:workspace-switched", {
      detail: { previousAgencyId: previousAgencyId ?? null, nextAgencyId: nextAgencyId ?? null },
    }),
  );
}
