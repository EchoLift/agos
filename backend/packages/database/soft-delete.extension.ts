import { Prisma } from "@prisma/client";

/**
 * Models that support soft delete via a `deletedAt` column.
 * Keep this list in sync with the Prisma schema — every model
 * that has a `deletedAt DateTime?` field must appear here.
 */
const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set([
  "AuthUser",
  "Agency",
  "User",
  "Membership",
  "Role",
  "Client",
  "Campaign",
  "ContentAsset",
]);

function isSoftDeleteModel(model: string | undefined): boolean {
  return model !== undefined && SOFT_DELETE_MODELS.has(model);
}

/**
 * Prisma Client Extension that enforces soft-delete semantics:
 *
 * - **Reads** (`findFirst`, `findMany`, `findUnique`, `findUniqueOrThrow`,
 *   `findFirstOrThrow`, `count`, `aggregate`, `groupBy`) automatically
 *   append `deletedAt: null` unless the caller explicitly filters on
 *   `deletedAt` themselves.
 *
 * - **Deletes** (`delete`, `deleteMany`) are rewritten to set
 *   `deletedAt = now()` instead of physically removing rows.
 *
 * This means no developer needs to remember `WHERE deletedAt IS NULL` —
 * it is always enforced at the infrastructure layer.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: "softDelete",
  query: {
    $allModels: {
      async findFirst({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return query(args);
      },

      async findFirstOrThrow({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return query(args);
      },

      async findMany({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return query(args);
      },

      async findUnique({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          args.where = { ...args.where, deletedAt: null } as any;
        }
        return query(args);
      },

      async findUniqueOrThrow({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          args.where = { ...args.where, deletedAt: null } as any;
        }
        return query(args);
      },

      async count({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return query(args);
      },

      async aggregate({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          args.where = { ...args.where, deletedAt: null };
        }
        return query(args);
      },

      async groupBy({ model, args, query }) {
        if (isSoftDeleteModel(model) && !hasDeletedAtFilter(args.where)) {
          (args as any).where = { ...(args as any).where, deletedAt: null };
        }
        return query(args);
      },

      async delete({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          return (query as any)({
            ...args,
            data: { deletedAt: new Date() },
          } as any);
        }
        return query(args);
      },

      async deleteMany({ model, args, query }) {
        if (isSoftDeleteModel(model)) {
          return (query as any)({
            ...args,
            data: { deletedAt: new Date() },
          } as any);
        }
        return query(args);
      },
    },
  },
});

/**
 * Check whether the caller already included a `deletedAt` condition.
 * If they did, we respect their intent (e.g. querying soft-deleted records).
 */
function hasDeletedAtFilter(where: Record<string, any> | undefined): boolean {
  if (!where) return false;
  if ("deletedAt" in where) return true;

  // Check inside AND/OR/NOT combinators
  for (const key of ["AND", "OR", "NOT"] as const) {
    const nested = where[key];
    if (Array.isArray(nested)) {
      if (nested.some((clause: any) => hasDeletedAtFilter(clause))) return true;
    } else if (nested && typeof nested === "object") {
      if (hasDeletedAtFilter(nested)) return true;
    }
  }

  return false;
}
