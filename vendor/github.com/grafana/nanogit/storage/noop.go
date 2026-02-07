package storage

import (
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
)

// NoopPackfileStorage is a no-op implementation of PackfileStorage.
type NoopPackfileStorage struct{}

func (n *NoopPackfileStorage) Get(key hash.Hash) (*protocol.PackfileObject, bool) {
	return nil, false
}

func (n *NoopPackfileStorage) GetAllKeys() []hash.Hash {
	return nil
}

func (n *NoopPackfileStorage) Add(objs ...*protocol.PackfileObject) {}

func (n *NoopPackfileStorage) Delete(key hash.Hash) {}

func (n *NoopPackfileStorage) Len() int {
	return 0
}
