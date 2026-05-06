package sqlutil

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var ErrorJSON = errors.New("error unmarshaling query JSON to the Query Model")

// FormatQueryOption defines how the user has chosen to represent the data
type FormatQueryOption uint32

const (
	// FormatOptionTimeSeries formats the query results as a timeseries using "WideToLong"
	FormatOptionTimeSeries FormatQueryOption = iota
	// FormatOptionTable formats the query results as a table using "LongToWide"
	FormatOptionTable
	// FormatOptionLogs sets the preferred visualization to logs
	FormatOptionLogs
	// FormatOptionsTrace sets the preferred visualization to trace
	FormatOptionTrace
	// FormatOptionMulti formats the query results as a timeseries using "LongToMulti"
	FormatOptionMulti
)

// Query is the model that represents the query that users submit from the panel/queryeditor.
// For the sake of backwards compatibility, when making changes to this type, ensure that changes are
// only additive.
type Query struct {
	RawSQL         string            `json:"rawSql"`
	Format         FormatQueryOption `json:"format"`
	ConnectionArgs json.RawMessage   `json:"connectionArgs"`

	RefID         string            `json:"-"`
	Interval      time.Duration     `json:"-"`
	TimeRange     backend.TimeRange `json:"-"`
	MaxDataPoints int64             `json:"-"`
	FillMissing   *data.FillMissing `json:"fillMode,omitempty"`

	// Macros
	Schema string `json:"schema,omitempty"`
	Table  string `json:"table,omitempty"`
	Column string `json:"column,omitempty"`
}

// WithSQL copies the Query, but with a different RawSQL value.
// This is mostly useful in the Interpolate function, where the RawSQL value is modified in a loop
func (q *Query) WithSQL(query string) *Query {
	return &Query{
		RawSQL:         query,
		Format:         q.Format,
		ConnectionArgs: q.ConnectionArgs,
		RefID:          q.RefID,
		Interval:       q.Interval,
		TimeRange:      q.TimeRange,
		MaxDataPoints:  q.MaxDataPoints,
		FillMissing:    q.FillMissing,
		Schema:         q.Schema,
		Table:          q.Table,
		Column:         q.Column,
	}
}

// GetQuery returns a Query object given a backend.DataQuery using json.Unmarshal
func GetQuery(query backend.DataQuery) (*Query, error) {
	model := &Query{}

	if err := json.Unmarshal(query.JSON, &model); err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("%w: %v", ErrorJSON, err))
	}

	// Copy directly from the well typed query
	return &Query{
		RawSQL:         model.RawSQL,
		Format:         model.Format,
		ConnectionArgs: model.ConnectionArgs,
		RefID:          query.RefID,
		Interval:       query.Interval,
		TimeRange:      query.TimeRange,
		MaxDataPoints:  query.MaxDataPoints,
		FillMissing:    model.FillMissing,
		Schema:         model.Schema,
		Table:          model.Table,
		Column:         model.Column,
	}, nil
}

// ErrorFrameFromQuery returns a error frames with empty data and meta fields
func ErrorFrameFromQuery(query *Query) data.Frames {
	frame := data.NewFrame(query.RefID)
	frame.Meta = &data.FrameMeta{
		ExecutedQueryString: query.RawSQL,
	}
	return data.Frames{frame}
}
