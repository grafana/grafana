// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	http2 "github.com/influxdata/influxdb-client-go/v2/api/http"
	"github.com/influxdata/influxdb-client-go/v2/api/query"
	"github.com/influxdata/influxdb-client-go/v2/domain"
	"github.com/influxdata/influxdb-client-go/v2/internal/log"
	ilog "github.com/influxdata/influxdb-client-go/v2/log"
)

const (
	stringDatatype       = "string"
	doubleDatatype       = "double"
	boolDatatype         = "boolean"
	longDatatype         = "long"
	uLongDatatype        = "unsignedLong"
	durationDatatype     = "duration"
	base64BinaryDataType = "base64Binary"
	timeDatatypeRFC      = "dateTime:RFC3339"
	timeDatatypeRFCNano  = "dateTime:RFC3339Nano"
)

// QueryAPI provides methods for performing synchronously flux query against InfluxDB server.
//
// Flux query can contain reference to parameters, which must be passed via queryParams.
// it can be a struct or map. Param values can be only simple types or time.Time.
// The name of a struct field or a map key (must be a string) will be a param name.
// The name of the parameter represented by a struct field can be specified by JSON annotation:
//
//	type Condition struct {
//	    Start  time.Time  `json:"start"`
//	    Field  string     `json:"field"`
//	    Value  float64    `json:"value"`
//		}
//
//	 Parameters are then accessed via the Flux params object:
//
//	 query:= `from(bucket: "environment")
//			|> range(start: time(v: params.start))
//			|> filter(fn: (r) => r._measurement == "air")
//			|> filter(fn: (r) => r._field == params.field)
//			|> filter(fn: (r) => r._value > params.value)`
type QueryAPI interface {
	// QueryRaw executes flux query on the InfluxDB server and returns complete query result as a string with table annotations according to dialect
	QueryRaw(ctx context.Context, query string, dialect *domain.Dialect) (string, error)
	// QueryRawWithParams executes flux parametrized query on the InfluxDB server and returns complete query result as a string with table annotations according to dialect
	QueryRawWithParams(ctx context.Context, query string, dialect *domain.Dialect, params interface{}) (string, error)
	// Query executes flux query on the InfluxDB server and returns QueryTableResult which parses streamed response into structures representing flux table parts
	Query(ctx context.Context, query string) (*QueryTableResult, error)
	// QueryWithParams executes flux parametrized query  on the InfluxDB server and returns QueryTableResult which parses streamed response into structures representing flux table parts
	QueryWithParams(ctx context.Context, query string, params interface{}) (*QueryTableResult, error)
}

// NewQueryAPI returns new query client for querying buckets belonging to org
func NewQueryAPI(org string, service http2.Service) QueryAPI {
	return &queryAPI{
		org:         org,
		httpService: service,
	}
}

// QueryTableResult parses streamed flux query response into structures representing flux table parts
// Walking though the result is done by repeatedly calling Next() until returns false.
// Actual flux table info (columns with names, data types, etc) is returned by TableMetadata() method.
// Data are acquired by Record() method.
// Preliminary end can be caused by an error, so when Next() return false, check Err() for an error
type QueryTableResult struct {
	io.Closer
	csvReader     *csv.Reader
	tablePosition int
	tableChanged  bool
	table         *query.FluxTableMetadata
	record        *query.FluxRecord
	err           error
}

// NewQueryTableResult returns new QueryTableResult
func NewQueryTableResult(rawResponse io.ReadCloser) *QueryTableResult {
	csvReader := csv.NewReader(rawResponse)
	csvReader.FieldsPerRecord = -1
	return &QueryTableResult{Closer: rawResponse, csvReader: csvReader}
}

// queryAPI implements QueryAPI interface
type queryAPI struct {
	org         string
	httpService http2.Service
	url         string
	lock        sync.Mutex
}

// queryBody holds the body for an HTTP query request.
type queryBody struct {
	Dialect *domain.Dialect  `json:"dialect,omitempty"`
	Query   string           `json:"query"`
	Type    domain.QueryType `json:"type"`
	Params  interface{}      `json:"params,omitempty"`
}

func (q *queryAPI) QueryRaw(ctx context.Context, query string, dialect *domain.Dialect) (string, error) {
	return q.QueryRawWithParams(ctx, query, dialect, nil)
}

func (q *queryAPI) QueryRawWithParams(ctx context.Context, query string, dialect *domain.Dialect, params interface{}) (string, error) {
	if err := checkParamsType(params); err != nil {
		return "", err
	}
	queryURL, err := q.queryURL()
	if err != nil {
		return "", err
	}
	qr := queryBody{
		Query:   query,
		Type:    domain.QueryTypeFlux,
		Dialect: dialect,
		Params:  params,
	}
	qrJSON, err := json.Marshal(qr)
	if err != nil {
		return "", err
	}
	if log.Level() >= ilog.DebugLevel {
		log.Debugf("Query: %s", qrJSON)
	}
	var body string
	perror := q.httpService.DoPostRequest(ctx, queryURL, bytes.NewReader(qrJSON), func(req *http.Request) {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept-Encoding", "gzip")
	},
		func(resp *http.Response) error {
			if resp.Header.Get("Content-Encoding") == "gzip" {
				resp.Body, err = gzip.NewReader(resp.Body)
				if err != nil {
					return err
				}
			}
			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return err
			}
			body = string(respBody)
			return nil
		})
	if perror != nil {
		return "", perror
	}
	return body, nil
}

// DefaultDialect return flux query Dialect with full annotations (datatype, group, default), header and comma char as a delimiter
func DefaultDialect() *domain.Dialect {
	annotations := []domain.DialectAnnotations{domain.DialectAnnotationsDatatype, domain.DialectAnnotationsGroup, domain.DialectAnnotationsDefault}
	delimiter := ","
	header := true
	return &domain.Dialect{
		Annotations: &annotations,
		Delimiter:   &delimiter,
		Header:      &header,
	}
}

func (q *queryAPI) Query(ctx context.Context, query string) (*QueryTableResult, error) {
	return q.QueryWithParams(ctx, query, nil)
}

func (q *queryAPI) QueryWithParams(ctx context.Context, query string, params interface{}) (*QueryTableResult, error) {
	var queryResult *QueryTableResult
	if err := checkParamsType(params); err != nil {
		return nil, err
	}
	queryURL, err := q.queryURL()
	if err != nil {
		return nil, err
	}
	qr := queryBody{
		Query:   query,
		Type:    domain.QueryTypeFlux,
		Dialect: DefaultDialect(),
		Params:  params,
	}
	qrJSON, err := json.Marshal(qr)
	if err != nil {
		return nil, err
	}
	if log.Level() >= ilog.DebugLevel {
		log.Debugf("Query: %s", qrJSON)
	}
	perror := q.httpService.DoPostRequest(ctx, queryURL, bytes.NewReader(qrJSON), func(req *http.Request) {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept-Encoding", "gzip")
	},
		func(resp *http.Response) error {
			if resp.Header.Get("Content-Encoding") == "gzip" {
				resp.Body, err = gzip.NewReader(resp.Body)
				if err != nil {
					return err
				}
			}
			csvReader := csv.NewReader(resp.Body)
			csvReader.FieldsPerRecord = -1
			queryResult = &QueryTableResult{Closer: resp.Body, csvReader: csvReader}
			return nil
		})
	if perror != nil {
		return queryResult, perror
	}
	return queryResult, nil
}

func (q *queryAPI) queryURL() (string, error) {
	if q.url == "" {
		u, err := url.Parse(q.httpService.ServerAPIURL())
		if err != nil {
			return "", err
		}
		u.Path = path.Join(u.Path, "query")

		params := u.Query()
		params.Set("org", q.org)
		u.RawQuery = params.Encode()
		q.lock.Lock()
		q.url = u.String()
		q.lock.Unlock()
	}
	return q.url, nil
}

// checkParamsType validates the value is struct with simple type fields
// or a map with key as string and value as a simple type
func checkParamsType(p interface{}) error {
	if p == nil {
		return nil
	}
	t := reflect.TypeOf(p)
	v := reflect.ValueOf(p)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
		v = v.Elem()
	}
	if t.Kind() != reflect.Struct && t.Kind() != reflect.Map {
		return fmt.Errorf("cannot use %v as query params", t)
	}
	switch t.Kind() {
	case reflect.Struct:
		fields := reflect.VisibleFields(t)
		for _, f := range fields {
			fv := v.FieldByIndex(f.Index)
			t := getFieldType(fv)
			if !validParamType(t) {
				return fmt.Errorf("cannot use field '%s' of type '%v' as a query param", f.Name, t)
			}

		}
	case reflect.Map:
		key := t.Key()
		if key.Kind() != reflect.String {
			return fmt.Errorf("cannot use map key of type '%v' for query param name", key)
		}
		for _, k := range v.MapKeys() {
			f := v.MapIndex(k)
			t := getFieldType(f)
			if !validParamType(t) {
				return fmt.Errorf("cannot use map value type '%v' as a query param", t)
			}
		}
	}
	return nil
}

// validParamType validates that t is primitive type or string or interface
func validParamType(t reflect.Type) bool {
	return (t.Kind() > reflect.Invalid && t.Kind() < reflect.Complex64) ||
		t.Kind() == reflect.String ||
		t == timeType
}

// TablePosition returns actual flux table position in the result, or -1 if no table was found yet
// Each new table is introduced by an annotation in csv
func (q *QueryTableResult) TablePosition() int {
	if q.table != nil {
		return q.table.Position()
	}
	return -1
}

// TableMetadata returns actual flux table metadata
func (q *QueryTableResult) TableMetadata() *query.FluxTableMetadata {
	return q.table
}

// TableChanged returns true if last call of Next() found also new result table
// Table information is available via TableMetadata method
func (q *QueryTableResult) TableChanged() bool {
	return q.tableChanged
}

// Record returns last parsed flux table data row
// Use Record methods to access value and row properties
func (q *QueryTableResult) Record() *query.FluxRecord {
	return q.record
}

type parsingState int

const (
	parsingStateNormal parsingState = iota
	parsingStateAnnotation
	parsingStateNameRow
	parsingStateError
)

// Next advances to next row in query result.
// During the first time it is called, Next creates also table metadata
// Actual parsed row is available through Record() function
// Returns false in case of end or an error, otherwise true
func (q *QueryTableResult) Next() bool {
	var row []string
	// set closing query in case of preliminary return
	closer := func() {
		if err := q.Close(); err != nil {
			message := err.Error()
			if q.err != nil {
				message = fmt.Sprintf("%s,%s", message, q.err.Error())
			}
			q.err = errors.New(message)
		}
	}
	defer func() {
		closer()
	}()
	parsingState := parsingStateNormal
	q.tableChanged = false
	dataTypeAnnotationFound := false
readRow:
	row, q.err = q.csvReader.Read()
	if q.err == io.EOF {
		q.err = nil
		return false
	}
	if q.err != nil {
		return false
	}

	if len(row) <= 1 {
		goto readRow
	}
	if len(row[0]) > 0 && row[0][0] == '#' {
		if parsingState == parsingStateNormal {
			q.table = query.NewFluxTableMetadata(q.tablePosition)
			q.tablePosition++
			q.tableChanged = true
			for i := range row[1:] {
				q.table.AddColumn(query.NewFluxColumn(i))
			}
			parsingState = parsingStateAnnotation
		}
	}
	if q.table == nil {
		q.err = errors.New("parsing error, annotations not found")
		return false
	}
	if len(row)-1 != len(q.table.Columns()) {
		q.err = fmt.Errorf("parsing error, row has different number of columns than the table: %d vs %d", len(row)-1, len(q.table.Columns()))
		return false
	}
	switch row[0] {
	case "":
		switch parsingState {
		case parsingStateAnnotation:
			if !dataTypeAnnotationFound {
				q.err = errors.New("parsing error, datatype annotation not found")
				return false
			}
			parsingState = parsingStateNameRow
			fallthrough
		case parsingStateNameRow:
			if row[1] == "error" {
				parsingState = parsingStateError
			} else {
				for i, n := range row[1:] {
					if q.table.Column(i) != nil {
						q.table.Column(i).SetName(n)
					}
				}
				parsingState = parsingStateNormal
			}
			goto readRow
		case parsingStateError:
			var message string
			if len(row) > 1 && len(row[1]) > 0 {
				message = row[1]
			} else {
				message = "unknown query error"
			}
			reference := ""
			if len(row) > 2 && len(row[2]) > 0 {
				reference = fmt.Sprintf(",%s", row[2])
			}
			q.err = fmt.Errorf("%s%s", message, reference)
			return false
		}
		values := make(map[string]interface{})
		for i, v := range row[1:] {
			if q.table.Column(i) != nil {
				values[q.table.Column(i).Name()], q.err = toValue(stringTernary(v, q.table.Column(i).DefaultValue()), q.table.Column(i).DataType(), q.table.Column(i).Name())
				if q.err != nil {
					return false
				}
			}
		}
		q.record = query.NewFluxRecord(q.table.Position(), values)
	case "#datatype":
		dataTypeAnnotationFound = true
		for i, d := range row[1:] {
			if q.table.Column(i) != nil {
				q.table.Column(i).SetDataType(d)
			}
		}
		goto readRow
	case "#group":
		for i, g := range row[1:] {
			if q.table.Column(i) != nil {
				q.table.Column(i).SetGroup(g == "true")
			}
		}
		goto readRow
	case "#default":
		for i, c := range row[1:] {
			if q.table.Column(i) != nil {
				q.table.Column(i).SetDefaultValue(c)
			}
		}
		goto readRow
	}
	// don't close query
	closer = func() {}
	return true
}

// Err returns an error raised during flux query response parsing
func (q *QueryTableResult) Err() error {
	return q.err
}

// Close reads remaining data and closes underlying Closer
func (q *QueryTableResult) Close() error {
	var err error
	for err == nil {
		_, err = q.csvReader.Read()
	}
	return q.Closer.Close()
}

// stringTernary returns a if not empty, otherwise b
func stringTernary(a, b string) string {
	if a == "" {
		return b
	}
	return a
}

// toValues converts s into type by t
func toValue(s, t, name string) (interface{}, error) {
	if s == "" {
		return nil, nil
	}
	switch t {
	case stringDatatype:
		return s, nil
	case timeDatatypeRFC:
		return time.Parse(time.RFC3339, s)
	case timeDatatypeRFCNano:
		return time.Parse(time.RFC3339Nano, s)
	case durationDatatype:
		return time.ParseDuration(s)
	case doubleDatatype:
		return strconv.ParseFloat(s, 64)
	case boolDatatype:
		if strings.ToLower(s) == "false" {
			return false, nil
		}
		return true, nil
	case longDatatype:
		return strconv.ParseInt(s, 10, 64)
	case uLongDatatype:
		return strconv.ParseUint(s, 10, 64)
	case base64BinaryDataType:
		return base64.StdEncoding.DecodeString(s)
	default:
		return nil, fmt.Errorf("%s has unknown data type %s", name, t)
	}
}
