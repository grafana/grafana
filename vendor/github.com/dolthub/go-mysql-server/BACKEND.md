# Custom backend integration guide

This is the guide for creating a new backend to query with
**go-mysql-server**.

## Core interfaces

To create your own data source implementation you need to implement
the following interfaces:

- `sql.DatabaseProvider`. This interface allows the engine to find
  available databases. You can also unlock addtional functionality by
  optionally implementing additional interfaces:
  - `sql.MutableDatabaseProvider` to support creating and dropping
    databases.
  - `sql.CollatedDatabaseProvider` to support database-level
    collations.
- `sql.Database`. These are returned by your
  `sql.DatabaseProvider`. The main job of `sql.Database` is to provide
  tables from your data source. You can also implement other
  interfaces on your database to unlock additional functionality:
  - `sql.TableCreator` to support creating new tables
  - `sql.TableDropper` to support dropping  tables
  - `sql.TableRenamer` to support renaming tables
  - `sql.ViewCreator` to support creating persisted views on your tables
  - `sql.ViewDropper` to support dropping persisted views
- `sql.Table`. This interface will provide rows of values from your
  data source. You can also implement other interfaces on your table
  to unlock additional functionality:
  - `sql.InsertableTable` to allow your data source to be updated with
    `INSERT` statements.
  - `sql.UpdateableTable` to allow your data source to be updated with
    `UPDATE` statements.
  - `sql.DeletableTable` to allow your data source to be updated with
    `DELETE` statements.
  - `sql.ReplaceableTable` to allow your data source to be updated with
    `REPLACE` statements.
  - `sql.AlterableTable` to allow your data source to have its schema
    modified by adding, dropping, and altering columns.
  - `sql.IndexedTable` to declare your table's native indexes to speed
    up query execution.
  - `sql.IndexAlterableTable` to accept the creation of new native
    indexes.
  - `sql.ForeignKeyAlterableTable` to signal your support of foreign
    key constraints in your table's schema and data.
  - `sql.ProjectedTable` to return rows that only contain a subset of
    the columns in the table. This can make query execution faster.
  - `sql.FilteredTable` to filter the rows returned by your table to
    those matching a given expression. This can make query execution
    faster (if your table implementation can filter rows more
    efficiently than checking an expression on every row in a table).
    
This is not a complete list, but should be enough to get you started
on a full backend implementation. For an example of implementing these
interfaces, see the `memory` package.

## Sessions and transactions

Many backend implementations will be able to re-use the
`sql.BaseSession` object for sessioned access to databases. This
should be the case for all read-only database implementations.
However, some backends may need to store session information
particular to that backend, e.g. open data files that have yet to be
written. Such integrators should implement their own `sql.Session`
implementation, and probably should embed `sql.BaseSession` in it to
make that easier.

Backends that want transactional semantics for their queries must also
implement `sql.TransactionSession` in their session object and provide
a corresponding `sql.Transaction` implementation. The details of doing
so are necessarily very specific to a particular backend and are
beyond the scope of this guide.

## Native indexes

Tables can declare that they support native indexes. The `memory`
package contains an example of this behavior, but please note that it
is only for example purposes and doesn't actually make queries faster
(although we could change this in the future).

Integrators should implement the `sql.IndexedTable` interface to
declare which indexes their tables support and provide a means of
returning a subset of the rows. The job of your `sql.Index`
implementation is to accept or reject combinations of `sql.Range`
expressions that it can support, which will be used by the engine to
construct a `sql.IndexLookup` struct to provide to your
`sql.IndexedTable` implementation.

## Custom index driver implementation

Index drivers are separate backends for storing and querying indexes,
without the need for a table to store and query its own native
indexes. To implement a custom index driver you need to implement a
few things:

- `sql.IndexDriver` interface, which will be the driver itself. Not
  that your driver must return an unique ID in the `ID` method. This
  ID is unique for your driver and should not clash with any other
  registered driver. It's the driver's responsibility to be fault
  tolerant and be able to automatically detect and recover from
  corruption in indexes.
- `sql.Index` interface, returned by your driver when an index is
  loaded or created.
- `sql.IndexValueIter` interface, which will be returned by your
  `sql.IndexLookup` and should return the values of the index.
- Don't forget to register the index driver in your `sql.Context`
  using `context.RegisterIndexDriver(mydriver)` to be able to use it.

To create indexes using your custom index driver you need to use
extension syntax `USING driverid` on the index creation statement. For
example:

```sql
CREATE INDEX foo ON table USING driverid (col1, col2)
```

**go-mysql-server** does not provide a production index driver
implementation. We previously provided a pilosa implementation, but
removed it due to the difficulty of supporting it on all platforms
(pilosa doesn't work on Windows).

You can see an example of a driver implementation in the memory
package.

## Testing your backend implementation

**go-mysql-server** provides a suite of engine tests that you can use
to validate that your implementation works as expected. See the
`enginetest` package for details and examples.

It's also possible and encouraged to write engine tests that are
specific to your backend. This is especially important when
implementing transactions, which the in-memory backend doesn't
support.

