package blob

import (
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"fmt"
	_ "github.com/herenow/go-crate"
	"io"
	"net/http"
	"time"
)

type Driver struct {
	url string
	db  *sql.DB
}

type Table struct {
	Name string
	drv  *Driver
	c    *http.Client
}

// DownloadError represents an error that occurs when downloading a blob.
type DownloadError struct {
	Status string
	StatusCode int
	Message string
}

// Error returns a string representation of the DownloadError.
func (e DownloadError) Error() string {
	return e.Message
}

// New creates a new connection with crate server
func New(crate_url string) (*Driver, error) {
	db, err := sql.Open("crate", crate_url)
	if err != nil {
		return nil, err
	}
	return &Driver{
		url: crate_url,
		db:  db,
	}, nil
}

// NewTable create new blob table with name and extra int to specify
// shards(the second argument) and
// replicas(by the third int argument)
func (d *Driver) NewTable(name string, shards ...int) (*Table, error) {
	sql := fmt.Sprintf(
		"create blob table %s",
		name,
	)
	if len(shards) == 1 {
		sql = fmt.Sprintf(
			"create blob table %s clustered into %d shards",
			name, shards[0],
		)
	}
	if len(shards) >= 2 {
		sql = fmt.Sprintf(
			"create blob table %s clustered into %d shards with (number_of_replicas=%d)",
			name, shards[0], shards[1],
		)
	}
	_, err := d.db.Exec(sql)
	if err != nil {
		return nil, err
	}
	return &Table{
		Name: name,
		drv:  d,
		c:    new(http.Client),
	}, nil
}

// Get an existing table from the crate server
// or error when this table does not exist
func (d *Driver) GetTable(name string) (*Table, error) {
	row := d.db.QueryRow(
		"select table_name from information_schema.tables where table_name = ? and table_schema = 'blob'",
		name,
	)
	if err := row.Scan(&name); err != nil {
		return nil, err
	}
	return &Table{
		Name: name,
		drv:  d,
		c:    new(http.Client),
	}, nil
}

// Close the database connection
func (d *Driver) Close() error {
	if d.db != nil {
		return d.db.Close()
	}
	return nil
}

type Record struct {
	Digest       string
	LastModified time.Time
}

// Sha1Digest calculates the sha1 digest for the io.Reader
func Sha1Digest(r io.Reader) string {
	h := sha1.New()
	io.Copy(h, r)
	return hex.EncodeToString(h.Sum(nil))
}

func (t *Table) url(digest string) string {
	return fmt.Sprintf("%s/_blobs/%s/%s", t.drv.url, t.Name, digest)
}

// Upload upload the blob(r) with sha1 hash(digest)
func (t *Table) Upload(digest string, r io.Reader) (*Record, error) {
	req, err := t.newRequest("PUT", digest, r)
	if err != nil {
		return nil, err
	}
	resp, err := t.c.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 201 {
		return nil, fmt.Errorf("Upload failed: %s", resp.Status)
	}
	return &Record{
		Digest: digest,
	}, nil
}

// UploadEx upload a io.ReadSeeker, and computes the sha1 hash automatically
func (t *Table) UploadEx(r io.ReadSeeker) (*Record, error) {
	digest := Sha1Digest(r)
	_, err := r.Seek(0, 0)
	if err != nil {
		return nil, err
	}
	req, err := t.newRequest("PUT", digest, r)
	if err != nil {
		return nil, err
	}
	resp, err := t.c.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 201 {
		return nil, fmt.Errorf("Upload failed: %s", resp.Status)
	}
	return &Record{
		Digest: digest,
	}, nil
}

// List all blobs inside a blob table
func (t *Table) List() (*sql.Rows, error) {
	query := fmt.Sprintf("select digest, last_modified from blob.%s", t.Name)
	rows, err := t.drv.db.Query(query)
	if err != nil {
		return nil, err
	}
	return rows, err
}

// Is the blob specified by the digest exist in the table
func (t *Table) Has(digest string) (bool, error) {
	req, err := t.newRequest("HEAD", digest, nil)
	if err != nil {
		return false, err
	}
	resp, err := t.c.Do(req)
	if err != nil {
		return false, err
	}
	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	return false, nil
}

// Download a blob in a blob table with the specific digest
func (t *Table) Download(digest string) (io.ReadCloser, error) {
	req, err := t.newRequest("GET", digest, nil)
	if err != nil {
		return nil, err
	}
	resp, err := t.c.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return resp.Body, &DownloadError{resp.Status, resp.StatusCode, "problem downloading blob"}
	}
	return resp.Body, nil
}

// Delete a blob in a blob table with the specific digest
func (t *Table) Delete(digest string) error {
	req, err := t.newRequest("DELETE", digest, nil)
	if err != nil {
		return err
	}
	resp, err := t.c.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusNoContent {
		return nil
	}
	return fmt.Errorf("%s", resp.Status)
}

// Drop the blob table
func (t *Table) Drop() error {
	sql := fmt.Sprintf("drop blob table \"%s\"", t.Name)
	_, err := t.drv.db.Exec(sql)
	return err
}

func (t *Table) newRequest(method, digest string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, t.url(digest), body)
	if err != nil {
		return nil ,err
	}
	// in some cases where trying to upload or download a blob resulted in non 2xx response,
	// it seems Crate was not closing the connection (ticket to be opened soon against Crate)
	// which resulted in strange behavior when requests were made after getting an error.
	//
	// For example, if downloading a blob result in a 404, attempting to download another
	// blob would also result ina  404 even if that second blob absolutely was there.
	req.Header.Set("Connection", "close")
	return req, nil
}
