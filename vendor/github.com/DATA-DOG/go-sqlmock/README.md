[![Build Status](https://travis-ci.org/DATA-DOG/go-sqlmock.svg)](https://travis-ci.org/DATA-DOG/go-sqlmock)
[![GoDoc](https://godoc.org/github.com/DATA-DOG/go-sqlmock?status.svg)](https://godoc.org/github.com/DATA-DOG/go-sqlmock)
[![Go Report Card](https://goreportcard.com/badge/github.com/DATA-DOG/go-sqlmock)](https://goreportcard.com/report/github.com/DATA-DOG/go-sqlmock)
[![codecov.io](https://codecov.io/github/DATA-DOG/go-sqlmock/branch/master/graph/badge.svg)](https://codecov.io/github/DATA-DOG/go-sqlmock)

# Sql driver mock for Golang

**sqlmock** is a mock library implementing [sql/driver](https://godoc.org/database/sql/driver). Which has one and only
purpose - to simulate any **sql** driver behavior in tests, without needing a real database connection. It helps to
maintain correct **TDD** workflow.

- this library is now complete and stable. (you may not find new changes for this reason)
- supports concurrency and multiple connections.
- supports **go1.8** Context related feature mocking and Named sql parameters.
- does not require any modifications to your source code.
- the driver allows to mock any sql driver method behavior.
- has strict by default expectation order matching.
- has no third party dependencies.

**NOTE:** in **v1.2.0** **sqlmock.Rows** has changed to struct from interface, if you were using any type references to that
interface, you will need to switch it to a pointer struct type. Also, **sqlmock.Rows** were used to implement **driver.Rows**
interface, which was not required or useful for mocking and was removed. Hope it will not cause issues.

## Looking for maintainers

I do not have much spare time for this library and willing to transfer the repository ownership
to person or an organization motivated to maintain it. Open up a conversation if you are interested. See #230.

## Install

    go get github.com/DATA-DOG/go-sqlmock

## Documentation and Examples

Visit [godoc](http://godoc.org/github.com/DATA-DOG/go-sqlmock) for general examples and public api reference.
See **.travis.yml** for supported **go** versions.
Different use case, is to functionally test with a real database - [go-txdb](https://github.com/DATA-DOG/go-txdb)
all database related actions are isolated within a single transaction so the database can remain in the same state.

See implementation examples:

- [blog API server](https://github.com/DATA-DOG/go-sqlmock/tree/master/examples/blog)
- [the same orders example](https://github.com/DATA-DOG/go-sqlmock/tree/master/examples/orders)

### Something you may want to test, assuming you use the [go-mysql-driver](https://github.com/go-sql-driver/mysql)

``` go
package main

import (
	"database/sql"

	_ "github.com/go-sql-driver/mysql"
)

func recordStats(db *sql.DB, userID, productID int64) (err error) {
	tx, err := db.Begin()
	if err != nil {
		return
	}

	defer func() {
		switch err {
		case nil:
			err = tx.Commit()
		default:
			tx.Rollback()
		}
	}()

	if _, err = tx.Exec("UPDATE products SET views = views + 1"); err != nil {
		return
	}
	if _, err = tx.Exec("INSERT INTO product_viewers (user_id, product_id) VALUES (?, ?)", userID, productID); err != nil {
		return
	}
	return
}

func main() {
	// @NOTE: the real connection is not required for tests
	db, err := sql.Open("mysql", "root@/blog")
	if err != nil {
		panic(err)
	}
	defer db.Close()

	if err = recordStats(db, 1 /*some user id*/, 5 /*some product id*/); err != nil {
		panic(err)
	}
}
```

### Tests with sqlmock

``` go
package main

import (
	"fmt"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// a successful case
func TestShouldUpdateStats(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("an error '%s' was not expected when opening a stub database connection", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE products").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO product_viewers").WithArgs(2, 3).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	// now we execute our method
	if err = recordStats(db, 2, 3); err != nil {
		t.Errorf("error was not expected while updating stats: %s", err)
	}

	// we make sure that all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}

// a failing test case
func TestShouldRollbackStatUpdatesOnFailure(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("an error '%s' was not expected when opening a stub database connection", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE products").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("INSERT INTO product_viewers").
		WithArgs(2, 3).
		WillReturnError(fmt.Errorf("some error"))
	mock.ExpectRollback()

	// now we execute our method
	if err = recordStats(db, 2, 3); err == nil {
		t.Errorf("was expecting an error, but there was none")
	}

	// we make sure that all expectations were met
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}
```

## Customize SQL query matching

There were plenty of requests from users regarding SQL query string validation or different matching option.
We have now implemented the `QueryMatcher` interface, which can be passed through an option when calling
`sqlmock.New` or `sqlmock.NewWithDSN`.

This now allows to include some library, which would allow for example to parse and validate `mysql` SQL AST.
And create a custom QueryMatcher in order to validate SQL in sophisticated ways.

By default, **sqlmock** is preserving backward compatibility and default query matcher is `sqlmock.QueryMatcherRegexp`
which uses expected SQL string as a regular expression to match incoming query string. There is an equality matcher:
`QueryMatcherEqual` which will do a full case sensitive match.

In order to customize the QueryMatcher, use the following:

``` go
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
```

The query matcher can be fully customized based on user needs. **sqlmock** will not
provide a standard sql parsing matchers, since various drivers may not follow the same SQL standard.

## Matching arguments like time.Time

There may be arguments which are of `struct` type and cannot be compared easily by value like `time.Time`. In this case
**sqlmock** provides an [Argument](https://godoc.org/github.com/DATA-DOG/go-sqlmock#Argument) interface which
can be used in more sophisticated matching. Here is a simple example of time argument matching:

``` go
type AnyTime struct{}

// Match satisfies sqlmock.Argument interface
func (a AnyTime) Match(v driver.Value) bool {
	_, ok := v.(time.Time)
	return ok
}

func TestAnyTimeArgument(t *testing.T) {
	t.Parallel()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Errorf("an error '%s' was not expected when opening a stub database connection", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO users").
		WithArgs("john", AnyTime{}).
		WillReturnResult(sqlmock.NewResult(1, 1))

	_, err = db.Exec("INSERT INTO users(name, created_at) VALUES (?, ?)", "john", time.Now())
	if err != nil {
		t.Errorf("error '%s' was not expected, while inserting a row", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}
```

It only asserts that argument is of `time.Time` type.

## Run tests

    go test -race

## Change Log

- **2019-04-06** - added functionality to mock a sql MetaData request
- **2019-02-13** - added `go.mod` removed the references and suggestions using `gopkg.in`.
- **2018-12-11** - added expectation of Rows to be closed, while mocking expected query.
- **2018-12-11** - introduced an option to provide **QueryMatcher** in order to customize SQL query matching.
- **2017-09-01** - it is now possible to expect that prepared statement will be closed,
  using **ExpectedPrepare.WillBeClosed**.
- **2017-02-09** - implemented support for **go1.8** features. **Rows** interface was changed to struct
  but contains all methods as before and should maintain backwards compatibility. **ExpectedQuery.WillReturnRows** may now
  accept multiple row sets.
- **2016-11-02** - `db.Prepare()` was not validating expected prepare SQL
  query. It should still be validated even if Exec or Query is not
  executed on that prepared statement.
- **2016-02-23** - added **sqlmock.AnyArg()** function to provide any kind
  of argument matcher.
- **2016-02-23** - convert expected arguments to driver.Value as natural
  driver does, the change may affect time.Time comparison and will be
  stricter. See [issue](https://github.com/DATA-DOG/go-sqlmock/issues/31).
- **2015-08-27** - **v1** api change, concurrency support, all known issues fixed.
- **2014-08-16** instead of **panic** during reflect type mismatch when comparing query arguments - now return error
- **2014-08-14** added **sqlmock.NewErrorResult** which gives an option to return driver.Result with errors for
interface methods, see [issue](https://github.com/DATA-DOG/go-sqlmock/issues/5)
- **2014-05-29** allow to match arguments in more sophisticated ways, by providing an **sqlmock.Argument** interface
- **2014-04-21** introduce **sqlmock.New()** to open a mock database connection for tests. This method
calls sql.DB.Ping to ensure that connection is open, see [issue](https://github.com/DATA-DOG/go-sqlmock/issues/4).
This way on Close it will surely assert if all expectations are met, even if database was not triggered at all.
The old way is still available, but it is advisable to call db.Ping manually before asserting with db.Close.
- **2014-02-14** RowsFromCSVString is now a part of Rows interface named as FromCSVString.
It has changed to allow more ways to construct rows and to easily extend this API in future.
See [issue 1](https://github.com/DATA-DOG/go-sqlmock/issues/1)
**RowsFromCSVString** is deprecated and will be removed in future

## Contributions

Feel free to open a pull request. Note, if you wish to contribute an extension to public (exported methods or types) -
please open an issue before, to discuss whether these changes can be accepted. All backward incompatible changes are
and will be treated cautiously

## License

The [three clause BSD license](http://en.wikipedia.org/wiki/BSD_licenses)

