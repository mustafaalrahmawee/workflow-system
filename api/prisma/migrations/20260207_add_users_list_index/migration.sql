-- Covering index for admin user list query (Index-Only Scan)
-- Key columns: filter + sort columns
-- INCLUDE columns: display-only columns (stored in leaf pages, not in B-tree)
CREATE INDEX idx_users_list_active
ON users (role, is_active, created_at DESC, user_id)
INCLUDE (email, first_name, last_name)
WHERE deleted_at IS NULL;
