package v0alpha1

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"unsafe"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/converters"
	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	j "github.com/json-iterator/go"
)

const (
	refIDKey            = "refId"
	resultAssertionsKey = "resultAssertions"
	datasourceKey       = "datasource"
	datasourceIDKey     = "datasourceId"
	queryTypeKey        = "queryType"
	maxDataPointsKey    = "maxDataPoints"
	intervalMsKey       = "intervalMs"
	hideKey             = "hide"
)

func init() { //nolint:gochecknoinits
	jsoniter.RegisterTypeEncoder("v0alpha1.DataQuery", &genericQueryCodec{})
	jsoniter.RegisterTypeDecoder("v0alpha1.DataQuery", &genericQueryCodec{})
	jsoniter.RegisterTypeDecoder("v0alpha1.DataSourceRef", &datasourceRefCodec{})
}

type QueryDataRequest struct {
	// Time range applied to each query (when not included in the query body)
	TimeRange `json:",inline"`

	// Datasource queries
	Queries []DataQuery `json:"queries"`

	// Optionally include debug information in the response
	Debug bool `json:"debug,omitempty"`
}

// DataQuery is a replacement for `dtos.MetricRequest` with more explicit typing
type DataQuery struct {
	CommonQueryProperties `json:",inline"`

	// Additional Properties (that live at the root)
	additional map[string]any `json:"-"` // note this uses custom JSON marshalling
}

func NewDataQuery(body map[string]any) DataQuery {
	g := &DataQuery{
		additional: make(map[string]any),
	}
	for k, v := range body {
		_ = g.Set(k, v)
	}
	return *g
}

// Set allows setting values using key/value pairs
func (g *DataQuery) Set(key string, val any) *DataQuery {
	switch key {
	case refIDKey:
		g.RefID, _ = val.(string)
	case resultAssertionsKey:
		v, ok := val.(ResultAssertions)
		if ok {
			g.ResultAssertions = &v
			return g
		}
		body, err := json.Marshal(val)
		if err == nil {
			err = json.Unmarshal(body, &g.ResultAssertions)
			if err != nil {
				backend.Logger.Warn("error reading resultAssertions from value. %w", err)
			}
		}
	case timeRangeKey:
		v, ok := val.(TimeRange)
		if ok {
			g.TimeRange = &v
			return g
		}
		body, err := json.Marshal(val)
		if err == nil {
			err = json.Unmarshal(body, &g.TimeRange)
			if err != nil {
				backend.Logger.Warn("error reading timeRange from value. %w", err)
			}
		}
	case datasourceKey:
		v, ok := val.(DataSourceRef)
		if ok {
			g.Datasource = &v
			return g
		}
		body, err := json.Marshal(val)
		if err == nil {
			err = json.Unmarshal(body, &g.Datasource)
			if err != nil {
				backend.Logger.Warn("error reading datasource from value. %w", err)
			}
		}
	case datasourceIDKey:
		v, err := converters.JSONValueToInt64.Converter(val)
		if err == nil {
			g.DatasourceID, _ = v.(int64)
		}
	case queryTypeKey:
		g.QueryType, _ = val.(string)
	case maxDataPointsKey:
		v, err := converters.JSONValueToInt64.Converter(val)
		if err == nil {
			g.MaxDataPoints, _ = v.(int64)
		}
	case intervalMsKey:
		v, err := converters.JSONValueToFloat64.Converter(val)
		if err == nil {
			g.IntervalMS, _ = v.(float64)
		}
	case hideKey:
		g.Hide, _ = val.(bool)
	default:
		if g.additional == nil {
			g.additional = make(map[string]any)
		}
		g.additional[key] = val
	}
	return g
}

func (g *DataQuery) Get(key string) (any, bool) {
	switch key {
	case refIDKey:
		return g.RefID, true
	case resultAssertionsKey:
		return g.ResultAssertions, true
	case timeRangeKey:
		return g.TimeRange, true
	case datasourceKey:
		return g.Datasource, true
	case datasourceIDKey:
		return g.DatasourceID, true
	case queryTypeKey:
		return g.QueryType, true
	case maxDataPointsKey:
		return g.MaxDataPoints, true
	case intervalMsKey:
		return g.IntervalMS, true
	case hideKey:
		return g.Hide, true
	}
	v, ok := g.additional[key]
	return v, ok
}

func (g *DataQuery) GetString(key string) string {
	v, ok := g.Get(key)
	if ok {
		// At the root convert to string
		s, ok := v.(string)
		if ok {
			return s
		}
	}
	return ""
}

type genericQueryCodec struct{}
type datasourceRefCodec struct{}

func (codec *genericQueryCodec) IsEmpty(_ unsafe.Pointer) bool {
	return false
}

func (codec *genericQueryCodec) Encode(ptr unsafe.Pointer, stream *j.Stream) {
	q := (*DataQuery)(ptr)
	writeQuery(q, stream)
}

func (codec *genericQueryCodec) Decode(ptr unsafe.Pointer, iter *j.Iterator) {
	q := DataQuery{}
	err := q.readQuery(jsoniter.NewIterator(iter))
	if err != nil {
		// keep existing iter error if it exists
		if iter.Error == nil {
			iter.Error = err
		}
		return
	}
	*((*DataQuery)(ptr)) = q
}

// Long ago dashboards referenced data sources with only the name
func (codec *datasourceRefCodec) Decode(ptr unsafe.Pointer, iter *j.Iterator) {
	q := DataSourceRef{}
	switch iter.WhatIsNext() {
	case j.StringValue:
		q.UID = iter.ReadString()
	case j.ObjectValue:
		for field := iter.ReadObject(); field != ""; field = iter.ReadObject() {
			if iter.Error != nil {
				return
			}
			switch field {
			case "type":
				q.Type = iter.ReadString()
			case "uid":
				q.UID = iter.ReadString()
			case "apiVersion":
				q.APIVersion = iter.ReadString()
			default:
				_ = iter.Read() // ignore unused properties
			}
		}
	default:
		iter.Error = fmt.Errorf("expected string or object")
		return
	}
	*((*DataSourceRef)(ptr)) = q
}

// MarshalJSON writes JSON including the common and custom values
func (g DataQuery) MarshalJSON() ([]byte, error) {
	cfg := j.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	writeQuery(&g, stream)
	return append([]byte(nil), stream.Buffer()...), stream.Error
}

// UnmarshalJSON reads a query from json byte array
func (g *DataQuery) UnmarshalJSON(b []byte) error {
	iter, err := jsoniter.ParseBytes(jsoniter.ConfigDefault, b)
	if err != nil {
		return err
	}
	return g.readQuery(iter)
}

// UnmarshalJSON reads a query from json byte array
func (g *DataSourceRef) UnmarshalJSON(b []byte) error {
	iter, err := jsoniter.ParseBytes(jsoniter.ConfigDefault, b)
	if err != nil {
		return err
	}
	return iter.Unmarshal(b, g)
}

func (g *DataQuery) DeepCopyInto(out *DataQuery) {
	*out = *g
	g.CommonQueryProperties.DeepCopyInto(&out.CommonQueryProperties)
	if g.additional != nil {
		out.additional = map[string]any{}
		if len(g.additional) > 0 {
			jj, err := json.Marshal(g.additional)
			if err == nil {
				_ = json.Unmarshal(jj, &out.additional)
			}
		}
	}
}

func writeQuery(g *DataQuery, stream *j.Stream) {
	q := g.CommonQueryProperties
	stream.WriteObjectStart()
	stream.WriteObjectField(refIDKey)
	stream.WriteVal(g.RefID)

	if q.ResultAssertions != nil {
		stream.WriteMore()
		stream.WriteObjectField(resultAssertionsKey)
		stream.WriteVal(g.ResultAssertions)
	}

	if q.TimeRange != nil {
		stream.WriteMore()
		stream.WriteObjectField(timeRangeKey)
		stream.WriteVal(g.TimeRange)
	}

	if q.Datasource != nil {
		stream.WriteMore()
		stream.WriteObjectField(datasourceKey)
		stream.WriteVal(g.Datasource)
	}

	if q.DatasourceID > 0 {
		stream.WriteMore()
		stream.WriteObjectField(datasourceIDKey)
		stream.WriteVal(g.DatasourceID)
	}

	if q.QueryType != "" {
		stream.WriteMore()
		stream.WriteObjectField(queryTypeKey)
		stream.WriteVal(g.QueryType)
	}

	if q.MaxDataPoints > 0 {
		stream.WriteMore()
		stream.WriteObjectField(maxDataPointsKey)
		stream.WriteVal(g.MaxDataPoints)
	}

	if q.IntervalMS > 0 {
		stream.WriteMore()
		stream.WriteObjectField(intervalMsKey)
		stream.WriteVal(g.IntervalMS)
	}

	if q.Hide {
		stream.WriteMore()
		stream.WriteObjectField(hideKey)
		stream.WriteVal(g.Hide)
	}

	// The additional properties
	if g.additional != nil {
		// we must sort the map-keys to always produce the same JSON
		keys := slices.Sorted(maps.Keys(g.additional))

		for _, k := range keys {
			v := g.additional[k]
			stream.WriteMore()
			stream.WriteObjectField(k)
			stream.WriteVal(v)
		}
	}
	stream.WriteObjectEnd()
}

func (g *DataQuery) readQuery(iter *jsoniter.Iterator) error {
	return g.CommonQueryProperties.readQuery(iter, func(key string, iter *jsoniter.Iterator) error {
		if g.additional == nil {
			g.additional = make(map[string]any)
		}
		v, err := iter.Read()
		g.additional[key] = v
		return err
	})
}

func (g *CommonQueryProperties) readQuery(iter *jsoniter.Iterator,
	processUnknownKey func(key string, iter *jsoniter.Iterator) error,
) error {
	var err error
	var next j.ValueType
	field := ""
	for field, err = iter.ReadObject(); field != ""; field, err = iter.ReadObject() {
		switch field {
		case refIDKey:
			g.RefID, err = iter.ReadString()
		case resultAssertionsKey:
			err = iter.ReadVal(&g.ResultAssertions)
		case timeRangeKey:
			err = iter.ReadVal(&g.TimeRange)
		case datasourceKey:
			// Old datasource values may just be a string
			err = iter.ReadVal(&g.Datasource)

		case datasourceIDKey:
			g.DatasourceID, err = iter.ReadInt64()
		case queryTypeKey:
			g.QueryType, err = iter.ReadString()
		case maxDataPointsKey:
			next, err = iter.WhatIsNext()
			if err != nil {
				return err
			}
			switch next {
			case j.StringValue:
				var v string
				v, err = iter.ReadString()
				if err == nil {
					g.MaxDataPoints, err = strconv.ParseInt(v, 10, 64)
				}
			case j.NumberValue:
				g.MaxDataPoints, err = iter.ReadInt64()
			default:
				return fmt.Errorf("expected number or string for maxDataPoints")
			}
		case intervalMsKey:
			g.IntervalMS, err = iter.ReadFloat64()
		case hideKey:
			g.Hide, err = iter.ReadBool()
		default:
			err = processUnknownKey(field, iter)
		}
		if err != nil {
			return err
		}
	}
	return err
}

// CommonQueryProperties are properties that can be added to all queries.
// These properties live in the same JSON level as datasource specific properties,
// so care must be taken to ensure they do not overlap
type CommonQueryProperties struct {
	// RefID is the unique identifier of the query, set by the frontend call.
	RefID string `json:"refId,omitempty"`

	// Optionally define expected query result behavior
	ResultAssertions *ResultAssertions `json:"resultAssertions,omitempty"`

	// TimeRange represents the query range
	// NOTE: unlike generic /ds/query, we can now send explicit time values in each query
	// NOTE: the values for timeRange are not saved in a dashboard, they are constructed on the fly
	TimeRange *TimeRange `json:"timeRange,omitempty"`

	// The datasource
	Datasource *DataSourceRef `json:"datasource,omitempty"`

	// Deprecated -- use datasource ref instead
	DatasourceID int64 `json:"datasourceId,omitempty"`

	// QueryType is an optional identifier for the type of query.
	// It can be used to distinguish different types of queries.
	QueryType string `json:"queryType,omitempty"`

	// MaxDataPoints is the maximum number of data points that should be returned from a time series query.
	// NOTE: the values for maxDataPoints is not saved in the query model.  It is typically calculated
	// from the number of pixels visible in a visualization
	MaxDataPoints int64 `json:"maxDataPoints,omitempty"`

	// Interval is the suggested duration between time points in a time series query.
	// NOTE: the values for intervalMs is not saved in the query model.  It is typically calculated
	// from the interval required to fill a pixels in the visualization
	IntervalMS float64 `json:"intervalMs,omitempty"`

	// true if query is disabled (ie should not be returned to the dashboard)
	// NOTE: this does not always imply that the query should not be executed since
	// the results from a hidden query may be used as the input to other queries (SSE etc)
	Hide bool `json:"hide,omitempty"`
}

type DataSourceRef struct {
	// The datasource plugin type
	Type string `json:"type"`

	// Datasource UID (NOTE: name in k8s)
	UID string `json:"uid,omitempty"`

	// The apiserver version
	APIVersion string `json:"apiVersion,omitempty"`
}

// TimeRange represents a time range for a query and is a property of DataQuery.
type TimeRange struct {
	// From is the start time of the query.
	From string `json:"from" jsonschema:"default=now-6h"`

	// To is the end time of the query.
	To string `json:"to" jsonschema:"default=now"`
}

// ResultAssertions define the expected response shape and query behavior.  This is useful to
// enforce behavior over time.  The assertions are passed to the query engine and can be used
// to fail queries *before* returning them to a client (select * from bigquery!)
type ResultAssertions struct {
	// Type asserts that the frame matches a known type structure.
	Type data.FrameType `json:"type,omitempty"`

	// TypeVersion is the version of the Type property. Versions greater than 0.0 correspond to the dataplane
	// contract documentation https://grafana.github.io/dataplane/contract/.
	TypeVersion data.FrameTypeVersion `json:"typeVersion"`

	// Maximum frame count
	MaxFrames int64 `json:"maxFrames,omitempty"`

	// Once we can support this, adding max bytes would be helpful
	// // Maximum bytes that can be read -- if the query planning expects more then this, the query may fail fast
	// MaxBytes int64 `json:"maxBytes,omitempty"`
}

func (r *ResultAssertions) Validate(frames data.Frames) error {
	if r.Type != data.FrameTypeUnknown {
		for _, frame := range frames {
			if frame.Meta == nil {
				return fmt.Errorf("result missing frame type (and metadata)")
			}
			if frame.Meta.Type == data.FrameTypeUnknown {
				// ?? should we try to detect? and see if we can use it as that type?
				return fmt.Errorf("expected frame type [%s], but the type is unknown", r.Type)
			}
			if frame.Meta.Type != r.Type {
				return fmt.Errorf("expected frame type [%s], but found [%s]", r.Type, frame.Meta.Type)
			}
			if !r.TypeVersion.IsZero() {
				if r.TypeVersion == frame.Meta.TypeVersion {
					return fmt.Errorf("type versions do not match.  Expected [%s], but found [%s]", r.TypeVersion, frame.Meta.TypeVersion)
				}
			}
		}
	}

	if r.MaxFrames > 0 && len(frames) > int(r.MaxFrames) {
		return fmt.Errorf("more than expected frames found")
	}
	return nil
}
