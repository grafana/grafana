package sqlds

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"runtime/debug"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const defaultKeySuffix = "default"
const defaultRowLimit = int64(-1)
const envRowLimit = "GF_DATAPROXY_ROW_LIMIT"

var (
	ErrorMissingMultipleConnectionsConfig = backend.PluginError(errors.New("received connection arguments but the feature is not enabled"))
	ErrorMissingDBConnection              = backend.PluginError(errors.New("unable to get default db connection"))
	HeaderKey                             = "grafana-http-headers"
	// Deprecated: ErrorMissingMultipleConnectionsConfig should be used instead
	MissingMultipleConnectionsConfig = ErrorMissingMultipleConnectionsConfig
	// Deprecated: ErrorMissingDBConnection should be used instead
	MissingDBConnection = ErrorMissingDBConnection
)

func defaultKey(datasourceUID string) string {
	return fmt.Sprintf("%s-%s", datasourceUID, defaultKeySuffix)
}

func keyWithConnectionArgs(datasourceUID string, connArgs json.RawMessage) string {
	return fmt.Sprintf("%s-%s", datasourceUID, string(connArgs))
}

type dbConnection struct {
	db       *sql.DB
	settings backend.DataSourceInstanceSettings
}

type SQLDatasource struct {
	Completable
	backend.CallResourceHandler
	connector                 *Connector
	CustomRoutes              map[string]func(http.ResponseWriter, *http.Request)
	metrics                   Metrics
	EnableMultipleConnections bool
	// EnableRowLimit: enables using the dataproxy.row_limit setting to limit the number of rows returned by the query
	// https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#row_limit
	EnableRowLimit bool
	rowLimit       int64
	// PreCheckHealth (optional). Performs custom health check before the Connect method
	PreCheckHealth func(ctx context.Context, req *backend.CheckHealthRequest) *backend.CheckHealthResult
	// PostCheckHealth (optional).Performs custom health check after the Connect method
	PostCheckHealth func(ctx context.Context, req *backend.CheckHealthRequest) *backend.CheckHealthResult
}

// NewDatasource creates a new `SQLDatasource`.
// It uses the provided settings argument to call the ds.Driver to connect to the SQL server
func (ds *SQLDatasource) NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	conn, err := NewConnector(ctx, ds.driver(), settings, ds.EnableMultipleConnections)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}

	ds.connector = conn
	mux := http.NewServeMux()
	err = ds.registerRoutes(mux)
	if err != nil {
		return nil, backend.PluginError(err)
	}

	ds.CallResourceHandler = httpadapter.New(mux)
	ds.metrics = NewMetrics(settings.Name, settings.Type, EndpointQuery)

	ds.rowLimit = ds.newRowLimit(ctx, conn)

	return ds, nil
}

// NewDatasource initializes the Datasource wrapper and instance manager
func NewDatasource(c Driver) *SQLDatasource {
	return &SQLDatasource{
		connector: &Connector{driver: c},
	}
}

// Dispose cleans up datasource instance resources.
// Note: Called when testing and saving a datasource
func (ds *SQLDatasource) Dispose() {
	ds.connector.Dispose()
}

// QueryData creates the Responses list and executes each query
func (ds *SQLDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	headers := req.GetHTTPHeaders()

	var (
		response = NewResponse(backend.NewQueryDataResponse())
		wg       = sync.WaitGroup{}
	)

	wg.Add(len(req.Queries))

	if queryDataMutator, ok := ds.driver().(QueryDataMutator); ok {
		ctx, req = queryDataMutator.MutateQueryData(ctx, req)
	}

	// Execute each query and store the results by query RefID
	for _, q := range req.Queries {
		go func(query backend.DataQuery) {
			defer wg.Done()

			// Panic recovery
			defer func() {
				if r := recover(); r != nil {
					stack := string(debug.Stack())
					errorMsg := fmt.Sprintf("SQL datasource query execution panic: %v", r)

					// Log panic without sensitive query data
					backend.Logger.Error(errorMsg,
						"panic", r,
						"refID", query.RefID,
						"queryType", query.QueryType,
						"maxDataPoints", query.MaxDataPoints,
						"interval", query.Interval)

					// Log stack trace separately at debug level to avoid exposing in production
					backend.Logger.Debug("Panic stack trace", "stack", stack)

					response.Set(query.RefID, backend.DataResponse{
						Frames:      nil,
						Error:       backend.PluginError(errors.New(errorMsg)),
						ErrorSource: backend.ErrorSourcePlugin,
					})
				}
			}()

			frames, err := ds.handleQuery(ctx, query, headers)
			if err == nil {
				if responseMutator, ok := ds.driver().(ResponseMutator); ok {
					frames, err = responseMutator.MutateResponse(ctx, frames)
					if err != nil {
						err = backend.PluginError(err)
					}
				}
			}

			response.Set(query.RefID, backend.DataResponse{
				Frames:      frames,
				Error:       err,
				ErrorSource: ErrorSource(err),
			})
		}(q)
	}

	wg.Wait()

	errs := ds.errors(response)
	if ds.DriverSettings().Errors {
		return response.Response(), errs
	}

	return response.Response(), nil
}

func (ds *SQLDatasource) GetDBFromQuery(ctx context.Context, q *Query) (*sql.DB, error) {
	_, dbConn, err := ds.connector.GetConnectionFromQuery(ctx, q)
	return dbConn.db, err
}

// handleQuery will call query, and attempt to reconnect if the query failed
func (ds *SQLDatasource) handleQuery(ctx context.Context, req backend.DataQuery, headers http.Header) (data.Frames, error) {
	if queryMutator, ok := ds.driver().(QueryMutator); ok {
		ctx, req = queryMutator.MutateQuery(ctx, req)
	}

	// Convert the backend.DataQuery into a Query object
	q, err := GetQuery(req, headers, ds.DriverSettings().ForwardHeaders)
	if err != nil {
		return nil, err
	}

	// Apply supported macros to the query
	q.RawSQL, err = Interpolate(ds.driver(), q)
	if err != nil {
		if errors.Is(err, sqlutil.ErrorBadArgumentCount) || err.Error() == ErrorParsingMacroBrackets.Error() {
			err = backend.DownstreamError(err)
		}
		return sqlutil.ErrorFrameFromQuery(q), fmt.Errorf("%s: %w", "Could not apply macros", err)
	}

	// Apply the default FillMode, overwritting it if the query specifies it
	fillMode := ds.DriverSettings().FillMode
	if q.FillMissing != nil {
		fillMode = q.FillMissing
	}

	// Retrieve the database connection
	cacheKey, dbConn, err := ds.connector.GetConnectionFromQuery(ctx, q)
	if err != nil {
		return sqlutil.ErrorFrameFromQuery(q), err
	}

	if ds.DriverSettings().Timeout != 0 {
		tctx, cancel := context.WithTimeout(ctx, ds.DriverSettings().Timeout)
		defer cancel()

		ctx = tctx
	}

	var args []interface{}
	if argSetter, ok := ds.driver().(QueryArgSetter); ok {
		args = argSetter.SetQueryArgs(ctx, headers)
	}

	// FIXES:
	//  * Some datasources (snowflake) expire connections or have an authentication token that expires if not used in 1 or 4 hours.
	//    Because the datasource driver does not include an option for permanent connections, we retry the connection
	//    if the query fails. NOTE: this does not include some errors like "ErrNoRows"
	dbQuery := NewQuery(dbConn.db, dbConn.settings, ds.driver().Converters(), fillMode, ds.rowLimit)
	res, err := dbQuery.Run(ctx, q, args...)
	if err == nil {
		return res, nil
	}

	if errors.Is(err, ErrorNoResults) {
		return res, nil
	}

	// If there's a query error that didn't exceed the
	// context deadline retry the query
	if errors.Is(err, ErrorQuery) && !errors.Is(err, context.DeadlineExceeded) {
		// only retry on messages that contain specific errors
		if shouldRetry(ds.DriverSettings().RetryOn, err.Error()) {
			for i := 0; i < ds.DriverSettings().Retries; i++ {
				backend.Logger.Warn(fmt.Sprintf("query failed: %s. Retrying %d times", err.Error(), i))
				db, err := ds.connector.Reconnect(ctx, dbConn, q, cacheKey)
				if err != nil {
					return nil, backend.DownstreamError(err)
				}

				if ds.DriverSettings().Pause > 0 {
					time.Sleep(time.Duration(ds.DriverSettings().Pause * int(time.Second)))
				}

				dbQuery := NewQuery(db, dbConn.settings, ds.driver().Converters(), fillMode, ds.rowLimit)
				res, err = dbQuery.Run(ctx, q, args...)
				if err == nil {
					return res, err
				}
				if !shouldRetry(ds.DriverSettings().RetryOn, err.Error()) {
					return res, err
				}
				backend.Logger.Warn(fmt.Sprintf("Retry failed: %s", err.Error()))
			}
		}
	}

	// allow retries on timeouts
	if errors.Is(err, context.DeadlineExceeded) {
		for i := 0; i < ds.DriverSettings().Retries; i++ {
			backend.Logger.Warn(fmt.Sprintf("connection timed out. retrying %d times", i))
			db, err := ds.connector.Reconnect(ctx, dbConn, q, cacheKey)
			if err != nil {
				continue
			}

			dbQuery := NewQuery(db, dbConn.settings, ds.driver().Converters(), fillMode, ds.rowLimit)
			res, err = dbQuery.Run(ctx, q, args...)
			if err == nil {
				return res, err
			}
		}
	}

	return res, err
}

// CheckHealth pings the connected SQL database
func (ds *SQLDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if checkHealthMutator, ok := ds.driver().(CheckHealthMutator); ok {
		ctx, req = checkHealthMutator.MutateCheckHealth(ctx, req)
	}
	healthChecker := &HealthChecker{
		Connector:       ds.connector,
		Metrics:         ds.metrics.WithEndpoint(EndpointHealth),
		PreCheckHealth:  ds.PreCheckHealth,
		PostCheckHealth: ds.PostCheckHealth,
	}
	return healthChecker.Check(ctx, req)
}

func (ds *SQLDatasource) DriverSettings() DriverSettings {
	return ds.connector.driverSettings
}

func (ds *SQLDatasource) driver() Driver {
	return ds.connector.driver
}

func (ds *SQLDatasource) errors(response *Response) error {
	if response == nil {
		return nil
	}
	res := response.Response()
	if res == nil {
		return nil
	}
	var err error
	for _, r := range res.Responses {
		err = errors.Join(err, r.Error)
	}
	if err != nil {
		backend.Logger.Error(err.Error())
	}
	return err
}

func (ds *SQLDatasource) GetRowLimit() int64 {
	return ds.rowLimit
}

func (ds *SQLDatasource) SetDefaultRowLimit(limit int64) {
	ds.EnableRowLimit = true
	ds.rowLimit = limit
}

// newRowLimit returns the row limit for the datasource
// It checks in the following order:
// 1. set in the datasource configuration page
// 2. set via the environment variable
// 3. set is set on grafana_ini and passed via grafana context
// 4. default row limit set by SetDefaultRowLimit
func (ds *SQLDatasource) newRowLimit(ctx context.Context, conn *Connector) int64 {
	if !ds.EnableRowLimit {
		return defaultRowLimit
	}

	// Handles when row limit is set in the datasource configuration page
	settingsLimit := conn.driverSettings.RowLimit
	if settingsLimit != 0 {
		return settingsLimit
	}

	// Handles when row limit is set via environment variable
	envLimit := os.Getenv(envRowLimit)
	if envLimit != "" {
		l, err := strconv.ParseInt(envLimit, 10, 64)
		if err == nil && l >= 0 {
			return l
		}
		log.DefaultLogger.Error(fmt.Sprintf("failed setting row limit from environment variable: %s", err))
	}

	// Handles row limit from sql config from grafana instance
	config := backend.GrafanaConfigFromContext(ctx)
	if ds.EnableRowLimit && config != nil {
		sqlConfig, err := config.SQL()
		if err != nil {
			backend.Logger.Error(fmt.Sprintf("failed setting row limit from sql config: %s", err))
		} else {
			return sqlConfig.RowLimit
		}
	}

	// handles SetDefaultRowLimit where it is set before the datasource is initialized
	if ds.rowLimit != 0 {
		return ds.rowLimit
	}

	return defaultRowLimit
}
