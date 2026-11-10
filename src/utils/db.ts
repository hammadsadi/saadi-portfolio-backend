/**
 * Returns true when a Mongoose write operation fails with a duplicate-key error
 * (MongoDB error code 11000). Used to implement idempotent insert-or-ignore
 * semantics across like, follow, and view-dedup operations.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  const e = err as Record<string, unknown>;
  return e.code === 11000;
}
