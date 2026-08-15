import assert from "node:assert";
import {
  normalizeHashTab,
  rememberedEntityKey,
  rememberedTabKey,
  resolveRememberedTab,
} from "../remembered-tab.ts";

console.log("Running remembered-tab unit assertions...");

const campaignTabs = ["overview", "content", "schedule", "team"] as const;

assert.strictEqual(
  rememberedTabKey("campaign", "agency-a", "campaign-a"),
  "agencie:last-tab:campaign:agency-a:campaign-a",
);

assert.notStrictEqual(
  rememberedTabKey("campaign", "agency-a", "campaign-a"),
  rememberedTabKey("campaign", "agency-b", "campaign-a"),
);

assert.notStrictEqual(
  rememberedTabKey("campaign", "agency-a", "campaign-a"),
  rememberedTabKey("campaign", "agency-a", "campaign-b"),
);

assert.strictEqual(
  rememberedEntityKey("campaign", "agency-a"),
  "agencie:last-entity:campaign:agency-a",
);

assert.strictEqual(
  rememberedEntityKey("client", "agency-a"),
  "agencie:last-entity:client:agency-a",
);

assert.notStrictEqual(
  rememberedEntityKey("gig", "agency-a"),
  rememberedEntityKey("gig", "agency-b"),
);

assert.strictEqual(rememberedEntityKey("workflow", null), null);

assert.strictEqual(
  resolveRememberedTab({
    defaultTab: "overview",
    rememberedTab: "content",
    urlTab: "schedule",
    validTabs: campaignTabs,
  }),
  "schedule",
);

assert.strictEqual(
  resolveRememberedTab({
    defaultTab: "overview",
    rememberedTab: "content",
    validTabs: campaignTabs,
  }),
  "content",
);

assert.strictEqual(
  resolveRememberedTab({
    defaultTab: "overview",
    rememberedTab: "deleted-tab",
    validTabs: campaignTabs,
  }),
  "overview",
);

assert.strictEqual(
  resolveRememberedTab({
    defaultTab: "overview",
    rememberedTab: "content",
    urlTab: "forbidden",
    validTabs: campaignTabs,
  }),
  "content",
);

assert.strictEqual(
  resolveRememberedTab({
    defaultTab: "invitations",
    rememberedTab: "invitations",
    validTabs: ["members"] as const,
  }),
  "members",
);

assert.strictEqual(normalizeHashTab("#content"), "content");
assert.strictEqual(normalizeHashTab("#tab=schedule"), "schedule");
assert.strictEqual(normalizeHashTab(""), null);

console.log("✓ All remembered-tab assertions passed successfully.");
