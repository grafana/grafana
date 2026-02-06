-- +goose Up
CREATE TABLE tuple (
    store CHAR(26) NOT NULL,
    object_type VARCHAR(128) NOT NULL,
    object_id VARCHAR(128) NOT NULL,
    relation VARCHAR(50) NOT NULL,
    user_object_type VARCHAR(128) NOT NULL,
    user_object_id VARCHAR(128) NOT NULL,
    user_relation VARCHAR(50) NOT NULL,
    user_type VARCHAR(7) NOT NULL,
    ulid CHAR(26) NOT NULL,
    inserted_at TIMESTAMP NOT NULL,
    condition_name VARCHAR(256),
    condition_context LONGBLOB,
    PRIMARY KEY (store, object_type, object_id, relation, user_object_type, user_object_id, user_relation)
);

CREATE UNIQUE INDEX idx_tuple_ulid ON tuple (ulid);
CREATE INDEX idx_reverse_lookup_user ON tuple (store, object_type, relation, user_object_type, user_object_id, user_relation);
CREATE INDEX idx_tuple_partial_user ON tuple (store, object_type, object_id, relation, user_object_type, user_object_id, user_relation) WHERE user_type = 'user';
CREATE INDEX idx_tuple_partial_userset ON tuple (store, object_type, object_id, relation, user_object_type, user_object_id, user_relation) WHERE user_type = 'userset';

CREATE TABLE authorization_model (
    store CHAR(26) NOT NULL,
    authorization_model_id CHAR(26) NOT NULL,
    schema_version VARCHAR(5) NOT NULL DEFAULT '1.1',
    serialized_protobuf LONGBLOB NOT NULL,
    PRIMARY KEY (store, authorization_model_id)
);

CREATE TABLE store (
    id CHAR(26) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE assertion (
    store CHAR(26) NOT NULL,
    authorization_model_id CHAR(26) NOT NULL,
    assertions BLOB,
    PRIMARY KEY (store, authorization_model_id)
);

CREATE TABLE changelog (
    store CHAR(26) NOT NULL,
    object_type VARCHAR(256) NOT NULL,
    object_id VARCHAR(256) NOT NULL,
    relation VARCHAR(50) NOT NULL,
    user_object_type VARCHAR(128) NOT NULL,
    user_object_id VARCHAR(128) NOT NULL,
    user_relation VARCHAR(50) NOT NULL,
    operation INTEGER NOT NULL,
    ulid CHAR(26) NOT NULL,
    inserted_at TIMESTAMP NOT NULL,
    condition_name VARCHAR(256),
    condition_context LONGBLOB,
    PRIMARY KEY (store, ulid, object_type)
);

-- +goose Down
DROP TABLE tuple;
DROP TABLE authorization_model;
DROP TABLE store;
DROP TABLE assertion;
DROP TABLE changelog;
