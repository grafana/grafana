// Copyright 2018 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package fileblob provides a blob implementation that uses the filesystem.
// Use OpenBucket to construct a *blob.Bucket.
//
// To avoid partial writes, fileblob writes to a temporary file and then renames
// the temporary file to the final path on Close. By default, it creates these
// temporary files in `os.TempDir`. If `os.TempDir` is on a different mount than
// your base bucket path, the `os.Rename` will fail with `invalid cross-device link`.
// To avoid this, either configure the temp dir to use by setting the environment
// variable `TMPDIR`, or set `Options.NoTempDir` to `true` (fileblob will create
// the temporary files next to the actual files instead of in a temporary directory).
//
// By default fileblob stores blob metadata in "sidecar" files under the original
// filename with an additional ".attrs" suffix.
// This behaviour can be changed via `Options.Metadata`;
// writing of those metadata files can be suppressed by setting it to
// `MetadataDontWrite` or its equivalent "metadata=skip" in the URL for the opener.
// In either case, absent any stored metadata many `blob.Attributes` fields
// will be set to default values.
//
// # URLs
//
// For blob.OpenBucket, fileblob registers for the scheme "file".
// To customize the URL opener, or for more details on the URL format,
// see URLOpener.
// See https://gocloud.dev/concepts/urls/ for background information.
//
// # Escaping
//
// Go CDK supports all UTF-8 strings; to make this work with services lacking
// full UTF-8 support, strings must be escaped (during writes) and unescaped
// (during reads). The following escapes are performed for fileblob:
//   - Blob keys: ASCII characters 0-31 are escaped to "__0x<hex>__".
//     If os.PathSeparator != "/", it is also escaped.
//     Additionally, the "/" in "../", the trailing "/" in "//", and a trailing
//     "/" is key names are escaped in the same way.
//     On Windows, the characters "<>:"|?*" are also escaped.
//
// # As
//
// fileblob exposes the following types for As:
//   - Bucket: os.FileInfo
//   - Error: *os.PathError
//   - ListObject: os.FileInfo
//   - Reader: io.Reader
//   - ReaderOptions.BeforeRead: *os.File
//   - Attributes: os.FileInfo
//   - CopyOptions.BeforeCopy: *os.File
//   - WriterOptions.BeforeWrite: *os.File
package fileblob // import "gocloud.dev/blob/fileblob"

import (
	"context"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"hash"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"gocloud.dev/blob"
	"gocloud.dev/blob/driver"
	"gocloud.dev/gcerrors"
	"gocloud.dev/internal/escape"
	"gocloud.dev/internal/gcerr"
)

const defaultPageSize = 1000

func init() {
	blob.DefaultURLMux().RegisterBucket(Scheme, &URLOpener{})
}

// Scheme is the URL scheme fileblob registers its URLOpener under on
// blob.DefaultMux.
const Scheme = "file"

// URLOpener opens file bucket URLs like "file:///foo/bar/baz".
//
// The URL's host is ignored unless it is ".", which is used to signal a
// relative path. For example, "file://./../.." uses "../.." as the path.
//
// If os.PathSeparator != "/", any leading "/" from the path is dropped
// and remaining '/' characters are converted to os.PathSeparator.
//
// The following query parameters are supported:
//
//   - create_dir: (any non-empty value) the directory is created (using os.MkDirAll)
//     if it does not already exist.
//   - dir_file_mode: any directories that are created (the base directory when create_dir
//     is true, or subdirectories for keys) are created using this os.FileMode, parsed
//     using os.Parseuint. Defaults to 0777.
//   - no_tmp_dir: (any non-empty value) temporary files are created next to the final
//     path instead of in os.TempDir.
//   - base_url: the base URL to use to construct signed URLs; see URLSignerHMAC
//   - secret_key_path: path to read for the secret key used to construct signed URLs;
//     see URLSignerHMAC
//   - metadata: if set to "skip", won't write metadata such as blob.Attributes
//     as per the package docstring
//
// If either of base_url / secret_key_path are provided, both must be.
//
//   - file:///a/directory
//     -> Passes "/a/directory" to OpenBucket.
//   - file://localhost/a/directory
//     -> Also passes "/a/directory".
//   - file://./../..
//     -> The hostname is ".", signaling a relative path; passes "../..".
//   - file:///c:/foo/bar on Windows.
//     -> Passes "c:\foo\bar".
//   - file://localhost/c:/foo/bar on Windows.
//     -> Also passes "c:\foo\bar".
//   - file:///a/directory?base_url=/show&secret_key_path=secret.key
//     -> Passes "/a/directory" to OpenBucket, and sets Options.URLSigner
//     to a URLSignerHMAC initialized with base URL "/show" and secret key
//     bytes read from the file "secret.key".
type URLOpener struct {
	// Options specifies the default options to pass to OpenBucket.
	Options Options
}

// OpenBucketURL opens a blob.Bucket based on u.
func (o *URLOpener) OpenBucketURL(ctx context.Context, u *url.URL) (*blob.Bucket, error) {
	path := u.Path
	// Hostname == "." means a relative path, so drop the leading "/".
	// Also drop the leading "/" on Windows.
	if u.Host == "." || os.PathSeparator != '/' {
		path = strings.TrimPrefix(path, "/")
	}
	opts, err := o.forParams(ctx, u.Query())
	if err != nil {
		return nil, fmt.Errorf("open bucket %v: %v", u, err)
	}
	return OpenBucket(filepath.FromSlash(path), opts)
}

var recognizedParams = map[string]bool{
	"create_dir":      true,
	"base_url":        true,
	"secret_key_path": true,
	"metadata":        true,
	"no_tmp_dir":      true,
	"dir_file_mode":   true,
}

type metadataOption string // Not exported as subject to change.

// Settings for Options.Metadata.
const (
	// Metadata gets written to a separate file.
	MetadataInSidecar metadataOption = ""
	// Writes won't carry metadata, as per the package docstring.
	MetadataDontWrite metadataOption = "skip"
)

func (o *URLOpener) forParams(ctx context.Context, q url.Values) (*Options, error) {
	for k := range q {
		if _, ok := recognizedParams[k]; !ok {
			return nil, fmt.Errorf("invalid query parameter %q", k)
		}
	}
	opts := new(Options)
	*opts = o.Options

	// Note: can't just use q.Get, because then we can't distinguish between
	// "not set" (we should leave opts alone) vs "set to empty string" (which is
	// one of the legal values, we should override opts).
	metadataVal := q["metadata"]
	if len(metadataVal) > 0 {
		switch metadataOption(metadataVal[0]) {
		case MetadataDontWrite:
			opts.Metadata = MetadataDontWrite
		case MetadataInSidecar:
			opts.Metadata = MetadataInSidecar
		default:
			return nil, errors.New("fileblob.OpenBucket: unsupported value for query parameter 'metadata'")
		}
	}
	if q.Get("create_dir") != "" {
		opts.CreateDir = true
	}
	if fms := q.Get("dir_file_mode"); fms != "" {
		fm, err := strconv.ParseUint(fms, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("fileblob.OpenBucket: invalid dir_file_mode %q: %v", fms, err)
		}
		opts.DirFileMode = os.FileMode(fm)
	}
	if q.Get("no_tmp_dir") != "" {
		opts.NoTempDir = true
	}
	baseURL := q.Get("base_url")
	keyPath := q.Get("secret_key_path")
	if (baseURL == "") != (keyPath == "") {
		return nil, errors.New("fileblob.OpenBucket: must supply both base_url and secret_key_path query parameters")
	}
	if baseURL != "" {
		burl, err := url.Parse(baseURL)
		if err != nil {
			return nil, err
		}
		sk, err := os.ReadFile(keyPath)
		if err != nil {
			return nil, err
		}
		opts.URLSigner = NewURLSignerHMAC(burl, sk)
	}
	return opts, nil
}

// Options sets options for constructing a *blob.Bucket backed by fileblob.
type Options struct {
	// URLSigner implements signing URLs (to allow access to a resource without
	// further authorization) and verifying that a given URL is unexpired and
	// contains a signature produced by the URLSigner.
	// URLSigner is only required for utilizing the SignedURL API.
	URLSigner URLSigner

	// If true, create the directory backing the Bucket if it does not exist
	// (using os.MkdirAll).
	CreateDir bool

	// The FileMode to use when creating directories for the top-level directory
	// backing the bucket (when CreateDir is true), and for subdirectories for keys.
	// Defaults to 0777.
	DirFileMode os.FileMode

	// If true, don't use os.TempDir for temporary files, but instead place them
	// next to the actual files. This may result in "stranded" temporary files
	// (e.g., if the application is killed before the file cleanup runs).
	//
	// If your bucket directory is on a different mount than os.TempDir, you will
	// need to set this to true, as os.Rename will fail across mount points.
	NoTempDir bool

	// Refers to the strategy for how to deal with metadata (such as blob.Attributes).
	// For supported values please see the Metadata* constants.
	// If left unchanged, 'MetadataInSidecar' will be used.
	Metadata metadataOption
}

type bucket struct {
	dir  string
	opts *Options
}

// openBucket creates a driver.Bucket that reads and writes to dir.
// dir must exist.
func openBucket(dir string, opts *Options) (driver.Bucket, error) {
	if opts == nil {
		opts = &Options{}
	}
	if opts.DirFileMode == 0 {
		opts.DirFileMode = os.FileMode(0o777)
	}

	absdir, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to convert %s into an absolute path: %v", dir, err)
	}
	info, err := os.Stat(absdir)

	// Optionally, create the directory if it does not already exist.
	if err != nil && opts.CreateDir && os.IsNotExist(err) {
		err = os.MkdirAll(absdir, opts.DirFileMode)
		if err != nil {
			return nil, fmt.Errorf("tried to create directory but failed: %v", err)
		}
		info, err = os.Stat(absdir)
	}
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", absdir)
	}
	return &bucket{dir: absdir, opts: opts}, nil
}

// OpenBucket creates a *blob.Bucket backed by the filesystem and rooted at
// dir, which must exist. See the package documentation for an example.
func OpenBucket(dir string, opts *Options) (*blob.Bucket, error) {
	drv, err := openBucket(dir, opts)
	if err != nil {
		return nil, err
	}
	return blob.NewBucket(drv), nil
}

func (b *bucket) Close() error {
	return nil
}

// escapeKey does all required escaping for UTF-8 strings to work the filesystem.
func escapeKey(s string) string {
	s = escape.HexEscape(s, func(r []rune, i int) bool {
		c := r[i]
		switch {
		case c < 32:
			return true
		// We're going to replace '/' with os.PathSeparator below. In order for this
		// to be reversible, we need to escape raw os.PathSeparators.
		case os.PathSeparator != '/' && c == os.PathSeparator:
			return true
		// For "../", escape the trailing slash.
		case i > 1 && c == '/' && r[i-1] == '.' && r[i-2] == '.':
			return true
		// For "//", escape the trailing slash.
		case i > 0 && c == '/' && r[i-1] == '/':
			return true
		// Escape the trailing slash in a key.
		case c == '/' && i == len(r)-1:
			return true
		// https://docs.microsoft.com/en-us/windows/desktop/fileio/naming-a-file
		case os.PathSeparator == '\\' && (c == '>' || c == '<' || c == ':' || c == '"' || c == '|' || c == '?' || c == '*'):
			return true
		}
		return false
	})
	// Replace "/" with os.PathSeparator if needed, so that the local filesystem
	// can use subdirectories.
	if os.PathSeparator != '/' {
		s = strings.Replace(s, "/", string(os.PathSeparator), -1)
	}
	return s
}

// unescapeKey reverses escapeKey.
func unescapeKey(s string) string {
	if os.PathSeparator != '/' {
		s = strings.Replace(s, string(os.PathSeparator), "/", -1)
	}
	s = escape.HexUnescape(s)
	return s
}

func (b *bucket) ErrorCode(err error) gcerrors.ErrorCode {
	switch {
	case os.IsNotExist(err):
		return gcerrors.NotFound
	default:
		return gcerrors.Unknown
	}
}

// path returns the full path for a key
func (b *bucket) path(key string) (string, error) {
	path := filepath.Join(b.dir, escapeKey(key))
	if strings.HasSuffix(path, attrsExt) {
		return "", errAttrsExt
	}
	return path, nil
}

// forKey returns the full path, os.FileInfo, and attributes for key.
func (b *bucket) forKey(key string) (string, os.FileInfo, *xattrs, error) {
	path, err := b.path(key)
	if err != nil {
		return "", nil, nil, err
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", nil, nil, err
	}
	if info.IsDir() {
		return "", nil, nil, os.ErrNotExist
	}
	xa, err := getAttrs(path)
	if err != nil {
		return "", nil, nil, err
	}
	return path, info, &xa, nil
}

// ListPaged implements driver.ListPaged.
func (b *bucket) ListPaged(ctx context.Context, opts *driver.ListOptions) (*driver.ListPage, error) {
	var pageToken string
	if len(opts.PageToken) > 0 {
		pageToken = string(opts.PageToken)
	}
	pageSize := opts.PageSize
	if pageSize == 0 {
		pageSize = defaultPageSize
	}
	// If opts.Delimiter != "", lastPrefix contains the last "directory" key we
	// added. It is used to avoid adding it again; all files in this "directory"
	// are collapsed to the single directory entry.
	var lastPrefix string
	var lastKeyAdded string

	// If the Prefix contains a "/", we can set the root of the Walk
	// to the path specified by the Prefix as any files below the path will not
	// match the Prefix.
	// Note that we use "/" explicitly and not os.PathSeparator, as the opts.Prefix
	// is in the unescaped form.
	root := b.dir
	if i := strings.LastIndex(opts.Prefix, "/"); i > -1 {
		root = filepath.Join(root, opts.Prefix[:i])
	}

	// Do a full recursive scan of the root directory.
	var result driver.ListPage
	err := filepath.WalkDir(root, func(path string, info fs.DirEntry, err error) error {
		if err != nil {
			// Couldn't read this file/directory for some reason; just skip it.
			return nil
		}
		// Skip the self-generated attribute files.
		if strings.HasSuffix(path, attrsExt) {
			return nil
		}
		// os.Walk returns the root directory; skip it.
		if path == b.dir {
			return nil
		}
		// Strip the <b.dir> prefix from path.
		prefixLen := len(b.dir)
		// Include the separator for non-root.
		if b.dir != "/" {
			prefixLen++
		}
		path = path[prefixLen:]
		// Unescape the path to get the key.
		key := unescapeKey(path)
		// Skip all directories. If opts.Delimiter is set, we'll create
		// pseudo-directories later.
		// Note that returning nil means that we'll still recurse into it;
		// we're just not adding a result for the directory itself.
		if info.IsDir() {
			key += "/"
			// Avoid recursing into subdirectories if the directory name already
			// doesn't match the prefix; any files in it are guaranteed not to match.
			if len(key) > len(opts.Prefix) && !strings.HasPrefix(key, opts.Prefix) {
				return filepath.SkipDir
			}
			// Similarly, avoid recursing into subdirectories if we're making
			// "directories" and all of the files in this subdirectory are guaranteed
			// to collapse to a "directory" that we've already added.
			if lastPrefix != "" && strings.HasPrefix(key, lastPrefix) {
				return filepath.SkipDir
			}
			return nil
		}
		// Skip files/directories that don't match the Prefix.
		if !strings.HasPrefix(key, opts.Prefix) {
			return nil
		}
		var md5 []byte
		if xa, err := getAttrs(path); err == nil {
			// Note: we only have the MD5 hash for blobs that we wrote.
			// For other blobs, md5 will remain nil.
			md5 = xa.MD5
		}
		fi, err := info.Info()
		if err != nil {
			return err
		}
		asFunc := func(i any) bool {
			p, ok := i.(*os.FileInfo)
			if !ok {
				return false
			}
			*p = fi
			return true
		}
		obj := &driver.ListObject{
			Key:     key,
			ModTime: fi.ModTime(),
			Size:    fi.Size(),
			MD5:     md5,
			AsFunc:  asFunc,
		}
		// If using Delimiter, collapse "directories".
		if opts.Delimiter != "" {
			// Strip the prefix, which may contain Delimiter.
			keyWithoutPrefix := key[len(opts.Prefix):]
			// See if the key still contains Delimiter.
			// If no, it's a file and we just include it.
			// If yes, it's a file in a "sub-directory" and we want to collapse
			// all files in that "sub-directory" into a single "directory" result.
			if idx := strings.Index(keyWithoutPrefix, opts.Delimiter); idx != -1 {
				prefix := opts.Prefix + keyWithoutPrefix[0:idx+len(opts.Delimiter)]
				// We've already included this "directory"; don't add it.
				if prefix == lastPrefix {
					return nil
				}
				// Update the object to be a "directory".
				obj = &driver.ListObject{
					Key:    prefix,
					IsDir:  true,
					AsFunc: asFunc,
				}
				lastPrefix = prefix
			}
		}
		// If there's a pageToken, skip anything before it.
		if pageToken != "" && obj.Key <= pageToken {
			return nil
		}
		// If we've already got a full page of results, set NextPageToken and stop.
		// Unless the current object is a directory, in which case there may
		// still be objects coming that are alphabetically before it (since
		// we appended the delimiter). In that case, keep going; we'll trim the
		// extra entries (if any) before returning.
		if len(result.Objects) == pageSize && !obj.IsDir {
			result.NextPageToken = []byte(result.Objects[pageSize-1].Key)
			return io.EOF
		}
		result.Objects = append(result.Objects, obj)
		// Normally, objects are added in the correct order (by Key).
		// However, sometimes adding the file delimiter messes that up (e.g.,
		// if the file delimiter is later in the alphabet than the last character
		// of a key).
		// Detect if this happens and swap if needed.
		if len(result.Objects) > 1 && obj.Key < lastKeyAdded {
			i := len(result.Objects) - 1
			result.Objects[i-1], result.Objects[i] = result.Objects[i], result.Objects[i-1]
			lastKeyAdded = result.Objects[i].Key
		} else {
			lastKeyAdded = obj.Key
		}
		return nil
	})
	if err != nil && err != io.EOF {
		return nil, err
	}
	if len(result.Objects) > pageSize {
		result.Objects = result.Objects[0:pageSize]
		result.NextPageToken = []byte(result.Objects[pageSize-1].Key)
	}
	return &result, nil
}

// As implements driver.As.
func (b *bucket) As(i any) bool {
	p, ok := i.(*os.FileInfo)
	if !ok {
		return false
	}
	fi, err := os.Stat(b.dir)
	if err != nil {
		return false
	}
	*p = fi
	return true
}

// As implements driver.ErrorAs.
func (b *bucket) ErrorAs(err error, i any) bool {
	if perr, ok := err.(*os.PathError); ok {
		if p, ok := i.(**os.PathError); ok {
			*p = perr
			return true
		}
	}
	return false
}

// Attributes implements driver.Attributes.
func (b *bucket) Attributes(ctx context.Context, key string) (*driver.Attributes, error) {
	_, info, xa, err := b.forKey(key)
	if err != nil {
		return nil, err
	}
	return &driver.Attributes{
		CacheControl:       xa.CacheControl,
		ContentDisposition: xa.ContentDisposition,
		ContentEncoding:    xa.ContentEncoding,
		ContentLanguage:    xa.ContentLanguage,
		ContentType:        xa.ContentType,
		Metadata:           xa.Metadata,
		// CreateTime left as the zero time.
		ModTime: info.ModTime(),
		Size:    info.Size(),
		MD5:     xa.MD5,
		ETag:    fmt.Sprintf("\"%x-%x\"", info.ModTime().UnixNano(), info.Size()),
		AsFunc: func(i any) bool {
			p, ok := i.(*os.FileInfo)
			if !ok {
				return false
			}
			*p = info
			return true
		},
	}, nil
}

// NewRangeReader implements driver.NewRangeReader.
func (b *bucket) NewRangeReader(ctx context.Context, key string, offset, length int64, opts *driver.ReaderOptions) (driver.Reader, error) {
	path, info, xa, err := b.forKey(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	if opts.BeforeRead != nil {
		if err := opts.BeforeRead(func(i any) bool {
			p, ok := i.(**os.File)
			if !ok {
				return false
			}
			*p = f
			return true
		}); err != nil {
			return nil, err
		}
	}
	if offset > 0 {
		if _, err := f.Seek(offset, io.SeekStart); err != nil {
			return nil, err
		}
	}
	r := io.Reader(f)
	if length >= 0 {
		r = io.LimitReader(r, length)
	}
	return &reader{
		r: r,
		c: f,
		attrs: driver.ReaderAttributes{
			ContentType: xa.ContentType,
			ModTime:     info.ModTime(),
			Size:        info.Size(),
		},
	}, nil
}

type reader struct {
	r     io.Reader
	c     io.Closer
	attrs driver.ReaderAttributes
}

func (r *reader) Read(p []byte) (int, error) {
	if r.r == nil {
		return 0, io.EOF
	}
	return r.r.Read(p)
}

func (r *reader) Close() error {
	if r.c == nil {
		return nil
	}
	return r.c.Close()
}

func (r *reader) Attributes() *driver.ReaderAttributes {
	return &r.attrs
}

func (r *reader) As(i any) bool {
	p, ok := i.(*io.Reader)
	if !ok {
		return false
	}
	*p = r.r
	return true
}

func createTemp(path string, noTempDir bool) (*os.File, error) {
	// Use a custom createTemp function rather than os.CreateTemp() as
	// os.CreateTemp() sets the permissions of the tempfile to 0600, rather than
	// 0666, making it inconsistent with the directories and attribute files.
	try := 0
	for {
		// Append the current time with nanosecond precision and .tmp to the
		// base path. If the file already exists try again. Nanosecond changes enough
		// between each iteration to make a conflict unlikely. Using the full
		// time lowers the chance of a collision with a file using a similar
		// pattern, but has undefined behavior after the year 2262.
		var name string
		if noTempDir {
			name = path
		} else {
			name = filepath.Join(os.TempDir(), filepath.Base(path))
		}
		name += "." + strconv.FormatInt(time.Now().UnixNano(), 16) + ".tmp"
		f, err := os.OpenFile(name, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o666)
		if os.IsExist(err) {
			if try++; try < 10000 {
				continue
			}
			return nil, &os.PathError{Op: "createtemp", Path: path + ".*.tmp", Err: os.ErrExist}
		}
		return f, err
	}
}

// NewTypedWriter implements driver.NewTypedWriter.
func (b *bucket) NewTypedWriter(ctx context.Context, key, contentType string, opts *driver.WriterOptions) (driver.Writer, error) {
	path, err := b.path(key)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), b.opts.DirFileMode); err != nil {
		return nil, err
	}
	f, err := createTemp(path, b.opts.NoTempDir)
	if err != nil {
		return nil, err
	}
	if opts.BeforeWrite != nil {
		if err := opts.BeforeWrite(func(i any) bool {
			p, ok := i.(**os.File)
			if !ok {
				return false
			}
			*p = f
			return true
		}); err != nil {
			return nil, err
		}
	}

	if b.opts.Metadata == MetadataDontWrite {
		w := &writer{
			ctx:        ctx,
			File:       f,
			path:       path,
			ifNotExist: opts.IfNotExist,
			mu:         &sync.Mutex{},
		}
		return w, nil
	}

	var metadata map[string]string
	if len(opts.Metadata) > 0 {
		metadata = opts.Metadata
	}
	attrs := xattrs{
		CacheControl:       opts.CacheControl,
		ContentDisposition: opts.ContentDisposition,
		ContentEncoding:    opts.ContentEncoding,
		ContentLanguage:    opts.ContentLanguage,
		ContentType:        contentType,
		Metadata:           metadata,
	}
	w := &writerWithSidecar{
		ctx:        ctx,
		f:          f,
		path:       path,
		attrs:      attrs,
		contentMD5: opts.ContentMD5,
		md5hash:    md5.New(),
		ifNotExist: opts.IfNotExist,
		mu:         &sync.Mutex{},
	}
	return w, nil
}

// writerWithSidecar implements the strategy of storing metadata in a distinct file.
type writerWithSidecar struct {
	ctx        context.Context
	f          *os.File
	path       string
	attrs      xattrs
	contentMD5 []byte
	// We compute the MD5 hash so that we can store it with the file attributes,
	// not for verification.
	md5hash    hash.Hash
	ifNotExist bool
	mu         *sync.Mutex
}

func (w *writerWithSidecar) Write(p []byte) (n int, err error) {
	n, err = w.f.Write(p)
	if err != nil {
		// Don't hash the unwritten tail twice when writing is resumed.
		w.md5hash.Write(p[:n])
		return n, err
	}
	if _, err := w.md5hash.Write(p); err != nil {
		return n, err
	}
	return n, nil
}

func (w *writerWithSidecar) Close() error {
	err := w.f.Close()
	if err != nil {
		return err
	}
	// Always delete the temp file. On success, it will have been renamed so
	// the Remove will fail.
	defer func() {
		_ = os.Remove(w.f.Name())
	}()

	// Check if the write was cancelled.
	if err := w.ctx.Err(); err != nil {
		return err
	}

	md5sum := w.md5hash.Sum(nil)
	w.attrs.MD5 = md5sum

	// Write the attributes file.
	if err := setAttrs(w.path, w.attrs); err != nil {
		return err
	}

	if w.ifNotExist {
		w.mu.Lock()
		defer w.mu.Unlock()
		_, err = os.Stat(w.path)
		if err == nil {
			return gcerr.New(gcerrors.FailedPrecondition, err, 1, "File already exist")
		}
	}
	// Rename the temp file to path.
	if err := os.Rename(w.f.Name(), w.path); err != nil {
		_ = os.Remove(w.path + attrsExt)
		return err
	}
	return nil
}

// writer is a file with a temporary name until closed.
//
// Embedding os.File allows the likes of io.Copy to use optimizations.,
// which is why it is not folded into writerWithSidecar.
type writer struct {
	*os.File
	ctx        context.Context
	path       string
	ifNotExist bool
	mu         *sync.Mutex
}

func (w *writer) Upload(r io.Reader) error {
	_, err := w.ReadFrom(r)
	return err
}

func (w *writer) Close() error {
	err := w.File.Close()
	if err != nil {
		return err
	}
	// Always delete the temp file. On success, it will have been renamed so
	// the Remove will fail.
	tempname := w.File.Name()
	defer os.Remove(tempname)

	// Check if the write was cancelled.
	if err := w.ctx.Err(); err != nil {
		return err
	}

	if w.ifNotExist {
		w.mu.Lock()
		defer w.mu.Unlock()
		_, err = os.Stat(w.path)
		if err == nil {
			return gcerr.New(gcerrors.FailedPrecondition, err, 1, "File already exist")
		}
	}

	// Rename the temp file to path.
	if err := os.Rename(tempname, w.path); err != nil {
		return err
	}
	return nil
}

// Copy implements driver.Copy.
func (b *bucket) Copy(ctx context.Context, dstKey, srcKey string, opts *driver.CopyOptions) error {
	// Note: we could use NewRangeReader here, but since we need to copy all of
	// the metadata (from xa), it's more efficient to do it directly.
	srcPath, _, xa, err := b.forKey(srcKey)
	if err != nil {
		return err
	}
	f, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer f.Close()

	// We'll write the copy using Writer, to avoid re-implementing making of a
	// temp file, cleaning up after partial failures, etc.
	wopts := driver.WriterOptions{
		CacheControl:       xa.CacheControl,
		ContentDisposition: xa.ContentDisposition,
		ContentEncoding:    xa.ContentEncoding,
		ContentLanguage:    xa.ContentLanguage,
		Metadata:           xa.Metadata,
		BeforeWrite:        opts.BeforeCopy,
	}
	// Create a cancelable context so we can cancel the write if there are
	// problems.
	writeCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	w, err := b.NewTypedWriter(writeCtx, dstKey, xa.ContentType, &wopts)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, f)
	if err != nil {
		cancel() // cancel before Close cancels the write
		w.Close()
		return err
	}
	return w.Close()
}

// Delete implements driver.Delete.
func (b *bucket) Delete(ctx context.Context, key string) error {
	path, err := b.path(key)
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if err != nil {
		return err
	}
	if err = os.Remove(path + attrsExt); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// SignedURL implements driver.SignedURL
func (b *bucket) SignedURL(ctx context.Context, key string, opts *driver.SignedURLOptions) (string, error) {
	if b.opts.URLSigner == nil {
		return "", gcerr.New(gcerr.Unimplemented, nil, 1, "fileblob.SignedURL: bucket does not have an Options.URLSigner")
	}
	if opts.BeforeSign != nil {
		if err := opts.BeforeSign(func(any) bool { return false }); err != nil {
			return "", err
		}
	}
	surl, err := b.opts.URLSigner.URLFromKey(ctx, key, opts)
	if err != nil {
		return "", err
	}
	return surl.String(), nil
}

// URLSigner defines an interface for creating and verifying a signed URL for
// objects in a fileblob bucket. Signed URLs are typically used for granting
// access to an otherwise-protected resource without requiring further
// authentication, and callers should take care to restrict the creation of
// signed URLs as is appropriate for their application.
type URLSigner interface {
	// URLFromKey defines how the bucket's object key will be turned
	// into a signed URL. URLFromKey must be safe to call from multiple goroutines.
	URLFromKey(ctx context.Context, key string, opts *driver.SignedURLOptions) (*url.URL, error)

	// KeyFromURL must be able to validate a URL returned from URLFromKey.
	// KeyFromURL must only return the object if if the URL is
	// both unexpired and authentic. KeyFromURL must be safe to call from
	// multiple goroutines. Implementations of KeyFromURL should not modify
	// the URL argument.
	KeyFromURL(ctx context.Context, surl *url.URL) (string, error)
}

// URLSignerHMAC signs URLs by adding the object key, expiration time, and a
// hash-based message authentication code (HMAC) into the query parameters.
// Values of URLSignerHMAC with the same secret key will accept URLs produced by
// others as valid.
type URLSignerHMAC struct {
	baseURL   *url.URL
	secretKey []byte
}

// NewURLSignerHMAC creates a URLSignerHMAC. If the secret key is empty,
// then NewURLSignerHMAC panics.
func NewURLSignerHMAC(baseURL *url.URL, secretKey []byte) *URLSignerHMAC {
	if len(secretKey) == 0 {
		panic("creating URLSignerHMAC: secretKey is required")
	}
	uc := new(url.URL)
	*uc = *baseURL
	return &URLSignerHMAC{
		baseURL:   uc,
		secretKey: secretKey,
	}
}

// URLFromKey creates a signed URL by copying the baseURL and appending the
// object key, expiry, and signature as a query params.
func (h *URLSignerHMAC) URLFromKey(ctx context.Context, key string, opts *driver.SignedURLOptions) (*url.URL, error) {
	sURL := new(url.URL)
	*sURL = *h.baseURL

	q := sURL.Query()
	q.Set("obj", key)
	q.Set("expiry", strconv.FormatInt(time.Now().Add(opts.Expiry).Unix(), 10))
	q.Set("method", opts.Method)
	if opts.ContentType != "" {
		q.Set("contentType", opts.ContentType)
	}
	q.Set("signature", h.getMAC(q))
	sURL.RawQuery = q.Encode()

	return sURL, nil
}

func (h *URLSignerHMAC) getMAC(q url.Values) string {
	signedVals := url.Values{}
	signedVals.Set("obj", q.Get("obj"))
	signedVals.Set("expiry", q.Get("expiry"))
	signedVals.Set("method", q.Get("method"))
	if contentType := q.Get("contentType"); contentType != "" {
		signedVals.Set("contentType", contentType)
	}
	msg := signedVals.Encode()

	hsh := hmac.New(sha256.New, h.secretKey)
	hsh.Write([]byte(msg))
	return base64.RawURLEncoding.EncodeToString(hsh.Sum(nil))
}

// KeyFromURL checks expiry and signature, and returns the object key
// only if the signed URL is both authentic and unexpired.
func (h *URLSignerHMAC) KeyFromURL(ctx context.Context, sURL *url.URL) (string, error) {
	q := sURL.Query()

	exp, err := strconv.ParseInt(q.Get("expiry"), 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return "", errors.New("retrieving blob key from URL: key cannot be retrieved")
	}

	if !h.checkMAC(q) {
		return "", errors.New("retrieving blob key from URL: key cannot be retrieved")
	}
	return q.Get("obj"), nil
}

func (h *URLSignerHMAC) checkMAC(q url.Values) bool {
	mac := q.Get("signature")
	expected := h.getMAC(q)
	// This compares the Base-64 encoded MACs
	return hmac.Equal([]byte(mac), []byte(expected))
}
