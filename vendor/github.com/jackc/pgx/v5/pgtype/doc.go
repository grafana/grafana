// Package pgtype converts between Go and PostgreSQL values.
/*
The primary type is the Map type. It is a map of PostgreSQL types identified by OID (object ID) to a Codec. A Codec is
responsible for converting between Go and PostgreSQL values. NewMap creates a Map with all supported standard PostgreSQL
types already registered. Additional types can be registered with Map.RegisterType.

Use Map.Scan and Map.Encode to decode PostgreSQL values to Go and encode Go values to PostgreSQL respectively.

Base Type Mapping

pgtype maps between all common base types directly between Go and PostgreSQL. In particular:

    Go           PostgreSQL
    -----------------------
    string        varchar
                  text

    // Integers are automatically be converted to any other integer type if
    // it can be done without overflow or underflow.
    int8
    int16         smallint
    int32         int
    int64         bigint
    int
    uint8
    uint16
    uint32
    uint64
    uint

    // Floats are strict and do not automatically convert like integers.
    float32       float4
    float64       float8

    time.Time     date
                  timestamp
                  timestamptz

    netip.Addr    inet
    netip.Prefix  cidr

    []byte        bytea

Null Values

pgtype can map NULLs in two ways. The first is types that can directly represent NULL such as Int4. They work in a
similar fashion to database/sql. The second is to use a pointer to a pointer.

    var foo pgtype.Text
    var bar *string
    err := conn.QueryRow("select foo, bar from widgets where id=$1", 42).Scan(&foo, &bar)
    if err != nil {
        return err
    }

When using nullable pgtype types as parameters for queries, one has to remember to explicitly set their Valid field to
true, otherwise the parameter's value will be NULL.

JSON Support

pgtype automatically marshals and unmarshals data from json and jsonb PostgreSQL types.

Extending Existing PostgreSQL Type Support

Generally, all Codecs will support interfaces that can be implemented to enable scanning and encoding. For example,
PointCodec can use any Go type that implements the PointScanner and PointValuer interfaces. So rather than use
pgtype.Point and application can directly use its own point type with pgtype as long as it implements those interfaces.

See example_custom_type_test.go for an example of a custom type for the PostgreSQL point type.

Sometimes pgx supports a PostgreSQL type such as numeric but the Go type is in an external package that does not have
pgx support such as github.com/shopspring/decimal. These types can be registered with pgtype with custom conversion
logic. See https://github.com/jackc/pgx-shopspring-decimal and https://github.com/jackc/pgx-gofrs-uuid for example
integrations.

New PostgreSQL Type Support

pgtype uses the PostgreSQL OID to determine how to encode or decode a value. pgtype supports array, composite, domain,
and enum types. However, any type created in PostgreSQL with CREATE TYPE will receive a new OID. This means that the OID
of each new PostgreSQL type must be registered for pgtype to handle values of that type with the correct Codec.

The pgx.Conn LoadType method can return a *Type for array, composite, domain, and enum types by inspecting the database
metadata. This *Type can then be registered with Map.RegisterType.

For example, the following function could be called after a connection is established:

    func RegisterDataTypes(ctx context.Context, conn *pgx.Conn) error {
      dataTypeNames := []string{
        "foo",
        "_foo",
        "bar",
        "_bar",
      }

      for _, typeName := range dataTypeNames {
        dataType, err := conn.LoadType(ctx, typeName)
        if err != nil {
          return err
        }
        conn.TypeMap().RegisterType(dataType)
      }

      return nil
    }

A type cannot be registered unless all types it depends on are already registered. e.g. An array type cannot be
registered until its element type is registered.

ArrayCodec implements support for arrays. If pgtype supports type T then it can easily support []T by registering an
ArrayCodec for the appropriate PostgreSQL OID. In addition, Array[T] type can support multi-dimensional arrays.

CompositeCodec implements support for PostgreSQL composite types. Go structs can be scanned into if the public fields of
the struct are in the exact order and type of the PostgreSQL type or by implementing CompositeIndexScanner and
CompositeIndexGetter.

Domain types are treated as their underlying type if the underlying type and the domain type are registered.

PostgreSQL enums can usually be treated as text. However, EnumCodec implements support for interning strings which can
reduce memory usage.

While pgtype will often still work with unregistered types it is highly recommended that all types be registered due to
an improvement in performance and the elimination of certain edge cases.

If an entirely new PostgreSQL type (e.g. PostGIS types) is used then the application or a library can create a new
Codec. Then the OID / Codec mapping can be registered with Map.RegisterType. There is no difference between a Codec
defined and registered by the application and a Codec built in to pgtype. See any of the Codecs in pgtype for Codec
examples and for examples of type registration.

Encoding Unknown Types

pgtype works best when the OID of the PostgreSQL type is known. But in some cases such as using the simple protocol the
OID is unknown. In this case Map.RegisterDefaultPgType can be used to register an assumed OID for a particular Go type.

Renamed Types

If pgtype does not recognize a type and that type is a renamed simple type simple (e.g. type MyInt32 int32) pgtype acts
as if it is the underlying type. It currently cannot automatically detect the underlying type of renamed structs (eg.g.
type MyTime time.Time).

Compatibility with database/sql

pgtype also includes support for custom types implementing the database/sql.Scanner and database/sql/driver.Valuer
interfaces.

Encoding Typed Nils

pgtype encodes untyped and typed nils (e.g. nil and []byte(nil)) to the SQL NULL value without going through the Codec
system. This means that Codecs and other encoding logic do not have to handle nil or *T(nil).

However, database/sql compatibility requires Value to be called on T(nil) when T implements driver.Valuer. Therefore,
driver.Valuer values are only considered NULL when *T(nil) where driver.Valuer is implemented on T not on *T. See
https://github.com/golang/go/issues/8415 and
https://github.com/golang/go/commit/0ce1d79a6a771f7449ec493b993ed2a720917870.

Child Records

pgtype's support for arrays and composite records can be used to load records and their children in a single query.  See
example_child_records_test.go for an example.

Overview of Scanning Implementation

The first step is to use the OID to lookup the correct Codec. The Map will call the Codec's PlanScan method to get a
plan for scanning into the Go value. A Codec will support scanning into one or more Go types. Oftentime these Go types
are interfaces rather than explicit types. For example, PointCodec can use any Go type that implements the PointScanner
and PointValuer interfaces.

If a Go value is not supported directly by a Codec then Map will try see if it is a sql.Scanner. If is then that
interface will be used to scan the value. Most sql.Scanners require the input to be in the text format (e.g. UUIDs and
numeric). However, pgx will typically have received the value in the binary format. In this case the binary value will be
parsed, reencoded as text, and then passed to the sql.Scanner. This may incur additional overhead for query results with
a large number of affected values.

If a Go value is not supported directly by a Codec then Map will try wrapping it with additional logic and try again.
For example, Int8Codec does not support scanning into a renamed type (e.g. type myInt64 int64). But Map will detect that
myInt64 is a renamed type and create a plan that converts the value to the underlying int64 type and then passes that to
the Codec (see TryFindUnderlyingTypeScanPlan).

These plan wrappers are contained in Map.TryWrapScanPlanFuncs. By default these contain shared logic to handle renamed
types, pointers to pointers, slices, composite types, etc. Additional plan wrappers can be added to seamlessly integrate
types that do not support pgx directly. For example, the before mentioned
https://github.com/jackc/pgx-shopspring-decimal package detects decimal.Decimal values, wraps them in something
implementing NumericScanner and passes that to the Codec.

Map.Scan and Map.Encode are convenience methods that wrap Map.PlanScan and Map.PlanEncode.  Determining how to scan or
encode a particular type may be a time consuming operation. Hence the planning and execution steps of a conversion are
internally separated.

Reducing Compiled Binary Size

pgx.QueryExecModeExec and pgx.QueryExecModeSimpleProtocol require the default PostgreSQL type to be registered for each
Go type used as a query parameter. By default pgx does this for all supported types and their array variants. If an
application does not use those query execution modes or manually registers the default PostgreSQL type for the types it
uses as query parameters it can use the build tag nopgxregisterdefaulttypes. This omits the default type registration
and reduces the compiled binary size by ~2MB.
*/
package pgtype
