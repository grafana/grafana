package mssql

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
)

type copyin struct {
	cn       *Conn
	bulkcopy *Bulk
	closed   bool
}

type serializableBulkConfig struct {
	TableName   string
	ColumnsName []string
	Options     BulkOptions
}

func (d *Driver) OpenConnection(dsn string) (*Conn, error) {
	return d.open(context.Background(), dsn)
}

func (c *Conn) prepareCopyIn(ctx context.Context, query string) (_ driver.Stmt, err error) {
	config_json := query[11:]

	bulkconfig := serializableBulkConfig{}
	err = json.Unmarshal([]byte(config_json), &bulkconfig)
	if err != nil {
		return
	}

	bulkcopy := c.CreateBulkContext(ctx, bulkconfig.TableName, bulkconfig.ColumnsName)
	bulkcopy.Options = bulkconfig.Options

	ci := &copyin{
		cn:       c,
		bulkcopy: bulkcopy,
	}

	return ci, nil
}

func CopyIn(table string, options BulkOptions, columns ...string) string {
	bulkconfig := &serializableBulkConfig{TableName: table, Options: options, ColumnsName: columns}

	config_json, err := json.Marshal(bulkconfig)
	if err != nil {
		panic(err)
	}

	stmt := "INSERTBULK " + string(config_json)

	return stmt
}

func (ci *copyin) NumInput() int {
	return -1
}

func (ci *copyin) Query(v []driver.Value) (r driver.Rows, err error) {
	panic("should never be called")
}

func (ci *copyin) Exec(v []driver.Value) (r driver.Result, err error) {
	if ci.closed {
		return nil, errors.New("copyin query is closed")
	}

	if len(v) == 0 {
		rowCount, err := ci.bulkcopy.Done()
		ci.closed = true
		return driver.RowsAffected(rowCount), err
	}

	t := make([]interface{}, len(v))
	for i, val := range v {
		t[i] = val
	}

	err = ci.bulkcopy.AddRow(t)
	if err != nil {
		return
	}

	return driver.RowsAffected(0), nil
}

func (ci *copyin) Close() (err error) {
	return nil
}
