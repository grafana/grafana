package awsds

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/sqlds/v5"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// AuthSettings stores the AWS settings from Grafana
type AuthSettings struct {
	AllowedAuthProviders          []string
	AssumeRoleEnabled             bool
	SessionDuration               *time.Duration
	ExternalID                    string
	ListMetricsPageLimit          int
	MultiTenantTempCredentials    bool
	PerDatasourceHTTPProxyEnabled bool

	// necessary for a work around until https://github.com/grafana/grafana/issues/39089 is implemented
	SecureSocksDSProxyEnabled bool
}

// SigV4Settings stores the settings for SigV4 authentication
type SigV4Settings struct {
	Enabled        bool
	VerboseLogging bool
}

// QueryStatus represents the status of an async query
type QueryStatus uint32

const (
	QueryUnknown QueryStatus = iota
	QuerySubmitted
	QueryRunning
	QueryFinished
	QueryCanceled
	QueryFailed
)

type DownstreamErrorCause uint32

const (
	QueryFailedInternal DownstreamErrorCause = iota
	QueryFailedUser
)

// QueryExecutionError error type can be returned from datasource's Execute or QueryStatus methods
// this will mark the downstream cause in errorResponse.Status
type QueryExecutionError struct {
	Err   error
	Cause DownstreamErrorCause
}

func (e *QueryExecutionError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return ""
}

func (e *QueryExecutionError) Unwrap() error {
	return e.Err
}

func (qs QueryStatus) Finished() bool {
	return qs == QueryCanceled || qs == QueryFailed || qs == QueryFinished
}

func (qs QueryStatus) String() string {
	switch qs {
	case QuerySubmitted:
		return "submitted"
	case QueryRunning:
		return "running"
	case QueryFinished:
		return "finished"
	case QueryCanceled:
		return "canceled"
	case QueryFailed:
		return "failed"
	default:
		return "unknown"
	}
}

type QueryMeta struct {
	QueryFlow string `json:"queryFlow,omitempty"`
}

type AsyncQuery struct {
	sqlutil.Query
	QueryID string    `json:"queryID,omitempty"`
	Meta    QueryMeta `json:"meta,omitempty"`
}

// GetQuery returns a Query object given a backend.DataQuery using json.Unmarshal
func GetQuery(query backend.DataQuery) (*AsyncQuery, error) {
	model := &AsyncQuery{}

	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return nil, fmt.Errorf("%w: %v", sqlutil.ErrorJSON, err)
	}

	// Copy directly from the well typed query
	model.RefID = query.RefID
	model.Interval = query.Interval
	model.TimeRange = query.TimeRange
	model.MaxDataPoints = query.MaxDataPoints

	return &AsyncQuery{
		Query:   model.Query,
		QueryID: model.QueryID,
		Meta:    model.Meta,
	}, nil
}

// AsyncDB represents an async SQL connection
type AsyncDB interface {
	// DB generic methods
	driver.Conn
	Ping(ctx context.Context) error

	// Async flow
	StartQuery(ctx context.Context, query string, args ...interface{}) (string, error)
	GetQueryID(ctx context.Context, query string, args ...interface{}) (bool, string, error)
	QueryStatus(ctx context.Context, queryID string) (QueryStatus, error)
	CancelQuery(ctx context.Context, queryID string) error
	GetRows(ctx context.Context, queryID string) (driver.Rows, error)
}

// AsyncDriver extends the driver interface to also connect to async SQL datasources
type AsyncDriver interface {
	sqlds.Driver
	GetAsyncDB(ctx context.Context, settings backend.DataSourceInstanceSettings, queryArgs json.RawMessage) (AsyncDB, error)
}
