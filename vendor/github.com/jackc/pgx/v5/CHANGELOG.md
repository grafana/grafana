# 5.7.6 (September 8, 2025)

* Use ParseConfigError in pgx.ParseConfig and pgxpool.ParseConfig (Yurasov Ilia)
* Add PrepareConn hook to pgxpool (Jonathan Hall)
* Reduce allocations in QueryContext (Dominique Lefevre)
* Add MarshalJSON and UnmarshalJSON for pgtype.Uint32 (Panos Koutsovasilis)
* Configure ping behavior on pgxpool with ShouldPing (Christian Kiely)
* zeronull int types implement Int64Valuer and Int64Scanner (Li Zeghong)
* Fix panic when receiving terminate connection message during CopyFrom (Michal Drausowski)
* Fix statement cache not being invalidated on error during batch (Muhammadali Nazarov)

# 5.7.5 (May 17, 2025)

* Support sslnegotiation connection option (divyam234)
* Update golang.org/x/crypto to v0.37.0. This placates security scanners that were unable to see that pgx did not use the behavior affected by https://pkg.go.dev/vuln/GO-2025-3487.
* TraceLog now logs Acquire and Release at the debug level (dave sinclair)
* Add support for PGTZ environment variable
* Add support for PGOPTIONS environment variable
* Unpin memory used by Rows quicker
* Remove PlanScan memoization. This resolves a rare issue where scanning could be broken for one type by first scanning another. The problem was in the memoization system and benchmarking revealed that memoization was not providing any meaningful benefit.

# 5.7.4 (March 24, 2025)

* Fix / revert change to scanning JSON `null` (Felix Röhrich)

# 5.7.3 (March 21, 2025)

* Expose EmptyAcquireWaitTime in pgxpool.Stat (vamshiaruru32)
* Improve SQL sanitizer performance (ninedraft)
* Fix Scan confusion with json(b), sql.Scanner, and automatic dereferencing (moukoublen, felix-roehrich)
* Fix Values() for xml type always returning nil instead of []byte
* Add ability to send Flush message in pipeline mode (zenkovev)
* Fix pgtype.Timestamp's JSON behavior to match PostgreSQL (pconstantinou)
* Better error messages when scanning structs (logicbomb)
* Fix handling of error on batch write (bonnefoa)
* Match libpq's connection fallback behavior more closely (felix-roehrich)
* Add MinIdleConns to pgxpool (djahandarie)

# 5.7.2 (December 21, 2024)

* Fix prepared statement already exists on batch prepare failure
* Add commit query to tx options (Lucas Hild)
* Fix pgtype.Timestamp json unmarshal (Shean de Montigny-Desautels)
* Add message body size limits in frontend and backend (zene)
* Add xid8 type
* Ensure planning encodes and scans cannot infinitely recurse
* Implement pgtype.UUID.String() (Konstantin Grachev)
* Switch from ExecParams to Exec in ValidateConnectTargetSessionAttrs functions (Alexander Rumyantsev)
* Update golang.org/x/crypto
* Fix json(b) columns prefer sql.Scanner interface like database/sql (Ludovico Russo)

# 5.7.1 (September 10, 2024)

* Fix data race in tracelog.TraceLog
* Update puddle to v2.2.2. This removes the import of nanotime via linkname.
* Update golang.org/x/crypto and golang.org/x/text

# 5.7.0 (September 7, 2024)

* Add support for sslrootcert=system (Yann Soubeyrand)
* Add LoadTypes to load multiple types in a single SQL query (Nick Farrell)
* Add XMLCodec supports encoding + scanning XML column type like json (nickcruess-soda)
* Add MultiTrace (Stepan Rabotkin)
* Add TraceLogConfig with customizable TimeKey (stringintech)
* pgx.ErrNoRows wraps sql.ErrNoRows to aid in database/sql compatibility with native pgx functions (merlin)
* Support scanning binary formatted uint32 into string / TextScanner (jennifersp)
* Fix interval encoding to allow 0s and avoid extra spaces (Carlos Pérez-Aradros Herce)
* Update pgservicefile - fixes panic when parsing invalid file
* Better error message when reading past end of batch
* Don't print url when url.Parse returns an error (Kevin Biju)
* Fix snake case name normalization collision in RowToStructByName with db tag (nolandseigler)
* Fix: Scan and encode types with underlying types of arrays

# 5.6.0 (May 25, 2024)

* Add StrictNamedArgs (Tomas Zahradnicek)
* Add support for macaddr8 type (Carlos Pérez-Aradros Herce)
* Add SeverityUnlocalized field to PgError / Notice
* Performance optimization of RowToStructByPos/Name (Zach Olstein)
* Allow customizing context canceled behavior for pgconn
* Add ScanLocation to pgtype.Timestamp[tz]Codec
* Add custom data to pgconn.PgConn
* Fix ResultReader.Read() to handle nil values
* Do not encode interval microseconds when they are 0 (Carlos Pérez-Aradros Herce)
* pgconn.SafeToRetry checks for wrapped errors (tjasko)
* Failed connection attempts include all errors
* Optimize LargeObject.Read (Mitar)
* Add tracing for connection acquire and release from pool (ngavinsir)
* Fix encode driver.Valuer not called when nil
* Add support for custom JSON marshal and unmarshal (Mitar)
* Use Go default keepalive for TCP connections (Hans-Joachim Kliemeck)

# 5.5.5 (March 9, 2024)

Use spaces instead of parentheses for SQL sanitization.

This still solves the problem of negative numbers creating a line comment, but this avoids breaking edge cases such as
`set foo to $1` where the substitution is taking place in a location where an arbitrary expression is not allowed.

# 5.5.4 (March 4, 2024)

Fix CVE-2024-27304

SQL injection can occur if an attacker can cause a single query or bind message to exceed 4 GB in size. An integer
overflow in the calculated message size can cause the one large message to be sent as multiple messages under the
attacker's control.

Thanks to Paul Gerste for reporting this issue.

* Fix behavior of CollectRows to return empty slice if Rows are empty (Felix)
* Fix simple protocol encoding of json.RawMessage
* Fix *Pipeline.getResults should close pipeline on error
* Fix panic in TryFindUnderlyingTypeScanPlan (David Kurman)
* Fix deallocation of invalidated cached statements in a transaction
* Handle invalid sslkey file
* Fix scan float4 into sql.Scanner
* Fix pgtype.Bits not making copy of data from read buffer. This would cause the data to be corrupted by future reads.

# 5.5.3 (February 3, 2024)

* Fix: prepared statement already exists
* Improve CopyFrom auto-conversion of text-ish values
* Add ltree type support (Florent Viel)
* Make some properties of Batch and QueuedQuery public (Pavlo Golub)
* Add AppendRows function (Edoardo Spadolini)
* Optimize convert UUID [16]byte to string (Kirill Malikov)
* Fix: LargeObject Read and Write of more than ~1GB at a time (Mitar)

# 5.5.2 (January 13, 2024)

* Allow NamedArgs to start with underscore
* pgproto3: Maximum message body length support (jeremy.spriet)
* Upgrade golang.org/x/crypto to v0.17.0
* Add snake_case support to RowToStructByName (Tikhon Fedulov)
* Fix: update description cache after exec prepare (James Hartig)
* Fix: pipeline checks if it is closed (James Hartig and Ryan Fowler)
* Fix: normalize timeout / context errors during TLS startup (Samuel Stauffer)
* Add OnPgError for easier centralized error handling (James Hartig)

# 5.5.1 (December 9, 2023)

* Add CopyFromFunc helper function. (robford)
* Add PgConn.Deallocate method that uses PostgreSQL protocol Close message.
* pgx uses new PgConn.Deallocate method. This allows deallocating statements to work in a failed transaction. This fixes a case where the prepared statement map could become invalid.
* Fix: Prefer driver.Valuer over json.Marshaler for json fields. (Jacopo)
* Fix: simple protocol SQL sanitizer previously panicked if an invalid $0 placeholder was used. This now returns an error instead. (maksymnevajdev)
* Add pgtype.Numeric.ScanScientific (Eshton Robateau)

# 5.5.0 (November 4, 2023)

* Add CollectExactlyOneRow. (Julien GOTTELAND)
* Add OpenDBFromPool to create *database/sql.DB from *pgxpool.Pool. (Lev Zakharov)
* Prepare can automatically choose statement name based on sql. This makes it easier to explicitly manage prepared statements.
* Statement cache now uses deterministic, stable statement names.
* database/sql prepared statement names are deterministically generated.
* Fix: SendBatch wasn't respecting context cancellation.
* Fix: Timeout error from pipeline is now normalized.
* Fix: database/sql encoding json.RawMessage to []byte.
* CancelRequest: Wait for the cancel request to be acknowledged by the server. This should improve PgBouncer compatibility. (Anton Levakin)
* stdlib: Use Ping instead of CheckConn in ResetSession
* Add json.Marshaler and json.Unmarshaler for Float4, Float8 (Kirill Mironov)

# 5.4.3 (August 5, 2023)

* Fix: QCharArrayOID was defined with the wrong OID (Christoph Engelbert)
* Fix: connect_timeout for sslmode=allow|prefer (smaher-edb)
* Fix: pgxpool: background health check cannot overflow pool
* Fix: Check for nil in defer when sending batch (recover properly from panic)
* Fix: json scan of non-string pointer to pointer
* Fix: zeronull.Timestamptz should use pgtype.Timestamptz
* Fix: NewConnsCount was not correctly counting connections created by Acquire directly. (James Hartig)
* RowTo(AddrOf)StructByPos ignores fields with "-" db tag
* Optimization: improve text format numeric parsing (horpto)

# 5.4.2 (July 11, 2023)

* Fix: RowScanner errors are fatal to Rows
* Fix: Enable failover efforts when pg_hba.conf disallows non-ssl connections (Brandon Kauffman)
* Hstore text codec internal improvements (Evan Jones)
* Fix: Stop timers for background reader when not in use. Fixes memory leak when closing connections (Adrian-Stefan Mares)
* Fix: Stop background reader as soon as possible.
* Add PgConn.SyncConn(). This combined with the above fix makes it safe to directly use the underlying net.Conn.

# 5.4.1 (June 18, 2023)

* Fix: concurrency bug with pgtypeDefaultMap and simple protocol (Lev Zakharov)
* Add TxOptions.BeginQuery to allow overriding the default BEGIN query

# 5.4.0 (June 14, 2023)

* Replace platform specific syscalls for non-blocking IO with more traditional goroutines and deadlines. This returns to the v4 approach with some additional improvements and fixes. This restores the ability to use a pgx.Conn over an ssh.Conn as well as other non-TCP or Unix socket connections. In addition, it is a significantly simpler implementation that is less likely to have cross platform issues.
* Optimization: The default type registrations are now shared among all connections. This saves about 100KB of memory per connection. `pgtype.Type` and `pgtype.Codec` values are now required to be immutable after registration. This was already necessary in most cases but wasn't documented until now. (Lev Zakharov)
* Fix: Ensure pgxpool.Pool.QueryRow.Scan releases connection on panic
* CancelRequest: don't try to read the reply (Nicola Murino)
* Fix: correctly handle bool type aliases (Wichert Akkerman)
* Fix: pgconn.CancelRequest: Fix unix sockets: don't use RemoteAddr()
* Fix: pgx.Conn memory leak with prepared statement caching (Evan Jones)
* Add BeforeClose to pgxpool.Pool (Evan Cordell)
* Fix: various hstore fixes and optimizations (Evan Jones)
* Fix: RowToStructByPos with embedded unexported struct
* Support different bool string representations (Lev Zakharov)
* Fix: error when using BatchResults.Exec on a select that returns an error after some rows.
* Fix: pipelineBatchResults.Exec() not returning error from ResultReader
* Fix: pipeline batch results not closing pipeline when error occurs while reading directly from results instead of using
    a callback.
* Fix: scanning a table type into a struct
* Fix: scan array of record to pointer to slice of struct
* Fix: handle null for json (Cemre Mengu)
* Batch Query callback is called even when there is an error
* Add RowTo(AddrOf)StructByNameLax (Audi P. Risa P)

# 5.3.1 (February 27, 2023)

* Fix: Support v4 and v5 stdlib in same program (Tomáš Procházka)
* Fix: sql.Scanner not being used in certain cases
* Add text format jsonpath support
* Fix: fake non-blocking read adaptive wait time

# 5.3.0 (February 11, 2023)

* Fix: json values work with sql.Scanner
* Fixed / improved error messages (Mark Chambers and Yevgeny Pats)
* Fix: support scan into single dimensional arrays
* Fix: MaxConnLifetimeJitter setting actually jitter (Ben Weintraub)
* Fix: driver.Value representation of bytea should be []byte not string
* Fix: better handling of unregistered OIDs
* CopyFrom can use query cache to avoid extra round trip to get OIDs (Alejandro Do Nascimento Mora)
* Fix: encode to json ignoring driver.Valuer
* Support sql.Scanner on renamed base type
* Fix: pgtype.Numeric text encoding of negative numbers (Mark Chambers)
* Fix: connect with multiple hostnames when one can't be resolved
* Upgrade puddle to remove dependency on uber/atomic and fix alignment issue on 32-bit platform
* Fix: scanning json column into **string
* Multiple reductions in memory allocations
* Fake non-blocking read adapts its max wait time
* Improve CopyFrom performance and reduce memory usage
* Fix: encode []any to array
* Fix: LoadType for composite with dropped attributes (Felix Röhrich)
* Support v4 and v5 stdlib in same program
* Fix: text format array decoding with string of "NULL"
* Prefer binary format for arrays

# 5.2.0 (December 5, 2022)

* `tracelog.TraceLog` implements the pgx.PrepareTracer interface. (Vitalii Solodilov)
* Optimize creating begin transaction SQL string (Petr Evdokimov and ksco)
* `Conn.LoadType` supports range and multirange types (Vitalii Solodilov)
* Fix scan `uint` and `uint64` `ScanNumeric`. This resolves a PostgreSQL `numeric` being incorrectly scanned into `uint` and `uint64`.

# 5.1.1 (November 17, 2022)

* Fix simple query sanitizer where query text contains a Unicode replacement character.
* Remove erroneous `name` argument from `DeallocateAll()`. Technically, this is a breaking change, but given that method was only added 5 days ago this change was accepted. (Bodo Kaiser)

# 5.1.0 (November 12, 2022)

* Update puddle to v2.1.2. This resolves a race condition and a deadlock in pgxpool.
* `QueryRewriter.RewriteQuery` now returns an error. Technically, this is a breaking change for any external implementers, but given the minimal likelihood that there are actually any external implementers this change was accepted.
* Expose `GetSSLPassword` support to pgx.
* Fix encode `ErrorResponse` unknown field handling. This would only affect pgproto3 being used directly as a proxy with a non-PostgreSQL server that included additional error fields.
* Fix date text format encoding with 5 digit years.
* Fix date values passed to a `sql.Scanner` as `string` instead of `time.Time`.
* DateCodec.DecodeValue can return `pgtype.InfinityModifier` instead of `string` for infinite values. This now matches the behavior of the timestamp types.
* Add domain type support to `Conn.LoadType()`.
* Add `RowToStructByName` and `RowToAddrOfStructByName`. (Pavlo Golub)
* Add `Conn.DeallocateAll()` to clear all prepared statements including the statement cache. (Bodo Kaiser)

# 5.0.4 (October 24, 2022)

* Fix: CollectOneRow prefers PostgreSQL error over pgx.ErrorNoRows
* Fix: some reflect Kind checks to first check for nil
* Bump golang.org/x/text dependency to placate snyk
* Fix: RowToStructByPos on structs with multiple anonymous sub-structs (Baptiste Fontaine)
* Fix: Exec checks if tx is closed

# 5.0.3 (October 14, 2022)

* Fix `driver.Valuer` handling edge cases that could cause infinite loop or crash

# v5.0.2 (October 8, 2022)

* Fix date encoding in text format to always use 2 digits for month and day
* Prefer driver.Valuer over wrap plans when encoding
* Fix scan to pointer to pointer to renamed type
* Allow scanning NULL even if PG and Go types are incompatible

# v5.0.1 (September 24, 2022)

* Fix 32-bit atomic usage
* Add MarshalJSON for Float8 (yogipristiawan)
* Add `[` and `]` to text encoding of `Lseg`
* Fix sqlScannerWrapper NULL handling

# v5.0.0 (September 17, 2022)

## Merged Packages

`github.com/jackc/pgtype`, `github.com/jackc/pgconn`, and `github.com/jackc/pgproto3` are now included in the main
`github.com/jackc/pgx` repository. Previously there was confusion as to where issues should be reported, additional
release work due to releasing multiple packages, and less clear changelogs.

## pgconn

`CommandTag` is now an opaque type instead of directly exposing an underlying `[]byte`.

The return value `ResultReader.Values()` is no longer safe to retain a reference to after a subsequent call to `NextRow()` or `Close()`.

`Trace()` method adds low level message tracing similar to the `PQtrace` function in `libpq`.

pgconn now uses non-blocking IO. This is a significant internal restructuring, but it should not cause any visible changes on its own. However, it is important in implementing other new features.

`CheckConn()` checks a connection's liveness by doing a non-blocking read. This can be used to detect database restarts or network interruptions without executing a query or a ping.

pgconn now supports pipeline mode.

`*PgConn.ReceiveResults` removed. Use pipeline mode instead.

`Timeout()` no longer considers `context.Canceled` as a timeout error. `context.DeadlineExceeded` still is considered a timeout error.

## pgxpool

`Connect` and `ConnectConfig` have been renamed to `New` and `NewWithConfig` respectively. The `LazyConnect` option has been removed. Pools always lazily connect.

## pgtype

The `pgtype` package has been significantly changed.

### NULL Representation

Previously, types had a `Status` field that could be `Undefined`, `Null`, or `Present`. This has been changed to a
`Valid` `bool` field to harmonize with how `database/sql` represents `NULL` and to make the zero value useable.

Previously, a type that implemented `driver.Valuer` would have the `Value` method called even on a nil pointer. All nils
whether typed or untyped now represent `NULL`.

### Codec and Value Split

Previously, the type system combined decoding and encoding values with the value types. e.g. Type `Int8` both handled
encoding and decoding the PostgreSQL representation and acted as a value object. This caused some difficulties when
there was not an exact 1 to 1 relationship between the Go types and the PostgreSQL types For example, scanning a
PostgreSQL binary `numeric` into a Go `float64` was awkward (see https://github.com/jackc/pgtype/issues/147). This
concepts have been separated. A `Codec` only has responsibility for encoding and decoding values. Value types are
generally defined by implementing an interface that a particular `Codec` understands (e.g. `PointScanner` and
`PointValuer` for the PostgreSQL `point` type).

### Array Types

All array types are now handled by `ArrayCodec` instead of using code generation for each new array type. This also
means that less common array types such as `point[]` are now supported. `Array[T]` supports PostgreSQL multi-dimensional
arrays.

### Composite Types

Composite types must be registered before use. `CompositeFields` may still be used to construct and destruct composite
values, but any type may now implement `CompositeIndexGetter` and `CompositeIndexScanner` to be used as a composite.

### Range Types

Range types are now handled with types `RangeCodec` and `Range[T]`. This allows additional user defined range types to
easily be handled. Multirange types are handled similarly with `MultirangeCodec` and `Multirange[T]`.

### pgxtype

`LoadDataType` moved to `*Conn` as `LoadType`.

### Bytea

The `Bytea` and `GenericBinary` types have been replaced. Use the following instead:

* `[]byte` - For normal usage directly use `[]byte`.
* `DriverBytes` - Uses driver memory only available until next database method call. Avoids a copy and an allocation.
* `PreallocBytes` - Uses preallocated byte slice to avoid an allocation.
* `UndecodedBytes` - Avoids any decoding. Allows working with raw bytes.

### Dropped lib/pq Support

`pgtype` previously supported and was tested against [lib/pq](https://github.com/lib/pq). While it will continue to work
in most cases this is no longer supported.

### database/sql Scan

Previously, most `Scan` implementations would convert `[]byte` to `string` automatically to decode a text value. Now
only `string` is handled. This is to allow the possibility of future binary support in `database/sql` mode by
considering `[]byte` to be binary format and `string` text format. This change should have no effect for any use with
`pgx`. The previous behavior was only necessary for `lib/pq` compatibility.

Added `*Map.SQLScanner` to create a `sql.Scanner` for types such as `[]int32` and `Range[T]` that do not implement
`sql.Scanner` directly.

### Number Type Fields Include Bit size

`Int2`, `Int4`, `Int8`, `Float4`, `Float8`, and `Uint32` fields now include bit size. e.g. `Int` is renamed to `Int64`.
This matches the convention set by `database/sql`. In addition, for comparable types like `pgtype.Int8` and
`sql.NullInt64` the structures are identical. This means they can be directly converted one to another.

### 3rd Party Type Integrations

* Extracted integrations with https://github.com/shopspring/decimal and https://github.com/gofrs/uuid to
  https://github.com/jackc/pgx-shopspring-decimal and https://github.com/jackc/pgx-gofrs-uuid respectively. This trims
  the pgx dependency tree.

### Other Changes

* `Bit` and `Varbit` are both replaced by the `Bits` type.
* `CID`, `OID`, `OIDValue`, and `XID` are replaced by the `Uint32` type.
* `Hstore` is now defined as `map[string]*string`.
* `JSON` and `JSONB` types removed. Use `[]byte` or `string` directly.
* `QChar` type removed. Use `rune` or `byte` directly.
* `Inet` and `Cidr` types removed. Use `netip.Addr` and `netip.Prefix` directly. These types are more memory efficient than the previous `net.IPNet`.
* `Macaddr` type removed. Use `net.HardwareAddr` directly.
* Renamed `pgtype.ConnInfo` to `pgtype.Map`.
* Renamed `pgtype.DataType` to `pgtype.Type`.
* Renamed `pgtype.None` to `pgtype.Finite`.
* `RegisterType` now accepts a `*Type` instead of `Type`.
* Assorted array helper methods and types made private.

## stdlib

* Removed `AcquireConn` and `ReleaseConn` as that functionality has been built in since Go 1.13.

## Reduced Memory Usage by Reusing Read Buffers

Previously, the connection read buffer would allocate large chunks of memory and never reuse them. This allowed
transferring ownership to anything such as scanned values without incurring an additional allocation and memory copy.
However, this came at the cost of overall increased memory allocation size. But worse it was also possible to pin large
chunks of memory by retaining a reference to a small value that originally came directly from the read buffer. Now
ownership remains with the read buffer and anything needing to retain a value must make a copy.

## Query Execution Modes

Control over automatic prepared statement caching and simple protocol use are now combined into query execution mode.
See documentation for `QueryExecMode`.

## QueryRewriter Interface and NamedArgs

pgx now supports named arguments with the `NamedArgs` type. This is implemented via the new `QueryRewriter` interface which
allows arbitrary rewriting of query SQL and arguments.

## RowScanner Interface

The `RowScanner` interface allows a single argument to Rows.Scan to scan the entire row.

## Rows Result Helpers

* `CollectRows` and `RowTo*` functions simplify collecting results into a slice.
* `CollectOneRow` collects one row using `RowTo*` functions.
* `ForEachRow` simplifies scanning each row and executing code using the scanned values. `ForEachRow` replaces `QueryFunc`.

## Tx Helpers

Rather than every type that implemented `Begin` or `BeginTx` methods also needing to implement `BeginFunc` and
`BeginTxFunc` these methods have been converted to functions that take a db that implements `Begin` or `BeginTx`.

## Improved Batch Query Ergonomics

Previously, the code for building a batch went in one place before the call to `SendBatch`, and the code for reading the
results went in one place after the call to `SendBatch`. This could make it difficult to match up the query and the code
to handle the results. Now `Queue` returns a `QueuedQuery` which has methods `Query`, `QueryRow`, and `Exec` which can
be used to register a callback function that will handle the result. Callback functions are called automatically when
`BatchResults.Close` is called.

## SendBatch Uses Pipeline Mode When Appropriate

Previously, a batch with 10 unique parameterized statements executed 100 times would entail 11 network round trips. 1
for each prepare / describe and 1 for executing them all. Now pipeline mode is used to prepare / describe all statements
in a single network round trip. So it would only take 2 round trips.

## Tracing and Logging

Internal logging support has been replaced with tracing hooks. This allows custom tracing integration with tools like OpenTelemetry. Package tracelog provides an adapter for pgx v4 loggers to act as a tracer.

All integrations with 3rd party loggers have been extracted to separate repositories. This trims the pgx dependency
tree.
