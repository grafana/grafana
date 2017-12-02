package mssql

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

type copyin struct {
	cn       *MssqlConn
	bulkcopy *MssqlBulk
	closed   bool
}

type SerializableBulkConfig struct {
	TableName   string
	ColumnsName []string
	Options     MssqlBulkOptions
}

func (d *MssqlDriver) OpenConnection(dsn string) (*MssqlConn, error) {
	return d.open(dsn)
}

func (c *MssqlConn) prepareCopyIn(query string) (_ driver.Stmt, err error) {
	config_json := query[11:]

	bulkconfig := SerializableBulkConfig{}
	err = json.Unmarshal([]byte(config_json), &bulkconfig)
	if err != nil {
		return
	}

	bulkcopy := c.CreateBulk(bulkconfig.TableName, bulkconfig.ColumnsName)
	bulkcopy.Options = bulkconfig.Options

	ci := &copyin{
		cn:       c,
		bulkcopy: bulkcopy,
	}

	return ci, nil
}

func CopyIn(table string, options MssqlBulkOptions, columns ...string) string {
	bulkconfig := &SerializableBulkConfig{TableName: table, Options: options, ColumnsName: columns}

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
	return nil, errors.New("ErrNotSupported")
}

func (ci *copyin) Exec(v []driver.Value) (r driver.Result, err error) {
	if ci.closed {
		return nil, errors.New("errCopyInClosed")
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
