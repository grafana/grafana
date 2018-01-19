package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/mattn/go-sqlite3"
)

func main() {
	sqlite3conn := []*sqlite3.SQLiteConn{}
	sql.Register("sqlite3_with_hook_example",
		&sqlite3.SQLiteDriver{
			ConnectHook: func(conn *sqlite3.SQLiteConn) error {
				sqlite3conn = append(sqlite3conn, conn)
				conn.RegisterUpdateHook(func(op int, db string, table string, rowid int64) {
					switch op {
					case sqlite3.SQLITE_INSERT:
						log.Println("Notified of insert on db", db, "table", table, "rowid", rowid)
					}
				})
				return nil
			},
		})
	os.Remove("./foo.db")
	os.Remove("./bar.db")

	srcDb, err := sql.Open("sqlite3_with_hook_example", "./foo.db")
	if err != nil {
		log.Fatal(err)
	}
	defer srcDb.Close()
	srcDb.Ping()

	_, err = srcDb.Exec("create table foo(id int, value text)")
	if err != nil {
		log.Fatal(err)
	}
	_, err = srcDb.Exec("insert into foo values(1, 'foo')")
	if err != nil {
		log.Fatal(err)
	}
	_, err = srcDb.Exec("insert into foo values(2, 'bar')")
	if err != nil {
		log.Fatal(err)
	}
	_, err = srcDb.Query("select * from foo")
	if err != nil {
		log.Fatal(err)
	}
	destDb, err := sql.Open("sqlite3_with_hook_example", "./bar.db")
	if err != nil {
		log.Fatal(err)
	}
	defer destDb.Close()
	destDb.Ping()

	bk, err := sqlite3conn[1].Backup("main", sqlite3conn[0], "main")
	if err != nil {
		log.Fatal(err)
	}

	_, err = bk.Step(-1)
	if err != nil {
		log.Fatal(err)
	}
	_, err = destDb.Query("select * from foo")
	if err != nil {
		log.Fatal(err)
	}
	_, err = destDb.Exec("insert into foo values(3, 'bar')")
	if err != nil {
		log.Fatal(err)
	}

	bk.Finish()
}
