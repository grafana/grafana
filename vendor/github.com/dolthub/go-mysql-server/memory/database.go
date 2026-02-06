// Copyright 2020-2021 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package memory

import (
	"fmt"
	"strings"
	"time"

	"sync"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/fulltext"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Database is an in-memory database.
type Database struct {
	*BaseDatabase
	views map[string]sql.ViewDefinition
}

type MemoryDatabase interface {
	sql.Database
	AddTable(name string, t MemTable)
	DeleteTable(name string)
	Database() *BaseDatabase
}

var _ sql.Database = (*Database)(nil)
var _ sql.TableCreator = (*Database)(nil)
var _ sql.IndexedTableCreator = (*Database)(nil)
var _ sql.TableDropper = (*Database)(nil)
var _ sql.TableRenamer = (*Database)(nil)
var _ sql.TriggerDatabase = (*Database)(nil)
var _ sql.StoredProcedureDatabase = (*Database)(nil)
var _ sql.EventDatabase = (*Database)(nil)
var _ sql.ViewDatabase = (*Database)(nil)
var _ sql.CollatedDatabase = (*Database)(nil)
var _ fulltext.Database = (*Database)(nil)
var _ sql.SchemaValidator = (*BaseDatabase)(nil)

// BaseDatabase is an in-memory database that can't store views, only for testing the engine
type BaseDatabase struct {
	tables            map[string]MemTable
	fkColl            *ForeignKeyCollection
	tablesMu          *sync.RWMutex
	name              string
	triggers          []sql.TriggerDefinition
	storedProcedures  []sql.StoredProcedureDetails
	events            []sql.EventDefinition
	collation         sql.CollationID
	primaryKeyIndexes bool
}

var _ MemoryDatabase = (*Database)(nil)
var _ MemoryDatabase = (*BaseDatabase)(nil)

// NewDatabase creates a new database with the given name.
func NewDatabase(name string) *Database {
	return &Database{
		BaseDatabase: NewViewlessDatabase(name),
		views:        make(map[string]sql.ViewDefinition),
	}
}

// NewViewlessDatabase creates a new database that doesn't persist views. Used only for testing. Use NewDatabase.
func NewViewlessDatabase(name string) *BaseDatabase {
	return &BaseDatabase{
		name:     name,
		tables:   map[string]MemTable{},
		fkColl:   newForeignKeyCollection(),
		tablesMu: &sync.RWMutex{},
	}
}

// ValidateSchema implements sql.SchemaValidator
func (d *BaseDatabase) ValidateSchema(schema sql.Schema) error {
	return validateMaxRowLength(schema)
}

// EnablePrimaryKeyIndexes causes every table created in this database to use an index on its primary partitionKeys
func (d *BaseDatabase) EnablePrimaryKeyIndexes() {
	d.primaryKeyIndexes = true
}

func (d *BaseDatabase) Database() *BaseDatabase {
	return d
}

// Name returns the database name.
func (d *BaseDatabase) Name() string {
	return d.name
}

// Tables returns all tables in the database.
func (d *BaseDatabase) Tables() map[string]sql.Table {
	d.tablesMu.RLock()
	defer d.tablesMu.RUnlock()
	tables := make(map[string]sql.Table, len(d.tables))
	for name, table := range d.tables {
		tables[name] = table
	}
	return tables
}

func (d *BaseDatabase) GetTableInsensitive(ctx *sql.Context, tblName string) (sql.Table, bool, error) {
	tbl, ok := sql.GetTableInsensitive(tblName, d.Tables())
	if !ok {
		return nil, false, nil
	}

	memTable := tbl.(MemTable)
	if memTable.IgnoreSessionData() {
		return memTable, ok, nil
	}

	underlying := memTable.UnderlyingTable()
	// look in the session for table data. If it's not there, then cache it in the session and return it
	sess := SessionFromContext(ctx)
	underlying = underlying.copy()
	underlying.data = sess.tableData(underlying)

	return underlying, ok, nil
}

// putTable writes the table given into database storage. A table with this name must already be present.
func (d *BaseDatabase) putTable(t *Table) {
	lowerName := strings.ToLower(t.name)
	d.tablesMu.RLock()
	for name, table := range d.tables {
		if strings.ToLower(name) == lowerName {
			t.name = table.Name()
			d.tablesMu.RUnlock()
			d.AddTable(name, t)
			return
		}
	}
	d.tablesMu.RUnlock()
	panic(fmt.Sprintf("table %s not found", t.name))
}

func (d *BaseDatabase) GetTableNames(ctx *sql.Context) ([]string, error) {
	d.tablesMu.RLock()
	defer d.tablesMu.RUnlock()

	tblNames := make([]string, 0, len(d.tables))
	for k := range d.tables {
		tblNames = append(tblNames, k)
	}

	return tblNames, nil
}

func (d *BaseDatabase) CreateFulltextTableNames(ctx *sql.Context, parentTableName string, parentIndexName string) (fulltext.IndexTableNames, error) {
	d.tablesMu.RLock()
	defer d.tablesMu.RUnlock()

	var tablePrefix string
OuterLoop:
	for i := uint64(0); true; i++ {
		tablePrefix = strings.ToLower(fmt.Sprintf("%s_%s_%d", parentTableName, parentIndexName, i))
		for tableName := range d.tables {
			if strings.HasPrefix(strings.ToLower(tableName), tablePrefix) {
				continue OuterLoop
			}
		}
		break
	}
	return fulltext.IndexTableNames{
		Config:      fmt.Sprintf("%s_FTS_CONFIG", parentTableName),
		Position:    fmt.Sprintf("%s_FTS_POSITION", tablePrefix),
		DocCount:    fmt.Sprintf("%s_FTS_DOC_COUNT", tablePrefix),
		GlobalCount: fmt.Sprintf("%s_FTS_GLOBAL_COUNT", tablePrefix),
		RowCount:    fmt.Sprintf("%s_FTS_ROW_COUNT", tablePrefix),
	}, nil
}

func (d *BaseDatabase) GetForeignKeyCollection() *ForeignKeyCollection {
	return d.fkColl
}

// HistoryDatabase is a test-only VersionedDatabase implementation. It only supports exact lookups, not AS OF queries
// between two revisions. It's constructed just like its non-versioned sibling, but it can receive updates to particular
// tables via the AddTableAsOf method. Consecutive calls to AddTableAsOf with the same table must install new versions
// of the named table each time, with ascending version identifiers, for this to work.
type HistoryDatabase struct {
	*Database
	Revisions    map[string]map[interface{}]sql.Table
	currRevision interface{}
}

var _ sql.VersionedDatabase = (*HistoryDatabase)(nil)

func (db *HistoryDatabase) GetTableInsensitiveAsOf(ctx *sql.Context, tblName string, time interface{}) (sql.Table, bool, error) {
	table, ok := db.Revisions[strings.ToLower(tblName)][time]
	if ok {
		return table, true, nil
	}

	// If we have revisions for the named table, but not the named revision, consider it not found.
	if _, ok := db.Revisions[strings.ToLower(tblName)]; ok {
		return nil, false, sql.ErrTableNotFound.New(tblName)
	}

	// Otherwise (this table has no revisions), return it as an unversioned lookup
	return db.GetTableInsensitive(ctx, tblName)
}

func (db *HistoryDatabase) GetTableNamesAsOf(ctx *sql.Context, time interface{}) ([]string, error) {
	// TODO: this can't make any queries fail (only used for error messages on table lookup failure), but would be nice
	//  to support better.
	return db.GetTableNames(ctx)
}

func NewHistoryDatabase(name string) *HistoryDatabase {
	return &HistoryDatabase{
		Database:  NewDatabase(name),
		Revisions: make(map[string]map[interface{}]sql.Table),
	}
}

// Adds a table with an asOf revision key. The table given becomes the current version for the name given.
func (db *HistoryDatabase) AddTableAsOf(name string, t sql.Table, asOf interface{}) {
	// TODO: this won't handle table names that vary only in case
	if _, ok := db.Revisions[strings.ToLower(name)]; !ok {
		db.Revisions[strings.ToLower(name)] = make(map[interface{}]sql.Table)
	}

	db.Revisions[strings.ToLower(name)][asOf] = t
	db.AddTable(name, t.(MemTable))
}

// AddTable adds a new table to the database.
func (d *BaseDatabase) AddTable(name string, t MemTable) {
	d.tablesMu.Lock()
	defer d.tablesMu.Unlock()
	d.tables[name] = t
}

// DeleteTable deletes a table from the database.
func (d *BaseDatabase) DeleteTable(name string) {
	d.tablesMu.Lock()
	defer d.tablesMu.Unlock()
	delete(d.tables, name)
}

// CreateTable creates a table with the given name and schema
func (d *BaseDatabase) CreateTable(ctx *sql.Context, name string, schema sql.PrimaryKeySchema, collation sql.CollationID, comment string) error {
	d.tablesMu.RLock()
	_, ok := d.tables[name]
	d.tablesMu.RUnlock()
	if ok {
		return sql.ErrTableAlreadyExists.New(name)
	}

	table := NewTableWithCollation(d, name, schema, d.fkColl, collation)
	table.db = d
	table.data.comment = comment
	if d.primaryKeyIndexes {
		table.EnablePrimaryKeyIndexes()
	}

	d.AddTable(name, table)
	sess := SessionFromContext(ctx)
	sess.putTable(table.data)

	return nil
}

// CreateIndexedTable creates a table with the given name and schema
func (d *BaseDatabase) CreateIndexedTable(ctx *sql.Context, name string, sch sql.PrimaryKeySchema, idxDef sql.IndexDef, collation sql.CollationID) error {
	d.tablesMu.RLock()
	_, ok := d.tables[name]
	d.tablesMu.RUnlock()
	if ok {
		return sql.ErrTableAlreadyExists.New(name)
	}

	table := NewTableWithCollation(d, name, sch, d.fkColl, collation)
	table.db = d
	if d.primaryKeyIndexes {
		table.EnablePrimaryKeyIndexes()
	}

	for _, idxCol := range idxDef.Columns {
		idx := sch.Schema.IndexOfColName(idxCol.Name)
		if idx == -1 {
			return sql.ErrColumnNotFound.New(idxCol.Name)
		}
		col := sch.Schema[idx]
		if col.PrimaryKey && types.IsText(col.Type) && idxCol.Length > 0 {
			return sql.ErrUnsupportedIndexPrefix.New(col.Name)
		}
	}

	d.AddTable(name, table)
	return nil
}

// DropTable drops the table with the given name
func (d *BaseDatabase) DropTable(ctx *sql.Context, name string) error {
	d.tablesMu.RLock()
	t, ok := d.tables[name]
	d.tablesMu.RUnlock()

	if !ok {
		return sql.ErrTableNotFound.New(name)
	}

	SessionFromContext(ctx).dropTable(t.(*Table).data)

	d.DeleteTable(name)
	return nil
}

func (d *BaseDatabase) RenameTable(ctx *sql.Context, oldName, newName string) error {
	d.tablesMu.RLock()
	tbl, ok := d.tables[oldName]
	d.tablesMu.RUnlock()

	if !ok {
		// Should be impossible (engine already checks this condition)
		return sql.ErrTableNotFound.New(oldName)
	}

	d.tablesMu.RLock()
	_, ok = d.tables[newName]
	d.tablesMu.RUnlock()

	if ok {
		return sql.ErrTableAlreadyExists.New(newName)
	}

	sess := SessionFromContext(ctx)

	// retrieve table data from session
	tbl.(*Table).data = sess.tableData(tbl.(*Table))
	sess.dropTable(tbl.(*Table).data)

	memTbl := tbl.(*Table).copy()
	memTbl.name = newName
	for _, col := range memTbl.data.schema.Schema {
		col.Source = newName
	}
	for _, index := range memTbl.data.indexes {
		memIndex := index.(*Index)
		for i, expr := range memIndex.Exprs {
			getField := expr.(*expression.GetField)
			memIndex.Exprs[i] = expression.NewGetFieldWithTable(i, 0, getField.Type(), d.name, newName, getField.Name(), getField.IsNullable())
		}
	}
	memTbl.data.tableName = newName

	d.AddTable(newName, memTbl)
	d.DeleteTable(oldName)
	sess.putTable(memTbl.data)

	return nil
}

func (d *BaseDatabase) GetTriggers(_ *sql.Context) ([]sql.TriggerDefinition, error) {
	var triggers []sql.TriggerDefinition
	triggers = append(triggers, d.triggers...)
	return triggers, nil
}

func (d *BaseDatabase) CreateTrigger(_ *sql.Context, definition sql.TriggerDefinition) error {
	d.triggers = append(d.triggers, definition)
	return nil
}

func (d *BaseDatabase) DropTrigger(_ *sql.Context, name string) error {
	found := false
	for i, trigger := range d.triggers {
		if trigger.Name == name {
			d.triggers = append(d.triggers[:i], d.triggers[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return sql.ErrTriggerDoesNotExist.New(name)
	}
	return nil
}

// GetStoredProcedure implements sql.StoredProcedureDatabase
func (d *BaseDatabase) GetStoredProcedure(ctx *sql.Context, name string) (sql.StoredProcedureDetails, bool, error) {
	name = strings.ToLower(name)
	for _, spd := range d.storedProcedures {
		if name == strings.ToLower(spd.Name) {
			return spd, true, nil
		}
	}
	return sql.StoredProcedureDetails{}, false, nil
}

// GetStoredProcedures implements sql.StoredProcedureDatabase
func (d *BaseDatabase) GetStoredProcedures(ctx *sql.Context) ([]sql.StoredProcedureDetails, error) {
	var spds []sql.StoredProcedureDetails
	spds = append(spds, d.storedProcedures...)
	return spds, nil
}

// SaveStoredProcedure implements sql.StoredProcedureDatabase
func (d *BaseDatabase) SaveStoredProcedure(ctx *sql.Context, spd sql.StoredProcedureDetails) error {
	loweredName := strings.ToLower(spd.Name)
	for _, existingSpd := range d.storedProcedures {
		if strings.ToLower(existingSpd.Name) == loweredName {
			return sql.ErrStoredProcedureAlreadyExists.New(spd.Name)
		}
	}
	d.storedProcedures = append(d.storedProcedures, spd)
	return nil
}

// DropStoredProcedure implements sql.StoredProcedureDatabase
func (d *BaseDatabase) DropStoredProcedure(ctx *sql.Context, name string) error {
	loweredName := strings.ToLower(name)
	found := false
	for i, spd := range d.storedProcedures {
		if strings.ToLower(spd.Name) == loweredName {
			d.storedProcedures = append(d.storedProcedures[:i], d.storedProcedures[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return sql.ErrStoredProcedureDoesNotExist.New(name)
	}
	return nil
}

// GetEvent implements sql.EventDatabase
func (d *BaseDatabase) GetEvent(ctx *sql.Context, name string) (sql.EventDefinition, bool, error) {
	name = strings.ToLower(name)
	for _, ed := range d.events {
		if name == strings.ToLower(ed.Name) {
			return ed, true, nil
		}
	}
	return sql.EventDefinition{}, false, nil
}

// GetEvents implements sql.EventDatabase
func (d *BaseDatabase) GetEvents(ctx *sql.Context) ([]sql.EventDefinition, interface{}, error) {
	var eds []sql.EventDefinition
	eds = append(eds, d.events...)
	// memory DB doesn't support event reloading, so token is always nil
	return eds, nil, nil
}

// SaveEvent implements sql.EventDatabase
func (d *BaseDatabase) SaveEvent(_ *sql.Context, event sql.EventDefinition) (bool, error) {
	loweredName := strings.ToLower(event.Name)
	for _, existingEvent := range d.events {
		if strings.ToLower(existingEvent.Name) == loweredName {
			return false, sql.ErrEventAlreadyExists.New(event.Name)
		}
	}
	d.events = append(d.events, event)
	return event.Status == sql.EventStatus_Enable.String(), nil
}

// DropEvent implements sql.EventDatabase
func (d *BaseDatabase) DropEvent(ctx *sql.Context, name string) error {
	loweredName := strings.ToLower(name)
	found := false
	for i, ed := range d.events {
		if strings.ToLower(ed.Name) == loweredName {
			d.events = append(d.events[:i], d.events[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return sql.ErrEventDoesNotExist.New(name)
	}
	return nil
}

// UpdateEvent implements sql.EventDatabase
func (d *BaseDatabase) UpdateEvent(_ *sql.Context, originalName string, event sql.EventDefinition) (bool, error) {
	loweredOriginalName := strings.ToLower(originalName)
	loweredNewName := strings.ToLower(event.Name)
	found := false
	for i, existingEd := range d.events {
		if loweredOriginalName != loweredNewName && strings.ToLower(existingEd.Name) == loweredNewName {
			// renaming event to existing name
			return false, sql.ErrEventAlreadyExists.New(loweredNewName)
		} else if strings.ToLower(existingEd.Name) == loweredOriginalName {
			d.events[i] = event
			found = true
		}
	}
	if !found {
		return false, sql.ErrEventDoesNotExist.New(event.Name)
	}
	return event.Status == sql.EventStatus_Enable.String(), nil
}

// UpdateLastExecuted implements sql.EventDatabase
func (d *BaseDatabase) UpdateLastExecuted(ctx *sql.Context, eventName string, lastExecuted time.Time) error {
	loweredName := strings.ToLower(eventName)
	found := false
	for _, existingEd := range d.events {
		if strings.ToLower(existingEd.Name) == loweredName {
			found = true
			existingEd.LastExecuted = lastExecuted
		}
	}
	// this should not happen, but sanity check
	if !found {
		return sql.ErrEventDoesNotExist.New(eventName)
	}
	return nil
}

// NeedsToReloadEvents implements sql.EventDatabase
func (d *Database) NeedsToReloadEvents(_ *sql.Context, token interface{}) (bool, error) {
	// Event reloading not supported for in-memory database
	return false, nil
}

// GetCollation implements sql.CollatedDatabase.
func (d *BaseDatabase) GetCollation(ctx *sql.Context) sql.CollationID {
	return d.collation
}

// SetCollation implements sql.CollatedDatabase.
func (d *BaseDatabase) SetCollation(ctx *sql.Context, collation sql.CollationID) error {
	d.collation = collation
	return nil
}

func (d *Database) Database() *BaseDatabase {
	return d.BaseDatabase
}

// CreateView implements the interface sql.ViewDatabase.
func (d *Database) CreateView(ctx *sql.Context, name string, selectStatement, createViewStmt string) error {
	_, ok := d.views[strings.ToLower(name)]
	if ok {
		return sql.ErrExistingView.New(d.Name(), name)
	}

	sqlMode := sql.LoadSqlMode(ctx)

	d.views[strings.ToLower(name)] = sql.ViewDefinition{
		Name:                name,
		TextDefinition:      selectStatement,
		CreateViewStatement: createViewStmt,
		SqlMode:             sqlMode.String(),
	}
	return nil
}

// DropView implements the interface sql.ViewDatabase.
func (d *Database) DropView(ctx *sql.Context, name string) error {
	_, ok := d.views[name]
	if !ok {
		return sql.ErrViewDoesNotExist.New(d.name, name)
	}

	delete(d.views, name)
	return nil
}

// AllViews implements the interface sql.ViewDatabase.
func (d *Database) AllViews(ctx *sql.Context) ([]sql.ViewDefinition, error) {
	var views []sql.ViewDefinition
	for _, def := range d.views {
		views = append(views, def)
	}
	return views, nil
}

// GetViewDefinition implements the interface sql.ViewDatabase.
func (d *Database) GetViewDefinition(ctx *sql.Context, viewName string) (sql.ViewDefinition, bool, error) {
	viewDef, ok := d.views[strings.ToLower(viewName)]
	return viewDef, ok, nil
}

type ReadOnlyDatabase struct {
	*HistoryDatabase
}

var _ sql.ReadOnlyDatabase = ReadOnlyDatabase{}

func NewReadOnlyDatabase(name string) ReadOnlyDatabase {
	h := NewHistoryDatabase(name)
	return ReadOnlyDatabase{h}
}

func (d ReadOnlyDatabase) IsReadOnly() bool {
	return true
}
