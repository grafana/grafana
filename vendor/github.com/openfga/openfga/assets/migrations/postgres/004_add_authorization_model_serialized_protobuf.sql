-- +goose Up
ALTER TABLE authorization_model ADD COLUMN serialized_protobuf BYTEA;

-- +goose Down
ALTER TABLE authorization_model DROP COLUMN serialized_protobuf;
