package crate

import (
	"bytes"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
)

// Crate conn structure
type CrateDriver struct {
	Url        string // Crate http endpoint url
	username   string
	password   string
	httpClient *http.Client
}

// Init a new "Connection" to a Crate Data Storage instance.
// Note that the connection is not tested until the first query.
func (c *CrateDriver) Open(crate_url string) (driver.Conn, error) {
	u, err := url.Parse(crate_url)

	if err != nil {
		return nil, err
	}

	sanUrl := fmt.Sprintf("%s://%s", u.Scheme, u.Host)

	c.Url = sanUrl
	c.httpClient = &http.Client{}

	if u.User != nil {
		username := u.User.Username()
		password, _ := u.User.Password()

		c.username = username
		c.password = password
	}

	return c, nil
}

// JSON endpoint response struct
// We expect error to be null or ommited
type endpointResponse struct {
	Error struct {
		Message string
		Code    int
	} `json:"error"`
	Cols        []string        `json:"cols"`
	Duration    float64         `json:"duration"`
	ColumnTypes []interface{}   `json:"col_types"`
	Rowcount    int64           `json:"rowcount"`
	Rows        [][]interface{} `json:"rows"`
}

// JSON endpoint request struct
type endpointQuery struct {
	Stmt string         `json:"stmt"`
	Args []driver.Value `json:"args,omitempty"`
}

// Query the database using prepared statements.
// Read: https://crate.io/docs/stable/sql/rest.html for more information about the returned response.
// Example: crate.Query("SELECT * FROM sys.cluster LIMIT ?", 10)
// "Parameter Substitution" is also supported, read, https://crate.io/docs/stable/sql/rest.html#parameter-substitution
// This is the internal query function
func (c *CrateDriver) query(stmt string, args []driver.Value) (*endpointResponse, error) {
	endpoint := c.Url + "/_sql?types"

	query := &endpointQuery{
		Stmt: stmt,
	}

	if len(args) > 0 {
		query.Args = args
	}

	buf, err := json.Marshal(query)

	if err != nil {
		return nil, err
	}

	data := bytes.NewReader(buf)

	req, err := http.NewRequest("POST", endpoint, data)
	if err != nil {
		return nil, err
	}

	if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	req.Header.Add("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode <= 299 {
		// Parse response
		res := &endpointResponse{}
		d := json.NewDecoder(resp.Body)

		// We need to set this, or long integers will be interpreted as floats
		d.UseNumber()

		err = d.Decode(res)

		if err != nil {
			return nil, err
		}

		// Check for db errors
		if res.Error.Code != 0 {
			err = &CrateErr{
				Code:    res.Error.Code,
				Message: res.Error.Message,
			}
			return nil, err
		}

		return res, nil
	} else {
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		msg := fmt.Sprintf("Invalid http status code %d, body: %s", resp.StatusCode, string(body))

		return nil, errors.New(msg)
	}
}

// Queries the database
func (c *CrateDriver) Query(stmt string, args []driver.Value) (driver.Rows, error) {
	res, err := c.query(stmt, args)

	if err != nil {
		return nil, err
	}

	// Rows reader
	rows := &Rows{
		columns:  res.Cols,
		values:   res.Rows,
		rowcount: res.Rowcount,
	}

	return rows, nil
}

// Exec queries on the dataabase
func (c *CrateDriver) Exec(stmt string, args []driver.Value) (result driver.Result, err error) {
	res, err := c.query(stmt, args)

	if err != nil {
		return nil, err
	}

	result = &Result{res.Rowcount}

	return result, nil
}

// Result interface
type Result struct {
	affectedRows int64
}

// Last inserted id
func (r *Result) LastInsertId() (int64, error) {
	err := errors.New("LastInsertId() not supported.")
	return 0, err
}

// # of affected rows on exec
func (r *Result) RowsAffected() (int64, error) {
	return r.affectedRows, nil
}

// Rows reader
type Rows struct {
	columns  []string
	values   [][]interface{}
	rowcount int64
	pos      int64 // index position on the values array
}

// Row columns
func (r *Rows) Columns() []string {
	return r.columns
}

// Get the next row
func (r *Rows) Next(dest []driver.Value) error {
	if r.pos >= r.rowcount {
		return io.EOF
	}

	for i := range dest {
		dest[i] = r.values[r.pos][i]
	}

	r.pos++

	return nil
}

// Close
func (r *Rows) Close() error {
	r.pos = r.rowcount // Set to end of list
	return nil
}

// Yet not supported
func (c *CrateDriver) Begin() (driver.Tx, error) {
	err := errors.New("Transactions are not supported by this driver.")
	return nil, err
}

// Nothing to close, crate is stateless
func (c *CrateDriver) Close() error {
	return nil
}

// Prepared stmt interface
type CrateStmt struct {
	stmt   string // Query stmt
	driver *CrateDriver
}

// Driver method that initiates the prepared stmt interface
func (c *CrateDriver) Prepare(query string) (driver.Stmt, error) {
	stmt := &CrateStmt{
		stmt:   query,
		driver: c,
	}

	return stmt, nil
}

// Just pass it to the driver's' default Query() function
func (s *CrateStmt) Query(args []driver.Value) (driver.Rows, error) {
	return s.driver.Query(s.stmt, args)
}

// Just pass it to the driver's default Exec() function
func (s *CrateStmt) Exec(args []driver.Value) (driver.Result, error) {
	return s.driver.Exec(s.stmt, args)
}

// No need to implement close
func (s *CrateStmt) Close() error {
	return nil
}

// The NumInput method is not supported, return -1 so the database/sql packages knows.
func (s *CrateStmt) NumInput() int {
	return -1
}

// Register the driver
func init() {
	sql.Register("crate", &CrateDriver{})
}
