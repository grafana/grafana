// Copyright 2017 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:generate go run generator.go -full-path-comments

package sqlite // import "modernc.org/sqlite"

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"math/bits"
	"net/url"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"modernc.org/libc"
	"modernc.org/libc/sys/types"
	sqlite3 "modernc.org/sqlite/lib"
)

var (
	_ driver.Conn   = (*conn)(nil)
	_ driver.Driver = (*Driver)(nil)
	//lint:ignore SA1019 TODO implement ExecerContext
	_ driver.Execer = (*conn)(nil)
	//lint:ignore SA1019 TODO implement QueryerContext
	_ driver.Queryer                        = (*conn)(nil)
	_ driver.Result                         = (*result)(nil)
	_ driver.Rows                           = (*rows)(nil)
	_ driver.RowsColumnTypeDatabaseTypeName = (*rows)(nil)
	_ driver.RowsColumnTypeLength           = (*rows)(nil)
	_ driver.RowsColumnTypeNullable         = (*rows)(nil)
	_ driver.RowsColumnTypePrecisionScale   = (*rows)(nil)
	_ driver.RowsColumnTypeScanType         = (*rows)(nil)
	_ driver.Stmt                           = (*stmt)(nil)
	_ driver.Tx                             = (*tx)(nil)
	_ error                                 = (*Error)(nil)
)

const (
	driverName              = "sqlite"
	ptrSize                 = unsafe.Sizeof(uintptr(0))
	sqliteLockedSharedcache = sqlite3.SQLITE_LOCKED | (1 << 8)
)

func init() {
	sql.Register(driverName, newDriver())
	sqlite3.PatchIssue199() // https://gitlab.com/cznic/sqlite/-/issues/199

}

// Inspired by mattn/go-sqlite3: https://github.com/mattn/go-sqlite3/blob/ab91e934/sqlite3.go#L210-L226
//
// These time.Parse formats handle formats 1 through 7 listed at https://www.sqlite.org/lang_datefunc.html.
var parseTimeFormats = []string{
	"2006-01-02 15:04:05.999999999-07:00",
	"2006-01-02T15:04:05.999999999-07:00",
	"2006-01-02 15:04:05.999999999",
	"2006-01-02T15:04:05.999999999",
	"2006-01-02 15:04",
	"2006-01-02T15:04",
	"2006-01-02",
}

// interruptOnDone sets up a goroutine to interrupt the provided db when the
// context is canceled, and returns a function the caller must defer so it
// doesn't interrupt after the caller finishes.
func interruptOnDone(
	ctx context.Context,
	c *conn,
	done *int32,
) func() {
	if done == nil {
		var d int32
		done = &d
	}
	// donemu prevents a TOCTOU logical race between checking the done flag and
	// calling interrupt in the select statement below.
	var donemu sync.Mutex

	donech := make(chan struct{})

	go func() {
		select {
		case <-ctx.Done():
			// don't call interrupt if we were already done: it indicates that this
			// call to exec is no longer running and we would be interrupting
			// nothing, or even possibly an unrelated later call to exec.
			donemu.Lock()
			if atomic.CompareAndSwapInt32(done, 0, 1) {
				c.interrupt(c.db)
			}
			donemu.Unlock()
		case <-donech:
		}
	}()

	// the caller is expected to defer this function
	return func() {
		// set the done flag so that a context cancellation right after the caller
		// returns doesn't trigger a call to interrupt for some other statement.
		donemu.Lock()
		atomic.StoreInt32(done, 1)
		donemu.Unlock()
		close(donech)
	}
}

func getVFSName(query string) (r string, err error) {
	q, err := url.ParseQuery(query)
	if err != nil {
		return "", err
	}

	for _, v := range q["vfs"] {
		if r != "" && r != v {
			return "", fmt.Errorf("conflicting vfs query parameters: %v", q["vfs"])
		}

		r = v
	}

	return r, nil
}

func applyQueryParams(c *conn, query string) error {
	q, err := url.ParseQuery(query)
	if err != nil {
		return err
	}

	var a []string
	for _, v := range q["_pragma"] {
		a = append(a, v)
	}
	// Push 'busy_timeout' first, the rest in lexicographic order, case insenstive.
	// See https://gitlab.com/cznic/sqlite/-/issues/198#note_2233423463 for
	// discussion.
	sort.Slice(a, func(i, j int) bool {
		x, y := strings.TrimSpace(strings.ToLower(a[i])), strings.TrimSpace(strings.ToLower(a[j]))
		if strings.HasPrefix(x, "busy_timeout") {
			return true
		}
		if strings.HasPrefix(y, "busy_timeout") {
			return false
		}

		return x < y
	})
	for _, v := range a {
		cmd := "pragma " + v
		_, err := c.exec(context.Background(), cmd, nil)
		if err != nil {
			return err
		}
	}

	if v := q.Get("_time_format"); v != "" {
		f, ok := writeTimeFormats[v]
		if !ok {
			return fmt.Errorf("unknown _time_format %q", v)
		}
		c.writeTimeFormat = f
	}
	if v := q.Get("_time_integer_format"); v != "" {
		switch v {
		case "unix":
		case "unix_milli":
		case "unix_micro":
		case "unix_nano":
		default:
			return fmt.Errorf("unknown _time_integer_format %q", v)
		}
		c.integerTimeFormat = v
	}

	if v := q.Get("_txlock"); v != "" {
		lower := strings.ToLower(v)
		if lower != "deferred" && lower != "immediate" && lower != "exclusive" {
			return fmt.Errorf("unknown _txlock %q", v)
		}
		c.beginMode = v
	}

	if v := q.Get("_inttotime"); v != "" {
		onoff, err := strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("unknown _inttotime %q, must be 1, t, T, TRUE, true, True, 0, f, F, FALSE, false, False",
				v)
		}
		c.intToTime = onoff
	}

	return nil
}

func unlockNotify(t *libc.TLS, ppArg uintptr, nArg int32) {
	for i := int32(0); i < nArg; i++ {
		mu := *(*uintptr)(unsafe.Pointer(ppArg))
		(*mutex)(unsafe.Pointer(mu)).Unlock()
		ppArg += ptrSize
	}
}

// FunctionImpl describes an [application-defined SQL function]. If Scalar is
// set, it is treated as a scalar function; otherwise, it is treated as an
// aggregate function using MakeAggregate.
//
// [application-defined SQL function]: https://sqlite.org/appfunc.html
type FunctionImpl struct {
	// NArgs is the required number of arguments that the function accepts.
	// If NArgs is negative, then the function is variadic.
	NArgs int32

	// If Deterministic is true, the function must always give the same
	// output when the input parameters are the same. This enables functions
	// to be used in additional contexts like the WHERE clause of partial
	// indexes and enables additional optimizations.
	//
	// See https://sqlite.org/c3ref/c_deterministic.html#sqlitedeterministic
	// for more details.
	Deterministic bool

	// Scalar is called when a scalar function is invoked in SQL. The
	// argument Values are not valid past the return of the function.
	Scalar func(ctx *FunctionContext, args []driver.Value) (driver.Value, error)

	// MakeAggregate is called at the beginning of each evaluation of an
	// aggregate function.
	MakeAggregate func(ctx FunctionContext) (AggregateFunction, error)
}

// An AggregateFunction is an invocation of an aggregate or window function. See
// the documentation for [aggregate function callbacks] and [application-defined
// window functions] for an overview.
//
// [aggregate function callbacks]: https://www.sqlite.org/appfunc.html#the_aggregate_function_callbacks
// [application-defined window functions]: https://www.sqlite.org/windowfunctions.html#user_defined_aggregate_window_functions
type AggregateFunction interface {
	// Step is called for each row of an aggregate function's SQL
	// invocation. The argument Values are not valid past the return of the
	// function.
	Step(ctx *FunctionContext, rowArgs []driver.Value) error

	// WindowInverse is called to remove the oldest presently aggregated
	// result of Step from the current window. The arguments are those
	// passed to Step for the row being removed. The argument Values are not
	// valid past the return of the function.
	WindowInverse(ctx *FunctionContext, rowArgs []driver.Value) error

	// WindowValue is called to get the current value of an aggregate
	// function. This is used to return the final value of the function,
	// whether it is used as a window function or not.
	WindowValue(ctx *FunctionContext) (driver.Value, error)

	// Final is called after all of the aggregate function's input rows have
	// been stepped through. No other methods will be called on the
	// AggregateFunction after calling Final. WindowValue returns the value
	// from the function.
	Final(ctx *FunctionContext)
}

type collation struct {
	zName uintptr
	pApp  uintptr
	enc   int32
}

// RegisterCollationUtf8 makes a Go function available as a collation named zName.
// impl receives two UTF-8 strings: left and right.
// The result needs to be:
//
// - 0 if left == right
// - 1 if left < right
// - +1 if left > right
//
// impl must always return the same result given the same inputs.
// Additionally, it must have the following properties for all strings A, B and C:
// - if A==B, then B==A
// - if A==B and B==C, then A==C
// - if A<B, then B>A
// - if A<B and B<C, then A<C.
//
// The new collation will be available to all new connections opened after
// executing RegisterCollationUtf8.
func RegisterCollationUtf8(
	zName string,
	impl func(left, right string) int,
) error {
	return registerCollation(zName, impl, sqlite3.SQLITE_UTF8)
}

// MustRegisterCollationUtf8 is like RegisterCollationUtf8 but panics on error.
func MustRegisterCollationUtf8(
	zName string,
	impl func(left, right string) int,
) {
	if err := RegisterCollationUtf8(zName, impl); err != nil {
		panic(err)
	}
}

func registerCollation(
	zName string,
	impl func(left, right string) int,
	enc int32,
) error {
	if _, ok := d.collations[zName]; ok {
		return fmt.Errorf("a collation %q is already registered", zName)
	}

	// dont free, collations registered on the driver live as long as the program
	name, err := libc.CString(zName)
	if err != nil {
		return err
	}

	xCollations.mu.Lock()
	id := xCollations.ids.next()
	xCollations.m[id] = impl
	xCollations.mu.Unlock()

	d.collations[zName] = &collation{
		zName: name,
		pApp:  id,
		enc:   enc,
	}

	return nil
}

type ExecQuerierContext interface {
	driver.ExecerContext
	driver.QueryerContext
}

type HookRegisterer interface {
	RegisterPreUpdateHook(PreUpdateHookFn)
	RegisterCommitHook(CommitHookFn)
	RegisterRollbackHook(RollbackHookFn)
}

// ConnectionHookFn function type for a connection hook on the Driver. Connection
// hooks are called after the connection has been set up.
type ConnectionHookFn func(
	conn ExecQuerierContext,
	dsn string,
) error

// FunctionContext represents the context user defined functions execute in.
// Fields and/or methods of this type may get addedd in the future.
type FunctionContext struct {
	tls *libc.TLS
	ctx uintptr
}

const sqliteValPtrSize = unsafe.Sizeof(&sqlite3.Sqlite3_value{})

// RegisterFunction registers a function named zFuncName with nArg arguments.
// Passing -1 for nArg indicates the function is variadic. The FunctionImpl
// determines whether the function is deterministic or not, and whether it is a
// scalar function (when Scalar is defined) or an aggregate function (when
// Scalar is not defined and MakeAggregate is defined).
//
// The new function will be available to all new connections opened after
// executing RegisterFunction.
func RegisterFunction(
	zFuncName string,
	impl *FunctionImpl,
) error {
	return registerFunction(zFuncName, impl)
}

// MustRegisterFunction is like RegisterFunction but panics on error.
func MustRegisterFunction(
	zFuncName string,
	impl *FunctionImpl,
) {
	if err := RegisterFunction(zFuncName, impl); err != nil {
		panic(err)
	}
}

// RegisterScalarFunction registers a scalar function named zFuncName with nArg
// arguments. Passing -1 for nArg indicates the function is variadic.
//
// The new function will be available to all new connections opened after
// executing RegisterScalarFunction.
func RegisterScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) (err error) {
	if dmesgs {
		defer func() {
			dmesg("zFuncName %q, nArg %v, xFunc %p: err %v", zFuncName, nArg, xFunc, err)
		}()
	}
	return registerFunction(zFuncName, &FunctionImpl{NArgs: nArg, Scalar: xFunc, Deterministic: false})
}

// MustRegisterScalarFunction is like RegisterScalarFunction but panics on
// error.
func MustRegisterScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) {
	if dmesgs {
		dmesg("zFuncName %q, nArg %v, xFunc %p", zFuncName, nArg, xFunc)
	}
	if err := RegisterScalarFunction(zFuncName, nArg, xFunc); err != nil {
		panic(err)
	}
}

// MustRegisterDeterministicScalarFunction is like
// RegisterDeterministicScalarFunction but panics on error.
func MustRegisterDeterministicScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) {
	if dmesgs {
		dmesg("zFuncName %q, nArg %v, xFunc %p", zFuncName, nArg, xFunc)
	}
	if err := RegisterDeterministicScalarFunction(zFuncName, nArg, xFunc); err != nil {
		panic(err)
	}
}

// RegisterDeterministicScalarFunction registers a deterministic scalar
// function named zFuncName with nArg arguments. Passing -1 for nArg indicates
// the function is variadic. A deterministic function means that the function
// always gives the same output when the input parameters are the same.
//
// The new function will be available to all new connections opened after
// executing RegisterDeterministicScalarFunction.
func RegisterDeterministicScalarFunction(
	zFuncName string,
	nArg int32,
	xFunc func(ctx *FunctionContext, args []driver.Value) (driver.Value, error),
) (err error) {
	if dmesgs {
		defer func() {
			dmesg("zFuncName %q, nArg %v, xFunc %p: err %v", zFuncName, nArg, xFunc, err)
		}()
	}
	return registerFunction(zFuncName, &FunctionImpl{NArgs: nArg, Scalar: xFunc, Deterministic: true})
}

func registerFunction(
	zFuncName string,
	impl *FunctionImpl,
) error {

	if _, ok := d.udfs[zFuncName]; ok {
		return fmt.Errorf("a function named %q is already registered", zFuncName)
	}

	// dont free, functions registered on the driver live as long as the program
	name, err := libc.CString(zFuncName)
	if err != nil {
		return err
	}

	var textrep int32 = sqlite3.SQLITE_UTF8

	if impl.Deterministic {
		textrep |= sqlite3.SQLITE_DETERMINISTIC
	}

	udf := &userDefinedFunction{
		zFuncName: name,
		nArg:      impl.NArgs,
		eTextRep:  textrep,
	}

	if impl.Scalar != nil {
		xFuncs.mu.Lock()
		id := xFuncs.ids.next()
		xFuncs.m[id] = impl.Scalar
		xFuncs.mu.Unlock()

		udf.scalar = true
		udf.pApp = id
	} else {
		xAggregateFactories.mu.Lock()
		id := xAggregateFactories.ids.next()
		xAggregateFactories.m[id] = impl.MakeAggregate
		xAggregateFactories.mu.Unlock()

		udf.pApp = id
	}

	d.udfs[zFuncName] = udf

	return nil
}

// RegisterConnectionHook registers a function to be called after each connection
// is opened. This is called after all the connection has been set up.
func RegisterConnectionHook(fn ConnectionHookFn) {
	d.RegisterConnectionHook(fn)
}

func origin(skip int) string {
	pc, fn, fl, _ := runtime.Caller(skip)
	f := runtime.FuncForPC(pc)
	var fns string
	if f != nil {
		fns = f.Name()
		if x := strings.LastIndex(fns, "."); x > 0 {
			fns = fns[x+1:]
		}
	}
	return fmt.Sprintf("%s:%d:%s", fn, fl, fns)
}

func errorResultFunction(tls *libc.TLS, ctx uintptr) func(error) {
	return func(res error) {
		errmsg, cerr := libc.CString(res.Error())
		if cerr != nil {
			panic(cerr)
		}
		defer libc.Xfree(tls, errmsg)
		sqlite3.Xsqlite3_result_error(tls, ctx, errmsg, -1)
		sqlite3.Xsqlite3_result_error_code(tls, ctx, sqlite3.SQLITE_ERROR)
	}
}

func functionArgs(tls *libc.TLS, argc int32, argv uintptr) []driver.Value {
	args := make([]driver.Value, argc)
	for i := int32(0); i < argc; i++ {
		valPtr := *(*uintptr)(unsafe.Pointer(argv + uintptr(i)*sqliteValPtrSize))

		switch valType := sqlite3.Xsqlite3_value_type(tls, valPtr); valType {
		case sqlite3.SQLITE_TEXT:
			args[i] = libc.GoString(sqlite3.Xsqlite3_value_text(tls, valPtr))
		case sqlite3.SQLITE_INTEGER:
			args[i] = sqlite3.Xsqlite3_value_int64(tls, valPtr)
		case sqlite3.SQLITE_FLOAT:
			args[i] = sqlite3.Xsqlite3_value_double(tls, valPtr)
		case sqlite3.SQLITE_NULL:
			args[i] = nil
		case sqlite3.SQLITE_BLOB:
			size := sqlite3.Xsqlite3_value_bytes(tls, valPtr)
			blobPtr := sqlite3.Xsqlite3_value_blob(tls, valPtr)
			v := make([]byte, size)
			if size != 0 {
				copy(v, (*libc.RawMem)(unsafe.Pointer(blobPtr))[:size:size])
			}
			args[i] = v
		default:
			panic(fmt.Sprintf("unexpected argument type %q passed by sqlite", valType))
		}
	}

	return args
}

func functionReturnValue(tls *libc.TLS, ctx uintptr, res driver.Value) error {
	switch resTyped := res.(type) {
	case nil:
		sqlite3.Xsqlite3_result_null(tls, ctx)
	case int64:
		sqlite3.Xsqlite3_result_int64(tls, ctx, resTyped)
	case float64:
		sqlite3.Xsqlite3_result_double(tls, ctx, resTyped)
	case bool:
		sqlite3.Xsqlite3_result_int(tls, ctx, libc.Bool32(resTyped))
	case time.Time:
		sqlite3.Xsqlite3_result_int64(tls, ctx, resTyped.Unix())
	case string:
		size := int32(len(resTyped))
		cstr, err := libc.CString(resTyped)
		if err != nil {
			panic(err)
		}
		defer libc.Xfree(tls, cstr)
		sqlite3.Xsqlite3_result_text(tls, ctx, cstr, size, sqlite3.SQLITE_TRANSIENT)
	case []byte:
		size := int32(len(resTyped))
		if size == 0 {
			sqlite3.Xsqlite3_result_zeroblob(tls, ctx, 0)
			return nil
		}
		p := libc.Xmalloc(tls, types.Size_t(size))
		if p == 0 {
			panic(fmt.Sprintf("unable to allocate space for blob: %d", size))
		}
		defer libc.Xfree(tls, p)
		copy((*libc.RawMem)(unsafe.Pointer(p))[:size:size], resTyped)

		sqlite3.Xsqlite3_result_blob(tls, ctx, p, size, sqlite3.SQLITE_TRANSIENT)
	default:
		return fmt.Errorf("function did not return a valid driver.Value: %T", resTyped)
	}

	return nil
}

// The below is all taken from zombiezen.com/go/sqlite. Aggregate functions need
// to maintain state (for instance, the count of values seen so far). We give
// each aggregate function an ID, generated by idGen, and put that in the pApp
// argument to sqlite3_create_function. We track this on the Go side in
// xAggregateFactories.
//
// When (if) the function is called is called by a query, we call the
// MakeAggregate factory function to set it up, and track that in
// xAggregateContext, retrieving it via sqlite3_aggregate_context.
//
// We also need to ensure that, for both aggregate and scalar functions, the
// function pointer we pass to SQLite meets certain rules on the Go side, so
// that the pointer remains valid.
var (
	xFuncs = struct {
		mu  sync.RWMutex
		m   map[uintptr]func(*FunctionContext, []driver.Value) (driver.Value, error)
		ids idGen
	}{
		m: make(map[uintptr]func(*FunctionContext, []driver.Value) (driver.Value, error)),
	}

	xAggregateFactories = struct {
		mu  sync.RWMutex
		m   map[uintptr]func(FunctionContext) (AggregateFunction, error)
		ids idGen
	}{
		m: make(map[uintptr]func(FunctionContext) (AggregateFunction, error)),
	}

	xAggregateContext = struct {
		mu  sync.RWMutex
		m   map[uintptr]AggregateFunction
		ids idGen
	}{
		m: make(map[uintptr]AggregateFunction),
	}

	xCollations = struct {
		mu  sync.RWMutex
		m   map[uintptr]func(string, string) int
		ids idGen
	}{
		m: make(map[uintptr]func(string, string) int),
	}
)

type idGen struct {
	bitset []uint64
}

func (gen *idGen) next() uintptr {
	base := uintptr(1)
	for i := 0; i < len(gen.bitset); i, base = i+1, base+64 {
		b := gen.bitset[i]
		if b != 1<<64-1 {
			n := uintptr(bits.TrailingZeros64(^b))
			gen.bitset[i] |= 1 << n
			return base + n
		}
	}
	gen.bitset = append(gen.bitset, 1)
	return base
}

func (gen *idGen) reclaim(id uintptr) {
	bit := id - 1
	gen.bitset[bit/64] &^= 1 << (bit % 64)
}

func makeAggregate(tls *libc.TLS, ctx uintptr) (AggregateFunction, uintptr) {
	goCtx := FunctionContext{tls: tls, ctx: ctx}
	aggCtx := (*uintptr)(unsafe.Pointer(sqlite3.Xsqlite3_aggregate_context(tls, ctx, int32(ptrSize))))
	setErrorResult := errorResultFunction(tls, ctx)
	if aggCtx == nil {
		setErrorResult(errors.New("insufficient memory for aggregate"))
		return nil, 0
	}
	if *aggCtx != 0 {
		// Already created.
		xAggregateContext.mu.RLock()
		f := xAggregateContext.m[*aggCtx]
		xAggregateContext.mu.RUnlock()
		return f, *aggCtx
	}

	factoryID := sqlite3.Xsqlite3_user_data(tls, ctx)
	xAggregateFactories.mu.RLock()
	factory := xAggregateFactories.m[factoryID]
	xAggregateFactories.mu.RUnlock()

	f, err := factory(goCtx)
	if err != nil {
		setErrorResult(err)
		return nil, 0
	}
	if f == nil {
		setErrorResult(errors.New("MakeAggregate function returned nil"))
		return nil, 0
	}

	xAggregateContext.mu.Lock()
	*aggCtx = xAggregateContext.ids.next()
	xAggregateContext.m[*aggCtx] = f
	xAggregateContext.mu.Unlock()
	return f, *aggCtx
}

// cFuncPointer converts a function defined by a function declaration to a C pointer.
// The result of using cFuncPointer on closures is undefined.
func cFuncPointer[T any](f T) uintptr {
	// This assumes the memory representation described in https://golang.org/s/go11func.
	//
	// cFuncPointer does its conversion by doing the following in order:
	// 1) Create a Go struct containing a pointer to a pointer to
	//    the function. It is assumed that the pointer to the function will be
	//    stored in the read-only data section and thus will not move.
	// 2) Convert the pointer to the Go struct to a pointer to uintptr through
	//    unsafe.Pointer. This is permitted via Rule #1 of unsafe.Pointer.
	// 3) Dereference the pointer to uintptr to obtain the function value as a
	//    uintptr. This is safe as long as function values are passed as pointers.
	return *(*uintptr)(unsafe.Pointer(&struct{ f T }{f}))
}

func funcTrampoline(tls *libc.TLS, ctx uintptr, argc int32, argv uintptr) {
	id := sqlite3.Xsqlite3_user_data(tls, ctx)
	xFuncs.mu.RLock()
	xFunc := xFuncs.m[id]
	xFuncs.mu.RUnlock()

	setErrorResult := errorResultFunction(tls, ctx)
	res, err := xFunc(&FunctionContext{}, functionArgs(tls, argc, argv))

	if err != nil {
		setErrorResult(err)
		return
	}

	err = functionReturnValue(tls, ctx, res)
	if err != nil {
		setErrorResult(err)
	}
}

// sqlite3AllocCString allocates a NUL-terminated copy of s using SQLite's
// memory allocator (sqlite3_malloc). The caller must arrange for SQLite to
// free the returned pointer via sqlite3_free.
func sqlite3AllocCString(tls *libc.TLS, s string) uintptr {
	n := len(s) + 1
	p := sqlite3.Xsqlite3_malloc(tls, int32(n))
	if p == 0 {
		return 0
	}
	mem := (*libc.RawMem)(unsafe.Pointer(p))[:n:n]
	copy(mem, []byte(s))
	mem[n-1] = 0
	return p
}

func stepTrampoline(tls *libc.TLS, ctx uintptr, argc int32, argv uintptr) {
	impl, _ := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	err := impl.Step(&FunctionContext{}, functionArgs(tls, argc, argv))
	if err != nil {
		setErrorResult(err)
	}
}

func inverseTrampoline(tls *libc.TLS, ctx uintptr, argc int32, argv uintptr) {
	impl, _ := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	err := impl.WindowInverse(&FunctionContext{}, functionArgs(tls, argc, argv))
	if err != nil {
		setErrorResult(err)
	}
}

func valueTrampoline(tls *libc.TLS, ctx uintptr) {
	impl, _ := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	res, err := impl.WindowValue(&FunctionContext{})
	if err != nil {
		setErrorResult(err)
	} else {
		err = functionReturnValue(tls, ctx, res)
		if err != nil {
			setErrorResult(err)
		}
	}
}

func finalTrampoline(tls *libc.TLS, ctx uintptr) {
	impl, id := makeAggregate(tls, ctx)
	if impl == nil {
		return
	}

	setErrorResult := errorResultFunction(tls, ctx)
	res, err := impl.WindowValue(&FunctionContext{})
	if err != nil {
		setErrorResult(err)
	} else {
		err = functionReturnValue(tls, ctx, res)
		if err != nil {
			setErrorResult(err)
		}
	}
	impl.Final(&FunctionContext{})

	xAggregateContext.mu.Lock()
	defer xAggregateContext.mu.Unlock()
	delete(xAggregateContext.m, id)
	xAggregateContext.ids.reclaim(id)
}

func collationTrampoline(tls *libc.TLS, pApp uintptr, nLeft int32, zLeft uintptr, nRight int32, zRight uintptr) int32 {
	xCollations.mu.RLock()
	xCollation := xCollations.m[pApp]
	xCollations.mu.RUnlock()

	left := string(libc.GoBytes(zLeft, int(nLeft)))
	right := string(libc.GoBytes(zRight, int(nRight)))

	// res is of type int, which can be 64-bit wide
	// Since we just need to know if the value is positive, negative, or zero, we can ensure it's -1, 0, +1
	res := xCollation(left, right)
	switch {
	case res < 0:
		return -1
	case res == 0:
		return 0
	case res > 0:
		return 1
	default:
		// Should never hit here, make the compiler happy
		return 0
	}
}

// Limit calls sqlite3_limit, see the docs at
// https://www.sqlite.org/c3ref/limit.html for details.
//
// To get a sql.Conn from a *sql.DB, use (*sql.DB).Conn().  Limits are bound to
// the particular instance of 'c', so getting a new connection only to pass it
// to Limit is possibly not useful above querying what are the various
// configured default values.
func Limit(c *sql.Conn, id int, newVal int) (r int, err error) {
	err = c.Raw(func(driverConn any) error {
		switch dc := driverConn.(type) {
		case *conn:
			r = dc.limit(id, newVal)
			return nil
		default:
			return fmt.Errorf("unexpected driverConn type: %T", driverConn)
		}
	})
	return r, err

}
