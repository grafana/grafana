package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/mattn/go-sqlite3"
)

func createBulkInsertQuery(n int, start int) (query string, args []interface{}) {
	values := make([]string, n)
	args = make([]interface{}, n*2)
	pos := 0
	for i := 0; i < n; i++ {
		values[i] = "(?, ?)"
		args[pos] = start + i
		args[pos+1] = fmt.Sprintf("こんにちわ世界%03d", i)
		pos += 2
	}
	query = fmt.Sprintf(
		"insert into foo(id, name) values %s",
		strings.Join(values, ", "),
	)
	return
}

func bukInsert(db *sql.DB, query string, args []interface{}) (err error) {
	stmt, err := db.Prepare(query)
	if err != nil {
		return
	}

	_, err = stmt.Exec(args...)
	if err != nil {
		return
	}

	return
}

func main() {
	var sqlite3conn *sqlite3.SQLiteConn
	sql.Register("sqlite3_with_limit", &sqlite3.SQLiteDriver{
		ConnectHook: func(conn *sqlite3.SQLiteConn) error {
			sqlite3conn = conn
			return nil
		},
	})

	os.Remove("./foo.db")
	db, err := sql.Open("sqlite3_with_limit", "./foo.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	sqlStmt := `
	create table foo (id integer not null primary key, name text);
	delete from foo;
	`
	_, err = db.Exec(sqlStmt)
	if err != nil {
		log.Printf("%q: %s\n", err, sqlStmt)
		return
	}

	if sqlite3conn == nil {
		log.Fatal("not set sqlite3 connection")
	}

	limitVariableNumber := sqlite3conn.GetLimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER)
	log.Printf("default SQLITE_LIMIT_VARIABLE_NUMBER: %d", limitVariableNumber)

	num := 400
	query, args := createBulkInsertQuery(num, 0)
	err = bukInsert(db, query, args)
	if err != nil {
		log.Fatal(err)
	}

	smallLimitVariableNumber := 100
	sqlite3conn.SetLimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER, smallLimitVariableNumber)

	limitVariableNumber = sqlite3conn.GetLimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER)
	log.Printf("updated SQLITE_LIMIT_VARIABLE_NUMBER: %d", limitVariableNumber)

	query, args = createBulkInsertQuery(num, num)
	err = bukInsert(db, query, args)
	if err != nil {
		if err != nil {
			log.Printf("expect failed since SQLITE_LIMIT_VARIABLE_NUMBER is too small: %v", err)
		}
	}

	bigLimitVariableNumber := 999999
	sqlite3conn.SetLimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER, bigLimitVariableNumber)
	limitVariableNumber = sqlite3conn.GetLimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER)
	log.Printf("set SQLITE_LIMIT_VARIABLE_NUMBER: %d", bigLimitVariableNumber)
	log.Printf("updated SQLITE_LIMIT_VARIABLE_NUMBER: %d", limitVariableNumber)

	query, args = createBulkInsertQuery(500, num+num)
	err = bukInsert(db, query, args)
	if err != nil {
		if err != nil {
			log.Fatal(err)
		}
	}

	log.Println("no error if SQLITE_LIMIT_VARIABLE_NUMBER > 999")
}
