package dagger

import (
	"context"
	"io"

	"github.com/Khan/genqlient/graphql"
	"github.com/vektah/gqlparser/v2/gqlerror"

	"dagger.io/dagger/engineconn"
	"dagger.io/dagger/querybuilder"
)

// Client is the Dagger Engine Client
type Client struct {
	conn engineconn.EngineConn

	query  *querybuilder.Selection
	client graphql.Client
}

// ClientOpt holds a client option
type ClientOpt interface {
	setClientOpt(cfg *engineconn.Config)
}

type clientOptFunc func(cfg *engineconn.Config)

func (fn clientOptFunc) setClientOpt(cfg *engineconn.Config) {
	fn(cfg)
}

// WithWorkdir sets the engine workdir
func WithWorkdir(path string) ClientOpt {
	return clientOptFunc(func(cfg *engineconn.Config) {
		cfg.Workdir = path
	})
}

// WithLogOutput sets the progress writer
func WithLogOutput(writer io.Writer) ClientOpt {
	return clientOptFunc(func(cfg *engineconn.Config) {
		cfg.LogOutput = writer
	})
}

// WithConn sets the engine connection explicitly
func WithConn(conn engineconn.EngineConn) ClientOpt {
	return clientOptFunc(func(cfg *engineconn.Config) {
		cfg.Conn = conn
	})
}

// WithVersionOverride requests a specific schema version from the engine.
// Calling this may cause the schema to be out-of-sync from the codegen - this
// option is likely *not* desirable for most use cases.
//
// This only has effect when connecting via the CLI, and is only exposed for
// testing purposes.
func WithVersionOverride(version string) ClientOpt {
	return clientOptFunc(func(cfg *engineconn.Config) {
		cfg.VersionOverride = version
	})
}

// WithVerbosity sets the verbosity level for the progress output
func WithVerbosity(level int) ClientOpt {
	return clientOptFunc(func(cfg *engineconn.Config) {
		cfg.Verbosity = level
	})
}

// WithRunnerHost sets the runner host URL for provisioning and connecting to
// an engine.
//
// This only has effect when connecting via the CLI, and is only exposed for
// testing purposes.
func WithRunnerHost(runnerHost string) ClientOpt {
	return clientOptFunc(func(cfg *engineconn.Config) {
		cfg.RunnerHost = runnerHost
	})
}

// Set this additional environment variable in the CLI subprocess for the session
func WithEnvironmentVariable(key, value string) ClientOpt {
	return clientOptFunc(func(cfg *engineconn.Config) {
		cfg.ExtraEnv = append(cfg.ExtraEnv, key+"="+value)
	})
}

// Connect to a Dagger Engine
func Connect(ctx context.Context, opts ...ClientOpt) (*Client, error) {
	cfg := &engineconn.Config{}

	for _, o := range opts {
		o.setClientOpt(cfg)
	}

	conn, err := engineconn.Get(ctx, cfg)
	if err != nil {
		return nil, err
	}
	gql := errorWrappedClient{graphql.NewClient("http://"+conn.Host()+"/query", conn)}

	c := &Client{
		query:  querybuilder.Query().Client(gql),
		client: gql,
		conn:   conn,
	}
	return c, nil
}

// GraphQLClient returns the underlying graphql.Client
func (c *Client) GraphQLClient() graphql.Client {
	return c.client
}

func (c *Client) QueryBuilder() *querybuilder.Selection {
	return c.query
}

// Close the engine connection
func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// Do sends a GraphQL request to the engine
func (c *Client) Do(ctx context.Context, req *Request, resp *Response) error {
	r := graphql.Response{}
	if resp != nil {
		r.Data = resp.Data
		r.Errors = resp.Errors
		r.Extensions = resp.Extensions
	}
	return c.client.MakeRequest(ctx, &graphql.Request{
		Query:     req.Query,
		Variables: req.Variables,
		OpName:    req.OpName,
	}, &r)
}

// Request contains all the values required to build queries executed by
// the graphql.Client.
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

// Response that contains data returned by the GraphQL API.
//
// Typically, GraphQL APIs will return a JSON payload of the form
//
//	{"data": {...}, "errors": {...}}
//
// It may additionally contain a key named "extensions", that
// might hold GraphQL protocol extensions. Extensions and Errors
// are optional, depending on the values returned by the server.
type Response struct {
	Data       interface{}            `json:"data"`
	Extensions map[string]interface{} `json:"extensions,omitempty"`
	Errors     gqlerror.List          `json:"errors,omitempty"`
}

type errorWrappedClient struct {
	graphql.Client
}

func (c errorWrappedClient) MakeRequest(ctx context.Context, req *graphql.Request, resp *graphql.Response) error {
	err := c.Client.MakeRequest(ctx, req, resp)
	if err != nil {
		if e := getCustomError(err); e != nil {
			return e
		}
		return err
	}
	return nil
}
