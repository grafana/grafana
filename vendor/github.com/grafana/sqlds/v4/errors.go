package sqlds

import (
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var (
	// ErrorBadDatasource is returned if the data source could not be asserted to the correct type (this should basically never happen?)
	ErrorBadDatasource = errors.New("type assertion to datasource failed")
	// ErrorJSON is returned when json.Unmarshal fails
	ErrorJSON = errors.New("error unmarshaling query JSON the Query Model")
	// ErrorQuery is returned when the query could not complete / execute
	ErrorQuery = errors.New("error querying the database")
	// ErrorTimeout is returned if the query has timed out
	ErrorTimeout = errors.New("query timeout exceeded")
	// ErrorNoResults is returned if there were no results returned
	ErrorNoResults = errors.New("no results returned from query")
)

func ErrorSource(err error) backend.ErrorSource {
	if backend.IsDownstreamError(err) {
		return backend.ErrorSourceDownstream
	}
	return backend.ErrorSourcePlugin
}
