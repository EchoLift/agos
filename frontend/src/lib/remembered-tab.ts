"use client";

import { useEffect, useMemo, useState } from "react";

const rememberedEntityChangedEvent = "agencie:remembered-entity-changed";

export type RememberedTabInput<Tab extends string> = {
  storageKey: string | null | undefined;
  validTabs: readonly Tab[];
  defaultTab: Tab;
  urlTab?: string | null;
};

export type RememberedEntityScope = "campaign" | "client" | "gig" | "workflow";

export function rememberedTabKey(
  scope: string,
  ...parts: Array<string | null | undefined>
) {
  return ["agencie:last-tab", scope, ...parts.filter(Boolean)].join(":");
}

export function rememberedEntityKey(
  scope: RememberedEntityScope,
  agencyId: string | null | undefined,
) {
  return agencyId ? `agencie:last-entity:${scope}:${agencyId}` : null;
}

export function readRememberedEntityId(storageKey: string | null | undefined) {
  if (!storageKey || typeof window === "undefined") return null;

  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function clearRememberedEntityId(
  storageKey: string | null | undefined,
) {
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(storageKey);
    window.dispatchEvent(
      new CustomEvent(rememberedEntityChangedEvent, {
        detail: { storageKey, entityId: null },
      }),
    );
  } catch {
    // Storage can be unavailable; navigation still works without memory.
  }
}

export function useRememberedEntityId(storageKey: string | null | undefined) {
  const [entityId, setEntityId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const refresh = () => {
      queueMicrotask(() => {
        if (!isMounted) return;
        setEntityId(readRememberedEntityId(storageKey));
      });
    };

    const handleEntityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string }>).detail;
      if (!detail?.storageKey || detail.storageKey === storageKey) refresh();
    };

    refresh();
    window.addEventListener(rememberedEntityChangedEvent, handleEntityChange);

    return () => {
      isMounted = false;
      window.removeEventListener(rememberedEntityChangedEvent, handleEntityChange);
    };
  }, [storageKey]);

  return entityId;
}

export function useRememberLastVisitedEntity({
  enabled = true,
  entityId,
  storageKey,
}: {
  storageKey: string | null | undefined;
  entityId: string | null | undefined;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled || !storageKey || !entityId) return;

    try {
      window.sessionStorage.setItem(storageKey, entityId);
      window.dispatchEvent(
        new CustomEvent(rememberedEntityChangedEvent, {
          detail: { storageKey, entityId },
        }),
      );
    } catch {
      // Session storage can be unavailable; navigation still works without memory.
    }
  }, [enabled, entityId, storageKey]);
}

export function resolveRememberedTab<Tab extends string>({
  defaultTab,
  rememberedTab,
  urlTab,
  validTabs,
}: {
  validTabs: readonly Tab[];
  defaultTab: Tab;
  urlTab?: string | null;
  rememberedTab?: string | null;
}): Tab {
  const fallback = validTabs.includes(defaultTab) ? defaultTab : validTabs[0] ?? defaultTab;

  if (urlTab && validTabs.includes(urlTab as Tab)) {
    return urlTab as Tab;
  }

  if (rememberedTab && validTabs.includes(rememberedTab as Tab)) {
    return rememberedTab as Tab;
  }

  return fallback;
}

export function useRememberedTab<Tab extends string>({
  defaultTab,
  storageKey,
  urlTab,
  validTabs,
}: RememberedTabInput<Tab>) {
  const stableValidTabs = useMemo(() => [...validTabs], [validTabs]);
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    resolveRememberedTab({ defaultTab, urlTab, validTabs }),
  );
  const [hasResolvedStoredTab, setHasResolvedStoredTab] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveStoredTab = () => {
      if (!isMounted) return;

      if (!storageKey) {
        setActiveTab(
          resolveRememberedTab({
            defaultTab,
            urlTab,
            validTabs: stableValidTabs,
          }),
        );
        setHasResolvedStoredTab(true);
        return;
      }

      let rememberedTab: string | null = null;
      try {
        rememberedTab = window.sessionStorage.getItem(storageKey);
      } catch {
        rememberedTab = null;
      }

      const hashTab = normalizeHashTab(window.location.hash);
      setActiveTab(
        resolveRememberedTab({
          defaultTab,
          rememberedTab,
          urlTab: urlTab || hashTab,
          validTabs: stableValidTabs,
        }),
      );
      setHasResolvedStoredTab(true);
    };

    queueMicrotask(resolveStoredTab);

    return () => {
      isMounted = false;
    };
  }, [defaultTab, stableValidTabs, storageKey, urlTab]);

  useEffect(() => {
    if (!hasResolvedStoredTab || !storageKey || !stableValidTabs.includes(activeTab)) return;

    try {
      window.sessionStorage.setItem(storageKey, activeTab);
    } catch {
      // Storage can be unavailable in private contexts; tab state should still work in memory.
    }
  }, [activeTab, hasResolvedStoredTab, stableValidTabs, storageKey]);

  return [activeTab, setActiveTab] as const;
}

export function normalizeHashTab(hash: string) {
  if (!hash) return null;
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!value) return null;
  return value.startsWith("tab=") ? value.slice(4) : value;
}
