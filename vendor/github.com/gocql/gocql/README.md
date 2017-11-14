gocql
=====

[![Join the chat at https://gitter.im/gocql/gocql](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/gocql/gocql?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/gocql/gocql.svg?branch=master)](https://travis-ci.org/gocql/gocql)
[![GoDoc](https://godoc.org/github.com/gocql/gocql?status.svg)](https://godoc.org/github.com/gocql/gocql)

Package gocql implements a fast and robust Cassandra client for the
Go programming language.

Project Website: https://gocql.github.io/<br>
API documentation: https://godoc.org/github.com/gocql/gocql<br>
Discussions: https://groups.google.com/forum/#!forum/gocql

Supported Versions
------------------

The following matrix shows the versions of Go and Cassandra that are tested with the integration test suite as part of the CI build:

Go/Cassandra | 2.1.x | 2.2.x | 3.0.x
-------------| -------| ------| ---------
1.8  | yes | yes | yes
1.9  | yes | yes | yes

Gocql has been tested in production against many different versions of Cassandra. Due to limits in our CI setup we only test against the latest 3 major releases, which coincide with the official support from the Apache project.

Sunsetting Model
----------------

In general, the gocql team will focus on supporting the current and previous versions of Go. gocql may still work with older versions of Go, but official support for these versions will have been sunset.

Installation
------------

    go get github.com/gocql/gocql


Features
--------

* Modern Cassandra client using the native transport
* Automatic type conversions between Cassandra and Go
  * Support for all common types including sets, lists and maps
  * Custom types can implement a `Marshaler` and `Unmarshaler` interface
  * Strict type conversions without any loss of precision
  * Built-In support for UUIDs (version 1 and 4)
* Support for logged, unlogged and counter batches
* Cluster management
  * Automatic reconnect on connection failures with exponential falloff
  * Round robin distribution of queries to different hosts
  * Round robin distribution of queries to different connections on a host
  * Each connection can execute up to n concurrent queries (whereby n is the limit set by the protocol version the client chooses to use)
  * Optional automatic discovery of nodes
  * Policy based connection pool with token aware and round-robin policy implementations
* Support for password authentication
* Iteration over paged results with configurable page size
* Support for TLS/SSL
* Optional frame compression (using snappy)
* Automatic query preparation
* Support for query tracing
* Support for Cassandra 2.1+ [binary protocol version 3](https://github.com/apache/cassandra/blob/trunk/doc/native_protocol_v3.spec)
  * Support for up to 32768 streams
  * Support for tuple types
  * Support for client side timestamps by default
  * Support for UDTs via a custom marshaller or struct tags
* Support for Cassandra 3.0+ [binary protocol version 4](https://github.com/apache/cassandra/blob/trunk/doc/native_protocol_v4.spec)
* An API to access the schema metadata of a given keyspace

Performance
-----------
While the driver strives to be highly performant, there are cases where it is difficult to test and verify. The driver is built
with maintainability and code readability in mind first and then performance and features, as such every now and then performance
may degrade, if this occurs please report and issue and it will be looked at and remedied. The only time the driver copies data from
its read buffer is when it Unmarshal's data into supplied types.

Some tips for getting more performance from the driver:
* Use the TokenAware policy
* Use many goroutines when doing inserts, the driver is asynchronous but provides a synchronous API, it can execute many queries concurrently
* Tune query page size
* Reading data from the network to unmarshal will incur a large amount of allocations, this can adversely affect the garbage collector, tune `GOGC`
* Close iterators after use to recycle byte buffers

Important Default Keyspace Changes
----------------------------------
gocql no longer supports executing "use <keyspace>" statements to simplify the library. The user still has the
ability to define the default keyspace for connections but now the keyspace can only be defined before a
session is created. Queries can still access keyspaces by indicating the keyspace in the query:
```sql
SELECT * FROM example2.table;
```

Example of correct usage:
```go
	cluster := gocql.NewCluster("192.168.1.1", "192.168.1.2", "192.168.1.3")
	cluster.Keyspace = "example"
	...
	session, err := cluster.CreateSession()

```
Example of incorrect usage:
```go
	cluster := gocql.NewCluster("192.168.1.1", "192.168.1.2", "192.168.1.3")
	cluster.Keyspace = "example"
	...
	session, err := cluster.CreateSession()

	if err = session.Query("use example2").Exec(); err != nil {
		log.Fatal(err)
	}
```
This will result in an err being returned from the session.Query line as the user is trying to execute a "use"
statement.

Example
-------

```go
/* Before you execute the program, Launch `cqlsh` and execute:
create keyspace example with replication = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
create table example.tweet(timeline text, id UUID, text text, PRIMARY KEY(id));
create index on example.tweet(timeline);
*/
package main

import (
	"fmt"
	"log"

	"github.com/gocql/gocql"
)

func main() {
	// connect to the cluster
	cluster := gocql.NewCluster("192.168.1.1", "192.168.1.2", "192.168.1.3")
	cluster.Keyspace = "example"
	cluster.Consistency = gocql.Quorum
	session, _ := cluster.CreateSession()
	defer session.Close()

	// insert a tweet
	if err := session.Query(`INSERT INTO tweet (timeline, id, text) VALUES (?, ?, ?)`,
		"me", gocql.TimeUUID(), "hello world").Exec(); err != nil {
		log.Fatal(err)
	}

	var id gocql.UUID
	var text string

	/* Search for a specific set of records whose 'timeline' column matches
	 * the value 'me'. The secondary index that we created earlier will be
	 * used for optimizing the search */
	if err := session.Query(`SELECT id, text FROM tweet WHERE timeline = ? LIMIT 1`,
		"me").Consistency(gocql.One).Scan(&id, &text); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Tweet:", id, text)

	// list all tweets
	iter := session.Query(`SELECT id, text FROM tweet WHERE timeline = ?`, "me").Iter()
	for iter.Scan(&id, &text) {
		fmt.Println("Tweet:", id, text)
	}
	if err := iter.Close(); err != nil {
		log.Fatal(err)
	}
}
```

Data Binding
------------

There are various ways to bind application level data structures to CQL statements:

* You can write the data binding by hand, as outlined in the Tweet example. This provides you with the greatest flexibility, but it does mean that you need to keep your application code in sync with your Cassandra schema.
* You can dynamically marshal an entire query result into an `[]map[string]interface{}` using the `SliceMap()` API. This returns a slice of row maps keyed by CQL column names. This method requires no special interaction with the gocql API, but it does require your application to be able to deal with a key value view of your data.
* As a refinement on the `SliceMap()` API you can also call `MapScan()` which returns `map[string]interface{}` instances in a row by row fashion.
* The `Bind()` API provides a client app with a low level mechanism to introspect query meta data and extract appropriate field values from application level data structures.
* The [gocqlx](https://github.com/scylladb/gocqlx) package is an idiomatic extension to gocql that provides usability features. With gocqlx you can bind the query parameters from maps and structs, use named query parameters (:identifier) and scan the query results into structs and slices. It comes with a fluent and flexible CQL query builder that supports full CQL spec, including BATCH statements and custom functions.
* Building on top of the gocql driver, [cqlr](https://github.com/relops/cqlr) adds the ability to auto-bind a CQL iterator to a struct or to bind a struct to an INSERT statement.
* Another external project that layers on top of gocql is [cqlc](http://relops.com/cqlc) which generates gocql compliant code from your Cassandra schema so that you can write type safe CQL statements in Go with a natural query syntax.
* [gocassa](https://github.com/hailocab/gocassa) is an external project that layers on top of gocql to provide convenient query building and data binding.
* [gocqltable](https://github.com/kristoiv/gocqltable) provides an ORM-style convenience layer to make CRUD operations with gocql easier.

Ecosystem
---------

The following community maintained tools are known to integrate with gocql:

* [gocqlx](https://github.com/scylladb/gocqlx) is a gocql extension that automates data binding, adds named queries support, provides flexible query builders and plays well with gocql.
* [journey](https://github.com/db-journey/journey) is a migration tool with Cassandra support.
* [negronicql](https://github.com/mikebthun/negronicql) is gocql middleware for Negroni.
* [cqlr](https://github.com/relops/cqlr) adds the ability to auto-bind a CQL iterator to a struct or to bind a struct to an INSERT statement.
* [cqlc](http://relops.com/cqlc) generates gocql compliant code from your Cassandra schema so that you can write type safe CQL statements in Go with a natural query syntax.
* [gocassa](https://github.com/hailocab/gocassa) provides query building, adds data binding, and provides easy-to-use "recipe" tables for common query use-cases.
* [gocqltable](https://github.com/kristoiv/gocqltable) is a wrapper around gocql that aims to simplify common operations.
* [gockle](https://github.com/willfaught/gockle) provides simple, mockable interfaces that wrap gocql types
* [scylladb](https://github.com/scylladb/scylla) is a fast Apache Cassandra-compatible NoSQL database

Other Projects
--------------

* [gocqldriver](https://github.com/tux21b/gocqldriver) is the predecessor of gocql based on Go's `database/sql` package. This project isn't maintained anymore, because Cassandra wasn't a good fit for the traditional `database/sql` API. Use this package instead.

SEO
---

For some reason, when you Google `golang cassandra`, this project doesn't feature very highly in the result list. But if you Google `go cassandra`, then we're a bit higher up the list. So this is note to try to convince Google that golang is an alias for Go.

License
-------

> Copyright (c) 2012-2016 The gocql Authors. All rights reserved.
> Use of this source code is governed by a BSD-style
> license that can be found in the LICENSE file.
