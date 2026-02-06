package memory

import (
	"sort"
	"strings"
	"sync"

	"github.com/dolthub/go-mysql-server/internal/similartext"
	"github.com/dolthub/go-mysql-server/sql"
)

var _ sql.DatabaseProvider = (*DbProvider)(nil)
var _ sql.MutableDatabaseProvider = (*DbProvider)(nil)
var _ sql.TableFunctionProvider = (*DbProvider)(nil)
var _ sql.ExternalStoredProcedureProvider = (*DbProvider)(nil)

// DbProvider is a provider for in-memory databases
type DbProvider struct {
	dbs                       map[string]sql.Database
	tableFunctions            map[string]sql.TableFunction
	externalProcedureRegistry sql.ExternalStoredProcedureRegistry
	mu                        *sync.RWMutex
	history                   bool
	readOnly                  bool
	nativeIndexes             bool
}

type ProviderOption func(*DbProvider)

// NewDBProvider creates a new DbProvider with the default options and the databases specified
func NewDBProvider(dbs ...sql.Database) *DbProvider {
	dbMap := make(map[string]sql.Database, len(dbs))
	for _, db := range dbs {
		dbMap[strings.ToLower(db.Name())] = db
	}

	externalProcedureRegistry := sql.NewExternalStoredProcedureRegistry()
	for _, esp := range ExternalStoredProcedures {
		externalProcedureRegistry.Register(esp)
	}

	return &DbProvider{
		dbs:                       dbMap,
		mu:                        &sync.RWMutex{},
		tableFunctions:            make(map[string]sql.TableFunction),
		externalProcedureRegistry: externalProcedureRegistry,
	}
}

// NewDBProviderWithOpts creates a new DbProvider with the given options and no databases
func NewDBProviderWithOpts(opts ...ProviderOption) sql.MutableDatabaseProvider {
	pro := NewDBProvider()
	for _, opt := range opts {
		opt(pro)
	}

	return pro
}

func (pro *DbProvider) WithTableFunctions(fns ...sql.TableFunction) (sql.TableFunctionProvider, error) {
	funcs := make(map[string]sql.TableFunction)
	for _, fn := range fns {
		funcs[strings.ToLower(fn.Name())] = fn
	}
	cp := *pro
	cp.tableFunctions = funcs
	return &cp, nil
}

// WithOption modifies the provider with the given option
func (pro *DbProvider) WithOption(opt ProviderOption) {
	opt(pro)
}

// ReadOnlyProvider returns a ProviderOption to construct a memoryDBProvider that is read-only
func ReadOnlyProvider(enableReadOnly bool) ProviderOption {
	return func(pro *DbProvider) {
		pro.readOnly = enableReadOnly
	}
}

func NativeIndexProvider(useNativeIndexes bool) ProviderOption {
	return func(pro *DbProvider) {
		pro.nativeIndexes = useNativeIndexes
	}
}

// HistoryProvider returns a ProviderOption to construct a memoryDBProvider that uses history databases
func HistoryProvider(enableHistory bool) ProviderOption {
	return func(pro *DbProvider) {
		pro.history = enableHistory
	}
}

// WithDbsOption returns a ProviderOption to construct a DbProvider with the given databases
func WithDbsOption(dbs []sql.Database) ProviderOption {
	return func(pro *DbProvider) {
		pro.dbs = make(map[string]sql.Database, len(dbs))
		for _, db := range dbs {
			pro.dbs[strings.ToLower(db.Name())] = db
		}
	}
}

// Database returns the Database with the given name if it exists.
func (pro *DbProvider) Database(_ *sql.Context, name string) (sql.Database, error) {
	pro.mu.RLock()
	defer pro.mu.RUnlock()

	db, ok := pro.dbs[strings.ToLower(name)]
	if ok {
		return db, nil
	}

	names := make([]string, 0, len(pro.dbs))
	for n := range pro.dbs {
		names = append(names, n)
	}

	similar := similartext.Find(names, name)
	return nil, sql.ErrDatabaseNotFound.New(name + similar)
}

// HasDatabase returns the Database with the given name if it exists.
func (pro *DbProvider) HasDatabase(_ *sql.Context, name string) bool {
	pro.mu.RLock()
	defer pro.mu.RUnlock()

	_, ok := pro.dbs[strings.ToLower(name)]
	return ok
}

// AllDatabases returns the Database with the given name if it exists.
func (pro *DbProvider) AllDatabases(*sql.Context) []sql.Database {
	pro.mu.RLock()
	defer pro.mu.RUnlock()

	all := make([]sql.Database, 0, len(pro.dbs))
	for _, db := range pro.dbs {
		all = append(all, db)
	}

	sort.Slice(all, func(i, j int) bool {
		return all[i].Name() < all[j].Name()
	})

	return all
}

// CreateDatabase implements MutableDatabaseProvider.
func (pro *DbProvider) CreateDatabase(_ *sql.Context, name string) (err error) {
	pro.mu.Lock()
	defer pro.mu.Unlock()

	var db sql.Database
	if pro.readOnly {
		db = NewReadOnlyDatabase(name)
		if pro.nativeIndexes {
			db.(ReadOnlyDatabase).EnablePrimaryKeyIndexes()
		}
	} else if pro.history {
		db = NewHistoryDatabase(name)
		if pro.nativeIndexes {
			db.(*HistoryDatabase).EnablePrimaryKeyIndexes()
		}
	} else {
		db = NewDatabase(name)
		if pro.nativeIndexes {
			db.(*Database).EnablePrimaryKeyIndexes()
		}
	}

	pro.dbs[strings.ToLower(db.Name())] = db
	return
}

// DropDatabase implements MutableDatabaseProvider.
func (pro *DbProvider) DropDatabase(_ *sql.Context, name string) (err error) {
	pro.mu.Lock()
	defer pro.mu.Unlock()

	delete(pro.dbs, strings.ToLower(name))
	return
}

// ExternalStoredProcedure implements sql.ExternalStoredProcedureProvider
func (pro *DbProvider) ExternalStoredProcedure(_ *sql.Context, name string, numOfParams int) (*sql.ExternalStoredProcedureDetails, error) {
	return pro.externalProcedureRegistry.LookupByNameAndParamCount(name, numOfParams)
}

// ExternalStoredProcedures implements sql.ExternalStoredProcedureProvider
func (pro *DbProvider) ExternalStoredProcedures(_ *sql.Context, name string) ([]sql.ExternalStoredProcedureDetails, error) {
	return pro.externalProcedureRegistry.LookupByName(name)
}

// TableFunction implements sql.TableFunctionProvider
func (pro *DbProvider) TableFunction(_ *sql.Context, name string) (sql.TableFunction, bool) {
	if tableFunction, ok := pro.tableFunctions[name]; ok {
		return tableFunction, true
	}

	return nil, false
}
