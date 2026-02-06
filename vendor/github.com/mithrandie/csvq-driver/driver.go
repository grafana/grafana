package csvq

import (
	"context"
	"database/sql/driver"

	"github.com/mithrandie/csvq/lib/file"
)

type Driver struct {
}

func (d Driver) Open(dsn string) (driver.Conn, error) {
	return d.OpenContext(context.Background(), dsn)
}

func (d Driver) OpenContext(ctx context.Context, dsn string) (driver.Conn, error) {
	return NewConn(ctx, dsn, file.DefaultWaitTimeout, file.DefaultRetryDelay)
}

func (d Driver) OpenConnector(dsn string) (driver.Connector, error) {
	return Connector{
		dsn:    dsn,
		driver: d,
	}, nil
}

type Connector struct {
	dsn    string
	driver Driver
}

func (t Connector) Connect(ctx context.Context) (driver.Conn, error) {
	return t.driver.OpenContext(ctx, t.dsn)
}

func (t Connector) Driver() driver.Driver {
	return t.driver
}
