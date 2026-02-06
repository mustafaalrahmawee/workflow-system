# Indexing Strategy

## JWT Validation Query (every authenticated request)

```typescript
// jwt.strategy.ts — runs on every protected route
await prisma.user.findFirst({
  where: { id: payload.sub, deletedAt: null, isActive: true },
});
```

### Why no composite index on (id, deleted_at, is_active)?

`user_id` is the Primary Key. PostgreSQL automatically creates a unique B-Tree index for every PK.

**Execution plan:**

```
1. INDEX UNIQUE SCAN  (pk_users_user_id)  →  returns exactly 0 or 1 row
2. TABLE ACCESS BY INDEX ROWID            →  loads the full row from heap
3. FILTER  (deleted_at IS NULL AND is_active = true)  →  in-memory check on 1 row
```

The PK lookup already narrows the result to **at most one row**. Filtering `deleted_at` and `is_active` on a single row is a trivial in-memory comparison — effectively O(1).

A composite index `(user_id, deleted_at, is_active)` would **not change the execution plan** because the optimizer already uses an INDEX UNIQUE SCAN via the PK. Adding the index would only introduce unnecessary write overhead (every INSERT/UPDATE/DELETE on the users table must maintain it).

**Rule of thumb:** When the WHERE clause already contains a PK or UNIQUE column, additional filter columns do not benefit from a composite index — the unique lookup already guarantees at most one row.

### When would a composite index be justified?

When there is **no PK/UNIQUE filter** and the query scans many rows:

```sql
-- Example: Reviewer inbox (planned, not yet implemented)
SELECT * FROM application
WHERE assigned_to_id = ? AND status IN ('SUBMITTED', 'IN_REVIEW')
ORDER BY submitted_at DESC;
```

Here, `assigned_to_id` is not unique — the query could match hundreds of rows. A composite index `(assigned_to_id, status, submitted_at)` changes the plan from a FULL TABLE SCAN to an INDEX RANGE SCAN, which is a significant improvement.

## References

- Winand, M. *SQL Performance Explained* / [Use The Index, Luke](https://use-the-index-luke.com/)
