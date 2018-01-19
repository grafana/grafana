package main

import (
	"database/sql"
	"fmt"
	"github.com/mattn/go-sqlite3"
	"log"
)

func main() {
	sql.Register("sqlite3_with_extensions",
		&sqlite3.SQLiteDriver{
			Extensions: []string{
				"sqlite3_mod_regexp",
			},
		})

	db, err := sql.Open("sqlite3_with_extensions", ":memory:")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Force db to make a new connection in pool
	// by putting the original in a transaction
	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Commit()

	// New connection works (hopefully!)
	rows, err := db.Query("select 'hello world' where 'hello world' regexp '^hello.*d$'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var helloworld string
		rows.Scan(&helloworld)
		fmt.Println(helloworld)
	}
}
