package s3util

import (
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// File represents an S3 object or directory.
type File struct {
	url    string
	prefix string
	config *Config
	result *listObjectsResult
}

type fileInfo struct {
	name    string
	size    int64
	dir     bool
	modTime time.Time
	sys     *Stat
}

// Stat contains information about an S3 object or directory.
// It is the "underlying data source" returned by method Sys
// for each FileInfo produced by this package.
//   fi.Sys().(*s3util.Stat)
// For the meaning of these fields, see
// http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html.
type Stat struct {
	Key          string
	LastModified string
	ETag         string // ETag value, without double quotes.
	Size         string
	StorageClass string
	OwnerID      string `xml:"Owner>ID"`
	OwnerName    string `xml:"Owner>DisplayName"`
}

type listObjectsResult struct {
	IsTruncated bool
	Contents    []Stat
	Directories []string `xml:"CommonPrefixes>Prefix"` // Suffix "/" trimmed
}

func (f *fileInfo) Name() string { return f.name }
func (f *fileInfo) Size() int64  { return f.size }
func (f *fileInfo) Mode() os.FileMode {
	if f.dir {
		return 0755 | os.ModeDir
	}
	return 0644
}
func (f *fileInfo) ModTime() time.Time {
	if f.modTime.IsZero() && f.sys != nil {
		// we return the zero value if a parse error ever happens.
		f.modTime, _ = time.Parse(time.RFC3339Nano, f.sys.LastModified)
	}
	return f.modTime
}
func (f *fileInfo) IsDir() bool      { return f.dir }
func (f *fileInfo) Sys() interface{} { return f.sys }

// NewFile returns a new File with the given URL and config.
//
// Set rawurl to a directory on S3, such as
// https://mybucket.s3.amazonaws.com/myfolder.
// The URL cannot have query parameters or a fragment.
// If c is nil, DefaultConfig will be used.
func NewFile(rawurl string, c *Config) (*File, error) {
	u, err := url.Parse(rawurl)
	if err != nil {
		return nil, err
	}
	if u.RawQuery != "" {
		return nil, errors.New("url cannot have raw query parameters.")
	}
	if u.Fragment != "" {
		return nil, errors.New("url cannot have a fragment.")
	}

	prefix := strings.TrimLeft(u.Path, "/")
	if prefix != "" && !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}
	u.Path = ""
	return &File{u.String(), prefix, c, nil}, nil
}

// Readdir requests a list of entries in the S3 directory
// represented by f and returns a slice of up to n FileInfo
// values, in alphabetical order. Subsequent calls
// on the same File will yield further FileInfos.
// Only direct children are returned, not deeper descendants.
func (f *File) Readdir(n int) ([]os.FileInfo, error) {
	if f.result != nil && !f.result.IsTruncated {
		return make([]os.FileInfo, 0), io.EOF
	}

	reader, err := f.sendRequest(n)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	return f.parseResponse(reader)
}

func (f *File) sendRequest(count int) (io.ReadCloser, error) {
	c := f.config
	if c == nil {
		c = DefaultConfig
	}
	var buf bytes.Buffer
	buf.WriteString(f.url)
	buf.WriteString("?delimiter=%2F")
	if f.prefix != "" {
		buf.WriteString("&prefix=")
		buf.WriteString(url.QueryEscape(f.prefix))
	}
	if count > 0 {
		buf.WriteString("&max-keys=")
		buf.WriteString(strconv.Itoa(count))
	}
	if f.result != nil && f.result.IsTruncated {
		var lastDir, lastKey, marker string
		if len(f.result.Directories) > 0 {
			lastDir = f.result.Directories[len(f.result.Directories)-1]
		}
		if len(f.result.Contents) > 0 {
			lastKey = f.result.Contents[len(f.result.Contents)-1].Key
		}

		if lastKey > lastDir {
			marker = lastKey
		} else {
			marker = lastDir
		}

		if marker != "" {
			buf.WriteString("&marker=")
			buf.WriteString(url.QueryEscape(marker))
		}
	}
	u := buf.String()
	r, _ := http.NewRequest("GET", u, nil)
	r.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	c.Sign(r, *c.Keys)
	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, newRespError(resp)
	}
	return resp.Body, nil
}

func (f *File) parseResponse(reader io.Reader) ([]os.FileInfo, error) {
	decoder := xml.NewDecoder(reader)
	result := listObjectsResult{}
	var err error
	err = decoder.Decode(&result)
	if err != nil {
		return nil, err
	}

	infos := make([]os.FileInfo, len(result.Contents)+len(result.Directories))
	var size int64
	var name string
	var is_dir bool
	for i, content := range result.Contents {
		c := content
		c.ETag = strings.Trim(c.ETag, `"`)
		size, _ = strconv.ParseInt(c.Size, 10, 0)
		if size == 0 && strings.HasSuffix(c.Key, "/") {
			name = strings.TrimRight(c.Key, "/")
			is_dir = true
		} else {
			name = c.Key
			is_dir = false
		}
		infos[i] = &fileInfo{
			name: name,
			size: size,
			dir:  is_dir,
			sys:  &c,
		}
	}
	for i, dir := range result.Directories {
		infos[len(result.Contents)+i] = &fileInfo{
			name: strings.TrimRight(dir, "/"),
			size: 0,
			dir:  true,
		}
	}
	f.result = &result

	return infos, nil
}
