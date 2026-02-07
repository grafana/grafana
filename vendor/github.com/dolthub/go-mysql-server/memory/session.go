// Copyright 2023 Dolthub, Inc.
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
	"context"
	"fmt"
	"strings"

	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
)

type GlobalsMap = map[string]interface{}
type Session struct {
	*sql.BaseSession
	dbProvider       sql.DatabaseProvider
	tables           map[tableKey]*TableData
	editAccumulators map[tableKey]tableEditAccumulator
	persistedGlobals GlobalsMap
	validateCallback func()
}

var _ sql.Session = (*Session)(nil)
var _ sql.TransactionSession = (*Session)(nil)
var _ sql.Transaction = (*Transaction)(nil)
var _ sql.PersistableSession = (*Session)(nil)

// NewSession returns the new session for this object
func NewSession(baseSession *sql.BaseSession, provider sql.DatabaseProvider) *Session {
	return &Session{
		BaseSession:      baseSession,
		dbProvider:       provider,
		tables:           make(map[tableKey]*TableData),
		editAccumulators: make(map[tableKey]tableEditAccumulator),
	}
}

func SessionFromContext(ctx *sql.Context) *Session {
	return ctx.Session.(*Session)
}

// NewSessionBuilder returns a session for the given in-memory database provider suitable to use in a test server
// This can't be defined as server.SessionBuilder because importing it would create a circular dependency,
// but it's the same signature.
func NewSessionBuilder(pro *DbProvider) func(ctx context.Context, conn *mysql.Conn, addr string) (sql.Session, error) {
	return func(ctx context.Context, conn *mysql.Conn, addr string) (sql.Session, error) {
		host := ""
		user := ""
		mysqlConnectionUser, ok := conn.UserData.(sql.MysqlConnectionUser)
		if ok {
			host = mysqlConnectionUser.Host
			user = mysqlConnectionUser.User
		}

		client := sql.Client{Address: host, User: user, Capabilities: conn.Capabilities}
		baseSession := sql.NewBaseSessionWithClientServer(addr, client, conn.ConnectionID)
		return NewSession(baseSession, pro), nil
	}
}

type Transaction struct {
	readOnly bool
}

var _ sql.Transaction = (*Transaction)(nil)

func (s *Transaction) String() string {
	return "in-memory transaction"
}

func (s *Transaction) IsReadOnly() bool {
	return s.readOnly
}

type tableKey struct {
	db    string
	table string
}

func key(t *TableData) tableKey {
	return tableKey{strings.ToLower(t.dbName), strings.ToLower(t.tableName)}
}

// editAccumulator returns the edit accumulator for this session for the table provided. Some statement types, like
// updates with an on duplicate key clause, require an accumulator to be shared among all table editors
func (s *Session) editAccumulator(t *Table) tableEditAccumulator {
	ea, ok := s.editAccumulators[key(t.data)]
	if !ok {
		ea = newTableEditAccumulator(t.data)
		s.editAccumulators[key(t.data)] = ea
	}
	return ea
}

func (s *Session) clearEditAccumulator(t *Table) {
	delete(s.editAccumulators, key(t.data))
}

func keyFromNames(dbName, tableName string) tableKey {
	return tableKey{strings.ToLower(dbName), strings.ToLower(tableName)}
}

// tableData returns the table data for this session for the table provided
func (s *Session) tableData(t *Table) *TableData {
	td, ok := s.tables[key(t.data)]
	if !ok {
		s.tables[key(t.data)] = t.data
		return t.data
	}

	return td
}

// putTable stores the table data for this session for the table provided
func (s *Session) putTable(d *TableData) {
	s.tables[key(d)] = d
	delete(s.editAccumulators, key(d))
}

// dropTable clears the table data for the session
func (s *Session) dropTable(d *TableData) {
	delete(s.tables, key(d))
}

// StartTransaction clears session state and returns a new transaction object.
// Because we don't support concurrency, we store table data changes in the session, rather than the transaction itself.
func (s *Session) StartTransaction(ctx *sql.Context, tCharacteristic sql.TransactionCharacteristic) (sql.Transaction, error) {
	s.tables = make(map[tableKey]*TableData)
	s.editAccumulators = make(map[tableKey]tableEditAccumulator)
	return &Transaction{tCharacteristic == sql.ReadOnly}, nil
}

func (s *Session) CommitTransaction(ctx *sql.Context, tx sql.Transaction) error {
	for key := range s.tables {
		if key.db == "" && key.table == "" {
			// dual table
			continue
		}
		db, err := s.dbProvider.Database(ctx, key.db)
		if err != nil {
			return err
		}

		var baseDb *BaseDatabase
		switch db := db.(type) {
		case *BaseDatabase:
			baseDb = db
		case *Database:
			baseDb = db.BaseDatabase
		case *HistoryDatabase:
			baseDb = db.BaseDatabase
		default:
			return fmt.Errorf("unknown database type %T", db)
		}
		baseDb.putTable(s.tables[key].Table(baseDb))
	}

	return nil
}

func (s *Session) Rollback(ctx *sql.Context, transaction sql.Transaction) error {
	s.tables = make(map[tableKey]*TableData)
	s.editAccumulators = make(map[tableKey]tableEditAccumulator)
	return nil
}

func (s *Session) CreateSavepoint(ctx *sql.Context, transaction sql.Transaction, name string) error {
	return fmt.Errorf("savepoints are not supported in memory sessions")
}

func (s *Session) RollbackToSavepoint(ctx *sql.Context, transaction sql.Transaction, name string) error {
	return fmt.Errorf("savepoints are not supported in memory sessions")
}

func (s *Session) ReleaseSavepoint(ctx *sql.Context, transaction sql.Transaction, name string) error {
	return fmt.Errorf("savepoints are not supported in memory sessions")
}

// PersistGlobal implements sql.PersistableSession
func (s *Session) PersistGlobal(ctx *sql.Context, sysVarName string, value interface{}) error {
	sysVar, _, ok := sql.SystemVariables.GetGlobal(sysVarName)
	if !ok {
		return sql.ErrUnknownSystemVariable.New(sysVarName)
	}
	val, _, err := sysVar.GetType().Convert(ctx, value)
	if err != nil {
		return err
	}
	s.persistedGlobals[sysVarName] = val
	return nil
}

func (s *Session) SetGlobals(globals map[string]interface{}) *Session {
	s.persistedGlobals = globals
	return s
}

func (s *Session) SetValidationCallback(validationCallback func()) *Session {
	s.validateCallback = validationCallback
	return s
}

// RemovePersistedGlobal implements sql.PersistableSession
func (s *Session) RemovePersistedGlobal(sysVarName string) error {
	if _, _, ok := sql.SystemVariables.GetGlobal(sysVarName); !ok {
		return sql.ErrUnknownSystemVariable.New(sysVarName)
	}
	delete(s.persistedGlobals, sysVarName)
	return nil
}

// RemoveAllPersistedGlobals implements sql.PersistableSession
func (s *Session) RemoveAllPersistedGlobals() error {
	s.persistedGlobals = GlobalsMap{}
	return nil
}

// GetPersistedValue implements sql.PersistableSession
func (s *Session) GetPersistedValue(k string) (interface{}, error) {
	return s.persistedGlobals[k], nil
}

// ValidateSession counts the number of times this method is called.
func (s *Session) ValidateSession(ctx *sql.Context) error {
	if s.validateCallback != nil {
		s.validateCallback()
	}
	return s.BaseSession.ValidateSession(ctx)
}
