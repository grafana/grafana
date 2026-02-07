// Copyright 2020-2021 Dolthub, Inc.
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

package sql

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
)

type key uint

const (
	// QueryKey to access query in the context.
	QueryKey key = iota
)

const (
	CurrentDBSessionVar  = "current_database"
	AutoCommitSessionVar = "autocommit"
	// TODO: how does character set and collation get matched?
	characterSetConnectionSysVarName = "character_set_connection"
	characterSetResultsSysVarName    = "character_set_results"
	collationConnectionSysVarName    = "collation_connection"
)

var NoopTracer = trace.NewNoopTracerProvider().Tracer("github.com/dolthub/go-mysql-server/sql")
var _, noopSpan = NoopTracer.Start(context.Background(), "noop")

// Client holds session user information.
type Client struct {
	// User of the session.
	User string
	// Address of the client.
	Address string
	// Capabilities of the client
	Capabilities uint32
}

// Session holds the session data.
type Session interface {
	// Address of the server.
	Address() string
	// Client returns the user of the session.
	Client() Client
	// SetClient returns a new session with the given client.
	SetClient(Client)
	// InitSessionVariableDefault sets this session's default value of the system variable with the given name.
	InitSessionVariableDefault(ctx *Context, sysVarName string, value interface{}) error
	// SetSessionVariable sets the given system variable to the value given for this session.
	SetSessionVariable(ctx *Context, sysVarName string, value interface{}) error
	// InitSessionVariable sets the given system variable to the value given for this session and will allow for
	// initialization of readonly variables.
	InitSessionVariable(ctx *Context, sysVarName string, value interface{}) error
	// SetUserVariable sets the given user variable to the value given for this session, or creates it for this session.
	SetUserVariable(ctx *Context, varName string, value interface{}, typ Type) error
	// GetSessionVariable returns this session's value of the system variable with the given name.
	// To access global scope, use sql.SystemVariables.GetGlobal instead.
	GetSessionVariable(ctx *Context, sysVarName string) (interface{}, error)
	// GetSessionVariableDefault returns this session's default value of the system variable with the given name.
	// To access global scope, use sql.SystemVariables.GetGlobal instead.
	GetSessionVariableDefault(ctx *Context, sysVarName string) (interface{}, error)
	// GetUserVariable returns this session's value of the user variable with the given name, along with its most
	// appropriate type.
	GetUserVariable(ctx *Context, varName string) (Type, interface{}, error)
	// GetAllSessionVariables returns a copy of all session variable values.
	GetAllSessionVariables() map[string]interface{}
	// GetStatusVariable returns the value of the status variable with session scope with the given name.
	// To access global scope, use sql.StatusVariables instead.
	GetStatusVariable(ctx *Context, statVarName string) (interface{}, error)
	// SetStatusVariable sets the value of the status variable with session scope with the given name.
	// To access global scope, use sql.StatusVariables.GetGlobal instead.
	SetStatusVariable(ctx *Context, statVarName string, val interface{}) error
	// GetAllStatusVariables returns a map of all status variables with session scope and their values.
	// To access global scope, use sql.StatusVariables instead.
	GetAllStatusVariables(ctx *Context) map[string]StatusVarValue
	// IncrementStatusVariable increments the value of the status variable by the integer value
	IncrementStatusVariable(ctx *Context, statVarName string, val int)
	// NewStoredProcParam creates a new Stored Procedure Parameter in the Session.
	NewStoredProcParam(name string, param *StoredProcParam) *StoredProcParam
	// GetStoredProcParam finds and returns the Stored Procedure Parameter by the given name.
	GetStoredProcParam(name string) *StoredProcParam
	// SetStoredProcParam sets the Stored Procedure Parameter of the given name to the given val.
	SetStoredProcParam(name string, val any) error
	// GetCurrentDatabase gets the current database for this session
	GetCurrentDatabase() string
	// SetCurrentDatabase sets the current database for this session
	SetCurrentDatabase(dbName string)
	// UseDatabase notifies sessions that a particular database is now the default DB namespace
	UseDatabase(ctx *Context, db Database) error
	// ID returns the unique ID of the connection.
	ID() uint32
	// Warn stores the warning in the session.
	Warn(warn *Warning)
	// Warnings returns a copy of session warnings (from the most recent).
	Warnings() []*Warning
	// ClearWarningCount clears the warning count without clearing the actual warnings.
	ClearWarningCount()
	// ClearWarnings cleans up session warnings.
	ClearWarnings()
	// WarningCount returns a number of session warnings
	WarningCount() uint16
	// LockWarnings prevents the session warnings from being cleared.
	LockWarnings()
	// UnlockWarnings allows the session warnings to be cleared.
	UnlockWarnings()
	// AddLock adds a lock to the set of locks owned by this user which will need to be released if this session terminates
	AddLock(lockName string) error
	// DelLock removes a lock from the set of locks owned by this user
	DelLock(lockName string) error
	// IterLocks iterates through all locks owned by this user
	IterLocks(cb func(name string) error) error
	// SetLastQueryInfoInt sets session-level query info for the key given, applying to the query just executed.
	SetLastQueryInfoInt(key string, value int64)
	// GetLastQueryInfoInt returns the session-level query info for the key given, for the query most recently executed.
	GetLastQueryInfoInt(key string) int64
	// SetLastQueryInfoString sets session-level query info as a string for the key given, applying to the query just executed.
	SetLastQueryInfoString(key string, value string)
	// GetLastQueryInfoString returns the session-level query info as a string for the key given, for the query most recently executed.
	GetLastQueryInfoString(key string) string
	// GetTransaction returns the active transaction, if any
	GetTransaction() Transaction
	// SetTransaction sets the session's transaction
	SetTransaction(tx Transaction)
	// SetIgnoreAutoCommit instructs the session to ignore the value of the @@autocommit variable, or consider it again
	SetIgnoreAutoCommit(ignore bool)
	// GetIgnoreAutoCommit returns whether this session should ignore the @@autocommit variable
	GetIgnoreAutoCommit() bool
	// GetLogger returns the logger for this session, useful if clients want to log messages with the same format / output
	// as the running server. Clients should instantiate their own global logger with formatting options, and session
	// implementations should return the logger to be used for the running server.
	GetLogger() *logrus.Entry
	// SetLogger sets the logger to use for this session, which will always be an extension of the one returned by
	// GetLogger, extended with session information
	SetLogger(*logrus.Entry)
	// GetIndexRegistry returns the index registry for this session
	GetIndexRegistry() *IndexRegistry
	// GetViewRegistry returns the view registry for this session
	GetViewRegistry() *ViewRegistry
	// SetIndexRegistry sets the index registry for this session. Integrators should set an index registry in the event
	// they are using an index driver.
	SetIndexRegistry(*IndexRegistry)
	// SetViewRegistry sets the view registry for this session. Integrators should set a view registry if their database
	// doesn't implement ViewDatabase and they want views created to persist across sessions.
	SetViewRegistry(*ViewRegistry)
	// SetConnectionId sets this sessions unique ID
	SetConnectionId(connId uint32)
	// GetCharacterSet returns the character set for this session (defined by the system variable `character_set_connection`).
	GetCharacterSet() CharacterSetID
	// GetCharacterSetResults returns the result character set for this session (defined by the system variable `character_set_results`).
	GetCharacterSetResults() CharacterSetID
	// GetCollation returns the collation for this session (defined by the system variable `collation_connection`).
	GetCollation() CollationID
	// GetPrivilegeSet returns the cached privilege set associated with this session, along with its counter. The
	// PrivilegeSet is only valid when the counter is greater than zero.
	GetPrivilegeSet() (PrivilegeSet, uint64)
	// SetPrivilegeSet updates this session's cache with the given counter and privilege set. Setting the counter to a
	// value of zero will force the cache to reload. This is an internal function and is not intended to be used by
	// integrators.
	SetPrivilegeSet(newPs PrivilegeSet, counter uint64)
	// ValidateSession provides integrators a chance to do any custom validation of this session before any query is
	// executed in it. For example, Dolt uses this hook to validate that the session's working set is valid.
	ValidateSession(ctx *Context) error
}

// PersistableSession supports serializing/deserializing global system variables/
type PersistableSession interface {
	Session
	// PersistGlobal writes to the persisted global system variables file
	PersistGlobal(ctx *Context, sysVarName string, value interface{}) error
	// RemovePersistedGlobal deletes a variable from the persisted globals file
	RemovePersistedGlobal(sysVarName string) error
	// RemoveAllPersistedGlobals clears the contents of the persisted globals file
	RemoveAllPersistedGlobals() error
	// GetPersistedValue returns persisted value for a global system variable
	GetPersistedValue(k string) (interface{}, error)
}

// TransactionSession can BEGIN, ROLLBACK and COMMIT transactions, as well as create SAVEPOINTS and restore to them.
// Transactions can span multiple databases, and integrators must do their own error handling to prevent this if they
// cannot support multiple databases in a single transaction. Such integrators can use Session.GetTransactionDatabase
// to determine the database that was considered in scope when a transaction began.
type TransactionSession interface {
	Session
	// StartTransaction starts a new transaction and returns it
	StartTransaction(ctx *Context, tCharacteristic TransactionCharacteristic) (Transaction, error)
	// CommitTransaction commits the transaction given
	CommitTransaction(ctx *Context, tx Transaction) error
	// Rollback restores the database to the state recorded in the transaction given
	Rollback(ctx *Context, transaction Transaction) error
	// CreateSavepoint records a savepoint for the transaction given with the name given. If the name is already in use
	// for this transaction, the new savepoint replaces the old one.
	CreateSavepoint(ctx *Context, transaction Transaction, name string) error
	// RollbackToSavepoint restores the database to the state named by the savepoint
	RollbackToSavepoint(ctx *Context, transaction Transaction, name string) error
	// ReleaseSavepoint removes the savepoint named from the transaction given
	ReleaseSavepoint(ctx *Context, transaction Transaction, name string) error
}

// A LifecycleAwareSession is a a sql.Session that gets lifecycle callbacks
// from the handler when it begins and ends a command and when it itself ends.
//
// This is an optional interface which integrators can choose to implement
// if they want those callbacks.
type LifecycleAwareSession interface {
	CommandBegin() error
	CommandEnd()
	SessionEnd()
}

// An optional Lifecycle callback which a session can receive. This can be
// delivered periodically during a long running operation, between the
// CommandBegin and CommandEnd calls. Across the call to this method, the
// gms.Engine is not accessing the session or any of its state, such as
// table editors, database providers, etc.
type SafepointAwareSession interface {
	CommandSafepoint()
}

type (
	// TypedValue is a value along with its type.
	TypedValue struct {
		Typ   Type
		Value interface{}
	}

	// Warning stands for mySQL warning record.
	Warning struct {
		Level   string
		Message string
		Code    int
	}
)

const (
	RowCount       = "row_count"
	FoundRows      = "found_rows"
	LastInsertId   = "last_insert_id"
	LastInsertUuid = "last_insert_uuid"
)

// Session ID 0 used as invalid SessionID
var autoSessionIDs uint32 = 1

// Context of the query execution.
type Context struct {
	queryTime time.Time
	context.Context
	Session
	ProcessList ProcessList
	services    Services
	tracer      trace.Tracer
	rootSpan    trace.Span
	Memory      *MemoryManager
	query       string
	pid         uint64
	interpreted bool
	Version     AnalyzerVersion
}

// ContextOption is a function to configure the context.
type ContextOption func(*Context)

// WithSession adds the given session to the context.
func WithSession(s Session) ContextOption {
	return func(ctx *Context) {
		ctx.Session = s
	}
}

// WithTracer adds the given tracer to the context.
func WithTracer(t trace.Tracer) ContextOption {
	return func(ctx *Context) {
		ctx.tracer = t
	}
}

// WithPid adds the given pid to the context.
func WithPid(pid uint64) ContextOption {
	return func(ctx *Context) {
		ctx.pid = pid
	}
}

// WithQuery adds the given query to the context.
func WithQuery(q string) ContextOption {
	return func(ctx *Context) {
		ctx.query = q
	}
}

// WithMemoryManager adds the given memory manager to the context.
func WithMemoryManager(m *MemoryManager) ContextOption {
	return func(ctx *Context) {
		ctx.Memory = m
	}
}

// WithRootSpan sets the root span of the context.
func WithRootSpan(s trace.Span) ContextOption {
	return func(ctx *Context) {
		ctx.rootSpan = s
	}
}

func WithProcessList(p ProcessList) ContextOption {
	return func(ctx *Context) {
		ctx.ProcessList = p
	}
}

// WithServices sets the services for the Context
func WithServices(services Services) ContextOption {
	return func(ctx *Context) {
		ctx.services = services
	}
}

var ctxNowFunc = time.Now
var ctxNowFuncMutex = &sync.Mutex{}

func RunWithNowFunc(nowFunc func() time.Time, fn func() error) error {
	oldNowFunc := swapNowFunc(nowFunc)
	defer func() {
		swapNowFunc(oldNowFunc)
	}()

	return fn()
}

// RunInterpreted modifies the context such that all calls to Context.IsInterpreted will return `true`. It is safe to
// recursively call this.
func RunInterpreted[T any](ctx *Context, f func(ctx *Context) (T, error)) (T, error) {
	current := ctx.interpreted
	ctx.interpreted = true
	defer func() {
		ctx.interpreted = current
	}()
	return f(ctx)
}

func swapNowFunc(newNowFunc func() time.Time) func() time.Time {
	ctxNowFuncMutex.Lock()
	defer ctxNowFuncMutex.Unlock()

	oldNowFunc := ctxNowFunc
	ctxNowFunc = newNowFunc
	return oldNowFunc
}

func Now() time.Time {
	ctxNowFuncMutex.Lock()
	defer ctxNowFuncMutex.Unlock()

	return ctxNowFunc()
}

type ContextFactory func(context.Context, ...ContextOption) *Context

// NewContext creates a new query context. Options can be passed to configure
// the context. If some aspect of the context is not configure, the default
// value will be used.
// By default, the context will have an empty base session, a noop tracer and
// a memory manager using the process reporter.
func NewContext(
	ctx context.Context,
	opts ...ContextOption,
) *Context {
	c := &Context{
		Context:   ctx,
		Session:   nil,
		queryTime: Now(),
		tracer:    NoopTracer,
	}
	for _, opt := range opts {
		opt(c)
	}

	if c.Memory == nil {
		c.Memory = NewMemoryManager(ProcessMemory)
	}
	if c.ProcessList == nil {
		c.ProcessList = EmptyProcessList{}
	}
	if c.Session == nil {
		c.Session = NewBaseSession()
	}

	return c
}

// ApplyOpts the options given to the context. Mostly for tests, not safe for use after construction of the context.
func (c *Context) ApplyOpts(opts ...ContextOption) {
	for _, opt := range opts {
		opt(c)
	}
}

// NewEmptyContext returns a default context with default values.
func NewEmptyContext() *Context { return NewContext(context.TODO()) }

// IsInterpreted returns `true` when this is being called from within RunInterpreted. In such cases, GMS will choose to
// handle logic differently, as running from within an interpreted function requires different considerations than
// running in a standard environment.
func (c *Context) IsInterpreted() bool {
	return c.interpreted
}

// Pid returns the process id associated with this context.
func (c *Context) Pid() uint64 {
	if c == nil {
		return 0
	}
	return c.pid
}

// Query returns the query string associated with this context.
func (c *Context) Query() string {
	if c == nil {
		return ""
	}
	return c.query
}

func (c *Context) WithQuery(q string) *Context {
	if c == nil {
		return nil
	}

	nc := *c
	nc.query = q
	return &nc
}

// QueryTime returns the time.Time when the context associated with this query was created
func (c *Context) QueryTime() time.Time {
	if c == nil {
		return time.Time{}
	}
	return c.queryTime
}

// SetQueryTime updates the queryTime to the given time
func (c *Context) SetQueryTime(t time.Time) {
	if c == nil {
		return
	}
	c.queryTime = t
}

// Span creates a new tracing span with the given context.
// It will return the span and a new context that should be passed to all
// children of this span.
func (c *Context) Span(
	opName string,
	opts ...trace.SpanStartOption,
) (trace.Span, *Context) {
	if c == nil {
		return noopSpan, nil
	}

	if c.tracer == nil || c.tracer == NoopTracer {
		return noopSpan, c
	}

	ctx, span := c.tracer.Start(c.Context, opName, opts...)
	return span, c.WithContext(ctx)
}

// NewSubContext creates a new sub-context with the current context as parent. Returns the resulting context.CancelFunc
// as well as the new *sql.Context, which be used to cancel the new context before the parent is finished.
func (c *Context) NewSubContext() (*Context, context.CancelFunc) {
	if c == nil {
		return nil, nil
	}

	ctx, cancelFunc := context.WithCancel(c.Context)

	return c.WithContext(ctx), cancelFunc
}

// WithContext returns a new context with the given underlying context.
func (c *Context) WithContext(ctx context.Context) *Context {
	if c == nil {
		return nil
	}

	nc := *c
	nc.Context = ctx
	return &nc
}

// RootSpan returns the root span, if any.
func (c *Context) RootSpan() trace.Span {
	if c == nil {
		return noopSpan
	}
	return c.rootSpan
}

// Error adds an error as warning to the session.
func (c *Context) Error(code int, msg string, args ...interface{}) {
	if c == nil || c.Session == nil {
		return
	}

	c.Session.Warn(&Warning{
		Level:   "Error",
		Code:    code,
		Message: fmt.Sprintf(msg, args...),
	})
}

// Warn adds a warning to the session.
func (c *Context) Warn(code int, msg string, args ...interface{}) {
	if c == nil || c.Session == nil {
		return
	}
	c.Session.Warn(&Warning{
		Level:   "Warning",
		Code:    code,
		Message: fmt.Sprintf(msg, args...),
	})
}

// KillConnection terminates the connection associated with |connID|.
func (c *Context) KillConnection(connID uint32) error {
	if c == nil || c.services.KillConnection == nil {
		return nil
	}

	if c.services.KillConnection != nil {
		return c.services.KillConnection(connID)
	}
	return nil
}

// LoadInfile loads the remote file |filename| from the client. Returns a |ReadCloser| for
// the file's contents. Returns an error if this functionality is not supported.
func (c *Context) LoadInfile(filename string) (io.ReadCloser, error) {
	if c == nil || c.services.LoadInfile == nil {
		return nil, ErrUnsupportedFeature.New("LOAD DATA LOCAL INFILE ...")
	}

	if c.services.LoadInfile != nil {
		return c.services.LoadInfile(filename)
	}
	return nil, ErrUnsupportedFeature.New("LOAD DATA LOCAL INFILE ...")
}

func (c *Context) NewErrgroup() (*errgroup.Group, *Context) {
	if c == nil {
		return nil, nil
	}

	eg, egCtx := errgroup.WithContext(c.Context)
	return eg, c.WithContext(egCtx)
}

// NewCtxWithClient returns a new Context with the given [client]
func (c *Context) NewCtxWithClient(client Client) *Context {
	if c == nil {
		return nil
	}

	nc := *c
	nc.Session.SetClient(client)
	nc.Session.SetPrivilegeSet(nil, 0)
	return &nc
}

// Services are handles to optional or plugin functionality that can be
// used by the SQL implementation in certain situations. An integrator can set
// methods on Services for a given *Context and different parts of go-mysql-server
// will inspect it in order to fulfill their implementations. Currently, the
// KillConnection service is available. Set these with |WithServices|; the
// implementation will access them through the corresponding methods on
// *Context, such as |KillConnection|.
type Services struct {
	KillConnection func(connID uint32) error
	LoadInfile     func(filename string) (io.ReadCloser, error)
}

// NewSpanIter creates a RowIter executed in the given span.
// Currently inactive, returns the iter returned unaltered.
func NewSpanIter(span trace.Span, iter RowIter) RowIter {
	// In the default, non traced case, we should not bother with
	// collecting the timings below.
	if !span.IsRecording() {
		return iter
	} else {
		return &spanIter{
			span: span,
			iter: iter,
		}
	}
}

type spanIter struct {
	span  trace.Span
	iter  RowIter
	count int
	max   time.Duration
	min   time.Duration
	total time.Duration
	done  bool
}

var _ RowIter = (*spanIter)(nil)

func (i *spanIter) updateTimings(start time.Time) {
	elapsed := time.Since(start)
	if i.max < elapsed {
		i.max = elapsed
	}

	if i.min > elapsed || i.min == 0 {
		i.min = elapsed
	}

	i.total += elapsed
}

func (i *spanIter) Next(ctx *Context) (Row, error) {
	start := time.Now()

	row, err := i.iter.Next(ctx)
	if err == io.EOF {
		i.finish()
		return nil, err
	}

	if err != nil {
		i.finishWithError(err)
		return nil, err
	}

	i.count++
	i.updateTimings(start)
	return row, nil
}

func (i *spanIter) finish() {
	var avg time.Duration
	if i.count > 0 {
		avg = i.total / time.Duration(i.count)
	}

	i.span.AddEvent("finish", trace.WithAttributes(
		attribute.Int("rows", i.count),
		attribute.Stringer("total_time", i.total),
		attribute.Stringer("max_time", i.max),
		attribute.Stringer("min_time", i.min),
		attribute.Stringer("avg_time", avg),
	))
	i.span.End()
	i.done = true
}

func (i *spanIter) finishWithError(err error) {
	var avg time.Duration
	if i.count > 0 {
		avg = i.total / time.Duration(i.count)
	}

	i.span.RecordError(err)
	i.span.AddEvent("finish", trace.WithAttributes(
		attribute.Int("rows", i.count),
		attribute.Stringer("total_time", i.total),
		attribute.Stringer("max_time", i.max),
		attribute.Stringer("min_time", i.min),
		attribute.Stringer("avg_time", avg),
	))
	i.span.End()
	i.done = true
}

func (i *spanIter) Close(ctx *Context) error {
	if !i.done {
		i.finish()
	}
	return i.iter.Close(ctx)
}

func defaultLastQueryInfo() map[string]*atomic.Value {
	ret := make(map[string]*atomic.Value)
	ret[RowCount] = &atomic.Value{}
	ret[RowCount].Store(int64(0))
	ret[FoundRows] = &atomic.Value{}
	ret[FoundRows].Store(int64(1)) // this is kind of a hack -- it handles the case of `select found_rows()` before any select statement is issue)
	ret[LastInsertId] = &atomic.Value{}
	ret[LastInsertId].Store(int64(0))
	ret[LastInsertUuid] = &atomic.Value{}
	ret[LastInsertUuid].Store("")
	return ret
}

// cc: https://dev.mysql.com/doc/refman/8.0/en/temporary-files.html
func GetTmpdirSessionVar() string {
	ret := os.Getenv("TMPDIR")
	if ret != "" {
		return ret
	}

	ret = os.Getenv("TEMP")
	if ret != "" {
		return ret
	}

	ret = os.Getenv("TMP")
	if ret != "" {
		return ret
	}

	return ""
}

// HasDefaultValue checks if session variable value is the default one.
func HasDefaultValue(ctx *Context, s Session, key string) (bool, interface{}) {
	val, err := s.GetSessionVariable(ctx, key)
	if err == nil {
		sysVar, _, ok := SystemVariables.GetGlobal(key)
		if ok {
			v := sysVar.GetDefault()
			return v == val, val
		}
	}
	return true, nil
}

type AnalyzerVersion uint8

const (
	VersionUnknown AnalyzerVersion = iota
	VersionStable
	VersionExperimental
)

// Helper function to call CommandBegin on a LifecycleAwareSession, or do nothing.
func SessionCommandBegin(s Session) error {
	if cur, ok := s.(LifecycleAwareSession); ok {
		return cur.CommandBegin()
	}
	return nil
}

// Helper function to call CommandEnd on a LifecycleAwareSession, or do nothing.
func SessionCommandEnd(s Session) {
	if cur, ok := s.(LifecycleAwareSession); ok {
		cur.CommandEnd()
	}
}

// Helper function to call CommandSafepoint on a SafepointAwareSession, or do nothing.
func SessionCommandSafepoint(s Session) {
	if cur, ok := s.(SafepointAwareSession); ok {
		cur.CommandSafepoint()
	}
}

// Helper function to call SessionEnd on a LifecycleAwareSession, or do nothing.
func SessionEnd(s Session) {
	if cur, ok := s.(LifecycleAwareSession); ok {
		cur.SessionEnd()
	}
}
