# csvq driver

A go database/sql driver for [csvq](https://github.com/mithrandie/csvq).

[![GitHub tag (latest SemVer)](https://img.shields.io/github/v/tag/mithrandie/csvq-driver?color=%2320b2aa&label=Latest&sort=semver)](https://github.com/mithrandie/csvq-driver/tags)
[![Test](https://github.com/mithrandie/csvq-driver/actions/workflows/test.yml/badge.svg)](https://github.com/mithrandie/csvq-driver/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/mithrandie/csvq-driver/branch/master/graph/badge.svg)](https://codecov.io/gh/mithrandie/csvq-driver)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](https://opensource.org/licenses/MIT)


csvq-driver allows you to operate csv files and other supported formats using csvq statements in Go.
You can use the statements in the same way as other relational database systems.

[Reference Manual - csvq](https://mithrandie.github.io/csvq/reference)


## Requirements

Go 1.18 or later (ref. [Getting Started - The Go Programming Language](https://golang.org/doc/install))


## Supported features

- Query
  - Only the result-sets in the top-level scope can be retrieved.
    You cannot refer the results of child scopes such as inside of IF, WHILE and user-defined functions.
- Exec
  - Only the last result in the top-level scope can be retrieved.
  - LastInsertId is not supported.
- Prepared Statement
  - Ordinal placeholders
  - Named placeholders
- Transaction
  - Isolation Level is the default only.
  - Read-only transaction is not supported.
  - If you do not use the database/sql transaction feature, all execusions will commit at the end of the execusion automatically.

## Usage

### Data Source Name

A data source name to call sql.Open is a directory path.
It is the same as "--repository" option of the csvq command.

Some parameters can be specified in a DSN string with a directory path.
A directory path and parameters are separated by a question mark, and parameters are separated by ampersands.

```go
db, err := sql.Open("csvq", "/path/to/data/directory?Param1=Value&Param2=Value")
```

#### Parameters that can be specified

| Name           | Type   | Default      |
|:---------------|:-------|:-------------|
| Timezone       | string | "Local"      |
| DatetimeFormat | string | empty string |
| AnsiQuotes     | bool   | false        |

> Parameter names are case-insensitive.

See: [csvq > Reference Manual > Command Usage > Options](https://mithrandie.github.io/csvq/reference/command.html#options)


### Error Handling

If a received error is a returned error from csvq, you can cast the error to github.com/mithrandie/csvq/lib/query.Error interface.
The error interface has the following functions.

| function         | description                                                    |
|:-----------------|:---------------------------------------------------------------|
| Message() string | Error message                                                  |
| Code() int       | Error code. The same as the exit code of the csvq command      |
| Number() int     | Error number                                                   |
| Line() int       | Line number where the error occurred in the passed statement   |
| Char() int       | Column number where the error occurred in the passed statement |
| Source() string  | File or statement name where the error occurred                |

### Example

```go
package main

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/mithrandie/csvq/lib/query"

	_ "github.com/mithrandie/csvq-driver"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := sql.Open("csvq", "/path/to/data/directory")
	if err != nil {
		panic(err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			panic(err)
		}
	}()
	
	queryString := "SELECT id, first_name, country_code FROM `users.csv` WHERE id = '12'"
	r := db.QueryRowContext(ctx, queryString)

	var (
		id          int
		firstName   string
		countryCode string
	)

	if err := r.Scan(&id, &firstName, &countryCode); err != nil {
		if err == sql.ErrNoRows {
			fmt.Println("No Rows.")
		} else if csvqerr, ok := err.(query.Error); ok {
			panic(fmt.Sprintf("Unexpected error: Number: %d  Message: %s", csvqerr.Number(), csvqerr.Message()))
		} else {
			panic("Unexpected error: " + err.Error())
		}
	} else {
		fmt.Printf("Result: [id]%3d  [first_name]%10s  [country_code]%3s\n", id, firstName, countryCode)
	}
}
```

See: [https://github.com/mithrandie/csvq-driver/blob/master/example/csvq-driver/csvq-driver-example.go](https://github.com/mithrandie/csvq-driver/blob/master/example/csvq-driver/csvq-driver-example.go)

### Replace I/O

You can replace input/output interface of the csvq to pass the data from inside your go programs or retrive the result-sets as a another format.

| function in the csvq-driver                                                                            | default       | description                                                                             |
|:-------------------------------------------------------------------------------------------------------|:--------------|:----------------------------------------------------------------------------------------|
| SetStdin(r io.ReadCloser) error<br /><br />SetStdinContext(ctx context.Context, r io.ReadCloser) error | os.Stdin      | Replace input interface. Passed data can be refered as a temporary table named "STDIN". |
| SetStdout(w io.WriteCloser)                                                                            | query.Discard | Replace output interface. Logs and result-sets of select queries are written to stdout. |
| SetOutFile(w io.Writer)                                                                                | nil           | Put a writer for result-sets of select queries to write instead of stdout.              |

The following structs are available for replacement.

| struct name  | initializer                 |
|:-------------|:----------------------------|
| query.Input  | query.NewInput(r io.Reader) |
| query.Output | query.NewOutput()           |

> "query" means the package "github.com/mithrandie/csvq/lib/query".


See: [https://github.com/mithrandie/csvq-driver/blob/master/example/replace-io/csvq-replace-io-example.go](https://github.com/mithrandie/csvq-driver/blob/master/example/replace-io/csvq-replace-io-example.go)
