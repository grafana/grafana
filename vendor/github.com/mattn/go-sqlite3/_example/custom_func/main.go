package main

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"math/rand"

	sqlite "github.com/mattn/go-sqlite3"
)

// Computes x^y
func pow(x, y int64) int64 {
	return int64(math.Pow(float64(x), float64(y)))
}

// Computes the bitwise exclusive-or of all its arguments
func xor(xs ...int64) int64 {
	var ret int64
	for _, x := range xs {
		ret ^= x
	}
	return ret
}

// Returns a random number. It's actually deterministic here because
// we don't seed the RNG, but it's an example of a non-pure function
// from SQLite's POV.
func getrand() int64 {
	return rand.Int63()
}

// Computes the standard deviation of a GROUPed BY set of values
type stddev struct {
	xs []int64
	// Running average calculation
	sum int64
	n   int64
}

func newStddev() *stddev { return &stddev{} }

func (s *stddev) Step(x int64) {
	s.xs = append(s.xs, x)
	s.sum += x
	s.n++
}

func (s *stddev) Done() float64 {
	mean := float64(s.sum) / float64(s.n)
	var sqDiff []float64
	for _, x := range s.xs {
		sqDiff = append(sqDiff, math.Pow(float64(x)-mean, 2))
	}
	var dev float64
	for _, x := range sqDiff {
		dev += x
	}
	dev /= float64(len(sqDiff))
	return math.Sqrt(dev)
}

func main() {
	sql.Register("sqlite3_custom", &sqlite.SQLiteDriver{
		ConnectHook: func(conn *sqlite.SQLiteConn) error {
			if err := conn.RegisterFunc("pow", pow, true); err != nil {
				return err
			}
			if err := conn.RegisterFunc("xor", xor, true); err != nil {
				return err
			}
			if err := conn.RegisterFunc("rand", getrand, false); err != nil {
				return err
			}
			if err := conn.RegisterAggregator("stddev", newStddev, true); err != nil {
				return err
			}
			return nil
		},
	})

	db, err := sql.Open("sqlite3_custom", ":memory:")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	var i int64
	err = db.QueryRow("SELECT pow(2,3)").Scan(&i)
	if err != nil {
		log.Fatal("POW query error:", err)
	}
	fmt.Println("pow(2,3) =", i) // 8

	err = db.QueryRow("SELECT xor(1,2,3,4,5,6)").Scan(&i)
	if err != nil {
		log.Fatal("XOR query error:", err)
	}
	fmt.Println("xor(1,2,3,4,5) =", i) // 7

	err = db.QueryRow("SELECT rand()").Scan(&i)
	if err != nil {
		log.Fatal("RAND query error:", err)
	}
	fmt.Println("rand() =", i) // pseudorandom

	_, err = db.Exec("create table foo (department integer, profits integer)")
	if err != nil {
		log.Fatal("Failed to create table:", err)
	}
	_, err = db.Exec("insert into foo values (1, 10), (1, 20), (1, 45), (2, 42), (2, 115)")
	if err != nil {
		log.Fatal("Failed to insert records:", err)
	}

	rows, err := db.Query("select department, stddev(profits) from foo group by department")
	if err != nil {
		log.Fatal("STDDEV query error:", err)
	}
	defer rows.Close()
	for rows.Next() {
		var dept int64
		var dev float64
		if err := rows.Scan(&dept, &dev); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("dept=%d stddev=%f\n", dept, dev)
	}
	if err := rows.Err(); err != nil {
		log.Fatal(err)
	}
}
