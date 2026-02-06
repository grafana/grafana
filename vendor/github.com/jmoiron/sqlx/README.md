# sqlx

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/jmoiron/sqlx/tree/master.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/jmoiron/sqlx/tree/master) [![Coverage Status](https://coveralls.io/repos/github/jmoiron/sqlx/badge.svg?branch=master)](https://coveralls.io/github/jmoiron/sqlx?branch=master) [![Godoc](http://img.shields.io/badge/godoc-reference-blue.svg?style=flat)](https://godoc.org/github.com/jmoiron/sqlx) [![license](http://img.shields.io/badge/license-MIT-red.svg?style=flat)](https://raw.githubusercontent.com/jmoiron/sqlx/master/LICENSE)

sqlx is a library which provides a set of extensions on go's standard
`database/sql` library.  The sqlx versions of `sql.DB`, `sql.TX`, `sql.Stmt`,
et al. all leave the underlying interfaces untouched, so that their interfaces
are a superset on the standard ones.  This makes it relatively painless to
integrate existing codebases using database/sql with sqlx.

Major additional concepts are:

* Marshal rows into structs (with embedded struct support), maps, and slices
* Named parameter support including prepared statements
* `Get` and `Select` to go quickly from query to struct/slice

In addition to the [godoc API documentation](http://godoc.org/github.com/jmoiron/sqlx),
there is also some [user documentation](http://jmoiron.github.io/sqlx/) that
explains how to use `database/sql` along with sqlx.

## Recent Changes

1.3.0:

* `sqlx.DB.Connx(context.Context) *sqlx.Conn`
* `sqlx.BindDriver(driverName, bindType)`
* support for `[]map[string]interface{}` to do "batch" insertions
* allocation & perf improvements for `sqlx.In`

DB.Connx returns an `sqlx.Conn`, which is an `sql.Conn`-alike consistent with
sqlx's wrapping of other types.

`BindDriver` allows users to control the bindvars that sqlx will use for drivers,
and add new drivers at runtime.  This results in a very slight performance hit
when resolving the driver into a bind type (~40ns per call), but it allows users
to specify what bindtype their driver uses even when sqlx has not been updated
to know about it by default.

### Backwards Compatibility

Compatibility with the most recent two versions of Go is a requirement for any
new changes.  Compatibility beyond that is not guaranteed.

Versioning is done with Go modules.  Breaking changes (eg. removing deprecated API)
will get major version number bumps.

## install

    go get github.com/jmoiron/sqlx

## issues

Row headers can be ambiguous (`SELECT 1 AS a, 2 AS a`), and the result of
`Columns()` does not fully qualify column names in queries like:

```sql
SELECT a.id, a.name, b.id, b.name FROM foos AS a JOIN foos AS b ON a.parent = b.id;
```

making a struct or map destination ambiguous.  Use `AS` in your queries
to give columns distinct names, `rows.Scan` to scan them manually, or 
`SliceScan` to get a slice of results.

## usage

Below is an example which shows some common use cases for sqlx.  Check 
[sqlx_test.go](https://github.com/jmoiron/sqlx/blob/master/sqlx_test.go) for more
usage.


```go
package main

import (
    "database/sql"
    "fmt"
    "log"
    
    _ "github.com/lib/pq"
    "github.com/jmoiron/sqlx"
)

var schema = `
CREATE TABLE person (
    first_name text,
    last_name text,
    email text
);

CREATE TABLE place (
    country text,
    city text NULL,
    telcode integer
)`

type Person struct {
    FirstName string `db:"first_name"`
    LastName  string `db:"last_name"`
    Email     string
}

type Place struct {
    Country string
    City    sql.NullString
    TelCode int
}

func main() {
    // this Pings the database trying to connect
    // use sqlx.Open() for sql.Open() semantics
    db, err := sqlx.Connect("postgres", "user=foo dbname=bar sslmode=disable")
    if err != nil {
        log.Fatalln(err)
    }

    // exec the schema or fail; multi-statement Exec behavior varies between
    // database drivers;  pq will exec them all, sqlite3 won't, ymmv
    db.MustExec(schema)
    
    tx := db.MustBegin()
    tx.MustExec("INSERT INTO person (first_name, last_name, email) VALUES ($1, $2, $3)", "Jason", "Moiron", "jmoiron@jmoiron.net")
    tx.MustExec("INSERT INTO person (first_name, last_name, email) VALUES ($1, $2, $3)", "John", "Doe", "johndoeDNE@gmail.net")
    tx.MustExec("INSERT INTO place (country, city, telcode) VALUES ($1, $2, $3)", "United States", "New York", "1")
    tx.MustExec("INSERT INTO place (country, telcode) VALUES ($1, $2)", "Hong Kong", "852")
    tx.MustExec("INSERT INTO place (country, telcode) VALUES ($1, $2)", "Singapore", "65")
    // Named queries can use structs, so if you have an existing struct (i.e. person := &Person{}) that you have populated, you can pass it in as &person
    tx.NamedExec("INSERT INTO person (first_name, last_name, email) VALUES (:first_name, :last_name, :email)", &Person{"Jane", "Citizen", "jane.citzen@example.com"})
    tx.Commit()

    // Query the database, storing results in a []Person (wrapped in []interface{})
    people := []Person{}
    db.Select(&people, "SELECT * FROM person ORDER BY first_name ASC")
    jason, john := people[0], people[1]

    fmt.Printf("%#v\n%#v", jason, john)
    // Person{FirstName:"Jason", LastName:"Moiron", Email:"jmoiron@jmoiron.net"}
    // Person{FirstName:"John", LastName:"Doe", Email:"johndoeDNE@gmail.net"}

    // You can also get a single result, a la QueryRow
    jason = Person{}
    err = db.Get(&jason, "SELECT * FROM person WHERE first_name=$1", "Jason")
    fmt.Printf("%#v\n", jason)
    // Person{FirstName:"Jason", LastName:"Moiron", Email:"jmoiron@jmoiron.net"}

    // if you have null fields and use SELECT *, you must use sql.Null* in your struct
    places := []Place{}
    err = db.Select(&places, "SELECT * FROM place ORDER BY telcode ASC")
    if err != nil {
        fmt.Println(err)
        return
    }
    usa, singsing, honkers := places[0], places[1], places[2]
    
    fmt.Printf("%#v\n%#v\n%#v\n", usa, singsing, honkers)
    // Place{Country:"United States", City:sql.NullString{String:"New York", Valid:true}, TelCode:1}
    // Place{Country:"Singapore", City:sql.NullString{String:"", Valid:false}, TelCode:65}
    // Place{Country:"Hong Kong", City:sql.NullString{String:"", Valid:false}, TelCode:852}

    // Loop through rows using only one struct
    place := Place{}
    rows, err := db.Queryx("SELECT * FROM place")
    for rows.Next() {
        err := rows.StructScan(&place)
        if err != nil {
            log.Fatalln(err)
        } 
        fmt.Printf("%#v\n", place)
    }
    // Place{Country:"United States", City:sql.NullString{String:"New York", Valid:true}, TelCode:1}
    // Place{Country:"Hong Kong", City:sql.NullString{String:"", Valid:false}, TelCode:852}
    // Place{Country:"Singapore", City:sql.NullString{String:"", Valid:false}, TelCode:65}

    // Named queries, using `:name` as the bindvar.  Automatic bindvar support
    // which takes into account the dbtype based on the driverName on sqlx.Open/Connect
    _, err = db.NamedExec(`INSERT INTO person (first_name,last_name,email) VALUES (:first,:last,:email)`, 
        map[string]interface{}{
            "first": "Bin",
            "last": "Smuth",
            "email": "bensmith@allblacks.nz",
    })

    // Selects Mr. Smith from the database
    rows, err = db.NamedQuery(`SELECT * FROM person WHERE first_name=:fn`, map[string]interface{}{"fn": "Bin"})

    // Named queries can also use structs.  Their bind names follow the same rules
    // as the name -> db mapping, so struct fields are lowercased and the `db` tag
    // is taken into consideration.
    rows, err = db.NamedQuery(`SELECT * FROM person WHERE first_name=:first_name`, jason)
    
    
    // batch insert
    
    // batch insert with structs
    personStructs := []Person{
        {FirstName: "Ardie", LastName: "Savea", Email: "asavea@ab.co.nz"},
        {FirstName: "Sonny Bill", LastName: "Williams", Email: "sbw@ab.co.nz"},
        {FirstName: "Ngani", LastName: "Laumape", Email: "nlaumape@ab.co.nz"},
    }

    _, err = db.NamedExec(`INSERT INTO person (first_name, last_name, email)
        VALUES (:first_name, :last_name, :email)`, personStructs)

    // batch insert with maps
    personMaps := []map[string]interface{}{
        {"first_name": "Ardie", "last_name": "Savea", "email": "asavea@ab.co.nz"},
        {"first_name": "Sonny Bill", "last_name": "Williams", "email": "sbw@ab.co.nz"},
        {"first_name": "Ngani", "last_name": "Laumape", "email": "nlaumape@ab.co.nz"},
    }

    _, err = db.NamedExec(`INSERT INTO person (first_name, last_name, email)
        VALUES (:first_name, :last_name, :email)`, personMaps)
}
```
