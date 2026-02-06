// Package database provides the Database interface.
// All database drivers must implement this interface, register themselves,
// optionally provide a `WithInstance` function and pass the tests
// in package database/testing.
package database

import (
	"fmt"
	"io"
	"sync"

	iurl "github.com/golang-migrate/migrate/v4/internal/url"
)

var (
	ErrLocked = fmt.Errorf("can't acquire lock")
)

const NilVersion int = -1

var driversMu sync.RWMutex
var drivers = make(map[string]Driver)

// Driver is the interface every database driver must implement.
//
// How to implement a database driver?
//   1. Implement this interface.
//   2. Optionally, add a function named `WithInstance`.
//      This function should accept an existing DB instance and a Config{} struct
//      and return a driver instance.
//   3. Add a test that calls database/testing.go:Test()
//   4. Add own tests for Open(), WithInstance() (when provided) and Close().
//      All other functions are tested by tests in database/testing.
//      Saves you some time and makes sure all database drivers behave the same way.
//   5. Call Register in init().
//   6. Create a migrate/cli/build_<driver-name>.go file
//   7. Add driver name in 'DATABASE' variable in Makefile
//
// Guidelines:
//   * Don't try to correct user input. Don't assume things.
//     When in doubt, return an error and explain the situation to the user.
//   * All configuration input must come from the URL string in func Open()
//     or the Config{} struct in WithInstance. Don't os.Getenv().
type Driver interface {
	// Open returns a new driver instance configured with parameters
	// coming from the URL string. Migrate will call this function
	// only once per instance.
	Open(url string) (Driver, error)

	// Close closes the underlying database instance managed by the driver.
	// Migrate will call this function only once per instance.
	Close() error

	// Lock should acquire a database lock so that only one migration process
	// can run at a time. Migrate will call this function before Run is called.
	// If the implementation can't provide this functionality, return nil.
	// Return database.ErrLocked if database is already locked.
	Lock() error

	// Unlock should release the lock. Migrate will call this function after
	// all migrations have been run.
	Unlock() error

	// Run applies a migration to the database. migration is garantueed to be not nil.
	Run(migration io.Reader) error

	// SetVersion saves version and dirty state.
	// Migrate will call this function before and after each call to Run.
	// version must be >= -1. -1 means NilVersion.
	SetVersion(version int, dirty bool) error

	// Version returns the currently active version and if the database is dirty.
	// When no migration has been applied, it must return version -1.
	// Dirty means, a previous migration failed and user interaction is required.
	Version() (version int, dirty bool, err error)

	// Drop deletes everything in the database.
	// Note that this is a breaking action, a new call to Open() is necessary to
	// ensure subsequent calls work as expected.
	Drop() error
}

// Open returns a new driver instance.
func Open(url string) (Driver, error) {
	scheme, err := iurl.SchemeFromURL(url)
	if err != nil {
		return nil, err
	}

	driversMu.RLock()
	d, ok := drivers[scheme]
	driversMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("database driver: unknown driver %v (forgotten import?)", scheme)
	}

	return d.Open(url)
}

// Register globally registers a driver.
func Register(name string, driver Driver) {
	driversMu.Lock()
	defer driversMu.Unlock()
	if driver == nil {
		panic("Register driver is nil")
	}
	if _, dup := drivers[name]; dup {
		panic("Register called twice for driver " + name)
	}
	drivers[name] = driver
}

// List lists the registered drivers
func List() []string {
	driversMu.RLock()
	defer driversMu.RUnlock()
	names := make([]string, 0, len(drivers))
	for n := range drivers {
		names = append(names, n)
	}
	return names
}
