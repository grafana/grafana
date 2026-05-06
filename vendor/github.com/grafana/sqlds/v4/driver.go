package sqlds

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

type DriverSettings struct {
	FillMode       *data.FillMissing
	RetryOn        []string
	Timeout        time.Duration
	Retries        int
	Pause          int
	ForwardHeaders bool
	Errors         bool
	RowLimit       int64
}

// Driver is a simple interface that defines how to connect to a backend SQL datasource
// Plugin creators will need to implement this in order to create a managed datasource
type Driver interface {
	// Connect connects to the database. It does not need to call `db.Ping()`
	Connect(context.Context, backend.DataSourceInstanceSettings, json.RawMessage) (*sql.DB, error)
	// Settings are read whenever the plugin is initialized, or after the data source settings are updated
	Settings(context.Context, backend.DataSourceInstanceSettings) DriverSettings
	Macros() Macros
	Converters() []sqlutil.Converter
}

// Connection represents a SQL connection and is satisfied by the *sql.DB type
// For now, we only add the functions that we need / actively use. Some other candidates for future use could include the ExecContext and BeginTxContext functions
type Connection interface {
	Close() error
	Ping() error
	PingContext(ctx context.Context) error
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
}

// QueryDataMutator  is an additional interface that could be implemented by driver.
// This adds ability to the driver to optionally mutate the query before it's run
// with the QueryDataRequest.
type QueryDataMutator interface {
	MutateQueryData(ctx context.Context, req *backend.QueryDataRequest) (context.Context, *backend.QueryDataRequest)
}

// CheckHealthMutator  is an additional interface that could be implemented by driver.
// This adds ability to the driver to optionally mutate the CheckHealth before it's run
type CheckHealthMutator interface {
	MutateCheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (context.Context, *backend.CheckHealthRequest)
}

// QueryMutator is an additional interface that could be implemented by driver.
// This adds ability to the driver it can mutate query before run.
type QueryMutator interface {
	MutateQuery(ctx context.Context, req backend.DataQuery) (context.Context, backend.DataQuery)
}

// QueryArgSetter is an additional interface that could be implemented by driver.
// This adds the ability to the driver to optionally set query args that are then sent down to the database.
type QueryArgSetter interface {
	SetQueryArgs(ctx context.Context, headers http.Header) []interface{}
}

// ResponseMutator is an additional interface that could be implemented by driver.
// This adds ability to the driver, so it can mutate a response from the driver before its returned to the client.
type ResponseMutator interface {
	MutateResponse(ctx context.Context, res data.Frames) (data.Frames, error)
}
