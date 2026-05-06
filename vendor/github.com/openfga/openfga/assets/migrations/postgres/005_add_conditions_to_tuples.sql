-- +goose Up
ALTER TABLE tuple ADD COLUMN condition_name TEXT, ADD COLUMN condition_context BYTEA;
ALTER TABLE changelog ADD COLUMN condition_name TEXT, ADD COLUMN condition_context BYTEA;

-- +goose Down
ALTER TABLE tuple DROP COLUMN condition_name, DROP COLUMN condition_context;
ALTER TABLE changelog DROP COLUMN condition_name, DROP COLUMN condition_context;
