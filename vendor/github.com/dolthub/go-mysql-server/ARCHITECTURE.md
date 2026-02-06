# Architecture overview

This document provides an overview of all parts and pieces of the
project as well as how they fit together. It is meant to help new
contributors understand where things may be, and how changes in some
components may interact with other components of the system.

## Root package (`sqle`)

This is where the engine lives. The engine is the piece that
coordinates and makes all other pieces work together as well as the
main API users of the system will use to create and configure an
engine and perform queries.

## Engine tests

Engine tests live in the `enginetest` package, and are written in a
harnessed manner to allow integrators to run them on their own
database implementation. The `memory_engine_test.go` runs these tests
on the built-in in-memory database implementation in the `memory`
package.

### How to add integration tests

Most new features / bug fixes should be tested by adding a new test
query and expected results to the list in `queries.go`.

## `sql`

This package is probably the most important of the project. It has
several main roles:
- Defines the main interfaces used in the rest of the packages `Node`,
  `Expression`, ...
- Provides implementations of components used in the rest of the
  packages `Row`, `Context`, `ProcessList`, `Catalog`, ...
- Defines the `information_schema` database, which is a special
  database and contains some information about the schemas of other
  tables.

### `sql/analyzer`

The analyzer is the most complex component of the project. The
analyzer takes the parsed query plan and transforms it into an
execution plan by running a series of rules. These rules do many
things, such as resolve tables and columns, removing redundant data,
optimizing things for performance, etc.

There are several phases on the analyzer, because some rules need to
be run before others, some need to be executed several times, other
just once, etc.  Inside `rules.go` are all the default rules and the
phases in which they're executed.

On top of that, all available rules are defined in this package. Each
rule has a specific role in the analyzer. Rules should be as small and
atomic as possible and try to do only one job and always produce a
tree that is as resolved as the one it received or more.

### `sql/expression`

This package includes the implementation of all the SQL expressions
available in go-mysql-server, except functions. Arithmetic operators,
logic operators, conversions, etc are implemented here.

Inside `registry.go` there is a registry of all the default functions,
even if they're not defined here.

### `sql/expression/function`

Implementation of all the functions available in go-mysql-server.

### `sql/expression/function/aggregation`

Implementation of all the aggregation functions available in
go-mysql-server.

### `sql/parse`

This package exposes the `Parse` function, which parses a SQL query
and translates it into a query plan.

Parsing is done using `vitess` parser with a few custom additions for
non-standard syntax.

### `sql/plan`

All the different nodes of the execution plan (except for very
specific nodes used in some optimisation rules) are defined here.

For example, `SELECT foo FROM bar` is translated into the following
plan:

```
Project(foo)
 |- Table(bar)
```

Which means, the execution plan is a `Project` node projecting `foo`
and has a `ResolvedTable`, which is `bar` as its children.

Each node inside this package implements at least the `sql.Node`
interface, but it can implement more. `sql.Expressioner`, for example.

Along with the nodes, `Inspect` and `Walk` functions are provided as
utilities to inspect an execution tree.

## `server`

Contains all the code to turn an engine into a runnable server that
can communicate using the MySQL wire protocol.

## `auth`

This package contains all the code related to the audit log,
authentication and permission management in go-mysql-server.

There are two authentication methods:
- **None:** no authentication needed.
- **Native:** authentication performed with user and password. Read,
  write or all permissions can be specified for those users. It can
  also be configured using a JSON file.

## `internal/similartext`

Contains a function to `Find` the most similar name from an array to a
given one using the Levenshtein distance algorithm. Used for
suggestions on errors.

## `_integration`

To ensure compatibility with some clients, there is a small example
connecting and querying a go-mysql-server server from those
clients. Each folder corresponds to a different client.

For more info about supported clients see
[SUPPORTED_CLIENTS.md](/SUPPORTED_CLIENTS.md).

These integrations tests can be run using this command:

```
make TEST=${CLIENT FOLDER NAME} integration
```

It will take care of setting up the test server and shutting it down.

## `_example`

A small example of how to use go-mysql-server to create a server and
run it.

# Connecting the dots

`server` uses the engine defined in `sql`.

Engine uses audit logs and authentication defined in `auth`, parses
using `sql/parse` to convert a query into a query plan, with nodes
defined in `sql/plan` and expressions defined in `sql/expression`,
`sql/expression/function` and `sql/expression/function/aggregation`.

After parsing, the obtained query plan is analyzed using the analyzer
defined in `sql/analyzer` and its rules to resolve tables, fields,
databases, apply optimisation rules, etc.

If indexes can be used, the analyzer will transform the query so it
uses indexes (either supplied natively by tables or provided by an
external driver).

Once the plan is analyzed, it will be executed recursively from the
top of the tree to the bottom to obtain the results and they will be
sent back to the client using the MySQL wire protocol.
