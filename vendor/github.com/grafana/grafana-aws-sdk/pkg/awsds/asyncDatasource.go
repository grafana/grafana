package awsds

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/sqlds/v5"
)

const defaultKeySuffix = "default"
const fromAlertHeader = "FromAlert"
const fromExpressionHeader = "http_X-Grafana-From-Expr"

func defaultKey(datasourceUID string) string {
	return fmt.Sprintf("%s-%s", datasourceUID, defaultKeySuffix)
}

func keyWithConnectionArgs(datasourceUID string, connArgs json.RawMessage) string {
	return fmt.Sprintf("%s-%s", datasourceUID, string(connArgs))
}

type dbConnection struct {
	db       AsyncDB
	settings backend.DataSourceInstanceSettings
}

type AsyncAWSDatasource struct {
	*sqlds.SQLDatasource

	dbConnections         sync.Map
	driver                AsyncDriver
	sqldsQueryDataHandler backend.QueryDataHandlerFunc
}

func (ds *AsyncAWSDatasource) getDBConnection(key string) (dbConnection, bool) {
	conn, ok := ds.dbConnections.Load(key)
	if !ok {
		return dbConnection{}, false
	}
	return conn.(dbConnection), true
}

func (ds *AsyncAWSDatasource) storeDBConnection(key string, dbConn dbConnection) {
	ds.dbConnections.Store(key, dbConn)
}

func getDatasourceUID(settings backend.DataSourceInstanceSettings) string {
	datasourceUID := settings.UID
	// Grafana < 8.0 won't include the UID yet
	if datasourceUID == "" {
		datasourceUID = fmt.Sprintf("%d", settings.ID)
	}
	return datasourceUID
}

func NewAsyncAWSDatasource(driver AsyncDriver) *AsyncAWSDatasource {
	sqlDs := sqlds.NewDatasource(driver)
	return &AsyncAWSDatasource{
		SQLDatasource:         sqlDs,
		driver:                driver,
		sqldsQueryDataHandler: sqlDs.QueryData,
	}
}

// isAsyncFlow checks the feature flag in query to see if it is async
func isAsyncFlow(query backend.DataQuery) bool {
	q, err := GetQuery(query)
	if err != nil {
		backend.Logger.Error("Error parsing query", "error", err)
		return false
	}

	return q.Meta.QueryFlow == "async"
}

func (ds *AsyncAWSDatasource) NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	db, err := ds.driver.GetAsyncDB(ctx, settings, nil)
	if err != nil {
		return nil, err
	}
	key := defaultKey(getDatasourceUID(settings))
	ds.storeDBConnection(key, dbConnection{db, settings})

	// initialize the wrapped ds.SQLDatasource
	_, err = ds.SQLDatasource.NewDatasource(ctx, settings)
	return ds, err
}

func (ds *AsyncAWSDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	syncExectionEnabled := false
	for _, query := range req.Queries {
		if !isAsyncFlow(query) {
			syncExectionEnabled = true
			break
		}
	}

	_, isFromAlert := req.Headers[fromAlertHeader]
	_, isFromExpression := req.Headers[fromExpressionHeader]
	if syncExectionEnabled || isFromAlert || isFromExpression {
		return ds.sqldsQueryDataHandler.QueryData(ctx, req)
	}

	// async flow
	var (
		response = sqlds.NewResponse(backend.NewQueryDataResponse())
		wg       = sync.WaitGroup{}
	)

	// Execute each query and store the results by query RefID
	for _, q := range req.Queries {
		wg.Add(1)
		go func(query backend.DataQuery) {
			var frames data.Frames
			var err error
			frames, err = ds.handleAsyncQuery(ctx, query, req.PluginContext.DataSourceInstanceSettings.UID)
			if err != nil {
				errorResponse := backend.ErrorResponseWithErrorSource(err)
				var qeError *QueryExecutionError
				// checking if we know the cause of downstream error
				if errors.As(err, &qeError) {
					errorResponse.Status = backend.StatusInternal
					switch qeError.Cause {
					// make sure error.status matches the downstream cause, if provided
					case QueryFailedInternal:
						errorResponse.Status = backend.StatusInternal
					case QueryFailedUser:
						errorResponse.Status = backend.StatusBadRequest
					}
				}
				response.Set(query.RefID, errorResponse)
			} else {
				response.Set(query.RefID, backend.DataResponse{Frames: frames})
			}

			wg.Done()
		}(q)
	}

	wg.Wait()
	return response.Response(), nil
}

func (ds *AsyncAWSDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	datasourceUID := req.PluginContext.DataSourceInstanceSettings.UID
	key := defaultKey(datasourceUID)
	dbConn, ok := ds.getDBConnection(key)
	if !ok {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "No database connection found for datasource uid: " + datasourceUID,
		}, nil
	}
	err := dbConn.db.Ping(ctx)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}
	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Data source is working",
	}, nil
}

func (ds *AsyncAWSDatasource) getAsyncDBFromQuery(ctx context.Context, q *AsyncQuery, datasourceUID string) (AsyncDB, error) {
	if !ds.EnableMultipleConnections && len(q.ConnectionArgs) > 0 {
		return nil, sqlds.ErrorMissingMultipleConnectionsConfig
	}
	// The database connection may vary depending on query arguments
	// The raw arguments are used as key to store the db connection in memory so they can be reused
	key := defaultKey(datasourceUID)
	dbConn, ok := ds.getDBConnection(key)
	if !ok {
		return nil, sqlds.ErrorMissingDBConnection
	}
	if !ds.EnableMultipleConnections || len(q.ConnectionArgs) == 0 {
		return dbConn.db, nil
	}

	key = keyWithConnectionArgs(datasourceUID, q.ConnectionArgs)
	if cachedConn, ok := ds.getDBConnection(key); ok {
		return cachedConn.db, nil
	}

	var err error
	db, err := ds.driver.GetAsyncDB(ctx, dbConn.settings, q.ConnectionArgs)
	if err != nil {
		return nil, err
	}
	// Assign this connection in the cache
	dbConn = dbConnection{db, dbConn.settings}
	ds.storeDBConnection(key, dbConn)

	return dbConn.db, nil
}

type queryMeta struct {
	QueryID string `json:"queryID"`
	Status  string `json:"status"`
}

// handleQuery will call query, and attempt to reconnect if the query failed
func (ds *AsyncAWSDatasource) handleAsyncQuery(ctx context.Context, req backend.DataQuery, datasourceUID string) (data.Frames, error) {
	// Convert the backend.DataQuery into a Query object
	q, err := GetQuery(req)
	if err != nil {
		return getErrorFrameFromQuery(q), err
	}

	// Apply supported macros to the query
	q.RawSQL, err = sqlutil.Interpolate(&q.Query, ds.driver.Macros())
	if err != nil {
		return getErrorFrameFromQuery(q), fmt.Errorf("%s: %w", "Could not apply macros", err)
	}

	// Apply the default FillMode, overwritting it if the query specifies it
	driverSettings := ds.DriverSettings()
	fillMode := driverSettings.FillMode
	if q.FillMissing != nil {
		fillMode = q.FillMissing
	}

	asyncDB, err := ds.getAsyncDBFromQuery(ctx, q, datasourceUID)
	if err != nil {
		return getErrorFrameFromQuery(q), err
	}

	if q.QueryID == "" {
		queryID, err := startQuery(ctx, asyncDB, q)
		if err != nil {
			return getErrorFrameFromQuery(q), err
		}
		return data.Frames{
			{Meta: &data.FrameMeta{
				ExecutedQueryString: q.RawSQL,
				Custom:              queryMeta{QueryID: queryID, Status: "started"}},
			},
		}, nil
	}

	status, err := queryStatus(ctx, asyncDB, q)
	if err != nil {
		return getErrorFrameFromQuery(q), err
	}
	customMeta := queryMeta{QueryID: q.QueryID, Status: status.String()}
	if status != QueryFinished {
		return data.Frames{
			{Meta: &data.FrameMeta{
				ExecutedQueryString: q.RawSQL,
				Custom:              customMeta},
			},
		}, nil
	}

	dbConn, _ := ds.getDBConnection(defaultKey(datasourceUID))
	db, err := ds.GetDBFromQuery(ctx, &q.Query)
	if err != nil {
		return getErrorFrameFromQuery(q), err
	}
	res, err := queryAsync(ctx, db, dbConn.settings, ds.driver.Converters(), fillMode, q, ds.GetRowLimit())
	if err == nil || errors.Is(err, sqlds.ErrorNoResults) {
		if len(res) == 0 {
			res = append(res, &data.Frame{})
		}
		res[0].Meta.Custom = customMeta
		return res, nil
	}

	return getErrorFrameFromQuery(q), err
}

func queryAsync(ctx context.Context, conn *sql.DB, settings backend.DataSourceInstanceSettings, converters []sqlutil.Converter, fillMode *data.FillMissing, q *AsyncQuery, rowLimit int64) (data.Frames, error) {
	query := sqlds.NewQuery(conn, settings, converters, fillMode, rowLimit)
	return query.Run(ctx, &q.Query, nil, sql.NamedArg{Name: "queryID", Value: q.QueryID})
}
