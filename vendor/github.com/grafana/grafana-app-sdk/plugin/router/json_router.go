package router

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/plugin"
)

const (
	// HeaderContentType is the header key for content type.
	HeaderContentType = "Content-Type"
)

const (
	// ContentTypeJSON is the content-type header value for JSON content.
	ContentTypeJSON = "application/json"
)

// JSONRequest is the request that is parsed by JSONRouter and passed to its handlers.
// It contains all information that is available from the route (e.g. vars) or plugin request or plugin context.
type JSONRequest struct {
	Method  string
	URL     url.URL
	Vars    Vars
	Headers http.Header
	Context backend.PluginContext
	Body    io.Reader
}

// JSONResponse is the response that is returned by JSONRouter handlers.
// It is serialized to JSON by the router and sent to the requester.
// Therefore the response must be a JSON-marshalable value, or nil.
type JSONResponse any

// JSONErrorResponse is the default response format used to render errors from JSON route handlers.
type JSONErrorResponse struct {
	Code  int    `json:"code"`
	Error string `json:"error"`
}

// JSONHandlerFunc is a JSON request handler, that takes a context and request and returns a response or an error.
// It's valid to return a response and a nil error, an error and a nil response OR a nil response and a nil error.
// In the latter case the response is interpreted as a successful 204 No Content response.
type JSONHandlerFunc func(context.Context, JSONRequest) (JSONResponse, error)

// JSONResourceHandler is a resource handler that uses the following routing convention:
//
// * GET     "/{name}"       - `List` all resources "name"
// * POST    "/{name}"       - `Create` a new resource "name"
// * GET     "/{name}/{id}"  - `Read` a resource "name" with id "id"
// * PUT     "/{name}/{id}"  - `Update` a resource "name" with id "id"
// * DELETE  "/{name}/{id}"  - `Delete` a resource "name" with id "id"
type JSONResourceHandler struct {
	Create JSONHandlerFunc
	Read   JSONHandlerFunc
	Update JSONHandlerFunc
	Delete JSONHandlerFunc
	List   JSONHandlerFunc
}

// JSONErrorHandler is a function that takes an error and transforms it into an HTTP code and JSON response pair.
// It is used by JSONRouter when processing errors returned by route handlers.
type JSONErrorHandler func(err plugin.Error) (int, JSONResponse)

// JSONRouter is a router that assumes that responses are JSON-encoded messages and errors carry response codes.
// JSON router will automatically serialize responses to JSON and send them to the requester,
// or send back erroneous responses with codes passed in the error (or fall back to 500 if no code is found).
// For errors it will return a JSON response with error code and err.Error() message.
// For 500 errors the message will be a generic "internal server error" message.
type JSONRouter struct {
	*Subrouter
	errHandler JSONErrorHandler
}

// NewJSONRouter returns a new JSONRouter with a logger.
func NewJSONRouter() *JSONRouter {
	return NewJSONRouterWithErrorHandler(nil)
}

// NewJSONRouterWithErrorHandler returns a new JSONRouter with a logger and a custom error handler.
func NewJSONRouterWithErrorHandler(errHandler JSONErrorHandler) *JSONRouter {
	return &JSONRouter{
		Subrouter:  NewRouter().Subrouter(""), // TODO: find a nicer solution to work with routers / subrouters.
		errHandler: errHandler,
	}
}

// Subroute creates a new JSONRouter with all routes prefixed by path.
func (j *JSONRouter) Subroute(path string) *JSONRouter {
	return &JSONRouter{
		Subrouter:  j.Router.Subrouter(path),
		errHandler: j.errHandler,
	}
}

// SubrouteWithErrorHandler creates a new JSONRouter with all routes prefixed by path,
// and overrides the router error handler with given one.
func (j *JSONRouter) SubrouteWithErrorHandler(path string, errHandler JSONErrorHandler) *JSONRouter {
	return &JSONRouter{
		Subrouter:  j.Router.Subrouter(path),
		errHandler: errHandler,
	}
}

// HandleResource creates routes for a CRUD resource handler handler for a resource name.
// For all successful requests it will return 200 OK, except for Create route, which will return 201,
// and Delete route which will always discard responses (so your handler doesn't have to return one) and return 204.
func (j *JSONRouter) HandleResource(name string, handler JSONResourceHandler) []*RouteHandler {
	res := make([]*RouteHandler, 0, 5)
	path := "/" + name
	idPath := path + "/{id}"

	res = append(res, j.Handle(path, handler.List, http.MethodGet))
	res = append(res, j.HandleWithCode(path, handler.Create, http.StatusCreated, http.MethodPost))
	res = append(res, j.Handle(idPath, handler.Read, http.MethodGet))
	res = append(res, j.Handle(idPath, handler.Update, http.MethodPut))
	res = append(res, j.HandleWithCode(idPath, func(ctx context.Context, j JSONRequest) (JSONResponse, error) {
		// Make sure we discard the response.
		_, err := handler.Delete(ctx, j)
		return nil, err
	}, http.StatusNoContent, http.MethodDelete))

	return res
}

// Handle attaches a new handler to the route with path and methods methods.
// If no methods are specified, GET will be used instead.
func (j *JSONRouter) Handle(path string, handler JSONHandlerFunc, methods ...string) *RouteHandler {
	return j.HandleWithCode(path, handler, http.StatusOK, methods...)
}

// HandleWithCode works like Handle but allows specifying the response code that's returned for successful requests.
func (j *JSONRouter) HandleWithCode(path string, handler JSONHandlerFunc, okCode int, methods ...string) *RouteHandler {
	return j.Router.Handle(path, j.WrapHandlerFunc(handler, okCode), methods...)
}

// WrapHandlerFunc wraps a JSONHandlerFunc and returns a regular HandlerFunc.
// The wrapper will take care of parsing the request and handling the response.
// `okCode` will be used for successful response codes.
func (j *JSONRouter) WrapHandlerFunc(handler JSONHandlerFunc, okCode int) HandlerFunc {
	return func(ctx context.Context, r *backend.CallResourceRequest, s backend.CallResourceResponseSender) {
		u, err := url.Parse(r.URL)
		if err != nil {
			j.sendErr(ctx, s, err)
			return
		}

		req := JSONRequest{
			Method:  r.Method,
			URL:     *u,
			Vars:    VarsFromCtx(ctx),
			Headers: http.Header(r.Headers),
			Body:    bytes.NewBuffer(r.Body),
			Context: r.PluginContext,
		}

		res, err := handler(ctx, req)
		if err != nil {
			j.sendErr(ctx, s, err)
			return
		}

		j.sendRes(ctx, s, okCode, res)
	}
}

func (j *JSONRouter) sendErr(ctx context.Context, s backend.CallResourceResponseSender, err error) {
	logging.FromContext(ctx).Error(
		"error processing backend plugin request",
		"error", err.Error(),
	)

	uerr := plugin.FromError(err)

	var (
		code int
		res  JSONResponse
	)
	if j.errHandler != nil {
		// If there's a custom error handler, hand off the error to it.
		code, res = j.errHandler(uerr)
	} else {
		code = uerr.Code
		res = &JSONErrorResponse{
			Code:  uerr.Code,
			Error: uerr.CleanMessage(),
		}
	}

	j.sendRes(ctx, s, code, res)
}

func (*JSONRouter) sendRes(ctx context.Context, s backend.CallResourceResponseSender, code int, res JSONResponse) {
	var r backend.CallResourceResponse

	if res != nil { // nolint: gocritic
		buf := &bytes.Buffer{}

		if err := json.NewEncoder(buf).Encode(res); err == nil {
			r.Status = code
			r.Body = buf.Bytes()
		} else {
			r.Status = http.StatusInternalServerError
			r.Body = []byte(`{"code":500,"error":"internal server error"}`)
		}

		if r.Headers == nil {
			r.Headers = make(map[string][]string, 1)
		}

		r.Headers[HeaderContentType] = []string{ContentTypeJSON}
	} else if code >= 200 && code <= 299 {
		r.Status = http.StatusNoContent // Overwrite 2xx with 204 because there's no body
	} else {
		r.Status = code // We don't have a body, but we still want the code (e.g. an empty 4xx / 5xx response)
	}

	if err := s.Send(&r); err != nil {
		logging.FromContext(ctx).Error("error sending backend response", "error", err)
	}
}
