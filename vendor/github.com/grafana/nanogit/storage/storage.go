package storage

import (
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
)

// PackfileStorage is an interface for storing packfile objects.
//
//go:generate go run github.com/maxbrunsfeld/counterfeiter/v6 -o ../mocks/packfile_storage.go . PackfileStorage
type PackfileStorage interface {
	// Get retrieves an object by its hash.
	Get(key hash.Hash) (*protocol.PackfileObject, bool)
	// GetByType retrieves an object by its hash and type.
	GetByType(key hash.Hash, objType protocol.ObjectType) (*protocol.PackfileObject, bool)
	// GetAllKeys returns all keys in the storage.
	GetAllKeys() []hash.Hash
	// Add adds objects to the storage.
	Add(objs ...*protocol.PackfileObject)
	// Delete deletes an object from the storage.
	Delete(key hash.Hash)
	// Len returns the number of objects in the storage.
	Len() int
}
