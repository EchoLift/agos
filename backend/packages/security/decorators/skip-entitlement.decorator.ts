import { SetMetadata } from "@nestjs/common";

export const SKIP_ENTITLEMENT_KEY = "skipEntitlement";
export const SkipEntitlement = () => SetMetadata(SKIP_ENTITLEMENT_KEY, true);
