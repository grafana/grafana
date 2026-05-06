package resource

import "context"

// RegisterSchemaOptions are the options passed to a Manager.RegisterSchema call.
type RegisterSchemaOptions struct {
	// UpdateOnConflict will have the manager overwrite the schema definition that currently exists in the system
	// if it already exists. This may impact existing stored resources, depending on the implementation.
	// Use with caution.
	UpdateOnConflict bool
	// NoErrorOnConflict instructs the Manager to return a nil error if the provided Schema already exists in the system,
	// rather than returning a conflict error.
	NoErrorOnConflict bool
	// WaitForAvailability will cause the Manager wait until the resource definition is deemed "available" by the system,
	// or until the context is canceled, after the rest of the Schema registration logic is complete.
	// This may be a no-op for implementations.
	WaitForAvailability bool
}

// Manager is an interface allowing in-code management of Schemas.
type Manager interface {
	// RegisterSchema registers a Schema in the storage system.
	// Schemas of identical group and kind, but with differing versions should not conflict.
	// If an identical group, version, and kind is already registered in the system,
	// The implementation should either return an error, or update the schema, based on the RegisterSchemaOptions.
	RegisterSchema(context.Context, Schema, RegisterSchemaOptions) error
}
