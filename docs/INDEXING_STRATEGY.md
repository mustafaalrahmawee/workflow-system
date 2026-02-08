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

## Admin User List Index (`idx_users_list_active`)

```sql
CREATE INDEX idx_users_list_active
ON users (role, is_active, created_at DESC, id)
INCLUDE (email, first_name, last_name)
WHERE deleted_at IS NULL;
```

### Zweck

Optimiert die typische Admin-Listenabfrage "aktive User, optional nach Role/Active gefiltert, neueste zuerst":

- `WHERE deleted_at IS NULL`
- optional `AND role = ?`
- optional `AND is_active = ?`
- `ORDER BY created_at DESC`
- `LIMIT / Pagination`

### Warum genau diese Indexform?

#### 1) Partial Index: `WHERE deleted_at IS NULL`

Soft-Delete trennt "aktive" von "archivierten" Rows. Die Admin-Liste zeigt standardmäßig **nur nicht gelöschte** User.

- Der Index enthält **nur aktive Rows** → deutlich kleinerer Index
- bessere Cache-Quote, weniger I/O
- weniger Write-Maintenance für gelöschte/archivierte Rows

Wichtig: Dieser Index kann nur genutzt werden, wenn die Query auch `deleted_at IS NULL` enthält. Für `includeDeleted=true` gilt ein anderer Access Path (separater Index oder bewusst langsamer Sonderfall).

#### 2) Key-Spalten: `(role, is_active, created_at DESC, id)`

Die Key-Spalten bestimmen **Seek/Range** und **Sortierung**:

- `role`, `is_active`: Equality-Filter (wenn gesetzt) → enger Startbereich im B-Tree
- `created_at DESC`: liefert die Rows bereits in gewünschter Sortierreihenfolge → kein Sort-Step
- `id` als Tie-Breaker: deterministische Reihenfolge (stabil bei gleichen `created_at`), wichtig für robuste Pagination

Effekt: Für `ORDER BY created_at DESC LIMIT 50` kann Postgres häufig "Top-N" direkt vom Index liefern und früh stoppen.

#### 3) INCLUDE-Spalten: `(email, first_name, last_name)` → Covering/Index-Only möglich

Diese Spalten werden nur zur Darstellung benötigt (nicht für Filter/Sort). Mit `INCLUDE` liegen sie im Leaf-Level des Index:

- vermeidet B-Tree "Bloat" (weil nicht Teil des Sortierschlüssels)
- ermöglicht **Index-Only Scan**, *wenn* die Query wirklich nur diese Spalten selektiert (kein `SELECT *`)

Dadurch reduziert sich Heap-I/O deutlich (weniger Random Reads). Der Index-Only Scan ist am effektivsten, wenn Autovacuum/Visibility Map gesund ist.

### Wichtige Konsequenz im Repository (damit der Index wirkt)

Damit Postgres wirklich "covering" arbeiten kann, muss die Admin-Liste im Repository **nur die benötigten Felder** selektieren:

- `id, email, first_name, last_name, role, is_active, created_at`

Wenn `SELECT *` (oder Prisma ohne `select`) verwendet wird, muss Postgres trotzdem zum Heap → kein echter Index-Only-Benefit.

### Trade-offs / Warum wir das in Kauf nehmen

- **Mehr Write-Kosten:** Inserts/Updates für aktive User müssen den Index pflegen (normal für jeden Index).
- **Sonderfall includeDeleted:** Ohne `deleted_at IS NULL` kann dieser Partial Index nicht greifen.
- **Index-Only nicht garantiert:** Bei hoher Update-Rate oder fehlender Vacuum-Visibility kann Postgres Heap Fetches machen. Trotzdem bleibt der Index durch Sort+Limit meistens sehr nützlich.

### Warum nicht noch mehr Spalten in den Key?

`email/first_name/last_name` sind reine "Display"-Spalten. Als Key-Spalten würden sie:

- den Index stark vergrößern
- Inserts/Updates teurer machen
- ohne Vorteil für Filter/Sort

Darum: **Key nur für Access Path**, Display per `INCLUDE`.

## References

- Winand, M. *SQL Performance Explained* / [Use The Index, Luke](https://use-the-index-luke.com/)


