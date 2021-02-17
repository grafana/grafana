package pq

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"os"
	"strings"
)

// Connector represents a fixed configuration for the pq driver with a given
// name. Connector satisfies the database/sql/driver Connector interface and
// can be used to create any number of DB Conn's via the database/sql OpenDB
// function.
//
// See https://golang.org/pkg/database/sql/driver/#Connector.
// See https://golang.org/pkg/database/sql/#OpenDB.
type Connector struct {
	opts   values
	dialer Dialer
}

// Connect returns a connection to the database using the fixed configuration
// of this Connector. Context is not used.
func (c *Connector) Connect(ctx context.Context) (driver.Conn, error) {
	return c.open(ctx)
}

// Driver returnst the underlying driver of this Connector.
func (c *Connector) Driver() driver.Driver {
	return &Driver{}
}

// NewConnector returns a connector for the pq driver in a fixed configuration
// with the given dsn. The returned connector can be used to create any number
// of equivalent Conn's. The returned connector is intended to be used with
// database/sql.OpenDB.
//
// See https://golang.org/pkg/database/sql/driver/#Connector.
// See https://golang.org/pkg/database/sql/#OpenDB.
func NewConnector(dsn string) (*Connector, error) {
	var err error
	o := make(values)

	// A number of defaults are applied here, in this order:
	//
	// * Very low precedence defaults applied in every situation
	// * Environment variables
	// * Explicitly passed connection information
	o["host"] = "localhost"
	o["port"] = "5432"
	// N.B.: Extra float digits should be set to 3, but that breaks
	// Postgres 8.4 and older, where the max is 2.
	o["extra_float_digits"] = "2"
	for k, v := range parseEnviron(os.Environ()) {
		o[k] = v
	}

	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		dsn, err = ParseURL(dsn)
		if err != nil {
			return nil, err
		}
	}

	if err := parseOpts(dsn, o); err != nil {
		return nil, err
	}

	// Use the "fallback" application name if necessary
	if fallback, ok := o["fallback_application_name"]; ok {
		if _, ok := o["application_name"]; !ok {
			o["application_name"] = fallback
		}
	}

	// We can't work with any client_encoding other than UTF-8 currently.
	// However, we have historically allowed the user to set it to UTF-8
	// explicitly, and there's no reason to break such programs, so allow that.
	// Note that the "options" setting could also set client_encoding, but
	// parsing its value is not worth it.  Instead, we always explicitly send
	// client_encoding as a separate run-time parameter, which should override
	// anything set in options.
	if enc, ok := o["client_encoding"]; ok && !isUTF8(enc) {
		return nil, errors.New("client_encoding must be absent or 'UTF8'")
	}
	o["client_encoding"] = "UTF8"
	// DateStyle needs a similar treatment.
	if datestyle, ok := o["datestyle"]; ok {
		if datestyle != "ISO, MDY" {
			return nil, fmt.Errorf("setting datestyle must be absent or %v; got %v", "ISO, MDY", datestyle)
		}
	} else {
		o["datestyle"] = "ISO, MDY"
	}

	// If a user is not provided by any other means, the last
	// resort is to use the current operating system provided user
	// name.
	if _, ok := o["user"]; !ok {
		u, err := userCurrent()
		if err != nil {
			return nil, err
		}
		o["user"] = u
	}

	return &Connector{opts: o, dialer: defaultDialer{}}, nil
}
