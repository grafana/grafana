-- +goose Up
ALTER TABLE tuple MODIFY COLUMN object_id VARCHAR(255) COLLATE utf8mb4_bin,
LOCK = SHARED;

CREATE INDEX idx_user_lookup ON tuple (store, _user, relation, object_type, object_id) LOCK = NONE;

DROP INDEX idx_reverse_lookup_user ON tuple LOCK = NONE;

-- +goose Down
DROP INDEX idx_user_lookup on tuple LOCK = NONE;

ALTER TABLE tuple MODIFY COLUMN object_id VARCHAR(255),
LOCK = SHARED;

CREATE INDEX idx_reverse_lookup_user ON tuple (store, object_type, relation, _user) LOCK = NONE;
