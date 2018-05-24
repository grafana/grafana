package core

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"sync"
)

var (
	DefaultCacheSize = 200
)

func MapToSlice(query string, mp interface{}) (string, []interface{}, error) {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return "", []interface{}{}, ErrNoMapPointer
	}

	args := make([]interface{}, 0, len(vv.Elem().MapKeys()))
	var err error
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		v := vv.Elem().MapIndex(reflect.ValueOf(src[1:]))
		if !v.IsValid() {
			err = fmt.Errorf("map key %s is missing", src[1:])
		} else {
			args = append(args, v.Interface())
		}
		return "?"
	})

	return query, args, err
}

func StructToSlice(query string, st interface{}) (string, []interface{}, error) {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return "", []interface{}{}, ErrNoStructPointer
	}

	args := make([]interface{}, 0)
	var err error
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		fv := vv.Elem().FieldByName(src[1:]).Interface()
		if v, ok := fv.(driver.Valuer); ok {
			var value driver.Value
			value, err = v.Value()
			if err != nil {
				return "?"
			}
			args = append(args, value)
		} else {
			args = append(args, fv)
		}
		return "?"
	})
	if err != nil {
		return "", []interface{}{}, err
	}
	return query, args, nil
}

type cacheStruct struct {
	value reflect.Value
	idx   int
}

type DB struct {
	*sql.DB
	Mapper            IMapper
	reflectCache      map[reflect.Type]*cacheStruct
	reflectCacheMutex sync.RWMutex
}

func Open(driverName, dataSourceName string) (*DB, error) {
	db, err := sql.Open(driverName, dataSourceName)
	if err != nil {
		return nil, err
	}
	return &DB{
		DB:           db,
		Mapper:       NewCacheMapper(&SnakeMapper{}),
		reflectCache: make(map[reflect.Type]*cacheStruct),
	}, nil
}

func FromDB(db *sql.DB) *DB {
	return &DB{
		DB:           db,
		Mapper:       NewCacheMapper(&SnakeMapper{}),
		reflectCache: make(map[reflect.Type]*cacheStruct),
	}
}

func (db *DB) reflectNew(typ reflect.Type) reflect.Value {
	db.reflectCacheMutex.Lock()
	defer db.reflectCacheMutex.Unlock()
	cs, ok := db.reflectCache[typ]
	if !ok || cs.idx+1 > DefaultCacheSize-1 {
		cs = &cacheStruct{reflect.MakeSlice(reflect.SliceOf(typ), DefaultCacheSize, DefaultCacheSize), 0}
		db.reflectCache[typ] = cs
	} else {
		cs.idx = cs.idx + 1
	}
	return cs.value.Index(cs.idx).Addr()
}

func (db *DB) Query(query string, args ...interface{}) (*Rows, error) {
	rows, err := db.DB.Query(query, args...)
	if err != nil {
		if rows != nil {
			rows.Close()
		}
		return nil, err
	}
	return &Rows{rows, db}, nil
}

func (db *DB) QueryMap(query string, mp interface{}) (*Rows, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return db.Query(query, args...)
}

func (db *DB) QueryStruct(query string, st interface{}) (*Rows, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return db.Query(query, args...)
}

func (db *DB) QueryRow(query string, args ...interface{}) *Row {
	rows, err := db.Query(query, args...)
	if err != nil {
		return &Row{nil, err}
	}
	return &Row{rows, nil}
}

func (db *DB) QueryRowMap(query string, mp interface{}) *Row {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return &Row{nil, err}
	}
	return db.QueryRow(query, args...)
}

func (db *DB) QueryRowStruct(query string, st interface{}) *Row {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return &Row{nil, err}
	}
	return db.QueryRow(query, args...)
}

type Stmt struct {
	*sql.Stmt
	db    *DB
	names map[string]int
}

func (db *DB) Prepare(query string) (*Stmt, error) {
	names := make(map[string]int)
	var i int
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		names[src[1:]] = i
		i += 1
		return "?"
	})

	stmt, err := db.DB.Prepare(query)
	if err != nil {
		return nil, err
	}
	return &Stmt{stmt, db, names}, nil
}

func (s *Stmt) ExecMap(mp interface{}) (sql.Result, error) {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().MapIndex(reflect.ValueOf(k)).Interface()
	}
	return s.Stmt.Exec(args...)
}

func (s *Stmt) ExecStruct(st interface{}) (sql.Result, error) {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().FieldByName(k).Interface()
	}
	return s.Stmt.Exec(args...)
}

func (s *Stmt) Query(args ...interface{}) (*Rows, error) {
	rows, err := s.Stmt.Query(args...)
	if err != nil {
		return nil, err
	}
	return &Rows{rows, s.db}, nil
}

func (s *Stmt) QueryMap(mp interface{}) (*Rows, error) {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().MapIndex(reflect.ValueOf(k)).Interface()
	}

	return s.Query(args...)
}

func (s *Stmt) QueryStruct(st interface{}) (*Rows, error) {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return nil, errors.New("mp should be a map's pointer")
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().FieldByName(k).Interface()
	}

	return s.Query(args...)
}

func (s *Stmt) QueryRow(args ...interface{}) *Row {
	rows, err := s.Query(args...)
	return &Row{rows, err}
}

func (s *Stmt) QueryRowMap(mp interface{}) *Row {
	vv := reflect.ValueOf(mp)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Map {
		return &Row{nil, errors.New("mp should be a map's pointer")}
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().MapIndex(reflect.ValueOf(k)).Interface()
	}

	return s.QueryRow(args...)
}

func (s *Stmt) QueryRowStruct(st interface{}) *Row {
	vv := reflect.ValueOf(st)
	if vv.Kind() != reflect.Ptr || vv.Elem().Kind() != reflect.Struct {
		return &Row{nil, errors.New("st should be a struct's pointer")}
	}

	args := make([]interface{}, len(s.names))
	for k, i := range s.names {
		args[i] = vv.Elem().FieldByName(k).Interface()
	}

	return s.QueryRow(args...)
}

var (
	re = regexp.MustCompile(`[?](\w+)`)
)

// insert into (name) values (?)
// insert into (name) values (?name)
func (db *DB) ExecMap(query string, mp interface{}) (sql.Result, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return db.DB.Exec(query, args...)
}

func (db *DB) ExecStruct(query string, st interface{}) (sql.Result, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return db.DB.Exec(query, args...)
}

type EmptyScanner struct {
}

func (EmptyScanner) Scan(src interface{}) error {
	return nil
}

type Tx struct {
	*sql.Tx
	db *DB
}

func (db *DB) Begin() (*Tx, error) {
	tx, err := db.DB.Begin()
	if err != nil {
		return nil, err
	}
	return &Tx{tx, db}, nil
}

func (tx *Tx) Prepare(query string) (*Stmt, error) {
	names := make(map[string]int)
	var i int
	query = re.ReplaceAllStringFunc(query, func(src string) string {
		names[src[1:]] = i
		i += 1
		return "?"
	})

	stmt, err := tx.Tx.Prepare(query)
	if err != nil {
		return nil, err
	}
	return &Stmt{stmt, tx.db, names}, nil
}

func (tx *Tx) Stmt(stmt *Stmt) *Stmt {
	// TODO:
	return stmt
}

func (tx *Tx) ExecMap(query string, mp interface{}) (sql.Result, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return tx.Tx.Exec(query, args...)
}

func (tx *Tx) ExecStruct(query string, st interface{}) (sql.Result, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return tx.Tx.Exec(query, args...)
}

func (tx *Tx) Query(query string, args ...interface{}) (*Rows, error) {
	rows, err := tx.Tx.Query(query, args...)
	if err != nil {
		return nil, err
	}
	return &Rows{rows, tx.db}, nil
}

func (tx *Tx) QueryMap(query string, mp interface{}) (*Rows, error) {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return nil, err
	}
	return tx.Query(query, args...)
}

func (tx *Tx) QueryStruct(query string, st interface{}) (*Rows, error) {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return nil, err
	}
	return tx.Query(query, args...)
}

func (tx *Tx) QueryRow(query string, args ...interface{}) *Row {
	rows, err := tx.Query(query, args...)
	return &Row{rows, err}
}

func (tx *Tx) QueryRowMap(query string, mp interface{}) *Row {
	query, args, err := MapToSlice(query, mp)
	if err != nil {
		return &Row{nil, err}
	}
	return tx.QueryRow(query, args...)
}

func (tx *Tx) QueryRowStruct(query string, st interface{}) *Row {
	query, args, err := StructToSlice(query, st)
	if err != nil {
		return &Row{nil, err}
	}
	return tx.QueryRow(query, args...)
}
