package controller

import (
	"context"
	"errors"

	"github.com/pressly/goose/v3/database"
)

// A StoreController is used by the goose package to interact with a database. This type is a
// wrapper around the Store interface, but can be extended to include additional (optional) methods
// that are not part of the core Store interface.
type StoreController struct{ database.Store }

var _ database.StoreExtender = (*StoreController)(nil)

// NewStoreController returns a new StoreController that wraps the given Store.
//
// If the Store implements the following optional methods, the StoreController will call them as
// appropriate:
//
//   - TableExists(context.Context, DBTxConn) (bool, error)
//
// If the Store does not implement a method, it will either return a [errors.ErrUnsupported] error
// or fall back to the default behavior.
func NewStoreController(store database.Store) *StoreController {
	return &StoreController{store}
}

func (c *StoreController) TableExists(ctx context.Context, db database.DBTxConn) (bool, error) {
	if t, ok := c.Store.(interface {
		TableExists(ctx context.Context, db database.DBTxConn) (bool, error)
	}); ok {
		return t.TableExists(ctx, db)
	}
	return false, errors.ErrUnsupported
}
