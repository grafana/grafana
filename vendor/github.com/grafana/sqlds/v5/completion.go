package sqlds

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	schemas = "schemas"
	tables  = "tables"
	columns = "columns"
)

var (
	// ErrorNotImplemented is returned if the function is not implemented by the provided Driver (the Completable pointer is nil)
	ErrorNotImplemented = errors.New("not implemented")
	// ErrorWrongOptions when trying to parse Options with a invalid JSON
	ErrorWrongOptions = errors.New("error reading query options")
)

// Options are used to query schemas, tables and columns. They will be encoded in the request body (e.g. {"database": "mydb"})
type Options map[string]string

// Completable will be used to autocomplete Tables Schemas and Columns for SQL languages
type Completable interface {
	Schemas(ctx context.Context, options Options) ([]string, error)
	Tables(ctx context.Context, options Options) ([]string, error)
	Columns(ctx context.Context, options Options) ([]string, error)
}

func handleError(rw http.ResponseWriter, err error) {
	rw.WriteHeader(http.StatusBadRequest)
	_, err = rw.Write([]byte(err.Error()))
	if err != nil {
		backend.Logger.Error(err.Error())
	}
}

func sendResourceResponse(rw http.ResponseWriter, res []string) {
	rw.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(rw).Encode(res); err != nil {
		handleError(rw, err)
		return
	}
}

func (ds *SQLDatasource) getResources(rtype string) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		if ds.Completable == nil {
			handleError(rw, ErrorNotImplemented)
			return
		}

		options := Options{}
		if req.Body != nil {
			err := json.NewDecoder(req.Body).Decode(&options)
			if err != nil {
				handleError(rw, err)
				return
			}
		}

		var res []string
		var err error
		switch rtype {
		case schemas:
			res, err = ds.Completable.Schemas(req.Context(), options)
		case tables:
			res, err = ds.Completable.Tables(req.Context(), options)
		case columns:
			res, err = ds.Completable.Columns(req.Context(), options)
		default:
			err = fmt.Errorf("unexpected resource type: %s", rtype)
		}
		if err != nil {
			handleError(rw, err)
			return
		}

		sendResourceResponse(rw, res)
	}
}

func (ds *SQLDatasource) registerRoutes(mux *http.ServeMux) error {
	defaultRoutes := map[string]func(http.ResponseWriter, *http.Request){
		"/tables":  ds.getResources(tables),
		"/schemas": ds.getResources(schemas),
		"/columns": ds.getResources(columns),
	}
	for route, handler := range defaultRoutes {
		mux.HandleFunc(route, handler)
	}
	for route, handler := range ds.CustomRoutes {
		if _, ok := defaultRoutes[route]; ok {
			return fmt.Errorf("unable to redefine %s, use the Completable interface instead", route)
		}
		mux.HandleFunc(route, handler)
	}
	return nil
}

func ParseOptions(rawOptions json.RawMessage) (Options, error) {
	args := Options{}
	if rawOptions != nil {
		err := json.Unmarshal(rawOptions, &args)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrorWrongOptions, err)
		}
	}
	return args, nil
}
