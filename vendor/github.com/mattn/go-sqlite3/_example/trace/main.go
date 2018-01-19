package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	sqlite3 "github.com/mattn/go-sqlite3"
)

func traceCallback(info sqlite3.TraceInfo) int {
	// Not very readable but may be useful; uncomment next line in case of doubt:
	//fmt.Printf("Trace: %#v\n", info)

	var dbErrText string
	if info.DBError.Code != 0 || info.DBError.ExtendedCode != 0 {
		dbErrText = fmt.Sprintf("; DB error: %#v", info.DBError)
	} else {
		dbErrText = "."
	}

	// Show the Statement-or-Trigger text in curly braces ('{', '}')
	// since from the *paired* ASCII characters they are
	// the least used in SQL syntax, therefore better visual delimiters.
	// Maybe show 'ExpandedSQL' the same way as 'StmtOrTrigger'.
	//
	// A known use of curly braces (outside strings) is
	// for ODBC escape sequences. Not likely to appear here.
	//
	// Template languages, etc. don't matter, we should see their *result*
	// at *this* level.
	// Strange curly braces in SQL code that reached the database driver
	// suggest that there is a bug in the application.
	// The braces are likely to be either template syntax or
	// a programming language's string interpolation syntax.

	var expandedText string
	if info.ExpandedSQL != "" {
		if info.ExpandedSQL == info.StmtOrTrigger {
			expandedText = " = exp"
		} else {
			expandedText = fmt.Sprintf(" expanded {%q}", info.ExpandedSQL)
		}
	} else {
		expandedText = ""
	}

	// SQLite docs as of September 6, 2016: Tracing and Profiling Functions
	// https://www.sqlite.org/c3ref/profile.html
	//
	// The profile callback time is in units of nanoseconds, however
	// the current implementation is only capable of millisecond resolution
	// so the six least significant digits in the time are meaningless.
	// Future versions of SQLite might provide greater resolution on the profiler callback.

	var runTimeText string
	if info.RunTimeNanosec == 0 {
		if info.EventCode == sqlite3.TraceProfile {
			//runTimeText = "; no time" // seems confusing
			runTimeText = "; time 0" // no measurement unit
		} else {
			//runTimeText = "; no time" // seems useless and confusing
		}
	} else {
		const nanosPerMillisec = 1000000
		if info.RunTimeNanosec%nanosPerMillisec == 0 {
			runTimeText = fmt.Sprintf("; time %d ms", info.RunTimeNanosec/nanosPerMillisec)
		} else {
			// unexpected: better than millisecond resolution
			runTimeText = fmt.Sprintf("; time %d ns!!!", info.RunTimeNanosec)
		}
	}

	var modeText string
	if info.AutoCommit {
		modeText = "-AC-"
	} else {
		modeText = "+Tx+"
	}

	fmt.Printf("Trace: ev %d %s conn 0x%x, stmt 0x%x {%q}%s%s%s\n",
		info.EventCode, modeText, info.ConnHandle, info.StmtHandle,
		info.StmtOrTrigger, expandedText,
		runTimeText,
		dbErrText)
	return 0
}

func main() {
	eventMask := sqlite3.TraceStmt | sqlite3.TraceProfile | sqlite3.TraceRow | sqlite3.TraceClose

	sql.Register("sqlite3_tracing",
		&sqlite3.SQLiteDriver{
			ConnectHook: func(conn *sqlite3.SQLiteConn) error {
				err := conn.SetTrace(&sqlite3.TraceConfig{
					Callback:        traceCallback,
					EventMask:       uint(eventMask),
					WantExpandedSQL: true,
				})
				return err
			},
		})

	os.Exit(dbMain())
}

// Harder to do DB work in main().
// It's better with a separate function because
// 'defer' and 'os.Exit' don't go well together.
//
// DO NOT use 'log.Fatal...' below: remember that it's equivalent to
// Print() followed by a call to os.Exit(1) --- and
// we want to avoid Exit() so 'defer' can do cleanup.
// Use 'log.Panic...' instead.

func dbMain() int {
	db, err := sql.Open("sqlite3_tracing", ":memory:")
	if err != nil {
		fmt.Printf("Failed to open database: %#+v\n", err)
		return 1
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		log.Panic(err)
	}

	dbSetup(db)

	dbDoInsert(db)
	dbDoInsertPrepared(db)
	dbDoSelect(db)
	dbDoSelectPrepared(db)

	return 0
}

// 'DDL' stands for "Data Definition Language":

// Note: "INTEGER PRIMARY KEY NOT NULL AUTOINCREMENT" causes the error
// 'near "AUTOINCREMENT": syntax error'; without "NOT NULL" it works.
const tableDDL = `CREATE TABLE t1 (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 note VARCHAR NOT NULL
)`

// 'DML' stands for "Data Manipulation Language":

const insertDML = "INSERT INTO t1 (note) VALUES (?)"
const selectDML = "SELECT id, note FROM t1 WHERE note LIKE ?"

const textPrefix = "bla-1234567890-"
const noteTextPattern = "%Prep%"

const nGenRows = 4 // Number of Rows to Generate (for *each* approach tested)

func dbSetup(db *sql.DB) {
	var err error

	_, err = db.Exec("DROP TABLE IF EXISTS t1")
	if err != nil {
		log.Panic(err)
	}
	_, err = db.Exec(tableDDL)
	if err != nil {
		log.Panic(err)
	}
}

func dbDoInsert(db *sql.DB) {
	const Descr = "DB-Exec"
	for i := 0; i < nGenRows; i++ {
		result, err := db.Exec(insertDML, textPrefix+Descr)
		if err != nil {
			log.Panic(err)
		}

		resultDoCheck(result, Descr, i)
	}
}

func dbDoInsertPrepared(db *sql.DB) {
	const Descr = "DB-Prepare"

	stmt, err := db.Prepare(insertDML)
	if err != nil {
		log.Panic(err)
	}
	defer stmt.Close()

	for i := 0; i < nGenRows; i++ {
		result, err := stmt.Exec(textPrefix + Descr)
		if err != nil {
			log.Panic(err)
		}

		resultDoCheck(result, Descr, i)
	}
}

func resultDoCheck(result sql.Result, callerDescr string, callIndex int) {
	lastID, err := result.LastInsertId()
	if err != nil {
		log.Panic(err)
	}
	nAffected, err := result.RowsAffected()
	if err != nil {
		log.Panic(err)
	}

	log.Printf("Exec result for %s (%d): ID = %d, affected = %d\n", callerDescr, callIndex, lastID, nAffected)
}

func dbDoSelect(db *sql.DB) {
	const Descr = "DB-Query"

	rows, err := db.Query(selectDML, noteTextPattern)
	if err != nil {
		log.Panic(err)
	}
	defer rows.Close()

	rowsDoFetch(rows, Descr)
}

func dbDoSelectPrepared(db *sql.DB) {
	const Descr = "DB-Prepare"

	stmt, err := db.Prepare(selectDML)
	if err != nil {
		log.Panic(err)
	}
	defer stmt.Close()

	rows, err := stmt.Query(noteTextPattern)
	if err != nil {
		log.Panic(err)
	}
	defer rows.Close()

	rowsDoFetch(rows, Descr)
}

func rowsDoFetch(rows *sql.Rows, callerDescr string) {
	var nRows int
	var id int64
	var note string

	for rows.Next() {
		err := rows.Scan(&id, &note)
		if err != nil {
			log.Panic(err)
		}
		log.Printf("Row for %s (%d): id=%d, note=%q\n",
			callerDescr, nRows, id, note)
		nRows++
	}
	if err := rows.Err(); err != nil {
		log.Panic(err)
	}
	log.Printf("Total %d rows for %s.\n", nRows, callerDescr)
}
