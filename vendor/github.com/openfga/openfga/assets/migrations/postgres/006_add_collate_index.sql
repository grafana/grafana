-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_lookup on tuple (
    store,
    _user,
    relation,
    object_type,
    object_id collate "C"
);

DROP INDEX CONCURRENTLY IF EXISTS idx_reverse_lookup_user;

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS idx_user_lookup;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reverse_lookup_user on tuple (store, object_type, relation, _user);
