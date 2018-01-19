// Copyright 2017, Google LLC All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// AUTO-GENERATED CODE. DO NOT EDIT.

package spanner

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	spannerpb "google.golang.org/genproto/googleapis/spanner/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// CallOptions contains the retry settings for each method of Client.
type CallOptions struct {
	CreateSession       []gax.CallOption
	GetSession          []gax.CallOption
	ListSessions        []gax.CallOption
	DeleteSession       []gax.CallOption
	ExecuteSql          []gax.CallOption
	ExecuteStreamingSql []gax.CallOption
	Read                []gax.CallOption
	StreamingRead       []gax.CallOption
	BeginTransaction    []gax.CallOption
	Commit              []gax.CallOption
	Rollback            []gax.CallOption
}

func defaultClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("spanner.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultCallOptions() *CallOptions {
	retry := map[[2]string][]gax.CallOption{
		{"default", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    1000 * time.Millisecond,
					Max:        32000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
		{"long_running", "long_running"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    1000 * time.Millisecond,
					Max:        32000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
	}
	return &CallOptions{
		CreateSession:       retry[[2]string{"default", "idempotent"}],
		GetSession:          retry[[2]string{"default", "idempotent"}],
		ListSessions:        retry[[2]string{"default", "idempotent"}],
		DeleteSession:       retry[[2]string{"default", "idempotent"}],
		ExecuteSql:          retry[[2]string{"default", "idempotent"}],
		ExecuteStreamingSql: retry[[2]string{"default", "non_idempotent"}],
		Read:                retry[[2]string{"default", "idempotent"}],
		StreamingRead:       retry[[2]string{"default", "non_idempotent"}],
		BeginTransaction:    retry[[2]string{"default", "idempotent"}],
		Commit:              retry[[2]string{"long_running", "long_running"}],
		Rollback:            retry[[2]string{"default", "idempotent"}],
	}
}

// Client is a client for interacting with Cloud Spanner API.
type Client struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	client spannerpb.SpannerClient

	// The call options for this service.
	CallOptions *CallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewClient creates a new spanner client.
//
// Cloud Spanner API
//
// The Cloud Spanner API can be used to manage sessions and execute
// transactions on data stored in Cloud Spanner databases.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &Client{
		conn:        conn,
		CallOptions: defaultCallOptions(),

		client: spannerpb.NewSpannerClient(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *Client) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *Client) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *Client) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// DatabasePath returns the path for the database resource.
func DatabasePath(project, instance, database string) string {
	return "" +
		"projects/" +
		project +
		"/instances/" +
		instance +
		"/databases/" +
		database +
		""
}

// SessionPath returns the path for the session resource.
func SessionPath(project, instance, database, session string) string {
	return "" +
		"projects/" +
		project +
		"/instances/" +
		instance +
		"/databases/" +
		database +
		"/sessions/" +
		session +
		""
}

// CreateSession creates a new session. A session can be used to perform
// transactions that read and/or modify data in a Cloud Spanner database.
// Sessions are meant to be reused for many consecutive
// transactions.
//
// Sessions can only execute one transaction at a time. To execute
// multiple concurrent read-write/write-only transactions, create
// multiple sessions. Note that standalone reads and queries use a
// transaction internally, and count toward the one transaction
// limit.
//
// Cloud Spanner limits the number of sessions that can exist at any given
// time; thus, it is a good idea to delete idle and/or unneeded sessions.
// Aside from explicit deletes, Cloud Spanner can delete sessions for which no
// operations are sent for more than an hour. If a session is deleted,
// requests to it return NOT_FOUND.
//
// Idle sessions can be kept alive by sending a trivial SQL query
// periodically, e.g., "SELECT 1".
func (c *Client) CreateSession(ctx context.Context, req *spannerpb.CreateSessionRequest, opts ...gax.CallOption) (*spannerpb.Session, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateSession[0:len(c.CallOptions.CreateSession):len(c.CallOptions.CreateSession)], opts...)
	var resp *spannerpb.Session
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.CreateSession(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GetSession gets a session. Returns NOT_FOUND if the session does not exist.
// This is mainly useful for determining whether a session is still
// alive.
func (c *Client) GetSession(ctx context.Context, req *spannerpb.GetSessionRequest, opts ...gax.CallOption) (*spannerpb.Session, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetSession[0:len(c.CallOptions.GetSession):len(c.CallOptions.GetSession)], opts...)
	var resp *spannerpb.Session
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.GetSession(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListSessions lists all sessions in a given database.
func (c *Client) ListSessions(ctx context.Context, req *spannerpb.ListSessionsRequest, opts ...gax.CallOption) *SessionIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListSessions[0:len(c.CallOptions.ListSessions):len(c.CallOptions.ListSessions)], opts...)
	it := &SessionIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*spannerpb.Session, string, error) {
		var resp *spannerpb.ListSessionsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListSessions(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Sessions, resp.NextPageToken, nil
	}
	fetch := func(pageSize int, pageToken string) (string, error) {
		items, nextPageToken, err := it.InternalFetch(pageSize, pageToken)
		if err != nil {
			return "", err
		}
		it.items = append(it.items, items...)
		return nextPageToken, nil
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(fetch, it.bufLen, it.takeBuf)
	return it
}

// DeleteSession ends a session, releasing server resources associated with it.
func (c *Client) DeleteSession(ctx context.Context, req *spannerpb.DeleteSessionRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteSession[0:len(c.CallOptions.DeleteSession):len(c.CallOptions.DeleteSession)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.client.DeleteSession(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// ExecuteSql executes an SQL query, returning all rows in a single reply. This
// method cannot be used to return a result set larger than 10 MiB;
// if the query yields more data than that, the query fails with
// a FAILED_PRECONDITION error.
//
// Queries inside read-write transactions might return ABORTED. If
// this occurs, the application should restart the transaction from
// the beginning. See [Transaction][google.spanner.v1.Transaction] for more details.
//
// Larger result sets can be fetched in streaming fashion by calling
// [ExecuteStreamingSql][google.spanner.v1.Spanner.ExecuteStreamingSql] instead.
func (c *Client) ExecuteSql(ctx context.Context, req *spannerpb.ExecuteSqlRequest, opts ...gax.CallOption) (*spannerpb.ResultSet, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ExecuteSql[0:len(c.CallOptions.ExecuteSql):len(c.CallOptions.ExecuteSql)], opts...)
	var resp *spannerpb.ResultSet
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.ExecuteSql(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ExecuteStreamingSql like [ExecuteSql][google.spanner.v1.Spanner.ExecuteSql], except returns the result
// set as a stream. Unlike [ExecuteSql][google.spanner.v1.Spanner.ExecuteSql], there
// is no limit on the size of the returned result set. However, no
// individual row in the result set can exceed 100 MiB, and no
// column value can exceed 10 MiB.
func (c *Client) ExecuteStreamingSql(ctx context.Context, req *spannerpb.ExecuteSqlRequest, opts ...gax.CallOption) (spannerpb.Spanner_ExecuteStreamingSqlClient, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ExecuteStreamingSql[0:len(c.CallOptions.ExecuteStreamingSql):len(c.CallOptions.ExecuteStreamingSql)], opts...)
	var resp spannerpb.Spanner_ExecuteStreamingSqlClient
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.ExecuteStreamingSql(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Read reads rows from the database using key lookups and scans, as a
// simple key/value style alternative to
// [ExecuteSql][google.spanner.v1.Spanner.ExecuteSql].  This method cannot be used to
// return a result set larger than 10 MiB; if the read matches more
// data than that, the read fails with a FAILED_PRECONDITION
// error.
//
// Reads inside read-write transactions might return ABORTED. If
// this occurs, the application should restart the transaction from
// the beginning. See [Transaction][google.spanner.v1.Transaction] for more details.
//
// Larger result sets can be yielded in streaming fashion by calling
// [StreamingRead][google.spanner.v1.Spanner.StreamingRead] instead.
func (c *Client) Read(ctx context.Context, req *spannerpb.ReadRequest, opts ...gax.CallOption) (*spannerpb.ResultSet, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Read[0:len(c.CallOptions.Read):len(c.CallOptions.Read)], opts...)
	var resp *spannerpb.ResultSet
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.Read(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// StreamingRead like [Read][google.spanner.v1.Spanner.Read], except returns the result set as a
// stream. Unlike [Read][google.spanner.v1.Spanner.Read], there is no limit on the
// size of the returned result set. However, no individual row in
// the result set can exceed 100 MiB, and no column value can exceed
// 10 MiB.
func (c *Client) StreamingRead(ctx context.Context, req *spannerpb.ReadRequest, opts ...gax.CallOption) (spannerpb.Spanner_StreamingReadClient, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.StreamingRead[0:len(c.CallOptions.StreamingRead):len(c.CallOptions.StreamingRead)], opts...)
	var resp spannerpb.Spanner_StreamingReadClient
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.StreamingRead(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// BeginTransaction begins a new transaction. This step can often be skipped:
// [Read][google.spanner.v1.Spanner.Read], [ExecuteSql][google.spanner.v1.Spanner.ExecuteSql] and
// [Commit][google.spanner.v1.Spanner.Commit] can begin a new transaction as a
// side-effect.
func (c *Client) BeginTransaction(ctx context.Context, req *spannerpb.BeginTransactionRequest, opts ...gax.CallOption) (*spannerpb.Transaction, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.BeginTransaction[0:len(c.CallOptions.BeginTransaction):len(c.CallOptions.BeginTransaction)], opts...)
	var resp *spannerpb.Transaction
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.BeginTransaction(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Commit commits a transaction. The request includes the mutations to be
// applied to rows in the database.
//
// Commit might return an ABORTED error. This can occur at any time;
// commonly, the cause is conflicts with concurrent
// transactions. However, it can also happen for a variety of other
// reasons. If Commit returns ABORTED, the caller should re-attempt
// the transaction from the beginning, re-using the same session.
func (c *Client) Commit(ctx context.Context, req *spannerpb.CommitRequest, opts ...gax.CallOption) (*spannerpb.CommitResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Commit[0:len(c.CallOptions.Commit):len(c.CallOptions.Commit)], opts...)
	var resp *spannerpb.CommitResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.Commit(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Rollback rolls back a transaction, releasing any locks it holds. It is a good
// idea to call this for any transaction that includes one or more
// [Read][google.spanner.v1.Spanner.Read] or [ExecuteSql][google.spanner.v1.Spanner.ExecuteSql] requests and
// ultimately decides not to commit.
//
// Rollback returns OK if it successfully aborts the transaction, the
// transaction was already aborted, or the transaction is not
// found. Rollback never returns ABORTED.
func (c *Client) Rollback(ctx context.Context, req *spannerpb.RollbackRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Rollback[0:len(c.CallOptions.Rollback):len(c.CallOptions.Rollback)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.client.Rollback(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// SessionIterator manages a stream of *spannerpb.Session.
type SessionIterator struct {
	items    []*spannerpb.Session
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*spannerpb.Session, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *SessionIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *SessionIterator) Next() (*spannerpb.Session, error) {
	var item *spannerpb.Session
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *SessionIterator) bufLen() int {
	return len(it.items)
}

func (it *SessionIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
