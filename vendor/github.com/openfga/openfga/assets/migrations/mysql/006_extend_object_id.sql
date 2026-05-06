-- +goose Up
ALTER TABLE tuple MODIFY COLUMN object_id VARCHAR(255);

-- +goose Down
ALTER TABLE tuple MODIFY COLUMN object_id VARCHAR(128);