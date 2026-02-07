package graphql

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/vektah/gqlparser/v2/gqlerror"
)

type (
	OperationMiddleware func(ctx context.Context, next OperationHandler) ResponseHandler
	OperationHandler    func(ctx context.Context) ResponseHandler

	ResponseHandler    func(ctx context.Context) *Response
	ResponseMiddleware func(ctx context.Context, next ResponseHandler) *Response

	Resolver        func(ctx context.Context) (res any, err error)
	FieldMiddleware func(ctx context.Context, next Resolver) (res any, err error)

	RootResolver        func(ctx context.Context) Marshaler
	RootFieldMiddleware func(ctx context.Context, next RootResolver) Marshaler

	RawParams struct {
		Query         string         `json:"query"`
		OperationName string         `json:"operationName"`
		Variables     map[string]any `json:"variables"`
		Extensions    map[string]any `json:"extensions"`
		Headers       http.Header    `json:"headers"`

		ReadTime TraceTiming `json:"-"`
	}

	GraphExecutor interface {
		CreateOperationContext(ctx context.Context, params *RawParams) (*OperationContext, gqlerror.List)
		DispatchOperation(ctx context.Context, opCtx *OperationContext) (ResponseHandler, context.Context)
		DispatchError(ctx context.Context, list gqlerror.List) *Response
	}

	// HandlerExtension adds functionality to the http handler. See the list of possible hook points below
	// Its important to understand the lifecycle of a graphql request and the terminology we use in gqlgen
	// before working with these
	//
	//  +--- REQUEST   POST /graphql --------------------------------------------+
	//  | +- OPERATION query OpName { viewer { name } } -----------------------+ |
	//  | |  RESPONSE  { "data": { "viewer": { "name": "bob" } } }             | |
	//  | +- OPERATION subscription OpName2 { chat { message } } --------------+ |
	//  | |  RESPONSE  { "data": { "chat": { "message": "hello" } } }          | |
	//  | |  RESPONSE  { "data": { "chat": { "message": "byee" } } }           | |
	//  | +--------------------------------------------------------------------+ |
	//  +------------------------------------------------------------------------+
	HandlerExtension interface {
		// ExtensionName should be a CamelCase string version of the extension which may be shown in stats and logging.
		ExtensionName() string
		// Validate is called when adding an extension to the server, it allows validation against the servers schema.
		Validate(schema ExecutableSchema) error
	}

	// OperationParameterMutator is called before creating a request context. allows manipulating the raw query
	// on the way in.
	OperationParameterMutator interface {
		MutateOperationParameters(ctx context.Context, request *RawParams) *gqlerror.Error
	}

	// OperationContextMutator is called after creating the request context, but before executing the root resolver.
	OperationContextMutator interface {
		MutateOperationContext(ctx context.Context, opCtx *OperationContext) *gqlerror.Error
	}

	// OperationInterceptor is called for each incoming query, for basic requests the writer will be invoked once,
	// for subscriptions it will be invoked multiple times.
	OperationInterceptor interface {
		InterceptOperation(ctx context.Context, next OperationHandler) ResponseHandler
	}

	// ResponseInterceptor is called around each graphql operation response. This can be called many times for a single
	// operation the case of subscriptions.
	ResponseInterceptor interface {
		InterceptResponse(ctx context.Context, next ResponseHandler) *Response
	}

	RootFieldInterceptor interface {
		InterceptRootField(ctx context.Context, next RootResolver) Marshaler
	}

	// FieldInterceptor called around each field
	FieldInterceptor interface {
		InterceptField(ctx context.Context, next Resolver) (res any, err error)
	}

	// Transport provides support for different wire level encodings of graphql requests, eg Form, Get, Post, Websocket
	Transport interface {
		Supports(r *http.Request) bool
		Do(w http.ResponseWriter, r *http.Request, exec GraphExecutor)
	}
)

type Status int

func (p *RawParams) AddUpload(upload Upload, key, path string) *gqlerror.Error {
	if !strings.HasPrefix(path, "variables.") {
		return gqlerror.Errorf("invalid operations paths for key %s", key)
	}

	var ptr any = p.Variables
	parts := strings.Split(path, ".")

	// skip the first part (variables) because we started there
	for i, p := range parts[1:] {
		last := i == len(parts)-2
		if ptr == nil {
			return gqlerror.Errorf("path is missing \"variables.\" prefix, key: %s, path: %s", key, path)
		}
		if index, parseNbrErr := strconv.Atoi(p); parseNbrErr == nil {
			if last {
				ptr.([]any)[index] = upload
			} else {
				ptr = ptr.([]any)[index]
			}
		} else {
			if last {
				ptr.(map[string]any)[p] = upload
			} else {
				ptr = ptr.(map[string]any)[p]
			}
		}
	}

	return nil
}
