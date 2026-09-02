import assert from "node:assert";
import {
  canShowPlatformAdministration,
  platformAdministrationMenuItem,
} from "../profile-menu.ts";

assert.strictEqual(
  canShowPlatformAdministration({ platformRole: "ADMIN" }),
  true,
  "platform ADMIN sees the menu item",
);
assert.strictEqual(
  canShowPlatformAdministration({ platformRole: "USER" }),
  false,
  "ordinary USER does not see the menu item",
);
assert.strictEqual(
  canShowPlatformAdministration({ platformRole: "USER", agencyRole: "OWNER" }),
  false,
  "agency OWNER without platform ADMIN does not see the menu item",
);
assert.strictEqual(canShowPlatformAdministration(undefined), false);

const unchangedAccountItems = [
  "My Profile",
  "Status",
  "Appearance",
  "Notifications",
];
assert.deepStrictEqual(unchangedAccountItems, [
  "My Profile",
  "Status",
  "Appearance",
  "Notifications",
]);

assert.deepStrictEqual(
  platformAdministrationMenuItem(
    (path) => `https://www.agencie.in${path}`,
  ),
  {
    label: "Platform Administration",
    href: "https://www.agencie.in/platform-admin",
    target: "_blank",
    rel: "noopener noreferrer",
  },
  "the item navigates through the central URL resolver",
);

console.log("✓ Profile menu platform-admin assertions passed.");
