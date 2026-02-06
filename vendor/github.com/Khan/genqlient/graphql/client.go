package graphql

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/vektah/gqlparser/v2/gqlerror"
)

// Client is the interface that the generated code calls into to actually make
// requests.
type Client interface {
	// MakeRequest must make a request to the client's GraphQL API.
	//
	// ctx is the context that should be used to make this request.  If context
	// is disabled in the genqlient settings, this will be set to
	// context.Background().
	//
	// req contains the data to be sent to the GraphQL server.  Typically GraphQL
	// APIs will expect it to simply be marshalled as JSON, but MakeRequest may
	// customize this.
	//
	// resp is the Response object into which the server's response will be
	// unmarshalled. Typically GraphQL APIs will return JSON which can be
	// unmarshalled directly into resp, but MakeRequest can customize it.
	// If the response contains an error, this must also be returned by
	// MakeRequest.  The field resp.Data will be prepopulated with a pointer
	// to an empty struct of the correct generated type (e.g. MyQueryResponse).
	MakeRequest(
		ctx context.Context,
		req *Request,
		resp *Response,
	) error
}

type WebSocketClient interface {
	// Start must open a webSocket connection and subscribe to an endpoint
	// of the client's GraphQL API.
	//
	// errChan is a channel on which are sent the errors of webSocket
	// communication. It will be closed when calling the `Close()` method.
	//
	// err is any error that occurs when setting up the webSocket connection.
	Start(ctx context.Context) (errChan chan error, err error)

	// Close must close the webSocket connection and close the error channel.
	// If no connection was started, Close is a no-op
	Close() error

	// Subscribe must subscribe to an endpoint of the client's GraphQL API.
	//
	// req contains the data to be sent to the GraphQL server. Will be marshalled
	// into JSON bytes.
	//
	// interfaceChan is a channel used to send the data that arrives via the
	// webSocket connection (it is the channel that is passed to `forwardDataFunc`).
	//
	// forwardDataFunc is the function that will cast the received interface into
	// the valid type for the subscription's response.
	//
	// Returns a subscriptionID if successful, an error otherwise.
	Subscribe(
		req *Request,
		interfaceChan interface{},
		forwardDataFunc ForwardDataFunction,
	) (string, error)

	// Unsubscribe must unsubscribe from an endpoint of the client's GraphQL API.
	Unsubscribe(subscriptionID string) error
}

// ForwardDataFunction is a part of the WebSocketClient interface, see
// [WebSocketClient.Subscribe] for details.
type ForwardDataFunction func(interfaceChan interface{}, jsonRawMsg json.RawMessage) error

type client struct {
	httpClient Doer
	endpoint   string
	method     string
}

// NewClient returns a [Client] which makes requests to the given endpoint,
// suitable for most users.
//
// The client makes POST requests to the given GraphQL endpoint using standard
// GraphQL HTTP-over-JSON transport.  It will use the given [http.Client], or
// [http.DefaultClient] if a nil client is passed.
//
// The client does not support subscriptions, and will return an error if passed
// a request that attempts one.
//
// The typical method of adding authentication headers is to wrap the client's
// [http.Transport] to add those headers.  See [example/main.go] for an
// example.
//
// [example/main.go]: https://github.com/Khan/genqlient/blob/main/example/main.go#L12-L20
func NewClient(endpoint string, httpClient Doer) Client {
	return newClient(endpoint, httpClient, http.MethodPost)
}

// NewClientUsingGet returns a [Client] which makes GET requests to the given
// endpoint suitable for most users who wish to make GET requests instead of
// POST.
//
// The client makes GET requests to the given GraphQL endpoint using a GET
// query, with the query, operation name and variables encoded as URL
// parameters.  It will use the given [http.Client], or [http.DefaultClient] if
// a nil client is passed.
//
// The client does not support mutations nor subscriptions, and will return an
// error if passed a request that attempts one.
//
// The typical method of adding authentication headers is to wrap the client's
// [http.Transport] to add those headers.  See [example/main.go] for an
// example.
//
// [example/main.go]: https://github.com/Khan/genqlient/blob/main/example/main.go#L12-L20
func NewClientUsingGet(endpoint string, httpClient Doer) Client {
	return newClient(endpoint, httpClient, http.MethodGet)
}

type WebSocketOption func(*webSocketClient)

// NewClientUsingWebSocket returns a [WebSocketClient] which makes subscription requests
// to the given endpoint using webSocket.
//
// The client does not support queries nor mutations, and will return an error
// if passed a request that attempts one.
func NewClientUsingWebSocket(endpoint string, wsDialer Dialer, opts ...WebSocketOption) WebSocketClient {
	client := &webSocketClient{
		Dialer:        wsDialer,
		header:        http.Header{},
		errChan:       make(chan error),
		endpoint:      endpoint,
		subscriptions: subscriptionMap{map_: make(map[string]subscription)},
	}

	for _, opt := range opts {
		opt(client)
	}

	if client.header.Get("Sec-WebSocket-Protocol") == "" {
		client.header.Add("Sec-WebSocket-Protocol", "graphql-transport-ws")
	}

	return client
}

// WithConnectionParams sets up connection params to be sent to the server
// during the initial connection handshake.
func WithConnectionParams(connParams map[string]interface{}) WebSocketOption {
	return func(ws *webSocketClient) {
		ws.connParams = connParams
	}
}

// WithWebsocketHeader sets a header to be sent to the server.
func WithWebsocketHeader(header http.Header) WebSocketOption {
	return func(ws *webSocketClient) {
		ws.header = header
	}
}

func newClient(endpoint string, httpClient Doer, method string) Client {
	if httpClient == nil || httpClient == (*http.Client)(nil) {
		httpClient = http.DefaultClient
	}
	return &client{httpClient, endpoint, method}
}

// Doer encapsulates the methods from [*http.Client] needed by [Client].
// The methods should have behavior to match that of [*http.Client]
// (or mocks for the same).
type Doer interface {
	Do(*http.Request) (*http.Response, error)
}

// Dialer encapsulates DialContext method and is similar to [github.com/gorilla/websocket]
// [*websocket.Dialer] method
type Dialer interface {
	DialContext(ctx context.Context, urlStr string, requestHeader http.Header) (WSConn, error)
}

// WSConn encapsulates basic methods for a webSocket connection, taking model on
// [github.com/gorilla/websocket] [*websocket.Conn]
type WSConn interface {
	Close() error
	WriteMessage(messageType int, data []byte) error
	ReadMessage() (messageType int, p []byte, err error)
}

// Request contains all the values required to build queries executed by
// the [Client].
//
// Typically, GraphQL APIs will accept a JSON payload of the form
//
//	{"query": "query myQuery { ... }", "variables": {...}}`
//
// and Request marshals to this format.  However, MakeRequest may
// marshal the data in some other way desired by the backend.
type Request struct {
	// The literal string representing the GraphQL query, e.g.
	// `query myQuery { myField }`.
	Query string `json:"query"`
	// A JSON-marshalable value containing the variables to be sent
	// along with the query, or nil if there are none.
	Variables interface{} `json:"variables,omitempty"`
	// The GraphQL operation name. The server typically doesn't
	// require this unless there are multiple queries in the
	// document, but genqlient sets it unconditionally anyway.
	OpName string `json:"operationName"`
}

type BaseResponse[T any] struct {
	Data       T                      `json:"data"`
	Extensions map[string]interface{} `json:"extensions,omitempty"`
	Errors     gqlerror.List          `json:"errors,omitempty"`
}

// Response that contains data returned by the GraphQL API.
//
// Typically, GraphQL APIs will return a JSON payload of the form
//
//	{"data": {...}, "errors": {...}}
//
// It may additionally contain a key named "extensions", that
// might hold GraphQL protocol extensions. Extensions and Errors
// are optional, depending on the values returned by the server.
type Response BaseResponse[any]

func (c *client) MakeRequest(ctx context.Context, req *Request, resp *Response) error {
	var httpReq *http.Request
	var err error
	if c.method == http.MethodGet {
		httpReq, err = c.createGetRequest(req)
	} else {
		httpReq, err = c.createPostRequest(req)
	}

	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	if ctx != nil {
		httpReq = httpReq.WithContext(ctx)
	}

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		var respBody []byte
		respBody, err = io.ReadAll(httpResp.Body)
		if err != nil {
			respBody = []byte(fmt.Sprintf("<unreadable: %v>", err))
		}

		var gqlResp Response
		if err = json.Unmarshal(respBody, &gqlResp); err != nil {
			return &HTTPError{
				Response: Response{
					Errors: gqlerror.List{&gqlerror.Error{Message: string(respBody)}},
				},
				StatusCode: httpResp.StatusCode,
			}
		}

		return &HTTPError{
			Response:   gqlResp,
			StatusCode: httpResp.StatusCode,
		}
	}

	err = json.NewDecoder(httpResp.Body).Decode(resp)
	if err != nil {
		return err
	}
	if len(resp.Errors) > 0 {
		return resp.Errors
	}
	return nil
}

func (c *client) createPostRequest(req *Request) (*http.Request, error) {
	if req.Query != "" {
		if strings.HasPrefix(strings.TrimSpace(req.Query), "subscription") {
			return nil, errors.New("client does not support subscriptions")
		}
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest(
		c.method,
		c.endpoint,
		bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	return httpReq, nil
}

func (c *client) createGetRequest(req *Request) (*http.Request, error) {
	parsedURL, err := url.Parse(c.endpoint)
	if err != nil {
		return nil, err
	}

	queryParams := parsedURL.Query()
	queryUpdated := false

	if req.Query != "" {
		if strings.HasPrefix(strings.TrimSpace(req.Query), "mutation") {
			return nil, errors.New("client does not support mutations")
		}
		if strings.HasPrefix(strings.TrimSpace(req.Query), "subscription") {
			return nil, errors.New("client does not support subscriptions")
		}
		queryParams.Set("query", req.Query)
		queryUpdated = true
	}

	if req.OpName != "" {
		queryParams.Set("operationName", req.OpName)
		queryUpdated = true
	}

	if req.Variables != nil {
		variables, variablesErr := json.Marshal(req.Variables)
		if variablesErr != nil {
			return nil, variablesErr
		}
		queryParams.Set("variables", string(variables))
		queryUpdated = true
	}

	if queryUpdated {
		parsedURL.RawQuery = queryParams.Encode()
	}

	httpReq, err := http.NewRequest(
		c.method,
		parsedURL.String(),
		http.NoBody)
	if err != nil {
		return nil, err
	}

	return httpReq, nil
}
